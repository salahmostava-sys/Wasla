import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { treasuryService } from '@services/treasuryService';
import type { TreasuryTransaction, TreasuryAccount, TreasuryCategory } from '../types/treasury';
import { useUndo } from '@shared/context/UndoContext';

function describeTreasuryTxType(type: TreasuryTransaction['type']): string {
  if (type === 'income') return 'إيراد';
  if (type === 'expense') return 'مصروف';
  return 'تحويل';
}

export function useTreasury(from: string, to: string) {
  const { enabled, userId } = useAuthQueryGate();
  const queryClient = useQueryClient();
  const userKey = authQueryUserId(userId);
  const { registerAction } = useUndo();

  const accountsQuery = useQuery({
    queryKey: ['treasury_accounts', userKey],
    queryFn: () => treasuryService.getAccounts(),
    enabled,
  });

  const categoriesQuery = useQuery({
    queryKey: ['treasury_categories', userKey],
    queryFn: () => treasuryService.getCategories(),
    enabled,
  });

  const balancesQuery = useQuery({
    queryKey: ['treasury_balances', userKey],
    queryFn: () => treasuryService.getAccountBalances(),
    enabled,
  });

  const transactionsQuery = useQuery({
    queryKey: ['treasury_transactions', userKey, from, to],
    queryFn: () => treasuryService.getTransactions(from, to),
    enabled: enabled && !!from && !!to,
  });

  const createTransaction = useMutation({
    mutationFn: (input: Partial<TreasuryTransaction>) => treasuryService.createTransaction(input),
    onSuccess: (newTx) => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
      registerAction({
        description: `إضافة قيد — ${describeTreasuryTxType(newTx.type)} ${Number(newTx.amount).toLocaleString('en-US')} ر.س`,
        undoCommand: async () => {
          await treasuryService.deleteTransaction(newTx.id);
          queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
          queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
        },
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TreasuryTransaction> }) => treasuryService.updateTransaction(id, input),
    onSuccess: (_updatedTx, variables) => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
      // Snapshot current transactions to find old data
      const currentTxs: TreasuryTransaction[] | undefined = queryClient.getQueryData(['treasury_transactions']);
      const prevTx = currentTxs?.find(t => t.id === variables.id);
      if (prevTx) {
        registerAction({
          description: `تعديل قيد — ${describeTreasuryTxType(prevTx.type)} ${Number(prevTx.amount).toLocaleString('en-US')} ر.س`,
          undoCommand: async () => {
            await treasuryService.updateTransaction(variables.id, {
              type: prevTx.type,
              account_id: prevTx.account_id,
              category_id: prevTx.category_id,
              transfer_to_account_id: prevTx.transfer_to_account_id,
              amount: prevTx.amount,
              description: prevTx.description,
              transaction_date: prevTx.transaction_date,
            });
            queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
            queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
          },
        });
      }
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (tx: TreasuryTransaction) => {
      // Snapshot the full record BEFORE deleting
      return { deletedTx: tx, _: await treasuryService.deleteTransaction(tx.id) };
    },
    onSuccess: ({ deletedTx }) => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
      registerAction({
        description: `حذف قيد — ${describeTreasuryTxType(deletedTx.type)} ${Number(deletedTx.amount).toLocaleString('en-US')} ر.س`,
        undoCommand: async () => {
          await treasuryService.createTransaction({
            type: deletedTx.type,
            account_id: deletedTx.account_id,
            category_id: deletedTx.category_id,
            transfer_to_account_id: deletedTx.transfer_to_account_id,
            amount: deletedTx.amount,
            description: deletedTx.description,
            attachment_url: deletedTx.attachment_url,
            transaction_date: deletedTx.transaction_date,
          });
          queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
          queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
        },
      });
    },
  });

  const createAccount = useMutation({
    mutationFn: (input: Partial<TreasuryAccount>) => treasuryService.createAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
    },
  });

  const createCategory = useMutation({
    mutationFn: (input: Partial<TreasuryCategory>) => treasuryService.createCategory(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_categories'] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => treasuryService.deactivateAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => treasuryService.deactivateCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_categories'] });
    },
  });

  return {
    accounts: accountsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    balances: balancesQuery.data ?? [],
    transactions: transactionsQuery.data ?? [],
    isLoading: accountsQuery.isLoading || categoriesQuery.isLoading || transactionsQuery.isLoading || balancesQuery.isLoading,
    createTransaction: createTransaction.mutateAsync,
    updateTransaction: updateTransactionMutation.mutateAsync,
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    isDeletingTransaction: deleteTransactionMutation.isPending,
    isUpdatingTransaction: updateTransactionMutation.isPending,
    createAccount: createAccount.mutateAsync,
    createCategory: createCategory.mutateAsync,
    deleteAccount: deleteAccount.mutateAsync,
    deleteCategory: deleteCategory.mutateAsync,
    isCreatingTransaction: createTransaction.isPending,
  };
}
