import tempfile
import unittest
from pathlib import Path

from scripts.analyze_migration_table import MigrationAnalyzer, resolve_workspace_path, split_sql_statements


class SqlSplitterTests(unittest.TestCase):
    def test_does_not_split_semicolons_inside_dollar_quoted_body(self) -> None:
        sql = "CREATE FUNCTION public.f() RETURNS void AS $$ BEGIN PERFORM 1; END; $$ LANGUAGE plpgsql; SELECT 1;"

        statements = split_sql_statements(sql)

        self.assertEqual(2, len(statements))
        self.assertIn('PERFORM 1;', statements[0])

    def test_does_not_split_semicolons_inside_strings_or_comments(self) -> None:
        sql = "SELECT ';'; -- ignored ;\nSELECT 2; /* ignored ; */ SELECT 3;"

        statements = split_sql_statements(sql)

        self.assertEqual(3, len(statements))

    def test_strip_supports_utf8_bom(self) -> None:
        from scripts.analyze_migration_table import strip_leading_comments

        self.assertEqual('SELECT 1;', strip_leading_comments('\ufeffSELECT 1;'))


class WorkspacePathTests(unittest.TestCase):
    def test_accepts_paths_inside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)

            resolved = resolve_workspace_path(Path('output'), workspace, 'Output directory')

        self.assertEqual(workspace / 'output', resolved)

    def test_rejects_paths_outside_workspace(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory) / 'workspace'
            workspace.mkdir()

            with self.assertRaisesRegex(SystemExit, 'must stay inside'):
                resolve_workspace_path(Path('..') / 'outside', workspace, 'Output directory')


class MigrationAnalyzerTests(unittest.TestCase):
    def test_last_operation_wins_for_supported_objects(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory)
            (migrations / '001_initial.sql').write_text(
                '''
                CREATE TABLE public.sample (id uuid PRIMARY KEY, old text);
                ALTER TABLE public.sample ADD COLUMN kept text, DROP COLUMN old;
                ALTER TABLE public.sample ALTER COLUMN kept SET DEFAULT 'yes';
                ALTER TABLE public.sample ENABLE ROW LEVEL SECURITY;
                CREATE POLICY "read all" ON public.sample FOR SELECT USING (true);
                CREATE TRIGGER sample_touch BEFORE UPDATE ON public.sample
                  FOR EACH ROW EXECUTE FUNCTION public.touch_row();
                CREATE FUNCTION public.touch_row() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;
                CREATE INDEX sample_kept_idx ON public.sample(kept);
                ''',
                encoding='utf-8',
            )
            (migrations / '002_changes.sql').write_text(
                '''
                DROP POLICY "read all" ON public.sample;
                DROP POLICY unquoted_policy ON "public"."sample";
                CREATE POLICY "quoted final" ON "public"."sample" FOR SELECT USING (true);
                DROP INDEX sample_kept_idx;
                ''',
                encoding='utf-8',
            )

            analysis = MigrationAnalyzer(migrations, 'sample').analyze()

        self.assertEqual(['id', 'kept'], list(analysis.columns))
        self.assertEqual("kept text DEFAULT 'yes'", analysis.columns['kept'].definition)
        self.assertEqual(['quoted final'], list(analysis.policies))
        self.assertEqual(['sample_touch'], list(analysis.triggers))
        self.assertEqual(['touch_row'], list(analysis.trigger_functions))
        self.assertEqual([], list(analysis.indexes))
        self.assertTrue(analysis.rls_enabled)

    def test_drop_column_cascade_removes_dependent_index(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory)
            (migrations / '001.sql').write_text(
                'CREATE TABLE public.sample (id uuid, obsolete text); '
                'CREATE INDEX sample_obsolete_idx ON public.sample(obsolete); '
                'CREATE INDEX obsolete_name_only_idx ON public.sample(id); '
                'ALTER TABLE public.sample DROP COLUMN obsolete CASCADE;',
                encoding='utf-8',
            )

            analysis = MigrationAnalyzer(migrations, 'sample').analyze()

        self.assertNotIn('obsolete', analysis.columns)
        self.assertNotIn('sample_obsolete_idx', analysis.indexes)
        self.assertIn('obsolete_name_only_idx', analysis.indexes)

    def test_named_drop_removes_generated_inline_check(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory)
            (migrations / '001.sql').write_text(
                "CREATE TABLE public.sample (language text CHECK (language IN ('ar', 'en'))); "
                'ALTER TABLE public.sample DROP CONSTRAINT sample_language_check; '
                "ALTER TABLE public.sample ADD CONSTRAINT sample_language_check CHECK (language = 'ar');",
                encoding='utf-8',
            )

            analysis = MigrationAnalyzer(migrations, 'sample').analyze()

        self.assertNotIn('CHECK', analysis.columns['language'].definition.upper())
        self.assertIn('sample_language_check', analysis.constraints)

    def test_dynamic_trigger_loop_applies_safe_format_calls(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory)
            (migrations / '001.sql').write_text(
                '''
                CREATE TABLE public.sample (id uuid);
                CREATE TRIGGER audit_sample AFTER UPDATE ON public.sample
                  FOR EACH ROW EXECUTE FUNCTION public.touch_row();
                CREATE FUNCTION public.touch_row() RETURNS trigger AS $$ BEGIN RETURN NEW; END; $$ LANGUAGE plpgsql;
                DO $$
                DECLARE
                  v_table text;
                  v_tables text[] := ARRAY['sample', 'other'];
                BEGIN
                  FOREACH v_table IN ARRAY v_tables LOOP
                    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', v_table, v_table);
                  END LOOP;
                END $$;
                ''',
                encoding='utf-8',
            )

            analysis = MigrationAnalyzer(migrations, 'sample').analyze()

        self.assertNotIn('audit_sample', analysis.triggers)
        self.assertEqual(0, len(analysis.manual_review))

    def test_flags_embedded_procedural_ddl_for_manual_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory)
            (migrations / '001_do.sql').write_text(
                "DO $$ BEGIN ALTER TABLE public.sample ADD COLUMN hidden text; END $$;",
                encoding='utf-8',
            )

            analysis = MigrationAnalyzer(migrations, 'sample').analyze()

        reasons = [review.reason for review in analysis.manual_review]
        self.assertEqual(2, len(reasons))
        self.assertTrue(any('كتلة إجرائية' in reason for reason in reasons))
        self.assertTrue(any('CREATE TABLE' in reason for reason in reasons))


if __name__ == '__main__':
    unittest.main()
