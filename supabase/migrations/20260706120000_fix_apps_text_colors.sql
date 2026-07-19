-- Fix text_color for HungerStation to improve readability on yellow background
UPDATE public.apps
SET text_color = '#000000'
WHERE (name ILIKE '%hunger%' OR name ILIKE '%Ù‡Ù†Ù‚Ø±%') AND text_color = '#ffffff'; /* NOSONAR */

-- Also fix any app that has a bright yellow brand color and white text
UPDATE public.apps
SET text_color = '#000000'
WHERE text_color = '#ffffff' /* NOSONAR */
  AND (
    brand_color ILIKE '#ffcc00' OR
    brand_color ILIKE '#ffff%' OR
    brand_color ILIKE '#facc15' OR
    brand_color ILIKE '#fbbf24' OR
    brand_color ILIKE '#fde047'
  );
