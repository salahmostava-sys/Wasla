-- Backward compatibility for older dashboard RPC call signatures.
-- Some deployed clients still call month/year argument variants.

CREATE OR REPLACE FUNCTION public.dashboard_overview_rpc(
  p_month integer,
  p_year integer,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
DECLARE
  v_month_year text;
BEGIN
  IF p_month IS NULL OR p_year IS NULL THEN
    RAISE EXCEPTION 'p_month and p_year are required';
  END IF;

  v_month_year := to_char(make_date(p_year, p_month, 1), 'YYYY-MM');
  RETURN public.dashboard_overview_rpc(v_month_year, COALESCE(p_today, CURRENT_DATE));
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview_rpc(
  p_cip text,
  p_month integer,
  p_year integer,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
BEGIN
  PERFORM p_cip;
  RETURN public.dashboard_overview_rpc(p_month, p_year, COALESCE(p_today, CURRENT_DATE));
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview(
  p_month integer,
  p_year integer,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT public.dashboard_overview_rpc(p_month, p_year, COALESCE(p_today, CURRENT_DATE));
$$;

CREATE OR REPLACE FUNCTION public.dashboard_overview(
  p_cip text,
  p_month integer,
  p_year integer,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT public.dashboard_overview_rpc(p_cip, p_month, p_year, COALESCE(p_today, CURRENT_DATE));
$$;
