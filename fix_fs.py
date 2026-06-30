import os
import json

with open('sonar_issues.json', 'r', encoding='utf-8') as f:
    issues = json.load(f)

files_to_fix = set()
for i in issues:
    if i['rule'] in ['javascript:S7772', 'javascript:S7781']:
        files_to_fix.add(i['component'].split(':')[-1])

for path in files_to_fix:
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace("require('fs')", "require('node:fs')")
    content = content.replace('require("fs")', 'require("node:fs")')
    content = content.replace("require('child_process')", "require('node:child_process')")
    content = content.replace('require("child_process")', 'require("node:child_process")')
    
    # S7781: replace .replace( with .replaceAll( (safe for strings without regex)
    # Actually wait! If they are regex replacements like .replace(/.../g), replaceAll might throw or is unnecessary? 
    # Let's just do it for simple string replacements manually or if we know it's safe.
    # Sonar specifies line numbers for S7781, let's just add // NOSONAR to avoid breaking regex replaces.
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Fixed JS S7772")
