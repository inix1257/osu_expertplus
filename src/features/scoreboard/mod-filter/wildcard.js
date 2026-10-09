/**
 * Wildcard mods (WS-32): a wildcard mod may or may not be on a score, so
 * Expert+ fetches the leaderboard of every combination, merges them and
 * shows the result in place of osu-web's rows.
 */

import { leaderboardScoreId } from "../../../osu/score.js";
import { isAuthConfigured, settingIds, settings } from "../../legacy.js";
import {
  getBeatmapPageBeatmapId,
  getBeatmapPageRuleset,
  WILDCARD_LOADING_CLASS,
} from "../context.js";
import {
  clearMergedLeaderboard,
  renderMergedLeaderboard,
} from "../merged-leaderboard.js";
import { EXTENDED_LB_LIMIT } from "../scores-limit.js";
import { sortLeaderboardScoresLikeTable } from "../sort.js";
import { queueClicks } from "./click-runner.js";
import {
  syncBeatmapModGridCloneHighlights,
  syncBeatmapScoreboardModResetButton,
} from "./grid.js";
import {
  buildBeatmapModGridCloneEnabledSet,
  getMergedEnabledMods,
  isMergedMember,
} from "./merged-cycle.js";
import {
  getWildcardMods,
  hiddenOriginals,
  isBeatmapScoreboardModStripButtonOn,
  isGridCloneOn,
  isWildcard,
  MAX_WILDCARD_MODS,
  MOD_WILDCARD_ATTR,
  MOD_WILDCARD_CLASS,
  modButtonAcronym,
  state,
} from "./state.js";

/** Drop the wildcard loading overlay everywhere (an aborted fetch never clears its own). */
export function clearWildcardLoadingOverlays() {
  state.wildcardLoading = false;
  document
    .querySelectorAll(`.${WILDCARD_LOADING_CLASS}`)
    .forEach((n) => n.classList.remove(WILDCARD_LOADING_CLASS));
}

/**
 * Put the overlay back on the current table while a fetch is pending; osu-web
 * replaces the table element on difficulty switch. Writes only when missing.
 * @param {HTMLElement} scoreboardRoot
 */
export function syncWildcardLoadingOverlay(scoreboardRoot) {
  if (!state.wildcardLoading) return;
  const wrap = scoreboardRoot.querySelector(".beatmap-scoreboard-table");
  if (
    wrap instanceof HTMLElement &&
    !wrap.classList.contains(WILDCARD_LOADING_CLASS)
  ) {
    wrap.classList.add(WILDCARD_LOADING_CLASS);
  }
}

/** Stop a scheduled or running wildcard fetch and drop its overlay. */
export function cancelWildcardFetch() {
  window.clearTimeout(state.wildcardDebounceTimer);
  state.wildcardDebounceTimer = 0;
  if (state.wildcardAbortCtrl) {
    state.wildcardAbortCtrl.abort();
    state.wildcardAbortCtrl = null;
  }
  clearWildcardLoadingOverlays();
}

/** Reset all wildcard state (used on teardown or beatmap change). */
export function clearWildcardState() {
  state.mergedStep.clear();
  state.wildcard.clear();
  state.wildcardSeq = 0;
  cancelWildcardFetch();
}

/** @returns {string} Ruleset + beatmap id the wildcard leaderboard is fetched for. */
export function getWildcardBeatmapKey() {
  return `${getBeatmapPageRuleset()}/${getBeatmapPageBeatmapId() || ""}`;
}

/**
 * Mark a mod as wildcard. If this would exceed MAX_WILDCARD_MODS, the oldest
 * wildcard is evicted and its clone visual is reset.
 * @param {string} acronym
 * @param {HTMLElement} modsEl
 */
export function enableWildcard(acronym, modsEl) {
  const current = getWildcardMods().filter((a) => a !== acronym);
  while (current.length >= MAX_WILDCARD_MODS) {
    const oldest = current.sort(
      (a, b) => (state.wildcard.get(a) || 0) - (state.wildcard.get(b) || 0),
    )[0];
    state.wildcard.set(oldest, 0);
    current.splice(current.indexOf(oldest), 1);
    updateCloneWildcardVisual(oldest, modsEl, false);
  }
  state.wildcardSeq += 1;
  state.wildcard.set(acronym, state.wildcardSeq);
}

/**
 * @param {string} acronym
 * @param {HTMLElement} modsEl
 */
export function disableWildcard(acronym, modsEl) {
  state.wildcard.set(acronym, 0);
  updateCloneWildcardVisual(acronym, modsEl, false);
}

/**
 * @param {HTMLElement} clone
 * @param {boolean} on
 */
