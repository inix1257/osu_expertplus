/**
 * Custom-rate scores (WS-32): rows whose DT/NC/HT/DC speed is not the
 * default are marked (and dimmed), and the “Hide custom rate scores” toggle
 * in the tools row hides them.
 */

import { observe } from "../../core/observe.js";
import { isNonDefaultSpeed } from "../../osu/mods.js";
import { el, settingIds, settings } from "../legacy.js";
import {
  EXTENDED_SCORE_ROW_ATTR,
  findBeatmapScoreboardRoot,
  RATE_EDIT_FILTER_BAR_ATTR,
  RATE_EDIT_ROW_ATTR,
  isScoreboardRowHidden,
  setRowHidden,
  SCORE_USER_SEARCH_RESULT_ATTR,
  SCOREBOARD_HTML_TABLE_SEL,
  SCOREBOARD_MODS_SEL,
  SCOREBOARD_ROW_SEL,
  SCOREBOARD_TBODY_SEL,
  WILDCARD_MERGED_ROW_ATTR,
} from "./context.js";
import { refreshBeatmapScoreboardTableEnhancements } from "./refresh.js";
import {
  insertBeatmapRateEditFilterBar,
  isRateEditFilterBarPlacedCorrectly,
  removeEmptyBeatmapScoreboardToolsRows,
  TOOLS_ROW_WATCH_SEL,
} from "./tools-row.js";

/**
 * Checkbox under mod filters (sibling of React’s mods root) + setting
 * `beatmapDetail.scoreboardHideCustomRateScores` to hide custom-rate rows.
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startBeatmapScoreboardHideRateEditFilterBar(pathRe) {
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
    const on = settings().isEnabled(
      settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
    );
    if (cb.checked !== on) cb.checked = on;
  };

  const ensureBar = (root) => {
    const modsEl = root.querySelector(SCOREBOARD_MODS_SEL);
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
        settings().set(
          settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
          cb.checked,
        );
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

  const unsub = settings().onChange(
    settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
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

  // Its own writes are only the bar and its placement: drop their records.
  const unsubscribe = observe.subscribe(
    {
      selector: TOOLS_ROW_WATCH_SEL,
      schedule: 16,
      label: "scoreboard/rate-filter",
    },
    () => observe.mutate(run),
  );
  schedule();

  return () => {
    unsub();
    window.clearTimeout(debounceTimer);
    unsubscribe();
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
    const rate = parseFloat((extSpan.textContent ?? "").replace(/[^\d.]/g, ""));
    if (Number.isFinite(rate) && isNonDefaultSpeed(acronym, rate)) {
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
 * then delegates to isNonDefaultSpeed (src/osu/mods).  Only DT/NC/HT/DC
 * extenders are considered — DA difficulty-adjust extenders (e.g. "AR9") are
 * intentionally ignored.  Works for both native osu-web rows and our injected
 * rows; neither requires the .beatmap-scoreboard-mod wrapper class.
 * Idempotent DOM writes; clears stale RATE_EDIT_ROW_ATTR on native rows only
 * so API-built rows are not stripped when DOM parsing misses an extender.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function applyRateEditMarkingToScoreboardRows(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return;
  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return;
  for (const row of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
    if (!(row instanceof HTMLElement)) continue;
    if (isScoreboardRowHidden(row)) continue;
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
 * When the setting is on, hides rows marked as custom-rate (`RATE_EDIT_ROW_ATTR`)
 * with the `rate` hide reason; other reasons (a merged leaderboard) are left
 * alone, so turning the filter off cannot reveal rows they hide (B09).
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const hide = settings().isEnabled(
    settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
  );
  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return;
  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return;
  for (const row of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
    setRowHidden(row, "rate", hide && row.hasAttribute(RATE_EDIT_ROW_ATTR));
  }
}

/**
 * The “hide custom rate scores” bar is always shown (not just when the table
 * currently has a custom-rate row) so the toggle stays reachable regardless of leaderboard content.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function syncBeatmapRateEditFilterBarVisibility(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const wrap = scoreboardRoot.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
  if (!(wrap instanceof HTMLElement)) return;
  wrap.hidden = false;
}
