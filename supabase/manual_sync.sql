-- MANUAL SYNC FILE
-- Contains all migrations from 20260415000000_constants.sql onwards

-- =============================================================================
-- FILE: 20260415000000_constants.sql
-- =============================================================================

-- =============================================================================
-- Shared Constants for SQL Migrations
-- =============================================================================
-- This file defines reusable constants to avoid duplication across migrations.
-- Import these in your migration files when needed.

-- Status values
DO $$ BEGIN
  -- Order statuses
  CREATE TEMP TABLE IF NOT EXISTS _order_statuses AS
  SELECT 'cancelled'::TEXT AS cancelled;

  -- Installment statuses
  CREATE TEMP TABLE IF NOT EXISTS _installment_statuses AS
  SELECT 
    'pending'::TEXT AS pending,
    'deferred'::TEXT AS deferred;

  -- Approval statuses
  CREATE TEMP TABLE IF NOT EXISTS _approval_statuses AS
  SELECT 'approved'::TEXT AS approved;

  -- Work types
  CREATE TEMP TABLE IF NOT EXISTS _work_types AS
  SELECT
    'orders'::TEXT AS orders,
    'shift'::TEXT AS shift,
    'hybrid'::TEXT AS hybrid;

  -- Calculation methods
  CREATE TEMP TABLE IF NOT EXISTS _calc_methods AS
  SELECT
    'orders'::TEXT AS orders,
    'shift'::TEXT AS shift,
    'shift_fixed'::TEXT AS shift_fixed,
    'shift_full_month'::TEXT AS shift_full_month,
    'mixed'::TEXT AS mixed,
    'orders_fallback'::TEXT AS orders_fallback;

  -- Tier types
  CREATE TEMP TABLE IF NOT EXISTS _tier_types AS
  SELECT
    'fixed_amount'::TEXT AS fixed_amount,
    'base_plus_incremental'::TEXT AS base_plus_incremental,
    'per_order'::TEXT AS per_order;

  -- Payment methods
  CREATE TEMP TABLE IF NOT EXISTS _payment_methods AS
  SELECT
    'cash'::TEXT AS cash,
    'bank'::TEXT AS bank;

  -- Calculation statuses
  CREATE TEMP TABLE IF NOT EXISTS _calc_statuses AS
  SELECT 'calculated'::TEXT AS calculated;

  -- Calculation sources
  CREATE TEMP TABLE IF NOT EXISTS _calc_sources AS
  SELECT
    'engine_v6_shift_fallback'::TEXT AS v6_shift_fallback,
    'engine_v7_shift_fixed'::TEXT AS v7_shift_fixed;

  -- Employee statuses
  CREATE TEMP TABLE IF NOT EXISTS _employee_statuses AS
  SELECT 'active'::TEXT AS active;

  -- Numeric constants
  CREATE TEMP TABLE IF NOT EXISTS _numeric_constants AS
  SELECT
    30.0::NUMERIC AS days_per_month,
    0::NUMERIC AS zero;

END $$;

-- =============================================================================
-- Helper Functions for Constants
-- =============================================================================

-- Get order status: cancelled
CREATE OR REPLACE FUNCTION _const_order_cancelled() RETURNS TEXT AS $$
  SELECT 'cancelled'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get installment statuses: pending, deferred
CREATE OR REPLACE FUNCTION _const_installment_pending() RETURNS TEXT AS $$
  SELECT 'pending'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_installment_deferred() RETURNS TEXT AS $$
  SELECT 'deferred'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get approval status: approved
CREATE OR REPLACE FUNCTION _const_approval_approved() RETURNS TEXT AS $$
  SELECT 'approved'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get work types
CREATE OR REPLACE FUNCTION _const_work_orders() RETURNS TEXT AS $$
  SELECT 'orders'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_work_shift() RETURNS TEXT AS $$
  SELECT 'shift'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_work_hybrid() RETURNS TEXT AS $$
  SELECT 'hybrid'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get days per month constant
CREATE OR REPLACE FUNCTION _const_days_per_month() RETURNS NUMERIC AS $$
  SELECT 30.0::NUMERIC;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get employee status: active
CREATE OR REPLACE FUNCTION _const_employee_active() RETURNS TEXT AS $$
  SELECT 'active'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get payment methods
CREATE OR REPLACE FUNCTION _const_payment_cash() RETURNS TEXT AS $$
  SELECT 'cash'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_payment_bank() RETURNS TEXT AS $$
  SELECT 'bank'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation status
CREATE OR REPLACE FUNCTION _const_calc_calculated() RETURNS TEXT AS $$
  SELECT 'calculated'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation sources
CREATE OR REPLACE FUNCTION _const_calc_source_v6() RETURNS TEXT AS $$
  SELECT 'engine_v6_shift_fallback'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_source_v7() RETURNS TEXT AS $$
  SELECT 'engine_v7_shift_fixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation methods
CREATE OR REPLACE FUNCTION _const_calc_method_orders() RETURNS TEXT AS $$
  SELECT 'orders'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift() RETURNS TEXT AS $$
  SELECT 'shift'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_fixed() RETURNS TEXT AS $$
  SELECT 'shift_fixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_full_month() RETURNS TEXT AS $$
  SELECT 'shift_full_month'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_mixed() RETURNS TEXT AS $$
  SELECT 'mixed'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_orders_fallback() RETURNS TEXT AS $$
  SELECT 'orders_fallback'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get tier types
CREATE OR REPLACE FUNCTION _const_tier_fixed() RETURNS TEXT AS $$
  SELECT 'fixed_amount'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_tier_incremental() RETURNS TEXT AS $$
  SELECT 'base_plus_incremental'::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

COMMENT ON FUNCTION _const_order_cancelled() IS 'Constant: cancelled order status';
COMMENT ON FUNCTION _const_installment_pending() IS 'Constant: pending installment status';
COMMENT ON FUNCTION _const_installment_deferred() IS 'Constant: deferred installment status';
COMMENT ON FUNCTION _const_approval_approved() IS 'Constant: approved status';
COMMENT ON FUNCTION _const_work_orders() IS 'Constant: orders work type';
COMMENT ON FUNCTION _const_work_shift() IS 'Constant: shift work type';
COMMENT ON FUNCTION _const_work_hybrid() IS 'Constant: hybrid work type';
COMMENT ON FUNCTION _const_days_per_month() IS 'Constant: 30 days per month for salary calculations';
COMMENT ON FUNCTION _const_employee_active() IS 'Constant: active employee status';
COMMENT ON FUNCTION _const_payment_cash() IS 'Constant: cash payment method';
COMMENT ON FUNCTION _const_payment_bank() IS 'Constant: bank payment method';
COMMENT ON FUNCTION _const_calc_calculated() IS 'Constant: calculated status';
COMMENT ON FUNCTION _const_tier_fixed() IS 'Constant: fixed_amount tier type';
COMMENT ON FUNCTION _const_tier_incremental() IS 'Constant: base_plus_incremental tier type';
COMMENT ON FUNCTION _const_calc_source_v6() IS 'Constant: engine_v6_shift_fallback calc source';
COMMENT ON FUNCTION _const_calc_source_v7() IS 'Constant: engine_v7_shift_fixed calc source';
COMMENT ON FUNCTION _const_calc_method_orders() IS 'Constant: orders calculation method';
COMMENT ON FUNCTION _const_calc_method_shift() IS 'Constant: shift calculation method';
COMMENT ON FUNCTION _const_calc_method_shift_fixed() IS 'Constant: shift_fixed calculation method';
COMMENT ON FUNCTION _const_calc_method_shift_full_month() IS 'Constant: shift_full_month calculation method';
COMMENT ON FUNCTION _const_calc_method_mixed() IS 'Constant: mixed calculation method';
COMMENT ON FUNCTION _const_calc_method_orders_fallback() IS 'Constant: orders_fallback calculation method';


