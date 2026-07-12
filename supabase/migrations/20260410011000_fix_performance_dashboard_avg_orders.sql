BEGIN;

DO $$
DECLARE
  v_definition TEXT;
  v_updated_definition TEXT;
  v_old_crlf TEXT;
  v_old_lf TEXT;
  v_new_block TEXT;
BEGIN
  SELECT pg_get_functiondef('public.performance_dashboard_rpc(text, date)'::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Function public.performance_dashboard_rpc(text, date) was not found';
  END IF;

  v_old_crlf :=
    '          SELECT ROUND(current_orders::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE total_orders > 0), 0), 2)'
    || E'\r\n'
    || '          FROM month_comparison, current_month';

  v_old_lf :=
    '          SELECT ROUND(current_orders::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE total_orders > 0), 0), 2)'
    || E'\n'
    || '          FROM month_comparison, current_month';

  v_new_block :=
    '          SELECT ROUND('
    || E'\n'
    || '            COALESCE((SELECT current_orders FROM month_comparison), 0)::NUMERIC'
    || E'\n'
    || '            / NULLIF((SELECT COUNT(*)::INTEGER FROM current_month WHERE total_orders > 0), 0),'
    || E'\n'
    || '            2'
    || E'\n'
    || '          )';

  v_updated_definition := replace(v_definition, v_old_crlf, v_new_block);

  IF v_updated_definition = v_definition THEN
    v_updated_definition := replace(v_definition, v_old_lf, v_new_block);
  END IF;

  IF v_updated_definition = v_definition THEN
    RAISE NOTICE 'Hotfix pattern was not found in public.performance_dashboard_rpc(text, date). It may have already been applied.';
    RETURN;
  END IF;

  EXECUTE v_updated_definition;
END;
$$;

COMMENT ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) IS
'Single backend source for dashboard KPIs, comparisons, rankings, alerts, and performance trends.';

REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) TO authenticated;

COMMIT;
