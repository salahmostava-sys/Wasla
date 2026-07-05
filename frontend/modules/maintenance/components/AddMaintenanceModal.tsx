import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Wrench } from 'lucide-react';
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

function newPartRow(): PartRow {
  return { id: crypto.randomUUID(), part_id: '', quantity_used: '1', cost_at_time: '' };
}

export function AddMaintenanceModal({ open, onOpenChange, vehicles, spareParts }: Props) {
  const { toast } = useToast();
  const invalidate = useInvalidateMaintenanceQueries();

  const [vehicleId, setVehicleId] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [maintType, setMaintType] = useState<string>(MAINT_TYPES[0]);
  const [totalCostOverride, setTotalCostOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<PartRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVehicleId('');
    setMaintenanceDate(format(new Date(), 'yyyy-MM-dd'));
    setMaintType(MAINT_TYPES[0]);
    setTotalCostOverride('');
    setNotes('');
    setRows([]);
  }, [open]);

  // Auto-fills cost_at_time from the selected spare part's unit_cost, if applicable.
  const applyPartFieldChange = (row: PartRow, field: keyof PartRow, value: string): PartRow => {
    const updated = { ...row, [field]: value };
    if (field !== 'part_id' || !value) return updated;
    const part = spareParts.find(p => p.id === value);
    if (part) updated.cost_at_time = String(part.unit_cost);
    return updated;
  };

  // Auto-fill cost_at_time from spare part unit_cost
  const handlePartChange = (rowId: string, field: keyof PartRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === rowId ? applyPartFieldChange(r, field, value) : r)));
  };

  const removePartRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Sum of parts cost
  const partsTotalCost = rows.reduce((sum, r) => {
    const qty = Number.parseFloat(r.quantity_used) || 0;
    const cost = Number.parseFloat(r.cost_at_time) || 0;
    return sum + qty * cost;
  }, 0);

  // If user didn't override total cost, use parts sum
  const finalTotalCost = totalCostOverride !== ''
    ? Number.parseFloat(totalCostOverride) || 0
    : partsTotalCost;

  const handleSave = async () => {
    if (saving) return; // prevent double-submit (fast double-click races past the `disabled` re-render)
    if (!vehicleId) { toast({ title: 'اختر المركبة', variant: 'destructive' }); return; }
    if (!maintenanceDate) { toast({ title: 'اختر التاريخ', variant: 'destructive' }); return; }

    const validParts = rows.filter(r => r.part_id && Number.parseFloat(r.quantity_used) > 0);
    const hasInvalidPart = validParts.some(r => Number.parseFloat(r.cost_at_time) <= 0);
    if (hasInvalidPart) {
      toast({ title: 'أدخل سعر الشراء لكل قطعة', variant: 'destructive' });
      return;
    }

    // Check for duplicate parts
    const partIds = validParts.map(r => r.part_id);
    const uniquePartIds = new Set(partIds);
    if (partIds.length !== uniquePartIds.size) {
      toast({ title: 'لا يمكن إضافة نفس القطعة أكثر من مرة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // If no parts and no override cost, we need a cost
      if (validParts.length === 0 && !totalCostOverride) {
        toast({ title: 'أدخل التكلفة أو أضف قطع غيار', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const parts = validParts.map(r => ({
        part_id: r.part_id,
        quantity_used: Number.parseFloat(r.quantity_used),
        cost_at_time: Number.parseFloat(r.cost_at_time),
      }));

      // If no parts but user entered total cost manually, we still create log without parts
      await maintenanceService.createMaintenanceLog(
        {
          vehicle_id: vehicleId,
          maintenance_date: maintenanceDate,
          type: maintType,
          notes: notes || null,
        },
        parts,
      );

      // If user manually entered a total cost different from parts sum, update it
      // (done by service using parts sum — if override needed we can handle separately)

      toast({ title: '✅ تم تسجيل الصيانة بنجاح' });
      invalidate();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench size={18} className="text-primary" />
            تسجيل عملية صيانة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vehicle + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المركبة <span className="text-destructive">*</span></Label>
              <select
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm"
              >
                <option value="">اختر المركبة...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}{v.brand ? ` — ${v.brand}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={maintenanceDate}
                onChange={e => setMaintenanceDate(e.target.value)}
              />
            </div>
          </div>

          {/* Type + Total Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نوع الصيانة <span className="text-destructive">*</span></Label>
              <select
                value={maintType}
                onChange={e => setMaintType(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm"
              >
                {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>
                التكلفة الكلية (ر.س)
                {rows.length > 0 && partsTotalCost > 0 && (
                  <span className="text-xs text-muted-foreground mr-1">
                    — محسوبة تلقائياً: {partsTotalCost.toLocaleString('en-US')}
                  </span>
                )}
              </Label>
              <Input
                type="number"
                min="0"
                placeholder={rows.length > 0 ? String(partsTotalCost) : 'أدخل التكلفة'}
                value={totalCostOverride}
                onChange={e => setTotalCostOverride(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea
              placeholder="مثال: تم استبدال فلتر الزيت وزيت المحرك، كيلومتراج 85,000"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Spare Parts Used */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>قطع الغيار المستخدمة (اختياري)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows(prev => [...prev, newPartRow()])}
                className="gap-1 text-xs"
              >
                <Plus size={14} /> إضافة قطعة
              </Button>
            </div>

            {rows.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-right p-2.5 font-medium">القطعة</th>
                      <th className="text-right p-2.5 font-medium w-24">الكمية</th>
                      <th className="text-right p-2.5 font-medium w-32">سعر الشراء/قطعة</th>
                      <th className="p-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map(row => (
                      <tr key={row.id}>
                        <td className="p-2">
                          <select
                            value={row.part_id}
                            onChange={e => handlePartChange(row.id, 'part_id', e.target.value)}
                            className="w-full bg-background border border-input rounded px-2 h-9 text-sm"
                          >
                            <option value="">اختر القطعة...</option>
                            {spareParts.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name_ar} (رصيد: {p.stock_quantity} {p.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={row.quantity_used}
                            onChange={e => handlePartChange(row.id, 'quantity_used', e.target.value)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={row.cost_at_time}
                            onChange={e => handlePartChange(row.id, 'cost_at_time', e.target.value)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removePartRow(row.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 0 && partsTotalCost > 0 && (
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={2} className="p-2.5 text-right text-sm font-semibold">
                          إجمالي قطع الغيار:
                        </td>
                        <td colSpan={2} className="p-2.5 text-sm font-bold text-primary">
                          {partsTotalCost.toLocaleString('en-US')} ر.س
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Summary */}
          {finalTotalCost > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">إجمالي تكلفة الصيانة:</span>
              <span className="text-lg font-bold text-primary">
                {finalTotalCost.toLocaleString('en-US')} ر.س
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : '✅ حفظ الصيانة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
