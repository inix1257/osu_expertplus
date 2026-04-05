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
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const omdb = OsuExpertPlus.omdb;

  // With user-profile: score-row PP + hit stats
  const SCORE_LIST_DETAILS_ID = IDS.SCORE_LIST_DETAILS;
  const DISCUSSION_DEFAULT_TO_TOTAL_ID = IDS.DISCUSSION_DEFAULT_TO_TOTAL;
  const OMDB_BEATMAPSET_RATINGS_ID = IDS.OMDB_BEATMAPSET_RATINGS;
  const BEATMAP_PREVIEW_ID = IDS.BEATMAP_PREVIEW;
  const beatmapPreview = OsuExpertPlus.beatmapPreview;
  const DISCUSSION_USER_CACHE = new Map();

  const STYLE_ID = "osu-expertplus-beatmap-detail-css";
  const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";
  const MOD_GRID_STYLE_ID = "osu-expertplus-beatmap-mod-grid-css";
  const ROOT_CLASS = "osu-expertplus-beatmapset-extras";
  const MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";
  /** Hidden React strip button → visible grid clone (clone does not receive React class updates). */
  const beatmapModGridOriginalToClone = new WeakMap();
  const SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";
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
      position: sticky;
      top: 0;
      z-index: 1;
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
      color: hsl(var(--hsl-l1, 0 0% 90%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border-color: hsl(var(--hsl-b5, 333 18% 28%));
      text-shadow: none;
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
      margin: 0 10px 6px;
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
        "hdr-corner hdr-stable hdr-lazer"
        "r0-label r0-stable r0-lazer"
        "r1-label r1-stable r1-lazer"
        "r2-label r2-stable r2-lazer";
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
    /* Mod statistics numbers: enabled (i.e. non-zero) mods -> white.
       Keep osu-web's grey-ish styling for disabled/zero-count mods. */
    .beatmap-scoreboard-mod--enabled .mod__extender span,
    .beatmap-scoreboard-mod--enabled .mod__extender,
    .beatmap-scoreboard-mod--enabled .mod__customised-indicator span,
    .beatmap-scoreboard-mod--enabled .mod__customised-indicator,
    .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__stat,
    .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__count {
      color: hsl(var(--hsl-l1, 0 0% 90%)) !important;
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
      background: hsla(var(--hsl-b5, 333 18% 24%), 0.55);
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
      border: 2px solid transparent;
      border-left: 0;
      padding: 4px 5px;
      text-decoration: none;
      cursor: pointer;
      text-transform: none;
      vertical-align: middle;
      color: hsl(var(--hsl-c1));
      background: rgb(128, 123, 244);
      transition: background-color 120ms ease, color 120ms ease;
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

    .${BEATCONNECT_DL_BTN_CLASS}:hover {
      color: hsl(var(--hsl-c1));
      background: rgb(109, 104, 220);
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
    resetBtn.disabled = active.length === 0;
  }

  /**
   * Mirror osu-web state from hidden originals onto visible pile clones (selection highlight, counts).
   * @param {HTMLElement} modsEl
   */
  function syncBeatmapModGridCloneHighlights(modsEl) {
    if (!modsEl.hasAttribute(MOD_GRID_ATTR)) return;
    for (const original of modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod[data-oep-mod-hidden]",
    )) {
      if (!(original instanceof HTMLElement)) continue;
      const clone = beatmapModGridOriginalToClone.get(original);
      if (!(clone instanceof HTMLElement)) continue;

      if (clone.className !== original.className) {
        clone.className = original.className;
      }

      for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
        const v = original.getAttribute(attr);
        if (v == null) clone.removeAttribute(attr);
        else clone.setAttribute(attr, v);
      }

      clone.disabled = original.disabled;

      if (clone.innerHTML !== original.innerHTML) {
        clone.innerHTML = original.innerHTML;
      }
    }
  }

  function teardownBeatmapModGrid(modsEl) {
    if (!(modsEl instanceof HTMLElement)) return;

    modsEl.removeAttribute(MOD_GRID_ATTR);
    modsEl.classList.remove(MOD_GRID_CLASS);

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

    for (const btn of directButtons) {
      const modInner = btn.querySelector(".mod");
      const row =
        modInner instanceof HTMLElement ? modDifficultyRow(modInner) : 2;
      const stable = modStableColumn(btn);
      const key = `r${row}-${stable ? "stable" : "lazer"}`;

      // Clone into the grid pile; keep the original in place for React.
      const clone = btn.cloneNode(true);
      beatmapModGridOriginalToClone.set(btn, clone);
      clone.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        btn.click();
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
      });
      piles[key]?.appendChild(clone);

      btn.setAttribute("data-oep-mod-hidden", "1");
    }

    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
  }

  /**
   * @returns {Promise<function(): void>}
   */
  async function setupBeatmapScoreboardModGrid() {
    ensureModGridStyles();

    let modsEl = null;
    /** @type {MutationObserver|null} */
    let mo = null;
    /** @type {MutationObserver|null} */
    let modStateMo = null;
    let modStateDebounceId = 0;
    let debounceId = 0;

    function scheduleApply() {
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        debounceId = 0;
        if (!modsEl || !document.body.contains(modsEl)) return;
        try {
          // Only re-apply when React has added new (unhidden) buttons.
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

    mo = new MutationObserver(scheduleApply);
    mo.observe(modsEl, { childList: true });
    applyBeatmapModGrid(modsEl, el);

    if (!modsEl.hasAttribute(MOD_RESET_BTN_SYNC_ATTR)) {
      modsEl.setAttribute(MOD_RESET_BTN_SYNC_ATTR, "1");
      const scheduleModStateSync = () => {
        window.clearTimeout(modStateDebounceId);
        modStateDebounceId = window.setTimeout(() => {
          modStateDebounceId = 0;
          if (modsEl && document.body.contains(modsEl)) {
            syncBeatmapModGridCloneHighlights(modsEl);
            syncBeatmapScoreboardModResetButton(modsEl);
          }
        }, 0);
      };
      modStateMo = new MutationObserver((records) => {
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
      modStateMo.observe(modsEl, {
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-pressed", "aria-disabled", "title"],
        characterData: true,
        childList: true,
      });
    }

    return () => {
      window.clearTimeout(debounceId);
      window.clearTimeout(modStateDebounceId);
      mo?.disconnect();
      mo = null;
      modStateMo?.disconnect();
      modStateMo = null;
      if (modsEl && document.body.contains(modsEl)) {
        modsEl.removeAttribute(MOD_RESET_BTN_SYNC_ATTR);
        teardownBeatmapModGrid(modsEl);
      }
      modsEl = null;
    };
  }

  // Scoreboard: age highlight (same period UI as profile top ranks)
  const SCORES_DATE_HIGHLIGHT_STYLE_ID = "osu-expertplus-ranks-date-highlight";
  const SCORES_DATE_FILTER_CLASS = "oep-ranks-date-filter";
  const SCORES_DATE_HIGHLIGHT_CLASS = "oep-ranks-date-highlight";
  const SCORES_DATE_FILTER_MARKER = "data-oep-beatmap-scores-period-filter";
  /** ended_at ms — title is cleared after tooltip bind */
  const SCORE_ROW_ENDED_MS_ATTR = "data-oep-score-ended-ms";
  const MS_PER_DAY_SCORES = 24 * 60 * 60 * 1000;
  const MS_PER_WEEK_SCORES = 7 * MS_PER_DAY_SCORES;
  const MS_PER_AVG_MONTH_SCORES = (365.25 / 12) * MS_PER_DAY_SCORES;
  const SCORES_PERIOD_IDX_MIN = 0;
  const SCORES_PERIOD_IDX_MAX = 36;
  const SCORES_PERIOD_IDX_DEFAULT = 0;
  const SCORES_PERIOD_IDX_WEEK_END = 4;
  const SCORES_PERIOD_IDX_MONTH_END = 28;
  const SCORES_PERIOD_YEAR_START_IDX = 29;
  const SCORES_PERIOD_FIRST_YEAR = 3;
  const SCORES_PERIOD_LAST_YEAR = 10;

  /** Beats osu-web `__body-row:hover .__cell` so highlight survives hover. */
  const SCORES_TABLE_HIGHLIGHT_TD = `.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row.${SCORES_DATE_HIGHLIGHT_CLASS} > td.beatmap-scoreboard-table__cell`;

  const SCORES_DATE_HIGHLIGHT_CSS = `
    .${SCORES_DATE_FILTER_CLASS} {
      box-sizing: border-box;
      margin: 0 0 1rem 0;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      max-width: 34rem;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__text {
      margin: 0 0 0.45rem 0;
      font-size: 0.9375rem;
      line-height: 1.45;
      color: rgba(255, 255, 255, 0.88);
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__period {
      color: #66ccff;
      font-weight: 600;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__tail {
      color: rgba(255, 255, 255, 0.55);
      font-weight: 400;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.65rem;
      margin-bottom: 0.45rem;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__row .oep-ranks-date-filter__text {
      margin: 0;
      flex: 1;
      min-width: 0;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-shrink: 0;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn {
      flex-shrink: 0;
      margin: 0;
      font: inherit;
      font-size: 0.8125rem;
      line-height: 1.3;
      padding: 0.28rem 0.55rem;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.82);
      cursor: pointer;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:hover {
      border-color: rgba(255, 255, 255, 0.28);
      color: rgba(255, 255, 255, 0.92);
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.35);
      outline-offset: 1px;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__reverse.oep-ranks-date-filter__reverse--on {
      border-color: rgba(102, 204, 255, 0.45);
      background: rgba(102, 204, 255, 0.1);
      color: #8fd4ff;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 22px;
      margin: 0;
      background: transparent;
      cursor: pointer;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus {
      outline: none;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus-visible {
      outline: 2px solid rgba(102, 204, 255, 0.4);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-runnable-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 15px;
      height: 15px;
      margin-top: -5px;
      border-radius: 50%;
      background: #66ccff;
      border: 2px solid rgba(255, 255, 255, 0.92);
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-track {
      height: 5px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
    }
    .${SCORES_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-thumb {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.92);
      background: #66ccff;
    }
    .play-detail.${SCORES_DATE_HIGHLIGHT_CLASS} {
      position: relative;
      border-radius: 6px;
    }
    .play-detail.${SCORES_DATE_HIGHLIGHT_CLASS}::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: rgba(102, 204, 255, 0.14);
      box-shadow: inset 0 0 0 2px rgba(102, 204, 255, 0.88);
      pointer-events: none;
      z-index: 2;
    }
    /* osu-web beatmap leaderboard: rounded row highlight; right cap is nth-last-child(2) (before popup), same as osu-web */
    ${SCORES_TABLE_HIGHLIGHT_TD},
    .beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row.${SCORES_DATE_HIGHLIGHT_CLASS}:hover > td.beatmap-scoreboard-table__cell {
      background-color: rgba(102, 204, 255, 0.14);
    }
    ${SCORES_TABLE_HIGHLIGHT_TD}:not(:first-child):not(:last-child):not(:nth-last-child(2)) {
      box-shadow:
        inset 0 2px 0 0 rgba(102, 204, 255, 0.88),
        inset 0 -2px 0 0 rgba(102, 204, 255, 0.88);
    }
    ${SCORES_TABLE_HIGHLIGHT_TD}:last-child:not(:only-child):not(:nth-last-child(2)) {
      box-shadow:
        inset 0 2px 0 0 rgba(102, 204, 255, 0.88),
        inset 0 -2px 0 0 rgba(102, 204, 255, 0.88);
    }
    ${SCORES_TABLE_HIGHLIGHT_TD}:first-child:not(:last-child) {
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
      box-shadow:
        inset 2px 0 0 0 rgba(102, 204, 255, 0.88),
        inset 0 2px 0 0 rgba(102, 204, 255, 0.88),
        inset 0 -2px 0 0 rgba(102, 204, 255, 0.88);
    }
    ${SCORES_TABLE_HIGHLIGHT_TD}:nth-last-child(2):not(:first-child) {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
      box-shadow:
        inset -2px 0 0 0 rgba(102, 204, 255, 0.88),
        inset 0 2px 0 0 rgba(102, 204, 255, 0.88),
        inset 0 -2px 0 0 rgba(102, 204, 255, 0.88);
    }
    .beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row.${SCORES_DATE_HIGHLIGHT_CLASS}:not(:has(> td:nth-child(3))) > td.beatmap-scoreboard-table__cell:last-child:not(:first-child) {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
      box-shadow:
        inset -2px 0 0 0 rgba(102, 204, 255, 0.88),
        inset 0 2px 0 0 rgba(102, 204, 255, 0.88),
        inset 0 -2px 0 0 rgba(102, 204, 255, 0.88);
    }
    ${SCORES_TABLE_HIGHLIGHT_TD}:only-child {
      border-radius: 6px;
      box-shadow: inset 0 0 0 2px rgba(102, 204, 255, 0.88);
    }
  `;

  /**
   * @param {unknown} n
   * @returns {number}
   */
  function clampScoresPeriodIndex(n) {
    let x = Math.round(Number(n));
    if (!Number.isFinite(x)) x = SCORES_PERIOD_IDX_DEFAULT;
    return Math.min(SCORES_PERIOD_IDX_MAX, Math.max(SCORES_PERIOD_IDX_MIN, x));
  }

  /**
   * @param {number} idx
   * @returns {number}
   */
  function scoresPeriodIndexToLookbackMs(idx) {
    const i = clampScoresPeriodIndex(idx);
    if (i <= 0) return 0;
    if (i <= SCORES_PERIOD_IDX_WEEK_END) return i * MS_PER_WEEK_SCORES;
    if (i <= SCORES_PERIOD_IDX_MONTH_END)
      return (i - SCORES_PERIOD_IDX_WEEK_END) * MS_PER_AVG_MONTH_SCORES;
    const years = i - SCORES_PERIOD_YEAR_START_IDX + SCORES_PERIOD_FIRST_YEAR;
    return years * 12 * MS_PER_AVG_MONTH_SCORES;
  }

  /**
   * @param {number} idx
   * @returns {string}
   */
  function formatScoresPeriodShortLabel(idx) {
    const i = clampScoresPeriodIndex(idx);
    if (i <= 0) return "No highlight";
    if (i <= SCORES_PERIOD_IDX_WEEK_END)
      return i === 1 ? "1 week" : `${i} weeks`;
    if (i <= SCORES_PERIOD_IDX_MONTH_END) {
      const mo = i - SCORES_PERIOD_IDX_WEEK_END;
      return mo === 1 ? "1 month" : `${mo} months`;
    }
    const y = i - SCORES_PERIOD_YEAR_START_IDX + SCORES_PERIOD_FIRST_YEAR;
    return `${y} years`;
  }

  /**
   * @returns {number}
   */
  function readStoredScoresPeriodIndex() {
    // Score-date filter should not persist between navigations.
    // Always default to "off" so nothing is highlighted on page open.
    return SCORES_PERIOD_IDX_DEFAULT;
  }

  /**
   * @param {HTMLElement} statusEl
   * @param {HTMLElement} tailEl
   * @param {number} periodIdx
   * @param {boolean} reversed
   */
  function setScoresFilterBarLabels(statusEl, tailEl, periodIdx, reversed) {
    const i = clampScoresPeriodIndex(periodIdx);
    if (i === 0) {
      statusEl.textContent = "No highlight";
      tailEl.textContent = " — drag to set a period.";
    } else {
      statusEl.textContent = formatScoresPeriodShortLabel(i);
      tailEl.textContent = reversed
        ? " · older scores highlighted"
        : " · recent scores highlighted";
    }
  }

  /**
   * @param {Element} rowEl
   * @returns {number|null}
   */
  function getBeatmapScoreRowTimeMs(rowEl) {
    if (rowEl instanceof HTMLElement) {
      const cached = rowEl.getAttribute(SCORE_ROW_ENDED_MS_ATTR);
      if (cached != null && cached !== "") {
        const parsed = Number(cached);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    const t =
      rowEl.querySelector("time.js-tooltip-time") ||
      rowEl.querySelector(".play-detail__time time[datetime]") ||
      rowEl.querySelector("time.js-timeago") ||
      rowEl.querySelector("time.timeago") ||
      rowEl.querySelector("time[datetime]");
    if (!t) return null;
    const iso =
      t.getAttribute("datetime") || t.getAttribute("title")?.trim() || null;
    if (!iso) return null;
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    if (rowEl instanceof HTMLElement) {
      rowEl.setAttribute(SCORE_ROW_ENDED_MS_ATTR, String(ms));
    }
    return ms;
  }

  const scoresDateStyle = manageStyle(
    SCORES_DATE_HIGHLIGHT_STYLE_ID,
    SCORES_DATE_HIGHLIGHT_CSS,
  );

  function injectBeatmapScoresDateHighlightStyles() {
    scoresDateStyle.inject();
  }

  /**
   * @param {ParentNode} scoreboardRoot
   * @param {number} periodIdx
   * @param {boolean} reversed
   */
  function applyBeatmapScoresDateHighlights(
    scoreboardRoot,
    periodIdx,
    reversed,
  ) {
    const i = clampScoresPeriodIndex(periodIdx);
    const rows = scoreboardRoot.querySelectorAll(
      ".play-detail-list > .play-detail, .beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row",
    );
    if (i === 0) {
      rows.forEach((row) => {
        row.classList.remove(SCORES_DATE_HIGHLIGHT_CLASS);
        row.removeAttribute(SCORE_ROW_ENDED_MS_ATTR);
      });
      return;
    }
    const lookback = scoresPeriodIndexToLookbackMs(i);
    const cutoff = Date.now() - lookback;
    rows.forEach((row) => {
      const t = getBeatmapScoreRowTimeMs(row);
      if (t == null) {
        row.classList.remove(SCORES_DATE_HIGHLIGHT_CLASS);
        return;
      }
      const inWindow = t >= cutoff;
      const highlight = reversed ? !inWindow : inWindow;
      row.classList.toggle(SCORES_DATE_HIGHLIGHT_CLASS, highlight);
    });
  }

  /**
   * @returns {HTMLElement|null}
   */
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
   * @param {HTMLElement} scoreboardRoot
   * @param {HTMLElement} wrap
   */
  function insertBeatmapScoresDateFilterBar(scoreboardRoot, wrap) {
    const firstList = scoreboardRoot.querySelector(".play-detail-list");
    if (firstList?.parentNode) {
      firstList.parentNode.insertBefore(wrap, firstList);
      return;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    if (main) {
      main.insertBefore(wrap, main.firstChild);
      return;
    }
    const tableWrap = scoreboardRoot.querySelector(".beatmap-scoreboard-table");
    if (tableWrap?.parentNode) {
      tableWrap.parentNode.insertBefore(wrap, tableWrap);
      return;
    }
    scoreboardRoot.insertBefore(wrap, scoreboardRoot.firstChild);
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   */
  function ensureBeatmapScoresDateFilterBar(scoreboardRoot) {
    if (scoreboardRoot.querySelector(`[${SCORES_DATE_FILTER_MARKER}]`)) return;

    const periodIdx = readStoredScoresPeriodIndex();
    const reversedStored = false;

    const statusEl = el("strong", { class: "oep-ranks-date-filter__period" });
    const tailEl = el("span", { class: "oep-ranks-date-filter__tail" });
    setScoresFilterBarLabels(statusEl, tailEl, periodIdx, reversedStored);

    const resetBtn = el(
      "button",
      {
        type: "button",
        class: "oep-ranks-date-filter__btn oep-ranks-date-filter__reset",
        "aria-label": "Reset period and reverse filter",
      },
      "Reset",
    );

    const revBtn = el(
      "button",
      {
        type: "button",
        class: `oep-ranks-date-filter__btn oep-ranks-date-filter__reverse${reversedStored ? " oep-ranks-date-filter__reverse--on" : ""}`,
        "aria-pressed": reversedStored ? "true" : "false",
        "aria-label": "Reverse highlight to older scores outside the period",
      },
      "Reverse",
    );

    const range = el("input", {
      type: "range",
      class: "oep-ranks-date-filter__range",
      min: String(SCORES_PERIOD_IDX_MIN),
      max: String(SCORES_PERIOD_IDX_MAX),
      step: "1",
      value: String(periodIdx),
    });
    range.setAttribute(
      "aria-label",
      "Highlight window: off, then weeks, months, and years",
    );

    const readReversed = () => revBtn.getAttribute("aria-pressed") === "true";

    const wrap = el(
      "div",
      {
        class: SCORES_DATE_FILTER_CLASS,
        [SCORES_DATE_FILTER_MARKER]: "1",
      },
      el(
        "div",
        { class: "oep-ranks-date-filter__row" },
        el("p", { class: "oep-ranks-date-filter__text" }, statusEl, tailEl),
        el(
          "div",
          { class: "oep-ranks-date-filter__actions" },
          resetBtn,
          revBtn,
        ),
      ),
      range,
    );
    insertBeatmapScoresDateFilterBar(scoreboardRoot, wrap);

    range.addEventListener("input", () => {
      const idx = clampScoresPeriodIndex(range.value);
      setScoresFilterBarLabels(statusEl, tailEl, idx, readReversed());
      applyBeatmapScoresDateHighlights(scoreboardRoot, idx, readReversed());
    });

    revBtn.addEventListener("click", () => {
      const next = revBtn.getAttribute("aria-pressed") !== "true";
      revBtn.setAttribute("aria-pressed", next ? "true" : "false");
      revBtn.classList.toggle("oep-ranks-date-filter__reverse--on", next);
      const idx = clampScoresPeriodIndex(range.value);
      setScoresFilterBarLabels(statusEl, tailEl, idx, next);
      applyBeatmapScoresDateHighlights(scoreboardRoot, idx, next);
    });

    resetBtn.addEventListener("click", () => {
      range.value = String(SCORES_PERIOD_IDX_DEFAULT);
      revBtn.setAttribute("aria-pressed", "false");
      revBtn.classList.remove("oep-ranks-date-filter__reverse--on");
      setScoresFilterBarLabels(
        statusEl,
        tailEl,
        SCORES_PERIOD_IDX_DEFAULT,
        false,
      );
      applyBeatmapScoresDateHighlights(
        scoreboardRoot,
        SCORES_PERIOD_IDX_DEFAULT,
        false,
      );
    });
  }

  /**
   * @param {HTMLElement} scoreboardRoot
   */
  function syncBeatmapScoresDateHighlight(scoreboardRoot) {
    ensureBeatmapScoresDateFilterBar(scoreboardRoot);
    const wrap = scoreboardRoot.querySelector(`[${SCORES_DATE_FILTER_MARKER}]`);
    const range =
      wrap instanceof HTMLElement
        ? wrap.querySelector('input[type="range"]')
        : null;
    const idx = range
      ? clampScoresPeriodIndex(/** @type {HTMLInputElement} */ (range).value)
      : readStoredScoresPeriodIndex();
    if (
      range instanceof HTMLInputElement &&
      String(range.value) !== String(idx)
    ) {
      range.value = String(idx);
    }
    const revBtn =
      wrap instanceof HTMLElement
        ? wrap.querySelector(".oep-ranks-date-filter__reverse")
        : null;
    const reversed =
      revBtn instanceof HTMLElement
        ? revBtn.getAttribute("aria-pressed") === "true"
        : false;
    applyBeatmapScoresDateHighlights(scoreboardRoot, idx, reversed);
  }

  /**
   * @param {RegExp} pathRe
   * @returns {function(): void}
   */
  function startBeatmapScoresDateHighlightManager(pathRe) {
    injectBeatmapScoresDateHighlightStyles();
    let debounceTimer = 0;

    const clearBeatmapScoreHighlights = () => {
      const clearIn = (root) => {
        root
          .querySelectorAll(
            `.play-detail.${SCORES_DATE_HIGHLIGHT_CLASS}, tr.${SCORES_DATE_HIGHLIGHT_CLASS}`,
          )
          .forEach((row) => {
            row.classList.remove(SCORES_DATE_HIGHLIGHT_CLASS);
            row.removeAttribute(SCORE_ROW_ENDED_MS_ATTR);
          });
      };
      document
        .querySelectorAll(`[${SCORES_DATE_FILTER_MARKER}]`)
        .forEach((wrap) => {
          const root = wrap.parentElement;
          if (root) clearIn(root);
        });
      document
        .querySelectorAll(".beatmapset-scoreboard")
        .forEach((board) => clearIn(board));
    };

    const run = () => {
      if (!pathRe.test(location.pathname)) {
        clearBeatmapScoreHighlights();
        document
          .querySelectorAll(`[${SCORES_DATE_FILTER_MARKER}]`)
          .forEach((n) => n.remove());
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      syncBeatmapScoresDateHighlight(root);
      syncBeatmapScoreboardPpDecimals(root);
      syncBeatmapScoreboardHitstatColors(root);
      syncBeatmapScoreboardPpValueColor(root);
    };

    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 64);
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
      clearBeatmapScoreHighlights();
      document
        .querySelectorAll(`[${SCORES_DATE_FILTER_MARKER}]`)
        .forEach((n) => n.remove());
      scoresDateStyle.remove();
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
        const isNewDiscussionRoot =
          root.classList.contains("beatmap-discussion-new");
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

  const EXTENDED_LEADERBOARD_FEATURE_ID =
    "beatmapDetail.apiExtendedLeaderboard";
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
    const chain = [
      () => inRoot(".beatmap-scoreboard-table__mods .beatmap-scoreboard-mod"),
      () => inRoot(".beatmap-scoreboard-table__body .beatmap-scoreboard-mod"),
      () =>
        document.querySelector(
          ".beatmapset-scoreboard__mods .beatmap-scoreboard-mod",
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
   * Main score column value (prefer classic/legacy when osu shows it; else lazer total).
   * @param {object} s
   */
  function leaderboardTableScoreNumber(s) {
    const nz = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    const leg = nz(s.legacy_total_score);
    const tot = nz(s.total_score);
    const cls = nz(s.classic_total_score);
    const raw = nz(s.score);
    if (leg) return leg;
    if (tot) return tot;
    if (cls) return cls;
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
   * @param {HTMLTableCellElement|null|undefined} td
   * @param {string|number|null|undefined} scoreId
   */
  function setScoreboardTdScoreLink(td, scoreId) {
    if (!td || scoreId == null) return;
    const id = String(scoreId);
    td.querySelectorAll("a.beatmap-scoreboard-table__cell-content").forEach(
      (a) => {
        if (a instanceof HTMLAnchorElement) {
          a.href = `https://osu.ppy.sh/scores/${id}`;
        }
      },
    );
  }

  /**
   * Extended leaderboard scores: prefer the real score id field for links.
   * Some API variants omit `id` and use `score_id` instead.
   * @param {object|null|undefined} score
   * @returns {string|null}
   */
  function leaderboardScoreId(score) {
    if (!score || typeof score !== "object") return null;
    const raw =
      score.id ??
      score.best_id ??
      score.legacy_score_id ??
      score.score_id ??
      score.scoreId ??
      score.scoreID ??
      score.score?.id ??
      score.score?.best_id ??
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
    const perfect = hasMapFull
      ? maxCombo > 0 && maxCombo === mapFull
      : Number.isFinite(maxComboFromStats) &&
        maxComboFromStats > 0 &&
        maxCombo === maxComboFromStats;
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
        a.replaceChildren(s);
      } else {
        a.replaceChildren(document.createTextNode("—"));
      }
      return;
    }
    const ppNumber = Number(pp);
    const ppText = String(Math.round(ppNumber * 1000) / 1000).replace(
      /\.0+$/,
      "",
    );
    if (refSpan) {
      const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
      s.textContent = ppText;
      s.setAttribute("title", ppText);
      s.setAttribute("data-orig-title", ppText);
      a.replaceChildren(s);
    } else {
      a.replaceChildren(document.createTextNode(ppText));
    }
  }

  /**
   * Native scoreboard rows keep full pp in `span[title]` while visible text is integer.
   * Mirror user-profile behavior for this page when score-list details are enabled.
   * @param {HTMLElement|null|undefined} scoreboardRoot
   */
  function syncBeatmapScoreboardPpDecimals(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const showPpDecimals = Boolean(
      settings?.isEnabled?.(SCORE_LIST_DETAILS_ID),
    );
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
          "a.beatmap-scoreboard-table__cell-content > span[title]",
        );
        if (!(span instanceof HTMLSpanElement)) continue;
        const textNode = Array.from(span.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE,
        );
        if (!textNode) continue;
        const full = span.getAttribute("title");
        const n = Number(String(full || "").replace(/,/g, ""));
        if (!Number.isFinite(n)) continue;

        if (showPpDecimals) {
          if (!span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
            span.setAttribute(
              SCOREBOARD_PP_ORIGINAL_ATTR,
              String(textNode.textContent || "").trim(),
            );
          }
          textNode.textContent = n.toFixed(2);
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

  function patchBeatmapScoreboardModButton(btn, acronym) {
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    mi?.stripOepModAcronymFromClonedMod?.(btn);
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

    // Mirror `user-profile` patch: strip hover/extra UI remnants.
    btn.querySelector(".mod__extender")?.remove();
    btn.querySelector(".mod__customised-indicator")?.remove();
    btn.title = full;
    btn.setAttribute("aria-label", full);
    btn.setAttribute("data-original-title", full);
    btn.setAttribute("data-qtip", full);
    btn.setAttribute("data-tooltip", full);
    if (modRoot instanceof HTMLElement) {
      modRoot.title = full;
      // osu-web's tooltip is wired to the inner `.mod` element via `data-orig-title`.
      // (In the native DOM: `.mod` has `data-orig-title="Easy"` even when the button
      // wrapper has the correct `data-qtip`.)
      modRoot.setAttribute("data-orig-title", full);
    }
    if (icon instanceof HTMLElement) {
      icon.title = full;
      icon.setAttribute("aria-label", full);
      icon.setAttribute("data-original-title", full);
      icon.setAttribute("data-qtip", full);
      icon.setAttribute("data-tooltip", full);
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
        patchBeatmapScoreboardModButton(btn, ac);
        wrap.appendChild(btn);
      }
    } else if (list.length) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        const typeClass =
          mi?.modTypeClassForAcronym?.(ac) || "mod--type-Automation";
        const full = modFullName(ac);
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
            el("div", {
              class: `mod__icon mod__icon--${safe}`,
              "data-acronym": ac,
              title: full,
              "aria-label": full,
              "data-original-title": full,
              "data-qtip": full,
              "data-tooltip": full,
            }),
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
    const bg = td.querySelector(
      "a.beatmap-scoreboard-table__cell-content.bg-link",
    );
    const scoreId = leaderboardScoreId(score);
    if (bg instanceof HTMLAnchorElement && scoreId != null) {
      bg.href = `https://osu.ppy.sh/scores/${scoreId}`;
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
    const scoreId = leaderboardScoreId(score);
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
    setScoreboardTdScoreLink(td, scoreId);
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
    // Use real table cell indices (works with colspans and hidden columns).
    const tds = [...tr.cells];
    const scoreId = leaderboardScoreId(score);
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
      setScoreboardTdScoreLink(tds[colMap.rank], scoreId);
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
      setScoreboardTdScoreLink(tds[colMap.score], scoreId);
    }

    if (colMap.accuracy != null) {
      applyScoreboardAccuracyCell(
        tds[colMap.accuracy],
        scoreboardRefTd(templateRow, colMap.accuracy),
        score,
      );
      setScoreboardTdScoreLink(tds[colMap.accuracy], scoreId);
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
      const bg = td.querySelector(
        "a.beatmap-scoreboard-table__cell-content.bg-link",
      );
      if (bg && scoreId != null) {
        bg.href = `https://osu.ppy.sh/scores/${scoreId}`;
      }
    }

    if (colMap.combo != null) {
      applyScoreboardComboCell(
        tds[colMap.combo],
        scoreboardRefTd(templateRow, colMap.combo),
        score,
        mapFullCombo,
      );
      setScoreboardTdScoreLink(tds[colMap.combo], scoreId);
    }

    for (const i of colMap.hitstatIndices || []) {
      const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
      const refHit = scoreboardRefTd(templateRow, i);
      applyScoreboardTextCellLikeRef(
        tds[i],
        refHit,
        hitstatTextFromHeaderLabel(label, score),
      );
      setScoreboardTdScoreLink(tds[i], scoreId);
    }

    if (colMap.pp != null && tds[colMap.pp]) {
      applyScoreboardPpCell(
        tds[colMap.pp],
        scoreboardRefTd(templateRow, colMap.pp),
        score,
      );
      setScoreboardTdScoreLink(tds[colMap.pp], scoreId);
    }

    if (colMap.time != null && tds[colMap.time] && iso) {
      setScoreboardTdScoreLink(tds[colMap.time], scoreId);
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
   * Destroy osu-web qtip on the favourite stat so the native user-list popup does not appear.
   * @param {HTMLElement|null} el
   */
  function destroyFavouriteStatQtip(el) {
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
   * Hover popover on the favourite count (heart) with API recent_favourites; replaces osu! qtip list.
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
          title: name,
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
   */
  function renderOmdbRatingRowBody(bodyEl, entry, distUi, header) {
    bodyEl.classList.remove(
      `${OEP_OMDB_ROW_CLASS}__body--muted`,
      `${OEP_OMDB_ROW_CLASS}__body--error`,
    );
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
      renderOmdbRatingRowBody(bodyEl, byBeatmapId.get(id), omdbDistUi, header);
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
    /** @type {null|(() => void)} */
    let modGridCleanup = null;

    const bag = createCleanupBag();

    const cleanup = () => {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      try {
        metadataInfoModal?.dispose();
      } catch (_) {}
      metadataInfoModal = null;
      try {
        descriptionInfoModal?.dispose();
      } catch (_) {}
      descriptionInfoModal = null;
      /* After modal buttons are removed from the DOM; bag may unwrap description markup. */
      bag.dispose();
    };

    await waitForStaleElementToLeave(BEATMAPSET_HEADER_STALE_SEL);

    let header;
    try {
      header = await waitForElement(".beatmapset-header", 15000);
    } catch (_) {
      return cleanup;
    }

    header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");

    if (!document.body.contains(header)) return cleanup;

    if (!pathRe.test(location.pathname)) return cleanup;

    bag.add(startBeatmapScoresDateHighlightManager(pathRe));
    bag.add(startBeatmapDiscussionPreviewManager(pathRe));
    bag.add(startDiscussionTabLinkPatcher(beatmapsetId));
    bag.add(mountBeatconnectDownloadSplit(header, beatmapsetId));
    bag.add(startBeatmapsetFavouriteButtonPinkIndicator(header));

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
      settings.onChange(SCORE_LIST_DETAILS_ID, () => {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) syncBeatmapScoreboardPpDecimals(root);
      }),
    );

    setupBeatmapScoreboardModGrid().then((fn) => {
      if (!pathRe.test(location.pathname)) {
        try {
          fn();
        } catch (_) {}
        return;
      }
      modGridCleanup = fn;
    });

    const data = readBeatmapsetJson();

    bag.add(
      setupBeatmapsetFavouriteHoverPopover(
        header,
        beatmapsetId,
        pathRe,
        data?.favourite_count,
      ),
    );

    const artistEl = header.querySelector(
      ".beatmapset-header__details-text--artist",
    );
    if (
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

    try {
      const infoRoot = await waitForElement(".beatmapset-info", 12000);
      if (pathRe.test(location.pathname) && document.body.contains(header)) {
        // Between `.beatmapset-header` and `.beatmapset-info` (sibling in `.osu-page--generic-compact`).
        if (
          settings.isEnabled(BEATMAP_PREVIEW_ID) &&
          beatmapPreview &&
          !document.querySelector("[data-oep-beatmap-preview-root]")
        ) {
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
          infoRoot.insertAdjacentElement("beforebegin", previewSection);
          bag.add(() => {
            previewUi.dispose();
            previewSection.remove();
          });
        }

        const firstBox = infoRoot.querySelector(
          ":scope > .beatmapset-info__box",
        );
        const scrollEl = firstBox?.querySelector(
          ":scope > .beatmapset-info__scrollable",
        );
        // osu-web used to wrap description HTML in `.beatmapset-info__description`; current
        // `info.tsx` uses a classless div, so fall back to the first row in the first box.
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
          descRow instanceof HTMLElement &&
          descHeading instanceof HTMLElement &&
          !descRow.querySelector("[data-oep-beatmapset-desc]")
        ) {
          descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
          bag.add(() => {
            descRow.classList.remove(`${ROOT_CLASS}__description-heading-row`);
            const headWrap = descRow.querySelector(
              `:scope > .${ROOT_CLASS}__description-sticky-head`,
            );
            if (headWrap) {
              const h = headWrap.querySelector(
                ":scope > h3.beatmapset-info__header",
              );
              if (h) descRow.insertBefore(h, headWrap);
              headWrap.remove();
            }
          });
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
          class: "btn-osu-big btn-osu-big--beatmapset-header",
          href: backgroundUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-bg": "",
        },
        el(
          "span",
          { class: "btn-osu-big__content" },
          el(
            "span",
            { class: "btn-osu-big__left" },
            el("span", { class: "btn-osu-big__text-top" }, "Open background"),
          ),
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
      const directBtn = findBeatmapsetOsuDirectButton(headerButtons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", bgLink);
      } else {
        headerButtons.appendChild(bgLink);
      }
      bag.add(() => {
        bgLink.remove();
      });
    }

    return cleanup;
  }

  return { name, init };
})();
