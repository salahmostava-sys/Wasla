import os
import glob
import re

MIGRATIONS_DIR = 'supabase/migrations'
OUTPUT_FILE = 'supabase/migrations/20260701000000_squash_all_migrations.sql'

# 1. Enums
enums = []
with open('scratch/schema_history.sql', 'r', encoding='utf-8') as f:
    for block in f.read().split(';'):
        if 'CREATE TYPE' in block.upper() or 'CREATE TYPE public.' in block:
            enums.append(block.strip() + ';')

# 2. Tables
with open('scratch/squashed_tables_draft.sql', 'r', encoding='utf-8') as f:
    tables_sql = f.read()

# 3. Functions, Triggers, Views (latest)
functions = {}
triggers = {}
views = {}

files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, '*.sql')))
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Functions
    func_matches = re.finditer(r'(CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?([a-zA-Z0-9_]+).*?LANGUAGE.*?AS\s+\$\$.*?\$\$[^\;]*;)', content, re.IGNORECASE | re.DOTALL)  # NOSONAR
    for m in func_matches:
        func_name = m.group(4).lower()
        functions[func_name] = m.group(1)
        
    # Triggers
    trigger_matches = re.finditer(r'(CREATE\s+(OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z0-9_]+).*?(?:FOR\s+EACH\s+ROW|FOR\s+EACH\s+STATEMENT|EXECUTE\s+FUNCTION|EXECUTE\s+PROCEDURE).*?;)', content, re.IGNORECASE | re.DOTALL)  # NOSONAR
    for m in trigger_matches:
        trig_name = m.group(3).lower()
        triggers[trig_name] = m.group(1)
        
    # Views
    view_matches = re.finditer(r'(CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+(public\.)?([a-zA-Z0-9_]+).*?AS\s+SELECT.*?;)', content, re.IGNORECASE | re.DOTALL)  # NOSONAR
    for m in view_matches:
        view_name = m.group(4).lower()
        views[view_name] = m.group(1)

# 4. RLS Policies
rls_files = [
    '20260628130500_fix_all_remaining_rls.sql',
    '20260628130000_fix_rls_policies_with_constants.sql'
]
rls_policies = []
for rf in rls_files:
    fpath = os.path.join(MIGRATIONS_DIR, rf)
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
            pol_matches = re.finditer(r'(CREATE\s+POLICY.*?;)', content, re.IGNORECASE | re.DOTALL)  # NOSONAR
            for m in pol_matches:
                rls_policies.append(m.group(1))

# Write the final file
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write("-- ============================================================\n")
    f.write("-- SQUASH MIGRATION: Full database state as of 2026-07-01\n")
    f.write("-- Consolidates 180 migrations into one clean baseline.\n")
    f.write("-- ============================================================\n\n")
    
    f.write("-- SECTION 1: Extensions\n")
    f.write('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n')
    f.write('CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n')
    
    f.write("-- SECTION 2: ENUMs\n")
    f.write('\n\n'.join(enums) + "\n\n")
    
    f.write("-- SECTION 3: Tables\n")
    f.write(tables_sql + "\n\n")
    
    f.write("-- SECTION 5/6/7: Functions\n")
    for fname, fsql in functions.items():
        f.write(fsql + "\n\n")
        
    f.write("-- SECTION 8: Views\n")
    for vname, vsql in views.items():
        f.write(vsql + "\n\n")
        
    f.write("-- SECTION 9: Triggers\n")
    for tname, tsql in triggers.items():
        f.write(tsql + "\n\n")
        
    f.write("-- SECTION 11: RLS Policies\n")
    f.write('\n\n'.join(rls_policies) + "\n\n")
    
    f.write("-- SECTION 13: NOTIFY pgrst\n")
    f.write("NOTIFY pgrst, 'reload schema';\n")

print(f"Squash build complete! Written to {OUTPUT_FILE}")
