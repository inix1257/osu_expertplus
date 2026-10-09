/**
 * Expert+ Recent: mount the list in place of osu-web's Recent section (WS-41).
 */

import {
  applyModIconsAsAcronyms,
  el,
  injectModIconsAcronymStyles,
  settingIds,
  settings,
} from "../../legacy.js";
import {
  MODDED_SR_ID,
  _attrsSessionCache,
  _writeBeatmapAttrsGmStore,
} from "../beatmap-attributes.js";
import {
  _observeRow,
  _srObserver,
  initSrObserver,
  processElements,
} from "../modded-sr.js";
import { mutationsIncludeSelector } from "../mutations.js";
import {
  RANKS_CARD_BG_FEATURE_ID,
  applyRanksCardBackgrounds,
  injectRanksCardBgLayoutStyles,
} from "../ranks-period.js";
import {
  RECENT_FAILS_EMPTY_FILTERED_MSG,
  RECENT_FAILS_EMPTY_MSG,
  RECENT_FAILS_HEADER_CLASS,
  RECENT_FAILS_WRAP_CLASS,
  enrichPlayDetailRowsMaxComboFromAttributes,
  filterScoresForRecentDisplay,
  findRecentPlaysListRoot,
  recentScoresFullCache,
  removeOfficialRecentPlaysSection,
} from "./common.js";
import { fetchRecentScoresIncludingFails } from "./data.js";
import { findOsuModTemplateNode, waitForOsuModTemplate } from "./mods.js";
import {
  SCORE_OPTIONS_BTN_CLASS,
  buildScoreOptionsMenu,
  disposeScoreOptionsMenus,
  removeScoreOptionsMenu,
} from "./options-menu.js";
import { buildPlayDetailRowFromApiScore } from "./row-builder.js";
import {
  RECENT_SCORES_SHOW_FAILS_ID,
  SCORE_HIT_STATISTICS_ID,
  SCORE_LIST_LAYOUT_CLASS,
  SCORE_PLACE_NUMBER_ID,
  SCORE_PP_DECIMALS_ID,
  applyPlaceNumbers,
  applyPpDecimals,
  revertPlaceNumbers,
  scorePlaceNumberStyle,
  syncScoreListPpDecimalsWidthClass,
} from "../score-rows.js";
import { applyHideWeightedPp } from "../score-stats.js";
import { playDetailStyle } from "../styles.js";
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
    removeScoreOptionsMenu(b);
  });
  innerList.textContent = "";
  innerList.classList.toggle(
    SCORE_LIST_LAYOUT_CLASS,
    settings().isEnabled(SCORE_HIT_STATISTICS_ID),
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
  if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) {
    applyPpDecimals(innerList);
  }
  if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
    processElements(rows, scores);
    enrichPlayDetailRowsMaxComboFromAttributes(rows, scores, innerList);
  }
  if (settings().isEnabled(settingIds().MOD_ICONS_AS_ACRONYMS)) {
    injectModIconsAcronymStyles();
    applyModIconsAsAcronyms(innerList);
  }
  if (settings().isEnabled(MODDED_SR_ID)) {
    if (!_srObserver) initSrObserver();
    rows.forEach(_observeRow);
  }
  if (settings().isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
    injectRanksCardBgLayoutStyles();
    applyRanksCardBackgrounds(innerList);
  }
  if (settings().isEnabled(SCORE_PLACE_NUMBER_ID)) {
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
  const showFails = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
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
  showFailsCb.checked = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
  showFailsCb.addEventListener("change", () => {
    settings().set(RECENT_SCORES_SHOW_FAILS_ID, showFailsCb.checked);
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

  const showFails = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
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
export function startRecentScoresWithFailsObserver(userId, mode) {
  let cancelled = false;

  const unsubRecentFailsShow = settings().onChange(
    RECENT_SCORES_SHOW_FAILS_ID,
    () => {
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (!(w instanceof HTMLElement)) return;
        const input = w.querySelector("input.oep-recent-show-fails");
        const on = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
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
  const unsubRecentPpDecimals = settings().onChange(
    SCORE_PP_DECIMALS_ID,
    repopulateRecentOnScoreDisplayChange,
  );
  const unsubRecentHitStatistics = settings().onChange(
    SCORE_HIT_STATISTICS_ID,
    repopulateRecentOnScoreDisplayChange,
  );
  const unsubRecentPlaceNumbers = settings().onChange(
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
    disposeScoreOptionsMenus();
  };
}
