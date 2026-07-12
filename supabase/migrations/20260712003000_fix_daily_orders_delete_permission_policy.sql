-- Ensure frontend-managed orders permissions are enough to delete daily_orders.
-- Some users can edit orders from the UI but were blocked by the old DELETE RLS
-- branch if their legacy role/internal-user metadata did not line up.

DROP POLICY IF EXISTS "unified_delete_policy" ON public."daily_orders";

CREATE POLICY "unified_delete_policy" ON public."daily_orders" FOR DELETE
  USING (
    is_active_user(auth.uid())
    AND (
      (
        employee_in_my_company(employee_id)
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'hr'::app_role)
          OR has_role(auth.uid(), 'operations'::app_role)
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.permission_key = 'orders'
          AND (up.can_delete = true OR up.can_edit = true)
      )
    )
  );
