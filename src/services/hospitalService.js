import { supabase, supabaseConfig } from '../lib/supabase';

const hospitalFallbackList = [
  {
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

function normalizeFallbackData(query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return hospitalFallbackList;

  return hospitalFallbackList.filter((item) =>
    item.name.toLowerCase().includes(q) ||
    item.address.toLowerCase().includes(q) ||
    item.district.toLowerCase().includes(q)
  );
}

/**
 * ค้นหาโรงพยาบาลจากชื่อหรือที่อยู่
 */
export async function searchHospitals(query = '') {
  const searchQuery = String(query).trim();

  if (!supabase || !supabaseConfig.configured) {
    return {
      data: normalizeFallbackData(searchQuery),
      error: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      'search_hospitals',
      {
        search_query: searchQuery,
      }
    );

    if (error) {
      return {
        data: normalizeFallbackData(searchQuery),
        error: null,
      };
    }

    return {
      data: data || [],
      error: null,
    };
  } catch {
    return {
      data: normalizeFallbackData(searchQuery),
      error: null,
    };
  }
}

/**
 * ค้นหาโรงพยาบาลใกล้ตำแหน่ง GPS
 */
export async function getNearbyHospitals(
  latitude,
  longitude,
  radiusKm = 20
) {
  const userLat = Number(latitude);
  const userLng = Number(longitude);

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return {
      data: [],
      error: new Error('ตำแหน่ง GPS ไม่ถูกต้อง'),
    };
  }

  if (!supabase || !supabaseConfig.configured) {
    return {
      data: normalizeFallbackData(),
      error: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      'nearby_hospitals',
      {
        user_lat: userLat,
        user_lng: userLng,
        radius_km: Number(radiusKm) || 20,
      }
    );

    if (error) {
      return {
        data: normalizeFallbackData(),
        error: null,
      };
    }

    return {
      data: data || [],
      error: null,
    };
  } catch {
    return {
      data: normalizeFallbackData(),
      error: null,
    };
  }
}

/**
 * ดึงข้อมูลโรงพยาบาลจาก ID
 */
export async function getHospitalById(hospitalId) {
  if (!supabase || !supabaseConfig.configured) {
    return {
      data: normalizeFallbackData()[0] || null,
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .single();

    return {
      data,
      error,
    };
  } catch {
    return {
      data: normalizeFallbackData()[0] || null,
      error: null,
    };
  }
}