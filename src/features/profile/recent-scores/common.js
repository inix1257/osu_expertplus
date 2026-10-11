/**
 * Expert+ Recent (including fails): shared helpers and section lookup (WS-41).
 */

import { difficultyMods, modAcronyms } from "../../../osu/mods.js";
import { rulesetFromId } from "../../../osu/ruleset.js";
import { beatmapMaxComboFromScore } from "../../../osu/score.js";
import {
  _fetchBeatmapAttributesCached,
  isPermanentBeatmap,
} from "../beatmap-attributes.js";
import { _applyApiMaxComboToComboInline } from "../score-stats.js";
export const RECENT_FAILS_WRAP_CLASS = "oep-recent-scores-with-fails";
export const RECENT_FAILS_HEADER_CLASS = "oep-recent-fails-header";
export const RECENT_FAILS_EMPTY_MSG = "No scores found.";
export const RECENT_FAILS_EMPTY_FILTERED_MSG =
  "No passing scores in this list (fails hidden).";

/** @type {WeakMap<HTMLElement, Object[]>} */
export const recentScoresFullCache = new WeakMap();

function apiScoreIsFail(score) {
  return Boolean(score && typeof score === "object" && score.passed === false);
}

export function filterScoresForRecentDisplay(scores, showFails) {
  if (showFails) return scores.slice();
  return scores.filter((s) => !apiScoreIsFail(s));
}

function findHistoricalPage() {
  return document.querySelector(
    'div.js-sortable--page[data-page-id="historical"]',
  );
}

/**
 * The play-detail lists osu-web rendered in Historical (not ours).
 * @returns {HTMLElement[]}
 */
function historicalPlayDetailLists() {
  const page = findHistoricalPage();
  if (!page) return [];
  return Array.from(page.querySelectorAll(".play-detail-list")).filter(
    (el) =>
      el instanceof HTMLElement && !el.closest(`.${RECENT_FAILS_WRAP_CLASS}`),
  );
}

/**
 * osu-web's Recent Plays list. Found by markup, not position or heading text
 * (B39): Recent is a `PlayDetailList` (`play-detail-list u-relative`, always
 * rendered, possibly empty), while Most Watched Replays is a bare
 * `.play-detail-list` that is only rendered when it has entries
 * (osu-web `profile-page/play-detail-list.tsx`, `historical.tsx`). The old
 * "first list" lookup removed Most Watched when Recent was missing.
 * @returns {HTMLElement|null}
 */
export function findRecentPlaysListRoot() {
  return (
    historicalPlayDetailLists().find((el) =>
      el.classList.contains("u-relative"),
    ) ?? null
  );
}

/**
 * osu-web's Most Watched Replays list (see {@link findRecentPlaysListRoot}).
 * @returns {HTMLElement|null}
 */
export function findMostWatchedReplaysListRoot() {
  return (
    historicalPlayDetailLists().find(
      (el) => !el.classList.contains("u-relative"),
    ) ?? null
  );
}

/**
 * Takes osu-web's Recent heading and list out of the page.
 * @param {HTMLElement} listRoot
 * @returns {HTMLElement[]}  the removed nodes in page order, to put back
 *   when Expert+ Recent is turned off (B102)
 */
export function removeOfficialRecentPlaysSection(listRoot) {
  if (!(listRoot instanceof HTMLElement)) return [];
  const removed = [];
  // Remove the h3 heading immediately before the list regardless of language.
  const prev = listRoot.previousElementSibling;
  if (
    prev instanceof HTMLElement &&
    prev.matches("h3.title.title--page-extra-small")
  ) {
    prev.remove();
    removed.push(prev);
  }
  listRoot.remove();
  removed.push(listRoot);
  return removed;
}

export function beatmapHrefFromScore(score) {
  const bm = score?.beatmap;
  if (!bm?.id) return "#";
  const setId = score.beatmapset?.id;
  const mode = rulesetFromId(score.ruleset_id);
  if (setId != null)
    return `https://osu.ppy.sh/beatmapsets/${setId}#${mode}/${bm.id}`;
  return `https://osu.ppy.sh/beatmaps/${bm.id}`;
}

/**
 * When score.beatmap lacks max_combo (typical for recent scores), fill the
 * injected "(achieved / max)" from POST /beatmaps/{id}/attributes. Rows are
 * only looked up once they come near the viewport (the list can hold 200
 * rows); one request per unique (beatmap, difficulty-affecting mods), shared
 * cache with modded star rating.
 * @param {HTMLElement[]} rows
 * @param {Object[]} scores  same length and order as rows
 * @param {HTMLElement} listEl  owner of the observer; re-populating disconnects the previous one
 */
export function enrichPlayDetailRowsMaxComboFromAttributes(
  rows,
  scores,
  listEl,
) {
  listEl._oepMaxComboIo?.disconnect();

  /** @type {Map<Element, Object>} */
  const scoreByRow = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const rowEl = entry.target;
        const score = scoreByRow.get(rowEl);
        scoreByRow.delete(rowEl);
        if (!score) continue;
        const ruleset = rulesetFromId(score.ruleset_id);
        _fetchBeatmapAttributesCached(
          score.beatmap.id,
          difficultyMods(modAcronyms(score.mods), ruleset),
          ruleset,
          { persist: isPermanentBeatmap(score.beatmap) },
        ).then(({ maxCombo }) => {
          if (maxCombo != null && rowEl.isConnected) {
            _applyApiMaxComboToComboInline(rowEl, maxCombo);
          }
        });
      }
    },
    { rootMargin: "300px 0px" },
  );
  listEl._oepMaxComboIo = io;

  for (let i = 0; i < rows.length; i++) {
    const score = scores[i];
    if (beatmapMaxComboFromScore(score) != null) continue;
    if (score?.beatmap?.id == null) continue;
    scoreByRow.set(rows[i], score);
    io.observe(rows[i]);
  }
}

export function isInsideOepRecentFailsWrap(node) {
  return (
    node instanceof Element &&
    Boolean(node.closest(`.${RECENT_FAILS_WRAP_CLASS}`))
  );
}
