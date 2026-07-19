
-- Step 2: Tighten all RLS policies with is_active_user check

-- EMPLOYEES
DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
CREATE POLICY "Active users can view employees"
  ON public.employees FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;
CREATE POLICY "HR/admin can manage employees"
  ON public.employees FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

-- ATTENDANCE
DROP POLICY IF EXISTS "Authenticated can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR/admin can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Active users can view attendance" ON public.attendance;
CREATE POLICY "Active users can view attendance"
  ON public.attendance FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "HR/admin can manage attendance" ON public.attendance;
CREATE POLICY "HR/admin can manage attendance"
  ON public.attendance FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

-- ADVANCES
DROP POLICY IF EXISTS "Authenticated can view advances" ON public.advances;
DROP POLICY IF EXISTS "Finance/admin can manage advances" ON public.advances;
DROP POLICY IF EXISTS "Active users can view advances" ON public.advances;
CREATE POLICY "Active users can view advances"
  ON public.advances FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Finance/admin can manage advances" ON public.advances;
CREATE POLICY "Finance/admin can manage advances"
  ON public.advances FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- ADVANCE_INSTALLMENTS
DROP POLICY IF EXISTS "Authenticated can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin can manage advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Active users can view advance_installments" ON public.advance_installments;
CREATE POLICY "Active users can view advance_installments"
  ON public.advance_installments FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Finance/admin can manage advance_installments" ON public.advance_installments;
CREATE POLICY "Finance/admin can manage advance_installments"
  ON public.advance_installments FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- SALARY RECORDS
DROP POLICY IF EXISTS "Finance/admin can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;
CREATE POLICY "Finance/admin can view salary_records"
  ON public.salary_records FOR SELECT
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;
CREATE POLICY "Finance/admin can manage salary_records"
  ON public.salary_records FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- EXTERNAL DEDUCTIONS
DROP POLICY IF EXISTS "Finance/admin can view external_deductions" ON public.external_deductions;
DROP POLICY IF EXISTS "Finance/admin can manage external_deductions" ON public.external_deductions;
CREATE POLICY "Finance/admin can view external_deductions"
  ON public.external_deductions FOR SELECT
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));
DROP POLICY IF EXISTS "Finance/admin can manage external_deductions" ON public.external_deductions;
CREATE POLICY "Finance/admin can manage external_deductions"
  ON public.external_deductions FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- ALERTS
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "System can manage alerts" ON public.alerts;
DROP POLICY IF EXISTS "Active users can view alerts" ON public.alerts;
CREATE POLICY "Active users can view alerts"
  ON public.alerts FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "HR/admin can manage alerts" ON public.alerts;
CREATE POLICY "HR/admin can manage alerts"
  ON public.alerts FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

-- DAILY ORDERS
DROP POLICY IF EXISTS "Authenticated can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Operations/admin can manage daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Active users can view daily_orders" ON public.daily_orders;
CREATE POLICY "Active users can view daily_orders"
  ON public.daily_orders FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Operations/admin can manage daily_orders" ON public.daily_orders;
CREATE POLICY "Operations/admin can manage daily_orders"
  ON public.daily_orders FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations') OR has_role(auth.uid(), 'hr')));

-- VEHICLES
DROP POLICY IF EXISTS "Authenticated can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Operations/admin can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Active users can view vehicles" ON public.vehicles;
CREATE POLICY "Active users can view vehicles"
  ON public.vehicles FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Operations/admin can manage vehicles" ON public.vehicles;
CREATE POLICY "Operations/admin can manage vehicles"
  ON public.vehicles FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

-- VEHICLE ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated can view vehicle_assignments" ON public.vehicle_assignments;
DROP POLICY IF EXISTS "Operations/admin can manage vehicle_assignments" ON public.vehicle_assignments;
DROP POLICY IF EXISTS "Active users can view vehicle_assignments" ON public.vehicle_assignments;
CREATE POLICY "Active users can view vehicle_assignments"
  ON public.vehicle_assignments FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Operations/admin can manage vehicle_assignments" ON public.vehicle_assignments;
CREATE POLICY "Operations/admin can manage vehicle_assignments"
  ON public.vehicle_assignments FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

-- VEHICLE MILEAGE
DROP POLICY IF EXISTS "Authenticated can view vehicle_mileage" ON public.vehicle_mileage;
DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage" ON public.vehicle_mileage;
DROP POLICY IF EXISTS "Active users can view vehicle_mileage" ON public.vehicle_mileage;
CREATE POLICY "Active users can view vehicle_mileage"
  ON public.vehicle_mileage FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage" ON public.vehicle_mileage;
