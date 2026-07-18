import { useState, useEffect, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@app/providers/LanguageContext';
import {
  Search, RefreshCw, X, Activity, FolderOpen,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  User,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { format } from 'date-fns';
import { settingsHubService } from '@services/settingsHubService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';
import { usePermissions } from '@shared/hooks/usePermissions';

interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  user_id: string | null;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  profile?: { name: string | null; email: string | null } | null;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
}

type ReferenceLabels = Record<string, string>;

const PAGE_SIZE = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actionColors: Record<string, string> = {
  INSERT: 'bg-success/10 text-success border-success/20',
  UPDATE: 'bg-warning/10 text-warning border-warning/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
};

const actionLabels: Record<string, { ar: string; en: string }> = {
  INSERT: { ar: 'إضافة', en: 'Create' },
  UPDATE: { ar: 'تعديل', en: 'Update' },
  DELETE: { ar: 'حذف', en: 'Delete' },
};

const tableLabels: Record<string, { ar: string; en: string }> = {
  // Core HR
  employees:              { ar: 'الموظفون', en: 'Employees' },
  employee_scheme:        { ar: 'سكيم الموظف', en: 'Employee Scheme' },
  employee_tiers:         { ar: 'شرائح الموظفين', en: 'Employee Tiers' },
  employee_roles:         { ar: 'أدوار الموظفين', en: 'Employee Roles' },
  employee_targets:       { ar: 'أهداف الموظفين', en: 'Employee Targets' },
  attendance:             { ar: 'الحضور', en: 'Attendance' },
  attendance_status_configs: { ar: 'إعدادات حالات الحضور', en: 'Attendance Status Settings' },
  daily_shifts:           { ar: 'الدوام', en: 'Shifts' },
  leave_requests:         { ar: 'طلبات الإجازة', en: 'Leave Requests' },
  hr_performance_reviews: { ar: 'تقييمات الأداء', en: 'Performance Reviews' },
  departments:            { ar: 'الأقسام', en: 'Departments' },
  positions:              { ar: 'المسميات الوظيفية', en: 'Positions' },
  advances:               { ar: 'السلف', en: 'Advances' },
  advance_installments:   { ar: 'أقساط السلف', en: 'Advance Installments' },
  salary_records:         { ar: 'الرواتب', en: 'Salaries' },
  salary_deductions:      { ar: 'خصومات الرواتب', en: 'Salary Deductions' },
  external_deductions:    { ar: 'الخصومات الخارجية', en: 'External Deductions' },
  // Orders
  daily_orders:           { ar: 'الطلبات', en: 'Orders' },
  order_import_batches:   { ar: 'دفعات استيراد الطلبات', en: 'Order Import Batches' },
  apps:                   { ar: 'التطبيقات', en: 'Apps' },
  app_monthly_activations:{ ar: 'تفعيل التطبيقات الشهري', en: 'Monthly App Activations' },
  app_targets:            { ar: 'أهداف التطبيقات', en: 'App Targets' },
  employee_apps:          { ar: 'تعيينات التطبيقات', en: 'Employee Apps' },
  platform_accounts:      { ar: 'حسابات المنصات', en: 'Platform Accounts' },
  account_assignments:    { ar: 'تعيين الحسابات', en: 'Account Assignments' },
  // Vehicles
  vehicles:               { ar: 'المركبات', en: 'Vehicles' },
  vehicle_assignments:    { ar: 'تسليم العهد', en: 'Vehicle Assignments' },
  vehicle_documents:      { ar: 'مستندات المركبات', en: 'Vehicle Documents' },
  vehicle_mileage:        { ar: 'عداد المركبات', en: 'Vehicle Mileage' },
  vehicle_mileage_daily:  { ar: 'عداد المركبات اليومي', en: 'Daily Vehicle Mileage' },
  fuel_records:           { ar: 'سجل الوقود', en: 'Fuel Records' },
  maintenance_records:    { ar: 'صيانة المركبات', en: 'Maintenance' },
  maintenance_logs:       { ar: 'سجلات الصيانة', en: 'Maintenance Logs' },
  maintenance_parts:      { ar: 'قطع الصيانة', en: 'Maintenance Parts' },
  spare_parts:            { ar: 'قطع الغيار', en: 'Spare Parts' },
  vehicle_fines:          { ar: 'مخالفات المركبات', en: 'Vehicle Fines' },
  // Finance
  employee_wallet_transactions: { ar: 'حركات محفظة الموظف', en: 'Employee Wallet Transactions' },
  treasury_accounts:      { ar: 'حسابات الخزينة', en: 'Treasury Accounts' },
  treasury_categories:    { ar: 'تصنيفات الخزينة', en: 'Treasury Categories' },
  treasury_transactions:  { ar: 'حركات الخزينة', en: 'Treasury Transactions' },
  finance_transactions:   { ar: 'الحركات المالية', en: 'Finance Transactions' },
  // System
  alerts:                 { ar: 'التنبيهات', en: 'Alerts' },
  profiles:               { ar: 'الملفات الشخصية', en: 'Profiles' },
  user_roles:             { ar: 'الأدوار', en: 'Roles' },
  user_permissions:       { ar: 'الصلاحيات', en: 'Permissions' },
  system_settings:        { ar: 'إعدادات النظام', en: 'System Settings' },
  trade_registers:        { ar: 'السجل التجاري', en: 'Trade Registers' },
  commercial_records:     { ar: 'السجلات التجارية', en: 'Commercial Records' },
  salary_slips:           { ar: 'قسائم الرواتب', en: 'Salary Slips' },
  slip_templates:         { ar: 'قوالب القسائم', en: 'Slip Templates' },
  salary_schemes:         { ar: 'سكيمات الرواتب', en: 'Salary Schemes' },
  salary_scheme_tiers:    { ar: 'شرائح سكيمات الرواتب', en: 'Salary Scheme Tiers' },
  salary_tiers:           { ar: 'شرائح الرواتب', en: 'Salary Tiers' },
  salary_drafts:          { ar: 'مسودات الرواتب', en: 'Salary Drafts' },
  salary_month_snapshots: { ar: 'لقطات الرواتب الشهرية', en: 'Salary Month Snapshots' },
  salary_slip_templates:  { ar: 'قوالب قسائم الرواتب', en: 'Salary Slip Templates' },
  scheme_month_snapshots: { ar: 'لقطات السكيم الشهرية', en: 'Scheme Month Snapshots' },
  pricing_rules:          { ar: 'قواعد التسعير', en: 'Pricing Rules' },
  locked_months:          { ar: 'الشهور المقفلة', en: 'Locked Months' },
};

/** Arabic labels for common DB field names */
const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم',
  name_en: 'الاسم (إنجليزي)',
  status: 'الحالة',
  salary: 'الراتب',
  amount: 'المبلغ',
  date: 'التاريخ',
  notes: 'ملاحظات',
  employee_id: 'اسم الموظف',
  app_id: 'التطبيق',
  hours_worked: 'ساعات العمل',
  attendance_status: 'حالة الحضور',
  start_date: 'تاريخ البداية',
  end_date: 'تاريخ النهاية',
  leave_type: 'نوع الإجازة',
  leave_status: 'حالة الطلب',
  rating: 'التقييم',
  review_date: 'تاريخ التقييم',
  document_type: 'نوع الوثيقة',
  expiry_date: 'تاريخ الانتهاء',
  brand_color: 'لون التطبيق',
  salary_type: 'نوع الراتب',
  total_amount: 'الإجمالي',
  net_amount: 'الصافي',
  deduction_amount: 'الخصم',
  phone: 'الجوال',
  email: 'البريد الإلكتروني',
  role: 'الدور',
  orders_count: 'عدد الطلبات',
  source: 'المصدر',
  month_year: 'الشهر',
  payment_method: 'طريقة الدفع',
  manual_deduction: 'خصم يدوي',
  manual_deduction_note: 'ملاحظة الخصم',
  license_plate: 'رقم اللوحة',
  model: 'الموديل',
  year: 'السنة',
  color: 'اللون',
  is_active: 'الحالة',
  can_view: 'صلاحية العرض',
  can_edit: 'صلاحية التعديل',
  can_delete: 'صلاحية الحذف',
  permission_key: 'الصفحة',
};

