/** osu! API v2: Bearer when OAuth configured (auth.js), else session cookie. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.api = (() => {
  const BASE = "https://osu.ppy.sh/api/v2";
  /** Public site origin (non-`/api/v2` routes). */
  const SITE_ORIGIN = "https://osu.ppy.sh";

  /**
   * Build fetch headers, injecting a Bearer token when available.
   * @returns {Promise<HeadersInit>}
   */
  async function buildHeaders() {
    const headers = { Accept: "application/json" };
    const authHeader = await OsuExpertPlus.auth
      .getAuthHeader()
      .catch(() => null);
    if (authHeader) headers["Authorization"] = authHeader;
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
    const headers = { Accept: "application/json" };
    if (!options.sessionOnly) {
      const authHeader = await OsuExpertPlus.auth
        .getAuthHeader()
        .catch(() => null);
      if (authHeader) headers["Authorization"] = authHeader;
    }

    const resp = await fetch(fullUrl, { headers, credentials: "include" });

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

  /** Fetch a single beatmap by id. */
  function getBeatmap(beatmapId) {
    return get(`${BASE}/beatmaps/${beatmapId}`);
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
   * GET /beatmaps/{beatmap}/scores/users/{user} — a user's score on a beatmap
   * ([Get a User Beatmap score](https://osu.ppy.sh/docs/#get-a-user-beatmap-score)).
   * Response shape: BeatmapUserScore — `{ position, score }`.
   *
   * @param {string|number} beatmapId
   * @param {string|number} userId
   * @param {string|{ mode?: string, legacy_only?: number, mods?: string[] }} [modeOrQuery]
   *        Ruleset string (e.g. `'osu'`), or query params matching the docs.
   */
  function getBeatmapUserScore(beatmapId, userId, modeOrQuery) {
    /** @type {Record<string, string|number|string[]>} */
    const params = {};
    if (typeof modeOrQuery === "string") {
      if (modeOrQuery) params.mode = modeOrQuery;
    } else if (modeOrQuery && typeof modeOrQuery === "object") {
      if (modeOrQuery.mode) params.mode = modeOrQuery.mode;
      if (modeOrQuery.legacy_only != null) {
        params.legacy_only = modeOrQuery.legacy_only;
      }
      if (Array.isArray(modeOrQuery.mods) && modeOrQuery.mods.length) {
        params.mods = modeOrQuery.mods;
      }
    }
    return get(`${BASE}/beatmaps/${beatmapId}/scores/users/${userId}`, params);
  }

  /**
   * GET /beatmaps/{beatmap}/scores/users/{user}/all — all of a user’s scores on
   * a beatmap ([Get a User Beatmap scores](https://osu.ppy.sh/docs/#get-a-user-beatmap-scores)).
   * Response: `{ scores: Score[] }`.
   *
   * @param {string|number} beatmapId
   * @param {string|number} userId
   * @param {{ ruleset?: string, mode?: string, legacy_only?: number }} [query]
   */
  function getBeatmapUserScoresAll(beatmapId, userId, query) {
    /** @type {Record<string, string|number>} */
    const params = {};
    if (query && typeof query === "object") {
      if (query.ruleset) params.ruleset = query.ruleset;
      if (query.mode) params.mode = query.mode;
      if (query.legacy_only != null) params.legacy_only = query.legacy_only;
    }
    return get(
      `${BASE}/beatmaps/${beatmapId}/scores/users/${userId}/all`,
      params,
    );
  }

  /**
   * GET /beatmaps/{beatmap}/scores — top scores for a beatmap.
   * @param {string|number} beatmapId
   * @param {{ mode?: string, mods?: string[], legacy_only?: number, type?: "global"|"country"|"friend"|"team", limit?: number }} [query]
   *        `type` matches osu-web scoreboard tabs; `country` uses the logged-in
   *        user’s country (same as the site). Requires `credentials: "include"`.
   * @returns {Promise<{ scores: object[] }>}
   */
  function getBeatmapScores(beatmapId, query) {
    /** @type {Record<string, string|number|string[]>} */
    const params = {};
    if (query && typeof query === "object") {
      if (query.mode) params.mode = query.mode;
      if (query.legacy_only != null) params.legacy_only = query.legacy_only;
      if (query.type) params.type = query.type;
      if (query.limit != null) params.limit = query.limit;
      if (Array.isArray(query.mods) && query.mods.length) {
        params["mods[]"] = query.mods;
      }
    }
    return get(`${BASE}/beatmaps/${beatmapId}/scores`, params);
  }

  /**
   * GET https://osu.ppy.sh/beatmaps/{beatmap}/scores — site scoreboard JSON (same
   * path the webpage uses), not `/api/v2`. Richer / leaderboard-aligned payload
   * than the API route for some scores. `{beatmap}` is the difficulty id.
   * @param {string|number} beatmapId
   * @param {{ mode?: string, mods?: string[], legacy_only?: number, type?: "global"|"country"|"friend"|"team", limit?: number }} [query]
   *        `type` matches osu-web scoreboard tabs; `country` uses the logged-in
   *        user’s country (same as the site). Requires `credentials: "include"`.
   * @returns {Promise<{ scores: object[] }>}
   */
  async function getBeatmapScoresWebsite(beatmapId, query) {
    /** @type {Record<string, string|number|string[]>} */
    const params = {};
    if (query && typeof query === "object") {
      if (query.mode) params.mode = query.mode;
      if (query.legacy_only != null) params.legacy_only = query.legacy_only;
      if (query.type) params.type = query.type;
      if (query.limit != null) params.limit = query.limit;
      if (Array.isArray(query.mods) && query.mods.length) {
        params["mods[]"] = query.mods;
      }
    }
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
    const fullUrl = `${SITE_ORIGIN}/beatmaps/${beatmapId}/scores${qs ? `?${qs}` : ""}`;

    const headers = { Accept: "application/json" };
    const authHeader = await OsuExpertPlus.auth
      .getAuthHeader()
      .catch(() => null);
    if (authHeader) headers["Authorization"] = authHeader;

    const resp = await fetch(fullUrl, { headers, credentials: "include" });
    if (!resp.ok) {
      throw new Error(`[osu! Expert+] ${resp.status}: ${fullUrl}`);
    }
    const data = await resp.json();
    const scores = Array.isArray(data)
      ? data
      : (data?.scores ?? data?.data?.scores ?? []);
    return { scores };
  }

  /** Throttle concurrent beatmap attributes calls (profile SR badges, etc.). */
  const BEATMAP_ATTRS_MAX_CONCURRENT = 2;
  const BEATMAP_ATTRS_MIN_START_GAP_MS = 120;

  let _beatmapAttrsRunning = 0;
  /** @type {number}  Earliest time the next request may start (performance.now()). */
  let _beatmapAttrsNextStartMs = 0;
  /** @type {{ run: () => Promise<unknown>, resolve: (v: unknown) => void, reject: (e: unknown) => void }[]} */
  const _beatmapAttrsQueue = [];

  function _pumpBeatmapAttributesQueue() {
    while (_beatmapAttrsRunning < BEATMAP_ATTRS_MAX_CONCURRENT) {
      if (!_beatmapAttrsQueue.length) return;
      const now = performance.now();
      if (now < _beatmapAttrsNextStartMs) {
        setTimeout(
          _pumpBeatmapAttributesQueue,
          Math.ceil(_beatmapAttrsNextStartMs - now),
        );
        return;
      }
      _beatmapAttrsNextStartMs = now + BEATMAP_ATTRS_MIN_START_GAP_MS;
      const item = _beatmapAttrsQueue.shift();
      if (!item) return;
      _beatmapAttrsRunning++;
      Promise.resolve()
        .then(() => item.run())
        .then(item.resolve, item.reject)
        .finally(() => {
          _beatmapAttrsRunning--;
          _pumpBeatmapAttributesQueue();
        });
    }
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
  const KIRINO_INSPECTOR_PROFILE =
    "https://api.kirino.sh/inspector/extension/profile";

  const KIRINO_MODE_INDEX = {
    osu: 0,
    taiko: 1,
    fruits: 2,
    mania: 3,
  };

  /**
   * Kirino score-inspector profile payload (country rank, ranked-score rank, etc.).
   * POST body matches the osu! web extension: `{ user_id, mode, username }`.
   * @param {string} userId
   * @param {number} modeIndex  0 osu, 1 taiko, 2 fruits, 3 mania
   * @param {string} [username]
   * @returns {Promise<any>}
   */
  function fetchKirinoInspectorProfile(userId, modeIndex, username = "") {
    const body = {
      user_id: String(userId),
      mode: modeIndex,
      username: String(username || ""),
    };
    return fetch(KIRINO_INSPECTOR_PROFILE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).then((resp) => {
      if (!resp.ok) {
        throw new Error(
          `[osu! Expert+] Kirino inspector ${resp.status}: ${KIRINO_INSPECTOR_PROFILE}`,
        );
      }
      return resp.json();
    });
  }

  /** @param {string} ruleset  osu | taiko | fruits | mania */
  function kirinoModeIndexForRuleset(ruleset) {
    const n = KIRINO_MODE_INDEX[ruleset];
    return typeof n === "number" ? n : 0;
  }

  function postBeatmapAttributes(beatmapId, mods, ruleset = "osu") {
    return new Promise((resolve, reject) => {
      _beatmapAttrsQueue.push({
        run: async () => {
          const url = `${BASE}/beatmaps/${beatmapId}/attributes`;
          const headers = await buildHeaders();
          headers["Content-Type"] = "application/json";

          const resp = await fetch(url, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ mods, ruleset }),
          });

          if (!resp.ok) {
            throw new Error(
              `[osu! Expert+] API ${resp.status}: beatmap attributes ${beatmapId}`,
            );
          }
          return resp.json();
        },
        resolve,
        reject,
      });
      _pumpBeatmapAttributesQueue();
    });
  }

  return {
    get,
    getFriends,
    getBeatmapsetDiscussions,
    getBeatmapsetDiscussionPosts,
    getBeatmapset,
    getBeatmap,
    getUser,
    searchBeatmapsets,
    getUserBestScores,
    getUserRecentScores,
    getBeatmapUserScore,
    getBeatmapUserScoresAll,
    getBeatmapScores,
    getBeatmapScoresWebsite,
    postBeatmapAttributes,
    fetchKirinoInspectorProfile,
    kirinoModeIndexForRuleset,
  };
})();
