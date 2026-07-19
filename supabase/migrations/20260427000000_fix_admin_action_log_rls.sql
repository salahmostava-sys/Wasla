-- Fix: admin_action_log INSERT was blocked for non-admin roles because
-- has_permission('audit', 'write') is not granted to hr/finance/operations.
-- Audit logging must succeed for ALL active internal users â€” it is a
-- secondary side-effect that should never block a user's primary action.
--
-- Change: replace has_permission('audit', 'write') with is_internal_user()
-- on the INSERT policy only. The SELECT policy is unchanged (still requires
-- has_permission('audit', 'view') so only privileged roles can read the log).

DROP POLICY IF EXISTS admin_action_log_insert_policy ON public.admin_action_log;
DROP POLICY IF EXISTS "Admin actions: insert"          ON public.admin_action_log;

CREATE POLICY admin_action_log_insert_policy
  ON public.admin_action_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user()
    AND user_id IS NOT DISTINCT FROM auth.uid()
  );
