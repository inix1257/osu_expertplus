/**
 * Profile score lists: setting ids, pp decimals, row <-> score matching, section
 * types, place numbers and layout classes (WS-41).
 */

import {
  el,
  formatDecimalPp,
  manageStyle,
  parseLocaleNumber,
  settingIds,
  settings,
} from "../legacy.js";
import { RECENT_FAILS_WRAP_CLASS } from "./recent-scores/common.js";
// Score lists: PP from span title → 2dp; hit-stat row from API (fetchScores)
export const SCORE_PP_DECIMALS_ID = settingIds().SCORE_PP_DECIMALS;
export const SCORE_HIT_STATISTICS_ID = settingIds().SCORE_HIT_STATISTICS;
export const SCORE_PERIOD_HIGHLIGHT_ID = settingIds().SCORE_PERIOD_HIGHLIGHT;
export const RECENT_SCORES_SHOW_FAILS_ID =
  settingIds().RECENT_SCORES_SHOW_FAILS;
export const PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID =
  settingIds().PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE;
const PP_DECIMALS_ATTR = "data-oep-pp-original";

export function applyPpDecimals(listEl) {
  listEl.querySelectorAll(".play-detail__pp > span[title]").forEach((span) => {
    const full = span.getAttribute("title");
    if (!full) return;

    const textNode = Array.from(span.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE,
    );
    if (!textNode) return;

    const n = parseLocaleNumber(full);
    if (!Number.isFinite(n)) return;

    const expected = formatDecimalPp(n) + "\u200A"; // hair space
    if (textNode.textContent === expected) return;

    span.setAttribute(PP_DECIMALS_ATTR, textNode.textContent.trim());
    textNode.textContent = expected;
  });
}

export function revertPpDecimals(listEl) {
  listEl
    .querySelectorAll(`.play-detail__pp > span[${PP_DECIMALS_ATTR}]`)
    .forEach((span) => {
      const original = span.getAttribute(PP_DECIMALS_ATTR);
      const textNode = Array.from(span.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE,
      );
      if (textNode) textNode.textContent = original;
      span.removeAttribute(PP_DECIMALS_ATTR);
    });
}

export const PLAY_DETAIL_STYLE_ID = "osu-expertplus-play-detail";

/** On `.play-detail-list`: enables our desktop column widths; remove when feature off. */
export const SCORE_LIST_LAYOUT_CLASS = "oep-score-list-details-layout";
/** Class on the injected PP span inside Most Watched Replays' watch-count column. */
export const MW_PP_CLASS = "oep-mw-pp";
/** Wider PP column track when "PP decimals on scores" is on (layout list only). */
export const SCORE_LIST_PP_DECIMALS_CLASS = "oep-score-list-pp-decimals";
export const SCORE_LIST_LAYOUT_SEL = `.play-detail-list.${SCORE_LIST_LAYOUT_CLASS}`;

/** Desktop `.play-detail` flex tracks (mods / pp / accuracy / combo+stats). */
export const PLAY_DETAIL_DESKTOP_TUNING = {
  modsColMaxWidth: "min(72vw, 40rem)",
  ppDesktopWidth: "max(102px, 10ch)",
  ppColWidth: "calc(max(102px, 10ch) + 2.45rem)",
  accuracyColWidth: "7.5ch",
  comboStatsColWidth: "13rem",
  midGap: "0.28em",
  srBadgeMinWidth: "4.5rem",
};

export const SCORE_STATS_ATTR = "data-oep-stats";

/**
 * Extract the beatmap ID from a play-detail row's title link.
 * Returns null when the link is absent or not yet rendered.
 * @param {HTMLElement} rowEl
 * @returns {string|null}
 */
