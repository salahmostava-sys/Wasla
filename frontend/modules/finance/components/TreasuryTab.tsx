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
import { Landmark, Wallet, Banknote, ArrowLeftRight, Paperclip, ArrowUpRight, ArrowDownRight, Trash2, Pencil, Loader2, Download, TrendingUp } from 'lucide-react';
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
    accounts, apps, categories, balances, transactions,
    createTransaction, isCreatingTransaction,
    deleteTransaction, isDeletingTransaction,
    updateTransaction, isUpdatingTransaction,
  } = useTreasury(from, to);

  // New Transaction Form State
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [type, setType] = useState<TreasuryTransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [appId, setAppId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Delete & Edit confirmation state
  const [deleteTarget, setDeleteTarget] = useState<TreasuryTransaction | null>(null);
  const [editTarget, setEditTarget] = useState<TreasuryTransaction | null>(null);

  // Edit form state
  const [editType, setEditType] = useState<TreasuryTransactionType>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferToId, setEditTransferToId] = useState('');
  const [editAppId, setEditAppId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleOpenEdit = (t: TreasuryTransaction) => {
    setEditTarget(t);
    setEditType(t.type);
    setEditAccountId(t.account_id);
    setEditCategoryId(t.category_id || '');
    setEditTransferToId(t.transfer_to_account_id || '');
    setEditAppId(t.app_id || '');
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
          app_id: editAppId || null,
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
        app_id: appId || null,
        amount: Number(amount),
        description: description || null,
        attachment_url,
        transaction_date: date,
      });

      setAmount('');
      setDescription('');
      setFile(null);
      setAppId('');
      setIsAddingRow(false);
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

      {/* ── App Revenues (إيرادات المنصات) ────────────────────── */}
      {(() => {
        const sums: Record<string, number> = {};
        transactions.forEach(t => {
          if (t.type === 'income' && t.app_id) {
            sums[t.app_id] = (sums[t.app_id] || 0) + t.amount;
          }
        });
        const appRevenues = Object.entries(sums).map(([id, amount]) => {
          const app = apps.find(a => a.id === id);
          return { id, name: app?.name || 'منصة غير معروفة', amount };
        }).sort((a, b) => b.amount - a.amount);

        if (appRevenues.length === 0) return null;

        return (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-3">
              <TrendingUp size={16} /> المبالغ المحصلة من المنصات (خلال الفترة)
            </h3>
            <div className="flex flex-wrap gap-3">
              {appRevenues.map(ar => (
                <div key={ar.id} className="bg-background shadow-sm border border-border rounded-lg px-3 py-2 flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{ar.name}</span>
                  <span className="text-sm font-black text-emerald-600">{ar.amount.toLocaleString('en-US')} <span className="text-[10px] font-normal">ر.س</span></span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="space-y-6">

        {/* ── Ledger Table (سجل الحركة) ──────────────── */}
        <div className="bg-card shadow-sm border border-border rounded-xl flex flex-col">
          <div className="p-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
            <h3 className="font-bold flex items-center gap-2">سجل الحركة (دفتر الأستاذ)</h3>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsAddingRow(true)} disabled={isAddingRow} size="sm" className="h-8 gap-1">
                <span className="text-lg leading-none">+</span> تسجيل عملية
              </Button>
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
                  <th className="ta-th w-32">التاريخ</th>
                  <th className="ta-th">البيان</th>
                  <th className="ta-th w-40">الحساب (ونوع العملية)</th>
                  <th className="ta-th w-40">البند</th>
                  <th className="ta-th w-28">مدين (إيراد)</th>
                  <th className="ta-th w-28">دائن (مصروف)</th>
                  <th className="ta-th w-12">المرفق</th>
                  <th className="ta-th w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isAddingRow && (
                  <tr className="border-b-2 border-primary/20 bg-primary/5">
                    <td className="ta-td align-top text-center text-xs text-muted-foreground pt-3">
                      *
                    </td>
                    <td className="ta-td align-top">
                      <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs px-2" />
                    </td>
                    <td className="ta-td align-top">
                      <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف..." className="h-8 text-xs px-2" />
                    </td>
                    <td className="ta-td align-top space-y-1.5">
                      <select value={type} onChange={e => {
                        setType(e.target.value as TreasuryTransactionType);
                        if (e.target.value === 'transfer') setCategoryId('');
                        else setTransferToId('');
                      }} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                        <option value="expense">مصروف</option>
                        <option value="income">إيراد</option>
                        <option value="transfer">تحويل</option>
                      </select>
                      <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                        <option value="">{type === 'transfer' ? 'من حساب...' : 'الحساب...'}</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                    <td className="ta-td align-top pt-3">
                      {type === 'transfer' ? (
                        <select value={transferToId} onChange={e => setTransferToId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                          <option value="">إلى حساب...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      ) : (
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                          <option value="">البند...</option>
                          {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="ta-td align-top pt-3">
                      <Input 
                        type="number" min="0" placeholder="0" className="h-8 text-xs px-2 text-center" 
                        value={type === 'income' ? amount : ''}
                        onChange={e => {
                          if (type !== 'income') setType('income');
                          setAmount(e.target.value);
                        }} 
                      />
                    </td>
                    <td className="ta-td align-top pt-3">
                      <Input 
                        type="number" min="0" placeholder="0" className="h-8 text-xs px-2 text-center" 
                        value={type === 'expense' || type === 'transfer' ? amount : ''}
                        onChange={e => {
                          if (type === 'income') setType('expense'); // Default to expense if typing here
                          setAmount(e.target.value);
                        }} 
                      />
                    </td>
                    <td className="ta-td align-top pt-3">
                      <label className="flex items-center justify-center h-8 w-8 mx-auto rounded border cursor-pointer hover:bg-muted transition-colors relative" title="إرفاق ملف">
                        <Paperclip size={14} className={file ? 'text-primary' : 'text-muted-foreground'} />
                        <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} accept="image/*,.pdf" />
                        {file && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />}
                      </label>
                    </td>
                    <td className="ta-td align-top pt-3">
                      <div className="flex items-center gap-1 justify-center">
                        <Button 
                          onClick={handleAddTransaction} 
                          disabled={isCreatingTransaction || !accountId || !amount} 
                          size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          {isCreatingTransaction ? <Loader2 size={14} className="animate-spin" /> : <span className="text-sm font-bold">✔</span>}
                        </Button>
                        <Button 
                          onClick={() => {
                            setIsAddingRow(false);
                            setFile(null);
                            setAmount('');
                            setDescription('');
                          }} 
                          disabled={isCreatingTransaction} 
                          size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-50"
                        >
                          <span className="text-sm font-bold">✖</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {transactions.length === 0 ? (
                  <tr><td colSpan={9} className="ta-td text-center text-muted-foreground py-8">لا توجد حركات في هذه الفترة</td></tr>
                ) : (
                  transactions.map((t, i) => {
                    if (editTarget?.id === t.id) {
                      return (
                        <tr key={t.id} className="border-b-2 border-primary/20 bg-primary/5">
                          <td className="ta-td align-top text-center text-xs text-muted-foreground pt-3">
                            <Pencil size={12} className="inline" />
                          </td>
                          <td className="ta-td align-top">
                            <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs px-2" />
                          </td>
                          <td className="ta-td align-top">
                            <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="وصف..." className="h-8 text-xs px-2" />
                          </td>
                          <td className="ta-td align-top space-y-1.5">
                            <select value={editType} onChange={e => {
                              setEditType(e.target.value as TreasuryTransactionType);
                              if (e.target.value === 'transfer') setEditCategoryId('');
                              else setEditTransferToId('');
                            }} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                              <option value="expense">مصروف</option>
                              <option value="income">إيراد</option>
                              <option value="transfer">تحويل</option>
                            </select>
                            <select value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                              <option value="">{editType === 'transfer' ? 'من حساب...' : 'الحساب...'}</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </td>
                          <td className="ta-td align-top pt-3">
                            {editType === 'transfer' ? (
                              <select value={editTransferToId} onChange={e => setEditTransferToId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                                <option value="">إلى حساب...</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            ) : (
                              <div className="space-y-1.5">
                                <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                                  <option value="">البند...</option>
                                  {categories.filter(c => c.type === editType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                {editType === 'income' && (
                                  <select value={editAppId} onChange={e => setEditAppId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                                    <option value="">(اختياري) المنصة / الشركة...</option>
                                    {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="ta-td align-top pt-3">
                            <Input 
                              type="number" min="0" placeholder="0" className="h-8 text-xs px-2 text-center" 
                              value={editType === 'income' ? editAmount : ''}
                              onChange={e => {
                                if (editType !== 'income') setEditType('income');
                                setEditAmount(e.target.value);
                              }} 
                            />
                          </td>
                          <td className="ta-td align-top pt-3">
                            <Input 
                              type="number" min="0" placeholder="0" className="h-8 text-xs px-2 text-center" 
                              value={editType === 'expense' || editType === 'transfer' ? editAmount : ''}
                              onChange={e => {
                                if (editType === 'income') setEditType('expense');
                                setEditAmount(e.target.value);
                              }} 
                            />
                          </td>
                          <td className="ta-td align-top pt-3 text-center text-xs text-muted-foreground">
                            —
                          </td>
                          <td className="ta-td align-top pt-3">
                            <div className="flex items-center gap-1 justify-center">
                              <Button 
                                onClick={handleConfirmEdit} 
                                disabled={isUpdatingTransaction || !editAccountId || !editAmount} 
                                size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="حفظ التعديلات"
                              >
                                {isUpdatingTransaction ? <Loader2 size={14} className="animate-spin" /> : <span className="text-sm font-bold">✔</span>}
                              </Button>
                              <Button 
                                onClick={() => setEditTarget(null)} 
                                disabled={isUpdatingTransaction} 
                                size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-50"
                                title="إلغاء التعديل"
                              >
                                <span className="text-sm font-bold">✖</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
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
                        <td className="ta-td text-xs">
                          {t.category?.name || '—'}
                          {t.app?.name && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold bg-muted px-1.5 py-0.5 rounded-sm inline-block">
                              {t.app.name}
                            </div>
                          )}
                        </td>
                        <td className="ta-td text-emerald-600 font-bold">
                          {t.type === 'income' ? t.amount.toLocaleString('en-US') : '—'}
                        </td>
                        <td className="ta-td text-rose-500 font-bold">
                          {t.type === 'expense' || t.type === 'transfer' ? t.amount.toLocaleString('en-US') : '—'}
                        </td>
                        <td className="ta-td">
                          {t.attachment_url ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="عرض المرفق" onClick={async () => {
                                try {
                                  const url = await storageService.createSignedUrl('advance-attachments', t.attachment_url!);
                                  window.open(url, '_blank');
                                } catch { toast.error('فشل فتح المرفق'); }
                              }}>
                                <Paperclip size={14} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="تحميل المرفق" onClick={async () => {
                                try {
                                  const url = await storageService.createSignedDownloadUrl('advance-attachments', t.attachment_url!);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = t.attachment_url!.split('/').pop() || 'download';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                } catch { toast.error('فشل تحميل المرفق'); }
                              }}>
                                <Download size={14} />
                              </Button>
                            </div>
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
                    );
                  })
                )}
              </tbody>
            </table>
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

    </div>
  );
}
