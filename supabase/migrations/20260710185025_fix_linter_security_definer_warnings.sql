-- Fix Supabase Linter Warnings (anon_security_definer_function_executable)

-- Trigger functions should not be executable by users
REVOKE EXECUTE ON FUNCTION public.fn_handle_employee_sponsorship_alerts() FROM public, anon, authenticated;

-- Settings management access is only for authenticated users (used in RLS)
REVOKE EXECUTE ON FUNCTION public.has_settings_management_access() FROM anon;
