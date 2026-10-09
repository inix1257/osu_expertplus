/**
 * Global rank badges next to scoreboard player names (WS-31), looked up in
 * batches as rows come near the viewport.
 */

import { el, settingIds, settings } from "../legacy.js";
import { getBeatmapPageRuleset, SCOREBOARD_ROW_SEL } from "./context.js";

export const SCOREBOARD_GLOBAL_RANK_BADGE_CLASS = "oep-scoreboard-rank-badge";

/**
 * Global ranks move slowly, and every looked-up id costs one osu! API rate-limit unit
 * (`GET /users` is charged per id), so keep them for a while across difficulty switches.
 */
const SCOREBOARD_GLOBAL_RANK_CACHE_TTL_MS = 30 * 60 * 1000;

/** `GET /users` returns every ruleset's statistics, so one lookup fills all four. */
const SCOREBOARD_GLOBAL_RANK_MODES = ["osu", "taiko", "fruits", "mania"];

/** Rows near the viewport are collected for this long, then looked up in one batch. */
const SCOREBOARD_GLOBAL_RANK_BATCH_MS = 100;

/** @type {Map<string, { rank: number|null, ts: number }>} */
const _scoreboardGlobalRankCache = new Map();

/** @typedef {{ userLink: HTMLElement, mode: string }} ScoreboardRankWaiter */
/** @type {Map<number, ScoreboardRankWaiter[]>}  userId -> links waiting for the next batch */
const _scoreboardGlobalRankPending = new Map();

/** @type {Map<number, ScoreboardRankWaiter[]>}  userId -> links waiting on a request in flight */
const _scoreboardGlobalRankInFlight = new Map();

let _scoreboardGlobalRankFlushTimer = 0;

/** @type {IntersectionObserver|null} */
let _scoreboardGlobalRankIo = null;

/** @type {Set<Element>}  Rows currently observed (to drop ones React removed). */
const _scoreboardGlobalRankObserved = new Set();

/**
 * @param {string} mode
 * @param {number} userId
 */
function scoreboardGlobalRankCacheKey(mode, userId) {
  return `${mode}|${userId}`;
}

/**
 * @param {HTMLElement} row
 * @returns {number|null}
 */
