/** Client-credentials OAuth for API v2; GM-stored id/secret + token cache (~24h). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.auth = (() => {
  const TOKEN_ENDPOINT = 'https://osu.ppy.sh/oauth/token';

  const KEY_CLIENT_ID     = 'oep_client_id';
  const KEY_CLIENT_SECRET = 'oep_client_secret';
  const KEY_ACCESS_TOKEN  = 'oep_access_token';
  const KEY_TOKEN_EXPIRY  = 'oep_token_expiry';   // Unix ms

  // Dedupe concurrent token refresh
  let _fetchPromise = null;

  function getClientId()     { return GM_getValue(KEY_CLIENT_ID, ''); }
  function getClientSecret() { return GM_getValue(KEY_CLIENT_SECRET, ''); }

  function isConfigured() {
    return Boolean(getClientId() && getClientSecret());
  }

  /**
   * Persist new credentials and clear any cached token so the next
   * `getToken()` call fetches a fresh one.
   * @param {string} clientId
   * @param {string} clientSecret
   */
  function setCredentials(clientId, clientSecret) {
    GM_setValue(KEY_CLIENT_ID,     clientId.trim());
    GM_setValue(KEY_CLIENT_SECRET, clientSecret.trim());
    clearCachedToken();
  }

  function clearCredentials() {
    GM_deleteValue(KEY_CLIENT_ID);
    GM_deleteValue(KEY_CLIENT_SECRET);
    clearCachedToken();
  }

  function clearCachedToken() {
    GM_deleteValue(KEY_ACCESS_TOKEN);
    GM_deleteValue(KEY_TOKEN_EXPIRY);
    _fetchPromise = null;
  }

  function getCachedToken() {
    const token  = GM_getValue(KEY_ACCESS_TOKEN, '');
    const expiry = GM_getValue(KEY_TOKEN_EXPIRY, 0);
    // Treat token as expired 60 s before actual expiry for safety margin.
    if (token && Date.now() < expiry - 60_000) return token;
    return null;
  }

  /**
   * Fetch a new access token from osu! using the stored client credentials.
   * @returns {Promise<string>}  The raw access token string.
   */
  async function fetchNewToken() {
    const clientId     = getClientId();
    const clientSecret = getClientSecret();

    if (!clientId || !clientSecret) {
      throw new Error('[osu! Expert+] OAuth credentials not configured.');
    }

    const body = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'client_credentials',
      scope:         'public',
    });

    const resp = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`[osu! Expert+] Token request failed (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    const token    = data.access_token;
    const expiresIn = data.expires_in ?? 86400; // seconds

    GM_setValue(KEY_ACCESS_TOKEN, token);
    GM_setValue(KEY_TOKEN_EXPIRY, Date.now() + expiresIn * 1000);

    return token;
  }

  /**
   * Returns a valid bearer token, fetching a new one if necessary.
   * Returns `null` if credentials are not configured.
   * @returns {Promise<string|null>}
   */
  async function getToken() {
    if (!isConfigured()) return null;

    const cached = getCachedToken();
    if (cached) return cached;

    // Deduplicate concurrent requests.
    if (!_fetchPromise) {
      _fetchPromise = fetchNewToken().finally(() => { _fetchPromise = null; });
    }

    return _fetchPromise;
  }

  /**
   * Returns the Authorization header value, or null if unavailable.
   * Convenience wrapper for use in fetch() calls.
   * @returns {Promise<string|null>}  e.g. 'Bearer eyJ…'
   */
  async function getAuthHeader() {
    const token = await getToken();
    return token ? `Bearer ${token}` : null;
  }

  return {
    isConfigured,
    setCredentials,
    clearCredentials,
    clearCachedToken,
    getToken,
    getAuthHeader,
  };
})();
