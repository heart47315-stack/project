import crypto from 'node:crypto';
import fs from 'node:fs';

const filePath = process.argv[2] || './dataset/medicines.json';
const requiredFields = ['drug_name', 'indications', 'source'];
const statuses = new Set(['pending', 'approved', 'rejected']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const urlPattern = /^https?:\/\/[^\s]+$/iu;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (const character of text.replace(/^\uFEFF/u, '')) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if (character === '\n' && !quoted) { row.push(field.trim()); rows.push(row); row = []; field = ''; }
    else if (character !== '\r') field += character;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  const [headers, ...data] = rows;
  return data.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || null])));
}

function loadRecords(path) {
  const text = fs.readFileSync(path, 'utf8');
  if (path.toLowerCase().endsWith('.csv')) return parseCsv(text).map(normalizeRecord);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Dataset root must be a JSON array');
  return data.map(normalizeRecord);
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

function fingerprint(record) {
  const normalized = requiredFields.map((field) => String(record[field] || '').trim().toLowerCase()).join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

let records;
try { records = loadRecords(filePath); } catch (error) {
  console.error(`FAILED: Cannot read ${filePath} - ${error.message}`);
  process.exit(1);
}

const seenIds = new Set();
const seenFingerprints = new Set();
const summary = { total: records.length, passed: 0, failed: 0, pending: 0, approved: 0, rejected: 0, duplicates: 0 };

for (const [index, record] of records.entries()) {
  const label = record?.drug_name || `Row ${index + 1}`;
  const rowErrors = [];
  for (const field of requiredFields) if (typeof record?.[field] !== 'string' || !record[field].trim()) rowErrors.push(`missing ${field}`);
  const status = record?.approval_status || record?.status || 'pending';
  if (!statuses.has(status)) rowErrors.push(`invalid approval status: ${status}`);
  if (record?.source_url && !urlPattern.test(record.source_url)) rowErrors.push('invalid source_url');
  if (record?.record_id && seenIds.has(record.record_id)) { rowErrors.push(`duplicate record_id: ${record.record_id}`); summary.duplicates += 1; }
  if (record?.record_id) seenIds.add(record.record_id);
  const hash = fingerprint(record || {});
  if (seenFingerprints.has(hash)) { rowErrors.push('duplicate content'); summary.duplicates += 1; }
  seenFingerprints.add(hash);
  if (status === 'approved' && (!record.reviewed_at || !record.reviewer || !uuidPattern.test(record.reviewer))) rowErrors.push('approved records require reviewed_at and reviewer UUID');
  if (record?.verified === true && status !== 'approved') rowErrors.push('verified=true requires approval_status=approved');
  summary[status] += 1;
  if (rowErrors.length) { console.log(`FAILED: ${label} - ${rowErrors.join(', ')}`); summary.failed += 1; }
  else { console.log(`PASSED: ${label}`); summary.passed += 1; }
}

console.log('\n===== DATASET REPORT =====');
for (const [key, value] of Object.entries(summary)) console.log(`${key}: ${value}`);
if (summary.failed > 0) process.exitCode = 1;
