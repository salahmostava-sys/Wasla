import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { useTreasury } from '../hooks/useTreasury';
import { Input } from '@shared/components/ui/input';
import { TrendingDown, TrendingUp, ArrowLeftRight, BarChart3 } from 'lucide-react';

export function TreasuryCategorySummaryTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { categories, transactions, isLoading } = useTreasury(from, to);

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const getCategoryTotal = (catId: string) =>
    transactions.filter(t => t.category_id === catId).reduce((s, t) => s + Number(t.amount), 0);

  const totalIncome = incomeCategories.reduce((s, c) => s + getCategoryTotal(c.id), 0);
  const totalExpense = expenseCategories.reduce((s, c) => s + getCategoryTotal(c.id), 0);
  const transferTotal = transactions.filter(t => t.type === 'transfer').reduce((s, t) => s + Number(t.amount), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-6 mt-4">

      {/* ── Date Filter ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">الفترة:</span>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-36" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-36" />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
          </div>
          <p className="text-xl font-black text-emerald-600">{totalIncome.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">ر.س</p>
        </div>

        <div className="bg-card border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
              <TrendingDown size={16} className="text-rose-500" />
            </div>
            <span className="text-xs text-muted-foreground">إجمالي المصاريف</span>
          </div>
          <p className="text-xl font-black text-rose-500">{totalExpense.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">ر.س</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">إجمالي التحويلات</span>
          </div>
          <p className="text-xl font-black text-blue-500">{transferTotal.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">ر.س</p>
        </div>

        <div className={`bg-card rounded-xl p-4 ring-2 ${net >= 0 ? 'ring-emerald-300 dark:ring-emerald-700 border-emerald-200' : 'ring-rose-300 dark:ring-rose-700 border-rose-200'} border`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-rose-100 dark:bg-rose-950/40'}`}>
              <BarChart3 size={16} className={net >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
            </div>
            <span className="text-xs text-muted-foreground">الصافي</span>
          </div>
          <p className={`text-xl font-black ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {net >= 0 ? '+' : ''}{net.toLocaleString('en-US')}
          </p>
          <p className="text-[10px] font-semibold mt-0.5">{net >= 0 ? '✅ ربح' : '⚠️ خسارة'}</p>
        </div>
      </div>

      {/* ── Category Details ── */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Income Categories */}
          <div className="bg-card border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-200/50 flex items-center justify-between">
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 text-sm">
                <TrendingUp size={15} /> بنود الإيرادات
              </h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                {totalIncome.toLocaleString('en-US')} ر.س
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {incomeCategories.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">لا توجد بنود إيرادات</p>
              ) : (
                incomeCategories.map(cat => {
                  const total = getCategoryTotal(cat.id);
                  const txCount = transactions.filter(t => t.category_id === cat.id).length;
                  const pct = totalIncome > 0 ? (total / totalIncome) * 100 : 0;
                  return (
                    <div key={cat.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                          <span className="text-[10px] text-muted-foreground ms-2">{txCount} عملية</span>
                        </div>
                        <div className="text-end">
                          <span className="text-sm font-bold text-emerald-600">{total.toLocaleString('en-US')}</span>
                          <span className="text-[10px] text-muted-foreground ms-1">ر.س</span>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-emerald-100 dark:bg-emerald-950/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {total > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(1)}% من الإيرادات</p>
                      )}
                      {total === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">لا توجد عمليات في هذه الفترة</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Expense Categories */}
          <div className="bg-card border border-rose-200/60 dark:border-rose-800/40 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/60 dark:bg-rose-950/20 border-b border-rose-200/50 flex items-center justify-between">
              <h3 className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 text-sm">
                <TrendingDown size={15} /> بنود المصاريف
              </h3>
              <span className="text-xs font-bold text-rose-500 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-full">
                {totalExpense.toLocaleString('en-US')} ر.س
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {expenseCategories.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">لا توجد بنود مصاريف</p>
              ) : (
                expenseCategories.map(cat => {
                  const total = getCategoryTotal(cat.id);
                  const txCount = transactions.filter(t => t.category_id === cat.id).length;
                  const pct = totalExpense > 0 ? (total / totalExpense) * 100 : 0;
                  return (
                    <div key={cat.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                          <span className="text-[10px] text-muted-foreground ms-2">{txCount} عملية</span>
                        </div>
                        <div className="text-end">
                          <span className="text-sm font-bold text-rose-500">{total.toLocaleString('en-US')}</span>
                          <span className="text-[10px] text-muted-foreground ms-1">ر.س</span>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-rose-100 dark:bg-rose-950/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-rose-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {total > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(1)}% من المصاريف</p>
                      )}
                      {total === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">لا توجد عمليات في هذه الفترة</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
