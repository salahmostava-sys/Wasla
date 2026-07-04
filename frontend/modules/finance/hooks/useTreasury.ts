import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { treasuryService } from '@services/treasuryService';
import type { TreasuryTransaction, TreasuryAccount, TreasuryCategory } from '../types/treasury';

export function useTreasury(from: string, to: string) {
  const { enabled, userId } = useAuthQueryGate();
  const queryClient = useQueryClient();
  const userKey = authQueryUserId(userId);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (id: string) => treasuryService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_balances'] });
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
    deleteTransaction: deleteTransactionMutation.mutateAsync,
    isDeletingTransaction: deleteTransactionMutation.isPending,
    createAccount: createAccount.mutateAsync,
    createCategory: createCategory.mutateAsync,
    deleteAccount: deleteAccount.mutateAsync,
    deleteCategory: deleteCategory.mutateAsync,
    isCreatingTransaction: createTransaction.isPending,
  };
}
