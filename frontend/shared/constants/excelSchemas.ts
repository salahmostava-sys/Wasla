export const EMPLOYEE_IMPORT_COLUMNS = [
  { key: 'name', label: 'الاسم' },
  { key: 'name_en', label: 'الاسم (إنجليزي)' },
  { key: 'national_id', label: 'رقم الهوية' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'cities', label: 'المدن (افصل بينها بفاصلة)' },
  { key: 'nationality', label: 'الجنسية' },
  { key: 'job_title', label: 'المسمى الوظيفي' },
  { key: 'join_date', label: 'تاريخ الانضمام' },
  { key: 'birth_date', label: 'تاريخ الميلاد' },
  { key: 'probation_end_date', label: 'انتهاء فترة التجربة' },
  { key: 'residency_expiry', label: 'انتهاء الإقامة' },
  { key: 'health_insurance_expiry', label: 'انتهاء التأمين الصحي' },
  { key: 'license_expiry', label: 'انتهاء الرخصة' },
  { key: 'license_status', label: 'حالة الرخصة (has_license/no_license/applied)' },
  { key: 'sponsorship_status', label: 'حالة الكفالة (sponsored/not_sponsored/absconded/terminated)' },
  { key: 'bank_account_number', label: 'رقم الحساب البنكي' },
  { key: 'iban', label: 'IBAN' },
  { key: 'commercial_record', label: 'رقم السجل التجاري' },
  { key: 'salary_type', label: 'نوع الراتب (orders/shift)' },
  { key: 'status', label: 'الحالة (active/inactive/ended)' },
] as const;

/** ترتيب مطابق لجدول «بيانات الدبابات» (للتصدير/القالب/الاستيراد) — آخر عمود للقراءة فقط عند التصدير */
export const MOTORCYCLE_IO_COLUMNS = [
  { key: 'plate_number', label: 'رقم اللوحة ar' },
  { key: 'plate_number_en', label: 'رقم اللوحة en' },
  { key: 'type', label: 'النوع' },
  { key: 'brand', label: 'الماركة' },
  { key: 'model', label: 'الموديل' },
  { key: 'year', label: 'سنة الصنع' },
  { key: 'serial_number', label: 'الرقم التسلسلي' },
  { key: 'chassis_number', label: 'رقم الهيكل' },
  { key: 'notes', label: 'ملاحظات' },
  { key: 'current_rider', label: 'المندوب الحالي' },
  { key: 'status', label: 'الحالة' },
  { key: 'has_fuel_chip', label: 'شريحة البنزين' },
  { key: 'insurance_expiry', label: 'انتهاء التأمين' },
  { key: 'registration_expiry', label: 'انتهاء التسجيل' },
  { key: 'authorization_expiry', label: 'انتهاء التفويض' },
] as const;

export const ADVANCE_IO_COLUMNS = [
  { key: 'name', label: 'الاسم' },
  { key: 'amount', label: 'المبلغ' },
  { key: 'monthly_amount', label: 'القسط' },
  { key: 'disbursement_date', label: 'تاريخ الصرف' },
  { key: 'first_deduction_month', label: 'أول شهر خصم' },
] as const;

export function buildOrdersIoHeaders(days: number[]): string[] {
  return ['الاسم', ...days.map(String), 'المجموع'];
}
