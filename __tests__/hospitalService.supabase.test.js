const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.doMock('../src/lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
  supabaseConfig: { configured: true },
}));

const {
  getHospitalById,
  getNearbyHospitals,
  searchHospitals,
} = require('../src/services/hospitalService');

describe('hospital service with Supabase', () => {
  let query;
  let tableResult;

  beforeEach(() => {
    jest.clearAllMocks();
    tableResult = { data: [], error: null };
    query = {
      select: jest.fn(() => query),
      range: jest.fn(() => Promise.resolve(tableResult)),
      eq: jest.fn(() => query),
      maybeSingle: jest.fn(() => Promise.resolve(tableResult)),
    };
    mockFrom.mockReturnValue(query);
  });

  it('calls the hospital search RPC and returns its results', async () => {
    const hospitals = [{ id: 'hospital-1', name: 'โรงพยาบาลทดสอบ' }];
    mockRpc.mockResolvedValue({ data: hospitals, error: null });

    const result = await searchHospitals('ทดสอบ');

    expect(mockRpc).toHaveBeenCalledWith('search_hospitals', {
      search_query: 'ทดสอบ',
    });
    expect(result).toEqual({ data: hospitals, error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('falls back to table search if the search RPC is unavailable', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    tableResult.data = [
      { id: 'match', name: 'โรงพยาบาลทดสอบ', address: 'กรุงเทพมหานคร' },
      { id: 'other', name: 'คลินิก', address: 'เชียงใหม่' },
    ];

    const result = await searchHospitals('ทดสอบ');

    expect(mockFrom).toHaveBeenCalledWith('hospitals');
    expect(query.range).toHaveBeenCalledWith(0, 999);
    expect(result.error).toBeNull();
    expect(result.data.map((hospital) => hospital.id)).toEqual(['match']);
  });

  it('loads all hospital pages when the table exceeds one page', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `hospital-${index}`,
      name: 'โรงพยาบาล',
    }));
    const lastHospital = { id: 'last-hospital', name: 'โรงพยาบาลปลายทาง' };
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    query.range.mockImplementation((start) => Promise.resolve({
      data: start === 0 ? firstPage : [lastHospital],
      error: null,
    }));

    const result = await searchHospitals('ปลายทาง');

    expect(query.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(result.data).toEqual([lastHospital]);
    expect(result.error).toBeNull();
  });

  it('calculates and sorts distances when nearby RPC is unavailable', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    tableResult.data = [
      { id: 'farther', name: 'ไกลกว่า', latitude: 13.751, longitude: 100.565 },
      { id: 'nearer', name: 'ใกล้กว่า', latitude: 13.7501, longitude: 100.565 },
      { id: 'outside', name: 'ไกลเกินรัศมี', latitude: 15, longitude: 100 },
    ];

    const result = await getNearbyHospitals(13.75, 100.565, 1);

    expect(result.error).toBeNull();
    expect(result.data.map((hospital) => hospital.id)).toEqual(['nearer', 'farther']);
    expect(result.data[0].distance_km).toBeLessThan(result.data[1].distance_km);
  });

  it('surfaces database failures instead of returning sample records', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    tableResult = { data: null, error: new Error('Database unavailable') };

    const result = await searchHospitals('โรงพยาบาล');

    expect(result.data).toEqual([]);
    expect(result.error.message).toBe('Database unavailable');
  });

  it('looks up a hospital by ID and reports missing IDs', async () => {
    const hospital = { id: 'hospital-1', name: 'โรงพยาบาลทดสอบ' };
    tableResult = { data: hospital, error: null };

    const result = await getHospitalById('hospital-1');
    const missingId = await getHospitalById('');

    expect(query.eq).toHaveBeenCalledWith('id', 'hospital-1');
    expect(result).toEqual({ data: hospital, error: null });
    expect(missingId.data).toBeNull();
    expect(missingId.error).toBeInstanceOf(Error);
  });
});
