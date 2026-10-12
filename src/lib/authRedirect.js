export function parseAuthUrl(url) {
  const result = {
    code: null,
    type: null,
    accessToken: null,
    refreshToken: null,
    tokenHash: null,
    error: null,
    errorCode: null,
    errorDescription: null,
  };
  if (!url) return result;
  if (!/^medsafeai:\/\/auth\/callback(?:[?#]|$)/i.test(url)) return result;

  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  const queryPart =
    queryIndex >= 0
      ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
      : '';
  const hashPart = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  const parseParams = (value) => {
    const params = {};
    value.split('&').forEach((pair) => {
      if (!pair) return;
      const [rawKey, ...rawValue] = pair.split('=');
      const decode = (value) => {
        try {
          return decodeURIComponent(value.replace(/\+/g, ' '));
        } catch {
          return value;
        }
      };
      const key = decode(rawKey || '');
      const val = decode(rawValue.join('=') || '');
      if (key) params[key] = val;
    });
    return params;
  };

  const query = parseParams(queryPart);
  const hash = parseParams(hashPart);

  result.code = query.code || hash.code || null;
  result.type = query.type || hash.type || null;
  result.accessToken = hash.access_token || query.access_token || null;
  result.refreshToken = hash.refresh_token || query.refresh_token || null;
  result.tokenHash = query.token_hash || hash.token_hash || null;
  result.error = query.error || hash.error || null;
  result.errorCode = query.error_code || hash.error_code || null;
  result.errorDescription = query.error_description || hash.error_description || null;
  return result;
}
