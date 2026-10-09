/**
 * Ranks section: highlight scores from a recent period, card backgrounds
 * (WS-41).
 */

import { beatmapsetIdFromHref } from "../../osu/beatmapset-data.js";
import { el, manageStyle, settingIds, settings } from "../legacy.js";
import { mutationsIncludeSelector } from "./mutations.js";
import {
  RECENT_FAILS_WRAP_CLASS,
  findMostWatchedReplaysListRoot,
} from "./recent-scores/common.js";
import { SCORE_PERIOD_HIGHLIGHT_ID, SCORE_PLACE_CLASS } from "./score-rows.js";
// Top ranks: period highlight vs card-bg layout are separate style tags so turning off
// "Score age period highlight" does not strip CSS required for score-card backgrounds.
const RANKS_PERIOD_HIGHLIGHT_STYLE_ID =
  "osu-expertplus-profile-ranks-period-highlight";
const RANKS_CARD_BG_LAYOUT_STYLE_ID =
  "osu-expertplus-profile-ranks-card-bg-layout";
const RANKS_PAGE_SELECTOR = 'div.js-sortable--page[data-page-id="top_ranks"]';
const RANKS_DATE_FILTER_CLASS = "oep-ranks-date-filter";
const RANKS_DATE_HIGHLIGHT_CLASS = "oep-ranks-date-highlight";
const RANKS_CARD_BG_ATTR = "data-oep-ranks-card-bg";
const RANKS_CARD_BG_BEATMAPSET_ATTR = "data-oep-ranks-card-bg-beatmapset";
const RANKS_CARD_BG_SELECTOR = `.play-detail[${RANKS_CARD_BG_ATTR}="1"]`;
const RANKS_CARD_BG_IMG_CLASS = "oep-card-bg-img";
const RANKS_CARD_BASE_BG_VAR = "--oep-ranks-card-base-bg";
const RANKS_CARD_PP_BG_VAR = "--oep-ranks-card-pp-bg";
const RANKS_CARD_STATS_BG_VAR = "--oep-ranks-card-stats-bg";
const RANKS_CARD_EDGE_CUT_VAR = "--oep-ranks-card-edge-cut";
const RANKS_CARD_BG_IO_ROOT_MARGIN = "220px 0px";
export const RANKS_CARD_BG_FEATURE_ID = settingIds().SCORE_CARD_BACKGROUNDS;
/** @type {IntersectionObserver|null} */
let ranksCardBgObserver = null;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_AVG_MONTH = (365.25 / 12) * MS_PER_DAY;
const RANKS_PERIOD_IDX_MIN = 0;
const RANKS_PERIOD_IDX_MAX = 36;
const RANKS_PERIOD_IDX_DEFAULT = 0;
const RANKS_PERIOD_IDX_WEEK_END = 4;
const RANKS_PERIOD_IDX_MONTH_END = 28;
const RANKS_PERIOD_YEAR_START_IDX = 29;
const RANKS_PERIOD_FIRST_YEAR = 3;

