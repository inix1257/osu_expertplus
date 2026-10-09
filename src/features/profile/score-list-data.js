/**
 * Profile score lists from the site: paged fetch and caches (WS-41).
 */

import { getCurrentUserIdFromHeader } from "./profile-target.js";
/**
 * Profile score lists are cached across SPA navigations (mode switches, back/forward)
 * for a short time so revisiting a profile does not refetch everything. The viewer's
 * own profile is never served from the cache (new plays would show stale stats); only
 * concurrent requests are shared there.
 */
const PROFILE_SCORES_CACHE_TTL_MS = 2 * 60 * 1000;
const SCORE_LIST_PAGE_SIZE = 100;
const SCORE_LIST_MAX_TOTAL = 1000;

export function _profileScoresCacheTtl(userId) {
  return String(userId) === String(getCurrentUserIdFromHeader())
    ? 0
    : PROFILE_SCORES_CACHE_TTL_MS;
}

/**
 * @typedef {{ scores: object[], done: boolean, ts: number, visit: number, lastPageKey: string, pending: Promise<boolean>|null }} ScoreListEntry
 * @type {Map<string, ScoreListEntry>}
 */
const _scoreListCache = new Map();

/** Profile page visits so far (see {@link beginScoreListVisit}). */
let scoreListVisit = 0;

/**
 * A new profile page visit. The viewer's own lists (TTL 0) are fetched afresh
 * once per visit and then continued page by page within it: "Show more" no
 * longer starts again from offset 0 (B41).
 */
export function beginScoreListVisit() {
  scoreListVisit += 1;
}

/** @returns {ScoreListEntry} */
function _scoreListEntry(userId, mode, type) {
  const key = `${userId}:${mode}:${type}`;
  let entry = _scoreListCache.get(key);
  const ttl = _profileScoresCacheTtl(userId);
  const stale = (/** @type {ScoreListEntry} */ e) =>
    ttl === 0 ? e.visit !== scoreListVisit : Date.now() - e.ts >= ttl;
  if (!entry || (!entry.pending && stale(entry))) {
    entry = {
      scores: [],
      done: false,
      ts: Date.now(),
      visit: scoreListVisit,
      lastPageKey: "",
      pending: null,
    };
    _scoreListCache.set(key, entry);
  }
  return entry;
}

/**
 * Fetch the next page of a score list into `entry`.
 * @param {ScoreListEntry} entry
 * @returns {Promise<boolean>}  true when new scores were appended
 */
async function _fetchScoreListPage(userId, mode, type, entry) {
  const offset = entry.scores.length;
  const url = `/users/${userId}/scores/${type}?mode=${mode}&limit=${SCORE_LIST_PAGE_SIZE}&offset=${offset}&include=beatmap`;
  let items;
  try {
    const resp = await OsuExpertPlus.api.siteFetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return false;
    const body = await resp.json();
    items = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [];
  } catch {
    return false;
  }

  if (items.length < SCORE_LIST_PAGE_SIZE) entry.done = true;
  if (!items.length) return false;

  const pageKey = items
    .map((it) =>
      it?.id != null
        ? String(it.id)
        : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`,
    )
    .join("|");
  if (pageKey && pageKey === entry.lastPageKey) {
    entry.done = true;
    return false;
  }
  entry.lastPageKey = pageKey;

  entry.scores.push(...items);
  if (entry.scores.length >= SCORE_LIST_MAX_TOTAL) entry.done = true;
  return true;
}

/**
 * GET /users/{id}/scores/{type}, same order as DOM. Only fetches as many pages as
 * needed to cover the `needed` rows currently rendered; later calls with a larger
 * `needed` (after "Show more") continue from where the cache left off.
 * @param {string|number} userId
 * @param {string} mode
 * @param {string} type
 * @param {number} needed
 * @returns {Promise<object[]>}  Live array (grows as more pages load).
 */
export async function fetchScores(userId, mode, type, needed) {
  const entry = _scoreListEntry(userId, mode, type);
  const target = Math.min(Math.max(needed, 1), SCORE_LIST_MAX_TOTAL);
  while (!entry.done && entry.scores.length < target) {
    if (!entry.pending) {
      entry.pending = _fetchScoreListPage(userId, mode, type, entry).finally(
        () => {
          entry.pending = null;
        },
      );
    }
    if (!(await entry.pending)) break;
  }
  return entry.scores;
}

/** @returns {boolean}  Whether every row of the list has been fetched. */
export function _scoreListComplete(userId, mode, type) {
  return _scoreListCache.get(`${userId}:${mode}:${type}`)?.done === true;
}

/**
 * Share one in-flight / recently resolved promise per key.
 * @template T
 * @param {Map<string, { ts: number, pending: boolean, promise: Promise<T> }>} cache
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<T>} factory
 * @returns {Promise<T>}
 */
export function _sharedPromise(cache, key, ttlMs, factory) {
  const hit = cache.get(key);
  if (hit && (hit.pending || Date.now() - hit.ts < ttlMs)) return hit.promise;
  const entry = { ts: Date.now(), pending: true, promise: null };
  entry.promise = factory().then(
    (value) => {
      entry.pending = false;
      entry.ts = Date.now();
      return value;
    },
    (err) => {
      if (cache.get(key) === entry) cache.delete(key);
      throw err;
    },
  );
  cache.set(key, entry);
  return entry.promise;
}

const _mostWatchedCache = new Map();

/**
 * Fetches "Most Watched Replays" scores from the historical extra-pages endpoint.
 * Returns an ordered array of score objects ready for processElements().
 */
export function fetchMostWatchedScores(userId, mode) {
  return _sharedPromise(
    _mostWatchedCache,
    `${userId}:${mode}`,
    _profileScoresCacheTtl(userId),
    async () => {
      const url = `/users/${userId}/extra-pages/historical?mode=${mode}`;
      // Throwing (instead of returning []) drops the cache entry so a later call retries.
      const resp = await OsuExpertPlus.api.siteFetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) throw new Error(`historical ${resp.status}`);
      const body = await resp.json();
      const items = body?.score_replay_stats?.items;
      if (!Array.isArray(items)) return [];
      return items.map((item) => item?.score).filter(Boolean);
    },
  ).catch(() => []);
}
