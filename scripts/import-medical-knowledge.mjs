import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const [inputPath] = process.argv.slice(2);
const apply = process.argv.includes('--apply');
if (!inputPath) {
  console.error('Usage: node scripts/import-medical-knowledge.mjs <documents.jsonl> [--apply]');
  process.exit(2);
}

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const phonePattern = /(?:\+?66|0)[ -]?\d(?:[ -]?\d){8,9}\b/u;
const thaiIdPattern = /\b\d{13}\b/u;
const maxChars = 3000;
const overlap = 300;

function chunkText(text) {
  const normalized = String(text).replace(/\r\n?/gu, '\n').trim();
  if (normalized.length <= maxChars) return [normalized];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf('\n\n', end);
      if (boundary > start + Math.floor(maxChars * 0.55)) end = boundary;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const rows = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean);
const records = [];
for (const [lineIndex, line] of rows.entries()) {
  let document;
  try { document = JSON.parse(line); } catch { throw new Error(`line ${lineIndex + 1}: invalid JSON`); }
  const required = ['title', 'content', 'source'];
  for (const field of required) if (typeof document[field] !== 'string' || !document[field].trim()) throw new Error(`line ${lineIndex + 1}: ${field} is required`);
  const status = document.status || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error(`line ${lineIndex + 1}: invalid status`);
  if (status === 'approved' && (!document.approved_by || !document.approved_at)) throw new Error(`line ${lineIndex + 1}: approved documents require approved_by and approved_at`);
  const searchable = `${document.title}\n${document.content}`;
  if (emailPattern.test(searchable) || phonePattern.test(searchable) || thaiIdPattern.test(searchable)) throw new Error(`line ${lineIndex + 1}: possible personal data detected; remove it before import`);
  const documentHash = hash(JSON.stringify({ title: document.title, source: document.source, source_url: document.source_url || '', content: document.content }));
  const chunks = chunkText(document.content);
  chunks.forEach((content, chunkIndex) => records.push({
    title: document.title,
    content,
    category: document.category || null,
    source: document.source,
    source_url: document.source_url || null,
    document_hash: documentHash,
    content_hash: hash(`${documentHash}:${chunkIndex}:${content}`),
    chunk_index: chunkIndex,
    chunk_count: chunks.length,
    metadata: { ...(document.metadata || {}), document_hash: documentHash },
    status,
    approved_by: status === 'approved' ? document.approved_by : null,
    approved_at: status === 'approved' ? document.approved_at : null,
  }));
}

if (!apply) {
  console.log(`Dry run: validated ${rows.length} documents into ${records.length} chunks. No database was changed.`);
  process.exit(0);
}
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[name]) throw new Error(`${name} must be set in a server-only environment`);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await supabase.from('medical_knowledge').upsert(records, { onConflict: 'content_hash', ignoreDuplicates: true });
if (error) throw new Error(`Could not import medical knowledge: ${error.message}`);
console.log(`Imported ${records.length} chunks idempotently. Existing content hashes were not duplicated.`);
