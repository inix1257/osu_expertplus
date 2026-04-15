/** GM-backed feature toggles: isEnabled, set, onChange, IDS.* */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settings = (() => {
  const FEATURES = [
    {
      id: "userProfile.alwaysShowStats",
      label: "Play count & favourites on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: keeps play count and favourite count visible on each beatmap card without hovering.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardExtraInfo",
      label: "Extra metadata on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: shows “from {source}” between the artist and mapper lines (reserved line when empty) and BPM plus longest drain length below the mapper line (from cached beatmapset JSON, no extra API calls). Uses osu’s listing JSON, search responses, and profile `extra-pages/beatmaps` (fetch/XHR hooks; one session prefetch if needed).",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardDifficultyRange",
      label: "Star rating on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: after each mode’s difficulty dots, shows the highest nomod star rating as a coloured pill (Font Awesome up-chevron, star, and value; from cached `difficulty_rating` per beatmap; same JSON sources as extra metadata).",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.fullBeatmapStatNumbers",
      label: "Full numbers on beatmap card stats",
      description:
        "On user profiles and on /beatmapsets: shows exact play and favourite counts (e.g. 159,915 instead of 159.9K) from each card’s tooltip/title in the HTML.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.scoreHitStatistics",
      label: "Hit statistics on profile scores",
      description:
        "On best performance, pinned, first place, and Expert+ Recent scores (Historical): adds a colour-coded hit row (great / ok / meh / miss). Beatmapset leaderboards keep hit-stat colours regardless of this option.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.moddedStarRating",
      label: "Modded star rating on difficulties",
      description:
        "Fetches and displays the accurate star rating with mods applied next to each difficulty name. Requires API credentials.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.scoreCardBackgrounds",
      label: "Beatmap background on score cards",
      description:
        "Shows the beatmap cover art as a background image on each score card in the Ranks section and on Expert+ Recent scores (Historical tab).",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.scoreCardPlaceNumber",
      label: "Score place number on rank cards",
      description:
        "On Best performance: shows #1, #2, … before the beatmap title. On Expert+ Recent scores (Historical): #1 is the most recent visible score, then #2, … (respects Show failed scores).",
      group: "User Profile",
      default: true,
    },
    {
      id: "scores.periodHighlight",
      label: "Score age period highlight",
      description:
        "On user profile Top Ranks only: bar to highlight scores by how recent they are (weeks through years), with reverse and reset.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.bwsRanking",
      label: "Extra rankings in profile header",
      description:
        "Shows extra rankings in the profile header next to global and country: BWS (badge-weighted) and ranked-score rank from api.kirino.sh. BWS uses keyword-filtered badge count and rank ^ (0.9937 ^ (badges ^ 2)); optional session-only badge input.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.profileSectionCollapseRemoveFromPage",
      label: "Hide collapsed profile sections",
      description:
        "When enabled, collapsing a section via Contents hides the whole block until you expand it from Contents again. When disabled (default), the section heading stays on the page with “(collapsed)” and you can expand it by clicking the heading.",
      group: "User Profile",
      default: false,
    },
    {
      id: "userProfile.scorePpDecimals",
      label: "PP decimals on scores",
      description:
        "On profile best performance, pinned, first place, Expert+ Recent (Historical), and on beatmapset leaderboards: shows pp to two decimal places (e.g. 610.27pp) instead of rounding to an integer in the visible text (full value stays in the tooltip/title where the site provides it).",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.modIconsAsAcronyms",
      label: "Mod acronyms instead of icons",
      description:
        "Shows mod letters (e.g. HD, DT) on score rows and beatmap leaderboards instead of sprite icons.",
      group: "Scores",
      default: false,
    },
    {
      id: "userProfile.hideClMod",
      label: "Hide Classic (CL) mod",
      description:
        "Hides the Classic (CL) mod on score rows and leaderboards. Works whether mods are shown as icons or acronyms.",
      group: "Scores",
      default: false,
    },
    {
      id: "beatmapDetail.metadataDescriptionModalButtons",
      label: "Full description & metadata buttons",
      description:
        'On beatmapset pages, adds the "Show metadata" button under the artist and the "Full description" button in the info panel (each opens a modal).',
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.discussionDefaultToTotal",
      label: "Beatmap discussion on Total tab",
      description:
        "On beatmap discussion pages, redirect default/praise landing routes to /discussion/-/generalAll/total.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.omdbBeatmapsetRatings",
      label: "OMDB difficulty ratings on beatmapset pages",
      description:
        "On beatmapset pages, shows an OMDB link to this mapset above the difficulty name. Difficulty stats, distribution popover, and star voting (0 at the left edge of the first star, then 0.5–5) need an OMDB API key in Expert+ settings.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapPreview",
      label: "Gameplay preview on beatmap info",
      description:
        "On beatmapset info pages, adds an expandable osu!standard gameplay preview (osu-beatmap-renderer + PixiJS loaded from esm.sh when you open it). Uses the site preview MP3.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapsetPreviewAudioButton",
      label: "Open preview audio button on beatmapset pages",
      description:
        "On beatmapset info pages, adds a square header button (with icon) that opens the official preview MP3 at b.ppy.sh in a new tab.",
      group: "Beatmap Detail",
      default: false,
    },
    {
      id: "beatmapDetail.beatconnectDownloadButton",
      label: "Beatconnect download on beatmapset pages",
      description:
        "On beatmapset pages, shows a Beatconnect.io download button beside the main .osz download link.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.apiExtendedLeaderboard",
      label: "Load up to 100 scores on beatmap leaderboard",
      description:
        "On beatmap scoreboards, bumps the `/beatmaps/{id}/scores` API limit from osu!’s default (50) to 100 so the first page loads more rows at once. Turn off to use the site default.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardPlayerLookup",
      label: "Leaderboard player lookup bar",
      description:
        "On beatmapset scoreboards, shows the username field to look up a player’s scores on the current difficulty; results replace the main leaderboard table (same idea as wildcard merge). Requires osu! API OAuth (Client ID + Secret) in Expert+ settings; without credentials the bar stays visible but disabled with a short notice.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardModGrid",
      label: "Grid layout for scoreboard mod filters",
      description:
        "On beatmapset scoreboards, replaces the default horizontal mod strip with Expert+’s grouped grid (stable / Lazer, difficulty rows, reset, collapsible “Mod filters”). Turn off to use osu!’s original mod strip layout.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardHideCustomRateScores",
      label: "Hide custom rate scores on leaderboard",
      description:
        "On beatmapset scoreboards, hides leaderboard rows whose speed mod rate is not the osu! default (1.00×, or 1.50× for DT/NC, or 0.75× for HT/DC)—the same rows Expert+ dims as rate-edited. A checkbox under the mod filters mirrors this option.",
      group: "Beatmap Detail",
      default: false,
    },
    {
      id: "beatmapDetail.diffNameBesidePicker",
      label: "Difficulty name & stars in the active picker cell",
      description:
        "On beatmapset pages, puts the selected difficulty’s name, guest mapper credit when applicable (mapped by …), and nomod star rating inside the same bordered box as the active difficulty icon. Hides the duplicate header diff line and the separate nomod star chip.",
      group: "Beatmap Detail",
      default: false,
    },
  ];

  /** GM keys used by UI elsewhere (not listed in the options panel). */
  const PANEL_HIDDEN_BOOLEAN_DEFAULTS = Object.freeze({
    "userProfile.recentScoresShowFails": true,
  });

  (function migrateScoreListDetails() {
    const flag = "userProfile._oepScoreListDetailsMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const pp = GM_getValue("userProfile.ppDecimals", unset);
    const st = GM_getValue("userProfile.bestScoreStats", unset);
    if (pp === unset && st === unset) {
      GM_setValue(flag, true);
      return;
    }
    const on = (v) => (v === unset ? true : v);
    GM_setValue("userProfile.scoreListDetails", on(pp) && on(st));
    GM_deleteValue("userProfile.ppDecimals");
    GM_deleteValue("userProfile.bestScoreStats");
    GM_setValue(flag, true);
  })();

  (function migrateScoreListDetailsSplit() {
    const flag = "userProfile._oepScoreListDetailsSplitMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const legacy = "userProfile.scoreListDetails";
    const v = GM_getValue(legacy, unset);
    if (v !== unset) {
      const on = Boolean(v);
      GM_setValue("userProfile.scorePpDecimals", on);
      GM_setValue("userProfile.scoreHitStatistics", on);
      GM_deleteValue(legacy);
    }
    GM_setValue(flag, true);
  })();

  (function migrateBeatmapCardDifficultyRange() {
    const flag = "userProfile._oepBeatmapCardDifficultyRangeMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const newKey = "userProfile.beatmapCardDifficultyRange";
    if (GM_getValue(newKey, unset) !== unset) {
      GM_setValue(flag, true);
      return;
    }
    const extra = FEATURES.find(
      (f) => f.id === "userProfile.beatmapCardExtraInfo",
    );
    const extraDefault = extra ? extra.default : false;
    if (GM_getValue("userProfile.beatmapCardExtraInfo", extraDefault)) {
      GM_setValue(newKey, true);
    }
    GM_setValue(flag, true);
  })();

  /** @type {Map<string, Set<function>>} */
  const _listeners = new Map();

  /** Return the full feature registry (read-only copy). */
  function getFeatures() {
    return FEATURES.slice();
  }

  /**
   * Read the stored value for a feature.
   * Falls back to the registered default if nothing has been saved yet.
   * @param {string} id
   * @returns {boolean}
   */
  function isEnabled(id) {
    const feature = FEATURES.find((f) => f.id === id);
    const defaultVal = feature
      ? feature.default
      : (PANEL_HIDDEN_BOOLEAN_DEFAULTS[id] ?? false);
    return GM_getValue(id, defaultVal);
  }

  /**
   * Persist a new value and notify all listeners for that feature.
   * @param {string} id
   * @param {boolean} value
   */
  function set(id, value) {
    GM_setValue(id, value);
    _listeners.get(id)?.forEach((fn) => {
      try {
        fn(value);
      } catch (_) {}
    });
  }

  /**
   * Subscribe to changes for a specific feature.
   * Returns an unsubscribe function.
   * @param {string} id
   * @param {function(boolean): void} fn
   * @returns {function}
   */
  function onChange(id, fn) {
    if (!_listeners.has(id)) _listeners.set(id, new Set());
    _listeners.get(id).add(fn);
    return () => _listeners.get(id)?.delete(fn);
  }

  /** Revert every option listed in the settings panel to its registered default. */
  function resetPanelTogglesToDefaults() {
    for (const f of FEATURES) {
      set(f.id, Boolean(f.default));
    }
  }

  const IDS = Object.freeze({
    ALWAYS_SHOW_STATS: "userProfile.alwaysShowStats",
    BEATMAP_CARD_EXTRA_INFO: "userProfile.beatmapCardExtraInfo",
    BEATMAP_CARD_DIFFICULTY_RANGE: "userProfile.beatmapCardDifficultyRange",
    FULL_BEATMAP_STAT_NUMBERS: "userProfile.fullBeatmapStatNumbers",
    SCORE_PP_DECIMALS: "userProfile.scorePpDecimals",
    SCORE_HIT_STATISTICS: "userProfile.scoreHitStatistics",
    MODDED_STAR_RATING: "userProfile.moddedStarRating",
    MOD_ICONS_AS_ACRONYMS: "userProfile.modIconsAsAcronyms",
    HIDE_CL_MOD: "userProfile.hideClMod",
    SCORE_CARD_BACKGROUNDS: "userProfile.scoreCardBackgrounds",
    SCORE_CARD_PLACE_NUMBER: "userProfile.scoreCardPlaceNumber",
    SCORE_PERIOD_HIGHLIGHT: "scores.periodHighlight",
    BWS_RANKING: "userProfile.bwsRanking",
    PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE:
      "userProfile.profileSectionCollapseRemoveFromPage",
    RECENT_SCORES_SHOW_FAILS: "userProfile.recentScoresShowFails",
    METADATA_DESCRIPTION_MODAL_BUTTONS:
      "beatmapDetail.metadataDescriptionModalButtons",
    DISCUSSION_DEFAULT_TO_TOTAL: "beatmapDetail.discussionDefaultToTotal",
    OMDB_BEATMAPSET_RATINGS: "beatmapDetail.omdbBeatmapsetRatings",
    BEATMAP_PREVIEW: "beatmapDetail.beatmapPreview",
    BEATMAPSET_PREVIEW_AUDIO_BUTTON:
      "beatmapDetail.beatmapsetPreviewAudioButton",
    BEATCONNECT_DOWNLOAD_BUTTON: "beatmapDetail.beatconnectDownloadButton",
    API_EXTENDED_LEADERBOARD: "beatmapDetail.apiExtendedLeaderboard",
    SCOREBOARD_MOD_GRID: "beatmapDetail.scoreboardModGrid",
    SCOREBOARD_HIDE_CUSTOM_RATE_SCORES:
      "beatmapDetail.scoreboardHideCustomRateScores",
    SCOREBOARD_PLAYER_LOOKUP: "beatmapDetail.scoreboardPlayerLookup",
    DIFF_NAME_BESIDE_PICKER: "beatmapDetail.diffNameBesidePicker",
  });

  return {
    IDS,
    getFeatures,
    isEnabled,
    set,
    onChange,
    resetPanelTogglesToDefaults,
  };
})();
