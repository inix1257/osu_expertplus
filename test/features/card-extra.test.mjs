import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(
  [
    "src/utils/dom.js",
    "src/utils/difficulty-colours.js",
    "src/utils/settings.js",
  ],
  { url: "https://osu.ppy.sh/beatmapsets" },
);
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "OsuExpertPlus",
  "GM_getValue",
  "GM_setValue",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { processPanel } = await import("../../src/features/cards/extra.js");
const { beatmapsetCache } = await import("../../src/core/beatmapset-cache.js");

const settings = window.OsuExpertPlus.settings;
const IDS = settings.IDS;
const doc = window.document;

function panel(id) {
  const p = doc.createElement("div");
  p.className = "beatmapset-panel";
  p.innerHTML = `<a href="/beatmapsets/${id}">t</a>
    <div class="beatmapset-panel__info">
      <div class="beatmapset-panel__info-row beatmapset-panel__info-row--artist">a</div>
      <div class="beatmapset-panel__info-row beatmapset-panel__info-row--mapper">m</div>
    </div>`;
  doc.body.append(p);
  return p;
}
const set = (id) => ({
  id,
  source: "src",
  beatmaps: [{ mode: "osu", bpm: 180, total_length: 90, difficulty_rating: 5 }],
});

test("draws from the cache; redraws only when its own set changes", async () => {
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, true);
  beatmapsetCache.put([set(101)]);
  const p = panel(101);
  await processPanel(p, settings);
  assert.equal(p.getAttribute("data-oep-card-extra"), "101");
  const meta = p.querySelector(".oep-beatmap-card-extra__meta");
  assert.equal(meta.textContent, "180 BPM · 1:30");

  beatmapsetCache.put([set(999)]); // another set
  await processPanel(p, settings);
  assert.equal(p.querySelector(".oep-beatmap-card-extra__meta"), meta);

  beatmapsetCache.put([set(101)]);
  await processPanel(p, settings);
  assert.notEqual(p.querySelector(".oep-beatmap-card-extra__meta"), meta);
  p.remove();
});

test("B28: a wait that ends after cleanup leaves no loading state", async () => {
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, true);
  const p = panel(202);
  const ac = new AbortController();
  const pending = processPanel(p, settings, ac.signal);
  assert.equal(p.getAttribute("data-oep-card-extra"), "loading");
  ac.abort();
  await pending;
  assert.equal(p.getAttribute("data-oep-card-extra"), null);
  beatmapsetCache.put([set(202)]);
  assert.equal(p.querySelector(".oep-beatmap-card-extra__meta"), null);
  p.remove();
});

test("B28: a setting turned off during the wait is respected", async () => {
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, true);
  settings.set(IDS.BEATMAP_CARD_DIFFICULTY_RANGE, false);
  const p = panel(303);
  const pending = processPanel(p, settings);
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, false);
  beatmapsetCache.put([set(303)]);
  await pending;
  assert.equal(p.querySelector(".oep-beatmap-card-extra__meta"), null);
  assert.equal(p.getAttribute("data-oep-card-extra"), null);
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, true);
  p.remove();
});

test("B28: React reusing the panel for another set during the wait", async () => {
  settings.set(IDS.BEATMAP_CARD_EXTRA_INFO, true);
  const p = panel(404);
  const pending = processPanel(p, settings);
  p.querySelector("a").setAttribute("href", "/beatmapsets/405");
  beatmapsetCache.put([set(404)]);
  await pending;
  assert.equal(p.querySelector(".oep-beatmap-card-extra__meta"), null);
  assert.equal(p.getAttribute("data-oep-card-extra"), null);
  p.remove();
});
