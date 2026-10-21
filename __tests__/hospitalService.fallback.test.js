import {
  getHospitalById,
  getNearbyHospitals,
  searchHospitals,
} from '../src/services/hospitalService';
import { evaluateRouteRisk } from '../src/services/safeRouteService';

jest.mock('../src/lib/supabase', () => ({
  supabase: null,
  supabaseConfig: { configured: false },
}));

describe('hospital fallback service', () => {
  it('returns local sample hospital data when Supabase is not configured', async () => {
    const result = await searchHospitals('โรงพยาบาล');

    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].name).toContain('โรงพยาบาล');
    expect(result.data[0].source).toBe('SAMPLE');
  });

  it('filters nearby sample data by radius and sorts by distance', async () => {
    const result = await getNearbyHospitals(13.7500, 100.5650, 1);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('sample-hospital-central');
    expect(result.data[0].distance_km).toBeCloseTo(0);
    expect(result.data[1].distance_km).toBeGreaterThan(result.data[0].distance_km);
  });

  it('rejects invalid coordinates and search radius', async () => {
    const invalidCoordinates = await getNearbyHospitals('', 100.5650);
    const invalidRadius = await getNearbyHospitals(13.7500, 100.5650, 0);

    expect(invalidCoordinates.data).toEqual([]);
    expect(invalidCoordinates.error).toBeInstanceOf(Error);
    expect(invalidRadius.data).toEqual([]);
    expect(invalidRadius.error).toBeInstanceOf(Error);
  });

  it('returns a sample record only for its explicit ID', async () => {
    const found = await getHospitalById('sample-clinic');
    const missing = await getHospitalById('unknown-id');

    expect(found.data.name).toBe('คลินิกตัวอย่าง');
    expect(found.error).toBeNull();
    expect(missing.data).toBeNull();
    expect(missing.error).toBeNull();
  });
});

describe('safe route service', () => {
  it('generates a route risk summary from origin and destination coordinates', () => {
    const result = evaluateRouteRisk({
      origin: { latitude: 13.7563, longitude: 100.5018 },
      destination: { latitude: 13.7500, longitude: 100.5650 },
      routePoints: [
        { latitude: 13.7563, longitude: 100.5018 },
        { latitude: 13.7500, longitude: 100.5650 },
      ],
    });

    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.label).toMatch(/ปลอดภัย|เสี่ยง|กลาง|สูง/);
  });
});
