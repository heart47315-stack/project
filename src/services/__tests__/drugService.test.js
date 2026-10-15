import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { supabase } from '../../lib/supabase';
import { searchDrugs } from '../drugService';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('searchDrugs', () => {
  let searchResponse;
  let fallbackSearchResponse;
  let searchRequestError;
  let inventoryResponse;
  let searchBuilders;
  let allBuilders;

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setUpRequests() {
    searchResponse = {
      data: [{ drug_name: 'พาราเซตามอล', generic_name: 'Paracetamol' }],
      count: 1,
      error: null,
    };
    fallbackSearchResponse = null;
    searchRequestError = null;
    inventoryResponse = { count: 4, error: null };
    searchBuilders = [];
    allBuilders = [];
    supabase.from.mockImplementation(() => {
      const builder = {
        select: jest.fn((columns, options) => (
          options?.head ? Promise.resolve(inventoryResponse) : builder
        )),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => {
          const searchIndex = searchBuilders.length;
          searchBuilders.push(builder);
          if (searchIndex === 0 && searchRequestError) return Promise.reject(searchRequestError);
          return Promise.resolve(searchIndex === 0 ? searchResponse : fallbackSearchResponse || searchResponse);
        }),
      };
      allBuilders.push(builder);
      return builder;
    });
  }

  it('searches all supported fields with Thai category synonyms and checks total database rows', async () => {
    setUpRequests();

    const result = await searchDrugs('ยาแก้ปวด');
    const builder = searchBuilders[0];
    const filters = builder.or.mock.calls[0][0];

    expect(result).toEqual({
      data: [{ drug_name: 'พาราเซตามอล', generic_name: 'Paracetamol' }],
      count: 1,
      totalCount: 4,
      error: null,
    });
    expect(builder.select).toHaveBeenCalledWith(
      'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source,name_th,name_en,generic_name,brand_name,aliases_th,drug_category',
      { count: 'exact' }
    );
    expect(filters).toContain('name_th.ilike.');
    expect(filters).toContain('name_en.ilike.');
    expect(filters).toContain('generic_name.ilike.');
    expect(filters).toContain('brand_name.ilike.');
    expect(filters).toContain('aliases_th.ilike.');
    expect(filters).toContain('active_ingredient.ilike.');
    expect(filters).toContain('drug_type.ilike.');
    expect(filters).toContain('dosage_form.ilike.');
    expect(filters).toContain('indication.ilike.');
    expect(filters).toContain('drug_category.ilike.');
    expect(filters).toContain('%ยาแก้ปวด%');
    expect(filters).toContain('%analgesic%');
    expect(allBuilders.some((request) =>
      request.select.mock.calls.some(([columns, options]) =>
        columns === 'drug_name' && options?.head === true
      )
    )).toBe(true);
  });

  it('normalizes Thai input spacing and still matches its category synonym', async () => {
    setUpRequests();

    await searchDrugs('  ยา   แก้   แพ้  ');

    const filters = searchBuilders[0].or.mock.calls[0][0];
    expect(filters).toContain('%ยาแก้แพ้%');
    expect(filters).toContain('%antihistamine%');
  });

  it.each([
    ['ยาลดไข้', 'antipyretic'],
    ['ยาปฏิชีวนะ', 'antibiotic'],
    ['พาราเซตามอล', 'paracetamol'],
    ['paracetamol', 'acetaminophen'],
  ])('expands %s with the search alias %s', async (query, alias) => {
    setUpRequests();

    await searchDrugs(query);

    expect(searchBuilders[0].or.mock.calls[0][0]).toContain(`%${alias}%`);
  });

  it('keeps partial-name searches as substring matches', async () => {
    setUpRequests();

    await searchDrugs('acetam');

    expect(searchBuilders[0].or.mock.calls[0][0]).toContain('%acetam%');
  });

  it('expands partial Thai transliteration into the matching English medicine name', async () => {
    setUpRequests();

    await searchDrugs('พารา');

    expect(searchBuilders[0].or.mock.calls[0][0]).toContain('%พารา%');
    expect(searchBuilders[0].or.mock.calls[0][0]).toContain('%paracetamol%');
  });

  it('does not query Supabase for a blank search', async () => {
    setUpRequests();

    await expect(searchDrugs(' \t\n ')).resolves.toEqual({
      data: [],
      count: 0,
      totalCount: null,
      error: null,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reports an empty database separately from a search with no matches', async () => {
    setUpRequests();
    searchResponse = { data: [], count: 0, error: null };
    inventoryResponse = { count: 0, error: null };

    const result = await searchDrugs('ยาปฏิชีวนะ');

    expect(result).toMatchObject({ data: [], count: 0, totalCount: 0, error: null });
  });

  it('returns an explicit error when the database request fails', async () => {
    setUpRequests();
    searchResponse = {
      data: null,
      count: null,
      error: { code: '42501', message: 'permission denied' },
    };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchDrugs('paracetamol');

    expect(result.data).toEqual([]);
    expect(result.error.message).toContain('เชื่อมต่อ');
    expect(errorSpy).toHaveBeenCalledWith(
      '[drugService] Supabase drug search failed',
      { code: '42501', message: 'permission denied', details: undefined, hint: undefined }
    );
    errorSpy.mockRestore();
  });

  it('returns a user-safe error when the network request rejects', async () => {
    setUpRequests();
    searchRequestError = new TypeError('Failed to fetch');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchDrugs('paracetamol');

    expect(result.data).toEqual([]);
    expect(result.error.message).toContain('เชื่อมต่อ');
    expect(errorSpy).toHaveBeenCalledWith(
      '[drugService] Supabase drug search request failed',
      { name: 'TypeError', message: 'Failed to fetch' }
    );
    errorSpy.mockRestore();
  });

  it('falls back to the existing schema when expanded search columns are not deployed', async () => {
    setUpRequests();
    searchResponse = {
      data: null,
      count: null,
      error: { code: '42703', message: 'column drugs.generic_name does not exist' },
    };
    fallbackSearchResponse = {
      data: [{ drug_name: 'Paracetamol' }],
      count: 1,
      error: null,
    };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await searchDrugs('พาราเซตามอล');

    expect(result).toMatchObject({ totalCount: 4, error: null });
    expect(searchBuilders).toHaveLength(2);
    expect(searchBuilders[1].select).toHaveBeenCalledWith(
      'drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source',
      { count: 'exact' }
    );
    expect(searchBuilders[1].or.mock.calls[0][0]).toContain('drug_name.ilike.');
    expect(searchBuilders[1].or.mock.calls[0][0]).toContain('%paracetamol%');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
