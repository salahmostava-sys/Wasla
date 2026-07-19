-- Align branding with "Ù…Ù‡Ù…Ø© Ø§Ù„ØªÙˆØµÙŠÙ„" / Muhimmat alTawseel (defaults + existing row)
ALTER TABLE public.system_settings
  ALTER COLUMN project_name_ar SET DEFAULT 'Ù…Ù‡Ù…Ø© Ø§Ù„ØªÙˆØµÙŠÙ„',
  ALTER COLUMN project_name_en SET DEFAULT 'Muhimmat alTawseel';

UPDATE public.system_settings
SET
  project_name_ar = 'Ù…Ù‡Ù…Ø© Ø§Ù„ØªÙˆØµÙŠÙ„',
  project_name_en = 'Muhimmat alTawseel',
  updated_at = now();
