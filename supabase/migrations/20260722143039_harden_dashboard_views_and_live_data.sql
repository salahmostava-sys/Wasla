-- Keep dashboard totals live while preserving the relation names consumed by
-- existing RPCs. The former materialized view had no refresh trigger or cron job.

ALTER VIEW public.v_rider_daily_platform_orders
  SET (security_invoker = true);

ALTER VIEW public.v_rider_daily_performance
  SET (security_invoker = true);

DROP VIEW public.v_rider_monthly_performance;
DROP MATERIALIZED VIEW public.mv_rider_daily_performance;

-- Compatibility read model: existing RPCs still reference the mv_* name, but
-- the data now comes from the live daily view and cannot become stale.
CREATE VIEW public.mv_rider_daily_performance
WITH (security_invoker = true)
AS
SELECT
  employee_id,
  employee_name,
  city,
  date,
  total_orders,
  active_platforms,
  platform_breakdown
FROM public.v_rider_daily_performance;

COMMENT ON VIEW public.mv_rider_daily_performance IS
'Live compatibility view for dashboard RPCs; replaces the unrefreshed materialized cache.';

CREATE VIEW public.v_rider_monthly_performance
WITH (security_invoker = true)
AS
WITH monthly_base AS (
  SELECT
    d.employee_id,
    d.employee_name,
    d.city,
    to_char(d.date, 'YYYY-MM') AS month_year,
    SUM(d.total_orders)::integer AS total_orders,
    COUNT(*) FILTER (WHERE d.total_orders > 0)::integer AS active_days,
    MAX(d.total_orders)::integer AS best_day_orders,
    MAX(d.date) FILTER (WHERE d.total_orders > 0) AS last_active_date
  FROM public.v_rider_daily_performance AS d
  GROUP BY
    d.employee_id,
    d.employee_name,
    d.city,
    to_char(d.date, 'YYYY-MM')
),
consistency_base AS (
  SELECT
    d.employee_id,
    to_char(d.date, 'YYYY-MM') AS month_year,
    COUNT(*) FILTER (
      WHERE d.total_orders >= (
        monthly.total_orders::numeric / NULLIF(monthly.active_days, 0)
      )
    )::integer AS consistency_days
  FROM public.v_rider_daily_performance AS d
  JOIN monthly_base AS monthly
    ON monthly.employee_id = d.employee_id
   AND monthly.month_year = to_char(d.date, 'YYYY-MM')
  GROUP BY
    d.employee_id,
    to_char(d.date, 'YYYY-MM')
)
SELECT
  monthly.employee_id,
  monthly.employee_name,
  monthly.city,
  monthly.month_year,
  monthly.total_orders,
  monthly.active_days,
  ROUND(monthly.total_orders::numeric / NULLIF(monthly.active_days, 0), 2) AS avg_orders_per_day,
  COALESCE(consistency.consistency_days, 0) AS consistency_days,
  ROUND(
    COALESCE(consistency.consistency_days, 0)::numeric
      / NULLIF(monthly.active_days, 0),
    2
  ) AS consistency_ratio,
  monthly.best_day_orders,
  monthly.last_active_date,
  COALESCE(target.monthly_target_orders, 0) AS monthly_target_orders,
  COALESCE(target.daily_target_orders, 0) AS daily_target_orders,
  CASE
    WHEN COALESCE(target.monthly_target_orders, 0) > 0 THEN
      ROUND(
        (monthly.total_orders::numeric / target.monthly_target_orders::numeric) * 100,
        2
      )
    ELSE 0
  END AS target_achievement_pct
FROM monthly_base AS monthly
LEFT JOIN consistency_base AS consistency
  ON consistency.employee_id = monthly.employee_id
 AND consistency.month_year = monthly.month_year
LEFT JOIN public.employee_targets AS target
  ON target.employee_id = monthly.employee_id
 AND target.month_year = monthly.month_year;

COMMENT ON VIEW public.v_rider_monthly_performance IS
'Live monthly rider metrics, consistency, and target achievement.';

DROP FUNCTION public.refresh_dashboard_materialized_views();

REVOKE ALL ON public.v_rider_daily_platform_orders FROM PUBLIC, anon;
REVOKE ALL ON public.v_rider_daily_performance FROM PUBLIC, anon;
REVOKE ALL ON public.v_rider_monthly_performance FROM PUBLIC, anon;
REVOKE ALL ON public.mv_rider_daily_performance FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_rider_daily_platform_orders TO authenticated, service_role;
GRANT SELECT ON public.v_rider_daily_performance TO authenticated, service_role;
GRANT SELECT ON public.v_rider_monthly_performance TO authenticated, service_role;
GRANT SELECT ON public.mv_rider_daily_performance TO service_role;

NOTIFY pgrst, 'reload schema';
