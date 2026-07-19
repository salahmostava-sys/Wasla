-- Ø±Ø¨Ø· Ø®ØµÙ… Ø®Ø§Ø±Ø¬ÙŠ (Ù…Ø®Ø§Ù„ÙØ©) Ø¨Ø³Ù„ÙØ© Ø¹Ù†Ø¯ Ø§Ù„ØªØÙˆÙŠÙ„ â€” Ø¨Ø¯Ù„ Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø¹Ù„Ù‰ Ù†Øµ Ø§Ù„Ù…Ù„Ø§ØØ¸Ø© ÙÙ‚Ø·
ALTER TABLE public.external_deductions
  ADD COLUMN IF NOT EXISTS linked_advance_id UUID REFERENCES public.advances(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.external_deductions.linked_advance_id IS 'Ø¹Ù†Ø¯ ØªØÙˆÙŠÙ„ Ø§Ù„Ù…Ø®Ø§Ù„ÙØ© Ù„Ø³Ù„ÙØ©: Ù…Ø¹Ø±Ù‘Ù Ø§Ù„Ø³Ù„ÙØ© Ø§Ù„Ù…Ù†Ø´Ø£Ø©';

CREATE INDEX IF NOT EXISTS idx_external_deductions_linked_advance_id
  ON public.external_deductions(linked_advance_id)
  WHERE linked_advance_id IS NOT NULL;
