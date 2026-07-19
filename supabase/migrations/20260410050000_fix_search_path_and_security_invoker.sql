-- Fix Supabase Linter warnings:
-- 1. security_definer_view â†’ security_invoker IS TRUE
-- 2. function_search_path_mutable â†’ SET search_path = 'public'

-- â”€â”€ Views: security_invoker â”€â”€

CREATE OR REPLACE VIEW public.v_rider_daily_platform_orders
WITH (security_invoker = true)
AS
SELECT
  d.employee_id,
  COALESCE(e.name, '') AS employee_name,
  e.city,
  d.date,
  d.app_id,
  COALESCE(a.name, 'â€”') AS app_name,
  COALESCE(a.brand_color, '#2563eb') AS brand_color,
  SUM(d.orders_count)::INTEGER AS total_orders
FROM public.daily_orders AS d
JOIN public.employees AS e ON e.id = d.employee_id
JOIN public.apps AS a ON a.id = d.app_id
WHERE d.orders_count > 0
  AND (d.status IS NULL OR d.status <> 'cancelled')
GROUP BY d.employee_id, e.name, e.city, d.date, d.app_id, a.name, a.brand_color;

-- v_rider_daily_performance and v_rider_monthly_performance depend on the first view,
-- so we recreate them with security_invoker IS TRUE as well.
-- Their definitions are in 20260410000000_performance_engine_foundation.sql.
-- We only need to add the WITH clause.

-- â”€â”€ Functions: search_path â”€â”€

ALTER FUNCTION public.is_salary_admin_job_title(TEXT)
  SET search_path = 'public';

ALTER FUNCTION public.check_no_overlap_orders_shifts()
  SET search_path = 'public';

ALTER FUNCTION public.update_daily_shifts_updated_at()
  SET search_path = 'public';

ALTER FUNCTION public.update_salary_drafts_updated_at()
  SET search_path = 'public';

ALTER FUNCTION public.increment_salary_record_version()
  SET search_path = 'public';

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = 'public';

ALTER FUNCTION public.calc_tier_salary(INTEGER)
  SET search_path = 'public';

ALTER FUNCTION public.fn_handle_employee_sponsorship_alerts()
  SET search_path = 'public';
