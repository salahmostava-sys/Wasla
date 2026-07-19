-- ============================================================
-- Security hardening (aligns with automated scan findings)
-- 1) Do not auto-assign "viewer" on signup — admin assigns role after activation.
-- 2) Remove viewer from employees SELECT — viewer must not read full employee PII via API.
-- ============================================================
--
-- 1) New users: no default role row (admin assigns role when activating the account).
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 2) Tighten employees SELECT: admin, hr, operations, finance only (no viewer).
DROP POLICY IF EXISTS "Role scoped select employees" ON public.employees;

CREATE POLICY "Role scoped select employees"
  ON public.employees FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'hr') OR
      has_role(auth.uid(), 'operations') OR
      has_role(auth.uid(), 'finance')
    )
  );

