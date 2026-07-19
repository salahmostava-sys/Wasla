-- ============================================================
-- FIX: Remaining lint errors after 20260606000000
--
-- 1. public.calculate_employee_salary:
--    ERROR: column ai.due_date does not exist (42703)
--    advance_installments has no due_date column â€” it uses month_year TEXT.
--    Fix: replace `ai.due_date BETWEEN v_start AND v_end`
--         with `ai.month_year = p_month_year`
--
-- 2. public.preview_salary_for_month:
--    WARNING: unused variable "v_tier"
--    Fix: remove the v_tier RECORD declaration.
-- ============================================================

-- â”€â”€ 1. Fix calculate_employee_salary (due_date â†’ month_year) â”€
CREATE OR REPLACE FUNCTION public.calculate_employee_salary(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  base_salary NUMERIC,
  total_orders INTEGER,
  total_shift_days INTEGER,
  total_earnings NUMERIC,
  advance_deduction NUMERIC,
  external_deduction NUMERIC,
  manual_deduction NUMERIC,
  manual_deduction_note TEXT,
  attendance_deduction NUMERIC,
  net_salary NUMERIC,
  platform_breakdown JSONB,
  payment_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_employee RECORD;
  v_start DATE;
  v_end DATE;
  v_total_orders INTEGER := 0;
  v_total_shift_days INTEGER := 0;
  v_total_earnings NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_app RECORD;
  v_app_orders INTEGER := 0;
  v_app_shifts INTEGER := 0;
  v_app_earnings NUMERIC := 0;
  v_pricing_rule RECORD;
  v_hybrid_rule RECORD;
  v_hours_worked NUMERIC;
  v_day RECORD;
  v_platform_breakdown JSONB := '[]'::JSONB;
  v_platform_item JSONB;
  v_payment_method TEXT;
BEGIN
  v_start := (p_month_year || '-01')::DATE;
  v_end := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  SELECT * INTO v_employee FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', p_employee_id;
  END IF;

  FOR v_app IN
    SELECT a.id, a.name, COALESCE(a.work_type, _const_work_orders()) AS work_type
    FROM public.apps a
    JOIN public.employee_apps ea ON ea.app_id = a.id
    WHERE ea.employee_id = p_employee_id
      AND ea.status = _const_employee_active()
      AND a.is_active IS TRUE
    ORDER BY a.name
  LOOP
    v_app_orders := 0;
    v_app_shifts := 0;
    v_app_earnings := 0;

    IF v_app.work_type = _const_work_orders() THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> _const_order_cancelled());
      v_total_orders := v_total_orders + v_app_orders;
      v_app_earnings := public.calc_tier_salary(v_app_orders);

    ELSIF v_app.work_type = _const_work_shift() THEN
      SELECT COUNT(*)::INTEGER INTO v_app_shifts
      FROM public.daily_shifts AS s
      WHERE s.employee_id = p_employee_id
        AND s.app_id = v_app.id
        AND s.date BETWEEN v_start AND v_end
        AND s.hours_worked > 0;
      v_total_shift_days := v_total_shift_days + v_app_shifts;

      SELECT * INTO v_pricing_rule
      FROM public.pricing_rules
      WHERE app_id = v_app.id AND is_active IS TRUE
      ORDER BY priority DESC LIMIT 1;

      IF v_pricing_rule.fixed_salary IS NOT NULL THEN
        v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
      ELSE
        v_app_earnings := v_app_shifts * 150;
      END IF;

    ELSIF v_app.work_type = _const_work_hybrid() THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;

      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());
        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := public.calc_tier_salary(v_app_orders);
      ELSE
        FOR v_day IN
          SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
        LOOP
          SELECT ds.hours_worked INTO v_hours_worked
          FROM public.daily_shifts AS ds
          WHERE ds.employee_id = p_employee_id
            AND ds.app_id = v_app.id
            AND ds.date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders);
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    v_total_earnings := v_total_earnings + v_app_earnings;
    v_platform_item := jsonb_build_object(
      'app_id', v_app.id,
      'app_name', v_app.name,
      'work_type', v_app.work_type,
      _const_work_orders(), v_app_orders,
      'shift_days', v_app_shifts,
      'earnings', v_app_earnings
    );
    v_platform_breakdown := v_platform_breakdown || jsonb_build_array(v_platform_item);
  END LOOP;

  -- FIX: advance_installments has no due_date column.
  -- Use month_year = p_month_year (TEXT) instead of due_date BETWEEN dates.
  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advance_installments ai
  JOIN public.advances a ON a.id = ai.advance_id
  WHERE a.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status = _const_installment_pending();

  SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.month_year = p_month_year
    AND ed.status = _const_approval_approved();

  v_payment_method := COALESCE(
    p_payment_method,
    CASE WHEN v_employee.iban IS NOT NULL THEN _const_payment_bank() ELSE _const_payment_cash() END
  );

  RETURN QUERY SELECT
    p_employee_id,
    v_employee.name::TEXT,
    v_total_earnings,
    v_total_orders,
    v_total_shift_days,
    v_total_earnings,
    v_advance_deduction,
    v_external_deduction,
    p_manual_deduction,
    p_manual_deduction_note,
    v_attendance_deduction,
    v_total_earnings - v_advance_deduction - v_external_deduction - p_manual_deduction - v_attendance_deduction,
    v_platform_breakdown,
    v_payment_method;
END;
$$;

-- â”€â”€ 2. Fix preview_salary_for_month (remove unused v_tier) â”€â”€â”€
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
  -- v_tier removed: was declared but never used (lint warning)
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
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> c_cancelled);
        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := calc_tier_salary(v_app_orders, v_app.scheme_id);

      ELSIF v_app.work_type = c_shift THEN
        v_calculation_method := _const_calc_method_shift_fixed();
        IF EXISTS(SELECT 1 FROM employee_apps ea
                  WHERE ea.employee_id = v_emp.id AND ea.app_id = v_app.app_id) THEN
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
            SELECT ds.hours_worked INTO v_hours_worked
            FROM daily_shifts AS ds
            WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id AND ds.date = v_day.day_date;
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

COMMENT ON FUNCTION public.calculate_employee_salary(UUID, TEXT, TEXT, NUMERIC, TEXT) IS
  'Fixed: ai.due_date â†’ ai.month_year (advance_installments has no due_date column)';
COMMENT ON FUNCTION public.preview_salary_for_month(TEXT) IS
  'Fixed: removed unused v_tier variable (lint warning)';
