BEGIN;

UPDATE public.employees
SET preferred_language = 'ar'
WHERE preferred_language = 'ur';

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_preferred_language_check;

ALTER TABLE public.employees
  ALTER COLUMN preferred_language SET DEFAULT 'ar';

ALTER TABLE public.employees
  ADD CONSTRAINT employees_preferred_language_check
  CHECK (preferred_language IN ('ar', 'en'));

DROP VIEW IF EXISTS public.v_rider_daily_platform_orders CASCADE;

ALTER TABLE public.employees
  ALTER COLUMN city TYPE text
  USING city::text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cities text[];

UPDATE public.employees
SET cities = CASE
  WHEN cities IS NOT NULL AND array_length(cities, 1) > 0 THEN cities
  WHEN city IS NULL THEN '{}'::text[]
  ELSE ARRAY[city]
END;

UPDATE public.employees
SET cities = COALESCE(
  (
    SELECT array_agg(DISTINCT normalized_city)
    FROM (
      SELECT NULLIF(trim(value), '') AS normalized_city
      FROM unnest(COALESCE(cities, '{}'::text[])) AS value
    ) AS normalized
    WHERE normalized_city IS NOT NULL
  ),
  '{}'::text[]
);

UPDATE public.employees
SET city = NULLIF(cities[1], '');

ALTER TABLE public.employees
  ALTER COLUMN cities SET DEFAULT '{}'::text[];

DROP INDEX IF EXISTS public.employees_employee_code_unique;

ALTER TABLE public.employees
  DROP COLUMN IF EXISTS employee_code;

COMMENT ON COLUMN public.employees.cities IS
  'Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø¯Ù† Ø§Ù„Ù…Ø³Ù…ÙˆØ Ù„Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ø¹Ù…Ù„ ÙÙŠÙ‡Ø§ØŒ ÙˆØ£ÙˆÙ„ Ø¹Ù†ØµØ± Ù…Ù†Ù‡Ø§ ÙŠÙ…Ø«Ù„ Ø§Ù„Ù…Ø¯ÙŠÙ†Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©.';

COMMIT;
