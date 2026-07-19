-- FIX #9: Prevent multiple default salary slip templates.
-- Only one row can have is_default = true at a time.
-- This replaces the application-level "unset others first" logic with a DB constraint.

-- First, ensure only one default exists (keep the newest)
DO $$
BEGIN
  IF (SELECT count(*) FROM salary_slip_templates WHERE is_default = true) > 1 THEN
    UPDATE salary_slip_templates
    SET is_default = false
    WHERE is_default = true
      AND id != (
        SELECT id FROM salary_slip_templates
        WHERE is_default = true
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_slip_templates_single_default
  ON salary_slip_templates (is_default)
  WHERE is_default = true;
