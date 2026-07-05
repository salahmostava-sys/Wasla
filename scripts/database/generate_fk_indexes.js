const { execSync } = require('node:child_process');
const fs = require('node:fs');

console.log("Fetching foreign keys and indexes from database...");

const query = `
WITH fk_actions AS (
    SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        rc.update_rule AS on_update,
        rc.delete_rule AS on_delete
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
),
indexes AS (
    SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name
    FROM pg_class t, pg_class i, pg_index ix, pg_attribute a
    WHERE t.oid = ix.indrelid
      AND i.oid = ix.indexrelid
      AND a.attrelid = t.oid
      AND a.attnum = ANY(ix.indkey)
      AND t.relkind = 'r'
)
SELECT
    f.table_name,
    f.column_name,
    f.constraint_name
FROM fk_actions f
LEFT JOIN indexes i
  ON f.table_name = i.table_name AND f.column_name = i.column_name
WHERE i.index_name IS NULL;
`;

try {
    const rawOut = execSync(`npx supabase db query --linked "${query.replaceAll('\n', ' ')}" --output-format json`, { encoding: 'utf8' });
    const jsonStr = rawOut.match(/\[.*\]/s); // NOSONAR
    if (!jsonStr) {
        console.error("Could not parse JSON", rawOut);
        process.exit(1);
    }
    const data = JSON.parse(jsonStr[0]);

    let sql = `-- Migration to index all unindexed foreign keys for performance\n\n`;

    for (const row of data) {
        const idxName = `idx_${row.table_name}_${row.column_name}`;
        // Ensure index name isn't too long (postgres max is 63)
        const finalIdxName = idxName.substring(0, 63);
        sql += `CREATE INDEX IF NOT EXISTS "${finalIdxName}" ON public."${row.table_name}" ("${row.column_name}");\n`;
    }

    fs.writeFileSync('supabase/migrations/20260606000009_index_foreign_keys.sql', sql);
    console.log(`Generated migration with ${data.length} indexes!`);

} catch (err) {
    console.error(err);
}
