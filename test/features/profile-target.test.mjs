import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

function setup(url, html) {
  const { window } = loadScripts([], { url });
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLAnchorElement",
    "MutationObserver",
    "Element",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  window.document.body.innerHTML = html;
  return window;
}

const blob = (data) =>
  `<div class="js-react" data-initial-data='${JSON.stringify(data)}'></div>`;

const target = await import("../../src/features/profile/profile-target.js");

test("an invalid initial-data node does not stop the search (B69)", () => {
  setup(
    "https://osu.ppy.sh/users/peppy",
    `<div class="js-react" data-initial-data="{not json"></div>
     ${blob({ other: 1 })}
     ${blob({ user: { id: 2, username: "peppy" }, current_mode: "taiko" })}`,
  );
  assert.equal(target.parseProfileInitialData()?.user?.id, 2);
  assert.equal(target.getProfileUserId(), "2");
  assert.equal(target.getCurrentMode(), "taiko");
});

test("stale initial data from the previous profile is not used (B43)", async () => {
  const header = (id) =>
    `<a class="u-current-user-avatar" href="https://osu.ppy.sh/users/${id}"></a>`;
  // Moved to /users/someone while the DOM still shows peppy.
  setup(
    "https://osu.ppy.sh/users/someone",
    header(2) + blob({ user: { id: 2, username: "peppy" } }),
  );
  assert.equal(target.profileInitialDataForUrl(), null);
  assert.equal(target.getProfileUserId(), null);
  assert.equal(await target.resolveProfileTarget(250), null);

  // The new profile renders: now it resolves, and it is not our own.
  globalThis.document.body.innerHTML =
    header(2) +
    blob({ user: { id: 9, username: "someone" }, current_mode: "mania" });
  assert.deepEqual(await target.resolveProfileTarget(250), {
    userId: "9",
    mode: "mania",
    isOwnProfile: false,
  });

  setup("https://osu.ppy.sh/users/2/osu", header(2));
  assert.deepEqual(await target.resolveProfileTarget(250), {
    userId: "2",
    mode: "osu",
    isOwnProfile: true,
  });
});
