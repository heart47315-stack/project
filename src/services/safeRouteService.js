const EARTH_RADIUS_KM = 6371;
const OSRM_TIMEOUT_MS = 10000;

export function isCurrentRouteRequest(requestId, latestRequestId) {
  return requestId === latestRequestId;
}

export async function fetchRouteBetween(origin, destination) {
  if (!origin || !destination) {
    return { ok: false, error: 'missing-route-points', route: [] };
  }

  const from = normalizePoint(origin);
  const to = normalizePoint(destination);

  if (!from || !to) {
    return { ok: false, error: 'invalid-route-points', route: [] };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeout = null;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&steps=false`;
    const request = fetch(url, {
      ...(controller ? { signal: controller.signal } : {}),
    });
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        if (controller) controller.abort();
        const timeoutError = new Error('OSRM request timed out');
        timeoutError.code = 'osrm-timeout';
        reject(timeoutError);
      }, OSRM_TIMEOUT_MS);
    });
    const response = await Promise.race([request, timeoutPromise]);
    if (!response.ok) {
      return { ok: false, error: 'osrm-http-error', route: [] };
    }

    let payload;
    try {
      payload = await Promise.race([response.json(), timeoutPromise]);
    } catch {
      return { ok: false, error: 'invalid-route-response', route: [], distanceKm: null };
    }
    const route = extractRouteCoordinates(payload);
    const rawDistanceKm = Number(payload?.routes?.[0]?.distance) / 1000;
    const hasValidDistance = Number.isFinite(rawDistanceKm) && rawDistanceKm >= 0;

    if (route.length < 2) {
      return { ok: false, error: 'no-route-found', route: [], distanceKm: null };
    }

    if (!hasValidDistance) {
      return { ok: false, error: 'invalid-route-response', route: [], distanceKm: null };
    }

    return {
      ok: true,
      error: null,
      route,
      distanceKm: rawDistanceKm,
      raw: payload,
    };
  } catch (error) {
    if (error?.code === 'osrm-timeout' || error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      return { ok: false, error: 'osrm-timeout', route: [] };
    }
    return { ok: false, error: 'osrm-network-error', route: [] };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function extractRouteCoordinates(payload) {
  const routes = Array.isArray(payload?.routes) ? payload.routes : [];
  const candidate = routes[0]?.geometry;

  if (!candidate || candidate.type !== 'LineString' || !Array.isArray(candidate.coordinates)) {
    return [];
  }

  const points = candidate.coordinates.map((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const [longitude, latitude] = coordinate;
    const point = normalizePoint({ latitude, longitude });
    return point;
  });

  return points.every(Boolean) ? points : [];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePoint(point) {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function haversineDistanceKm(from, to) {
  const origin = normalizePoint(from);
  const destination = normalizePoint(to);

  if (!origin || !destination) {
    return 0;
  }

  const lat1 = origin.latitude * Math.PI / 180;
  const lat2 = destination.latitude * Math.PI / 180;
  const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
  const dLng = (destination.longitude - origin.longitude) * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function normalizeRoutePoints(routePoints = []) {
  if (!Array.isArray(routePoints)) return [];
  return routePoints.map(normalizePoint).filter(Boolean);
}

export function evaluateRouteRisk({ origin, destination, routePoints = [], routeDistanceKm = null }) {
  const source = normalizePoint(origin) || normalizeRoutePoints(routePoints)[0] || null;
  const target = normalizePoint(destination) || normalizeRoutePoints(routePoints).at(-1) || null;

  if (!source || !target) {
    return {
      score: 50,
      label: 'ปลอดภัยระดับกลาง',
      distanceKm: 0,
      status: 'unknown',
      summary: 'ยังไม่มีจุดเริ่มต้นและปลายทางสำหรับประเมินเส้นทาง',
      confidence: 'local-fallback',
    };
  }

  const points = normalizeRoutePoints(routePoints);
  const distanceKm = routeDistanceKm !== null && routeDistanceKm !== undefined && Number.isFinite(Number(routeDistanceKm))
    ? Number(routeDistanceKm)
    : haversineDistanceKm(source, target);
  const segmentCount = Math.max(points.length - 1, 1);
  const pointSpread = Math.min(35, Math.max(0, points.length * 4));

  // คะแนนความเสี่ยงแบบ deterministic ที่ถ่วงน้ำหนักโดยไม่พึ่ง API ภายนอก
  const distanceComponent = clamp(distanceKm * 4.2, 0, 35);
  const routeComplexity = clamp(segmentCount * 8, 0, 25);
  const spreadComponent = clamp(pointSpread, 0, 18);
  const score = clamp(Math.round(distanceComponent + routeComplexity + spreadComponent + 12), 0, 100);

  let label = 'ปลอดภัย';
  let status = 'low';
  if (score >= 75) {
    label = 'เสี่ยงสูง';
    status = 'high';
  } else if (score >= 45) {
    label = 'ระดับกลาง';
    status = 'medium';
  } else {
    label = 'ปลอดภัย';
    status = 'low';
  }

  const summary = `${label} | ระยะทาง ${distanceKm.toFixed(2)} กม. | คะแนนความเสี่ยง ${score}`;

  return {
    score,
    label,
    distanceKm: Number(distanceKm.toFixed(2)),
    status,
    summary,
    confidence: 'local-engine',
  };
}