const RANKS_PERIOD_HIGHLIGHT_CSS = `
  .${RANKS_DATE_FILTER_CLASS} {
    box-sizing: border-box;
    margin: 0 0 1rem 0;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    max-width: 34rem;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__text {
    margin: 0 0 0.45rem 0;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.88);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__period {
    color: #66ccff;
    font-weight: 600;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__tail {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.65rem;
    margin-bottom: 0.45rem;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row .oep-ranks-date-filter__text {
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn {
    flex-shrink: 0;
    margin: 0;
    font: inherit;
    font-size: 0.8125rem;
    line-height: 1.3;
    padding: 0.28rem 0.55rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:hover {
    border-color: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.92);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.35);
    outline-offset: 1px;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__reverse.oep-ranks-date-filter__reverse--on {
    border-color: rgba(102, 204, 255, 0.45);
    background: rgba(102, 204, 255, 0.1);
    color: #8fd4ff;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 22px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus {
    outline: none;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.4);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-runnable-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    margin-top: -5px;
    border-radius: 50%;
    background: #66ccff;
    border: 2px solid rgba(255, 255, 255, 0.92);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-thumb {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.92);
    background: #66ccff;
  }
  .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS} {
    position: relative;
    z-index: 1;
    border-radius: 6px;
    isolation: isolate;
  }
  .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    border: 2px solid rgba(102, 204, 255, 0.9);
    box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
    background: rgba(102, 204, 255, 0.12);
    pointer-events: none;
    z-index: 2;
    box-sizing: border-box;
  }
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
    border: 2px solid rgba(102, 204, 255, 0.9);
    box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
    background: rgba(102, 204, 255, 0.12);
    opacity: 1;
    box-sizing: border-box;
  }
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:hover::after,
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:focus-within::after {
    background: rgba(102, 204, 255, 0.2);
    opacity: 1;
  }
`;
const RANKS_CARD_BG_LAYOUT_CSS = `
  ${RANKS_CARD_BG_SELECTOR} {
    position: relative;
    isolation: isolate;
    --oep-ranks-card-edge-cut: 18px;
    background: var(${RANKS_CARD_BASE_BG_VAR}, transparent);
    transition: filter 120ms ease;
    contain: layout style;
  }
  ${RANKS_CARD_BG_SELECTOR}::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    -webkit-clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    background: linear-gradient(
      90deg,
      rgba(18, 22, 28, 0.72) 0%,
      rgba(18, 22, 28, 0.72) 40%,
      var(${RANKS_CARD_BASE_BG_VAR}, rgba(18, 22, 28, 1)) 75%
    );
    z-index: -1;
    pointer-events: none;
  }
  ${RANKS_CARD_BG_SELECTOR} .${RANKS_CARD_BG_IMG_CLASS} {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    border-radius: 6px;
    -webkit-clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    z-index: -2;
    pointer-events: none;
  }
  @media (min-width: 900px) {
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable {
      background: transparent;
    }
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::before,
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable .${RANKS_CARD_BG_IMG_CLASS} {
      -webkit-clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
      clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
    }
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::after {
      inset: 0 0 0 var(--pin-sortable-handle-width, 20px);
    }
  }
  ${RANKS_CARD_BG_SELECTOR}::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
    z-index: 2;
  }
  ${RANKS_CARD_BG_SELECTOR}:hover::after,
  ${RANKS_CARD_BG_SELECTOR}:focus-within::after {
    opacity: 1;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__group--top,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__group--bottom,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__detail,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail-top-right,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__mods,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__beatmap-and-time,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__title,
  ${RANKS_CARD_BG_SELECTOR} .${SCORE_PLACE_CLASS},
  ${RANKS_CARD_BG_SELECTOR} .play-detail__time {
    background: transparent !important;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::before,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::after {
    background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp,
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp,
  ${RANKS_CARD_BG_SELECTOR}:focus-within .play-detail__pp {
    background-color: var(${RANKS_CARD_PP_BG_VAR}) !important;
    filter: none !important;
  }
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::before,
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::after {
    background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    filter: none !important;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__more {
    z-index: 3;
  }
`;
const ranksPeriodHighlightStyle = manageStyle(
  RANKS_PERIOD_HIGHLIGHT_STYLE_ID,
  RANKS_PERIOD_HIGHLIGHT_CSS,
);
const ranksCardBgLayoutStyle = manageStyle(
  RANKS_CARD_BG_LAYOUT_STYLE_ID,
  RANKS_CARD_BG_LAYOUT_CSS,
);

/**
 * @param {unknown} n
 * @returns {number}
 */
function clampRanksPeriodIndex(n) {
  let x = Math.round(Number(n));
  if (!Number.isFinite(x)) x = RANKS_PERIOD_IDX_DEFAULT;
  return Math.min(RANKS_PERIOD_IDX_MAX, Math.max(RANKS_PERIOD_IDX_MIN, x));
}

/**
 * @param {number} idx
 * @returns {number} ms to subtract from “now” for the highlight window
 */
function periodIndexToLookbackMs(idx) {
  const i = clampRanksPeriodIndex(idx);
  if (i <= 0) return 0;
  if (i <= RANKS_PERIOD_IDX_WEEK_END) return i * MS_PER_WEEK;
  if (i <= RANKS_PERIOD_IDX_MONTH_END)
    return (i - RANKS_PERIOD_IDX_WEEK_END) * MS_PER_AVG_MONTH;
  const years = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
  return years * 12 * MS_PER_AVG_MONTH;
}

/**
 * @param {number} idx
 * @returns {string}
 */
