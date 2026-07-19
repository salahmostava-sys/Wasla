-- Add commercial_record column to employees table
-- This field stores the commercial registration number (Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªØ¬Ø§Ø±ÙŠ) for each employee

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS commercial_record TEXT;

COMMENT ON COLUMN public.employees.commercial_record IS 'Ø±Ù‚Ù… Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ù„Ù„Ù…Ù†Ø¯ÙˆØ¨ - ÙŠØ³ØªØ®Ø¯Ù… ÙÙŠ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ§Ù„ØªÙ‚Ø§Ø±ÙŠØ±';