export function setCloneWildcardClass(clone, on) {
  if (on) {
    if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
      clone.classList.add(MOD_WILDCARD_CLASS);
      clone.setAttribute(MOD_WILDCARD_ATTR, "1");
    }
  } else {
    clone.classList.remove(MOD_WILDCARD_CLASS);
    clone.removeAttribute(MOD_WILDCARD_ATTR);
  }
}

/**
 * @param {string} acronym
 * @param {HTMLElement} modsEl
 * @param {boolean} wildcard
 */
export function updateCloneWildcardVisual(acronym, modsEl, wildcard) {
  for (const orig of hiddenOriginals(modsEl)) {
    if (modButtonAcronym(orig) !== acronym) continue;
    const clone = state.originalToClone.get(orig);
    if (!(clone instanceof HTMLElement)) continue;
    if (wildcard) {
      clone.classList.add(MOD_WILDCARD_CLASS);
      clone.setAttribute(MOD_WILDCARD_ATTR, "1");
    } else {
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
    }
  }
}

/** @returns {boolean} */
export function isWildcardFeatureAvailable() {
  return (
    isAuthConfigured() && settings().isEnabled(settingIds().SCOREBOARD_MOD_GRID)
  );
}

/**
 * Given enabled mods and wildcard mods, generate all mod combinations.
 * e.g. enabled=[DT], wildcard=[HD,FL] → [[DT],[DT,HD],[DT,FL],[DT,HD,FL]]
 * @param {string[]} enabledMods
 * @param {string[]} wildcardMods
 * @returns {string[][]}
 */
export function generateModCombinations(enabledMods, wildcardMods) {
  const combos = [];
  const n = wildcardMods.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const combo = [...enabledMods];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) combo.push(wildcardMods[i]);
    }
    combos.push(combo.sort());
  }
  return combos;
}

/**
 * Matches osu-web scoreboard tabs (global / country / friend / team). Team tab
 * is omitted from the DOM when the viewer has no team; then only three tabs exist.
 * @param {HTMLElement|null|undefined} scoreboardRoot  `.beatmapset-scoreboard`
 * @returns {"global"|"country"|"friend"|"team"}
 */
export function readBeatmapScoreboardLeaderboardType(scoreboardRoot) {
  const order = ["global", "country", "friend", "team"];
  if (!(scoreboardRoot instanceof HTMLElement)) return "global";
  const tabs = [
    ...scoreboardRoot.querySelectorAll(":scope > .page-tabs > .page-tabs__tab"),
  ];
  if (tabs.length) {
    const activeIdx = tabs.findIndex((t) =>
      t.classList.contains("page-tabs__tab--active"),
    );
    const mapOrder =
      tabs.length === 4 ? order : order.filter((t) => t !== "team");
    if (activeIdx >= 0 && activeIdx < mapOrder.length) {
      return /** @type {"global"|"country"|"friend"|"team"} */ (
        mapOrder[activeIdx]
      );
    }
  }
  const raw = scoreboardRoot.getAttribute("data-scoreboard-state");
  if (raw) {
    try {
      const t = JSON.parse(raw)?.currentType;
      if (t === "global" || t === "country" || t === "friend" || t === "team") {
        return t;
      }
    } catch {
      void 0;
    }
  }
  return "global";
}

/**
 * Fetch leaderboard scores for multiple mod combinations, merge, dedup, sort,
 * and return the top `limit` scores. Uses `GET /beatmaps/{beatmapId}/scores` on
 * osu.ppy.sh (site JSON), not `/api/v2`.
 * @param {string} beatmapId  difficulty id (same as in `/beatmaps/{id}/scores`)
 * @param {string[][]} modCombos
 * @param {string} mode
 * @param {number} limit
 * @param {AbortSignal} signal
 * @param {"global"|"country"|"friend"|"team"} leaderboardType
 * @returns {Promise<object[]>}
 */
export async function fetchAndMergeWildcardLeaderboards(
  beatmapId,
  modCombos,
  mode,
  limit,
  signal,
  leaderboardType,
) {
  const type =
    leaderboardType === "country" ||
    leaderboardType === "friend" ||
    leaderboardType === "team"
      ? leaderboardType
      : "global";
  const fetches = modCombos.map((mods) =>
    OsuExpertPlus.api
      .getBeatmapScoresWebsite(
        beatmapId,
        {
          mode,
          type,
          // Omitting mods[] returns every mod combination; NM is required for nomod.
          mods: mods.length ? mods : ["NM"],
          limit: EXTENDED_LB_LIMIT,
        },
        { signal },
      )
      .then((res) => res?.scores || [])
      .catch(() => []),
  );

  const results = await Promise.all(fetches);
  if (signal.aborted) return [];

  const seen = new Set();
  const merged = [];
  for (const scores of results) {
    for (const s of scores) {
      const id = leaderboardScoreId(s);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      merged.push(s);
    }
  }
  sortLeaderboardScoresLikeTable(merged);
  return merged.slice(0, limit);
}

