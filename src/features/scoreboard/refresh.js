/**
 * The scoreboard table refresh pass: pp decimals, hit-stat colours, rate-edit
 * marking, sort, top panel and global ranks, run after every table change.
 */

import { syncBeatmapScoreboardGlobalRanks } from "./global-rank.js";
import { syncMergedNativeRowsHidden } from "./merged-leaderboard.js";
import {
  applyRateEditMarkingToScoreboardRows,
  syncBeatmapRateEditFilterBarVisibility,
  syncBeatmapScoreboardRateEditRowVisibility,
} from "./rate-filter.js";
import {
  applyBeatmapScoreboardLeaderboardSort,
  syncBeatmapScoreboardHeaderSortUi,
} from "./sort.js";
import {
  syncBeatmapScoreboardHitstatColors,
  syncBeatmapScoreboardPpDecimals,
  syncBeatmapScoreboardPpValueColor,
} from "./table-enhance.js";
import { refreshBeatmapScoreTopPanel } from "./top-panel.js";

/**
 * PP decimals, hit-stat header/cell colors, PP column tint, and rate-edit dimming
 * for the main HTML table (native osu-web rows and our API-rendered rows).
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function refreshBeatmapScoreboardTableEnhancements(scoreboardRoot) {
  syncMergedNativeRowsHidden(scoreboardRoot);
  syncBeatmapScoreboardPpDecimals(scoreboardRoot);
  syncBeatmapScoreboardHitstatColors(scoreboardRoot);
  syncBeatmapScoreboardPpValueColor(scoreboardRoot);
  applyRateEditMarkingToScoreboardRows(scoreboardRoot);
  syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot);
  applyBeatmapScoreboardLeaderboardSort(scoreboardRoot);
  syncBeatmapScoreboardHeaderSortUi(scoreboardRoot);
  syncBeatmapRateEditFilterBarVisibility(scoreboardRoot);
  refreshBeatmapScoreTopPanel(scoreboardRoot);
  syncBeatmapScoreboardGlobalRanks(scoreboardRoot);
}
