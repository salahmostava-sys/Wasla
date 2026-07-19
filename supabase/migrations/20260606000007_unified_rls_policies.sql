-- Migration to consolidate ALL permissive RLS policies into 1 per action

-- Table: public.account_assignments
DROP POLICY IF EXISTS "account_assignments_insert_update" ON "public"."account_assignments";
DROP POLICY IF EXISTS "account_assignments_select" ON "public"."account_assignments";
DROP POLICY IF EXISTS "account_assignments_update_only" ON "public"."account_assignments";
CREATE POLICY "unified_select_policy" ON "public"."account_assignments" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."account_assignments" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."account_assignments" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.admin_action_log
DROP POLICY IF EXISTS "admin_action_log_insert_policy" ON "public"."admin_action_log";
DROP POLICY IF EXISTS "admin_action_log_select_policy" ON "public"."admin_action_log";
CREATE POLICY "unified_select_policy" ON "public"."admin_action_log" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('audit'::text, 'view'::text)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."admin_action_log" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND (NOT (user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid)))))
  );

-- Table: public.advance_installments
DROP POLICY IF EXISTS "Advance installments: manage own company" ON "public"."advance_installments";
DROP POLICY IF EXISTS "advance_installments_delete_policy" ON "public"."advance_installments";
DROP POLICY IF EXISTS "advance_installments_insert_policy" ON "public"."advance_installments";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."advance_installments";
DROP POLICY IF EXISTS "advance_installments_update_policy" ON "public"."advance_installments";
CREATE POLICY "unified_select_policy" ON "public"."advance_installments" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."advance_installments" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."advance_installments" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."advance_installments" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'delete'::text)))
  );

-- Table: public.advances
DROP POLICY IF EXISTS "Advances: manage own company" ON "public"."advances";
DROP POLICY IF EXISTS "advances_delete_policy" ON "public"."advances";
DROP POLICY IF EXISTS "advances_insert_policy" ON "public"."advances";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."advances";
DROP POLICY IF EXISTS "advances_update_policy" ON "public"."advances";
CREATE POLICY "unified_select_policy" ON "public"."advances" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (((is_internal_user() AND has_permission('financials'::text, 'view'::text)) OR (is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."advances" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."advances" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."advances" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'delete'::text)))
  );

-- Table: public.alerts
DROP POLICY IF EXISTS "HR/admin can manage alerts" ON "public"."alerts";
DROP POLICY IF EXISTS "Active users can view alerts" ON "public"."alerts";
CREATE POLICY "unified_select_policy" ON "public"."alerts" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."alerts" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."alerts" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."alerts" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.app_hybrid_rules
DROP POLICY IF EXISTS "Authenticated users can delete app_hybrid_rules" ON "public"."app_hybrid_rules";
DROP POLICY IF EXISTS "Authenticated users can insert app_hybrid_rules" ON "public"."app_hybrid_rules";
DROP POLICY IF EXISTS "Authenticated users can view app_hybrid_rules" ON "public"."app_hybrid_rules";
DROP POLICY IF EXISTS "Authenticated users can update app_hybrid_rules" ON "public"."app_hybrid_rules";
CREATE POLICY "unified_select_policy" ON "public"."app_hybrid_rules" FOR SELECT
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."app_hybrid_rules" FOR INSERT
  WITH CHECK (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_update_policy" ON "public"."app_hybrid_rules" FOR UPDATE
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  )
  WITH CHECK (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."app_hybrid_rules" FOR DELETE
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );

