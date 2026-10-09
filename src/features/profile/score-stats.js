/**
 * Combo, hit statistics, Most Watched pp and weighted pp on profile score rows
 * (WS-41).
 */

import { el } from "../legacy.js";
import {
  MW_PP_CLASS,
  SCORE_STATS_ATTR,
  _applyByBeatmapId,
  _buildScoresByBeatmapId,
} from "./score-rows.js";
/**
 * @param {Object} score
 * @returns {number|null}
 */
export function _beatmapMaxComboFromScore(score) {
  const bc = score?.beatmap?.max_combo;
  if (bc != null && Number.isFinite(Number(bc))) return Number(bc);

  const ms = score?.maximum_statistics;
  if (!ms || typeof ms !== "object") return null;

  const rulesetId = Number(score?.ruleset_id);
  const num = (k) => {
    const n = Number(ms[k]);
    return ms[k] != null && Number.isFinite(n) ? n : 0;
  };

  if (rulesetId === 0) {
    // osu! standard: circles + slider ticks/tails count toward combo
    const great = num("great");
    if (!great) return null;
    if (ms.legacy_combo_increase != null) {
      return great + num("legacy_combo_increase");
    }
    return (
      great +
      num("large_tick_hit") +
      num("small_tick_hit") +
      num("slider_tail_hit")
    );
  }

  if (rulesetId === 1) {
    // osu!taiko: only regular note hits contribute to combo (drum rolls don't)
    return num("great") || null;
  }

  if (rulesetId === 2) {
    // osu!catch: large fruits + juice drops contribute to combo; tiny droplets do not
    const fruits = num("great");
    const drops = num("large_tick_hit");
    return fruits + drops || null;
  }

  // osu!mania (3) and fallback: all notes contribute to combo
  if (ms.great != null && Number.isFinite(Number(ms.great))) {
    return num("great") + num("legacy_combo_increase") || null;
  }

  return null;
}

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
    Number.isFinite(maxN) && maxN > 0 && Number.isFinite(achN) && achN === maxN;
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
  const maxCombo = _beatmapMaxComboFromScore(score);
  const maxStr =
    maxCombo != null && Number.isFinite(Number(maxCombo))
      ? String(maxCombo)
      : "0";

  const achN = Number(achieved);
  const maxN =
    maxCombo != null && Number.isFinite(Number(maxCombo))
      ? Number(maxCombo)
      : NaN;
  const fullCombo =
    Number.isFinite(maxN) && maxN > 0 && Number.isFinite(achN) && achN === maxN;

  const achNumClass = (base) => (fullCombo ? `${base} ${base}--full` : base);
  const maxNumClass = (base) =>
    maxCombo != null && Number.isFinite(Number(maxCombo))
      ? `${base} ${base}--full`
      : base;

  const comboParts = [
    el(
      "span",
      { class: achNumClass("oep-combo-inline__num") },
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
 * Normalize legacy (count_300/100/50/miss/geki/katu) statistics into the
 * lazer field names used by buildStatsRow for osu! standard.
 * @param {Object|null|undefined} statistics
 * @returns {{ great: number, ok: number, meh: number, miss: number }}
 */
function _normalizeOsuStatistics(statistics) {
  if (!statistics || typeof statistics !== "object") {
    return { great: 0, ok: 0, meh: 0, miss: 0 };
  }
  const hasLazer =
    statistics.great != null ||
    statistics.perfect != null ||
    statistics.ok != null ||
    statistics.meh != null ||
    statistics.miss != null;
  if (hasLazer) {
    return {
      great: Number(statistics.great ?? 0) + Number(statistics.perfect ?? 0),
      ok: Number(statistics.ok ?? 0),
      meh: Number(statistics.meh ?? 0),
      miss: Number(statistics.miss ?? 0),
    };
  }
  return {
    great:
      Number(statistics.count_300 ?? 0) + Number(statistics.count_geki ?? 0),
    ok: Number(statistics.count_100 ?? 0),
    meh: Number(statistics.count_50 ?? 0),
    miss: Number(statistics.count_miss ?? 0),
  };
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
  const st = score?.statistics ?? {};
  const rulesetId = Number(score?.ruleset_id ?? 0);
  const sep = () => el("span", { class: "oep-score-stats__sep" }, "/");
  const v = (cls, val) =>
    el("span", { class: `oep-score-stats__val--${cls}` }, String(val ?? 0));

  if (rulesetId === 1) {
    // osu!taiko: GREAT (300) / OK (150) / miss
    return el(
      "div",
      { class: "oep-score-stats" },
      v("300", st.great),
      sep(),
      v("100", st.ok),
      sep(),
      v("miss", st.miss),
    );
  }

  if (rulesetId === 2) {
    // osu!catch: fruits / drops (juice drops) / droplets (tiny) / miss
    // great = large fruits, large_tick_hit = juice drops, small_tick_hit = tiny droplets
    return el(
      "div",
      { class: "oep-score-stats" },
      v("300", st.great),
      sep(),
      v("100", st.large_tick_hit),
      sep(),
      v("50", st.small_tick_hit),
      sep(),
      v("miss", st.miss),
    );
  }

  if (rulesetId === 3) {
    // osu!mania: MAX (rainbow 300) / 300 / 200 / 100 / 50 / miss
    return el(
      "div",
      { class: "oep-score-stats" },
      v("perfect", st.perfect),
      sep(),
      v("300", st.great),
      sep(),
      v("good", st.good),
      sep(),
      v("100", st.ok),
      sep(),
      v("50", st.meh),
      sep(),
      v("miss", st.miss),
    );
  }

  // osu! standard (default): 300 / 100 / 50 / miss
  const n = _normalizeOsuStatistics(st);
  return el(
    "div",
    { class: "oep-score-stats" },
    v("300", n.great),
    sep(),
    v("100", n.ok),
    sep(),
    v("50", n.meh),
    sep(),
    v("miss", n.miss),
  );
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
      { class: MW_PP_CLASS, title: String(score.pp) },
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
