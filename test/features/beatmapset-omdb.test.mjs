import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

function setup(omdbStub) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/7#osu/71",
  });
  window.OsuExpertPlus.omdb = omdbStub;
  // Picker hovers re-sync on the next frame.
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  for (const key of [
    "window",
    "document",
    "location",
    "Node",
    "Element",
    "HTMLElement",
    "HTMLAnchorElement",
    "MouseEvent",
    "MutationObserver",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  window.document.body.innerHTML = `
    <script id="json-beatmapset" type="application/json">{"id":7,"beatmaps":[{"id":71},{"id":72}]}</script>
    <div class="beatmapset-header">
      <div class="beatmapset-header__beatmap-picker-box">
        <div class="beatmapset-beatmap-picker">
          <a class="beatmapset-beatmap-picker__beatmap beatmapset-beatmap-picker__beatmap--active" href="#osu/71"></a>
          <a class="beatmapset-beatmap-picker__beatmap" href="#osu/72"></a>
        </div>
        <div class="beatmapset-header__diff-name">Insane</div>
      </div>
    </div>`;
  return window;
}

const { mountOmdbRow } = await import("../../src/features/beatmapset/omdb.js");

const tick = () => new Promise((r) => setTimeout(r, 0));
const PATH = /^\/beatmapsets\/7(?:\/|$)/;

function body(window) {
  return window.document.querySelector(".oep-beatmapset-omdb-row__body");
}

/** Hover the second difficulty in the picker (what used to overwrite the state). */
function hoverOther(window) {
  const a = window.document.querySelector('a[href="#osu/72"]');
  a.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true }));
}

test("OMDB row: hovering the picker keeps Loading… and errors (B57)", async () => {
  let fail;
  const window = setup({
    isConfigured: () => true,
    fetchBeatmapsetRatings: () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  });
  const header = window.document.querySelector(".beatmapset-header");
  const dispose = mountOmdbRow(header, "7", PATH);

  hoverOther(window);
  await tick();
  assert.equal(body(window).textContent, "Loading OMDB…");

  fail(new Error("OMDB is down"));
  await tick();
  hoverOther(window);
  await tick();
  assert.equal(body(window).textContent, "OMDB is down");
  assert.ok(
    body(window).classList.contains("oep-beatmapset-omdb-row__body--error"),
  );
  dispose();
});

test("OMDB row: a saved vote whose refresh fails is not an error (B58)", async () => {
  let calls = 0;
  const window = setup({
    isConfigured: () => true,
    fetchBeatmapsetRatings: async () => {
      calls += 1;
      if (calls > 1) throw new Error("refresh failed");
      return [{ BeatmapID: 71, WeightedAvg: 3.5, RatingCount: 10 }];
    },
    rateBeatmap: async () => ({}),
  });
  const header = window.document.querySelector(".beatmapset-header");
  const dispose = mountOmdbRow(header, "7", PATH);
  await tick();
  assert.match(body(window).textContent, /3\.5/);

  window.document
    .querySelector(".oep-beatmapset-omdb-vote__half[data-oep-score]")
    .click();
  await tick();
  await tick();
  const status = window.document.querySelector(
    ".oep-beatmapset-omdb-vote__status",
  );
  assert.equal(
    status.textContent,
    "Rating saved, but OMDB ratings could not be refreshed.",
  );
  assert.ok(
    !status.classList.contains("oep-beatmapset-omdb-vote__status--error"),
  );
  dispose();
});

test("OMDB row: without a key it loads each shown difficulty from the public endpoint", async () => {
  const requested = [];
  const window = setup({
    isConfigured: () => false,
    fetchBeatmapsetRatings: () => assert.fail("set endpoint needs a key"),
    fetchPublicBeatmapRatings: async (id) => {
      requested.push(id);
      return id === 71
        ? { BeatmapID: 71, WeightedAvg: 3.5, RatingCount: 10 }
        : null;
    },
  });
  const header = window.document.querySelector(".beatmapset-header");
  const dispose = mountOmdbRow(header, "7", PATH);
  assert.equal(body(window).textContent, "Loading OMDB…");
  await tick();
  await tick();
  assert.match(body(window).textContent, /3\.5/);

  hoverOther(window);
  await tick();
  await tick();
  await tick();
  assert.equal(
    body(window).textContent,
    "No ratings for this difficulty on OMDB.",
  );
  hoverOther(window);
  await tick();
  assert.deepEqual(requested, [71, 72]);

  assert.ok(window.document.querySelector("[data-oep-omdb-key-hint]"));
  assert.equal(window.document.querySelector("[data-oep-omdb-vote]"), null);
  dispose();
});

test("OMDB row: without a key a failed request shows its error", async () => {
  const window = setup({
    isConfigured: () => false,
    fetchPublicBeatmapRatings: async () => {
      throw new Error("Could not reach OMDB.");
    },
  });
  const header = window.document.querySelector(".beatmapset-header");
  const dispose = mountOmdbRow(header, "7", PATH);
  await tick();
  await tick();
  assert.equal(body(window).textContent, "Could not reach OMDB.");
  assert.ok(
    body(window).classList.contains("oep-beatmapset-omdb-row__body--error"),
  );
  dispose();
});
