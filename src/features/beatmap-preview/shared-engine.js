/**
 * The one BeatmapEngine (Pixi app) shared by every preview on the page:
 * acquire, place and destroy (WS-51).
 */

import { loadBeatmapEngineClass } from "./loader.js";
/**
 * At most one BeatmapEngine / Pixi Application at a time. It is created on
 * the first load and destroyed when the preview leaves the page or switches
 * difficulty or ruleset; the next load creates a new one (B86).
 */
/** @type {HTMLDivElement|null} */
let sharedEngineRoot = null;
/** @type {any} */
export let sharedEngine = null;

/** Serializes first-time init so two rapid "expand" clicks cannot create two Pixi apps. */
let acquireMutex = Promise.resolve();
/** The running `init()` of a new engine, so a destroy can wait for it (B31). */
let engineInitializing = null;

/**
 * @param {HTMLElement} hostEl  Visible canvas container (e.g. `.oep-beatmap-preview__canvas-host`).
 */
export function placeSharedEngineRoot(hostEl) {
  if (!sharedEngineRoot) return;
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

/** Loads on the shared engine, one at a time (B30). */
let engineLoadQueue = Promise.resolve();

/**
 * Run `task` after every load queued before it, so a load from a page that
 * was left finishes before the next page's load starts instead of running
 * beside it on the same engine (B30).
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export function runEngineLoad(task) {
  const run = engineLoadQueue.then(task, task);
  engineLoadQueue = run.catch(() => {});
  return run;
}

/**
 * Start or stop drawing frames. The renderer adds its frame update to the
 * Pixi ticker in `init()` and only stops it in `destroy()`, so a collapsed
 * preview would keep drawing every frame (B87). Reads the renderer's `app`.
 * @param {boolean} on
 */
export function setSharedEngineRendering(on) {
  const ticker = sharedEngine?.app?.ticker;
  if (!ticker) return;
  try {
    if (on) ticker.start();
    else ticker.stop();
  } catch (_) {
    void 0;
  }
}

/**
 * Destroys the shared engine and its root: the Pixi ticker, the WebGL context
 * (Pixi's destroy calls `loseContext`), the hitsound AudioContext and the
 * preview `<audio>`. Used when the preview leaves the page (dispose) and when
 * the page switches difficulty or ruleset while the preview is expanded;
 * collapsing with the toggle only pauses.
 */
export function destroySharedEngineHard() {
  const engine = sharedEngine;
  const root = sharedEngineRoot;
  sharedEngine = null;
  sharedEngineRoot = null;
  try {
    root?.remove();
  } catch (_) {
    void 0;
  }
  if (!engine) return;
  try {
    engine.pause?.();
  } catch (_) {
    void 0;
  }
  const teardown = () => {
    try {
      engine.destroy?.();
    } catch (_) {
      void 0;
    }
  };
  // B31: an engine still in init() is destroyed once init settles; the
  // acquire queue is never reset from outside, so acquires stay serialized.
  // B88: likewise once the loads queued so far settle; a loadBeatmap() that
  // goes on after destroy() would give the dead engine a new <audio>.
  Promise.all([engineInitializing, engineLoadQueue]).then(teardown, teardown);
}
