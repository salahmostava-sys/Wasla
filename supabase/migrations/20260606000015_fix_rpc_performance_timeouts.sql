-- ============================================================
-- FIX: RESOLVE STATEMENT TIMEOUTS IN COMPLEX RPCs
-- ============================================================
-- Many complex RPCs (e.g. dashboards, salary calculations) were 
-- switched to SECURITY INVOKER to satisfy linter warnings.
-- However, when an RPC aggregates thousands of rows (like daily_orders),
-- running as SECURITY INVOKER forces PostgreSQL to evaluate complex RLS 
-- policies (which often contain subqueries) on EVERY single row.
-- This causes exponential performance degradation (O(N^2) or worse) 
-- and results in "canceling statement due to statement timeout" errors.
--
-- This migration restores these heavy RPCs to SECURITY DEFINER to 
-- bypass RLS during their internal execution (since they already do 
-- manual permission checks), while using SET search_path = public  /* NOSONAR */
-- and explicitly revoking access from anon/public to satisfy the linter.

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT p.oid::regprocedure::text AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'dashboard_overview_rpc',
            'dashboard_overview',
            'performance_dashboard_rpc',
            'rider_profile_performance_rpc',
            'preview_salary_for_month',
            'preview_salary_for_month_v2',
            'calculate_employee_salary',
            'calculate_order_salary_for_app',
            'calculate_salary',
            'calculate_salary_for_month',
            'capture_salary_month_snapshot',
            'assign_platform_account',
            'replace_daily_orders_month_rpc'
          )
    LOOP
        -- 1. Make the function SECURITY DEFINER and secure search_path
        EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER SET search_path = public;', rec.func_signature); /* NOSONAR */
        
        -- 2. Revoke from anon/public to clear "anon_security_definer_function_executable" warning
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon;', rec.func_signature);
        
        -- 3. Explicitly grant execution to authenticated and service_role
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', rec.func_signature);
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
