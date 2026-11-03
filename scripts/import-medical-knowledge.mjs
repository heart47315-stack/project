import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith('--')) || './dataset/medicines.json';
const apply = args.includes('--apply');
const batchSize = Math.max(1, Number(process.env.MEDICAL_BATCH_SIZE || 20));
const maxRetries = Math.max(0, Number(process.env.MEDICAL_MAX_RETRIES || 3));
const maxChars = 3000;
const overlap = 300;
const piiPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:\+?66|0)[ -]?\d(?:[ -]?\d){8,9}\b/u,
  /\b\d{13}\b/u,
];

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter(Boolean);
  const parseLine = (line) => line.match(/("(?:[^"]|"")*"|[^,]*)/gu)?.filter((value, index, values) => index < values.length - 1).map((value) => value.replace(/^"|"$/gu, '').replace(/""/gu, '')) || [];
  const headers = parseLine(lines.shift() || '');
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] || null])));
}

function loadRecords(path) {
  const text = fs.readFileSync(path, 'utf8');
  if (path.toLowerCase().endsWith('.csv')) return parseCsv(text).map(normalizeRecord);
  const records = JSON.parse(text);
  if (!Array.isArray(records)) throw new Error('Dataset root must be a JSON array');
  return records.map(normalizeRecord);
}

function normalizeRecord(record) {
  return {
    ...record,
    indications: record.indications || record.indication || null,
    generic_name: record.generic_name || record.active_ingredient || null,
    category: record.category || record.drug_type || null,
    contraindications: record.contraindications || record.restriction || null,
  };
}

function chunkText(text) {
  const normalized = String(text).replace(/\r\n?/gu, '\n').trim();
  if (normalized.length <= maxChars) return [normalized];
  const chunks = [];
  for (let start = 0; start < normalized.length;) {
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

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function withRetry(operation, label) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      console.warn(`RETRY: ${label} attempt ${attempt + 1}/${maxRetries}`);
      await sleep(500 * (2 ** attempt));
    }
  }
  throw new Error(`${label} failed after ${maxRetries + 1} attempts: ${lastError?.message || lastError}`);
}

function createContent(drug) {
  return [
    `ชื่อยา: ${drug.drug_name}`,
    `ชื่อสามัญ: ${drug.generic_name || 'ไม่ระบุ'}`,
    `ชื่อทางการค้า: ${Array.isArray(drug.trade_names) ? drug.trade_names.join(', ') || 'ไม่ระบุ' : drug.trade_names || 'ไม่ระบุ'}`,
    `สารออกฤทธิ์: ${drug.active_ingredient || drug.generic_name || 'ไม่ระบุ'}`,
    `ประเภท: ${drug.category || drug.drug_type || 'ไม่ระบุ'}`,
    `รูปแบบยา: ${drug.dosage_form || 'ไม่ระบุ'}`,
    `ข้อบ่งใช้: ${drug.indications || drug.indication}`,
    `ข้อห้ามใช้: ${drug.contraindications || drug.restriction || 'ไม่ระบุ'}`,
    `คำเตือน: ${drug.warnings || 'ไม่ระบุ'}`,
    `อาการไม่พึงประสงค์: ${drug.side_effects || 'ไม่ระบุ'}`,
    `ปฏิกิริยาระหว่างยา: ${drug.interactions || 'ไม่ระบุ'}`,
    `ข้อควรระวัง: ${drug.precautions || 'ไม่ระบุ'}`,
    `แหล่งข้อมูล: ${drug.source}`,
    `URL อ้างอิง: ${drug.source_url || 'ไม่ระบุ'}`,
    `วันที่ตรวจสอบ: ${drug.reviewed_at || 'ยังไม่ตรวจสอบ'}`,
  ].join('\n');
}

const records = loadRecords(inputPath);
const rows = [];
const seen = new Set();
for (const [index, drug] of records.entries()) {
  if (!drug?.drug_name || !drug?.indications || !drug?.source) throw new Error(`row ${index + 1}: drug_name, indications and source are required`);
  const content = createContent(drug);
  if (piiPatterns.some((pattern) => pattern.test(content))) throw new Error(`row ${index + 1}: possible personal data detected`);
  const documentHash = hash(JSON.stringify({ drug_name: drug.drug_name, source: drug.source, source_url: drug.source_url || '', content }));
  if (seen.has(documentHash)) throw new Error(`row ${index + 1}: duplicate document detected`);
  seen.add(documentHash);
  const status = drug.approval_status || drug.status || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) throw new Error(`row ${index + 1}: invalid approval status`);
  if (status === 'approved' && (!drug.reviewer || !drug.reviewed_at)) throw new Error(`row ${index + 1}: approved records require reviewer and reviewed_at`);
  const chunks = chunkText(content);
  for (const [chunkIndex, chunk] of chunks.entries()) rows.push({
    title: drug.drug_name,
    content: chunk,
    category: drug.category || drug.drug_type || null,
    source: drug.source,
    source_url: drug.source_url || null,
    document_hash: documentHash,
    content_hash: hash(`${documentHash}:${chunkIndex}:${chunk}`),
    chunk_index: chunkIndex,
    chunk_count: chunks.length,
    metadata: { drug_name: drug.drug_name, generic_name: drug.generic_name || null, trade_names: drug.trade_names || [], approval_status: status, reviewer: drug.reviewer || null, reviewed_at: drug.reviewed_at || null },
    status,
    approved_by: status === 'approved' ? drug.reviewer : null,
    approved_at: status === 'approved' ? drug.reviewed_at : null,
  });
}

console.log(`Prepared ${records.length} source records into ${rows.length} chunks (batch size ${batchSize}).`);
if (!apply) { console.log('DRY RUN: no OpenAI API or database was called.'); process.exit(0); }

for (const name of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[name]) throw new Error(`${name} must be set in a server-only environment`);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
let imported = 0;
for (let start = 0; start < rows.length; start += batchSize) {
  const batch = rows.slice(start, start + batchSize);
  const response = await withRetry(() => openai.embeddings.create({ model, input: batch.map((row) => `${row.title}\n${row.content}`), dimensions: 1536 }), `embedding batch ${start + 1}`);
  if (response.data.length !== batch.length || response.data.some((item) => item.embedding.length !== 1536)) throw new Error(`embedding batch ${start + 1}: expected ${batch.length} vectors of 1536 dimensions`);
  batch.forEach((row, index) => { row.embedding = response.data[index].embedding; });
  await withRetry(async () => {
    const { error } = await supabase.from('medical_knowledge').upsert(batch, { onConflict: 'content_hash', ignoreDuplicates: true });
    if (error) throw error;
  }, `database batch ${start + 1}`);
  imported += batch.length;
  console.log(`IMPORTED: ${imported}/${rows.length}`);
}
console.log(`IMPORT SUMMARY: source_records=${records.length}, chunks=${rows.length}, imported=${imported}, embedding_dimensions=1536`);
console.log('Approved-only retrieval remains enforced by match_medical_knowledge; pending and rejected records are excluded.');