-- Table: public.app_targets
DROP POLICY IF EXISTS "Admin/ops/finance can manage app_targets" ON "public"."app_targets";
DROP POLICY IF EXISTS "Active users can view app_targets" ON "public"."app_targets";
CREATE POLICY "unified_select_policy" ON "public"."app_targets" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."app_targets" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."app_targets" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."app_targets" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.apps
DROP POLICY IF EXISTS "Admins can manage apps" ON "public"."apps";
DROP POLICY IF EXISTS "Active users can view apps" ON "public"."apps";
CREATE POLICY "unified_select_policy" ON "public"."apps" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."apps" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_update_policy" ON "public"."apps" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."apps" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.attendance
DROP POLICY IF EXISTS "combined_delete_policy" ON "public"."attendance";
DROP POLICY IF EXISTS "combined_insert_policy" ON "public"."attendance";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."attendance";
DROP POLICY IF EXISTS "combined_update_policy" ON "public"."attendance";
CREATE POLICY "unified_select_policy" ON "public"."attendance" FOR SELECT
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))) OR (is_internal_user() AND has_permission('attendance'::text, 'view'::text))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."attendance" FOR INSERT
  WITH CHECK (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))))
  );
CREATE POLICY "unified_update_policy" ON "public"."attendance" FOR UPDATE
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))))
  )
  WITH CHECK (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR (is_internal_user() AND has_permission('attendance'::text, 'write'::text))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."attendance" FOR DELETE
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR (is_internal_user() AND has_permission('attendance'::text, 'delete'::text))))
  );

-- Table: public.attendance_status_configs
DROP POLICY IF EXISTS "admin can manage configs" ON "public"."attendance_status_configs";
DROP POLICY IF EXISTS "authenticated users can read configs" ON "public"."attendance_status_configs";
CREATE POLICY "unified_select_policy" ON "public"."attendance_status_configs" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    (true)
  );
CREATE POLICY "unified_insert_policy" ON "public"."attendance_status_configs" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_update_policy" ON "public"."attendance_status_configs" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."attendance_status_configs" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.audit_log
DROP POLICY IF EXISTS "Active users can insert audit_log" ON "public"."audit_log";
DROP POLICY IF EXISTS "Admins can view audit_log" ON "public"."audit_log";
CREATE POLICY "unified_select_policy" ON "public"."audit_log" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_insert_policy" ON "public"."audit_log" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (( SELECT auth.uid() AS uid) = user_id)))
  );

