import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { useToast } from '@shared/hooks/use-toast';
import { useCommercialRecords } from '@shared/hooks/useCommercialRecords';
import { commercialRecordService } from '@services/commercialRecordService';
import { getErrorMessage } from '@services/serviceError';

type CommercialRecordsManagerProps = {
  open: boolean;
  onClose: () => void;
};

export function CommercialRecordsManager({
  open,
  onClose,
}: Readonly<CommercialRecordsManagerProps>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { records, isLoading, tableAvailable, refetch } = useCommercialRecords();
  const [draftName, setDraftName] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

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
    if (!draftName.trim()) return;
    setBusyAction('create');
    try {
      await commercialRecordService.createRecord(draftName);
      setDraftName('');
      await refreshRecords();
      toast({ title: 'تمت إضافة السجل التجاري', description: draftName.trim() });
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
      await commercialRecordService.updateRecord(editingId, editingValue, current.name);
      setEditingId(null);
      setEditingValue('');
      await refreshRecords();
      toast({ title: 'تم تحديث السجل التجاري', description: editingValue.trim() });
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
      <DialogContent dir="rtl" className="max-w-3xl">
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

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="اسم السجل التجاري"
                disabled={!tableAvailable || busyAction === 'create'}
              />
              <Button
                type="button"
                className="gap-2"
                onClick={handleCreate}
                disabled={!tableAvailable || !draftName.trim() || busyAction === 'create'}
              >
                {busyAction === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                إضافة سجل
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              تعديل اسم السجل من هنا يحدّث أيضًا السجل النصي المرتبط بالموظفين الحاليين بنفس الاسم.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-border/60">
              <div className="border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">السجلات المُدارة</h3>
                <p className="text-xs text-muted-foreground">القائمة المستخدمة في نموذج إضافة وتعديل المندوب.</p>
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto p-4">
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

                  return (
                    <div
                      key={record.id}
                      className="border border-border/60 bg-card px-4 py-3 rounded-2xl"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <Input
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              disabled={rowBusy}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-foreground">{record.name}</span>
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                {record.usage_count} مندوب
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                onClick={handleSaveEdit}
                                disabled={rowBusy || !editingValue.trim()}
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
                                  setEditingValue('');
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
                                  setEditingValue(record.name);
                                }}
                                disabled={!canMutate}
                              >
                                <Pencil size={13} />
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
                                {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                حذف
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60">
              <div className="border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">قيم مستخدمة حاليًا</h3>
                <p className="text-xs text-muted-foreground">قيم موجودة على الموظفين حتى لو لم تُدار بعد من الجدول الجديد.</p>
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto p-4">
                {records.length === 0 && !isLoading && (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    لا توجد قيَم مستخدمة حاليًا.
                  </div>
                )}

                {records.map((record) => (
                  <div
                    key={`${record.source}-${record.id ?? record.name}`}
                    className="border border-border/60 bg-card px-4 py-3 rounded-2xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{record.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.source === 'managed' ? 'مُدار من القائمة' : 'موجود على الموظفين فقط'}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {record.usage_count}
                      </span>
                    </div>
                  </div>
                ))}
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


