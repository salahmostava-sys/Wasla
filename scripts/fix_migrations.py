import os
import re

migrations_dir = r"d:\MuhimmatAltawseel\supabase\migrations"
files = [f for f in os.listdir(migrations_dir) if f.endswith('.sql')]
files.sort()

policy_pattern = re.compile(r'^(CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s]+))', re.MULTILINE)
trigger_pattern = re.compile(r'^(CREATE TRIGGER\s+([^\s]+)\s)', re.MULTILINE)

stats = {'policies': 0, 'triggers': 0}

for filename in files:
    filepath = os.path.join(migrations_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    def replace_policy(match, content=content):
        full_match = match.group(0)
        policy_name = match.group(2)
        table_name = match.group(3).rstrip('(').strip()

        start_idx = max(0, match.start() - 200)
        before_text = content[start_idx:match.start()]
        if f'DROP POLICY IF EXISTS "{policy_name}"' in before_text:
            return full_match

        stats['policies'] += 1
        return f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};\n{full_match}'

    new_content = policy_pattern.sub(replace_policy, content)
    if new_content != content:
        modified = True
        content = new_content

    def replace_trigger(match, content=content):
        full_match = match.group(0)
        trigger_name = match.group(2)

        start_idx = max(0, match.start() - 200)
        before_text = content[start_idx:match.start()]
        if 'DROP TRIGGER IF EXISTS' in before_text:
            return full_match

        remaining_text = content[match.start():min(len(content), match.start() + 300)]
        table_match = re.search(r'ON\s+(public\.\S+)', remaining_text)
        if table_match:
            table_name = table_match.group(1).strip()
            stats['triggers'] += 1
            return f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};\n{full_match}'
        return full_match

    new_content = trigger_pattern.sub(replace_trigger, content)
    if new_content != content:
        modified = True
        content = new_content

    # Fix CREATE INDEX
    index_pattern = re.compile(r'CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\s+)(\S+)\s+ON', re.IGNORECASE)
    new_content = index_pattern.sub(r'CREATE \1INDEX IF NOT EXISTS \2 ON', content)
    if new_content != content:
        modified = True
        content = new_content
        stats.setdefault('indexes', 0)
        stats['indexes'] += 1

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched: {filename}")

print(f"Done. Policies patched: {stats['policies']}, Triggers patched: {stats['triggers']}")
