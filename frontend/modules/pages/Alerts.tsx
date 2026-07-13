import { formatStandardDateTime } from '@shared/lib/formatters';

import { useState } from 'react';
import { Bell, Search, CheckCircle, Clock, Download } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Textarea } from '@shared/components/ui/textarea';
import { Label } from '@shared/components/ui/label';
import { supabase } from '@services/supabase/client';
import { useToast } from '@shared/hooks/use-toast';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { escapeHtml } from '@shared/lib/security';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { cityLabel } from '@modules/employees/model/employeeCity';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { fmtNum } from '@shared/lib/utils';

function severityColor(severity: string): string {
  if (severity === 'urgent') return 'hsl(var(--destructive))';
  if (severity === 'warning') return 'hsl(var(--warning))';
  return 'hsl(var(--primary))';
}

function severityBorderClass(severity: string): string {
  if (severity === 'urgent') return 'border-destructive/30';
  if (severity === 'warning') return 'border-warning/30';
  return 'border-border/50';
}

function severityBgClass(severity: string): string {
  if (severity === 'urgent') return 'bg-destructive/10';
  if (severity === 'warning') return 'bg-warning/10';
  return 'bg-info/10';
}

function daysLeftClass(daysLeft: number): string {
  if (daysLeft <= 7) return 'text-destructive';
  if (daysLeft <= 30) return 'text-warning';
  return 'text-muted-foreground';
}

function toSafeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function empAlertName(emp: Record<string, unknown>): string {
  const name = toSafeText(emp.name);
  const cityDisplay = getCityDisplay(emp);
  const cr = emp.commercial_record ? toSafeText(emp.commercial_record) : null;
  const parts = [name];
  if (cityDisplay) parts.push(`فرع: ${cityDisplay}`);
  if (cr) parts.push(`سجل: ${cr}`);
  return parts.join(' — ');
}

function getCityDisplay(emp: Record<string, unknown>): string | null {
  const cities = Array.isArray(emp.cities) && emp.cities.length > 0
    ? emp.cities.map((c: unknown) => {
      const city = toSafeText(c);
      return cityLabel(city, city);
    }).join('، ')
    : null;
  
  if (cities) return cities;
  if (emp.city) return cityLabel(toSafeText(emp.city), toSafeText(emp.city));
  return null;
}

export const alertTypeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  authorization: 'تفويض',
  probation: 'فترة التجربة',
  platform_account: 'حساب منصة',
};

export interface Alert {
  id: string;
  type: string;
  entityName: string;
  dueDate: string;
  daysLeft: number;
  severity: 'urgent' | 'warning' | 'info';
  resolved: boolean;
  residencyRenewalCost?: number | null;
  residencyRenewalCostPeriod?: 'monthly' | 'yearly' | null;
}

type CommercialRecordRenewalCost = {
  name: string;
  residency_renewal_monthly_cost: number | null;
  residency_renewal_cost_period?: 'monthly' | 'yearly' | null;
};

const severityStyles: Record<string, string> = { urgent: 'badge-urgent', warning: 'badge-warning', info: 'badge-info' };
const severityLabels: Record<string, string> = { urgent: '🔴 عاجل', warning: '🟡 تحذير', info: '🔵 معلومات' };

const typeIcons: Record<string, string> = {
  residency: '🪪', insurance: '🛡️', authorization: '📋', probation: '⏳', platform_account: '📱',
};

/** Compute severity for residency alert based on days left. */
function residencySeverity(daysLeft: number): Alert['severity'] {
  if (daysLeft < 0 || daysLeft <= 7) return 'urgent';
  if (daysLeft <= 14) return 'warning';
  return 'info';
}

/** Compute severity for probation alert based on days left. */
function probationSeverity(daysLeft: number): Alert['severity'] {
  if (daysLeft < 0) return 'info';
  if (daysLeft <= 7) return 'urgent';
  return 'warning';
}

/** Compute severity for vehicle alert based on days left. */
function vehicleSeverity(days: number): Alert['severity'] {
  if (days < 0 || days <= 7) return 'urgent';
  return 'warning';
}

/** Compute severity for platform account iqama alert. */
function iqamaSeverity(days: number): Alert['severity'] {
  if (days < 0 || days <= 7) return 'urgent';
  if (days <= 14) return 'warning';
  return 'info';
}

