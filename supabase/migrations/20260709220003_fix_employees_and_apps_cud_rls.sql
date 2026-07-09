-- Fix CUD RLS policies for employees and employee_apps to respect custom user_permissions

-- 1. employees
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employees;
CREATE POLICY "unified_insert_policy" ON public.employees FOR INSERT
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employees'
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_update_policy" ON public.employees;
CREATE POLICY "unified_update_policy" ON public.employees FOR UPDATE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employees'
        AND up.can_edit = true
    )
  )
)
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employees'
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_delete_policy" ON public.employees;
CREATE POLICY "unified_delete_policy" ON public.employees FOR DELETE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employees'
        AND up.can_delete = true
    )
  )
);

-- 2. employee_apps
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employee_apps;
CREATE POLICY "unified_insert_policy" ON public.employee_apps FOR INSERT
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_update_policy" ON public.employee_apps;
CREATE POLICY "unified_update_policy" ON public.employee_apps FOR UPDATE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
)
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_delete_policy" ON public.employee_apps;
CREATE POLICY "unified_delete_policy" ON public.employee_apps FOR DELETE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps')
        AND up.can_delete = true
    )
  )
);
