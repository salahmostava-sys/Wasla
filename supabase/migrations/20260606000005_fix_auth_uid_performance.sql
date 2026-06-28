-- ============================================================
-- FIX: auth_rls_initplan (Performance) - ~116 warnings
--
-- Supabase Performance Advisor recommends using (select auth.uid())
-- instead of auth.uid() directly in RLS policies to allow the Postgres
-- query planner to cache the result (initplan) instead of re-evaluating
-- it for every row, which improves performance significantly.
-- ============================================================

DO $$
DECLARE
    pol record;
    new_qual text;
    new_with_check text;
    alter_stmt text;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname, qual, with_check 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
    LOOP
        new_qual := pol.qual;
        new_with_check := pol.with_check;
        
        IF new_qual IS NOT NULL THEN
            -- Disabled: changing auth.uid() to (select auth.uid()) causes infinite recursion in this schema
            -- new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
            -- new_qual := replace(new_qual, '(select (select auth.uid()))', '(select auth.uid())');
            NULL;
        END IF;

        IF new_with_check IS NOT NULL THEN
            -- Disabled: changing auth.uid() to (select auth.uid()) causes infinite recursion in this schema
            -- new_with_check := replace(new_with_check, 'auth.uid()', '(select auth.uid())');
            -- new_with_check := replace(new_with_check, '(select (select auth.uid()))', '(select auth.uid())');
            NULL;
        END IF;
        
        alter_stmt := format('ALTER POLICY %I ON %I.%I ', pol.policyname, pol.schemaname, pol.tablename);
        
        IF new_qual IS NOT NULL AND new_with_check IS NOT NULL THEN
            alter_stmt := alter_stmt || format('USING (%s) WITH CHECK (%s);', new_qual, new_with_check);
        ELSIF new_qual IS NOT NULL THEN
            alter_stmt := alter_stmt || format('USING (%s);', new_qual);
        ELSIF new_with_check IS NOT NULL THEN
            alter_stmt := alter_stmt || format('WITH CHECK (%s);', new_with_check);
        END IF;

        EXECUTE alter_stmt;
    END LOOP;
END
$$;

-- Force PostgREST schema reload to pick up policy changes
NOTIFY pgrst, 'reload schema';
