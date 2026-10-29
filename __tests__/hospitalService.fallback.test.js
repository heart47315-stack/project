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

describe('hospital service without Supabase', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        place_id: 123,
        display_name: 'โรงพยาบาลจริง, เชียงใหม่',
        type: 'hospital',
        lat: '18.7883',
        lon: '98.9853',
      }],
    });
  });

  it('searches real OpenStreetMap results with coordinates', async () => {
    const result = await searchHospitals('โรงพยาบาล');

    expect(result.error).toBeNull();
    expect(result.data[0]).toMatchObject({
      name: 'โรงพยาบาลจริง',
      latitude: 18.7883,
      longitude: 98.9853,
      source: 'NOMINATIM',
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nominatim.openstreetmap.org'), expect.any(Object));
  });

  it('does not invent nearby places without a configured database', async () => {
    const result = await getNearbyHospitals(13.7500, 100.5650, 1);

    expect(result.data).toEqual([]);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('rejects invalid coordinates and search radius', async () => {
    const invalidCoordinates = await getNearbyHospitals('', 100.5650);
    const invalidRadius = await getNearbyHospitals(13.7500, 100.5650, 0);

    expect(invalidCoordinates.data).toEqual([]);
    expect(invalidCoordinates.error).toBeInstanceOf(Error);
    expect(invalidRadius.data).toEqual([]);
    expect(invalidRadius.error).toBeInstanceOf(Error);
  });

  it('does not return a fabricated record by ID', async () => {
    const found = await getHospitalById('sample-clinic');
    const missing = await getHospitalById('unknown-id');

    expect(found.data).toBeNull();
    expect(found.error).toBeInstanceOf(Error);
    expect(missing.data).toBeNull();
    expect(missing.error).toBeInstanceOf(Error);
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
