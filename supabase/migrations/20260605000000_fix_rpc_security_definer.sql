-- ============================================================
-- FIX: Multiple user_roles rows causing wrong role resolution
--
-- Root cause: The original get_my_role() uses LIMIT 1 with no ORDER BY,
-- so when a user has both 'admin' and 'viewer' rows in user_roles,
-- PostgreSQL returns either row randomly â€” often returning 'viewer'
-- which hides all admin pages.
--
-- This migration:
-- 1. Replaces get_my_role() with a version that uses ORDER BY priority
--    (same as 20260505000000 but guaranteed to be applied)
-- 2. Removes duplicate lower-privilege rows so each user has exactly
--    one role (the highest one they have).
-- 3. Restores SECURITY DEFINER on dashboard RPCs that were broken.
-- ============================================================

-- â”€â”€ 1. Fix get_my_role() to return highest-privilege role â”€â”€â”€â”€
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

-- â”€â”€ 2. Remove duplicate lower-privilege rows in user_roles â”€â”€â”€
-- Keep only the highest-privilege role per user.
WITH ranked AS (
  SELECT
    id,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY CASE role
        WHEN 'admin'      THEN 1
        WHEN 'finance'    THEN 2
        WHEN 'hr'         THEN 3
        WHEN 'operations' THEN 4
        WHEN 'viewer'     THEN 5
        ELSE 99
      END
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- â”€â”€ 3. Restore SECURITY DEFINER on dashboard RPCs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- These were incorrectly changed to SECURITY INVOKER in a previous migration,
-- causing 'Not allowed' errors on the dashboard page.
ALTER FUNCTION public.performance_dashboard_rpc(text, date)
  SECURITY DEFINER
  SET search_path = public; /* NOSONAR */

ALTER FUNCTION public.rider_profile_performance_rpc(uuid, text, date)
  SECURITY DEFINER
  SET search_path = public; /* NOSONAR */

GRANT EXECUTE ON FUNCTION public.performance_dashboard_rpc(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_profile_performance_rpc(uuid, text, date) TO authenticated;
