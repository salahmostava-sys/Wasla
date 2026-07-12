-- Return highest-privilege role deterministically for multi-role users.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin'      THEN 1
    WHEN 'finance'    THEN 2
    WHEN 'hr'         THEN 3
    WHEN 'operations' THEN 4
    WHEN 'viewer'     THEN 5
    ELSE 99
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
