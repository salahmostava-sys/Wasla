import { useState } from 'react';
import {
  Car, Bike, Wrench, Fuel, Route, TrendingUp, AlertTriangle, FileText,
  Search, Download, Printer, ChevronDown, ChevronUp, User,
  Shield, ClipboardList, Activity, Filter,
} from 'lucide-react';
import { formatCurrency, formatStandardDateTime } from '@shared/lib/formatters';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Skeleton } from '@shared/components/ui/skeleton';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import {
  useVehicleReport, useVehicleReportFilters, useSortedVehicles, useVehicleReportKPIs,
  type SortKey,
} from '@modules/maintenance/hooks/useVehicleReport';
import type { VehicleReportRow } from '@services/vehicleReportService';
import { loadXlsx } from '@modules/orders/utils/xlsx';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
import { PageLoadingState, PageAccessDeniedState } from '@shared/components/PageAccessState';

/* ─────────────── helpers ─────────────── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:      { label: 'نشط',       color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  inactive:    { label: 'متوقف',     color: 'bg-slate-100 text-foreground dark:bg-slate-800' },
  maintenance: { label: 'صيانة',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  breakdown:   { label: 'معطّل',     color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  rental:      { label: 'إيجار',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  ended:       { label: 'منتهي',     color: 'bg-muted text-muted-foreground' },
};

const DOC_LABELS: Record<string, string> = {
  license: 'رخصة', insurance: 'تأمين', registration: 'تسجيل',
  authorization: 'تفويض', other: 'أخرى',
};

const TYPE_COLORS: Record<string, string> = {
  'غيار زيت':    'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'صيانة دورية': 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  'إطارات':      'bg-slate-100 text-foreground dark:bg-slate-800',
  'بطارية':      'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  'فرامل':       'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  'أعطال':       'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  'أخرى':        'bg-muted text-muted-foreground',
};

function docExpiryStatus(expiry: string | null): 'ok' | 'soon' | 'expired' {
  if (!expiry) return 'ok';
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (expiry < today) return 'expired';
  if (expiry <= soon) return 'soon';
  return 'ok';
}

function getExpiryBadgeStyle(s: 'ok' | 'soon' | 'expired') {
  if (s === 'expired') return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
  if (s === 'soon') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
}

function ExpiryBadge({ date, label }: Readonly<{ date: string | null; label: string }>) {
  if (!date) return null;
  const s = docExpiryStatus(date);
  const cls = getExpiryBadgeStyle(s);
  return (
    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {label}: {new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
      {s === 'expired' && ' ⚠️'}
      {s === 'soon' && ' 🔔'}
    </span>
  );
}

/* ─────────────── KPI Card ─────────────── */
function KpiCard({ icon: Icon, label, value, sub, color }: Readonly<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}>) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5 truncate">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─────────────── Vehicle Card ─────────────── */
function VehicleCard({ v, expanded, onToggle }: Readonly<{
  v: VehicleReportRow;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const status = STATUS_LABELS[v.status] ?? { label: v.status, color: 'bg-muted text-muted-foreground' };
  const insStatus = docExpiryStatus(v.insurance_expiry);
  const regStatus = docExpiryStatus(v.registration_expiry);
  const authStatus = docExpiryStatus(v.authorization_expiry);
  const hasDocAlert = insStatus !== 'ok' || regStatus !== 'ok' || authStatus !== 'ok';

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm hover:border-border transition-colors">
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-right px-5 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
      >
        {/* Vehicle icon */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          v.type === 'motorcycle'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
        }`}>
          {v.type === 'motorcycle' ? <Bike size={20} /> : <Car size={20} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base leading-tight" dir="ltr">{v.plate_number}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.color}`}>{status.label}</span>
            {hasDocAlert && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-0.5">
                <AlertTriangle size={9} /> وثيقة منتهية/قاربت
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {v.brand && <span>{v.brand} {v.model ?? ''} {v.year ? `(${v.year})` : ''}</span>}
            {v.current_rider && (
              <span className="flex items-center gap-1">
                <User size={10} /> {v.current_rider}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-muted-foreground">صيانة</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(v.total_maintenance_cost)}</p>
          </div>
          {v.total_km > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground">كم</p>
              <p className="text-sm font-bold">{v.total_km.toLocaleString('en-US')}</p>
            </div>
          )}
          {v.total_fuel_cost > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground">وقود</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(v.total_fuel_cost)}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 text-muted-foreground ml-1">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-5 py-4 space-y-5">
          {/* Mobile stats */}
          <div className="flex sm:hidden gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">صيانة</p><p className="font-bold text-rose-600">{formatCurrency(v.total_maintenance_cost)}</p></div>
            {v.total_km > 0 && <div><p className="text-xs text-muted-foreground">كم</p><p className="font-bold">{v.total_km.toLocaleString('en-US')}</p></div>}
            {v.total_fuel_cost > 0 && <div><p className="text-xs text-muted-foreground">وقود</p><p className="font-bold text-amber-600">{formatCurrency(v.total_fuel_cost)}</p></div>}
          </div>

          {/* Documents expiry */}
          {(v.insurance_expiry || v.registration_expiry || v.authorization_expiry) && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Shield size={12} /> صلاحية الوثائق
              </p>
              <div className="flex flex-wrap gap-2">
                <ExpiryBadge date={v.insurance_expiry} label="تأمين" />
                <ExpiryBadge date={v.registration_expiry} label="تسجيل" />
                <ExpiryBadge date={v.authorization_expiry} label="تفويض" />
              </div>
            </div>
          )}

          {/* Uploaded docs */}
          {v.documents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <FileText size={12} /> الملفات المرفوعة ({v.documents.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {v.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] px-2.5 py-1 bg-background border border-border/60 rounded-lg hover:border-primary transition-colors text-foreground"
                  >
                    {DOC_LABELS[doc.doc_type] ?? doc.doc_type}: {doc.title ?? doc.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Maintenance logs */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Wrench size={12} /> سجل الصيانة ({v.maintenance_count})
            </p>
            {v.maintenance_logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد صيانات مسجلة في هذه الفترة</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                {v.maintenance_logs.map((log) => {
                  const colorClass = TYPE_COLORS[log.type] ?? TYPE_COLORS['أخرى'];
                  return (
                    <div key={log.id} className="bg-background border border-border/60 rounded-xl p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${colorClass}`}>{log.type}</span>
                          <span className="text-muted-foreground">
                            {log.maintenance_date
                              ? new Date(log.maintenance_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
                              : '—'}
                          </span>
                          {log.odometer_reading && (
                            <span className="text-muted-foreground">{log.odometer_reading.toLocaleString()} كم</span>
                          )}
                        </div>
                        <span className="font-bold text-foreground">{formatCurrency(log.total_cost)}</span>
                      </div>
                      {log.notes && <p className="text-muted-foreground leading-relaxed mb-1">{log.notes}</p>}
                      {log.parts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40 mt-1">
                          {log.parts.map((p) => (
                            <span key={p.name_ar} className="bg-muted/60 px-2 py-0.5 rounded text-[10px] text-muted-foreground">
                              {p.name_ar} ×{p.quantity_used}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fuel/km summary */}
          {(v.total_km > 0 || v.total_fuel_cost > 0) && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Fuel size={12} /> الكيلومترات والوقود (الفترة المحددة)
              </p>
              <div className="flex gap-4 text-xs">
                <div className="bg-background border border-border/60 rounded-xl px-3 py-2">
                  <p className="text-muted-foreground">إجمالي الكيلومترات</p>
                  <p className="font-bold text-foreground">{v.total_km.toLocaleString('en-US')} كم</p>
                </div>
                <div className="bg-background border border-border/60 rounded-xl px-3 py-2">
                  <p className="text-muted-foreground">تكلفة الوقود</p>
                  <p className="font-bold text-amber-600">{formatCurrency(v.total_fuel_cost)}</p>
                </div>
                {v.total_km > 0 && v.total_fuel_cost > 0 && (
                  <div className="bg-background border border-border/60 rounded-xl px-3 py-2">
                    <p className="text-muted-foreground">تكلفة الكم الواحد</p>
                    <p className="font-bold">{(v.total_fuel_cost / v.total_km).toFixed(2)} ر.س</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'maintenance_cost', label: 'أعلى تكلفة صيانة' },
  { value: 'maintenance_count', label: 'أكثر صيانات' },
  { value: 'fuel_cost', label: 'أعلى تكلفة وقود' },
  { value: 'km', label: 'أعلى كيلومترات' },
  { value: 'plate', label: 'رقم اللوحة' },
];
 
const VehicleReportPage = () => {
  const { authLoading } = useAuthQueryGate();
  const { permissions, loading: permsLoading } = usePermissions('maintenance');

  const {
    fromDate, setFromDate, toDate, setToDate,
    vehicleType, setVehicleType, status, setStatus,
    search, setSearch, sortKey, setSortKey,
    expandedId, toggleExpand, filters,
  } = useVehicleReportFilters();

  const query = useVehicleReport(filters);
  const kpis = useVehicleReportKPIs(query.data);
  const sorted = useSortedVehicles(query.data, search, sortKey);

  const [showFilters, setShowFilters] = useState(false);

  let alertDocsValue = 'لا تنبيهات';
  if (kpis.expiredDocs > 0) {
    alertDocsValue = `${kpis.expiredDocs} منتهية`;
  } else if (kpis.expiringDocs > 0) {
    alertDocsValue = `${kpis.expiringDocs} قريباً`;
  }

  let alertDocsColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (kpis.expiredDocs > 0) {
    alertDocsColor = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  } else if (kpis.expiringDocs > 0) {
    alertDocsColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  const renderList = () => {
    if (query.isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      );
    }
    if (sorted.length === 0 && !query.isError) {
      return (
        <div className="py-16 text-center bg-card border border-border/60 rounded-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Activity className="text-muted-foreground" size={28} />
          </div>
          <h3 className="text-sm font-semibold mb-1">لا توجد مركبات</h3>
          <p className="text-xs text-muted-foreground">جرّب تغيير الفلاتر أو مسح نص البحث.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {sorted.map((v) => (
          <VehicleCard
            key={v.id}
            v={v}
            expanded={expandedId === v.id}
            onToggle={() => toggleExpand(v.id)}
          />
        ))}
      </div>
    );
  };

  const escapeHtml = (v?: string | null) =>
    (v ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const exportToExcel = async () => {
    try {
      const XLSX = await loadXlsx();
      const rows: Record<string, unknown>[] = [];
      for (const v of sorted) {
        if (v.maintenance_logs.length === 0) {
          rows.push({
            'رقم اللوحة': v.plate_number, 'النوع': v.type === 'motorcycle' ? 'دباب' : 'سيارة',
            'الماركة': v.brand ?? '', 'الموديل': v.model ?? '', 'الحالة': STATUS_LABELS[v.status]?.label ?? v.status,
            'السائق الحالي': v.current_rider ?? '',
            'تاريخ الصيانة': '', 'نوع الصيانة': '', 'تكلفة الصيانة': 0,
            'إجمالي الكيلومترات': v.total_km, 'تكلفة الوقود': v.total_fuel_cost,
            'إجمالي تكلفة الصيانة': v.total_maintenance_cost,
          });
        } else {
          for (const log of v.maintenance_logs) {
            rows.push({
              'رقم اللوحة': v.plate_number, 'النوع': v.type === 'motorcycle' ? 'دباب' : 'سيارة',
              'الماركة': v.brand ?? '', 'الموديل': v.model ?? '', 'الحالة': STATUS_LABELS[v.status]?.label ?? v.status,
              'السائق الحالي': v.current_rider ?? '',
              'تاريخ الصيانة': log.maintenance_date
                ? new Date(log.maintenance_date).toLocaleDateString('ar-SA') : '',
              'نوع الصيانة': log.type,
              'تكلفة الصيانة': log.total_cost,
              'إجمالي الكيلومترات': v.total_km, 'تكلفة الوقود': v.total_fuel_cost,
              'إجمالي تكلفة الصيانة': v.total_maintenance_cost,
            });
          }
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقرير المركبات');
      XLSX.writeFile(wb, 'vehicle_report.xlsx');
    } catch (e) { console.error(e); }
  };

  const generateDocsRow = (v: VehicleReportRow) => {
    if (!v.insurance_expiry && !v.registration_expiry && !v.authorization_expiry) return '';
    let html = '<div class="docs-row">';
    if (v.insurance_expiry) html += `<span>تأمين: ${v.insurance_expiry}</span>`;
    if (v.registration_expiry) html += `<span>تسجيل: ${v.registration_expiry}</span>`;
    if (v.authorization_expiry) html += `<span>تفويض: ${v.authorization_expiry}</span>`;
    html += '</div>';
    return html;
  };

  const generateRowHtml = (v: VehicleReportRow) => {
    const statusLabel = STATUS_LABELS[v.status]?.label ?? v.status;
    const logsHtml = v.maintenance_logs.length === 0
      ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">لا توجد صيانات</td></tr>`
      : v.maintenance_logs.map((l) => `
        <tr>
          <td>${l.maintenance_date ? new Date(l.maintenance_date).toLocaleDateString('ar-SA') : ''}</td>
          <td>${escapeHtml(l.type)}</td>
          <td>${l.parts.map((p) => `${escapeHtml(p.name_ar)} ×${p.quantity_used}`).join('، ') || '—'}</td>
          <td>${formatCurrency(l.total_cost)}</td>
        </tr>`).join('');

    return `
      <div class="vehicle-block">
        <div class="vehicle-header">
          <div>
            <strong style="font-size:15px;" dir="ltr">${escapeHtml(v.plate_number)}</strong>
            ${v.brand ? ` — ${escapeHtml(v.brand)} ${escapeHtml(v.model ?? '')}` : ''}
            <span style="margin-right:8px;font-size:11px;color:#64748b;">(${statusLabel})</span>
          </div>
          ${v.current_rider ? `<div style="font-size:12px;color:#475569;">السائق: ${escapeHtml(v.current_rider)}</div>` : ''}
        </div>
        <div class="stats-row">
          <span>صيانة: <strong>${formatCurrency(v.total_maintenance_cost)}</strong></span>
          ${v.total_km > 0 ? `<span>كيلومترات: <strong>${v.total_km.toLocaleString('en-US')} كم</strong></span>` : ''}
          ${v.total_fuel_cost > 0 ? `<span>وقود: <strong>${formatCurrency(v.total_fuel_cost)}</strong></span>` : ''}
          <span>إجمالي التشغيل: <strong>${formatCurrency(v.total_maintenance_cost + v.total_fuel_cost)}</strong></span>
        </div>
        ${generateDocsRow(v)}
        <table>
          <thead><tr><th>التاريخ</th><th>نوع الصيانة</th><th>القطع</th><th>التكلفة</th></tr></thead>
          <tbody>${logsHtml}</tbody>
        </table>
      </div>`;
  };

  const printReport = () => {
    const rowsHtml = sorted.map(generateRowHtml).join('');

    const totalCost = sorted.reduce((s, v) => s + v.total_maintenance_cost + v.total_fuel_cost, 0);

    const headHtml = `
  <title>تقرير المركبات الشامل</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
    body { font-family: 'Droid Arabic Kufi', 'Tajawal', sans-serif; padding: 20px; color: #061735; background:#fff; margin:0; }
    .company { text-align:center; font-size:22px; font-weight:bold; margin-bottom:4px; }
    h1 { text-align:center; font-size:17px; margin:0 0 4px; }
    .meta { text-align:center; font-size:12px; color:#64748b; margin-bottom:20px; }
    .summary { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:20px; display:flex; gap:20px; flex-wrap:wrap; font-size:13px; }
    .vehicle-block { margin-bottom:24px; page-break-inside:avoid; }
    .vehicle-header { font-size:14px; background:#1e293b; color:#fff; padding:8px 12px; border-radius:6px 6px 0 0; }
    .stats-row { background:#f1f5f9; padding:6px 12px; font-size:12px; color:#334155; display:flex; gap:16px; flex-wrap:wrap; border:1px solid #e2e8f0; border-top:none; }
    .docs-row { background:#fefce8; padding:5px 12px; font-size:11px; color:#854d0e; display:flex; gap:12px; border:1px solid #fef08a; border-top:none; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-top:0; }
    th,td { border:1px solid #cbd5e1; padding:6px 8px; }
    th { background:#f8fafc; font-weight:bold; color:#334155; }
    tr:nth-child(even) { background:#f8fafc; }
    .total { text-align:left; font-size:14px; font-weight:bold; margin-top:16px; }
    @media print { body{padding:0;} .vehicle-block{page-break-inside:avoid;} }
  </style>
`;

    const bodyHtml = `
  <div class="company">شركة مهمة التوصيل للخدمات اللوجستية</div>
  <h1>تقرير المركبات الشامل</h1>
  <div class="meta">
    تاريخ الاستخراج: ${formatStandardDateTime()}
    ${fromDate || toDate ? ` | الفترة: من ${fromDate || 'البداية'} إلى ${toDate || 'النهاية'}` : ''}
  </div>
  <div class="summary">
    <span>إجمالي المركبات: <strong>${sorted.length}</strong></span>
    <span>إجمالي تكاليف الصيانة: <strong>${formatCurrency(kpis.totalMaintenanceCost)}</strong></span>
    <span>إجمالي تكاليف الوقود: <strong>${formatCurrency(kpis.totalFuelCost)}</strong></span>
    <span>إجمالي الكيلومترات: <strong>${kpis.totalKm.toLocaleString('en-US')} كم</strong></span>
    <span>إجمالي التكاليف التشغيلية: <strong>${formatCurrency(totalCost)}</strong></span>
  </div>
  ${rowsHtml}
  <div class="total">إجمالي التكاليف التشغيلية لجميع المركبات: ${formatCurrency(totalCost)}</div>
`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    
    doc.documentElement.dir = 'rtl';
    doc.documentElement.lang = 'ar';
    doc.head.innerHTML = headHtml;
    doc.body.innerHTML = bodyHtml;
    const cw = iframe.contentWindow;
    if (cw) {
      cw.focus();
      setTimeout(() => { cw.print(); setTimeout(() => { iframe.remove(); }, 500); }, 600);
    } else { iframe.remove(); }
  };

  if (authLoading || permsLoading) return <PageLoadingState />;
  if (!permissions.can_view) return <PageAccessDeniedState message="ليس لديك صلاحية الوصول لهذا التقرير" />;

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px]" dir="rtl">
      {/* Breadcrumb & Title */}
      <div className="flex-shrink-0 space-y-1">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>إدارة الحركة</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>تقرير المركبات</span>
        </nav>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ClipboardList size={18} /> تقرير المركبات الشامل
            </h1>
            <p className="text-sm text-muted-foreground">
              صيانة · وقود · كيلومترات · حالة المركبات · وثائق — كل شيء في مكان واحد
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl gap-1.5"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} /> فلاتر {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl gap-1.5"
              onClick={exportToExcel}
              disabled={query.isLoading || sorted.length === 0}
            >
              <Download size={14} /> Excel
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl gap-1.5"
              onClick={printReport}
              disabled={query.isLoading || sorted.length === 0}
            >
              <Printer size={14} /> طباعة / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="filter-from" className="text-xs text-muted-foreground mb-1 block">من تاريخ</label>
              <Input id="filter-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label htmlFor="filter-to" className="text-xs text-muted-foreground mb-1 block">إلى تاريخ</label>
              <Input id="filter-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label htmlFor="filter-type" className="text-xs text-muted-foreground mb-1 block">نوع المركبة</label>
              <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as 'all' | 'motorcycle' | 'car')}>
                <SelectTrigger id="filter-type" className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="motorcycle">دباب</SelectItem>
                  <SelectItem value="car">سيارة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="filter-status" className="text-xs text-muted-foreground mb-1 block">الحالة</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="filter-status" className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="filter-sort" className="text-xs text-muted-foreground mb-1 block">ترتيب حسب</label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger id="filter-sort" className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {query.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Car} label="إجمالي المركبات" value={kpis.totalVehicles}
            sub={`${kpis.activeCount} نشط · ${kpis.motorcycleCount} دباب · ${kpis.carCount} سيارة`}
            color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
          <KpiCard icon={Wrench} label="تكاليف الصيانة" value={formatCurrency(kpis.totalMaintenanceCost)}
            sub={kpis.highestMaintVehicle ? `الأعلى: ${kpis.highestMaintVehicle.plate_number}` : undefined}
            color="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" />
          <KpiCard icon={Fuel} label="تكاليف الوقود" value={formatCurrency(kpis.totalFuelCost)}
            color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
          <KpiCard icon={Route} label="إجمالي الكيلومترات" value={`${kpis.totalKm.toLocaleString('en-US')} كم`}
            color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" />
          <KpiCard icon={TrendingUp} label="إجمالي التشغيل" value={formatCurrency(kpis.totalOperatingCost)}
            sub={kpis.totalVehicles > 0 ? `متوسط ${formatCurrency(kpis.avgCostPerVehicle)} / مركبة` : undefined}
            color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" />
          <KpiCard icon={AlertTriangle} label="وثائق تنبيه"
            value={alertDocsValue}
            sub={kpis.expiringDocs > 0 ? `${kpis.expiringDocs} تنتهي خلال 30 يوم` : undefined}
            color={alertDocsColor} />
        </div>
      )}

      {/* Search + count */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            placeholder="بحث بالمركبة أو السائق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 h-9 rounded-xl bg-card border-border/60 text-sm"
          />
        </div>
        {!query.isLoading && (
          <span className="text-xs text-muted-foreground">
            {sorted.length} مركبة
          </span>
        )}
        {!showFilters && (
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-xs text-muted-foreground shrink-0">ترتيب:</span>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9 w-44 text-xs rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Error */}
      {query.isError && (
        <QueryErrorRetry
          error={query.error}
          isFetching={query.isFetching}
          onRetry={() => query.refetch().catch(() => {})}
          title="تعذر تحميل بيانات المركبات"
          hint="تحقق من الاتصال بالإنترنت."
        />
      )}

      {/* Vehicle list */}
      {renderList()}
    </div>
  );
};

export default VehicleReportPage;
