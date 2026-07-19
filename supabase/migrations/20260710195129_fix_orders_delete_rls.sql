-- Allow users with orders:write permission to also delete from daily_orders
DROP POLICY IF EXISTS "unified_delete_policy" ON public."daily_orders";
CREATE POLICY "unified_delete_policy" ON public."daily_orders" FOR DELETE
  USING (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    (is_internal_user() AND (has_permission('orders'::text, 'delete'::text) OR has_permission('orders'::text, 'write'::text))))
  );
