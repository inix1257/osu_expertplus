/**
 * The scoreboard mod grid (WS-32): osu-web's mod strip rearranged into
 * stable/lazer columns and difficulty rows, with merged DT↔NC and SD↔PF
 * controls, wildcard clicks and a Reset button.
 */

import { observe } from "../../../core/observe.js";
import {
  CREDENTIALS_CHANGED_EVENT,
  getActiveBeatmapScoreboardFilterMods,
  MERGED_MOD_ATTR,
  MOD_GRID_CLASS,
  MOD_HIDDEN_ATTR,
  SCOREBOARD_MODS_SEL,
} from "../context.js";
import {
  el,
  isAuthConfigured,
  settingIds,
  settings,
  waitForElement,
} from "../../legacy.js";
import { clearMergedLeaderboard } from "../merged-leaderboard.js";
import { destroyOsuWebQtipOnElementSubtree } from "../../osu-web-qtip.js";
import { cancelClicks, queueClicks } from "./click-runner.js";
import {
  applyMergedModTargetStep,
  isMergedMember,
  mergedModGridEffectiveStepCount,
  reconcileMergedModCycleFromDom,
  syncMergedModCloneHighlights,
} from "./merged-cycle.js";
import {
  getWildcardMods,
  hiddenOriginals,
  isBeatmapScoreboardModStripButtonOn,
  isGridCloneOn,
  isWildcard,
  MERGED_MOD_DT_NC,
  MERGED_MOD_SD_PF,
  MOD_GRID_ATTR,
  MOD_GRID_COLLAPSED_CLASS,
  modButtonAcronym,
  modDifficultyRow,
  resetModFilterState,
  setGridCloneOn,
  STABLE_MOD_ACRONYMS,
  state,
} from "./state.js";
import {
  clearWildcardState,
  disableWildcard,
  enableWildcard,
  getWildcardBeatmapKey,
  getWildcardEnabledMods,
  isWildcardFeatureAvailable,
  scheduleWildcardFetch,
  setCloneWildcardClass,
  syncWildcardLoadingOverlay,
  updateCloneWildcardVisual,
} from "./wildcard.js";

/**
 * Turn off each active mod filter by clicking the real strip buttons (not NM — that toggles “no mod”).
 * One click per frame so React can settle (exclusive mods, URL sync).
 * @param {HTMLElement} modsEl
 */
export function resetBeatmapScoreboardModSelection(modsEl) {
  cancelClicks();
  state.mergedStep.clear();
  state.mergedTarget.clear();
  const hadWildcards = getWildcardMods().length > 0;
  if (hadWildcards) {
    clearWildcardState();
    for (const orig of hiddenOriginals(modsEl)) {
      const ac = modButtonAcronym(orig);
      if (!ac) continue;
      updateCloneWildcardVisual(ac, modsEl, false);
    }
    const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
    if (scoreboardRoot instanceof HTMLElement) {
      clearMergedLeaderboard(scoreboardRoot, "wildcard");
    }
  }

  for (const orig of hiddenOriginals(modsEl)) {
    const clone = state.originalToClone.get(orig);
    if (clone instanceof HTMLElement) setGridCloneOn(clone, false);
  }

  queueClicks({
    key: "reset",
    next: () =>
      hiddenOriginals(modsEl).find((btn) => {
        const ac = modButtonAcronym(btn);
        return ac && ac !== "NM" && isBeatmapScoreboardModStripButtonOn(btn);
      }) ?? null,
    done: () => {
      syncBeatmapModGridCloneHighlights(modsEl);
      syncBeatmapScoreboardModResetButton(modsEl);
    },
  });
}

/**
 * @param {HTMLElement} modsEl
 */
