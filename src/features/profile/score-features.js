/**
 * Applies the score row features to every profile score list (WS-41).
 *
 * Every list goes through the same pipeline wherever it comes from (the
 * first pass, rows osu! adds later, a list that renders late, a setting
 * change): the synchronous decorations (`list-decorations.js`), then the
 * features that need the list's scores from the API ({@link LIST_DATA_FEATURES}).
 */

import { observe } from "../../core/observe.js";
import {
  settings,
  waitForElement,
  waitForStaleElementToLeave,
} from "../legacy.js";
import { MODDED_SR_ID } from "./beatmap-attributes.js";
import {
  decorateScoreList,
  decorationsStale,
  watchDecorationSettings,
} from "./list-decorations.js";
import { initSrObserver, revertModdedStarRatings } from "./modded-sr.js";
import {
  _scoreListComplete,
  beginScoreListVisit,
  fetchMostWatchedScores,
  fetchScores,
} from "./score-list-data.js";
import {
  MW_PP_CLASS,
  PLAY_DETAIL_LIST_PROCESSED_ATTR,
  PLAY_DETAIL_LIST_STALE_SEL,
  SCORE_HIT_STATISTICS_ID,
  SCORE_LIST_LAYOUT_CLASS,
  SCORE_LIST_PP_DECIMALS_CLASS,
  SCORE_PP_DECIMALS_ID,
  SCORE_SECTION_TYPES,
  _getSectionType,
  applyPpDecimals,
  revertPlaceNumbers,
  setScoreListLayoutClass,
  syncScoreListPpDecimalsWidthClass,
} from "./score-rows.js";
import {
  applyMostWatchedPp,
  fillStatsRows,
  revertMostWatchedPp,
  revertStatsRows,
} from "./score-stats.js";

/** @typedef {{ listEl: HTMLElement, type: string }} ScoreSection */

/** @param {HTMLElement} listEl */
const rowsOf = (listEl) => Array.from(listEl.querySelectorAll(".play-detail"));

/**
 * Features that need the list's scores. `fill` matches rows to scores by
 * beatmap and only changes rows that lack the feature, so it serves the first
 * pass and every later row change. `isStale`: osu! re-rendered rows without
 * it.
 * @type {{
 *   name: string,
 *   applies: (section: ScoreSection) => boolean,
 *   fill: (listEl: HTMLElement, scores: Object[]) => void,
 *   isStale?: (listEl: HTMLElement, mutations: MutationRecord[]) => boolean,
 * }[]}
 */
const LIST_DATA_FEATURES = [
  {
    // Shown whatever the hit statistics setting says.
    name: "most-watched-pp",
    applies: ({ type }) => type === "most_watched",
    fill: applyMostWatchedPp,
    isStale: (listEl, mutations) =>
      mutations.some((m) => m.type === "childList") &&
      rowsOf(listEl).some((r) => !r.querySelector(`.${MW_PP_CLASS}`)),
  },
  {
    name: "hit-statistics",
    applies: () => settings().isEnabled(SCORE_HIT_STATISTICS_ID),
    fill: (listEl, scores) => fillStatsRows(rowsOf(listEl), scores),
  },
];

/** @param {MutationRecord[]} mutations */
function mutationsAddRows(mutations) {
  return mutations.some((m) => {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(".play-detail") || node.querySelector(".play-detail"))
        return true;
    }
    return false;
  });
}

/**
 * Ownership / cancellation rules (B07):
 * - `run` belongs to the profile `init` call. Every observer, listener and DOM
 *   change made here registers its undo in `run.cleanupFns` as soon as it is
 *   made, so init's cleanup undoes it synchronously on navigation, even while
 *   this function is still awaiting.
 * - After every `await`, bail out if `run.isDisposed()`: the page may already
 *   belong to the next profile/mode.
 * - Shared styles (play-detail, place numbers) are owned by `init`; never
 *   remove them from here.
 * @param {string|number} userId
 * @param {string} mode
 * @param {{ isDisposed: () => boolean, cleanupFns: function[] }} run
 * @returns {Promise<void>}
 */
