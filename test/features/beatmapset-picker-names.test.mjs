import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/241526#mania/557820",
});
for (const key of ["window", "document", "location", "OsuExpertPlus"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
window.document.body.innerHTML = `<script id="json-beatmapset" type="application/json">${JSON.stringify(
  {
    id: 241526,
    beatmaps: [
      { id: 557815, mode: "osu", version: "Normal", difficulty_rating: 2.11 },
      {
        id: 557820,
        mode: "mania",
        version: "[7K] Normal",
        difficulty_rating: 1.93,
      },
    ],
    converts: [
      { id: 557815, mode: "taiko", version: "Normal", difficulty_rating: 1.98 },
      {
        id: 557815,
        mode: "mania",
        version: "[4K] Normal",
        difficulty_rating: 1.23,
      },
    ],
  },
)}</script>`;

const { getBeatmapVersionAndRatingForHeader } =
  await import("../../src/features/beatmapset/picker-diff-names.js");

test("picker names show a convert's own name and rating on its ruleset tab (B91)", () => {
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557815, "mania"), {
    version: "[4K] Normal",
    rating: 1.23,
  });
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557815, "taiko"), {
    version: "Normal",
    rating: 1.98,
  });
  // Its own ruleset, a native difficulty, or no ruleset: the beatmap itself.
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557815, "osu"), {
    version: "Normal",
    rating: 2.11,
  });
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557820, "mania"), {
    version: "[7K] Normal",
    rating: 1.93,
  });
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557815, null), {
    version: "Normal",
    rating: 2.11,
  });
  // No convert data for that ruleset: show nothing rather than osu! values.
  assert.deepEqual(getBeatmapVersionAndRatingForHeader(557815, "fruits"), {
    version: "",
    rating: null,
  });
});
