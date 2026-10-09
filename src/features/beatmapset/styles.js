/**
 * Beatmapset page stylesheet (WS-33, moved out of beatmap-detail): header
 * buttons, info modals, favourites popover, picker names and OMDB.
 */

import {
  BEATCONNECT_DL_BTN_CLASS,
  BEATCONNECT_DL_PAIRED_CLASS,
  BEATCONNECT_STACK_CLASS,
  BEATCONNECT_STACK_ICON_CLASS,
  BEATCONNECT_STACK_LABEL_CLASS,
  BEATMAPSET_FAV_BTN_FAVOURITED_CLASS,
  OEP_OMDB_ROW_CLASS,
  OEP_OMDB_VOTE_CLASS,
  OEP_OMDB_WRAP_CLASS,
  ROOT_CLASS,
} from "./constants.js";

export const BEATMAPSET_STYLE_ID = "osu-expertplus-beatmap-detail-css";

export const BEATMAPSET_CSS = `
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