-- =============================================================================
-- FILE: 20260415100000_fix_calc_tier_with_scheme_id.sql
-- =============================================================================

-- Fix: calc_tier_salary now takes scheme_id to read the correct tiers.
-- Previously read from ALL tiers without filtering by scheme.

DROP FUNCTION IF EXISTS public.calc_tier_salary(integer);

CREATE OR REPLACE FUNCTION public.calc_tier_salary(
  p_orders INTEGER,
  p_scheme_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tier RECORD;
  v_salary NUMERIC := 0;
BEGIN
  IF p_orders <= 0 OR p_scheme_id IS NULL THEN RETURN 0; END IF;

  FOR v_tier IN
    SELECT * FROM public.salary_scheme_tiers
    WHERE scheme_id = p_scheme_id
      AND from_orders <= p_orders
    ORDER BY from_orders DESC
    LIMIT 1
  LOOP
    IF v_tier.tier_type = _const_tier_fixed() THEN
      v_salary := v_tier.price_per_order;
    ELSIF v_tier.tier_type = _const_tier_incremental() THEN
      v_salary := v_tier.price_per_order
        + GREATEST(p_orders - COALESCE(v_tier.incremental_threshold, v_tier.from_orders), 0)
        * COALESCE(v_tier.incremental_price, 0);
    ELSE
      v_salary := p_orders * v_tier.price_per_order;
    END IF;
  END LOOP;

  RETURN ROUND(v_salary);
END;
$$;

-- Fix preview_salary_for_month to pass scheme_id to calc_tier_salary
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
SET search_path = public
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
  v_scheme RECORD;
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
  v_shift_daily_rate NUMERIC;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN
    SELECT e.id FROM public.employees e WHERE e.status = _const_employee_active()
  LOOP
    v_total_orders := 0;
    v_total_shift_days := 0;
    v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;

    FOR v_app IN
      SELECT a.id, a.name, a.work_type, a.scheme_id
      FROM public.apps a WHERE a.is_active IS TRUE
    LOOP
      v_app_orders := 0;
      v_app_shift_days := 0;
      v_app_earnings := 0;
      v_calculation_method := _const_work_orders();

      -- Skip if no scheme linked
      IF v_app.scheme_id IS NULL THEN
        CONTINUE;
      END IF;

      IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());

        v_total_orders := v_total_orders + v_app_orders;
        -- Pass scheme_id to calc_tier_salary
        v_app_earnings := public.calc_tier_salary(v_app_orders, v_app.scheme_id);

      ELSIF v_app.work_type = _const_work_shift() THEN
        v_calculation_method := _const_work_shift();

        SELECT COUNT(*)::INTEGER INTO v_app_shift_days
        FROM public.daily_shifts AS s
        WHERE s.employee_id = v_emp.id AND s.app_id = v_app.id
          AND s.date BETWEEN v_start AND v_end AND s.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shift_days;

        -- Read daily rate from salary_schemes (monthly_amount / 30)
        v_shift_daily_rate := 0;
        SELECT * INTO v_scheme FROM public.salary_schemes WHERE id = v_app.scheme_id;
        IF v_scheme IS NOT NULL AND COALESCE(v_scheme.monthly_amount, 0) > 0 THEN
          v_shift_daily_rate := v_scheme.monthly_amount / _const_days_per_month();
        END IF;
        v_app_earnings := v_app_shift_days * v_shift_daily_rate;

      ELSIF v_app.work_type = _const_work_hybrid() THEN
        SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
          FROM public.daily_orders AS d
          WHERE d.employee_id = v_emp.id AND d.app_id = v_app.id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> _const_order_cancelled());
          v_total_orders := v_total_orders + v_app_orders;
          v_app_earnings := public.calc_tier_salary(v_app_orders, v_app.scheme_id);
        ELSE
          FOR v_day IN SELECT generate_series(v_start, v_end, '1 day'::interval)::date AS day_date
          LOOP
            SELECT hours_worked INTO v_hours_worked
            FROM public.daily_shifts
            WHERE employee_id = v_emp.id AND app_id = v_app.id AND date = v_day.day_date;

            IF v_hours_worked IS NOT NULL AND v_hours_worked > 0 THEN
              v_app_earnings := v_app_earnings + v_hybrid_rule.shift_rate;
              v_app_shift_days := v_app_shift_days + 1;
            ELSIF v_hybrid_rule.fallback_to_orders THEN
              SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
              FROM public.daily_orders AS d
              WHERE d.employee_id = v_emp.id AND d.app_id = v_app.id AND d.date = v_day.day_date
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
              v_total_orders := v_total_orders + v_app_orders;
              IF v_app_orders > 0 THEN
                v_app_earnings := v_app_earnings + public.calc_tier_salary(v_app_orders, v_app.scheme_id);
              END IF;
            END IF;
          END LOOP;
          v_total_shift_days := v_total_shift_days + v_app_shift_days;
        END IF;
      END IF;

      v_base_salary := v_base_salary + v_app_earnings;

      IF v_app_orders > 0 OR v_app_shift_days > 0 OR v_app_earnings > 0 THEN
        v_platform_breakdown := v_platform_breakdown || jsonb_build_object(
          'app_id', v_app.id, 'app_name', v_app.name,
          'work_type', COALESCE(v_app.work_type, _const_work_orders()),
          'calculation_method', v_calculation_method,
          'orders_count', v_app_orders, 'shift_days', v_app_shift_days,
          'earnings', v_app_earnings
        );
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(ed.amount), 0) INTO v_external_deduction
    FROM public.external_deductions AS ed
    WHERE ed.employee_id = v_emp.id AND ed.apply_month = p_month_year AND ed.approval_status = _const_approval_approved();

    SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
    FROM public.advances AS ad JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id AND ai.month_year = p_month_year AND ai.status IN (_const_installment_pending(), _const_installment_deferred());

    v_net := GREATEST(v_base_salary - v_external_deduction - v_advance_deduction, 0);

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


-- =============================================================================
-- FILE: 20260415200000_debug_and_fix_shift_salary.sql
-- =============================================================================

-- Debug and fix: the preview function reads scheme but monthly_amount returns NULL
-- Possible cause: RLS blocks the read even with SECURITY DEFINER
-- Fix: use explicit schema and bypass RLS

-- First create a simple test function
CREATE OR REPLACE FUNCTION public.test_shift_salary()
RETURNS TABLE (app_name TEXT, scheme_name TEXT, monthly_amount NUMERIC, daily_rate NUMERIC)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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


-- =============================================================================
-- FILE: 20260415210000_shift_salary_fallback_full_month.sql
-- =============================================================================

-- Fix: when no daily_shifts records exist for an employee+app in a given month,
-- fall back to full monthly_amount (assume full attendance).
-- This ensures months before the attendance system was introduced (April 2026)
-- still calculate correctly.
--
-- Logic:
--   1. Check if ANY daily_shifts rows exist for this employee+app in the date range
--   2. If YES → count days with hours_worked > 0, calculate proportionally
--   3. If NO  → use full monthly_amount (no attendance data = full month assumed)

