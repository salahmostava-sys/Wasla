-- Prevent duplicate spare parts in the same maintenance log
-- This fixes 409 Conflict errors when the same part is added multiple times

BEGIN;

-- Add UNIQUE constraint to prevent same part being added multiple times for one maintenance log
ALTER TABLE public.maintenance_parts
  DROP CONSTRAINT IF EXISTS maintenance_parts_unique_log_part;

ALTER TABLE public.maintenance_parts
  ADD CONSTRAINT maintenance_parts_unique_log_part
  UNIQUE (maintenance_log_id, part_id);

COMMIT;
