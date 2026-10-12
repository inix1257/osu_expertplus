/**
 * Combo, hit statistics, Most Watched pp and weighted pp on profile score rows
 * (WS-41).
 */

import {
  STATS_DISPLAY,
  beatmapMaxComboFromScore,
  isFullCombo,
  scoreIndicatesPerfectCombo,
  statsCells,
} from "../../osu/score.js";
import { rulesetFromId } from "../../osu/ruleset.js";
import { el } from "../legacy.js";
import { rememberRowBeatmap } from "./beatmap-attributes.js";
import {
  MW_PP_CLASS,
  PP_RAW_ATTR,
  SCORE_STATS_ATTR,
  _applyByBeatmapId,
  _buildScoresByBeatmapId,
} from "./score-rows.js";
/** Tooltips for the osu!catch stats row, in osu!'s own words. */
const FRUITS_STAT_NAMES = Object.freeze({
  great: "Fruits",
  large_tick_hit: "Drops",
  small_tick_hit: "Droplets",
  small_tick_miss: "Droplet misses",
  miss: "Misses",
});

/** On the achieved-combo number when the API flagged the score as perfect. */
const PERFECT_COMBO_ATTR = "data-oep-perfect-combo";

/**
 * After attributes API resolves max combo, update the injected "achieved/maxx" span.
 * @param {HTMLElement} rowEl
 * @param {number} maxCombo
 */
