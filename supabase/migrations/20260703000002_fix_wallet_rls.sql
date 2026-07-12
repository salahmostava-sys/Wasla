-- Fix RLS security on employee_wallet_transactions
-- Replace the overly-permissive auth.role() = 'authenticated' OR ... pattern
-- with strict role-based access: only admin/finance with active user status

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "unified_select_policy" ON public.employee_wallet_transactions;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.employee_wallet_transactions;
DROP POLICY IF EXISTS "unified_update_policy" ON public.employee_wallet_transactions;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.employee_wallet_transactions;

-- Re-create with correct strict RLS
CREATE POLICY "wallet_select_policy" ON public.employee_wallet_transactions FOR SELECT
  USING (
    is_active_user(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::public.app_role) OR
     has_role(auth.uid(), 'finance'::public.app_role))
  );

CREATE POLICY "wallet_insert_policy" ON public.employee_wallet_transactions FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::public.app_role) OR
     has_role(auth.uid(), 'finance'::public.app_role))
  );

CREATE POLICY "wallet_update_policy" ON public.employee_wallet_transactions FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::public.app_role) OR
     has_role(auth.uid(), 'finance'::public.app_role))
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::public.app_role) OR
     has_role(auth.uid(), 'finance'::public.app_role))
  );

CREATE POLICY "wallet_delete_policy" ON public.employee_wallet_transactions FOR DELETE
  USING (
    is_active_user(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::public.app_role) OR
     has_role(auth.uid(), 'finance'::public.app_role))
  );