function formatRanksPeriodShortLabel(idx) {
  const i = clampRanksPeriodIndex(idx);
  if (i <= 0) return "No highlight";
  if (i <= RANKS_PERIOD_IDX_WEEK_END) return i === 1 ? "1 week" : `${i} weeks`;
  if (i <= RANKS_PERIOD_IDX_MONTH_END) {
    const mo = i - RANKS_PERIOD_IDX_WEEK_END;
    return mo === 1 ? "1 month" : `${mo} months`;
  }
  const y = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
  return `${y} years`;
}

/**
 * @param {HTMLElement} statusEl  <strong.oep-ranks-date-filter__period>
 * @param {HTMLElement} tailEl    <span.oep-ranks-date-filter__tail>
 * @param {number} periodIdx
 * @param {boolean} reversed
 */
function setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversed) {
  const i = clampRanksPeriodIndex(periodIdx);
  if (i === 0) {
    statusEl.textContent = "No highlight";
    tailEl.textContent = " — drag to set a period.";
  } else {
    statusEl.textContent = formatRanksPeriodShortLabel(i);
    tailEl.textContent = reversed
      ? " · older scores highlighted"
      : " · recent scores highlighted";
  }
}

/**
 * @param {Element} rowEl
 * @returns {number|null}  epoch ms
 */
function getPlayDetailScoreTimeMs(rowEl) {
  const t =
    rowEl.querySelector(".play-detail__time time[datetime]") ||
    rowEl.querySelector("time.js-timeago") ||
    rowEl.querySelector("time.timeago") ||
    rowEl.querySelector("time[datetime]");
  if (!t) return null;
  const iso = t.getAttribute("datetime");
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function injectRanksPeriodHighlightStyles() {
  ranksPeriodHighlightStyle.inject();
}

export function injectRanksCardBgLayoutStyles() {
  ranksCardBgLayoutStyle.inject();
}

/**
 * @param {ParentNode} topRanksRoot
 * @param {number} periodIdx
 * @param {boolean} reversed  if true, highlight scores *older* than the window
 */
function applyRanksDateHighlights(topRanksRoot, periodIdx, reversed) {
  const rows = topRanksRoot.querySelectorAll(".play-detail-list .play-detail");
  rows.forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));

  const idx = clampRanksPeriodIndex(periodIdx);
  if (idx === 0) return;

  const cutoff = Date.now() - periodIndexToLookbackMs(idx);
  rows.forEach((row) => {
    const scoreMs = getPlayDetailScoreTimeMs(row);
    if (scoreMs == null) return;
    const inWindow = reversed ? scoreMs < cutoff : scoreMs >= cutoff;
    if (inWindow) row.classList.add(RANKS_DATE_HIGHLIGHT_CLASS);
  });
}

/**
 * @param {Element} root  Top ranks page, or a `.play-detail-list` element
 * @returns {HTMLElement[]}
 */
function queryPlayDetailScoreRows(root) {
  if (!(root instanceof HTMLElement)) return [];
  if (root.classList.contains("play-detail-list")) {
    return Array.from(root.querySelectorAll(":scope > .play-detail"));
  }
  return Array.from(root.querySelectorAll(".play-detail-list .play-detail"));
}

/**
 * @param {Element} rowEl
 * @returns {number|null}
 */
function getRanksRowBeatmapsetId(rowEl) {
  const href = rowEl
    .querySelector("a.play-detail__title")
    ?.getAttribute("href");
  return beatmapsetIdFromHref(href);
}

/**
 * @param {HTMLElement} topRanksRoot
 */
