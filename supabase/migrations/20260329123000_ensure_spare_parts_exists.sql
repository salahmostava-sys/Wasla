-- Ensure fleet spare parts table exists on environments that missed prior migration.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).

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

DROP TRIGGER IF EXISTS update_spare_parts_updated_at ON public.spare_parts;
CREATE TRIGGER update_spare_parts_updated_at
  BEFORE UPDATE ON public.spare_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

NOTIFY pgrst, 'reload schema';
