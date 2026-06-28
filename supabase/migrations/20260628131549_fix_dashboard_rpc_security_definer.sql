-- supabase/migrations/20260628131549_fix_dashboard_rpc_security_definer.sql
-- Fix: Restore SECURITY DEFINER on dashboard RPCs
-- These were incorrectly changed to SECURITY INVOKER in 20260606000008,
-- which overrode the deliberate fix in 20260605000000.

ALTER FUNCTION public.performance_dashboard_rpc(p_month_year text, p_today date)
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.rider_profile_performance_rpc(p_employee_id uuid, p_month_year text, p_today date)
  SECURITY DEFINER
  SET search_path = public;

-- Ensure authenticated users can execute them
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date) TO authenticated;
