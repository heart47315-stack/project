# Email confirmation flow

The app registers `medsafeai://auth/callback` for Supabase email confirmation and password recovery.

Add this exact URL in Supabase Dashboard under Authentication, URL Configuration:

`medsafeai://auth/callback`

Testing the native callback requires a development or production build that contains the custom scheme. Expo Go cannot open this callback reliably.