/**
 * The scoreboard mod grid (WS-32): osu-web's mod strip rearranged into
 * stable/lazer columns and difficulty rows, with merged DT↔NC and SD↔PF
 * controls, wildcard clicks and a Reset button.
 */

import {
  CREDENTIALS_CHANGED_EVENT,
  getActiveBeatmapScoreboardFilterMods,
  MERGED_MOD_ATTR,
  MOD_GRID_CLASS,
  MOD_HIDDEN_ATTR,
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
import { runClicks } from "./click-runner.js";
import {
  applyMergedModTargetStep,
  isMergedMember,
  mergedModGridEffectiveStepCount,
  reconcileMergedModCycleFromDom,
  syncMergedModCloneHighlights,
} from "./merged-cycle.js";
import {
  getWildcardMods,
  HIDDEN_ORIGINAL_SEL,
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

const MOD_RESET_BTN_SYNC_ATTR = "data-oep-mod-reset-sync-obs";
/** Live MO + debounce ids for `.beatmapset-scoreboard__mods` (tear down if setting flips off mid-setup). */
const beatmapModGridLiveHandles = new WeakMap();

/**
 * Turn off each active mod filter by clicking the real strip buttons (not NM — that toggles “no mod”).
 * One click per frame so React can settle (exclusive mods, URL sync).
 * @param {HTMLElement} modsEl
 */
export function resetBeatmapScoreboardModSelection(modsEl) {
  state.mergedStep.clear();
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

  runClicks({
    maxSteps: 40,
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
  const h = beatmapModGridLiveHandles.get(modsEl);
  if (h) {
    window.clearTimeout(h.debounceId);
    window.clearTimeout(h.modStateDebounceId);
    h.mo?.disconnect();
    h.modStateMo?.disconnect();
    beatmapModGridLiveHandles.delete(modsEl);
  }
  modsEl.removeAttribute(MOD_RESET_BTN_SYNC_ATTR);
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
    const max = mergedModGridEffectiveStepCount(mergeId);
    const cur = state.mergedStep.get(mergeId) ?? 0;
    const next = (cur + 1) % max;
    applyMergedModTargetStep(modsEl, mergeId, next);
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

/**
 * @returns {Promise<function(): void>}
 */
export async function setupBeatmapScoreboardModGrid() {
  if (!settings().isEnabled(settingIds().SCOREBOARD_MOD_GRID)) {
    return () => {};
  }

  let modsEl = null;
  /** @type {{ mo: MutationObserver|null, modStateMo: MutationObserver|null, debounceId: number, modStateDebounceId: number }|null} */
  let handles = null;

  function scheduleApply() {
    if (!handles || !modsEl) return;
    window.clearTimeout(handles.debounceId);
    handles.debounceId = window.setTimeout(() => {
      handles.debounceId = 0;
      if (!modsEl || !document.body.contains(modsEl)) return;
      try {
        if (
          modsEl.querySelector(
            `:scope > .beatmap-scoreboard-mod:not([${MOD_HIDDEN_ATTR}])`,
          )
        ) {
          applyBeatmapModGrid(modsEl, el);
        }
      } catch (_) {}
    }, 0);
  }

  try {
    modsEl = await waitForElement(".beatmapset-scoreboard__mods", 20000);
  } catch {
    return () => {};
  }

  if (!document.body.contains(modsEl)) return () => {};

  handles = {
    mo: null,
    modStateMo: null,
    debounceId: 0,
    modStateDebounceId: 0,
  };
  beatmapModGridLiveHandles.set(modsEl, handles);

  const scoreboardRootForTabs = modsEl.closest(".beatmapset-scoreboard");
  const onScoreboardTabClick = (e) => {
    const tab = e.target?.closest?.(".page-tabs__tab");
    if (!(tab instanceof HTMLElement)) return;
    if (
      !(scoreboardRootForTabs instanceof HTMLElement) ||
      !scoreboardRootForTabs.contains(tab)
    ) {
      return;
    }
    if (getWildcardMods().length > 0) scheduleWildcardFetch(modsEl);
  };
  if (scoreboardRootForTabs instanceof HTMLElement) {
    scoreboardRootForTabs.addEventListener("click", onScoreboardTabClick, true);
  }

  // osu-web switches difficulty through the history API (no hashchange) and only
  // re-renders the scoreboard table, so detect the beatmap change from there.
  // Wildcard results are per beatmap: drop them and refetch for the new one.
  // Only writes when the key actually changes, so our own writes can't loop.
  let wildcardBeatmapKey = getWildcardBeatmapKey();
  const onScoreboardMutation = () => {
    if (scoreboardRootForTabs instanceof HTMLElement) {
      syncWildcardLoadingOverlay(scoreboardRootForTabs);
    }
    const key = getWildcardBeatmapKey();
    if (key === wildcardBeatmapKey) return;
    wildcardBeatmapKey = key;
    if (!modsEl || getWildcardMods().length === 0) return;
    if (scoreboardRootForTabs instanceof HTMLElement) {
      clearMergedLeaderboard(scoreboardRootForTabs, "wildcard");
    }
    scheduleWildcardFetch(modsEl);
  };
  const beatmapChangeMo =
    scoreboardRootForTabs instanceof HTMLElement
      ? new MutationObserver(onScoreboardMutation)
      : null;
  beatmapChangeMo?.observe(scoreboardRootForTabs, {
    childList: true,
    subtree: true,
  });

  handles.mo = new MutationObserver(scheduleApply);
  handles.mo.observe(modsEl, { childList: true });
  applyBeatmapModGrid(modsEl, el);

  if (!modsEl.hasAttribute(MOD_RESET_BTN_SYNC_ATTR)) {
    modsEl.setAttribute(MOD_RESET_BTN_SYNC_ATTR, "1");
    const scheduleModStateSync = () => {
      if (!handles || !modsEl) return;
      window.clearTimeout(handles.modStateDebounceId);
      handles.modStateDebounceId = window.setTimeout(() => {
        handles.modStateDebounceId = 0;
        if (modsEl && document.body.contains(modsEl)) {
          syncBeatmapModGridCloneHighlights(modsEl);
          syncBeatmapScoreboardModResetButton(modsEl);
        }
      }, 0);
    };
    handles.modStateMo = new MutationObserver((records) => {
      const hidden = modsEl.querySelectorAll(HIDDEN_ORIGINAL_SEL);
      const touchesHiddenOriginal = records.some((r) => {
        const n = r.target;
        if (n instanceof Element) {
          for (const h of hidden) {
            if (h === n || h.contains(n)) return true;
          }
          return false;
        }
        if (n instanceof Text) {
          for (const h of hidden) {
            if (h.contains(n)) return true;
          }
        }
        return false;
      });
      if (touchesHiddenOriginal) scheduleModStateSync();
    });
    handles.modStateMo.observe(modsEl, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed", "aria-disabled", "title"],
      characterData: true,
      childList: true,
    });
  }

  const onCredsChange = () => {
    if (!isAuthConfigured() && modsEl) {
      clearWildcardState();
      const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
      if (scoreboardRoot instanceof HTMLElement) {
        clearMergedLeaderboard(scoreboardRoot, "wildcard");
      }
      syncBeatmapModGridCloneHighlights(modsEl);
      syncBeatmapScoreboardModResetButton(modsEl);
    }
  };
  window.addEventListener(CREDENTIALS_CHANGED_EVENT, onCredsChange);

  return () => {
    window.removeEventListener(CREDENTIALS_CHANGED_EVENT, onCredsChange);
    beatmapChangeMo?.disconnect();
    if (scoreboardRootForTabs instanceof HTMLElement) {
      scoreboardRootForTabs.removeEventListener(
        "click",
        onScoreboardTabClick,
        true,
      );
    }
    clearWildcardState();
    if (modsEl && document.body.contains(modsEl)) {
      stopBeatmapScoreboardModGridLive(modsEl);
    } else if (handles) {
      window.clearTimeout(handles.debounceId);
      window.clearTimeout(handles.modStateDebounceId);
      handles.mo?.disconnect();
      handles.modStateMo?.disconnect();
      if (modsEl) beatmapModGridLiveHandles.delete(modsEl);
    }
    handles = null;
    modsEl = null;
  };
}
