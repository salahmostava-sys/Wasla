import os
import glob
import re

MIGRATIONS_DIR = 'supabase/migrations'
OUTPUT_FILE = 'scratch/schema_history.sql'

os.makedirs('scratch', exist_ok=True)

# Sort migrations chronologically
migration_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, '*.sql')))

statements = []

for file in migration_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove functions, policies, triggers, grants
    content = re.sub(r'CREATE\s+(OR\s+REPLACE\s+)?FUNCTION.*?LANGUAGE.*?AS\s+\$\$.*?\$\$;', '', content, flags=re.IGNORECASE | re.DOTALL)
    content = re.sub(r'CREATE\s+POLICY.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'DROP\s+POLICY.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'CREATE\s+TRIGGER.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'DROP\s+TRIGGER.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'GRANT\s+.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'REVOKE\s+.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR
    content = re.sub(r'CREATE\s+(OR\s+REPLACE\s+)?VIEW.*?;', '', content, flags=re.IGNORECASE | re.DOTALL)  # NOSONAR

    lines = content.split('\n')
    filtered = []
    for line in lines:
        if line.strip().startswith('--'):
            continue
        if not line.strip():
            continue
        filtered.append(line)
        
    clean_content = '\n'.join(filtered)
    if clean_content.strip():
        statements.append(f"-- FILE: {os.path.basename(file)}\n{clean_content}\n")

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(statements))

print(f"Extraction complete. Lines: {sum(1 for _ in open(OUTPUT_FILE, encoding='utf-8'))}")
