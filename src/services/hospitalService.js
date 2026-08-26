import { supabase } from '../lib/supabase';

/**
 * ค้นหาโรงพยาบาลจากชื่อหรือที่อยู่
 */
export async function searchHospitals(query = '') {
  const searchQuery = String(query).trim();

  const { data, error } = await supabase.rpc(
    'search_hospitals',
    {
      search_query: searchQuery,
    }
  );

  return {
    data: data || [],
    error,
  };
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

  const { data, error } = await supabase.rpc(
    'nearby_hospitals',
    {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: Number(radiusKm) || 20,
    }
  );

  return {
    data: data || [],
    error,
  };
}

/**
 * ดึงข้อมูลโรงพยาบาลจาก ID
 */
export async function getHospitalById(hospitalId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .eq('id', hospitalId)
    .single();

  return {
    data,
    error,
  };
}