const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'dist');
fs.mkdirSync(target, { recursive: true });
for (const file of ['index.html', 'studio.html', 'privacy.html', 'terms.html']) fs.copyFileSync(path.join(root, file), path.join(target, file));
fs.cpSync(path.join(root, 'assets'), path.join(target, 'assets'), { recursive: true });
console.log('Static site prepared in dist/.');
