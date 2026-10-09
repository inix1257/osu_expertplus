/**
 * Merged grid controls (WS-32): one control cycles through DT → NC →
 * wildcard DT, another through SD → PF → wildcard SD → wildcard PF. Both are
 * the same state machine over the step table below.
 */

import { MERGED_MOD_ATTR } from "../context.js";
import { runClicks } from "./click-runner.js";
import {
  replaceBeatmapModGridCloneInnerHTML,
  syncBeatmapModGridCloneHighlights,
  syncBeatmapScoreboardModResetButton,
} from "./grid.js";
import {
  findHiddenBeatmapModButton,
  getWildcardMods,
  hiddenOriginals,
  isBeatmapScoreboardModStripButtonOn,
  isGridCloneOn,
  isWildcard,
  MERGED_MOD_DT_NC,
  MERGED_MOD_SD_PF,
  modButtonAcronym,
  setGridCloneOn,
  state,
} from "./state.js";
import {
  disableWildcard,
  enableWildcard,
  isWildcardFeatureAvailable,
  scheduleWildcardFetch,
  setCloneWildcardClass,
  updateCloneWildcardVisual,
} from "./wildcard.js";

/**
 * @typedef {{ on?: string, wildcard?: string }} MergedStep
 *   `on`: the one original that is enabled; `wildcard`: the member in wildcard
 *   state. Step 0 has neither.
 * @typedef {{ a: string, b: string, steps: MergedStep[], maxFrames: number }} MergedPair
 */

/** @type {Record<string, MergedPair>} */
export const MERGED_PAIRS = {
  [MERGED_MOD_DT_NC]: {
    a: "DT",
    b: "NC",
    steps: [{}, { on: "DT" }, { on: "NC" }, { wildcard: "DT" }],
    maxFrames: 56,
  },
  [MERGED_MOD_SD_PF]: {
    a: "SD",
    b: "PF",
    steps: [
      {},
      { on: "SD" },
      { on: "PF" },
      { wildcard: "SD" },
      { wildcard: "PF" },
    ],
    maxFrames: 64,
  },
};

/** Steps without wildcards: off, a, b. */
const PLAIN_STEP_COUNT = 3;

/**
 * @param {HTMLElement} modsEl
 * @param {string} mergeId
 * @returns {boolean}
 */
export function hasMergedControl(modsEl, mergeId) {
  return Boolean(modsEl.querySelector(`[${MERGED_MOD_ATTR}="${mergeId}"]`));
}

/**
 * Whether `acronym` is shown by a merged control (and not by its own clone).
 * @param {HTMLElement} modsEl
 * @param {string} acronym
 * @returns {boolean}
 */
export function isMergedMember(modsEl, acronym) {
  for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
    if (
      (acronym === pair.a || acronym === pair.b) &&
      hasMergedControl(modsEl, mergeId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Mods the merged controls currently enable (wildcard steps add none).
 * @param {HTMLElement} modsEl
 * @returns {string[]}
 */
export function getMergedEnabledMods(modsEl) {
  const out = [];
  for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
    if (!hasMergedControl(modsEl, mergeId)) continue;
    const on = pair.steps[state.mergedStep.get(mergeId) ?? 0]?.on;
    if (on) out.push(on);
  }
  return out;
}

/**
 * @param {HTMLElement} modsEl
 * @returns {Set<string>}
 */
export function buildBeatmapModGridCloneEnabledSet(modsEl) {
  const set = new Set(getMergedEnabledMods(modsEl));
  for (const orig of hiddenOriginals(modsEl)) {
    const ac = modButtonAcronym(orig);
    if (!ac || ac === "NM") continue;
    if (isMergedMember(modsEl, ac)) continue;
    const clone = state.originalToClone.get(orig);
    if (!(clone instanceof HTMLElement)) continue;
    if (isGridCloneOn(clone)) set.add(ac);
  }
  return set;
}

/**
 * Read each merged control's step from osu-web's buttons and the wildcard
 * state (highest matching step wins).
 * @param {HTMLElement} modsEl
 */
export function reconcileMergedModCycleFromDom(modsEl) {
  for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
    if (!hasMergedControl(modsEl, mergeId)) continue;
    const a = findHiddenBeatmapModButton(modsEl, pair.a);
    const b = findHiddenBeatmapModButton(modsEl, pair.b);
    if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) continue;
    let step = 0;
    for (let s = pair.steps.length - 1; s > 0; s--) {
      const { on, wildcard } = pair.steps[s];
      const hit = wildcard
        ? isWildcard(wildcard)
        : isBeatmapScoreboardModStripButtonOn(on === pair.a ? a : b);
      if (hit) {
        step = s;
        break;
      }
    }
    state.mergedStep.set(mergeId, step);
  }
}

