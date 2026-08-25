import { supabase } from '../lib/supabase';

const DRUG_COLUMNS = 'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source';
const SEARCHABLE_COLUMNS = ['drug_name', 'drug_type', 'dosage_form', 'active_ingredient', 'indication'];

const friendlyError = () => ({
  message: 'ไม่สามารถค้นหาข้อมูลยาได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
});

export async function searchDrugs(query = '', { page = 0, pageSize = 20 } = {}) {
  const trimmedQuery = String(query).trim();
  if (!trimmedQuery) return { data: [], count: 0, error: null };

  try {
    const safePage = Math.max(0, Number(page) || 0);
    const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
    const searchPattern = `%${trimmedQuery}%`;
    const searchFilters = SEARCHABLE_COLUMNS
      .map((column) => `${column}.ilike.${searchPattern}`)
      .join(',');
    const { data, error, count } = await supabase
      .from('drugs')
      .select(DRUG_COLUMNS, { count: 'exact' })
      .or(searchFilters)
      .order('drug_name', { ascending: true })
      .range(safePage * safePageSize, safePage * safePageSize + safePageSize - 1);

    if (error) return { data: [], count: 0, error: friendlyError() };
    return { data: data || [], count: count || 0, error: null };
  } catch {
    return { data: [], count: 0, error: friendlyError() };
  }
}
