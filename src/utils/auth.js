/** Client-credentials OAuth for API v2; GM-stored id/secret + token cache (~24h). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.auth = (() => {
  const TOKEN_ENDPOINT = "https://osu.ppy.sh/oauth/token";

  const KEY_CLIENT_ID = "oep_client_id";
  const KEY_CLIENT_SECRET = "oep_client_secret";
  const KEY_ACCESS_TOKEN = "oep_access_token";
  const KEY_TOKEN_EXPIRY = "oep_token_expiry"; // Unix ms

  // Dedupe concurrent token refresh
  /** @type {Promise<string>|null} */
  let _fetchPromise = null;
  /**
   * Bumped whenever credentials or the cached token are cleared, so a token
   * request that started before that is not stored afterwards (B34).
   */
  let _generation = 0;
  /** Failed token requests are not retried for this long. */
  const FAILURE_TTL_MS = 5 * 60 * 1000;
  /** @type {{ error: Error, until: number, generation: number } | null} */
  let _failure = null;

  function getClientId() {
    return GM_getValue(KEY_CLIENT_ID, "");
  }
  function getClientSecret() {
    return GM_getValue(KEY_CLIENT_SECRET, "");
  }

  function isConfigured() {
    return Boolean(getClientId() && getClientSecret());
  }

  /** Whether a client secret is saved (the value itself stays in auth). */
  function hasSecret() {
    return Boolean(getClientSecret());
  }

  /** @returns {Error|null} the cached token failure, while it is current. */
  function currentFailure() {
    if (!_failure) return null;
    if (_failure.generation !== _generation || Date.now() >= _failure.until) {
      _failure = null;
      return null;
    }
    return _failure.error;
  }

  /**
   * `"unset"`: no credentials; `"error"`: the last token request failed
   * (within the last few minutes); `"ok"`: configured and not known to fail.
   * @returns {"unset"|"ok"|"error"}
   */
  function getStatus() {
    if (!isConfigured()) return "unset";
    return currentFailure() ? "error" : "ok";
  }

  /**
   * Persist new credentials and clear any cached token so the next
   * `getToken()` call fetches a fresh one.
   * @param {string} clientId
   * @param {string} clientSecret
   */
  function setCredentials(clientId, clientSecret) {
    GM_setValue(KEY_CLIENT_ID, clientId.trim());
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
    _failure = null;
    _generation++;
  }

  function getCachedToken() {
    const token = GM_getValue(KEY_ACCESS_TOKEN, "");
    const expiry = GM_getValue(KEY_TOKEN_EXPIRY, 0);
    // Treat token as expired 60 s before actual expiry for safety margin.
    if (token && Date.now() < expiry - 60_000) return token;
    return null;
  }

  /**
   * Request a client-credentials token for the given credentials. Stores
   * nothing.
   * @param {string} clientId
   * @param {string} clientSecret
   * @returns {Promise<{ token: string, expiresAt: number }>}
   */
  async function requestToken(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error("[osu! Expert+] OAuth credentials not configured.");
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "public",
    });

    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        `[osu! Expert+] Token request failed (${resp.status}): ${text}`,
      );
    }

    const data = await resp.json();
    const token = data.access_token;
    const expiresIn = data.expires_in ?? 86400; // seconds
    if (!token) {
      throw new Error("[osu! Expert+] Token response had no access_token.");
    }
    return { token, expiresAt: Date.now() + expiresIn * 1000 };
  }

  /** @param {{ token: string, expiresAt: number }} t */
  function storeToken(t) {
    GM_setValue(KEY_ACCESS_TOKEN, t.token);
    GM_setValue(KEY_TOKEN_EXPIRY, t.expiresAt);
  }

  /**
   * Fetch a new access token from osu! using the stored client credentials.
   * The result is stored only if nothing was cleared meanwhile (B34); a
   * failure is cached for FAILURE_TTL_MS.
   * @returns {Promise<string>}  The raw access token string.
   */
  async function fetchNewToken() {
    const generation = _generation;
    try {
      const t = await requestToken(getClientId(), getClientSecret());
      if (generation !== _generation) {
        // Credentials changed while this request ran: use the new ones.
        return getToken();
      }
      storeToken(t);
      return t.token;
    } catch (err) {
      if (generation === _generation) {
        _failure = {
          error: err instanceof Error ? err : new Error(String(err)),
          until: Date.now() + FAILURE_TTL_MS,
          generation,
        };
      }
      throw err;
    }
  }

  /**
   * Verify credentials by requesting a token, and save them (with the token)
   * only when that succeeds (B33). An empty secret means "keep the saved
   * secret".
   * @param {string} clientId
   * @param {string} clientSecret
   * @returns {Promise<void>}  rejects with the token error; nothing is saved
   */
  async function verifyAndSaveCredentials(clientId, clientSecret) {
    const id = String(clientId || "").trim();
    const secret = String(clientSecret || "").trim() || getClientSecret();
    const t = await requestToken(id, secret);
    GM_setValue(KEY_CLIENT_ID, id);
    GM_setValue(KEY_CLIENT_SECRET, secret);
    clearCachedToken();
    storeToken(t);
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

    const failed = currentFailure();
    if (failed) throw failed;

    // Deduplicate concurrent requests.
    if (!_fetchPromise) {
      const p = fetchNewToken().finally(() => {
        // A clear (or a newer request) may have replaced it meanwhile.
        if (_fetchPromise === p) _fetchPromise = null;
      });
      _fetchPromise = p;
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
    hasSecret,
    getClientId,
    getStatus,
    verifyAndSaveCredentials,
    setCredentials,
    clearCredentials,
    clearCachedToken,
    getToken,
    getAuthHeader,
  };
})();