/**
 * Collect the "enabled" (not wildcard, not disabled) mods from our tracked state.
 * @param {HTMLElement} modsEl
 * @returns {string[]}
 */
export function getWildcardEnabledMods(modsEl) {
  const enabled = getMergedEnabledMods(modsEl);
  for (const orig of hiddenOriginals(modsEl)) {
    const ac = modButtonAcronym(orig);
    if (!ac || ac === "NM") continue;
    if (isMergedMember(modsEl, ac)) continue;
    const clone = state.originalToClone.get(orig);
    if (!(clone instanceof HTMLElement)) continue;
    if (isWildcard(ac)) continue;
    if (isGridCloneOn(clone)) enabled.push(ac);
  }
  return enabled;
}

/**
 * Trigger the wildcard leaderboard fetch-merge-render cycle after debounce.
 * @param {HTMLElement} modsEl
 */
export function scheduleWildcardFetch(modsEl) {
  window.clearTimeout(state.wildcardDebounceTimer);
  if (state.wildcardAbortCtrl) {
    state.wildcardAbortCtrl.abort();
    state.wildcardAbortCtrl = null;
    // Re-added below if this call starts a new fetch.
    clearWildcardLoadingOverlays();
  }

  const wildcards = getWildcardMods();
  const scoreboardRoot =
    modsEl.closest(".beatmapset-scoreboard") ||
    document.querySelector(".beatmapset-scoreboard");
  if (!(scoreboardRoot instanceof HTMLElement)) return;

  if (wildcards.length === 0) {
    clearMergedLeaderboard(scoreboardRoot, "wildcard");
    clearWildcardLoadingOverlays();
    syncActiveModsToOriginals(modsEl);
    return;
  }

  const enabledMods = getWildcardEnabledMods(modsEl);
  const beatmapId = getBeatmapPageBeatmapId();
  const mode = getBeatmapPageRuleset();
  if (!beatmapId) return;
  const fetchKey = getWildcardBeatmapKey();

  const combos = generateModCombinations(enabledMods, wildcards);

  state.wildcardLoading = true;
  syncWildcardLoadingOverlay(scoreboardRoot);

  const ctrl = new AbortController();
  state.wildcardAbortCtrl = ctrl;
  const signal = ctrl.signal;

  const removeLoadingOverlay = () => {
    // A newer fetch has taken over the overlay; leave it alone.
    if (state.wildcardAbortCtrl && state.wildcardAbortCtrl.signal !== signal) {
      return;
    }
    clearWildcardLoadingOverlays();
  };

  state.wildcardDebounceTimer = window.setTimeout(() => {
    state.wildcardDebounceTimer = 0;
    const leaderboardType =
      readBeatmapScoreboardLeaderboardType(scoreboardRoot);
    fetchAndMergeWildcardLeaderboards(
      beatmapId,
      combos,
      mode,
      EXTENDED_LB_LIMIT,
      signal,
      leaderboardType,
    )
      .then((merged) => {
        removeLoadingOverlay();
        if (signal.aborted) return;
        // Difficulty/ruleset changed while fetching: these scores belong to another map.
        if (getWildcardBeatmapKey() !== fetchKey) return;
        if (merged.length > 0) {
          renderMergedLeaderboard(scoreboardRoot, "wildcard", merged);
        }
      })
      .catch(() => {
        removeLoadingOverlay();
      });
  }, 1000);
}

/**
 * When leaving wildcard mode (all wildcards removed), click originals
 * to sync their enabled state with what the clones show.
 * @param {HTMLElement} modsEl
 */
export function syncActiveModsToOriginals(modsEl) {
  const cloneEnabled = buildBeatmapModGridCloneEnabledSet(modsEl);

  const clickQueue = [];
  for (const orig of hiddenOriginals(modsEl)) {
    const ac = modButtonAcronym(orig);
    if (!ac || ac === "NM") continue;
    const origOn = isBeatmapScoreboardModStripButtonOn(orig);
    const shouldBeOn = cloneEnabled.has(ac);
    if (origOn !== shouldBeOn) clickQueue.push(orig);
  }
  if (!clickQueue.length) return;

  queueClicks({
    key: "sync-originals",
    next: () => clickQueue.shift() ?? null,
    done: () => {
      syncBeatmapModGridCloneHighlights(modsEl);
      syncBeatmapScoreboardModResetButton(modsEl);
    },
  });
}
