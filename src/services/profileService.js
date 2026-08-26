import { supabase } from '../lib/supabase';

async function assertCurrentUser(userId) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { error };
  if (!data?.user?.id || data.user.id !== userId) return { error: new Error('ไม่ได้รับอนุญาตให้เข้าถึงข้อมูลนี้') };
  return { user: data.user };
}

export async function getProfile(userId) {
  const auth = await assertCurrentUser(userId);
  if (auth.error) return { data: null, error: auth.error };
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return { data, error };
}

export async function updateProfile(userId, values) {
  const auth = await assertCurrentUser(userId);
  if (auth.error) return { data: null, error: auth.error };
  const allowed = ['full_name', 'email', 'date_of_birth', 'gender', 'height', 'weight', 'blood_type'];
  const updates = Object.fromEntries(Object.entries(values || {}).filter(([key]) => allowed.includes(key)));
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}