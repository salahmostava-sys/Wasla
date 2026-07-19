-- Fix: Add per_order_band tier type support to salary_scheme_tiers constraint
-- This fixes the error when saving schemes with 'per_order_band' tier type

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
