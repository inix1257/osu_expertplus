/**
 * The one BeatmapEngine (Pixi app) shared by every preview on the page:
 * acquire, park, place and destroy (WS-51).
 */

import { loadBeatmapEngineClass } from "./loader.js";
/**
 * One BeatmapEngine / Pixi Application per tab. Pixi v8 registers extension handlers
 * (e.g. batcher) globally; destroying and creating a second Application throws
 * "Extension type batcher already has a handler".
 */
/** @type {HTMLDivElement|null} */
let sharedEngineRoot = null;
/** @type {any} */
export let sharedEngine = null;

/** Serializes first-time init so two rapid "expand" clicks cannot create two Pixi apps. */
let acquireMutex = Promise.resolve();
/** The running `init()` of a new engine, so a destroy can wait for it (B31). */
let engineInitializing = null;

const ENGINE_ROOT_PARK_STYLE =
  "position:fixed!important;left:-9999px!important;top:0!important;width:512px!important;height:288px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;";

export function parkSharedEngineRoot() {
  if (!sharedEngineRoot) return;
  try {
    sharedEngine?.pause?.();
  } catch (_) {
    void 0;
  }
  sharedEngineRoot.setAttribute("style", ENGINE_ROOT_PARK_STYLE);
  if (document.body) {
    document.body.appendChild(sharedEngineRoot);
  }
}

/**
 * @param {HTMLElement} hostEl  Visible canvas container (e.g. `.oep-beatmap-preview__canvas-host`).
 */
export function placeSharedEngineRoot(hostEl) {
  if (!sharedEngineRoot) return;
  sharedEngineRoot.removeAttribute("style");
  hostEl.replaceChildren(sharedEngineRoot);
}

/**
 * @param {HTMLElement} hostEl
 */
export async function acquireSharedEngine(hostEl) {
  const run = acquireMutex.then(async () => {
    const BeatmapEngine = await loadBeatmapEngineClass();
    if (!sharedEngineRoot) {
      const root = document.createElement("div");
      root.setAttribute("data-oep-beatmap-engine-root", "");
      root.className = "oep-beatmap-preview-engine-root";
      hostEl.replaceChildren(root);
      const engine = new BeatmapEngine(root, {});
      sharedEngineRoot = root;
      sharedEngine = engine;
      engineInitializing = engine.init();
      try {
        await engineInitializing;
      } finally {
        engineInitializing = null;
      }
      // Destroyed while initialising (preview collapsed, other ruleset).
      if (sharedEngine !== engine) throw new Error("Preview closed.");
    } else {
      placeSharedEngineRoot(hostEl);
      try {
        sharedEngine?.resize?.();
      } catch (_) {
        void 0;
      }
    }
    return sharedEngine;
  });
  acquireMutex = run.catch(() => {});
  return run;
}

/**
 * Destroys the shared engine and its root. Used when the preview is collapsed
 * and when switching to a non-osu! ruleset; SPA navigation only parks it.
 */
export function destroySharedEngineHard() {
  const engine = sharedEngine;
  const root = sharedEngineRoot;
  sharedEngine = null;
  sharedEngineRoot = null;
  const teardown = () => {
    try {
      engine?.destroy?.();
    } catch (_) {
      void 0;
    }
    try {
      root?.remove();
    } catch (_) {
      void 0;
    }
  };
  // B31: an engine still in init() is destroyed once init settles; the
  // acquire queue is never reset from outside, so acquires stay serialized.
  if (engineInitializing) engineInitializing.then(teardown, teardown);
  else teardown();
}
