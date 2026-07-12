-- ============================================================
-- FIX: RESTORE RLS HELPER FUNCTIONS TO SECURITY DEFINER
-- ============================================================
-- In migration 20260606000008, we switched these functions to 
-- SECURITY INVOKER to satisfy the "anon_security_definer_function_executable"
-- linter warning.
-- HOWEVER, this caused an INFINITE RECURSION in RLS policies 
-- (e.g. public.profiles select policy calls is_active_user, which 
-- as an invoker, triggers the select policy again!).
-- 
-- The correct fix is to keep them SECURITY DEFINER, but explicitly
-- REVOKE EXECUTE access from 'public' and 'anon' to clear the warning.

ALTER FUNCTION public.is_active_user(_user_id uuid) SECURITY DEFINER;
ALTER FUNCTION public.has_role(_user_id uuid, _role app_role) SECURITY DEFINER;
ALTER FUNCTION public.get_my_role() SECURITY DEFINER;
ALTER FUNCTION public.has_permission(p_resource text, p_action text) SECURITY DEFINER;
ALTER FUNCTION public.is_internal_user() SECURITY DEFINER;
ALTER FUNCTION public.is_admin_or_hr(uid uuid) SECURITY DEFINER;

-- Clear the linter warnings properly by restricting execution:
REVOKE EXECUTE ON FUNCTION public.is_active_user(_user_id uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(p_resource text, p_action text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(uid uuid) FROM public, anon;

-- Explicitly allow authenticated and service roles
GRANT EXECUTE ON FUNCTION public.is_active_user(_user_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(p_resource text, p_action text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(uid uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
