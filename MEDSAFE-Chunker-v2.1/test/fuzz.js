// Deterministic smoke fuzz; does not claim a 2,400-case validation.
const { createChunker } = require('../src/chunker');
const chunk = createChunker();
let seed = 47315;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const atoms = ['ภาษาไทย', 'MEDSAFE', 'RAG ', 'ทดสอบ ', '🙂', 'กิ่', '\n', '123 ', 'ข้อมูลยา'];
let count = 0;
for (let n = 0; n < 120; n++) {
  let s = '';
  const size = 10 + Math.floor(rand() * 5000);
  while (s.length < size) s += atoms[Math.floor(rand() * atoms.length)];
  const r = chunk(s);
  if (!r.chunks.length && s.trim()) throw new Error(`No chunks at case ${n}`);
  for (const c of r.chunks) {
    if (!c.content || c.content.length > 1000) throw new Error(`Invalid chunk at case ${n}`);
  }
  count++;
}
console.log(`FUZZ SMOKE PASS: ${count} deterministic cases`);
