import { supabase, supabaseConfig } from '../lib/supabase';

const HOSPITALS_PAGE_SIZE = 1000;
const NOMINATIM_TIMEOUT_MS = 10000;

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function getHospitalText(hospital) {
  return [
    hospital.name,
    hospital.hospital_name,
    hospital.address,
    hospital.location,
    hospital.province,
    hospital.district,
    hospital.type,
    hospital.ministry,
    hospital.department,
  ].map(normalizeText).join(' ');
}

function filterHospitals(hospitals, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return hospitals;

  return hospitals.filter((hospital) =>
    getHospitalText(hospital).includes(normalizedQuery)
  );
}

function getCoordinate(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return NaN;
  }
  return Number(value);
}

function isValidCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

function getDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine)
  );
}

function findNearbyHospitals(hospitals, latitude, longitude, radiusKm) {
  return hospitals
    .map((hospital) => {
      const hospitalLatitude = getCoordinate(hospital.latitude ?? hospital.lat);
      const hospitalLongitude = getCoordinate(hospital.longitude ?? hospital.lng);
      if (!isValidCoordinates(hospitalLatitude, hospitalLongitude)) return null;

      const distanceKm = getDistanceKm(
        latitude,
        longitude,
        hospitalLatitude,
        hospitalLongitude
      );
      if (distanceKm > radiusKm) return null;

      return { ...hospital, distance_km: distanceKm };
    })
    .filter(Boolean)
    .sort((first, second) => first.distance_km - second.distance_km);
}

function getError(error, fallbackMessage) {
  if (error instanceof Error) return error;
  if (error?.message) return new Error(error.message);
  return new Error(fallbackMessage);
}

function createServiceError(message, code, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

async function searchOpenStreetMap(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&accept-language=th&q=${encodeURIComponent(query)}`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS) : null;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'MedSafeAI/1.1 (SafeRoute)' },
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      throw createServiceError('บริการค้นหาสถานที่จาก OpenStreetMap ขัดข้อง', 'nominatim-http-error');
    }

    const places = await response.json();

    return (Array.isArray(places) ? places : []).map((place) => {
      const latitude = getCoordinate(place.lat);
      const longitude = getCoordinate(place.lon);
      if (!isValidCoordinates(latitude, longitude)) return null;

      return {
        id: `nominatim-${place.place_id}`,
        name: place.display_name?.split(',')[0] || 'สถานที่จาก OpenStreetMap',
        title: place.display_name?.split(',')[0] || 'สถานที่จาก OpenStreetMap',
        address: place.display_name || '',
        type: place.type || place.class || '',
        latitude,
        longitude,
        source: 'NOMINATIM',
      };
    }).filter(Boolean);
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      throw createServiceError('บริการค้นหาสถานที่ใช้เวลานานเกินไป กรุณาลองใหม่', 'nominatim-timeout', error);
    }
    throw error?.code ? error : createServiceError('ไม่สามารถเชื่อมต่อบริการค้นหาสถานที่ได้', 'nominatim-unavailable', error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function searchNominatimWithStatus(query) {
  try {
    return { data: await searchOpenStreetMap(query), error: null };
  } catch (error) {
    return {
      data: [],
      error: getError(error, 'ไม่สามารถค้นหาสถานที่ได้'),
    };
  }
}

async function getHospitalsFromTable() {
  const hospitals = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .range(offset, offset + HOSPITALS_PAGE_SIZE - 1);

    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) break;

    hospitals.push(...data);
    if (data.length < HOSPITALS_PAGE_SIZE) break;
    offset += HOSPITALS_PAGE_SIZE;
  }

  return hospitals;
}

/**
 * ค้นหาโรงพยาบาลจากชื่อหรือที่อยู่
 */
export async function searchHospitals(query = '') {
  const searchQuery = String(query ?? '').trim();

  if (!supabase || !supabaseConfig?.configured) {
    return searchNominatimWithStatus(searchQuery);
  }

  try {
    const { data, error } = await supabase.rpc('search_hospitals', {
      search_query: searchQuery,
    });

    if (!error) {
      if (Array.isArray(data) && data.length > 0) {
        return { data, error: null };
      }
    }
  } catch {
    // Fall back to a table query when the RPC is unavailable.
  }

  try {
    const hospitals = await getHospitalsFromTable();
    const matches = filterHospitals(hospitals, searchQuery);
    if (matches.length > 0) return { data: matches, error: null };
  } catch {}

  // รองรับร้านขายยา/สถานพยาบาลที่ไม่อยู่ในตาราง hospitals
  const nominatimResult = await searchNominatimWithStatus(searchQuery);
  if (nominatimResult.error) return nominatimResult;
  return nominatimResult;
}

/**
 * ค้นหาโรงพยาบาลใกล้ตำแหน่ง GPS
 */
export async function getNearbyHospitals(latitude, longitude, radiusKm = 20) {
  const userLat = getCoordinate(latitude);
  const userLng = getCoordinate(longitude);
  const radius = getCoordinate(radiusKm);

  if (!isValidCoordinates(userLat, userLng)) {
    return {
      data: [],
      error: new Error('ตำแหน่ง GPS ไม่ถูกต้อง'),
    };
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    return {
      data: [],
      error: new Error('รัศมีค้นหาต้องเป็นตัวเลขที่มากกว่า 0'),
    };
  }

  if (!supabase || !supabaseConfig?.configured) {
    return { data: [], error: new Error('ยังไม่สามารถค้นหาสถานที่ใกล้เคียงโดยไม่มีฐานข้อมูลได้') };
  }

  try {
    const { data, error } = await supabase.rpc('nearby_hospitals', {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: radius,
    });

    if (!error) {
      return {
        data: Array.isArray(data) ? data : [],
        error: null,
      };
    }
  } catch {
    // Fall back to a table query when the RPC is unavailable.
  }

  try {
    const hospitals = await getHospitalsFromTable();
    return {
      data: findNearbyHospitals(hospitals, userLat, userLng, radius),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: getError(error, 'ไม่สามารถค้นหาโรงพยาบาลใกล้เคียงได้'),
    };
  }
}

/**
 * ดึงข้อมูลโรงพยาบาลจาก ID
 */
export async function getHospitalById(hospitalId) {
  const id = String(hospitalId ?? '').trim();
  if (!id) {
    return {
      data: null,
      error: new Error('กรุณาระบุ Hospital ID'),
    };
  }

  if (!supabase || !supabaseConfig?.configured) {
    return { data: null, error: new Error('ไม่พบข้อมูลสถานที่ในฐานข้อมูล') };
  }

  try {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return {
      data: data || null,
      error,
    };
  } catch (error) {
    return {
      data: null,
      error: getError(error, 'ไม่สามารถดึงข้อมูลโรงพยาบาลได้'),
    };
  }
}
