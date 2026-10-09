/**
 * /beatmapsets/:id/discussion and its tabs (WS-30). Before WS-30 this was a
 * branch at the top of beatmap-detail's `init`; it is its own route now, so
 * the beatmapset page no longer runs any discussion code.
 */

import { safeStart } from "../core/lifecycle.js";
import { startDiscussionPreview } from "../features/discussion/preview.js";
import {
  DISCUSSION_CSS,
  DISCUSSION_STYLE_ID,
} from "../features/discussion/styles.js";
import { startDiscussionVotersTooltips } from "../features/discussion/voters.js";

/**
 * @param {RegExpMatchArray} match  match[1] = beatmapset id
 * @returns {() => void}
 */
function init(match) {
  const { createCleanupBag, manageStyle } = OsuExpertPlus.dom;
  const beatmapsetId = Number(match[1]);
  const bag = createCleanupBag();

  bag.add(manageStyle(DISCUSSION_STYLE_ID, DISCUSSION_CSS).acquire());
  safeStart(
    bag,
    () => startDiscussionPreview(beatmapsetId),
    "discussion/preview",
  );
  safeStart(
    bag,
    () => startDiscussionVotersTooltips(beatmapsetId),
    "discussion/voters",
  );

  return () => bag.dispose();
}

export const beatmapDiscussion = Object.freeze({
  name: "BeatmapDiscussion",
  init,
});