const TECHNICAL_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'import_batch_id',
]);

const toShortText = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > 30 ? `${str.slice(0, 30)}...` : str;
};

const toReadableValue = (key: string, value: unknown, referenceLabels: ReferenceLabels = {}) => {
  if (value === null || value === undefined || value === '') return 'غير محدد';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') {
    if ((key.endsWith('_id') || key === 'id') && referenceLabels[value]) return referenceLabels[value];
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return format(new Date(value), 'yyyy-MM-dd HH:mm');
    return value;
  }
  return JSON.stringify(value);
};

const visibleEntries = (value: Record<string, unknown>) =>
  Object.entries(value).filter(([key]) => !TECHNICAL_FIELDS.has(key));

const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key.replaceAll('_', ' ');

const collectAuditReferenceIds = (logs: AuditLog[]) => {
  const employeeIds = new Set<string>();
  const appIds = new Set<string>();

  logs.forEach((log) => {
    [log.old_value, log.new_value].forEach((payload) => {
      if (!payload) return;
      const employeeId = payload.employee_id;
      const appId = payload.app_id;
      if (typeof employeeId === 'string' && UUID_PATTERN.test(employeeId)) employeeIds.add(employeeId);
      if (typeof appId === 'string' && UUID_PATTERN.test(appId)) appIds.add(appId);
    });
  });

  return {
    employeeIds: Array.from(employeeIds),
    appIds: Array.from(appIds),
  };
};