-- Table: public.commercial_records
DROP POLICY IF EXISTS "commercial_records_delete_policy" ON "public"."commercial_records";
DROP POLICY IF EXISTS "commercial_records_insert_policy" ON "public"."commercial_records";
DROP POLICY IF EXISTS "commercial_records_select_policy" ON "public"."commercial_records";
DROP POLICY IF EXISTS "commercial_records_update_policy" ON "public"."commercial_records";
CREATE POLICY "unified_select_policy" ON "public"."commercial_records" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('employees'::text, 'view'::text)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."commercial_records" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."commercial_records" FOR UPDATE
  USING (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."commercial_records" FOR DELETE
  USING (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );

-- Table: public.daily_orders
DROP POLICY IF EXISTS "Daily orders: manage own company" ON "public"."daily_orders";
DROP POLICY IF EXISTS "daily_orders_delete_policy" ON "public"."daily_orders";
DROP POLICY IF EXISTS "daily_orders_insert_policy" ON "public"."daily_orders";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."daily_orders";
DROP POLICY IF EXISTS "daily_orders_update_policy" ON "public"."daily_orders";
CREATE POLICY "unified_select_policy" ON "public"."daily_orders" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (((is_internal_user() AND has_permission(_const_work_orders()::text, 'view'::text)) OR (is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."daily_orders" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_internal_user() AND has_permission(_const_work_orders()::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."daily_orders" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_internal_user() AND has_permission(_const_work_orders()::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_internal_user() AND has_permission(_const_work_orders()::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."daily_orders" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_internal_user() AND has_permission(_const_work_orders()::text, 'delete'::text)))
  );

-- Table: public.daily_shifts
DROP POLICY IF EXISTS "Authenticated users can delete daily_shifts" ON "public"."daily_shifts";
DROP POLICY IF EXISTS "Authenticated users can insert daily_shifts" ON "public"."daily_shifts";
DROP POLICY IF EXISTS "Authenticated users can view daily_shifts" ON "public"."daily_shifts";
DROP POLICY IF EXISTS "Authenticated users can update daily_shifts" ON "public"."daily_shifts";
CREATE POLICY "unified_select_policy" ON "public"."daily_shifts" FOR SELECT
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."daily_shifts" FOR INSERT
  WITH CHECK (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_update_policy" ON "public"."daily_shifts" FOR UPDATE
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  )
  WITH CHECK (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."daily_shifts" FOR DELETE
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );

-- Table: public.departments
DROP POLICY IF EXISTS "HR/admin can manage departments" ON "public"."departments";
DROP POLICY IF EXISTS "Active users can view departments" ON "public"."departments";
CREATE POLICY "unified_select_policy" ON "public"."departments" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."departments" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."departments" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."departments" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.edge_rate_limits
DROP POLICY IF EXISTS "service_role_full_access" ON "public"."edge_rate_limits";
CREATE POLICY "unified_select_policy" ON "public"."edge_rate_limits" FOR SELECT
  USING (
    (((select auth.role()) = 'service_role'::text))
  );
CREATE POLICY "unified_insert_policy" ON "public"."edge_rate_limits" FOR INSERT
  WITH CHECK (
    (((select auth.role()) = 'service_role'::text))
  );
CREATE POLICY "unified_update_policy" ON "public"."edge_rate_limits" FOR UPDATE
  USING (
    (((select auth.role()) = 'service_role'::text))
  )
  WITH CHECK (
    (((select auth.role()) = 'service_role'::text))
  );
CREATE POLICY "unified_delete_policy" ON "public"."edge_rate_limits" FOR DELETE
  USING (
    (((select auth.role()) = 'service_role'::text))
  );

-- Table: public.employee_apps
DROP POLICY IF EXISTS "Employee apps: manage own company" ON "public"."employee_apps";
DROP POLICY IF EXISTS "Employee apps: select own company" ON "public"."employee_apps";
CREATE POLICY "unified_select_policy" ON "public"."employee_apps" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employee_apps" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."employee_apps" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employee_apps" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.employee_roles
DROP POLICY IF EXISTS "Admin or HR can manage employee_roles" ON "public"."employee_roles";
DROP POLICY IF EXISTS "Active users can view employee_roles" ON "public"."employee_roles";
CREATE POLICY "unified_select_policy" ON "public"."employee_roles" FOR SELECT
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employee_roles" FOR INSERT
  WITH CHECK (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))
  );
CREATE POLICY "unified_update_policy" ON "public"."employee_roles" FOR UPDATE
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))
  )
  WITH CHECK (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employee_roles" FOR DELETE
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))
  );

-- Table: public.employee_scheme
DROP POLICY IF EXISTS "Employee scheme: manage own company" ON "public"."employee_scheme";
DROP POLICY IF EXISTS "Employee scheme: select own company" ON "public"."employee_scheme";
CREATE POLICY "unified_select_policy" ON "public"."employee_scheme" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employee_scheme" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."employee_scheme" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employee_scheme" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.employee_targets
DROP POLICY IF EXISTS "employee_targets_manage_policy" ON "public"."employee_targets";
DROP POLICY IF EXISTS "employee_targets_select_policy" ON "public"."employee_targets";
CREATE POLICY "unified_select_policy" ON "public"."employee_targets" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employee_targets" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."employee_targets" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employee_targets" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.employee_tiers
DROP POLICY IF EXISTS "HR/admin can manage employee_tiers" ON "public"."employee_tiers";
DROP POLICY IF EXISTS "HR/admin can view employee_tiers" ON "public"."employee_tiers";
CREATE POLICY "unified_select_policy" ON "public"."employee_tiers" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employee_tiers" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."employee_tiers" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employee_tiers" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.employees
DROP POLICY IF EXISTS "employees_delete_policy" ON "public"."employees";
DROP POLICY IF EXISTS "employees_insert_policy" ON "public"."employees";
DROP POLICY IF EXISTS "employees_select_policy" ON "public"."employees";
DROP POLICY IF EXISTS "employees_update_policy" ON "public"."employees";
CREATE POLICY "unified_select_policy" ON "public"."employees" FOR SELECT
  USING (
    ((is_internal_user() AND (has_permission('employees'::text, 'view'::text) OR has_permission('attendance'::text, 'view'::text))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."employees" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."employees" FOR UPDATE
  USING (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."employees" FOR DELETE
  USING (
    ((is_internal_user() AND has_permission('employees'::text, 'delete'::text)))
  );

-- Table: public.external_deductions
DROP POLICY IF EXISTS "External deductions: manage own company" ON "public"."external_deductions";
DROP POLICY IF EXISTS "external_deductions_delete_policy" ON "public"."external_deductions";
DROP POLICY IF EXISTS "external_deductions_insert_policy" ON "public"."external_deductions";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."external_deductions";
DROP POLICY IF EXISTS "external_deductions_update_policy" ON "public"."external_deductions";
CREATE POLICY "unified_select_policy" ON "public"."external_deductions" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))) OR (is_internal_user() AND has_permission('financials'::text, 'view'::text))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."external_deductions" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."external_deductions" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."external_deductions" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'delete'::text)))
  );