function buildEmployeeAlerts(
  emp: Record<string, unknown>,
  today: Date,
  threshold: string,
): Alert[] {
  const sponsorshipStatus = toSafeText(emp.sponsorship_status).toLowerCase();
  if (['absconded', 'terminated', 'final_exit', 'expired', 'inactive', 'canceled'].includes(sponsorshipStatus)) {
    return [];
  }

  const alerts: Alert[] = [];
  const empDisplay = empAlertName(emp);
  const resExpiry = emp.residency_expiry as string | null;
  const probEnd = emp.probation_end_date as string | null;
  if (resExpiry && resExpiry <= threshold) {
    const daysLeft = differenceInDays(parseISO(resExpiry), today);
    const renewalCost = typeof emp.residency_renewal_alert_cost === 'number'
      ? emp.residency_renewal_alert_cost
      : null;
    const renewalPeriod = emp.residency_renewal_cost_period === 'yearly' ? 'yearly' : 'monthly';
    const renewalCostLabel = renewalCost === null
      ? ''
      : ` — تكلفة التجديد: ${fmtNum(renewalCost)} ر.س (${renewalPeriod === 'yearly' ? 'سنوي' : '3 شهور'})`;
    alerts.push({
      id: `res-${emp.id}`, type: 'residency', entityName: `${empDisplay}${renewalCostLabel}`,
      dueDate: resExpiry, daysLeft, severity: residencySeverity(daysLeft), resolved: false,
      residencyRenewalCost: renewalCost,
      residencyRenewalCostPeriod: renewalPeriod,
    });
  }
  if (probEnd && probEnd <= threshold) {
    const daysLeft = differenceInDays(parseISO(probEnd), today);
    alerts.push({
      id: `prob-${emp.id}`, type: 'probation', entityName: empDisplay,
      dueDate: probEnd, daysLeft, severity: probationSeverity(daysLeft), resolved: false,
    });
  }
  return alerts;
}

function buildVehicleAlerts(
  v: Record<string, string | null>,
  today: Date,
  threshold: string,
): Alert[] {
  const alerts: Alert[] = [];
  if (v.insurance_expiry && v.insurance_expiry <= threshold) {
    const days = differenceInDays(parseISO(v.insurance_expiry), today);
    alerts.push({
      id: `ins-${v.id}`, type: 'insurance', entityName: `مركبة ${v.plate_number}`,
      dueDate: v.insurance_expiry, daysLeft: days, severity: vehicleSeverity(days), resolved: false,
    });
  }
  if (v.authorization_expiry && v.authorization_expiry <= threshold) {
    const days = differenceInDays(parseISO(v.authorization_expiry), today);
    alerts.push({
      id: `auth-${v.id}`, type: 'authorization', entityName: `مركبة ${v.plate_number}`,
      dueDate: v.authorization_expiry, daysLeft: days, severity: vehicleSeverity(days), resolved: false,
    });
  }
  return alerts;
}

function buildPlatformAccountAlerts(
  acc: Record<string, unknown>,
  today: Date,
  iqamaThreshold: string,
): Alert | null {
  const iqamaDate = acc.iqama_expiry_date as string | null;
  if (!iqamaDate || iqamaDate > iqamaThreshold) return null;
  const days = differenceInDays(parseISO(iqamaDate), today);
  const appName = (acc.apps as { name?: string } | null)?.name ?? 'منصة';
  const expiryFormatted = format(parseISO(iqamaDate), 'dd/MM/yyyy');
  return {
    id: `pla-${acc.id}`, type: 'platform_account',
    entityName: `إقامة الحساب ${acc.account_username} على منصة ${appName} ستنتهي في ${expiryFormatted} ولن يتجدد الحساب.`,
    dueDate: iqamaDate, daysLeft: days, severity: iqamaSeverity(days), resolved: false,
  };
}

