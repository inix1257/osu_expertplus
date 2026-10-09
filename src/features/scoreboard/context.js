/**
 * Scoreboard page context (WS-31): shared selectors and markers, the
 * scoreboard root, and what the beatmapset page currently shows (beatmap,
 * ruleset, active mod filters, Lazer toggle).
 */

import {
  getCurrentBeatmapId,
  getCurrentRuleset,
  readBeatmapsetJson,
} from "../../osu/beatmapset-data.js";

export { readBeatmapsetJson };

export const MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";

export const WILDCARD_MERGED_ROW_ATTR = "data-oep-wildcard-merged-row";

export const SCORE_USER_SEARCH_RESULT_ATTR = "data-oep-user-search-result";

export const SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";

export const EXTENDED_SCORE_ROW_ATTR = "data-oep-api-extended-score";

/** osu-web uses `.beatmap-scoreboard-table` on the wrapper `div`; the real `<table>` is `__table`. */
export const SCOREBOARD_HTML_TABLE_SEL =
  "table.beatmap-scoreboard-table__table";

/** Maps injected table row elements to their source score API objects for top-panel sync. */
export const _rowScoreMap = new WeakMap();

export function findBeatmapScoreboardRoot() {
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
 * The beatmap shown on the page, as a string (callers use it in keys and
 * string comparisons; `getCurrentBeatmapId` returns a number).
 * @returns {string|null}
 */
export function getBeatmapPageBeatmapId() {
  const id = getCurrentBeatmapId();
  return id == null ? null : String(id);
}

/** @returns {string}  ruleset of the shown beatmap (`osu` when unknown) */
export function getBeatmapPageRuleset() {
  return getCurrentRuleset();
}

/**
 * Read currently enabled mod filters from the scoreboard filter strip.
 * Returns normalized acronyms (e.g. ["HR", "HD"]). "NM" is omitted.
 * @param {HTMLElement} scoreboardRoot
 * @returns {string[]}
 */
export function getActiveBeatmapScoreboardFilterMods(scoreboardRoot) {
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

  const modsRoot = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
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

/**
 * @returns {boolean}
 */
export function isLazerModeEnabledForLeaderboard() {
  // Account menu toggle reflects current preference; checked icon means lazer mode on.
  const toggle = document.querySelector(
    'button[title*="Lazer mode"][data-url*="legacy_score_only"]',
  );
  if (!(toggle instanceof HTMLButtonElement)) return false;
  return Boolean(toggle.querySelector(".fa-check-square"));
}

/** @type {Map<string, number|null>} */
export const _beatmapFullComboCache = new Map();

/**
 * Beatmap max combo (full combo count) parsed once from the page's beatmap JSON.
 * Used to highlight combo text only for exact full-combo scores.
 * @param {string} beatmapId
 * @returns {number|null}
 */
export function getBeatmapFullComboFromBeatmapsetJson(beatmapId) {
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