export function syncBeatmapScoreboardModResetButton(modsEl) {
  const resetBtn = modsEl.querySelector(
    `:scope > .${MOD_GRID_CLASS}__hdr-corner .${MOD_GRID_CLASS}__reset-mods`,
  );
  if (!(resetBtn instanceof HTMLButtonElement)) return;
  const root = modsEl.closest(".beatmapset-scoreboard");
  const active =
    root instanceof HTMLElement
      ? getActiveBeatmapScoreboardFilterMods(root)
      : [];
  const hasWildcards = getWildcardMods().length > 0;
  const hasEnabledInWildcardMode =
    hasWildcards && getWildcardEnabledMods(modsEl).length > 0;
  resetBtn.disabled =
    active.length === 0 && !hasWildcards && !hasEnabledInWildcardMode;
}

/**
 * Copies markup from the hidden React strip button onto the visible grid clone.
 * @param {HTMLElement} clone
 * @param {HTMLElement} original
 */
export function replaceBeatmapModGridCloneInnerHTML(clone, original) {
  if (!(clone instanceof HTMLElement) || !(original instanceof HTMLElement))
    return;
  if (clone.innerHTML === original.innerHTML) return;
  destroyOsuWebQtipOnElementSubtree(clone);
  clone.innerHTML = original.innerHTML;
}

/**
 * Mirror osu-web state from hidden originals onto visible pile clones (selection highlight, counts).
 * @param {HTMLElement} modsEl
 */
export function syncBeatmapModGridCloneHighlights(modsEl) {
  if (!modsEl.hasAttribute(MOD_GRID_ATTR)) return;
  const hasActiveWildcards = getWildcardMods().length > 0;

  for (const clone of modsEl.querySelectorAll(`[${MERGED_MOD_ATTR}]`)) {
    if (!(clone instanceof HTMLElement)) continue;
    const mergeId = clone.getAttribute(MERGED_MOD_ATTR);
    if (mergeId) syncMergedModCloneHighlights(modsEl, clone, mergeId);
  }

  for (const original of hiddenOriginals(modsEl)) {
    const ac = modButtonAcronym(original);
    if (isMergedMember(modsEl, ac)) continue;
    const clone = state.originalToClone.get(original);
    if (!(clone instanceof HTMLElement)) continue;

    if (ac && isWildcard(ac)) {
      replaceBeatmapModGridCloneInnerHTML(clone, original);
      clone.disabled = original.disabled;
      setGridCloneOn(clone, false);
      setCloneWildcardClass(clone, true);
      continue;
    }

    if (hasActiveWildcards) {
      replaceBeatmapModGridCloneInnerHTML(clone, original);
      clone.disabled = original.disabled;
      setGridCloneOn(clone, isBeatmapScoreboardModStripButtonOn(original));
      setCloneWildcardClass(clone, false);
      continue;
    }

    if (clone.className !== original.className) {
      clone.className = original.className;
    }

    for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
      const v = original.getAttribute(attr);
      if (v == null) clone.removeAttribute(attr);
      else clone.setAttribute(attr, v);
    }

    clone.disabled = original.disabled;

    replaceBeatmapModGridCloneInnerHTML(clone, original);

    setCloneWildcardClass(clone, false);
  }
}

/**
 * @param {HTMLElement} modsEl
 */
export function stopBeatmapScoreboardModGridLive(modsEl) {
  cancelClicks();
  state.mergedTarget.clear();
  teardownBeatmapModGrid(modsEl);
}

export function teardownBeatmapModGrid(modsEl) {
  if (!(modsEl instanceof HTMLElement)) return;

  clearWildcardState();
  const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
  if (scoreboardRoot instanceof HTMLElement) {
    clearMergedLeaderboard(scoreboardRoot, "wildcard");
  }

  modsEl.removeAttribute(MOD_GRID_ATTR);
  modsEl.classList.remove(MOD_GRID_CLASS, MOD_GRID_COLLAPSED_CLASS);

  // Unhide original React-managed buttons (kept in place, never moved).
  for (const btn of modsEl.querySelectorAll(`:scope > [${MOD_HIDDEN_ATTR}]`)) {
    btn.removeAttribute(MOD_HIDDEN_ATTR);
  }

  // Remove our grid elements (headers, labels, piles containing clones).
  for (const ch of [...modsEl.children]) {
    if (!ch.classList.contains("beatmap-scoreboard-mod")) {
      ch.remove();
    }
  }
}

