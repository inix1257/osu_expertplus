/**
 * Applies the score row features to every profile score list (WS-41).
 */

import {
  formatDecimalPp,
  parseLocaleNumber,
  settings,
  waitForElement,
  waitForStaleElementToLeave,
} from "../legacy.js";
import { MODDED_SR_ID } from "./beatmap-attributes.js";
import {
  initSrObserver,
  processElements,
  revertModdedStarRatings,
} from "./modded-sr.js";
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
  SCORE_PLACE_NUMBER_ID,
  SCORE_PLACE_SECTION_TYPE,
  SCORE_PP_DECIMALS_ID,
  SCORE_SECTION_TYPES,
  SCORE_STATS_ATTR,
  _beatmapIdFromRow,
  _buildScoresByBeatmapId,
  _getSectionType,
  applyPlaceNumbers,
  applyPpDecimals,
  revertPlaceNumbers,
  revertPpDecimals,
  scorePlaceNumberStyle,
  setScoreListLayoutClass,
  syncScoreListPpDecimalsWidthClass,
} from "./score-rows.js";
import {
  applyHideWeightedPp,
  applyMostWatchedPp,
  injectMostWatchedPpRow,
  injectStatsRow,
  revertMostWatchedPp,
  revertStatsRows,
} from "./score-stats.js";
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
  scoreSections.forEach(({ listEl }) =>
    syncScoreListPpDecimalsWidthClass(listEl),
  );

  scoreSections.forEach(({ listEl, type }) => {
    if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
    applyHideWeightedPp(listEl);
    if (settings().isEnabled(SCORE_PLACE_NUMBER_ID)) {
      if (type === SCORE_PLACE_SECTION_TYPE) {
        applyPlaceNumbers(listEl);
      } else {
        revertPlaceNumbers(listEl);
      }
    } else {
      revertPlaceNumbers(listEl);
    }
  });
  if (
    settings().isEnabled(SCORE_PLACE_NUMBER_ID) &&
    scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)
  ) {
    scorePlaceNumberStyle.inject();
  }

  // The module-level SR observer is torn down by init's cleanup (B38).
  if (settings().isEnabled(MODDED_SR_ID)) initSrObserver();

  const scoresMap = new Map();

  async function _loadAndApplyStats(section) {
    const { listEl, type } = section;
    // Both fetchers share in-flight/cached results, so calling again is cheap;
    // fetchScores only loads further pages when more rows are rendered.
    const scores =
      type === "most_watched"
        ? await fetchMostWatchedScores(userId, mode)
        : await fetchScores(
            userId,
            mode,
            type,
            listEl.querySelectorAll(".play-detail").length,
          );
    if (isDisposed()) return;
    scoresMap.set(type, scores);
    processElements(
      Array.from(listEl.querySelectorAll(".play-detail")),
      scoresMap.get(type),
    );
  }

  // Inject PP for Most Watched Replays regardless of the hit statistics setting.
  const mostWatchedSections = scoreSections.filter(
    (s) => s.type === "most_watched",
  );
  cleanupFns.push(() =>
    mostWatchedSections.forEach(({ listEl }) => revertMostWatchedPp(listEl)),
  );
  if (mostWatchedSections.length > 0) {
    if (!scoresMap.has("most_watched")) {
      const mw = await fetchMostWatchedScores(userId, mode);
      if (isDisposed()) return;
      scoresMap.set("most_watched", mw);
    }
    const mwScores = scoresMap.get("most_watched");
    mostWatchedSections.forEach(({ listEl }) =>
      applyMostWatchedPp(listEl, mwScores),
    );
    if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) {
      mostWatchedSections.forEach(({ listEl }) => applyPpDecimals(listEl));
    }
  }

  if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
    await Promise.all(scoreSections.map(_loadAndApplyStats));
    if (isDisposed()) return;
    if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) {
      scoreSections.forEach(({ listEl }) => applyPpDecimals(listEl));
    }
  }

  /**
   * Inject stats into rows that do not have them (new rows, or rows osu! re-rendered).
   * @param {HTMLElement[]} allEls
   * @param {Object[]} scores
   */
  function injectMissingStats(allEls, scores) {
    const byBeatmap = _buildScoresByBeatmapId(scores);
    const usageCount = new Map();
    // First pass: count already-matched rows so duplicate-beatmapId
    // candidates are consumed in the correct order.
    allEls.forEach((rowEl) => {
      const already =
        rowEl.hasAttribute(SCORE_STATS_ATTR) &&
        rowEl.querySelector(".oep-score-stats");
      if (!already) return;
      const bmId = _beatmapIdFromRow(rowEl);
      if (bmId) usageCount.set(bmId, (usageCount.get(bmId) ?? 0) + 1);
    });
    // Second pass: inject only rows that are missing stats.
    allEls.forEach((rowEl) => {
      const needsReinjection =
        !rowEl.hasAttribute(SCORE_STATS_ATTR) ||
        !rowEl.querySelector(".oep-score-stats");
      if (!needsReinjection) return;
      rowEl.removeAttribute(SCORE_STATS_ATTR);
      const bmId = _beatmapIdFromRow(rowEl);
      if (!bmId) return;
      const candidates = byBeatmap.get(bmId);
      if (!candidates) return;
      const idx = usageCount.get(bmId) ?? 0;
      const score = candidates[idx];
      if (!score) return;
      usageCount.set(bmId, idx + 1);
      injectStatsRow(rowEl, score);
    });
  }

  function mountScoreListObserver(section) {
    const { listEl, type } = section;
    let statsFetchPending = false;

    const obs = new MutationObserver((mutations) => {
      const hasNewRows = mutations.some((m) => {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (
            node.matches(".play-detail") ||
            node.querySelector(".play-detail")
          )
            return true;
        }
        return false;
      });

      // Detect when the site re-renders (e.g. after async locale load) and
      // patches pp text nodes back to integer values via characterData mutations,
      // bypassing the childList check above.
      const hasPpDecimalOverwrite =
        !hasNewRows &&
        settings().isEnabled(SCORE_PP_DECIMALS_ID) &&
        mutations.some((m) => {
          if (m.type !== "characterData") return false;
          const span = m.target.parentElement;
          if (!(span instanceof HTMLSpanElement)) return false;
          const titleAttr = span.getAttribute("title");
          if (!titleAttr || !span.parentElement?.matches(".play-detail__pp"))
            return false;
          const n = parseLocaleNumber(titleAttr);
          if (!Number.isFinite(n)) return false;
          return m.target.nodeValue !== formatDecimalPp(n) + "\u200A";
        });

      // Detect re-rendered Most Watched Replays rows that lost their PP span.
      const hasMwPpMissing =
        !hasNewRows &&
        type === "most_watched" &&
        scoresMap.has(type) &&
        mutations.some((m) => m.type === "childList") &&
        Array.from(listEl.querySelectorAll(".play-detail")).some(
          (r) => !r.querySelector(`.${MW_PP_CLASS}`),
        );

      if (!hasNewRows && !hasPpDecimalOverwrite && !hasMwPpMissing) return;

      if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      applyHideWeightedPp(listEl);
      if (
        settings().isEnabled(SCORE_PLACE_NUMBER_ID) &&
        type === SCORE_PLACE_SECTION_TYPE
      ) {
        applyPlaceNumbers(listEl);
      }

      const allEls = Array.from(listEl.querySelectorAll(".play-detail"));
      if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
        if (!scoresMap.has(type) && !statsFetchPending) {
          // Rows appeared before the initial fetch completed (e.g. list was
          // adopted while empty). Fetch now, then re-apply.
          statsFetchPending = true;
          _loadAndApplyStats(section).then(() => {
            statsFetchPending = false;
            if (isDisposed()) return;
            if (settings().isEnabled(SCORE_PP_DECIMALS_ID))
              applyPpDecimals(listEl);
          });
        } else if (scoresMap.has(type)) {
          const scores = scoresMap.get(type);
          injectMissingStats(allEls, scores);
          if (
            type !== "most_watched" &&
            allEls.length > scores.length &&
            !statsFetchPending &&
            !_scoreListComplete(userId, mode, type)
          ) {
            // "Show more" revealed rows past the pages fetched so far.
            statsFetchPending = true;
            fetchScores(userId, mode, type, allEls.length).then((more) => {
              statsFetchPending = false;
              if (isDisposed()) return;
              scoresMap.set(type, more);
              injectMissingStats(
                Array.from(listEl.querySelectorAll(".play-detail")),
                more,
              );
              if (settings().isEnabled(SCORE_PP_DECIMALS_ID))
                applyPpDecimals(listEl);
            });
          }
        }
      }

      if (type === "most_watched" && scoresMap.has(type)) {
        const scores = scoresMap.get(type);
        const byBeatmap = _buildScoresByBeatmapId(scores);
        const usageCount = new Map();
        allEls.forEach((rowEl) => {
          if (rowEl.querySelector(`.${MW_PP_CLASS}`)) {
            const bmId = _beatmapIdFromRow(rowEl);
            if (bmId) usageCount.set(bmId, (usageCount.get(bmId) ?? 0) + 1);
            return;
          }
          const bmId = _beatmapIdFromRow(rowEl);
          if (!bmId) return;
          const candidates = byBeatmap.get(bmId);
          if (!candidates) return;
          const idx = usageCount.get(bmId) ?? 0;
          const score = candidates[idx];
          if (!score) return;
          usageCount.set(bmId, idx + 1);
          injectMostWatchedPpRow(rowEl, score);
        });
        if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      }
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
   * Apply all score features to a .play-detail-list that appeared after the
   * initial `initScoreFeatures` snapshot (e.g. Historical tab opened for the
   * first time, or a score section that was lazy-rendered by osu! later).
   * @param {HTMLElement} listEl
   */
  async function adoptLateSection(listEl) {
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

    const hasRows = listEl.querySelector(".play-detail") != null;

    if (hasRows) {
      if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      applyHideWeightedPp(listEl);
      if (
        settings().isEnabled(SCORE_PLACE_NUMBER_ID) &&
        type === SCORE_PLACE_SECTION_TYPE
      ) {
        applyPlaceNumbers(listEl);
        if (scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)) {
          scorePlaceNumberStyle.inject();
        }
      }

      if (type === "most_watched") {
        mostWatchedSections.push(section);
        if (!scoresMap.has("most_watched")) {
          const mw = await fetchMostWatchedScores(userId, mode);
          if (isDisposed()) return;
          scoresMap.set("most_watched", mw);
        }
        applyMostWatchedPp(listEl, scoresMap.get("most_watched"));
        if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      }

      if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
        await _loadAndApplyStats(section);
        if (isDisposed()) return;
        if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      }
    } else if (type === "most_watched") {
      mostWatchedSections.push(section);
    }
  }

  const lateSectionObs = new MutationObserver(() => {
    document
      .querySelectorAll(
        `.play-detail-list:not([${PLAY_DETAIL_LIST_PROCESSED_ATTR}])`,
      )
      .forEach((listEl) => {
        if (!(listEl instanceof HTMLElement)) return;
        adoptLateSection(listEl);
      });
  });
  lateSectionObs.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  cleanupFns.push(() => lateSectionObs.disconnect());

  cleanupFns.push(
    settings().onChange(SCORE_PP_DECIMALS_ID, (enabled) => {
      scoreSections.forEach(({ listEl }) => {
        syncScoreListPpDecimalsWidthClass(listEl);
        enabled ? applyPpDecimals(listEl) : revertPpDecimals(listEl);
      });
    }),
    settings().onChange(SCORE_HIT_STATISTICS_ID, async (enabled) => {
      if (enabled) {
        setScoreListLayoutClass(scoreSections, true);
        scoreSections.forEach(({ listEl }) =>
          syncScoreListPpDecimalsWidthClass(listEl),
        );
        await Promise.all(scoreSections.map(_loadAndApplyStats));
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
    settings().onChange(SCORE_PLACE_NUMBER_ID, (enabled) => {
      if (enabled) {
        if (scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)) {
          scorePlaceNumberStyle.inject();
        }
        scoreSections.forEach(({ listEl, type }) => {
          if (type === SCORE_PLACE_SECTION_TYPE) {
            applyPlaceNumbers(listEl);
          } else {
            revertPlaceNumbers(listEl);
          }
        });
      } else {
        scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl));
        scorePlaceNumberStyle.remove();
      }
    }),
  );
}
