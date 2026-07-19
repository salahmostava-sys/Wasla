-- Enable RLS on edge_rate_limits as defense-in-depth.
-- Table privileges already REVOKE from anon/authenticated;
-- this adds RLS so even if grants change, rows stay protected.
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service_role (Edge Functions) can access rows.
DROP POLICY IF EXISTS "service_role_full_access" ON public.edge_rate_limits;
CREATE POLICY "service_role_full_access" ON public.edge_rate_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
