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

import { pageLocalStorage, pageWindow } from "../../core/page-window.js";

export { readBeatmapsetJson };

export const MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";

export const WILDCARD_MERGED_ROW_ATTR = "data-oep-wildcard-merged-row";

export const SCORE_USER_SEARCH_RESULT_ATTR = "data-oep-user-search-result";

export const SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";

export const EXTENDED_SCORE_ROW_ATTR = "data-oep-api-extended-score";

/** Score rows of the scoreboard table (osu-web and injected). */
export const SCOREBOARD_ROW_SEL = "tr.beatmap-scoreboard-table__body-row";
export const SCOREBOARD_TBODY_SEL = "tbody.beatmap-scoreboard-table__body";
/** The link inside most score cells (`td > a.…__cell-content`). */
export const SCOREBOARD_CELL_LINK_SEL =
  "a.beatmap-scoreboard-table__cell-content";
/** osu-web mod strip buttons hidden by the mod grid (WS-32). */
export const MOD_HIDDEN_ATTR = "data-oep-mod-hidden";
/** Grid control standing for a merged pair (DT/NC, SD/PF) (WS-32). */
export const MERGED_MOD_ATTR = "data-oep-merged-mod";
/** Fired on window by the settings panel when OAuth credentials change. */
export const CREDENTIALS_CHANGED_EVENT = "oep-osu-api-credentials-changed";

/** Wildcard row that is not the player's highest-ranked score in the merged list. */
export const WILDCARD_DUPE_ROW_ATTR = "data-oep-wildcard-dupe";
/**
 * Custom-rate score: a mod's speed differs from its default (1.50× for
 * DT/NC, 0.75× for HT/DC; see `isNonDefaultSpeed`).
 */
export const RATE_EDIT_ROW_ATTR = "data-oep-rate-edit";
/**
 * Why a score row is hidden: a space-separated list of reasons, each added
 * and removed only by its own feature, so one feature showing its rows
 * again cannot reveal rows another one hid (B09). The stylesheet hides any
 * row that has the attribute.
 *   - `merged`: an osu-web row while a wildcard or lookup leaderboard is shown
 *   - `rate`: a custom-rate score while “Hide custom rate scores” is on
 */
export const ROW_HIDE_ATTR = "data-oep-hide";
/** In-page “Hide custom rate scores” toggle; always shown on the scoreboard. */
export const RATE_EDIT_FILTER_BAR_ATTR = "data-oep-rate-edit-filter-bar";
/** Player lookup bar wrapper; sits inside the tools row with the rate filter. */
export const SCOREBOARD_USER_SEARCH_ATTR = "data-oep-beatmap-user-search";
/** Flex row under the mod filters holding player lookup and the rate filter. */
export const SCOREBOARD_TOOLS_ROW_ATTR = "data-oep-scoreboard-tools-row";
/** On the table wrapper while a wildcard fetch is pending. */
export const WILDCARD_LOADING_CLASS = "oep-wildcard-loading";
export const SCOREBOARD_MODS_SEL = ".beatmapset-scoreboard__mods";

/** osu-web uses `.beatmap-scoreboard-table` on the wrapper `div`; the real `<table>` is `__table`. */
export const SCOREBOARD_HTML_TABLE_SEL =
  "table.beatmap-scoreboard-table__table";

/**
 * @param {Element} row
 * @returns {string[]}
 */
function rowHideReasons(row) {
  return (row.getAttribute(ROW_HIDE_ATTR) || "").split(/\s+/).filter(Boolean);
}

/**
 * @param {Element} row
 * @param {string} reason
 * @param {boolean} hidden
 */
export function setRowHidden(row, reason, hidden) {
  const reasons = rowHideReasons(row);
  if (reasons.includes(reason) === hidden) return;
  const next = hidden
    ? [...reasons, reason]
    : reasons.filter((r) => r !== reason);
  if (next.length) row.setAttribute(ROW_HIDE_ATTR, next.join(" "));
  else row.removeAttribute(ROW_HIDE_ATTR);
}

/**
 * @param {Element} row
 * @param {string} [reason]  any reason when omitted
 * @returns {boolean}
 */
export function isScoreboardRowHidden(row, reason) {
  if (reason) return rowHideReasons(row).includes(reason);
  return (
    row.hasAttribute(ROW_HIDE_ATTR) ||
    (row instanceof HTMLElement && row.style.display === "none")
  );
}

/** Injected table rows → the API score they show (read by the top panel). */
const rowScores = new WeakMap();

/**
 * @param {HTMLTableRowElement} row
 * @param {object} score  API score
 */
export function registerRowScore(row, score) {
  rowScores.set(row, score);
}

/**
 * @param {Element} row
 * @returns {object|undefined}  the API score an injected row was built from
 */
export function getRowScore(row) {
  return rowScores.get(row);
}

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
  // The account menu toggle. Its title is translated, so it is found by the
  // option it sends (B16). The check icon shows the current state; the URL
  // sets legacy_score_only to the opposite (=1 while lazer mode is on).
  const toggle = document.querySelector(
    'button[data-url*="legacy_score_only"]',
  );
  if (!(toggle instanceof HTMLButtonElement)) return false;
  if (toggle.querySelector(".fa-check-square")) return true;
  if (toggle.querySelector(".fa-square")) return false;
  const m = /legacy_score_only(?:%5D|\])=([01])\b/i.exec(
    toggle.getAttribute("data-url") || "",
  );
  return m ? m[1] === "1" : false;
}

/**
 * osu-web's score display preferences, read where osu-web reads them
 * (`osuCore.userPreferences`, which mirrors to the `userPreferences`
 * localStorage key). Without either, Lazer mode comes from the account menu
 * toggle and the scoring mode is osu-web's default (standardised) (B94).
 * @returns {import("../../osu/score.js").ScoreDisplayPrefs}
 */
export function readScoreDisplayPrefs() {
  /** @type {{ legacy_score_only?: unknown, scoring_mode?: unknown }|null} */
  let raw = null;
  try {
    const prefs = pageWindow()?.osuCore?.userPreferences;
    if (prefs && typeof prefs.get === "function") {
      raw = {
        legacy_score_only: prefs.get("legacy_score_only"),
        scoring_mode: prefs.get("scoring_mode"),
      };
    }
  } catch {
    // Page object unavailable (sandbox wrappers).
  }
  if (!raw) {
    try {
      const parsed = JSON.parse(
        pageLocalStorage()?.getItem("userPreferences") ?? "null",
      );
      if (parsed && typeof parsed === "object") raw = parsed;
    } catch {
      // Unreadable storage.
    }
  }
  const legacyScoreOnly =
    typeof raw?.legacy_score_only === "boolean"
      ? raw.legacy_score_only
      : !isLazerModeEnabledForLeaderboard();
  const scoringMode =
    raw?.scoring_mode === "classic" ? "classic" : "standardised";
  return { legacyScoreOnly, scoringMode };
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
