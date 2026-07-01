# modules/pages/

هذا المجلد يحتوي على صفحات لم تُنقل بعد إلى modules مستقلة.

## المرجع

| الملف | الوصف | Module المقترح |
|-------|-------|---------------|
| `Alerts.tsx` | صفحة التنبيهات | `modules/alerts/` |
| `EmployeeTiers.tsx` | شرائح الموظفين | `modules/employee-tiers/` |
| `Motorcycles.tsx` | المركبات | `modules/fleet/` |
| `VehicleAssignment.tsx` | توزيع المركبات | `modules/fleet/` |
| `SalarySchemes.tsx` | مخططات الرواتب | `modules/salaries/` |
| `UsersAndPermissions.tsx` | المستخدمين والصلاحيات | `modules/users/` |
| `Attendance.tsx` | الحضور والانصراف | `modules/attendance/` |
| `Apps.tsx` | التطبيقات | `modules/apps/` |
| `Dashboard.tsx` | لوحة التحكم | `modules/dashboard/` |
| `Login.tsx` / `ForgotPassword.tsx` / `ResetPassword.tsx` | صفحات المصادقة | `modules/auth/` |
| `ProfilePage.tsx` | الملف الشخصي | `modules/profile/` |
| `SettingsHub.tsx` | الإعدادات | `modules/settings/` |

## عند نقل صفحة

1. أنشئ المجلد الجديد (مثلاً `modules/alerts/pages/`)
2. انقل الملف
3. حدّث الـ import في `app/App.tsx`
4. تأكد إن الـ routing يشتغل
