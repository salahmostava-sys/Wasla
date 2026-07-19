-- Add is_archived to apps table for soft-delete / archive workflow.
-- is_active = false means "temporarily disabled this month"
-- is_archived = true means "permanently retired, hide everywhere"

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_apps_is_archived ON public.apps(is_archived);

COMMENT ON COLUMN public.apps.is_archived IS
  'Soft archive flag. Archived apps are hidden from all UI lists and salary calculations. '
  'Use is_active to temporarily disable an app for a month.';
