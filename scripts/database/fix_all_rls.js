const { execSync } = require('node:child_process');
const fs = require('node:fs');

const query = `
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%( SELECT auth.uid()%' OR with_check LIKE '%( SELECT auth.uid()%');
`;

const rawOut = execSync('npx supabase db query --linked "' + query.replaceAll('\n', ' ') + '" --output-format json', { encoding: 'utf8' });
const jsonMatch = rawOut.match(/\[.*\]/s); // NOSONAR
if (!jsonMatch) {
    console.error('No json found');
    process.exit(1);
}
const data = JSON.parse(jsonMatch[0]);

let sql = '-- Fix ALL remaining RLS policies containing nested auth.uid()\n\n';

for (const row of data) {
    const table = row.tablename;
    const policy = row.policyname;
    const cmd = row.cmd;
    const regex = /\(\s*SELECT\s+auth\.uid\(\)\s*(?:AS\s+uid)?\s*\)/g; // NOSONAR
    let qual = row.qual ? row.qual.replace(regex, 'auth.uid()') : null;
    let check = row.with_check ? row.with_check.replace(regex, 'auth.uid()') : null;

    sql += `DROP POLICY IF EXISTS "${policy}" ON public."${table}";\n`;
    sql += `CREATE POLICY "${policy}" ON public."${table}" FOR ${cmd}\n`;
    
    if (qual && check) {
        sql += `  USING ( ${qual} )\n  WITH CHECK ( ${check} );\n\n`;
    } else if (qual) {
        sql += `  USING ( ${qual} );\n\n`;
    } else if (check) {
        sql += `  WITH CHECK ( ${check} );\n\n`;
    }
}

fs.writeFileSync('supabase/migrations/20260628130500_fix_all_remaining_rls.sql', sql);
console.log('Migration generated with ' + data.length + ' policies.');
