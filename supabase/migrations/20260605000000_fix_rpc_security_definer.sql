-- ============================================================
-- FIX: Restore SECURITY DEFINER on dashboard and performance RPCs
--
-- Migration 20260504000001 changed these RPCs to SECURITY INVOKER
-- which caused "Not allowed" errors because:
--   1. The helper functions (has_role, is_active_user) run under
--      the calling user's privileges and may fail to read user_roles.
--   2. The RPCs perform complex joins on tables where RLS may block
--      access unless the function runs as the owner (definer).
--
-- These functions already have their own manual RBAC check at the
-- top of the function body, so SECURITY DEFINER is safe here.
-- The search_path is locked to 'public' to satisfy the linter.
-- ============================================================

ALTER FUNCTION public.performance_dashboard_rpc(text, date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.rider_profile_performance_rpc(uuid, text, date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.dashboard_overview_rpc(text, integer, integer, date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.dashboard_overview_rpc(text, text, date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.dashboard_overview_rpc(integer, integer, date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.dashboard_overview_rpc(text, date)
  SECURITY DEFINER
  SET search_path = public;

-- Make sure authenticated users can still execute them.
-- (anon is already revoked by the previous migration.)
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date) TO authenticated;
