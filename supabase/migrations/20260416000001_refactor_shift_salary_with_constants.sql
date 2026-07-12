-- Refactored: Shift salary with constants (fixes SonarCloud CRITICAL issues)
-- Original: 20260415220000_shift_salary_always_full_month.sql
-- Changes: Replace duplicated literals with constants

DROP FUNCTION IF EXISTS public.preview_salary_for_month(text);

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  net_salary NUMERIC,
  platform_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE; v_end DATE;
  v_emp RECORD; v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER; v_total_shift_days INTEGER; v_base_salary NUMERIC;
  v_external_deduction NUMERIC; v_advance_deduction NUMERIC;
  v_net NUMERIC; v_platform_breakdown JSONB;
  v_calculation_method TEXT;
  v_tier RECORD;
  v_hybrid_rule RECORD;
  v_day RECORD; v_hours_worked NUMERIC;
  v_monthly_amount NUMERIC;
  -- Constants
  c_cancelled TEXT := _const_order_cancelled();
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
  c_orders TEXT := _const_work_orders();
  c_shift TEXT := _const_work_shift();
  c_hybrid TEXT := _const_work_hybrid();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN SELECT e.id FROM employees e WHERE e.status = c_active LOOP
    v_total_orders := 0; v_total_shift_days := 0; v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;

    FOR v_app IN
      SELECT a.id AS app_id, a.name AS app_name, a.work_type,
             s.id AS scheme_id, s.scheme_type, s.monthly_amount
      FROM apps a
      LEFT JOIN salary_schemes s ON s.id = a.scheme_id
      WHERE a.is_active IS TRUE AND a.scheme_id IS NOT NULL
    LOOP
      v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;
      v_calculation_method := c_orders;

      IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
        -- === ORDERS-BASED: salary from daily_orders ===
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := calc_tier_salary(v_app_orders, v_app.scheme_id);

      ELSIF v_app.work_type = c_shift THEN
        -- === SHIFT-BASED: always full monthly_amount ===
        v_calculation_method := _const_calc_method_shift_fixed();

        IF EXISTS(
          SELECT 1 FROM employee_apps ea
          WHERE ea.employee_id = v_emp.id AND ea.app_id = v_app.app_id
        ) THEN
          SELECT COUNT(*)::INTEGER INTO v_app_shift_days
          FROM daily_shifts ds
          WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id
            AND ds.date BETWEEN v_start AND v_end AND ds.hours_worked > 0;

          v_total_shift_days := v_total_shift_days + v_app_shift_days;

          v_monthly_amount := COALESCE(v_app.monthly_amount, 0);
          IF v_monthly_amount > 0 AND v_app_shift_days > 0 THEN
            v_app_earnings := ROUND((v_monthly_amount / c_days_per_month) * v_app_shift_days);
          ELSE
            v_app_earnings := 0;
          END IF;
        END IF;

      ELSIF v_app.work_type = c_hybrid THEN
        -- === HYBRID ===
        v_calculation_method := _const_calc_method_mixed();
        SELECT * INTO v_hybrid_rule FROM app_hybrid_rules WHERE app_id = v_app.app_id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
          FROM daily_orders d
          WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> c_cancelled);
          v_total_orders := v_total_orders + v_app_orders;
          v_app_earnings := calc_tier_salary(v_app_orders, v_app.scheme_id);
        ELSE
          FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date LOOP
            SELECT hours_worked INTO v_hours_worked
            FROM daily_shifts
            WHERE employee_id = v_emp.id AND app_id = v_app.app_id AND date = v_day.day_date;

            IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
              v_app_shift_days := v_app_shift_days + 1;
            ELSIF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM daily_orders d
              WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> c_cancelled);
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + calc_tier_salary(v_app_orders, v_app.scheme_id);
              END IF;
            END IF;
          END LOOP;
          v_total_shift_days := v_total_shift_days + v_app_shift_days;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;

      IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
        v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
          'app_id', v_app.app_id, 'app_name', v_app.app_name,
          'work_type', COALESCE(v_app.work_type, c_orders),
          'calculation_method', v_calculation_method,
          'orders_count', v_app_orders, 'shift_days', v_app_shift_days,
          'earnings', ROUND(v_app_earnings)
        );
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
    FROM advances ad JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    v_net := GREATEST(v_base_salary - v_external_deduction - v_advance_deduction, 0);

    employee_id := v_emp.id; total_orders := v_total_orders;
    total_shift_days := v_total_shift_days; base_salary := v_base_salary;
    external_deduction := v_external_deduction; advance_deduction := v_advance_deduction;
    net_salary := v_net; platform_breakdown := v_platform_breakdown;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =============================================================================
-- Same fix for calculate_salary_for_employee_month (saves to salary_records)
-- =============================================================================

DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT _const_payment_cash(),
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  out_employee_id UUID,
  out_month_year TEXT,
  out_total_orders INTEGER,
  out_total_shift_days INTEGER,
  out_base_salary NUMERIC,
  out_attendance_deduction NUMERIC,
  out_external_deduction NUMERIC,
  out_advance_deduction NUMERIC,
  out_manual_deduction NUMERIC,
  out_net_salary NUMERIC,
  out_calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_total_orders INTEGER := 0;
  v_total_shift_days INTEGER := 0;
  v_base_salary NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_manual_deduction NUMERIC := GREATEST(COALESCE(p_manual_deduction, 0), 0);
  v_net NUMERIC := 0;
  v_app RECORD;
  v_app_orders INTEGER;
  v_app_shifts INTEGER;
  v_app_earnings NUMERIC;
  v_hybrid_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_attendance_days INTEGER := 0;
  v_fixed_scheme_ids UUID[] := ARRAY[]::UUID[];
  v_order_calc RECORD;
  -- Constants
  c_cancelled TEXT := _const_order_cancelled();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
  c_orders TEXT := _const_work_orders();
  c_shift TEXT := _const_work_shift();
  c_hybrid TEXT := _const_work_hybrid();
  c_cash TEXT := _const_payment_cash();
  c_calculated TEXT := _const_calc_calculated();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_app IN
    SELECT a.id, a.name, a.work_type, a.scheme_id,
           s.scheme_type, s.monthly_amount
    FROM public.apps a
    LEFT JOIN public.salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    IF v_app.work_type = c_orders OR v_app.work_type IS NULL THEN
      -- === ORDERS: salary from daily_orders ===
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);
      v_total_orders := v_total_orders + v_app_orders;

      IF v_app.scheme_id IS NOT NULL THEN
        SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
      END IF;

    ELSIF v_app.work_type = c_shift THEN
      -- === SHIFT: salary from daily_shifts ===
      IF EXISTS(
        SELECT 1 FROM public.employee_apps ea
        WHERE ea.employee_id = p_employee_id AND ea.app_id = v_app.id
      ) THEN
        SELECT COUNT(*)::INTEGER INTO v_app_shifts
        FROM public.daily_shifts ds
        WHERE ds.employee_id = p_employee_id AND ds.app_id = v_app.id
          AND ds.date BETWEEN v_start AND v_end AND ds.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shifts;

        IF COALESCE(v_app.monthly_amount, 0) > 0 AND v_app_shifts > 0 THEN
          v_app_earnings := ROUND((v_app.monthly_amount / c_days_per_month) * v_app_shifts);
        END IF;
      END IF;

    ELSIF v_app.work_type = c_hybrid THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;
      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);
        v_total_orders := v_total_orders + v_app_orders;
        IF v_app.scheme_id IS NOT NULL THEN
          SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
          v_app_earnings := COALESCE(v_order_calc.earnings, 0);
          v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
        END IF;
      ELSE
        FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date LOOP
          SELECT ds.hours_worked INTO v_hours_worked FROM public.daily_shifts ds
          WHERE ds.employee_id = p_employee_id AND ds.app_id = v_app.id AND ds.date = v_day.day_date;
          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> c_cancelled);
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, 0, ARRAY[]::UUID[], false);
                v_app_earnings := v_app_earnings + COALESCE(v_order_calc.earnings, 0);
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    v_base_salary := v_base_salary + v_app_earnings;
  END LOOP;

  SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
  FROM public.external_deductions AS ed
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year AND ed.approval_status = c_approved;

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year AND ai.status IN (c_pending, c_deferred);

  v_net := GREATEST(v_base_salary - v_attendance_deduction - v_external_deduction - v_advance_deduction - v_manual_deduction, 0);

  INSERT INTO public.salary_records (
    employee_id, month_year, base_salary, attendance_deduction, external_deduction,
    advance_deduction, manual_deduction, manual_deduction_note, net_salary,
    payment_method, calc_status, calc_source, is_approved, sheet_snapshot
  ) VALUES (
    p_employee_id, p_month_year, v_base_salary, v_attendance_deduction, v_external_deduction,
    v_advance_deduction, v_manual_deduction, p_manual_deduction_note, v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), c_cash), c_calculated, _const_calc_source_v7(), false, NULL
  )
  ON CONFLICT (employee_id, month_year) DO UPDATE SET
    base_salary = EXCLUDED.base_salary, attendance_deduction = EXCLUDED.attendance_deduction,
    external_deduction = EXCLUDED.external_deduction, advance_deduction = EXCLUDED.advance_deduction,
    manual_deduction = EXCLUDED.manual_deduction, manual_deduction_note = EXCLUDED.manual_deduction_note,
    net_salary = EXCLUDED.net_salary, payment_method = EXCLUDED.payment_method,
    calc_status = EXCLUDED.calc_status, calc_source = EXCLUDED.calc_source,
    sheet_snapshot = NULL, updated_at = now();

  out_employee_id        := p_employee_id;
  out_month_year         := p_month_year;
  out_total_orders       := v_total_orders;
  out_total_shift_days   := v_total_shift_days;
  out_base_salary        := v_base_salary;
  out_attendance_deduction := v_attendance_deduction;
  out_external_deduction := v_external_deduction;
  out_advance_deduction  := v_advance_deduction;
  out_manual_deduction   := v_manual_deduction;
  out_net_salary         := v_net;
  out_calc_status        := c_calculated;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.preview_salary_for_month(TEXT) IS 
  'Refactored with constants - fixes SonarCloud CRITICAL: 10+ literal duplications removed';

COMMENT ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) IS 
  'Refactored with constants - fixes SonarCloud CRITICAL: 10+ literal duplications removed';
