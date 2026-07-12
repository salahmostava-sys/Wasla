BEGIN;

CREATE OR REPLACE FUNCTION public._const_dashboard_month_format() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''YYYY-MM''::TEXT;';

CREATE OR REPLACE FUNCTION public._const_dashboard_date_format() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''YYYY-MM-DD''::TEXT;';

CREATE OR REPLACE FUNCTION public._const_dashboard_month_start_suffix() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''-01''::TEXT;';

CREATE OR REPLACE FUNCTION public._const_dashboard_one_month() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT INTERVAL ''1 month'';';

CREATE OR REPLACE FUNCTION public._const_dashboard_one_day() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT INTERVAL ''1 day'';';

CREATE OR REPLACE FUNCTION public._const_dashboard_six_days() RETURNS INTERVAL
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT INTERVAL ''6 day'';';

CREATE OR REPLACE FUNCTION public._const_dashboard_text_color_default() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''#ffffff''::TEXT;'; /* NOSONAR */

CREATE OR REPLACE FUNCTION public._const_dashboard_trend_stable() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''stable''::TEXT;';

CREATE OR REPLACE FUNCTION public._const_dashboard_alert_high() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''high''::TEXT;';

CREATE OR REPLACE FUNCTION public._const_dashboard_alert_medium() RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO public AS
'SELECT ''medium''::TEXT;';

CREATE INDEX IF NOT EXISTS idx_daily_orders_perf_date_employee
  ON public.daily_orders(date, employee_id, app_id)
  WHERE orders_count > 0;

CREATE INDEX IF NOT EXISTS idx_daily_orders_perf_employee_date
  ON public.daily_orders(employee_id, date)
  WHERE orders_count > 0;

CREATE INDEX IF NOT EXISTS idx_salary_records_month_employee
  ON public.salary_records(month_year, employee_id);

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

  v_start := to_date(p_month_year || public._const_dashboard_month_start_suffix(), public._const_dashboard_date_format());
  v_end := (v_start + public._const_dashboard_one_month() - public._const_dashboard_one_day())::DATE;
  v_effective_end := LEAST(COALESCE(p_today, CURRENT_DATE), v_end);
  v_prev_month := to_char((v_start - public._const_dashboard_one_month())::DATE, public._const_dashboard_month_format());
  v_week_start := (v_effective_end - public._const_dashboard_six_days())::DATE;
  v_prev_week_end := (v_week_start - public._const_dashboard_one_day())::DATE;
  v_prev_week_start := (v_prev_week_end - public._const_dashboard_six_days())::DATE;

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
          ELSE public._const_dashboard_trend_stable()
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
        COALESCE(a.text_color, public._const_dashboard_text_color_default()) AS text_color
      FROM public.apps AS a
      WHERE a.is_active IS TRUE
    ),
    orders_by_app AS (
      SELECT
        p.app_id,
        MAX(p.app_name) AS app_name,
        MAX(p.brand_color) AS brand_color,
        COALESCE(MAX(am.text_color), public._const_dashboard_text_color_default()) AS text_color,
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
      WHERE p.date BETWEEN (v_start - public._const_dashboard_one_month())::DATE AND (v_start - public._const_dashboard_one_day())::DATE
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
        SELECT to_char((v_start - (gs * public._const_dashboard_one_month()))::DATE, public._const_dashboard_month_format()) AS month_year
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
        public._const_dashboard_alert_high() AS severity,
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
        public._const_dashboard_alert_high() AS severity,
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
        public._const_dashboard_alert_medium() AS severity,
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
        public._const_dashboard_alert_medium() AS severity,
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
            _const_work_orders(), total_orders,
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
            _const_work_orders(), orders
          )
          ORDER BY orders DESC, city
        )
        FROM orders_by_city
      ), '[]'::jsonb),
      'dailyTrend', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', date,
            _const_work_orders(), orders
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

COMMENT ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) IS
'Single backend source for dashboard KPIs, comparisons, rankings, alerts, and performance trends.';

