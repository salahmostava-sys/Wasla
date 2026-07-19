CREATE TABLE IF NOT EXISTS public.attendance_status_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1', /* NOSONAR */
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_status_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users can read configs" ON public.attendance_status_configs;
CREATE POLICY "authenticated users can read configs"
  ON public.attendance_status_configs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin can manage configs" ON public.attendance_status_configs;
CREATE POLICY "admin can manage configs"
  ON public.attendance_status_configs FOR ALL
  TO authenticated USING (
    is_active_user(auth.uid()) AND has_role(auth.uid(), 'admin')
  );
