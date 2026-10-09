/**
 * Discussion tab links that open the Total sub-tab directly (WS-33).
 */

import { settingIds, settings } from "../legacy.js";

// Attribute to mark links we've patched so we can revert them on cleanup.
export const DISCUSSION_TAB_ORIG_HREF_ATTR =
  "data-oep-discussion-tab-orig-href";

/**
 * Rewrites Discussion tab links for this beatmapset to land directly on the
 * Total sub-tab.  Matches via `a.href` (always the resolved absolute URL) so
 * it works regardless of whether React rendered a relative or absolute href.
 * @param {string} beatmapsetId
 */
export function _patchDiscussionTabLinks(beatmapsetId) {
  const { discussionPath, discussionTotalPath } = OsuExpertPlus.core.routes;
  const bareSuffix = discussionPath(beatmapsetId);
  const target = discussionTotalPath(beatmapsetId);
  document.querySelectorAll("a").forEach((a) => {
    // a.href is always absolute; strip trailing slash for comparison.
    const resolved = a.href.replace(/\/$/, "");
    if (resolved !== `${location.origin}${bareSuffix}`) return;
    if (!a.hasAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR)) {
      a.setAttribute(
        DISCUSSION_TAB_ORIG_HREF_ATTR,
        a.getAttribute("href") ?? "",
      );
    }
    a.setAttribute("href", target);
  });
}

/** Reverts any links patched by `_patchDiscussionTabLinks`. */
export function _revertDiscussionTabLinks() {
  document
    .querySelectorAll(`a[${DISCUSSION_TAB_ORIG_HREF_ATTR}]`)
    .forEach((a) => {
      a.setAttribute(
        "href",
        a.getAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR) ?? "",
      );
      a.removeAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR);
    });
}

/**
 * Patches the Discussion tab links to go straight to the Total sub-tab.
 * @param {string} beatmapsetId
 * @returns {() => void}
 */
export function startDiscussionTabLinkPatcher(beatmapsetId) {
  if (settings().isEnabled(settingIds().DISCUSSION_DEFAULT_TO_TOTAL)) {
    _patchDiscussionTabLinks(beatmapsetId);
  }

  const offSetting = settings().onChange(
    settingIds().DISCUSSION_DEFAULT_TO_TOTAL,
    (enabled) => {
      if (enabled) _patchDiscussionTabLinks(beatmapsetId);
      else _revertDiscussionTabLinks();
    },
  );

  return () => {
    offSetting();
    _revertDiscussionTabLinks();
  };
}
