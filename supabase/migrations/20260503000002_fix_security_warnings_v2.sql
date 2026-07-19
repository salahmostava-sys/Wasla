-- ============================================================
-- SECURITY FIX v2 â€” ÙŠØ¹Ø§Ù„Ø¬ Ø¬Ù…ÙŠØ¹ Ø§Ù„ØªØØ°ÙŠØ±Ø§Øª Ø§Ù„Ø£Ù…Ù†ÙŠØ© Ø§Ù„Ø¸Ø§Ù‡Ø±Ø© ÙÙŠ Supabase
--
-- Ø§Ù„Ù…Ø´Ø§ÙƒÙ„ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©:
--   1. rls_policy_always_true    â†’ Ø¥ØµÙ„Ø§Ø Ø³ÙŠØ§Ø³Ø§Øª RLS Ù„Ù„Ø¬Ø¯Ø§ÙˆÙ„ Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©
--   2. function_search_path_mutable â†’ Ø¥ØµÙ„Ø§Ø is_salary_admin_job_title
--   3. anon_security_definer_function_executable  â†’ Ø¥Ù„ØºØ§Ø¡ ØµÙ„Ø§ØÙŠØ© anon
--   4. authenticated_security_definer_function_executable â†’ Ø¥Ù„ØºØ§Ø¡ ØµÙ„Ø§ØÙŠØ© authenticated Ù„Ù„Ø¯ÙˆØ§Ù„ Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ©
-- ============================================================

-- ============================================================
-- 1. Ø¥ØµÙ„Ø§Ø Ø³ÙŠØ§Ø³Ø§Øª RLS â€” leave_requests
-- ============================================================

DROP POLICY IF EXISTS leave_requests_insert ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_delete ON public.leave_requests;

-- ÙŠØ´ØªØ±Ø· Ø£Ù† ÙŠÙƒÙˆÙ† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù…Ø³Ø¬Ù„Ø§Ù‹ (authenticated) Ù„Ø£ÙŠ Ø¹Ù…Ù„ÙŠØ© ÙƒØªØ§Ø¨Ø©
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. Ø¥ØµÙ„Ø§Ø Ø³ÙŠØ§Ø³Ø§Øª RLS â€” hr_performance_reviews
-- ============================================================

DROP POLICY IF EXISTS hr_reviews_insert ON public.hr_performance_reviews;
DROP POLICY IF EXISTS hr_reviews_update ON public.hr_performance_reviews;
DROP POLICY IF EXISTS hr_reviews_delete ON public.hr_performance_reviews;

DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. Ø¥ØµÙ„Ø§Ø function_search_path_mutable â€” is_salary_admin_job_title
--    Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø¯Ø§Ù„Ø© Ù…Ø¹ SET search_path = '' Ù„Ù…Ù†Ø¹ Ù‡Ø¬Ù…Ø§Øª ØÙ‚Ù† search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(p_job_title, '') <> ''
    AND NOT (
      COALESCE(p_job_title, '') ~* '(Ù…Ù†Ø¯ÙˆØ¨|Ø³Ø§Ø¦Ù‚|ØªÙˆØµÙŠÙ„|Ù…ÙˆØµÙ„|Ù…Ø±Ø³Ø§Ù„|rider|driver|delivery|courier|dispatch|messenger)'
    );
$$;

-- ============================================================
-- 4. Ø¥Ù„ØºØ§Ø¡ ØµÙ„Ø§ØÙŠØ© anon Ø¹Ù„Ù‰ Ø¬Ù…ÙŠØ¹ Ø¯ÙˆØ§Ù„ SECURITY DEFINER
--    (Ø´Ø§Ù…Ù„Ø© Ù„Ù„Ø¯ÙˆØ§Ù„ Ø§Ù„ØªÙŠ Ù‚Ø¯ Ù„Ø§ ÙŠÙƒÙˆÙ† Ù‚Ø¯ Ø´Ù…Ù„Ù‡Ø§ Ø§Ù„Ù€ migration Ø§Ù„Ø³Ø§Ø¨Ù‚)
-- ============================================================

