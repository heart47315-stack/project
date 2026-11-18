// Builds a self-contained n8n Code-node source file from src/chunker.js.
// Does not connect to n8n or deploy anything.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src/chunker.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'n8n/wrapper.js'), 'utf8');
const output = `// GENERATED FILE. Rebuild with: npm run build\n${core.replace("module.exports = { createChunker, normalize, boundaries, safeBoundary, DEFAULTS };", "")}\n${wrapper}\n`;
const target = path.join(root, 'n8n/split-text-into-chunks.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) {
    console.error('BUILD CHECK FAILED: generated n8n file is missing or stale. Run npm run build.');
    process.exit(1);
  }
  console.log('BUILD CHECK PASS');
} else {
  fs.writeFileSync(target, output, 'utf8');
  console.log(`Generated ${path.relative(root, target)}`);
}