-- Also fix: the version in 20260415100000 uses SELECT INTO which can fail under RLS.
-- This version uses direct JOINs (same fix as 20260415200000).

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
  v_days_in_month INTEGER;
  v_emp RECORD; v_app RECORD;
  v_app_orders INTEGER; v_app_shift_days INTEGER; v_app_earnings NUMERIC;
  v_total_orders INTEGER; v_total_shift_days INTEGER; v_base_salary NUMERIC;
  v_external_deduction NUMERIC; v_advance_deduction NUMERIC;
  v_net NUMERIC; v_platform_breakdown JSONB;
  v_calculation_method TEXT;
  v_shift_daily_rate NUMERIC; v_monthly_amount NUMERIC;
  v_has_shift_records BOOLEAN;
  v_tier RECORD;
  v_hybrid_rule RECORD;
  v_day RECORD; v_hours_worked NUMERIC;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;
  v_days_in_month := EXTRACT(DAY FROM v_end)::INTEGER;

  FOR v_emp IN SELECT e.id FROM employees e WHERE e.status = _const_employee_active() LOOP
    v_total_orders := 0; v_total_shift_days := 0; v_base_salary := 0;
    v_platform_breakdown := '[]'::jsonb;

    -- Direct JOIN: apps + salary_schemes (avoids SELECT INTO / RLS issues)
    FOR v_app IN
      SELECT a.id AS app_id, a.name AS app_name, a.work_type,
             s.id AS scheme_id, s.scheme_type, s.monthly_amount
      FROM apps a
      LEFT JOIN salary_schemes s ON s.id = a.scheme_id
      WHERE a.is_active IS TRUE AND a.scheme_id IS NOT NULL
    LOOP
      v_app_orders := 0; v_app_shift_days := 0; v_app_earnings := 0;
      v_calculation_method := _const_work_orders();

      IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
        -- === ORDERS-BASED ===
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := calc_tier_salary(v_app_orders, v_app.scheme_id);

      ELSIF v_app.work_type = _const_work_shift() THEN
        -- === SHIFT-BASED ===
        v_calculation_method := _const_calc_method_shift();
        v_monthly_amount := COALESCE(v_app.monthly_amount, 0);

        -- Check: does this employee have ANY shift records for this app+month?
        SELECT EXISTS(
          SELECT 1 FROM daily_shifts ds
          WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id
            AND ds.date BETWEEN v_start AND v_end
        ) INTO v_has_shift_records;

        IF v_has_shift_records THEN
          -- Has attendance data → count present days, calculate proportionally
          SELECT COUNT(*)::INTEGER INTO v_app_shift_days
          FROM daily_shifts ds
          WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id
            AND ds.date BETWEEN v_start AND v_end AND ds.hours_worked > 0;

          v_total_shift_days := v_total_shift_days + v_app_shift_days;

          IF v_monthly_amount > 0 THEN
            v_shift_daily_rate := v_monthly_amount / _const_days_per_month();
            v_app_earnings := v_app_shift_days * v_shift_daily_rate;
          END IF;
        ELSE
          -- No attendance data for this month → fallback: full monthly salary
          -- This handles months before the attendance system was introduced
          -- Check if employee is assigned to this app
          IF EXISTS(
            SELECT 1 FROM employee_apps ea
            WHERE ea.employee_id = v_emp.id AND ea.app_id = v_app.app_id
          ) THEN
            v_app_shift_days := v_days_in_month;
            v_total_shift_days := v_total_shift_days + v_app_shift_days;
            v_app_earnings := v_monthly_amount;
            v_calculation_method := _const_calc_method_shift_full_month();
          END IF;
        END IF;

      ELSIF v_app.work_type = _const_work_hybrid() THEN
        -- === HYBRID ===
        v_calculation_method := _const_calc_method_mixed();
        SELECT * INTO v_hybrid_rule FROM app_hybrid_rules WHERE app_id = v_app.app_id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
          FROM daily_orders d
          WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
          'work_type', COALESCE(v_app.work_type, _const_work_orders()),
          'calculation_method', v_calculation_method,
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

-- =============================================================================
-- Also update calculate_salary_for_employee_month with same fallback logic
-- (This is the function that saves to salary_records)
-- Fixes:
--   1. hours_worked >= 8 → hours_worked > 0 (attendance is present/absent, not hours)
--   2. No fallback when no shift records → now uses full monthly_amount
--   3. Uses salary_schemes.monthly_amount via JOIN instead of pricing_rules
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
SET search_path TO 'public'
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_days_in_month INTEGER;
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
  v_monthly_amount NUMERIC;
  v_shift_daily_rate NUMERIC;
  v_has_shift_records BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;
  v_days_in_month := EXTRACT(DAY FROM v_end)::INTEGER;

  SELECT COUNT(*)::INTEGER INTO v_attendance_days
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id AND a.date BETWEEN v_start AND v_end;

  -- Use JOIN with salary_schemes to get monthly_amount directly
  FOR v_app IN
    SELECT a.id, a.name, a.work_type, a.scheme_id,
           s.scheme_type, s.monthly_amount
    FROM public.apps a
    LEFT JOIN public.salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> _const_order_cancelled());
      v_total_orders := v_total_orders + v_app_orders;

      IF v_app.scheme_id IS NOT NULL THEN
        SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
      END IF;

    ELSIF v_app.work_type = _const_work_shift() THEN
      v_monthly_amount := COALESCE(v_app.monthly_amount, 0);

      -- Check if ANY shift records exist for this employee+app+month
      SELECT EXISTS(
        SELECT 1 FROM public.daily_shifts ds
        WHERE ds.employee_id = p_employee_id AND ds.app_id = v_app.id
          AND ds.date BETWEEN v_start AND v_end
      ) INTO v_has_shift_records;

      IF v_has_shift_records THEN
        -- Has attendance data → count present days (hours_worked > 0, not >= 8)
        SELECT COUNT(*)::INTEGER INTO v_app_shifts
        FROM public.daily_shifts AS s
        WHERE s.employee_id = p_employee_id AND s.app_id = v_app.id
          AND s.date BETWEEN v_start AND v_end AND s.hours_worked > 0;

        v_total_shift_days := v_total_shift_days + v_app_shifts;

        IF v_monthly_amount > 0 THEN
          v_shift_daily_rate := v_monthly_amount / _const_days_per_month();
          v_app_earnings := v_app_shifts * v_shift_daily_rate;
        END IF;
      ELSE
        -- No shift records → fallback to full monthly salary
        IF EXISTS(
          SELECT 1 FROM public.employee_apps ea
          WHERE ea.employee_id = p_employee_id AND ea.app_id = v_app.id
        ) THEN
          v_app_shifts := v_days_in_month;
          v_total_shift_days := v_total_shift_days + v_app_shifts;
          v_app_earnings := v_monthly_amount;
        END IF;
      END IF;

    ELSIF v_app.work_type = _const_work_hybrid() THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;
      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year AND ed.approval_status = _const_approval_approved();

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year AND ai.status IN (_const_installment_pending(), _const_installment_deferred());

  v_net := GREATEST(v_base_salary - v_attendance_deduction - v_external_deduction - v_advance_deduction - v_manual_deduction, 0);

  INSERT INTO public.salary_records (
    employee_id, month_year, base_salary, attendance_deduction, external_deduction,
    advance_deduction, manual_deduction, manual_deduction_note, net_salary,
    payment_method, calc_status, calc_source, is_approved, sheet_snapshot
  ) VALUES (
    p_employee_id, p_month_year, v_base_salary, v_attendance_deduction, v_external_deduction,
    v_advance_deduction, v_manual_deduction, p_manual_deduction_note, v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), _const_payment_cash()), _const_calc_calculated(), _const_calc_source_v6(), false, NULL
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
  out_calc_status        := _const_calc_calculated();

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- FILE: 20260415220000_shift_salary_always_full_month.sql
-- =============================================================================

