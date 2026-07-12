-- Fix RLS policies for daily_orders to use 'work_orders' instead of 'orders' for internal users

DROP POLICY IF EXISTS "unified_insert_policy" ON public."daily_orders";
CREATE POLICY "unified_insert_policy" ON public."daily_orders" FOR INSERT
  WITH CHECK (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    (is_internal_user() AND has_permission('work_orders'::text, 'write'::text)))
  );

DROP POLICY IF EXISTS "unified_select_policy" ON public."daily_orders";
CREATE POLICY "unified_select_policy" ON public."daily_orders" FOR SELECT
  USING (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    ((is_internal_user() AND has_permission('work_orders'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))))
  );

DROP POLICY IF EXISTS "unified_update_policy" ON public."daily_orders";
CREATE POLICY "unified_update_policy" ON public."daily_orders" FOR UPDATE
  USING (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    (is_internal_user() AND has_permission('work_orders'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    (is_internal_user() AND has_permission('work_orders'::text, 'write'::text)))
  );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."daily_orders";
CREATE POLICY "unified_delete_policy" ON public."daily_orders" FOR DELETE
  USING (
    ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) 
    OR 
    (is_internal_user() AND (has_permission('work_orders'::text, 'delete'::text) OR has_permission('work_orders'::text, 'write'::text))))
  );
