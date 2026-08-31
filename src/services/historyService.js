import { supabase } from '../lib/supabase';

/**
 * ค้นหาโรงพยาบาลหรือสถานพยาบาลจากชื่อ/ที่อยู่
 *
 * @param {string} query
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function searchHospitals(query = '') {
  const searchQuery = String(query || '').trim();

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
 * ค้นหาโรงพยาบาลใกล้ตำแหน่งปัจจุบัน
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} radiusKm
 *
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export async function getNearbyHospitals(
  latitude,
  longitude,
  radiusKm = 20
) {
  const userLat = Number(latitude);
  const userLng = Number(longitude);
  const radius = Number(radiusKm);

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return {
      data: [],
      error: new Error('ตำแหน่ง GPS ไม่ถูกต้อง'),
    };
  }

  if (
    userLat < -90 ||
    userLat > 90 ||
    userLng < -180 ||
    userLng > 180
  ) {
    return {
      data: [],
      error: new Error('พิกัด GPS อยู่นอกช่วงที่ถูกต้อง'),
    };
  }

  const { data, error } = await supabase.rpc(
    'nearby_hospitals',
    {
      user_lat: userLat,
      user_lng: userLng,
      radius_km: Number.isFinite(radius) && radius > 0
        ? radius
        : 20,
    }
  );

  return {
    data: data || [],
    error,
  };
}


/**
 * ดึงข้อมูลโรงพยาบาลจาก ID
 *
 * @param {string} hospitalId
 */
export async function getHospitalById(hospitalId) {
  if (!hospitalId) {
    return {
      data: null,
      error: new Error('ไม่พบ Hospital ID'),
    };
  }

  const { data, error } = await supabase
    .from('hospitals')
    .select(`
      id,
      source_code,
      ministry,
      department,
      name,
      address,
      latitude,
      longitude,
      created_at
    `)
    .eq('id', hospitalId)
    .single();

  return {
    data,
    error,
  };
}


/**
 * ดึงรายชื่อโรงพยาบาลจำนวนจำกัด
 *
 * @param {number} limit
 */
export async function getHospitals(limit = 50) {
  const safeLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 50)
  );

  const { data, error } = await supabase
    .from('hospitals')
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      ministry,
      department
    `)
    .order('name', { ascending: true })
    .limit(safeLimit);

  return {
    data: data || [],
    error,
  };
}

async function ensureUserAccess(userId) {
  if (!userId) {
    return { user: null, error: null };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error };
  }

  if (!data?.user) {
    return {
      user: null,
      error: new Error('ไม่พบผู้ใช้งานปัจจุบัน'),
    };
  }

  if (data.user.id !== userId) {
    return {
      user: null,
      error: new Error('ไม่ได้รับอนุญาตให้เข้าถึงข้อมูลนี้'),
    };
  }

  return { user: data.user, error: null };
}

export async function getUsageHistory(userId) {
  if (!userId) {
    return {
      data: [],
      error: null,
    };
  }

  const auth = await ensureUserAccess(userId);
  if (auth.error) {
    return {
      data: [],
      error: auth.error,
    };
  }

  const { data, error } = await supabase
    .from('usage_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return {
    data: data || [],
    error,
  };
}

export async function addUsageHistory(userId, payload = {}) {
  if (!userId) {
    return {
      data: null,
      error: new Error('ต้องระบุ userId ก่อนบันทึกประวัติการใช้งาน'),
    };
  }

  const auth = await ensureUserAccess(userId);
  if (auth.error) {
    return {
      data: null,
      error: auth.error,
    };
  }

  const record = {
    user_id: userId,
    action_type: payload.action_type || 'activity',
    title: payload.title || 'ประวัติการใช้งาน',
    description: payload.description || '',
    metadata: payload.metadata || {},
  };

  const { data, error } = await supabase
    .from('usage_history')
    .insert(record)
    .select()
    .single();

  return {
    data,
    error,
  };
}