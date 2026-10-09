/**
 * Scoreboard stylesheets (WS-32, moved out of the beatmap-detail
 * stylesheet): the table, tools row and injected rows, and the mod grid.
 */

import {
  MOD_GRID_CLASS,
  MOD_HIDDEN_ATTR,
  RATE_EDIT_ROW_ATTR,
  ROW_HIDE_ATTR,
  SCORE_USER_SEARCH_RESULT_ATTR,
  WILDCARD_DUPE_ROW_ATTR,
  WILDCARD_LOADING_CLASS,
} from "./context.js";
import { MERGED_NOTICE_CLASS } from "./merged-leaderboard.js";
import {
  MOD_GRID_ATTR,
  MOD_GRID_COLLAPSED_CLASS,
  MOD_WILDCARD_CLASS,
} from "./mod-filter/state.js";

export const SCOREBOARD_STYLE_ID = "osu-expertplus-beatmap-scoreboard-css";

export const SCOREBOARD_CSS = `
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
  /* Global rank badge next to the leaderboard username. */
  .oep-scoreboard-rank-badge {
    display: inline-flex;
    align-items: baseline;
    margin-left: 0.4em;
    padding: 0.05em 0.45em;
    border-radius: 999px;
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--hsl-l1, 0 0% 80%));
    background: hsla(0, 0%, 100%, 0.08);
    vertical-align: middle;
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
    margin-bottom: 0.6rem;
    max-width: 34rem;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.5);
    min-height: 1em;
  }
  .oep-user-search--no-api .oep-user-search__input:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
  /* Searched-user result row — works both in the mini-table and in the real table */
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__cell,
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}]:hover > td.beatmap-scoreboard-table__cell {
    background-color: rgba(167, 139, 250, 0.12);
  }
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__cell:first-child {
    box-shadow: inset 3px 0 0 rgba(167, 139, 250, 0.55);
  }
  /* Cloned row includes osu-web’s hover-only ⋯ menu column; hide for lookup result */
  tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__popup-menu {
    display: none !important;
  }
  /* Rows hidden by the rate filter or a merged leaderboard (see ROW_HIDE_ATTR). */
  tr[${ROW_HIDE_ATTR}] {
    display: none !important;
  }
  /* Empty or failed wildcard merge. */
  tr.${MERGED_NOTICE_CLASS} > td {
    padding: 1.5rem 0.5rem;
    text-align: center;
    color: hsl(var(--hsl-l2, 0 0% 70%));
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

export const MOD_GRID_STYLE_ID = "osu-expertplus-beatmap-mod-grid-css";

export const MOD_GRID_CSS = `

  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
    display: grid !important;
    gap: 8px 12px;
    align-items: start;
    justify-items: stretch;
    margin-bottom: 1.5rem;
    text-align: start;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] > .beatmap-scoreboard-mod[${MOD_HIDDEN_ATTR}] {
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
`;
