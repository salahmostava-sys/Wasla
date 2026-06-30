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

    const tableGroups = {};
    for (const row of rows) {
        const key = `${row.schemaname}.${row.tablename}`;
        if (!tableGroups[key]) tableGroups[key] = { policies: [], schemaname: row.schemaname, tablename: row.tablename };
        tableGroups[key].policies.push(row);
    }

    let sql = `-- Migration to consolidate ALL permissive RLS policies into 1 per action\n\n`;

    for (const key in tableGroups) {
        const { schemaname, tablename, policies } = tableGroups[key];

        let dropStmts = '';
        const cmds = {
            SELECT: { qual: [] },
            INSERT: { with_check: [] },
            UPDATE: { qual: [], with_check: [] },
            DELETE: { qual: [] }
        };

        for (const p of policies) {
            dropStmts += `DROP POLICY IF EXISTS "${p.policyname}" ON "${schemaname}"."${tablename}";\n`;

            const q = p.qual ? `(${p.qual})` : 'true';
            // For INSERT, no qual. For UPDATE, with_check defaults to qual if missing.
            const wc = p.with_check ? `(${p.with_check})` : q;

            if (p.cmd === 'ALL' || p.cmd === 'SELECT') cmds.SELECT.qual.push(q);
            if (p.cmd === 'ALL' || p.cmd === 'INSERT') {
                if (p.cmd === 'INSERT') cmds.INSERT.with_check.push(p.with_check ? `(${p.with_check})` : 'true');
                else cmds.INSERT.with_check.push(wc);
            }
            if (p.cmd === 'ALL' || p.cmd === 'UPDATE') {
                cmds.UPDATE.qual.push(q);
                cmds.UPDATE.with_check.push(wc);
            }
            if (p.cmd === 'ALL' || p.cmd === 'DELETE') cmds.DELETE.qual.push(q);
        }

        sql += `-- Table: ${key}\n`;
        sql += dropStmts;

        for (const cmd in cmds) {
            let usingClause = '';
            let withCheckClause = '';

            if (cmd === 'SELECT' || cmd === 'UPDATE' || cmd === 'DELETE') {
                const uniqueQuals = [...new Set(cmds[cmd].qual)];
                if (uniqueQuals.length > 0) usingClause = `  USING (\n    ${uniqueQuals.join(' OR \n    ')}\n  )`;
            }

            if (cmd === 'INSERT' || cmd === 'UPDATE') {
                const uniqueChecks = [...new Set(cmds[cmd].with_check)];
                if (uniqueChecks.length > 0) {
                    const prefix = usingClause ? `\n  WITH CHECK (\n` : `  WITH CHECK (\n`;
                    withCheckClause = `${prefix}    ${uniqueChecks.join(' OR \n    ')}\n  )`;
                }
            }

            // If there's no condition for this cmd, skip creating it
            if (!usingClause && !withCheckClause) continue;

            const newPolicyName = `unified_${cmd.toLowerCase()}_policy`;
            let createStmt = `CREATE POLICY "${newPolicyName}" ON "${schemaname}"."${tablename}" FOR ${cmd}\n`;
            createStmt += usingClause + withCheckClause + ';\n';
            sql += createStmt;
        }
        sql += '\n';
    }

    sql += `NOTIFY pgrst, 'reload schema';\n`;

    const filepath = './supabase/migrations/20260606000007_unified_rls_policies.sql';
    fs.writeFileSync(filepath, sql);
    console.log(`Migration generated successfully at ${filepath}`);
} catch (e) {
    console.error("Error running script:", e.message);
}
