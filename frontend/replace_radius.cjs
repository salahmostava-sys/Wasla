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

    const regex = /className=["\\'`]+([^"\\'`>]+)["\\'`]+/g;
    content = content.replace(regex, (match, classList) => {
      if (classList.includes('bg-card') || classList.includes('shadow-card') || classList.includes('tailcard') || classList.includes('metric-card') || classList.includes('stat-card') || classList.includes('chart-card')) {
        let newClassList = classList
          .replace(/\brounded-(none|sm|md|lg|xl|3xl)\b/g, '')
          .replace(/\brounded\b/g, '')
          .trim();
        
        if (!newClassList.includes('rounded-2xl') && !newClassList.includes('rounded-full')) {
           newClassList += ' rounded-2xl';
        }
        
        newClassList = newClassList.replace(/\s+/g, ' ');
        return match.replace(classList, newClassList);
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
