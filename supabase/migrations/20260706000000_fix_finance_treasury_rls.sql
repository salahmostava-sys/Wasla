-- Fix critical RLS bypass on financial tables.
-- Same class of bug already fixed for employee_wallet_transactions
-- (20260703000002) and salary_slip_templates/edge_rate_limits (20260704000000):
-- policies contained `auth.role() = 'authenticated' OR (...)`, which lets
-- ANY authenticated user (any role) bypass the intended admin/finance-only
-- restriction on FOR ALL (select/insert/update/delete).

BEGIN;

-- finance_transactions
DROP POLICY IF EXISTS "Authenticated users can view finance_transactions" ON public.finance_transactions;
DROP POLICY IF EXISTS "Finance/admin can manage finance_transactions" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_select_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_update_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.finance_transactions;

CREATE POLICY "unified_select_policy" ON public.finance_transactions FOR SELECT
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_insert_policy" ON public.finance_transactions FOR INSERT
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_update_policy" ON public.finance_transactions FOR UPDATE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')))
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_delete_policy" ON public.finance_transactions FOR DELETE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));

-- treasury_accounts
DROP POLICY IF EXISTS "Authenticated users can view treasury_accounts" ON public.treasury_accounts;
DROP POLICY IF EXISTS "Finance/admin can manage treasury_accounts" ON public.treasury_accounts;

CREATE POLICY "unified_select_policy" ON public.treasury_accounts FOR SELECT
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_insert_policy" ON public.treasury_accounts FOR INSERT
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_update_policy" ON public.treasury_accounts FOR UPDATE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')))
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_delete_policy" ON public.treasury_accounts FOR DELETE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));

-- treasury_categories
DROP POLICY IF EXISTS "Authenticated users can view treasury_categories" ON public.treasury_categories;
DROP POLICY IF EXISTS "Finance/admin can manage treasury_categories" ON public.treasury_categories;

CREATE POLICY "unified_select_policy" ON public.treasury_categories FOR SELECT
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_insert_policy" ON public.treasury_categories FOR INSERT
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_update_policy" ON public.treasury_categories FOR UPDATE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')))
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_delete_policy" ON public.treasury_categories FOR DELETE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));

-- treasury_transactions
DROP POLICY IF EXISTS "Authenticated users can view treasury_transactions" ON public.treasury_transactions;
DROP POLICY IF EXISTS "Finance/admin can manage treasury_transactions" ON public.treasury_transactions;

CREATE POLICY "unified_select_policy" ON public.treasury_transactions FOR SELECT
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_insert_policy" ON public.treasury_transactions FOR INSERT
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_update_policy" ON public.treasury_transactions FOR UPDATE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')))
  WITH CHECK (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));
CREATE POLICY "unified_delete_policy" ON public.treasury_transactions FOR DELETE
  USING (is_internal_user() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'finance')));

COMMIT;
