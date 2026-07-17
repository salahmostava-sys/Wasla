import { formatCurrency, formatStandardDateTime } from '@shared/lib/formatters';

import { useState } from 'react';
import { Bell, Search, CheckCircle, Clock, ClipboardCopy, Download, ExternalLink, UserRoundCog } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Textarea } from '@shared/components/ui/textarea';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { escapeHtml } from '@shared/lib/security';
import { format } from 'date-fns';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { useAlerts } from '@shared/hooks/useAlerts';
import type { Alert } from '@shared/lib/alertsBuilder';
import {
  alertsService,
  type AlertWorkflowTarget,
} from '@services/alertsService';
import { getErrorMessage } from '@services/serviceError';
import { useAuth } from '@app/providers/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@shared/hooks/usePermissions';
import {
  AlertWorkflowDialog,
  type AlertWorkflowForm,
} from '@modules/alerts/components/AlertWorkflowDialog';

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

export const alertTypeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  authorization: 'تفويض',
  probation: 'فترة التجربة',
  health_insurance: 'تأمين صحي',
  driving_license: 'رخصة قيادة',
  platform_account: 'حساب منصة',
  employee_absconded: 'موظف مسجل هروب',
  vehicle_rental: 'إيجار مركبة',
};

const severityStyles: Record<string, string> = { urgent: 'badge-urgent', warning: 'badge-warning', info: 'badge-info' };
const severityLabels: Record<string, string> = { urgent: '🔴 عاجل', warning: '🟡 تحذير', info: '🔵 معلومات' };

const typeIcons: Record<string, string> = {
  residency: '🪪', insurance: '🛡️', authorization: '📋', probation: '⏳',
  health_insurance: '🏥', driving_license: '🪪', platform_account: '📱', employee_absconded: '⚠️',
  vehicle_rental: '🚙',
};

const workflowLabels = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  snoozed: 'مؤجل',
  resolved: 'محسوم',
} as const;

const workflowStyles = {
  open: 'bg-muted text-foreground',
  in_progress: 'bg-info/15 text-info',
  snoozed: 'bg-warning/15 text-warning',
  resolved: 'bg-success/15 text-success',
} as const;

function getWorkflowStatus(alert: Alert): keyof typeof workflowLabels {
  if (alert.resolved) return 'resolved';
  return alert.workflowStatus ?? 'open';
}

function getWorkflowTarget(alert: Alert): AlertWorkflowTarget {
  return {
    persistedId: alert.persistedId,
    sourceKey: alert.sourceKey ?? alert.id,
    type: alert.type,
    entityId: alert.entityId,
    entityType: alert.entityType,
    message: alert.entityName,
    dueDate: alert.dueDate,
  };
}

function getAlertCost(alert: Alert): number | null {
  return alert.residencyRenewalCost ?? alert.estimatedCost ?? null;
}

function canOpenAlertEntity(alert: Alert): boolean {
  return Boolean(alert.entityId && (alert.entityType === 'employee' || alert.entityType === 'vehicle'));
}

function workflowSummaryLine(alert: Alert): string {
  const cost = getAlertCost(alert);
  const details = [
    workflowLabels[getWorkflowStatus(alert)],
    `المسؤول: ${alert.assignedName || 'غير مسند'}`,
    cost === null ? null : `التكلفة: ${formatCurrency(cost)}`,
    alert.resolutionNote || null,
  ].filter(Boolean).join(' | ');
  return `- ${alertTypeLabels[alert.type] || alert.type}: ${alert.entityName} | ${details}`;
}

