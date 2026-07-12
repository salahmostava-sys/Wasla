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
SET search_path TO 'public' /* NOSONAR */
AS $$
BEGIN
  RETURN (
    public.has_role(uid, _const_role_admin())
    OR public.has_role(uid, _const_role_hr())
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
