export type TreasuryAccountType = 'bank' | 'cash' | 'custody';
export type TreasuryCategoryType = 'expense' | 'income';
export type TreasuryTransactionType = 'income' | 'expense' | 'transfer';

export interface TreasuryAccount {
  id: string;
  name: string;
  type: TreasuryAccountType;
  initial_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface TreasuryCategory {
  id: string;
  name: string;
  type: TreasuryCategoryType;
  is_active: boolean;
  created_at: string;
}

export interface TreasuryTransaction {
  id: string;
  transaction_date: string;
  account_id: string;
  category_id: string | null;
  type: TreasuryTransactionType;
  amount: number;
  description: string | null;
  attachment_url: string | null;
  transfer_to_account_id: string | null;
  app_id: string | null;
  created_by: string | null;
  created_at: string;
  
  // Joined fields for display
  account?: { name: string };
  transfer_to_account?: { name: string };
  category?: { name: string };
  app?: { name: string };
}

export interface TreasuryAccountBalance extends TreasuryAccount {
  current_balance: number;
  total_in: number;
  total_out: number;
}
