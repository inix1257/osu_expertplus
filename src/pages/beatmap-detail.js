/**
 * /beatmapsets/:id and variants. An ES module since WS-31: the scoreboard
 * lives in src/features/scoreboard/ and is started here; the rest is still
 * the legacy IIFE below.
 */

import { destroyOsuWebQtipIfBound } from "../features/osu-web-qtip.js";
import {
  findBeatmapScoreboardRoot,
  getBeatmapPageBeatmapId,
  getBeatmapPageRuleset,
  readBeatmapsetJson,
} from "../features/scoreboard/context.js";
import { disposeScoreboardGlobalRanks } from "../features/scoreboard/global-rank.js";
import {
  setupBeatmapScoreboardModGrid,
  stopBeatmapScoreboardModGridLive,
} from "../features/scoreboard/mod-filter/grid.js";
import { startBeatmapScoreUserSearchManager } from "../features/scoreboard/player-lookup.js";
import { startBeatmapScoreboardHideRateEditFilterBar } from "../features/scoreboard/rate-filter.js";
import { refreshBeatmapScoreboardTableEnhancements } from "../features/scoreboard/refresh.js";
import { installBeatmapScoresLimitPatch } from "../features/scoreboard/scores-limit.js";
import { startBeatmapScoreboardSortControls } from "../features/scoreboard/sort.js";
import {
  MOD_GRID_CSS,
  MOD_GRID_STYLE_ID,
  SCOREBOARD_CSS,
  SCOREBOARD_STYLE_ID,
} from "../features/scoreboard/styles.js";
import { startBeatmapScoreboardTableEnhancementsLive } from "../features/scoreboard/table-enhance.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapDetail = (() => {
  const name = "BeatmapDetail";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    qsa,
    manageStyle,
    createCleanupBag,
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
  const SCOREBOARD_MOD_GRID_ID = IDS.SCOREBOARD_MOD_GRID;
  const PICKER_DIFF_NAMES_ID = IDS.PICKER_DIFF_NAMES;
  const SCOREBOARD_GLOBAL_RANK_ID = IDS.SCOREBOARD_GLOBAL_RANK;
  const beatmapPreview = OsuExpertPlus.beatmapPreview;

  const STYLE_ID = "osu-expertplus-beatmap-detail-css";
  const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";
  const ROOT_CLASS = "osu-expertplus-beatmapset-extras";
  /** Marks injected name / guest credit / SR block inside the active `.beatmapset-beatmap-picker__beatmap--active`. */
  const PICKER_DIFF_NAMES_META_ATTR = "data-oep-picker-diff-names-meta";
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

    /* Vertical difficulty picker: keeps osu's horizontal, wrapping tray, but shows each diff's name + SR beside its icon. */
    .beatmapset-header.oep-picker-diff-names-enabled
      .beatmapset-header__beatmap-picker-box {
      width: auto;
      max-width: none;
    }
    .beatmapset-header.oep-picker-diff-names-enabled
      .beatmapset-beatmap-picker {
      flex-direction: row;
      flex-wrap: wrap;
      /* width: auto on a flex container stretches to fill the row; osu's own
         fit-content default (which we were overriding) is what keeps the
         background hugging the actual icons instead of spanning the header. */
      width: -moz-fit-content;
      width: fit-content;
      max-width: 100%;
      /* Native tray uses a negative margin sized to its 7px item padding; our items use
         their own (larger) padding, so drop that offset instead of keeping it in sync. */
      margin: 0 0 10px;
    }
    .beatmapset-header.oep-picker-diff-names-enabled
      .beatmapset-beatmap-picker__beatmap {
      display: inline-flex !important;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.6rem;
      width: auto !important;
      height: auto !important;
      padding: 0.55rem 1.1rem 0.55rem 0.7rem;
      box-sizing: border-box;
      position: relative;
    }
    .beatmapset-header.oep-picker-diff-names-enabled
      .beatmapset-beatmap-picker__beatmap::before {
      z-index: 0;
    }
    .beatmapset-header.oep-picker-diff-names-enabled
      .beatmapset-beatmap-picker__beatmap
      > .beatmap-icon {
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }
    .oep-picker-diff-names__meta {
      display: none;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 0.1rem;
      min-width: 0;
      line-height: 1.2;
      text-align: left;
      position: relative;
      z-index: 1;
      /* Same muted mix used elsewhere for diff-tinted text (see --oep-diff-muted). */
      --oep-diff-muted: color-mix(
        in srgb,
        var(--oep-diff-muted-src, hsl(var(--hsl-c1))) 44%,
        #ffffff
      );
    }
    .beatmapset-header.oep-picker-diff-names-enabled .oep-picker-diff-names__meta {
      display: flex;
    }
    .oep-picker-diff-names__version {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .oep-picker-diff-names__star {
      display: inline-flex;
      align-items: baseline;
      gap: 0.2em;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--oep-diff-muted);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }
    .oep-picker-diff-names__star .fa-star {
      font-size: 1em;
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
      display: inline-flex;
      align-items: center;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.15em 0.6em;
      border-radius: 999px;
      background: color-mix(
        in srgb,
        color-mix(in srgb, hsl(var(--hsl-c2, 333 60% 60%)) 32%, #000000) 50%,
        transparent
      );
      color: hsl(var(--hsl-l1, 0 0% 96%));
    }
    a.${OEP_OMDB_ROW_CLASS}__label {
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.12s ease, color 0.12s ease;
    }
    a.${OEP_OMDB_ROW_CLASS}__label:hover {
      background: color-mix(
        in srgb,
        color-mix(in srgb, hsl(var(--hsl-c2, 333 60% 60%)) 48%, #000000) 65%,
        transparent
      );
      color: hsl(var(--hsl-c2, 333 72% 84%));
    }
    a.${OEP_OMDB_ROW_CLASS}__label:focus-visible {
      outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
      outline-offset: 2px;
      border-radius: 999px;
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
    .${OEP_OMDB_ROW_CLASS}__stat-value {
      font-weight: 700;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
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
      color: #ffffff;
      font-variant-numeric: tabular-nums;
    }
    a.${OEP_OMDB_ROW_CLASS}__rank-value {
      /* No color override here — "overall"/year rank links are the same element as
         .__rank-value above, and an inherited color would win on specificity and undo it. */
      text-decoration: none;
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
  `;

  const mainStyle = manageStyle(STYLE_ID, CSS);
  const scoreboardStyle = manageStyle(SCOREBOARD_STYLE_ID, SCOREBOARD_CSS);
  const modGridStyle = manageStyle(MOD_GRID_STYLE_ID, MOD_GRID_CSS);

  function ensureStyles() {
    mainStyle.inject();
    scoreboardStyle.inject();
    modGridStyle.inject();
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
    const { discussionPath, discussionTotalPath } = OsuExpertPlus.core.routes;
    const bareSuffix = discussionPath(beatmapsetId);
    const target = discussionTotalPath(beatmapsetId);
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
      destroyOsuWebQtipIfBound(anchor);
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
      destroyOsuWebQtipIfBound(anchor);
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

    /** @type {AbortController|null} */
    let spanAbort = null;

    /** @param {HTMLElement} span */
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
      if (boundSpan) destroyOsuWebQtipIfBound(boundSpan);
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
        const resp = await OsuExpertPlus.api.siteFetch(url);
        if (!resp.ok) {
          flashMsg(`Could not load .osu (HTTP ${resp.status}).`);
          return;
        }
        const text = await resp.text();
        const blob = new Blob([text], {
          type: "text/plain;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        // No "noopener" feature: with it window.open always returns null, which
        // made every click look like a blocked popup. Sever the opener manually.
        const opened = window.open(objectUrl, "_blank");
        if (opened) {
          try {
            opened.opener = null;
          } catch (_) {}
        } else {
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
      modalExtraClass = "",
      buildBody,
      buildModalTitleExtra,
      mountButton,
      buttonExtraClass = "",
    } = cfg;

    const btnClass = `${rootClass}__action-btn${
      buttonExtraClass ? ` ${buttonExtraClass}` : ""
    }`;
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
   * "4.12 avg · 74 ratings" with the numeric values wrapped for a distinct text colour.
   * @param {number} avgN
   * @param {boolean} hasAvg
   * @param {number} cntN
   * @param {boolean} hasCnt
   * @returns {(string|Element)[]}
   */
  function buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt) {
    const nodes = [];
    if (hasAvg) {
      nodes.push(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__stat-value` },
          avgN.toFixed(2),
        ),
        " avg",
      );
    }
    if (hasCnt) {
      if (nodes.length) nodes.push(" · ");
      nodes.push(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__stat-value` },
          String(cntN),
        ),
        ` rating${cntN === 1 ? "" : "s"}`,
      );
    }
    return nodes;
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
      const statNodes = buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt);
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
          ...statNodes,
        );
        anchor.appendChild(trigger);
        distUi.bindTrigger(trigger, distRows);
        appendChunk(anchor);
      } else {
        appendChunk(el("span", {}, ...statNodes));
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
   * Shows each difficulty’s name and nomod star rating next to its icon in the picker tray
   * (still osu’s horizontal, wrapping layout — just with names/SR added per icon).
   * @param {HTMLElement} header
   * @param {RegExp} pathRe
   * @returns {() => void}
   */
  function startPickerDiffNames(header, pathRe) {
    const picker = header.querySelector(".beatmapset-beatmap-picker");
    if (!(picker instanceof HTMLElement)) return () => {};

    let disposed = false;
    let raf = 0;

    function syncEnabledClass() {
      header.classList.toggle(
        "oep-picker-diff-names-enabled",
        settings.isEnabled(PICKER_DIFF_NAMES_ID),
      );
    }

    function beatmapIdFromPickerAnchor(a) {
      if (!(a instanceof HTMLAnchorElement)) return null;
      const fromHash = parseBeatmapIdFromPickerLink(a);
      if (fromHash != null) return fromHash;
      const m = (a.getAttribute("href") || "").match(/\/beatmaps\/(\d+)/);
      return m ? Number(m[1]) : null;
    }

    function syncRow(a) {
      if (!settings.isEnabled(PICKER_DIFF_NAMES_ID)) {
        a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`)?.remove();
        return;
      }

      const id = beatmapIdFromPickerAnchor(a);
      const { version, rating } =
        id != null
          ? getBeatmapVersionAndRatingForHeader(id)
          : { version: "", rating: null };

      let meta = a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`);
      if (!(meta instanceof HTMLElement)) {
        meta = el(
          "span",
          {
            class: "oep-picker-diff-names__meta",
            [PICKER_DIFF_NAMES_META_ATTR]: "1",
          },
          el("span", { class: "oep-picker-diff-names__version" }),
          el(
            "span",
            { class: "oep-picker-diff-names__star" },
            el("i", { class: "fas fa-star", "aria-hidden": "true" }),
          ),
        );
        a.appendChild(meta);
      }

      const icon = a.querySelector(".beatmap-icon");
      const diffVar = icon
        ? (
            icon.style.getPropertyValue("--diff") ||
            getComputedStyle(icon).getPropertyValue("--diff")
          ).trim()
        : "";
      if (diffVar) meta.style.setProperty("--oep-diff-muted-src", diffVar);
      else meta.style.removeProperty("--oep-diff-muted-src");

      const verEl = meta.querySelector(".oep-picker-diff-names__version");
      if (verEl instanceof HTMLElement && verEl.textContent !== version) {
        verEl.textContent = version;
      }

      const starEl = meta.querySelector(".oep-picker-diff-names__star");
      if (starEl instanceof HTMLElement) {
        const starIcon = starEl.querySelector(".fa-star");
        let starTn = starIcon?.nextSibling;
        if (!(starTn instanceof Text)) {
          starTn = document.createTextNode("");
          starEl.appendChild(starTn);
        }
        if (rating != null) {
          starTn.textContent = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
          starEl.style.display = "";
        } else {
          starTn.textContent = "";
          starEl.style.display = "none";
        }
      }
    }

    function syncAll() {
      if (disposed || !pathRe.test(location.pathname)) return;
      syncEnabledClass();
      for (const a of picker.querySelectorAll(
        "a.beatmapset-beatmap-picker__beatmap",
      )) {
        if (a instanceof HTMLAnchorElement) syncRow(a);
      }
    }

    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncAll();
      });
    }

    function onRouteSignal() {
      scheduleSync();
    }

    const unsubSetting = settings.onChange(PICKER_DIFF_NAMES_ID, scheduleSync);

    syncAll();

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
      unsubSetting();
      header.classList.remove("oep-picker-diff-names-enabled");
      window.removeEventListener("hashchange", onRouteSignal);
      window.removeEventListener("popstate", onRouteSignal);
      mo.disconnect();
      for (const node of picker.querySelectorAll(
        `[${PICKER_DIFF_NAMES_META_ATTR}]`,
      )) {
        node.remove();
      }
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
    bag.add(disposeScoreboardGlobalRanks);
    bag.add(startDiscussionTabLinkPatcher(beatmapsetId));
    bag.add(startBeatmapsetFavouriteButtonPinkIndicator(header));
    bag.add(startPickerDiffNames(header, pathRe));

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

    bag.add(
      settings.onChange(SCOREBOARD_GLOBAL_RANK_ID, () => {
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
