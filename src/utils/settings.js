/** GM-backed feature toggles: isEnabled, set, onChange, IDS.* */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settings = (() => {
  const FEATURES = [
    {
      id: "userProfile.alwaysShowStats",
      label: "Always show play count & favourites",
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
      label: "Star rating range on beatmap cards",
      description:
        "On user profiles and on /beatmapsets: after each mode’s difficulty dots, shows min–max nomod star rating as coloured pills (from cached `difficulty_rating` per beatmap; same JSON sources as extra metadata).",
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
      id: "userProfile.scoreListDetails",
      label: "PP decimals & hit statistics on scores",
      description:
        "On best performance, pinned, and first place lists: shows pp to two decimal places (e.g. 610.27pp) and a colour-coded hit row (great / ok / meh / miss).",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.moddedStarRating",
      label: "Show modded star rating",
      description:
        "Fetches and displays the accurate star rating with mods applied next to each difficulty name. Requires API credentials.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.modIconsAsAcronyms",
      label: "Mod acronyms instead of icons",
      description:
        "Shows mod letters (e.g. HD, DT) on score rows and beatmap leaderboards instead of sprite icons.",
      group: "User Profile",
      default: false,
    },
    {
      id: "userProfile.hideClMod",
      label: "Hide Classic (CL) mod",
      description:
        "Hides the Classic (CL) mod on score rows and leaderboards. Works whether mods are shown as icons or acronyms.",
      group: "User Profile",
      default: false,
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
      label: "Show score place number",
      description:
        "Displays the position (#1, #2, …) before each score card's rank grade in the Ranks section.",
      group: "User Profile",
      default: true,
    },
    {
      id: "userProfile.recentScoresShowFails",
      label: "Recent scores: show failed scores",
      description:
        "On the profile Historical tab, the Expert+ “Recent scores” list can include failed plays. Turn off to show only passing scores. The “Show failed scores” control there uses the same setting.",
      group: "User Profile",
      default: true,
    },
    {
      id: "beatmapDetail.discussionDefaultToTotal",
      label: "Discussion opens on Total tab",
      description:
        "On beatmap discussion pages, redirect default/praise landing routes to /discussion/-/generalAll/total.",
      group: "Beatmap Detail",
      default: true,
    },
    {
      id: "beatmapDetail.omdbBeatmapsetRatings",
      label: "Show OMDB difficulty ratings",
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
  ];

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

  (function migrateBeatmapCardDifficultyRange() {
    const flag = "userProfile._oepBeatmapCardDifficultyRangeMigrated";
    if (GM_getValue(flag, false)) return;
    const unset = "__oep_unset__";
    const newKey = "userProfile.beatmapCardDifficultyRange";
    if (GM_getValue(newKey, unset) !== unset) {
      GM_setValue(flag, true);
      return;
    }
    const extra = FEATURES.find((f) => f.id === "userProfile.beatmapCardExtraInfo");
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
    const defaultVal = feature ? feature.default : false;
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

  const IDS = Object.freeze({
    ALWAYS_SHOW_STATS: "userProfile.alwaysShowStats",
    BEATMAP_CARD_EXTRA_INFO: "userProfile.beatmapCardExtraInfo",
    BEATMAP_CARD_DIFFICULTY_RANGE: "userProfile.beatmapCardDifficultyRange",
    FULL_BEATMAP_STAT_NUMBERS: "userProfile.fullBeatmapStatNumbers",
    SCORE_LIST_DETAILS: "userProfile.scoreListDetails",
    MODDED_STAR_RATING: "userProfile.moddedStarRating",
    MOD_ICONS_AS_ACRONYMS: "userProfile.modIconsAsAcronyms",
    HIDE_CL_MOD: "userProfile.hideClMod",
    SCORE_CARD_BACKGROUNDS: "userProfile.scoreCardBackgrounds",
    SCORE_CARD_PLACE_NUMBER: "userProfile.scoreCardPlaceNumber",
    RECENT_SCORES_SHOW_FAILS: "userProfile.recentScoresShowFails",
    DISCUSSION_DEFAULT_TO_TOTAL: "beatmapDetail.discussionDefaultToTotal",
    OMDB_BEATMAPSET_RATINGS: "beatmapDetail.omdbBeatmapsetRatings",
    BEATMAP_PREVIEW: "beatmapDetail.beatmapPreview",
  });

  return { IDS, getFeatures, isEnabled, set, onChange };
})();
