-- Debug and fix: the preview function reads scheme but monthly_amount returns NULL
-- Possible cause: RLS blocks the read even with SECURITY DEFINER
-- Fix: use explicit schema and bypass RLS

-- First create a simple test function
CREATE OR REPLACE FUNCTION public.test_shift_salary()
RETURNS TABLE (app_name TEXT, scheme_name TEXT, monthly_amount NUMERIC, daily_rate NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT a.name, s.name, s.monthly_amount, s.monthly_amount / _const_days_per_month()
  FROM apps a
  JOIN salary_schemes s ON s.id = a.scheme_id
  WHERE a.work_type = _const_work_shift() AND a.is_active IS TRUE;
$$;

-- Now fix the main function - use a direct JOIN instead of SELECT INTO
DROP FUNCTION IF EXISTS public.preview_salary_for_month(text);

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID, total_orders INTEGER, total_shift_days INTEGER,
  base_salary NUMERIC, external_deduction NUMERIC, advance_deduction NUMERIC,
  net_salary NUMERIC, platform_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE; v_end DATE; v_emp RECORD; v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER; v_total_shift_days INTEGER; v_base_salary NUMERIC;
  v_external_deduction NUMERIC; v_advance_deduction NUMERIC;
  v_net NUMERIC; v_platform_breakdown JSONB;
  v_shift_daily_rate NUMERIC; v_monthly_amount NUMERIC;
  v_tier RECORD;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN SELECT e.id FROM employees e WHERE e.status = _const_employee_active() LOOP
    v_total_orders := 0; v_total_shift_days := 0; v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;

    -- Join apps with salary_schemes directly to avoid SELECT INTO issues
    FOR v_app IN
      SELECT a.id AS app_id, a.name AS app_name, a.work_type,
             s.id AS sid, s.scheme_type, s.monthly_amount
      FROM apps a
      LEFT JOIN salary_schemes s ON s.id = a.scheme_id
      WHERE a.is_active = true AND a.scheme_id IS NOT NULL
    LOOP
      v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;

      IF v_app.work_type = _const_work_shift() THEN
        -- Count shift days
        SELECT COUNT(*)::INTEGER INTO v_app_shift_days
        FROM daily_shifts s
        WHERE s.employee_id = v_emp.id AND s.app_id = v_app.app_id
          AND s.date BETWEEN v_start AND v_end AND s.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shift_days;

        -- Calculate daily rate from monthly_amount (already joined)
        v_monthly_amount := COALESCE(v_app.monthly_amount, 0);
        IF v_monthly_amount > 0 THEN
          v_shift_daily_rate := v_monthly_amount / _const_days_per_month();
        ELSE
          v_shift_daily_rate := 0;
        END IF;
        v_app_earnings := v_app_shift_days * v_shift_daily_rate;

      ELSIF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());

        v_total_orders := v_total_orders + v_app_orders;

        IF v_app_orders > 0 THEN
          IF v_app.scheme_type = 'fixed_monthly' THEN
            v_app_earnings := COALESCE(v_app.monthly_amount, 0);
          ELSE
            -- Find matching tier from this scheme's tiers
            FOR v_tier IN
              SELECT * FROM salary_scheme_tiers
              WHERE scheme_id = v_app.sid AND from_orders <= v_app_orders
              ORDER BY from_orders DESC LIMIT 1
            LOOP
              IF v_tier.tier_type = _const_tier_fixed() THEN
                v_app_earnings := v_tier.price_per_order;
              ELSIF v_tier.tier_type = _const_tier_incremental() THEN
                v_app_earnings := v_tier.price_per_order
                  + GREATEST(v_app_orders - COALESCE(v_tier.incremental_threshold, v_tier.from_orders), 0)
                  * COALESCE(v_tier.incremental_price, 0);
              ELSE
                v_app_earnings := v_app_orders * v_tier.price_per_order;
              END IF;
            END LOOP;
          END IF;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;

      IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
        v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
          'app_id', v_app.app_id, 'app_name', v_app.app_name,
          'work_type', COALESCE(v_app.work_type, _const_work_orders()),
          'calculation_method', CASE WHEN v_app.work_type = _const_work_shift() THEN _const_calc_method_shift() ELSE _const_calc_method_orders() END,
          'orders_count', v_app_orders, 'shift_days', v_app_shift_days,
          'earnings', ROUND(v_app_earnings)
        );
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id AND ed.apply_month = p_month_year
      AND ed.approval_status = _const_approval_approved();

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
    FROM advances ad JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id AND ai.month_year = p_month_year
      AND ai.status IN (_const_installment_pending(), _const_installment_deferred());

    v_net := GREATEST(v_base_salary - v_external_deduction - v_advance_deduction, 0);

    employee_id := v_emp.id; total_orders := v_total_orders;
    total_shift_days := v_total_shift_days; base_salary := v_base_salary;
    external_deduction := v_external_deduction; advance_deduction := v_advance_deduction;
    net_salary := v_net; platform_breakdown := v_platform_breakdown;
    RETURN NEXT;
  END LOOP;
END;
$$;
