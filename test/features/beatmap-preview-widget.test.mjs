import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1#taiko/2",
});
for (const key of [
  "window",
  "unsafeWindow",
  "GM_getValue",
  "GM_setValue",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "MutationObserver",
  "Event",
  "OsuExpertPlus",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const transportMod =
  await import("../../src/features/beatmap-preview/widget/transport.js");
const { createPreviewKeydown } =
  await import("../../src/features/beatmap-preview/widget/keyboard.js");
const { buildPreviewDom } =
  await import("../../src/features/beatmap-preview/widget/dom.js");
const { mountBeatmapsetInfoPreview } =
  await import("../../src/features/beatmap-preview/widget/index.js");
const { PREVIEW_CLIP_CAP_MS } =
  await import("../../src/features/beatmap-preview/engine-patches.js");

const { el, manageStyle } = window.OsuExpertPlus.dom;
const doc = window.document;

test("formatPreviewTimeMs: m:ss, h:mm:ss from an hour, 0:00 for junk", () => {
  const f = transportMod.formatPreviewTimeMs;
  assert.equal(f(0), "0:00");
  assert.equal(f(61_999), "1:01");
  assert.equal(f(3_725_000), "1:02:05");
  assert.equal(f(-1), "0:00");
  assert.equal(f(NaN), "0:00");
});

/** An engine whose preview MP3 starts at beatmap time 1000 ms. */
function fakeEngine({ time, playing, duration = 4 }) {
  const audio = {
    duration,
    readyState: 4,
    currentTime: 0,
    volume: 1,
    paused: true,
    ended: false,
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
  return {
    previewAudio: audio,
    musicVolume: 0.5,
    isPlaying: playing,
    getCurrentTime: () => time,
    getPreviewAudioTimeMsForBeatmapTime: (ms) => ms - 1000,
  };
}

test("preview MP3 plays only inside its clip window", () => {
  const { syncPreviewMusicToWindow, getPreviewClipDurationMs } = transportMod;
  assert.equal(getPreviewClipDurationMs(fakeEngine({ time: 0 })), 4000);
  assert.equal(
    getPreviewClipDurationMs(fakeEngine({ time: 0, duration: 60 })),
    PREVIEW_CLIP_CAP_MS,
  );

  const inside = fakeEngine({ time: 3000, playing: true });
  syncPreviewMusicToWindow(inside);
  assert.equal(inside.previewAudio.paused, false);
  assert.equal(inside.previewAudio.currentTime, 2);
  assert.equal(inside.previewAudio.volume, 0.5);

  const after = fakeEngine({ time: 6000, playing: true });
  after.previewAudio.paused = false;
  syncPreviewMusicToWindow(after);
  assert.equal(after.previewAudio.paused, true);
  assert.equal(after.previewAudio.volume, 0);

  const pausedInside = fakeEngine({ time: 1500, playing: false });
  syncPreviewMusicToWindow(pausedInside);
  assert.equal(pausedInside.previewAudio.paused, true, "not started");
  assert.equal(pausedInside.previewAudio.volume, 0.5);
});

test("panel keys: arrows seek, Space toggles, sliders and buttons keep theirs", () => {
  const dom = buildPreviewDom(el, {
    musicVolume: 0.3,
    hitsoundVolume: 0.3,
    offsetText: "0",
  });
  doc.body.appendChild(dom.row);
  const calls = [];
  const transport = {
    seekByDeltaMs: (d) => calls.push(d),
    togglePlaybackFromCanvas: () => calls.push("toggle"),
  };
  const state = { expanded: true, busy: false, lastLoadedKey: "2" };
  const onKeydown = createPreviewKeydown(state, dom, transport);
  dom.panel.hidden = false;
  dom.seekRange.disabled = false;
  const press = (target, key, init = {}) => {
    const ev = new window.KeyboardEvent("keydown", {
      key,
      cancelable: true,
      ...init,
    });
    Object.defineProperty(ev, "target", { value: target });
    onKeydown(ev);
    return ev.defaultPrevented;
  };

  assert.equal(press(dom.canvasHost, "ArrowLeft"), true);
  assert.equal(press(dom.seekRange, "ArrowRight"), true);
  assert.equal(press(dom.canvasHost, " "), true);
  assert.deepEqual(calls, [-1000, 1000, "toggle"]);

  calls.length = 0;
  press(dom.musicVolumeRange, "ArrowLeft");
  press(dom.offsetInput, "ArrowRight");
  press(dom.previewTimeBtn, " ");
  press(dom.seekRange, "Enter");
  press(dom.canvasHost, "ArrowLeft", { ctrlKey: true });
  press(doc.body, " ");
  assert.deepEqual(calls, []);

  state.busy = true;
  press(dom.canvasHost, " ");
  state.busy = false;
  state.lastLoadedKey = "";
  press(dom.canvasHost, " ");
  assert.deepEqual(calls, [], "nothing while loading or before a load");
  dom.row.remove();
});

test("widget: collapsed and disabled at first; another ruleset is unsupported; dispose cleans up", async () => {
  const ui = mountBeatmapsetInfoPreview({
    el,
    manageStyle,
    pathRe: /^\/beatmapsets\/\d+/,
    getBeatmapId: () => "2",
    getRuleset: () => "taiko",
    readBeatmapsetJson: () => ({ id: 1 }),
    styleId: "oep-preview-test-css",
  });
  const row = ui.getRow();
  doc.body.appendChild(row);
  assert.ok(doc.getElementById("oep-preview-test-css"), "style injected");

  const panel = row.querySelector(".oep-beatmap-preview__panel");
  const toggle = row.querySelector(".oep-beatmap-preview__toggle");
  const label = () =>
    toggle.querySelector(".btn-osu-big__text-top").textContent;
  assert.equal(panel.hidden, true);
  assert.equal(label(), "Beatmap Preview");
  for (const c of row.querySelectorAll(
    "input, button:not(.oep-beatmap-preview__toggle)",
  )) {
    assert.equal(c.disabled, true, c.outerHTML);
  }

  toggle.click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(panel.hidden, false);
  assert.equal(label(), "Hide beatmap preview");
  assert.ok(
    panel.classList.contains("oep-beatmap-preview__panel--unsupported"),
    "taiko is not supported",
  );
  assert.equal(doc.querySelector("[data-oep-beatmap-engine-root]"), null);

  toggle.click();
  assert.equal(panel.hidden, true);
  assert.equal(
    panel.classList.contains("oep-beatmap-preview__panel--unsupported"),
    false,
  );

  ui.dispose();
  assert.equal(row.isConnected, false);
  assert.equal(
    doc.getElementById("oep-preview-test-css"),
    null,
    "style removed",
  );
});