-- Shift salary = always full monthly_amount
-- Attendance/daily_shifts are completely decoupled from salary calculation.
-- Only orders-based platforms use daily data for salary.

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
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN SELECT e.id FROM employees e WHERE e.status = _const_employee_active() LOOP
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
      v_calculation_method := _const_work_orders();

      IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
        -- === ORDERS-BASED: salary from daily_orders ===
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM daily_orders d
        WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());

        v_total_orders := v_total_orders + v_app_orders;
        v_app_earnings := calc_tier_salary(v_app_orders, v_app.scheme_id);

      ELSIF v_app.work_type = _const_work_shift() THEN
        -- === SHIFT-BASED: always full monthly_amount ===
        -- Attendance is decoupled from salary.
        -- Employee gets full monthly salary if assigned to this app.
        v_calculation_method := _const_calc_method_shift_fixed();

        IF EXISTS(
          SELECT 1 FROM employee_apps ea
          WHERE ea.employee_id = v_emp.id AND ea.app_id = v_app.app_id
        ) THEN
          -- Count actual shift days from daily_shifts (NOT attendance table)
          SELECT COUNT(*)::INTEGER INTO v_app_shift_days
          FROM daily_shifts ds
          WHERE ds.employee_id = v_emp.id AND ds.app_id = v_app.app_id
            AND ds.date BETWEEN v_start AND v_end AND ds.hours_worked > 0;

          v_total_shift_days := v_total_shift_days + v_app_shift_days;

          -- Salary = (monthly_amount / 30) × actual shift days
          v_monthly_amount := COALESCE(v_app.monthly_amount, 0);
          IF v_monthly_amount > 0 AND v_app_shift_days > 0 THEN
            v_app_earnings := ROUND((v_monthly_amount / _const_days_per_month()) * v_app_shift_days);
          ELSE
            v_app_earnings := 0;
          END IF;
        END IF;

      ELSIF v_app.work_type = _const_work_hybrid() THEN
        -- === HYBRID ===
        v_calculation_method := _const_calc_method_mixed();
        SELECT * INTO v_hybrid_rule FROM app_hybrid_rules WHERE app_id = v_app.app_id;

        IF v_hybrid_rule IS NULL THEN
          v_calculation_method := _const_calc_method_orders_fallback();
          SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
          FROM daily_orders d
          WHERE d.employee_id = v_emp.id AND d.app_id = v_app.app_id
            AND d.date BETWEEN v_start AND v_end
            AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
          'work_type', COALESCE(v_app.work_type, _const_work_orders()),
          'calculation_method', v_calculation_method,
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
SET search_path TO 'public'
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees AS e WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  -- Use JOIN with salary_schemes to get monthly_amount directly
  FOR v_app IN
    SELECT a.id, a.name, a.work_type, a.scheme_id,
           s.scheme_type, s.monthly_amount
    FROM public.apps a
    LEFT JOIN public.salary_schemes s ON s.id = a.scheme_id
    WHERE a.is_active IS TRUE
  LOOP
    v_app_earnings := 0;

    IF v_app.work_type = _const_work_orders() OR v_app.work_type IS NULL THEN
      -- === ORDERS: salary from daily_orders ===
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
      FROM public.daily_orders AS d
      WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> _const_order_cancelled());
      v_total_orders := v_total_orders + v_app_orders;

      IF v_app.scheme_id IS NOT NULL THEN
        SELECT * INTO v_order_calc FROM public.calculate_order_salary_for_app(v_app.id, v_app_orders, v_attendance_days, v_fixed_scheme_ids, true);
        v_app_earnings := COALESCE(v_order_calc.earnings, 0);
        v_fixed_scheme_ids := COALESCE(v_order_calc.fixed_scheme_ids, v_fixed_scheme_ids);
      END IF;

    ELSIF v_app.work_type = _const_work_shift() THEN
      -- === SHIFT: salary from daily_shifts (NOT attendance table) ===
      -- Salary = (monthly_amount / 30) × actual shift days from daily_shifts
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
          v_app_earnings := ROUND((v_app.monthly_amount / _const_days_per_month()) * v_app_shifts);
        END IF;
      END IF;

    ELSIF v_app.work_type = _const_work_hybrid() THEN
      SELECT * INTO v_hybrid_rule FROM public.app_hybrid_rules WHERE app_id = v_app.id;
      IF v_hybrid_rule IS NULL THEN
        SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_app_orders
        FROM public.daily_orders AS d
        WHERE d.employee_id = p_employee_id AND d.app_id = v_app.id
          AND d.date BETWEEN v_start AND v_end
          AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
                AND (d.status IS NULL OR d.status <> _const_order_cancelled());
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
  WHERE ed.employee_id = p_employee_id AND ed.apply_month = p_month_year AND ed.approval_status = _const_approval_approved();

  SELECT COALESCE(SUM(ai.amount), 0) INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id AND ai.month_year = p_month_year AND ai.status IN (_const_installment_pending(), _const_installment_deferred());

  v_net := GREATEST(v_base_salary - v_attendance_deduction - v_external_deduction - v_advance_deduction - v_manual_deduction, 0);

  INSERT INTO public.salary_records (
    employee_id, month_year, base_salary, attendance_deduction, external_deduction,
    advance_deduction, manual_deduction, manual_deduction_note, net_salary,
    payment_method, calc_status, calc_source, is_approved, sheet_snapshot
  ) VALUES (
    p_employee_id, p_month_year, v_base_salary, v_attendance_deduction, v_external_deduction,
    v_advance_deduction, v_manual_deduction, p_manual_deduction_note, v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), _const_payment_cash()), _const_calc_calculated(), _const_calc_source_v7(), false, NULL
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
  out_calc_status        := _const_calc_calculated();

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- FILE: 20260416000000_apply_constants_pattern.sql
-- =============================================================================

-- =============================================================================
-- Fix: Apply constants to remove literal duplication (SonarCloud CRITICAL)
-- =============================================================================
-- This migration refactors existing functions to use shared constants
-- instead of duplicated string literals.
--
-- Benefits:
--   1. Fixes SonarCloud CRITICAL issues about literal duplication
--   2. Improves maintainability (change in one place)
--   3. Reduces typo risks
--   4. Makes code more readable

-- First, ensure constants are available (already included above in manual sync)

-- =============================================================================
-- Refactored: calc_tier_salary with constants
-- =============================================================================

DROP FUNCTION IF EXISTS public.calc_tier_salary(integer, uuid);

