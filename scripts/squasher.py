import os
import glob
import re

tables_dir = 'scratch/tables'
output_file = 'scratch/squashed_tables_draft.sql'

def squash_table(content, table_name):
    # This is a naive heuristic parser for squashing DDL
    create_table_match = re.search(r'CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?([a-zA-Z0-9_]+)\s*\((.*?)\);', content, re.IGNORECASE | re.DOTALL)  # NOSONAR
    
    if not create_table_match:
        # Might be a CREATE TYPE or other DDL, return as is
        return content

    columns_str = create_table_match.group(4)
    # Split by comma but ignore commas in parens (e.g. NUMERIC(10,2))
    raw_cols = re.split(r',\s*(?![^()]*\))', columns_str)
    
    columns = [c.strip() for c in raw_cols if c.strip()]
    
    # Process ALTER TABLE ADD COLUMN
    add_cols = re.finditer(r'ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+.*?)(?:,|$|;)', content, re.IGNORECASE)  # NOSONAR
    for match in add_cols:
        col_def = match.group(2).strip()
        col_def = col_def.rstrip(';')
        col_name = col_def.split()[0].lower()
        
        # Check if already exists
        exists = False
        for i, c in enumerate(columns):
            if c.lower().startswith(col_name + ' ') or c.lower() == col_name:
                columns[i] = col_def
                exists = True
                break
        if not exists:
            columns.append(col_def)
            
    # Process ALTER TABLE DROP COLUMN
    drop_cols = re.finditer(r'DROP\s+COLUMN\s+(IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)', content, re.IGNORECASE)  # NOSONAR
    for match in drop_cols:
        col_name = match.group(2).strip()
        columns = [c for c in columns if not c.lower().startswith(col_name.lower())]

    # Reconstruct
    squashed = f"CREATE TABLE IF NOT EXISTS public.{table_name} (\n"
    squashed += ",\n".join([f"    {c}" for c in columns])
    squashed += "\n);\n"
    
    # Enable RLS
    if 'ENABLE ROW LEVEL SECURITY' in content.upper():
        squashed += f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;\n"
        
    return squashed

files = glob.glob(os.path.join(tables_dir, '*.sql'))
squashed_all = []

for f in files:
    table_name = os.path.basename(f).replace('.sql', '')
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    squashed_all.append(f"-- TABLE: {table_name}")
    squashed_all.append(squash_table(content, table_name))
    squashed_all.append("")

with open(output_file, 'w', encoding='utf-8') as file:
    file.write('\n'.join(squashed_all))

print(f"Squashed tables saved to {output_file}")