-- Table: public.finance_transactions
DROP POLICY IF EXISTS "Finance/admin can manage finance_transactions" ON "public"."finance_transactions";
DROP POLICY IF EXISTS "Authenticated users can view finance_transactions" ON "public"."finance_transactions";
CREATE POLICY "unified_select_policy" ON "public"."finance_transactions" FOR SELECT
  USING (
    (((select auth.role()) = 'authenticated'::text))
  );
CREATE POLICY "unified_insert_policy" ON "public"."finance_transactions" FOR INSERT
  WITH CHECK (
    (((select auth.role()) = 'authenticated'::text))
  );
CREATE POLICY "unified_update_policy" ON "public"."finance_transactions" FOR UPDATE
  USING (
    (((select auth.role()) = 'authenticated'::text))
  )
  WITH CHECK (
    (((select auth.role()) = 'authenticated'::text))
  );
CREATE POLICY "unified_delete_policy" ON "public"."finance_transactions" FOR DELETE
  USING (
    (((select auth.role()) = 'authenticated'::text))
  );

-- Table: public.hr_performance_reviews
DROP POLICY IF EXISTS "hr_reviews_delete" ON "public"."hr_performance_reviews";
DROP POLICY IF EXISTS "hr_reviews_insert" ON "public"."hr_performance_reviews";
DROP POLICY IF EXISTS "hr_reviews_select" ON "public"."hr_performance_reviews";
DROP POLICY IF EXISTS "hr_reviews_update" ON "public"."hr_performance_reviews";
CREATE POLICY "unified_select_policy" ON "public"."hr_performance_reviews" FOR SELECT
  USING (
    (true)
  );
