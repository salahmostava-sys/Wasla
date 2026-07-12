-- Compatibility overloads for backend calls using:
-- dashboard_overview(p_cip, p_monthly_year, p_today)
-- and dashboard_overview_rpc(p_cip, p_monthly_year, p_today).

CREATE OR REPLACE FUNCTION public.dashboard_overview_rpc(
  p_cip text,
  p_monthly_year text,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT public.dashboard_overview_rpc(p_monthly_year, COALESCE(p_today, CURRENT_DATE));
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview(
  p_cip text,
  p_monthly_year text,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT public.dashboard_overview_rpc(p_monthly_year, COALESCE(p_today, CURRENT_DATE));
$$;
