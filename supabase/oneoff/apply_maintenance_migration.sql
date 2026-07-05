-- Fleet: spare parts inventory (single-org RLS aligned with vehicles / fuel)

BEGIN;

CREATE TABLE IF NOT EXISTS public.spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  part_number TEXT,
  stock_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_stock_alert NUMERIC(10, 2) DEFAULT 5,
  unit TEXT DEFAULT 'قطعة',
  unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view spare_parts" ON public.spare_parts;
CREATE POLICY "Active users can view spare_parts"
  ON public.spare_parts FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Admin/operations can manage spare_parts" ON public.spare_parts;
CREATE POLICY "Admin/operations can manage spare_parts"
  ON public.spare_parts FOR ALL
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

DROP TRIGGER IF EXISTS update_spare_parts_updated_at ON public.spare_parts;
CREATE TRIGGER update_spare_parts_updated_at
  BEFORE UPDATE ON public.spare_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
﻿-- Replace legacy maintenance_logs with fleet maintenance + line-item parts.
-- Preserves old rows in maintenance_logs_legacy_pre_fleet.

BEGIN;

DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Ops/admin can view maintenance_logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Authenticated can view maintenance_logs" ON public.maintenance_logs;

ALTER TABLE IF EXISTS public.maintenance_logs RENAME TO maintenance_logs_legacy_pre_fleet;

CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL
    CHECK (type IN (
      'غيار زيت', 'صيانة دورية', 'إطارات', 'بطارية', 'فرامل', 'أعطال', 'أخرى'
    )),
  odometer_reading NUMERIC(10, 0),
  total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'مكتملة'
    CHECK (status IN ('مكتملة', 'جارية', 'ملغاة')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_log_id UUID NOT NULL REFERENCES public.maintenance_logs(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE RESTRICT,
  quantity_used NUMERIC(10, 2) NOT NULL,
  cost_at_time NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_id ON public.maintenance_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_maintenance_date ON public.maintenance_logs(maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_parts_log_id ON public.maintenance_parts(maintenance_log_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_parts_part_id ON public.maintenance_parts(part_id);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view maintenance_logs" ON public.maintenance_logs;
CREATE POLICY "Active users can view maintenance_logs"
  ON public.maintenance_logs FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage maintenance_logs" ON public.maintenance_logs;
CREATE POLICY "Operations/admin can manage maintenance_logs"
  ON public.maintenance_logs FOR ALL
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

DROP POLICY IF EXISTS "Active users can view maintenance_parts" ON public.maintenance_parts;
CREATE POLICY "Active users can view maintenance_parts"
  ON public.maintenance_parts FOR SELECT
  TO authenticated
  USING (is_active_user(auth.uid()));

DROP POLICY IF EXISTS "Operations/admin can manage maintenance_parts" ON public.maintenance_parts;
CREATE POLICY "Operations/admin can manage maintenance_parts"
  ON public.maintenance_parts FOR ALL
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

DROP TRIGGER IF EXISTS update_maintenance_logs_updated_at ON public.maintenance_logs;
CREATE TRIGGER update_maintenance_logs_updated_at
  BEFORE UPDATE ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
-- Triggers: auto employee, stock deduct/restore, total_cost rollup

BEGIN;

CREATE OR REPLACE FUNCTION public.fill_maintenance_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_id IS NULL THEN
    SELECT va.employee_id INTO NEW.employee_id
    FROM public.vehicle_assignments va
    WHERE va.vehicle_id = NEW.vehicle_id
      AND va.returned_at IS NULL
    ORDER BY va.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_maintenance_employee ON public.maintenance_logs;
CREATE TRIGGER trg_fill_maintenance_employee
  BEFORE INSERT ON public.maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_maintenance_employee();

CREATE OR REPLACE FUNCTION public.deduct_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity - NEW.quantity_used,
      updated_at = now()
  WHERE sp.id = NEW.part_id;

  IF (SELECT sp2.stock_quantity FROM public.spare_parts sp2 WHERE sp2.id = NEW.part_id) < 0 THEN
    RAISE EXCEPTION 'المخزون غير كافٍ للقطعة المطلوبة';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_stock ON public.maintenance_parts;
CREATE TRIGGER trg_deduct_stock
  AFTER INSERT ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.deduct_spare_part_stock();

CREATE OR REPLACE FUNCTION public.restore_spare_part_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.spare_parts sp
  SET stock_quantity = sp.stock_quantity + OLD.quantity_used,
      updated_at = now()
  WHERE sp.id = OLD.part_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock ON public.maintenance_parts;
CREATE TRIGGER trg_restore_stock
  AFTER DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.restore_spare_part_stock();

CREATE OR REPLACE FUNCTION public.update_maintenance_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  log_id uuid;
BEGIN
  log_id := COALESCE(NEW.maintenance_log_id, OLD.maintenance_log_id);
  UPDATE public.maintenance_logs ml
  SET total_cost = (
      SELECT COALESCE(SUM(mp.quantity_used * mp.cost_at_time), 0)::numeric(10, 2)
      FROM public.maintenance_parts mp
      WHERE mp.maintenance_log_id = log_id
    ),
    updated_at = now()
  WHERE ml.id = log_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_total_cost ON public.maintenance_parts;
CREATE TRIGGER trg_update_total_cost
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_total_cost();

COMMIT;
-- إعادة تحميل كاش مخطط PostgREST
NOTIFY pgrst, 'reload schema';