CREATE POLICY "Admin/operations can manage vehicle_mileage"
  ON public.vehicle_mileage FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')))
  WITH CHECK (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

-- EMPLOYEE APPS
DROP POLICY IF EXISTS "Authenticated can view employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "HR/admin can manage employee_apps" ON public.employee_apps;
DROP POLICY IF EXISTS "Active users can view employee_apps" ON public.employee_apps;
CREATE POLICY "Active users can view employee_apps"
  ON public.employee_apps FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "HR/admin can manage employee_apps" ON public.employee_apps;
CREATE POLICY "HR/admin can manage employee_apps"
  ON public.employee_apps FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

-- EMPLOYEE SCHEME
DROP POLICY IF EXISTS "Authenticated can view employee_scheme" ON public.employee_scheme;
DROP POLICY IF EXISTS "HR/admin can manage employee_scheme" ON public.employee_scheme;
DROP POLICY IF EXISTS "Active users can view employee_scheme" ON public.employee_scheme;
CREATE POLICY "Active users can view employee_scheme"
  ON public.employee_scheme FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "HR/admin can manage employee_scheme" ON public.employee_scheme;
CREATE POLICY "HR/admin can manage employee_scheme"
  ON public.employee_scheme FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'hr')));

-- MAINTENANCE LOGS
DROP POLICY IF EXISTS "Authenticated can view maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs;
CREATE POLICY "Active users can view maintenance_logs"
  ON public.maintenance_logs FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs;
CREATE POLICY "Operations/admin can manage maintenance_logs"
  ON public.maintenance_logs FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operations')));

-- APPS (delivery apps)
DROP POLICY IF EXISTS "Authenticated can view apps" ON public.apps;
DROP POLICY IF EXISTS "Admins can manage apps" ON public.apps;
DROP POLICY IF EXISTS "Active users can view apps" ON public.apps;
CREATE POLICY "Active users can view apps"
  ON public.apps FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage apps" ON public.apps;
CREATE POLICY "Admins can manage apps"
  ON public.apps FOR ALL
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- SALARY SCHEMES
DROP POLICY IF EXISTS "Authenticated can view schemes" ON public.salary_schemes;
DROP POLICY IF EXISTS "Admins/finance can manage schemes" ON public.salary_schemes;
DROP POLICY IF EXISTS "Active users can view salary_schemes" ON public.salary_schemes;
CREATE POLICY "Active users can view salary_schemes"
  ON public.salary_schemes FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins/finance can manage salary_schemes" ON public.salary_schemes;
CREATE POLICY "Admins/finance can manage salary_schemes"
  ON public.salary_schemes FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- SALARY SCHEME TIERS
DROP POLICY IF EXISTS "Authenticated can view scheme tiers" ON public.salary_scheme_tiers;
DROP POLICY IF EXISTS "Admins/finance can manage scheme tiers" ON public.salary_scheme_tiers;
DROP POLICY IF EXISTS "Active users can view salary_scheme_tiers" ON public.salary_scheme_tiers;
CREATE POLICY "Active users can view salary_scheme_tiers"
  ON public.salary_scheme_tiers FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins/finance can manage salary_scheme_tiers" ON public.salary_scheme_tiers;
CREATE POLICY "Admins/finance can manage salary_scheme_tiers"
  ON public.salary_scheme_tiers FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- SCHEME MONTH SNAPSHOTS
DROP POLICY IF EXISTS "Authenticated can view scheme_month_snapshots" ON public.scheme_month_snapshots;
DROP POLICY IF EXISTS "Admins/finance can manage scheme_month_snapshots" ON public.scheme_month_snapshots;
DROP POLICY IF EXISTS "Active users can view scheme_month_snapshots" ON public.scheme_month_snapshots;
CREATE POLICY "Active users can view scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins/finance can manage scheme_month_snapshots" ON public.scheme_month_snapshots;
CREATE POLICY "Admins/finance can manage scheme_month_snapshots"
  ON public.scheme_month_snapshots FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));

-- TRADE REGISTERS
DROP POLICY IF EXISTS "Authenticated can view trade_registers" ON public.trade_registers;
DROP POLICY IF EXISTS "Admins can manage trade_registers" ON public.trade_registers;
DROP POLICY IF EXISTS "Active users can view trade_registers" ON public.trade_registers;
CREATE POLICY "Active users can view trade_registers"
  ON public.trade_registers FOR SELECT USING (is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins can manage trade_registers" ON public.trade_registers;
CREATE POLICY "Admins can manage trade_registers"
  ON public.trade_registers FOR ALL
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- AUDIT LOG
DROP POLICY IF EXISTS "Admins can view audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit_log" ON public.audit_log;
CREATE POLICY "Admins can view audit_log"
  ON public.audit_log FOR SELECT
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Active users can insert audit_log" ON public.audit_log;
CREATE POLICY "Active users can insert audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (is_active_user(auth.uid()) AND auth.uid() = user_id);

-- PL RECORDS
DROP POLICY IF EXISTS "Finance/admin can view pl_records" ON public.pl_records;
DROP POLICY IF EXISTS "Finance/admin can manage pl_records" ON public.pl_records;
CREATE POLICY "Finance/admin can view pl_records"
  ON public.pl_records FOR SELECT
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));
DROP POLICY IF EXISTS "Finance/admin can manage pl_records" ON public.pl_records;
CREATE POLICY "Finance/admin can manage pl_records"
  ON public.pl_records FOR ALL
  USING (is_active_user(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance')));
