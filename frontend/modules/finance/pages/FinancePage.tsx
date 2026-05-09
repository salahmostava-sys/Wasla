import type React from 'react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Plus, Trash2, RefreshCw, Calendar, Lock, TrendingUp, TrendingDown, Wallet, Copy } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { useFinance } from '@modules/finance/hooks/useFinance';
import type { FinanceTransaction, TransactionType } from '@services/financeService';

/* ── Smart Recommendations sub-component ─────────────────────── */
function PlatformProfitCard({ p }: Readonly<{ p: { name: string; revenue: number; salary: number; orders: number } }>) {
  const profit = p.revenue - p.salary;
  const isProfitable = profit > 0;
  const marginPct = p.revenue > 0 ? ((profit / p.revenue) * 100).toFixed(0) : '0';
  return (
    <div className={`rounded-xl p-3 border ${isProfitable ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-foreground">{p.name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isProfitable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'}`}>
          {isProfitable ? `✅ ربح ${marginPct}%` : `⚠️ خسارة`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">الإيرادات</p>
          <p className="font-bold text-emerald-600">{p.revenue > 0 ? p.revenue.toLocaleString('en-US') : '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">الرواتب</p>
          <p className="font-bold text-rose-500">{p.salary > 0 ? p.salary.toLocaleString('en-US') : '—'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">الفرق</p>
          <p className={`font-bold ${isProfitable ? 'text-emerald-600' : 'text-rose-500'}`}>
            {profit > 0 ? '+' : ''}{profit.toLocaleString('en-US')}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        {p.orders.toLocaleString('en-US')} طلب
        {p.revenue > 0 && p.orders > 0 && ` • متوسط الإيراد/طلب: ${(p.revenue / p.orders).toFixed(1)} ر.س`}
        {p.salary > 0 && p.orders > 0 && ` • تكلفة الراتب/طلب: ${(p.salary / p.orders).toFixed(1)} ر.س`}
      </p>
    </div>
  );
}

function SmartRecommendations({
  revenue, expenses, balance, platformStats,
}: Readonly<{
  revenue: number; expenses: number; balance: number;
  platformStats: { platforms: { name: string; revenue: number; salary: number; orders: number }[] } | null;
}>) {
  const profitable = platformStats?.platforms.filter(p => p.revenue > p.salary) ?? [];
  const losing = platformStats?.platforms.filter(p => p.revenue > 0 && p.revenue <= p.salary) ?? [];
  const profitMargin = revenue > 0 ? ((balance / revenue) * 100).toFixed(0) : '0';

  return (
    <div className="bg-card rounded-2xl shadow-card p-5 border border-primary/20">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        💡 توصيات ذكية
      </h3>
      <div className="space-y-2.5">
        {platformStats && platformStats.platforms.length > 0 && (
          <div className="bg-primary/5 rounded-lg px-4 py-3">
            <p className="text-sm font-bold text-foreground mb-3">📊 تحليل كل منصة: إيرادات مقابل رواتب</p>
            <div className="space-y-3">
              {platformStats.platforms.map(p => (
                <PlatformProfitCard key={p.name} p={p} />
              ))}
            </div>
            {platformStats.platforms.some(p => p.revenue > 0) && (
              <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded-lg px-3 py-2">
                💡 <strong>نصيحة:</strong>{' '}
                {losing.length > 0
                  ? `ركّز على ${profitable[0]?.name ?? 'المنصات الرابحة'} وراجع تكاليف ${losing.map(l => l.name).join(' و ')}`
                  : 'كل المنصات رابحة — استمر وزد الطلبات'}
              </p>
            )}
          </div>
        )}
        {balance < 0 && (
          <div className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/20 rounded-lg px-3 py-2.5">
            <span className="text-rose-500 text-lg leading-none mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-rose-600">أنت خسران {Math.abs(balance).toLocaleString('en-US')} ر.س هذا الشهر</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {platformStats && platformStats.platforms.length > 0
                  ? `ركّز على زيادة طلبات ${platformStats.platforms[0].name} أو قلل المصاريف غير الضرورية`
                  : 'حاول زيادة الإيرادات أو تقليل المصاريف'}
              </p>
            </div>
          </div>
        )}
        {balance >= 0 && balance >= expenses * 0.3 && (
          <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2.5">
            <span className="text-emerald-500 text-lg leading-none mt-0.5">✅</span>
            <div>
              <p className="text-sm font-semibold text-emerald-600">أداء ممتاز! هامش ربح {profitMargin}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">استمر على هذا الأداء</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Table Components ────────────────────────────────────────

type FinanceNewRowForm = { amount: string; description: string };

type TableProps = {
  loading: boolean;
  items: FinanceTransaction[];
  editingId: string | null;
  editField: 'description' | 'amount';
  editText: string;
  setEditText: (v: string) => void;
  setEditingId: (id: string | null) => void;
  startEdit: (id: string, field: 'description' | 'amount', value: string) => void;
  saveEdit: (id: string) => void;
  deleteTransaction: (id: string) => void;
  isDeleting: boolean;
  isSaving: boolean;
  newItem: FinanceNewRowForm;
  setNewItem: Dispatch<SetStateAction<FinanceNewRowForm>>;
  onAddRow: () => void;
};

function RevenueTable(props: Readonly<TableProps>) {
  const { loading, items, editingId, editField, editText, setEditText, setEditingId, startEdit, saveEdit, deleteTransaction, isDeleting, isSaving, newItem, setNewItem, onAddRow } = props;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30">
          <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground w-36">المبلغ (ر.س)</th>
          <th className="px-3 py-2 text-start text-[11px] font-semibold text-muted-foreground">الوصف</th>
          <th className="px-3 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">جاري التحميل...</td></tr>
        )}
        {!loading && items.length === 0 && (
          <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">لا توجد إيرادات — أضف من الأسفل</td></tr>
        )}
        {!loading && items.length > 0 && (
          [...items].sort((a, b) => b.date.localeCompare(a.date)).map(t => {
            const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              else if (e.key === 'Escape') { setEditingId(null); }
            };
            return (
              <tr key={t.id} className="border-t border-border/20 hover:bg-muted/10">
                <td className="px-3 py-2.5 text-center font-bold text-emerald-600">
                  {editingId === t.id && editField === 'amount' ? (
                    <Input autoFocus type="number" min="0" value={editText} onChange={e => setEditText(e.target.value)}
                      onBlur={() => { saveEdit(t.id); }} onKeyDown={handleKeyDown}
                      className="h-7 text-sm text-center font-bold" dir="ltr" />
                  ) : (
                    <button type="button" className={t.is_auto ? '' : 'cursor-pointer hover:opacity-70'} onClick={() => { if (!t.is_auto) startEdit(t.id, 'amount', String(t.amount)); }} disabled={t.is_auto}>
                      {t.amount.toLocaleString('en-US')}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-foreground">
                  {editingId === t.id && editField === 'description' ? (
                    <Input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                      onBlur={() => { saveEdit(t.id); }} onKeyDown={handleKeyDown}
                      className="h-7 text-sm" dir="rtl" />
                  ) : (
                    <button type="button" className={t.is_auto ? '' : 'cursor-pointer hover:text-primary'} onClick={() => { if (!t.is_auto) startEdit(t.id, 'description', t.description || t.category); }} disabled={t.is_auto}>
                      {t.description || t.category}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {t.is_auto ? <Lock size={12} className="mx-auto text-muted-foreground/40" /> : (
                    <button aria-label="حذف" type="button" onClick={() => { deleteTransaction(t.id); }} disabled={isDeleting} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive"><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            );
          })
        )}
        <tr className="border-t-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10">
          <td className="px-2 py-2">
            <Input type="number" min="0" step="0.01" placeholder="0" value={newItem.amount} onChange={e => setNewItem(r => ({ ...r, amount: e.target.value }))} className="h-9 text-sm text-center font-bold w-full" dir="ltr" />
          </td>
          <td className="px-2 py-2">
            <Input placeholder="وصف الإيراد..." value={newItem.description} onChange={e => setNewItem(r => ({ ...r, description: e.target.value }))} className="h-9 text-sm w-full" dir="rtl" />
          </td>
          <td className="px-2 py-2 text-center">
            <Button size="sm" onClick={onAddRow} disabled={isSaving || !newItem.amount} className="h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700">
              <Plus size={16} />
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function ExpenseTable(props: Readonly<TableProps>) {
  const { loading, items, editingId, editField, editText, setEditText, setEditingId, startEdit, saveEdit, deleteTransaction, isDeleting, isSaving, newItem, setNewItem, onAddRow } = props;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-muted/30">
          <th className="px-3 py-2 text-center text-[11px] font-semibold text-muted-foreground w-36">المبلغ (ر.س)</th>
          <th className="px-3 py-2 text-start text-[11px] font-semibold text-muted-foreground">الوصف</th>
          <th className="px-3 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody>
        {loading && (
          <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">جاري التحميل...</td></tr>
        )}
        {!loading && items.length === 0 && (
          <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-xs">لا توجد مصاريف — أضف من الأسفل أو اضغط مزامنة الرواتب</td></tr>
        )}
        {!loading && items.length > 0 && (
          [...items].sort((a, b) => b.date.localeCompare(a.date)).map(t => {
            const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              else if (e.key === 'Escape') { setEditingId(null); }
            };
            return (
              <tr key={t.id} className="border-t border-border/20 hover:bg-muted/10">
                <td className="px-3 py-2.5 text-center font-bold text-rose-500">
                  {editingId === t.id && editField === 'amount' ? (
                    <Input autoFocus type="number" min="0" value={editText} onChange={e => setEditText(e.target.value)}
                      onBlur={() => { saveEdit(t.id); }} onKeyDown={handleKeyDown}
                      className="h-7 text-sm text-center font-bold" dir="ltr" />
                  ) : (
                    <button type="button" className={t.is_auto ? '' : 'cursor-pointer hover:opacity-70'} onClick={() => { if (!t.is_auto) startEdit(t.id, 'amount', String(t.amount)); }} disabled={t.is_auto}>
                      {t.amount.toLocaleString('en-US')}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-foreground">
                  {editingId === t.id && editField === 'description' ? (
                    <Input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                      onBlur={() => { saveEdit(t.id); }} onKeyDown={handleKeyDown}
                      className="h-7 text-sm" dir="rtl" />
                  ) : (
                    <button type="button" className={t.is_auto ? '' : 'cursor-pointer hover:text-primary'} onClick={() => { if (!t.is_auto) startEdit(t.id, 'description', t.description || t.category); }} disabled={t.is_auto}>
                      {t.description || t.category}
                      {t.is_auto && <span className="text-[10px] text-muted-foreground ms-1.5">🔒</span>}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {!t.is_auto && (
                    <button aria-label="حذف" type="button" onClick={() => { deleteTransaction(t.id); }} disabled={isDeleting} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive"><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            );
          })
        )}
        <tr className="border-t-2 border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10">
          <td className="px-2 py-2">
            <Input type="number" min="0" step="0.01" placeholder="0" value={newItem.amount} onChange={e => setNewItem(r => ({ ...r, amount: e.target.value }))} className="h-9 text-sm text-center font-bold w-full" dir="ltr" />
          </td>
          <td className="px-2 py-2">
            <Input placeholder="وصف المصروف..." value={newItem.description} onChange={e => setNewItem(r => ({ ...r, description: e.target.value }))} className="h-9 text-sm w-full" dir="rtl" />
          </td>
          <td className="px-2 py-2 text-center">
            <Button size="sm" onClick={onAddRow} disabled={isSaving || !newItem.amount} className="h-9 w-9 p-0 bg-rose-500 hover:bg-rose-600">
              <Plus size={16} />
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function FinancePage() {
  const { selectedMonth } = useTemporalContext();
  const {
    loading, error, refetch,
    revenue, expenses, balance,
    revenueItems, expenseItems,
    createTransaction, deleteTransaction, syncSalaries, updateTransaction,
    isSaving, isDeleting, isSyncing,
    platformStats,
  } = useFinance();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'description' | 'amount'>('description');
  const [editText, setEditText] = useState('');

  const startEdit = (id: string, field: 'description' | 'amount', value: string) => {
    setEditingId(id);
    setEditField(field);
    setEditText(value);
  };

  const saveEdit = async (id: string) => {
    if (editField === 'amount') {
      const num = Number(editText);
      if (num > 0) await updateTransaction({ id, amount: num });
    } else {
      await updateTransaction({ id, description: editText });
    }
    setEditingId(null);
  };

  const monthLabel = format(new Date(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ar });
  const [newRevenue, setNewRevenue] = useState({ amount: '', description: '' });
  const [newExpense, setNewExpense] = useState({ amount: '', description: '' });
  const [carryingOver, setCarryingOver] = useState(false);

  const handleAddRow = async (type: TransactionType) => {
    const row = type === 'revenue' ? newRevenue : newExpense;
    if (!row.amount || Number(row.amount) <= 0) return;
    const today = new Date().toISOString().split('T')[0];
    await createTransaction({
      type,
      category: type === 'revenue' ? 'إيرادات' : 'مصاريف',
      description: row.description || undefined,
      amount: Number(row.amount),
      month_year: selectedMonth,
      date: today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`,
    });
    if (type === 'revenue') setNewRevenue({ amount: '', description: '' });
    else setNewExpense({ amount: '', description: '' });
  };

  const handleCarryOver = async () => {
    if (expenseItems.length === 0) return;
    setCarryingOver(true);
    try {
      const [y, m] = selectedMonth.split('-').map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      for (const item of expenseItems) {
        if (item.is_auto) continue;
        await createTransaction({
          type: 'expense',
          category: item.category,
          description: `${item.description || item.category} (مرحّل من ${monthLabel})`,
          amount: item.amount,
          month_year: nextMonth,
          date: `${nextMonth}-01`,
        });
      }
    } finally {
      setCarryingOver(false);
    }
  };

  if (error && !loading) {
    return <div className="space-y-4" dir="rtl"><QueryErrorRetry error={error} onRetry={() => { refetch(); }} title="تعذر تحميل البيانات المالية" /></div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground/80 mb-1">
            <span>الرئيسية</span><span>/</span><span className="font-medium">المصاريف والإيرادات</span>
          </nav>
          <h1 className="text-xl font-black text-foreground">المصاريف والإيرادات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{monthLabel} — {balance >= 0 ? '✅ ربح' : '⚠️ خسارة'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-xl bg-muted/40 px-3 py-1.5 border border-border/50 text-[11px] font-bold text-muted-foreground">
            <Calendar size={13} className="me-1.5 text-primary/70" />{monthLabel}
          </div>
          <Button variant="outline" size="sm" onClick={() => { syncSalaries(); }} disabled={isSyncing} className="gap-1.5 h-8 text-xs">
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} /> مزامنة الرواتب
          </Button>
          <Button variant="outline" size="sm" onClick={handleCarryOver} disabled={carryingOver || expenseItems.length === 0} className="gap-1.5 h-8 text-xs">
            <Copy size={13} /> ترحيل المصاريف للشهر التالي
          </Button>
        </div>
      </div>

      {/* ── Summary ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl shadow-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center"><TrendingUp size={22} className="text-emerald-600" /></div>
          <div>
            <p className="text-[11px] text-muted-foreground">الإيرادات</p>
            <p className="text-2xl font-black text-emerald-600">{revenue.toLocaleString('en-US')}</p>
            <p className="text-[10px] text-muted-foreground">{revenueItems.length} عملية</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl shadow-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center"><TrendingDown size={22} className="text-rose-500" /></div>
          <div>
            <p className="text-[11px] text-muted-foreground">المصاريف</p>
            <p className="text-2xl font-black text-rose-500">{expenses.toLocaleString('en-US')}</p>
            <p className="text-[10px] text-muted-foreground">{expenseItems.length} عملية</p>
          </div>
        </div>
        <div className={`bg-card rounded-2xl shadow-card p-5 flex items-center gap-4 ring-2 ${balance >= 0 ? 'ring-emerald-300 dark:ring-emerald-700' : 'ring-rose-300 dark:ring-rose-700'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${balance >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-rose-100 dark:bg-rose-950/40'}`}>
            <Wallet size={22} className={balance >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">الرصيد الحالي</p>
            <p className={`text-2xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {balance >= 0 ? '+' : ''}{balance.toLocaleString('en-US')}
            </p>
            <p className="text-[10px] font-semibold">{balance >= 0 ? '✅ كسبان' : '⚠️ خسران'}</p>
          </div>
        </div>
      </div>

      {/* ── Two Columns ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── REVENUES ─────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="px-4 py-3 border-b border-border/50 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">💰 الإيرادات</h3>
            <span className="text-xs text-emerald-600 font-bold">{revenue.toLocaleString('en-US')} ر.س</span>
          </div>
          <RevenueTable
            loading={loading} items={revenueItems} editingId={editingId} editField={editField}
            editText={editText} setEditText={setEditText} setEditingId={setEditingId}
            startEdit={startEdit} saveEdit={saveEdit} deleteTransaction={deleteTransaction}
            isDeleting={isDeleting} isSaving={isSaving} newItem={newRevenue}
            setNewItem={setNewRevenue} onAddRow={() => handleAddRow('revenue')}
          />
        </div>

        {/* ── EXPENSES ─────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden border border-rose-200/50 dark:border-rose-800/30">
          <div className="px-4 py-3 border-b border-border/50 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">💸 المصاريف</h3>
            <span className="text-xs text-rose-500 font-bold">{expenses.toLocaleString('en-US')} ر.س</span>
          </div>
          <ExpenseTable
            loading={loading} items={expenseItems} editingId={editingId} editField={editField}
            editText={editText} setEditText={setEditText} setEditingId={setEditingId}
            startEdit={startEdit} saveEdit={saveEdit} deleteTransaction={deleteTransaction}
            isDeleting={isDeleting} isSaving={isSaving} newItem={newExpense}
            setNewItem={setNewExpense} onAddRow={() => handleAddRow('expense')}
          />
        </div>
      </div>

      {/* ── Smart Recommendations ──────────────────────── */}
      {!loading && (revenue > 0 || expenses > 0) && (
        <SmartRecommendations revenue={revenue} expenses={expenses} balance={balance} platformStats={platformStats} />
      )}
    </div>
  );
}
