-- RLS hardening for core payroll-related tables
-- Scope: employees, attendance, salary_records

-- ============================================================================
-- employees
-- ============================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;

DROP POLICY IF EXISTS "Role scoped select employees" ON public.employees;
CREATE POLICY "Role scoped select employees"
  ON public.employees FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr') OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance') OR
      has_role(auth.uid(), 'viewer')
    )
  );

DROP POLICY IF EXISTS "HR admin manage employees" ON public.employees;
CREATE POLICY "HR admin manage employees"
  ON public.employees FOR ALL
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

-- ============================================================================
-- attendance
-- ============================================================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR/admin can manage attendance" ON public.attendance;

DROP POLICY IF EXISTS "Role scoped select attendance" ON public.attendance;
CREATE POLICY "Role scoped select attendance"
  ON public.attendance FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr') OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "HR admin insert attendance" ON public.attendance;
CREATE POLICY "HR admin insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

DROP POLICY IF EXISTS "HR admin update attendance" ON public.attendance;
CREATE POLICY "HR admin update attendance"
  ON public.attendance FOR UPDATE
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

DROP POLICY IF EXISTS "HR admin delete attendance" ON public.attendance;
CREATE POLICY "HR admin delete attendance"
  ON public.attendance FOR DELETE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr')
    )
  );

-- ============================================================================
-- salary_records
-- ============================================================================
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance/admin can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;

DROP POLICY IF EXISTS "Finance admin select salary_records" ON public.salary_records;
CREATE POLICY "Finance admin select salary_records"
  ON public.salary_records FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'finance')
    )
  );

DROP POLICY IF EXISTS "Finance admin manage salary_records" ON public.salary_records;
CREATE POLICY "Finance admin manage salary_records"
  ON public.salary_records FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'finance')
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'finance')
    )
  );
