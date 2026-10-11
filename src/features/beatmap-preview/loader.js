/**
 * Loads osu-beatmap-renderer and Pixi from the CDN into the page as ES
 * modules and hands the BeatmapEngine class to the userscript (WS-51).
 */

import { pageWindow } from "../../core/page-window.js";
import { patchBeatmapEnginePreviewAudio } from "./engine-patches.js";
const READY_EVENT = "oep-beatmap-renderer-esm-ready";
const GLOBAL_KEY = "__oepBeatmapEngine";
const LOADER_ATTR = "data-oep-beatmap-renderer-loader";
const IMPORTMAP_ATTR = "data-oep-pixi-importmap";

const PIXI_ESM_URL =
  "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
const RENDERER_ESM_URL =
  "https://cdn.jsdelivr.net/npm/osu-beatmap-renderer@0.1.2/dist/osu-beatmap-renderer.js";

/** @type {Promise<any>|null} */
let engineClassPromise = null;

/**
 * @returns {Promise<any>} BeatmapEngine constructor
 */
export function loadBeatmapEngineClass() {
  const pw = pageWindow();
  const existing = pw[GLOBAL_KEY];
  if (existing && typeof existing === "function") {
    patchBeatmapEnginePreviewAudio(existing);
    return Promise.resolve(existing);
  }
  if (engineClassPromise) return engineClassPromise;

  engineClassPromise = new Promise((resolve, reject) => {
    let tid = 0;
    const finish = (err, Cls) => {
      pw.removeEventListener(READY_EVENT, onReady);
      if (tid) window.clearTimeout(tid);
      if (err || !Cls) {
        engineClassPromise = null;
        document.querySelector(`script[${LOADER_ATTR}]`)?.remove();
        try {
          delete pw[GLOBAL_KEY];
        } catch (_) {
          pw[GLOBAL_KEY] = undefined;
        }
        reject(err || new Error("BeatmapEngine missing"));
        return;
      }
      patchBeatmapEnginePreviewAudio(Cls);
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
      finish(new Error("Beatmap renderer load timeout"), null);
    }, 60000);

    const ClsNow = pw[GLOBAL_KEY];
    if (ClsNow && typeof ClsNow === "function") {
      finish(null, ClsNow);
      return;
    }

    try {
      if (!document.querySelector(`script[${LOADER_ATTR}]`)) {
        if (!document.querySelector(`script[${IMPORTMAP_ATTR}]`)) {
          const map = document.createElement("script");
          map.type = "importmap";
          map.setAttribute(IMPORTMAP_ATTR, "");
          map.textContent = JSON.stringify({
            imports: { "pixi.js": PIXI_ESM_URL },
          });
          document.head.appendChild(map);
        }

        const script = document.createElement("script");
        script.type = "module";
        script.setAttribute(LOADER_ATTR, "");
        script.textContent = `
import { BeatmapEngine } from ${JSON.stringify(RENDERER_ESM_URL)};
import * as PIXI from "pixi.js";

const OEP_BG_CONTAIN_PATCH = "__oepBeatmapEngineBgContain";
{
const p = BeatmapEngine.prototype;
if (!p[OEP_BG_CONTAIN_PATCH]) {
  function reflowBackgroundContain(self) {
    try {
      const sp = self.backgroundSprite;
      const tex = sp?.texture;
      if (!sp || !tex || tex === PIXI.Texture.EMPTY || !tex.width || !tex.height) {
        return;
      }
      const { width, height } = self.getDisplayDimensions();
      const scaleX = width / tex.width;
      const scaleY = height / tex.height;
      const scale = Math.min(scaleX, scaleY);
      sp.scale.set(scale);
      sp.x = (width - tex.width * scale) / 2;
      sp.y = (height - tex.height * scale) / 2;
      // Darken cover art so objects/readability match typical in-game dimming.
      sp.tint = 0x5a5a5a;
    } catch (_e) {
      void 0;
    }
  }

  const origUpdateBg = p.updateBackgroundFromUrl;
  p.updateBackgroundFromUrl = async function oepUpdateBackgroundFromUrl(imageUrl) {
    await origUpdateBg.call(this, imageUrl);
    reflowBackgroundContain(this);
  };

  const origResize = p.resize;
  p.resize = function oepResize() {
    origResize.call(this);
    reflowBackgroundContain(this);
  };

  p[OEP_BG_CONTAIN_PATCH] = true;
}
}

window[${JSON.stringify(GLOBAL_KEY)}] = BeatmapEngine;
window.dispatchEvent(new Event(${JSON.stringify(READY_EVENT)}));
`;
        document.head.appendChild(script);
      }
    } catch (e) {
      finish(e, null);
    }
  });

  return engineClassPromise;
}
