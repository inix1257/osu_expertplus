/** /beatmapsets/:id and variants. */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapDetail = (() => {
  const name = "BeatmapDetail";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    qs,
    qsa,
    manageStyle,
    createCleanupBag,
    parseLocaleNumber,
    formatDecimalPp,
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const auth = OsuExpertPlus.auth;
  const omdb = OsuExpertPlus.omdb;

  // With user-profile: score-row PP + hit stats
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const METADATA_DESCRIPTION_MODAL_BUTTONS_ID =
    IDS.METADATA_DESCRIPTION_MODAL_BUTTONS;
  const DISCUSSION_DEFAULT_TO_TOTAL_ID = IDS.DISCUSSION_DEFAULT_TO_TOTAL;
  const OMDB_BEATMAPSET_RATINGS_ID = IDS.OMDB_BEATMAPSET_RATINGS;
  const BEATMAP_PREVIEW_ID = IDS.BEATMAP_PREVIEW;
  const BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID =
    IDS.BEATMAPSET_PREVIEW_AUDIO_BUTTON;
  const BEATCONNECT_DOWNLOAD_BUTTON_ID = IDS.BEATCONNECT_DOWNLOAD_BUTTON;
  const API_EXTENDED_LEADERBOARD_ID = IDS.API_EXTENDED_LEADERBOARD;
  const SCOREBOARD_MOD_GRID_ID = IDS.SCOREBOARD_MOD_GRID;
  const SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID =
    IDS.SCOREBOARD_HIDE_CUSTOM_RATE_SCORES;
  const SCOREBOARD_PLAYER_LOOKUP_ID = IDS.SCOREBOARD_PLAYER_LOOKUP;
  const DIFF_NAME_BESIDE_PICKER_ID = IDS.DIFF_NAME_BESIDE_PICKER;
  const beatmapPreview = OsuExpertPlus.beatmapPreview;
  const DISCUSSION_USER_CACHE = new Map();

  const STYLE_ID = "osu-expertplus-beatmap-detail-css";
  const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";
  const MOD_GRID_STYLE_ID = "osu-expertplus-beatmap-mod-grid-css";
  const ROOT_CLASS = "osu-expertplus-beatmapset-extras";
  const MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";
  const MOD_GRID_COLLAPSED_CLASS = `${MOD_GRID_CLASS}--collapsed`;
  /** Hidden React strip button → visible grid clone (clone does not receive React class updates). */
  const beatmapModGridOriginalToClone = new WeakMap();
  /** Live MO + debounce ids for `.beatmapset-scoreboard__mods` (tear down if setting flips off mid-setup). */
  const beatmapModGridLiveHandles = new WeakMap();

  const MOD_WILDCARD_CLASS = "oep-mod-wildcard";
  const MOD_WILDCARD_ATTR = "data-oep-mod-wildcard";
  const WILDCARD_MERGED_ROW_ATTR = "data-oep-wildcard-merged-row";
  /** Marks a wildcard row that is not the player's highest-ranked score in the merged list. */
  const WILDCARD_DUPE_ROW_ATTR = "data-oep-wildcard-dupe";
  /** Marks a row whose effective speed is not 1.00× or 1.50× (i.e. a custom-rate score). */
  const RATE_EDIT_ROW_ATTR = "data-oep-rate-edit";
  /** Row hidden because “hide custom rate scores” is on (restored when filter off). */
  const RATE_EDIT_ROW_HIDDEN_ATTR = "data-oep-rate-edit-filtered";
  /** In-page “hide custom rate scores” control; visibility follows whether any rate-edit row exists. */
  const RATE_EDIT_FILTER_BAR_ATTR = "data-oep-rate-edit-filter-bar";
  /** Player lookup bar wrapper; sits inside `.oep-scoreboard-tools-row` with the rate filter. */
  const SCOREBOARD_USER_SEARCH_ATTR = "data-oep-beatmap-user-search";
  /** Flex row under mod filters holding player lookup (optional) and rate-edit filter (optional). */
  const SCOREBOARD_TOOLS_ROW_ATTR = "data-oep-scoreboard-tools-row";
  const SCORE_USER_SEARCH_RESULT_ATTR = "data-oep-user-search-result";
  /** Marks an OEP-managed `.beatmap-scoreboard-top__item` that overrides the native panel. */
  const SCORE_TOP_OVERRIDE_ATTR = "data-oep-score-top-override";
  /** Marks the per-column sort control in `<th>` (re-mounted after osu-web React refresh). */
  const SCOREBOARD_SORT_ARROW_ATTR = "data-oep-scoreboard-sort-arrow";
  /** @type {readonly string[]} */
  const BEATMAP_SCOREBOARD_SORT_KEYS = Object.freeze([
    "score",
    "accuracy",
    "combo",
    "pp",
    "date",
  ]);
  const WILDCARD_LOADING_CLASS = "oep-wildcard-loading";
  const MAX_WILDCARD_MODS = 2;
  /** acronym → sequence counter (for oldest-eviction). 0 = not wildcard. */
  let wildcardModState = new Map();
  /** Monotonically increasing counter so the oldest wildcard can be evicted. */
  let wildcardSeqCounter = 0;
  /** Timer id for the 1-second mod-change debounce. */
  let wildcardDebounceTimer = 0;
  /** Abort controller for in-flight wildcard fetches. */
  let wildcardAbortCtrl = /** @type {AbortController|null} */ (null);
  /** Maps injected table row elements to their source score API objects for top-panel sync. */
  const _rowScoreMap = new WeakMap();

  /** One grid control for DT↔NC (cycle) and one for SD↔PF. */
  const MERGED_MOD_DT_NC = "DT_NC";
  const MERGED_MOD_SD_PF = "SD_PF";
  /** @type {Map<string, number>} merge id → step (DT_NC: 0–3, SD_PF: 0–4). */
  let mergedModCycleStep = new Map();

  const SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";
  /** Injected always-visible header nomod star rating (osu-web shows native line only on picker hover). */
  const HEADER_NOMOD_STAR_ATTR = "data-oep-header-nomod-star";
  /** Marks injected name / guest credit / SR block inside the active `.beatmapset-beatmap-picker__beatmap--active`. */
  const DIFF_BESIDE_PICKER_ATTR = "data-oep-header-diff-beside-picker";
  /** OMDB (omdb.nyahh.net) block above `.beatmapset-header__diff-name`. */
  const OEP_OMDB_WRAP_CLASS = "oep-beatmapset-omdb-wrap";
  const OEP_OMDB_ROW_CLASS = "oep-beatmapset-omdb-row";
  const OEP_OMDB_VOTE_CLASS = "oep-beatmapset-omdb-vote";
  /** Class added to the primary download link so it visually pairs with the Beatconnect button. */
  const BEATCONNECT_DL_PAIRED_CLASS = "oep-beatconnect-paired";
  const BEATCONNECT_DL_BTN_CLASS = "oep-beatmapset-beatconnect-btn";
  const BEATCONNECT_STACK_CLASS = "oep-beatconnect-stack";
  const BEATCONNECT_STACK_ICON_CLASS = "oep-beatconnect-stack__icon";
  const BEATCONNECT_STACK_LABEL_CLASS = "oep-beatconnect-stack__label";
  /** Header favourite square when the icon is `fas fa-heart` (favourited). */
  const BEATMAPSET_FAV_BTN_FAVOURITED_CLASS =
    "oep-beatmapset-favourite-btn--favourited";

  /**
   * Mods available in classic osu!stable / long-standing web filters — used to
   * split the second column (“lazer”) from the first (“stable”). Anything else
   * with a known acronym is treated as lazer-first.
   */
  const STABLE_MOD_ACRONYMS = new Set([
    "NM",
    "EZ",
    "NF",
    "HT",
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "SO",
    "TD",
    "RX",
    "AP",
    "FI",
    "K1",
    "K2",
    "K3",
    "K4",
    "K5",
    "K6",
    "K7",
    "K8",
    "K9",
  ]);

  const CSS = `
    /* Modal open controls: custom look per placement (header vs info panel). */
    .${ROOT_CLASS}__action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      box-sizing: border-box;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__action-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    /* osu-web uses 20px padding-bottom on artist; when our control follows, move
       that space to margin below the button (tighter to artist, gap before mapping). */
    .beatmapset-header
      .beatmapset-header__details-text--artist:has(+ [data-oep-beatmapset-metadata]) {
      padding-bottom: 0;
    }
    .${ROOT_CLASS}__action-btn--under-artist {
      align-self: flex-start;
      flex: 0 0 auto;
      width: max-content;
      max-width: 100%;
      margin-top: 4px;
      margin-bottom: 20px;
      color: hsl(var(--hsl-l1, 0 0% 96%));
      background: rgba(0, 0, 0, 0.35);
      border-color: hsl(var(--hsl-l1, 0 0% 100%) / 0.22);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }
    .${ROOT_CLASS}__action-btn--under-artist:hover {
      background: rgba(0, 0, 0, 0.52);
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      color: #fff;
    }
    .${ROOT_CLASS}__action-btn--primary {
      color: hsl(var(--hsl-l1, 0 0% 100%));
      background: hsl(var(--hsl-c1, 333 89% 68%));
      border-color: hsl(var(--hsl-c1, 333 89% 58%));
      text-shadow: none;
    }
    .${ROOT_CLASS}__action-btn--primary:hover {
      background: hsl(var(--hsl-c1, 333 89% 62%));
      border-color: hsl(var(--hsl-c1, 333 89% 52%));
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row {
      flex-direction: column;
      align-items: stretch;
    }
    /* Sticky bar matches osu beatmapset-info__header--sticky so title + Full description stay together. */
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-sticky-head {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 10px;
      row-gap: 6px;
      padding-bottom: 12px;
      margin-bottom: 0;
      position: sticky;
      top: 0;
      z-index: 1;
      background-color: hsl(var(--hsl-b4));
      background-image: linear-gradient(
        to top,
        hsla(var(--hsl-b4), 0),
        hsl(var(--hsl-b4)) 5px
      );
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > h3.beatmapset-info__header {
      margin: 0;
      padding: 5px 0 0;
      flex: 0 1 auto;
      min-width: 0;
      position: static;
      top: auto;
      z-index: auto;
      background-image: none;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading {
      flex: 0 0 auto;
      align-self: center;
      margin: 0;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.2;
      padding: 3px 8px;
      gap: 4px;
      border-radius: 5px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border-color: hsl(var(--hsl-b5, 333 18% 28%));
      text-shadow: none;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading i {
      font-size: 10px;
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row .${ROOT_CLASS}__description-sticky-head > .${ROOT_CLASS}__action-btn--description-heading:hover {
      background: hsl(var(--hsl-b4, 333 18% 22%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
    }
    .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > div:not([class]) {
      flex: 1 0 100%;
      min-width: 0;
    }

    .${ROOT_CLASS}__modal-portal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      box-sizing: border-box;
    }
    .${ROOT_CLASS}__modal-portal.${ROOT_CLASS}__modal-portal--open {
      display: flex;
    }
    .${ROOT_CLASS}__modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      cursor: pointer;
    }
    .${ROOT_CLASS}__modal {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: min(92vw, 600px);
      max-height: min(88vh, 680px);
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
      border: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-family: inherit;
      animation: ${ROOT_CLASS}-modal-in 160ms ease-out;
    }
    .${ROOT_CLASS}__modal--description {
      max-width: min(92vw, 720px);
      max-height: min(88vh, 78vh);
    }
    .${ROOT_CLASS}__description-toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 10px;
    }
    .${ROOT_CLASS}__description-prose {
      font-size: 13px;
      line-height: 1.55;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      word-break: break-word;
    }
    .${ROOT_CLASS}__description-prose .bbcode {
      color: inherit;
    }
    @keyframes ${ROOT_CLASS}-modal-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .${ROOT_CLASS}__modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px 12px;
      border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      flex-shrink: 0;
    }
    .${ROOT_CLASS}__modal-header-start {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .${ROOT_CLASS}__modal-header-osu-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      flex-shrink: 0;
      max-width: min(100%, 240px);
    }
    .${ROOT_CLASS}__modal-header-osu-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 30px;
      padding: 5px 10px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
    }
    .${ROOT_CLASS}__modal-header-osu-msg {
      margin: 0;
      font-size: 10px;
      font-weight: 500;
      line-height: 1.3;
      color: #e07a7a;
    }
    .${ROOT_CLASS}__modal-header-osu-msg:empty {
      display: none;
    }
    .${ROOT_CLASS}__modal-header-osu-btn:hover:not(:disabled) {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__modal-header-osu-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__modal-header-osu-btn:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .${ROOT_CLASS}__modal-title {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
    }
    .${ROOT_CLASS}__modal-close {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: hsl(var(--hsl-l2, 0 0% 78%));
      background: transparent;
      transition: background 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__modal-close:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__modal-body {
      padding: 4px 16px 16px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .${ROOT_CLASS}__row {
      display: grid;
      grid-template-columns: minmax(120px, 30%) 1fr;
      gap: 8px 16px;
      padding: 12px 0;
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .${ROOT_CLASS}__row:last-child {
      border-bottom: none;
    }
    .${ROOT_CLASS}__label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.9;
      align-self: start;
      padding-top: 3px;
    }
    .${ROOT_CLASS}__value-cell {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }
    .${ROOT_CLASS}__value {
      margin: 0;
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.45;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      word-break: break-word;
    }
    .${ROOT_CLASS}__value--muted {
      color: hsl(var(--hsl-l2, 0 0% 65%));
      font-style: italic;
    }
    .${ROOT_CLASS}__copy-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-top: 1px;
      padding: 0;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      transition: background 120ms ease, color 120ms ease;
    }
    .${ROOT_CLASS}__copy-btn:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${ROOT_CLASS}__copy-btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__value-cell > .${ROOT_CLASS}__tags {
      flex: 1;
      min-width: 0;
    }
    .${ROOT_CLASS}__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-start;
    }
    .${ROOT_CLASS}__tag-wrap,
    .${ROOT_CLASS}__copy-wrap {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      vertical-align: top;
      max-width: 100%;
    }
    .${ROOT_CLASS}__copied-toast {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translate(-50%, -5px);
      padding: 3px 8px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 96%));
      background: hsl(var(--hsl-b6, 333 18% 28%));
      border: 1px solid hsl(var(--hsl-c2, 333 60% 60%) / 0.45);
      border-radius: 5px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 140ms ease, visibility 140ms ease;
      z-index: 5;
    }
    .${ROOT_CLASS}__copied-toast--show {
      opacity: 1;
      visibility: visible;
    }
    .${ROOT_CLASS}__tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      max-width: 100%;
      min-width: 0;
      margin: 0;
      padding: 5px 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      border-radius: 999px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      cursor: pointer;
      transition: border-color 160ms ease, background 160ms ease;
      appearance: none;
      -webkit-appearance: none;
      text-align: center;
    }
    .${ROOT_CLASS}__tag:hover {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    .${ROOT_CLASS}__tag:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    .${ROOT_CLASS}__err {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: hsl(var(--hsl-l2, 0 0% 78%));
    }
    .oep-discussion-preview-toggle {
      margin-left: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .oep-discussion-preview-toggle:hover {
      background: hsl(var(--hsl-b5, 333 18% 24%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    .oep-discussion-preview-toggle[aria-pressed="true"] {
      background: hsl(var(--hsl-c1, 333 89% 68%) / 0.2);
      border-color: hsl(var(--hsl-c1, 333 89% 58%));
      color: hsl(var(--hsl-l1, 0 0% 100%));
    }
    .oep-discussion-preview {
      margin-top: 10px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      background: hsl(var(--hsl-b3, 333 18% 14%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
      font-size: 13px;
      line-height: 1.55;
      word-break: break-word;
    }
    .oep-discussion-preview[hidden] {
      display: none !important;
    }
    .oep-discussion-preview__title {
      margin: 0 0 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
    }
    .oep-discussion-preview__body pre,
    .oep-discussion-preview__body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .oep-discussion-preview__body pre {
      overflow-x: auto;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%));
    }
    .oep-discussion-preview__body p,
    .oep-discussion-preview__body ul,
    .oep-discussion-preview__body ol,
    .oep-discussion-preview__body blockquote {
      margin: 0 0 8px;
    }
    .oep-discussion-preview__body p:last-child,
    .oep-discussion-preview__body ul:last-child,
    .oep-discussion-preview__body ol:last-child,
    .oep-discussion-preview__body blockquote:last-child {
      margin-bottom: 0;
    }
    .oep-discussion-preview__body blockquote {
      border-left: 3px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      padding-left: 10px;
      color: hsl(var(--hsl-l2, 0 0% 78%));
    }
    .oep-discussion-preview__body img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 8px 0;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%));
    }
    .oep-discussion-preview__empty {
      color: hsl(var(--hsl-l2, 0 0% 68%));
      font-style: italic;
    }
    .oep-markdown-helper {
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      box-sizing: border-box;
    }
    .oep-markdown-helper__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
    }
    .oep-markdown-helper--new-discussion {
      margin: 0 0 10px;
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
      background: hsl(var(--hsl-b2, 333 18% 10%) / 0.65);
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__row {
      gap: 6px;
    }
    .oep-markdown-helper--reply {
      margin: 10px 10px 10px;
      padding: 0 0 6px;
      border: none;
      border-radius: 0;
      border-bottom: 1px solid hsl(var(--hsl-b5, 333 18% 22%) / 0.55);
      background: transparent;
      box-shadow: none;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row {
      flex-wrap: nowrap;
      gap: 4px;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: hsl(var(--hsl-b5, 333 18% 30%)) transparent;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar {
      height: 4px;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: hsl(var(--hsl-b5, 333 18% 32%));
    }
    .oep-markdown-helper__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 5px 8px;
      min-height: 26px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b3, 333 18% 14%));
      color: hsl(var(--hsl-l2, 0 0% 82%));
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      white-space: nowrap;
      margin: 0;
      box-shadow: none;
      transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn {
      padding: 5px 9px;
      min-height: 28px;
      border-radius: 6px;
      border-color: hsl(var(--hsl-b5, 333 18% 26%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
      color: hsl(var(--hsl-l1, 0 0% 98%));
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
      outline-offset: 2px;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn {
      flex: 0 0 auto;
      padding: 3px 6px;
      min-height: 24px;
      gap: 3px;
      border-radius: 5px;
      font-size: 9px;
      font-weight: 600;
      border-color: hsl(var(--hsl-b5, 333 18% 26%) / 0.85);
      background: hsl(var(--hsl-b3, 333 18% 13%) / 0.9);
      color: hsl(var(--hsl-l2, 0 0% 80%));
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 18%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
      outline-offset: 1px;
    }
    .oep-markdown-helper__btn:hover {
      background: hsl(var(--hsl-b4, 333 18% 19%));
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.38);
      color: hsl(var(--hsl-l1, 0 0% 96%));
    }
    .oep-markdown-helper__btn i {
      font-size: 10px;
      opacity: 0.88;
    }
    .oep-markdown-helper--new-discussion .oep-markdown-helper__btn i {
      font-size: 11px;
      opacity: 0.9;
    }
    .oep-markdown-helper--reply .oep-markdown-helper__btn i {
      font-size: 9px;
      opacity: 0.85;
    }
    .oep-discussion-voters-tooltip {
      min-width: min(216px, 70vw);
      max-width: min(252px, 78vw);
      padding: 0 !important;
      overflow: hidden;
      border-radius: 10px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 22%));
      background: hsl(var(--hsl-b1, 333 18% 8%));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }
    .oep-discussion-voters-tooltip__list {
      max-height: min(320px, 52vh);
      overflow: auto;
      background: hsl(var(--hsl-b1, 333 18% 8%));
    }
    .oep-discussion-voters-tooltip__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 9px;
      margin: 4px;
      text-decoration: none;
      color: hsl(var(--hsl-l1, 0 0% 92%));
      border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
      border-radius: 8px;
      background: hsl(var(--hsl-b2, 333 18% 10%));
      transition: background 120ms ease;
    }
    .oep-discussion-voters-tooltip__row:last-child {
      margin-bottom: 6px;
    }
    .oep-discussion-voters-tooltip__row:hover {
      background: hsl(var(--hsl-b3, 333 18% 13%));
    }
    .oep-discussion-voters-tooltip__avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    }
    .oep-discussion-voters-tooltip__name {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  const MOD_GRID_ATTR = "data-oep-mod-grid";
  const MOD_RESET_BTN_SYNC_ATTR = "data-oep-mod-reset-sync-obs";

  const MOD_GRID_CSS = `
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
      display: grid !important;
      gap: 8px 12px;
      align-items: start;
      justify-items: stretch;
      margin-bottom: 1.5rem;
      text-align: start;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] > .beatmap-scoreboard-mod[data-oep-mod-hidden] {
      display: none !important;
    }
    /* osu-web: .beatmapset-scoreboard__mods--initial:hover sets --scoreboard-mod-opacity: 0.5; only a
       hovered .beatmap-scoreboard-mod sets it back to 1. Expert+ adds labels/headers/gaps, so hovering
       those counts as “strip hover” but not “mod hover” → every icon stays dimmed. Keep full opacity
       unless the pointer is actually on a mod button. */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].beatmapset-scoreboard__mods--initial:hover:not(:has(.beatmap-scoreboard-mod:hover)) {
      --scoreboard-mod-opacity: 1;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
      grid-template-columns: minmax(6.5rem, max-content) minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas:
        "mod-toggle mod-toggle mod-toggle"
        "hdr-corner hdr-stable hdr-lazer"
        "r0-label r0-stable r0-lazer"
        "r1-label r1-stable r1-lazer"
        "r2-label r2-stable r2-lazer";
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__toggle-row {
      grid-area: mod-toggle;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      justify-self: stretch;
      width: 100%;
      min-width: 0;
      text-align: start;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle {
      position: relative;
      display: block;
      flex: 0 0 auto;
      margin: 0;
      margin-right: auto;
      padding: 4px 0 4px 1.35rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-align: start !important;
      width: fit-content;
      max-width: 100%;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-label {
      display: block;
      text-align: start !important;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:hover {
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
      border-radius: 4px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle i {
      position: absolute;
      left: 0;
      top: 50%;
      width: 1rem;
      height: 1em;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 12px;
      line-height: 1;
      opacity: 0.9;
      transform: translateY(-50%);
      transform-origin: 0.35em 50%;
      transition: transform 0.15s ease;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS} {
      text-align: start !important;
      width: 100% !important;
      max-width: 100%;
      box-sizing: border-box;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
      > :not(.${MOD_GRID_CLASS}__toggle-row):not(.beatmap-scoreboard-mod) {
      display: none !important;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
      .${MOD_GRID_CLASS}__collapse-toggle i {
      transform: translateY(-50%) rotate(-90deg);
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-corner {
      grid-area: hdr-corner;
      min-height: 1px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods {
      flex: 0 0 auto;
      margin: 0;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid hsl(var(--hsl-b4, 333 18% 28%));
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 88%));
      background: hsl(var(--hsl-b5, 333 18% 22%));
      line-height: 1.2;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:hover:not(:disabled) {
      filter: brightness(1.1);
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 2px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-stable {
      grid-area: hdr-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-lazer {
      grid-area: hdr-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-label {
      grid-area: r0-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-label {
      grid-area: r1-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-label {
      grid-area: r2-label;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-stable {
      grid-area: r0-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-lazer {
      grid-area: r0-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-stable {
      grid-area: r1-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-lazer {
      grid-area: r1-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-stable {
      grid-area: r2-stable;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-lazer {
      grid-area: r2-lazer;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.9;
      padding-top: 0;
      line-height: 1.25;
      max-width: 11rem;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l1, 0 0% 88%));
      padding: 2px 0 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead--lazer {
      justify-content: space-between;
      flex-wrap: wrap;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__pile {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide {
      flex: 1 1 100%;
      width: 100%;
      max-width: 22rem;
      box-sizing: border-box;
      margin-top: 2px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid hsl(var(--hsl-b4, 333 18% 28%) / 0.55);
      background: hsl(var(--hsl-b2, 333 18% 10%) / 0.9);
      font-size: 9px;
      line-height: 1.35;
      color: hsl(var(--hsl-c2, 333 60% 72%));
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon {
      position: relative;
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      margin-top: 1px;
      border-radius: 8px;
      box-sizing: border-box;
      background: hsl(var(--hsl-b4, 333 18% 18%) / 0.6);
      outline: 2px dashed hsl(45 100% 60% / 0.85);
      outline-offset: 1px;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon::after {
      content: "?";
      position: absolute;
      top: -5px;
      right: -5px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: hsl(45 100% 50%);
      color: hsl(0 0% 10%);
      font-size: 10px;
      font-weight: 800;
      line-height: 15px;
      text-align: center;
      pointer-events: none;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text {
      margin: 0;
      min-width: 0;
    }
    [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text strong {
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-weight: 700;
    }
    /* Mod statistics numbers (grid layout only): enabled mods -> white. */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender span,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator span,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__stat,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__count {
      color: hsl(var(--hsl-l1, 0 0% 90%)) !important;
    }
    /* Wildcard mod styling */
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} {
      position: relative;
      --scoreboard-mod-opacity: 0.85;
      filter: none;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .mod__icon {
      outline: 2px dashed hsl(45 100% 60% / 0.85);
      outline-offset: 1px;
      border-radius: 8px;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS}::after {
      content: "?";
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: hsl(45 100% 50%);
      color: hsl(0 0% 10%);
      font-size: 11px;
      font-weight: 800;
      line-height: 16px;
      text-align: center;
      pointer-events: none;
      z-index: 2;
    }
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__stat,
    .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__count {
      color: hsl(45 100% 70%) !important;
    }
    /* Wildcard loading overlay on the scoreboard table */
    .${WILDCARD_LOADING_CLASS} {
      position: relative;
      pointer-events: none;
      opacity: 0.45;
      transition: opacity 0.15s ease;
    }
    .${WILDCARD_LOADING_CLASS}::after {
      content: "Loading mod combinations…";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: hsl(0 0% 85%);
      pointer-events: none;
      z-index: 5;
    }
    /* Favourite hover popover (replaces osu! qtip user list on heart stat). */
    .${ROOT_CLASS}__fav-popover {
      position: fixed;
      z-index: 20050;
      box-sizing: border-box;
      width: min(92vw, 19rem);
      max-height: min(72vh, 24rem);
      padding: 10px 12px;
      border-radius: 10px;
      background: hsl(var(--hsl-b2, 333 18% 12%) / 0.82);
      border: 1px solid hsl(var(--hsl-b4, 333 18% 22%) / 0.55);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: hsl(var(--hsl-l1, 0 0% 92%));
      font-size: 12px;
      line-height: 1.35;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.11s ease, visibility 0.11s ease;
    }
    .${ROOT_CLASS}__fav-popover.${ROOT_CLASS}__fav-popover--visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    .${ROOT_CLASS}__fav-popover-title {
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: hsl(var(--hsl-l2, 0 0% 78%));
      margin-bottom: 8px;
    }
    .${ROOT_CLASS}__fav-popover-scroll {
      max-height: min(62vh, 20rem);
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    }
    .${ROOT_CLASS}__header-fav-chip {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      color: inherit;
      text-decoration: none;
      font-weight: 600;
      padding: 2px 0;
      border-radius: 6px;
    }
    .${ROOT_CLASS}__header-fav-chip:hover {
      color: hsl(var(--hsl-c2, 333 60% 82%));
    }
    .${ROOT_CLASS}__header-fav-chip:hover .${ROOT_CLASS}__header-fav-name {
      text-decoration: underline;
    }
    .${ROOT_CLASS}__header-fav-chip--text {
      font-weight: 500;
      padding-left: 4px;
    }
    .${ROOT_CLASS}__header-fav-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: hsla(var(--hsl-b6, 333 12% 20%), 0.6);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
    }
    .${ROOT_CLASS}__header-fav-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      flex: 1 1 auto;
    }
    .${ROOT_CLASS}__header-favouriters-muted {
      opacity: 0.85;
      font-weight: 400;
      padding: 4px 2px 8px;
    }

    .beatmapset-header__beatmap-picker-box:has(.oep-picker-hover-hint)
      > .beatmapset-beatmap-picker {
      padding-left: 0;
    }
    .oep-picker-hover-hint {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.2rem 0.6rem 0.15rem 0;
      min-height: 1.5rem;
      font-size: 1.0625rem;
      /* Same muted mix as active picker cell border (see .oep-diff-beside-picker --oep-diff-muted). */
      --oep-diff-muted: color-mix(
        in srgb,
        var(--oep-hint-diff, hsl(var(--hsl-c1))) 44%,
        #ffffff
      );
      color: var(--oep-diff-muted);
    }
    .oep-picker-hover-hint__version {
      font-weight: 600;
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .oep-picker-hover-hint__star {
      display: inline-flex;
      align-items: baseline;
      gap: 0.2em;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .oep-picker-hover-hint__star .fa-star {
      font-size: 0.92em;
      color: inherit;
    }

    .${OEP_OMDB_WRAP_CLASS} {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 2px 0 4px;
    }
    .${OEP_OMDB_ROW_CLASS} {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 6px 10px;
      margin: 0;
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .${OEP_OMDB_ROW_CLASS}__label {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.92;
      color: hsl(var(--hsl-l1, 0 0% 94%));
    }
    a.${OEP_OMDB_ROW_CLASS}__label {
      text-decoration: none;
      border-bottom: 1px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
      cursor: pointer;
      transition: color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
    }
    a.${OEP_OMDB_ROW_CLASS}__label:hover {
      opacity: 1;
      color: hsl(var(--hsl-c2, 333 72% 78%));
      border-bottom-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
    }
    a.${OEP_OMDB_ROW_CLASS}__label:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__body {
      flex: 1 1 auto;
      min-width: 0;
    }
    .${OEP_OMDB_ROW_CLASS}__body--muted {
      opacity: 0.5;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link {
      color: inherit;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link:hover {
      color: hsl(var(--hsl-c2, 333 60% 72%));
      opacity: 1;
    }
    a.${OEP_OMDB_ROW_CLASS}__settings-link:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__body--error {
      color: #e05c5c;
      opacity: 0.95;
    }
    .${OEP_OMDB_ROW_CLASS}__ranks {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 0.2em;
      vertical-align: baseline;
    }
    .${OEP_OMDB_ROW_CLASS}__rank-muted {
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: none;
      opacity: 1;
      color: hsl(var(--hsl-l1, 0 0% 72%));
    }
    .${OEP_OMDB_ROW_CLASS}__rank-value {
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.02em;
      color: hsl(var(--hsl-l1, 0 0% 97%));
      font-variant-numeric: tabular-nums;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value {
      text-decoration: none;
      color: inherit;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value:hover {
      color: hsl(var(--hsl-c2, 333 72% 78%));
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__rank-sep {
      font-size: 14px;
      opacity: 0.45;
      font-weight: 500;
      margin-right: 0.05em;
    }

    .${OEP_OMDB_ROW_CLASS}__dist-anchor {
      position: relative;
      display: inline;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger {
      cursor: help;
      text-decoration: underline;
      text-decoration-style: dotted;
      text-underline-offset: 2px;
      text-decoration-color: hsla(var(--hsl-l1, 0 0% 90%), 0.35);
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:hover,
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
      text-decoration-color: hsl(var(--hsl-c2, 333 60% 65%) / 0.65);
      outline: none;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
      box-shadow: 0 0 0 2px hsla(var(--hsl-c2, 333 60% 70%), 0.45);
      border-radius: 2px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-popover {
      min-width: 20rem;
      max-width: min(34rem, calc(100vw - 16px));
      padding: 8px 10px 9px;
      border-radius: 8px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      border: 1px solid hsl(var(--hsl-b4, 333 18% 22%));
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      pointer-events: auto;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-head {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      opacity: 0.5;
      margin-bottom: 6px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-row {
      display: grid;
      grid-template-columns: 3.75rem minmax(0, 1fr) 2.25rem;
      align-items: center;
      gap: 6px 10px;
      margin-top: 4px;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-head + .${OEP_OMDB_ROW_CLASS}__dist-row {
      margin-top: 0;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-score {
      justify-self: stretch;
      text-align: right;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: hsl(var(--hsl-l1, 0 0% 86%));
    }
    .${OEP_OMDB_ROW_CLASS}__dist-bar-track {
      height: 5px;
      border-radius: 3px;
      background: hsla(var(--hsl-b5, 333 18% 28%), 0.55);
      overflow: hidden;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-bar {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(
        90deg,
        hsl(var(--hsl-c1, 333 89% 58%)),
        hsl(var(--hsl-c2, 333 60% 62%))
      );
      min-width: 0;
      transition: width 100ms ease;
    }
    .${OEP_OMDB_ROW_CLASS}__dist-count {
      text-align: right;
      font-variant-numeric: tabular-nums;
      opacity: 0.88;
      font-weight: 600;
    }

    .${OEP_OMDB_VOTE_CLASS} {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      font-size: 11px;
      line-height: 1.35;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .${OEP_OMDB_VOTE_CLASS}__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      min-width: 0;
    }
    .${OEP_OMDB_VOTE_CLASS}__label {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 1;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    }
    .${OEP_OMDB_VOTE_CLASS}__stars {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit {
      position: relative;
      width: 1.58em;
      height: 1.48em;
      flex-shrink: 0;
      transition: transform 120ms ease, filter 120ms ease;
    }
    .${OEP_OMDB_VOTE_CLASS}__stars:hover .${OEP_OMDB_VOTE_CLASS}__unit {
      filter: brightness(1.05);
    }
    .${OEP_OMDB_VOTE_CLASS}__icon {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -52%);
      font-size: 1.22rem;
      line-height: 1;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--empty {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--half,
    .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--half {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--empty,
    .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--full {
      display: block;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--empty,
    .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--half {
      display: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--empty {
      opacity: 0.5;
      color: hsl(var(--hsl-b6, 333 12% 42%));
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--full,
    .${OEP_OMDB_VOTE_CLASS}__icon--half {
      color: #ffc14d;
      filter: drop-shadow(0 0 5px hsla(38, 100%, 55%, 0.28))
        drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
    }
    .${OEP_OMDB_VOTE_CLASS}__icon--half {
      color: #ffca5c;
    }
    .${OEP_OMDB_VOTE_CLASS}__half {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      z-index: 2;
      border-radius: 0;
    }
    .${OEP_OMDB_VOTE_CLASS}__half:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
      outline-offset: 1px;
    }
    .${OEP_OMDB_VOTE_CLASS}__half--left { left: 0; }
    .${OEP_OMDB_VOTE_CLASS}__half--right { right: 0; }
    /* First star: narrow left strip = 0★, then 0.5 / 1.0 halves. */
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--zero {
      left: 0;
      width: 26%;
      z-index: 3;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--left {
      left: 26%;
      width: 37%;
    }
    .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--right {
      left: auto;
      right: 0;
      width: 37%;
    }
    .${OEP_OMDB_VOTE_CLASS}--busy .${OEP_OMDB_VOTE_CLASS}__half {
      cursor: wait;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}--busy {
      opacity: 0.72;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear {
      font: inherit;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l1, 0 0% 82%));
      cursor: pointer;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear:hover {
      border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
      color: hsl(var(--hsl-l1, 0 0% 92%));
    }
    .${OEP_OMDB_VOTE_CLASS}__clear:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .${OEP_OMDB_VOTE_CLASS}__clear--concealed {
      visibility: hidden;
      pointer-events: none;
    }
    .${OEP_OMDB_VOTE_CLASS}__status {
      font-size: 10px;
      opacity: 0.75;
      width: 100%;
    }
    .${OEP_OMDB_VOTE_CLASS}__status--error {
      color: #e05c5c;
      opacity: 0.95;
    }

    .btn-osu-big.${BEATCONNECT_DL_PAIRED_CLASS} {
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      margin-right: 0 !important;
    }
    .${BEATCONNECT_DL_BTN_CLASS} {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 5px 5px 0;
      min-width: 0;
      width: fit-content;
      max-width: 88px;
      align-self: stretch;
      border-radius: 0 4px 4px 0;
      border: none;
      padding: 4px 5px;
      text-decoration: none;
      cursor: pointer;
      text-transform: none;
      vertical-align: middle;
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h2));
      border-left: 1px solid hsl(var(--hsl-b5));
      transition: background-color 120ms ease, color 120ms ease,
        border-color 120ms ease;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_CLASS} {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: auto;
      max-width: 100%;
      gap: 3px;
      text-align: center;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_ICON_CLASS} {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      margin: 0;
      line-height: 0;
      font-size: 26px;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_LABEL_CLASS} {
      display: block;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: 0.02em;
      max-width: 100%;
    }
    .${BEATCONNECT_DL_BTN_CLASS} .oep-beatconnect-logo {
      display: block;
      height: 1em;
      width: auto;
      max-height: 26px;
      object-fit: contain;
    }

    .${BEATCONNECT_DL_BTN_CLASS}:hover,
    .${BEATCONNECT_DL_BTN_CLASS}:focus {
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h1));
      border-left-color: hsl(var(--hsl-b4));
    }
    .${BEATCONNECT_DL_BTN_CLASS}:active {
      color: hsl(var(--hsl-c1));
      background: hsl(var(--hsl-h1));
      border-left-color: hsl(var(--hsl-b4));
    }
    .${BEATCONNECT_DL_BTN_CLASS}:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2));
      outline-offset: 2px;
    }

    .beatmapset-header__buttons button.btn-osu-big--beatmapset-header-square.${BEATMAPSET_FAV_BTN_FAVOURITED_CLASS} {
      --bg: hsl(333, 72%, 58%);
      --hover-bg: hsl(333, 72%, 50%);
      --focus-bg: var(--hover-bg);
      --active-bg: var(--hover-bg);
      --colour: #fff;
      --hover-colour: #fff;
      --focus-colour: #fff;
      --active-colour: #fff;
      color: #fff;
    }

    /* Single always-visible nomod star line; hide osu-web duplicate on picker hover. */
    .beatmapset-header
      .beatmapset-header__diff-extra--star-difficulty:not([${HEADER_NOMOD_STAR_ATTR}]) {
      display: none !important;
    }
    .beatmapset-header__diff-extra--star-difficulty[${HEADER_NOMOD_STAR_ATTR}] {
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .beatmapset-header__diff-extra--star-difficulty[${HEADER_NOMOD_STAR_ATTR}] .fas.fa-star {
      font-size: 1em;
      color: inherit;
      vertical-align: baseline;
    }

    .beatmapset-header.oep-diff-beside-picker .beatmapset-header__diff-name {
      display: none !important;
    }
    .beatmapset-header.oep-diff-beside-picker [${HEADER_NOMOD_STAR_ATTR}="1"] {
      display: none !important;
    }
    /*
     * --diff is mirrored from .beatmap-icon onto the active cell only in JS.
     * --oep-diff-muted: pastel mix for the active cell frame + meta text (not the outer tray).
     */
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-header__beatmap-picker-box {
      width: auto;
      max-width: none;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child {
      --oep-diff-muted: color-mix(
        in srgb,
        var(--diff, hsl(var(--hsl-c1))) 44%,
        #ffffff
      );
    }
    .beatmapset-header.oep-diff-beside-picker .beatmapset-beatmap-picker {
      /* Keep tray background height consistent for single vs multi-diff sets. */
      min-height: 4rem;
      align-items: stretch;
      box-sizing: border-box;
    }
    /* Active cell: [ icon | diffname / SR ] — two columns, text stacked in column 2. */
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child {
      display: inline-flex !important;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.5rem 0.65rem;
      padding: 0.35rem 0.9rem 0.4rem;
      width: auto !important;
      height: auto !important;
      min-height: 2.85rem;
      box-sizing: border-box;
      max-width: min(100%, 22rem);
      position: relative;
      flex-shrink: 0;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active::before,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child::before {
      z-index: 0;
      border-color: var(--oep-diff-muted) !important;
    }
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active
      > .beatmap-icon,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker__beatmap--active
      > :first-child:not(.oep-picker-active-meta),
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child
      > .beatmap-icon,
    .beatmapset-header.oep-diff-beside-picker
      .beatmapset-beatmap-picker:has(> .beatmapset-beatmap-picker__beatmap:only-child)
      > .beatmapset-beatmap-picker__beatmap:only-child
      > :first-child:not(.oep-picker-active-meta) {
      flex-shrink: 0;
      align-self: center;
      position: relative;
      z-index: 1;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.1rem;
      min-width: 0;
      flex: 1 1 auto;
      line-height: 1.22;
      text-align: left;
      position: relative;
      z-index: 1;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__title-row {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 0.35rem;
      min-width: 0;
      max-width: 100%;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__version {
      font-weight: 600;
      font-size: 1rem;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
      max-width: 16rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 0 1 auto;
      min-width: 0;
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      font-size: 9px;
      font-weight: 600;
      margin-left: 0;
      color: var(--oep-diff-muted);
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra
      .oep-picker-active-meta__guest-user {
      color: inherit;
      text-decoration: none;
      cursor: pointer;
    }
    .beatmapset-header.oep-diff-beside-picker
      .oep-picker-active-meta__guest.beatmapset-header__diff-extra
      .oep-picker-active-meta__guest-user.js-usercard:hover {
      text-decoration: underline;
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__star {
      display: inline-flex;
      align-items: baseline;
      gap: 0.2em;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .beatmapset-header.oep-diff-beside-picker .oep-picker-active-meta__star .fas.fa-star {
      font-size: 1em;
      color: var(--oep-diff-muted);
      vertical-align: baseline;
    }

    /*
     * Beatmap leaderboard hit columns (GREAT/OK/MEH/MISS etc.) — same palette as
     * user-profile score card .oep-score-stats__val--* (see user-profile.js).
     */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300 * {
      color: #78dcff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100 * {
      color: #84e03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50 * {
      color: #e0b03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss * {
      color: #e05c5c;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--300 {
      color: #78dcff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--100 {
      color: #84e03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--50 {
      color: #e0b03a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--miss {
      color: #e05c5c;
    }
    /* CTB hit columns (L / DRP) */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l * {
      color: #5eead4;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp * {
      color: #93c5fd;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-l {
      color: #5eead4;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-drp {
      color: #93c5fd;
    }
    /* Mania PERFECT / GOOD */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect * {
      color: #ffd966;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good,
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good * {
      color: #7dd87a;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-perfect {
      color: #ffd966;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-good {
      color: #7dd87a;
    }
    /* PP column — all rulesets */
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-beatmap-scoreboard-pp-value {
      color: #c4b5fd;
    }
    /* Prevent overflow when the mod extender tab sits next to the icon. */
    .beatmapset-scoreboard .beatmap-scoreboard-table__mods .beatmap-scoreboard-mod {
      overflow: visible;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort {
      display: inline-block;
      margin-left: 0.28em;
      padding: 0 1px;
      vertical-align: middle;
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.32);
      cursor: pointer;
      font: inherit;
      font-size: 0.62em;
      line-height: 1;
      position: relative;
      top: -0.06em;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:hover {
      color: rgba(255, 255, 255, 0.55);
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort--active {
      color: #8fd4ff;
    }
    .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.45);
      outline-offset: 1px;
      border-radius: 2px;
    }
    .oep-scoreboard-tools-row {
      box-sizing: border-box;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem 1.25rem;
      margin: 0 0 0.75rem 0;
      width: 100%;
    }
    .oep-scoreboard-tools-row .oep-user-search {
      margin: 0;
      flex: 1 1 14rem;
      min-width: 0;
    }
    .oep-scoreboard-tools-row .oep-rate-edit-filter {
      margin: 0;
      flex: 0 0 auto;
      max-width: none;
      padding-top: 7px;
    }
    .oep-rate-edit-filter {
      box-sizing: border-box;
      margin: 0 0 0.5rem 0;
      max-width: 34rem;
    }
    .oep-rate-edit-filter label {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      cursor: pointer;
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.65);
      user-select: none;
    }
    .oep-rate-edit-filter input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      accent-color: #66ccff;
    }
    /* Beatmap scoreboard user search */
    .oep-user-search {
      box-sizing: border-box;
      margin: 0 0 1rem 0;
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 100%;
    }
    .oep-user-search__bar {
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 34rem;
    }
    .oep-user-search__input {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.92);
      font: inherit;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .oep-user-search__input:focus {
      border-color: rgba(102, 204, 255, 0.5);
      background: rgba(255, 255, 255, 0.09);
    }
    .oep-user-search__input::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }
    .oep-user-search__btn {
      flex-shrink: 0;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .oep-user-search__btn:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.28);
      color: rgba(255, 255, 255, 0.92);
    }
    .oep-user-search__btn:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.4);
      outline-offset: 1px;
    }
    .oep-user-search__btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .oep-user-search__btn--go {
      background: rgba(102, 204, 255, 0.12);
      border-color: rgba(102, 204, 255, 0.3);
      color: #8fd4ff;
    }
    .oep-user-search__btn--go:hover:not(:disabled) {
      background: rgba(102, 204, 255, 0.2);
      border-color: rgba(102, 204, 255, 0.5);
      color: #b3e3ff;
    }
    .oep-user-search__btn--reset[hidden] {
      display: none;
    }
    .oep-user-search__status {
      margin-top: 0.4rem;
      max-width: 34rem;
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.5);
      min-height: 1em;
    }
    .oep-user-search__result {
      margin-top: 0.6rem;
      overflow: visible;
      width: 100%;
      max-width: 100%;
    }
    .oep-user-search--no-api .oep-user-search__input:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }
    /* Same wrapper osu-web uses around the real table: sets --perfect-color, overflow-x, etc. */
    .oep-user-search__result .beatmap-scoreboard-table {
      max-width: 100%;
    }
    /* Searched-user result row — works both in the mini-table and in the real table */
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__cell,
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result]:hover > td.beatmap-scoreboard-table__cell {
      background-color: rgba(167, 139, 250, 0.12);
    }
    table.beatmap-scoreboard-table__table tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__cell:first-child {
      box-shadow: inset 3px 0 0 rgba(167, 139, 250, 0.55);
    }
    /* Cloned row includes osu-web’s hover-only ⋯ menu column; hide for lookup result */
    .oep-user-search__result thead th.beatmap-scoreboard-table__header--popup-menu {
      display: none !important;
    }
    tr[data-oep-user-search-result] > td.beatmap-scoreboard-table__popup-menu {
      display: none !important;
    }
    /* Custom-rate (non 1.00×/1.50×) scores — slightly dimmed. */
    tr[${RATE_EDIT_ROW_ATTR}] {
      opacity: 0.6;
    }
    tr[${RATE_EDIT_ROW_ATTR}]:hover {
      opacity: 0.9;
    }
    /* Non-top wildcard scores for a player — more heavily dimmed; overrides rate-edit above. */
    tr[${WILDCARD_DUPE_ROW_ATTR}] {
      opacity: 0.38;
    }
    tr[${WILDCARD_DUPE_ROW_ATTR}]:hover {
      opacity: 0.72;
    }
  `;

  const mainStyle = manageStyle(STYLE_ID, CSS);
  const modGridStyle = manageStyle(MOD_GRID_STYLE_ID, MOD_GRID_CSS);

  function ensureStyles() {
    mainStyle.inject();
  }

  function ensureModGridStyles() {
    modGridStyle.inject();
  }

  /**
   * @param {HTMLElement} modRoot
   * @returns {0|1|2}
   */
  function modDifficultyRow(modRoot) {
    const c = modRoot.className || "";
    if (/mod--type-DifficultyReduction/i.test(c)) return 0;
    if (/mod--type-DifficultyIncrease/i.test(c)) return 1;
    return 2;
  }

  /**
   * @param {HTMLElement} btn
   */
  function modButtonAcronym(btn) {
    const icon = btn.querySelector(".mod__icon[data-acronym]");
    const a = icon?.getAttribute("data-acronym")?.trim().toUpperCase();
    return a || "";
  }

  /**
   * @param {HTMLElement} btn
   */
  function modStableColumn(btn) {
    const ac = modButtonAcronym(btn);
    if (ac && STABLE_MOD_ACRONYMS.has(ac)) return true;
    return false;
  }

  /**
   * @param {HTMLElement} btn  `.beatmap-scoreboard-mod` strip button
   */
  function isBeatmapScoreboardModStripButtonOn(btn) {
    if (!(btn instanceof HTMLElement) || btn.disabled) return false;
    if (btn.classList.contains("beatmap-scoreboard-mod--enabled")) return true;
    if (btn.getAttribute("aria-pressed") === "true") return true;
    return false;
  }

  /**
   * Turn off each active mod filter by clicking the real strip buttons (not NM — that toggles “no mod”).
   * One click per frame so React can settle (exclusive mods, URL sync).
   * @param {HTMLElement} modsEl
   */
  function resetBeatmapScoreboardModSelection(modsEl) {
    mergedModCycleStep.clear();
    const hadWildcards = getWildcardMods().length > 0;
    if (hadWildcards) {
      clearWildcardState();
      for (const orig of modsEl.querySelectorAll(
        ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
      )) {
        if (!(orig instanceof HTMLElement)) continue;
        const ac = modButtonAcronym(orig);
        if (!ac) continue;
        updateCloneWildcardVisual(ac, modsEl, false);
      }
      const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
      if (scoreboardRoot instanceof HTMLElement) {
        clearWildcardMergedLeaderboard(scoreboardRoot);
      }
    }

    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (clone instanceof HTMLElement) {
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
      }
    }

    const maxSteps = 40;
    let step = 0;
    const run = () => {
      if (++step > maxSteps) {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
        return;
      }
      for (const btn of modsEl.querySelectorAll(
        ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
      )) {
        if (!(btn instanceof HTMLElement)) continue;
        const ac = modButtonAcronym(btn);
        if (!ac || ac === "NM") continue;
        if (isBeatmapScoreboardModStripButtonOn(btn)) {
          btn.click();
          window.requestAnimationFrame(run);
          return;
        }
      }
      syncBeatmapModGridCloneHighlights(modsEl);
      syncBeatmapScoreboardModResetButton(modsEl);
    };
    window.requestAnimationFrame(run);
  }

  /**
   * @param {HTMLElement} modsEl
   */
  function syncBeatmapScoreboardModResetButton(modsEl) {
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
   * @param {Element|null|undefined} el
   */
  function destroyOsuWebQtipIfBound(el) {
    try {
      const $ = typeof window !== "undefined" && window.$;
      if (!$ || !el || !$.fn?.qtip) return;
      const $el = $(el);
      if ($el.data("qtip")) $el.qtip("destroy");
    } catch (_) {
      void 0;
    }
  }

  /**
   * qTip’s target can lose hover events when innerHTML is replaced, leaving the popup stuck.
   * @param {HTMLElement} root
   */
  function destroyOsuWebQtipOnElementSubtree(root) {
    if (!(root instanceof HTMLElement)) return;
    destroyOsuWebQtipIfBound(root);
    for (const node of root.querySelectorAll("*")) {
      destroyOsuWebQtipIfBound(node);
    }
  }

  /**
   * Copies markup from the hidden React strip button onto the visible grid clone.
   * @param {HTMLElement} clone
   * @param {HTMLElement} original
   */
  function replaceBeatmapModGridCloneInnerHTML(clone, original) {
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
  function syncBeatmapModGridCloneHighlights(modsEl) {
    if (!modsEl.hasAttribute(MOD_GRID_ATTR)) return;
    const hasActiveWildcards = getWildcardMods().length > 0;

    for (const clone of modsEl.querySelectorAll(
      `[data-oep-merged-mod="${MERGED_MOD_DT_NC}"], [data-oep-merged-mod="${MERGED_MOD_SD_PF}"]`,
    )) {
      if (!(clone instanceof HTMLElement)) continue;
      const mergeId = clone.getAttribute("data-oep-merged-mod");
      if (mergeId) syncMergedModCloneHighlights(modsEl, clone, mergeId);
    }

    for (const original of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(original instanceof HTMLElement)) continue;
      if (shouldSkipOriginalInModGridSync(modsEl, original)) continue;
      const clone = beatmapModGridOriginalToClone.get(original);
      if (!(clone instanceof HTMLElement)) continue;

      const ac = modButtonAcronym(original);
      const isWildcard = ac && (wildcardModState.get(ac) || 0) > 0;

      if (isWildcard) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        continue;
      }

      if (hasActiveWildcards) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        const origOn = isBeatmapScoreboardModStripButtonOn(original);
        if (origOn) {
          clone.classList.add("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "true");
        } else {
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        clone.classList.remove(MOD_WILDCARD_CLASS);
        clone.removeAttribute(MOD_WILDCARD_ATTR);
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

      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
    }
  }

  /**
   * @param {HTMLElement} modsEl
   */
  function stopBeatmapScoreboardModGridLive(modsEl) {
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

  function teardownBeatmapModGrid(modsEl) {
    if (!(modsEl instanceof HTMLElement)) return;

    clearWildcardState();
    const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
    if (scoreboardRoot instanceof HTMLElement) {
      clearWildcardMergedLeaderboard(scoreboardRoot);
    }

    modsEl.removeAttribute(MOD_GRID_ATTR);
    modsEl.classList.remove(MOD_GRID_CLASS, MOD_GRID_COLLAPSED_CLASS);

    // Unhide original React-managed buttons (kept in place, never moved).
    for (const btn of modsEl.querySelectorAll(
      ":scope > [data-oep-mod-hidden]",
    )) {
      btn.removeAttribute("data-oep-mod-hidden");
    }

    // Remove our grid elements (headers, labels, piles containing clones).
    for (const ch of [...modsEl.children]) {
      if (!ch.classList.contains("beatmap-scoreboard-mod")) {
        ch.remove();
      }
    }
  }

  /** Reset all wildcard state (used on teardown or beatmap change). */
  function clearWildcardState() {
    mergedModCycleStep.clear();
    wildcardModState.clear();
    wildcardSeqCounter = 0;
    window.clearTimeout(wildcardDebounceTimer);
    wildcardDebounceTimer = 0;
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }
  }

  /** @returns {string[]} Acronyms currently in wildcard state. */
  function getWildcardMods() {
    const out = [];
    for (const [ac, seq] of wildcardModState) {
      if (seq > 0) out.push(ac);
    }
    return out;
  }

  /**
   * Mark a mod as wildcard. If this would exceed MAX_WILDCARD_MODS, the oldest
   * wildcard is evicted and its clone visual is reset.
   * @param {string} acronym
   * @param {HTMLElement} modsEl
   */
  function enableWildcard(acronym, modsEl) {
    const current = getWildcardMods().filter((a) => a !== acronym);
    while (current.length >= MAX_WILDCARD_MODS) {
      const oldest = current.sort(
        (a, b) =>
          (wildcardModState.get(a) || 0) - (wildcardModState.get(b) || 0),
      )[0];
      wildcardModState.set(oldest, 0);
      current.splice(current.indexOf(oldest), 1);
      updateCloneWildcardVisual(oldest, modsEl, false);
    }
    wildcardSeqCounter += 1;
    wildcardModState.set(acronym, wildcardSeqCounter);
  }

  /**
   * @param {string} acronym
   * @param {HTMLElement} modsEl
   * @param {boolean} isWildcard
   */
  function updateCloneWildcardVisual(acronym, modsEl, isWildcard) {
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      if (modButtonAcronym(orig) !== acronym) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (isWildcard) {
        clone.classList.add(MOD_WILDCARD_CLASS);
        clone.setAttribute(MOD_WILDCARD_ATTR, "1");
      } else {
        clone.classList.remove(MOD_WILDCARD_CLASS);
        clone.removeAttribute(MOD_WILDCARD_ATTR);
      }
    }
  }

  /** @returns {boolean} */
  function isWildcardFeatureAvailable() {
    return auth.isConfigured() && settings.isEnabled(SCOREBOARD_MOD_GRID_ID);
  }

  /**
   * Given enabled mods and wildcard mods, generate all mod combinations.
   * e.g. enabled=[DT], wildcard=[HD,FL] → [[DT],[DT,HD],[DT,FL],[DT,HD,FL]]
   * @param {string[]} enabledMods
   * @param {string[]} wildcardMods
   * @returns {string[][]}
   */
  function generateModCombinations(enabledMods, wildcardMods) {
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
  function readBeatmapScoreboardLeaderboardType(scoreboardRoot) {
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
  async function fetchAndMergeWildcardLeaderboards(
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
        .getBeatmapScoresWebsite(beatmapId, {
          mode,
          type,
          // Omitting mods[] returns every mod combination; NM is required for nomod.
          mods: mods.length ? mods : ["NM"],
          limit: EXTENDED_LB_LIMIT,
        })
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
   * Replace the scoreboard tbody with API-fetched merged wildcard rows.
   * @param {HTMLElement} scoreboardRoot
   * @param {object[]} scores
   */
  function renderWildcardMergedLeaderboard(scoreboardRoot, scores) {
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    const templateRow = tbody.querySelector(
      "tr.beatmap-scoreboard-table__body-row",
    );
    if (!(templateRow instanceof HTMLTableRowElement)) return;

    const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
    const modTemplateBtn =
      resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
    const beatmapId = getBeatmapPageBeatmapId();
    const mapFullCombo = beatmapId
      ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
      : null;

    const existingExtendedRows = tbody.querySelectorAll(
      `tr[${EXTENDED_SCORE_ROW_ATTR}]`,
    );
    existingExtendedRows.forEach((r) => r.remove());

    const existingWildcardRows = tbody.querySelectorAll(
      `tr[${WILDCARD_MERGED_ROW_ATTR}]`,
    );
    existingWildcardRows.forEach((r) => r.remove());

    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());

    const nativeRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    for (const nr of nativeRows) nr.style.display = "none";

    // Insert wildcard rows before the hidden native rows so nth-child alternation
    // starts at 1 and matches the visual first row.
    const firstNative = nativeRows[0] ?? null;

    // Track which user ids have already appeared so secondary scores can be dimmed.
    const seenUserIds = new Set();

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (!score || typeof score !== "object") continue;
      const row = /** @type {HTMLTableRowElement} */ (
        templateRow.cloneNode(true)
      );
      row.setAttribute(WILDCARD_MERGED_ROW_ATTR, "1");
      row.removeAttribute(RATE_EDIT_ROW_ATTR);
      row.removeAttribute(WILDCARD_DUPE_ROW_ATTR);
      row.style.display = "";
      row.classList.remove(
        "beatmap-scoreboard-table__body-row--friend",
        "beatmap-scoreboard-table__body-row--first",
        "beatmap-scoreboard-table__body-row--self",
      );

      // Strip per-user decorations from the player cell before re-applying score data.
      if (colMap.user != null) {
        const playerTd = row.cells[colMap.user];
        if (playerTd) {
          // Remove team flag link (osu! tournament teams show a flag next to the username).
          for (const teamLink of playerTd.querySelectorAll(
            'a[href*="/teams/"]',
          )) {
            teamLink.remove();
          }
        }
      }

      applyApiScoreToBeatmapScoreRow(
        row,
        score,
        i + 1,
        colMap,
        realTable,
        templateRow,
        modTemplateBtn,
        mapFullCombo,
      );

      // Sync js-usercard data-user-id so hover cards reference the correct user.
      const uid = score.user?.id ?? score.user_id;
      if (colMap.user != null && uid != null) {
        const playerTd = row.cells[colMap.user];
        const card = playerTd?.querySelector(".js-usercard");
        if (card instanceof HTMLElement) {
          card.setAttribute("data-user-id", String(uid));
        }
      }

      // Dim rows that are not this player's highest-ranked entry in the merged list.
      const uidKey = uid != null ? String(uid) : null;
      if (uidKey != null) {
        if (seenUserIds.has(uidKey)) {
          row.setAttribute(WILDCARD_DUPE_ROW_ATTR, "1");
        } else {
          seenUserIds.add(uidKey);
        }
      }

      // Dim rows with a custom rate (anything other than 1.00× or 1.50×).
      if (scoreHasNonstandardRate(score)) {
        row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      }

      tbody.insertBefore(row, firstNative);
    }

    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }

  /**
   * Remove wildcard-merged rows and restore native rows.
   * @param {HTMLElement|null} scoreboardRoot
   */
  function clearWildcardMergedLeaderboard(scoreboardRoot) {
    if (!scoreboardRoot) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    for (const nr of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      /** @type {HTMLElement} */ (nr).style.display = "";
    }
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }

  /**
   * Remove player-lookup rows from the main leaderboard and show osu-web rows again.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   * @param {Element|null|undefined} modsEl
   * @param {boolean} [rescheduleWildcard=true] When true and wildcard mods are active, re-runs the merged fetch (e.g. user clicked Reset).
   */
  function clearUserSearchMergedLeaderboard(
    scoreboardRoot,
    modsEl,
    rescheduleWildcard = true,
  ) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());
    for (const nr of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      /** @type {HTMLElement} */ (nr).style.display = "";
    }
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
    if (!rescheduleWildcard) return;
    const mods =
      modsEl instanceof HTMLElement
        ? modsEl
        : scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (mods instanceof HTMLElement && getWildcardMods().length > 0) {
      scheduleWildcardFetch(mods);
    }
  }

  /**
   * Collect the "enabled" (not wildcard, not disabled) mods from our tracked state.
   * @param {HTMLElement} modsEl
   * @returns {string[]}
   */
  function getWildcardEnabledMods(modsEl) {
    const enabled = [];
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      if (s === 1) enabled.push("DT");
      if (s === 2) enabled.push("NC");
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      if (s === 1) enabled.push("SD");
      if (s === 2) enabled.push("PF");
    }
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (shouldSkipOriginalInModGridSync(modsEl, orig)) continue;
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      const isWildcard = (wildcardModState.get(ac) || 0) > 0;
      if (isWildcard) continue;
      if (
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true"
      ) {
        enabled.push(ac);
      }
    }
    return enabled;
  }

  /**
   * Trigger the wildcard leaderboard fetch-merge-render cycle after debounce.
   * @param {HTMLElement} modsEl
   */
  function scheduleWildcardFetch(modsEl) {
    window.clearTimeout(wildcardDebounceTimer);
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }

    const wildcards = getWildcardMods();
    const scoreboardRoot =
      modsEl.closest(".beatmapset-scoreboard") ||
      document.querySelector(".beatmapset-scoreboard");
    if (!(scoreboardRoot instanceof HTMLElement)) return;

    if (wildcards.length === 0) {
      clearWildcardMergedLeaderboard(scoreboardRoot);
      const tableWrap = scoreboardRoot.querySelector(
        ".beatmap-scoreboard-table",
      );
      if (tableWrap instanceof HTMLElement) {
        tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
      }
      syncActiveModsToOriginals(modsEl);
      return;
    }

    const enabledMods = getWildcardEnabledMods(modsEl);
    const beatmapId = getBeatmapPageBeatmapId();
    const mode = getBeatmapPageRuleset();
    if (!beatmapId) return;

    const combos = generateModCombinations(enabledMods, wildcards);

    const tableWrap = scoreboardRoot.querySelector(".beatmap-scoreboard-table");
    if (tableWrap instanceof HTMLElement) {
      tableWrap.classList.add(WILDCARD_LOADING_CLASS);
    }

    wildcardAbortCtrl = new AbortController();
    const signal = wildcardAbortCtrl.signal;

    wildcardDebounceTimer = window.setTimeout(() => {
      wildcardDebounceTimer = 0;
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
          if (signal.aborted) return;
          if (tableWrap instanceof HTMLElement) {
            tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
          }
          if (merged.length > 0) {
            renderWildcardMergedLeaderboard(scoreboardRoot, merged);
          }
        })
        .catch(() => {
          if (tableWrap instanceof HTMLElement) {
            tableWrap.classList.remove(WILDCARD_LOADING_CLASS);
          }
        });
    }, 1000);
  }

  /**
   * When leaving wildcard mode (all wildcards removed), click originals
   * to sync their enabled state with what the clones show.
   * @param {HTMLElement} modsEl
   */
  function syncActiveModsToOriginals(modsEl) {
    const cloneEnabled = buildBeatmapModGridCloneEnabledSet(modsEl);

    let clickQueue = [];
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      const origOn = isBeatmapScoreboardModStripButtonOn(orig);
      const shouldBeOn = cloneEnabled.has(ac);
      if (origOn !== shouldBeOn) clickQueue.push(orig);
    }

    let step = 0;
    const maxSteps = 40;
    const run = () => {
      if (++step > maxSteps || !clickQueue.length) {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
        return;
      }
      const btn = clickQueue.shift();
      btn.click();
      window.requestAnimationFrame(run);
    };
    if (clickQueue.length) window.requestAnimationFrame(run);
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {string} acronym
   * @returns {HTMLElement|null}
   */
  function findHiddenBeatmapModButton(modsEl, acronym) {
    const want = String(acronym || "")
      .trim()
      .toUpperCase();
    if (!want) return null;
    for (const btn of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(btn instanceof HTMLElement)) continue;
      if (modButtonAcronym(btn) === want) return btn;
    }
    return null;
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {boolean}
   */
  function beatmapModGridHasMergedDtNc(modsEl) {
    return Boolean(
      modsEl.querySelector(`[data-oep-merged-mod="${MERGED_MOD_DT_NC}"]`),
    );
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {boolean}
   */
  function beatmapModGridHasMergedSdPf(modsEl) {
    return Boolean(
      modsEl.querySelector(`[data-oep-merged-mod="${MERGED_MOD_SD_PF}"]`),
    );
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {HTMLElement} original
   * @returns {boolean}
   */
  function shouldSkipOriginalInModGridSync(modsEl, original) {
    const ac = modButtonAcronym(original);
    if (beatmapModGridHasMergedDtNc(modsEl) && (ac === "DT" || ac === "NC")) {
      return true;
    }
    if (beatmapModGridHasMergedSdPf(modsEl) && (ac === "SD" || ac === "PF")) {
      return true;
    }
    return false;
  }

  /**
   * @param {HTMLElement} modsEl
   * @returns {Set<string>}
   */
  function buildBeatmapModGridCloneEnabledSet(modsEl) {
    const set = new Set();
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      if (s === 1) set.add("DT");
      if (s === 2) set.add("NC");
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const s = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      if (s === 1) set.add("SD");
      if (s === 2) set.add("PF");
    }
    for (const orig of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(orig instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (beatmapModGridHasMergedDtNc(modsEl) && (ac === "DT" || ac === "NC")) {
        continue;
      }
      if (beatmapModGridHasMergedSdPf(modsEl) && (ac === "SD" || ac === "PF")) {
        continue;
      }
      const clone = beatmapModGridOriginalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true"
      ) {
        set.add(ac);
      }
    }
    return set;
  }

  function reconcileMergedModCycleFromDom(modsEl) {
    if (beatmapModGridHasMergedDtNc(modsEl)) {
      const dt = findHiddenBeatmapModButton(modsEl, "DT");
      const nc = findHiddenBeatmapModButton(modsEl, "NC");
      if (dt instanceof HTMLElement && nc instanceof HTMLElement) {
        let step = 0;
        if ((wildcardModState.get("DT") || 0) > 0) step = 3;
        else if (isBeatmapScoreboardModStripButtonOn(nc)) step = 2;
        else if (isBeatmapScoreboardModStripButtonOn(dt)) step = 1;
        mergedModCycleStep.set(MERGED_MOD_DT_NC, step);
      }
    }
    if (beatmapModGridHasMergedSdPf(modsEl)) {
      const sd = findHiddenBeatmapModButton(modsEl, "SD");
      const pf = findHiddenBeatmapModButton(modsEl, "PF");
      if (sd instanceof HTMLElement && pf instanceof HTMLElement) {
        let step = 0;
        if ((wildcardModState.get("PF") || 0) > 0) step = 4;
        else if ((wildcardModState.get("SD") || 0) > 0) step = 3;
        else if (isBeatmapScoreboardModStripButtonOn(pf)) step = 2;
        else if (isBeatmapScoreboardModStripButtonOn(sd)) step = 1;
        mergedModCycleStep.set(MERGED_MOD_SD_PF, step);
      }
    }
  }

  function mergedModGridEffectiveStepCount(mergeId) {
    if (isWildcardFeatureAvailable()) {
      return mergeId === MERGED_MOD_DT_NC ? 4 : 5;
    }
    return mergeId === MERGED_MOD_DT_NC ? 3 : 3;
  }

  function finishMergedModStepApply(modsEl, mergeId, step) {
    mergedModCycleStep.set(mergeId, step);
    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
    scheduleWildcardFetch(modsEl);
  }

  function applyDtNcTargetStep(modsEl, targetStep) {
    const dt = findHiddenBeatmapModButton(modsEl, "DT");
    const nc = findHiddenBeatmapModButton(modsEl, "NC");
    if (!(dt instanceof HTMLElement) || !(nc instanceof HTMLElement)) return;
    let frames = 0;
    const tick = () => {
      if (++frames > 56) {
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, targetStep);
        return;
      }
      const dtOn = isBeatmapScoreboardModStripButtonOn(dt);
      const ncOn = isBeatmapScoreboardModStripButtonOn(nc);
      const wDt = (wildcardModState.get("DT") || 0) > 0;

      if (targetStep === 3) {
        if (wDt) {
          if (dtOn) {
            dt.click();
            requestAnimationFrame(tick);
            return;
          }
          if (ncOn) {
            nc.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
          return;
        }
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
          return;
        }
        enableWildcard("DT", modsEl);
        updateCloneWildcardVisual("DT", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 3);
        return;
      }

      if (wDt) {
        wildcardModState.set("DT", 0);
        updateCloneWildcardVisual("DT", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }

      if (targetStep === 0) {
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 0);
        return;
      }
      if (targetStep === 1) {
        if (ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 1);
        return;
      }
      if (targetStep === 2) {
        if (dtOn) {
          dt.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!ncOn) {
          nc.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_DT_NC, 2);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function applySdPfTargetStep(modsEl, targetStep) {
    const sd = findHiddenBeatmapModButton(modsEl, "SD");
    const pf = findHiddenBeatmapModButton(modsEl, "PF");
    if (!(sd instanceof HTMLElement) || !(pf instanceof HTMLElement)) return;
    let frames = 0;
    const tick = () => {
      if (++frames > 64) {
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, targetStep);
        return;
      }
      const sdOn = isBeatmapScoreboardModStripButtonOn(sd);
      const pfOn = isBeatmapScoreboardModStripButtonOn(pf);
      const wSd = (wildcardModState.get("SD") || 0) > 0;
      const wPf = (wildcardModState.get("PF") || 0) > 0;

      if (targetStep === 4) {
        if (wPf) {
          if (sdOn) {
            sd.click();
            requestAnimationFrame(tick);
            return;
          }
          if (pfOn) {
            pf.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
          return;
        }
        if (wSd) {
          wildcardModState.set("SD", 0);
          updateCloneWildcardVisual("SD", modsEl, false);
          requestAnimationFrame(tick);
          return;
        }
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
          return;
        }
        enableWildcard("PF", modsEl);
        updateCloneWildcardVisual("PF", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 4);
        return;
      }

      if (targetStep === 3) {
        if (wSd) {
          if (sdOn) {
            sd.click();
            requestAnimationFrame(tick);
            return;
          }
          if (pfOn) {
            pf.click();
            requestAnimationFrame(tick);
            return;
          }
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
          return;
        }
        if (wPf) {
          wildcardModState.set("PF", 0);
          updateCloneWildcardVisual("PF", modsEl, false);
          requestAnimationFrame(tick);
          return;
        }
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!isWildcardFeatureAvailable()) {
          finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
          return;
        }
        enableWildcard("SD", modsEl);
        updateCloneWildcardVisual("SD", modsEl, true);
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 3);
        return;
      }

      if (wPf) {
        wildcardModState.set("PF", 0);
        updateCloneWildcardVisual("PF", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }
      if (wSd) {
        wildcardModState.set("SD", 0);
        updateCloneWildcardVisual("SD", modsEl, false);
        requestAnimationFrame(tick);
        return;
      }

      if (targetStep === 0) {
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 0);
        return;
      }
      if (targetStep === 1) {
        if (pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 1);
        return;
      }
      if (targetStep === 2) {
        if (sdOn) {
          sd.click();
          requestAnimationFrame(tick);
          return;
        }
        if (!pfOn) {
          pf.click();
          requestAnimationFrame(tick);
          return;
        }
        finishMergedModStepApply(modsEl, MERGED_MOD_SD_PF, 2);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function applyMergedModTargetStep(modsEl, mergeId, targetStep) {
    if (mergeId === MERGED_MOD_DT_NC) {
      applyDtNcTargetStep(modsEl, targetStep);
    } else if (mergeId === MERGED_MOD_SD_PF) {
      applySdPfTargetStep(modsEl, targetStep);
    }
  }

  /**
   * @param {HTMLElement} modsEl
   * @param {HTMLElement} clone
   * @param {string} mergeId
   */
  function syncMergedModCloneHighlights(modsEl, clone, mergeId) {
    if (!(clone instanceof HTMLElement)) return;
    const hasActiveWildcards = getWildcardMods().length > 0;
    const dt = findHiddenBeatmapModButton(modsEl, "DT");
    const nc = findHiddenBeatmapModButton(modsEl, "NC");
    const sd = findHiddenBeatmapModButton(modsEl, "SD");
    const pf = findHiddenBeatmapModButton(modsEl, "PF");

    if (mergeId === MERGED_MOD_DT_NC) {
      if (!(dt instanceof HTMLElement) || !(nc instanceof HTMLElement)) return;
      const step = mergedModCycleStep.get(MERGED_MOD_DT_NC) ?? 0;
      const wDt = (wildcardModState.get("DT") || 0) > 0;
      if (step === 3 || wDt) {
        replaceBeatmapModGridCloneInnerHTML(clone, dt);
        clone.disabled = dt.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
      if (hasActiveWildcards) {
        if (step === 2) {
          replaceBeatmapModGridCloneInnerHTML(clone, nc);
          clone.disabled = nc.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(nc);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else if (step === 1) {
          replaceBeatmapModGridCloneInnerHTML(clone, dt);
          clone.disabled = dt.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(dt);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else {
          replaceBeatmapModGridCloneInnerHTML(clone, dt);
          clone.disabled = dt.disabled;
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        return;
      }
      if (step === 2) {
        replaceBeatmapModGridCloneInnerHTML(clone, nc);
        clone.disabled = nc.disabled;
        if (clone.className !== nc.className) clone.className = nc.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = nc.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      } else {
        replaceBeatmapModGridCloneInnerHTML(clone, dt);
        clone.disabled = dt.disabled;
        if (clone.className !== dt.className) clone.className = dt.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = dt.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      }
      return;
    }

    if (mergeId === MERGED_MOD_SD_PF) {
      if (!(sd instanceof HTMLElement) || !(pf instanceof HTMLElement)) return;
      const step = mergedModCycleStep.get(MERGED_MOD_SD_PF) ?? 0;
      const wSd = (wildcardModState.get("SD") || 0) > 0;
      const wPf = (wildcardModState.get("PF") || 0) > 0;
      if (step === 4 || wPf) {
        replaceBeatmapModGridCloneInnerHTML(clone, pf);
        clone.disabled = pf.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      if (step === 3 || wSd) {
        replaceBeatmapModGridCloneInnerHTML(clone, sd);
        clone.disabled = sd.disabled;
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
          clone.classList.add(MOD_WILDCARD_CLASS);
          clone.setAttribute(MOD_WILDCARD_ATTR, "1");
        }
        return;
      }
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
      if (hasActiveWildcards) {
        if (step === 2) {
          replaceBeatmapModGridCloneInnerHTML(clone, pf);
          clone.disabled = pf.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(pf);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else if (step === 1) {
          replaceBeatmapModGridCloneInnerHTML(clone, sd);
          clone.disabled = sd.disabled;
          const on = isBeatmapScoreboardModStripButtonOn(sd);
          if (on) {
            clone.classList.add("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "true");
          } else {
            clone.classList.remove("beatmap-scoreboard-mod--enabled");
            clone.setAttribute("aria-pressed", "false");
          }
        } else {
          replaceBeatmapModGridCloneInnerHTML(clone, sd);
          clone.disabled = sd.disabled;
          clone.classList.remove("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "false");
        }
        return;
      }
      if (step === 2) {
        replaceBeatmapModGridCloneInnerHTML(clone, pf);
        clone.disabled = pf.disabled;
        if (clone.className !== pf.className) clone.className = pf.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = pf.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
      } else {
        replaceBeatmapModGridCloneInnerHTML(clone, sd);
        clone.disabled = sd.disabled;
        if (clone.className !== sd.className) clone.className = sd.className;
        for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
          const v = sd.getAttribute(attr);
          if (v == null) clone.removeAttribute(attr);
          else clone.setAttribute(attr, v);
        }
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
    beatmapModGridOriginalToClone.set(btn, clone);
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
      const isCurrentlyWildcard = (wildcardModState.get(ac) || 0) > 0;
      const cloneIsEnabled =
        clone.classList.contains("beatmap-scoreboard-mod--enabled") ||
        clone.getAttribute("aria-pressed") === "true";

      if (isCurrentlyWildcard) {
        wildcardModState.set(ac, 0);
        updateCloneWildcardVisual(ac, modsEl, false);
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        scheduleWildcardFetch(modsEl);
      } else if (cloneIsEnabled) {
        if (!hasWildcards) {
          btn.click();
        }
        enableWildcard(ac, modsEl);
        updateCloneWildcardVisual(ac, modsEl, true);
        clone.classList.remove("beatmap-scoreboard-mod--enabled");
        clone.setAttribute("aria-pressed", "false");
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
        scheduleWildcardFetch(modsEl);
      } else {
        if (hasWildcards) {
          clone.classList.add("beatmap-scoreboard-mod--enabled");
          clone.setAttribute("aria-pressed", "true");
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
    btn.setAttribute("data-oep-mod-hidden", "1");
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
    clone.setAttribute("data-oep-merged-mod", mergeId);
    beatmapModGridOriginalToClone.set(primaryOriginal, clone);
    beatmapModGridOriginalToClone.set(secondaryOriginal, clone);
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const max = mergedModGridEffectiveStepCount(mergeId);
      const cur = mergedModCycleStep.get(mergeId) ?? 0;
      const next = (cur + 1) % max;
      applyMergedModTargetStep(modsEl, mergeId, next);
    });
    piles[pileKey]?.appendChild(clone);
    primaryOriginal.setAttribute("data-oep-mod-hidden", "1");
    secondaryOriginal.setAttribute("data-oep-mod-hidden", "1");
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
  function applyBeatmapModGrid(modsEl, elFn) {
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
      elFn(
        "span",
        { class: `${MOD_GRID_CLASS}__collapse-label` },
        "Mod filters",
      ),
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
      collapseToggle.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true",
      );
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

    if (auth.isConfigured()) {
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
  async function setupBeatmapScoreboardModGrid() {
    if (!settings.isEnabled(SCOREBOARD_MOD_GRID_ID)) {
      return () => {};
    }
    ensureModGridStyles();

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
              ":scope > .beatmap-scoreboard-mod:not([data-oep-mod-hidden])",
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
        const hidden = modsEl.querySelectorAll(
          ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
        );
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
      if (!auth.isConfigured() && modsEl) {
        clearWildcardState();
        const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
        if (scoreboardRoot instanceof HTMLElement) {
          clearWildcardMergedLeaderboard(scoreboardRoot);
        }
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
      }
    };
    window.addEventListener("oep-osu-api-credentials-changed", onCredsChange);

    return () => {
      window.removeEventListener(
        "oep-osu-api-credentials-changed",
        onCredsChange,
      );
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

  function findBeatmapScoreboardRoot() {
    const mods = document.querySelector(".beatmapset-scoreboard__mods");
    if (mods instanceof HTMLElement) {
      const byClass = mods.closest(".beatmapset-scoreboard");
      if (byClass instanceof HTMLElement) return byClass;
      let el = mods;
      for (let d = 0; el && d < 16; d++, el = el.parentElement) {
        if (
          el.querySelector?.(".play-detail-list") ||
          el.querySelector?.(".beatmap-scoreboard-table")
        ) {
          return el;
        }
      }
    }
    const board = document.querySelector(".beatmapset-scoreboard");
    return board instanceof HTMLElement ? board : null;
  }

  /**
   * Turn scoreboard cell `<a>` wrappers into `<span>` so the row is not navigable,
   * except `a.beatmap-scoreboard-table__user-link` (profile URL).
   * @param {HTMLTableRowElement} tr
   */
  function demoteBeatmapUserSearchResultRowLinks(tr) {
    if (!(tr instanceof HTMLTableRowElement)) return;
    for (const a of tr.querySelectorAll("a")) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      if (a.classList.contains("beatmap-scoreboard-table__user-link")) continue;
      const href = a.getAttribute("href") || "";
      if (
        /\/rankings\/[^/]+\/performance\?country=/i.test(href) &&
        a.classList.contains("beatmap-scoreboard-table__cell-content")
      ) {
        continue;
      }
      if (/\/teams\/[^/?#]+/i.test(href) && a.querySelector(".flag-team")) {
        continue;
      }
      const span = document.createElement("span");
      span.className = a.className;
      for (const attr of [...a.attributes]) {
        const n = attr.name;
        if (n === "href" || n === "target" || n === "download" || n === "rel") {
          continue;
        }
        span.setAttribute(n, attr.value);
      }
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    }
  }

  /**
   * Moves the tools row to the canonical spot (after mods when present, else
   * the same fallbacks as legacy single-widget placement).
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} row
   */
  function placeBeatmapScoreboardToolsRow(scoreboardRoot, row) {
    const modsEl = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (modsEl) {
      if (row.previousElementSibling !== modsEl) {
        modsEl.after(row);
      }
      return;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    if (tableWrap?.parentElement instanceof HTMLElement) {
      const parent = tableWrap.parentElement;
      if (row.parentElement !== parent || row.nextElementSibling !== tableWrap) {
        parent.insertBefore(row, tableWrap);
      }
      return;
    }
    if (main) {
      if (row.parentElement !== main || row !== main.firstElementChild) {
        main.insertBefore(row, main.firstChild);
      }
      return;
    }
    if (row.parentElement !== scoreboardRoot || row !== scoreboardRoot.firstElementChild) {
      scoreboardRoot.insertBefore(row, scoreboardRoot.firstChild);
    }
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @returns {HTMLElement}
   */
  function ensureBeatmapScoreboardToolsRow(scoreboardRoot) {
    let row = scoreboardRoot.querySelector(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`);
    if (!(row instanceof HTMLElement)) {
      row = /** @type {HTMLElement} */ (
        el("div", {
          class: "oep-scoreboard-tools-row",
          [SCOREBOARD_TOOLS_ROW_ATTR]: "1",
        })
      );
      placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
    } else {
      placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
    }
    return row;
  }

  /**
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function removeEmptyBeatmapScoreboardToolsRows(scoreboardRoot) {
    const roots =
      scoreboardRoot instanceof HTMLElement
        ? [scoreboardRoot]
        : [...document.querySelectorAll(".beatmapset-scoreboard")];
    for (const root of roots) {
      root.querySelectorAll(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`).forEach((n) => {
        if (n instanceof HTMLElement && n.childElementCount === 0) {
          n.remove();
        }
      });
    }
  }

  /**
   * Player lookup and rate filter share a flex row under `.beatmapset-scoreboard__mods`.
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   */
  function insertBeatmapScoreUserSearchBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    const rate = toolsRow.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (wrap.parentElement !== toolsRow) {
      if (rate) toolsRow.insertBefore(wrap, rate);
      else toolsRow.appendChild(wrap);
    } else if (rate instanceof HTMLElement && rate.previousElementSibling !== wrap) {
      toolsRow.insertBefore(wrap, rate);
    }
  }

  /**
   * Sits in the tools row (sibling of React mod root, not inside it).
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   */
  function insertBeatmapRateEditFilterBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    if (wrap.parentElement !== toolsRow) {
      toolsRow.appendChild(wrap);
    } else {
      toolsRow.appendChild(wrap);
    }
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, row) {
    if (!scoreboardRoot.contains(row)) return false;
    const modsEl = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (modsEl) {
      return row.previousElementSibling === modsEl;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    const parent = tableWrap?.parentElement;
    if (parent instanceof HTMLElement && row.parentElement === parent) {
      return row.nextElementSibling === tableWrap;
    }
    if (main instanceof HTMLElement && row.parentElement === main) {
      return row === main.firstElementChild;
    }
    return (
      row.parentElement === scoreboardRoot && row === scoreboardRoot.firstElementChild
    );
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isPlayerLookupSearchBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (
      !(toolsRow instanceof HTMLElement) ||
      !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)
    ) {
      return false;
    }
    return isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow);
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   * @returns {boolean}
   */
  function isRateEditFilterBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (
      !(toolsRow instanceof HTMLElement) ||
      !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)
    ) {
      return false;
    }
    if (!isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow)) {
      return false;
    }
    const searchWrap = toolsRow.querySelector(`[${SCOREBOARD_USER_SEARCH_ATTR}]`);
    if (!(searchWrap instanceof HTMLElement)) return true;
    return wrap.previousElementSibling === searchWrap;
  }

  /**
   * Global rank for a score row when the API includes it; otherwise unknown.
   * @param {object} score
   * @returns {number|null}
   */
  function beatmapUserSearchGlobalRank(score) {
    const r = Number(score?.rank_global);
    if (Number.isFinite(r) && r > 0) return r;
    return null;
  }

  /**
   * Paint player-lookup scores into the same main leaderboard tbody as osu-web (and wildcard),
   * hiding native rows so there is only one table.
   * @param {HTMLElement} scoreboardRoot
   * @param {object[]} scores
   * @param {object|null|undefined} userTeam
   * @returns {boolean}
   */
  function renderUserSearchMergedLeaderboard(scoreboardRoot, scores, userTeam) {
    if (!Array.isArray(scores) || scores.length === 0) return false;

    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return false;

    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return false;

    const templateRow = tbody.querySelector(
      "tr.beatmap-scoreboard-table__body-row",
    );
    if (!(templateRow instanceof HTMLTableRowElement)) return false;

    const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
    const modTemplateBtn =
      resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
    const beatmapId = getBeatmapPageBeatmapId();
    const mapFullCombo = beatmapId
      ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
      : null;

    window.clearTimeout(wildcardDebounceTimer);
    wildcardDebounceTimer = 0;
    if (wildcardAbortCtrl) {
      wildcardAbortCtrl.abort();
      wildcardAbortCtrl = null;
    }
    const tableWrapClear = scoreboardRoot.querySelector(
      ".beatmap-scoreboard-table",
    );
    if (tableWrapClear instanceof HTMLElement) {
      tableWrapClear.classList.remove(WILDCARD_LOADING_CLASS);
    }

    tbody
      .querySelectorAll(`tr[${EXTENDED_SCORE_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
      .forEach((r) => r.remove());
    tbody
      .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
      .forEach((r) => r.remove());

    const nativeRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    for (const nr of nativeRows) nr.style.display = "none";
    const firstNative = nativeRows[0] ?? null;

    let inserted = 0;
    for (const score of scores) {
      if (!score || typeof score !== "object") continue;
      const resultRow = /** @type {HTMLTableRowElement} */ (
        templateRow.cloneNode(true)
      );
      resultRow.setAttribute(SCORE_USER_SEARCH_RESULT_ATTR, "1");
      resultRow.removeAttribute(RATE_EDIT_ROW_ATTR);
      resultRow.style.display = "";
      resultRow.classList.remove(
        "beatmap-scoreboard-table__body-row--friend",
        "beatmap-scoreboard-table__body-row--first",
        "beatmap-scoreboard-table__body-row--self",
      );

      if (colMap.user != null) {
        const playerTd = resultRow.cells[colMap.user];
        if (playerTd) {
          for (const teamLink of playerTd.querySelectorAll(
            'a[href*="/teams/"]',
          )) {
            teamLink.remove();
          }
          if (userTeam?.id && userTeam.flag_url) {
            const teamA = document.createElement("a");
            teamA.className = "u-contents u-hover";
            teamA.href = `https://osu.ppy.sh/teams/${userTeam.id}`;
            const teamSpan = document.createElement("span");
            teamSpan.className = "flag-team";
            teamSpan.style.backgroundImage = `url("${userTeam.flag_url}")`;
            teamSpan.title = userTeam.name ?? "";
            teamA.appendChild(teamSpan);
            const userLink = playerTd.querySelector(
              "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
            );
            if (userLink) {
              userLink.insertAdjacentElement("beforebegin", teamA);
            } else {
              playerTd.prepend(teamA);
            }
          }
        }
      }

      const position = beatmapUserSearchGlobalRank(score);
      applyApiScoreToBeatmapScoreRow(
        resultRow,
        score,
        position ?? 0,
        colMap,
        realTable,
        templateRow,
        modTemplateBtn,
        mapFullCombo,
      );
      demoteBeatmapUserSearchResultRowLinks(resultRow);
      resultRow.removeAttribute(EXTENDED_SCORE_ROW_ATTR);

      if (colMap.user != null) {
        const uid = score.user?.id ?? score.user_id;
        const playerTd = resultRow.cells[colMap.user];
        const card = playerTd?.querySelector(".js-usercard");
        if (card instanceof HTMLElement && uid != null) {
          card.setAttribute("data-user-id", String(uid));
        }
      }

      if (scoreHasNonstandardRate(score)) {
        resultRow.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      }

      if (position == null && colMap.rank != null) {
        const rankTd = [...resultRow.cells][colMap.rank];
        if (rankTd) {
          const shell = rankTd.querySelector(
            ".beatmap-scoreboard-table__cell-content",
          );
          if (shell) shell.textContent = "?";
          else rankTd.textContent = "?";
        }
      }

      tbody.insertBefore(resultRow, firstNative);
      inserted += 1;
    }

    if (!inserted) return false;

    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
    return true;
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
  function startBeatmapScoreUserSearchManager(pathRe) {
    const MARKER_ATTR = SCOREBOARD_USER_SEARCH_ATTR;
    const NO_API_STATUS =
      "Add osu! API OAuth credentials in Expert+ settings to search players.";
    let debounceTimer = 0;

    const cleanup = () => {
      document.querySelectorAll(".beatmapset-scoreboard").forEach((el) => {
        if (el instanceof HTMLElement) {
          clearUserSearchMergedLeaderboard(
            el,
            el.querySelector(".beatmapset-scoreboard__mods"),
            false,
          );
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
      const resultEl = wrap.querySelector(".oep-user-search__result");
      const configured = auth.isConfigured();
      wrap.classList.toggle("oep-user-search--no-api", !configured);
      if (input instanceof HTMLInputElement) {
        input.disabled = !configured;
      }
      if (goBtn instanceof HTMLButtonElement) {
        goBtn.disabled = !configured;
      }
      if (!configured) {
        if (resetBtn instanceof HTMLElement) resetBtn.hidden = true;
        if (resultEl) resultEl.replaceChildren();
        if (input instanceof HTMLInputElement) input.value = "";
        if (statusEl) statusEl.textContent = NO_API_STATUS;
        const boardRoot = findBeatmapScoreboardRoot();
        const mods = boardRoot?.querySelector(".beatmapset-scoreboard__mods");
        clearUserSearchMergedLeaderboard(boardRoot, mods, false);
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

      const resultEl = el("div", { class: "oep-user-search__result" });

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
        resultEl,
      );

      const doReset = () => {
        const boardRoot = findBeatmapScoreboardRoot();
        const mods = boardRoot?.querySelector(".beatmapset-scoreboard__mods");
        clearUserSearchMergedLeaderboard(boardRoot, mods);
        resultEl.replaceChildren();
        searchInput.value = "";
        statusEl.textContent = "";
        resetBtn.hidden = true;
        searchInput.focus();
      };

      const doSearch = async () => {
        const username =
          searchInput.value.trim() || getLoggedInUsernameFromNav() || "";
        if (!username) return;

        if (!auth.isConfigured()) {
          statusEl.textContent =
            "API credentials required. Configure them in the settings (Client ID + Secret).";
          resetBtn.hidden = false;
          return;
        }

        const beatmapId = getBeatmapPageBeatmapId();
        if (!beatmapId) return;

        searchBtn.disabled = true;
        resultEl.replaceChildren();
        statusEl.textContent = "Searching…";

        try {
          const user = await OsuExpertPlus.api.getUser(username);
          if (!user?.id) throw new Error("user not found");

          const ruleset = getBeatmapPageRuleset();
          const scoreboardRoot = findBeatmapScoreboardRoot();
          const data = await OsuExpertPlus.api.getBeatmapUserScoresAll(
            beatmapId,
            user.id,
            { ruleset, legacy_only: 0 },
          );
          const rawList = Array.isArray(data?.scores) ? data.scores : [];
          if (!rawList.length) throw new Error("no score");

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

          resultEl.replaceChildren();
          const ok =
            scoreboardRoot instanceof HTMLElement &&
            renderUserSearchMergedLeaderboard(
              scoreboardRoot,
              scores,
              user.team,
            );
          if (ok) {
            statusEl.textContent = "";
          } else {
            statusEl.textContent =
              "Scores found but leaderboard is not ready yet.";
          }
          resetBtn.hidden = false;
        } catch (_) {
          statusEl.textContent = "No score found on this difficulty.";
          resetBtn.hidden = false;
        } finally {
          searchBtn.disabled = false;
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
      if (!settings.isEnabled(SCOREBOARD_PLAYER_LOOKUP_ID)) {
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

    const OSU_API_CREDS_CHANGE = "oep-osu-api-credentials-changed";
    const onOsuApiCredsChange = () => schedule();
    window.addEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);

    const unsubLookup = settings.onChange(SCOREBOARD_PLAYER_LOOKUP_ID, () =>
      schedule(),
    );

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    schedule();

    return () => {
      unsubLookup();
      window.removeEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  /**
   * Checkbox under mod filters (sibling of React’s mods root) + setting
   * `beatmapDetail.scoreboardHideCustomRateScores` to hide custom-rate rows.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardHideRateEditFilterBar(pathRe) {
    let debounceTimer = 0;

    const cleanup = () => {
      document
        .querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`)
        .forEach((n) => n.remove());
      removeEmptyBeatmapScoreboardToolsRows();
    };

    const syncCheckbox = (wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const cb = wrap.querySelector('input[type="checkbox"]');
      if (!(cb instanceof HTMLInputElement)) return;
      const on = settings.isEnabled(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID);
      if (cb.checked !== on) cb.checked = on;
    };

    const ensureBar = (root) => {
      const modsEl = root.querySelector(".beatmapset-scoreboard__mods");
      if (!modsEl) return;

      let existing = root.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
      if (!(existing instanceof HTMLElement)) {
        const cb = /** @type {HTMLInputElement} */ (
          el("input", { type: "checkbox" })
        );
        const label = el("label", {}, cb, " Hide custom rate scores");
        existing = /** @type {HTMLElement} */ (
          el(
            "div",
            {
              class: "oep-rate-edit-filter",
              [RATE_EDIT_FILTER_BAR_ATTR]: "1",
            },
            label,
          )
        );
        cb.addEventListener("change", () => {
          settings.set(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID, cb.checked);
        });
        insertBeatmapRateEditFilterBar(root, existing);
      } else if (!isRateEditFilterBarPlacedCorrectly(root, existing)) {
        insertBeatmapRateEditFilterBar(root, existing);
      }
      syncCheckbox(existing);
      syncBeatmapRateEditFilterBarVisibility(root);
    };

    const run = () => {
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      ensureBar(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };

    const unsub = settings.onChange(
      SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID,
      (on) => {
        document
          .querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`)
          .forEach((w) => {
            if (!(w instanceof HTMLElement)) return;
            const cb = w.querySelector('input[type="checkbox"]');
            if (cb instanceof HTMLInputElement && cb.checked !== on) {
              cb.checked = on;
            }
          });
        const board = findBeatmapScoreboardRoot();
        if (board instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(board);
        }
      },
    );

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    schedule();

    return () => {
      unsub();
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  /**
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapDiscussionPreviewManager(pathRe) {
    const TOGGLE_ATTR = "data-oep-discussion-preview-toggle";
    const PREVIEW_ATTR = "data-oep-discussion-preview";
    const MARKER_ATTR = "data-oep-discussion-preview-bound";
    const ROOT_MARKER_ATTR = "data-oep-discussion-preview-root-bound";
    const HELPER_ATTR = "data-oep-markdown-helper";
    let previewEnabled = false;

    const isSupportedDiscussionPath = () =>
      pathRe.test(location.pathname) &&
      /^\/beatmapsets\/\d+\/discussion\//i.test(location.pathname) &&
      !/^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i.test(
        location.pathname,
      );

    /**
     * @param {string} text
     * @returns {string}
     */
    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    /**
     * @param {string} raw
     * @returns {string|null}
     */
    function sanitizeHttpUrl(raw) {
      if (!raw) return null;
      const candidate = String(raw).trim();
      if (!candidate) return null;
      try {
        const parsed = new URL(candidate, location.origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          return null;
        return parsed.href;
      } catch (_) {
        return null;
      }
    }

    /**
     * Lightweight markdown-ish renderer (good enough for previewing common syntax).
     * @param {string} src
     * @returns {string}
     */
    function renderMarkdownPreviewHtml(src) {
      const raw = String(src ?? "");
      if (!raw.trim()) {
        return `<p class="oep-discussion-preview__empty">Nothing to preview yet.</p>`;
      }
      const lines = raw.replace(/\r\n?/g, "\n").split("\n");
      const out = [];
      let inCode = false;
      let inUl = false;
      let inOl = false;
      let inQuote = false;

      const closeLists = () => {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
      };
      const closeQuote = () => {
        if (inQuote) {
          out.push("</blockquote>");
          inQuote = false;
        }
      };
      const inline = (line) => {
        let s = escapeHtml(line);
        s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, altRaw, srcRaw) => {
          const src = sanitizeHttpUrl(srcRaw);
          if (!src) return escapeHtml(`![${altRaw}](${srcRaw})`);
          const alt = escapeHtml(altRaw || "");
          return `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" />`;
        });
        s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
        s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
        s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
        s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
        s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
        s = s.replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );
        return s;
      };

      for (const lineRaw of lines) {
        const line = lineRaw ?? "";
        if (/^```/.test(line.trim())) {
          closeLists();
          closeQuote();
          if (!inCode) {
            out.push("<pre><code>");
            inCode = true;
          } else {
            out.push("</code></pre>");
            inCode = false;
          }
          continue;
        }
        if (inCode) {
          out.push(`${escapeHtml(line)}\n`);
          continue;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          closeLists();
          closeQuote();
          continue;
        }

        const quoteMatch = line.match(/^\s*>\s?(.*)$/);
        if (quoteMatch) {
          closeLists();
          if (!inQuote) {
            out.push("<blockquote>");
            inQuote = true;
          }
          out.push(`<p>${inline(quoteMatch[1])}</p>`);
          continue;
        } else {
          closeQuote();
        }

        const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (ulMatch) {
          if (!inUl) {
            if (inOl) {
              out.push("</ol>");
              inOl = false;
            }
            out.push("<ul>");
            inUl = true;
          }
          out.push(`<li>${inline(ulMatch[1])}</li>`);
          continue;
        }

        const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (olMatch) {
          if (!inOl) {
            if (inUl) {
              out.push("</ul>");
              inUl = false;
            }
            out.push("<ol>");
            inOl = true;
          }
          out.push(`<li>${inline(olMatch[2])}</li>`);
          continue;
        }

        closeLists();
        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
          continue;
        }
        out.push(`<p>${inline(line)}</p>`);
      }

      if (inCode) out.push("</code></pre>");
      closeLists();
      closeQuote();
      return out.join("");
    }

    /**
     * @returns {HTMLTextAreaElement[]}
     */
    function collectCandidateTextareas() {
      const nodes = Array.from(
        document.querySelectorAll(
          '[data-react="beatmap-discussions"] textarea, .beatmap-discussion textarea',
        ),
      );
      return nodes.filter((node) => {
        if (!(node instanceof HTMLTextAreaElement)) return false;
        if (!node.isConnected) return false;
        if (node.hasAttribute(MARKER_ATTR)) return false;
        if (
          !node.closest(
            '[data-react="beatmap-discussions"], .beatmap-discussion',
          )
        ) {
          return false;
        }
        return true;
      });
    }

    /**
     * @param {HTMLElement} composerRoot
     * @param {HTMLElement} toggleBtn
     */
    function placePreviewToggleButton(composerRoot, toggleBtn, textarea) {
      const moveAsFirstChild = (parent, child) => {
        if (!(parent instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        if (
          child.parentElement === parent &&
          parent.firstElementChild === child
        )
          return;
        parent.prepend(child);
      };
      const moveBefore = (anchor, child) => {
        if (!(anchor instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        const parent = anchor.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (
          child.parentElement === parent &&
          child.nextElementSibling === anchor
        )
          return;
        anchor.insertAdjacentElement("beforebegin", child);
      };
      const moveAppend = (parent, child) => {
        if (!(parent instanceof HTMLElement) || !(child instanceof HTMLElement))
          return;
        if (child.parentElement === parent) return;
        parent.appendChild(child);
      };

      const replyButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const label = String(node.textContent || "")
          .trim()
          .toLowerCase();
        return label === "reply" || label === "respond" || label === "response";
      });
      const noteButton = Array.from(
        composerRoot.querySelectorAll("button, [role='button']"),
      ).find(
        (node) =>
          node instanceof HTMLElement && node.textContent?.trim() === "Note",
      );
      const insertParent =
        composerRoot.querySelector(".beatmap-discussion-new__footer") ||
        composerRoot.querySelector("[class*='footer']") ||
        composerRoot.querySelector("[class*='actions']");
      if (replyButton instanceof HTMLElement && replyButton.parentElement) {
        const replyGroup =
          replyButton.closest(".beatmap-discussion-post__actions-group") ||
          replyButton.parentElement;
        if (replyGroup instanceof HTMLElement) {
          moveAsFirstChild(replyGroup, toggleBtn);
        } else {
          moveBefore(replyButton, toggleBtn);
        }
      } else if (
        noteButton instanceof HTMLElement &&
        noteButton.parentElement
      ) {
        const noteGroup =
          noteButton.closest(".beatmap-discussion-post__actions-group") ||
          noteButton.parentElement;
        if (noteGroup instanceof HTMLElement) {
          moveAsFirstChild(noteGroup, toggleBtn);
        } else {
          moveBefore(noteButton, toggleBtn);
        }
      } else if (
        insertParent instanceof HTMLElement &&
        toggleBtn.parentElement !== insertParent
      ) {
        moveAsFirstChild(insertParent, toggleBtn);
      } else if (!(toggleBtn.parentElement instanceof HTMLElement)) {
        const anchor =
          textarea?.closest(".beatmap-discussion-new__message") ||
          textarea?.parentElement ||
          composerRoot;
        moveAsFirstChild(anchor, toggleBtn);
      }
    }

    /**
     * @param {HTMLTextAreaElement|null} textarea
     * @returns {boolean}
     */
    function isVisibleTextarea(textarea) {
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      if (!textarea.isConnected) return false;
      const rect = textarea.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return false;
      const cs = window.getComputedStyle(textarea);
      return cs.display !== "none" && cs.visibility !== "hidden";
    }

    /**
     * @param {HTMLTextAreaElement} textarea
     */
    function bindTextareaPreview(textarea) {
      const composerRoot =
        textarea.closest(".beatmap-discussion-new") ||
        textarea.closest(".beatmap-discussion-post--new-reply") ||
        textarea.closest(".beatmap-discussion-reply-box") ||
        textarea.closest("[class*='discussion-new']") ||
        textarea.closest("[class*='new-reply']") ||
        textarea.closest("[class*='reply-box']");
      if (!(composerRoot instanceof HTMLElement)) return;
      textarea.setAttribute(MARKER_ATTR, "1");
      composerRoot.setAttribute(ROOT_MARKER_ATTR, "1");
      const isReplyComposer =
        composerRoot.classList.contains("beatmap-discussion-post--new-reply") ||
        composerRoot.classList.contains("beatmap-discussion-reply-box");

      /**
       * Replace textarea [start, end) with `replacement` in a way that participates in
       * the native undo stack where supported (Chromium: execCommand insertText).
       */
      const replaceRangeUndoable = (start, end, replacement) => {
        textarea.focus();
        textarea.setSelectionRange(start, end);
        const ok =
          typeof document.execCommand === "function" &&
          document.execCommand("insertText", false, replacement);
        if (!ok) {
          textarea.setRangeText(replacement, start, end, "end");
        }
      };

      const insertText = (before, after, placeholder) => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start, end);
        const payload = `${before}${selected || placeholder}${after}`;
        replaceRangeUndoable(start, end, payload);
        const caret =
          start +
          before.length +
          (selected ? selected.length : String(placeholder).length);
        textarea.setSelectionRange(caret, caret);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleWrap = (before, after, placeholder) => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const val = textarea.value || "";
        const selected = val.slice(start, end);

        const hasOuterWrap =
          start >= before.length &&
          val.slice(start - before.length, start) === before &&
          val.slice(end, end + after.length) === after;

        if (hasOuterWrap) {
          const outerStart = start - before.length;
          const outerEnd = end + after.length;
          replaceRangeUndoable(outerStart, outerEnd, selected);
          textarea.setSelectionRange(outerStart, outerStart + selected.length);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }

        const payload = `${before}${selected || placeholder}${after}`;
        replaceRangeUndoable(start, end, payload);
        const selStart = start + before.length;
        const selEnd =
          selStart + (selected ? selected.length : String(placeholder).length);
        textarea.setSelectionRange(selStart, selEnd);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const togglePrefixLines = (prefix, sample = "text") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart =
          value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const allPrefixed = lines.every((line) => line.startsWith(prefix));
        const next = lines
          .map((line) =>
            allPrefixed ? line.slice(prefix.length) : `${prefix}${line}`,
          )
          .join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleOrderedListLines = (sample = "first item\nsecond item") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart =
          value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const numberedRe = /^\d+\.\s/;
        const allNumbered =
          lines.length > 0 &&
          lines.every((line) => line === "" || numberedRe.test(line));
        let n = 0;
        const next = lines
          .map((line) => {
            if (allNumbered) {
              if (line === "") return "";
              return line.replace(/^\d+\.\s*/, "");
            }
            if (line === "") return "";
            n += 1;
            return `${n}. ${line}`;
          })
          .join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      const toggleCodeBlock = () => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start, end);
        const open = "```\n";
        const close = "\n```";
        const hasFence = selected.startsWith(open) && selected.endsWith(close);
        if (hasFence) {
          const inner = selected.slice(
            open.length,
            selected.length - close.length,
          );
          replaceRangeUndoable(start, end, inner);
          textarea.setSelectionRange(start, start + inner.length);
        } else {
          const payload = `${open}${selected || "code"}${close}`;
          replaceRangeUndoable(start, end, payload);
          const innerStart = start + open.length;
          const innerEnd = innerStart + (selected ? selected.length : 4);
          textarea.setSelectionRange(innerStart, innerEnd);
        }
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };

      composerRoot
        .querySelectorAll(`[${HELPER_ATTR}]`)
        .forEach((n) => n.remove());
      const mkBtn = (iconCls, label, onClick) => {
        const btn = el(
          "button",
          {
            type: "button",
            class: "oep-markdown-helper__btn",
            title: label,
          },
          el("i", { class: iconCls, "aria-hidden": "true" }),
          label,
        );
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return btn;
      };
      const helper = el(
        "div",
        {
          class: `oep-markdown-helper${
            isReplyComposer
              ? " oep-markdown-helper--reply"
              : " oep-markdown-helper--new-discussion"
          }`,
          [HELPER_ATTR]: "1",
        },
        el(
          "div",
          { class: "oep-markdown-helper__row" },
          mkBtn("fas fa-bold", "Bold", () => toggleWrap("**", "**", "bold")),
          mkBtn("fas fa-italic", "Italic", () =>
            toggleWrap("*", "*", "italic"),
          ),
          mkBtn("fas fa-strikethrough", "Strike", () =>
            toggleWrap("~~", "~~", "text"),
          ),
          mkBtn("fas fa-code", "Code", () => toggleWrap("`", "`", "code")),
          mkBtn("fas fa-link", "Link", () =>
            insertText("[", "](https://example.com)", "title"),
          ),
          mkBtn("fas fa-image", "Image", () =>
            insertText("![", "](https://example.com/image.png)", ""),
          ),
          mkBtn("fas fa-quote-left", "Quote", () => togglePrefixLines("> ")),
          mkBtn("fas fa-list-ul", "List", () =>
            togglePrefixLines("- ", "item one\nitem two"),
          ),
          mkBtn("fas fa-list-ol", "Numbered", () => toggleOrderedListLines()),
          mkBtn("fas fa-heading", "Heading", () =>
            insertText("## ", "", "Heading"),
          ),
          mkBtn("fas fa-file-code", "Code Block", () => toggleCodeBlock()),
        ),
      );
      const newDiscussionRoot = textarea.closest(".beatmap-discussion-new");
      if (newDiscussionRoot instanceof HTMLElement) {
        if (
          helper.parentElement !== newDiscussionRoot ||
          newDiscussionRoot.firstElementChild !== helper
        ) {
          newDiscussionRoot.prepend(helper);
        }
      } else if (isReplyComposer) {
        // Inside --new-reply / reply-box so the strip matches the textarea row (not sibling __discussion bg).
        if (
          helper.parentElement !== composerRoot ||
          composerRoot.firstElementChild !== helper
        ) {
          composerRoot.prepend(helper);
        }
      } else if (
        textarea.closest(".beatmap-discussion-reply-box") instanceof
          HTMLElement ||
        textarea.closest(".beatmap-discussion-post--new-reply") instanceof
          HTMLElement ||
        textarea.closest("[class*='reply-box']") instanceof HTMLElement ||
        textarea.closest("[class*='new-reply']") instanceof HTMLElement
      ) {
        const helperAnchor =
          textarea.closest(".beatmap-discussion-reply-box") ||
          textarea.closest(".beatmap-discussion-post--new-reply") ||
          textarea.closest("[class*='reply-box']") ||
          textarea.closest("[class*='new-reply']");
        if (
          helperAnchor instanceof HTMLElement &&
          (helper.previousElementSibling !== helperAnchor ||
            helper.parentElement !== helperAnchor.parentElement)
        ) {
          helperAnchor.insertAdjacentElement("beforebegin", helper);
        }
      } else if (
        !(helper.parentElement instanceof HTMLElement) ||
        helper.nextElementSibling !== textarea
      ) {
        textarea.insertAdjacentElement("beforebegin", helper);
      }

      let toggleBtn = composerRoot.querySelector(`[${TOGGLE_ATTR}]`);
      if (!(toggleBtn instanceof HTMLButtonElement)) {
        toggleBtn = el(
          "button",
          {
            type: "button",
            class: "oep-discussion-preview-toggle",
            [TOGGLE_ATTR]: "1",
            "aria-pressed": previewEnabled ? "true" : "false",
            title: "Toggle post preview",
          },
          "Preview",
        );
      }
      placePreviewToggleButton(composerRoot, toggleBtn, textarea);

      let preview = composerRoot.querySelector(`[${PREVIEW_ATTR}]`);
      if (!(preview instanceof HTMLElement)) {
        preview = el(
          "div",
          {
            class: "oep-discussion-preview",
            [PREVIEW_ATTR]: "1",
            hidden: previewEnabled ? null : "",
          },
          el("p", { class: "oep-discussion-preview__title" }, "Post preview"),
          el("div", { class: "oep-discussion-preview__body" }),
        );
        const anchor =
          textarea.closest(".beatmap-discussion-new__message") ||
          textarea.parentElement ||
          composerRoot;
        anchor.insertAdjacentElement("afterend", preview);
      }

      const body = preview.querySelector(".oep-discussion-preview__body");
      if (!(body instanceof HTMLElement)) return;
      const repaint = () => {
        const visibleNow = isVisibleTextarea(textarea);
        const hasTextNow = String(textarea.value || "").trim().length > 0;
        body.innerHTML = renderMarkdownPreviewHtml(textarea.value || "");
        if (isReplyComposer && !visibleNow) {
          helper.remove();
          toggleBtn.hidden = true;
          preview.hidden = true;
          return;
        }
        helper.hidden = false;
        toggleBtn.hidden = !hasTextNow;
        preview.hidden = !hasTextNow || !previewEnabled;
      };

      toggleBtn.addEventListener("click", () => {
        previewEnabled = !previewEnabled;
        toggleBtn?.setAttribute(
          "aria-pressed",
          previewEnabled ? "true" : "false",
        );
        repaint();
      });
      textarea.addEventListener("input", repaint);
      repaint();
    }

    /** Remove helpers outside a visible reply/new-discussion shell (e.g. stuck before Respond). */
    function pruneDetachedMarkdownHelpers() {
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const replyShell =
          node.closest(".beatmap-discussion-post--new-reply") ||
          node.closest(".beatmap-discussion-reply-box");
        if (replyShell instanceof HTMLElement) {
          const ta = replyShell.querySelector("textarea");
          const keep =
            ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        const newShell = node.closest(".beatmap-discussion-new");
        if (newShell instanceof HTMLElement) {
          const ta = newShell.querySelector("textarea");
          const keep =
            ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        node.remove();
      });
    }

    /** After helper teardown, textarea may still be marked; re-bind when Respond is open again. */
    function reviveReplyPreviewIfNeeded() {
      document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((ta) => {
        if (!(ta instanceof HTMLTextAreaElement) || !ta.isConnected) return;
        const replyRoot =
          ta.closest(".beatmap-discussion-post--new-reply") ||
          ta.closest(".beatmap-discussion-reply-box");
        if (!(replyRoot instanceof HTMLElement)) return;
        if (!isVisibleTextarea(ta)) return;
        if (replyRoot.querySelector(`[${HELPER_ATTR}]`)) return;
        ta.removeAttribute(MARKER_ATTR);
        bindTextareaPreview(ta);
      });
    }

    const run = () => {
      if (!isSupportedDiscussionPath()) {
        document
          .querySelectorAll(`[${TOGGLE_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`[${PREVIEW_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`[${HELPER_ATTR}]`)
          .forEach((n) => n.remove());
        document
          .querySelectorAll(`textarea[${MARKER_ATTR}]`)
          .forEach((n) => n.removeAttribute(MARKER_ATTR));
        document
          .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
          .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
        return;
      }
      const textareas = collectCandidateTextareas();
      for (const ta of textareas) bindTextareaPreview(ta);
      // Keep placement stable when reply footer is re-rendered on collapse/expand.
      document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        const ta =
          Array.from(root.querySelectorAll("textarea")).find((node) =>
            isVisibleTextarea(node),
          ) || root.querySelector("textarea");
        const btn = root.querySelector(`[${TOGGLE_ATTR}]`);
        const preview = root.querySelector(`[${PREVIEW_ATTR}]`);
        const extraHelpers = root.querySelectorAll(`[${HELPER_ATTR}]`);
        if (extraHelpers.length > 1) {
          Array.from(extraHelpers)
            .slice(1)
            .forEach((n) => n.remove());
        }
        const helper = root.querySelector(`[${HELPER_ATTR}]`);
        if (!(btn instanceof HTMLElement)) return;
        const isReplyComposer =
          root.classList.contains("beatmap-discussion-post--new-reply") ||
          root.classList.contains("beatmap-discussion-reply-box");
        const isNewDiscussionRoot = root.classList.contains(
          "beatmap-discussion-new",
        );
        const hasTextNow =
          ta instanceof HTMLTextAreaElement &&
          String(ta.value || "").trim().length > 0;
        if (isReplyComposer && !isVisibleTextarea(ta)) {
          btn.hidden = true;
          if (preview instanceof HTMLElement) preview.hidden = true;
          if (helper instanceof HTMLElement) helper.remove();
          return;
        }
        if ((isReplyComposer || isNewDiscussionRoot) && !hasTextNow) {
          btn.hidden = true;
          if (preview instanceof HTMLElement) preview.hidden = true;
          if (helper instanceof HTMLElement) helper.hidden = false;
          return;
        }
        if (helper instanceof HTMLElement) helper.hidden = false;
        btn.hidden = false;
        placePreviewToggleButton(
          root,
          btn,
          ta instanceof HTMLTextAreaElement ? ta : null,
        );
      });
      pruneDetachedMarkdownHelpers();
      reviveReplyPreviewIfNeeded();
    };

    let debounceTimer = 0;
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 80);
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });
    schedule();

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      document.querySelectorAll(`[${TOGGLE_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
      document
        .querySelectorAll(`textarea[${MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(MARKER_ATTR));
      document
        .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
    };
  }

  /**
   * Redirects discussion landing routes to the Total tab when enabled.
   * @param {RegExp} pathRe
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function startBeatmapDiscussionLandingRedirectManager(pathRe, beatmapsetId) {
    const targetPath = `/beatmapsets/${beatmapsetId}/discussion/-/generalAll/total`;
    const bareDiscussionRe = new RegExp(
      `^/beatmapsets/${beatmapsetId}/discussion/?$`,
      "i",
    );

    const run = () => {
      if (!settings.isEnabled(DISCUSSION_DEFAULT_TO_TOTAL_ID)) return;
      if (!pathRe.test(location.pathname)) return;
      if (
        /^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i.test(
          location.pathname,
        )
      ) {
        return;
      }
      if (!bareDiscussionRe.test(location.pathname)) return;
      location.replace(
        `${targetPath}${location.search || ""}${location.hash || ""}`,
      );
    };

    run();
    const offSetting = settings.onChange(
      DISCUSSION_DEFAULT_TO_TOTAL_ID,
      (enabled) => {
        if (!enabled) return;
        run();
      },
    );
    return () => {
      try {
        offSetting?.();
      } catch (_) {
        void 0;
      }
    };
  }

  // Attribute to mark links we've patched so we can revert them on cleanup.
  const DISCUSSION_TAB_ORIG_HREF_ATTR = "data-oep-discussion-tab-orig-href";

  /**
   * Rewrites Discussion tab links for this beatmapset to land directly on the
   * Total sub-tab.  Matches via `a.href` (always the resolved absolute URL) so
   * it works regardless of whether React rendered a relative or absolute href.
   * @param {string} beatmapsetId
   */
  function _patchDiscussionTabLinks(beatmapsetId) {
    const bareSuffix = `/beatmapsets/${beatmapsetId}/discussion`;
    const target = `${bareSuffix}/-/generalAll/total`;
    document.querySelectorAll("a").forEach((a) => {
      // a.href is always absolute; strip trailing slash for comparison.
      const resolved = a.href.replace(/\/$/, "");
      if (resolved !== `${location.origin}${bareSuffix}`) return;
      if (!a.hasAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR)) {
        a.setAttribute(
          DISCUSSION_TAB_ORIG_HREF_ATTR,
          a.getAttribute("href") ?? "",
        );
      }
      a.setAttribute("href", target);
    });
  }

  /** Reverts any links patched by `_patchDiscussionTabLinks`. */
  function _revertDiscussionTabLinks() {
    document
      .querySelectorAll(`a[${DISCUSSION_TAB_ORIG_HREF_ATTR}]`)
      .forEach((a) => {
        a.setAttribute(
          "href",
          a.getAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR) ?? "",
        );
        a.removeAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR);
      });
  }

  /**
   * Patches the Discussion tab links to go straight to the Total sub-tab.
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function startDiscussionTabLinkPatcher(beatmapsetId) {
    if (settings.isEnabled(DISCUSSION_DEFAULT_TO_TOTAL_ID)) {
      _patchDiscussionTabLinks(beatmapsetId);
    }

    const offSetting = settings.onChange(
      DISCUSSION_DEFAULT_TO_TOTAL_ID,
      (enabled) => {
        if (enabled) _patchDiscussionTabLinks(beatmapsetId);
        else _revertDiscussionTabLinks();
      },
    );

    return () => {
      offSetting();
      _revertDiscussionTabLinks();
    };
  }

  /**
   * Enhances voters avatar tooltips into a scrollable user list.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapDiscussionVotersTooltipManager(pathRe) {
    const ENHANCED_ATTR = "data-oep-discussion-voters-tooltip";
    const USER_ROW_ATTR = "data-oep-voter-user-id";
    const inFlight = new Map();
    const queue = [];
    let activeFetches = 0;
    const MAX_CONCURRENT = 4;

    const parseUserIdFromHref = (href) => {
      const m = String(href || "").match(/\/users\/(\d+)(?:\/|$)/i);
      return m ? m[1] : "";
    };

    const extractNameFromNode = (node, fallbackId) => {
      if (!(node instanceof Element))
        return fallbackId ? `User ${fallbackId}` : "User";
      const val =
        node.getAttribute("title") ||
        node.getAttribute("aria-label") ||
        node.getAttribute("data-tooltip") ||
        node.getAttribute("alt") ||
        node.textContent ||
        "";
      const cleaned = String(val).replace(/\s+/g, " ").trim();
      return cleaned || (fallbackId ? `User ${fallbackId}` : "User");
    };

    const buildUserRowsFromTooltip = (tooltip) => {
      const users = [];
      const seen = new Set();
      const pushUser = (idRaw, avatarRaw, nameRaw) => {
        const id = String(idRaw || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        users.push({
          id,
          href: `/users/${id}`,
          avatar: String(avatarRaw || "").trim(),
          name: String(nameRaw || "").trim() || `User ${id}`,
        });
      };

      // Primary shape: anchors directly linking to /users/{id}.
      const links = Array.from(tooltip.querySelectorAll('a[href*="/users/"]'));
      for (const link of links) {
        if (!(link instanceof HTMLAnchorElement)) continue;
        const href = link.href || link.getAttribute("href") || "";
        const id = parseUserIdFromHref(href);
        if (!id) continue;
        const img = link.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name =
          extractNameFromNode(link, id) || extractNameFromNode(img, id);
        pushUser(id, avatar, name);
      }

      // Fallback shape: nodes carrying data-user-id (common in some vote tooltips).
      const userIdNodes = Array.from(
        tooltip.querySelectorAll("[data-user-id]"),
      );
      for (const node of userIdNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const id = String(node.getAttribute("data-user-id") || "").trim();
        if (!id) continue;
        const img = node.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name =
          extractNameFromNode(node, id) || extractNameFromNode(img, id);
        pushUser(id, avatar, name);
      }

      // Final fallback: avatar-only nodes that still expose osu avatar URL with numeric id.
      const imgs = Array.from(tooltip.querySelectorAll("img"));
      for (const img of imgs) {
        if (!(img instanceof HTMLImageElement)) continue;
        const src = String(img.src || "");
        const m = src.match(/https?:\/\/a\.ppy\.sh\/(\d+)(?:\b|\/|\?)/i);
        if (!m) continue;
        const id = m[1];
        const anchor = img.closest('a[href*="/users/"]');
        const name = extractNameFromNode(anchor || img, id);
        pushUser(id, src, name);
      }

      return users;
    };

    const isSingleUserCardTooltip = (tooltip) => {
      if (!(tooltip instanceof HTMLElement)) return false;
      const cardRoot = tooltip.querySelector(
        '[class*="user-card"], [class*="profile-card"], [class*="user-popup"]',
      );
      if (cardRoot) return true;

      const allClasses = [
        tooltip.className,
        ...Array.from(tooltip.querySelectorAll("[class]")).map(
          (n) => n.className,
        ),
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return /\buser-card\b|\bprofile-card\b|\buser-popup\b/.test(allClasses);
    };

    const scheduleUserFetch = (id, onDone) => {
      if (!id) return;
      if (DISCUSSION_USER_CACHE.has(id)) {
        onDone?.(DISCUSSION_USER_CACHE.get(id));
        return;
      }
      if (inFlight.has(id)) {
        inFlight.get(id).then((data) => onDone?.(data));
        return;
      }

      queue.push({ id, onDone });
      const pump = () => {
        while (activeFetches < MAX_CONCURRENT && queue.length) {
          const next = queue.shift();
          if (!next || !next.id) continue;
          const uid = next.id;

          if (DISCUSSION_USER_CACHE.has(uid)) {
            next.onDone?.(DISCUSSION_USER_CACHE.get(uid));
            continue;
          }
          if (inFlight.has(uid)) {
            inFlight.get(uid).then((data) => next.onDone?.(data));
            continue;
          }

          activeFetches += 1;
          const req = OsuExpertPlus.api
            .getUser(uid)
            .then((user) => {
              const data = {
                id: String(user?.id || uid),
                username: String(user?.username || `User ${uid}`),
                avatarUrl:
                  String(user?.avatar_url || "").trim() ||
                  `https://a.ppy.sh/${uid}`,
              };
              DISCUSSION_USER_CACHE.set(uid, data);
              return data;
            })
            .catch(() => {
              const fallback = {
                id: String(uid),
                username: `User ${uid}`,
                avatarUrl: `https://a.ppy.sh/${uid}`,
              };
              DISCUSSION_USER_CACHE.set(uid, fallback);
              return fallback;
            })
            .finally(() => {
              inFlight.delete(uid);
              activeFetches = Math.max(0, activeFetches - 1);
              pump();
            });
          inFlight.set(uid, req);
          req.then((data) => next.onDone?.(data));
        }
      };
      pump();
    };

    const hydrateVisibleRows = (container) => {
      if (!(container instanceof HTMLElement)) return () => {};
      const rows = Array.from(container.querySelectorAll(`[${USER_ROW_ATTR}]`));
      if (!rows.length) return () => {};

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const row = entry.target;
            if (!(row instanceof HTMLAnchorElement)) continue;
            const uid = row.getAttribute(USER_ROW_ATTR) || "";
            if (!uid || row.getAttribute("data-oep-user-loaded") === "1") {
              observer.unobserve(row);
              continue;
            }

            scheduleUserFetch(uid, (u) => {
              if (!u || !row.isConnected) return;
              const img = row.querySelector(
                ".oep-discussion-voters-tooltip__avatar",
              );
              const name = row.querySelector(
                ".oep-discussion-voters-tooltip__name",
              );
              if (img instanceof HTMLImageElement) {
                img.src = u.avatarUrl;
                img.alt = u.username;
              }
              if (name instanceof HTMLElement) name.textContent = u.username;
              row.href = `/users/${u.id}`;
              row.setAttribute("data-oep-user-loaded", "1");
            });
            observer.unobserve(row);
          }
        },
        { root: container, threshold: 0.01 },
      );

      rows.forEach((r) => observer.observe(r));
      return () => observer.disconnect();
    };

    const maybeEnhanceTooltip = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.getAttribute(ENHANCED_ATTR) === "1") return;
      if (!pathRe.test(location.pathname)) return;
      if (!/^\/beatmapsets\/\d+\/discussion(?:\/|$)/i.test(location.pathname))
        return;

      const role = node.getAttribute("role") || "";
      const cls = node.className || "";
      if (
        role !== "tooltip" &&
        !/\btooltip\b/i.test(cls) &&
        !/\bqtip\b/i.test(cls)
      ) {
        return;
      }
      if (isSingleUserCardTooltip(node)) return;

      const users = buildUserRowsFromTooltip(node);
      if (users.length < 1) return;

      node.setAttribute(ENHANCED_ATTR, "1");
      node.classList.add("oep-discussion-voters-tooltip");

      const list = el("div", { class: "oep-discussion-voters-tooltip__list" });
      for (const u of users) {
        const row = el(
          "a",
          {
            class: "oep-discussion-voters-tooltip__row",
            href: u.href,
            [USER_ROW_ATTR]: String(u.id),
          },
          el("img", {
            class: "oep-discussion-voters-tooltip__avatar",
            src: u.avatar || `https://a.ppy.sh/${u.id}`,
            alt: u.name,
            loading: "lazy",
          }),
          el("span", { class: "oep-discussion-voters-tooltip__name" }, u.name),
        );
        list.appendChild(row);
      }

      node.replaceChildren(list);
      hydrateVisibleRows(list);
    };

    const processExisting = () => {
      const tips = document.querySelectorAll(
        '[role="tooltip"], .tooltip, .qtip',
      );
      tips.forEach((tip) => maybeEnhanceTooltip(tip));
    };

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          maybeEnhanceTooltip(n);
          n.querySelectorAll?.('[role="tooltip"], .tooltip, .qtip').forEach(
            (tip) => maybeEnhanceTooltip(tip),
          );
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    processExisting();

    return () => {
      obs.disconnect();
      document.querySelectorAll(`[${ENHANCED_ATTR}]`).forEach((n) => {
        n.removeAttribute(ENHANCED_ATTR);
        n.classList.remove("oep-discussion-voters-tooltip");
      });
    };
  }

  const EXTENDED_SCORE_ROW_ATTR = "data-oep-api-extended-score";
  const EXTENDED_LB_LIMIT = 100;
  const SCORES_LIMIT_PATCH_FLAG = "__oepBeatmapScoresLimitPatched";
  /** osu-web uses `.beatmap-scoreboard-table` on the wrapper `div`; the real `<table>` is `__table`. */
  const SCOREBOARD_HTML_TABLE_SEL = "table.beatmap-scoreboard-table__table";
  /** Same tokens as user-profile score stats (`.oep-score-stats__val--*`) + mode extras. */
  const SCOREBOARD_HITSTAT_COLOR_CLASSES = [
    "oep-score-stats__val--300",
    "oep-score-stats__val--100",
    "oep-score-stats__val--50",
    "oep-score-stats__val--miss",
    "oep-score-stats__val--ctb-l",
    "oep-score-stats__val--ctb-drp",
    "oep-score-stats__val--mania-perfect",
    "oep-score-stats__val--mania-good",
  ];
  const SCOREBOARD_PP_VALUE_CLASS = "oep-beatmap-scoreboard-pp-value";
  /** @type {Map<string, number|null>} */
  const _beatmapFullComboCache = new Map();

  /**
   * @param {string} rawUrl
   * @returns {string}
   */
  function withBeatmapScoresLimit(rawUrl) {
    const src = String(rawUrl || "");
    if (!src) return src;
    if (!settings.isEnabled(API_EXTENDED_LEADERBOARD_ID)) return src;
    try {
      const u = new URL(src, location.origin);
      if (!/^\/beatmaps\/\d+\/scores$/i.test(u.pathname)) return src;
      if (
        u.origin !== location.origin &&
        u.origin.toLowerCase() !== "https://osu.ppy.sh"
      ) {
        return src;
      }
      if (u.searchParams.get("limit") === String(EXTENDED_LB_LIMIT)) return src;
      u.searchParams.set("limit", String(EXTENDED_LB_LIMIT));
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src)) return u.toString();
      if (src.startsWith("//"))
        return `//${u.host}${u.pathname}${u.search}${u.hash}`;
      return `${u.pathname}${u.search}${u.hash}`;
    } catch (_) {
      return src;
    }
  }

  function installBeatmapScoresLimitPatch() {
    if (window[SCORES_LIMIT_PATCH_FLAG]) return;
    window[SCORES_LIMIT_PATCH_FLAG] = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      try {
        if (typeof input === "string") {
          return nativeFetch(withBeatmapScoresLimit(input), init);
        }
        if (input instanceof URL) {
          return nativeFetch(withBeatmapScoresLimit(input.toString()), init);
        }
        if (input instanceof Request) {
          const patchedUrl = withBeatmapScoresLimit(input.url);
          if (patchedUrl !== input.url) {
            return nativeFetch(new Request(patchedUrl, input), init);
          }
        }
      } catch (_) {
        void 0;
      }
      return nativeFetch(input, init);
    };

    const nativeXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedXhrOpen(
      method,
      url,
      ...rest
    ) {
      const raw = typeof url === "string" ? url : String(url ?? "");
      return nativeXhrOpen.call(
        this,
        method,
        withBeatmapScoresLimit(raw),
        ...rest,
      );
    };
  }

  /**
   * Beatmap max combo (full combo count) parsed once from the page's beatmap JSON.
   * Used to highlight combo text only for exact full-combo scores.
   * @param {string} beatmapId
   * @returns {number|null}
   */
  function getBeatmapFullComboFromBeatmapsetJson(beatmapId) {
    const key = String(beatmapId);
    if (_beatmapFullComboCache.has(key)) {
      return _beatmapFullComboCache.get(key) ?? null;
    }
    const data = readBeatmapsetJson();
    const idNum = Number(beatmapId);
    const found =
      data?.beatmaps?.find(
        (b) => b?.id === idNum || String(b?.id ?? "") === String(beatmapId),
      ) ?? null;
    const raw = found?.max_combo ?? found?.maxCombo ?? null;
    const n = raw != null ? Number(raw) : NaN;
    const maxCombo = Number.isFinite(n) && n > 0 ? n : null;
    _beatmapFullComboCache.set(key, maxCombo);
    return maxCombo;
  }

  /**
   * Row #1 is often NM — no `.beatmap-scoreboard-mod` inside its mods cell. Use any
   * mod chip on the table or the scoreboard filter bar as clone source.
   * @param {ParentNode|null|undefined} scoreboardRoot
   * @returns {HTMLElement|null}
   */
  function resolveBeatmapScoreboardModTemplateEl(scoreboardRoot) {
    const inRoot = (sel) => scoreboardRoot?.querySelector?.(sel) ?? null;
    // Expert+ mod grid hides osu’s original strip with data-oep-mod-hidden; those nodes
    // are first in DOM order and can be stale for masks — prefer grid pile clones.
    const pileModSel = `.${MOD_GRID_CLASS}__pile .beatmap-scoreboard-mod`;
    const stripVisibleSel =
      ".beatmapset-scoreboard__mods .beatmap-scoreboard-mod:not([data-oep-mod-hidden])";
    const chain = [
      () => inRoot(".beatmap-scoreboard-table__mods .beatmap-scoreboard-mod"),
      () => inRoot(".beatmap-scoreboard-table__body .beatmap-scoreboard-mod"),
      () => inRoot(pileModSel),
      () => document.querySelector(pileModSel),
      () => inRoot(stripVisibleSel),
      () => document.querySelector(stripVisibleSel),
      () =>
        document.querySelector(
          ".beatmap-scoreboard-mod:not([data-oep-mod-hidden])",
        ),
      () => document.querySelector(".beatmap-scoreboard-mod"),
    ];
    for (const fn of chain) {
      const el = fn();
      if (el instanceof HTMLElement) return el;
    }
    return null;
  }

  /**
   * @returns {boolean}
   */
  function isLazerModeEnabledForLeaderboard() {
    // Account menu toggle reflects current preference; checked icon means lazer mode on.
    const toggle = document.querySelector(
      'button[title*="Lazer mode"][data-url*="legacy_score_only"]',
    );
    if (!(toggle instanceof HTMLButtonElement)) return false;
    return Boolean(toggle.querySelector(".fa-check-square"));
  }

  /**
   * Main score column value aligned with osu-web's Lazer mode toggle.
   * Lazer mode off -> prefer `legacy_total_score`.
   * Lazer mode on  -> prefer `classic_total_score`.
   * @param {object} s
   */
  function leaderboardTableScoreNumber(s) {
    const nz = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    const cls = nz(s.classic_total_score);
    const leg = nz(s.legacy_total_score);
    if (isLazerModeEnabledForLeaderboard()) {
      if (cls) return cls;
      if (leg) return leg;
    } else {
      if (leg) return leg;
      if (cls) return cls;
    }
    const tot = nz(s.total_score);
    if (tot) return tot;
    const raw = nz(s.score);
    if (raw) return raw;
    const xTot = Number(s.total_score);
    if (Number.isFinite(xTot)) return xTot;
    const xLeg = Number(s.legacy_total_score);
    if (Number.isFinite(xLeg)) return xLeg;
    return 0;
  }

  /**
   * @param {object[]} scores
   */
  function sortLeaderboardScoresLikeTable(scores) {
    scores.sort((a, b) => {
      const ds =
        leaderboardTableScoreNumber(b) - leaderboardTableScoreNumber(a);
      if (ds !== 0) return ds;
      const ppb = Number(b.pp);
      const ppa = Number(a.pp);
      if (Number.isFinite(ppb) && Number.isFinite(ppa) && ppb !== ppa)
        return ppb - ppa;
      return (
        (Number(leaderboardScoreId(b)) || 0) -
        (Number(leaderboardScoreId(a)) || 0)
      );
    });
  }

  /**
   * @returns {string|null}
   */
  function getBeatmapPageBeatmapId() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\/(\d+)/i);
    if (fromHash) return fromHash[2];

    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      const fromPickerHash = href.match(/#(osu|taiko|fruits|mania)\/(\d+)/i);
      if (fromPickerHash) return fromPickerHash[2];
      const fromPath = href.match(/\/beatmaps\/(\d+)/);
      if (fromPath) return fromPath[1];
    }

    const data = readBeatmapsetJson();
    const mode = getBeatmapPageRuleset();
    if (data?.beatmaps?.length) {
      const bm = data.beatmaps.find((b) => b.mode === mode) || data.beatmaps[0];
      if (bm?.id != null) return String(bm.id);
    }

    return null;
  }

  /**
   * @returns {string}
   */
  function getBeatmapPageRuleset() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\//i);
    if (fromHash) return fromHash[1].toLowerCase();
    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      let m = href.match(/#(osu|taiko|fruits|mania)\//i);
      if (m) return m[1].toLowerCase();
      m = href.match(/\/beatmaps\/(\d+)/);
      if (m) {
        const data = readBeatmapsetJson();
        const id = Number(m[1]);
        const found = data?.beatmaps?.find((b) => b.id === id);
        if (found?.mode) return String(found.mode).toLowerCase();
      }
    }
    return "osu";
  }

  /**
   * osu-web wraps values in `td > a.beatmap-scoreboard-table__cell-content`; setting
   * `td.textContent` strips that link and breaks layout/CSS. Writes go on the `<a>`.
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {string} text
   */
  function setScoreboardTdPlainText(td, text) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (a) {
      a.replaceChildren(document.createTextNode(text));
      return;
    }
    td.textContent = text;
  }

  /**
   * Stable numeric id for sorting extended score rows.
   * @param {object|null|undefined} score
   * @returns {string|null}
   */
  function leaderboardScoreId(score) {
    if (!score || typeof score !== "object") return null;
    const raw =
      score.id ??
      score.legacy_score_id ??
      score.score_id ??
      score.scoreId ??
      score.scoreID ??
      score.score?.id ??
      score.score?.legacy_score_id ??
      score.score?.score_id ??
      null;
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n > 0 ? String(n) : null;
    const s = String(raw).trim();
    return s ? s : null;
  }

  /**
   * Short relative labels similar to osu leaderboard (`now`, `2d`, `5mo`, `3y`).
   * @param {string} iso
   */
  function formatScoreboardShortAgo(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 45) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(day / 365);
    if (y < 1) return `${mo}mo`;
    return `${y}y`;
  }

  /**
   * @param {HTMLTableRowElement} templateRow
   * @param {number|null|undefined} colIndex
   * @returns {HTMLTableCellElement|null}
   */
  function scoreboardRefTd(templateRow, colIndex) {
    if (colIndex == null || !(templateRow instanceof HTMLTableRowElement))
      return null;
    const tds = templateRow.querySelectorAll("td");
    return /** @type {HTMLTableCellElement|null} */ (tds[colIndex] ?? null);
  }

  /**
   * Copy `a` classes and reuse the first `<span>` shell when present (matches native typography).
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {string} text
   */
  function applyScoreboardTextCellLikeRef(td, refTd, text) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );

    // Common osu-web markup: `td > a.beatmap-scoreboard-table__cell-content`.
    if (a instanceof HTMLAnchorElement) {
      if (refA instanceof HTMLAnchorElement) a.className = refA.className;
      const refShell = refA?.firstElementChild;
      if (refShell instanceof HTMLElement) {
        const shell = refShell.cloneNode(false);
        shell.textContent = text;
        a.replaceChildren(shell);
      } else {
        a.replaceChildren(document.createTextNode(text));
      }
      return;
    }

    // Some columns (notably hitstats) are not links: `td > ...__cell-content`.
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    const refShellParent =
      refTd?.querySelector(".beatmap-scoreboard-table__cell-content") || null;
    if (shell instanceof HTMLElement && refShellParent instanceof HTMLElement) {
      shell.className = refShellParent.className;
      const refChild = refShellParent.firstElementChild;
      if (refChild instanceof HTMLElement) {
        const child = refChild.cloneNode(false);
        child.textContent = text;
        shell.replaceChildren(child);
      } else {
        shell.replaceChildren(document.createTextNode(text));
      }
      return;
    }

    // Fallback: still update something visible.
    td.textContent = text;
  }

  /**
   * @param {string} cls
   * @param {boolean} on
   */
  function toggleScoreboardCellPerfectClass(cls, on) {
    const PERF = "beatmap-scoreboard-table__cell-content--perfect";
    const base = cls
      .replace(new RegExp(`\\s*${PERF}\\b`, "g"), "")
      .trim()
      .replace(/\s+/g, " ");
    return on ? `${base} ${PERF}`.trim() : base;
  }

  /**
   * API v2 Score (solo) uses `is_perfect_combo` / `legacy_perfect`; some payloads still expose `perfect`.
   * @param {object} score
   * @returns {boolean}
   */
  function scoreApiIndicatesComboPerfect(score) {
    if (!score || typeof score !== "object") return false;
    if (score.perfect === true) return true;
    if (score.is_perfect_combo === true) return true;
    if (score.legacy_perfect === true) return true;
    return false;
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   * @param {number|null|undefined} mapFullCombo
   */
  function applyScoreboardComboCell(td, refTd, score, mapFullCombo) {
    if (!td) return;
    const comboStr = `${Number(score.max_combo ?? 0).toLocaleString("en-US")}x`;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    const maxCombo = Number(score.max_combo ?? 0);
    const stats =
      score?.statistics && typeof score.statistics === "object"
        ? score.statistics
        : {};
    const maxComboFromStats = Number(
      score.maximum_statistics?.max_combo ??
        score.maximum_statistics?.maxCombo ??
        stats.max_combo ??
        stats.maxCombo,
    );
    const mapFull = mapFullCombo != null ? Number(mapFullCombo) : NaN;
    const hasMapFull = Number.isFinite(mapFull) && mapFull > 0;
    const inferredPerfect = hasMapFull
      ? maxCombo > 0 && maxCombo === mapFull
      : Number.isFinite(maxComboFromStats) &&
        maxComboFromStats > 0 &&
        maxCombo === maxComboFromStats;
    const perfect = scoreApiIndicatesComboPerfect(score) || inferredPerfect;
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = comboStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(comboStr));
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardAccuracyCell(td, refTd, score) {
    if (!td) return;
    const accStr =
      typeof score.accuracy === "number"
        ? `${(score.accuracy * 100).toFixed(2)}%`
        : "";
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    const perfect = typeof score.accuracy === "number" && score.accuracy >= 1;
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = accStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(accStr));
  }

  /**
   * Display pp on score rows (keep decimal precision from API value).
   * Mirrors native tooltip metadata by writing full pp into `title` /
   * `data-orig-title` on the span.
   *
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardPpCell(td, refTd, score) {
    if (!td) return;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (!a || !refA) return;
    a.className = refA.className;
    const pp = score.pp;
    const refSpan = refA.querySelector("span");
    if (pp == null || !Number.isFinite(Number(pp))) {
      if (refSpan) {
        const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
        s.textContent = "—";
        s.removeAttribute("title");
        s.removeAttribute("data-orig-title");
        s.removeAttribute("data-original-title");
        s.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        a.replaceChildren(s);
      } else {
        a.replaceChildren(document.createTextNode("—"));
      }
      return;
    }
    const ppNumber = Number(pp);
    const titleStr = String(pp).replace(/,/g, "").trim();
    const displayStr = String(Math.round(ppNumber));
    if (refSpan) {
      const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
      s.textContent = displayStr;
      s.setAttribute("title", titleStr);
      s.setAttribute("data-orig-title", titleStr);
      a.replaceChildren(s);
    } else {
      a.replaceChildren(document.createTextNode(displayStr));
    }
  }

  /**
   * Native scoreboard rows keep full pp in `span[title]` while visible text is integer.
   * Mirror user-profile behavior when “PP decimals on scores” is enabled.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardPpDecimals(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const showPpDecimals = Boolean(settings?.isEnabled?.(SCORE_PP_DECIMALS_ID));
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!td) continue;
        const span = td.querySelector(
          "a.beatmap-scoreboard-table__cell-content > span[title], span.beatmap-scoreboard-table__cell-content > span[title]",
        );
        if (!(span instanceof HTMLSpanElement)) continue;
        const textNode = Array.from(span.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        if (!textNode) continue;
        const full = span.getAttribute("title");
        const n = parseLocaleNumber(full || "");
        if (!Number.isFinite(n)) continue;

        if (showPpDecimals) {
          if (!span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
            span.setAttribute(
              SCOREBOARD_PP_ORIGINAL_ATTR,
              String(textNode.textContent || "").trim(),
            );
          }
          textNode.textContent = formatDecimalPp(n);
        } else if (span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
          textNode.textContent =
            span.getAttribute(SCOREBOARD_PP_ORIGINAL_ATTR) ||
            textNode.textContent;
          span.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        }
      }
    }
  }

  /**
   * Map hit-stat column label (from `buildBeatmapScoreboardColumnMap`) to profile palette class.
   * @param {string} labelRaw
   * @returns {string}
   */
  function beatmapHitstatColorClassFromLabel(labelRaw) {
    const lab = String(labelRaw).trim().toLowerCase();
    if (!lab) return "";
    if (lab === "mania_perfect") return "oep-score-stats__val--mania-perfect";
    if (lab === "mania_good") return "oep-score-stats__val--mania-good";
    if (lab === "ctb_l") return "oep-score-stats__val--ctb-l";
    if (lab === "ctb_drp") return "oep-score-stats__val--ctb-drp";
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return "oep-score-stats__val--miss";
    if (lab === "meh" || /(^|[^0-9])50([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--50";
    if (lab === "geki" || lab === "max" || lab === "320")
      return "oep-score-stats__val--300";
    if (lab === "katu" || lab === "200") return "oep-score-stats__val--100";
    if (lab === "ok" || /(^|[^0-9])100([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--100";
    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return "oep-score-stats__val--300";
    return "";
  }

  /**
   * @param {HTMLElement|null|undefined} el
   */
  function clearBeatmapScoreboardHitstatColorClasses(el) {
    if (!(el instanceof HTMLElement)) return;
    for (const c of SCOREBOARD_HITSTAT_COLOR_CLASSES) el.classList.remove(c);
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {HTMLElement|null}
   */
  function beatmapScoreboardHitstatPaintTarget(td) {
    if (!td) return null;
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (a instanceof HTMLElement) {
      const sp = a.querySelector("span");
      if (sp instanceof HTMLElement) return sp;
      return a;
    }
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    if (shell instanceof HTMLElement) {
      const kid = shell.firstElementChild;
      if (kid instanceof HTMLElement) return kid;
      return shell;
    }
    return td;
  }

  /**
   * Color GREAT/OK/MEH/MISS (and 300/100/50) leaderboard headers + counts; palette matches profile score card.
   * Always applied on beatmapset scoreboards (not gated by profile “hit statistics” setting).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardHitstatColors(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      const indices = colMap.hitstatIndices || [];
      if (!indices.length) continue;

      for (const i of indices) {
        const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
        const colorClass = beatmapHitstatColorClassFromLabel(label);

        const th = [...table.querySelectorAll("thead th")].find(
          (t) => t instanceof HTMLTableCellElement && t.cellIndex === i,
        );
        if (th instanceof HTMLElement) {
          clearBeatmapScoreboardHitstatColorClasses(th);
          if (colorClass) th.classList.add(colorClass);
        }

        const rows = table.querySelectorAll(
          "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
        );
        for (const row of rows) {
          const td = row.cells?.[i];
          if (!(td instanceof HTMLTableCellElement)) continue;
          const target = beatmapScoreboardHitstatPaintTarget(td);
          if (!(target instanceof HTMLElement)) continue;
          clearBeatmapScoreboardHitstatColorClasses(target);
          if (colorClass) target.classList.add(colorClass);
        }
      }
    }
  }

  /**
   * Light purple PP numbers on the beatmap leaderboard (all rulesets).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardPpValueColor(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!(td instanceof HTMLTableCellElement)) continue;
        const target = beatmapScoreboardHitstatPaintTarget(td);
        if (!(target instanceof HTMLElement)) continue;
        target.classList.add(SCOREBOARD_PP_VALUE_CLASS);
      }
    }
  }

  /**
   * Leaderboard sort for this tab only (not GM); default score descending.
   * @type {{ key: string, dir: "asc"|"desc" }}
   */
  let beatmapScoreboardSortState = { key: "score", dir: "desc" };

  /**
   * @returns {{ key: string, dir: "asc"|"desc" }}
   */
  function readBeatmapScoreboardSortState() {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(
      beatmapScoreboardSortState.key,
    )
      ? beatmapScoreboardSortState.key
      : "score";
    const d =
      beatmapScoreboardSortState.dir === "asc" ? "asc" : "desc";
    return { key: k, dir: d };
  }

  /**
   * @param {string} key
   * @param {"asc"|"desc"} dir
   */
  function writeBeatmapScoreboardSortState(key, dir) {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(String(key).toLowerCase())
      ? String(key).toLowerCase()
      : "score";
    const d = dir === "asc" ? "asc" : "desc";
    beatmapScoreboardSortState = { key: k, dir: d };
  }

  /**
   * @param {string} sortKey
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @returns {number|null}
   */
  function beatmapScoreboardSortColIndex(sortKey, colMap) {
    if (sortKey === "date") return colMap.time;
    return colMap[sortKey] ?? null;
  }

  /**
   * @param {string} sortKey
   * @returns {string}
   */
  function beatmapScoreboardSortColumnLabel(sortKey) {
    if (sortKey === "score") return "Score";
    if (sortKey === "accuracy") return "Accuracy";
    if (sortKey === "combo") return "Combo";
    if (sortKey === "pp") return "PP";
    if (sortKey === "date") return "Date";
    return "Score";
  }

  function applyBeatmapScoreboardSortHeaderClick(sortKey) {
    const { key, dir } = readBeatmapScoreboardSortState();
    let nextDir = "desc";
    if (key === sortKey) {
      nextDir = dir === "desc" ? "asc" : "desc";
    }
    writeBeatmapScoreboardSortState(sortKey, nextDir);
    const board = findBeatmapScoreboardRoot();
    if (board instanceof HTMLElement) {
      refreshBeatmapScoreboardTableEnhancements(board);
    }
  }

  /**
   * @param {string} sortKey
   * @returns {HTMLButtonElement}
   */
  function createBeatmapScoreboardSortHeaderButton(sortKey) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const btn = /** @type {HTMLButtonElement} */ (
      el("button", {
        type: "button",
        class: "oep-scoreboard-th-sort",
        [SCOREBOARD_SORT_ARROW_ATTR]: "",
        "data-oep-sort-key": sortKey,
        "aria-label": `Sort by ${label}`,
        title: `Sort by ${label}`,
      })
    );
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBeatmapScoreboardSortHeaderClick(sortKey);
    });
    return btn;
  }

  /**
   * @param {HTMLButtonElement} btn
   * @param {string} sortKey
   * @param {{ key: string, dir: "asc"|"desc" }} state
   */
  function updateBeatmapScoreboardSortHeaderButton(btn, sortKey, state) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const active = state.key === sortKey;
    const sym = !active ? "▼" : state.dir === "desc" ? "▼" : "▲";
    btn.classList.toggle("oep-scoreboard-th-sort--active", active);
    if (btn.textContent !== sym) btn.textContent = sym;
    const tip = `Sort by ${label}`;
    btn.setAttribute("aria-label", tip);
    btn.title = tip;
    if (active) {
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.removeAttribute("aria-pressed");
    }
  }

  /**
   * Re-attaches sort arrows after osu-web replaces thead (SPA). Idempotent.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardHeaderSortUi(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbodyRow = table.querySelector(
      "tbody.beatmap-scoreboard-table__body tr.beatmap-scoreboard-table__body-row",
    );
    if (!(tbodyRow instanceof HTMLTableRowElement)) return;
    const colMap = buildBeatmapScoreboardColumnMap(tbodyRow, table);
    const theadRow = table.querySelector("thead tr");
    if (!(theadRow instanceof HTMLTableRowElement)) return;
    const state = readBeatmapScoreboardSortState();

    for (let i = 0; i < theadRow.cells.length; i++) {
      const th = theadRow.cells[i];
      if (!(th instanceof HTMLTableCellElement)) continue;
      const btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) continue;
      const k = btn.getAttribute("data-oep-sort-key");
      const expected =
        k != null ? beatmapScoreboardSortColIndex(k, colMap) : null;
      if (expected == null || th.cellIndex !== expected) {
        btn.remove();
      }
    }

    /** @type {Array<[string, number|null]>} */
    const pairs = [
      ["score", colMap.score],
      ["accuracy", colMap.accuracy],
      ["combo", colMap.combo],
      ["pp", colMap.pp],
      ["date", colMap.time],
    ];
    for (const [sk, cellIdx] of pairs) {
      if (cellIdx == null) continue;
      const th = theadRow.cells[cellIdx];
      if (!(th instanceof HTMLTableCellElement)) continue;
      let btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) {
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      } else if (btn.getAttribute("data-oep-sort-key") !== sk) {
        btn.remove();
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      }
      updateBeatmapScoreboardSortHeaderButton(btn, sk, state);
    }
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {number}
   */
  function beatmapScoreboardTdNumberForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const span = td.querySelector(
      "a.beatmap-scoreboard-table__cell-content span[title], span.beatmap-scoreboard-table__cell-content span[title], span[title]",
    );
    let raw = (
      span?.getAttribute("title") ||
      span?.textContent ||
      td.textContent ||
      ""
    ).trim();
    raw = raw.replace(/\u00a0/g, " ");
    raw = raw
      .replace(/[x×%]/gi, "")
      .replace(/\bpp\b/gi, "")
      .replace(/,/g, "")
      .trim();
    const n = parseLocaleNumber(raw);
    return Number.isFinite(n) ? n : -Infinity;
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @returns {number}
   */
  function beatmapScoreboardTdDateMsForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const timeEl = td.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return -Infinity;
    const raw =
      timeEl.getAttribute("datetime") ||
      timeEl.getAttribute("title") ||
      timeEl.dateTime ||
      "";
    const ms = Date.parse(String(raw).trim());
    return Number.isFinite(ms) ? ms : -Infinity;
  }

  /**
   * @param {HTMLTableRowElement} row
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @param {string} sortKey
   * @returns {number}
   */
  function beatmapScoreboardRowSortPrimary(row, colMap, sortKey) {
    if (sortKey === "date") {
      const i = colMap.time;
      return i != null
        ? beatmapScoreboardTdDateMsForSort(row.cells[i])
        : -Infinity;
    }
    const i =
      sortKey === "score"
        ? colMap.score
        : sortKey === "accuracy"
          ? colMap.accuracy
          : sortKey === "combo"
            ? colMap.combo
            : sortKey === "pp"
              ? colMap.pp
              : colMap.score;
    if (i == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[i]);
  }

  /**
   * @param {HTMLTableRowElement} row
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @returns {number}
   */
  function beatmapScoreboardRowSortTieScore(row, colMap) {
    if (colMap.score == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[colMap.score]);
  }

  /**
   * @param {HTMLTableRowElement[]} visibleRows
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   */
  function renumberBeatmapScoreboardVisibleRanks(visibleRows, colMap) {
    if (colMap.rank == null || !Array.isArray(visibleRows)) return;
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      if (!(row instanceof HTMLTableRowElement)) continue;
      const td = row.cells[colMap.rank];
      if (!td) continue;
      const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
      const target = shell instanceof HTMLElement ? shell : td;
      const cur = String(target.textContent ?? "").trim();
      if (cur === "?") continue;
      const next = String(i + 1);
      if (cur !== next) target.textContent = next;
    }
  }

  /**
   * Reorders visible tbody rows by the chosen column and direction. Hidden native
   * rows stay at the end. Skips DOM writes when order is already correct so the
   * scoreboard MutationObserver does not loop. Updates rank cells for visible rows.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function applyBeatmapScoreboardLeaderboardSort(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbody = table.querySelector("tbody.beatmap-scoreboard-table__body");
    if (!(tbody instanceof HTMLElement)) return;

    const allRows = [
      ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
    ];
    if (allRows.length < 1) return;

    const visible = allRows.filter(
      (r) => r instanceof HTMLElement && r.style.display !== "none",
    );
    const hidden = allRows.filter(
      (r) => r instanceof HTMLElement && r.style.display === "none",
    );

    if (visible.length < 1) return;

    const templateRow = /** @type {HTMLTableRowElement} */ (visible[0]);
    const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
    const { key: sortKey, dir } = readBeatmapScoreboardSortState();
    const desc = dir === "desc";

    if (visible.length < 2) {
      renumberBeatmapScoreboardVisibleRanks(visible, colMap);
      return;
    }

    const sortedVisible = visible.slice().sort((a, b) => {
      const ar = /** @type {HTMLTableRowElement} */ (a);
      const br = /** @type {HTMLTableRowElement} */ (b);
      const pa = beatmapScoreboardRowSortPrimary(ar, colMap, sortKey);
      const pb = beatmapScoreboardRowSortPrimary(br, colMap, sortKey);
      const pc = desc ? pb - pa : pa - pb;
      if (pc !== 0) return pc;
      const ta = beatmapScoreboardRowSortTieScore(ar, colMap);
      const tb = beatmapScoreboardRowSortTieScore(br, colMap);
      const tc = desc ? tb - ta : ta - tb;
      return tc;
    });

    const desired = [...sortedVisible, ...hidden];
    let same = true;
    for (let i = 0; i < desired.length; i++) {
      if (tbody.children[i] !== desired[i]) {
        same = false;
        break;
      }
    }
    if (!same) {
      for (const row of desired) tbody.appendChild(row);
    }
    renumberBeatmapScoreboardVisibleRanks(sortedVisible, colMap);
  }

  /**
   * Debounced thead sync when osu-web re-renders the scoreboard (SPA).
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardSortControls(pathRe) {
    let debounceTimer = 0;

    const cleanup = () => {
      document
        .querySelectorAll(
          `.beatmapset-scoreboard [${SCOREBOARD_SORT_ARROW_ATTR}]`,
        )
        .forEach((n) => n.remove());
    };

    const run = () => {
      debounceTimer = 0;
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      syncBeatmapScoreboardHeaderSortUi(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    schedule();

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      cleanup();
    };
  }

  function beatmapScoreboardRowNeedsRateEditMarkFromDom(row) {
    for (const extSpan of row.querySelectorAll(
      ".beatmap-scoreboard-table__mods .mod__extender span",
    )) {
      const modEl = extSpan.closest(".mod");
      const icon = modEl?.querySelector(".mod__icon[data-acronym]");
      const acronym = (icon?.getAttribute("data-acronym") ?? "")
        .trim()
        .toUpperCase();
      if (
        acronym !== "DT" &&
        acronym !== "NC" &&
        acronym !== "HT" &&
        acronym !== "DC"
      ) {
        continue;
      }
      const rate = parseFloat(
        (extSpan.textContent ?? "").replace(/[^\d.]/g, ""),
      );
      if (
        Number.isFinite(rate) &&
        shouldShowScoreboardModSpeedIndicator(acronym, rate)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} row
   * @returns {boolean}
   */
  function beatmapScoreboardRowIsApiInjectedForRateMarking(row) {
    return (
      row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) ||
      row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) ||
      row.hasAttribute(EXTENDED_SCORE_ROW_ATTR)
    );
  }

  /**
   * Scan all visible leaderboard body rows and mark those with a custom rate
   * using RATE_EDIT_ROW_ATTR.  For each .mod__extender span, walks up to the
   * nearest .mod container to read data-acronym from the sibling .mod__icon,
   * then delegates to shouldShowScoreboardModSpeedIndicator.  Only DT/NC/HT/DC
   * extenders are considered — DA difficulty-adjust extenders (e.g. "AR9") are
   * intentionally ignored.  Works for both native osu-web rows and our injected
   * rows; neither requires the .beatmap-scoreboard-mod wrapper class.
   * Idempotent DOM writes; clears stale RATE_EDIT_ROW_ATTR on native rows only
   * so API-built rows are not stripped when DOM parsing misses an extender.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function applyRateEditMarkingToScoreboardRows(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      if (!(row instanceof HTMLElement)) continue;
      if (row.style.display === "none") continue;
      const needs = beatmapScoreboardRowNeedsRateEditMarkFromDom(row);
      const has = row.hasAttribute(RATE_EDIT_ROW_ATTR);
      if (needs) {
        if (!has) row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      } else if (has && !beatmapScoreboardRowIsApiInjectedForRateMarking(row)) {
        row.removeAttribute(RATE_EDIT_ROW_ATTR);
      }
    }
  }

  /**
   * Wildcard / player-lookup merge keeps osu’s native rows in the tbody with
   * `display: none`. Clearing the rate filter must not reveal them.
   * @param {HTMLElement} row
   * @param {HTMLElement} tbody
   * @returns {boolean}
   */
  function beatmapScoreboardNativeRowSuppressedByMergedLeaderboard(row, tbody) {
    if (
      row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) ||
      row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR)
    ) {
      return false;
    }
    return Boolean(
      tbody.querySelector(
        `tr[${WILDCARD_MERGED_ROW_ATTR}], tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`,
      ),
    );
  }

  /**
   * When the setting is on, hides rows marked as custom-rate (`RATE_EDIT_ROW_ATTR`)
   * using inline `display` so sort/rank logic treats them like other hidden rows.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const hide = settings.isEnabled(SCOREBOARD_HIDE_CUSTOM_RATE_SCORES_ID);
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      if (!(row instanceof HTMLElement)) continue;
      const filtered = row.hasAttribute(RATE_EDIT_ROW_HIDDEN_ATTR);
      const isRate = row.hasAttribute(RATE_EDIT_ROW_ATTR);
      if (hide && isRate) {
        if (!filtered) {
          row.setAttribute(RATE_EDIT_ROW_HIDDEN_ATTR, "1");
          row.style.display = "none";
        }
      } else if (filtered) {
        row.removeAttribute(RATE_EDIT_ROW_HIDDEN_ATTR);
        if (beatmapScoreboardNativeRowSuppressedByMergedLeaderboard(row, tbody)) {
          row.style.display = "none";
        } else {
          row.style.display = "";
        }
      }
    }
  }

  /**
   * Shows the in-page “hide custom rate scores” bar only when the table has at
   * least one `RATE_EDIT_ROW_ATTR` row (including rows hidden by that filter).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapRateEditFilterBarVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const wrap = scoreboardRoot.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (!(wrap instanceof HTMLElement)) return;
    const tbody = scoreboardRoot.querySelector(
      "tbody.beatmap-scoreboard-table__body",
    );
    if (!tbody) {
      wrap.hidden = true;
      return;
    }
    const n = tbody.querySelectorAll(
      `tr.beatmap-scoreboard-table__body-row[${RATE_EDIT_ROW_ATTR}]`,
    ).length;
    wrap.hidden = n < 1;
  }

  /**
   * PP decimals, hit-stat header/cell colors, PP column tint, and rate-edit dimming
   * for the main HTML table (native osu-web rows and our API-rendered rows).
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  /**
   * Returns the first visible leaderboard row that is not the original native rank-#1 entry.
   * Returns null when no override is needed (the native panel already shows the correct score).
   * @param {HTMLElement} scoreboardRoot
   * @returns {HTMLTableRowElement | null}
   */
  function getEffectiveBoardTopRow(scoreboardRoot) {
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return null;
    const tbody = table.querySelector("tbody.beatmap-scoreboard-table__body");
    if (!tbody) return null;
    for (const row of tbody.querySelectorAll(
      "tr.beatmap-scoreboard-table__body-row",
    )) {
      if (!(row instanceof HTMLElement) || row.style.display === "none")
        continue;
      // The native rank-#1 row carries `--first` and no OEP-injected attributes.
      // When it is the first visible row the native panel is already correct.
      const isNativeFirst =
        row.classList.contains("beatmap-scoreboard-table__body-row--first") &&
        !row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) &&
        !row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) &&
        !row.hasAttribute(EXTENDED_SCORE_ROW_ATTR);
      if (isNativeFirst) return null;
      return /** @type {HTMLTableRowElement} */ (row);
    }
    return null;
  }

  /**
   * Converts a two-letter country code to the unicode flag SVG filename used by osu-web.
   * @param {string} cc
   * @returns {string|null}
   */
  function _scoreTopFlagFilename(cc) {
    if (!/^[A-Za-z]{2}$/.test(cc || "")) return null;
    const upper = cc.toUpperCase();
    const u1 = (0x1f1e6 + upper.charCodeAt(0) - 65).toString(16);
    const u2 = (0x1f1e6 + upper.charCodeAt(1) - 65).toString(16);
    return `${u1}-${u2}`;
  }

  /**
   * Returns a short relative-time string (e.g. "3mo", "2y") from an ISO timestamp.
   * @param {string} iso
   * @returns {string}
   */
  function _scoreTopRelativeTime(iso) {
    if (!iso) return "";
    try {
      const abs = Math.abs(Date.now() - new Date(iso).getTime());
      if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
      if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
      if (abs < 2_592_000_000) return `${Math.round(abs / 86_400_000)}d`;
      if (abs < 31_536_000_000) return `${Math.round(abs / 2_592_000_000)}mo`;
      return `${Math.round(abs / 31_536_000_000)}y`;
    } catch {
      return "";
    }
  }

  /**
   * Updates a cloned `.beatmap-scoreboard-top__item` with data from a score API object.
   * @param {HTMLElement} item
   * @param {object} score
   * @param {HTMLTableRowElement|null} row - the corresponding rendered row (source of mods HTML)
   */
  function applyApiScoreToTopItem(item, score, row) {
    const uid = score.user?.id ?? score.user_id;
    const username = score.user?.username ?? (uid != null ? String(uid) : "");
    const iso = score.ended_at ?? score.created_at ?? "";
    const ruleset = getBeatmapPageRuleset();
    const cc = String(score.user?.country_code ?? "")
      .trim()
      .toUpperCase();
    const countryName = score.user?.country?.name || cc;

    const scoreId = leaderboardScoreId(score);
    const scoreUrl = scoreId ? `https://osu.ppy.sh/scores/${scoreId}` : "";
    const linkEl = item.querySelector("a.beatmap-score-top__link-container");
    if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;

    const gradeStr =
      typeof score.rank === "string"
        ? score.rank
        : score.rank &&
            typeof score.rank === "object" &&
            typeof score.rank.name === "string"
          ? score.rank.name
          : score.passed === false
            ? "F"
            : "D";
    const rankKey = String(gradeStr).replace(/[^A-Za-z0-9]+/g, "") || "D";
    const gradeDiv = item.querySelector(".score-rank");
    if (gradeDiv)
      gradeDiv.className = `score-rank score-rank--tiny score-rank--${rankKey}`;

    if (uid != null) {
      const userHref = `https://osu.ppy.sh/users/${uid}/${ruleset}`;
      const avatarA = item.querySelector(".beatmap-score-top__avatar a");
      if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
      const avatarSpan = item.querySelector(
        ".beatmap-score-top__avatar span.avatar",
      );
      if (avatarSpan instanceof HTMLElement)
        avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${uid}")`;
      const usernameA = item.querySelector("a.beatmap-score-top__username");
      if (usernameA instanceof HTMLAnchorElement) {
        usernameA.textContent = username;
        usernameA.href = userHref;
        usernameA.dataset.userId = String(uid);
      }
    }

    const achievedTime = item.querySelector(
      ".beatmap-score-top__achieved time",
    );
    if (achievedTime instanceof HTMLElement && iso) {
      achievedTime.setAttribute("datetime", iso);
      achievedTime.setAttribute("title", iso);
      achievedTime.textContent = _scoreTopRelativeTime(iso);
    }

    const countryA = item.querySelector(".beatmap-score-top__flags a");
    if (countryA instanceof HTMLAnchorElement && cc)
      countryA.href = `https://osu.ppy.sh/rankings/${ruleset}/performance?country=${cc}`;
    const flagSpan = item.querySelector(
      ".beatmap-score-top__flags span.flag-country",
    );
    if (flagSpan instanceof HTMLElement && cc) {
      const uni = _scoreTopFlagFilename(cc);
      if (uni)
        flagSpan.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
      flagSpan.title = countryName;
    }

    const rawScore = leaderboardTableScoreNumber(score);
    const scoreStr = Number(rawScore).toLocaleString("en-US");
    const accStr =
      typeof score.accuracy === "number"
        ? `${(score.accuracy * 100).toFixed(2)}%`
        : "";
    const comboStr = `${Number(score.max_combo ?? 0).toLocaleString("en-US")}x`;
    const ppNum =
      score.pp != null && Number.isFinite(Number(score.pp))
        ? Number(score.pp)
        : null;
    const ppStr =
      ppNum != null
        ? Number.isInteger(ppNum)
          ? String(ppNum)
          : ppNum.toFixed(2)
        : null;

    const rowMods = row?.querySelector(".mods") ?? null;

    for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
      const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
      const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
      if (!headerEl || !valueEl) continue;
      const label = headerEl.textContent?.trim() ?? "";
      const labelLow = label.toLowerCase();

      if (labelLow === "total score") {
        valueEl.textContent = scoreStr;
      } else if (labelLow === "accuracy") {
        valueEl.textContent = accStr;
      } else if (labelLow === "max combo") {
        valueEl.textContent = comboStr;
      } else if (labelLow === "pp") {
        if (ppStr != null) {
          valueEl.textContent = ppStr;
        } else {
          valueEl.innerHTML =
            '<span title="pp is not awarded for this score">-</span>';
        }
      } else if (labelLow === "time") {
        if (iso) {
          const t = document.createElement("time");
          t.className = "js-tooltip-time";
          t.setAttribute("data-orig-title", iso);
          t.textContent = _scoreTopRelativeTime(iso);
          valueEl.replaceChildren(t);
        }
      } else if (labelLow === "mods") {
        if (rowMods) {
          const modsValueEl =
            stat.querySelector(".beatmap-score-top__stat-value--mods") ??
            valueEl;
          const existing = modsValueEl.querySelector(".mods");
          const clone = rowMods.cloneNode(true);
          if (existing) existing.replaceWith(clone);
          else modsValueEl.appendChild(clone);
        }
      } else {
        valueEl.textContent = hitstatTextFromHeaderLabel(label, score);
      }
    }
  }

  /**
   * Updates a cloned `.beatmap-scoreboard-top__item` using data read from a native DOM row.
   * Used when custom-rate filter hides the native rank-#1 row but no merged leaderboard is active.
   * @param {HTMLElement} item
   * @param {HTMLTableRowElement} row
   */
  function applyNativeRowToTopItem(item, row) {
    const scoreUrl =
      row
        .querySelector("a.beatmap-scoreboard-table__cell-content--rank")
        ?.getAttribute("href") ?? "";
    const linkEl = item.querySelector("a.beatmap-score-top__link-container");
    if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;

    const gradeEl = row.querySelector(".score-rank");
    const gradeClass = gradeEl
      ? [...gradeEl.classList].find(
          (c) => c.startsWith("score-rank--") && c !== "score-rank--tiny",
        ) ?? ""
      : "";
    const gradeKey = gradeClass.replace("score-rank--", "");
    if (gradeKey) {
      const gradeDiv = item.querySelector(".score-rank");
      if (gradeDiv)
        gradeDiv.className = `score-rank score-rank--tiny score-rank--${gradeKey}`;
    }

    const usercardEl = row.querySelector("a.js-usercard");
    const userId = usercardEl?.dataset?.userId ?? "";
    const username = usercardEl?.textContent?.trim() ?? "";
    const ruleset = getBeatmapPageRuleset();
    if (userId) {
      const userHref = `https://osu.ppy.sh/users/${userId}/${ruleset}`;
      const avatarA = item.querySelector(".beatmap-score-top__avatar a");
      if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
      const avatarSpan = item.querySelector(
        ".beatmap-score-top__avatar span.avatar",
      );
      if (avatarSpan instanceof HTMLElement)
        avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${userId}")`;
      const usernameA = item.querySelector("a.beatmap-score-top__username");
      if (usernameA instanceof HTMLAnchorElement) {
        usernameA.textContent = username;
        usernameA.href = userHref;
        usernameA.dataset.userId = userId;
      }
    }

    const rowFlagSpan = row.querySelector("span.flag-country");
    const rowCountryA = row.querySelector(
      'a[href*="/rankings/"][href*="country="]',
    );
    const countryA = item.querySelector(".beatmap-score-top__flags a");
    if (countryA instanceof HTMLAnchorElement && rowCountryA) {
      const href = rowCountryA.getAttribute("href") ?? "";
      if (href) countryA.href = href;
    }
    const itemFlagSpan = item.querySelector(
      ".beatmap-score-top__flags span.flag-country",
    );
    if (itemFlagSpan instanceof HTMLElement && rowFlagSpan) {
      const bgStyle = rowFlagSpan.getAttribute("style") ?? "";
      const bgMatch = bgStyle.match(/url\((['"]?)(.*?)\1\)/);
      if (bgMatch)
        itemFlagSpan.style.backgroundImage = `url('${bgMatch[2]}')`;
      itemFlagSpan.title = rowFlagSpan.title;
    }

    const scoreValEl = item.querySelector(
      ".beatmap-score-top__stat-value--score",
    );
    if (scoreValEl) {
      const scoreVal =
        row
          .querySelector("a.beatmap-scoreboard-table__cell-content--score")
          ?.textContent?.trim() ?? "";
      if (scoreVal) scoreValEl.textContent = scoreVal;
    }

    let accuracy = "";
    for (const a of row.querySelectorAll(
      ".beatmap-scoreboard-table__cell-content",
    )) {
      const t = a.textContent?.trim();
      if (t && t.endsWith("%")) {
        accuracy = t;
        break;
      }
    }
    let maxCombo = "";
    for (const a of row.querySelectorAll(
      ".beatmap-scoreboard-table__cell-content",
    )) {
      const t = a.textContent?.trim();
      if (t && /^\d[\d,]*x$/.test(t)) {
        maxCombo = t;
        break;
      }
    }

    const great =
      row
        .querySelector(".oep-score-stats__val--300")
        ?.textContent?.trim() ?? "-";
    const ok =
      row
        .querySelector(".oep-score-stats__val--100")
        ?.textContent?.trim() ?? "-";
    const meh =
      row.querySelector(".oep-score-stats__val--50")?.textContent?.trim() ??
      "-";
    const miss =
      row
        .querySelector(".oep-score-stats__val--miss")
        ?.textContent?.trim() ?? "-";
    const ppText =
      row
        .querySelector(".oep-beatmap-scoreboard-pp-value")
        ?.textContent?.trim() ?? "";
    const timeEl = row.querySelector("time.js-tooltip-time");
    const timeIso = timeEl?.getAttribute("datetime") ?? "";
    const timeText = timeEl?.textContent?.trim() ?? "";
    const rowMods = row.querySelector(".mods");

    const hitMap = new Map([
      ["great", great],
      ["ok", ok],
      ["meh", meh],
      ["miss", miss],
    ]);

    for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
      const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
      const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
      if (!headerEl || !valueEl) continue;
      const labelLow = (headerEl.textContent?.trim() ?? "").toLowerCase();

      if (labelLow === "accuracy" && accuracy) {
        valueEl.textContent = accuracy;
      } else if (labelLow === "max combo" && maxCombo) {
        valueEl.textContent = maxCombo;
      } else if (labelLow === "pp" && ppText) {
        valueEl.textContent = ppText;
      } else if (labelLow === "time" && timeIso) {
        const t = document.createElement("time");
        t.className = "js-tooltip-time";
        t.setAttribute("data-orig-title", timeIso);
        t.textContent = timeText;
        valueEl.replaceChildren(t);
      } else if (labelLow === "mods" && rowMods) {
        const modsValueEl =
          stat.querySelector(".beatmap-score-top__stat-value--mods") ??
          valueEl;
        const existing = modsValueEl.querySelector(".mods");
        const clone = rowMods.cloneNode(true);
        if (existing) existing.replaceWith(clone);
        else modsValueEl.appendChild(clone);
      } else if (hitMap.has(labelLow)) {
        valueEl.textContent = hitMap.get(labelLow) ?? "-";
      }
    }
  }

  /**
   * Syncs the `.beatmap-scoreboard-top__item` panel to match the actual first visible
   * leaderboard row. Called at the end of refreshBeatmapScoreboardTableEnhancements so it
   * responds to all sources of leaderboard change: wildcard merge, player lookup, custom-rate
   * filter, and sort order.
   * @param {HTMLElement} scoreboardRoot
   */
  function refreshBeatmapScoreTopPanel(scoreboardRoot) {
    const nativeItem = scoreboardRoot.querySelector(
      `.beatmap-scoreboard-top__item:not([${SCORE_TOP_OVERRIDE_ATTR}])`,
    );
    if (!(nativeItem instanceof HTMLElement)) return;
    const parent = nativeItem.parentElement;
    if (!parent) return;

    // Remove any previously inserted override panel.
    for (const old of parent.querySelectorAll(
      `[${SCORE_TOP_OVERRIDE_ATTR}]`,
    )) {
      old.remove();
    }

    const topRow = getEffectiveBoardTopRow(scoreboardRoot);
    if (!topRow) {
      nativeItem.style.display = "";
      return;
    }

    nativeItem.style.display = "none";

    const overrideItem = /** @type {HTMLElement} */ (nativeItem.cloneNode(true));
    overrideItem.setAttribute(SCORE_TOP_OVERRIDE_ATTR, "1");

    const score = _rowScoreMap.get(topRow);
    if (score) {
      applyApiScoreToTopItem(overrideItem, score, topRow);
    } else {
      applyNativeRowToTopItem(overrideItem, topRow);
    }

    parent.insertBefore(overrideItem, nativeItem);
  }

  function refreshBeatmapScoreboardTableEnhancements(scoreboardRoot) {
    syncBeatmapScoreboardPpDecimals(scoreboardRoot);
    syncBeatmapScoreboardHitstatColors(scoreboardRoot);
    syncBeatmapScoreboardPpValueColor(scoreboardRoot);
    applyRateEditMarkingToScoreboardRows(scoreboardRoot);
    syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot);
    applyBeatmapScoreboardLeaderboardSort(scoreboardRoot);
    syncBeatmapScoreboardHeaderSortUi(scoreboardRoot);
    syncBeatmapRateEditFilterBarVisibility(scoreboardRoot);
    refreshBeatmapScoreTopPanel(scoreboardRoot);
  }

  /**
   * React injects leaderboard rows after first paint (and re-injects on every mod change /
   * difficulty switch). Re-apply styling whenever actual scoreboard body rows are added.
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapScoreboardTableEnhancementsLive(pathRe) {
    let debounceTimer = 0;
    let refreshRunning = false;
    let pendingRefresh = false;
    const run = () => {
      debounceTimer = 0;
      if (!pathRe.test(location.pathname)) return;
      if (refreshRunning) {
        pendingRefresh = true;
        return;
      }
      refreshRunning = true;
      try {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      } finally {
        refreshRunning = false;
        if (pendingRefresh) {
          pendingRefresh = false;
          schedule();
        }
      }
    };
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 32);
    };

    const containsScoreRow = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.classList.contains("beatmap-scoreboard-table__body-row"))
        return true;
      return node.querySelector(".beatmap-scoreboard-table__body-row") !== null;
    };

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (containsScoreRow(node)) {
            schedule();
            return;
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
    };
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {string} iso
   */
  function applyScoreboardTimeCell(td, refTd, iso) {
    if (!td || !iso) return;
    const timeEl = td.querySelector("time");
    const refTime = refTd?.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return;
    timeEl.setAttribute("datetime", iso);
    timeEl.textContent = formatScoreboardShortAgo(iso);
    if (refTime) {
      timeEl.className = refTime.className;
      timeEl.setAttribute("title", new Date(iso).toISOString());
    }
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} user
   * @param {string} ruleset
   */
  function applyScoreboardFlagCell(td, refTd, user, ruleset) {
    if (!td) return;
    const code = String(user?.country_code || "")
      .trim()
      .toUpperCase();
    const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    if (!(a instanceof HTMLAnchorElement)) return;
    const refA = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (refA) a.className = refA.className;
    if (!code) {
      a.replaceChildren();
      a.removeAttribute("href");
      return;
    }
    a.href = `https://osu.ppy.sh/rankings/${encodeURIComponent(ruleset)}/performance?country=${encodeURIComponent(code)}`;

    // osu-web uses unicode-indicator SVGs for flags.
    // Example: `RU` -> `1f1f7-1f1fa.svg`.
    function toUnicodeFlagFilename(cc) {
      const c = String(cc || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) return null;
      const A = c.charCodeAt(0) - 65;
      const B = c.charCodeAt(1) - 65;
      const u1 = 0x1f1e6 + A;
      const u2 = 0x1f1e6 + B;
      return `${u1.toString(16)}-${u2.toString(16)}`;
    }

    const codeLower = code.toLowerCase();
    const refFlagSpan = refA?.querySelector?.("span.flag-country") ?? null;
    const useSpan = refFlagSpan instanceof HTMLSpanElement;

    const uni = toUnicodeFlagFilename(code);

    if (useSpan) {
      // Existing rows use `span.flag-country` + `background-image`.
      let span = a.querySelector("span.flag-country");
      if (!(span instanceof HTMLSpanElement)) {
        span = document.createElement("span");
      }
      span.className = refFlagSpan.className || span.className;
      if (uni) {
        span.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
      }
      span.title = user?.country?.name || code;
      a.replaceChildren(span);
      return;
    }

    // Fallback: use `<img>` if the template row doesn't use the span method.
    let img = a.querySelector("img");
    const refImg = refA?.querySelector("img") ?? null;
    if (!img) {
      img = document.createElement("img");
      if (refImg) img.className = refImg.className;
    } else if (refImg && !img.className) {
      img.className = refImg.className;
    }
    a.replaceChildren(img);

    if (uni) {
      img.src = `/assets/images/flags/${uni}.svg`;
    } else {
      // Fallback to osu! flag PNGs if the country code is invalid.
      let flagsFolder = "flags";
      const refSrc =
        refImg?.getAttribute("src") ||
        refImg?.getAttribute("data-src") ||
        refImg?.src ||
        "";
      const m =
        typeof refSrc === "string"
          ? refSrc.match(/assets\.ppy\.sh\/([^\/]+)\/[A-Za-z0-9]{1,3}\.png/i)
          : null;
      if (m?.[1]) flagsFolder = m[1];
      else if (typeof refSrc === "string") {
        if (/\/old-flags\//i.test(refSrc)) flagsFolder = "old-flags";
        else if (/\/flags\//i.test(refSrc)) flagsFolder = "flags";
      }
      img.src = `https://assets.ppy.sh/${flagsFolder}/${codeLower}.png`;
    }

    img.alt = code;
    img.title = user?.country?.name || code;

    // SVG flags should already have correct sizing in osu-web CSS; avoid
    // overriding unless we had to use PNG fallback.
    if (!uni) {
      img.style.maxWidth = "2.25em";
      img.style.maxHeight = "1.15em";
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.verticalAlign = "middle";
    }
  }

  /**
   * @param {string} acronym
   * @returns {string}
   */
  function modFullName(acronym) {
    const a = String(acronym || "")
      .trim()
      .toUpperCase();
    if (!a) return "";

    // Lazer mod names (used for hover tooltips).
    const map = {
      EZ: "Easy",
      NF: "No Fail",
      HT: "Half Time",
      DC: "Daycore",
      NR: "No Release",

      HR: "Hard Rock",
      SD: "Sudden Death",
      PF: "Perfect",
      DT: "Double Time",
      NC: "Nightcore",
      FI: "Fade In",
      HD: "Hidden",
      CO: "Cover",
      FL: "Flashlight",
      BL: "Blinds",
      ST: "Strict Tracking",
      AC: "Accuracy Challenge",

      AT: "Autoplay",
      CN: "Cinema",
      RX: "Relax",
      AP: "Autopilot",
      SO: "Spun Out",

      TP: "Target Practice",
      DA: "Difficulty Adjust",
      CL: "Classic",
      RD: "Random",
      MR: "Mirror",
      AL: "Alternate",
      SW: "Swap",
      SG: "Single Tap",
      IN: "Invert",
      CS: "Constant Speed",
      HO: "Hold Off",

      TR: "Transform",
      WG: "Wiggle",
      SI: "Spin In",
      GR: "Grow",
      DF: "Deflate",
      WU: "Wind Up",
      WD: "Wind Down",
      TC: "Traceable",
      BR: "Barrel Roll",
      AD: "Approach Different",
      FF: "Floating Fruits",
      MU: "Muted",
      NS: "No Scope",
      MG: "Magnetised",
      RP: "Repel",
      AS: "Adaptive Speed",
      FR: "Freeze Frame",
      BU: "Bubbles",
      SY: "Synesthesia",
      DP: "Depth",
      BM: "Bloom",

      SV2: "Score V2",
      TD: "Touch Device",
    };

    // Key mods are 1K..10K.
    if (/^[1-9]K$/.test(a) || /^10K$/.test(a)) {
      const n = Number(a.slice(0, -1));
      return `${n} Key Mod`;
    }

    return map[a] ?? a;
  }

  /**
   * @param {number} speedChange
   * @returns {string}
   */
  function formatScoreboardModSpeedRate(speedChange) {
    const x = Number(speedChange);
    if (!Number.isFinite(x) || x <= 0) return "";
    const rounded = Math.round(x * 100) / 100;
    let t = String(rounded);
    if (t.includes(".")) t = t.replace(/\.?0+$/, "");
    return `${t}×`;
  }

  const SCOREBOARD_MOD_DEFAULT_SPEED_UP = 1.5;
  const SCOREBOARD_MOD_DEFAULT_SPEED_DOWN = 0.75;
  const SCOREBOARD_MOD_SPEED_EPS = 0.005;

  /**
   * Show rate only when API sends `speed_change` and it differs from osu defaults
   * (1.5× DT/NC, 0.75× HT/DC).
   * @param {string} acronym
   * @param {number} speed
   * @returns {boolean}
   */
  function shouldShowScoreboardModSpeedIndicator(acronym, speed) {
    if (!Number.isFinite(speed) || speed <= 0) return false;
    const ac = String(acronym || "")
      .trim()
      .toUpperCase();
    if (ac === "HT" || ac === "DC") {
      return (
        Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_DOWN) >
        SCOREBOARD_MOD_SPEED_EPS
      );
    }
    if (ac === "DT" || ac === "NC") {
      return (
        Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
        SCOREBOARD_MOD_SPEED_EPS
      );
    }
    return (
      Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
      SCOREBOARD_MOD_SPEED_EPS
    );
  }

  /**
   * @param {unknown} mod  API mod object with optional `settings.speed_change`
   * @returns {number}  finite speed, or NaN if absent
   */
  function speedChangeFromScoreMod(mod) {
    if (mod == null || typeof mod !== "object") return NaN;
    const sc = /** @type {{ settings?: { speed_change?: unknown } }} */ (mod)
      .settings?.speed_change;
    const x = Number(sc);
    return Number.isFinite(x) && x > 0 ? x : NaN;
  }

  /**
   * Returns true when the score contains a mod whose speed_change differs from
   * that mod's default rate (1.50× for DT/NC, 0.75× for HT/DC, 1.00× otherwise).
   * @param {object} score
   * @returns {boolean}
   */
  function scoreHasNonstandardRate(score) {
    const mods = /** @type {unknown[]} */ (score?.mods ?? []);
    for (const m of mods) {
      const ac =
        typeof m === "string"
          ? m
          : /** @type {{ acronym?: unknown }} */ (m)?.acronym;
      const spd = speedChangeFromScoreMod(m);
      if (
        Number.isFinite(spd) &&
        shouldShowScoreboardModSpeedIndicator(String(ac ?? ""), spd)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} btn
   * @param {string} acronym
   * @param {{ speedChange?: number }|undefined} [opts]
   */
  function patchBeatmapScoreboardModButton(btn, acronym, opts) {
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    mi?.stripOepModAcronymFromClonedMod?.(btn);
    btn.removeAttribute("data-oep-mod-hidden");
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const full = modFullName(acronym);
    const icon = btn.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const modRoot =
      btn.querySelector?.(".mod") ??
      (icon instanceof HTMLElement ? icon.closest?.(".mod") : null) ??
      btn.closest?.(".mod") ??
      null;
    const typeClass =
      mi?.modTypeClassForAcronym?.(acronym) || "mod--type-Automation";
    // osu-web controls mod background color via CSS vars on the ancestor
    // element that has `mod--type-*` (the element that `icon.closest('.mod')`
    // finds, not necessarily `btn` itself).
    /** @type {HTMLElement[]} */
    const targets = [];
    const push = (el) => {
      if (el instanceof HTMLElement && !targets.includes(el)) targets.push(el);
    };
    push(btn);
    push(btn.closest?.(".mod") ?? null);
    push(icon instanceof HTMLElement ? icon.closest(".mod") : null);
    push(btn.querySelector?.(".mod") ?? null);

    for (const target of targets) {
      // Remove any existing mod tone classes.
      for (const cls of [...target.classList]) {
        if (/^mod--type-/i.test(cls)) target.classList.remove(cls);
      }
      target.classList.add(typeClass);
    }

    // Mirror `user-profile` patch: strip hover/extra UI remnants; re-add extender for custom rate.
    btn.querySelector(".mod__extender")?.remove();
    btn.querySelector(".mod__customised-indicator")?.remove();
    const sc = opts?.speedChange;
    const showRate =
      Number.isFinite(sc) && shouldShowScoreboardModSpeedIndicator(acronym, sc);
    const rateStr = showRate ? formatScoreboardModSpeedRate(sc) : "";
    const fullLabel = rateStr ? `${full} (${rateStr})` : full;
    const modInner =
      (btn.querySelector(".mod") instanceof HTMLElement
        ? btn.querySelector(".mod")
        : modRoot) ?? btn;
    if (rateStr && modInner instanceof HTMLElement) {
      const ext = document.createElement("div");
      ext.className = "mod__extender";
      const sp = document.createElement("span");
      sp.textContent = rateStr;
      ext.appendChild(sp);
      const iconEl = modInner.querySelector(".mod__icon");
      if (iconEl instanceof HTMLElement) {
        iconEl.insertAdjacentElement("afterend", ext);
      } else {
        modInner.appendChild(ext);
      }
    }
    btn.title = fullLabel;
    btn.setAttribute("aria-label", fullLabel);
    btn.setAttribute("data-original-title", fullLabel);
    btn.setAttribute("data-qtip", fullLabel);
    btn.setAttribute("data-tooltip", fullLabel);
    if (modRoot instanceof HTMLElement) {
      modRoot.title = fullLabel;
      // osu-web's tooltip is wired to the inner `.mod` element via `data-orig-title`.
      // (In the native DOM: `.mod` has `data-orig-title="Easy"` even when the button
      // wrapper has the correct `data-qtip`.)
      modRoot.setAttribute("data-orig-title", fullLabel);
    }
    if (icon instanceof HTMLElement) {
      icon.title = fullLabel;
      icon.setAttribute("aria-label", fullLabel);
      icon.setAttribute("data-original-title", fullLabel);
      icon.setAttribute("data-qtip", fullLabel);
      icon.setAttribute("data-tooltip", fullLabel);
    }

    // Prevent selection-actions (filtering) but allow hover/tooltips.
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );

    // Make it render as "enabled" so osu-web doesn't dim it when not hovered.
    btn.classList.add("beatmap-scoreboard-mod--enabled");
  }

  /**
   * @param {HTMLTableCellElement} td
   * @param {object} score
   * @param {HTMLElement|null} modTemplateBtn  from {@link resolveBeatmapScoreboardModTemplateEl}
   */
  function applyScoreboardModsCell(td, score, modTemplateBtn) {
    const wrap = td.querySelector(".beatmap-scoreboard-table__mods");
    if (!wrap) return;
    wrap.replaceChildren();
    const list = score.mods || [];
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    if (modTemplateBtn instanceof HTMLElement) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const btn = /** @type {HTMLElement} */ (modTemplateBtn.cloneNode(true));
        const spd = speedChangeFromScoreMod(m);
        patchBeatmapScoreboardModButton(
          btn,
          ac,
          Number.isFinite(spd) && shouldShowScoreboardModSpeedIndicator(ac, spd)
            ? { speedChange: spd }
            : undefined,
        );
        wrap.appendChild(btn);
      }
    } else if (list.length) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        const typeClass =
          mi?.modTypeClassForAcronym?.(ac) || "mod--type-Automation";
        let full = modFullName(ac);
        const spd = speedChangeFromScoreMod(m);
        const showRate =
          Number.isFinite(spd) &&
          shouldShowScoreboardModSpeedIndicator(ac, spd);
        const rateStr = showRate ? formatScoreboardModSpeedRate(spd) : "";
        if (rateStr) full = `${full} (${rateStr})`;
        const iconEl = el("div", {
          class: `mod__icon mod__icon--${safe}`,
          "data-acronym": ac,
          title: full,
          "aria-label": full,
          "data-original-title": full,
          "data-qtip": full,
          "data-tooltip": full,
        });
        const modInnerKids = [iconEl];
        if (rateStr) {
          modInnerKids.push(
            el("div", { class: "mod__extender" }, el("span", {}, rateStr)),
          );
        }
        const modEl = /** @type {HTMLElement} */ (
          el(
            "div",
            {
              class: `beatmap-scoreboard-mod mod ${typeClass} beatmap-scoreboard-mod--enabled`,
              title: full,
              "aria-label": full,
              "data-original-title": full,
              "data-qtip": full,
              "data-tooltip": full,
            },
            ...modInnerKids,
          )
        );
        modEl.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          true,
        );
        wrap.appendChild(modEl);
      }
    }
  }

  /**
   * Map `<thead><th>` modifiers to column indices (same order as `<tbody>` cells).
   * Heuristics alone mis-detect **score** when hit-stat columns contain large counts.
   * @param {HTMLTableRowElement} templateRow
   * @param {HTMLTableElement} table
   * @returns {{ rank: number|null, grade: number|null, score: number|null, pp: number|null, accuracy: number|null, flag: number|null, user: number|null, combo: number|null, mods: number|null, time: number|null, hitstatIndices: number[] }}
   */
  function buildBeatmapScoreboardColumnMap(templateRow, table) {
    const ths = [...table.querySelectorAll("thead th")];
    const idx = (mod) => {
      const suf = `__header--${mod}`;
      const th = ths.find((t) => [...t.classList].some((c) => c.endsWith(suf)));
      return th instanceof HTMLTableCellElement ? th.cellIndex : null;
    };

    /**
     * Try to infer the hitstat "label" (great/ok/meh/miss or 300/100/50/miss)
     * from whatever markup osu-web uses (text, aria-label, classes, etc).
     * @param {HTMLTableCellElement} th
     * @returns {string}
     */
    function inferHitstatLabelFromTh(th) {
      const textTrim = String(th.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const parts = [
        th.getAttribute("aria-label"),
        th.getAttribute("title"),
        th.textContent,
        th.className,
      ].filter((x) => typeof x === "string" && x.trim().length > 0);

      const raw = parts.join(" ").toLowerCase();
      if (!raw) return "";

      const hasWord = (w) =>
        new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(raw);

      // Prefer explicit words first (more stable than matching digits).
      if (hasWord("miss") || hasWord("m")) return "miss";
      if (hasWord("meh")) return "meh";
      // Mania columns (osu-web: PERFECT / GOOD).
      if (hasWord("perfect")) return "mania_perfect";
      if (hasWord("good")) return "mania_good";
      if (hasWord("katu") || hasWord("200")) return "katu";
      if (hasWord("ok")) return "ok";
      if (hasWord("geki") || hasWord("320") || hasWord("max")) return "geki";
      if (hasWord("great")) return "great";

      // CTB: terse headers "L" / "DRP" (large tick vs droplet); gate "L" to fruits only.
      const fruits = getBeatmapPageRuleset() === "fruits";
      if (fruits && /^l$/i.test(textTrim)) return "ctb_l";
      if (/^drp$/i.test(textTrim) || hasWord("drp")) return "ctb_drp";

      // Fall back to numeric digits if osu-web doesn't include words.
      if (/(^|[^0-9])300([^0-9]|$)/.test(raw)) return "300";
      if (/(^|[^0-9])100([^0-9]|$)/.test(raw)) return "100";
      if (/(^|[^0-9])50([^0-9]|$)/.test(raw)) return "50";

      return textTrim;
    }

    /** @type {number[]} */
    const hitstatIndices = [];
    /** @type {Record<number, string>} */
    const hitstatLabelsByIndex = {};
    ths.forEach((th, i) => {
      // osu-web uses `hitstat`-related header classes but the exact class
      // token isn't consistent across themes/skins, so match by substring.
      const isHitstat =
        [...th.classList].some(
          (c) => c === "hitstat" || c.includes("hitstat"),
        ) || th.className.includes("hitstat");
      if (isHitstat) {
        const cellIndex = th.cellIndex;
        hitstatIndices.push(cellIndex);
        hitstatLabelsByIndex[cellIndex] = inferHitstatLabelFromTh(th);
      }
    });

    /** @type {Record<string, number|null>} */
    const map = {
      rank: idx("rank"),
      grade: idx("grade"),
      score: idx("score"),
      accuracy: idx("accuracy"),
      flag: idx("flag"),
      user: idx("player"),
      combo: idx("maxcombo"),
      pp: idx("pp"),
      time: idx("time"),
      mods: idx("mods"),
    };

    if (map.rank == null) map.rank = 0;
    if (map.grade == null) map.grade = 1;

    const tds = [...templateRow.querySelectorAll("td")];
    if (map.user == null) {
      const i = tds.findIndex((td) =>
        td.querySelector?.(
          "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
        ),
      );
      if (i >= 0) map.user = i;
    }
    if (map.time == null) {
      const i = tds.findIndex((td) => td.querySelector?.("time"));
      if (i >= 0) map.time = i;
    }
    if (map.mods == null) {
      const i = tds.findIndex((td) =>
        td.querySelector?.(".beatmap-scoreboard-table__mods"),
      );
      if (i >= 0) map.mods = i;
    }

    return { ...map, hitstatIndices, hitstatLabelsByIndex };
  }

  /**
   * @param {string} labelRaw  from `<th>` (hit-stat short label)
   * @param {object|null|undefined} score  full API score (statistics + legacy fields)
   */
  function hitstatTextFromHeaderLabel(labelRaw, score) {
    const statsSource =
      score?.statistics && typeof score.statistics === "object"
        ? score.statistics
        : score && typeof score === "object"
          ? score
          : {};

    const pick = (...keys) => {
      for (const k of keys) {
        const v = statsSource?.[k];
        if (v != null && v !== "" && Number.isFinite(Number(v)))
          return String(v);
      }
      return "0";
    };

    const hasLazer =
      statsSource?.great != null ||
      statsSource?.perfect != null ||
      statsSource?.ok != null ||
      statsSource?.meh != null ||
      statsSource?.miss != null;

    const n300 = hasLazer
      ? Number(statsSource?.great ?? 0) + Number(statsSource?.perfect ?? 0)
      : statsSource?.count_300 != null
        ? Number(statsSource.count_300)
        : statsSource?.count300 != null
          ? Number(statsSource.count300)
          : Number(statsSource?.count_geki ?? statsSource?.countgeki ?? 0);
    const n100 = hasLazer
      ? Number(statsSource?.ok ?? 0)
      : Number(statsSource?.count_100 ?? statsSource?.count100 ?? 0);
    const n50 = hasLazer
      ? Number(statsSource?.meh ?? 0)
      : Number(statsSource?.count_50 ?? statsSource?.count50 ?? 0);
    const nMiss = hasLazer
      ? Number(statsSource?.miss ?? 0)
      : Number(statsSource?.count_miss ?? statsSource?.countmiss ?? 0);

    const lab = String(labelRaw).trim().toLowerCase();

    // osu standard: prefer exact numeric hit counts.
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return String(nMiss);

    if (lab === "mania_perfect")
      return pick("count_geki", "countgeki", "perfect", "great");
    if (lab === "mania_good")
      return pick("count_katu", "countkatu", "good", "great");

    if (
      lab === "ctb_l" ||
      (lab === "l" && getBeatmapPageRuleset() === "fruits")
    )
      return pick("large_tick_hit", "large_bonus");
    if (lab === "ctb_drp" || lab === "drp")
      return pick("small_tick_hit", "small_bonus");

    // Order matters: mania uses `320` and it contains `300`.
    if (lab === "geki" || lab === "max" || lab === "320")
      return pick("count_geki", "countgeki", "perfect", "great");

    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return String(n300);

    if (lab === "katu" || lab === "200")
      return pick("count_katu", "countkatu", "good", "great");

    if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok")
      return String(n100);

    if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") return String(n50);

    if (lab.includes("tick") || lab === "tail")
      return pick(
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
        "large_tick_miss",
      );

    return "0";
  }

  /**
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {HTMLTableCellElement|null|undefined} refTd
   * @param {object} score
   */
  function applyScoreboardGradeCell(td, refTd, score) {
    if (!td) return;
    const r =
      typeof score.rank === "string"
        ? score.rank
        : score.rank &&
            typeof score.rank === "object" &&
            typeof score.rank.name === "string"
          ? score.rank.name
          : score.passed === false
            ? "F"
            : "D";
    // osu-web rank classes use the API rank casing (e.g. `XH`, `SH`, `F`).
    const rankKey = String(r).replace(/[^A-Za-z0-9]+/g, "") || "D";
    const link = td.querySelector("a.beatmap-scoreboard-table__cell-content");
    const refLink = refTd?.querySelector(
      "a.beatmap-scoreboard-table__cell-content",
    );
    if (link && refLink) link.className = refLink.className;
    let div = td.querySelector("div.score-rank");
    if (!div && link) {
      div = document.createElement("div");
      link.replaceChildren(div);
    }
    if (div) {
      div.className = `score-rank score-rank--tiny score-rank--${rankKey}`;
    }
  }

  /**
   * @param {HTMLTableRowElement} tr
   * @param {object} score
   * @param {number} oneBasedRank
   * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
   * @param {HTMLTableElement} table
   * @param {HTMLTableRowElement} templateRow
   * @param {HTMLElement|null} modTemplateBtn
   */
  function applyApiScoreToBeatmapScoreRow(
    tr,
    score,
    oneBasedRank,
    colMap,
    table,
    templateRow,
    modTemplateBtn,
    mapFullCombo,
  ) {
    tr.setAttribute(EXTENDED_SCORE_ROW_ATTR, "1");
    _rowScoreMap.set(tr, score);
    // Use real table cell indices (works with colspans and hidden columns).
    const tds = [...tr.cells];
    const uid = score.user?.id ?? score.user_id;
    const username = score.user?.username ?? String(uid);
    const userObj = score.user || { country_code: null, country: null };
    const iso = score.ended_at ?? score.created_at ?? "";
    const ruleset = getBeatmapPageRuleset();

    const rawScore = leaderboardTableScoreNumber(score);
    const scoreStr = Number(rawScore).toLocaleString("en-US");

    const ths = [...table.querySelectorAll("thead th")];

    if (colMap.rank != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.rank],
        scoreboardRefTd(templateRow, colMap.rank),
        `#${oneBasedRank}`,
      );
    }

    if (colMap.grade != null) {
      applyScoreboardGradeCell(
        tds[colMap.grade],
        scoreboardRefTd(templateRow, colMap.grade),
        score,
      );
    }

    if (colMap.score != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.score],
        scoreboardRefTd(templateRow, colMap.score),
        scoreStr,
      );
    }

    if (colMap.accuracy != null) {
      applyScoreboardAccuracyCell(
        tds[colMap.accuracy],
        scoreboardRefTd(templateRow, colMap.accuracy),
        score,
      );
    }

    if (colMap.flag != null) {
      applyScoreboardFlagCell(
        tds[colMap.flag],
        scoreboardRefTd(templateRow, colMap.flag),
        userObj,
        ruleset,
      );
    }

    if (colMap.user != null && tds[colMap.user]) {
      const td = tds[colMap.user];
      const userA =
        td.querySelector("a.beatmap-scoreboard-table__user-link") ||
        td.querySelector('a[href*="/users/"]');
      if (userA) {
        userA.href = `https://osu.ppy.sh/users/${uid}`;
        const label =
          userA.querySelector(".beatmap-scoreboard-table__user-link-text") ||
          userA;
        label.textContent = username;
      }
    }

    if (colMap.combo != null) {
      applyScoreboardComboCell(
        tds[colMap.combo],
        scoreboardRefTd(templateRow, colMap.combo),
        score,
        mapFullCombo,
      );
    }

    for (const i of colMap.hitstatIndices || []) {
      const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
      const refHit = scoreboardRefTd(templateRow, i);
      applyScoreboardTextCellLikeRef(
        tds[i],
        refHit,
        hitstatTextFromHeaderLabel(label, score),
      );
    }

    if (colMap.pp != null && tds[colMap.pp]) {
      applyScoreboardPpCell(
        tds[colMap.pp],
        scoreboardRefTd(templateRow, colMap.pp),
        score,
      );
    }

    if (colMap.time != null && tds[colMap.time] && iso) {
      applyScoreboardTimeCell(
        tds[colMap.time],
        scoreboardRefTd(templateRow, colMap.time),
        iso,
      );
    }

    if (colMap.mods != null && tds[colMap.mods]) {
      applyScoreboardModsCell(tds[colMap.mods], score, modTemplateBtn);
    }
  }

  function removeExtendedApiScoreRows() {
    document
      .querySelectorAll(`tr[${EXTENDED_SCORE_ROW_ATTR}]`)
      .forEach((r) => r.remove());
  }

  /**
   * Read currently enabled mod filters from the scoreboard filter strip.
   * Returns normalized acronyms (e.g. ["HR", "HD"]). "NM" is omitted.
   * @param {HTMLElement} scoreboardRoot
   * @returns {string[]}
   */
  function getActiveBeatmapScoreboardFilterMods(scoreboardRoot) {
    const seen = new Set();

    // Prefer explicit query params when present (osu-web may encode filter state there).
    try {
      const usp = new URLSearchParams(location.search || "");
      const q = [...usp.getAll("mods[]"), ...usp.getAll("mods")];
      for (const raw of q) {
        for (const part of String(raw).split(/[,\s+]+/)) {
          const ac = part.trim().toUpperCase();
          if (ac && ac !== "NM") seen.add(ac);
        }
      }
    } catch (_) {
      void 0;
    }

    const modsRoot = scoreboardRoot.querySelector(
      ".beatmapset-scoreboard__mods",
    );
    if (!(modsRoot instanceof HTMLElement)) return [...seen].sort();
    const enabled = modsRoot.querySelectorAll(
      ".beatmap-scoreboard-mod.beatmap-scoreboard-mod--enabled .mod__icon[data-acronym], .beatmap-scoreboard-mod[aria-pressed='true'] .mod__icon[data-acronym]",
    );
    for (const icon of enabled) {
      const ac = String(icon.getAttribute("data-acronym") || "")
        .trim()
        .toUpperCase();
      if (!ac || ac === "NM") continue;
      seen.add(ac);
    }
    return [...seen].sort();
  }

  function readBeatmapsetJson() {
    const script = qs("#json-beatmapset");
    const raw = script?.textContent?.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * @param {HTMLElement} header  `.beatmapset-header`
   * @returns {HTMLElement|null}
   */
  function findBeatmapsetFavouriteStatSpan(header) {
    const heart = header.querySelector(".beatmapset-header__value .fa-heart");
    return heart?.closest(".beatmapset-header__value") ?? null;
  }

  /**
   * Pink background on the header favourite square when favourited (`fas fa-heart`).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @returns {() => void}
   */
  function startBeatmapsetFavouriteButtonPinkIndicator(header) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    function findFavouriteButton() {
      return buttons.querySelector(
        "button.btn-osu-big--beatmapset-header-square",
      );
    }

    function sync() {
      const btn = findFavouriteButton();
      if (!btn) return;
      const heart = btn.querySelector(".fa-heart");
      const favourited = Boolean(heart?.classList.contains("fas"));
      btn.classList.toggle(BEATMAPSET_FAV_BTN_FAVOURITED_CLASS, favourited);
    }

    sync();

    const mo = new MutationObserver(sync);
    mo.observe(buttons, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mo.disconnect();
      findFavouriteButton()?.classList.remove(
        BEATMAPSET_FAV_BTN_FAVOURITED_CLASS,
      );
    };
  }

  /**
   * Destroy osu-web qtip on the favourite stat (only used when Expert+ replaces it with the API popover).
   * @param {HTMLElement|null} el
   */
  function destroyFavouriteStatQtip(el) {
    destroyOsuWebQtipIfBound(el);
  }

  /**
   * Hover popover on the favourite count (heart) with API `recent_favourites` (avatar + username).
   * Replaces osu! qtip; only used when OAuth client id/secret are set in Expert+ (see auth.isConfigured).
   * @param {HTMLElement} header
   * @param {string} beatmapsetId
   * @param {RegExp} pathRe
   * @param {number|undefined|null} favouriteCount
   * @returns {() => void}
   */
  function setupBeatmapsetFavouriteHoverPopover(
    header,
    beatmapsetId,
    pathRe,
    favouriteCount,
  ) {
    const fc = favouriteCount == null ? NaN : Number(favouriteCount);
    const skipApi = Number.isFinite(fc) && fc <= 0;

    const api = OsuExpertPlus.api;
    /** @type {Promise<object[]>|null} */
    let usersPromise = null;

    const popover = el("div", {
      class: `${ROOT_CLASS}__fav-popover`,
      role: "tooltip",
    });
    const titleEl = el(
      "div",
      { class: `${ROOT_CLASS}__fav-popover-title` },
      "Favourites",
    );
    const scrollEl = el("div", { class: `${ROOT_CLASS}__fav-popover-scroll` });
    popover.appendChild(titleEl);
    popover.appendChild(scrollEl);
    document.body.appendChild(popover);

    /** @param {object} u */
    function recentFavouriteChip(u) {
      const id = u?.id;
      const name = u?.username ?? (id != null ? String(id) : "?");
      if (id == null) {
        return el(
          "span",
          {
            class: `${ROOT_CLASS}__header-fav-chip ${ROOT_CLASS}__header-fav-chip--text`,
          },
          name,
        );
      }
      const rawUrl = u?.avatar_url;
      const avatarUrl =
        typeof rawUrl === "string" && rawUrl.trim()
          ? rawUrl.trim()
          : `https://a.ppy.sh/${id}`;
      const img = el("img", {
        class: `${ROOT_CLASS}__header-fav-avatar`,
        src: avatarUrl,
        alt: "",
        width: "24",
        height: "24",
        loading: "lazy",
        decoding: "async",
      });
      return el(
        "a",
        {
          class: `${ROOT_CLASS}__header-fav-chip`,
          href: `https://osu.ppy.sh/users/${id}`,
        },
        img,
        el("span", { class: `${ROOT_CLASS}__header-fav-name` }, name),
      );
    }

    function loadUsers() {
      if (skipApi) return Promise.resolve(/** @type {object[]} */ ([]));
      usersPromise ??= api
        .getBeatmapset(beatmapsetId, { include: ["recent_favourites"] })
        .then((set) =>
          Array.isArray(set?.recent_favourites) ? set.recent_favourites : [],
        )
        .catch((e) => {
          usersPromise = null;
          throw e;
        });
      return usersPromise;
    }

    function positionPopover(anchor) {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      popover.style.left = "0px";
      popover.style.top = "0px";
      popover.style.transform = "none";
      const pw = popover.offsetWidth;
      const ph = popover.offsetHeight;
      let left = r.right + margin;
      if (left + pw > window.innerWidth - margin)
        left = Math.max(margin, r.left - pw - margin);
      let top = r.top + r.height / 2 - ph / 2;
      top = Math.min(Math.max(margin, top), window.innerHeight - ph - margin);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }

    let showTimer = 0;
    let hideTimer = 0;
    let visible = false;
    /** @type {HTMLElement|null} */
    let boundSpan = null;

    function clearTimers() {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      showTimer = 0;
      hideTimer = 0;
    }

    function hidePopover() {
      clearTimers();
      visible = false;
      popover.classList.remove(`${ROOT_CLASS}__fav-popover--visible`);
      popover.setAttribute("aria-hidden", "true");
    }

    function containsFavOrPopover(node) {
      if (!(node instanceof Node)) return false;
      return (
        (!!boundSpan && boundSpan.contains(node)) || popover.contains(node)
      );
    }

    function scheduleHide() {
      clearTimers();
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        hidePopover();
      }, 350);
    }

    /** @param {HTMLElement} anchor */
    async function showPopover(anchor) {
      clearTimers();
      if (!pathRe.test(location.pathname) || !document.body.contains(header))
        return;
      destroyFavouriteStatQtip(anchor);
      visible = true;
      popover.setAttribute("aria-hidden", "false");
      scrollEl.replaceChildren(
        el(
          "span",
          { class: `${ROOT_CLASS}__header-favouriters-muted` },
          "Loading…",
        ),
      );
      popover.classList.add(`${ROOT_CLASS}__fav-popover--visible`);
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });

      if (skipApi) {
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "No favourites yet.",
          ),
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
        return;
      }

      try {
        const users = await loadUsers();
        if (!pathRe.test(location.pathname) || !visible) return;
        if (!Array.isArray(users) || users.length === 0) {
          scrollEl.replaceChildren(
            el(
              "span",
              { class: `${ROOT_CLASS}__header-favouriters-muted` },
              "No recent favourites to show.",
            ),
          );
        } else {
          scrollEl.replaceChildren();
          for (const u of users) {
            scrollEl.appendChild(recentFavouriteChip(u));
          }
        }
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      } catch {
        if (!visible) return;
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "Could not load favourites.",
          ),
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      }
    }

    /** @param {HTMLElement} anchor */
    function onSpanEnter(anchor) {
      destroyFavouriteStatQtip(anchor);
      clearTimers();
      showTimer = window.setTimeout(() => {
        showTimer = 0;
        void showPopover(anchor);
      }, 110);
    }

    /** @param {HTMLElement} anchor */
    function onSpanLeave(anchor, e) {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      clearTimers();
      scheduleHide();
    }

    /** @param {MouseEvent} e */
    function stopMouseoverBubble(e) {
      e.stopPropagation();
    }

    /** @param {HTMLElement} span */
    /** @type {AbortController|null} */
    let spanAbort = null;

    function bindSpan(span) {
      if (span === boundSpan) return;
      unbindSpan();
      boundSpan = span;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      span.addEventListener("mouseenter", () => onSpanEnter(span), opts);
      span.addEventListener("mouseleave", (e) => onSpanLeave(span, e), opts);
      span.addEventListener("mouseover", stopMouseoverBubble, opts);
      spanAbort = ac;
    }

    function unbindSpan() {
      spanAbort?.abort();
      spanAbort = null;
      if (boundSpan) destroyFavouriteStatQtip(boundSpan);
      boundSpan = null;
    }

    popover.addEventListener("mouseenter", () => {
      clearTimers();
    });
    popover.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      scheduleHide();
    });

    let moDebounce = 0;
    function scheduleTryBind() {
      if (moDebounce) window.clearTimeout(moDebounce);
      moDebounce = window.setTimeout(() => {
        moDebounce = 0;
        if (!document.body.contains(header)) return;
        const span = findBeatmapsetFavouriteStatSpan(header);
        if (span) bindSpan(span);
        else unbindSpan();
      }, 40);
    }

    const mo = new MutationObserver(() => scheduleTryBind());
    mo.observe(header, { childList: true, subtree: true });

    function onWinResize() {
      if (visible && boundSpan) positionPopover(boundSpan);
    }
    window.addEventListener("resize", onWinResize, { passive: true });

    scheduleTryBind();
    window.queueMicrotask(scheduleTryBind);

    return () => {
      if (moDebounce) window.clearTimeout(moDebounce);
      mo.disconnect();
      window.removeEventListener("resize", onWinResize);
      spanAbort?.abort();
      spanAbort = null;
      boundSpan = null;
      clearTimers();
      hidePopover();
      popover.remove();
    };
  }

  /**
   * @param {string|undefined|null} s
   */
  function displayText(s) {
    const t = s == null ? "" : String(s).trim();
    return t.length ? t : null;
  }

  /**
   * @param {string|undefined|null} tagsField
   */
  function parseTags(tagsField) {
    const raw = tagsField == null ? "" : String(tagsField).trim();
    if (!raw) return [];
    return raw.split(/\s+/).filter(Boolean);
  }

  /** Exact string from the beatmap payload (no trim). */
  function rawTagsFromData(tagsField) {
    if (tagsField == null) return "";
    return String(tagsField);
  }

  /**
   * HTML string for the beatmapset description (osu-web embeds rendered BBCode in
   * `description.description`).
   * @param {object|null} data
   * @returns {string|null}
   */
  function beatmapsetDescriptionHtmlFromData(data) {
    if (!data) return null;
    const d = data.description;
    if (d == null) return null;
    const html = typeof d === "string" ? d : d.description;
    if (html == null) return null;
    const s = String(html).trim();
    return s.length ? s : null;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * @param {HTMLElement} toastEl
   */
  function flashCopiedToast(toastEl) {
    toastEl.classList.add(`${ROOT_CLASS}__copied-toast--show`);
    const prev = toastEl.getAttribute("data-oep-toast-timer");
    if (prev) window.clearTimeout(Number(prev));
    const id = window.setTimeout(() => {
      toastEl.classList.remove(`${ROOT_CLASS}__copied-toast--show`);
      toastEl.removeAttribute("data-oep-toast-timer");
    }, 1400);
    toastEl.setAttribute("data-oep-toast-timer", String(id));
  }

  /**
   * @param {typeof el} elFn
   * @param {HTMLElement} parent
   * @param {string} text
   * @param {string} ariaLabel
   */
  function appendCopyButton(elFn, parent, text, ariaLabel) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__copy-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      },
      "Copied",
    );
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__copy-btn`,
      "aria-label": ariaLabel,
      title: "Copy",
    });
    const icon = elFn("i", { class: "fas fa-copy", "aria-hidden": "true" });
    btn.appendChild(icon);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(text).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(btn);
    parent.appendChild(wrap);
  }

  /**
   * @param {typeof el} elFn
   * @param {string} tag
   */
  function buildTagChip(elFn, tag) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__tag-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
      },
      "Copied",
    );
    const tagBtn = elFn(
      "button",
      {
        type: "button",
        class: `${ROOT_CLASS}__tag`,
        title: "Click to copy this tag",
        "aria-label": `Copy tag "${tag}"`,
      },
      tag,
    );
    tagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(tag).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(tagBtn);
    return wrap;
  }

  /**
   * @param {object|null} data
   * @param {typeof el} elFn
   */
  function buildModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid).",
      );
    }

    const frag = document.createDocumentFragment();

    const rows = [
      { label: "Title", value: displayText(data.title) },
      { label: "Title (Unicode)", value: displayText(data.title_unicode) },
      { label: "Artist", value: displayText(data.artist) },
      { label: "Artist (Unicode)", value: displayText(data.artist_unicode) },
      { label: "Source", value: displayText(data.source) },
    ];

    rows.forEach(({ label, value }) => {
      const row = elFn("div", { class: `${ROOT_CLASS}__row` });
      row.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, label));
      const valueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
      valueCell.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value${value ? "" : ` ${ROOT_CLASS}__value--muted`}`,
          },
          value || "—",
        ),
      );
      if (value) {
        appendCopyButton(elFn, valueCell, value, `Copy ${label} to clipboard`);
      }
      row.appendChild(valueCell);
      frag.appendChild(row);
    });

    const tagRow = elFn("div", { class: `${ROOT_CLASS}__row` });
    tagRow.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, "Tags"));
    const tagValueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
    const tags = parseTags(data.tags);
    const rawTags = rawTagsFromData(data.tags);
    if (tags.length) {
      const tagsWrap = elFn("div", { class: `${ROOT_CLASS}__tags` });
      tags.forEach((tag) => {
        tagsWrap.appendChild(buildTagChip(elFn, tag));
      });
      tagValueCell.appendChild(tagsWrap);
      if (rawTags.length > 0) {
        appendCopyButton(
          elFn,
          tagValueCell,
          rawTags,
          "Copy all tags (original string) to clipboard",
        );
      }
    } else {
      tagValueCell.appendChild(
        elFn(
          "p",
          { class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted` },
          "—",
        ),
      );
    }
    tagRow.appendChild(tagValueCell);
    frag.appendChild(tagRow);

    return frag;
  }

  /**
   * Bind spoiler toggles for BBCode rendered HTML.
   *
   * osu!web wires spoiler interactivity for descriptions already present in the DOM.
   * Our modal injects BBCode HTML dynamically, so those click handlers may not be attached.
   * This provides a lightweight fallback that toggles commonly-used spoiler structures.
   * @param {HTMLElement} root
   */
  function bindBbcodeSpoilers(root) {
    if (!root) return;

    // Target spoiler "content" nodes. We intentionally keep this broad because
    // class names can change across osu-web versions.
    const contentSel = [
      "[data-spoiler-content]",
      '[class*="spoiler" i][class*="content" i]',
      '[class*="spoiler" i][class*="body" i]',
      ".spoiler-content",
      ".spoiler__content",
      ".bbcode-spoiler__content",
      ".bbcode__spoiler-content",
    ].join(",");

    const contentEls = Array.from(root.querySelectorAll(contentSel));
    if (contentEls.length === 0) return;

    // Build a container->content map. We prefer a spoiler-ish ancestor above
    // the content node itself so trigger links/buttons can be discovered reliably.
    /** @type {Map<HTMLElement, HTMLElement[]>} */
    const containerToContents = new Map();
    for (const contentEl of contentEls) {
      let container = contentEl.closest('[class*="spoiler" i]');
      if (container === contentEl) {
        container =
          contentEl.parentElement?.closest('[class*="spoiler" i]') ??
          contentEl.parentElement;
      }
      if (!container) continue;
      const arr = containerToContents.get(container) ?? [];
      arr.push(contentEl);
      containerToContents.set(container, arr);
    }

    const triggerSel = [
      "summary",
      "button",
      '[role="button"]',
      "[data-spoiler-toggle]",
      '[class*="spoiler" i][class*="title" i]',
      '[class*="spoiler" i][class*="trigger" i]',
      '[class*="spoiler" i][class*="toggle" i]',
      '[class*="spoiler" i][class*="link" i]',
      ".spoiler-title",
      ".spoiler__title",
      ".spoiler-toggle",
      ".spoiler__toggle",
      ".bbcode-spoiler__title",
      ".bbcode__spoiler-title",
      ".bbcode-spoilerbox__link",
    ].join(",");

    const isOpenInitial = (el) => {
      // Some spoiler implementations collapse via `display: none`,
      // others use `max-height: 0` / `height: 0` (still `display: block`).
      // We treat the spoiler as "open" only if it looks render-visible.
      try {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const renderVisible =
          rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden";
        return cs.display !== "none" && renderVisible && cs.opacity !== "0";
      } catch {
        return !el.hidden;
      }
    };

    for (const [container, contents] of containerToContents.entries()) {
      if (!container || container.dataset.oepSpoilersBound === "1") continue;
      container.dataset.oepSpoilersBound = "1";

      for (const contentEl of contents) {
        if (contentEl.dataset.oepSpoilersPrevDisplay != null) continue;
        const inlineDisplay = contentEl.style.display;
        if (inlineDisplay) {
          contentEl.dataset.oepSpoilersPrevDisplay = inlineDisplay;
          continue;
        }
        try {
          const cs = window.getComputedStyle(contentEl);
          if (cs.display && cs.display !== "none")
            contentEl.dataset.oepSpoilersPrevDisplay = cs.display;
        } catch {
          // ignore
        }
      }

      const initiallyOpen = contents.some((c) => isOpenInitial(c));
      container.dataset.oepSpoilersOpen = initiallyOpen ? "1" : "0";

      const triggerEls = Array.from(container.querySelectorAll(triggerSel))
        // Avoid treating the content nodes themselves as triggers.
        .filter((n) => !contents.includes(n));

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nextOpen = container.dataset.oepSpoilersOpen !== "1";
        container.dataset.oepSpoilersOpen = nextOpen ? "1" : "0";

        for (const contentEl of contents) {
          if (nextOpen) {
            contentEl.hidden = false;
            const prev = contentEl.dataset.oepSpoilersPrevDisplay;
            contentEl.style.display = prev && prev !== "none" ? prev : "block";
          } else {
            contentEl.hidden = true;
            contentEl.style.display = "none";
          }
        }
      };

      // If we can't find a likely trigger element, fall back to clicking the container header.
      // (This keeps behavior closer to expectations than doing nothing.)
      if (triggerEls.length) {
        for (const t of triggerEls) t.addEventListener("click", handler);
      } else {
        container.addEventListener("click", (e) => {
          // Only toggle when clicking within the container but not inside a content node.
          const target = /** @type {HTMLElement} */ (e.target);
          if (!target) return;
          if (contents.some((c) => c.contains(target))) return;
          handler(e);
        });
      }

      // Some osu-web spoiler headers are anchors with href="#".
      // Ensure they never trigger page scroll/jump in the modal.
      container.addEventListener("click", (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target) return;
        const anchor = target.closest("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (href === "#") {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  /**
   * @param {object|null} data
   * @param {typeof el} elFn
   */
  function buildDescriptionModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid).",
      );
    }

    const html = beatmapsetDescriptionHtmlFromData(data);
    const wrap = elFn("div", {});

    if (!html) {
      wrap.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted`,
          },
          "No description.",
        ),
      );
      return wrap;
    }

    const toolbar = elFn("div", {
      class: `${ROOT_CLASS}__description-toolbar`,
    });
    const prose = elFn("div", { class: `${ROOT_CLASS}__description-prose` });
    prose.innerHTML = html;
    // Bind spoiler click/toggle behavior for the dynamically-injected BBCode.
    bindBbcodeSpoilers(prose);
    const plainForCopy = prose.innerText.replace(/\s+$/g, "").trim();
    appendCopyButton(
      elFn,
      toolbar,
      plainForCopy.length ? plainForCopy : html.replace(/<[^>]+>/g, " ").trim(),
      "Copy description to clipboard",
    );
    wrap.appendChild(toolbar);
    wrap.appendChild(prose);
    return wrap;
  }

  const DESCRIPTION_BG_SELECTORS = [
    ".beatmapset-description",
    ".beatmapset__description",
    ".beatmapset-info__description",
    ".bbcode--beatmap-description",
    ".bbcode",
  ];

  function resolveDescriptionSectionBackgroundColor() {
    for (const selector of DESCRIPTION_BG_SELECTORS) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const bg = getComputedStyle(node).backgroundColor;
      if (!bg) continue;
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") continue;
      return bg;
    }
    return "hsl(var(--hsl-b4, 333 18% 18%))";
  }

  /**
   * Modal header control: GET `https://osu.ppy.sh/osu/{beatmapId}` for the selected difficulty and show the file in a new tab.
   * @param {typeof el} elFn
   * @param {() => string|null} getBeatmapId
   */
  function buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapId) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__modal-header-osu-wrap` });
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__modal-header-osu-btn`,
      "aria-label": "Open .osu file for current difficulty",
    });
    btn.appendChild(
      elFn("i", { class: "fas fa-file-code", "aria-hidden": "true" }),
    );
    btn.appendChild(document.createTextNode("open .osu"));
    const msgEl = elFn("p", {
      class: `${ROOT_CLASS}__modal-header-osu-msg`,
      "aria-live": "polite",
    });
    wrap.appendChild(btn);
    wrap.appendChild(msgEl);

    let msgResetTimer = 0;
    /**
     * @param {string} msg
     */
    function flashMsg(msg) {
      msgEl.textContent = msg;
      if (msgResetTimer) window.clearTimeout(msgResetTimer);
      msgResetTimer = window.setTimeout(() => {
        msgEl.textContent = "";
        msgResetTimer = 0;
      }, 3200);
    }
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = getBeatmapId();
      if (!id) {
        flashMsg("Could not detect a beatmap id for this page.");
        return;
      }
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const url = `https://osu.ppy.sh/osu/${encodeURIComponent(id)}`;
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) {
          flashMsg(`Could not load .osu (HTTP ${resp.status}).`);
          return;
        }
        const text = await resp.text();
        const blob = new Blob([text], {
          type: "text/plain;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          flashMsg("Popup blocked — allow popups for osu.ppy.sh to view .osu.");
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      } catch (_) {
        flashMsg("Could not load .osu (network error).");
      } finally {
        btn.disabled = false;
      }
    });
    return wrap;
  }

  /**
   * @param {typeof el} elFn
   * @param {string} rootClass
   * @param {object} cfg
   * @param {string} cfg.title
   * @param {string} cfg.titleId
   * @param {string} cfg.buttonText
   * @param {(btn: HTMLButtonElement) => void} cfg.mountButton
   * @param {string} [cfg.buttonIconClass] Font Awesome classes for leading icon (e.g. `fas fa-tags`)
   * @param {boolean} [cfg.primary]
   * @param {string} [cfg.modalExtraClass]
   * @param {string} [cfg.buttonExtraClass] Extra classes on the open button (e.g. compact placement)
   * @param {(elFn: typeof el) => Node|null|undefined} [cfg.buildModalTitleExtra] Shown after the modal title (left header group)
   * @param {() => Node} cfg.buildBody
   */
  function attachBeatmapsetInfoModal(elFn, rootClass, cfg) {
    const {
      title,
      titleId,
      buttonText,
      buttonIconClass = "",
      primary = false,
      modalExtraClass = "",
      buildBody,
      buildModalTitleExtra,
      mountButton,
      buttonExtraClass = "",
    } = cfg;

    const btnClass = `${rootClass}__action-btn${
      primary ? ` ${rootClass}__action-btn--primary` : ""
    }${buttonExtraClass ? ` ${buttonExtraClass}` : ""}`;
    const openBtn = buttonIconClass
      ? elFn(
          "button",
          { type: "button", class: btnClass },
          elFn("i", {
            class: buttonIconClass,
            "aria-hidden": "true",
          }),
          buttonText,
        )
      : elFn("button", { type: "button", class: btnClass }, buttonText);
    mountButton(openBtn);

    const modalPortal = elFn("div", {
      class: `${rootClass}__modal-portal`,
      "aria-hidden": "true",
    });
    const backdrop = elFn("div", { class: `${rootClass}__modal-backdrop` });
    const modal = elFn("div", {
      class: `${rootClass}__modal${
        modalExtraClass ? ` ${modalExtraClass}` : ""
      }`,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    });
    modal.style.background = resolveDescriptionSectionBackgroundColor();
    const modalHeader = elFn("div", { class: `${rootClass}__modal-header` });
    const headerStart = elFn("div", {
      class: `${rootClass}__modal-header-start`,
    });
    headerStart.appendChild(
      elFn("h2", { class: `${rootClass}__modal-title`, id: titleId }, title),
    );
    if (typeof buildModalTitleExtra === "function") {
      const extra = buildModalTitleExtra(elFn);
      if (extra) headerStart.appendChild(extra);
    }
    modalHeader.appendChild(headerStart);
    const closeBtn = elFn(
      "button",
      {
        type: "button",
        class: `${rootClass}__modal-close`,
        "aria-label": "Close",
      },
      "×",
    );
    modalHeader.appendChild(closeBtn);
    modal.appendChild(modalHeader);

    const modalBody = elFn("div", {
      class: `${rootClass}__modal-body u-fancy-scrollbar`,
    });
    modalBody.appendChild(buildBody());
    modal.appendChild(modalBody);

    modalPortal.appendChild(backdrop);
    modalPortal.appendChild(modal);
    document.body.appendChild(modalPortal);

    /** @type {AbortController|null} */
    let modalAbort = null;

    function closeModal() {
      modalPortal.classList.remove(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "true");
      modalAbort?.abort();
      modalAbort = null;
      openBtn.focus();
    }

    function openModal() {
      if (modalPortal.classList.contains(`${rootClass}__modal-portal--open`)) {
        closeBtn.focus();
        return;
      }
      modalAbort?.abort();
      modalAbort = new AbortController();
      const { signal } = modalAbort;

      modalPortal.classList.add(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "false");
      closeBtn.focus();

      const onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
        }
      };
      document.addEventListener("keydown", onKeydown, {
        signal,
        capture: true,
      });

      backdrop.addEventListener(
        "click",
        () => {
          closeModal();
        },
        { signal },
      );
    }

    openBtn.addEventListener("click", () => {
      openModal();
    });
    closeBtn.addEventListener("click", () => {
      closeModal();
    });

    modal.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    return {
      dispose() {
        modalAbort?.abort();
        modalAbort = null;
        modalPortal.remove();
        openBtn.remove();
      },
    };
  }

  function teardownBeatmapDescriptionHeadingLayout(descRow) {
    if (!(descRow instanceof HTMLElement)) return;
    descRow.classList.remove(`${ROOT_CLASS}__description-heading-row`);
    const headWrap = descRow.querySelector(
      `:scope > .${ROOT_CLASS}__description-sticky-head`,
    );
    if (headWrap) {
      const h = headWrap.querySelector(":scope > h3.beatmapset-info__header");
      if (h) descRow.insertBefore(h, headWrap);
      headWrap.remove();
    }
  }

  /**
   * osu!direct / supporter “direct” entry in `.beatmapset-header__buttons`.
   * @param {HTMLElement} buttonsEl
   * @returns {HTMLAnchorElement|null}
   */
  function findBeatmapsetOsuDirectButton(buttonsEl) {
    const links = qsa("a.btn-osu-big", buttonsEl);
    return (
      links.find((a) => {
        const h = a.getAttribute("href") || "";
        return h.startsWith("osu://") || /support-the-game/i.test(h);
      }) ?? null
    );
  }

  /**
   * @param {unknown} n
   * @returns {string|null}  e.g. "#4,212"
   */
  function formatOmdbRankDisplay(n) {
    if (n == null || n === "") return null;
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return `#${x.toLocaleString()}`;
  }

  const OMDB_CHART_PAGE_SIZE = 50;

  /**
   * Charts list ~50 mapsets per page; `p` is 1-based.
   * @param {unknown} rank  1-based chart position
   * @returns {number}
   */
  function omdbChartPageFromRank(rank) {
    const n = Number(rank);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.ceil(n / OMDB_CHART_PAGE_SIZE);
  }

  /**
   * Ranked calendar year for OMDB year-chart links: `ranked_date` from #json-beatmapset first,
   * else a `time.js-tooltip-time` row under `.beatmapset-mapping` whose text includes
   * ranked / qualified / approved (matches osu-web’s BeatmapsetMapping date lines).
   * @param {HTMLElement|null} header  `.beatmapset-header` (optional; narrows `.beatmapset-mapping` query)
   * @returns {number|null}
   */
  function getBeatmapsetRankedCalendarYear(header) {
    const data = readBeatmapsetJson();
    const rankedIso = data?.ranked_date;
    if (rankedIso != null && String(rankedIso).trim() !== "") {
      const y = new Date(String(rankedIso)).getUTCFullYear();
      if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
    }

    const scope =
      (header instanceof HTMLElement
        ? header.querySelector(".beatmapset-mapping")
        : null) ??
      document.querySelector(".beatmapset-mapping") ??
      (header instanceof HTMLElement ? header : null) ??
      document.querySelector(".beatmapset-header");

    if (!(scope instanceof HTMLElement)) return null;

    const times = scope.querySelectorAll("time.js-tooltip-time[datetime]");
    for (const t of times) {
      if (!(t instanceof HTMLTimeElement)) continue;
      const dt = t.getAttribute("datetime");
      if (!dt) continue;
      let walk = t.parentElement;
      while (walk && scope.contains(walk)) {
        const txt = walk.textContent || "";
        if (
          /\branked\b/i.test(txt) ||
          /\bqualified\b/i.test(txt) ||
          /\bapproved\b/i.test(txt)
        ) {
          const y = new Date(dt).getUTCFullYear();
          if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
          break;
        }
        walk = walk.parentElement;
      }
    }
    return null;
  }

  /**
   * Year rank label + chart link use ranked calendar year when known.
   * When both chart ranks are null, still shows `{year} -, overall -`.
   * @param {object} entry
   * @param {number|null} rankedYear
   * @returns {HTMLElement}
   */
  function buildOmdbRanksBlock(entry, rankedYear) {
    const overallHash = formatOmdbRankDisplay(entry.ChartRank);
    const yearHash = formatOmdbRankDisplay(entry.ChartYearRank);
    if (!overallHash && !yearHash) {
      const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
      );
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
      );
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
      );
      return wrap;
    }

    const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
    if (yearHash) {
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
      );
      wrap.appendChild(document.createTextNode(" "));
      if (rankedYear != null) {
        const yearPage = omdbChartPageFromRank(entry.ChartYearRank);
        wrap.appendChild(
          el(
            "a",
            {
              class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
              href: `https://omdb.nyahh.net/charts/?y=${encodeURIComponent(String(rankedYear))}&p=${yearPage}`,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            yearHash,
          ),
        );
      } else {
        wrap.appendChild(
          el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, yearHash),
        );
      }
    }
    if (yearHash && overallHash) {
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
      );
    }
    if (overallHash) {
      const overallPage = omdbChartPageFromRank(entry.ChartRank);
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el(
          "a",
          {
            class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
            href: `https://omdb.nyahh.net/charts/?y=all-time&p=${overallPage}`,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          overallHash,
        ),
      );
    }
    return wrap;
  }

  /**
   * Full ladder 0★ … 5★ in 0.5 steps; missing API keys count as 0.
   * @param {object|undefined} entry
   * @returns {{ score: number, count: number }[]}
   */
  function buildOmdbDistributionRows(entry) {
    if (entry == null) return [];
    /** @type {Map<number, number>} */
    const byScore = new Map();
    const raw = entry.Ratings;
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const score = Number(k);
        const count = Number(v);
        if (!Number.isFinite(score) || !Number.isFinite(count)) continue;
        const key = Math.round(score * 2) / 2;
        if (key < 0 || key > 5) continue;
        byScore.set(key, (byScore.get(key) ?? 0) + count);
      }
    }
    const rows = [];
    for (let i = 0; i <= 10; i++) {
      const score = i * 0.5;
      rows.push({ score, count: byScore.get(score) ?? 0 });
    }
    return rows;
  }

  /**
   * @param {number} score
   */
  function formatOmdbDistScoreLabel(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return String(score);
    const h = Math.round(n * 2) / 2;
    return Number.isInteger(h) ? String(h) : h.toFixed(1);
  }

  /**
   * @param {HTMLElement} popEl
   * @param {{ score: number, count: number }[]} rows
   */
  function fillOmdbDistPopover(popEl, rows) {
    popEl.replaceChildren();
    popEl.appendChild(
      el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-head` }, "Distribution"),
    );
    const maxC = Math.max(1, ...rows.map((r) => r.count));
    for (const { score, count } of rows) {
      const row = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-row` });
      row.appendChild(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__dist-score` },
          `${formatOmdbDistScoreLabel(score)}★`,
        ),
      );
      const track = el("div", {
        class: `${OEP_OMDB_ROW_CLASS}__dist-bar-track`,
      });
      const bar = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-bar` });
      const pct = count <= 0 ? 0 : Math.max(8, (count / maxC) * 100);
      bar.style.width = `${pct}%`;
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__dist-count` },
          String(count),
        ),
      );
      popEl.appendChild(row);
    }
  }

  /**
   * @param {HTMLElement} bodyEl
   * @param {object|undefined} entry
   * @param {{ bindTrigger: (trigger: HTMLElement, rows: { score: number, count: number }[]) => void }|null} [distUi]
   * @param {HTMLElement|null} [header]  `.beatmapset-header` for ranked year from DOM
   * @param {boolean} [difficultyBlacklistedOnOmdb]  Successful set JSON but this beatmap omitted (OMDB blacklist)
   */
  function renderOmdbRatingRowBody(
    bodyEl,
    entry,
    distUi,
    header,
    difficultyBlacklistedOnOmdb,
  ) {
    bodyEl.classList.remove(
      `${OEP_OMDB_ROW_CLASS}__body--muted`,
      `${OEP_OMDB_ROW_CLASS}__body--error`,
    );
    if (difficultyBlacklistedOnOmdb) {
      bodyEl.textContent = "This difficulty is blacklisted on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    if (entry == null) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    const avgN = Number(entry.WeightedAvg);
    const cntN = Number(entry.RatingCount);
    const hasAvg = Number.isFinite(avgN);
    const hasCnt = Number.isFinite(cntN) && cntN > 0;
    const rankedYear = getBeatmapsetRankedCalendarYear(
      header instanceof HTMLElement ? header : null,
    );
    const ranksEl = buildOmdbRanksBlock(entry, rankedYear);
    const distRows = buildOmdbDistributionRows(entry);
    const useDistPopover =
      Boolean(distUi) && distRows.length > 0 && (hasAvg || hasCnt);

    const frag = document.createDocumentFragment();
    let first = true;
    /**
     * @param {Node} node
     */
    function appendChunk(node) {
      if (!first) frag.appendChild(document.createTextNode(" · "));
      first = false;
      frag.appendChild(node);
    }

    if (hasAvg || hasCnt) {
      const statParts = [];
      if (hasAvg) statParts.push(`${avgN.toFixed(2)} avg`);
      if (hasCnt) {
        statParts.push(`${cntN} rating${cntN === 1 ? "" : "s"}`);
      }
      const statText = statParts.join(" · ");
      if (useDistPopover && distUi) {
        const anchor = el("span", {
          class: `${OEP_OMDB_ROW_CLASS}__dist-anchor`,
        });
        const trigger = el(
          "span",
          {
            class: `${OEP_OMDB_ROW_CLASS}__dist-trigger`,
            tabindex: "0",
            title: "Rating breakdown",
          },
          statText,
        );
        anchor.appendChild(trigger);
        distUi.bindTrigger(trigger, distRows);
        appendChunk(anchor);
      } else {
        appendChunk(document.createTextNode(statText));
      }
    }
    if (ranksEl) appendChunk(ranksEl);

    if (first) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    bodyEl.replaceChildren(frag);
  }

  /**
   * @param {object|undefined} entry
   * @returns {number|null}
   */
  function parseOmdbOwnRating(entry) {
    const own = entry?.OwnRating;
    if (own == null || String(own).trim() === "") return null;
    const n = Number(own);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 2) / 2;
  }

  /**
   * @param {HTMLElement[]} units
   * @param {number|null|undefined} score
   */
  function paintOmdbStarUnits(units, score) {
    const s =
      score == null || !Number.isFinite(Number(score))
        ? null
        : Math.round(Number(score) * 2) / 2;
    for (let i = 0; i < 5; i++) {
      const u = units[i];
      const full = i + 1;
      const half = i + 0.5;
      u.classList.remove(
        `${OEP_OMDB_VOTE_CLASS}__unit--full`,
        `${OEP_OMDB_VOTE_CLASS}__unit--half`,
        `${OEP_OMDB_VOTE_CLASS}__unit--empty`,
      );
      if (s == null || s < half) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--empty`);
      } else if (s >= full) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--full`);
      } else {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--half`);
      }
    }
  }

  /**
   * @param {HTMLAnchorElement} anchor
   * @returns {number|null}
   */
  function parseBeatmapIdFromPickerLink(anchor) {
    const href = anchor.getAttribute("href");
    if (!href) return null;
    const m = href.match(/#([a-z]+)\/(\d+)\s*$/i);
    return m ? Number(m[2]) : null;
  }

  /**
   * @param {number} n
   * @returns {string}
   */
  function formatBeatmapsetHeaderStarRatingText(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    const floored = Math.floor(v * 100) / 100;
    return floored.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * @param {number|null|undefined} beatmapId
   * @returns {{ version: string, rating: number|null }}
   */
  function getBeatmapVersionAndRatingForHeader(beatmapId) {
    const data = readBeatmapsetJson();
    if (!data?.beatmaps?.length) return { version: "", rating: null };
    const n = Number(beatmapId);
    if (!Number.isFinite(n)) return { version: "", rating: null };
    const bm = data.beatmaps.find((b) => Number(b.id) === n);
    if (!bm) return { version: "", rating: null };
    const version =
      bm.version != null && String(bm.version).trim() !== ""
        ? String(bm.version)
        : "";
    const x = Number(bm.difficulty_rating);
    const rating = Number.isFinite(x) ? x : null;
    return { version, rating };
  }

  /**
   * Guest credit in the header (osu `hasGuestOwners`): some `owners[].id` differs from
   * the beatmapset host `user_id`. Uses the same owner list osu shows in
   * `.beatmapset-header__diff-extra`.
   * @param {number|null|undefined} beatmapId
   * @returns {{ show: boolean, owners: Array<{ id: number, username: string }> }}
   */
  function getBeatmapGuestMapperOwnersForHeader(beatmapId) {
    const data = readBeatmapsetJson();
    const empty = {
      show: false,
      owners: /** @type {Array<{ id: number, username: string }>} */ ([]),
    };
    if (!data?.beatmaps?.length) return empty;
    const n = Number(beatmapId);
    if (!Number.isFinite(n)) return empty;
    const bm = data.beatmaps.find((b) => Number(b.id) === n);
    if (!bm || !Array.isArray(bm.owners) || !bm.owners.length) return empty;
    const setUid = Number(data.user_id);
    if (!Number.isFinite(setUid)) return empty;
    const hasGuest = bm.owners.some((o) => Number(o?.id) !== setUid);
    if (!hasGuest) return empty;
    const owners = bm.owners.map((o) => ({
      id: Number(o.id),
      username: o.username != null ? String(o.username) : "",
    }));
    return { show: true, owners };
  }

  /**
   * Selected difficulty only: name + nomod SR inside
   * `a.beatmapset-beatmap-picker__beatmap--active` (same bordered cell as the icon).
   * Hides `.beatmapset-header__diff-name`; guest “mapped by …” is duplicated here from JSON when applicable.
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapHeaderDiffBesidePicker(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    let disposed = false;
    let raf = 0;
    /** Avoid guest-row DOM churn (stops MutationObserver ↔ sync loops + osu usercard re-init). */
    let lastGuestStableKey = "";

    /**
     * osu-web may omit `--active` when there is only one difficulty in some states.
     * @returns {HTMLAnchorElement|null}
     */
    function getActivePickerAnchor() {
      const active = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      if (active instanceof HTMLAnchorElement) return active;
      const only = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap:only-child",
      );
      return only instanceof HTMLAnchorElement ? only : null;
    }

    function getSelectedBeatmapId() {
      const a = getActivePickerAnchor();
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      if (m) return Number(m[1]);
      const s = getBeatmapPageBeatmapId();
      return s != null ? Number(s) : null;
    }

    /** @type {Text|null} */
    let ratingTextNode = null;

    function removeLegacySiblingStrip() {
      for (const dead of header.querySelectorAll(
        ".oep-header-diff-beside-picker",
      )) {
        dead.remove();
      }
    }

    function stripInjectedMetaFromPicker() {
      for (const node of picker.querySelectorAll(
        `[${DIFF_BESIDE_PICKER_ATTR}="1"]`,
      )) {
        node.remove();
      }
    }

    /**
     * @returns {HTMLElement|null}
     */
    function ensureAttached() {
      if (disposed || !pathRe.test(location.pathname)) return null;
      removeLegacySiblingStrip();

      const active = getActivePickerAnchor();
      for (const node of picker.querySelectorAll(
        `[${DIFF_BESIDE_PICKER_ATTR}="1"]`,
      )) {
        const host = node.closest("a.beatmapset-beatmap-picker__beatmap");
        if (host !== active) node.remove();
      }

      if (!(active instanceof HTMLAnchorElement)) {
        header.classList.remove("oep-diff-beside-picker");
        return null;
      }

      header.classList.add("oep-diff-beside-picker");

      let meta = active.querySelector(`[${DIFF_BESIDE_PICKER_ATTR}="1"]`);
      if (
        meta instanceof HTMLElement &&
        !meta.querySelector(".oep-picker-active-meta__title-row")
      ) {
        meta.remove();
        meta = null;
      }
      if (!(meta instanceof HTMLElement)) {
        const starSpan = el(
          "span",
          {
            class: "oep-picker-active-meta__star",
            title: "Star rating",
          },
          el("i", { class: "fas fa-star", "aria-hidden": "true" }),
          "",
        );
        const icon = starSpan.querySelector(".fa-star");
        const tn = icon?.nextSibling;
        ratingTextNode = tn instanceof Text ? tn : null;
        const titleRow = el(
          "span",
          { class: "oep-picker-active-meta__title-row" },
          el("span", { class: "oep-picker-active-meta__version" }),
          el("span", {
            class:
              "beatmapset-header__diff-extra oep-picker-active-meta__guest",
          }),
        );
        meta = el(
          "span",
          {
            class: "oep-picker-active-meta",
            [DIFF_BESIDE_PICKER_ATTR]: "1",
          },
          titleRow,
          starSpan,
        );
        active.appendChild(meta);
      } else {
        const starSpan = meta.querySelector(".oep-picker-active-meta__star");
        const icon = starSpan?.querySelector(".fa-star");
        const tn = icon?.nextSibling;
        ratingTextNode = tn instanceof Text ? tn : null;
      }
      return meta;
    }

    function syncContent() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const active = getActivePickerAnchor();
      if (!(active instanceof HTMLAnchorElement)) {
        stripInjectedMetaFromPicker();
        header.classList.remove("oep-diff-beside-picker");
        lastGuestStableKey = "";
        ratingTextNode = null;
        return;
      }

      const meta = ensureAttached();
      if (!meta || !ratingTextNode) return;

      const beatmapIcon = active.querySelector(".beatmap-icon");
      if (beatmapIcon instanceof HTMLElement) {
        const diffVar =
          beatmapIcon.style.getPropertyValue("--diff") ||
          getComputedStyle(beatmapIcon).getPropertyValue("--diff");
        const trimmed = diffVar?.trim() ?? "";
        const current = active.style.getPropertyValue("--diff");
        if (trimmed && current !== trimmed) {
          active.style.setProperty("--diff", trimmed);
        } else if (!trimmed && current) {
          active.style.removeProperty("--diff");
        }
      } else if (active.style.getPropertyValue("--diff")) {
        active.style.removeProperty("--diff");
      }

      const verEl = meta.querySelector(".oep-picker-active-meta__version");
      const guestEl = meta.querySelector(".oep-picker-active-meta__guest");
      const titleRow = meta.querySelector(".oep-picker-active-meta__title-row");
      if (!(verEl instanceof HTMLElement) || !(guestEl instanceof HTMLElement))
        return;

      const id = getSelectedBeatmapId();
      const { version, rating } =
        id != null
          ? getBeatmapVersionAndRatingForHeader(id)
          : { version: "", rating: null };
      const { show: showGuest, owners: guestOwners } =
        id != null
          ? getBeatmapGuestMapperOwnersForHeader(id)
          : { show: false, owners: [] };

      const hasVer = Boolean(version);
      if (verEl.textContent !== version) verEl.textContent = version;
      if (hasVer) {
        verEl.setAttribute("title", version);
      } else {
        verEl.removeAttribute("title");
      }
      const verDisplay = hasVer ? "" : "none";
      if (verEl.style.display !== verDisplay) verEl.style.display = verDisplay;

      const expectGuestNodes = Boolean(showGuest && guestOwners.length);
      const guestStableKey = `${id ?? ""}|${
        expectGuestNodes
          ? guestOwners.map((o) => `${o.id}:${o.username}`).join(",")
          : ""
      }`;
      const shouldRebuildGuest =
        guestStableKey !== lastGuestStableKey ||
        (expectGuestNodes && guestEl.childNodes.length === 0) ||
        (!expectGuestNodes && guestEl.childNodes.length > 0);

      if (shouldRebuildGuest) {
        lastGuestStableKey = guestStableKey;
        guestEl.replaceChildren();
        if (showGuest && guestOwners.length) {
          if (guestEl.style.display !== "") guestEl.style.display = "";
          guestEl.append(document.createTextNode("mapped by "));
          guestOwners.forEach((o, i) => {
            if (i > 0) guestEl.append(document.createTextNode(", "));
            const uid = Number(o.id);
            const uname = o.username.trim() || `User ${uid}`;
            const profileUrl =
              Number.isFinite(uid) && uid > 0 ? `/users/${uid}` : null;
            /*
             * Span + js-usercard (not <a>): nested links inside the picker’s <a> are invalid
             * HTML and break osu’s card positioning; stable guest DOM avoids lookup spam.
             */
            /** @type {Record<string, string | ((e: Event) => void)>} */
            const spanAttrs = {
              class: "oep-picker-active-meta__guest-user js-usercard",
              role: "link",
              tabindex: "0",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (profileUrl) window.location.assign(profileUrl);
              },
              onkeydown: (e) => {
                const ke = /** @type {KeyboardEvent} */ (e);
                if (ke.key !== "Enter" && ke.key !== " ") return;
                ke.preventDefault();
                ke.stopPropagation();
                if (profileUrl) window.location.assign(profileUrl);
              },
              onauxclick: (e) => {
                const me = /** @type {MouseEvent} */ (e);
                if (me.button !== 1 || !profileUrl) return;
                me.preventDefault();
                me.stopPropagation();
                window.open(profileUrl, "_blank", "noopener,noreferrer");
              },
            };
            if (profileUrl) {
              spanAttrs.title = `View ${uname}'s profile`;
              spanAttrs["data-user-id"] = String(uid);
            }
            guestEl.append(el("span", spanAttrs, uname));
          });
        } else {
          if (guestEl.style.display !== "none") guestEl.style.display = "none";
        }
      } else {
        const wantDisplay = expectGuestNodes ? "" : "none";
        if (guestEl.style.display !== wantDisplay)
          guestEl.style.display = wantDisplay;
      }

      const hasTitle = hasVer || (showGuest && guestOwners.length > 0);
      if (titleRow instanceof HTMLElement) {
        const titleDisplay = hasTitle ? "" : "none";
        if (titleRow.style.display !== titleDisplay)
          titleRow.style.display = titleDisplay;
      }

      const starEl = meta.querySelector(".oep-picker-active-meta__star");
      if (rating == null) {
        if (starEl instanceof HTMLElement && starEl.style.display !== "none")
          starEl.style.display = "none";
        if (ratingTextNode.textContent !== "") ratingTextNode.textContent = "";
        const metaDisplay = hasTitle ? "" : "none";
        if (meta.style.display !== metaDisplay)
          meta.style.display = metaDisplay;
        return;
      }
      if (meta.style.display !== "") meta.style.display = "";
      if (starEl instanceof HTMLElement && starEl.style.display !== "")
        starEl.style.display = "";
      const starText = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
      if (ratingTextNode.textContent !== starText)
        ratingTextNode.textContent = starText;
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncContent();
      });
    }

    function onRouteHashSignal() {
      scheduleSync();
    }

    syncContent();

    window.addEventListener("hashchange", onRouteHashSignal, { passive: true });
    window.addEventListener("popstate", onRouteHashSignal, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(picker, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("hashchange", onRouteHashSignal);
      window.removeEventListener("popstate", onRouteHashSignal);
      mo.disconnect();
      stripInjectedMetaFromPicker();
      removeLegacySiblingStrip();
      header.classList.remove("oep-diff-beside-picker");
      lastGuestStableKey = "";
      ratingTextNode = null;
    };
  }

  /**
   * Always-visible diff name + nomod SR below the picker tray (between picker and OMDB).
   * Follows the active difficulty; while the cursor is over another icon, previews that diff.
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startPickerHoverHint(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    const versionEl = el("span", { class: "oep-picker-hover-hint__version" });
    const starEl = el(
      "span",
      { class: "oep-picker-hover-hint__star" },
      el("i", { class: "fas fa-star", "aria-hidden": "true" }),
    );
    const starValueTn = document.createTextNode("");
    starEl.appendChild(starValueTn);
    const hintEl = el(
      "div",
      { class: "oep-picker-hover-hint" },
      versionEl,
      starEl,
    );

    picker.insertAdjacentElement("afterend", hintEl);

    let disposed = false;
    let hoveredBeatmapId = /** @type {number|null} */ (null);
    let raf = 0;

    function beatmapIdFromPickerAnchor(a) {
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const m = (a.getAttribute("href") || "").match(/\/beatmaps\/(\d+)/);
      return m ? Number(m[1]) : null;
    }

    function getActiveBeatmapIdFromPicker() {
      const a = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      return beatmapIdFromPickerAnchor(a);
    }

    /**
     * @param {number|null|undefined} bid
     * @returns {HTMLAnchorElement|null}
     */
    function findPickerAnchorForBeatmapId(bid) {
      if (bid == null || !Number.isFinite(Number(bid))) return null;
      const n = Number(bid);
      for (const node of picker.querySelectorAll(
        "a.beatmapset-beatmap-picker__beatmap",
      )) {
        if (!(node instanceof HTMLAnchorElement)) continue;
        const pid = beatmapIdFromPickerAnchor(node);
        if (pid === n) return node;
      }
      return null;
    }

    function resolvedBeatmapId() {
      if (hoveredBeatmapId != null) return hoveredBeatmapId;
      const fromPicker = getActiveBeatmapIdFromPicker();
      if (fromPicker != null) return fromPicker;
      const pageId = getBeatmapPageBeatmapId();
      return pageId != null ? Number(pageId) : null;
    }

    function syncHint() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const id = resolvedBeatmapId();
      const anchor =
        id != null
          ? findPickerAnchorForBeatmapId(id)
          : picker.querySelector("a.beatmapset-beatmap-picker__beatmap--active");

      const { version, rating } =
        id != null
          ? getBeatmapVersionAndRatingForHeader(id)
          : { version: "", rating: null };

      const icon =
        anchor instanceof HTMLAnchorElement
          ? anchor.querySelector(".beatmap-icon")
          : null;
      const diffVar = icon
        ? (
            icon.style.getPropertyValue("--diff") ||
            getComputedStyle(icon).getPropertyValue("--diff")
          ).trim()
        : "";
      if (diffVar) hintEl.style.setProperty("--oep-hint-diff", diffVar);
      else hintEl.style.removeProperty("--oep-hint-diff");

      versionEl.textContent = version || "";
      versionEl.style.display = version ? "" : "none";

      if (rating != null) {
        starValueTn.textContent = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
        starEl.style.display = "";
      } else {
        starValueTn.textContent = "";
        starEl.style.display = "none";
      }
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncHint();
      });
    }

    /**
     * @param {MouseEvent} e
     */
    function onPickerMouseOver(e) {
      if (disposed || !pathRe.test(location.pathname)) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = beatmapIdFromPickerAnchor(a);
      if (id == null) return;
      hoveredBeatmapId = id;
      scheduleSync();
    }

    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    function onRouteSignal() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    syncHint();

    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onRouteSignal, { passive: true });
    window.addEventListener("popstate", onRouteSignal, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(picker, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onRouteSignal);
      window.removeEventListener("popstate", onRouteSignal);
      mo.disconnect();
      hintEl.remove();
    };
  }

  /**
   * Nomod star rating in the header difficulty line: always visible with a star icon
   * (osu-web only mounts the native span while hovering the picker).
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startBeatmapHeaderNomodStarLine(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    let hoveredBeatmapId = /** @type {number|null} */ (null);
    let disposed = false;
    let raf = 0;

    function getActiveBeatmapIdFromPicker() {
      const a = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      return m ? Number(m[1]) : null;
    }

    function currentDisplayedBeatmapId() {
      if (hoveredBeatmapId != null) return hoveredBeatmapId;
      const fromPicker = getActiveBeatmapIdFromPicker();
      if (fromPicker != null) return fromPicker;
      const s = getBeatmapPageBeatmapId();
      return s != null ? Number(s) : null;
    }

    function getDifficultyRatingForBeatmap(beatmapId) {
      return getBeatmapVersionAndRatingForHeader(beatmapId).rating;
    }

    function buildStarSpan() {
      const attrs = {
        class:
          "beatmapset-header__diff-extra beatmapset-header__diff-extra--star-difficulty",
        title: "Star rating",
      };
      attrs[HEADER_NOMOD_STAR_ATTR] = "1";
      return el(
        "span",
        attrs,
        el("i", { class: "fas fa-star", "aria-hidden": "true" }),
        "",
      );
    }

    /** @type {Text|null} */
    let ratingTextNode = null;

    function ensureAttached() {
      if (disposed || !pathRe.test(location.pathname)) return null;
      const diffName = header.querySelector(".beatmapset-header__diff-name");
      const row = diffName?.parentElement;
      if (!(diffName instanceof HTMLElement) || !(row instanceof HTMLElement))
        return null;

      let span = row.querySelector(`[${HEADER_NOMOD_STAR_ATTR}="1"]`);
      if (!(span instanceof HTMLSpanElement)) span = buildStarSpan();
      diffName.insertAdjacentElement("afterend", span);

      const icon = span.querySelector(".fa-star");
      const tn = icon?.nextSibling;
      ratingTextNode = tn instanceof Text ? tn : null;
      return span;
    }

    function syncContent() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const span = ensureAttached();
      if (!span || !ratingTextNode) return;
      const id = currentDisplayedBeatmapId();
      const r = id != null ? getDifficultyRatingForBeatmap(id) : null;
      if (r == null) {
        span.style.display = "none";
        ratingTextNode.textContent = "";
        return;
      }
      span.style.display = "";
      ratingTextNode.textContent = ` ${formatBeatmapsetHeaderStarRatingText(r)}`;
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncContent();
      });
    }

    /**
     * @param {MouseEvent} e
     */
    function onPickerMouseOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = parseBeatmapIdFromPickerLink(a);
      if (id != null) {
        hoveredBeatmapId = id;
        scheduleSync();
        return;
      }
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/beatmaps\/(\d+)/);
      if (m) {
        hoveredBeatmapId = Number(m[1]);
        scheduleSync();
      }
    }

    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    function onRouteHashSignal() {
      hoveredBeatmapId = null;
      scheduleSync();
    }

    syncContent();

    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onRouteHashSignal, { passive: true });
    window.addEventListener("popstate", onRouteHashSignal, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(header, { subtree: true, childList: true });

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onRouteHashSignal);
      window.removeEventListener("popstate", onRouteHashSignal);
      mo.disconnect();
      header.querySelector(`[${HEADER_NOMOD_STAR_ATTR}="1"]`)?.remove();
    };
  }

  /**
   * OMDB mapset link + short hint when the feature is on but no API key is set.
   * @returns {() => void}
   */
  function mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !box) return () => {};

    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();

    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB",
      },
      "OMDB",
    );
    const keyLink = el(
      "a",
      {
        href: "#",
        class: `${OEP_OMDB_ROW_CLASS}__settings-link`,
        title: "Open Expert+ settings",
      },
      "OMDB API key",
    );
    keyLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      OsuExpertPlus.settingsPanel?.open?.();
    });
    const bodyEl = el(
      "span",
      {
        class: `${OEP_OMDB_ROW_CLASS}__body ${OEP_OMDB_ROW_CLASS}__body--muted`,
      },
      "Add an ",
      keyLink,
      " to load OMDB ratings here",
    );
    const statsRow = el(
      "div",
      { class: OEP_OMDB_ROW_CLASS },
      omdbLabel,
      bodyEl,
    );
    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1",
    });
    wrap.appendChild(statsRow);
    box.insertBefore(wrap, diffName);

    return () => {
      wrap.remove();
    };
  }

  /**
   * Inserts an OMDB stats row above `.beatmapset-header__diff-name`.
   * Tracks hovered vs active picker link (same behaviour as the difficulty title).
   * @returns {() => void}
   */
  function mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !picker || !box) return () => {};

    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();

    const distPopoverEl = el("div", {
      class: `${OEP_OMDB_ROW_CLASS}__dist-popover`,
      "data-oep-omdb-dist-popover": "1",
    });
    distPopoverEl.style.cssText = "display:none;position:fixed;z-index:10002;";
    document.body.appendChild(distPopoverEl);
    let distPopoverHideTimer = 0;

    function hideOmdbDistPopover() {
      window.clearTimeout(distPopoverHideTimer);
      distPopoverHideTimer = 0;
      distPopoverEl.style.display = "none";
      distPopoverEl.replaceChildren();
    }

    function positionOmdbDistPopover(anchorRect) {
      const margin = 6;
      const w = distPopoverEl.offsetWidth;
      const h = distPopoverEl.offsetHeight;
      let left = anchorRect.left;
      let top = anchorRect.bottom + margin;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      if (top + h > window.innerHeight - 8) {
        top = Math.max(8, anchorRect.top - h - margin);
      }
      distPopoverEl.style.left = `${left}px`;
      distPopoverEl.style.top = `${top}px`;
    }

    function showOmdbDistPopover(trigger, rows) {
      window.clearTimeout(distPopoverHideTimer);
      fillOmdbDistPopover(distPopoverEl, rows);
      distPopoverEl.style.display = "block";
      positionOmdbDistPopover(trigger.getBoundingClientRect());
    }

    distPopoverEl.addEventListener("mouseenter", () => {
      window.clearTimeout(distPopoverHideTimer);
    });
    distPopoverEl.addEventListener("mouseleave", () => {
      distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 100);
    });

    function onOmdbDistScrollOrResize() {
      if (distPopoverEl.style.display !== "none") hideOmdbDistPopover();
    }
    window.addEventListener("scroll", onOmdbDistScrollOrResize, true);
    window.addEventListener("resize", onOmdbDistScrollOrResize, {
      passive: true,
    });

    const omdbDistUi = {
      /**
       * @param {HTMLElement} trigger
       * @param {{ score: number, count: number }[]} rows
       */
      bindTrigger(trigger, rows) {
        const schedHide = () => {
          window.clearTimeout(distPopoverHideTimer);
          distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 120);
        };
        trigger.addEventListener("mouseenter", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("mouseleave", schedHide);
        trigger.addEventListener("focus", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("blur", schedHide);
      },
    };

    const bodyEl = el(
      "span",
      { class: `${OEP_OMDB_ROW_CLASS}__body` },
      "Loading OMDB…",
    );
    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB",
      },
      "OMDB",
    );
    const statsRow = el(
      "div",
      { class: OEP_OMDB_ROW_CLASS },
      omdbLabel,
      bodyEl,
    );

    const starUnits = [];
    const starsHost = el("div", { class: `${OEP_OMDB_VOTE_CLASS}__stars` });
    for (let si = 0; si < 5; si++) {
      const unitClass =
        si === 0
          ? `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty ${OEP_OMDB_VOTE_CLASS}__unit--has-zero`
          : `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty`;
      const unit = el("span", { class: unitClass });
      unit.appendChild(
        el("i", {
          class: `far fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--empty`,
          "aria-hidden": "true",
        }),
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star-half-alt ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--half`,
          "aria-hidden": "true",
        }),
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--full`,
          "aria-hidden": "true",
        }),
      );
      if (si === 0) {
        unit.appendChild(
          el("button", {
            type: "button",
            class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--zero`,
            "data-oep-score": "0",
            "aria-label":
              "Rate 0 out of 5 stars on OMDB (left edge of first star)",
            title: "0★",
          }),
        );
      }
      const left = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--left`,
        "data-oep-score": String(si + 0.5),
        "aria-label": `Rate ${si + 0.5} out of 5 stars on OMDB`,
        title: `${si + 0.5}★`,
      });
      const right = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--right`,
        "data-oep-score": String(si + 1),
        "aria-label": `Rate ${si + 1} out of 5 stars on OMDB`,
        title: `${si + 1}★`,
      });
      unit.appendChild(left);
      unit.appendChild(right);
      starUnits.push(unit);
      starsHost.appendChild(unit);
    }

    const clearBtn = el(
      "button",
      {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__clear ${OEP_OMDB_VOTE_CLASS}__clear--concealed`,
        title: "Remove your OMDB rating",
        "aria-hidden": "true",
      },
      "Clear",
    );
    const voteStatus = el("span", { class: `${OEP_OMDB_VOTE_CLASS}__status` });
    const voteControls = el(
      "div",
      { class: `${OEP_OMDB_VOTE_CLASS}__controls` },
      el("span", { class: `${OEP_OMDB_VOTE_CLASS}__label` }, "Your rating"),
      starsHost,
      clearBtn,
    );
    const voteRow = el(
      "div",
      {
        class: OEP_OMDB_VOTE_CLASS,
        "data-oep-omdb-vote": "1",
        style: "display: none",
      },
      voteControls,
      voteStatus,
    );

    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1",
    });
    wrap.appendChild(statsRow);
    wrap.appendChild(voteRow);
    box.insertBefore(wrap, diffName);

    const beatmapIdsInSet = new Set();
    for (const b of readBeatmapsetJson()?.beatmaps ?? []) {
      if (b?.id != null) beatmapIdsInSet.add(Number(b.id));
    }
    let omdbSetFetchSucceeded = false;

    /** @type {Map<number, object>} */
    let byBeatmapId = new Map();
    let hoveredBeatmapId = null;
    /** @type {number|null} */
    let hoverStarScore = null;
    let voteBusy = false;
    let disposed = false;
    let raf = 0;

    function getActiveBeatmapIdFromPicker() {
      const a = picker.querySelector(
        "a.beatmapset-beatmap-picker__beatmap--active",
      );
      return a instanceof HTMLAnchorElement
        ? parseBeatmapIdFromPickerLink(a)
        : null;
    }

    function currentDisplayedBeatmapId() {
      return hoveredBeatmapId ?? getActiveBeatmapIdFromPicker();
    }

    function isOmdbDifficultyBlacklisted(beatmapId) {
      if (!omdbSetFetchSucceeded || beatmapId == null) return false;
      if (byBeatmapId.size === 0) return false;
      const n = Number(beatmapId);
      if (!Number.isFinite(n) || !beatmapIdsInSet.has(n)) return false;
      return !byBeatmapId.has(n);
    }

    function setVoteBusy(on) {
      voteBusy = on;
      voteRow.classList.toggle(`${OEP_OMDB_VOTE_CLASS}--busy`, on);
      clearBtn.disabled = on;
    }

    function syncVoteStars() {
      if (disposed || voteRow.style.display === "none") return;
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        paintOmdbStarUnits(starUnits, null);
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
        return;
      }
      const entry = byBeatmapId.get(id);
      const own = parseOmdbOwnRating(entry);
      const visual = hoverStarScore != null ? hoverStarScore : own;
      paintOmdbStarUnits(starUnits, visual);
      if (own != null) {
        clearBtn.classList.remove(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.removeAttribute("aria-hidden");
      } else {
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
      }
    }

    function syncDisplay() {
      if (disposed || !pathRe.test(location.pathname)) return;
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        bodyEl.textContent = "";
        bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
        syncVoteStars();
        return;
      }
      bodyEl.classList.remove(
        `${OEP_OMDB_ROW_CLASS}__body--muted`,
        `${OEP_OMDB_ROW_CLASS}__body--error`,
      );
      renderOmdbRatingRowBody(
        bodyEl,
        byBeatmapId.get(id),
        omdbDistUi,
        header,
        isOmdbDifficultyBlacklisted(id),
      );
      syncVoteStars();
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncDisplay();
      });
    }

    /**
     * @param {MouseEvent} e
     */
    function onPickerMouseOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = parseBeatmapIdFromPickerLink(a);
      if (id != null) hoveredBeatmapId = id;
      syncDisplay();
    }

    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      syncDisplay();
    }

    function onHashChange() {
      hoveredBeatmapId = null;
      hoverStarScore = null;
      scheduleSync();
    }

    /**
     * @param {MouseEvent} e
     */
    function onStarHalfEnter(e) {
      const t = e.currentTarget;
      if (!(t instanceof HTMLElement)) return;
      const raw = t.getAttribute("data-oep-score");
      const n = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(n)) return;
      hoverStarScore = n;
      syncVoteStars();
    }

    /**
     * @param {MouseEvent} e
     */
    function onVoteControlsMouseLeave(e) {
      const rel = e.relatedTarget;
      if (rel instanceof Node && voteControls.contains(rel)) return;
      hoverStarScore = null;
      syncVoteStars();
    }

    async function reloadSetRatings() {
      const list = await omdb.fetchBeatmapsetRatings(beatmapsetId);
      if (disposed || !pathRe.test(location.pathname)) return;
      byBeatmapId = new Map();
      for (const item of list || []) {
        const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
        if (bid != null) byBeatmapId.set(Number(bid), item);
      }
      omdbSetFetchSucceeded = true;
      syncDisplay();
    }

    /**
     * @param {number} score
     */
    async function submitVote(score) {
      if (voteBusy || disposed || !pathRe.test(location.pathname)) return;
      const id = currentDisplayedBeatmapId();
      if (id == null) return;
      hoverStarScore = null;
      voteStatus.textContent = "";
      voteStatus.classList.remove(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      setVoteBusy(true);
      try {
        await omdb.rateBeatmap(id, score);
        await reloadSetRatings();
      } catch (err) {
        voteStatus.textContent = err?.message
          ? String(err.message)
          : "Could not submit rating.";
        voteStatus.classList.add(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      } finally {
        setVoteBusy(false);
      }
    }

    for (const unit of starUnits) {
      for (const half of unit.querySelectorAll(
        `.${OEP_OMDB_VOTE_CLASS}__half`,
      )) {
        half.addEventListener("mouseenter", onStarHalfEnter);
        half.addEventListener("click", (e) => {
          e.preventDefault();
          const btn = e.currentTarget;
          if (!(btn instanceof HTMLElement) || voteBusy) return;
          const raw = btn.getAttribute("data-oep-score");
          const n = raw == null ? NaN : Number(raw);
          if (!Number.isFinite(n)) return;
          submitVote(n);
        });
      }
    }

    voteControls.addEventListener("mouseleave", onVoteControlsMouseLeave);
    clearBtn.addEventListener("click", () => submitVote(-2));

    omdb
      .fetchBeatmapsetRatings(beatmapsetId)
      .then((list) => {
        if (disposed || !pathRe.test(location.pathname)) return;
        byBeatmapId = new Map();
        for (const item of list || []) {
          const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
          if (bid != null) byBeatmapId.set(Number(bid), item);
        }
        omdbSetFetchSucceeded = true;
        bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--error`);
        voteRow.style.display = "";
        syncDisplay();
      })
      .catch((err) => {
        if (disposed) return;
        bodyEl.textContent = err?.message
          ? String(err.message)
          : "Could not load OMDB ratings.";
        bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--error`);
        voteRow.style.display = "none";
      });

    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onHashChange, { passive: true });

    const mo = new MutationObserver(scheduleSync);
    mo.observe(picker, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });

    scheduleSync();

    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      mo.disconnect();
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onHashChange);
      hideOmdbDistPopover();
      window.removeEventListener("scroll", onOmdbDistScrollOrResize, true);
      window.removeEventListener("resize", onOmdbDistScrollOrResize);
      distPopoverEl.remove();
      wrap.remove();
    };
  }

  /**
   * Primary `.osz` download in `.beatmapset-header__buttons` — first link to
   * `/beatmapsets/{id}/download` (excludes osu!direct / support links).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function mountBeatconnectDownloadSplit(header, beatmapsetId) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    if (buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)) {
      return () => {};
    }

    const id = Number(beatmapsetId);
    if (!Number.isFinite(id)) return () => {};

    const dlRe = new RegExp(String.raw`/beatmapsets/${id}/download`, "i");
    /** @type {HTMLAnchorElement | undefined} */
    const primaryDl = qsa("a.btn-osu-big", buttons).find((a) =>
      dlRe.test(a.getAttribute("href") || ""),
    );
    if (!primaryDl) {
      return () => {};
    }

    primaryDl.classList.add(BEATCONNECT_DL_PAIRED_CLASS);

    const beatconnectBtn = el(
      "a",
      {
        class: `btn-osu-big btn-osu-big--beatmapset-header ${BEATCONNECT_DL_BTN_CLASS}`,
        href: `https://beatconnect.io/b/${id}`,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      el(
        "span",
        {
          class: `btn-osu-big__content ${BEATCONNECT_STACK_CLASS}`,
        },
        el(
          "span",
          {
            class: `btn-osu-big__icon ${BEATCONNECT_STACK_ICON_CLASS}`,
          },
          el("img", {
            class: "oep-beatconnect-logo",
            src: "https://beatconnect.io/static/img/logo.png",
            alt: "Beatconnect",
            decoding: "async",
          }),
        ),
        el("span", { class: BEATCONNECT_STACK_LABEL_CLASS }, "Beatconnect"),
      ),
    );

    primaryDl.after(beatconnectBtn);

    return () => {
      primaryDl.classList.remove(BEATCONNECT_DL_PAIRED_CLASS);
      buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)?.remove();
    };
  }

  /**
   * Square header control opening `https://b.ppy.sh/preview/{id}.mp3` (osu! preview stream).
   * @param {HTMLElement} header  `.beatmapset-header`
   * @param {string} beatmapsetId
   * @returns {() => void}
   */
  function mountBeatmapsetPreviewAudioButton(header, beatmapsetId) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {};

    if (buttons.querySelector("[data-oep-beatmapset-preview-audio]")) {
      return () => {};
    }

    const id = Number(beatmapsetId);
    if (!Number.isFinite(id)) return () => {};

    const previewLink = el(
      "a",
      {
        class: "btn-osu-big btn-osu-big--beatmapset-header-square",
        href: `https://b.ppy.sh/preview/${id}.mp3`,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-oep-beatmapset-preview-audio": "",
        title: "Open preview audio",
        "aria-label": "Open preview audio",
      },
      el(
        "span",
        { class: "btn-osu-big__content btn-osu-big__content--center" },
        el(
          "span",
          { class: "btn-osu-big__icon" },
          el(
            "span",
            { class: "fa fa-fw" },
            el("span", { class: "fas fa-volume-up", "aria-hidden": "true" }),
          ),
        ),
      ),
    );

    const mp3 = buttons.querySelector("[data-oep-beatmapset-mp3]");
    const bg = buttons.querySelector("[data-oep-beatmapset-bg]");
    if (mp3 instanceof HTMLElement) {
      mp3.insertAdjacentElement("afterend", previewLink);
    } else if (bg instanceof HTMLElement) {
      bg.insertAdjacentElement("afterend", previewLink);
    } else {
      const directBtn = findBeatmapsetOsuDirectButton(buttons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", previewLink);
      } else {
        buttons.appendChild(previewLink);
      }
    }

    return () => {
      previewLink.remove();
    };
  }

  // Attribute set on .beatmapset-header elements we have already processed.
  const BEATMAPSET_HEADER_PROCESSED_ATTR = "data-oep-processed";
  const BEATMAPSET_HEADER_STALE_SEL = `.beatmapset-header[${BEATMAPSET_HEADER_PROCESSED_ATTR}]`;

  /**
   * @param {RegExpMatchArray} match  match[1] = beatmapset id string.
   * @returns {Promise<function>}
   */
  async function init(match) {
    const beatmapsetId = match[1];
    const pathRe = new RegExp(`^/beatmapsets/${beatmapsetId}(?:/|$)`);

    // Discussion routes use a different layout and may not have beatmapset header/scoreboard UI.
    if (/^\/beatmapsets\/\d+\/discussion(?:\/|$)/i.test(location.pathname)) {
      ensureStyles();
      const bag = createCleanupBag();
      bag.add(
        startBeatmapDiscussionPreviewManager(pathRe),
        startBeatmapDiscussionVotersTooltipManager(pathRe),
      );
      return () => bag.dispose();
    }

    ensureStyles();
    installBeatmapScoresLimitPatch();

    /** @type {{ dispose: () => void } | null} */
    let metadataInfoModal = null;
    /** @type {{ dispose: () => void } | null} */
    let descriptionInfoModal = null;
    /** @type {HTMLElement|null} */
    let descriptionHeadingDescRow = null;
    /** @type {HTMLElement|null} */
    let header = null;
    /** @type {null|(() => void)} */
    let modGridCleanup = null;
    let modGridSetupGen = 0;

    const bag = createCleanupBag();

    function disposeBeatmapInfoModalButtons() {
      try {
        metadataInfoModal?.dispose();
      } catch (_) {}
      metadataInfoModal = null;
      try {
        descriptionInfoModal?.dispose();
      } catch (_) {}
      descriptionInfoModal = null;
      if (descriptionHeadingDescRow instanceof HTMLElement) {
        teardownBeatmapDescriptionHeadingLayout(descriptionHeadingDescRow);
        descriptionHeadingDescRow = null;
      }
    }

    function refreshBeatmapInfoModalButtons() {
      if (!(header instanceof HTMLElement) || !document.body.contains(header))
        return;
      if (!pathRe.test(location.pathname)) return;

      if (!settings.isEnabled(METADATA_DESCRIPTION_MODAL_BUTTONS_ID)) {
        disposeBeatmapInfoModalButtons();
        return;
      }

      const data = readBeatmapsetJson();

      const artistEl = header.querySelector(
        ".beatmapset-header__details-text--artist",
      );
      if (
        !metadataInfoModal &&
        artistEl instanceof HTMLElement &&
        !header.querySelector("[data-oep-beatmapset-metadata]")
      ) {
        metadataInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap metadata",
          titleId: `${ROOT_CLASS}-metadata-title`,
          buttonText: "Show metadata",
          buttonIconClass: "fas fa-clipboard-list",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--under-artist`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-metadata", "");
            artistEl.insertAdjacentElement("afterend", btn);
          },
          buildModalTitleExtra: (elFn) =>
            buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapPageBeatmapId),
          buildBody: () => buildModalBody(data, el),
        });
      }

      const infoCol = document.querySelector(".beatmapset-info");
      const firstBox = infoCol?.querySelector(":scope > .beatmapset-info__box");
      const scrollEl = firstBox?.querySelector(
        ":scope > .beatmapset-info__scrollable",
      );
      const descRow =
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:has(.beatmapset-info__description)",
        ) ??
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:first-child:has(> h3.beatmapset-info__header)",
        );
      const descHeading = descRow?.querySelector(
        ":scope > h3.beatmapset-info__header",
      );
      if (
        !descriptionInfoModal &&
        descRow instanceof HTMLElement &&
        descHeading instanceof HTMLElement &&
        !descRow.querySelector("[data-oep-beatmapset-desc]")
      ) {
        descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
        descriptionHeadingDescRow = descRow;
        descriptionInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap description",
          titleId: `${ROOT_CLASS}-description-title`,
          buttonText: "Full description",
          buttonIconClass: "fas fa-align-left",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--description-heading`,
          modalExtraClass: `${ROOT_CLASS}__modal--description`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-desc", "");
            const headWrap = el("div", {
              class: `${ROOT_CLASS}__description-sticky-head`,
            });
            descRow.insertBefore(headWrap, descHeading);
            headWrap.appendChild(descHeading);
            headWrap.appendChild(btn);
          },
          buildBody: () => buildDescriptionModalBody(data, el),
        });
      }
    }

    function refreshBeatmapScoreboardModGrid() {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      const gen = modGridSetupGen;
      if (!settings.isEnabled(SCOREBOARD_MOD_GRID_ID)) {
        const modsStrip = document.querySelector(
          ".beatmapset-scoreboard__mods",
        );
        if (modsStrip instanceof HTMLElement) {
          stopBeatmapScoreboardModGridLive(modsStrip);
        }
        return;
      }
      setupBeatmapScoreboardModGrid().then((dispose) => {
        if (gen !== modGridSetupGen) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        if (!pathRe.test(location.pathname)) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        modGridCleanup = dispose;
      });
    }

    const cleanup = () => {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      disposeBeatmapInfoModalButtons();
      bag.dispose();
    };

    await waitForStaleElementToLeave(BEATMAPSET_HEADER_STALE_SEL);

    try {
      header = await waitForElement(".beatmapset-header", 15000);
    } catch (_) {
      return cleanup;
    }

    header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");

    if (!document.body.contains(header)) return cleanup;

    if (!pathRe.test(location.pathname)) return cleanup;

    bag.add(startBeatmapScoreboardSortControls(pathRe));
    bag.add(startBeatmapScoreUserSearchManager(pathRe));
    bag.add(startBeatmapScoreboardHideRateEditFilterBar(pathRe));
    bag.add(startBeatmapScoreboardTableEnhancementsLive(pathRe));
    bag.add(startBeatmapDiscussionPreviewManager(pathRe));
    bag.add(startDiscussionTabLinkPatcher(beatmapsetId));
    bag.add(startBeatmapsetFavouriteButtonPinkIndicator(header));
    bag.add(startPickerHoverHint(header, pathRe));

    /** @type {null|(() => void)} */
    let headerStarOrDiffBesideCleanup = null;
    function refreshHeaderStarLineOrDiffBesidePicker() {
      try {
        headerStarOrDiffBesideCleanup?.();
      } catch (_) {}
      headerStarOrDiffBesideCleanup = null;
      if (!pathRe.test(location.pathname) || !document.body.contains(header)) {
        return;
      }
      headerStarOrDiffBesideCleanup = settings.isEnabled(
        DIFF_NAME_BESIDE_PICKER_ID,
      )
        ? startBeatmapHeaderDiffBesidePicker(header, pathRe)
        : startBeatmapHeaderNomodStarLine(header, pathRe);
    }
    refreshHeaderStarLineOrDiffBesidePicker();
    bag.add(
      settings.onChange(
        DIFF_NAME_BESIDE_PICKER_ID,
        refreshHeaderStarLineOrDiffBesidePicker,
      ),
    );
    bag.add(() => {
      try {
        headerStarOrDiffBesideCleanup?.();
      } catch (_) {}
      headerStarOrDiffBesideCleanup = null;
    });

    /** @type {null|(() => void)} */
    let beatconnectCleanup = null;
    function refreshBeatconnectDownloadButton() {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATCONNECT_DOWNLOAD_BUTTON_ID)
      ) {
        beatconnectCleanup = mountBeatconnectDownloadSplit(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatconnectDownloadButton();
    bag.add(
      settings.onChange(
        BEATCONNECT_DOWNLOAD_BUTTON_ID,
        refreshBeatconnectDownloadButton,
      ),
    );
    bag.add(() => {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
    });

    /** @type {null|(() => void)} */
    let omdbRatingsCleanup = null;
    function refreshOmdbBeatmapsetRatings() {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
      if (!settings.isEnabled(OMDB_BEATMAPSET_RATINGS_ID)) {
        return;
      }
      omdbRatingsCleanup = omdb.isConfigured()
        ? mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe)
        : mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId);
    }
    refreshOmdbBeatmapsetRatings();
    bag.add(
      settings.onChange(
        OMDB_BEATMAPSET_RATINGS_ID,
        refreshOmdbBeatmapsetRatings,
      ),
    );
    bag.add(() => {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
    });

    bag.add(
      settings.onChange(SCORE_PP_DECIMALS_ID, () => {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      }),
    );

    refreshBeatmapScoreboardModGrid();
    bag.add(
      settings.onChange(
        SCOREBOARD_MOD_GRID_ID,
        refreshBeatmapScoreboardModGrid,
      ),
    );

    const data = readBeatmapsetJson();

    if (auth.isConfigured()) {
      bag.add(
        setupBeatmapsetFavouriteHoverPopover(
          header,
          beatmapsetId,
          pathRe,
          data?.favourite_count,
        ),
      );
    }

    refreshBeatmapInfoModalButtons();
    bag.add(
      settings.onChange(
        METADATA_DESCRIPTION_MODAL_BUTTONS_ID,
        refreshBeatmapInfoModalButtons,
      ),
    );

    try {
      await waitForElement(".beatmapset-info", 12000);
      if (pathRe.test(location.pathname) && document.body.contains(header)) {
        // Between `.beatmapset-header` and `.beatmapset-info` (sibling in `.osu-page--generic-compact`).
        /** @type {null|(() => void)} */
        let beatmapPreviewCleanup = null;
        function refreshBeatmapPreviewSection() {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
          if (
            !pathRe.test(location.pathname) ||
            !document.body.contains(header) ||
            !settings.isEnabled(BEATMAP_PREVIEW_ID) ||
            !beatmapPreview
          ) {
            return;
          }
          const infoEl = document.querySelector(".beatmapset-info");
          if (!infoEl || !document.body.contains(infoEl)) return;
          if (document.querySelector("[data-oep-beatmap-preview-root]")) return;

          const previewUi = beatmapPreview.mountBeatmapsetInfoPreview({
            el,
            manageStyle,
            pathRe,
            getBeatmapId: getBeatmapPageBeatmapId,
            getRuleset: getBeatmapPageRuleset,
            readBeatmapsetJson,
            styleId: BEATMAP_PREVIEW_STYLE_ID,
          });
          const previewSection = el("div", {
            class: "oep-beatmap-preview-section",
          });
          previewSection.appendChild(previewUi.getRow());
          infoEl.insertAdjacentElement("beforebegin", previewSection);
          beatmapPreviewCleanup = () => {
            try {
              previewUi.dispose();
            } catch (_) {}
            previewSection.remove();
          };
        }
        refreshBeatmapPreviewSection();
        bag.add(
          settings.onChange(BEATMAP_PREVIEW_ID, refreshBeatmapPreviewSection),
        );
        bag.add(() => {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
        });

        refreshBeatmapInfoModalButtons();
      }
    } catch (_) {
      /* beatmapset info column not present (layout edge case) */
    }

    const headerButtons = header.querySelector(".beatmapset-header__buttons");
    if (
      headerButtons instanceof HTMLElement &&
      !headerButtons.querySelector("[data-oep-beatmapset-bg]")
    ) {
      const backgroundUrl = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`;
      const bgLink = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: backgroundUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-bg": "",
          title: "Open background",
          "aria-label": "Open background",
        },
        el(
          "span",
          {
            class: "btn-osu-big__content btn-osu-big__content--center",
          },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-image", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const mp3DownloadUrl = `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`;
      const mp3Link = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: mp3DownloadUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-mp3": "",
          title: "Download MP3",
          "aria-label": "Download MP3",
        },
        el(
          "span",
          { class: "btn-osu-big__content btn-osu-big__content--center" },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-music", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const directBtn = findBeatmapsetOsuDirectButton(headerButtons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", bgLink);
      } else {
        headerButtons.appendChild(bgLink);
      }
      bgLink.insertAdjacentElement("afterend", mp3Link);
      bag.add(() => {
        mp3Link.remove();
        bgLink.remove();
      });
    }

    /** @type {null|(() => void)} */
    let previewAudioCleanup = null;
    function refreshBeatmapsetPreviewAudioButton() {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID)
      ) {
        previewAudioCleanup = mountBeatmapsetPreviewAudioButton(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatmapsetPreviewAudioButton();
    bag.add(
      settings.onChange(
        BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID,
        refreshBeatmapsetPreviewAudioButton,
      ),
    );
    bag.add(() => {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
    });

    return cleanup;
  }

  return { name, init };
})();
