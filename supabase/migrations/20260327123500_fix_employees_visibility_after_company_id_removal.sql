-- Ensure employees remain visible/editable after full company_id removal.
-- Rebuild employees RLS policies explicitly in single-org mode.

BEGIN;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin/finance/ops can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role scoped select employees" ON public.employees;
DROP POLICY IF EXISTS "HR admin manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees: select own company" ON public.employees;
DROP POLICY IF EXISTS "Employees: insert" ON public.employees;
DROP POLICY IF EXISTS "Employees: update" ON public.employees;
DROP POLICY IF EXISTS "Employees: delete" ON public.employees;
DROP POLICY IF EXISTS employees_select_policy ON public.employees;
DROP POLICY IF EXISTS employees_insert_policy ON public.employees;
DROP POLICY IF EXISTS employees_update_policy ON public.employees;
DROP POLICY IF EXISTS employees_delete_policy ON public.employees;

CREATE POLICY employees_select_policy
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees' /* NOSONAR */, 'view' /* NOSONAR */)
);

CREATE POLICY employees_insert_policy
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_internal_user()
  AND public.has_permission('employees' /* NOSONAR */, 'write' /* NOSONAR */)
);

CREATE POLICY employees_update_policy
ON public.employees
FOR UPDATE
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees' /* NOSONAR */, 'write' /* NOSONAR */)
)
WITH CHECK (
  public.is_internal_user()
  AND public.has_permission('employees' /* NOSONAR */, 'write' /* NOSONAR */)
);

CREATE POLICY employees_delete_policy
ON public.employees
FOR DELETE
TO authenticated
USING (
  public.is_internal_user()
  AND public.has_permission('employees' /* NOSONAR */, 'delete')
);

COMMIT;