export async function initScoreFeatures(userId, mode, run) {
  const { isDisposed, cleanupFns } = run;
  beginScoreListVisit();

  await waitForStaleElementToLeave(PLAY_DETAIL_LIST_STALE_SEL);
  if (isDisposed()) return;

  await waitForElement(
    '[data-page-id="top_ranks"] .play-detail-list',
    15000,
  ).catch(() => {});
  if (isDisposed()) return;

  /** @type {ScoreSection[]} grows as late lists are adopted */
  const scoreSections = Array.from(
    document.querySelectorAll(".play-detail-list"),
  )
    .map((listEl) => ({ listEl, type: _getSectionType(listEl) }))
    .filter((s) => SCORE_SECTION_TYPES.includes(s.type));

  scoreSections.forEach(({ listEl }) =>
    listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1"),
  );

  setScoreListLayoutClass(
    scoreSections,
    settings().isEnabled(SCORE_HIT_STATISTICS_ID),
  );
  // Registered first so it runs first, as the old returned cleanup did.
  cleanupFns.push(() => setScoreListLayoutClass(scoreSections, false));
  cleanupFns.push(() =>
    scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl)),
  );
  cleanupFns.push(() =>
    scoreSections.forEach(({ listEl, type }) => {
      if (type === "most_watched") revertMostWatchedPp(listEl);
    }),
  );
  scoreSections.forEach(({ listEl }) =>
    syncScoreListPpDecimalsWidthClass(listEl),
  );

  scoreSections.forEach((section) =>
    decorateScoreList(section, { revertOff: true }),
  );

  // The module-level SR observer is torn down by init's cleanup (B38).
  if (settings().isEnabled(MODDED_SR_ID)) initSrObserver();

  /** @type {Map<string, Object[]>} section type -> scores loaded so far */
  const scoresMap = new Map();
  /** @type {WeakMap<ScoreSection, Promise<void>>} loads in flight */
  const loading = new WeakMap();

  /**
   * Fill the rows of `section` from the scores loaded so far, then put pp
   * decimals back on (Most Watched pp is a new pp span).
   * @param {ScoreSection} section
   */
  function fillSection(section) {
    const scores = scoresMap.get(section.type);
    if (!scores) return;
    for (const f of LIST_DATA_FEATURES) {
      if (f.applies(section)) f.fill(section.listEl, scores);
    }
    if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) {
      applyPpDecimals(section.listEl);
    }
  }

  /**
   * Run the data features of `section`: fill from what is loaded, and load
   * its scores first (or further pages, once "Show more" revealed more rows
   * than were fetched). The fetchers share cached and in-flight results.
   * @param {ScoreSection} section
   * @returns {Promise<void>}
   */
  function syncSectionData(section) {
    const { listEl, type } = section;
    if (!LIST_DATA_FEATURES.some((f) => f.applies(section))) {
      return Promise.resolve();
    }
    const scores = scoresMap.get(type);
    if (scores) fillSection(section);
    const pending = loading.get(section);
    if (pending) return pending;
    const rowCount = listEl.querySelectorAll(".play-detail").length;
    const needsMore =
      !scores ||
      (type !== "most_watched" &&
        rowCount > scores.length &&
        !_scoreListComplete(userId, mode, type));
    if (!needsMore) return Promise.resolve();

    const load = (
      type === "most_watched"
        ? fetchMostWatchedScores(userId, mode)
        : fetchScores(userId, mode, type, rowCount)
    )
      .then((loaded) => {
        if (isDisposed()) return;
        scoresMap.set(type, loaded);
        fillSection(section);
      })
      .finally(() => loading.delete(section));
    loading.set(section, load);
    return load;
  }

  await Promise.all(scoreSections.map(syncSectionData));
  if (isDisposed()) return;

  /** @param {ScoreSection} section */
  function mountScoreListObserver(section) {
    const { listEl } = section;

    const obs = new MutationObserver((mutations) => {
      const changed =
        mutationsAddRows(mutations) ||
        decorationsStale(mutations) ||
        LIST_DATA_FEATURES.some(
          (f) =>
            f.applies(section) &&
            scoresMap.has(section.type) &&
            f.isStale?.(listEl, mutations),
        );
      if (!changed) return;
      decorateScoreList(section);
      syncSectionData(section);
    });

    obs.observe(listEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    cleanupFns.push(() => obs.disconnect());

    const classObs = new MutationObserver(() => {
      if (
        settings().isEnabled(SCORE_HIT_STATISTICS_ID) &&
        !listEl.classList.contains(SCORE_LIST_LAYOUT_CLASS)
      ) {
        listEl.classList.add(SCORE_LIST_LAYOUT_CLASS);
        syncScoreListPpDecimalsWidthClass(listEl);
      }
    });
    classObs.observe(listEl, {
      attributes: true,
      attributeFilter: ["class"],
    });
    cleanupFns.push(() => classObs.disconnect());
  }

  scoreSections.forEach(mountScoreListObserver);

  /**
   * Run the pipeline on a .play-detail-list that appeared after the first
   * pass (e.g. Historical opened for the first time, or a score section osu!
   * rendered lazily).
   * @param {HTMLElement} listEl
   */
  function adoptLateSection(listEl) {
    const type = _getSectionType(listEl);
    if (!SCORE_SECTION_TYPES.includes(type)) return;
    // Mark immediately to prevent a second adoption while we're async.
    listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1");

    const section = { listEl, type };
    scoreSections.push(section);

    if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
      setScoreListLayoutClass([section], true);
    }
    syncScoreListPpDecimalsWidthClass(listEl);

    // Mount the per-list observer first so mutations that bring in the first
    // rows are always caught, even if the list is empty right now.
    mountScoreListObserver(section);

    if (listEl.querySelector(".play-detail") == null) return;
    decorateScoreList(section);
    syncSectionData(section);
  }

  // Lists that render after init (lazy sections). The per-list observers
  // above watch single lists and stay local.
  const lateSectionAc = new AbortController();
  observe.subscribe(
    {
      selector: ".play-detail-list",
      schedule: "sync",
      signal: lateSectionAc.signal,
      label: "profile/score-lists",
    },
    () => {
      document
        .querySelectorAll(
          `.play-detail-list:not([${PLAY_DETAIL_LIST_PROCESSED_ATTR}])`,
        )
        .forEach((listEl) => {
          if (!(listEl instanceof HTMLElement)) return;
          adoptLateSection(listEl);
        });
    },
  );
  cleanupFns.push(() => lateSectionAc.abort());

  cleanupFns.push(
    ...watchDecorationSettings(() => scoreSections),
    settings().onChange(SCORE_HIT_STATISTICS_ID, async (enabled) => {
      if (enabled) {
        setScoreListLayoutClass(scoreSections, true);
        scoreSections.forEach(({ listEl }) =>
          syncScoreListPpDecimalsWidthClass(listEl),
        );
        await Promise.all(scoreSections.map(syncSectionData));
      } else {
        scoreSections.forEach(({ listEl }) => revertStatsRows(listEl));
        setScoreListLayoutClass(scoreSections, false);
        scoreSections.forEach(({ listEl }) =>
          listEl.classList.remove(SCORE_LIST_PP_DECIMALS_CLASS),
        );
      }
    }),
    settings().onChange(MODDED_SR_ID, (enabled) => {
      if (enabled) initSrObserver();
      else revertModdedStarRatings();
    }),
  );
}
