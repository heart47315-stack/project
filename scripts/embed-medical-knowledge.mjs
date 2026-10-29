import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
if (process.argv.includes('--apply')) required.push('OPENAI_API_KEY');
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} must be set in a server-only environment`);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const apply = process.argv.includes('--apply');

const { data: rows, error } = await supabase
  .from('medical_knowledge')
  .select('id,title,content,status,approved_by,embedding')
  .eq('status', 'approved')
  .is('embedding', null)
  .limit(1000);

if (error) throw new Error(`Could not read approved knowledge: ${error.message}`);
if (!rows?.length) {
  console.log('No approved knowledge rows need embeddings.');
  process.exit(0);
}
if (rows.some((row) => !row.approved_by)) {
  throw new Error('Refusing to embed an approved row without approved_by. No rows were changed.');
}

if (!apply) {
  console.log(`Dry run: found ${rows.length} approved rows without embeddings. No external API was called.`);
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.embeddings.create({
  model,
  input: rows.map((row) => `${row.title}\n${row.content}`.slice(0, 6000)),
  dimensions: 1536,
});
if (response.data.length !== rows.length || response.data.some((item) => item.embedding.length !== 1536)) {
  throw new Error('Embedding response does not contain exactly 1536 dimensions for every row. No rows were changed.');
}

for (let index = 0; index < rows.length; index += 1) {
  const { error: updateError } = await supabase
    .from('medical_knowledge')
    .update({ embedding: response.data[index].embedding })
    .eq('id', rows[index].id)
    .eq('status', 'approved')
    .is('embedding', null);
  if (updateError) throw new Error(`Could not update row ${rows[index].id}: ${updateError.message}`);
}
console.log(`Wrote embeddings for ${rows.length} approved rows.`);
