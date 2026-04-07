/** User profile page. Router calls init per visit; cleanup on navigate away. */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.userProfile = (() => {
  const name = "UserProfile";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    manageStyle,
    createCleanupBag,
    parseLocaleNumber,
    formatDecimalPp,
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const {
    applyModIconsAsAcronyms,
    injectModIconsAcronymStyles,
    stripOepModAcronymFromClonedMod,
    modTypeClassForAcronym,
  } = OsuExpertPlus.modIconsAsAcronyms;

  /**
   * True when a mutation batch contains an added node that matches selector
   * (or contains matching descendants).
   * @param {MutationRecord[]} mutations
   * @param {string} selector
   * @returns {boolean}
   */
  function mutationsIncludeSelector(mutations, selector) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(selector)) return true;
        if (node.querySelector(selector)) return true;
      }
    }
    return false;
  }

  // Score lists: PP from span title → 2dp; hit-stat row from API (fetchScores)
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const SCORE_HIT_STATISTICS_ID = IDS.SCORE_HIT_STATISTICS;
  const SCORE_PERIOD_HIGHLIGHT_ID = IDS.SCORE_PERIOD_HIGHLIGHT;
  const RECENT_SCORES_SHOW_FAILS_ID = IDS.RECENT_SCORES_SHOW_FAILS;
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
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--300  { color: #78dcff; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--100  { color: #84e03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--50   { color: #e0b03a; }
    ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--miss { color: #e05c5c; }
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
    .play-detail-list .oep-score-stats__val--300  { color: #78dcff; }
    .play-detail-list .oep-score-stats__val--100  { color: #84e03a; }
    .play-detail-list .oep-score-stats__val--50   { color: #e0b03a; }
    .play-detail-list .oep-score-stats__val--miss { color: #e05c5c; }

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
  `;
  const playDetailStyle = manageStyle(PLAY_DETAIL_STYLE_ID, PLAY_DETAIL_CSS);

  const SCORE_STATS_ATTR = "data-oep-stats";

  /** GET /users/{id}/scores/{type} paginated; same order as DOM. */
  async function fetchScores(userId, mode, type) {
    const scores = [];
    const limit = 100;
    const maxTotal = 1000;
    const maxPages = 20;
    let lastPageKey = "";
    let pageCount = 0;

    for (let offset = 0; ; offset += limit) {
      if (pageCount >= maxPages) {
        break;
      }
      const url = `/users/${userId}/scores/${type}?mode=${mode}&limit=${limit}&offset=${offset}&include=beatmap`;
      let resp;
      try {
        resp = await fetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      } catch {
        break;
      }

      if (!resp.ok) break;

      let body;
      try {
        body = await resp.json();
      } catch {
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

    const out = scores.slice(0, maxTotal);
    return out;
  }

  /**
   * Identify what type of score section a .play-detail-list belongs to.
   * Uses language-independent structural/positional signals; falls back to
   * heading text for English.
   * @returns {'pinned'|'best'|'firsts'|null}
   */
  function _getSectionType(listEl) {
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
    if (
      rulesetId === 0 &&
      ms.great != null &&
      Number.isFinite(Number(ms.great))
    ) {
      const great = Number(ms.great);
      if (
        ms.legacy_combo_increase != null &&
        Number.isFinite(Number(ms.legacy_combo_increase))
      ) {
        return great + Number(ms.legacy_combo_increase);
      }
      let n = great;
      for (const key of [
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
      ]) {
        const v = ms[key];
        if (v != null && Number.isFinite(Number(v))) n += Number(v);
      }
      return n;
    }

    if (ms.great != null && Number.isFinite(Number(ms.great))) {
      const g = Number(ms.great);
      const l =
        ms.legacy_combo_increase != null &&
        Number.isFinite(Number(ms.legacy_combo_increase))
          ? Number(ms.legacy_combo_increase)
          : 0;
      return g + l;
    }

    return null;
  }

  /**
   * After attributes API resolves max combo, update the injected "achievedx/maxx" span.
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
    if (
      !(afterMax?.nodeType === Node.TEXT_NODE && afterMax.textContent === "x")
    ) {
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

    const legacy = rowEl.querySelector(".oep-accuracy-combo-row");
    if (legacy) {
      legacy.querySelector(".oep-combo-inline")?.remove();
      const a = legacy.querySelector(".play-detail__accuracy");
      const p = legacy.parentNode;
      if (a && p) {
        p.insertBefore(a, legacy);
        legacy.remove();
      }
    }

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
      "x/",
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
   * osu! API v2 scores may use lazer keys (great, ok, meh, miss) or legacy
   * (count_300, count_100, count_50, count_miss, count_geki, count_katu).
   * @param {Object|null|undefined} statistics
   * @returns {{ n300: number, n100: number, n50: number, nMiss: number }}
   */
  function normalizeScoreStatistics(statistics) {
    if (!statistics || typeof statistics !== "object") {
      return { n300: 0, n100: 0, n50: 0, nMiss: 0 };
    }
    const hasLazer =
      statistics.great != null ||
      statistics.perfect != null ||
      statistics.ok != null ||
      statistics.meh != null ||
      statistics.miss != null;
    if (hasLazer) {
      return {
        n300: Number(statistics.great ?? 0) + Number(statistics.perfect ?? 0),
        n100: Number(statistics.ok ?? 0),
        n50: Number(statistics.meh ?? 0),
        nMiss: Number(statistics.miss ?? 0),
      };
    }
    const c300 = Number(statistics.count_300 ?? 0);
    const cGeki = Number(statistics.count_geki ?? 0);
    return {
      n300: c300 + cGeki,
      n100: Number(statistics.count_100 ?? 0),
      n50: Number(statistics.count_50 ?? 0),
      nMiss: Number(statistics.count_miss ?? 0),
    };
  }

  /** Build a stats row element from a score's statistics object. */
  function buildStatsRow(statistics) {
    const { n300, n100, n50, nMiss } = normalizeScoreStatistics(statistics);

    const sep = () => el("span", { class: "oep-score-stats__sep" }, "/");

    return el(
      "div",
      { class: "oep-score-stats" },
      el("span", { class: "oep-score-stats__val--300" }, String(n300)),
      sep(),
      el("span", { class: "oep-score-stats__val--100" }, String(n100)),
      sep(),
      el("span", { class: "oep-score-stats__val--50" }, String(n50)),
      sep(),
      el("span", { class: "oep-score-stats__val--miss" }, String(nMiss)),
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

    const statsRow = buildStatsRow(score?.statistics);
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
    const wrap = rowEl.querySelector(".oep-accuracy-combo-row");
    if (!wrap) {
      rowEl.querySelector(".oep-combo-inline")?.remove();
      return;
    }
    const acc = wrap.querySelector(".play-detail__accuracy");
    const parent = wrap.parentNode;
    if (acc && parent) parent.insertBefore(acc, wrap);
    wrap.remove();
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

  function applyHideWeightedPp(listEl) {
    listEl.querySelectorAll(".play-detail").forEach((rowEl) => {
      const col = rowEl.querySelector(".oep-pp-col");
      if (col) {
        const ppEl = col.querySelector(".play-detail__pp");
        if (ppEl && col.parentNode) {
          col.parentNode.insertBefore(ppEl, col);
        }
        col.remove();
      }
      rowEl.querySelector(".oep-weighted-pp-label")?.remove();

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

  function _getCachedAttrs(key) {
    return _attrsSessionCache.get(key);
  }

  function _diffMods(acronyms) {
    return acronyms
      .map((a) => a.toUpperCase())
      .filter((a) => DIFFICULTY_MODS.has(a))
      .sort();
  }

  function _srCacheKey(beatmapId, diffMods) {
    return `${beatmapId}:${diffMods.join("+") || "NM"}`;
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
   * @returns {Promise<{ key: string, sr: number|null, maxCombo: number|null }>}
   */
  async function _fetchBeatmapAttributesCached(beatmapId, diffMods, ruleset) {
    const key = _srCacheKey(beatmapId, diffMods);
    const hit = _getCachedAttrs(key);
    if (hit !== undefined) return { key, ...hit };

    if (!_attrsInFlight.has(key)) {
      const p = OsuExpertPlus.api
        .postBeatmapAttributes(beatmapId, diffMods, ruleset)
        .then((data) => {
          const attrs = data?.attributes ?? {};
          const sr =
            attrs.star_rating != null &&
            Number.isFinite(Number(attrs.star_rating))
              ? Number(attrs.star_rating)
              : null;
          const maxCombo =
            attrs.max_combo != null && Number.isFinite(Number(attrs.max_combo))
              ? Number(attrs.max_combo)
              : null;
          const packed = { sr, maxCombo };
          _attrsSessionCache.set(key, packed);
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
    elements.forEach((rowEl, i) => {
      const score = scores[i];
      if (!score) return;
      injectStatsRow(rowEl, score);
    });
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

  const SCORE_SECTION_TYPES = ["pinned", "best", "firsts"];
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
   * @param {string|number} userId
   * @param {string} mode
   * @returns {Promise<function>}  Returns a cleanup fn.
   */
  async function initScoreFeatures(userId, mode) {
    const cleanupFns = [];

    playDetailStyle.inject();
    cleanupFns.push(playDetailStyle.remove);

    await waitForStaleElementToLeave(PLAY_DETAIL_LIST_STALE_SEL);

    try {
      await waitForElement(".play-detail-list .play-detail", 15000);
    } catch {
      return () => {};
    }

    const scoreSections = Array.from(
      document.querySelectorAll(".play-detail-list"),
    )
      .map((listEl) => ({ listEl, type: _getSectionType(listEl) }))
      .filter((s) => SCORE_SECTION_TYPES.includes(s.type));

    if (!scoreSections.length) {
      return () => {};
    }

    scoreSections.forEach(({ listEl }) =>
      listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1"),
    );

    setScoreListLayoutClass(
      scoreSections,
      settings.isEnabled(SCORE_HIT_STATISTICS_ID),
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

    if (settings.isEnabled(MODDED_SR_ID)) {
      initSrObserver();
      cleanupFns.push(() => teardownSrObserver());
    }

    const scoresMap = new Map();

    async function _loadAndApplyStats(section) {
      const { listEl, type } = section;
      if (!scoresMap.has(type)) {
        scoresMap.set(type, await fetchScores(userId, mode, type));
      }
      processElements(
        Array.from(listEl.querySelectorAll(".play-detail")),
        scoresMap.get(type),
      );
    }

    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      await Promise.all(scoreSections.map(_loadAndApplyStats));
      // Re-apply in case a locale re-render overwrote decimals during the await.
      if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
        scoreSections.forEach(({ listEl }) => applyPpDecimals(listEl));
      }
    }

    // Per-section MutationObserver for "load more" rows.
    scoreSections.forEach((section) => {
      const { listEl, type } = section;
      let sectionObsBusy = false;

      const obs = new MutationObserver((mutations) => {
        if (sectionObsBusy) return;

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

        if (!hasNewRows && !hasPpDecimalOverwrite) return;

        sectionObsBusy = true;
        try {
          if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) applyPpDecimals(listEl);
          applyHideWeightedPp(listEl);
          if (
            settings.isEnabled(SCORE_PLACE_NUMBER_ID) &&
            type === SCORE_PLACE_SECTION_TYPE
          ) {
            applyPlaceNumbers(listEl);
          }

          const allEls = Array.from(listEl.querySelectorAll(".play-detail"));
          if (
            settings.isEnabled(SCORE_HIT_STATISTICS_ID) &&
            scoresMap.has(type)
          ) {
            const scores = scoresMap.get(type);
            allEls.forEach((rowEl, i) => {
              const needsReinjection =
                !rowEl.hasAttribute(SCORE_STATS_ATTR) ||
                !rowEl.querySelector(".oep-score-stats");
              if (!needsReinjection) return;
              rowEl.removeAttribute(SCORE_STATS_ATTR);
              const score = scores[i];
              if (!score) return;
              injectStatsRow(rowEl, score);
            });
          }
        } finally {
          sectionObsBusy = false;
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
    });

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

    cleanupFns.push(() => {
      scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl));
      scorePlaceNumberStyle.remove();
    });

    return () => {
      setScoreListLayoutClass(scoreSections, false);
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    };
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

  /** Numeric id for API calls; works for /users/&lt;username&gt; via embedded JSON. */
  function getProfileUserId() {
    const fromUrl = getUserIdFromUrl();
    if (fromUrl) return fromUrl;
    const data = parseProfileInitialData();
    return data?.user?.id != null ? String(data.user.id) : null;
  }

  function getCurrentMode() {
    const data = parseProfileInitialData();
    if (data?.current_mode) return data.current_mode;

    const m = location.search.match(/[?&]mode=([^&]+)/);
    return m ? m[1] : "osu";
  }

  /** Numeric id of the currently logged-in account from nav header links. */
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

  function findRecentPlaysListRoot() {
    const page = document.querySelector(
      'div.js-sortable--page[data-page-id="historical"]',
    );
    if (!page) return null;

    const h3s = page.querySelectorAll("h3.title.title--page-extra-small");
    for (const h3 of h3s) {
      if (!/\brecent\b/i.test(h3.textContent)) continue;
      const next = h3.nextElementSibling;
      if (
        next instanceof HTMLElement &&
        next.classList.contains("play-detail-list")
      ) {
        return next;
      }
    }
    return null;
  }

  /** Historical → “Most Watched Replays” (osu `score_replay_stats`) play-detail list. */
  function findMostWatchedReplaysListRoot() {
    const page = document.querySelector(
      'div.js-sortable--page[data-page-id="historical"]',
    );
    if (!page) return null;

    const h3s = page.querySelectorAll("h3.title.title--page-extra-small");
    for (const h3 of h3s) {
      if (!/most\s+watched/i.test(h3.textContent || "")) continue;
      const next = h3.nextElementSibling;
      if (
        next instanceof HTMLElement &&
        next.classList.contains("play-detail-list")
      ) {
        return next;
      }
    }
    return null;
  }

  function removeOfficialRecentPlaysSection(listRoot) {
    if (!(listRoot instanceof HTMLElement)) return;
    const prev = listRoot.previousElementSibling;
    if (
      prev instanceof HTMLElement &&
      prev.matches("h3.title.title--page-extra-small") &&
      /\brecent\b/i.test(prev.textContent || "")
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
   * injected "(achieved / max)" from POST /beatmaps/{id}/attributes. One
   * request per unique (beatmap, difficulty-affecting mods); shared cache
   * with modded star rating.
   * @param {HTMLElement[]} rows
   * @param {Object[]} scores  same length and order as rows
   */
  async function enrichPlayDetailRowsMaxComboFromAttributes(rows, scores) {
    /** @type {Map<string, { beatmapId: string|number, diffMods: string[], ruleset: string }>} */
    const unique = new Map();

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (_beatmapMaxComboFromScore(score) != null) continue;
      const bmId = score?.beatmap?.id;
      if (bmId == null) continue;
      const diffMods = _diffMods(modsAcronymsFromApiMods(score.mods));
      const ruleset = rulesetIdToMode(score.ruleset_id);
      const key = _srCacheKey(bmId, diffMods);
      if (!unique.has(key)) {
        unique.set(key, { beatmapId: bmId, diffMods, ruleset });
      }
    }

    await Promise.all(
      [...unique.values()].map(({ beatmapId, diffMods, ruleset }) =>
        _fetchBeatmapAttributesCached(beatmapId, diffMods, ruleset),
      ),
    );

    for (let i = 0; i < rows.length; i++) {
      const score = scores[i];
      if (_beatmapMaxComboFromScore(score) != null) continue;
      const bmId = score?.beatmap?.id;
      if (bmId == null) continue;
      const diffMods = _diffMods(modsAcronymsFromApiMods(score.mods));
      const key = _srCacheKey(bmId, diffMods);
      const attrs = _getCachedAttrs(key);
      const maxCombo = attrs?.maxCombo;
      if (maxCombo != null) _applyApiMaxComboToComboInline(rows[i], maxCombo);
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
      if (templateModEl instanceof HTMLElement) {
        const cloned = /** @type {HTMLElement} */ (
          templateModEl.cloneNode(true)
        );
        patchClonedModForAcronym(cloned, ac);
        modsInner.appendChild(cloned);
      } else {
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        modsInner.appendChild(
          el(
            "div",
            { class: `mod ${modTypeClassForAcronym(ac)}` },
            el("div", {
              class: `mod__icon mod__icon--${safe}`,
              "data-acronym": ac,
            }),
          ),
        );
      }
    }
    return modsInner;
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

  /**
   * @param {Object|null|undefined} score
   * @returns {string}
   */
  function scoreTimestampIso(score) {
    if (!score || typeof score !== "object") return "";
    const raw = score.ended_at || score.created_at || "";
    return typeof raw === "string" ? raw : "";
  }

  async function fetchRecentScoresIncludingFails(userId, mode) {
    try {
      const data = await OsuExpertPlus.api.getUserRecentScores(
        userId,
        mode,
        100,
        0,
        true,
      );
      return Array.isArray(data) ? data : [];
    } catch {
      /* fall through to HTML fetch path */
    }

    const scores = [];
    const limit = 100;
    const maxTotal = 200;
    const maxPages = 8;
    let lastPageKey = "";
    let pageCount = 0;
    for (let offset = 0; ; offset += limit) {
      if (pageCount >= maxPages) {
        break;
      }
      const q = new URLSearchParams({
        mode,
        limit: String(limit),
        offset: String(offset),
        include_fails: "1",
      });
      q.append("include", "beatmap");
      q.append("include", "beatmapset");
      let resp;
      try {
        resp = await fetch(`/users/${userId}/scores/recent?${q}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      } catch {
        break;
      }
      if (!resp.ok) break;
      let body;
      try {
        body = await resp.json();
      } catch {
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
    const out = scores.slice(0, maxTotal);
    return out;
  }

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
    rows.forEach((r) => innerList.appendChild(r));
    applyHideWeightedPp(innerList);
    if (settings.isEnabled(SCORE_PP_DECIMALS_ID)) {
      applyPpDecimals(innerList);
    }
    if (settings.isEnabled(SCORE_HIT_STATISTICS_ID)) {
      processElements(rows, scores);
      enrichPlayDetailRowsMaxComboFromAttributes(rows, scores).catch(() => {});
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
   * @param {string} userId
   * @param {string} mode
   */
  async function tryMountRecentScoresWithFails(userId, mode) {
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

    innerList.textContent = "";
    if (!scores.length) {
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

    const run = () => {
      if (cancelled) return;
      clearTimeout(_recentFailsDebounce);
      _recentFailsDebounce = setTimeout(() => {
        if (cancelled) return;
        tryMountRecentScoresWithFails(userId, mode).catch(() => {});
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
  const RANKS_CARD_BG_URL_VAR = "--oep-ranks-card-bg-url";
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
  const RANKS_PERIOD_LAST_YEAR = 10;

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
   * @returns {number}
   */
  function readStoredRanksPeriodIndex() {
    return RANKS_PERIOD_IDX_DEFAULT;
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
        rowEl.style.removeProperty(RANKS_CARD_BG_URL_VAR);
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

    const periodIdx = readStoredRanksPeriodIndex();
    const reversedStored = false;

    const statusEl = el("strong", { class: "oep-ranks-date-filter__period" });
    const tailEl = el("span", { class: "oep-ranks-date-filter__tail" });
    setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversedStored);

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
        class: `oep-ranks-date-filter__btn oep-ranks-date-filter__reverse${reversedStored ? " oep-ranks-date-filter__reverse--on" : ""}`,
        "aria-pressed": reversedStored ? "true" : "false",
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
      row.style.removeProperty(RANKS_CARD_BG_URL_VAR);
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
        : readStoredRanksPeriodIndex();
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

  const PROFILE_BADGES_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-badges-collapse";
  const PROFILE_BADGES_WRAP_CLASS = "oep-profile-badges-wrap";
  const PROFILE_BADGES_DONE_ATTR = "data-oep-profile-badges-done";
  const PROFILE_BADGES_COLLAPSED_GM_KEY = "userProfile.profileBadgesCollapsed";

  const PROFILE_BADGES_COLLAPSE_CSS = `
    .${PROFILE_BADGES_WRAP_CLASS} {
      position: relative;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed .profile-badges {
      display: none;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed {
      min-height: 36px;
    }
    .oep-profile-badges-toggle {
      position: absolute;
      z-index: 5;
      top: 8px;
      right: 8px;
    }
  `;
  const badgesCollapseStyle = manageStyle(
    PROFILE_BADGES_COLLAPSE_STYLE_ID,
    PROFILE_BADGES_COLLAPSE_CSS,
  );

  function injectProfileBadgesCollapseStyles() {
    badgesCollapseStyle.inject();
  }

  function removeProfileBadgesCollapseStyles() {
    badgesCollapseStyle.remove();
  }

  /**
   * @param {HTMLElement} badgesRoot  .profile-badges
   */
  function enhanceProfileBadgesStrip(badgesRoot) {
    if (badgesRoot.hasAttribute(PROFILE_BADGES_DONE_ATTR)) return;
    if (!badgesRoot.classList.contains("profile-badges")) return;

    const parent = badgesRoot.parentNode;
    if (!parent) return;

    const shell = el("div", { class: PROFILE_BADGES_WRAP_CLASS });
    parent.insertBefore(shell, badgesRoot);
    shell.appendChild(badgesRoot);

    const collapsedStored = Boolean(
      GM_getValue(PROFILE_BADGES_COLLAPSED_GM_KEY, false),
    );
    if (collapsedStored) {
      shell.classList.add(`${PROFILE_BADGES_WRAP_CLASS}--collapsed`);
    }

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "btn-circle oep-profile-badges-toggle",
        "aria-expanded": collapsedStored ? "false" : "true",
        title: collapsedStored ? "Show profile badges" : "Hide profile badges",
      },
      el("span", {
        class: collapsedStored ? "fas fa-chevron-down" : "fas fa-chevron-up",
      }),
    );

    shell.appendChild(toggleBtn);
    badgesRoot.setAttribute(PROFILE_BADGES_DONE_ATTR, "1");

    const applyToggleUi = (collapsed) => {
      const icon = toggleBtn.querySelector(".fas");
      if (icon) {
        icon.className = collapsed
          ? "fas fa-chevron-down"
          : "fas fa-chevron-up";
      }
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleBtn.title = collapsed
        ? "Show profile badges"
        : "Hide profile badges";
    };

    toggleBtn.addEventListener("click", () => {
      const collapsed = shell.classList.toggle(
        `${PROFILE_BADGES_WRAP_CLASS}--collapsed`,
      );
      GM_setValue(PROFILE_BADGES_COLLAPSED_GM_KEY, collapsed);
      applyToggleUi(collapsed);
    });
  }

  function teardownProfileBadgesCollapse() {
    document
      .querySelectorAll(`.${PROFILE_BADGES_WRAP_CLASS}`)
      .forEach((shell) => {
        const badges = shell.querySelector(".profile-badges");
        const shellParent = shell.parentNode;
        if (badges && shellParent) {
          badges.removeAttribute(PROFILE_BADGES_DONE_ATTR);
          shellParent.insertBefore(badges, shell);
        }
        shell.remove();
      });
    removeProfileBadgesCollapseStyles();
  }

  /**
   * @returns {function}
   */
  function startProfileBadgesCollapseManager() {
    injectProfileBadgesCollapseStyles();

    const scan = () => {
      document.querySelectorAll(".profile-badges").forEach((node) => {
        if (
          node instanceof HTMLElement &&
          !node.hasAttribute(PROFILE_BADGES_DONE_ATTR)
        ) {
          enhanceProfileBadgesStrip(node);
        }
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (mutationsIncludeSelector(mutations, ".profile-badges")) scan();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      teardownProfileBadgesCollapse();
    };
  }

  const BBHELP_STYLE_ID = "osu-expertplus-userpage-bbcode-helper";
  const BBHELP_WRAP_CLASS = "oep-bbhelp";
  const BBHELP_ROW_CLASS = "oep-bbhelp__row";
  const BBHELP_BTN_CLASS = "oep-bbhelp__btn";
  const BBHELP_BTN_ICON_CLASS = "oep-bbhelp__btn-icon";
  const BBHELP_BTN_TEXT_CLASS = "oep-bbhelp__btn-text";
  const BBHELP_MODAL_CLASS = "oep-bbhelp-modal";
  const BBHELP_EDITOR_ID_ATTR = "data-oep-bbhelp-editor-id";
  const BBHELP_WRAP_FOR_ATTR = "data-oep-bbhelp-for";
  const BBHELP_DONE_ATTR = "data-oep-bbhelp";
  const BBHELP_CHECKER_DONE_ATTR = "data-oep-bbhelp-checker";
  const BBHELP_PREVIEW_DONE_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_TOGGLE_ATTR = "data-oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_BODY_CLASS = "oep-bbhelp-preview__body";
  const BBHELP_PREVIEW_TOGGLE_CLASS = "oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_CLASS = "oep-bbhelp-preview";
  const BBHELP_PREVIEW_TITLE_CLASS = "oep-bbhelp-preview__title";
  const BBHELP_PREVIEW_EMPTY_CLASS = "oep-bbhelp-preview__empty";
  const BBHELP_WARN_CLASS = "oep-bbhelp-warn";
  const BBHELP_EDITOR_SELECTOR = ".bbcode-editor";
  const BBHELP_INPUT_SELECTOR = "textarea";

  const BBHELP_CSS = `
    .${BBHELP_WRAP_CLASS} {
      margin: 0 0 10px;
      display: block;
    }
    .${BBHELP_ROW_CLASS} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .${BBHELP_BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.9);
      font: inherit;
      font-weight: 600;
      font-size: 12px;
      line-height: 1;
      padding: 6px 8px;
      cursor: pointer;
    }
    .${BBHELP_BTN_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(255, 255, 255, 0.1);
    }
    .${BBHELP_BTN_ICON_CLASS} {
      width: 12px;
      text-align: center;
      opacity: 0.92;
    }
    .${BBHELP_BTN_TEXT_CLASS} {
      white-space: nowrap;
    }
    .${BBHELP_MODAL_CLASS} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
    .${BBHELP_MODAL_CLASS}__card {
      width: min(420px, 100%);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: #1f1f2a;
      color: rgba(255, 255, 255, 0.95);
      padding: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS}__title {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 700;
    }
    .${BBHELP_MODAL_CLASS}__modes {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .${BBHELP_MODAL_CLASS}__field {
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS}__hint {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_MODAL_CLASS} select,
    .${BBHELP_MODAL_CLASS} input[type="number"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS}__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn {
      margin-right: auto;
      min-width: 0;
      max-width: 100%;
      font-size: 12px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.62);
    }
    .${BBHELP_MODAL_CLASS}__actions-warn:empty {
      display: none;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn--error {
      color: rgba(255, 196, 120, 0.95);
    }
    .${BBHELP_MODAL_CLASS}__actions-btns {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }
    .${BBHELP_MODAL_CLASS} .${BBHELP_BTN_CLASS}:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .${BBHELP_MODAL_CLASS}__color-grid {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS} input[type="color"] {
      width: 56px;
      height: 36px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    .${BBHELP_MODAL_CLASS} input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS} textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 8px;
      line-height: 1.4;
    }
    .${BBHELP_MODAL_CLASS}__swatch {
      width: 100%;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: #ff66aa;
      margin-top: 8px;
    }
    .${BBHELP_WARN_CLASS} {
      margin-top: 8px;
      border-left: 3px solid #f0ad4e;
      background: rgba(240, 173, 78, 0.12);
      color: #ffd28a;
      font-size: 12px;
      line-height: 1.35;
      padding: 6px 8px;
    }
    .${BBHELP_WARN_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS} {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.92);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 9px;
      cursor: pointer;
      margin-right: 8px;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.32);
      background: rgba(255, 255, 255, 0.14);
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}[aria-pressed="true"] {
      border-color: rgba(255, 255, 255, 0.38);
      background: rgba(255, 255, 255, 0.2);
    }
    .${BBHELP_PREVIEW_CLASS} {
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px;
      color: rgba(255, 255, 255, 0.9);
    }
    .${BBHELP_PREVIEW_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TITLE_CLASS} {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} {
      line-height: 1.55;
      word-break: break-word;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p {
      margin: 0 0 0.7em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} blockquote {
      margin: 0 0 0.7em;
      padding-left: 0.8em;
      border-left: 3px solid rgba(255, 255, 255, 0.26);
      color: rgba(255, 255, 255, 0.82);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoilerbox {
      margin: 0 0 0.65em;
      border: none;
      border-radius: 0;
      background: transparent;
      overflow: visible;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary {
      cursor: pointer;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2em 0.35em;
      list-style: none;
      margin: 0;
      padding: 0;
      max-width: 100%;
      font-weight: 700;
      color: hsl(var(--hsl-l2));
      background: none;
      border: none;
      -webkit-appearance: none;
      appearance: none;
      outline: none;
      text-align: left;
      width: max-content;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary:hover {
      color: hsl(var(--hsl-l1));
      text-decoration: underline;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoiler-summary::-webkit-details-marker {
      display: none;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon {
      display: block;
      flex: none;
      width: 1.1em;
      text-align: center;
      line-height: 1;
      opacity: 0.9;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon::before {
      display: inline-block;
      font-family: "Font Awesome 5 Free", "Font Awesome 6 Free", sans-serif;
      font-weight: 900;
      content: "\\f105";
      font-size: 0.95em;
      transition: transform 0.12s ease;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoilerbox[open]
      .oep-bbhelp-preview__spoiler-icon::before {
      content: "\\f107";
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-label {
      overflow-wrap: anywhere;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body {
      margin-top: 10px;
      padding-left: 20px;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body > p:first-child {
      margin-top: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary--icon-only {
      min-width: 1.25em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice {
      margin: 0 0 0.7em;
      padding: 10px 12px;
      border: 1px solid hsl(var(--hsl-h1));
      border-radius: 6px;
      background: hsl(var(--hsl-b4));
      color: hsl(var(--hsl-c1));
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice > p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre,
    .${BBHELP_PREVIEW_BODY_CLASS} code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.92em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre {
      margin: 0 0 0.7em;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.25);
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} ul,
    .${BBHELP_PREVIEW_BODY_CLASS} ol {
      margin: 0 0 0.7em;
      padding-left: 1.35em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} img {
      max-width: min(100%, 520px);
      height: auto;
      border-radius: 4px;
      display: block;
      margin: 0.3em 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap {
      margin: 0 0 0.7em;
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.16);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap-meta {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.4;
    }
    .${BBHELP_PREVIEW_EMPTY_CLASS} {
      color: rgba(255, 255, 255, 0.62);
      font-style: italic;
      margin: 0;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect {
      position: absolute;
      box-sizing: border-box;
      border: 2px solid rgba(255, 180, 0, 0.85);
      background: rgba(255, 180, 0, 0.14);
      pointer-events: auto;
      cursor: pointer;
      border-radius: 2px;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--selected {
      border-color: rgba(120, 200, 255, 0.95);
      background: rgba(120, 200, 255, 0.2);
      box-shadow: 0 0 0 1px rgba(120, 200, 255, 0.45);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-row--selected {
      border-color: rgba(120, 200, 255, 0.55) !important;
      background: rgba(120, 200, 255, 0.1) !important;
      box-shadow: inset 0 0 0 1px rgba(120, 200, 255, 0.25);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--movable {
      cursor: move;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle {
      position: absolute;
      width: 11px;
      height: 11px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.95);
      background: rgba(120, 200, 255, 0.95);
      border-radius: 2px;
      z-index: 2;
      pointer-events: auto;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--nw {
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--ne {
      left: 100%;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--sw {
      left: 0;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--se {
      left: 100%;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
  `;

  const bbcodeStyle = manageStyle(BBHELP_STYLE_ID, BBHELP_CSS);

  function injectBbcodeHelperStyles() {
    bbcodeStyle.inject();
  }

  function removeBbcodeHelperStyles() {
    bbcodeStyle.remove();
  }

  function _replaceTextareaRange(textarea, from, to, replacement) {
    textarea.focus();
    textarea.setSelectionRange(from, to);
    let usedNativeUndoPath = false;
    try {
      if (typeof document.execCommand === "function") {
        usedNativeUndoPath = document.execCommand(
          "insertText",
          false,
          replacement,
        );
      }
    } catch (_) {}
    if (!usedNativeUndoPath) {
      textarea.setRangeText(replacement, from, to, "end");
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function _toggleBbcodeWrap(textarea, openTag, closeTag) {
    const value = textarea.value || "";
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const hasSelection = end > start;

    const selected = value.slice(start, end);
    const selectedIsWrapped =
      selected.startsWith(openTag) && selected.endsWith(closeTag);
    const aroundSelectionIsWrapped =
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(end, end + closeTag.length) === closeTag;
    const aroundCursorIsWrapped =
      !hasSelection &&
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(start, start + closeTag.length) === closeTag;

    let nextStart = start;
    let nextEnd = end;

    if (hasSelection && selectedIsWrapped) {
      const inner = selected.slice(
        openTag.length,
        selected.length - closeTag.length,
      );
      _replaceTextareaRange(textarea, start, end, inner);
      nextEnd = start + inner.length;
    } else if (hasSelection && aroundSelectionIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        end + closeTag.length,
        selected,
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart + selected.length;
    } else if (aroundCursorIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        start + closeTag.length,
        "",
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart;
    } else {
      _replaceTextareaRange(
        textarea,
        start,
        end,
        `${openTag}${selected}${closeTag}`,
      );
      if (hasSelection) {
        nextStart = start + openTag.length;
        nextEnd = nextStart + selected.length;
      } else {
        nextStart = start + openTag.length;
        nextEnd = nextStart;
      }
    }

    textarea.setSelectionRange(nextStart, nextEnd);
  }

  function _openColorPicker(textarea) {
    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font color",
    );

    const colorInput = el("input", {
      type: "color",
      value: "#ff66aa",
      "aria-label": "Pick a color",
    });
    const textInput = el("input", {
      type: "text",
      value: "#ff66aa",
      placeholder: "#RRGGBB or color name",
      "aria-label": "Color value",
    });
    const swatch = el("div", { class: `${BBHELP_MODAL_CLASS}__swatch` });
    const colorGrid = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__color-grid` },
      colorInput,
      textInput,
    );
    const hint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint` },
      "Use picker for hex color, or type a color name (e.g. red).",
    );

    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const updateSwatch = () => {
      const v = String(textInput.value || "").trim();
      swatch.style.background = v || "#ff66aa";
    };
    const close = () => overlay.remove();
    const apply = () => {
      const value = String(textInput.value || "").trim();
      if (!value) return;
      _toggleBbcodeWrap(textarea, `[color=${value}]`, "[/color]");
      close();
    };

    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      updateSwatch();
    });
    textInput.addEventListener("input", updateSwatch);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(colorGrid);
    card.appendChild(swatch);
    card.appendChild(hint);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    textInput.focus();
    textInput.select();
    updateSwatch();
  }

  function _openSizePicker(textarea) {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const modeName = `oep-size-mode-${uid}`;
    const modePresetId = `oep-size-mode-preset-${uid}`;
    const modeManualId = `oep-size-mode-manual-${uid}`;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font size",
    );
    const modeWrap = el("div", { class: `${BBHELP_MODAL_CLASS}__modes` });

    const presetRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modePresetId,
      value: "preset",
      checked: "checked",
    });
    const manualRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modeManualId,
      value: "manual",
    });
    modeWrap.appendChild(
      el(
        "label",
        { for: modePresetId },
        presetRadio,
        " Preset (tiny/small/normal/large)",
      ),
    );
    modeWrap.appendChild(
      el("label", { for: modeManualId }, manualRadio, " Manual number"),
    );

    const presetField = el("div", { class: `${BBHELP_MODAL_CLASS}__field` });
    const presetSelect = el(
      "select",
      {},
      el("option", { value: "tiny" }, "tiny"),
      el("option", { value: "small" }, "small"),
      el("option", { value: "normal", selected: "selected" }, "normal"),
      el("option", { value: "large" }, "large"),
    );
    presetField.appendChild(presetSelect);

    const manualField = el("div", {
      class: `${BBHELP_MODAL_CLASS}__field`,
      style: "display:none;",
    });
    const manualInput = el("input", {
      type: "number",
      min: "30",
      max: "200",
      step: "1",
      value: "100",
      placeholder: "30 - 200",
    });
    manualField.appendChild(manualInput);
    manualField.appendChild(
      el("div", { class: `${BBHELP_MODAL_CLASS}__hint` }, "Range: 30-200"),
    );

    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const close = () => overlay.remove();
    const syncMode = () => {
      const isPreset = presetRadio.checked;
      presetField.style.display = isPreset ? "" : "none";
      manualField.style.display = isPreset ? "none" : "";
      if (isPreset) presetSelect.focus();
      else manualInput.focus();
    };
    const apply = () => {
      const sizeValue = presetRadio.checked
        ? String(presetSelect.value || "").trim()
        : String(
            Math.max(
              30,
              Math.min(200, Math.round(Number(manualInput.value) || 0)),
            ),
          );
      if (!sizeValue || sizeValue === "0") return;
      _toggleBbcodeWrap(textarea, `[size=${sizeValue}]`, "[/size]");
      close();
    };

    presetRadio.addEventListener("change", syncMode);
    manualRadio.addEventListener("change", syncMode);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(modeWrap);
    card.appendChild(presetField);
    card.appendChild(manualField);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    syncMode();
  }

  function _openImagemapHelper(textarea) {
    // State
    const hotspots = []; // { x, y, w, h, url, title }
    let imgLoaded = false;
    let drawState = null; // { startX, startY, rectEl } — active drag
    let selectedHotspotIndex = -1;
    /** @type {null | { index: number, sx: number, sy: number }} */
    let pendingRectPick = null;
    /**
     * @type {null | {
     *   type: 'move' | 'resize';
     *   index: number;
     *   corner?: string;
     *   startPt: { x: number; y: number };
     *   startHs: { x: number; y: number; w: number; h: number };
     *   rectEl: HTMLElement;
     * }}
     */
    let modifyState = null;
    const IMAP_DRAG_THRESHOLD_PX = 5;
    const IMAP_MIN_RECT_PCT = 1;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", {
      class: `${BBHELP_MODAL_CLASS}__card`,
      style:
        "width:min(700px,96vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;",
    });

    const titleRow = el("div", {
      style:
        "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;",
    });
    const titleEl = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title`, style: "margin:0;" },
      "ImageMap Helper",
    );
    const importFromEditorBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title:
          "Auto: replace state from an [imagemap] block in the BBCode editor (uses selection if any, otherwise full text)",
      },
      "Import from editor",
    );
    const importManualBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Show a field to paste [imagemap] BBCode manually",
      },
      "Manual import",
    );
    const importBtnsWrap = el(
      "div",
      {
        style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;",
      },
      importFromEditorBtn,
      importManualBtn,
    );
    titleRow.appendChild(titleEl);
    titleRow.appendChild(importBtnsWrap);

    let manualImportOpen = false;
    const manualImportPanel = el("div", {
      style: "display:none;flex-direction:column;gap:8px;",
    });
    const manualImportHint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint`, style: "margin:0;" },
      "Paste a full [imagemap]…[/imagemap] block. Tags are required so the parser can find the body.",
    );
    const manualImportTa = el("textarea", {
      rows: 10,
      style:
        "min-height:140px;resize:vertical;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;",
      "aria-label": "Manual imagemap BBCode",
      placeholder:
        "[imagemap]\nhttps://example.com/image.png\n0 0 25 25 https://osu.ppy.sh\n[/imagemap]",
    });
    const manualImportActions = el("div", {
      style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;",
    });
    const manualImportApplyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply pasted import",
    );
    const manualImportCloseBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Close",
    );
    manualImportActions.appendChild(manualImportApplyBtn);
    manualImportActions.appendChild(manualImportCloseBtn);
    manualImportPanel.appendChild(manualImportHint);
    manualImportPanel.appendChild(manualImportTa);
    manualImportPanel.appendChild(manualImportActions);

    // Image URL row
    const urlInput = el("input", {
      type: "text",
      placeholder: "https://i.ppy.sh/... (base image URL)",
      style: "flex:1;min-width:0;",
      "aria-label": "Base image URL",
    });
    const loadBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Load",
    );
    const urlRow = el(
      "div",
      { style: "display:flex;gap:6px;" },
      urlInput,
      loadBtn,
    );

    // Image preview + drawing layer.
    // Border/background live on imgWrap; imgStage (no border) shrink-wraps the
    // img so drawLayer inset:0 matches the bitmap box. BBCode % = that box.
    const imgEl = el("img", {
      alt: "",
      referrerpolicy: "no-referrer",
      style:
        "display:none;max-width:100%;height:auto;vertical-align:top;pointer-events:none;user-select:none;border-radius:3px;",
    });
    const drawLayer = el("div", {
      style:
        "position:absolute;inset:0;cursor:crosshair;display:none;touch-action:none;",
    });
    const imgStage = el(
      "div",
      {
        style:
          "position:relative;display:inline-block;line-height:0;max-width:100%;vertical-align:top;",
      },
      imgEl,
      drawLayer,
    );
    const imgPlaceholder = el(
      "div",
      {
        style:
          "font-size:12px;opacity:0.45;padding:16px;text-align:center;pointer-events:none;",
      },
      "Image will appear here after loading",
    );
    const imgWrap = el(
      "div",
      {
        style:
          "display:inline-block;max-width:100%;vertical-align:top;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;",
      },
      imgPlaceholder,
      imgStage,
    );
    const imgScrollSection = el("div", {
      style:
        "min-height:0;flex-shrink:1;align-self:stretch;width:100%;max-height:min(48vh,480px);overflow:auto;border-radius:4px;text-align:center;padding:2px;box-sizing:border-box;",
    });
    imgScrollSection.appendChild(imgWrap);

    const hotspotListEl = el("div", {
      style: "display:flex;flex-direction:column;gap:5px;",
    });

    function formatBbcodeForSingleLineDisplay(multiline) {
      if (!multiline) return "";
      return String(multiline).replace(/\r?\n/g, " ").trim();
    }

    const codeEl = el("div", {
      role: "textbox",
      "aria-readonly": "true",
      "aria-label": "Generated BBCode preview",
      style:
        "flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.14);border-radius:4px;padding:8px 10px;font-size:11px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,0.9);text-align:left;",
    });
    const copyCodeBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Copy full BBCode (with line breaks) to clipboard",
        style: "flex-shrink:0;align-self:stretch;",
      },
      "Copy",
    );
    const codeRow = el(
      "div",
      {
        style:
          "display:flex;align-items:stretch;gap:8px;min-width:0;width:100%;",
      },
      codeEl,
      copyCodeBtn,
    );

    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const insertBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Insert into editor",
    );
    const actionsWarn = el("div", {
      class: `${BBHELP_MODAL_CLASS}__actions-warn`,
      role: "status",
    });
    const actionsBtns = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions-btns` },
      cancelBtn,
      insertBtn,
    );
    const actions = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions` },
      actionsWarn,
      actionsBtns,
    );

    // osu-web BBCodeFromDB::parseImagemap only matches link lines when the URL is
    // `#`, `http(s)://…` (no spaces), or `mailto:…` — see ppy/osu-web.

    function formatImapPct(v) {
      const n = Math.max(0, Math.min(100, Number(v)));
      const r = Math.round(n * 100) / 100;
      return String(r.toFixed(2)).replace(/\.?0+$/, "");
    }

    function normalizeImapLinkUrlForOsu(raw) {
      const u = String(raw || "").trim();
      if (!u) return null;
      if (u === "#") return "#";
      if (/^https?:\/\/\S+$/i.test(u)) return u;
      if (/^mailto:\S+$/i.test(u)) return u;
      if (u.startsWith("//")) return `https:${u}`;
      if (u.startsWith("/")) return `https://osu.ppy.sh${u}`;
      return null;
    }

    function parseImagemapFromText(text) {
      const m = String(text || "").match(
        /\[imagemap\]\s*([\s\S]*?)\s*\[\/imagemap\]/i,
      );
      if (!m) return null;
      const rawBody = m[1].replace(/\r\n/g, "\n").trim();
      if (!rawBody) return null;
      const lines = rawBody
        .split("\n")
        .map((l) => l.trim())
        .filter((ln) => ln.length > 0);
      if (!lines.length) return null;
      const imageUrl = lines[0];
      const areas = [];
      for (let li = 1; li < lines.length; li++) {
        const line = lines[li];
        const rm = line.match(
          /^([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+(\S+)(?:\s+(.*))?$/,
        );
        if (!rm) continue;
        const x = Number(rm[1]);
        const y = Number(rm[2]);
        const w = Number(rm[3]);
        const h = Number(rm[4]);
        if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
        areas.push({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
          w: Math.max(0, Math.min(100, w)),
          h: Math.max(0, Math.min(100, h)),
          url: rm[5],
          title: (rm[6] || "").trim(),
        });
      }
      return { imageUrl, areas };
    }

    function applyParsedImagemap(parsed) {
      hotspots.length = 0;
      parsed.areas.forEach((ar) => hotspots.push({ ...ar }));
      urlInput.value = parsed.imageUrl;
      selectedHotspotIndex = -1;
      rebuildHotspotList();
      renderOverlayRects();
      refreshCode();
      loadImage();
    }

    function setManualImportOpen(open) {
      manualImportOpen = open;
      manualImportPanel.style.display = open ? "flex" : "none";
      importManualBtn.textContent = open
        ? "Hide manual import"
        : "Manual import";
      if (open) manualImportTa.focus();
    }

    function setSelectedIndex(i) {
      const next = i >= 0 && i < hotspots.length ? i : -1;
      if (next !== selectedHotspotIndex) {
        selectedHotspotIndex = next;
        renderOverlayRects();
        return;
      }
      selectedHotspotIndex = next;
      syncSelectionVisuals();
    }

    function syncSelectionVisuals() {
      hotspotListEl.querySelectorAll("[data-oep-imap-row]").forEach((row) => {
        const idx = Number(row.getAttribute("data-oep-imap-row"));
        row.classList.toggle(
          "oep-imap-row--selected",
          idx === selectedHotspotIndex,
        );
      });
      drawLayer.querySelectorAll("[data-oep-imap-rect]").forEach((el) => {
        const idx = Number(el.getAttribute("data-oep-imap-rect"));
        el.classList.toggle(
          "oep-imap-rect--selected",
          idx === selectedHotspotIndex,
        );
      });
    }

    function focusHotspotUrlInput(index) {
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(index)}"]`,
      );
      if (!(row instanceof HTMLElement)) return;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const urlField = row.querySelector("input[data-oep-imap-url]");
      if (urlField instanceof HTMLInputElement) {
        urlField.focus();
        urlField.select();
      }
    }

    function generateBbcode() {
      const imgUrl = String(urlInput.value || "").trim();
      if (!imgUrl) return "";
      const valid = hotspots
        .map((hs) => ({
          hs,
          link: normalizeImapLinkUrlForOsu(hs.url),
        }))
        .filter((o) => o.link);
      if (!valid.length) return "";
      const lines = [imgUrl];
      valid.forEach(({ hs, link }) => {
        const { x, y, w, h, title } = hs;
        let line = `${formatImapPct(x)} ${formatImapPct(y)} ${formatImapPct(w)} ${formatImapPct(h)} ${link}`;
        const t = String(title || "").trim();
        if (t) line += ` ${t}`;
        lines.push(line);
      });
      return `[imagemap]\n${lines.join("\n")}\n[/imagemap]`;
    }

    copyCodeBtn.addEventListener("click", async () => {
      const text = generateBbcode();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px;top:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch (_) {
          return;
        }
      }
      const prev = copyCodeBtn.textContent;
      copyCodeBtn.textContent = "Copied!";
      window.setTimeout(() => {
        copyCodeBtn.textContent = prev;
      }, 1600);
    });

    function refreshCode() {
      const code = generateBbcode();
      insertBtn.disabled = !code;
      actionsWarn.classList.remove(
        `${BBHELP_MODAL_CLASS}__actions-warn--error`,
      );
      if (code) {
        codeEl.textContent = formatBbcodeForSingleLineDisplay(code);
        copyCodeBtn.disabled = false;
        actionsWarn.textContent = "";
        return;
      }
      codeEl.textContent = "";
      copyCodeBtn.disabled = true;
      const imgUrl = String(urlInput.value || "").trim();
      const anyArea = hotspots.length > 0;
      const anyTextUrl = hotspots.some((hs) => String(hs.url || "").trim());
      const accepted = hotspots.some((hs) =>
        normalizeImapLinkUrlForOsu(hs.url),
      );
      if (anyArea && anyTextUrl && !accepted) {
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "osu! rejects these URLs — use https://…, mailto:…, #, //…, or a path like /users/123.";
        return;
      }
      actionsWarn.textContent =
        "Add an image URL, load it, draw areas, and set a valid link on each row to enable insert.";
    }

    function clampImapRect(o, minSz = IMAP_MIN_RECT_PCT) {
      let x = o.x;
      let y = o.y;
      let w = Math.max(minSz, o.w);
      let h = Math.max(minSz, o.h);
      x = Math.max(0, Math.min(100 - w, x));
      y = Math.max(0, Math.min(100 - h, y));
      if (x + w > 100) w = 100 - x;
      if (y + h > 100) h = 100 - y;
      w = Math.max(minSz, w);
      h = Math.max(minSz, h);
      return { x, y, w, h };
    }

    function computeResizeRect(corner, s, pt, minSz = IMAP_MIN_RECT_PCT) {
      const px = Math.max(0, Math.min(100, pt.x));
      const py = Math.max(0, Math.min(100, pt.y));
      const rx = s.x + s.w;
      const by = s.y + s.h;
      let x = s.x;
      let y = s.y;
      let w = s.w;
      let h = s.h;
      if (corner === "se") {
        x = s.x;
        y = s.y;
        w = px - x;
        h = py - y;
      } else if (corner === "nw") {
        w = Math.max(minSz, rx - px);
        h = Math.max(minSz, by - py);
        x = rx - w;
        y = by - h;
      } else if (corner === "ne") {
        x = s.x;
        y = Math.min(py, by - minSz);
        w = Math.max(minSz, px - x);
        h = by - y;
      } else if (corner === "sw") {
        x = Math.min(px, rx - minSz);
        y = s.y;
        w = rx - x;
        h = Math.max(minSz, py - y);
      }
      return clampImapRect({ x, y, w, h }, minSz);
    }

    function applyHsToRectEl(rectEl, hs) {
      Object.assign(rectEl.style, {
        left: `${formatImapPct(hs.x)}%`,
        top: `${formatImapPct(hs.y)}%`,
        width: `${formatImapPct(hs.w)}%`,
        height: `${formatImapPct(hs.h)}%`,
      });
    }

    function updateRowCoordBadge(i) {
      const hs = hotspots[i];
      if (!hs) return;
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(i)}"]`,
      );
      const badge = row?.querySelector("[data-oep-imap-coords]");
      if (badge) {
        badge.textContent = `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`;
      }
    }

    function finishModifyGesture() {
      modifyState = null;
      pendingRectPick = null;
      renderOverlayRects();
      rebuildHotspotList();
      refreshCode();
    }

    function onModifyMouseMove(ev) {
      if (!modifyState || !imgLoaded) return;
      const bounds = imgEl.getBoundingClientRect();
      const pt = pctRawFromEvent(ev, bounds);
      if (!pt) return;
      const hs = hotspots[modifyState.index];
      if (!hs) return;
      if (modifyState.type === "move") {
        const dx = pt.x - modifyState.startPt.x;
        const dy = pt.y - modifyState.startPt.y;
        const next = clampImapRect({
          x: modifyState.startHs.x + dx,
          y: modifyState.startHs.y + dy,
          w: modifyState.startHs.w,
          h: modifyState.startHs.h,
        });
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      } else if (modifyState.type === "resize" && modifyState.corner) {
        const next = computeResizeRect(
          modifyState.corner,
          modifyState.startHs,
          pt,
        );
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      }
    }

    function renderOverlayRects() {
      Array.from(drawLayer.querySelectorAll(".oep-imap-rect")).forEach((n) =>
        n.remove(),
      );
      hotspots.forEach((hs, i) => {
        const isSel = i === selectedHotspotIndex;
        const rectEl = el("div", {
          class: `oep-imap-rect${isSel ? " oep-imap-rect--movable" : ""}`,
          "data-oep-imap-rect": String(i),
          style: `left:${formatImapPct(hs.x)}%;top:${formatImapPct(hs.y)}%;width:${formatImapPct(hs.w)}%;height:${formatImapPct(hs.h)}%;`,
        });
        rectEl.addEventListener("mousedown", (ev) => {
          if (ev.button !== 0) return;
          if (
            ev.target instanceof Element &&
            ev.target.closest(".oep-imap-handle")
          ) {
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
          setSelectedIndex(i);
          pendingRectPick = {
            index: i,
            sx: ev.clientX,
            sy: ev.clientY,
          };
        });
        if (isSel) {
          for (const corner of ["nw", "ne", "sw", "se"]) {
            const handle = el("div", {
              class: `oep-imap-handle oep-imap-handle--${corner}`,
              "data-oep-corner": corner,
            });
            handle.addEventListener("mousedown", (ev) => {
              if (ev.button !== 0) return;
              ev.preventDefault();
              ev.stopPropagation();
              pendingRectPick = null;
              setSelectedIndex(i);
              modifyState = {
                type: "resize",
                index: i,
                corner,
                startPt: pctRawFromEvent(ev, imgEl.getBoundingClientRect()) ?? {
                  x: 0,
                  y: 0,
                },
                startHs: {
                  x: hs.x,
                  y: hs.y,
                  w: hs.w,
                  h: hs.h,
                },
                rectEl,
              };
            });
            rectEl.appendChild(handle);
          }
        }
        drawLayer.appendChild(rectEl);
      });
      syncSelectionVisuals();
    }

    function buildHotspotRow(hs, index) {
      const indexBadge = el(
        "span",
        {
          style:
            "font-size:11px;font-weight:700;opacity:0.6;min-width:1.6em;text-align:right;flex-shrink:0;",
        },
        `#${index + 1}`,
      );
      const coordBadge = el(
        "span",
        {
          style:
            "font-size:10px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;opacity:0.55;white-space:nowrap;flex-shrink:0;",
          "data-oep-imap-coords": "1",
        },
        `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`,
      );
      const urlIn = el("input", {
        type: "text",
        placeholder: "https://… or /users/… or #",
        value: hs.url || "",
        style: "flex:1;min-width:0;",
        "aria-label": `Area ${index + 1} URL`,
        "data-oep-imap-url": "1",
      });
      urlIn.addEventListener("input", () => {
        hs.url = urlIn.value;
        refreshCode();
      });
      urlIn.addEventListener("focus", () => setSelectedIndex(index));
      const titleIn = el("input", {
        type: "text",
        placeholder: "Title (optional)",
        value: hs.title || "",
        style: "width:130px;flex-shrink:0;",
        "aria-label": `Area ${index + 1} title`,
      });
      titleIn.addEventListener("input", () => {
        hs.title = titleIn.value;
        refreshCode();
      });
      titleIn.addEventListener("focus", () => setSelectedIndex(index));
      const removeBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Remove area",
          style: "padding:4px 7px;flex-shrink:0;",
        },
        "✕",
      );
      removeBtn.addEventListener("click", () => {
        const i = hotspots.indexOf(hs);
        if (i !== -1) hotspots.splice(i, 1);
        if (selectedHotspotIndex === i) selectedHotspotIndex = -1;
        else if (selectedHotspotIndex > i) selectedHotspotIndex -= 1;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
      });
      const row = el(
        "div",
        {
          class: "oep-imap-row",
          "data-oep-imap-row": String(index),
          style:
            "display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:6px 8px;",
        },
        indexBadge,
        coordBadge,
        urlIn,
        titleIn,
        removeBtn,
      );
      row.addEventListener("mousedown", (ev) => {
        const t = ev.target;
        if (t instanceof Element && t.closest("button")) return;
        if (t === urlIn || t === titleIn) return;
        setSelectedIndex(index);
        requestAnimationFrame(() => focusHotspotUrlInput(index));
      });
      return row;
    }

    function rebuildHotspotList() {
      while (hotspotListEl.firstChild)
        hotspotListEl.removeChild(hotspotListEl.firstChild);
      if (!hotspots.length) {
        hotspotListEl.appendChild(
          el(
            "div",
            { style: "font-size:12px;opacity:0.5;font-style:italic;" },
            "No areas yet — click and drag on the image above to add one.",
          ),
        );
        return;
      }
      hotspots.forEach((hs, i) =>
        hotspotListEl.appendChild(buildHotspotRow(hs, i)),
      );
      syncSelectionVisuals();
    }

    function pctRawFromEvent(ev, bounds) {
      if (!bounds.width || !bounds.height) return null;
      return {
        x: ((ev.clientX - bounds.left) / bounds.width) * 100,
        y: ((ev.clientY - bounds.top) / bounds.height) * 100,
      };
    }

    /** Intersect drag box (two corners, possibly outside 0–100%) with the image. */
    function selectionRectFromDragPct(sx, sy, ex, ey) {
      const xLo = Math.min(sx, ex);
      const xHi = Math.max(sx, ex);
      const yLo = Math.min(sy, ey);
      const yHi = Math.max(sy, ey);
      const cxLo = Math.max(0, Math.min(100, xLo));
      const cxHi = Math.max(0, Math.min(100, xHi));
      const cyLo = Math.max(0, Math.min(100, yLo));
      const cyHi = Math.max(0, Math.min(100, yHi));
      return {
        x: cxLo,
        y: cyLo,
        w: Math.max(0, cxHi - cxLo),
        h: Math.max(0, cyHi - cyLo),
      };
    }

    drawLayer.addEventListener("mousedown", (ev) => {
      if (!imgLoaded) return;
      ev.preventDefault();
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const rectEl = el("div", {
        style:
          "position:absolute;box-sizing:border-box;border:2px dashed rgba(255,255,0,0.9);background:rgba(255,255,0,0.1);pointer-events:none;left:0;top:0;width:0;height:0;",
      });
      drawLayer.appendChild(rectEl);
      drawState = { startX: raw.x, startY: raw.y, rectEl };
    });

    const onGlobalMouseMove = (ev) => {
      if (modifyState) {
        onModifyMouseMove(ev);
        return;
      }
      if (pendingRectPick) {
        const d = Math.hypot(
          ev.clientX - pendingRectPick.sx,
          ev.clientY - pendingRectPick.sy,
        );
        if (d > IMAP_DRAG_THRESHOLD_PX) {
          const pi = pendingRectPick.index;
          const bounds = imgEl.getBoundingClientRect();
          const startPt = pctRawFromEvent(
            { clientX: pendingRectPick.sx, clientY: pendingRectPick.sy },
            bounds,
          );
          const rEl = drawLayer.querySelector(
            `[data-oep-imap-rect="${String(pi)}"]`,
          );
          if (startPt && rEl instanceof HTMLElement && hotspots[pi]) {
            modifyState = {
              type: "move",
              index: pi,
              startPt,
              startHs: {
                x: hotspots[pi].x,
                y: hotspots[pi].y,
                w: hotspots[pi].w,
                h: hotspots[pi].h,
              },
              rectEl: rEl,
            };
          }
          pendingRectPick = null;
        }
        return;
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        raw.x,
        raw.y,
      );
      Object.assign(drawState.rectEl.style, {
        left: `${r.x}%`,
        top: `${r.y}%`,
        width: `${r.w}%`,
        height: `${r.h}%`,
      });
    };

    const onGlobalMouseUp = (ev) => {
      if (modifyState) {
        finishModifyGesture();
      } else if (pendingRectPick) {
        const idx = pendingRectPick.index;
        pendingRectPick = null;
        requestAnimationFrame(() => focusHotspotUrlInput(idx));
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw =
        bounds.width && bounds.height ? pctRawFromEvent(ev, bounds) : null;
      const endX = raw ? raw.x : drawState.startX;
      const endY = raw ? raw.y : drawState.startY;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        endX,
        endY,
      );
      drawState.rectEl.remove();
      drawState = null;
      if (r.w > 1 && r.h > 1) {
        hotspots.push({ x: r.x, y: r.y, w: r.w, h: r.h, url: "", title: "" });
        const newIdx = hotspots.length - 1;
        selectedHotspotIndex = newIdx;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
        requestAnimationFrame(() => focusHotspotUrlInput(newIdx));
      }
    };

    document.addEventListener("mousemove", onGlobalMouseMove);
    document.addEventListener("mouseup", onGlobalMouseUp);

    const loadImage = () => {
      const safe = _sanitizeHttpPreviewUrl(String(urlInput.value || "").trim());
      if (!safe) {
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent =
          "Invalid URL — must start with http:// or https://.";
        return;
      }
      imgLoaded = false;
      imgEl.style.display = "none";
      drawLayer.style.display = "none";
      imgPlaceholder.style.display = "";
      imgPlaceholder.textContent = "Loading…";
      imgEl.onload = () => {
        imgLoaded = true;
        imgPlaceholder.style.display = "none";
        imgEl.style.display = "block";
        // drawLayer is inset:0 over imgEl — show it only after imgEl is visible
        // so its bounding rect is correct from the first mousedown.
        drawLayer.style.display = "";
        refreshCode();
      };
      imgEl.onerror = () => {
        imgLoaded = false;
        imgEl.style.display = "none";
        drawLayer.style.display = "none";
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent = "Could not load image.";
      };
      imgEl.src = safe;
    };

    loadBtn.addEventListener("click", loadImage);
    urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") loadImage();
    });
    urlInput.addEventListener("input", refreshCode);

    importFromEditorBtn.addEventListener("click", () => {
      const v = textarea.value;
      const a = textarea.selectionStart ?? 0;
      const b = textarea.selectionEnd ?? a;
      const sel = a !== b ? v.slice(a, b) : "";
      let parsed = parseImagemapFromText(sel);
      if (!parsed) parsed = parseImagemapFromText(v);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "No [imagemap]…[/imagemap] block found in the selection or editor text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    importManualBtn.addEventListener("click", () => {
      setManualImportOpen(!manualImportOpen);
    });
    manualImportCloseBtn.addEventListener("click", () => {
      setManualImportOpen(false);
    });
    manualImportApplyBtn.addEventListener("click", () => {
      const parsed = parseImagemapFromText(manualImportTa.value);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "Could not parse [imagemap]…[/imagemap] from the pasted text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    const close = () => {
      document.removeEventListener("mousemove", onGlobalMouseMove);
      document.removeEventListener("mouseup", onGlobalMouseUp);
      overlay.remove();
    };

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (manualImportOpen) {
        setManualImportOpen(false);
        ev.stopPropagation();
        return;
      }
      close();
    });

    insertBtn.addEventListener("click", () => {
      const code = generateBbcode();
      if (!code) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;
      _replaceTextareaRange(textarea, start, end, code);
      close();
    });

    card.appendChild(titleRow);
    card.appendChild(manualImportPanel);
    card.appendChild(urlRow);
    card.appendChild(imgScrollSection);
    card.appendChild(hotspotListEl);
    card.appendChild(codeRow);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    rebuildHotspotList();
    refreshCode();
    urlInput.focus();
  }

  function _createBbcodeButtons(textarea) {
    const specs = [
      {
        label: "Bold",
        title: "Bold",
        icon: "fas fa-bold",
        open: "[b]",
        close: "[/b]",
      },
      {
        label: "Italic",
        title: "Italic",
        icon: "fas fa-italic",
        open: "[i]",
        close: "[/i]",
      },
      {
        label: "Underline",
        title: "Underline",
        icon: "fas fa-underline",
        open: "[u]",
        close: "[/u]",
      },
      {
        label: "Strike",
        title: "Strike",
        icon: "fas fa-strikethrough",
        open: "[s]",
        close: "[/s]",
      },
      {
        label: "Heading",
        title: "Heading",
        icon: "fas fa-heading",
        open: "[heading]",
        close: "[/heading]",
      },
      {
        label: "Quote",
        title: "Quote",
        icon: "fas fa-quote-right",
        open: "[quote]",
        close: "[/quote]",
      },
      {
        label: "Code",
        title: "Code",
        icon: "fas fa-code",
        open: "[code]",
        close: "[/code]",
      },
      {
        label: "Spoiler Box",
        title: "Spoiler Box",
        icon: "fas fa-box-open",
        open: "[box]",
        close: "[/box]",
      },
      {
        label: "Color",
        title: "Font color",
        icon: "fas fa-palette",
        onClick: () => _openColorPicker(textarea),
      },
      {
        label: "Size",
        title: "Font size",
        icon: "fas fa-text-height",
        onClick: () => _openSizePicker(textarea),
      },
      {
        label: "Link",
        title: "Link",
        icon: "fas fa-link",
        open: "[url]",
        close: "[/url]",
      },
      {
        label: "Image",
        title: "Image",
        icon: "far fa-image",
        open: "[img]",
        close: "[/img]",
      },
      {
        label: "List",
        title: "List",
        icon: "fas fa-list-ul",
        open: "[list]\n[*]",
        close: "\n[/list]",
      },
      {
        label: "Center",
        title: "Center",
        icon: "fas fa-align-center",
        open: "[centre]",
        close: "[/centre]",
      },
    ];

    return specs.map((spec) =>
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: spec.title,
          onclick: () =>
            typeof spec.onClick === "function"
              ? spec.onClick()
              : _toggleBbcodeWrap(textarea, spec.open, spec.close),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label),
      ),
    );
  }

  function _parseBbcodeTagName(rawTag) {
    const s = String(rawTag || "").trim();
    if (!s) return "";
    const noSlash = s.startsWith("/") ? s.slice(1).trim() : s;
    const cutEq = noSlash.split("=")[0].trim();
    const cutSpace = cutEq.split(/\s+/)[0].trim();
    return cutSpace.toLowerCase();
  }

  const KNOWN_BBCODE_TAGS = new Set([
    "b",
    "i",
    "u",
    "s",
    "strike",
    "color",
    "size",
    "spoiler",
    "box",
    "spoilerbox",
    "quote",
    "c",
    "code",
    "centre",
    "url",
    "profile",
    "list",
    "*",
    "email",
    "img",
    "imagemap",
    "youtube",
    "audio",
    "heading",
    "notice",
  ]);

  function _firstBbcodeFormatIssue(text) {
    const value = String(text || "");
    /** @type {string[]} */
    const stack = [];
    const selfClosing = new Set(["*"]);
    let i = 0;
    while (i < value.length) {
      const ch = value[i];
      if (ch === "]") {
        return "Unexpected closing bracket `]`.";
      }
      if (ch !== "[") {
        i += 1;
        continue;
      }
      const closeIdx = value.indexOf("]", i + 1);
      if (closeIdx === -1) {
        return "Missing closing bracket `]` for a BBCode tag.";
      }
      const rawTag = value.slice(i + 1, closeIdx).trim();
      if (!rawTag) {
        return "Empty BBCode tag `[]` is invalid.";
      }
      const isClosing = rawTag.startsWith("/");
      const name = _parseBbcodeTagName(rawTag);
      if (!name || !/^[a-z*]+$/.test(name)) {
        return `Invalid tag name in \`[${rawTag}]\`.`;
      }
      // Unknown bracketed text is treated as plain text, not BBCode.
      if (!KNOWN_BBCODE_TAGS.has(name)) {
        i = closeIdx + 1;
        continue;
      }
      if (!isClosing && !selfClosing.has(name)) {
        stack.push(name);
      } else if (isClosing) {
        const expected = stack[stack.length - 1];
        if (!expected) {
          return `Closing tag \`[/${name}]\` has no matching opening tag.`;
        }
        if (expected !== name) {
          return `Mismatched tag order: expected \`[/${expected}]\` before \`[/${name}]\`.`;
        }
        stack.pop();
      }
      i = closeIdx + 1;
    }
    if (stack.length) {
      return `Unclosed tag \`[${stack[stack.length - 1]}]\` found.`;
    }
    return null;
  }

  function _ensureBbcodeFormatChecker(editorEl, textarea) {
    let warnEl = editorEl.querySelector(`:scope > .${BBHELP_WARN_CLASS}`);
    if (!(warnEl instanceof HTMLElement)) {
      warnEl = el("div", { class: BBHELP_WARN_CLASS, hidden: "hidden" });
      textarea.insertAdjacentElement("afterend", warnEl);
    }
    if (textarea.hasAttribute(BBHELP_CHECKER_DONE_ATTR)) return;

    const refresh = () => {
      const issue = _firstBbcodeFormatIssue(textarea.value);
      if (!issue) {
        warnEl.hidden = true;
        warnEl.textContent = "";
        return;
      }
      warnEl.hidden = false;
      warnEl.textContent = `BBCode format warning: ${issue}`;
    };

    textarea.addEventListener("input", refresh);
    textarea.setAttribute(BBHELP_CHECKER_DONE_ATTR, "1");
    refresh();
  }

  function _escapePreviewHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _sanitizeHttpPreviewUrl(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    try {
      const parsed = new URL(src, location.origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function _matchNoticeOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    if (!/^\[notice\]/i.test(s.slice(i, i + 8))) return null;
    return { fullLen: 8 };
  }

  function _matchNoticeCloseLen(s, i) {
    return /^\[\/notice\]/i.test(s.slice(i, i + 9)) ? 9 : 0;
  }

  function _findBbcodeNoticeCloseRange(s, innerStart) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchNoticeCloseLen(s, i);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchNoticeOpenAt(s, i);
        if (op) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _matchBbcodeBoxOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    const rest = s.slice(i);
    const tags = ["spoilerbox", "spoiler", "box"];
    for (let t = 0; t < tags.length; t += 1) {
      const tag = tags[t];
      const re =
        tag === "spoilerbox"
          ? /^\[spoilerbox(?:=([^\]]*))?\]/i
          : tag === "spoiler"
            ? /^\[spoiler(?:=([^\]]*))?\]/i
            : /^\[box(?:=([^\]]*))?\]/i;
      const m = rest.match(re);
      if (m) {
        return {
          tag,
          titleRaw: String(m[1] ?? "").trim(),
          fullLen: m[0].length,
        };
      }
    }
    return null;
  }

  function _matchBbcodeBoxCloseLen(s, i, tag) {
    const re =
      tag === "spoilerbox"
        ? /^\[\/spoilerbox\]/i
        : tag === "spoiler"
          ? /^\[\/spoiler\]/i
          : /^\[\/box\]/i;
    const m = s.slice(i).match(re);
    return m ? m[0].length : 0;
  }

  function _findFirstBbcodeNestableOpen(s) {
    for (let i = 0; i < s.length; i += 1) {
      const noticeOp = _matchNoticeOpenAt(s, i);
      if (noticeOp) {
        return { kind: "notice", index: i, fullLen: noticeOp.fullLen };
      }
      const boxOp = _matchBbcodeBoxOpenAt(s, i);
      if (boxOp) {
        return {
          kind: "box",
          index: i,
          tag: boxOp.tag,
          titleRaw: boxOp.titleRaw,
          fullLen: boxOp.fullLen,
        };
      }
    }
    return null;
  }

  function _findBbcodeBoxCloseRange(s, innerStart, tag) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchBbcodeBoxCloseLen(s, i, tag);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchBbcodeBoxOpenAt(s, i);
        if (op && op.tag === tag) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _formatBbcodeBoxPreviewHtml(
    tag,
    titleRawFromEscapedSource,
    innerHtml,
  ) {
    const trimmed = String(titleRawFromEscapedSource || "").trim();
    const label = tag === "box" ? trimmed || "Box" : trimmed;
    const labelSpan = label
      ? `<span class="oep-bbhelp-preview__spoiler-label">${label}</span>`
      : "";
    const summaryClass =
      "oep-bbhelp-preview__spoiler-summary" +
      (label ? "" : " oep-bbhelp-preview__spoiler-summary--icon-only");
    const summaryA11y = label ? "" : ' aria-label="Spoiler"';
    return (
      `<details class="oep-bbhelp-preview__spoilerbox">` +
      `<summary class="${summaryClass}"${summaryA11y}>` +
      `<span class="oep-bbhelp-preview__spoiler-icon" aria-hidden="true"></span>` +
      `${labelSpan}` +
      `</summary>` +
      `<div class="oep-bbhelp-preview__spoiler-body">${innerHtml}</div>` +
      `</details>`
    );
  }

  function _replaceBalancedBbcodeNestable(html, renderInner) {
    const first = _findFirstBbcodeNestableOpen(html);
    if (!first) return html;

    if (first.kind === "notice") {
      const start = first.index;
      const fullLen = first.fullLen;
      const range = _findBbcodeNoticeCloseRange(html, start + fullLen);
      if (!range) return html;
      const before = html.slice(0, start);
      const inner = html.slice(start + fullLen, range.bodyEnd);
      const after = html.slice(range.closeEnd);
      const innerHtml = renderInner(inner);
      const block = `<div class="oep-bbhelp-preview__notice">${innerHtml}</div>`;
      return (
        _replaceBalancedBbcodeNestable(before, renderInner) +
        block +
        _replaceBalancedBbcodeNestable(after, renderInner)
      );
    }

    const { index: start, tag, titleRaw, fullLen } = first;
    const range = _findBbcodeBoxCloseRange(html, start + fullLen, tag);
    if (!range) return html;
    const before = html.slice(0, start);
    const inner = html.slice(start + fullLen, range.bodyEnd);
    const after = html.slice(range.closeEnd);
    const innerHtml = renderInner(inner);
    const boxHtml = _formatBbcodeBoxPreviewHtml(tag, titleRaw, innerHtml);
    return (
      _replaceBalancedBbcodeNestable(before, renderInner) +
      boxHtml +
      _replaceBalancedBbcodeNestable(after, renderInner)
    );
  }

  function _finishBbcodePreviewParagraphs(html) {
    const applyLineBreaks = (str) =>
      str.replace(/(<pre\b[\s\S]*?<\/pre>)|\n/g, (m, pre) => pre ?? "<br>");

    return html
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        const withBr = applyLineBreaks(trimmed);
        if (/^<(ul|ol|pre|blockquote|h\d|div|details)/i.test(trimmed))
          return withBr;
        return `<p>${withBr}</p>`;
      })
      .join("");
  }

  function _bbcodePreviewCore(escaped) {
    let html = escaped;

    html = html.replace(
      /\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi,
      (_, hrefRaw, labelRaw) => {
        const href = _sanitizeHttpPreviewUrl(hrefRaw);
        const label = String(labelRaw || "");
        if (!href) return label;
        return `<a href="${_escapePreviewHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      },
    );
    html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, hrefRaw) => {
      const href = _sanitizeHttpPreviewUrl(hrefRaw);
      if (!href) return String(hrefRaw || "");
      const label = _escapePreviewHtml(href);
      return `<a href="${label}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(
      /\[imagemap=([^\]]+)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeHttpPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\(([^)\]]+)\)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeHttpPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, bodyRaw) => {
        const body = String(bodyRaw || "");
        const srcMatch = body.match(
          /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i,
        );
        const srcUrl = _sanitizeHttpPreviewUrl(srcMatch ? srcMatch[0] : "");
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, srcRaw) => {
      const srcUrl = _sanitizeHttpPreviewUrl(srcRaw);
      if (!srcUrl) return "";
      return `<img src="${_escapePreviewHtml(srcUrl)}" alt="preview image" loading="lazy" referrerpolicy="no-referrer" />`;
    });

    const wrapPairs = [
      ["b", "strong"],
      ["i", "em"],
      ["u", "u"],
      ["s", "del"],
      ["strike", "del"],
      ["quote", "blockquote"],
      ["heading", "h3"],
      ["centre", 'div style="text-align:center;"'],
    ];
    wrapPairs.forEach(([bb, tag]) => {
      const open = tag.includes(" ") ? `<${tag}>` : `<${tag}>`;
      const closeTag = tag.split(" ")[0];
      html = html.replace(
        new RegExp(`\\[${bb}\\]([\\s\\S]*?)\\[\\/${bb}\\]`, "gi"),
        `${open}$1</${closeTag}>`,
      );
    });

    html = html.replace(
      /\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi,
      (_, color, body) => {
        const safeColor = _escapePreviewHtml(
          String(color || "").trim() || "inherit",
        );
        return `<span style="color:${safeColor};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[size=(.*?)\]([\s\S]*?)\[\/size\]/gi,
      (_, sizeRaw, body) => {
        const size = String(sizeRaw || "")
          .trim()
          .toLowerCase();
        const presets = {
          tiny: "0.75em",
          small: "0.88em",
          normal: "1em",
          large: "1.2em",
        };
        const pct = Number(size);
        const computed =
          presets[size] ||
          (Number.isFinite(pct)
            ? `${Math.max(30, Math.min(200, pct))}%`
            : "1em");
        return `<span style="font-size:${computed};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[code\]([\s\S]*?)\[\/code\]/gi,
      "<pre><code>$1</code></pre>",
    );

    html = _replaceBalancedBbcodeNestable(html, (body) =>
      _finishBbcodePreviewParagraphs(_bbcodePreviewCore(body)),
    );

    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, body) => {
      const items = String(body || "")
        .split(/\[\*\]/i)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!items.length) return "";
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    });

    html = html.replace(/\[(\/)?[a-z*]+(?:=[^\]]+)?\]/gi, "");

    return html;
  }

  function _renderSimpleBbcodePreviewHtml(src) {
    const raw = String(src ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    if (!raw.trim()) {
      return `<p class="${BBHELP_PREVIEW_EMPTY_CLASS}">Nothing to preview yet.</p>`;
    }
    const escaped = _escapePreviewHtml(raw);
    const html = _bbcodePreviewCore(escaped);
    return _finishBbcodePreviewParagraphs(html);
  }

  function _findCancelActionNode(editorEl, textarea) {
    const scopeRoots = [
      textarea?.closest("form"),
      editorEl.closest("form"),
      editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
      editorEl.parentElement,
    ].filter((n) => n instanceof HTMLElement);
    for (const scope of scopeRoots) {
      const candidate = Array.from(scope.querySelectorAll("button, a")).find(
        (n) => {
          if (!(n instanceof HTMLElement)) return false;
          const label = String(n.textContent || "")
            .trim()
            .toLowerCase();
          return label === "cancel";
        },
      );
      if (candidate instanceof HTMLElement) return candidate;
    }
    return null;
  }

  function _ensureBbcodeLivePreview(editorEl, textarea) {
    let previewEnabled = false;
    let repaintTimer = 0;

    let toggleBtn = editorEl.querySelector(`[${BBHELP_PREVIEW_TOGGLE_ATTR}]`);
    if (!(toggleBtn instanceof HTMLButtonElement)) {
      toggleBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_PREVIEW_TOGGLE_CLASS,
          [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
          "aria-pressed": "false",
          title: "Toggle live preview",
        },
        "Live preview",
      );
    }

    let preview = editorEl.querySelector(`[${BBHELP_PREVIEW_ATTR}]`);
    if (!(preview instanceof HTMLElement)) {
      preview = el(
        "section",
        {
          class: BBHELP_PREVIEW_CLASS,
          [BBHELP_PREVIEW_ATTR]: "1",
          hidden: "hidden",
        },
        el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
        el("div", { class: BBHELP_PREVIEW_BODY_CLASS }),
      );
      textarea.insertAdjacentElement("afterend", preview);
    }

    const previewBody = preview.querySelector(`.${BBHELP_PREVIEW_BODY_CLASS}`);
    if (!(previewBody instanceof HTMLElement)) return;

    const placeToggle = () => {
      const cancelNode = _findCancelActionNode(editorEl, textarea);
      if (!(cancelNode instanceof HTMLElement)) return;
      const parent = cancelNode.parentElement;
      if (!(parent instanceof HTMLElement)) return;
      if (
        toggleBtn.parentElement !== parent ||
        toggleBtn.nextElementSibling !== cancelNode
      ) {
        cancelNode.insertAdjacentElement("beforebegin", toggleBtn);
      }
    };

    const repaint = () => {
      previewBody.innerHTML = _renderSimpleBbcodePreviewHtml(
        textarea.value || "",
      );
      preview.hidden = !previewEnabled;
      toggleBtn.setAttribute("aria-pressed", previewEnabled ? "true" : "false");
      placeToggle();
    };
    const repaintSoon = () => {
      window.clearTimeout(repaintTimer);
      repaintTimer = window.setTimeout(repaint, 70);
    };

    if (!textarea.hasAttribute(BBHELP_PREVIEW_DONE_ATTR)) {
      textarea.addEventListener("input", repaintSoon);
      toggleBtn.addEventListener("click", () => {
        previewEnabled = !previewEnabled;
        repaint();
      });
      textarea.setAttribute(BBHELP_PREVIEW_DONE_ATTR, "1");
    } else {
      previewEnabled = toggleBtn.getAttribute("aria-pressed") === "true";
    }

    repaint();
  }

  function _enhanceSingleBbcodeEditor(editorEl) {
    if (!(editorEl instanceof HTMLElement)) return;

    const textarea = editorEl.querySelector(BBHELP_INPUT_SELECTOR);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    _ensureBbcodeFormatChecker(editorEl, textarea);
    _ensureBbcodeLivePreview(editorEl, textarea);
    if (editorEl.hasAttribute(BBHELP_DONE_ATTR)) return;

    let editorId = editorEl.getAttribute(BBHELP_EDITOR_ID_ATTR);
    if (!editorId) {
      editorId = `oep-bbhelp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      editorEl.setAttribute(BBHELP_EDITOR_ID_ATTR, editorId);
    }
    const existingWrap = editorEl.querySelector(
      `:scope > .${BBHELP_WRAP_CLASS}`,
    );
    if (existingWrap) {
      editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
      existingWrap.setAttribute(BBHELP_WRAP_FOR_ATTR, editorId);
      return;
    }

    const wrap = el("div", {
      class: BBHELP_WRAP_CLASS,
      [BBHELP_WRAP_FOR_ATTR]: editorId,
    });
    const row = el("div", { class: BBHELP_ROW_CLASS });
    _createBbcodeButtons(textarea).forEach((btn) => row.appendChild(btn));
    wrap.appendChild(row);

    const row2 = el("div", {
      class: BBHELP_ROW_CLASS,
      style: "margin-top:4px;",
    });
    row2.appendChild(
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Open ImageMap helper",
          onclick: () => _openImagemapHelper(textarea),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} fas fa-map-marked-alt` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, "Imagemap helper"),
      ),
    );
    wrap.appendChild(row2);

    editorEl.insertBefore(wrap, editorEl.firstChild);
    editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
  }

  function _isElementActuallyVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!node.isConnected) return false;
    if (node.hidden) return false;
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (node.getClientRects().length === 0) return false;
    return true;
  }

  function teardownBbcodeHelpers() {
    document
      .querySelectorAll(`.${BBHELP_MODAL_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WARN_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_TOGGLE_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WRAP_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`${BBHELP_EDITOR_SELECTOR}[${BBHELP_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_CHECKER_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_CHECKER_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_PREVIEW_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_PREVIEW_DONE_ATTR));
    removeBbcodeHelperStyles();
  }

  /** @returns {function} */
  function startBbcodeHelperManager() {
    injectBbcodeHelperStyles();

    const scan = () => {
      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        const parent = wrap.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (!parent.matches(BBHELP_EDITOR_SELECTOR)) wrap.remove();
      });

      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        const editorId = wrap.getAttribute(BBHELP_WRAP_FOR_ATTR);
        const editor = editorId
          ? document.querySelector(
              `${BBHELP_EDITOR_SELECTOR}[${BBHELP_EDITOR_ID_ATTR}="${editorId}"]`,
            )
          : null;
        if (
          !(editor instanceof HTMLElement) ||
          !_isElementActuallyVisible(editor)
        ) {
          if (editor instanceof HTMLElement) {
            editor.removeAttribute(BBHELP_DONE_ATTR);
          }
          wrap.remove();
        }
      });
      document.querySelectorAll(BBHELP_EDITOR_SELECTOR).forEach((editorEl) => {
        if (_isElementActuallyVisible(editorEl))
          _enhanceSingleBbcodeEditor(editorEl);
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `${BBHELP_EDITOR_SELECTOR}, ${BBHELP_EDITOR_SELECTOR} ${BBHELP_INPUT_SELECTOR}`,
        )
      ) {
        scan();
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      obs.disconnect();
      teardownBbcodeHelpers();
    };
  }

  const CONTENTS_REORDER_STYLE_ID = "osu-expertplus-profile-contents-reorder";
  const CONTENTS_REORDER_ANCHOR_ATTR = "data-oep-contents-reorder-anchor";
  const CONTENTS_REORDER_DRAGGING_CLASS = "oep-contents-reorder--dragging";
  const CONTENTS_REORDER_DRAGOVER_CLASS = "oep-contents-reorder--dragover";
  const CONTENTS_REORDER_DROP_BEFORE_CLASS = "oep-contents-reorder--drop-before";
  const CONTENTS_REORDER_DROP_AFTER_CLASS = "oep-contents-reorder--drop-after";
  const CONTENTS_REORDER_GHOST_CLASS = "oep-contents-reorder--ghost";
  const CONTENTS_REORDER_DRAG_THRESHOLD_PX = 12;

  const CONTENTS_REORDER_CSS = `
    a[${CONTENTS_REORDER_ANCHOR_ATTR}] {
      cursor: grab;
      user-select: none;
      display: inline-flex;
      align-items: center;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DRAGGING_CLASS} {
      opacity: 0 !important;
      cursor: grabbing;
      pointer-events: none;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_BEFORE_CLASS} {
      box-shadow: -3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 0 5px 5px 0;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_AFTER_CLASS} {
      box-shadow: 3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 5px 0 0 5px;
    }
    .${CONTENTS_REORDER_GHOST_CLASS} {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      background-color: rgba(255, 255, 255, 0.14);
      color: hsl(var(--hsl-l1));
      white-space: nowrap;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
      user-select: none;
      transform: translate(10px, -50%);
      font-size: 0.875em;
      opacity: 0.95;
    }
  `;

  const contentsReorderStyle = manageStyle(
    CONTENTS_REORDER_STYLE_ID,
    CONTENTS_REORDER_CSS,
  );

  function injectContentsReorderStyles() {
    contentsReorderStyle.inject();
  }

  function removeContentsReorderStyles() {
    contentsReorderStyle.remove();
  }

  function getSectionPageNodes() {
    return Array.from(
      document.querySelectorAll("div.js-sortable--page[data-page-id]"),
    ).filter((n) => n instanceof HTMLElement);
  }

  function sectionIdFromHashHref(href) {
    if (!href || href[0] !== "#") return "";
    const hash = href.slice(1).trim();
    return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
  }

  function getSortableContentsAnchorGroups() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];

    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (allCandidates.length < 3) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });

    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length >= 3,
    );
  }

  /** All hash-tab rows (incl. 1–2 tabs); {@link getSortableContentsAnchorGroups} needs ≥3 for DnD. */
  function getProfileContentsAnchorRows() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];
    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (!allCandidates.length) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });
    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length > 0,
    );
  }

  function getPreferredVisibleContentsGroup(groups) {
    if (!Array.isArray(groups) || !groups.length) return [];
    for (const anchors of groups) {
      const row = anchors[0]?.parentElement;
      if (!(row instanceof HTMLElement)) continue;
      const visible =
        row.offsetParent !== null &&
        window.getComputedStyle(row).display !== "none" &&
        window.getComputedStyle(row).visibility !== "hidden";
      if (visible) return anchors;
    }
    return groups[0] || [];
  }

  function cleanupContentsReorderHints() {
    document
      .querySelectorAll("[data-oep-contents-reorder-hint]")
      .forEach((n) => n.remove());
  }

  function maybeCsrfToken() {
    const m = document.querySelector('meta[name="csrf-token"]');
    if (!(m instanceof HTMLMetaElement)) return "";
    return String(m.content || "").trim();
  }

  async function persistProfileSectionOrder(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const payload = new URLSearchParams();
    sectionIds.forEach((id) =>
      payload.append("user_profile_customization[extras_order][]", id),
    );

    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    const csrf = maybeCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;

    const resp = await fetch("/home/account/options", {
      method: "PUT",
      credentials: "include",
      headers,
      body: payload.toString(),
    });
    if (!resp.ok) throw new Error(`save failed (${resp.status})`);
  }

  function reorderSectionPagesByIds(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const pages = getSectionPageNodes();
    if (!pages.length) return;
    const byId = new Map();
    pages.forEach((p) => {
      byId.set(p.getAttribute("data-page-id"), p);
    });
    const parent = pages[0]?.parentElement;
    if (!parent) return;

    sectionIds.forEach((id) => {
      const node = byId.get(id);
      if (node) parent.appendChild(node);
    });
  }

  const PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSubsectionsCollapsed";
  /** Same as section collapse `SECTION_COLLAPSE_SUBTITLE_SELECTOR` (defined below). */
  const PROFILE_PAGE_SUBTITLE_H3_SELECTOR = "h3.title.title--page-extra-small";
  /** osu `ProfileExtraPage` ids (`data-page-id`) where we skip h3 subsection UI (single block, no sub-titles). */
  const PROFILE_SUBSECTION_SKIP_PAGE_IDS = new Set(["medals"]);
  const SUBSECTION_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-subsection-collapse";
  const SUBSECTION_BODY_HIDDEN_CLASS =
    "oep-profile-subsection-body--collapsed-hidden";
  const SUBSECTION_TITLE_CLASS = "oep-profile-subsection-title";
  const SUBSECTION_TITLE_COLLAPSED_CLASS =
    "oep-profile-subsection-title--collapsed";
  const SUBSECTION_TITLE_MAIN_CLASS = "oep-profile-subsection-title__main";
  const SUBSECTION_TITLE_LABEL_CLASS = "oep-profile-subsection-title__label";
  const SUBSECTION_DONE_ATTR = "data-oep-subsection-collapse";
  const SUBSECTION_BODY_FOR_ATTR = "data-oep-subsection-for";
  const SUBSECTION_TOGGLE_ATTR = "data-oep-profile-subsection-collapse-toggle";
  const SUBSECTION_TOGGLE_FOR_ATTR = "data-oep-profile-subsection-for";
  const SUBSECTION_LABEL_ATTR = "data-oep-subsection-label";
  /** Collapsed dim: title label and `.title__count` pill. */
  const SUBSECTION_COLLAPSED_DIM_OPACITY = "0.64";

  const SUBSECTION_COLLAPSE_CSS = `
    .${SUBSECTION_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35em;
      cursor: pointer;
      line-height: normal;
      padding: 10px 0;
      margin: 0;
      isolation: isolate;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::before {
      z-index: 0;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS}.title.title--page-extra-small::before {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::after {
      content: "";
      position: absolute;
      top: 0;
      right: -8px;
      bottom: 0;
      left: -1.8rem;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small > * {
      position: relative;
      z-index: 2;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0 10px;
      min-width: 0;
      flex: 1 1 auto;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      transition: opacity 120ms ease;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-sizing: border-box;
      margin: 0;
      padding: 0 10px;
      height: 1.85em;
      min-width: 1.85em;
      font-size: 0.8em;
      font-variant-numeric: tabular-nums;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    button.oep-profile-subsection-collapse-toggle {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    button.oep-profile-subsection-collapse-toggle:focus-visible {
      clip-path: none;
      width: auto;
      height: auto;
      margin: 0;
      padding: 2px 6px;
      overflow: visible;
      outline: 1px solid hsl(var(--hsl-l2));
      outline-offset: 1px;
      background: rgba(255, 255, 255, 0.08);
      color: hsl(var(--hsl-l1));
      font-size: 0.75rem;
      z-index: 1;
    }
  `;

  const subsectionCollapseStyle = manageStyle(
    SUBSECTION_COLLAPSE_STYLE_ID,
    SUBSECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSubsectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSubsectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  /**
   * @param {string} text
   * @param {Set<string>} usedSlugs
   * @returns {string}
   */
  function subsectionSlugFromTitle(text, usedSlugs) {
    let base = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) base = "subsection";
    let slug = base;
    let n = 0;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${base}_${n}`;
    }
    usedSlugs.add(slug);
    return slug;
  }

  const SUBSECTION_SHOW_MORE_NAMED_MODIFIERS = new Set([
    "pinned",
    "best",
    "firsts",
    "recent",
  ]);
  const SUBSECTION_SHOW_MORE_SKIP_MODIFIERS = new Set(["loading"]);

  /**
   * osu-web PlayDetailList sets ShowMoreLink modifiers to pinned / best / firsts / recent
   * (language-independent BEM classes). Other pages use generic modifiers; those fall back to
   * index-based keys in the caller.
   * @param {HTMLElement} h3
   * @returns {string|null}
   */
  function subsectionNamedModifierFromFollowingContent(h3) {
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement) {
      if (n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
      const roots = n.matches(".show-more-link")
        ? [n]
        : Array.from(n.querySelectorAll(".show-more-link"));
      for (const sm of roots) {
        for (const c of sm.classList) {
          if (!c.startsWith("show-more-link--")) continue;
          const mod = c.slice("show-more-link--".length);
          if (SUBSECTION_SHOW_MORE_SKIP_MODIFIERS.has(mod)) continue;
          if (SUBSECTION_SHOW_MORE_NAMED_MODIFIERS.has(mod)) return mod;
        }
      }
      n = n.nextElementSibling;
    }
    return null;
  }

  /**
   * @param {Set<string>} collapsedSet
   * @param {string} legacyKey
   * @param {string} stableKey
   * @returns {boolean} true if collapsedSet was mutated
   */
  function migrateSubsectionCollapseLegacyKey(
    collapsedSet,
    legacyKey,
    stableKey,
  ) {
    if (!legacyKey || !stableKey || legacyKey === stableKey) return false;
    if (!collapsedSet.has(legacyKey)) return false;
    collapsedSet.add(stableKey);
    collapsedSet.delete(legacyKey);
    return true;
  }

  /**
   * @param {HTMLElement} h3
   * @returns {HTMLElement[]}
   */
  function collectSubsectionBodyElements(h3) {
    const recentHeader = h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`);
    if (recentHeader instanceof HTMLElement && recentHeader.contains(h3)) {
      const bodies = [];
      let n = h3.nextElementSibling;
      while (n instanceof HTMLElement) {
        bodies.push(n);
        n = n.nextElementSibling;
      }
      let p = recentHeader.nextElementSibling;
      while (p instanceof HTMLElement) {
        if (p.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
        bodies.push(p);
        p = p.nextElementSibling;
      }
      return bodies;
    }

    const bodies = [];
    let n = h3.nextElementSibling;
    while (
      n instanceof HTMLElement &&
      !n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)
    ) {
      bodies.push(n);
      n = n.nextElementSibling;
    }
    return bodies;
  }

  /**
   * Wraps title text (and segments between counts) so collapsed opacity applies only to the name,
   * not the count pill. Keeps `.title__count` in an inline-flex row for vertical alignment.
   * @param {HTMLElement} h3
   * @param {HTMLElement} btn
   */
  function wrapSubsectionTitleContent(h3, btn) {
    if (h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`)) return;
    if (!btn.nextSibling) return;
    const main = el("span", { class: SUBSECTION_TITLE_MAIN_CLASS });
    let n = btn.nextSibling;
    let label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
    while (n) {
      const next = n.nextSibling;
      if (n instanceof HTMLElement && n.classList.contains("title__count")) {
        if (label.childNodes.length) main.appendChild(label);
        main.appendChild(n);
        label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
      } else {
        label.appendChild(n);
      }
      n = next;
    }
    if (label.childNodes.length) main.appendChild(label);
    if (!main.childNodes.length) return;
    btn.insertAdjacentElement("afterend", main);
  }

  /**
   * @param {HTMLElement} h3
   */
  function unwrapSubsectionTitleMain(h3) {
    const main = h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`);
    if (!(main instanceof HTMLElement)) return;
    while (main.firstChild) {
      h3.insertBefore(main.firstChild, main);
    }
    main.remove();
  }

  /** @param {string} key */
  function toggleProfileSubsectionCollapsedKey(key) {
    if (!key) return;
    const set = readProfileSubsectionsCollapsedSet();
    if (set.has(key)) set.delete(key);
    else set.add(key);
    writeProfileSubsectionsCollapsedSet(set);
    applyProfileSubsectionCollapseState(set);
  }

  /** @param {Set<string>} collapsed */
  function applyProfileSubsectionCollapseState(collapsed) {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const key = el.getAttribute(SUBSECTION_BODY_FOR_ATTR);
      if (!key) return;
      if (collapsed.has(key)) el.classList.add(SUBSECTION_BODY_HIDDEN_CLASS);
      else el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document
      .querySelectorAll(`button[${SUBSECTION_TOGGLE_ATTR}]`)
      .forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR);
        if (!key) return;
        const isCollapsed = collapsed.has(key);
        btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
        const label = btn.getAttribute(SUBSECTION_LABEL_ATTR) || key;
        btn.title = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;
        btn.setAttribute(
          "aria-label",
          isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        );
        const h3El = btn.closest("h3");
        if (h3El) {
          h3El.classList.toggle(SUBSECTION_TITLE_COLLAPSED_CLASS, isCollapsed);
        }
      });
  }

  function teardownProfileSubsectionCollapse() {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      el.removeAttribute(SUBSECTION_BODY_FOR_ATTR);
      el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document.querySelectorAll(`h3[${SUBSECTION_DONE_ATTR}]`).forEach((h3) => {
      if (!(h3 instanceof HTMLElement)) return;
      const wrap =
        /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */ (
          h3
        );
      wrap._oepSubsectionAc?.abort();
      delete wrap._oepSubsectionAc;
      unwrapSubsectionTitleMain(h3);
      h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`)?.remove();
      h3.removeAttribute(SUBSECTION_DONE_ATTR);
      h3.classList.remove(
        SUBSECTION_TITLE_CLASS,
        SUBSECTION_TITLE_COLLAPSED_CLASS,
      );
    });
  }

  /**
   * @param {HTMLElement} pageEl  div.js-sortable--page
   * @param {Set<string>} collapsedSet  live set; legacy slug keys are migrated into stable keys
   * @returns {boolean} true if collapsedSet was mutated (caller should persist)
   */
  function enhanceSortablePageSubsections(pageEl, collapsedSet) {
    const pageId = pageEl.getAttribute("data-page-id");
    if (!pageId) return false;
    if (PROFILE_SUBSECTION_SKIP_PAGE_IDS.has(pageId)) return false;
    const usedSlugs = new Set();
    let subsectionIndex = 0;
    let migrationDirty = false;
    const h3s = pageEl.querySelectorAll(PROFILE_PAGE_SUBTITLE_H3_SELECTOR);
    for (const h3 of h3s) {
      if (!(h3 instanceof HTMLElement)) continue;
      if (h3.closest(".js-sortable--page") !== pageEl) continue;
      if (h3.hasAttribute(SUBSECTION_DONE_ATTR)) continue;

      const label = String(h3.textContent || "").trim() || pageId;
      const legacyKey = `${pageId}::${subsectionSlugFromTitle(label, usedSlugs)}`;
      const namedMod = subsectionNamedModifierFromFollowingContent(h3);
      const stableKey = namedMod
        ? `${pageId}::${namedMod}`
        : `${pageId}::sub_${subsectionIndex}`;
      subsectionIndex += 1;

      if (
        migrateSubsectionCollapseLegacyKey(collapsedSet, legacyKey, stableKey)
      ) {
        migrationDirty = true;
      }

      const isCollapsed = collapsedSet.has(stableKey);

      const bodies = collectSubsectionBodyElements(h3);
      bodies.forEach((b) =>
        b.setAttribute(SUBSECTION_BODY_FOR_ATTR, stableKey),
      );

      const btn = el("button", {
        type: "button",
        class: "oep-profile-subsection-collapse-toggle",
        [SUBSECTION_TOGGLE_ATTR]: "1",
        [SUBSECTION_TOGGLE_FOR_ATTR]: stableKey,
        [SUBSECTION_LABEL_ATTR]: label,
        "aria-expanded": isCollapsed ? "false" : "true",
        title: isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        "aria-label": isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
      });
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleProfileSubsectionCollapsedKey(stableKey);
      });

      const subsectionAc = new AbortController();
      /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */
      (h3)._oepSubsectionAc = subsectionAc;
      h3.addEventListener(
        "click",
        (ev) => {
          const t = ev.target;
          if (!(t instanceof Element)) return;
          if (t.closest(`button[${SUBSECTION_TOGGLE_ATTR}]`)) return;
          if (t.closest("a[href]")) return;
          toggleProfileSubsectionCollapsedKey(stableKey);
        },
        { signal: subsectionAc.signal },
      );

      h3.insertBefore(btn, h3.firstChild);
      wrapSubsectionTitleContent(h3, btn);
      h3.classList.add(SUBSECTION_TITLE_CLASS);
      if (isCollapsed) h3.classList.add(SUBSECTION_TITLE_COLLAPSED_CLASS);
      h3.setAttribute(SUBSECTION_DONE_ATTR, "1");
    }
    return migrationDirty;
  }

  function scanProfileSubsections() {
    teardownProfileSubsectionCollapse();
    const collapsedSet = readProfileSubsectionsCollapsedSet();
    let migrationDirty = false;
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement) {
        if (enhanceSortablePageSubsections(page, collapsedSet)) {
          migrationDirty = true;
        }
      }
    });
    if (migrationDirty) {
      writeProfileSubsectionsCollapsedSet(collapsedSet);
    }
    applyProfileSubsectionCollapseState(collapsedSet);
  }

  /** @returns {function} */
  function startProfileSubsectionCollapseManager() {
    subsectionCollapseStyle.inject();

    let debounceTimer = 0;
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        scanProfileSubsections();
      }, 80);
    };

    scanProfileSubsections();

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `div.js-sortable--page[data-page-id], ${PROFILE_PAGE_SUBTITLE_H3_SELECTOR}, .${RECENT_FAILS_WRAP_CLASS}`,
        )
      ) {
        schedule();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      teardownProfileSubsectionCollapse();
      subsectionCollapseStyle.remove();
    };
  }

  const PROFILE_SECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSectionsCollapsed";
  const SECTION_COLLAPSE_PAGE_CLASS = "oep-profile-section--collapsed";
  const SECTION_COLLAPSE_BODY_HIDDEN_CLASS =
    "oep-profile-section-body--collapsed-hidden";
  const SECTION_COLLAPSE_MAIN_TITLE_SELECTOR = "h2.title.title--page-extra";
  const SECTION_COLLAPSE_SUBTITLE_SELECTOR = "h3.title.title--page-extra-small";
  const SECTION_TAB_COLLAPSED_CLASS = "oep-profile-section-tab--collapsed";
  const SECTION_PAGE_TITLE_CLICK_ATTR =
    "data-oep-profile-section-page-title-click";
  const SECTION_TAB_CHEVRON_ATTR = "data-oep-section-tab-chevron";
  const SECTION_CONTENTS_ROW_CLASS = "oep-profile-contents-row";
  const SECTION_PAGE_TITLE_TOGGLE_CLASS =
    "oep-profile-section-page-title--toggle";
  const SECTION_PAGE_TITLE_LABEL_CLASS =
    "oep-profile-section-page-title__label";
  const SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS =
    "oep-profile-section-page-title__collapsed-suffix";
  const SECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-section-collapse";

  const SECTION_COLLAPSE_CSS = `
    .${SECTION_COLLAPSE_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small):not(div.u-relative:has(> h2.title.title--page-extra)) {
      display: none !important;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      > div.u-relative
      > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small) {
      display: none !important;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra {
      cursor: pointer;
      user-select: none;
      position: relative;
      isolation: isolate;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra > .${SECTION_PAGE_TITLE_LABEL_CLASS} {
      position: relative;
      z-index: 2;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::after {
      content: "";
      position: absolute;
      top: -0.25em;
      right: -0.55em;
      bottom: -0.25em;
      left: -1.5em;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    div.js-sortable--page
      h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra
      > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS} {
      position: relative;
      z-index: 2;
      font-weight: 600;
      font-size: 0.88em;
      opacity: 0.9;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translate(calc(-100% - 0.7em), -50%);
      font-size: 0.65em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      pointer-events: none;
      transition: opacity 120ms ease;
      z-index: 2;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      h2.title.title--page-extra.${SECTION_PAGE_TITLE_TOGGLE_CLASS}::before {
      content: "\\f078";
      opacity: 0.8;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS} .page-mode-link,
    a.${SECTION_TAB_COLLAPSED_CLASS} .fake-bold {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS}:not(:has(.page-mode-link)):not(:has(.fake-bold)) {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    .page-mode.page-mode--profile-page-extra {
      gap: 0 !important;
      column-gap: 0 !important;
      row-gap: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"] {
      margin-right: 0.85em !important;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      box-sizing: border-box;
      transition: background-color 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:hover {
      background-color: rgba(255, 255, 255, 0.07);
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:last-child {
      margin-right: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      font-size: 0.82em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      margin-right: 0.25em;
      flex-shrink: 0;
      transition: color 120ms ease, opacity 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]::before {
      content: "\\f078";
      opacity: 0.8;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
  `;

  const sectionCollapseStyle = manageStyle(
    SECTION_COLLAPSE_STYLE_ID,
    SECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  function clearProfileSectionCollapseBodyHidden(page) {
    page
      .querySelectorAll(`.${SECTION_COLLAPSE_BODY_HIDDEN_CLASS}`)
      .forEach((el) => el.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS));
    page.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
  }

  /**
   * Direct children of a sortable section that should stay visible when collapsed
   * (main h2 row with optional drag handle, or inline sub-headings).
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  function profileSectionCollapseKeepsChildVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR)) return true;
    if (el.matches(SECTION_COLLAPSE_SUBTITLE_SELECTOR)) return true;
    if (
      el.matches("div.u-relative") &&
      el.querySelector(`:scope > ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}`)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Hide non-heading children so in-page section titles stay visible.
   * Follows single-child wrappers briefly (some layouts nest one div).
   * @param {HTMLElement} pageEl
   * @param {number} depth
   * @returns {boolean} true when headings were found and body nodes hidden
   */
  /**
   * "(Collapsed)" is a real node so `h2::after` stays the hover overlay (same as expanded).
   * @param {HTMLElement} pageEl
   * @param {boolean} isCollapsed
   */
  function syncProfileSectionPageTitleCollapsedSuffix(pageEl, isCollapsed) {
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (!h2.classList.contains(SECTION_PAGE_TITLE_TOGGLE_CLASS)) return;
    const existing = h2.querySelector(
      `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
    );
    if (isCollapsed) {
      if (!existing) {
        h2.appendChild(
          el(
            "span",
            { class: SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS },
            " (Collapsed)",
          ),
        );
      }
    } else {
      existing?.remove();
    }
  }

  function markProfileSectionBodyCollapsed(pageEl, depth) {
    if (depth > 4) return false;
    const kids = [...pageEl.children].filter((n) => n instanceof HTMLElement);
    if (!kids.length) return false;
    const hasKept = kids.some(profileSectionCollapseKeepsChildVisible);
    if (hasKept) {
      kids.forEach((k) => {
        if (profileSectionCollapseKeepsChildVisible(k)) {
          k.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        } else {
          k.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        }
      });
      return true;
    }
    if (kids.length === 1) {
      return markProfileSectionBodyCollapsed(kids[0], depth + 1);
    }
    return false;
  }

  function applyProfileSectionCollapseToPages(collapsed) {
    getSectionPageNodes().forEach((node) => {
      const id = node.getAttribute("data-page-id");
      if (!id) return;
      clearProfileSectionCollapseBodyHidden(node);
      node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);

      if (!collapsed.has(id)) {
        syncProfileSectionPageTitleCollapsedSuffix(node, false);
        return;
      }

      node.classList.add(SECTION_COLLAPSE_PAGE_CLASS);
      if (!markProfileSectionBodyCollapsed(node, 0)) {
        node.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      }
      syncProfileSectionPageTitleCollapsedSuffix(node, true);
    });
    applyProfileSubsectionCollapseState(readProfileSubsectionsCollapsedSet());
  }

  function applyProfileSectionCollapseToTabAnchors(collapsed) {
    getProfileContentsAnchorRows()
      .flat()
      .forEach((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const sectionId = sectionIdFromHashHref(
          anchor.getAttribute("href") || "",
        );
        if (!sectionId) return;
        const isCollapsed = collapsed.has(sectionId);
        if (isCollapsed) anchor.classList.add(SECTION_TAB_COLLAPSED_CLASS);
        else anchor.classList.remove(SECTION_TAB_COLLAPSED_CLASS);

        anchor.setAttribute(
          SECTION_TAB_CHEVRON_ATTR,
          isCollapsed ? "collapsed" : "expanded",
        );
        const parent = anchor.parentElement;
        if (parent) parent.classList.add(SECTION_CONTENTS_ROW_CLASS);
      });
  }

  function cleanupProfileSectionCollapseToggles() {
    document
      .querySelectorAll("button.oep-profile-section-collapse-toggle")
      .forEach((n) => n.remove());
  }

  function teardownProfileSectionPageTitleClick() {
    document
      .querySelectorAll(`h2[${SECTION_PAGE_TITLE_CLICK_ATTR}]`)
      .forEach((h2) => {
        if (!(h2 instanceof HTMLElement)) return;
        const wrap =
          /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */ (
            h2
          );
        wrap._oepSectionPageTitleAc?.abort();
        delete wrap._oepSectionPageTitleAc;
        h2.querySelectorAll(
          `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
        ).forEach((n) => n.remove());
        const label = h2.querySelector(
          `:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`,
        );
        if (label instanceof HTMLElement) {
          while (label.firstChild) h2.insertBefore(label.firstChild, label);
          label.remove();
        }
        h2.removeAttribute(SECTION_PAGE_TITLE_CLICK_ATTR);
        h2.classList.remove(SECTION_PAGE_TITLE_TOGGLE_CLASS);
      });
  }

  function teardownProfileContentsTabChevrons() {
    document
      .querySelectorAll(`a[${SECTION_TAB_CHEVRON_ATTR}]`)
      .forEach((a) => a.removeAttribute(SECTION_TAB_CHEVRON_ATTR));
    document
      .querySelectorAll(`.${SECTION_CONTENTS_ROW_CLASS}`)
      .forEach((n) => n.classList.remove(SECTION_CONTENTS_ROW_CLASS));
  }

  /**
   * Delegated click handler: if the click lands on the ::before chevron area of
   * a contents-row tab anchor, toggle section collapse instead of navigating.
   * @param {MouseEvent} ev
   */
  function onContentsTabChevronClick(ev) {
    const a = /** @type {Element|null} */ (ev.target);
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!a.hasAttribute(SECTION_TAB_CHEVRON_ATTR)) return;
    const rect = a.getBoundingClientRect();
    const style = window.getComputedStyle(a, "::before");
    const beforeWidth = parseFloat(style.width) || 0;
    const paddingLeft = parseFloat(window.getComputedStyle(a).paddingLeft) || 0;
    const chevronRight = rect.left + paddingLeft + beforeWidth + 4;
    if (ev.clientX > chevronRight) return;
    ev.preventDefault();
    ev.stopPropagation();
    const sectionId = sectionIdFromHashHref(a.getAttribute("href") || "");
    if (sectionId) toggleProfileSectionCollapsedId(sectionId);
  }

  /**
   * Toggle section collapse from the in-page `h2` or from the contents-row chevron (tab label still navigates).
   * @param {string} sectionId  data-page-id
   */
  function toggleProfileSectionCollapsedId(sectionId) {
    if (!sectionId) return;
    const set = readProfileSectionsCollapsedSet();
    if (set.has(sectionId)) set.delete(sectionId);
    else set.add(sectionId);
    writeProfileSectionsCollapsedSet(set);
    applyProfileSectionCollapseToPages(set);
    applyProfileSectionCollapseToTabAnchors(set);
  }

  /** @param {HTMLElement} pageEl  div.js-sortable--page[data-page-id] */
  function bindProfileSectionPageTitleClickOnPage(pageEl) {
    const sectionId = pageEl.getAttribute("data-page-id");
    if (!sectionId) return;
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (h2.hasAttribute(SECTION_PAGE_TITLE_CLICK_ATTR)) return;

    h2.classList.add(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    h2.setAttribute(SECTION_PAGE_TITLE_CLICK_ATTR, sectionId);

    if (!h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`)) {
      const label = el("span", { class: SECTION_PAGE_TITLE_LABEL_CLASS });
      while (h2.firstChild) label.appendChild(h2.firstChild);
      h2.appendChild(label);
    }

    const ac = new AbortController();
    /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */
    (h2)._oepSectionPageTitleAc = ac;
    h2.addEventListener(
      "click",
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        if (t.closest("a[href]")) return;
        if (t.closest("button")) return;
        if (t.closest("input, select, textarea, label")) return;
        toggleProfileSectionCollapsedId(sectionId);
      },
      { signal: ac.signal },
    );
  }

  function bindProfileSectionPageTitleClicks() {
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement)
        bindProfileSectionPageTitleClickOnPage(page);
    });
  }

  /** @returns {function} */
  function startProfileSectionCollapseManager() {
    sectionCollapseStyle.inject();

    let rebindTimer = 0;
    let obs = null;

    const bind = () => {
      clearTimeout(rebindTimer);
      cleanupProfileSectionCollapseToggles();
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();

      const collapsed = readProfileSectionsCollapsedSet();
      applyProfileSectionCollapseToPages(collapsed);
      applyProfileSectionCollapseToTabAnchors(collapsed);

      bindProfileSectionPageTitleClicks();

      getSectionPageNodes().forEach((node) => {
        const id = node.getAttribute("data-page-id");
        if (!id) return;
        syncProfileSectionPageTitleCollapsedSuffix(node, collapsed.has(id));
      });
    };

    bind();
    document.addEventListener("click", onContentsTabChevronClick, true);
    obs = new MutationObserver((mutations) => {
      const needsRebind = mutationsIncludeSelector(
        mutations,
        'div.js-sortable--page[data-page-id], a[href^="#"], h2.title.title--page-extra',
      );

      if (needsRebind) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearTimeout(rebindTimer);
      obs?.disconnect();
      document.removeEventListener("click", onContentsTabChevronClick, true);
      cleanupProfileSectionCollapseToggles();
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();
      getSectionPageNodes().forEach((node) => {
        node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
        clearProfileSectionCollapseBodyHidden(node);
      });
      document
        .querySelectorAll(`a.${SECTION_TAB_COLLAPSED_CLASS}`)
        .forEach((a) => a.classList.remove(SECTION_TAB_COLLAPSED_CLASS));
      sectionCollapseStyle.remove();
    };
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLAnchorElement} source
   * @returns {HTMLAnchorElement|null}
   */
  function contentsReorderTargetFromPoint(clientX, clientY, source) {
    const row = source.parentElement;
    if (!row) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof Element)) continue;
      const a = n.closest(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`);
      if (
        a instanceof HTMLAnchorElement &&
        a !== source &&
        a.parentElement === row
      )
        return a;
    }
    return null;
  }

  /** @returns {function} */
  function startContentsReorderManager() {
    injectContentsReorderStyles();

    let dragAnchor = null;
    let ghostEl = /** @type {HTMLElement|null} */ (null);
    let obs = null;
    let rebindTimer = 0;
    /** Section IDs in current visual order; null means DOM order is authoritative. */
    let currentTabOrder = /** @type {string[]|null} */ (null);
    /**
     * @type {{
     *   anchor: HTMLAnchorElement;
     *   pointerId: number;
     *   startX: number;
     *   startY: number;
     *   armed: boolean;
     *   onMove: (e: PointerEvent) => void;
     *   onUp: (e: PointerEvent) => void;
     * } | null}
     */
    let pointerSession = null;

    /**
     * Returns anchors in their current visual order.
     * Uses `currentTabOrder` when set, otherwise falls back to DOM order.
     * @param {HTMLElement} row
     * @returns {HTMLAnchorElement[]}
     */
    function getOrderedAnchors(row) {
      const anchors = /** @type {HTMLAnchorElement[]} */ (
        Array.from(
          row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`),
        ).filter((a) => a instanceof HTMLAnchorElement)
      );
      if (!currentTabOrder) return anchors;
      const byId = new Map(
        anchors.map((a) => [
          sectionIdFromHashHref(a.getAttribute("href") || ""),
          a,
        ]),
      );
      const ordered = /** @type {HTMLAnchorElement[]} */ (
        currentTabOrder.map((id) => byId.get(id)).filter(Boolean)
      );
      const inOrder = new Set(currentTabOrder);
      anchors.forEach((a) => {
        const id = sectionIdFromHashHref(a.getAttribute("href") || "");
        if (id && !inOrder.has(id)) ordered.push(a);
      });
      return ordered;
    }

    /**
     * Applies CSS flexbox `order` to visually reorder tabs without touching React-managed DOM nodes.
     * Each chevron button gets an even order value; its anchor gets odd (chevron always visually first).
     * @param {HTMLAnchorElement[]} anchors ordered array representing desired visual sequence
     * @param {HTMLElement} row
     */
    function applyTabCssOrder(anchors) {
      anchors.forEach((a, i) => {
        a.style.order = String(i);
      });
    }

    const removeGhost = () => {
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
    };

    const clearDragClasses = () => {
      if (ghostEl) removeGhost();
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    };

    const saveOrderFrom = async (anchors) => {
      const ids = anchors
        .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
        .filter(Boolean);
      reorderSectionPagesByIds(ids);
      try {
        await persistProfileSectionOrder(ids);
      } catch {
        /* order stays reordered in DOM only */
      }
    };

    function clearRowDropIndicators(row) {
      row
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DRAGOVER_CLASS,
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    }

    function endPointerSession() {
      const s = pointerSession;
      pointerSession = null;
      if (!s) return;
      removeGhost();
      s.anchor.removeEventListener("pointermove", s.onMove);
      s.anchor.removeEventListener("pointerup", s.onUp);
      s.anchor.removeEventListener("pointercancel", s.onUp);
      try {
        s.anchor.releasePointerCapture(s.pointerId);
      } catch (_) {}
    }

    const onPointerDown = (ev) => {
      const anchor = ev.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (ev.button !== 0) return;
      if (pointerSession) return;

      const startX = ev.clientX;
      const startY = ev.clientY;

      const onMove = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.armed) {
          if (Math.hypot(dx, dy) < CONTENTS_REORDER_DRAG_THRESHOLD_PX) return;
          s.armed = true;
          dragAnchor = s.anchor;
          s.anchor.classList.add(CONTENTS_REORDER_DRAGGING_CLASS);
          ghostEl = document.createElement("div");
          ghostEl.className = CONTENTS_REORDER_GHOST_CLASS;
          ghostEl.textContent = s.anchor.textContent || "";
          document.body.appendChild(ghostEl);
        }
        if (ghostEl) {
          ghostEl.style.left = `${e.clientX}px`;
          ghostEl.style.top = `${e.clientY}px`;
        }
        const row = s.anchor.parentElement;
        if (!(row instanceof HTMLElement)) return;
        const hit = contentsReorderTargetFromPoint(
          e.clientX,
          e.clientY,
          s.anchor,
        );
        clearRowDropIndicators(row);
        if (hit) {
          const hitRect = hit.getBoundingClientRect();
          const insertAfter = e.clientX > hitRect.left + hitRect.width / 2;
          hit.classList.add(
            insertAfter
              ? CONTENTS_REORDER_DROP_AFTER_CLASS
              : CONTENTS_REORDER_DROP_BEFORE_CLASS,
          );
        }
      };

      const onUp = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        endPointerSession();

        if (s.armed && dragAnchor) {
          const hit = contentsReorderTargetFromPoint(
            e.clientX,
            e.clientY,
            s.anchor,
          );
          const row = s.anchor.parentElement;
          if (
            hit &&
            dragAnchor &&
            hit !== dragAnchor &&
            row &&
            hit.parentElement === row
          ) {
            hit.classList.remove(
              CONTENTS_REORDER_DROP_BEFORE_CLASS,
              CONTENTS_REORDER_DROP_AFTER_CLASS,
            );
            const targetRect = hit.getBoundingClientRect();
            const insertAfter = e.clientX > targetRect.left + targetRect.width / 2;

            const currentAnchors = getOrderedAnchors(row);
            const newAnchors = currentAnchors.filter((a) => a !== dragAnchor);
            const hitIdx = newAnchors.indexOf(hit);
            newAnchors.splice(insertAfter ? hitIdx + 1 : hitIdx, 0, dragAnchor);

            currentTabOrder = newAnchors
              .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
              .filter(Boolean);
            applyTabCssOrder(newAnchors);
            void saveOrderFrom(newAnchors);
          }
          const suppressClick = (ce) => {
            ce.preventDefault();
            ce.stopPropagation();
            s.anchor.removeEventListener("click", suppressClick, true);
          };
          s.anchor.addEventListener("click", suppressClick, true);
        }

        removeGhost();
        dragAnchor = null;
        clearDragClasses();
      };

      pointerSession = {
        anchor,
        pointerId: ev.pointerId,
        startX,
        startY,
        armed: false,
        onMove,
        onUp,
      };

      try {
        anchor.setPointerCapture(ev.pointerId);
      } catch (_) {}

      anchor.addEventListener("pointermove", onMove);
      anchor.addEventListener("pointerup", onUp);
      anchor.addEventListener("pointercancel", onUp);
    };

    const bind = () => {
      clearTimeout(rebindTimer);
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      const groups = getSortableContentsAnchorGroups();
      const visibleGroup = getPreferredVisibleContentsGroup(groups);
      cleanupContentsReorderHints();

      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
          );
        });

      groups.flat().forEach((a) => {
        a.setAttribute(CONTENTS_REORDER_ANCHOR_ATTR, "1");
        a.removeAttribute("draggable");
        a.setAttribute("title", `Drag to reorder`);
        a.addEventListener("pointerdown", onPointerDown);
      });

      if (currentTabOrder) {
        groups.forEach((anchors) => {
          const row = anchors[0]?.parentElement;
          if (!(row instanceof HTMLElement)) return;
          applyTabCssOrder(getOrderedAnchors(row));
        });
      }
    };

    bind();
    obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          'div.js-sortable--page[data-page-id], a[href^="#"]',
        )
      ) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearTimeout(rebindTimer);
      obs?.disconnect();
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DRAGOVER_CLASS,
          );
        });
      cleanupContentsReorderHints();
      removeContentsReorderStyles();
    };
  }

  let _scoreCleanup = null;
  let _recentFailsCleanup = null;

  /**
   * @param {RegExpMatchArray} _match
   * @returns {function}
   */
  function init(_match) {
    const cleanups = [];

    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(
        settings,
        manageStyle,
      ),
    );
    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );

    cleanups.push(
      OsuExpertPlus.beatmapCardExtra.start(settings, {
        hookProfileExtraPages: true,
      }),
    );

    cleanups.push(startRanksDateHighlightManager());
    cleanups.push(startProfileBadgesCollapseManager());
    cleanups.push(startProfileSectionCollapseManager());
    cleanups.push(startProfileSubsectionCollapseManager());
    cleanups.push(startBbcodeHelperManager());
    const profileUserId = getProfileUserId();
    const currentUserId = getCurrentUserIdFromHeader();
    if (
      profileUserId != null &&
      currentUserId != null &&
      String(profileUserId) === String(currentUserId)
    ) {
      cleanups.push(startContentsReorderManager());
    }

    const needsScoreFeatures = true;

    if (needsScoreFeatures) {
      const userId = profileUserId;
      const mode = getCurrentMode();
      if (userId) {
        initScoreFeatures(userId, mode).then((cleanup) => {
          _scoreCleanup = cleanup;
        });
        _recentFailsCleanup = startRecentScoresWithFailsObserver(userId, mode);
      }
    }

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      if (typeof _recentFailsCleanup === "function") {
        _recentFailsCleanup();
        _recentFailsCleanup = null;
      }
      if (typeof _scoreCleanup === "function") {
        _scoreCleanup();
        _scoreCleanup = null;
      }
    };
  }

  return { name, init };
})();
