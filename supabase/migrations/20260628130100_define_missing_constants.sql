-- supabase/migrations/20260628130100_define_missing_constants.sql
-- Fix: Define all missing _const_* functions

CREATE OR REPLACE FUNCTION _const_work_shift() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'shift'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_work_orders() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'orders'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_employee_active() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'active'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_installment_pending() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'pending'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_installment_deferred() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'deferred'::TEXT; $$;

CREATE OR REPLACE FUNCTION _const_approval_approved() RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'approved'::TEXT; $$;
