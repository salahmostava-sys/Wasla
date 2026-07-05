import { useState, useMemo } from 'react';
import { Search, Car, Banknote, Wrench, Calendar, Download } from 'lucide-react';
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

export function VehicleReportsTab() {
  const logsQ = useMaintenanceLogs();
  const [search, setSearch] = useState('');

  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data]);

  const vehicleGroups = useMemo(() => {
    const groups = new Map<string, VehicleGroup>();
    for (const log of logs) {
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
  }, [logs]);

  const filteredGroups = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return vehicleGroups;
    return vehicleGroups.filter(g =>
      g.plate_number.toLowerCase().includes(t) ||
      g.type.toLowerCase().includes(t)
    );
  }, [vehicleGroups, search]);

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
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="بحث برقم اللوحة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button variant="outline" onClick={exportToExcel} disabled={logsQ.isLoading || filteredGroups.length === 0}>
            <Download size={16} className="ml-2" />
            تصدير
          </Button>
        </div>
      </div>

      {logsQ.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border/60 rounded-xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Car className="text-muted-foreground" size={24} />
          </div>
          <h3 className="text-sm font-semibold mb-1">لا توجد بيانات</h3>
          <p className="text-xs text-muted-foreground">لم يتم العثور على مركبات مطابقة.</p>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="w-full flex flex-col">
            {filteredGroups.map(group => (
              <details key={group.vehicle_id} className="group border-b last:border-b-0">
                <summary className="px-4 py-4 hover:bg-muted/50 transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Car size={20} />
                      </div>
                      <div className="flex flex-col items-start text-right">
                        <span className="font-bold text-base">{group.plate_number}</span>
                        <span className="text-xs text-muted-foreground">{group.type} • {group.logs.length} عمليات صيانة</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 shrink-0">
                      <Banknote size={16} className="shrink-0" />
                      <span className="font-bold">{group.total_cost.toLocaleString('en-US')} ر.س</span>
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
                              {Number(log.total_cost).toLocaleString('en-US')} ر.س
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
