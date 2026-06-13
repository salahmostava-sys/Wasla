import os
import re

TEST_DIR = "frontend/services"

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Generic replace for any `then: (resolve: any) => Promise.resolve(...).then(resolve)`
    # The structure is usually inside an object:
    # return { ... then: ... }
    
    # Let's just find `then:` lines and replace the whole mock object block if possible.
    # Actually, it's easier to find the `return { ... then: ... }` blocks and replace them.

    # Block matcher
    pattern = re.compile(r"return\s+\{\s+select: vi\.fn\(\)\.mockReturnThis\(\),\s+(.*?)\s+then:\s+(.*?)\n\s*\};", re.DOTALL)
    
    def replacer(match):
        methods = match.group(1)
        then_line = match.group(2)
        
        # Extract the promise part
        if "Promise.resolve" in then_line:
            # e.g., (resolve: any) => Promise.resolve({ data, count: 2, error: null }).then(resolve)
            m = re.search(r"Promise\.resolve\((.*?)\)\.then", then_line)
            if m:
                obj = m.group(1)
                return f"const p: any = Promise.resolve({obj});\n          p.select = vi.fn().mockReturnValue(p);\n          {methods}\n          return p;"
            # Or if it's like `(res: any) => result.then(res)`
            m = re.search(r"result\.then\(", then_line)
            if m:
                return f"const p: any = Promise.resolve(result);\n          p.select = vi.fn().mockReturnValue(p);\n          {methods}\n          return p;"

        return match.group(0) # unchanged if not matched

    new_content = pattern.sub(replacer, content)
    
    # salaryDraftService.test.ts has a makeDeleteBuilder-like thing
    # "then: settled.then.bind(settled),"
    if "then: settled.then.bind(settled)" in new_content:
        new_content = re.sub(
            r"const settled = Promise\.resolve\(result\);\n\s+return \{\n(.*?)then:\s+settled\.then\.bind\(settled\),.*?\};",
            r"const p: any = Promise.resolve(result);\n\1return p;",
            new_content,
            flags=re.DOTALL
        )
        new_content = re.sub(r"(\w+):\s+vi\.fn\(\(\) => (?:this|builder|b|p)\),", r"p.\1 = vi.fn().mockReturnValue(p);", new_content)

    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for file in os.listdir(TEST_DIR):
    if file.endswith(".test.ts"):
        fix_file(os.path.join(TEST_DIR, file))

