const { execSync } = require('node:child_process');
const fs = require('node:fs');

console.log("Fetching policies for auth.role() replacement...");

const query = `SELECT tablename, cmd, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('edge_rate_limits', 'salary_slip_templates', 'finance_transactions')`;

try {
    const rawOut = execSync(`npx supabase db query --linked "${query}" --output-format json`, { encoding: 'utf8' });
    const jsonStr = rawOut.match(/\[.*\]/s); // NOSONAR
    const policies = JSON.parse(jsonStr[0]);

    let sql = `-- Fix remaining auth.role() warnings\n\n`;
    let changed = false;

    for (const p of policies) {
        let newQual = p.qual ? p.qual.replace(/(?<!\(select\s+)auth\.role\(\)/g, '(select auth.role())') : null; // NOSONAR
        let newWithCheck = p.with_check ? p.with_check.replace(/(?<!\(select\s+)auth\.role\(\)/g, '(select auth.role())') : null; // NOSONAR

        if ((p.qual && newQual !== p.qual) || (p.with_check && newWithCheck !== p.with_check)) {
            changed = true;
            sql += `DROP POLICY IF EXISTS "${p.policyname}" ON public."${p.tablename}";\n`;
            sql += `CREATE POLICY "${p.policyname}" ON public."${p.tablename}" FOR ${p.cmd}\n`;
            if (newQual) sql += `  USING (${newQual})`;
            if (newWithCheck) {
                if (newQual) sql += `\n  WITH CHECK (${newWithCheck})`;
                else sql += `  WITH CHECK (${newWithCheck})`;
            }
            sql += `;\n\n`;
        }
    }

    if (changed) {
        fs.writeFileSync('supabase/migrations/20260606000011_fix_auth_role_warnings.sql', sql);
        console.log(`Generated migration 20260606000011_fix_auth_role_warnings.sql!`);
    } else {
        console.log('No changes needed.');
    }

} catch (err) {
    console.error(err);
}
