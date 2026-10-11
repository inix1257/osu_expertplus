/**
 * Loads osu-beatmap-renderer and Pixi from the CDN into the page as ES
 * modules and hands the BeatmapEngine class to the userscript (WS-51).
 */

import { pageWindow } from "../../core/page-window.js";
import {
  patchBeatmapEngineBackgroundContain,
  patchBeatmapEnginePreviewAudio,
} from "./engine-patches.js";

const READY_EVENT = "oep-beatmap-renderer-esm-ready";
const GLOBAL_KEY = "__oepBeatmapEngine";
/** `PIXI.Texture.EMPTY`, for the background patch (the userscript has no Pixi). */
const PIXI_EMPTY_TEXTURE_KEY = "__oepPixiTextureEmpty";
const LOADER_ATTR = "data-oep-beatmap-renderer-loader";
const IMPORTMAP_ATTR = "data-oep-pixi-importmap";

const PIXI_ESM_URL =
  "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
const RENDERER_ESM_URL =
  "https://cdn.jsdelivr.net/npm/osu-beatmap-renderer@0.1.2/dist/osu-beatmap-renderer.js";

/**
 * D11: SHA-384 of the exact files above, checked by the browser through the
 * import map (Chrome 127+, Firefox 138+; older browsers ignore it). A changed
 * file makes the load fail with an error instead of running.
 */
const MODULE_INTEGRITY = Object.freeze({
  pixi: "sha384-MryiqCBUxcjngKGCQBH2iYL6sT10lbGoVbtkle1ZUBC6z4PbaCEVaLfSGjyzURwZ",
  renderer:
    "sha384-64fRocbh7EKo2zRcbgh78V8aYtE1syju4KIvnYlIYWpgHiGf79P8DVw5NImYIbQ1",
});

/** A load that has not finished by then is reported as failed (B29). */
const LOAD_TIMEOUT_MS = 20000;

/** @type {Promise<any>|null} */
let engineClassPromise = null;
/** Failed attempts so far; each retry loads fresh URLs (B29). */
let attempt = 0;

/**
 * `url` for load attempt `n`. A module that failed to load stays failed for
 * the document's lifetime, so a retry needs a URL the page has not seen.
 * @param {string} url
 * @param {number} n
 */
function attemptUrl(url, n) {
  return n === 0 ? url : `${url}?oep-retry=${n}`;
}

/**
 * The import map for attempt `n`: the bare `pixi.js` the renderer imports,
 * and the integrity of both files. Retries map `pixi.js` again under a scope
 * for that attempt's renderer URL; browsers that accept only one import map
 * ignore it, and then only the renderer is fetched fresh.
 * @param {number} n
 */
function importMapFor(n) {
  const pixi = attemptUrl(PIXI_ESM_URL, n);
  const renderer = attemptUrl(RENDERER_ESM_URL, n);
  const integrity = {
    [pixi]: MODULE_INTEGRITY.pixi,
    [renderer]: MODULE_INTEGRITY.renderer,
  };
  return n === 0
    ? { imports: { "pixi.js": pixi }, integrity }
    : { scopes: { [renderer]: { "pixi.js": pixi } }, integrity };
}

/**
 * @param {number} n
 * @returns {string} the inline module that imports the engine for attempt `n`
 */
function loaderSource(n) {
  return `
import { BeatmapEngine } from ${JSON.stringify(attemptUrl(RENDERER_ESM_URL, n))};
import * as PIXI from "pixi.js";
window[${JSON.stringify(PIXI_EMPTY_TEXTURE_KEY)}] = PIXI.Texture.EMPTY;
window[${JSON.stringify(GLOBAL_KEY)}] = BeatmapEngine;
window.dispatchEvent(new Event(${JSON.stringify(READY_EVENT)}));
`;
}

/** @param {any} Cls  the page's BeatmapEngine class */
function patchEngineClass(Cls) {
  patchBeatmapEnginePreviewAudio(Cls);
  patchBeatmapEngineBackgroundContain(
    Cls,
    pageWindow()[PIXI_EMPTY_TEXTURE_KEY],
  );
}

/**
 * Load the engine class once per page. A failed load (network, integrity,
 * timeout) rejects right away and the next call tries again with fresh
 * URLs (B29).
 * @returns {Promise<any>} BeatmapEngine constructor
 */
export function loadBeatmapEngineClass() {
  const pw = pageWindow();
  const existing = pw[GLOBAL_KEY];
  if (existing && typeof existing === "function") {
    patchEngineClass(existing);
    return Promise.resolve(existing);
  }
  if (engineClassPromise) return engineClassPromise;

  const n = attempt;
  engineClassPromise = new Promise((resolve, reject) => {
    /** @type {HTMLScriptElement|null} */
    let script = null;
    let tid = 0;
    const finish = (err, Cls) => {
      pw.removeEventListener(READY_EVENT, onReady);
      window.clearTimeout(tid);
      if (err || !Cls) {
        engineClassPromise = null;
        attempt = n + 1;
        script?.remove();
        reject(err || new Error("BeatmapEngine missing"));
        return;
      }
      patchEngineClass(Cls);
      resolve(Cls);
    };

    const onReady = () => {
      const Cls = pageWindow()[GLOBAL_KEY];
      finish(
        Cls && typeof Cls === "function"
          ? null
          : new Error("BeatmapEngine not exposed"),
        Cls,
      );
    };

    pw.addEventListener(READY_EVENT, onReady, { once: true });
    tid = window.setTimeout(() => {
      finish(new Error("The preview engine took too long to load."), null);
    }, LOAD_TIMEOUT_MS);

    try {
      if (!document.querySelector(`script[${IMPORTMAP_ATTR}="${n}"]`)) {
        const map = document.createElement("script");
        map.type = "importmap";
        map.setAttribute(IMPORTMAP_ATTR, String(n));
        map.textContent = JSON.stringify(importMapFor(n));
        document.head.appendChild(map);
      }
      document.querySelector(`script[${LOADER_ATTR}]`)?.remove();
      script = document.createElement("script");
      script.type = "module";
      script.setAttribute(LOADER_ATTR, String(n));
      // A module that fails to fetch, parse or match its integrity fires
      // `error` on the script (B29: it used to wait 60 s for a timeout).
      script.addEventListener("error", () => {
        finish(new Error("Could not load the preview engine."), null);
      });
      script.textContent = loaderSource(n);
      document.head.appendChild(script);
    } catch (e) {
      finish(e, null);
    }
  });

  return engineClassPromise;
}
