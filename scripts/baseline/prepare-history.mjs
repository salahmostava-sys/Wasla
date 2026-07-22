#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const REPLAY_REPAIRS = [
  {
    file: '20260226083236_a06ac86d-f40a-4105-8231-3099763861e3.sql',
    reason: 'The trigger is created on auth.users immediately after this malformed DROP TRIGGER statement.',
    before: 'DROP TRIGGER IF EXISTS on_auth_user_created ON public.handle_new_user();;',
    after: 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;',
  },
  {
    file: '20260326013000_supabase_single_backend_phase1_core_rls_audit_rpc.sql',
    reason: 'PL/pgSQL variable initialization uses :=; later definitions of the same function confirm the intended syntax.',
    before: 'v_allowed boolean :IS FALSE;',
    after: 'v_allowed boolean := FALSE;',
  },
  {
    file: '20260327120000_finalize_remove_company_id_single_org.sql',
    reason: 'The next cleanup migration confirms account_assignments was omitted; production has no remaining company_id columns.',
    before: 'ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;',
    after: [
      'ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;',
      'ALTER TABLE IF EXISTS public.account_assignments DROP COLUMN IF EXISTS company_id CASCADE;',
    ].join('\n'),
  },
  ...[
    '20260403000001_update_salary_engine_for_shifts.sql',
    '20260408000000_align_salary_engine_with_sheet_and_admin_titles.sql',
    '20260706100000_fix_salary_engine_insert_columns.sql',
    '20260714000000_system_integration_performance.sql',
  ].map((file) => ({
    file,
    reason: 'The legacy two-argument salary function still exists, so PostgreSQL requires the five-argument signature to identify the intended overload.',
    before: 'COMMENT ON FUNCTION public.calculate_salary_for_employee_month IS',
    after: 'COMMENT ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) IS',
  })),
  {
    file: '20260415000001_constants.sql',
    reason: 'The opening block calls constants before defining them and only creates unreferenced session-local temp tables; the persistent helper functions below remain unchanged.',
    before: 'DO $$ BEGIN\n  -- Order statuses',
    after: 'DO $$ BEGIN\n  RETURN;\n  -- Order statuses',
  },
  {
    file: '20260416000002_fix_security_definer_permissions.sql',
    reason: 'is_admin_or_hr(uuid) is first created in May; later security migrations apply its final grants after creation.',
    before: [
      '-- is_admin_or_hr: checks if user is admin or HR',
      'REVOKE EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) FROM anon;',
      'GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO authenticated;',
      'GRANT EXECUTE ON FUNCTION public.is_admin_or_hr(UUID) TO service_role;',
    ].join('\n'),
    after: '-- Replay repair: is_admin_or_hr(uuid) is created by 20260504000001.',
  },
  {
    file: '20260416000002_fix_security_definer_permissions.sql',
    reason: 'The April comment also precedes creation of is_admin_or_hr(uuid) and is superseded by the later security definition.',
    before: [
      "COMMENT ON FUNCTION public.is_admin_or_hr(UUID) IS ",
      "  'SECURITY DEFINER - authenticated only. Checks if user is admin or HR.';",
    ].join('\n'),
    after: '-- Replay repair: deferred is_admin_or_hr(uuid) comment until after creation.',
  },
  {
    file: '20260505000000_get_my_role_privilege_order.sql',
    reason: 'PostgreSQL cannot change get_my_role() from app_role to text with CREATE OR REPLACE; no historical schema objects depend on it at this point.',
    before: [
      '-- Return highest-privilege role deterministically for multi-role users.',
      'CREATE OR REPLACE FUNCTION public.get_my_role()',
    ].join('\n'),
    after: [
      '-- Return highest-privilege role deterministically for multi-role users.',
      'DROP FUNCTION public.get_my_role();',
      'CREATE OR REPLACE FUNCTION public.get_my_role()',
    ].join('\n'),
  },
  {
    file: '20260606000009_index_foreign_keys.sql',
    reason: 'salary_slip_templates never defines created_by, so this generated index cannot exist in the final catalog.',
    before: 'CREATE INDEX IF NOT EXISTS "idx_salary_slip_templates_created_by" ON public."salary_slip_templates" ("created_by");',
    after: '-- Replay repair: skipped index for nonexistent salary_slip_templates.created_by.',
  },
  {
    file: '20260606000009_index_foreign_keys.sql',
    reason: 'The preserved pre-fleet maintenance table has no employee_id column, so this generated index cannot exist.',
    before: 'CREATE INDEX IF NOT EXISTS "idx_maintenance_logs_legacy_pre_fleet_employee_id" ON public."maintenance_logs_legacy_pre_fleet" ("employee_id");',
    after: '-- Replay repair: skipped index for nonexistent maintenance_logs_legacy_pre_fleet.employee_id.',
  },
  {
    file: '20260706161417_fix_supabase_linter_warnings.sql',
    reason: 'vehicle_documents is created two days later; its creation and July hardening migrations supersede these premature policies.',
    before: [
      '-- Fix permissive RLS policies on vehicle_documents',
      'DROP POLICY IF EXISTS "Authenticated users can insert vehicle documents" ON public.vehicle_documents;',
    ].join('\n'),
    after: [
      '-- Fix permissive RLS policies on vehicle_documents',
      '/* Replay repair: vehicle_documents does not exist until 20260708000000.',
      'DROP POLICY IF EXISTS "Authenticated users can insert vehicle documents" ON public.vehicle_documents;',
    ].join('\n'),
  },
  {
    file: '20260706161417_fix_supabase_linter_warnings.sql',
    reason: 'Closes the replay-only comment around policies that precede their table.',
    before: [
      'CREATE POLICY "Authenticated users can delete vehicle documents"',
      '    ON public.vehicle_documents FOR DELETE',
      '    TO authenticated',
      '    USING ( auth.uid() = created_by OR public.is_internal_user() );',
    ].join('\n'),
    after: [
      'CREATE POLICY "Authenticated users can delete vehicle documents"',
      '    ON public.vehicle_documents FOR DELETE',
      '    TO authenticated',
      '    USING ( auth.uid() = created_by OR public.is_internal_user() );',
      '*/',
    ].join('\n'),
  },
  {
    file: '20260718000000_harden_exposed_security_definer_rpcs.sql',
    reason: 'The hardening migration covers three dashboard compatibility overloads but omits the primary text/date overload checked by its own assertion.',
    before: [
      '-- These compatibility overloads only delegate to the already-invoker two-arg',
      '-- dashboard RPC, so elevated execution is unnecessary.',
      'ALTER FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) SECURITY INVOKER;',
    ].join('\n'),
    after: [
      '-- These compatibility overloads only delegate to the already-invoker two-arg',
      '-- dashboard RPC, so elevated execution is unnecessary.',
      'ALTER FUNCTION public.dashboard_overview_rpc(text, date) SECURITY INVOKER;',
      'ALTER FUNCTION public.dashboard_overview_rpc(text, integer, integer, date) SECURITY INVOKER;',
    ].join('\n'),
  },
];

function countOccurrences(source, search) {
  return source.split(search).length - 1;
}

export function applyReplayRepair(source, repair) {
  const occurrenceCount = countOccurrences(source, repair.before);
  if (occurrenceCount !== 1) {
    throw new Error(`${repair.file}: expected one malformed statement, found ${occurrenceCount}`);
  }
  return source.replace(repair.before, () => repair.after);
}

function main() {
  const outputIndex = process.argv.indexOf('--report');
  const reportPath = outputIndex >= 0
    ? path.resolve(process.argv[outputIndex + 1])
    : path.join(REPO_ROOT, 'baseline-replay-adjustments.json');
  const appliedRepairs = REPLAY_REPAIRS.map((repair) => {
    const migrationPath = path.join(REPO_ROOT, 'supabase', 'migrations', repair.file);
    const source = readFileSync(migrationPath, 'utf8');
    writeFileSync(migrationPath, applyReplayRepair(source, repair), 'utf8');
    return { file: repair.file, reason: repair.reason, before: repair.before, after: repair.after };
  });
  writeFileSync(reportPath, `${JSON.stringify({ appliedRepairs }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Prepared historical replay with ${appliedRepairs.length} documented repair(s).\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
