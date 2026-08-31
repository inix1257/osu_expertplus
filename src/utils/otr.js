/** osu! Tournament Rating API client; bearer key in GM storage. */
/* global GM_deleteValue, GM_getValue, GM_setValue, GM_xmlhttpRequest */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.otr = (() => {
  const KEY_API = "oep_otr_api_key";
  const API_BASE = "https://otr.stagec.net/api";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const playerStatsCache = new Map();

  function getApiKey() {
    return String(GM_getValue(KEY_API, "") || "").trim();
  }

  function setApiKey(value) {
    GM_setValue(KEY_API, String(value || "").trim());
    playerStatsCache.clear();
  }

  function clearApiKey() {
    GM_deleteValue(KEY_API);
    playerStatsCache.clear();
  }

  function isConfigured() {
    return getApiKey().length > 0;
  }

  function request(method, path, body = null) {
    const key = getApiKey();
    if (!key) {
      return Promise.reject(
        new Error("[osu! Expert+] OTR API key is not configured."),
      );
    }

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: `${API_BASE}${path}`,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
          ...(body == null ? {} : { "Content-Type": "application/json" }),
        },
        data: body == null ? undefined : JSON.stringify(body),
        timeout: 15000,
        onload: (response) => {
          let json = null;
          try {
            json = response.responseText
              ? JSON.parse(response.responseText)
              : null;
          } catch (_) {}

          if (response.status < 200 || response.status >= 300) {
            const message =
              json?.error || json?.message || `HTTP ${response.status}`;
            reject(new Error(`[osu! Expert+] OTR API: ${message}`));
            return;
          }
          resolve(json);
        },
        ontimeout: () =>
          reject(new Error("[osu! Expert+] OTR API request timed out.")),
        onerror: () =>
          reject(new Error("[osu! Expert+] OTR API request failed.")),
      });
    });
  }

  async function fetchPlayerStats(osuId) {
    const id = Number(osuId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("[osu! Expert+] Invalid osu! user ID for OTR.");
    }

    const cacheKey = String(id);
    const cached = playerStatsCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return cached.value;
    }

    const json = await request(
      "GET",
      `/players/${encodeURIComponent(
        String(id),
      )}/stats?keyType=osu&ruleset=0`,
    );
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new Error("[osu! Expert+] Unexpected OTR player stats response.");
    }

    playerStatsCache.set(cacheKey, { time: Date.now(), value: json });
    return json;
  }

  function verifyApiKey() {
    return request("GET", "/stats/platform");
  }

  return {
    getApiKey,
    setApiKey,
    clearApiKey,
    isConfigured,
    fetchPlayerStats,
    verifyApiKey,
  };
})();
