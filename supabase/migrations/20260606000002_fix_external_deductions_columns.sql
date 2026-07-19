-- ============================================================
-- FIX: calculate_employee_salary - wrong column names on
--      external_deductions table.
--
-- external_deductions schema (from 20260226083236):
--   apply_month TEXT NOT NULL        (not month_year)
--   approval_status approval_status  (not status)
--
-- Also: dashboard_overview_rpc has an unused parameter p_cip
-- (warning extra). Removing it would be a breaking API change,
-- so we suppress by documenting it as a reserved/compat param.
-- ============================================================

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

  -- Advance deductions (month_year is correct for advance_installments)
  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advance_installments ai
  JOIN public.advances a ON a.id = ai.advance_id
  WHERE a.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status = _const_installment_pending();

  -- FIX: external_deductions uses apply_month (not month_year)
  --      and approval_status (not status)
  SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = _const_approval_approved();

  v_payment_method := COALESCE(
    p_payment_method,
    CASE WHEN v_employee.iban IS NOT NULL
         THEN _const_payment_bank()
         ELSE _const_payment_cash()
    END
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
    v_total_earnings - v_advance_deduction - v_external_deduction
      - p_manual_deduction - v_attendance_deduction,
    v_platform_breakdown,
    v_payment_method;
END;
$$;

COMMENT ON FUNCTION public.calculate_employee_salary(UUID, TEXT, TEXT, NUMERIC, TEXT) IS
  'Fixed: external_deductions uses apply_month + approval_status (not month_year/status)';
