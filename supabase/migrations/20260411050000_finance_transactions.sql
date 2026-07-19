-- Finance transactions: revenues and expenses tracking
-- Salaries auto-feed as expenses each month

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense')),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  month_year TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_auto BOOLEAN NOT NULL DEFAULT false,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_month ON public.finance_transactions(month_year);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type ON public.finance_transactions(type);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON public.finance_transactions(date);

-- RLS
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view finance_transactions" ON public.finance_transactions;
CREATE POLICY "Authenticated users can view finance_transactions"
  ON public.finance_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Finance/admin can manage finance_transactions" ON public.finance_transactions;
CREATE POLICY "Finance/admin can manage finance_transactions"
  ON public.finance_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Updated_at trigger
DROP TRIGGER IF EXISTS finance_transactions_updated_at ON public.finance_transactions;
CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
