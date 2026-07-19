-- ══════════════════════════════════════════════════════════════════════════════
-- Remove company_id from platform_accounts and account_assignments
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_sync_platform_accounts_company_id ON public.platform_accounts;
DROP TRIGGER IF EXISTS trg_sync_account_assignments_company_id ON public.account_assignments;

-- Drop functions
DROP FUNCTION IF EXISTS public.sync_platform_accounts_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_account_assignments_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.platform_account_in_my_company(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.assignment_in_my_company(uuid) CASCADE;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Platform accounts: select own company" ON public.platform_accounts;
DROP POLICY IF EXISTS "Platform accounts: manage own company" ON public.platform_accounts;
DROP POLICY IF EXISTS "Account assignments: select own company" ON public.account_assignments;
DROP POLICY IF EXISTS "Account assignments: insert own company" ON public.account_assignments;
DROP POLICY IF EXISTS "Account assignments: update own company" ON public.account_assignments;

-- Drop indexes
DROP INDEX IF EXISTS idx_platform_accounts_company_id;
DROP INDEX IF EXISTS idx_account_assignments_company_id;

-- Drop foreign key constraints
ALTER TABLE public.platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_company_id_fkey;
ALTER TABLE public.account_assignments DROP CONSTRAINT IF EXISTS account_assignments_company_id_fkey;

-- Drop columns
ALTER TABLE public.platform_accounts DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.account_assignments DROP COLUMN IF EXISTS company_id;

-- Recreate simple RLS policies without company_id
DROP POLICY IF EXISTS "platform_accounts_select" ON public.platform_accounts;
CREATE POLICY "platform_accounts_select"
  ON public.platform_accounts FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')    OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "platform_accounts_manage" ON public.platform_accounts;
CREATE POLICY "platform_accounts_manage"
  ON public.platform_accounts FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

DROP POLICY IF EXISTS "account_assignments_select" ON public.account_assignments;
CREATE POLICY "account_assignments_select"
  ON public.account_assignments FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')    OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "account_assignments_insert_update" ON public.account_assignments;
CREATE POLICY "account_assignments_insert_update"
  ON public.account_assignments FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

DROP POLICY IF EXISTS "account_assignments_update_only" ON public.account_assignments;
CREATE POLICY "account_assignments_update_only"
  ON public.account_assignments FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );
