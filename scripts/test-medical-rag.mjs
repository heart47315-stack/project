import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const live = process.argv.includes('--live');
const questions = ['Paracetamol ใช้รักษาอะไร', 'Ibuprofen มีผลข้างเคียงอะไร', 'ยาชนิดใดต้องระวังผลกระทบต่อตับ'];

if (!live) {
  console.log('RAG integration test is protected by default. No external API or database was called.');
  console.log('Run `npm run medical:test:live` only with approved non-production credentials and test data.');
  process.exit(0);
}

for (const name of ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[name]) throw new Error(`${name} must be set in a server-only environment`);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000, maxRetries: 2 });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
