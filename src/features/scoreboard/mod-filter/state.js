/**
 * Mod filter state and the osu-web mod strip (WS-32).
 *
 * The grid hides osu-web's strip buttons (`[data-oep-mod-hidden]`) and shows
 * clones in its own layout. Clicks on a clone either click the hidden
 * original (osu-web filters the table) or, for wildcards, only change the
 * state here (Expert+ fetches and merges the leaderboards itself).
 */

import { MOD_GRID_CLASS, MOD_HIDDEN_ATTR } from "../context.js";

export const MOD_GRID_ATTR = "data-oep-mod-grid";
export const MOD_GRID_COLLAPSED_CLASS = `${MOD_GRID_CLASS}--collapsed`;
export const MOD_WILDCARD_CLASS = "oep-mod-wildcard";
export const MOD_WILDCARD_ATTR = "data-oep-mod-wildcard";
export const MAX_WILDCARD_MODS = 2;

/** One grid control for DT↔NC (cycle) and one for SD↔PF. */
export const MERGED_MOD_DT_NC = "DT_NC";
export const MERGED_MOD_SD_PF = "SD_PF";

export const ENABLED_MOD_CLASS = "beatmap-scoreboard-mod--enabled";

/** osu-web strip buttons the grid has hidden (and cloned). */
export const HIDDEN_ORIGINAL_SEL = `:scope > .beatmap-scoreboard-mod[${MOD_HIDDEN_ATTR}]`;

/**
 * Mods available in classic osu!stable / long-standing web filters — used to
 * split the second column (“lazer”) from the first (“stable”). Anything else
 * with a known acronym is treated as lazer-first.
 */
export const STABLE_MOD_ACRONYMS = new Set([
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

/**
 * Everything the mod grid, the merged mod cycles and wildcard fetches share.
 * @returns {{
 *   wildcard: Map<string, number>,
 *   wildcardSeq: number,
 *   wildcardDebounceTimer: number,
 *   wildcardAbortCtrl: AbortController|null,
 *   wildcardLoading: boolean,
 *   mergedStep: Map<string, number>,
 *   mergedTarget: Map<string, number>,
 *   originalToClone: WeakMap<HTMLElement, HTMLElement>,
 * }}
 */
export function createModFilterState() {
  return {
    /** acronym → sequence counter (for oldest-eviction). 0 = not wildcard. */
    wildcard: new Map(),
    /** Monotonically increasing counter so the oldest wildcard can be evicted. */
    wildcardSeq: 0,
    /** Timer id for the 1-second mod-change debounce. */
    wildcardDebounceTimer: 0,
    /** Abort controller for in-flight wildcard fetches. */
    wildcardAbortCtrl: null,
    /** True while a wildcard fetch owns the loading overlay (re-applied if React replaces the table). */
    wildcardLoading: false,
    /** Merge id → step (DT_NC: 0–3, SD_PF: 0–4). */
    mergedStep: new Map(),
    /** Merge id → step a running click plan is heading to (B80). */
    mergedTarget: new Map(),
    /** Hidden React strip button → visible grid clone (clone does not receive React class updates). */
    originalToClone: new WeakMap(),
  };
}

/** The state of the current page's grid (one scoreboard per page). */
export const state = createModFilterState();

/**
 * Start over with empty state (grid disposal). Pending timers and fetches
 * must be stopped first (`clearWildcardState`).
 */
export function resetModFilterState() {
  Object.assign(state, createModFilterState());
}

/**
 * @param {HTMLElement} modRoot
 * @returns {0|1|2}
 */
export function modDifficultyRow(modRoot) {
  const c = modRoot.className || "";
  if (/mod--type-DifficultyReduction/i.test(c)) return 0;
  if (/mod--type-DifficultyIncrease/i.test(c)) return 1;
  return 2;
}

/**
 * @param {HTMLElement} btn
 */
export function modButtonAcronym(btn) {
  const icon = btn.querySelector(".mod__icon[data-acronym]");
  const a = icon?.getAttribute("data-acronym")?.trim().toUpperCase();
  return a || "";
}

/**
 * @param {HTMLElement} btn  `.beatmap-scoreboard-mod` strip button
 */
export function isBeatmapScoreboardModStripButtonOn(btn) {
  if (!(btn instanceof HTMLElement) || btn.disabled) return false;
  if (btn.classList.contains(ENABLED_MOD_CLASS)) return true;
  if (btn.getAttribute("aria-pressed") === "true") return true;
  return false;
}

/**
 * @param {HTMLElement} clone  grid clone
 * @returns {boolean}
 */
export function isGridCloneOn(clone) {
  return (
    clone.classList.contains(ENABLED_MOD_CLASS) ||
    clone.getAttribute("aria-pressed") === "true"
  );
}

/**
 * @param {HTMLElement} clone
 * @param {boolean} on
 */
export function setGridCloneOn(clone, on) {
  clone.classList.toggle(ENABLED_MOD_CLASS, on);
  clone.setAttribute("aria-pressed", on ? "true" : "false");
}

/**
 * @param {HTMLElement} modsEl
 * @returns {HTMLElement[]}  osu-web strip buttons the grid hid
 */
export function hiddenOriginals(modsEl) {
  return /** @type {HTMLElement[]} */ (
    [...modsEl.querySelectorAll(HIDDEN_ORIGINAL_SEL)].filter(
      (n) => n instanceof HTMLElement,
    )
  );
}

/**
 * @param {HTMLElement} modsEl
 * @param {string} acronym
 * @returns {HTMLElement|null}
 */
export function findHiddenBeatmapModButton(modsEl, acronym) {
  const want = String(acronym || "")
    .trim()
    .toUpperCase();
  if (!want) return null;
  return (
    hiddenOriginals(modsEl).find((b) => modButtonAcronym(b) === want) ?? null
  );
}

/**
 * @param {string} acronym
 * @returns {boolean}
 */
export function isWildcard(acronym) {
  return (state.wildcard.get(acronym) || 0) > 0;
}

/** @returns {string[]} Acronyms currently in wildcard state. */
export function getWildcardMods() {
  const out = [];
  for (const [ac, seq] of state.wildcard) {
    if (seq > 0) out.push(ac);
  }
  return out;
}
