-- ============================================================
-- FIX: Infinite recursion in _const_role_* functions
-- ============================================================
-- Bug: The five _const_role_* functions defined in migration
-- 20260226083236 have bodies that call *themselves* instead of
-- returning a literal enum value, causing PostgreSQL error 54001
-- ("stack depth limit exceeded") whenever any RLS policy that
-- uses has_role(..., _const_role_admin()) etc. is evaluated.
--
-- Fix: Replace the bodies with a simple RETURN '<literal>';

CREATE OR REPLACE FUNCTION public._const_role_admin()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'admin'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_hr()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'hr'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_finance()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'finance'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_operations()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'operations'::public.app_role; $$;

CREATE OR REPLACE FUNCTION public._const_role_viewer()
  RETURNS public.app_role
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  SET search_path TO public
AS $$ SELECT 'viewer'::public.app_role; $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
