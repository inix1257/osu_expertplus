// Own file: the observer hub binds to the first jsdom window that subscribes.
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

test("resolveProfileTarget wakes up when the new page's data arrives", async () => {
  setup(
    "https://osu.ppy.sh/users/someone",
    blob({ user: { id: 2, username: "peppy" } }),
  );
  const started = Date.now();
  const pending = target.resolveProfileTarget(5000);
  setTimeout(() => {
    globalThis.document.body.innerHTML = blob({
      user: { id: 9, username: "someone" },
      current_mode: "fruits",
    });
  }, 30);
  const t = await pending;
  assert.equal(t?.userId, "9");
  assert.equal(t?.mode, "fruits");
  assert.ok(Date.now() - started < 1000, "no long wait");
});
