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
];

function countOccurrences(source, search) {
  return source.split(search).length - 1;
}

export function applyReplayRepair(source, repair) {
  const occurrenceCount = countOccurrences(source, repair.before);
  if (occurrenceCount !== 1) {
    throw new Error(`${repair.file}: expected one malformed statement, found ${occurrenceCount}`);
  }
  return source.replace(repair.before, repair.after);
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
