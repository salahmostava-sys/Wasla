import { formatCurrency } from '@shared/lib/formatters';

import React, { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useTreasury } from '../hooks/useTreasury';
import type { TreasuryTransaction, TreasuryTransactionType } from '../types/treasury';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { Landmark, Wallet, Banknote, ArrowLeftRight, Paperclip, ArrowUpRight, ArrowDownRight, Trash2, Edit, Loader2, Download, TrendingUp, X, SlidersHorizontal, Check } from 'lucide-react';
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

function getTransactionTypeStyle(type: TreasuryTransactionType): string {
  if (type === 'income') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
  if (type === 'expense') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
  return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400';
}

const SELECT_CLS = 'w-full h-9 text-xs rounded-lg border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary';

export function TreasuryTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const {
    accounts, apps, categories, balances, transactions,
    createTransaction, isCreatingTransaction,
    deleteTransaction, isDeletingTransaction,
    updateTransaction, isUpdatingTransaction,
  } = useTreasury(from, to);

  // ── Add Form State ─────────────────────────────────────────────
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

  // ── Edit State ─────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TreasuryTransaction | null>(null);
  const [editTarget, setEditTarget] = useState<TreasuryTransaction | null>(null);
  const [editType, setEditType] = useState<TreasuryTransactionType>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferToId, setEditTransferToId] = useState('');
  const [editAppId, setEditAppId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');

  // ── Column Filters ─────────────────────────────────────────────
  const [filterType, setFilterType] = useState<TreasuryTransactionType | ''>('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterDesc, setFilterDesc] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [filterType, filterAccountId, filterCategoryId, filterDesc].filter(Boolean).length;

  const clearFilters = () => {
    setFilterType('');
    setFilterAccountId('');
    setFilterCategoryId('');
    setFilterDesc('');
  };

  // ── Filtered Transactions ──────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType && t.type !== filterType) return false;
      if (filterAccountId && t.account_id !== filterAccountId) return false;
      if (filterCategoryId && t.category_id !== filterCategoryId) return false;
      if (filterDesc && !t.description?.toLowerCase().includes(filterDesc.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterAccountId, filterCategoryId, filterDesc]);

  // ── Handlers ───────────────────────────────────────────────────
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
      setAmount(''); setDescription(''); setFile(null); setAppId('');
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

  const getAccountIcon = (t: string) => {
    if (t === 'bank') return <Landmark size={20} className="text-blue-500" />;
    if (t === 'custody') return <Wallet size={20} className="text-purple-500" />;
    return <Banknote size={20} className="text-emerald-500" />;
  };

  const typeLabel = (t: TreasuryTransaction) => {
    if (t.type === 'income') return 'إيراد';
    if (t.type === 'expense') return 'مصروف';
    return 'تحويل';
  };

  // ── App Revenues ───────────────────────────────────────────────
  const appRevenues = useMemo(() => {
    const sums: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type === 'income' && t.app_id) {
        sums[t.app_id] = (sums[t.app_id] || 0) + t.amount;
      }
    });
    return Object.entries(sums).map(([id, amt]) => {
      const app = apps.find(a => a.id === id);
      return { id, name: app?.name || 'منصة غير معروفة', amount: amt };
    }).sort((a, b) => b.amount - a.amount);
  }, [transactions, apps]);

  // ── Category Type for add form ─────────────────────────────────
  const categoryTypeForForm = type === 'income' ? 'income' : 'expense';

  // ── Edit Row Renderer ──────────────────────────────────────────
  const renderEditRow = (t: TreasuryTransaction) => {
    const editCatType = editType === 'income' ? 'income' : 'expense';
    return (
      <tr key={t.id} className="border-b-2 border-primary/20 bg-primary/5">
        <td className="ta-td text-center text-muted-foreground"><Edit size={11} className="inline" /></td>
        <td className="ta-td"><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8 text-xs px-1.5 w-28" /></td>
        <td className="ta-td"><Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="وصف..." className="h-8 text-xs px-1.5" /></td>
        <td className="ta-td">
          <select value={editAccountId} onChange={e => setEditAccountId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-1.5">
            <option value="">الحساب...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </td>
        <td className="ta-td">
          <select value={editType} onChange={e => {
            setEditType(e.target.value as TreasuryTransactionType);
            if (e.target.value === 'transfer') setEditCategoryId('');
            else setEditTransferToId('');
          }} className="w-full h-8 text-xs rounded border border-input bg-background px-1.5">
            <option value="expense">مصروف</option>
            <option value="income">إيراد</option>
            <option value="transfer">تحويل</option>
          </select>
        </td>
        <td className="ta-td">
          {editType === 'transfer' ? (
            <select value={editTransferToId} onChange={e => setEditTransferToId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-1.5">
              <option value="">إلى حساب...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <div className="space-y-1">
              <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full h-8 text-xs rounded border border-input bg-background px-1.5">
                <option value="">البند...</option>
                {categories.filter(c => c.type === editCatType).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {editType === 'income' && (
                <select value={editAppId} onChange={e => setEditAppId(e.target.value)} className="w-full h-7 text-[11px] rounded border border-input bg-background px-1.5">
                  <option value="">بدون منصة</option>
                  {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          )}
        </td>
        <td className="ta-td">
          <Input type="number" min="0" placeholder="0" className="h-8 text-xs px-1.5 text-center"
            value={editType === 'income' ? editAmount : ''}
            onChange={e => { if (editType !== 'income') { setEditType('income'); } setEditAmount(e.target.value); }}
          />
        </td>
        <td className="ta-td">
          <Input type="number" min="0" placeholder="0" className="h-8 text-xs px-1.5 text-center"
            value={editType !== 'income' ? editAmount : ''}
            onChange={e => { if (editType === 'income') { setEditType('expense'); } setEditAmount(e.target.value); }}
          />
        </td>
        <td className="ta-td text-center text-muted-foreground text-xs">—</td>
        <td className="ta-td">
          <div className="flex items-center gap-1 justify-center">
            <Button onClick={handleConfirmEdit} disabled={isUpdatingTransaction || !editAccountId || !editAmount}
              size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" title="حفظ">
              {isUpdatingTransaction ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </Button>
            <Button onClick={() => setEditTarget(null)} disabled={isUpdatingTransaction}
              size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50" title="إلغاء">
              <X size={13} />
            </Button>
          </div>
        </td>
      </tr>
    );
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
              {formatCurrency(b.current_balance)}
            </span>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
              <span className="text-emerald-600 flex items-center"><ArrowDownRight size={10}/> {b.total_in.toLocaleString('en-US')}</span>
              <span className="text-rose-500 flex items-center"><ArrowUpRight size={10}/> {b.total_out.toLocaleString('en-US')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── App Revenues ────────────────────────────── */}
      {appRevenues.length > 0 && (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl p-4">
          <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-3">
            <TrendingUp size={16} /> المبالغ المحصلة من المنصات (خلال الفترة)
          </h3>
          <div className="flex flex-wrap gap-3">
            {appRevenues.map(ar => (
              <div key={ar.id} className="bg-background shadow-sm border border-border rounded-lg px-3 py-2 flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">{ar.name}</span>
                <span className="text-sm font-black text-emerald-600">{formatCurrency(ar.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Transaction Modal ─────────────────────── */}
      {isAddingRow && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">+</span>{' '}
              تسجيل عملية جديدة
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsAddingRow(false); setFile(null); setAmount(''); setDescription(''); setAppId(''); }}>
              <X size={14} />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-muted-foreground">التاريخ</div>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-xs" />
            </div>
            {/* Type */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-muted-foreground">نوع العملية</div>
              <select value={type} onChange={e => {
                setType(e.target.value as TreasuryTransactionType);
                if (e.target.value === 'transfer') setCategoryId('');
                else setTransferToId('');
                setAppId('');
              }} className={SELECT_CLS}>
                <option value="expense">مصروف</option>
                <option value="income">إيراد</option>
                <option value="transfer">تحويل داخلي</option>
              </select>
            </div>
            {/* Account */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-muted-foreground">{type === 'transfer' ? 'من حساب' : 'الحساب'}</div>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className={SELECT_CLS}>
                <option value="">اختر الحساب...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {/* Category or Transfer To */}
            {type === 'transfer' ? (
              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-semibold text-muted-foreground">إلى حساب</div>
                <select value={transferToId} onChange={e => setTransferToId(e.target.value)} className={SELECT_CLS}>
                  <option value="">اختر الحساب...</option>
                  {accounts.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-semibold text-muted-foreground">البند</div>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={SELECT_CLS}>
                  <option value="">اختر البند...</option>
                  {categories.filter(c => c.type === categoryTypeForForm).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {/* App (only for income) */}
            {type === 'income' && (
              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-semibold text-muted-foreground">المنصة / الشركة <span className="text-muted-foreground/60">(اختياري)</span></div>
                <select value={appId} onChange={e => setAppId(e.target.value)} className={SELECT_CLS}>
                  <option value="">بدون منصة</option>
                  {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {/* Amount */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-muted-foreground">المبلغ (ر.س)</div>
              <Input type="number" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-xs" />
            </div>
            {/* Description */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <div className="text-[11px] font-semibold text-muted-foreground">البيان / الوصف</div>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف العملية..." className="h-9 text-xs" />
            </div>
            {/* File */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-muted-foreground">مرفق</div>
              <label className="flex items-center gap-2 h-9 px-3 border border-input rounded-lg cursor-pointer hover:bg-muted transition-colors text-xs text-muted-foreground">
                <Paperclip size={13} className={file ? 'text-primary' : ''} />
                <span className="truncate">{file ? file.name : 'إرفاق ملف...'}</span>
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} accept="image/*,.pdf" />
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end mt-4 pt-4 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => { setIsAddingRow(false); setFile(null); setAmount(''); setDescription(''); setAppId(''); }}>
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleAddTransaction}
              disabled={isCreatingTransaction || !accountId || !amount || Number(amount) <= 0}
              className="gap-1"
            >
              {isCreatingTransaction ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              حفظ العملية
            </Button>
          </div>
        </div>
      )}

      {/* ── Ledger Table ─────────────────────────────── */}
      <div className="bg-card shadow-sm border border-border rounded-xl flex flex-col">
        <div className="p-4 border-b border-border/50 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <h3 className="font-bold flex items-center gap-2">سجل الحركة (دفتر الأستاذ)</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {!isAddingRow && (
              <Button onClick={() => setIsAddingRow(true)} size="sm" className="h-8 gap-1">
                <span className="text-lg leading-none">+</span> تسجيل عملية
              </Button>
            )}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-1 relative"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal size={13} />
              فلتر
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-32" />
            <span className="text-xs text-muted-foreground">إلى</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-32" />
          </div>
        </div>

        {/* ── Filters Panel ─────────────────────────── */}
        {showFilters && (
          <div className="p-3 border-b border-border/50 bg-muted/10 flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-type" className="text-[10px] font-semibold text-muted-foreground">نوع العملية</label>
              <select id="filter-type" value={filterType} onChange={e => setFilterType(e.target.value as TreasuryTransactionType | '')} className="h-7 text-xs rounded border border-input bg-background px-2 min-w-[110px]">
                <option value="">الكل</option>
                <option value="income">إيراد</option>
                <option value="expense">مصروف</option>
                <option value="transfer">تحويل</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-account" className="text-[10px] font-semibold text-muted-foreground">الحساب</label>
              <select id="filter-account" value={filterAccountId} onChange={e => setFilterAccountId(e.target.value)} className="h-7 text-xs rounded border border-input bg-background px-2 min-w-[130px]">
                <option value="">الكل</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className="text-[10px] font-semibold text-muted-foreground">البند</label>
              <select id="filter-category" value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)} className="h-7 text-xs rounded border border-input bg-background px-2 min-w-[130px]">
                <option value="">الكل</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-desc" className="text-[10px] font-semibold text-muted-foreground">البيان</label>
              <Input id="filter-desc" value={filterDesc} onChange={e => setFilterDesc(e.target.value)} placeholder="بحث في البيان..." className="h-7 text-xs w-36" />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-1 mt-3.5" onClick={clearFilters}>
                <X size={11} /> مسح الفلاتر
              </Button>
            )}
            {/* Summary */}
            <div className="ms-auto mt-3.5 text-[11px] text-muted-foreground flex items-center gap-3">
              <span className="text-emerald-600 font-bold">
                إيرادات: {filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0).toLocaleString('en-US')} ر.س
              </span>
              <span className="text-rose-500 font-bold">
                مصاريف: {filtered.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0).toLocaleString('en-US')} ر.س
              </span>
              <span className="text-muted-foreground">({filtered.length} قيد)</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="ta-th w-10">م</th>
                <th className="ta-th w-28">التاريخ</th>
                <th className="ta-th">البيان</th>
                <th className="ta-th w-36">الحساب</th>
                <th className="ta-th w-24">النوع</th>
                <th className="ta-th w-36">البند</th>
                <th className="ta-th w-28">مدين (إيراد)</th>
                <th className="ta-th w-28">دائن (مصروف)</th>
                <th className="ta-th w-12">مرفق</th>
                <th className="ta-th w-20">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="ta-td text-center text-muted-foreground py-8">لا توجد حركات في هذه الفترة</td></tr>
              ) : (
                filtered.map((t, i) => {
                  if (editTarget?.id === t.id) return renderEditRow(t);

                  return (
                    <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="ta-td text-muted-foreground text-xs">{i + 1}</td>
                      <td className="ta-td text-xs" dir="ltr">{t.transaction_date}</td>
                      <td className="ta-td max-w-xs truncate" title={t.description || ''}>{t.description || '—'}</td>
                      <td className="ta-td font-medium text-xs">
                        {t.type === 'transfer' ? (
                          <div className="flex items-center gap-1">
                            <span className="text-rose-500 truncate max-w-[60px]">{t.account?.name}</span>
                            <ArrowLeftRight size={10} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-emerald-600 truncate max-w-[60px]">{t.transfer_to_account?.name}</span>
                          </div>
                        ) : t.account?.name}
                      </td>
                      <td className="ta-td">
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-sm ${getTransactionTypeStyle(t.type)}`}>
                          {typeLabel(t)}
                        </span>
                      </td>
                      <td className="ta-td text-xs">
                        <div>{t.category?.name || '—'}</div>
                        {t.app?.name && (
                          <div className="text-[10px] text-muted-foreground font-semibold bg-muted px-1.5 py-0.5 rounded-sm inline-block mt-0.5">
                            {t.app.name}
                          </div>
                        )}
                      </td>
                      <td className="ta-td text-emerald-600 font-bold">
                        {t.type === 'income' ? t.amount.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="ta-td text-rose-500 font-bold">
                        {t.type !== 'income' ? t.amount.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="ta-td">
                        {t.attachment_url ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="عرض المرفق" onClick={async () => {
                              try { const url = await storageService.createSignedUrl('advance-attachments', t.attachment_url!); window.open(url, '_blank', 'noopener,noreferrer'); }
                              catch { toast.error('فشل فتح المرفق'); }
                            }}>
                              <Paperclip size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="تحميل المرفق" onClick={async () => {
                              try {
                                const url = await storageService.createSignedDownloadUrl('advance-attachments', t.attachment_url!);
                                const a = document.createElement('a');
                                a.href = url; a.download = t.attachment_url!.split('/').pop() || 'download';
                                document.body.appendChild(a); a.click(); a.remove();
                              } catch { toast.error('فشل تحميل المرفق'); }
                            }}>
                              <Download size={13} />
                            </Button>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="ta-td">
                        <div className="flex items-center gap-0.5 justify-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10" title="تعديل القيد" onClick={() => handleOpenEdit(t)}>
                            <Edit size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title={`حذف — ${typeLabel(t)} ${t.amount?.toLocaleString('en-US')} ر.س`} onClick={() => setDeleteTarget(t)}>
                            <Trash2 size={12} className="text-destructive" />
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

      {/* ── Delete Confirmation ─────────────────────── */}
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
                      <span className="font-bold">{formatCurrency(Number(deleteTarget.amount))}</span>
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
