/**
 * Player lookup on the beatmap scoreboard (WS-32): a username search whose
 * scores replace osu-web's rows until Reset.
 */

import { observe } from "../../core/observe.js";
import {
  el,
  isAuthConfigured,
  setHiddenIfChanged,
  settingIds,
  settings,
  setTextIfChanged,
} from "../legacy.js";
import {
  CREDENTIALS_CHANGED_EVENT,
  findBeatmapScoreboardRoot,
  getBeatmapPageBeatmapId,
  getBeatmapPageRuleset,
  SCORE_USER_SEARCH_RESULT_ATTR,
  SCOREBOARD_MODS_SEL,
  SCOREBOARD_USER_SEARCH_ATTR,
} from "./context.js";
import {
  clearMergedLeaderboard,
  renderMergedLeaderboard,
} from "./merged-leaderboard.js";
import { getWildcardMods } from "./mod-filter/state.js";
import {
  cancelWildcardFetch,
  scheduleWildcardFetch,
} from "./mod-filter/wildcard.js";
import {
  insertBeatmapScoreUserSearchBar,
  isPlayerLookupSearchBarPlacedCorrectly,
  removeEmptyBeatmapScoreboardToolsRows,
  TOOLS_ROW_WATCH_SEL,
} from "./tools-row.js";

/**
 * Remove lookup rows and show osu-web's rows again.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 * @param {boolean} [rescheduleWildcard=true] When true and wildcard mods are active, re-runs the merged fetch (e.g. user clicked Reset).
 */
function clearLookupResults(scoreboardRoot, rescheduleWildcard = true) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  clearMergedLeaderboard(scoreboardRoot, "lookup");
  if (!rescheduleWildcard) return;
  const mods = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
  if (mods instanceof HTMLElement && getWildcardMods().length > 0) {
    scheduleWildcardFetch(mods);
  }
}

/**
 * Status text for a failed lookup (B14). `stage` is the request that failed:
 * finding the player or reading their scores on this difficulty.
 * @param {unknown} err  `Error & { status?: number }` from the API helpers
 * @param {"user"|"scores"} stage
 * @returns {string}
 */
export function lookupErrorStatus(err, stage) {
  const status = /** @type {{ status?: number }} */ (err)?.status;
  if (status === 401 || status === 403) {
    return "osu! API authorization failed. Check the OAuth credentials in Expert+ settings.";
  }
  if (status === 429) return "Too many requests. Try again in a moment.";
  if (status === 404) {
    return stage === "user"
      ? "Player not found."
      : "No score found on this difficulty.";
  }
  // No status: the request itself failed (network, timeout).
  return status == null
    ? "Search failed. Try again later."
    : `Search failed (HTTP ${status}). Try again later.`;
}

/** Username text from the signed-in account link in the site header, if any. */
function getLoggedInUsernameFromNav() {
  const link = document.querySelector("a.u-current-user-cover");
  if (!(link instanceof HTMLAnchorElement)) return null;
  return link.querySelector(".u-relative")?.textContent?.trim() || null;
}

