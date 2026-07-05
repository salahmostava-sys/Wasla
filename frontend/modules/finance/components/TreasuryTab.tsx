import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { useTreasury } from '../hooks/useTreasury';
import type { TreasuryTransaction, TreasuryTransactionType } from '../types/treasury';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Landmark, Wallet, Banknote, ArrowLeftRight, Paperclip, ArrowUpRight, ArrowDownRight, Trash2, Pencil, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { storageService } from '@services/storageService';

function treasuryTxTypeLabel(type: TreasuryTransactionType): string {
  if (type === 'income') return 'إيراد';
  if (type === 'expense') return 'مصروف';
  return 'تحويل';
}

function treasuryTxTypeColorClass(type: TreasuryTransactionType): string {
  if (type === 'income') return 'text-emerald-600';
  if (type === 'expense') return 'text-rose-500';
  return 'text-blue-500';
}

export function TreasuryTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const {
    accounts, categories, balances, transactions,
    createTransaction, isCreatingTransaction,
    deleteTransaction, isDeletingTransaction,
    updateTransaction, isUpdatingTransaction,
  } = useTreasury(from, to);

  // New Transaction Form State
  const [type, setType] = useState<TreasuryTransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Delete & Edit confirmation state
  const [deleteTarget, setDeleteTarget] = useState<TreasuryTransaction | null>(null);
  const [editTarget, setEditTarget] = useState<TreasuryTransaction | null>(null);

  // Edit form state
  const [editType, setEditType] = useState<TreasuryTransactionType>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferToId, setEditTransferToId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleOpenEdit = (t: TreasuryTransaction) => {
    setEditTarget(t);
    setEditType(t.type);
    setEditAccountId(t.account_id);
    setEditCategoryId(t.category_id || '');
    setEditTransferToId(t.transfer_to_account_id || '');
    setEditAmount(t.amount.toString());
    setEditDescription(t.description || '');
    setEditDate(t.transaction_date);
  };

  const handleConfirmEdit = async () => {
    if (!editTarget) return;
    if (!editAccountId || !editAmount || Number(editAmount) <= 0) return;
    if ((editType === 'income' || editType === 'expense') && !editCategoryId) return;
    if (editType === 'transfer' && (!editTransferToId || editAccountId === editTransferToId)) return;

    try {
      await updateTransaction({
        id: editTarget.id,
        input: {
          type: editType,
          account_id: editAccountId,
          category_id: editType === 'transfer' ? null : editCategoryId,
          transfer_to_account_id: editType === 'transfer' ? editTransferToId : null,
          amount: Number(editAmount),
          description: editDescription || null,
          transaction_date: editDate,
        }
      });
      toast.success('تم تعديل القيد بنجاح');
      setEditTarget(null);
    } catch {
      toast.error('فشل في تعديل القيد');
    }
  };


  const handleAddTransaction = async () => {
    if (!accountId || !amount || Number(amount) <= 0) return;
    if ((type === 'income' || type === 'expense') && !categoryId) return;
    if (type === 'transfer' && (!transferToId || accountId === transferToId)) return;

    try {
      let attachment_url = null;
      if (file) {
        const ext = file.name.split('.').pop();
        const fileName = `treasury-${Date.now()}.${ext}`;
        attachment_url = await storageService.uploadFile('advance-attachments', fileName, file);
      }

      await createTransaction({
        type,
        account_id: accountId,
        category_id: type === 'transfer' ? null : categoryId,
        transfer_to_account_id: type === 'transfer' ? transferToId : null,
        amount: Number(amount),
        description: description || null,
        attachment_url,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });

      setAmount('');
      setDescription('');
      setFile(null);
      toast.success('تم تسجيل العملية بنجاح');
    } catch {
      toast.error('فشل في تسجيل العملية');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTransaction(deleteTarget);
      toast.success('تم حذف القيد بنجاح');
    } catch {
      toast.error('فشل في حذف القيد');
    } finally {
      setDeleteTarget(null);
    }
  };

  const getAccountIcon = (type: string) => {
    if (type === 'bank') return <Landmark size={20} className="text-blue-500" />;
    if (type === 'custody') return <Wallet size={20} className="text-purple-500" />;
    return <Banknote size={20} className="text-emerald-500" />;
  };

  const typeLabel = (t: TreasuryTransaction) => {
    if (t.type === 'income') return 'إيراد';
    if (t.type === 'expense') return 'مصروف';
    return 'تحويل';
  };

  return (
    <div className="space-y-6 mt-4">
      {/* ── Balances Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {balances.map(b => (
          <div key={b.id} className="bg-card shadow-sm border border-border rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              {getAccountIcon(b.type)}
              <span className="text-sm font-semibold truncate">{b.name}</span>
            </div>
            <span className={`text-xl font-black ${b.current_balance < 0 ? 'text-rose-500' : 'text-foreground'}`}>
              {b.current_balance.toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">ر.س</span>
            </span>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
              <span className="text-emerald-600 flex items-center"><ArrowDownRight size={10}/> {b.total_in.toLocaleString('en-US')}</span>
              <span className="text-rose-500 flex items-center"><ArrowUpRight size={10}/> {b.total_out.toLocaleString('en-US')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Ledger Table (سجل الحركة) ──────────────── */}
        <div className="lg:col-span-2 bg-card shadow-sm border border-border rounded-xl flex flex-col">
          <div className="p-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
            <h3 className="font-bold flex items-center gap-2">سجل الحركة (دفتر الأستاذ)</h3>
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-32" />
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-32" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="ta-th w-10">م</th>
                  <th className="ta-th w-24">التاريخ</th>
                  <th className="ta-th">البيان</th>
                  <th className="ta-th">الحساب</th>
                  <th className="ta-th">البند</th>
                  <th className="ta-th w-24">مدين (إيراد)</th>
                  <th className="ta-th w-24">دائن (مصروف)</th>
                  <th className="ta-th w-12">المرفق</th>
                  <th className="ta-th w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={9} className="ta-td text-center text-muted-foreground py-8">لا توجد حركات في هذه الفترة</td></tr>
                ) : (
                  transactions.map((t, i) => (
                    <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="ta-td text-muted-foreground text-xs">{i + 1}</td>
                      <td className="ta-td text-xs" dir="ltr">{t.transaction_date}</td>
                      <td className="ta-td max-w-xs truncate" title={t.description || ''}>{t.description || '—'}</td>
                      <td className="ta-td font-medium text-xs">
                        {t.type === 'transfer' ? (
                          <div className="flex items-center gap-1">
                            <span className="text-rose-500">{t.account?.name}</span>
                            <ArrowLeftRight size={10} className="text-muted-foreground" />
                            <span className="text-emerald-600">{t.transfer_to_account?.name}</span>
                          </div>
                        ) : (
                          t.account?.name
                        )}
                      </td>
                      <td className="ta-td text-xs">{t.category?.name || '—'}</td>
                      <td className="ta-td text-emerald-600 font-bold">
                        {t.type === 'income' ? t.amount.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="ta-td text-rose-500 font-bold">
                        {t.type === 'expense' || t.type === 'transfer' ? t.amount.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="ta-td">
                        {t.attachment_url ? (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={async () => {
                            try {
                              const url = await storageService.createSignedUrl('advance-attachments', t.attachment_url!);
                              window.open(url, '_blank');
                            } catch { toast.error('فشل فتح المرفق'); }
                          }}>
                            <Paperclip size={14} />
                          </Button>
                        ) : '—'}
                      </td>
                      <td className="ta-td">
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="تعديل القيد"
                            onClick={() => handleOpenEdit(t)}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={`حذف القيد — ${typeLabel(t)} ${t.amount?.toLocaleString('en-US')} ر.س`}
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Add Transaction & Categories Summary ─────── */}
        <div className="space-y-6">

          {/* Add Form */}
          <div className="bg-card shadow-sm border border-border rounded-xl p-4">
            <h3 className="font-bold mb-4 flex items-center gap-2 border-b border-border/50 pb-2">تسجيل عملية جديدة</h3>

            <div className="space-y-3">
              <div className="flex bg-muted p-1 rounded-lg">
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'expense' ? 'bg-background shadow-sm text-rose-500' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('expense')}>مصروف</button>
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'income' ? 'bg-background shadow-sm text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('income')}>إيراد</button>
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'transfer' ? 'bg-background shadow-sm text-info' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('transfer')}>تحويل</button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-1">من حساب (المنصرف منه)</label>
                <select id="treasury-field-1" value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                  <option value="">اختر الحساب...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {type === 'transfer' ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-2">إلى حساب (المحول إليه)</label>
                  <select id="treasury-field-2" value={transferToId} onChange={e => setTransferToId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر الحساب...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-3">البند</label>
                  <select id="treasury-field-3" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر البند...</option>
                    {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-4">المبلغ</label>
                <Input id="treasury-field-4" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="text-end font-bold" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-5">البيان / الوصف</label>
                <Input id="treasury-field-5" value={description} onChange={e => setDescription(e.target.value)} placeholder="تفاصيل العملية..." />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-6">المرفق (اختياري)</label>
                <Input id="treasury-field-6" type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs h-9 cursor-pointer" accept="image/*,.pdf" />
              </div>

              <Button onClick={handleAddTransaction} disabled={isCreatingTransaction || !accountId || !amount} className="w-full mt-2">
                {isCreatingTransaction ? 'جاري الحفظ...' : 'حفظ العملية'}
              </Button>
            </div>
          </div>


        </div>
      </div>

      {/* ── Delete Confirmation Dialog ─────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={16} className="text-destructive" />
              تأكيد حذف القيد
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>هل أنت متأكد من حذف هذا القيد؟ <strong>لا يمكن التراجع عن هذا الإجراء.</strong></p>
                {deleteTarget && (
                  <div className="bg-muted/50 rounded-lg p-3 border border-border/50 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">النوع:</span>
                      <span className={`font-semibold ${treasuryTxTypeColorClass(deleteTarget.type)}`}>
                        {treasuryTxTypeLabel(deleteTarget.type)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المبلغ:</span>
                      <span className="font-bold">{Number(deleteTarget.amount).toLocaleString('en-US')} ر.س</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">التاريخ:</span>
                      <span dir="ltr">{deleteTarget.transaction_date}</span>
                    </div>
                    {deleteTarget.description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">البيان:</span>
                        <span className="truncate max-w-[180px]">{deleteTarget.description}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeletingTransaction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTransaction ? <Loader2 size={14} className="animate-spin me-1" /> : null}
              حذف القيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit Transaction Dialog ────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل القيد</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-4">
              <div className="flex bg-muted p-1 rounded-lg">
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${editType === 'expense' ? 'bg-background shadow-sm text-rose-500' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setEditType('expense')}>مصروف</button>
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${editType === 'income' ? 'bg-background shadow-sm text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setEditType('income')}>إيراد</button>
                <button type="button" className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${editType === 'transfer' ? 'bg-background shadow-sm text-info' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setEditType('transfer')}>تحويل</button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-7">التاريخ</label>
                <Input id="treasury-field-7" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-9 text-sm" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-8">من حساب (المنصرف منه)</label>
                <select id="treasury-field-8" value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                  <option value="">اختر الحساب...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {editType === 'transfer' ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-9">إلى حساب (المحول إليه)</label>
                  <select id="treasury-field-9" value={editTransferToId} onChange={e => setEditTransferToId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر الحساب...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-10">البند</label>
                  <select id="treasury-field-10" value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر البند...</option>
                    {categories.filter(c => c.type === editType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-11">المبلغ</label>
                <Input id="treasury-field-11" type="number" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="0.00" className="text-end font-bold" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block" htmlFor="treasury-field-12">البيان / الوصف</label>
                <Input id="treasury-field-12" value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="تفاصيل العملية..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={isUpdatingTransaction}>إلغاء</Button>
            <Button onClick={handleConfirmEdit} disabled={isUpdatingTransaction || !editAccountId || !editAmount}>
              {isUpdatingTransaction ? <Loader2 size={14} className="animate-spin me-1" /> : null}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
