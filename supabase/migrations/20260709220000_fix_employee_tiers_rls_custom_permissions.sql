-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Fix: employee_tiers SELECT policy now respects user_permissions overrides
--
-- Problem: The unified_select_policy only allows admin/hr roles to read rows.
--          Users with a custom can_view=true entry in user_permissions could
--          NOT see any rows despite the frontend granting them page access.
--
-- Solution: Extend SELECT USING clause to also allow users who have an explicit
--           can_view=true record in public.user_permissions for 'employee_tiers'.
--           INSERT / UPDATE / DELETE remain restricted to admin/hr only.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_tiers";

CREATE POLICY "unified_select_policy" ON public."employee_tiers"
  FOR SELECT
  USING (
    is_active_user(auth.uid())
    AND (
      -- default: admin or hr roles can always read
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      -- custom override: user has explicit can_view permission for this page
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id       = auth.uid()
          AND up.permission_key = 'employee_tiers'
          AND up.can_view       = true
      )
    )
  );
