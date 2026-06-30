import re

with open('scratch/schema_history.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# We will break down by table name
table_history = {}

# Simple heuristic: find lines starting with CREATE TABLE or ALTER TABLE
lines = content.split('\n')
current_table = None
buffer = []

for line in lines:
    m = re.search(r'(CREATE\s+TABLE|ALTER\s+TABLE)\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?([a-zA-Z0-9_]+)', line, re.IGNORECASE)  # NOSONAR
    if m:
        if current_table and buffer:
            if current_table not in table_history:
                table_history[current_table] = []
            table_history[current_table].append('\n'.join(buffer))
        current_table = m.group(4)
        buffer = [line]
    else:
        if current_table:
            buffer.append(line)

if current_table and buffer:
    if current_table not in table_history:
        table_history[current_table] = []
    table_history[current_table].append('\n'.join(buffer))

import os
os.makedirs('scratch/tables', exist_ok=True)
for table, hist in table_history.items():
    with open(f'scratch/tables/{table}.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(hist))
        
print(f"Grouped into {len(table_history)} tables.")
