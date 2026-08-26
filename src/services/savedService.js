import { supabase } from '../lib/supabase';

async function authorized(userId) {
  const { data, error } = await supabase.auth.getUser();
  return error ? { error } : data?.user?.id === userId ? { user: data.user } : { error: new Error('ไม่ได้รับอนุญาตให้เข้าถึงข้อมูลนี้') };
}

export async function getSavedItems(userId) {
  const auth = await authorized(userId);
  if (auth.error) return { data: [], error: auth.error };
  const { data, error } = await supabase.from('saved_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function saveItem(userId, payload) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  const existing = await isItemSaved(userId, payload.item_type, payload.item_id);
  if (existing.error) return existing;
  if (existing.data) return existing;
  const { data, error } = await supabase.from('saved_items').insert({ ...payload, user_id: userId }).select().single();
  return { data, error };
}

export async function removeSavedItem(userId, itemId) {
  const auth = await authorized(userId);
  if (auth.error) return { error: auth.error };
  const { error } = await supabase.from('saved_items').delete().eq('id', itemId).eq('user_id', userId);
  return { error };
}

export async function isItemSaved(userId, itemType, itemId) {
  const auth = await authorized(userId);
  if (auth.error) return { data: false, error: auth.error };
  const { data, error } = await supabase.from('saved_items').select('id').eq('user_id', userId).eq('item_type', itemType).eq('item_id', String(itemId)).maybeSingle();
  return { data: Boolean(data), item: data, error };
}