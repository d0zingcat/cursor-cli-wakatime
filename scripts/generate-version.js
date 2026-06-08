const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const out = `export const VERSION = '${pkg.version}';\n`;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'version.ts'), out);
