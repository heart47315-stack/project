import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabasePublicKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabasePublicKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and either ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY ' +
      'in the local environment and EAS production environment.'
  );
}

function isServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload || typeof globalThis.atob !== 'function') return false;

  try {
    let normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    normalizedPayload += '='.repeat((4 - normalizedPayload.length % 4) % 4);
    return JSON.parse(globalThis.atob(normalizedPayload)).role === 'service_role';
  } catch {
    return false;
  }
}

if (isServiceRoleKey(supabasePublicKey)) {
  throw new Error('A Supabase secret/service-role key must never be bundled in the mobile app.');
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error('Supabase URL is invalid. Check EXPO_PUBLIC_SUPABASE_URL.');
}

if (parsedSupabaseUrl.protocol !== 'https:' && parsedSupabaseUrl.protocol !== 'http:') {
  throw new Error('Supabase URL must use HTTP or HTTPS.');
}

export const supabaseConfig = {
  url: supabaseUrl,
  configured: true,
};

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
