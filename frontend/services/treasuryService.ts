import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';
import type { TreasuryAccount, TreasuryCategory, TreasuryTransaction, TreasuryAccountBalance } from '../modules/finance/types/treasury';

export const treasuryService = {
  // Accounts
  getAccounts: async () => {
    const { data, error } = await supabase
      .from('treasury_accounts')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) handleSupabaseError(error, 'treasuryService.getAccounts');
    return data as TreasuryAccount[];
  },

  createAccount: async (input: Partial<TreasuryAccount>) => {
    const { data, error } = await supabase
      .from('treasury_accounts')
      .insert(input)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'treasuryService.createAccount');
    return data as TreasuryAccount;
  },

  updateAccount: async (id: string, input: Partial<TreasuryAccount>) => {
    const { error } = await supabase
      .from('treasury_accounts')
      .update(input)
      .eq('id', id);
    if (error) handleSupabaseError(error, 'treasuryService.updateAccount');
  },

  deactivateAccount: async (id: string) => {
    const { error } = await supabase
      .from('treasury_accounts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'treasuryService.deactivateAccount');
  },

  // Categories
  getCategories: async () => {
    const { data, error } = await supabase
      .from('treasury_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) handleSupabaseError(error, 'treasuryService.getCategories');
    return data as TreasuryCategory[];
  },

  createCategory: async (input: Partial<TreasuryCategory>) => {
    const { data, error } = await supabase
      .from('treasury_categories')
      .insert(input)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'treasuryService.createCategory');
    return data as TreasuryCategory;
  },

  deactivateCategory: async (id: string) => {
    const { error } = await supabase
      .from('treasury_categories')
      .update({ is_active: false })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'treasuryService.deactivateCategory');
  },

  // Transactions
  getTransactions: async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('treasury_transactions')
      .select(`
        *,
        account:treasury_accounts!account_id(name),
        transfer_to_account:treasury_accounts!transfer_to_account_id(name),
        category:treasury_categories!category_id(name)
      `)
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'treasuryService.getTransactions');
    return data as TreasuryTransaction[];
  },

  createTransaction: async (input: Partial<TreasuryTransaction>) => {
    const { data, error } = await supabase
      .from('treasury_transactions')
      .insert(input)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'treasuryService.createTransaction');
    return data as TreasuryTransaction;
  },

  deleteTransaction: async (id: string) => {
    const { error } = await supabase
      .from('treasury_transactions')
      .delete()
      .eq('id', id);
    if (error) handleSupabaseError(error, 'treasuryService.deleteTransaction');
  },

  // Balances
  getAccountBalances: async (): Promise<TreasuryAccountBalance[]> => {
    const accounts = await treasuryService.getAccounts();
    
    // We can compute balances locally or via an RPC.
    // For simplicity and since volume is generally low, we fetch all transactions and compute.
    // Or we fetch sums grouped by account. Let's do it via aggregations.
    const { data: incomeData } = await supabase.from('treasury_transactions').select('account_id, amount').eq('type', 'income');
    const { data: expenseData } = await supabase.from('treasury_transactions').select('account_id, amount').eq('type', 'expense');
    const { data: transfersOut } = await supabase.from('treasury_transactions').select('account_id, amount').eq('type', 'transfer');
    const { data: transfersIn } = await supabase.from('treasury_transactions').select('transfer_to_account_id, amount').eq('type', 'transfer');

    return accounts.map(acc => {
      const in1 = (incomeData ?? []).filter(t => t.account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0);
      const in2 = (transfersIn ?? []).filter(t => t.transfer_to_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0);
      const total_in = in1 + in2;

      const out1 = (expenseData ?? []).filter(t => t.account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0);
      const out2 = (transfersOut ?? []).filter(t => t.account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0);
      const total_out = out1 + out2;

      const current_balance = Number(acc.initial_balance) + total_in - total_out;

      return {
        ...acc,
        current_balance,
        total_in,
        total_out,
      };
    });
  }
};
