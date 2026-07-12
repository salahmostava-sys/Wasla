-- ============================================================
-- FIX: performance_dashboard_rpc JSON shape mismatch
-- ============================================================
-- The migration 20260629171000_restore_performance_dashboard_rpc_real.sql
-- switched the RPC's return shape to `comparison.month/week`, `distribution`,
-- `rankings.topPerformers/lowPerformers/mostImproved/mostDeclined`, `targets`.
--
-- However, the current frontend mapper (performanceService.ts ->
-- mapRpcToDashboardResponse) reads the OLDER shape:
--   raw.riderLeaderboard, raw.monthComparison, raw.weekComparison,
--   raw.performanceDistribution, raw.topRiderToday, raw.lowestRiderToday,
--   raw.summary.totalRiders
--
-- Because those keys no longer exist in the RPC response, the frontend
-- silently falls back to empty defaults: leaderboard becomes [], so
-- top/low performers, most improved/declined, performance score,
-- performance distribution, and target achievement all render as 0 /
-- "Ù„Ø§ ÙŠÙˆØ¬Ø¯", even though summary.totalOrders / summary.activeRiders still
-- work (their key names happen to match in both shapes).
--
-- This migration restores the JSON shape the frontend actually expects,
-- while keeping the security/search_path hardening from later migrations.
-- It also adds a 4th "good" bucket to performanceDistribution (previously
-- only excellent/average/weak were computed, so "good" was always 0).
-- ============================================================

