-- Supervisor monthly targets + rider assignments (single-org safe).

BEGIN;

CREATE TABLE IF NOT EXISTS public.supervisor_employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supervisor_employee_assignments_dates_chk
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT supervisor_employee_assignments_unique_open UNIQUE (supervisor_id, employee_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_employee_assignments_supervisor
  ON public.supervisor_employee_assignments (supervisor_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_supervisor_employee_assignments_employee
  ON public.supervisor_employee_assignments (employee_id, start_date DESC);

ALTER TABLE public.supervisor_employee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view supervisor_employee_assignments" ON public.supervisor_employee_assignments;
CREATE POLICY "Active users can view supervisor_employee_assignments"
  ON public.supervisor_employee_assignments FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage supervisor_employee_assignments" ON public.supervisor_employee_assignments;
CREATE POLICY "Operations/admin can manage supervisor_employee_assignments"
  ON public.supervisor_employee_assignments FOR ALL
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'operations')
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'operations')
    )
  );

DROP TRIGGER IF EXISTS update_supervisor_employee_assignments_updated_at ON public.supervisor_employee_assignments;
CREATE TRIGGER update_supervisor_employee_assignments_updated_at
  BEFORE UPDATE ON public.supervisor_employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.supervisor_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  target_orders NUMERIC(10, 0) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supervisor_targets_month_fmt_chk CHECK (month_year ~ '^\d{4}-\d{2}$'),
  CONSTRAINT supervisor_targets_target_non_negative_chk CHECK (target_orders >= 0),
  CONSTRAINT supervisor_targets_unique UNIQUE (supervisor_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_targets_month ON public.supervisor_targets (month_year);

ALTER TABLE public.supervisor_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view supervisor_targets" ON public.supervisor_targets;
CREATE POLICY "Active users can view supervisor_targets"
  ON public.supervisor_targets FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage supervisor_targets" ON public.supervisor_targets;
CREATE POLICY "Operations/admin can manage supervisor_targets"
  ON public.supervisor_targets FOR ALL
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'operations')
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'operations')
    )
  );

DROP TRIGGER IF EXISTS update_supervisor_targets_updated_at ON public.supervisor_targets;
CREATE TRIGGER update_supervisor_targets_updated_at
  BEFORE UPDATE ON public.supervisor_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

NOTIFY pgrst, 'reload schema';
