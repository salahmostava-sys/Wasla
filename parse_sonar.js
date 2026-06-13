const fs = require('fs');
let data = fs.readFileSync('sonar_issues_utf8.json', 'utf8');
if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
const issues = JSON.parse(data).issues;
const hotspots = issues.filter(i => i.type === 'SECURITY_HOTSPOT' || i.type === 'VULNERABILITY' || i.rule.includes('HOTSPOT') || i.rule.includes('security'));

console.log('--- Hotspots All ---');
hotspots.forEach(h => console.log(`${h.component}:${h.line} - ${h.message}`));

const newCodeIssues = issues.filter(i => ['ai-backend', 'server', 'api'].some(f => i.component.includes(f)));
console.log('--- Other Issues on New Files ---');
newCodeIssues.forEach(i => console.log(`${i.type} - ${i.component}:${i.line} - ${i.message}`));
