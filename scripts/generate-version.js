const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

fs.writeFileSync(path.join(root, 'src', 'version.ts'), `export const VERSION = '${version}';\n`);

for (const relPath of ['.cursor-plugin/plugin.json', '.cursor-plugin/marketplace.json']) {
  const filePath = path.join(root, relPath);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  json.version = version;
  if (json.plugins?.[0]) {
    json.plugins[0].version = version;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}
