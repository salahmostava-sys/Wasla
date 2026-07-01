import { useState, useRef } from 'react';
import { Plus, Edit2, FileText, Printer, AlertTriangle, Check, X, RotateCcw, UserPlus, Search, Trash2, Paperclip, ExternalLink } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@shared/components/ui/command';
import { advanceService } from '@services/advanceService';
import type { AdvancePayload } from '@services/advanceService';
import { storageService } from '@services/storageService';
import { useToast } from '@shared/hooks/use-toast';
import { format } from 'date-fns';
import { logError } from '@shared/lib/logger';
import type {
  AdvanceStatus,
  Installment,
  InlineRowProps,
  WriteOffDialogProps,
  RestoreWriteOffDialogProps,
  EditAdvanceModalProps,
  PrintSlipProps,
  TransactionsModalProps,
  EmployeeSummary,
} from '@modules/advances/types/advance.types';
import { getErrorMessage } from '@services/serviceError';
import { buildInstallmentsPayload } from '@modules/advances/types/advance.types';

export const InlineRowEntry = ({ employeeId, onSaved, onCancel }: Readonly<InlineRowProps>) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '', disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    first_deduction_month: format(new Date(), 'yyyy-MM'), note: '',
  });
  const [file, setFile] = useState<File | null>(null);

  /** قسط واحد بكامل المبلغ (بدون حقل قسط شهري منفصل) */
  const projectedInstallments = 1;

  const saveAdvance = async () => {
    if (!form.amount || !form.disbursement_date || !form.first_deduction_month)
      return toast({ title: 'أكمل الحقول المطلوبة', variant: 'destructive' });
    const amt = Number.parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0)
      return toast({ title: 'أدخل مبلغاً صحيحاً', variant: 'destructive' });
    setSaving(true);
    try {
      let attachment_url = null;
      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `${employeeId}-${Date.now()}.${ext}`;
        attachment_url = await storageService.uploadFile('advance-attachments', fileName, file);
      }

      const payload: AdvancePayload = {
        employee_id: employeeId, amount: amt,
        monthly_amount: amt, total_installments: projectedInstallments,
        disbursement_date: form.disbursement_date, first_deduction_month: form.first_deduction_month,
        note: form.note || null, status: 'active',
        attachment_url,
      };
      const adv = await advanceService.create(payload);
      if (!adv) return toast({ title: 'حدث خطأ', description: 'لم يُرجع الخادم بيانات السلفة', variant: 'destructive' });
      const installments = buildInstallmentsPayload(
        adv.id,
        form.first_deduction_month,
        Number.parseFloat(form.amount),
        projectedInstallments
      );
      if (installments.length > 0) await advanceService.createInstallments(installments);
      toast({ title: '✅ تم إضافة السلفة' });
      onSaved();
    } catch (e) {
      logError('[Advances] load employees failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border/50 bg-primary/5 rounded-lg animate-in fade-in duration-150 px-3 py-3">
      <p className="text-xs font-medium text-foreground mb-3">إضافة سلفة</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div>
          <label htmlFor="quick-advance-amount" className="text-[11px] text-muted-foreground mb-1 block">المبلغ (ر.س) *</label>
          <Input id="quick-advance-amount" type="number" className="h-7 text-xs" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
        </div>
        <div>
          <label htmlFor="quick-advance-date" className="text-[11px] text-muted-foreground mb-1 block">تاريخ الصرف *</label>
          <Input id="quick-advance-date" type="date" className="h-7 text-xs" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="quick-advance-month" className="text-[11px] text-muted-foreground mb-1 block">أول شهر خصم *</label>
          <Input id="quick-advance-month" type="month" className="h-7 text-xs" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="quick-advance-note" className="text-[11px] text-muted-foreground mb-1 block">ملاحظات</label>
          <Input id="quick-advance-note" className="h-7 text-xs" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="سبب السلفة..." />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="quick-advance-file" className="text-[11px] text-muted-foreground mb-1 block">المرفق (اختياري)</label>
          <Input id="quick-advance-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="h-7 text-xs file:h-full file:bg-transparent file:text-foreground file:text-xs file:font-medium file:border-0" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <Button size="sm" className="h-7 text-xs gap-1" onClick={saveAdvance} disabled={saving}>
          <Check size={12} /> {saving ? '...' : 'حفظ'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCancel}>
          <X size={12} /> إلغاء
        </Button>
      </div>
    </div>
  );
};

