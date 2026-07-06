# خريطة معمارية النظام (System Architecture Map)

هذا الملف يوضح الملفات البرمجية والجداول التي تتصل بها في قاعدة بيانات Supabase بشكل مباشر:

### الملف: `frontend\modules\pages\Alerts.tsx`
- **يتصل بجداول:** platform_accounts

### الملف: `frontend\services\accountAssignmentService.ts`
- **يتصل بجداول:** account_assignments

### الملف: `frontend\services\advanceService.ts`
- **يتصل بجداول:** advances, advance_installments

### الملف: `frontend\services\alertsService.ts`
- **يتصل بجداول:** spare_parts

### الملف: `frontend\services\appService.ts`
- **يتصل بجداول:** daily_shifts, daily_orders, apps, employee_apps, app_targets, pricing_rules, app_hybrid_rules

### الملف: `frontend\services\attendanceService.ts`
- **يتصل بجداول:** attendance

### الملف: `frontend\services\auditService.ts`
- **يتصل بجداول:** admin_action_log

### الملف: `frontend\services\dashboardService.ts`
- **يتصل بجداول:** advances, profiles, salary_records, vehicle_mileage_daily, employees, attendance, maintenance_logs

### الملف: `frontend\services\employeeTierService.ts`
- **يتصل بجداول:** apps, employees, employee_tiers

### الملف: `frontend\services\maintenanceService.ts`
- **يتصل بجداول:** maintenance_parts, spare_parts, maintenance_logs

### الملف: `frontend\services\orderService.ts`
- **يتصل بجداول:** locked_months, daily_orders

### الملف: `frontend\services\salaryDraftService.ts`
- **يتصل بجداول:** salary_drafts

### الملف: `frontend\services\salarySchemeService.ts`
- **يتصل بجداول:** salary_schemes, scheme_month_snapshots, salary_scheme_tiers

### الملف: `frontend\services\salaryService.ts`
- **يتصل بجداول:** salary_records

### الملف: `frontend\services\settingsHubService.ts`
- **يتصل بجداول:** trade_registers, system_settings, profiles

### الملف: `frontend\services\shiftService.ts`
- **يتصل بجداول:** daily_shifts

### الملف: `frontend\services\userPermissionService.ts`
- **يتصل بجداول:** user_permissions, user_roles, profiles

### الملف: `frontend\services\vehicleService.ts`
- **يتصل بجداول:** vehicles, vehicle_assignments, vehicle_documents

### الملف: `frontend\services\violationService.ts`
- **يتصل بجداول:** vehicles, advances, advance_installments, external_deductions

