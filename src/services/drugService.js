import { supabase } from '../lib/supabase';

const LEGACY_COLUMNS = 'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source';
const EXTENDED_COLUMNS = `${LEGACY_COLUMNS},name_th,name_en,generic_name,brand_name,aliases_th,drug_category`;
const LEGACY_SEARCHABLE_COLUMNS = [
  'drug_name',
  'active_ingredient',
  'drug_type',
  'dosage_form',
  'indication',
  'description',
  'restriction',
  'precautions',
  'source',
];
const EXTENDED_SEARCHABLE_COLUMNS = [
  'name_th',
  'name_en',
  'generic_name',
  'brand_name',
  'aliases_th',
  'drug_name',
  'active_ingredient',
  'drug_type',
  'dosage_form',
  'indication',
  'description',
  'restriction',
  'precautions',
  'source',
  'drug_category',
];

const SEARCH_ALIASES = {
  'ยาแก้ปวด': ['ยาบรรเทาปวด', 'บรรเทาปวด', 'ลดปวด', 'pain relief', 'painkiller', 'analgesic'],
  'ยาบรรเทาปวด': ['ยาแก้ปวด', 'บรรเทาปวด', 'ลดปวด', 'pain relief', 'painkiller', 'analgesic'],
  'ยาลดไข้': ['ยาแก้ไข้', 'ลดไข้', 'บรรเทาไข้', 'fever reducer', 'antipyretic'],
  'ยาแก้ไข้': ['ยาลดไข้', 'ลดไข้', 'บรรเทาไข้', 'fever reducer', 'antipyretic'],
  'ยาแก้แพ้': ['ยาต้านฮิสตามีน', 'antihistamine', 'allergy medicine'],
  'ยาปฏิชีวนะ': ['ยาฆ่าเชื้อแบคทีเรีย', 'antibiotic', 'antibiotics', 'antibacterial'],
  พาราเซตามอล: ['paracetamol', 'acetaminophen'],
  paracetamol: ['พาราเซตามอล', 'acetaminophen'],
  acetaminophen: ['พาราเซตามอล', 'paracetamol'],
};

const userError = {
  message: 'ไม่สามารถค้นหาข้อมูลยาได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
};

function normalizeQuery(query) {
  return String(query ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
}

function getSearchTerms(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const compact = normalized.replace(/\s/gu, '');
  const terms = new Set([normalized, compact]);
  const lowerCompact = compact.toLocaleLowerCase();
  const aliases = new Set(SEARCH_ALIASES[lowerCompact] || []);

  for (const [knownTerm, knownAliases] of Object.entries(SEARCH_ALIASES)) {
    if (knownTerm.startsWith(lowerCompact)) {
      knownAliases.forEach((alias) => aliases.add(alias));
    }
  }

  for (const alias of aliases) {
    const normalizedAlias = normalizeQuery(alias);
    terms.add(normalizedAlias);
    terms.add(normalizedAlias.replace(/\s/gu, ''));
  }

  return [...terms].filter(Boolean);
}

function escapeFilterValue(value) {
  return `"${value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;
}

function toOrFilter(terms, columns) {
  return columns.flatMap((column) =>
    terms.map((term) => {
      const pattern = `%${term.replace(/[\\%_]/gu, '\\$&')}%`;
      return `${column}.ilike.${escapeFilterValue(pattern)}`;
    })
  ).join(',');
}

function isMissingExtendedColumn(error) {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

async function requestSearch(query, page, pageSize, columns, searchableColumns) {
  return supabase
    .from('drugs')
    .select(columns, { count: 'exact' })
    .or(toOrFilter(query, searchableColumns))
    .order('drug_name', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1);
}

async function requestInventoryCount() {
  return supabase
    .from('drugs')
    .select('drug_name', { count: 'exact', head: true });
}

export async function searchDrugs(query = '', { page = 0, pageSize = 20 } = {}) {
  const searchTerms = getSearchTerms(query);
  if (!searchTerms.length) return { data: [], count: 0, totalCount: null, error: null };

  const safePage = Math.max(0, Number(page) || 0);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));

  try {
    let [searchResult, totalCountResult] = await Promise.all([
      requestSearch(searchTerms, safePage, safePageSize, EXTENDED_COLUMNS, EXTENDED_SEARCHABLE_COLUMNS),
      requestInventoryCount(),
    ]);

    if (searchResult.error && isMissingExtendedColumn(searchResult.error)) {
      console.warn(
        '[drugService] The drugs table is using its legacy schema. Apply the drug search fields migration to enable generic, brand, and Thai alias searches.',
        { code: searchResult.error.code, message: searchResult.error.message }
      );
      [searchResult, totalCountResult] = await Promise.all([
        requestSearch(searchTerms, safePage, safePageSize, LEGACY_COLUMNS, LEGACY_SEARCHABLE_COLUMNS),
        requestInventoryCount(),
      ]);
    }

    const requestError = searchResult.error || totalCountResult.error;
    if (requestError) {
      console.error('[drugService] Supabase drug search failed', {
        code: requestError.code,
        message: requestError.message,
        details: requestError.details,
        hint: requestError.hint,
      });
      return { data: [], count: 0, totalCount: null, error: userError };
    }

    return {
      data: searchResult.data || [],
      count: searchResult.count || 0,
      totalCount: totalCountResult.count || 0,
      error: null,
    };
  } catch (error) {
    console.error('[drugService] Supabase drug search request failed', {
      name: error?.name,
      message: error?.message,
    });
    return { data: [], count: 0, totalCount: null, error: userError };
  }
}
