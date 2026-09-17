import { extractRouteCoordinates } from '../src/services/safeRouteService';

describe('safe route helpers', () => {
  it('extracts route coordinates from a real OSRM GeoJSON response', () => {
    const payload = {
      routes: [
        {
          geometry: {
            type: 'LineString',
            coordinates: [
              [100.5018, 13.7563],
              [100.5081, 13.7611],
              [100.5162, 13.7657],
            ],
          },
        },
      ],
    };

    expect(extractRouteCoordinates(payload)).toEqual([
      { latitude: 13.7563, longitude: 100.5018 },
      { latitude: 13.7611, longitude: 100.5081 },
      { latitude: 13.7657, longitude: 100.5162 },
    ]);
  });
});
