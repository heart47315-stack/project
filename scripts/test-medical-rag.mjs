import 'dotenv/config';
import { Buffer } from 'node:buffer';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const live = process.argv.includes('--live');
const questions = ['Paracetamol ใช้รักษาอะไร', 'Ibuprofen มีผลข้างเคียงอะไร', 'ยาชนิดใดต้องระวังผลกระทบต่อตับ'];

if (!live) {
  console.log('RAG integration test is protected by default. No external API or database was called.');
  console.log('Run `npm run medical:test:live` only with approved non-production credentials and test data.');
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_TEST_ANON_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const accessToken = process.env.SUPABASE_TEST_ACCESS_TOKEN;

for (const [name, value] of [
  ['OPENAI_API_KEY', process.env.OPENAI_API_KEY],
  ['SUPABASE_TEST_URL or SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['SUPABASE_TEST_ANON_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY', supabaseKey],
  ['SUPABASE_TEST_ACCESS_TOKEN', accessToken],
]) if (!value) throw new Error(`${name} must be set for the protected read-only live test`);

function getJwtClaims(token) {
  if (token.startsWith('sb_secret_')) return { role: 'service_role' };
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

const jwtClaims = getJwtClaims(accessToken);
const currentUnixTime = Math.floor(Date.now() / 1000);
if (
  !jwtClaims
  || jwtClaims.role !== 'authenticated'
  || typeof jwtClaims.sub !== 'string'
  || !jwtClaims.sub
  || typeof jwtClaims.exp !== 'number'
  || jwtClaims.exp <= currentUnixTime
) {
  throw new Error('SUPABASE_TEST_ACCESS_TOKEN must be a non-expired user JWT with role authenticated; service-role and secret keys are forbidden');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000, maxRetries: 2 });
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
});

async function searchMedical(question) {
  let embedding;
  try {
    const result = await openai.embeddings.create({ model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small', input: question, dimensions: 1536 });
    embedding = result.data?.[0]?.embedding;
  } catch (error) { throw new Error(`Embedding Error: ${error.message}`); }
  if (!embedding || embedding.length !== 1536) throw new Error(`Embedding Validation Error: expected 1536 dimensions, received ${embedding?.length || 0}`);
  const { data, error } = await supabase.rpc('match_medical_knowledge', { query_embedding: embedding, match_threshold: 0.62, match_count: 5 });
  if (error) throw new Error(`RPC Error: ${error.message}`);
  return data || [];
}

for (const question of questions) {
  console.log(`\nQUESTION: ${question}`);
  try {
    const results = await searchMedical(question);
    console.log(`RESULTS: ${results.length}`);
    if (!results.length) console.log('MISSING KNOWLEDGE: no approved matching knowledge found');
    for (const item of results) {
      if (!item.title || !item.content || !item.source || typeof item.similarity !== 'number') throw new Error('RPC Schema Error: expected title, content, source and numeric similarity');
      console.log({ title: item.title, source: item.source, similarity: item.similarity });
    }
  } catch (error) { console.error(`SEARCH FAILED: ${error.message}`); }
}
