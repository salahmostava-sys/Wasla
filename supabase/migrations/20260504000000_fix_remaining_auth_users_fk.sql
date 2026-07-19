-- Fix missing ON DELETE SET NULL for remaining auth.users references
-- that cause "Cannot delete user" errors due to foreign key constraints.

-- â”€â”€ account_assignments.created_by â”€â”€
ALTER TABLE public.account_assignments
  DROP CONSTRAINT IF EXISTS account_assignments_created_by_fkey;
ALTER TABLE public.account_assignments
  ADD CONSTRAINT account_assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- â”€â”€ finance_transactions.created_by â”€â”€
ALTER TABLE public.finance_transactions
  DROP CONSTRAINT IF EXISTS finance_transactions_created_by_fkey;
ALTER TABLE public.finance_transactions
  ADD CONSTRAINT finance_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
