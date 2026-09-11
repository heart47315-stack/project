import { searchHospitals } from '../src/services/hospitalService';
import { evaluateRouteRisk } from '../src/services/safeRouteService';

describe('hospital fallback service', () => {
  it('returns local sample hospital data when Supabase is not configured', async () => {
    const result = await searchHospitals('โรงพยาบาล');

    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].name).toContain('โรงพยาบาล');
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
