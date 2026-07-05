import { useState, useMemo } from 'react';
import { Plus, Trash2, Search, Wrench, Calendar, Car, Banknote } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { Skeleton } from '@shared/components/ui/skeleton';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useMaintenanceLogs, useSpareParts, useInvalidateMaintenanceQueries } from '@modules/maintenance/hooks/useMaintenanceData';
import { vehicleService } from '@services/vehicleService';
import * as maintenanceService from '@services/maintenanceService';
import type { MaintenanceLogWithDetails } from '@services/maintenanceService';
import { AddMaintenanceModal } from '@modules/maintenance/components/AddMaintenanceModal';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';

const TYPE_COLORS: Record<string, string> = {
  'غيار زيت':    'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  'صيانة دورية': 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  'إطارات':      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'بطارية':      'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
  'فرامل':       'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  'أعطال':       'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  'أخرى':        'bg-muted text-muted-foreground',
};

function LogCard({ log, canDelete, onDelete }: Readonly<{
  log: MaintenanceLogWithDetails;
  canDelete: boolean;
  onDelete: (log: MaintenanceLogWithDetails) => void;
}>) {
  const colorClass = TYPE_COLORS[log.type] ?? TYPE_COLORS['أخرى'];
  const dateFormatted = log.maintenance_date
    ? new Date(log.maintenance_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colorClass}`}>
            {log.type}
          </span>
          {log.status && log.status !== 'مكتملة' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              {log.status}
            </span>
          )}
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(log)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Car size={13} className="shrink-0" />
          <span className="font-semibold text-foreground">{log.vehicles?.plate_number ?? '—'}</span>
          {log.vehicles?.type && <span className="text-xs text-muted-foreground">({log.vehicles.type})</span>}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar size={13} className="shrink-0" />
          <span className="text-foreground">{dateFormatted}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
          <Banknote size={13} className="shrink-0" />
          <span className="font-bold text-foreground">{Number(log.total_cost).toLocaleString('en-US')} ر.س</span>
        </div>
      </div>

      {log.notes && (
        <p className="mt-2.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
          {log.notes}
        </p>
      )}

      {log.maintenance_parts && log.maintenance_parts.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">قطع الغيار المستخدمة:</p>
          {log.maintenance_parts.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2.5 py-1.5">
              <span>{p.spare_parts?.name_ar ?? '—'}</span>
              <span className="text-muted-foreground">
                {p.quantity_used} {p.spare_parts?.unit ?? ''} × {Number(p.cost_at_time).toLocaleString('en-US')} ر.س
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MaintenanceLogsTab() {
  const { permissions } = usePermissions('maintenance');
  const { toast } = useToast();
  const invalidate = useInvalidateMaintenanceQueries();
  const logsQ = useMaintenanceLogs();
  const partsQ = useSpareParts();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);

  const vehiclesQ = useQuery({
    queryKey: ['vehicles', 'select', uid],
    queryFn: () => vehicleService.getForSelect(),
    enabled,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLogWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return logs;
    return logs.filter(l =>
      [l.vehicles?.plate_number, l.type, l.notes ?? ''].join(' ').toLowerCase().includes(t)
    );
  }, [logs, search]);

  const totalCost = useMemo(() =>
    logs.reduce((s, l) => s + Number(l.total_cost ?? 0), 0), [logs]
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await maintenanceService.deleteMaintenanceLog(deleteTarget.id);
      toast({ title: 'تم حذف سجل الصيانة' });
      invalidate();
    } catch (err) {
      toast({ title: 'خطأ في الحذف', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (logsQ.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logsQ.isError && !logsQ.isLoading && (
        <QueryErrorRetry
          error={logsQ.error}
          onRetry={() => logsQ.refetch().catch(() => {})}
          title="تعذر تحميل سجلات الصيانة"
          hint="تحقق من الاتصال بالإنترنت أو أعد المحاولة."
        />
      )}
      {partsQ.isError && !partsQ.isLoading && (
        <QueryErrorRetry
          error={partsQ.error}
          onRetry={() => partsQ.refetch().catch(() => {})}
          title="تعذر تحميل قطع الغيار"
          hint="تحقق من الاتصال بالإنترنت أو أعد المحاولة."
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{logs.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
          </div>
          <div className="border-r border-border/50" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{totalCost.toLocaleString('en-US')}</p>
            <p className="text-xs text-muted-foreground">إجمالي التكاليف (ر.س)</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث باللوحة أو نوع الصيانة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-8"
            />
          </div>
          {permissions.can_edit && (
            <Button onClick={() => setAddOpen(true)} className="gap-1.5 shrink-0">
              <Plus size={16} /> إضافة صيانة
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{search ? 'لا توجد نتائج' : 'لا توجد سجلات صيانة'}</p>
          {!search && permissions.can_edit && (
            <p className="text-sm mt-1">اضغط "إضافة صيانة" لتسجيل أول عملية</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(log => (
            <LogCard
              key={log.id}
              log={log}
              canDelete={permissions.can_delete}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AddMaintenanceModal
        open={addOpen}
        onOpenChange={setAddOpen}
        vehicles={vehiclesQ.data ?? []}
        spareParts={partsQ.data ?? []}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سجل الصيانة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف صيانة "{deleteTarget?.type}" للمركبة "{deleteTarget?.vehicles?.plate_number}"؟
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'جاري الحذف...' : 'نعم، احذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
