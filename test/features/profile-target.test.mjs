import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

function setup(url, html) {
  const { window } = loadScripts([], { url });
  for (const key of ["window", "document", "location", "HTMLAnchorElement"]) {
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
