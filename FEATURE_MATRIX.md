# Feature Matrix

Status is based on executable code and repository migrations, not file names.

| Feature | UI | Backend | Database | API | Auth | Test | Status |
| ------- | -- | ------- | -------- | --- | ---- | ---- | ------ |
| Email authentication | Yes | Supabase Auth | `auth.users`, profiles | Supabase | Yes | No | Partial |
| Password reset | Yes | Supabase Auth | `auth.users` | Supabase | Yes | No | Implemented |
| Profile read | Yes | Supabase | `profiles` | Supabase | Yes | No | Partial |
| Drug search/detail | Yes | Supabase query | `drugs`* | Supabase | No | No | Partial |
| Medical AI/RAG | Safe blocked | No | No evidence | No | N/A | No | Blocked |
| Medicine scan/OCR | No | No | No | No | N/A | No | Missing |
| SafeRoute GPS | Yes | Device location | No route dataset | Device location | Permission | No | Partial |
| SafeRoute risk prediction | No | No ML model | No verified accident data | No | N/A | No | Blocked |
| Risk report | No | No verified service | Schema unverified | No | Yes | No | Blocked |
| Notifications/history/saved | No | No verified service | Schema unverified | No | Yes | No | Blocked |
| RBAC | No admin UI | No verified live policy | Schema unverified | Supabase | Yes | No | Blocked |
| Admin web | No | No | No evidence | No | N/A | No | Missing |

\* The repository does not define `drugs`; its actual schema/data/RLS must be verified in Supabase.
