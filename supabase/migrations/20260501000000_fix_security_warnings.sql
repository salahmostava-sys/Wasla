-- ============================================================
-- SECURITY FIX: Revoke anon EXECUTE on all SECURITY DEFINER functions
-- All these functions require an authenticated session; anon access is unintentional.
-- ============================================================

-- â”€â”€ Salary / Payroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text)                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text)                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text)                                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text)                                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text)                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid)                              FROM anon;

-- â”€â”€ Employee / HR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid)                                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamptz)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_out(uuid, timestamptz)                                                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid)                                                               FROM anon;

-- â”€â”€ Auth / Role helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.get_my_role()                                                                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text)                                                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid)                                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user()                                                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()                                                                     FROM anon;

-- â”€â”€ Dashboard / Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date)                                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date)                                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date)                                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date)                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date)                                            FROM anon;

-- â”€â”€ Audit / Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()                                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()                                                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()                                                                        FROM anon;

-- â”€â”€ Test functions (revoke from everyone via REST) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                                        FROM authenticated;

-- ============================================================
-- SECURITY FIX: Revoke direct EXECUTE on trigger-only functions from authenticated
-- These are fired by triggers, never by direct RPC calls.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()     FROM authenticated;

-- ============================================================
-- SECURITY FIX: Fix mutable search_path on calc_tier_salary
-- Prevents search_path injection attacks on this function.
-- ============================================================
ALTER FUNCTION public.calc_tier_salary SET search_path = public; /* NOSONAR */
