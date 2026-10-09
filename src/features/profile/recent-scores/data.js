/**
 * Expert+ Recent: fetch the recent scores with fails and merge them with the
 * passed ones (WS-41).
 */

import { scoreTimestampIso } from "./options-menu.js";
import { _profileScoresCacheTtl, _sharedPromise } from "../score-list-data.js";
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
  const resp = await OsuExpertPlus.api.siteFetch(
    `/users/${userId}/scores/recent?${q}`,
    { headers: { Accept: "application/json" } },
  );
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
  let lastPageKey = "";
  let pageCount = 0;
  for (let offset = 0; ; offset += limit) {
    const q = new URLSearchParams({
      mode,
      limit: String(limit),
      offset: String(offset),
      include_fails: "1",
    });
    q.append("include", "beatmap");
    q.append("include", "beatmapset");
    // A failed first page is an error, not "no recent scores" (B08); later
    // pages only cut the list short.
    let resp;
    try {
      resp = await OsuExpertPlus.api.siteFetch(
        `/users/${userId}/scores/recent?${q}`,
        { headers: { Accept: "application/json" } },
      );
    } catch (err) {
      if (pageCount === 0) throw err;
      break;
    }
    if (!resp.ok) {
      if (pageCount === 0) throw new Error(`HTTP ${resp.status}`);
      break;
    }
    let body;
    try {
      body = await resp.json();
    } catch (err) {
      if (pageCount === 0) throw err;
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

/**
 * Rejects when neither source could be read, so a failure is never shown (or
 * cached) as "no recent scores" (B08).
 */
async function fetchRecentScoresPrimaryWithFails(userId, mode) {
  // Prefer the site endpoint: it returns lazer-shaped scores (mod objects with
  // settings, Classic/DA/FF/AD, custom rates). API v2 is only a fallback since
  // its score shape depends on the request's `x-api-version`.
  let site = null;
  let siteError = null;
  try {
    site = await fetchRecentScoresPaginatedHtmlWithFails(userId, mode);
  } catch (err) {
    siteError = err;
  }
  if (site?.length) return site;
  try {
    const data = await OsuExpertPlus.api.getUserRecentScores(
      userId,
      mode,
      100,
      0,
      true,
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    // The site answered (with no scores): trust it over a failed fallback.
    if (site) return site;
    throw siteError || err;
  }
}

/** Recent plays change quickly, so this cache only covers quick back-and-forth navigation. */
const RECENT_SCORES_CACHE_TTL_MS = 60 * 1000;
const _recentScoresCache = new Map();

export function fetchRecentScoresIncludingFails(userId, mode) {
  const ttl = Math.min(
    _profileScoresCacheTtl(userId),
    RECENT_SCORES_CACHE_TTL_MS,
  );
  return _sharedPromise(
    _recentScoresCache,
    `${userId}:${mode}`,
    ttl,
    async () => {
      const [primary, extraPassed] = await Promise.all([
        fetchRecentScoresPrimaryWithFails(userId, mode),
        fetchWebsiteRecentScoresPassedOnly(userId, mode).catch(() => []),
      ]);
      return mergeRecentScoresWithExtendedPassed(primary, extraPassed).slice(
        0,
        RECENT_SCORES_MERGED_MAX,
      );
    },
  );
}
