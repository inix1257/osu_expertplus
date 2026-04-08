// ==UserScript==
// @name         osu! Expert+
// @namespace    https://github.com/inix1257/osu_expertplus
// @version      0.2.16
// @description  Adds extra QoL features to osu.ppy.sh
// @author       inix1257
// @homepageURL  https://github.com/inix1257/osu_expertplus
// @supportURL   https://github.com/inix1257/osu_expertplus/issues
// @downloadURL  https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js
// @updateURL    https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js
// @match        https://osu.ppy.sh/*
// @connect      omdb.nyahh.net
// @connect      assets.ppy.sh
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

'use strict';


/* ── src/utils/dom.js ── */
/** DOM helpers: qs/qsa/el, wait*, manageStyle, createCleanupBag */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.dom = (() => {
  /**
   * Shorthand for document.querySelector.
   * @param {string} selector
   * @param {Element} [root=document]
   */
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  /**
   * Shorthand for document.querySelectorAll (returns an Array).
   * @param {string} selector
   * @param {Element} [root=document]
   */
  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  /**
   * Create an element with optional attributes and children.
   * @param {string} tag
   * @param {Object} [attrs={}]
   * @param {...(string|Element)} children
   */
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "class") {
        element.className = value;
      } else if (key.startsWith("on") && typeof value === "function") {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (
        key === "style" &&
        value != null &&
        typeof value === "object"
      ) {
        Object.assign(element.style, /** @type {object} */ (value));
      } else {
        element.setAttribute(key, value);
      }
    }
    for (const child of children) {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Element) {
        element.appendChild(child);
      }
    }
    return element;
  }

  /** Wait for selector match to disconnect (SPA teardown); no-op if absent. Use before waitForElement on re-nav. */
  function waitForStaleElementToLeave(
    selector,
    timeout = 8000,
    root = document.documentElement,
  ) {
    return new Promise((resolve) => {
      const stale = root.querySelector(selector);
      if (!stale || !stale.isConnected) {
        return resolve();
      }

      const observer = new MutationObserver(() => {
        if (!stale.isConnected) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(root, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  /**
   * Wait for an element matching `selector` to appear in the DOM.
   * Resolves with the element or rejects after `timeout` ms.
   * @param {string} selector
   * @param {number} [timeout=10000]
   * @param {Element} [root=document.body]
   * @returns {Promise<Element>}
   */
  function waitForElement(
    selector,
    timeout = 10000,
    root = document.documentElement,
  ) {
    return new Promise((resolve, reject) => {
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(root, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            `waitForElement: "${selector}" not found within ${timeout}ms`,
          ),
        );
      }, timeout);
    });
  }

  /**
   * Manages a <style> element lifecycle.  inject() is idempotent.
   * @param {string} id   Unique element id for deduplication.
   * @param {string} css  Stylesheet text content.
   * @returns {{ inject: () => void, remove: () => void }}
   */
  function manageStyle(id, css) {
    const inject = () => {
      if (document.getElementById(id)) return;
      const s = document.createElement("style");
      s.id = id;
      s.textContent = css;
      document.head.appendChild(s);
    };
    const remove = () => document.getElementById(id)?.remove();
    return { inject, remove };
  }

  /**
   * Collects cleanup / unsubscribe functions and disposes them all at once.
   * Each function is called inside try/catch so one failure never blocks
   * the rest.  Functions execute in reverse-registration (LIFO) order.
   * @returns {{ add: (...fns: Function[]) => void, dispose: () => void }}
   */
  function createCleanupBag() {
    const fns = [];
    return {
      add(...args) {
        fns.push(...args);
      },
      dispose() {
        while (fns.length) {
          try {
            fns.pop()();
          } catch (_) {}
        }
      },
    };
  }

  /**
   * Parse a locale-formatted number string (handles period or comma as
   * decimal separator and spaces/commas/periods as group separators).
   * @param {string} str
   * @returns {number}
   */
  function parseLocaleNumber(str) {
    if (!str) return NaN;
    let s = String(str).trim();
    // Strip whitespace-like thousand separators (thin/non-breaking/regular space)
    s = s.replace(/[\s\u00A0\u202F\u2009]/g, "");
    // Whichever of comma/period appears LAST is the decimal separator
    const lastComma = s.lastIndexOf(",");
    const lastPeriod = s.lastIndexOf(".");
    if (lastComma > lastPeriod) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    return parseFloat(s);
  }

  /**
   * Format a number with exactly 2 decimal places using the osu-web page
   * locale (thousand grouping + locale-appropriate decimal separator).
   * @param {number} n
   * @returns {string}
   */
  function formatDecimalPp(n) {
    const locale =
      typeof window.currentLocale === "string"
        ? window.currentLocale
        : document.documentElement.lang || undefined;
    try {
      return n.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return n.toFixed(2);
    }
  }

  return {
    qs,
    qsa,
    el,
    waitForElement,
    waitForStaleElementToLeave,
    manageStyle,
    createCleanupBag,
    parseLocaleNumber,
    formatDecimalPp,
  };
})();

/* ── src/utils/difficulty-colours.js ── */
/**
 * Star difficulty background / text colours — aligned with osu-web
 * `getDiffColour` / `getDiffTextColour` (resources/js/utils/beatmap-helper.ts).
 * Background ramp matches; text ramp above SR 9 is lightened (osu uses black bg there).
 */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.difficultyColours = (() => {
  const DIFF_DOMAIN = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
  const DIFF_RANGE = [
    "#4290FB",
    "#4FC0FF",
    "#4FFFD5",
    "#7CFF4F",
    "#F6F05C",
    "#FF8068",
    "#FF4E6F",
    "#C645B8",
    "#6563DE",
    "#18158E",
    "#000000",
  ];
  const TEXT_SR_DOMAIN = [9, 9.9, 10.6, 11.5, 12.4];
  const TEXT_SR_RANGE = [
    "#F6F05C",
    "#FF8068",
    "#FF4E6F",
    "#C645B8",
    "#B0A8FF",
    "#E4E2FF",
  ];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
    return `#${[clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  /** @param {number} sr */
  function getDiffColour(sr) {
    if (sr < 0.1) return "#AAAAAA";
    if (sr >= 9) return "#000000";
    for (let i = 0; i < DIFF_DOMAIN.length - 1; i++) {
      const d0 = DIFF_DOMAIN[i];
      const d1 = DIFF_DOMAIN[i + 1];
      if (sr >= d0 && sr < d1) {
        const t = (sr - d0) / (d1 - d0);
        const a = hexToRgb(DIFF_RANGE[i]);
        const b = hexToRgb(DIFF_RANGE[i + 1]);
        return rgbToHex(
          a.r + (b.r - a.r) * t,
          a.g + (b.g - a.g) * t,
          a.b + (b.b - a.b) * t,
        );
      }
    }
    return "#000000";
  }

  /** @param {number} sr */
  function getDiffTextColour(sr) {
    if (sr < 6.5) return "#000000";
    if (sr < 9) return "#F6F05C";
    if (sr >= 12.4) return "#E4E2FF";
    for (let i = 0; i < TEXT_SR_DOMAIN.length - 1; i++) {
      const d0 = TEXT_SR_DOMAIN[i];
      const d1 = TEXT_SR_DOMAIN[i + 1];
      if (sr >= d0 && sr < d1) {
        const t = (sr - d0) / (d1 - d0);
        const a = hexToRgb(TEXT_SR_RANGE[i]);
        const b = hexToRgb(TEXT_SR_RANGE[i + 1]);
        return rgbToHex(
          a.r + (b.r - a.r) * t,
          a.g + (b.g - a.g) * t,
          a.b + (b.b - a.b) * t,
        );
      }
    }
    return "#E4E2FF";
  }

  return { getDiffColour, getDiffTextColour };
})();

/* ── src/utils/auth.js ── */
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

/* ── src/utils/api.js ── */
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
  };
})();

/* ── src/utils/omdb.js ── */
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

/* ── src/utils/settings.js ── */
/** GM-backed feature toggles: isEnabled, set, onChange, IDS.* */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settings = (() => {
  const FEATURES = [
    {
      id: "userProfile.alwaysShowStats",
      label: "Play count & favourites on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: keeps play count and favourite count visible on each beatmap card without hovering.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardExtraInfo",
      label: "Extra metadata on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: shows “from {source}” between the artist and mapper lines (reserved line when empty) and BPM plus longest drain length below the mapper line (from cached beatmapset JSON, no extra API calls). Uses osu’s listing JSON, search responses, and profile `extra-pages/beatmaps` (fetch/XHR hooks; one session prefetch if needed).",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardDifficultyRange",
      label: "Star rating on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: after each mode’s difficulty dots, shows the highest nomod star rating as a coloured pill (Font Awesome up-chevron, star, and value; from cached `difficulty_rating` per beatmap; same JSON sources as extra metadata).",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.fullBeatmapStatNumbers",
      label: "Full numbers on beatmap card stats",
      description:
        "On user profiles and on /beatmapsets: shows exact play and favourite counts (e.g. 159,915 instead of 159.9K) from each card’s tooltip/title in the HTML.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.scoreHitStatistics",
      label: "Hit statistics on profile scores",
      description:
        "On best performance, pinned, first place, and Expert+ Recent scores (Historical): adds a colour-coded hit row (great / ok / meh / miss). Beatmapset leaderboards keep hit-stat colours regardless of this option.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.moddedStarRating",
      label: "Modded star rating on difficulties",
      description:
        "Fetches and displays the accurate star rating with mods applied next to each difficulty name. Requires API credentials.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.scoreCardBackgrounds",
      label: "Beatmap background on score cards",
      description:
        "Shows the beatmap cover art as a background image on each score card in the Ranks section and on Expert+ Recent scores (Historical tab).",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.scoreCardPlaceNumber",
      label: "Score place number on rank cards",
      description:
        "On Best performance: shows #1, #2, … before the beatmap title. On Expert+ Recent scores (Historical): #1 is the most recent visible score, then #2, … (respects Show failed scores).",
      group: "User Profile",
      default: true,
    },
    {
      id: "scores.periodHighlight",
      label: "Score age period highlight",
      description:
        "On user profile Top Ranks only: bar to highlight scores by how recent they are (weeks through years), with reverse and reset.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.scorePpDecimals",
      label: "PP decimals on scores",
      description:
        "On profile best performance, pinned, first place, Expert+ Recent (Historical), and on beatmapset leaderboards: shows pp to two decimal places (e.g. 610.27pp) instead of rounding to an integer in the visible text (full value stays in the tooltip/title where the site provides it).",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.modIconsAsAcronyms",
      label: "Mod acronyms instead of icons",
      description:
        "Shows mod letters (e.g. HD, DT) on score rows and beatmap leaderboards instead of sprite icons.",
      group: "Scores",
      default: false,
    },
    {
      id: "userProfile.hideClMod",
      label: "Hide Classic (CL) mod",
      description:
        "Hides the Classic (CL) mod on score rows and leaderboards. Works whether mods are shown as icons or acronyms.",
      group: "Scores",
      default: false,
    },
    {
      id: "beatmapDetail.metadataDescriptionModalButtons",
      label: "Full description & metadata buttons",
      description:
        "On beatmapset pages, adds the \"Show metadata\" button under the artist and the \"Full description\" button in the info panel (each opens a modal).",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.discussionDefaultToTotal",
      label: "Beatmap discussion on Total tab",
      description:
        "On beatmap discussion pages, redirect default/praise landing routes to /discussion/-/generalAll/total.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.omdbBeatmapsetRatings",
      label: "OMDB difficulty ratings on beatmapset pages",
      description:
        "On beatmapset pages, shows an OMDB link to this mapset above the difficulty name. Difficulty stats, distribution popover, and star voting (0 at the left edge of the first star, then 0.5–5) need an OMDB API key in Expert+ settings.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapPreview",
      label: "Gameplay preview on beatmap info",
      description:
        "On beatmapset info pages, adds an expandable osu!standard gameplay preview (osu-beatmap-renderer + PixiJS loaded from esm.sh when you open it). Uses the site preview MP3.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapsetPreviewAudioButton",
      label: "Open preview audio button on beatmapset pages",
      description:
        "On beatmapset info pages, adds a square header button (with icon) that opens the official preview MP3 at b.ppy.sh in a new tab.",
      group: "Beatmap Detail",
      default: false,
    },
    {
      id: "beatmapDetail.beatconnectDownloadButton",
      label: "Beatconnect download on beatmapset pages",
      description:
        "On beatmapset pages, shows a Beatconnect.io download button beside the main .osz download link.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.apiExtendedLeaderboard",
      label: "Load up to 100 scores on beatmap leaderboard",
      description:
        "On beatmap scoreboards, bumps the `/beatmaps/{id}/scores` API limit from osu!’s default (50) to 100 so the first page loads more rows at once. Turn off to use the site default.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardPlayerLookup",
      label: "Leaderboard player lookup bar",
      description:
        "On beatmapset scoreboards, shows the username field to look up a player’s scores on the current difficulty; results replace the main leaderboard table (same idea as wildcard merge). Requires osu! API OAuth (Client ID + Secret) in Expert+ settings; without credentials the bar stays visible but disabled with a short notice.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardModGrid",
      label: "Grid layout for scoreboard mod filters",
      description:
        "On beatmapset scoreboards, replaces the default horizontal mod strip with Expert+’s grouped grid (stable / Lazer, difficulty rows, reset, collapsible “Mod filters”). Turn off to use osu!’s original mod strip layout.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardHideCustomRateScores",
      label: "Hide custom rate scores on leaderboard",
      description:
        "On beatmapset scoreboards, hides leaderboard rows whose speed mod rate is not the osu! default (1.00×, or 1.50× for DT/NC, or 0.75× for HT/DC)—the same rows Expert+ dims as rate-edited. A checkbox under the mod filters mirrors this option.",
      group: "Beatmap Detail",
      default: false,
    },
    {
      id: "beatmapDetail.diffNameBesidePicker",
      label: "Difficulty name & stars in the active picker cell",
      description:
        "On beatmapset pages, puts the selected difficulty’s name, guest mapper credit when applicable (mapped by …), and nomod star rating inside the same bordered box as the active difficulty icon. Hides the duplicate header diff line and the separate nomod star chip.",
      group: "Beatmap Detail",
      default: false,
    },
  ];

  /** GM keys used by UI elsewhere (not listed in the options panel). */
  const PANEL_HIDDEN_BOOLEAN_DEFAULTS = Object.freeze({
    "userProfile.recentScoresShowFails": true,
  });

  (function migrateScoreListDetails() {
    const flag = "userProfile._oepScoreListDetailsMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const pp = GM_getValue("userProfile.ppDecimals", unset);
    const st = GM_getValue("userProfile.bestScoreStats", unset);
    if (pp === unset && st === unset) {
      GM_setValue(flag, true);
      return;
    }
    const on = (v) => (v === unset ? true : v);
    GM_setValue("userProfile.scoreListDetails", on(pp) && on(st));
    GM_deleteValue("userProfile.ppDecimals");
    GM_deleteValue("userProfile.bestScoreStats");
    GM_setValue(flag, true);
  })();

  (function migrateScoreListDetailsSplit() {
    const flag = "userProfile._oepScoreListDetailsSplitMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const legacy = "userProfile.scoreListDetails";
    const v = GM_getValue(legacy, unset);
    if (v !== unset) {
      const on = Boolean(v);
      GM_setValue("userProfile.scorePpDecimals", on);
      GM_setValue("userProfile.scoreHitStatistics", on);
      GM_deleteValue(legacy);
    }
    GM_setValue(flag, true);
  })();

  (function migrateBeatmapCardDifficultyRange() {
    const flag = "userProfile._oepBeatmapCardDifficultyRangeMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const newKey = "userProfile.beatmapCardDifficultyRange";
    if (GM_getValue(newKey, unset) !== unset) {
      GM_setValue(flag, true);
      return;
    }
    const extra = FEATURES.find(
      (f) => f.id === "userProfile.beatmapCardExtraInfo",
    );
    const extraDefault = extra ? extra.default : false;
    if (GM_getValue("userProfile.beatmapCardExtraInfo", extraDefault)) {
      GM_setValue(newKey, true);
    }
    GM_setValue(flag, true);
  })();

  /** @type {Map<string, Set<function>>} */
  const _listeners = new Map();

  /** Return the full feature registry (read-only copy). */
  function getFeatures() {
    return FEATURES.slice();
  }

  /**
   * Read the stored value for a feature.
   * Falls back to the registered default if nothing has been saved yet.
   * @param {string} id
   * @returns {boolean}
   */
  function isEnabled(id) {
    const feature = FEATURES.find((f) => f.id === id);
    const defaultVal = feature
      ? feature.default
      : (PANEL_HIDDEN_BOOLEAN_DEFAULTS[id] ?? false);
    return GM_getValue(id, defaultVal);
  }

  /**
   * Persist a new value and notify all listeners for that feature.
   * @param {string} id
   * @param {boolean} value
   */
  function set(id, value) {
    GM_setValue(id, value);
    _listeners.get(id)?.forEach((fn) => {
      try {
        fn(value);
      } catch (_) {}
    });
  }

  /**
   * Subscribe to changes for a specific feature.
   * Returns an unsubscribe function.
   * @param {string} id
   * @param {function(boolean): void} fn
   * @returns {function}
   */
  function onChange(id, fn) {
    if (!_listeners.has(id)) _listeners.set(id, new Set());
    _listeners.get(id).add(fn);
    return () => _listeners.get(id)?.delete(fn);
  }

  /** Revert every option listed in the settings panel to its registered default. */
  function resetPanelTogglesToDefaults() {
    for (const f of FEATURES) {
      set(f.id, Boolean(f.default));
    }
  }

  const IDS = Object.freeze({
    ALWAYS_SHOW_STATS: "userProfile.alwaysShowStats",
    BEATMAP_CARD_EXTRA_INFO: "userProfile.beatmapCardExtraInfo",
    BEATMAP_CARD_DIFFICULTY_RANGE: "userProfile.beatmapCardDifficultyRange",
    FULL_BEATMAP_STAT_NUMBERS: "userProfile.fullBeatmapStatNumbers",
    SCORE_PP_DECIMALS: "userProfile.scorePpDecimals",
    SCORE_HIT_STATISTICS: "userProfile.scoreHitStatistics",
    MODDED_STAR_RATING: "userProfile.moddedStarRating",
    MOD_ICONS_AS_ACRONYMS: "userProfile.modIconsAsAcronyms",
    HIDE_CL_MOD: "userProfile.hideClMod",
    SCORE_CARD_BACKGROUNDS: "userProfile.scoreCardBackgrounds",
    SCORE_CARD_PLACE_NUMBER: "userProfile.scoreCardPlaceNumber",
    SCORE_PERIOD_HIGHLIGHT: "scores.periodHighlight",
    RECENT_SCORES_SHOW_FAILS: "userProfile.recentScoresShowFails",
    METADATA_DESCRIPTION_MODAL_BUTTONS:
      "beatmapDetail.metadataDescriptionModalButtons",
    DISCUSSION_DEFAULT_TO_TOTAL: "beatmapDetail.discussionDefaultToTotal",
    OMDB_BEATMAPSET_RATINGS: "beatmapDetail.omdbBeatmapsetRatings",
    BEATMAP_PREVIEW: "beatmapDetail.beatmapPreview",
    BEATMAPSET_PREVIEW_AUDIO_BUTTON:
      "beatmapDetail.beatmapsetPreviewAudioButton",
    BEATCONNECT_DOWNLOAD_BUTTON: "beatmapDetail.beatconnectDownloadButton",
    API_EXTENDED_LEADERBOARD: "beatmapDetail.apiExtendedLeaderboard",
    SCOREBOARD_MOD_GRID: "beatmapDetail.scoreboardModGrid",
    SCOREBOARD_HIDE_CUSTOM_RATE_SCORES:
      "beatmapDetail.scoreboardHideCustomRateScores",
    SCOREBOARD_PLAYER_LOOKUP: "beatmapDetail.scoreboardPlayerLookup",
    DIFF_NAME_BESIDE_PICKER: "beatmapDetail.diffNameBesidePicker",
  });

  return {
    IDS,
    getFeatures,
    isEnabled,
    set,
    onChange,
    resetPanelTogglesToDefaults,
  };
})();

/* ── src/utils/beatmap-preview.js ── */
/** Lazy ESM load osu-beatmap-renderer + Pixi; gameplay preview on beatmapset pages. */
/* global unsafeWindow, GM_getValue, GM_xmlhttpRequest */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapPreview = (() => {
  const READY_EVENT = "oep-beatmap-renderer-esm-ready";
  const GLOBAL_KEY = "__oepBeatmapEngine";
  const LOADER_ATTR = "data-oep-beatmap-renderer-loader";
  const IMPORTMAP_ATTR = "data-oep-pixi-importmap";

  const PIXI_ESM_URL =
    "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
  const RENDERER_ESM_URL =
    "https://cdn.jsdelivr.net/npm/osu-beatmap-renderer@0.1.2/dist/osu-beatmap-renderer.js";

  /** Page window (unsafeWindow under TM). */
  function pageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {
      void 0;
    }
    return window;
  }

  /** Page-origin `localStorage` (osu.ppy.sh), or null if unavailable. */
  function pageLocalStorage() {
    try {
      const pw = pageWindow();
      return pw?.localStorage ?? null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Reads osu! web `localStorage.userPreferences` JSON and returns `audio_volume` if valid (0–1).
   * @returns {number|null}
   */
  function readOsuSiteAudioVolume() {
    const ls = pageLocalStorage();
    if (!ls) return null;
    try {
      const raw = ls.getItem("userPreferences");
      if (raw == null || raw === "") return null;
      const obj = JSON.parse(raw);
      const v = obj?.audio_volume;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    } catch (_) {
      void 0;
    }
    return null;
  }

  /** @type {Promise<any>|null} */
  let engineClassPromise = null;

  const BEATMAP_ENGINE_AUDIO_PATCH = "__oepBeatmapEngineNoPreviewAudioCors";
  const BEATMAP_ENGINE_SEEK_PATCH = "__oepBeatmapEngineSeekBeforePreview";
  const BEATMAP_ENGINE_PLAY_PATCH = "__oepBeatmapEnginePlayOutsidePreview";
  const BEATMAP_ENGINE_TRANSPORT_PATCH = "__oepBeatmapEngineTransportPreview";
  const BEATMAP_ENGINE_PAUSE_PATCH = "__oepBeatmapEnginePauseSnapshot";
  /** Same cap as site preview MP3 handling in {@link mountBeatmapsetInfoPreview}. */
  const OEP_PREVIEW_CLIP_CAP_MS = 10000;

  /**
   * True when beatmap time does not fall inside the ~10s site preview MP3 (relative to PreviewTime).
   * @param {any} engine
   * @param {number} beatmapMs
   */
  function isBeatmapTimeOutsideSitePreviewClip(engine, beatmapMs) {
    if (
      !engine?.previewAudio ||
      typeof engine.getPreviewAudioTimeMsForBeatmapTime !== "function" ||
      !Number.isFinite(beatmapMs)
    ) {
      return false;
    }
    const shifted = engine.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
    const dur = engine.previewAudio.duration;
    const durMs =
      Number.isFinite(dur) && dur > 0
        ? Math.min(OEP_PREVIEW_CLIP_CAP_MS, dur * 1000)
        : OEP_PREVIEW_CLIP_CAP_MS;
    return !Number.isFinite(shifted) || shifted < 0 || shifted >= durMs;
  }

  /**
   * osu-beatmap-renderer sets `crossOrigin = "anonymous"` on the preview HTMLAudioElement.
   * `https://b.ppy.sh/preview/…` does not send ACAO, so the request fails and playback never starts.
   * Omit CORS mode so the element can stream and report `currentTime` for sync (no WebAudio decode needed).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePreviewAudio(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto) return;
    if (!proto[BEATMAP_ENGINE_AUDIO_PATCH]) {
      proto.updateAudioTrackFromUrl = function oepUpdateAudioTrackFromUrl(
        audioUrl,
      ) {
        if (this.previewAudio) {
          this.previewAudio.pause();
          this.previewAudio.src = "";
        }
        this.previewAudio = new Audio(audioUrl);
        this.previewAudio.preload = "auto";
        this.previewAudio.volume = this.musicVolume;
      };
      proto[BEATMAP_ENGINE_AUDIO_PATCH] = true;
    }
    patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine);
  }

  /**
   * While playing, osu-beatmap-renderer's `setCurrentTime` re-reads `previewAudio.currentTime` and
   * maps it back to beatmap time. Seeking before PreviewTime clamps audio to 0s, which maps to
   * PreviewTime again — so the scrubber snaps back. Pause preview audio before that path when the
   * seek target is outside the ~10s clip, and clear audio sync offset so transport follows the clock.
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_SEEK_PATCH]) return;
    const orig = proto.setCurrentTime;
    proto.setCurrentTime = function oepSetCurrentTime(ms) {
      if (!Number.isFinite(ms)) {
        return orig.call(this, ms);
      }
      const outsideClip =
        !!this.previewAudio && isBeatmapTimeOutsideSitePreviewClip(this, ms);
      if (this.isPlaying && outsideClip && this.previewAudio) {
        try {
          this.previewAudio.pause();
        } catch (_) {
          void 0;
        }
      }
      const ret = orig.call(this, ms);
      if (outsideClip) {
        this.audioSyncOffsetMs = 0;
        this.lastAudioSyncSamplePerfMs = 0;
      }
      return ret;
    };
    proto[BEATMAP_ENGINE_SEEK_PATCH] = true;
  }

  /**
   * `play()` always starts the preview HTMLAudioElement and sets its `currentTime` from beatmap time.
   * Outside the ~10s clip that maps to nonsense (browser clamps to file end), then
   * `getTransportCurrentTimeMs()` syncs the visual clock to that wrong audio position — huge jumps
   * after pause/resume. Keep preview audio paused when resuming outside the clip (same as our rAF
   * sync); transport uses the performance clock only there.
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PLAY_PATCH]) return;
    const orig = proto.play;
    proto.play = function oepPlay(options) {
      orig.call(this, options);
      try {
        if (
          this.previewAudio &&
          isBeatmapTimeOutsideSitePreviewClip(this, this.currentTime)
        ) {
          this.previewAudio.pause();
        }
      } catch (_) {
        void 0;
      }
    };
    proto[BEATMAP_ENGINE_PLAY_PATCH] = true;
  }

  /**
   * Outside the site preview MP3 window, never apply preview-audio drift correction — the element
   * is clamped to [0, duration] and maps to the wrong beatmap time, which corrupts
   * `audioSyncOffsetMs` and jumps the timeline (notably after pause/resume).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_TRANSPORT_PATCH]) return;
    const orig = proto.getTransportCurrentTimeMs;
    proto.getTransportCurrentTimeMs = function oepGetTransportCurrentTimeMs() {
      if (!this.isPlaying) {
        return orig.call(this);
      }
      const nowPerfMs = performance.now();
      const elapsedMs = nowPerfMs - this.transportStartPerfTime;
      const perfVisualMs = this.transportStartMs + Math.max(0, elapsedMs);

      const bypassAudioSync =
        this.previewAudio?.ended ||
        isBeatmapTimeOutsideSitePreviewClip(this, perfVisualMs);

      if (bypassAudioSync) {
        const offset = Number(this.audioSyncOffsetMs) || 0;
        if (offset !== 0) {
          const currentVisual = perfVisualMs + offset;
          this.transportStartMs = currentVisual;
          this.transportStartPerfTime = nowPerfMs;
          this.audioSyncOffsetMs = 0;
          this.lastAudioSyncSamplePerfMs = 0;
          return currentVisual;
        }
        return perfVisualMs;
      }
      return orig.call(this);
    };
    proto[BEATMAP_ENGINE_TRANSPORT_PATCH] = true;
  }

  /**
   * Snapshot transport on pause after pausing preview audio and clearing sync offset, so
   * `getTransportCurrentTimeMs()` does not use a still-playing MP3 clock (same tick as pause).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PAUSE_PATCH]) return;
    proto.pause = function oepPause() {
      if (!this.isPlaying) {
        return;
      }
      try {
        if (this.previewAudio) {
          this.previewAudio.pause();
        }
      } catch (_) {
        void 0;
      }
      this.audioSyncOffsetMs = 0;
      this.lastAudioSyncSamplePerfMs = 0;
      this.currentTime = this.getTransportCurrentTimeMs();
      this.isPlaying = false;
      this.hitsoundPlayer?.stopScheduler();
      this.hitsoundPlayer?.clearScheduledSources();
    };
    proto[BEATMAP_ENGINE_PAUSE_PATCH] = true;
  }

  /**
   * One BeatmapEngine / Pixi Application per tab. Pixi v8 registers extension handlers
   * (e.g. batcher) globally; destroying and creating a second Application throws
   * "Extension type batcher already has a handler".
   */
  /** @type {HTMLDivElement|null} */
  let sharedEngineRoot = null;
  /** @type {any} */
  let sharedEngine = null;

  /** Serializes first-time init so two rapid "expand" clicks cannot create two Pixi apps. */
  let acquireMutex = Promise.resolve();

  const ENGINE_ROOT_PARK_STYLE =
    "position:fixed!important;left:-9999px!important;top:0!important;width:512px!important;height:288px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;";

  function parkSharedEngineRoot() {
    if (!sharedEngineRoot) return;
    try {
      sharedEngine?.pause?.();
    } catch (_) {
      void 0;
    }
    sharedEngineRoot.setAttribute("style", ENGINE_ROOT_PARK_STYLE);
    if (document.body) {
      document.body.appendChild(sharedEngineRoot);
    }
  }

  /**
   * @param {HTMLElement} hostEl  Visible canvas container (e.g. `.oep-beatmap-preview__canvas-host`).
   */
  function placeSharedEngineRoot(hostEl) {
    if (!sharedEngineRoot) return;
    sharedEngineRoot.removeAttribute("style");
    hostEl.replaceChildren(sharedEngineRoot);
  }

  /**
   * @param {HTMLElement} hostEl
   */
  async function acquireSharedEngine(hostEl) {
    const run = acquireMutex.then(async () => {
      const BeatmapEngine = await loadBeatmapEngineClass();
      if (!sharedEngineRoot) {
        sharedEngineRoot = document.createElement("div");
        sharedEngineRoot.setAttribute("data-oep-beatmap-engine-root", "");
        sharedEngineRoot.className = "oep-beatmap-preview-engine-root";
        hostEl.replaceChildren(sharedEngineRoot);
        sharedEngine = new BeatmapEngine(sharedEngineRoot, {});
        await sharedEngine.init();
      } else {
        placeSharedEngineRoot(hostEl);
        try {
          sharedEngine?.resize?.();
        } catch (_) {
          void 0;
        }
      }
      return sharedEngine;
    });
    acquireMutex = run.catch(() => {});
    return run;
  }

  /**
   * Hard teardown (e.g. future "reset renderer" / tests). Not used on normal SPA navigation.
   */
  function destroySharedEngineHard() {
    try {
      sharedEngine?.destroy?.();
    } catch (_) {
      void 0;
    }
    sharedEngine = null;
    try {
      sharedEngineRoot?.remove();
    } catch (_) {
      void 0;
    }
    sharedEngineRoot = null;
  }

  /**
   * @returns {Promise<any>} BeatmapEngine constructor
   */
  function loadBeatmapEngineClass() {
    const pw = pageWindow();
    const existing = pw[GLOBAL_KEY];
    if (existing && typeof existing === "function") {
      patchBeatmapEnginePreviewAudio(existing);
      return Promise.resolve(existing);
    }
    if (engineClassPromise) return engineClassPromise;

    engineClassPromise = new Promise((resolve, reject) => {
      let tid = 0;
      const finish = (err, Cls) => {
        pw.removeEventListener(READY_EVENT, onReady);
        if (tid) window.clearTimeout(tid);
        if (err || !Cls) {
          engineClassPromise = null;
          document.querySelector(`script[${LOADER_ATTR}]`)?.remove();
          try {
            delete pw[GLOBAL_KEY];
          } catch (_) {
            pw[GLOBAL_KEY] = undefined;
          }
          reject(err || new Error("BeatmapEngine missing"));
          return;
        }
        patchBeatmapEnginePreviewAudio(Cls);
        resolve(Cls);
      };

      const onReady = () => {
        const Cls = pageWindow()[GLOBAL_KEY];
        finish(
          Cls && typeof Cls === "function"
            ? null
            : new Error("BeatmapEngine not exposed"),
          Cls,
        );
      };

      pw.addEventListener(READY_EVENT, onReady, { once: true });
      tid = window.setTimeout(() => {
        finish(new Error("Beatmap renderer load timeout"), null);
      }, 60000);

      const ClsNow = pw[GLOBAL_KEY];
      if (ClsNow && typeof ClsNow === "function") {
        finish(null, ClsNow);
        return;
      }

      try {
        if (!document.querySelector(`script[${LOADER_ATTR}]`)) {
          if (!document.querySelector(`script[${IMPORTMAP_ATTR}]`)) {
            const map = document.createElement("script");
            map.type = "importmap";
            map.setAttribute(IMPORTMAP_ATTR, "");
            map.textContent = JSON.stringify({
              imports: { "pixi.js": PIXI_ESM_URL },
            });
            document.head.appendChild(map);
          }

          const script = document.createElement("script");
          script.type = "module";
          script.setAttribute(LOADER_ATTR, "");
          script.textContent = `
import { BeatmapEngine } from ${JSON.stringify(RENDERER_ESM_URL)};
import * as PIXI from "pixi.js";

const OEP_BG_CONTAIN_PATCH = "__oepBeatmapEngineBgContain";
{
  const p = BeatmapEngine.prototype;
  if (!p[OEP_BG_CONTAIN_PATCH]) {
    function reflowBackgroundContain(self) {
      try {
        const sp = self.backgroundSprite;
        const tex = sp?.texture;
        if (!sp || !tex || tex === PIXI.Texture.EMPTY || !tex.width || !tex.height) {
          return;
        }
        const { width, height } = self.getDisplayDimensions();
        const scaleX = width / tex.width;
        const scaleY = height / tex.height;
        const scale = Math.min(scaleX, scaleY);
        sp.scale.set(scale);
        sp.x = (width - tex.width * scale) / 2;
        sp.y = (height - tex.height * scale) / 2;
        // Darken cover art so objects/readability match typical in-game dimming.
        sp.tint = 0x5a5a5a;
      } catch (_e) {
        void 0;
      }
    }

    const origUpdateBg = p.updateBackgroundFromUrl;
    p.updateBackgroundFromUrl = async function oepUpdateBackgroundFromUrl(imageUrl) {
      await origUpdateBg.call(this, imageUrl);
      reflowBackgroundContain(this);
    };

    const origResize = p.resize;
    p.resize = function oepResize() {
      origResize.call(this);
      reflowBackgroundContain(this);
    };

    p[OEP_BG_CONTAIN_PATCH] = true;
  }
}

window[${JSON.stringify(GLOBAL_KEY)}] = BeatmapEngine;
window.dispatchEvent(new Event(${JSON.stringify(READY_EVENT)}));
`;
          document.head.appendChild(script);
        }
      } catch (e) {
        finish(e, null);
      }
    });

    return engineClassPromise;
  }

  /**
   * @param {string|number} beatmapId
   * @returns {Promise<string>}
   */
  async function fetchOsuFileText(beatmapId) {
    const url = `https://osu.ppy.sh/osu/${beatmapId}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) {
      throw new Error(`Could not download .osu (${resp.status})`);
    }
    return resp.text();
  }

  /**
   * @param {string|undefined|null} url
   * @returns {string}
   */
  function absoluteUrl(url) {
    if (!url) return "";
    const s = String(url).trim();
    if (!s) return "";
    if (s.startsWith("//")) return `https:${s}`;
    return s;
  }

  /** Revoked when loading another map or disposing the preview UI. */
  let beatmapCoverObjectUrl = null;

  function revokeBeatmapCoverObjectUrl() {
    if (beatmapCoverObjectUrl) {
      try {
        URL.revokeObjectURL(beatmapCoverObjectUrl);
      } catch (_) {
        void 0;
      }
      beatmapCoverObjectUrl = null;
    }
  }

  /**
   * Cross-origin cover URLs taint pixels; Pixi WebGL upload then throws "The operation is insecure".
   * Load bytes into a blob: URL (same-origin for WebGL).
   * Prefer GM_xmlhttpRequest first when available so we do not hit `fetch` on hosts without ACAO
   * (avoids a failed CORS request and console noise before the GM fallback).
   *
   * @param {string} absUrl
   * @returns {Promise<string>} object URL or "" if unavailable
   */
  async function fetchBeatmapCoverObjectUrl(absUrl) {
    if (!absUrl) return "";
    revokeBeatmapCoverObjectUrl();

    /** @returns {Promise<ArrayBuffer>} */
    function gmGetArrayBuffer() {
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== "function") {
          reject(new Error("no-gm"));
          return;
        }
        GM_xmlhttpRequest({
          method: "GET",
          url: absUrl,
          responseType: "arraybuffer",
          onload(r) {
            if (r.status >= 200 && r.status < 300 && r.response) {
              resolve(r.response);
            } else {
              reject(new Error(String(r.status)));
            }
          },
          onerror: () => reject(new Error("xhr")),
        });
      });
    }

    try {
      let buf;
      if (typeof GM_xmlhttpRequest === "function") {
        try {
          buf = await gmGetArrayBuffer();
        } catch (_) {
          const res = await fetch(absUrl, {
            credentials: "include",
            mode: "cors",
          });
          if (!res.ok) throw new Error(String(res.status));
          buf = await res.arrayBuffer();
        }
      } else {
        const res = await fetch(absUrl, {
          credentials: "include",
          mode: "cors",
        });
        if (!res.ok) throw new Error(String(res.status));
        buf = await res.arrayBuffer();
      }
      const blob = new Blob([buf]);
      beatmapCoverObjectUrl = URL.createObjectURL(blob);
      return beatmapCoverObjectUrl;
    } catch (_) {
      return "";
    }
  }

  /**
   * @param {object} options
   * @param {typeof OsuExpertPlus.dom.el} options.el
   * @param {typeof OsuExpertPlus.dom.manageStyle} options.manageStyle
   * @param {RegExp} options.pathRe
   * @param {() => string|null} options.getBeatmapId
   * @param {() => string} options.getRuleset
   * @param {() => object|null} options.readBeatmapsetJson
   * @param {string} options.styleId
   * @returns {{ dispose: () => void }}
   */
  function mountBeatmapsetInfoPreview({
    el,
    manageStyle,
    pathRe,
    getBeatmapId,
    getRuleset,
    readBeatmapsetJson,
    styleId,
  }) {
    const wrapClass = "oep-beatmap-preview";
    const styles = manageStyle(
      styleId,
      `
      .${wrapClass} { margin-top: 4px; }
      .${wrapClass}__toggle.btn-osu-big {
        --btn-bg: hsl(var(--hsl-b5, 333 18% 28%));
        margin-top: 6px;
      }
      .${wrapClass}__panel {
        margin-top: 10px;
        border-radius: 6px;
        overflow: hidden;
        background: hsl(var(--hsl-b5, 333 18% 8%));
        border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
      }
      .${wrapClass}__canvas-host {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 180px;
        background: #000;
        cursor: pointer;
        outline: none;
      }
      .${wrapClass}__canvas-host:focus-visible {
        box-shadow: inset 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__canvas-host--disabled {
        cursor: not-allowed;
        opacity: 0.85;
      }
      .${wrapClass}__panel:not(.${wrapClass}__panel--unsupported) .${wrapClass}__unsupported {
        display: none;
      }
      .${wrapClass}__panel.${wrapClass}__panel--unsupported .${wrapClass}__canvas-host,
      .${wrapClass}__panel.${wrapClass}__panel--unsupported .${wrapClass}__seek {
        display: none;
      }
      .${wrapClass}__unsupported {
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 16 / 9;
        min-height: 180px;
        padding: 16px;
        text-align: center;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        font-size: 13px;
        line-height: 1.45;
        box-sizing: border-box;
      }
      .${wrapClass}__engine-slot {
        position: absolute;
        inset: 0;
        z-index: 1;
      }
      .${wrapClass}__engine-slot canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none;
      }
      .${wrapClass}__transport-overlay {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.4s ease;
        background: rgba(0, 0, 0, 0.12);
      }
      .${wrapClass}__transport-overlay--visible {
        opacity: 1;
      }
      .${wrapClass}__transport-glyph {
        font-size: clamp(3rem, 14vw, 5.5rem);
        color: hsl(var(--hsl-l1, 0 0% 98%));
        filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.65));
        line-height: 1;
      }
      .${wrapClass}__transport-glyph .fa-fw {
        width: 1.15em;
        text-align: center;
      }
      .${wrapClass}__seek {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 10px;
        background: hsl(var(--hsl-b4, 333 18% 14%));
        border-top: 1px solid hsl(var(--hsl-b5, 333 18% 10%));
        font-size: 12px;
        color: hsl(var(--hsl-l2, 0 0% 75%));
      }
      .${wrapClass}__seek button {
        flex: 0 0 auto;
        padding: 4px 10px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font: inherit;
        background: hsl(var(--hsl-b5, 333 18% 28%));
        color: hsl(var(--hsl-l1, 0 0% 92%));
      }
      .${wrapClass}__seek button:hover:not(:disabled) {
        filter: brightness(1.08);
      }
      .${wrapClass}__seek button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__status {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 100%;
        text-align: right;
      }
      .${wrapClass}__seek-time {
        flex: 0 0 auto;
        flex-shrink: 0;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        white-space: nowrap;
      }
      .${wrapClass}__seek-range {
        flex: 1 1 0;
        min-width: 72px;
        width: 0;
        height: 22px;
        accent-color: hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__seek-range:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__volume {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }
      .${wrapClass}__volume-icon {
        color: hsl(var(--hsl-l2, 0 0% 75%));
        font-size: 12px;
        line-height: 1;
        opacity: 0.9;
      }
      .${wrapClass}__volume-range {
        width: 72px;
        min-width: 56px;
        max-width: 100px;
        height: 22px;
        flex: 0 0 72px;
        accent-color: hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__volume-range:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__offset-input {
        width: 4.25em;
        min-width: 3.25em;
        max-width: 6em;
        padding: 3px 6px;
        border-radius: 4px;
        border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
        background: hsl(var(--hsl-b5, 333 18% 12%));
        color: hsl(var(--hsl-l1, 0 0% 92%));
        font: inherit;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        box-sizing: border-box;
      }
      .${wrapClass}__offset-input:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__offset-input:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
        border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
      }
      .${wrapClass}__offset-unit {
        flex: 0 0 auto;
        font-size: 11px;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        user-select: none;
      }
      .oep-beatmap-preview-section {
        box-sizing: border-box;
        width: 100%;
        padding: 10px 20px 12px;
      }
      @media (min-width: 900px) {
        .oep-beatmap-preview-section {
          padding: 12px 40px 16px;
        }
      }
      .oep-beatmap-preview-section > .beatmapset-info__row {
        display: flex;
        flex-direction: column;
        padding-bottom: 0;
        min-width: 0;
      }
    `,
    );
    styles.inject();

    const row = el("div", {
      class: "beatmapset-info__row",
      "data-oep-beatmap-preview-root": "",
    });
    const heading = el(
      "h3",
      { class: "beatmapset-info__header" },
      "Gameplay preview",
    );

    let expanded = false;
    let busy = false;
    let lastLoadedKey = "";
    let seekRafId = 0;
    let seekPointerActive = false;
    /** `ruleset:beatmapId` while preview is expanded; used to detect difficulty / mode changes (SPA). */
    let previewContextKey = "";
    let contextPollId = 0;

    function previewContextKeyFromPage() {
      if (!pathRe.test(location.pathname)) return "";
      const rs = (getRuleset() || "osu").toLowerCase();
      const id = getBeatmapId();
      return `${rs}:${id || ""}`;
    }

    function stopContextPoll() {
      if (contextPollId) {
        window.clearInterval(contextPollId);
        contextPollId = 0;
      }
    }

    function startContextPoll() {
      stopContextPoll();
      contextPollId = window.setInterval(() => {
        if (!pathRe.test(location.pathname) || !expanded || busy) return;
        const k = previewContextKeyFromPage();
        if (previewContextKey && k !== previewContextKey) {
          collapsePreviewAndResetEngine();
        }
      }, 200);
    }

    function collapsePreviewAndResetEngine() {
      if (!expanded) return;
      expanded = false;
      panel.hidden = true;
      panel.classList.remove(`${wrapClass}__panel--unsupported`);
      const top = toggleBtn.querySelector(".btn-osu-big__text-top");
      if (top) {
        top.textContent = "Beatmap Preview";
      }
      stopContextPoll();
      previewContextKey = "";
      stopSeekAnimationLoop();
      lastLoadedKey = "";
      busy = false;
      setPreviewControlsEnabled(false);
      setStatus("");
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
      destroySharedEngineHard();
      acquireMutex = Promise.resolve();
      revokeBeatmapCoverObjectUrl();
    }

    function onPossiblePreviewContextChange() {
      if (!pathRe.test(location.pathname) || !expanded || busy) return;
      const k = previewContextKeyFromPage();
      if (previewContextKey && k !== previewContextKey) {
        collapsePreviewAndResetEngine();
      }
    }

    /** Site preview files are short; cap so we never treat a longer buffer as full-map audio. */
    const PREVIEW_CLIP_MAX_MS = 10000;
    const PREVIEW_MUSIC_LS_KEY = "oep.beatmapPreview.musicVolume";
    const PREVIEW_HITSOUND_LS_KEY = "oep.beatmapPreview.hitsoundVolume";
    /** Tampermonkey keys from before localStorage migration; read once to seed LS. */
    const PREVIEW_MUSIC_VOLUME_LEGACY_GM_KEY = "beatmapPreview.musicVolume";
    const PREVIEW_HITSVOL_LEGACY_GM_KEY = "beatmapPreview.hitsoundVolume";
    const PREVIEW_VOLUME_DEFAULT = 0.3;
    const PREVIEW_OFFSET_LS_KEY = "oep.beatmapPreview.audioOffsetMs";
    const OFFSET_MIN = -500;
    const OFFSET_MAX = 500;
    /** Added to the displayed offset when calling the renderer (0 ms shown → 85 ms actual). */
    const PREVIEW_OFFSET_DISPLAY_BASE_MS = 85;

    function clampOffsetMs(n) {
      if (!Number.isFinite(n)) return 0;
      return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(n)));
    }

    function actualAudioOffsetMsFromDisplay(displayMs) {
      return clampOffsetMs(displayMs) + PREVIEW_OFFSET_DISPLAY_BASE_MS;
    }

    /** @param {unknown} raw */
    function parseOffsetTextStrict(raw) {
      const s = String(raw ?? "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/ms$/i, "");
      if (s === "" || s === "-" || s === "+") return null;
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      return clampOffsetMs(n);
    }

    function formatOffsetForField(ms) {
      return String(clampOffsetMs(ms));
    }

    function readStoredOffsetMs() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_OFFSET_LS_KEY);
          if (s != null && s !== "") {
            return clampOffsetMs(Number(s));
          }
        } catch (_) {
          void 0;
        }
      }
      return 0;
    }

    function writeStoredOffsetMs(ms) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_OFFSET_LS_KEY, String(clampOffsetMs(ms)));
      } catch (_) {
        void 0;
      }
    }

    function readStoredMusicVolume() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_MUSIC_LS_KEY);
          if (s != null && s !== "") {
            const n = Number(s);
            if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
          }
        } catch (_) {
          void 0;
        }
      }
      try {
        const v = GM_getValue(PREVIEW_MUSIC_VOLUME_LEGACY_GM_KEY, undefined);
        if (v !== undefined && v !== null && String(v) !== "") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n <= 1) {
            writeStoredMusicVolume(n);
            return n;
          }
        }
      } catch (_) {
        void 0;
      }
      const site = readOsuSiteAudioVolume();
      if (site != null) return site;
      return PREVIEW_VOLUME_DEFAULT;
    }

    function writeStoredMusicVolume(vol) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_MUSIC_LS_KEY, String(vol));
      } catch (_) {
        void 0;
      }
    }

    function readStoredHitsoundVolume() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_HITSOUND_LS_KEY);
          if (s != null && s !== "") {
            const n = Number(s);
            if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
          }
        } catch (_) {
          void 0;
        }
      }
      try {
        const v = GM_getValue(PREVIEW_HITSVOL_LEGACY_GM_KEY, undefined);
        if (v !== undefined && v !== null && String(v) !== "") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n <= 1) {
            writeStoredHitsoundVolume(n);
            return n;
          }
        }
      } catch (_) {
        void 0;
      }
      const site = readOsuSiteAudioVolume();
      if (site != null) return site;
      return PREVIEW_VOLUME_DEFAULT;
    }

    function writeStoredHitsoundVolume(vol) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_HITSOUND_LS_KEY, String(vol));
      } catch (_) {
        void 0;
      }
    }

    const statusEl = el("span", { class: `${wrapClass}__status` }, "");

    const unsupportedWrap = el(
      "div",
      { class: `${wrapClass}__unsupported` },
      "This gamemode is not supported yet.",
    );

    const canvasHost = el("div", {
      class: `${wrapClass}__canvas-host ${wrapClass}__canvas-host--disabled`,
      tabIndex: -1,
      role: "button",
      "aria-label": "Play gameplay preview",
    });
    const engineSlot = el("div", { class: `${wrapClass}__engine-slot` });
    const transportOverlay = el("div", {
      class: `${wrapClass}__transport-overlay`,
      "aria-hidden": "true",
    });
    const transportPlayGlyph = el(
      "span",
      { class: `${wrapClass}__transport-glyph`, hidden: "" },
      el(
        "span",
        { class: "fa fa-fw" },
        el("span", { class: "fas fa-play", "aria-hidden": "true" }),
      ),
    );
    const transportPauseGlyph = el(
      "span",
      { class: `${wrapClass}__transport-glyph`, hidden: "" },
      el(
        "span",
        { class: "fa fa-fw" },
        el("span", { class: "fas fa-pause", "aria-hidden": "true" }),
      ),
    );
    transportOverlay.appendChild(transportPlayGlyph);
    transportOverlay.appendChild(transportPauseGlyph);
    canvasHost.appendChild(engineSlot);
    canvasHost.appendChild(transportOverlay);

    /** @type {number} */
    let transportFlashTimer = 0;
    const TRANSPORT_FLASH_HOLD_MS = 520;

    function clearTransportFlashTimer() {
      if (transportFlashTimer) {
        window.clearTimeout(transportFlashTimer);
        transportFlashTimer = 0;
      }
    }

    /** @param {boolean} isPlaying After toggle: true = playing (show pause glyph). */
    function flashTransportOverlay(isPlaying) {
      clearTransportFlashTimer();
      transportPlayGlyph.hidden = isPlaying;
      transportPauseGlyph.hidden = !isPlaying;
      transportOverlay.classList.add(
        `${wrapClass}__transport-overlay--visible`,
      );
      transportFlashTimer = window.setTimeout(() => {
        transportOverlay.classList.remove(
          `${wrapClass}__transport-overlay--visible`,
        );
        transportFlashTimer = 0;
      }, TRANSPORT_FLASH_HOLD_MS);
    }

    const previewTimeBtn = el(
      "button",
      {
        type: "button",
        disabled: true,
        title: "Jump to the beatmap preview point (.osu PreviewTime)",
        "aria-label": "Jump to beatmap preview time",
      },
      "Jump to preview",
    );

    const seekTimeDisplay = el(
      "span",
      {
        class: `${wrapClass}__seek-time`,
        "aria-live": "off",
        title: "Current time / map duration",
      },
      "0:00 / 0:00",
    );
    const seekRange = el("input", {
      type: "range",
      class: `${wrapClass}__seek-range`,
      min: "0",
      max: "1",
      value: "0",
      step: "1",
      disabled: true,
      "aria-label": "Preview playback position",
    });
    const musicVolumeRange = el("input", {
      type: "range",
      class: `${wrapClass}__volume-range`,
      min: "0",
      max: "100",
      value: String(Math.round(readStoredMusicVolume() * 100)),
      step: "1",
      disabled: true,
      "aria-label": "Gameplay preview music volume",
    });
    const musicVolumeWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "music volume",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-music", "aria-hidden": "true" }),
        ),
      ),
      musicVolumeRange,
    );
    const hitsoundVolumeRange = el("input", {
      type: "range",
      class: `${wrapClass}__volume-range`,
      min: "0",
      max: "100",
      value: String(Math.round(readStoredHitsoundVolume() * 100)),
      step: "1",
      disabled: true,
      "aria-label": "Gameplay preview hitsounds volume",
    });
    const hitsoundVolumeWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "hitsound volume",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-drum", "aria-hidden": "true" }),
        ),
      ),
      hitsoundVolumeRange,
    );

    let offsetInputCommittedMs = readStoredOffsetMs();
    const offsetInput = el("input", {
      type: "text",
      class: `${wrapClass}__offset-input`,
      value: formatOffsetForField(offsetInputCommittedMs),
      inputMode: "numeric",
      disabled: true,
      "aria-label": "Gameplay preview audio offset in milliseconds",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
    });
    const offsetUnitEl = el(
      "span",
      { class: `${wrapClass}__offset-unit` },
      "ms",
    );

    function previewOffsetMsFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p !== null) return p;
      return offsetInputCommittedMs;
    }

    function commitOffsetFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p === null) {
        offsetInput.value = formatOffsetForField(offsetInputCommittedMs);
      } else {
        offsetInputCommittedMs = p;
        offsetInput.value = formatOffsetForField(p);
        writeStoredOffsetMs(offsetInputCommittedMs);
      }
      applyPreviewOffsetToEngine();
      if (sharedEngine && lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    }

    const offsetWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "offset",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-clock", "aria-hidden": "true" }),
        ),
      ),
      offsetInput,
      offsetUnitEl,
    );

    const seekRow = el(
      "div",
      { class: `${wrapClass}__seek` },
      previewTimeBtn,
      seekTimeDisplay,
      seekRange,
      musicVolumeWrap,
      hitsoundVolumeWrap,
      offsetWrap,
      statusEl,
    );

    const panel = el(
      "div",
      { class: `${wrapClass}__panel`, hidden: "" },
      unsupportedWrap,
      canvasHost,
      seekRow,
    );

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: `btn-osu-big btn-osu-big--beatmapset ${wrapClass}__toggle`,
      },
      el(
        "span",
        { class: "btn-osu-big__content" },
        el(
          "span",
          { class: "btn-osu-big__left" },
          el("span", { class: "btn-osu-big__text-top" }, "Beatmap Preview"),
        ),
        el(
          "span",
          { class: "btn-osu-big__icon" },
          el(
            "span",
            { class: "fa fa-fw" },
            el("span", { class: "fas fa-play-circle", "aria-hidden": "true" }),
          ),
        ),
      ),
    );

    row.appendChild(heading);
    row.appendChild(toggleBtn);
    row.appendChild(panel);

    function setStatus(text) {
      statusEl.textContent = text || "";
    }

    /**
     * @param {any} eng
     * @returns {number}
     */
    function getPreviewClipDurationMs(eng) {
      const a = eng?.previewAudio;
      if (
        a &&
        Number.isFinite(a.duration) &&
        a.duration > 0 &&
        a.readyState >= 1
      ) {
        return Math.min(PREVIEW_CLIP_MAX_MS, a.duration * 1000);
      }
      return PREVIEW_CLIP_MAX_MS;
    }

    /**
     * Whether `beatmapMs` maps into the loaded preview MP3 (osu! ~10s clip at PreviewTime).
     * @param {any} eng
     * @param {number} beatmapMs
     */
    function beatmapTimeOverlapsPreviewClip(eng, beatmapMs) {
      if (
        !eng?.getPreviewAudioTimeMsForBeatmapTime ||
        !Number.isFinite(beatmapMs)
      ) {
        return false;
      }
      const shifted = eng.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
      if (!Number.isFinite(shifted)) return false;
      const dur = getPreviewClipDurationMs(eng);
      return shifted >= 0 && shifted < dur;
    }

    /**
     * Play preview MP3 only inside the clip window; pause it elsewhere so transport stays on the
     * perf clock (silent map continuation). See BeatmapEngine.getTransportCurrentTimeMs.
     * @param {any} eng
     */
    function syncPreviewMusicToWindow(eng) {
      if (!eng?.previewAudio) return;
      const vol =
        Number.isFinite(eng.musicVolume) && eng.musicVolume >= 0
          ? eng.musicVolume
          : 0.3;
      let t;
      try {
        t = eng.getCurrentTime?.();
      } catch (_) {
        return;
      }
      if (!Number.isFinite(t)) return;

      const inside = beatmapTimeOverlapsPreviewClip(eng, t);

      if (!eng.isPlaying) {
        eng.previewAudio.volume = inside ? vol : 0;
        return;
      }

      if (inside) {
        eng.previewAudio.volume = vol;
        let shiftedSec;
        try {
          shiftedSec =
            Math.max(0, eng.getPreviewAudioTimeMsForBeatmapTime(t)) / 1000;
        } catch (_) {
          return;
        }
        const durSec = getPreviewClipDurationMs(eng) / 1000;
        const target = Math.min(shiftedSec, Math.max(0, durSec - 0.001));
        if (Math.abs(eng.previewAudio.currentTime - target) > 0.12) {
          eng.previewAudio.currentTime = target;
        }
        if (eng.previewAudio.paused && !eng.previewAudio.ended) {
          eng.previewAudio.play().catch(() => {});
        }
      } else {
        eng.previewAudio.volume = 0;
        eng.previewAudio.pause();
      }
    }

    function formatPreviewTimeMs(ms) {
      if (!Number.isFinite(ms) || ms < 0) return "0:00";
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      if (m >= 60) {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return `${h}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    function paintSeekTimeLabels(currentMs, durationMs) {
      seekTimeDisplay.textContent = `${formatPreviewTimeMs(currentMs)} / ${formatPreviewTimeMs(durationMs)}`;
    }

    function stopSeekAnimationLoop() {
      if (seekRafId) {
        cancelAnimationFrame(seekRafId);
        seekRafId = 0;
      }
    }

    function syncSeekUiFromEngine() {
      if (!sharedEngine || !lastLoadedKey || seekPointerActive) return;
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const maxMs = Math.max(1, Number.isFinite(duration) ? duration : 0);
        const t = sharedEngine.getCurrentTime?.() ?? 0;
        seekRange.max = String(maxMs);
        seekRange.value = String(
          Math.min(maxMs, Math.max(0, Number.isFinite(t) ? t : 0)),
        );
        paintSeekTimeLabels(t, duration);
      } catch (_) {
        void 0;
      }
    }

    function startSeekAnimationLoop() {
      stopSeekAnimationLoop();
      const tick = () => {
        if (!expanded) return;
        syncSeekUiFromEngine();
        if (sharedEngine && lastLoadedKey) {
          syncPreviewMusicToWindow(sharedEngine);
        }
        seekRafId = requestAnimationFrame(tick);
      };
      seekRafId = requestAnimationFrame(tick);
    }

    function applySeekFromInput() {
      if (!sharedEngine || seekRange.disabled) return;
      const ms = Number(seekRange.value);
      if (!Number.isFinite(ms)) return;
      try {
        sharedEngine.setCurrentTime?.(ms);
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
        void 0;
      }
    }

    /** @param {number} deltaMs */
    function seekByDeltaMs(deltaMs) {
      if (!sharedEngine || seekRange.disabled || !lastLoadedKey) return;
      let t = 0;
      let duration = 0;
      try {
        t = sharedEngine.getCurrentTime?.() ?? 0;
        duration = sharedEngine.getDuration?.() ?? 0;
      } catch (_) {
        return;
      }
      const maxMs = Math.max(0, Number.isFinite(duration) ? duration : 0);
      if (maxMs <= 0) return;
      const next = Math.min(
        maxMs,
        Math.max(0, (Number.isFinite(t) ? t : 0) + deltaMs),
      );
      try {
        sharedEngine.setCurrentTime?.(next);
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
        void 0;
      }
    }

    /**
     * Space: play/pause. ArrowLeft/ArrowRight: ±1s seek.
     * Volume sliders keep native arrow behavior; Jump to preview keeps Space on the button.
     * @param {KeyboardEvent} ev
     */
    function onPreviewPanelKeydown(ev) {
      if (
        !expanded ||
        panel.hidden ||
        !lastLoadedKey ||
        seekRange.disabled ||
        busy
      ) {
        return;
      }
      const t = ev.target;
      if (!(t instanceof Node) || !panel.contains(t)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

      const key = ev.key;
      const isArrow = key === "ArrowLeft" || key === "ArrowRight";
      const isPlayKey = key === " " || key === "Enter" || key === "Spacebar";

      if (isArrow) {
        if (
          t === musicVolumeRange ||
          t === hitsoundVolumeRange ||
          t === offsetInput
        ) {
          return;
        }
        ev.preventDefault();
        seekByDeltaMs(key === "ArrowLeft" ? -1000 : 1000);
        return;
      }

      if (isPlayKey) {
        if (t instanceof HTMLButtonElement && t !== canvasHost) return;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
          return;
        }
        ev.preventDefault();
        togglePlaybackFromCanvas();
      }
    }

    /** Seek transport to the .osu PreviewTime (site preview MP3 aligns from there). */
    function jumpToBeatmapPreviewTime() {
      if (!sharedEngine || seekRange.disabled) return;
      try {
        if (typeof sharedEngine.seekToPreview === "function") {
          sharedEngine.seekToPreview();
        } else {
          const ptm = Number(sharedEngine.previewTimeMs);
          sharedEngine.setCurrentTime?.(
            Number.isFinite(ptm) ? Math.max(0, ptm) : 0,
          );
        }
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
        void 0;
      }
    }

    function previewMusicVolumeFromSlider() {
      const v = Number(musicVolumeRange.value) / 100;
      if (!Number.isFinite(v)) return 0.3;
      return Math.min(1, Math.max(0, v));
    }

    function previewHitsoundVolumeFromSlider() {
      const v = Number(hitsoundVolumeRange.value) / 100;
      if (!Number.isFinite(v)) return 0.3;
      return Math.min(1, Math.max(0, v));
    }

    function applyPreviewMusicVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = previewMusicVolumeFromSlider();
      try {
        if (typeof sharedEngine.setMusicVolume === "function") {
          sharedEngine.setMusicVolume(vol);
        } else {
          sharedEngine.musicVolume = vol;
        }
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewHitsoundVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = previewHitsoundVolumeFromSlider();
      try {
        if (typeof sharedEngine.setHitsoundVolume === "function") {
          sharedEngine.setHitsoundVolume(vol);
        } else {
          sharedEngine.hitsoundVolume = vol;
          sharedEngine.hitsoundPlayer?.setVolume?.(vol);
        }
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewOffsetToEngine() {
      if (!sharedEngine || typeof sharedEngine.setAudioOffsetMs !== "function") {
        return;
      }
      try {
        sharedEngine.setAudioOffsetMs(
          actualAudioOffsetMsFromDisplay(previewOffsetMsFromInput()),
        );
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewVolumesToEngine() {
      applyPreviewMusicVolumeToEngine();
      applyPreviewHitsoundVolumeToEngine();
      applyPreviewOffsetToEngine();
    }

    function setSeekUiEnabled(on) {
      seekRange.disabled = !on;
      musicVolumeRange.disabled = !on;
      hitsoundVolumeRange.disabled = !on;
      offsetInput.disabled = !on;
      if (!on) {
        seekRange.max = "1";
        seekRange.value = "0";
        paintSeekTimeLabels(0, 0);
      }
    }

    function updateCanvasPlayStateAria() {
      if (!sharedEngine || !lastLoadedKey || seekRange.disabled) return;
      try {
        const playing = !!sharedEngine.isPlaying;
        canvasHost.setAttribute(
          "aria-label",
          playing ? "Pause gameplay preview" : "Play gameplay preview",
        );
        canvasHost.setAttribute("aria-pressed", playing ? "true" : "false");
      } catch (_) {
        void 0;
      }
    }

    function setPreviewControlsEnabled(on) {
      setSeekUiEnabled(on);
      previewTimeBtn.disabled = !on;
      canvasHost.classList.toggle(`${wrapClass}__canvas-host--disabled`, !on);
      canvasHost.tabIndex = on ? 0 : -1;
      if (!on) {
        canvasHost.setAttribute("aria-label", "Play gameplay preview");
        canvasHost.removeAttribute("aria-pressed");
      } else {
        updateCanvasPlayStateAria();
      }
    }

    function togglePlaybackFromCanvas() {
      if (
        !sharedEngine ||
        !lastLoadedKey ||
        seekRange.disabled ||
        busy ||
        canvasHost.classList.contains(`${wrapClass}__canvas-host--disabled`)
      ) {
        return;
      }
      try {
        if (sharedEngine.isPlaying) {
          sharedEngine.pause?.();
        } else {
          sharedEngine.play?.({
            enableAudio: true,
            enableHitsounds: true,
          });
          syncPreviewMusicToWindow(sharedEngine);
        }
        updateCanvasPlayStateAria();
        flashTransportOverlay(!!sharedEngine.isPlaying);
      } catch (_) {
        void 0;
      }
    }

    function invalidateLoadState() {
      lastLoadedKey = "";
      setPreviewControlsEnabled(false);
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
    }

    async function ensureEngine() {
      return acquireSharedEngine(engineSlot);
    }

    function currentLoadKey() {
      const id = getBeatmapId();
      return id ? `${id}` : "";
    }

    async function loadCurrentBeatmap() {
      if (!pathRe.test(location.pathname)) return;
      if (!expanded) return;

      const ruleset = (getRuleset() || "osu").toLowerCase();
      if (ruleset !== "osu") {
        panel.classList.add(`${wrapClass}__panel--unsupported`);
        lastLoadedKey = "";
        setPreviewControlsEnabled(false);
        setStatus("");
        try {
          sharedEngine?.pause?.();
        } catch (_) {
          void 0;
        }
        destroySharedEngineHard();
        acquireMutex = Promise.resolve();
        revokeBeatmapCoverObjectUrl();
        busy = false;
        return;
      }

      panel.classList.remove(`${wrapClass}__panel--unsupported`);

      const beatmapId = getBeatmapId();
      if (!beatmapId) {
        setStatus("No difficulty selected.");
        invalidateLoadState();
        return;
      }

      const data = readBeatmapsetJson();
      const previewAudio = absoluteUrl(data?.preview_url);
      const bg =
        data?.id != null
          ? `https://assets.ppy.sh/beatmaps/${data.id}/covers/fullsize.jpg`
          : "";

      const key = currentLoadKey();
      if (sharedEngine && lastLoadedKey === key) {
        if (!expanded) return;
        placeSharedEngineRoot(engineSlot);
        setStatus("");
        setPreviewControlsEnabled(true);
        applyPreviewVolumesToEngine();
        syncSeekUiFromEngine();
        updateCanvasPlayStateAria();
        return;
      }

      busy = true;
      setStatus("Loading…");
      setPreviewControlsEnabled(false);

      try {
        const osuText = await fetchOsuFileText(beatmapId);
        if (!expanded || !pathRe.test(location.pathname)) return;
        const eng = await ensureEngine();
        eng.pause();
        const bgAbs = absoluteUrl(bg);
        const bgObjectUrl = bgAbs
          ? await fetchBeatmapCoverObjectUrl(bgAbs)
          : "";
        await eng.loadBeatmap({
          osuText,
          audioUrl: previewAudio || undefined,
          backgroundUrl: bgObjectUrl || undefined,
        });
        if (!expanded || !pathRe.test(location.pathname)) {
          invalidateLoadState();
          return;
        }
        lastLoadedKey = key;
        setStatus("");
        setPreviewControlsEnabled(true);
        applyPreviewVolumesToEngine();
        syncSeekUiFromEngine();
        updateCanvasPlayStateAria();
      } catch (e) {
        setStatus(
          e instanceof Error ? e.message : "Could not load this difficulty.",
        );
        invalidateLoadState();
      } finally {
        busy = false;
      }
    }

    seekRange.addEventListener("pointerdown", (ev) => {
      seekPointerActive = true;
      try {
        seekRange.setPointerCapture(ev.pointerId);
      } catch (_) {
        void 0;
      }
    });
    seekRange.addEventListener("pointerup", (ev) => {
      seekPointerActive = false;
      try {
        seekRange.releasePointerCapture(ev.pointerId);
      } catch (_) {
        void 0;
      }
      applySeekFromInput();
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("pointercancel", () => {
      seekPointerActive = false;
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("input", () => {
      applySeekFromInput();
      if (!sharedEngine || !lastLoadedKey || seekRange.disabled) return;
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const ms = Number(seekRange.value);
        if (Number.isFinite(ms) && Number.isFinite(duration)) {
          paintSeekTimeLabels(ms, duration);
        }
      } catch (_) {
        void 0;
      }
    });
    seekRange.addEventListener("change", () => {
      applySeekFromInput();
      syncSeekUiFromEngine();
    });

    musicVolumeRange.addEventListener("input", () => {
      applyPreviewMusicVolumeToEngine();
    });
    musicVolumeRange.addEventListener("change", () => {
      writeStoredMusicVolume(previewMusicVolumeFromSlider());
    });
    hitsoundVolumeRange.addEventListener("input", () => {
      applyPreviewHitsoundVolumeToEngine();
    });
    hitsoundVolumeRange.addEventListener("change", () => {
      writeStoredHitsoundVolume(previewHitsoundVolumeFromSlider());
    });
    offsetInput.addEventListener("input", () => {
      applyPreviewOffsetToEngine();
      if (sharedEngine && lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    });
    offsetInput.addEventListener("blur", () => {
      commitOffsetFromInput();
    });
    offsetInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      commitOffsetFromInput();
    });

    canvasHost.addEventListener("click", (ev) => {
      // Only odd `detail` (1st, 3rd, …): double-click plays once; triple-click can play-pause-play.
      if ((ev.detail & 1) !== 1) return;
      togglePlaybackFromCanvas();
    });
    panel.addEventListener("keydown", onPreviewPanelKeydown);

    toggleBtn.addEventListener("click", async () => {
      expanded = !expanded;
      // `hidden` is boolean; `""`/`null` coerce to false and leave the panel visible.
      panel.hidden = !expanded;
      const top = toggleBtn.querySelector(".btn-osu-big__text-top");
      if (top) {
        top.textContent = expanded ? "Hide beatmap preview" : "Beatmap Preview";
      }
      if (expanded) {
        previewContextKey = previewContextKeyFromPage();
        startContextPoll();
        startSeekAnimationLoop();
        if (!busy) {
          await loadCurrentBeatmap();
        }
      } else {
        stopContextPoll();
        previewContextKey = "";
        panel.classList.remove(`${wrapClass}__panel--unsupported`);
        stopSeekAnimationLoop();
        try {
          sharedEngine?.pause?.();
        } catch (_) {
          void 0;
        }
      }
    });

    previewTimeBtn.addEventListener("click", () => {
      jumpToBeatmapPreviewTime();
    });

    window.addEventListener("hashchange", onPossiblePreviewContextChange, {
      passive: true,
    });
    window.addEventListener("popstate", onPossiblePreviewContextChange, {
      passive: true,
    });

    return {
      dispose: () => {
        stopContextPoll();
        window.removeEventListener("hashchange", onPossiblePreviewContextChange);
        window.removeEventListener("popstate", onPossiblePreviewContextChange);
        panel.removeEventListener("keydown", onPreviewPanelKeydown);
        stopSeekAnimationLoop();
        clearTransportFlashTimer();
        transportOverlay.classList.remove(
          `${wrapClass}__transport-overlay--visible`,
        );
        revokeBeatmapCoverObjectUrl();
        parkSharedEngineRoot();
        row.remove();
        styles.remove();
      },
      /** @returns {HTMLElement} */
      getRow: () => row,
    };
  }

  return {
    loadBeatmapEngineClass,
    fetchOsuFileText,
    mountBeatmapsetInfoPreview,
  };
})();

/* ── src/utils/beatmap-card-extra.js ── */
/**
 * Extra lines on `.beatmapset-panel`: data only from page JSON / site `fetch` (no Expert+ API calls).
 * Profile beatmap tabs: initial data from `GET /users/{id}/extra-pages/beatmaps?mode=…` (section
 * buckets with `items`). **“Load more”** uses `GET /users/{id}/beatmapsets/{type}?limit=…&offset=…`
 * (same for `/api/v2/users/{id}/beatmapsets/{type}`). osu-web `UsersController::beatmapsets` types:
 * `favourite`, `ranked`, `loved`, `guest`, `nominated`, `graveyard`, `pending`, `most_played`, plus
 * deprecated `ranked_and_approved` → ranked and `unranked` → pending. Response is a JSON array
 * (beatmapsets, or playcounts for `most_played`) — hooked via fetch/XHR on the **page** window
 * (`unsafeWindow` under Tampermonkey); sandbox `window` XHR/fetch does not see osu’s jQuery.ajax.
 */

/* global unsafeWindow */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapCardExtra = (() => {
  const { el, manageStyle } = OsuExpertPlus.dom;

  /**
   * Tampermonkey isolates userscripts; osu-web’s `$.ajax` uses the page’s XMLHttpRequest.
   * @returns {Window & typeof globalThis}
   */
  function pageWin() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {
      void 0;
    }
    return window;
  }

  const STYLE_ID = "osu-expertplus-beatmap-card-extra-css";
  const BLOCK_CLASS = "oep-beatmap-card-extra";
  /** Per-mode star range after `.beatmapset-panel__extra-item--dots` (non-hover). */
  const STAR_RANGE_CLASS = "oep-beatmap-card-extra__star-range";
  /** Reserved row between artist and mapper; always same min height. */
  const SOURCE_SLOT_CLASS = "oep-beatmap-card-extra__source-slot";
  /** Set to beatmapset id when done, or "loading" while fetching. */
  const PANEL_STATE_ATTR = "data-oep-card-extra";
  /** Bumped whenever cache ingest runs; panel re-renders when this differs from the epoch stored on the panel. */
  const PANEL_CACHE_EPOCH_ATTR = "data-oep-card-extra-epoch";
  /** Present when source + BPM/length (extra metadata) was applied for current epoch. */
  const PANEL_RENDERED_META_ATTR = "data-oep-card-extra-meta";
  /** Present when star range chips were applied for current epoch. */
  const PANEL_RENDERED_STARS_ATTR = "data-oep-card-extra-stars";

  const style = manageStyle(
    STYLE_ID,
    `
    .beatmapset-panel:has(.${BLOCK_CLASS}),
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}),
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) {
      height: auto !important;
      min-height: var(--panel-height);
      overflow: visible;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__content {
      height: auto !important;
      min-height: var(--panel-height);
      align-items: stretch;
      overflow: visible;
      position: relative;
      z-index: 1;
      isolation: isolate;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__menu-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__menu-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__menu-container {
      align-self: stretch;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-col--info,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-col--info,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-col--info {
      align-self: stretch;
    }
    /* Cover link is a sibling before __content (abs. over the whole card). In-flow height comes only
       from __content; subpixel layout vs the panel translateZ(0) layer can show 1–2px of panel
       background at the rounded bottom. Match card radius, clip children, composited layer. */
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-container {
      top: 0 !important;
      bottom: 0 !important;
      height: auto !important;
      min-height: var(--panel-height);
      border-radius: inherit;
      overflow: hidden;
      transform: translateZ(0);
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__info,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__info {
      overflow: visible;
      align-self: stretch;
    }

    /* API source lives in our slot; hide osu’s row so we don’t get two lines. */
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info-row--source {
      display: none !important;
    }

    /* Match osu --source row; single line with ellipsis (flex min-width:0 so truncation works). */
    .beatmapset-panel__info-row.${SOURCE_SLOT_CLASS} {
      color: hsl(var(--hsl-c2));
      font-weight: 700;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-slot-line {
      box-sizing: border-box;
      flex: 1 1 0;
      min-width: 0;
      max-width: 100%;
      min-height: 1.35em;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-placeholder {
      display: inline-block;
    }

    /* Flush with neighbouring .beatmapset-panel__info-row (no extra band above BPM/length). */
    .${BLOCK_CLASS} {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      flex-shrink: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    .${BLOCK_CLASS}__source-text {
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 86%));
    }
    /* BPM / length: inherit font from panel; tune colour, spacing, shadow, truncation. */
    .${BLOCK_CLASS}__meta {
      margin: 0;
      padding: 0;
      max-width: 100%;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.03em;
      opacity: 0.9;
      color: hsl(var(--hsl-c2, 333 60% 68%));
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Max SR per mode: wrapper + one pill (spectrum by highest difficulty in that mode). */
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots .${STAR_RANGE_CLASS} {
      margin-left: 0.45em;
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: 0.2em;
      flex-shrink: 0;
      white-space: nowrap;
      line-height: 1;
      font-size: max(10px, 0.82em);
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      padding: 0.2em 0.62em;
      min-height: 14px;
      border-radius: 10000px;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      border: none;
      flex-shrink: 0;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-inner {
      display: inline-flex;
      align-items: stretch;
      flex-wrap: nowrap;
      column-gap: 0.1em;
      line-height: 1;
      color: inherit;
      min-width: 0;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-up {
      font-size: 0.58em;
      line-height: 1;
      color: inherit;
      opacity: 0.92;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-up::before {
      display: block;
      line-height: 1;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-icon {
      font-size: 0.72em;
      line-height: 1;
      color: inherit;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-icon::before {
      display: block;
      line-height: 1;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-val {
      font-variant-numeric: tabular-nums;
      color: inherit;
      flex-shrink: 0;
      line-height: 1;
      display: flex;
      align-items: center;
    }
  `,
  );

  /** @type {Map<string, object>} */
  const cache = new Map();

  /** Debounced refresh after cache ingest (fetch hook or json-beatmaps). Set by `start()`. */
  let scheduleAfterIngest = () => {};

  /** Incremented on each ingest that writes to `cache`, so panels re-apply metadata when site data updates. */
  let cacheEpoch = 0;

  /** Bumped when a new `scheduleAllPanels` run starts; stale rAF chunks exit without work. */
  let schedulePanelsToken = 0;

  /** Max `.beatmapset-panel` processed per frame so toggles / MO don’t freeze the main thread. */
  const PANEL_SCHEDULE_CHUNK = 28;

  function touchCacheFromIngest() {
    cacheEpoch++;
    scheduleAfterIngest();
  }

  /**
   * Merge beatmapset objects from `…/extra-pages/beatmaps` into `cache` (keyed by set id).
   * Payload shape: each top-level value with `.items` is treated as a section bucket (ranked, loved, …).
   * @param {unknown} json
   */
  function ingestExtraPagesBeatmapsPayload(json) {
    if (!json || typeof json !== "object") {
      return;
    }
    let added = false;
    for (const key of Object.keys(
      /** @type {Record<string, unknown>} */ (json),
    )) {
      const bucket = /** @type {Record<string, unknown>} */ (json)[key];
      if (!bucket || typeof bucket !== "object") continue;
      const items = bucket.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item && item.id != null) {
          cache.set(String(item.id), item);
          added = true;
        }
      }
    }
    if (added) touchCacheFromIngest();
  }

  /**
   * @param {unknown} item
   * @returns {boolean}
   */
  function cacheBeatmapsetFromListItem(item) {
    if (!item || typeof item !== "object") return false;
    const nested = /** @type {Record<string, unknown>} */ (item).beatmapset;
    if (nested && typeof nested === "object" && nested.id != null) {
      cache.set(String(nested.id), nested);
      return true;
    }
    if (/** @type {Record<string, unknown>} */ (item).id != null) {
      cache.set(String(item.id), item);
      return true;
    }
    return false;
  }

  /**
   * `GET /users/{id}/beatmapsets/{type}` (profile “load more”) returns a JSON **array** of
   * beatmapsets, or `{ beatmapsets: [...] }`. `most_played` entries may nest under `.beatmapset`.
   * @param {unknown} json
   */
  function ingestUserBeatmapsetsPaginatedPayload(json) {
    if (json == null) return;
    /** @type {unknown[]|null} */
    let list = null;
    if (Array.isArray(json)) list = json;
    else if (typeof json === "object") {
      const b = /** @type {Record<string, unknown>} */ (json).beatmapsets;
      if (Array.isArray(b)) list = b;
    }
    if (!list) return;
    let added = false;
    for (const item of list) {
      if (cacheBeatmapsetFromListItem(item)) added = true;
    }
    if (added) touchCacheFromIngest();
  }

  /**
   * `/beatmapsets/search` and `/api/v2/beatmapsets/search` return `{ beatmapsets: [...] }`.
   * @param {unknown} json
   */
  function ingestBeatmapsetsSearchPayload(json) {
    if (!json || typeof json !== "object") {
      return;
    }
    const list = /** @type {Record<string, unknown>} */ (json).beatmapsets;
    if (!Array.isArray(list)) {
      return;
    }
    let added = false;
    for (const item of list) {
      if (item && item.id != null) {
        cache.set(String(item.id), item);
        added = true;
      }
    }
    if (added) touchCacheFromIngest();
  }

  /**
   * @param {string} s
   * @returns {string}
   */
  function shortHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
  }

  /**
   * Initial listing data: `<script id="json-beatmaps" type="application/json">`.
   * Re-parses when the script body changes (Turbo / in-place updates); avoid a one-shot flag.
   *
   * SPA navigations often fill this tag by updating the script’s text node. The document-level
   * `MutationObserver` in `start()` only uses `childList`/`subtree`, so those text updates do not
   * run `ingestFromJsonBeatmapsScript` unless we observe this node with `characterData: true`.
   */
  function ingestFromJsonBeatmapsScript() {
    const n = document.getElementById("json-beatmaps");
    if (!n?.textContent) {
      return;
    }
    const raw = n.textContent.trim();
    const sig = `${raw.length}:${shortHash(raw)}`;
    if (n.getAttribute("data-oep-beatmaps-sig") === sig) {
      return;
    }
    try {
      ingestBeatmapsetsSearchPayload(JSON.parse(raw));
      n.setAttribute("data-oep-beatmaps-sig", sig);
    } catch (_) {
      void 0;
    }
  }

  /**
   * @param {string} url
   */
  function isUsersExtraPagesBeatmapsUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/users\/\d+\/extra-pages\/beatmaps\b/.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  /**
   * Web: `/users/{id}/beatmapsets/{type}` (`type` = favourite, ranked, loved, guest, nominated,
   * graveyard, pending, most_played, ranked_and_approved, unranked — see osu-web UsersController).
   * @param {string} url
   */
  function isUsersWebBeatmapsetsTypeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  /**
   * API v2: `/api/v2/users/{id}/beatmapsets/{type}`.
   * @param {string} url
   */
  function isApiV2UsersBeatmapsetsTypeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/api\/v2\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(
        u.pathname,
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {string} url
   */
  function isBeatmapsetsSearchUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/beatmapsets\/search\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {string} url
   */
  function isApiV2BeatmapsetsSearchUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/api\/v2\/beatmapsets\/search\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {Request|string} input
   */
  function fetchInputUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input === "object" && "url" in input)
      return String(/** @type {Request} */ (input).url);
    return "";
  }

  /**
   * @param {string} id
   * @param {number} maxMs
   * @param {number} stepMs
   * @returns {Promise<object|undefined>}
   */
  function waitForCachedBeatmapset(id, maxMs, stepMs) {
    const hit = cache.get(id);
    if (hit) return Promise.resolve(hit);
    const deadline = Date.now() + maxMs;
    return new Promise((resolve) => {
      const tick = () => {
        const h = cache.get(id);
        if (h) {
          resolve(h);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(undefined);
          return;
        }
        window.setTimeout(tick, stepMs);
      };
      tick();
    });
  }

  /** When true, `processPanel` waits longer for profile extra-pages before giving up. */
  const profileExtraState = { waitForExtraPages: false };

  /** One-shot same-origin prefetch if hooks missed the site’s first request (script load timing). */
  let profileExtraPrefetchStarted = false;

  /**
   * On SPA navigation to /beatmapsets, osu-web fires the initial search fetch before `pushState`,
   * so our hook is never installed in time to intercept it. Guard against double-fetching.
   */
  let listingSearchPrefetchStarted = false;

  /** ms to wait for site JSON/fetch to populate `cache` after panels appear. */
  const PROFILE_EXTRA_CACHE_WAIT_MS = 2000;
  const LISTING_CACHE_WAIT_MS = 1500;
  const CACHE_POLL_MS = 40;

  /**
   * @param {unknown} sec
   * @returns {string}
   */
  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  /**
   * @param {object} data
   * @returns {{ bpmStr: string|null, lengthStr: string|null }}
   */
  function bpmLengthFromSet(data) {
    const maps = data?.beatmaps;
    if (!Array.isArray(maps) || maps.length === 0)
      return { bpmStr: null, lengthStr: null };

    const bpmSet = new Set();
    for (const m of maps) {
      const b = Number(m?.bpm);
      if (Number.isFinite(b)) bpmSet.add(b);
    }
    const bpms = [...bpmSet].sort((a, b) => a - b);
    let bpmStr = null;
    if (bpms.length === 1) bpmStr = `${bpms[0]} BPM`;
    else if (bpms.length > 1)
      bpmStr = `${bpms[0]}–${bpms[bpms.length - 1]} BPM`;

    const lengths = maps
      .map((m) => Number(m?.total_length))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const longest = lengths.length ? Math.max(...lengths) : null;
    const lengthStr = longest != null ? formatDuration(longest) : null;
    return { bpmStr, lengthStr };
  }

  /** Truncate toward zero at 2 decimal places (no rounding up). */
  function formatStarShort(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    const t = (Math.floor(Math.abs(x) * 100) / 100) * Math.sign(x);
    if (Number.isInteger(t)) return String(t);
    let s = t.toFixed(2);
    if (s.endsWith("0")) s = s.slice(0, -1);
    if (s.endsWith(".")) s = s.slice(0, -1);
    return s;
  }

  /**
   * One SR pill (FA up-chevron, star, value) with osu difficulty bg/text colours.
   * @param {{ getDiffColour: (n: number) => string, getDiffTextColour: (n: number) => string }|null|undefined} dc
   * @param {number} sr
   * @returns {HTMLElement|null}
   */
  function buildStarChip(dc, sr) {
    const text = formatStarShort(sr);
    if (!text) return null;
    const bg = dc?.getDiffColour(sr) ?? "hsl(var(--hsl-b6))";
    const fg = dc?.getDiffTextColour(sr) ?? "hsl(var(--hsl-l1))";
    return el(
      "span",
      {
        class: `${STAR_RANGE_CLASS}__chip`,
        style: { backgroundColor: bg, color: fg },
      },
      el(
        "span",
        { class: `${STAR_RANGE_CLASS}__chip-inner` },
        el("span", {
          class: `fas fa-chevron-up ${STAR_RANGE_CLASS}__chip-up`,
          "aria-hidden": "true",
        }),
        el("span", {
          class: `fas fa-star ${STAR_RANGE_CLASS}__chip-icon`,
          "aria-hidden": "true",
        }),
        el("span", { class: `${STAR_RANGE_CLASS}__chip-val` }, text),
      ),
    );
  }

  /**
   * @param {object} data  beatmapset JSON
   * @returns {Map<string, number[]>}
   */
  function ratingsByRulesetFromSet(data) {
    /** @type {Map<string, number[]>} */
    const map = new Map();
    const maps = data?.beatmaps;
    if (!Array.isArray(maps)) return map;
    for (const b of maps) {
      const mode = b?.mode;
      if (typeof mode !== "string") continue;
      const r = Number(b?.difficulty_rating);
      if (!Number.isFinite(r)) continue;
      if (!map.has(mode)) map.set(mode, []);
      map.get(mode).push(r);
    }
    return map;
  }

  /**
   * @param {object} data  beatmapset JSON
   * @returns {number}
   */
  function distinctModeCountFromSet(data) {
    const maps = data?.beatmaps;
    if (!Array.isArray(maps)) return 0;
    const seen = new Set();
    for (const b of maps) {
      if (typeof b?.mode === "string") seen.add(b.mode);
    }
    return seen.size;
  }

  /**
   * @param {Element} item  `.beatmapset-panel__extra-item--dots`
   * @returns {string|null}  ruleset id e.g. osu
   */
  function parseRulesetFromDotsRow(item) {
    const icon = item.querySelector(
      ".beatmapset-panel__beatmap-icon i[class*='fa-extra-mode-']",
    );
    if (!icon) return null;
    const m = icon.className.match(
      /\bfa-extra-mode-(osu|taiko|fruits|mania)\b/,
    );
    return m ? m[1] : null;
  }

  /**
   * Highest star rating per mode row (visible without hovering the popup).
   * @param {Element} panel
   * @param {object} data
   */
  function mountStarRanges(panel, data) {
    const dc = OsuExpertPlus.difficultyColours;
    const byMode = ratingsByRulesetFromSet(data);
    if (byMode.size === 0) return;
    if (distinctModeCountFromSet(data) >= 4) return;

    panel
      .querySelectorAll(".beatmapset-panel__extra-item--dots")
      .forEach((row) => {
        row.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
        const mode = parseRulesetFromDotsRow(row);
        if (!mode) return;
        const ratings = byMode.get(mode);
        if (!ratings?.length) return;
        const nums = ratings.filter((n) => Number.isFinite(n));
        if (!nums.length) return;
        const hi = Math.max(...nums);
        const hiStr = formatStarShort(hi);
        if (!hiStr) return;

        const wrap = el("span", { class: STAR_RANGE_CLASS });
        const chip = buildStarChip(dc, hi);
        if (!chip) return;
        wrap.appendChild(chip);
        row.appendChild(wrap);
      });
  }

  /**
   * @param {Element} panel
   * @returns {string|null}
   */
  function parseBeatmapsetId(panel) {
    const links = panel.querySelectorAll('a[href*="beatmapsets/"]');
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      try {
        const u = new URL(href, location.origin);
        const m = u.pathname.match(/^\/beatmapsets\/(\d+)/i);
        if (m) return m[1];
      } catch (_) {
        void 0;
      }
    }
    return null;
  }

  /**
   * @param {string} sourceText  trimmed API source (may be empty)
   * @returns {HTMLElement}
   */
  function buildSourceSlotRow(sourceText) {
    const inner =
      sourceText.length > 0
        ? el(
            "div",
            { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
            "from ",
            el("span", { class: `${BLOCK_CLASS}__source-text` }, sourceText),
          )
        : el(
            "div",
            { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
            el(
              "span",
              {
                class: `${BLOCK_CLASS}__source-placeholder`,
                "aria-hidden": "true",
              },
              "\u00a0",
            ),
          );

    return el(
      "div",
      {
        class: `beatmapset-panel__info-row ${SOURCE_SLOT_CLASS}`,
        "data-oep-card-extra-slot": "1",
      },
      inner,
    );
  }

  /**
   * Insert between artist row and mapper row (native --source hidden via CSS :has slot).
   * @param {Element} panel
   * @param {string} sourceTrimmed
   * @returns {boolean}
   */
  function mountSourceSlot(panel, sourceTrimmed) {
    const artist = panel.querySelector(".beatmapset-panel__info-row--artist");
    if (!artist) return false;
    artist.insertAdjacentElement("afterend", buildSourceSlotRow(sourceTrimmed));
    return true;
  }

  /**
   * BPM / length block after mapper, before stats.
   * @param {Element} panel
   * @returns {{ anchor: Element, mode: "after" | "append" }}
   */
  function insertTargetMeta(panel) {
    const mapperRow = panel.querySelector(
      ".beatmapset-panel__info-row--mapper",
    );
    if (mapperRow) return { anchor: mapperRow, mode: "after" };

    const sourceRow = panel.querySelector(
      ".beatmapset-panel__info-row--source",
    );
    if (sourceRow) return { anchor: sourceRow, mode: "after" };

    const artistRow = panel.querySelector(
      ".beatmapset-panel__info-row--artist",
    );
    if (artistRow) return { anchor: artistRow, mode: "after" };

    const info = panel.querySelector(".beatmapset-panel__info");
    if (info) return { anchor: info, mode: "append" };

    const legacyMapper = panel.querySelector(".beatmapset-panel__mapper");
    if (legacyMapper) return { anchor: legacyMapper, mode: "after" };
    const legacyArtist = panel.querySelector(".beatmapset-panel__artist");
    if (legacyArtist) return { anchor: legacyArtist, mode: "after" };
    const details = panel.querySelector(".beatmapset-panel__details");
    if (details) return { anchor: details, mode: "append" };

    return { anchor: panel, mode: "append" };
  }

  /**
   * @param {object} data
   * @returns {HTMLElement|null}
   */
  function buildMetaBlock(data) {
    const { bpmStr, lengthStr } = bpmLengthFromSet(data);
    const metaBits = [];
    if (bpmStr) metaBits.push(bpmStr);
    if (lengthStr) metaBits.push(lengthStr);
    if (!metaBits.length) return null;
    return el(
      "div",
      { class: BLOCK_CLASS },
      el("div", { class: `${BLOCK_CLASS}__meta` }, metaBits.join(" · ")),
    );
  }

  /**
   * @param {Element} panel
   */
  function stripInjections(panel) {
    panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
    panel.removeAttribute(PANEL_STATE_ATTR);
    panel.removeAttribute(PANEL_CACHE_EPOCH_ATTR);
    panel.removeAttribute(PANEL_RENDERED_META_ATTR);
    panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
  }

  /**
   * @param {Element} panel
   * @param {typeof OsuExpertPlus.settings} settings
   */
  async function processPanel(panel, settings) {
    const wantMeta = settings.isEnabled(settings.IDS.BEATMAP_CARD_EXTRA_INFO);
    const wantStars = settings.isEnabled(
      settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE,
    );
    if (!wantMeta && !wantStars) {
      return;
    }

    const id = parseBeatmapsetId(panel);
    if (!id) {
      return;
    }

    const state = panel.getAttribute(PANEL_STATE_ATTR);
    const renderedEpoch = panel.getAttribute(PANEL_CACHE_EPOCH_ATTR);
    const hasMeta = panel.getAttribute(PANEL_RENDERED_META_ATTR) === "1";
    const hasStars = panel.getAttribute(PANEL_RENDERED_STARS_ATTR) === "1";
    // Must match desired toggles: `(!wantMeta || hasMeta)` was always true when meta off, so stale
    // source/BPM stayed after turning off only one of two options.
    if (
      state === id &&
      renderedEpoch != null &&
      renderedEpoch === String(cacheEpoch) &&
      wantMeta === hasMeta &&
      wantStars === hasStars
    ) {
      return;
    }
    if (state === id) panel.removeAttribute(PANEL_STATE_ATTR);
    if (panel.getAttribute(PANEL_STATE_ATTR) === "loading") return;

    panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
    panel.removeAttribute(PANEL_RENDERED_META_ATTR);
    panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
    panel.setAttribute(PANEL_STATE_ATTR, "loading");

    let data = cache.get(id);
    if (!data) {
      const maxMs = profileExtraState.waitForExtraPages
        ? PROFILE_EXTRA_CACHE_WAIT_MS
        : LISTING_CACHE_WAIT_MS;
      data = await waitForCachedBeatmapset(id, maxMs, CACHE_POLL_MS);
    }

    if (!data) {
      if (document.body.contains(panel))
        panel.removeAttribute(PANEL_STATE_ATTR);
      return;
    }

    if (!document.body.contains(panel)) return;

    if (wantMeta) {
      const sourceTrimmed = String(data.source ?? "").trim();
      mountSourceSlot(panel, sourceTrimmed);

      const block = buildMetaBlock(data);
      if (block) {
        const { anchor, mode } = insertTargetMeta(panel);
        if (mode === "after") anchor.insertAdjacentElement("afterend", block);
        else anchor.appendChild(block);
      }
      panel.setAttribute(PANEL_RENDERED_META_ATTR, "1");
    }

    if (wantStars) {
      mountStarRanges(panel, data);
      panel.setAttribute(PANEL_RENDERED_STARS_ATTR, "1");
    }

    panel.setAttribute(PANEL_STATE_ATTR, id);
    panel.setAttribute(PANEL_CACHE_EPOCH_ATTR, String(cacheEpoch));
  }

  /**
   * @param {ParentNode} root
   * @param {typeof OsuExpertPlus.settings} settings
   */
  function clearAll(root, settings) {
    const on =
      settings.isEnabled(settings.IDS.BEATMAP_CARD_EXTRA_INFO) ||
      settings.isEnabled(settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE);
    root.querySelectorAll(".beatmapset-panel").forEach((panel) => {
      if (!on) stripInjections(panel);
    });
  }

  /**
   * @param {ParentNode} root
   * @param {typeof OsuExpertPlus.settings} settings
   */
  function scheduleAllPanels(root, settings) {
    const panels = Array.from(root.querySelectorAll(".beatmapset-panel"));
    if (panels.length === 0) {
      return;
    }
    const token = ++schedulePanelsToken;
    let index = 0;
    const step = () => {
      if (token !== schedulePanelsToken) {
        return;
      }
      const end = Math.min(index + PANEL_SCHEDULE_CHUNK, panels.length);
      while (index < end) {
        void processPanel(panels[index++], settings);
      }
      if (index < panels.length) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  /**
   * @param {string} url
   * @param {number} status
   * @param {string} responseText
   */
  function tryIngestFromNetworkJson(url, status, responseText) {
    if (status < 200 || status >= 300) return;
    let resolved;
    try {
      resolved = url.startsWith("http")
        ? url
        : new URL(url, location.origin).href;
    } catch (_) {
      return;
    }
    if (isUsersExtraPagesBeatmapsUrl(resolved)) {
      try {
        ingestExtraPagesBeatmapsPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    } else if (
      isUsersWebBeatmapsetsTypeUrl(resolved) ||
      isApiV2UsersBeatmapsetsTypeUrl(resolved)
    ) {
      try {
        ingestUserBeatmapsetsPaginatedPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    } else if (
      isBeatmapsetsSearchUrl(resolved) ||
      isApiV2BeatmapsetsSearchUrl(resolved)
    ) {
      try {
        ingestBeatmapsetsSearchPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    }
  }

  /**
   * osu-web often uses XMLHttpRequest for JSON; complements the `fetch` hook.
   * @returns {() => void}
   */
  /**
   * @param {() => boolean} wantIngest
   */
  function installXhrHook(wantIngest) {
    const w = pageWin();
    const Native = w.XMLHttpRequest;
    if (!Native) return () => {};

    function Patched() {
      const xhr = new Native();
      let reqUrl = "";
      const origOpen = xhr.open;
      xhr.open = function () {
        const u = arguments[1];
        reqUrl = typeof u === "string" ? u : String(u);
        return origOpen.apply(this, arguments);
      };
      xhr.addEventListener("load", function () {
        if (!wantIngest()) return;
        tryIngestFromNetworkJson(reqUrl, xhr.status, xhr.responseText);
      });
      return xhr;
    }

    Patched.prototype = Native.prototype;
    for (const k of [
      "UNSENT",
      "OPENED",
      "HEADERS_RECEIVED",
      "LOADING",
      "DONE",
    ]) {
      if (k in Native) Patched[k] = Native[k];
    }
    w.XMLHttpRequest = Patched;
    return () => {
      w.XMLHttpRequest = Native;
    };
  }

  /**
   * If the site already finished `extra-pages/beatmaps` before our hooks ran, load once with the
   * session cookie (same URL osu uses; not per-card API).
   */
  function startProfileExtraPagesPrefetchIfNeeded(wantIngest, nativeFetch) {
    if (!profileExtraState.waitForExtraPages) return;
    if (cache.size > 0) return;
    if (profileExtraPrefetchStarted) return;
    const m = location.pathname.match(/^\/users\/(\d+)/i);
    if (!m) return;
    const pw = pageWin();
    const doFetch =
      nativeFetch ||
      (typeof pw.fetch === "function" ? pw.fetch.bind(pw) : null);
    if (!doFetch) {
      return;
    }
    profileExtraPrefetchStarted = true;
    const userId = m[1];
    const mode = new URLSearchParams(location.search).get("mode") || "osu";
    const url = `/users/${userId}/extra-pages/beatmaps?mode=${encodeURIComponent(mode)}`;
    void (async () => {
      try {
        const r = await doFetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!wantIngest()) return;
        if (!r.ok) {
          return;
        }
        ingestExtraPagesBeatmapsPayload(await r.json());
      } catch (_) {
        void 0;
      }
    })();
  }

  /**
   * On SPA navigation to /beatmapsets, osu-web issues the initial search fetch as part of its own
   * routing — before calling pushState, and therefore before our hook is installed. Re-fetch the
   * first page ourselves so the cache is populated for already-visible panels.
   * @param {() => boolean} wantIngest
   * @param {typeof window.fetch | null} nativeFetch
   */
  function startListingSearchPrefetchIfNeeded(wantIngest, nativeFetch) {
    if (!wantIngest()) return;
    if (!/^\/beatmapsets(?:\/?)(?!\d)/i.test(location.pathname)) return;
    if (listingSearchPrefetchStarted) return;
    // If #json-beatmaps has content the page was SSR-rendered; first-page data is already ingested.
    const n = document.getElementById("json-beatmaps");
    if (n?.textContent?.trim()) return;
    const pw = pageWin();
    const doFetch =
      nativeFetch ||
      (typeof pw.fetch === "function" ? pw.fetch.bind(pw) : null);
    if (!doFetch) return;
    listingSearchPrefetchStarted = true;
    const params = new URLSearchParams(location.search);
    params.delete("cursor_string");
    const qs = params.toString();
    const url = `/beatmapsets/search${qs ? "?" + qs : ""}`;
    void (async () => {
      try {
        const r = await doFetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!wantIngest()) return;
        if (!r.ok) return;
        ingestBeatmapsetsSearchPayload(await r.json());
      } catch (_) {
        void 0;
      }
    })();
  }

  /**
   * @param {typeof OsuExpertPlus.settings} settings
   * @param {{ hookProfileExtraPages?: boolean }} [options]
   * @returns {() => void}
   */
  function start(settings, options = {}) {
    const ID_META = settings.IDS.BEATMAP_CARD_EXTRA_INFO;
    const ID_STARS = settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE;
    const wantIngest = () =>
      settings.isEnabled(ID_META) || settings.isEnabled(ID_STARS);
    let moDebounceId = 0;
    let moMaxWaitId = 0;
    const MO_DEBOUNCE_MS = 100;
    /** Ensures `run()` eventually fires when the subtree mutates continuously (React). */
    const MO_MAX_WAIT_MS = 450;
    let ingestPanelsId = 0;

    /** @type {MutationObserver|null} */
    let jsonBeatmapsMo = null;
    /** @type {Element|null} */
    let jsonBeatmapsObserved = null;
    let jsonBeatmapsTextMutDeb = 0;

    function disconnectJsonBeatmapsObserver() {
      window.clearTimeout(jsonBeatmapsTextMutDeb);
      jsonBeatmapsTextMutDeb = 0;
      try {
        jsonBeatmapsMo?.disconnect();
      } catch (_) {
        void 0;
      }
      jsonBeatmapsMo = null;
      jsonBeatmapsObserved = null;
    }

    function connectJsonBeatmapsObserver() {
      if (!wantIngest()) {
        disconnectJsonBeatmapsObserver();
        return;
      }
      const n = document.getElementById("json-beatmaps");
      if (!n) {
        disconnectJsonBeatmapsObserver();
        return;
      }
      if (jsonBeatmapsObserved === n && jsonBeatmapsMo) return;
      disconnectJsonBeatmapsObserver();
      jsonBeatmapsObserved = n;
      jsonBeatmapsMo = new MutationObserver(() => {
        if (!wantIngest()) return;
        window.clearTimeout(jsonBeatmapsTextMutDeb);
        jsonBeatmapsTextMutDeb = window.setTimeout(() => {
          jsonBeatmapsTextMutDeb = 0;
          ingestFromJsonBeatmapsScript();
          scheduleAfterIngest();
        }, 0);
      });
      jsonBeatmapsMo.observe(n, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    profileExtraState.waitForExtraPages =
      options.hookProfileExtraPages === true;
    profileExtraPrefetchStarted = false;
    listingSearchPrefetchStarted = false;

    /** @type {typeof window.fetch | null} */
    let origFetch = null;
    const uninstallXhrHook = installXhrHook(wantIngest);
    const pageContext = pageWin();

    if (typeof pageContext.fetch === "function") {
      origFetch = pageContext.fetch.bind(pageContext);
      pageContext.fetch = async function oepPatchedFetch(input, init) {
        const res = await origFetch(input, init);
        if (!wantIngest()) return res;
        try {
          const url = fetchInputUrl(input);
          if (!url || !res.ok) {
            return res;
          }
          if (isUsersExtraPagesBeatmapsUrl(url)) {
            void res
              .clone()
              .json()
              .then(ingestExtraPagesBeatmapsPayload)
              .catch(() => {});
          } else if (
            isUsersWebBeatmapsetsTypeUrl(url) ||
            isApiV2UsersBeatmapsetsTypeUrl(url)
          ) {
            void res
              .clone()
              .json()
              .then(ingestUserBeatmapsetsPaginatedPayload)
              .catch(() => {});
          } else if (
            isBeatmapsetsSearchUrl(url) ||
            isApiV2BeatmapsetsSearchUrl(url)
          ) {
            void res
              .clone()
              .json()
              .then(ingestBeatmapsetsSearchPayload)
              .catch(() => {});
          }
        } catch (_) {
          void 0;
        }
        return res;
      };
    }

    const run = () => {
      const on = wantIngest();
      if (on) style.inject();
      else style.remove();
      clearAll(document, settings);
      if (on) {
        ingestFromJsonBeatmapsScript();
        startProfileExtraPagesPrefetchIfNeeded(wantIngest, origFetch);
        startListingSearchPrefetchIfNeeded(wantIngest, origFetch);
        connectJsonBeatmapsObserver();
        scheduleAllPanels(document, settings);
      } else {
        disconnectJsonBeatmapsObserver();
      }
      syncPopupHighlightHeight();
      scheduleBeatmapsetsListingLayoutSync();
    };

    /** @type {ResizeObserver|null} */
    let beatmapsetsListingItemsRo = null;
    /** @type {Element|null} */
    let beatmapsetsListingItemsObserved = null;

    function detachBeatmapsetsListingItemsRo() {
      if (beatmapsetsListingItemsRo) {
        beatmapsetsListingItemsRo.disconnect();
        beatmapsetsListingItemsRo = null;
        beatmapsetsListingItemsObserved = null;
      }
    }

    function isBeatmapsetsListingIndexPage() {
      const p = location.pathname;
      return p === "/beatmapsets" || p === "/beatmapsets/";
    }

    /**
     * Listing uses a virtual list: the first child of `.beatmapsets__content` gets an inline
     * `height` from osu-web from row count × assumed row height. Extra card rows increase real
     * content height without updating that value, so the b5 page background shows past the block.
     */
    function syncBeatmapsetsListingOuterHeight(outer, items) {
      if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement)) return;
      const st = outer.getAttribute("style") || "";
      if (!/height\s*:\s*[\d.]+\s*px/i.test(st)) return;
      const cs = getComputedStyle(outer);
      const padY =
        (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const minOuter = Math.ceil(items.scrollHeight + padY);
      if (minOuter > outer.clientHeight + 0.5) {
        outer.style.height = `${minOuter}px`;
      }
    }

    function maybeAttachBeatmapsetsListingHeightObserver() {
      if (!wantIngest()) {
        detachBeatmapsetsListingItemsRo();
        return;
      }
      if (!isBeatmapsetsListingIndexPage()) {
        detachBeatmapsetsListingItemsRo();
        return;
      }
      const content = document.querySelector(".beatmapsets__content");
      const outer = content?.firstElementChild;
      const items = outer?.querySelector?.(".beatmapsets__items");
      if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement)) {
        detachBeatmapsetsListingItemsRo();
        return;
      }
      if (beatmapsetsListingItemsObserved === items && beatmapsetsListingItemsRo) {
        syncBeatmapsetsListingOuterHeight(outer, items);
        return;
      }
      detachBeatmapsetsListingItemsRo();
      beatmapsetsListingItemsObserved = items;
      beatmapsetsListingItemsRo = new ResizeObserver(() => {
        syncBeatmapsetsListingOuterHeight(outer, items);
      });
      beatmapsetsListingItemsRo.observe(items);
      syncBeatmapsetsListingOuterHeight(outer, items);
    }

    function scheduleBeatmapsetsListingLayoutSync() {
      if (!wantIngest()) {
        detachBeatmapsetsListingItemsRo();
        return;
      }
      if (!isBeatmapsetsListingIndexPage()) {
        detachBeatmapsetsListingItemsRo();
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          maybeAttachBeatmapsetsListingHeightObserver();
        });
      });
    }

    /**
     * osu-web's difficulty popup (`.beatmaps-popup`, rendered via Portal) draws a highlight border
     * using `::before { height: calc(100% + var(--panel-height)) }`. `--panel-height` is a fixed
     * CSS variable set on `.beatmaps-popup` itself, so it doesn't account for our injected rows.
     * Sync the popup's `--panel-height` to the actual rendered height of the hovered panel.
     */
    function syncPopupHighlightHeight() {
      const activePanel = document.querySelector(
        ".beatmapset-panel--beatmaps-popup-visible",
      );
      const popup = document.querySelector(".beatmaps-popup");
      if (!activePanel || !popup) return;
      const actual = /** @type {HTMLElement} */ (activePanel).offsetHeight;
      if (actual > 0) {
        popup.style.setProperty("--panel-height", actual + "px");
      }
    }

    /**
     * DOM mutations (including our injections) were calling full `run()` via MO, re-scanning every
     * panel and re-running ingest on a hot path. Only refresh listing JSON + panel pass.
     */
    const refreshAfterDomMutation = () => {
      if (!wantIngest()) {
        return;
      }
      connectJsonBeatmapsObserver();
      ingestFromJsonBeatmapsScript();
      scheduleAllPanels(document, settings);
      syncPopupHighlightHeight();
      scheduleBeatmapsetsListingLayoutSync();
    };

    const flushMoSchedule = () => {
      window.clearTimeout(moDebounceId);
      moDebounceId = 0;
      window.clearTimeout(moMaxWaitId);
      moMaxWaitId = 0;
      refreshAfterDomMutation();
    };

    /**
     * @param {MutationRecord[]} mutations
     */
    const scheduleFromMutationObserver = (mutations) => {
      if (!wantIngest()) {
        return;
      }
      // MutationObserver callbacks fire before the next browser paint, so syncing immediately here
      // corrects --panel-height on the popup before its opacity transition becomes visible (no flash).
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const el = /** @type {Element} */ (node);
          if (
            el.classList.contains("beatmaps-popup") ||
            el.querySelector(".beatmaps-popup")
          ) {
            syncPopupHighlightHeight();
            break;
          }
        }
      }
      window.clearTimeout(moDebounceId);
      moDebounceId = window.setTimeout(flushMoSchedule, MO_DEBOUNCE_MS);
      if (!moMaxWaitId) {
        moMaxWaitId = window.setTimeout(flushMoSchedule, MO_MAX_WAIT_MS);
      }
    };

    /**
     * Must not share the MO debounce timer: continuous DOM mutations can reset it forever and
     * block `run()` after XHR ingest (e.g. profile “load more”).
     */
    scheduleAfterIngest = () => {
      window.clearTimeout(ingestPanelsId);
      ingestPanelsId = window.setTimeout(() => {
        ingestPanelsId = 0;
        if (!wantIngest()) return;
        requestAnimationFrame(() => {
          if (!wantIngest()) return;
          scheduleAllPanels(document, settings);
          scheduleBeatmapsetsListingLayoutSync();
        });
      }, 0);
    };

    run();

    const unsubMeta = settings.onChange(ID_META, run);
    const unsubStars = settings.onChange(ID_STARS, run);
    const mo = new MutationObserver(scheduleFromMutationObserver);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(moDebounceId);
      window.clearTimeout(moMaxWaitId);
      window.clearTimeout(ingestPanelsId);
      disconnectJsonBeatmapsObserver();
      unsubMeta();
      unsubStars();
      mo.disconnect();
      profileExtraState.waitForExtraPages = false;
      profileExtraPrefetchStarted = false;
      listingSearchPrefetchStarted = false;
      scheduleAfterIngest = () => {};
      detachBeatmapsetsListingItemsRo();
      uninstallXhrHook();
      if (origFetch) pageContext.fetch = origFetch;
      style.remove();
      document.querySelectorAll(".beatmapset-panel").forEach((panel) => {
        stripInjections(panel);
      });
    };
  }

  return { start };
})();

/* ── src/utils/beatmap-card-stats.js ── */
/** Shared beatmap card UI: always-visible stats + full play/favourite numbers. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapCardStats = (() => {
  const ALWAYS_SHOW_STYLE_ID = "osu-expertplus-beatmap-card-always-stats";
  const ALWAYS_SHOW_CSS = `
    .beatmapset-panel { --stats-opacity: 1 !important; }
  `;

  const FULL_BEATMAP_STATS_ITEM_ATTR = "data-oep-full-stat-item";
  const FULL_BEATMAP_STATS_VALUE_ATTR = "data-oep-full-stat-abbrev";

  function beatmapStatTooltipSource(item) {
    return (
      item.getAttribute("data-orig-title") || item.getAttribute("title") || ""
    );
  }

  function parseBeatmapStatCount(tooltip, kind) {
    const re =
      kind === "play" ? /Playcount:\s*([\d,]+)/i : /Favourites:\s*([\d,]+)/i;
    const m = tooltip.match(re);
    if (!m) return null;
    const n = parseInt(String(m[1]).replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function formatBeatmapStatCount(n) {
    return n.toLocaleString("en-US");
  }

  /**
   * @param {ParentNode} scope
   */
  function applyFullBeatmapStatNumbers(scope) {
    const items = scope.querySelectorAll(
      ".beatmapset-panel__stats-item--play-count, .beatmapset-panel__stats-item--favourite-count",
    );
    items.forEach((item) => {
      if (item.hasAttribute(FULL_BEATMAP_STATS_ITEM_ATTR)) return;

      const isPlay = item.classList.contains(
        "beatmapset-panel__stats-item--play-count",
      );
      const n = parseBeatmapStatCount(
        beatmapStatTooltipSource(item),
        isPlay ? "play" : "favourite",
      );
      if (n === null) return;

      const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
      const valSpan = icon?.nextElementSibling;
      if (!valSpan || valSpan.tagName !== "SPAN") return;

      valSpan.setAttribute(FULL_BEATMAP_STATS_VALUE_ATTR, valSpan.textContent);
      valSpan.textContent = formatBeatmapStatCount(n);
      item.setAttribute(FULL_BEATMAP_STATS_ITEM_ATTR, "1");
    });
  }

  /**
   * @param {ParentNode} scope
   */
  function revertFullBeatmapStatNumbers(scope) {
    scope
      .querySelectorAll(
        `.beatmapset-panel__stats-item[${FULL_BEATMAP_STATS_ITEM_ATTR}]`,
      )
      .forEach((item) => {
        const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
        const valSpan = icon?.nextElementSibling;
        if (valSpan?.hasAttribute(FULL_BEATMAP_STATS_VALUE_ATTR)) {
          valSpan.textContent = valSpan.getAttribute(
            FULL_BEATMAP_STATS_VALUE_ATTR,
          );
          valSpan.removeAttribute(FULL_BEATMAP_STATS_VALUE_ATTR);
        }
        item.removeAttribute(FULL_BEATMAP_STATS_ITEM_ATTR);
      });
  }

  /**
   * @param {typeof OsuExpertPlus.settings} settings
   * @param {typeof OsuExpertPlus.dom.manageStyle} manageStyle
   * @returns {() => void}
   */
  function startAlwaysShowStats(settings, manageStyle) {
    const style = manageStyle(ALWAYS_SHOW_STYLE_ID, ALWAYS_SHOW_CSS);
    const id = settings.IDS.ALWAYS_SHOW_STATS;
    function apply(enabled) {
      enabled ? style.inject() : style.remove();
    }
    apply(settings.isEnabled(id));
    const unsub = settings.onChange(id, apply);
    return () => {
      try {
        unsub();
      } catch (_) {}
      style.remove();
    };
  }

  /**
   * @param {typeof OsuExpertPlus.settings} settings
   * @returns {() => void}
   */
  function startFullBeatmapStatNumbers(settings) {
    const featureId = settings.IDS.FULL_BEATMAP_STAT_NUMBERS;

    /** @returns {function} disconnect */
    function startObserver() {
      const obs = new MutationObserver((mutations) => {
        if (!settings.isEnabled(featureId)) return;
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = /** @type {Element} */ (node);
            if (el.matches?.(".beatmapset-panel")) {
              applyFullBeatmapStatNumbers(el);
            } else {
              el.querySelectorAll?.(".beatmapset-panel").forEach((panel) => {
                applyFullBeatmapStatNumbers(panel);
              });
            }
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      return () => obs.disconnect();
    }

    let stopObs = null;
    function applyFeature(enabled) {
      stopObs?.();
      stopObs = null;
      if (enabled) {
        applyFullBeatmapStatNumbers(document);
        stopObs = startObserver();
      } else {
        revertFullBeatmapStatNumbers(document);
      }
    }

    applyFeature(settings.isEnabled(featureId));
    const unsub = settings.onChange(featureId, applyFeature);

    return () => {
      try {
        unsub();
      } catch (_) {}
      stopObs?.();
      stopObs = null;
      revertFullBeatmapStatNumbers(document);
    };
  }

  return {
    startAlwaysShowStats,
    startFullBeatmapStatNumbers,
  };
})();

/* ── src/utils/mod-icons-as-acronyms.js ── */
/** Replace `.mod__icon` sprites with `data-acronym` text (global). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.modIconsAsAcronyms = (() => {
  const { el } = OsuExpertPlus.dom;
  const { IDS } = OsuExpertPlus.settings;

  const MOD_ICONS_ACRONYM_ID = IDS.MOD_ICONS_AS_ACRONYMS;
  const HIDE_CL_MOD_ID = IDS.HIDE_CL_MOD;
  const MOD_ICONS_ACRONYM_STYLE_ID = "osu-expertplus-mod-acronym-icons";
  const HIDE_CL_MOD_STYLE_ID = "osu-expertplus-hide-cl-mod";
  const MOD_ICONS_ACRONYM_ATTR = "data-oep-mod-acronym";
  const MOD_ICONS_ACRONYM_CLASS = "oep-mod-icon--acronym";
  /** Real text node — osu-web uses ::after for both letters and masked SVGs; those rules tie our specificity. */
  const MOD_ICONS_ACRONYM_LABEL_CLASS = "oep-mod-acronym-label";

  /** Fallback when parent `.mod` has no type (e.g. odd markup); mirrors osu difficulty reduction set. */
  const MOD_ACRONYM_REDUCTION = new Set([
    "EZ",
    "NF",
    "HT",
    "DC",
    "NR",
    "SO",
    "MU",
  ]);
  /** Fallback for difficulty-increasing–style mods (excl. automation / keys → white). */
  const MOD_ACRONYM_INCREASE = new Set([
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "FI",
    "BL",
    "DA",
    "AC",
    "WU",
    "WD",
    "DF",
    "TC",
    "SV2",
    "NS",
    "TP",
    "MF",
    "MG",
    "AD",
    "AS",
    "CS",
    "DS",
    "RD",
    "SI",
    "ST",
    "SY",
    "TD",
    "BM",
    "CO",
    "DP",
    "FR",
    "GR",
    "IN",
    "MR",
    "RP",
    "SW",
    "TR",
    "WG",
    "BR",
    "BU",
  ]);
  /**
   * osu-web `mod.less`: `.mod-type(Conversion, @osu-colour-purple-1)` — blue-purple
   * chip (e.g. Classic / CL). Not DifficultyIncrease/Reduction/Fun.
   */
  const MOD_ACRONYM_CONVERSION = new Set(["CL"]);

  const MOD_ICONS_ACRONYM_CSS = `
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon {
      background: none !important;
      background-image: none !important;
      box-shadow: none !important;
      filter: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      flex-shrink: 0;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0 0.12em;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::before,
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::after {
      display: none !important;
      content: none !important;
      mask: none !important;
      -webkit-mask: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      background: none !important;
      background-image: none !important;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS} {
      font-weight: 900;
      font-size: 0.62em;
      line-height: 1;
      text-transform: uppercase;
      pointer-events: none;
      white-space: nowrap;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--reduce {
      color: rgb(178, 255, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--increase {
      color: rgb(255, 102, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--plain {
      color: #fff;
    }
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__extender,
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__customised-indicator {
      display: none !important;
    }
    /*
     * Beatmapset “mod filter” grid (Expert+): osu-web .mod { height: 1em } fits masked icons;
     * acronym labels use real text and can clip or skew flex baseline vs row labels / piles.
     */
    [data-oep-mod-grid] .beatmap-scoreboard-mod {
      display: inline-flex !important;
      align-items: center;
      vertical-align: middle;
    }
    [data-oep-mod-grid]
      .beatmap-scoreboard-mod
      .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) {
      height: auto !important;
      min-height: 1em;
      align-items: center;
    }
  `;

  /** Classic (CL) — hidden via attribute match; applies with icons or Expert+ acronyms. */
  const HIDE_CL_MOD_CSS = `
    .beatmap-scoreboard-mod:has(.mod__icon[data-acronym="CL" i]),
    .mod:has(> .mod__icon[data-acronym="CL" i]) {
      display: none !important;
    }
  `;

  /** @param {Element} modRoot */
  function modRootHasType(modRoot, typeSuffix) {
    const want = `mod--type-${typeSuffix}`.toLowerCase();
    return modRoot.className.split(/\s+/).some((c) => c.toLowerCase() === want);
  }

  /**
   * Lazer-style mods (DT, HT, …) can show a custom rate in `.mod__extender` (e.g. "1.10×").
   * Fold that into the acronym label so "mod acronyms" mode shows one string and we hide
   * the extender via CSS while `data-oep-mod-acronym` is set (revert restores layout).
   * @param {HTMLElement} modIconEl
   * @param {string} baseAcronym  trimmed `data-acronym`, e.g. "DT"
   */
  function modAcronymDisplayText(modIconEl, baseAcronym) {
    const modRoot = modIconEl.closest(".mod");
    if (!(modRoot instanceof HTMLElement)) return baseAcronym;
    const extSpan = modRoot.querySelector(".mod__extender span");
    const extra = extSpan?.textContent?.trim();
    if (!extra) return baseAcronym;
    return `${baseAcronym} ${extra}`;
  }

  /**
   * @param {HTMLElement} modIconEl
   * @param {string} acronymUpper
   * @returns {"reduce"|"increase"|"plain"}
   */
  function modAcronymTone(modIconEl, acronymUpper) {
    const modRoot = modIconEl.closest(".mod");
    if (modRoot && modRootHasType(modRoot, "DifficultyReduction")) {
      return "reduce";
    }
    if (modRoot && modRootHasType(modRoot, "DifficultyIncrease")) {
      return "increase";
    }
    if (MOD_ACRONYM_REDUCTION.has(acronymUpper)) return "reduce";
    if (MOD_ACRONYM_INCREASE.has(acronymUpper)) return "increase";
    return "plain";
  }

  /** osu-web BEM (PascalCase suffix matches compiled `mod.less`). */
  function modTypeClassForAcronym(acronym) {
    const u = String(acronym).trim().toUpperCase();
    if (MOD_ACRONYM_REDUCTION.has(u)) return "mod--type-DifficultyReduction";
    if (MOD_ACRONYM_INCREASE.has(u)) return "mod--type-DifficultyIncrease";
    if (MOD_ACRONYM_CONVERSION.has(u)) return "mod--type-Conversion";
    return "mod--type-Fun";
  }

  function injectModIconsAcronymStyles() {
    if (document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = MOD_ICONS_ACRONYM_STYLE_ID;
    style.textContent = MOD_ICONS_ACRONYM_CSS;
    document.head.appendChild(style);
  }

  function removeModIconsAcronymStyles() {
    document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)?.remove();
  }

  function injectHideClModStyles() {
    if (document.getElementById(HIDE_CL_MOD_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIDE_CL_MOD_STYLE_ID;
    style.textContent = HIDE_CL_MOD_CSS;
    document.head.appendChild(style);
  }

  function removeHideClModStyles() {
    document.getElementById(HIDE_CL_MOD_STYLE_ID)?.remove();
  }

  /**
   * @param {ParentNode} scope
   */
  function applyModIconsAsAcronyms(scope) {
    const icons = [];
    if (scope instanceof Element && scope.matches(".mod__icon[data-acronym]")) {
      icons.push(scope);
    }
    if (scope.querySelectorAll) {
      scope.querySelectorAll(".mod__icon[data-acronym]").forEach((n) => {
        icons.push(n);
      });
    }
    icons.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.hasAttribute(MOD_ICONS_ACRONYM_ATTR)) return;
      const raw =
        node.getAttribute("data-acronym") || node.dataset?.acronym || "";
      const acronym = String(raw).trim();
      if (!acronym) return;
      node.classList.add(MOD_ICONS_ACRONYM_CLASS);
      node.setAttribute(MOD_ICONS_ACRONYM_ATTR, "1");
      const tone = modAcronymTone(node, acronym.toUpperCase());
      const labelText = modAcronymDisplayText(node, acronym);
      const label = el(
        "span",
        {
          class: `${MOD_ICONS_ACRONYM_LABEL_CLASS} ${MOD_ICONS_ACRONYM_LABEL_CLASS}--${tone}`,
        },
        labelText,
      );
      node.appendChild(label);
    });
  }

  /**
   * @param {ParentNode} scope
   */
  function revertModIconsAsAcronyms(scope) {
    scope
      .querySelectorAll(`.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]`)
      .forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
        node.classList.remove(MOD_ICONS_ACRONYM_CLASS);
        node.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
      });
  }

  /**
   * deep-cloneNode(true) of osu’s `.mod` can copy Expert+ acronym state from the
   * template row; patch then replaces .mod__icon classes and drops
   * oep-mod-icon--acronym while data-oep-mod-acronym stays → apply skips →
   * sprite + stale label overlap. Strip before patching so apply runs fresh.
   * @param {HTMLElement} modRoot
   */
  function stripOepModAcronymFromClonedMod(modRoot) {
    const icon = modRoot.querySelector(".mod__icon");
    if (!(icon instanceof HTMLElement)) return;
    icon.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
    icon.classList.remove(MOD_ICONS_ACRONYM_CLASS);
    icon.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
  }

  /**
   * @param {{ isEnabled: function(string): boolean }} settingsApi
   * @returns {function} disconnect
   */
  function startModIconsAcronymObserver(settingsApi) {
    const obs = new MutationObserver((mutations) => {
      if (!settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID)) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const elNode = /** @type {Element} */ (node);
          if (elNode.matches?.(".mod__icon[data-acronym]")) {
            applyModIconsAsAcronyms(elNode);
          } else if (elNode.querySelectorAll) {
            applyModIconsAsAcronyms(elNode);
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => obs.disconnect();
  }

  /**
   * Wire setting + document observer for all pages (beatmap leaderboards, profiles, etc.).
   * @param {{ isEnabled: function(string): boolean, onChange: function(string, function(boolean)): function }} settingsApi
   * @returns {function} full teardown
   */
  function install(settingsApi) {
    let stopModIconsAcronymObs = null;
    const applyModIconsAcronymFeature = (enabled) => {
      stopModIconsAcronymObs?.();
      stopModIconsAcronymObs = null;
      if (enabled) {
        injectModIconsAcronymStyles();
        applyModIconsAsAcronyms(document);
        stopModIconsAcronymObs = startModIconsAcronymObserver(settingsApi);
      } else {
        removeModIconsAcronymStyles();
        revertModIconsAsAcronyms(document);
      }
    };
    applyModIconsAcronymFeature(settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID));

    const applyHideClMod = (enabled) => {
      if (enabled) injectHideClModStyles();
      else removeHideClModStyles();
    };
    applyHideClMod(settingsApi.isEnabled(HIDE_CL_MOD_ID));

    const unsub = settingsApi.onChange(
      MOD_ICONS_ACRONYM_ID,
      applyModIconsAcronymFeature,
    );
    const unsubHideCl = settingsApi.onChange(HIDE_CL_MOD_ID, applyHideClMod);
    return () => {
      unsub();
      unsubHideCl();
      stopModIconsAcronymObs?.();
      stopModIconsAcronymObs = null;
      revertModIconsAsAcronyms(document);
      removeModIconsAcronymStyles();
      removeHideClModStyles();
    };
  }

  return {
    applyModIconsAsAcronyms,
    injectModIconsAcronymStyles,
    stripOepModAcronymFromClonedMod,
    modTypeClassForAcronym,
    install,
  };
})();

/* ── src/utils/beatmapsets-listing-mode.js ── */
/** Remember beatmap listing gamemode (URL `m=`) and default new visits + nav links. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapsetsListingMode = (() => {
  const STORAGE_KEY = "beatmapsetsListing.preferredMode";
  /** Written when the user picks “Any” so it does not fall back to osu (0). */
  const STORED_ANY = "any";
  /** `GM_getValue` default only — never persisted; missing key → treat as osu (0). */
  const STORED_UNSET = "__oep_bms_mode_unset__";
  const LISTING_PATH_RE = /^\/beatmapsets\/?$/i;

  /**
   * @returns {string|null}  ruleset id `0`–`3`, or `null` when the user chose Any
   */
  function getPreferredMode() {
    const v = GM_getValue(STORAGE_KEY, STORED_UNSET);
    if (v === STORED_UNSET) return "0";
    if (v === STORED_ANY) return null;
    const s = String(v);
    if (/^[0123]$/.test(s)) return s;
    return "0";
  }

  /** @param {string|null} m */
  function setPreferredMode(m) {
    if (m == null || m === "") {
      GM_setValue(STORAGE_KEY, STORED_ANY);
    } else if (/^[0123]$/.test(m)) {
      GM_setValue(STORAGE_KEY, m);
    }
  }

  function isBeatmapsetsListingPath(pathname) {
    return LISTING_PATH_RE.test(pathname);
  }

  function hasAdvancedBeatmapSearch() {
    const el = document.querySelector(
      '.js-react[data-react="beatmaps"][data-advanced-search="1"]',
    );
    return el != null;
  }

  /**
   * Mode row: grid is general → mode → …; sticky bar is status → mode.
   * @param {Element} a
   */
  function isModeFilterAnchor(a) {
    return (
      !!a.closest(
        ".beatmapsets-search__filter-grid > .beatmapsets-search-filter:nth-child(2)",
      ) ||
      !!a.closest(
        ".beatmapsets-search--sticky .beatmapsets-search__filters > .beatmapsets-search-filter:nth-child(2)",
      )
    );
  }

  function persistFromListingLocation() {
    if (!isBeatmapsetsListingPath(location.pathname)) return;
    const m = new URLSearchParams(location.search).get("m");
    if (m == null || m === "") {
      setPreferredMode(null);
    } else if (/^[0123]$/.test(m)) {
      setPreferredMode(m);
    }
    patchListingAnchors();
  }

  function patchListingAnchors() {
    const pref = getPreferredMode();
    const nodes = document.querySelectorAll('a[href*="/beatmapsets"]');
    for (const a of nodes) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      let u;
      try {
        u = new URL(a.href);
      } catch (_) {
        continue;
      }
      if (u.hostname !== "osu.ppy.sh") continue;
      if (!LISTING_PATH_RE.test(u.pathname)) continue;
      if (u.searchParams.has("m")) continue;
      if (pref == null) continue;
      u.searchParams.set("m", pref);
      const rel = u.pathname + u.search + u.hash;
      const attr = a.getAttribute("href");
      if (attr != null && /^https?:\/\//i.test(attr)) {
        a.href = u.toString();
      } else {
        a.setAttribute("href", rel);
      }
    }
  }

  let linkMo = null;
  let linkDebounce = 0;

  /**
   * Keeps “Beatmap listing” (and similar) links aligned with the saved `m` param.
   * @returns {() => void}
   */
  function installLinkPatcher() {
    const schedule = () => {
      window.clearTimeout(linkDebounce);
      linkDebounce = window.setTimeout(patchListingAnchors, 200);
    };
    patchListingAnchors();
    linkMo = new MutationObserver(schedule);
    linkMo.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      linkMo?.disconnect();
      linkMo = null;
      window.clearTimeout(linkDebounce);
      linkDebounce = 0;
    };
  }

  /**
   * Listing page: apply saved mode when URL has no `m`, and record filter clicks.
   * @returns {() => void}
   */
  function startPageBehavior() {
    let applied = false;
    /** @type {MutationObserver|null} */
    let mo = null;
    let moDebounce = 0;
    let cap = 0;

    const tryApplyPreferred = () => {
      if (applied) return;
      if (!isBeatmapsetsListingPath(location.pathname)) return;
      if (!hasAdvancedBeatmapSearch()) {
        applied = true;
        return;
      }
      const pref = getPreferredMode();
      if (pref == null) {
        applied = true;
        return;
      }
      const cur = new URLSearchParams(location.search).get("m");
      if (cur != null && cur !== "") {
        applied = true;
        return;
      }
      const el = document.querySelector(
        `a.beatmapsets-search-filter__item[data-filter-value="${CSS.escape(pref)}"]`,
      );
      if (!(el instanceof HTMLElement)) return;
      el.click();
      applied = true;
    };

    const onMo = () => {
      window.clearTimeout(moDebounce);
      moDebounce = window.setTimeout(() => {
        tryApplyPreferred();
        if (applied && mo) {
          mo.disconnect();
          mo = null;
        }
      }, 60);
    };

    tryApplyPreferred();
    if (!applied) {
      mo = new MutationObserver(onMo);
      mo.observe(document.body, { childList: true, subtree: true });
    }

    cap = window.setTimeout(() => {
      mo?.disconnect();
      mo = null;
      applied = true;
    }, 20000);

    const onDocClick = (e) => {
      if (!isBeatmapsetsListingPath(location.pathname)) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapsets-search-filter__item");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (!isModeFilterAnchor(a)) return;
      window.setTimeout(persistFromListingLocation, 200);
    };

    document.addEventListener("click", onDocClick, true);

    return () => {
      mo?.disconnect();
      window.clearTimeout(moDebounce);
      window.clearTimeout(cap);
      document.removeEventListener("click", onDocClick, true);
    };
  }

  return {
    getPreferredMode,
    installLinkPatcher,
    startPageBehavior,
    patchListingAnchors,
  };
})();

/* ── src/pages/beatmapsets-listing.js ── */
/** /beatmapsets listing (no set id). */

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapsetsListing = (() => {
  const name = "BeatmapsetsListing";
  const { manageStyle, createCleanupBag } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;

  /**
   * @param {RegExpMatchArray} _match  URL match (unused here).
   * @returns {function|void}  Optional cleanup function.
   */
  function init(_match) {
    const bag = createCleanupBag();

    bag.add(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(settings, manageStyle),
    );
    bag.add(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );
    bag.add(OsuExpertPlus.beatmapCardExtra.start(settings));
    bag.add(OsuExpertPlus.beatmapsetsListingMode.startPageBehavior());

    return () => bag.dispose();
  }

  return { name, init };
})();

/* ── src/pages/beatmap-detail.js ── */
/** /beatmapsets/:id and variants. */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapDetail = (() => {
  const name = "BeatmapDetail";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    qs,
    qsa,
    manageStyle,
    createCleanupBag,
    parseLocaleNumber,
    formatDecimalPp,
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const auth = OsuExpertPlus.auth;
  const omdb = OsuExpertPlus.omdb;

  // With user-profile: score-row PP + hit stats
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const METADATA_DESCRIPTION_MODAL_BUTTONS_ID =
    IDS.METADATA_DESCRIPTION_MODAL_BUTTONS;
  const DISCUSSION_DEFAULT_TO_TOTAL_ID = IDS.DISCUSSION_DEFAULT_TO_TOTAL;
  const OMDB_BEATMAPSET_RATINGS_ID = IDS.OMDB_BEATMAPSET_RATINGS;
  const BEATMAP_PREVIEW_ID = IDS.BEATMAP_PREVIEW;
  const BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID =
    IDS.BEATMAPSET_PREVIEW_AUDIO_BUTTON;
  const BEATCONNECT_DOWNLOAD_BUTTON_ID = IDS.BEATCONNECT_DOWNLOAD_BUTTON;
  const API_EXTENDED_LEADERBOARD_ID = IDS.API_EXTENDED_LEADERBOARD;
  const SCOREBOARD_MOD_GRID_ID = IDS.SCOREBOARD_MOD_GRID;
  const SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID =
    IDS.SCOREBOARD_HIDE_CUSTOM_RATE_SCORES;
  const SCOREBOARD_PLAYER_LOOKUP_ID = IDS.SCOREBOARD_PLAYER_LOOKUP;
  const DIFF_NAME_BESIDE_PICKER_ID = IDS.DIFF_NAME_BESIDE_PICKER;
  const beatmapPreview = OsuExpertPlus.beatmapPreview;
  const DISCUSSION_USER_CACHE = new Map();

  const STYLE_ID = "osu-expertplus-beatmap-detail-css";
  const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";
  const MOD_GRID_STYLE_ID = "osu-expertplus-beatmap-mod-grid-css";
  const ROOT_CLASS = "osu-expertplus-beatmapset-extras";
  const MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";
  const MOD_GRID_COLLAPSED_CLASS = `${MOD_GRID_CLASS}--collapsed`;
  /** Hidden React strip button → visible grid clone (clone does not receive React class updates). */
  const beatmapModGridOriginalToClone = new WeakMap();
  /** Live MO + debounce ids for `.beatmapset-scoreboard__mods` (tear down if setting flips off mid-setup). */
  const beatmapModGridLiveHandles = new WeakMap();

  const MOD_WILDCARD_CLASS = "oep-mod-wildcard";
  const MOD_WILDCARD_ATTR = "data-oep-mod-wildcard";
  const WILDCARD_MERGED_ROW_ATTR = "data-oep-wildcard-merged-row";
  /** Marks a wildcard row that is not the player's highest-ranked score in the merged list. */
  const WILDCARD_DUPE_ROW_ATTR = "data-oep-wildcard-dupe";
  /** Marks a row whose effective speed is not 1.00× or 1.50× (i.e. a custom-rate score). */
  const RATE_EDIT_ROW_ATTR = "data-oep-rate-edit";
  /** Row hidden because “hide custom rate scores” is on (restored when filter off). */
  const RATE_EDIT_ROW_HIDDEN_ATTR = "data-oep-rate-edit-filtered";
  /** In-page “hide custom rate scores” control; visibility follows whether any rate-edit row exists. */
  const RATE_EDIT_FILTER_BAR_ATTR = "data-oep-rate-edit-filter-bar";
  /** Player lookup bar wrapper; sits inside `.oep-scoreboard-tools-row` with the rate filter. */
  const SCOREBOARD_USER_SEARCH_ATTR = "data-oep-beatmap-user-search";
  /** Flex row under mod filters holding player lookup (optional) and rate-edit filter (optional). */
  const SCOREBOARD_TOOLS_ROW_ATTR = "data-oep-scoreboard-tools-row";
  const SCORE_USER_SEARCH_RESULT_ATTR = "data-oep-user-search-result";
  /** Marks the per-column sort control in `<th>` (re-mounted after osu-web React refresh). */
  const SCOREBOARD_SORT_ARROW_ATTR = "data-oep-scoreboard-sort-arrow";
  /** @type {readonly string[]} */
  const BEATMAP_SCOREBOARD_SORT_KEYS = Object.freeze([
    "score",
    "accuracy",
    "combo",
    "pp",
    "date",
  ]);
  const WILDCARD_LOADING_CLASS = "oep-wildcard-loading";
  const MAX_WILDCARD_MODS = 2;
  /** acronym → sequence counter (for oldest-eviction). 0 = not wildcard. */
  let wildcardModState = new Map();
  /** Monotonically increasing counter so the oldest wildcard can be evicted. */
  let wildcardSeqCounter = 0;
  /** Timer id for the 1-second mod-change debounce. */
  let wildcardDebounceTimer = 0;
  /** Abort controller for in-flight wildcard fetches. */
  let wildcardAbortCtrl = /** @type {AbortController|null} */ (null);

  /** One grid control for DT↔NC (cycle) and one for SD↔PF. */
  const MERGED_MOD_DT_NC = "DT_NC";
  const MERGED_MOD_SD_PF = "SD_PF";
  /** @type {Map<string, number>} merge id → step (DT_NC: 0–3, SD_PF: 0–4). */
  let mergedModCycleStep = new Map();

  const SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";
  /** Injected always-visible header nomod star rating (osu-web shows native line only on picker hover). */
  const HEADER_NOMOD_STAR_ATTR = "data-oep-header-nomod-star";
  /** Marks injected name / guest credit / SR block inside the active `.beatmapset-beatmap-picker__beatmap--active`. */
  const DIFF_BESIDE_PICKER_ATTR = "data-oep-header-diff-beside-picker";
  /** OMDB (omdb.nyahh.net) block above `.beatmapset-header__diff-name`. */
  const OEP_OMDB_WRAP_CLASS = "oep-beatmapset-omdb-wrap";
  const OEP_OMDB_ROW_CLASS = "oep-beatmapset-omdb-row";
  const OEP_OMDB_VOTE_CLASS = "oep-beatmapset-omdb-vote";
  /** Class added to the primary download link so it visually pairs with the Beatconnect button. */
  const BEATCONNECT_DL_PAIRED_CLASS = "oep-beatconnect-paired";
  const BEATCONNECT_DL_BTN_CLASS = "oep-beatmapset-beatconnect-btn";
  const BEATCONNECT_STACK_CLASS = "oep-beatconnect-stack";
  const BEATCONNECT_STACK_ICON_CLASS = "oep-beatconnect-stack__icon";
  const BEATCONNECT_STACK_LABEL_CLASS = "oep-beatconnect-stack__label";
  /** Header favourite square when the icon is `fas fa-heart` (favourited). */
  const BEATMAPSET_FAV_BTN_FAVOURITED_CLASS =
    "oep-beatmapset-favourite-btn--favourited";

  /**
   * Mods available in classic osu!stable / long-standing web filters — used to
   * split the second column (“lazer”) from the first (“stable”). Anything else
   * with a known acronym is treated as lazer-first.
   */
  const STABLE_MOD_ACRONYMS = new Set([
    "NM",
    "EZ",
    "NF",
    "HT",
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "SO",
    "TD",
    "RX",
    "AP",
    "FI",
    "K1",
    "K2",
    "K3",
    "K4",
    "K5",
    "K6",
    "K7",
    "K8",
    "K9",
  ]);

  const CSS = `
    /* Modal open controls: custom look per placement (header vs info panel). */
    .${ROOT_CLASS}__action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      box-sizing: border-box;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__action-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    /* osu-web uses 20px padding-bottom on artist; when our control follows, move
       that space to margin below the button (tighter to artist, gap before mapping). */
    .beatmapset-header
      .beatmapset-header__details-text--artist:has(+ [data-oep-beatmapset-metadata]) {
      padding-bottom: 0;
    }
    .${ROOT_CLASS}__action-btn--under-artist {
      align-self: flex-start;
      flex: 0 0 auto;
      width: max-content;
      max-width: 100%;
      margin-top: 4px;
      margin-bottom: 20px;
      color: hsl(var(--hsl-l1, 0 0% 96%));
      background: rgba(0, 0, 0, 0.35);
      border-color: hsl(var(--hsl-l1, 0 0% 100%) / 0.22);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    .${ROOT_CLASS}__action-btn--under-artist:hover {
      background: rgba(0, 0, 0, 0.52);
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      color: #fff;
    }
    .${ROOT_CLASS}__action-btn--primary {
      color: hsl(var(--hsl-l1, 0 0% 100%));
      background: hsl(var(--hsl-c1, 333 89% 68%));
      border-color: hsl(var(--hsl-c1, 333 89% 58%));
      text-shadow: none;
    }
    .${ROOT_CLASS}__action-btn--primary:hover {
      background: hsl(var(--hsl-c1, 333 89% 62%));
      border-color: hsl(var(--hsl-c1, 333 89% 52%));
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row {
      flex-direction: column;
      align-items: stretch;
    }
    /* Sticky bar matches osu beatmapset-info__header--sticky so title + Full description stay together. */
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-sticky-head {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 10px;
      row-gap: 6px;
      padding-bottom: 12px;
      margin-bottom: 0;
      position: sticky;
      top: 0;
      z-index: 1;
      background-color: hsl(var(--hsl-b4));
      background-image: linear-gradient(
        to top,
        hsla(var(--hsl-b4), 0),
        hsl(var(--hsl-b4)) 5px
      );
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > h3.beatmapset-info__header {
      margin: 0;
      padding: 5px 0 0;
      flex: 0 1 auto;
      min-width: 0;
      position: static;
      top: auto;
      z-index: auto;
      background-image: none;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading {
      flex: 0 0 auto;
      align-self: center;
      margin: 0;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.2;
      padding: 3px 8px;
      gap: 4px;
      border-radius: 5px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border-color: hsl(var(--hsl-b5, 333 18% 28%));
      text-shadow: none;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading i {
      font-size: 10px;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading:hover {
      background: hsl(var(--hsl-b4, 333 18% 22%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > div:not([class]) {
      flex: 1 0 100%;
      min-width: 0;
    }

    .${ROOT_CLASS}__modal-portal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      box-sizing: border-box;
    }
    .${ROOT_CLASS}__modal-portal.${ROOT_CLASS}__modal-portal--open {
      display: flex;
    }
    .${ROOT_CLASS}__modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      cursor: pointer;
    }
    .${ROOT_CLASS}__modal {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: min(92vw, 600px);
      max-height: min(88vh, 680px);
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
      border: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-family: inherit;
      animation: ${ROOT_CLASS}-modal-in 160ms ease-out;
    }
    .${ROOT_CLASS}__modal--description {
      max-width: min(92vw, 720px);
      max-height: min(88vh, 78vh);
    }
    .${ROOT_CLASS}__description-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 10px;
    }
    .${ROOT_CLASS}__description-prose {
      font-size: 13px;
      line-height: 1.55;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      word-break: break-word;
    }
    .${ROOT_CLASS}__description-prose .bbcode {
      color: inherit;
    }
    @keyframes ${ROOT_CLASS}-modal-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .${ROOT_CLASS}__modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px 12px;
      border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      flex-shrink: 0;
    }
    .${ROOT_CLASS}__modal-header-start {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .${ROOT_CLASS}__modal-header-osu-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      flex-shrink: 0;
      max-width: min(100%, 240px);
    }
    .${ROOT_CLASS}__modal-header-osu-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 30px;
      padding: 5px 10px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
    }
    .${ROOT_CLASS}__modal-header-osu-msg {
      margin: 0;
      font-size: 10px;
      font-weight: 500;
      line-height: 1.3;
      color: #e07a7a;
    }
    .${ROOT_CLASS}__modal-header-osu-msg:empty {
      display: none;
    }
    .${ROOT_CLASS}__modal-header-osu-btn:hover:not(:disabled) {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__modal-header-osu-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__modal-header-osu-btn:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .${ROOT_CLASS}__modal-title {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
    }
    .${ROOT_CLASS}__modal-close {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: hsl(var(--hsl-l2, 0 0% 78%));
      background: transparent;
      transition: background 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__modal-close:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__modal-body {
      padding: 4px 16px 16px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .${ROOT_CLASS}__row {
      display: grid;
      grid-template-columns: minmax(120px, 30%) 1fr;
      gap: 8px 16px;
      padding: 12px 0;
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .${ROOT_CLASS}__row:last-child {
      border-bottom: none;
    }
    .${ROOT_CLASS}__label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.9;
      align-self: start;
      padding-top: 3px;
    }
    .${ROOT_CLASS}__value-cell {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }
    .${ROOT_CLASS}__value {
      margin: 0;
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.45;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      word-break: break-word;
    }
    .${ROOT_CLASS}__value--muted {
      color: hsl(var(--hsl-l2, 0 0% 65%));
      font-style: italic;
    }
    .${ROOT_CLASS}__copy-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-top: 1px;
      padding: 0;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      transition: background 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__copy-btn:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__copy-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__value-cell > .${ROOT_CLASS}__tags {
      flex: 1;
      min-width: 0;
    }
    .${ROOT_CLASS}__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-start;
    }
    .${ROOT_CLASS}__tag-wrap,
    .${ROOT_CLASS}__copy-wrap {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      vertical-align: top;
      max-width: 100%;
    }
    .${ROOT_CLASS}__copied-toast {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translate(-50%, -5px);
      padding: 3px 8px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 96%));
      background: hsl(var(--hsl-b6, 333 18% 28%));
      border: 1px solid hsl(var(--hsl-c2, 333 60% 60%) / 0.45);
      border-radius: 5px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 140ms ease, visibility 140ms ease;
      z-index: 5;
    }
    .${ROOT_CLASS}__copied-toast--show {
      opacity: 1;
      visibility: visible;
    }
    .${ROOT_CLASS}__tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      min-width: 0;
      margin: 0;
      padding: 5px 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      border-radius: 999px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease;
      appearance: none;
      -webkit-appearance: none;
      text-align: center;
    }
    .${ROOT_CLASS}__tag:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    .${ROOT_CLASS}__tag:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__err {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: hsl(var(--hsl-l2, 0 0% 78%));
    }
    .oep-discussion-preview-toggle {
      margin-left: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .oep-discussion-preview-toggle:hover {
      background: hsl(var(--hsl-b5, 333 18% 24%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    .oep-discussion-preview-toggle[aria-pressed="true"] {
      background: hsl(var(--hsl-c1, 333 89% 68%) / 0.2);
      border-color: hsl(var(--hsl-c1, 333 89% 58%));
      color: hsl(var(--hsl-l1, 0 0% 100%));
    }
    .oep-discussion-preview {
      margin-top: 10px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      background: hsl(var(--hsl-b3, 333 18% 14%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
      font-size: 13px;
      line-height: 1.55;
      word-break: break-word;
    }
    .oep-discussion-preview[hidden] {
      display: none !important;
    }
    .oep-discussion-preview__title {
      margin: 0 0 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
    }
    .oep-discussion-preview__body pre,
    .oep-discussion-preview__body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .oep-discussion-preview__body pre {
      overflow-x: auto;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%));
    }
    .oep-discussion-preview__body p,
    .oep-discussion-preview__body ul,
    .oep-discussion-preview__body ol,
    .oep-discussion-preview__body blockquote {
      margin: 0 0 8px;
    }
    .oep-discussion-preview__body p:last-child,
    .oep-discussion-preview__body ul:last-child,
    .oep-discussion-preview__body ol:last-child,
    .oep-discussion-preview__body blockquote:last-child {
      margin-bottom: 0;
    }
    .oep-discussion-preview__body blockquote {
      border-left: 3px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      padding-left: 10px;
      color: hsl(var(--hsl-l2, 0 0% 78%));
    }
    .oep-discussion-preview__body img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 8px 0;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%));
    }
    .oep-discussion-preview__empty {
      color: hsl(var(--hsl-l2, 0 0% 68%));
      font-style: italic;
    }
    .oep-markdown-helper {
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      box-sizing: border-box;
    }
    .oep-markdown-helper__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
    }
    .oep-markdown-helper--new-discussion {
      margin: 0 0 10px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%) / 0.65);
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__row {
      gap: 6px;
    }
    .oep-markdown-helper--reply {
      margin: 10px 10px 10px;
      padding: 0 0 6px;
      border: none;
      border-radius: 0;
      border-bottom: 1px solid hsl(var(--hsl-b5, 333 18% 22%) / 0.55);
      background: transparent;
      box-shadow: none;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row {
      flex-wrap: nowrap;
      gap: 4px;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: hsl(var(--hsl-b5, 333 18% 30%)) transparent;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar {
      height: 4px;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: hsl(var(--hsl-b5, 333 18% 32%));
    }
    .oep-markdown-helper__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 5px 8px;
      min-height: 26px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b3, 333 18% 14%));
      color: hsl(var(--hsl-l2, 0 0% 82%));
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      white-space: nowrap;
      margin: 0;
      box-shadow: none;
      transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn {
      padding: 5px 9px;
      min-height: 28px;
      border-radius: 6px;
      border-color: hsl(var(--hsl-b5, 333 18% 26%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
      color: hsl(var(--hsl-l1, 0 0% 98%));
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
      outline-offset: 2px;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn {
      flex: 0 0 auto;
      padding: 3px 6px;
      min-height: 24px;
      gap: 3px;
      border-radius: 5px;
      font-size: 9px;
      font-weight: 600;
      border-color: hsl(var(--hsl-b5, 333 18% 26%) / 0.85);
      background: hsl(var(--hsl-b3, 333 18% 13%) / 0.9);
      color: hsl(var(--hsl-l2, 0 0% 80%));
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 18%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
      outline-offset: 1px;
    }
    .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 19%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.38);
      color: hsl(var(--hsl-l1, 0 0% 96%));
    }
    .oep-markdown-helper__btn i {
      font-size: 10px;
      opacity: 0.88;
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn i {
      font-size: 11px;
      opacity: 0.9;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn i {
      font-size: 9px;
      opacity: 0.85;
    }
    .oep-discussion-voters-tooltip {
      min-width: min(216px, 70vw);
      max-width: min(252px, 78vw);
      padding: 0 !important;
      overflow: hidden;
      border-radius: 10px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 22%));
      background: hsl(var(--hsl-b1, 333 18% 8%));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    .oep-discussion-voters-tooltip__list {
      max-height: min(320px, 52vh);
      overflow: auto;
      background: hsl(var(--hsl-b1, 333 18% 8%));
    }
    .oep-discussion-voters-tooltip__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 9px;
      margin: 4px;
      text-decoration: none;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
      border-radius: 8px;
      background: hsl(var(--hsl-b2, 333 18% 10%));
      transition: background 120ms ease;
    }
    .oep-discussion-voters-tooltip__row:last-child {
      margin-bottom: 6px;
    }
    .oep-discussion-voters-tooltip__row:hover {
      background: hsl(var(--hsl-b3, 333 18% 13%));
    }
    .oep-discussion-voters-tooltip__avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    }
    .oep-discussion-voters-tooltip__name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  const MOD_GRID_ATTR = "data-oep-mod-grid";
  const MOD_RESET_BTN_SYNC_ATTR = "data-oep-mod-reset-sync-obs";

  const MOD_GRID_CSS = `
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
      display: grid !important;
      gap: 8px 12px;
      align-items: start;
      justify-items: stretch;
      margin-bottom: 1.5rem;
      text-align: start;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] > .beatmap-scoreboard-mod[data-oep-mod-hidden] {
      display: none !important;
    }
    /* osu-web: .beatmapset-scoreboard__mods--initial:hover sets --scoreboard-mod-opacity: 0.5; only a
       hovered .beatmap-scoreboard-mod sets it back to 1. Expert+ adds labels/headers/gaps, so hovering
       those counts as “strip hover” but not “mod hover” → every icon stays dimmed. Keep full opacity
       unless the pointer is actually on a mod button. */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].beatmapset-scoreboard__mods--initial:hover:not(:has(.beatmap-scoreboard-mod:hover)) {
      --scoreboard-mod-opacity: 1;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
      grid-template-columns: minmax(6.5rem, max-content) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "mod-toggle mod-toggle mod-toggle"
        "hdr-corner hdr-stable hdr-lazer"
        "r0-label r0-stable r0-lazer"
        "r1-label r1-stable r1-lazer"
        "r2-label r2-stable r2-lazer";
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__toggle-row {
      grid-area: mod-toggle;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      justify-self: stretch;
      width: 100%;
      min-width: 0;
      text-align: start;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle {
      position: relative;
      display: block;
      flex: 0 0 auto;
      margin: 0;
      margin-right: auto;
      padding: 4px 0 4px 1.35rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-align: start !important;
      width: fit-content;
      max-width: 100%;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-label {
      display: block;
      text-align: start !important;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:hover {
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
      border-radius: 4px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle i {
      position: absolute;
      left: 0;
      top: 50%;
      width: 1rem;
      height: 1em;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 12px;
      line-height: 1;
      opacity: 0.9;
      transform: translateY(-50%);
      transform-origin: 0.35em 50%;
      transition: transform 0.15s ease;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS} {
      text-align: start !important;
      width: 100% !important;
      max-width: 100%;
      box-sizing: border-box;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
      > :not(.${MOD_GRID_CLASS}__toggle-row):not(.beatmap-scoreboard-mod) {
      display: none !important;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
      .${MOD_GRID_CLASS}__collapse-toggle i {
      transform: translateY(-50%) rotate(-90deg);
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-corner {
      grid-area: hdr-corner;
      min-height: 1px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods {
      flex: 0 0 auto;
      margin: 0;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid hsl(var(--hsl-b4, 333 18% 28%));
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 88%));
      background: hsl(var(--hsl-b5, 333 18% 22%));
      line-height: 1.2;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:hover:not(:disabled) {
      filter: brightness(1.1);
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-stable {
      grid-area: hdr-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-lazer {
      grid-area: hdr-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-label {
      grid-area: r0-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-label {
      grid-area: r1-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-label {
      grid-area: r2-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-stable {
      grid-area: r0-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-lazer {
      grid-area: r0-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-stable {
      grid-area: r1-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-lazer {
      grid-area: r1-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-stable {
      grid-area: r2-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-lazer {
      grid-area: r2-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.9;
      padding-top: 0;
      line-height: 1.25;
      max-width: 11rem;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 88%));
      padding: 2px 0 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead--lazer {
      justify-content: space-between;
      flex-wrap: wrap;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__pile {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide {
      flex: 1 1 100%;
      width: 100%;
      max-width: 22rem;
      box-sizing: border-box;
      margin-top: 2px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b4, 333 18% 28%) / 0.55);
      background: hsl(var(--hsl-b2, 333 18% 10%) / 0.9);
      font-size: 9px;
      line-height: 1.35;
      color: hsl(var(--hsl-c2, 333 60% 72%));
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon {
      position: relative;
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      margin-top: 1px;
      border-radius: 8px;
      box-sizing: border-box;
      background: hsl(var(--hsl-b4, 333 18% 18%) / 0.6);
      outline: 2px dashed hsl(45 100% 60% / 0.85);
      outline-offset: 1px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon::after {
      content: "?";
      position: absolute;
      top: -5px;
      right: -5px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: hsl(45 100% 50%);
      color: hsl(0 0% 10%);
      font-size: 10px;
      font-weight: 800;
      line-height: 15px;
      text-align: center;
      pointer-events: none;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text {
      margin: 0;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text strong {
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-weight: 700;
    }
    /* Mod statistics numbers (grid layout only): enabled mods -> white. */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender span,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator span,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__stat,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__count {
      color: hsl(var(--hsl-l1, 0 0% 90%)) !important;
    }
    /* Wildcard mod styling */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} {
      position: relative;
      --scoreboard-mod-opacity: 0.85;
      filter: none;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .mod__icon {
      outline: 2px dashed hsl(45 100% 60% / 0.85);
      outline-offset: 1px;
      border-radius: 8px;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS}::after {
      content: "?";
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: hsl(45 100% 50%);
      color: hsl(0 0% 10%);
      font-size: 11px;
      font-weight: 800;
      line-height: 16px;
      text-align: center;
      pointer-events: none;
      z-index: 2;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__stat,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__count {
      color: hsl(45 100% 70%) !important;
    }
    /* Wildcard loading overlay on the scoreboard table */
    .${WILDCARD_LOADING_CLASS} {
      position: relative;
      pointer-events: none;
      opacity: 0.45;
      transition: opacity 0.15s ease;
    }
    .${WILDCARD_LOADING_CLASS}::after {
      content: "Loading mod combinations…";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: hsl(0 0% 85%);
      pointer-events: none;
      z-index: 5;
    }
    /* Favourite hover popover (replaces osu! qtip user list on heart stat). */
    .${ROOT_CLASS}__fav-popover {
      position: fixed;
      z-index: 20050;
      box-sizing: border-box;
      width: min(92vw, 19rem);
      max-height: min(72vh, 24rem);
      padding: 10px 12px;
      border-radius: 10px;
      background: hsl(var(--hsl-b2, 333 18% 12%) / 0.82);
      border: 1px solid hsl(var(--hsl-b4, 333 18% 22%) / 0.55);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: hsl(var(--hsl-l1, 0 0% 92%));
      font-size: 12px;
      line-height: 1.35;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.11s ease, visibility 0.11s ease;
    }
    .${ROOT_CLASS}__fav-popover.${ROOT_CLASS}__fav-popover--visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    .${ROOT_CLASS}__fav-popover-title {
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l2, 0 0% 78%));
      margin-bottom: 8px;
    }
    .${ROOT_CLASS}__fav-popover-scroll {
      max-height: min(62vh, 20rem);
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    }
    .${ROOT_CLASS}__header-fav-chip {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      color: inherit;
      text-decoration: none;
      font-weight: 600;
      padding: 2px 0;
      border-radius: 6px;
    }
    .${ROOT_CLASS}__header-fav-chip:hover {
      color: hsl(var(--hsl-c2, 333 60% 82%));
    }
    .${ROOT_CLASS}__header-fav-chip:hover .${ROOT_CLASS}__header-fav-name {
      text-decoration: underline;
    }
    .${ROOT_CLASS}__header-fav-chip--text {
      font-weight: 500;
      padding-left: 4px;
    }
    .${ROOT_CLASS}__header-fav-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: hsla(var(--hsl-b6, 333 12% 20%), 0.6);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    .${ROOT_CLASS}__header-fav-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1 1 auto;
    }
    .${ROOT_CLASS}__header-favouriters-muted {
      opacity: 0.85;
      font-weight: 400;
      padding: 4px 2px 8px;
    }

    .${OEP_OMDB_WRAP_CLASS} {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 2px 0 4px;
    }
    .${OEP_OMDB_ROW_CLASS} {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 10px;
      margin: 0;
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .${OEP_OMDB_ROW_CLASS}__label {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.92;
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    a.${OEP_OMDB_ROW_CLASS}__label {
      text-decoration: none;
      border-bottom: 1px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
      cursor: pointer;
      transition: color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
    }
    a.${OEP_OMDB_ROW_CLASS}__label:hover {
      opacity: 1;
      color: hsl(var(--hsl-c2, 333 72% 78%));
      border-bottom-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
    }
    a.${OEP_OMDB_ROW_CLASS}__label:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__body {
      flex: 1 1 auto;
      min-width: 0;
    }
    .${OEP_OMDB_ROW_CLASS}__body--muted {
      opacity: 0.5;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link {
      color: inherit;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link:hover {
      color: hsl(var(--hsl-c2, 333 60% 72%));
      opacity: 1;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__body--error {
      color: #e05c5c;
      opacity: 0.95;
    }
    .${OEP_OMDB_ROW_CLASS}__ranks {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 0.2em;
      vertical-align: baseline;
    }
    .${OEP_OMDB_ROW_CLASS}__rank-muted {
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: none;
      opacity: 1;
      color: hsl(var(--hsl-l1, 0 0% 72%));
    }
    .${OEP_OMDB_ROW_CLASS}__rank-value {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.02em;
      color: hsl(var(--hsl-l1, 0 0% 97%));
      font-variant-numeric: tabular-nums;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value {
      text-decoration: none;
      color: inherit;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value:hover {
      color: hsl(var(--hsl-c2, 333 72% 78%));
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__rank-sep {
      font-size: 14px;
      opacity: 0.45;
      font-weight: 500;
      margin-right: 0.05em;
    }

    .${OEP_OMDB_ROW_CLASS}__dist-anchor {
      position: relative;
      display: inline;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger {
      cursor: help;
      text-decoration: underline;
      text-decoration-style: dotted;
      text-underline-offset: 2px;
      text-decoration-color: hsla(var(--hsl-l1, 0 0% 90%), 0.35);
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:hover,
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
      text-decoration-color: hsl(var(--hsl-c2, 333 60% 65%) / 0.65);
      outline: none;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
      box-shadow: 0 0 0 2px hsla(var(--hsl-c2, 333 60% 70%), 0.45);
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-popover {
      min-width: 20rem;
      max-width: min(34rem, calc(100vw - 16px));
      padding: 8px 10px 9px;
      border-radius: 8px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      border: 1px solid hsl(var(--hsl-b4, 333 18% 22%));
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      pointer-events: auto;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-head {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      opacity: 0.5;
      margin-bottom: 6px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-row {
      display: grid;
      grid-template-columns: 3.75rem minmax(0, 1fr) 2.25rem;
      align-items: center;
      gap: 6px 10px;
      margin-top: 4px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-head + .${OEP_OMDB_ROW_CLASS}__dist-row {
      margin-top: 0;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-score {
      justify-self: stretch;
      text-align: right;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: hsl(var(--hsl-l1, 0 0% 86%));
    }
    .${OEP_OMDB_ROW_CLASS}__dist-bar-track {
      height: 5px;
      border-radius: 3px;
      background: hsla(var(--hsl-b5, 333 18% 28%), 0.55);
      overflow: hidden;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-bar {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(
        90deg,
        hsl(var(--hsl-c1, 333 89% 58%)),
        hsl(var(--hsl-c2, 333 60% 62%))
      );
      min-width: 0;
      transition: width 100ms ease;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-count {
      text-align: right;
      font-variant-numeric: tabular-nums;
      opacity: 0.88;
      font-weight: 600;
    }

    .${OEP_OMDB_VOTE_CLASS} {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .${OEP_OMDB_VOTE_CLASS}__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      min-width: 0;
    }
    .${OEP_OMDB_VOTE_CLASS}__label {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 1;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }
    .${OEP_OMDB_VOTE_CLASS}__stars {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit {
      position: relative;
      width: 1.58em;
      height: 1.48em;
      flex-shrink: 0;
      transition: transform 120ms ease, filter 120ms ease;
    }
    .${OEP_OMDB_VOTE_CLASS}__stars:hover .${OEP_OMDB_VOTE_CLASS}__unit {
      filter: brightness(1.05);
    }
    .${OEP_OMDB_VOTE_CLASS}__icon {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -52%);
      font-size: 1.22rem;
      line-height: 1;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--empty {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--half,
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--half {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--empty,
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--empty,
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--half {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--empty {
      opacity: 0.5;
      color: hsl(var(--hsl-b6, 333 12% 42%));
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--full,
    .${OEP_OMDB_VOTE_CLASS}__icon--half {
      color: #ffc14d;
      filter: drop-shadow(0 0 5px hsla(38, 100%, 55%, 0.28))
        drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--half {
      color: #ffca5c;
    }
    .${OEP_OMDB_VOTE_CLASS}__half {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      z-index: 2;
      border-radius: 0;
    }
    .${OEP_OMDB_VOTE_CLASS}__half:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 1px;
    }
    .${OEP_OMDB_VOTE_CLASS}__half--left { left: 0; }
    .${OEP_OMDB_VOTE_CLASS}__half--right { right: 0; }
    /* First star: narrow left strip = 0★, then 0.5 / 1.0 halves. */
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--zero {
      left: 0;
      width: 26%;
      z-index: 3;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--left {
      left: 26%;
      width: 37%;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--right {
      left: auto;
      right: 0;
      width: 37%;
    }
    .${OEP_OMDB_VOTE_CLASS}--busy .${OEP_OMDB_VOTE_CLASS}__half {
      cursor: wait;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}--busy {
      opacity: 0.72;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear {
      font: inherit;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l1, 0 0% 82%));
      cursor: pointer;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear:hover {
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${OEP_OMDB_VOTE_CLASS}__clear:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear--concealed {
      visibility: hidden;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__status {
      font-size: 10px;
      opacity: 0.75;
      width: 100%;
    }
    .${OEP_OMDB_VOTE_CLASS}__status--error {
      color: #e05c5c;
      opacity: 0.95;
    }

    .btn-osu-big.${BEATCONNECT_DL_PAIRED_CLASS} {
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      margin-right: 0 !important;
    }
    .${BEATCONNECT_DL_BTN_CLASS} {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 5px 5px 0;
      min-width: 0;
      width: fit-content;
      max-width: 88px;
      align-self: stretch;
      border-radius: 0 4px 4px 0;
      border: none;
      padding: 4px 5px;
      text-decoration: none;
      cursor: pointer;
      text-transform: none;
      vertical-align: middle;
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h2));
      border-left: 1px solid hsl(var(--hsl-b5));
      transition: background-color 120ms ease, color 120ms ease,
        border-color 120ms ease;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_CLASS} {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: auto;
      max-width: 100%;
      gap: 3px;
      text-align: center;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_ICON_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      margin: 0;
      line-height: 0;
      font-size: 26px;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_LABEL_CLASS} {
      display: block;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: 0.02em;
      max-width: 100%;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .oep-beatconnect-logo {
      display: block;
      height: 1em;
      width: auto;
      max-height: 26px;
      object-fit: contain;
    }

    .${BEATCONNECT_DL_BTN_CLASS}:hover,
    .${BEATCONNECT_DL_BTN_CLASS}:focus {
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h1));
      border-left-color: hsl(var(--hsl-b4));
    }
    .${BEATCONNECT_DL_BTN_CLASS}:active {
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h1));
      border-left-color: hsl(var(--hsl-b4));
    }
    .${BEATCONNECT_DL_BTN_CLASS}:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2));
      outline-offset: 2px;
    }

    .beatmapset-header__buttons button.btn-osu-big--beatmapset-header-square.${BEATMAPSET_FAV_BTN_FAVOURITED_CLASS} {
      --bg: hsl(333, 72%, 58%);
      --hover-bg: hsl(333, 72%, 50%);
      --focus-bg: var(--hover-bg);
      --active-bg: var(--hover-bg);
      --colour: #fff;
      --hover-colour: #fff;
      --focus-colour: #fff;
      --active-colour: #fff;
      color: #fff;
    }

    /* Single always-visible nomod star line; hide osu-web duplicate on picker hover. */
    .beatmapset-header
      .beatmapset-header__diff-extra--star-difficulty:not([${HEADER_NOMOD_STAR_ATTR}]) {
      display: none !important;
    }
    .beatmapset-header__diff-extra--star-difficulty[${HEADER_NOMOD_STAR_ATTR}] {
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .beatmapset-header__diff-extra--star-difficulty[${HEADER_NOMOD_STAR_ATTR}] .fas.fa-star {
      font-size: 1em;
      color: inherit;
      vertical-align: baseline;
    }

    .beatmapset-header.oep-diff-beside-picker .beatmapset-header__diff-name {
      display: none !important;
    }
    .beatmapset-header.oep-diff-beside-picker [${HEADER_NOMOD_STAR_ATTR}="1"] {
      display: none !important;
    }
    /*
     * --diff is mirrored from .beatmap-icon onto the active cell only in JS.
     * --oep-diff-muted: pastel mix for the active cell frame + meta text (not the outer tray).
     */
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-header__beatmap-picker-box {
      width: auto;
      max-width: none;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child {
      --oep-diff-muted: color-mix(
        in srgb,
        var(--diff, hsl(var(--hsl-c1))) 44%,
        #ffffff
      );
    }
    .beatmapset-header.oep-diff-beside-picker .beatmapset-beatmap-picker {
      /* Keep tray background height consistent for single vs multi-diff sets. */
      min-height: 4rem;
      align-items: stretch;
      box-sizing: border-box;
    }
    /* Active cell: [ icon | diffname / SR ] — two columns, text stacked in column 2. */
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child {
      display: inline-flex !important;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.5rem 0.65rem;
      padding: 0.35rem 0.9rem 0.4rem;
      width: auto !important;
      height: auto !important;
      min-height: 2.85rem;
      box-sizing: border-box;
      max-width: min(100%, 22rem);
      position: relative;
      flex-shrink: 0;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active::before,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child::before {
      z-index: 0;
      border-color: var(--oep-diff-muted) !important;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active
      > .beatmap-icon,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active
      > :first-child:not(.oep-picker-active-meta),
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child
      > .beatmap-icon,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child
      > :first-child:not(.oep-picker-active-meta) {
      flex-shrink: 0;
      align-self: center;
      position: relative;
      z-index: 1;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.1rem;
      min-width: 0;
      flex: 1 1 auto;
      line-height: 1.22;
      text-align: left;
      position: relative;
      z-index: 1;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__title-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 0.35rem;
      min-width: 0;
      max-width: 100%;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__version {
      font-weight: 600;
      font-size: 1rem;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 0 1 auto;
      min-width: 0;
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      font-size: 9px;
      font-weight: 600;
      margin-left: 0;
      color: var(--oep-diff-muted);
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra
      .oep-picker-active-meta__guest-user {
      color: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra
      .oep-picker-active-meta__guest-user.js-usercard:hover {
      text-decoration: underline;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__star {
      display: inline-flex;
      align-items: baseline;
      gap: 0.2em;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__star .fas.fa-star {
      font-size: 1em;
      color: var(--oep-diff-muted);
      vertical-align: baseline;
    }

    /*
     * Beatmap leaderboard hit columns (GREAT/OK/MEH/MISS etc.) — same palette as
     * user-profile score card .oep-score-stats__val--* (see user-profile.js).
     */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300 * {
      color: #78dcff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100 * {
      color: #84e03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50 * {
      color: #e0b03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss * {
      color: #e05c5c;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--300 {
      color: #78dcff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--100 {
      color: #84e03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--50 {
      color: #e0b03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--miss {
      color: #e05c5c;
    }
    /* CTB hit columns (L / DRP) */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l * {
      color: #5eead4;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp * {
      color: #93c5fd;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-l {
      color: #5eead4;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-drp {
      color: #93c5fd;
    }
    /* Mania PERFECT / GOOD */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect * {
      color: #ffd966;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good * {
      color: #7dd87a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-perfect {
      color: #ffd966;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-good {
      color: #7dd87a;
    }
    /* PP column — all rulesets */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-beatmap-scoreboard-pp-value {
      color: #c4b5fd;
    }
    /* Prevent overflow when the mod extender tab sits next to the icon. */
    .beatmapset-scoreboard .beatmap-scoreboard-table__mods .beatmap-scoreboard-mod {
      overflow: visible;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort {
      display: inline-block;
      margin-left: 0.28em;
      padding: 0 1px;
      vertical-align: middle;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.32);
      cursor: pointer;
      font: inherit;
      font-size: 0.62em;
      line-height: 1;
      position: relative;
      top: -0.06em;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:hover {
      color: rgba(255, 255, 255, 0.55);
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort--active {
      color: #8fd4ff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.45);
      outline-offset: 1px;
      border-radius: 2px;
    }
    .oep-scoreboard-tools-row {
      box-sizing: border-box;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem 1.25rem;
      margin: 0 0 0.75rem 0;
      width: 100%;
    }
    .oep-scoreboard-tools-row .oep-user-search {
      margin: 0;
      flex: 1 1 14rem;
      min-width: 0;
    }
    .oep-scoreboard-tools-row .oep-rate-edit-filter {
      margin: 0;
      flex: 0 0 auto;
      max-width: none;
      padding-top: 7px;
    }
    .oep-rate-edit-filter {
      box-sizing: border-box;
      margin: 0 0 0.5rem 0;
      max-width: 34rem;
    }
    .oep-rate-edit-filter label {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      cursor: pointer;
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.65);
      user-select: none;
    }
    .oep-rate-edit-filter input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      accent-color: #66ccff;
    }
    /* Beatmap scoreboard user search */
    .oep-user-search {
      box-sizing: border-box;
      margin: 0 0 1rem 0;
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 100%;
    }
    .oep-user-search__bar {
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 34rem;
    }
    .oep-user-search__input {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.92);
      font: inherit;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .oep-user-search__input:focus {
      border-color: rgba(102, 204, 255, 0.5);
      background: rgba(255, 255, 255, 0.09);
    }
    .oep-user-search__input::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }
    .oep-user-search__btn {
      flex-shrink: 0;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .oep-user-search__btn:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.28);
      color: rgba(255, 255, 255, 0.92);
    }
    .oep-user-search__btn:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.4);
      outline-offset: 1px;
    }
    .oep-user-search__btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .oep-user-search__btn--go {
      background: rgba(102, 204, 255, 0.12);
      border-color: rgba(102, 204, 255, 0.3);
      color: #8fd4ff;
    }
    .oep-user-search__btn--go:hover:not(:disabled) {
      background: rgba(102, 204, 255, 0.2);
      border-color: rgba(102, 204, 255, 0.5);
      color: #b3e3ff;
    }
    .oep-user-search__btn--reset[hidden] {
      display: none;
    }
    .oep-user-search__status {
      margin-top: 0.4rem;
      max-width: 34rem;
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.5);
      min-height: 1em;
    }
    .oep-user-search__result {
      margin-top: 0.6rem;
      overflow: visible;
      width: 100%;
      max-width: 100%;
    }
    .oep-user-search--no-api .oep-user-search__input:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }
    /* Same wrapper osu-web uses around the real table: sets --perfect-color, overflow-x, etc. */
    .oep-user-search__result .beatmap-scoreboard-table {
      max-width: 100%;
    }
    /* Searched-user result row — works both in the mini-table and in the real table */
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__cell,
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result]:hover > td.beatmap-scoreboard-table__cell {
      background-color: rgba(167, 139, 250, 0.12);
    }
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__cell:first-child {
      box-shadow: inset 3px 0 0 rgba(167, 139, 250, 0.55);
    }
    /* Cloned row includes osu-web’s hover-only ⋯ menu column; hide for lookup result */
    .oep-user-search__result thead th.beatmap-scoreboard-table__header--popup-menu {
      display: none !important;
    }
    tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__popup-menu {
      display: none !important;
    }
    /* Custom-rate (non 1.00×/1.50×) scores — slightly dimmed. */
    tr[${RATE_EDIT_ROW_ATTR}] {
      opacity: 0.6;
    }
    tr[${RATE_EDIT_ROW_ATTR}]:hover {
      opacity: 0.9;
    }
    /* Non-top wildcard scores for a player — more heavily dimmed; overrides rate-edit above. */
    tr[${WILDCARD_DUPE_ROW_ATTR}] {
      opacity: 0.38;
    }
    tr[${WILDCARD_DUPE_ROW_ATTR}]:hover {
      opacity: 0.72;
    }
  `;

  const mainStyle = manageStyle(STYLE_ID, CSS);
  const modGridStyle = manageStyle(MOD_GRID_STYLE_ID, MOD_GRID_CSS);

  function ensureStyles() {
    mainStyle.inject();
  }

  function ensureModGridStyles() {
    modGridStyle.inject();
  }

  /**
   * @param {HTMLElement} modRoot
   * @returns {0|1|2}
   */
  function modDifficultyRow(modRoot) {
    const c = modRoot.className || "";
    if (/mod--type-DifficultyReduction/i.test(c)) return 0;
    if (/mod--type-DifficultyIncrease/i.test(c)) return 1;
    return 2;
  }

  /**
   * @param {HTMLElement} btn
   */
  function modButtonAcronym(btn) {
    const icon = btn.querySelector(".mod__icon[data-acronym]");
    const a = icon?.getAttribute("data-acronym")?.trim().toUpperCase();
    return a || "";
  }

  /**
   * @param {HTMLElement} btn
   */
  function modStableColumn(btn) {
    const ac = modButtonAcronym(btn);
    if (ac && STABLE_MOD_ACRONYMS.has(ac)) return true;
    return false;
  }

  /**
   * @param {HTMLElement} btn  `.beatmap-scoreboard-mod` strip button
   */
  function isBeatmapScoreboardModStripButtonOn(btn) {
    if (!(btn instanceof HTMLElement) || btn.disabled) return false;
    if (btn.classList.contains("beatmap-scoreboard-mod--enabled")) return true;
    if (btn.getAttribute("aria-pressed") === "true") return true;
    return false;
  }

  /**
   * Turn off each active mod filter by clicking the real strip buttons (not NM — that toggles “no mod”).
   * One click per frame so React can settle (exclusive mods, URL sync).
   * @param {HTMLElement} modsEl
   */
  function resetBeatmapScoreboardModSelection(modsEl) {
    mergedModCycleStep.clear();
    const hadWildcards = getWildcardMods().length > 0;
    if (hadWildcards) {
      clearWildcardState();
      for (const orig of modsEl.querySelectorAll(
        ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
      )) {
        if (!(orig instanceof HTMLElement)) continue;
        const ac = modButtonAcronym(orig);
        if (!ac) continue;
        updateCloneWildcardVisual(ac, modsEl, false);
      }
      const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
      if (scoreboardRoot instanceof HTMLElement) {
        clearWildcardMergedLeaderboard(scoreboardRoot);
      }
    }

    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (clone instanceof HTMLElement) {
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
      }
    }

    const maxSteps = 40;
    let step = 0;
    const run = () => {
      if (++step > maxSteps) {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
        return;
      }
      for (const btn of modsEl.querySelectorAll(
        ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
      )) {
        if (!(btn instanceof HTMLElement)) continue;
        const ac = modButtonAcronym(btn);
        if (!ac || ac === "NM") continue;
        if (isBeatmapScoreboardModStripButtonOn(btn)) {
          btn.click();
          window.requestAnimationFrame(run);
          return;
        }
      }
      syncBeatmapModGridCloneHighlights(modsEl);
      syncBeatmapScoreboardModResetButton(modsEl);
    };
    window.requestAnimationFrame(run);
  }

  /**
   * @param {HTMLElement} modsEl
   */
  function syncBeatmapScoreboardModResetButton(modsEl) {
    const resetBtn = modsEl.querySelector(
      `:scope > .${MOD_GRID_CLASS}__hdr-corner .${MOD_GRID_CLASS}__reset-mods`,
    );
    if (!(resetBtn instanceof HTMLButtonElement)) return;
    const root = modsEl.closest(".beatmapset-scoreboard");
    const active =
      root instanceof HTMLElement
        ? getActiveBeatmapScoreboardFilterMods(root)
        : [];
    const hasWildcards = getWildcardMods().length > 0;
    const hasEnabledInWildcardMode =
      hasWildcards && getWildcardEnabledMods(modsEl).length > 0;
    resetBtn.disabled =
      active.length === 0 && !hasWildcards && !hasEnabledInWildcardMode;
  }

  /**
   * @param {Element|null|undefined} el
   */
  function destroyOsuWebQtipIfBound(el) {
    try {
      const $ = typeof window !== "undefined" && window.$;
      if (!$ || !el || !$.fn?.qtip) return;
      const $el = $(el);
      if ($el.data("qtip")) $el.qtip("destroy");
    } catch (_) {
      void 0;
    }
  }

  /**
   * qTip’s target can lose hover events when innerHTML is replaced, leaving the popup stuck.
   * @param {HTMLElement} root
   */
  function destroyOsuWebQtipOnElementSubtree(root) {
    if (!(root instanceof HTMLElement)) return;
    destroyOsuWebQtipIfBound(root);
    for (const node of root.querySelectorAll("*")) {
      destroyOsuWebQtipIfBound(node);
    }
  }

  /**
   * Copies markup from the hidden React strip button onto the visible grid clone.
   * @param {HTMLElement} clone
   * @param {HTMLElement} original
   */
  function replaceBeatmapModGridCloneInnerHTML(clone, original) {
    if (!(clone instanceof HTMLElement) || !(original instanceof HTMLElement))
      return;
    if (clone.innerHTML === original.innerHTML) return;
    destroyOsuWebQtipOnElementSubtree(clone);
    clone.innerHTML = original.innerHTML;
  }

  /**
   * Mirror osu-web state from hidden originals onto visible pile clones (selection highlight, counts).
   * @param {HTMLElement} modsEl
   */
  function syncBeatmapModGridCloneHighlights(modsEl) {
    if (!modsEl.hasAttribute(MOD_GRID_ATTR)) return;
    const hasActiveWildcards = getWildcardMods().length > 0;

    for (const clone of modsEl.querySelectorAll(
      `[data-oep-merged-mod="${MERGED_MOD_DT_NC}"], [data-oep-merged-mod="${MERGED_MOD_SD_PF}"]`,
    )) {
      if (!(clone instanceof HTMLElement)) continue;
      const mergeId = clone.getAttribute("data-oep-merged-mod");
      if (mergeId) syncMergedModCloneHighlights(modsEl, clone, mergeId);
    }

    for (const original of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(original instanceof HTMLElement)) continue;
      if (shouldSkipOriginalInModGridSync(modsEl, original)) continue;
      const clone = beatmapModGridOriginalToClone.get(original);
      if (!(clone instanceof HTMLElement)) continue;

      const ac = modButtonAcronym(original);
      const isWildcard = ac && (wildcardModState.get(ac) || 0) > 0;

      if (isWildcard) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        continue;
      }

      if (hasActiveWildcards) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        const origOn = isBeatmapScoreboardModStripButtonOn(original);
        if (origOn) {
          clone.classList.add("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "true");
        } else {
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        clone.classList.remove(MOD_WILDCARD_CLASS);
        clone.removeAttribute(MOD_WILDCARD_ATTR);
        continue;
      }

      if (clone.className !== original.className) {
        clone.className = original.className;
      }

      for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
        const v = original.getAttribute(attr);
        if (v == null) clone.removeAttribute(attr);
        else clone.setAttribute(attr, v);
      }

      clone.disabled = original.disabled;

      replaceBeatmapModGridCloneInnerHTML(clone, original);

      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
    }
  }

  /**
   * @param {HTMLElement} modsEl
   */
  function stopBeatmapScoreboardModGridLive(modsEl) {
    const h = beatmapModGridLiveHandles.get(modsEl);
    if (h) {
      window.clearTimeout(h.debounceId);
      window.clearTimeout(h.modStateDebounceId);
      h.mo?.disconnect();
      h.modStateMo?.disconnect();
      beatmapModGridLiveHandles.delete(modsEl);
    }
    modsEl.removeAttribute(MOD_RESET_BTN_SYNC_ATTR);
    teardownBeatmapModGrid(modsEl);
  }

  function teardownBeatmapModGrid(modsEl) {
    if (!(modsEl instanceof HTMLElement)) return;

    clearWildcardState();
    const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
    if (scoreboardRoot instanceof HTMLElement) {
      clearWildcardMergedLeaderboard(scoreboardRoot);
    }

    modsEl.removeAttribute(MOD_GRID_ATTR);
    modsEl.classList.remove(MOD_GRID_CLASS, MOD_GRID_COLLAPSED_CLASS);

    // Unhide original React-managed buttons (kept in place, never moved).
    for (const btn of modsEl.querySelectorAll(
      ":scope > [data-oep-mod-hidden]",
    )) {
      btn.removeAttribute("data-oep-mod-hidden");
    }

    // Remove our grid elements (headers, labels, piles containing clones).
    for (const ch of [...modsEl.children]) {
      if (!ch.classList.contains("beatmap-scoreboard-mod")) {
        ch.remove();
      }
    }
  }

  /** Reset all wildcard state (used on teardown or beatmap change). */
  function clearWildcardState() {
    mergedModCycleStep.clear();
    wildcardModState.clear();
    wildcardSeqCounter = 0;
    window.clearTimeout(wildcardDebounceTimer);
    wildcardDebounceTimer = 0;
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }
  }

  /** @returns {string[]} Acronyms currently in wildcard state. */
  function getWildcardMods() {
    const out = [];
    for (const [ac, seq] of wildcardModState) {
      if (seq > 0) out.push(ac);
    }
    return out;
  }

  /**
   * Mark a mod as wildcard. If this would exceed MAX_WILDCARD_MODS, the oldest
   * wildcard is evicted and its clone visual is reset.
   * @param {string} acronym
   * @param {HTMLElement} modsEl
   */
  function enableWildcard(acronym, modsEl) {
    const current = getWildcardMods().filter((a) => a !== acronym);
    while (current.length >= MAX_WILDCARD_MODS) {
      const oldest = current.sort(
        (a, b) =>
          (wildcardModState.get(a) || 0) - (wildcardModState.get(b) || 0),
      )[0];
      wildcardModState.set(oldest, 0);
      current.splice(current.indexOf(oldest), 1);
      updateCloneWildcardVisual(oldest, modsEl, false);
    }
    wildcardSeqCounter += 1;
    wildcardModState.set(acronym, wildcardSeqCounter);
  }

  /**
   * @param {string} acronym
   * @param {HTMLElement} modsEl
   * @param {boolean} isWildcard
   */
  function updateCloneWildcardVisual(acronym, modsEl, isWildcard) {
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      if (modButtonAcronym(orig) !== acronym) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (isWildcard) {
        clone.classList.add(MOD_WILDCARD_CLASS);
        clone.setAttribute(MOD_WILDCARD_ATTR, "1");
      } else {
        clone.classList.remove(MOD_WILDCARD_CLASS);
        clone.removeAttribute(MOD_WILDCARD_ATTR);
      }
    }
  }

  /** @returns {boolean} */
  function isWildcardFeatureAvailable() {
    return auth.isConfigured() && settings.isEnabled(SCOREBOARD_MOD_GRID_ID);
  }

  /**
   * Given enabled mods and wildcard mods, generate all mod combinations.
   * e.g. enabled=[DT], wildcard=[HD,FL] → [[DT],[DT,HD],[DT,FL],[DT,HD,FL]]
   * @param {string[]} enabledMods
   * @param {string[]} wildcardMods
   * @returns {string[][]}
   */
  function generateModCombinations(enabledMods, wildcardMods) {
    const combos = [];
    const n = wildcardMods.length;
    for (let mask = 0; mask < 1 << n; mask++) {
      const combo = [...enabledMods];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) combo.push(wildcardMods[i]);
      }
      combos.push(combo.sort());
    }
    return combos;
  }

  /**
   * Matches osu-web scoreboard tabs (global / country / friend / team). Team tab
   * is omitted from the DOM when the viewer has no team; then only three tabs exist.
   * @param {HTMLElement|null|undefined} scoreboardRoot  `.beatmapset-scoreboard`
   * @returns {"global"|"country"|"friend"|"team"}
   */
  function readBeatmapScoreboardLeaderboardType(scoreboardRoot) {
    const order = ["global", "country", "friend", "team"];
    if (!(scoreboardRoot instanceof HTMLElement)) return "global";
    const tabs = [
      ...scoreboardRoot.querySelectorAll(":scope > .page-tabs > .page-tabs__tab"),
    ];
    if (tabs.length) {
      const activeIdx = tabs.findIndex((t) =>
        t.classList.contains("page-tabs__tab--active"),
      );
      const mapOrder =
        tabs.length === 4 ? order : order.filter((t) => t !== "team");
      if (activeIdx >= 0 && activeIdx < mapOrder.length) {
        return /** @type {"global"|"country"|"friend"|"team"} */ (
          mapOrder[activeIdx]
        );
      }
    }
    const raw = scoreboardRoot.getAttribute("data-scoreboard-state");
    if (raw) {
      try {
        const t = JSON.parse(raw)?.currentType;
        if (t === "global" || t === "country" || t === "friend" || t === "team") {
          return t;
        }
      } catch {
        void 0;
      }
    }
    return "global";
  }

  /**
   * Fetch leaderboard scores for multiple mod combinations, merge, dedup, sort,
   * and return the top `limit` scores. Uses `GET /beatmaps/{beatmapId}/scores` on
   * osu.ppy.sh (site JSON), not `/api/v2`.
   * @param {string} beatmapId  difficulty id (same as in `/beatmaps/{id}/scores`)
   * @param {string[][]} modCombos
   * @param {string} mode
   * @param {number} limit
   * @param {AbortSignal} signal
   * @param {"global"|"country"|"friend"|"team"} leaderboardType
   * @returns {Promise<object[]>}
   */
  async function fetchAndMergeWildcardLeaderboards(
    beatmapId,
    modCombos,
    mode,
    limit,
    signal,
    leaderboardType,
  ) {
    const type =
      leaderboardType === "country" ||
      leaderboardType === "friend" ||
      leaderboardType === "team"
        ? leaderboardType
        : "global";
    const fetches = modCombos.map((mods) =>
      OsuExpertPlus.api
        .getBeatmapScoresWebsite(beatmapId, {
          mode,
          type,
          // Omitting mods[] returns every mod combination; NM is required for nomod.
          mods: mods.length ? mods : ["NM"],
          limit: EXTENDED_LB_LIMIT,
        })
        .then((res) => res?.scores || [])
        .catch(() => []),
    );

    const results = await Promise.all(fetches);
    if (signal.aborted) return [];

    const seen = new Set();
    const merged = [];
    for (const scores of results) {
      for (const s of scores) {
        const id = leaderboardScoreId(s);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        merged.push(s);
      }
    }
    sortLeaderboardScoresLikeTable(merged);
    return merged.slice(0, limit);
  }

  /**
   * Replace the scoreboard tbody with API-fetched merged wildcard rows.
   * @param {HTMLElement} scoreboardRoot
   * @param {object[]} scores
   */
  function renderWildcardMergedLeaderboard(scoreboardRoot, scores) {
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    const templateRow = tbody.querySelector(
      "tr.beatmap-scoreboard-table__body-row",
    );
    if (!(templateRow instanceof HTMLTableRowElement)) return;

    const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
    const modTemplateBtn =
      resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
    const beatmapId = getBeatmapPageBeatmapId();
    const mapFullCombo = beatmapId
      ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
      : null;

    const existingExtendedRows = tbody.querySelectorAll(
      `tr[${EXTENDED_SCORE_ROW_ATTR}]`,
    );
    existingExtendedRows.forEach((r) => r.remove());

    const existingWildcardRows = tbody.querySelectorAll(
      `tr[${WILDCARD_MERGED_ROW_ATTR}]`,
    );
    existingWildcardRows.forEach((r) => r.remove());

    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());

    const nativeRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    for (const nr of nativeRows) nr.style.display = "none";

    // Insert wildcard rows before the hidden native rows so nth-child alternation
    // starts at 1 and matches the visual first row.
    const firstNative = nativeRows[0] ?? null;

    // Track which user ids have already appeared so secondary scores can be dimmed.
    const seenUserIds = new Set();

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (!score || typeof score !== "object") continue;
      const row = /** @type {HTMLTableRowElement} */ (
        templateRow.cloneNode(true)
      );
      row.setAttribute(WILDCARD_MERGED_ROW_ATTR, "1");
      row.removeAttribute(RATE_EDIT_ROW_ATTR);
      row.removeAttribute(WILDCARD_DUPE_ROW_ATTR);
      row.style.display = "";
      row.classList.remove(
        "beatmap-scoreboard-table__body-row--friend",
        "beatmap-scoreboard-table__body-row--first",
        "beatmap-scoreboard-table__body-row--self",
      );

      // Strip per-user decorations from the player cell before re-applying score data.
      if (colMap.user != null) {
        const playerTd = row.cells[colMap.user];
        if (playerTd) {
          // Remove team flag link (osu! tournament teams show a flag next to the username).
          for (const teamLink of playerTd.querySelectorAll(
            'a[href*="/teams/"]',
          )) {
            teamLink.remove();
          }
        }
      }

      applyApiScoreToBeatmapScoreRow(
        row,
        score,
        i + 1,
        colMap,
        realTable,
        templateRow,
        modTemplateBtn,
        mapFullCombo,
      );

      // Sync js-usercard data-user-id so hover cards reference the correct user.
      const uid = score.user?.id ?? score.user_id;
      if (colMap.user != null && uid != null) {
        const playerTd = row.cells[colMap.user];
        const card = playerTd?.querySelector(".js-usercard");
        if (card instanceof HTMLElement) {
          card.setAttribute("data-user-id", String(uid));
        }
      }

      // Dim rows that are not this player's highest-ranked entry in the merged list.
      const uidKey = uid != null ? String(uid) : null;
      if (uidKey != null) {
        if (seenUserIds.has(uidKey)) {
          row.setAttribute(WILDCARD_DUPE_ROW_ATTR, "1");
        } else {
          seenUserIds.add(uidKey);
        }
      }

      // Dim rows with a custom rate (anything other than 1.00× or 1.50×).
      if (scoreHasNonstandardRate(score)) {
        row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      }

      tbody.insertBefore(row, firstNative);
    }

    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }

  /**
   * Remove wildcard-merged rows and restore native rows.
   * @param {HTMLElement|null} scoreboardRoot
   */
  function clearWildcardMergedLeaderboard(scoreboardRoot) {
    if (!scoreboardRoot) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    for (const nr of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      /** @type {HTMLElement} */ (nr).style.display = "";
    }
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }

  /**
   * Remove player-lookup rows from the main leaderboard and show osu-web rows again.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   * @param {Element|null|undefined} modsEl
   * @param {boolean} [rescheduleWildcard=true] When true and wildcard mods are active, re-runs the merged fetch (e.g. user clicked Reset).
   */
  function clearUserSearchMergedLeaderboard(
    scoreboardRoot,
    modsEl,
    rescheduleWildcard = true,
  ) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());
    for (const nr of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      /** @type {HTMLElement} */ (nr).style.display = "";
    }
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
    if (!rescheduleWildcard) return;
    const mods =
      modsEl instanceof HTMLElement
        ? modsEl
        : scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (mods instanceof HTMLElement && getWildcardMods().length > 0) {
      scheduleWildcardFetch(mods);
    }
  }

  /**
   * Collect the "enabled" (not wildcard, not disabled) mods from our tracked state.
   * @param {HTMLElement} modsEl
   * @returns {string[]}
   */
  function getWildcardEnabledMods(modsEl) {
    const enabled = [];
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      if (s === 1) enabled.push("DT");
      if (s === 2) enabled.push("NC");
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      if (s === 1) enabled.push("SD");
      if (s === 2) enabled.push("PF");
    }
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (shouldSkipOriginalInModGridSync(modsEl, orig)) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      const isWildcard = (wildcardModState.get(ac) || 0) > 0;
      if (isWildcard) continue;
      if (
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true"
      ) {
        enabled.push(ac);
      }
    }
    return enabled;
  }

  /**
   * Trigger the wildcard leaderboard fetch-merge-render cycle after debounce.
   * @param {HTMLElement} modsEl
   */
  function scheduleWildcardFetch(modsEl) {
    window.clearTimeout(wildcardDebounceTimer);
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }

    const wildcards = getWildcardMods();
    const scoreboardRoot =
      modsEl.closest(".beatmapset-scoreboard") ||
      document.querySelector(".beatmapset-scoreboard");
    if (!(scoreboardRoot instanceof HTMLElement)) return;

    if (wildcards.length === 0) {
      clearWildcardMergedLeaderboard(scoreboardRoot);
      const tableWrap = scoreboardRoot.querySelector(
        ".beatmap-scoreboard-table",
      );
      if (tableWrap instanceof HTMLElement) {
        tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
      }
      syncActiveModsToOriginals(modsEl);
      return;
    }

    const enabledMods = getWildcardEnabledMods(modsEl);
    const beatmapId = getBeatmapPageBeatmapId();
    const mode = getBeatmapPageRuleset();
    if (!beatmapId) return;

    const combos = generateModCombinations(enabledMods, wildcards);

    const tableWrap = scoreboardRoot.querySelector(".beatmap-scoreboard-table");
    if (tableWrap instanceof HTMLElement) {
      tableWrap.classList.add(WILDCARD_LOADING_CLASS);
    }

    wildcardAbortCtrl = new AbortController();
    const signal = wildcardAbortCtrl.signal;

    wildcardDebounceTimer = window.setTimeout(() => {
      wildcardDebounceTimer = 0;
      const leaderboardType =
        readBeatmapScoreboardLeaderboardType(scoreboardRoot);
      fetchAndMergeWildcardLeaderboards(
        beatmapId,
        combos,
        mode,
        EXTENDED_LB_LIMIT,
        signal,
        leaderboardType,
      )
        .then((merged) => {
          if (signal.aborted) return;
          if (tableWrap instanceof HTMLElement) {
            tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
          }
          if (merged.length > 0) {
            renderWildcardMergedLeaderboard(scoreboardRoot, merged);
          }
        })
        .catch(() => {
          if (tableWrap instanceof HTMLElement) {
            tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
          }
        });
    }, 1000);
  }

  /**
   * When leaving wildcard mode (all wildcards removed), click originals
   * to sync their enabled state with what the clones show.
   * @param {HTMLElement} modsEl
   */
  function syncActiveModsToOriginals(modsEl) {
    const cloneEnabled = buildBeatmapModGridCloneEnabledSet(modsEl);

    let clickQueue = [];
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      const origOn = isBeatmapScoreboardModStripButtonOn(orig);
      const shouldBeOn = cloneEnabled.has(ac);
      if (origOn !== shouldBeOn) clickQueue.push(orig);
    }

    let step = 0;
    const maxSteps = 40;
    const run = () => {
      if (++step > maxSteps || !clickQueue.length) {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
        return;
      }
      const btn = clickQueue.shift();
      btn.click();
      window.requestAnimationFrame(run);
    };
    if (clickQueue.length) window.requestAnimationFrame(run);
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {string} acronym
   * @returns {HTMLElement|null}
   */
  function findHiddenBeatmapModButton(modsEl, acronym) {
    const want = String(acronym || "")
      .trim()
      .toUpperCase();
    if (!want) return null;
    for (const btn of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(btn instanceof HTMLElement)) continue;
      if (modButtonAcronym(btn) === want) return btn;
    }
    return null;
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {boolean}
   */
  function beatmapModGridHasMergedDtNc(modsEl) {
    return Boolean(
      modsEl.querySelector(`[data-oep-merged-mod="${MERGED_MOD_DT_NC}"]`),
    );
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {boolean}
   */
  function beatmapModGridHasMergedSdPf(modsEl) {
    return Boolean(
      modsEl.querySelector(`[data-oep-merged-mod="${MERGED_MOD_SD_PF}"]`),
    );
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {HTMLElement} original
   * @returns {boolean}
   */
  function shouldSkipOriginalInModGridSync(modsEl, original) {
    const ac = modButtonAcronym(original);
    if (beatmapModGridHasMergedDtNc(modsEl) && (ac === "DT" || ac === "NC")) {
      return true;
    }
    if (beatmapModGridHasMergedSdPf(modsEl) && (ac === "SD" || ac === "PF")) {
      return true;
    }
    return false;
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {Set<string>}
   */
  function buildBeatmapModGridCloneEnabledSet(modsEl) {
    const set = new Set();
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      if (s === 1) set.add("DT");
      if (s === 2) set.add("NC");
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      if (s === 1) set.add("SD");
      if (s === 2) set.add("PF");
    }
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (beatmapModGridHasMergedDtNc(modsEl) && (ac === "DT" || ac === "NC")) {
        continue;
      }
      if (beatmapModGridHasMergedSdPf(modsEl) && (ac === "SD" || ac === "PF")) {
        continue;
      }
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true"
      ) {
        set.add(ac);
      }
    }
    return set;
  }

  function reconcileMergedModCycleFromDom(modsEl) {
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const dt = findHiddenBeatmapModButton(modsEl, "DT");
      const nc = findHiddenBeatmapModButton(modsEl, "NC");
      if (dt instanceof HTMLElement && nc instanceof HTMLElement) {
        let step = 0;
        if ((wildcardModState.get("DT") || 0) > 0) step = 3;
        else if (isBeatmapScoreboardModStripButtonOn(nc)) step = 2;
        else if (isBeatmapScoreboardModStripButtonOn(dt)) step = 1;
        mergedModCycleStep.set(MERGED_MOD_DT_NC, step);
      }
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const sd = findHiddenBeatmapModButton(modsEl, "SD");
      const pf = findHiddenBeatmapModButton(modsEl, "PF");
      if (sd instanceof HTMLElement && pf instanceof HTMLElement) {
        let step = 0;
        if ((wildcardModState.get("PF") || 0) > 0) step = 4;
        else if ((wildcardModState.get("SD") || 0) > 0) step = 3;
        else if (isBeatmapScoreboardModStripButtonOn(pf)) step = 2;
        else if (isBeatmapScoreboardModStripButtonOn(sd)) step = 1;
        mergedModCycleStep.set(MERGED_MOD_SD_PF, step);
      }
    }
  }

  function mergedModGridEffectiveStepCount(mergeId) {
    if (isWildcardFeatureAvailable()) {
      return mergeId === MERGED_MOD_DT_NC ? 4 : 5;
    }
    return mergeId === MERGED_MOD_DT_NC ? 3 : 3;
  }

  function finishMergedModStepApply(modsEl, mergeId, step) {
    mergedModCycleStep.set(mergeId, step);
    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
    scheduleWildcardFetch(modsEl);
  }

  function applyDtNcTargetStep(modsEl, targetStep) {
    const dt = findHiddenBeatmapModButton(modsEl, "DT");
    const nc = findHiddenBeatmapModButton(modsEl, "NC");
    if (!(dt instanceof HTMLElement) || !(nc instanceof HTMLElement)) return;
    let frames = 0;
    const tick = () => {
      if (++frames > 56) {
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, targetStep);
        return;
      }
      const dtOn = isBeatmapScoreboardModStripButtonOn(dt);
      const ncOn = isBeatmapScoreboardModStripButtonOn(nc);
      const wDt = (wildcardModState.get("DT") || 0) > 0;

      if (targetStep === 3) {
        if (wDt) {
          if (dtOn) {
            dt.click();
            requestAnimationFrame(tick);
            return;
          }
          if (ncOn) {
            nc.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
          return;
        }
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
          return;
        }
        enableWildcard("DT", modsEl);
        updateCloneWildcardVisual("DT", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
        return;
      }

      if (wDt) {
        wildcardModState.set("DT", 0);
        updateCloneWildcardVisual("DT", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }

      if (targetStep === 0) {
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 0);
        return;
      }
      if (targetStep === 1) {
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 1);
        return;
      }
      if (targetStep === 2) {
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 2);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function applySdPfTargetStep(modsEl, targetStep) {
    const sd = findHiddenBeatmapModButton(modsEl, "SD");
    const pf = findHiddenBeatmapModButton(modsEl, "PF");
    if (!(sd instanceof HTMLElement) || !(pf instanceof HTMLElement)) return;
    let frames = 0;
    const tick = () => {
      if (++frames > 64) {
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, targetStep);
        return;
      }
      const sdOn = isBeatmapScoreboardModStripButtonOn(sd);
      const pfOn = isBeatmapScoreboardModStripButtonOn(pf);
      const wSd = (wildcardModState.get("SD") || 0) > 0;
      const wPf = (wildcardModState.get("PF") || 0) > 0;

      if (targetStep === 4) {
        if (wPf) {
          if (sdOn) {
            sd.click();
            requestAnimationFrame(tick);
            return;
          }
          if (pfOn) {
            pf.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
          return;
        }
        if (wSd) {
          wildcardModState.set("SD", 0);
          updateCloneWildcardVisual("SD", modsEl, false);
          requestAnimationFrame(tick);
          return;
        }
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
          return;
        }
        enableWildcard("PF", modsEl);
        updateCloneWildcardVisual("PF", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
        return;
      }

      if (targetStep === 3) {
        if (wSd) {
          if (sdOn) {
            sd.click();
            requestAnimationFrame(tick);
            return;
          }
          if (pfOn) {
            pf.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
          return;
        }
        if (wPf) {
          wildcardModState.set("PF", 0);
          updateCloneWildcardVisual("PF", modsEl, false);
          requestAnimationFrame(tick);
          return;
        }
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
          return;
        }
        enableWildcard("SD", modsEl);
        updateCloneWildcardVisual("SD", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
        return;
      }

      if (wPf) {
        wildcardModState.set("PF", 0);
        updateCloneWildcardVisual("PF", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }
      if (wSd) {
        wildcardModState.set("SD", 0);
        updateCloneWildcardVisual("SD", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }

      if (targetStep === 0) {
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 0);
        return;
      }
      if (targetStep === 1) {
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 1);
        return;
      }
      if (targetStep === 2) {
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 2);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function applyMergedModTargetStep(modsEl, mergeId, targetStep) {
    if (mergeId === MERGED_MOD_DT_NC) {
      applyDtNcTargetStep(modsEl, targetStep);
    } else if (mergeId === MERGED_MOD_SD_PF) {
      applySdPfTargetStep(modsEl, targetStep);
    }
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {HTMLElement} clone
   * @param {string} mergeId
   */
  function syncMergedModCloneHighlights(modsEl, clone, mergeId) {
    if (!(clone instanceof HTMLElement)) return;
    const hasActiveWildcards = getWildcardMods().length > 0;
    const dt = findHiddenBeatmapModButton(modsEl, "DT");
    const nc = findHiddenBeatmapModButton(modsEl, "NC");
    const sd = findHiddenBeatmapModButton(modsEl, "SD");
    const pf = findHiddenBeatmapModButton(modsEl, "PF");

    if (mergeId === MERGED_MOD_DT_NC) {
      if (!(dt instanceof HTMLElement) || !(nc instanceof HTMLElement)) return;
      const step = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      const wDt = (wildcardModState.get("DT") || 0) > 0;
      if (step === 3 || wDt) {
        replaceBeatmapModGridCloneInnerHTML(clone, dt);
        clone.disabled = dt.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
      if (hasActiveWildcards) {
        if (step === 2) {
          replaceBeatmapModGridCloneInnerHTML(clone, nc);
          clone.disabled = nc.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(nc);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else if (step === 1) {
          replaceBeatmapModGridCloneInnerHTML(clone, dt);
          clone.disabled = dt.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(dt);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else {
          replaceBeatmapModGridCloneInnerHTML(clone, dt);
          clone.disabled = dt.disabled;
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        return;
      }
      if (step === 2) {
        replaceBeatmapModGridCloneInnerHTML(clone, nc);
        clone.disabled = nc.disabled;
        if (clone.className !== nc.className) clone.className = nc.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = nc.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      } else {
        replaceBeatmapModGridCloneInnerHTML(clone, dt);
        clone.disabled = dt.disabled;
        if (clone.className !== dt.className) clone.className = dt.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = dt.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      }
      return;
    }

    if (mergeId === MERGED_MOD_SD_PF) {
      if (!(sd instanceof HTMLElement) || !(pf instanceof HTMLElement)) return;
      const step = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      const wSd = (wildcardModState.get("SD") || 0) > 0;
      const wPf = (wildcardModState.get("PF") || 0) > 0;
      if (step === 4 || wPf) {
        replaceBeatmapModGridCloneInnerHTML(clone, pf);
        clone.disabled = pf.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      if (step === 3 || wSd) {
        replaceBeatmapModGridCloneInnerHTML(clone, sd);
        clone.disabled = sd.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
      if (hasActiveWildcards) {
        if (step === 2) {
          replaceBeatmapModGridCloneInnerHTML(clone, pf);
          clone.disabled = pf.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(pf);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else if (step === 1) {
          replaceBeatmapModGridCloneInnerHTML(clone, sd);
          clone.disabled = sd.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(sd);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else {
          replaceBeatmapModGridCloneInnerHTML(clone, sd);
          clone.disabled = sd.disabled;
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        return;
      }
      if (step === 2) {
        replaceBeatmapModGridCloneInnerHTML(clone, pf);
        clone.disabled = pf.disabled;
        if (clone.className !== pf.className) clone.className = pf.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = pf.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      } else {
        replaceBeatmapModGridCloneInnerHTML(clone, sd);
        clone.disabled = sd.disabled;
        if (clone.className !== sd.className) clone.className = sd.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = sd.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      }
    }
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {Record<string, HTMLElement>} piles
   * @param {HTMLElement} btn
   * @param {string} pileKey
   */
  function placeBeatmapModGridSingleClone(modsEl, piles, btn, pileKey) {
    const clone = btn.cloneNode(true);
    beatmapModGridOriginalToClone.set(btn, clone);
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      const ac = modButtonAcronym(btn);
      if (!ac || ac === "NM" || !isWildcardFeatureAvailable()) {
        btn.click();
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
        return;
      }

      const hasWildcards = getWildcardMods().length > 0;
      const isCurrentlyWildcard = (wildcardModState.get(ac) || 0) > 0;
      const cloneIsEnabled =
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true";

      if (isCurrentlyWildcard) {
        wildcardModState.set(ac, 0);
        updateCloneWildcardVisual(ac, modsEl, false);
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        scheduleWildcardFetch(modsEl);
      } else if (cloneIsEnabled) {
        if (!hasWildcards) {
          btn.click();
        }
        enableWildcard(ac, modsEl);
        updateCloneWildcardVisual(ac, modsEl, true);
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
        scheduleWildcardFetch(modsEl);
      } else {
        if (hasWildcards) {
          clone.classList.add("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "true");
          scheduleWildcardFetch(modsEl);
        } else {
          btn.click();
          window.requestAnimationFrame(() => {
            syncBeatmapModGridCloneHighlights(modsEl);
          });
        }
      }
      syncBeatmapScoreboardModResetButton(modsEl);
    });
    piles[pileKey]?.appendChild(clone);
    btn.setAttribute("data-oep-mod-hidden", "1");
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {Record<string, HTMLElement>} piles
   * @param {string} mergeId
   * @param {HTMLElement} primaryOriginal
   * @param {HTMLElement} secondaryOriginal
   * @param {string} pileKey
   */
  function placeBeatmapModGridMergedPair(
    modsEl,
    piles,
    mergeId,
    primaryOriginal,
    secondaryOriginal,
    pileKey,
  ) {
    const clone = primaryOriginal.cloneNode(true);
    clone.setAttribute("data-oep-merged-mod", mergeId);
    beatmapModGridOriginalToClone.set(primaryOriginal, clone);
    beatmapModGridOriginalToClone.set(secondaryOriginal, clone);
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const max = mergedModGridEffectiveStepCount(mergeId);
      const cur = mergedModCycleStep.get(mergeId) ?? 0;
      const next = (cur + 1) % max;
      applyMergedModTargetStep(modsEl, mergeId, next);
    });
    piles[pileKey]?.appendChild(clone);
    primaryOriginal.setAttribute("data-oep-mod-hidden", "1");
    secondaryOriginal.setAttribute("data-oep-mod-hidden", "1");
  }

  /**
   * Stable column order: r0 = EZ,NF,HT; r1 = HR,HD,DT↔NC,FL,SD↔PF;
   * r2 = NM then remaining stable acronyms. Lazer column unchanged from osu-web row types.
   * @param {HTMLElement} modsEl
   * @param {Record<string, HTMLElement>} piles
   */
  function placeBeatmapModGridButtons(modsEl, piles) {
    const directList = [
      ...modsEl.querySelectorAll(":scope > .beatmap-scoreboard-mod"),
    ];
    /** @type {Map<string, HTMLElement>} */
    const byAc = new Map();
    for (const btn of directList) {
      if (!(btn instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(btn);
      if (ac) byAc.set(ac, btn);
    }

    const STABLE_R0 = ["EZ", "NF", "HT"];
    const placedStable = new Set();

    for (const ac of STABLE_R0) {
      const b = byAc.get(ac);
      if (b) {
        placeBeatmapModGridSingleClone(modsEl, piles, b, "r0-stable");
        placedStable.add(ac);
      }
    }

    for (const ac of ["HR", "HD"]) {
      const b = byAc.get(ac);
      if (b) {
        placeBeatmapModGridSingleClone(modsEl, piles, b, "r1-stable");
        placedStable.add(ac);
      }
    }

    const dtB = byAc.get("DT");
    const ncB = byAc.get("NC");
    if (dtB && ncB) {
      placeBeatmapModGridMergedPair(
        modsEl,
        piles,
        MERGED_MOD_DT_NC,
        dtB,
        ncB,
        "r1-stable",
      );
      placedStable.add("DT");
      placedStable.add("NC");
    } else {
      if (dtB) {
        placeBeatmapModGridSingleClone(modsEl, piles, dtB, "r1-stable");
        placedStable.add("DT");
      }
      if (ncB) {
        placeBeatmapModGridSingleClone(modsEl, piles, ncB, "r1-stable");
        placedStable.add("NC");
      }
    }

    const flB = byAc.get("FL");
    if (flB) {
      placeBeatmapModGridSingleClone(modsEl, piles, flB, "r1-stable");
      placedStable.add("FL");
    }

    const sdB = byAc.get("SD");
    const pfB = byAc.get("PF");
    if (sdB && pfB) {
      placeBeatmapModGridMergedPair(
        modsEl,
        piles,
        MERGED_MOD_SD_PF,
        sdB,
        pfB,
        "r1-stable",
      );
      placedStable.add("SD");
      placedStable.add("PF");
    } else {
      if (sdB) {
        placeBeatmapModGridSingleClone(modsEl, piles, sdB, "r1-stable");
        placedStable.add("SD");
      }
      if (pfB) {
        placeBeatmapModGridSingleClone(modsEl, piles, pfB, "r1-stable");
        placedStable.add("PF");
      }
    }

    const nmLeft = byAc.get("NM");
    if (nmLeft && !placedStable.has("NM")) {
      placeBeatmapModGridSingleClone(modsEl, piles, nmLeft, "r2-stable");
      placedStable.add("NM");
    }

    for (const btn of directList) {
      if (!(btn instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(btn);
      if (!ac) continue;
      if (placedStable.has(ac)) continue;
      if (!STABLE_MOD_ACRONYMS.has(ac)) {
        const modInner = btn.querySelector(".mod");
        const row =
          modInner instanceof HTMLElement ? modDifficultyRow(modInner) : 2;
        const key = `r${row}-lazer`;
        placeBeatmapModGridSingleClone(modsEl, piles, btn, key);
        continue;
      }
      placeBeatmapModGridSingleClone(modsEl, piles, btn, "r2-stable");
    }
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {typeof el} elFn
   */
  function applyBeatmapModGrid(modsEl, elFn) {
    const directButtons = modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod",
    );
    if (!directButtons.length) return;

    teardownBeatmapModGrid(modsEl);

    modsEl.setAttribute(MOD_GRID_ATTR, "1");

    const collapseToggle = elFn(
      "button",
      {
        type: "button",
        class: `${MOD_GRID_CLASS}__collapse-toggle`,
        "aria-expanded": "true",
        "aria-label": "Collapse mod filter grid",
      },
      elFn(
        "span",
        { class: `${MOD_GRID_CLASS}__collapse-label` },
        "Mod filters",
      ),
      elFn("i", { class: "fas fa-chevron-down", "aria-hidden": "true" }),
    );
    const toggleRow = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__toggle-row` },
      collapseToggle,
    );
    collapseToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const collapsed = modsEl.classList.toggle(MOD_GRID_COLLAPSED_CLASS);
      collapseToggle.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true",
      );
      collapseToggle.setAttribute(
        "aria-label",
        collapsed ? "Expand mod filter grid" : "Collapse mod filter grid",
      );
    });

    const headStable = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__hdr-stable` },
      "Stable mods",
    );

    const corner = elFn("div", { class: `${MOD_GRID_CLASS}__hdr-corner` });
    const resetModsBtn = elFn(
      "button",
      {
        type: "button",
        class: `${MOD_GRID_CLASS}__reset-mods`,
        title: "Clear all selected mod filters",
        "aria-label": "Reset mod selection — turn off each selected mod",
      },
      "Reset",
    );
    resetModsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetBeatmapScoreboardModSelection(modsEl);
    });
    corner.appendChild(resetModsBtn);

    const headLazer = elFn(
      "div",
      {
        class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__colhead--lazer ${MOD_GRID_CLASS}__hdr-lazer`,
      },
      elFn("span", {}, "Lazer mods"),
    );

    const label0 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r0-label` },
      "Difficulty decrease mods",
    );
    const label1 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r1-label` },
      "Difficulty increase mods",
    );
    const label2 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r2-label` },
      "For fun mods",
    );

    /** @type {Record<string, HTMLElement>} */
    const piles = {
      "r0-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-stable`,
      }),
      "r0-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-lazer`,
      }),
      "r1-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-stable`,
      }),
      "r1-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-lazer`,
      }),
      "r2-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-stable`,
      }),
      "r2-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-lazer`,
      }),
    };

    const frag = document.createDocumentFragment();
    for (const node of [
      toggleRow,
      corner,
      headStable,
      headLazer,
      label0,
      label1,
      label2,
      piles["r0-stable"],
      piles["r0-lazer"],
      piles["r1-stable"],
      piles["r1-lazer"],
      piles["r2-stable"],
      piles["r2-lazer"],
    ]) {
      frag.appendChild(node);
    }
    modsEl.appendChild(frag);

    placeBeatmapModGridButtons(modsEl, piles);

    if (auth.isConfigured()) {
      piles["r2-stable"].appendChild(
        elFn(
          "div",
          {
            class: `${MOD_GRID_CLASS}__wildcard-guide`,
            role: "note",
          },
          elFn(
            "div",
            { class: `${MOD_GRID_CLASS}__wildcard-guide-row` },
            elFn("span", {
              class: `${MOD_GRID_CLASS}__wildcard-guide-icon`,
              "aria-hidden": "true",
            }),
            elFn(
              "p",
              { class: `${MOD_GRID_CLASS}__wildcard-guide-text` },
              elFn("strong", {}, "Wildcard"),
              ": click an enabled mod again. Wildcard mods ",
              elFn("strong", {}, "may or may not"),
              " appear on each score.",
            ),
          ),
        ),
      );
    }

    reconcileMergedModCycleFromDom(modsEl);

    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
  }

  /**
   * @returns {Promise<function(): void>}
   */
  async function setupBeatmapScoreboardModGrid() {
    if (!settings.isEnabled(SCOREBOARD_MOD_GRID_ID)) {
      return () => {};
    }
    ensureModGridStyles();

    let modsEl = null;
    /** @type {{ mo: MutationObserver|null, modStateMo: MutationObserver|null, debounceId: number, modStateDebounceId: number }|null} */
    let handles = null;

    function scheduleApply() {
      if (!handles || !modsEl) return;
      window.clearTimeout(handles.debounceId);
      handles.debounceId = window.setTimeout(() => {
        handles.debounceId = 0;
        if (!modsEl || !document.body.contains(modsEl)) return;
        try {
          if (
            modsEl.querySelector(
              ":scope > .beatmap-scoreboard-mod:not([data-oep-mod-hidden])",
            )
          ) {
            applyBeatmapModGrid(modsEl, el);
          }
        } catch (_) {}
      }, 0);
    }

    try {
      modsEl = await waitForElement(".beatmapset-scoreboard__mods", 20000);
    } catch {
      return () => {};
    }

    if (!document.body.contains(modsEl)) return () => {};

    handles = {
      mo: null,
      modStateMo: null,
      debounceId: 0,
      modStateDebounceId: 0,
    };
    beatmapModGridLiveHandles.set(modsEl, handles);

    const scoreboardRootForTabs = modsEl.closest(".beatmapset-scoreboard");
    const onScoreboardTabClick = (e) => {
      const tab = e.target?.closest?.(".page-tabs__tab");
      if (!(tab instanceof HTMLElement)) return;
      if (
        !(scoreboardRootForTabs instanceof HTMLElement) ||
        !scoreboardRootForTabs.contains(tab)
      ) {
        return;
      }
      if (getWildcardMods().length > 0) scheduleWildcardFetch(modsEl);
    };
    if (scoreboardRootForTabs instanceof HTMLElement) {
      scoreboardRootForTabs.addEventListener("click", onScoreboardTabClick, true);
    }

    handles.mo = new MutationObserver(scheduleApply);
    handles.mo.observe(modsEl, { childList: true });
    applyBeatmapModGrid(modsEl, el);

    if (!modsEl.hasAttribute(MOD_RESET_BTN_SYNC_ATTR)) {
      modsEl.setAttribute(MOD_RESET_BTN_SYNC_ATTR, "1");
      const scheduleModStateSync = () => {
        if (!handles || !modsEl) return;
        window.clearTimeout(handles.modStateDebounceId);
        handles.modStateDebounceId = window.setTimeout(() => {
          handles.modStateDebounceId = 0;
          if (modsEl && document.body.contains(modsEl)) {
            syncBeatmapModGridCloneHighlights(modsEl);
            syncBeatmapScoreboardModResetButton(modsEl);
          }
        }, 0);
      };
      handles.modStateMo = new MutationObserver((records) => {
        const hidden = modsEl.querySelectorAll(
          ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
        );
        const touchesHiddenOriginal = records.some((r) => {
          const n = r.target;
          if (n instanceof Element) {
            for (const h of hidden) {
              if (h === n || h.contains(n)) return true;
            }
            return false;
          }
          if (n instanceof Text) {
            for (const h of hidden) {
              if (h.contains(n)) return true;
            }
          }
          return false;
        });
        if (touchesHiddenOriginal) scheduleModStateSync();
      });
      handles.modStateMo.observe(modsEl, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-pressed", "aria-disabled", "title"],
        characterData: true,
        childList: true,
      });
    }

    const onCredsChange = () => {
      if (!auth.isConfigured() && modsEl) {
        clearWildcardState();
        const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
        if (scoreboardRoot instanceof HTMLElement) {
          clearWildcardMergedLeaderboard(scoreboardRoot);
        }
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
      }
    };
    window.addEventListener("oep-osu-api-credentials-changed", onCredsChange);

    return () => {
      window.removeEventListener(
        "oep-osu-api-credentials-changed",
        onCredsChange,
      );
      if (scoreboardRootForTabs instanceof HTMLElement) {
        scoreboardRootForTabs.removeEventListener(
          "click",
          onScoreboardTabClick,
          true,
        );
      }
      clearWildcardState();
      if (modsEl && document.body.contains(modsEl)) {
        stopBeatmapScoreboardModGridLive(modsEl);
      } else if (handles) {
        window.clearTimeout(handles.debounceId);
        window.clearTimeout(handles.modStateDebounceId);
        handles.mo?.disconnect();
        handles.modStateMo?.disconnect();
        if (modsEl) beatmapModGridLiveHandles.delete(modsEl);
      }
      handles = null;
      modsEl = null;
    };
  }

  function findBeatmapScoreboardRoot() {
    const mods = document.querySelector(".beatmapset-scoreboard__mods");
    if (mods instanceof HTMLElement) {
      const byClass = mods.closest(".beatmapset-scoreboard");
      if (byClass instanceof HTMLElement) return byClass;
      let el = mods;
      for (let d = 0; el && d < 16; d++, el = el.parentElement) {
        if (
          el.querySelector?.(".play-detail-list") ||
          el.querySelector?.(".beatmap-scoreboard-table")
        ) {
          return el;
        }
      }
    }
    const board = document.querySelector(".beatmapset-scoreboard");
    return board instanceof HTMLElement ? board : null;
  }

  /**
   * Turn scoreboard cell `<a>` wrappers into `<span>` so the row is not navigable,
   * except `a.beatmap-scoreboard-table__user-link` (profile URL).
   * @param {HTMLTableRowElement} tr
   */
  function demoteBeatmapUserSearchResultRowLinks(tr) {
    if (!(tr instanceof HTMLTableRowElement)) return;
    for (const a of tr.querySelectorAll("a")) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      if (a.classList.contains("beatmap-scoreboard-table__user-link")) continue;
      const href = a.getAttribute("href") || "";
      if (
        /\/rankings\/[^/]+\/performance\?country=/i.test(href) &&
        a.classList.contains("beatmap-scoreboard-table__cell-content")
      ) {
        continue;
      }
      if (/\/teams\/[^/?#]+/i.test(href) && a.querySelector(".flag-team")) {
        continue;
      }
      const span = document.createElement("span");
      span.className = a.className;
      for (const attr of [...a.attributes]) {
        const n = attr.name;
        if (n === "href" || n === "target" || n === "download" || n === "rel") {
          continue;
        }
        span.setAttribute(n, attr.value);
      }
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    }
  }

  /**
   * Moves the tools row to the canonical spot (after mods when present, else
   * the same fallbacks as legacy single-widget placement).
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} row
   */
  function placeBeatmapScoreboardToolsRow(scoreboardRoot, row) {
    const modsEl = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (modsEl) {
      if (row.previousElementSibling !== modsEl) {
        modsEl.after(row);
      }
      return;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    if (tableWrap?.parentElement instanceof HTMLElement) {
      const parent = tableWrap.parentElement;
      if (row.parentElement !== parent || row.nextElementSibling !== tableWrap) {
        parent.insertBefore(row, tableWrap);
      }
      return;
    }
    if (main) {
      if (row.parentElement !== main || row !== main.firstElementChild) {
        main.insertBefore(row, main.firstChild);
      }
      return;
    }
    if (row.parentElement !== scoreboardRoot || row !== scoreboardRoot.firstElementChild) {
      scoreboardRoot.insertBefore(row, scoreboardRoot.firstChild);
    }
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @returns {HTMLElement}
   */
  function ensureBeatmapScoreboardToolsRow(scoreboardRoot) {
    let row = scoreboardRoot.querySelector(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`);
    if (!(row instanceof HTMLElement)) {
      row = /** @type {HTMLElement} */ (
        el("div", {
          class: "oep-scoreboard-tools-row",
          [SCOREBOARD_TOOLS_ROW_ATTR]: "1",
        })
      );
      placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
    } else {
      placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
    }
    return row;
  }

  /**
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function removeEmptyBeatmapScoreboardToolsRows(scoreboardRoot) {
    const roots =
      scoreboardRoot instanceof HTMLElement
        ? [scoreboardRoot]
        : [...document.querySelectorAll(".beatmapset-scoreboard")];
    for (const root of roots) {
      root.querySelectorAll(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`).forEach((n) => {
        if (n instanceof HTMLElement && n.childElementCount === 0) {
          n.remove();
        }
      });
    }
  }

  /**
   * Player lookup and rate filter share a flex row under `.beatmapset-scoreboard__mods`.
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   */
  function insertBeatmapScoreUserSearchBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    const rate = toolsRow.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (wrap.parentElement !== toolsRow) {
      if (rate) toolsRow.insertBefore(wrap, rate);
      else toolsRow.appendChild(wrap);
    } else if (rate instanceof HTMLElement && rate.previousElementSibling !== wrap) {
      toolsRow.insertBefore(wrap, rate);
    }
  }

  /**
   * Sits in the tools row (sibling of React mod root, not inside it).
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   */
  function insertBeatmapRateEditFilterBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    if (wrap.parentElement !== toolsRow) {
      toolsRow.appendChild(wrap);
    } else {
      toolsRow.appendChild(wrap);
    }
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, row) {
    if (!scoreboardRoot.contains(row)) return false;
    const modsEl = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (modsEl) {
      return row.previousElementSibling === modsEl;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    const parent = tableWrap?.parentElement;
    if (parent instanceof HTMLElement && row.parentElement === parent) {
      return row.nextElementSibling === tableWrap;
    }
    if (main instanceof HTMLElement && row.parentElement === main) {
      return row === main.firstElementChild;
    }
    return (
      row.parentElement === scoreboardRoot && row === scoreboardRoot.firstElementChild
    );
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isPlayerLookupSearchBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (
      !(toolsRow instanceof HTMLElement) ||
      !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)
    ) {
      return false;
    }
    return isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow);
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isRateEditFilterBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (
      !(toolsRow instanceof HTMLElement) ||
      !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)
    ) {
      return false;
    }
    if (!isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow)) {
      return false;
    }
    const searchWrap = toolsRow.querySelector(`[${SCOREBOARD_USER_SEARCH_ATTR}]`);
    if (!(searchWrap instanceof HTMLElement)) return true;
    return wrap.previousElementSibling === searchWrap;
  }

  /**
   * Global rank for a score row when the API includes it; otherwise unknown.
   * @param {object} score
   * @returns {number|null}
   */
  function beatmapUserSearchGlobalRank(score) {
    const r = Number(score?.rank_global);
    if (Number.isFinite(r) && r > 0) return r;
    return null;
  }

  /**
   * Paint player-lookup scores into the same main leaderboard tbody as osu-web (and wildcard),
   * hiding native rows so there is only one table.
   * @param {HTMLElement} scoreboardRoot
   * @param {object[]} scores
   * @param {object|null|undefined} userTeam
   * @returns {boolean}
   */
  function renderUserSearchMergedLeaderboard(scoreboardRoot, scores, userTeam) {
    if (!Array.isArray(scores) || scores.length === 0) return false;

    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return false;

    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return false;

    const templateRow = tbody.querySelector(
      "tr.beatmap-scoreboard-table__body-row",
    );
    if (!(templateRow instanceof HTMLTableRowElement)) return false;

    const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
    const modTemplateBtn =
      resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
    const beatmapId = getBeatmapPageBeatmapId();
    const mapFullCombo = beatmapId
      ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
      : null;

    window.clearTimeout(wildcardDebounceTimer);
    wildcardDebounceTimer = 0;
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }
    const tableWrapClear = scoreboardRoot.querySelector(
      ".beatmap-scoreboard-table",
    );
    if (tableWrapClear instanceof HTMLElement) {
      tableWrapClear.classList.remove(WILDCARD_LOADING_CLASS);
    }

    tbody
      .querySelectorAll(`tr[${EXTENDED_SCORE_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());

    const nativeRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    for (const nr of nativeRows) nr.style.display = "none";
    const firstNative = nativeRows[0] ?? null;

    let inserted = 0;
    for (const score of scores) {
      if (!score || typeof score !== "object") continue;
      const resultRow = /** @type {HTMLTableRowElement} */ (
        templateRow.cloneNode(true)
      );
      resultRow.setAttribute(SCORE_USER_SEARCH_RESULT_ATTR, "1");
      resultRow.removeAttribute(RATE_EDIT_ROW_ATTR);
      resultRow.style.display = "";
      resultRow.classList.remove(
        "beatmap-scoreboard-table__body-row--friend",
        "beatmap-scoreboard-table__body-row--first",
        "beatmap-scoreboard-table__body-row--self",
      );

      if (colMap.user != null) {
        const playerTd = resultRow.cells[colMap.user];
        if (playerTd) {
          for (const teamLink of playerTd.querySelectorAll(
            'a[href*="/teams/"]',
          )) {
            teamLink.remove();
          }
          if (userTeam?.id && userTeam.flag_url) {
            const teamA = document.createElement("a");
            teamA.className = "u-contents u-hover";
            teamA.href = `https://osu.ppy.sh/teams/${userTeam.id}`;
            const teamSpan = document.createElement("span");
            teamSpan.className = "flag-team";
            teamSpan.style.backgroundImage = `url("${userTeam.flag_url}")`;
            teamSpan.title = userTeam.name ?? "";
            teamA.appendChild(teamSpan);
            const userLink = playerTd.querySelector(
              "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
            );
            if (userLink) {
              userLink.insertAdjacentElement("beforebegin", teamA);
            } else {
              playerTd.prepend(teamA);
            }
          }
        }
      }

      const position = beatmapUserSearchGlobalRank(score);
      applyApiScoreToBeatmapScoreRow(
        resultRow,
        score,
        position ?? 0,
        colMap,
        realTable,
        templateRow,
        modTemplateBtn,
        mapFullCombo,
      );
      demoteBeatmapUserSearchResultRowLinks(resultRow);
      resultRow.removeAttribute(EXTENDED_SCORE_ROW_ATTR);

      if (colMap.user != null) {
        const uid = score.user?.id ?? score.user_id;
        const playerTd = resultRow.cells[colMap.user];
        const card = playerTd?.querySelector(".js-usercard");
        if (card instanceof HTMLElement && uid != null) {
          card.setAttribute("data-user-id", String(uid));
        }
      }

      if (scoreHasNonstandardRate(score)) {
        resultRow.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      }

      if (position == null && colMap.rank != null) {
        const rankTd = [...resultRow.cells][colMap.rank];
        if (rankTd) {
          const shell = rankTd.querySelector(
            ".beatmap-scoreboard-table__cell-content",
          );
          if (shell) shell.textContent = "?";
          else rankTd.textContent = "?";
        }
      }

      tbody.insertBefore(resultRow, firstNative);
      inserted += 1;
    }

    if (!inserted) return false;

    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
    return true;
  }

  /**
   * Mounts and manages the username search bar on the beatmap scoreboard.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreUserSearchManager(pathRe) {
    const MARKER_ATTR = SCOREBOARD_USER_SEARCH_ATTR;
    const NO_API_STATUS =
      "Add osu! API OAuth credentials in Expert+ settings to search players.";
    let debounceTimer = 0;

    const cleanup = () => {
      document.querySelectorAll(".beatmapset-scoreboard").forEach((el) => {
        if (el instanceof HTMLElement) {
          clearUserSearchMergedLeaderboard(
            el,
            el.querySelector(".beatmapset-scoreboard__mods"),
            false,
          );
        }
      });
      document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((n) => n.remove());
      removeEmptyBeatmapScoreboardToolsRows();
    };

    const syncPlayerLookupSearchBarApiState = (wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const input = wrap.querySelector(".oep-user-search__input");
      const goBtn = wrap.querySelector(".oep-user-search__btn--go");
      const resetBtn = wrap.querySelector(".oep-user-search__btn--reset");
      const statusEl = wrap.querySelector(".oep-user-search__status");
      const resultEl = wrap.querySelector(".oep-user-search__result");
      const configured = auth.isConfigured();
      wrap.classList.toggle("oep-user-search--no-api", !configured);
      if (input instanceof HTMLInputElement) {
        input.disabled = !configured;
      }
      if (goBtn instanceof HTMLButtonElement) {
        goBtn.disabled = !configured;
      }
      if (!configured) {
        if (resetBtn instanceof HTMLElement) resetBtn.hidden = true;
        if (resultEl) resultEl.replaceChildren();
        if (input instanceof HTMLInputElement) input.value = "";
        if (statusEl) statusEl.textContent = NO_API_STATUS;
        const boardRoot = findBeatmapScoreboardRoot();
        const mods = boardRoot?.querySelector(".beatmapset-scoreboard__mods");
        clearUserSearchMergedLeaderboard(boardRoot, mods, false);
      } else if (statusEl && statusEl.textContent === NO_API_STATUS) {
        statusEl.textContent = "";
      }
    };

    const ensureSearchBar = (root) => {
      const existing =
        root.querySelector(`[${MARKER_ATTR}]`) ||
        document.querySelector(`[${MARKER_ATTR}]`);
      if (existing instanceof HTMLElement) {
        if (!isPlayerLookupSearchBarPlacedCorrectly(root, existing)) {
          insertBeatmapScoreUserSearchBar(root, existing);
        }
        syncPlayerLookupSearchBarApiState(existing);
        return;
      }

      const searchInput = el("input", {
        type: "text",
        class: "oep-user-search__input",
        placeholder: "Look up a player…",
        "aria-label": "Search player on leaderboard",
        autocomplete: "off",
        spellcheck: "false",
      });

      const searchBtn = el(
        "button",
        {
          type: "button",
          class: "oep-user-search__btn oep-user-search__btn--go",
        },
        "Search",
      );

      const resetBtn = el(
        "button",
        {
          type: "button",
          class: "oep-user-search__btn oep-user-search__btn--reset",
          hidden: "",
          "aria-label": "Clear search result",
        },
        "Reset",
      );

      const statusEl = el("div", {
        class: "oep-user-search__status",
        "aria-live": "polite",
      });

      const resultEl = el("div", { class: "oep-user-search__result" });

      const wrap = el(
        "div",
        { class: "oep-user-search", [MARKER_ATTR]: "1" },
        el(
          "div",
          { class: "oep-user-search__bar" },
          searchInput,
          searchBtn,
          resetBtn,
        ),
        statusEl,
        resultEl,
      );

      const doReset = () => {
        const boardRoot = findBeatmapScoreboardRoot();
        const mods = boardRoot?.querySelector(".beatmapset-scoreboard__mods");
        clearUserSearchMergedLeaderboard(boardRoot, mods);
        resultEl.replaceChildren();
        searchInput.value = "";
        statusEl.textContent = "";
        resetBtn.hidden = true;
        searchInput.focus();
      };

      const doSearch = async () => {
        const username = searchInput.value.trim();
        if (!username) return;

        if (!auth.isConfigured()) {
          statusEl.textContent =
            "API credentials required. Configure them in the settings (Client ID + Secret).";
          resetBtn.hidden = false;
          return;
        }

        const beatmapId = getBeatmapPageBeatmapId();
        if (!beatmapId) return;

        searchBtn.disabled = true;
        resultEl.replaceChildren();
        statusEl.textContent = "Searching…";

        try {
          const user = await OsuExpertPlus.api.getUser(username);
          if (!user?.id) throw new Error("user not found");

          const ruleset = getBeatmapPageRuleset();
          const scoreboardRoot = findBeatmapScoreboardRoot();
          const data = await OsuExpertPlus.api.getBeatmapUserScoresAll(
            beatmapId,
            user.id,
            { ruleset, legacy_only: 0 },
          );
          const rawList = Array.isArray(data?.scores) ? data.scores : [];
          if (!rawList.length) throw new Error("no score");

          const userCompact = {
            id: user.id,
            username: user.username,
            country_code: user.country_code,
            country: user.country,
          };
          const scores = rawList.map((s) =>
            s && typeof s === "object" && !s.user
              ? { ...s, user: userCompact }
              : s,
          );

          resultEl.replaceChildren();
          const ok =
            scoreboardRoot instanceof HTMLElement &&
            renderUserSearchMergedLeaderboard(
              scoreboardRoot,
              scores,
              user.team,
            );
          if (ok) {
            statusEl.textContent = "";
          } else {
            statusEl.textContent =
              "Scores found but leaderboard is not ready yet.";
          }
          resetBtn.hidden = false;
        } catch (_) {
          statusEl.textContent = "No score found on this difficulty.";
          resetBtn.hidden = false;
        } finally {
          searchBtn.disabled = false;
        }
      };

      searchBtn.addEventListener("click", doSearch);
      resetBtn.addEventListener("click", doReset);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });

      insertBeatmapScoreUserSearchBar(root, wrap);
      syncPlayerLookupSearchBarApiState(wrap);
    };

    const run = () => {
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      if (!settings.isEnabled(SCOREBOARD_PLAYER_LOOKUP_ID)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      ensureSearchBar(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };

    const OSU_API_CREDS_CHANGE = "oep-osu-api-credentials-changed";
    const onOsuApiCredsChange = () => schedule();
    window.addEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);

    const unsubLookup = settings.onChange(SCOREBOARD_PLAYER_LOOKUP_ID, () =>
      schedule(),
    );

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    schedule();

    return () => {
      unsubLookup();
      window.removeEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  /**
   * Checkbox under mod filters (sibling of React’s mods root) + setting
   * `beatmapDetail.scoreboardHideCustomRateScores` to hide custom-rate rows.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardHideRateEditFilterBar(pathRe) {
    let debounceTimer = 0;

    const cleanup = () => {
      document
        .querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`)
        .forEach((n) => n.remove());
      removeEmptyBeatmapScoreboardToolsRows();
    };

    const syncCheckbox = (wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const cb = wrap.querySelector('input[type="checkbox"]');
      if (!(cb instanceof HTMLInputElement)) return;
      const on = settings.isEnabled(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID);
      if (cb.checked !== on) cb.checked = on;
    };

    const ensureBar = (root) => {
      const modsEl = root.querySelector(".beatmapset-scoreboard__mods");
      if (!modsEl) return;

      let existing = root.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
      if (!(existing instanceof HTMLElement)) {
        const cb = /** @type {HTMLInputElement} */ (
          el("input", { type: "checkbox" })
        );
        const label = el("label", {}, cb, " Hide custom rate scores");
        existing = /** @type {HTMLElement} */ (
          el(
            "div",
            {
              class: "oep-rate-edit-filter",
              [RATE_EDIT_FILTER_BAR_ATTR]: "1",
            },
            label,
          )
        );
        cb.addEventListener("change", () => {
          settings.set(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID, cb.checked);
        });
        insertBeatmapRateEditFilterBar(root, existing);
      } else if (!isRateEditFilterBarPlacedCorrectly(root, existing)) {
        insertBeatmapRateEditFilterBar(root, existing);
      }
      syncCheckbox(existing);
      syncBeatmapRateEditFilterBarVisibility(root);
    };

    const run = () => {
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      ensureBar(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };

    const unsub = settings.onChange(
      SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID,
      (on) => {
        document
          .querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`)
          .forEach((w) => {
            if (!(w instanceof HTMLElement)) return;
            const cb = w.querySelector('input[type="checkbox"]');
            if (cb instanceof HTMLInputElement && cb.checked !== on) {
              cb.checked = on;
            }
          });
        const board = findBeatmapScoreboardRoot();
        if (board instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(board);
        }
      },
    );

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    schedule();

    return () => {
      unsub();
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  /**
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapDiscussionPreviewManager(pathRe) {
    const TOGGLE_ATTR = "data-oep-discussion-preview-toggle";
    const PREVIEW_ATTR = "data-oep-discussion-preview";
    const MARKER_ATTR = "data-oep-discussion-preview-bound";
    const ROOT_MARKER_ATTR = "data-oep-discussion-preview-root-bound";
    const HELPER_ATTR = "data-oep-markdown-helper";
    let previewEnabled = false;

    const isSupportedDiscussionPath = () =>
      pathRe.test(location.pathname) &&
      /^\/beatmapsets\/\d+\/discussion\//i.test(location.pathname) &&
      !/^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i.test(
        location.pathname,
      );

    /**
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    /**
     * @param {string} raw
     * @returns {string|null}
     */
    function sanitizeHttpUrl(raw) {
      if (!raw) return null;
      const candidate = String(raw).trim();
      if (!candidate) return null;
      try {
        const parsed = new URL(candidate, location.origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          return null;
        return parsed.href;
      } catch (_) {
        return null;
      }
    }

    /**
     * Lightweight markdown-ish renderer (good enough for previewing common syntax).
     * @param {string} src
     * @returns {string}
     */
    function renderMarkdownPreviewHtml(src) {
      const raw = String(src ?? "");
      if (!raw.trim()) {
        return `<p class="oep-discussion-preview__empty">Nothing to preview yet.</p>`;
      }
      const lines = raw.replace(/\r\n?/g, "\n").split("\n");
      const out = [];
      let inCode = false;
      let inUl = false;
      let inOl = false;
      let inQuote = false;

      const closeLists = () => {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
      };
      const closeQuote = () => {
        if (inQuote) {
          out.push("</blockquote>");
          inQuote = false;
        }
      };
      const inline = (line) => {
        let s = escapeHtml(line);
        s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, altRaw, srcRaw) => {
          const src = sanitizeHttpUrl(srcRaw);
          if (!src) return escapeHtml(`![${altRaw}](${srcRaw})`);
          const alt = escapeHtml(altRaw || "");
          return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" />`;
        });
        s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
        s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
        s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
        s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
        s = s.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );
        return s;
      };

      for (const lineRaw of lines) {
        const line = lineRaw ?? "";
        if (/^```/.test(line.trim())) {
          closeLists();
          closeQuote();
          if (!inCode) {
            out.push("<pre><code>");
            inCode = true;
          } else {
            out.push("</code></pre>");
            inCode = false;
          }
          continue;
        }
        if (inCode) {
          out.push(`${escapeHtml(line)}\n`);
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          closeLists();
          closeQuote();
          continue;
        }

        const quoteMatch = line.match(/^\s*>\s?(.*)$/);
        if (quoteMatch) {
          closeLists();
          if (!inQuote) {
            out.push("<blockquote>");
            inQuote = true;
          }
          out.push(`<p>${inline(quoteMatch[1])}</p>`);
          continue;
        } else {
          closeQuote();
        }

        const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (ulMatch) {
          if (!inUl) {
            if (inOl) {
              out.push("</ol>");
              inOl = false;
            }
            out.push("<ul>");
            inUl = true;
          }
          out.push(`<li>${inline(ulMatch[1])}</li>`);
          continue;
        }

        const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (olMatch) {
          if (!inOl) {
            if (inUl) {
              out.push("</ul>");
              inUl = false;
            }
            out.push("<ol>");
            inOl = true;
          }
          out.push(`<li>${inline(olMatch[2])}</li>`);
          continue;
        }

        closeLists();
        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
          continue;
        }
        out.push(`<p>${inline(line)}</p>`);
      }

      if (inCode) out.push("</code></pre>");
      closeLists();
      closeQuote();
      return out.join("");
    }

    /**
     * @returns {HTMLTextAreaElement[]}
     */
    function collectCandidateTextareas() {
      const nodes = Array.from(
        document.querySelectorAll(
          '[data-react="beatmap-discussions"] textarea, .beatmap-discussion textarea',
        ),
      );
      return nodes.filter((node) => {
        if (!(node instanceof HTMLTextAreaElement)) return false;
        if (!node.isConnected) return false;
        if (node.hasAttribute(MARKER_ATTR)) return false;
        if (
          !node.closest(
            '[data-react="beatmap-discussions"], .beatmap-discussion',
          )
        ) {
          return false;
        }
        return true;
      });
    }

    /**
     * @param {HTMLElement} composerRoot
     * @param {HTMLElement} toggleBtn
     */
    function placePreviewToggleButton(composerRoot, toggleBtn, textarea) {
      const moveAsFirstChild = (parent, child) => {
        if (!(parent instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        if (
          child.parentElement === parent &&
          parent.firstElementChild === child
        )
          return;
        parent.prepend(child);
      };
      const moveBefore = (anchor, child) => {
        if (!(anchor instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        const parent = anchor.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (
          child.parentElement === parent &&
          child.nextElementSibling === anchor
        )
          return;
        anchor.insertAdjacentElement("beforebegin", child);
      };
      const moveAppend = (parent, child) => {
        if (!(parent instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        if (child.parentElement === parent) return;
        parent.appendChild(child);
      };

      const replyButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const label = String(node.textContent || "")
          .trim()
          .toLowerCase();
        return label === "reply" || label === "respond" || label === "response";
      });
      const noteButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find(
        (node) =>
          node instanceof HTMLElement && node.textContent?.trim() === "Note",
      );
      const insertParent =
        composerRoot.querySelector(".beatmap-discussion-new__footer") ||
        composerRoot.querySelector("[class*='footer']") ||
        composerRoot.querySelector("[class*='actions']");
      if (replyButton instanceof HTMLElement && replyButton.parentElement) {
        const replyGroup =
          replyButton.closest(".beatmap-discussion-post__actions-group") ||
          replyButton.parentElement;
        if (replyGroup instanceof HTMLElement) {
          moveAsFirstChild(replyGroup, toggleBtn);
        } else {
          moveBefore(replyButton, toggleBtn);
        }
      } else if (
        noteButton instanceof HTMLElement &&
        noteButton.parentElement
      ) {
        const noteGroup =
          noteButton.closest(".beatmap-discussion-post__actions-group") ||
          noteButton.parentElement;
        if (noteGroup instanceof HTMLElement) {
          moveAsFirstChild(noteGroup, toggleBtn);
        } else {
          moveBefore(noteButton, toggleBtn);
        }
      } else if (
        insertParent instanceof HTMLElement &&
        toggleBtn.parentElement !== insertParent
      ) {
        moveAsFirstChild(insertParent, toggleBtn);
      } else if (!(toggleBtn.parentElement instanceof HTMLElement)) {
        const anchor =
          textarea?.closest(".beatmap-discussion-new__message") ||
          textarea?.parentElement ||
          composerRoot;
        moveAsFirstChild(anchor, toggleBtn);
      }
    }

    /**
     * @param {HTMLTextAreaElement|null} textarea
     * @returns {boolean}
     */
    function isVisibleTextarea(textarea) {
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      if (!textarea.isConnected) return false;
      const rect = textarea.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return false;
      const cs = window.getComputedStyle(textarea);
      return cs.display !== "none" && cs.visibility !== "hidden";
    }

    /**
     * @param {HTMLTextAreaElement} textarea
     */
    function bindTextareaPreview(textarea) {
      const composerRoot =
        textarea.closest(".beatmap-discussion-new") ||
        textarea.closest(".beatmap-discussion-post--new-reply") ||
        textarea.closest(".beatmap-discussion-reply-box") ||
        textarea.closest("[class*='discussion-new']") ||
        textarea.closest("[class*='new-reply']") ||
        textarea.closest("[class*='reply-box']");
      if (!(composerRoot instanceof HTMLElement)) return;
      textarea.setAttribute(MARKER_ATTR, "1");
      composerRoot.setAttribute(ROOT_MARKER_ATTR, "1");
      const isReplyComposer =
        composerRoot.classList.contains("beatmap-discussion-post--new-reply") ||
        composerRoot.classList.contains("beatmap-discussion-reply-box");

      /**
       * Replace textarea [start, end) with `replacement` in a way that participates in
       * the native undo stack where supported (Chromium: execCommand insertText).
       */
      const replaceRangeUndoable = (start, end, replacement) => {
        textarea.focus();
        textarea.setSelectionRange(start, end);
        const ok =
          typeof document.execCommand === "function" &&
          document.execCommand("insertText", false, replacement);
        if (!ok) {
          textarea.setRangeText(replacement, start, end, "end");
        }
      };

      const insertText = (before, after, placeholder) => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start, end);
        const payload = `${before}${selected || placeholder}${after}`;
        replaceRangeUndoable(start, end, payload);
        const caret =
          start +
          before.length +
          (selected ? selected.length : String(placeholder).length);
        textarea.setSelectionRange(caret, caret);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleWrap = (before, after, placeholder) => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const val = textarea.value || "";
        const selected = val.slice(start, end);

        const hasOuterWrap =
          start >= before.length &&
          val.slice(start - before.length, start) === before &&
          val.slice(end, end + after.length) === after;

        if (hasOuterWrap) {
          const outerStart = start - before.length;
          const outerEnd = end + after.length;
          replaceRangeUndoable(outerStart, outerEnd, selected);
          textarea.setSelectionRange(outerStart, outerStart + selected.length);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }

        const payload = `${before}${selected || placeholder}${after}`;
        replaceRangeUndoable(start, end, payload);
        const selStart = start + before.length;
        const selEnd =
          selStart + (selected ? selected.length : String(placeholder).length);
        textarea.setSelectionRange(selStart, selEnd);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const togglePrefixLines = (prefix, sample = "text") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart =
          value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const allPrefixed = lines.every((line) => line.startsWith(prefix));
        const next = lines
          .map((line) =>
            allPrefixed ? line.slice(prefix.length) : `${prefix}${line}`,
          )
          .join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleOrderedListLines = (sample = "first item\nsecond item") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart =
          value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const numberedRe = /^\d+\.\s/;
        const allNumbered =
          lines.length > 0 &&
          lines.every((line) => line === "" || numberedRe.test(line));
        let n = 0;
        const next = lines
          .map((line) => {
            if (allNumbered) {
              if (line === "") return "";
              return line.replace(/^\d+\.\s*/, "");
            }
            if (line === "") return "";
            n += 1;
            return `${n}. ${line}`;
          })
          .join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleCodeBlock = () => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start, end);
        const open = "```\n";
        const close = "\n```";
        const hasFence = selected.startsWith(open) && selected.endsWith(close);
        if (hasFence) {
          const inner = selected.slice(
            open.length,
            selected.length - close.length,
          );
          replaceRangeUndoable(start, end, inner);
          textarea.setSelectionRange(start, start + inner.length);
        } else {
          const payload = `${open}${selected || "code"}${close}`;
          replaceRangeUndoable(start, end, payload);
          const innerStart = start + open.length;
          const innerEnd = innerStart + (selected ? selected.length : 4);
          textarea.setSelectionRange(innerStart, innerEnd);
        }
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      composerRoot
        .querySelectorAll(`[${HELPER_ATTR}]`)
        .forEach((n) => n.remove());
      const mkBtn = (iconCls, label, onClick) => {
        const btn = el(
          "button",
          {
            type: "button",
            class: "oep-markdown-helper__btn",
            title: label,
          },
          el("i", { class: iconCls, "aria-hidden": "true" }),
          label,
        );
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return btn;
      };
      const helper = el(
        "div",
        {
          class: `oep-markdown-helper${
            isReplyComposer
              ? " oep-markdown-helper--reply"
              : " oep-markdown-helper--new-discussion"
          }`,
          [HELPER_ATTR]: "1",
        },
        el(
          "div",
          { class: "oep-markdown-helper__row" },
          mkBtn("fas fa-bold", "Bold", () => toggleWrap("**", "**", "bold")),
          mkBtn("fas fa-italic", "Italic", () =>
            toggleWrap("*", "*", "italic"),
          ),
          mkBtn("fas fa-strikethrough", "Strike", () =>
            toggleWrap("~~", "~~", "text"),
          ),
          mkBtn("fas fa-code", "Code", () => toggleWrap("`", "`", "code")),
          mkBtn("fas fa-link", "Link", () =>
            insertText("[", "](https://example.com)", "title"),
          ),
          mkBtn("fas fa-image", "Image", () =>
            insertText("![", "](https://example.com/image.png)", ""),
          ),
          mkBtn("fas fa-quote-left", "Quote", () => togglePrefixLines("> ")),
          mkBtn("fas fa-list-ul", "List", () =>
            togglePrefixLines("- ", "item one\nitem two"),
          ),
          mkBtn("fas fa-list-ol", "Numbered", () => toggleOrderedListLines()),
          mkBtn("fas fa-heading", "Heading", () =>
            insertText("## ", "", "Heading"),
          ),
          mkBtn("fas fa-file-code", "Code Block", () => toggleCodeBlock()),
        ),
      );
      const newDiscussionRoot = textarea.closest(".beatmap-discussion-new");
      if (newDiscussionRoot instanceof HTMLElement) {
        if (
          helper.parentElement !== newDiscussionRoot ||
          newDiscussionRoot.firstElementChild !== helper
        ) {
          newDiscussionRoot.prepend(helper);
        }
      } else if (isReplyComposer) {
        // Inside --new-reply / reply-box so the strip matches the textarea row (not sibling __discussion bg).
        if (
          helper.parentElement !== composerRoot ||
          composerRoot.firstElementChild !== helper
        ) {
          composerRoot.prepend(helper);
        }
      } else if (
        textarea.closest(".beatmap-discussion-reply-box") instanceof
          HTMLElement ||
        textarea.closest(".beatmap-discussion-post--new-reply") instanceof
          HTMLElement ||
        textarea.closest("[class*='reply-box']") instanceof HTMLElement ||
        textarea.closest("[class*='new-reply']") instanceof HTMLElement
      ) {
        const helperAnchor =
          textarea.closest(".beatmap-discussion-reply-box") ||
          textarea.closest(".beatmap-discussion-post--new-reply") ||
          textarea.closest("[class*='reply-box']") ||
          textarea.closest("[class*='new-reply']");
        if (
          helperAnchor instanceof HTMLElement &&
          (helper.previousElementSibling !== helperAnchor ||
            helper.parentElement !== helperAnchor.parentElement)
        ) {
          helperAnchor.insertAdjacentElement("beforebegin", helper);
        }
      } else if (
        !(helper.parentElement instanceof HTMLElement) ||
        helper.nextElementSibling !== textarea
      ) {
        textarea.insertAdjacentElement("beforebegin", helper);
      }

      let toggleBtn = composerRoot.querySelector(`[${TOGGLE_ATTR}]`);
      if (!(toggleBtn instanceof HTMLButtonElement)) {
        toggleBtn = el(
          "button",
          {
            type: "button",
            class: "oep-discussion-preview-toggle",
            [TOGGLE_ATTR]: "1",
            "aria-pressed": previewEnabled ? "true" : "false",
            title: "Toggle post preview",
          },
          "Preview",
        );
      }
      placePreviewToggleButton(composerRoot, toggleBtn, textarea);

      let preview = composerRoot.querySelector(`[${PREVIEW_ATTR}]`);
      if (!(preview instanceof HTMLElement)) {
        preview = el(
          "div",
          {
            class: "oep-discussion-preview",
            [PREVIEW_ATTR]: "1",
            hidden: previewEnabled ? null : "",
          },
          el("p", { class: "oep-discussion-preview__title" }, "Post preview"),
          el("div", { class: "oep-discussion-preview__body" }),
        );
        const anchor =
          textarea.closest(".beatmap-discussion-new__message") ||
          textarea.parentElement ||
          composerRoot;
        anchor.insertAdjacentElement("afterend", preview);
      }

      const body = preview.querySelector(".oep-discussion-preview__body");
      if (!(body instanceof HTMLElement)) return;
      const repaint = () => {
        const visibleNow = isVisibleTextarea(textarea);
        const hasTextNow = String(textarea.value || "").trim().length > 0;
        body.innerHTML = renderMarkdownPreviewHtml(textarea.value || "");
        if (isReplyComposer && !visibleNow) {
          helper.remove();
          toggleBtn.hidden = true;
          preview.hidden = true;
          return;
        }
        helper.hidden = false;
        toggleBtn.hidden = !hasTextNow;
        preview.hidden = !hasTextNow || !previewEnabled;
      };

      toggleBtn.addEventListener("click", () => {
        previewEnabled = !previewEnabled;
        toggleBtn?.setAttribute(
          "aria-pressed",
          previewEnabled ? "true" : "false",
        );
        repaint();
      });
      textarea.addEventListener("input", repaint);
      repaint();
    }

    /** Remove helpers outside a visible reply/new-discussion shell (e.g. stuck before Respond). */
    function pruneDetachedMarkdownHelpers() {
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const replyShell =
          node.closest(".beatmap-discussion-post--new-reply") ||
          node.closest(".beatmap-discussion-reply-box");
        if (replyShell instanceof HTMLElement) {
          const ta = replyShell.querySelector("textarea");
          const keep =
            ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        const newShell = node.closest(".beatmap-discussion-new");
        if (newShell instanceof HTMLElement) {
          const ta = newShell.querySelector("textarea");
          const keep =
            ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        node.remove();
      });
    }

    /** After helper teardown, textarea may still be marked; re-bind when Respond is open again. */
    function reviveReplyPreviewIfNeeded() {
      document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((ta) => {
        if (!(ta instanceof HTMLTextAreaElement) || !ta.isConnected) return;
        const replyRoot =
          ta.closest(".beatmap-discussion-post--new-reply") ||
          ta.closest(".beatmap-discussion-reply-box");
        if (!(replyRoot instanceof HTMLElement)) return;
        if (!isVisibleTextarea(ta)) return;
        if (replyRoot.querySelector(`[${HELPER_ATTR}]`)) return;
        ta.removeAttribute(MARKER_ATTR);
        bindTextareaPreview(ta);
      });
    }

    const run = () => {
      if (!isSupportedDiscussionPath()) {
        document
          .querySelectorAll(`[${TOGGLE_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`[${PREVIEW_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`[${HELPER_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`textarea[${MARKER_ATTR}]`)
          .forEach((n) => n.removeAttribute(MARKER_ATTR));
        document
          .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
          .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
        return;
      }
      const textareas = collectCandidateTextareas();
      for (const ta of textareas) bindTextareaPreview(ta);
      // Keep placement stable when reply footer is re-rendered on collapse/expand.
      document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        const ta =
          Array.from(root.querySelectorAll("textarea")).find((node) =>
            isVisibleTextarea(node),
          ) || root.querySelector("textarea");
        const btn = root.querySelector(`[${TOGGLE_ATTR}]`);
        const preview = root.querySelector(`[${PREVIEW_ATTR}]`);
        const extraHelpers = root.querySelectorAll(`[${HELPER_ATTR}]`);
        if (extraHelpers.length > 1) {
          Array.from(extraHelpers)
            .slice(1)
            .forEach((n) => n.remove());
        }
        const helper = root.querySelector(`[${HELPER_ATTR}]`);
        if (!(btn instanceof HTMLElement)) return;
        const isReplyComposer =
          root.classList.contains("beatmap-discussion-post--new-reply") ||
          root.classList.contains("beatmap-discussion-reply-box");
        const isNewDiscussionRoot = root.classList.contains(
          "beatmap-discussion-new",
        );
        const hasTextNow =
          ta instanceof HTMLTextAreaElement &&
          String(ta.value || "").trim().length > 0;
        if (isReplyComposer && !isVisibleTextarea(ta)) {
          btn.hidden = true;
          if (preview instanceof HTMLElement) preview.hidden = true;
          if (helper instanceof HTMLElement) helper.remove();
          return;
        }
        if ((isReplyComposer || isNewDiscussionRoot) && !hasTextNow) {
          btn.hidden = true;
          if (preview instanceof HTMLElement) preview.hidden = true;
          if (helper instanceof HTMLElement) helper.hidden = false;
          return;
        }
        if (helper instanceof HTMLElement) helper.hidden = false;
        btn.hidden = false;
        placePreviewToggleButton(
          root,
          btn,
          ta instanceof HTMLTextAreaElement ? ta : null,
        );
      });
      pruneDetachedMarkdownHelpers();
      reviveReplyPreviewIfNeeded();
    };

    let debounceTimer = 0;
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 80);
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });
    schedule();

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      document.querySelectorAll(`[${TOGGLE_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
      document
        .querySelectorAll(`textarea[${MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(MARKER_ATTR));
      document
        .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
    };
  }

  /**
   * Redirects discussion landing routes to the Total tab when enabled.
   * @param {RegExp} pathRe
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function startBeatmapDiscussionLandingRedirectManager(pathRe, beatmapsetId) {
    const targetPath = `/beatmapsets/${beatmapsetId}/discussion/-/generalAll/total`;
    const bareDiscussionRe = new RegExp(
      `^/beatmapsets/${beatmapsetId}/discussion/?$`,
      "i",
    );

    const run = () => {
      if (!settings.isEnabled(DISCUSSION_DEFAULT_TO_TOTAL_ID)) return;
      if (!pathRe.test(location.pathname)) return;
      if (
        /^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i.test(
          location.pathname,
        )
      ) {
        return;
      }
      if (!bareDiscussionRe.test(location.pathname)) return;
      location.replace(
        `${targetPath}${location.search || ""}${location.hash || ""}`,
      );
    };

    run();
    const offSetting = settings.onChange(
      DISCUSSION_DEFAULT_TO_TOTAL_ID,
      (enabled) => {
        if (!enabled) return;
        run();
      },
    );
    return () => {
      try {
        offSetting?.();
      } catch (_) {
        void 0;
      }
    };
  }

  // Attribute to mark links we've patched so we can revert them on cleanup.
  const DISCUSSION_TAB_ORIG_HREF_ATTR = "data-oep-discussion-tab-orig-href";

  /**
   * Rewrites Discussion tab links for this beatmapset to land directly on the
   * Total sub-tab.  Matches via `a.href` (always the resolved absolute URL) so
   * it works regardless of whether React rendered a relative or absolute href.
   * @param {string} beatmapsetId
   */
  function _patchDiscussionTabLinks(beatmapsetId) {
    const bareSuffix = `/beatmapsets/${beatmapsetId}/discussion`;
    const target = `${bareSuffix}/-/generalAll/total`;
    document.querySelectorAll("a").forEach((a) => {
      // a.href is always absolute; strip trailing slash for comparison.
      const resolved = a.href.replace(/\/$/, "");
      if (resolved !== `${location.origin}${bareSuffix}`) return;
      if (!a.hasAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR)) {
        a.setAttribute(
          DISCUSSION_TAB_ORIG_HREF_ATTR,
          a.getAttribute("href") ?? "",
        );
      }
      a.setAttribute("href", target);
    });
  }

  /** Reverts any links patched by `_patchDiscussionTabLinks`. */
  function _revertDiscussionTabLinks() {
    document
      .querySelectorAll(`a[${DISCUSSION_TAB_ORIG_HREF_ATTR}]`)
      .forEach((a) => {
        a.setAttribute(
          "href",
          a.getAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR) ?? "",
        );
        a.removeAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR);
      });
  }

  /**
   * Patches the Discussion tab links to go straight to the Total sub-tab.
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function startDiscussionTabLinkPatcher(beatmapsetId) {
    if (settings.isEnabled(DISCUSSION_DEFAULT_TO_TOTAL_ID)) {
      _patchDiscussionTabLinks(beatmapsetId);
    }

    const offSetting = settings.onChange(
      DISCUSSION_DEFAULT_TO_TOTAL_ID,
      (enabled) => {
        if (enabled) _patchDiscussionTabLinks(beatmapsetId);
        else _revertDiscussionTabLinks();
      },
    );

    return () => {
      offSetting();
      _revertDiscussionTabLinks();
    };
  }

  /**
   * Enhances voters avatar tooltips into a scrollable user list.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapDiscussionVotersTooltipManager(pathRe) {
    const ENHANCED_ATTR = "data-oep-discussion-voters-tooltip";
    const USER_ROW_ATTR = "data-oep-voter-user-id";
    const inFlight = new Map();
    const queue = [];
    let activeFetches = 0;
    const MAX_CONCURRENT = 4;

    const parseUserIdFromHref = (href) => {
      const m = String(href || "").match(/\/users\/(\d+)(?:\/|$)/i);
      return m ? m[1] : "";
    };

    const extractNameFromNode = (node, fallbackId) => {
      if (!(node instanceof Element))
        return fallbackId ? `User ${fallbackId}` : "User";
      const val =
        node.getAttribute("title") ||
        node.getAttribute("aria-label") ||
        node.getAttribute("data-tooltip") ||
        node.getAttribute("alt") ||
        node.textContent ||
        "";
      const cleaned = String(val).replace(/\s+/g, " ").trim();
      return cleaned || (fallbackId ? `User ${fallbackId}` : "User");
    };

    const buildUserRowsFromTooltip = (tooltip) => {
      const users = [];
      const seen = new Set();
      const pushUser = (idRaw, avatarRaw, nameRaw) => {
        const id = String(idRaw || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        users.push({
          id,
          href: `/users/${id}`,
          avatar: String(avatarRaw || "").trim(),
          name: String(nameRaw || "").trim() || `User ${id}`,
        });
      };

      // Primary shape: anchors directly linking to /users/{id}.
      const links = Array.from(tooltip.querySelectorAll('a[href*="/users/"]'));
      for (const link of links) {
        if (!(link instanceof HTMLAnchorElement)) continue;
        const href = link.href || link.getAttribute("href") || "";
        const id = parseUserIdFromHref(href);
        if (!id) continue;
        const img = link.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name =
          extractNameFromNode(link, id) || extractNameFromNode(img, id);
        pushUser(id, avatar, name);
      }

      // Fallback shape: nodes carrying data-user-id (common in some vote tooltips).
      const userIdNodes = Array.from(
        tooltip.querySelectorAll("[data-user-id]"),
      );
      for (const node of userIdNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const id = String(node.getAttribute("data-user-id") || "").trim();
        if (!id) continue;
        const img = node.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name =
          extractNameFromNode(node, id) || extractNameFromNode(img, id);
        pushUser(id, avatar, name);
      }

      // Final fallback: avatar-only nodes that still expose osu avatar URL with numeric id.
      const imgs = Array.from(tooltip.querySelectorAll("img"));
      for (const img of imgs) {
        if (!(img instanceof HTMLImageElement)) continue;
        const src = String(img.src || "");
        const m = src.match(/https?:\/\/a\.ppy\.sh\/(\d+)(?:\b|\/|\?)/i);
        if (!m) continue;
        const id = m[1];
        const anchor = img.closest('a[href*="/users/"]');
        const name = extractNameFromNode(anchor || img, id);
        pushUser(id, src, name);
      }

      return users;
    };

    const isSingleUserCardTooltip = (tooltip) => {
      if (!(tooltip instanceof HTMLElement)) return false;
      const cardRoot = tooltip.querySelector(
        '[class*="user-card"], [class*="profile-card"], [class*="user-popup"]',
      );
      if (cardRoot) return true;

      const allClasses = [
        tooltip.className,
        ...Array.from(tooltip.querySelectorAll("[class]")).map(
          (n) => n.className,
        ),
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return /\buser-card\b|\bprofile-card\b|\buser-popup\b/.test(allClasses);
    };

    const scheduleUserFetch = (id, onDone) => {
      if (!id) return;
      if (DISCUSSION_USER_CACHE.has(id)) {
        onDone?.(DISCUSSION_USER_CACHE.get(id));
        return;
      }
      if (inFlight.has(id)) {
        inFlight.get(id).then((data) => onDone?.(data));
        return;
      }

      queue.push({ id, onDone });
      const pump = () => {
        while (activeFetches < MAX_CONCURRENT && queue.length) {
          const next = queue.shift();
          if (!next || !next.id) continue;
          const uid = next.id;

          if (DISCUSSION_USER_CACHE.has(uid)) {
            next.onDone?.(DISCUSSION_USER_CACHE.get(uid));
            continue;
          }
          if (inFlight.has(uid)) {
            inFlight.get(uid).then((data) => next.onDone?.(data));
            continue;
          }

          activeFetches += 1;
          const req = OsuExpertPlus.api
            .getUser(uid)
            .then((user) => {
              const data = {
                id: String(user?.id || uid),
                username: String(user?.username || `User ${uid}`),
                avatarUrl:
                  String(user?.avatar_url || "").trim() ||
                  `https://a.ppy.sh/${uid}`,
              };
              DISCUSSION_USER_CACHE.set(uid, data);
              return data;
            })
            .catch(() => {
              const fallback = {
                id: String(uid),
                username: `User ${uid}`,
                avatarUrl: `https://a.ppy.sh/${uid}`,
              };
              DISCUSSION_USER_CACHE.set(uid, fallback);
              return fallback;
            })
            .finally(() => {
              inFlight.delete(uid);
              activeFetches = Math.max(0, activeFetches - 1);
              pump();
            });
          inFlight.set(uid, req);
          req.then((data) => next.onDone?.(data));
        }
      };
      pump();
    };

    const hydrateVisibleRows = (container) => {
      if (!(container instanceof HTMLElement)) return () => {};
      const rows = Array.from(container.querySelectorAll(`[${USER_ROW_ATTR}]`));
      if (!rows.length) return () => {};

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const row = entry.target;
            if (!(row instanceof HTMLAnchorElement)) continue;
            const uid = row.getAttribute(USER_ROW_ATTR) || "";
            if (!uid || row.getAttribute("data-oep-user-loaded") === "1") {
              observer.unobserve(row);
              continue;
            }

            scheduleUserFetch(uid, (u) => {
              if (!u || !row.isConnected) return;
              const img = row.querySelector(
                ".oep-discussion-voters-tooltip__avatar",
              );
              const name = row.querySelector(
                ".oep-discussion-voters-tooltip__name",
              );
              if (img instanceof HTMLImageElement) {
                img.src = u.avatarUrl;
                img.alt = u.username;
              }
              if (name instanceof HTMLElement) name.textContent = u.username;
              row.href = `/users/${u.id}`;
              row.setAttribute("data-oep-user-loaded", "1");
            });
            observer.unobserve(row);
          }
        },
        { root: container, threshold: 0.01 },
      );

      rows.forEach((r) => observer.observe(r));
      return () => observer.disconnect();
    };

    const maybeEnhanceTooltip = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.getAttribute(ENHANCED_ATTR) === "1") return;
      if (!pathRe.test(location.pathname)) return;
      if (!/^\/beatmapsets\/\d+\/discussion(?:\/|$)/i.test(location.pathname))
        return;

      const role = node.getAttribute("role") || "";
      const cls = node.className || "";
      if (
        role !== "tooltip" &&
        !/\btooltip\b/i.test(cls) &&
        !/\bqtip\b/i.test(cls)
      ) {
        return;
      }
      if (isSingleUserCardTooltip(node)) return;

      const users = buildUserRowsFromTooltip(node);
      if (users.length < 1) return;

      node.setAttribute(ENHANCED_ATTR, "1");
      node.classList.add("oep-discussion-voters-tooltip");

      const list = el("div", { class: "oep-discussion-voters-tooltip__list" });
      for (const u of users) {
        const row = el(
          "a",
          {
            class: "oep-discussion-voters-tooltip__row",
            href: u.href,
            [USER_ROW_ATTR]: String(u.id),
          },
          el("img", {
            class: "oep-discussion-voters-tooltip__avatar",
            src: u.avatar || `https://a.ppy.sh/${u.id}`,
            alt: u.name,
            loading: "lazy",
          }),
          el("span", { class: "oep-discussion-voters-tooltip__name" }, u.name),
        );
        list.appendChild(row);
      }

      node.replaceChildren(list);
      hydrateVisibleRows(list);
    };

    const processExisting = () => {
      const tips = document.querySelectorAll(
        '[role="tooltip"], .tooltip, .qtip',
      );
      tips.forEach((tip) => maybeEnhanceTooltip(tip));
    };

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          maybeEnhanceTooltip(n);
          n.querySelectorAll?.('[role="tooltip"], .tooltip, .qtip').forEach(
            (tip) => maybeEnhanceTooltip(tip),
          );
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    processExisting();

    return () => {
      obs.disconnect();
      document.querySelectorAll(`[${ENHANCED_ATTR}]`).forEach((n) => {
        n.removeAttribute(ENHANCED_ATTR);
        n.classList.remove("oep-discussion-voters-tooltip");
      });
    };
  }

  const EXTENDED_SCORE_ROW_ATTR = "data-oep-api-extended-score";
  const EXTENDED_LB_LIMIT = 100;
  const SCORES_LIMIT_PATCH_FLAG = "__oepBeatmapScoresLimitPatched";
  /** osu-web uses `.beatmap-scoreboard-table` on the wrapper `div`; the real `<table>` is `__table`. */
  const SCOREBOARD_HTML_TABLE_SEL = "table.beatmap-scoreboard-table__table";
  /** Same tokens as user-profile score stats (`.oep-score-stats__val--*`) + mode extras. */
  const SCOREBOARD_HITSTAT_COLOR_CLASSES = [
    "oep-score-stats__val--300",
    "oep-score-stats__val--100",
    "oep-score-stats__val--50",
    "oep-score-stats__val--miss",
    "oep-score-stats__val--ctb-l",
    "oep-score-stats__val--ctb-drp",
    "oep-score-stats__val--mania-perfect",
    "oep-score-stats__val--mania-good",
  ];
  const SCOREBOARD_PP_VALUE_CLASS = "oep-beatmap-scoreboard-pp-value";
  /** @type {Map<string, number|null>} */
  const _beatmapFullComboCache = new Map();

  /**
   * @param {string} rawUrl
   * @returns {string}
   */
  function withBeatmapScoresLimit(rawUrl) {
    const src = String(rawUrl || "");
    if (!src) return src;
    if (!settings.isEnabled(API_EXTENDED_LEADERBOARD_ID)) return src;
    try {
      const u = new URL(src, location.origin);
      if (!/^\/beatmaps\/\d+\/scores$/i.test(u.pathname)) return src;
      if (
        u.origin !== location.origin &&
        u.origin.toLowerCase() !== "https://osu.ppy.sh"
      ) {
        return src;
      }
      if (u.searchParams.get("limit") === String(EXTENDED_LB_LIMIT)) return src;
      u.searchParams.set("limit", String(EXTENDED_LB_LIMIT));
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src)) return u.toString();
      if (src.startsWith("//"))
        return `//${u.host}${u.pathname}${u.search}${u.hash}`;
      return `${u.pathname}${u.search}${u.hash}`;
    } catch (_) {
      return src;
    }
  }

  function installBeatmapScoresLimitPatch() {
    if (window[SCORES_LIMIT_PATCH_FLAG]) return;
    window[SCORES_LIMIT_PATCH_FLAG] = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      try {
        if (typeof input === "string") {
          return nativeFetch(withBeatmapScoresLimit(input), init);
        }
        if (input instanceof URL) {
          return nativeFetch(withBeatmapScoresLimit(input.toString()), init);
        }
        if (input instanceof Request) {
          const patchedUrl = withBeatmapScoresLimit(input.url);
          if (patchedUrl !== input.url) {
            return nativeFetch(new Request(patchedUrl, input), init);
          }
        }
      } catch (_) {
        void 0;
      }
      return nativeFetch(input, init);
    };

    const nativeXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedXhrOpen(
      method,
      url,
      ...rest
    ) {
      const raw = typeof url === "string" ? url : String(url ?? "");
      return nativeXhrOpen.call(
        this,
        method,
        withBeatmapScoresLimit(raw),
        ...rest,
      );
    };
  }

  /**
   * Beatmap max combo (full combo count) parsed once from the page's beatmap JSON.
   * Used to highlight combo text only for exact full-combo scores.
   * @param {string} beatmapId
   * @returns {number|null}
   */
  function getBeatmapFullComboFromBeatmapsetJson(beatmapId) {
    const key = String(beatmapId);
    if (_beatmapFullComboCache.has(key)) {
      return _beatmapFullComboCache.get(key) ?? null;
    }
    const data = readBeatmapsetJson();
    const idNum = Number(beatmapId);
    const found =
      data?.beatmaps?.find(
        (b) => b?.id === idNum || String(b?.id ?? "") === String(beatmapId),
      ) ?? null;
    const raw = found?.max_combo ?? found?.maxCombo ?? null;
    const n = raw != null ? Number(raw) : NaN;
    const maxCombo = Number.isFinite(n) && n > 0 ? n : null;
    _beatmapFullComboCache.set(key, maxCombo);
    return maxCombo;
  }

  /**
   * Row #1 is often NM — no `.beatmap-scoreboard-mod` inside its mods cell. Use any
   * mod chip on the table or the scoreboard filter bar as clone source.
   * @param {ParentNode|null|undefined} scoreboardRoot
   * @returns {HTMLElement|null}
   */
  function resolveBeatmapScoreboardModTemplateEl(scoreboardRoot) {
    const inRoot = (sel) => scoreboardRoot?.querySelector?.(sel) ?? null;
    // Expert+ mod grid hides osu’s original strip with data-oep-mod-hidden; those nodes
    // are first in DOM order and can be stale for masks — prefer grid pile clones.
    const pileModSel = `.${MOD_GRID_CLASS}__pile .beatmap-scoreboard-mod`;
    const stripVisibleSel =
      ".beatmapset-scoreboard__mods .beatmap-scoreboard-mod:not([data-oep-mod-hidden])";
    const chain = [
      () => inRoot(".beatmap-scoreboard-table__mods .beatmap-scoreboard-mod"),
      () => inRoot(".beatmap-scoreboard-table__body .beatmap-scoreboard-mod"),
      () => inRoot(pileModSel),
      () => document.querySelector(pileModSel),
      () => inRoot(stripVisibleSel),
      () => document.querySelector(stripVisibleSel),
      () =>
        document.querySelector(
          ".beatmap-scoreboard-mod:not([data-oep-mod-hidden])",
        ),
      () => document.querySelector(".beatmap-scoreboard-mod"),
    ];
    for (const fn of chain) {
      const el = fn();
      if (el instanceof HTMLElement) return el;
    }
    return null;
  }

  /**
   * @returns {boolean}
   */
  function isLazerModeEnabledForLeaderboard() {
    // Account menu toggle reflects current preference; checked icon means lazer mode on.
    const toggle = document.querySelector(
      'button[title*="Lazer mode"][data-url*="legacy_score_only"]',
    );
    if (!(toggle instanceof HTMLButtonElement)) return false;
    return Boolean(toggle.querySelector(".fa-check-square"));
  }

  /**
   * Main score column value aligned with osu-web's Lazer mode toggle.
   * Lazer mode off -> prefer `legacy_total_score`.
   * Lazer mode on  -> prefer `classic_total_score`.
   * @param {object} s
   */
  function leaderboardTableScoreNumber(s) {
    const nz = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    const cls = nz(s.classic_total_score);
    const leg = nz(s.legacy_total_score);
    if (isLazerModeEnabledForLeaderboard()) {
      if (cls) return cls;
      if (leg) return leg;
    } else {
      if (leg) return leg;
      if (cls) return cls;
    }
    const tot = nz(s.total_score);
    if (tot) return tot;
    const raw = nz(s.score);
    if (raw) return raw;
    const xTot = Number(s.total_score);
    if (Number.isFinite(xTot)) return xTot;
    const xLeg = Number(s.legacy_total_score);
    if (Number.isFinite(xLeg)) return xLeg;
    return 0;
  }

  /**
   * @param {object[]} scores
   */
  function sortLeaderboardScoresLikeTable(scores) {
    scores.sort((a, b) => {
      const ds =
        leaderboardTableScoreNumber(b) - leaderboardTableScoreNumber(a);
      if (ds !== 0) return ds;
      const ppb = Number(b.pp);
      const ppa = Number(a.pp);
      if (Number.isFinite(ppb) && Number.isFinite(ppa) && ppb !== ppa)
        return ppb - ppa;
      return (
        (Number(leaderboardScoreId(b)) || 0) -
        (Number(leaderboardScoreId(a)) || 0)
      );
    });
  }

  /**
   * @returns {string|null}
   */
  function getBeatmapPageBeatmapId() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\/(\d+)/i);
    if (fromHash) return fromHash[2];

    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      const fromPickerHash = href.match(/#(osu|taiko|fruits|mania)\/(\d+)/i);
      if (fromPickerHash) return fromPickerHash[2];
      const fromPath = href.match(/\/beatmaps\/(\d+)/);
      if (fromPath) return fromPath[1];
    }

    const data = readBeatmapsetJson();
    const mode = getBeatmapPageRuleset();
    if (data?.beatmaps?.length) {
      const bm = data.beatmaps.find((b) => b.mode === mode) || data.beatmaps[0];
      if (bm?.id != null) return String(bm.id);
    }

    return null;
  }

  /**
   * @returns {string}
   */
  function getBeatmapPageRuleset() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\//i);
    if (fromHash) return fromHash[1].toLowerCase();
    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      let m = href.match(/#(osu|taiko|fruits|mania)\//i);
      if (m) return m[1].toLowerCase();
      m = href.match(/\/beatmaps\/(\d+)/);
      if (m) {
        const data = readBeatmapsetJson();
        const id = Number(m[1]);
        const found = data?.beatmaps?.find((b) => b.id === id);
        if (found?.mode) return String(found.mode).toLowerCase();
      }
    }
    return "osu";
  }

  /**
   * osu-web wraps values in `td > a.beatmap-scoreboard-table__cell-content`; setting
   * `td.textContent` strips that link and breaks layout/CSS. Writes go on the `<a>`.
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {string} text
   */
  function setScoreboardTdPlainText(td, text) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (a) {
      a.replaceChildren(document.createTextNode(text));
      return;
    }
    td.textContent = text;
  }

  /**
   * Stable numeric id for sorting extended score rows.
   * @param {object|null|undefined} score
   * @returns {string|null}
   */
  function leaderboardScoreId(score) {
    if (!score || typeof score !== "object") return null;
    const raw =
      score.id ??
      score.legacy_score_id ??
      score.score_id ??
      score.scoreId ??
      score.scoreID ??
      score.score?.id ??
      score.score?.legacy_score_id ??
      score.score?.score_id ??
      null;
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n > 0 ? String(n) : null;
    const s = String(raw).trim();
    return s ? s : null;
  }

  /**
   * Short relative labels similar to osu leaderboard (`now`, `2d`, `5mo`, `3y`).
   * @param {string} iso
   */
  function formatScoreboardShortAgo(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 45) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(day / 365);
    if (y < 1) return `${mo}mo`;
    return `${y}y`;
  }

  /**
   * @param {HTMLTableRowElement} templateRow
   * @param {number|null|undefined} colIndex
   * @returns {HTMLTableCellElement|null}
   */
  function scoreboardRefTd(templateRow, colIndex) {
    if (colIndex == null || !(templateRow instanceof HTMLTableRowElement))
      return null;
    const tds = templateRow.querySelectorAll("td");
    return /** @type {HTMLTableCellElement|null} */ (tds[colIndex] ?? null);
  }

  /**
   * Copy `a` classes and reuse the first `<span>` shell when present (matches native typography).
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {string} text
   */
  function applyScoreboardTextCellLikeRef(td, refTd, text) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );

    // Common osu-web markup: `td > a.beatmap-scoreboard-table__cell-content`.
    if (a instanceof HTMLAnchorElement) {
      if (refA instanceof HTMLAnchorElement) a.className = refA.className;
      const refShell = refA?.firstElementChild;
      if (refShell instanceof HTMLElement) {
        const shell = refShell.cloneNode(false);
        shell.textContent = text;
        a.replaceChildren(shell);
      } else {
        a.replaceChildren(document.createTextNode(text));
      }
      return;
    }

    // Some columns (notably hitstats) are not links: `td > ...__cell-content`.
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    const refShellParent =
      refTd?.querySelector(".beatmap-scoreboard-table__cell-content") || null;
    if (shell instanceof HTMLElement && refShellParent instanceof HTMLElement) {
      shell.className = refShellParent.className;
      const refChild = refShellParent.firstElementChild;
      if (refChild instanceof HTMLElement) {
        const child = refChild.cloneNode(false);
        child.textContent = text;
        shell.replaceChildren(child);
      } else {
        shell.replaceChildren(document.createTextNode(text));
      }
      return;
    }

    // Fallback: still update something visible.
    td.textContent = text;
  }

  /**
   * @param {string} cls
   * @param {boolean} on
   */
  function toggleScoreboardCellPerfectClass(cls, on) {
    const PERF = "beatmap-scoreboard-table__cell-content--perfect";
    const base = cls
      .replace(new RegExp(`\\s*${PERF}\\b`, "g"), "")
      .trim()
      .replace(/\s+/g, " ");
    return on ? `${base} ${PERF}`.trim() : base;
  }

  /**
   * API v2 Score (solo) uses `is_perfect_combo` / `legacy_perfect`; some payloads still expose `perfect`.
   * @param {object} score
   * @returns {boolean}
   */
  function scoreApiIndicatesComboPerfect(score) {
    if (!score || typeof score !== "object") return false;
    if (score.perfect === true) return true;
    if (score.is_perfect_combo === true) return true;
    if (score.legacy_perfect === true) return true;
    return false;
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   * @param {number|null|undefined} mapFullCombo
   */
  function applyScoreboardComboCell(td, refTd, score, mapFullCombo) {
    if (!td) return;
    const comboStr = `${Number(score.max_combo ?? 0).toLocaleString("en-US")}x`;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    const maxCombo = Number(score.max_combo ?? 0);
    const stats =
      score?.statistics && typeof score.statistics === "object"
        ? score.statistics
        : {};
    const maxComboFromStats = Number(
      score.maximum_statistics?.max_combo ??
        score.maximum_statistics?.maxCombo ??
        stats.max_combo ??
        stats.maxCombo,
    );
    const mapFull = mapFullCombo != null ? Number(mapFullCombo) : NaN;
    const hasMapFull = Number.isFinite(mapFull) && mapFull > 0;
    const inferredPerfect = hasMapFull
      ? maxCombo > 0 && maxCombo === mapFull
      : Number.isFinite(maxComboFromStats) &&
        maxComboFromStats > 0 &&
        maxCombo === maxComboFromStats;
    const perfect = scoreApiIndicatesComboPerfect(score) || inferredPerfect;
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = comboStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(comboStr));
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardAccuracyCell(td, refTd, score) {
    if (!td) return;
    const accStr =
      typeof score.accuracy === "number"
        ? `${(score.accuracy * 100).toFixed(2)}%`
        : "";
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    const perfect = typeof score.accuracy === "number" && score.accuracy >= 1;
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = accStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(accStr));
  }

  /**
   * Display pp on score rows (keep decimal precision from API value).
   * Mirrors native tooltip metadata by writing full pp into `title` /
   * `data-orig-title` on the span.
   *
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardPpCell(td, refTd, score) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    a.className = refA.className;
    const pp = score.pp;
    const refSpan = refA.querySelector("span");
    if (pp == null || !Number.isFinite(Number(pp))) {
      if (refSpan) {
        const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
        s.textContent = "—";
        s.removeAttribute("title");
        s.removeAttribute("data-orig-title");
        s.removeAttribute("data-original-title");
        s.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        a.replaceChildren(s);
      } else {
        a.replaceChildren(document.createTextNode("—"));
      }
      return;
    }
    const ppNumber = Number(pp);
    const titleStr = String(pp).replace(/,/g, "").trim();
    const displayStr = String(Math.round(ppNumber));
    if (refSpan) {
      const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
      s.textContent = displayStr;
      s.setAttribute("title", titleStr);
      s.setAttribute("data-orig-title", titleStr);
      a.replaceChildren(s);
    } else {
      a.replaceChildren(document.createTextNode(displayStr));
    }
  }

  /**
   * Native scoreboard rows keep full pp in `span[title]` while visible text is integer.
   * Mirror user-profile behavior when “PP decimals on scores” is enabled.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardPpDecimals(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const showPpDecimals = Boolean(settings?.isEnabled?.(SCORE_PP_DECIMALS_ID));
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!td) continue;
        const span = td.querySelector(
          "a.beatmap-scoreboard-table__cell-content > span[title], span.beatmap-scoreboard-table__cell-content > span[title]",
        );
        if (!(span instanceof HTMLSpanElement)) continue;
        const textNode = Array.from(span.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        if (!textNode) continue;
        const full = span.getAttribute("title");
        const n = parseLocaleNumber(full || "");
        if (!Number.isFinite(n)) continue;

        if (showPpDecimals) {
          if (!span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
            span.setAttribute(
              SCOREBOARD_PP_ORIGINAL_ATTR,
              String(textNode.textContent || "").trim(),
            );
          }
          textNode.textContent = formatDecimalPp(n);
        } else if (span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
          textNode.textContent =
            span.getAttribute(SCOREBOARD_PP_ORIGINAL_ATTR) ||
            textNode.textContent;
          span.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        }
      }
    }
  }

  /**
   * Map hit-stat column label (from `buildBeatmapScoreboardColumnMap`) to profile palette class.
   * @param {string} labelRaw
   * @returns {string}
   */
  function beatmapHitstatColorClassFromLabel(labelRaw) {
    const lab = String(labelRaw).trim().toLowerCase();
    if (!lab) return "";
    if (lab === "mania_perfect") return "oep-score-stats__val--mania-perfect";
    if (lab === "mania_good") return "oep-score-stats__val--mania-good";
    if (lab === "ctb_l") return "oep-score-stats__val--ctb-l";
    if (lab === "ctb_drp") return "oep-score-stats__val--ctb-drp";
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return "oep-score-stats__val--miss";
    if (lab === "meh" || /(^|[^0-9])50([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--50";
    if (lab === "geki" || lab === "max" || lab === "320")
      return "oep-score-stats__val--300";
    if (lab === "katu" || lab === "200") return "oep-score-stats__val--100";
    if (lab === "ok" || /(^|[^0-9])100([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--100";
    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return "oep-score-stats__val--300";
    return "";
  }

  /**
   * @param {HTMLElement|null|undefined} el
   */
  function clearBeatmapScoreboardHitstatColorClasses(el) {
    if (!(el instanceof HTMLElement)) return;
    for (const c of SCOREBOARD_HITSTAT_COLOR_CLASSES) el.classList.remove(c);
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {HTMLElement|null}
   */
  function beatmapScoreboardHitstatPaintTarget(td) {
    if (!td) return null;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (a instanceof HTMLElement) {
      const sp = a.querySelector("span");
      if (sp instanceof HTMLElement) return sp;
      return a;
    }
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    if (shell instanceof HTMLElement) {
      const kid = shell.firstElementChild;
      if (kid instanceof HTMLElement) return kid;
      return shell;
    }
    return td;
  }

  /**
   * Color GREAT/OK/MEH/MISS (and 300/100/50) leaderboard headers + counts; palette matches profile score card.
   * Always applied on beatmapset scoreboards (not gated by profile “hit statistics” setting).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardHitstatColors(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      const indices = colMap.hitstatIndices || [];
      if (!indices.length) continue;

      for (const i of indices) {
        const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
        const colorClass = beatmapHitstatColorClassFromLabel(label);

        const th = [...table.querySelectorAll("thead th")].find(
          (t) => t instanceof HTMLTableCellElement && t.cellIndex === i,
        );
        if (th instanceof HTMLElement) {
          clearBeatmapScoreboardHitstatColorClasses(th);
          if (colorClass) th.classList.add(colorClass);
        }

        const rows = table.querySelectorAll(
          "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
        );
        for (const row of rows) {
          const td = row.cells?.[i];
          if (!(td instanceof HTMLTableCellElement)) continue;
          const target = beatmapScoreboardHitstatPaintTarget(td);
          if (!(target instanceof HTMLElement)) continue;
          clearBeatmapScoreboardHitstatColorClasses(target);
          if (colorClass) target.classList.add(colorClass);
        }
      }
    }
  }

  /**
   * Light purple PP numbers on the beatmap leaderboard (all rulesets).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardPpValueColor(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!(td instanceof HTMLTableCellElement)) continue;
        const target = beatmapScoreboardHitstatPaintTarget(td);
        if (!(target instanceof HTMLElement)) continue;
        target.classList.add(SCOREBOARD_PP_VALUE_CLASS);
      }
    }
  }

  /**
   * Leaderboard sort for this tab only (not GM); default score descending.
   * @type {{ key: string, dir: "asc"|"desc" }}
   */
  let beatmapScoreboardSortState = { key: "score", dir: "desc" };

  /**
   * @returns {{ key: string, dir: "asc"|"desc" }}
   */
  function readBeatmapScoreboardSortState() {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(
      beatmapScoreboardSortState.key,
    )
      ? beatmapScoreboardSortState.key
      : "score";
    const d =
      beatmapScoreboardSortState.dir === "asc" ? "asc" : "desc";
    return { key: k, dir: d };
  }

  /**
   * @param {string} key
   * @param {"asc"|"desc"} dir
   */
  function writeBeatmapScoreboardSortState(key, dir) {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(String(key).toLowerCase())
      ? String(key).toLowerCase()
      : "score";
    const d = dir === "asc" ? "asc" : "desc";
    beatmapScoreboardSortState = { key: k, dir: d };
  }

  /**
   * @param {string} sortKey
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @returns {number|null}
   */
  function beatmapScoreboardSortColIndex(sortKey, colMap) {
    if (sortKey === "date") return colMap.time;
    return colMap[sortKey] ?? null;
  }

  /**
   * @param {string} sortKey
   * @returns {string}
   */
  function beatmapScoreboardSortColumnLabel(sortKey) {
    if (sortKey === "score") return "Score";
    if (sortKey === "accuracy") return "Accuracy";
    if (sortKey === "combo") return "Combo";
    if (sortKey === "pp") return "PP";
    if (sortKey === "date") return "Date";
    return "Score";
  }

  function applyBeatmapScoreboardSortHeaderClick(sortKey) {
    const { key, dir } = readBeatmapScoreboardSortState();
    let nextDir = "desc";
    if (key === sortKey) {
      nextDir = dir === "desc" ? "asc" : "desc";
    }
    writeBeatmapScoreboardSortState(sortKey, nextDir);
    const board = findBeatmapScoreboardRoot();
    if (board instanceof HTMLElement) {
      refreshBeatmapScoreboardTableEnhancements(board);
    }
  }

  /**
   * @param {string} sortKey
   * @returns {HTMLButtonElement}
   */
  function createBeatmapScoreboardSortHeaderButton(sortKey) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const btn = /** @type {HTMLButtonElement} */ (
      el("button", {
        type: "button",
        class: "oep-scoreboard-th-sort",
        [SCOREBOARD_SORT_ARROW_ATTR]: "",
        "data-oep-sort-key": sortKey,
        "aria-label": `Sort by ${label}`,
        title: `Sort by ${label}`,
      })
    );
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBeatmapScoreboardSortHeaderClick(sortKey);
    });
    return btn;
  }

  /**
   * @param {HTMLButtonElement} btn
   * @param {string} sortKey
   * @param {{ key: string, dir: "asc"|"desc" }} state
   */
  function updateBeatmapScoreboardSortHeaderButton(btn, sortKey, state) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const active = state.key === sortKey;
    const sym = !active ? "▼" : state.dir === "desc" ? "▼" : "▲";
    btn.classList.toggle("oep-scoreboard-th-sort--active", active);
    if (btn.textContent !== sym) btn.textContent = sym;
    const tip = `Sort by ${label}`;
    btn.setAttribute("aria-label", tip);
    btn.title = tip;
    if (active) {
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.removeAttribute("aria-pressed");
    }
  }

  /**
   * Re-attaches sort arrows after osu-web replaces thead (SPA). Idempotent.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardHeaderSortUi(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbodyRow = table.querySelector(
      "tbody.beatmap-scoreboard-table__body tr.beatmap-scoreboard-table__body-row",
    );
    if (!(tbodyRow instanceof HTMLTableRowElement)) return;
    const colMap = buildBeatmapScoreboardColumnMap(tbodyRow, table);
    const theadRow = table.querySelector("thead tr");
    if (!(theadRow instanceof HTMLTableRowElement)) return;
    const state = readBeatmapScoreboardSortState();

    for (let i = 0; i < theadRow.cells.length; i++) {
      const th = theadRow.cells[i];
      if (!(th instanceof HTMLTableCellElement)) continue;
      const btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) continue;
      const k = btn.getAttribute("data-oep-sort-key");
      const expected =
        k != null ? beatmapScoreboardSortColIndex(k, colMap) : null;
      if (expected == null || th.cellIndex !== expected) {
        btn.remove();
      }
    }

    /** @type {Array<[string, number|null]>} */
    const pairs = [
      ["score", colMap.score],
      ["accuracy", colMap.accuracy],
      ["combo", colMap.combo],
      ["pp", colMap.pp],
      ["date", colMap.time],
    ];
    for (const [sk, cellIdx] of pairs) {
      if (cellIdx == null) continue;
      const th = theadRow.cells[cellIdx];
      if (!(th instanceof HTMLTableCellElement)) continue;
      let btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) {
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      } else if (btn.getAttribute("data-oep-sort-key") !== sk) {
        btn.remove();
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      }
      updateBeatmapScoreboardSortHeaderButton(btn, sk, state);
    }
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {number}
   */
  function beatmapScoreboardTdNumberForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const span = td.querySelector(
      "a.beatmap-scoreboard-table__cell-content span[title], span.beatmap-scoreboard-table__cell-content span[title], span[title]",
    );
    let raw = (
      span?.getAttribute("title") ||
      span?.textContent ||
      td.textContent ||
      ""
    ).trim();
    raw = raw.replace(/\u00a0/g, " ");
    raw = raw
      .replace(/[x×%]/gi, "")
      .replace(/\bpp\b/gi, "")
      .replace(/,/g, "")
      .trim();
    const n = parseLocaleNumber(raw);
    return Number.isFinite(n) ? n : -Infinity;
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {number}
   */
  function beatmapScoreboardTdDateMsForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const timeEl = td.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return -Infinity;
    const raw =
      timeEl.getAttribute("datetime") ||
      timeEl.getAttribute("title") ||
      timeEl.dateTime ||
      "";
    const ms = Date.parse(String(raw).trim());
    return Number.isFinite(ms) ? ms : -Infinity;
  }

  /**
   * @param {HTMLTableRowElement} row
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @param {string} sortKey
   * @returns {number}
   */
  function beatmapScoreboardRowSortPrimary(row, colMap, sortKey) {
    if (sortKey === "date") {
      const i = colMap.time;
      return i != null
        ? beatmapScoreboardTdDateMsForSort(row.cells[i])
        : -Infinity;
    }
    const i =
      sortKey === "score"
        ? colMap.score
        : sortKey === "accuracy"
          ? colMap.accuracy
          : sortKey === "combo"
            ? colMap.combo
            : sortKey === "pp"
              ? colMap.pp
              : colMap.score;
    if (i == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[i]);
  }

  /**
   * @param {HTMLTableRowElement} row
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @returns {number}
   */
  function beatmapScoreboardRowSortTieScore(row, colMap) {
    if (colMap.score == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[colMap.score]);
  }

  /**
   * @param {HTMLTableRowElement[]} visibleRows
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   */
  function renumberBeatmapScoreboardVisibleRanks(visibleRows, colMap) {
    if (colMap.rank == null || !Array.isArray(visibleRows)) return;
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      if (!(row instanceof HTMLTableRowElement)) continue;
      const td = row.cells[colMap.rank];
      if (!td) continue;
      const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
      const target = shell instanceof HTMLElement ? shell : td;
      const cur = String(target.textContent ?? "").trim();
      if (cur === "?") continue;
      const next = String(i + 1);
      if (cur !== next) target.textContent = next;
    }
  }

  /**
   * Reorders visible tbody rows by the chosen column and direction. Hidden native
   * rows stay at the end. Skips DOM writes when order is already correct so the
   * scoreboard MutationObserver does not loop. Updates rank cells for visible rows.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function applyBeatmapScoreboardLeaderboardSort(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbody = table.querySelector("tbody.beatmap-scoreboard-table__body");
    if (!(tbody instanceof HTMLElement)) return;

    const allRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    if (allRows.length < 1) return;

    const visible = allRows.filter(
      (r) => r instanceof HTMLElement && r.style.display !== "none",
    );
    const hidden = allRows.filter(
      (r) => r instanceof HTMLElement && r.style.display === "none",
    );

    if (visible.length < 1) return;

    const templateRow = /** @type {HTMLTableRowElement} */ (visible[0]);
    const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
    const { key: sortKey, dir } = readBeatmapScoreboardSortState();
    const desc = dir === "desc";

    if (visible.length < 2) {
      renumberBeatmapScoreboardVisibleRanks(visible, colMap);
      return;
    }

    const sortedVisible = visible.slice().sort((a, b) => {
      const ar = /** @type {HTMLTableRowElement} */ (a);
      const br = /** @type {HTMLTableRowElement} */ (b);
      const pa = beatmapScoreboardRowSortPrimary(ar, colMap, sortKey);
      const pb = beatmapScoreboardRowSortPrimary(br, colMap, sortKey);
      const pc = desc ? pb - pa : pa - pb;
      if (pc !== 0) return pc;
      const ta = beatmapScoreboardRowSortTieScore(ar, colMap);
      const tb = beatmapScoreboardRowSortTieScore(br, colMap);
      const tc = desc ? tb - ta : ta - tb;
      return tc;
    });

    const desired = [...sortedVisible, ...hidden];
    let same = true;
    for (let i = 0; i < desired.length; i++) {
      if (tbody.children[i] !== desired[i]) {
        same = false;
        break;
      }
    }
    if (!same) {
      for (const row of desired) tbody.appendChild(row);
    }
    renumberBeatmapScoreboardVisibleRanks(sortedVisible, colMap);
  }

  /**
   * Debounced thead sync when osu-web re-renders the scoreboard (SPA).
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardSortControls(pathRe) {
    let debounceTimer = 0;

    const cleanup = () => {
      document
        .querySelectorAll(
          `.beatmapset-scoreboard [${SCOREBOARD_SORT_ARROW_ATTR}]`,
        )
        .forEach((n) => n.remove());
    };

    const run = () => {
      debounceTimer = 0;
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      syncBeatmapScoreboardHeaderSortUi(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    schedule();

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  function beatmapScoreboardRowNeedsRateEditMarkFromDom(row) {
    for (const extSpan of row.querySelectorAll(
      ".beatmap-scoreboard-table__mods .mod__extender span",
    )) {
      const modEl = extSpan.closest(".mod");
      const icon = modEl?.querySelector(".mod__icon[data-acronym]");
      const acronym = (icon?.getAttribute("data-acronym") ?? "")
        .trim()
        .toUpperCase();
      if (
        acronym !== "DT" &&
        acronym !== "NC" &&
        acronym !== "HT" &&
        acronym !== "DC"
      ) {
        continue;
      }
      const rate = parseFloat(
        (extSpan.textContent ?? "").replace(/[^\d.]/g, ""),
      );
      if (
        Number.isFinite(rate) &&
        shouldShowScoreboardModSpeedIndicator(acronym, rate)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} row
   * @returns {boolean}
   */
  function beatmapScoreboardRowIsApiInjectedForRateMarking(row) {
    return (
      row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) ||
      row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) ||
      row.hasAttribute(EXTENDED_SCORE_ROW_ATTR)
    );
  }

  /**
   * Scan all visible leaderboard body rows and mark those with a custom rate
   * using RATE_EDIT_ROW_ATTR.  For each .mod__extender span, walks up to the
   * nearest .mod container to read data-acronym from the sibling .mod__icon,
   * then delegates to shouldShowScoreboardModSpeedIndicator.  Only DT/NC/HT/DC
   * extenders are considered — DA difficulty-adjust extenders (e.g. "AR9") are
   * intentionally ignored.  Works for both native osu-web rows and our injected
   * rows; neither requires the .beatmap-scoreboard-mod wrapper class.
   * Idempotent DOM writes; clears stale RATE_EDIT_ROW_ATTR on native rows only
   * so API-built rows are not stripped when DOM parsing misses an extender.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function applyRateEditMarkingToScoreboardRows(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      if (!(row instanceof HTMLElement)) continue;
      if (row.style.display === "none") continue;
      const needs = beatmapScoreboardRowNeedsRateEditMarkFromDom(row);
      const has = row.hasAttribute(RATE_EDIT_ROW_ATTR);
      if (needs) {
        if (!has) row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      } else if (has && !beatmapScoreboardRowIsApiInjectedForRateMarking(row)) {
        row.removeAttribute(RATE_EDIT_ROW_ATTR);
      }
    }
  }

  /**
   * Wildcard / player-lookup merge keeps osu’s native rows in the tbody with
   * `display: none`. Clearing the rate filter must not reveal them.
   * @param {HTMLElement} row
   * @param {HTMLElement} tbody
   * @returns {boolean}
   */
  function beatmapScoreboardNativeRowSuppressedByMergedLeaderboard(row, tbody) {
    if (
      row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) ||
      row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR)
    ) {
      return false;
    }
    return Boolean(
      tbody.querySelector(
        `tr[${WILDCARD_MERGED_ROW_ATTR}], tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`,
      ),
    );
  }

  /**
   * When the setting is on, hides rows marked as custom-rate (`RATE_EDIT_ROW_ATTR`)
   * using inline `display` so sort/rank logic treats them like other hidden rows.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const hide = settings.isEnabled(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID);
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      if (!(row instanceof HTMLElement)) continue;
      const filtered = row.hasAttribute(RATE_EDIT_ROW_HIDDEN_ATTR);
      const isRate = row.hasAttribute(RATE_EDIT_ROW_ATTR);
      if (hide && isRate) {
        if (!filtered) {
          row.setAttribute(RATE_EDIT_ROW_HIDDEN_ATTR, "1");
          row.style.display = "none";
        }
      } else if (filtered) {
        row.removeAttribute(RATE_EDIT_ROW_HIDDEN_ATTR);
        if (beatmapScoreboardNativeRowSuppressedByMergedLeaderboard(row, tbody)) {
          row.style.display = "none";
        } else {
          row.style.display = "";
        }
      }
    }
  }

  /**
   * Shows the in-page “hide custom rate scores” bar only when the table has at
   * least one `RATE_EDIT_ROW_ATTR` row (including rows hidden by that filter).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapRateEditFilterBarVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const wrap = scoreboardRoot.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (!(wrap instanceof HTMLElement)) return;
    const tbody = scoreboardRoot.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) {
      wrap.hidden = true;
      return;
    }
    const n = tbody.querySelectorAll(
      `tr.beatmap-scoreboard-table__body-row[${RATE_EDIT_ROW_ATTR}]`,
    ).length;
    wrap.hidden = n < 1;
  }

  /**
   * PP decimals, hit-stat header/cell colors, PP column tint, and rate-edit dimming
   * for the main HTML table (native osu-web rows and our API-rendered rows).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function refreshBeatmapScoreboardTableEnhancements(scoreboardRoot) {
    syncBeatmapScoreboardPpDecimals(scoreboardRoot);
    syncBeatmapScoreboardHitstatColors(scoreboardRoot);
    syncBeatmapScoreboardPpValueColor(scoreboardRoot);
    applyRateEditMarkingToScoreboardRows(scoreboardRoot);
    syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot);
    applyBeatmapScoreboardLeaderboardSort(scoreboardRoot);
    syncBeatmapScoreboardHeaderSortUi(scoreboardRoot);
    syncBeatmapRateEditFilterBarVisibility(scoreboardRoot);
  }

  /**
   * React injects leaderboard rows after first paint (and re-injects on every mod change /
   * difficulty switch). Re-apply styling whenever actual scoreboard body rows are added.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardTableEnhancementsLive(pathRe) {
    let debounceTimer = 0;
    let refreshRunning = false;
    let pendingRefresh = false;
    const run = () => {
      debounceTimer = 0;
      if (!pathRe.test(location.pathname)) return;
      if (refreshRunning) {
        pendingRefresh = true;
        return;
      }
      refreshRunning = true;
      try {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      } finally {
        refreshRunning = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          schedule();
        }
      }
    };
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 32);
    };

    const containsScoreRow = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.classList.contains("beatmap-scoreboard-table__body-row"))
        return true;
      return node.querySelector(".beatmap-scoreboard-table__body-row") !== null;
    };

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (containsScoreRow(node)) {
            schedule();
            return;
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
    };
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {string} iso
   */
  function applyScoreboardTimeCell(td, refTd, iso) {
    if (!td || !iso) return;
    const timeEl = td.querySelector("time");
    const refTime = refTd?.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return;
    timeEl.setAttribute("datetime", iso);
    timeEl.textContent = formatScoreboardShortAgo(iso);
    if (refTime) {
      timeEl.className = refTime.className;
      timeEl.setAttribute("title", new Date(iso).toISOString());
    }
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} user
   * @param {string} ruleset
   */
  function applyScoreboardFlagCell(td, refTd, user, ruleset) {
    if (!td) return;
    const code = String(user?.country_code || "")
      .trim()
      .toUpperCase();
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (!(a instanceof HTMLAnchorElement)) return;
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (refA) a.className = refA.className;
    if (!code) {
      a.replaceChildren();
      a.removeAttribute("href");
      return;
    }
    a.href = `https://osu.ppy.sh/rankings/${encodeURIComponent(ruleset)}/performance?country=${encodeURIComponent(code)}`;

    // osu-web uses unicode-indicator SVGs for flags.
    // Example: `RU` -> `1f1f7-1f1fa.svg`.
    function toUnicodeFlagFilename(cc) {
      const c = String(cc || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) return null;
      const A = c.charCodeAt(0) - 65;
      const B = c.charCodeAt(1) - 65;
      const u1 = 0x1f1e6 + A;
      const u2 = 0x1f1e6 + B;
      return `${u1.toString(16)}-${u2.toString(16)}`;
    }

    const codeLower = code.toLowerCase();
    const refFlagSpan = refA?.querySelector?.("span.flag-country") ?? null;
    const useSpan = refFlagSpan instanceof HTMLSpanElement;

    const uni = toUnicodeFlagFilename(code);

    if (useSpan) {
      // Existing rows use `span.flag-country` + `background-image`.
      let span = a.querySelector("span.flag-country");
      if (!(span instanceof HTMLSpanElement)) {
        span = document.createElement("span");
      }
      span.className = refFlagSpan.className || span.className;
      if (uni) {
        span.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
      }
      span.title = user?.country?.name || code;
      a.replaceChildren(span);
      return;
    }

    // Fallback: use `<img>` if the template row doesn't use the span method.
    let img = a.querySelector("img");
    const refImg = refA?.querySelector("img") ?? null;
    if (!img) {
      img = document.createElement("img");
      if (refImg) img.className = refImg.className;
    } else if (refImg && !img.className) {
      img.className = refImg.className;
    }
    a.replaceChildren(img);

    if (uni) {
      img.src = `/assets/images/flags/${uni}.svg`;
    } else {
      // Fallback to osu! flag PNGs if the country code is invalid.
      let flagsFolder = "flags";
      const refSrc =
        refImg?.getAttribute("src") ||
        refImg?.getAttribute("data-src") ||
        refImg?.src ||
        "";
      const m =
        typeof refSrc === "string"
          ? refSrc.match(/assets\.ppy\.sh\/([^\/]+)\/[A-Za-z0-9]{1,3}\.png/i)
          : null;
      if (m?.[1]) flagsFolder = m[1];
      else if (typeof refSrc === "string") {
        if (/\/old-flags\//i.test(refSrc)) flagsFolder = "old-flags";
        else if (/\/flags\//i.test(refSrc)) flagsFolder = "flags";
      }
      img.src = `https://assets.ppy.sh/${flagsFolder}/${codeLower}.png`;
    }

    img.alt = code;
    img.title = user?.country?.name || code;

    // SVG flags should already have correct sizing in osu-web CSS; avoid
    // overriding unless we had to use PNG fallback.
    if (!uni) {
      img.style.maxWidth = "2.25em";
      img.style.maxHeight = "1.15em";
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.verticalAlign = "middle";
    }
  }

  /**
   * @param {string} acronym
   * @returns {string}
   */
  function modFullName(acronym) {
    const a = String(acronym || "")
      .trim()
      .toUpperCase();
    if (!a) return "";

    // Lazer mod names (used for hover tooltips).
    const map = {
      EZ: "Easy",
      NF: "No Fail",
      HT: "Half Time",
      DC: "Daycore",
      NR: "No Release",

      HR: "Hard Rock",
      SD: "Sudden Death",
      PF: "Perfect",
      DT: "Double Time",
      NC: "Nightcore",
      FI: "Fade In",
      HD: "Hidden",
      CO: "Cover",
      FL: "Flashlight",
      BL: "Blinds",
      ST: "Strict Tracking",
      AC: "Accuracy Challenge",

      AT: "Autoplay",
      CN: "Cinema",
      RX: "Relax",
      AP: "Autopilot",
      SO: "Spun Out",

      TP: "Target Practice",
      DA: "Difficulty Adjust",
      CL: "Classic",
      RD: "Random",
      MR: "Mirror",
      AL: "Alternate",
      SW: "Swap",
      SG: "Single Tap",
      IN: "Invert",
      CS: "Constant Speed",
      HO: "Hold Off",

      TR: "Transform",
      WG: "Wiggle",
      SI: "Spin In",
      GR: "Grow",
      DF: "Deflate",
      WU: "Wind Up",
      WD: "Wind Down",
      TC: "Traceable",
      BR: "Barrel Roll",
      AD: "Approach Different",
      FF: "Floating Fruits",
      MU: "Muted",
      NS: "No Scope",
      MG: "Magnetised",
      RP: "Repel",
      AS: "Adaptive Speed",
      FR: "Freeze Frame",
      BU: "Bubbles",
      SY: "Synesthesia",
      DP: "Depth",
      BM: "Bloom",

      SV2: "Score V2",
      TD: "Touch Device",
    };

    // Key mods are 1K..10K.
    if (/^[1-9]K$/.test(a) || /^10K$/.test(a)) {
      const n = Number(a.slice(0, -1));
      return `${n} Key Mod`;
    }

    return map[a] ?? a;
  }

  /**
   * @param {number} speedChange
   * @returns {string}
   */
  function formatScoreboardModSpeedRate(speedChange) {
    const x = Number(speedChange);
    if (!Number.isFinite(x) || x <= 0) return "";
    const rounded = Math.round(x * 100) / 100;
    let t = String(rounded);
    if (t.includes(".")) t = t.replace(/\.?0+$/, "");
    return `${t}×`;
  }

  const SCOREBOARD_MOD_DEFAULT_SPEED_UP = 1.5;
  const SCOREBOARD_MOD_DEFAULT_SPEED_DOWN = 0.75;
  const SCOREBOARD_MOD_SPEED_EPS = 0.005;

  /**
   * Show rate only when API sends `speed_change` and it differs from osu defaults
   * (1.5× DT/NC, 0.75× HT/DC).
   * @param {string} acronym
   * @param {number} speed
   * @returns {boolean}
   */
  function shouldShowScoreboardModSpeedIndicator(acronym, speed) {
    if (!Number.isFinite(speed) || speed <= 0) return false;
    const ac = String(acronym || "")
      .trim()
      .toUpperCase();
    if (ac === "HT" || ac === "DC") {
      return (
        Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_DOWN) >
        SCOREBOARD_MOD_SPEED_EPS
      );
    }
    if (ac === "DT" || ac === "NC") {
      return (
        Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
        SCOREBOARD_MOD_SPEED_EPS
      );
    }
    return (
      Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
      SCOREBOARD_MOD_SPEED_EPS
    );
  }

  /**
   * @param {unknown} mod  API mod object with optional `settings.speed_change`
   * @returns {number}  finite speed, or NaN if absent
   */
  function speedChangeFromScoreMod(mod) {
    if (mod == null || typeof mod !== "object") return NaN;
    const sc = /** @type {{ settings?: { speed_change?: unknown } }} */ (mod)
      .settings?.speed_change;
    const x = Number(sc);
    return Number.isFinite(x) && x > 0 ? x : NaN;
  }

  /**
   * Returns true when the score contains a mod whose speed_change differs from
   * that mod's default rate (1.50× for DT/NC, 0.75× for HT/DC, 1.00× otherwise).
   * @param {object} score
   * @returns {boolean}
   */
  function scoreHasNonstandardRate(score) {
    const mods = /** @type {unknown[]} */ (score?.mods ?? []);
    for (const m of mods) {
      const ac =
        typeof m === "string"
          ? m
          : /** @type {{ acronym?: unknown }} */ (m)?.acronym;
      const spd = speedChangeFromScoreMod(m);
      if (
        Number.isFinite(spd) &&
        shouldShowScoreboardModSpeedIndicator(String(ac ?? ""), spd)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} btn
   * @param {string} acronym
   * @param {{ speedChange?: number }|undefined} [opts]
   */
  function patchBeatmapScoreboardModButton(btn, acronym, opts) {
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    mi?.stripOepModAcronymFromClonedMod?.(btn);
    btn.removeAttribute("data-oep-mod-hidden");
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const full = modFullName(acronym);
    const icon = btn.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const modRoot =
      btn.querySelector?.(".mod") ??
      (icon instanceof HTMLElement ? icon.closest?.(".mod") : null) ??
      btn.closest?.(".mod") ??
      null;
    const typeClass =
      mi?.modTypeClassForAcronym?.(acronym) || "mod--type-Automation";
    // osu-web controls mod background color via CSS vars on the ancestor
    // element that has `mod--type-*` (the element that `icon.closest('.mod')`
    // finds, not necessarily `btn` itself).
    /** @type {HTMLElement[]} */
    const targets = [];
    const push = (el) => {
      if (el instanceof HTMLElement && !targets.includes(el)) targets.push(el);
    };
    push(btn);
    push(btn.closest?.(".mod") ?? null);
    push(icon instanceof HTMLElement ? icon.closest(".mod") : null);
    push(btn.querySelector?.(".mod") ?? null);

    for (const target of targets) {
      // Remove any existing mod tone classes.
      for (const cls of [...target.classList]) {
        if (/^mod--type-/i.test(cls)) target.classList.remove(cls);
      }
      target.classList.add(typeClass);
    }

    // Mirror `user-profile` patch: strip hover/extra UI remnants; re-add extender for custom rate.
    btn.querySelector(".mod__extender")?.remove();
    btn.querySelector(".mod__customised-indicator")?.remove();
    const sc = opts?.speedChange;
    const showRate =
      Number.isFinite(sc) && shouldShowScoreboardModSpeedIndicator(acronym, sc);
    const rateStr = showRate ? formatScoreboardModSpeedRate(sc) : "";
    const fullLabel = rateStr ? `${full} (${rateStr})` : full;
    const modInner =
      (btn.querySelector(".mod") instanceof HTMLElement
        ? btn.querySelector(".mod")
        : modRoot) ?? btn;
    if (rateStr && modInner instanceof HTMLElement) {
      const ext = document.createElement("div");
      ext.className = "mod__extender";
      const sp = document.createElement("span");
      sp.textContent = rateStr;
      ext.appendChild(sp);
      const iconEl = modInner.querySelector(".mod__icon");
      if (iconEl instanceof HTMLElement) {
        iconEl.insertAdjacentElement("afterend", ext);
      } else {
        modInner.appendChild(ext);
      }
    }
    btn.title = fullLabel;
    btn.setAttribute("aria-label", fullLabel);
    btn.setAttribute("data-original-title", fullLabel);
    btn.setAttribute("data-qtip", fullLabel);
    btn.setAttribute("data-tooltip", fullLabel);
    if (modRoot instanceof HTMLElement) {
      modRoot.title = fullLabel;
      // osu-web's tooltip is wired to the inner `.mod` element via `data-orig-title`.
      // (In the native DOM: `.mod` has `data-orig-title="Easy"` even when the button
      // wrapper has the correct `data-qtip`.)
      modRoot.setAttribute("data-orig-title", fullLabel);
    }
    if (icon instanceof HTMLElement) {
      icon.title = fullLabel;
      icon.setAttribute("aria-label", fullLabel);
      icon.setAttribute("data-original-title", fullLabel);
      icon.setAttribute("data-qtip", fullLabel);
      icon.setAttribute("data-tooltip", fullLabel);
    }

    // Prevent selection-actions (filtering) but allow hover/tooltips.
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    // Make it render as "enabled" so osu-web doesn't dim it when not hovered.
    btn.classList.add("beatmap-scoreboard-mod--enabled");
  }

  /**
   * @param {HTMLTableCellElement} td
   * @param {object} score
   * @param {HTMLElement|null} modTemplateBtn  from {@link resolveBeatmapScoreboardModTemplateEl}
   */
  function applyScoreboardModsCell(td, score, modTemplateBtn) {
    const wrap = td.querySelector(".beatmap-scoreboard-table__mods");
    if (!wrap) return;
    wrap.replaceChildren();
    const list = score.mods || [];
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    if (modTemplateBtn instanceof HTMLElement) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const btn = /** @type {HTMLElement} */ (modTemplateBtn.cloneNode(true));
        const spd = speedChangeFromScoreMod(m);
        patchBeatmapScoreboardModButton(
          btn,
          ac,
          Number.isFinite(spd) && shouldShowScoreboardModSpeedIndicator(ac, spd)
            ? { speedChange: spd }
            : undefined,
        );
        wrap.appendChild(btn);
      }
    } else if (list.length) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        const typeClass =
          mi?.modTypeClassForAcronym?.(ac) || "mod--type-Automation";
        let full = modFullName(ac);
        const spd = speedChangeFromScoreMod(m);
        const showRate =
          Number.isFinite(spd) &&
          shouldShowScoreboardModSpeedIndicator(ac, spd);
        const rateStr = showRate ? formatScoreboardModSpeedRate(spd) : "";
        if (rateStr) full = `${full} (${rateStr})`;
        const iconEl = el("div", {
          class: `mod__icon mod__icon--${safe}`,
          "data-acronym": ac,
          title: full,
          "aria-label": full,
          "data-original-title": full,
          "data-qtip": full,
          "data-tooltip": full,
        });
        const modInnerKids = [iconEl];
        if (rateStr) {
          modInnerKids.push(
            el("div", { class: "mod__extender" }, el("span", {}, rateStr)),
          );
        }
        const modEl = /** @type {HTMLElement} */ (
          el(
            "div",
            {
              class: `beatmap-scoreboard-mod mod ${typeClass} beatmap-scoreboard-mod--enabled`,
              title: full,
              "aria-label": full,
              "data-original-title": full,
              "data-qtip": full,
              "data-tooltip": full,
            },
            ...modInnerKids,
          )
        );
        modEl.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          true,
        );
        wrap.appendChild(modEl);
      }
    }
  }

  /**
   * Map `<thead><th>` modifiers to column indices (same order as `<tbody>` cells).
   * Heuristics alone mis-detect **score** when hit-stat columns contain large counts.
   * @param {HTMLTableRowElement} templateRow
   * @param {HTMLTableElement} table
   * @returns {{ rank: number|null, grade: number|null, score: number|null, pp: number|null, accuracy: number|null, flag: number|null, user: number|null, combo: number|null, mods: number|null, time: number|null, hitstatIndices: number[] }}
   */
  function buildBeatmapScoreboardColumnMap(templateRow, table) {
    const ths = [...table.querySelectorAll("thead th")];
    const idx = (mod) => {
      const suf = `__header--${mod}`;
      const th = ths.find((t) => [...t.classList].some((c) => c.endsWith(suf)));
      return th instanceof HTMLTableCellElement ? th.cellIndex : null;
    };

    /**
     * Try to infer the hitstat "label" (great/ok/meh/miss or 300/100/50/miss)
     * from whatever markup osu-web uses (text, aria-label, classes, etc).
     * @param {HTMLTableCellElement} th
     * @returns {string}
     */
    function inferHitstatLabelFromTh(th) {
      const textTrim = String(th.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const parts = [
        th.getAttribute("aria-label"),
        th.getAttribute("title"),
        th.textContent,
        th.className,
      ].filter((x) => typeof x === "string" && x.trim().length > 0);

      const raw = parts.join(" ").toLowerCase();
      if (!raw) return "";

      const hasWord = (w) =>
        new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(raw);

      // Prefer explicit words first (more stable than matching digits).
      if (hasWord("miss") || hasWord("m")) return "miss";
      if (hasWord("meh")) return "meh";
      // Mania columns (osu-web: PERFECT / GOOD).
      if (hasWord("perfect")) return "mania_perfect";
      if (hasWord("good")) return "mania_good";
      if (hasWord("katu") || hasWord("200")) return "katu";
      if (hasWord("ok")) return "ok";
      if (hasWord("geki") || hasWord("320") || hasWord("max")) return "geki";
      if (hasWord("great")) return "great";

      // CTB: terse headers "L" / "DRP" (large tick vs droplet); gate "L" to fruits only.
      const fruits = getBeatmapPageRuleset() === "fruits";
      if (fruits && /^l$/i.test(textTrim)) return "ctb_l";
      if (/^drp$/i.test(textTrim) || hasWord("drp")) return "ctb_drp";

      // Fall back to numeric digits if osu-web doesn't include words.
      if (/(^|[^0-9])300([^0-9]|$)/.test(raw)) return "300";
      if (/(^|[^0-9])100([^0-9]|$)/.test(raw)) return "100";
      if (/(^|[^0-9])50([^0-9]|$)/.test(raw)) return "50";

      return textTrim;
    }

    /** @type {number[]} */
    const hitstatIndices = [];
    /** @type {Record<number, string>} */
    const hitstatLabelsByIndex = {};
    ths.forEach((th, i) => {
      // osu-web uses `hitstat`-related header classes but the exact class
      // token isn't consistent across themes/skins, so match by substring.
      const isHitstat =
        [...th.classList].some(
          (c) => c === "hitstat" || c.includes("hitstat"),
        ) || th.className.includes("hitstat");
      if (isHitstat) {
        const cellIndex = th.cellIndex;
        hitstatIndices.push(cellIndex);
        hitstatLabelsByIndex[cellIndex] = inferHitstatLabelFromTh(th);
      }
    });

    /** @type {Record<string, number|null>} */
    const map = {
      rank: idx("rank"),
      grade: idx("grade"),
      score: idx("score"),
      accuracy: idx("accuracy"),
      flag: idx("flag"),
      user: idx("player"),
      combo: idx("maxcombo"),
      pp: idx("pp"),
      time: idx("time"),
      mods: idx("mods"),
    };

    if (map.rank == null) map.rank = 0;
    if (map.grade == null) map.grade = 1;

    const tds = [...templateRow.querySelectorAll("td")];
    if (map.user == null) {
      const i = tds.findIndex((td) =>
        td.querySelector?.(
          "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
        ),
      );
      if (i >= 0) map.user = i;
    }
    if (map.time == null) {
      const i = tds.findIndex((td) => td.querySelector?.("time"));
      if (i >= 0) map.time = i;
    }
    if (map.mods == null) {
      const i = tds.findIndex((td) =>
        td.querySelector?.(".beatmap-scoreboard-table__mods"),
      );
      if (i >= 0) map.mods = i;
    }

    return { ...map, hitstatIndices, hitstatLabelsByIndex };
  }

  /**
   * @param {string} labelRaw  from `<th>` (hit-stat short label)
   * @param {object|null|undefined} score  full API score (statistics + legacy fields)
   */
  function hitstatTextFromHeaderLabel(labelRaw, score) {
    const statsSource =
      score?.statistics && typeof score.statistics === "object"
        ? score.statistics
        : score && typeof score === "object"
          ? score
          : {};

    const pick = (...keys) => {
      for (const k of keys) {
        const v = statsSource?.[k];
        if (v != null && v !== "" && Number.isFinite(Number(v)))
          return String(v);
      }
      return "0";
    };

    const hasLazer =
      statsSource?.great != null ||
      statsSource?.perfect != null ||
      statsSource?.ok != null ||
      statsSource?.meh != null ||
      statsSource?.miss != null;

    const n300 = hasLazer
      ? Number(statsSource?.great ?? 0) + Number(statsSource?.perfect ?? 0)
      : statsSource?.count_300 != null
        ? Number(statsSource.count_300)
        : statsSource?.count300 != null
          ? Number(statsSource.count300)
          : Number(statsSource?.count_geki ?? statsSource?.countgeki ?? 0);
    const n100 = hasLazer
      ? Number(statsSource?.ok ?? 0)
      : Number(statsSource?.count_100 ?? statsSource?.count100 ?? 0);
    const n50 = hasLazer
      ? Number(statsSource?.meh ?? 0)
      : Number(statsSource?.count_50 ?? statsSource?.count50 ?? 0);
    const nMiss = hasLazer
      ? Number(statsSource?.miss ?? 0)
      : Number(statsSource?.count_miss ?? statsSource?.countmiss ?? 0);

    const lab = String(labelRaw).trim().toLowerCase();

    // osu standard: prefer exact numeric hit counts.
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return String(nMiss);

    if (lab === "mania_perfect")
      return pick("count_geki", "countgeki", "perfect", "great");
    if (lab === "mania_good")
      return pick("count_katu", "countkatu", "good", "great");

    if (
      lab === "ctb_l" ||
      (lab === "l" && getBeatmapPageRuleset() === "fruits")
    )
      return pick("large_tick_hit", "large_bonus");
    if (lab === "ctb_drp" || lab === "drp")
      return pick("small_tick_hit", "small_bonus");

    // Order matters: mania uses `320` and it contains `300`.
    if (lab === "geki" || lab === "max" || lab === "320")
      return pick("count_geki", "countgeki", "perfect", "great");

    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return String(n300);

    if (lab === "katu" || lab === "200")
      return pick("count_katu", "countkatu", "good", "great");

    if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok")
      return String(n100);

    if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") return String(n50);

    if (lab.includes("tick") || lab === "tail")
      return pick(
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
        "large_tick_miss",
      );

    return "0";
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardGradeCell(td, refTd, score) {
    if (!td) return;
    const r =
      typeof score.rank === "string"
        ? score.rank
        : score.rank &&
            typeof score.rank === "object" &&
            typeof score.rank.name === "string"
          ? score.rank.name
          : score.passed === false
            ? "F"
            : "D";
    // osu-web rank classes use the API rank casing (e.g. `XH`, `SH`, `F`).
    const rankKey = String(r).replace(/[^A-Za-z0-9]+/g, "") || "D";
    const link = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refLink = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (link && refLink) link.className = refLink.className;
    let div = td.querySelector("div.score-rank");
    if (!div && link) {
      div = document.createElement("div");
      link.replaceChildren(div);
    }
    if (div) {
      div.className = `score-rank score-rank--tiny score-rank--${rankKey}`;
    }
  }

  /**
   * @param {HTMLTableRowElement} tr
   * @param {object} score
   * @param {number} oneBasedRank
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @param {HTMLTableElement} table
   * @param {HTMLTableRowElement} templateRow
   * @param {HTMLElement|null} modTemplateBtn
   */
  function applyApiScoreToBeatmapScoreRow(
    tr,
    score,
    oneBasedRank,
    colMap,
    table,
    templateRow,
    modTemplateBtn,
    mapFullCombo,
  ) {
    tr.setAttribute(EXTENDED_SCORE_ROW_ATTR, "1");
    // Use real table cell indices (works with colspans and hidden columns).
    const tds = [...tr.cells];
    const uid = score.user?.id ?? score.user_id;
    const username = score.user?.username ?? String(uid);
    const userObj = score.user || { country_code: null, country: null };
    const iso = score.ended_at ?? score.created_at ?? "";
    const ruleset = getBeatmapPageRuleset();

    const rawScore = leaderboardTableScoreNumber(score);
    const scoreStr = Number(rawScore).toLocaleString("en-US");

    const ths = [...table.querySelectorAll("thead th")];

    if (colMap.rank != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.rank],
        scoreboardRefTd(templateRow, colMap.rank),
        `#${oneBasedRank}`,
      );
    }

    if (colMap.grade != null) {
      applyScoreboardGradeCell(
        tds[colMap.grade],
        scoreboardRefTd(templateRow, colMap.grade),
        score,
      );
    }

    if (colMap.score != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.score],
        scoreboardRefTd(templateRow, colMap.score),
        scoreStr,
      );
    }

    if (colMap.accuracy != null) {
      applyScoreboardAccuracyCell(
        tds[colMap.accuracy],
        scoreboardRefTd(templateRow, colMap.accuracy),
        score,
      );
    }

    if (colMap.flag != null) {
      applyScoreboardFlagCell(
        tds[colMap.flag],
        scoreboardRefTd(templateRow, colMap.flag),
        userObj,
        ruleset,
      );
    }

    if (colMap.user != null && tds[colMap.user]) {
      const td = tds[colMap.user];
      const userA =
        td.querySelector("a.beatmap-scoreboard-table__user-link") ||
        td.querySelector('a[href*="/users/"]');
      if (userA) {
        userA.href = `https://osu.ppy.sh/users/${uid}`;
        const label =
          userA.querySelector(".beatmap-scoreboard-table__user-link-text") ||
          userA;
        label.textContent = username;
      }
    }

    if (colMap.combo != null) {
      applyScoreboardComboCell(
        tds[colMap.combo],
        scoreboardRefTd(templateRow, colMap.combo),
        score,
        mapFullCombo,
      );
    }

    for (const i of colMap.hitstatIndices || []) {
      const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
      const refHit = scoreboardRefTd(templateRow, i);
      applyScoreboardTextCellLikeRef(
        tds[i],
        refHit,
        hitstatTextFromHeaderLabel(label, score),
      );
    }

    if (colMap.pp != null && tds[colMap.pp]) {
      applyScoreboardPpCell(
        tds[colMap.pp],
        scoreboardRefTd(templateRow, colMap.pp),
        score,
      );
    }

    if (colMap.time != null && tds[colMap.time] && iso) {
      applyScoreboardTimeCell(
        tds[colMap.time],
        scoreboardRefTd(templateRow, colMap.time),
        iso,
      );
    }

    if (colMap.mods != null && tds[colMap.mods]) {
      applyScoreboardModsCell(tds[colMap.mods], score, modTemplateBtn);
    }
  }

  function removeExtendedApiScoreRows() {
    document
      .querySelectorAll(`tr[${EXTENDED_SCORE_ROW_ATTR}]`)
      .forEach((r) => r.remove());
  }

  /**
   * Read currently enabled mod filters from the scoreboard filter strip.
   * Returns normalized acronyms (e.g. ["HR", "HD"]). "NM" is omitted.
   * @param {HTMLElement} scoreboardRoot
   * @returns {string[]}
   */
  function getActiveBeatmapScoreboardFilterMods(scoreboardRoot) {
    const seen = new Set();

    // Prefer explicit query params when present (osu-web may encode filter state there).
    try {
      const usp = new URLSearchParams(location.search || "");
      const q = [...usp.getAll("mods[]"), ...usp.getAll("mods")];
      for (const raw of q) {
        for (const part of String(raw).split(/[,\s+]+/)) {
          const ac = part.trim().toUpperCase();
          if (ac && ac !== "NM") seen.add(ac);
        }
      }
    } catch (_) {
      void 0;
    }

    const modsRoot = scoreboardRoot.querySelector(
      ".beatmapset-scoreboard__mods",
    );
    if (!(modsRoot instanceof HTMLElement)) return [...seen].sort();
    const enabled = modsRoot.querySelectorAll(
      ".beatmap-scoreboard-mod.beatmap-scoreboard-mod--enabled .mod__icon[data-acronym], .beatmap-scoreboard-mod[aria-pressed='true'] .mod__icon[data-acronym]",
    );
    for (const icon of enabled) {
      const ac = String(icon.getAttribute("data-acronym") || "")
        .trim()
        .toUpperCase();
      if (!ac || ac === "NM") continue;
      seen.add(ac);
    }
    return [...seen].sort();
  }

  function readBeatmapsetJson() {
    const script = qs("#json-beatmapset");
    const raw = script?.textContent?.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * @param {HTMLElement} header  `.beatmapset-header`
   * @returns {HTMLElement|null}
   */
  function findBeatmapsetFavouriteStatSpan(header) {
    const heart = header.querySelector(".beatmapset-header__value .fa-heart");
    return heart?.closest(".beatmapset-header__value") ?? null;
  }

  /**
   * Pink background on the header favourite square when favourited (`fas fa-heart`).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @returns {() => void}
   */
  function startBeatmapsetFavouriteButtonPinkIndicator(header) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    function findFavouriteButton() {
      return buttons.querySelector(
        "button.btn-osu-big--beatmapset-header-square",
      );
    }

    function sync() {
      const btn = findFavouriteButton();
      if (!btn) return;
      const heart = btn.querySelector(".fa-heart");
      const favourited = Boolean(heart?.classList.contains("fas"));
      btn.classList.toggle(BEATMAPSET_FAV_BTN_FAVOURITED_CLASS, favourited);
    }

    sync();

    const mo = new MutationObserver(sync);
    mo.observe(buttons, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mo.disconnect();
      findFavouriteButton()?.classList.remove(
        BEATMAPSET_FAV_BTN_FAVOURITED_CLASS,
      );
    };
  }

  /**
   * Destroy osu-web qtip on the favourite stat (only used when Expert+ replaces it with the API popover).
   * @param {HTMLElement|null} el
   */
  function destroyFavouriteStatQtip(el) {
    destroyOsuWebQtipIfBound(el);
  }

  /**
   * Hover popover on the favourite count (heart) with API `recent_favourites` (avatar + username).
   * Replaces osu! qtip; only used when OAuth client id/secret are set in Expert+ (see auth.isConfigured).
   * @param {HTMLElement} header
   * @param {string} beatmapsetId
   * @param {RegExp} pathRe
   * @param {number|undefined|null} favouriteCount
   * @returns {() => void}
   */
  function setupBeatmapsetFavouriteHoverPopover(
    header,
    beatmapsetId,
    pathRe,
    favouriteCount,
  ) {
    const fc = favouriteCount == null ? NaN : Number(favouriteCount);
    const skipApi = Number.isFinite(fc) && fc <= 0;

    const api = OsuExpertPlus.api;
    /** @type {Promise<object[]>|null} */
    let usersPromise = null;

    const popover = el("div", {
      class: `${ROOT_CLASS}__fav-popover`,
      role: "tooltip",
    });
    const titleEl = el(
      "div",
      { class: `${ROOT_CLASS}__fav-popover-title` },
      "Favourites",
    );
    const scrollEl = el("div", { class: `${ROOT_CLASS}__fav-popover-scroll` });
    popover.appendChild(titleEl);
    popover.appendChild(scrollEl);
    document.body.appendChild(popover);

    /** @param {object} u */
    function recentFavouriteChip(u) {
      const id = u?.id;
      const name = u?.username ?? (id != null ? String(id) : "?");
      if (id == null) {
        return el(
          "span",
          {
            class: `${ROOT_CLASS}__header-fav-chip ${ROOT_CLASS}__header-fav-chip--text`,
          },
          name,
        );
      }
      const rawUrl = u?.avatar_url;
      const avatarUrl =
        typeof rawUrl === "string" && rawUrl.trim()
          ? rawUrl.trim()
          : `https://a.ppy.sh/${id}`;
      const img = el("img", {
        class: `${ROOT_CLASS}__header-fav-avatar`,
        src: avatarUrl,
        alt: "",
        width: "24",
        height: "24",
        loading: "lazy",
        decoding: "async",
      });
      return el(
        "a",
        {
          class: `${ROOT_CLASS}__header-fav-chip`,
          href: `https://osu.ppy.sh/users/${id}`,
        },
        img,
        el("span", { class: `${ROOT_CLASS}__header-fav-name` }, name),
      );
    }

    function loadUsers() {
      if (skipApi) return Promise.resolve(/** @type {object[]} */ ([]));
      usersPromise ??= api
        .getBeatmapset(beatmapsetId, { include: ["recent_favourites"] })
        .then((set) =>
          Array.isArray(set?.recent_favourites) ? set.recent_favourites : [],
        )
        .catch((e) => {
          usersPromise = null;
          throw e;
        });
      return usersPromise;
    }

    function positionPopover(anchor) {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      popover.style.left = "0px";
      popover.style.top = "0px";
      popover.style.transform = "none";
      const pw = popover.offsetWidth;
      const ph = popover.offsetHeight;
      let left = r.right + margin;
      if (left + pw > window.innerWidth - margin)
        left = Math.max(margin, r.left - pw - margin);
      let top = r.top + r.height / 2 - ph / 2;
      top = Math.min(Math.max(margin, top), window.innerHeight - ph - margin);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }

    let showTimer = 0;
    let hideTimer = 0;
    let visible = false;
    /** @type {HTMLElement|null} */
    let boundSpan = null;

    function clearTimers() {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      showTimer = 0;
      hideTimer = 0;
    }

    function hidePopover() {
      clearTimers();
      visible = false;
      popover.classList.remove(`${ROOT_CLASS}__fav-popover--visible`);
      popover.setAttribute("aria-hidden", "true");
    }

    function containsFavOrPopover(node) {
      if (!(node instanceof Node)) return false;
      return (
        (!!boundSpan && boundSpan.contains(node)) || popover.contains(node)
      );
    }

    function scheduleHide() {
      clearTimers();
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        hidePopover();
      }, 350);
    }

    /** @param {HTMLElement} anchor */
    async function showPopover(anchor) {
      clearTimers();
      if (!pathRe.test(location.pathname) || !document.body.contains(header))
        return;
      destroyFavouriteStatQtip(anchor);
      visible = true;
      popover.setAttribute("aria-hidden", "false");
      scrollEl.replaceChildren(
        el(
          "span",
          { class: `${ROOT_CLASS}__header-favouriters-muted` },
          "Loading…",
        ),
      );
      popover.classList.add(`${ROOT_CLASS}__fav-popover--visible`);
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });

      if (skipApi) {
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "No favourites yet.",
          ),
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
        return;
      }

      try {
        const users = await loadUsers();
        if (!pathRe.test(location.pathname) || !visible) return;
        if (!Array.isArray(users) || users.length === 0) {
          scrollEl.replaceChildren(
            el(
              "span",
              { class: `${ROOT_CLASS}__header-favouriters-muted` },
              "No recent favourites to show.",
            ),
          );
        } else {
          scrollEl.replaceChildren();
          for (const u of users) {
            scrollEl.appendChild(recentFavouriteChip(u));
          }
        }
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      } catch {
        if (!visible) return;
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "Could not load favourites.",
          ),
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      }
    }

    /** @param {HTMLElement} anchor */
    function onSpanEnter(anchor) {
      destroyFavouriteStatQtip(anchor);
      clearTimers();
      showTimer = window.setTimeout(() => {
        showTimer = 0;
        void showPopover(anchor);
      }, 110);
    }

    /** @param {HTMLElement} anchor */
    function onSpanLeave(anchor, e) {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      clearTimers();
      scheduleHide();
    }

    /** @param {MouseEvent} e */
    function stopMouseoverBubble(e) {
      e.stopPropagation();
    }

    /** @param {HTMLElement} span */
    /** @type {AbortController|null} */
    let spanAbort = null;

    function bindSpan(span) {
      if (span === boundSpan) return;
      unbindSpan();
      boundSpan = span;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      span.addEventListener("mouseenter", () => onSpanEnter(span), opts);
      span.addEventListener("mouseleave", (e) => onSpanLeave(span, e), opts);
      span.addEventListener("mouseover", stopMouseoverBubble, opts);
      spanAbort = ac;
    }

    function unbindSpan() {
      spanAbort?.abort();
      spanAbort = null;
      if (boundSpan) destroyFavouriteStatQtip(boundSpan);
      boundSpan = null;
    }

    popover.addEventListener("mouseenter", () => {
      clearTimers();
    });
    popover.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      scheduleHide();
    });

    let moDebounce = 0;
    function scheduleTryBind() {
      if (moDebounce) window.clearTimeout(moDebounce);
      moDebounce = window.setTimeout(() => {
        moDebounce = 0;
        if (!document.body.contains(header)) return;
        const span = findBeatmapsetFavouriteStatSpan(header);
        if (span) bindSpan(span);
        else unbindSpan();
      }, 40);
    }

    const mo = new MutationObserver(() => scheduleTryBind());
    mo.observe(header, { childList: true, subtree: true });

    function onWinResize() {
      if (visible && boundSpan) positionPopover(boundSpan);
    }
    window.addEventListener("resize", onWinResize, { passive: true });

    scheduleTryBind();
    window.queueMicrotask(scheduleTryBind);

    return () => {
      if (moDebounce) window.clearTimeout(moDebounce);
      mo.disconnect();
      window.removeEventListener("resize", onWinResize);
      spanAbort?.abort();
      spanAbort = null;
      boundSpan = null;
      clearTimers();
      hidePopover();
      popover.remove();
    };
  }

  /**
   * @param {string|undefined|null} s
   */
  function displayText(s) {
    const t = s == null ? "" : String(s).trim();
    return t.length ? t : null;
  }

  /**
   * @param {string|undefined|null} tagsField
   */
  function parseTags(tagsField) {
    const raw = tagsField == null ? "" : String(tagsField).trim();
    if (!raw) return [];
    return raw.split(/\s+/).filter(Boolean);
  }

  /** Exact string from the beatmap payload (no trim). */
  function rawTagsFromData(tagsField) {
    if (tagsField == null) return "";
    return String(tagsField);
  }

  /**
   * HTML string for the beatmapset description (osu-web embeds rendered BBCode in
   * `description.description`).
   * @param {object|null} data
   * @returns {string|null}
   */
  function beatmapsetDescriptionHtmlFromData(data) {
    if (!data) return null;
    const d = data.description;
    if (d == null) return null;
    const html = typeof d === "string" ? d : d.description;
    if (html == null) return null;
    const s = String(html).trim();
    return s.length ? s : null;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {HTMLElement} toastEl
   */
  function flashCopiedToast(toastEl) {
    toastEl.classList.add(`${ROOT_CLASS}__copied-toast--show`);
    const prev = toastEl.getAttribute("data-oep-toast-timer");
    if (prev) window.clearTimeout(Number(prev));
    const id = window.setTimeout(() => {
      toastEl.classList.remove(`${ROOT_CLASS}__copied-toast--show`);
      toastEl.removeAttribute("data-oep-toast-timer");
    }, 1400);
    toastEl.setAttribute("data-oep-toast-timer", String(id));
  }

  /**
   * @param {typeof el} elFn
   * @param {HTMLElement} parent
   * @param {string} text
   * @param {string} ariaLabel
   */
  function appendCopyButton(elFn, parent, text, ariaLabel) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__copy-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      },
      "Copied",
    );
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__copy-btn`,
      "aria-label": ariaLabel,
      title: "Copy",
    });
    const icon = elFn("i", { class: "fas fa-copy", "aria-hidden": "true" });
    btn.appendChild(icon);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(text).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(btn);
    parent.appendChild(wrap);
  }

  /**
   * @param {typeof el} elFn
   * @param {string} tag
   */
  function buildTagChip(elFn, tag) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__tag-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      },
      "Copied",
    );
    const tagBtn = elFn(
      "button",
      {
        type: "button",
        class: `${ROOT_CLASS}__tag`,
        title: "Click to copy this tag",
        "aria-label": `Copy tag "${tag}"`,
      },
      tag,
    );
    tagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(tag).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(tagBtn);
    return wrap;
  }

  /**
   * @param {object|null} data
   * @param {typeof el} elFn
   */
  function buildModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid).",
      );
    }

    const frag = document.createDocumentFragment();

    const rows = [
      { label: "Title", value: displayText(data.title) },
      { label: "Title (Unicode)", value: displayText(data.title_unicode) },
      { label: "Artist", value: displayText(data.artist) },
      { label: "Artist (Unicode)", value: displayText(data.artist_unicode) },
      { label: "Source", value: displayText(data.source) },
    ];

    rows.forEach(({ label, value }) => {
      const row = elFn("div", { class: `${ROOT_CLASS}__row` });
      row.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, label));
      const valueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
      valueCell.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value${value ? "" : ` ${ROOT_CLASS}__value--muted`}`,
          },
          value || "—",
        ),
      );
      if (value) {
        appendCopyButton(elFn, valueCell, value, `Copy ${label} to clipboard`);
      }
      row.appendChild(valueCell);
      frag.appendChild(row);
    });

    const tagRow = elFn("div", { class: `${ROOT_CLASS}__row` });
    tagRow.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, "Tags"));
    const tagValueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
    const tags = parseTags(data.tags);
    const rawTags = rawTagsFromData(data.tags);
    if (tags.length) {
      const tagsWrap = elFn("div", { class: `${ROOT_CLASS}__tags` });
      tags.forEach((tag) => {
        tagsWrap.appendChild(buildTagChip(elFn, tag));
      });
      tagValueCell.appendChild(tagsWrap);
      if (rawTags.length > 0) {
        appendCopyButton(
          elFn,
          tagValueCell,
          rawTags,
          "Copy all tags (original string) to clipboard",
        );
      }
    } else {
      tagValueCell.appendChild(
        elFn(
          "p",
          { class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted` },
          "—",
        ),
      );
    }
    tagRow.appendChild(tagValueCell);
    frag.appendChild(tagRow);

    return frag;
  }

  /**
   * Bind spoiler toggles for BBCode rendered HTML.
   *
   * osu!web wires spoiler interactivity for descriptions already present in the DOM.
   * Our modal injects BBCode HTML dynamically, so those click handlers may not be attached.
   * This provides a lightweight fallback that toggles commonly-used spoiler structures.
   * @param {HTMLElement} root
   */
  function bindBbcodeSpoilers(root) {
    if (!root) return;

    // Target spoiler "content" nodes. We intentionally keep this broad because
    // class names can change across osu-web versions.
    const contentSel = [
      "[data-spoiler-content]",
      '[class*="spoiler" i][class*="content" i]',
      '[class*="spoiler" i][class*="body" i]',
      ".spoiler-content",
      ".spoiler__content",
      ".bbcode-spoiler__content",
      ".bbcode__spoiler-content",
    ].join(",");

    const contentEls = Array.from(root.querySelectorAll(contentSel));
    if (contentEls.length === 0) return;

    // Build a container->content map. We prefer a spoiler-ish ancestor above
    // the content node itself so trigger links/buttons can be discovered reliably.
    /** @type {Map<HTMLElement, HTMLElement[]>} */
    const containerToContents = new Map();
    for (const contentEl of contentEls) {
      let container = contentEl.closest('[class*="spoiler" i]');
      if (container === contentEl) {
        container =
          contentEl.parentElement?.closest('[class*="spoiler" i]') ??
          contentEl.parentElement;
      }
      if (!container) continue;
      const arr = containerToContents.get(container) ?? [];
      arr.push(contentEl);
      containerToContents.set(container, arr);
    }

    const triggerSel = [
      "summary",
      "button",
      '[role="button"]',
      "[data-spoiler-toggle]",
      '[class*="spoiler" i][class*="title" i]',
      '[class*="spoiler" i][class*="trigger" i]',
      '[class*="spoiler" i][class*="toggle" i]',
      '[class*="spoiler" i][class*="link" i]',
      ".spoiler-title",
      ".spoiler__title",
      ".spoiler-toggle",
      ".spoiler__toggle",
      ".bbcode-spoiler__title",
      ".bbcode__spoiler-title",
      ".bbcode-spoilerbox__link",
    ].join(",");

    const isOpenInitial = (el) => {
      // Some spoiler implementations collapse via `display: none`,
      // others use `max-height: 0` / `height: 0` (still `display: block`).
      // We treat the spoiler as "open" only if it looks render-visible.
      try {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const renderVisible =
          rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden";
        return cs.display !== "none" && renderVisible && cs.opacity !== "0";
      } catch {
        return !el.hidden;
      }
    };

    for (const [container, contents] of containerToContents.entries()) {
      if (!container || container.dataset.oepSpoilersBound === "1") continue;
      container.dataset.oepSpoilersBound = "1";

      for (const contentEl of contents) {
        if (contentEl.dataset.oepSpoilersPrevDisplay != null) continue;
        const inlineDisplay = contentEl.style.display;
        if (inlineDisplay) {
          contentEl.dataset.oepSpoilersPrevDisplay = inlineDisplay;
          continue;
        }
        try {
          const cs = window.getComputedStyle(contentEl);
          if (cs.display && cs.display !== "none")
            contentEl.dataset.oepSpoilersPrevDisplay = cs.display;
        } catch {
          // ignore
        }
      }

      const initiallyOpen = contents.some((c) => isOpenInitial(c));
      container.dataset.oepSpoilersOpen = initiallyOpen ? "1" : "0";

      const triggerEls = Array.from(container.querySelectorAll(triggerSel))
        // Avoid treating the content nodes themselves as triggers.
        .filter((n) => !contents.includes(n));

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nextOpen = container.dataset.oepSpoilersOpen !== "1";
        container.dataset.oepSpoilersOpen = nextOpen ? "1" : "0";

        for (const contentEl of contents) {
          if (nextOpen) {
            contentEl.hidden = false;
            const prev = contentEl.dataset.oepSpoilersPrevDisplay;
            contentEl.style.display = prev && prev !== "none" ? prev : "block";
          } else {
            contentEl.hidden = true;
            contentEl.style.display = "none";
          }
        }
      };

      // If we can't find a likely trigger element, fall back to clicking the container header.
      // (This keeps behavior closer to expectations than doing nothing.)
      if (triggerEls.length) {
        for (const t of triggerEls) t.addEventListener("click", handler);
      } else {
        container.addEventListener("click", (e) => {
          // Only toggle when clicking within the container but not inside a content node.
          const target = /** @type {HTMLElement} */ (e.target);
          if (!target) return;
          if (contents.some((c) => c.contains(target))) return;
          handler(e);
        });
      }

      // Some osu-web spoiler headers are anchors with href="#".
      // Ensure they never trigger page scroll/jump in the modal.
      container.addEventListener("click", (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target) return;
        const anchor = target.closest("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (href === "#") {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  /**
   * @param {object|null} data
   * @param {typeof el} elFn
   */
  function buildDescriptionModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid).",
      );
    }

    const html = beatmapsetDescriptionHtmlFromData(data);
    const wrap = elFn("div", {});

    if (!html) {
      wrap.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted`,
          },
          "No description.",
        ),
      );
      return wrap;
    }

    const toolbar = elFn("div", {
      class: `${ROOT_CLASS}__description-toolbar`,
    });
    const prose = elFn("div", { class: `${ROOT_CLASS}__description-prose` });
    prose.innerHTML = html;
    // Bind spoiler click/toggle behavior for the dynamically-injected BBCode.
    bindBbcodeSpoilers(prose);
    const plainForCopy = prose.innerText.replace(/\s+$/g, "").trim();
    appendCopyButton(
      elFn,
      toolbar,
      plainForCopy.length ? plainForCopy : html.replace(/<[^>]+>/g, " ").trim(),
      "Copy description to clipboard",
    );
    wrap.appendChild(toolbar);
    wrap.appendChild(prose);
    return wrap;
  }

  const DESCRIPTION_BG_SELECTORS = [
    ".beatmapset-description",
    ".beatmapset__description",
    ".beatmapset-info__description",
    ".bbcode--beatmap-description",
    ".bbcode",
  ];

  function resolveDescriptionSectionBackgroundColor() {
    for (const selector of DESCRIPTION_BG_SELECTORS) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const bg = getComputedStyle(node).backgroundColor;
      if (!bg) continue;
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") continue;
      return bg;
    }
    return "hsl(var(--hsl-b4, 333 18% 18%))";
  }

  /**
   * Modal header control: GET `https://osu.ppy.sh/osu/{beatmapId}` for the selected difficulty and show the file in a new tab.
   * @param {typeof el} elFn
   * @param {() => string|null} getBeatmapId
   */
  function buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapId) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__modal-header-osu-wrap` });
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__modal-header-osu-btn`,
      "aria-label": "Open .osu file for current difficulty",
    });
    btn.appendChild(
      elFn("i", { class: "fas fa-file-code", "aria-hidden": "true" }),
    );
    btn.appendChild(document.createTextNode("open .osu"));
    const msgEl = elFn("p", {
      class: `${ROOT_CLASS}__modal-header-osu-msg`,
      "aria-live": "polite",
    });
    wrap.appendChild(btn);
    wrap.appendChild(msgEl);

    let msgResetTimer = 0;
    /**
     * @param {string} msg
     */
    function flashMsg(msg) {
      msgEl.textContent = msg;
      if (msgResetTimer) window.clearTimeout(msgResetTimer);
      msgResetTimer = window.setTimeout(() => {
        msgEl.textContent = "";
        msgResetTimer = 0;
      }, 3200);
    }
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = getBeatmapId();
      if (!id) {
        flashMsg("Could not detect a beatmap id for this page.");
        return;
      }
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const url = `https://osu.ppy.sh/osu/${encodeURIComponent(id)}`;
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) {
          flashMsg(`Could not load .osu (HTTP ${resp.status}).`);
          return;
        }
        const text = await resp.text();
        const blob = new Blob([text], {
          type: "text/plain;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          flashMsg("Popup blocked — allow popups for osu.ppy.sh to view .osu.");
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      } catch (_) {
        flashMsg("Could not load .osu (network error).");
      } finally {
        btn.disabled = false;
      }
    });
    return wrap;
  }

  /**
   * @param {typeof el} elFn
   * @param {string} rootClass
   * @param {object} cfg
   * @param {string} cfg.title
   * @param {string} cfg.titleId
   * @param {string} cfg.buttonText
   * @param {(btn: HTMLButtonElement) => void} cfg.mountButton
   * @param {string} [cfg.buttonIconClass] Font Awesome classes for leading icon (e.g. `fas fa-tags`)
   * @param {boolean} [cfg.primary]
   * @param {string} [cfg.modalExtraClass]
   * @param {string} [cfg.buttonExtraClass] Extra classes on the open button (e.g. compact placement)
   * @param {(elFn: typeof el) => Node|null|undefined} [cfg.buildModalTitleExtra] Shown after the modal title (left header group)
   * @param {() => Node} cfg.buildBody
   */
  function attachBeatmapsetInfoModal(elFn, rootClass, cfg) {
    const {
      title,
      titleId,
      buttonText,
      buttonIconClass = "",
      primary = false,
      modalExtraClass = "",
      buildBody,
      buildModalTitleExtra,
      mountButton,
      buttonExtraClass = "",
    } = cfg;

    const btnClass = `${rootClass}__action-btn${
      primary ? ` ${rootClass}__action-btn--primary` : ""
    }${buttonExtraClass ? ` ${buttonExtraClass}` : ""}`;
    const openBtn = buttonIconClass
      ? elFn(
          "button",
          { type: "button", class: btnClass },
          elFn("i", {
            class: buttonIconClass,
            "aria-hidden": "true",
          }),
          buttonText,
        )
      : elFn("button", { type: "button", class: btnClass }, buttonText);
    mountButton(openBtn);

    const modalPortal = elFn("div", {
      class: `${rootClass}__modal-portal`,
      "aria-hidden": "true",
    });
    const backdrop = elFn("div", { class: `${rootClass}__modal-backdrop` });
    const modal = elFn("div", {
      class: `${rootClass}__modal${
        modalExtraClass ? ` ${modalExtraClass}` : ""
      }`,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    });
    modal.style.background = resolveDescriptionSectionBackgroundColor();
    const modalHeader = elFn("div", { class: `${rootClass}__modal-header` });
    const headerStart = elFn("div", {
      class: `${rootClass}__modal-header-start`,
    });
    headerStart.appendChild(
      elFn("h2", { class: `${rootClass}__modal-title`, id: titleId }, title),
    );
    if (typeof buildModalTitleExtra === "function") {
      const extra = buildModalTitleExtra(elFn);
      if (extra) headerStart.appendChild(extra);
    }
    modalHeader.appendChild(headerStart);
    const closeBtn = elFn(
      "button",
      {
        type: "button",
        class: `${rootClass}__modal-close`,
        "aria-label": "Close",
      },
      "×",
    );
    modalHeader.appendChild(closeBtn);
    modal.appendChild(modalHeader);

    const modalBody = elFn("div", {
      class: `${rootClass}__modal-body u-fancy-scrollbar`,
    });
    modalBody.appendChild(buildBody());
    modal.appendChild(modalBody);

    modalPortal.appendChild(backdrop);
    modalPortal.appendChild(modal);
    document.body.appendChild(modalPortal);

    /** @type {AbortController|null} */
    let modalAbort = null;

    function closeModal() {
      modalPortal.classList.remove(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "true");
      modalAbort?.abort();
      modalAbort = null;
      openBtn.focus();
    }

    function openModal() {
      if (modalPortal.classList.contains(`${rootClass}__modal-portal--open`)) {
        closeBtn.focus();
        return;
      }
      modalAbort?.abort();
      modalAbort = new AbortController();
      const { signal } = modalAbort;

      modalPortal.classList.add(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "false");
      closeBtn.focus();

      const onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
        }
      };
      document.addEventListener("keydown", onKeydown, {
        signal,
        capture: true,
      });

      backdrop.addEventListener(
        "click",
        () => {
          closeModal();
        },
        { signal },
      );
    }

    openBtn.addEventListener("click", () => {
      openModal();
    });
    closeBtn.addEventListener("click", () => {
      closeModal();
    });

    modal.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    return {
      dispose() {
        modalAbort?.abort();
        modalAbort = null;
        modalPortal.remove();
        openBtn.remove();
      },
    };
  }

  function teardownBeatmapDescriptionHeadingLayout(descRow) {
    if (!(descRow instanceof HTMLElement)) return;
    descRow.classList.remove(`${ROOT_CLASS}__description-heading-row`);
    const headWrap = descRow.querySelector(
      `:scope > .${ROOT_CLASS}__description-sticky-head`,
    );
    if (headWrap) {
      const h = headWrap.querySelector(":scope > h3.beatmapset-info__header");
      if (h) descRow.insertBefore(h, headWrap);
      headWrap.remove();
    }
  }

  /**
   * osu!direct / supporter “direct” entry in `.beatmapset-header__buttons`.
   * @param {HTMLElement} buttonsEl
   * @returns {HTMLAnchorElement|null}
   */
  function findBeatmapsetOsuDirectButton(buttonsEl) {
    const links = qsa("a.btn-osu-big", buttonsEl);
    return (
      links.find((a) => {
        const h = a.getAttribute("href") || "";
        return h.startsWith("osu://") || /support-the-game/i.test(h);
      }) ?? null
    );
  }

  /**
   * @param {unknown} n
   * @returns {string|null}  e.g. "#4,212"
   */
  function formatOmdbRankDisplay(n) {
    if (n == null || n === "") return null;
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return `#${x.toLocaleString()}`;
  }

  const OMDB_CHART_PAGE_SIZE = 50;

  /**
   * Charts list ~50 mapsets per page; `p` is 1-based.
   * @param {unknown} rank  1-based chart position
   * @returns {number}
   */
  function omdbChartPageFromRank(rank) {
    const n = Number(rank);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.ceil(n / OMDB_CHART_PAGE_SIZE);
  }

  /**
   * Ranked calendar year for OMDB year-chart links: `ranked_date` from #json-beatmapset first,
   * else a `time.js-tooltip-time` row under `.beatmapset-mapping` whose text includes
   * ranked / qualified / approved (matches osu-web’s BeatmapsetMapping date lines).
   * @param {HTMLElement|null} header  `.beatmapset-header` (optional; narrows `.beatmapset-mapping` query)
   * @returns {number|null}
   */
  function getBeatmapsetRankedCalendarYear(header) {
    const data = readBeatmapsetJson();
    const rankedIso = data?.ranked_date;
    if (rankedIso != null && String(rankedIso).trim() !== "") {
      const y = new Date(String(rankedIso)).getUTCFullYear();
      if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
    }

    const scope =
      (header instanceof HTMLElement
        ? header.querySelector(".beatmapset-mapping")
        : null) ??
      document.querySelector(".beatmapset-mapping") ??
      (header instanceof HTMLElement ? header : null) ??
      document.querySelector(".beatmapset-header");

    if (!(scope instanceof HTMLElement)) return null;

    const times = scope.querySelectorAll("time.js-tooltip-time[datetime]");
    for (const t of times) {
      if (!(t instanceof HTMLTimeElement)) continue;
      const dt = t.getAttribute("datetime");
      if (!dt) continue;
      let walk = t.parentElement;
      while (walk && scope.contains(walk)) {
        const txt = walk.textContent || "";
        if (
          /\branked\b/i.test(txt) ||
          /\bqualified\b/i.test(txt) ||
          /\bapproved\b/i.test(txt)
        ) {
          const y = new Date(dt).getUTCFullYear();
          if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
          break;
        }
        walk = walk.parentElement;
      }
    }
    return null;
  }

  /**
   * Year rank label + chart link use ranked calendar year when known.
   * When both chart ranks are null, still shows `{year} -, overall -`.
   * @param {object} entry
   * @param {number|null} rankedYear
   * @returns {HTMLElement}
   */
  function buildOmdbRanksBlock(entry, rankedYear) {
    const overallHash = formatOmdbRankDisplay(entry.ChartRank);
    const yearHash = formatOmdbRankDisplay(entry.ChartYearRank);
    if (!overallHash && !yearHash) {
      const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
      );
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
      );
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
      );
      return wrap;
    }

    const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
    if (yearHash) {
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
      );
      wrap.appendChild(document.createTextNode(" "));
      if (rankedYear != null) {
        const yearPage = omdbChartPageFromRank(entry.ChartYearRank);
        wrap.appendChild(
          el(
            "a",
            {
              class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
              href: `https://omdb.nyahh.net/charts/?y=${encodeURIComponent(String(rankedYear))}&p=${yearPage}`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            yearHash,
          ),
        );
      } else {
        wrap.appendChild(
          el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, yearHash),
        );
      }
    }
    if (yearHash && overallHash) {
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
      );
    }
    if (overallHash) {
      const overallPage = omdbChartPageFromRank(entry.ChartRank);
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el(
          "a",
          {
            class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
            href: `https://omdb.nyahh.net/charts/?y=all-time&p=${overallPage}`,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          overallHash,
        ),
      );
    }
    return wrap;
  }

  /**
   * Full ladder 0★ … 5★ in 0.5 steps; missing API keys count as 0.
   * @param {object|undefined} entry
   * @returns {{ score: number, count: number }[]}
   */
  function buildOmdbDistributionRows(entry) {
    if (entry == null) return [];
    /** @type {Map<number, number>} */
    const byScore = new Map();
    const raw = entry.Ratings;
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const score = Number(k);
        const count = Number(v);
        if (!Number.isFinite(score) || !Number.isFinite(count)) continue;
        const key = Math.round(score * 2) / 2;
        if (key < 0 || key > 5) continue;
        byScore.set(key, (byScore.get(key) ?? 0) + count);
      }
    }
    const rows = [];
    for (let i = 0; i <= 10; i++) {
      const score = i * 0.5;
      rows.push({ score, count: byScore.get(score) ?? 0 });
    }
    return rows;
  }

  /**
   * @param {number} score
   */
  function formatOmdbDistScoreLabel(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return String(score);
    const h = Math.round(n * 2) / 2;
    return Number.isInteger(h) ? String(h) : h.toFixed(1);
  }

  /**
   * @param {HTMLElement} popEl
   * @param {{ score: number, count: number }[]} rows
   */
  function fillOmdbDistPopover(popEl, rows) {
    popEl.replaceChildren();
    popEl.appendChild(
      el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-head` }, "Distribution"),
    );
    const maxC = Math.max(1, ...rows.map((r) => r.count));
    for (const { score, count } of rows) {
      const row = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-row` });
      row.appendChild(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__dist-score` },
          `${formatOmdbDistScoreLabel(score)}★`,
        ),
      );
      const track = el("div", {
        class: `${OEP_OMDB_ROW_CLASS}__dist-bar-track`,
      });
      const bar = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-bar` });
      const pct = count <= 0 ? 0 : Math.max(8, (count / maxC) * 100);
      bar.style.width = `${pct}%`;
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__dist-count` },
          String(count),
        ),
      );
      popEl.appendChild(row);
    }
  }

  /**
   * @param {HTMLElement} bodyEl
   * @param {object|undefined} entry
   * @param {{ bindTrigger: (trigger: HTMLElement, rows: { score: number, count: number }[]) => void }|null} [distUi]
   * @param {HTMLElement|null} [header]  `.beatmapset-header` for ranked year from DOM
   * @param {boolean} [difficultyBlacklistedOnOmdb]  Successful set JSON but this beatmap omitted (OMDB blacklist)
   */
  function renderOmdbRatingRowBody(
    bodyEl,
    entry,
    distUi,
    header,
    difficultyBlacklistedOnOmdb,
  ) {
    bodyEl.classList.remove(
      `${OEP_OMDB_ROW_CLASS}__body--muted`,
      `${OEP_OMDB_ROW_CLASS}__body--error`,
    );
    if (difficultyBlacklistedOnOmdb) {
      bodyEl.textContent = "This difficulty is blacklisted on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    if (entry == null) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    const avgN = Number(entry.WeightedAvg);
    const cntN = Number(entry.RatingCount);
    const hasAvg = Number.isFinite(avgN);
    const hasCnt = Number.isFinite(cntN) && cntN > 0;
    const rankedYear = getBeatmapsetRankedCalendarYear(
      header instanceof HTMLElement ? header : null,
    );
    const ranksEl = buildOmdbRanksBlock(entry, rankedYear);
    const distRows = buildOmdbDistributionRows(entry);
    const useDistPopover =
      Boolean(distUi) && distRows.length > 0 && (hasAvg || hasCnt);

    const frag = document.createDocumentFragment();
    let first = true;
    /**
     * @param {Node} node
     */
    function appendChunk(node) {
      if (!first) frag.appendChild(document.createTextNode(" · "));
      first = false;
      frag.appendChild(node);
    }

    if (hasAvg || hasCnt) {
      const statParts = [];
      if (hasAvg) statParts.push(`${avgN.toFixed(2)} avg`);
      if (hasCnt) {
        statParts.push(`${cntN} rating${cntN === 1 ? "" : "s"}`);
      }
      const statText = statParts.join(" · ");
      if (useDistPopover && distUi) {
        const anchor = el("span", {
          class: `${OEP_OMDB_ROW_CLASS}__dist-anchor`,
        });
        const trigger = el(
          "span",
          {
            class: `${OEP_OMDB_ROW_CLASS}__dist-trigger`,
            tabindex: "0",
            title: "Rating breakdown",
          },
          statText,
        );
        anchor.appendChild(trigger);
        distUi.bindTrigger(trigger, distRows);
        appendChunk(anchor);
      } else {
        appendChunk(document.createTextNode(statText));
      }
    }
    if (ranksEl) appendChunk(ranksEl);

    if (first) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    bodyEl.replaceChildren(frag);
  }

  /**
   * @param {object|undefined} entry
   * @returns {number|null}
   */
  function parseOmdbOwnRating(entry) {
    const own = entry?.OwnRating;
    if (own == null || String(own).trim() === "") return null;
    const n = Number(own);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 2) / 2;
  }

  /**
   * @param {HTMLElement[]} units
   * @param {number|null|undefined} score
   */
  function paintOmdbStarUnits(units, score) {
    const s =
      score == null || !Number.isFinite(Number(score))
        ? null
        : Math.round(Number(score) * 2) / 2;
    for (let i = 0; i < 5; i++) {
      const u = units[i];
      const full = i + 1;
      const half = i + 0.5;
      u.classList.remove(
        `${OEP_OMDB_VOTE_CLASS}__unit--full`,
        `${OEP_OMDB_VOTE_CLASS}__unit--half`,
        `${OEP_OMDB_VOTE_CLASS}__unit--empty`,
      );
      if (s == null || s < half) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--empty`);
      } else if (s >= full) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--full`);
      } else {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--half`);
      }
    }
  }

  /**
   * @param {HTMLAnchorElement} anchor
   * @returns {number|null}
   */
  function parseBeatmapIdFromPickerLink(anchor) {
    const href = anchor.getAttribute("href");
    if (!href) return null;
    const m = href.match(/#([a-z]+)\/(\d+)\s*$/i);
    return m ? Number(m[2]) : null;
  }

  /**
   * @param {number} n
   * @returns {string}
   */
  function formatBeatmapsetHeaderStarRatingText(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    const floored = Math.floor(v * 100) / 100;
    return floored.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * @param {number|null|undefined} beatmapId
   * @returns {{ version: string, rating: number|null }}
   */
  function getBeatmapVersionAndRatingForHeader(beatmapId) {
    const data = readBeatmapsetJson();
    if (!data?.beatmaps?.length) return { version: "", rating: null };
    const n = Number(beatmapId);
    if (!Number.isFinite(n)) return { version: "", rating: null };
    const bm = data.beatmaps.find((b) => Number(b.id) === n);
    if (!bm) return { version: "", rating: null };
    const version =
      bm.version != null && String(bm.version).trim() !== ""
        ? String(bm.version)
        : "";
    const x = Number(bm.difficulty_rating);
    const rating = Number.isFinite(x) ? x : null;
    return { version, rating };
  }

  /**
   * Guest credit in the header (osu `hasGuestOwners`): some `owners[].id` differs from
   * the beatmapset host `user_id`. Uses the same owner list osu shows in
   * `.beatmapset-header__diff-extra`.
   * @param {number|null|undefined} beatmapId
   * @returns {{ show: boolean, owners: Array<{ id: number, username: string }> }}
   */
  function getBeatmapGuestMapperOwnersForHeader(beatmapId) {
    const data = readBeatmapsetJson();
    const empty = {
      show: false,
      owners: /** @type {Array<{ id: number, username: string }>} */ ([]),
    };
    if (!data?.beatmaps?.length) return empty;
    const n = Number(beatmapId);
    if (!Number.isFinite(n)) return empty;
    const bm = data.beatmaps.find((b) => Number(b.id) === n);
    if (!bm || !Array.isArray(bm.owners) || !bm.owners.length) return empty;
    const setUid = Number(data.user_id);
    if (!Number.isFinite(setUid)) return empty;
    const hasGuest = bm.owners.some((o) => Number(o?.id) !== setUid);
    if (!hasGuest) return empty;
    const owners = bm.owners.map((o) => ({
      id: Number(o.id),
      username: o.username != null ? String(o.username) : "",
    }));
    return { show: true, owners };
  }

  /**
   * Selected difficulty only: name + nomod SR inside
   * `a.beatmapset-beatmap-picker__beatmap--active` (same bordered cell as the icon).
   * Hides `.beatmapset-header__diff-name`; guest “mapped by …” is duplicated here from JSON when applicable.
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapHeaderDiffBesidePicker(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    let disposed = false;
    let raf = 0;
    /** Avoid guest-row DOM churn (stops MutationObserver ↔ sync loops + osu usercard re-init). */
    let lastGuestStableKey = "";

    /**
     * osu-web may omit `--active` when there is only one difficulty in some states.
     * @returns {HTMLAnchorElement|null}
     */
    function getActivePickerAnchor() {
      const active = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      if (active instanceof HTMLAnchorElement) return active;
      const only = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap:only-child",
      );
      return only instanceof HTMLAnchorElement ? only : null;
    }

    function getSelectedBeatmapId() {
      const a = getActivePickerAnchor();
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      if (m) return Number(m[1]);
      const s = getBeatmapPageBeatmapId();
      return s != null ? Number(s) : null;
    }

    /** @type {Text|null} */
    let ratingTextNode = null;

    function removeLegacySiblingStrip() {
      for (const dead of header.querySelectorAll(
        ".oep-header-diff-beside-picker",
      )) {
        dead.remove();
      }
    }

    function stripInjectedMetaFromPicker() {
      for (const node of picker.querySelectorAll(
        `[${DIFF_BESIDE_PICKER_ATTR}="1"]`,
      )) {
        node.remove();
      }
    }

    /**
     * @returns {HTMLElement|null}
     */
    function ensureAttached() {
      if (disposed || !pathRe.test(location.pathname)) return null;
      removeLegacySiblingStrip();

      const active = getActivePickerAnchor();
      for (const node of picker.querySelectorAll(
        `[${DIFF_BESIDE_PICKER_ATTR}="1"]`,
      )) {
        const host = node.closest("a.beatmapset-beatmap-picker__beatmap");
        if (host !== active) node.remove();
      }

      if (!(active instanceof HTMLAnchorElement)) {
        header.classList.remove("oep-diff-beside-picker");
        return null;
      }

      header.classList.add("oep-diff-beside-picker");

      let meta = active.querySelector(`[${DIFF_BESIDE_PICKER_ATTR}="1"]`);
      if (
        meta instanceof HTMLElement &&
        !meta.querySelector(".oep-picker-active-meta__title-row")
      ) {
        meta.remove();
        meta = null;
      }
      if (!(meta instanceof HTMLElement)) {
        const starSpan = el(
          "span",
          {
            class: "oep-picker-active-meta__star",
            title: "Star rating",
          },
          el("i", { class: "fas fa-star", "aria-hidden": "true" }),
          "",
        );
        const icon = starSpan.querySelector(".fa-star");
        const tn = icon?.nextSibling;
        ratingTextNode = tn instanceof Text ? tn : null;
        const titleRow = el(
          "span",
          { class: "oep-picker-active-meta__title-row" },
          el("span", { class: "oep-picker-active-meta__version" }),
          el("span", {
            class:
              "beatmapset-header__diff-extra oep-picker-active-meta__guest",
          }),
        );
        meta = el(
          "span",
          {
            class: "oep-picker-active-meta",
            [DIFF_BESIDE_PICKER_ATTR]: "1",
          },
          titleRow,
          starSpan,
        );
        active.appendChild(meta);
      } else {
        const starSpan = meta.querySelector(".oep-picker-active-meta__star");
        const icon = starSpan?.querySelector(".fa-star");
        const tn = icon?.nextSibling;
        ratingTextNode = tn instanceof Text ? tn : null;
      }
      return meta;
    }

    function syncContent() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const active = getActivePickerAnchor();
      if (!(active instanceof HTMLAnchorElement)) {
        stripInjectedMetaFromPicker();
        header.classList.remove("oep-diff-beside-picker");
        lastGuestStableKey = "";
        ratingTextNode = null;
        return;
      }

      const meta = ensureAttached();
      if (!meta || !ratingTextNode) return;

      const beatmapIcon = active.querySelector(".beatmap-icon");
      if (beatmapIcon instanceof HTMLElement) {
        const diffVar =
          beatmapIcon.style.getPropertyValue("--diff") ||
          getComputedStyle(beatmapIcon).getPropertyValue("--diff");
        const trimmed = diffVar?.trim() ?? "";
        const current = active.style.getPropertyValue("--diff");
        if (trimmed && current !== trimmed) {
          active.style.setProperty("--diff", trimmed);
        } else if (!trimmed && current) {
          active.style.removeProperty("--diff");
        }
      } else if (active.style.getPropertyValue("--diff")) {
        active.style.removeProperty("--diff");
      }

      const verEl = meta.querySelector(".oep-picker-active-meta__version");
      const guestEl = meta.querySelector(".oep-picker-active-meta__guest");
      const titleRow = meta.querySelector(".oep-picker-active-meta__title-row");
      if (!(verEl instanceof HTMLElement) || !(guestEl instanceof HTMLElement))
        return;

      const id = getSelectedBeatmapId();
      const { version, rating } =
        id != null
          ? getBeatmapVersionAndRatingForHeader(id)
          : { version: "", rating: null };
      const { show: showGuest, owners: guestOwners } =
        id != null
          ? getBeatmapGuestMapperOwnersForHeader(id)
          : { show: false, owners: [] };

      const hasVer = Boolean(version);
      if (verEl.textContent !== version) verEl.textContent = version;
      if (hasVer) {
        verEl.setAttribute("title", version);
      } else {
        verEl.removeAttribute("title");
      }
      const verDisplay = hasVer ? "" : "none";
      if (verEl.style.display !== verDisplay) verEl.style.display = verDisplay;

      const expectGuestNodes = Boolean(showGuest && guestOwners.length);
      const guestStableKey = `${id ?? ""}|${
        expectGuestNodes
          ? guestOwners.map((o) => `${o.id}:${o.username}`).join(",")
          : ""
      }`;
      const shouldRebuildGuest =
        guestStableKey !== lastGuestStableKey ||
        (expectGuestNodes && guestEl.childNodes.length === 0) ||
        (!expectGuestNodes && guestEl.childNodes.length > 0);

      if (shouldRebuildGuest) {
        lastGuestStableKey = guestStableKey;
        guestEl.replaceChildren();
        if (showGuest && guestOwners.length) {
          if (guestEl.style.display !== "") guestEl.style.display = "";
          guestEl.append(document.createTextNode("mapped by "));
          guestOwners.forEach((o, i) => {
            if (i > 0) guestEl.append(document.createTextNode(", "));
            const uid = Number(o.id);
            const uname = o.username.trim() || `User ${uid}`;
            const profileUrl =
              Number.isFinite(uid) && uid > 0 ? `/users/${uid}` : null;
            /*
             * Span + js-usercard (not <a>): nested links inside the picker’s <a> are invalid
             * HTML and break osu’s card positioning; stable guest DOM avoids lookup spam.
             */
            /** @type {Record<string, string | ((e: Event) => void)>} */
            const spanAttrs = {
              class: "oep-picker-active-meta__guest-user js-usercard",
              role: "link",
              tabindex: "0",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (profileUrl) window.location.assign(profileUrl);
              },
              onkeydown: (e) => {
                const ke = /** @type {KeyboardEvent} */ (e);
                if (ke.key !== "Enter" && ke.key !== " ") return;
                ke.preventDefault();
                ke.stopPropagation();
                if (profileUrl) window.location.assign(profileUrl);
              },
              onauxclick: (e) => {
                const me = /** @type {MouseEvent} */ (e);
                if (me.button !== 1 || !profileUrl) return;
                me.preventDefault();
                me.stopPropagation();
                window.open(profileUrl, "_blank", "noopener,noreferrer");
              },
            };
            if (profileUrl) {
              spanAttrs.title = `View ${uname}'s profile`;
              spanAttrs["data-user-id"] = String(uid);
            }
            guestEl.append(el("span", spanAttrs, uname));
          });
        } else {
          if (guestEl.style.display !== "none") guestEl.style.display = "none";
        }
      } else {
        const wantDisplay = expectGuestNodes ? "" : "none";
        if (guestEl.style.display !== wantDisplay)
          guestEl.style.display = wantDisplay;
      }

      const hasTitle = hasVer || (showGuest && guestOwners.length > 0);
      if (titleRow instanceof HTMLElement) {
        const titleDisplay = hasTitle ? "" : "none";
        if (titleRow.style.display !== titleDisplay)
          titleRow.style.display = titleDisplay;
      }

      const starEl = meta.querySelector(".oep-picker-active-meta__star");
      if (rating == null) {
        if (starEl instanceof HTMLElement && starEl.style.display !== "none")
          starEl.style.display = "none";
        if (ratingTextNode.textContent !== "") ratingTextNode.textContent = "";
        const metaDisplay = hasTitle ? "" : "none";
        if (meta.style.display !== metaDisplay)
          meta.style.display = metaDisplay;
        return;
      }
      if (meta.style.display !== "") meta.style.display = "";
      if (starEl instanceof HTMLElement && starEl.style.display !== "")
        starEl.style.display = "";
      const starText = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
      if (ratingTextNode.textContent !== starText)
        ratingTextNode.textContent = starText;
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncContent();
      });
    }

    function onRouteHashSignal() {
      scheduleSync();
    }

    syncContent();

    window.addEventListener("hashchange", onRouteHashSignal, { passive: true });
    window.addEventListener("popstate", onRouteHashSignal, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(picker, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("hashchange", onRouteHashSignal);
      window.removeEventListener("popstate", onRouteHashSignal);
      mo.disconnect();
      stripInjectedMetaFromPicker();
      removeLegacySiblingStrip();
      header.classList.remove("oep-diff-beside-picker");
      lastGuestStableKey = "";
      ratingTextNode = null;
    };
  }

  /**
   * Nomod star rating in the header difficulty line: always visible with a star icon
   * (osu-web only mounts the native span while hovering the picker).
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapHeaderNomodStarLine(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    let hoveredBeatmapId = /** @type {number|null} */ (null);
    let disposed = false;
    let raf = 0;

    function getActiveBeatmapIdFromPicker() {
      const a = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      return m ? Number(m[1]) : null;
    }

    function currentDisplayedBeatmapId() {
      if (hoveredBeatmapId != null) return hoveredBeatmapId;
      const fromPicker = getActiveBeatmapIdFromPicker();
      if (fromPicker != null) return fromPicker;
      const s = getBeatmapPageBeatmapId();
      return s != null ? Number(s) : null;
    }

    function getDifficultyRatingForBeatmap(beatmapId) {
      return getBeatmapVersionAndRatingForHeader(beatmapId).rating;
    }

    function buildStarSpan() {
      const attrs = {
        class:
          "beatmapset-header__diff-extra beatmapset-header__diff-extra--star-difficulty",
        title: "Star rating",
      };
      attrs[HEADER_NOMOD_STAR_ATTR] = "1";
      return el(
        "span",
        attrs,
        el("i", { class: "fas fa-star", "aria-hidden": "true" }),
        "",
      );
    }

    /** @type {Text|null} */
    let ratingTextNode = null;

    function ensureAttached() {
      if (disposed || !pathRe.test(location.pathname)) return null;
      const diffName = header.querySelector(".beatmapset-header__diff-name");
      const row = diffName?.parentElement;
      if (!(diffName instanceof HTMLElement) || !(row instanceof HTMLElement))
        return null;

      let span = row.querySelector(`[${HEADER_NOMOD_STAR_ATTR}="1"]`);
      if (!(span instanceof HTMLSpanElement)) span = buildStarSpan();
      diffName.insertAdjacentElement("afterend", span);

      const icon = span.querySelector(".fa-star");
      const tn = icon?.nextSibling;
      ratingTextNode = tn instanceof Text ? tn : null;
      return span;
    }

    function syncContent() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const span = ensureAttached();
      if (!span || !ratingTextNode) return;
      const id = currentDisplayedBeatmapId();
      const r = id != null ? getDifficultyRatingForBeatmap(id) : null;
      if (r == null) {
        span.style.display = "none";
        ratingTextNode.textContent = "";
        return;
      }
      span.style.display = "";
      ratingTextNode.textContent = ` ${formatBeatmapsetHeaderStarRatingText(r)}`;
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncContent();
      });
    }

    /**
     * @param {MouseEvent} e
     */
    function onPickerMouseOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = parseBeatmapIdFromPickerLink(a);
      if (id != null) {
        hoveredBeatmapId = id;
        scheduleSync();
        return;
      }
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      if (m) {
        hoveredBeatmapId = Number(m[1]);
        scheduleSync();
      }
    }

    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    function onRouteHashSignal() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    syncContent();

    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onRouteHashSignal, { passive: true });
    window.addEventListener("popstate", onRouteHashSignal, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(header, { subtree: true, childList: true });

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onRouteHashSignal);
      window.removeEventListener("popstate", onRouteHashSignal);
      mo.disconnect();
      header.querySelector(`[${HEADER_NOMOD_STAR_ATTR}="1"]`)?.remove();
    };
  }

  /**
   * OMDB mapset link + short hint when the feature is on but no API key is set.
   * @returns {() => void}
   */
  function mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !box) return () => {};

    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();

    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB",
      },
      "OMDB",
    );
    const keyLink = el(
      "a",
      {
        href: "#",
        class: `${OEP_OMDB_ROW_CLASS}__settings-link`,
        title: "Open Expert+ settings",
      },
      "OMDB API key",
    );
    keyLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      OsuExpertPlus.settingsPanel?.open?.();
    });
    const bodyEl = el(
      "span",
      {
        class: `${OEP_OMDB_ROW_CLASS}__body ${OEP_OMDB_ROW_CLASS}__body--muted`,
      },
      "Add an ",
      keyLink,
      " to load OMDB ratings here",
    );
    const statsRow = el(
      "div",
      { class: OEP_OMDB_ROW_CLASS },
      omdbLabel,
      bodyEl,
    );
    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1",
    });
    wrap.appendChild(statsRow);
    box.insertBefore(wrap, diffName);

    return () => {
      wrap.remove();
    };
  }

  /**
   * Inserts an OMDB stats row above `.beatmapset-header__diff-name`.
   * Tracks hovered vs active picker link (same behaviour as the difficulty title).
   * @returns {() => void}
   */
  function mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !picker || !box) return () => {};

    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();

    const distPopoverEl = el("div", {
      class: `${OEP_OMDB_ROW_CLASS}__dist-popover`,
      "data-oep-omdb-dist-popover": "1",
    });
    distPopoverEl.style.cssText = "display:none;position:fixed;z-index:10002;";
    document.body.appendChild(distPopoverEl);
    let distPopoverHideTimer = 0;

    function hideOmdbDistPopover() {
      window.clearTimeout(distPopoverHideTimer);
      distPopoverHideTimer = 0;
      distPopoverEl.style.display = "none";
      distPopoverEl.replaceChildren();
    }

    function positionOmdbDistPopover(anchorRect) {
      const margin = 6;
      const w = distPopoverEl.offsetWidth;
      const h = distPopoverEl.offsetHeight;
      let left = anchorRect.left;
      let top = anchorRect.bottom + margin;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      if (top + h > window.innerHeight - 8) {
        top = Math.max(8, anchorRect.top - h - margin);
      }
      distPopoverEl.style.left = `${left}px`;
      distPopoverEl.style.top = `${top}px`;
    }

    function showOmdbDistPopover(trigger, rows) {
      window.clearTimeout(distPopoverHideTimer);
      fillOmdbDistPopover(distPopoverEl, rows);
      distPopoverEl.style.display = "block";
      positionOmdbDistPopover(trigger.getBoundingClientRect());
    }

    distPopoverEl.addEventListener("mouseenter", () => {
      window.clearTimeout(distPopoverHideTimer);
    });
    distPopoverEl.addEventListener("mouseleave", () => {
      distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 100);
    });

    function onOmdbDistScrollOrResize() {
      if (distPopoverEl.style.display !== "none") hideOmdbDistPopover();
    }
    window.addEventListener("scroll", onOmdbDistScrollOrResize, true);
    window.addEventListener("resize", onOmdbDistScrollOrResize, {
      passive: true,
    });

    const omdbDistUi = {
      /**
       * @param {HTMLElement} trigger
       * @param {{ score: number, count: number }[]} rows
       */
      bindTrigger(trigger, rows) {
        const schedHide = () => {
          window.clearTimeout(distPopoverHideTimer);
          distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 120);
        };
        trigger.addEventListener("mouseenter", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("mouseleave", schedHide);
        trigger.addEventListener("focus", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("blur", schedHide);
      },
    };

    const bodyEl = el(
      "span",
      { class: `${OEP_OMDB_ROW_CLASS}__body` },
      "Loading OMDB…",
    );
    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB",
      },
      "OMDB",
    );
    const statsRow = el(
      "div",
      { class: OEP_OMDB_ROW_CLASS },
      omdbLabel,
      bodyEl,
    );

    const starUnits = [];
    const starsHost = el("div", { class: `${OEP_OMDB_VOTE_CLASS}__stars` });
    for (let si = 0; si < 5; si++) {
      const unitClass =
        si === 0
          ? `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty ${OEP_OMDB_VOTE_CLASS}__unit--has-zero`
          : `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty`;
      const unit = el("span", { class: unitClass });
      unit.appendChild(
        el("i", {
          class: `far fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--empty`,
          "aria-hidden": "true",
        }),
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star-half-alt ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--half`,
          "aria-hidden": "true",
        }),
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--full`,
          "aria-hidden": "true",
        }),
      );
      if (si === 0) {
        unit.appendChild(
          el("button", {
            type: "button",
            class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--zero`,
            "data-oep-score": "0",
            "aria-label":
              "Rate 0 out of 5 stars on OMDB (left edge of first star)",
            title: "0★",
          }),
        );
      }
      const left = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--left`,
        "data-oep-score": String(si + 0.5),
        "aria-label": `Rate ${si + 0.5} out of 5 stars on OMDB`,
        title: `${si + 0.5}★`,
      });
      const right = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--right`,
        "data-oep-score": String(si + 1),
        "aria-label": `Rate ${si + 1} out of 5 stars on OMDB`,
        title: `${si + 1}★`,
      });
      unit.appendChild(left);
      unit.appendChild(right);
      starUnits.push(unit);
      starsHost.appendChild(unit);
    }

    const clearBtn = el(
      "button",
      {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__clear ${OEP_OMDB_VOTE_CLASS}__clear--concealed`,
        title: "Remove your OMDB rating",
        "aria-hidden": "true",
      },
      "Clear",
    );
    const voteStatus = el("span", { class: `${OEP_OMDB_VOTE_CLASS}__status` });
    const voteControls = el(
      "div",
      { class: `${OEP_OMDB_VOTE_CLASS}__controls` },
      el("span", { class: `${OEP_OMDB_VOTE_CLASS}__label` }, "Your rating"),
      starsHost,
      clearBtn,
    );
    const voteRow = el(
      "div",
      {
        class: OEP_OMDB_VOTE_CLASS,
        "data-oep-omdb-vote": "1",
        style: "display: none",
      },
      voteControls,
      voteStatus,
    );

    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1",
    });
    wrap.appendChild(statsRow);
    wrap.appendChild(voteRow);
    box.insertBefore(wrap, diffName);

    const beatmapIdsInSet = new Set();
    for (const b of readBeatmapsetJson()?.beatmaps ?? []) {
      if (b?.id != null) beatmapIdsInSet.add(Number(b.id));
    }
    let omdbSetFetchSucceeded = false;

    /** @type {Map<number, object>} */
    let byBeatmapId = new Map();
    let hoveredBeatmapId = null;
    /** @type {number|null} */
    let hoverStarScore = null;
    let voteBusy = false;
    let disposed = false;
    let raf = 0;

    function getActiveBeatmapIdFromPicker() {
      const a = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      return a instanceof HTMLAnchorElement
        ? parseBeatmapIdFromPickerLink(a)
        : null;
    }

    function currentDisplayedBeatmapId() {
      return hoveredBeatmapId ?? getActiveBeatmapIdFromPicker();
    }

    function isOmdbDifficultyBlacklisted(beatmapId) {
      if (!omdbSetFetchSucceeded || beatmapId == null) return false;
      if (byBeatmapId.size === 0) return false;
      const n = Number(beatmapId);
      if (!Number.isFinite(n) || !beatmapIdsInSet.has(n)) return false;
      return !byBeatmapId.has(n);
    }

    function setVoteBusy(on) {
      voteBusy = on;
      voteRow.classList.toggle(`${OEP_OMDB_VOTE_CLASS}--busy`, on);
      clearBtn.disabled = on;
    }

    function syncVoteStars() {
      if (disposed || voteRow.style.display === "none") return;
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        paintOmdbStarUnits(starUnits, null);
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
        return;
      }
      const entry = byBeatmapId.get(id);
      const own = parseOmdbOwnRating(entry);
      const visual = hoverStarScore != null ? hoverStarScore : own;
      paintOmdbStarUnits(starUnits, visual);
      if (own != null) {
        clearBtn.classList.remove(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.removeAttribute("aria-hidden");
      } else {
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
      }
    }

    function syncDisplay() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        bodyEl.textContent = "";
        bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
        syncVoteStars();
        return;
      }
      bodyEl.classList.remove(
        `${OEP_OMDB_ROW_CLASS}__body--muted`,
        `${OEP_OMDB_ROW_CLASS}__body--error`,
      );
      renderOmdbRatingRowBody(
        bodyEl,
        byBeatmapId.get(id),
        omdbDistUi,
        header,
        isOmdbDifficultyBlacklisted(id),
      );
      syncVoteStars();
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncDisplay();
      });
    }

    /**
     * @param {MouseEvent} e
     */
    function onPickerMouseOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = parseBeatmapIdFromPickerLink(a);
      if (id != null) hoveredBeatmapId = id;
      syncDisplay();
    }

    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      syncDisplay();
    }

    function onHashChange() {
      hoveredBeatmapId = null;
      hoverStarScore = null;
      scheduleSync();
    }

    /**
     * @param {MouseEvent} e
     */
    function onStarHalfEnter(e) {
      const t = e.currentTarget;
      if (!(t instanceof HTMLElement)) return;
      const raw = t.getAttribute("data-oep-score");
      const n = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(n)) return;
      hoverStarScore = n;
      syncVoteStars();
    }

    /**
     * @param {MouseEvent} e
     */
    function onVoteControlsMouseLeave(e) {
      const rel = e.relatedTarget;
      if (rel instanceof Node && voteControls.contains(rel)) return;
      hoverStarScore = null;
      syncVoteStars();
    }

    async function reloadSetRatings() {
      const list = await omdb.fetchBeatmapsetRatings(beatmapsetId);
      if (disposed || !pathRe.test(location.pathname)) return;
      byBeatmapId = new Map();
      for (const item of list || []) {
        const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
        if (bid != null) byBeatmapId.set(Number(bid), item);
      }
      omdbSetFetchSucceeded = true;
      syncDisplay();
    }

    /**
     * @param {number} score
     */
    async function submitVote(score) {
      if (voteBusy || disposed || !pathRe.test(location.pathname)) return;
      const id = currentDisplayedBeatmapId();
      if (id == null) return;
      hoverStarScore = null;
      voteStatus.textContent = "";
      voteStatus.classList.remove(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      setVoteBusy(true);
      try {
        await omdb.rateBeatmap(id, score);
        await reloadSetRatings();
      } catch (err) {
        voteStatus.textContent = err?.message
          ? String(err.message)
          : "Could not submit rating.";
        voteStatus.classList.add(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      } finally {
        setVoteBusy(false);
      }
    }

    for (const unit of starUnits) {
      for (const half of unit.querySelectorAll(
        `.${OEP_OMDB_VOTE_CLASS}__half`,
      )) {
        half.addEventListener("mouseenter", onStarHalfEnter);
        half.addEventListener("click", (e) => {
          e.preventDefault();
          const btn = e.currentTarget;
          if (!(btn instanceof HTMLElement) || voteBusy) return;
          const raw = btn.getAttribute("data-oep-score");
          const n = raw == null ? NaN : Number(raw);
          if (!Number.isFinite(n)) return;
          submitVote(n);
        });
      }
    }

    voteControls.addEventListener("mouseleave", onVoteControlsMouseLeave);
    clearBtn.addEventListener("click", () => submitVote(-2));

    omdb
      .fetchBeatmapsetRatings(beatmapsetId)
      .then((list) => {
        if (disposed || !pathRe.test(location.pathname)) return;
        byBeatmapId = new Map();
        for (const item of list || []) {
          const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
          if (bid != null) byBeatmapId.set(Number(bid), item);
        }
        omdbSetFetchSucceeded = true;
        bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--error`);
        voteRow.style.display = "";
        syncDisplay();
      })
      .catch((err) => {
        if (disposed) return;
        bodyEl.textContent = err?.message
          ? String(err.message)
          : "Could not load OMDB ratings.";
        bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--error`);
        voteRow.style.display = "none";
      });

    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onHashChange, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(picker, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });

    scheduleSync();

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      mo.disconnect();
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onHashChange);
      hideOmdbDistPopover();
      window.removeEventListener("scroll", onOmdbDistScrollOrResize, true);
      window.removeEventListener("resize", onOmdbDistScrollOrResize);
      distPopoverEl.remove();
      wrap.remove();
    };
  }

  /**
   * Primary `.osz` download in `.beatmapset-header__buttons` — first link to
   * `/beatmapsets/{id}/download` (excludes osu!direct / support links).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function mountBeatconnectDownloadSplit(header, beatmapsetId) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    if (buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)) {
      return () => {};
    }

    const id = Number(beatmapsetId);
    if (!Number.isFinite(id)) return () => {};

    const dlRe = new RegExp(String.raw`/beatmapsets/${id}/download`, "i");
    /** @type {HTMLAnchorElement | undefined} */
    const primaryDl = qsa("a.btn-osu-big", buttons).find((a) =>
      dlRe.test(a.getAttribute("href") || ""),
    );
    if (!primaryDl) {
      return () => {};
    }

    primaryDl.classList.add(BEATCONNECT_DL_PAIRED_CLASS);

    const beatconnectBtn = el(
      "a",
      {
        class: `btn-osu-big btn-osu-big--beatmapset-header ${BEATCONNECT_DL_BTN_CLASS}`,
        href: `https://beatconnect.io/b/${id}`,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      el(
        "span",
        {
          class: `btn-osu-big__content ${BEATCONNECT_STACK_CLASS}`,
        },
        el(
          "span",
          {
            class: `btn-osu-big__icon ${BEATCONNECT_STACK_ICON_CLASS}`,
          },
          el("img", {
            class: "oep-beatconnect-logo",
            src: "https://beatconnect.io/static/img/logo.png",
            alt: "Beatconnect",
            decoding: "async",
          }),
        ),
        el("span", { class: BEATCONNECT_STACK_LABEL_CLASS }, "Beatconnect"),
      ),
    );

    primaryDl.after(beatconnectBtn);

    return () => {
      primaryDl.classList.remove(BEATCONNECT_DL_PAIRED_CLASS);
      buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)?.remove();
    };
  }

  /**
   * Square header control opening `https://b.ppy.sh/preview/{id}.mp3` (osu! preview stream).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function mountBeatmapsetPreviewAudioButton(header, beatmapsetId) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    if (buttons.querySelector("[data-oep-beatmapset-preview-audio]")) {
      return () => {};
    }

    const id = Number(beatmapsetId);
    if (!Number.isFinite(id)) return () => {};

    const previewLink = el(
      "a",
      {
        class: "btn-osu-big btn-osu-big--beatmapset-header-square",
        href: `https://b.ppy.sh/preview/${id}.mp3`,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-oep-beatmapset-preview-audio": "",
        title: "Open preview audio",
        "aria-label": "Open preview audio",
      },
      el(
        "span",
        { class: "btn-osu-big__content btn-osu-big__content--center" },
        el(
          "span",
          { class: "btn-osu-big__icon" },
          el(
            "span",
            { class: "fa fa-fw" },
            el("span", { class: "fas fa-volume-up", "aria-hidden": "true" }),
          ),
        ),
      ),
    );

    const mp3 = buttons.querySelector("[data-oep-beatmapset-mp3]");
    const bg = buttons.querySelector("[data-oep-beatmapset-bg]");
    if (mp3 instanceof HTMLElement) {
      mp3.insertAdjacentElement("afterend", previewLink);
    } else if (bg instanceof HTMLElement) {
      bg.insertAdjacentElement("afterend", previewLink);
    } else {
      const directBtn = findBeatmapsetOsuDirectButton(buttons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", previewLink);
      } else {
        buttons.appendChild(previewLink);
      }
    }

    return () => {
      previewLink.remove();
    };
  }

  // Attribute set on .beatmapset-header elements we have already processed.
  const BEATMAPSET_HEADER_PROCESSED_ATTR = "data-oep-processed";
  const BEATMAPSET_HEADER_STALE_SEL = `.beatmapset-header[${BEATMAPSET_HEADER_PROCESSED_ATTR}]`;

  /**
   * @param {RegExpMatchArray} match  match[1] = beatmapset id string.
   * @returns {Promise<function>}
   */
  async function init(match) {
    const beatmapsetId = match[1];
    const pathRe = new RegExp(`^/beatmapsets/${beatmapsetId}(?:/|$)`);

    // Discussion routes use a different layout and may not have beatmapset header/scoreboard UI.
    if (/^\/beatmapsets\/\d+\/discussion(?:\/|$)/i.test(location.pathname)) {
      ensureStyles();
      const bag = createCleanupBag();
      bag.add(
        startBeatmapDiscussionPreviewManager(pathRe),
        startBeatmapDiscussionVotersTooltipManager(pathRe),
      );
      return () => bag.dispose();
    }

    ensureStyles();
    installBeatmapScoresLimitPatch();

    /** @type {{ dispose: () => void } | null} */
    let metadataInfoModal = null;
    /** @type {{ dispose: () => void } | null} */
    let descriptionInfoModal = null;
    /** @type {HTMLElement|null} */
    let descriptionHeadingDescRow = null;
    /** @type {HTMLElement|null} */
    let header = null;
    /** @type {null|(() => void)} */
    let modGridCleanup = null;
    let modGridSetupGen = 0;

    const bag = createCleanupBag();

    function disposeBeatmapInfoModalButtons() {
      try {
        metadataInfoModal?.dispose();
      } catch (_) {}
      metadataInfoModal = null;
      try {
        descriptionInfoModal?.dispose();
      } catch (_) {}
      descriptionInfoModal = null;
      if (descriptionHeadingDescRow instanceof HTMLElement) {
        teardownBeatmapDescriptionHeadingLayout(descriptionHeadingDescRow);
        descriptionHeadingDescRow = null;
      }
    }

    function refreshBeatmapInfoModalButtons() {
      if (!(header instanceof HTMLElement) || !document.body.contains(header))
        return;
      if (!pathRe.test(location.pathname)) return;

      if (!settings.isEnabled(METADATA_DESCRIPTION_MODAL_BUTTONS_ID)) {
        disposeBeatmapInfoModalButtons();
        return;
      }

      const data = readBeatmapsetJson();

      const artistEl = header.querySelector(
        ".beatmapset-header__details-text--artist",
      );
      if (
        !metadataInfoModal &&
        artistEl instanceof HTMLElement &&
        !header.querySelector("[data-oep-beatmapset-metadata]")
      ) {
        metadataInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap metadata",
          titleId: `${ROOT_CLASS}-metadata-title`,
          buttonText: "Show metadata",
          buttonIconClass: "fas fa-clipboard-list",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--under-artist`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-metadata", "");
            artistEl.insertAdjacentElement("afterend", btn);
          },
          buildModalTitleExtra: (elFn) =>
            buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapPageBeatmapId),
          buildBody: () => buildModalBody(data, el),
        });
      }

      const infoCol = document.querySelector(".beatmapset-info");
      const firstBox = infoCol?.querySelector(":scope > .beatmapset-info__box");
      const scrollEl = firstBox?.querySelector(
        ":scope > .beatmapset-info__scrollable",
      );
      const descRow =
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:has(.beatmapset-info__description)",
        ) ??
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:first-child:has(> h3.beatmapset-info__header)",
        );
      const descHeading = descRow?.querySelector(
        ":scope > h3.beatmapset-info__header",
      );
      if (
        !descriptionInfoModal &&
        descRow instanceof HTMLElement &&
        descHeading instanceof HTMLElement &&
        !descRow.querySelector("[data-oep-beatmapset-desc]")
      ) {
        descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
        descriptionHeadingDescRow = descRow;
        descriptionInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap description",
          titleId: `${ROOT_CLASS}-description-title`,
          buttonText: "Full description",
          buttonIconClass: "fas fa-align-left",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--description-heading`,
          modalExtraClass: `${ROOT_CLASS}__modal--description`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-desc", "");
            const headWrap = el("div", {
              class: `${ROOT_CLASS}__description-sticky-head`,
            });
            descRow.insertBefore(headWrap, descHeading);
            headWrap.appendChild(descHeading);
            headWrap.appendChild(btn);
          },
          buildBody: () => buildDescriptionModalBody(data, el),
        });
      }
    }

    function refreshBeatmapScoreboardModGrid() {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      const gen = modGridSetupGen;
      if (!settings.isEnabled(SCOREBOARD_MOD_GRID_ID)) {
        const modsStrip = document.querySelector(
          ".beatmapset-scoreboard__mods",
        );
        if (modsStrip instanceof HTMLElement) {
          stopBeatmapScoreboardModGridLive(modsStrip);
        }
        return;
      }
      setupBeatmapScoreboardModGrid().then((dispose) => {
        if (gen !== modGridSetupGen) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        if (!pathRe.test(location.pathname)) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        modGridCleanup = dispose;
      });
    }

    const cleanup = () => {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      disposeBeatmapInfoModalButtons();
      bag.dispose();
    };

    await waitForStaleElementToLeave(BEATMAPSET_HEADER_STALE_SEL);

    try {
      header = await waitForElement(".beatmapset-header", 15000);
    } catch (_) {
      return cleanup;
    }

    header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");

    if (!document.body.contains(header)) return cleanup;

    if (!pathRe.test(location.pathname)) return cleanup;

    bag.add(startBeatmapScoreboardSortControls(pathRe));
    bag.add(startBeatmapScoreUserSearchManager(pathRe));
    bag.add(startBeatmapScoreboardHideRateEditFilterBar(pathRe));
    bag.add(startBeatmapScoreboardTableEnhancementsLive(pathRe));
    bag.add(startBeatmapDiscussionPreviewManager(pathRe));
    bag.add(startDiscussionTabLinkPatcher(beatmapsetId));
    bag.add(startBeatmapsetFavouriteButtonPinkIndicator(header));

    /** @type {null|(() => void)} */
    let headerStarOrDiffBesideCleanup = null;
    function refreshHeaderStarLineOrDiffBesidePicker() {
      try {
        headerStarOrDiffBesideCleanup?.();
      } catch (_) {}
      headerStarOrDiffBesideCleanup = null;
      if (!pathRe.test(location.pathname) || !document.body.contains(header)) {
        return;
      }
      headerStarOrDiffBesideCleanup = settings.isEnabled(
        DIFF_NAME_BESIDE_PICKER_ID,
      )
        ? startBeatmapHeaderDiffBesidePicker(header, pathRe)
        : startBeatmapHeaderNomodStarLine(header, pathRe);
    }
    refreshHeaderStarLineOrDiffBesidePicker();
    bag.add(
      settings.onChange(
        DIFF_NAME_BESIDE_PICKER_ID,
        refreshHeaderStarLineOrDiffBesidePicker,
      ),
    );
    bag.add(() => {
      try {
        headerStarOrDiffBesideCleanup?.();
      } catch (_) {}
      headerStarOrDiffBesideCleanup = null;
    });

    /** @type {null|(() => void)} */
    let beatconnectCleanup = null;
    function refreshBeatconnectDownloadButton() {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATCONNECT_DOWNLOAD_BUTTON_ID)
      ) {
        beatconnectCleanup = mountBeatconnectDownloadSplit(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatconnectDownloadButton();
    bag.add(
      settings.onChange(
        BEATCONNECT_DOWNLOAD_BUTTON_ID,
        refreshBeatconnectDownloadButton,
      ),
    );
    bag.add(() => {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
    });

    /** @type {null|(() => void)} */
    let omdbRatingsCleanup = null;
    function refreshOmdbBeatmapsetRatings() {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
      if (!settings.isEnabled(OMDB_BEATMAPSET_RATINGS_ID)) {
        return;
      }
      omdbRatingsCleanup = omdb.isConfigured()
        ? mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe)
        : mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId);
    }
    refreshOmdbBeatmapsetRatings();
    bag.add(
      settings.onChange(
        OMDB_BEATMAPSET_RATINGS_ID,
        refreshOmdbBeatmapsetRatings,
      ),
    );
    bag.add(() => {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
    });

    bag.add(
      settings.onChange(SCORE_PP_DECIMALS_ID, () => {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      }),
    );

    refreshBeatmapScoreboardModGrid();
    bag.add(
      settings.onChange(
        SCOREBOARD_MOD_GRID_ID,
        refreshBeatmapScoreboardModGrid,
      ),
    );

    const data = readBeatmapsetJson();

    if (auth.isConfigured()) {
      bag.add(
        setupBeatmapsetFavouriteHoverPopover(
          header,
          beatmapsetId,
          pathRe,
          data?.favourite_count,
        ),
      );
    }

    refreshBeatmapInfoModalButtons();
    bag.add(
      settings.onChange(
        METADATA_DESCRIPTION_MODAL_BUTTONS_ID,
        refreshBeatmapInfoModalButtons,
      ),
    );

    try {
      await waitForElement(".beatmapset-info", 12000);
      if (pathRe.test(location.pathname) && document.body.contains(header)) {
        // Between `.beatmapset-header` and `.beatmapset-info` (sibling in `.osu-page--generic-compact`).
        /** @type {null|(() => void)} */
        let beatmapPreviewCleanup = null;
        function refreshBeatmapPreviewSection() {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
          if (
            !pathRe.test(location.pathname) ||
            !document.body.contains(header) ||
            !settings.isEnabled(BEATMAP_PREVIEW_ID) ||
            !beatmapPreview
          ) {
            return;
          }
          const infoEl = document.querySelector(".beatmapset-info");
          if (!infoEl || !document.body.contains(infoEl)) return;
          if (document.querySelector("[data-oep-beatmap-preview-root]")) return;

          const previewUi = beatmapPreview.mountBeatmapsetInfoPreview({
            el,
            manageStyle,
            pathRe,
            getBeatmapId: getBeatmapPageBeatmapId,
            getRuleset: getBeatmapPageRuleset,
            readBeatmapsetJson,
            styleId: BEATMAP_PREVIEW_STYLE_ID,
          });
          const previewSection = el("div", {
            class: "oep-beatmap-preview-section",
          });
          previewSection.appendChild(previewUi.getRow());
          infoEl.insertAdjacentElement("beforebegin", previewSection);
          beatmapPreviewCleanup = () => {
            try {
              previewUi.dispose();
            } catch (_) {}
            previewSection.remove();
          };
        }
        refreshBeatmapPreviewSection();
        bag.add(
          settings.onChange(BEATMAP_PREVIEW_ID, refreshBeatmapPreviewSection),
        );
        bag.add(() => {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
        });

        refreshBeatmapInfoModalButtons();
      }
    } catch (_) {
      /* beatmapset info column not present (layout edge case) */
    }

    const headerButtons = header.querySelector(".beatmapset-header__buttons");
    if (
      headerButtons instanceof HTMLElement &&
      !headerButtons.querySelector("[data-oep-beatmapset-bg]")
    ) {
      const backgroundUrl = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`;
      const bgLink = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: backgroundUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-bg": "",
          title: "Open background",
          "aria-label": "Open background",
        },
        el(
          "span",
          {
            class: "btn-osu-big__content btn-osu-big__content--center",
          },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-image", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const mp3DownloadUrl = `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`;
      const mp3Link = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: mp3DownloadUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-mp3": "",
          title: "Download MP3",
          "aria-label": "Download MP3",
        },
        el(
          "span",
          { class: "btn-osu-big__content btn-osu-big__content--center" },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-music", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const directBtn = findBeatmapsetOsuDirectButton(headerButtons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", bgLink);
      } else {
        headerButtons.appendChild(bgLink);
      }
      bgLink.insertAdjacentElement("afterend", mp3Link);
      bag.add(() => {
        mp3Link.remove();
        bgLink.remove();
      });
    }

    /** @type {null|(() => void)} */
    let previewAudioCleanup = null;
    function refreshBeatmapsetPreviewAudioButton() {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID)
      ) {
        previewAudioCleanup = mountBeatmapsetPreviewAudioButton(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatmapsetPreviewAudioButton();
    bag.add(
      settings.onChange(
        BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID,
        refreshBeatmapsetPreviewAudioButton,
      ),
    );
    bag.add(() => {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
    });

    return cleanup;
  }

  return { name, init };
})();

/* ── src/pages/user-profile.js ── */
/** User profile page. Router calls init per visit; cleanup on navigate away. */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.userProfile = (() => {
  const name = "UserProfile";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    manageStyle,
    createCleanupBag,
    parseLocaleNumber,
    formatDecimalPp,
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const {
    applyModIconsAsAcronyms,
    injectModIconsAcronymStyles,
    stripOepModAcronymFromClonedMod,
    modTypeClassForAcronym,
  } = OsuExpertPlus.modIconsAsAcronyms;

  /**
   * True when a mutation batch contains an added node that matches selector
   * (or contains matching descendants).
   * @param {MutationRecord[]} mutations
   * @param {string} selector
   * @returns {boolean}
   */
  function mutationsIncludeSelector(mutations, selector) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(selector)) return true;
        if (node.querySelector(selector)) return true;
      }
    }
    return false;
  }

  // Score lists: PP from span title → 2dp; hit-stat row from API (fetchScores)
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const SCORE_HIT_STATISTICS_ID = IDS.SCORE_HIT_STATISTICS;
  const SCORE_PERIOD_HIGHLIGHT_ID = IDS.SCORE_PERIOD_HIGHLIGHT;
  const RECENT_SCORES_SHOW_FAILS_ID = IDS.RECENT_SCORES_SHOW_FAILS;
  const PP_DECIMALS_ATTR = "data-oep-pp-original";

  function applyPpDecimals(listEl) {
    listEl
      .querySelectorAll(".play-detail__pp > span[title]")
      .forEach((span) => {
        const full = span.getAttribute("title");
        if (!full) return;

        const textNode = Array.from(span.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        if (!textNode) return;

        const n = parseLocaleNumber(full);
        if (!Number.isFinite(n)) return;

        const expected = formatDecimalPp(n) + "\u200A"; // hair space
        if (textNode.textContent === expected) return;

        span.setAttribute(PP_DECIMALS_ATTR, textNode.textContent.trim());
        textNode.textContent = expected;
      });
  }

  function revertPpDecimals(listEl) {
    listEl
      .querySelectorAll(`.play-detail__pp > span[${PP_DECIMALS_ATTR}]`)
      .forEach((span) => {
        const original = span.getAttribute(PP_DECIMALS_ATTR);
        const textNode = Array.from(span.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        if (textNode) textNode.textContent = original;
        span.removeAttribute(PP_DECIMALS_ATTR);
      });
  }

  const PLAY_DETAIL_STYLE_ID = "osu-expertplus-play-detail";

  /** On `.play-detail-list`: enables our desktop column widths; remove when feature off. */
  const SCORE_LIST_LAYOUT_CLASS = "oep-score-list-details-layout";
  /** Wider PP column track when "PP decimals on scores" is on (layout list only). */
  const SCORE_LIST_PP_DECIMALS_CLASS = "oep-score-list-pp-decimals";
  const SCORE_LIST_LAYOUT_SEL = `.play-detail-list.${SCORE_LIST_LAYOUT_CLASS}`;

  /** Desktop `.play-detail` flex tracks (mods / pp / accuracy / combo+stats). */
  const PLAY_DETAIL_DESKTOP_TUNING = {
    modsColMaxWidth: "min(72vw, 40rem)",
    ppDesktopWidth: "max(102px, 10ch)",
    ppColWidth: "calc(max(102px, 10ch) + 2.45rem)",
    accuracyColWidth: "7.5ch",
    comboStatsColWidth: "13rem",
    midGap: "0.28em",
    srBadgeMinWidth: "4.5rem",
  };

  const PLAY_DETAIL_CSS = `
    .oep-hidden { display: none !important; }

    .play-detail__beatmap-and-time {
      align-items: center;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      text-align: left;
      box-sizing: border-box;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.35em;
      width: 100%;
      min-width: 0;
      flex: 1 1 0;
      box-sizing: border-box;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      text-align: right;
      min-width: 0;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail .play-detail__accuracy {
      font-weight: 700;
      font-size: 15px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col .play-detail__accuracy {
      flex-shrink: 0;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 3px;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col .oep-score-stats {
      margin-top: 0;
    }

    @media (min-width: 900px) {
      ${SCORE_LIST_LAYOUT_SEL} .play-detail {
        align-items: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--top {
        flex: 1 1 0% !important;
        min-width: 0;
        align-items: flex-start !important;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__detail {
        min-width: 0;
        align-items: flex-start;
        text-align: left;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--bottom {
        flex: 0 0 auto;
        flex-wrap: nowrap;
        align-items: stretch;
        align-self: stretch;
        box-sizing: border-box;
        --oep-mods-col-max: ${PLAY_DETAIL_DESKTOP_TUNING.modsColMaxWidth};
        --oep-accuracy-col: ${PLAY_DETAIL_DESKTOP_TUNING.accuracyColWidth};
        --oep-combo-stats-col: ${PLAY_DETAIL_DESKTOP_TUNING.comboStatsColWidth};
        --oep-mid-gap: ${PLAY_DETAIL_DESKTOP_TUNING.midGap};
        --oep-score-detail-pad-x: 20px;
        --oep-score-detail-gap: 10px;
        --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
      }

      ${SCORE_LIST_LAYOUT_SEL}.${SCORE_LIST_PP_DECIMALS_CLASS} .play-detail__group--bottom {
        --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppColWidth};
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__mods {
        flex: 0 0 auto;
        width: max-content;
        max-width: var(--oep-mods-col-max);
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        box-sizing: border-box;
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail {
        flex: 0 0
          calc(
            var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
              var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
          );
        width: calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        min-width: 0;
        overflow: hidden;
        box-sizing: border-box;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
        flex: 1 1 0;
        margin-left: 10px;
        width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        min-width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        overflow: hidden;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__pp {
        --desktop-width: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
        flex: 0 0 var(--oep-pp-track);
        width: var(--oep-pp-track);
        min-width: var(--oep-pp-track);
        max-width: var(--oep-pp-track);
        box-sizing: border-box;
        font-variant-numeric: tabular-nums;
      }

      ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
        flex-direction: row;
        align-items: center;
        gap: var(--oep-mid-gap);
        width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: 100%;
        overflow: visible;
      }
      ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
        flex: 0 0 var(--oep-accuracy-col);
        width: var(--oep-accuracy-col);
        max-width: var(--oep-accuracy-col);
        min-width: var(--oep-accuracy-col);
        font-variant-numeric: tabular-nums;
        overflow: visible;
      }
      ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
        flex: 0 0 var(--oep-combo-stats-col);
        width: var(--oep-combo-stats-col);
        max-width: var(--oep-combo-stats-col);
        overflow: hidden;
      }
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__accuracy-and-weighted-pp {
      display: flex;
      flex-flow: row wrap;
      align-items: baseline;
      gap: 0 0.5em;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      justify-content: flex-start;
      box-sizing: border-box;
    }
    .play-detail-list .play-detail__accuracy-and-weighted-pp {
      display: flex;
      flex-flow: row wrap;
      align-items: baseline;
      gap: 0 0.5em;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      justify-content: flex-start;
      box-sizing: border-box;
    }

    .play-detail-list .oep-mid-cols {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.28em;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      overflow: visible;
      box-sizing: border-box;
    }
    .play-detail-list .oep-accuracy-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      text-align: right;
      min-width: 0;
      overflow: visible;
      font-variant-numeric: tabular-nums;
    }
    .play-detail-list .oep-accuracy-col .play-detail__accuracy {
      flex-shrink: 0;
    }
    .play-detail-list .play-detail__score-detail .play-detail__accuracy {
      font-weight: 700;
      font-size: 15px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline {
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.12em;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.92;
      font-variant-numeric: tabular-nums;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num {
      font-weight: 500;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num--full {
      color: #9beb5b;
      font-weight: 800;
    }

    .play-detail-list .oep-combo-inline {
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.12em;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.92;
      font-variant-numeric: tabular-nums;
    }
    .play-detail-list .oep-combo-inline__num {
      font-weight: 500;
    }
    .play-detail-list .oep-combo-inline__num--full {
      color: #9beb5b;
      font-weight: 800;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 3px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-top: 3px;
      line-height: 1;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__sep {
      opacity: 0.35;
      margin: 0 1px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--300  { color: #78dcff; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--100  { color: #84e03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--50   { color: #e0b03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--miss { color: #e05c5c; }
    .play-detail-list .oep-score-stats {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 3px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-top: 3px;
      line-height: 1;
    }
    .play-detail-list .oep-score-stats__sep {
      opacity: 0.35;
      margin: 0 1px;
    }
    .play-detail-list .oep-score-stats__val--300  { color: #78dcff; }
    .play-detail-list .oep-score-stats__val--100  { color: #84e03a; }
    .play-detail-list .oep-score-stats__val--50   { color: #e0b03a; }
    .play-detail-list .oep-score-stats__val--miss { color: #e05c5c; }

    .oep-sr-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: max(11px, 0.82em);
      padding: 0.22em 0.55em;
      min-width: ${PLAY_DETAIL_DESKTOP_TUNING.srBadgeMinWidth};
      min-height: 1.35em;
      border-radius: 10000px;
      margin: 0 -0.55rem 0 0;
      flex-shrink: 0;
      vertical-align: middle;
      line-height: 1;
      border: none;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }
    .oep-sr-badge__inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: nowrap;
      column-gap: 0.1em;
      flex: 0 0 auto;
      min-width: 0;
      line-height: 1;
    }
    .oep-sr-badge__val {
      flex: 0 0 auto;
      width: auto;
      max-width: none;
      text-align: left;
      font-variant-numeric: tabular-nums;
    }
    .oep-sr-badge__inner .oep-sr-badge__icon {
      font-size: 0.65em;
      line-height: 1;
      color: inherit;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
    }

    .oep-recent-fails-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .oep-recent-fails-header .title {
      margin: 0;
      padding: 0;
      line-height: 1.2;
    }
    .oep-recent-fails-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      margin: 0;
      padding: 0;
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.02em;
      color: hsl(var(--hsl-c1));
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .oep-recent-fails-toggle .oep-recent-show-fails {
      margin: 0;
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      border-radius: 3px;
      cursor: pointer;
      accent-color: hsl(var(--hsl-b6));
    }
    .oep-recent-fails-toggle .oep-recent-show-fails:focus-visible {
      outline: 2px solid hsl(var(--hsl-b6));
      outline-offset: 2px;
    }
    .oep-clear-sr-cache-btn {
      appearance: none;
      background: none;
      border: 1px solid hsl(var(--hsl-b5));
      border-radius: 3px;
      color: hsl(var(--hsl-c1));
      cursor: pointer;
      font-size: 0.75rem;
      font-family: inherit;
      font-weight: 500;
      letter-spacing: 0.02em;
      line-height: 1;
      padding: 3px 7px;
      transition: border-color 0.1s, color 0.1s;
      white-space: nowrap;
    }
    .oep-clear-sr-cache-btn:hover {
      border-color: hsl(var(--hsl-c1));
      color: hsl(var(--hsl-l1));
    }
    .oep-clear-sr-cache-btn:active {
      opacity: 0.7;
    }
  `;
  const playDetailStyle = manageStyle(PLAY_DETAIL_STYLE_ID, PLAY_DETAIL_CSS);

  const SCORE_STATS_ATTR = "data-oep-stats";

  /** GET /users/{id}/scores/{type} paginated; same order as DOM. */
  async function fetchScores(userId, mode, type) {
    const scores = [];
    const limit = 100;
    const maxTotal = 1000;
    const maxPages = 20;
    let lastPageKey = "";
    let pageCount = 0;

    for (let offset = 0; ; offset += limit) {
      if (pageCount >= maxPages) {
        break;
      }
      const url = `/users/${userId}/scores/${type}?mode=${mode}&limit=${limit}&offset=${offset}&include=beatmap`;
      let resp;
      try {
        resp = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      } catch {
        break;
      }

      if (!resp.ok) break;

      let body;
      try {
        body = await resp.json();
      } catch {
        break;
      }

      const items = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
          ? body.items
          : [];
      pageCount += 1;
      if (!items.length) break;

      const pageKey = items
        .map((it) =>
          it?.id != null
            ? String(it.id)
            : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`,
        )
        .join("|");
      if (pageKey && pageKey === lastPageKey) {
        break;
      }
      lastPageKey = pageKey;

      scores.push(...items);
      if (scores.length >= maxTotal) {
        break;
      }
      if (items.length < limit) break;
    }

    const out = scores.slice(0, maxTotal);
    return out;
  }

  /**
   * Identify what type of score section a .play-detail-list belongs to.
   * Uses language-independent structural/positional signals; falls back to
   * heading text for English.
   * @returns {'pinned'|'best'|'firsts'|null}
   */
  function _getSectionType(listEl) {
    // "best" always renders pp-weight elements (language-independent)
    if (
      listEl.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp")
    )
      return "best";

    // show-more-link sibling carries the section key as a BEM class modifier
    const nextSib = listEl.nextElementSibling;
    if (
      nextSib instanceof HTMLElement &&
      nextSib.classList.contains("show-more-link")
    ) {
      if (nextSib.classList.contains("show-more-link--pinned")) return "pinned";
      if (nextSib.classList.contains("show-more-link--best")) return "best";
      if (nextSib.classList.contains("show-more-link--firsts")) return "firsts";
    }

    // position relative to the structurally identified "best" list within
    // top_ranks (osu-web always renders pinned → best → firsts)
    const topRanksPage = listEl.closest('[data-page-id="top_ranks"]');
    if (topRanksPage) {
      const allLists = Array.from(
        topRanksPage.querySelectorAll(".play-detail-list"),
      );
      const bestIdx = allLists.findIndex((el) =>
        el.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp"),
      );
      if (bestIdx >= 0) {
        const idx = allLists.indexOf(listEl);
        if (idx < bestIdx) return "pinned";
        if (idx > bestIdx) return "firsts";
      }
    }

    // heading text fallback (English)
    let n = listEl.previousElementSibling;
    while (n) {
      if (
        n instanceof HTMLElement &&
        n.matches("h3.title.title--page-extra-small")
      ) {
        const text = n.textContent.toLowerCase();
        if (text.includes("pinned")) return "pinned";
        if (text.includes("best performance")) return "best";
        if (text.includes("first place")) return "firsts";
        return null;
      }
      n = n.previousElementSibling;
    }
    return null;
  }

  /**

   * @param {Object} score
   * @returns {number|null}
   */
  function _beatmapMaxComboFromScore(score) {
    const bc = score?.beatmap?.max_combo;
    if (bc != null && Number.isFinite(Number(bc))) return Number(bc);

    const ms = score?.maximum_statistics;
    if (!ms || typeof ms !== "object") return null;

    const rulesetId = Number(score?.ruleset_id);
    if (
      rulesetId === 0 &&
      ms.great != null &&
      Number.isFinite(Number(ms.great))
    ) {
      const great = Number(ms.great);
      if (
        ms.legacy_combo_increase != null &&
        Number.isFinite(Number(ms.legacy_combo_increase))
      ) {
        return great + Number(ms.legacy_combo_increase);
      }
      let n = great;
      for (const key of [
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
      ]) {
        const v = ms[key];
        if (v != null && Number.isFinite(Number(v))) n += Number(v);
      }
      return n;
    }

    if (ms.great != null && Number.isFinite(Number(ms.great))) {
      const g = Number(ms.great);
      const l =
        ms.legacy_combo_increase != null &&
        Number.isFinite(Number(ms.legacy_combo_increase))
          ? Number(ms.legacy_combo_increase)
          : 0;
      return g + l;
    }

    return null;
  }

  /**
   * After attributes API resolves max combo, update the injected "achievedx/maxx" span.
   * @param {HTMLElement} rowEl
   * @param {number} maxCombo
   */
  function _applyApiMaxComboToComboInline(rowEl, maxCombo) {
    const comboSpan = rowEl.querySelector(".oep-combo-inline");
    if (!comboSpan) return;
    const nums = comboSpan.querySelectorAll(".oep-combo-inline__num");
    if (nums.length < 2) return;

    const achEl = nums[0];
    const maxEl = nums[1];
    const achN = Number(achEl.textContent);
    const maxN = Number(maxCombo);
    maxEl.textContent = String(maxCombo);
    const afterMax = maxEl.nextSibling;
    if (
      !(afterMax?.nodeType === Node.TEXT_NODE && afterMax.textContent === "x")
    ) {
      maxEl.after(document.createTextNode("x"));
    }

    const base = "oep-combo-inline__num";
    const fullCombo =
      Number.isFinite(maxN) &&
      maxN > 0 &&
      Number.isFinite(achN) &&
      achN === maxN;
    achEl.className = fullCombo ? `${base} ${base}--full` : base;
    maxEl.className = `${base} ${base}--full`;
  }

  /**
   * Split accuracy (fixed-width column) from combo + stats (fixed-width column) for alignment.
   * Inserts .oep-mid-cols as the first child of .play-detail__score-detail-top-right.
   */
  function injectComboAfterAccuracy(rowEl, score) {
    const midCol = rowEl.querySelector(".play-detail__score-detail-top-right");
    const acc = rowEl.querySelector(".play-detail__accuracy");
    if (!midCol || !acc || acc.closest(".oep-mid-cols")) return;

    const legacy = rowEl.querySelector(".oep-accuracy-combo-row");
    if (legacy) {
      legacy.querySelector(".oep-combo-inline")?.remove();
      const a = legacy.querySelector(".play-detail__accuracy");
      const p = legacy.parentNode;
      if (a && p) {
        p.insertBefore(a, legacy);
        legacy.remove();
      }
    }

    const achieved = score?.max_combo ?? 0;
    const maxCombo = _beatmapMaxComboFromScore(score);
    const maxStr =
      maxCombo != null && Number.isFinite(Number(maxCombo))
        ? String(maxCombo)
        : "0";

    const achN = Number(achieved);
    const maxN =
      maxCombo != null && Number.isFinite(Number(maxCombo))
        ? Number(maxCombo)
        : NaN;
    const fullCombo =
      Number.isFinite(maxN) &&
      maxN > 0 &&
      Number.isFinite(achN) &&
      achN === maxN;

    const achNumClass = (base) => (fullCombo ? `${base} ${base}--full` : base);
    const maxNumClass = (base) =>
      maxCombo != null && Number.isFinite(Number(maxCombo))
        ? `${base} ${base}--full`
        : base;

    const comboParts = [
      el(
        "span",
        { class: achNumClass("oep-combo-inline__num") },
        String(achieved),
      ),
      "x/",
      el("span", { class: maxNumClass("oep-combo-inline__num") }, maxStr),
      "x",
    ];
    const comboSpan = el("span", { class: "oep-combo-inline" }, ...comboParts);

    const accCol = el("div", { class: "oep-accuracy-col" });
    const comboStatsCol = el("div", { class: "oep-combo-stats-col" });
    const midCols = el("div", { class: "oep-mid-cols" });

    accCol.appendChild(acc);
    comboStatsCol.appendChild(comboSpan);
    midCols.appendChild(accCol);
    midCols.appendChild(comboStatsCol);
    midCol.insertBefore(midCols, midCol.firstChild);
  }

  /**
   * osu! API v2 scores may use lazer keys (great, ok, meh, miss) or legacy
   * (count_300, count_100, count_50, count_miss, count_geki, count_katu).
   * @param {Object|null|undefined} statistics
   * @returns {{ n300: number, n100: number, n50: number, nMiss: number }}
   */
  function normalizeScoreStatistics(statistics) {
    if (!statistics || typeof statistics !== "object") {
      return { n300: 0, n100: 0, n50: 0, nMiss: 0 };
    }
    const hasLazer =
      statistics.great != null ||
      statistics.perfect != null ||
      statistics.ok != null ||
      statistics.meh != null ||
      statistics.miss != null;
    if (hasLazer) {
      return {
        n300: Number(statistics.great ?? 0) + Number(statistics.perfect ?? 0),
        n100: Number(statistics.ok ?? 0),
        n50: Number(statistics.meh ?? 0),
        nMiss: Number(statistics.miss ?? 0),
      };
    }
    const c300 = Number(statistics.count_300 ?? 0);
    const cGeki = Number(statistics.count_geki ?? 0);
    return {
      n300: c300 + cGeki,
      n100: Number(statistics.count_100 ?? 0),
      n50: Number(statistics.count_50 ?? 0),
      nMiss: Number(statistics.count_miss ?? 0),
    };
  }

  /** Build a stats row element from a score's statistics object. */
  function buildStatsRow(statistics) {
    const { n300, n100, n50, nMiss } = normalizeScoreStatistics(statistics);

    const sep = () => el("span", { class: "oep-score-stats__sep" }, "/");

    return el(
      "div",
      { class: "oep-score-stats" },
      el("span", { class: "oep-score-stats__val--300" }, String(n300)),
      sep(),
      el("span", { class: "oep-score-stats__val--100" }, String(n100)),
      sep(),
      el("span", { class: "oep-score-stats__val--50" }, String(n50)),
      sep(),
      el("span", { class: "oep-score-stats__val--miss" }, String(nMiss)),
    );
  }

  /**
   * Inject a stats row into a single .play-detail element.
   * The row is appended to the middle column (.play-detail__score-detail-top-right)
   * so it appears below the accuracy/combo figures.
   * @param {Element} rowEl  .play-detail element
   * @param {Object} score  full score object from the API (needs include=beatmap for map max combo)
   */
  function injectStatsRow(rowEl, score) {
    if (rowEl.hasAttribute(SCORE_STATS_ATTR)) return;

    const midCol = rowEl.querySelector(".play-detail__score-detail-top-right");
    if (!midCol) return;

    injectComboAfterAccuracy(rowEl, score);

    const statsRow = buildStatsRow(score?.statistics);
    const comboStatsCol = rowEl.querySelector(".oep-combo-stats-col");
    (comboStatsCol || midCol).appendChild(statsRow);
    rowEl.setAttribute(SCORE_STATS_ATTR, "1");
  }

  function _revertAccuracyComboWrap(rowEl) {
    const midCols = rowEl.querySelector(".oep-mid-cols");
    if (midCols) {
      const aw = rowEl.querySelector(".play-detail__accuracy-and-weighted-pp");
      const acc = midCols.querySelector(".play-detail__accuracy");
      if (acc && aw) aw.insertBefore(acc, aw.firstChild);
      midCols.querySelector(".oep-combo-inline")?.remove();
      midCols.remove();
      return;
    }
    const wrap = rowEl.querySelector(".oep-accuracy-combo-row");
    if (!wrap) {
      rowEl.querySelector(".oep-combo-inline")?.remove();
      return;
    }
    const acc = wrap.querySelector(".play-detail__accuracy");
    const parent = wrap.parentNode;
    if (acc && parent) parent.insertBefore(acc, wrap);
    wrap.remove();
  }

  /** Remove all injected stats rows from a list element. */
  function revertStatsRows(listEl) {
    listEl
      .querySelectorAll(`.play-detail[${SCORE_STATS_ATTR}]`)
      .forEach((rowEl) => {
        rowEl.removeAttribute(SCORE_STATS_ATTR);
        rowEl.querySelector(".oep-score-stats")?.remove();
        _revertAccuracyComboWrap(rowEl);
      });
  }

  function applyHideWeightedPp(listEl) {
    listEl.querySelectorAll(".play-detail").forEach((rowEl) => {
      const col = rowEl.querySelector(".oep-pp-col");
      if (col) {
        const ppEl = col.querySelector(".play-detail__pp");
        if (ppEl && col.parentNode) {
          col.parentNode.insertBefore(ppEl, col);
        }
        col.remove();
      }
      rowEl.querySelector(".oep-weighted-pp-label")?.remove();

      rowEl
        .querySelector(".play-detail__weighted-pp")
        ?.classList.add("oep-hidden");
      rowEl
        .querySelector(".play-detail__pp-weight")
        ?.classList.add("oep-hidden");
    });
  }

  // Modded SR: IO + POST /beatmaps/{id}/attributes; row data from title href + mod icons
  const MODDED_SR_ID = IDS.MODDED_STAR_RATING;
  const MODDED_SR_ATTR = "data-oep-sr"; // '' pending, 1 done

  const DIFFICULTY_MODS = new Set([
    "DT",
    "NC",
    "HT",
    "DC",
    "HR",
    "EZ",
    "FL",
    "DA",
    "AC",
    "WU",
    "WD",
    "DF",
    "TC",
  ]);

  /** @type {Map<string, { sr: number|null, maxCombo: number|null }>} */
  const _attrsSessionCache = new Map();

  const BEATMAP_ATTRS_CACHE_GM_KEY = "oep.beatmapAttributesCache.v1";
  const BEATMAP_ATTRS_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const BEATMAP_ATTRS_CACHE_MAX_ENTRIES = 600;

  const RANKED_STATUS_RANKED = 1;
  const RANKED_STATUS_LOVED = 4;

  function _isCacheableRankedStatus(ranked) {
    return (
      ranked === undefined ||
      ranked === RANKED_STATUS_RANKED ||
      ranked === RANKED_STATUS_LOVED
    );
  }

  /** @type {Map<string|number, Promise<number|null>>} */
  const _beatmapMaxComboInFlight = new Map();

  /**
   * Fetch max_combo for a beatmap via GET /api/v2/beatmaps/{id} when the
   * attributes endpoint returns 0. Results are not cached persistently since
   * this is only called as a fallback for a known API bug.
   */
  function _fetchBeatmapMaxCombo(beatmapId) {
    if (_beatmapMaxComboInFlight.has(beatmapId)) {
      return _beatmapMaxComboInFlight.get(beatmapId);
    }
    const p = OsuExpertPlus.api
      .getBeatmap(beatmapId)
      .then((data) => {
        const mc = data?.max_combo;
        return mc != null && Number.isFinite(Number(mc)) && Number(mc) > 0
          ? Number(mc)
          : null;
      })
      .catch(() => null)
      .finally(() => _beatmapMaxComboInFlight.delete(beatmapId));
    _beatmapMaxComboInFlight.set(beatmapId, p);
    return p;
  }

  function _readBeatmapAttrsGmStore() {
    try {
      const raw = GM_getValue(BEATMAP_ATTRS_CACHE_GM_KEY, "");
      if (raw == null || raw === "") return {};
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      return o && typeof o === "object" ? o : {};
    } catch (_) {
      return {};
    }
  }

  function _writeBeatmapAttrsGmStore(store) {
    try {
      GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function _pruneBeatmapAttrsGmStore(store, now) {
    for (const k of Object.keys(store)) {
      const ent = store[k];
      const t = Number(ent?.t);
      if (!Number.isFinite(t) || now - t > BEATMAP_ATTRS_CACHE_TTL_MS) {
        delete store[k];
      } else if (ent.maxCombo === 0) {
        delete store[k];
      }
    }
    const keys = Object.keys(store);
    if (keys.length <= BEATMAP_ATTRS_CACHE_MAX_ENTRIES) return;
    keys.sort(
      (a, b) => (Number(store[a]?.t) || 0) - (Number(store[b]?.t) || 0),
    );
    for (let i = 0; i < keys.length - BEATMAP_ATTRS_CACHE_MAX_ENTRIES; i++) {
      delete store[keys[i]];
    }
  }

  /**
   * @param {string} key
   * @returns {{ sr: number|null, maxCombo: number|null }|undefined}
   */
  function _beatmapAttrsPersistentGet(key) {
    const store = _readBeatmapAttrsGmStore();
    const ent = store[key];
    const t = Number(ent?.t);
    if (
      !ent ||
      typeof ent !== "object" ||
      !Number.isFinite(t) ||
      Date.now() - t > BEATMAP_ATTRS_CACHE_TTL_MS
    ) {
      if (key in store) {
        delete store[key];
        _writeBeatmapAttrsGmStore(store);
      }
      return undefined;
    }
    const maxCombo =
      ent.maxCombo != null && Number.isFinite(Number(ent.maxCombo))
        ? Number(ent.maxCombo)
        : null;
    if (maxCombo === 0) {
      delete store[key];
      _writeBeatmapAttrsGmStore(store);
      return undefined;
    }
    return {
      sr:
        ent.sr != null && Number.isFinite(Number(ent.sr))
          ? Number(ent.sr)
          : null,
      maxCombo,
    };
  }

  /**
   * @param {string} key
   * @param {{ sr: number|null, maxCombo: number|null }} packed
   */
  function _beatmapAttrsPersistentSet(key, packed) {
    const store = _readBeatmapAttrsGmStore();
    const now = Date.now();
    _pruneBeatmapAttrsGmStore(store, now);
    store[key] = {
      t: now,
      sr: packed.sr,
      maxCombo: packed.maxCombo,
    };
    _writeBeatmapAttrsGmStore(store);
  }

  function _getCachedAttrs(key) {
    return _attrsSessionCache.get(key);
  }

  function _diffMods(acronyms) {
    return acronyms
      .map((a) => a.toUpperCase())
      .filter((a) => DIFFICULTY_MODS.has(a))
      .sort();
  }

  function _srCacheKey(beatmapId, diffMods, ruleset) {
    return `${beatmapId}:${ruleset}:${diffMods.join("+") || "NM"}`;
  }

  function _extractRowData(rowEl) {
    const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
    const m = href.match(/#(\w+)\/(\d+)/);
    return {
      beatmapId: m?.[2] ?? null,
      ruleset: m?.[1] ?? "osu",
      mods: Array.from(rowEl.querySelectorAll(".mod__icon[data-acronym]")).map(
        (e) => e.dataset.acronym,
      ),
    };
  }

  /** @type {Map<string, Promise<{ sr: number|null, maxCombo: number|null }>>} */
  const _attrsInFlight = new Map();

  /**
   * @param {string|number} beatmapId
   * @param {string[]} diffMods
   * @param {string} ruleset
   * @param {{ ranked?: number }} [opts]
   * @returns {Promise<{ key: string, sr: number|null, maxCombo: number|null }>}
   */
  async function _fetchBeatmapAttributesCached(
    beatmapId,
    diffMods,
    ruleset,
    opts,
  ) {
    const key = _srCacheKey(beatmapId, diffMods, ruleset);
    const hit = _getCachedAttrs(key);
    if (hit !== undefined) return { key, ...hit };

    const persisted = _beatmapAttrsPersistentGet(key);
    if (persisted !== undefined) {
      _attrsSessionCache.set(key, persisted);
      return { key, ...persisted };
    }

    const ranked = opts?.ranked;

    if (!_attrsInFlight.has(key)) {
      const p = OsuExpertPlus.api
        .postBeatmapAttributes(beatmapId, diffMods, ruleset)
        .then(async (data) => {
          const attrs = data?.attributes ?? {};
          const sr =
            attrs.star_rating != null &&
            Number.isFinite(Number(attrs.star_rating))
              ? Number(attrs.star_rating)
              : null;
          let maxCombo =
            attrs.max_combo != null && Number.isFinite(Number(attrs.max_combo))
              ? Number(attrs.max_combo)
              : null;

          if (maxCombo === 0) {
            const fallback = await _fetchBeatmapMaxCombo(beatmapId);
            maxCombo = fallback != null ? fallback : null;
          }

          const packed = { sr, maxCombo };
          _attrsSessionCache.set(key, packed);
          if (_isCacheableRankedStatus(ranked)) {
            _beatmapAttrsPersistentSet(key, packed);
          }
          return packed;
        })
        .catch(() => ({ sr: null, maxCombo: null }))
        .finally(() => _attrsInFlight.delete(key));
      _attrsInFlight.set(key, p);
    }

    const packed = await _attrsInFlight.get(key);
    return { key, ...packed };
  }

  async function _fetchAndApplySr(rowEl) {
    if (rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "");

    const { beatmapId, ruleset, mods } = _extractRowData(rowEl);
    if (!beatmapId) return;

    const diffMods = _diffMods(mods);
    const { sr, maxCombo } = await _fetchBeatmapAttributesCached(
      beatmapId,
      diffMods,
      ruleset,
    );

    if (!rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "1");

    if (maxCombo != null) _applyApiMaxComboToComboInline(rowEl, maxCombo);

    if (sr === null || sr === undefined) return;

    const beatmapSpan = rowEl.querySelector(".play-detail__beatmap");
    if (!beatmapSpan || rowEl.querySelector(".oep-sr-badge")) return;

    const parent = beatmapSpan.parentNode;
    if (!parent) return;

    const badge = el(
      "span",
      { class: "oep-sr-badge" },
      el(
        "span",
        { class: "oep-sr-badge__inner" },
        el("i", {
          class: "fas fa-star oep-sr-badge__icon",
          "aria-hidden": "true",
        }),
        el("span", { class: "oep-sr-badge__val" }, sr.toFixed(2)),
      ),
    );
    badge.style.backgroundColor =
      OsuExpertPlus.difficultyColours.getDiffColour(sr);
    badge.style.color = OsuExpertPlus.difficultyColours.getDiffTextColour(sr);
    parent.insertBefore(badge, beatmapSpan);
  }

  let _srObserver = null;
  let _srDomObserver = null;

  function _observeRow(rowEl) {
    if (!_srObserver || rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    _srObserver.observe(rowEl);
  }

  function initSrObserver() {
    teardownSrObserver();
    _srObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          _srObserver.unobserve(entry.target);
          _fetchAndApplySr(entry.target);
        }
      },
      { rootMargin: "300px 0px" },
    );

    document.querySelectorAll(".play-detail").forEach(_observeRow);

    _srDomObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(".play-detail")) {
            _observeRow(node);
          } else {
            if (!node.querySelector(".play-detail")) continue;
            node.querySelectorAll(".play-detail").forEach(_observeRow);
          }
        }
      }
    });
    _srDomObserver.observe(document.body, { childList: true, subtree: true });
  }

  function teardownSrObserver() {
    _srObserver?.disconnect();
    _srObserver = null;
    _srDomObserver?.disconnect();
    _srDomObserver = null;
  }

  function revertModdedStarRatings() {
    teardownSrObserver();
    document
      .querySelectorAll(`.play-detail[${MODDED_SR_ATTR}]`)
      .forEach((rowEl) => {
        rowEl.removeAttribute(MODDED_SR_ATTR);
        rowEl.querySelector(".oep-sr-badge")?.remove();
      });
  }

  function processElements(elements, scores) {
    elements.forEach((rowEl, i) => {
      const score = scores[i];
      if (!score) return;
      injectStatsRow(rowEl, score);
    });
  }

  const SCORE_PLACE_NUMBER_ID = IDS.SCORE_CARD_PLACE_NUMBER;
  const SCORE_PLACE_CLASS = "oep-score-place";
  const SCORE_TITLE_ROW_CLASS = "oep-score-title-row";
  const SCORE_PLACE_NUMBER_STYLE_ID = "osu-expertplus-score-place-number";
  const SCORE_PLACE_NUMBER_CSS = `
    .${SCORE_TITLE_ROW_CLASS} {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: flex-start;
      gap: 0.45em 0.55em;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .${SCORE_TITLE_ROW_CLASS} .play-detail__title {
      flex: 1 1 auto;
      min-width: 0;
    }
    .${SCORE_TITLE_ROW_CLASS} .${SCORE_PLACE_CLASS} {
      align-self: flex-start;
      box-sizing: border-box;
      color: hsl(220, 10%, 68%);
      display: block;
      flex-shrink: 0;
      font-family: inherit;
      font-size: 14px;
      font-weight: inherit;
      letter-spacing: inherit;
      line-height: normal;
      margin: 0;
      opacity: 0.78;
      padding: 0;
      white-space: nowrap;
    }
  `;
  const scorePlaceNumberStyle = manageStyle(
    SCORE_PLACE_NUMBER_STYLE_ID,
    SCORE_PLACE_NUMBER_CSS,
  );

  function applyPlaceNumbers(listEl) {
    const rows = Array.from(listEl.querySelectorAll(".play-detail"));
    rows.forEach((rowEl, i) => {
      const detail = rowEl.querySelector(".play-detail__detail");
      if (!(detail instanceof HTMLElement)) return;

      const titleRow = detail.querySelector(
        `:scope > .${SCORE_TITLE_ROW_CLASS}`,
      );
      const placeInRow = titleRow?.querySelector(`.${SCORE_PLACE_CLASS}`);
      const titleInRow = titleRow?.querySelector("a.play-detail__title");

      if (
        titleRow &&
        placeInRow &&
        titleInRow &&
        titleInRow.parentElement === titleRow
      ) {
        const expected = `#${i + 1}`;
        if (placeInRow.textContent !== expected) {
          placeInRow.textContent = expected;
        }
        return;
      }

      rowEl
        .querySelectorAll(`.${SCORE_PLACE_CLASS}`)
        .forEach((n) => n.remove());
      detail
        .querySelectorAll(`:scope > .${SCORE_TITLE_ROW_CLASS}`)
        .forEach((tr) => {
          const t = tr.querySelector("a.play-detail__title");
          if (t instanceof HTMLElement && tr.parentElement === detail) {
            detail.insertBefore(t, tr);
          }
          tr.remove();
        });

      const title = detail.querySelector(":scope > a.play-detail__title");
      if (!(title instanceof HTMLElement)) return;

      const row = el("div", { class: SCORE_TITLE_ROW_CLASS });
      const place = el("div", { class: SCORE_PLACE_CLASS }, `#${i + 1}`);
      detail.insertBefore(row, title);
      row.appendChild(place);
      row.appendChild(title);
    });
  }

  function revertPlaceNumbers(listEl) {
    listEl.querySelectorAll(`.${SCORE_TITLE_ROW_CLASS}`).forEach((wrap) => {
      const detail = wrap.parentElement;
      const title = wrap.querySelector("a.play-detail__title");
      if (detail instanceof HTMLElement && title instanceof HTMLElement) {
        detail.insertBefore(title, wrap);
      }
      wrap.remove();
    });
    listEl.querySelectorAll(`.${SCORE_PLACE_CLASS}`).forEach((n) => n.remove());
  }

  const SCORE_SECTION_TYPES = ["pinned", "best", "firsts"];
  const SCORE_PLACE_SECTION_TYPE = "best";

  function setScoreListLayoutClass(sections, enabled) {
    sections.forEach(({ listEl }) => {
      listEl.classList.toggle(SCORE_LIST_LAYOUT_CLASS, enabled);
    });
  }

  function syncScoreListPpDecimalsWidthClass(listEl) {
    listEl.classList.toggle(
      SCORE_LIST_PP_DECIMALS_CLASS,
      settings.isEnabled(SCORE_PP_DECIMALS_ID),
    );
  }

  // Mark lists we enhance so stale-element waits target our DOM until Inertia replaces it.
  const PLAY_DETAIL_LIST_PROCESSED_ATTR = "data-oep-processed";
  const PLAY_DETAIL_LIST_STALE_SEL = `.play-detail-list[${PLAY_DETAIL_LIST_PROCESSED_ATTR}]`;

  /**
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<function>}  Returns a cleanup fn.
   */
  async function initScoreFeatures(userId, mode) {
    const cleanupFns = [];

    playDetailStyle.inject();
    cleanupFns.push(playDetailStyle.remove);

    await waitForStaleElementToLeave(PLAY_DETAIL_LIST_STALE_SEL);

    try {
      await waitForElement(".play-detail-list .play-detail", 15000);
    } catch {
      return () => {};
    }

    const scoreSections = Array.from(
      document.querySelectorAll(".play-detail-list"),
    )
      .map((listEl) => ({ listEl, type: _getSectionType(listEl) }))
      .filter((s) => SCORE_SECTION_TYPES.includes(s.type));

    if (!scoreSections.length) {
      return () => {};
    }

    scoreSections.forEach(({ listEl }) =>
      listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1"),
    );

    setScoreListLayoutClass(
      scoreSections,
      settings.isEnabled(SCORE_HIT_STATISTICS_ID),
    );
    scoreSections.forEach(({ listEl }) =>
      syncScoreListPpDecimalsWidthClass(listEl),
    );

    scoreSections.forEach(({ listEl, type }) => {
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      applyHideWeightedPp(listEl);
      if (settings.isEnabled(SCORE_PLACE_NUMBER_ID)) {
        if (type === SCORE_PLACE_SECTION_TYPE) {
          applyPlaceNumbers(listEl);
        } else {
          revertPlaceNumbers(listEl);
        }
      } else {
        revertPlaceNumbers(listEl);
      }
    });
    if (
      settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
      scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)
    ) {
      scorePlaceNumberStyle.inject();
    }

    if (settings.isEnabled(MODDED_SR_ID)) {
      initSrObserver();
      cleanupFns.push(() => teardownSrObserver());
    }

    const scoresMap = new Map();

    async function _loadAndApplyStats(section) {
      const { listEl, type } = section;
      if (!scoresMap.has(type)) {
        scoresMap.set(type, await fetchScores(userId, mode, type));
      }
      processElements(
        Array.from(listEl.querySelectorAll(".play-detail")),
        scoresMap.get(type),
      );
    }

    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      await Promise.all(scoreSections.map(_loadAndApplyStats));
      // Re-apply in case a locale re-render overwrote decimals during the await.
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
        scoreSections.forEach(({ listEl }) => applyPpDecimals(listEl));
      }
    }

    // Per-section MutationObserver for "load more" rows.
    scoreSections.forEach((section) => {
      const { listEl, type } = section;
      let sectionObsBusy = false;

      const obs = new MutationObserver((mutations) => {
        if (sectionObsBusy) return;

        const hasNewRows = mutations.some((m) => {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (
              node.matches(".play-detail") ||
              node.querySelector(".play-detail")
            )
              return true;
          }
          return false;
        });

        // Detect when the site re-renders (e.g. after async locale load) and
        // patches pp text nodes back to integer values via characterData mutations,
        // bypassing the childList check above.
        const hasPpDecimalOverwrite =
          !hasNewRows &&
          settings.isEnabled(SCORE_PP_DECIMALS_ID) &&
          mutations.some((m) => {
            if (m.type !== "characterData") return false;
            const span = m.target.parentElement;
            if (!(span instanceof HTMLSpanElement)) return false;
            const titleAttr = span.getAttribute("title");
            if (!titleAttr || !span.parentElement?.matches(".play-detail__pp"))
              return false;
            const n = parseLocaleNumber(titleAttr);
            if (!Number.isFinite(n)) return false;
            return m.target.nodeValue !== formatDecimalPp(n) + "\u200A";
          });

        if (!hasNewRows && !hasPpDecimalOverwrite) return;

        sectionObsBusy = true;
        try {
          if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
          applyHideWeightedPp(listEl);
          if (
            settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
            type === SCORE_PLACE_SECTION_TYPE
          ) {
            applyPlaceNumbers(listEl);
          }

          const allEls = Array.from(listEl.querySelectorAll(".play-detail"));
          if (
            settings.isEnabled(SCORE_HIT_STATISTICS_ID) &&
            scoresMap.has(type)
          ) {
            const scores = scoresMap.get(type);
            allEls.forEach((rowEl, i) => {
              const needsReinjection =
                !rowEl.hasAttribute(SCORE_STATS_ATTR) ||
                !rowEl.querySelector(".oep-score-stats");
              if (!needsReinjection) return;
              rowEl.removeAttribute(SCORE_STATS_ATTR);
              const score = scores[i];
              if (!score) return;
              injectStatsRow(rowEl, score);
            });
          }
        } finally {
          sectionObsBusy = false;
        }
      });

      obs.observe(listEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      cleanupFns.push(() => obs.disconnect());

      const classObs = new MutationObserver(() => {
        if (
          settings.isEnabled(SCORE_HIT_STATISTICS_ID) &&
          !listEl.classList.contains(SCORE_LIST_LAYOUT_CLASS)
        ) {
          listEl.classList.add(SCORE_LIST_LAYOUT_CLASS);
          syncScoreListPpDecimalsWidthClass(listEl);
        }
      });
      classObs.observe(listEl, {
        attributes: true,
        attributeFilter: ["class"],
      });
      cleanupFns.push(() => classObs.disconnect());
    });

    cleanupFns.push(
      settings.onChange(SCORE_PP_DECIMALS_ID, (enabled) => {
        scoreSections.forEach(({ listEl }) => {
          syncScoreListPpDecimalsWidthClass(listEl);
          enabled ? applyPpDecimals(listEl) : revertPpDecimals(listEl);
        });
      }),
      settings.onChange(SCORE_HIT_STATISTICS_ID, async (enabled) => {
        if (enabled) {
          setScoreListLayoutClass(scoreSections, true);
          scoreSections.forEach(({ listEl }) =>
            syncScoreListPpDecimalsWidthClass(listEl),
          );
          await Promise.all(scoreSections.map(_loadAndApplyStats));
        } else {
          scoreSections.forEach(({ listEl }) => revertStatsRows(listEl));
          setScoreListLayoutClass(scoreSections, false);
          scoreSections.forEach(({ listEl }) =>
            listEl.classList.remove(SCORE_LIST_PP_DECIMALS_CLASS),
          );
        }
      }),
      settings.onChange(MODDED_SR_ID, (enabled) => {
        if (enabled) initSrObserver();
        else revertModdedStarRatings();
      }),
      settings.onChange(SCORE_PLACE_NUMBER_ID, (enabled) => {
        if (enabled) {
          if (scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)) {
            scorePlaceNumberStyle.inject();
          }
          scoreSections.forEach(({ listEl, type }) => {
            if (type === SCORE_PLACE_SECTION_TYPE) {
              applyPlaceNumbers(listEl);
            } else {
              revertPlaceNumbers(listEl);
            }
          });
        } else {
          scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl));
          scorePlaceNumberStyle.remove();
        }
      }),
    );

    cleanupFns.push(() => {
      scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl));
      scorePlaceNumberStyle.remove();
    });

    return () => {
      setScoreListLayoutClass(scoreSections, false);
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    };
  }

  function getUserIdFromUrl() {
    const m = location.pathname.match(/^\/users\/(\d+)/);
    return m ? m[1] : null;
  }

  /** @returns {Object|null} */
  function parseProfileInitialData() {
    try {
      const nodes = document.querySelectorAll(".js-react[data-initial-data]");
      for (const node of nodes) {
        const data = JSON.parse(node.dataset.initialData);
        if (data?.user?.id != null) return data;
      }
    } catch (_) {}
    return null;
  }

  /** Numeric id for API calls; works for /users/&lt;username&gt; via embedded JSON. */
  function getProfileUserId() {
    const fromUrl = getUserIdFromUrl();
    if (fromUrl) return fromUrl;
    const data = parseProfileInitialData();
    return data?.user?.id != null ? String(data.user.id) : null;
  }

  function getCurrentMode() {
    const data = parseProfileInitialData();
    if (data?.current_mode) return data.current_mode;

    const m = location.search.match(/[?&]mode=([^&]+)/);
    return m ? m[1] : "osu";
  }

  /** Numeric id of the currently logged-in account from nav header links. */
  function getCurrentUserIdFromHeader() {
    const link = document.querySelector(
      "a.u-current-user-avatar[href*='/users/'], a.u-current-user-cover[href*='/users/']",
    );
    if (!(link instanceof HTMLAnchorElement)) return null;
    const href = link.getAttribute("href") || "";
    const m = href.match(/\/users\/(\d+)(?:\/|$)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? String(n) : null;
  }

  const RECENT_FAILS_WRAP_CLASS = "oep-recent-scores-with-fails";
  const RECENT_FAILS_HEADER_CLASS = "oep-recent-fails-header";
  const RECENT_FAILS_EMPTY_MSG = "No scores found.";
  const RECENT_FAILS_EMPTY_FILTERED_MSG =
    "No passing scores in this list (fails hidden).";

  /** @type {WeakMap<HTMLElement, Object[]>} */
  const recentScoresFullCache = new WeakMap();

  function apiScoreIsFail(score) {
    return Boolean(
      score && typeof score === "object" && score.passed === false,
    );
  }

  function filterScoresForRecentDisplay(scores, showFails) {
    if (showFails) return scores.slice();
    return scores.filter((s) => !apiScoreIsFail(s));
  }

  function findHistoricalPage() {
    return document.querySelector(
      'div.js-sortable--page[data-page-id="historical"]',
    );
  }

  /**
   * osu-web always renders Recent plays as the first play-detail-list inside
   * the historical section regardless of UI language. Matching by heading text
   * fails on non-English interfaces, so use position instead.
   */
  function findRecentPlaysListRoot() {
    const page = findHistoricalPage();
    if (!page) return null;
    const lists = Array.from(page.querySelectorAll(".play-detail-list")).filter(
      (el) => el instanceof HTMLElement,
    );
    return lists[0] ?? null;
  }

  /**
   * osu-web renders "Most Watched Replays" as the second play-detail-list in
   * historical. Language-independent positional lookup.
   */
  function findMostWatchedReplaysListRoot() {
    const page = findHistoricalPage();
    if (!page) return null;
    const lists = Array.from(page.querySelectorAll(".play-detail-list")).filter(
      (el) => el instanceof HTMLElement,
    );
    return lists[1] ?? null;
  }

  function removeOfficialRecentPlaysSection(listRoot) {
    if (!(listRoot instanceof HTMLElement)) return;
    // Remove the h3 heading immediately before the list regardless of language.
    const prev = listRoot.previousElementSibling;
    if (
      prev instanceof HTMLElement &&
      prev.matches("h3.title.title--page-extra-small")
    ) {
      prev.remove();
    }
    listRoot.remove();
  }

  function rulesetIdToMode(rulesetId) {
    const map = { 0: "osu", 1: "taiko", 2: "fruits", 3: "mania" };
    return map[rulesetId] ?? "osu";
  }

  function scoreRankForApiScore(score) {
    const r = score?.rank;
    if (typeof r === "string") return r;
    if (r && typeof r === "object" && typeof r.name === "string") return r.name;
    return score?.passed === false ? "F" : "D";
  }

  function beatmapHrefFromScore(score) {
    const bm = score?.beatmap;
    if (!bm?.id) return "#";
    const setId = score.beatmapset?.id;
    const mode = rulesetIdToMode(score.ruleset_id);
    if (setId != null)
      return `https://osu.ppy.sh/beatmapsets/${setId}#${mode}/${bm.id}`;
    return `https://osu.ppy.sh/beatmaps/${bm.id}`;
  }

  function formatAccuracyPercent(score) {
    let n = score?.accuracy != null ? Number(score.accuracy) : NaN;
    if (!Number.isFinite(n)) return "—";
    if (n <= 1) n *= 100;
    return `${n.toFixed(2)}%`;
  }

  /**
   * @param {unknown[]} modsList  API mod objects or strings
   * @returns {string[]}
   */
  function modsAcronymsFromApiMods(modsList) {
    const out = [];
    for (const m of modsList || []) {
      const ac = typeof m === "string" ? m : m?.acronym;
      if (ac) out.push(String(ac));
    }
    return out;
  }

  /**
   * When score.beatmap lacks max_combo (typical for recent scores), fill the
   * injected "(achieved / max)" from POST /beatmaps/{id}/attributes. One
   * request per unique (beatmap, difficulty-affecting mods); shared cache
   * with modded star rating.
   * @param {HTMLElement[]} rows
   * @param {Object[]} scores  same length and order as rows
   */
  async function enrichPlayDetailRowsMaxComboFromAttributes(rows, scores) {
    /** @type {Map<string, { beatmapId: string|number, diffMods: string[], ruleset: string, ranked?: number }>} */
    const unique = new Map();

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (_beatmapMaxComboFromScore(score) != null) continue;
      const bmId = score?.beatmap?.id;
      if (bmId == null) continue;
      const diffMods = _diffMods(modsAcronymsFromApiMods(score.mods));
      const ruleset = rulesetIdToMode(score.ruleset_id);
      const key = _srCacheKey(bmId, diffMods, ruleset);
      if (!unique.has(key)) {
        const ranked = score?.beatmap?.ranked;
        unique.set(key, { beatmapId: bmId, diffMods, ruleset, ranked });
      }
    }

    await Promise.all(
      [...unique.values()].map(({ beatmapId, diffMods, ruleset, ranked }) =>
        _fetchBeatmapAttributesCached(beatmapId, diffMods, ruleset, {
          ranked,
        }),
      ),
    );

    for (let i = 0; i < rows.length; i++) {
      const score = scores[i];
      if (_beatmapMaxComboFromScore(score) != null) continue;
      const bmId = score?.beatmap?.id;
      if (bmId == null) continue;
      const diffMods = _diffMods(modsAcronymsFromApiMods(score.mods));
      const ruleset = rulesetIdToMode(score.ruleset_id);
      const key = _srCacheKey(bmId, diffMods, ruleset);
      const attrs = _getCachedAttrs(key);
      const maxCombo = attrs?.maxCombo;
      if (maxCombo != null) _applyApiMaxComboToComboInline(rows[i], maxCombo);
    }
  }

  function isInsideOepRecentFailsWrap(node) {
    return (
      node instanceof Element &&
      Boolean(node.closest(`.${RECENT_FAILS_WRAP_CLASS}`))
    );
  }

  /**
   * A real &lt;Mod&gt; node from osu’s React tree (sprites + layout match the site).
   * Prefers the official Recent plays list on Historical, then Top ranks, then any list.
   * @returns {HTMLElement|null}
   */
  function findOsuModTemplateNode() {
    const fromList = (listEl) => {
      if (!listEl || isInsideOepRecentFailsWrap(listEl)) return null;
      return listEl.querySelector(".play-detail .mods .mod");
    };

    let m = fromList(findRecentPlaysListRoot());
    if (m instanceof HTMLElement) return m;

    const top = document.querySelector('[data-page-id="top_ranks"]');
    if (top && !isInsideOepRecentFailsWrap(top)) {
      for (const pl of top.querySelectorAll(".play-detail-list")) {
        m = fromList(pl);
        if (m instanceof HTMLElement) return m;
      }
    }

    for (const pl of document.querySelectorAll(".play-detail-list")) {
      if (isInsideOepRecentFailsWrap(pl)) continue;
      m = fromList(pl);
      if (m instanceof HTMLElement) return m;
    }
    return null;
  }

  /**
   * @param {number} maxWaitMs
   * @returns {Promise<HTMLElement|null>}
   */
  function waitForOsuModTemplate(maxWaitMs = 2500) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const t = findOsuModTemplateNode();
        if (t instanceof HTMLElement) return resolve(t);
        if (Date.now() - start >= maxWaitMs) return resolve(null);
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  /**
   * @param {HTMLElement} modRoot  cloned .mod from osu
   * @param {string} acronym
   */
  function patchClonedModForAcronym(modRoot, acronym) {
    stripOepModAcronymFromClonedMod(modRoot);
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const icon = modRoot.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const typeClass = modTypeClassForAcronym(acronym);
    const parts = modRoot.className.split(/\s+/).filter(Boolean);
    const rest = parts.filter((c) => !c.startsWith("mod--type-"));
    modRoot.className = [...rest, typeClass].join(" ");
    modRoot.querySelector(".mod__extender")?.remove();
    modRoot.querySelector(".mod__customised-indicator")?.remove();
    modRoot.removeAttribute("title");
  }

  /**
   * @param {unknown[]} modsList  API mod objects or strings
   * @param {HTMLElement|null} templateModEl  osu .mod element to clone (from best/recent rows)
   */
  function buildApiScoreModsInner(modsList, templateModEl) {
    const modsInner = el("div", { class: "mods" });
    for (const mod of modsList || []) {
      const ac = typeof mod === "string" ? mod : mod?.acronym;
      if (!ac) continue;
      if (templateModEl instanceof HTMLElement) {
        const cloned = /** @type {HTMLElement} */ (
          templateModEl.cloneNode(true)
        );
        patchClonedModForAcronym(cloned, ac);
        modsInner.appendChild(cloned);
      } else {
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        modsInner.appendChild(
          el(
            "div",
            { class: `mod ${modTypeClassForAcronym(ac)}` },
            el("div", {
              class: `mod__icon mod__icon--${safe}`,
              "data-acronym": ac,
            }),
          ),
        );
      }
    }
    return modsInner;
  }

  /**
   * @param {Object} score  osu API v2 score object
   * @param {HTMLElement|null} [modTemplateEl]
   * @returns {HTMLElement}
   */
  function buildPlayDetailRowFromApiScore(score, modTemplateEl = null) {
    const bn = "play-detail";
    const bms = score.beatmapset || {};
    const bm = score.beatmap || {};
    const rank = scoreRankForApiScore(score);
    const rankClass = `score-rank score-rank--full score-rank--${rank}`;

    const titleText = bms.title || "Unknown beatmap";
    const artistText = bms.artist || "—";

    const modsEl = el("div", { class: `${bn}__mods` });
    modsEl.appendChild(buildApiScoreModsInner(score.mods, modTemplateEl));
    if (settings.isEnabled(IDS.MOD_ICONS_AS_ACRONYMS)) {
      applyModIconsAsAcronyms(modsEl);
    }

    let ppInner;
    if (score.pp != null && Number(score.pp) > 0) {
      const rawN = Number(score.pp);
      const raw = String(score.pp);
      const showPpDecimals = settings.isEnabled(SCORE_PP_DECIMALS_ID);
      const shown = Number.isFinite(rawN)
        ? showPpDecimals
          ? formatDecimalPp(rawN)
          : String(Math.round(rawN))
        : raw;
      ppInner = el(
        "span",
        { title: raw },
        shown,
        el("span", { class: `${bn}__pp-unit` }, "pp"),
      );
    } else {
      ppInner = el("span", {}, "—");
    }

    const scoreTimeIso = scoreTimestampIso(score);
    const ended = scoreTimeIso ? new Date(scoreTimeIso).toLocaleString() : "";

    return el(
      "div",
      {
        class: `${bn} ${bn}--highlightable`,
      },
      el(
        "div",
        { class: `${bn}__group ${bn}__group--top` },
        el(
          "div",
          { class: `${bn}__icon ${bn}__icon--main` },
          el("div", { class: rankClass }),
        ),
        el(
          "div",
          { class: `${bn}__detail` },
          el(
            "a",
            {
              class: `${bn}__title u-ellipsis-overflow`,
              href: beatmapHrefFromScore(score),
            },
            titleText,
            " ",
            el("small", { class: `${bn}__artist` }, artistText),
          ),
          el(
            "div",
            { class: `${bn}__beatmap-and-time` },
            el("span", { class: `${bn}__beatmap` }, bm.version || "—"),
            el(
              "span",
              { class: `${bn}__time` },
              el(
                "time",
                { class: "js-timeago timeago", datetime: scoreTimeIso || "" },
                ended,
              ),
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: `${bn}__group ${bn}__group--bottom` },
        el(
          "div",
          { class: `${bn}__score-detail` },
          el(
            "div",
            { class: `${bn}__icon ${bn}__icon--extra` },
            el("div", { class: rankClass }),
          ),
          el(
            "div",
            { class: `${bn}__score-detail-top-right` },
            el(
              "div",
              { class: `${bn}__accuracy-and-weighted-pp` },
              el(
                "span",
                { class: `${bn}__accuracy` },
                formatAccuracyPercent(score),
              ),
            ),
          ),
        ),
        el(
          "div",
          { class: `${bn}__mods-pp` },
          modsEl,
          el("div", { class: `${bn}__pp` }, ppInner),
        ),
        el("div", { class: `${bn}__more` }),
      ),
    );
  }

  /**
   * @param {Object|null|undefined} score
   * @returns {string}
   */
  function scoreTimestampIso(score) {
    if (!score || typeof score !== "object") return "";
    const raw = score.ended_at || score.created_at || "";
    return typeof raw === "string" ? raw : "";
  }

  const RECENT_SCORES_MERGED_MAX = 200;

  /**
   * Site JSON (session cookie); passed scores only, but can return more history
   * than API v2 with include_fails in a single page.
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<object[]>}
   */
  async function fetchWebsiteRecentScoresPassedOnly(userId, mode) {
    const q = new URLSearchParams({
      mode: String(mode),
      limit: "100",
    });
    q.append("include", "beatmap");
    q.append("include", "beatmapset");
    const resp = await fetch(`/users/${userId}/scores/recent?${q}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return [];
    let body;
    try {
      body = await resp.json();
    } catch {
      return [];
    }
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.items)) return body.items;
    return [];
  }

  /**
   * Paginated session fetch with fails (fallback when API v2 fails).
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<object[]>}
   */
  async function fetchRecentScoresPaginatedHtmlWithFails(userId, mode) {
    const scores = [];
    const limit = 100;
    const maxTotal = RECENT_SCORES_MERGED_MAX;
    const maxPages = 8;
    let lastPageKey = "";
    let pageCount = 0;
    for (let offset = 0; ; offset += limit) {
      if (pageCount >= maxPages) {
        break;
      }
      const q = new URLSearchParams({
        mode,
        limit: String(limit),
        offset: String(offset),
        include_fails: "1",
      });
      q.append("include", "beatmap");
      q.append("include", "beatmapset");
      let resp;
      try {
        resp = await fetch(`/users/${userId}/scores/recent?${q}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      } catch {
        break;
      }
      if (!resp.ok) break;
      let body;
      try {
        body = await resp.json();
      } catch {
        break;
      }
      const items = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
          ? body.items
          : [];
      pageCount += 1;
      if (!items.length) break;

      const pageKey = items
        .map((it) =>
          it?.id != null
            ? String(it.id)
            : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`,
        )
        .join("|");
      if (pageKey && pageKey === lastPageKey) {
        break;
      }
      lastPageKey = pageKey;

      scores.push(...items);
      if (scores.length >= maxTotal) {
        break;
      }
      if (items.length < limit) break;
    }
    return scores.slice(0, maxTotal);
  }

  /**
   * Cross-list identity for recent scores. API v2 often returns legacy `score_osu`
   * rows with `id: 0` on fails (must not use `id` as Map key) and `id` equal to
   * the website row's `legacy_score_id` (lazer rows use a different `id`).
   * @param {object} s
   * @returns {string|null}
   */
  function _recentScoreMergeKey(s) {
    if (!s || typeof s !== "object") return null;
    const leg = Number(s.legacy_score_id);
    if (Number.isFinite(leg) && leg > 0) return `s:${leg}`;
    const id = Number(s.id);
    if (Number.isFinite(id) && id > 0) return `s:${id}`;
    const bm = s.beatmap?.id ?? s.beatmap_id;
    const t = String(s.ended_at || s.created_at || "");
    const tot = Number(s.total_score ?? s.score);
    const pf = s.passed === false ? 0 : 1;
    if (
      bm != null &&
      Number.isFinite(Number(bm)) &&
      t.length > 0 &&
      Number.isFinite(tot)
    ) {
      return `f:${Number(bm)}:${t}:${tot}:${pf}`;
    }
    return null;
  }

  function _recentScoreDisplayRank(s) {
    if (!s || typeof s !== "object") return 0;
    let r = 0;
    if (s.ended_at) r += 2;
    if (s.type === "solo_score") r += 3;
    if (
      Array.isArray(s.mods) &&
      s.mods.length > 0 &&
      typeof s.mods[0] === "object"
    )
      r += 2;
    if (s.ruleset_id != null) r += 1;
    return r;
  }

  /**
   * When API legacy and site lazer describe the same play, keep the richer row
   * for UI (mods shape, `ended_at`, etc.); never drop a fail in favour of a pass.
   * @param {object} a
   * @param {object} b
   */
  function _pickMergedRecentScore(a, b) {
    const af = a?.passed === false;
    const bf = b?.passed === false;
    if (af !== bf) return af ? a : b;
    const ra = _recentScoreDisplayRank(a);
    const rb = _recentScoreDisplayRank(b);
    if (rb !== ra) return rb > ra ? b : a;
    return a;
  }

  /**
   * @param {object[]} primary  API or paginated path with fails
   * @param {object[]} extraPassed  site `/scores/recent?limit=100` (passed only)
   */
  function mergeRecentScoresWithExtendedPassed(primary, extraPassed) {
    const map = new Map();

    primary.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = _recentScoreMergeKey(s);
      if (k == null) k = `z:primary:${i}`;
      if (!map.has(k)) map.set(k, s);
    });

    extraPassed.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = _recentScoreMergeKey(s);
      if (k == null) k = `z:extra:${i}`;
      if (!map.has(k)) {
        map.set(k, s);
      } else {
        map.set(k, _pickMergedRecentScore(map.get(k), s));
      }
    });

    return [...map.values()].sort((a, b) => {
      const ta = Date.parse(scoreTimestampIso(a)) || 0;
      const tb = Date.parse(scoreTimestampIso(b)) || 0;
      return tb - ta;
    });
  }

  async function fetchRecentScoresPrimaryWithFails(userId, mode) {
    try {
      const data = await OsuExpertPlus.api.getUserRecentScores(
        userId,
        mode,
        100,
        0,
        true,
      );
      return Array.isArray(data) ? data : [];
    } catch {
      return fetchRecentScoresPaginatedHtmlWithFails(userId, mode);
    }
  }

  async function fetchRecentScoresIncludingFails(userId, mode) {
    const [primary, extraPassed] = await Promise.all([
      fetchRecentScoresPrimaryWithFails(userId, mode),
      fetchWebsiteRecentScoresPassedOnly(userId, mode).catch(() => []),
    ]);
    return mergeRecentScoresWithExtendedPassed(primary, extraPassed).slice(
      0,
      RECENT_SCORES_MERGED_MAX,
    );
  }

  function ensurePlayDetailStylesForRecent() {
    playDetailStyle.inject();
  }

  let _recentFailsDebounce = null;

  /**
   * @param {HTMLElement} innerList
   * @param {Object[]} scores
   * @param {HTMLElement|null} modTemplate
   * @param {string} emptyMessage
   */
  function populateRecentScoresInnerList(
    innerList,
    scores,
    modTemplate,
    emptyMessage,
  ) {
    innerList.textContent = "";
    innerList.classList.toggle(
      SCORE_LIST_LAYOUT_CLASS,
      settings.isEnabled(SCORE_HIT_STATISTICS_ID),
    );
    syncScoreListPpDecimalsWidthClass(innerList);
    if (!scores.length) {
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, emptyMessage),
      );
      return;
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;
    const rows = scores.map((s) => buildPlayDetailRowFromApiScore(s, tpl));
    rows.forEach((r) => innerList.appendChild(r));
    applyHideWeightedPp(innerList);
    if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
      applyPpDecimals(innerList);
    }
    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      processElements(rows, scores);
      enrichPlayDetailRowsMaxComboFromAttributes(rows, scores).catch(() => {});
    }
    if (settings.isEnabled(IDS.MOD_ICONS_AS_ACRONYMS)) {
      injectModIconsAcronymStyles();
      applyModIconsAsAcronyms(innerList);
    }
    if (settings.isEnabled(MODDED_SR_ID)) {
      if (!_srObserver) initSrObserver();
      rows.forEach(_observeRow);
    }
    if (settings.isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      injectRanksCardBgLayoutStyles();
      applyRanksCardBackgrounds(innerList);
    }
    if (settings.isEnabled(SCORE_PLACE_NUMBER_ID)) {
      scorePlaceNumberStyle.inject();
      applyPlaceNumbers(innerList);
    } else {
      revertPlaceNumbers(innerList);
    }
  }

  function repopulateRecentScoresWrap(wrap) {
    if (!(wrap instanceof HTMLElement)) return;
    const innerList = wrap.querySelector(":scope > .play-detail-list");
    if (!(innerList instanceof HTMLElement)) return;
    const all = recentScoresFullCache.get(wrap);
    if (!all) return;
    const showFails = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    const filtered = filterScoresForRecentDisplay(all, showFails);
    const emptyMsg =
      !filtered.length && all.length && !showFails
        ? RECENT_FAILS_EMPTY_FILTERED_MSG
        : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(
      innerList,
      filtered,
      findOsuModTemplateNode(),
      emptyMsg,
    );
  }

  /**
   * Mount once per (list element identity): section below official Recent plays + show more.
   * @param {string} userId
   * @param {string} mode
   */
  async function tryMountRecentScoresWithFails(userId, mode) {
    if (document.querySelector(`.${RECENT_FAILS_WRAP_CLASS}`)) return;

    const listRoot = findRecentPlaysListRoot();
    if (!listRoot) return;

    const next = listRoot.nextElementSibling;
    if (
      next instanceof HTMLElement &&
      next.classList.contains(RECENT_FAILS_WRAP_CLASS)
    ) {
      return;
    }

    ensurePlayDetailStylesForRecent();

    const wrap = el("div", { class: RECENT_FAILS_WRAP_CLASS });
    const header = el("div", { class: RECENT_FAILS_HEADER_CLASS });
    header.appendChild(
      el("h3", { class: "title title--page-extra-small" }, "Recent scores"),
    );
    const showFailsCb = document.createElement("input");
    showFailsCb.type = "checkbox";
    showFailsCb.className = "oep-recent-show-fails";
    showFailsCb.checked = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.addEventListener("change", () => {
      settings.set(RECENT_SCORES_SHOW_FAILS_ID, showFailsCb.checked);
    });
    header.appendChild(
      el(
        "label",
        { class: "oep-recent-fails-toggle" },
        showFailsCb,
        "Show failed scores",
      ),
    );
    const clearCacheBtn = el(
      "button",
      {
        class: "oep-clear-sr-cache-btn",
        type: "button",
        title:
          "Clears cached modded star ratings and max combo. Use this if values look wrong or outdated after a beatmap is updated.",
      },
      "Clear SR cache",
    );
    clearCacheBtn.addEventListener("click", () => {
      _attrsSessionCache.clear();
      _writeBeatmapAttrsGmStore({});
      clearCacheBtn.textContent = "Cleared!";
      setTimeout(() => {
        clearCacheBtn.textContent = "Clear SR cache";
      }, 2000);
    });
    header.appendChild(clearCacheBtn);
    wrap.appendChild(header);
    const innerList = el("div", { class: "play-detail-list" });
    innerList.appendChild(
      el("p", { class: "oep-recent-fails-loading" }, "Loading…"),
    );
    wrap.appendChild(innerList);
    listRoot.insertAdjacentElement("afterend", wrap);

    let scores;
    try {
      scores = await fetchRecentScoresIncludingFails(userId, mode);
    } catch {
      innerList.textContent = "";
      innerList.appendChild(
        el(
          "p",
          { class: "oep-recent-fails-error" },
          "Could not load recent scores (including fails).",
        ),
      );
      return;
    }

    innerList.textContent = "";
    if (!scores.length) {
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, RECENT_FAILS_EMPTY_MSG),
      );
      removeOfficialRecentPlaysSection(listRoot);
      return;
    }

    recentScoresFullCache.set(wrap, scores);

    let modTemplate = findOsuModTemplateNode();
    if (
      !(modTemplate instanceof HTMLElement) &&
      scores.some((s) => Array.isArray(s.mods) && s.mods.length > 0)
    ) {
      modTemplate = await waitForOsuModTemplate(2500);
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;

    const showFails = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.checked = showFails;
    const filtered = filterScoresForRecentDisplay(scores, showFails);
    const emptyMsg =
      !filtered.length && scores.length && !showFails
        ? RECENT_FAILS_EMPTY_FILTERED_MSG
        : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(innerList, filtered, tpl, emptyMsg);

    removeOfficialRecentPlaysSection(listRoot);
  }

  /**
   * Historical tab content is loaded lazily after profile init; watch the DOM.
   * @param {string} userId
   * @param {string} mode
   * @returns {function}
   */
  function startRecentScoresWithFailsObserver(userId, mode) {
    let cancelled = false;

    const unsubRecentFailsShow = settings.onChange(
      RECENT_SCORES_SHOW_FAILS_ID,
      () => {
        document
          .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`)
          .forEach((w) => {
            if (!(w instanceof HTMLElement)) return;
            const input = w.querySelector("input.oep-recent-show-fails");
            const on = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
            if (input instanceof HTMLInputElement) input.checked = on;
            repopulateRecentScoresWrap(w);
          });
      },
    );

    const repopulateRecentOnScoreDisplayChange = () => {
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (w instanceof HTMLElement) repopulateRecentScoresWrap(w);
      });
    };
    const unsubRecentPpDecimals = settings.onChange(
      SCORE_PP_DECIMALS_ID,
      repopulateRecentOnScoreDisplayChange,
    );
    const unsubRecentHitStatistics = settings.onChange(
      SCORE_HIT_STATISTICS_ID,
      repopulateRecentOnScoreDisplayChange,
    );
    const unsubRecentPlaceNumbers = settings.onChange(
      SCORE_PLACE_NUMBER_ID,
      repopulateRecentOnScoreDisplayChange,
    );

    const run = () => {
      if (cancelled) return;
      clearTimeout(_recentFailsDebounce);
      _recentFailsDebounce = setTimeout(() => {
        if (cancelled) return;
        tryMountRecentScoresWithFails(userId, mode).catch(() => {});
      }, 200);
    };

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          'div.js-sortable--page[data-page-id="historical"], h3.title.title--page-extra-small, .play-detail-list',
        )
      ) {
        run();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    run();

    return () => {
      cancelled = true;
      clearTimeout(_recentFailsDebounce);
      unsubRecentFailsShow();
      unsubRecentPpDecimals();
      unsubRecentHitStatistics();
      unsubRecentPlaceNumbers();
      obs.disconnect();
      document
        .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`)
        .forEach((n) => n.remove());
    };
  }

  // Top ranks: period highlight vs card-bg layout are separate style tags so turning off
  // "Score age period highlight" does not strip CSS required for score-card backgrounds.
  const RANKS_PERIOD_HIGHLIGHT_STYLE_ID =
    "osu-expertplus-profile-ranks-period-highlight";
  const RANKS_CARD_BG_LAYOUT_STYLE_ID =
    "osu-expertplus-profile-ranks-card-bg-layout";
  const RANKS_PAGE_SELECTOR = 'div.js-sortable--page[data-page-id="top_ranks"]';
  const RANKS_DATE_FILTER_CLASS = "oep-ranks-date-filter";
  const RANKS_DATE_HIGHLIGHT_CLASS = "oep-ranks-date-highlight";
  const RANKS_CARD_BG_ATTR = "data-oep-ranks-card-bg";
  const RANKS_CARD_BG_BEATMAPSET_ATTR = "data-oep-ranks-card-bg-beatmapset";
  const RANKS_CARD_BG_SELECTOR = `.play-detail[${RANKS_CARD_BG_ATTR}="1"]`;
  const RANKS_CARD_BG_URL_VAR = "--oep-ranks-card-bg-url";
  const RANKS_CARD_BG_IMG_CLASS = "oep-card-bg-img";
  const RANKS_CARD_BASE_BG_VAR = "--oep-ranks-card-base-bg";
  const RANKS_CARD_PP_BG_VAR = "--oep-ranks-card-pp-bg";
  const RANKS_CARD_STATS_BG_VAR = "--oep-ranks-card-stats-bg";
  const RANKS_CARD_EDGE_CUT_VAR = "--oep-ranks-card-edge-cut";
  const RANKS_CARD_BG_IO_ROOT_MARGIN = "220px 0px";
  const RANKS_CARD_BG_FEATURE_ID = IDS.SCORE_CARD_BACKGROUNDS;
  /** @type {IntersectionObserver|null} */
  let ranksCardBgObserver = null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MS_PER_WEEK = 7 * MS_PER_DAY;
  const MS_PER_AVG_MONTH = (365.25 / 12) * MS_PER_DAY;
  const RANKS_PERIOD_IDX_MIN = 0;
  const RANKS_PERIOD_IDX_MAX = 36;
  const RANKS_PERIOD_IDX_DEFAULT = 0;
  const RANKS_PERIOD_IDX_WEEK_END = 4;
  const RANKS_PERIOD_IDX_MONTH_END = 28;
  const RANKS_PERIOD_YEAR_START_IDX = 29;
  const RANKS_PERIOD_FIRST_YEAR = 3;
  const RANKS_PERIOD_LAST_YEAR = 10;

  const RANKS_PERIOD_HIGHLIGHT_CSS = `
    .${RANKS_DATE_FILTER_CLASS} {
      box-sizing: border-box;
      margin: 0 0 1rem 0;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      max-width: 34rem;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__text {
      margin: 0 0 0.45rem 0;
      font-size: 0.9375rem;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.88);
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__period {
      color: #66ccff;
      font-weight: 600;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__tail {
      color: rgba(255, 255, 255, 0.55);
      font-weight: 400;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.65rem;
      margin-bottom: 0.45rem;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row .oep-ranks-date-filter__text {
      margin: 0;
      flex: 1;
      min-width: 0;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-shrink: 0;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn {
      flex-shrink: 0;
      margin: 0;
      font: inherit;
      font-size: 0.8125rem;
      line-height: 1.3;
      padding: 0.28rem 0.55rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.82);
      cursor: pointer;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:hover {
      border-color: rgba(255, 255, 255, 0.28);
      color: rgba(255, 255, 255, 0.92);
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.35);
      outline-offset: 1px;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__reverse.oep-ranks-date-filter__reverse--on {
      border-color: rgba(102, 204, 255, 0.45);
      background: rgba(102, 204, 255, 0.1);
      color: #8fd4ff;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 22px;
      margin: 0;
      background: transparent;
      cursor: pointer;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus {
      outline: none;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.4);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-runnable-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 15px;
      height: 15px;
      margin-top: -5px;
      border-radius: 50%;
      background: #66ccff;
      border: 2px solid rgba(255, 255, 255, 0.92);
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
    }
    .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-thumb {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.92);
      background: #66ccff;
    }
    .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS} {
      position: relative;
      z-index: 1;
      border-radius: 6px;
      isolation: isolate;
    }
    .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 6px;
      border: 2px solid rgba(102, 204, 255, 0.9);
      box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
      background: rgba(102, 204, 255, 0.12);
      pointer-events: none;
      z-index: 2;
      box-sizing: border-box;
    }
    ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
      border: 2px solid rgba(102, 204, 255, 0.9);
      box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
      background: rgba(102, 204, 255, 0.12);
      opacity: 1;
      box-sizing: border-box;
    }
    ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:hover::after,
    ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:focus-within::after {
      background: rgba(102, 204, 255, 0.2);
      opacity: 1;
    }
  `;
  const RANKS_CARD_BG_LAYOUT_CSS = `
    ${RANKS_CARD_BG_SELECTOR} {
      position: relative;
      isolation: isolate;
      --oep-ranks-card-edge-cut: 18px;
      background: var(${RANKS_CARD_BASE_BG_VAR}, transparent);
      transition: filter 120ms ease;
      contain: layout style;
    }
    ${RANKS_CARD_BG_SELECTOR}::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 6px;
      -webkit-clip-path: polygon(
        0 0,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
        100% 50%,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
        0 100%
      );
      clip-path: polygon(
        0 0,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
        100% 50%,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
        0 100%
      );
      background: linear-gradient(
        90deg,
        rgba(18, 22, 28, 0.72) 0%,
        rgba(18, 22, 28, 0.72) 40%,
        var(${RANKS_CARD_BASE_BG_VAR}, rgba(18, 22, 28, 1)) 75%
      );
      z-index: -1;
      pointer-events: none;
    }
    ${RANKS_CARD_BG_SELECTOR} .${RANKS_CARD_BG_IMG_CLASS} {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      border-radius: 6px;
      -webkit-clip-path: polygon(
        0 0,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
        100% 50%,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
        0 100%
      );
      clip-path: polygon(
        0 0,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
        100% 50%,
        calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
        0 100%
      );
      z-index: -2;
      pointer-events: none;
    }
    @media (min-width: 900px) {
      ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable {
        background: transparent;
      }
      ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::before,
      ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable .${RANKS_CARD_BG_IMG_CLASS} {
        -webkit-clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
        clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
      }
      ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::after {
        inset: 0 0 0 var(--pin-sortable-handle-width, 20px);
      }
    }
    ${RANKS_CARD_BG_SELECTOR}::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      opacity: 0;
      transition: opacity 120ms ease;
      pointer-events: none;
      z-index: 2;
    }
    ${RANKS_CARD_BG_SELECTOR}:hover::after,
    ${RANKS_CARD_BG_SELECTOR}:focus-within::after {
      opacity: 1;
    }
    ${RANKS_CARD_BG_SELECTOR} .play-detail__group--top,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__group--bottom,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__detail,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail-top-right,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__mods,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__beatmap-and-time,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__title,
    ${RANKS_CARD_BG_SELECTOR} .${SCORE_PLACE_CLASS},
    ${RANKS_CARD_BG_SELECTOR} .play-detail__time {
      background: transparent !important;
    }
    ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::before,
    ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::after {
      background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
      border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
      transition: background-color 120ms ease, border-color 120ms ease;
    }
    ${RANKS_CARD_BG_SELECTOR} .play-detail__pp,
    ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp,
    ${RANKS_CARD_BG_SELECTOR}:focus-within .play-detail__pp {
      background-color: var(${RANKS_CARD_PP_BG_VAR}) !important;
      filter: none !important;
    }
    ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::before,
    ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::after {
      background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
      border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
      filter: none !important;
    }
    ${RANKS_CARD_BG_SELECTOR} .play-detail__more {
      z-index: 3;
    }
  `;
  const ranksPeriodHighlightStyle = manageStyle(
    RANKS_PERIOD_HIGHLIGHT_STYLE_ID,
    RANKS_PERIOD_HIGHLIGHT_CSS,
  );
  const ranksCardBgLayoutStyle = manageStyle(
    RANKS_CARD_BG_LAYOUT_STYLE_ID,
    RANKS_CARD_BG_LAYOUT_CSS,
  );

  /**
   * @param {unknown} n
   * @returns {number}
   */
  function clampRanksPeriodIndex(n) {
    let x = Math.round(Number(n));
    if (!Number.isFinite(x)) x = RANKS_PERIOD_IDX_DEFAULT;
    return Math.min(RANKS_PERIOD_IDX_MAX, Math.max(RANKS_PERIOD_IDX_MIN, x));
  }

  /**
   * @param {number} idx
   * @returns {number} ms to subtract from “now” for the highlight window
   */
  function periodIndexToLookbackMs(idx) {
    const i = clampRanksPeriodIndex(idx);
    if (i <= 0) return 0;
    if (i <= RANKS_PERIOD_IDX_WEEK_END) return i * MS_PER_WEEK;
    if (i <= RANKS_PERIOD_IDX_MONTH_END)
      return (i - RANKS_PERIOD_IDX_WEEK_END) * MS_PER_AVG_MONTH;
    const years = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
    return years * 12 * MS_PER_AVG_MONTH;
  }

  /**
   * @param {number} idx
   * @returns {string}
   */
  function formatRanksPeriodShortLabel(idx) {
    const i = clampRanksPeriodIndex(idx);
    if (i <= 0) return "No highlight";
    if (i <= RANKS_PERIOD_IDX_WEEK_END)
      return i === 1 ? "1 week" : `${i} weeks`;
    if (i <= RANKS_PERIOD_IDX_MONTH_END) {
      const mo = i - RANKS_PERIOD_IDX_WEEK_END;
      return mo === 1 ? "1 month" : `${mo} months`;
    }
    const y = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
    return `${y} years`;
  }

  /**
   * @returns {number}
   */
  function readStoredRanksPeriodIndex() {
    return RANKS_PERIOD_IDX_DEFAULT;
  }

  /**
   * @param {HTMLElement} statusEl  <strong.oep-ranks-date-filter__period>
   * @param {HTMLElement} tailEl    <span.oep-ranks-date-filter__tail>
   * @param {number} periodIdx
   * @param {boolean} reversed
   */
  function setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversed) {
    const i = clampRanksPeriodIndex(periodIdx);
    if (i === 0) {
      statusEl.textContent = "No highlight";
      tailEl.textContent = " — drag to set a period.";
    } else {
      statusEl.textContent = formatRanksPeriodShortLabel(i);
      tailEl.textContent = reversed
        ? " · older scores highlighted"
        : " · recent scores highlighted";
    }
  }

  /**
   * @param {Element} rowEl
   * @returns {number|null}  epoch ms
   */
  function getPlayDetailScoreTimeMs(rowEl) {
    const t =
      rowEl.querySelector(".play-detail__time time[datetime]") ||
      rowEl.querySelector("time.js-timeago") ||
      rowEl.querySelector("time.timeago") ||
      rowEl.querySelector("time[datetime]");
    if (!t) return null;
    const iso = t.getAttribute("datetime");
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  function injectRanksPeriodHighlightStyles() {
    ranksPeriodHighlightStyle.inject();
  }

  function injectRanksCardBgLayoutStyles() {
    ranksCardBgLayoutStyle.inject();
  }

  /**
   * @param {ParentNode} topRanksRoot
   * @param {number} periodIdx
   * @param {boolean} reversed  if true, highlight scores *older* than the window
   */
  function applyRanksDateHighlights(topRanksRoot, periodIdx, reversed) {
    const rows = topRanksRoot.querySelectorAll(
      ".play-detail-list .play-detail",
    );
    rows.forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));

    const idx = clampRanksPeriodIndex(periodIdx);
    if (idx === 0) return;

    const cutoff = Date.now() - periodIndexToLookbackMs(idx);
    rows.forEach((row) => {
      const scoreMs = getPlayDetailScoreTimeMs(row);
      if (scoreMs == null) return;
      const inWindow = reversed ? scoreMs < cutoff : scoreMs >= cutoff;
      if (inWindow) row.classList.add(RANKS_DATE_HIGHLIGHT_CLASS);
    });
  }

  /**
   * @param {Element} root  Top ranks page, or a `.play-detail-list` element
   * @returns {HTMLElement[]}
   */
  function queryPlayDetailScoreRows(root) {
    if (!(root instanceof HTMLElement)) return [];
    if (root.classList.contains("play-detail-list")) {
      return Array.from(root.querySelectorAll(":scope > .play-detail"));
    }
    return Array.from(root.querySelectorAll(".play-detail-list .play-detail"));
  }

  /**
   * @param {Element} rowEl
   * @returns {string|null}
   */
  function getRanksRowBeatmapsetId(rowEl) {
    const href = rowEl
      .querySelector("a.play-detail__title")
      ?.getAttribute("href");
    if (!href) return null;
    const beatmapsetMatch = href.match(/\/beatmapsets\/(\d+)/);
    return beatmapsetMatch?.[1] ?? null;
  }

  /**
   * @param {HTMLElement} topRanksRoot
   */
  function applyRanksCardBackgrounds(topRanksRoot) {
    const pickBaseBg = (rowEl) => {
      const candidates = [
        rowEl,
        rowEl.querySelector(".play-detail__group--top"),
        rowEl.querySelector(".play-detail__group--bottom"),
        rowEl.querySelector(".play-detail__detail"),
        rowEl.querySelector(".play-detail__score-detail"),
      ];
      for (const elCandidate of candidates) {
        if (!(elCandidate instanceof Element)) continue;
        const bg = getComputedStyle(elCandidate).backgroundColor;
        if (!bg) continue;
        if (bg === "transparent") continue;
        if (/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(bg))
          continue;
        return bg;
      }
      return "";
    };

    if (!ranksCardBgObserver && "IntersectionObserver" in window) {
      ranksCardBgObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const rowEl = entry.target;
            if (!(rowEl instanceof HTMLElement)) return;
            const beatmapsetId = rowEl.getAttribute(
              RANKS_CARD_BG_BEATMAPSET_ATTR,
            );
            const imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
            if (!beatmapsetId || !imgEl) return;
            if (entry.isIntersecting) {
              imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
            } else {
              imgEl.removeAttribute("src");
            }
          });
        },
        { root: null, rootMargin: RANKS_CARD_BG_IO_ROOT_MARGIN, threshold: 0 },
      );
    }

    queryPlayDetailScoreRows(topRanksRoot).forEach((rowEl) => {
      const beatmapsetId = getRanksRowBeatmapsetId(rowEl);
      if (!beatmapsetId) {
        ranksCardBgObserver?.unobserve(rowEl);
        rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
        rowEl.removeAttribute(RANKS_CARD_BG_ATTR);
        rowEl.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
        rowEl.style.removeProperty(RANKS_CARD_BG_URL_VAR);
        rowEl.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
        rowEl.style.removeProperty(RANKS_CARD_PP_BG_VAR);
        rowEl.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
        return;
      }
      const bgCandidate = pickBaseBg(rowEl);
      const ppEl = rowEl.querySelector(".play-detail__pp");
      const ppBg =
        ppEl instanceof Element ? getComputedStyle(ppEl).backgroundColor : "";
      const scoreDetailEl = rowEl.querySelector(".play-detail__score-detail");
      const statsBg =
        scoreDetailEl instanceof Element
          ? getComputedStyle(scoreDetailEl).backgroundColor
          : "";
      rowEl.setAttribute(RANKS_CARD_BG_ATTR, "1");
      rowEl.setAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR, beatmapsetId);
      if (bgCandidate) {
        rowEl.style.setProperty(RANKS_CARD_BASE_BG_VAR, bgCandidate);
      }
      if (
        ppBg &&
        ppBg !== "transparent" &&
        !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(ppBg)
      ) {
        rowEl.style.setProperty(RANKS_CARD_PP_BG_VAR, ppBg);
      }
      if (
        statsBg &&
        statsBg !== "transparent" &&
        !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(statsBg)
      ) {
        rowEl.style.setProperty(RANKS_CARD_STATS_BG_VAR, statsBg);
      }
      let imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
      if (!imgEl) {
        imgEl = document.createElement("img");
        imgEl.className = RANKS_CARD_BG_IMG_CLASS;
        imgEl.decoding = "async";
        imgEl.alt = "";
        rowEl.insertBefore(imgEl, rowEl.firstChild);
      }
      if (ranksCardBgObserver) {
        ranksCardBgObserver.observe(rowEl);
        if (!rowEl.isConnected) ranksCardBgObserver.unobserve(rowEl);
      } else {
        imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
      }
    });
  }

  function insertRanksDateFilterBar(topRanksRoot, wrap) {
    const pageExtra =
      topRanksRoot.querySelector(":scope > .page-extra") ||
      topRanksRoot.querySelector(".page-extra");

    if (pageExtra instanceof HTMLElement) {
      const lazy = pageExtra.querySelector(":scope > .lazy-load");
      if (lazy) {
        pageExtra.insertBefore(wrap, lazy);
        return;
      }
      const header = pageExtra.querySelector(":scope > .u-relative");
      if (header instanceof HTMLElement) {
        header.insertAdjacentElement("afterend", wrap);
        return;
      }
      const h2 = pageExtra.querySelector(
        ":scope > h2.title--page-extra, :scope > h2.title.title--page-extra",
      );
      if (h2 instanceof HTMLElement) {
        h2.insertAdjacentElement("afterend", wrap);
        return;
      }
      const firstSectionH3 = pageExtra.querySelector(
        "h3.title--page-extra-small",
      );
      if (firstSectionH3 instanceof HTMLElement) {
        firstSectionH3.insertAdjacentElement("beforebegin", wrap);
        return;
      }
    }

    topRanksRoot.insertBefore(wrap, topRanksRoot.firstChild);
  }

  /**
   * @param {HTMLElement} topRanksRoot
   */
  function ensureRanksDateFilterBar(topRanksRoot) {
    if (topRanksRoot.querySelector(`.${RANKS_DATE_FILTER_CLASS}`)) return;

    const periodIdx = readStoredRanksPeriodIndex();
    const reversedStored = false;

    const statusEl = el("strong", { class: "oep-ranks-date-filter__period" });
    const tailEl = el("span", { class: "oep-ranks-date-filter__tail" });
    setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversedStored);

    const resetBtn = el(
      "button",
      {
        type: "button",
        class: "oep-ranks-date-filter__btn oep-ranks-date-filter__reset",
        "aria-label": "Reset period and reverse filter",
      },
      "Reset",
    );

    const revBtn = el(
      "button",
      {
        type: "button",
        class: `oep-ranks-date-filter__btn oep-ranks-date-filter__reverse${reversedStored ? " oep-ranks-date-filter__reverse--on" : ""}`,
        "aria-pressed": reversedStored ? "true" : "false",
        "aria-label": "Reverse highlight to older scores outside the period",
      },
      "Reverse",
    );

    const range = el("input", {
      type: "range",
      class: "oep-ranks-date-filter__range",
      min: String(RANKS_PERIOD_IDX_MIN),
      max: String(RANKS_PERIOD_IDX_MAX),
      step: "1",
      value: String(periodIdx),
    });
    range.setAttribute(
      "aria-label",
      "Highlight window: off, then weeks, months, and years",
    );

    const readReversed = () => revBtn.getAttribute("aria-pressed") === "true";

    const wrap = el(
      "div",
      { class: RANKS_DATE_FILTER_CLASS },
      el(
        "div",
        { class: "oep-ranks-date-filter__row" },
        el("p", { class: "oep-ranks-date-filter__text" }, statusEl, tailEl),
        el(
          "div",
          { class: "oep-ranks-date-filter__actions" },
          resetBtn,
          revBtn,
        ),
      ),
      range,
    );
    insertRanksDateFilterBar(topRanksRoot, wrap);

    range.addEventListener("input", () => {
      const idx = clampRanksPeriodIndex(range.value);
      setRanksFilterBarLabels(statusEl, tailEl, idx, readReversed());
      applyRanksDateHighlights(topRanksRoot, idx, readReversed());
    });

    revBtn.addEventListener("click", () => {
      const next = revBtn.getAttribute("aria-pressed") !== "true";
      revBtn.setAttribute("aria-pressed", next ? "true" : "false");
      revBtn.classList.toggle("oep-ranks-date-filter__reverse--on", next);
      const idx = clampRanksPeriodIndex(range.value);
      setRanksFilterBarLabels(statusEl, tailEl, idx, next);
      applyRanksDateHighlights(topRanksRoot, idx, next);
    });

    resetBtn.addEventListener("click", () => {
      range.value = String(RANKS_PERIOD_IDX_DEFAULT);
      revBtn.setAttribute("aria-pressed", "false");
      revBtn.classList.remove("oep-ranks-date-filter__reverse--on");
      setRanksFilterBarLabels(
        statusEl,
        tailEl,
        RANKS_PERIOD_IDX_DEFAULT,
        false,
      );
      applyRanksDateHighlights(topRanksRoot, RANKS_PERIOD_IDX_DEFAULT, false);
    });
  }

  /**
   * @param {HTMLElement} topRanksRoot
   */
  function revertRanksCardBackgrounds() {
    document.querySelectorAll(RANKS_CARD_BG_SELECTOR).forEach((row) => {
      ranksCardBgObserver?.unobserve(row);
      row.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
      row.removeAttribute(RANKS_CARD_BG_ATTR);
      row.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
      row.style.removeProperty(RANKS_CARD_BG_URL_VAR);
      row.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
      row.style.removeProperty(RANKS_CARD_PP_BG_VAR);
      row.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
    });
    ranksCardBgObserver?.disconnect();
    ranksCardBgObserver = null;
  }

  function syncRanksDateHighlightForPage(topRanksRoot) {
    if (settings.isEnabled(SCORE_PERIOD_HIGHLIGHT_ID)) {
      ensureRanksDateFilterBar(topRanksRoot);
      const range = topRanksRoot.querySelector(
        `.${RANKS_DATE_FILTER_CLASS} input[type="range"]`,
      );
      const idx = range
        ? clampRanksPeriodIndex(range.value)
        : readStoredRanksPeriodIndex();
      if (range && String(range.value) !== String(idx))
        range.value = String(idx);
      const revBtn = topRanksRoot.querySelector(
        ".oep-ranks-date-filter__reverse",
      );
      const reversed =
        revBtn instanceof HTMLElement
          ? revBtn.getAttribute("aria-pressed") === "true"
          : false;
      applyRanksDateHighlights(topRanksRoot, idx, reversed);
    }
    if (settings.isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      applyRanksCardBackgrounds(topRanksRoot);
    }
  }

  /**
   * Ranks extra page mounts lazily; watch the DOM and keep highlights in sync
   * (including “load more”).
   * @returns {function}
   */
  function startRanksDateHighlightManager() {
    let debounceTimer = 0;
    /** @type {MutationObserver[]} */
    let rankPlayListObservers = [];

    function disconnectRankPlayListObservers() {
      rankPlayListObservers.forEach((o) => o.disconnect());
      rankPlayListObservers = [];
    }

    function connectRankPlayListObservers(scheduleFn) {
      disconnectRankPlayListObservers();
      const roots = [];
      const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
      if (ranksPage instanceof HTMLElement) roots.push(ranksPage);
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (w instanceof HTMLElement) roots.push(w);
      });
      for (const root of roots) {
        root.querySelectorAll(".play-detail-list").forEach((listEl) => {
          if (!(listEl instanceof HTMLElement)) return;
          const o = new MutationObserver(() => {
            scheduleFn();
          });
          o.observe(listEl, { childList: true });
          rankPlayListObservers.push(o);
        });
      }
      const mostWatchedList = findMostWatchedReplaysListRoot();
      if (mostWatchedList instanceof HTMLElement) {
        const o = new MutationObserver(() => {
          scheduleFn();
        });
        o.observe(mostWatchedList, { childList: true });
        rankPlayListObservers.push(o);
      }
    }

    const run = () => {
      const periodOn = settings.isEnabled(SCORE_PERIOD_HIGHLIGHT_ID);
      const cardBgOn = settings.isEnabled(RANKS_CARD_BG_FEATURE_ID);

      if (!periodOn) {
        document
          .querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
          .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
        ranksPeriodHighlightStyle.remove();
      } else {
        injectRanksPeriodHighlightStyles();
        const page = document.querySelector(RANKS_PAGE_SELECTOR);
        if (page instanceof HTMLElement) syncRanksDateHighlightForPage(page);
        else {
          document
            .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
            .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
        }
      }

      if (cardBgOn) {
        injectRanksCardBgLayoutStyles();
        const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
        if (ranksPage instanceof HTMLElement)
          applyRanksCardBackgrounds(ranksPage);
        document
          .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`)
          .forEach((listEl) => {
            if (listEl instanceof HTMLElement)
              applyRanksCardBackgrounds(listEl);
          });
        const mostWatchedList = findMostWatchedReplaysListRoot();
        if (mostWatchedList instanceof HTMLElement)
          applyRanksCardBackgrounds(mostWatchedList);
      } else {
        ranksCardBgLayoutStyle.remove();
      }

      if (periodOn || cardBgOn) {
        connectRankPlayListObservers(schedule);
      } else {
        disconnectRankPlayListObservers();
      }
    };

    const schedule = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(run, 64);
    };

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `${RANKS_PAGE_SELECTOR}, h3.title.title--page-extra-small`,
        )
      ) {
        schedule();
        return;
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    schedule();

    const unsubBg = settings.onChange(RANKS_CARD_BG_FEATURE_ID, (enabled) => {
      if (enabled) {
        injectRanksCardBgLayoutStyles();
        const page = document.querySelector(RANKS_PAGE_SELECTOR);
        if (page instanceof HTMLElement) applyRanksCardBackgrounds(page);
        document
          .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`)
          .forEach((listEl) => {
            if (listEl instanceof HTMLElement)
              applyRanksCardBackgrounds(listEl);
          });
        const mostWatchedList = findMostWatchedReplaysListRoot();
        if (mostWatchedList instanceof HTMLElement)
          applyRanksCardBackgrounds(mostWatchedList);
      } else {
        revertRanksCardBackgrounds();
        ranksCardBgLayoutStyle.remove();
      }
    });

    const unsubPeriod = settings.onChange(SCORE_PERIOD_HIGHLIGHT_ID, () =>
      schedule(),
    );

    return () => {
      unsubPeriod();
      unsubBg();
      clearTimeout(debounceTimer);
      disconnectRankPlayListObservers();
      obs.disconnect();
      ranksPeriodHighlightStyle.remove();
      ranksCardBgLayoutStyle.remove();
      document
        .querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`)
        .forEach((n) => n.remove());
      document
        .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
        .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
      revertRanksCardBackgrounds();
    };
  }

  const PROFILE_BADGES_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-badges-collapse";
  const PROFILE_BADGES_WRAP_CLASS = "oep-profile-badges-wrap";
  const PROFILE_BADGES_DONE_ATTR = "data-oep-profile-badges-done";
  const PROFILE_BADGES_COLLAPSED_GM_KEY = "userProfile.profileBadgesCollapsed";

  const PROFILE_BADGES_COLLAPSE_CSS = `
    .${PROFILE_BADGES_WRAP_CLASS} {
      position: relative;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed .profile-badges {
      display: none;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed {
      min-height: 36px;
    }
    .oep-profile-badges-toggle {
      position: absolute;
      z-index: 5;
      top: 8px;
      right: 8px;
    }
  `;
  const badgesCollapseStyle = manageStyle(
    PROFILE_BADGES_COLLAPSE_STYLE_ID,
    PROFILE_BADGES_COLLAPSE_CSS,
  );

  function injectProfileBadgesCollapseStyles() {
    badgesCollapseStyle.inject();
  }

  function removeProfileBadgesCollapseStyles() {
    badgesCollapseStyle.remove();
  }

  /**
   * @param {HTMLElement} badgesRoot  .profile-badges
   */
  function enhanceProfileBadgesStrip(badgesRoot) {
    if (badgesRoot.hasAttribute(PROFILE_BADGES_DONE_ATTR)) return;
    if (!badgesRoot.classList.contains("profile-badges")) return;

    const parent = badgesRoot.parentNode;
    if (!parent) return;

    const shell = el("div", { class: PROFILE_BADGES_WRAP_CLASS });
    parent.insertBefore(shell, badgesRoot);
    shell.appendChild(badgesRoot);

    const collapsedStored = Boolean(
      GM_getValue(PROFILE_BADGES_COLLAPSED_GM_KEY, false),
    );
    if (collapsedStored) {
      shell.classList.add(`${PROFILE_BADGES_WRAP_CLASS}--collapsed`);
    }

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "btn-circle oep-profile-badges-toggle",
        "aria-expanded": collapsedStored ? "false" : "true",
        title: collapsedStored ? "Show profile badges" : "Hide profile badges",
      },
      el("span", {
        class: collapsedStored ? "fas fa-chevron-down" : "fas fa-chevron-up",
      }),
    );

    shell.appendChild(toggleBtn);
    badgesRoot.setAttribute(PROFILE_BADGES_DONE_ATTR, "1");

    const applyToggleUi = (collapsed) => {
      const icon = toggleBtn.querySelector(".fas");
      if (icon) {
        icon.className = collapsed
          ? "fas fa-chevron-down"
          : "fas fa-chevron-up";
      }
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleBtn.title = collapsed
        ? "Show profile badges"
        : "Hide profile badges";
    };

    toggleBtn.addEventListener("click", () => {
      const collapsed = shell.classList.toggle(
        `${PROFILE_BADGES_WRAP_CLASS}--collapsed`,
      );
      GM_setValue(PROFILE_BADGES_COLLAPSED_GM_KEY, collapsed);
      applyToggleUi(collapsed);
    });
  }

  function teardownProfileBadgesCollapse() {
    document
      .querySelectorAll(`.${PROFILE_BADGES_WRAP_CLASS}`)
      .forEach((shell) => {
        const badges = shell.querySelector(".profile-badges");
        const shellParent = shell.parentNode;
        if (badges && shellParent) {
          badges.removeAttribute(PROFILE_BADGES_DONE_ATTR);
          shellParent.insertBefore(badges, shell);
        }
        shell.remove();
      });
    removeProfileBadgesCollapseStyles();
  }

  /**
   * @returns {function}
   */
  function startProfileBadgesCollapseManager() {
    injectProfileBadgesCollapseStyles();

    const scan = () => {
      document.querySelectorAll(".profile-badges").forEach((node) => {
        if (
          node instanceof HTMLElement &&
          !node.hasAttribute(PROFILE_BADGES_DONE_ATTR)
        ) {
          enhanceProfileBadgesStrip(node);
        }
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (mutationsIncludeSelector(mutations, ".profile-badges")) scan();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      teardownProfileBadgesCollapse();
    };
  }

  const BBHELP_STYLE_ID = "osu-expertplus-userpage-bbcode-helper";
  const BBHELP_WRAP_CLASS = "oep-bbhelp";
  const BBHELP_ROW_CLASS = "oep-bbhelp__row";
  const BBHELP_BTN_CLASS = "oep-bbhelp__btn";
  const BBHELP_BTN_ICON_CLASS = "oep-bbhelp__btn-icon";
  const BBHELP_BTN_TEXT_CLASS = "oep-bbhelp__btn-text";
  const BBHELP_MODAL_CLASS = "oep-bbhelp-modal";
  const BBHELP_EDITOR_ID_ATTR = "data-oep-bbhelp-editor-id";
  const BBHELP_WRAP_FOR_ATTR = "data-oep-bbhelp-for";
  const BBHELP_DONE_ATTR = "data-oep-bbhelp";
  const BBHELP_CHECKER_DONE_ATTR = "data-oep-bbhelp-checker";
  const BBHELP_PREVIEW_DONE_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_TOGGLE_ATTR = "data-oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_BODY_CLASS = "oep-bbhelp-preview__body";
  const BBHELP_PREVIEW_TOGGLE_CLASS = "oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_CLASS = "oep-bbhelp-preview";
  const BBHELP_PREVIEW_TITLE_CLASS = "oep-bbhelp-preview__title";
  const BBHELP_PREVIEW_EMPTY_CLASS = "oep-bbhelp-preview__empty";
  const BBHELP_WARN_CLASS = "oep-bbhelp-warn";
  const BBHELP_EDITOR_SELECTOR = ".bbcode-editor";
  const BBHELP_INPUT_SELECTOR = "textarea";

  const BBHELP_CSS = `
    .${BBHELP_WRAP_CLASS} {
      margin: 0 0 10px;
      display: block;
    }
    .${BBHELP_ROW_CLASS} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .${BBHELP_BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.9);
      font: inherit;
      font-weight: 600;
      font-size: 12px;
      line-height: 1;
      padding: 6px 8px;
      cursor: pointer;
    }
    .${BBHELP_BTN_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(255, 255, 255, 0.1);
    }
    .${BBHELP_BTN_ICON_CLASS} {
      width: 12px;
      text-align: center;
      opacity: 0.92;
    }
    .${BBHELP_BTN_TEXT_CLASS} {
      white-space: nowrap;
    }
    .${BBHELP_MODAL_CLASS} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
    .${BBHELP_MODAL_CLASS}__card {
      width: min(420px, 100%);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: #1f1f2a;
      color: rgba(255, 255, 255, 0.95);
      padding: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS}__title {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 700;
    }
    .${BBHELP_MODAL_CLASS}__modes {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .${BBHELP_MODAL_CLASS}__field {
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS}__hint {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_MODAL_CLASS} select,
    .${BBHELP_MODAL_CLASS} input[type="number"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS}__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn {
      margin-right: auto;
      min-width: 0;
      max-width: 100%;
      font-size: 12px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.62);
    }
    .${BBHELP_MODAL_CLASS}__actions-warn:empty {
      display: none;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn--error {
      color: rgba(255, 196, 120, 0.95);
    }
    .${BBHELP_MODAL_CLASS}__actions-btns {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }
    .${BBHELP_MODAL_CLASS} .${BBHELP_BTN_CLASS}:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .${BBHELP_MODAL_CLASS}__color-grid {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS} input[type="color"] {
      width: 56px;
      height: 36px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    .${BBHELP_MODAL_CLASS} input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS} textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 8px;
      line-height: 1.4;
    }
    .${BBHELP_MODAL_CLASS}__swatch {
      width: 100%;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: #ff66aa;
      margin-top: 8px;
    }
    .${BBHELP_WARN_CLASS} {
      margin-top: 8px;
      border-left: 3px solid #f0ad4e;
      background: rgba(240, 173, 78, 0.12);
      color: #ffd28a;
      font-size: 12px;
      line-height: 1.35;
      padding: 6px 8px;
    }
    .${BBHELP_WARN_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS} {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.92);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 9px;
      cursor: pointer;
      margin-right: 8px;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.32);
      background: rgba(255, 255, 255, 0.14);
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}[aria-pressed="true"] {
      border-color: rgba(255, 255, 255, 0.38);
      background: rgba(255, 255, 255, 0.2);
    }
    .${BBHELP_PREVIEW_CLASS} {
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px;
      color: rgba(255, 255, 255, 0.9);
    }
    .${BBHELP_PREVIEW_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TITLE_CLASS} {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} {
      line-height: 1.55;
      word-break: break-word;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p {
      margin: 0 0 0.7em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} blockquote {
      margin: 0 0 0.7em;
      padding-left: 0.8em;
      border-left: 3px solid rgba(255, 255, 255, 0.26);
      color: rgba(255, 255, 255, 0.82);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoilerbox {
      margin: 0 0 0.65em;
      border: none;
      border-radius: 0;
      background: transparent;
      overflow: visible;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary {
      cursor: pointer;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2em 0.35em;
      list-style: none;
      margin: 0;
      padding: 0;
      max-width: 100%;
      font-weight: 700;
      color: hsl(var(--hsl-l2));
      background: none;
      border: none;
      -webkit-appearance: none;
      appearance: none;
      outline: none;
      text-align: left;
      width: max-content;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary:hover {
      color: hsl(var(--hsl-l1));
      text-decoration: underline;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoiler-summary::-webkit-details-marker {
      display: none;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon {
      display: block;
      flex: none;
      width: 1.1em;
      text-align: center;
      line-height: 1;
      opacity: 0.9;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon::before {
      display: inline-block;
      font-family: "Font Awesome 5 Free", "Font Awesome 6 Free", sans-serif;
      font-weight: 900;
      content: "\\f105";
      font-size: 0.95em;
      transition: transform 0.12s ease;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoilerbox[open]
      .oep-bbhelp-preview__spoiler-icon::before {
      content: "\\f107";
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-label {
      overflow-wrap: anywhere;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body {
      margin-top: 10px;
      padding-left: 20px;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body > p:first-child {
      margin-top: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary--icon-only {
      min-width: 1.25em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice {
      margin: 0 0 0.7em;
      padding: 10px 12px;
      border: 1px solid hsl(var(--hsl-h1));
      border-radius: 6px;
      background: hsl(var(--hsl-b4));
      color: hsl(var(--hsl-c1));
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice > p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre,
    .${BBHELP_PREVIEW_BODY_CLASS} code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.92em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre {
      margin: 0 0 0.7em;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.25);
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} ul,
    .${BBHELP_PREVIEW_BODY_CLASS} ol {
      margin: 0 0 0.7em;
      padding-left: 1.35em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} img {
      max-width: min(100%, 520px);
      height: auto;
      border-radius: 4px;
      display: block;
      margin: 0.3em 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap {
      margin: 0 0 0.7em;
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.16);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap-meta {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.4;
    }
    .${BBHELP_PREVIEW_EMPTY_CLASS} {
      color: rgba(255, 255, 255, 0.62);
      font-style: italic;
      margin: 0;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect {
      position: absolute;
      box-sizing: border-box;
      border: 2px solid rgba(255, 180, 0, 0.85);
      background: rgba(255, 180, 0, 0.14);
      pointer-events: auto;
      cursor: pointer;
      border-radius: 2px;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--selected {
      border-color: rgba(120, 200, 255, 0.95);
      background: rgba(120, 200, 255, 0.2);
      box-shadow: 0 0 0 1px rgba(120, 200, 255, 0.45);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-row--selected {
      border-color: rgba(120, 200, 255, 0.55) !important;
      background: rgba(120, 200, 255, 0.1) !important;
      box-shadow: inset 0 0 0 1px rgba(120, 200, 255, 0.25);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--movable {
      cursor: move;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle {
      position: absolute;
      width: 11px;
      height: 11px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.95);
      background: rgba(120, 200, 255, 0.95);
      border-radius: 2px;
      z-index: 2;
      pointer-events: auto;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--nw {
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--ne {
      left: 100%;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--sw {
      left: 0;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--se {
      left: 100%;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
  `;

  const bbcodeStyle = manageStyle(BBHELP_STYLE_ID, BBHELP_CSS);

  function injectBbcodeHelperStyles() {
    bbcodeStyle.inject();
  }

  function removeBbcodeHelperStyles() {
    bbcodeStyle.remove();
  }

  function _replaceTextareaRange(textarea, from, to, replacement) {
    textarea.focus();
    textarea.setSelectionRange(from, to);
    let usedNativeUndoPath = false;
    try {
      if (typeof document.execCommand === "function") {
        usedNativeUndoPath = document.execCommand(
          "insertText",
          false,
          replacement,
        );
      }
    } catch (_) {}
    if (!usedNativeUndoPath) {
      textarea.setRangeText(replacement, from, to, "end");
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function _toggleBbcodeWrap(textarea, openTag, closeTag) {
    const value = textarea.value || "";
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const hasSelection = end > start;

    const selected = value.slice(start, end);
    const selectedIsWrapped =
      selected.startsWith(openTag) && selected.endsWith(closeTag);
    const aroundSelectionIsWrapped =
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(end, end + closeTag.length) === closeTag;
    const aroundCursorIsWrapped =
      !hasSelection &&
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(start, start + closeTag.length) === closeTag;

    let nextStart = start;
    let nextEnd = end;

    if (hasSelection && selectedIsWrapped) {
      const inner = selected.slice(
        openTag.length,
        selected.length - closeTag.length,
      );
      _replaceTextareaRange(textarea, start, end, inner);
      nextEnd = start + inner.length;
    } else if (hasSelection && aroundSelectionIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        end + closeTag.length,
        selected,
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart + selected.length;
    } else if (aroundCursorIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        start + closeTag.length,
        "",
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart;
    } else {
      _replaceTextareaRange(
        textarea,
        start,
        end,
        `${openTag}${selected}${closeTag}`,
      );
      if (hasSelection) {
        nextStart = start + openTag.length;
        nextEnd = nextStart + selected.length;
      } else {
        nextStart = start + openTag.length;
        nextEnd = nextStart;
      }
    }

    textarea.setSelectionRange(nextStart, nextEnd);
  }

  function _openColorPicker(textarea) {
    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font color",
    );

    const colorInput = el("input", {
      type: "color",
      value: "#ff66aa",
      "aria-label": "Pick a color",
    });
    const textInput = el("input", {
      type: "text",
      value: "#ff66aa",
      placeholder: "#RRGGBB or color name",
      "aria-label": "Color value",
    });
    const swatch = el("div", { class: `${BBHELP_MODAL_CLASS}__swatch` });
    const colorGrid = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__color-grid` },
      colorInput,
      textInput,
    );
    const hint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint` },
      "Use picker for hex color, or type a color name (e.g. red).",
    );

    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const updateSwatch = () => {
      const v = String(textInput.value || "").trim();
      swatch.style.background = v || "#ff66aa";
    };
    const close = () => overlay.remove();
    const apply = () => {
      const value = String(textInput.value || "").trim();
      if (!value) return;
      _toggleBbcodeWrap(textarea, `[color=${value}]`, "[/color]");
      close();
    };

    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      updateSwatch();
    });
    textInput.addEventListener("input", updateSwatch);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(colorGrid);
    card.appendChild(swatch);
    card.appendChild(hint);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    textInput.focus();
    textInput.select();
    updateSwatch();
  }

  function _openSizePicker(textarea) {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const modeName = `oep-size-mode-${uid}`;
    const modePresetId = `oep-size-mode-preset-${uid}`;
    const modeManualId = `oep-size-mode-manual-${uid}`;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font size",
    );
    const modeWrap = el("div", { class: `${BBHELP_MODAL_CLASS}__modes` });

    const presetRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modePresetId,
      value: "preset",
      checked: "checked",
    });
    const manualRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modeManualId,
      value: "manual",
    });
    modeWrap.appendChild(
      el(
        "label",
        { for: modePresetId },
        presetRadio,
        " Preset (tiny/small/normal/large)",
      ),
    );
    modeWrap.appendChild(
      el("label", { for: modeManualId }, manualRadio, " Manual number"),
    );

    const presetField = el("div", { class: `${BBHELP_MODAL_CLASS}__field` });
    const presetSelect = el(
      "select",
      {},
      el("option", { value: "tiny" }, "tiny"),
      el("option", { value: "small" }, "small"),
      el("option", { value: "normal", selected: "selected" }, "normal"),
      el("option", { value: "large" }, "large"),
    );
    presetField.appendChild(presetSelect);

    const manualField = el("div", {
      class: `${BBHELP_MODAL_CLASS}__field`,
      style: "display:none;",
    });
    const manualInput = el("input", {
      type: "number",
      min: "30",
      max: "200",
      step: "1",
      value: "100",
      placeholder: "30 - 200",
    });
    manualField.appendChild(manualInput);
    manualField.appendChild(
      el("div", { class: `${BBHELP_MODAL_CLASS}__hint` }, "Range: 30-200"),
    );

    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const close = () => overlay.remove();
    const syncMode = () => {
      const isPreset = presetRadio.checked;
      presetField.style.display = isPreset ? "" : "none";
      manualField.style.display = isPreset ? "none" : "";
      if (isPreset) presetSelect.focus();
      else manualInput.focus();
    };
    const apply = () => {
      const sizeValue = presetRadio.checked
        ? String(presetSelect.value || "").trim()
        : String(
            Math.max(
              30,
              Math.min(200, Math.round(Number(manualInput.value) || 0)),
            ),
          );
      if (!sizeValue || sizeValue === "0") return;
      _toggleBbcodeWrap(textarea, `[size=${sizeValue}]`, "[/size]");
      close();
    };

    presetRadio.addEventListener("change", syncMode);
    manualRadio.addEventListener("change", syncMode);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(modeWrap);
    card.appendChild(presetField);
    card.appendChild(manualField);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    syncMode();
  }

  function _openImagemapHelper(textarea) {
    // State
    const hotspots = []; // { x, y, w, h, url, title }
    let imgLoaded = false;
    let drawState = null; // { startX, startY, rectEl } — active drag
    let selectedHotspotIndex = -1;
    /** @type {null | { index: number, sx: number, sy: number }} */
    let pendingRectPick = null;
    /**
     * @type {null | {
     *   type: 'move' | 'resize';
     *   index: number;
     *   corner?: string;
     *   startPt: { x: number; y: number };
     *   startHs: { x: number; y: number; w: number; h: number };
     *   rectEl: HTMLElement;
     * }}
     */
    let modifyState = null;
    const IMAP_DRAG_THRESHOLD_PX = 5;
    const IMAP_MIN_RECT_PCT = 1;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", {
      class: `${BBHELP_MODAL_CLASS}__card`,
      style:
        "width:min(700px,96vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;",
    });

    const titleRow = el("div", {
      style:
        "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;",
    });
    const titleEl = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title`, style: "margin:0;" },
      "ImageMap Helper",
    );
    const importFromEditorBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title:
          "Auto: replace state from an [imagemap] block in the BBCode editor (uses selection if any, otherwise full text)",
      },
      "Import from editor",
    );
    const importManualBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Show a field to paste [imagemap] BBCode manually",
      },
      "Manual import",
    );
    const importBtnsWrap = el(
      "div",
      {
        style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;",
      },
      importFromEditorBtn,
      importManualBtn,
    );
    titleRow.appendChild(titleEl);
    titleRow.appendChild(importBtnsWrap);

    let manualImportOpen = false;
    const manualImportPanel = el("div", {
      style: "display:none;flex-direction:column;gap:8px;",
    });
    const manualImportHint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint`, style: "margin:0;" },
      "Paste a full [imagemap]…[/imagemap] block. Tags are required so the parser can find the body.",
    );
    const manualImportTa = el("textarea", {
      rows: 10,
      style:
        "min-height:140px;resize:vertical;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;",
      "aria-label": "Manual imagemap BBCode",
      placeholder:
        "[imagemap]\nhttps://example.com/image.png\n0 0 25 25 https://osu.ppy.sh\n[/imagemap]",
    });
    const manualImportActions = el("div", {
      style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;",
    });
    const manualImportApplyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply pasted import",
    );
    const manualImportCloseBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Close",
    );
    manualImportActions.appendChild(manualImportApplyBtn);
    manualImportActions.appendChild(manualImportCloseBtn);
    manualImportPanel.appendChild(manualImportHint);
    manualImportPanel.appendChild(manualImportTa);
    manualImportPanel.appendChild(manualImportActions);

    // Image URL row
    const urlInput = el("input", {
      type: "text",
      placeholder: "https://i.ppy.sh/... (base image URL)",
      style: "flex:1;min-width:0;",
      "aria-label": "Base image URL",
    });
    const loadBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Load",
    );
    const urlRow = el(
      "div",
      { style: "display:flex;gap:6px;" },
      urlInput,
      loadBtn,
    );

    // Image preview + drawing layer.
    // Border/background live on imgWrap; imgStage (no border) shrink-wraps the
    // img so drawLayer inset:0 matches the bitmap box. BBCode % = that box.
    const imgEl = el("img", {
      alt: "",
      referrerpolicy: "no-referrer",
      style:
        "display:none;max-width:100%;height:auto;vertical-align:top;pointer-events:none;user-select:none;border-radius:3px;",
    });
    const drawLayer = el("div", {
      style:
        "position:absolute;inset:0;cursor:crosshair;display:none;touch-action:none;",
    });
    const imgStage = el(
      "div",
      {
        style:
          "position:relative;display:inline-block;line-height:0;max-width:100%;vertical-align:top;",
      },
      imgEl,
      drawLayer,
    );
    const imgPlaceholder = el(
      "div",
      {
        style:
          "font-size:12px;opacity:0.45;padding:16px;text-align:center;pointer-events:none;",
      },
      "Image will appear here after loading",
    );
    const imgWrap = el(
      "div",
      {
        style:
          "display:inline-block;max-width:100%;vertical-align:top;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;",
      },
      imgPlaceholder,
      imgStage,
    );
    const imgScrollSection = el("div", {
      style:
        "min-height:0;flex-shrink:1;align-self:stretch;width:100%;max-height:min(48vh,480px);overflow:auto;border-radius:4px;text-align:center;padding:2px;box-sizing:border-box;",
    });
    imgScrollSection.appendChild(imgWrap);

    const hotspotListEl = el("div", {
      style: "display:flex;flex-direction:column;gap:5px;",
    });

    function formatBbcodeForSingleLineDisplay(multiline) {
      if (!multiline) return "";
      return String(multiline).replace(/\r?\n/g, " ").trim();
    }

    const codeEl = el("div", {
      role: "textbox",
      "aria-readonly": "true",
      "aria-label": "Generated BBCode preview",
      style:
        "flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.14);border-radius:4px;padding:8px 10px;font-size:11px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,0.9);text-align:left;",
    });
    const copyCodeBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Copy full BBCode (with line breaks) to clipboard",
        style: "flex-shrink:0;align-self:stretch;",
      },
      "Copy",
    );
    const codeRow = el(
      "div",
      {
        style:
          "display:flex;align-items:stretch;gap:8px;min-width:0;width:100%;",
      },
      codeEl,
      copyCodeBtn,
    );

    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const insertBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Insert into editor",
    );
    const actionsWarn = el("div", {
      class: `${BBHELP_MODAL_CLASS}__actions-warn`,
      role: "status",
    });
    const actionsBtns = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions-btns` },
      cancelBtn,
      insertBtn,
    );
    const actions = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions` },
      actionsWarn,
      actionsBtns,
    );

    // osu-web BBCodeFromDB::parseImagemap only matches link lines when the URL is
    // `#`, `http(s)://…` (no spaces), or `mailto:…` — see ppy/osu-web.

    function formatImapPct(v) {
      const n = Math.max(0, Math.min(100, Number(v)));
      const r = Math.round(n * 100) / 100;
      return String(r.toFixed(2)).replace(/\.?0+$/, "");
    }

    function normalizeImapLinkUrlForOsu(raw) {
      const u = String(raw || "").trim();
      if (!u) return null;
      if (u === "#") return "#";
      if (/^https?:\/\/\S+$/i.test(u)) return u;
      if (/^mailto:\S+$/i.test(u)) return u;
      if (u.startsWith("//")) return `https:${u}`;
      if (u.startsWith("/")) return `https://osu.ppy.sh${u}`;
      return null;
    }

    function parseImagemapFromText(text) {
      const m = String(text || "").match(
        /\[imagemap\]\s*([\s\S]*?)\s*\[\/imagemap\]/i,
      );
      if (!m) return null;
      const rawBody = m[1].replace(/\r\n/g, "\n").trim();
      if (!rawBody) return null;
      const lines = rawBody
        .split("\n")
        .map((l) => l.trim())
        .filter((ln) => ln.length > 0);
      if (!lines.length) return null;
      const imageUrl = lines[0];
      const areas = [];
      for (let li = 1; li < lines.length; li++) {
        const line = lines[li];
        const rm = line.match(
          /^([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+(\S+)(?:\s+(.*))?$/,
        );
        if (!rm) continue;
        const x = Number(rm[1]);
        const y = Number(rm[2]);
        const w = Number(rm[3]);
        const h = Number(rm[4]);
        if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
        areas.push({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
          w: Math.max(0, Math.min(100, w)),
          h: Math.max(0, Math.min(100, h)),
          url: rm[5],
          title: (rm[6] || "").trim(),
        });
      }
      return { imageUrl, areas };
    }

    function applyParsedImagemap(parsed) {
      hotspots.length = 0;
      parsed.areas.forEach((ar) => hotspots.push({ ...ar }));
      urlInput.value = parsed.imageUrl;
      selectedHotspotIndex = -1;
      rebuildHotspotList();
      renderOverlayRects();
      refreshCode();
      loadImage();
    }

    function setManualImportOpen(open) {
      manualImportOpen = open;
      manualImportPanel.style.display = open ? "flex" : "none";
      importManualBtn.textContent = open
        ? "Hide manual import"
        : "Manual import";
      if (open) manualImportTa.focus();
    }

    function setSelectedIndex(i) {
      const next = i >= 0 && i < hotspots.length ? i : -1;
      if (next !== selectedHotspotIndex) {
        selectedHotspotIndex = next;
        renderOverlayRects();
        return;
      }
      selectedHotspotIndex = next;
      syncSelectionVisuals();
    }

    function syncSelectionVisuals() {
      hotspotListEl.querySelectorAll("[data-oep-imap-row]").forEach((row) => {
        const idx = Number(row.getAttribute("data-oep-imap-row"));
        row.classList.toggle(
          "oep-imap-row--selected",
          idx === selectedHotspotIndex,
        );
      });
      drawLayer.querySelectorAll("[data-oep-imap-rect]").forEach((el) => {
        const idx = Number(el.getAttribute("data-oep-imap-rect"));
        el.classList.toggle(
          "oep-imap-rect--selected",
          idx === selectedHotspotIndex,
        );
      });
    }

    function focusHotspotUrlInput(index) {
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(index)}"]`,
      );
      if (!(row instanceof HTMLElement)) return;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const urlField = row.querySelector("input[data-oep-imap-url]");
      if (urlField instanceof HTMLInputElement) {
        urlField.focus();
        urlField.select();
      }
    }

    function generateBbcode() {
      const imgUrl = String(urlInput.value || "").trim();
      if (!imgUrl) return "";
      const valid = hotspots
        .map((hs) => ({
          hs,
          link: normalizeImapLinkUrlForOsu(hs.url),
        }))
        .filter((o) => o.link);
      if (!valid.length) return "";
      const lines = [imgUrl];
      valid.forEach(({ hs, link }) => {
        const { x, y, w, h, title } = hs;
        let line = `${formatImapPct(x)} ${formatImapPct(y)} ${formatImapPct(w)} ${formatImapPct(h)} ${link}`;
        const t = String(title || "").trim();
        if (t) line += ` ${t}`;
        lines.push(line);
      });
      return `[imagemap]\n${lines.join("\n")}\n[/imagemap]`;
    }

    copyCodeBtn.addEventListener("click", async () => {
      const text = generateBbcode();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px;top:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch (_) {
          return;
        }
      }
      const prev = copyCodeBtn.textContent;
      copyCodeBtn.textContent = "Copied!";
      window.setTimeout(() => {
        copyCodeBtn.textContent = prev;
      }, 1600);
    });

    function refreshCode() {
      const code = generateBbcode();
      insertBtn.disabled = !code;
      actionsWarn.classList.remove(
        `${BBHELP_MODAL_CLASS}__actions-warn--error`,
      );
      if (code) {
        codeEl.textContent = formatBbcodeForSingleLineDisplay(code);
        copyCodeBtn.disabled = false;
        actionsWarn.textContent = "";
        return;
      }
      codeEl.textContent = "";
      copyCodeBtn.disabled = true;
      const imgUrl = String(urlInput.value || "").trim();
      const anyArea = hotspots.length > 0;
      const anyTextUrl = hotspots.some((hs) => String(hs.url || "").trim());
      const accepted = hotspots.some((hs) =>
        normalizeImapLinkUrlForOsu(hs.url),
      );
      if (anyArea && anyTextUrl && !accepted) {
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "osu! rejects these URLs — use https://…, mailto:…, #, //…, or a path like /users/123.";
        return;
      }
      actionsWarn.textContent =
        "Add an image URL, load it, draw areas, and set a valid link on each row to enable insert.";
    }

    function clampImapRect(o, minSz = IMAP_MIN_RECT_PCT) {
      let x = o.x;
      let y = o.y;
      let w = Math.max(minSz, o.w);
      let h = Math.max(minSz, o.h);
      x = Math.max(0, Math.min(100 - w, x));
      y = Math.max(0, Math.min(100 - h, y));
      if (x + w > 100) w = 100 - x;
      if (y + h > 100) h = 100 - y;
      w = Math.max(minSz, w);
      h = Math.max(minSz, h);
      return { x, y, w, h };
    }

    function computeResizeRect(corner, s, pt, minSz = IMAP_MIN_RECT_PCT) {
      const px = Math.max(0, Math.min(100, pt.x));
      const py = Math.max(0, Math.min(100, pt.y));
      const rx = s.x + s.w;
      const by = s.y + s.h;
      let x = s.x;
      let y = s.y;
      let w = s.w;
      let h = s.h;
      if (corner === "se") {
        x = s.x;
        y = s.y;
        w = px - x;
        h = py - y;
      } else if (corner === "nw") {
        w = Math.max(minSz, rx - px);
        h = Math.max(minSz, by - py);
        x = rx - w;
        y = by - h;
      } else if (corner === "ne") {
        x = s.x;
        y = Math.min(py, by - minSz);
        w = Math.max(minSz, px - x);
        h = by - y;
      } else if (corner === "sw") {
        x = Math.min(px, rx - minSz);
        y = s.y;
        w = rx - x;
        h = Math.max(minSz, py - y);
      }
      return clampImapRect({ x, y, w, h }, minSz);
    }

    function applyHsToRectEl(rectEl, hs) {
      Object.assign(rectEl.style, {
        left: `${formatImapPct(hs.x)}%`,
        top: `${formatImapPct(hs.y)}%`,
        width: `${formatImapPct(hs.w)}%`,
        height: `${formatImapPct(hs.h)}%`,
      });
    }

    function updateRowCoordBadge(i) {
      const hs = hotspots[i];
      if (!hs) return;
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(i)}"]`,
      );
      const badge = row?.querySelector("[data-oep-imap-coords]");
      if (badge) {
        badge.textContent = `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`;
      }
    }

    function finishModifyGesture() {
      modifyState = null;
      pendingRectPick = null;
      renderOverlayRects();
      rebuildHotspotList();
      refreshCode();
    }

    function onModifyMouseMove(ev) {
      if (!modifyState || !imgLoaded) return;
      const bounds = imgEl.getBoundingClientRect();
      const pt = pctRawFromEvent(ev, bounds);
      if (!pt) return;
      const hs = hotspots[modifyState.index];
      if (!hs) return;
      if (modifyState.type === "move") {
        const dx = pt.x - modifyState.startPt.x;
        const dy = pt.y - modifyState.startPt.y;
        const next = clampImapRect({
          x: modifyState.startHs.x + dx,
          y: modifyState.startHs.y + dy,
          w: modifyState.startHs.w,
          h: modifyState.startHs.h,
        });
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      } else if (modifyState.type === "resize" && modifyState.corner) {
        const next = computeResizeRect(
          modifyState.corner,
          modifyState.startHs,
          pt,
        );
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      }
    }

    function renderOverlayRects() {
      Array.from(drawLayer.querySelectorAll(".oep-imap-rect")).forEach((n) =>
        n.remove(),
      );
      hotspots.forEach((hs, i) => {
        const isSel = i === selectedHotspotIndex;
        const rectEl = el("div", {
          class: `oep-imap-rect${isSel ? " oep-imap-rect--movable" : ""}`,
          "data-oep-imap-rect": String(i),
          style: `left:${formatImapPct(hs.x)}%;top:${formatImapPct(hs.y)}%;width:${formatImapPct(hs.w)}%;height:${formatImapPct(hs.h)}%;`,
        });
        rectEl.addEventListener("mousedown", (ev) => {
          if (ev.button !== 0) return;
          if (
            ev.target instanceof Element &&
            ev.target.closest(".oep-imap-handle")
          ) {
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
          setSelectedIndex(i);
          pendingRectPick = {
            index: i,
            sx: ev.clientX,
            sy: ev.clientY,
          };
        });
        if (isSel) {
          for (const corner of ["nw", "ne", "sw", "se"]) {
            const handle = el("div", {
              class: `oep-imap-handle oep-imap-handle--${corner}`,
              "data-oep-corner": corner,
            });
            handle.addEventListener("mousedown", (ev) => {
              if (ev.button !== 0) return;
              ev.preventDefault();
              ev.stopPropagation();
              pendingRectPick = null;
              setSelectedIndex(i);
              modifyState = {
                type: "resize",
                index: i,
                corner,
                startPt: pctRawFromEvent(ev, imgEl.getBoundingClientRect()) ?? {
                  x: 0,
                  y: 0,
                },
                startHs: {
                  x: hs.x,
                  y: hs.y,
                  w: hs.w,
                  h: hs.h,
                },
                rectEl,
              };
            });
            rectEl.appendChild(handle);
          }
        }
        drawLayer.appendChild(rectEl);
      });
      syncSelectionVisuals();
    }

    function buildHotspotRow(hs, index) {
      const indexBadge = el(
        "span",
        {
          style:
            "font-size:11px;font-weight:700;opacity:0.6;min-width:1.6em;text-align:right;flex-shrink:0;",
        },
        `#${index + 1}`,
      );
      const coordBadge = el(
        "span",
        {
          style:
            "font-size:10px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;opacity:0.55;white-space:nowrap;flex-shrink:0;",
          "data-oep-imap-coords": "1",
        },
        `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`,
      );
      const urlIn = el("input", {
        type: "text",
        placeholder: "https://… or /users/… or #",
        value: hs.url || "",
        style: "flex:1;min-width:0;",
        "aria-label": `Area ${index + 1} URL`,
        "data-oep-imap-url": "1",
      });
      urlIn.addEventListener("input", () => {
        hs.url = urlIn.value;
        refreshCode();
      });
      urlIn.addEventListener("focus", () => setSelectedIndex(index));
      const titleIn = el("input", {
        type: "text",
        placeholder: "Title (optional)",
        value: hs.title || "",
        style: "width:130px;flex-shrink:0;",
        "aria-label": `Area ${index + 1} title`,
      });
      titleIn.addEventListener("input", () => {
        hs.title = titleIn.value;
        refreshCode();
      });
      titleIn.addEventListener("focus", () => setSelectedIndex(index));
      const removeBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Remove area",
          style: "padding:4px 7px;flex-shrink:0;",
        },
        "✕",
      );
      removeBtn.addEventListener("click", () => {
        const i = hotspots.indexOf(hs);
        if (i !== -1) hotspots.splice(i, 1);
        if (selectedHotspotIndex === i) selectedHotspotIndex = -1;
        else if (selectedHotspotIndex > i) selectedHotspotIndex -= 1;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
      });
      const row = el(
        "div",
        {
          class: "oep-imap-row",
          "data-oep-imap-row": String(index),
          style:
            "display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:6px 8px;",
        },
        indexBadge,
        coordBadge,
        urlIn,
        titleIn,
        removeBtn,
      );
      row.addEventListener("mousedown", (ev) => {
        const t = ev.target;
        if (t instanceof Element && t.closest("button")) return;
        if (t === urlIn || t === titleIn) return;
        setSelectedIndex(index);
        requestAnimationFrame(() => focusHotspotUrlInput(index));
      });
      return row;
    }

    function rebuildHotspotList() {
      while (hotspotListEl.firstChild)
        hotspotListEl.removeChild(hotspotListEl.firstChild);
      if (!hotspots.length) {
        hotspotListEl.appendChild(
          el(
            "div",
            { style: "font-size:12px;opacity:0.5;font-style:italic;" },
            "No areas yet — click and drag on the image above to add one.",
          ),
        );
        return;
      }
      hotspots.forEach((hs, i) =>
        hotspotListEl.appendChild(buildHotspotRow(hs, i)),
      );
      syncSelectionVisuals();
    }

    function pctRawFromEvent(ev, bounds) {
      if (!bounds.width || !bounds.height) return null;
      return {
        x: ((ev.clientX - bounds.left) / bounds.width) * 100,
        y: ((ev.clientY - bounds.top) / bounds.height) * 100,
      };
    }

    /** Intersect drag box (two corners, possibly outside 0–100%) with the image. */
    function selectionRectFromDragPct(sx, sy, ex, ey) {
      const xLo = Math.min(sx, ex);
      const xHi = Math.max(sx, ex);
      const yLo = Math.min(sy, ey);
      const yHi = Math.max(sy, ey);
      const cxLo = Math.max(0, Math.min(100, xLo));
      const cxHi = Math.max(0, Math.min(100, xHi));
      const cyLo = Math.max(0, Math.min(100, yLo));
      const cyHi = Math.max(0, Math.min(100, yHi));
      return {
        x: cxLo,
        y: cyLo,
        w: Math.max(0, cxHi - cxLo),
        h: Math.max(0, cyHi - cyLo),
      };
    }

    drawLayer.addEventListener("mousedown", (ev) => {
      if (!imgLoaded) return;
      ev.preventDefault();
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const rectEl = el("div", {
        style:
          "position:absolute;box-sizing:border-box;border:2px dashed rgba(255,255,0,0.9);background:rgba(255,255,0,0.1);pointer-events:none;left:0;top:0;width:0;height:0;",
      });
      drawLayer.appendChild(rectEl);
      drawState = { startX: raw.x, startY: raw.y, rectEl };
    });

    const onGlobalMouseMove = (ev) => {
      if (modifyState) {
        onModifyMouseMove(ev);
        return;
      }
      if (pendingRectPick) {
        const d = Math.hypot(
          ev.clientX - pendingRectPick.sx,
          ev.clientY - pendingRectPick.sy,
        );
        if (d > IMAP_DRAG_THRESHOLD_PX) {
          const pi = pendingRectPick.index;
          const bounds = imgEl.getBoundingClientRect();
          const startPt = pctRawFromEvent(
            { clientX: pendingRectPick.sx, clientY: pendingRectPick.sy },
            bounds,
          );
          const rEl = drawLayer.querySelector(
            `[data-oep-imap-rect="${String(pi)}"]`,
          );
          if (startPt && rEl instanceof HTMLElement && hotspots[pi]) {
            modifyState = {
              type: "move",
              index: pi,
              startPt,
              startHs: {
                x: hotspots[pi].x,
                y: hotspots[pi].y,
                w: hotspots[pi].w,
                h: hotspots[pi].h,
              },
              rectEl: rEl,
            };
          }
          pendingRectPick = null;
        }
        return;
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        raw.x,
        raw.y,
      );
      Object.assign(drawState.rectEl.style, {
        left: `${r.x}%`,
        top: `${r.y}%`,
        width: `${r.w}%`,
        height: `${r.h}%`,
      });
    };

    const onGlobalMouseUp = (ev) => {
      if (modifyState) {
        finishModifyGesture();
      } else if (pendingRectPick) {
        const idx = pendingRectPick.index;
        pendingRectPick = null;
        requestAnimationFrame(() => focusHotspotUrlInput(idx));
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw =
        bounds.width && bounds.height ? pctRawFromEvent(ev, bounds) : null;
      const endX = raw ? raw.x : drawState.startX;
      const endY = raw ? raw.y : drawState.startY;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        endX,
        endY,
      );
      drawState.rectEl.remove();
      drawState = null;
      if (r.w > 1 && r.h > 1) {
        hotspots.push({ x: r.x, y: r.y, w: r.w, h: r.h, url: "", title: "" });
        const newIdx = hotspots.length - 1;
        selectedHotspotIndex = newIdx;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
        requestAnimationFrame(() => focusHotspotUrlInput(newIdx));
      }
    };

    document.addEventListener("mousemove", onGlobalMouseMove);
    document.addEventListener("mouseup", onGlobalMouseUp);

    const loadImage = () => {
      const safe = _sanitizeHttpPreviewUrl(String(urlInput.value || "").trim());
      if (!safe) {
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent =
          "Invalid URL — must start with http:// or https://.";
        return;
      }
      imgLoaded = false;
      imgEl.style.display = "none";
      drawLayer.style.display = "none";
      imgPlaceholder.style.display = "";
      imgPlaceholder.textContent = "Loading…";
      imgEl.onload = () => {
        imgLoaded = true;
        imgPlaceholder.style.display = "none";
        imgEl.style.display = "block";
        // drawLayer is inset:0 over imgEl — show it only after imgEl is visible
        // so its bounding rect is correct from the first mousedown.
        drawLayer.style.display = "";
        refreshCode();
      };
      imgEl.onerror = () => {
        imgLoaded = false;
        imgEl.style.display = "none";
        drawLayer.style.display = "none";
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent = "Could not load image.";
      };
      imgEl.src = safe;
    };

    loadBtn.addEventListener("click", loadImage);
    urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") loadImage();
    });
    urlInput.addEventListener("input", refreshCode);

    importFromEditorBtn.addEventListener("click", () => {
      const v = textarea.value;
      const a = textarea.selectionStart ?? 0;
      const b = textarea.selectionEnd ?? a;
      const sel = a !== b ? v.slice(a, b) : "";
      let parsed = parseImagemapFromText(sel);
      if (!parsed) parsed = parseImagemapFromText(v);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "No [imagemap]…[/imagemap] block found in the selection or editor text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    importManualBtn.addEventListener("click", () => {
      setManualImportOpen(!manualImportOpen);
    });
    manualImportCloseBtn.addEventListener("click", () => {
      setManualImportOpen(false);
    });
    manualImportApplyBtn.addEventListener("click", () => {
      const parsed = parseImagemapFromText(manualImportTa.value);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "Could not parse [imagemap]…[/imagemap] from the pasted text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    const close = () => {
      document.removeEventListener("mousemove", onGlobalMouseMove);
      document.removeEventListener("mouseup", onGlobalMouseUp);
      overlay.remove();
    };

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (manualImportOpen) {
        setManualImportOpen(false);
        ev.stopPropagation();
        return;
      }
      close();
    });

    insertBtn.addEventListener("click", () => {
      const code = generateBbcode();
      if (!code) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;
      _replaceTextareaRange(textarea, start, end, code);
      close();
    });

    card.appendChild(titleRow);
    card.appendChild(manualImportPanel);
    card.appendChild(urlRow);
    card.appendChild(imgScrollSection);
    card.appendChild(hotspotListEl);
    card.appendChild(codeRow);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    rebuildHotspotList();
    refreshCode();
    urlInput.focus();
  }

  function _createBbcodeButtons(textarea) {
    const specs = [
      {
        label: "Bold",
        title: "Bold",
        icon: "fas fa-bold",
        open: "[b]",
        close: "[/b]",
      },
      {
        label: "Italic",
        title: "Italic",
        icon: "fas fa-italic",
        open: "[i]",
        close: "[/i]",
      },
      {
        label: "Underline",
        title: "Underline",
        icon: "fas fa-underline",
        open: "[u]",
        close: "[/u]",
      },
      {
        label: "Strike",
        title: "Strike",
        icon: "fas fa-strikethrough",
        open: "[s]",
        close: "[/s]",
      },
      {
        label: "Heading",
        title: "Heading",
        icon: "fas fa-heading",
        open: "[heading]",
        close: "[/heading]",
      },
      {
        label: "Quote",
        title: "Quote",
        icon: "fas fa-quote-right",
        open: "[quote]",
        close: "[/quote]",
      },
      {
        label: "Code",
        title: "Code",
        icon: "fas fa-code",
        open: "[code]",
        close: "[/code]",
      },
      {
        label: "Spoiler Box",
        title: "Spoiler Box",
        icon: "fas fa-box-open",
        open: "[box]",
        close: "[/box]",
      },
      {
        label: "Color",
        title: "Font color",
        icon: "fas fa-palette",
        onClick: () => _openColorPicker(textarea),
      },
      {
        label: "Size",
        title: "Font size",
        icon: "fas fa-text-height",
        onClick: () => _openSizePicker(textarea),
      },
      {
        label: "Link",
        title: "Link",
        icon: "fas fa-link",
        open: "[url]",
        close: "[/url]",
      },
      {
        label: "Image",
        title: "Image",
        icon: "far fa-image",
        open: "[img]",
        close: "[/img]",
      },
      {
        label: "List",
        title: "List",
        icon: "fas fa-list-ul",
        open: "[list]\n[*]",
        close: "\n[/list]",
      },
      {
        label: "Center",
        title: "Center",
        icon: "fas fa-align-center",
        open: "[centre]",
        close: "[/centre]",
      },
    ];

    return specs.map((spec) =>
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: spec.title,
          onclick: () =>
            typeof spec.onClick === "function"
              ? spec.onClick()
              : _toggleBbcodeWrap(textarea, spec.open, spec.close),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label),
      ),
    );
  }

  function _parseBbcodeTagName(rawTag) {
    const s = String(rawTag || "").trim();
    if (!s) return "";
    const noSlash = s.startsWith("/") ? s.slice(1).trim() : s;
    const cutEq = noSlash.split("=")[0].trim();
    const cutSpace = cutEq.split(/\s+/)[0].trim();
    return cutSpace.toLowerCase();
  }

  const KNOWN_BBCODE_TAGS = new Set([
    "b",
    "i",
    "u",
    "s",
    "strike",
    "color",
    "size",
    "spoiler",
    "box",
    "spoilerbox",
    "quote",
    "c",
    "code",
    "centre",
    "url",
    "profile",
    "list",
    "*",
    "email",
    "img",
    "imagemap",
    "youtube",
    "audio",
    "heading",
    "notice",
  ]);

  function _firstBbcodeFormatIssue(text) {
    const value = String(text || "");
    /** @type {string[]} */
    const stack = [];
    const selfClosing = new Set(["*"]);
    let i = 0;
    while (i < value.length) {
      const ch = value[i];
      if (ch === "]") {
        return "Unexpected closing bracket `]`.";
      }
      if (ch !== "[") {
        i += 1;
        continue;
      }
      const closeIdx = value.indexOf("]", i + 1);
      if (closeIdx === -1) {
        return "Missing closing bracket `]` for a BBCode tag.";
      }
      const rawTag = value.slice(i + 1, closeIdx).trim();
      if (!rawTag) {
        return "Empty BBCode tag `[]` is invalid.";
      }
      const isClosing = rawTag.startsWith("/");
      const name = _parseBbcodeTagName(rawTag);
      if (!name || !/^[a-z*]+$/.test(name)) {
        return `Invalid tag name in \`[${rawTag}]\`.`;
      }
      // Unknown bracketed text is treated as plain text, not BBCode.
      if (!KNOWN_BBCODE_TAGS.has(name)) {
        i = closeIdx + 1;
        continue;
      }
      if (!isClosing && !selfClosing.has(name)) {
        stack.push(name);
      } else if (isClosing) {
        const expected = stack[stack.length - 1];
        if (!expected) {
          return `Closing tag \`[/${name}]\` has no matching opening tag.`;
        }
        if (expected !== name) {
          return `Mismatched tag order: expected \`[/${expected}]\` before \`[/${name}]\`.`;
        }
        stack.pop();
      }
      i = closeIdx + 1;
    }
    if (stack.length) {
      return `Unclosed tag \`[${stack[stack.length - 1]}]\` found.`;
    }
    return null;
  }

  function _ensureBbcodeFormatChecker(editorEl, textarea) {
    let warnEl = editorEl.querySelector(`:scope > .${BBHELP_WARN_CLASS}`);
    if (!(warnEl instanceof HTMLElement)) {
      warnEl = el("div", { class: BBHELP_WARN_CLASS, hidden: "hidden" });
      textarea.insertAdjacentElement("afterend", warnEl);
    }
    if (textarea.hasAttribute(BBHELP_CHECKER_DONE_ATTR)) return;

    const refresh = () => {
      const issue = _firstBbcodeFormatIssue(textarea.value);
      if (!issue) {
        warnEl.hidden = true;
        warnEl.textContent = "";
        return;
      }
      warnEl.hidden = false;
      warnEl.textContent = `BBCode format warning: ${issue}`;
    };

    textarea.addEventListener("input", refresh);
    textarea.setAttribute(BBHELP_CHECKER_DONE_ATTR, "1");
    refresh();
  }

  function _escapePreviewHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _sanitizeHttpPreviewUrl(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    try {
      const parsed = new URL(src, location.origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function _matchNoticeOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    if (!/^\[notice\]/i.test(s.slice(i, i + 8))) return null;
    return { fullLen: 8 };
  }

  function _matchNoticeCloseLen(s, i) {
    return /^\[\/notice\]/i.test(s.slice(i, i + 9)) ? 9 : 0;
  }

  function _findBbcodeNoticeCloseRange(s, innerStart) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchNoticeCloseLen(s, i);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchNoticeOpenAt(s, i);
        if (op) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _matchBbcodeBoxOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    const rest = s.slice(i);
    const tags = ["spoilerbox", "spoiler", "box"];
    for (let t = 0; t < tags.length; t += 1) {
      const tag = tags[t];
      const re =
        tag === "spoilerbox"
          ? /^\[spoilerbox(?:=([^\]]*))?\]/i
          : tag === "spoiler"
            ? /^\[spoiler(?:=([^\]]*))?\]/i
            : /^\[box(?:=([^\]]*))?\]/i;
      const m = rest.match(re);
      if (m) {
        return {
          tag,
          titleRaw: String(m[1] ?? "").trim(),
          fullLen: m[0].length,
        };
      }
    }
    return null;
  }

  function _matchBbcodeBoxCloseLen(s, i, tag) {
    const re =
      tag === "spoilerbox"
        ? /^\[\/spoilerbox\]/i
        : tag === "spoiler"
          ? /^\[\/spoiler\]/i
          : /^\[\/box\]/i;
    const m = s.slice(i).match(re);
    return m ? m[0].length : 0;
  }

  function _findFirstBbcodeNestableOpen(s) {
    for (let i = 0; i < s.length; i += 1) {
      const noticeOp = _matchNoticeOpenAt(s, i);
      if (noticeOp) {
        return { kind: "notice", index: i, fullLen: noticeOp.fullLen };
      }
      const boxOp = _matchBbcodeBoxOpenAt(s, i);
      if (boxOp) {
        return {
          kind: "box",
          index: i,
          tag: boxOp.tag,
          titleRaw: boxOp.titleRaw,
          fullLen: boxOp.fullLen,
        };
      }
    }
    return null;
  }

  function _findBbcodeBoxCloseRange(s, innerStart, tag) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchBbcodeBoxCloseLen(s, i, tag);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchBbcodeBoxOpenAt(s, i);
        if (op && op.tag === tag) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _formatBbcodeBoxPreviewHtml(
    tag,
    titleRawFromEscapedSource,
    innerHtml,
  ) {
    const trimmed = String(titleRawFromEscapedSource || "").trim();
    const label = tag === "box" ? trimmed || "Box" : trimmed;
    const labelSpan = label
      ? `<span class="oep-bbhelp-preview__spoiler-label">${label}</span>`
      : "";
    const summaryClass =
      "oep-bbhelp-preview__spoiler-summary" +
      (label ? "" : " oep-bbhelp-preview__spoiler-summary--icon-only");
    const summaryA11y = label ? "" : ' aria-label="Spoiler"';
    return (
      `<details class="oep-bbhelp-preview__spoilerbox">` +
      `<summary class="${summaryClass}"${summaryA11y}>` +
      `<span class="oep-bbhelp-preview__spoiler-icon" aria-hidden="true"></span>` +
      `${labelSpan}` +
      `</summary>` +
      `<div class="oep-bbhelp-preview__spoiler-body">${innerHtml}</div>` +
      `</details>`
    );
  }

  function _replaceBalancedBbcodeNestable(html, renderInner) {
    const first = _findFirstBbcodeNestableOpen(html);
    if (!first) return html;

    if (first.kind === "notice") {
      const start = first.index;
      const fullLen = first.fullLen;
      const range = _findBbcodeNoticeCloseRange(html, start + fullLen);
      if (!range) return html;
      const before = html.slice(0, start);
      const inner = html.slice(start + fullLen, range.bodyEnd);
      const after = html.slice(range.closeEnd);
      const innerHtml = renderInner(inner);
      const block = `<div class="oep-bbhelp-preview__notice">${innerHtml}</div>`;
      return (
        _replaceBalancedBbcodeNestable(before, renderInner) +
        block +
        _replaceBalancedBbcodeNestable(after, renderInner)
      );
    }

    const { index: start, tag, titleRaw, fullLen } = first;
    const range = _findBbcodeBoxCloseRange(html, start + fullLen, tag);
    if (!range) return html;
    const before = html.slice(0, start);
    const inner = html.slice(start + fullLen, range.bodyEnd);
    const after = html.slice(range.closeEnd);
    const innerHtml = renderInner(inner);
    const boxHtml = _formatBbcodeBoxPreviewHtml(tag, titleRaw, innerHtml);
    return (
      _replaceBalancedBbcodeNestable(before, renderInner) +
      boxHtml +
      _replaceBalancedBbcodeNestable(after, renderInner)
    );
  }

  function _finishBbcodePreviewParagraphs(html) {
    const applyLineBreaks = (str) =>
      str.replace(/(<pre\b[\s\S]*?<\/pre>)|\n/g, (m, pre) => pre ?? "<br>");

    return html
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        const withBr = applyLineBreaks(trimmed);
        if (/^<(ul|ol|pre|blockquote|h\d|div|details)/i.test(trimmed))
          return withBr;
        return `<p>${withBr}</p>`;
      })
      .join("");
  }

  function _bbcodePreviewCore(escaped) {
    let html = escaped;

    html = html.replace(
      /\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi,
      (_, hrefRaw, labelRaw) => {
        const href = _sanitizeHttpPreviewUrl(hrefRaw);
        const label = String(labelRaw || "");
        if (!href) return label;
        return `<a href="${_escapePreviewHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      },
    );
    html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, hrefRaw) => {
      const href = _sanitizeHttpPreviewUrl(hrefRaw);
      if (!href) return String(hrefRaw || "");
      const label = _escapePreviewHtml(href);
      return `<a href="${label}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(
      /\[imagemap=([^\]]+)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeHttpPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\(([^)\]]+)\)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeHttpPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, bodyRaw) => {
        const body = String(bodyRaw || "");
        const srcMatch = body.match(
          /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i,
        );
        const srcUrl = _sanitizeHttpPreviewUrl(srcMatch ? srcMatch[0] : "");
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, srcRaw) => {
      const srcUrl = _sanitizeHttpPreviewUrl(srcRaw);
      if (!srcUrl) return "";
      return `<img src="${_escapePreviewHtml(srcUrl)}" alt="preview image" loading="lazy" referrerpolicy="no-referrer" />`;
    });

    const wrapPairs = [
      ["b", "strong"],
      ["i", "em"],
      ["u", "u"],
      ["s", "del"],
      ["strike", "del"],
      ["quote", "blockquote"],
      ["heading", "h3"],
      ["centre", 'div style="text-align:center;"'],
    ];
    wrapPairs.forEach(([bb, tag]) => {
      const open = tag.includes(" ") ? `<${tag}>` : `<${tag}>`;
      const closeTag = tag.split(" ")[0];
      html = html.replace(
        new RegExp(`\\[${bb}\\]([\\s\\S]*?)\\[\\/${bb}\\]`, "gi"),
        `${open}$1</${closeTag}>`,
      );
    });

    html = html.replace(
      /\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi,
      (_, color, body) => {
        const safeColor = _escapePreviewHtml(
          String(color || "").trim() || "inherit",
        );
        return `<span style="color:${safeColor};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[size=(.*?)\]([\s\S]*?)\[\/size\]/gi,
      (_, sizeRaw, body) => {
        const size = String(sizeRaw || "")
          .trim()
          .toLowerCase();
        const presets = {
          tiny: "0.75em",
          small: "0.88em",
          normal: "1em",
          large: "1.2em",
        };
        const pct = Number(size);
        const computed =
          presets[size] ||
          (Number.isFinite(pct)
            ? `${Math.max(30, Math.min(200, pct))}%`
            : "1em");
        return `<span style="font-size:${computed};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[code\]([\s\S]*?)\[\/code\]/gi,
      "<pre><code>$1</code></pre>",
    );

    html = _replaceBalancedBbcodeNestable(html, (body) =>
      _finishBbcodePreviewParagraphs(_bbcodePreviewCore(body)),
    );

    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, body) => {
      const items = String(body || "")
        .split(/\[\*\]/i)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!items.length) return "";
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    });

    html = html.replace(/\[(\/)?[a-z*]+(?:=[^\]]+)?\]/gi, "");

    return html;
  }

  function _renderSimpleBbcodePreviewHtml(src) {
    const raw = String(src ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    if (!raw.trim()) {
      return `<p class="${BBHELP_PREVIEW_EMPTY_CLASS}">Nothing to preview yet.</p>`;
    }
    const escaped = _escapePreviewHtml(raw);
    const html = _bbcodePreviewCore(escaped);
    return _finishBbcodePreviewParagraphs(html);
  }

  function _findCancelActionNode(editorEl, textarea) {
    const scopeRoots = [
      textarea?.closest("form"),
      editorEl.closest("form"),
      editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
      editorEl.parentElement,
    ].filter((n) => n instanceof HTMLElement);
    for (const scope of scopeRoots) {
      const candidate = Array.from(scope.querySelectorAll("button, a")).find(
        (n) => {
          if (!(n instanceof HTMLElement)) return false;
          const label = String(n.textContent || "")
            .trim()
            .toLowerCase();
          return label === "cancel";
        },
      );
      if (candidate instanceof HTMLElement) return candidate;
    }
    return null;
  }

  function _ensureBbcodeLivePreview(editorEl, textarea) {
    let previewEnabled = false;
    let repaintTimer = 0;

    let toggleBtn = editorEl.querySelector(`[${BBHELP_PREVIEW_TOGGLE_ATTR}]`);
    if (!(toggleBtn instanceof HTMLButtonElement)) {
      toggleBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_PREVIEW_TOGGLE_CLASS,
          [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
          "aria-pressed": "false",
          title: "Toggle live preview",
        },
        "Live preview",
      );
    }

    let preview = editorEl.querySelector(`[${BBHELP_PREVIEW_ATTR}]`);
    if (!(preview instanceof HTMLElement)) {
      preview = el(
        "section",
        {
          class: BBHELP_PREVIEW_CLASS,
          [BBHELP_PREVIEW_ATTR]: "1",
          hidden: "hidden",
        },
        el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
        el("div", { class: BBHELP_PREVIEW_BODY_CLASS }),
      );
      textarea.insertAdjacentElement("afterend", preview);
    }

    const previewBody = preview.querySelector(`.${BBHELP_PREVIEW_BODY_CLASS}`);
    if (!(previewBody instanceof HTMLElement)) return;

    const placeToggle = () => {
      const cancelNode = _findCancelActionNode(editorEl, textarea);
      if (!(cancelNode instanceof HTMLElement)) return;
      const parent = cancelNode.parentElement;
      if (!(parent instanceof HTMLElement)) return;
      if (
        toggleBtn.parentElement !== parent ||
        toggleBtn.nextElementSibling !== cancelNode
      ) {
        cancelNode.insertAdjacentElement("beforebegin", toggleBtn);
      }
    };

    const repaint = () => {
      previewBody.innerHTML = _renderSimpleBbcodePreviewHtml(
        textarea.value || "",
      );
      preview.hidden = !previewEnabled;
      toggleBtn.setAttribute("aria-pressed", previewEnabled ? "true" : "false");
      placeToggle();
    };
    const repaintSoon = () => {
      window.clearTimeout(repaintTimer);
      repaintTimer = window.setTimeout(repaint, 70);
    };

    if (!textarea.hasAttribute(BBHELP_PREVIEW_DONE_ATTR)) {
      textarea.addEventListener("input", repaintSoon);
      toggleBtn.addEventListener("click", () => {
        previewEnabled = !previewEnabled;
        repaint();
      });
      textarea.setAttribute(BBHELP_PREVIEW_DONE_ATTR, "1");
    } else {
      previewEnabled = toggleBtn.getAttribute("aria-pressed") === "true";
    }

    repaint();
  }

  function _enhanceSingleBbcodeEditor(editorEl) {
    if (!(editorEl instanceof HTMLElement)) return;

    const textarea = editorEl.querySelector(BBHELP_INPUT_SELECTOR);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    _ensureBbcodeFormatChecker(editorEl, textarea);
    _ensureBbcodeLivePreview(editorEl, textarea);
    if (editorEl.hasAttribute(BBHELP_DONE_ATTR)) return;

    let editorId = editorEl.getAttribute(BBHELP_EDITOR_ID_ATTR);
    if (!editorId) {
      editorId = `oep-bbhelp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      editorEl.setAttribute(BBHELP_EDITOR_ID_ATTR, editorId);
    }
    const existingWrap = editorEl.querySelector(
      `:scope > .${BBHELP_WRAP_CLASS}`,
    );
    if (existingWrap) {
      editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
      existingWrap.setAttribute(BBHELP_WRAP_FOR_ATTR, editorId);
      return;
    }

    const wrap = el("div", {
      class: BBHELP_WRAP_CLASS,
      [BBHELP_WRAP_FOR_ATTR]: editorId,
    });
    const row = el("div", { class: BBHELP_ROW_CLASS });
    _createBbcodeButtons(textarea).forEach((btn) => row.appendChild(btn));
    wrap.appendChild(row);

    const row2 = el("div", {
      class: BBHELP_ROW_CLASS,
      style: "margin-top:4px;",
    });
    row2.appendChild(
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Open ImageMap helper",
          onclick: () => _openImagemapHelper(textarea),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} fas fa-map-marked-alt` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, "Imagemap helper"),
      ),
    );
    wrap.appendChild(row2);

    editorEl.insertBefore(wrap, editorEl.firstChild);
    editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
  }

  function _isElementActuallyVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!node.isConnected) return false;
    if (node.hidden) return false;
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (node.getClientRects().length === 0) return false;
    return true;
  }

  function teardownBbcodeHelpers() {
    document
      .querySelectorAll(`.${BBHELP_MODAL_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WARN_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_TOGGLE_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WRAP_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`${BBHELP_EDITOR_SELECTOR}[${BBHELP_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_CHECKER_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_CHECKER_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_PREVIEW_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_PREVIEW_DONE_ATTR));
    removeBbcodeHelperStyles();
  }

  /** @returns {function} */
  function startBbcodeHelperManager() {
    injectBbcodeHelperStyles();

    const scan = () => {
      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        const parent = wrap.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (!parent.matches(BBHELP_EDITOR_SELECTOR)) wrap.remove();
      });

      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        const editorId = wrap.getAttribute(BBHELP_WRAP_FOR_ATTR);
        const editor = editorId
          ? document.querySelector(
              `${BBHELP_EDITOR_SELECTOR}[${BBHELP_EDITOR_ID_ATTR}="${editorId}"]`,
            )
          : null;
        if (
          !(editor instanceof HTMLElement) ||
          !_isElementActuallyVisible(editor)
        ) {
          if (editor instanceof HTMLElement) {
            editor.removeAttribute(BBHELP_DONE_ATTR);
          }
          wrap.remove();
        }
      });
      document.querySelectorAll(BBHELP_EDITOR_SELECTOR).forEach((editorEl) => {
        if (_isElementActuallyVisible(editorEl))
          _enhanceSingleBbcodeEditor(editorEl);
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `${BBHELP_EDITOR_SELECTOR}, ${BBHELP_EDITOR_SELECTOR} ${BBHELP_INPUT_SELECTOR}`,
        )
      ) {
        scan();
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      obs.disconnect();
      teardownBbcodeHelpers();
    };
  }

  const CONTENTS_REORDER_STYLE_ID = "osu-expertplus-profile-contents-reorder";
  const CONTENTS_REORDER_ANCHOR_ATTR = "data-oep-contents-reorder-anchor";
  const CONTENTS_REORDER_DRAGGING_CLASS = "oep-contents-reorder--dragging";
  const CONTENTS_REORDER_DRAGOVER_CLASS = "oep-contents-reorder--dragover";
  const CONTENTS_REORDER_DROP_BEFORE_CLASS =
    "oep-contents-reorder--drop-before";
  const CONTENTS_REORDER_DROP_AFTER_CLASS = "oep-contents-reorder--drop-after";
  const CONTENTS_REORDER_GHOST_CLASS = "oep-contents-reorder--ghost";
  const CONTENTS_REORDER_DRAG_THRESHOLD_PX = 12;

  const CONTENTS_REORDER_CSS = `
    a[${CONTENTS_REORDER_ANCHOR_ATTR}] {
      cursor: grab;
      user-select: none;
      display: inline-flex;
      align-items: center;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DRAGGING_CLASS} {
      opacity: 0 !important;
      cursor: grabbing;
      pointer-events: none;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_BEFORE_CLASS} {
      box-shadow: -3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 0 5px 5px 0;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_AFTER_CLASS} {
      box-shadow: 3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 5px 0 0 5px;
    }
    .${CONTENTS_REORDER_GHOST_CLASS} {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      background-color: rgba(255, 255, 255, 0.14);
      color: hsl(var(--hsl-l1));
      white-space: nowrap;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
      user-select: none;
      transform: translate(10px, -50%);
      font-size: 0.875em;
      opacity: 0.95;
    }
  `;

  const contentsReorderStyle = manageStyle(
    CONTENTS_REORDER_STYLE_ID,
    CONTENTS_REORDER_CSS,
  );

  function injectContentsReorderStyles() {
    contentsReorderStyle.inject();
  }

  function removeContentsReorderStyles() {
    contentsReorderStyle.remove();
  }

  function getSectionPageNodes() {
    return Array.from(
      document.querySelectorAll("div.js-sortable--page[data-page-id]"),
    ).filter((n) => n instanceof HTMLElement);
  }

  function sectionIdFromHashHref(href) {
    if (!href || href[0] !== "#") return "";
    const hash = href.slice(1).trim();
    return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
  }

  function getSortableContentsAnchorGroups() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];

    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (allCandidates.length < 3) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });

    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length >= 3,
    );
  }

  /** All hash-tab rows (incl. 1–2 tabs); {@link getSortableContentsAnchorGroups} needs ≥3 for DnD. */
  function getProfileContentsAnchorRows() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];
    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (!allCandidates.length) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });
    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length > 0,
    );
  }

  function getPreferredVisibleContentsGroup(groups) {
    if (!Array.isArray(groups) || !groups.length) return [];
    for (const anchors of groups) {
      const row = anchors[0]?.parentElement;
      if (!(row instanceof HTMLElement)) continue;
      const visible =
        row.offsetParent !== null &&
        window.getComputedStyle(row).display !== "none" &&
        window.getComputedStyle(row).visibility !== "hidden";
      if (visible) return anchors;
    }
    return groups[0] || [];
  }

  function cleanupContentsReorderHints() {
    document
      .querySelectorAll("[data-oep-contents-reorder-hint]")
      .forEach((n) => n.remove());
  }

  function maybeCsrfToken() {
    const m = document.querySelector('meta[name="csrf-token"]');
    if (!(m instanceof HTMLMetaElement)) return "";
    return String(m.content || "").trim();
  }

  async function persistProfileSectionOrder(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const payload = new URLSearchParams();
    sectionIds.forEach((id) =>
      payload.append("user_profile_customization[extras_order][]", id),
    );

    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    const csrf = maybeCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;

    const resp = await fetch("/home/account/options", {
      method: "PUT",
      credentials: "include",
      headers,
      body: payload.toString(),
    });
    if (!resp.ok) throw new Error(`save failed (${resp.status})`);
  }

  function reorderSectionPagesByIds(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const pages = getSectionPageNodes();
    if (!pages.length) return;
    const byId = new Map();
    pages.forEach((p) => {
      byId.set(p.getAttribute("data-page-id"), p);
    });
    const parent = pages[0]?.parentElement;
    if (!parent) return;

    sectionIds.forEach((id) => {
      const node = byId.get(id);
      if (node) parent.appendChild(node);
    });
  }

  const PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSubsectionsCollapsed";
  /** Same as section collapse `SECTION_COLLAPSE_SUBTITLE_SELECTOR` (defined below). */
  const PROFILE_PAGE_SUBTITLE_H3_SELECTOR = "h3.title.title--page-extra-small";
  /** osu `ProfileExtraPage` ids (`data-page-id`) where we skip h3 subsection UI (single block, no sub-titles). */
  const PROFILE_SUBSECTION_SKIP_PAGE_IDS = new Set(["medals"]);
  const SUBSECTION_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-subsection-collapse";
  const SUBSECTION_BODY_HIDDEN_CLASS =
    "oep-profile-subsection-body--collapsed-hidden";
  const SUBSECTION_TITLE_CLASS = "oep-profile-subsection-title";
  const SUBSECTION_TITLE_COLLAPSED_CLASS =
    "oep-profile-subsection-title--collapsed";
  const SUBSECTION_TITLE_MAIN_CLASS = "oep-profile-subsection-title__main";
  const SUBSECTION_TITLE_LABEL_CLASS = "oep-profile-subsection-title__label";
  const SUBSECTION_DONE_ATTR = "data-oep-subsection-collapse";
  const SUBSECTION_BODY_FOR_ATTR = "data-oep-subsection-for";
  const SUBSECTION_TOGGLE_ATTR = "data-oep-profile-subsection-collapse-toggle";
  const SUBSECTION_TOGGLE_FOR_ATTR = "data-oep-profile-subsection-for";
  const SUBSECTION_LABEL_ATTR = "data-oep-subsection-label";
  /** Collapsed dim: title label and `.title__count` pill. */
  const SUBSECTION_COLLAPSED_DIM_OPACITY = "0.64";

  const SUBSECTION_COLLAPSE_CSS = `
    .${SUBSECTION_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35em;
      cursor: pointer;
      line-height: normal;
      padding: 10px 0;
      margin: 0;
      isolation: isolate;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::before {
      z-index: 0;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS}.title.title--page-extra-small::before {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::after {
      content: "";
      position: absolute;
      top: 0;
      right: -8px;
      bottom: 0;
      left: -1.8rem;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small > * {
      position: relative;
      z-index: 2;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0 10px;
      min-width: 0;
      flex: 1 1 auto;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      transition: opacity 120ms ease;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-sizing: border-box;
      margin: 0;
      padding: 0 10px;
      height: 1.85em;
      min-width: 1.85em;
      font-size: 0.8em;
      font-variant-numeric: tabular-nums;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    button.oep-profile-subsection-collapse-toggle {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    button.oep-profile-subsection-collapse-toggle:focus-visible {
      clip-path: none;
      width: auto;
      height: auto;
      margin: 0;
      padding: 2px 6px;
      overflow: visible;
      outline: 1px solid hsl(var(--hsl-l2));
      outline-offset: 1px;
      background: rgba(255, 255, 255, 0.08);
      color: hsl(var(--hsl-l1));
      font-size: 0.75rem;
      z-index: 1;
    }
  `;

  const subsectionCollapseStyle = manageStyle(
    SUBSECTION_COLLAPSE_STYLE_ID,
    SUBSECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSubsectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSubsectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  /**
   * @param {string} text
   * @param {Set<string>} usedSlugs
   * @returns {string}
   */
  function subsectionSlugFromTitle(text, usedSlugs) {
    let base = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) base = "subsection";
    let slug = base;
    let n = 0;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${base}_${n}`;
    }
    usedSlugs.add(slug);
    return slug;
  }

  const SUBSECTION_SHOW_MORE_NAMED_MODIFIERS = new Set([
    "pinned",
    "best",
    "firsts",
    "recent",
  ]);
  const SUBSECTION_SHOW_MORE_SKIP_MODIFIERS = new Set(["loading"]);

  /**
   * osu-web PlayDetailList sets ShowMoreLink modifiers to pinned / best / firsts / recent
   * (language-independent BEM classes). Other pages use generic modifiers; those fall back to
   * index-based keys in the caller.
   * @param {HTMLElement} h3
   * @returns {string|null}
   */
  function subsectionNamedModifierFromFollowingContent(h3) {
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement) {
      if (n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
      const roots = n.matches(".show-more-link")
        ? [n]
        : Array.from(n.querySelectorAll(".show-more-link"));
      for (const sm of roots) {
        for (const c of sm.classList) {
          if (!c.startsWith("show-more-link--")) continue;
          const mod = c.slice("show-more-link--".length);
          if (SUBSECTION_SHOW_MORE_SKIP_MODIFIERS.has(mod)) continue;
          if (SUBSECTION_SHOW_MORE_NAMED_MODIFIERS.has(mod)) return mod;
        }
      }
      n = n.nextElementSibling;
    }
    return null;
  }

  /**
   * @param {Set<string>} collapsedSet
   * @param {string} legacyKey
   * @param {string} stableKey
   * @returns {boolean} true if collapsedSet was mutated
   */
  function migrateSubsectionCollapseLegacyKey(
    collapsedSet,
    legacyKey,
    stableKey,
  ) {
    if (!legacyKey || !stableKey || legacyKey === stableKey) return false;
    if (!collapsedSet.has(legacyKey)) return false;
    collapsedSet.add(stableKey);
    collapsedSet.delete(legacyKey);
    return true;
  }

  /**
   * @param {HTMLElement} h3
   * @returns {HTMLElement[]}
   */
  function collectSubsectionBodyElements(h3) {
    const recentHeader = h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`);
    if (recentHeader instanceof HTMLElement && recentHeader.contains(h3)) {
      const bodies = [];
      let n = h3.nextElementSibling;
      while (n instanceof HTMLElement) {
        bodies.push(n);
        n = n.nextElementSibling;
      }
      let p = recentHeader.nextElementSibling;
      while (p instanceof HTMLElement) {
        if (p.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
        bodies.push(p);
        p = p.nextElementSibling;
      }
      return bodies;
    }

    const bodies = [];
    let n = h3.nextElementSibling;
    while (
      n instanceof HTMLElement &&
      !n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)
    ) {
      bodies.push(n);
      n = n.nextElementSibling;
    }
    return bodies;
  }

  /**
   * Wraps title text (and segments between counts) so collapsed opacity applies only to the name,
   * not the count pill. Keeps `.title__count` in an inline-flex row for vertical alignment.
   * @param {HTMLElement} h3
   * @param {HTMLElement} btn
   */
  function wrapSubsectionTitleContent(h3, btn) {
    if (h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`)) return;
    if (!btn.nextSibling) return;
    const main = el("span", { class: SUBSECTION_TITLE_MAIN_CLASS });
    let n = btn.nextSibling;
    let label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
    while (n) {
      const next = n.nextSibling;
      if (n instanceof HTMLElement && n.classList.contains("title__count")) {
        if (label.childNodes.length) main.appendChild(label);
        main.appendChild(n);
        label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
      } else {
        label.appendChild(n);
      }
      n = next;
    }
    if (label.childNodes.length) main.appendChild(label);
    if (!main.childNodes.length) return;
    btn.insertAdjacentElement("afterend", main);
  }

  /**
   * @param {HTMLElement} h3
   */
  function unwrapSubsectionTitleMain(h3) {
    const main = h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`);
    if (!(main instanceof HTMLElement)) return;
    while (main.firstChild) {
      h3.insertBefore(main.firstChild, main);
    }
    main.remove();
  }

  /** @param {string} key */
  function toggleProfileSubsectionCollapsedKey(key) {
    if (!key) return;
    const set = readProfileSubsectionsCollapsedSet();
    if (set.has(key)) set.delete(key);
    else set.add(key);
    writeProfileSubsectionsCollapsedSet(set);
    applyProfileSubsectionCollapseState(set);
  }

  /** @param {Set<string>} collapsed */
  function applyProfileSubsectionCollapseState(collapsed) {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const key = el.getAttribute(SUBSECTION_BODY_FOR_ATTR);
      if (!key) return;
      if (collapsed.has(key)) el.classList.add(SUBSECTION_BODY_HIDDEN_CLASS);
      else el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document
      .querySelectorAll(`button[${SUBSECTION_TOGGLE_ATTR}]`)
      .forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR);
        if (!key) return;
        const isCollapsed = collapsed.has(key);
        btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
        const label = btn.getAttribute(SUBSECTION_LABEL_ATTR) || key;
        btn.title = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;
        btn.setAttribute(
          "aria-label",
          isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        );
        const h3El = btn.closest("h3");
        if (h3El) {
          h3El.classList.toggle(SUBSECTION_TITLE_COLLAPSED_CLASS, isCollapsed);
        }
      });
  }

  function teardownProfileSubsectionCollapse() {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      el.removeAttribute(SUBSECTION_BODY_FOR_ATTR);
      el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document.querySelectorAll(`h3[${SUBSECTION_DONE_ATTR}]`).forEach((h3) => {
      if (!(h3 instanceof HTMLElement)) return;
      const wrap =
        /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */ (
          h3
        );
      wrap._oepSubsectionAc?.abort();
      delete wrap._oepSubsectionAc;
      unwrapSubsectionTitleMain(h3);
      h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`)?.remove();
      h3.removeAttribute(SUBSECTION_DONE_ATTR);
      h3.classList.remove(
        SUBSECTION_TITLE_CLASS,
        SUBSECTION_TITLE_COLLAPSED_CLASS,
      );
    });
  }

  /**
   * @param {HTMLElement} pageEl  div.js-sortable--page
   * @param {Set<string>} collapsedSet  live set; legacy slug keys are migrated into stable keys
   * @returns {boolean} true if collapsedSet was mutated (caller should persist)
   */
  function enhanceSortablePageSubsections(pageEl, collapsedSet) {
    const pageId = pageEl.getAttribute("data-page-id");
    if (!pageId) return false;
    if (PROFILE_SUBSECTION_SKIP_PAGE_IDS.has(pageId)) return false;
    const usedSlugs = new Set();
    let subsectionIndex = 0;
    let migrationDirty = false;
    const h3s = pageEl.querySelectorAll(PROFILE_PAGE_SUBTITLE_H3_SELECTOR);
    for (const h3 of h3s) {
      if (!(h3 instanceof HTMLElement)) continue;
      if (h3.closest(".js-sortable--page") !== pageEl) continue;
      if (h3.hasAttribute(SUBSECTION_DONE_ATTR)) continue;

      const label = String(h3.textContent || "").trim() || pageId;
      const legacyKey = `${pageId}::${subsectionSlugFromTitle(label, usedSlugs)}`;
      const namedMod = subsectionNamedModifierFromFollowingContent(h3);
      const stableKey = namedMod
        ? `${pageId}::${namedMod}`
        : `${pageId}::sub_${subsectionIndex}`;
      subsectionIndex += 1;

      if (
        migrateSubsectionCollapseLegacyKey(collapsedSet, legacyKey, stableKey)
      ) {
        migrationDirty = true;
      }

      const isCollapsed = collapsedSet.has(stableKey);

      const bodies = collectSubsectionBodyElements(h3);
      bodies.forEach((b) =>
        b.setAttribute(SUBSECTION_BODY_FOR_ATTR, stableKey),
      );

      const btn = el("button", {
        type: "button",
        class: "oep-profile-subsection-collapse-toggle",
        [SUBSECTION_TOGGLE_ATTR]: "1",
        [SUBSECTION_TOGGLE_FOR_ATTR]: stableKey,
        [SUBSECTION_LABEL_ATTR]: label,
        "aria-expanded": isCollapsed ? "false" : "true",
        title: isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        "aria-label": isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
      });
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleProfileSubsectionCollapsedKey(stableKey);
      });

      const subsectionAc = new AbortController();
      /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */
      (h3)._oepSubsectionAc = subsectionAc;
      h3.addEventListener(
        "click",
        (ev) => {
          const t = ev.target;
          if (!(t instanceof Element)) return;
          if (t.closest(`button[${SUBSECTION_TOGGLE_ATTR}]`)) return;
          if (t.closest("a[href]")) return;
          toggleProfileSubsectionCollapsedKey(stableKey);
        },
        { signal: subsectionAc.signal },
      );

      h3.insertBefore(btn, h3.firstChild);
      wrapSubsectionTitleContent(h3, btn);
      h3.classList.add(SUBSECTION_TITLE_CLASS);
      if (isCollapsed) h3.classList.add(SUBSECTION_TITLE_COLLAPSED_CLASS);
      h3.setAttribute(SUBSECTION_DONE_ATTR, "1");
    }
    return migrationDirty;
  }

  function scanProfileSubsections() {
    teardownProfileSubsectionCollapse();
    const collapsedSet = readProfileSubsectionsCollapsedSet();
    let migrationDirty = false;
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement) {
        if (enhanceSortablePageSubsections(page, collapsedSet)) {
          migrationDirty = true;
        }
      }
    });
    if (migrationDirty) {
      writeProfileSubsectionsCollapsedSet(collapsedSet);
    }
    applyProfileSubsectionCollapseState(collapsedSet);
  }

  /** @returns {function} */
  function startProfileSubsectionCollapseManager() {
    subsectionCollapseStyle.inject();

    let debounceTimer = 0;
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        scanProfileSubsections();
      }, 80);
    };

    scanProfileSubsections();

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `div.js-sortable--page[data-page-id], ${PROFILE_PAGE_SUBTITLE_H3_SELECTOR}, .${RECENT_FAILS_WRAP_CLASS}`,
        )
      ) {
        schedule();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      teardownProfileSubsectionCollapse();
      subsectionCollapseStyle.remove();
    };
  }

  const PROFILE_SECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSectionsCollapsed";
  const SECTION_COLLAPSE_PAGE_CLASS = "oep-profile-section--collapsed";
  const SECTION_COLLAPSE_BODY_HIDDEN_CLASS =
    "oep-profile-section-body--collapsed-hidden";
  const SECTION_COLLAPSE_MAIN_TITLE_SELECTOR = "h2.title.title--page-extra";
  const SECTION_COLLAPSE_SUBTITLE_SELECTOR = "h3.title.title--page-extra-small";
  const SECTION_TAB_COLLAPSED_CLASS = "oep-profile-section-tab--collapsed";
  const SECTION_PAGE_TITLE_CLICK_ATTR =
    "data-oep-profile-section-page-title-click";
  const SECTION_TAB_CHEVRON_ATTR = "data-oep-section-tab-chevron";
  const SECTION_CONTENTS_ROW_CLASS = "oep-profile-contents-row";
  const SECTION_PAGE_TITLE_TOGGLE_CLASS =
    "oep-profile-section-page-title--toggle";
  const SECTION_PAGE_TITLE_LABEL_CLASS =
    "oep-profile-section-page-title__label";
  const SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS =
    "oep-profile-section-page-title__collapsed-suffix";
  const SECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-section-collapse";

  const SECTION_COLLAPSE_CSS = `
    .${SECTION_COLLAPSE_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small):not(div.u-relative:has(> h2.title.title--page-extra)) {
      display: none !important;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      > div.u-relative
      > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small) {
      display: none !important;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra {
      cursor: pointer;
      user-select: none;
      position: relative;
      isolation: isolate;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra > .${SECTION_PAGE_TITLE_LABEL_CLASS} {
      position: relative;
      z-index: 2;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::after {
      content: "";
      position: absolute;
      top: -0.25em;
      right: -0.55em;
      bottom: -0.25em;
      left: -1.5em;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    div.js-sortable--page
      h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra
      > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS} {
      position: relative;
      z-index: 2;
      font-weight: 600;
      font-size: 0.88em;
      opacity: 0.9;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translate(calc(-100% - 0.7em), -50%);
      font-size: 0.65em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      pointer-events: none;
      transition: opacity 120ms ease;
      z-index: 2;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      h2.title.title--page-extra.${SECTION_PAGE_TITLE_TOGGLE_CLASS}::before {
      content: "\\f078";
      opacity: 0.8;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS} .page-mode-link,
    a.${SECTION_TAB_COLLAPSED_CLASS} .fake-bold {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS}:not(:has(.page-mode-link)):not(:has(.fake-bold)) {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    .page-mode.page-mode--profile-page-extra {
      gap: 0 !important;
      column-gap: 0 !important;
      row-gap: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"] {
      margin-right: 0.85em !important;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      box-sizing: border-box;
      transition: background-color 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:hover {
      background-color: rgba(255, 255, 255, 0.07);
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:last-child {
      margin-right: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      font-size: 0.82em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      margin-right: 0.25em;
      flex-shrink: 0;
      transition: color 120ms ease, opacity 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]::before {
      content: "\\f078";
      opacity: 0.8;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
  `;

  const sectionCollapseStyle = manageStyle(
    SECTION_COLLAPSE_STYLE_ID,
    SECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  function clearProfileSectionCollapseBodyHidden(page) {
    page
      .querySelectorAll(`.${SECTION_COLLAPSE_BODY_HIDDEN_CLASS}`)
      .forEach((el) => el.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS));
    page.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
  }

  /**
   * Direct children of a sortable section that should stay visible when collapsed
   * (main h2 row with optional drag handle, or inline sub-headings).
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  function profileSectionCollapseKeepsChildVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR)) return true;
    if (el.matches(SECTION_COLLAPSE_SUBTITLE_SELECTOR)) return true;
    if (
      el.matches("div.u-relative") &&
      el.querySelector(`:scope > ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}`)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Hide non-heading children so in-page section titles stay visible.
   * Follows single-child wrappers briefly (some layouts nest one div).
   * @param {HTMLElement} pageEl
   * @param {number} depth
   * @returns {boolean} true when headings were found and body nodes hidden
   */
  /**
   * "(Collapsed)" is a real node so `h2::after` stays the hover overlay (same as expanded).
   * @param {HTMLElement} pageEl
   * @param {boolean} isCollapsed
   */
  function syncProfileSectionPageTitleCollapsedSuffix(pageEl, isCollapsed) {
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (!h2.classList.contains(SECTION_PAGE_TITLE_TOGGLE_CLASS)) return;
    const existing = h2.querySelector(
      `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
    );
    if (isCollapsed) {
      if (!existing) {
        h2.appendChild(
          el(
            "span",
            { class: SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS },
            " (Collapsed)",
          ),
        );
      }
    } else {
      existing?.remove();
    }
  }

  function markProfileSectionBodyCollapsed(pageEl, depth) {
    if (depth > 4) return false;
    const kids = [...pageEl.children].filter((n) => n instanceof HTMLElement);
    if (!kids.length) return false;
    const hasKept = kids.some(profileSectionCollapseKeepsChildVisible);
    if (hasKept) {
      kids.forEach((k) => {
        if (profileSectionCollapseKeepsChildVisible(k)) {
          k.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        } else {
          k.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        }
      });
      return true;
    }
    if (kids.length === 1) {
      return markProfileSectionBodyCollapsed(kids[0], depth + 1);
    }
    return false;
  }

  function applyProfileSectionCollapseToPages(collapsed) {
    getSectionPageNodes().forEach((node) => {
      const id = node.getAttribute("data-page-id");
      if (!id) return;
      clearProfileSectionCollapseBodyHidden(node);
      node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);

      if (!collapsed.has(id)) {
        syncProfileSectionPageTitleCollapsedSuffix(node, false);
        return;
      }

      node.classList.add(SECTION_COLLAPSE_PAGE_CLASS);
      if (!markProfileSectionBodyCollapsed(node, 0)) {
        node.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      }
      syncProfileSectionPageTitleCollapsedSuffix(node, true);
    });
    applyProfileSubsectionCollapseState(readProfileSubsectionsCollapsedSet());
  }

  function applyProfileSectionCollapseToTabAnchors(collapsed) {
    getProfileContentsAnchorRows()
      .flat()
      .forEach((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const sectionId = sectionIdFromHashHref(
          anchor.getAttribute("href") || "",
        );
        if (!sectionId) return;
        const isCollapsed = collapsed.has(sectionId);
        if (isCollapsed) anchor.classList.add(SECTION_TAB_COLLAPSED_CLASS);
        else anchor.classList.remove(SECTION_TAB_COLLAPSED_CLASS);

        anchor.setAttribute(
          SECTION_TAB_CHEVRON_ATTR,
          isCollapsed ? "collapsed" : "expanded",
        );
        const parent = anchor.parentElement;
        if (parent) parent.classList.add(SECTION_CONTENTS_ROW_CLASS);
      });
  }

  function cleanupProfileSectionCollapseToggles() {
    document
      .querySelectorAll("button.oep-profile-section-collapse-toggle")
      .forEach((n) => n.remove());
  }

  function teardownProfileSectionPageTitleClick() {
    document
      .querySelectorAll(`h2[${SECTION_PAGE_TITLE_CLICK_ATTR}]`)
      .forEach((h2) => {
        if (!(h2 instanceof HTMLElement)) return;
        const wrap =
          /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */ (
            h2
          );
        wrap._oepSectionPageTitleAc?.abort();
        delete wrap._oepSectionPageTitleAc;
        h2.querySelectorAll(
          `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
        ).forEach((n) => n.remove());
        const label = h2.querySelector(
          `:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`,
        );
        if (label instanceof HTMLElement) {
          while (label.firstChild) h2.insertBefore(label.firstChild, label);
          label.remove();
        }
        h2.removeAttribute(SECTION_PAGE_TITLE_CLICK_ATTR);
        h2.classList.remove(SECTION_PAGE_TITLE_TOGGLE_CLASS);
      });
  }

  function teardownProfileContentsTabChevrons() {
    document
      .querySelectorAll(`a[${SECTION_TAB_CHEVRON_ATTR}]`)
      .forEach((a) => a.removeAttribute(SECTION_TAB_CHEVRON_ATTR));
    document
      .querySelectorAll(`.${SECTION_CONTENTS_ROW_CLASS}`)
      .forEach((n) => n.classList.remove(SECTION_CONTENTS_ROW_CLASS));
  }

  /**
   * Delegated click handler: if the click lands on the ::before chevron area of
   * a contents-row tab anchor, toggle section collapse instead of navigating.
   * @param {MouseEvent} ev
   */
  function onContentsTabChevronClick(ev) {
    const a = /** @type {Element|null} */ (ev.target);
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!a.hasAttribute(SECTION_TAB_CHEVRON_ATTR)) return;
    const rect = a.getBoundingClientRect();
    const style = window.getComputedStyle(a, "::before");
    const beforeWidth = parseFloat(style.width) || 0;
    const paddingLeft = parseFloat(window.getComputedStyle(a).paddingLeft) || 0;
    const chevronRight = rect.left + paddingLeft + beforeWidth + 4;
    if (ev.clientX > chevronRight) return;
    ev.preventDefault();
    ev.stopPropagation();
    const sectionId = sectionIdFromHashHref(a.getAttribute("href") || "");
    if (sectionId) toggleProfileSectionCollapsedId(sectionId);
  }

  /**
   * Toggle section collapse from the in-page `h2` or from the contents-row chevron (tab label still navigates).
   * @param {string} sectionId  data-page-id
   */
  function toggleProfileSectionCollapsedId(sectionId) {
    if (!sectionId) return;
    const set = readProfileSectionsCollapsedSet();
    if (set.has(sectionId)) set.delete(sectionId);
    else set.add(sectionId);
    writeProfileSectionsCollapsedSet(set);
    applyProfileSectionCollapseToPages(set);
    applyProfileSectionCollapseToTabAnchors(set);
  }

  /** @param {HTMLElement} pageEl  div.js-sortable--page[data-page-id] */
  function bindProfileSectionPageTitleClickOnPage(pageEl) {
    const sectionId = pageEl.getAttribute("data-page-id");
    if (!sectionId) return;
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (h2.hasAttribute(SECTION_PAGE_TITLE_CLICK_ATTR)) return;

    h2.classList.add(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    h2.setAttribute(SECTION_PAGE_TITLE_CLICK_ATTR, sectionId);

    if (!h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`)) {
      const label = el("span", { class: SECTION_PAGE_TITLE_LABEL_CLASS });
      while (h2.firstChild) label.appendChild(h2.firstChild);
      h2.appendChild(label);
    }

    const ac = new AbortController();
    /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */
    (h2)._oepSectionPageTitleAc = ac;
    h2.addEventListener(
      "click",
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        if (t.closest("a[href]")) return;
        if (t.closest("button")) return;
        if (t.closest("input, select, textarea, label")) return;
        toggleProfileSectionCollapsedId(sectionId);
      },
      { signal: ac.signal },
    );
  }

  function bindProfileSectionPageTitleClicks() {
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement)
        bindProfileSectionPageTitleClickOnPage(page);
    });
  }

  /** @returns {function} */
  function startProfileSectionCollapseManager() {
    sectionCollapseStyle.inject();

    let rebindTimer = 0;
    let obs = null;

    const bind = () => {
      clearTimeout(rebindTimer);
      cleanupProfileSectionCollapseToggles();
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();

      const collapsed = readProfileSectionsCollapsedSet();
      applyProfileSectionCollapseToPages(collapsed);
      applyProfileSectionCollapseToTabAnchors(collapsed);

      bindProfileSectionPageTitleClicks();

      getSectionPageNodes().forEach((node) => {
        const id = node.getAttribute("data-page-id");
        if (!id) return;
        syncProfileSectionPageTitleCollapsedSuffix(node, collapsed.has(id));
      });
    };

    bind();
    document.addEventListener("click", onContentsTabChevronClick, true);
    obs = new MutationObserver((mutations) => {
      const needsRebind = mutationsIncludeSelector(
        mutations,
        'div.js-sortable--page[data-page-id], a[href^="#"], h2.title.title--page-extra',
      );

      if (needsRebind) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearTimeout(rebindTimer);
      obs?.disconnect();
      document.removeEventListener("click", onContentsTabChevronClick, true);
      cleanupProfileSectionCollapseToggles();
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();
      getSectionPageNodes().forEach((node) => {
        node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
        clearProfileSectionCollapseBodyHidden(node);
      });
      document
        .querySelectorAll(`a.${SECTION_TAB_COLLAPSED_CLASS}`)
        .forEach((a) => a.classList.remove(SECTION_TAB_COLLAPSED_CLASS));
      sectionCollapseStyle.remove();
    };
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLAnchorElement} source
   * @returns {HTMLAnchorElement|null}
   */
  function contentsReorderTargetFromPoint(clientX, clientY, source) {
    const row = source.parentElement;
    if (!row) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof Element)) continue;
      const a = n.closest(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`);
      if (
        a instanceof HTMLAnchorElement &&
        a !== source &&
        a.parentElement === row
      )
        return a;
    }
    return null;
  }

  /** @returns {function} */
  function startContentsReorderManager() {
    injectContentsReorderStyles();

    let dragAnchor = null;
    let ghostEl = /** @type {HTMLElement|null} */ (null);
    let obs = null;
    let rebindTimer = 0;
    /** Section IDs in current visual order; null means DOM order is authoritative. */
    let currentTabOrder = /** @type {string[]|null} */ (null);
    /**
     * @type {{
     *   anchor: HTMLAnchorElement;
     *   pointerId: number;
     *   startX: number;
     *   startY: number;
     *   armed: boolean;
     *   onMove: (e: PointerEvent) => void;
     *   onUp: (e: PointerEvent) => void;
     * } | null}
     */
    let pointerSession = null;

    /**
     * Returns anchors in their current visual order.
     * Uses `currentTabOrder` when set, otherwise falls back to DOM order.
     * @param {HTMLElement} row
     * @returns {HTMLAnchorElement[]}
     */
    function getOrderedAnchors(row) {
      const anchors = /** @type {HTMLAnchorElement[]} */ (
        Array.from(
          row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`),
        ).filter((a) => a instanceof HTMLAnchorElement)
      );
      if (!currentTabOrder) return anchors;
      const byId = new Map(
        anchors.map((a) => [
          sectionIdFromHashHref(a.getAttribute("href") || ""),
          a,
        ]),
      );
      const ordered = /** @type {HTMLAnchorElement[]} */ (
        currentTabOrder.map((id) => byId.get(id)).filter(Boolean)
      );
      const inOrder = new Set(currentTabOrder);
      anchors.forEach((a) => {
        const id = sectionIdFromHashHref(a.getAttribute("href") || "");
        if (id && !inOrder.has(id)) ordered.push(a);
      });
      return ordered;
    }

    /**
     * Applies CSS flexbox `order` to visually reorder tabs without touching React-managed DOM nodes.
     * Each chevron button gets an even order value; its anchor gets odd (chevron always visually first).
     * @param {HTMLAnchorElement[]} anchors ordered array representing desired visual sequence
     * @param {HTMLElement} row
     */
    function applyTabCssOrder(anchors) {
      anchors.forEach((a, i) => {
        a.style.order = String(i);
      });
    }

    const removeGhost = () => {
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
    };

    const clearDragClasses = () => {
      if (ghostEl) removeGhost();
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    };

    const saveOrderFrom = async (anchors) => {
      const ids = anchors
        .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
        .filter(Boolean);
      reorderSectionPagesByIds(ids);
      try {
        await persistProfileSectionOrder(ids);
      } catch {
        /* order stays reordered in DOM only */
      }
    };

    function clearRowDropIndicators(row) {
      row
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DRAGOVER_CLASS,
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    }

    function endPointerSession() {
      const s = pointerSession;
      pointerSession = null;
      if (!s) return;
      removeGhost();
      s.anchor.removeEventListener("pointermove", s.onMove);
      s.anchor.removeEventListener("pointerup", s.onUp);
      s.anchor.removeEventListener("pointercancel", s.onUp);
      try {
        s.anchor.releasePointerCapture(s.pointerId);
      } catch (_) {}
    }

    const onPointerDown = (ev) => {
      const anchor = ev.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (ev.button !== 0) return;
      if (pointerSession) return;

      const startX = ev.clientX;
      const startY = ev.clientY;

      const onMove = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.armed) {
          if (Math.hypot(dx, dy) < CONTENTS_REORDER_DRAG_THRESHOLD_PX) return;
          s.armed = true;
          dragAnchor = s.anchor;
          s.anchor.classList.add(CONTENTS_REORDER_DRAGGING_CLASS);
          ghostEl = document.createElement("div");
          ghostEl.className = CONTENTS_REORDER_GHOST_CLASS;
          ghostEl.textContent = s.anchor.textContent || "";
          document.body.appendChild(ghostEl);
        }
        if (ghostEl) {
          ghostEl.style.left = `${e.clientX}px`;
          ghostEl.style.top = `${e.clientY}px`;
        }
        const row = s.anchor.parentElement;
        if (!(row instanceof HTMLElement)) return;
        const hit = contentsReorderTargetFromPoint(
          e.clientX,
          e.clientY,
          s.anchor,
        );
        clearRowDropIndicators(row);
        if (hit) {
          const hitRect = hit.getBoundingClientRect();
          const insertAfter = e.clientX > hitRect.left + hitRect.width / 2;
          hit.classList.add(
            insertAfter
              ? CONTENTS_REORDER_DROP_AFTER_CLASS
              : CONTENTS_REORDER_DROP_BEFORE_CLASS,
          );
        }
      };

      const onUp = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        endPointerSession();

        if (s.armed && dragAnchor) {
          const hit = contentsReorderTargetFromPoint(
            e.clientX,
            e.clientY,
            s.anchor,
          );
          const row = s.anchor.parentElement;
          if (
            hit &&
            dragAnchor &&
            hit !== dragAnchor &&
            row &&
            hit.parentElement === row
          ) {
            hit.classList.remove(
              CONTENTS_REORDER_DROP_BEFORE_CLASS,
              CONTENTS_REORDER_DROP_AFTER_CLASS,
            );
            const targetRect = hit.getBoundingClientRect();
            const insertAfter =
              e.clientX > targetRect.left + targetRect.width / 2;

            const currentAnchors = getOrderedAnchors(row);
            const newAnchors = currentAnchors.filter((a) => a !== dragAnchor);
            const hitIdx = newAnchors.indexOf(hit);
            newAnchors.splice(insertAfter ? hitIdx + 1 : hitIdx, 0, dragAnchor);

            currentTabOrder = newAnchors
              .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
              .filter(Boolean);
            applyTabCssOrder(newAnchors);
            void saveOrderFrom(newAnchors);
          }
          const suppressClick = (ce) => {
            ce.preventDefault();
            ce.stopPropagation();
            s.anchor.removeEventListener("click", suppressClick, true);
          };
          s.anchor.addEventListener("click", suppressClick, true);
        }

        removeGhost();
        dragAnchor = null;
        clearDragClasses();
      };

      pointerSession = {
        anchor,
        pointerId: ev.pointerId,
        startX,
        startY,
        armed: false,
        onMove,
        onUp,
      };

      try {
        anchor.setPointerCapture(ev.pointerId);
      } catch (_) {}

      anchor.addEventListener("pointermove", onMove);
      anchor.addEventListener("pointerup", onUp);
      anchor.addEventListener("pointercancel", onUp);
    };

    const bind = () => {
      clearTimeout(rebindTimer);
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      const groups = getSortableContentsAnchorGroups();
      const visibleGroup = getPreferredVisibleContentsGroup(groups);
      cleanupContentsReorderHints();

      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
          );
        });

      groups.flat().forEach((a) => {
        a.setAttribute(CONTENTS_REORDER_ANCHOR_ATTR, "1");
        a.removeAttribute("draggable");
        a.setAttribute("title", `Drag to reorder`);
        a.addEventListener("pointerdown", onPointerDown);
      });

      if (currentTabOrder) {
        groups.forEach((anchors) => {
          const row = anchors[0]?.parentElement;
          if (!(row instanceof HTMLElement)) return;
          applyTabCssOrder(getOrderedAnchors(row));
        });
      }
    };

    bind();
    obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          'div.js-sortable--page[data-page-id], a[href^="#"]',
        )
      ) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearTimeout(rebindTimer);
      obs?.disconnect();
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
          );
        });
      cleanupContentsReorderHints();
      removeContentsReorderStyles();
    };
  }

  let _scoreCleanup = null;
  let _recentFailsCleanup = null;

  /**
   * @param {RegExpMatchArray} _match
   * @returns {function}
   */
  function init(_match) {
    const cleanups = [];

    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(
        settings,
        manageStyle,
      ),
    );
    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );

    cleanups.push(
      OsuExpertPlus.beatmapCardExtra.start(settings, {
        hookProfileExtraPages: true,
      }),
    );

    cleanups.push(startRanksDateHighlightManager());
    cleanups.push(startProfileBadgesCollapseManager());
    cleanups.push(startProfileSectionCollapseManager());
    cleanups.push(startProfileSubsectionCollapseManager());
    cleanups.push(startBbcodeHelperManager());
    const profileUserId = getProfileUserId();
    const currentUserId = getCurrentUserIdFromHeader();
    if (
      profileUserId != null &&
      currentUserId != null &&
      String(profileUserId) === String(currentUserId)
    ) {
      cleanups.push(startContentsReorderManager());
    }

    const needsScoreFeatures = true;

    if (needsScoreFeatures) {
      const userId = profileUserId;
      const mode = getCurrentMode();
      if (userId) {
        initScoreFeatures(userId, mode).then((cleanup) => {
          _scoreCleanup = cleanup;
        });
        _recentFailsCleanup = startRecentScoresWithFailsObserver(userId, mode);
      }
    }

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      if (typeof _recentFailsCleanup === "function") {
        _recentFailsCleanup();
        _recentFailsCleanup = null;
      }
      if (typeof _scoreCleanup === "function") {
        _scoreCleanup();
        _scoreCleanup = null;
      }
    };
  }

  return { name, init };
})();

/* ── src/pages/account-edit.js ── */
/** /home/account/edit — OAuth “Own Clients” setup guide when creds unset. */

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.accountEdit = (() => {
  const name = 'AccountEdit';
  const { el, waitForElement, manageStyle } = OsuExpertPlus.dom;
  const auth = OsuExpertPlus.auth;

  const GUIDE_ID    = 'oep-oauth-guide';

  const CSS = `
    #${GUIDE_ID} {
      border-radius: 8px;
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    #${GUIDE_ID}.oep-guide--done {
      display: none;
    }
    .oep-guide__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .oep-guide__icon {
      font-size: 16px;
      color: hsl(var(--hsl-pink, 333 100% 65%));
      flex-shrink: 0;
    }
    .oep-guide__title {
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      flex: 1;
    }
    .oep-guide__dismiss {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.4;
      padding: 0 2px;
      line-height: 1;
      transition: opacity 150ms;
    }
    .oep-guide__dismiss:hover { opacity: 1; }

    .oep-guide__body {
      font-size: 12px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-bottom: 10px;
    }
    .oep-guide__body b { font-weight: 600; opacity: 1; }

    .oep-guide__footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-top: 10px;
      border-top: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    }
    .oep-guide__status {
      flex: 1;
      font-size: 12px;
      opacity: 0.55;
    }
    .oep-guide__status--ok {
      color: #84e03a;
      opacity: 1;
    }
    .oep-guide__open-panel-btn {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .oep-guide__open-panel-btn:hover { opacity: 0.85; }
  `;

  const guideStyle = manageStyle('oep-account-edit-style', CSS);

  function buildGuide() {
    const body = el('div', { class: 'oep-guide__body' },
      'Register a new application below, copy its ',
      el('b', {}, 'Client ID'), ' and ', el('b', {}, 'Client Secret'),
      ', then paste them into the ', el('b', {}, '⚙ Expert+ panel'), ' (bottom-right corner).',
    );

    const statusEl = el('div', { class: 'oep-guide__status' },
      'No credentials saved yet.',
    );

    const openBtn = el('button', { class: 'oep-guide__open-panel-btn' },
      '⚙ Open Expert+ Settings',
    );
    openBtn.addEventListener('click', () => {
      // Trigger a click on the floating FAB to open the panel.
      document.getElementById('osu-expertplus-fab')?.click();
    });

    const dismissBtn = el('button', { class: 'oep-guide__dismiss', title: 'Dismiss' }, '✕');
    dismissBtn.addEventListener('click', () => {
      guide.classList.add('oep-guide--done');
    });

    const footer = el('div', { class: 'oep-guide__footer' }, statusEl, openBtn);

    const guide = el('div', { id: GUIDE_ID },
      el('div', { class: 'oep-guide__header' },
        el('i', { class: 'oep-guide__icon fas fa-key' }),
        el('div', { class: 'oep-guide__title' }, 'Set up osu! Expert+ API access'),
        dismissBtn,
      ),
      body,
      footer,
    );

    // React to credential changes without a page reload.
    function syncState() {
      if (auth.isConfigured()) {
        statusEl.textContent = '✓ Credentials saved — API v2 active!';
        statusEl.className = 'oep-guide__status oep-guide__status--ok';
        openBtn.style.display = 'none';

        // Auto-hide after a short delay so the user sees the success message.
        setTimeout(() => guide.classList.add('oep-guide--done'), 3000);
      } else {
        statusEl.textContent = 'No credentials saved yet.';
        statusEl.className = 'oep-guide__status';
        openBtn.style.display = '';
        guide.classList.remove('oep-guide--done');
      }
    }

    // Poll GM storage for credential changes (cross-tab / after panel save).
    // GM_addValueChangeListener would be ideal but isn't universally available.
    const pollInterval = setInterval(syncState, 1500);
    guide._stopPolling = () => clearInterval(pollInterval);

    syncState();
    return guide;
  }

  /** OAuth section’s `.account-edit__input-groups` (title match or #oauth). */
  function findOAuthInputGroups() {
    const titles = document.querySelectorAll('.account-edit__section-title');
    for (const title of titles) {
      if (/oauth/i.test(title.textContent)) {
        return title.closest('.account-edit')?.querySelector('.account-edit__input-groups') ?? null;
      }
    }
    // Fallback: find by the named anchor (#oauth or #oauth2).
    for (const anchor of ['oauth', 'oauth2']) {
      const el = document.getElementById(anchor) ?? document.querySelector(`[name="${anchor}"]`);
      if (el) {
        return el.closest('.account-edit')?.querySelector('.account-edit__input-groups')
          ?? el.closest('section')
          ?? null;
      }
    }
    return null;
  }

  let _guide = null;

  async function init(_match) {
    guideStyle.inject();

    // Wait for the React-rendered OAuth section to appear.
    let inputGroups;
    try {
      await waitForElement('.account-edit__section-title', 10000);
      inputGroups = findOAuthInputGroups();
    } catch {
      return cleanup;
    }

    if (!inputGroups) {
      return cleanup;
    }

    // Build and prepend the guide.
    _guide = buildGuide();
    inputGroups.prepend(_guide);

    return cleanup;
  }

  function cleanup() {
    _guide?._stopPolling?.();
    document.getElementById(GUIDE_ID)?.remove();
    guideStyle.remove();
    _guide = null;
  }

  return { name, init };
})();

/* ── src/router.js ── */
/** URL → page module; re-inits on SPA navigation. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.Router = class Router {
  constructor() {
    /** @type {{ pattern: RegExp, module: { name: string, init: function } }[]} */
    this._routes = [
      {
        pattern: /^\/home\/account\/edit/,
        module: OsuExpertPlus.pages.accountEdit,
      },
      {
        pattern: /^\/beatmapsets\/(\d+)/,
        module: OsuExpertPlus.pages.beatmapDetail,
      },
      {
        pattern: /^\/beatmapsets(?:\/?)(?!\d)/,
        module: OsuExpertPlus.pages.beatmapsetsListing,
      },
      {
        pattern: /^\/users\//,
        module: OsuExpertPlus.pages.userProfile,
      },
    ];

    this._currentPath = null;
    this._cleanupFn = null;
  }

  /** Start the router, run the matching module, and watch for SPA navigation. */
  init() {
    this._navigate(location.pathname);
    this._watchNavigation();
  }

  _navigate(path) {
    if (path === this._currentPath) return;
    this._currentPath = path;

    // Previous module cleanup
    if (typeof this._cleanupFn === 'function') {
      try { this._cleanupFn(); } catch (_) {}
      this._cleanupFn = null;
    }

    for (const route of this._routes) {
      const match = path.match(route.pattern);
      if (match) {
        try {
          const result = route.module.init(match);
          if (result && typeof result.then === 'function') {
            result.then((fn) => {
              // Ignore cleanup if path changed before async init finished
              if (this._currentPath === path) {
                this._cleanupFn = typeof fn === 'function' ? fn : null;
              } else if (typeof fn === 'function') {
                try { fn(); } catch (_) {}
              }
            }).catch(() => {});
          } else {
            this._cleanupFn = typeof result === 'function' ? result : null;
          }
        } catch (_) {}
        return;
      }
    }
  }

  /** pushState/replaceState wrap, popstate (clears path first), + pathname poll (Inertia may cache pre-wrap history). */
  _watchNavigation() {
    const navigate = this._navigate.bind(this);

    const wrap = (original) =>
      function (...args) {
        const result = original.apply(this, args);
        navigate(location.pathname);
        return result;
      };

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);

    // Back/forward: clear path so dedupe cannot skip the event
    window.addEventListener('popstate', () => {
      this._currentPath = null;
      navigate(location.pathname);
    });

    // Pathname poll: catches history calls that bypass our wrap; 200ms + dedupe avoids double init
    let _polledPath = location.pathname;
    setInterval(() => {
      const path = location.pathname;
      if (path !== _polledPath) {
        _polledPath = path;
        navigate(path);
      }
    }, 200);
  }
};

/* ── src/ui/settings-panel.js ── */
/** FAB + modal: feature toggles, osu OAuth, OMDB key. init() once; survives SPA (re-attach if body replaced). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settingsPanel = (() => {
  const { el } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const auth = OsuExpertPlus.auth;
  const omdb = OsuExpertPlus.omdb;

  const ROOT_ID = "osu-expertplus-settings";
  const FAB_ANCHOR_ID = "osu-expertplus-fab-anchor";
  const OPEN_CLASS = "osu-expertplus-settings--open";
  const SECTION_COLLAPSED_CLASS = "osu-expertplus-panel__section--collapsed";
  const FAB_NEEDS_API_CLASS = "osu-expertplus-fab-anchor--needs-api";
  const MODDED_SR_ROW_ATTR = "data-oep-settings-row-modded-sr";

  /** Set in init(); drives osu! API warning chip + panel offset. */
  const fabUi = { anchor: null, panel: null };

  function applyModdedStarRowLockState(row) {
    const locked = !auth.isConfigured();
    row.classList.toggle("osu-expertplus-panel__row--oauth-required", locked);
    if (locked) {
      row.title =
        "Requires osu! API OAuth credentials. Add Client ID and Secret in the section above.";
    } else {
      row.removeAttribute("title");
    }
    const input = row.querySelector(".osu-expertplus-toggle input");
    if (input instanceof HTMLInputElement) {
      input.tabIndex = locked ? -1 : 0;
    }
    row.classList.toggle(
      "osu-expertplus-panel__row--with-feature-hint",
      locked,
    );
    const hint = row.querySelector("[data-oep-modded-sr-hint]");
    if (hint) {
      if (locked) {
        hint.hidden = false;
        hint.textContent =
          "Requires osu! API OAuth credentials — add Client ID and Secret in the section above.";
      } else {
        hint.hidden = true;
        hint.textContent = "";
      }
    }
  }

  function refreshModdedStarRatingRowLock() {
    const row = fabUi.panel?.querySelector?.(`[${MODDED_SR_ROW_ATTR}]`);
    if (row instanceof HTMLElement) applyModdedStarRowLockState(row);
  }

  function syncPanelAboveFab() {
    const { anchor, panel } = fabUi;
    if (!anchor?.isConnected || !panel?.isConnected) return;
    const top = anchor.getBoundingClientRect().top;
    const gap = 10;
    panel.style.bottom = `${Math.round(window.innerHeight - top + gap)}px`;
  }

  function refreshFabOsuApiWarning() {
    const { anchor } = fabUi;
    if (!anchor) return;
    anchor.classList.toggle(FAB_NEEDS_API_CLASS, !auth.isConfigured());
    syncPanelAboveFab();
  }

  function credentialSectionTitle(kind, filled) {
    if (kind === "osu") {
      return filled
        ? "osu! API credentials — saved"
        : "osu! API credentials — not set";
    }
    return filled ? "OMDB API key — saved" : "OMDB API key — not set";
  }

  const CSS = `
    #${FAB_ANCHOR_ID} {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      max-width: min(320px, calc(100vw - 48px));
    }

    .osu-expertplus-fab-api-warning {
      display: none;
      align-items: center;
      gap: 7px;
      padding: 5px 11px 5px 9px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      line-height: 1.35;
      color: hsl(48 92% 62%);
      background: linear-gradient(
        165deg,
        hsl(38 32% 18%) 0%,
        hsl(32 28% 14%) 100%
      );
      border: 1px solid hsl(40 42% 32%);
      box-shadow:
        0 2px 10px rgba(0,0,0,.4),
        0 0 0 1px rgba(0,0,0,.2) inset;
    }
    .${FAB_NEEDS_API_CLASS} .osu-expertplus-fab-api-warning {
      display: flex;
    }
    .osu-expertplus-fab-api-warning__icon {
      flex-shrink: 0;
      font-size: 11px;
      opacity: 0.95;
      filter: drop-shadow(0 0 6px hsl(48 90% 45% / 0.45));
    }
    .osu-expertplus-fab-api-warning__text {
      min-width: 0;
    }

    #osu-expertplus-fab {
      position: relative;
      flex-shrink: 0;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 16px 0 12px;
      border-radius: 22px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.02em;
      background: hsl(var(--hsl-b4, 333 18% 20%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
      box-shadow:
        0 2px 10px rgba(0,0,0,.45),
        0 0 0 1px rgba(0,0,0,.12) inset;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease;
      opacity: 0.88;
      -webkit-tap-highlight-color: transparent;
    }
    #osu-expertplus-fab:hover {
      background: hsl(var(--hsl-b5, 333 18% 28%));
      border-color: hsl(var(--hsl-b5, 333 18% 36%));
      opacity: 1;
      box-shadow:
        0 4px 18px rgba(0,0,0,.5),
        0 0 0 1px rgba(255,255,255,.04) inset;
    }
    #osu-expertplus-fab:focus-visible {
      outline: 2px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 3px;
    }
    #osu-expertplus-fab:active {
      transform: translateY(1px);
      box-shadow: 0 1px 8px rgba(0,0,0,.4);
    }
    .osu-expertplus-fab__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      font-size: 16px;
      color: hsl(var(--hsl-c2, 333 60% 72%));
      transition: transform 180ms ease, color 160ms ease;
    }
    #osu-expertplus-fab:hover .osu-expertplus-fab__icon {
      color: hsl(var(--hsl-l1, 0 0% 96%));
      transform: rotate(35deg);
    }
    .osu-expertplus-fab__label {
      display: flex;
      align-items: baseline;
      white-space: nowrap;
    }
    .osu-expertplus-fab__brand-accent {
      font-weight: 800;
      letter-spacing: 0.04em;
      color: hsl(var(--hsl-pink, 333 100% 72%));
      text-shadow: 0 0 20px hsl(var(--hsl-pink, 333 100% 65%) / 0.35);
    }

    #osu-expertplus-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0,0,0,.5);
    }
    #osu-expertplus-backdrop.${OPEN_CLASS} { display: block; }

    #${ROOT_ID} {
      display: none;
      position: fixed;
      bottom: 80px;
      left: 24px;
      z-index: 9999;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
      font-family: inherit;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    #${ROOT_ID}.${OPEN_CLASS} {
      display: block;
      animation: osu-expertplus-slide-in 150ms ease-out;
    }
    @keyframes osu-expertplus-slide-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .osu-expertplus-panel__header {
      padding: 14px 16px 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
    }

    .osu-expertplus-panel__section {
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
      background: hsl(var(--hsl-b2, 333 18% 12%));
    }
    .osu-expertplus-panel__section:last-of-type { border-bottom: none; }

    .osu-expertplus-panel__footer {
      padding: 10px 16px 12px;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      font-size: 11px;
      line-height: 1.45;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .osu-expertplus-panel__footer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
    }
    .osu-expertplus-panel__footer-reset {
      margin: 0;
      padding: 3px 9px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      border-radius: 5px;
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l2, 0 0% 72%));
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.3;
      cursor: pointer;
      transition:
        background 140ms ease,
        border-color 140ms ease,
        color 140ms ease;
    }
    .osu-expertplus-panel__footer-reset:hover {
      background: hsl(var(--hsl-b5, 333 18% 24%));
      border-color: hsl(var(--hsl-b5, 333 18% 38%));
      color: hsl(var(--hsl-l1, 0 0% 88%));
    }
    .osu-expertplus-panel__footer-reset:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 2px;
    }
    .osu-expertplus-panel__footer a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
    .osu-expertplus-panel__footer a:hover {
      color: hsl(var(--hsl-c2, 333 60% 82%));
    }
    .osu-expertplus-panel__footer-sep {
      margin: 0 0.45em;
      opacity: 0.45;
      user-select: none;
    }

    .osu-expertplus-panel__group-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 34px;
      padding: 8px 16px;
      border: none;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      cursor: pointer;
      color: inherit;
    }
    .osu-expertplus-panel__group-toggle:hover {
      background: hsl(var(--hsl-b4, 333 18% 20%));
    }
    .osu-expertplus-panel__group-toggle:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: -1px;
    }

    /* Credential section headers — osu! API */
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(145 22% 17%);
      border-top-color: hsl(145 28% 26%);
    }
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(145 22% 21%);
    }
    .oep-cred--osu.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(132 48% 58%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(38 26% 16%);
      border-top-color: hsl(36 32% 24%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(38 26% 20%);
    }
    .oep-cred--osu.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(46 88% 60%);
    }

    /* Credential section headers — OMDB */
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(210 28% 18%);
      border-top-color: hsl(210 32% 28%);
    }
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(210 28% 22%);
    }
    .oep-cred--omdb.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(205 58% 70%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(280 18% 17%);
      border-top-color: hsl(275 22% 26%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(280 18% 21%);
    }
    .oep-cred--omdb.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(38 82% 62%);
    }

    .osu-expertplus-panel__group-label {
      padding: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .11em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.95;
    }
    .osu-expertplus-panel__group-chevron {
      font-size: 11px;
      opacity: 0.9;
      transform: rotate(0deg);
      transition: transform 120ms ease;
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__group-chevron {
      transform: rotate(-90deg);
    }
    .osu-expertplus-panel__section-content { display: block; }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:first-child {
      border-top: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__section-content {
      display: none;
    }

    .osu-expertplus-panel__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:last-child { border-bottom: none; }

    .osu-expertplus-panel__row--oauth-required {
      opacity: 0.55;
      filter: saturate(0.7);
      pointer-events: none;
      user-select: none;
      cursor: not-allowed;
    }

    .osu-expertplus-panel__text {
      flex: 1;
      min-width: 0;
    }
    .osu-expertplus-panel__label {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
    }
    .osu-expertplus-panel__feature-hint {
      font-size: 10px;
      font-weight: 500;
      line-height: 1.35;
      margin-top: 4px;
      color: hsl(var(--hsl-c2, 333 60% 68%));
      opacity: 0.9;
    }
    .osu-expertplus-panel__row--with-feature-hint {
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .osu-expertplus-panel__row--with-feature-hint .osu-expertplus-toggle {
      margin-top: 2px;
    }

    .osu-expertplus-toggle {
      position: relative;
      flex-shrink: 0;
      width: 32px;
      height: 18px;
    }
    .osu-expertplus-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .osu-expertplus-toggle__track {
      position: absolute;
      inset: 0;
      border-radius: 100px;
      background: hsl(var(--hsl-b5, 333 18% 26%));
      cursor: pointer;
      transition: background 150ms;
    }
    .osu-expertplus-toggle__track::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: hsl(var(--hsl-l1, 0 0% 90%));
      transition: transform 150ms;
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track {
      background: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track::after {
      transform: translateX(14px);
    }

    .osu-expertplus-panel__creds {
      padding: 8px 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .osu-expertplus-panel__creds-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .osu-expertplus-panel__creds-field label {
      font-size: 11px;
      opacity: 0.6;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .osu-expertplus-panel__creds-field input {
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      border-radius: 6px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-family: monospace;
      font-size: 12px;
      padding: 5px 8px;
      outline: none;
      transition: border-color 150ms;
    }
    .osu-expertplus-panel__creds-field input:focus {
      border-color: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-panel__creds-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .osu-expertplus-panel__creds-btn {
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      transition: opacity 150ms;
    }
    .osu-expertplus-panel__creds-btn:hover { opacity: 0.8; }
    .osu-expertplus-panel__creds-btn--save {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
    }
    .osu-expertplus-panel__creds-btn--clear {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .osu-expertplus-panel__creds-status {
      font-size: 11px;
      margin-top: 2px;
      min-height: 1.4em;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-status--ok    { color: #84e03a; }
    .osu-expertplus-panel__creds-status--error  { color: #e05c5c; }
    .osu-expertplus-panel__creds-status--info   { opacity: 0.5; }
    .osu-expertplus-panel__creds-hint {
      font-size: 11px;
      opacity: 0.45;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-hint a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
  `;

  function buildToggle(feature) {
    const input = el("input", { type: "checkbox" });
    input.checked = settings.isEnabled(feature.id);

    const track = el("div", { class: "osu-expertplus-toggle__track" });
    const label = el("label", { class: "osu-expertplus-toggle" }, input, track);

    input.addEventListener("change", () => {
      if (
        feature.id === settings.IDS.MODDED_STAR_RATING &&
        !auth.isConfigured()
      ) {
        input.checked = settings.isEnabled(feature.id);
        return;
      }
      settings.set(feature.id, input.checked);
    });
    settings.onChange(feature.id, (val) => {
      input.checked = val;
    });

    return label;
  }

  function buildCredentialsSection(onConfiguredChange) {
    const clientIdInput = el("input", {
      type: "text",
      placeholder: "Client ID",
      autocomplete: "off",
      spellcheck: "false",
    });

    const clientSecretInput = el("input", {
      type: "password",
      placeholder: "Client Secret",
      autocomplete: "new-password",
    });

    clientIdInput.value = GM_getValue("oep_client_id", "");
    if (GM_getValue("oep_client_secret", "")) {
      clientSecretInput.placeholder = "(saved — enter to change)";
    }

    const statusEl = el("div", {
      class:
        "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info",
    });

    function setStatus(msg, type = "info") {
      statusEl.textContent = msg;
      statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
    }

    if (auth.isConfigured()) {
      setStatus("Credentials saved. API v2 active.", "ok");
    } else {
      setStatus("No credentials — using session fallback.");
    }

    const saveBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save",
      },
      "Save",
    );
    const clearBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear",
      },
      "Clear",
    );

    saveBtn.addEventListener("click", async () => {
      const id = clientIdInput.value.trim();
      const secret =
        clientSecretInput.value.trim() || GM_getValue("oep_client_secret", "");

      if (!id || !secret) {
        setStatus("Both Client ID and Secret are required.", "error");
        return;
      }

      auth.setCredentials(id, secret);
      clientIdInput.value = id;
      clientSecretInput.value = "";
      clientSecretInput.placeholder = "(saved — enter to change)";
      setStatus("Verifying…", "info");

      try {
        await auth.getToken();
        setStatus("Credentials saved & verified. API v2 active.", "ok");
        location.reload();
      } catch (e) {
        setStatus(
          `Failed: ${e.message.replace("[osu! Expert+] ", "")}`,
          "error",
        );
      } finally {
        refreshFabOsuApiWarning();
        syncOAuthHintVisibility();
        refreshModdedStarRatingRowLock();
        onConfiguredChange?.();
        window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
      }
    });

    clearBtn.addEventListener("click", () => {
      auth.clearCredentials();
      clientIdInput.value = "";
      clientSecretInput.value = "";
      clientSecretInput.placeholder = "Client Secret";
      setStatus("Credentials cleared. Using session fallback.");
      refreshFabOsuApiWarning();
      syncOAuthHintVisibility();
      refreshModdedStarRatingRowLock();
      onConfiguredChange?.();
      window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
    });

    const hint = el("div", { class: "osu-expertplus-panel__creds-hint" });
    hint.innerHTML =
      'Create an OAuth app at <a href="https://osu.ppy.sh/home/account/edit#oauth" target="_blank">Account Settings → OAuth</a>, then paste your Client ID and Secret above.';

    function syncOAuthHintVisibility() {
      hint.hidden = auth.isConfigured();
    }
    syncOAuthHintVisibility();

    return el(
      "div",
      { class: "osu-expertplus-panel__creds" },
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "Client ID"),
        clientIdInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "Client Secret"),
        clientSecretInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-actions" },
        saveBtn,
        clearBtn,
      ),
      statusEl,
      hint,
    );
  }

  function buildOmdbCredentialsSection(onConfiguredChange) {
    const apiKeyInput = el("input", {
      type: "password",
      placeholder: "API Key",
      autocomplete: "new-password",
      spellcheck: "false",
    });

    if (omdb.isConfigured()) {
      apiKeyInput.placeholder = "(saved — enter to change)";
    }

    const statusEl = el("div", {
      class:
        "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info",
    });

    function setStatus(msg, type = "info") {
      statusEl.textContent = msg;
      statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
    }

    if (omdb.isConfigured()) {
      setStatus("API key saved.", "ok");
    } else {
      setStatus("No API key configured.");
    }

    const saveBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save",
      },
      "Save",
    );
    const clearBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear",
      },
      "Clear",
    );

    saveBtn.addEventListener("click", () => {
      const key = apiKeyInput.value.trim() || omdb.getApiKey();

      if (!key) {
        setStatus("API key is required.", "error");
        return;
      }

      omdb.setApiKey(key);
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "(saved — enter to change)";
      setStatus("API key saved.", "ok");
      syncOmdbHintVisibility();
      onConfiguredChange?.();
    });

    clearBtn.addEventListener("click", () => {
      omdb.clearApiKey();
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "API Key";
      setStatus("API key cleared.");
      syncOmdbHintVisibility();
      onConfiguredChange?.();
    });

    const hint = el("div", { class: "osu-expertplus-panel__creds-hint" });
    hint.innerHTML =
      'Sign in at <a href="https://omdb.nyahh.net/settings/" target="_blank" rel="noopener noreferrer">omdb.nyahh.net/settings</a>. Create a new application (the name may be anything). When OMDB shows your API key, copy it and paste it into the field above.';

    function syncOmdbHintVisibility() {
      hint.hidden = omdb.isConfigured();
    }
    syncOmdbHintVisibility();

    return el(
      "div",
      { class: "osu-expertplus-panel__creds" },
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "API Key"),
        apiKeyInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-actions" },
        saveBtn,
        clearBtn,
      ),
      statusEl,
      hint,
    );
  }

  function buildSection(
    title,
    contentNodes,
    { collapsedByDefault = false, credential = null } = {},
  ) {
    const section = el("section", { class: "osu-expertplus-panel__section" });
    if (collapsedByDefault) section.classList.add(SECTION_COLLAPSED_CLASS);

    const titleId =
      credential?.stableTitleId ??
      `oep-settings-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const initialTitle = credential
      ? credentialSectionTitle(credential.kind, credential.filled)
      : title;

    const label = el(
      "span",
      { class: "osu-expertplus-panel__group-label", id: titleId },
      initialTitle,
    );

    function applyCredentialState(filled) {
      if (!credential) return;
      section.classList.remove("oep-cred--ok", "oep-cred--missing");
      section.classList.add(filled ? "oep-cred--ok" : "oep-cred--missing");
      label.textContent = credentialSectionTitle(credential.kind, filled);
    }

    if (credential) {
      section.classList.add(
        credential.kind === "osu" ? "oep-cred--osu" : "oep-cred--omdb",
      );
      applyCredentialState(credential.filled);
      if (credential.syncHolder) {
        credential.syncHolder.sync = applyCredentialState;
      }
    }

    const content = el(
      "div",
      { class: "osu-expertplus-panel__section-content" },
      ...contentNodes,
    );
    const chevron = el(
      "span",
      { class: "osu-expertplus-panel__group-chevron", "aria-hidden": "true" },
      "▼",
    );
    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "osu-expertplus-panel__group-toggle",
        "aria-expanded": collapsedByDefault ? "false" : "true",
        "aria-labelledby": titleId,
      },
      label,
      chevron,
    );

    toggleBtn.addEventListener("click", () => {
      const collapsed = section.classList.toggle(SECTION_COLLAPSED_CLASS);
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });

    section.appendChild(toggleBtn);
    section.appendChild(content);
    return section;
  }

  function buildPanel() {
    const features = settings.getFeatures();

    const groups = new Map();
    for (const f of features) {
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group).push(f);
    }

    const header = el(
      "div",
      { class: "osu-expertplus-panel__header" },
      "osu! Expert+ Settings",
    );

    const rows = [];
    const hasSavedCreds = auth.isConfigured();
    const hasSavedOmdb = omdb.isConfigured();

    const osuSyncHolder = { sync: null };
    const omdbSyncHolder = { sync: null };

    rows.push(
      buildSection(
        "",
        [
          buildCredentialsSection(() =>
            osuSyncHolder.sync?.(auth.isConfigured()),
          ),
        ],
        {
          collapsedByDefault: hasSavedCreds,
          credential: {
            kind: "osu",
            filled: hasSavedCreds,
            stableTitleId: "oep-settings-section-osu-api",
            syncHolder: osuSyncHolder,
          },
        },
      ),
    );

    rows.push(
      buildSection(
        "",
        [
          buildOmdbCredentialsSection(() =>
            omdbSyncHolder.sync?.(omdb.isConfigured()),
          ),
        ],
        {
          collapsedByDefault: hasSavedOmdb,
          credential: {
            kind: "omdb",
            filled: hasSavedOmdb,
            stableTitleId: "oep-settings-section-omdb-api",
            syncHolder: omdbSyncHolder,
          },
        },
      ),
    );

    for (const [groupName, groupFeatures] of groups) {
      const groupRows = [];
      for (const feature of groupFeatures) {
        const text = el(
          "div",
          { class: "osu-expertplus-panel__text" },
          el("div", { class: "osu-expertplus-panel__label" }, feature.label),
        );
        const row = el(
          "div",
          { class: "osu-expertplus-panel__row" },
          text,
          buildToggle(feature),
        );
        if (feature.id === settings.IDS.MODDED_STAR_RATING) {
          row.setAttribute(MODDED_SR_ROW_ATTR, "1");
          text.appendChild(
            el(
              "div",
              {
                class: "osu-expertplus-panel__feature-hint",
                "data-oep-modded-sr-hint": "1",
              },
              "",
            ),
          );
          applyModdedStarRowLockState(row);
        }
        groupRows.push(row);
      }
      rows.push(buildSection(groupName, groupRows));
    }

    const resetDefaultsBtn = el(
      "button",
      {
        type: "button",
        class: "osu-expertplus-panel__footer-reset",
        title: "Set every toggle above to its default (API keys are not changed)",
      },
      "Reset to defaults",
    );
    resetDefaultsBtn.addEventListener("click", () => {
      if (
        !window.confirm(
          "Reset all Expert+ options to their defaults? osu! and OMDB API keys will not be changed.",
        )
      ) {
        return;
      }
      settings.resetPanelTogglesToDefaults();
      refreshModdedStarRatingRowLock();
    });

    const footer = el(
      "div",
      { class: "osu-expertplus-panel__footer" },
      resetDefaultsBtn,
      el(
        "div",
        { class: "osu-expertplus-panel__footer-links" },
        el(
          "a",
          {
            href: "https://github.com/inix1257/osu_expertplus",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Source code",
        ),
        el(
          "span",
          { class: "osu-expertplus-panel__footer-sep", "aria-hidden": "true" },
          "·",
        ),
        el(
          "a",
          {
            href: "https://osu.ppy.sh/users/2688581",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Developer",
        ),
      ),
    );

    return el("div", { id: ROOT_ID }, header, ...rows, footer);
  }

  /** Assigned in {@link init}; no-op until then. */
  let openPanel = () => {};
  /** Assigned in {@link init}; no-op until then. */
  let closePanel = () => {};

  function init() {
    if (document.getElementById(ROOT_ID)) return;

    GM_addStyle(CSS);

    const fab = el(
      "button",
      {
        id: "osu-expertplus-fab",
        type: "button",
        title: "osu! Expert+ Settings",
      },
      el(
        "span",
        { class: "osu-expertplus-fab__icon", "aria-hidden": "true" },
        el("i", { class: "fas fa-cog" }),
      ),
      el(
        "span",
        { class: "osu-expertplus-fab__label" },
        el("span", { class: "osu-expertplus-fab__brand-accent" }, "Expert+"),
      ),
    );

    const apiWarning = el(
      "div",
      {
        class: "osu-expertplus-fab-api-warning",
        role: "status",
      },
      el("i", {
        class:
          "fas fa-exclamation-triangle osu-expertplus-fab-api-warning__icon",
        "aria-hidden": "true",
      }),
      el(
        "span",
        { class: "osu-expertplus-fab-api-warning__text" },
        "osu! API credentials not set",
      ),
    );

    const fabAnchor = el("div", { id: FAB_ANCHOR_ID }, apiWarning, fab);

    const backdrop = el("div", { id: "osu-expertplus-backdrop" });
    const panel = buildPanel();

    fabUi.anchor = fabAnchor;
    fabUi.panel = panel;

    openPanel = () => {
      panel.classList.add(OPEN_CLASS);
      backdrop.classList.add(OPEN_CLASS);
    };
    closePanel = () => {
      panel.classList.remove(OPEN_CLASS);
      backdrop.classList.remove(OPEN_CLASS);
    };
    const toggle = () =>
      panel.classList.contains(OPEN_CLASS) ? closePanel() : openPanel();

    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    backdrop.addEventListener("click", closePanel);

    function attachToBody() {
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
      document.body.appendChild(fabAnchor);
      refreshFabOsuApiWarning();
      refreshModdedStarRatingRowLock();
    }

    attachToBody();
    window.addEventListener("resize", syncPanelAboveFab);

    // Re-attach when SPA replaces document.body
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node === document.body) {
            attachToBody();
            return;
          }
        }
      }
    }).observe(document.documentElement, { childList: true });
  }

  return {
    init,
    /** Opens the Expert+ settings modal (idempotent if {@link init} has not run). */
    open: () => {
      openPanel();
    },
    close: () => {
      closePanel();
    },
  };
})();

/* ── entry point ── */
(function () {
  OsuExpertPlus.settingsPanel.init();
  OsuExpertPlus.modIconsAsAcronyms.install(OsuExpertPlus.settings);
  OsuExpertPlus.beatmapsetsListingMode.installLinkPatcher();

  const router = new OsuExpertPlus.Router();
  router.init();
})();