/**
 * @param {HTMLElement} modsEl
 * @param {Record<string, HTMLElement>} piles
 * @param {HTMLElement} btn
 * @param {string} pileKey
 */
function placeBeatmapModGridSingleClone(modsEl, piles, btn, pileKey) {
  const clone = btn.cloneNode(true);
  state.originalToClone.set(btn, clone);
  clone.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const ac = modButtonAcronym(btn);
    if (!ac || ac === "NM" || !isWildcardFeatureAvailable()) {
      btn.click();
      window.requestAnimationFrame(() => {
        syncBeatmapModGridCloneHighlights(modsEl);
      });
      return;
    }

    const hasWildcards = getWildcardMods().length > 0;
    const isCurrentlyWildcard = isWildcard(ac);
    const cloneIsEnabled = isGridCloneOn(clone);

    if (isCurrentlyWildcard) {
      disableWildcard(ac, modsEl);
      setGridCloneOn(clone, false);
      scheduleWildcardFetch(modsEl);
    } else if (cloneIsEnabled) {
      if (!hasWildcards) {
        btn.click();
      }
      enableWildcard(ac, modsEl);
      updateCloneWildcardVisual(ac, modsEl, true);
      setGridCloneOn(clone, false);
      window.requestAnimationFrame(() => {
        syncBeatmapModGridCloneHighlights(modsEl);
      });
      scheduleWildcardFetch(modsEl);
    } else {
      if (hasWildcards) {
        setGridCloneOn(clone, true);
        scheduleWildcardFetch(modsEl);
      } else {
        btn.click();
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
      }
    }
    syncBeatmapScoreboardModResetButton(modsEl);
  });
  piles[pileKey]?.appendChild(clone);
  btn.setAttribute(MOD_HIDDEN_ATTR, "1");
}

/**
 * @param {HTMLElement} modsEl
 * @param {Record<string, HTMLElement>} piles
 * @param {string} mergeId
 * @param {HTMLElement} primaryOriginal
 * @param {HTMLElement} secondaryOriginal
 * @param {string} pileKey
 */
function placeBeatmapModGridMergedPair(
  modsEl,
  piles,
  mergeId,
  primaryOriginal,
  secondaryOriginal,
  pileKey,
) {
  const clone = primaryOriginal.cloneNode(true);
  clone.setAttribute(MERGED_MOD_ATTR, mergeId);
  state.originalToClone.set(primaryOriginal, clone);
  state.originalToClone.set(secondaryOriginal, clone);
  clone.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Count from the step a running click plan is heading to, so a second
    // click before it finishes is not lost (B80).
    const max = mergedModGridEffectiveStepCount(mergeId);
    const cur =
      state.mergedTarget.get(mergeId) ?? state.mergedStep.get(mergeId) ?? 0;
    applyMergedModTargetStep(modsEl, mergeId, (cur + 1) % max);
  });
  piles[pileKey]?.appendChild(clone);
  primaryOriginal.setAttribute(MOD_HIDDEN_ATTR, "1");
  secondaryOriginal.setAttribute(MOD_HIDDEN_ATTR, "1");
}

/**
 * Stable column order: r0 = EZ,NF,HT; r1 = HR,HD,DT↔NC,FL,SD↔PF;
 * r2 = NM then remaining stable acronyms. Lazer column unchanged from osu-web row types.
 * @param {HTMLElement} modsEl
 * @param {Record<string, HTMLElement>} piles
 */
