import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window, gmStore } = loadScripts([], {
  url: "https://osu.ppy.sh/beatmapsets/1",
});
for (const key of ["window", "unsafeWindow", "GM_getValue", "GM_setValue"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const prefs = await import("../../src/features/beatmap-preview/prefs.js");
const ls = window.localStorage;

test("volumes: stored, then the old GM key (copied once), site, default", () => {
  ls.clear();
  gmStore.clear();
  assert.equal(prefs.musicVolumePref.read(), prefs.PREVIEW_VOLUME_DEFAULT);

  ls.setItem("userPreferences", JSON.stringify({ audio_volume: 0.55 }));
  assert.equal(prefs.musicVolumePref.read(), 0.55, "site volume");

  gmStore.set("beatmapPreview.hitsoundVolume", "0.4");
  assert.equal(prefs.hitsoundVolumePref.read(), 0.4, "old GM key");
  assert.equal(
    ls.getItem("oep.beatmapPreview.hitsoundVolume"),
    "0.4",
    "copied",
  );

  prefs.musicVolumePref.write(0.8);
  assert.equal(prefs.musicVolumePref.read(), 0.8);
  ls.setItem("oep.beatmapPreview.musicVolume", "7");
  assert.equal(prefs.musicVolumePref.read(), 0.55, "out of range is ignored");
});

test("audio offset: clamped, parsed strictly, stored as displayed", () => {
  ls.clear();
  assert.equal(prefs.readStoredOffsetMs(), 0);
  prefs.writeStoredOffsetMs(9999);
  assert.equal(prefs.readStoredOffsetMs(), 500);
  assert.equal(prefs.parseOffsetTextStrict(" -42 ms"), -42);
  assert.equal(prefs.parseOffsetTextStrict("-"), null);
  assert.equal(prefs.parseOffsetTextStrict("abc"), null);
  assert.equal(prefs.actualAudioOffsetMsFromDisplay(0), 85);
  assert.equal(prefs.formatOffsetForField(-12.6), "-13");
});
