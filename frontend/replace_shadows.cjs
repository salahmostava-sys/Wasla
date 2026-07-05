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

    // Replace hover variants first
    content = content.replace(/hover:shadow-(violet|amber)-\d+/g, 'hover:shadow-card-hover');
    content = content.replace(/hover:shadow-(md|lg)/g, 'hover:shadow-card-hover');

    // Replace base variants
    content = content.replace(/shadow-(violet|amber)-\d+/g, 'shadow-card');
    content = content.replace(/shadow-(md|lg)/g, 'shadow-card');

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  });
}

runReplace('d:/MuhimmatAltawseel/frontend/modules');
runReplace('d:/MuhimmatAltawseel/frontend/shared');
