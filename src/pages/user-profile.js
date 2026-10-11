/**
 * /users/:id(/:mode): composes the profile features (src/features/profile/)
 * and the BBCode helper (src/editor/bbcode-helper/). The router calls init
 * per visit and the cleanup it returns on navigation.
 */

import { safeStart } from "../core/lifecycle.js";
import { startBbcodeHelperManager } from "../editor/bbcode-helper/manager.js";
import { startProfileBadgesCollapseManager } from "../features/profile/badges.js";
import { startBwsRankingManager } from "../features/profile/bws.js";
import { startContentsReorderManager } from "../features/profile/contents-reorder.js";
import { startProfileMediaOpenPictureManager } from "../features/profile/media-buttons.js";
import { teardownSrObserver } from "../features/profile/modded-sr.js";
import { resolveProfileTarget } from "../features/profile/profile-target.js";
import { startRanksDateHighlightManager } from "../features/profile/ranks-period.js";
import { startRecentScoresWithFailsObserver } from "../features/profile/recent-scores/mount.js";
import { initScoreFeatures } from "../features/profile/score-features.js";
import { scorePlaceNumberStyle } from "../features/profile/score-rows.js";
import { startProfileSectionCollapseManager } from "../features/profile/sections.js";
import { playDetailStyle } from "../features/profile/styles.js";
import { startProfileSubsectionCollapseManager } from "../features/profile/subsections.js";
import { startUserpageExpandManager } from "../features/profile/userpage-expand.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

/**
 * Every feature starts through `safeStart`, so one that throws is logged and
 * the others still start and are cleaned up (B51). The bag disposes in
 * reverse order: the shared score styles, added first, go last.
 * @param {RegExpMatchArray} _match
 * @returns {function}
 */
function init(_match) {
  const { manageStyle, createCleanupBag } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const bag = createCleanupBag();

  // B07: this run owns the shared score styles and every cleanup registered by
  // the async score features, so a stale run can never undo the next page's
  // setup. The cleanup runs synchronously before the next init.
  playDetailStyle.inject();
  bag.add(() => {
    playDetailStyle.remove();
    scorePlaceNumberStyle.remove();
  });
  // Also started later by the SR toggle or the Recent list (B38).
  bag.add(teardownSrObserver);
  let disposed = false;
  const scoreRun = { isDisposed: () => disposed, cleanupFns: [] };
  bag.add(() =>
    scoreRun.cleanupFns.splice(0).forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    }),
  );

  const cards = OsuExpertPlus.beatmapCardStats;
  safeStart(
    bag,
    () => cards.startAlwaysShowStats(settings, manageStyle),
    "card stats",
  );
  safeStart(
    bag,
    () => cards.startFullBeatmapStatNumbers(settings),
    "card stat numbers",
  );
  safeStart(
    bag,
    () =>
      OsuExpertPlus.beatmapCardExtra.start(settings, {
        hookProfileExtraPages: true,
      }),
    "card extras",
  );

  safeStart(bag, startRanksDateHighlightManager, "ranks period");
  safeStart(bag, startBwsRankingManager, "BWS rank");
  safeStart(bag, startProfileBadgesCollapseManager, "badges collapse");
  safeStart(bag, startProfileSectionCollapseManager, "section collapse");
  safeStart(bag, startProfileSubsectionCollapseManager, "subsection collapse");
  safeStart(bag, startBbcodeHelperManager, "BBCode helper");
  safeStart(bag, startProfileMediaOpenPictureManager, "media buttons");
  safeStart(bag, startUserpageExpandManager, "userpage expand");

  // The router fires on pushState, before the new profile is rendered: wait for
  // the page's own data so scores are never fetched for the previous ruleset.
  resolveProfileTarget()
    .then((target) => {
      if (disposed || !target) return;
      const { userId, mode, isOwnProfile } = target;
      // B43: decided from the resolved target, not from whatever profile
      // the DOM still showed when init ran.
      if (isOwnProfile) {
        safeStart(bag, startContentsReorderManager, "contents reorder");
      }
      safeStart(
        bag,
        () => startRecentScoresWithFailsObserver(userId, mode),
        "Recent scores",
      );
      return initScoreFeatures(userId, mode, scoreRun);
    })
    .catch(() => {});

  return () => {
    disposed = true;
    bag.dispose();
  };
}

OsuExpertPlus.pages.userProfile = { name: "UserProfile", init };