const changedEntries = (log: AuditLog, referenceLabels: ReferenceLabels = {}) => {
  const oldValue = log.old_value || {};
  const newValue = log.new_value || {};
  const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));
  return keys
    .filter((key) => !TECHNICAL_FIELDS.has(key))
    .filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
    .map((key) => ({
      key,
      label: fieldLabel(key),
      before: toReadableValue(key, oldValue[key], referenceLabels),
      after: toReadableValue(key, newValue[key], referenceLabels),
    }));
};

const buildChangeSummary = (log: AuditLog, referenceLabels: ReferenceLabels = {}) => {
  const oldV = log.old_value || {};
  const newV = log.new_value || {};

  if (log.action === 'INSERT') {
    return visibleEntries(newV)
      .slice(0, 3)
      .map(([key, value]) => `${fieldLabel(key)}: ${toShortText(toReadableValue(key, value, referenceLabels))}`)
      .join(' | ');
  }
  if (log.action === 'DELETE') {
    return visibleEntries(oldV)
      .slice(0, 3)
      .map(([key, value]) => `${fieldLabel(key)}: ${toShortText(toReadableValue(key, value, referenceLabels))}`)
      .join(' | ');
  }
  return changedEntries(log, referenceLabels)
    .slice(0, 3)
    .map((entry) => `${entry.label}: ${entry.before} ← ${entry.after}`)
    .join(' | ');
};

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => `skeleton-row-${i}`);

const hasPayload = (log: AuditLog) =>
  Boolean(
    (log.old_value && Object.keys(log.old_value).length > 0) ||
      (log.new_value && Object.keys(log.new_value).length > 0)
  );

/** Avatar initial letter for user display */
const avatarChar = (profile: { name: string | null; email: string | null }) =>
  ((profile.name || profile.email || '?')[0] ?? '?').toUpperCase();

/** Resolve display name from profile */
const displayName = (profile: { name: string | null; email: string | null } | null | undefined) => {
  if (!profile) return null;
  return profile.name || profile.email?.split('@')[0] || 'مستخدم';
};

