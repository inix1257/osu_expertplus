/** osu! API v2: Bearer when OAuth configured (auth.js), else session cookie. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.api = (() => {
  const BASE = "https://osu.ppy.sh/api/v2";
  /** Public site origin (non-`/api/v2` routes). */
  const SITE_ORIGIN = "https://osu.ppy.sh";

  /**
   * Global limiter for every request Expert+ sends to osu.ppy.sh (API v2 and
   * site JSON routes). osu! rate-limits per user, and the site's own requests
   * share that budget, so all of ours go through one queue instead of each
   * feature bursting independently.
   *
   * On top of pacing (concurrency + start gap), each route family has a rolling
   * one-minute budget:
   * - `/api/v2`: osu-web throttles at 1200 cost units/minute per token (or per
   *   user/IP for session auth), and some routes cost more than 1 (GET /users
   *   costs one unit per id). We use half of that, leaving room for other tabs
   *   and tools sharing the same token.
   * - Site routes (`/users/{id}/scores/…`, `/beatmaps/{id}/scores`, …): osu-web
   *   has no app-level throttle there; limits are enforced in front of it and are
   *   not published, so stay near the API docs' 60 requests/minute guideline.
   *   The site's own requests are not counted here.
   */
  const SITE_MAX_CONCURRENT = 2;
  const SITE_MIN_START_GAP_MS = 250;
  const BUDGET_WINDOW_MS = 60 * 1000;
  const API_BUDGET_PER_WINDOW = 600;
  const WEB_BUDGET_PER_WINDOW = 60;

  /** @type {Record<"api"|"web", { limit: number, log: { t: number, cost: number }[] }>} */
  const _budgets = {
    api: { limit: API_BUDGET_PER_WINDOW, log: [] },
    web: { limit: WEB_BUDGET_PER_WINDOW, log: [] },
  };

  /**
   * Milliseconds until `cost` fits in the bucket's rolling window (0 = now).
   * @param {{ limit: number, log: { t: number, cost: number }[] }} bucket
   */
  function _budgetWaitMs(bucket, cost, now) {
    while (bucket.log.length && now - bucket.log[0].t >= BUDGET_WINDOW_MS) {
      bucket.log.shift();
    }
    let used = bucket.log.reduce((sum, e) => sum + e.cost, 0);
    if (used + cost <= bucket.limit) return 0;
    for (const e of bucket.log) {
      used -= e.cost;
      if (used + cost <= bucket.limit) return e.t + BUDGET_WINDOW_MS - now;
    }
    return 0;
  }

  /** @param {string} url */
  function _requestBucketAndCost(url) {
    const u = new URL(url, SITE_ORIGIN);
    if (!u.pathname.startsWith("/api/")) return { bucket: "web", cost: 1 };
    // Mirrors osu-web's RequestCost for the routes we call.
    if (u.pathname === "/api/v2/users") {
      return {
        bucket: "api",
        cost: Math.max(1, u.searchParams.getAll("ids[]").length),
      };
    }
    return { bucket: "api", cost: 1 };
  }

  let _siteRunning = 0;
  /** @type {number}  Earliest time the next request may start (performance.now()). */
  let _siteNextStartMs = 0;
  let _sitePumpTimer = 0;
  /** @typedef {{ run: () => Promise<Response>, resolve: (r: Response) => void, reject: (e: unknown) => void, signal?: AbortSignal|null, bucket: "api"|"web", cost: number }} SiteQueueItem */
  /** @type {SiteQueueItem[]}  User-visible data (score lists, leaderboards, lookups). */
  const _siteQueueHigh = [];
  /** @type {SiteQueueItem[]}  Background enrichment (beatmap attributes, max combo). */
  const _siteQueueLow = [];

  function _abortError() {
    return new DOMException("The operation was aborted.", "AbortError");
  }

  /**
   * Take the first queued item (high priority first) whose bucket has budget.
   * @returns {{ item: SiteQueueItem|null, waitMs: number }}
   */
  function _nextSiteItem(now) {
    let waitMs = Infinity;
    for (const q of [_siteQueueHigh, _siteQueueLow]) {
      for (let i = 0; i < q.length; i++) {
        const item = q[i];
        if (item.signal?.aborted) {
          q.splice(i--, 1);
          item.reject(_abortError());
          continue;
        }
        const wait = _budgetWaitMs(_budgets[item.bucket], item.cost, now);
        if (wait === 0) {
          q.splice(i, 1);
          return { item, waitMs: 0 };
        }
        waitMs = Math.min(waitMs, wait);
      }
    }
    return { item: null, waitMs };
  }

  function _schedulePump(delayMs) {
    if (_sitePumpTimer) return;
    _sitePumpTimer = setTimeout(() => {
      _sitePumpTimer = 0;
      _pumpSiteQueue();
    }, Math.ceil(delayMs));
  }

  function _pumpSiteQueue() {
    while (_siteRunning < SITE_MAX_CONCURRENT) {
      if (!_siteQueueHigh.length && !_siteQueueLow.length) return;
      const now = performance.now();
      if (now < _siteNextStartMs) {
        _schedulePump(_siteNextStartMs - now);
        return;
      }
      const { item, waitMs } = _nextSiteItem(now);
      if (!item) {
        if (Number.isFinite(waitMs)) _schedulePump(waitMs);
        return;
      }
      _budgets[item.bucket].log.push({ t: now, cost: item.cost });
      _siteNextStartMs = now + SITE_MIN_START_GAP_MS;
      _siteRunning++;
      Promise.resolve()
        .then(() => item.run())
        .then(item.resolve, item.reject)
        .finally(() => {
          _siteRunning--;
          _pumpSiteQueue();
        });
    }
  }

  /**
   * `fetch` for osu.ppy.sh routes, scheduled through the global limiter.
   * @param {string} url
   * @param {RequestInit} [init]
   * @param {{ priority?: "high"|"low" }} [options]
   * @returns {Promise<Response>}
   */
  function siteFetch(url, init = {}, options = {}) {
    const signal = init.signal || null;
    if (signal?.aborted) return Promise.reject(_abortError());
    const { bucket, cost } = _requestBucketAndCost(url);
    return new Promise((resolve, reject) => {
      const queue = options.priority === "low" ? _siteQueueLow : _siteQueueHigh;
      queue.push({
        run: () => fetch(url, { credentials: "include", ...init }),
        resolve,
        reject,
        signal,
        bucket,
        cost,
      });
      _pumpSiteQueue();
    });
  }

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
   * @param {{ sessionOnly?: boolean, priority?: "high"|"low" }} [options={}]
   *        When `sessionOnly` is true, skips the OAuth Bearer header so the
   *        browser session cookie is used (needed for `/friends` with
   *        `friends.read`, which client-credentials tokens do not have).
   *        `priority` selects the limiter queue (see `siteFetch`).
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

    const resp = await siteFetch(
      fullUrl,
      { headers },
      { priority: options.priority },
    );

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

  /**
   * Fetch a single beatmap by id.
   * @param {{ priority?: "high"|"low" }} [options]
   */
  function getBeatmap(beatmapId, options = {}) {
    return get(`${BASE}/beatmaps/${beatmapId}`, {}, options);
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
   * @param {{ signal?: AbortSignal }} [options]  Aborting drops the request if it is still queued.
   * @returns {Promise<{ scores: object[] }>}
   */
  async function getBeatmapScoresWebsite(beatmapId, query, options = {}) {
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

    const resp = await siteFetch(fullUrl, { headers, signal: options.signal });
    if (!resp.ok) {
      throw new Error(`[osu! Expert+] ${resp.status}: ${fullUrl}`);
    }
    const data = await resp.json();
    const scores = Array.isArray(data)
      ? data
      : (data?.scores ?? data?.data?.scores ?? []);
    return { scores };
  }

  /**
   * Batch-fetch users by id ([Get Users](https://osu.ppy.sh/docs/#get-users)); each result
   * includes `statistics_rulesets.{osu,taiko,fruits,mania}.global_rank`. The endpoint caps
   * out at 50 ids per request, so larger lists are split into batches (paced by `siteFetch`).
   */
  const USERS_BATCH_SIZE = 50;

  /**
   * GET /users?ids[]=… — up to 50 users per request, batched automatically
   * for larger id lists.
   * @param {(string|number)[]|string|number} ids
   * @returns {Promise<object[]>}
   */
  function getUsers(ids) {
    const unique = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [ids])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    if (!unique.length) return Promise.resolve([]);

    const batches = [];
    for (let i = 0; i < unique.length; i += USERS_BATCH_SIZE) {
      batches.push(unique.slice(i, i + USERS_BATCH_SIZE));
    }

    // Response is `{ users: [...] }`, not a bare array.
    const fetchBatch = (batchIds) =>
      get(`${BASE}/users`, { "ids[]": batchIds }).then((data) =>
        Array.isArray(data?.users) ? data.users : [],
      );

    return Promise.all(batches.map(fetchBatch)).then((results) =>
      results.flat(),
    );
  }

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

  /**
   * POST /beatmaps/{beatmap}/attributes — returns difficulty attributes with
   * the given mods applied, including the modded star_rating. Background
   * enrichment, so it is queued behind user-visible requests in `siteFetch`.
   *
   * @param {string|number} beatmapId
   * @param {string[]}      mods     Array of mod acronyms, e.g. ['DT', 'HR']
   * @param {string}        ruleset  'osu' | 'taiko' | 'fruits' | 'mania'
   * @returns {Promise<{attributes: {star_rating: number, max_combo: number, ...}}>}
   */
  async function postBeatmapAttributes(beatmapId, mods, ruleset = "osu") {
    const url = `${BASE}/beatmaps/${beatmapId}/attributes`;
    const headers = await buildHeaders();
    headers["Content-Type"] = "application/json";

    const resp = await siteFetch(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ mods, ruleset }),
      },
      { priority: "low" },
    );

    if (!resp.ok) {
      throw new Error(
        `[osu! Expert+] API ${resp.status}: beatmap attributes ${beatmapId}`,
      );
    }
    return resp.json();
  }

  return {
    siteFetch,
    get,
    getFriends,
    getBeatmapsetDiscussions,
    getBeatmapsetDiscussionPosts,
    getBeatmapset,
    getBeatmap,
    getUser,
    getUsers,
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
