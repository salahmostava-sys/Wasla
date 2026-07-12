import type React from 'react';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, History, Search } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { useLanguage } from '@app/providers/LanguageContext';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import walletService from '@services/walletService';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { BaseTable, type TableColumn } from '@shared/components/ui/base-table';
import WalletTransactionModal from '../components/WalletTransactionModal';
import WalletHistoryModal from '../components/WalletHistoryModal';

type EmployeeWalletBalance = {
  employee_id: string;
  employee_name: string;
  employee_status: string;
  balance: number;
};

const WalletPage = () => {
  const { isRTL } = useLanguage();
  const { enabled } = useAuthQueryGate();
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [transactionType, setTransactionType] = useState<'collection' | 'deposit'>('collection');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: balances = [], isLoading, error: walletError, refetch } = useQuery({
    queryKey: ['wallet-balances'],
    enabled,
    queryFn: () => walletService.getWalletBalances(),
  });

  const handleOpenTransaction = (employee: { id: string; name: string }, type: 'collection' | 'deposit') => {
    setSelectedEmployee(employee);
    setTransactionType(type);
    setTransactionModalOpen(true);
  };

  const handleOpenHistory = (employee: { id: string; name: string }) => {
    setSelectedEmployee(employee);
    setHistoryModalOpen(true);
  };

  // Filter balances by search query and show employees with non-zero balances or active status
  const displayedBalances = useMemo(() => {
    const filtered = balances.filter(b => b.balance > 0 || b.employee_status === 'active');
    if (!searchQuery) return filtered;
    return filtered.filter(b => b.employee_name.includes(searchQuery));
  }, [balances, searchQuery]);

  const columns: TableColumn<EmployeeWalletBalance>[] = [
    {
      key: 'employee_name',
      title: 'المندوب',
      className: 'font-medium text-start',
    },
    {
      key: 'balance',
      title: 'الرصيد بالعهدة (كاش)',
      className: 'text-start',
      render: (item) => (
        <span className={`font-bold ${item.balance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
          {item.balance.toLocaleString()} ريال
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'إجراءات',
      className: 'text-end',
      render: (item) => (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-1 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-400"
            onClick={() => handleOpenTransaction({ id: item.employee_id, name: item.employee_name }, 'collection')}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            تسجيل كاش
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-1 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400"
            onClick={() => handleOpenTransaction({ id: item.employee_id, name: item.employee_name }, 'deposit')}
            disabled={item.balance <= 0}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            شحن المحفظة
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => handleOpenHistory({ id: item.employee_id, name: item.employee_name })}
            title="سجل الحركات"
            aria-label="سجل الحركات"
          >
            <History className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>
      
      {walletError ? (
        <QueryErrorRetry error={walletError} onRetry={() => refetch()} title="تعذر تحميل أرصدة المحفظة" />
      ) : (
        <BaseTable 
          data={displayedBalances}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="لا يوجد أرصدة حالية للمناديب."
          className="bg-card shadow-sm border-border"
        />
      )}

      {selectedEmployee && (
        <>
          <WalletTransactionModal
            open={transactionModalOpen}
            onOpenChange={setTransactionModalOpen}
            employee={selectedEmployee}
            type={transactionType}
            onSuccess={() => {
              setTransactionModalOpen(false);
              refetch();
            }}
          />
          <WalletHistoryModal
            open={historyModalOpen}
            onOpenChange={setHistoryModalOpen}
            employee={selectedEmployee}
          />
        </>
      )}
    </div>
  );
};

export default WalletPage;
