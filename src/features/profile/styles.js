/**
 * Stylesheet of the profile score rows, Recent and the options menu (WS-41).
 */

import { manageStyle } from "../legacy.js";
import {
  MW_PP_CLASS,
  PLAY_DETAIL_DESKTOP_TUNING,
  PLAY_DETAIL_STYLE_ID,
  SCORE_LIST_LAYOUT_SEL,
  SCORE_LIST_PP_DECIMALS_CLASS,
} from "./score-rows.js";
const PLAY_DETAIL_CSS = `
  .oep-hidden { display: none !important; }

  .play-detail__beatmap-and-time {
    align-items: center;
  }

  ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    text-align: left;
    box-sizing: border-box;
  }

  ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35em;
    width: 100%;
    min-width: 0;
    flex: 1 1 0;
    box-sizing: border-box;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    min-width: 0;
    overflow: visible;
  }
  ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail .play-detail__accuracy {
    font-weight: 700;
    font-size: 15px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col .play-detail__accuracy {
    flex-shrink: 0;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col .oep-score-stats {
    margin-top: 0;
  }

  @media (min-width: 900px) {
    ${SCORE_LIST_LAYOUT_SEL} .play-detail {
      align-items: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--top {
      flex: 1 1 0% !important;
      min-width: 0;
      align-items: flex-start !important;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__detail {
      min-width: 0;
      align-items: flex-start;
      text-align: left;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--bottom {
      flex: 0 0 auto;
      flex-wrap: nowrap;
      align-items: stretch;
      align-self: stretch;
      box-sizing: border-box;
      --oep-mods-col-max: ${PLAY_DETAIL_DESKTOP_TUNING.modsColMaxWidth};
      --oep-accuracy-col: ${PLAY_DETAIL_DESKTOP_TUNING.accuracyColWidth};
      --oep-combo-stats-col: ${PLAY_DETAIL_DESKTOP_TUNING.comboStatsColWidth};
      --oep-mid-gap: ${PLAY_DETAIL_DESKTOP_TUNING.midGap};
      --oep-score-detail-pad-x: 20px;
      --oep-score-detail-gap: 10px;
      --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
    }

    ${SCORE_LIST_LAYOUT_SEL}.${SCORE_LIST_PP_DECIMALS_CLASS} .play-detail__group--bottom {
      --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppColWidth};
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__mods {
      flex: 0 0 auto;
      width: max-content;
      max-width: var(--oep-mods-col-max);
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      box-sizing: border-box;
      align-self: stretch;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail {
      flex: 0 0
        calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
      width: calc(
        var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: calc(
        var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      min-width: 0;
      overflow: hidden;
      box-sizing: border-box;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
      flex: 1 1 0;
      margin-left: 10px;
      width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      min-width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      overflow: hidden;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__pp {
      --desktop-width: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
      flex: 0 0 var(--oep-pp-track);
      width: var(--oep-pp-track);
      min-width: var(--oep-pp-track);
      max-width: var(--oep-pp-track);
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
      flex-direction: row;
      align-items: center;
      gap: var(--oep-mid-gap);
      width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: 100%;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
      flex: 0 0 var(--oep-accuracy-col);
      width: var(--oep-accuracy-col);
      max-width: var(--oep-accuracy-col);
      min-width: var(--oep-accuracy-col);
      font-variant-numeric: tabular-nums;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
      flex: 0 0 var(--oep-combo-stats-col);
      width: var(--oep-combo-stats-col);
      max-width: var(--oep-combo-stats-col);
      overflow: hidden;
    }
  }

  ${SCORE_LIST_LAYOUT_SEL} .play-detail__accuracy-and-weighted-pp {
    display: flex;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0 0.5em;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-content: flex-start;
    box-sizing: border-box;
  }
  .play-detail-list .play-detail__accuracy-and-weighted-pp {
    display: flex;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0 0.5em;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-content: flex-start;
    box-sizing: border-box;
  }

  .play-detail-list .oep-mid-cols {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.28em;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    box-sizing: border-box;
  }
  .play-detail-list .oep-accuracy-col {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    min-width: 0;
    overflow: visible;
    font-variant-numeric: tabular-nums;
  }
  .play-detail-list .oep-accuracy-col .play-detail__accuracy {
    flex-shrink: 0;
  }
  .play-detail-list .play-detail__score-detail .play-detail__accuracy {
    font-weight: 700;
    font-size: 15px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline {
    font-weight: 700;
    font-size: 15px;
    white-space: nowrap;
    flex-shrink: 0;
    text-align: right;
    padding-right: 0.12em;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num {
    font-weight: 500;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num--full {
    color: #9beb5b;
    font-weight: 800;
  }

  .play-detail-list .oep-combo-inline {
    font-weight: 700;
    font-size: 15px;
    white-space: nowrap;
    flex-shrink: 0;
    text-align: right;
    padding-right: 0.12em;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  .play-detail-list .oep-combo-inline__num {
    font-weight: 500;
  }
  .play-detail-list .oep-combo-inline__num--full {
    color: #9beb5b;
    font-weight: 800;
  }

  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 3px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
    font-size: 13px;
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.75;
    margin-top: 3px;
    line-height: 1;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__sep {
    opacity: 0.35;
    margin: 0 1px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--300     { color: #78dcff; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--100     { color: #84e03a; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--50      { color: #e0b03a; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--miss    { color: #e05c5c; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--perfect { color: #ffd700; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--good    { color: #6ee0c0; }
  .play-detail-list .oep-score-stats {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 3px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
    font-size: 13px;
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.75;
    margin-top: 3px;
    line-height: 1;
  }
  .play-detail-list .oep-score-stats__sep {
    opacity: 0.35;
    margin: 0 1px;
  }
  .play-detail-list .oep-score-stats__val--300     { color: #78dcff; }
  .play-detail-list .oep-score-stats__val--100     { color: #84e03a; }
  .play-detail-list .oep-score-stats__val--50      { color: #e0b03a; }
  .play-detail-list .oep-score-stats__val--miss    { color: #e05c5c; }
  .play-detail-list .oep-score-stats__val--perfect { color: #ffd700; }
  .play-detail-list .oep-score-stats__val--good    { color: #6ee0c0; }

  .oep-sr-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: max(11px, 0.82em);
    padding: 0.22em 0.55em;
    min-width: ${PLAY_DETAIL_DESKTOP_TUNING.srBadgeMinWidth};
    min-height: 1.35em;
    border-radius: 10000px;
    margin: 0 -0.55rem 0 0;
    flex-shrink: 0;
    vertical-align: middle;
    line-height: 1;
    border: none;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
  }
  .oep-sr-badge__inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    column-gap: 0.1em;
    flex: 0 0 auto;
    min-width: 0;
    line-height: 1;
  }
  .oep-sr-badge__val {
    flex: 0 0 auto;
    width: auto;
    max-width: none;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .oep-sr-badge__inner .oep-sr-badge__icon {
    font-size: 0.65em;
    line-height: 1;
    color: inherit;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
  }

  .play-detail__pp--watch-count {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end;
    gap: 2px;
  }
  .${MW_PP_CLASS} {
    font-variant-numeric: tabular-nums;
  }

  .oep-recent-fails-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .oep-recent-fails-header .title {
    margin: 0;
    padding: 0;
    line-height: 1.2;
  }
  .oep-recent-fails-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    margin: 0;
    padding: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.02em;
    color: hsl(var(--hsl-c1));
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .oep-recent-fails-toggle .oep-recent-show-fails {
    margin: 0;
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
    border-radius: 3px;
    cursor: pointer;
    accent-color: hsl(var(--hsl-b6));
  }
  .oep-recent-fails-toggle .oep-recent-show-fails:focus-visible {
    outline: 2px solid hsl(var(--hsl-b6));
    outline-offset: 2px;
  }
  .oep-clear-sr-cache-btn {
    appearance: none;
    background: none;
    border: 1px solid hsl(var(--hsl-b5));
    border-radius: 3px;
    color: hsl(var(--hsl-c1));
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1;
    padding: 3px 7px;
    transition: border-color 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .oep-clear-sr-cache-btn:hover {
    border-color: hsl(var(--hsl-c1));
    color: hsl(var(--hsl-l1));
  }
  .oep-clear-sr-cache-btn:active {
    opacity: 0.7;
  }

  .oep-recent-score-card-link {
    cursor: pointer;
  }

  .oep-score-options-wrap {
    position: relative;
    display: inline-flex;
  }
  .oep-score-options-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 13px;
    line-height: 1;
    border-radius: 4px;
    transition: color 100ms ease, background-color 100ms ease;
  }
  .oep-score-options-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
  }
  .oep-score-options-menu {
    position: fixed;
    z-index: 9999;
    background: #2a2a3a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    min-width: 130px;
    padding: 4px 0;
    display: none;
  }
  .oep-score-options-menu[data-open] {
    display: block;
  }
  .oep-score-options-item {
    display: block;
    box-sizing: border-box;
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.87);
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 8px 14px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 80ms ease;
  }
  .oep-score-options-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .oep-score-options-item--pending {
    opacity: 0.55;
    cursor: wait;
    pointer-events: none;
  }
  .oep-score-options-item--done {
    color: rgba(160, 255, 160, 0.9);
  }
  .oep-score-options-item--error {
    color: rgba(255, 180, 100, 0.9);
  }
`;
export const playDetailStyle = manageStyle(
  PLAY_DETAIL_STYLE_ID,
  PLAY_DETAIL_CSS,
);