/** Pure function — builds Alert[] from raw Supabase results. No side effects. */
function buildAlerts(
  employeesData: Record<string, unknown>[],
  vehiclesData: Record<string, string | null>[],
  platformAccountsData: Record<string, unknown>[],
  iqamaAlertDays: number,
): Alert[] {
  const today = new Date();
  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const threshold = format(endOfCurrentMonth, 'yyyy-MM-dd');
  const iqamaThreshold = format(addDays(today, iqamaAlertDays), 'yyyy-MM-dd');

  const alerts: Alert[] = [];
  employeesData.forEach((emp) => alerts.push(...buildEmployeeAlerts(emp, today, threshold)));
  vehiclesData.forEach((v) => alerts.push(...buildVehicleAlerts(v, today, threshold)));
  platformAccountsData.forEach((acc) => {
    const alert = buildPlatformAccountAlerts(acc, today, iqamaThreshold);
    if (alert) alerts.push(alert);
  });

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Fetch all raw data needed for alerts — called by React Query queryFn. */
async function fetchAlertsRaw(iqamaAlertDays: number) {
  const today = new Date();
  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const threshold = format(endOfCurrentMonth, 'yyyy-MM-dd');
  const iqamaThreshold = format(addDays(today, iqamaAlertDays), 'yyyy-MM-dd');

  const [employeesRes, vehiclesRes, platformAccountsRes, commercialRecordsRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, residency_expiry, probation_end_date, city, cities, commercial_record, sponsorship_status')
      .eq('status', 'active')
      .or(`residency_expiry.lte.${threshold},probation_end_date.lte.${threshold}`),
    supabase
      .from('vehicles')
      .select('id, plate_number, insurance_expiry, authorization_expiry')
      .in('status', ['active', 'maintenance', 'rental'])
      .or(`insurance_expiry.lte.${threshold},authorization_expiry.lte.${threshold}`),
    supabase.from('platform_accounts')
      .select('id, account_username, iqama_expiry_date, app_id, apps(name)')
      .eq('status', 'active')
      .not('iqama_expiry_date', 'is', null)
      .lte('iqama_expiry_date', iqamaThreshold),
    supabase
      .from('commercial_records')
      .select('name, residency_renewal_monthly_cost, residency_renewal_cost_period'),
  ]);

  if (employeesRes.error) throw new Error(employeesRes.error.message);
  if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
  if (commercialRecordsRes.error) throw new Error(commercialRecordsRes.error.message);
  // platform_accounts error is non-fatal — log and continue

  const renewalCostByRecord = new Map(
    ((commercialRecordsRes.data ?? []) as CommercialRecordRenewalCost[])
      .map((record) => [record.name.trim().toLocaleLowerCase(), record] as const)
  );
  const employees = ((employeesRes.data ?? []) as Record<string, unknown>[]).map((employee) => {
    const recordCost = renewalCostByRecord.get(toSafeText(employee.commercial_record).trim().toLocaleLowerCase());
    const rawCost = recordCost?.residency_renewal_monthly_cost ?? null;
    const period = recordCost?.residency_renewal_cost_period === 'yearly' ? 'yearly' : 'monthly';
    const alertCost = rawCost === null ? null : period === 'yearly' ? rawCost : rawCost * 3;
    return {
      ...employee,
      residency_renewal_alert_cost: alertCost,
      residency_renewal_cost_period: period,
    };
  });

  return {
    employees,
    vehicles: (vehiclesRes.data ?? []) as Record<string, string | null>[],
    platformAccounts: (platformAccountsRes.data ?? []) as Record<string, unknown>[],
  };
}

