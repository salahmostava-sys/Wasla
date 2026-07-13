BEGIN;

ALTER TABLE public.commercial_records
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS residency_renewal_monthly_cost numeric(12, 2),
  ADD COLUMN IF NOT EXISTS residency_renewal_cost_period text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.commercial_records
  DROP CONSTRAINT IF EXISTS commercial_records_residency_renewal_monthly_cost_non_negative,
  ADD CONSTRAINT commercial_records_residency_renewal_monthly_cost_non_negative
    CHECK (residency_renewal_monthly_cost IS NULL OR residency_renewal_monthly_cost >= 0);

ALTER TABLE public.commercial_records
  DROP CONSTRAINT IF EXISTS commercial_records_residency_renewal_cost_period_check,
  ADD CONSTRAINT commercial_records_residency_renewal_cost_period_check
    CHECK (residency_renewal_cost_period IN ('monthly', 'yearly'));

COMMIT;
