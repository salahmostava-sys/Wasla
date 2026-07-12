-- Remove duplicate RLS policies created by mistake (20260706 duplicated 20260705's fix).
-- Keeps the finance_transactions_*/treasury_*_* policies from 20260705 as the source of truth.

DROP POLICY IF EXISTS "unified_select_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_update_policy" ON public.finance_transactions;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.finance_transactions;

DROP POLICY IF EXISTS "unified_select_policy" ON public.treasury_accounts;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.treasury_accounts;
DROP POLICY IF EXISTS "unified_update_policy" ON public.treasury_accounts;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.treasury_accounts;

DROP POLICY IF EXISTS "unified_select_policy" ON public.treasury_categories;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.treasury_categories;
DROP POLICY IF EXISTS "unified_update_policy" ON public.treasury_categories;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.treasury_categories;

DROP POLICY IF EXISTS "unified_select_policy" ON public.treasury_transactions;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.treasury_transactions;
DROP POLICY IF EXISTS "unified_update_policy" ON public.treasury_transactions;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.treasury_transactions;

NOTIFY pgrst, 'reload schema';