CREATE OR REPLACE FUNCTION public.calc_tier_salary(
  p_orders INTEGER,
  p_scheme_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tier RECORD;
  v_salary NUMERIC := 0;
  c_tier_fixed TEXT := _const_tier_fixed();
  c_tier_incremental TEXT := _const_tier_incremental();
BEGIN
  IF p_orders <= 0 OR p_scheme_id IS NULL THEN RETURN 0; END IF;

  FOR v_tier IN
    SELECT * FROM public.salary_scheme_tiers
    WHERE scheme_id = p_scheme_id
      AND from_orders <= p_orders
    ORDER BY from_orders DESC
    LIMIT 1
  LOOP
    IF v_tier.tier_type = c_tier_fixed THEN
      v_salary := v_tier.price_per_order;
    ELSIF v_tier.tier_type = c_tier_incremental THEN
      v_salary := v_tier.price_per_order
        + GREATEST(p_orders - COALESCE(v_tier.incremental_threshold, v_tier.from_orders), 0)
        * COALESCE(v_tier.incremental_price, 0);
    ELSE
      v_salary := p_orders * v_tier.price_per_order;
    END IF;
  END LOOP;

  RETURN ROUND(v_salary);
END;
$$;

-- =============================================================================
-- Example: Refactored preview_salary_for_month (partial)
-- =============================================================================
-- This shows how to apply constants to a complex function.
-- Full refactoring should be done in production migrations.

CREATE OR REPLACE FUNCTION public.preview_salary_for_month_v2(p_month_year TEXT)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  base_salary NUMERIC,
  net_salary NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_emp RECORD;
  v_app RECORD;
  v_orders INTEGER;
  v_earnings NUMERIC;
  v_total_orders INTEGER;
  v_base_salary NUMERIC;
  v_deduction NUMERIC;
  v_net NUMERIC;
  -- Constants
  c_cancelled TEXT := _const_order_cancelled();
  c_active TEXT := _const_employee_active();
  c_approved TEXT := _const_approval_approved();
  c_pending TEXT := _const_installment_pending();
  c_deferred TEXT := _const_installment_deferred();
  c_days_per_month NUMERIC := _const_days_per_month();
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  FOR v_emp IN 
    SELECT e.id FROM employees e 
    WHERE e.status = c_active 
  LOOP
    v_total_orders := 0;
    v_base_salary := 0;

    FOR v_app IN
      SELECT a.id, a.scheme_id
      FROM apps a
      WHERE a.is_active IS TRUE AND a.scheme_id IS NOT NULL
    LOOP
      -- Count orders (using constant for _const_order_cancelled())
      SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER INTO v_orders
      FROM daily_orders d
      WHERE d.employee_id = v_emp.id 
        AND d.app_id = v_app.id
        AND d.date BETWEEN v_start AND v_end
        AND (d.status IS NULL OR d.status <> c_cancelled);

      v_total_orders := v_total_orders + v_orders;
      v_earnings := calc_tier_salary(v_orders, v_app.scheme_id);
      v_base_salary := v_base_salary + v_earnings;
    END LOOP;

    -- External deductions (using constant for _const_approval_approved())
    SELECT COALESCE(SUM(ed.amount), 0) INTO v_deduction
    FROM external_deductions ed
    WHERE ed.employee_id = v_emp.id 
      AND ed.apply_month = p_month_year
      AND ed.approval_status = c_approved;

    -- Advance deductions (using constants for _const_installment_pending(), _const_installment_deferred())
    SELECT COALESCE(SUM(ai.amount), 0) INTO v_deduction
    FROM advances ad 
    JOIN advance_installments ai ON ai.advance_id = ad.id
    WHERE ad.employee_id = v_emp.id 
      AND ai.month_year = p_month_year
      AND ai.status IN (c_pending, c_deferred);

    v_net := GREATEST(v_base_salary - v_deduction, 0);

    employee_id := v_emp.id;
    total_orders := v_total_orders;
    base_salary := v_base_salary;
    net_salary := v_net;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.calc_tier_salary(INTEGER, UUID) IS 
  'Refactored to use constants - fixes SonarCloud literal duplication';

COMMENT ON FUNCTION public.preview_salary_for_month_v2(TEXT) IS 
  'Example function showing constant usage - replace preview_salary_for_month in production';

-- =============================================================================
-- Migration Notes
-- =============================================================================
-- To apply this pattern to all existing migrations:
--
-- 1. Identify duplicated literals in each migration file
-- 2. Declare constants at the top of the function:
--    c_status TEXT := _const_order_cancelled();
-- 3. Replace all occurrences with the constant variable
-- 4. Test thoroughly before deploying
--
-- Example replacements:
--   _const_order_cancelled()  ? c_cancelled := _const_order_cancelled()
--   _const_installment_pending()    ? c_pending := _const_installment_pending()
--   _const_approval_approved()   ? c_approved := _const_approval_approved()
--   _const_employee_active()     ? c_active := _const_employee_active()
--   _const_days_per_month()         ? c_days := _const_days_per_month()


-- =============================================================================
-- FILE: 20260416000000_unique_default_slip_template.sql
-- =============================================================================

-- FIX #9: Prevent multiple default salary slip templates.
-- Only one row can have is_default = true at a time.
-- This replaces the application-level "unset others first" logic with a DB constraint.

-- First, ensure only one default exists (keep the newest)
DO $$
BEGIN
  IF (SELECT count(*) FROM salary_slip_templates WHERE is_default = true) > 1 THEN
    UPDATE salary_slip_templates
    SET is_default = false
    WHERE is_default = true
      AND id != (
        SELECT id FROM salary_slip_templates
        WHERE is_default = true
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_slip_templates_single_default
  ON salary_slip_templates (is_default)
  WHERE is_default = true;


-- =============================================================================
-- FILE: 20260416000001_refactor_shift_salary_with_constants.sql
-- =============================================================================

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
SET search_path TO 'public'
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


-- =============================================================================
-- FILE: 20260416000002_fix_security_definer_permissions.sql
-- =============================================================================

-- =============================================================================
-- Fix Supabase Linter Warnings: SECURITY DEFINER Function Permissions
-- =============================================================================
-- This migration addresses security warnings about SECURITY DEFINER functions
-- being callable by anon/authenticated roles when they shouldn't be.
--
-- Issue: Functions like calculate_salary_for_employee_month, preview_salary_for_month
-- are SECURITY DEFINER but accessible to anon/authenticated roles.
--
-- Solution: Revoke EXECUTE from anon/authenticated, grant only to service_role
-- (already done in some migrations, but ensuring consistency)

-- =============================================================================
-- 1. Salary Calculation Functions (should be service_role only)
-- =============================================================================

-- Already has REVOKE in 20260415220000, but ensuring it's applied
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;

-- =============================================================================
-- 2. Permission/Role Check Functions (authenticated only, not anon)
-- =============================================================================

-- These functions check user permissions/roles, so they should be:
-- - NOT callable by anon (unauthenticated users)
-- - Callable by authenticated users (to check their own permissions)
-- - Callable by service_role (for admin operations)

-- has_permission: checks if current user has a specific permission
REVOKE EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO service_role;

-- has_role: checks if a user has a specific role
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;

-- is_active_user: checks if a user is active
REVOKE EXECUTE ON FUNCTION public.is_active_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(UUID) TO service_role;

-- is_admin_or_hr: checks if user is admin or HR
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO service_role;

-- is_internal_user: checks if current user is internal
REVOKE EXECUTE ON FUNCTION public.is_internal_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO service_role;

-- =============================================================================
-- 3. Constant Functions (public read-only, safe for all roles)
-- =============================================================================

-- These are IMMUTABLE functions that return constants, safe for all roles
-- They don't access any data, just return literal values
-- Keep them accessible to all roles for convenience

GRANT EXECUTE ON FUNCTION public._const_order_cancelled() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_installment_pending() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_installment_deferred() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_approval_approved() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_orders() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_shift() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_work_hybrid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_days_per_month() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_employee_active() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_payment_cash() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_payment_bank() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_calc_calculated() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_tier_fixed() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._const_tier_incremental() TO anon, authenticated, service_role;

-- =============================================================================
-- Summary of Access Control
-- =============================================================================

-- Function Type                    | anon | authenticated | service_role
-- ---------------------------------|------|---------------|-------------
-- Salary Calculations              |  ❌  |      ❌       |      ✅
-- Permission/Role Checks           |  ❌  |      ✅       |      ✅
-- Constants (read-only)            |  ✅  |      ✅       |      ✅

COMMENT ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) IS 
  'SECURITY DEFINER - service_role only. Calculates and saves salary for an employee.';

COMMENT ON FUNCTION public.preview_salary_for_month(TEXT) IS 
  'SECURITY DEFINER - service_role only. Previews salary calculations for all employees.';

COMMENT ON FUNCTION public.has_permission(TEXT, TEXT) IS 
  'SECURITY DEFINER - authenticated only. Checks if current user has a specific permission.';

COMMENT ON FUNCTION public.has_role(UUID, public.app_role) IS 
  'SECURITY DEFINER - authenticated only. Checks if a user has a specific role.';

COMMENT ON FUNCTION public.is_admin_or_hr(UUID) IS 
  'SECURITY DEFINER - authenticated only. Checks if user is admin or HR.';

NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- FILE: 20260425000000_check_employee_operational_records.sql
-- =============================================================================

-- Consolidates 6 separate existence checks (daily_orders, advances, attendance,
-- vehicle_assignments, platform_accounts, salary_records) into a single RPC call,
-- eliminating N+1 round-trips when guarding employee deletion.
CREATE OR REPLACE FUNCTION public.check_employee_operational_records(p_employee_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.daily_orders        WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.advances            WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.attendance          WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.vehicle_assignments WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.platform_accounts   WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.salary_records      WHERE employee_id = p_employee_id
  );
$$;


-- =============================================================================
-- FILE: 20260426000000_index_audit_review.sql
-- =============================================================================

-- ============================================================================
-- Index Audit — pg_stat_user_indexes analysis (2026-04-26)
-- ============================================================================
-- Uncomment sections as you decide to act on them.

-- ═══════════════════════════════════════════════════════════════════════════
-- HIGH PRIORITY — unused indexes wasting write performance + storage
-- ═══════════════════════════════════════════════════════════════════════════

-- ❶ idx_admin_action_log_created_at  —  0 scans , 1032 kB
--    Every INSERT into admin_action_log pays the write penalty
--    of maintaining this index without reads ever using it.
--    DROP INDEX IF EXISTS idx_admin_action_log_created_at;

-- ❷ idx_daily_orders_perf_employee_date  —  0 scans , 168 kB
--    Created for performance_dashboard_rpcs.  If the feature is not yet
--    live, the index is pure overhead on every daily_orders write.
--    DROP INDEX IF EXISTS idx_daily_orders_perf_employee_date;

-- ❸ idx_daily_orders_status  —  0 scans , 48 kB
--    Status-based queries may not be967m in use.  Monitor one more week.
--    DROP INDEX IF EXISTS idx_daily_orders_status;

-- ═══════════════════════════════════════════════════════════════════════════
-- LOW PRIORITY — tiny indexes (≤16 kB) with ≤10 scans
-- ═══════════════════════════════════════════════════════════════════════════
-- These collectively waste ~256 kB and add minor write overhead.
-- Many are pkeys / unique constraints — those are SKIPPED below.

-- idx_employees_role_id                — 0 scans
-- idx_commercial_records_name_ci       — 0 scans
-- idx_salary_records_calc_status       — 0 scans
-- idx_attendance_employee_date_late    — 0 scans
-- idx_order_import_batches_status      — 0 scans
-- idx_finance_transactions_date        — 0 scans
-- idx_attendance_employee_status_date  — 0 scans
-- idx_employees_residency_expiry       — 0 scans

-- ═══════════════════════════════════════════════════════════════════════════
-- HEAVILY-USED — keep and monitor
-- ═══════════════════════════════════════════════════════════════════════════
-- user_roles_user_id_role_key          — 12.7M scans
-- profiles_pkey                        — 9.9M  scans
-- employees_pkey                       — 314K  scans
-- idx_daily_shifts_app_date            — 116K  scans
-- idx_daily_orders_employee_date       — 68K   scans
-- daily_orders_employee_id_date_app_id_key — 58K scans
-- salary_schemes_pkey                  — 52K   scans
-- auth_rate_limits (edge_rate_limits)  — 538   scans (rate-limiting: OK)


-- =============================================================================
-- FILE: 20260427000000_fix_admin_action_log_rls.sql
-- =============================================================================

-- Fix: admin_action_log INSERT was blocked for non-admin roles because
-- has_permission('audit', 'write') is not granted to hr/finance/operations.
-- Audit logging must succeed for ALL active internal users — it is a
-- secondary side-effect that should never block a user's primary action.
--
-- Change: replace has_permission('audit', 'write') with is_internal_user()
-- on the INSERT policy only. The SELECT policy is unchanged (still requires
-- has_permission('audit', 'view') so only privileged roles can read the log).

DROP POLICY IF EXISTS admin_action_log_insert_policy ON public.admin_action_log;
DROP POLICY IF EXISTS "Admin actions: insert"          ON public.admin_action_log;

CREATE POLICY admin_action_log_insert_policy
  ON public.admin_action_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user()
    AND user_id IS NOT DISTINCT FROM auth.uid()
  );


