const { createChunker } = require('../src/chunker');
const sample = ('เอกสารภาษาไทยสำหรับตรวจสอบระยะซ้อนทับและการแบ่งข้อความ MEDSAFE AI '.repeat(100));
const result = createChunker()(sample);
let bad = 0;
for (let i = 1; i < result.chunks.length; i++) {
  const prev = result.chunks[i - 1], curr = result.chunks[i];
  const overlap = Math.max(0, prev.end - curr.start);
  console.log(`chunk ${i}: overlap=${overlap}`);
  if (curr.start >= prev.end) bad++;
}
console.log(`AUDIT: chunks=${result.chunks.length}, non-overlap transitions=${bad}`);
