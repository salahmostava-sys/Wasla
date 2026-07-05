const { execSync } = require('node:child_process');
const fs = require('node:fs');

console.log("Fetching policies from remote database...");
try {
    const out = execSync(`npx supabase db query --linked "SELECT schemaname, tablename, cmd, policyname, qual, with_check FROM pg_policies WHERE permissive = 'PERMISSIVE' AND schemaname IN ('public', 'storage') ORDER BY schemaname, tablename, cmd;"`, { encoding: 'utf8', maxBuffer: 1024*1024*10 });

    const jsonStrMatch = out.match(/\{[\s\S]*"rows":[\s\S]*\}/); // NOSONAR
    if (!jsonStrMatch) {
        console.error("Could not find JSON in output");
        process.exit(1);
    }

    const data = JSON.parse(jsonStrMatch[0]);
    const rows = data.rows;

    const groups = {};
    for (const row of rows) {
        const key = `${row.schemaname}.${row.tablename}.${row.cmd}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
    }

    let sql = `-- Migration to consolidate multiple permissive RLS policies\n`;
    let count = 0;

    for (const key in groups) {
        const policies = groups[key];
        if (policies.length <= 1) continue; // Only process overlapping ones

        count++;
        const { schemaname, tablename, cmd } = policies[0];

        let dropStmts = '';
        let combinedQuals = [];
        let combinedWithChecks = [];

        for (const p of policies) {
            dropStmts += `DROP POLICY IF EXISTS "${p.policyname}" ON "${schemaname}"."${tablename}";\n`;

            if (p.qual) combinedQuals.push(`(${p.qual})`);
            else if (cmd !== 'INSERT') combinedQuals.push(`true`);

            if (p.with_check) combinedWithChecks.push(`(${p.with_check})`);
            else if (cmd === 'INSERT' || cmd === 'UPDATE' || cmd === 'ALL') {
                 if (p.qual) combinedWithChecks.push(`(${p.qual})`);
                 else combinedWithChecks.push(`true`);
            }
        }

        const newPolicyName = `combined_${cmd.toLowerCase()}_policy`;

        let createStmt = `CREATE POLICY "${newPolicyName}" ON "${schemaname}"."${tablename}" FOR ${cmd}\n`;

        if (cmd === 'SELECT' || cmd === 'UPDATE' || cmd === 'DELETE' || cmd === 'ALL') {
            const uniqueQuals = [...new Set(combinedQuals)];
            if (uniqueQuals.length > 0) {
                createStmt += `  USING (\n    ${uniqueQuals.join(' OR \n    ')}\n  )`;
            }
        }

        if (cmd === 'INSERT' || cmd === 'UPDATE' || cmd === 'ALL') {
            const uniqueChecks = [...new Set(combinedWithChecks)];
            if (uniqueChecks.length > 0) {
                createStmt += (cmd === 'INSERT' ? `  WITH CHECK (\n` : `\n  WITH CHECK (\n`) + `    ${uniqueChecks.join(' OR \n    ')}\n  )`;
            }
        }

        createStmt += ';\n';

        sql += `\n-- Consolidating ${policies.length} policies for ${key}\n`;
        sql += dropStmts;
        sql += createStmt;
    }

    if (count === 0) {
        console.log("No overlapping policies found.");
        process.exit(0);
    }

    sql += `\nNOTIFY pgrst, 'reload schema';\n`;

    const filepath = './supabase/migrations/20260606000006_consolidate_rls_policies.sql';
    fs.writeFileSync(filepath, sql);
    console.log(`Migration generated successfully at ${filepath}`);
} catch (e) {
    console.error("Error running script:", e.message);
}
