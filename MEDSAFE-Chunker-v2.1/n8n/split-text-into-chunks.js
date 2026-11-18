// GENERATED FILE. Rebuild with: npm run build
// MEDSAFE Chunker v2.1 - reconstructed standalone implementation.
// Local-only: no network, Supabase, n8n API, credentials, or production writes.
'use strict';

const DEFAULTS = Object.freeze({ chunkSize: 1000, overlap: 200, minTail: 300 });

function normalize(input) {
  return String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getSegmenter(locale, granularity) {
  try {
    return typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter(locale, { granularity }) : null;
  } catch { return null; }
}

function boundaries(text, segmenter) {
  const set = new Set([0, text.length]);
  if (segmenter) {
    for (const part of segmenter.segment(text)) set.add(part.index);
    return set;
  }
  // Fallback: code-point boundaries; excludes combining marks, variation selectors,
  // emoji modifiers and ZWJ continuation points. This is conservative, not a full
  // replacement for Unicode extended grapheme segmentation.
  let offset = 0;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], cp = ch.codePointAt(0), start = offset;
    offset += ch.length;
    const continuation = /\p{M}/u.test(ch) ||
      (cp >= 0xFE00 && cp <= 0xFE0F) ||
      (cp >= 0x1F3FB && cp <= 0x1F3FF) || cp === 0x200D ||
      (i > 0 && chars[i - 1].codePointAt(0) === 0x200D);
    if (!continuation) set.add(start);
    set.add(offset);
  }
  return set;
}

function safeBoundary(text, index, points) {
  if (index <= 0 || index >= text.length || !points.has(index)) return false;
  const left = text.slice(index - 2, index);
  const right = text.slice(index, index + 2);
  if (/[\uDC00-\uDFFF]/u.test(right[0] || '')) return false;
  if (/\p{M}/u.test(right[0] || '') || right.startsWith('\u200D')) return false;
  if (left.endsWith('\u200D')) return false;
  // Avoid splitting Thai leading vowels from the following consonant.
  if (/[\u0E40-\u0E44]$/u.test(left) && /[\u0E01-\u0E2E]/u.test(right[0] || '')) return false;
  return true;
}

function scoreBoundary(text, i, wordSegmenter) {
  const before = text[i - 1] || '';
  if (before === '\n') return 100;
  if (/\s/u.test(before)) return 85;
  if (/[.!?。！？;:]/u.test(before)) return 75;
  if (wordSegmenter) {
    for (const part of wordSegmenter.segment(text)) {
      if (part.index === i && part.isWordLike) return 55;
    }
  }
  return 0;
}

function createChunker(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  if (!Number.isInteger(cfg.chunkSize) || cfg.chunkSize < 100) throw new Error('chunkSize must be an integer >= 100');
  if (!Number.isInteger(cfg.overlap) || cfg.overlap < 0 || cfg.overlap >= cfg.chunkSize) throw new Error('overlap must be >= 0 and < chunkSize');

  return function chunk(input) {
    const text = normalize(input);
    if (!text) return { text, chunks: [], segmenterAvailable: !!getSegmenter('th', 'grapheme') };

    const grapheme = getSegmenter('th', 'grapheme');
    const word = getSegmenter('th', 'word');
    const points = boundaries(text, grapheme);
    const chunks = [];
    let start = 0;
    let iterations = 0;

    while (start < text.length && iterations++ < text.length + 10) {
      const hardEnd = Math.min(start + cfg.chunkSize, text.length);
      let end = hardEnd;
      let endReason = hardEnd === text.length ? 'EOF' : 'HARD_LIMIT';

      if (hardEnd < text.length) {
        const minEnd = Math.max(start + Math.floor(cfg.chunkSize * 0.65), hardEnd - 120);
        let best = -1, bestScore = -Infinity;
        for (let i = hardEnd; i >= minEnd; i--) {
          if (!safeBoundary(text, i, points)) continue;
          const score = scoreBoundary(text, i, word) + (i / Math.max(1, hardEnd)) * 0.001;
          if (score > bestScore) { best = i; bestScore = score; }
          if (score >= 85) break;
        }
        if (best > start) {
          end = best;
          if (bestScore >= 55) endReason = 'NATURAL_BOUNDARY';
        } else {
          while (end > start && !safeBoundary(text, end, points)) end--;
          if (end <= start) throw new Error('No safe boundary found');
        }
      }

      const raw = text.slice(start, end);
      const leading = raw.length - raw.trimStart().length;
      const content = raw.trim();
      if (content) {
        const actualStart = start + leading;
        chunks.push({
          content,
          start: actualStart,
          end: actualStart + content.length,
          startReason: chunks.length ? 'OVERLAP' : 'START',
          endReason
        });
      }
      if (end >= text.length) break;

      const target = Math.max(start + 1, end - cfg.overlap);
      let next = target, best = -Infinity, chosen = -1;
      const low = Math.max(start + 1, target - 80);
      const high = Math.min(end - 1, target + 80);
      for (let i = low; i <= high; i++) {
        if (!safeBoundary(text, i, points)) continue;
        const score = scoreBoundary(text, i, word) - Math.abs(i - target) / 25;
        if (score > best) { best = score; chosen = i; }
      }
      if (chosen > start && chosen < end) next = chosen;
      else {
        while (next > start && !safeBoundary(text, next, points)) next--;
      }
      if (next <= start || next >= end) next = Math.max(start + 1, end - cfg.overlap);
      start = next;
    }

    if (iterations >= text.length + 10) throw new Error('Chunk loop safety limit reached');
    return { text, chunks, segmenterAvailable: !!grapheme };
  };
}



// Template fragment for manual adaptation inside an n8n Code node.
// This file is NOT deployed and does not call n8n APIs.
const chunkText = createChunker();
const output = [];

for (const item of $input.all()) {
  const sourceText = item.json?.text ?? item.json?.content ?? '';
  const result = chunkText(sourceText);
  result.chunks.forEach((chunk, index) => {
    output.push({
      json: {
        ...item.json,
        content: chunk.content,
        chunk_index: index,
        total_chunks: result.chunks.length,
        char_count: chunk.content.length,
        chunk_start: chunk.start,
        chunk_end: chunk.end,
        chunk_end_reason: chunk.endReason
      }
    });
  });
}
return output;

