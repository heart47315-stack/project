import {
  evaluateRouteRisk,
  extractRouteCoordinates,
  fetchRouteBetween,
  isCurrentRouteRequest,
} from '../src/services/safeRouteService';

describe('safe route helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('only applies the latest route request result', () => {
    expect(isCurrentRouteRequest(7, 7)).toBe(true);
    expect(isCurrentRouteRequest(6, 7)).toBe(false);
  });

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
          distance: 1500,
        },
      ],
    };

    expect(extractRouteCoordinates(payload)).toEqual([
      { latitude: 13.7563, longitude: 100.5018 },
      { latitude: 13.7611, longitude: 100.5081 },
      { latitude: 13.7657, longitude: 100.5162 },
    ]);
  });

  it('fetches a valid OSRM route and uses the road distance', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          distance: 2450,
          geometry: {
            type: 'LineString',
            coordinates: [[100.5018, 13.7563], [100.5162, 13.7657]],
          },
        }],
      }),
    });

    const result = await fetchRouteBetween(
      { latitude: 13.7563, longitude: 100.5018 },
      { latitude: 13.7657, longitude: 100.5162 }
    );

    expect(result.ok).toBe(true);
    expect(result.distanceKm).toBe(2.45);
    expect(result.route).toHaveLength(2);
    expect(global.fetch.mock.calls[0][0]).toContain('/route/v1/driving/100.5018,13.7563;100.5162,13.7657');
  });

  it('rejects invalid input before calling OSRM', async () => {
    const result = await fetchRouteBetween(
      { latitude: 999, longitude: 100 },
      { latitude: 13.7657, longitude: 100.5162 }
    );

    expect(result).toEqual({ ok: false, error: 'invalid-route-points', route: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns clear errors for timeout, HTTP failure, and no route', async () => {
    const timeoutError = new Error('aborted');
    timeoutError.name = 'AbortError';
    global.fetch.mockRejectedValueOnce(timeoutError);
    await expect(fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    )).resolves.toMatchObject({ ok: false, error: 'osrm-timeout', route: [] });

    global.fetch.mockResolvedValueOnce({ ok: false });
    await expect(fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    )).resolves.toMatchObject({ ok: false, error: 'osrm-http-error', route: [] });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'NoRoute', routes: [] }),
    });
    await expect(fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    )).resolves.toMatchObject({ ok: false, error: 'no-route-found', route: [] });
  });

  it('uses a safe timeout fallback when AbortController is unavailable', async () => {
    const originalAbortController = global.AbortController;
    global.AbortController = undefined;
    jest.useFakeTimers();
    global.fetch.mockReturnValue(new Promise(() => {}));

    const pending = fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    );
    jest.advanceTimersByTime(10000);

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: 'osrm-timeout',
      route: [],
    });

    jest.useRealTimers();
    global.AbortController = originalAbortController;
  });

  it('uses a provided OSRM distance for risk evaluation', async () => {
    const result = evaluateRouteRisk({
      origin: { latitude: 13, longitude: 100 },
      destination: { latitude: 13.1, longitude: 100.1 },
      routePoints: [
        { latitude: 13, longitude: 100 },
        { latitude: 13.05, longitude: 100.05 },
        { latitude: 13.1, longitude: 100.1 },
      ],
      routeDistanceKm: 2.45,
    });

    expect(result.distanceKm).toBe(2.45);
  });

  it('rejects malformed route geometry and missing distance', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          distance: 1000,
          geometry: { type: 'LineString', coordinates: [[100, 13], ['bad', 13.1]] },
        }],
      }),
    });
    await expect(fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    )).resolves.toMatchObject({ ok: false, error: 'no-route-found', route: [] });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: { type: 'LineString', coordinates: [[100, 13], [100.1, 13.1]] },
        }],
      }),
    });
    await expect(fetchRouteBetween(
      { latitude: 13, longitude: 100 },
      { latitude: 13.1, longitude: 100.1 }
    )).resolves.toMatchObject({ ok: false, error: 'invalid-route-response', route: [] });
  });
});