function placeBeatmapModGridButtons(modsEl, piles) {
  const directList = [
    ...modsEl.querySelectorAll(":scope > .beatmap-scoreboard-mod"),
  ];
  /** @type {Map<string, HTMLElement>} */
  const byAc = new Map();
  for (const btn of directList) {
    if (!(btn instanceof HTMLElement)) continue;
    const ac = modButtonAcronym(btn);
    if (ac) byAc.set(ac, btn);
  }

  const STABLE_R0 = ["EZ", "NF", "HT"];
  const placedStable = new Set();

  for (const ac of STABLE_R0) {
    const b = byAc.get(ac);
    if (b) {
      placeBeatmapModGridSingleClone(modsEl, piles, b, "r0-stable");
      placedStable.add(ac);
    }
  }

  for (const ac of ["HR", "HD"]) {
    const b = byAc.get(ac);
    if (b) {
      placeBeatmapModGridSingleClone(modsEl, piles, b, "r1-stable");
      placedStable.add(ac);
    }
  }

  const dtB = byAc.get("DT");
  const ncB = byAc.get("NC");
  if (dtB && ncB) {
    placeBeatmapModGridMergedPair(
      modsEl,
      piles,
      MERGED_MOD_DT_NC,
      dtB,
      ncB,
      "r1-stable",
    );
    placedStable.add("DT");
    placedStable.add("NC");
  } else {
    if (dtB) {
      placeBeatmapModGridSingleClone(modsEl, piles, dtB, "r1-stable");
      placedStable.add("DT");
    }
    if (ncB) {
      placeBeatmapModGridSingleClone(modsEl, piles, ncB, "r1-stable");
      placedStable.add("NC");
    }
  }

  const flB = byAc.get("FL");
  if (flB) {
    placeBeatmapModGridSingleClone(modsEl, piles, flB, "r1-stable");
    placedStable.add("FL");
  }

  const sdB = byAc.get("SD");
  const pfB = byAc.get("PF");
  if (sdB && pfB) {
    placeBeatmapModGridMergedPair(
      modsEl,
      piles,
      MERGED_MOD_SD_PF,
      sdB,
      pfB,
      "r1-stable",
    );
    placedStable.add("SD");
    placedStable.add("PF");
  } else {
    if (sdB) {
      placeBeatmapModGridSingleClone(modsEl, piles, sdB, "r1-stable");
      placedStable.add("SD");
    }
    if (pfB) {
      placeBeatmapModGridSingleClone(modsEl, piles, pfB, "r1-stable");
      placedStable.add("PF");
    }
  }

  const nmLeft = byAc.get("NM");
  if (nmLeft && !placedStable.has("NM")) {
    placeBeatmapModGridSingleClone(modsEl, piles, nmLeft, "r2-stable");
    placedStable.add("NM");
  }

  for (const btn of directList) {
    if (!(btn instanceof HTMLElement)) continue;
    const ac = modButtonAcronym(btn);
    if (!ac) continue;
    if (placedStable.has(ac)) continue;
    if (!STABLE_MOD_ACRONYMS.has(ac)) {
      const modInner = btn.querySelector(".mod");
      const row =
        modInner instanceof HTMLElement ? modDifficultyRow(modInner) : 2;
      const key = `r${row}-lazer`;
      placeBeatmapModGridSingleClone(modsEl, piles, btn, key);
      continue;
    }
    placeBeatmapModGridSingleClone(modsEl, piles, btn, "r2-stable");
  }
}

/**
 * @param {HTMLElement} modsEl
 * @param {typeof el} elFn
 */
