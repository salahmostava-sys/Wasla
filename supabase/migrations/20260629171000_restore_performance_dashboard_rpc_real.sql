-- ============================================================
-- FIX: Restore original performance_dashboard_rpc shape
-- ============================================================
-- The previous fix altered the return shape of the RPC, causing frontend crashes.
-- This migration restores the exact original shape but keeps the permissions fix.

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
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 0.8
        )::INTEGER AS weak,
        COUNT(*) FILTER (
          WHERE cr.total_orders > 0
            AND cr.total_orders >= COALESCE(ta.avg_total_orders, 0) * 0.8
            AND cr.total_orders < COALESCE(ta.avg_total_orders, 0) * 1.2
        )::INTEGER AS average
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
    active_employees AS (
      SELECT COUNT(*)::INTEGER AS total
      FROM public.employees
      WHERE status = _const_employee_active()
    ),
    targets_summary AS (
      SELECT
        COALESCE(SUM(target_orders), 0)::INTEGER AS total_target_orders
      FROM public.app_targets
      WHERE month_year = p_month_year
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
      'monthYear', p_month_year,
      'effectiveEndDate', v_effective_end::TEXT,
      'leaderboardDate', COALESCE((SELECT date::TEXT FROM leaderboard_date), v_effective_end::TEXT),
      'summary', jsonb_build_object(
        'totalOrders', COALESCE((SELECT current_orders FROM month_comparison), 0),
        'activeRiders', COALESCE((SELECT COUNT(*)::INTEGER FROM current_month WHERE total_orders > 0), 0),
        'activeEmployees', COALESCE((SELECT total FROM active_employees), 0),
        'avgOrdersPerRider', COALESCE((
          SELECT ROUND(
            COALESCE((SELECT current_orders FROM month_comparison), 0)::NUMERIC
            / NULLIF((SELECT COUNT(*)::INTEGER FROM current_month WHERE total_orders > 0), 0),
            2
          )
        ), 0),
        'topPerformerToday', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_day_ranked
          WHERE top_rank = 1
        ),
        'lowPerformerToday', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_day_ranked
          WHERE low_rank = 1
        ),
        'topPerformerMonth', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders,
            'rank', rank_position
          )
          FROM current_ranked
          WHERE rank_position = 1
        ),
        'lowPerformerMonth', (
          SELECT jsonb_build_object(
            'employeeId', employee_id,
            'employeeName', employee_name,
            'totalOrders', total_orders
          )
          FROM current_ranked
          WHERE total_orders > 0
          ORDER BY total_orders ASC, employee_name
          LIMIT 1
        )
      ),
      'comparison', jsonb_build_object(
        'month', (
          SELECT jsonb_build_object(
            'currentOrders', current_orders,
            'previousOrders', previous_orders,
            'growthPct',
              CASE
                WHEN previous_orders > 0 THEN ROUND(((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100, 2)
                WHEN current_orders > 0 THEN 100
                ELSE 0
              END,
            'currentActiveDays', current_active_days,
            'previousActiveDays', previous_active_days,
            'activeDaysDelta', current_active_days - previous_active_days
          )
          FROM month_comparison
        ),
        'week', (
          SELECT jsonb_build_object(
            'currentOrders', current_orders,
            'previousOrders', previous_orders,
            'growthPct',
              CASE
                WHEN previous_orders > 0 THEN ROUND(((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100, 2)
                WHEN current_orders > 0 THEN 100
                ELSE 0
              END
          )
          FROM week_comparison
        )
      ),
      'targets', (
        SELECT jsonb_build_object(
          'totalTargetOrders', total_target_orders,
          'targetAchievementPct',
            CASE
              WHEN total_target_orders > 0 THEN
                ROUND((
                  COALESCE((SELECT current_orders FROM month_comparison), 0)::NUMERIC
                  / total_target_orders::NUMERIC
                ) * 100, 2)
              ELSE 0
            END
        )
        FROM targets_summary
      ),
      'distribution', (
        SELECT jsonb_build_object(
          'excellent', excellent,
          'average', average,
          'weak', weak
        )
        FROM performance_distribution
      ),
      'ordersByApp', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', app_id,
            'appName', app_name,
            'brandColor', brand_color,
            'textColor', text_color,
            _const_work_orders()::TEXT, total_orders,
            'riders', rider_count,
            'targetOrders', target_orders,
            'targetAchievementPct', target_achievement_pct,
            'previousOrders', previous_orders,
            'growthPct', growth_pct
          )
          ORDER BY total_orders DESC, app_name
        )
        FROM app_comparison
      ), '[]'::jsonb),
      'ordersByCity', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'city', city,
            _const_work_orders()::TEXT, orders
          )
          ORDER BY orders DESC, city
        )
        FROM orders_by_city
      ), '[]'::jsonb),
      'dailyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', date,
            _const_work_orders()::TEXT, orders
          )
          ORDER BY date
        )
        FROM daily_trend
      ), '[]'::jsonb),
      'monthlyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'monthYear', month_year,
            'totalOrders', total_orders,
            'activeRiders', active_riders,
            'avgOrdersPerRider', COALESCE(avg_orders_per_rider, 0)
          )
          ORDER BY month_year
        )
        FROM monthly_trend
      ), '[]'::jsonb),
      'rankings', jsonb_build_object(
        'topPerformers', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY rank_position
          )
          FROM (
            SELECT *
            FROM current_ranked
            ORDER BY rank_position
            LIMIT 10
          ) AS ranked_top
        ), '[]'::jsonb),
        'lowPerformers', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY total_orders ASC, employee_name
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE total_orders > 0
            ORDER BY total_orders ASC, employee_name
            LIMIT 10
          ) AS ranked_low
        ), '[]'::jsonb),
        'mostImproved', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY growth_pct DESC, total_orders DESC
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE growth_pct > 0
            ORDER BY growth_pct DESC, total_orders DESC
            LIMIT 10
          ) AS ranked_improved
        ), '[]'::jsonb),
        'mostDeclined', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'employeeId', employee_id,
              'employeeName', employee_name,
              'city', city,
              'totalOrders', total_orders,
              'activeDays', active_days,
              'avgOrdersPerDay', avg_orders_per_day,
              'consistencyRatio', consistency_ratio,
              'growthPct', growth_pct,
              'targetAchievementPct', target_achievement_pct,
              'rank', rank_position,
              'trendCode', trend_code
            )
            ORDER BY growth_pct ASC, total_orders ASC
          )
          FROM (
            SELECT *
            FROM current_ranked
            WHERE growth_pct < 0
            ORDER BY growth_pct ASC, total_orders ASC
            LIMIT 10
          ) AS ranked_declined
        ), '[]'::jsonb)
      ),
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

-- Restore permissions correctly
REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
