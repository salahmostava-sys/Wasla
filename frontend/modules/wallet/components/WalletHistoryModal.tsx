import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import walletService from '@services/walletService';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string };
}

interface WalletHistoryTx {
  id: string;
  transaction_type: string;
  transaction_date: string;
  notes?: string | null;
  amount: number;
}

function renderHistoryContent(isLoading: boolean, history: WalletHistoryTx[]) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground text-sm">
        لا توجد حركات مسجلة لهذا المندوب
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((tx) => {
        const isCollection = tx.transaction_type === 'collection';
        return (
          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isCollection ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
                {isCollection ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
              <div>
                <div className="font-medium text-sm">
                  {isCollection ? 'استلام كاش (مستحق)' : 'شحن المحفظة (مسدد)'}
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{format(new Date(tx.transaction_date), 'dd MMMM yyyy', { locale: ar })}</span>
                  {tx.notes && <span>• {tx.notes}</span>}
                </div>
              </div>
            </div>
            <div className={`font-bold ${isCollection ? 'text-orange-600' : 'text-green-600'}`} dir="ltr">
              {isCollection ? '+' : '-'}{tx.amount}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WalletHistoryModal = ({ open, onOpenChange, employee }: Props) => {
  const { enabled } = useAuthQueryGate();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['wallet-history', employee.id],
    enabled: enabled && open,
    queryFn: () => walletService.getEmployeeHistory(employee.id),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start">سجل حركات المحفظة - {employee.name}</DialogTitle>
        </DialogHeader>
        
        <div className="py-2 max-h-[60vh] overflow-y-auto custom-sidebar-scroll">
          {renderHistoryContent(isLoading, history)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletHistoryModal;