CREATE POLICY "unified_insert_policy" ON "public"."hr_performance_reviews" FOR INSERT
  WITH CHECK (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_update_policy" ON "public"."hr_performance_reviews" FOR UPDATE
  USING (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  )
  WITH CHECK (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."hr_performance_reviews" FOR DELETE
  USING (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );

-- Table: public.leave_requests
DROP POLICY IF EXISTS "leave_requests_delete" ON "public"."leave_requests";
DROP POLICY IF EXISTS "leave_requests_insert" ON "public"."leave_requests";
DROP POLICY IF EXISTS "leave_requests_select" ON "public"."leave_requests";
DROP POLICY IF EXISTS "leave_requests_update" ON "public"."leave_requests";
CREATE POLICY "unified_select_policy" ON "public"."leave_requests" FOR SELECT
  USING (
    (true)
  );
CREATE POLICY "unified_insert_policy" ON "public"."leave_requests" FOR INSERT
  WITH CHECK (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_update_policy" ON "public"."leave_requests" FOR UPDATE
  USING (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  )
  WITH CHECK (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."leave_requests" FOR DELETE
  USING (
    (is_admin_or_hr(( SELECT auth.uid() AS uid)))
  );

-- Table: public.locked_months
DROP POLICY IF EXISTS "combined_all_policy" ON "public"."locked_months";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."locked_months";
CREATE POLICY "unified_select_policy" ON "public"."locked_months" FOR SELECT
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."locked_months" FOR INSERT
  WITH CHECK (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_update_policy" ON "public"."locked_months" FOR UPDATE
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  )
  WITH CHECK (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."locked_months" FOR DELETE
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );

-- Table: public.maintenance_logs
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON "public"."maintenance_logs";
DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON "public"."maintenance_logs";
CREATE POLICY "unified_select_policy" ON "public"."maintenance_logs" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."maintenance_logs" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."maintenance_logs" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."maintenance_logs" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.maintenance_parts
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_parts" ON "public"."maintenance_parts";
DROP POLICY IF EXISTS "Active users can view maintenance_parts" ON "public"."maintenance_parts";
CREATE POLICY "unified_select_policy" ON "public"."maintenance_parts" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."maintenance_parts" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."maintenance_parts" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."maintenance_parts" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.order_import_batches
DROP POLICY IF EXISTS "order_import_batches_manage_policy" ON "public"."order_import_batches";
DROP POLICY IF EXISTS "order_import_batches_select_policy" ON "public"."order_import_batches";
CREATE POLICY "unified_select_policy" ON "public"."order_import_batches" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."order_import_batches" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."order_import_batches" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."order_import_batches" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.pl_records
DROP POLICY IF EXISTS "pl_records_delete_policy" ON "public"."pl_records";
DROP POLICY IF EXISTS "pl_records_insert_policy" ON "public"."pl_records";
DROP POLICY IF EXISTS "pl_records_select_policy" ON "public"."pl_records";
DROP POLICY IF EXISTS "pl_records_update_policy" ON "public"."pl_records";
CREATE POLICY "unified_select_policy" ON "public"."pl_records" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('financials'::text, 'view'::text)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."pl_records" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."pl_records" FOR UPDATE
  USING (
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_internal_user() AND has_permission('financials'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."pl_records" FOR DELETE
  USING (
    ((is_internal_user() AND has_permission('financials'::text, 'delete'::text)))
  );

-- Table: public.platform_accounts
DROP POLICY IF EXISTS "platform_accounts_manage" ON "public"."platform_accounts";
DROP POLICY IF EXISTS "platform_accounts_select" ON "public"."platform_accounts";
CREATE POLICY "unified_select_policy" ON "public"."platform_accounts" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."platform_accounts" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."platform_accounts" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."platform_accounts" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.positions
DROP POLICY IF EXISTS "HR/admin can manage positions" ON "public"."positions";
DROP POLICY IF EXISTS "Active users can view positions" ON "public"."positions";
CREATE POLICY "unified_select_policy" ON "public"."positions" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."positions" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."positions" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."positions" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))))
  );

-- Table: public.pricing_rules
DROP POLICY IF EXISTS "Finance/admin can manage pricing_rules" ON "public"."pricing_rules";
DROP POLICY IF EXISTS "Active users can view pricing_rules" ON "public"."pricing_rules";
CREATE POLICY "unified_select_policy" ON "public"."pricing_rules" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."pricing_rules" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."pricing_rules" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."pricing_rules" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Admins can insert profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Active users can view profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "combined_update_policy" ON "public"."profiles";
CREATE POLICY "unified_select_policy" ON "public"."profiles" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) OR (( SELECT auth.uid() AS uid) = id)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."profiles" FOR INSERT
  WITH CHECK (
    (has_role(( SELECT auth.uid() AS uid), _const_role_admin()))
  );
CREATE POLICY "unified_update_policy" ON "public"."profiles" FOR UPDATE
  USING (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (( SELECT auth.uid() AS uid) = id)))
  )
  WITH CHECK (
    (((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())) OR (( SELECT auth.uid() AS uid) = id)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."profiles" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.roles
DROP POLICY IF EXISTS "roles_delete_policy" ON "public"."roles";
DROP POLICY IF EXISTS "roles_insert_policy" ON "public"."roles";
DROP POLICY IF EXISTS "roles_select_policy" ON "public"."roles";
DROP POLICY IF EXISTS "roles_update_policy" ON "public"."roles";
CREATE POLICY "unified_select_policy" ON "public"."roles" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'view'::text)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."roles" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."roles" FOR UPDATE
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."roles" FOR DELETE
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'delete'::text)))
  );

