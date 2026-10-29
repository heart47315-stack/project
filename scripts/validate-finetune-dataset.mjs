import fs from 'node:fs';

const [filePath, ...args] = process.argv.slice(2);
if (!filePath || args.length) {
  console.error('Usage: node scripts/validate-finetune-dataset.mjs <dataset.jsonl>');
  process.exit(2);
}

const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
const errors = [];
const seen = new Set();
for (const [index, line] of lines.entries()) {
  const lineNumber = index + 1;
  let row;
  try { row = JSON.parse(line); } catch { errors.push(`line ${lineNumber}: invalid JSON`); continue; }
  if (!Array.isArray(row.messages) || row.messages.length < 2) errors.push(`line ${lineNumber}: messages must contain at least one user and one assistant message`);
  const roles = row.messages?.map((message) => message?.role);
  if (!roles?.includes('user') || !roles?.includes('assistant')) errors.push(`line ${lineNumber}: messages must include user and assistant roles`);
  for (const message of row.messages || []) {
    if (!['system', 'user', 'assistant'].includes(message?.role)) errors.push(`line ${lineNumber}: unsupported message role`);
    if (typeof message?.content !== 'string' || !message.content.trim()) errors.push(`line ${lineNumber}: message content must be non-empty text`);
  }
  const id = row.metadata?.example_id;
  if (id && seen.has(id)) errors.push(`line ${lineNumber}: duplicate metadata.example_id ${id}`);
  if (id) seen.add(id);
  if (row.metadata?.contains_phi === true) errors.push(`line ${lineNumber}: contains_phi must be false before export`);
  if (row.metadata?.expert_reviewed !== true) errors.push(`line ${lineNumber}: expert_reviewed must be true`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${lines.length} JSONL examples. No dataset was uploaded or sent to an external service.`);
