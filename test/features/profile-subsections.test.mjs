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
  "HTMLButtonElement",
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

const { startProfileSubsectionCollapseManager } =
  await import("../../src/features/profile/subsections.js");

const doc = window.document;
const STORE = "userProfile.profileSubsectionsCollapsed";
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const stored = () => JSON.parse(window.GM_getValue(STORE, "{}") || "{}");

/**
 * A section page as osu-web renders it: `[title, count?, bodyClass]`.
 * @param {string} pageId
 * @param {[string, string|null, string][]} subs
 */
function page(pageId, subs) {
  return `<div class="js-sortable--page" data-page-id="${pageId}">
    <h2 class="title title--page-extra">${pageId}</h2>
    ${subs
      .map(
        ([title, count, body]) =>
          `<h3 class="title title--page-extra-small">${title}${
            count ? `<span class="title__count">${count}</span>` : ""
          }</h3><div class="${body}">body of ${title}</div>`,
      )
      .join("")}
  </div>`;
}

const toggles = () =>
  [...doc.querySelectorAll("button[data-oep-profile-subsection-for]")].map(
    (b) => b.getAttribute("data-oep-profile-subsection-for"),
  );

function reset(html, store = null) {
  if (store) window.GM_setValue(STORE, JSON.stringify(store));
  else window.GM_deleteValue(STORE);
  doc.body.innerHTML = html;
}

test("toggles collapse the body and persist", async () => {
  reset(
    page("beatmaps", [
      ["Favourite Beatmaps", "5", "page-extra__beatmapsets"],
      ["Graveyarded Beatmaps", "42", "page-extra__beatmapsets"],
    ]),
  );
  const stop = startProfileSubsectionCollapseManager();
  try {
    assert.equal(toggles().length, 2);
    const [first] = doc.querySelectorAll(
      "button[data-oep-profile-subsection-for]",
    );
    first.click();
    const body = doc.querySelector("h3 + div");
    assert.ok(
      body.classList.contains("oep-profile-subsection-body--collapsed-hidden"),
    );
    assert.equal(first.getAttribute("aria-expanded"), "false");
    assert.deepEqual(Object.keys(stored()), [toggles()[0]]);
    first.click();
    assert.equal(window.GM_getValue(STORE, undefined), undefined);
  } finally {
    stop();
  }
  assert.equal(toggles().length, 0, "cleanup removes the toggles");
  assert.equal(doc.querySelector(".oep-profile-subsection-title__label"), null);
});

test("rescans keep the existing toggles and do not nest the title", async () => {
  reset(page("historical", [["Most Played Beatmaps", "11", "a"]]));
  const stop = startProfileSubsectionCollapseManager();
  try {
    const btn = doc.querySelector("button[data-oep-profile-subsection-for]");
    // osu-web renders another subsection later.
    const pageEl = doc.querySelector("[data-page-id=historical]");
    pageEl.insertAdjacentHTML(
      "beforeend",
      '<h3 class="title title--page-extra-small">Most Watched Replays</h3><div class="play-detail-list">x</div>',
    );
    await tick();
    assert.equal(toggles().length, 2);
    assert.equal(
      doc.querySelector("button[data-oep-profile-subsection-for]"),
      btn,
      "the first toggle was not rebuilt",
    );
    assert.equal(
      doc.querySelectorAll(
        ".oep-profile-subsection-title__label .oep-profile-subsection-title__label",
      ).length,
      0,
    );
  } finally {
    stop();
  }
});
