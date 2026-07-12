-- ============================================================
-- ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ø±Ø³Ù…ÙŠ: hr_performance_reviews
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hr_performance_reviews (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month_year          text        NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
  reviewer_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  attendance_score    integer     NOT NULL DEFAULT 5 CHECK (attendance_score BETWEEN 1 AND 10),
  performance_score   integer     NOT NULL DEFAULT 5 CHECK (performance_score BETWEEN 1 AND 10),
  behavior_score      integer     NOT NULL DEFAULT 5 CHECK (behavior_score BETWEEN 1 AND 10),
  commitment_score    integer     NOT NULL DEFAULT 5 CHECK (commitment_score BETWEEN 1 AND 10),
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT hr_reviews_unique_employee_month UNIQUE (employee_id, month_year)
);

ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read (intentional for HR visibility)
DROP POLICY IF EXISTS "hr_reviews_select" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_select" ON public.hr_performance_reviews
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: require authenticated session
DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_insert" ON public.hr_performance_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_update" ON public.hr_performance_reviews
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
CREATE POLICY "hr_reviews_delete" ON public.hr_performance_reviews
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_hr_reviews_employee  ON public.hr_performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_reviews_month     ON public.hr_performance_reviews(month_year);
