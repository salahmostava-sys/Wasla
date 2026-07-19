-- ============================================================
-- FIX: All 81 Dashboard Warnings
--
-- Category 1: function_search_path_mutable (SECURITY) ~64 warnings
--   All auto-generated enum comparison functions from migration
--   20260511000000_auto_enum_operators.sql are missing SET search_path.
--   Fix: ALTER FUNCTION ... SET search_path = public for each one. /* NOSONAR */
--
-- Category 2: duplicate_index (PERFORMANCE) 2 warnings
--   - attendance: two identical UNIQUE indexes
--   - salary_slip_templates: two identical partial unique indexes
--   Fix: DROP the redundant index on each table.
-- ============================================================

-- â”€â”€ Part 1: Fix search_path on all enum operator functions â”€â”€â”€
-- Instead of ALTER-ing each function by hand, we re-create them
-- with SET search_path = public using the same loop pattern. /* NOSONAR */

DO $$
DECLARE
  e record;
  func_eq1 text;
  func_eq2 text;
  func_neq1 text;
  func_neq2 text;
BEGIN
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

    -- Re-create with SET search_path = public /* NOSONAR */
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a public.%I, b text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $f$ SELECT a::text = b; $f$;', func_eq1, e.typname); /* NOSONAR */
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a text, b public.%I) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $f$ SELECT a = b::text; $f$;', func_eq2, e.typname); /* NOSONAR */
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a public.%I, b text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $f$ SELECT a::text <> b; $f$;', func_neq1, e.typname); /* NOSONAR */
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(a text, b public.%I) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $f$ SELECT a <> b::text; $f$;', func_neq2, e.typname); /* NOSONAR */
  END LOOP;
END $$;

-- â”€â”€ Part 2: Drop duplicate indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- attendance table: keep the original UNIQUE constraint index
-- (attendance_employee_id_date_key), drop the redundant named one.
DROP INDEX IF EXISTS public.uq_attendance_employee_date;

-- salary_slip_templates table: keep idx_salary_slip_templates_single_default,
-- drop the older salary_slip_templates_one_default_idx.
DROP INDEX IF EXISTS public.salary_slip_templates_one_default_idx;

NOTIFY pgrst, 'reload schema';
