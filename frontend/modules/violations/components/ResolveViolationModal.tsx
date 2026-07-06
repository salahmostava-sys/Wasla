import { BaseInput } from '@shared/components/ui/base-input';
import type React from 'react';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Textarea } from '@shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
type ResolveViolationModalProps = Readonly<{
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  editForm: {
    amount: string;
    incident_date: string;
    note: string;
    approval_status: string;
  };
  setEditForm: React.Dispatch<React.SetStateAction<{
    amount: string;
    incident_date: string;
    note: string;
    approval_status: string;
  }>>;
  editSaving: boolean;
  handleSaveEdit: () => void | Promise<void>;
  perms: { can_edit: boolean; can_delete: boolean };
}>;

export default function ResolveViolationModal({
  editDialogOpen,
  setEditDialogOpen,
  editForm,
  setEditForm,
  editSaving,
  handleSaveEdit,
  perms,
}: Readonly<ResolveViolationModalProps>) {
  return (
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل المخالفة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <BaseInput label="المبلغ (ر.س)" type="number"
              min={0}
              value={editForm.amount}
              onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
              className="h-10" />

          <BaseInput label="تاريخ المخالفة" type="date"
              value={editForm.incident_date}
              onChange={e => setEditForm(p => ({ ...p, incident_date: e.target.value }))}
              className="h-10" />

          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={editForm.approval_status} onValueChange={val => setEditForm(p => ({ ...p, approval_status: val }))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="approved">موافَق</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات / تفاصيل</Label>
            <Textarea
              value={editForm.note}
              onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
            إلغاء
          </Button>
          <Button onClick={handleSaveEdit} disabled={editSaving || !perms.can_edit}>
            {editSaving ? '...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
