import {
  completeGoogleLogin,
  getAuthErrorMessage,
  loginUser,
  startGoogleLogin,
} from '../src/services/authService';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
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

  it('starts Supabase Google OAuth using the app redirect URL', async () => {
    const data = { url: 'https://supabase.example/auth/v1/authorize?provider=google' };
    supabase.auth.signInWithOAuth.mockResolvedValue({ data, error: null });

    await expect(startGoogleLogin('medsafeai://auth/callback'))
      .resolves.toEqual({ data });
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'medsafeai://auth/callback',
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
  });

  it('exchanges the OAuth callback code for a Supabase session', async () => {
    const data = { user: { id: 'google-user' }, session: { access_token: 'supabase-token' } };
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data, error: null });

    await expect(completeGoogleLogin('medsafeai://auth/callback?code=oauth-code'))
      .resolves.toEqual({ data });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
  });

  it('reports when Google provider has not been enabled in Supabase', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'Unsupported provider: provider is not enabled' },
    });

    await expect(startGoogleLogin()).resolves.toEqual({
      error: { message: 'Google Login ยังไม่ได้เปิดใช้งานใน Supabase Authentication > Providers' },
    });
  });

  it('redacts credential-shaped values from unrecognized server errors', () => {
    const message = getAuthErrorMessage({
      message: 'Request failed with Bearer test-token',
    });
    expect(message).not.toContain('test-token');
    expect(message).toContain('[ซ่อนข้อมูลลับ]');
  });
});