export function applyBeatmapModGrid(modsEl, elFn) {
  const directButtons = modsEl.querySelectorAll(
    ":scope > .beatmap-scoreboard-mod",
  );
  if (!directButtons.length) return;

  teardownBeatmapModGrid(modsEl);

  modsEl.setAttribute(MOD_GRID_ATTR, "1");

  const collapseToggle = elFn(
    "button",
    {
      type: "button",
      class: `${MOD_GRID_CLASS}__collapse-toggle`,
      "aria-expanded": "true",
      "aria-label": "Collapse mod filter grid",
    },
    elFn("span", { class: `${MOD_GRID_CLASS}__collapse-label` }, "Mod filters"),
    elFn("i", { class: "fas fa-chevron-down", "aria-hidden": "true" }),
  );
  const toggleRow = elFn(
    "div",
    { class: `${MOD_GRID_CLASS}__toggle-row` },
    collapseToggle,
  );
  collapseToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const collapsed = modsEl.classList.toggle(MOD_GRID_COLLAPSED_CLASS);
    collapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    collapseToggle.setAttribute(
      "aria-label",
      collapsed ? "Expand mod filter grid" : "Collapse mod filter grid",
    );
  });

  const headStable = elFn(
    "div",
    { class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__hdr-stable` },
    "Stable mods",
  );

  const corner = elFn("div", { class: `${MOD_GRID_CLASS}__hdr-corner` });
  const resetModsBtn = elFn(
    "button",
    {
      type: "button",
      class: `${MOD_GRID_CLASS}__reset-mods`,
      title: "Clear all selected mod filters",
      "aria-label": "Reset mod selection — turn off each selected mod",
    },
    "Reset",
  );
  resetModsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetBeatmapScoreboardModSelection(modsEl);
  });
  corner.appendChild(resetModsBtn);

  const headLazer = elFn(
    "div",
    {
      class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__colhead--lazer ${MOD_GRID_CLASS}__hdr-lazer`,
    },
    elFn("span", {}, "Lazer mods"),
  );

  const label0 = elFn(
    "div",
    { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r0-label` },
    "Difficulty decrease mods",
  );
  const label1 = elFn(
    "div",
    { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r1-label` },
    "Difficulty increase mods",
  );
  const label2 = elFn(
    "div",
    { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r2-label` },
    "For fun mods",
  );

  /** @type {Record<string, HTMLElement>} */
  const piles = {
    "r0-stable": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-stable`,
    }),
    "r0-lazer": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-lazer`,
    }),
    "r1-stable": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-stable`,
    }),
    "r1-lazer": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-lazer`,
    }),
    "r2-stable": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-stable`,
    }),
    "r2-lazer": elFn("div", {
      class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-lazer`,
    }),
  };

  const frag = document.createDocumentFragment();
  for (const node of [
    toggleRow,
    corner,
    headStable,
    headLazer,
    label0,
    label1,
    label2,
    piles["r0-stable"],
    piles["r0-lazer"],
    piles["r1-stable"],
    piles["r1-lazer"],
    piles["r2-stable"],
    piles["r2-lazer"],
  ]) {
    frag.appendChild(node);
  }
  modsEl.appendChild(frag);

  placeBeatmapModGridButtons(modsEl, piles);

  if (isAuthConfigured()) {
    piles["r2-stable"].appendChild(
      elFn(
        "div",
        {
          class: `${MOD_GRID_CLASS}__wildcard-guide`,
          role: "note",
        },
        elFn(
          "div",
          { class: `${MOD_GRID_CLASS}__wildcard-guide-row` },
          elFn("span", {
            class: `${MOD_GRID_CLASS}__wildcard-guide-icon`,
            "aria-hidden": "true",
          }),
          elFn(
            "p",
            { class: `${MOD_GRID_CLASS}__wildcard-guide-text` },
            elFn("strong", {}, "Wildcard"),
            ": click an enabled mod again. Wildcard mods ",
            elFn("strong", {}, "may or may not"),
            " appear on each score.",
          ),
        ),
      ),
    );
  }

  reconcileMergedModCycleFromDom(modsEl);

  syncBeatmapModGridCloneHighlights(modsEl);
  syncBeatmapScoreboardModResetButton(modsEl);
}

/** Strip buttons the grid hid, and anything inside them. */
const HIDDEN_ORIGINAL_TREE_SEL = `.beatmapset-scoreboard__mods > [${MOD_HIDDEN_ATTR}], .beatmapset-scoreboard__mods > [${MOD_HIDDEN_ATTR}] *`;

/**
 * Builds the grid once osu-web's mod strip exists and keeps it in sync. Each
 * call owns its subscriptions, so the dispose of a superseded setup cannot
 * stop a newer one's.
 * @returns {Promise<function(): void>}
 */
export async function setupBeatmapScoreboardModGrid() {
  if (!settings().isEnabled(settingIds().SCOREBOARD_MOD_GRID)) {
    return () => {};
  }

  /** @type {HTMLElement|null} */
  let modsEl;
  try {
    modsEl = await waitForElement(SCOREBOARD_MODS_SEL, 20000);
  } catch {
    return () => {};
  }
  if (!(modsEl instanceof HTMLElement) || !document.body.contains(modsEl)) {
    return () => {};
  }
  const grid = modsEl;
  const scoreboardRoot = grid.closest(".beatmapset-scoreboard");
  const ac = new AbortController();
  const { signal } = ac;

  // osu-web added (or re-rendered) strip buttons: rebuild the grid around
  // the ones not hidden yet.
  observe.subscribe(
    {
      selector: ".beatmap-scoreboard-mod",
      schedule: 0,
      signal,
      label: "scoreboard/mod-grid",
    },
    () => {
      if (!document.body.contains(grid)) return;
      try {
        if (
          grid.querySelector(
            `:scope > .beatmap-scoreboard-mod:not([${MOD_HIDDEN_ATTR}])`,
          )
        ) {
          applyBeatmapModGrid(grid, el);
        }
      } catch (_) {}
    },
  );

  const onScoreboardTabClick = (e) => {
    const tab = e.target?.closest?.(".page-tabs__tab");
    if (!(tab instanceof HTMLElement)) return;
    if (
      !(scoreboardRoot instanceof HTMLElement) ||
      !scoreboardRoot.contains(tab)
    ) {
      return;
    }
    if (getWildcardMods().length > 0) scheduleWildcardFetch(grid);
  };
  if (scoreboardRoot instanceof HTMLElement) {
    scoreboardRoot.addEventListener("click", onScoreboardTabClick, {
      capture: true,
      signal,
    });

    // osu-web switches difficulty through the history API (no hashchange) and
    // re-renders the scoreboard table, so detect the beatmap change from
    // there. Wildcard results are per beatmap: drop them and refetch for the
    // new one. Only writes when the key actually changes, so our own writes
    // can't loop.
    let wildcardBeatmapKey = getWildcardBeatmapKey();
    observe.subscribe(
      {
        selector:
          ".beatmap-scoreboard-table, .beatmap-scoreboard-table__body-row, .beatmapset-scoreboard__notice",
        schedule: "sync",
        signal,
        label: "scoreboard/wildcard-beatmap",
      },
      () => {
        syncWildcardLoadingOverlay(scoreboardRoot);
        const key = getWildcardBeatmapKey();
        if (key === wildcardBeatmapKey) return;
        wildcardBeatmapKey = key;
        if (getWildcardMods().length === 0) return;
        clearMergedLeaderboard(scoreboardRoot, "wildcard");
        scheduleWildcardFetch(grid);
      },
    );
  }

  applyBeatmapModGrid(grid, el);

  // osu-web updated a hidden original (selection, counts, disabled): mirror
  // it onto the clones.
  observe.subscribe(
    {
      selector: HIDDEN_ORIGINAL_TREE_SEL,
      attributes: ["class", "aria-pressed", "aria-disabled", "title"],
      characterData: true,
      schedule: 0,
      signal,
      label: "scoreboard/mod-grid-state",
    },
    () => {
      if (!document.body.contains(grid)) return;
      syncBeatmapModGridCloneHighlights(grid);
      syncBeatmapScoreboardModResetButton(grid);
    },
  );

  const onCredsChange = () => {
    if (isAuthConfigured()) return;
    clearWildcardState();
    if (scoreboardRoot instanceof HTMLElement) {
      clearMergedLeaderboard(scoreboardRoot, "wildcard");
    }
    syncBeatmapModGridCloneHighlights(grid);
    syncBeatmapScoreboardModResetButton(grid);
  };
  window.addEventListener(CREDENTIALS_CHANGED_EVENT, onCredsChange, {
    signal,
  });

  return () => {
    ac.abort();
    clearWildcardState();
    cancelClicks();
    if (document.body.contains(grid)) stopBeatmapScoreboardModGridLive(grid);
    resetModFilterState();
  };
}