export function _beatmapIdFromRow(rowEl) {
  const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
  const m = href.match(/#\w+\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Build a Map<beatmapId, score[]> from an array of API score objects.
 * Multiple scores may share the same beatmap ID (e.g. different mods),
 * so each key maps to an ordered list rather than a single value.
 * @param {Object[]} scores
 * @returns {Map<string, Object[]>}
 */
export function _buildScoresByBeatmapId(scores) {
  const map = new Map();
  for (const s of scores) {
    const id = String(s?.beatmap?.id ?? "");
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(s);
  }
  return map;
}

/**
 * Iterate `elements` and call `fn(rowEl, score)` for each row that can be
 * matched to a score by beatmap ID.  Rows without a recognisable beatmap
 * URL are silently skipped.  When several scores share the same beatmap ID
 * (rare – e.g. DT vs HDDT on the same map) they are consumed in encounter
 * order; `usageCount` is mutated in place and must be shared across
 * consecutive calls that work on the same underlying scores array.
 *
 * @param {HTMLElement[]} elements
 * @param {Map<string, Object[]>} byBeatmap  from _buildScoresByBeatmapId
 * @param {Map<string, number>}  usageCount  caller-owned, mutated here
 * @param {(rowEl: HTMLElement, score: Object) => void} fn
 */
export function _applyByBeatmapId(elements, byBeatmap, usageCount, fn) {
  elements.forEach((rowEl) => {
    const bmId = _beatmapIdFromRow(rowEl);
    if (!bmId) return;
    const candidates = byBeatmap.get(bmId);
    if (!candidates) return;
    const idx = usageCount.get(bmId) ?? 0;
    const score = candidates[idx];
    if (!score) return;
    usageCount.set(bmId, idx + 1);
    fn(rowEl, score);
  });
}

/**
 * Identify what type of score section a .play-detail-list belongs to.
 * Uses language-independent structural/positional signals; falls back to
 * heading text for English.
 * @returns {'pinned'|'best'|'firsts'|'most_watched'|null}
 */
export function _getSectionType(listEl) {
  // Our injected Recent Scores list sits inside RECENT_FAILS_WRAP_CLASS;
  // it is managed separately and must not be re-processed here.
  if (listEl.closest(`.${RECENT_FAILS_WRAP_CLASS}`)) return null;

  // Lists inside the "historical" section are never pinned/best/firsts.
  // The Most Watched Replays list there has its own dedicated fetch.
  // This check must precede the pp-weight check below because osu! renders
  // .play-detail__weighted-pp on Most Watched Replays cards just as it does
  // for Best Performance, which would otherwise cause a false "best" match.
  if (listEl.closest('[data-page-id="historical"]')) return "most_watched";

  // "best" always renders pp-weight elements (language-independent)
  if (
    listEl.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp")
  )
    return "best";

  // show-more-link sibling carries the section key as a BEM class modifier
  const nextSib = listEl.nextElementSibling;
  if (
    nextSib instanceof HTMLElement &&
    nextSib.classList.contains("show-more-link")
  ) {
    if (nextSib.classList.contains("show-more-link--pinned")) return "pinned";
    if (nextSib.classList.contains("show-more-link--best")) return "best";
    if (nextSib.classList.contains("show-more-link--firsts")) return "firsts";
  }

  // position relative to the structurally identified "best" list within
  // top_ranks (osu-web always renders pinned → best → firsts)
  const topRanksPage = listEl.closest('[data-page-id="top_ranks"]');
  if (topRanksPage) {
    const allLists = Array.from(
      topRanksPage.querySelectorAll(".play-detail-list"),
    );
    const bestIdx = allLists.findIndex((el) =>
      el.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp"),
    );
    if (bestIdx >= 0) {
      const idx = allLists.indexOf(listEl);
      if (idx < bestIdx) return "pinned";
      if (idx > bestIdx) return "firsts";
    }
  }

  // heading text fallback (English)
  let n = listEl.previousElementSibling;
  while (n) {
    if (
      n instanceof HTMLElement &&
      n.matches("h3.title.title--page-extra-small")
    ) {
      const text = n.textContent.toLowerCase();
      if (text.includes("pinned")) return "pinned";
      if (text.includes("best performance")) return "best";
      if (text.includes("first place")) return "firsts";
      return null;
    }
    n = n.previousElementSibling;
  }
  return null;
}

export const SCORE_PLACE_NUMBER_ID = settingIds().SCORE_CARD_PLACE_NUMBER;
export const SCORE_PLACE_CLASS = "oep-score-place";
const SCORE_TITLE_ROW_CLASS = "oep-score-title-row";
const SCORE_PLACE_NUMBER_STYLE_ID = "osu-expertplus-score-place-number";
const SCORE_PLACE_NUMBER_CSS = `
  .${SCORE_TITLE_ROW_CLASS} {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 0.45em 0.55em;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .${SCORE_TITLE_ROW_CLASS} .play-detail__title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .${SCORE_TITLE_ROW_CLASS} .${SCORE_PLACE_CLASS} {
    align-self: flex-start;
    box-sizing: border-box;
    color: hsl(220, 10%, 68%);
    display: block;
    flex-shrink: 0;
    font-family: inherit;
    font-size: 14px;
    font-weight: inherit;
    letter-spacing: inherit;
    line-height: normal;
    margin: 0;
    opacity: 0.78;
    padding: 0;
    white-space: nowrap;
  }
`;
export const scorePlaceNumberStyle = manageStyle(
  SCORE_PLACE_NUMBER_STYLE_ID,
  SCORE_PLACE_NUMBER_CSS,
);

export function applyPlaceNumbers(listEl) {
  const rows = Array.from(listEl.querySelectorAll(".play-detail"));
  rows.forEach((rowEl, i) => {
    const detail = rowEl.querySelector(".play-detail__detail");
    if (!(detail instanceof HTMLElement)) return;

    const titleRow = detail.querySelector(`:scope > .${SCORE_TITLE_ROW_CLASS}`);
    const placeInRow = titleRow?.querySelector(`.${SCORE_PLACE_CLASS}`);
    const titleInRow = titleRow?.querySelector("a.play-detail__title");

    if (
      titleRow &&
      placeInRow &&
      titleInRow &&
      titleInRow.parentElement === titleRow
    ) {
      const expected = `#${i + 1}`;
      if (placeInRow.textContent !== expected) {
        placeInRow.textContent = expected;
      }
      return;
    }

    rowEl.querySelectorAll(`.${SCORE_PLACE_CLASS}`).forEach((n) => n.remove());
    detail
      .querySelectorAll(`:scope > .${SCORE_TITLE_ROW_CLASS}`)
      .forEach((tr) => {
        const t = tr.querySelector("a.play-detail__title");
        if (t instanceof HTMLElement && tr.parentElement === detail) {
          detail.insertBefore(t, tr);
        }
        tr.remove();
      });

    const title = detail.querySelector(":scope > a.play-detail__title");
    if (!(title instanceof HTMLElement)) return;

    const row = el("div", { class: SCORE_TITLE_ROW_CLASS });
    const place = el("div", { class: SCORE_PLACE_CLASS }, `#${i + 1}`);
    detail.insertBefore(row, title);
    row.appendChild(place);
    row.appendChild(title);
  });
}

export function revertPlaceNumbers(listEl) {
  listEl.querySelectorAll(`.${SCORE_TITLE_ROW_CLASS}`).forEach((wrap) => {
    const detail = wrap.parentElement;
    const title = wrap.querySelector("a.play-detail__title");
    if (detail instanceof HTMLElement && title instanceof HTMLElement) {
      detail.insertBefore(title, wrap);
    }
    wrap.remove();
  });
  listEl.querySelectorAll(`.${SCORE_PLACE_CLASS}`).forEach((n) => n.remove());
}

export const SCORE_SECTION_TYPES = ["pinned", "best", "firsts", "most_watched"];
export const SCORE_PLACE_SECTION_TYPE = "best";

export function setScoreListLayoutClass(sections, enabled) {
  sections.forEach(({ listEl }) => {
    listEl.classList.toggle(SCORE_LIST_LAYOUT_CLASS, enabled);
  });
}

export function syncScoreListPpDecimalsWidthClass(listEl) {
  listEl.classList.toggle(
    SCORE_LIST_PP_DECIMALS_CLASS,
    settings().isEnabled(SCORE_PP_DECIMALS_ID),
  );
}

// Mark lists we enhance so stale-element waits target our DOM until Inertia replaces it.
export const PLAY_DETAIL_LIST_PROCESSED_ATTR = "data-oep-processed";
export const PLAY_DETAIL_LIST_STALE_SEL = `.play-detail-list[${PLAY_DETAIL_LIST_PROCESSED_ATTR}]`;
