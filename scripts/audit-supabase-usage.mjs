import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TYPES_FILE = path.join(ROOT, 'frontend', 'services', 'supabase', 'types.ts');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const REPORT_FILE = path.join(ROOT, 'docs', 'SUPABASE_USAGE_CLASSIFICATION.md');
const SOURCE_ROOTS = ['frontend', 'server', 'api'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.git']);
const SENSITIVE_PATTERN = /(permission|profile|role|salary|treasury|finance|audit|auth|wallet|advance|deduction)/i;
const CLEANUP_NAME_PATTERN = /(legacy|archive|backup|deprecated|obsolete|temporary|temp|old)/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function extractObjectNames(typesSource, sectionName, nextSectionName) {
  const startMarker = `    ${sectionName}: {`;
  const endMarker = `    ${nextSectionName}: {`;
  const start = typesSource.indexOf(startMarker);
  const end = typesSource.indexOf(endMarker, start + startMarker.length);

  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${sectionName} in ${TYPES_FILE}`);
  }

  const section = typesSource.slice(start + startMarker.length, end);
  return [...section.matchAll(/^      ([A-Za-z0-9_]+): \{/gm)].map((match) => match[1]);
}

async function collectFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (IGNORED_DIRECTORIES.has(entry.name)) return [];

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath, predicate);
    return predicate(fullPath) ? [fullPath] : [];
  }));

  return nested.flat();
}

function isRuntimeSource(filePath) {
  if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) return false;
  const normalized = filePath.replaceAll('\\', '/');
  return !/(?:\.test|\.spec)\.[^/]+$|\/__tests__\//.test(normalized)
    && normalized !== TYPES_FILE.replaceAll('\\', '/');
}

async function readCorpus(files) {
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  return contents.join('\n');
}

function classifyObject({ name, kind, directReferences, sourceMentions, sqlReferences }) {
  const sensitive = SENSITIVE_PATTERN.test(name);
  const internalHelper = kind === 'Function'
    && (/^_const_/.test(name) || /^(?:n?eq_|text_to_|has_|is_|jwt_)/.test(name));
  const hasApplicationEvidence = directReferences > 0 || sourceMentions > 0;
  const sqlHistoryOnly = !hasApplicationEvidence && !internalHelper && sqlReferences > 0;
  const unclear = !hasApplicationEvidence && !internalHelper && sqlReferences === 0;
  const cleanupCandidate = !sensitive
    && (sqlHistoryOnly || unclear)
    && CLEANUP_NAME_PATTERN.test(name);

  let classification = 'Direct app use';
  if (cleanupCandidate) classification = 'Cleanup review';
  else if (unclear) classification = 'Unclear';
  else if (internalHelper) classification = 'Internal helper';
  else if (sourceMentions > 0 && directReferences === 0) classification = 'Indirect app reference';
  else if (sqlHistoryOnly) classification = 'SQL history only; verify';
  if (sensitive) classification = `${classification}; sensitive`;

  return { classification, cleanupCandidate, sqlHistoryOnly };
}

function inspectObject(name, kind, sourceCorpus, sqlCorpus) {
  const escapedName = escapeRegExp(name);
  const directPattern = kind === 'Function'
    ? new RegExp(`\\.rpc\\(\\s*['\"\`]${escapedName}['\"\`]`, 'g')
    : new RegExp(`\\.from\\(\\s*['\"\`]${escapedName}['\"\`]`, 'g');
  const wordPattern = new RegExp(`\\b${escapedName}\\b`, 'g');
  const directReferences = countMatches(sourceCorpus, directPattern);
  const sourceMentions = countMatches(sourceCorpus, wordPattern);
  const sqlReferences = countMatches(sqlCorpus, new RegExp(`\\b${escapedName}\\b`, 'gi'));
  const classification = classifyObject({
    name,
    kind,
    directReferences,
    sourceMentions,
    sqlReferences,
  });

  return {
    name,
    kind,
    directReferences,
    sourceMentions,
    sqlReferences,
    ...classification,
  };
}

function markdownTable(items) {
  const header = '| Object | Classification | Direct app refs | App mentions | SQL refs |';
  const divider = '| --- | --- | ---: | ---: | ---: |';
  const rows = items.map((item) => (
    `| \`${item.name}\` | ${item.classification} | ${item.directReferences} | ${item.sourceMentions} | ${item.sqlReferences} |`
  ));
  return [header, divider, ...rows].join('\n');
}

function buildReport(items, migrationCount) {
  const byKind = (kind) => items.filter((item) => item.kind === kind);
  const unclear = items.filter((item) => item.classification.startsWith('Unclear'));
  const cleanupCandidates = items.filter((item) => item.cleanupCandidate);
  const direct = items.filter((item) => item.directReferences > 0);
  const internalHelpers = items.filter((item) => item.classification.startsWith('Internal helper'));
  const sqlHistoryOnly = items.filter((item) => item.sqlHistoryOnly);

  return `# Supabase Usage Classification

Generated by \`npm run audit:supabase-usage\`. Do not edit this file manually.

## Scope and decision rule

- Runtime references are scanned in \`frontend/\`, \`server/\`, and \`api/\`; tests, generated types, build output, and dependencies are excluded.
- SQL migration references show history, not guaranteed current runtime usage. They are reported separately from known helper functions.
- Sensitive objects are never automatic cleanup candidates.
- A cleanup review label is not approval to delete. Deletion still requires a second independent proof and a rollback plan.

## Summary

| Metric | Count |
| --- | ---: |
| Migrations | ${migrationCount} |
| Tables | ${byKind('Table').length} |
| Views | ${byKind('View').length} |
| Functions | ${byKind('Function').length} |
| Objects used directly | ${direct.length} |
| Internal helper functions | ${internalHelpers.length} |
| SQL-history-only objects needing runtime confirmation | ${sqlHistoryOnly.length} |
| Unclear objects | ${unclear.length} |
| Cleanup review candidates | ${cleanupCandidates.length} |

## Cleanup review queue

${cleanupCandidates.length > 0 ? markdownTable(cleanupCandidates) : 'No object met the automatic cleanup-review threshold.'}

## Tables

${markdownTable(byKind('Table'))}

## Views

${markdownTable(byKind('View'))}

## Functions

${markdownTable(byKind('Function'))}

## Phase 2 decision

- No table, view, function, trigger, policy, or migration was removed in this phase.
- Objects marked unclear, SQL-history-only, or cleanup review remain enabled until runtime/database evidence supplies a second proof.
- Historical migrations remain intact because they are already part of the linked database history. Squashing them is a baseline operation, not a runtime performance optimization.
`;
}

async function main() {
  const typesSource = await readFile(TYPES_FILE, 'utf8');
  const runtimeFiles = (await Promise.all(SOURCE_ROOTS.map((root) => (
    collectFiles(path.join(ROOT, root), isRuntimeSource)
  )))).flat();
  const migrationFiles = await collectFiles(MIGRATIONS_DIR, (file) => file.endsWith('.sql'));
  const [sourceCorpus, sqlCorpus] = await Promise.all([
    readCorpus(runtimeFiles),
    readCorpus(migrationFiles),
  ]);

  const objects = [
    ...extractObjectNames(typesSource, 'Tables', 'Views').map((name) => ({ name, kind: 'Table' })),
    ...extractObjectNames(typesSource, 'Views', 'Functions').map((name) => ({ name, kind: 'View' })),
    ...extractObjectNames(typesSource, 'Functions', 'Enums').map((name) => ({ name, kind: 'Function' })),
  ];
  const results = objects.map(({ name, kind }) => inspectObject(name, kind, sourceCorpus, sqlCorpus));

  await writeFile(REPORT_FILE, buildReport(results, migrationFiles.length), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, REPORT_FILE)} with ${results.length} classified objects.`);
}

await main();
