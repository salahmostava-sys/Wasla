-- Fix ALL remaining RLS policies containing nested auth.uid()

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_tiers";
CREATE POLICY "unified_delete_policy" ON public."employee_tiers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_tiers";
CREATE POLICY "unified_insert_policy" ON public."employee_tiers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_tiers";
CREATE POLICY "unified_select_policy" ON public."employee_tiers" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_tiers";
CREATE POLICY "unified_update_policy" ON public."employee_tiers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."profiles";
CREATE POLICY "unified_delete_policy" ON public."profiles" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."profiles";
CREATE POLICY "unified_insert_policy" ON public."profiles" FOR INSERT
  WITH CHECK ( has_role(auth.uid(), 'admin'::app_role) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."profiles";
CREATE POLICY "unified_select_policy" ON public."profiles" FOR SELECT
  USING ( (is_active_user(auth.uid()) OR (auth.uid() = id)) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."profiles";
CREATE POLICY "unified_update_policy" ON public."profiles" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (auth.uid() = id)) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (auth.uid() = id)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."user_permissions";
CREATE POLICY "unified_delete_policy" ON public."user_permissions" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."user_permissions";
CREATE POLICY "unified_insert_policy" ON public."user_permissions" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."user_permissions";
CREATE POLICY "unified_select_policy" ON public."user_permissions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR ((auth.uid() = user_id) OR (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."user_permissions";
CREATE POLICY "unified_update_policy" ON public."user_permissions" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."hr_performance_reviews";
CREATE POLICY "unified_delete_policy" ON public."hr_performance_reviews" FOR DELETE
  USING ( is_admin_or_hr(auth.uid()) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."hr_performance_reviews";
CREATE POLICY "unified_insert_policy" ON public."hr_performance_reviews" FOR INSERT
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."hr_performance_reviews";
CREATE POLICY "unified_update_policy" ON public."hr_performance_reviews" FOR UPDATE
  USING ( is_admin_or_hr(auth.uid()) )
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."apps";
CREATE POLICY "unified_delete_policy" ON public."apps" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."apps";
CREATE POLICY "unified_insert_policy" ON public."apps" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."apps";
CREATE POLICY "unified_select_policy" ON public."apps" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."apps";
CREATE POLICY "unified_update_policy" ON public."apps" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_scheme_tiers";
CREATE POLICY "unified_delete_policy" ON public."salary_scheme_tiers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_scheme_tiers";
CREATE POLICY "unified_insert_policy" ON public."salary_scheme_tiers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_scheme_tiers";
CREATE POLICY "unified_select_policy" ON public."salary_scheme_tiers" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_scheme_tiers";
CREATE POLICY "unified_update_policy" ON public."salary_scheme_tiers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."trade_registers";
CREATE POLICY "unified_delete_policy" ON public."trade_registers" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."trade_registers";
CREATE POLICY "unified_insert_policy" ON public."trade_registers" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."trade_registers";
CREATE POLICY "unified_select_policy" ON public."trade_registers" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."trade_registers";
CREATE POLICY "unified_update_policy" ON public."trade_registers" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_scheme";
CREATE POLICY "unified_delete_policy" ON public."employee_scheme" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_scheme";
CREATE POLICY "unified_insert_policy" ON public."employee_scheme" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_scheme";
CREATE POLICY "unified_select_policy" ON public."employee_scheme" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_scheme";
CREATE POLICY "unified_update_policy" ON public."employee_scheme" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_apps";
CREATE POLICY "unified_delete_policy" ON public."employee_apps" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_apps";
CREATE POLICY "unified_insert_policy" ON public."employee_apps" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_apps";
CREATE POLICY "unified_select_policy" ON public."employee_apps" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_apps";
CREATE POLICY "unified_update_policy" ON public."employee_apps" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_schemes";
CREATE POLICY "unified_delete_policy" ON public."salary_schemes" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_schemes";
CREATE POLICY "unified_insert_policy" ON public."salary_schemes" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_schemes";
CREATE POLICY "unified_select_policy" ON public."salary_schemes" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_schemes";
CREATE POLICY "unified_update_policy" ON public."salary_schemes" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."vehicle_assignments";
CREATE POLICY "unified_delete_policy" ON public."vehicle_assignments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."vehicle_assignments";
CREATE POLICY "unified_insert_policy" ON public."vehicle_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."vehicle_assignments";
CREATE POLICY "unified_select_policy" ON public."vehicle_assignments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."vehicle_assignments";
CREATE POLICY "unified_update_policy" ON public."vehicle_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."daily_orders";
CREATE POLICY "unified_delete_policy" ON public."daily_orders" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."daily_orders";
CREATE POLICY "unified_insert_policy" ON public."daily_orders" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."daily_orders";
CREATE POLICY "unified_select_policy" ON public."daily_orders" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR ((is_internal_user() AND has_permission('orders'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."daily_orders";
CREATE POLICY "unified_update_policy" ON public."daily_orders" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_internal_user() AND has_permission('orders'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."attendance";
CREATE POLICY "unified_delete_policy" ON public."attendance" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."attendance";
CREATE POLICY "unified_insert_policy" ON public."attendance" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."attendance";
CREATE POLICY "unified_select_policy" ON public."attendance" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'view'::text))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."attendance";
CREATE POLICY "unified_update_policy" ON public."attendance" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."vehicles";
CREATE POLICY "unified_delete_policy" ON public."vehicles" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."vehicles";
CREATE POLICY "unified_insert_policy" ON public."vehicles" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."vehicles";
CREATE POLICY "unified_select_policy" ON public."vehicles" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."vehicles";
CREATE POLICY "unified_update_policy" ON public."vehicles" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."advances";
CREATE POLICY "unified_delete_policy" ON public."advances" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."advances";
CREATE POLICY "unified_insert_policy" ON public."advances" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."advances";
CREATE POLICY "unified_select_policy" ON public."advances" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."advances";
CREATE POLICY "unified_update_policy" ON public."advances" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."alerts";
CREATE POLICY "unified_delete_policy" ON public."alerts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."alerts";
CREATE POLICY "unified_insert_policy" ON public."alerts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."alerts";
CREATE POLICY "unified_select_policy" ON public."alerts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."alerts";
CREATE POLICY "unified_update_policy" ON public."alerts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."advance_installments";
CREATE POLICY "unified_delete_policy" ON public."advance_installments" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."advance_installments";
CREATE POLICY "unified_insert_policy" ON public."advance_installments" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."advance_installments";
CREATE POLICY "unified_select_policy" ON public."advance_installments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."advance_installments";
CREATE POLICY "unified_update_policy" ON public."advance_installments" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND advance_in_my_company(advance_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."departments";
CREATE POLICY "unified_delete_policy" ON public."departments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."departments";
CREATE POLICY "unified_insert_policy" ON public."departments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."departments";
CREATE POLICY "unified_select_policy" ON public."departments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."departments";
CREATE POLICY "unified_update_policy" ON public."departments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."vehicle_mileage_daily";
CREATE POLICY "unified_delete_policy" ON public."vehicle_mileage_daily" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."vehicle_mileage_daily";
CREATE POLICY "unified_insert_policy" ON public."vehicle_mileage_daily" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."vehicle_mileage_daily";
CREATE POLICY "unified_select_policy" ON public."vehicle_mileage_daily" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid()))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."vehicle_mileage_daily";
CREATE POLICY "unified_update_policy" ON public."vehicle_mileage_daily" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."pricing_rules";
CREATE POLICY "unified_delete_policy" ON public."pricing_rules" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."pricing_rules";
CREATE POLICY "unified_insert_policy" ON public."pricing_rules" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."pricing_rules";
CREATE POLICY "unified_select_policy" ON public."pricing_rules" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."pricing_rules";
CREATE POLICY "unified_update_policy" ON public."pricing_rules" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."locked_months";
CREATE POLICY "unified_delete_policy" ON public."locked_months" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."locked_months";
CREATE POLICY "unified_insert_policy" ON public."locked_months" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."locked_months";
CREATE POLICY "unified_select_policy" ON public."locked_months" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."locked_months";
CREATE POLICY "unified_update_policy" ON public."locked_months" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."platform_accounts";
CREATE POLICY "unified_delete_policy" ON public."platform_accounts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."platform_accounts";
CREATE POLICY "unified_insert_policy" ON public."platform_accounts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."platform_accounts";
CREATE POLICY "unified_select_policy" ON public."platform_accounts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."platform_accounts";
CREATE POLICY "unified_update_policy" ON public."platform_accounts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."account_assignments";
CREATE POLICY "unified_insert_policy" ON public."account_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."account_assignments";
CREATE POLICY "unified_select_policy" ON public."account_assignments" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."account_assignments";
CREATE POLICY "unified_update_policy" ON public."account_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_targets";
CREATE POLICY "unified_delete_policy" ON public."employee_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_targets";
CREATE POLICY "unified_insert_policy" ON public."employee_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_targets";
CREATE POLICY "unified_select_policy" ON public."employee_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_targets";
CREATE POLICY "unified_update_policy" ON public."employee_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."employee_roles";
CREATE POLICY "unified_delete_policy" ON public."employee_roles" FOR DELETE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."employee_roles";
CREATE POLICY "unified_insert_policy" ON public."employee_roles" FOR INSERT
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."employee_roles";
CREATE POLICY "unified_select_policy" ON public."employee_roles" FOR SELECT
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."employee_roles";
CREATE POLICY "unified_update_policy" ON public."employee_roles" FOR UPDATE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) )
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_tiers";
CREATE POLICY "unified_delete_policy" ON public."salary_tiers" FOR DELETE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_tiers";
CREATE POLICY "unified_insert_policy" ON public."salary_tiers" FOR INSERT
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_tiers";
CREATE POLICY "unified_select_policy" ON public."salary_tiers" FOR SELECT
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_tiers";
CREATE POLICY "unified_update_policy" ON public."salary_tiers" FOR UPDATE
  USING ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) )
  WITH CHECK ( (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."maintenance_logs";
CREATE POLICY "unified_delete_policy" ON public."maintenance_logs" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."maintenance_logs";
CREATE POLICY "unified_insert_policy" ON public."maintenance_logs" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."maintenance_logs";
CREATE POLICY "unified_select_policy" ON public."maintenance_logs" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."maintenance_logs";
CREATE POLICY "unified_update_policy" ON public."maintenance_logs" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."order_import_batches";
CREATE POLICY "unified_delete_policy" ON public."order_import_batches" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."order_import_batches";
CREATE POLICY "unified_insert_policy" ON public."order_import_batches" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."order_import_batches";
CREATE POLICY "unified_select_policy" ON public."order_import_batches" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."order_import_batches";
CREATE POLICY "unified_update_policy" ON public."order_import_batches" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'hr'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_month_snapshots";
CREATE POLICY "unified_delete_policy" ON public."salary_month_snapshots" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_month_snapshots";
CREATE POLICY "unified_insert_policy" ON public."salary_month_snapshots" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_month_snapshots";
CREATE POLICY "unified_select_policy" ON public."salary_month_snapshots" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_month_snapshots";
CREATE POLICY "unified_update_policy" ON public."salary_month_snapshots" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."app_hybrid_rules";
CREATE POLICY "unified_delete_policy" ON public."app_hybrid_rules" FOR DELETE
  USING ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."app_hybrid_rules";
CREATE POLICY "unified_insert_policy" ON public."app_hybrid_rules" FOR INSERT
  WITH CHECK ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."app_hybrid_rules";
CREATE POLICY "unified_select_policy" ON public."app_hybrid_rules" FOR SELECT
  USING ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."app_hybrid_rules";
CREATE POLICY "unified_update_policy" ON public."app_hybrid_rules" FOR UPDATE
  USING ( is_active_user(auth.uid()) )
  WITH CHECK ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."attendance_status_configs";
CREATE POLICY "unified_delete_policy" ON public."attendance_status_configs" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."attendance_status_configs";
CREATE POLICY "unified_insert_policy" ON public."attendance_status_configs" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."attendance_status_configs";
CREATE POLICY "unified_select_policy" ON public."attendance_status_configs" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR true) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."attendance_status_configs";
CREATE POLICY "unified_update_policy" ON public."attendance_status_configs" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."daily_shifts";
CREATE POLICY "unified_delete_policy" ON public."daily_shifts" FOR DELETE
  USING ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."daily_shifts";
CREATE POLICY "unified_insert_policy" ON public."daily_shifts" FOR INSERT
  WITH CHECK ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."daily_shifts";
CREATE POLICY "unified_select_policy" ON public."daily_shifts" FOR SELECT
  USING ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."daily_shifts";
CREATE POLICY "unified_update_policy" ON public."daily_shifts" FOR UPDATE
  USING ( is_active_user(auth.uid()) )
  WITH CHECK ( is_active_user(auth.uid()) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."positions";
CREATE POLICY "unified_delete_policy" ON public."positions" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."positions";
CREATE POLICY "unified_insert_policy" ON public."positions" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."positions";
CREATE POLICY "unified_select_policy" ON public."positions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."positions";
CREATE POLICY "unified_update_policy" ON public."positions" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."app_targets";
CREATE POLICY "unified_delete_policy" ON public."app_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."app_targets";
CREATE POLICY "unified_insert_policy" ON public."app_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."app_targets";
CREATE POLICY "unified_select_policy" ON public."app_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."app_targets";
CREATE POLICY "unified_update_policy" ON public."app_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."scheme_month_snapshots";
CREATE POLICY "unified_delete_policy" ON public."scheme_month_snapshots" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."scheme_month_snapshots";
CREATE POLICY "unified_insert_policy" ON public."scheme_month_snapshots" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."scheme_month_snapshots";
CREATE POLICY "unified_select_policy" ON public."scheme_month_snapshots" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."scheme_month_snapshots";
CREATE POLICY "unified_update_policy" ON public."scheme_month_snapshots" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."vehicle_mileage";
CREATE POLICY "unified_delete_policy" ON public."vehicle_mileage" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."vehicle_mileage";
CREATE POLICY "unified_insert_policy" ON public."vehicle_mileage" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."vehicle_mileage";
CREATE POLICY "unified_select_policy" ON public."vehicle_mileage" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."vehicle_mileage";
CREATE POLICY "unified_update_policy" ON public."vehicle_mileage" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."system_settings";
CREATE POLICY "unified_insert_policy" ON public."system_settings" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."system_settings";
CREATE POLICY "unified_update_policy" ON public."system_settings" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) )
  WITH CHECK ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."audit_log";
