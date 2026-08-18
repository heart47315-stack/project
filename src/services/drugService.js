import { supabase } from '../lib/supabase';

const DRUG_COLUMNS = 'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source';

export const searchDrugs = async (query = '') => {
  const trimmedQuery = String(query || '').trim();

  if (!trimmedQuery) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('drugs')
      .select(DRUG_COLUMNS)
      .ilike('drug_name', `%${trimmedQuery}%`)
      .limit(20);

    if (error) {
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    return {
      data: [],
      error: {
        message: error?.message || 'Unable to search drugs right now.',
      },
    };
  }
};
