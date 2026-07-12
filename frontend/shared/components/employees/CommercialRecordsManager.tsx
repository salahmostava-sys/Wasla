import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Edit, Plus, Save, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { useToast } from '@shared/hooks/use-toast';
import { useCommercialRecords } from '@shared/hooks/useCommercialRecords';
import {
  commercialRecordService,
  type CommercialRecordInput,
  type CommercialRecordItem,
} from '@services/commercialRecordService';
import { getErrorMessage } from '@services/serviceError';

type CommercialRecordsManagerProps = {
  open: boolean;
  onClose: () => void;
};

type CommercialRecordFormState = {
  name: string;
  registrationNumber: string;
  residencyRenewalMonthlyCost: string;
};

const emptyCommercialRecordForm: CommercialRecordFormState = {
  name: '',
  registrationNumber: '',
  residencyRenewalMonthlyCost: '',
};

const RESIDENCY_RENEWAL_MINIMUM_MONTHS = 3;

const moneyFormatter = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
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
});

const toCommercialRecordForm = (record: CommercialRecordItem): CommercialRecordFormState => ({
  name: record.name,
  registrationNumber: record.registration_number ?? '',
  residencyRenewalMonthlyCost: record.residency_renewal_monthly_cost?.toString() ?? '',
});

const formatOptionalMoney = (value: number | null) =>
  value === null ? 'غير محدد' : moneyFormatter.format(value);

const calculateMinimumRenewalTotal = (record: CommercialRecordItem) =>
  record.residency_renewal_monthly_cost === null
    ? null
    : record.residency_renewal_monthly_cost * RESIDENCY_RENEWAL_MINIMUM_MONTHS * record.usage_count;

const calculateMinimumRenewalCostPerEmployee = (record: CommercialRecordItem) =>
  record.residency_renewal_monthly_cost === null
    ? null
    : record.residency_renewal_monthly_cost * RESIDENCY_RENEWAL_MINIMUM_MONTHS;

function RecordMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            إدارة السجلات التجارية
          </DialogTitle>
          <DialogDescription className="sr-only">
            إضافة وتعديل وحذف السجلات التجارية
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!tableAvailable && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              إدارة الإضافة والتعديل والحذف تحتاج تطبيق migration السجلات التجارية على قاعدة البيانات.
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr_auto] lg:items-end">
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
                <FieldLabel>تكلفة الشهر للفرد</FieldLabel>
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
            <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              تكلفة الإقامة تُدخل شهرياً، والنظام يحسب أقل تجديد على 3 شهور مرة واحدة. تعديل اسم السجل من هنا يحدّث أيضًا السجل النصي المرتبط بالموظفين الحاليين بنفس الاسم.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <div className="rounded-2xl border border-border/70 bg-background">
              <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">السجلات المُدارة</h3>
                <p className="text-xs text-muted-foreground">بيانات السجل التي تدخل في الاختيار والحساب.</p>
              </div>

              <div className="max-h-[430px] space-y-3 overflow-y-auto p-4">
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    جاري تحميل السجلات التجارية...
                  </div>
                )}

                {!isLoading && managedRecords.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    لا توجد سجلات مُدارة بعد.
                  </div>
                )}

                {!isLoading && managedRecords.map((record) => {
                  const isEditing = editingId === record.id;
                  const rowBusy = busyAction === `update:${record.id}` || busyAction === `delete:${record.id}`;
                  const renewalTotal = calculateMinimumRenewalTotal(record);
                  const renewalCostPerEmployee = calculateMinimumRenewalCostPerEmployee(record);

                  return (
                    <div
                      key={record.id}
                      className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="grid gap-3 md:grid-cols-3">
                              <label>
                                <FieldLabel>اسم السجل</FieldLabel>
                                <Input
                                  value={editingForm.name}
                                  onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))}
                                  disabled={rowBusy}
                                  autoFocus
                                />
                              </label>
                              <label>
                                <FieldLabel>رقم السجل</FieldLabel>
                                <Input
                                  value={editingForm.registrationNumber}
                                  onChange={(event) => setEditingForm((current) => ({ ...current, registrationNumber: event.target.value }))}
                                  placeholder="رقم السجل"
                                  disabled={rowBusy}
                                  dir="ltr"
                                />
                              </label>
                              <label>
                                <FieldLabel>تكلفة الشهر للفرد</FieldLabel>
                                <Input
                                  value={editingForm.residencyRenewalMonthlyCost}
                                  onChange={(event) => setEditingForm((current) => ({ ...current, residencyRenewalMonthlyCost: event.target.value }))}
                                  placeholder="تكلفة الشهر"
                                  disabled={rowBusy}
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  type="number"
                                  dir="ltr"
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="truncate text-base font-bold text-foreground">{record.name}</span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  {record.usage_count} مندوب
                                </span>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <RecordMetric label="رقم السجل" value={record.registration_number || 'غير محدد'} />
                                <RecordMetric label="الشهر للفرد" value={formatOptionalMoney(record.residency_renewal_monthly_cost)} />
                                <RecordMetric label="3 شهور للفرد" value={formatOptionalMoney(renewalCostPerEmployee)} />
                                <RecordMetric label="3 شهور للجميع" value={formatOptionalMoney(renewalTotal)} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 lg:justify-end">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                onClick={handleSaveEdit}
                                disabled={rowBusy || !editingForm.name.trim()}
                              >
                                {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                حفظ
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingForm(emptyCommercialRecordForm);
                                }}
                                disabled={rowBusy}
                              >
                                إلغاء
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => {
                                  setEditingId(record.id);
                                  setEditingForm(toCommercialRecordForm(record));
                                }}
                                disabled={!canMutate}
                              >
                                <Edit size={13} />
                                تعديل
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                onClick={() => {
                                    if (record.id) {
                                        handleDelete(record.id, record.name).catch(() => {});
                                    }
                                }}
                                disabled={!canMutate}
                              >
                                {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} className="text-destructive" />}
                                حذف
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background">
              <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">قيم مستخدمة حاليًا</h3>
                <p className="text-xs text-muted-foreground">قيم موجودة على الموظفين حتى لو لم تُدار بعد من الجدول الجديد.</p>
              </div>

              <div className="max-h-[430px] space-y-3 overflow-y-auto p-4">
                {records.length === 0 && !isLoading && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    لا توجد قيَم مستخدمة حاليًا.
                  </div>
                )}

                {records.map((record) => {
                  const renewalTotal = calculateMinimumRenewalTotal(record);
                  const renewalCostPerEmployee = calculateMinimumRenewalCostPerEmployee(record);

                  return (
                    <div
                      key={`${record.source}-${record.id ?? record.name}`}
                      className="rounded-2xl border border-border/70 bg-card p-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">{record.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {record.source === 'managed' ? 'مُدار من القائمة' : 'موجود على الموظفين فقط'}
                            </p>
                          </div>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {record.usage_count}
                          </span>
                        </div>
                        {record.source === 'managed' && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <RecordMetric label="رقم السجل" value={record.registration_number || 'غير محدد'} />
                            <RecordMetric label="3 شهور للفرد" value={formatOptionalMoney(renewalCostPerEmployee)} />
                            <RecordMetric label="3 شهور للحاليين" value={formatOptionalMoney(renewalTotal)} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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


