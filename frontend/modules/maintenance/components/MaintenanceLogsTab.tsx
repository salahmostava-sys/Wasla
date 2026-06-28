import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Label } from '@shared/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/components/ui/collapsible';
import { Link } from 'react-router-dom';
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
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useMaintenanceLogs, useSpareParts, useInvalidateMaintenanceQueries } from '@modules/maintenance/hooks/useMaintenanceData';
import { vehicleService } from '@services/vehicleService';
import * as maintenanceService from '@services/maintenanceService';
import type { MaintenanceLogWithDetails } from '@services/maintenanceService';
import { AddMaintenanceModal } from '@modules/maintenance/components/AddMaintenanceModal';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';

const MAINT_TYPES_ALL = [
  'غيار زيت',
  'صيانة دورية',
  'إطارات',
  'بطارية',
  'فرامل',
  'أعطال',
  'أخرى',
];

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
  const [typeFilter, setTypeFilter] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    MAINT_TYPES_ALL.forEach((t) => {
      m[t] = true;
    });
    return m;
  });
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLogWithDetails | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lowStockParts = useMemo(() => {
    const list = partsQ.data ?? [];
    return list.filter((p) => Number(p.stock_quantity) < Number(p.min_stock_alert ?? 0));
  }, [partsQ.data]);

  const filtered = useMemo(() => {
    const logs = logsQ.data ?? [];
    const q = search.trim().toLowerCase();
    return logs.filter((row) => {
      if (!typeFilter[row.type]) return false;
      if (!q) return true;
      const plate = row.vehicles?.plate_number?.toLowerCase() ?? '';
      const driver = row.employees?.name?.toLowerCase() ?? '';
      const maintType = row.type?.toLowerCase() ?? '';
      return plate.includes(q) || driver.includes(q) || maintType.includes(q);
    });
  }, [logsQ.data, search, typeFilter]);

  const filteredTotals = useMemo(() => {
    const totalCost = filtered.reduce((s, row) => s + Number(row.total_cost ?? 0), 0);
    return { count: filtered.length, totalCost };
  }, [filtered]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await maintenanceService.deleteMaintenanceLog(deleteTarget.id);
      toast({ title: 'تم حذف السجل' });
      invalidate();
      setDeleteTarget(null);
    } catch (e) {
      toast({
        title: 'تعذر الحذف',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const loading = logsQ.isLoading || partsQ.isLoading;

  return (
    <div className="space-y-4" dir="rtl">
      {lowStockParts.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm flex flex-wrap items-center gap-2 justify-between">
          <span>
            <strong>تنبيه مخزون:</strong> يوجد {lowStockParts.length} قطعة تحت الحد الأدنى.
          </span>
          <Link
            to="/maintenance?tab=inventory"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            فتح تبويب المخزون
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border bg-card/80 p-4 shadow-sm rounded-2xl">
          <div className="text-xs text-muted-foreground">سجلات مطابقة للتصفية</div>
          <div className="text-2xl font-bold tabular-nums">{filteredTotals.count}</div>
        </div>
        <div className="border bg-card/80 p-4 shadow-sm sm:col-span-2 rounded-2xl">
          <div className="text-xs text-muted-foreground">مجموع التكلفة (للسجلات المصفاة)</div>
          <div className="text-2xl font-bold tabular-nums text-primary">
            {filteredTotals.totalCost.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            className="pr-9"
            placeholder="بحث باللوحة، السائق، أو نوع الصيانة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {permissions.can_edit && (
          <Button className="gap-1 w-full sm:w-auto shrink-0" onClick={() => setAddOpen(true)}>
            <Plus size={16} /> إضافة صيانة
          </Button>
        )}
      </div>

      <Collapsible defaultOpen className="rounded-xl border border-border/60 bg-muted/15">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/30 rounded-t-xl">
          <span>تصفية نوع الصيانة</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-3 pb-3 pt-0 border-t border-border/40">
            {MAINT_TYPES_ALL.map((t) => (
              <div key={t} className="flex items-center gap-2">
                <Checkbox
                  id={`mt-${t}`}
                  checked={typeFilter[t]}
                  onCheckedChange={(c) => setTypeFilter((prev) => ({ ...prev, [t]: c === true }))}
                />
                <Label htmlFor={`mt-${t}`} className="text-xs cursor-pointer">
                  {t}
                </Label>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="bg-card shadow-card overflow-hidden border border-border/50 rounded-2xl">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="ta-th text-right">التاريخ</th>
                <th className="ta-th text-right">المركبة</th>
                <th className="ta-th text-right">السائق</th>
                <th className="ta-th text-right">النوع</th>
                <th className="ta-th w-20">قطع الغيار</th>
                <th className="ta-th text-right">العداد</th>
                <th className="ta-th text-right">التكلفة</th>
                <th className="ta-th text-right">الحالة</th>
                <th className="ta-th text-right w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="ta-td text-muted-foreground">
                    <Loader2 className="inline animate-spin me-2" size={18} />
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="ta-td">{row.maintenance_date}</td>
                    <td className="ta-td font-medium">
                      {row.vehicles?.plate_number ?? '-'}
                    </td>
                    <td className="ta-td">{row.employees?.name ?? '-'}</td>
                    <td className="ta-td">{row.type}</td>
                    <td className="ta-td text-muted-foreground">
                      {row.maintenance_parts?.length
                        ? `${row.maintenance_parts.length} بند`
                        : '-'}
                    </td>
                    <td className="ta-td">
                      {row.odometer_reading ?? '-'}
                    </td>
                    <td className="ta-td">
                      {Number(row.total_cost ?? 0).toLocaleString('ar-SA')} ر.س
                    </td>
                    <td className="ta-td">{row.status}</td>
                    <td className="ta-td">
                      {permissions.can_delete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="ta-td text-muted-foreground">
                    لا توجد سجلات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddMaintenanceModal
        open={addOpen}
        onOpenChange={setAddOpen}
        vehicles={vehiclesQ.data ?? []}
        spareParts={partsQ.data ?? []}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سجل الصيانة؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleDelete(); }} disabled={deleting}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
