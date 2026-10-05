import { supabase } from '../lib/supabase';

async function authorized(userId) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { error };
  return data?.user?.id === userId ? { user: data.user } : { error: new Error('Not authorized') };
}

export async function getReminders(userId) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  return supabase.from('reminders').select('*').eq('user_id', userId).order('reminder_date').order('reminder_time');
}

export async function saveReminder(userId, values) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  const payload = { ...values, user_id: userId, updated_at: new Date().toISOString() };
  if (payload.id) return supabase.from('reminders').update(payload).eq('id', payload.id).eq('user_id', userId).select().single();
  delete payload.id;
  return supabase.from('reminders').insert(payload).select().single();
}

export async function deleteReminder(userId, id) {
  const auth = await authorized(userId);
  if (auth.error) return { error: auth.error };
  return supabase.from('reminders').delete().eq('id', id).eq('user_id', userId);
}
