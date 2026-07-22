-- Rebrand the product/display name to «وصلة / Wasla».
-- Supersedes 20260325140000_rename_project_muhimmat_altawseel.sql.
-- The app renders the displayed name from system_settings (DB), so updating the
-- frontend code default is not enough on its own — the stored row and the column
-- defaults must be updated here too, otherwise the old name keeps showing.

ALTER TABLE public.system_settings
  ALTER COLUMN project_name_ar SET DEFAULT 'وصلة',
  ALTER COLUMN project_name_en SET DEFAULT 'Wasla';

UPDATE public.system_settings
SET
  project_name_ar = 'وصلة',
  project_name_en = 'Wasla',
  updated_at = now();

-- The default salary-slip template still carried the old brand in its header.
UPDATE public.salary_slip_templates
SET header_html = REPLACE(header_html, 'Muhimmat Delivery', 'وصلة')
WHERE header_html LIKE '%Muhimmat Delivery%';
