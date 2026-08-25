# Supabase Audit

Audit date: 2026-08-25

## Status: BLOCKED — SUPABASE CONNECTION

### Repository evidence inspected

- `src/lib/supabase.js` configures a Supabase JavaScript client using only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `src/services/authService.js` uses Supabase Auth; `src/services/drugService.js` queries `drugs`.
- Repository migrations only define `profiles` and a `drugs` read policy. They are source artifacts, not proof of current remote schema.
- No repository source for chat/history, saved items, notifications, risk reports, sources/documents/embeddings, accident data, roles, functions, or pgvector configuration was found.

### Live check attempted

A read-only query against `profiles` and `drugs` using the configured public Supabase URL and anonymous key returned:

```
status: 0
error: TypeError: fetch failed
```

The Supabase CLI is installed but could not start in this sandbox because it attempted to write telemetry under `C:\Users\ASUSTeK\.supabase` and received `EPERM`.

## Not verified

Tables, columns, keys, indexes, RLS, policies, functions, triggers, extensions, pgvector, storage buckets, and live migrations are all unverified. No schema-changing migration or schema-dependent service may be added until an authenticated Supabase CLI/database connection is available.

## Required next evidence

Run Supabase CLI with project access (or provide a schema export) and record results for the tables/features listed above. Then reconcile migrations against the remote database before creating anything new.