export function applyRanksCardBackgrounds(topRanksRoot) {
  const pickBaseBg = (rowEl) => {
    const candidates = [
      rowEl,
      rowEl.querySelector(".play-detail__group--top"),
      rowEl.querySelector(".play-detail__group--bottom"),
      rowEl.querySelector(".play-detail__detail"),
      rowEl.querySelector(".play-detail__score-detail"),
    ];
    for (const elCandidate of candidates) {
      if (!(elCandidate instanceof Element)) continue;
      const bg = getComputedStyle(elCandidate).backgroundColor;
      if (!bg) continue;
      if (bg === "transparent") continue;
      if (/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(bg))
        continue;
      return bg;
    }
    return "";
  };

  if (!ranksCardBgObserver && "IntersectionObserver" in window) {
    ranksCardBgObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const rowEl = entry.target;
          if (!(rowEl instanceof HTMLElement)) return;
          const beatmapsetId = rowEl.getAttribute(
            RANKS_CARD_BG_BEATMAPSET_ATTR,
          );
          const imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
          if (!beatmapsetId || !imgEl) return;
          if (entry.isIntersecting) {
            imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
          } else {
            imgEl.removeAttribute("src");
          }
        });
      },
      { root: null, rootMargin: RANKS_CARD_BG_IO_ROOT_MARGIN, threshold: 0 },
    );
  }

  queryPlayDetailScoreRows(topRanksRoot).forEach((rowEl) => {
    const beatmapsetId = getRanksRowBeatmapsetId(rowEl);
    if (!beatmapsetId) {
      ranksCardBgObserver?.unobserve(rowEl);
      rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
      rowEl.removeAttribute(RANKS_CARD_BG_ATTR);
      rowEl.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
      rowEl.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
      rowEl.style.removeProperty(RANKS_CARD_PP_BG_VAR);
      rowEl.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
      return;
    }
    const bgCandidate = pickBaseBg(rowEl);
    const ppEl = rowEl.querySelector(".play-detail__pp");
    const ppBg =
      ppEl instanceof Element ? getComputedStyle(ppEl).backgroundColor : "";
    const scoreDetailEl = rowEl.querySelector(".play-detail__score-detail");
    const statsBg =
      scoreDetailEl instanceof Element
        ? getComputedStyle(scoreDetailEl).backgroundColor
        : "";
    rowEl.setAttribute(RANKS_CARD_BG_ATTR, "1");
    rowEl.setAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR, beatmapsetId);
    if (bgCandidate) {
      rowEl.style.setProperty(RANKS_CARD_BASE_BG_VAR, bgCandidate);
    }
    if (
      ppBg &&
      ppBg !== "transparent" &&
      !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(ppBg)
    ) {
      rowEl.style.setProperty(RANKS_CARD_PP_BG_VAR, ppBg);
    }
    if (
      statsBg &&
      statsBg !== "transparent" &&
      !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(statsBg)
    ) {
      rowEl.style.setProperty(RANKS_CARD_STATS_BG_VAR, statsBg);
    }
    let imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
    if (!imgEl) {
      imgEl = document.createElement("img");
      imgEl.className = RANKS_CARD_BG_IMG_CLASS;
      imgEl.decoding = "async";
      imgEl.alt = "";
      rowEl.insertBefore(imgEl, rowEl.firstChild);
    }
    if (ranksCardBgObserver) {
      ranksCardBgObserver.observe(rowEl);
      if (!rowEl.isConnected) ranksCardBgObserver.unobserve(rowEl);
    } else {
      imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
    }
  });
}

function insertRanksDateFilterBar(topRanksRoot, wrap) {
  const pageExtra =
    topRanksRoot.querySelector(":scope > .page-extra") ||
    topRanksRoot.querySelector(".page-extra");

  if (pageExtra instanceof HTMLElement) {
    const lazy = pageExtra.querySelector(":scope > .lazy-load");
    if (lazy) {
      pageExtra.insertBefore(wrap, lazy);
      return;
    }
    const header = pageExtra.querySelector(":scope > .u-relative");
    if (header instanceof HTMLElement) {
      header.insertAdjacentElement("afterend", wrap);
      return;
    }
    const h2 = pageExtra.querySelector(
      ":scope > h2.title--page-extra, :scope > h2.title.title--page-extra",
    );
    if (h2 instanceof HTMLElement) {
      h2.insertAdjacentElement("afterend", wrap);
      return;
    }
    const firstSectionH3 = pageExtra.querySelector(
      "h3.title--page-extra-small",
    );
    if (firstSectionH3 instanceof HTMLElement) {
      firstSectionH3.insertAdjacentElement("beforebegin", wrap);
      return;
    }
  }

  topRanksRoot.insertBefore(wrap, topRanksRoot.firstChild);
}

/**
 * @param {HTMLElement} topRanksRoot
 */
