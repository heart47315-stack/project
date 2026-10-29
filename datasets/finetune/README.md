# MedSafe fine-tuning dataset

This directory is a template only. It contains no patient data and no training call is performed by the app.

Each JSONL line should use a chat example such as:

```json
{"messages":[{"role":"system","content":"You are MedSafe AI..."},{"role":"user","content":"คำถามตัวอย่าง"},{"role":"assistant","content":"คำตอบที่ผ่านการตรวจโดยผู้เชี่ยวชาญ"}],"metadata":{"example_id":"example-001","expert_reviewed":true,"contains_phi":false}}
```

Required controls before any external upload:

- Keep train, validation, and test files separate; do not duplicate examples across splits.
- Require documented clinical review and set `expert_reviewed` to `true`.
- Remove names, contact details, identifiers, unnecessary dates, and other personal data; keep `contains_phi` false.
- Use fine-tuning for response style and behavior only. Keep changing medical facts in the approved RAG knowledge base.
- Run `node scripts/validate-finetune-dataset.mjs <file.jsonl>` locally. This script never uploads data.
- Run `node scripts/split-finetune-dataset.mjs <input.jsonl> <output-dir>` to create deterministic train/validation/test splits.
- Run `node scripts/submit-finetune.mjs <train.jsonl> <validation.jsonl> <base-model>` for a no-cost dry run. The command refuses uploads unless `--execute` and `FINE_TUNING_APPROVED=YES` are both present.
- Store the returned job manifest under `artifacts/finetune/` and evaluate the base model and fine-tuned model against the held-out test split before changing the Edge Function model setting.
- Obtain explicit approval before using any OpenAI API file upload or fine-tuning command.
