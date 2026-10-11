import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"], {
  url: "https://osu.ppy.sh/beatmapsets",
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

const {
  countFromStatTooltip,
  applyFullBeatmapStatNumbers,
  revertFullBeatmapStatNumbers,
} = await import("../../src/features/cards/stats.js");
const { beatmapsetCache } = await import("../../src/core/beatmapset-cache.js");

test("B26: tooltip counts in any language", () => {
  assert.equal(countFromStatTooltip("Playcount: 1,234,567"), 1234567);
  assert.equal(countFromStatTooltip("Wiedergaben: 1.234.567"), 1234567);
  assert.equal(countFromStatTooltip("Lectures : 1 234 567"), 1234567);
  assert.equal(countFromStatTooltip("플레이 횟수: 1,234"), 1234);
  assert.equal(countFromStatTooltip("Favoriten: 12"), 12);
  assert.equal(countFromStatTooltip(""), null);
});

function panel(id, playTitle, abbrev) {
  const p = window.document.createElement("div");
  p.className = "beatmapset-panel";
  p.innerHTML = `<a href="/beatmapsets/${id}">t</a>
    <div class="beatmapset-panel__stats-item beatmapset-panel__stats-item--play-count" data-orig-title="${playTitle}">
      <span class="beatmapset-panel__stats-item-icon"></span><span>${abbrev}</span>
    </div>
    <div class="beatmapset-panel__stats-item beatmapset-panel__stats-item--favourite-count" title="Favourites: 3">
      <span class="beatmapset-panel__stats-item-icon"></span><span>3</span>
    </div>`;
  window.document.body.append(p);
  return p;
}
const shown = (p, kind) =>
  p.querySelector(`.beatmapset-panel__stats-item--${kind} .oep-full-stat`)
    ?.textContent ?? null;

test("B26: cached JSON first, tooltip as fallback; site text untouched", () => {
  const a = panel(11, "Anzahl: 9.876", "9.9K");
  const b = panel(12, "Playcount: 5,000", "5K");
  beatmapsetCache.put([{ id: 12, play_count: 5003, favourite_count: 41 }]);
  applyFullBeatmapStatNumbers(window.document);
  assert.equal(shown(a, "play-count"), "9,876");
  assert.equal(shown(b, "play-count"), "5,003");
  assert.equal(shown(b, "favourite-count"), "41");
  const site = b.querySelector(".oep-full-stat + span");
  assert.equal(
    site.textContent,
    "5K",
    "osu-web's own number is kept (hidden by CSS)",
  );

  applyFullBeatmapStatNumbers(window.document); // idempotent
  assert.equal(b.querySelectorAll(".oep-full-stat").length, 2);

  revertFullBeatmapStatNumbers(window.document);
  assert.equal(window.document.querySelector(".oep-full-stat"), null);
  assert.equal(
    window.document.querySelector("[data-oep-full-stat-item]"),
    null,
  );
  a.remove();
  b.remove();
});
