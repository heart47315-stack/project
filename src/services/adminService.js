import { supabase } from '../lib/supabase';

export async function getAdminDashboard() {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  return { data: data || null, error };
}