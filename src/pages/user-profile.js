/**
 * User profile page. Router calls init per visit; cleanup on navigate away.
 * An ES module since WS-40: the BBCode helper lives in
 * src/editor/bbcode-helper/, the profile features in src/features/profile/
 * (WS-41, WS-42). Only `init`, which starts them, is left here.
 */

import { startBbcodeHelperManager } from "../editor/bbcode-helper/manager.js";
import { startProfileMediaOpenPictureManager } from "../features/profile/media-buttons.js";
import { teardownSrObserver } from "../features/profile/modded-sr.js";
import { resolveProfileTarget } from "../features/profile/profile-target.js";
import { startRanksDateHighlightManager } from "../features/profile/ranks-period.js";
import { startRecentScoresWithFailsObserver } from "../features/profile/recent-scores/mount.js";
import { initScoreFeatures } from "../features/profile/score-features.js";
import { scorePlaceNumberStyle } from "../features/profile/score-rows.js";
import { playDetailStyle } from "../features/profile/styles.js";
import { startUserpageExpandManager } from "../features/profile/userpage-expand.js";
import { startProfileBadgesCollapseManager } from "../features/profile/badges.js";
import { startBwsRankingManager } from "../features/profile/bws.js";
import { startContentsReorderManager } from "../features/profile/contents-reorder.js";
import { startProfileSectionCollapseManager } from "../features/profile/sections.js";
import { startProfileSubsectionCollapseManager } from "../features/profile/subsections.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.userProfile = (() => {
  const name = "UserProfile";
  const { manageStyle } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;

  /**
   * @param {RegExpMatchArray} _match
   * @returns {function}
   */
  function init(_match) {
    const cleanups = [];

    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(
        settings,
        manageStyle,
      ),
    );
    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );

    cleanups.push(
      OsuExpertPlus.beatmapCardExtra.start(settings, {
        hookProfileExtraPages: true,
      }),
    );

    cleanups.push(startRanksDateHighlightManager());
    cleanups.push(startBwsRankingManager());
    cleanups.push(startProfileBadgesCollapseManager());
    cleanups.push(startProfileSectionCollapseManager());
    cleanups.push(startProfileSubsectionCollapseManager());
    cleanups.push(startBbcodeHelperManager());
    cleanups.push(startProfileMediaOpenPictureManager());
    cleanups.push(startUserpageExpandManager());

    // B07: this run owns the shared score styles and every cleanup registered by
    // the async score features, so a stale run can never undo the next page's
    // setup. The cleanup below runs synchronously before the next init.
    let disposed = false;
    let recentFailsCleanup = null;
    const scoreRun = { isDisposed: () => disposed, cleanupFns: [] };
    playDetailStyle.inject();

    // The router fires on pushState, before the new profile is rendered: wait for
    // the page's own data so scores are never fetched for the previous ruleset.
    resolveProfileTarget()
      .then((target) => {
        if (disposed || !target) return;
        const { userId, mode, isOwnProfile } = target;
        // B43: decided from the resolved target, not from whatever profile
        // the DOM still showed when init ran.
        if (isOwnProfile) cleanups.push(startContentsReorderManager());
        recentFailsCleanup = startRecentScoresWithFailsObserver(userId, mode);
        return initScoreFeatures(userId, mode, scoreRun);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      if (typeof recentFailsCleanup === "function") {
        recentFailsCleanup();
        recentFailsCleanup = null;
      }
      scoreRun.cleanupFns.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      // Also started later by the SR toggle or the Recent list (B38).
      teardownSrObserver();
      scorePlaceNumberStyle.remove();
      playDetailStyle.remove();
    };
  }

  return { name, init };
})();
