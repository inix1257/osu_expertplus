/**
 * The tools row under the scoreboard mod filters (WS-32): player lookup and
 * the custom-rate filter share it.
 */

import { el } from "../legacy.js";
import {
  RATE_EDIT_FILTER_BAR_ATTR,
  SCOREBOARD_MODS_SEL,
  SCOREBOARD_TOOLS_ROW_ATTR,
  SCOREBOARD_USER_SEARCH_ATTR,
} from "./context.js";

/**
 * What the tools row features watch: the scoreboard and its mod strip
 * appearing or being re-rendered, and our own elements being removed.
 */
export const TOOLS_ROW_WATCH_SEL = [
  ".beatmapset-scoreboard",
  SCOREBOARD_MODS_SEL,
  ".beatmapset-scoreboard__main",
  ".beatmap-scoreboard-table",
  `[${SCOREBOARD_TOOLS_ROW_ATTR}]`,
  `[${SCOREBOARD_USER_SEARCH_ATTR}]`,
  `[${RATE_EDIT_FILTER_BAR_ATTR}]`,
].join(", ");

/**
 * Moves the tools row to the canonical spot (after mods when present, else
 * the same fallbacks as legacy single-widget placement).
 * @param {HTMLElement} scoreboardRoot
 * @param {HTMLElement} row
 */
export function placeBeatmapScoreboardToolsRow(scoreboardRoot, row) {
  const modsEl = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
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
  if (
    row.parentElement !== scoreboardRoot ||
    row !== scoreboardRoot.firstElementChild
  ) {
    scoreboardRoot.insertBefore(row, scoreboardRoot.firstChild);
  }
}

/**
 * @param {HTMLElement} scoreboardRoot
 * @returns {HTMLElement}
 */
export function ensureBeatmapScoreboardToolsRow(scoreboardRoot) {
  let row = scoreboardRoot.querySelector(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`);
  if (!(row instanceof HTMLElement)) {
    row = /** @type {HTMLElement} */ (
      el("div", {
        class: "oep-scoreboard-tools-row",
        [SCOREBOARD_TOOLS_ROW_ATTR]: "1",
      })
    );
  }
  placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
  return row;
}

/**
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function removeEmptyBeatmapScoreboardToolsRows(scoreboardRoot) {
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
export function insertBeatmapScoreUserSearchBar(scoreboardRoot, wrap) {
  const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
  const rate = toolsRow.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
  if (wrap.parentElement !== toolsRow) {
    if (rate) toolsRow.insertBefore(wrap, rate);
    else toolsRow.appendChild(wrap);
  } else if (
    rate instanceof HTMLElement &&
    rate.previousElementSibling !== wrap
  ) {
    toolsRow.insertBefore(wrap, rate);
  }
}

/**
 * Sits in the tools row (sibling of React mod root, not inside it).
 * @param {HTMLElement} scoreboardRoot
 * @param {HTMLElement} wrap
 */
export function insertBeatmapRateEditFilterBar(scoreboardRoot, wrap) {
  const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
  toolsRow.appendChild(wrap);
}

/**
 * @param {HTMLElement} scoreboardRoot
 * @param {HTMLElement} wrap
 * @returns {boolean}
 */
export function isBeatmapScoreboardToolsRowPlacedCorrectly(
  scoreboardRoot,
  row,
) {
  if (!scoreboardRoot.contains(row)) return false;
  const modsEl = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
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
    row.parentElement === scoreboardRoot &&
    row === scoreboardRoot.firstElementChild
  );
}

/**
 * @param {HTMLElement} scoreboardRoot
 * @param {HTMLElement} wrap
 * @returns {boolean}
 */
export function isPlayerLookupSearchBarPlacedCorrectly(scoreboardRoot, wrap) {
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
export function isRateEditFilterBarPlacedCorrectly(scoreboardRoot, wrap) {
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
