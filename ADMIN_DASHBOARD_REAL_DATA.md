# Admin dashboard data

The Admin Dashboard reads aggregate data through the `admin_dashboard_stats()` Supabase RPC. The RPC checks `profiles.role = 'admin'` server-side before exposing any data.

Apply the migration before opening the Admin screen, then assign the `admin` role to the intended profile using a privileged Supabase SQL session.