function ensureRanksDateFilterBar(topRanksRoot) {
  if (topRanksRoot.querySelector(`.${RANKS_DATE_FILTER_CLASS}`)) return;

  const periodIdx = RANKS_PERIOD_IDX_DEFAULT;

  const statusEl = el("strong", { class: "oep-ranks-date-filter__period" });
  const tailEl = el("span", { class: "oep-ranks-date-filter__tail" });
  setRanksFilterBarLabels(statusEl, tailEl, periodIdx, false);

  const resetBtn = el(
    "button",
    {
      type: "button",
      class: "oep-ranks-date-filter__btn oep-ranks-date-filter__reset",
      "aria-label": "Reset period and reverse filter",
    },
    "Reset",
  );

  const revBtn = el(
    "button",
    {
      type: "button",
      class: "oep-ranks-date-filter__btn oep-ranks-date-filter__reverse",
      "aria-pressed": "false",
      "aria-label": "Reverse highlight to older scores outside the period",
    },
    "Reverse",
  );

  const range = el("input", {
    type: "range",
    class: "oep-ranks-date-filter__range",
    min: String(RANKS_PERIOD_IDX_MIN),
    max: String(RANKS_PERIOD_IDX_MAX),
    step: "1",
    value: String(periodIdx),
  });
  range.setAttribute(
    "aria-label",
    "Highlight window: off, then weeks, months, and years",
  );

  const readReversed = () => revBtn.getAttribute("aria-pressed") === "true";

  const wrap = el(
    "div",
    { class: RANKS_DATE_FILTER_CLASS },
    el(
      "div",
      { class: "oep-ranks-date-filter__row" },
      el("p", { class: "oep-ranks-date-filter__text" }, statusEl, tailEl),
      el("div", { class: "oep-ranks-date-filter__actions" }, resetBtn, revBtn),
    ),
    range,
  );
  insertRanksDateFilterBar(topRanksRoot, wrap);

  range.addEventListener("input", () => {
    const idx = clampRanksPeriodIndex(range.value);
    setRanksFilterBarLabels(statusEl, tailEl, idx, readReversed());
    applyRanksDateHighlights(topRanksRoot, idx, readReversed());
  });

  revBtn.addEventListener("click", () => {
    const next = revBtn.getAttribute("aria-pressed") !== "true";
    revBtn.setAttribute("aria-pressed", next ? "true" : "false");
    revBtn.classList.toggle("oep-ranks-date-filter__reverse--on", next);
    const idx = clampRanksPeriodIndex(range.value);
    setRanksFilterBarLabels(statusEl, tailEl, idx, next);
    applyRanksDateHighlights(topRanksRoot, idx, next);
  });

  resetBtn.addEventListener("click", () => {
    range.value = String(RANKS_PERIOD_IDX_DEFAULT);
    revBtn.setAttribute("aria-pressed", "false");
    revBtn.classList.remove("oep-ranks-date-filter__reverse--on");
    setRanksFilterBarLabels(statusEl, tailEl, RANKS_PERIOD_IDX_DEFAULT, false);
    applyRanksDateHighlights(topRanksRoot, RANKS_PERIOD_IDX_DEFAULT, false);
  });
}

/**
 * @param {HTMLElement} topRanksRoot
 */
function revertRanksCardBackgrounds() {
  document.querySelectorAll(RANKS_CARD_BG_SELECTOR).forEach((row) => {
    ranksCardBgObserver?.unobserve(row);
    row.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
    row.removeAttribute(RANKS_CARD_BG_ATTR);
    row.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
    row.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
    row.style.removeProperty(RANKS_CARD_PP_BG_VAR);
    row.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
  });
  ranksCardBgObserver?.disconnect();
  ranksCardBgObserver = null;
}

function syncRanksDateHighlightForPage(topRanksRoot) {
  if (settings().isEnabled(SCORE_PERIOD_HIGHLIGHT_ID)) {
    ensureRanksDateFilterBar(topRanksRoot);
    const range = topRanksRoot.querySelector(
      `.${RANKS_DATE_FILTER_CLASS} input[type="range"]`,
    );
    const idx = range
      ? clampRanksPeriodIndex(range.value)
      : RANKS_PERIOD_IDX_DEFAULT;
    if (range && String(range.value) !== String(idx)) range.value = String(idx);
    const revBtn = topRanksRoot.querySelector(
      ".oep-ranks-date-filter__reverse",
    );
    const reversed =
      revBtn instanceof HTMLElement
        ? revBtn.getAttribute("aria-pressed") === "true"
        : false;
    applyRanksDateHighlights(topRanksRoot, idx, reversed);
  }
  if (settings().isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
    applyRanksCardBackgrounds(topRanksRoot);
  }
}

