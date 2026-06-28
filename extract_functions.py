import re

with open('d:\\MuhimmatAltawseel\\supabase\\migrations\\20260415000001_constants.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all CREATE OR REPLACE FUNCTION blocks
pattern = re.compile(r"CREATE OR REPLACE FUNCTION .*?\$\$", re.DOTALL)
functions = pattern.findall(content)

with open('d:\\MuhimmatAltawseel\\fix_db_functions.sql', 'w', encoding='utf-8') as f:
    f.write("\n\n".join(functions))

print("Extracted functions")
