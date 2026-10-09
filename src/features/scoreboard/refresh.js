/**
 * The scoreboard table refresh pass: pp decimals, hit-stat colours, rate-edit
 * marking, sort, top panel and global ranks, run after every table change.
 *
 * The pass still includes the rate-edit filter, which lives in
 * beatmap-detail.js until WS-32, so beatmap-detail registers the pass here
 * and the scoreboard modules call it through this module.
 */

/** @type {(scoreboardRoot: HTMLElement|null|undefined) => void} */
let refreshPass = () => {};

/** @param {(scoreboardRoot: HTMLElement|null|undefined) => void} fn */
export function setScoreboardRefreshPass(fn) {
  refreshPass = fn;
}

/**
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function refreshBeatmapScoreboardTableEnhancements(scoreboardRoot) {
  refreshPass(scoreboardRoot);
}