/**
 * Ranks extra page mounts lazily; watch the DOM and keep highlights in sync
 * (including “load more”).
 * @returns {function}
 */
export function startRanksDateHighlightManager() {
  let debounceTimer = 0;
  /** @type {MutationObserver[]} */
  let rankPlayListObservers = [];

  function disconnectRankPlayListObservers() {
    rankPlayListObservers.forEach((o) => o.disconnect());
    rankPlayListObservers = [];
  }

  function connectRankPlayListObservers(scheduleFn) {
    disconnectRankPlayListObservers();
    const roots = [];
    const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
    if (ranksPage instanceof HTMLElement) roots.push(ranksPage);
    document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
      if (w instanceof HTMLElement) roots.push(w);
    });
    for (const root of roots) {
      root.querySelectorAll(".play-detail-list").forEach((listEl) => {
        if (!(listEl instanceof HTMLElement)) return;
        const o = new MutationObserver(() => {
          scheduleFn();
        });
        o.observe(listEl, { childList: true });
        rankPlayListObservers.push(o);
      });
    }
    const mostWatchedList = findMostWatchedReplaysListRoot();
    if (mostWatchedList instanceof HTMLElement) {
      const o = new MutationObserver(() => {
        scheduleFn();
      });
      o.observe(mostWatchedList, { childList: true });
      rankPlayListObservers.push(o);
    }
  }

  const run = () => {
    const periodOn = settings().isEnabled(SCORE_PERIOD_HIGHLIGHT_ID);
    const cardBgOn = settings().isEnabled(RANKS_CARD_BG_FEATURE_ID);

    if (!periodOn) {
      document
        .querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`)
        .forEach((n) => n.remove());
      document
        .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
        .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
      ranksPeriodHighlightStyle.remove();
    } else {
      injectRanksPeriodHighlightStyles();
      const page = document.querySelector(RANKS_PAGE_SELECTOR);
      if (page instanceof HTMLElement) syncRanksDateHighlightForPage(page);
      else {
        document
          .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
          .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
      }
    }

    if (cardBgOn) {
      injectRanksCardBgLayoutStyles();
      const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
      if (ranksPage instanceof HTMLElement)
        applyRanksCardBackgrounds(ranksPage);
      document
        .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`)
        .forEach((listEl) => {
          if (listEl instanceof HTMLElement) applyRanksCardBackgrounds(listEl);
        });
      const mostWatchedList = findMostWatchedReplaysListRoot();
      if (mostWatchedList instanceof HTMLElement)
        applyRanksCardBackgrounds(mostWatchedList);
    } else {
      ranksCardBgLayoutStyle.remove();
    }

    if (periodOn || cardBgOn) {
      connectRankPlayListObservers(schedule);
    } else {
      disconnectRankPlayListObservers();
    }
  };

  const schedule = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 64);
  };

  const obs = new MutationObserver((mutations) => {
    if (
      mutationsIncludeSelector(
        mutations,
        `${RANKS_PAGE_SELECTOR}, h3.title.title--page-extra-small`,
      )
    ) {
      schedule();
      return;
    }
  });
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  schedule();

  const unsubBg = settings().onChange(RANKS_CARD_BG_FEATURE_ID, (enabled) => {
    if (enabled) {
      injectRanksCardBgLayoutStyles();
      const page = document.querySelector(RANKS_PAGE_SELECTOR);
      if (page instanceof HTMLElement) applyRanksCardBackgrounds(page);
      document
        .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`)
        .forEach((listEl) => {
          if (listEl instanceof HTMLElement) applyRanksCardBackgrounds(listEl);
        });
      const mostWatchedList = findMostWatchedReplaysListRoot();
      if (mostWatchedList instanceof HTMLElement)
        applyRanksCardBackgrounds(mostWatchedList);
    } else {
      revertRanksCardBackgrounds();
      ranksCardBgLayoutStyle.remove();
    }
  });

  const unsubPeriod = settings().onChange(SCORE_PERIOD_HIGHLIGHT_ID, () =>
    schedule(),
  );

  return () => {
    unsubPeriod();
    unsubBg();
    clearTimeout(debounceTimer);
    disconnectRankPlayListObservers();
    obs.disconnect();
    ranksPeriodHighlightStyle.remove();
    ranksCardBgLayoutStyle.remove();
    document
      .querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`)
      .forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
    revertRanksCardBackgrounds();
  };
}
