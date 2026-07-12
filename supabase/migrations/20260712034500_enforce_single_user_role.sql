-- Enforce the application's one-role-per-user model.
--
-- The UI and backend treat user_roles as a single current role per user.
-- The existing UNIQUE (user_id, role) constraint allows multiple roles for the
-- same user, which makes role updates ambiguous. Current production data has no
-- duplicate user_id rows, so this narrows future writes without changing data.

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user_idx
  ON public.user_roles (user_id);