export function _applyApiMaxComboToComboInline(rowEl, maxCombo) {
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
  if (!(
    afterMax?.nodeType === Node.TEXT_NODE && afterMax.textContent === "x"
  )) {
    maxEl.after(document.createTextNode("x"));
  }

  const base = "oep-combo-inline__num";
  const fullCombo =
    achEl.hasAttribute(PERFECT_COMBO_ATTR) ||
    isFullCombo({ max_combo: achN }, maxN, { apiFlags: true });
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

  const achieved = score?.max_combo ?? 0;
  const maxCombo = beatmapMaxComboFromScore(score);
  const maxStr =
    maxCombo != null && Number.isFinite(Number(maxCombo))
      ? String(maxCombo)
      : "0";

  // D10-7: the score's own perfect-combo flags count too (as on the
  // scoreboard), not only achieved === map max.
  const fullCombo = isFullCombo(score, maxCombo, { apiFlags: true });

  const achNumClass = (base) => (fullCombo ? `${base} ${base}--full` : base);
  const maxNumClass = (base) =>
    maxCombo != null && Number.isFinite(Number(maxCombo))
      ? `${base} ${base}--full`
      : base;

  const comboParts = [
    el(
      "span",
      {
        class: achNumClass("oep-combo-inline__num"),
        [PERFECT_COMBO_ATTR]: scoreIndicatesPerfectCombo(score) ? "" : null,
      },
      String(achieved),
    ),
    "/",
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
 * Build a mode-aware stats row element from a full score object.
 *
 * osu! standard  — 300 / 100 / 50 / miss
 * osu!taiko      — GREAT / OK / miss
 * osu!catch      — fruits / drops / droplets / miss
 * osu!mania      — MAX / 300 / 200 / 100 / 50 / miss
 *
 * @param {Object} score  full score object from the API
 */
function buildStatsRow(score) {
  const sep = () => el("span", { class: "oep-score-stats__sep" }, "/");
  const parts = [];
  // Five catch numbers are hard to tell apart without labels (#21).
  const names =
    rulesetFromId(score?.ruleset_id ?? 0) === "fruits" ? FRUITS_STAT_NAMES : {};
  for (const cell of statsCells(score, STATS_DISPLAY.profile)) {
    if (parts.length) parts.push(sep());
    parts.push(
      el(
        "span",
        { class: cell.className, title: names[cell.key] ?? null },
        String(cell.value),
      ),
    );
  }
  const row = el("div", { class: "oep-score-stats" }, ...parts);
  // Sizes the text so long counts fit the column on one line (styles.js).
  row.style.setProperty("--oep-stats-chars", String(row.textContent.length));
  row.style.setProperty(
    "--oep-stats-seps",
    String(Math.max(0, (parts.length - 1) / 2)),
  );
  return row;
}

/**
 * Inject a stats row into a single .play-detail element.
 * The row is appended to the middle column (.play-detail__score-detail-top-right)
 * so it appears below the accuracy/combo figures.
 * @param {Element} rowEl  .play-detail element
 * @param {Object} score  full score object from the API (needs include=beatmap for map max combo)
 */
export function injectStatsRow(rowEl, score) {
  if (rowEl.hasAttribute(SCORE_STATS_ATTR)) return;

  const midCol = rowEl.querySelector(".play-detail__score-detail-top-right");
  if (!midCol) return;

  injectComboAfterAccuracy(rowEl, score);

  const statsRow = buildStatsRow(score);
  const comboStatsCol = rowEl.querySelector(".oep-combo-stats-col");
  (comboStatsCol || midCol).appendChild(statsRow);
  rowEl.setAttribute(SCORE_STATS_ATTR, "1");
}

/**
 * Give every row that lacks it the stats of its score, matched by beatmap in
 * row order. A row osu! re-rendered keeps our attribute but lost the stats, so
 * it is filled again. Serves the first pass and every later row change.
 * @param {HTMLElement[]} rows
 * @param {Object[]} scores
 */
export function fillStatsRows(rows, scores) {
  _applyByBeatmapId(
    rows,
    _buildScoresByBeatmapId(scores),
    new Map(),
    (rowEl, score) => {
      rememberRowBeatmap(rowEl, score?.beatmap);
      if (!rowEl.querySelector(".oep-score-stats")) {
        rowEl.removeAttribute(SCORE_STATS_ATTR);
      }
      injectStatsRow(rowEl, score);
    },
  );
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
  rowEl.querySelector(".oep-combo-inline")?.remove();
}

/** Remove all injected stats rows from a list element. */
export function revertStatsRows(listEl) {
  listEl
    .querySelectorAll(`.play-detail[${SCORE_STATS_ATTR}]`)
    .forEach((rowEl) => {
      rowEl.removeAttribute(SCORE_STATS_ATTR);
      rowEl.querySelector(".oep-score-stats")?.remove();
      _revertAccuracyComboWrap(rowEl);
    });
}

/**
 * Inject PP value into a single Most Watched Replays play-detail row.
 * The span is placed inside the existing .play-detail__pp (watch-count column),
 * using a title attribute so applyPpDecimals picks it up automatically.
 */
export function injectMostWatchedPpRow(rowEl, score) {
  const ppEl = rowEl.querySelector(".play-detail__pp");
  if (!ppEl || ppEl.querySelector(`.${MW_PP_CLASS}`)) return;
  const pp = Number(score?.pp);
  if (!Number.isFinite(pp) || pp <= 0) return;
  ppEl.appendChild(
    el(
      "span",
      {
        class: MW_PP_CLASS,
        title: String(score.pp),
        [PP_RAW_ATTR]: String(score.pp),
      },
      String(Math.round(pp)),
      el("span", { class: "play-detail__pp-unit" }, "pp"),
    ),
  );
}

export function applyMostWatchedPp(listEl, scores) {
  const byBeatmap = _buildScoresByBeatmapId(scores);
  const usageCount = new Map();
  _applyByBeatmapId(
    Array.from(listEl.querySelectorAll(".play-detail")),
    byBeatmap,
    usageCount,
    injectMostWatchedPpRow,
  );
}

export function revertMostWatchedPp(listEl) {
  listEl.querySelectorAll(`.${MW_PP_CLASS}`).forEach((span) => span.remove());
}

export function applyHideWeightedPp(listEl) {
  listEl.querySelectorAll(".play-detail").forEach((rowEl) => {
    rowEl
      .querySelector(".play-detail__weighted-pp")
      ?.classList.add("oep-hidden");
    rowEl.querySelector(".play-detail__pp-weight")?.classList.add("oep-hidden");
  });
}