function scoreboardRowUserId(row) {
  const card = row.querySelector("a.js-usercard[data-user-id]");
  if (card instanceof HTMLElement) {
    const id = Number(card.getAttribute("data-user-id"));
    if (Number.isFinite(id) && id > 0) return id;
  }
  const link = row.querySelector(
    "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
  );
  if (link instanceof HTMLAnchorElement) {
    const m = (link.getAttribute("href") || "").match(/\/users\/(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * @param {HTMLElement} userLink  the username `<a>` to badge
 * @param {number|null} rank
 */
function paintScoreboardGlobalRankBadge(userLink, rank) {
  if (!(userLink instanceof HTMLElement)) return;
  const host = userLink.parentElement || userLink;
  let badge = host.querySelector(`.${SCOREBOARD_GLOBAL_RANK_BADGE_CLASS}`);
  if (rank == null) {
    badge?.remove();
    return;
  }
  const text = `#${Number(rank).toLocaleString()}`;
  if (!(badge instanceof HTMLElement)) {
    badge = el("span", {
      class: SCOREBOARD_GLOBAL_RANK_BADGE_CLASS,
      title: "Global rank",
    });
    userLink.insertAdjacentElement("afterend", badge);
  }
  if (badge.textContent !== text) badge.textContent = text;
}

/**
 * @param {string} mode
 * @param {number} userId
 * @returns {number|null|undefined}  undefined when not cached (or expired)
 */
function getCachedScoreboardGlobalRank(mode, userId) {
  const cached = _scoreboardGlobalRankCache.get(
    scoreboardGlobalRankCacheKey(mode, userId),
  );
  if (!cached || Date.now() - cached.ts >= SCOREBOARD_GLOBAL_RANK_CACHE_TTL_MS)
    return undefined;
  return cached.rank;
}

function flushScoreboardGlobalRankLookups() {
  _scoreboardGlobalRankFlushTimer = 0;
  const ids = Array.from(_scoreboardGlobalRankPending.keys());
  if (!ids.length) return;
  for (const id of ids) {
    _scoreboardGlobalRankInFlight.set(id, _scoreboardGlobalRankPending.get(id));
  }
  _scoreboardGlobalRankPending.clear();

  OsuExpertPlus.api
    .getUsers(ids)
    .then((users) => {
      /** @type {Map<number, object>} */
      const byId = new Map();
      for (const u of Array.isArray(users) ? users : []) {
        const uid = Number(u?.id);
        if (Number.isFinite(uid)) byId.set(uid, u);
      }
      const ts = Date.now();
      for (const id of ids) {
        const u = byId.get(id);
        for (const m of SCOREBOARD_GLOBAL_RANK_MODES) {
          const rank = Number(u?.statistics_rulesets?.[m]?.global_rank);
          _scoreboardGlobalRankCache.set(scoreboardGlobalRankCacheKey(m, id), {
            rank: Number.isFinite(rank) && rank > 0 ? rank : null,
            ts,
          });
        }
        const waiters = _scoreboardGlobalRankInFlight.get(id) || [];
        for (const { userLink, mode } of waiters) {
          if (!userLink.isConnected) continue;
          paintScoreboardGlobalRankBadge(
            userLink,
            getCachedScoreboardGlobalRank(mode, id) ?? null,
          );
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      for (const id of ids) _scoreboardGlobalRankInFlight.delete(id);
    });
}

/**
 * Paint from cache, or queue the row's player for the next batched lookup.
 * @param {HTMLElement} row
 */
function requestScoreboardGlobalRank(row) {
  if (!settings().isEnabled(settingIds().SCOREBOARD_GLOBAL_RANK)) return;
  const userLink = row.querySelector("a.js-usercard");
  if (!(userLink instanceof HTMLElement)) return;
  const userId = scoreboardRowUserId(row);
  if (userId == null) return;
  const mode = getBeatmapPageRuleset() || "osu";

  const cached = getCachedScoreboardGlobalRank(mode, userId);
  if (cached !== undefined) {
    paintScoreboardGlobalRankBadge(userLink, cached);
    return;
  }
  const waiting =
    _scoreboardGlobalRankInFlight.get(userId) ||
    _scoreboardGlobalRankPending.get(userId);
  if (waiting) {
    waiting.push({ userLink, mode });
    return;
  }
  _scoreboardGlobalRankPending.set(userId, [{ userLink, mode }]);
  if (!_scoreboardGlobalRankFlushTimer) {
    _scoreboardGlobalRankFlushTimer = window.setTimeout(
      flushScoreboardGlobalRankLookups,
      SCOREBOARD_GLOBAL_RANK_BATCH_MS,
    );
  }
}

function scoreboardGlobalRankIo() {
  if (!_scoreboardGlobalRankIo) {
    _scoreboardGlobalRankIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          _scoreboardGlobalRankIo.unobserve(entry.target);
          _scoreboardGlobalRankObserved.delete(entry.target);
          if (entry.target instanceof HTMLElement) {
            requestScoreboardGlobalRank(entry.target);
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
  }
  return _scoreboardGlobalRankIo;
}

/**
 * Global rank next to each leaderboard username. Runs on every scoreboard refresh
 * (sort, mod change, wildcard/player-lookup merge, ...). Cached ranks are painted right
 * away; other rows are only looked up once they come near the viewport, batched into
 * one throttled `api.getUsers` call (a 100-row board would otherwise cost 100 API units
 * per difficulty switch).
 * @param {HTMLElement} scoreboardRoot
 */
export function syncBeatmapScoreboardGlobalRanks(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const rows = Array.from(scoreboardRoot.querySelectorAll(SCOREBOARD_ROW_SEL));

  // Rows React replaced (difficulty switch, re-sort, ...) no longer need a lookup.
  for (const row of _scoreboardGlobalRankObserved) {
    if (!row.isConnected) {
      _scoreboardGlobalRankIo?.unobserve(row);
      _scoreboardGlobalRankObserved.delete(row);
    }
  }

  if (!settings().isEnabled(settingIds().SCOREBOARD_GLOBAL_RANK)) {
    _scoreboardGlobalRankIo?.disconnect();
    _scoreboardGlobalRankObserved.clear();
    for (const row of rows) {
      row.querySelector(`.${SCOREBOARD_GLOBAL_RANK_BADGE_CLASS}`)?.remove();
    }
    return;
  }

  const mode = getBeatmapPageRuleset() || "osu";
  const io = scoreboardGlobalRankIo();

  for (const row of rows) {
    if (!(row instanceof HTMLElement) || row.style.display === "none") {
      continue;
    }
    const userLink = row.querySelector("a.js-usercard");
    if (!(userLink instanceof HTMLElement)) continue;
    const userId = scoreboardRowUserId(row);
    if (userId == null) continue;

    const cached = getCachedScoreboardGlobalRank(mode, userId);
    if (cached !== undefined) {
      paintScoreboardGlobalRankBadge(userLink, cached);
      continue;
    }
    if (!_scoreboardGlobalRankObserved.has(row)) {
      _scoreboardGlobalRankObserved.add(row);
      io.observe(row);
    }
  }
}

/**
 * Stops lookups for the page being left (B21): disconnects the row
 * IntersectionObserver, cancels the pending batch timer and forgets rows
 * still waiting. Cached ranks are kept (they are shared across pages).
 */
export function disposeScoreboardGlobalRanks() {
  _scoreboardGlobalRankIo?.disconnect();
  _scoreboardGlobalRankIo = null;
  _scoreboardGlobalRankObserved.clear();
  window.clearTimeout(_scoreboardGlobalRankFlushTimer);
  _scoreboardGlobalRankFlushTimer = 0;
  _scoreboardGlobalRankPending.clear();
}