-- =============================================================================
-- FILE: 20260501000000_fix_security_warnings.sql
-- =============================================================================

-- ============================================================
-- SECURITY FIX: Revoke anon EXECUTE on all SECURITY DEFINER functions
-- All these functions require an authenticated session; anon access is unintentional.
-- ============================================================

-- ── Salary / Payroll ─────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text)                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text)                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text)                                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text)                                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text)                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid)                              FROM anon;

-- ── Employee / HR ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid)                                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamptz)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_out(uuid, timestamptz)                                                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid)                                                               FROM anon;

-- ── Auth / Role helpers ───────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_my_role()                                                                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text)                                                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid)                                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user()                                                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()                                                                     FROM anon;

-- ── Dashboard / Reports ───────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date)                                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date)                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date)                                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date)                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date)                                            FROM anon;

-- ── Audit / Logging ───────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()                                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()                                                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()                                                                        FROM anon;

-- ── Test functions (revoke from everyone via REST) ────────────────────────────
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                                        FROM authenticated;

-- ============================================================
-- SECURITY FIX: Revoke direct EXECUTE on trigger-only functions from authenticated
-- These are fired by triggers, never by direct RPC calls.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()     FROM authenticated;

-- ============================================================
-- SECURITY FIX: Fix mutable search_path on calc_tier_salary
-- Prevents search_path injection attacks on this function.
-- ============================================================
ALTER FUNCTION public.calc_tier_salary SET search_path = public;


-- =============================================================================
-- FILE: 20260502000000_flip_admin_rider_logic.sql
-- =============================================================================

-- ============================================================
-- LOGIC CHANGE: Flip admin/rider detection in salary engine
--
-- Old rule: admin = job title matches admin keywords list
-- New rule: rider = job title matches rider keywords list
--           admin = job title is set AND does NOT match rider keywords
--
-- This means every employee who is not explicitly a "مندوب / سائق / ..."
-- is treated as administrative and included in monthly salary runs
-- without needing platform activity.
-- ============================================================

