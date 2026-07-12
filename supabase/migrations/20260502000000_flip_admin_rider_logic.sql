-- ============================================================
-- LOGIC CHANGE: Flip admin/rider detection in salary engine
--
-- Old rule: admin = job title matches admin keywords list
-- New rule: rider = job title matches rider keywords list
--           admin = job title is set AND does NOT match rider keywords
--
-- This means every employee who is not explicitly a "Ù…Ù†Ø¯ÙˆØ¨ / Ø³Ø§Ø¦Ù‚ / ..."
-- is treated as administrative and included in monthly salary runs
-- without needing platform activity.
-- ============================================================

DROP FUNCTION IF EXISTS public.is_salary_admin_job_title(TEXT);

CREATE OR REPLACE FUNCTION public.is_salary_admin_job_title(p_job_title TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  -- Empty / null job title â†’ unknown, do not auto-include
  SELECT
    COALESCE(p_job_title, '') <> ''
    AND NOT (
      COALESCE(p_job_title, '') ~* '(Ù…Ù†Ø¯ÙˆØ¨|Ø³Ø§Ø¦Ù‚|ØªÙˆØµÙŠÙ„|Ù…ÙˆØµÙ„|Ù…Ø±Ø³Ø§Ù„|rider|driver|delivery|courier|dispatch|messenger)'
    );
$$;
