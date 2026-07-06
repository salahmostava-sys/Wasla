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

  getApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) handleSupabaseError(error, 'treasuryService.getApps');
    return data as { id: string; name: string }[];
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
    // FIX: paginate to bypass Supabase's default 1000-row limit.
    // Companies with 1000+ transactions in the selected range were
    // silently missing rows beyond row 1000.
    const PAGE_SIZE = 1000;
    const allRows: TreasuryTransaction[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('treasury_transactions')
        .select(`
          *,
          account:treasury_accounts!account_id(name),
          transfer_to_account:treasury_accounts!transfer_to_account_id(name),
          category:treasury_categories!category_id(name),
          app:apps!app_id(name)
        `)
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) handleSupabaseError(error, 'treasuryService.getTransactions');
      const rows = (data ?? []) as TreasuryTransaction[];
      allRows.push(...rows);
      hasMore = rows.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    return allRows;
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

  updateTransaction: async (id: string, input: Partial<TreasuryTransaction>) => {
    const { data, error } = await supabase
      .from('treasury_transactions')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'treasuryService.updateTransaction');
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

    // FIX: paginate to bypass Supabase's default 1000-row limit.
    // Any active company with 1000+ income/expense/transfer transactions
    // was silently getting under-computed balances (rows beyond 1000
    // were dropped with no error), since Supabase caps unbounded
    // .select() calls at 1000 rows unless .range() is used.
    const fetchAllRows = async <T>(column: 'account_id' | 'transfer_to_account_id', type: 'income' | 'expense' | 'transfer'): Promise<T[]> => {
      const PAGE_SIZE = 1000;
      const allRows: T[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('treasury_transactions')
          .select(`${column}, amount`)
          .eq('type', type)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) handleSupabaseError(error, 'treasuryService.getAccountBalances');
        const rows = (data ?? []) as T[];
        allRows.push(...rows);
        hasMore = rows.length === PAGE_SIZE;
        offset += PAGE_SIZE;
      }
      return allRows;
    };

    const [incomeData, expenseData, transfersOut, transfersIn] = await Promise.all([
      fetchAllRows<{ account_id: string; amount: number }>('account_id', 'income'),
      fetchAllRows<{ account_id: string; amount: number }>('account_id', 'expense'),
      fetchAllRows<{ account_id: string; amount: number }>('account_id', 'transfer'),
      fetchAllRows<{ transfer_to_account_id: string; amount: number }>('transfer_to_account_id', 'transfer'),
    ]);

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
