import { spawnSync } from 'node:child_process';

const steps = [
  ['Dataset validation', ['scripts/validate-medical-data.mjs', 'dataset/medicines.json']],
  ['Import dry run', ['scripts/import-medical-knowledge.mjs', 'dataset/medicines.json']],
];

for (const [label, args] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nMedical training pipeline completed in safe dry-run mode.');
