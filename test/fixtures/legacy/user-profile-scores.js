/*
 * Frozen copy of the score features that lived in src/pages/user-profile.js
 * before WS-41 (lines 39-4894 of the IIFE, snapshot of d8444e0 + WS-40).
 * Read by test/osu/legacy.mjs (legacySource) so the src/osu comparison tests
 * keep comparing against the old behaviour. Not loaded by the userscript; do
 * not edit.
 */

  function mutationsIncludeSelector(mutations, selector) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        try {
          if (node.matches(selector)) return true;
          if (node.querySelector(selector)) return true;
        } catch (_) {
          // Invalid selectors in third-party markup must not break observers.
        }
      }
    }
    return false;
  }

  // Score lists: PP from span title → 2dp; hit-stat row from API (fetchScores)
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const SCORE_HIT_STATISTICS_ID = IDS.SCORE_HIT_STATISTICS;
  const SCORE_PERIOD_HIGHLIGHT_ID = IDS.SCORE_PERIOD_HIGHLIGHT;
  const RECENT_SCORES_SHOW_FAILS_ID = IDS.RECENT_SCORES_SHOW_FAILS;
  const PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID =
    IDS.PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE;
  const PP_DECIMALS_ATTR = "data-oep-pp-original";

  function applyPpDecimals(listEl) {
    listEl
      .querySelectorAll(".play-detail__pp > span[title]")
      .forEach((span) => {
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

  function revertPpDecimals(listEl) {
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

  const PLAY_DETAIL_STYLE_ID = "osu-expertplus-play-detail";

  /** On `.play-detail-list`: enables our desktop column widths; remove when feature off. */
  const SCORE_LIST_LAYOUT_CLASS = "oep-score-list-details-layout";
  /** Class on the injected PP span inside Most Watched Replays' watch-count column. */
  const MW_PP_CLASS = "oep-mw-pp";
  /** Wider PP column track when "PP decimals on scores" is on (layout list only). */
  const SCORE_LIST_PP_DECIMALS_CLASS = "oep-score-list-pp-decimals";
  const SCORE_LIST_LAYOUT_SEL = `.play-detail-list.${SCORE_LIST_LAYOUT_CLASS}`;

  /** Desktop `.play-detail` flex tracks (mods / pp / accuracy / combo+stats). */
  const PLAY_DETAIL_DESKTOP_TUNING = {
    modsColMaxWidth: "min(72vw, 40rem)",
    ppDesktopWidth: "max(102px, 10ch)",
    ppColWidth: "calc(max(102px, 10ch) + 2.45rem)",
    accuracyColWidth: "7.5ch",
    comboStatsColWidth: "13rem",
    midGap: "0.28em",
    srBadgeMinWidth: "4.5rem",
  };

  const PLAY_DETAIL_CSS = `
    .oep-hidden { display: none !important; }

    .play-detail__beatmap-and-time {
      align-items: center;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      text-align: left;
      box-sizing: border-box;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.35em;
      width: 100%;
      min-width: 0;
      flex: 1 1 0;
      box-sizing: border-box;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      text-align: right;
      min-width: 0;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail .play-detail__accuracy {
      font-weight: 700;
      font-size: 15px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col .play-detail__accuracy {
      flex-shrink: 0;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 3px;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col .oep-score-stats {
      margin-top: 0;
    }

    @media (min-width: 900px) {
      ${SCORE_LIST_LAYOUT_SEL} .play-detail {
        align-items: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--top {
        flex: 1 1 0% !important;
        min-width: 0;
        align-items: flex-start !important;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__detail {
        min-width: 0;
        align-items: flex-start;
        text-align: left;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--bottom {
        flex: 0 0 auto;
        flex-wrap: nowrap;
        align-items: stretch;
        align-self: stretch;
        box-sizing: border-box;
        --oep-mods-col-max: ${PLAY_DETAIL_DESKTOP_TUNING.modsColMaxWidth};
        --oep-accuracy-col: ${PLAY_DETAIL_DESKTOP_TUNING.accuracyColWidth};
        --oep-combo-stats-col: ${PLAY_DETAIL_DESKTOP_TUNING.comboStatsColWidth};
        --oep-mid-gap: ${PLAY_DETAIL_DESKTOP_TUNING.midGap};
        --oep-score-detail-pad-x: 20px;
        --oep-score-detail-gap: 10px;
        --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
      }

      ${SCORE_LIST_LAYOUT_SEL}.${SCORE_LIST_PP_DECIMALS_CLASS} .play-detail__group--bottom {
        --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppColWidth};
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__mods {
        flex: 0 0 auto;
        width: max-content;
        max-width: var(--oep-mods-col-max);
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        box-sizing: border-box;
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail {
        flex: 0 0
          calc(
            var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
              var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
          );
        width: calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        min-width: 0;
        overflow: hidden;
        box-sizing: border-box;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
        flex: 1 1 0;
        margin-left: 10px;
        width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        min-width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        overflow: hidden;
        align-self: stretch;
      }

      ${SCORE_LIST_LAYOUT_SEL} .play-detail__pp {
        --desktop-width: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
        flex: 0 0 var(--oep-pp-track);
        width: var(--oep-pp-track);
        min-width: var(--oep-pp-track);
        max-width: var(--oep-pp-track);
        box-sizing: border-box;
        font-variant-numeric: tabular-nums;
      }

      ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
        flex-direction: row;
        align-items: center;
        gap: var(--oep-mid-gap);
        width: calc(
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
        max-width: 100%;
        overflow: visible;
      }
      ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
        flex: 0 0 var(--oep-accuracy-col);
        width: var(--oep-accuracy-col);
        max-width: var(--oep-accuracy-col);
        min-width: var(--oep-accuracy-col);
        font-variant-numeric: tabular-nums;
        overflow: visible;
      }
      ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
        flex: 0 0 var(--oep-combo-stats-col);
        width: var(--oep-combo-stats-col);
        max-width: var(--oep-combo-stats-col);
        overflow: hidden;
      }
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__accuracy-and-weighted-pp {
      display: flex;
      flex-flow: row wrap;
      align-items: baseline;
      gap: 0 0.5em;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      justify-content: flex-start;
      box-sizing: border-box;
    }
    .play-detail-list .play-detail__accuracy-and-weighted-pp {
      display: flex;
      flex-flow: row wrap;
      align-items: baseline;
      gap: 0 0.5em;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      justify-content: flex-start;
      box-sizing: border-box;
    }

    .play-detail-list .oep-mid-cols {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.28em;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      overflow: visible;
      box-sizing: border-box;
    }
    .play-detail-list .oep-accuracy-col {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      text-align: right;
      min-width: 0;
      overflow: visible;
      font-variant-numeric: tabular-nums;
    }
    .play-detail-list .oep-accuracy-col .play-detail__accuracy {
      flex-shrink: 0;
    }
    .play-detail-list .play-detail__score-detail .play-detail__accuracy {
      font-weight: 700;
      font-size: 15px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline {
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.12em;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.92;
      font-variant-numeric: tabular-nums;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num {
      font-weight: 500;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num--full {
      color: #9beb5b;
      font-weight: 800;
    }

    .play-detail-list .oep-combo-inline {
      font-weight: 700;
      font-size: 15px;
      white-space: nowrap;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.12em;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.92;
      font-variant-numeric: tabular-nums;
    }
    .play-detail-list .oep-combo-inline__num {
      font-weight: 500;
    }
    .play-detail-list .oep-combo-inline__num--full {
      color: #9beb5b;
      font-weight: 800;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 3px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-top: 3px;
      line-height: 1;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__sep {
      opacity: 0.35;
      margin: 0 1px;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--300     { color: #78dcff; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--100     { color: #84e03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--50      { color: #e0b03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--miss    { color: #e05c5c; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--perfect { color: #ffd700; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--good    { color: #6ee0c0; }
    .play-detail-list .oep-score-stats {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 3px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      text-align: right;
      box-sizing: border-box;
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-top: 3px;
      line-height: 1;
    }
    .play-detail-list .oep-score-stats__sep {
      opacity: 0.35;
      margin: 0 1px;
    }
    .play-detail-list .oep-score-stats__val--300     { color: #78dcff; }
    .play-detail-list .oep-score-stats__val--100     { color: #84e03a; }
    .play-detail-list .oep-score-stats__val--50      { color: #e0b03a; }
    .play-detail-list .oep-score-stats__val--miss    { color: #e05c5c; }
    .play-detail-list .oep-score-stats__val--perfect { color: #ffd700; }
    .play-detail-list .oep-score-stats__val--good    { color: #6ee0c0; }

    .oep-sr-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: max(11px, 0.82em);
      padding: 0.22em 0.55em;
      min-width: ${PLAY_DETAIL_DESKTOP_TUNING.srBadgeMinWidth};
      min-height: 1.35em;
      border-radius: 10000px;
      margin: 0 -0.55rem 0 0;
      flex-shrink: 0;
      vertical-align: middle;
      line-height: 1;
      border: none;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }
    .oep-sr-badge__inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: nowrap;
      column-gap: 0.1em;
      flex: 0 0 auto;
      min-width: 0;
      line-height: 1;
    }
    .oep-sr-badge__val {
      flex: 0 0 auto;
      width: auto;
      max-width: none;
      text-align: left;
      font-variant-numeric: tabular-nums;
    }
    .oep-sr-badge__inner .oep-sr-badge__icon {
      font-size: 0.65em;
      line-height: 1;
      color: inherit;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
    }

    .play-detail__pp--watch-count {
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end;
      gap: 2px;
    }
    .${MW_PP_CLASS} {
      font-variant-numeric: tabular-nums;
    }

    .oep-recent-fails-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .oep-recent-fails-header .title {
      margin: 0;
      padding: 0;
      line-height: 1.2;
    }
    .oep-recent-fails-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5em;
      margin: 0;
      padding: 0;
      font-size: 0.8125rem;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.02em;
      color: hsl(var(--hsl-c1));
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .oep-recent-fails-toggle .oep-recent-show-fails {
      margin: 0;
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      border-radius: 3px;
      cursor: pointer;
      accent-color: hsl(var(--hsl-b6));
    }
    .oep-recent-fails-toggle .oep-recent-show-fails:focus-visible {
      outline: 2px solid hsl(var(--hsl-b6));
      outline-offset: 2px;
    }
    .oep-clear-sr-cache-btn {
      appearance: none;
      background: none;
      border: 1px solid hsl(var(--hsl-b5));
      border-radius: 3px;
      color: hsl(var(--hsl-c1));
      cursor: pointer;
      font-size: 0.75rem;
      font-family: inherit;
      font-weight: 500;
      letter-spacing: 0.02em;
      line-height: 1;
      padding: 3px 7px;
      transition: border-color 0.1s, color 0.1s;
      white-space: nowrap;
    }
    .oep-clear-sr-cache-btn:hover {
      border-color: hsl(var(--hsl-c1));
      color: hsl(var(--hsl-l1));
    }
    .oep-clear-sr-cache-btn:active {
      opacity: 0.7;
    }

    .oep-recent-score-card-link {
      cursor: pointer;
    }

    .oep-score-options-wrap {
      position: relative;
      display: inline-flex;
    }
    .oep-score-options-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      appearance: none;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      padding: 4px 8px;
      font-size: 13px;
      line-height: 1;
      border-radius: 4px;
      transition: color 100ms ease, background-color 100ms ease;
    }
    .oep-score-options-btn:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.1);
    }
    .oep-score-options-menu {
      position: fixed;
      z-index: 9999;
      background: #2a2a3a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      min-width: 130px;
      padding: 4px 0;
      display: none;
    }
    .oep-score-options-menu[data-open] {
      display: block;
    }
    .oep-score-options-item {
      display: block;
      box-sizing: border-box;
      width: 100%;
      appearance: none;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.87);
      font: inherit;
      font-size: 13px;
      text-align: left;
      padding: 8px 14px;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 80ms ease;
    }
    .oep-score-options-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .oep-score-options-item--pending {
      opacity: 0.55;
      cursor: wait;
      pointer-events: none;
    }
    .oep-score-options-item--done {
      color: rgba(160, 255, 160, 0.9);
    }
    .oep-score-options-item--error {
      color: rgba(255, 180, 100, 0.9);
    }
  `;
  const playDetailStyle = manageStyle(PLAY_DETAIL_STYLE_ID, PLAY_DETAIL_CSS);

  const SCORE_STATS_ATTR = "data-oep-stats";

  /**
   * Extract the beatmap ID from a play-detail row's title link.
   * Returns null when the link is absent or not yet rendered.
   * @param {HTMLElement} rowEl
   * @returns {string|null}
   */
  function _beatmapIdFromRow(rowEl) {
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
  function _buildScoresByBeatmapId(scores) {
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
  function _applyByBeatmapId(elements, byBeatmap, usageCount, fn) {
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
   * Profile score lists are cached across SPA navigations (mode switches, back/forward)
   * for a short time so revisiting a profile does not refetch everything. The viewer's
   * own profile is never served from the cache (new plays would show stale stats); only
   * concurrent requests are shared there.
   */
  const PROFILE_SCORES_CACHE_TTL_MS = 2 * 60 * 1000;
  const SCORE_LIST_PAGE_SIZE = 100;
  const SCORE_LIST_MAX_TOTAL = 1000;

  function _profileScoresCacheTtl(userId) {
    return String(userId) === String(getCurrentUserIdFromHeader())
      ? 0
      : PROFILE_SCORES_CACHE_TTL_MS;
  }

  /**
   * @typedef {{ scores: object[], done: boolean, ts: number, lastPageKey: string, pending: Promise<boolean>|null }} ScoreListEntry
   * @type {Map<string, ScoreListEntry>}
   */
  const _scoreListCache = new Map();

  /** @returns {ScoreListEntry} */
  function _scoreListEntry(userId, mode, type) {
    const key = `${userId}:${mode}:${type}`;
    let entry = _scoreListCache.get(key);
    const ttl = _profileScoresCacheTtl(userId);
    if (!entry || (!entry.pending && Date.now() - entry.ts >= ttl)) {
      entry = {
        scores: [],
        done: false,
        ts: Date.now(),
        lastPageKey: "",
        pending: null,
      };
      _scoreListCache.set(key, entry);
    }
    return entry;
  }

  /**
   * Fetch the next page of a score list into `entry`.
   * @param {ScoreListEntry} entry
   * @returns {Promise<boolean>}  true when new scores were appended
   */
  async function _fetchScoreListPage(userId, mode, type, entry) {
    const offset = entry.scores.length;
    const url = `/users/${userId}/scores/${type}?mode=${mode}&limit=${SCORE_LIST_PAGE_SIZE}&offset=${offset}&include=beatmap`;
    let items;
    try {
      const resp = await OsuExpertPlus.api.siteFetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return false;
      const body = await resp.json();
      items = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
          ? body.items
          : [];
    } catch {
      return false;
    }

    if (items.length < SCORE_LIST_PAGE_SIZE) entry.done = true;
    if (!items.length) return false;

    const pageKey = items
      .map((it) =>
        it?.id != null
          ? String(it.id)
          : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`,
      )
      .join("|");
    if (pageKey && pageKey === entry.lastPageKey) {
      entry.done = true;
      return false;
    }
    entry.lastPageKey = pageKey;

    entry.scores.push(...items);
    if (entry.scores.length >= SCORE_LIST_MAX_TOTAL) entry.done = true;
    return true;
  }

  /**
   * GET /users/{id}/scores/{type}, same order as DOM. Only fetches as many pages as
   * needed to cover the `needed` rows currently rendered; later calls with a larger
   * `needed` (after "Show more") continue from where the cache left off.
   * @param {string|number} userId
   * @param {string} mode
   * @param {string} type
   * @param {number} needed
   * @returns {Promise<object[]>}  Live array (grows as more pages load).
   */
  async function fetchScores(userId, mode, type, needed) {
    const entry = _scoreListEntry(userId, mode, type);
    const target = Math.min(Math.max(needed, 1), SCORE_LIST_MAX_TOTAL);
    while (!entry.done && entry.scores.length < target) {
      if (!entry.pending) {
        entry.pending = _fetchScoreListPage(userId, mode, type, entry).finally(
          () => {
            entry.pending = null;
          },
        );
      }
      if (!(await entry.pending)) break;
    }
    return entry.scores;
  }

  /** @returns {boolean}  Whether every row of the list has been fetched. */
  function _scoreListComplete(userId, mode, type) {
    return _scoreListCache.get(`${userId}:${mode}:${type}`)?.done === true;
  }

  /**
   * Share one in-flight / recently resolved promise per key.
   * @template T
   * @param {Map<string, { ts: number, pending: boolean, promise: Promise<T> }>} cache
   * @param {string} key
   * @param {number} ttlMs
   * @param {() => Promise<T>} factory
   * @returns {Promise<T>}
   */
  function _sharedPromise(cache, key, ttlMs, factory) {
    const hit = cache.get(key);
    if (hit && (hit.pending || Date.now() - hit.ts < ttlMs)) return hit.promise;
    const entry = { ts: Date.now(), pending: true, promise: null };
    entry.promise = factory().then(
      (value) => {
        entry.pending = false;
        entry.ts = Date.now();
        return value;
      },
      (err) => {
        if (cache.get(key) === entry) cache.delete(key);
        throw err;
      },
    );
    cache.set(key, entry);
    return entry.promise;
  }

  const _mostWatchedCache = new Map();

  /**
   * Fetches "Most Watched Replays" scores from the historical extra-pages endpoint.
   * Returns an ordered array of score objects ready for processElements().
   */
  function fetchMostWatchedScores(userId, mode) {
    return _sharedPromise(
      _mostWatchedCache,
      `${userId}:${mode}`,
      _profileScoresCacheTtl(userId),
      async () => {
        const url = `/users/${userId}/extra-pages/historical?mode=${mode}`;
        // Throwing (instead of returning []) drops the cache entry so a later call retries.
        const resp = await OsuExpertPlus.api.siteFetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) throw new Error(`historical ${resp.status}`);
        const body = await resp.json();
        const items = body?.score_replay_stats?.items;
        if (!Array.isArray(items)) return [];
        return items.map((item) => item?.score).filter(Boolean);
      },
    ).catch(() => []);
  }

  /**
   * Identify what type of score section a .play-detail-list belongs to.
   * Uses language-independent structural/positional signals; falls back to
   * heading text for English.
   * @returns {'pinned'|'best'|'firsts'|'most_watched'|null}
   */
  function _getSectionType(listEl) {
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

  /**
   * @param {Object} score
   * @returns {number|null}
   */
  function _beatmapMaxComboFromScore(score) {
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
  function _applyApiMaxComboToComboInline(rowEl, maxCombo) {
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
      Number.isFinite(maxN) &&
      maxN > 0 &&
      Number.isFinite(achN) &&
      achN === maxN;
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
      Number.isFinite(maxN) &&
      maxN > 0 &&
      Number.isFinite(achN) &&
      achN === maxN;

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
  function injectStatsRow(rowEl, score) {
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
  function revertStatsRows(listEl) {
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
  function injectMostWatchedPpRow(rowEl, score) {
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

  function applyMostWatchedPp(listEl, scores) {
    const byBeatmap = _buildScoresByBeatmapId(scores);
    const usageCount = new Map();
    _applyByBeatmapId(
      Array.from(listEl.querySelectorAll(".play-detail")),
      byBeatmap,
      usageCount,
      injectMostWatchedPpRow,
    );
  }

  function revertMostWatchedPp(listEl) {
    listEl.querySelectorAll(`.${MW_PP_CLASS}`).forEach((span) => span.remove());
  }

  function applyHideWeightedPp(listEl) {
    listEl.querySelectorAll(".play-detail").forEach((rowEl) => {
      rowEl
        .querySelector(".play-detail__weighted-pp")
        ?.classList.add("oep-hidden");
      rowEl
        .querySelector(".play-detail__pp-weight")
        ?.classList.add("oep-hidden");
    });
  }

  // Modded SR: IO + POST /beatmaps/{id}/attributes; row data from title href + mod icons
  const MODDED_SR_ID = IDS.MODDED_STAR_RATING;
  const MODDED_SR_ATTR = "data-oep-sr"; // '' pending, 1 done

  const DIFFICULTY_MODS = new Set([
    "DT",
    "NC",
    "HT",
    "DC",
    "HR",
    "EZ",
    "FL",
    "DA",
    "AC",
    "WU",
    "WD",
    "DF",
    "TC",
  ]);

  /** @type {Map<string, { sr: number|null, maxCombo: number|null }>} */
  const _attrsSessionCache = new Map();

  const BEATMAP_ATTRS_CACHE_GM_KEY = "oep.beatmapAttributesCache.v1";
  const BEATMAP_ATTRS_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const BEATMAP_ATTRS_CACHE_MAX_ENTRIES = 600;

  /**
   * Bump this string whenever a SR rework ships.  Any install that has a
   * different value stored will have its entire persistent SR cache wiped on
   * the next page load.  The version should be the rework date (YYYY-MM-DD).
   */
  const SR_CACHE_VERSION = "2026-07-23";
  const SR_CACHE_VERSION_GM_KEY = "oep.srCacheVersion";

  (function _initSrCacheVersion() {
    try {
      const stored = GM_getValue(SR_CACHE_VERSION_GM_KEY, "");
      if (stored === SR_CACHE_VERSION) return;
      GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, "{}");
      GM_setValue(SR_CACHE_VERSION_GM_KEY, SR_CACHE_VERSION);
    } catch (_) {}
  })();

  const RANKED_STATUS_RANKED = 1;
  const RANKED_STATUS_LOVED = 4;

  function _isCacheableRankedStatus(ranked) {
    return (
      ranked === undefined ||
      ranked === RANKED_STATUS_RANKED ||
      ranked === RANKED_STATUS_LOVED
    );
  }

  /** @type {Map<string|number, Promise<number|null>>} */
  const _beatmapMaxComboInFlight = new Map();

  /**
   * Fetch max_combo for a beatmap via GET /api/v2/beatmaps/{id} when the
   * attributes endpoint returns 0. Results are not cached persistently since
   * this is only called as a fallback for a known API bug.
   */
  function _fetchBeatmapMaxCombo(beatmapId) {
    if (_beatmapMaxComboInFlight.has(beatmapId)) {
      return _beatmapMaxComboInFlight.get(beatmapId);
    }
    const p = OsuExpertPlus.api
      .getBeatmap(beatmapId, { priority: "low" })
      .then((data) => {
        const mc = data?.max_combo;
        return mc != null && Number.isFinite(Number(mc)) && Number(mc) > 0
          ? Number(mc)
          : null;
      })
      .catch(() => null)
      .finally(() => _beatmapMaxComboInFlight.delete(beatmapId));
    _beatmapMaxComboInFlight.set(beatmapId, p);
    return p;
  }

  function _readBeatmapAttrsGmStore() {
    try {
      const raw = GM_getValue(BEATMAP_ATTRS_CACHE_GM_KEY, "");
      if (raw == null || raw === "") return {};
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      return o && typeof o === "object" ? o : {};
    } catch (_) {
      return {};
    }
  }

  function _writeBeatmapAttrsGmStore(store) {
    try {
      GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function _pruneBeatmapAttrsGmStore(store, now) {
    for (const k of Object.keys(store)) {
      const ent = store[k];
      const t = Number(ent?.t);
      if (!Number.isFinite(t) || now - t > BEATMAP_ATTRS_CACHE_TTL_MS) {
        delete store[k];
      } else if (ent.maxCombo === 0) {
        delete store[k];
      }
    }
    const keys = Object.keys(store);
    if (keys.length <= BEATMAP_ATTRS_CACHE_MAX_ENTRIES) return;
    keys.sort(
      (a, b) => (Number(store[a]?.t) || 0) - (Number(store[b]?.t) || 0),
    );
    for (let i = 0; i < keys.length - BEATMAP_ATTRS_CACHE_MAX_ENTRIES; i++) {
      delete store[keys[i]];
    }
  }

  /**
   * @param {string} key
   * @returns {{ sr: number|null, maxCombo: number|null }|undefined}
   */
  function _beatmapAttrsPersistentGet(key) {
    const store = _readBeatmapAttrsGmStore();
    const ent = store[key];
    const t = Number(ent?.t);
    if (
      !ent ||
      typeof ent !== "object" ||
      !Number.isFinite(t) ||
      Date.now() - t > BEATMAP_ATTRS_CACHE_TTL_MS
    ) {
      if (key in store) {
        delete store[key];
        _writeBeatmapAttrsGmStore(store);
      }
      return undefined;
    }
    const maxCombo =
      ent.maxCombo != null && Number.isFinite(Number(ent.maxCombo))
        ? Number(ent.maxCombo)
        : null;
    if (maxCombo === 0) {
      delete store[key];
      _writeBeatmapAttrsGmStore(store);
      return undefined;
    }
    return {
      sr:
        ent.sr != null && Number.isFinite(Number(ent.sr))
          ? Number(ent.sr)
          : null,
      maxCombo,
    };
  }

  /**
   * @param {string} key
   * @param {{ sr: number|null, maxCombo: number|null }} packed
   */
  function _beatmapAttrsPersistentSet(key, packed) {
    const store = _readBeatmapAttrsGmStore();
    const now = Date.now();
    _pruneBeatmapAttrsGmStore(store, now);
    store[key] = {
      t: now,
      sr: packed.sr,
      maxCombo: packed.maxCombo,
    };
    _writeBeatmapAttrsGmStore(store);
  }

  function _getCachedAttrs(key) {
    return _attrsSessionCache.get(key);
  }

  function _diffMods(acronyms) {
    return acronyms
      .map((a) => a.toUpperCase())
      .filter((a) => DIFFICULTY_MODS.has(a))
      .sort();
  }

  function _srCacheKey(beatmapId, diffMods, ruleset) {
    return `${beatmapId}:${ruleset}:${diffMods.join("+") || "NM"}`;
  }

  function _extractRowData(rowEl) {
    const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
    const m = href.match(/#(\w+)\/(\d+)/);
    return {
      beatmapId: m?.[2] ?? null,
      ruleset: m?.[1] ?? "osu",
      mods: Array.from(rowEl.querySelectorAll(".mod__icon[data-acronym]")).map(
        (e) => e.dataset.acronym,
      ),
    };
  }

  /** @type {Map<string, Promise<{ sr: number|null, maxCombo: number|null }>>} */
  const _attrsInFlight = new Map();

  /**
   * @param {string|number} beatmapId
   * @param {string[]} diffMods
   * @param {string} ruleset
   * @param {{ ranked?: number }} [opts]
   * @returns {Promise<{ key: string, sr: number|null, maxCombo: number|null }>}
   */
  async function _fetchBeatmapAttributesCached(
    beatmapId,
    diffMods,
    ruleset,
    opts,
  ) {
    const key = _srCacheKey(beatmapId, diffMods, ruleset);
    const hit = _getCachedAttrs(key);
    if (hit !== undefined) return { key, ...hit };

    const persisted = _beatmapAttrsPersistentGet(key);
    if (persisted !== undefined) {
      _attrsSessionCache.set(key, persisted);
      return { key, ...persisted };
    }

    const ranked = opts?.ranked;

    if (!_attrsInFlight.has(key)) {
      const p = OsuExpertPlus.api
        .postBeatmapAttributes(beatmapId, diffMods, ruleset)
        .then(async (data) => {
          const attrs = data?.attributes ?? {};
          const sr =
            attrs.star_rating != null &&
            Number.isFinite(Number(attrs.star_rating))
              ? Number(attrs.star_rating)
              : null;
          let maxCombo =
            attrs.max_combo != null && Number.isFinite(Number(attrs.max_combo))
              ? Number(attrs.max_combo)
              : null;

          if (maxCombo === 0) {
            const fallback = await _fetchBeatmapMaxCombo(beatmapId);
            maxCombo = fallback != null ? fallback : null;
          }

          const packed = { sr, maxCombo };
          _attrsSessionCache.set(key, packed);
          if (_isCacheableRankedStatus(ranked)) {
            _beatmapAttrsPersistentSet(key, packed);
          }
          return packed;
        })
        .catch(() => ({ sr: null, maxCombo: null }))
        .finally(() => _attrsInFlight.delete(key));
      _attrsInFlight.set(key, p);
    }

    const packed = await _attrsInFlight.get(key);
    return { key, ...packed };
  }

  async function _fetchAndApplySr(rowEl) {
    if (rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "");

    const { beatmapId, ruleset, mods } = _extractRowData(rowEl);
    if (!beatmapId) return;

    const diffMods = _diffMods(mods);
    const { sr, maxCombo } = await _fetchBeatmapAttributesCached(
      beatmapId,
      diffMods,
      ruleset,
    );

    if (!rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "1");

    if (maxCombo != null) _applyApiMaxComboToComboInline(rowEl, maxCombo);

    if (sr === null || sr === undefined) return;

    const beatmapSpan = rowEl.querySelector(".play-detail__beatmap");
    if (!beatmapSpan || rowEl.querySelector(".oep-sr-badge")) return;

    const parent = beatmapSpan.parentNode;
    if (!parent) return;

    const badge = el(
      "span",
      { class: "oep-sr-badge" },
      el(
        "span",
        { class: "oep-sr-badge__inner" },
        el("i", {
          class: "fas fa-star oep-sr-badge__icon",
          "aria-hidden": "true",
        }),
        el("span", { class: "oep-sr-badge__val" }, sr.toFixed(2)),
      ),
    );
    badge.style.backgroundColor =
      OsuExpertPlus.difficultyColours.getDiffColour(sr);
    badge.style.color = OsuExpertPlus.difficultyColours.getDiffTextColour(sr);
    parent.insertBefore(badge, beatmapSpan);
  }

  let _srObserver = null;
  let _srDomObserver = null;

  function _observeRow(rowEl) {
    if (!_srObserver || rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    _srObserver.observe(rowEl);
  }

  function initSrObserver() {
    teardownSrObserver();
    _srObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          _srObserver.unobserve(entry.target);
          _fetchAndApplySr(entry.target);
        }
      },
      { rootMargin: "300px 0px" },
    );

    document.querySelectorAll(".play-detail").forEach(_observeRow);

    _srDomObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(".play-detail")) {
            _observeRow(node);
          } else {
            if (!node.querySelector(".play-detail")) continue;
            node.querySelectorAll(".play-detail").forEach(_observeRow);
          }
        }
      }
    });
    _srDomObserver.observe(document.body, { childList: true, subtree: true });
  }

  function teardownSrObserver() {
    _srObserver?.disconnect();
    _srObserver = null;
    _srDomObserver?.disconnect();
    _srDomObserver = null;
  }

  function revertModdedStarRatings() {
    teardownSrObserver();
    document
      .querySelectorAll(`.play-detail[${MODDED_SR_ATTR}]`)
      .forEach((rowEl) => {
        rowEl.removeAttribute(MODDED_SR_ATTR);
        rowEl.querySelector(".oep-sr-badge")?.remove();
      });
  }

  function processElements(elements, scores) {
    const byBeatmap = _buildScoresByBeatmapId(scores);
    const usageCount = new Map();
    _applyByBeatmapId(elements, byBeatmap, usageCount, injectStatsRow);
  }

  const SCORE_PLACE_NUMBER_ID = IDS.SCORE_CARD_PLACE_NUMBER;
  const SCORE_PLACE_CLASS = "oep-score-place";
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
  const scorePlaceNumberStyle = manageStyle(
    SCORE_PLACE_NUMBER_STYLE_ID,
    SCORE_PLACE_NUMBER_CSS,
  );

  function applyPlaceNumbers(listEl) {
    const rows = Array.from(listEl.querySelectorAll(".play-detail"));
    rows.forEach((rowEl, i) => {
      const detail = rowEl.querySelector(".play-detail__detail");
      if (!(detail instanceof HTMLElement)) return;

      const titleRow = detail.querySelector(
        `:scope > .${SCORE_TITLE_ROW_CLASS}`,
      );
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

      rowEl
        .querySelectorAll(`.${SCORE_PLACE_CLASS}`)
        .forEach((n) => n.remove());
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

  function revertPlaceNumbers(listEl) {
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

  const SCORE_SECTION_TYPES = ["pinned", "best", "firsts", "most_watched"];
  const SCORE_PLACE_SECTION_TYPE = "best";

  function setScoreListLayoutClass(sections, enabled) {
    sections.forEach(({ listEl }) => {
      listEl.classList.toggle(SCORE_LIST_LAYOUT_CLASS, enabled);
    });
  }

  function syncScoreListPpDecimalsWidthClass(listEl) {
    listEl.classList.toggle(
      SCORE_LIST_PP_DECIMALS_CLASS,
      settings.isEnabled(SCORE_PP_DECIMALS_ID),
    );
  }

  // Mark lists we enhance so stale-element waits target our DOM until Inertia replaces it.
  const PLAY_DETAIL_LIST_PROCESSED_ATTR = "data-oep-processed";
  const PLAY_DETAIL_LIST_STALE_SEL = `.play-detail-list[${PLAY_DETAIL_LIST_PROCESSED_ATTR}]`;

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
  async function initScoreFeatures(userId, mode, run) {
    const { isDisposed, cleanupFns } = run;

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
      settings.isEnabled(SCORE_HIT_STATISTICS_ID),
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
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
      applyHideWeightedPp(listEl);
      if (settings.isEnabled(SCORE_PLACE_NUMBER_ID)) {
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
      settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
      scoreSections.some((s) => s.type === SCORE_PLACE_SECTION_TYPE)
    ) {
      scorePlaceNumberStyle.inject();
    }

    // The module-level SR observer is torn down by init's cleanup (B38).
    if (settings.isEnabled(MODDED_SR_ID)) initSrObserver();

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
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
        mostWatchedSections.forEach(({ listEl }) => applyPpDecimals(listEl));
      }
    }

    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      await Promise.all(scoreSections.map(_loadAndApplyStats));
      if (isDisposed()) return;
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
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
          settings.isEnabled(SCORE_PP_DECIMALS_ID) &&
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

        if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
        applyHideWeightedPp(listEl);
        if (
          settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
          type === SCORE_PLACE_SECTION_TYPE
        ) {
          applyPlaceNumbers(listEl);
        }

        const allEls = Array.from(listEl.querySelectorAll(".play-detail"));
        if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
          if (!scoresMap.has(type) && !statsFetchPending) {
            // Rows appeared before the initial fetch completed (e.g. list was
            // adopted while empty). Fetch now, then re-apply.
            statsFetchPending = true;
            _loadAndApplyStats(section).then(() => {
              statsFetchPending = false;
              if (isDisposed()) return;
              if (settings.isEnabled(SCORE_PP_DECIMALS_ID))
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
                if (settings.isEnabled(SCORE_PP_DECIMALS_ID))
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
          if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
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
          settings.isEnabled(SCORE_HIT_STATISTICS_ID) &&
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

      if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
        setScoreListLayoutClass([section], true);
      }
      syncScoreListPpDecimalsWidthClass(listEl);

      // Mount the per-list observer first so mutations that bring in the first
      // rows are always caught, even if the list is empty right now.
      mountScoreListObserver(section);

      const hasRows = listEl.querySelector(".play-detail") != null;

      if (hasRows) {
        if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
        applyHideWeightedPp(listEl);
        if (
          settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
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
          if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
        }

        if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
          await _loadAndApplyStats(section);
          if (isDisposed()) return;
          if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
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
      settings.onChange(SCORE_PP_DECIMALS_ID, (enabled) => {
        scoreSections.forEach(({ listEl }) => {
          syncScoreListPpDecimalsWidthClass(listEl);
          enabled ? applyPpDecimals(listEl) : revertPpDecimals(listEl);
        });
      }),
      settings.onChange(SCORE_HIT_STATISTICS_ID, async (enabled) => {
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
      settings.onChange(MODDED_SR_ID, (enabled) => {
        if (enabled) initSrObserver();
        else revertModdedStarRatings();
      }),
      settings.onChange(SCORE_PLACE_NUMBER_ID, (enabled) => {
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

  function getUserIdFromUrl() {
    const m = location.pathname.match(/^\/users\/(\d+)/);
    return m ? m[1] : null;
  }

  /** @returns {Object|null} */
  function parseProfileInitialData() {
    try {
      const nodes = document.querySelectorAll(".js-react[data-initial-data]");
      for (const node of nodes) {
        const data = JSON.parse(node.dataset.initialData);
        if (data?.user?.id != null) return data;
      }
    } catch (_) {}
    return null;
  }

  function getProfileUserId() {
    const fromUrl = getUserIdFromUrl();
    if (fromUrl) return fromUrl;
    const data = parseProfileInitialData();
    return data?.user?.id != null ? String(data.user.id) : null;
  }

  const PROFILE_MODES = ["osu", "taiko", "fruits", "mania"];

  /** Ruleset named in the URL (`/users/1/taiko` or `?mode=taiko`), if any. */
  function getModeFromUrl() {
    const seg = location.pathname.match(/^\/users\/[^/]+\/([^/]+)\/?$/);
    if (seg && PROFILE_MODES.includes(seg[1])) return seg[1];
    const q = location.search.match(/[?&]mode=([^&]+)/);
    return q && PROFILE_MODES.includes(q[1]) ? q[1] : null;
  }

  /**
   * Whether the profile initial data in the DOM belongs to the profile in the URL.
   * The router runs on pushState, i.e. before the new page is rendered, so the DOM
   * can still hold the previous profile (and its default ruleset).
   * @param {Object|null} data
   */
  function profileDataMatchesUrl(data) {
    if (!data?.user) return false;
    const m = location.pathname.match(/^\/users\/([^/]+)/);
    if (!m) return true;
    const seg = decodeURIComponent(m[1]);
    if (/^\d+$/.test(seg)) return String(data.user.id) === seg;
    const norm = (s) =>
      String(s)
        .toLowerCase()
        .replace(/[\s_]+/g, "_");
    return norm(data.user.username ?? "") === norm(seg);
  }

  function getCurrentMode() {
    const fromUrl = getModeFromUrl();
    if (fromUrl) return fromUrl;

    const data = parseProfileInitialData();
    if (data?.current_mode && profileDataMatchesUrl(data)) {
      return data.current_mode;
    }
    return "osu";
  }

  /**
   * Resolve the profile user + ruleset for the page in the URL, waiting for the
   * new page's data when the DOM still holds the previous profile.
   * @param {number} [timeoutMs]
   * @returns {Promise<{ userId: string, mode: string } | null>}
   */
  async function resolveProfileTarget(timeoutMs = 8000) {
    const start = Date.now();
    const urlId = getUserIdFromUrl();
    const urlMode = getModeFromUrl();
    if (urlId && urlMode) return { userId: urlId, mode: urlMode };

    for (;;) {
      const data = parseProfileInitialData();
      if (data && profileDataMatchesUrl(data)) {
        return {
          userId: String(data.user.id),
          mode: urlMode ?? data.current_mode ?? "osu",
        };
      }
      if (Date.now() - start >= timeoutMs) return null;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  function getCurrentUserIdFromHeader() {
    const link = document.querySelector(
      "a.u-current-user-avatar[href*='/users/'], a.u-current-user-cover[href*='/users/']",
    );
    if (!(link instanceof HTMLAnchorElement)) return null;
    const href = link.getAttribute("href") || "";
    const m = href.match(/\/users\/(\d+)(?:\/|$)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? String(n) : null;
  }

  const PROFILE_AVATAR_OPEN_ATTR = "data-oep-profile-avatar-open";
  const PROFILE_BANNER_OPEN_ATTR = "data-oep-profile-banner-open";
  const PROFILE_MEDIA_OPEN_BTN_CLASS = "oep-profile-media-open";
  const PROFILE_MEDIA_OPEN_AVATAR_CLASS = "oep-profile-media-open--avatar";
  const PROFILE_MEDIA_OPEN_BANNER_CLASS = "oep-profile-media-open--banner";
  const PROFILE_MEDIA_OPEN_HOST_CLASS = "oep-profile-media-open-host";
  const PROFILE_MEDIA_OPEN_STYLE_ID = "osu-expertplus-profile-media-open";

  const profileMediaOpenStyle = manageStyle(
    PROFILE_MEDIA_OPEN_STYLE_ID,
    `
    .profile-info.${PROFILE_MEDIA_OPEN_HOST_CLASS},
    .${PROFILE_MEDIA_OPEN_HOST_CLASS} {
      position: relative;
    }
    .${PROFILE_MEDIA_OPEN_BTN_CLASS} {
      position: absolute;
      z-index: 7;
      margin: 0;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.85em;
      height: 1.85em;
      min-width: 1.85em;
      min-height: 1.85em;
      font-size: 11px;
      line-height: 1;
      color: hsl(var(--hsl-l1));
      cursor: pointer;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.55);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease, background-color 140ms ease,
        border-color 140ms ease;
    }
    .${PROFILE_MEDIA_OPEN_BTN_CLASS} .fas {
      pointer-events: none;
    }
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__avatar:hover)
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
        .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:hover
      )
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
        .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:focus-visible
      )
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS} {
      opacity: 1;
      pointer-events: auto;
    }
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__bg:hover)
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
        .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:hover
      )
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
    .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
        .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:focus-visible
      )
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS} {
      opacity: 1;
      pointer-events: auto;
    }
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.78);
      border-color: rgba(255, 255, 255, 0.22);
    }
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}:focus-visible {
      outline: 2px solid hsl(var(--hsl-b1));
      outline-offset: 2px;
    }
  `,
  );

  /** @type {WeakMap<HTMLElement, number>} */
  const profileMediaOpenHostCounts = new WeakMap();

  function acquireProfileMediaOpenHost(profileInfo) {
    const n = (profileMediaOpenHostCounts.get(profileInfo) || 0) + 1;
    profileMediaOpenHostCounts.set(profileInfo, n);
    profileInfo.classList.add(PROFILE_MEDIA_OPEN_HOST_CLASS);
  }

  function releaseProfileMediaOpenHost(profileInfo) {
    const prev = profileMediaOpenHostCounts.get(profileInfo);
    if (prev == null) return;
    const n = prev - 1;
    if (n <= 0) {
      profileMediaOpenHostCounts.delete(profileInfo);
      profileInfo.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS);
    } else {
      profileMediaOpenHostCounts.set(profileInfo, n);
    }
  }

  /**
   * @param {HTMLElement} avatarHost
   * @returns {string}
   */
  function resolveProfileAvatarImageHref(avatarHost) {
    const data = parseProfileInitialData();
    const fromData = data?.user?.avatar_url;
    if (typeof fromData === "string" && fromData.trim()) return fromData.trim();
    const img = avatarHost.querySelector("img[src]");
    if (img instanceof HTMLImageElement && img.src) return img.src;
    const withBg = avatarHost.querySelector("[style*='background-image']");
    if (withBg instanceof HTMLElement) {
      const styleAttr = withBg.getAttribute("style") || "";
      const m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    const uid = getProfileUserId();
    return uid ? `https://a.ppy.sh/${uid}` : "";
  }

  /**
   * @param {HTMLElement} bgHost
   * @returns {string}
   */
  function resolveProfileBannerImageHref(bgHost) {
    const data = parseProfileInitialData();
    const cover = data?.user?.cover;
    if (cover && typeof cover === "object") {
      for (const k of ["custom_url", "url"]) {
        const u = cover[k];
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
    const flat = data?.user?.cover_url;
    if (typeof flat === "string" && flat.trim()) return flat.trim();

    const styleAttr = bgHost.getAttribute("style") || "";
    let m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
    if (m && m[1]) return m[1].trim();
    for (const inner of bgHost.querySelectorAll(
      "[style*='background-image']",
    )) {
      if (!(inner instanceof HTMLElement)) continue;
      const s = inner.getAttribute("style") || "";
      m = s.match(/url\(\s*["']?([^"')]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    const img = bgHost.querySelector("img[src]");
    if (img instanceof HTMLImageElement && img.src) return img.src;
    return "";
  }

  /**
   * @param {{
   *   mediaHost: HTMLElement,
   *   markerAttr: string,
   *   resolveHref: (host: HTMLElement) => string,
   *   ariaLabel: string,
   * }} opts
   * @returns {null | (() => void)}
   */
  function bindProfileMediaOpenButton(opts) {
    const { mediaHost, markerAttr, resolveHref, ariaLabel } = opts;
    if (!(mediaHost instanceof HTMLElement)) return null;
    if (mediaHost.hasAttribute(markerAttr)) return null;
    const href = resolveHref(mediaHost);
    if (!href) return null;
    mediaHost.setAttribute(markerAttr, "1");

    const profileInfoEl = mediaHost.closest(".profile-info");
    const profileInfo =
      profileInfoEl instanceof HTMLElement
        ? profileInfoEl
        : mediaHost.parentElement;
    if (!(profileInfo instanceof HTMLElement)) {
      mediaHost.removeAttribute(markerAttr);
      return null;
    }

    acquireProfileMediaOpenHost(profileInfo);

    const variantClass =
      markerAttr === PROFILE_AVATAR_OPEN_ATTR
        ? PROFILE_MEDIA_OPEN_AVATAR_CLASS
        : PROFILE_MEDIA_OPEN_BANNER_CLASS;

    const btn = el(
      "button",
      {
        type: "button",
        class: `${PROFILE_MEDIA_OPEN_BTN_CLASS} ${variantClass}`,
        "aria-label": ariaLabel,
        onclick: (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          window.open(href, "_blank", "noopener,noreferrer");
        },
      },
      el("i", {
        class: "fas fa-external-link-alt",
        "aria-hidden": "true",
      }),
    );

    function syncOpenBtnLayout() {
      if (!btn.isConnected || !mediaHost.isConnected) return;
      const ar = mediaHost.getBoundingClientRect();
      const pr = profileInfo.getBoundingClientRect();
      const top = ar.top - pr.top + profileInfo.scrollTop;
      const left = ar.left - pr.left + profileInfo.scrollLeft;
      btn.style.top = `${Math.round(top + 2)}px`;
      btn.style.left = `${Math.round(left + ar.width - 2)}px`;
      btn.style.transform = "translate(-100%, 0)";
    }

    profileInfo.appendChild(btn);
    syncOpenBtnLayout();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(syncOpenBtnLayout)
        : null;
    ro?.observe(mediaHost);
    ro?.observe(profileInfo);
    window.addEventListener("scroll", syncOpenBtnLayout, true);
    window.addEventListener("resize", syncOpenBtnLayout);

    return () => {
      window.removeEventListener("scroll", syncOpenBtnLayout, true);
      window.removeEventListener("resize", syncOpenBtnLayout);
      ro?.disconnect();
      btn.remove();
      releaseProfileMediaOpenHost(profileInfo);
      mediaHost.removeAttribute(markerAttr);
    };
  }

  /** Hover controls on profile avatar and banner to open full media in a new tab. */
  function startProfileMediaOpenPictureManager() {
    profileMediaOpenStyle.inject();

    let disposeAvatar = /** @type {null | (() => void)} */ (null);
    let disposeBanner = /** @type {null | (() => void)} */ (null);
    const ac = new AbortController();

    function scanProfileMediaOpen() {
      if (ac.signal.aborted) return;
      const av = document.querySelector(".profile-info__avatar");
      if (
        av instanceof HTMLElement &&
        !av.hasAttribute(PROFILE_AVATAR_OPEN_ATTR)
      ) {
        disposeAvatar?.();
        disposeAvatar =
          bindProfileMediaOpenButton({
            mediaHost: av,
            markerAttr: PROFILE_AVATAR_OPEN_ATTR,
            resolveHref: resolveProfileAvatarImageHref,
            ariaLabel: "Open profile picture",
          }) || null;
      }
      const bg = document.querySelector(".profile-info__bg");
      if (
        bg instanceof HTMLElement &&
        !bg.hasAttribute(PROFILE_BANNER_OPEN_ATTR)
      ) {
        disposeBanner?.();
        disposeBanner =
          bindProfileMediaOpenButton({
            mediaHost: bg,
            markerAttr: PROFILE_BANNER_OPEN_ATTR,
            resolveHref: resolveProfileBannerImageHref,
            ariaLabel: "Open profile banner",
          }) || null;
      }
    }

    Promise.allSettled([
      waitForElement(".profile-info__avatar", 15000),
      waitForElement(".profile-info__bg", 15000),
    ]).then(() => {
      if (!ac.signal.aborted) scanProfileMediaOpen();
    });

    const obs = new MutationObserver(scanProfileMediaOpen);
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      ac.abort();
      obs.disconnect();
      disposeAvatar?.();
      disposeBanner?.();
      document
        .querySelectorAll(`.${PROFILE_MEDIA_OPEN_BTN_CLASS}`)
        .forEach((b) => b.remove());
      document
        .querySelectorAll(`[${PROFILE_AVATAR_OPEN_ATTR}]`)
        .forEach((el) => el.removeAttribute(PROFILE_AVATAR_OPEN_ATTR));
      document
        .querySelectorAll(`[${PROFILE_BANNER_OPEN_ATTR}]`)
        .forEach((el) => el.removeAttribute(PROFILE_BANNER_OPEN_ATTR));
      document
        .querySelectorAll(`.${PROFILE_MEDIA_OPEN_HOST_CLASS}`)
        .forEach((el) => el.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS));
      profileMediaOpenStyle.remove();
    };
  }

  const USERPAGE_EXPAND_STYLE_ID = "osu-expertplus-userpage-expand";
  const USERPAGE_EXPAND_DONE_ATTR = "data-oep-userpage-expand";
  const USERPAGE_EXPAND_PAGE_CLASS = "oep-userpage--expanded";
  const USERPAGE_EXPAND_BTN_CLASS = "oep-userpage-expand-btn";
  const USERPAGE_ME_SECTION_SEL = 'div.js-sortable--page[data-page-id="me"]';
  const USERPAGE_EXPAND_HOST_SELECTOR = ".page-extra--userpage";
  const USERPAGE_OVERFLOW_OUTER_SEL =
    ".page-extra__content-overflow-wrapper-outer";
  const USERPAGE_OVERFLOW_INNER_SEL =
    ".page-extra__content-overflow-wrapper-inner";

  const userpageExpandStyle = manageStyle(
    USERPAGE_EXPAND_STYLE_ID,
    `
    .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
      .page-extra__content-overflow-wrapper-outer,
    .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
      .page-extra__content-overflow-wrapper-inner {
      max-height: none !important;
      overflow-y: visible !important;
    }
    .${USERPAGE_EXPAND_BTN_CLASS} {
      display: block;
      box-sizing: border-box;
      margin: 0;
      padding: 6px 0;
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0 0 10px 10px;
      background: rgba(255, 255, 255, 0.05);
      color: hsl(var(--hsl-l1));
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      cursor: pointer;
      text-align: center;
      transition: background-color 120ms ease;
    }
    .${USERPAGE_EXPAND_BTN_CLASS}:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .${USERPAGE_EXPAND_BTN_CLASS}:focus-visible {
      outline: 2px solid hsl(var(--hsl-b1));
      outline-offset: -2px;
    }
  `,
  );

  /**
   * @param {HTMLElement} pageExtra
   * @returns {HTMLElement | null}
   */
  function findUserpageOverflowOuter(pageExtra) {
    for (const child of pageExtra.children) {
      if (
        child instanceof HTMLElement &&
        child.classList.contains("page-extra__content-overflow-wrapper-outer")
      ) {
        return child;
      }
    }
    const outer = pageExtra.querySelector(USERPAGE_OVERFLOW_OUTER_SEL);
    return outer instanceof HTMLElement ? outer : null;
  }

  /**
   * @param {HTMLElement} outer
   * @param {HTMLElement} inner
   * @returns {boolean}
   */
  function userpageContentOverflows(outer, inner) {
    const outerClips = outer.scrollHeight > outer.clientHeight + 2;
    const innerClips = inner.scrollHeight > inner.clientHeight + 2;
    const innerTallerThanOuter =
      inner.getBoundingClientRect().height >
      outer.getBoundingClientRect().height + 2;
    return outerClips || innerClips || innerTallerThanOuter;
  }

  /**
   * @returns {{ section: HTMLElement, pageExtra: HTMLElement } | null}
   */
  function findMeUserpageContext() {
    const section = document.querySelector(USERPAGE_ME_SECTION_SEL);
    if (!(section instanceof HTMLElement)) return null;
    const pageExtra = section.querySelector(USERPAGE_EXPAND_HOST_SELECTOR);
    if (!(pageExtra instanceof HTMLElement)) return null;
    if (!section.contains(pageExtra)) return null;
    return { section, pageExtra };
  }

  /**
   * @param {HTMLElement} pageExtra
   * @returns {null | (() => void)}
   */
  function bindUserpageExpand(pageExtra) {
    const outer = findUserpageOverflowOuter(pageExtra);
    if (!(outer instanceof HTMLElement)) return null;
    const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
    if (!(inner instanceof HTMLElement)) return null;
    if (!userpageContentOverflows(outer, inner)) return null;

    pageExtra.setAttribute(USERPAGE_EXPAND_DONE_ATTR, "1");

    const cs = getComputedStyle(pageExtra);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;

    const btn = el("button", {
      type: "button",
      class: USERPAGE_EXPAND_BTN_CLASS,
      "aria-expanded": "false",
    });
    btn.style.width = `calc(100% + ${pl + pr}px)`;
    btn.style.marginLeft = `-${pl}px`;

    const syncBtn = () => {
      const expanded = pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS);
      btn.textContent = expanded ? "Collapse userpage" : "Expand userpage";
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    };

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pageExtra.classList.toggle(USERPAGE_EXPAND_PAGE_CLASS);
      syncBtn();
    });

    pageExtra.appendChild(btn);
    syncBtn();

    return () => {
      btn.remove();
      pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
      pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
    };
  }

  function teardownUserpageExpand() {
    document
      .querySelectorAll(`.${USERPAGE_EXPAND_BTN_CLASS}`)
      .forEach((n) => n.remove());
    document.querySelectorAll(USERPAGE_EXPAND_HOST_SELECTOR).forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      host.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
      host.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
    });
  }

  /** @param {MutationRecord[]} mutations */
  function mutationsAffectMeUserpage(mutations) {
    return mutationsIncludeSelector(mutations, USERPAGE_ME_SECTION_SEL);
  }

  /** Expand/collapse the profile Me tab userpage past osu!'s 400px cap. */
  function startUserpageExpandManager() {
    userpageExpandStyle.inject();

    let disposeMe = /** @type {null | (() => void)} */ (null);

    // Spoilers toggle by class and images load late, so neither adds nodes; watch size instead.
    /** @type {ResizeObserver | null} */
    let resizeObs = null;
    /** @type {Element | null} */
    let observedInner = null;

    /** @param {HTMLElement} outer */
    const observeUserpageContent = (outer) => {
      if (typeof ResizeObserver === "undefined") return;
      const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
      if (!(inner instanceof HTMLElement) || inner === observedInner) return;
      resizeObs?.disconnect();
      observedInner = inner;
      resizeObs = new ResizeObserver(() => scan());
      resizeObs.observe(inner);
      for (const child of inner.children) resizeObs.observe(child);
    };

    const scan = () => {
      try {
        const ctx = findMeUserpageContext();
        if (!ctx) {
          disposeMe?.();
          disposeMe = null;
          return;
        }

        const { pageExtra } = ctx;
        const outer = findUserpageOverflowOuter(pageExtra);
        const btn = pageExtra.querySelector(`.${USERPAGE_EXPAND_BTN_CLASS}`);

        if (!outer) {
          disposeMe?.();
          disposeMe = null;
          btn?.remove();
          pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
          pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
          return;
        }

        observeUserpageContent(outer);

        if (pageExtra.hasAttribute(USERPAGE_EXPAND_DONE_ATTR) && btn) {
          const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
          const stillNeeded =
            pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS) ||
            !(inner instanceof HTMLElement) ||
            userpageContentOverflows(outer, inner);
          if (stillNeeded) return;
          // Content shrank back under the cap (e.g. spoiler closed): drop the button.
          disposeMe?.();
          disposeMe = null;
          btn.remove();
          pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
        }

        disposeMe?.();
        disposeMe = bindUserpageExpand(pageExtra);
      } catch (_) {
        disposeMe?.();
        disposeMe = null;
      }
    };

    /** @type {Element} */
    let observeRoot = document.documentElement;
    /** @type {MutationObserver} */
    let obs;

    const syncObserveRoot = () => {
      const next = findMeUserpageContext()?.section ?? document.documentElement;
      if (next === observeRoot) return;
      obs.disconnect();
      observeRoot = next;
      obs.observe(observeRoot, { childList: true, subtree: true });
    };

    obs = new MutationObserver((mutations) => {
      if (
        observeRoot !== document.documentElement ||
        mutationsAffectMeUserpage(mutations)
      ) {
        scan();
        syncObserveRoot();
      }
    });

    scan();
    syncObserveRoot();
    obs.observe(observeRoot, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      resizeObs?.disconnect();
      resizeObs = null;
      observedInner = null;
      disposeMe?.();
      disposeMe = null;
      teardownUserpageExpand();
      userpageExpandStyle.remove();
    };
  }

  const RECENT_FAILS_WRAP_CLASS = "oep-recent-scores-with-fails";
  const RECENT_FAILS_HEADER_CLASS = "oep-recent-fails-header";
  const RECENT_FAILS_EMPTY_MSG = "No scores found.";
  const RECENT_FAILS_EMPTY_FILTERED_MSG =
    "No passing scores in this list (fails hidden).";

  /** @type {WeakMap<HTMLElement, Object[]>} */
  const recentScoresFullCache = new WeakMap();

  function apiScoreIsFail(score) {
    return Boolean(
      score && typeof score === "object" && score.passed === false,
    );
  }

  function filterScoresForRecentDisplay(scores, showFails) {
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
  function findRecentPlaysListRoot() {
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
  function findMostWatchedReplaysListRoot() {
    const page = findHistoricalPage();
    if (!page) return null;
    const lists = Array.from(page.querySelectorAll(".play-detail-list")).filter(
      (el) => el instanceof HTMLElement,
    );
    return lists[1] ?? null;
  }

  function removeOfficialRecentPlaysSection(listRoot) {
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

  function scoreRankForApiScore(score) {
    const r = score?.rank;
    if (typeof r === "string") return r;
    if (r && typeof r === "object" && typeof r.name === "string") return r.name;
    return score?.passed === false ? "F" : "D";
  }

  function beatmapHrefFromScore(score) {
    const bm = score?.beatmap;
    if (!bm?.id) return "#";
    const setId = score.beatmapset?.id;
    const mode = rulesetIdToMode(score.ruleset_id);
    if (setId != null)
      return `https://osu.ppy.sh/beatmapsets/${setId}#${mode}/${bm.id}`;
    return `https://osu.ppy.sh/beatmaps/${bm.id}`;
  }

  function formatAccuracyPercent(score) {
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
  function enrichPlayDetailRowsMaxComboFromAttributes(rows, scores, listEl) {
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

  function isInsideOepRecentFailsWrap(node) {
    return (
      node instanceof Element &&
      Boolean(node.closest(`.${RECENT_FAILS_WRAP_CLASS}`))
    );
  }

  /**
   * A real &lt;Mod&gt; node from osu’s React tree (sprites + layout match the site).
   * Prefers the official Recent plays list on Historical, then Top ranks, then any list.
   * @returns {HTMLElement|null}
   */
  function findOsuModTemplateNode() {
    const fromList = (listEl) => {
      if (!listEl || isInsideOepRecentFailsWrap(listEl)) return null;
      return listEl.querySelector(".play-detail .mods .mod");
    };

    let m = fromList(findRecentPlaysListRoot());
    if (m instanceof HTMLElement) return m;

    const top = document.querySelector('[data-page-id="top_ranks"]');
    if (top && !isInsideOepRecentFailsWrap(top)) {
      for (const pl of top.querySelectorAll(".play-detail-list")) {
        m = fromList(pl);
        if (m instanceof HTMLElement) return m;
      }
    }

    for (const pl of document.querySelectorAll(".play-detail-list")) {
      if (isInsideOepRecentFailsWrap(pl)) continue;
      m = fromList(pl);
      if (m instanceof HTMLElement) return m;
    }
    return null;
  }

  /**
   * @param {number} maxWaitMs
   * @returns {Promise<HTMLElement|null>}
   */
  function waitForOsuModTemplate(maxWaitMs = 2500) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const t = findOsuModTemplateNode();
        if (t instanceof HTMLElement) return resolve(t);
        if (Date.now() - start >= maxWaitMs) return resolve(null);
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  /**
   * @param {HTMLElement} modRoot  cloned .mod from osu
   * @param {string} acronym
   */
  function patchClonedModForAcronym(modRoot, acronym) {
    stripOepModAcronymFromClonedMod(modRoot);
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const icon = modRoot.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const typeClass = modTypeClassForAcronym(acronym);
    const parts = modRoot.className.split(/\s+/).filter(Boolean);
    const rest = parts.filter((c) => !c.startsWith("mod--type-"));
    modRoot.className = [...rest, typeClass].join(" ");
    modRoot.querySelector(".mod__extender")?.remove();
    modRoot.querySelector(".mod__customised-indicator")?.remove();
    modRoot.removeAttribute("title");
  }

  /**
   * @param {unknown[]} modsList  API mod objects or strings
   * @param {HTMLElement|null} templateModEl  osu .mod element to clone (from best/recent rows)
   */
  function buildApiScoreModsInner(modsList, templateModEl) {
    const modsInner = el("div", { class: "mods" });
    for (const mod of modsList || []) {
      const ac = typeof mod === "string" ? mod : mod?.acronym;
      if (!ac) continue;
      let chip;
      if (templateModEl instanceof HTMLElement) {
        chip = /** @type {HTMLElement} */ (templateModEl.cloneNode(true));
        patchClonedModForAcronym(chip, ac);
      } else {
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        chip = el(
          "div",
          { class: `mod ${modTypeClassForAcronym(ac)}` },
          el("div", {
            class: `mod__icon mod__icon--${safe}`,
            "data-acronym": ac,
          }),
        );
      }
      applyModCustomisation(chip, mod);
      modsInner.appendChild(chip);
    }
    return modsInner;
  }

  /**
   * Show a custom rate (DT/NC/HT/DC `speed_change`) the way osu-web does: a
   * `.mod__extender` with "1.30×" plus the customised-cog badge when settings differ.
   * @param {HTMLElement} chip  `.mod` element
   * @param {unknown} mod  API mod object (strings carry no settings)
   */
  function applyModCustomisation(chip, mod) {
    const settings = mod && typeof mod === "object" ? mod.settings : null;
    if (!settings || typeof settings !== "object") return;
    if (!Object.keys(settings).length) return;

    const rate = Number(settings.speed_change);
    if (Number.isFinite(rate) && rate > 0) {
      const label = `${rate.toFixed(2)}×`;
      chip.querySelector(".mod__extender")?.remove();
      chip.appendChild(
        el("div", { class: "mod__extender" }, el("span", {}, label)),
      );
      chip.setAttribute("title", `${mod.acronym} (${label})`);
    }

    // The badge is an inline <use> sprite with a hashed URL; borrow osu's own copy.
    const badge = document.querySelector(
      ".mod__customised-indicator:not(.oep-mod-badge-clone)",
    );
    if (
      badge instanceof HTMLElement &&
      !chip.querySelector(".mod__customised-indicator")
    ) {
      const copy = /** @type {HTMLElement} */ (badge.cloneNode(true));
      copy.classList.add("oep-mod-badge-clone");
      chip.appendChild(copy);
    }
  }

  /**
   * @param {Object} score  osu API v2 score object
   * @param {HTMLElement|null} [modTemplateEl]
   * @returns {HTMLElement}
   */
  function buildPlayDetailRowFromApiScore(score, modTemplateEl = null) {
    const bn = "play-detail";
    const bms = score.beatmapset || {};
    const bm = score.beatmap || {};
    const rank = scoreRankForApiScore(score);
    const rankClass = `score-rank score-rank--full score-rank--${rank}`;

    const titleText = bms.title || "Unknown beatmap";
    const artistText = bms.artist || "—";

    const modsEl = el("div", { class: `${bn}__mods` });
    modsEl.appendChild(buildApiScoreModsInner(score.mods, modTemplateEl));
    if (settings.isEnabled(IDS.MOD_ICONS_AS_ACRONYMS)) {
      applyModIconsAsAcronyms(modsEl);
    }

    let ppInner;
    if (score.pp != null && Number(score.pp) > 0) {
      const rawN = Number(score.pp);
      const raw = String(score.pp);
      const showPpDecimals = settings.isEnabled(SCORE_PP_DECIMALS_ID);
      const shown = Number.isFinite(rawN)
        ? showPpDecimals
          ? formatDecimalPp(rawN)
          : String(Math.round(rawN))
        : raw;
      ppInner = el(
        "span",
        { title: raw },
        shown,
        el("span", { class: `${bn}__pp-unit` }, "pp"),
      );
    } else {
      ppInner = el("span", {}, "—");
    }

    const scoreTimeIso = scoreTimestampIso(score);
    const ended = scoreTimeIso ? new Date(scoreTimeIso).toLocaleString() : "";

    return el(
      "div",
      {
        class: `${bn} ${bn}--highlightable`,
      },
      el(
        "div",
        { class: `${bn}__group ${bn}__group--top` },
        el(
          "div",
          { class: `${bn}__icon ${bn}__icon--main` },
          el("div", { class: rankClass }),
        ),
        el(
          "div",
          { class: `${bn}__detail` },
          el(
            "a",
            {
              class: `${bn}__title u-ellipsis-overflow`,
              href: beatmapHrefFromScore(score),
            },
            titleText,
            " ",
            el("small", { class: `${bn}__artist` }, artistText),
          ),
          el(
            "div",
            { class: `${bn}__beatmap-and-time` },
            el("span", { class: `${bn}__beatmap` }, bm.version || "—"),
            el(
              "span",
              { class: `${bn}__time` },
              el(
                "time",
                { class: "js-timeago timeago", datetime: scoreTimeIso || "" },
                ended,
              ),
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: `${bn}__group ${bn}__group--bottom` },
        el(
          "div",
          { class: `${bn}__score-detail` },
          el(
            "div",
            { class: `${bn}__icon ${bn}__icon--extra` },
            el("div", { class: rankClass }),
          ),
          el(
            "div",
            { class: `${bn}__score-detail-top-right` },
            el(
              "div",
              { class: `${bn}__accuracy-and-weighted-pp` },
              el(
                "span",
                { class: `${bn}__accuracy` },
                formatAccuracyPercent(score),
              ),
            ),
          ),
        ),
        el(
          "div",
          { class: `${bn}__mods-pp` },
          modsEl,
          el("div", { class: `${bn}__pp` }, ppInner),
        ),
        el("div", { class: `${bn}__more` }),
      ),
    );
  }

  const SCORE_OPTIONS_WRAP_CLASS = "oep-score-options-wrap";
  const SCORE_OPTIONS_BTN_CLASS = "oep-score-options-btn";
  const SCORE_OPTIONS_MENU_CLASS = "oep-score-options-menu";
  const SCORE_OPTIONS_ITEM_CLASS = "oep-score-options-item";

  function _closeAllScoreOptionsMenus() {
    document
      .querySelectorAll(`.${SCORE_OPTIONS_MENU_CLASS}[data-open]`)
      .forEach((m) => m.removeAttribute("data-open"));
  }

  let _scoreOptionsDocListenerAdded = false;
  function _ensureScoreOptionsDocListener() {
    if (_scoreOptionsDocListenerAdded) return;
    _scoreOptionsDocListenerAdded = true;
    // Menus are portaled to <body> so we cannot use .closest() from the menu
    // element. Instead, close everything unless the click lands on a wrap button
    // or inside an open menu.
    document.addEventListener(
      "click",
      (e) => {
        const inWrap = e.target.closest(`.${SCORE_OPTIONS_WRAP_CLASS}`);
        const inMenu = e.target.closest(`.${SCORE_OPTIONS_MENU_CLASS}`);
        if (!inWrap && !inMenu) _closeAllScoreOptionsMenus();
      },
      { capture: true },
    );
  }

  /**
   * Build the "⋯" options button + dropdown for a recent-score row.
   * The dropdown is portaled to <body> to escape any CSS stacking-context
   * created by transforms/filters on parent score cards.
   * Returns the button wrapper element, or null when the score has no usable id.
   * @param {Object} score
   * @returns {HTMLElement|null}
   */
  function buildScoreOptionsMenu(score) {
    const scoreId = score?.id;
    if (scoreId == null) return null;

    _ensureScoreOptionsDocListener();

    // Portal: menu lives in <body>, completely outside the card hierarchy.
    const menu = el("div", { class: SCORE_OPTIONS_MENU_CLASS });
    document.body.appendChild(menu);

    const viewLink = el(
      "a",
      {
        class: SCORE_OPTIONS_ITEM_CLASS,
        href: `https://osu.ppy.sh/scores/${scoreId}`,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      "View details",
    );
    viewLink.addEventListener("click", () => menu.removeAttribute("data-open"));
    menu.appendChild(viewLink);

    if (score.has_replay) {
      const replayLink = el(
        "a",
        {
          class: SCORE_OPTIONS_ITEM_CLASS,
          href: `https://osu.ppy.sh/scores/${scoreId}/download`,
          rel: "noopener noreferrer",
        },
        "Download replay",
      );
      replayLink.addEventListener("click", () =>
        menu.removeAttribute("data-open"),
      );
      menu.appendChild(replayLink);
    }

    const isOwnProfile =
      getProfileUserId() != null &&
      getCurrentUserIdFromHeader() != null &&
      String(getProfileUserId()) === String(getCurrentUserIdFromHeader());

    if (isOwnProfile) {
      const pinBtn = el(
        "button",
        { type: "button", class: SCORE_OPTIONS_ITEM_CLASS },
        "Pin",
      );
      pinBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (pinBtn.classList.contains(`${SCORE_OPTIONS_ITEM_CLASS}--pending`))
          return;

        pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
        pinBtn.textContent = "Pinning…";
        try {
          const headers = {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
          };
          const csrf = maybeCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
          const resp = await fetch(`/score-pins/${scoreId}`, {
            method: "PUT",
            credentials: "include",
            headers,
          });
          pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
          if (resp.ok || resp.status === 204) {
            pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--done`);
            pinBtn.textContent = "Pinned!";
          } else {
            pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
            pinBtn.textContent = `Failed (${resp.status})`;
          }
        } catch {
          pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
          pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
          pinBtn.textContent = "Error";
        }
        setTimeout(() => {
          pinBtn.classList.remove(
            `${SCORE_OPTIONS_ITEM_CLASS}--done`,
            `${SCORE_OPTIONS_ITEM_CLASS}--error`,
          );
          pinBtn.textContent = "Pin";
          menu.removeAttribute("data-open");
        }, 2000);
      });
      menu.appendChild(pinBtn);
    } // end isOwnProfile

    const btn = el(
      "button",
      {
        type: "button",
        class: SCORE_OPTIONS_BTN_CLASS,
        title: "Options",
      },
      el("i", { class: "fas fa-ellipsis-h" }),
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.hasAttribute("data-open");
      _closeAllScoreOptionsMenus();
      if (!isOpen) {
        const rect = btn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 2}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
        menu.setAttribute("data-open", "");
      }
    });

    // Attach menu reference to the button so it can be cleaned up when the
    // score list is repopulated (populateRecentScoresInnerList).
    btn._oepMenu = menu;

    return el("div", { class: SCORE_OPTIONS_WRAP_CLASS }, btn);
  }

  /**
   * @param {Object|null|undefined} score
   * @returns {string}
   */
  function scoreTimestampIso(score) {
    if (!score || typeof score !== "object") return "";
    const raw = score.ended_at || score.created_at || "";
    return typeof raw === "string" ? raw : "";
  }

  const RECENT_SCORES_MERGED_MAX = 200;

  /**
   * Site JSON (session cookie); passed scores only, but can return more history
   * than API v2 with include_fails in a single page.
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<object[]>}
   */
  async function fetchWebsiteRecentScoresPassedOnly(userId, mode) {
    const q = new URLSearchParams({
      mode: String(mode),
      limit: "100",
    });
    q.append("include", "beatmap");
    q.append("include", "beatmapset");
    const resp = await OsuExpertPlus.api.siteFetch(
      `/users/${userId}/scores/recent?${q}`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return [];
    let body;
    try {
      body = await resp.json();
    } catch {
      return [];
    }
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.items)) return body.items;
    return [];
  }

  /**
   * Paginated session fetch with fails (fallback when API v2 fails).
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<object[]>}
   */
  async function fetchRecentScoresPaginatedHtmlWithFails(userId, mode) {
    const scores = [];
    const limit = 100;
    const maxTotal = RECENT_SCORES_MERGED_MAX;
    let lastPageKey = "";
    let pageCount = 0;
    for (let offset = 0; ; offset += limit) {
      const q = new URLSearchParams({
        mode,
        limit: String(limit),
        offset: String(offset),
        include_fails: "1",
      });
      q.append("include", "beatmap");
      q.append("include", "beatmapset");
      // A failed first page is an error, not "no recent scores" (B08); later
      // pages only cut the list short.
      let resp;
      try {
        resp = await OsuExpertPlus.api.siteFetch(
          `/users/${userId}/scores/recent?${q}`,
          { headers: { Accept: "application/json" } },
        );
      } catch (err) {
        if (pageCount === 0) throw err;
        break;
      }
      if (!resp.ok) {
        if (pageCount === 0) throw new Error(`HTTP ${resp.status}`);
        break;
      }
      let body;
      try {
        body = await resp.json();
      } catch (err) {
        if (pageCount === 0) throw err;
        break;
      }
      const items = Array.isArray(body)
        ? body
        : Array.isArray(body?.items)
          ? body.items
          : [];
      pageCount += 1;
      if (!items.length) break;

      const pageKey = items
        .map((it) =>
          it?.id != null
            ? String(it.id)
            : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`,
        )
        .join("|");
      if (pageKey && pageKey === lastPageKey) {
        break;
      }
      lastPageKey = pageKey;

      scores.push(...items);
      if (scores.length >= maxTotal) {
        break;
      }
      if (items.length < limit) break;
    }
    return scores.slice(0, maxTotal);
  }

  /**
   * Cross-list identity for recent scores. API v2 often returns legacy `score_osu`
   * rows with `id: 0` on fails (must not use `id` as Map key) and `id` equal to
   * the website row's `legacy_score_id` (lazer rows use a different `id`).
   * @param {object} s
   * @returns {string|null}
   */
  function _recentScoreMergeKey(s) {
    if (!s || typeof s !== "object") return null;
    const leg = Number(s.legacy_score_id);
    if (Number.isFinite(leg) && leg > 0) return `s:${leg}`;
    const id = Number(s.id);
    if (Number.isFinite(id) && id > 0) return `s:${id}`;
    const bm = s.beatmap?.id ?? s.beatmap_id;
    const t = String(s.ended_at || s.created_at || "");
    const tot = Number(s.total_score ?? s.score);
    const pf = s.passed === false ? 0 : 1;
    if (
      bm != null &&
      Number.isFinite(Number(bm)) &&
      t.length > 0 &&
      Number.isFinite(tot)
    ) {
      return `f:${Number(bm)}:${t}:${tot}:${pf}`;
    }
    return null;
  }

  function _recentScoreDisplayRank(s) {
    if (!s || typeof s !== "object") return 0;
    let r = 0;
    if (s.ended_at) r += 2;
    if (s.type === "solo_score") r += 3;
    if (
      Array.isArray(s.mods) &&
      s.mods.length > 0 &&
      typeof s.mods[0] === "object"
    )
      r += 2;
    if (s.ruleset_id != null) r += 1;
    return r;
  }

  /**
   * When API legacy and site lazer describe the same play, keep the richer row
   * for UI (mods shape, `ended_at`, etc.); never drop a fail in favour of a pass.
   * @param {object} a
   * @param {object} b
   */
  function _pickMergedRecentScore(a, b) {
    const af = a?.passed === false;
    const bf = b?.passed === false;
    if (af !== bf) return af ? a : b;
    const ra = _recentScoreDisplayRank(a);
    const rb = _recentScoreDisplayRank(b);
    if (rb !== ra) return rb > ra ? b : a;
    return a;
  }

  /**
   * @param {object[]} primary  API or paginated path with fails
   * @param {object[]} extraPassed  site `/scores/recent?limit=100` (passed only)
   */
  function mergeRecentScoresWithExtendedPassed(primary, extraPassed) {
    const map = new Map();

    primary.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = _recentScoreMergeKey(s);
      if (k == null) k = `z:primary:${i}`;
      if (!map.has(k)) map.set(k, s);
    });

    extraPassed.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = _recentScoreMergeKey(s);
      if (k == null) k = `z:extra:${i}`;
      if (!map.has(k)) {
        map.set(k, s);
      } else {
        map.set(k, _pickMergedRecentScore(map.get(k), s));
      }
    });

    return [...map.values()].sort((a, b) => {
      const ta = Date.parse(scoreTimestampIso(a)) || 0;
      const tb = Date.parse(scoreTimestampIso(b)) || 0;
      return tb - ta;
    });
  }

  /**
   * Rejects when neither source could be read, so a failure is never shown (or
   * cached) as "no recent scores" (B08).
   */
  async function fetchRecentScoresPrimaryWithFails(userId, mode) {
    // Prefer the site endpoint: it returns lazer-shaped scores (mod objects with
    // settings, Classic/DA/FF/AD, custom rates). API v2 is only a fallback since
    // its score shape depends on the request's `x-api-version`.
    let site = null;
    let siteError = null;
    try {
      site = await fetchRecentScoresPaginatedHtmlWithFails(userId, mode);
    } catch (err) {
      siteError = err;
    }
    if (site?.length) return site;
    try {
      const data = await OsuExpertPlus.api.getUserRecentScores(
        userId,
        mode,
        100,
        0,
        true,
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      // The site answered (with no scores): trust it over a failed fallback.
      if (site) return site;
      throw siteError || err;
    }
  }

  /** Recent plays change quickly, so this cache only covers quick back-and-forth navigation. */
  const RECENT_SCORES_CACHE_TTL_MS = 60 * 1000;
  const _recentScoresCache = new Map();

  function fetchRecentScoresIncludingFails(userId, mode) {
    const ttl = Math.min(
      _profileScoresCacheTtl(userId),
      RECENT_SCORES_CACHE_TTL_MS,
    );
    return _sharedPromise(
      _recentScoresCache,
      `${userId}:${mode}`,
      ttl,
      async () => {
        const [primary, extraPassed] = await Promise.all([
          fetchRecentScoresPrimaryWithFails(userId, mode),
          fetchWebsiteRecentScoresPassedOnly(userId, mode).catch(() => []),
        ]);
        return mergeRecentScoresWithExtendedPassed(primary, extraPassed).slice(
          0,
          RECENT_SCORES_MERGED_MAX,
        );
      },
    );
  }

  /** Inject only: the shared play-detail style is removed by profile `init` (B07). */
  function ensurePlayDetailStylesForRecent() {
    playDetailStyle.inject();
  }

  let _recentFailsDebounce = null;

  /**
   * @param {HTMLElement} innerList
   * @param {Object[]} scores
   * @param {HTMLElement|null} modTemplate
   * @param {string} emptyMessage
   */
  function populateRecentScoresInnerList(
    innerList,
    scores,
    modTemplate,
    emptyMessage,
  ) {
    // Remove portaled option menus from a previous render before clearing the list.
    innerList.querySelectorAll(`.${SCORE_OPTIONS_BTN_CLASS}`).forEach((b) => {
      b._oepMenu?.remove();
    });
    innerList.textContent = "";
    innerList.classList.toggle(
      SCORE_LIST_LAYOUT_CLASS,
      settings.isEnabled(SCORE_HIT_STATISTICS_ID),
    );
    syncScoreListPpDecimalsWidthClass(innerList);
    if (!scores.length) {
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, emptyMessage),
      );
      return;
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;
    const rows = scores.map((s) => buildPlayDetailRowFromApiScore(s, tpl));
    rows.forEach((r, i) => {
      const score = scores[i];

      const moreEl = r.querySelector(".play-detail__more");
      const optionsMenu = buildScoreOptionsMenu(score);
      if (moreEl && optionsMenu) moreEl.appendChild(optionsMenu);

      if (score?.id) {
        r.classList.add("oep-recent-score-card-link");
        r.addEventListener("click", (e) => {
          if (e.target.closest("a, button, input, select, textarea")) return;
          window.location.href = `/scores/${score.id}`;
        });
      }

      innerList.appendChild(r);
    });
    applyHideWeightedPp(innerList);
    if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
      applyPpDecimals(innerList);
    }
    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      processElements(rows, scores);
      enrichPlayDetailRowsMaxComboFromAttributes(rows, scores, innerList);
    }
    if (settings.isEnabled(IDS.MOD_ICONS_AS_ACRONYMS)) {
      injectModIconsAcronymStyles();
      applyModIconsAsAcronyms(innerList);
    }
    if (settings.isEnabled(MODDED_SR_ID)) {
      if (!_srObserver) initSrObserver();
      rows.forEach(_observeRow);
    }
    if (settings.isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      injectRanksCardBgLayoutStyles();
      applyRanksCardBackgrounds(innerList);
    }
    if (settings.isEnabled(SCORE_PLACE_NUMBER_ID)) {
      scorePlaceNumberStyle.inject();
      applyPlaceNumbers(innerList);
    } else {
      revertPlaceNumbers(innerList);
    }
  }

  function repopulateRecentScoresWrap(wrap) {
    if (!(wrap instanceof HTMLElement)) return;
    const innerList = wrap.querySelector(":scope > .play-detail-list");
    if (!(innerList instanceof HTMLElement)) return;
    const all = recentScoresFullCache.get(wrap);
    if (!all) return;
    const showFails = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    const filtered = filterScoresForRecentDisplay(all, showFails);
    const emptyMsg =
      !filtered.length && all.length && !showFails
        ? RECENT_FAILS_EMPTY_FILTERED_MSG
        : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(
      innerList,
      filtered,
      findOsuModTemplateNode(),
      emptyMsg,
    );
  }

  /**
   * Mount once per (list element identity): section below official Recent plays + show more.
   * The official list is only removed once our list rendered successfully (B08).
   * @param {string} userId
   * @param {string} mode
   * @param {() => boolean} isCancelled  true once the profile run was cleaned up;
   *   checked after every await because the page may belong to the next profile.
   */
  async function tryMountRecentScoresWithFails(userId, mode, isCancelled) {
    if (document.querySelector(`.${RECENT_FAILS_WRAP_CLASS}`)) return;

    const listRoot = findRecentPlaysListRoot();
    if (!listRoot) return;

    const next = listRoot.nextElementSibling;
    if (
      next instanceof HTMLElement &&
      next.classList.contains(RECENT_FAILS_WRAP_CLASS)
    ) {
      return;
    }

    ensurePlayDetailStylesForRecent();

    const wrap = el("div", { class: RECENT_FAILS_WRAP_CLASS });
    const header = el("div", { class: RECENT_FAILS_HEADER_CLASS });
    header.appendChild(
      el("h3", { class: "title title--page-extra-small" }, "Recent scores"),
    );
    const showFailsCb = document.createElement("input");
    showFailsCb.type = "checkbox";
    showFailsCb.className = "oep-recent-show-fails";
    showFailsCb.checked = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.addEventListener("change", () => {
      settings.set(RECENT_SCORES_SHOW_FAILS_ID, showFailsCb.checked);
    });
    header.appendChild(
      el(
        "label",
        { class: "oep-recent-fails-toggle" },
        showFailsCb,
        "Show failed scores",
      ),
    );
    const clearCacheBtn = el(
      "button",
      {
        class: "oep-clear-sr-cache-btn",
        type: "button",
        title:
          "Clears cached modded star ratings and max combo. Use this if values look wrong or outdated after a beatmap is updated.",
      },
      "Clear SR cache",
    );
    clearCacheBtn.addEventListener("click", () => {
      _attrsSessionCache.clear();
      _writeBeatmapAttrsGmStore({});
      clearCacheBtn.textContent = "Cleared!";
      setTimeout(() => {
        clearCacheBtn.textContent = "Clear SR cache";
      }, 2000);
    });
    header.appendChild(clearCacheBtn);
    wrap.appendChild(header);
    const innerList = el("div", { class: "play-detail-list" });
    innerList.appendChild(
      el("p", { class: "oep-recent-fails-loading" }, "Loading…"),
    );
    wrap.appendChild(innerList);
    listRoot.insertAdjacentElement("afterend", wrap);

    let scores;
    try {
      scores = await fetchRecentScoresIncludingFails(userId, mode);
    } catch {
      if (isCancelled()) return;
      innerList.textContent = "";
      innerList.appendChild(
        el(
          "p",
          { class: "oep-recent-fails-error" },
          "Could not load recent scores (including fails).",
        ),
      );
      return;
    }
    if (isCancelled()) return;

    innerList.textContent = "";
    if (!scores.length) {
      // Only reached on a successful (empty) fetch; on errors the catch above
      // keeps the official list.
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, RECENT_FAILS_EMPTY_MSG),
      );
      removeOfficialRecentPlaysSection(listRoot);
      return;
    }

    recentScoresFullCache.set(wrap, scores);

    let modTemplate = findOsuModTemplateNode();
    if (
      !(modTemplate instanceof HTMLElement) &&
      scores.some((s) => Array.isArray(s.mods) && s.mods.length > 0)
    ) {
      modTemplate = await waitForOsuModTemplate(2500);
      if (isCancelled()) return;
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;

    const showFails = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.checked = showFails;
    const filtered = filterScoresForRecentDisplay(scores, showFails);
    const emptyMsg =
      !filtered.length && scores.length && !showFails
        ? RECENT_FAILS_EMPTY_FILTERED_MSG
        : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(innerList, filtered, tpl, emptyMsg);

    removeOfficialRecentPlaysSection(listRoot);
  }

  /**
   * Historical tab content is loaded lazily after profile init; watch the DOM.
   * @param {string} userId
   * @param {string} mode
   * @returns {function}
   */
  function startRecentScoresWithFailsObserver(userId, mode) {
    let cancelled = false;

    const unsubRecentFailsShow = settings.onChange(
      RECENT_SCORES_SHOW_FAILS_ID,
      () => {
        document
          .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`)
          .forEach((w) => {
            if (!(w instanceof HTMLElement)) return;
            const input = w.querySelector("input.oep-recent-show-fails");
            const on = settings.isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
            if (input instanceof HTMLInputElement) input.checked = on;
            repopulateRecentScoresWrap(w);
          });
      },
    );

    const repopulateRecentOnScoreDisplayChange = () => {
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (w instanceof HTMLElement) repopulateRecentScoresWrap(w);
      });
    };
    const unsubRecentPpDecimals = settings.onChange(
      SCORE_PP_DECIMALS_ID,
      repopulateRecentOnScoreDisplayChange,
    );
    const unsubRecentHitStatistics = settings.onChange(
      SCORE_HIT_STATISTICS_ID,
      repopulateRecentOnScoreDisplayChange,
    );
    const unsubRecentPlaceNumbers = settings.onChange(
      SCORE_PLACE_NUMBER_ID,
      repopulateRecentOnScoreDisplayChange,
    );

    const run = () => {
      if (cancelled) return;
      clearTimeout(_recentFailsDebounce);
      _recentFailsDebounce = setTimeout(() => {
        if (cancelled) return;
        tryMountRecentScoresWithFails(userId, mode, () => cancelled).catch(
          () => {},
        );
      }, 200);
    };

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          'div.js-sortable--page[data-page-id="historical"], h3.title.title--page-extra-small, .play-detail-list',
        )
      ) {
        run();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    run();

    return () => {
      cancelled = true;
      clearTimeout(_recentFailsDebounce);
      unsubRecentFailsShow();
      unsubRecentPpDecimals();
      unsubRecentHitStatistics();
      unsubRecentPlaceNumbers();
      obs.disconnect();
      document
        .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`)
        .forEach((n) => n.remove());
    };
  }

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
  const RANKS_CARD_BG_FEATURE_ID = IDS.SCORE_CARD_BACKGROUNDS;
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
    if (i <= RANKS_PERIOD_IDX_WEEK_END)
      return i === 1 ? "1 week" : `${i} weeks`;
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

  function injectRanksCardBgLayoutStyles() {
    ranksCardBgLayoutStyle.inject();
  }

  /**
   * @param {ParentNode} topRanksRoot
   * @param {number} periodIdx
   * @param {boolean} reversed  if true, highlight scores *older* than the window
   */
  function applyRanksDateHighlights(topRanksRoot, periodIdx, reversed) {
    const rows = topRanksRoot.querySelectorAll(
      ".play-detail-list .play-detail",
    );
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
   * @returns {string|null}
   */
  function getRanksRowBeatmapsetId(rowEl) {
    const href = rowEl
      .querySelector("a.play-detail__title")
      ?.getAttribute("href");
    if (!href) return null;
    const beatmapsetMatch = href.match(/\/beatmapsets\/(\d+)/);
    return beatmapsetMatch?.[1] ?? null;
  }

  /**
   * @param {HTMLElement} topRanksRoot
   */
  function applyRanksCardBackgrounds(topRanksRoot) {
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
        el(
          "div",
          { class: "oep-ranks-date-filter__actions" },
          resetBtn,
          revBtn,
        ),
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
      setRanksFilterBarLabels(
        statusEl,
        tailEl,
        RANKS_PERIOD_IDX_DEFAULT,
        false,
      );
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
    if (settings.isEnabled(SCORE_PERIOD_HIGHLIGHT_ID)) {
      ensureRanksDateFilterBar(topRanksRoot);
      const range = topRanksRoot.querySelector(
        `.${RANKS_DATE_FILTER_CLASS} input[type="range"]`,
      );
      const idx = range
        ? clampRanksPeriodIndex(range.value)
        : RANKS_PERIOD_IDX_DEFAULT;
      if (range && String(range.value) !== String(idx))
        range.value = String(idx);
      const revBtn = topRanksRoot.querySelector(
        ".oep-ranks-date-filter__reverse",
      );
      const reversed =
        revBtn instanceof HTMLElement
          ? revBtn.getAttribute("aria-pressed") === "true"
          : false;
      applyRanksDateHighlights(topRanksRoot, idx, reversed);
    }
    if (settings.isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      applyRanksCardBackgrounds(topRanksRoot);
    }
  }

  /**
   * Ranks extra page mounts lazily; watch the DOM and keep highlights in sync
   * (including “load more”).
   * @returns {function}
   */
  function startRanksDateHighlightManager() {
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
      const periodOn = settings.isEnabled(SCORE_PERIOD_HIGHLIGHT_ID);
      const cardBgOn = settings.isEnabled(RANKS_CARD_BG_FEATURE_ID);

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
            if (listEl instanceof HTMLElement)
              applyRanksCardBackgrounds(listEl);
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

    const unsubBg = settings.onChange(RANKS_CARD_BG_FEATURE_ID, (enabled) => {
      if (enabled) {
        injectRanksCardBgLayoutStyles();
        const page = document.querySelector(RANKS_PAGE_SELECTOR);
        if (page instanceof HTMLElement) applyRanksCardBackgrounds(page);
        document
          .querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`)
          .forEach((listEl) => {
            if (listEl instanceof HTMLElement)
              applyRanksCardBackgrounds(listEl);
          });
        const mostWatchedList = findMostWatchedReplaysListRoot();
        if (mostWatchedList instanceof HTMLElement)
          applyRanksCardBackgrounds(mostWatchedList);
      } else {
        revertRanksCardBackgrounds();
        ranksCardBgLayoutStyle.remove();
      }
    });

    const unsubPeriod = settings.onChange(SCORE_PERIOD_HIGHLIGHT_ID, () =>
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

