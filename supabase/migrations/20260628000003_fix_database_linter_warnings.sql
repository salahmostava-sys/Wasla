-- Fix: Database Linter Warnings

-- 1. function_search_path_mutable
-- calc_tier_salary has a role mutable search_path
ALTER FUNCTION public.calc_tier_salary(integer, uuid) SET search_path = public; /* NOSONAR */

-- 2. Remove the obsolete RPC. Salary expense synchronization is owned by
-- financeService and keeping a second implementation caused schema drift.
DROP FUNCTION IF EXISTS public.sync_salaries_as_expenses(text);
