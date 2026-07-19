-- 1) Allow per_order_band tier type (Ø¹Ø¯Ø¯ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ÙƒÙ„ÙŠ Ã— Ø³Ø¹Ø± Ø§Ù„Ø´Ø±ÙŠØØ© â€” Ø¨Ø¯ÙˆÙ† ØªØ±Ø§ÙƒÙ… Ø´Ø±Ø§Ø¦Ø).
-- 2) Align calc_tier_salary with band model: 1â€“300Ã—3, 301â€“400Ã—4, 401â€“449Ã—5, 450â€“470 = 2500, >470 = 2500+(n-470)Ã—5

BEGIN;

ALTER TABLE public.salary_scheme_tiers
  DROP CONSTRAINT IF EXISTS salary_scheme_tiers_tier_type_check;

ALTER TABLE public.salary_scheme_tiers
  ADD CONSTRAINT salary_scheme_tiers_tier_type_check
  CHECK (tier_type IN (
    'total_multiplier',
    'fixed_amount',
    'base_plus_incremental',
    'per_order_band'
  ));

CREATE OR REPLACE FUNCTION public.calc_tier_salary(total_orders INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  o INTEGER := GREATEST(COALESCE(total_orders, 0), 0);
BEGIN
  IF o = 0 THEN
    RETURN 0;
  ELSIF o <= 300 THEN
    RETURN o * 3;
  ELSIF o <= 400 THEN
    RETURN o * 4;
  ELSIF o <= 449 THEN
    RETURN o * 5;
  ELSIF o <= 470 THEN
    RETURN 2500;
  END IF;

  RETURN 2500 + ((o - 470) * 5);
END;
$$;

COMMENT ON FUNCTION public.calc_tier_salary(INTEGER) IS
  'Default tier curve (single-band): 1â€“300Ã—3ØŒ 301â€“400Ã—4ØŒ 401â€“449Ã—5ØŒ 450â€“470 Ø«Ø§Ø¨Øª 2500ØŒ ÙÙˆÙ‚ 470: 2500+(n-470)Ã—5. Schemes UI may use per_order_band tiers for the same logic per app.';

COMMIT;
