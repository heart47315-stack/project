import { supabase } from '../lib/supabase';

const normalizeEmail = (value = '') => value.trim();

function getFriendlyAuthError(error) {
  if (!error) return { message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };

  const message = String(error.message || '').toLowerCase();

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }

  if (message.includes('email not confirmed') || message.includes('confirm your email')) {
    return { message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' };
  }

  if (message.includes('user already registered') || message.includes('already registered')) {
    return { message: 'อีเมลนี้สมัครสมาชิกไปแล้ว กรุณาเข้าสู่ระบบแทน' };
  }

  if (message.includes('password')) {
    return { message: 'รหัสผ่านไม่ตรงตามเงื่อนไขที่ระบบต้องการ' };
  }

  return { message: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
}

export async function registerUser({ fullName, email, password }) {
  const trimmedName = (fullName || '').trim();
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedName || !trimmedEmail || !password) {
    return { error: { message: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบถ้วน' } };
  }

  if (password.length < 6) {
    return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' } };
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        full_name: trimmedName,
      },
    },
  });

  if (error) {
    return { error: getFriendlyAuthError(error) };
  }

  if (!data?.user?.id) {
    return { data, error: { message: 'สร้างบัญชีสำเร็จแต่ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่อีกครั้ง' } };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: data.user.id,
        full_name: trimmedName,
        email: trimmedEmail,
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    return { data, error: getFriendlyAuthError(profileError), needsEmailConfirmation: !data.session };
  }

  return {
    data,
    needsEmailConfirmation: !data.session,
  };
}

export async function loginUser({ email, password }) {
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedEmail || !password) {
    return { error: { message: 'กรุณากรอกอีเมลและรหัสผ่าน' } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    return { error: getFriendlyAuthError(error) };
  }

  return { data };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: getFriendlyAuthError(error) };
  }

  return { success: true };
}

export async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return { error: getFriendlyAuthError(error) };
  }

  if (!session?.user) {
    return { data: null, error: null };
  }

  return { data: session.user, error: null };
}
