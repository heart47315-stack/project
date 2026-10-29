import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputDir] = process.argv.slice(2);
if (!inputPath || !outputDir) {
  console.error('Usage: node scripts/split-finetune-dataset.mjs <input.jsonl> <output-dir>');
  process.exit(2);
}

const piiPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:\+?66|0)[ -]?\d(?:[ -]?\d){8,9}\b/u,
  /\b\d{13}\b/u,
];
const groups = { train: [], validation: [], test: [] };
const seen = new Set();
for (const [index, line] of fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean).entries()) {
  let row;
  try { row = JSON.parse(line); } catch { throw new Error(`line ${index + 1}: invalid JSON`); }
  if (!Array.isArray(row.messages) || !row.messages.some((message) => message.role === 'user') || !row.messages.some((message) => message.role === 'assistant')) throw new Error(`line ${index + 1}: messages must include user and assistant`);
  if (row.metadata?.expert_reviewed !== true || row.metadata?.contains_phi !== false) throw new Error(`line ${index + 1}: requires expert_reviewed=true and contains_phi=false`);
  const serialized = JSON.stringify(row);
  if (piiPatterns.some((pattern) => pattern.test(serialized))) throw new Error(`line ${index + 1}: possible personal data detected`);
  const fingerprint = crypto.createHash('sha256').update(serialized).digest('hex');
  if (seen.has(fingerprint)) throw new Error(`line ${index + 1}: duplicate example`);
  seen.add(fingerprint);
  const bucket = parseInt(fingerprint.slice(0, 8), 16) % 100;
  groups[bucket < 80 ? 'train' : bucket < 90 ? 'validation' : 'test'].push(row);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const [name, rows] of Object.entries(groups)) fs.writeFileSync(path.join(outputDir, `${name}.jsonl`), rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
console.log(`Wrote train=${groups.train.length}, validation=${groups.validation.length}, test=${groups.test.length}.`);
