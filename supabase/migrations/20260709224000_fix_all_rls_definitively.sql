-- Definitive fix for CUD policies for employees, employee_apps, and employee_tiers
-- This ensures operations role has full access, AND user_permissions works correctly.
-- We use is_active_user instead of is_internal_user to prevent failures if user_roles is empty.

-- 1. employee_apps
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employee_apps;
CREATE POLICY "unified_insert_policy" ON public.employee_apps FOR INSERT
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps', 'employee_apps')
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
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps', 'employee_apps')
        AND up.can_edit = true
    )
  )
)
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps', 'employee_apps')
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
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key IN ('employees', 'apps', 'employee_apps')
        AND up.can_edit = true
    )
  )
);

-- 2. employees
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employees;
CREATE POLICY "unified_insert_policy" ON public.employees FOR INSERT
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
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
    OR has_role(auth.uid(), 'operations'::app_role)
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
    OR has_role(auth.uid(), 'operations'::app_role)
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
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employees'
        AND up.can_delete = true
    )
  )
);

-- 3. employee_tiers
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employee_tiers;
CREATE POLICY "unified_insert_policy" ON public.employee_tiers FOR INSERT
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employee_tiers'
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_update_policy" ON public.employee_tiers;
CREATE POLICY "unified_update_policy" ON public.employee_tiers FOR UPDATE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employee_tiers'
        AND up.can_edit = true
    )
  )
)
WITH CHECK (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employee_tiers'
        AND up.can_edit = true
    )
  )
);

DROP POLICY IF EXISTS "unified_delete_policy" ON public.employee_tiers;
CREATE POLICY "unified_delete_policy" ON public.employee_tiers FOR DELETE
USING (
  is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'employee_tiers'
        AND up.can_delete = true
    )
  )
);
