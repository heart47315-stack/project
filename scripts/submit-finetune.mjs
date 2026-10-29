import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const [trainFile, validationFile, model] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const execute = process.argv.includes('--execute');
if (!trainFile || !validationFile || !model) {
  console.error('Usage: node scripts/submit-finetune.mjs <train.jsonl> <validation.jsonl> <base-model> [--execute]');
  process.exit(2);
}
for (const file of [trainFile, validationFile]) if (!fs.existsSync(file)) throw new Error(`Dataset file not found: ${file}`);

const plan = { trainFile: path.resolve(trainFile), validationFile: path.resolve(validationFile), baseModel: model, requestedAt: new Date().toISOString(), executed: false };
if (!execute) {
  console.log(JSON.stringify({ ...plan, message: 'Dry run only. No file upload, fine-tuning job, or cost was created.' }, null, 2));
  process.exit(0);
}
if (process.env.FINE_TUNING_APPROVED !== 'YES') throw new Error('Refusing to submit: set FINE_TUNING_APPROVED=YES only after explicit human approval.');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY must be set in a server-only environment.');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const trainUpload = await openai.files.create({ file: fs.createReadStream(trainFile), purpose: 'fine-tune' });
const validationUpload = await openai.files.create({ file: fs.createReadStream(validationFile), purpose: 'fine-tune' });
const job = await openai.fineTuning.jobs.create({ model, training_file: trainUpload.id, validation_file: validationUpload.id });
const manifest = { ...plan, executed: true, jobId: job.id, trainingFileId: trainUpload.id, validationFileId: validationUpload.id, model: job.model || model, status: job.status };
fs.mkdirSync(path.resolve('artifacts/finetune'), { recursive: true });
fs.writeFileSync(path.resolve('artifacts/finetune', `${job.id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
