/**
 * Expert+ Recent (including fails): shared helpers and section lookup (WS-41).
 */

import {
  _diffMods,
  _fetchBeatmapAttributesCached,
} from "../beatmap-attributes.js";
import {
  _applyApiMaxComboToComboInline,
  _beatmapMaxComboFromScore,
} from "../score-stats.js";
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
 * osu-web always renders Recent plays as the first play-detail-list inside
 * the historical section regardless of UI language. Matching by heading text
 * fails on non-English interfaces, so use position instead.
 */
export function findRecentPlaysListRoot() {
  const page = findHistoricalPage();
  if (!page) return null;
  const lists = Array.from(page.querySelectorAll(".play-detail-list")).filter(
    (el) => el instanceof HTMLElement,
  );
  return lists[0] ?? null;
}

/**
 * osu-web renders "Most Watched Replays" as the second play-detail-list in
 * historical. Language-independent positional lookup.
 */
export function findMostWatchedReplaysListRoot() {
  const page = findHistoricalPage();
  if (!page) return null;
  const lists = Array.from(page.querySelectorAll(".play-detail-list")).filter(
    (el) => el instanceof HTMLElement,
  );
  return lists[1] ?? null;
}

export function removeOfficialRecentPlaysSection(listRoot) {
  if (!(listRoot instanceof HTMLElement)) return;
  // Remove the h3 heading immediately before the list regardless of language.
  const prev = listRoot.previousElementSibling;
  if (
    prev instanceof HTMLElement &&
    prev.matches("h3.title.title--page-extra-small")
  ) {
    prev.remove();
  }
  listRoot.remove();
}

function rulesetIdToMode(rulesetId) {
  const map = { 0: "osu", 1: "taiko", 2: "fruits", 3: "mania" };
  return map[rulesetId] ?? "osu";
}

export function scoreRankForApiScore(score) {
  const r = score?.rank;
  if (typeof r === "string") return r;
  if (r && typeof r === "object" && typeof r.name === "string") return r.name;
  return score?.passed === false ? "F" : "D";
}

export function beatmapHrefFromScore(score) {
  const bm = score?.beatmap;
  if (!bm?.id) return "#";
  const setId = score.beatmapset?.id;
  const mode = rulesetIdToMode(score.ruleset_id);
  if (setId != null)
    return `https://osu.ppy.sh/beatmapsets/${setId}#${mode}/${bm.id}`;
  return `https://osu.ppy.sh/beatmaps/${bm.id}`;
}

export function formatAccuracyPercent(score) {
  let n = score?.accuracy != null ? Number(score.accuracy) : NaN;
  if (!Number.isFinite(n)) return "—";
  if (n <= 1) n *= 100;
  return `${n.toFixed(2)}%`;
}

/**
 * @param {unknown[]} modsList  API mod objects or strings
 * @returns {string[]}
 */
function modsAcronymsFromApiMods(modsList) {
  const out = [];
  for (const m of modsList || []) {
    const ac = typeof m === "string" ? m : m?.acronym;
    if (ac) out.push(String(ac));
  }
  return out;
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
        _fetchBeatmapAttributesCached(
          score.beatmap.id,
          _diffMods(modsAcronymsFromApiMods(score.mods)),
          rulesetIdToMode(score.ruleset_id),
          { ranked: score.beatmap.ranked },
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
    if (_beatmapMaxComboFromScore(score) != null) continue;
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
