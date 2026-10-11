import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/users/2/osu",
});
for (const key of [
  "window",
  "document",
  "location",
  "HTMLAnchorElement",
  "HTMLMetaElement",
  "OsuExpertPlus",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
const menus =
  await import("../../src/features/profile/recent-scores/options-menu.js");

test("options menus are portaled on first open and removed on cleanup (B42)", () => {
  const doc = window.document;
  const wraps = [1, 2, 3].map((id) =>
    menus.buildScoreOptionsMenu({ id, user_id: 9 }),
  );
  wraps.forEach((w) => doc.body.append(w));
  const count = () => doc.querySelectorAll(".oep-score-options-menu").length;
  assert.equal(count(), 0, "nothing portaled before a menu is opened");

  const btn = wraps[0].querySelector("button");
  btn.click();
  assert.equal(count(), 1);
  assert.ok(doc.querySelector(".oep-score-options-menu[data-open]"));
  doc.body.click();
  assert.equal(
    doc.querySelector(".oep-score-options-menu[data-open]"),
    null,
    "outside click closes",
  );

  btn.click();
  wraps[1].querySelector("button").click();
  assert.equal(count(), 2);
  menus.removeScoreOptionsMenu(btn);
  assert.equal(count(), 1);

  menus.disposeScoreOptionsMenus();
  assert.equal(count(), 0);
  // The document listener is gone too: re-opening re-adds it, nothing leaks.
  wraps[2].querySelector("button").click();
  assert.equal(count(), 1);
  doc.body.click();
  assert.equal(doc.querySelector(".oep-score-options-menu[data-open]"), null);
  menus.disposeScoreOptionsMenus();
});

test("an open menu follows its button on scroll and resize (B105)", () => {
  const doc = window.document;
  const wrap = menus.buildScoreOptionsMenu({ id: 5, user_id: 9 });
  doc.body.append(wrap);
  const btn = wrap.querySelector("button");
  let top = 100;
  btn.getBoundingClientRect = () => ({ bottom: top, right: 500 });
  btn.click();
  const menu = doc.querySelector(".oep-score-options-menu[data-open]");
  assert.equal(menu.style.top, "102px");

  top = 40;
  doc.dispatchEvent(new window.Event("scroll"));
  assert.equal(menu.style.top, "42px", "page scroll");
  top = 10;
  doc.body.dispatchEvent(new window.Event("scroll")); // a scrolling container
  assert.equal(menu.style.top, "12px");
  top = 70;
  window.dispatchEvent(new window.Event("resize"));
  assert.equal(menu.style.top, "72px");

  // Button gone (list re-rendered): the menu closes instead of floating.
  wrap.remove();
  doc.dispatchEvent(new window.Event("scroll"));
  assert.equal(menu.hasAttribute("data-open"), false);

  menus.disposeScoreOptionsMenus();
  top = 1;
  doc.dispatchEvent(new window.Event("scroll"));
  assert.equal(menu.style.top, "72px", "listeners removed on cleanup");
});
