const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('generated n8n code exists and is self-contained', () => {
  const p = path.join(__dirname, '../n8n/split-text-into-chunks.js');
  assert.ok(fs.existsSync(p), 'run npm run build first');
  const source = fs.readFileSync(p, 'utf8');
  assert.match(source, /GENERATED FILE/);
  assert.match(source, /createChunker/);
  assert.match(source, /return output/);
});