const Alerts = () => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [crFilter, setCrFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [resolveDialog, setResolveDialog] = useState<Alert | null>(null);
  const [deferDialog, setDeferDialog] = useState<Alert | null>(null);
  const [deferDays, setDeferDays] = useState('7');
  const [resolveNote, setResolveNote] = useState('');
  // resolved/deferred are local-only UI state (no DB persistence needed)
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Alert>>>({});

  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { settings } = useSystemSettings();
  const iqamaAlertDays = settings?.iqama_alert_days ?? 90;
  const queryClient = useQueryClient();

  // ── React Query — replaces useEffect + setLoading ─────────────────────────
  // staleTime: 60s → cached for 60s, no refetch on window focus
  // refetchInterval: 5min → auto-refreshes every 5 minutes in background
  const alertsQuery = useQuery({
    queryKey: ['alerts', uid, iqamaAlertDays] as const,
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // refresh every 5 minutes (was setInterval 60s before)
    retry: 2,
    queryFn: () => fetchAlertsRaw(iqamaAlertDays),
  });

  // Build Alert[] from raw data + merge localOverrides
  let rawAlerts: Alert[] = [];
  if (alertsQuery.data) {
    rawAlerts = buildAlerts(
      alertsQuery.data.employees,
      alertsQuery.data.vehicles,
      alertsQuery.data.platformAccounts,
      iqamaAlertDays,
    );
  }

  // Apply local overrides (resolve/defer — stored in component state only)
  const localAlerts: Alert[] = rawAlerts.map(a => ({ ...a, ...(localOverrides[a.id]) }));

  // ── Derived state ─────────────────────────────────────────────────────────
  const commercialRecords = [...new Set(
    localAlerts
      .map(a => { const m = /سجل: (.+?)(?:$| —)/.exec(a.entityName); return m?.[1] ?? null; })
      .filter(Boolean) as string[]
  )].sort((a, b) => a.localeCompare(b));

  const filtered = localAlerts.filter(a => {
    const matchType =
      typeFilter === 'all' ||
      a.type === typeFilter ||
      (typeFilter === 'expired_residency_cost' && a.type === 'residency' && a.daysLeft < 0 && (a.residencyRenewalCost ?? 0) > 0);
    const matchSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchSearch = a.entityName.includes(search);
    const matchCr = crFilter === 'all' || a.entityName.includes(`سجل: ${crFilter}`);
    return matchType && matchSeverity && matchSearch && matchCr && !a.resolved;
  });

  const resolved = localAlerts.filter(a => a.resolved);

  const urgentCount = filtered.filter(a => a.severity === 'urgent').length;
  const warningCount = filtered.filter(a => a.severity === 'warning').length;
  const infoCount = filtered.filter(a => a.severity === 'info').length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleResolve = () => {
    if (!resolveDialog) return;
    setLocalOverrides(prev => ({ ...prev, [resolveDialog.id]: { resolved: true } }));
    toast({ title: 'تم الحسم', description: `تم حسم تنبيه: ${resolveDialog.entityName}` });
    setResolveDialog(null);
    setResolveNote('');
  };

  const handleDefer = () => {
    if (!deferDialog) return;
    const days = Number.parseInt(deferDays) || 7;
    const newDate = new Date(deferDialog.dueDate);
    newDate.setDate(newDate.getDate() + days);
    setLocalOverrides(prev => ({
      ...prev,
      [deferDialog.id]: {
        daysLeft: deferDialog.daysLeft + days,
        dueDate: newDate.toISOString().split('T')[0],
      },
    }));
    toast({ title: 'تم التأجيل', description: `تم تأجيل التنبيه ${days} يوم` });
    setDeferDialog(null);
    setDeferDays('7');
  };

  const handlePrint = () => {
    const severityLabels2: Record<string, string> = { urgent: 'عاجل', warning: 'تحذير', info: 'معلومات' };
    const rows = filtered.map(a => `<tr><td>${escapeHtml(alertTypeLabels[a.type] || a.type)}</td><td>${escapeHtml(a.entityName)}</td><td>${escapeHtml(a.dueDate || '—')}</td><td style="text-align:center">${escapeHtml(toSafeText(a.daysLeft ?? '—'))}</td><td style="text-align:center;font-weight:700;color:${severityColor(a.severity)}">${escapeHtml(severityLabels2[a.severity] || a.severity)}</td></tr>`).join('');
    const printWindow = globalThis.open('', '_blank');
    if (!printWindow) return;
    const htmlContent = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>تقرير التنبيهات</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Droid Arabic Kufi","Tajawal",Arial,sans-serif;font-size:11px;direction:rtl;color:#061735;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#73829a;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1f54ad;color:#fff;padding:6px 8px;text-align:right;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>تقرير التنبيهات التلقائية</h2><p class="sub">المجموع: ${filtered.length} تنبيه — ${formatStandardDateTime()}</p><table><thead><tr><th>النوع</th><th>الكيان</th><th>تاريخ الاستحقاق</th><th>المتبقي (يوم)</th><th>الأولوية</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    printWindow.document.body.innerHTML = htmlContent;
    printWindow.focus();
    // Use setTimeout to ensure content is loaded before printing
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleExport = async () => {
    const XLSX = await loadXlsx();
    const severityOrder: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
    const rows = [...localAlerts]
      .filter(a => !a.resolved)
      .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
      .map(a => ({
        'الأولوية': severityLabels[a.severity] || a.severity,
        'النوع': alertTypeLabels[a.type] || a.type,
        'الكيان': a.entityName,
        'تاريخ الاستحقاق': a.dueDate,
        'المتبقي (يوم)': a.daysLeft,
        'الحالة': a.resolved ? 'محسوم' : 'نشط',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التنبيهات');
    XLSX.writeFile(wb, `التنبيهات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const headers = [['النوع', 'الكيان', 'تاريخ الاستحقاق', 'المتبقي (يوم)', 'الأولوية']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_alerts.xlsx');
  };

  const typeOptions = ['all', 'expired_residency_cost', 'residency', 'insurance', 'authorization', 'probation', 'platform_account'];

  if (!enabled) return null;

  let alertsContent = null;
  if (alertsQuery.isLoading) {
    alertsContent = (
      <div className="bg-card border border-border/50 p-12 text-center rounded-2xl">
        <p className="text-muted-foreground">جارٍ تحميل التنبيهات...</p>
      </div>
    );
  } else if (filtered.length === 0) {
    alertsContent = (
      <div className="bg-card border border-border/50 p-12 text-center rounded-2xl">
        <CheckCircle size={40} className="mx-auto text-success mb-3" />
        <p className="text-muted-foreground">لا توجد تنبيهات مفعّلة</p>
        <p className="text-xs text-muted-foreground mt-1">جميع المستندات سارية المفعول ✅.</p>
      </div>
    );
  } else {
    alertsContent = [...filtered].sort((a, b) => {
      const order: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    }).map(a => (
      <div key={a.id} className={`bg-card rounded-xl border shadow-card p-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow ${severityBorderClass(a.severity)}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${severityBgClass(a.severity)}`}>
          {typeIcons[a.type] || '🔔'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{alertTypeLabels[a.type] || a.type}</p>
            <span className="text-muted-foreground text-xs">—</span>
            <p className="text-sm text-foreground">{a.entityName}</p>
            <span className={severityStyles[a.severity]}>{severityLabels[a.severity]}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            تاريخ الاستحقاق: <span className="font-medium">{a.dueDate}</span>
            <span className={`mr-3 font-bold ${daysLeftClass(a.daysLeft)}`}>
              {a.daysLeft < 0 ? `منتهي منذ ${Math.abs(a.daysLeft)} يوم` : `متبقي ${a.daysLeft} يوم`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={() => setDeferDialog(a)}>
            <Clock size={12} /> تأجيل
          </Button>
          <Button size="sm" className="gap-1 text-xs h-8 bg-success hover:bg-success/90" onClick={() => setResolveDialog(a)}>
            <CheckCircle size={12} /> حسم
          </Button>
        </div>
      </div>
    ));
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>التنبيهات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><Bell size={20} /> التنبيهات التلقائية</h1>
            <p className="page-subtitle">
              {alertsQuery.isLoading ? 'جارٍ التحميل...' : `${filtered.length} تنبيه نشط — ${urgentCount} عاجل`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alertsQuery.isFetching && !alertsQuery.isLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">جارٍ التحديث…</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9"><Download size={14} /> البيانات ▾</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel (مرتب حسب الأولوية)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadTemplate}>📥 تحميل القالب</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة التقرير</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => queryClient.invalidateQueries({ queryKey: ['alerts', uid, iqamaAlertDays] }).catch(() => {})}>
                  🔄 تحديث الآن
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Error state */}
      {alertsQuery.isError && !alertsQuery.isLoading && (
        <QueryErrorRetry
          error={alertsQuery.error}
          onRetry={() => alertsQuery.refetch().catch(() => {})}
          title="تعذر تحميل بيانات التنبيهات"
          hint="تحقق من الاتصال بالإنترنت أو أعد المحاولة."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <button
          className="stat-card text-start w-full border-r-4 border-r-destructive cursor-pointer hover:shadow-card-hover transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
          onClick={() => setSeverityFilter(severityFilter === 'urgent' ? 'all' : 'urgent')}
        >
          <p className="text-sm text-muted-foreground">عاجل</p>
          <p className="text-3xl font-bold text-destructive mt-1">{urgentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">يتطلب تدخل فوري</p>
        </button>
        <button
          className="stat-card text-start w-full border-r-4 border-r-warning cursor-pointer hover:shadow-card-hover transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
        >
          <p className="text-sm text-muted-foreground">تحذير</p>
          <p className="text-3xl font-bold text-warning mt-1">{warningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">خلال 30-60 يوم</p>
        </button>
        <button
          className="stat-card text-start w-full border-r-4 border-r-info cursor-pointer hover:shadow-card-hover transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
          onClick={() => setSeverityFilter(severityFilter === 'info' ? 'all' : 'info')}
        >
          <p className="text-sm text-muted-foreground">معلومات</p>
          <p className="text-3xl font-bold text-info mt-1">{infoCount}</p>
          <p className="text-xs text-muted-foreground mt-1">للعلم</p>
        </button>
        <div className="stat-card border-r-4 border-r-success rounded-2xl">
          <p className="text-sm text-muted-foreground">تم حسمها</p>
          <p className="text-3xl font-bold text-success mt-1">{resolved.length}</p>
          <p className="text-xs text-muted-foreground mt-1">تنبيهات محسومة</p>
        </div>
      </div>

      <div className="bg-card border border-border/50 p-3 space-y-2 rounded-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{ v: 'all', l: 'الكل' }, { v: 'urgent', l: '🔴 عاجل' }, { v: 'warning', l: '🟡 تحذير' }, { v: 'info', l: '🔵 معلومات' }].map(s => (
              <button key={s.v} onClick={() => setSeverityFilter(s.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${severityFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {t === 'all'
                ? 'كل الأنواع'
                : t === 'expired_residency_cost'
                  ? 'تكلفة الإقامات المنتهية'
                  : `${typeIcons[t] || '🔔'} ${alertTypeLabels[t] || t}`}
            </button>
          ))}
        </div>
        {commercialRecords.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground font-semibold">السجل التجاري:</span>
            <button onClick={() => setCrFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${crFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              الكل
            </button>
            {commercialRecords.map(cr => (
              <button key={cr} onClick={() => setCrFilter(cr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${crFilter === cr ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                📋 {cr}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {alertsContent}
      </div>

      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">✅ التنبيهات المحسومة ({resolved.length})</h3>
          <div className="space-y-2">
            {resolved.map(a => (
              <div key={a.id} className="bg-muted/30 rounded-xl border border-border/30 p-3 flex items-center gap-3 opacity-60">
                <span className="text-lg">{typeIcons[a.type] || '🔔'}</span>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{alertTypeLabels[a.type] || a.type} — {a.entityName}</p>
                </div>
                <CheckCircle size={16} className="text-success" />
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>حسم التنبيه</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{resolveDialog && (alertTypeLabels[resolveDialog.type] || resolveDialog.type)}</p>
              <p className="text-sm text-muted-foreground mt-1">{resolveDialog?.entityName}</p>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Textarea placeholder="اكتب ملاحظة..." value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialog(null)}>إلغاء</Button>
            <Button className="bg-success hover:bg-success/90" onClick={handleResolve}>
              <CheckCircle size={14} className="ml-1" /> تأكيد الحسم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deferDialog} onOpenChange={() => setDeferDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تأجيل التنبيه</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{deferDialog && (alertTypeLabels[deferDialog.type] || deferDialog.type)}</p>
              <p className="text-sm text-muted-foreground mt-1">{deferDialog?.entityName}</p>
            </div>
            <div className="space-y-2">
              <Label>مدة التأجيل (أيام)</Label>
              <div className="flex gap-2">
                {['7', '14', '30', '60'].map(d => (
                  <button key={d} onClick={() => setDeferDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 ${deferDays === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                    {d} يوم
                  </button>
                ))}
              </div>
              <Input type="number" value={deferDays} onChange={e => setDeferDays(e.target.value)} placeholder="أو اكتب عدد مخصص" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeferDialog(null)}>إلغاء</Button>
            <Button onClick={handleDefer}><Clock size={14} className="ml-1" /> تأجيل {deferDays} يوم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
