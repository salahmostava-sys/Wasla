const fs = require('node:fs');
const path = require('node:path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function runReplace(dir) {
  walkDir(dir, filepath => {
    if (!filepath.endsWith('.tsx') && !filepath.endsWith('.ts')) return;
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    const regex = /<Button([\s\S]*?)>([\s\S]*?)<\/Button>/g; // NOSONAR
    content = content.replace(regex, (match, attrs, innerText) => {
      if (attrs.includes('variant="outline"') || attrs.includes("variant='outline'")) {
        if (innerText.includes('إضافة') || innerText.includes('جديد') || innerText.includes('إضافه') || innerText.includes('إنشاء')) {
          let newAttrs = attrs.replace(/variant=["']outline["']/g, 'variant="default"');
          return `<Button${newAttrs}>${innerText}</Button>`;
        }
      }
      return match;
    });

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  });
}

runReplace('d:/MuhimmatAltawseel/frontend/modules');
runReplace('d:/MuhimmatAltawseel/frontend/shared');