CREATE POLICY "unified_insert_policy" ON public."audit_log" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (auth.uid() = user_id)) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."audit_log";
CREATE POLICY "unified_select_policy" ON public."audit_log" FOR SELECT
  USING ( (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_drafts";
CREATE POLICY "unified_delete_policy" ON public."salary_drafts" FOR DELETE
  USING ( (auth.uid() = user_id) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_drafts";
CREATE POLICY "unified_insert_policy" ON public."salary_drafts" FOR INSERT
  WITH CHECK ( (auth.uid() = user_id) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_drafts";
CREATE POLICY "unified_select_policy" ON public."salary_drafts" FOR SELECT
  USING ( (auth.uid() = user_id) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_drafts";
CREATE POLICY "unified_update_policy" ON public."salary_drafts" FOR UPDATE
  USING ( (auth.uid() = user_id) )
  WITH CHECK ( (auth.uid() = user_id) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."external_deductions";
CREATE POLICY "unified_delete_policy" ON public."external_deductions" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."external_deductions";
CREATE POLICY "unified_insert_policy" ON public."external_deductions" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."external_deductions";
CREATE POLICY "unified_select_policy" ON public."external_deductions" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'view'::text)))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."external_deductions";
CREATE POLICY "unified_update_policy" ON public."external_deductions" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('financials'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."admin_action_log";
CREATE POLICY "unified_insert_policy" ON public."admin_action_log" FOR INSERT
  WITH CHECK ( (is_internal_user() AND (NOT (user_id IS DISTINCT FROM auth.uid()))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_records";
CREATE POLICY "unified_delete_policy" ON public."salary_records" FOR DELETE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'delete'::text))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_records";
CREATE POLICY "unified_insert_policy" ON public."salary_records" FOR INSERT
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_records";
CREATE POLICY "unified_select_policy" ON public."salary_records" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR ((is_internal_user() AND has_permission('salary'::text, 'view'::text)) OR (is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))))) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_records";
CREATE POLICY "unified_update_policy" ON public."salary_records" FOR UPDATE
  USING ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) )
  WITH CHECK ( ((is_active_user(auth.uid()) AND employee_in_my_company(employee_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance'::app_role))) OR (is_internal_user() AND has_permission('salary'::text, 'write'::text))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."supervisor_employee_assignments";
CREATE POLICY "unified_delete_policy" ON public."supervisor_employee_assignments" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."supervisor_employee_assignments";
CREATE POLICY "unified_insert_policy" ON public."supervisor_employee_assignments" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."supervisor_employee_assignments";
CREATE POLICY "unified_select_policy" ON public."supervisor_employee_assignments" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."supervisor_employee_assignments";
CREATE POLICY "unified_update_policy" ON public."supervisor_employee_assignments" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."supervisor_targets";
CREATE POLICY "unified_delete_policy" ON public."supervisor_targets" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."supervisor_targets";
CREATE POLICY "unified_insert_policy" ON public."supervisor_targets" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."supervisor_targets";
CREATE POLICY "unified_select_policy" ON public."supervisor_targets" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."supervisor_targets";
CREATE POLICY "unified_update_policy" ON public."supervisor_targets" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."maintenance_parts";
CREATE POLICY "unified_delete_policy" ON public."maintenance_parts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."maintenance_parts";
CREATE POLICY "unified_insert_policy" ON public."maintenance_parts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."maintenance_parts";
CREATE POLICY "unified_select_policy" ON public."maintenance_parts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."maintenance_parts";
CREATE POLICY "unified_update_policy" ON public."maintenance_parts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."spare_parts";
CREATE POLICY "unified_delete_policy" ON public."spare_parts" FOR DELETE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."spare_parts";
CREATE POLICY "unified_insert_policy" ON public."spare_parts" FOR INSERT
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_select_policy" ON public."spare_parts";
CREATE POLICY "unified_select_policy" ON public."spare_parts" FOR SELECT
  USING ( ((is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) OR is_active_user(auth.uid())) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."spare_parts";
CREATE POLICY "unified_update_policy" ON public."spare_parts" FOR UPDATE
  USING ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) )
  WITH CHECK ( (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role))) );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."leave_requests";
CREATE POLICY "unified_delete_policy" ON public."leave_requests" FOR DELETE
  USING ( is_admin_or_hr(auth.uid()) );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."leave_requests";
CREATE POLICY "unified_insert_policy" ON public."leave_requests" FOR INSERT
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

DROP POLICY IF EXISTS "unified_update_policy" ON public."leave_requests";
CREATE POLICY "unified_update_policy" ON public."leave_requests" FOR UPDATE
  USING ( is_admin_or_hr(auth.uid()) )
  WITH CHECK ( is_admin_or_hr(auth.uid()) );

