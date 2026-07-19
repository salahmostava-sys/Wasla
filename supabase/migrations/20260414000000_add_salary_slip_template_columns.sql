-- Add missing columns to salary_slip_templates
ALTER TABLE public.salary_slip_templates
  ADD COLUMN IF NOT EXISTS header_html TEXT,
  ADD COLUMN IF NOT EXISTS footer_html TEXT,
  ADD COLUMN IF NOT EXISTS selected_columns JSONB DEFAULT '[]'::jsonb;
