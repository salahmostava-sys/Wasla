-- ============================================================
-- FIX: RESOLVE STATEMENT TIMEOUTS IN RLS EVALUATIONS
-- ============================================================
-- RLS performance degrades severely (O(N^2) or worse) leading to 
-- "canceling statement due to statement timeout" when helper functions 
-- used inside RLS policies are set to SECURITY INVOKER.
-- When they query tables that themselves have RLS policies, PostgreSQL 
-- re-evaluates the nested RLS on every row check.
--
-- This migration restores these remaining functions to SECURITY DEFINER
-- and properly sets the search_path to public to clear linter warnings 
-- without destroying query performance.

-- 1. Restore employee_in_my_company and advance_in_my_company
ALTER FUNCTION public.employee_in_my_company(_employee_id uuid) SECURITY DEFINER SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.advance_in_my_company(_advance_id uuid) SECURITY DEFINER SET search_path = public; /* NOSONAR */

-- Revoke from anon/public and grant to authenticated/service_role
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.employee_in_my_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.advance_in_my_company(uuid) TO authenticated, service_role;

-- 2. Ensure functions restored in migration 13 have explicit search_path
-- This prevents the "anon_security_definer_function_executable" and other
-- search_path-related warnings that originally caused them to be downgraded.
ALTER FUNCTION public.is_active_user(_user_id uuid) SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.has_role(_user_id uuid, _role app_role) SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.get_my_role() SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.has_permission(p_resource text, p_action text) SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.is_internal_user() SET search_path = public; /* NOSONAR */
ALTER FUNCTION public.is_admin_or_hr(uid uuid) SET search_path = public; /* NOSONAR */

NOTIFY pgrst, 'reload schema';
