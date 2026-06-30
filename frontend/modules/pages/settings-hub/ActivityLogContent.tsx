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

const PAGE_SIZE = 25;

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
  attendance:             { ar: 'الحضور', en: 'Attendance' },
  daily_shifts:           { ar: 'الدوام', en: 'Shifts' },
  advances:               { ar: 'السلف', en: 'Advances' },
  salary_records:         { ar: 'الرواتب', en: 'Salaries' },
  salary_deductions:      { ar: 'خصومات الرواتب', en: 'Salary Deductions' },
  external_deductions:    { ar: 'الخصومات الخارجية', en: 'External Deductions' },
  // Orders
  daily_orders:           { ar: 'الطلبات', en: 'Orders' },
  apps:                   { ar: 'التطبيقات', en: 'Apps' },
  employee_apps:          { ar: 'تعيينات التطبيقات', en: 'Employee Apps' },
  // Vehicles
  vehicles:               { ar: 'المركبات', en: 'Vehicles' },
  vehicle_assignments:    { ar: 'تسليم العهد', en: 'Vehicle Assignments' },
  fuel_records:           { ar: 'سجل الوقود', en: 'Fuel Records' },
  maintenance_records:    { ar: 'صيانة المركبات', en: 'Maintenance' },
  spare_parts:            { ar: 'قطع الغيار', en: 'Spare Parts' },
  vehicle_fines:          { ar: 'مخالفات المركبات', en: 'Vehicle Fines' },
  // System
  alerts:                 { ar: 'التنبيهات', en: 'Alerts' },
  profiles:               { ar: 'الملفات الشخصية', en: 'Profiles' },
  user_roles:             { ar: 'الأدوار', en: 'Roles' },
  user_permissions:       { ar: 'الصلاحيات', en: 'Permissions' },
  system_settings:        { ar: 'إعدادات النظام', en: 'System Settings' },
  trade_registers:        { ar: 'السجل التجاري', en: 'Trade Registers' },
  salary_slips:           { ar: 'قسائم الرواتب', en: 'Salary Slips' },
  slip_templates:         { ar: 'قوالب القسائم', en: 'Slip Templates' },
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
  employee_id: 'الموظف',
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
};

const toShortText = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > 30 ? `${str.slice(0, 30)}...` : str;
};

const buildChangeSummary = (log: AuditLog) => {
  const oldV = log.old_value || {};
  const newV = log.new_value || {};

  const label = (k: string) => FIELD_LABELS[k] ?? k;

  if (log.action === 'INSERT') {
    return Object.entries(newV)
      .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
      .slice(0, 3)
      .map(([k, v]) => `${label(k)}: ${toShortText(v)}`)
      .join(' | ');
  }
  if (log.action === 'DELETE') {
    return Object.entries(oldV)
      .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
      .slice(0, 3)
      .map(([k, v]) => `${label(k)}: ${toShortText(v)}`)
      .join(' | ');
  }
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const changed = keys
    .filter((k) => !['id', 'created_at', 'updated_at'].includes(k))
    .filter((k) => JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]))
    .slice(0, 3)
    .map((k) => `${label(k)}: ${toShortText(oldV[k])} ← ${toShortText(newV[k])}`);
  return changed.join(' | ');
};

