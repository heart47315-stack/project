import { searchHospitals } from '../src/services/hospitalService';

describe('hospital fallback service', () => {
  it('returns local sample hospital data when Supabase is not configured', async () => {
    const result = await searchHospitals('โรงพยาบาล');

    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].name).toContain('โรงพยาบาล');
  });
});
