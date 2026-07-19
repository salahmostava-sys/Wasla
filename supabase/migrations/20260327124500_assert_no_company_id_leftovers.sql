-- Guardrail assertions: fail migration if any company_id leftovers still exist.
-- This helps keep single-organization mode clean across future changes.

DO $$
DECLARE
  v_count integer;
  v_sample text;
BEGIN
  -- 1) No company_id columns in public schema.
  SELECT COUNT(*)::int
  INTO v_count
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' /* NOSONAR */
    AND lower(c.column_name) = 'company_id'; -- NOSONAR

  IF v_count > 0 THEN
    SELECT string_agg(format('%I.%I', c.table_schema, c.table_name), ', ' ORDER BY c.table_name)
    INTO v_sample
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' /* NOSONAR */
      AND lower(c.column_name) = 'company_id'; -- NOSONAR

    RAISE EXCEPTION 'Assertion failed: company_id columns still exist (%): %', v_count, COALESCE(v_sample, 'n/a');
  END IF;

  -- 2) No constraints with company_id in their definition.
  SELECT COUNT(*)::int
  INTO v_count
  FROM pg_constraint pc
  JOIN pg_class tbl ON tbl.oid = pc.conrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public' /* NOSONAR */
    AND pg_get_constraintdef(pc.oid) ILIKE '%company_id%';

  IF v_count > 0 THEN
    SELECT string_agg(format('%I.%I (%s)', ns.nspname, tbl.relname, pc.conname), ', ' ORDER BY tbl.relname, pc.conname)
    INTO v_sample
    FROM pg_constraint pc
    JOIN pg_class tbl ON tbl.oid = pc.conrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public' /* NOSONAR */
      AND pg_get_constraintdef(pc.oid) ILIKE '%company_id%';

    RAISE EXCEPTION 'Assertion failed: constraints still reference company_id (%): %', v_count, COALESCE(v_sample, 'n/a');
  END IF;

  -- 3) No RLS policy expressions with company_id.
  SELECT COUNT(*)::int
  INTO v_count
  FROM pg_policies p
  WHERE p.schemaname = 'public' /* NOSONAR */
    AND (
      COALESCE(p.qual, '') ILIKE '%company_id%'
      OR COALESCE(p.with_check, '') ILIKE '%company_id%'
    );

  IF v_count > 0 THEN
    SELECT string_agg(format('%I.%I [%I]', p.schemaname, p.tablename, p.policyname), ', ' ORDER BY p.tablename, p.policyname)
    INTO v_sample
    FROM pg_policies p
    WHERE p.schemaname = 'public' /* NOSONAR */
      AND (
        COALESCE(p.qual, '') ILIKE '%company_id%'
        OR COALESCE(p.with_check, '') ILIKE '%company_id%'
      );

    RAISE EXCEPTION 'Assertion failed: RLS policies still reference company_id (%): %', v_count, COALESCE(v_sample, 'n/a');
  END IF;
END
$$;

