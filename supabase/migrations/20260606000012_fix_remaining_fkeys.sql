-- Fix the last two missing unindexed_foreign_keys

CREATE INDEX IF NOT EXISTS "idx_employee_apps_app_id" ON public."employee_apps" ("app_id");
CREATE INDEX IF NOT EXISTS "idx_salary_drafts_employee_id" ON public."salary_drafts" ("employee_id");
