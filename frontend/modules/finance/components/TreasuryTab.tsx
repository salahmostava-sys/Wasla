import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { useTreasury } from '../hooks/useTreasury';
import type { TreasuryTransactionType } from '../types/treasury';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Landmark, Wallet, Banknote, ArrowLeftRight, Paperclip, Plus, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { storageService } from '@services/storageService';

export function TreasuryTab() {
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const { 
    accounts, categories, balances, transactions, 
    createTransaction, isCreatingTransaction 
  } = useTreasury(from, to);

  // New Transaction Form State
  const [type, setType] = useState<TreasuryTransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleAddTransaction = async () => {
    if (!accountId || !amount || Number(amount) <= 0) return;
    if ((type === 'income' || type === 'expense') && !categoryId) return;
    if (type === 'transfer' && (!transferToId || accountId === transferToId)) return;

    try {
      let attachment_url = null;
      if (file) {
        attachment_url = await storageService.uploadFile('advance-attachments', file);
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
    } catch (err) {
      toast.error('فشل في تسجيل العملية');
    }
  };

  const getAccountIcon = (type: string) => {
    if (type === 'bank') return <Landmark size={20} className="text-blue-500" />;
    if (type === 'custody') return <Wallet size={20} className="text-purple-500" />;
    return <Banknote size={20} className="text-emerald-500" />;
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
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={8} className="ta-td text-center text-muted-foreground py-8">لا توجد حركات في هذه الفترة</td></tr>
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
                            } catch (e) { toast.error('فشل فتح المرفق'); }
                          }}>
                            <Paperclip size={14} />
                          </Button>
                        ) : '—'}
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
                <button className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'expense' ? 'bg-background shadow-sm text-rose-500' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('expense')}>مصروف</button>
                <button className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'income' ? 'bg-background shadow-sm text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('income')}>إيراد</button>
                <button className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${type === 'transfer' ? 'bg-background shadow-sm text-info' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setType('transfer')}>تحويل</button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">من حساب (المنصرف منه)</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                  <option value="">اختر الحساب...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {type === 'transfer' ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">إلى حساب (المحول إليه)</label>
                  <select value={transferToId} onChange={e => setTransferToId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر الحساب...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">البند</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
                    <option value="">اختر البند...</option>
                    {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">المبلغ</label>
                <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="text-end font-bold" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">البيان / الوصف</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="تفاصيل العملية..." />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">المرفق (اختياري)</label>
                <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-xs h-9 cursor-pointer" accept="image/*,.pdf" />
              </div>

              <Button onClick={handleAddTransaction} disabled={isCreatingTransaction || !accountId || !amount} className="w-full mt-2">
                {isCreatingTransaction ? 'جاري الحفظ...' : 'حفظ العملية'}
              </Button>
            </div>
          </div>

          {/* Categories Summary */}
          <div className="bg-card shadow-sm border border-border rounded-xl p-4">
            <h3 className="font-bold mb-3 text-sm flex items-center justify-between border-b border-border/50 pb-2">
              ملخص البنود 
              <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">الفترة المحددة أعلاه</span>
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {categories.map(cat => {
                const total = transactions.filter(t => t.category_id === cat.id).reduce((s, t) => s + Number(t.amount), 0);
                if (total === 0) return null;
                return (
                  <div key={cat.id} className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border/40">
                    <span className="text-xs font-medium">{cat.name}</span>
                    <span className={`text-sm font-bold ${cat.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {total.toLocaleString('en-US')}
                    </span>
                  </div>
                );
              })}
              {transactions.filter(t => t.category_id).length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-4">لا يوجد مصاريف في هذه الفترة</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