-- â”€â”€ Ø§Ù„Ø±ÙˆØ§ØªØ¨ / Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.advance_in_my_company(uuid)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_employee_salary(uuid, text, text, numeric, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(uuid, text, text, numeric, text)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_salary_for_month(text, text)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.capture_salary_month_snapshot(text)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(text)                                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.replace_daily_orders_month_rpc(text, jsonb, text, text, uuid)         FROM anon;

-- â”€â”€ Ø§Ù„Ù…ÙˆØ¸ÙÙˆÙ† / Ø§Ù„ØØ¶ÙˆØ± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.check_employee_operational_records(uuid)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_in(uuid, timestamptz)                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_out(uuid, timestamptz)                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.employee_in_my_company(uuid)                                          FROM anon;

-- â”€â”€ Ø§Ù„Ù…ØµØ§Ø¯Ù‚Ø© / Ø§Ù„Ø£Ø¯ÙˆØ§Ø± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid)                                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()                                                FROM anon;

-- â”€â”€ Ù„ÙˆØØ© Ø§Ù„ØªØÙƒÙ… / Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, integer, integer, date)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, text, date)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(integer, integer, date)                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview_rpc(text, date)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date)                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date)                       FROM anon;

-- â”€â”€ Audit / Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()                                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()                                                   FROM anon;

-- ============================================================
-- 5. Ø¥Ù„ØºØ§Ø¡ ØµÙ„Ø§ØÙŠØ© authenticated Ø¹Ù„Ù‰ Ø§Ù„Ø¯ÙˆØ§Ù„ Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© ÙÙ‚Ø·
--    (Ø§Ù„Ø¯ÙˆØ§Ù„ Ø§Ù„ØªÙŠ ØªØ³ØªØ¯Ø¹ÙŠÙ‡Ø§ Ø§Ù„Ù€ triggers Ø£Ùˆ Ù…Ø³Ø§Ø¹Ø¯Ø§Øª Ø¯Ø§Ø®Ù„ÙŠØ© ÙÙ‚Ø·ØŒ
--     ÙˆÙ„Ø§ ÙŠÙ†Ø¨ØºÙŠ Ø§Ø³ØªØ¯Ø¹Ø§Ø¤Ù‡Ø§ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ø¨Ø± REST API)
-- ============================================================

-- Ø¯ÙˆØ§Ù„ Ø§Ù„Ù€ trigger (Ù„Ø§ ØªÙØ³ØªØ¯Ø¹Ù‰ Ù…Ø¨Ø§Ø´Ø±Ø©)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role()   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_admin_action_cud()   FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_columns()      FROM authenticated;

-- Ø¯ÙˆØ§Ù„ Ø§Ø®ØªØ¨Ø§Ø± / ØªØµØÙŠØ
REVOKE EXECUTE ON FUNCTION public.test_shift_salary()      FROM authenticated;

-- Ù…Ø³Ø§Ø¹Ø¯ Ø¯Ø§Ø®Ù„ÙŠ ÙŠØ³ØªØ¯Ø¹ÙŠÙ‡ plpgsql ÙÙ‚Ø· â€” Ù„Ø§ ÙŠÙØ³ØªØ¯Ø¹Ù‰ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ø¨Ø± supabase.rpc()
REVOKE EXECUTE ON FUNCTION public.calculate_order_salary_for_app(uuid, integer, integer, uuid[], boolean) FROM authenticated;

-- Ù†Ø³Ø® dashboard_overview Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© (legacy) â€” Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙŠØ³ØªØ®Ø¯Ù… dashboard_overview_rpc ÙÙ‚Ø·
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, integer, integer, date)                      FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(text, text, date)                                  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_overview(integer, integer, date)                            FROM authenticated;
