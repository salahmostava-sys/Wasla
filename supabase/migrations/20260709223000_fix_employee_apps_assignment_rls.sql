-- Fix employee app assignment RLS.
--
-- Managing rows in employee_apps is an edit to an employee's app assignments,
-- not an employee delete operation. The UI allows this from the Employees page
-- when the user can edit employees, so INSERT/UPDATE/DELETE must follow that
-- same backend permission model.

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_page_edit
  ON public.user_permissions (user_id, permission_key, can_edit);

DROP POLICY IF EXISTS "unified_insert_policy" ON public.employee_apps;
CREATE POLICY "unified_insert_policy"
ON public.employee_apps
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_user()
  AND public.employee_in_my_company(employee_id)
  AND (
    public.has_permission('employees', 'write')
    OR public.has_permission('apps', 'write')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_update_policy" ON public.employee_apps;
CREATE POLICY "unified_update_policy"
ON public.employee_apps
FOR UPDATE
TO authenticated
USING (
  public.is_internal_user()
  AND public.employee_in_my_company(employee_id)
  AND (
    public.has_permission('employees', 'write')
    OR public.has_permission('apps', 'write')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
)
WITH CHECK (
  public.is_internal_user()
  AND public.employee_in_my_company(employee_id)
  AND (
    public.has_permission('employees', 'write')
    OR public.has_permission('apps', 'write')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_delete_policy" ON public.employee_apps;
CREATE POLICY "unified_delete_policy"
ON public.employee_apps
FOR DELETE
TO authenticated
USING (
  public.is_internal_user()
  AND public.employee_in_my_company(employee_id)
  AND (
    public.has_permission('employees', 'write')
    OR public.has_permission('apps', 'write')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
);
