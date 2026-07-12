#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { validateSupabaseAssets } from './validate-supabase-assets.mjs';

const args = new Set(process.argv.slice(2));

const skipFrontend = args.has('--skip-frontend');
const skipBackend = args.has('--skip-backend');
const skipSupabase = args.has('--skip-supabase');
const strictFrontend = args.has('--strict-frontend');
const runSupabaseSql = args.has('--run-supabase-sql');

const repoRoot = process.cwd();

function logStep(name) {
  process.stdout.write(`\n==> ${name}\n`);
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getPythonCommand() {
  const venvPath = process.platform === 'win32'
    ? path.join(repoRoot, 'ai-backend', 'venv', 'Scripts', 'python.exe')
    : path.join(repoRoot, 'ai-backend', 'venv', 'bin', 'python');

  if (existsSync(venvPath)) {
    return venvPath;
  }

  const candidates = process.platform === 'win32' ? ['python'] : ['python3', 'python'];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }

  throw new Error('Required command not found: python');
}

function runCommand(name, command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: repoRoot,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status ?? 1}`);
  }
}

function reportRootPackageFiles() {
  const legacyFiles = ['package.json', 'package-lock.json', 'bun.lock', 'bun.lockb']
    .filter((file) => existsSync(path.join(repoRoot, file)));

  if (legacyFiles.length > 0) {
    process.stdout.write(
      `Note: root-level package manifest(s) present (${legacyFiles.join(', ')}); frontend installs use frontend/package-lock.json only.\n`,
    );
  }
}

if (!skipFrontend) {
  logStep('Frontend package layout');
  reportRootPackageFiles();

  const npmCommand = getNpmCommand();
  const frontendCwd = path.join(repoRoot, 'frontend');

  logStep('Frontend verify');
  runCommand('frontend lint', npmCommand, ['run', 'lint'], { cwd: frontendCwd });
  runCommand('frontend test', npmCommand, ['run', 'test'], { cwd: frontendCwd });
  runCommand('frontend build', npmCommand, ['run', 'build'], { cwd: frontendCwd });

  if (strictFrontend) {
    logStep('Frontend strict audit');
    runCommand('frontend strict lint', npmCommand, ['run', 'lint:strict'], { cwd: frontendCwd });
    runCommand('frontend coverage', npmCommand, ['run', 'test:coverage'], { cwd: frontendCwd });
  }
}

if (!skipBackend) {
  logStep('AI backend smoke tests');

  const pythonCommand = getPythonCommand();
  const dependencyCheck = spawnSync(
    pythonCommand,
    ['-c', 'import fastapi, pandas, sklearn'],
    { stdio: 'ignore', cwd: repoRoot },
  );

  if (dependencyCheck.status === 0) {
    runCommand('AI backend smoke tests', pythonCommand, ['-m', 'unittest', 'discover', '-s', 'ai-backend', '-p', 'test_*.py']);
  } else {
    process.stdout.write(
      'Skipping AI backend smoke tests: Python deps missing. Install with: pip install -r ai-backend/requirements.txt\n',
    );
  }
}

if (!skipSupabase) {
  logStep('Supabase audit files');
  const validation = validateSupabaseAssets(repoRoot);
  process.stdout.write(
    `Validated ${validation.auditFiles} audit SQL files, ${validation.functionFiles} edge functions, and ${validation.migrations} migrations.\n`,
  );

  if (runSupabaseSql) {
    const psqlCommand = process.platform === 'win32' ? 'psql.exe' : 'psql';
    const dbUrl = process.env.SUPABASE_DB_URL;

    if (!dbUrl) {
      throw new Error('SUPABASE_DB_URL must be set before running Supabase SQL smoke tests.');
    }

    logStep('Supabase SQL smoke tests');
    runCommand('Supabase tenant RLS smoke tests', psqlCommand, [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/tenant_rls_smoke_tests.sql']);
    runCommand('Supabase phase 1.5 validation', psqlCommand, [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/phase_1_5_validation_checks.sql']);
    runCommand('Supabase maintenance system tests', psqlCommand, [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/maintenance_system_tests.sql']);
  }
}

process.stdout.write('\nSystem audit completed successfully.\n');
