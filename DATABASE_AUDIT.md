# Database Audit

## Evidence available

The repository contains migrations for `profiles` and public read access to `drugs`. It does not contain Supabase CLI metadata or a database dump. A read-only anonymous REST probe was attempted on 2026-08-25 but did not return schema/error details from this environment, so live columns, indexes, policies, functions, and triggers cannot be asserted.

## Repository-defined schema

- `profiles`: `id`, name/email, optional health-profile fields, timestamps; user-only RLS select/insert/update.
- `drugs`: schema is not defined in repository; UI assumes the nine columns selected by `drugService.js`; read policy exists.
- Migration `20260825000000_add_user_features_and_rbac.sql` is additive and defines notifications, activity history, saved items, and risk reports with owner RLS plus staff review policies.

## Required verification before production

Run `supabase db pull` or inspect the Supabase SQL Editor with a privileged administrator, then reconcile the resulting schema with this report. Review the pre-existing `drugs` table before applying migrations. No migration in this workspace drops tables/data.

## Important limitation

No RAG documents/chunks/embeddings, route data, audit log, or admin telemetry tables were evidenced. They must be designed from real source and retention requirements—not generated from placeholder records.
