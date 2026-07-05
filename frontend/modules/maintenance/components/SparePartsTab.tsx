import { useMemo, useState } from 'react';
import { Pencil, Trash2, Search, Package, AlertTriangle, ShoppingCart } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
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
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useSpareParts, useInvalidateMaintenanceQueries } from '@modules/maintenance/hooks/useMaintenanceData';
import * as maintenanceService from '@services/maintenanceService';
import type { SparePart } from '@services/maintenanceService';

// ── Types ────────────────────────────────────────────────────────────────────

type PurchaseForm = {
  name_ar: string;
  part_number: string;
  quantity: string;       // كمية الشراء
  unit_cost: string;      // سعر الشراء وقت الشراء
  unit: string;
  supplier: string;
  notes: string;
};

const emptyPurchase = (): PurchaseForm => ({
  name_ar: '',
  part_number: '',
  quantity: '1',
  unit_cost: '',
  unit: 'قطعة',
  supplier: '',
  notes: '',
});

// ── Sub-components ────────────────────────────────────────────────────────────

function StockBadge({ qty, minAlert }: Readonly<{ qty: number; minAlert: number }>) {
  const isLow = qty < minAlert;
  const isEmpty = qty <= 0;
  if (isEmpty) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">نفد المخزون</span>;
  if (isLow)   return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">مخزون منخفض</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">متوفر</span>;
}

// ── Add/Edit Purchase Modal ───────────────────────────────────────────────────

