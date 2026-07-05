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

    const tagRegex = /<([a-zA-Z0-9_]+)([^>]*?text-(right|left)[^>]*?)>/g; // NOSONAR
    
    content = content.replace(tagRegex, (match, tagName, attrs, rightOrLeft) => {
      if (attrs.includes('dir="ltr"') || attrs.includes("dir='ltr'") || attrs.includes("tabular-nums")) {
        return match;
      }
      
      let newAttrs = attrs
        .replace(/\btext-right\b/g, 'text-start')
        .replace(/\btext-left\b/g, 'text-end');
      
      return `<${tagName}${newAttrs}>`;
    });

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  });
}

runReplace('d:/MuhimmatAltawseel/frontend/modules');
runReplace('d:/MuhimmatAltawseel/frontend/shared');
