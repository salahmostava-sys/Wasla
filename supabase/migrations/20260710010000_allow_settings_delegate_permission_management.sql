-- Allow non-admin users who were granted "settings" edit access (via the
-- user_permissions matrix) to manage other users' roles/permissions too.
-- Previously this was hardcoded to has_role(auth.uid(), 'admin'), so an
-- admin could never delegate "user & permissions management" to anyone else.
--
-- Rule: has_role(admin) OR (own user_permissions row has permission_key='settings'
-- and can_edit=true). The self-row check is always readable regardless of role
-- because the SELECT policy on user_permissions already grants a user access to
-- their own row (auth.uid() = user_id), so this does not recurse.

CREATE OR REPLACE FUNCTION public.has_settings_management_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public /* NOSONAR */
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.permission_key = 'settings'
        AND up.can_edit = true
    );
$$;

REVOKE ALL ON FUNCTION public.has_settings_management_access() FROM public;
GRANT EXECUTE ON FUNCTION public.has_settings_management_access() TO authenticated;

-- user_permissions: let a settings-delegate grant/revoke custom permissions for anyone.
DROP POLICY IF EXISTS "unified_select_policy" ON public."user_permissions";
CREATE POLICY "unified_select_policy" ON public."user_permissions" FOR SELECT
  USING ( (auth.uid() = user_id) OR public.has_settings_management_access() );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."user_permissions";
CREATE POLICY "unified_insert_policy" ON public."user_permissions" FOR INSERT
  WITH CHECK ( is_active_user(auth.uid()) AND public.has_settings_management_access() );

DROP POLICY IF EXISTS "unified_update_policy" ON public."user_permissions";
CREATE POLICY "unified_update_policy" ON public."user_permissions" FOR UPDATE
  USING ( is_active_user(auth.uid()) AND public.has_settings_management_access() )
  WITH CHECK ( is_active_user(auth.uid()) AND public.has_settings_management_access() );

DROP POLICY IF EXISTS "unified_delete_policy" ON public."user_permissions";
CREATE POLICY "unified_delete_policy" ON public."user_permissions" FOR DELETE
  USING ( is_active_user(auth.uid()) AND public.has_settings_management_access() );

-- user_roles: let a settings-delegate view/assign the base role dropdown for anyone.
DROP POLICY IF EXISTS "unified_select_policy" ON public."user_roles";
CREATE POLICY "unified_select_policy" ON public."user_roles" FOR SELECT
  USING ( (auth.uid() = user_id) OR public.has_settings_management_access() );

DROP POLICY IF EXISTS "unified_insert_policy" ON public."user_roles";
CREATE POLICY "unified_insert_policy" ON public."user_roles" FOR INSERT
  WITH CHECK ( public.has_settings_management_access() );

DROP POLICY IF EXISTS "unified_update_policy" ON public."user_roles";
CREATE POLICY "unified_update_policy" ON public."user_roles" FOR UPDATE
  USING ( public.has_settings_management_access() )
  WITH CHECK ( public.has_settings_management_access() );
