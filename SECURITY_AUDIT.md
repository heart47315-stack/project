# Security Audit

## Fixed

- Supabase service-role key is not exposed by app code; the client validates only public Expo environment variables.
- Removed configuration/key-presence logging and the embedded project URL fallback.
- Removed the Google-login navigation bypass.
- Added RLS owner isolation for new user-data tables and staff-only review access in the additive migration.
- Prevented self-service role escalation: the profile update policy pre-dated RBAC, so the migration adds a role-change trigger that only staff/service-role processes can pass.
- Drug query uses Supabase query builder, fixed column names, capped pagination, and no raw SQL.

## Must be completed outside this workspace

- Apply and test migration RLS policies in a staging Supabase project. Assign initial staff roles only through a protected server-side process; never permit a mobile client to write `profiles.role`.
- Implement rate limiting, upload MIME/size validation, antivirus scanning, audit logs, and server-side authorization for future admin/RAG/upload APIs.
- Provide an HTTPS Edge Function/server for LLM and mapping credentials. Do not set provider keys as `EXPO_PUBLIC_*`.
- Ensure Supabase email redirect URLs and OAuth callback URLs are allow-listed.
