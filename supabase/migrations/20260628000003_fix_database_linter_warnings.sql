-- Fix: Database Linter Warnings

-- 1. function_search_path_mutable
-- calc_tier_salary has a role mutable search_path
ALTER FUNCTION public.calc_tier_salary(integer, uuid) SET search_path = public; /* NOSONAR */

-- 2. anon_security_definer_function_executable
-- sync_salaries_as_expenses can be executed by the anon role
REVOKE EXECUTE ON FUNCTION public.sync_salaries_as_expenses(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_salaries_as_expenses(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_salaries_as_expenses(text) TO authenticated;
