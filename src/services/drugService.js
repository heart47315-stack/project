import { supabase } from '../lib/supabase';

const DRUG_COLUMNS = 'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source';

export const searchDrugs = async (query = '') => {
  const trimmedQuery = String(query || '').trim();

  console.log('SEARCH_QUERY', trimmedQuery);

  if (!trimmedQuery) {
    console.log('RESULT_COUNT', 0);
    console.log('FIRST_RESULT', null);
    return { data: [], error: null };
  }

  try {
    const searchPattern = `%${trimmedQuery}%`;
    let request = supabase
      .from('drugs')
      .select(DRUG_COLUMNS)
      .ilike('drug_name', searchPattern);

    if (/[\u0E00-\u0E7F]/.test(trimmedQuery)) {
      request = supabase
        .from('drugs')
        .select(DRUG_COLUMNS)
        .or(`drug_name.ilike.${searchPattern},active_ingredient.ilike.${searchPattern},description.ilike.${searchPattern}`);
    }

    const { data, error } = await request.limit(20);

    console.log('SUPABASE_ERROR', error);
    console.log('RESULT_COUNT', data?.length ?? 0);
    console.log('FIRST_RESULT', data?.[0] ?? null);

    if (error) {
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.log('SUPABASE_ERROR', error);
    return {
      data: [],
      error: {
        message: 'ไม่สามารถค้นหาข้อมูลยาได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      },
    };
  }
};
