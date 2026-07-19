ALTER TABLE public.salary_records
ADD COLUMN IF NOT EXISTS sheet_snapshot JSONB;

COMMENT ON COLUMN public.salary_records.sheet_snapshot IS
'Canonical UI snapshot for approved/paid salary rows so the salary sheet can be restored exactly after reload.';
