-- Migration to consolidate multiple permissive RLS policies

-- Consolidating 2 policies for public.advance_installments.SELECT
DROP POLICY IF EXISTS "advance_installments_select_policy" ON "public"."advance_installments";
DROP POLICY IF EXISTS "Advance installments: select own company" ON "public"."advance_installments";
CREATE POLICY "combined_select_policy" ON "public"."advance_installments" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('financials'::text, 'view'::text))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND advance_in_my_company(advance_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Consolidating 2 policies for public.advances.SELECT
DROP POLICY IF EXISTS "advances_select_policy" ON "public"."advances";
DROP POLICY IF EXISTS "Advances: select own company" ON "public"."advances";
CREATE POLICY "combined_select_policy" ON "public"."advances" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('financials'::text, 'view'::text))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Consolidating 2 policies for public.attendance.DELETE
DROP POLICY IF EXISTS "Attendance: delete own company" ON "public"."attendance";
DROP POLICY IF EXISTS "attendance_delete_policy" ON "public"."attendance";
CREATE POLICY "combined_delete_policy" ON "public"."attendance" FOR DELETE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_internal_user() AND has_permission('attendance'::text, 'delete'::text)))
  );

-- Consolidating 2 policies for public.attendance.INSERT
DROP POLICY IF EXISTS "Attendance: insert own company" ON "public"."attendance";
DROP POLICY IF EXISTS "attendance_insert_policy" ON "public"."attendance";
CREATE POLICY "combined_insert_policy" ON "public"."attendance" FOR INSERT
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_internal_user() AND has_permission('attendance'::text, 'write'::text)))
  );

-- Consolidating 2 policies for public.attendance.SELECT
DROP POLICY IF EXISTS "Attendance: select own company" ON "public"."attendance";
DROP POLICY IF EXISTS "attendance_select_policy" ON "public"."attendance";
CREATE POLICY "combined_select_policy" ON "public"."attendance" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('attendance'::text, 'view'::text)))
  );

-- Consolidating 2 policies for public.attendance.UPDATE
DROP POLICY IF EXISTS "Attendance: update own company" ON "public"."attendance";
DROP POLICY IF EXISTS "attendance_update_policy" ON "public"."attendance";
CREATE POLICY "combined_update_policy" ON "public"."attendance" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_internal_user() AND has_permission('attendance'::text, 'write'::text)))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    ((is_internal_user() AND has_permission('attendance'::text, 'write'::text)))
  );

-- Consolidating 2 policies for public.daily_orders.SELECT
DROP POLICY IF EXISTS "daily_orders_select_policy" ON "public"."daily_orders";
DROP POLICY IF EXISTS "Daily orders: select own company" ON "public"."daily_orders";
CREATE POLICY "combined_select_policy" ON "public"."daily_orders" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission(_const_work_orders()::text, 'view'::text))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Consolidating 2 policies for public.external_deductions.SELECT
DROP POLICY IF EXISTS "External deductions: select own company" ON "public"."external_deductions";
DROP POLICY IF EXISTS "external_deductions_select_policy" ON "public"."external_deductions";
CREATE POLICY "combined_select_policy" ON "public"."external_deductions" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance())))) OR 
    ((is_internal_user() AND has_permission('financials'::text, 'view'::text)))
  );

-- Consolidating 2 policies for public.locked_months.ALL
DROP POLICY IF EXISTS "locked_months_manage" ON "public"."locked_months";
DROP POLICY IF EXISTS "Admin/finance can manage locked_months" ON "public"."locked_months";
CREATE POLICY "combined_all_policy" ON "public"."locked_months" FOR ALL
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Consolidating 2 policies for public.locked_months.SELECT
DROP POLICY IF EXISTS "locked_months_select" ON "public"."locked_months";
DROP POLICY IF EXISTS "Active users can view locked_months" ON "public"."locked_months";
CREATE POLICY "combined_select_policy" ON "public"."locked_months" FOR SELECT
  USING (
    (is_active_user(( SELECT auth.uid() AS uid)))
  );

-- Consolidating 2 policies for public.profiles.UPDATE
DROP POLICY IF EXISTS "Admins can update all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "combined_update_policy" ON "public"."profiles" FOR UPDATE
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    ((( SELECT auth.uid() AS uid) = id))
  )
  WITH CHECK (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin()))) OR 
    ((( SELECT auth.uid() AS uid) = id))
  );

-- Consolidating 2 policies for public.salary_records.SELECT
DROP POLICY IF EXISTS "salary_records_select_policy" ON "public"."salary_records";
DROP POLICY IF EXISTS "Salary records: select own company" ON "public"."salary_records";
CREATE POLICY "combined_select_policy" ON "public"."salary_records" FOR SELECT
  USING (
    ((is_internal_user() AND has_permission('salary'::text, 'view'::text))) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND employee_in_my_company(employee_id) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()))))
  );

