import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { useToast } from '@shared/hooks/use-toast';
import { useCommercialRecords } from '@shared/hooks/useCommercialRecords';
import {
  commercialRecordService,
  type CommercialRecordInput,
  type CommercialRecordItem,
} from '@services/commercialRecordService';
import { getErrorMessage } from '@services/serviceError';
import { fmtNum } from '@shared/lib/utils';

type CommercialRecordsManagerProps = {
  open: boolean;
  onClose: () => void;
};

type CommercialRecordFormState = {
  name: string;
  registrationNumber: string;
  residencyRenewalMonthlyCost: string;
  residencyRenewalCostPeriod: 'monthly' | 'yearly';
};

const emptyCommercialRecordForm: CommercialRecordFormState = {
  name: '',
  registrationNumber: '',
  residencyRenewalMonthlyCost: '',
  residencyRenewalCostPeriod: 'monthly',
};

const RESIDENCY_RENEWAL_MINIMUM_MONTHS = 3;

const moneyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const parseOptionalMoney = (value: string) => {
  const normalizedValue = value.trim().replaceAll(',', '');
  return normalizedValue ? Number(normalizedValue) : null;
};

const toCommercialRecordInput = (form: CommercialRecordFormState): CommercialRecordInput => ({
  name: form.name,
  registration_number: form.registrationNumber,
  residency_renewal_monthly_cost: parseOptionalMoney(form.residencyRenewalMonthlyCost),
  residency_renewal_cost_period: form.residencyRenewalCostPeriod,
});

const toCommercialRecordForm = (record: CommercialRecordItem): CommercialRecordFormState => ({
  name: record.name,
  registrationNumber: record.registration_number ?? '',
  residencyRenewalMonthlyCost: record.residency_renewal_monthly_cost?.toString() ?? '',
  residencyRenewalCostPeriod: record.residency_renewal_cost_period,
});

const formatOptionalMoney = (value: number | null) =>
  value === null ? 'غير محدد' : `${moneyFormatter.format(value)} ر.س`;

const getRenewalCostPerEmployee = (record: CommercialRecordItem) => {
  if (record.residency_renewal_monthly_cost === null) return null;
  return record.residency_renewal_cost_period === 'yearly'
    ? record.residency_renewal_monthly_cost
    : record.residency_renewal_monthly_cost * RESIDENCY_RENEWAL_MINIMUM_MONTHS;
};

const calculateMinimumRenewalTotal = (record: CommercialRecordItem) => {
  const costPerEmployee = getRenewalCostPerEmployee(record);
  return costPerEmployee === null ? null : costPerEmployee * record.usage_count;
};

const calculateMinimumRenewalCostPerEmployee = (record: CommercialRecordItem) =>
  getRenewalCostPerEmployee(record);

const renewalPeriodLabel = (period: CommercialRecordItem['residency_renewal_cost_period']) =>
  period === 'yearly' ? 'سنوي' : 'شهري';

