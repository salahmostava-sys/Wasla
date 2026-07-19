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

-- Step 1: Create a helper cast function TEXT â†’ employee_status
CREATE OR REPLACE FUNCTION public.text_to_employee_status(text)
  RETURNS public.employee_status
  LANGUAGE SQL IMMUTABLE STRICT
  SET search_path = public /* NOSONAR */
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
