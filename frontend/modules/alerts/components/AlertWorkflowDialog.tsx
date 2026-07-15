import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, UserRoundCog } from 'lucide-react';
import type { AssignableAlertUser } from '@services/alertsService';
import type { Alert } from '@shared/lib/alertsBuilder';
import { Button } from '@shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import { Textarea } from '@shared/components/ui/textarea';

export type AlertWorkflowForm = {
  status: 'open' | 'in_progress';
  assignedTo: string | null;
  estimatedCost: number | null;
  note: string | null;
};

type AlertWorkflowDialogProps = Readonly<{
  alert: Alert | null;
  users: AssignableAlertUser[];
  saving: boolean;
  onClose: () => void;
  onSave: (alert: Alert, form: AlertWorkflowForm) => void | Promise<void>;
}>;

const UNASSIGNED_VALUE = 'unassigned';

function initialStatus(alert: Alert | null): AlertWorkflowForm['status'] {
  return alert?.workflowStatus === 'in_progress' ? 'in_progress' : 'open';
}

export function AlertWorkflowDialog({
  alert,
  users,
  saving,
  onClose,
  onSave,
}: AlertWorkflowDialogProps) {
  const [status, setStatus] = useState<AlertWorkflowForm['status']>('open');
  const [assignedTo, setAssignedTo] = useState(UNASSIGNED_VALUE);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setStatus(initialStatus(alert));
    setAssignedTo(alert?.assignedTo ?? UNASSIGNED_VALUE);
    setEstimatedCost(String(alert?.estimatedCost ?? alert?.residencyRenewalCost ?? ''));
    setNote(alert?.resolutionNote ?? '');
  }, [alert]);

  const parsedCost = useMemo(() => {
    if (!estimatedCost.trim()) return null;
    const value = Number(estimatedCost);
    return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
  }, [estimatedCost]);
  const costIsInvalid = parsedCost !== null && Number.isNaN(parsedCost);

  const handleSave = () => {
    if (!alert || costIsInvalid) return;
    void onSave(alert, {
      status,
      assignedTo: assignedTo === UNASSIGNED_VALUE ? null : assignedTo,
      estimatedCost: parsedCost,
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={Boolean(alert)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-lg bg-background shadow-xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog size={18} /> إدارة التنبيه
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-b border-border/60 pb-3">
            <p className="text-sm font-semibold text-foreground">{alert?.entityName}</p>
            <p className="mt-1 text-xs text-muted-foreground">الاستحقاق: {alert?.dueDate}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="alert-workflow-status">حالة الإجراء</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as AlertWorkflowForm['status'])}>
                <SelectTrigger id="alert-workflow-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">مفتوح</SelectItem>
                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-assignee">المسؤول</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="alert-assignee">
                  <SelectValue placeholder="اختر المسؤول" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_VALUE}>غير مسند</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email || 'مستخدم'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-estimated-cost">التكلفة المتوقعة (ر.س)</Label>
            <Input
              id="alert-estimated-cost"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={estimatedCost}
              onChange={(event) => setEstimatedCost(event.target.value)}
              aria-invalid={costIsInvalid}
              placeholder="0.00"
            />
            {costIsInvalid && <p className="text-xs text-destructive">أدخل تكلفة صحيحة لا تقل عن صفر.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-workflow-note">ملاحظة المتابعة</Label>
            <Textarea
              id="alert-workflow-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="أضف ما تم أو الخطوة التالية..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button type="button" onClick={handleSave} disabled={saving || costIsInvalid}>
            {saving ? <Loader2 size={15} className="ml-1 animate-spin" /> : <Save size={15} className="ml-1" />}
            حفظ المتابعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