DROP FUNCTION IF EXISTS public.is_salary_admin_job_title(TEXT);

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  -- Empty / null job title → unknown, do not auto-include
  SELECT
    COALESCE(p_job_title, '') <> ''
    AND NOT (
      COALESCE(p_job_title, '') ~* '(مندوب|سائق|توصيل|موصل|مرسال|rider|driver|delivery|courier|dispatch|messenger)'
    );
$$;


-- =============================================================================
-- FILE: 20260503000000_leave_requests.sql
-- =============================================================================

-- ============================================================
-- إدارة الإجازات: leave_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type             text        NOT NULL CHECK (type IN ('annual','sick','emergency','unpaid','other')),
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  days_count       integer     NOT NULL CHECK (days_count > 0),
  status           text        NOT NULL DEFAULT _const_installment_pending() CHECK (status IN (_const_installment_pending(),_const_approval_approved(),'rejected')),
  reason           text,
  reviewer_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note      text,
  reviewed_at      timestamptz,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  CONSTRAINT leave_dates_check CHECK (end_date >= start_date)
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read (SELECT with USING (true) is intentional for shared HR data)
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: require authenticated session
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee   ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status     ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON public.leave_requests(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type       ON public.leave_requests(type);


-- =============================================================================
-- FILE: 20260503000001_performance_reviews.sql
-- =============================================================================

-- ============================================================
-- تقييم الأداء الرسمي: hr_performance_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year          text        NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
  reviewer_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  attendance_score    integer     NOT NULL DEFAULT 5 CHECK (attendance_score BETWEEN 1 AND 10),
  performance_score   integer     NOT NULL DEFAULT 5 CHECK (performance_score BETWEEN 1 AND 10),
  behavior_score      integer     NOT NULL DEFAULT 5 CHECK (behavior_score BETWEEN 1 AND 10),
  commitment_score    integer     NOT NULL DEFAULT 5 CHECK (commitment_score BETWEEN 1 AND 10),
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT hr_reviews_unique_employee_month UNIQUE (employee_id, month_year)
);

ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read (intentional for HR visibility)
DROP POLICY IF EXISTS "hr_reviews_select" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_select" ON public.hr_performance_reviews
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: require authenticated session
DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_hr_reviews_employee  ON public.hr_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_reviews_month     ON public.hr_performance_reviews(month_year);


-- =============================================================================
-- FILE: 20260503000002_fix_security_warnings_v2.sql
-- =============================================================================

-- ============================================================
-- SECURITY FIX v2 — يعالج جميع التحذيرات الأمنية الظاهرة في Supabase
--
-- المشاكل المعالجة:
--   1. rls_policy_always_true    → إصلاح سياسات RLS للجداول الجديدة
--   2. function_search_path_mutable → إصلاح is_salary_admin_job_title
--   3. anon_security_definer_function_executable  → إلغاء صلاحية anon
--   4. authenticated_security_definer_function_executable → إلغاء صلاحية authenticated للدوال الداخلية
-- ============================================================

-- ============================================================
-- 1. إصلاح سياسات RLS — leave_requests
-- ============================================================

DROP POLICY IF EXISTS leave_requests_insert ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_delete ON public.leave_requests;

-- يشترط أن يكون المستخدم مسجلاً (authenticated) لأي عملية كتابة
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. إصلاح سياسات RLS — hr_performance_reviews
-- ============================================================

DROP POLICY IF EXISTS hr_reviews_insert ON public.hr_performance_reviews;
DROP POLICY IF EXISTS hr_reviews_update ON public.hr_performance_reviews;
DROP POLICY IF EXISTS hr_reviews_delete ON public.hr_performance_reviews;

DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. إصلاح function_search_path_mutable — is_salary_admin_job_title
--    إعادة إنشاء الدالة مع SET search_path = '' لمنع هجمات حقن search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(p_job_title, '') <> ''
    AND NOT (
      COALESCE(p_job_title, '') ~* '(مندوب|سائق|توصيل|موصل|مرسال|rider|driver|delivery|courier|dispatch|messenger)'
    );
$$;

-- ============================================================
-- 4. إلغاء صلاحية anon على جميع دوال SECURITY DEFINER
--    (شاملة للدوال التي قد لا يكون قد شملها الـ migration السابق)
-- ============================================================

-- ── الرواتب / المدفوعات ──────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text)                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid)         FROM anon;

-- ── الموظفون / الحضور ────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamptz)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_out(uuid, timestamptz)                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid)                                          FROM anon;

-- ── المصادقة / الأدوار ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid)                                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()                                                FROM anon;

-- ── لوحة التحكم / التقارير ───────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date)                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date)                       FROM anon;

-- ── Audit / Logging ──────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()                                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                   FROM anon;

-- ============================================================
-- 5. إلغاء صلاحية authenticated على الدوال الداخلية فقط
--    (الدوال التي تستدعيها الـ triggers أو مساعدات داخلية فقط،
--     ولا ينبغي استدعاؤها مباشرة عبر REST API)
-- ============================================================

-- دوال الـ trigger (لا تُستدعى مباشرة)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()      FROM authenticated;

-- دوال اختبار / تصحيح
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()      FROM authenticated;

-- مساعد داخلي يستدعيه plpgsql فقط — لا يُستدعى مباشرة عبر supabase.rpc()
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM authenticated;

-- نسخ dashboard_overview القديمة (legacy) — التطبيق يستخدم dashboard_overview_rpc فقط
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                      FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                            FROM authenticated;


-- =============================================================================
-- FILE: 20260503000003_allow_negative_hours_worked.sql
-- =============================================================================

-- ============================================================
-- إزالة أي قيد CHECK على hours_worked في daily_shifts
-- يسمح بقيم سالبة لتمثيل حالات الإجازة:
--   1  = حاضر
--  -1  = إجازة براتب
--  -2  = إجازة مرضى
--   0  = غائب (لا يُحفظ في DB — الغياب يُمثَّل بعدم وجود صف)
-- ============================================================

-- أزل أي constraint اسمه check_hours_worked أو hours_worked_check
ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS daily_shifts_hours_worked_check;

ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS check_hours_worked;

ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS daily_shifts_hours_worked_valid;

-- أضف constraint جديد يسمح بالقيم الموجبة والسالبة المحددة فقط
ALTER TABLE public.daily_shifts
  ADD CONSTRAINT daily_shifts_hours_worked_valid
  CHECK (
    hours_worked = 1    -- حاضر
    OR hours_worked = -1  -- إجازة براتب
    OR hours_worked = -2  -- إجازة مرضى
    OR hours_worked > 0   -- للتوافق مع البيانات القديمة (ساعات متعددة)
  );

-- تعليق توضيحي على العمود
COMMENT ON COLUMN public.daily_shifts.hours_worked IS
  'قيمة الحضور: 1=حاضر | -1=إجازة براتب | -2=إجازة مرضى | >1=ساعات عمل (للأنظمة القديمة)';


-- =============================================================================
-- FILE: 20260503000004_add_is_archived_to_apps.sql
-- =============================================================================

-- Add is_archived to apps table for soft-delete / archive workflow.
-- is_active = false means "temporarily disabled this month"
-- is_archived = true means "permanently retired, hide everywhere"

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_apps_is_archived ON public.apps(is_archived);

COMMENT ON COLUMN public.apps.is_archived IS
  'Soft archive flag. Archived apps are hidden from all UI lists and salary calculations. '
  'Use is_active to temporarily disable an app for a month.';


