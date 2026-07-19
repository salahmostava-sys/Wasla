-- Fix Supabase Linter: security_definer_view
-- Set security_invoker = true so these views respect the querying user's RLS
-- policies instead of the view creator's permissions.

ALTER VIEW public.v_rider_daily_platform_orders SET (security_invoker = true);
ALTER VIEW public.v_rider_daily_performance SET (security_invoker = true);
ALTER VIEW public.v_rider_monthly_performance SET (security_invoker = true);
