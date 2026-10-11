/**
 * The beatmap card features, started together by every page that shows
 * cards (listing, profile) (WS-50).
 */

import { safeStart } from "../../core/lifecycle.js";
import { start as startCardExtra } from "./extra.js";
import { startAlwaysShowStats, startFullBeatmapStatNumbers } from "./stats.js";

/**
 * @param {typeof OsuExpertPlus.settings} settings
 * @param {typeof OsuExpertPlus.dom.manageStyle} manageStyle
 * @param {{ hookProfileExtraPages?: boolean }} [options]  profile pages:
 *   cards wait for (and if needed fetch) the profile's extra-pages data
 * @returns {() => void}
 */
export function startCardFeatures(settings, manageStyle, options = {}) {
  /** @type {(() => void)[]} */
  const stops = [];
  const bag = { add: (/** @type {() => void} */ fn) => stops.push(fn) };
  safeStart(
    bag,
    () => startAlwaysShowStats(settings, manageStyle),
    "card stats",
  );
  safeStart(
    bag,
    () => startFullBeatmapStatNumbers(settings),
    "card stat numbers",
  );
  safeStart(bag, () => startCardExtra(settings, options), "card extras");
  return () => {
    for (const stop of stops.reverse()) {
      try {
        stop();
      } catch (_) {
        /* the others still stop */
      }
    }
  };
}