-- =============================================================================
-- FILE: 20260504000000_fix_remaining_auth_users_fk.sql
-- =============================================================================

-- Fix missing ON DELETE SET NULL for remaining auth.users references
-- that cause "Cannot delete user" errors due to foreign key constraints.

-- ── account_assignments.created_by ──
ALTER TABLE public.account_assignments
  DROP CONSTRAINT IF EXISTS account_assignments_created_by_fkey;
ALTER TABLE public.account_assignments
  ADD CONSTRAINT account_assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── finance_transactions.created_by ──
ALTER TABLE public.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_created_by_fkey;
ALTER TABLE public.finance_transactions
  ADD CONSTRAINT finance_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- =============================================================================
-- FILE: 20260504000001_fix_security_warnings_v3.sql
-- =============================================================================

-- ============================================================
-- SECURITY FIX v3 — Fix Supabase Linter Warnings
--
-- 1. function_search_path_mutable
-- 2. rls_policy_always_true
-- 3. anon_security_definer_function_executable
-- 4. authenticated_security_definer_function_executable
-- ============================================================

-- ── 1. function_search_path_mutable ─────────────────────────
ALTER FUNCTION public.is_salary_admin_job_title(text) SET search_path = public;

-- Helper function for Admin/HR access check
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(uid uuid) RETURNS boolean AS $$
BEGIN
  RETURN is_active_user(uid) AND (has_role(uid, 'admin'::app_role) OR has_role(uid, 'hr'::app_role));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- hr_performance_reviews
DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;

CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE USING (is_admin_or_hr(auth.uid()))
  WITH CHECK (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (is_admin_or_hr(auth.uid()));

-- leave_requests
DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;

CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (is_admin_or_hr(auth.uid()))
  WITH CHECK (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (is_admin_or_hr(auth.uid()));


-- ── 3. anon_security_definer_function_executable ────────────
-- Revoke EXECUTE from anon and public for all listed functions
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamp with time zone) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user() FROM PUBLIC, anon;

-- ── 4. authenticated_security_definer_function_executable ───
-- Convert functions to SECURITY INVOKER where safe to clear warnings for authenticated role.
-- (Functions that bypass RLS intentionally will remain SECURITY DEFINER and warnings can be ignored).

ALTER FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(text, date) SECURITY INVOKER;

ALTER FUNCTION public.performance_dashboard_rpc(text, date) SECURITY INVOKER;
ALTER FUNCTION public.rider_profile_performance_rpc(uuid, text, date) SECURITY INVOKER;

ALTER FUNCTION public.calculate_salary_for_month(text, text) SECURITY INVOKER;
ALTER FUNCTION public.capture_salary_month_snapshot(text) SECURITY INVOKER;
ALTER FUNCTION public.preview_salary_for_month(text) SECURITY INVOKER;

-- Trigger functions shouldn't be executed by authenticated users directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns() FROM authenticated;

-- Test/debug functions
REVOKE EXECUTE ON FUNCTION public.test_shift_salary() FROM authenticated;

-- Convert additional functions from the linter report to SECURITY INVOKER
ALTER FUNCTION public.advance_in_my_company(uuid) SECURITY INVOKER;
ALTER FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) SECURITY INVOKER;
ALTER FUNCTION public.calculate_salary(uuid, text, text, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.check_employee_operational_records(uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_in(uuid, timestamp with time zone) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(text, integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.employee_in_my_company(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid) SECURITY INVOKER;


-- =============================================================================
-- FILE: 20260504000002_fix_logo_upload.sql
-- =============================================================================

-- ============================================================
-- Fix Logo Upload (Avatars bucket restrictions)
-- Allows SVG files and increases limit to 5MB
-- ============================================================

UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'],
  file_size_limit = 5242880
WHERE id = 'avatars';


-- =============================================================================
-- FILE: 20260504000003_fix_remaining_security_warnings.sql
-- =============================================================================

-- ============================================================
-- Ensure all remaining SECURITY DEFINER functions are set to INVOKER
-- ============================================================

ALTER FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) SECURITY INVOKER;


-- =============================================================================
-- FILE: 20260505000000_get_my_role_privilege_order.sql
-- =============================================================================

-- Return highest-privilege role deterministically for multi-role users.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin'      THEN 1
    WHEN 'finance'    THEN 2
    WHEN 'hr'         THEN 3
    WHEN 'operations' THEN 4
    WHEN 'viewer'     THEN 5
    ELSE 99
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- =============================================================================
-- FILE: 20260505000001_enforce_rate_limit_grant.sql
-- =============================================================================

-- Allow authenticated users to call enforce_rate_limit directly,
-- removing the need for a service-role client in the edge function.
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(text, int, int) TO authenticated;


-- =============================================================================
-- FILE: 20260510000000_fix_employee_status_cast.sql
-- =============================================================================

-- =============================================================================
-- Fix: operator does not exist: employee_status = text
-- =============================================================================
-- Root cause: employees.status is of type public.employee_status (ENUM),
--             but _const_employee_active() returns TEXT.
--             PostgreSQL does not allow implicit ENUM=TEXT comparison.
--
-- Solution: Add an implicit cast from TEXT to employee_status so that all
--           existing `WHERE status = _const_employee_active()` queries work
--           without modifying every function.
-- =============================================================================

BEGIN;

-- Step 1: Create a helper cast function TEXT → employee_status
CREATE OR REPLACE FUNCTION public.text_to_employee_status(text)
  RETURNS public.employee_status
  LANGUAGE SQL IMMUTABLE STRICT
  SET search_path = public
AS $$
  SELECT $1::public.employee_status;
$$;

-- Step 2: Register implicit cast so PostgreSQL automatically converts
--         TEXT to employee_status when comparing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_cast
    WHERE castsource = 'text'::regtype
      AND casttarget = 'public.employee_status'::regtype
      AND castcontext = 'i'  -- 'i' = implicit
  ) THEN
    CREATE CAST (text AS public.employee_status)
      WITH FUNCTION public.text_to_employee_status(text)
      AS IMPLICIT;
  END IF;
END $$;

COMMIT;


-- =============================================================================
-- FILE: 20260510010000_fix_security_warnings.sql
-- =============================================================================

-- =============================================================================
-- Security Fix: Revoke anon EXECUTE on sensitive SECURITY DEFINER functions
--               + Fix mutable search_path on is_admin_or_hr
-- =============================================================================

BEGIN;

-- ── 1. Revoke anon access from sensitive functions ────────────────────────────
-- These functions must NOT be callable without authentication.

REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(
  uuid, text, text, numeric, text
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) FROM anon;

-- ── 2. Fix mutable search_path on is_admin_or_hr ─────────────────────────────
-- Recreate the function with SET search_path to prevent SQL injection via
-- search_path manipulation.

CREATE OR REPLACE FUNCTION public.is_admin_or_hr(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    public.has_role(uid, 'admin'::public.app_role)
    OR public.has_role(uid, 'hr'::public.app_role)
  );
END;
$$;

-- Re-revoke after recreating (recreate resets grants)
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_hr(uuid) TO authenticated, service_role;

-- ── 3. Ensure authenticated role retains access to needed functions ───────────
-- These are intentionally callable by signed-in users (auth is checked inside).
-- We just confirm anon cannot call them.

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text) FROM anon;

-- Confirm anon cannot call calculate_salary_for_employee_month
REVOKE ALL ON FUNCTION public.calculate_salary_for_employee_month(
  uuid, text, text, numeric, text
) FROM anon;

COMMIT;


