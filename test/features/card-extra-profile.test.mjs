// Own file: a profile URL, and start() subscribes to the observer hub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(
  [
    "src/utils/dom.js",
    "src/utils/difficulty-colours.js",
    "src/utils/settings.js",
  ],
  { url: "https://osu.ppy.sh/users/2/osu" },
);
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "MutationObserver",
  "requestAnimationFrame",
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

const { start } = await import("../../src/features/cards/extra.js");
const { beatmapsetCache } = await import("../../src/core/beatmapset-cache.js");

const settings = window.OsuExpertPlus.settings;
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test("B27: sets from another page do not block the profile fallback", async () => {
  settings.set(settings.IDS.BEATMAP_CARD_EXTRA_INFO, true);
  // A listing visited earlier filled the cache with other sets.
  beatmapsetCache.put([{ id: 1, beatmaps: [] }]);
  const requests = [];
  window.OsuExpertPlus.api = {
    fetchUserExtraPage: async (userId, page, query) => {
      requests.push([userId, page, query.mode]);
      return {
        ok: true,
        json: async () => ({
          ranked: {
            items: [
              {
                id: 77,
                source: "",
                beatmaps: [{ mode: "osu", bpm: 200, total_length: 60 }],
              },
            ],
          },
        }),
      };
    },
  };
  window.document.body.innerHTML = `<div class="beatmapset-panel">
      <a href="/beatmapsets/77">t</a>
      <div class="beatmapset-panel__info">
        <div class="beatmapset-panel__info-row beatmapset-panel__info-row--artist">a</div>
        <div class="beatmapset-panel__info-row beatmapset-panel__info-row--mapper">m</div>
      </div>
    </div>`;
  const stop = start(settings, { hookProfileExtraPages: true });
  try {
    await tick(1400); // the hook grace period, then the fallback
    assert.deepEqual(requests, [["2", "beatmaps", "osu"]]);
    assert.equal(
      window.document.querySelector(".oep-beatmap-card-extra__meta")
        ?.textContent,
      "200 BPM · 1:00",
    );
  } finally {
    stop();
  }
});
