import { loginUser, getAuthErrorMessage } from '../src/services/authService';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOtp: jest.fn(),
    },
  },
}));

describe('auth service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes email before requesting password sign-in', async () => {
    const data = { user: { id: 'user-id' } };
    supabase.auth.signInWithPassword.mockResolvedValue({ data, error: null });

    await expect(loginUser({ email: '  USER@Example.com ', password: 'password123' }))
      .resolves.toEqual({ data });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('reports invalid credentials and expired OTPs clearly', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    await expect(loginUser({ email: 'user@example.com', password: 'wrong' }))
      .resolves.toEqual({ error: { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' } });
    expect(getAuthErrorMessage({ code: 'otp_expired' })).toBe('รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่');
  });

  it('redacts credential-shaped values from unrecognized server errors', () => {
    const message = getAuthErrorMessage({
      message: 'Request failed with Bearer test-token',
    });
    expect(message).not.toContain('test-token');
    expect(message).toContain('[ซ่อนข้อมูลลับ]');
  });
});
