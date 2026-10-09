/**
 * The beatmapset scoreboard features, started together by the page.
 */

import { mountSettingFeature, safeStart } from "../../core/lifecycle.js";
import { settingIds, settings } from "../legacy.js";
import { disposeScoreboardGlobalRanks } from "./global-rank.js";
import { mountScoreboardModGrid } from "./mod-filter/grid.js";
import { startBeatmapScoreUserSearchManager } from "./player-lookup.js";
import { startBeatmapScoreboardHideRateEditFilterBar } from "./rate-filter.js";
import { installBeatmapScoresLimitPatch } from "./scores-limit.js";
import { startBeatmapScoreboardSortControls } from "./sort.js";
import {
  MOD_GRID_CSS,
  MOD_GRID_STYLE_ID,
  SCOREBOARD_CSS,
  SCOREBOARD_STYLE_ID,
} from "./styles.js";
import { startBeatmapScoreboardTableEnhancementsLive } from "./table-enhance.js";

/**
 * Styles and the 100-scores request rewriter. Call as soon as the page
 * starts: osu-web requests the scoreboard before the header renders.
 */
export function prepareScoreboard() {
  const { manageStyle } = OsuExpertPlus.dom;
  manageStyle(SCOREBOARD_STYLE_ID, SCOREBOARD_CSS).inject();
  manageStyle(MOD_GRID_STYLE_ID, MOD_GRID_CSS).inject();
  installBeatmapScoresLimitPatch();
}

/**
 * @param {import("../../core/lifecycle.js").CleanupBag} bag
 * @param {RegExp} pathRe  the beatmapset page path
 */
export function startScoreboard(bag, pathRe) {
  safeStart(
    bag,
    () => startBeatmapScoreboardSortControls(pathRe),
    "scoreboard sort",
  );
  safeStart(
    bag,
    () => startBeatmapScoreUserSearchManager(pathRe),
    "player lookup",
  );
  safeStart(
    bag,
    () => startBeatmapScoreboardHideRateEditFilterBar(pathRe),
    "rate filter",
  );
  safeStart(
    bag,
    () => startBeatmapScoreboardTableEnhancementsLive(pathRe),
    "scoreboard table",
  );
  bag.add(disposeScoreboardGlobalRanks);
  mountSettingFeature(bag, settings(), settingIds().SCOREBOARD_MOD_GRID, () =>
    mountScoreboardModGrid(pathRe),
  );
}