const formatJson = (obj: Record<string, unknown> | null) => {
  if (!obj || Object.keys(obj).length === 0) return '—';
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    logError('[ActivityLog] formatJson failed', e);
    return '[unserializable-object]';
  }
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

      return {
        rows: (data || []).map((l) => ({
          ...l,
          old_value: l.old_value as Record<string, unknown> | null,
          new_value: l.new_value as Record<string, unknown> | null,
          profile: l.user_id ? (profileMap[l.user_id] ?? null) : null,
        })),
        total: count || 0,
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
      <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(38,66,230,0.08)', color: '#2642e6' }}
        >
          <Activity size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--ds-on-surface)' }}>
            سجل النشاطات
          </h2>
          <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
            {`${totalCount.toLocaleString('ar-EG')} سجل محفوظ`}
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
        className="rounded-xl p-3 flex flex-wrap items-center gap-3"
        style={{ background: 'var(--ds-surface-low)' }}
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
          <button
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
      <div className="rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--ds-surface-low)', borderBottom: '1px solid var(--ds-surface-container)' }}>
                {['التاريخ والوقت', 'المستخدم', 'العملية', 'الوحدة', 'التفاصيل'].map((h, i) => (
                  <th
                    key={h}
                    className={`p-3 text-xs font-semibold whitespace-nowrap text-start ${i === 4 ? 'hidden lg:table-cell' : ''}`}
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: 'var(--ds-surface-lowest)' }}>

              {/* Loading skeletons */}
              {loading && SKELETON_ROWS.map((k) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
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
                    <Activity size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--ds-on-surface-variant)' }} />
                    <p className="text-sm" style={{ color: 'var(--ds-on-surface-variant)' }}>لا توجد سجلات</p>
                  </td>
                </tr>
              )}

              {/* Log rows */}
              {!loading && logs.map(log => (
                <Fragment key={log.id}>
                  <tr
                    style={{
                      borderBottom: expandedId === log.id ? 'none' : '1px solid var(--ds-surface-container)',
                    }}
                    className={`transition-colors hover:bg-[var(--ds-surface-low)]
                      ${expandedId === log.id ? 'bg-[var(--ds-surface-low)]' : ''}
                      ${hasPayload(log) ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!hasPayload(log)) return;
                      setExpandedId(expandedId === log.id ? null : log.id);
                    }}
                  >
                    {/* Date / Time */}
                    <td className="ta-td p-3">
                      <p className="text-xs font-medium" style={{ color: 'var(--ds-on-surface)' }} dir="ltr">
                        {format(new Date(log.created_at), 'yyyy-MM-dd')}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--ds-on-surface-variant)' }} dir="ltr">
                        {format(new Date(log.created_at), 'HH:mm:ss')}
                      </p>
                    </td>

                    {/* User */}
                    <td className="p-3">
                      {log.profile ? (
                        /* Known user with profile */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: 'rgba(38,66,230,0.10)', color: '#2642e6' }}
                          >
                            {avatarChar(log.profile)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate max-w-[120px]" style={{ color: 'var(--ds-on-surface)' }}>
                              {displayName(log.profile)}
                            </p>
                            {log.profile.email && (
                              <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--ds-on-surface-variant)' }} dir="ltr">
                                {log.profile.email}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : log.user_id ? ( // NOSONAR
                        /* user_id exists but no matching profile (deleted user) */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(120,120,120,0.10)', color: '#888' }}
                          >
                            <User size={12} />
                          </div>
                          <div>
                            <p className="text-xs" style={{ color: 'var(--ds-on-surface)' }}>مستخدم محذوف</p>
                            <p className="text-[9px] font-mono" style={{ color: 'var(--ds-on-surface-variant)' }}>
                              {log.user_id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* No user_id at all — system trigger */
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
                            style={{ background: 'rgba(0,0,0,0.06)', color: '#666' }}
                          >
                            ⚙️
                          </div>
                          <span className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
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
                      <span className="text-xs font-medium" style={{ color: 'var(--ds-on-surface)' }}>
                        {getTableLabel(log.table_name)}
                      </span>
                      <p className="text-[10px] font-mono opacity-50" style={{ color: 'var(--ds-on-surface-variant)' }}>
                        {log.table_name}
                      </p>
                    </td>

                    {/* Change summary */}
                    <td className="p-3 hidden lg:table-cell max-w-xs">
                      <div className="flex items-start gap-1.5">
                        {hasPayload(log) && (
                          <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ds-on-surface-variant)' }}>
                            {expandedId === log.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          {(log.new_value || log.old_value) && (
                            <p
                              className="text-[10px] font-mono truncate max-w-[220px]"
                              style={{ color: 'var(--ds-on-surface-variant)' }}
                              title={buildChangeSummary(log)}
                            >
                              {buildChangeSummary(log) || '—'}
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
                    <tr style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                      <td colSpan={5} className="p-0" style={{ background: 'var(--ds-surface-lowest)' }}>
                        <div className="p-4 border-t" style={{ borderColor: 'var(--ds-surface-container)' }}>

                          {/* Header: who did what */}
                          <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
                            <span className="font-semibold" style={{ color: 'var(--ds-on-surface)' }}>
                              {resolveUserLabel(log.profile, log.user_id)}
                            </span>
                            <span>قام بـ</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${actionColors[log.action] ?? ''}`}>
                              {getActionLabel(log.action)}
                            </span>
                            <span>في</span>
                            <span className="font-semibold" style={{ color: 'var(--ds-on-surface)' }}>
                              {getTableLabel(log.table_name)}
                            </span>
                            <span className="opacity-50 ms-1" dir="ltr">
                              — {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                            </span>
                          </div>

                          {log.action === 'UPDATE' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <div>
                                <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--ds-on-surface)' }}>
                                  <span className="text-rose-500">●</span> قبل التعديل
                                </p>
                                <pre
                                  className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                  style={{
                                    background: 'var(--ds-surface-low)',
                                    border: '1px solid var(--ds-surface-container)',
                                    color: 'var(--ds-on-surface-variant)',
                                  }}
                                  dir="ltr"
                                >
                                  {formatJson(log.old_value)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--ds-on-surface)' }}>
                                  <span className="text-emerald-500">●</span> بعد التعديل
                                </p>
                                <pre
                                  className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                  style={{
                                    background: 'var(--ds-surface-low)',
                                    border: '1px solid var(--ds-surface-container)',
                                    color: 'var(--ds-on-surface-variant)',
                                  }}
                                  dir="ltr"
                                >
                                  {formatJson(log.new_value)}
                                </pre>
                              </div>
                            </div>
                          )}

                          {log.action === 'INSERT' && (
                            <div>
                              <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--ds-on-surface)' }}>
                                <span className="text-emerald-500">●</span> البيانات المضافة
                              </p>
                              <pre
                                className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                style={{
                                  background: 'var(--ds-surface-low)',
                                  border: '1px solid var(--ds-surface-container)',
                                  color: 'var(--ds-on-surface-variant)',
                                }}
                                dir="ltr"
                              >
                                {formatJson(log.new_value)}
                              </pre>
                            </div>
                          )}

                          {log.action === 'DELETE' && (
                            <div>
                              <p className="text-[10px] font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--ds-on-surface)' }}>
                                <span className="text-rose-500">●</span> البيانات المحذوفة
                              </p>
                              <pre
                                className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                style={{
                                  background: 'var(--ds-surface-low)',
                                  border: '1px solid var(--ds-surface-container)',
                                  color: 'var(--ds-on-surface-variant)',
                                }}
                                dir="ltr"
                              >
                                {formatJson(log.old_value)}
                              </pre>
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
            className="px-4 py-3 flex items-center justify-between"
            style={{
              borderTop: '1px solid var(--ds-surface-container)',
              background: 'var(--ds-surface-low)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
              {`${(page * PAGE_SIZE + 1).toLocaleString('ar-EG')}–${Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString('ar-EG')} من ${totalCount.toLocaleString('ar-EG')}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                style={{ border: '1px solid var(--ds-outline-variant)' }}
              >
                {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--ds-on-surface-variant)' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                style={{ border: '1px solid var(--ds-outline-variant)' }}
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
