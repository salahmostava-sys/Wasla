DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash',
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
  v_pricing_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_attendance_days INTEGER := 0;
  v_fixed_scheme_ids UUID[] := ARRAY[]::UUID[];
  v_order_calc RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  SELECT COUNT(*)::INTEGER INTO v_attendance_days
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id AND a.date BETWEEN v_start AND v_end;

  FOR v_app IN
    SELECT a.id, a.name, a.work_type FROM public.apps a WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> 'cancelled');
      v_total_orders := v_total_orders + v_app_orders;
      SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
      v_app_earnings := COALESCE(v_order_calc.earnings, 0);
      v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);

    ELSIF v_app.work_type = 'shift' THEN
      SELECT COUNT(*)::INTEGER INTO v_app_shifts
      FROM public.daily_shifts AS s
      WHERE s.employee_id = p_employee_id AND s.app_id = v_app.id
        AND s.date BETWEEN v_start AND v_end AND s.hours_worked >= 8;
      v_total_shift_days := v_total_shift_days + v_app_shifts;
      SELECT * INTO v_pricing_rule FROM public.pricing_rules
      WHERE app_id = v_app.id AND is_active IS TRUE ORDER BY priority DESC LIMIT 1;
      IF v_pricing_rule.fixed_salary IS NOT NULL THEN
        v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
      ELSE
        v_app_earnings := v_app_shifts * 150;
      END IF;

    ELSIF v_app.work_type = 'hybrid' THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;
      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> 'cancelled');
        v_total_orders := v_total_orders + v_app_orders;
        SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
      ELSE
        FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
        LOOP
          SELECT ds.hours_worked INTO v_hours_worked FROM public.daily_shifts ds
          WHERE ds.employee_id = p_employee_id AND ds.app_id = v_app.id AND ds.date = v_day.day_date;
          IF v_hours_worked IS NOT NULL AND v_hours_worked >= v_hybrid_rule.min_hours_for_shift THEN
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> 'cancelled');
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
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year AND ed.approval_status = 'approved';

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year AND ai.status IN ('pending', 'deferred');

  v_net := GREATEST(v_base_salary - v_attendance_deduction - v_external_deduction - v_advance_deduction - v_manual_deduction, 0);

  INSERT INTO public.salary_records (
    employee_id, month_year, base_salary, attendance_deduction, external_deduction,
    advance_deduction, manual_deduction, manual_deduction_note, net_salary,
    payment_method, calc_status, calc_source, is_approved, sheet_snapshot
  ) VALUES (
    p_employee_id, p_month_year, v_base_salary, v_attendance_deduction, v_external_deduction,
    v_advance_deduction, v_manual_deduction, p_manual_deduction_note, v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'), 'calculated', 'engine_v5_sheet_aligned', false, NULL
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
  out_calc_status        := 'calculated';

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
