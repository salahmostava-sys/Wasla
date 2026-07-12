-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Fix: employee_tiers INSERT/UPDATE/DELETE policies now respect user_permissions
--
-- Problem: Custom user permissions (can_edit, can_delete) were not respected 
--          by the backend RLS policies for employee_tiers.
--
-- Solution: Add EXISTS checks against public.user_permissions for CUD operations.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_tiers";
CREATE POLICY "unified_insert_policy" ON public."employee_tiers"
  FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.permission_key = 'employee_tiers'
          AND up.can_edit = true
      )
    )
  );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_tiers";
CREATE POLICY "unified_update_policy" ON public."employee_tiers"
  FOR UPDATE
  USING (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.permission_key = 'employee_tiers'
          AND up.can_edit = true
      )
    )
  );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_tiers";
CREATE POLICY "unified_delete_policy" ON public."employee_tiers"
  FOR DELETE
  USING (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.permission_key = 'employee_tiers'
          AND up.can_delete = true
      )
    )
  );
