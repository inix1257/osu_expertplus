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

test("B85: a subsection's body stops at our Recent list", async () => {
  reset(`<div class="js-sortable--page" data-page-id="historical">
      <h3 class="title title--page-extra-small">Most Played Beatmaps</h3>
      <div class="most-played">x</div>
      <div class="oep-recent-scores-with-fails">
        <div class="oep-recent-fails-header"><h3 class="title title--page-extra-small">Recent scores</h3></div>
        <div class="play-detail-list">r</div>
      </div>
    </div>`);
  const stop = startProfileSubsectionCollapseManager();
  try {
    const [mostPlayed, recent] = toggles();
    assert.equal(
      doc.querySelector(".most-played").getAttribute("data-oep-subsection-for"),
      mostPlayed,
    );
    assert.equal(
      doc
        .querySelector(".oep-recent-scores-with-fails")
        .getAttribute("data-oep-subsection-for"),
      null,
    );
    assert.equal(
      doc
        .querySelector(".oep-recent-scores-with-fails .play-detail-list")
        .getAttribute("data-oep-subsection-for"),
      recent,
    );
  } finally {
    stop();
  }
});

test("B47: keys follow the subsection, not its position", async () => {
  reset(`<div class="js-sortable--page" data-page-id="historical">
      <h3 class="title title--page-extra-small">Most Played Beatmaps<span class="title__count">11</span></h3>
      <div class="most-played">x</div>
      <div class="oep-recent-scores-with-fails">
        <div class="oep-recent-fails-header"><h3 class="title title--page-extra-small">Recent scores</h3></div>
        <div class="play-detail-list">r</div>
      </div>
      <h3 class="title title--page-extra-small">Most Watched Replays<span class="title__count">10</span></h3>
      <div class="play-detail-list">w</div>
    </div>`);
  const stop = startProfileSubsectionCollapseManager();
  try {
    assert.deepEqual(toggles(), [
      "historical::most_played_beatmaps",
      "historical::recent",
      "historical::most_watched",
    ]);
  } finally {
    stop();
  }
});

test("B47: old index keys move to the subsection now at that index", async () => {
  reset(
    page("beatmaps", [
      ["Favourite Beatmaps", "5", "page-extra__beatmapsets"],
      ["Graveyarded Beatmaps", "42", "page-extra__beatmapsets"],
    ]),
    { "beatmaps::sub_1": true, "other::x": true },
  );
  const stop = startProfileSubsectionCollapseManager();
  try {
    assert.deepEqual(stored(), {
      "other::x": true,
      "beatmaps::graveyarded_beatmaps": true,
    });
    const bodies = [...doc.querySelectorAll("h3 + div")];
    assert.deepEqual(
      bodies.map((b) =>
        b.classList.contains("oep-profile-subsection-body--collapsed-hidden"),
      ),
      [false, true],
    );
  } finally {
    stop();
  }
});
