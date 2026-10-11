import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

// The page module is played by the test: it defines a fake BeatmapEngine and
// fires the loader's ready event (as in beatmap-preview-loader.test.mjs).
const { window } = loadScripts([], { url: "https://osu.ppy.sh/beatmapsets/1" });
for (const key of ["window", "document", "Event"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const engines = [];
class BeatmapEngine {
  constructor(root) {
    this.root = root;
    this.log = [];
    // The pause patch only pauses a playing engine.
    this.isPlaying = true;
    this.app = {
      ticker: {
        started: true,
        start: () => void (this.app.ticker.started = true),
        stop: () => void (this.app.ticker.started = false),
      },
    };
    engines.push(this);
  }
  init() {
    this.log.push("init");
    return new Promise((r) => (this.finishInit = r));
  }
  pause() {
    this.log.push("pause");
  }
  destroy() {
    this.log.push("destroy");
  }
  resize() {}
  updateBackgroundFromUrl() {}
  setCurrentTime() {}
  play() {}
  getTransportCurrentTimeMs() {
    return 0;
  }
}

const engineMod =
  await import("../../src/features/beatmap-preview/shared-engine.js");
const { loadBeatmapEngineClass } =
  await import("../../src/features/beatmap-preview/loader.js");
const loading = loadBeatmapEngineClass();
window.__oepPixiTextureEmpty = {};
window.__oepBeatmapEngine = BeatmapEngine;
window.dispatchEvent(new window.Event("oep-beatmap-renderer-esm-ready"));
await loading;

const tick = () => new Promise((r) => setTimeout(r, 0));
const doc = window.document;
const host = () => {
  const el = doc.createElement("div");
  doc.body.appendChild(el);
  return el;
};

test("B31: destroyed during init → the acquire fails, the engine is destroyed after init", async () => {
  const acquiring = engineMod.acquireSharedEngine(host());
  await tick();
  const [eng] = engines.slice(-1);
  engineMod.destroySharedEngineHard();
  assert.equal(doc.querySelector("[data-oep-beatmap-engine-root]"), null);
  assert.equal(eng.isPlaying, false, "paused at once");
  assert.deepEqual(eng.log, ["init"], "destroyed after init");
  eng.finishInit();
  await assert.rejects(acquiring, /Preview closed/);
  await tick();
  assert.deepEqual(eng.log, ["init", "destroy"]);
});

test("B88: a load in progress finishes before its engine is destroyed", async () => {
  const slot = host();
  let finishLoad;
  let loading;
  const waiting = new Promise((r) => (loading = r));
  let loaded = false;
  const load = engineMod.runEngineLoad(async () => {
    const acquiring = engineMod.acquireSharedEngine(slot);
    await tick();
    engines.at(-1).finishInit();
    const eng = await acquiring;
    const done = new Promise((r) => (finishLoad = r));
    loading();
    await done;
    loaded = true;
    return eng;
  });
  await waiting;
  const eng = engines.at(-1);
  assert.equal(engineMod.sharedEngine, eng);

  engineMod.destroySharedEngineHard();
  assert.equal(engineMod.sharedEngine, null);
  assert.equal(slot.childElementCount, 0, "the root leaves at once");
  await tick();
  assert.equal(eng.log.includes("destroy"), false, "not while loading");

  finishLoad();
  await load;
  await tick();
  assert.equal(loaded, true);
  assert.equal(eng.log.at(-1), "destroy");
});

test("B86: after a destroy the next acquire creates a new engine", async () => {
  const slot = host();
  const acquiring = engineMod.acquireSharedEngine(slot);
  await tick();
  const first = engines.at(-1);
  first.finishInit();
  assert.equal(await acquiring, first);
  engineMod.destroySharedEngineHard();

  const again = engineMod.acquireSharedEngine(slot);
  await tick();
  const second = engines.at(-1);
  assert.notEqual(second, first);
  second.finishInit();
  assert.equal(await again, second);
  assert.equal(
    slot.querySelectorAll("[data-oep-beatmap-engine-root]").length,
    1,
  );
  await tick();
  assert.equal(first.log.at(-1), "destroy");
  assert.equal(second.log.includes("destroy"), false);
});

test("B87: rendering stops and starts the engine's ticker", () => {
  const eng = engineMod.sharedEngine;
  engineMod.setSharedEngineRendering(false);
  assert.equal(eng.app.ticker.started, false);
  engineMod.setSharedEngineRendering(true);
  assert.equal(eng.app.ticker.started, true);
  engineMod.destroySharedEngineHard();
  engineMod.setSharedEngineRendering(false); // no engine: nothing to do
});
