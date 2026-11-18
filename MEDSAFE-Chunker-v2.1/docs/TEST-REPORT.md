# MEDSAFE Chunker v2.1 — local rebuild

## Scope
This package is a fresh, conservative reconstruction for local inspection and testing. It is **not** the original `medsafe-chunker-v2.1.tgz` and does not claim to reproduce the earlier r18 implementation or its reported test results.

## Safety boundary
- No network calls.
- No Supabase client, database writes, OpenAI API calls, secrets, or credentials.
- No n8n workflow read/write/deploy actions.
- `n8n/split-text-into-chunks.js` is generated source for manual review only.

## Important limitations
- The chunker uses UTF-16 JavaScript string offsets.
- When `Intl.Segmenter` is unavailable, fallback boundaries are conservative but are not a complete implementation of Unicode extended grapheme cluster rules.
- Thai word boundary quality depends on the Node.js ICU/`Intl.Segmenter` implementation.
- The included tests are starter tests and smoke fuzzing, not the previously reported 45-test / 2,400-round suite.
- The n8n wrapper uses `$input.all()` and expects incoming `item.json.text` or `item.json.content`; adapt field names and node references only after comparing with your existing workflow. Do not paste into Production without review.

## Run locally
```powershell
npm install
npm run build
npm test
npm run fuzz
npm run report
npm run audit
node runtime-check/n8n-runtime-probe.js
```

## Expected status
A passing local run validates only this reconstructed package under the current local Node.js runtime. It does not validate hosted n8n, PDF extraction, Supabase RAG retrieval, embeddings, or Production ingestion.
