-- supabase/migrations/20260628130000_fix_rls_policies_with_constants.sql
-- Fix: Replace nested SELECTs and _const_role_* references with literals

-- For salary_slip_templates
DROP POLICY IF EXISTS "unified_delete_policy" ON public."salary_slip_templates";
CREATE POLICY "unified_delete_policy" ON public."salary_slip_templates" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."salary_slip_templates";
CREATE POLICY "unified_insert_policy" ON public."salary_slip_templates" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_update_policy" ON public."salary_slip_templates";
CREATE POLICY "unified_update_policy" ON public."salary_slip_templates" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_select_policy" ON public."salary_slip_templates";
CREATE POLICY "unified_select_policy" ON public."salary_slip_templates" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );


-- For edge_rate_limits
DROP POLICY IF EXISTS "unified_delete_policy" ON public."edge_rate_limits";
CREATE POLICY "unified_delete_policy" ON public."edge_rate_limits" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."edge_rate_limits";
CREATE POLICY "unified_insert_policy" ON public."edge_rate_limits" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_update_policy" ON public."edge_rate_limits";
CREATE POLICY "unified_update_policy" ON public."edge_rate_limits" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_select_policy" ON public."edge_rate_limits";
CREATE POLICY "unified_select_policy" ON public."edge_rate_limits" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'operations'::public.app_role)))
  );


-- For finance_transactions
DROP POLICY IF EXISTS "unified_delete_policy" ON public."finance_transactions";
CREATE POLICY "unified_delete_policy" ON public."finance_transactions" FOR DELETE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."finance_transactions";
CREATE POLICY "unified_insert_policy" ON public."finance_transactions" FOR INSERT
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_update_policy" ON public."finance_transactions";
CREATE POLICY "unified_update_policy" ON public."finance_transactions" FOR UPDATE
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  )
  WITH CHECK (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

DROP POLICY IF EXISTS "unified_select_policy" ON public."finance_transactions";
CREATE POLICY "unified_select_policy" ON public."finance_transactions" FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text) OR
    (is_active_user(auth.uid()) AND
     (has_role(auth.uid(), 'admin'::public.app_role) OR
      has_role(auth.uid(), 'finance'::public.app_role)))
  );

NOTIFY pgrst, 'reload schema';
