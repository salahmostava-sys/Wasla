-- Migration: Update salary engine to support shifts and hybrid platforms
-- Date: 2026-04-03
-- Description: Replaces calculate_salary_for_employee_month and calculate_salary_for_month
--              to support work_type: orders, shift, hybrid

BEGIN;

-- Drop old functions to recreate with new signature
DROP FUNCTION IF EXISTS public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.calculate_salary_for_month(TEXT, TEXT);

-- ============================================================================
-- Function: calculate_salary_for_employee_month
-- Supports: orders, shift, hybrid work types
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash',
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
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
BEGIN
  -- Validate employee
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- Calculate date range
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  -- Loop through each active app for this employee
  FOR v_app IN
    SELECT a.id, a.name, a.work_type
    FROM public.apps a
    WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    -- ========================================================================
    -- ORDERS-BASED PLATFORM
    -- ========================================================================
    IF v_app.work_type = 'orders' OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
      INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> 'cancelled');

      v_total_orders := v_total_orders + v_app_orders;

      -- Use calc_tier_salary for default tier calculation
      v_app_earnings := public.calc_tier_salary(v_app_orders);

    -- ========================================================================
    -- SHIFT-BASED PLATFORM
    -- ========================================================================
    ELSIF v_app.work_type = 'shift' THEN
      SELECT COUNT(*)::INTEGER
      INTO v_app_shifts
      FROM public.daily_shifts AS s
      WHERE s.employee_id = p_employee_id
        AND s.app_id = v_app.id
        AND s.date BETWEEN v_start AND v_end
        AND s.hours_worked >= 8; -- Minimum 8 hours to count as a shift day

      v_total_shift_days := v_total_shift_days + v_app_shifts;

      -- Get shift rate from pricing_rules or default
      SELECT * INTO v_pricing_rule
      FROM public.pricing_rules
      WHERE app_id = v_app.id
        AND is_active IS TRUE
      ORDER BY priority DESC
      LIMIT 1;

      IF v_pricing_rule.fixed_salary IS NOT NULL THEN
        v_app_earnings := v_app_shifts * v_pricing_rule.fixed_salary;
      ELSE
        -- Default shift rate: 150 per day
        v_app_earnings := v_app_shifts * 150;
      END IF;

    -- ========================================================================
    -- HYBRID PLATFORM (Shift or Orders fallback)
    -- ========================================================================
    ELSIF v_app.work_type = 'hybrid' THEN
      -- Get hybrid rules
      SELECT * INTO v_hybrid_rule
      FROM public.app_hybrid_rules
      WHERE app_id = v_app.id;

      IF v_hybrid_rule IS NULL THEN
        -- No hybrid rule, fallback to orders
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
        INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id
          AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> 'cancelled');

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := public.calc_tier_salary(v_app_orders);
      ELSE
        -- Process each day individually for hybrid logic
        FOR v_day IN
          SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
        LOOP
          -- Check for shift first
          SELECT hours_worked INTO v_hours_worked
          FROM public.daily_shifts
          WHERE employee_id = p_employee_id
            AND app_id = v_app.id
            AND date = v_day.day_date;

          IF v_hours_worked IS NOT NULL AND v_hours_worked >= v_hybrid_rule.min_hours_for_shift THEN
            -- Shift achieved: use shift_rate
            v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
            v_total_shift_days := v_total_shift_days + 1;
          ELSE
            -- No shift or hours not met: check fallback
            IF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
              INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = p_employee_id
                AND d.app_id = v_app.id
                AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> 'cancelled');

              v_total_orders := v_total_orders + v_app_orders;

              -- Calculate per-order earnings for this day
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders);
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;

    -- Accumulate earnings
    v_base_salary := v_base_salary + v_app_earnings;
  END LOOP;

  -- Calculate external deductions
  SELECT COALESCE(SUM(ed.amount), 0)
  INTO v_external_deduction
  FROM public.external_deductions AS ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = 'approved';

  -- Calculate advance deductions
  SELECT COALESCE(SUM(ai.amount), 0)
  INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN ('pending', 'deferred');

  -- Calculate net salary
  v_net := GREATEST(
    v_base_salary
    - v_attendance_deduction
    - v_external_deduction
    - v_advance_deduction
    - v_manual_deduction,
    0
  );

  -- Insert or update salary record
  INSERT INTO public.salary_records (
    employee_id,
    month_year,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    manual_deduction_note,
    net_salary,
    payment_method,
    calc_status,
    calc_source,
    is_approved
  )
  VALUES (
    p_employee_id,
    p_month_year,
    v_base_salary,
    v_attendance_deduction,
    v_external_deduction,
    v_advance_deduction,
    v_manual_deduction,
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'),
    'calculated',
    'engine_v4_shifts',
    false
  )
  ON CONFLICT (employee_id, month_year)
  DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    attendance_deduction = EXCLUDED.attendance_deduction,
    external_deduction = EXCLUDED.external_deduction,
    advance_deduction = EXCLUDED.advance_deduction,
    manual_deduction = EXCLUDED.manual_deduction,
    manual_deduction_note = EXCLUDED.manual_deduction_note,
    net_salary = EXCLUDED.net_salary,
    payment_method = EXCLUDED.payment_method,
    calc_status = EXCLUDED.calc_status,
    calc_source = EXCLUDED.calc_source,
    updated_at = now()
  RETURNING
    public.salary_records.employee_id,
    public.salary_records.month_year,
    v_total_orders,
    v_total_shift_days,
    public.salary_records.base_salary,
    public.salary_records.attendance_deduction,
    public.salary_records.external_deduction,
    public.salary_records.advance_deduction,
    public.salary_records.manual_deduction,
    public.salary_records.net_salary,
    public.salary_records.calc_status
  INTO
    employee_id,
    month_year,
    total_orders,
    total_shift_days,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    net_salary,
    calc_status;

  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Function: calculate_salary_for_month
-- Calculates salary for all active employees
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  total_shift_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_emp RECORD;
BEGIN
  FOR v_emp IN
    SELECT e.id
    FROM public.employees AS e
    WHERE e.status = 'active'
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      v_emp.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
END;
$$;

-- Restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.calculate_salary_for_employee_month IS 'v4: Calculates salary supporting orders, shift, and hybrid work types';

COMMIT;
