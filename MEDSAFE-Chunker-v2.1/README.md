# MEDSAFE Chunker v2.1 (local rebuild)

A local-only JavaScript chunker starter package for Thai/mixed-language text.

> This is a **reconstructed starter package**, not a recovered copy of the previously discussed r18 archive. Its test suite and results must not be represented as the earlier 45/45 or 2,400-round validation.

## Requirements
- Node.js 18 or newer
- npm

## PowerShell
```powershell
cd "C:\path\to\MEDSAFE-Chunker-v2.1"
npm install
npm run build
npm test
npm run fuzz
npm run report
npm run audit
```

## Files
- `src/chunker.js` — local chunking implementation
- `n8n/wrapper.js` — generic n8n Code node wrapper template
- `n8n/split-text-into-chunks.js` — generated standalone source
- `scripts/build-n8n.js` — deterministic builder
- `test/` — starter unit tests and smoke checks
- `runtime-check/` — local runtime capability probe

No workflow is modified and no data is sent anywhere.
