import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"], {
  url: "https://osu.ppy.sh/users/2/osu",
});
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "OsuExpertPlus",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
const common =
  await import("../../src/features/profile/recent-scores/common.js");
const { _getSectionType } =
  await import("../../src/features/profile/score-rows.js");

/** osu-web historical.tsx: recent (PlayDetailList) then, if any, most watched. */
function historical({ recent = true, mostWatched = true } = {}) {
  window.document.body.innerHTML = `
    <div class="js-sortable--page" data-page-id="historical"><div class="page-extra"><div class="lazy-load">
      <h3 class="title title--page-extra-small">Play History</h3>
      ${recent ? '<h3 class="title title--page-extra-small">Recent Plays</h3><div class="play-detail-list u-relative" id="recent"></div>' : ""}
      ${mostWatched ? '<h3 class="title title--page-extra-small">Most Watched</h3><div class="play-detail-list" id="mw"><div class="play-detail"></div></div>' : ""}
    </div></div></div>`;
  return window.document;
}

test("Recent and Most Watched lists are told apart by markup (B39)", () => {
  historical();
  assert.equal(common.findRecentPlaysListRoot()?.id, "recent");
  assert.equal(common.findMostWatchedReplaysListRoot()?.id, "mw");

  // No Recent list (no data): Most Watched must not be taken for it.
  historical({ recent: false });
  assert.equal(common.findRecentPlaysListRoot(), null);
  assert.equal(common.findMostWatchedReplaysListRoot()?.id, "mw");

  // An empty Recent list and no Most Watched.
  historical({ mostWatched: false });
  assert.equal(common.findRecentPlaysListRoot()?.id, "recent");
  assert.equal(common.findMostWatchedReplaysListRoot(), null);
});

test("only the Most Watched list in Historical is classed most_watched (B40)", () => {
  const doc = historical();
  assert.equal(_getSectionType(doc.getElementById("mw")), "most_watched");
  assert.equal(_getSectionType(doc.getElementById("recent")), null);
});