/**
 * Mounts and manages the username search bar on the beatmap scoreboard.
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startBeatmapScoreUserSearchManager(pathRe) {
  const MARKER_ATTR = SCOREBOARD_USER_SEARCH_ATTR;
  const NO_API_STATUS =
    "Add osu! API OAuth credentials in Expert+ settings to search players.";
  let debounceTimer = 0;
  /** Ruleset + beatmap the shown results were searched on (B72). */
  let resultKey = null;
  const beatmapKey = () =>
    `${getBeatmapPageRuleset()}/${getBeatmapPageBeatmapId() || ""}`;

  /** Empty the bar's status and hide Reset (the input keeps its text). */
  const resetBarState = () => {
    const wrap = document.querySelector(`[${MARKER_ATTR}]`);
    if (!(wrap instanceof HTMLElement)) return;
    const statusEl = wrap.querySelector(".oep-user-search__status");
    const resetBtn = wrap.querySelector(".oep-user-search__btn--reset");
    setTextIfChanged(statusEl, "");
    if (resetBtn instanceof HTMLElement) setHiddenIfChanged(resetBtn, true);
  };

  // clearLookupResults refreshes the whole table (DOM writes), so only
  // call it when there is something to clear; otherwise the document observer below
  // re-runs us forever.
  const hasUserSearchResultRows = (scoreboardRoot) =>
    scoreboardRoot instanceof HTMLElement &&
    !!scoreboardRoot.querySelector(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`);

  const cleanup = () => {
    document.querySelectorAll(".beatmapset-scoreboard").forEach((el) => {
      if (hasUserSearchResultRows(el)) {
        clearLookupResults(el, false);
      }
    });
    document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((n) => n.remove());
    removeEmptyBeatmapScoreboardToolsRows();
  };

  const syncPlayerLookupSearchBarApiState = (wrap) => {
    if (!(wrap instanceof HTMLElement)) return;
    const input = wrap.querySelector(".oep-user-search__input");
    const goBtn = wrap.querySelector(".oep-user-search__btn--go");
    const resetBtn = wrap.querySelector(".oep-user-search__btn--reset");
    const statusEl = wrap.querySelector(".oep-user-search__status");
    const configured = isAuthConfigured();
    wrap.classList.toggle("oep-user-search--no-api", !configured);
    if (input instanceof HTMLInputElement && input.disabled !== !configured) {
      input.disabled = !configured;
    }
    if (goBtn instanceof HTMLButtonElement && goBtn.disabled !== !configured) {
      goBtn.disabled = !configured;
    }
    if (!configured) {
      if (resetBtn instanceof HTMLElement) setHiddenIfChanged(resetBtn, true);
      if (input instanceof HTMLInputElement && input.value) input.value = "";
      setTextIfChanged(statusEl, NO_API_STATUS);
      const boardRoot = findBeatmapScoreboardRoot();
      if (hasUserSearchResultRows(boardRoot)) {
        clearLookupResults(boardRoot, false);
      }
    } else if (statusEl && statusEl.textContent === NO_API_STATUS) {
      statusEl.textContent = "";
    }
  };

  const ensureSearchBar = (root) => {
    const existing =
      root.querySelector(`[${MARKER_ATTR}]`) ||
      document.querySelector(`[${MARKER_ATTR}]`);
    if (existing instanceof HTMLElement) {
      if (!isPlayerLookupSearchBarPlacedCorrectly(root, existing)) {
        insertBeatmapScoreUserSearchBar(root, existing);
      }
      syncPlayerLookupSearchBarApiState(existing);
      return;
    }

    const searchInput = el("input", {
      type: "text",
      class: "oep-user-search__input",
      placeholder: getLoggedInUsernameFromNav() || "Look up a player…",
      "aria-label": "Search player on leaderboard",
      autocomplete: "off",
      spellcheck: "false",
    });

    const searchBtn = el(
      "button",
      {
        type: "button",
        class: "oep-user-search__btn oep-user-search__btn--go",
      },
      "Search",
    );

    const resetBtn = el(
      "button",
      {
        type: "button",
        class: "oep-user-search__btn oep-user-search__btn--reset",
        hidden: "",
        "aria-label": "Clear search result",
      },
      "Reset",
    );

    const statusEl = el("div", {
      class: "oep-user-search__status",
      "aria-live": "polite",
    });

    const wrap = el(
      "div",
      { class: "oep-user-search", [MARKER_ATTR]: "1" },
      el(
        "div",
        { class: "oep-user-search__bar" },
        searchInput,
        searchBtn,
        resetBtn,
      ),
      statusEl,
    );

    const doReset = () => {
      const boardRoot = findBeatmapScoreboardRoot();
      resultKey = null;
      clearLookupResults(boardRoot);
      searchInput.value = "";
      statusEl.textContent = "";
      resetBtn.hidden = true;
      searchInput.focus();
    };

    let searching = false;

    const doSearch = async () => {
      // Enter does not respect the disabled button (B14).
      if (searching) return;
      const username =
        searchInput.value.trim() || getLoggedInUsernameFromNav() || "";
      if (!username) return;

      if (!isAuthConfigured()) {
        statusEl.textContent =
          "API credentials required. Configure them in the settings (Client ID + Secret).";
        resetBtn.hidden = false;
        return;
      }

      const beatmapId = getBeatmapPageBeatmapId();
      if (!beatmapId) return;
      const key = beatmapKey();
      // The difficulty changed while searching: the scores are for the
      // previous one, so drop them (B72).
      const stale = () => beatmapKey() !== key;

      searching = true;
      searchBtn.disabled = true;
      statusEl.textContent = "Searching…";
      /** @type {"user"|"scores"} */
      let stage = "user";

      try {
        // Usernames first, so digits-only names work (B15); a digits-only
        // input that is not a name falls back to a user id.
        const user = await OsuExpertPlus.api
          .getUserByName(username)
          .catch((err) =>
            err?.status === 404 && /^\d+$/.test(username)
              ? OsuExpertPlus.api.getUser(username)
              : Promise.reject(err),
          );
        if (!user?.id)
          throw Object.assign(new Error("user not found"), { status: 404 });
        if (stale()) {
          statusEl.textContent = "";
          return;
        }

        stage = "scores";
        const ruleset = getBeatmapPageRuleset();
        const scoreboardRoot = findBeatmapScoreboardRoot();
        const data = await OsuExpertPlus.api.getBeatmapUserScoresAll(
          beatmapId,
          user.id,
          { ruleset, legacy_only: 0 },
        );
        if (stale()) {
          statusEl.textContent = "";
          return;
        }
        const rawList = Array.isArray(data?.scores) ? data.scores : [];
        if (!rawList.length)
          throw Object.assign(new Error("no score"), { status: 404 });

        const userCompact = {
          id: user.id,
          username: user.username,
          country_code: user.country_code,
          country: user.country,
        };
        const scores = rawList.map((s) =>
          s && typeof s === "object" && !s.user
            ? { ...s, user: userCompact }
            : s,
        );

        const ok =
          scoreboardRoot instanceof HTMLElement &&
          renderMergedLeaderboard(scoreboardRoot, "lookup", scores, {
            team: user.team,
            beforeInsert: cancelWildcardFetch,
          });
        if (ok) {
          resultKey = key;
          statusEl.textContent = "";
        } else {
          statusEl.textContent =
            "Scores found but leaderboard is not ready yet.";
        }
        resetBtn.hidden = false;
      } catch (err) {
        if (stale()) {
          statusEl.textContent = "";
          return;
        }
        statusEl.textContent = lookupErrorStatus(err, stage);
        // The table must not keep showing the previous player (B81).
        resultKey = null;
        const boardRoot = findBeatmapScoreboardRoot();
        if (hasUserSearchResultRows(boardRoot)) clearLookupResults(boardRoot);
        resetBtn.hidden = false;
      } finally {
        searching = false;
        searchBtn.disabled = !isAuthConfigured();
      }
    };

    searchBtn.addEventListener("click", doSearch);
    resetBtn.addEventListener("click", doReset);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });

    insertBeatmapScoreUserSearchBar(root, wrap);
    syncPlayerLookupSearchBarApiState(wrap);
  };

  const run = () => {
    if (!pathRe.test(location.pathname)) {
      cleanup();
      return;
    }
    if (!settings().isEnabled(settingIds().SCOREBOARD_PLAYER_LOOKUP)) {
      cleanup();
      return;
    }
    const root = findBeatmapScoreboardRoot();
    if (!(root instanceof HTMLElement)) return;
    ensureSearchBar(root);
  };

  const schedule = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 16);
  };

  const OSU_API_CREDS_CHANGE = CREDENTIALS_CHANGED_EVENT;
  const onOsuApiCredsChange = () => schedule();
  window.addEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);

  const unsubLookup = settings().onChange(
    settingIds().SCOREBOARD_PLAYER_LOOKUP,
    () => schedule(),
  );

  const unsubscribe = observe.subscribe(
    {
      selector: TOOLS_ROW_WATCH_SEL,
      schedule: 16,
      label: "scoreboard/player-lookup",
    },
    run,
  );
  // osu-web switches difficulty without reloading and re-renders the table
  // around our rows: drop results that belong to the previous one (B72).
  const dropIfBeatmapChanged = () => {
    if (resultKey == null || beatmapKey() === resultKey) return;
    resultKey = null;
    const boardRoot = findBeatmapScoreboardRoot();
    if (hasUserSearchResultRows(boardRoot))
      clearLookupResults(boardRoot, false);
    resetBarState();
  };
  const unsubscribeBeatmap = observe.subscribe(
    {
      selector:
        ".beatmap-scoreboard-table, .beatmap-scoreboard-table__body-row, .beatmapset-scoreboard__notice",
      schedule: 16,
      label: "scoreboard/player-lookup-beatmap",
    },
    dropIfBeatmapChanged,
  );
  // A board osu-web already has refills the same rows (none added), so also
  // follow the picker's selected difficulty (B110).
  const unsubscribePicker = observe.subscribe(
    {
      selector:
        ".beatmapset-beatmap-picker, .beatmapset-beatmap-picker__beatmap",
      attributes: ["class"],
      schedule: 16,
      label: "scoreboard/player-lookup-picker",
    },
    dropIfBeatmapChanged,
  );
  schedule();

  return () => {
    unsubscribeBeatmap();
    unsubscribePicker();
    unsubLookup();
    window.removeEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);
    window.clearTimeout(debounceTimer);
    unsubscribe();
    cleanup();
  };
}
