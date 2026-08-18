import { supabase } from '../lib/supabase';

const DRUG_COLUMNS = 'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source';

export const searchDrugs = async (query = '') => {
  const trimmedQuery = String(query || '').trim();

  console.log('[Drug search debug] query:', trimmedQuery);

  if (!trimmedQuery) {
    console.log('[Drug search debug] empty query, skipping Supabase call');
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('drugs')
      .select(DRUG_COLUMNS)
      .ilike('drug_name', `%${trimmedQuery}%`)
      .limit(20);

    console.log('[Drug search debug] Supabase error:', error);
    console.log('[Drug search debug] result count:', data?.length ?? 0);
    console.log('[Drug search debug] first result:', data?.[0] ?? null);

    if (error) {
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.log('[Drug search debug] exception:', error?.message || error);
    return {
      data: [],
      error: {
        message: error?.message || 'Unable to search drugs right now.',
      },
    };
  }
};
