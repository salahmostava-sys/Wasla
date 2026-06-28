import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Textarea } from '@shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import { useToast } from '@shared/hooks/use-toast';
import * as maintenanceService from '@services/maintenanceService';
import type { SparePart } from '@services/maintenanceService';
import { useInvalidateMaintenanceQueries } from '@modules/maintenance/hooks/useMaintenanceData';

const MAINT_TYPES = [
  'غيار زيت',
  'صيانة دورية',
  'إطارات',
  'بطارية',
  'فرامل',
  'أعطال',
  'أخرى',
] as const;

type VehicleOpt = { id: string; plate_number: string; brand?: string | null };

type PartRow = { id: string; part_id: string; quantity_used: string; cost_at_time: string };

type Props = Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: VehicleOpt[];
  spareParts: SparePart[];
}>;

export function AddMaintenanceModal({ open, onOpenChange, vehicles, spareParts }: Readonly<Props>) {
  const { toast } = useToast();
  const invalidate = useInvalidateMaintenanceQueries();
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState<string | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [maintType, setMaintType] = useState<string>(MAINT_TYPES[0]);
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<PartRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVehicleId('');
    setDriverName(null);
    setMaintenanceDate(format(new Date(), 'yyyy-MM-dd'));
    setMaintType(MAINT_TYPES[0]);
    setOdometer('');
    setNotes('');
    setRows([]);
  }, [open]);

  useEffect(() => {
    if (!vehicleId) {
      setDriverName(null);
      return;
    }
    let cancelled = false;
    maintenanceService.getCurrentDriverNameForVehicle(vehicleId).then((n) => {
      if (!cancelled) setDriverName(n);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const partById = useMemo(() => {
    const m: Record<string, SparePart> = {};
    spareParts.forEach((p) => {
      m[p.id] = p;
    });
    return m;
  }, [spareParts]);

  const addRow = () => {
    setRows((r) => [...r, { id: crypto.randomUUID(), part_id: '', quantity_used: '1', cost_at_time: '' }]);
  };

  const updateRow = (i: number, patch: Partial<PartRow>) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = { ...next[i], ...patch };
      if (patch.part_id !== undefined && patch.part_id) {
        const sp = partById[patch.part_id];
        if (sp) cur.cost_at_time = String(sp.unit_cost);
      }
      next[i] = cur;
      return next;
    });
  };

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const stockWarning = (row: PartRow): string | null => {
    if (!row.part_id) return null;
    const sp = partById[row.part_id];
    if (!sp) return null;
    const q = Number.parseFloat(row.quantity_used) || 0;
    if (q > Number(sp.stock_quantity)) return 'الكمية أكبر من المخزون المتاح';
    return null;
  };

  const totalCost = useMemo(() => {
    let t = 0;
    rows.forEach((row) => {
      const q = Number.parseFloat(row.quantity_used) || 0;
      const c = Number.parseFloat(row.cost_at_time) || 0;
      t += q * c;
    });
    return t;
  }, [rows]);

  const blocked = rows.some((r) => stockWarning(r));

  const handleSave = async () => {
    if (!vehicleId) {
      toast({ title: 'اختر المركبة', variant: 'destructive' });
      return;
    }
    if (rows.some((r) => stockWarning(r))) {
      toast({ title: 'صحح كميات القطع', variant: 'destructive' });
      return;
    }
    const parts = rows
      .filter((r) => r.part_id)
      .map((r) => ({
        part_id: r.part_id,
        quantity_used: Number.parseFloat(r.quantity_used) || 0,
        cost_at_time: Number.parseFloat(r.cost_at_time) || 0,
      }));
    setSaving(true);
    try {
      await maintenanceService.createMaintenanceLog(
        {
          vehicle_id: vehicleId,
          maintenance_date: maintenanceDate,
          type: maintType,
          odometer_reading: odometer ? Number.parseInt(odometer, 10) : undefined,
          notes: notes || undefined,
        },
        parts
      );
      toast({ title: 'تم حفظ سجل الصيانة' });
      invalidate();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'تعذر الحفظ',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة صيانة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>المركبة</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المركبة" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate_number}
                    {v.brand ? ` - ${v.brand}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {driverName && (
              <p className="text-xs text-muted-foreground">السائق الحالي: {driverName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>تاريخ الصيانة</Label>
              <Input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الصيانة</Label>
              <Select value={maintType} onValueChange={setMaintType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAINT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>قراءة العداد</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              placeholder="اختياري"
            />
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label>قطع الغيار المستخدمة</Label>
              <Button type="button" variant="default" size="sm" className="gap-1" onClick={addRow}>
                <Plus size={14} /> إضافة قطعة
              </Button>
            </div>
            {rows.map((row) => {
              const warn = stockWarning(row);
              const i = rows.indexOf(row);
              return (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-end border-b border-border/40 pb-2">
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <Select
                      value={row.part_id || undefined}
                      onValueChange={(v) => updateRow(i, { part_id: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="القطعة" />
                      </SelectTrigger>
                      <SelectContent>
                        {spareParts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name_ar} (متوفر: {p.stock_quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {warn && <p className="text-xs text-destructive">{warn}</p>}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      className="h-9"
                      type="number"
                      placeholder="الكمية"
                      value={row.quantity_used}
                      onChange={(e) => updateRow(i, { quantity_used: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      className="h-9"
                      type="number"
                      placeholder="سعر الوحدة"
                      value={row.cost_at_time}
                      onChange={(e) => updateRow(i, { cost_at_time: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          <div className="text-sm font-semibold">
            التكلفة الإجمالية: {totalCost.toFixed(2)} ريال
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={saving || blocked} onClick={() => { handleSave(); }}>
              حفظ الصيانة
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
