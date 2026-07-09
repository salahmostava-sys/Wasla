import { formatCurrency, formatStandardDateTime } from '@shared/lib/formatters';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Car, Banknote, Wrench, Calendar, Download, Printer, CheckSquare, Square, FileText, ChevronDown, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { useMaintenanceLogs } from '@modules/maintenance/hooks/useMaintenanceData';
import type { MaintenanceLogWithDetails } from '@services/maintenanceService';
import { loadXlsx } from '@modules/orders/utils/xlsx';


const TYPE_COLORS: Record<string, string> = {
  'غيار زيت':    'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'صيانة دورية': 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  'إطارات':      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'بطارية':      'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  'فرامل':       'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  'أعطال':       'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  'أخرى':        'bg-muted text-muted-foreground',
};

type VehicleGroup = {
  vehicle_id: string;
  plate_number: string;
  type: string;
  logs: MaintenanceLogWithDetails[];
  total_cost: number;
};

interface VehicleDropdownProps {
  vehicleGroups: VehicleGroup[];
  activeSelection: Set<string>;
  toggleVehicle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
}

function VehicleDropdown({ vehicleGroups, activeSelection, toggleVehicle, selectAll, clearAll }: VehicleDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = vehicleGroups.filter(g =>
    g.plate_number.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedCount = activeSelection.size;
  const total = vehicleGroups.length;
  const allSelected = selectedCount === total;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-card text-sm hover:border-primary/50 transition-colors"
        >
          <Car size={14} className="text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            {allSelected
              ? 'جميع المركبات'
              : selectedCount === 0
              ? 'اختر المركبات…'
              : `${selectedCount} من ${total} مركبة`}
          </span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {!allSelected && selectedCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 h-9 px-2.5 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
            title="إلغاء التحديد"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-11 right-0 z-50 w-80 max-h-80 bg-popover border border-border rounded-xl shadow-lg overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن رقم لوحة…"
                className="w-full h-8 pr-8 pl-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Select all / Clear */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-border/30">
            <button
              type="button"
              onClick={selectAll}
              className="flex-1 text-xs py-1 rounded-lg hover:bg-muted/60 transition-colors text-center"
            >
              <CheckSquare size={11} className="inline ml-1" />
              تحديد الكل
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="flex-1 text-xs py-1 rounded-lg hover:bg-muted/60 transition-colors text-center"
            >
              <Square size={11} className="inline ml-1" />
              إلغاء التحديد
            </button>
          </div>

          {/* Vehicle list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد نتائج</p>
            ) : (
              filtered.map(g => {
                const checked = activeSelection.has(g.vehicle_id);
                return (
                  <button
                    key={g.vehicle_id}
                    type="button"
                    onClick={() => toggleVehicle(g.vehicle_id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-right hover:bg-muted/50 transition-colors ${
                      checked ? 'bg-primary/5 text-primary' : 'text-foreground'
                    }`}
                  >
                    {checked
                      ? <CheckSquare size={13} className="shrink-0 text-primary" />
                      : <Square size={13} className="shrink-0 text-muted-foreground" />}
                    <span className="font-mono">{g.plate_number}</span>
                    <span className="text-muted-foreground mr-auto">{g.logs.length} عملية</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


interface VehicleGroupCardProps {
  group: VehicleGroup;
}

function VehicleGroupCard({ group }: VehicleGroupCardProps) {
  const uniqueTypes = useMemo(() => Array.from(new Set(group.logs.map(l => l.type))), [group.logs]);
  
  const uniqueParts = useMemo(() => {
    const parts = group.logs
      .flatMap(l => l.maintenance_parts ?? [])
      .map(p => p.spare_parts?.name_ar)
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '');
    return Array.from(new Set(parts));
  }, [group.logs]);

  const typesText = uniqueTypes.join('، ') || 'صيانة عامة';

  return (
    <details className="group bg-card border border-border/60 rounded-xl overflow-hidden">
      <summary className="px-4 py-4 hover:bg-muted/50 transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full pr-2 gap-4">
          
          {/* Right side: Vehicle plate number & icon */}
          <div className="flex items-center gap-3 min-w-[180px] shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Car size={20} />
            </div>
            <div className="flex flex-col items-start text-right min-w-0">
              <span className="font-bold text-base truncate">{group.plate_number}</span>
              <span className="text-xs text-muted-foreground">{group.type} • {group.logs.length} عمليات صيانة</span>
            </div>
          </div>

          {/* Middle side: Repairs and parts summary */}
          <div className="flex-1 min-w-0 text-right md:px-4">
            <span className="text-sm font-semibold text-foreground truncate block">
              {typesText}
            </span>
            {uniqueParts.length > 0 && (
              <span className="text-xs text-muted-foreground truncate block mt-0.5" title={uniqueParts.join('، ')}>
                قطع: {uniqueParts.join('، ')}
              </span>
            )}
          </div>

          {/* Left side: Cost & Expand Indicator */}
          <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-border/30">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <Banknote size={16} className="shrink-0" />
              <span className="font-bold text-lg">{formatCurrency(group.total_cost)}</span>
            </div>
            <ChevronDown size={18} className="text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </div>

        </div>
      </summary>
      <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border/40 shadow-inner group-open:block hidden">
        <div className="space-y-3 mt-3">
          {group.logs.map(log => {
            const colorClass = TYPE_COLORS[log.type] ?? TYPE_COLORS['أخرى'];
            const dateFormatted = log.maintenance_date
              ? new Date(log.maintenance_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
              : '—';
            
            return (
              <div key={log.id} className="bg-background border border-border/60 rounded-lg p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
                      {log.type}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={12} />
                      {dateFormatted}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {formatCurrency(Number(log.total_cost))}
                  </span>
                </div>
                {log.notes && (
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {log.notes}
                  </p>
                )}
                {log.maintenance_parts && log.maintenance_parts.length > 0 && (
                  <div className="space-y-1 border-t border-border/50 pt-2 mt-2">
                    {log.maintenance_parts.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Wrench size={10} />
                          <span>{p.spare_parts?.name_ar ?? '—'}</span>
                        </div>
                        <span>
                          {p.quantity_used} × {Number(p.cost_at_time).toLocaleString('en-US')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function VehicleReportsTab() {
  const logsQ = useMaintenanceLogs();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);

  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data]);

  const filteredLogsByDate = useMemo(() => {
    return logs.filter((log) => {
      if (!log.maintenance_date) return true;
      const logD = log.maintenance_date.split('T')[0];
      if (fromDate && logD < fromDate) return false;
      if (toDate && logD > toDate) return false;
      return true;
    });
  }, [logs, fromDate, toDate]);

  const vehicleGroups = useMemo(() => {
    const groups = new Map<string, VehicleGroup>();
    for (const log of filteredLogsByDate) {
      if (!log.vehicles) continue;
      const vId = log.vehicle_id;
      if (!groups.has(vId)) {
        groups.set(vId, {
          vehicle_id: vId,
          plate_number: log.vehicles.plate_number,
          type: log.vehicles.type,
          logs: [],
          total_cost: 0,
        });
      }
      const g = groups.get(vId)!;
      g.logs.push(log);
      g.total_cost += Number(log.total_cost) || 0;
    }
    return Array.from(groups.values()).sort((a, b) => b.total_cost - a.total_cost);
  }, [filteredLogsByDate]);

  // بمجرد توفر بيانات المركبات، حدد الكل افتراضياً (المستخدم يقدر يلغي تحديد مركبات بعينها)
  useEffect(() => {
    if (vehicleGroups.length > 0 && selectedIds === null) {
      setSelectedIds(new Set(vehicleGroups.map(g => g.vehicle_id)));
    }
  }, [vehicleGroups, selectedIds]);

  const activeSelection = useMemo(
    () => selectedIds ?? new Set(vehicleGroups.map(g => g.vehicle_id)),
    [vehicleGroups, selectedIds]
  );

  const toggleVehicle = (vehicleId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev ?? vehicleGroups.map(g => g.vehicle_id));
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(vehicleGroups.map(g => g.vehicle_id)));
  const clearAll = () => setSelectedIds(new Set());

  const filteredGroups = useMemo(() => {
    const t = search.trim().toLowerCase();
    return vehicleGroups.filter(g => {
      if (!activeSelection.has(g.vehicle_id)) return false;
      if (!t) return true;
      return (g.plate_number || '').toLowerCase().includes(t) || (g.type || '').toLowerCase().includes(t);
    });
  }, [vehicleGroups, search, activeSelection]);

  const exportToExcel = async () => {
    try {
      const XLSX = await loadXlsx();
      const rows = [];
      for (const group of filteredGroups) {
        if (group.logs.length === 0) {
          rows.push({
            'رقم اللوحة': group.plate_number,
            'نوع المركبة': group.type,
            'التاريخ': '',
            'نوع الصيانة': '',
            'التكلفة': group.total_cost,
            'ملاحظات': 'لا توجد صيانات مسجلة',
          });
        } else {
          for (const log of group.logs) {
            rows.push({
              'رقم اللوحة': group.plate_number,
              'نوع المركبة': group.type,
              'التاريخ': log.maintenance_date ? new Date(log.maintenance_date).toLocaleDateString('ar-SA') : '',
              'نوع الصيانة': log.type,
              'التكلفة': Number(log.total_cost) || 0,
              'ملاحظات': log.notes || '',
            });
          }
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقارير المركبات');
      XLSX.writeFile(wb, `Vehicle_Reports.xlsx`);
    } catch (err) {
      console.error('Failed to export to excel', err);
    }
  };

  /** يمنع كسر جدول الـ PDF أو حقن HTML عند وجود رموز خاصة في الملاحظات/أسماء القطع */
  const escapeHtml = (value?: string | null) => {
    if (!value) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  };

  const partsSummary = (log: MaintenanceLogWithDetails) =>
    (log.maintenance_parts ?? [])
      .map(p => `${escapeHtml(p.spare_parts?.name_ar ?? '—')} ×${p.quantity_used}`)
      .join('، ');

  const printReport = (mode: 'separated' | 'combined' = 'separated') => {
    let bodyHtml = '';

    if (mode === 'separated') {
      bodyHtml = filteredGroups.map((g) => {
        const tableHtml = g.logs.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; color: #94a3b8;">لا توجد صيانات مسجلة</td>
              </tr>` : g.logs.map(log => `
              <tr>
                <td>${log.maintenance_date ? new Date(log.maintenance_date).toLocaleDateString('ar-SA') : ''}</td>
                <td>${escapeHtml(log.type)}</td>
                <td>${partsSummary(log) || '—'}</td>
                <td>${(Number(log.total_cost) || 0).toLocaleString('en-US')} ر.س</td>
                <td>${escapeHtml(log.notes || '')}</td>
              </tr>
            `).join('');

        return `
        <div class="page-break">
          <div class="company-name">شركة مهمة التوصيل للخدمات اللوجستية</div>
          <h1>تقرير صيانة المركبات والمخزون</h1>
          <div class="header-info">
            <p>تاريخ الاستخراج: ${formatStandardDateTime()}</p>
            ${fromDate || toDate ? `<p>الفترة: من ${fromDate || 'البداية'} إلى ${toDate || 'النهاية'}</p>` : ''}
            <p style="font-size: 15px; font-weight: bold; color: #0f172a; margin-top: 10px;">المركبة: ${escapeHtml(g.type)} - لوحة: <span style="direction: ltr; display: inline-block;">${escapeHtml(g.plate_number)}</span></p>
          </div>
          <table>
            <thead>
              <tr>
                <th>تاريخ الصيانة</th>
                <th>نوع الصيانة</th>
                <th>القطع المستخدمة</th>
                <th>التكلفة</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${tableHtml}
            </tbody>
          </table>
          <p class="totals">إجمالي تكلفة الصيانة لهذه المركبة: ${formatCurrency(g.total_cost)}</p>
        </div>
        `;
      }).join('');
    } else {
      const allRowsHtml = filteredGroups.map(g => {
        if (g.logs.length === 0) {
          return `<tr>
            <td><strong>${escapeHtml(g.type)}<br/><span style="direction: ltr; display: inline-block;">${escapeHtml(g.plate_number)}</span></strong></td>
            <td colspan="5" style="text-align: center; color: #94a3b8;">لا توجد صيانات مسجلة</td>
          </tr>`;
        }
        return g.logs.map((log, idx) => `
          <tr>
            ${idx === 0 ? `<td rowspan="${g.logs.length}"><strong>${escapeHtml(g.type)}<br/><span style="direction: ltr; display: inline-block;">${escapeHtml(g.plate_number)}</span></strong></td>` : ''}
            <td>${log.maintenance_date ? new Date(log.maintenance_date).toLocaleDateString('ar-SA') : ''}</td>
            <td>${escapeHtml(log.type)}</td>
            <td>${partsSummary(log) || '—'}</td>
            <td>${(Number(log.total_cost) || 0).toLocaleString('en-US')} ر.س</td>
            <td>${escapeHtml(log.notes || '')}</td>
          </tr>
        `).join('');
      }).join('');

      const totalCostSum = filteredGroups.reduce((sum, g) => sum + g.total_cost, 0);

      bodyHtml = `
        <div>
          <div class="company-name">شركة مهمة التوصيل للخدمات اللوجستية</div>
          <h1>تقرير صيانة المركبات والمخزون المجمع</h1>
          <div class="header-info">
            <p>تاريخ الاستخراج: ${formatStandardDateTime()}</p>
            ${fromDate || toDate ? `<p>الفترة: من ${fromDate || 'البداية'} إلى ${toDate || 'النهاية'}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>المركبة</th>
                <th>تاريخ الصيانة</th>
                <th>نوع الصيانة</th>
                <th>القطع المستخدمة</th>
                <th>التكلفة</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${allRowsHtml}
            </tbody>
          </table>
          <p class="totals">إجمالي تكلفة الصيانة لجميع المركبات المحددة: ${formatCurrency(totalCostSum)}</p>
        </div>
      `;
    }

    const headHtml = `
      <title>تقرير صيانة المركبات</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
        body { font-family: 'Tajawal', system-ui, sans-serif; padding: 20px; margin: 0; color: #111; background: #fff; }
        .company-name { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 5px; color: #1e293b; }
        h1 { text-align: center; margin-bottom: 5px; color: #0f172a; font-size: 18px; }
        .header-info { text-align: center; margin-bottom: 20px; font-size: 13px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: right; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; }
        th { background-color: #f8fafc; font-weight: bold; color: #334155; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .totals { text-align: left; margin-top: 12px; font-size: 13px; font-weight: bold; color: #0f172a; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; margin: 0; }
          .page-break { page-break-after: always; padding-bottom: 20px; }
          .page-break:last-child { page-break-after: auto; }
        }
      </style>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.documentElement.dir = 'rtl';
    doc.documentElement.lang = 'ar';
    doc.head.innerHTML = headHtml;
    doc.body.innerHTML = bodyHtml;

    const contentWindow = iframe.contentWindow;
    if (contentWindow) {
      contentWindow.focus();
      setTimeout(() => {
        contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) iframe.remove();
        }, 500);
      }, 500);
    } else {
      iframe.remove();
    }
  };

  if (logsQ.isError) {
    return (
      <QueryErrorRetry
        error={logsQ.error}
        isFetching={logsQ.isFetching}
        onRetry={() => logsQ.refetch().catch(() => {})}
        title="تعذر تحميل تقارير الصيانة"
        hint="تحقق من الاتصال بالإنترنت أو أعد المحاولة."
      />
    );
  }

  const renderLogsList = () => {
    if (logsQ.isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      );
    }

    if (filteredGroups.length === 0) {
      return (
        <div className="py-12 text-center bg-card border border-border/60 rounded-xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Car className="text-muted-foreground" size={24} />
          </div>
          <h3 className="text-sm font-semibold mb-1">لا توجد بيانات</h3>
          <p className="text-xs text-muted-foreground">لم يتم العثور على مركبات مطابقة.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredGroups.map(group => (
          <VehicleGroupCard key={group.vehicle_id} group={group} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-4">
          <div className="bg-card border border-border/60 rounded-xl px-4 py-2 flex flex-col justify-center min-w-[120px]">
            <span className="text-xs text-muted-foreground mb-1">المركبات التي تمت صيانتها</span>
            <span className="text-lg font-bold text-foreground">
              {logsQ.isLoading ? <Skeleton className="h-6 w-12" /> : vehicleGroups.length}
            </span>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 bg-card border border-border/60 p-1 rounded-xl">
            <Input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 text-xs bg-transparent border-none w-full sm:w-32 focus-visible:ring-0"
              title="من تاريخ"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <Input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 text-xs bg-transparent border-none w-full sm:w-32 focus-visible:ring-0"
              title="إلى تاريخ"
            />
          </div>

          <div className="relative w-full sm:w-48 shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="بحث برقم اللوحة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 h-10 rounded-xl bg-card border-border/60"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 rounded-xl" disabled={logsQ.isLoading || filteredGroups.length === 0}>
                  <Printer size={16} className="ml-2" />
                  معاينة و PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => printReport('combined')} className="py-3 cursor-pointer">
                  <FileText size={16} className="ml-2 text-muted-foreground" />
                  <span>طباعة مجمعة للمركبات</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => printReport('separated')} className="py-3 cursor-pointer">
                  <Printer size={16} className="ml-2 text-muted-foreground" />
                  <span>طباعة ملف لكل دباب منفصل</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="h-10 rounded-xl" onClick={exportToExcel} disabled={logsQ.isLoading || filteredGroups.length === 0}>
              <Download size={16} className="ml-2" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Vehicle selection — compact dropdown */}
      {!logsQ.isLoading && vehicleGroups.length > 0 && (
        <VehicleDropdown
          vehicleGroups={vehicleGroups}
          activeSelection={activeSelection}
          toggleVehicle={toggleVehicle}
          selectAll={selectAll}
          clearAll={clearAll}
        />
      )}

      {renderLogsList()}
    </div>
  );
}
