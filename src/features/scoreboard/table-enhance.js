/**
 * Scoreboard table enhancements (WS-31): pp decimals, hit-stat colours, the
 * pp column tint, and re-running the table refresh when osu-web re-renders
 * rows.
 */

import { observe } from "../../core/observe.js";
import { formatDecimal, parseLocaleNumber } from "../../osu/format.js";
import { hitstatClassFromLabel } from "../../osu/score.js";
import { settingIds, settings } from "../legacy.js";
import {
  findBeatmapScoreboardRoot,
  SCOREBOARD_CELL_LINK_SEL,
  SCOREBOARD_HTML_TABLE_SEL,
  SCOREBOARD_PP_ORIGINAL_ATTR,
} from "./context.js";
import { refreshBeatmapScoreboardTableEnhancements } from "./refresh.js";
import { buildBeatmapScoreboardColumnMap } from "./row-builder.js";

/** Same tokens as user-profile score stats (`.oep-score-stats__val--*`) + mode extras. */
export const SCOREBOARD_HITSTAT_COLOR_CLASSES = [
  "oep-score-stats__val--300",
  "oep-score-stats__val--100",
  "oep-score-stats__val--50",
  "oep-score-stats__val--miss",
  "oep-score-stats__val--ctb-l",
  "oep-score-stats__val--ctb-drp",
  "oep-score-stats__val--mania-perfect",
  "oep-score-stats__val--mania-good",
];

export const SCOREBOARD_PP_VALUE_CLASS = "oep-beatmap-scoreboard-pp-value";

/**
 * Native scoreboard rows keep full pp in `span[title]` while visible text is integer.
 * Mirror user-profile behavior when “PP decimals on scores” is enabled.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function syncBeatmapScoreboardPpDecimals(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const showPpDecimals = Boolean(
    settings()?.isEnabled?.(settingIds().SCORE_PP_DECIMALS),
  );
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
        textNode.textContent = formatDecimal(n);
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
 * @param {HTMLElement|null|undefined} el
 */
export function clearBeatmapScoreboardHitstatColorClasses(el) {
  if (!(el instanceof HTMLElement)) return;
  for (const c of SCOREBOARD_HITSTAT_COLOR_CLASSES) el.classList.remove(c);
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @returns {HTMLElement|null}
 */
export function beatmapScoreboardHitstatPaintTarget(td) {
  if (!td) return null;
  const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
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
export function syncBeatmapScoreboardHitstatColors(scoreboardRoot) {
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
      const colorClass = hitstatClassFromLabel(label);

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
export function syncBeatmapScoreboardPpValueColor(scoreboardRoot) {
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
 * React injects leaderboard rows after first paint (and re-injects on every mod change /
 * difficulty switch). Re-apply styling whenever actual scoreboard body rows are added.
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startBeatmapScoreboardTableEnhancementsLive(pathRe) {
  const run = () => {
    if (!pathRe.test(location.pathname)) return;
    const root = findBeatmapScoreboardRoot();
    if (root instanceof HTMLElement) {
      refreshBeatmapScoreboardTableEnhancements(root);
    }
  };
  // Not inside observe.mutate: the pass clones mod icons (top panel) that
  // other subscribers (mod acronyms) still need to see.
  const unsubscribe = observe.subscribe(
    {
      selector: ".beatmap-scoreboard-table__body-row",
      schedule: 32,
      label: "scoreboard/table-enhance",
    },
    run,
  );
  const first = window.setTimeout(run, 32);
  // Settings the pass reads: apply them without waiting for a table change.
  const unsubSettings = [
    settingIds().SCORE_PP_DECIMALS,
    settingIds().SCOREBOARD_GLOBAL_RANK,
  ].map((id) => settings().onChange(id, run));
  return () => {
    window.clearTimeout(first);
    unsubscribe();
    unsubSettings.forEach((off) => off());
  };
}
