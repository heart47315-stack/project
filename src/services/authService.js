import { supabase } from '../lib/supabase';

export const AUTH_REDIRECT_URL =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || 'medsafeai://auth/callback';

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const genericError = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

function getFriendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  if (
    message.includes('email not confirmed') ||
    message.includes('confirm your email')
  ) {
    return { message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' };
  }
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user already registered')
  ) {
    return { message: 'อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน' };
  }
  if (message.includes('password')) {
    return { message: 'รหัสผ่านไม่ตรงตามเงื่อนไขของระบบ' };
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { message: 'ดำเนินการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };
  }
  if (message.includes('network') || message.includes('fetch')) {
    return { message: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ' };
  }

  return { message: genericError };
}

export function getAuthErrorMessage(error) {
  return getFriendlyAuthError(error).message;
}

export async function registerUser({ fullName, email, password }) {
  const trimmedName = String(fullName || '').trim();
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedName || !trimmedEmail || !password) {
    return { error: { message: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบถ้วน' } };
  }

  if (password.length < 8) {
    return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } };
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { full_name: trimmedName },
      emailRedirectTo: AUTH_REDIRECT_URL,
    },
  });

  if (error) return { error: getFriendlyAuthError(error) };
  if (!data?.user?.id) return { error: { message: genericError } };

  // Supabase may return a user with no identities when an email already exists
  // while email enumeration protection is enabled.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      error: {
        message: 'อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน',
      },
    };
  }

  // Do not upsert profiles from the mobile client before email confirmation:
  // RLS correctly rejects anonymous writes. The database trigger creates the
  // profile row when auth.users is created.
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

  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function requestPasswordReset(email) {
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedEmail) {
    return { error: { message: 'กรุณากรอกอีเมล' } };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: AUTH_REDIRECT_URL,
  });

  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function updatePassword(password) {
  if (!password || password.length < 8) {
    return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } };
  }

  const { data, error } = await supabase.auth.updateUser({ password });

  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  return error
    ? { error: getFriendlyAuthError(error) }
    : { data: session?.user || null, error: null };
}
