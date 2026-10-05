import { supabase } from '../lib/supabase';
import { dateKey, getOccurrenceDates } from '../utils/healthTaskUtils';

async function authorized(userId) {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { error };
  return data?.user?.id === userId ? { user: data.user } : { error: new Error('Not authorized') };
}

export async function listHealthTasks(userId) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  return supabase.from('health_tasks').select('*').eq('user_id', userId).order('task_date').order('task_time');
}

export async function insertHealthTasks(userId, tasks) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  if (!tasks.length) return { data: [], error: null };
  return supabase.from('health_tasks').insert(tasks.map((task) => ({ ...task, user_id: userId }))).select();
}

export async function updateHealthTask(userId, id, values) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  return supabase.from('health_tasks').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single();
}

export async function removeHealthTask(userId, id) {
  const auth = await authorized(userId);
  if (auth.error) return { error: auth.error };
  return supabase.from('health_tasks').delete().eq('id', id).eq('user_id', userId);
}

export async function extendRecurringTasks(userId, tasks, scheduleMissing) {
  const auth = await authorized(userId);
  if (auth.error) return { data: null, error: auth.error };
  const recurring = tasks.filter((task) => task.repeat_type && task.repeat_type !== 'none' && task.metadata?.series_generation_until);
  const series = new Map();
  recurring.forEach((task) => {
    const old = series.get(task.series_id);
    if (!old || task.metadata.series_generation_until > old.metadata.series_generation_until) series.set(task.series_id, task);
  });
  const today = dateKey(new Date());
  const through = new Date(`${today}T12:00:00`);
  through.setDate(through.getDate() + 90);
  const target = dateKey(through);
  for (const sample of series.values()) {
    if (sample.metadata.series_generation_until >= target) continue;
    const last = sample.metadata.series_generation_until;
    const startDate = new Date(`${last}T12:00:00`);
    startDate.setDate(startDate.getDate() + 1);
    const dates = getOccurrenceDates({ startDate: dateKey(startDate), endDate: sample.metadata.series_end_date, repeatType: sample.repeat_type, repeatDays: sample.repeat_days || [], throughDate: target });
    if (dates.length) {
      const { data: existing, error: existingError } = await supabase.from('health_tasks').select('task_date,task_time').eq('user_id', userId).eq('series_id', sample.series_id).in('task_date', dates);
      if (existingError) return { error: existingError };
      const existingKeys = new Set((existing || []).map((task) => `${task.task_date}|${task.task_time}`));
      const missing = dates.filter((taskDate) => !existingKeys.has(`${taskDate}|${sample.task_time}`)).map((taskDate) => ({ ...sample, id: undefined, task_date: taskDate, status: 'pending', completed_at: null, notification_id: null, enabled: true }));
      if (missing.length) {
        const rows = await scheduleMissing(missing);
        if (rows.error) return rows;
        const created = await supabase.from('health_tasks').upsert(rows.data.map((task) => ({ ...task, user_id: userId })), { onConflict: 'series_id,task_date,task_time', ignoreDuplicates: true }).select();
        if (created.error) return created;
      }
    }
    const { error } = await supabase.from('health_tasks').update({ metadata: { ...sample.metadata, series_generation_until: target }, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', sample.id);
    if (error) return { error };
  }
  return { data: true, error: null };
}
