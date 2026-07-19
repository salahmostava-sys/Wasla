-- ============================================================
-- Ø¥Ø²Ø§Ù„Ø© Ø£ÙŠ Ù‚ÙŠØ¯ CHECK Ø¹Ù„Ù‰ hours_worked ÙÙŠ daily_shifts
-- ÙŠØ³Ù…Ø Ø¨Ù‚ÙŠÙ… Ø³Ø§Ù„Ø¨Ø© Ù„ØªÙ…Ø«ÙŠÙ„ ØØ§Ù„Ø§Øª Ø§Ù„Ø¥Ø¬Ø§Ø²Ø©:
--   1  = ØØ§Ø¶Ø±
--  -1  = Ø¥Ø¬Ø§Ø²Ø© Ø¨Ø±Ø§ØªØ¨
--  -2  = Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶Ù‰
--   0  = ØºØ§Ø¦Ø¨ (Ù„Ø§ ÙŠÙØÙØ¸ ÙÙŠ DB â€” Ø§Ù„ØºÙŠØ§Ø¨ ÙŠÙÙ…Ø«ÙŽÙ‘Ù„ Ø¨Ø¹Ø¯Ù… ÙˆØ¬ÙˆØ¯ ØµÙ)
-- ============================================================

-- Ø£Ø²Ù„ Ø£ÙŠ constraint Ø§Ø³Ù…Ù‡ check_hours_worked Ø£Ùˆ hours_worked_check
ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS daily_shifts_hours_worked_check;

ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS check_hours_worked;

ALTER TABLE public.daily_shifts
  DROP CONSTRAINT IF EXISTS daily_shifts_hours_worked_valid;

-- Ø£Ø¶Ù constraint Ø¬Ø¯ÙŠØ¯ ÙŠØ³Ù…Ø Ø¨Ø§Ù„Ù‚ÙŠÙ… Ø§Ù„Ù…ÙˆØ¬Ø¨Ø© ÙˆØ§Ù„Ø³Ø§Ù„Ø¨Ø© Ø§Ù„Ù…ØØ¯Ø¯Ø© ÙÙ‚Ø·
ALTER TABLE public.daily_shifts
  ADD CONSTRAINT daily_shifts_hours_worked_valid
  CHECK (
    hours_worked = 1    -- ØØ§Ø¶Ø±
    OR hours_worked = -1  -- Ø¥Ø¬Ø§Ø²Ø© Ø¨Ø±Ø§ØªØ¨
    OR hours_worked = -2  -- Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶Ù‰
    OR hours_worked > 0   -- Ù„Ù„ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© (Ø³Ø§Ø¹Ø§Øª Ù…ØªØ¹Ø¯Ø¯Ø©)
  );

-- ØªØ¹Ù„ÙŠÙ‚ ØªÙˆØ¶ÙŠØÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù…ÙˆØ¯
COMMENT ON COLUMN public.daily_shifts.hours_worked IS
  'Ù‚ÙŠÙ…Ø© Ø§Ù„ØØ¶ÙˆØ±: 1=ØØ§Ø¶Ø± | -1=Ø¥Ø¬Ø§Ø²Ø© Ø¨Ø±Ø§ØªØ¨ | -2=Ø¥Ø¬Ø§Ø²Ø© Ù…Ø±Ø¶Ù‰ | >1=Ø³Ø§Ø¹Ø§Øª Ø¹Ù…Ù„ (Ù„Ù„Ø£Ù†Ø¸Ù…Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø©)';
