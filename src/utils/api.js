/** osu! API v2: Bearer when OAuth configured (auth.js), else session cookie. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.api = (() => {
  const BASE = 'https://osu.ppy.sh/api/v2';

  /**
   * Build fetch headers, injecting a Bearer token when available.
   * @returns {Promise<HeadersInit>}
   */
  async function buildHeaders() {
    const headers = { Accept: 'application/json' };
    const authHeader = await OsuExpertPlus.auth.getAuthHeader().catch(() => null);
    if (authHeader) headers['Authorization'] = authHeader;
    return headers;
  }

  /**
   * GET a JSON resource from the osu! API v2.
   * Automatically attaches the Bearer token when credentials are configured.
   * @param {string} url
   * @param {Object} [params={}]  Query-string parameters.
   * @param {{ sessionOnly?: boolean }} [options={}]
   *        When `sessionOnly` is true, skips the OAuth Bearer header so the
   *        browser session cookie is used (needed for `/friends` with
   *        `friends.read`, which client-credentials tokens do not have).
   * @returns {Promise<any>}
   */
  async function get(url, params = {}, options = {}) {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) usp.append(key, String(v));
      } else {
        usp.append(key, String(value));
      }
    }
    const qs = usp.toString();
    const fullUrl = qs ? `${url}?${qs}` : url;
    const headers = { Accept: 'application/json' };
    if (!options.sessionOnly) {
      const authHeader = await OsuExpertPlus.auth.getAuthHeader().catch(() => null);
      if (authHeader) headers['Authorization'] = authHeader;
    }

    const resp = await fetch(fullUrl, { headers, credentials: 'include' });

    if (!resp.ok) {
      throw new Error(`[osu! Expert+] API ${resp.status}: ${fullUrl}`);
    }
    return resp.json();
  }

  /**
   * Friend list for the logged-in user (session cookie). Requires being signed
   * in on osu.ppy.sh. Does not use client-credentials Bearer (see `sessionOnly`).
   * @returns {Promise<any[]>}
   */
  function getFriends() {
    return get(`${BASE}/friends`, {}, { sessionOnly: true });
  }

  /** @param {Record<string, string|number|boolean|Array>} [params] */
  function getBeatmapsetDiscussions(params) {
    return get(`${BASE}/beatmapsets/discussions`, params);
  }

  /** @param {Record<string, string|number|boolean|Array>} [params] */
  function getBeatmapsetDiscussionPosts(params) {
    return get(`${BASE}/beatmapsets/discussions/posts`, params);
  }

  /**
   * Fetch beatmapset metadata by id.
   * @param {string|number} id
   * @param {Record<string, string|number|boolean|Array>} [params]  e.g. `{ include: ['recent_favourites'] }`
   */
  function getBeatmapset(id, params = {}) {
    return get(`${BASE}/beatmapsets/${id}`, params);
  }

  /** Fetch user profile by id or username. */
  function getUser(idOrName, mode) {
    return get(`${BASE}/users/${idOrName}`, mode ? { mode } : {});
  }

  /** Search beatmapsets. */
  function searchBeatmapsets(query = {}) {
    return get(`${BASE}/beatmapsets/search`, query);
  }

  /**
   * Fetch a user's best scores.
   * @param {string|number} userId
   * @param {string} mode  e.g. 'osu'
   * @param {number} [limit=100]
   * @param {number} [offset=0]
   */
  function getUserBestScores(userId, mode, limit = 100, offset = 0) {
    return get(`${BASE}/users/${userId}/scores/best`, { mode, limit, offset });
  }

  /**
   * Fetch a user's recent scores (optionally including fails).
   * @param {string|number} userId
   * @param {string} mode  e.g. 'osu'
   * @param {number} [limit=100]
   * @param {number|string} [offset=0]
   * @param {boolean} [includeFails=true]
   */
  function getUserRecentScores(
    userId,
    mode,
    limit = 100,
    offset = 0,
    includeFails = true,
  ) {
    return get(`${BASE}/users/${userId}/scores/recent`, {
      mode,
      limit,
      offset: String(offset),
      include_fails: includeFails ? 1 : 0,
      include: ["beatmap", "beatmapset"],
    });
  }

  /**
   * POST /beatmaps/{beatmap}/attributes — returns difficulty attributes with
   * the given mods applied, including the modded star_rating.
   *
   * @param {string|number} beatmapId
   * @param {string[]}      mods     Array of mod acronyms, e.g. ['DT', 'HR']
   * @param {string}        ruleset  'osu' | 'taiko' | 'fruits' | 'mania'
   * @returns {Promise<{attributes: {star_rating: number, max_combo: number, ...}}>}
   */
  async function postBeatmapAttributes(beatmapId, mods, ruleset = 'osu') {
    const url = `${BASE}/beatmaps/${beatmapId}/attributes`;
    const headers = await buildHeaders();
    headers['Content-Type'] = 'application/json';

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ mods, ruleset }),
    });

    if (!resp.ok) {
      throw new Error(`[osu! Expert+] API ${resp.status}: beatmap attributes ${beatmapId}`);
    }
    return resp.json();
  }

  return {
    get,
    getFriends,
    getBeatmapsetDiscussions,
    getBeatmapsetDiscussionPosts,
    getBeatmapset,
    getUser,
    searchBeatmapsets,
    getUserBestScores,
    getUserRecentScores,
    postBeatmapAttributes,
  };
})();
