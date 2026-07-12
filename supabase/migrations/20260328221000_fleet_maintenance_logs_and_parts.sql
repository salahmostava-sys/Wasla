-- Replace legacy maintenance_logs with fleet maintenance + line-item parts. -- NOSONAR
-- Preserves old rows in maintenance_logs_legacy_pre_fleet. -- NOSONAR

BEGIN;

DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs; -- NOSONAR
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs; -- NOSONAR
DROP POLICY IF EXISTS "Ops/admin can view maintenance_logs" ON public.maintenance_logs; -- NOSONAR
DROP POLICY IF EXISTS "Authenticated can view maintenance_logs" ON public.maintenance_logs; -- NOSONAR

-- Idempotent rename: only rename the legacy table if it is still the old
-- (pre-fleet) schema, i.e. it doesn't yet have the new odometer_reading
-- column, and a legacy backup doesn't already exist. This allows the script
-- to be safely re-run without renaming the wrong relation or erroring out.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'maintenance_logs' -- NOSONAR
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'maintenance_logs' AND column_name = 'odometer_reading' -- NOSONAR
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'maintenance_logs_legacy_pre_fleet' -- NOSONAR
  ) THEN
    ALTER TABLE public.maintenance_logs RENAME TO maintenance_logs_legacy_pre_fleet; -- NOSONAR
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.maintenance_logs ( -- NOSONAR
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL
    CHECK (type IN ( /* NOSONAR */
      '???? ???', '????? ?????', '??????', '??????', '?????', '?????', '????' /* NOSONAR */
    )), /* NOSONAR */
  odometer_reading NUMERIC(10, 0),
  total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '??????'
    CHECK (status IN ('??????', '?????', '?????')), /* NOSONAR */
  notes TEXT, /* NOSONAR */
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_parts ( -- NOSONAR
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_log_id UUID NOT NULL REFERENCES public.maintenance_logs(id) ON DELETE CASCADE, -- NOSONAR
  part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
  quantity_used NUMERIC(10, 2) NOT NULL,
  cost_at_time NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_id ON public.maintenance_logs(vehicle_id); -- NOSONAR
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_maintenance_date ON public.maintenance_logs(maintenance_date DESC); -- NOSONAR
CREATE INDEX IF NOT EXISTS idx_maintenance_parts_log_id ON public.maintenance_parts(maintenance_log_id); -- NOSONAR
CREATE INDEX IF NOT EXISTS idx_maintenance_parts_part_id ON public.maintenance_parts(part_id); -- NOSONAR

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY; -- NOSONAR
ALTER TABLE public.maintenance_parts ENABLE ROW LEVEL SECURITY; -- NOSONAR

DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs; -- NOSONAR
CREATE POLICY "Active users can view maintenance_logs" -- NOSONAR
  ON public.maintenance_logs FOR SELECT -- NOSONAR
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs; -- NOSONAR
CREATE POLICY "Operations/admin can manage maintenance_logs" -- NOSONAR
  ON public.maintenance_logs FOR ALL -- NOSONAR
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), _const_role_admin()) OR
      has_role(auth.uid(), _const_role_operations())
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), _const_role_admin()) OR
      has_role(auth.uid(), _const_role_operations())
    )
  );

DROP POLICY IF EXISTS "Active users can view maintenance_parts" ON public.maintenance_parts; -- NOSONAR
CREATE POLICY "Active users can view maintenance_parts" -- NOSONAR
  ON public.maintenance_parts FOR SELECT -- NOSONAR
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage maintenance_parts" ON public.maintenance_parts; -- NOSONAR
CREATE POLICY "Operations/admin can manage maintenance_parts" -- NOSONAR
  ON public.maintenance_parts FOR ALL -- NOSONAR
  TO authenticated
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), _const_role_admin()) OR
      has_role(auth.uid(), _const_role_operations())
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), _const_role_admin()) OR
      has_role(auth.uid(), _const_role_operations())
    )
  );

DROP TRIGGER IF EXISTS update_maintenance_logs_updated_at ON public.maintenance_logs; -- NOSONAR
CREATE TRIGGER update_maintenance_logs_updated_at -- NOSONAR
  BEFORE UPDATE ON public.maintenance_logs -- NOSONAR
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