-- Table: public.salary_drafts
DROP POLICY IF EXISTS "Users can delete own drafts" ON "public"."salary_drafts";
DROP POLICY IF EXISTS "Users can insert own drafts" ON "public"."salary_drafts";
DROP POLICY IF EXISTS "Users can view own drafts" ON "public"."salary_drafts";
DROP POLICY IF EXISTS "Users can update own drafts" ON "public"."salary_drafts";
CREATE POLICY "unified_select_policy" ON "public"."salary_drafts" FOR SELECT
  USING (
    ((( SELECT auth.uid() AS uid) = user_id))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_drafts" FOR INSERT
  WITH CHECK (
    ((( SELECT auth.uid() AS uid) = user_id))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_drafts" FOR UPDATE
  USING (
    ((( SELECT auth.uid() AS uid) = user_id))
  )
  WITH CHECK (
    ((( SELECT auth.uid() AS uid) = user_id))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_drafts" FOR DELETE
  USING (
    ((( SELECT auth.uid() AS uid) = user_id))
  );

-- Table: public.salary_month_snapshots
DROP POLICY IF EXISTS "salary_month_snapshots_manage_policy" ON "public"."salary_month_snapshots";
DROP POLICY IF EXISTS "salary_month_snapshots_select_policy" ON "public"."salary_month_snapshots";
CREATE POLICY "unified_select_policy" ON "public"."salary_month_snapshots" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_month_snapshots" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_month_snapshots" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_month_snapshots" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.salary_records
DROP POLICY IF EXISTS "Salary records: manage own company" ON "public"."salary_records";
DROP POLICY IF EXISTS "salary_records_delete_policy" ON "public"."salary_records";
DROP POLICY IF EXISTS "salary_records_insert_policy" ON "public"."salary_records";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."salary_records";
DROP POLICY IF EXISTS "salary_records_update_policy" ON "public"."salary_records";
CREATE POLICY "unified_select_policy" ON "public"."salary_records" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (((is_internal_user() AND has_permission('salary'::text, 'view'::text)) OR (is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_records" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('salary'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_records" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('salary'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('salary'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_records" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('salary'::text, 'delete'::text)))
  );

-- Table: public.salary_scheme_tiers
DROP POLICY IF EXISTS "Admins/finance can manage salary_scheme_tiers" ON "public"."salary_scheme_tiers";
DROP POLICY IF EXISTS "Active users can view salary_scheme_tiers" ON "public"."salary_scheme_tiers";
CREATE POLICY "unified_select_policy" ON "public"."salary_scheme_tiers" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_scheme_tiers" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_scheme_tiers" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_scheme_tiers" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.salary_schemes
DROP POLICY IF EXISTS "Admins/finance can manage salary_schemes" ON "public"."salary_schemes";
DROP POLICY IF EXISTS "Active users can view salary_schemes" ON "public"."salary_schemes";
CREATE POLICY "unified_select_policy" ON "public"."salary_schemes" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_schemes" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_schemes" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_schemes" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.salary_slip_templates
DROP POLICY IF EXISTS "combined_all_policy" ON "public"."salary_slip_templates";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."salary_slip_templates";
CREATE POLICY "unified_select_policy" ON "public"."salary_slip_templates" FOR SELECT
  USING (
    (((auth.role() = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_slip_templates" FOR INSERT
  WITH CHECK (
    (((auth.role() = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_slip_templates" FOR UPDATE
  USING (
    (((auth.role() = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  )
  WITH CHECK (
    (((auth.role() = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_slip_templates" FOR DELETE
  USING (
    (((auth.role() = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );

-- Table: public.salary_tiers
DROP POLICY IF EXISTS "Finance admin can manage salary_tiers" ON "public"."salary_tiers";
DROP POLICY IF EXISTS "Active users can view salary_tiers" ON "public"."salary_tiers";
CREATE POLICY "unified_select_policy" ON "public"."salary_tiers" FOR SELECT
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."salary_tiers" FOR INSERT
  WITH CHECK (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))
  );
CREATE POLICY "unified_update_policy" ON "public"."salary_tiers" FOR UPDATE
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))
  )
  WITH CHECK (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."salary_tiers" FOR DELETE
  USING (
    ((has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))
  );

-- Table: public.scheme_month_snapshots
DROP POLICY IF EXISTS "Admins/finance can manage scheme_month_snapshots" ON "public"."scheme_month_snapshots";
DROP POLICY IF EXISTS "Active users can view scheme_month_snapshots" ON "public"."scheme_month_snapshots";
CREATE POLICY "unified_select_policy" ON "public"."scheme_month_snapshots" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."scheme_month_snapshots" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."scheme_month_snapshots" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."scheme_month_snapshots" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.spare_parts
DROP POLICY IF EXISTS "Admin/operations can manage spare_parts" ON "public"."spare_parts";
DROP POLICY IF EXISTS "Active users can view spare_parts" ON "public"."spare_parts";
CREATE POLICY "unified_select_policy" ON "public"."spare_parts" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."spare_parts" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."spare_parts" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."spare_parts" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.supervisor_employee_assignments
DROP POLICY IF EXISTS "Operations/admin can manage supervisor_employee_assignments" ON "public"."supervisor_employee_assignments";
DROP POLICY IF EXISTS "Active users can view supervisor_employee_assignments" ON "public"."supervisor_employee_assignments";
CREATE POLICY "unified_select_policy" ON "public"."supervisor_employee_assignments" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."supervisor_employee_assignments" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."supervisor_employee_assignments" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."supervisor_employee_assignments" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.supervisor_targets
DROP POLICY IF EXISTS "Operations/admin can manage supervisor_targets" ON "public"."supervisor_targets";
DROP POLICY IF EXISTS "Active users can view supervisor_targets" ON "public"."supervisor_targets";
CREATE POLICY "unified_select_policy" ON "public"."supervisor_targets" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."supervisor_targets" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."supervisor_targets" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."supervisor_targets" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.system_settings
DROP POLICY IF EXISTS "Admins can insert system_settings" ON "public"."system_settings";
DROP POLICY IF EXISTS "Anyone can view system_settings" ON "public"."system_settings";
DROP POLICY IF EXISTS "Admins can update system_settings" ON "public"."system_settings";
CREATE POLICY "unified_select_policy" ON "public"."system_settings" FOR SELECT
  USING (
    (true)
  );
CREATE POLICY "unified_insert_policy" ON "public"."system_settings" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_update_policy" ON "public"."system_settings" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.trade_registers
DROP POLICY IF EXISTS "Admins can manage trade_registers" ON "public"."trade_registers";
DROP POLICY IF EXISTS "Active users can view trade_registers" ON "public"."trade_registers";
CREATE POLICY "unified_select_policy" ON "public"."trade_registers" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."trade_registers" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_update_policy" ON "public"."trade_registers" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."trade_registers" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.user_permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON "public"."user_permissions";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."user_permissions";
CREATE POLICY "unified_select_policy" ON "public"."user_permissions" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    (((( SELECT auth.uid() AS uid) = user_id) OR (is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."user_permissions" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_update_policy" ON "public"."user_permissions" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );
CREATE POLICY "unified_delete_policy" ON "public"."user_permissions" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Table: public.user_roles
DROP POLICY IF EXISTS "user_roles_delete_policy" ON "public"."user_roles";
DROP POLICY IF EXISTS "user_roles_insert_policy" ON "public"."user_roles";
DROP POLICY IF EXISTS "user_roles_select_policy" ON "public"."user_roles";
DROP POLICY IF EXISTS "user_roles_update_policy" ON "public"."user_roles";
CREATE POLICY "unified_select_policy" ON "public"."user_roles" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'view'::text)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."user_roles" FOR INSERT
  WITH CHECK (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  );
CREATE POLICY "unified_update_policy" ON "public"."user_roles" FOR UPDATE
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_internal_user() AND has_permission('roles'::text, 'write'::text)))
  );
CREATE POLICY "unified_delete_policy" ON "public"."user_roles" FOR DELETE
  USING (
    ((is_internal_user() AND has_permission('roles'::text, 'delete'::text)))
  );

-- Table: public.vehicle_assignments
DROP POLICY IF EXISTS "Operations/admin can manage vehicle_assignments" ON "public"."vehicle_assignments";
DROP POLICY IF EXISTS "Ops/admin/hr can view vehicle_assignments" ON "public"."vehicle_assignments";
CREATE POLICY "unified_select_policy" ON "public"."vehicle_assignments" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."vehicle_assignments" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."vehicle_assignments" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."vehicle_assignments" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: public.vehicle_mileage
DROP POLICY IF EXISTS "Active users can view vehicle_mileage" ON "public"."vehicle_mileage";
DROP POLICY IF EXISTS "Authenticated can create vehicle_mileage" ON "public"."vehicle_mileage";
DROP POLICY IF EXISTS "Ops/admin can manage vehicle_mileage" ON "public"."vehicle_mileage";
CREATE POLICY "unified_select_policy" ON "public"."vehicle_mileage" FOR SELECT
  USING (
    ((((select auth.role()) = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );
CREATE POLICY "unified_insert_policy" ON "public"."vehicle_mileage" FOR INSERT
  WITH CHECK (
    ((((select auth.role()) = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );
CREATE POLICY "unified_update_policy" ON "public"."vehicle_mileage" FOR UPDATE
  USING (
    ((((select auth.role()) = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  )
  WITH CHECK (
    ((((select auth.role()) = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."vehicle_mileage" FOR DELETE
  USING (
    ((((select auth.role()) = 'authenticated'::text) OR (is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))))
  );

-- Table: public.vehicle_mileage_daily
DROP POLICY IF EXISTS "Admin/ops/finance can manage vehicle_mileage_daily" ON "public"."vehicle_mileage_daily";
DROP POLICY IF EXISTS "combined_select_policy" ON "public"."vehicle_mileage_daily";
CREATE POLICY "unified_select_policy" ON "public"."vehicle_mileage_daily" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    (((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()))) OR is_active_user(( SELECT auth.uid() AS uid))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."vehicle_mileage_daily" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."vehicle_mileage_daily" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."vehicle_mileage_daily" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Table: public.vehicles
DROP POLICY IF EXISTS "Operations/admin can manage vehicles" ON "public"."vehicles";
DROP POLICY IF EXISTS "Ops/admin/hr can view vehicles" ON "public"."vehicles";
CREATE POLICY "unified_select_policy" ON "public"."vehicles" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations())))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_insert_policy" ON "public"."vehicles" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_update_policy" ON "public"."vehicles" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );
CREATE POLICY "unified_delete_policy" ON "public"."vehicles" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Table: storage.objects
DROP POLICY IF EXISTS "combined_delete_policy" ON "storage"."objects";
DROP POLICY IF EXISTS "combined_insert_policy" ON "storage"."objects";
DROP POLICY IF EXISTS "combined_select_policy" ON "storage"."objects";
DROP POLICY IF EXISTS "combined_update_policy" ON "storage"."objects";
CREATE POLICY "unified_select_policy" ON "storage"."objects" FOR SELECT
  USING (
    (((bucket_id = 'avatars'::text) OR ((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'view'::text)) OR ((bucket_id = 'employee-documents'::text) AND (has_role(auth.uid(), _const_role_admin()) OR has_role(auth.uid(), _const_role_hr())))))
  );
CREATE POLICY "unified_insert_policy" ON "storage"."objects" FOR INSERT
  WITH CHECK (
    ((((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text)) OR ((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))))
  );
CREATE POLICY "unified_update_policy" ON "storage"."objects" FOR UPDATE
  USING (
    ((((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)) OR ((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text))))
  )
  WITH CHECK (
    ((((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)) OR ((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text))))
  );
CREATE POLICY "unified_delete_policy" ON "storage"."objects" FOR DELETE
  USING (
    ((((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)) OR ((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text)) OR ((bucket_id = 'employee-documents'::text) AND (has_role(auth.uid(), _const_role_admin()) OR has_role(auth.uid(), _const_role_hr())))))
  );

NOTIFY pgrst, 'reload schema';
