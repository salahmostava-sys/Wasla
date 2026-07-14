# Supabase Migration Baseline Assessment

Assessment date: 2026-07-14.

## Current state

- Local migration files: 224.
- Linked Supabase migration entries: 224.
- Every local version matches a remote version through `20260714000000`.
- There is no pending migration to merge into an existing unapplied file.

## Decision

Do not squash or delete the applied migration history in phase 2.

Reducing the file count now would rewrite the linked database history. It would not reduce production query load, storage reads, Realtime traffic, or audit writes. The current history is synchronized and therefore safer than an unverified baseline.

## Blocking safety checks

- Docker is not installed, so a clean database cannot currently be created from a candidate baseline.
- `supabase db dump --linked --schema public` requires Docker in this environment and could not produce the canonical schema dump.
- The existing `scripts/build_final_squash.py`, `scripts/extract_tables_for_squash.py`, and `scripts/squasher.py` use regular-expression DDL parsing and depend on missing `scratch/` inputs.
- The old scripts can select intermediate function and policy definitions from migration history. They are not safe enough to rewrite an applied production baseline.

## Safe baseline gate

A future squash is allowed only when all of these checks pass:

1. Export the canonical remote schema with the official Supabase CLI.
2. Generate a baseline from that schema, not by concatenating or regex-parsing historical migrations.
3. Start a disposable local Supabase database from the baseline.
4. Start a second disposable database from all 224 migrations.
5. Diff schemas, functions, triggers, RLS policies, grants, indexes, publications, and generated TypeScript types.
6. Run frontend typecheck, strict lint, tests, build, and a smoke test against the baseline database.
7. Archive old migrations only after the clean-room comparison is identical and a restore point exists.

## Rule for future changes

- Extend the latest owning migration only while it is still unapplied.
- After a migration is applied remotely, add a new forward-only migration for a genuinely new database change.
- Never edit remote migration history merely to reduce the number of files.
