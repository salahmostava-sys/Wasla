-- Harden SECURITY DEFINER function execute privileges.
-- This migration only narrows direct RPC access; it does not alter existing
-- RLS policies or rewrite migration history.

-- Trigger functions are invoked by PostgreSQL triggers and should not be
-- directly callable through PostgREST RPC by browser roles.
REVOKE EXECUTE ON FUNCTION public.fn_handle_employee_sponsorship_alerts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_handle_employee_sponsorship_alerts() TO service_role;

-- This helper is used by RLS policies for signed-in users, but anonymous users
-- should not be able to call it directly.
REVOKE EXECUTE ON FUNCTION public.has_settings_management_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_settings_management_access() TO authenticated, service_role;

-- Internal salary/accounting maintenance RPCs should run through trusted
-- backend/service-role paths only.
REVOKE EXECUTE ON FUNCTION public.sync_salaries_as_expenses(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_salaries_as_expenses(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month_v2(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month_v2(TEXT) TO service_role;
