const fs = require('fs');
const path = require('path');

const DIR = 'frontend/services';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.test.ts'));

for (const file of files) {
  const p = path.join(DIR, file);
  let content = fs.readFileSync(p, 'utf8');

  let original = content;

  // Replace standard fromMock builder
  // We look for:
  // return {
  //   select: vi.fn().mockReturnThis(),
  //   ...
  //   then: (resolve: any) => Promise.resolve(...).then(resolve),
  // };
  // Or similar variations

  const regex = /return \{\s+select: vi\.fn\(\)\.mockReturnThis\(\),([\s\S]*?)then:\s*(.*?),\s*\};/gm;
  
  content = content.replace(regex, (match, methodsStr, thenLine) => {
    // Extract the promise part
    let promiseContent = '';
    const m1 = thenLine.match(/Promise\.resolve\((.*?)\)\.then/);
    if (m1) {
      promiseContent = m1[1];
    } else if (thenLine.includes('result.then')) {
      promiseContent = 'result';
    } else {
      return match; // fallback
    }

    // Process methods
    const methods = [];
    const lines = methodsStr.split('\n');
    for (let l of lines) {
      const parts = l.match(/(\w+):\s*vi\.fn\(\)\.mockReturnThis\(\),?/g);
      if (parts) {
        for (let p of parts) {
          const fnName = p.split(':')[0].trim();
          methods.push(fnName);
        }
      } else {
          // Look for maybeSingle: vi.fn().mockReturnValue(Promise.resolve(result)),
          const otherMatch = l.match(/(\w+):\s*vi\.fn\(\)\.mockResolvedValue\((.*?)\),?/);
          if (otherMatch) {
             methods.push({name: otherMatch[1], value: otherMatch[2]});
          }
      }
    }

    let out = `const p: any = Promise.resolve(${promiseContent});\n`;
    out += `        p.select = vi.fn().mockReturnValue(p);\n`;
    for (const m of methods) {
      if (typeof m === 'string') {
        out += `        p.${m} = vi.fn().mockReturnValue(p);\n`;
      } else {
        out += `        p.${m.name} = vi.fn().mockResolvedValue(${m.value});\n`;
      }
    }
    out += `        return p;`;

    return out;
  });

  // authService has channelMock
  // const settled = Promise.resolve(result);
  // return {
  //   on: vi.fn().mockReturnThis(),
  //   subscribe: vi.fn().mockReturnThis(),
  //   then: settled.then.bind(settled),
  //   catch: settled.catch.bind(settled),
  //   finally: settled.finally.bind(settled),
  // };
  const authRegex = /const settled = Promise\.resolve\(result\);\s+return \{\s+on: vi\.fn\(\)\.mockReturnThis\(\),\s+subscribe: vi\.fn\(\)\.mockReturnThis\(\),[\s\S]*?finally: settled\.finally\.bind\(settled\),\s+\};/g;
  content = content.replace(authRegex, `const p: any = Promise.resolve(result);\n      p.on = vi.fn().mockReturnValue(p);\n      p.subscribe = vi.fn().mockReturnValue(p);\n      return p;`);

  if (content !== original) {
    fs.writeFileSync(p, content);
    console.log(`Fixed ${file}`);
  }
}