CREATE OR REPLACE FUNCTION public.performance_dashboard_rpc(
  p_month_year TEXT,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' /* NOSONAR */
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_effective_end DATE;
  v_prev_month TEXT;
  v_week_start DATE;
  v_prev_week_end DATE;
  v_prev_week_start DATE;
BEGIN
  IF NOT (
    public.is_active_user(auth.uid())
    AND (
      public.has_role(auth.uid(), _const_role_admin())
      OR public.has_role(auth.uid(), _const_role_hr())
      OR public.has_role(auth.uid(), _const_role_finance())
      OR public.has_role(auth.uid(), _const_role_operations())
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_month_year !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid month_year format. Expected YYYY-MM';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::DATE;
  v_effective_end := LEAST(COALESCE(p_today, CURRENT_DATE), v_end);
  v_prev_month := to_char((v_start - INTERVAL '1 month')::DATE, 'YYYY-MM');
  v_week_start := (v_effective_end - INTERVAL '6 day')::DATE;
  v_prev_week_end := (v_week_start - INTERVAL '1 day')::DATE;
  v_prev_week_start := (v_prev_week_end - INTERVAL '6 day')::DATE;

  RETURN (
    WITH current_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE month_year = p_month_year
    ),
    prev_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE month_year = v_prev_month
    ),
    current_ranked AS (
      SELECT
        cm.employee_id,
        cm.employee_name,
        cm.city,
        cm.month_year,
        cm.total_orders,
        cm.active_days,
        cm.avg_orders_per_day,
        cm.consistency_days,
        cm.consistency_ratio,
        cm.best_day_orders,
        cm.last_active_date,
        cm.monthly_target_orders,
        cm.daily_target_orders,
        cm.target_achievement_pct,
        ROW_NUMBER() OVER (
          ORDER BY cm.total_orders DESC, cm.avg_orders_per_day DESC, cm.employee_name
        ) AS rank_position,
        COALESCE(pm.total_orders, 0) AS prev_total_orders,
        COALESCE(pm.active_days, 0) AS prev_active_days,
        COALESCE(pm.avg_orders_per_day, 0) AS prev_avg_orders_per_day,
        CASE
          WHEN COALESCE(pm.total_orders, 0) > 0 THEN
            ROUND(((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) * 100, 2)
          WHEN cm.total_orders > 0 THEN 100
          ELSE 0
        END AS growth_pct,
        CASE
          WHEN COALESCE(pm.total_orders, 0) > 0 AND ((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) >= 0.05 THEN 'up'
          WHEN COALESCE(pm.total_orders, 0) > 0 AND ((cm.total_orders - pm.total_orders)::NUMERIC / pm.total_orders::NUMERIC) <= -0.05 THEN 'down'
          ELSE 'stable'
        END AS trend_code
      FROM current_month AS cm
      LEFT JOIN prev_month AS pm
        ON pm.employee_id = cm.employee_id
    ),
    leaderboard_date AS MATERIALIZED (
      SELECT MAX(date) AS date
      FROM public.v_rider_daily_performance
      WHERE date BETWEEN v_start AND v_effective_end
        AND total_orders > 0
    ),
    current_day_ranked AS (
      SELECT
        d.employee_id,
        d.employee_name,
        d.total_orders,
        ROW_NUMBER() OVER (ORDER BY d.total_orders DESC, d.employee_name) AS top_rank,
        ROW_NUMBER() OVER (ORDER BY d.total_orders ASC, d.employee_name) AS low_rank
      FROM public.v_rider_daily_performance AS d
      JOIN leaderboard_date AS ld
        ON ld.date = d.date
    ),
    app_meta AS (
      SELECT
        a.id,
        a.name,
        COALESCE(a.brand_color, '#2563eb') AS brand_color,
        COALESCE(a.text_color, '#ffffff') AS text_color /* NOSONAR */
      FROM public.apps AS a
      WHERE a.is_active IS TRUE
    ),
    orders_by_app AS (
      SELECT
        p.app_id,
        MAX(p.app_name) AS app_name,
        MAX(p.brand_color) AS brand_color,
        COALESCE(MAX(am.text_color), '#ffffff') AS text_color, /* NOSONAR */
        SUM(p.total_orders)::INTEGER AS total_orders,
        COUNT(DISTINCT p.employee_id)::INTEGER AS rider_count
      FROM public.v_rider_daily_platform_orders AS p
      LEFT JOIN app_meta AS am
        ON am.id = p.app_id
      WHERE p.date BETWEEN v_start AND v_effective_end
      GROUP BY p.app_id
    ),
    prev_orders_by_app AS (
      SELECT
        p.app_id,
        SUM(p.total_orders)::INTEGER AS total_orders
      FROM public.v_rider_daily_platform_orders AS p
      WHERE p.date BETWEEN (v_start - INTERVAL '1 month')::DATE AND (v_start - INTERVAL '1 day')::DATE
      GROUP BY p.app_id
    ),
    app_targets AS (
      SELECT app_id, COALESCE(target_orders, 0)::INTEGER AS target_orders
      FROM public.app_targets
      WHERE month_year = p_month_year
    ),
    app_comparison AS (
      SELECT
        oba.app_id,
        oba.app_name,
        oba.brand_color,
        oba.text_color,
        oba.total_orders,
        oba.rider_count,
        COALESCE(at.target_orders, 0) AS target_orders,
        COALESCE(po.total_orders, 0) AS previous_orders,
        CASE
          WHEN COALESCE(po.total_orders, 0) > 0 THEN
            ROUND(((oba.total_orders - po.total_orders)::NUMERIC / po.total_orders::NUMERIC) * 100, 2)
          WHEN oba.total_orders > 0 THEN 100
          ELSE 0
        END AS growth_pct,
        CASE
          WHEN COALESCE(at.target_orders, 0) > 0 THEN
            ROUND((oba.total_orders::NUMERIC / at.target_orders::NUMERIC) * 100, 2)
          ELSE 0
        END AS target_achievement_pct
      FROM orders_by_app AS oba
      LEFT JOIN prev_orders_by_app AS po
        ON po.app_id = oba.app_id
      LEFT JOIN app_targets AS at
        ON at.app_id = oba.app_id
    ),
    orders_by_city AS (
      SELECT
        COALESCE(city, 'unknown') AS city,
        SUM(total_orders)::INTEGER AS orders
      FROM current_month
      GROUP BY city
    ),
    team_avg AS (
      SELECT
        ROUND(AVG(total_orders)::NUMERIC, 2) AS avg_total_orders
      FROM current_month
    ),
    performance_distribution AS (
      SELECT
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 1.2
        )::INTEGER AS excellent,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 1.0
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 1.2
        )::INTEGER AS good,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 0.8
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 1.0
        )::INTEGER AS average,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 0.8
        )::INTEGER AS weak
      FROM current_ranked AS cr
      CROSS JOIN team_avg AS ta
    ),
    month_comparison AS (
      SELECT
        COALESCE((SELECT SUM(total_orders)::INTEGER FROM current_month), 0) AS current_orders,
        COALESCE((SELECT SUM(total_orders)::INTEGER FROM prev_month), 0) AS previous_orders,
        COALESCE((SELECT SUM(active_days)::INTEGER FROM current_month), 0) AS current_active_days,
        COALESCE((SELECT SUM(active_days)::INTEGER FROM prev_month), 0) AS previous_active_days
    ),
    week_comparison AS (
      SELECT
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE date BETWEEN v_week_start AND v_effective_end
        ), 0) AS current_orders,
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE date BETWEEN v_prev_week_start AND v_prev_week_end
        ), 0) AS previous_orders
    ),
    daily_trend AS (
      SELECT
        date::TEXT AS date,
        SUM(total_orders)::INTEGER AS orders
      FROM public.v_rider_daily_performance
      WHERE date BETWEEN v_start AND v_effective_end
      GROUP BY date
      ORDER BY date
    ),
    monthly_trend AS (
      SELECT
        ms.month_year,
        COALESCE(SUM(mp.total_orders), 0)::INTEGER AS total_orders,
        COUNT(*) FILTER (WHERE COALESCE(mp.total_orders, 0) > 0)::INTEGER AS active_riders,
        ROUND(
          COALESCE(SUM(mp.total_orders), 0)::NUMERIC
          / NULLIF(COUNT(*) FILTER (WHERE COALESCE(mp.total_orders, 0) > 0), 0),
          2
        ) AS avg_orders_per_rider
      FROM (
        SELECT to_char((v_start - (gs * INTERVAL '1 month'))::DATE, 'YYYY-MM') AS month_year
        FROM generate_series(5, 0, -1) AS gs
      ) AS ms
      LEFT JOIN public.v_rider_monthly_performance AS mp
        ON mp.month_year = ms.month_year
      GROUP BY ms.month_year
      ORDER BY ms.month_year
    ),
    alerts_source AS (
      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'declining'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.prev_total_orders >= 50
        AND cr.growth_pct <= -20

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'inactive_recently'::TEXT AS alert_type,
        'high'::TEXT AS severity,
        1 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.total_orders > 0
        AND cr.last_active_date IS NOT NULL
        AND cr.last_active_date <= (v_effective_end - INTERVAL '3 day')::DATE

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'below_target'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.monthly_target_orders > 0
        AND cr.target_achievement_pct < 70

      UNION ALL

      SELECT
        cr.employee_id,
        cr.employee_name,
        cr.total_orders,
        cr.active_days,
        cr.growth_pct,
        cr.last_active_date,
        cr.target_achievement_pct,
        cr.consistency_ratio,
        'low_consistency'::TEXT AS alert_type,
        'medium'::TEXT AS severity,
        2 AS severity_rank
      FROM current_ranked AS cr
      WHERE cr.active_days >= 8
        AND cr.consistency_ratio < 0.5
    )
    SELECT jsonb_build_object(
      'summary', jsonb_build_object(
        'totalRiders', (SELECT COUNT(*) FROM current_month),
        'activeRiders', (SELECT COUNT(*) FILTER (WHERE total_orders > 0) FROM current_month),
        'totalOrders', (SELECT COALESCE(SUM(total_orders), 0)::INTEGER FROM current_month),
        'avgOrdersPerRider', (SELECT COALESCE(ROUND(AVG(total_orders)::NUMERIC, 2), 0) FROM current_month WHERE total_orders > 0),
        'monthYear', p_month_year,
        'today', p_today,
        'effectiveEndDate', v_effective_end
      ),
      'targets', (
        SELECT jsonb_build_object(
          'totalTargetOrders', COALESCE(SUM(target_orders), 0)::INTEGER,
          'targetAchievementPct',
            CASE
              WHEN COALESCE(SUM(target_orders), 0) > 0 THEN
                ROUND((
                  COALESCE((SELECT SUM(total_orders)::INTEGER FROM current_month), 0)::NUMERIC
                  / COALESCE(SUM(target_orders), 0)::NUMERIC
                ) * 100, 2)
              ELSE 0
            END
        )
        FROM public.app_targets
        WHERE month_year = p_month_year
      ),
      'performanceDistribution', (SELECT row_to_json(pd) FROM performance_distribution pd),
      'monthComparison', (SELECT row_to_json(mc) FROM month_comparison mc),
      'weekComparison', (SELECT row_to_json(wc) FROM week_comparison wc),
      'riderLeaderboard', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employeeId', cr.employee_id,
            'employeeName', cr.employee_name,
            'city', cr.city,
            'totalOrders', cr.total_orders,
            'activeDays', cr.active_days,
            'avgOrdersPerDay', cr.avg_orders_per_day,
            'consistencyDays', cr.consistency_days,
            'consistencyRatio', cr.consistency_ratio,
            'bestDayOrders', cr.best_day_orders,
            'lastActiveDate', cr.last_active_date,
            'monthlyTargetOrders', cr.monthly_target_orders,
            'dailyTargetOrders', cr.daily_target_orders,
            'targetAchievementPct', cr.target_achievement_pct,
            'rankPosition', cr.rank_position,
            'prevTotalOrders', cr.prev_total_orders,
            'prevActiveDays', cr.prev_active_days,
            'prevAvgOrdersPerDay', cr.prev_avg_orders_per_day,
            'growthPct', cr.growth_pct,
            'trendCode', cr.trend_code
          )
          ORDER BY cr.rank_position
        )
        FROM current_ranked AS cr
      ), '[]'::jsonb),
      'topRiderToday', (
        SELECT row_to_json(cdr)
        FROM current_day_ranked AS cdr
        WHERE cdr.top_rank = 1
        LIMIT 1
      ),
      'lowestRiderToday', (
        SELECT row_to_json(cdr)
        FROM current_day_ranked AS cdr
        WHERE cdr.low_rank = 1
          AND cdr.total_orders > 0
        LIMIT 1
      ),
      'appComparison', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', ac.app_id,
            'appName', ac.app_name,
            'brandColor', ac.brand_color,
            'textColor', ac.text_color,
            'totalOrders', ac.total_orders,
            'riderCount', ac.rider_count,
            'targetOrders', ac.target_orders,
            'previousOrders', ac.previous_orders,
            'growthPct', ac.growth_pct,
            'targetAchievementPct', ac.target_achievement_pct
          )
          ORDER BY ac.total_orders DESC
        )
        FROM app_comparison AS ac
      ), '[]'::jsonb),
      'ordersByCity', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('city', obc.city, 'orders', obc.orders)
          ORDER BY obc.orders DESC
        )
        FROM orders_by_city AS obc
      ), '[]'::jsonb),
      'dailyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object('date', dt.date, 'orders', dt.orders)
          ORDER BY dt.date
        )
        FROM daily_trend AS dt
      ), '[]'::jsonb),
      'monthlyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'monthYear', mt.month_year,
            'totalOrders', mt.total_orders,
            'activeRiders', mt.active_riders,
            'avgOrdersPerRider', mt.avg_orders_per_rider
          )
          ORDER BY mt.month_year
        )
        FROM monthly_trend AS mt
      ), '[]'::jsonb),
      'alerts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'alertType', alert_type,
            'severity', severity,
            'totalOrders', total_orders,
            'activeDays', active_days,
            'growthPct', growth_pct,
            'lastActiveDate', last_active_date,
            'targetAchievementPct', target_achievement_pct,
            'consistencyRatio', consistency_ratio
          )
          ORDER BY severity_rank ASC, total_orders DESC, employee_name
        )
        FROM (
          SELECT *
          FROM alerts_source
          ORDER BY severity_rank ASC, total_orders DESC, employee_name
          LIMIT 12
        ) AS ranked_alerts
      ), '[]'::jsonb)
    )
  );
END;
$$;

-- Restore permissions
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) TO authenticated, service_role;

GRANT SELECT ON public.v_rider_monthly_performance TO authenticated;
GRANT SELECT ON public.v_rider_daily_performance TO authenticated;
GRANT SELECT ON public.v_rider_daily_platform_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
