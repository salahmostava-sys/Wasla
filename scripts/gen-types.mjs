#!/usr/bin/env node
/**
 * Generate Supabase TypeScript types.
 * Reads SUPABASE_PROJECT_ID from environment (or .env in repo root).
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Load .env from repo root if present
const envPath = resolve(repoRoot, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/); // NOSONAR
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const projectId = process.env.SUPABASE_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: SUPABASE_PROJECT_ID environment variable is not set.');
  console.error('Set it in your .env file or export it before running this script.');
  process.exit(1);
}

const outputPath = resolve(repoRoot, 'frontend/services/supabase/types.ts');
const cmd = `npx supabase gen types typescript --project-id ${projectId} -s public`;

console.log(`Generating types for project: ${projectId}`);
try {
  const output = execSync(cmd, { cwd: repoRoot, encoding: 'utf-8' });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outputPath, output, 'utf-8');
  console.log(`Types written to: ${outputPath}`);
} catch (err) {
  console.error('Failed to generate types:', err.message);
  process.exit(1);
}
