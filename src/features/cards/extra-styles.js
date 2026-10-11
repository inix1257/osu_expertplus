/**
 * Beatmap card extras: class names, panel state attributes and the
 * shared style (WS-50).
 */

import { manageStyle } from "../legacy.js";
const STYLE_ID = "osu-expertplus-beatmap-card-extra-css";
export const BLOCK_CLASS = "oep-beatmap-card-extra";
/** Per-mode star range after `.beatmapset-panel__extra-item--dots` (non-hover). */
export const STAR_RANGE_CLASS = "oep-beatmap-card-extra__star-range";
/** Reserved row between artist and mapper; always same min height. */
export const SOURCE_SLOT_CLASS = "oep-beatmap-card-extra__source-slot";
/** Set to beatmapset id when done, or "loading" while fetching. */
export const PANEL_STATE_ATTR = "data-oep-card-extra";
/** Cache version of the panel's set when it was drawn; it is redrawn when the set's version changes. */
export const PANEL_CACHE_EPOCH_ATTR = "data-oep-card-extra-epoch";
/** Present when source + BPM/length (extra metadata) was applied for current epoch. */
export const PANEL_RENDERED_META_ATTR = "data-oep-card-extra-meta";
/** Present when star range chips were applied for current epoch. */
export const PANEL_RENDERED_STARS_ATTR = "data-oep-card-extra-stars";

export const style = manageStyle(
  STYLE_ID,
  `
  .beatmapset-panel:has(.${BLOCK_CLASS}),
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}),
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) {
    height: auto !important;
    min-height: var(--panel-height);
    overflow: visible;
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__content,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__content,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__content {
    height: auto !important;
    min-height: var(--panel-height);
    align-items: stretch;
    overflow: visible;
    position: relative;
    z-index: 1;
    isolation: isolate;
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__menu-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__menu-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__menu-container {
    align-self: stretch;
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-col--info,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-col--info,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-col--info {
    align-self: stretch;
  }
  /* Cover link is a sibling before __content (abs. over the whole card). In-flow height comes only
     from __content; subpixel layout vs the panel translateZ(0) layer can show 1–2px of panel
     background at the rounded bottom. Match card radius, clip children, composited layer. */
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-container {
    top: 0 !important;
    bottom: 0 !important;
    height: auto !important;
    min-height: var(--panel-height);
    border-radius: inherit;
    overflow: hidden;
    transform: translateZ(0);
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__info,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__info {
    overflow: visible;
    align-self: stretch;
  }

  /* API source lives in our slot; hide osu’s row so we don’t get two lines. */
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info-row--source {
    display: none !important;
  }

  /* Match osu --source row; single line with ellipsis (flex min-width:0 so truncation works). */
  .beatmapset-panel__info-row.${SOURCE_SLOT_CLASS} {
    color: hsl(var(--hsl-c2));
    font-weight: 700;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
  .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-slot-line {
    box-sizing: border-box;
    flex: 1 1 0;
    min-width: 0;
    max-width: 100%;
    min-height: 1.35em;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-placeholder {
    display: inline-block;
  }

  /* Flush with neighbouring .beatmapset-panel__info-row (no extra band above BPM/length). */
  .${BLOCK_CLASS} {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  .${BLOCK_CLASS}__source-text {
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 86%));
  }
  /* BPM / length: inherit font from panel; tune colour, spacing, shadow, truncation. */
  .${BLOCK_CLASS}__meta {
    margin: 0;
    padding: 0;
    max-width: 100%;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
    opacity: 0.9;
    color: hsl(var(--hsl-c2, 333 60% 68%));
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Max SR per mode: wrapper + one pill (spectrum by highest difficulty in that mode). */
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots .${STAR_RANGE_CLASS} {
    margin-left: 0.45em;
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.2em;
    flex-shrink: 0;
    white-space: nowrap;
    line-height: 1;
    font-size: max(10px, 0.82em);
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    padding: 0.2em 0.62em;
    min-height: 14px;
    border-radius: 10000px;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    border: none;
    flex-shrink: 0;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-inner {
    display: inline-flex;
    align-items: stretch;
    flex-wrap: nowrap;
    column-gap: 0.1em;
    line-height: 1;
    color: inherit;
    min-width: 0;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-up {
    font-size: 0.58em;
    line-height: 1;
    color: inherit;
    opacity: 0.92;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-up::before {
    display: block;
    line-height: 1;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-icon {
    font-size: 0.72em;
    line-height: 1;
    color: inherit;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-icon::before {
    display: block;
    line-height: 1;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-val {
    font-variant-numeric: tabular-nums;
    color: inherit;
    flex-shrink: 0;
    line-height: 1;
    display: flex;
    align-items: center;
  }
`,
);
