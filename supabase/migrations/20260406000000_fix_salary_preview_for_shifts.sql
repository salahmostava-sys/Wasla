-- Migration: Fix salary preview to support shifts and hybrid platforms
-- Date: 2026-04-06
-- Description: Updates preview_salary_for_month to match calculate_salary_for_employee_month logic

BEGIN;

DROP FUNCTION IF EXISTS public.preview_salary_for_month(TEXT);

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(
  p_month_year TEXT
)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  base_salary NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  net_salary NUMERIC
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
  v_app_shifts INTEGER;
  v_app_earnings NUMERIC;
  v_hybrid_rule RECORD;
  v_pricing_rule RECORD;
  v_day RECORD;
  v_hours_worked NUMERIC;
  v_total_orders INTEGER;
  v_base_salary NUMERIC;
  v_external_deduction NUMERIC;
  v_advance_deduction NUMERIC;
  v_net NUMERIC;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  -- Loop through each active employee
  FOR v_emp IN
    SELECT e.id
    FROM public.employees e
    WHERE e.status = 'active'
  LOOP
    v_total_orders := 0;
    v_base_salary := 0;

    -- Loop through each active app
    FOR v_app IN
      SELECT a.id, a.name, a.work_type
      FROM public.apps a
      WHERE a.is_active IS TRUE
    LOOP
      v_app_earnings := 0;

      -- ORDERS-BASED PLATFORM
      IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = v_emp.id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> 'cancelled');

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := public.calc_tier_salary(v_app_orders);

      -- SHIFT-BASED PLATFORM
      ELSIF v_app.work_type = 'shift' THEN
        SELECT COUNT(*)::INTEGER
        INTO v_app_shifts
        FROM public.daily_shifts AS s
        WHERE s.employee_id = v_emp.id
          AND s.app_id = v_app.id
          AND s.date BETWEEN v_start AND v_end
          AND s.hours_worked >= 8;

        SELECT * INTO v_pricing_rule
        FROM public.pricing_rules
        WHERE app_id = v_app.id
          AND is_active IS TRUE
        ORDER BY priority DESC
        LIMIT 1;

        IF v_pricing_rule.fixed_salary IS NOT NULL THEN
          v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
        ELSE
          v_app_earnings := v_app_shifts * 150;
        END IF;

      -- HYBRID PLATFORM
      ELSIF v_app.work_type = 'hybrid' THEN
        SELECT * INTO v_hybrid_rule
        FROM public.app_hybrid_rules
        WHERE app_id = v_app.id;

        IF v_hybrid_rule IS NULL THEN
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
          INTO v_app_orders
          FROM public.daily_orders AS d
          WHERE d.employee_id = v_emp.id
            AND d.app_id = v_app.id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> 'cancelled');

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

            IF v_hours_worked IS NOT NULL AND v_hours_worked >= v_hybrid_rule.min_hours_for_shift THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            ELSE
              IF v_hybrid_rule.fallback_to_orders THEN
                SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
                INTO v_app_orders
                FROM public.daily_orders AS d
                WHERE d.employee_id = v_emp.id
                  AND d.app_id = v_app.id
                  AND d.date = v_day.day_date
                  AND (d.status IS NULL OR d.status <> 'cancelled');

                v_total_orders := v_total_orders + v_app_orders;

                IF v_app_orders > 0 THEN
                  v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders);
                END IF;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;
    END LOOP;

    -- Calculate external deductions
    SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
    FROM public.external_deductions AS ed
    WHERE ed.employee_id = v_emp.id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = 'approved';

    -- Calculate advance deductions
    SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
    FROM public.advances AS ad
    JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id
      AND ai.month_year = p_month_year
      AND ai.status IN ('pending', 'deferred');

    -- Calculate net salary
    v_net := GREATEST(
      v_base_salary
      - v_external_deduction
      - v_advance_deduction,
      0
    );

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    base_salary := v_base_salary;
    external_deduction := v_external_deduction;
    advance_deduction := v_advance_deduction;
    net_salary := v_net;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;

COMMENT ON FUNCTION public.preview_salary_for_month IS 'v2: Preview salary supporting orders, shift, and hybrid work types';

COMMIT;
