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

-- Constants are available from migration 20260415000001_constants.sql
-- (applied before this migration in the sequence)

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
