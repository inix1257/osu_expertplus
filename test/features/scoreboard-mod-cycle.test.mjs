import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

/** rAF callbacks, run by `frames()`. */
let frameQueue = [];

function setup({ wildcards = false } = {}) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
  });
  window.OsuExpertPlus.settings = {
    IDS: { SCOREBOARD_MOD_GRID: "grid" },
    isEnabled: () => true,
  };
  window.OsuExpertPlus.auth = { isConfigured: () => wildcards };
  window.requestAnimationFrame = (cb) => frameQueue.push(cb);
  frameQueue = [];
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLTableElement",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  const btn = (ac) =>
    `<button class="beatmap-scoreboard-mod" data-oep-mod-hidden="1"><div class="mod__icon" data-acronym="${ac}"></div></button>`;
  window.document.body.innerHTML = `
    <div class="beatmapset-scoreboard">
      <div class="beatmapset-scoreboard__mods" data-oep-mod-grid="1">
        ${btn("DT")}${btn("NC")}
        <div class="pile"><button class="beatmap-scoreboard-mod" data-oep-merged-mod="DT_NC"><div class="mod__icon" data-acronym="DT"></div></button></div>
      </div>
    </div>`;
  const mods = window.document.querySelector(".beatmapset-scoreboard__mods");
  const [dt, nc] = mods.querySelectorAll(":scope > button");
  // osu-web: DT and NC are exclusive; a click toggles the clicked one.
  for (const [self, other] of [
    [dt, nc],
    [nc, dt],
  ]) {
    self.addEventListener("click", () => {
      const on = !self.classList.contains("beatmap-scoreboard-mod--enabled");
      self.classList.toggle("beatmap-scoreboard-mod--enabled", on);
      if (on) other.classList.remove("beatmap-scoreboard-mod--enabled");
    });
  }
  return { mods, dt, nc };
}

function frames(max = 200) {
  for (let i = 0; i < max && frameQueue.length; i++) {
    const batch = frameQueue;
    frameQueue = [];
    for (const cb of batch) cb();
  }
}

const on = (b) => b.classList.contains("beatmap-scoreboard-mod--enabled");

const { applyMergedModTargetStep, mergedModGridEffectiveStepCount } =
  await import("../../src/features/scoreboard/mod-filter/merged-cycle.js");
const { state } =
  await import("../../src/features/scoreboard/mod-filter/state.js");

/** What a click on the merged control does (grid.js). */
function clickMerged(mods) {
  const cur =
    state.mergedTarget.get("DT_NC") ?? state.mergedStep.get("DT_NC") ?? 0;
  const max = mergedModGridEffectiveStepCount("DT_NC");
  applyMergedModTargetStep(mods, "DT_NC", (cur + 1) % max);
}

test("merged DT/NC: steps off → DT → NC → off", () => {
  const { mods, dt, nc } = setup();
  state.mergedStep.clear();
  clickMerged(mods);
  frames();
  assert.deepEqual(
    [on(dt), on(nc), state.mergedStep.get("DT_NC")],
    [true, false, 1],
  );
  clickMerged(mods);
  frames();
  assert.deepEqual(
    [on(dt), on(nc), state.mergedStep.get("DT_NC")],
    [false, true, 2],
  );
  clickMerged(mods);
  frames();
  assert.deepEqual(
    [on(dt), on(nc), state.mergedStep.get("DT_NC")],
    [false, false, 0],
  );
});

test("merged DT/NC: a second click before the first finishes is kept (B80)", () => {
  const { mods, dt, nc } = setup();
  state.mergedStep.clear();
  clickMerged(mods);
  clickMerged(mods);
  frames();
  assert.deepEqual(
    [on(dt), on(nc), state.mergedStep.get("DT_NC")],
    [false, true, 2],
  );
  assert.equal(state.mergedTarget.has("DT_NC"), false);
});

test("merged DT/NC: the wildcard step needs credentials", () => {
  const { mods, dt, nc } = setup({ wildcards: true });
  state.mergedStep.clear();
  state.wildcard.clear();
  assert.equal(mergedModGridEffectiveStepCount("DT_NC"), 4);
  applyMergedModTargetStep(mods, "DT_NC", 3);
  frames();
  assert.deepEqual([on(dt), on(nc)], [false, false]);
  assert.equal(state.mergedStep.get("DT_NC"), 3);
  assert.ok(state.wildcard.get("DT") > 0, "DT is a wildcard");
  window.clearTimeout(state.wildcardDebounceTimer);
  state.wildcardAbortCtrl?.abort();
});
