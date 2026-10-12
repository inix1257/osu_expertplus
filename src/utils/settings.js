/** GM-backed feature toggles: isEnabled, set, onChange, IDS.* */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settings = (() => {
  const FEATURES = [
    {
      id: "header.navRecentNotification",
      label: "Latest notification preview in header",
      description:
        "Shows the newest unread chat message or notification as a one-line “username: content” pill under the chat/notification counter in the top-right header, stretched left to the Twitter button (click it to open the matching popup). Hover shows the full text; truncated comments and discussion posts are fetched once with a read-only request. Uses the page’s own notification data, so nothing is marked as read.",
      group: "Header",
      default: true,
    },
    {
      id: "userProfile.alwaysShowStats",
      label: "Always show play count and favourites on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: keeps play count and favourite count visible on each beatmap card without hovering.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardExtraInfo",
      label: "Extra metadata on beatmap cards",
      description:
        "On user profiles and the beatmap listing: shows the song’s source (“from …”) under the artist, and BPM and length under the mapper.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.beatmapCardDifficultyRange",
      label: "Highest star rating on beatmap cards",
      description:
        "On user profiles and the beatmap listing: shows the set’s highest star rating (no mods) as a coloured badge after each mode’s difficulty dots.",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.fullBeatmapStatNumbers",
      label: "Exact play and favourite counts on beatmap cards",
      description:
        "On user profiles and the beatmap listing: shows exact play and favourite counts (e.g. 159,915 instead of 159.9K).",
      group: "Beatmap Card",
      default: true,
    },
    {
      id: "userProfile.bwsRanking",
      label: "BWS and ranked score rank in profile header",
      description:
        "Shows extra rankings in the profile header next to global and country: BWS (badge-weighted rank) and ranked-score rank from api.kirino.sh. The badge count used for BWS can be changed for the current visit.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.bbcodeHelper",
      label: "BBCode helper in the me! editor",
      description:
        "When editing your me! page: a BBCode toolbar (formatting, colour and size pickers, imagemap editor) and a live preview.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.mediaOpenButtons",
      label: "Open avatar and banner images",
      description:
        "On user profiles, adds buttons over the avatar and the cover banner that open the full-size image in a new tab.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.userpageExpand",
      label: "Expand long me! pages",
      description:
        "On user profiles, lets a long me! page expand to its full height instead of scrolling inside its box.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.profileSectionCollapseRemoveFromPage",
      label: "Hide collapsed sections completely",
      description:
        "When enabled, collapsing a section via Contents hides the whole block until you expand it from Contents again. When disabled (default), the section heading stays on the page with “(collapsed)” and you can expand it by clicking the heading.",
      group: "User Profile",
      default: false,
    },
    {
      id: "userProfile.scoreHitStatistics",
      label: "Hit statistics on profile scores",
      description:
        "On pinned, best performance and first place scores, and on Recent plays with failed scores (Historical): adds a colour-coded hit row (great / ok / meh / miss). Beatmap leaderboards keep hit-stat colours regardless of this option.",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.moddedStarRating",
      label: "Star rating with mods on profile scores",
      description:
        "On profile scores, shows the star rating with the score’s mods applied. Requires osu! API credentials.",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.scorePpDecimals",
      label: "pp decimals on scores",
      description:
        "On profile best performance, pinned, first place and Recent plays (Historical), and on beatmap leaderboards: shows pp to two decimal places (e.g. 610.27pp) instead of rounding to an integer in the visible text (full value stays in the tooltip/title where the site provides it).",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.scoreCardBackgrounds",
      label: "Beatmap background on profile scores",
      description:
        "Shows the beatmap cover art behind each score in the profile Scores section and in Recent plays with failed scores (Historical).",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.scoreCardPlaceNumber",
      label: "Place numbers on profile scores",
      description:
        "On best performance: shows #1, #2, … before the beatmap title. On Recent plays with failed scores (Historical): #1 is the most recent visible score, then #2, … (respects Show failed scores).",
      group: "Scores",
      default: true,
    },
    {
      id: "scores.periodHighlight",
      label: "Highlight scores by date",
      description:
        "In the profile Scores section: a bar that highlights scores set within a chosen period (weeks to years), with reverse and reset.",
      group: "Scores",
      default: true,
    },
    {
      id: "userProfile.recentScoresWithFails",
      label: "Recent plays with failed scores",
      description:
        "On the Historical tab, replaces osu!’s Recent plays with Expert+’s list from the API: failed scores (Show failed scores), hit statistics, pp decimals, place numbers and a score options menu. Turning it off takes full effect after reloading the profile.",
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
      label: "Full description and metadata buttons",
      description:
        'On beatmapset pages, adds the "Show metadata" button under the artist and the "Full description" button in the info panel (each opens a modal).',
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.pickerDiffNames",
      label: "Difficulty names in the difficulty selector",
      description:
        "On beatmapset pages, shows each difficulty’s name and nomod star rating next to its icon in the difficulty selector.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.omdbBeatmapsetRatings",
      label: "OMDB ratings",
      description:
        "On beatmapset pages, shows an OMDB link to this mapset above the difficulty name. Difficulty stats, distribution popover, and star voting (0 at the left edge of the first star, then 0.5–5) need an OMDB API key in Expert+ settings.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapPreview",
      label: "Gameplay preview",
      description:
        "On beatmapset info pages, adds an expandable osu!standard gameplay preview played with the song preview. The renderer is downloaded from jsDelivr the first time you open it.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.backgroundButton",
      label: "Open background button",
      description:
        "On beatmapset pages, adds a square header button that opens the full-size beatmap background (assets.ppy.sh) in a new tab.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.beatmapsetPreviewAudioButton",
      label: "Open preview audio button",
      description:
        "On beatmapset info pages, adds a square header button (with icon) that opens the official preview MP3 at b.ppy.sh in a new tab.",
      group: "Beatmap Page",
      default: false,
    },
    {
      id: "beatmapDetail.mp3DownloadButton",
      label: "MP3 download button (third-party)",
      description:
        "On beatmapset pages, adds a square header button that downloads the song as MP3 from osu.ppyd.sh, a third-party site not run by ppy.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.beatconnectDownloadButton",
      label: "Beatconnect download button",
      description:
        "On beatmapset pages, shows a Beatconnect.io download button beside the main .osz download link.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.discussionDefaultToTotal",
      label: "Open discussions on the Total tab",
      description:
        "Opening a beatmap discussion page without choosing a tab shows the Total tab (all discussions) instead of osu!’s default.",
      group: "Beatmap Page",
      default: true,
    },
    {
      id: "beatmapDetail.apiExtendedLeaderboard",
      label: "Show top 100 scores",
      description:
        "On beatmap leaderboards, loads the top 100 scores instead of osu!’s default 50.",
      group: "Leaderboard",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardPlayerLookup",
      label: "Player search bar",
      description:
        "On beatmap leaderboards, adds a username field that looks up a player’s scores on the current difficulty and shows them in the leaderboard. Requires osu! API credentials (Client ID and Secret above).",
      group: "Leaderboard",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardModGrid",
      label: "Grouped mod filter grid",
      description:
        "On beatmap leaderboards, replaces the default horizontal mod strip with Expert+’s grouped grid (stable / Lazer, difficulty rows, reset, collapsible “Mod filters”). Turn off to use osu!’s original mod strip layout.",
      group: "Leaderboard",
      default: true,
    },
    {
      id: "beatmapDetail.scoreboardGlobalRank",
      label: "Player global ranks",
      description:
        "On beatmap leaderboards, shows each player’s global rank next to their username. Requires osu! API credentials.",
      group: "Leaderboard",
      default: true,
    },
  ];

  /** GM keys used by UI elsewhere (not listed in the options panel). */
  const PANEL_HIDDEN_BOOLEAN_DEFAULTS = Object.freeze({
    "userProfile.recentScoresShowFails": true,
    // Controlled solely by the always-visible checkbox above the beatmap leaderboard.
    "beatmapDetail.scoreboardHideCustomRateScores": false,
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
    RECENT_SCORES_WITH_FAILS: "userProfile.recentScoresWithFails",
    BBCODE_HELPER: "userProfile.bbcodeHelper",
    PROFILE_MEDIA_OPEN_BUTTONS: "userProfile.mediaOpenButtons",
    USERPAGE_EXPAND: "userProfile.userpageExpand",
    METADATA_DESCRIPTION_MODAL_BUTTONS:
      "beatmapDetail.metadataDescriptionModalButtons",
    DISCUSSION_DEFAULT_TO_TOTAL: "beatmapDetail.discussionDefaultToTotal",
    OMDB_BEATMAPSET_RATINGS: "beatmapDetail.omdbBeatmapsetRatings",
    BEATMAP_PREVIEW: "beatmapDetail.beatmapPreview",
    BEATMAPSET_PREVIEW_AUDIO_BUTTON:
      "beatmapDetail.beatmapsetPreviewAudioButton",
    BEATCONNECT_DOWNLOAD_BUTTON: "beatmapDetail.beatconnectDownloadButton",
    BACKGROUND_BUTTON: "beatmapDetail.backgroundButton",
    MP3_DOWNLOAD_BUTTON: "beatmapDetail.mp3DownloadButton",
    API_EXTENDED_LEADERBOARD: "beatmapDetail.apiExtendedLeaderboard",
    SCOREBOARD_MOD_GRID: "beatmapDetail.scoreboardModGrid",
    SCOREBOARD_HIDE_CUSTOM_RATE_SCORES:
      "beatmapDetail.scoreboardHideCustomRateScores",
    SCOREBOARD_PLAYER_LOOKUP: "beatmapDetail.scoreboardPlayerLookup",
    PICKER_DIFF_NAMES: "beatmapDetail.pickerDiffNames",
    SCOREBOARD_GLOBAL_RANK: "beatmapDetail.scoreboardGlobalRank",
    NAV_RECENT_NOTIFICATION: "header.navRecentNotification",
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
