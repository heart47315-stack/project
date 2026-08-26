import { supabase } from '../lib/supabase';

async function authorized(userId) {
  const { data, error } = await supabase.auth.getUser();
  return error ? { error } : data?.user?.id === userId ? { user: data.user } : { error: new Error('ไม่ได้รับอนุญาตให้เข้าถึงข้อมูลนี้') };
}

export async function getUserSettings(userId) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  const result = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (result.error || result.data) return result;
  const { data, error } = await supabase.from('user_settings').insert({ user_id: userId, notifications_enabled: true, language: 'th' }).select().single();
  return { data, error };
}

export async function updateUserSettings(userId, values) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  const updates = {};
  if (typeof values?.notifications_enabled === 'boolean') updates.notifications_enabled = values.notifications_enabled;
  if (values?.language) updates.language = values.language;
  const { data, error } = await supabase.from('user_settings').upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
  return { data, error };
}