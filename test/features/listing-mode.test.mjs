// Own file: the observer hub binds to the first jsdom window that subscribes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window, gmStore } = loadScripts([], {
  url: "https://osu.ppy.sh/beatmapsets",
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
  "CSS",
  "GM_getValue",
  "GM_setValue",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
// jsdom has no CSS.escape; the values here are plain digits.
if (!globalThis.CSS?.escape) globalThis.CSS = { escape: (v) => String(v) };

const { startPageBehavior } =
  await import("../../src/features/listing-mode.js");

const KEY = "beatmapsetsListing.preferredMode";
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

/** The advanced search filter grid: general, mode, status, genre. */
const GRID = `
  <div class="beatmapsets-search__filter-grid">
    <div class="beatmapsets-search-filter"><a class="beatmapsets-search-filter__item" data-filter-value="recommended">r</a></div>
    <div class="beatmapsets-search-filter">
      <a class="beatmapsets-search-filter__item">Any</a>
      ${[0, 1, 2, 3].map((m) => `<a class="beatmapsets-search-filter__item mode" data-filter-value="${m}">${m}</a>`).join("")}
    </div>
    <div class="beatmapsets-search-filter"><a class="beatmapsets-search-filter__item" data-filter-value="any">any</a></div>
    <div class="beatmapsets-search-filter">
      ${[0, 1, 2, 3, 4, 5].map((g) => `<a class="beatmapsets-search-filter__item genre" data-filter-value="${g}">g${g}</a>`).join("")}
    </div>
  </div>`;
const ROOT =
  '<div class="js-react" data-react="beatmaps" data-advanced-search="1"></div>';

function clicksOn(selector) {
  const seen = [];
  for (const a of window.document.querySelectorAll(selector)) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      seen.push(`${a.className}:${a.getAttribute("data-filter-value")}`);
    });
  }
  return seen;
}

test("opens the listing with the saved ruleset, in the mode row", () => {
  gmStore.set(KEY, "2");
  window.document.body.innerHTML = ROOT + GRID;
  const seen = clicksOn("a.beatmapsets-search-filter__item");
  const stop = startPageBehavior();
  stop();
  assert.deepEqual(seen, ["beatmapsets-search-filter__item mode:2"]);
});

test("records ruleset clicks, not genre clicks", async () => {
  gmStore.set(KEY, "any");
  window.document.body.innerHTML = ROOT + GRID;
  const stop = startPageBehavior();
  try {
    window.history.replaceState(null, "", "/beatmapsets?m=3");
    window.document.querySelector(".genre[data-filter-value='1']").click();
    await tick(300);
    assert.equal(gmStore.get(KEY), "any");
    window.document.querySelector(".mode[data-filter-value='3']").click();
    await tick(300);
    assert.equal(gmStore.get(KEY), "3");
  } finally {
    stop();
    window.history.replaceState(null, "", "/beatmapsets");
  }
});

test("B67: waits for the React root before applying the saved ruleset", async () => {
  gmStore.set(KEY, "1");
  window.document.body.innerHTML = "";
  const stop = startPageBehavior();
  try {
    await tick();
    window.document.body.innerHTML = ROOT + GRID;
    const seen = clicksOn("a.beatmapsets-search-filter__item");
    await tick();
    assert.deepEqual(seen, ["beatmapsets-search-filter__item mode:1"]);
  } finally {
    stop();
  }
});
