import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

let AsyncStorage = null;
try {
  const asyncStorageModule = require('@react-native-async-storage/async-storage');
  AsyncStorage = asyncStorageModule.default || asyncStorageModule;
} catch {
  AsyncStorage = null;
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const supabaseConfig = {
  url: supabaseUrl,
  configured: Boolean(supabaseUrl && supabaseAnonKey),
};

const authError = new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');

const queryBuilder = {
  select() {
    return this;
  },
  eq() {
    return this;
  },
  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  },
  single() {
    return Promise.resolve({ data: null, error: null });
  },
  insert() {
    return Promise.resolve({ data: null, error: authError });
  },
  upsert() {
    return Promise.resolve({ data: null, error: authError });
  },
  delete() {
    return Promise.resolve({ data: null, error: authError });
  },
  update() {
    return Promise.resolve({ data: null, error: authError });
  },
  order() {
    return this;
  },
  range() {
    return this;
  },
  limit() {
    return this;
  },
  or() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve({ data: [], error: authError }).then(resolve, reject);
  },
};

const noOpSupabase = {
  auth: {
    signUp: async () => ({ data: null, error: authError }),
    signInWithPassword: async () => ({ data: null, error: authError }),
    resetPasswordForEmail: async () => ({ error: authError }),
    updateUser: async () => ({ data: null, error: authError }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  },
  from() {
    return queryBuilder;
  },
  rpc() {
    return Promise.resolve({ data: [], error: null });
  },
  functions: {
    invoke() {
      return Promise.resolve({ data: null, error: authError });
    },
  },
};

export const supabase = supabaseConfig.configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage || undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : noOpSupabase;
