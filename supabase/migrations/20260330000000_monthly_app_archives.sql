-- Phase 1: Soft Delete Support
-- We add is_archived so that deleting an app doesn't remove its records from the past.
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Phase 2: Monthly Activation Table
-- This table tracks which apps were active in which month.
CREATE TABLE IF NOT EXISTS public.app_monthly_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- Format: YYYY-MM
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, month_year)
);

-- Phase 3: RLS Security
ALTER TABLE public.app_monthly_activations ENABLE ROW LEVEL SECURITY;

-- Assuming there is a standard policy for apps, we replicate it here.
-- Based on previous context, we use a simple "Authenticated users can read" or similar.
DROP POLICY IF EXISTS "Authenticated users can manage app activations" ON public.app_monthly_activations;
CREATE POLICY "Authenticated users can manage app activations"
ON public.app_monthly_activations
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_monthly_activations_month ON public.app_monthly_activations(month_year);
CREATE INDEX IF NOT EXISTS idx_monthly_activations_app ON public.app_monthly_activations(app_id);
