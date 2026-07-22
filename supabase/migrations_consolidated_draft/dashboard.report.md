# Dashboard migration consolidation review

- Date: 2026-07-22
- Status: **needs manual review before consolidation**
- Local migration files: 234
- Remote history: synchronized with local history through `20260722000000`
- Dashboard/performance-named files: 21
- Files referencing dashboard objects: 26
- Requested output: `20260722120000_consolidated_dashboard_schema.sql`

## Decision

Do not delete the proposed 22 files and do not mark the new migration as applied yet.
The requested set is not a self-contained dashboard history. Several matching files also
create or modify salary, order-import, audit, alerts, RLS, and security objects. Removing
them would make a clean database rebuild incomplete even if the production database kept
its current objects.

## Verified conflicts

1. `20260718000000_harden_exposed_security_definer_rpcs.sql` moved the privileged
   implementation to `private.performance_dashboard_rpc` and exposed a
   `SECURITY INVOKER` wrapper in `public`.
2. `20260721000002_revert_dashboard_stats.sql` recreated the implementation directly in
   `public` as `SECURITY DEFINER` and recreated the rider views without
   `security_invoker = true`.
3. `20260722000000_optimize_dashboard_performance.sql` again replaced the public RPC as
   `SECURITY DEFINER`. This reverses the hardening from 2026-07-18.
4. The materialized view has no trigger, cron schedule, or application caller that
   refreshes it after writes to `daily_orders`. The dashboard can therefore return stale
   figures even though Realtime invalidates the frontend query.
5. The proposed object list omits `v_rider_daily_performance`, the private RPC
   implementation, and the public invoker wrapper. It is not a complete final state.
6. `migration repair` accepts migration versions, not filenames. Marking
   `20260722120000` as applied only edits history; it does not execute the SQL.

## Files that must not be deleted as dashboard-only files

- `20260410000000_performance_engine_foundation.sql`: tables, RLS, triggers, imports,
  salary snapshots, views, and multiple RPCs.
- `20260410010000_performance_dashboard_rpcs.sql`: dashboard and rider-profile RPCs plus
  shared indexes and helper functions.
- `20260410050000_fix_search_path_and_security_invoker.sql`: dashboard view hardening and
  unrelated function hardening.
- `20260714000000_system_integration_performance.sql`: salary, import, overview, audit,
  and alerts functions.
- `20260718000000_harden_exposed_security_definer_rpcs.sql`: shared security boundary for
  many non-dashboard RPCs.

## Safe consolidation boundary

Only the following recent files are dashboard-only enough to be candidates for a single
replacement after the final schema is verified:

- `20260721000000_fix_dashboard_stats.sql`
- `20260721000001_fix_dashboard_rpc_active_column.sql`
- `20260721000002_revert_dashboard_stats.sql`
- `20260722000000_optimize_dashboard_performance.sql`

Earlier files must remain in history unless the whole database is squashed into a tested
baseline, because later objects depend on tables and functions they introduced.

## Required final object state

1. `v_rider_daily_platform_orders` with `security_invoker = true`.
2. `v_rider_daily_performance` with `security_invoker = true`.
3. A cache strategy that cannot return stale order totals. Keep the regular daily view as
   the correctness source until an automatic materialized-view refresh is verified.
4. `v_rider_monthly_performance` with `security_invoker = true`.
5. `private.performance_dashboard_rpc(text, date)` as the privileged implementation.
6. `public.performance_dashboard_rpc(text, date)` as a `SECURITY INVOKER` wrapper only.
7. Explicit `REVOKE ALL ... FROM PUBLIC, anon` and narrowly scoped grants.
8. `NOTIFY pgrst, 'reload schema'` after the final function and grants.

## Safe execution order

1. Produce a schema-only dump of `public,private` from production and compare the exact
   function/view definitions with the intended final state.
2. Create one new corrective migration and apply it normally. Do not mark it applied
   before its SQL has run.
3. Verify dashboard values against direct `daily_orders` aggregates for at least the
   current and previous month.
4. Verify the public RPC is `SECURITY INVOKER`, its private implementation is not exposed,
   and the three views use invoker security.
5. Run a clean local database rebuild using the candidate migration set.
6. After the new migration is applied and verified, mark only the four candidate versions
   as reverted in remote history, archive their local files, and confirm `migration list`
   is synchronized.
7. Run `db push --dry-run`, tests, lint, and build before commit and push.

## Current blocker

`supabase db dump` could not run because Docker Desktop is unavailable. No production SQL,
migration repair, or database push was executed. The final consolidated SQL must remain
unapproved until the production schema dump or an equivalent catalog export is available.
