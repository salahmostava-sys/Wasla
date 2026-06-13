import os
import re

TEST_DIR = "frontend/services"

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # 1. Fix vehicleService.test.ts, shiftService.test.ts, etc.
    # Pattern: 
    # then: (resolve: any) => Promise.resolve(mockObj).then(resolve),
    
    # Actually, we can just replace the whole builder creation if we know the pattern.
    # In most files:
    # return {
    #   select: vi.fn().mockReturnThis(),
    #   ...
    #   then: ...
    # }
    
    # Since there are only 9 files, let's just do custom replacements for the common patterns.
    
    content = re.sub(
        r"return \{\s+select: vi\.fn\(\)\.mockReturnThis\(\),\s+(.*?)\s+then: \(resolve: any\) => Promise\.resolve\((.*?)\)\.then\(resolve\),?\s+\};",
        r"const p: any = Promise.resolve(\2);\n          p.select = vi.fn().mockReturnValue(p);\n          \1\n          return p;",
        content,
        flags=re.DOTALL
    )

    # Some use return { ... then: settled.then.bind(settled) }
    # bulkDeleteService:
    if "makeDeleteBuilder" in content:
        content = re.sub(
            r"const settled = Promise\.resolve\(result\);\n\s+const b = \{\n(.*?)\n\s+then: settled\.then\.bind\(settled\),\n\s+catch: settled\.catch\.bind\(settled\),\n\s+finally: settled\.finally\.bind\(settled\),\n\s+\};\n\s+return b;",
            r"const b: any = Promise.resolve(result);\n\1\n  return b;",
            content,
            flags=re.DOTALL
        )
        content = re.sub(r"(\w+): vi\.fn\(\(\) => b\),", r"b.\1 = vi.fn(() => b);", content)

    # authService.test.ts:
    if "makeDeleteBuilder" not in content and "settled.then.bind(settled)" in content:
        content = re.sub(
            r"const settled = Promise\.resolve\(result\);\n\s+return \{\n(.*?)\n\s+then: settled\.then\.bind\(settled\),\n\s+catch: settled\.catch\.bind\(settled\),\n\s+finally: settled\.finally\.bind\(settled\),\n\s+\};",
            r"const p: any = Promise.resolve(result);\n\1\n      return p;",
            content,
            flags=re.DOTALL
        )
        content = re.sub(r"\s+(\w+): vi\.fn\(\(\) => (?:this|builder|b|\w+)\),?", r"      p.\1 = vi.fn().mockReturnValue(p);", content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)


for file in os.listdir(TEST_DIR):
    if file.endswith(".test.ts"):
        fix_file(os.path.join(TEST_DIR, file))

