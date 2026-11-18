const test = require('node:test');
const assert = require('node:assert/strict');
const { createChunker, normalize } = require('../src/chunker');

test('normalizes line endings and repeated whitespace', () => {
  assert.equal(normalize(' A  B\r\n\r\n\r\nC '), 'A B\n\nC');
});

test('empty input returns no chunks', () => {
  assert.deepEqual(createChunker()('  ').chunks, []);
});

test('short input remains one exact chunk', () => {
  const s = 'ข้อความทดสอบ MEDSAFE';
  const r = createChunker()(s);
  assert.equal(r.chunks.length, 1);
  assert.equal(r.chunks[0].content, s);
});

test('long text produces bounded chunks and preserves final marker', () => {
  const marker = 'FINAL-MARKER-XYZ';
  const s = ('ข้อความภาษาไทยสำหรับทดสอบระบบ RAG '.repeat(100)) + marker;
  const r = createChunker()(s);
  assert.ok(r.chunks.length > 1);
  assert.ok(r.chunks.every(c => c.content.length <= 1000));
  assert.ok(r.chunks.at(-1).content.includes(marker));
});

test('chunk metadata ranges are valid', () => {
  const r = createChunker()('abc '.repeat(900));
  for (const c of r.chunks) {
    assert.ok(c.start >= 0);
    assert.ok(c.end > c.start);
    assert.ok(c.end <= r.text.length);
    assert.equal(c.content, r.text.slice(c.start, c.end));
  }
});

test('invalid configuration is rejected', () => {
  assert.throws(() => createChunker({ chunkSize: 20 }), /chunkSize/);
  assert.throws(() => createChunker({ chunkSize: 500, overlap: 500 }), /overlap/);
});
