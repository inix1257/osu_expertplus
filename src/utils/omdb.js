/** OMDB API client; key in GM storage (omdb.nyahh.net). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.omdb = (() => {
  const KEY_API = 'oep_omdb_api_key';
  const API_BASE = 'https://omdb.nyahh.net';

  /** Shown when /api/set returns non-JSON or not an array (missing mapset, API error page, etc.). */
  const MSG_BEATMAPSET_RESPONSE_UNEXPECTED =
    'This beatmapset may not be on OMDB, or OMDB returned an error.';

  function getApiKey() {
    return String(GM_getValue(KEY_API, '') || '').trim();
  }

  function setApiKey(apiKey) {
    GM_setValue(KEY_API, String(apiKey || '').trim());
  }

  function clearApiKey() {
    GM_deleteValue(KEY_API);
  }

  function isConfigured() {
    return Boolean(getApiKey());
  }

  /**
   * GET /api/set/{beatmapset_id} — per-beatmap rating rows or null if no API key.
   * A difficulty from this set may be omitted from the array when it is blacklisted on OMDB.
   * @param {string|number} beatmapsetId
   * @returns {Promise<object[]|null>}
   */
  async function fetchBeatmapsetRatings(beatmapsetId) {
    const key = getApiKey();
    if (!key) return null;
    const url = `${API_BASE}/api/set/${encodeURIComponent(String(beatmapsetId))}?key=${encodeURIComponent(key)}`;
    const resp = await fetch(url, { credentials: 'omit' });
    const raw = await resp.text().catch(() => '');
    if (!resp.ok) {
      throw new Error(`OMDB HTTP ${resp.status}${raw ? `: ${raw.slice(0, 160)}` : ''}`);
    }
    let data;
    try {
      data = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      throw new Error(MSG_BEATMAPSET_RESPONSE_UNEXPECTED);
    }
    if (!Array.isArray(data)) {
      throw new Error(MSG_BEATMAPSET_RESPONSE_UNEXPECTED);
    }
    return data;
  }

  /**
   * GET /api/rate/{beatmap_id}?key=&score= — score 0.0–5.0 (0.5 steps), or -2 to clear your rating.
   * @param {string|number} beatmapId
   * @param {number} score
   * @returns {Promise<unknown>}
   */
  async function rateBeatmap(beatmapId, score) {
    const key = getApiKey();
    if (!key) throw new Error('OMDB API key not configured');
    const s0 = Number(score);
    if (!Number.isFinite(s0)) throw new Error('Invalid score');
    let s;
    if (s0 === -2) {
      s = -2;
    } else {
      s = Math.round(s0 * 2) / 2;
      if (s < 0 || s > 5) throw new Error('Score must be between 0 and 5');
    }
    const url = `${API_BASE}/api/rate/${encodeURIComponent(String(beatmapId))}?key=${encodeURIComponent(key)}&score=${encodeURIComponent(String(s))}`;
    const resp = await fetch(url, { credentials: 'omit' });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`OMDB HTTP ${resp.status}${t ? `: ${t.slice(0, 160)}` : ''}`);
    }
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  return {
    getApiKey,
    setApiKey,
    clearApiKey,
    isConfigured,
    fetchBeatmapsetRatings,
    rateBeatmap,
  };
})();
