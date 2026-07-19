-- 20260703000001_treasury_accounts.sql
-- Create Treasury (Ø§Ù„Ø®Ø²ÙŠÙ†Ø©) tracking system: Accounts, Categories, Transactions

-- 1. treasury_accounts
CREATE TABLE IF NOT EXISTS public.treasury_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'custody')),
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view treasury_accounts" ON public.treasury_accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance/admin can manage treasury_accounts" ON public.treasury_accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 2. treasury_categories
CREATE TABLE IF NOT EXISTS public.treasury_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.treasury_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view treasury_categories" ON public.treasury_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance/admin can manage treasury_categories" ON public.treasury_categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 3. treasury_transactions
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.treasury_categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  attachment_url TEXT,
  transfer_to_account_id UUID REFERENCES public.treasury_accounts(id), -- Only used if type = 'transfer'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_date ON public.treasury_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_account ON public.treasury_transactions(account_id);

-- Check constraints for valid transactions
ALTER TABLE public.treasury_transactions 
ADD CONSTRAINT check_treasury_transaction_types 
CHECK (
  (type IN ('income', 'expense') AND category_id IS NOT NULL AND transfer_to_account_id IS NULL)
  OR 
  (type = 'transfer' AND category_id IS NULL AND transfer_to_account_id IS NOT NULL AND account_id != transfer_to_account_id)
);

-- RLS
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view treasury_transactions" ON public.treasury_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Finance/admin can manage treasury_transactions" ON public.treasury_transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Trigger to update 'updated_at'
CREATE TRIGGER treasury_accounts_updated_at BEFORE UPDATE ON public.treasury_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER treasury_categories_updated_at BEFORE UPDATE ON public.treasury_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER treasury_transactions_updated_at BEFORE UPDATE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some default basic categories
INSERT INTO public.treasury_categories (name, type) VALUES 
('Ø±ÙˆØ§ØªØ¨', 'expense'),
('ØªØ¬Ø¯ÙŠØ¯ Ø§Ø´ØªØ±Ø§ÙƒØ§Øª', 'expense'),
('Ø¨Ù†Ø²ÙŠÙ†', 'expense'),
('ØµÙŠØ§Ù†Ø© Ø³ÙŠØ§Ø±Ø§Øª', 'expense'),
('Ù…ØµØ±ÙˆÙØ§Øª Ù…ÙƒØªØ¨ÙŠØ©', 'expense'),
('Ø¥ÙŠØ±Ø§Ø¯Ø§Øª Ù…Ù†ØµØ§Øª', 'income'),
('Ø¥ÙŠØ±Ø§Ø¯Ø§Øª ÙƒØ§Ø´', 'income')
ON CONFLICT DO NOTHING;

-- Seed default accounts
INSERT INTO public.treasury_accounts (name, type) VALUES
('Ø¨Ù†Ùƒ Ø§Ù„Ø±Ø§Ø¬ØÙŠ', 'bank'),
('Ø¨Ù†Ùƒ Ø§Ù„Ø±ÙŠØ§Ø¶', 'bank'),
('Ø§Ù„ÙƒØ§Ø´', 'cash'),
('Ø¹Ù‡Ø¯Ø© Ø¹Ø¨Ø¯Ø§Ù„Ù„Ù‡', 'custody'),
('Ø¹Ù‡Ø¯Ø© Ø§Ù„Ù…Ø´Ø±ÙÙŠÙ†', 'custody')
ON CONFLICT DO NOTHING;