-- Consolidating 2 policies for public.salary_slip_templates.ALL
DROP POLICY IF EXISTS "Enable write access for authenticated users" ON "public"."salary_slip_templates";
DROP POLICY IF EXISTS "Admin/operations can manage salary_slip_templates" ON "public"."salary_slip_templates";
CREATE POLICY "combined_all_policy" ON "public"."salary_slip_templates" FOR ALL
  USING (
    ((auth.role() = 'authenticated'::text)) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  )
  WITH CHECK (
    ((auth.role() = 'authenticated'::text)) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()))))
  );

-- Consolidating 2 policies for public.salary_slip_templates.SELECT
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."salary_slip_templates";
DROP POLICY IF EXISTS "Active users can view salary_slip_templates" ON "public"."salary_slip_templates";
CREATE POLICY "combined_select_policy" ON "public"."salary_slip_templates" FOR SELECT
  USING (
    (true) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );

-- Consolidating 2 policies for public.user_permissions.SELECT
DROP POLICY IF EXISTS "Users can view own permissions" ON "public"."user_permissions";
DROP POLICY IF EXISTS "Admins can view all permissions" ON "public"."user_permissions";
CREATE POLICY "combined_select_policy" ON "public"."user_permissions" FOR SELECT
  USING (
    ((( SELECT auth.uid() AS uid) = user_id)) OR 
    ((is_active_user(( SELECT auth.uid() AS uid)) AND has_role(( SELECT auth.uid() AS uid), _const_role_admin())))
  );

-- Consolidating 2 policies for public.vehicle_mileage_daily.SELECT
DROP POLICY IF EXISTS "Ops/admin/finance/hr can view vehicle_mileage_daily" ON "public"."vehicle_mileage_daily";
DROP POLICY IF EXISTS "Active users can view vehicle_mileage_daily" ON "public"."vehicle_mileage_daily";
CREATE POLICY "combined_select_policy" ON "public"."vehicle_mileage_daily" FOR SELECT
  USING (
    ((is_active_user(( SELECT auth.uid() AS uid)) AND (has_role(( SELECT auth.uid() AS uid), _const_role_admin()) OR has_role(( SELECT auth.uid() AS uid), _const_role_operations()) OR has_role(( SELECT auth.uid() AS uid), _const_role_finance()) OR has_role(( SELECT auth.uid() AS uid), _const_role_hr())))) OR 
    (is_active_user(( SELECT auth.uid() AS uid)))
  );

-- Consolidating 3 policies for storage.objects.DELETE
DROP POLICY IF EXISTS "Users can delete own avatar" ON "storage"."objects";
DROP POLICY IF EXISTS "Employees docs: delete by employee permissions" ON "storage"."objects";
DROP POLICY IF EXISTS "HR/admin can delete employee documents" ON "storage"."objects";
CREATE POLICY "combined_delete_policy" ON "storage"."objects" FOR DELETE
  USING (
    (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) OR 
    (((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text))) OR 
    (((bucket_id = 'employee-documents'::text) AND (has_role(auth.uid(), _const_role_admin()) OR has_role(auth.uid(), _const_role_hr()))))
  );

-- Consolidating 2 policies for storage.objects.INSERT
DROP POLICY IF EXISTS "Employees docs: upload by employee permissions" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can upload own avatar" ON "storage"."objects";
CREATE POLICY "combined_insert_policy" ON "storage"."objects" FOR INSERT
  WITH CHECK (
    (((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text))) OR 
    (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  );

-- Consolidating 3 policies for storage.objects.SELECT
DROP POLICY IF EXISTS "Public can view avatars" ON "storage"."objects";
DROP POLICY IF EXISTS "Employees docs: view by employee permissions" ON "storage"."objects";
DROP POLICY IF EXISTS "HR/admin can view employee documents" ON "storage"."objects";
CREATE POLICY "combined_select_policy" ON "storage"."objects" FOR SELECT
  USING (
    ((bucket_id = 'avatars'::text)) OR 
    (((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'view'::text))) OR 
    (((bucket_id = 'employee-documents'::text) AND (has_role(auth.uid(), _const_role_admin()) OR has_role(auth.uid(), _const_role_hr()))))
  );

-- Consolidating 2 policies for storage.objects.UPDATE
DROP POLICY IF EXISTS "Users can update own avatar" ON "storage"."objects";
DROP POLICY IF EXISTS "Employees docs: update by employee permissions" ON "storage"."objects";
CREATE POLICY "combined_update_policy" ON "storage"."objects" FOR UPDATE
  USING (
    (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) OR 
    (((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  )
  WITH CHECK (
    (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) OR 
    (((bucket_id = 'employee-documents'::text) AND is_internal_user() AND has_permission('employees'::text, 'write'::text)))
  );

NOTIFY pgrst, 'reload schema';
