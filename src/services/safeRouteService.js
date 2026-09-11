const EARTH_RADIUS_KM = 6371;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePoint(point) {
  if (!point || !Number.isFinite(Number(point.latitude)) || !Number.isFinite(Number(point.longitude))) {
    return null;
  }

  return {
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  };
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

export function evaluateRouteRisk({ origin, destination, routePoints = [] }) {
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
  const distanceKm = haversineDistanceKm(source, target);
  const segmentCount = Math.max(points.length - 1, 1);
  const pointSpread = Math.min(35, Math.max(0, points.length * 4));

  // Weighted deterministic risk score, no API dependency.
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
