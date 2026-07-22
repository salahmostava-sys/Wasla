-- Phase 5 cleanup: remove the obsolete pre-fleet table from the exposed
-- public schema while retaining an isolated recovery copy.

CREATE SCHEMA IF NOT EXISTS app_archive AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA app_archive FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SCHEMA app_archive IS
  'Private recovery archives. Not exposed to application roles or the Data API.';

DO $$
DECLARE
  source_count bigint;
  archive_count bigint;
BEGIN
  IF to_regclass('public.maintenance_logs_legacy_pre_fleet') IS NULL THEN
    RETURN;
  END IF;

  -- Rebuild the recovery copy in the same transaction. A failure rolls back
  -- both the archive replacement and the public-table removal.
  DROP TABLE IF EXISTS app_archive.maintenance_logs_pre_fleet_20260328;

  CREATE TABLE app_archive.maintenance_logs_pre_fleet_20260328
    (LIKE public.maintenance_logs_legacy_pre_fleet INCLUDING ALL);

  INSERT INTO app_archive.maintenance_logs_pre_fleet_20260328
  SELECT *
  FROM public.maintenance_logs_legacy_pre_fleet;

  SELECT count(*)
  INTO source_count
  FROM public.maintenance_logs_legacy_pre_fleet;

  SELECT count(*)
  INTO archive_count
  FROM app_archive.maintenance_logs_pre_fleet_20260328;

  IF archive_count <> source_count THEN
    RAISE EXCEPTION
      'Archive verification failed: source has % rows, archive has % rows',
      source_count,
      archive_count;
  END IF;

  COMMENT ON TABLE app_archive.maintenance_logs_pre_fleet_20260328 IS
    'Recovery copy of public.maintenance_logs_legacy_pre_fleet created before phase 5 cleanup on 2026-07-22.';

  -- RESTRICT is intentional: the migration must fail instead of cascading if
  -- an unobserved dependency was introduced after the audit.
  DROP TABLE public.maintenance_logs_legacy_pre_fleet RESTRICT;
END;
$$;

ALTER TABLE IF EXISTS app_archive.maintenance_logs_pre_fleet_20260328
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA app_archive
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