function FieldLabel({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{children}</span>;
}

export function CommercialRecordsManager({
  open,
  onClose,
}: Readonly<CommercialRecordsManagerProps>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { records, isLoading, tableAvailable, refetch } = useCommercialRecords();
  const [draftForm, setDraftForm] = useState<CommercialRecordFormState>(emptyCommercialRecordForm);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CommercialRecordFormState>(emptyCommercialRecordForm);

  const managedRecords = useMemo(
    () => records.filter((record) => record.source === 'managed'),
    [records],
  );
  const unmanagedRecords = useMemo(
    () => records.filter((record) => record.source !== 'managed'),
    [records],
  );

  const refreshRecords = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['commercial-records'] }),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    await refetch();
  };

  const handleCreate = async () => {
    if (!draftForm.name.trim()) return;
    setBusyAction('create');
    try {
      await commercialRecordService.createRecord(toCommercialRecordInput(draftForm));
      setDraftForm(emptyCommercialRecordForm);
      await refreshRecords();
      toast({ title: 'تمت إضافة السجل التجاري', description: draftForm.name.trim() });
    } catch (error) {
      toast({
        title: 'تعذر إضافة السجل التجاري',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const current = managedRecords.find((record) => record.id === editingId);
    if (!current) return;

    setBusyAction(`update:${editingId}`);
    try {
      await commercialRecordService.updateRecord(
        editingId,
        toCommercialRecordInput(editingForm),
        toCommercialRecordInput(toCommercialRecordForm(current)),
      );
      setEditingId(null);
      setEditingForm(emptyCommercialRecordForm);
      await refreshRecords();
      toast({ title: 'تم تحديث السجل التجاري', description: editingForm.name.trim() });
    } catch (error) {
      toast({
        title: 'تعذر تحديث السجل التجاري',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (recordId: string, recordName: string) => {
    setBusyAction(`delete:${recordId}`);
    try {
      await commercialRecordService.deleteRecord(recordId);
      await refreshRecords();
      toast({
        title: 'تم حذف السجل التجاري من القائمة',
        description: `بقي ربط الموظفين الحاليين على القيمة النصية: ${recordName}`,
      });
    } catch (error) {
      toast({
        title: 'تعذر حذف السجل التجاري',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const canMutate = tableAvailable && busyAction === null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            إدارة السجلات التجارية
          </DialogTitle>
          <DialogDescription className="sr-only">
            إضافة وتعديل وحذف السجلات التجارية
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-5rem)] space-y-4 overflow-y-auto pe-1">
          {!tableAvailable && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              إدارة الإضافة والتعديل والحذف تحتاج تطبيق migration السجلات التجارية على قاعدة البيانات.
            </div>
          )}

          <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr_0.8fr_auto] lg:items-end">
              <label>
                <FieldLabel>اسم السجل التجاري</FieldLabel>
                <Input
                  value={draftForm.name}
                  onChange={(event) => setDraftForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="مثال: سجل الزراعي"
                  disabled={!tableAvailable || busyAction === 'create'}
                />
              </label>
              <label>
                <FieldLabel>رقم السجل</FieldLabel>
                <Input
                  value={draftForm.registrationNumber}
                  onChange={(event) => setDraftForm((current) => ({ ...current, registrationNumber: event.target.value }))}
                  placeholder="7000000000"
                  disabled={!tableAvailable || busyAction === 'create'}
                  dir="ltr"
                />
              </label>
              <label>
                <FieldLabel>تكلفة التجديد للفرد</FieldLabel>
                <Input
                  value={draftForm.residencyRenewalMonthlyCost}
                  onChange={(event) => setDraftForm((current) => ({ ...current, residencyRenewalMonthlyCost: event.target.value }))}
                  placeholder="مثال: 800"
                  disabled={!tableAvailable || busyAction === 'create'}
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  dir="ltr"
                />
              </label>
              <label>
                <FieldLabel>دورية التكلفة</FieldLabel>
                <Select
                  value={draftForm.residencyRenewalCostPeriod}
                  onValueChange={(value) =>
                    setDraftForm((current) => ({
                      ...current,
                      residencyRenewalCostPeriod: value === 'yearly' ? 'yearly' : 'monthly',
                    }))
                  }
                  disabled={!tableAvailable || busyAction === 'create'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="yearly">سنوي</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <Button
                type="button"
                className="h-10 gap-2"
                onClick={handleCreate}
                disabled={!tableAvailable || !draftForm.name.trim() || busyAction === 'create'}
              >
                {busyAction === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                إضافة سجل
              </Button>
            </div>
            <p className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
              للشركات يمكن إدخال التكلفة الشهرية ليحسب النظام أقل تجديد على 3 شهور. للمؤسسات الفردية استخدم الدورية السنوية حتى تظهر تكلفة التنبيه كتكلفة سنة واحدة.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">السجلات المُدارة</h3>
                <p className="text-xs text-muted-foreground">التكلفة الفعلية في التنبيهات تُحسب حسب مدة انتهاء إقامة كل موظف.</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{fmtNum(managedRecords.length)} سجل</span>
                <span>{fmtNum(managedRecords.reduce((sum, record) => sum + record.usage_count, 0))} موظف</span>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                جاري تحميل السجلات التجارية...
              </div>
            )}
            {!isLoading && managedRecords.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">لا توجد سجلات مُدارة بعد.</div>
            )}
            {!isLoading && managedRecords.length > 0 && (
              <div className="max-h-[430px] overflow-auto">
                <table className="data-table w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground">
                    <tr className="border-b border-border/60">
                      <th className="px-3 py-2 text-start">اسم السجل</th>
                      <th className="px-3 py-2 text-center">رقم السجل</th>
                      <th className="px-3 py-2 text-center">تكلفة الفرد</th>
                      <th className="px-3 py-2 text-center">الدورية</th>
                      <th className="px-3 py-2 text-center">الحد الأدنى للفرد</th>
                      <th className="px-3 py-2 text-center">الموظفون</th>
                      <th className="px-3 py-2 text-center">الحد الأدنى للجميع</th>
                      <th className="px-3 py-2 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {managedRecords.map((record) => {
                      const isEditing = editingId === record.id;
                      const rowBusy = busyAction === `update:${record.id}` || busyAction === `delete:${record.id}`;
                      const renewalTotal = calculateMinimumRenewalTotal(record);
                      const renewalCostPerEmployee = calculateMinimumRenewalCostPerEmployee(record);
                      return (
                        <tr key={`${record.id ?? 'legacy'}-${record.name}`} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-semibold text-foreground">
                            {isEditing ? (
                              <Input value={editingForm.name} onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))} disabled={rowBusy} autoFocus className="h-9" />
                            ) : record.name}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <Input value={editingForm.registrationNumber} onChange={(event) => setEditingForm((current) => ({ ...current, registrationNumber: event.target.value }))} disabled={rowBusy} dir="ltr" className="h-9 text-center" />
                            ) : (record.registration_number || 'غير محدد')}
                          </td>
                          <td className="px-3 py-2 text-center font-medium">
                            {isEditing ? (
                              <Input value={editingForm.residencyRenewalMonthlyCost} onChange={(event) => setEditingForm((current) => ({ ...current, residencyRenewalMonthlyCost: event.target.value }))} disabled={rowBusy} inputMode="decimal" min="0" step="0.01" type="number" dir="ltr" className="h-9 text-center" />
                            ) : formatOptionalMoney(record.residency_renewal_monthly_cost)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <Select value={editingForm.residencyRenewalCostPeriod} onValueChange={(value) => setEditingForm((current) => ({ ...current, residencyRenewalCostPeriod: value === 'yearly' ? 'yearly' : 'monthly' }))} disabled={rowBusy}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="monthly">شهري</SelectItem><SelectItem value="yearly">سنوي</SelectItem></SelectContent>
                              </Select>
                            ) : renewalPeriodLabel(record.residency_renewal_cost_period)}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">{formatOptionalMoney(renewalCostPerEmployee)}</td>
                          <td className="px-3 py-2 text-center">{fmtNum(record.usage_count)}</td>
                          <td className="px-3 py-2 text-center font-semibold">{formatOptionalMoney(renewalTotal)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button type="button" size="icon" className="h-8 w-8" onClick={handleSaveEdit} disabled={rowBusy || !editingForm.name.trim()} title="حفظ" aria-label="حفظ تعديلات السجل">
                                    {rowBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  </Button>
                                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => { setEditingId(null); setEditingForm(emptyCommercialRecordForm); }} disabled={rowBusy} title="إلغاء" aria-label="إلغاء تعديل السجل">
                                    <X size={14} />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      if (!record.id) return;
                                      setEditingId(record.id);
                                      setEditingForm(toCommercialRecordForm(record));
                                    }}
                                    disabled={!canMutate || !record.id}
                                    title="تعديل"
                                    aria-label={`تعديل ${record.name}`}
                                  >
                                    <Edit size={14} />
                                  </Button>
                                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (record.id) handleDelete(record.id, record.name).catch(() => {}); }} disabled={!canMutate || !record.id} title="حذف" aria-label={`حذف ${record.name}`}>
                                    {rowBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} className="text-destructive" />}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {unmanagedRecords.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">قيم موجودة على الموظفين وغير مُدارة</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">أضف هذه القيم كسجلات مُدارة حتى تدخل تكلفة التجديد في التنبيهات.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unmanagedRecords.map((record) => (
                  <span key={record.name} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                    {record.name}
                    <span className="text-muted-foreground">{fmtNum(record.usage_count)} موظف</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="gap-2">
              <X size={14} />
              إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


