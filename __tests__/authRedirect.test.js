import { parseAuthUrl } from '../src/lib/authRedirect';

describe('auth redirect parsing', () => {
  it('extracts the recovery code from a callback URL', () => {
    const url = 'medsafeai://auth/callback?code=abc123&type=recovery';

    expect(parseAuthUrl(url)).toEqual({
      code: 'abc123',
      type: 'recovery',
      accessToken: null,
      refreshToken: null,
    });
  });

  it('extracts access token and refresh token from a hash-based auth callback', () => {
    const url = 'medsafeai://auth/callback#access_token=token123&refresh_token=refresh456';

    expect(parseAuthUrl(url)).toEqual({
      code: null,
      type: null,
      accessToken: 'token123',
      refreshToken: 'refresh456',
    });
  });
});
