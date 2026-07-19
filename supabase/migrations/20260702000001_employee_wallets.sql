-- Migration for Employee Wallet Transactions

CREATE TABLE IF NOT EXISTS public.employee_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('collection', 'deposit')),
    amount NUMERIC(10,2) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Unified Policies
CREATE POLICY "unified_select_policy" ON public.employee_wallet_transactions FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_insert_policy" ON public.employee_wallet_transactions FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_update_policy" ON public.employee_wallet_transactions FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  )
  WITH CHECK (
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

CREATE POLICY "unified_delete_policy" ON public.employee_wallet_transactions FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

-- Create a view for wallet balances
CREATE OR REPLACE VIEW public.employee_wallet_balances WITH (security_invoker=on) AS
SELECT 
    e.id AS employee_id,
    e.name AS employee_name,
    e.status AS employee_status,
    COALESCE(SUM(
        CASE 
            WHEN t.transaction_type = 'collection' THEN t.amount
            WHEN t.transaction_type = 'deposit' THEN -t.amount
            ELSE 0 
        END
    ), 0) AS balance
FROM 
    public.employees e
LEFT JOIN 
    public.employee_wallet_transactions t ON e.id = t.employee_id
GROUP BY 
    e.id, e.name, e.status;

GRANT SELECT ON public.employee_wallet_balances TO authenticated;