/**
 * @param {string} mergeId
 * @returns {number}
 */
export function mergedModGridEffectiveStepCount(mergeId) {
  if (isWildcardFeatureAvailable()) return MERGED_PAIRS[mergeId].steps.length;
  return PLAIN_STEP_COUNT;
}

function finishMergedModStepApply(modsEl, mergeId, step) {
  state.mergedStep.set(mergeId, step);
  syncBeatmapModGridCloneHighlights(modsEl);
  syncBeatmapScoreboardModResetButton(modsEl);
  scheduleWildcardFetch(modsEl);
}

/**
 * Click osu-web's buttons until the pair matches `targetStep`, then enter
 * the step's wildcard (when available) and refetch.
 * @param {HTMLElement} modsEl
 * @param {string} mergeId
 * @param {number} targetStep
 */
export function applyMergedModTargetStep(modsEl, mergeId, targetStep) {
  const pair = MERGED_PAIRS[mergeId];
  if (!pair) return;
  const buttons = {
    [pair.a]: findHiddenBeatmapModButton(modsEl, pair.a),
    [pair.b]: findHiddenBeatmapModButton(modsEl, pair.b),
  };
  if (!(buttons[pair.a] instanceof HTMLElement)) return;
  if (!(buttons[pair.b] instanceof HTMLElement)) return;
  const goal = pair.steps[targetStep] ?? pair.steps[0];

  runClicks({
    maxSteps: pair.maxFrames,
    next: () => {
      for (const ac of [pair.a, pair.b]) {
        if (ac !== goal.wildcard && isWildcard(ac)) disableWildcard(ac, modsEl);
      }
      for (const ac of [pair.b, pair.a]) {
        if (ac === goal.on) continue;
        if (isBeatmapScoreboardModStripButtonOn(buttons[ac]))
          return buttons[ac];
      }
      if (goal.on && !isBeatmapScoreboardModStripButtonOn(buttons[goal.on])) {
        return buttons[goal.on];
      }
      return null;
    },
    done: (completed) => {
      if (
        completed &&
        goal.wildcard &&
        !isWildcard(goal.wildcard) &&
        isWildcardFeatureAvailable()
      ) {
        enableWildcard(goal.wildcard, modsEl);
        updateCloneWildcardVisual(goal.wildcard, modsEl, true);
      }
      finishMergedModStepApply(modsEl, mergeId, targetStep);
    },
  });
}

/**
 * Mirror the pair's state onto its grid control: the wildcard member, else
 * the enabled member (or the first one when off).
 * @param {HTMLElement} modsEl
 * @param {HTMLElement} clone
 * @param {string} mergeId
 */
export function syncMergedModCloneHighlights(modsEl, clone, mergeId) {
  if (!(clone instanceof HTMLElement)) return;
  const pair = MERGED_PAIRS[mergeId];
  if (!pair) return;
  const a = findHiddenBeatmapModButton(modsEl, pair.a);
  const b = findHiddenBeatmapModButton(modsEl, pair.b);
  if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) return;
  const byAc = { [pair.a]: a, [pair.b]: b };
  const step = state.mergedStep.get(mergeId) ?? 0;

  for (let s = pair.steps.length - 1; s > 0; s--) {
    const wc = pair.steps[s].wildcard;
    if (!wc || (step !== s && !isWildcard(wc))) continue;
    const src = byAc[wc];
    replaceBeatmapModGridCloneInnerHTML(clone, src);
    clone.disabled = src.disabled;
    setGridCloneOn(clone, false);
    setCloneWildcardClass(clone, true);
    return;
  }
  setCloneWildcardClass(clone, false);

  const enabled = pair.steps[step]?.on;
  const src = enabled ? byAc[enabled] : a;
  replaceBeatmapModGridCloneInnerHTML(clone, src);
  clone.disabled = src.disabled;
  if (getWildcardMods().length > 0) {
    setGridCloneOn(
      clone,
      enabled ? isBeatmapScoreboardModStripButtonOn(src) : false,
    );
    return;
  }
  if (clone.className !== src.className) clone.className = src.className;
  for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
    const v = src.getAttribute(attr);
    if (v == null) clone.removeAttribute(attr);
    else clone.setAttribute(attr, v);
  }
}