REVOKE EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(TEXT, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.rider_profile_performance_rpc(
  p_employee_id UUID,
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

  v_start := to_date(p_month_year || public._const_dashboard_month_start_suffix(), public._const_dashboard_date_format());
  v_end := (v_start + public._const_dashboard_one_month() - public._const_dashboard_one_day())::DATE;
  v_effective_end := LEAST(COALESCE(p_today, CURRENT_DATE), v_end);
  v_prev_month := to_char((v_start - public._const_dashboard_one_month())::DATE, public._const_dashboard_month_format());
  v_week_start := (v_effective_end - public._const_dashboard_six_days())::DATE;
  v_prev_week_end := (v_week_start - public._const_dashboard_one_day())::DATE;
  v_prev_week_start := (v_prev_week_end - public._const_dashboard_six_days())::DATE;

  RETURN (
    WITH employee_base AS (
      SELECT
        e.id,
        e.name,
        e.phone,
        e.city,
        e.join_date
      FROM public.employees AS e
      WHERE e.id = p_employee_id
    ),
    employee_platforms AS (
      SELECT
        a.id AS app_id,
        a.name AS app_name,
        COALESCE(a.brand_color, '#2563eb') AS brand_color,
        ea.status
      FROM public.employee_apps AS ea
      JOIN public.apps AS a
        ON a.id = ea.app_id
      WHERE ea.employee_id = p_employee_id
      ORDER BY a.name
    ),
    current_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    prev_month AS MATERIALIZED (
      SELECT *
      FROM public.v_rider_monthly_performance
      WHERE employee_id = p_employee_id
        AND month_year = v_prev_month
      LIMIT 1
    ),
    current_rank AS (
      SELECT
        ranked.employee_id,
        ranked.rank_position,
        ranked.total_riders
      FROM (
        SELECT
          employee_id,
          ROW_NUMBER() OVER (
            ORDER BY total_orders DESC, avg_orders_per_day DESC, employee_name
          ) AS rank_position,
          COUNT(*) OVER () AS total_riders
        FROM public.v_rider_monthly_performance
        WHERE month_year = p_month_year
      ) AS ranked
      WHERE ranked.employee_id = p_employee_id
    ),
    employee_target AS (
      SELECT
        monthly_target_orders,
        daily_target_orders
      FROM public.employee_targets
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    monthly_series AS (
      SELECT to_char((v_start - (gs * public._const_dashboard_one_month()))::DATE, public._const_dashboard_month_format()) AS month_year
      FROM generate_series(2, 0, -1) AS gs
    ),
    last_three_months AS (
      SELECT
        ms.month_year,
        COALESCE(mp.total_orders, 0)::INTEGER AS total_orders,
        COALESCE(mp.avg_orders_per_day, 0) AS avg_orders_per_day,
        COALESCE(mp.active_days, 0)::INTEGER AS active_days,
        COALESCE(mp.consistency_ratio, 0) AS consistency_ratio,
        COALESCE(mp.target_achievement_pct, 0) AS target_achievement_pct
      FROM monthly_series AS ms
      LEFT JOIN public.v_rider_monthly_performance AS mp
        ON mp.employee_id = p_employee_id
       AND mp.month_year = ms.month_year
      ORDER BY ms.month_year
    ),
    recent_daily_orders AS (
      SELECT
        d.date::TEXT AS date,
        d.total_orders
      FROM public.v_rider_daily_performance AS d
      WHERE d.employee_id = p_employee_id
        AND d.date BETWEEN GREATEST(v_start, (v_effective_end - INTERVAL '20 day')::DATE) AND v_effective_end
      ORDER BY d.date
    ),
    platform_breakdown AS (
      SELECT
        p.app_id,
        MAX(p.app_name) AS app_name,
        MAX(p.brand_color) AS brand_color,
        SUM(p.total_orders)::INTEGER AS total_orders
      FROM public.v_rider_daily_platform_orders AS p
      WHERE p.employee_id = p_employee_id
        AND p.date BETWEEN v_start AND v_effective_end
      GROUP BY p.app_id
      ORDER BY total_orders DESC, app_name
    ),
    week_comparison AS (
      SELECT
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE employee_id = p_employee_id
            AND date BETWEEN v_week_start AND v_effective_end
        ), 0) AS current_orders,
        COALESCE((
          SELECT SUM(total_orders)::INTEGER
          FROM public.v_rider_daily_performance
          WHERE employee_id = p_employee_id
            AND date BETWEEN v_prev_week_start AND v_prev_week_end
        ), 0) AS previous_orders
    ),
    salary_snapshot AS (
      SELECT
        base_salary,
        allowances,
        advance_deduction,
        external_deduction,
        manual_deduction,
        attendance_deduction,
        net_salary,
        is_approved,
        payment_method
      FROM public.salary_records
      WHERE employee_id = p_employee_id
        AND month_year = p_month_year
      LIMIT 1
    ),
    derived_metrics AS (
      SELECT
        COALESCE((SELECT total_orders FROM current_month), 0)::INTEGER AS current_orders,
        COALESCE((SELECT total_orders FROM prev_month), 0)::INTEGER AS previous_orders,
        COALESCE((SELECT active_days FROM current_month), 0)::INTEGER AS current_active_days,
        COALESCE((SELECT active_days FROM prev_month), 0)::INTEGER AS previous_active_days,
        COALESCE((SELECT avg_orders_per_day FROM current_month), 0) AS current_avg_orders_per_day,
        COALESCE((SELECT avg_orders_per_day FROM prev_month), 0) AS previous_avg_orders_per_day,
        COALESCE((SELECT consistency_ratio FROM current_month), 0) AS current_consistency_ratio,
        COALESCE((SELECT target_achievement_pct FROM current_month), 0) AS current_target_achievement_pct,
        COALESCE((SELECT monthly_target_orders FROM current_month), (SELECT monthly_target_orders FROM employee_target), 0)::INTEGER AS current_monthly_target_orders,
        COALESCE((SELECT daily_target_orders FROM current_month), (SELECT daily_target_orders FROM employee_target), 0)::INTEGER AS current_daily_target_orders,
        COALESCE((SELECT last_active_date FROM current_month), NULL) AS last_active_date
    ),
    alerts_source AS (
      SELECT
        'declining'::TEXT AS alert_type,
        public._const_dashboard_alert_high() AS severity,
        1 AS severity_rank
      FROM derived_metrics
      WHERE previous_orders >= 30
        AND (
          CASE
            WHEN previous_orders > 0 THEN ((current_orders - previous_orders)::NUMERIC / previous_orders::NUMERIC) * 100
            WHEN current_orders > 0 THEN 100
            ELSE 0
          END
        ) <= -20

      UNION ALL

      SELECT
        'inactive_recently'::TEXT AS alert_type,
        public._const_dashboard_alert_high() AS severity,
        1 AS severity_rank
      FROM derived_metrics
      WHERE current_orders > 0
        AND last_active_date IS NOT NULL
        AND last_active_date <= (v_effective_end - INTERVAL '3 day')::DATE

      UNION ALL

      SELECT
        'below_target'::TEXT AS alert_type,
        public._const_dashboard_alert_medium() AS severity,
        2 AS severity_rank
      FROM derived_metrics
      WHERE current_monthly_target_orders > 0
        AND current_target_achievement_pct < 70

      UNION ALL

      SELECT
        'low_consistency'::TEXT AS alert_type,
        public._const_dashboard_alert_medium() AS severity,
        2 AS severity_rank
      FROM derived_metrics
      WHERE current_active_days >= 8
        AND current_consistency_ratio < 0.5
    ),
    judgment AS (
      SELECT
        CASE
          WHEN dm.current_orders = 0 THEN 'inactive'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) >= 10
            AND dm.current_consistency_ratio >= 0.65 THEN 'excellent_stable'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) <= -10 THEN 'declining'
          WHEN dm.current_monthly_target_orders > 0
            AND dm.current_target_achievement_pct < 60 THEN 'below_target'
          WHEN dm.current_consistency_ratio >= 0.7 THEN public._const_dashboard_trend_stable()
          ELSE 'average'
        END AS judgment_code,
        CASE
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) >= 5 THEN 'up'
          WHEN dm.previous_orders > 0
            AND (((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100) <= -5 THEN 'down'
          ELSE public._const_dashboard_trend_stable()
        END AS trend_code
      FROM derived_metrics AS dm
    )
    SELECT jsonb_build_object(
      'monthYear', p_month_year,
      'effectiveEndDate', v_effective_end::TEXT,
      'employee', (
        SELECT jsonb_build_object(
          'employeeId', eb.id,
          'employeeName', eb.name,
          'phone', eb.phone,
          'city', eb.city,
          'joinDate', eb.join_date
        )
        FROM employee_base AS eb
      ),
      'summary', (
        SELECT jsonb_build_object(
          'totalOrders', dm.current_orders,
          'avgOrdersPerDay', dm.current_avg_orders_per_day,
          'activeDays', dm.current_active_days,
          'consistencyRatio', dm.current_consistency_ratio,
          'monthlyTargetOrders', dm.current_monthly_target_orders,
          'dailyTargetOrders', dm.current_daily_target_orders,
          'targetAchievementPct', dm.current_target_achievement_pct,
          'rank', COALESCE((SELECT rank_position FROM current_rank), 0),
          'rankOutOf', COALESCE((SELECT total_riders FROM current_rank), 0),
          'lastActiveDate', dm.last_active_date
        )
        FROM derived_metrics AS dm
      ),
      'comparison', jsonb_build_object(
        'month', (
          SELECT jsonb_build_object(
            'currentOrders', dm.current_orders,
            'previousOrders', dm.previous_orders,
            'growthPct',
              CASE
                WHEN dm.previous_orders > 0 THEN ROUND(((dm.current_orders - dm.previous_orders)::NUMERIC / dm.previous_orders::NUMERIC) * 100, 2)
                WHEN dm.current_orders > 0 THEN 100
                ELSE 0
              END,
            'currentAvgOrdersPerDay', dm.current_avg_orders_per_day,
            'previousAvgOrdersPerDay', dm.previous_avg_orders_per_day,
            'avgGrowthPct',
              CASE
                WHEN dm.previous_avg_orders_per_day > 0 THEN ROUND(((dm.current_avg_orders_per_day - dm.previous_avg_orders_per_day) / dm.previous_avg_orders_per_day) * 100, 2)
                WHEN dm.current_avg_orders_per_day > 0 THEN 100
                ELSE 0
              END,
            'currentActiveDays', dm.current_active_days,
            'previousActiveDays', dm.previous_active_days,
            'activeDaysDelta', dm.current_active_days - dm.previous_active_days
          )
          FROM derived_metrics AS dm
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
      'platforms', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', ep.app_id,
            'appName', ep.app_name,
            'brandColor', ep.brand_color,
            'status', ep.status
          )
          ORDER BY ep.app_name
        )
        FROM employee_platforms AS ep
      ), '[]'::jsonb),
      'platformBreakdown', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', pb.app_id,
            'appName', pb.app_name,
            'brandColor', pb.brand_color,
            _const_work_orders(), pb.total_orders
          )
          ORDER BY pb.total_orders DESC, pb.app_name
        )
        FROM platform_breakdown AS pb
      ), '[]'::jsonb),
      'recentDailyOrders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', rdo.date,
            _const_work_orders(), rdo.total_orders
          )
          ORDER BY rdo.date
        )
        FROM recent_daily_orders AS rdo
      ), '[]'::jsonb),
      'lastThreeMonths', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'monthYear', month_year,
            'totalOrders', total_orders,
            'avgOrdersPerDay', avg_orders_per_day,
            'activeDays', active_days,
            'consistencyRatio', consistency_ratio,
            'targetAchievementPct', target_achievement_pct
          )
          ORDER BY month_year
        )
        FROM last_three_months
      ), '[]'::jsonb),
      'trend', (
        SELECT jsonb_build_object(
          'trendCode', j.trend_code,
          'judgmentCode', j.judgment_code
        )
        FROM judgment AS j
      ),
      'alerts', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'alertType', alert_type,
            'severity', severity
          )
          ORDER BY severity_rank, alert_type
        )
        FROM alerts_source
      ), '[]'::jsonb),
      'salary', (
        SELECT jsonb_build_object(
          'baseSalary', COALESCE(ss.base_salary, 0),
          'allowances', COALESCE(ss.allowances, 0),
          'attendanceDeduction', COALESCE(ss.attendance_deduction, 0),
          'advanceDeduction', COALESCE(ss.advance_deduction, 0),
          'externalDeduction', COALESCE(ss.external_deduction, 0),
          'manualDeduction', COALESCE(ss.manual_deduction, 0),
          'netSalary', COALESCE(ss.net_salary, 0),
          'isApproved', COALESCE(ss.is_approved, false),
          'paymentMethod', ss.payment_method
        )
        FROM salary_snapshot AS ss
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.rider_profile_performance_rpc(UUID, TEXT, DATE) IS
'Single backend source for rider profile performance, comparisons, targets, alerts, and salary snapshot.';

REVOKE EXECUTE ON FUNCTION public.rider_profile_performance_rpc(UUID, TEXT, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.rider_profile_performance_rpc(UUID, TEXT, DATE) TO authenticated;

COMMIT;
