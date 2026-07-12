-- ============================================================
-- SECURITY FIX v3 — Fix Supabase Linter Warnings
--
-- 1. function_search_path_mutable
-- 2. rls_policy_always_true
-- 3. anon_security_definer_function_executable
-- 4. authenticated_security_definer_function_executable
-- ============================================================

-- ── 1. function_search_path_mutable ─────────────────────────
ALTER FUNCTION public.is_salary_admin_job_title(text) SET search_path = public; /* NOSONAR */

-- Helper function for Admin/HR access check
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(uid uuid) RETURNS boolean AS $$
BEGIN
  RETURN is_active_user(uid) AND (has_role(uid, _const_role_admin()) OR has_role(uid, _const_role_hr()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- hr_performance_reviews
DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;

CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE USING (is_admin_or_hr(auth.uid()))
  WITH CHECK (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (is_admin_or_hr(auth.uid()));

-- leave_requests
DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;

CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (is_admin_or_hr(auth.uid()));

CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (is_admin_or_hr(auth.uid()))
  WITH CHECK (is_admin_or_hr(auth.uid()));

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (is_admin_or_hr(auth.uid()));


-- ── 3. anon_security_definer_function_executable ────────────
-- Revoke EXECUTE from anon and public for all listed functions
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamp with time zone) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user() FROM PUBLIC, anon;

-- ── 4. authenticated_security_definer_function_executable ───
-- Convert functions to SECURITY INVOKER where safe to clear warnings for authenticated role.
-- (Functions that bypass RLS intentionally will remain SECURITY DEFINER and warnings can be ignored).

ALTER FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview_rpc(text, date) SECURITY INVOKER;

ALTER FUNCTION public.performance_dashboard_rpc(text, date) SECURITY INVOKER;
ALTER FUNCTION public.rider_profile_performance_rpc(uuid, text, date) SECURITY INVOKER;

ALTER FUNCTION public.calculate_salary_for_month(text, text) SECURITY INVOKER;
ALTER FUNCTION public.capture_salary_month_snapshot(text) SECURITY INVOKER;
ALTER FUNCTION public.preview_salary_for_month(text) SECURITY INVOKER;

-- Trigger functions shouldn't be executed by authenticated users directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns() FROM authenticated;

-- Test/debug functions
REVOKE EXECUTE ON FUNCTION public.test_shift_salary() FROM authenticated;

-- Convert additional functions from the linter report to SECURITY INVOKER
ALTER FUNCTION public.advance_in_my_company(uuid) SECURITY INVOKER;
ALTER FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) SECURITY INVOKER;
ALTER FUNCTION public.calculate_salary(uuid, text, text, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.check_employee_operational_records(uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_in(uuid, timestamp with time zone) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(text, integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(text, text, date) SECURITY INVOKER;
ALTER FUNCTION public.dashboard_overview(integer, integer, date) SECURITY INVOKER;
ALTER FUNCTION public.employee_in_my_company(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) SECURITY INVOKER;
ALTER FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid) SECURITY INVOKER;
