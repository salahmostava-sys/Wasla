import re, os
paths = ['frontend/services/employeeService.test.ts', 'frontend/modules/employees/model/__tests__/employeeUtils.test.ts', 'frontend/shared/lib/__tests__/nameMatching.test.ts', 'frontend/shared/lib/security/__tests__/sanitize.test.ts']
for p in paths:
    with open(p, 'r', encoding='utf8') as f:
        c = f.read()
    c = re.sub(r'expect\((.*?)\.length\)\.toBe\((.*?)\)', r'expect(\1).toHaveLength(\2)', c)
    with open(p, 'w', encoding='utf8') as f:
        f.write(c)
print("Tests fixed properly")
