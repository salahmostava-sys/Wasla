-- ============================================================================
-- Migration: Concurrent Editing Protection
-- Purpose: Prevent data loss when multiple users edit the same records
-- ============================================================================

-- 1. Add version column to salary_records for optimistic locking
ALTER TABLE public.salary_records 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- 2. Create salary_drafts table for server-side draft storage
CREATE TABLE IF NOT EXISTS public.salary_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, month_year, employee_id)
);

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_salary_drafts_user_month 
ON public.salary_drafts(user_id, month_year);

-- 4. Enable RLS on salary_drafts
ALTER TABLE public.salary_drafts ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own drafts" ON public.salary_drafts;
DROP POLICY IF EXISTS "Users can insert own drafts" ON public.salary_drafts;
DROP POLICY IF EXISTS "Users can update own drafts" ON public.salary_drafts;
DROP POLICY IF EXISTS "Users can delete own drafts" ON public.salary_drafts;

-- 6. RLS Policy: Users can only see their own drafts
DROP POLICY IF EXISTS "Users can view own drafts" ON public.salary_drafts;
CREATE POLICY "Users can view own drafts"
ON public.salary_drafts FOR SELECT
USING (auth.uid() = user_id);

-- 7. RLS Policy: Users can insert their own drafts
DROP POLICY IF EXISTS "Users can insert own drafts" ON public.salary_drafts;
CREATE POLICY "Users can insert own drafts"
ON public.salary_drafts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 8. RLS Policy: Users can update their own drafts
DROP POLICY IF EXISTS "Users can update own drafts" ON public.salary_drafts;
CREATE POLICY "Users can update own drafts"
ON public.salary_drafts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 9. RLS Policy: Users can delete their own drafts
DROP POLICY IF EXISTS "Users can delete own drafts" ON public.salary_drafts;
CREATE POLICY "Users can delete own drafts"
ON public.salary_drafts FOR DELETE
USING (auth.uid() = user_id);

-- 10. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_salary_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salary_drafts_updated_at ON public.salary_drafts;

CREATE TRIGGER salary_drafts_updated_at
BEFORE UPDATE ON public.salary_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_salary_drafts_updated_at();

-- 11. Function to increment version on salary_records update
CREATE OR REPLACE FUNCTION public.increment_salary_record_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS salary_records_version_increment ON public.salary_records;

CREATE TRIGGER salary_records_version_increment
BEFORE UPDATE ON public.salary_records
FOR EACH ROW
EXECUTE FUNCTION public.increment_salary_record_version();

-- 12. Enable realtime for salary_records (for conflict detection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'salary_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_records;
  END IF;
END $$;

-- 13. Enable realtime for salary_drafts (for collaborative editing indicators)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'salary_drafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_drafts;
  END IF;
END $$;

-- 14. Comment documentation
COMMENT ON COLUMN public.salary_records.version IS 'Optimistic locking version - increments on each update to detect concurrent modifications';
COMMENT ON TABLE public.salary_drafts IS 'Server-side storage for salary editing drafts - replaces localStorage to enable cross-device and multi-user scenarios';
COMMENT ON COLUMN public.salary_drafts.draft_data IS 'JSONB containing: incentives, violations, customDeductions, sickAllowance, transfer, etc.';
