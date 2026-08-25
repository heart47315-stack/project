# MEDSAFE AI — Project Audit

Audit date: 2026-08-25. This report is based on files in this workspace; it does not infer uncommitted Supabase schema.

## Actual stack and structure

- Expo SDK 53, React 19, React Native 0.79, JavaScript entry point: `App.js`.
- Supabase JS v2 with AsyncStorage session persistence: `src/lib/supabase.js`.
- Existing services: auth and drug search. No data service is retained for unverified tables.
- Backend assets: two original SQL migrations and CSV datasets. There is no API server, Edge Function, RAG worker, admin-web project, test suite, TypeScript configuration, ESLint configuration, Metro configuration, or CI configuration.
- UI is an in-process `screen` switch in `App.js`, not a navigation library.

## Verified features

| Area | Status | Evidence |
| --- | --- | --- |
| Email registration/login/logout/session | Partial | Supabase Auth calls and AsyncStorage persistence exist. |
| Password reset | Implemented | `requestPasswordReset` is wired from Login. |
| Profile | Partial | `profiles` lookup exists; no edit UI. |
| Drug search/detail | Partial | Real Supabase `drugs` query, pagination support in service; UI has no paging controls. |
| SafeRoute | Partial | Location permission exists; risk prediction is blocked without verified accident data and ML model. |
| Medical AI | Blocked safely | UI refuses to fabricate an answer while no RAG endpoint/source store exists. |
| Admin/RBAC | Architecture only | Migration adds role/RLS foundations; no admin web UI/backend operations. |

## Broken or risky items found and addressed

- Auth and drug error strings were mojibake; services were rewritten as UTF-8 Thai.
- Client had a hard-coded Supabase project fallback and console logging about configuration. The fallback and sensitive debug logging were removed.
- Google button previously bypassed authentication by opening Home. It is now explicitly unavailable until Supabase OAuth is configured.
- Chat and SafeRoute used fabricated output. Chat now blocks safely; SafeRoute never claims ML or a calculated route without a provider.

## Recommended implementation order

1. Apply/review migrations in a non-production Supabase project and provision the first administrator server-side.
2. Add an authenticated server/Edge Function for RAG and ingestion; do not call LLM keys from Expo.
3. Select and configure a directions/geocoding provider plus verified accident dataset.
4. Split `App.js` into route, screen, component, hook, and service modules; add Expo Router/React Navigation.
5. Implement user features, then a separate protected admin web application, then tests and CI.
