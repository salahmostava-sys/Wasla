-- Compatibility shim for legacy functions still referencing jwt_company_id().
-- In single-organization mode this should not be used for filtering.
CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public /* NOSONAR */
AS $$
  SELECT NULL::uuid;
$$;
