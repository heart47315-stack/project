import { supabase } from '../lib/supabase';

export const AUTH_REDIRECT_SCHEME = 'medsafeai://auth/callback';
export const AUTH_REDIRECT_URL = AUTH_REDIRECT_SCHEME;

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const genericError = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function getFriendlyAuthError(error) {
  const originalMessage = String(error?.message || '').trim();
  const message = originalMessage.toLowerCase();
  const code = String(error?.code || '').toLowerCase();

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
  if (code.includes('email_address_invalid') || message.includes('invalid email')) {
    return { message: 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' };
  }
  if (
    code === 'weak_password' ||
    message.includes('password should') ||
    message.includes('password must') ||
    message.includes('password is too short')
  ) {
    return { message: 'รหัสผ่านไม่ตรงตามเงื่อนไขของระบบ' };
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { message: 'ดำเนินการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };
  }
  if (
    code.includes('otp_expired') ||
    message.includes('otp expired') ||
    message.includes('token has expired') ||
    message.includes('expired token') ||
    message.includes('has expired')
  ) {
    return { code: 'otp_expired', message: 'รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่' };
  }
  if (
    message.includes('invalid otp') ||
    message.includes('invalid token') ||
    message.includes('token is invalid') ||
    message.includes('otp is invalid')
  ) {
    return { code: 'otp_invalid', message: 'รหัสยืนยันไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' };
  }
  if (
    message.includes('sms provider') ||
    message.includes('phone provider') ||
    message.includes('sms is not configured') ||
    message.includes('phone signups are disabled') ||
    message.includes('phone provider is not enabled')
  ) {
    return { code: 'sms_provider_not_configured', message: 'การเข้าสู่ระบบด้วยเบอร์โทรยังไม่ได้ตั้งค่าผู้ให้บริการ SMS ใน Supabase' };
  }
  if (
    message.includes('error sending confirmation email') ||
    message.includes('error sending recovery email') ||
    message.includes('failed to send email')
  ) {
    return { code: 'email_delivery_failed', message: 'Supabase ส่งอีเมลไม่สำเร็จ โปรดตรวจสอบ SMTP และเทมเพลตอีเมลใน Dashboard' };
  }
  if (
    code === 'session_not_found' ||
    message.includes('auth session missing') ||
    message.includes('session has expired')
  ) {
    return { code: 'auth_session_expired', message: 'เซสชันหมดอายุ กรุณาขอลิงก์ยืนยันหรือรีเซ็ตรหัสผ่านใหม่' };
  }
  if (message.includes('database error saving new user')) {
    return { code: 'user_creation_failed', message: 'Supabase สร้างบัญชีไม่สำเร็จ โปรดตรวจสอบ migrations และ Auth database triggers' };
  }
  if (message.includes('invalid api key') || message.includes('no api key found')) {
    return { code: 'invalid_api_key', message: 'Supabase ปฏิเสธคีย์สาธารณะของแอป โปรดตรวจสอบ URL และ publishable/anon key ใน EAS production environment' };
  }
  if (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('not allowed')
  ) {
    return { code: 'database_permission_denied', message: 'Supabase ปฏิเสธการเข้าถึงข้อมูล โปรดตรวจสอบ RLS policies และสิทธิ์ของผู้ใช้' };
  }
  if (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the column')
  ) {
    return { code: 'database_schema_error', message: 'โครงสร้างฐานข้อมูลไม่ตรงกับแอป โปรดตรวจสอบและติดตั้ง Supabase migrations ที่จำเป็น' };
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('failed to connect')
  ) {
    return { message: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ' };
  }

  const safeMessage = originalMessage.replace(
    /(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/gi,
    '[ซ่อนข้อมูลลับ]'
  );
  return { code: error?.code, message: safeMessage || genericError };
}

export function getAuthErrorMessage(error) {
  return getFriendlyAuthError(error).message;
}

async function runAuthRequest(request) {
  try {
    return await request();
  } catch (error) {
    return { data: null, error };
  }
}

export async function registerUser({
  fullName,
  email,
  password,
  confirmPassword,
  dateOfBirth,
  gender,
  height,
  weight,
  bloodType,
}) {
  const trimmedName = String(fullName || '').trim();
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedName || !trimmedEmail || !password) {
    return { error: { message: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบถ้วน' } };
  }

  if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
    return { error: { message: 'รูปแบบอีเมลไม่ถูกต้อง' } };
  }

  if (password.length < 8) {
    return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } };
  }

  if (typeof confirmPassword !== 'undefined' && password !== confirmPassword) {
    return { error: { message: 'ยืนยันรหัสผ่านไม่ตรงกัน' } };
  }

  const hasHeight = height !== '' && height !== null && typeof height !== 'undefined';
  const hasWeight = weight !== '' && weight !== null && typeof weight !== 'undefined';
  const safeHeight = hasHeight ? Number(height) : null;
  const safeWeight = hasWeight ? Number(weight) : null;

  if (hasHeight && !Number.isFinite(safeHeight)) {
    return { error: { message: 'ส่วนสูงต้องเป็นตัวเลขเท่านั้น' } };
  }

  if (hasWeight && !Number.isFinite(safeWeight)) {
    return { error: { message: 'น้ำหนักต้องเป็นตัวเลขเท่านั้น' } };
  }

  if (dateOfBirth && !isValidDateOnly(String(dateOfBirth))) {
    return { error: { message: 'วันเกิดไม่ถูกต้อง กรุณากรอกวันที่ในรูปแบบ YYYY-MM-DD' } };
  }

  const validBloodTypes = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const trimmedBloodType = String(bloodType || '').trim();
  if (trimmedBloodType && !validBloodTypes.includes(trimmedBloodType.toUpperCase().replace(/\s+/g, ''))) {
    return { error: { message: 'กรุ๊ปเลือดไม่ถูกต้อง' } };
  }

  const profileData = {
    full_name: trimmedName,
    date_of_birth: dateOfBirth || null,
    gender: gender || null,
    height: safeHeight,
    weight: safeWeight,
    blood_type: trimmedBloodType || null,
  };

  const { data, error } = await runAuthRequest(() => supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: profileData,
      emailRedirectTo: AUTH_REDIRECT_URL,
    },
  }));

  if (error) return { error: getFriendlyAuthError(error) };
  if (!data?.user?.id) return { error: { message: genericError } };

  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      error: {
        message: 'อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบหรือกดลืมรหัสผ่าน',
      },
    };
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

  const { data, error } = await runAuthRequest(() => supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  }));

  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function requestEmailOtp(email) {
  const trimmedEmail = normalizeEmail(email);
  if (!trimmedEmail) return { error: { message: 'กรุณากรอกอีเมล' } };
  const { data, error } = await runAuthRequest(() => supabase.auth.signInWithOtp({
    email: trimmedEmail,
    options: { shouldCreateUser: false, emailRedirectTo: AUTH_REDIRECT_URL },
  }));
  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function verifyEmailOtp(email, token) {
  const trimmedEmail = normalizeEmail(email);
  if (!trimmedEmail || !/^\d{6}$/.test(String(token || ''))) return { error: { message: 'กรุณากรอก OTP 6 หลัก' } };
  const { data, error } = await runAuthRequest(() => supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: String(token),
    type: 'email',
  }));
  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function requestPasswordReset(email) {
  const trimmedEmail = normalizeEmail(email);

  if (!trimmedEmail) {
    return { error: { message: 'กรุณากรอกอีเมล' } };
  }

  const { error } = await runAuthRequest(() => supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: AUTH_REDIRECT_URL,
  }));

  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function updatePassword(password) {
  if (!password || password.length < 8) {
    return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } };
  }

  const { data, error } = await runAuthRequest(() => supabase.auth.updateUser({ password }));

  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function logoutUser() {
  const { error } = await runAuthRequest(() => supabase.auth.signOut());
  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function getCurrentUser() {
  const { data, error } = await runAuthRequest(() => supabase.auth.getSession());

  return error
    ? { error: getFriendlyAuthError(error) }
    : { data: data?.session?.user || null, error: null };
}
