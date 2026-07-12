-- Migration: Auto-generate text comparison operators for all ENUMs
-- Fixes "operator does not exist: enum_type = text" errors permanently

DO $$
DECLARE
  e record;
  func_eq1 text;
  func_eq2 text;
  func_neq1 text;
  func_neq2 text;
BEGIN
  -- Iterate through all ENUM types in the public schema
  FOR e IN 
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND n.nspname = 'public'
  LOOP
    func_eq1 := 'eq_' || e.typname || '_text';
    func_eq2 := 'eq_text_' || e.typname;
    func_neq1 := 'neq_' || e.typname || '_text';
    func_neq2 := 'neq_text_' || e.typname;

    -- Create Equality Functions
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a public.%I, b text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $f$ SELECT a::text = b; $f$;', func_eq1, e.typname);
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a text, b public.%I) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $f$ SELECT a = b::text; $f$;', func_eq2, e.typname);
    
    -- Create Inequality Functions
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a public.%I, b text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $f$ SELECT a::text <> b; $f$;', func_neq1, e.typname);
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a text, b public.%I) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $f$ SELECT a <> b::text; $f$;', func_neq2, e.typname);

    -- Create Equality Operators
    EXECUTE format('DROP OPERATOR IF EXISTS public.= (public.%I, text)', e.typname);
    EXECUTE format('CREATE OPERATOR public.= (LEFTARG = public.%I, RIGHTARG = text, PROCEDURE = public.%I, COMMUTATOR = ''='')', e.typname, func_eq1);
    EXECUTE format('DROP OPERATOR IF EXISTS public.= (text, public.%I)', e.typname);
    EXECUTE format('CREATE OPERATOR public.= (LEFTARG = text, RIGHTARG = public.%I, PROCEDURE = public.%I, COMMUTATOR = ''='')', e.typname, func_eq2);

    -- Create Inequality Operators
    EXECUTE format('DROP OPERATOR IF EXISTS public.<> (public.%I, text)', e.typname);
    EXECUTE format('CREATE OPERATOR public.<> (LEFTARG = public.%I, RIGHTARG = text, PROCEDURE = public.%I, COMMUTATOR = ''<>'')', e.typname, func_neq1);
    EXECUTE format('DROP OPERATOR IF EXISTS public.<> (text, public.%I)', e.typname);
    EXECUTE format('CREATE OPERATOR public.<> (LEFTARG = text, RIGHTARG = public.%I, PROCEDURE = public.%I, COMMUTATOR = ''<>'')', e.typname, func_neq2);
  END LOOP;
END $$;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
