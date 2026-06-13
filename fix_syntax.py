import os
import re

TEST_DIR = "frontend/services"

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # The broken lines look like:
    #         insert: vi.fn().mockReturnThis(),
    # Or
    #         update: vi.fn().mockReturnThis(),
    # Inside the fromMock mock implementation where `const p: any = Promise.resolve` is above.

    def repl(m):
        return f"p.{m.group(1)} = vi.fn().mockReturnValue(p);"

    new_content = re.sub(r"(\w+):\s*vi\.fn\(\)\.mockReturnThis\(\),?", repl, content)

    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Fixed syntax in {filepath}")

for file in os.listdir(TEST_DIR):
    if file.endswith(".test.ts"):
        fix_file(os.path.join(TEST_DIR, file))