const Alerts = () => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [crFilter, setCrFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [resolveDialog, setResolveDialog] = useState<Alert | null>(null);
  const [deferDialog, setDeferDialog] = useState<Alert | null>(null);
  const [deferDays, setDeferDays] = useState('7');
  const [resolveNote, setResolveNote] = useState('');
  const [workflowDialog, setWorkflowDialog] = useState<Alert | null>(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions } = usePermissions('alerts');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const alertsQuery = useAlerts();
  const assigneesQuery = useQuery({
    queryKey: ['alerts', 'assignable-users'],
    queryFn: alertsService.fetchAssignableUsers,
    enabled: permissions.can_edit,
    staleTime: 5 * 60_000,
  });

  const localAlerts: Alert[] = alertsQuery.data ?? [];

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
    const matchWorkflow = workflowFilter === 'all' || getWorkflowStatus(a) === workflowFilter;
    const matchSearch = a.entityName.includes(search);
    const matchCr = crFilter === 'all' || a.entityName.includes(`سجل: ${crFilter}`);
    return matchType && matchSeverity && matchWorkflow && matchSearch && matchCr && !a.resolved;
  });

  const resolved = localAlerts.filter(a => a.resolved);

  const urgentCount = filtered.filter(a => a.severity === 'urgent').length;
  const warningCount = filtered.filter(a => a.severity === 'warning').length;
  const infoCount = filtered.filter(a => a.severity === 'info').length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!resolveDialog) return;
    try {
      await alertsService.saveWorkflow(getWorkflowTarget(resolveDialog), {
        status: 'resolved',
        assignedTo: resolveDialog.assignedTo ?? user?.id ?? null,
        estimatedCost: getAlertCost(resolveDialog),
        resolutionNote: resolveNote.trim() || resolveDialog.resolutionNote || null,
        dueDate: resolveDialog.dueDate,
        actorId: user?.id ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({ title: 'تم الحسم', description: `تم حسم تنبيه: ${resolveDialog.entityName}` });
      setResolveDialog(null);
      setResolveNote('');
    } catch (error) {
      toast({ title: 'تعذر حسم التنبيه', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleDefer = async () => {
    if (!deferDialog) return;
    const days = Number.parseInt(deferDays) || 7;
    const newDate = new Date(deferDialog.dueDate);
    newDate.setDate(newDate.getDate() + days);
    const dueDate = format(newDate, 'yyyy-MM-dd');

    try {
      await alertsService.saveWorkflow(getWorkflowTarget(deferDialog), {
        status: 'snoozed',
        assignedTo: deferDialog.assignedTo ?? null,
        estimatedCost: getAlertCost(deferDialog),
        resolutionNote: deferDialog.resolutionNote ?? null,
        dueDate,
        actorId: user?.id ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({ title: 'تم التأجيل', description: `تم تأجيل التنبيه ${days} يوم` });
      setDeferDialog(null);
      setDeferDays('7');
    } catch (error) {
      toast({ title: 'تعذر تأجيل التنبيه', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleWorkflowSave = async (alert: Alert, form: AlertWorkflowForm) => {
    setWorkflowSaving(true);
    try {
      await alertsService.saveWorkflow(getWorkflowTarget(alert), {
        status: form.status,
        assignedTo: form.assignedTo,
        estimatedCost: form.estimatedCost,
        resolutionNote: form.note,
        dueDate: alert.dueDate,
        actorId: user?.id ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setWorkflowDialog(null);
      toast({ title: 'تم حفظ متابعة التنبيه' });
    } catch (error) {
      toast({ title: 'تعذر حفظ المتابعة', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setWorkflowSaving(false);
    }
  };

  const openAlertEntity = (alert: Alert) => {
    if (!alert.entityId) return;
    if (alert.entityType === 'employee') {
      navigate(`/employees?employee=${encodeURIComponent(alert.entityId)}`);
    } else if (alert.entityType === 'vehicle') {
      navigate('/motorcycles');
    }
  };

  const handlePrint = () => {
    const severityLabels2: Record<string, string> = { urgent: 'عاجل', warning: 'تحذير', info: 'معلومات' };
    const rows = filtered.map(a => `<tr><td>${escapeHtml(alertTypeLabels[a.type] || a.type)}</td><td>${escapeHtml(a.entityName)}</td><td>${escapeHtml(a.dueDate || '—')}</td><td style="text-align:center">${escapeHtml(String(a.daysLeft ?? '—'))}</td><td style="text-align:center;font-weight:700;color:${severityColor(a.severity)}">${escapeHtml(severityLabels2[a.severity] || a.severity)}</td></tr>`).join('');
    const printWindow = globalThis.open('', '_blank');
    if (!printWindow) return;
    const htmlContent = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>تقرير التنبيهات</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Droid Arabic Kufi","Tajawal",Arial,sans-serif;font-size:11px;direction:rtl;color:#061735;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#061735;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1f54ad;color:#fff;padding:6px 8px;text-align:right;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>تقرير التنبيهات التلقائية</h2><p class="sub">المجموع: ${filtered.length} تنبيه — ${formatStandardDateTime()}</p><table><thead><tr><th>النوع</th><th>الكيان</th><th>تاريخ الاستحقاق</th><th>المتبقي (يوم)</th><th>الأولوية</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
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
        'حالة المتابعة': workflowLabels[getWorkflowStatus(a)],
        'المسؤول': a.assignedName || 'غير مسند',
        'التكلفة المتوقعة': getAlertCost(a) ?? '',
        'ملاحظة المتابعة': a.resolutionNote ?? '',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التنبيهات');
    XLSX.writeFile(wb, `التنبيهات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const copyWorkflowSummary = async () => {
    try {
      const visibleAlerts = filtered.slice(0, 50);
      const lines = visibleAlerts.map(workflowSummaryLine);
      const remaining = filtered.length - visibleAlerts.length;
      const footer = remaining > 0 ? `\n... و${remaining} تنبيه إضافي` : '';
      await navigator.clipboard.writeText(`ملخص متابعة التنبيهات (${filtered.length})\n${lines.join('\n')}${footer}`);
      toast({ title: 'تم نسخ ملخص المتابعة' });
    } catch (error) {
      toast({ title: 'تعذر نسخ الملخص', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await loadXlsx();
    const severityOrder: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
    const rows = [...filtered]
      .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
      .map((alert) => [
        alertTypeLabels[alert.type] || alert.type,
        alert.entityName,
        alert.dueDate,
        alert.daysLeft,
        severityLabels[alert.severity] || alert.severity,
      ]);
    const headers = ['النوع', 'الكيان', 'تاريخ الاستحقاق', 'المتبقي (يوم)', 'الأولوية'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_alerts.xlsx');
  };

  const typeOptions = ['all', 'expired_residency_cost', 'vehicle_rental', 'residency', 'insurance', 'authorization', 'probation', 'platform_account'];

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
    }).map(a => {
      const workflowStatus = getWorkflowStatus(a);
      const alertCost = getAlertCost(a);
      return (
      <div key={a.id} className={`bg-card rounded-lg border shadow-card p-4 flex flex-col gap-4 transition-shadow hover:shadow-card-hover sm:flex-row sm:items-center ${severityBorderClass(a.severity)}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${severityBgClass(a.severity)}`}>
          {typeIcons[a.type] || '🔔'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{alertTypeLabels[a.type] || a.type}</p>
            <span className="text-muted-foreground text-xs">—</span>
            <p className="text-sm text-foreground">{a.entityName}</p>
            <span className={severityStyles[a.severity]}>{severityLabels[a.severity]}</span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${workflowStyles[workflowStatus]}`}>
              {workflowLabels[workflowStatus]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            تاريخ الاستحقاق: <span className="font-medium">{a.dueDate}</span>
            <span className={`mr-3 font-bold ${daysLeftClass(a.daysLeft)}`}>
              {a.daysLeft < 0 ? `منتهي منذ ${Math.abs(a.daysLeft)} يوم` : `متبقي ${a.daysLeft} يوم`}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>المسؤول: <strong className="text-foreground">{a.assignedName || 'غير مسند'}</strong></span>
            {alertCost !== null && (
              <span>التكلفة: <strong className="text-foreground">{formatCurrency(alertCost)}</strong></span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          {canOpenAlertEntity(a) && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openAlertEntity(a)} title="فتح السجل المرتبط">
              <ExternalLink size={14} />
            </Button>
          )}
          {permissions.can_edit && (
            <>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={() => setWorkflowDialog(a)}>
                <UserRoundCog size={12} /> إدارة
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={() => setDeferDialog(a)}>
                <Clock size={12} /> تأجيل
              </Button>
              <Button size="sm" className="gap-1 text-xs h-8 bg-success hover:bg-success/90" onClick={() => setResolveDialog(a)}>
                <CheckCircle size={12} /> حسم
              </Button>
            </>
          )}
        </div>
      </div>
      );
    });
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
                <DropdownMenuItem onClick={() => void copyWorkflowSummary()}><ClipboardCopy size={14} className="ml-2" /> نسخ ملخص المتابعة</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadTemplate}>📥 تحميل القالب</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة التقرير</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => alertsQuery.refetch().catch(() => {})}>
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
        <button type="button"
          className="stat-card text-start w-full border-r-4 border-r-destructive cursor-pointer hover:shadow-card-hover transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
          onClick={() => setSeverityFilter(severityFilter === 'urgent' ? 'all' : 'urgent')}
        >
          <p className="text-sm text-muted-foreground">عاجل</p>
          <p className="text-3xl font-bold text-destructive mt-1">{urgentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">يتطلب تدخل فوري</p>
        </button>
        <button type="button"
          className="stat-card text-start w-full border-r-4 border-r-warning cursor-pointer hover:shadow-card-hover transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
          onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}
        >
          <p className="text-sm text-muted-foreground">تحذير</p>
          <p className="text-3xl font-bold text-warning mt-1">{warningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">خلال 30-60 يوم</p>
        </button>
        <button type="button"
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
              <button type="button" key={s.v} onClick={() => setSeverityFilter(s.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${severityFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(t => {
            let label = t;
            if (t === 'all') label = 'كل الأنواع';
            else if (t === 'expired_residency_cost') label = 'تكلفة الإقامات المنتهية';
            else label = `${typeIcons[t] || '🔔'} ${alertTypeLabels[t] || t}`;
            return (
              <button type="button" key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">حالة المتابعة:</span>
          {[
            { value: 'all', label: 'كل الحالات' },
            { value: 'open', label: 'مفتوح' },
            { value: 'in_progress', label: 'قيد التنفيذ' },
            { value: 'snoozed', label: 'مؤجل' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setWorkflowFilter(option.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${workflowFilter === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {commercialRecords.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground font-semibold">السجل التجاري:</span>
            <button type="button" onClick={() => setCrFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${crFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              الكل
            </button>
            {commercialRecords.map(cr => (
              <button type="button" key={cr} onClick={() => setCrFilter(cr)}
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

      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
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

      <Dialog open={!!deferDialog} onOpenChange={(open) => !open && setDeferDialog(null)}>
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
                  <button type="button" key={d} onClick={() => setDeferDays(d)}
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

      <AlertWorkflowDialog
        alert={workflowDialog}
        users={assigneesQuery.data ?? []}
        saving={workflowSaving}
        onClose={() => setWorkflowDialog(null)}
        onSave={handleWorkflowSave}
      />
    </div>
  );
};

export default Alerts;
