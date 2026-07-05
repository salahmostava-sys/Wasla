const fs = require('node:fs');
const path = require('node:path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceClasses(str, tag, baseClass, classesToRemove) {
  const regex = new RegExp('<' + tag + '[^>]*className=["\\\'`]+([^"\\\'`>]+)["\\\'`]+[^>]*>', 'g');
  return str.replace(regex, (match, className) => {
    let classes = className.split(/\s+/);
    let newClasses = classes.filter(c => !classesToRemove.test(c));
    if (newClasses.length < classes.length) {
      newClasses.unshift(baseClass);
      let newClassName = Array.from(new Set(newClasses)).join(' ');
      return match.replace(className, newClassName);
    }
    return match;
  });
}

function runReplace(dir) {
  walkDir(dir, filepath => {
    if (!filepath.endsWith('.tsx')) return;
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    content = content.replace(/className=["']data-table-wrapper["']/g, 'className="ta-table-wrap"');
    content = content.replace(/className=["']data-table["']/g, 'className="ta-table"');

    const thRemove = /^(px-\d+|py-\d+(\.\d+)?|text-xs|text-sm|font-semibold|text-muted-foreground|whitespace-nowrap|text-center|uppercase|tracking-wide)$/;
    content = replaceClasses(content, 'th', 'ta-th', thRemove);

    const tdRemove = /^(px-\d+|py-\d+(\.\d+)?|text-xs|text-sm|text-center|whitespace-nowrap)$/;
    content = replaceClasses(content, 'td', 'ta-td', tdRemove);

    content = content.replace(/className=["']bg-muted\/\d+ border-b border-border\/\d+["']/g, 'className="ta-thead"');

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  });
}

runReplace('d:/MuhimmatAltawseel/frontend/modules');
runReplace('d:/MuhimmatAltawseel/frontend/shared');
