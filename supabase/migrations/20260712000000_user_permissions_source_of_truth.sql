-- Make per-user permissions the source of truth for database permission checks.
-- Roles remain useful as UI templates and compatibility metadata, but this
-- function no longer grants access from hardcoded role matrices.

CREATE OR REPLACE FUNCTION public._permission_resource_key(p_resource text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_resource
    WHEN 'work_orders' THEN 'orders'
    WHEN 'daily_orders' THEN 'orders'
    WHEN 'salary' THEN 'salaries'
    WHEN 'financials' THEN 'finance'
    WHEN 'roles' THEN 'settings'
    WHEN 'audit' THEN 'settings'
    WHEN 'employee_apps' THEN 'apps'
    ELSE p_resource
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := false;
  v_permission_key text := public._permission_resource_key(p_resource);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN
    RETURN false;
  END IF;

  SELECT CASE
      WHEN p_action = 'view' THEN up.can_view
      WHEN p_action IN ('write', 'edit', 'approve') THEN up.can_edit
      WHEN p_action = 'delete' THEN up.can_delete
      ELSE false
    END
  INTO v_allowed
  FROM public.user_permissions up
  WHERE up.user_id = auth.uid()
    AND up.permission_key = v_permission_key
  LIMIT 1;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public._permission_resource_key(text) FROM public;
GRANT EXECUTE ON FUNCTION public._permission_resource_key(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated, service_role;
