-- Fix preview_salary_for_month: shift threshold hours_worked >= 8 â†’ > 0
-- UI now uses present=1/absent=0 so >= 8 never matches.

BEGIN;

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(
  p_month_year TEXT
)
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
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_emp RECORD;
  v_app RECORD;
  v_app_orders INTEGER;
  v_app_shift_days INTEGER;
  v_app_earnings NUMERIC;
  v_hybrid_rule RECORD;
  v_pricing_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_total_orders INTEGER;
  v_total_shift_days INTEGER;
  v_base_salary NUMERIC;
  v_external_deduction NUMERIC;
  v_advance_deduction NUMERIC;
  v_net NUMERIC;
  v_platform_breakdown JSONB;
  v_calculation_method TEXT;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN
    SELECT e.id
    FROM public.employees e
    WHERE e.status = _const_employee_active()
  LOOP
    v_total_orders := 0;
    v_total_shift_days := 0;
    v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;

    FOR v_app IN
      SELECT a.id, a.name, a.work_type
      FROM public.apps a
      WHERE a.is_active IS TRUE
    LOOP
      v_app_orders := 0;
      v_app_shift_days := 0;
      v_app_earnings := 0;
      v_calculation_method := _const_work_orders();

      IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = v_emp.id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := public.calc_tier_salary(v_app_orders);

      ELSIF v_app.work_type = _const_work_shift() THEN
        v_calculation_method := _const_work_shift();

        -- Count any day with hours_worked > 0 as present (was >= 8)
        SELECT COUNT(*)::INTEGER
        INTO v_app_shift_days
        FROM public.daily_shifts AS s
        WHERE s.employee_id = v_emp.id
          AND s.app_id = v_app.id
          AND s.date BETWEEN v_start AND v_end
          AND s.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shift_days;

        SELECT * INTO v_pricing_rule
        FROM public.pricing_rules
        WHERE app_id = v_app.id
          AND is_active IS TRUE
        ORDER BY priority DESC
        LIMIT 1;

        IF v_pricing_rule.fixed_salary IS NOT NULL THEN
          v_app_earnings := v_app_shift_days * v_pricing_rule.fixed_salary;
        ELSE
          v_app_earnings := v_app_shift_days * 150;
        END IF;

      ELSIF v_app.work_type = _const_work_hybrid() THEN
        SELECT * INTO v_hybrid_rule
        FROM public.app_hybrid_rules
        WHERE app_id = v_app.id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();

          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
          INTO v_app_orders
          FROM public.daily_orders AS d
          WHERE d.employee_id = v_emp.id
            AND d.app_id = v_app.id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> _const_order_cancelled());

          v_total_orders := v_total_orders + v_app_orders;
          v_app_earnings := public.calc_tier_salary(v_app_orders);
        ELSE
          FOR v_day IN
            SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
          LOOP
            SELECT hours_worked INTO v_hours_worked
            FROM public.daily_shifts
            WHERE employee_id = v_emp.id
              AND app_id = v_app.id
              AND date = v_day.day_date;

            -- Present = hours_worked > 0 (was >= min_hours_for_shift)
            IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
              v_app_shift_days := v_app_shift_days + 1;
            ELSIF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
              INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = v_emp.id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());

              v_total_orders := v_total_orders + v_app_orders;

              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders);
              END IF;
            END IF;
          END LOOP;

          v_total_shift_days := v_total_shift_days + v_app_shift_days;

          IF v_app_shift_days > 0 AND v_app_orders > 0 THEN
            v_calculation_method := _const_calc_method_mixed();
          ELSIF v_app_shift_days > 0 THEN
            v_calculation_method := _const_work_shift();
          ELSIF v_app_orders > 0 THEN
            v_calculation_method := _const_calc_method_orders_fallback();
          ELSE
            v_calculation_method := 'none';
          END IF;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;

      IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
        v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
          'app_id', v_app.id,
          'app_name', v_app.name,
          'work_type', COALESCE(v_app.work_type, _const_work_orders()),
          'calculation_method', v_calculation_method,
          'orders_count', v_app_orders,
          'shift_days', v_app_shift_days,
          'earnings', v_app_earnings
        );
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
    FROM public.external_deductions AS ed
    WHERE ed.employee_id = v_emp.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = _const_approval_approved();

    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM public.advances AS ad
    JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id
      AND ai.month_year = p_month_year
      AND ai.status IN (_const_installment_pending(), _const_installment_deferred());

    v_net := GREATEST(
      v_base_salary
      - v_external_deduction
      - v_advance_deduction,
      0
    );

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    total_shift_days := v_total_shift_days;
    base_salary := v_base_salary;
    external_deduction := v_external_deduction;
    advance_deduction := v_advance_deduction;
    net_salary := v_net;
    platform_breakdown := v_platform_breakdown;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMIT;
