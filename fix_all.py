import os
import re

TEST_DIR = "frontend/services"

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    
    # We want to match `return { \n ... \n then: ... \n };`
    # and extract all the keys and the `then:` resolution target.
    
    # We will find blocks that start with `return {` and end with `};`
    # inside those blocks, if there is a `then: `, we replace it.
    
    def replacer(match):
        block = match.group(0)
        if "then: " not in block:
            return block
            
        # Extract the promise target
        promise_target = None
        # look for `then: (resolve: any) => Promise.resolve(mockObj).then(resolve),`
        m = re.search(r"Promise\.resolve\((.*?)\)\.then", block)
        if m:
            promise_target = m.group(1)
        else:
            m2 = re.search(r"then: \(.*?\)\s*=>\s*(.*?)\.then", block)
            if m2:
                promise_target = m2.group(1)
            else:
                m3 = re.search(r"then:\s*settled\.then\.bind\(settled\)", block)
                if m3:
                    promise_target = "result"
                else:
                    return block # couldn't figure out promise
                
        # Extract methods
        methods = []
        for line in block.split('\n'):
            line = line.strip()
            if not line or line == 'return {' or line == '};' or line.startswith('//'):
                continue
            if line.startswith('then:') or line.startswith('catch:') or line.startswith('finally:'):
                continue
                
            # e.g. `select: vi.fn().mockReturnThis(),`
            # or `single: vi.fn().mockResolvedValue(mockObj),`
            # we want to transform this to `p.select = vi.fn().mockReturnValue(p);`
            
            # extract key and the value
            parts = line.split(":", 1)
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip()
                if val.endswith(','):
                    val = val[:-1]
                
                # if value uses mockReturnThis(), replace with mockReturnValue(p)
                if 'mockReturnThis()' in val:
                    val = val.replace('mockReturnThis()', 'mockReturnValue(p)')
                # if value uses `() => b` (bulkDeleteService)
                elif '() => b' in val:
                    val = val.replace('() => b', '() => p')
                    
                methods.append(f"p.{key} = {val};")
                
        # construct the new block
        out = f"const p: any = Promise.resolve({promise_target});\n"
        for m in methods:
            out += f"        {m}\n"
        out += "        return p;"
        
        # indent it based on the `return {` indentation
        indent = match.group(1)
        out = out.replace('\n', '\n' + indent)
        # Fix the first line indentation
        out = out.strip()
        out = indent + out
        
        return out

    new_content = re.sub(r"([ \t]*)return\s+\{([\s\S]*?)\};", replacer, content)

    # Some tests do not use `return { ... }` directly but assign to a variable `const b = { ... }` and return it.
    def replacer_const(match):
        block = match.group(0)
        if "then: " not in block:
            return block
        
        # e.g. bulkDeleteService.test.ts:
        # const b = { ... };
        # return b;
        promise_target = None
        if "settled.then.bind" in block:
            promise_target = "result"
        elif "Promise.resolve(" in block:
            m = re.search(r"Promise\.resolve\((.*?)\)\.then", block)
            if m: promise_target = m.group(1)
        
        if not promise_target:
            return block
            
        methods = []
        for line in block.split('\n'):
            line = line.strip()
            if not line or line.startswith('const ') or line == '};' or line.startswith('//'):
                continue
            if line.startswith('then:') or line.startswith('catch:') or line.startswith('finally:'):
                continue
                
            parts = line.split(":", 1)
            if len(parts) == 2:
                key = parts[0].strip()
                val = parts[1].strip()
                if val.endswith(','):
                    val = val[:-1]
                if 'mockReturnThis()' in val:
                    val = val.replace('mockReturnThis()', 'mockReturnValue(p)')
                elif '() => b' in val:
                    val = val.replace('() => b', '() => p')
                methods.append(f"p.{key} = {val};")
                
        out = f"const p: any = Promise.resolve({promise_target});\n"
        for m in methods:
            out += f"    {m}\n"
        out += "    return p;"
        return out
        
    new_content = re.sub(r"const\s+\w+\s*=\s*\{([\s\S]*?)\};\n\s*return\s+\w+;", replacer_const, new_content)
    
    # authService.test.ts has `return { ... then: settled.then.bind(settled) ... }`
    if "then: settled.then.bind(settled)" in new_content:
        new_content = re.sub(
            r"const settled = Promise\.resolve\(result\);\n\s+return \{\n([\s\S]*?)then:\s+settled\.then\.bind\(settled\),[\s\S]*?finally: settled\.finally\.bind\(settled\),\n\s+\};",
            lambda m: replacer(re.match(r"([ \t]*)return", m.group(0))), # won't work well
            new_content
        )
        
    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for file in os.listdir(TEST_DIR):
    if file.endswith(".test.ts"):
        fix_file(os.path.join(TEST_DIR, file))