export const WriteOffDialog = ({ employeeName, remaining, advanceIds, onClose, onDone }: Readonly<WriteOffDialogProps>) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleWriteOff = async () => {
    setSaving(true);
    try {
      await advanceService.writeOffMany(advanceIds, reason || 'ديون معدومة');
      toast({ title: `✅ تم إعدام ديون ${employeeName}` });
      onDone(); onClose();
    } catch (e) {
      logError('[Advances] create failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={18} /> إعدام الديون
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground">{employeeName}</p>
            <p className="text-muted-foreground mt-1">المبلغ الذي سيتم إعدامه: <span className="font-bold text-destructive">{remaining.toLocaleString('en-US')} ر.س</span></p>
            <p className="text-xs text-muted-foreground mt-2">⚠️ يمكن التراجع عن هذا الإجراء لاحقاً من خلال زر الاسترداد.</p>
          </div>
          <div>
            <label htmlFor="writeoff-reason" className="text-sm font-medium mb-1 block">سبب الإعدام</label>
            <Input id="writeoff-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: المندوب هرب / ترك العمل..." />
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button variant="destructive" onClick={handleWriteOff} disabled={saving}>{saving ? '...' : 'إعدام الديون'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const RestoreWriteOffDialog = ({ employeeName, advanceIds, onClose, onDone }: Readonly<RestoreWriteOffDialogProps>) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleRestore = async () => {
    setSaving(true);
    try {
      await advanceService.restoreWrittenOffMany(advanceIds);
      toast({ title: `✅ تم استرداد ديون ${employeeName}` });
      onDone(); onClose();
    } catch (e) {
      logError('[Advances] update failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <RotateCcw size={18} /> استرداد الديون المعدومة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
            <p className="font-semibold text-foreground">{employeeName}</p>
            <p className="text-muted-foreground mt-1">سيتم إعادة تفعيل السلف المعدومة وإعادتها للحالة النشطة.</p>
          </div>
        </div>
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleRestore} disabled={saving} className="bg-warning hover:bg-warning/90 text-warning-foreground">
            {saving ? '...' : 'استرداد الديون'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EditAdvanceModal = ({ advance, onClose, onSaved }: Readonly<EditAdvanceModalProps>) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: advance.amount.toString(),
    disbursement_date: advance.disbursement_date,
    first_deduction_month: advance.first_deduction_month,
    status: advance.status,
    note: advance.note ?? '',
  });

  const [file, setFile] = useState<File | null>(null);

  const remaining = Number.parseFloat(form.amount) || 0;
  const monthly = advance.monthly_amount > 0 ? advance.monthly_amount : 1;
  const projectedInstallments = monthly > 0 ? Math.ceil(remaining / monthly) : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      let attachment_url = advance.attachment_url;
      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `${advance.employee_id}-${Date.now()}.${ext}`;
        attachment_url = await storageService.uploadFile('advance-attachments', fileName, file);
      }

      const payload: Partial<AdvancePayload> = {
        amount: Number.parseFloat(form.amount),
        disbursement_date: form.disbursement_date,
        monthly_amount: monthly,
        total_installments: projectedInstallments,
        first_deduction_month: form.first_deduction_month,
        status: form.status,
        note: form.note || null,
        attachment_url,
      };
      await advanceService.update(advance.id, payload);
      await advanceService.deletePendingInstallments(advance.id);
      const paidInstallments = (advance.advance_installments || []).filter(i => i.status === 'deducted');
      const paidCount = paidInstallments.length;
      const paidAmount = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
      const remaining_count = Math.max(projectedInstallments - paidCount, 0);
      const remainingAmount = Math.max((Number.parseFloat(form.amount) || 0) - paidAmount, 0);
      const installments = buildInstallmentsPayload(
        advance.id,
        form.first_deduction_month,
        remainingAmount,
        remaining_count
      );
      if (installments.length > 0) await advanceService.createInstallments(installments);
      toast({ title: 'تم تحديث السلفة ✅' });
      onSaved(); onClose();
    } catch (e) {
      logError('[Advances] save installments failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>✏️ تعديل السلفة — {advance.employees?.name}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label htmlFor="edit-advance-amount" className="text-sm font-medium mb-1 block">المبلغ الإجمالي (ر.س)</label>
            <Input id="edit-advance-amount" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="edit-advance-date" className="text-sm font-medium mb-1 block">تاريخ الصرف</label>
            <Input id="edit-advance-date" type="date" value={form.disbursement_date} onChange={e => setForm(p => ({ ...p, disbursement_date: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="edit-advance-first-month" className="text-sm font-medium mb-1 block">أول شهر خصم</label>
            <Input id="edit-advance-first-month" type="month" value={form.first_deduction_month} onChange={e => setForm(p => ({ ...p, first_deduction_month: e.target.value }))} dir="ltr" />
          </div>
          <div>
            <label htmlFor="edit-advance-status" className="text-sm font-medium mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AdvanceStatus }))}>
              <SelectTrigger id="edit-advance-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">نشطة</SelectItem>
                <SelectItem value="completed">مكتملة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label htmlFor="edit-advance-note" className="text-sm font-medium mb-1 block">ملاحظات</label>
            <textarea id="edit-advance-note" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="col-span-2">
            <label htmlFor="edit-advance-file" className="text-sm font-medium mb-1 block">المرفق الحالي / تعديل المرفق</label>
            <div className="flex items-center gap-2">
              <Input id="edit-advance-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="h-9 text-xs flex-1 file:h-full file:bg-transparent file:text-foreground file:text-xs file:font-medium file:border-0" onChange={e => setFile(e.target.files?.[0] || null)} />
              {advance.attachment_url && !file && (
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={async () => {
                  try {
                    const url = await storageService.createSignedUrl('advance-attachments', advance.attachment_url!);
                    window.open(url, '_blank');
                  } catch {
                    toast({ title: 'فشل فتح المرفق', variant: 'destructive' });
                  }
                }}>
                  <ExternalLink size={14} /> عرض
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const installmentStatusLabel = (status: Installment['status']): string => {
  if (status === 'deducted') return 'مخصوم';
  if (status === 'pending') return 'معلّق';
  return 'مؤجل';
};

export const PrintSlip = ({ employeeName, nationalId, totalDebt, totalPaid, remaining, advances, onClose }: Readonly<PrintSlipProps>) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const contentEl = printRef.current;
    if (!contentEl) return;
    const win = globalThis.open('', '_blank');
    if (!win) return;
    const doc = win.document;
    doc.open();
    doc.close();
    doc.documentElement.lang = 'ar';
    doc.documentElement.dir = 'rtl';
    doc.title = `سلف - ${employeeName}`;

    const style = doc.createElement('style');
    style.textContent = `
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; direction: rtl; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #f3f4f6; padding: 8px; font-size: 12px; border: 1px solid #d1d5db; }
      td { padding: 7px 8px; font-size: 12px; border: 1px solid #e5e7eb; }
      .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
      .stat { display: inline-block; margin-left: 20px; font-size: 13px; }
      .stat-val { font-weight: bold; font-size: 16px; }
      .red { color: #dc2626; } .green { color: #16a34a; } .blue { color: #2563eb; }
      @media print { button { display: none; } }
    `;
    doc.head.appendChild(style);
    doc.body.appendChild(contentEl.cloneNode(true));
    win.print();
  };

  const allInstallments = advances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({ ...i, advanceDate: adv.disbursement_date, advanceTotal: adv.amount }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer size={18} /> طباعة كشف السلف</DialogTitle>
        </DialogHeader>
        <div ref={printRef}>
          <div className="header">
            <h2 style={{ margin: 0, fontSize: 18 }}>كشف سلف المندوب</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>تاريخ الطباعة: {format(new Date(), 'yyyy-MM-dd')}</p>
          </div>
          <div className="mb-3">
            <p><strong>الاسم:</strong> {employeeName}</p>
            <p><strong>رقم الإقامة:</strong> {nationalId}</p>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
            <div className="stat"><div className="stat-val blue">{totalDebt.toLocaleString('en-US')} ر.س</div><div>إجمالي المديونية</div></div>
            <div className="stat"><div className="stat-val green">{totalPaid.toLocaleString('en-US')} ر.س</div><div>إجمالي المسدّد</div></div>
            <div className="stat"><div className={`stat-val ${remaining > 0 ? 'red' : 'green'}`}>{remaining.toLocaleString('en-US')} ر.س</div><div>المتبقي</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>الشهر</th><th>تاريخ السلفة</th><th>مبلغ السلفة</th><th>المسدّد</th><th>الحالة</th><th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {allInstallments.map((inst, idx) => (
                <tr key={inst.id}>
                  <td>{idx + 1}</td>
                  <td dir="ltr">{inst.month_year}</td>
                  <td>{inst.advanceDate}</td>
                  <td>{inst.advanceTotal.toLocaleString('en-US')} ر.س</td>
                  <td>{inst.status === 'deducted' ? `${inst.amount.toLocaleString('en-US')} ر.س` : '—'}</td>
                  <td>{installmentStatusLabel(inst.status)}</td>
                  <td>{inst.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          <Button onClick={handlePrint} className="gap-2"><Printer size={14} /> طباعة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TransactionsModal = ({ employeeId, employeeName, nationalId, totalDebt, totalPaid, remaining, advances, isWrittenOff, canEdit, onClose, onRefresh, onWriteOff, onRestore, onEditAdvance }: Readonly<TransactionsModalProps>) => {
  const { toast } = useToast();
  const empAdvances = advances.filter(a => a.employee_id === employeeId);
  const allInstallments = empAdvances.flatMap(adv =>
    (adv.advance_installments || []).map(i => ({ ...i, advanceDate: adv.disbursement_date, advanceTotal: adv.amount, attachmentUrl: adv.attachment_url }))
  ).sort((a, b) => a.month_year.localeCompare(b.month_year));

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [deleteAdvanceId, setDeleteAdvanceId] = useState<string | null>(null);
  const [deletingAdvance, setDeletingAdvance] = useState(false);
  const [deleteInstallmentId, setDeleteInstallmentId] = useState<string | null>(null);
  const [deletingInstallment, setDeletingInstallment] = useState(false);

  const handleDeleteAdvance = async () => {
    if (!deleteAdvanceId) return;
    setDeletingAdvance(true);
    try {
      await advanceService.delete(deleteAdvanceId);
      toast({ title: '✅ تم حذف السلفة نهائياً' });
      setDeleteAdvanceId(null);
      onRefresh();
    } catch (e) {
      logError('[Advances] delete advance failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    } finally {
      setDeletingAdvance(false);
    }
  };

  const handleDeleteInstallment = async () => {
    if (!deleteInstallmentId) return;
    setDeletingInstallment(true);
    try {
      await advanceService.deleteInstallment(deleteInstallmentId);
      toast({ title: '✅ تم حذف الصف' });
      setDeleteInstallmentId(null);
      onRefresh();
    } catch (e) {
      logError('[Advances] delete installment failed', e);
      const message = getErrorMessage(e, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    } finally {
      setDeletingInstallment(false);
    }
  };

  const startEditNote = (inst: Installment) => { setEditingNoteId(inst.id); setNoteValue(inst.notes ?? ''); };
  const saveNote = async (instId: string) => {
    setSavingNote(true);
    try {
      await advanceService.updateInstallmentNote(instId, noteValue || null);
      setEditingNoteId(null);
      onRefresh();
      toast({ title: '✅ تم حفظ الملاحظة' });
    } catch {
      logError('[Advances] save note failed', new Error('Save note failed'));
      toast({ title: 'خطأ', variant: 'destructive' });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <FileText size={18} />
                سجل العمليات — {employeeName}
              </DialogTitle>
              {/* Action buttons inside modal header */}
              {canEdit && !isWrittenOff && (
                <div className="flex items-center gap-2 me-8">
                  <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={() => setShowInlineAdd(true)}>
                    <Plus size={12} /> إضافة
                  </Button>
                  {empAdvances.length > 0 && onEditAdvance && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        // Open the most recent active advance, not always the first one
                        const activeAdv = empAdvances.find(a => a.status === 'active') || empAdvances.at(-1);
                        if (!activeAdv) return;
                        onEditAdvance(activeAdv);
                      }}
                    >
                      <Edit2 size={12} /> تعديل
                    </Button>
                  )}
                  {empAdvances.length > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        const activeAdv = empAdvances.find(a => a.status === 'active') || empAdvances.at(-1);
                        if (!activeAdv) return;
                        setDeleteAdvanceId(activeAdv.id);
                      }}
                    >
                      <Trash2 size={12} /> حذف السلفة
                    </Button>
                  )}
                  {remaining > 0 && onWriteOff && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" onClick={onWriteOff}>
                      <AlertTriangle size={12} /> إعدام
                    </Button>
                  )}
                </div>
              )}
              {canEdit && isWrittenOff && onRestore && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 me-8 text-warning border-warning/40 hover:bg-warning/10" onClick={onRestore}>
                  <RotateCcw size={12} /> استرداد الديون
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Inline add form */}
          {showInlineAdd && (
            <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
              <InlineRowEntry
                employeeId={employeeId}
                onSaved={() => { setShowInlineAdd(false); onRefresh(); }}
                onCancel={() => setShowInlineAdd(false)}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="bg-info/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">إجمالي المديونية</p>
              <p className="text-lg font-bold text-info">{totalDebt.toLocaleString('en-US')} ر.س</p>
            </div>
            <div className="bg-success/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">إجمالي المسدّد</p>
              <p className="text-lg font-bold text-success">{totalPaid.toLocaleString('en-US')} ر.س</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">المتبقي</p>
              <p className="text-lg font-bold text-destructive">{remaining.toLocaleString('en-US')} ر.س</p>
            </div>
          </div>
          {allInstallments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد عمليات لهذا المندوب</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead>
                 <tr className="ta-thead">
                    <th className="ta-th w-10">#</th>
                    <th className="ta-th">الشهر</th>
                    <th className="ta-th">تاريخ السلفة</th>
                    <th className="ta-th">أخذ كام</th>
                    <th className="ta-th">سدّد كام</th>
                    <th className="ta-th">ملاحظات</th>
                    <th className="ta-th w-16">المرفق</th>
                    <th className="ta-th w-16">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {allInstallments.map((inst, idx) => (
                    <tr key={inst.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="ta-td text-muted-foreground">{idx + 1}</td>
                      <td className="ta-td" dir="ltr">{inst.month_year}</td>
                      <td className="ta-td text-muted-foreground">{inst.advanceDate}</td>
                      <td className="ta-td">
                        <span className="font-semibold text-info text-xs">{inst.advanceTotal.toLocaleString('en-US')} ر.س</span>
                      </td>
                      <td className="ta-td">
                        {inst.status === 'deducted'
                          ? <span className="font-semibold text-success text-xs">{inst.amount.toLocaleString('en-US')} ر.س</span>
                          : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="ta-td max-w-xs">
                        {editingNoteId === inst.id ? (
                          <div className="flex items-center gap-2">
                            <Input autoFocus value={noteValue} onChange={e => setNoteValue(e.target.value)} className="h-7 text-xs"
                              placeholder="اكتب ملاحظة..."
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  saveNote(inst.id);
                                  return;
                                }
                                if (e.key === 'Escape') setEditingNoteId(null);
                              }} />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveNote(inst.id)} disabled={savingNote}>{savingNote ? '...' : 'حفظ'}</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setEditingNoteId(null)}>إلغاء</Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-start w-full"
                            onClick={() => startEditNote(inst)}
                            title="اضغط للتعديل"
                          >
                            {inst.notes || <span className="text-muted-foreground/30 italic">اضغط للإضافة</span>}
                          </button>
                        )}
                      </td>
                      <td className="ta-td">
                        {inst.attachmentUrl ? (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const url = await storageService.createSignedUrl('advance-attachments', inst.attachmentUrl!);
                              window.open(url, '_blank');
                            } catch {
                              toast({ title: 'فشل فتح المرفق', variant: 'destructive' });
                            }
                          }} title="عرض المرفق">
                            <Paperclip size={14} />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="ta-td">
                        {canEdit && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteInstallmentId(inst.id); }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="حذف هذا الصف"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 border-t-2 border-border/60">
                    <td colSpan={3} className="ta-td font-bold text-muted-foreground">الإجمالي</td>
                    <td className="ta-td font-bold text-info">{totalDebt.toLocaleString('en-US')} ر.س</td>
                    <td className="ta-td font-bold text-success">{totalPaid.toLocaleString('en-US')} ر.س</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPrint(true)}>
              <Printer size={14} /> طباعة الكشف
            </Button>
            <Button variant="outline" onClick={onClose}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPrint && (
        <PrintSlip
          employeeName={employeeName}
          nationalId={nationalId}
          totalDebt={totalDebt}
          totalPaid={totalPaid}
          remaining={remaining}
          advances={advances.filter(a => a.employee_id === employeeId)}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── Confirm Delete Advance Dialog ── */}
      {deleteAdvanceId && (
        <Dialog open onOpenChange={v => !v && setDeleteAdvanceId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> تأكيد حذف السلفة
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              سيتم حذف هذه السلفة وجميع أقساطها نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </p>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeleteAdvanceId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteAdvance} disabled={deletingAdvance}>
                {deletingAdvance ? '...' : 'حذف نهائياً'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Delete Single Installment Row ── */}
      {deleteInstallmentId && (
        <Dialog open onOpenChange={v => !v && setDeleteInstallmentId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={18} /> حذف صف من السجل
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              سيتم حذف هذا الصف من سجل العمليات نهائياً. هل تريد المتابعة؟
            </p>
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setDeleteInstallmentId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={handleDeleteInstallment} disabled={deletingInstallment}>
                {deletingInstallment ? '...' : 'حذف الصف'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export interface AddEmployeeAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addEmployeePickerOpen: boolean;
  setAddEmployeePickerOpen: (open: boolean) => void;
  employees: { id: string; name: string; national_id?: string | null }[];
  employeeSummaries: EmployeeSummary[];
  onPickEmployee: (_e: { id: string; name: string }) => void;
}

export const AddEmployeeAdvanceDialog = ({
  open,
  onOpenChange,
  addEmployeePickerOpen,
  setAddEmployeePickerOpen,
  employees,
  employeeSummaries,
  onPickEmployee,
}: Readonly<AddEmployeeAdvanceDialogProps>) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm" dir="rtl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><UserPlus size={16} /> إضافة مندوب جديد للسلف</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">اختر مندوباً من القائمة لإضافة سلفة له مباشرة.</p>
        <Popover open={addEmployeePickerOpen} onOpenChange={setAddEmployeePickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              اختر المندوب...
              <Search size={14} className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="ابحث باسم المندوب..." />
              <CommandList>
                <CommandEmpty>لا يوجد مندوب مطابق</CommandEmpty>
                <CommandGroup>
                  {employees
                    .filter((e) => !employeeSummaries.some((s) => s.employeeId === e.id))
                    .map((e) => (
                      <CommandItem
                        key={e.id}
                        value={`${e.name} ${e.national_id ?? ''} ${e.id}`}
                        onSelect={() => {
                          onPickEmployee({
                            id: e.id,
                            name: e.name,
                          });
                          setAddEmployeePickerOpen(false);
                          onOpenChange(false);
                        }}
                      >
                        {e.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export interface DeleteAllEmployeeAdvancesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleting: boolean;
  onConfirm: () => void;
}

export const DeleteAllEmployeeAdvancesDialog = ({
  open,
  onOpenChange,
  deleting,
  onConfirm,
}: Readonly<DeleteAllEmployeeAdvancesDialogProps>) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm" dir="rtl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={18} /> تأكيد حذف جميع السلف
        </DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        سيتم حذف جميع سلف هذا المندوب وكافة أقساطها نهائياً. هل تريد المتابعة؟
      </p>
      <DialogFooter className="gap-2 mt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
          {deleting ? '...' : 'حذف نهائياً'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
