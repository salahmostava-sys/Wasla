import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Loader2, ArrowUpRight, ArrowDownRight, Trash2, Eraser } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@shared/components/ui/alert-dialog';
import { Button } from '@shared/components/ui/button';
import { useToast } from '@shared/hooks/use-toast';
import walletService from '@services/walletService';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useTranslation, type TFunction } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

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

function renderHistoryContent(
  isLoading: boolean,
  history: WalletHistoryTx[],
  onDelete: (id: string) => void,
  t: TFunction,
  locale: typeof ar,
) {
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
        {t('walletNoTransactions')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((tx) => {
        const isCollection = tx.transaction_type === 'collection';
        return (
          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card group">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isCollection ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
                {isCollection ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </div>
              <div>
                <div className="font-medium text-sm">
                  {isCollection ? t('walletCashCollection') : t('walletDepositPaid')}
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  <span>{format(new Date(tx.transaction_date), 'dd MMMM yyyy', { locale })}</span>
                  {tx.notes && <span>• {tx.notes}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`font-bold ${isCollection ? 'text-orange-600' : 'text-green-600'}`} dir="ltr">
                {isCollection ? '+' : '-'}{tx.amount}
              </div>
              <button type="button"
                onClick={() => onDelete(tx.id)}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title={t('walletDeleteTransaction')}
                aria-label={t('walletDeleteTransaction')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WalletHistoryModal = ({ open, onOpenChange, employee }: Props) => {
  const { t } = useTranslation();
  const { lang, isRTL } = useLanguage();
  const { enabled } = useAuthQueryGate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['wallet-history', employee.id],
    enabled: enabled && open,
    queryFn: () => walletService.getEmployeeHistory(employee.id),
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => walletService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-history', employee.id] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      toast({ title: t('walletTransactionDeleted') });
    },
    onError: (err) => {
      toast({ title: t('walletTransactionDeleteError'), description: (err).message, variant: 'destructive' });
    }
  });

  const clearWallet = useMutation({
    mutationFn: () => walletService.clearWallet(employee.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-history', employee.id] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      toast({ title: t('walletCleared') });
    },
    onError: (err) => {
      toast({ title: t('walletClearError'), description: (err).message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="flex flex-row items-center justify-between mt-2">
          <DialogTitle className="text-start">{t('walletHistoryTitle', { name: employee.name })}</DialogTitle>
          {history.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 gap-1 ml-6 relative z-10">
                  <Eraser size={14} /> {t('walletClearAll')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('walletClearConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('walletClearConfirmDescription', { name: employee.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:justify-start">
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={(e) => { e.preventDefault(); clearWallet.mutate(); }}
                  >
                    {clearWallet.isPending ? t('walletClearing') : t('walletClearConfirmAction')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DialogHeader>
        
        <div className="py-2 max-h-[60vh] overflow-y-auto custom-sidebar-scroll">
          {renderHistoryContent(isLoading, history, (id) => {
            if (window.confirm(t('walletDeleteConfirm'))) {
              deleteTx.mutate(id);
            }
          }, t, lang === 'ar' ? ar : enUS)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletHistoryModal;
