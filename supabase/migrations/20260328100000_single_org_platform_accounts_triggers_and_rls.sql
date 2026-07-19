-- Single-organization: remove platform_accounts / account_assignments sync triggers
-- that still referenced employees.company_id and dropped tenant columns.
-- Rebuild RLS and SECURITY DEFINER helpers without company_id / jwt_company_id.

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Drop legacy BEFORE INSERT/UPDATE triggers (fail with "e.company_id does not exist")
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_platform_accounts_company_id ON public.platform_accounts;
DROP TRIGGER IF EXISTS trg_sync_account_assignments_company_id ON public.account_assignments;

DROP FUNCTION IF EXISTS public.sync_platform_accounts_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_account_assignments_company_id() CASCADE;

-- Phase 1 / finalize dropped company_id from platform_accounts but not account_assignments.
ALTER TABLE IF EXISTS public.account_assignments DROP COLUMN IF EXISTS company_id CASCADE;

-- --------------------------------------------------------------------------
-- 2) Tenant helpers: existence only (single org)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_account_in_my_company(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_accounts pa
    WHERE pa.id = _account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.assignment_in_my_company(_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_assignments aa
    WHERE aa.id = _assignment_id
  );
$$;

-- --------------------------------------------------------------------------
-- 3) RLS: platform_accounts
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform accounts: select own company" ON public.platform_accounts;
DROP POLICY IF EXISTS "Platform accounts: manage own company" ON public.platform_accounts;
DROP POLICY IF EXISTS "platform_accounts_select" ON public.platform_accounts;
DROP POLICY IF EXISTS "platform_accounts_manage" ON public.platform_accounts;
DROP POLICY IF EXISTS "Active users can view platform_accounts" ON public.platform_accounts;
DROP POLICY IF EXISTS "Admin/operations can manage platform_accounts" ON public.platform_accounts;

DROP POLICY IF EXISTS "Platform accounts: select own company" ON public.platform_accounts;
CREATE POLICY "Platform accounts: select own company"
ON public.platform_accounts
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'operations')
    OR has_role(auth.uid(), 'finance')
  )
);

DROP POLICY IF EXISTS "Platform accounts: manage own company" ON public.platform_accounts;
CREATE POLICY "Platform accounts: manage own company"
ON public.platform_accounts
FOR ALL
TO authenticated
USING (
  is_active_user(auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
  )
);

-- --------------------------------------------------------------------------
-- 4) RLS: account_assignments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Account assignments: select own company" ON public.account_assignments;
DROP POLICY IF EXISTS "Account assignments: insert own company" ON public.account_assignments;
DROP POLICY IF EXISTS "Account assignments: update own company" ON public.account_assignments;
DROP POLICY IF EXISTS "account_assignments_select" ON public.account_assignments;
DROP POLICY IF EXISTS "account_assignments_insert_update" ON public.account_assignments;
DROP POLICY IF EXISTS "account_assignments_update_only" ON public.account_assignments;
DROP POLICY IF EXISTS "Active users can view account_assignments" ON public.account_assignments;
DROP POLICY IF EXISTS "Admin/operations can manage account_assignments" ON public.account_assignments;

DROP POLICY IF EXISTS "Account assignments: select own company" ON public.account_assignments;
CREATE POLICY "Account assignments: select own company"
ON public.account_assignments
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
    OR has_role(auth.uid(), 'operations')
    OR has_role(auth.uid(), 'finance')
  )
);

DROP POLICY IF EXISTS "Account assignments: insert own company" ON public.account_assignments;
CREATE POLICY "Account assignments: insert own company"
ON public.account_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND public.platform_account_in_my_company(account_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
  )
);

DROP POLICY IF EXISTS "Account assignments: update own company" ON public.account_assignments;
CREATE POLICY "Account assignments: update own company"
ON public.account_assignments
FOR UPDATE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.assignment_in_my_company(id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND public.platform_account_in_my_company(account_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'hr')
  )
);

COMMIT;
