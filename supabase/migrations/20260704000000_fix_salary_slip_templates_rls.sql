-- Fix salary_slip_templates RLS: remove `true OR ...` bypass and loose auth.role() checks.
-- Environments that applied 20260606000007 before later fixes could expose templates to any user.

DROP POLICY IF EXISTS "unified_select_policy" ON public.salary_slip_templates;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.salary_slip_templates;
DROP POLICY IF EXISTS "unified_update_policy" ON public.salary_slip_templates;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.salary_slip_templates;

CREATE POLICY "unified_select_policy" ON public.salary_slip_templates FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)
    )
  );

CREATE POLICY "unified_insert_policy" ON public.salary_slip_templates FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)
    )
  );

CREATE POLICY "unified_update_policy" ON public.salary_slip_templates FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)
    )
  );

CREATE POLICY "unified_delete_policy" ON public.salary_slip_templates FOR DELETE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)
    )
  );

-- edge_rate_limits: same loose auth.role() pattern from 20260628130000
DROP POLICY IF EXISTS "unified_select_policy" ON public.edge_rate_limits;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.edge_rate_limits;
DROP POLICY IF EXISTS "unified_update_policy" ON public.edge_rate_limits;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.edge_rate_limits;

CREATE POLICY "unified_select_policy" ON public.edge_rate_limits FOR SELECT
  USING (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "unified_insert_policy" ON public.edge_rate_limits FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "unified_update_policy" ON public.edge_rate_limits FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "unified_delete_policy" ON public.edge_rate_limits FOR DELETE
  USING (
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::public.app_role)
  );
