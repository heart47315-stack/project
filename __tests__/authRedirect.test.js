import { parseAuthUrl } from '../src/lib/authRedirect';

describe('auth redirect parsing', () => {
  it('extracts the recovery code from a callback URL', () => {
    const url = 'medsafeai://auth/callback?code=abc123&type=recovery';

    expect(parseAuthUrl(url)).toEqual({
      code: 'abc123',
      type: 'recovery',
      accessToken: null,
      refreshToken: null,
      tokenHash: null,
    });
  });

  it('extracts access token and refresh token from a hash-based auth callback', () => {
    const url = 'medsafeai://auth/callback#access_token=token123&refresh_token=refresh456';

    expect(parseAuthUrl(url)).toEqual({
      code: null,
      type: null,
      accessToken: 'token123',
      refreshToken: 'refresh456',
      tokenHash: null,
    });
  });

  it('extracts a token hash for Supabase verification callbacks', () => {
    expect(parseAuthUrl('medsafeai://auth/callback?token_hash=hash123&type=signup')).toEqual({
      code: null,
      type: 'signup',
      accessToken: null,
      refreshToken: null,
      tokenHash: 'hash123',
    });
  });
});
