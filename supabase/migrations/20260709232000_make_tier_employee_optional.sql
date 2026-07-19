-- Make employee_id in employee_tiers optional to allow templates/unassigned tiers
ALTER TABLE public.employee_tiers ALTER COLUMN employee_id DROP NOT NULL;
