-- ============================================================
-- Ensure all remaining SECURITY DEFINER functions are set to INVOKER
-- ============================================================

ALTER FUNCTION public.is_salary_month_visible_employee(uuid, text, text, text, text) SECURITY INVOKER;
