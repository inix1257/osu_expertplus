/**
 * The extended leaderboard (WS-32): osu-web's own scoreboard requests ask
 * for 100 scores instead of 50 while the setting is on.
 */

import { addRequestRewriter } from "../../core/page-hooks.js";
import { settingIds, settings } from "../legacy.js";

export const EXTENDED_LB_LIMIT = 100;
/** osu-web's own page size. */
export const DEFAULT_LB_LIMIT = 50;

/** @returns {number} scores per leaderboard request with the current setting */
export function beatmapScoresLimit() {
  return settings().isEnabled(settingIds().API_EXTENDED_LEADERBOARD)
    ? EXTENDED_LB_LIMIT
    : DEFAULT_LB_LIMIT;
}
let scoresLimitRewriterInstalled = false;
/**
 * @param {string} rawUrl
 * @returns {string}
 */
export function withBeatmapScoresLimit(rawUrl) {
  const src = String(rawUrl || "");
  if (!src) return src;
  if (!settings().isEnabled(settingIds().API_EXTENDED_LEADERBOARD)) return src;
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

/**
 * Adds `limit=100` to osu-web's own `/beatmaps/{id}/scores` requests (page
 * XHR/fetch) while the extended leaderboard setting is on. Installed once
 * for the session; `withBeatmapScoresLimit` checks the setting per request.
 */
export function installBeatmapScoresLimitPatch() {
  if (scoresLimitRewriterInstalled) return;
  scoresLimitRewriterInstalled = true;
  addRequestRewriter(withBeatmapScoresLimit);
}
