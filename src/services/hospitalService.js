import { supabase, supabaseConfig } from '../lib/supabase';

const hospitalFallbackList = [
  {
    id: 'sample-hospital-central',
    name: 'โรงพยาบาลศูนย์กลาง',
    type: 'โรงพยาบาล',
    address: '123 ถนนตัวอย่าง แขวงพญาไท',
    province: 'กรุงเทพมหานคร',
    district: 'พญาไท',
    latitude: 13.7500,
    longitude: 100.5650,
    phone: '02-XXX-XXXX',
    source: 'SAMPLE',
  },
  {
    id: 'sample-clinic',
    name: 'คลินิกตัวอย่าง',
    type: 'คลินิก',
    address: '456 ซอยตัวอย่าง เขตราชเทวี',
    province: 'กรุงเทพมหานคร',
    district: 'ราชเทวี',
    latitude: 13.7468,
    longitude: 100.5678,
    phone: '02-YYY-YYYY',
    source: 'SAMPLE',
  },
];
const HOSPITALS_PAGE_SIZE = 1000;

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
    return {
      data: filterHospitals(hospitalFallbackList, searchQuery),
      error: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc('search_hospitals', {
      search_query: searchQuery,
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
      data: filterHospitals(hospitals, searchQuery),
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error: getError(error, 'ไม่สามารถค้นหาข้อมูลโรงพยาบาลได้'),
    };
  }
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
    return {
      data: findNearbyHospitals(hospitalFallbackList, userLat, userLng, radius),
      error: null,
    };
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
    return {
      data: hospitalFallbackList.find((hospital) => hospital.id === id) || null,
      error: null,
    };
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
