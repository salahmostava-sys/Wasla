-- Consolidates 6 separate existence checks (daily_orders, advances, attendance,
-- vehicle_assignments, platform_accounts, salary_records) into a single RPC call,
-- eliminating N+1 round-trips when guarding employee deletion.
CREATE OR REPLACE FUNCTION public.check_employee_operational_records(p_employee_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.daily_orders        WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.advances            WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.attendance          WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.vehicle_assignments WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.platform_accounts   WHERE employee_id = p_employee_id
    UNION ALL
    SELECT 1 FROM public.salary_records      WHERE employee_id = p_employee_id
  );
$$;