function resolveUserLabel(
  profile: { name: string | null; email: string | null } | null | undefined,
  userId: string | null,
): string {
  if (profile) return displayName(profile) ?? 'مستخدم';
  if (userId) return 'مستخدم محذوف';
  return 'النظام';
}

export default function ActivityLogContent() {
  const { isRTL } = useLanguage();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: _settingsPerms } = usePermissions('settings');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [filterUserId, setFilterUserId] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch distinct users who appear in audit logs (for the user filter dropdown)
  const { data: auditUsers = [] } = useQuery<UserProfile[]>({
    queryKey: ['audit-log-users', uid],
    enabled,
    queryFn: async () => {
      const profiles = await settingsHubService.getAuditUsers();
      return profiles;
    },
    staleTime: 60_000,
  });

  const {
    data: logsData,
    isLoading: loading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['activity-log', uid, page, filterAction, filterTable, filterUserId, debouncedSearch],
    enabled,
    queryFn: async () => {
      const { rows: data, total: count } = await settingsHubService.getAuditLogs(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1,
        filterAction,
        filterTable,
        debouncedSearch,
        filterUserId,
      );

      const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))] as string[];
      const profileMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const profiles = await settingsHubService.getAuditProfilesByIds(userIds);
        profiles.forEach((p) => { profileMap[p.id] = { name: p.name, email: p.email }; });
      }

      const rows = (data || []).map((l) => ({
        ...l,
        old_value: l.old_value as Record<string, unknown> | null,
        new_value: l.new_value as Record<string, unknown> | null,
        profile: l.user_id ? (profileMap[l.user_id] ?? null) : null,
      }));
      const referenceLabels = await settingsHubService.getAuditReferenceLabels(collectAuditReferenceIds(rows));

      return {
        rows,
        total: count || 0,
        referenceLabels,
      };
    },
    retry: defaultQueryRetry,
    staleTime: 15_000,
  });

  useEffect(() => {
    setLogs(logsData?.rows || []);
    setTotalCount(logsData?.total || 0);
  }, [logsData]);

  useEffect(() => { setPage(0); }, [filterAction, filterTable, filterUserId, debouncedSearch]);
  useEffect(() => { setExpandedId(null); }, [page]);

  const referenceLabels = logsData?.referenceLabels ?? {};

  const handleExport = async () => {
    try {
      const data = await settingsHubService.getAuditLogsForExport();
      if (!data.length) return;
      const rows = data.map(l => ({
        'التاريخ':         format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'اسم المستخدم':   l.user_name ?? '',
        'البريد الإلكتروني': l.user_email ?? '',
        'الوحدة':         tableLabels[l.table_name]?.ar || l.table_name,
        'العملية':        actionLabels[l.action]?.ar || l.action,
        'معرف السجل':     l.record_id ?? '',
      }));
      const XLSX = await loadXlsx();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'سجل النشاطات');
      XLSX.writeFile(wb, `سجل_النشاطات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      logError('[ActivityLog] export failed', err);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const getActionLabel = (action: string) => actionLabels[action]?.ar || action;
  const getTableLabel  = (table: string)  => tableLabels[table]?.ar  || table;
  const activeFilters  = [filterAction !== 'all', filterTable !== 'all', filterUserId !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Section header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border" >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary"
          
        >
          <Activity size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground" >
            سجل النشاطات
          </h2>
          <p className="text-xs text-muted-foreground" >
            {`${totalCount.toLocaleString('en-US')} سجل محفوظ`}
          </p>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => refetchLogs().catch(() => {})}>
            <RefreshCw size={13} /> تحديث
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <FolderOpen size={13} /> ملفات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-3 bg-muted"
        
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الجداول أو معرف السجل..."
            className={`h-8 text-sm ${isRTL ? 'pr-8' : 'pl-8'}`}
          />
        </div>

        {/* User filter */}
        {auditUsers.length > 0 && (
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="h-8 text-xs w-44">
              <User size={11} className="me-1 text-muted-foreground flex-shrink-0" />
              <SelectValue placeholder="كل المستخدمين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المستخدمين</SelectItem>
              {auditUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email?.split('@')[0] || u.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Action filter */}
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العمليات</SelectItem>
            <SelectItem value="INSERT">إضافة</SelectItem>
            <SelectItem value="UPDATE">تعديل</SelectItem>
            <SelectItem value="DELETE">حذف</SelectItem>
          </SelectContent>
        </Select>

        {/* Table filter */}
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوحدات</SelectItem>
            {Object.entries(tableLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label.ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {activeFilters > 0 && (
          <button type="button"
            onClick={() => { setFilterAction('all'); setFilterTable('all'); setFilterUserId('all'); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={12} /> مسح
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px]">
              {activeFilters}
            </Badge>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden shadow-card" >
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-muted border-b border-border" >
                {['التاريخ والوقت', 'المستخدم', 'العملية', 'الوحدة', 'التفاصيل'].map((h, i) => (
                  <th
                    key={h}
                    className={`text-muted-foreground p-3 text-xs font-semibold whitespace-nowrap text-start ${i === 4 ? 'hidden lg:table-cell' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-background" >

              {/* Loading skeletons */}
              {loading && SKELETON_ROWS.map((k) => (
                <tr className="border-b border-border" key={k} >
                  <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="p-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-40" /></td>
                </tr>
              ))}

              {/* Empty state */}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="ta-td p-12">
                    <Activity size={32} className="mx-auto mb-3 opacity-20 text-muted-foreground"  />
                    <p className="text-sm text-muted-foreground" >لا توجد سجلات</p>
                  </td>
                </tr>
              )}

              {/* Log rows */}
              {!loading && logs.map(log => (
                <Fragment key={log.id}>
                  <tr
                    className={`transition-colors hover:bg-muted
                      ${expandedId === log.id ? 'bg-muted border-b-0' : 'border-b border-border'}
                      ${hasPayload(log) ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!hasPayload(log)) return;
                      setExpandedId(expandedId === log.id ? null : log.id);
                    }}
                  >
                    {/* Date / Time */}
                    <td className="ta-td p-3">
                      <p className="text-xs font-medium text-foreground"  dir="ltr">
                        {format(new Date(log.created_at), 'yyyy-MM-dd')}
                      </p>
                      <p className="text-[10px] text-muted-foreground"  dir="ltr">
                        {format(new Date(log.created_at), 'HH:mm:ss')}
                      </p>
                    </td>

                    {/* User */}
                    <td className="p-3">
                      {log.profile ? (
                        /* Known user with profile */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-primary/10 text-primary"
                            
                          >
                            {avatarChar(log.profile)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate max-w-[120px] text-foreground" >
                              {displayName(log.profile)}
                            </p>
                            {log.profile.email && (
                              <p className="text-[10px] truncate max-w-[120px] text-muted-foreground"  dir="ltr">
                                {log.profile.email}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : log.user_id ? ( // NOSONAR
                        /* user_id exists but no matching profile (deleted user) */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground"
                            
                          >
                            <User size={12} />
                          </div>
                          <div>
                            <p className="text-xs text-foreground" >مستخدم محذوف</p>
                            <p className="text-[9px] font-mono text-muted-foreground" >
                              {log.user_id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* No user_id at all — system trigger */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 bg-muted/60 text-muted-foreground"
                            
                          >
                            ⚙️
                          </div>
                          <span className="text-xs text-muted-foreground" >
                            النظام
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Action badge */}
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionColors[log.action] || 'bg-muted text-muted-foreground border-border'}`}
                      >
                        {getActionLabel(log.action)}
                      </span>
                    </td>

                    {/* Table / Module */}
                    <td className="p-3">
                      <span className="text-xs font-medium text-foreground" >
                        {getTableLabel(log.table_name)}
                      </span>
                      <p className="text-[10px] font-mono opacity-50 text-muted-foreground" >
                        {log.table_name}
                      </p>
                    </td>

                    {/* Change summary */}
                    <td className="p-3 hidden lg:table-cell max-w-xs">
                      <div className="flex items-start gap-1.5">
                        {hasPayload(log) && (
                          <span className="flex-shrink-0 mt-0.5 text-muted-foreground" >
                            {expandedId === log.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          {(log.new_value || log.old_value) && (
                            <p
                              className="text-[10px] font-mono truncate max-w-[220px] text-muted-foreground"
                              
                              title={buildChangeSummary(log, referenceLabels)}
                            >
                              {buildChangeSummary(log, referenceLabels) || '—'}
                            </p>
                          )}
                          {log.record_id && (
                            <p className="text-[9px] font-mono mt-0.5 opacity-40" dir="ltr">
                              #{log.record_id.slice(0, 8)}…
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded payload */}
                  {expandedId === log.id && (
                    <tr className="border-b border-border" >
                      <td colSpan={5} className="p-0 bg-background" >
                        <div className="p-4 border-t border-border" >

                          {/* Header: who did what */}
                          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground" >
                            <span className="font-semibold text-foreground" >
                              {resolveUserLabel(log.profile, log.user_id)}
                            </span>
                            <span>قام بـ</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${actionColors[log.action] ?? ''}`}>
                              {getActionLabel(log.action)}
                            </span>
                            <span>في</span>
                            <span className="font-semibold text-foreground" >
                              {getTableLabel(log.table_name)}
                            </span>
                            <span className="opacity-50 ms-1" dir="ltr">
                              — {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                            </span>
                          </div>

                          {log.action === 'UPDATE' && (
                            <div className="rounded-lg border border-border overflow-hidden">
                              <table className="data-table data-table-compact w-full text-xs">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="p-2 text-start font-semibold">البيان</th>
                                    <th className="p-2 text-start font-semibold">قبل التعديل</th>
                                    <th className="p-2 text-start font-semibold">بعد التعديل</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changedEntries(log, referenceLabels).map((entry) => (
                                    <tr key={entry.key} className="border-t border-border">
                                      <td className="p-2 font-medium text-foreground">{entry.label}</td>
                                      <td className="p-2 text-muted-foreground">{entry.before}</td>
                                      <td className="p-2 text-foreground">{entry.after}</td>
                                    </tr>
                                  ))}
                                  {changedEntries(log, referenceLabels).length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                        لا توجد تغييرات واضحة للعرض.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {log.action === 'INSERT' && (
                            <div>
                              <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1 text-foreground" >
                                <span className="text-emerald-500">●</span> البيانات التي تمت إضافتها
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {visibleEntries(log.new_value || {}).map(([key, value]) => (
                                  <div key={key} className="rounded-lg border border-border bg-muted/40 p-2">
                                    <p className="text-[10px] text-muted-foreground">{fieldLabel(key)}</p>
                                    <p className="text-xs font-medium text-foreground">{toReadableValue(key, value, referenceLabels)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {log.action === 'DELETE' && (
                            <div>
                              <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1 text-foreground" >
                                <span className="text-rose-500">●</span> البيانات التي تم حذفها
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {visibleEntries(log.old_value || {}).map(([key, value]) => (
                                  <div key={key} className="rounded-lg border border-border bg-muted/40 p-2">
                                    <p className="text-[10px] text-muted-foreground">{fieldLabel(key)}</p>
                                    <p className="text-xs font-medium text-foreground">{toReadableValue(key, value, referenceLabels)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between border-t border-border bg-muted"
            
          >
            <p className="text-xs text-muted-foreground" >
              {`${(page * PAGE_SIZE + 1).toLocaleString('en-US')}–${Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString('en-US')} من ${totalCount.toLocaleString('en-US')}`}
            </p>
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <span className="text-xs px-2 text-muted-foreground" >
                {page + 1} / {totalPages}
              </span>
              <button type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >
                {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
