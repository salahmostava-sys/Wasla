import { useState, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Label } from '@shared/components/ui/label';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Switch } from '@shared/components/ui/switch';
import { useToast } from '@shared/hooks/use-toast';
import { salarySchemeService } from '@services/salarySchemeService';
import { appService } from '@services/appService';
import { getErrorMessage } from '@services/serviceError';
import { Scheme, Tier, SchemeType, AppItem } from '../../types/scheme.ui.types';
import { EXAMPLE_BAND_TIERS } from './SchemeSnapshotPinPanel';

interface SchemeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Scheme | null;
  initialTiers: Tier[];
  apps: AppItem[];
  onSuccess: () => void;
}

export function SchemeFormModal({
  open,
  onOpenChange,
  editing,
  initialTiers,
  apps,
  onSuccess,
}: Readonly<SchemeFormModalProps>) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [schemeType, setSchemeType] = useState<SchemeType>('order_based');
  const [monthlyAmount, setMonthlyAmount] = useState(2000);
  const [formTiers, setFormTiers] = useState<Tier[]>([{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]);
  const [hasTarget, setHasTarget] = useState(false);
  const [targetOrders, setTargetOrders] = useState(700);
  const [targetBonus, setTargetBonus] = useState(400);
  const [assignAppId, setAssignAppId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setSchemeType(editing.scheme_type || 'order_based');
        setMonthlyAmount(editing.monthly_amount || 2000);
        setFormTiers(
          initialTiers.length
            ? initialTiers.map((t) => ({ ...t }))
            : [{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]
        );
        setHasTarget(!!(editing.target_bonus && editing.target_orders));
        setTargetOrders(editing.target_orders || 700);
        setTargetBonus(editing.target_bonus || 400);
        setAssignAppId('');
      } else {
        setName('');
        setSchemeType('order_based');
        setMonthlyAmount(2000);
        setFormTiers([{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]);
        setHasTarget(false);
        setTargetOrders(700);
        setTargetBonus(400);
        setAssignAppId('');
      }
    }
  }, [open, editing, initialTiers]);

  const addTier = () => setFormTiers(prev => [
    ...prev,
    { from: (prev[prev.length - 1]?.to || 0) + 1, to: (prev[prev.length - 1]?.to || 0) + 500, pricePerOrder: 6, tierType: 'per_order_band' }
  ]);
  const removeTier = (i: number) => setFormTiers(prev => prev.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: keyof Tier, val: number | string) =>
    setFormTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const handleSave = async () => {
    if (!name) { toast({ title: 'خطأ', description: 'اسم السكيمة مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let schemeId = editing?.id;
      const schemePayload = {
        name,
        scheme_type: schemeType,
        monthly_amount: schemeType === 'fixed_monthly' ? monthlyAmount : null,
        target_orders: schemeType === 'order_based' && hasTarget ? targetOrders : null,
        target_bonus: schemeType === 'order_based' && hasTarget ? targetBonus : null,
      };

      if (editing) {
        await salarySchemeService.updateScheme(editing.id, schemePayload);
        await salarySchemeService.deleteSchemeTiers(editing.id);
      } else {
        const created = await salarySchemeService.createScheme(schemePayload);
        schemeId = created.id;
      }

      if (schemeId && schemeType === 'order_based') {
        await salarySchemeService.insertSchemeTiers(
          formTiers.map((t, i) => ({
            scheme_id: schemeId != null ? schemeId : '0', // NOSONAR
            from_orders: t.from,
            to_orders: t.to >= 9999 ? null : t.to,
            price_per_order: t.pricePerOrder,
            tier_order: i + 1,
            tier_type: t.tierType,
            incremental_threshold: t.tierType === 'base_plus_incremental' ? t.incrementalThreshold ?? t.from : null,
            incremental_price: t.tierType === 'base_plus_incremental' ? t.incrementalPrice ?? 0 : null,
          }))
        );
      }

      if (!editing && assignAppId && schemeId) {
        await appService.assignScheme(assignAppId, schemeId);
      }

      toast({ title: editing ? 'تم التعديل' : 'تمت الإضافة', description: editing ? 'تم تعديل السكيمة بنجاح' : 'تمت إضافة السكيمة بنجاح' });
      onSuccess();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'تعديل السكيمة' : 'إضافة سكيمة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>اسم السكيمة *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="سكيمة هنقر Q2 2025" />
          </div>

          <div className="space-y-2">
            <Label>نوع السكيمة</Label>
            <Select value={schemeType} onValueChange={v => setSchemeType(v as SchemeType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_based">📦 بالطلبات (Order-Based)</SelectItem>
                <SelectItem value="fixed_monthly">📅 راتب ثابت شهري (Fixed Monthly)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!editing && (
            <div className="space-y-2">
              <Label>ربط بمنصة (اختياري)</Label>
              <Select value={assignAppId || "none"} onValueChange={v => setAssignAppId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة (يمكنك الربط لاحقاً)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- بدون ربط --</SelectItem>
                  {apps.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {schemeType === 'fixed_monthly' && (
            <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30">
              <Label>الراتب الشهري الكامل (ر.س)</Label>
              <Input
                type="number"
                value={monthlyAmount}
                onChange={e => setMonthlyAmount(+e.target.value)}
                placeholder="2100"
              />
              <p className="text-xs text-muted-foreground">
                سيُحسب الراتب الفعلي: (الراتب ÷ 30) × أيام الحضور (present أو late)
              </p>
            </div>
          )}

          {schemeType === 'order_based' && (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>شرائح الأسعار</Label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => setFormTiers(EXAMPLE_BAND_TIERS.map((row) => ({ ...row })))}
                    >
                      مثال: 300×3 / 400×4 / 449×5 / ثابت 2500 / +زيادة
                    </Button>
                    <Button size="sm" variant="default" onClick={addTier} className="gap-1 h-7 text-xs">
                      <Plus size={12} /> إضافة شريحة
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  للنموذج الذي وصفته (كل النطاق يُضرب ككتلة واحدة) استخدم «شريحة واحدة» وليس «تراكمي». النطاق 401–449 ثم 450–470 ثابت ثم فوق 470 بسعر زيادي كما في الزر «مثال».
                </p>
                {formTiers.map((t, i) => (
                  <div key={`form-tier-${t.tierType}-${t.from}-${t.to}`} className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={t.tierType} onValueChange={v => updateTier(i, 'tierType', v)}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_order_band">شريحة واحدة (الطلبات كلها × السعر)</SelectItem>
                          <SelectItem value="total_multiplier">تراكمي (مجموع نطاقات)</SelectItem>
                          <SelectItem value="fixed_amount">مبلغ ثابت للنطاق</SelectItem>
                          <SelectItem value="base_plus_incremental">أساس + زيادي</SelectItem>
                        </SelectContent>
                      </Select>
                      {formTiers.length > 1 && (
                        <button aria-label="إزالة الشريحة" onClick={() => removeTier(i)} className="text-destructive hover:text-destructive/80 p-1"><X size={14} /></button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div><p className="text-xs text-muted-foreground mb-1">من (طلب)</p><Input type="number" value={t.from} onChange={e => updateTier(i, 'from', +e.target.value)} className="h-8 text-sm" /></div>
                      <div><p className="text-xs text-muted-foreground mb-1">إلى (طلب)</p><Input type="number" value={t.to} onChange={e => updateTier(i, 'to', +e.target.value)} className="h-8 text-sm" /></div>
                    </div>

                    {(t.tierType === 'per_order_band' || t.tierType === 'total_multiplier') && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">السعر لكل طلب (ر.س)</p>
                        <Input type="number" step="0.5" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                        {t.tierType === 'per_order_band' ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            يُحسب: <strong className="text-foreground">عدد الطلبات الكلي × هذا السعر</strong> إذا وقع العدد داخل «من–إلى».
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong className="text-foreground">تراكمي:</strong> يُحسب لكل نطاق على حدة ثم يُجمع.
                          </p>
                        )}
                      </div>
                    )}

                    {t.tierType === 'fixed_amount' && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">المبلغ الثابت (ر.س)</p>
                        <Input type="number" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                      </div>
                    )}

                    {t.tierType === 'base_plus_incremental' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">المبلغ الأساسي (ر.س)</p>
                          <Input type="number" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">حد البداية الزيادي</p>
                          <Input type="number" value={t.incrementalThreshold ?? t.from} onChange={e => updateTier(i, 'incrementalThreshold', +e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">سعر الطلب الزيادي (ر.س)</p>
                          <Input type="number" step="0.5" value={t.incrementalPrice ?? 0} onChange={e => updateTier(i, 'incrementalPrice', +e.target.value)} className="h-8 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3 border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label>مكافأة الهدف (Target Bonus)</Label>
                  <Switch checked={hasTarget} onCheckedChange={setHasTarget} />
                </div>
                {hasTarget && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">عدد الطلبات المستهدف</Label><Input type="number" value={targetOrders} onChange={e => setTargetOrders(+e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">قيمة المكافأة (ر.س)</Label><Input type="number" value={targetBonus} onChange={e => setTargetBonus(+e.target.value)} /></div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin me-1" />}
            {editing ? 'حفظ التعديلات' : 'إضافة السكيمة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
