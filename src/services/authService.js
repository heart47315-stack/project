import { supabase } from '../lib/supabase';

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const genericError = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

function getFriendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  }
  if (message.includes('email not confirmed') || message.includes('confirm your email')) {
    return { message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' };
  }
  if (message.includes('already registered')) {
    return { message: 'อีเมลนี้สมัครสมาชิกแล้ว กรุณาเข้าสู่ระบบ' };
  }
  if (message.includes('password')) {
    return { message: 'รหัสผ่านไม่ตรงตามเงื่อนไขของระบบ' };
  }
  return { message: genericError };
}

export async function registerUser({ fullName, email, password }) {
  const trimmedName = String(fullName || '').trim();
  const trimmedEmail = normalizeEmail(email);
  if (!trimmedName || !trimmedEmail || !password) {
    return { error: { message: 'กรุณากรอกชื่อ อีเมล และรหัสผ่านให้ครบถ้วน' } };
  }
  if (password.length < 8) return { error: { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' } };

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: { data: { full_name: trimmedName } },
  });
  if (error) return { error: getFriendlyAuthError(error) };
  if (!data?.user?.id) return { error: { message: genericError } };

  // The profile migration also creates this row via a trigger when enabled.
  // Upsert keeps the client flow compatible with projects that have not yet
  // applied that migration.
  const { error: profileError } = await supabase.from('profiles').upsert(
    { id: data.user.id, full_name: trimmedName, email: trimmedEmail },
    { onConflict: 'id' }
  );
  if (profileError) return { data, error: getFriendlyAuthError(profileError), needsEmailConfirmation: !data.session };
  return { data, needsEmailConfirmation: !data.session };
}

export async function loginUser({ email, password }) {
  const trimmedEmail = normalizeEmail(email);
  if (!trimmedEmail || !password) return { error: { message: 'กรุณากรอกอีเมลและรหัสผ่าน' } };
  const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
  return error ? { error: getFriendlyAuthError(error) } : { data };
}

export async function requestPasswordReset(email) {
  const trimmedEmail = normalizeEmail(email);
  if (!trimmedEmail) return { error: { message: 'กรุณากรอกอีเมล' } };
  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  return error ? { error: getFriendlyAuthError(error) } : { success: true };
}

export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return error ? { error: getFriendlyAuthError(error) } : { data: session?.user || null, error: null };
}
