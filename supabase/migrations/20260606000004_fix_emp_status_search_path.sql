-- ============================================================
-- FIX: Remaining 4 function_search_path_mutable warnings
--
-- Functions eq_emp_status_text / neq_emp_status_text (short names for
-- employee_status operators) were created manually in an earlier migration
-- with abbreviated names and were not caught by the auto-generation loop
-- in 20260606000003 (which generates eq_employee_status_text variants).
-- ============================================================

CREATE OR REPLACE FUNCTION public.eq_emp_status_text(a public.employee_status, b text)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public /* NOSONAR */
AS $$ SELECT a::text = b; $$;

CREATE OR REPLACE FUNCTION public.eq_text_emp_status(a text, b public.employee_status)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public /* NOSONAR */
AS $$ SELECT a = b::text; $$;

CREATE OR REPLACE FUNCTION public.neq_emp_status_text(a public.employee_status, b text)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public /* NOSONAR */
AS $$ SELECT a::text <> b; $$;

CREATE OR REPLACE FUNCTION public.neq_text_emp_status(a text, b public.employee_status)
  RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
  SET search_path = public /* NOSONAR */
AS $$ SELECT a <> b::text; $$;

NOTIFY pgrst, 'reload schema';
