-- =============================================================================
-- Shared Constants for SQL Migrations
-- =============================================================================
-- This file defines reusable constants to avoid duplication across migrations.
-- Import these in your migration files when needed.

-- Status values
DO $$ BEGIN
  -- Order statuses
  CREATE TEMP TABLE IF NOT EXISTS _order_statuses AS
  SELECT _const_order_cancelled()::TEXT AS cancelled;

  -- Installment statuses
  CREATE TEMP TABLE IF NOT EXISTS _installment_statuses AS
  SELECT 
    _const_installment_pending()::TEXT AS pending,
    _const_installment_deferred()::TEXT AS deferred;

  -- Approval statuses
  CREATE TEMP TABLE IF NOT EXISTS _approval_statuses AS
  SELECT _const_approval_approved()::TEXT AS approved;

  -- Work types
  CREATE TEMP TABLE IF NOT EXISTS _work_types AS
  SELECT
    _const_work_orders()::TEXT AS orders,
    _const_work_shift()::TEXT AS shift,
    _const_work_hybrid()::TEXT AS hybrid;

  -- Calculation methods
  CREATE TEMP TABLE IF NOT EXISTS _calc_methods AS
  SELECT
    _const_work_orders()::TEXT AS orders,
    _const_work_shift()::TEXT AS shift,
    _const_calc_method_shift_fixed()::TEXT AS shift_fixed,
    _const_calc_method_shift_full_month()::TEXT AS shift_full_month,
    _const_calc_method_mixed()::TEXT AS mixed,
    _const_calc_method_orders_fallback()::TEXT AS orders_fallback;

  -- Tier types
  CREATE TEMP TABLE IF NOT EXISTS _tier_types AS
  SELECT
    _const_tier_fixed()::TEXT AS fixed_amount,
    _const_tier_incremental()::TEXT AS base_plus_incremental,
    'per_order'::TEXT AS per_order;

  -- Payment methods
  CREATE TEMP TABLE IF NOT EXISTS _payment_methods AS
  SELECT
    _const_payment_cash()::TEXT AS cash,
    _const_payment_bank()::TEXT AS bank;

  -- Calculation statuses
  CREATE TEMP TABLE IF NOT EXISTS _calc_statuses AS
  SELECT _const_calc_calculated()::TEXT AS calculated;

  -- Calculation sources
  CREATE TEMP TABLE IF NOT EXISTS _calc_sources AS
  SELECT
    _const_calc_source_v6()::TEXT AS v6_shift_fallback,
    _const_calc_source_v7()::TEXT AS v7_shift_fixed;

  -- Employee statuses
  CREATE TEMP TABLE IF NOT EXISTS _employee_statuses AS
  SELECT _const_employee_active()::TEXT AS active;

  -- Numeric constants
  CREATE TEMP TABLE IF NOT EXISTS _numeric_constants AS
  SELECT
    _const_days_per_month()::NUMERIC AS days_per_month,
    0::NUMERIC AS zero;

END $$;

-- =============================================================================
-- Helper Functions for Constants
-- =============================================================================

-- Get order status: cancelled
CREATE OR REPLACE FUNCTION _const_order_cancelled() RETURNS TEXT AS $$
  SELECT _const_order_cancelled()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get installment statuses: pending, deferred
CREATE OR REPLACE FUNCTION _const_installment_pending() RETURNS TEXT AS $$
  SELECT _const_installment_pending()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_installment_deferred() RETURNS TEXT AS $$
  SELECT _const_installment_deferred()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get approval status: approved
CREATE OR REPLACE FUNCTION _const_approval_approved() RETURNS TEXT AS $$
  SELECT _const_approval_approved()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get work types
CREATE OR REPLACE FUNCTION _const_work_orders() RETURNS TEXT AS $$
  SELECT _const_work_orders()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_work_shift() RETURNS TEXT AS $$
  SELECT _const_work_shift()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_work_hybrid() RETURNS TEXT AS $$
  SELECT _const_work_hybrid()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get days per month constant
CREATE OR REPLACE FUNCTION _const_days_per_month() RETURNS NUMERIC AS $$
  SELECT _const_days_per_month()::NUMERIC;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get employee status: active
CREATE OR REPLACE FUNCTION _const_employee_active() RETURNS TEXT AS $$
  SELECT _const_employee_active()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get payment methods
CREATE OR REPLACE FUNCTION _const_payment_cash() RETURNS TEXT AS $$
  SELECT _const_payment_cash()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_payment_bank() RETURNS TEXT AS $$
  SELECT _const_payment_bank()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation status
CREATE OR REPLACE FUNCTION _const_calc_calculated() RETURNS TEXT AS $$
  SELECT _const_calc_calculated()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation sources
CREATE OR REPLACE FUNCTION _const_calc_source_v6() RETURNS TEXT AS $$
  SELECT _const_calc_source_v6()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_source_v7() RETURNS TEXT AS $$
  SELECT _const_calc_source_v7()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get calculation methods
CREATE OR REPLACE FUNCTION _const_calc_method_orders() RETURNS TEXT AS $$
  SELECT _const_work_orders()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift() RETURNS TEXT AS $$
  SELECT _const_work_shift()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_fixed() RETURNS TEXT AS $$
  SELECT _const_calc_method_shift_fixed()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_shift_full_month() RETURNS TEXT AS $$
  SELECT _const_calc_method_shift_full_month()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_mixed() RETURNS TEXT AS $$
  SELECT _const_calc_method_mixed()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_calc_method_orders_fallback() RETURNS TEXT AS $$
  SELECT _const_calc_method_orders_fallback()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

-- Get tier types
CREATE OR REPLACE FUNCTION _const_tier_fixed() RETURNS TEXT AS $$
  SELECT _const_tier_fixed()::TEXT;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION _const_tier_incremental() RETURNS TEXT AS $$
  SELECT _const_tier_incremental()::TEXT;
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
