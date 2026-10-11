// Own file: the observer hub binds to the first jsdom window that subscribes.
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
  "HTMLAnchorElement",
  "MutationObserver",
  "OsuExpertPlus",
  "GM_getValue",
  "GM_setValue",
  "GM_deleteValue",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { startProfileSectionCollapseManager } =
  await import("../../src/features/profile/sections.js");

const doc = window.document;
const STORE = "userProfile.profileSectionsCollapsed";
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function render() {
  window.GM_deleteValue(STORE);
  doc.body.innerHTML = `
    <div class="page-mode">
      <a href="#me">me!</a><a href="#top_ranks">Ranks</a><a href="#historical">Historical</a>
    </div>
    ${["me", "top_ranks", "historical"]
      .map(
        (id) => `<div class="js-sortable--page" data-page-id="${id}">
          <div class="u-relative"><h2 class="title title--page-extra">${id}</h2></div>
          <div class="body">${id} body</div>
        </div>`,
      )
      .join("")}`;
}

const pageOf = (id) => doc.querySelector(`[data-page-id="${id}"]`);
const labelOf = (id) =>
  pageOf(id).querySelector(".oep-profile-section-page-title__label");

test("page titles toggle by mouse and keyboard", () => {
  render();
  const stop = startProfileSectionCollapseManager();
  try {
    const label = labelOf("top_ranks");
    assert.equal(label.getAttribute("role"), "button");
    assert.equal(label.getAttribute("tabindex"), "0");
    assert.equal(label.getAttribute("aria-expanded"), "true");

    pageOf("top_ranks").querySelector("h2").click();
    assert.ok(
      pageOf("top_ranks").classList.contains("oep-profile-section--collapsed"),
    );
    assert.equal(label.getAttribute("aria-expanded"), "false");
    assert.deepEqual(JSON.parse(window.GM_getValue(STORE)), {
      top_ranks: true,
    });
    assert.equal(
      doc
        .querySelector('a[href="#top_ranks"]')
        .getAttribute("data-oep-section-tab-chevron"),
      "collapsed",
    );

    label.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.equal(label.getAttribute("aria-expanded"), "true");
    assert.equal(window.GM_getValue(STORE, undefined), undefined);

    labelOf("me").dispatchEvent(
      new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    assert.ok(
      pageOf("me").classList.contains("oep-profile-section--collapsed"),
    );
    labelOf("me").click();
  } finally {
    stop();
  }
  assert.equal(
    doc.querySelector(".oep-profile-section-page-title__label"),
    null,
  );
  assert.equal(doc.querySelector("[data-oep-section-tab-chevron]"), null);
});

test("bare # links do not rebuild the titles; new pages are bound", async () => {
  render();
  const stop = startProfileSectionCollapseManager();
  try {
    const label = labelOf("me");
    pageOf("me")
      .querySelector(".body")
      .insertAdjacentHTML(
        "beforeend",
        '<a href="#" class="js-spoilerbox__link">spoiler</a>',
      );
    await tick();
    assert.equal(labelOf("me"), label);

    doc.body.insertAdjacentHTML(
      "beforeend",
      `<div class="js-sortable--page" data-page-id="kudosu">
        <div class="u-relative"><h2 class="title title--page-extra">kudosu</h2></div>
      </div>`,
    );
    await tick();
    assert.ok(labelOf("kudosu"));
  } finally {
    stop();
  }
});
