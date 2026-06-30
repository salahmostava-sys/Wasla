const { execSync } = require('node:child_process');
const fs = require('node:fs');

console.log("Fetching policies for the 3 tables...");

const query = `SELECT tablename, cmd, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('edge_rate_limits', 'salary_slip_templates', 'finance_transactions')`;

try {
    const rawOut = execSync(`npx supabase db query --linked "${query}" --output-format json`, { encoding: 'utf8' });
    const jsonStr = rawOut.match(/\[.*\]/s); // NOSONAR
    if (!jsonStr) {
        console.error("Could not parse JSON", rawOut);
        process.exit(1);
    }
    const policies = JSON.parse(jsonStr[0]);

    let sql = `-- Fix remaining auth_rls_initplan warnings\n\n`;

    for (const p of policies) {
        // Replace exact word matches of auth.uid() that aren't already wrapped.
        // We just do a global replace of auth.uid() to (select auth.uid())
        // but avoid replacing if it's already (select auth.uid())
        let newQual = p.qual ? p.qual.replace(/(?<!\(select\s+)auth\.uid\(\)/g, '(select auth.uid())') : null; // NOSONAR
        let newWithCheck = p.with_check ? p.with_check.replace(/(?<!\(select\s+)auth\.uid\(\)/g, '(select auth.uid())') : null; // NOSONAR

        if ((p.qual && newQual !== p.qual) || (p.with_check && newWithCheck !== p.with_check)) {
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

    fs.writeFileSync('supabase/migrations/20260606000010_fix_remaining_auth_rls.sql', sql);
    console.log(`Generated migration 20260606000010_fix_remaining_auth_rls.sql!`);

} catch (err) {
    console.error(err);
}
