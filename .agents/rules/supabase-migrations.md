---
trigger: always_on
description: Rules for creating or editing Supabase migrations in this repository.
---

## Supabase Migrations

Rules:
- Before creating a new migration, inspect recent related files in `supabase/migrations/` for the same feature or table.
- If the current change belongs to an existing unapplied or feature-local migration that can still be edited safely, update that migration instead of adding another one.
- Create a new migration only when the change is genuinely new, independent, already deployed history must not be rewritten, or editing the existing migration would be unsafe.
- Keep related schema changes, constraints, indexes, and defaults together in the same feature migration when they are part of one behavior.
- After migration edits, run the strongest available checks, at minimum `git diff --check`; use `npx supabase` commands when remote/local migration verification is required.