function PurchaseModal({
  open,
  onOpenChange,
  editing,
  onSaved,
}: Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: SparePart | null;
  onSaved: () => void;
}>) {
  const { toast } = useToast();
  const [form, setForm] = useState<PurchaseForm>(emptyPurchase);
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name_ar: editing.name_ar,
        part_number: editing.part_number ?? '',
        quantity: String(editing.stock_quantity),
        unit_cost: String(editing.unit_cost),
        unit: editing.unit,
        supplier: editing.supplier ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(emptyPurchase());
    }
  }, [open, editing]);

  const set = (field: keyof PurchaseForm, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }));

  const handleSave = async () => {
    if (!form.name_ar.trim()) { toast({ title: 'أدخل اسم القطعة', variant: 'destructive' }); return; }
    const qty = Number.parseFloat(form.quantity);
    const cost = Number.parseFloat(form.unit_cost);
    if (Number.isNaN(qty) || qty < 0) { toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' }); return; }
    if (Number.isNaN(cost) || cost < 0) { toast({ title: 'أدخل سعر شراء صحيح', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const payload = {
        name_ar: form.name_ar.trim(),
        part_number: form.part_number.trim() || null,
        stock_quantity: qty,
        unit_cost: cost,
        unit: form.unit || 'قطعة',
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
        min_stock_alert: 5,
      };

      if (editing) {
        await maintenanceService.updateSparePart(editing.id, payload);
        toast({ title: '✅ تم تحديث القطعة' });
      } else {
        await maintenanceService.createSparePart(payload);
        toast({ title: '✅ تم إضافة القطعة للمخزون' });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editing;

  let saveButtonLabel: string;
  if (saving) {
    saveButtonLabel = 'جاري الحفظ...';
  } else if (isEdit) {
    saveButtonLabel = '💾 حفظ التعديلات';
  } else {
    saveButtonLabel = '✅ إضافة للمخزون';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-primary" />
            {isEdit ? 'تعديل قطعة الغيار' : 'تسجيل شراء قطعة غيار'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>اسم القطعة <span className="text-destructive">*</span></Label>
            <Input
              placeholder="مثال: فلتر زيت، إطار خلفي، بطارية 70 أمبير..."
              value={form.name_ar}
              onChange={e => set('name_ar', e.target.value)}
            />
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isEdit ? 'الكمية في المخزون' : 'الكمية المشتراة'} <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="مثال: 4"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>وحدة القياس</Label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm"
              >
                <option value="قطعة">قطعة</option>
                <option value="لتر">لتر</option>
                <option value="كيلو">كيلو</option>
                <option value="متر">متر</option>
                <option value="زوج">زوج</option>
                <option value="طقم">طقم</option>
              </select>
            </div>
          </div>

          {/* Price + Part Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                {isEdit ? 'سعر الوحدة (ر.س)' : 'سعر الشراء للوحدة (ر.س)'}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="مثال: 35.00"
                value={form.unit_cost}
                onChange={e => set('unit_cost', e.target.value)}
              />
              {!isEdit && form.quantity && form.unit_cost && (
                <p className="text-xs text-muted-foreground">
                  الإجمالي: {(Number.parseFloat(form.quantity || '0') * Number.parseFloat(form.unit_cost || '0')).toLocaleString('en-US')} ر.س
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>رقم القطعة (اختياري)</Label>
              <Input
                placeholder="مثال: OIL-4L-5W30"
                value={form.part_number}
                onChange={e => set('part_number', e.target.value)}
              />
            </div>
          </div>

          {/* Supplier */}
          <div className="space-y-1.5">
            <Label>المورد / مكان الشراء</Label>
            <Input
              placeholder="مثال: شركة الغانم، سوق قطع الغيار..."
              value={form.supplier}
              onChange={e => set('supplier', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Input
              placeholder="أي ملاحظات إضافية..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saveButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SparePartsTab() {
  const { permissions } = usePermissions('maintenance');
  const { toast } = useToast();
  const invalidate = useInvalidateMaintenanceQueries();
  const q = useSpareParts();
  const rows = useMemo(() => q.data ?? [], [q.data]);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SparePart | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SparePart | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(p =>
      [p.name_ar, p.part_number ?? '', p.supplier ?? ''].join(' ').toLowerCase().includes(t)
    );
  }, [rows, search]);

  const summary = useMemo(() => {
    const low = rows.filter(p => Number(p.stock_quantity) < Number(p.min_stock_alert ?? 5) && Number(p.stock_quantity) > 0).length;
    const empty = rows.filter(p => Number(p.stock_quantity) <= 0).length;
    const value = rows.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.unit_cost), 0);
    return { total: rows.length, low, empty, value };
  }, [rows]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: SparePart) => { setEditing(p); setModalOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await maintenanceService.deleteSparePart(deleteTarget.id);
      toast({ title: 'تم حذف القطعة من المخزون' });
      invalidate();
    } catch (err) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-foreground">{summary.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي الأصناف</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-primary">{summary.value.toLocaleString('en-US')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">قيمة المخزون (ر.س)</p>
        </div>
        <div className="bg-card border border-orange-200 dark:border-orange-900/50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-orange-600">{summary.low}</p>
          <p className="text-xs text-muted-foreground mt-0.5">مخزون منخفض</p>
        </div>
        <div className="bg-card border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-rose-600">{summary.empty}</p>
          <p className="text-xs text-muted-foreground mt-0.5">نفد المخزون</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 sm:w-64">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث باسم القطعة أو المورد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-8"
          />
        </div>
        {permissions.can_edit && (
          <Button onClick={openAdd} className="gap-1.5 shrink-0">
            <ShoppingCart size={16} /> تسجيل شراء قطعة
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{search ? 'لا توجد نتائج' : 'المخزون فارغ'}</p>
          {!search && permissions.can_edit && (
            <p className="text-sm mt-1">اضغط "تسجيل شراء قطعة" لإضافة أول قطعة</p>
          )}
        </div>
      ) : (
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-right">
                <th className="p-3 font-semibold text-muted-foreground">اسم القطعة</th>
                <th className="p-3 font-semibold text-muted-foreground text-center">الكمية</th>
                <th className="p-3 font-semibold text-muted-foreground text-center">سعر الوحدة</th>
                <th className="p-3 font-semibold text-muted-foreground text-center hidden sm:table-cell">المورد</th>
                <th className="p-3 font-semibold text-muted-foreground text-center">الحالة</th>
                {(permissions.can_edit || permissions.can_delete) && (
                  <th className="p-3 w-20" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(part => {
                const isLow = Number(part.stock_quantity) < Number(part.min_stock_alert ?? 5);
                return (
                  <tr key={part.id} className={`hover:bg-muted/20 transition-colors ${isLow ? 'bg-orange-50/30 dark:bg-orange-950/10' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle size={14} className="text-orange-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-foreground">{part.name_ar}</p>
                          {part.part_number && (
                            <p className="text-xs text-muted-foreground font-mono">{part.part_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-bold text-foreground">{Number(part.stock_quantity).toLocaleString('en-US')}</span>
                      <span className="text-xs text-muted-foreground mr-1">{part.unit}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-semibold text-foreground">{Number(part.unit_cost).toLocaleString('en-US')}</span>
                      <span className="text-xs text-muted-foreground mr-1">ر.س</span>
                    </td>
                    <td className="p-3 text-center hidden sm:table-cell text-muted-foreground text-xs">
                      {part.supplier ?? '—'}
                    </td>
                    <td className="p-3 text-center">
                      <StockBadge qty={Number(part.stock_quantity)} minAlert={Number(part.min_stock_alert ?? 5)} />
                    </td>
                    {(permissions.can_edit || permissions.can_delete) && (
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {permissions.can_edit && (
                            <button
                              onClick={() => openEdit(part)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted"
                              title="تعديل"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {permissions.can_delete && (
                            <button
                              onClick={() => setDeleteTarget(part)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded hover:bg-muted"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase Modal */}
      <PurchaseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        onSaved={invalidate}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف قطعة الغيار</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteTarget?.name_ar}" من المخزون؟
              إذا كانت مستخدمة في صيانات سابقة، لن يمكن حذفها.
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
