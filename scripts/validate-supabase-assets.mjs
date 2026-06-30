#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(repoRoot, relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  assert(existsSync(absolutePath), `Missing required Supabase asset: ${relativePath}`);
  const content = readFileSync(absolutePath, 'utf8');
  assert(content.trim().length > 0, `Supabase asset is empty: ${relativePath}`);
  return content;
}

function assertContains(relativePath, content, snippet) {
  assert(content.includes(snippet), `Expected ${relativePath} to contain "${snippet}"`);
}

function assertMigrationToken(migrationFiles, token) {
  const matches = migrationFiles.filter((file) => file.includes(token));
  assert(matches.length > 0, `Missing Supabase migration containing token: ${token}`);
}

export function validateSupabaseAssets(repoRoot = process.cwd()) {
  const configText = readText(repoRoot, 'supabase/config.toml');
  assertContains('supabase/config.toml', configText, 'project_id');


  const tenantRlsText = readText(repoRoot, 'supabase/oneoff/tenant_rls_smoke_tests.sql');
  for (const snippet of [
    'SECTION A',
    'SECTION B',
    'SECTION C',
    'SECTION D',
    'pg_policies',
    'platform_accounts',
    'salary_records',
    'BEGIN;',
    'ROLLBACK;',
  ]) {
    assertContains('supabase/oneoff/tenant_rls_smoke_tests.sql', tenantRlsText, snippet);
  }

  const phaseValidationText = readText(repoRoot, 'supabase/oneoff/phase_1_5_validation_checks.sql');
  for (const snippet of [
    'MISSING_RLS',
    'has_permission',
    'ROLLBACK;',
    'admin_action_log',
    '[admin][SELECT employees]',
  ]) {
    assertContains('supabase/oneoff/phase_1_5_validation_checks.sql', phaseValidationText, snippet);
  }

  const maintenanceText = readText(repoRoot, 'supabase/oneoff/maintenance_system_tests.sql');
  for (const snippet of [
    'spare_parts',
    'maintenance_logs',
    'maintenance_parts',
    'trg_deduct_stock',
    'deduct_spare_part_stock',
    'ROLLBACK;',
  ]) {
    assertContains('supabase/oneoff/maintenance_system_tests.sql', maintenanceText, snippet);
  }

  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
  assert(existsSync(migrationsDir), 'Missing Supabase migrations directory');

  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  assert(migrationFiles.length > 0, 'No Supabase migration files found');

  const latestMigrationPath = path.join(migrationsDir, migrationFiles[migrationFiles.length - 1]);
  assert(
    statSync(latestMigrationPath).size > 0,
    `Latest Supabase migration is empty: ${migrationFiles[migrationFiles.length - 1]}`,
  );

  for (const token of [
    'rls',
    'platform_accounts',
    'salary_engine',
    'fleet_spare_parts',
    'fleet_maintenance_logs_and_parts',
    'fleet_maintenance_triggers',
  ]) {
    assertMigrationToken(migrationFiles, token);
  }

  return {
    auditFiles: 3,
    functionFiles: 0,
    migrations: migrationFiles.length,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateSupabaseAssets();
  process.stdout.write(
    `Supabase audit assets validated: ${result.auditFiles} audit SQL files, ${result.functionFiles} edge functions, ${result.migrations} migrations.\n`,
  );
}
