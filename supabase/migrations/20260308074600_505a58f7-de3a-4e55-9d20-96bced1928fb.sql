-- Create vehicle_mileage table
CREATE TABLE IF NOT EXISTS public.vehicle_mileage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  km_total numeric NOT NULL DEFAULT 0,
  fuel_cost numeric NOT NULL DEFAULT 0,
  cost_per_km numeric GENERATED ALWAYS AS (
    CASE WHEN km_total > 0 THEN fuel_cost / km_total ELSE NULL END
  ) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month_year)
);

ALTER TABLE public.vehicle_mileage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view vehicle_mileage" ON public.vehicle_mileage;
CREATE POLICY "Authenticated can view vehicle_mileage"
  ON public.vehicle_mileage FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin/operations can manage vehicle_mileage" ON public.vehicle_mileage;
CREATE POLICY "Admin/operations can manage vehicle_mileage"
  ON public.vehicle_mileage FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), _const_role_admin()) OR
    has_role(auth.uid(), _const_role_operations())
  )
  WITH CHECK (
    has_role(auth.uid(), _const_role_admin()) OR
    has_role(auth.uid(), _const_role_operations())
  );
