import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

// jsdom does not run module scripts, so the test plays the browser: it reads
// what the loader inserted and fires `error` or the ready event itself.
const { window } = loadScripts([], { url: "https://osu.ppy.sh/beatmapsets/1" });
for (const key of ["window", "document", "Event"]) {
  Object.defineProperty(globalThis, key, {
    value: window[key === "window" ? "window" : key],
    configurable: true,
    writable: true,
  });
}
globalThis.window = window;

const { loadBeatmapEngineClass } =
  await import("../../src/features/beatmap-preview/loader.js");

const doc = window.document;
const importMaps = () =>
  [...doc.querySelectorAll("script[type=importmap]")].map((s) =>
    JSON.parse(s.textContent),
  );
const loaderScript = () =>
  doc.querySelector("script[data-oep-beatmap-renderer-loader]");

test("B29/D11: a failed load rejects at once, a retry uses fresh URLs", async () => {
  const first = loadBeatmapEngineClass();
  const [map0] = importMaps();
  assert.match(
    map0.imports["pixi.js"],
    /pixi\.js@8\.6\.6\/dist\/pixi\.min\.mjs$/,
  );
  const urls0 = Object.keys(map0.integrity);
  assert.equal(urls0.length, 2);
  for (const url of urls0) assert.match(map0.integrity[url], /^sha384-/);
  assert.match(loaderScript().textContent, /osu-beatmap-renderer@0\.1\.2/);

  loaderScript().dispatchEvent(new window.Event("error"));
  await assert.rejects(first, /Could not load the preview engine/);
  assert.equal(loaderScript(), null, "the failed loader is removed");

  const second = loadBeatmapEngineClass();
  const maps = importMaps();
  assert.equal(
    maps.length,
    2,
    "the first import map stays; a scoped one is added",
  );
  const retry = maps[1];
  const [scope] = Object.keys(retry.scopes);
  assert.match(scope, /osu-beatmap-renderer\.js\?oep-retry=1$/);
  assert.match(retry.scopes[scope]["pixi.js"], /\?oep-retry=1$/);
  assert.ok(loaderScript().textContent.includes(scope));

  // The page module ran: it exposes the class and Pixi's empty texture.
  class BeatmapEngine {
    resize() {}
    updateBackgroundFromUrl() {}
    setCurrentTime() {}
    play() {}
    pause() {}
    getTransportCurrentTimeMs() {
      return 0;
    }
  }
  window.__oepPixiTextureEmpty = {};
  window.__oepBeatmapEngine = BeatmapEngine;
  window.dispatchEvent(new window.Event("oep-beatmap-renderer-esm-ready"));
  assert.equal(await second, BeatmapEngine);
  assert.equal(BeatmapEngine.prototype.__oepBeatmapEngineBgContain, true);
  assert.equal(await loadBeatmapEngineClass(), BeatmapEngine, "loaded once");
});
