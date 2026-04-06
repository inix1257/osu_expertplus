/** Lazy ESM load osu-beatmap-renderer + Pixi; gameplay preview on beatmapset pages. */
/* global unsafeWindow, GM_getValue, GM_xmlhttpRequest */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapPreview = (() => {
  const READY_EVENT = "oep-beatmap-renderer-esm-ready";
  const GLOBAL_KEY = "__oepBeatmapEngine";
  const LOADER_ATTR = "data-oep-beatmap-renderer-loader";
  const IMPORTMAP_ATTR = "data-oep-pixi-importmap";

  const PIXI_ESM_URL =
    "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
  const RENDERER_ESM_URL =
    "https://cdn.jsdelivr.net/npm/osu-beatmap-renderer@0.1.2/dist/osu-beatmap-renderer.js";

  /** Page window (unsafeWindow under TM). */
  function pageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {
      void 0;
    }
    return window;
  }

  /** Page-origin `localStorage` (osu.ppy.sh), or null if unavailable. */
  function pageLocalStorage() {
    try {
      const pw = pageWindow();
      return pw?.localStorage ?? null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Reads osu! web `localStorage.userPreferences` JSON and returns `audio_volume` if valid (0–1).
   * @returns {number|null}
   */
  function readOsuSiteAudioVolume() {
    const ls = pageLocalStorage();
    if (!ls) return null;
    try {
      const raw = ls.getItem("userPreferences");
      if (raw == null || raw === "") return null;
      const obj = JSON.parse(raw);
      const v = obj?.audio_volume;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    } catch (_) {
      void 0;
    }
    return null;
  }

  /** @type {Promise<any>|null} */
  let engineClassPromise = null;

  const BEATMAP_ENGINE_AUDIO_PATCH = "__oepBeatmapEngineNoPreviewAudioCors";
  const BEATMAP_ENGINE_SEEK_PATCH = "__oepBeatmapEngineSeekBeforePreview";
  const BEATMAP_ENGINE_PLAY_PATCH = "__oepBeatmapEnginePlayOutsidePreview";
  const BEATMAP_ENGINE_TRANSPORT_PATCH = "__oepBeatmapEngineTransportPreview";
  const BEATMAP_ENGINE_PAUSE_PATCH = "__oepBeatmapEnginePauseSnapshot";
  /** Same cap as site preview MP3 handling in {@link mountBeatmapsetInfoPreview}. */
  const OEP_PREVIEW_CLIP_CAP_MS = 10000;

  /**
   * True when beatmap time does not fall inside the ~10s site preview MP3 (relative to PreviewTime).
   * @param {any} engine
   * @param {number} beatmapMs
   */
  function isBeatmapTimeOutsideSitePreviewClip(engine, beatmapMs) {
    if (
      !engine?.previewAudio ||
      typeof engine.getPreviewAudioTimeMsForBeatmapTime !== "function" ||
      !Number.isFinite(beatmapMs)
    ) {
      return false;
    }
    const shifted = engine.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
    const dur = engine.previewAudio.duration;
    const durMs =
      Number.isFinite(dur) && dur > 0
        ? Math.min(OEP_PREVIEW_CLIP_CAP_MS, dur * 1000)
        : OEP_PREVIEW_CLIP_CAP_MS;
    return !Number.isFinite(shifted) || shifted < 0 || shifted >= durMs;
  }

  /**
   * osu-beatmap-renderer sets `crossOrigin = "anonymous"` on the preview HTMLAudioElement.
   * `https://b.ppy.sh/preview/…` does not send ACAO, so the request fails and playback never starts.
   * Omit CORS mode so the element can stream and report `currentTime` for sync (no WebAudio decode needed).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePreviewAudio(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto) return;
    if (!proto[BEATMAP_ENGINE_AUDIO_PATCH]) {
      proto.updateAudioTrackFromUrl = function oepUpdateAudioTrackFromUrl(
        audioUrl,
      ) {
        if (this.previewAudio) {
          this.previewAudio.pause();
          this.previewAudio.src = "";
        }
        this.previewAudio = new Audio(audioUrl);
        this.previewAudio.preload = "auto";
        this.previewAudio.volume = this.musicVolume;
      };
      proto[BEATMAP_ENGINE_AUDIO_PATCH] = true;
    }
    patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine);
  }

  /**
   * While playing, osu-beatmap-renderer's `setCurrentTime` re-reads `previewAudio.currentTime` and
   * maps it back to beatmap time. Seeking before PreviewTime clamps audio to 0s, which maps to
   * PreviewTime again — so the scrubber snaps back. Pause preview audio before that path when the
   * seek target is outside the ~10s clip, and clear audio sync offset so transport follows the clock.
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_SEEK_PATCH]) return;
    const orig = proto.setCurrentTime;
    proto.setCurrentTime = function oepSetCurrentTime(ms) {
      if (!Number.isFinite(ms)) {
        return orig.call(this, ms);
      }
      const outsideClip =
        !!this.previewAudio && isBeatmapTimeOutsideSitePreviewClip(this, ms);
      if (this.isPlaying && outsideClip && this.previewAudio) {
        try {
          this.previewAudio.pause();
        } catch (_) {
          void 0;
        }
      }
      const ret = orig.call(this, ms);
      if (outsideClip) {
        this.audioSyncOffsetMs = 0;
        this.lastAudioSyncSamplePerfMs = 0;
      }
      return ret;
    };
    proto[BEATMAP_ENGINE_SEEK_PATCH] = true;
  }

  /**
   * `play()` always starts the preview HTMLAudioElement and sets its `currentTime` from beatmap time.
   * Outside the ~10s clip that maps to nonsense (browser clamps to file end), then
   * `getTransportCurrentTimeMs()` syncs the visual clock to that wrong audio position — huge jumps
   * after pause/resume. Keep preview audio paused when resuming outside the clip (same as our rAF
   * sync); transport uses the performance clock only there.
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PLAY_PATCH]) return;
    const orig = proto.play;
    proto.play = function oepPlay(options) {
      orig.call(this, options);
      try {
        if (
          this.previewAudio &&
          isBeatmapTimeOutsideSitePreviewClip(this, this.currentTime)
        ) {
          this.previewAudio.pause();
        }
      } catch (_) {
        void 0;
      }
    };
    proto[BEATMAP_ENGINE_PLAY_PATCH] = true;
  }

  /**
   * Outside the site preview MP3 window, never apply preview-audio drift correction — the element
   * is clamped to [0, duration] and maps to the wrong beatmap time, which corrupts
   * `audioSyncOffsetMs` and jumps the timeline (notably after pause/resume).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_TRANSPORT_PATCH]) return;
    const orig = proto.getTransportCurrentTimeMs;
    proto.getTransportCurrentTimeMs = function oepGetTransportCurrentTimeMs() {
      if (!this.isPlaying) {
        return orig.call(this);
      }
      const nowPerfMs = performance.now();
      const elapsedMs = nowPerfMs - this.transportStartPerfTime;
      const perfVisualMs = this.transportStartMs + Math.max(0, elapsedMs);

      const bypassAudioSync =
        this.previewAudio?.ended ||
        isBeatmapTimeOutsideSitePreviewClip(this, perfVisualMs);

      if (bypassAudioSync) {
        const offset = Number(this.audioSyncOffsetMs) || 0;
        if (offset !== 0) {
          const currentVisual = perfVisualMs + offset;
          this.transportStartMs = currentVisual;
          this.transportStartPerfTime = nowPerfMs;
          this.audioSyncOffsetMs = 0;
          this.lastAudioSyncSamplePerfMs = 0;
          return currentVisual;
        }
        return perfVisualMs;
      }
      return orig.call(this);
    };
    proto[BEATMAP_ENGINE_TRANSPORT_PATCH] = true;
  }

  /**
   * Snapshot transport on pause after pausing preview audio and clearing sync offset, so
   * `getTransportCurrentTimeMs()` does not use a still-playing MP3 clock (same tick as pause).
   *
   * @param {any} BeatmapEngine
   */
  function patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PAUSE_PATCH]) return;
    proto.pause = function oepPause() {
      if (!this.isPlaying) {
        return;
      }
      try {
        if (this.previewAudio) {
          this.previewAudio.pause();
        }
      } catch (_) {
        void 0;
      }
      this.audioSyncOffsetMs = 0;
      this.lastAudioSyncSamplePerfMs = 0;
      this.currentTime = this.getTransportCurrentTimeMs();
      this.isPlaying = false;
      this.hitsoundPlayer?.stopScheduler();
      this.hitsoundPlayer?.clearScheduledSources();
    };
    proto[BEATMAP_ENGINE_PAUSE_PATCH] = true;
  }

  /**
   * One BeatmapEngine / Pixi Application per tab. Pixi v8 registers extension handlers
   * (e.g. batcher) globally; destroying and creating a second Application throws
   * "Extension type batcher already has a handler".
   */
  /** @type {HTMLDivElement|null} */
  let sharedEngineRoot = null;
  /** @type {any} */
  let sharedEngine = null;

  /** Serializes first-time init so two rapid "expand" clicks cannot create two Pixi apps. */
  let acquireMutex = Promise.resolve();

  const ENGINE_ROOT_PARK_STYLE =
    "position:fixed!important;left:-9999px!important;top:0!important;width:512px!important;height:288px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;";

  function parkSharedEngineRoot() {
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
  function placeSharedEngineRoot(hostEl) {
    if (!sharedEngineRoot) return;
    sharedEngineRoot.removeAttribute("style");
    hostEl.replaceChildren(sharedEngineRoot);
  }

  /**
   * @param {HTMLElement} hostEl
   */
  async function acquireSharedEngine(hostEl) {
    const run = acquireMutex.then(async () => {
      const BeatmapEngine = await loadBeatmapEngineClass();
      if (!sharedEngineRoot) {
        sharedEngineRoot = document.createElement("div");
        sharedEngineRoot.setAttribute("data-oep-beatmap-engine-root", "");
        sharedEngineRoot.className = "oep-beatmap-preview-engine-root";
        hostEl.replaceChildren(sharedEngineRoot);
        sharedEngine = new BeatmapEngine(sharedEngineRoot, {});
        await sharedEngine.init();
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
   * Hard teardown (e.g. future "reset renderer" / tests). Not used on normal SPA navigation.
   */
  function destroySharedEngineHard() {
    try {
      sharedEngine?.destroy?.();
    } catch (_) {
      void 0;
    }
    sharedEngine = null;
    try {
      sharedEngineRoot?.remove();
    } catch (_) {
      void 0;
    }
    sharedEngineRoot = null;
  }

  /**
   * @returns {Promise<any>} BeatmapEngine constructor
   */
  function loadBeatmapEngineClass() {
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

  /**
   * @param {string|number} beatmapId
   * @returns {Promise<string>}
   */
  async function fetchOsuFileText(beatmapId) {
    const url = `https://osu.ppy.sh/osu/${beatmapId}`;
    const resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) {
      throw new Error(`Could not download .osu (${resp.status})`);
    }
    return resp.text();
  }

  /**
   * @param {string|undefined|null} url
   * @returns {string}
   */
  function absoluteUrl(url) {
    if (!url) return "";
    const s = String(url).trim();
    if (!s) return "";
    if (s.startsWith("//")) return `https:${s}`;
    return s;
  }

  /** Revoked when loading another map or disposing the preview UI. */
  let beatmapCoverObjectUrl = null;

  function revokeBeatmapCoverObjectUrl() {
    if (beatmapCoverObjectUrl) {
      try {
        URL.revokeObjectURL(beatmapCoverObjectUrl);
      } catch (_) {
        void 0;
      }
      beatmapCoverObjectUrl = null;
    }
  }

  /**
   * Cross-origin cover URLs taint pixels; Pixi WebGL upload then throws "The operation is insecure".
   * Load bytes into a blob: URL (same-origin for WebGL).
   * Prefer GM_xmlhttpRequest first when available so we do not hit `fetch` on hosts without ACAO
   * (avoids a failed CORS request and console noise before the GM fallback).
   *
   * @param {string} absUrl
   * @returns {Promise<string>} object URL or "" if unavailable
   */
  async function fetchBeatmapCoverObjectUrl(absUrl) {
    if (!absUrl) return "";
    revokeBeatmapCoverObjectUrl();

    /** @returns {Promise<ArrayBuffer>} */
    function gmGetArrayBuffer() {
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== "function") {
          reject(new Error("no-gm"));
          return;
        }
        GM_xmlhttpRequest({
          method: "GET",
          url: absUrl,
          responseType: "arraybuffer",
          onload(r) {
            if (r.status >= 200 && r.status < 300 && r.response) {
              resolve(r.response);
            } else {
              reject(new Error(String(r.status)));
            }
          },
          onerror: () => reject(new Error("xhr")),
        });
      });
    }

    try {
      let buf;
      if (typeof GM_xmlhttpRequest === "function") {
        try {
          buf = await gmGetArrayBuffer();
        } catch (_) {
          const res = await fetch(absUrl, {
            credentials: "include",
            mode: "cors",
          });
          if (!res.ok) throw new Error(String(res.status));
          buf = await res.arrayBuffer();
        }
      } else {
        const res = await fetch(absUrl, {
          credentials: "include",
          mode: "cors",
        });
        if (!res.ok) throw new Error(String(res.status));
        buf = await res.arrayBuffer();
      }
      const blob = new Blob([buf]);
      beatmapCoverObjectUrl = URL.createObjectURL(blob);
      return beatmapCoverObjectUrl;
    } catch (_) {
      return "";
    }
  }

  /**
   * @param {object} options
   * @param {typeof OsuExpertPlus.dom.el} options.el
   * @param {typeof OsuExpertPlus.dom.manageStyle} options.manageStyle
   * @param {RegExp} options.pathRe
   * @param {() => string|null} options.getBeatmapId
   * @param {() => string} options.getRuleset
   * @param {() => object|null} options.readBeatmapsetJson
   * @param {string} options.styleId
   * @returns {{ dispose: () => void }}
   */
  function mountBeatmapsetInfoPreview({
    el,
    manageStyle,
    pathRe,
    getBeatmapId,
    getRuleset,
    readBeatmapsetJson,
    styleId,
  }) {
    const wrapClass = "oep-beatmap-preview";
    const styles = manageStyle(
      styleId,
      `
      .${wrapClass} { margin-top: 4px; }
      .${wrapClass}__toggle.btn-osu-big {
        --btn-bg: hsl(var(--hsl-b5, 333 18% 28%));
        margin-top: 6px;
      }
      .${wrapClass}__panel {
        margin-top: 10px;
        border-radius: 6px;
        overflow: hidden;
        background: hsl(var(--hsl-b5, 333 18% 8%));
        border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
      }
      .${wrapClass}__canvas-host {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 180px;
        background: #000;
        cursor: pointer;
        outline: none;
      }
      .${wrapClass}__canvas-host:focus-visible {
        box-shadow: inset 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__canvas-host--disabled {
        cursor: not-allowed;
        opacity: 0.85;
      }
      .${wrapClass}__panel:not(.${wrapClass}__panel--unsupported) .${wrapClass}__unsupported {
        display: none;
      }
      .${wrapClass}__panel.${wrapClass}__panel--unsupported .${wrapClass}__canvas-host,
      .${wrapClass}__panel.${wrapClass}__panel--unsupported .${wrapClass}__seek {
        display: none;
      }
      .${wrapClass}__unsupported {
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 16 / 9;
        min-height: 180px;
        padding: 16px;
        text-align: center;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        font-size: 13px;
        line-height: 1.45;
        box-sizing: border-box;
      }
      .${wrapClass}__engine-slot {
        position: absolute;
        inset: 0;
        z-index: 1;
      }
      .${wrapClass}__engine-slot canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none;
      }
      .${wrapClass}__transport-overlay {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.4s ease;
        background: rgba(0, 0, 0, 0.12);
      }
      .${wrapClass}__transport-overlay--visible {
        opacity: 1;
      }
      .${wrapClass}__transport-glyph {
        font-size: clamp(3rem, 14vw, 5.5rem);
        color: hsl(var(--hsl-l1, 0 0% 98%));
        filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.65));
        line-height: 1;
      }
      .${wrapClass}__transport-glyph .fa-fw {
        width: 1.15em;
        text-align: center;
      }
      .${wrapClass}__seek {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 10px;
        background: hsl(var(--hsl-b4, 333 18% 14%));
        border-top: 1px solid hsl(var(--hsl-b5, 333 18% 10%));
        font-size: 12px;
        color: hsl(var(--hsl-l2, 0 0% 75%));
      }
      .${wrapClass}__seek button {
        flex: 0 0 auto;
        padding: 4px 10px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font: inherit;
        background: hsl(var(--hsl-b5, 333 18% 28%));
        color: hsl(var(--hsl-l1, 0 0% 92%));
      }
      .${wrapClass}__seek button:hover:not(:disabled) {
        filter: brightness(1.08);
      }
      .${wrapClass}__seek button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__status {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 100%;
        text-align: right;
      }
      .${wrapClass}__seek-time {
        flex: 0 0 auto;
        flex-shrink: 0;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        white-space: nowrap;
      }
      .${wrapClass}__seek-range {
        flex: 1 1 0;
        min-width: 72px;
        width: 0;
        height: 22px;
        accent-color: hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__seek-range:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__volume {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 0 0 auto;
      }
      .${wrapClass}__volume-icon {
        color: hsl(var(--hsl-l2, 0 0% 75%));
        font-size: 12px;
        line-height: 1;
        opacity: 0.9;
      }
      .${wrapClass}__volume-range {
        width: 72px;
        min-width: 56px;
        max-width: 100px;
        height: 22px;
        flex: 0 0 72px;
        accent-color: hsl(var(--hsl-c2, 333 60% 70%));
      }
      .${wrapClass}__volume-range:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__offset-input {
        width: 4.25em;
        min-width: 3.25em;
        max-width: 6em;
        padding: 3px 6px;
        border-radius: 4px;
        border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
        background: hsl(var(--hsl-b5, 333 18% 12%));
        color: hsl(var(--hsl-l1, 0 0% 92%));
        font: inherit;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        box-sizing: border-box;
      }
      .${wrapClass}__offset-input:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .${wrapClass}__offset-input:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
        border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
      }
      .${wrapClass}__offset-unit {
        flex: 0 0 auto;
        font-size: 11px;
        color: hsl(var(--hsl-l2, 0 0% 75%));
        user-select: none;
      }
      .oep-beatmap-preview-section {
        box-sizing: border-box;
        width: 100%;
        padding: 10px 20px 12px;
      }
      @media (min-width: 900px) {
        .oep-beatmap-preview-section {
          padding: 12px 40px 16px;
        }
      }
      .oep-beatmap-preview-section > .beatmapset-info__row {
        display: flex;
        flex-direction: column;
        padding-bottom: 0;
        min-width: 0;
      }
    `,
    );
    styles.inject();

    const row = el("div", {
      class: "beatmapset-info__row",
      "data-oep-beatmap-preview-root": "",
    });
    const heading = el(
      "h3",
      { class: "beatmapset-info__header" },
      "Gameplay preview",
    );

    let expanded = false;
    let busy = false;
    let lastLoadedKey = "";
    let seekRafId = 0;
    let seekPointerActive = false;
    /** `ruleset:beatmapId` while preview is expanded; used to detect difficulty / mode changes (SPA). */
    let previewContextKey = "";
    let contextPollId = 0;

    function previewContextKeyFromPage() {
      if (!pathRe.test(location.pathname)) return "";
      const rs = (getRuleset() || "osu").toLowerCase();
      const id = getBeatmapId();
      return `${rs}:${id || ""}`;
    }

    function stopContextPoll() {
      if (contextPollId) {
        window.clearInterval(contextPollId);
        contextPollId = 0;
      }
    }

    function startContextPoll() {
      stopContextPoll();
      contextPollId = window.setInterval(() => {
        if (!pathRe.test(location.pathname) || !expanded || busy) return;
        const k = previewContextKeyFromPage();
        if (previewContextKey && k !== previewContextKey) {
          collapsePreviewAndResetEngine();
        }
      }, 200);
    }

    function collapsePreviewAndResetEngine() {
      if (!expanded) return;
      expanded = false;
      panel.hidden = true;
      panel.classList.remove(`${wrapClass}__panel--unsupported`);
      const top = toggleBtn.querySelector(".btn-osu-big__text-top");
      if (top) {
        top.textContent = "Beatmap Preview";
      }
      stopContextPoll();
      previewContextKey = "";
      stopSeekAnimationLoop();
      lastLoadedKey = "";
      busy = false;
      setPreviewControlsEnabled(false);
      setStatus("");
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
      destroySharedEngineHard();
      acquireMutex = Promise.resolve();
      revokeBeatmapCoverObjectUrl();
    }

    function onPossiblePreviewContextChange() {
      if (!pathRe.test(location.pathname) || !expanded || busy) return;
      const k = previewContextKeyFromPage();
      if (previewContextKey && k !== previewContextKey) {
        collapsePreviewAndResetEngine();
      }
    }

    /** Site preview files are short; cap so we never treat a longer buffer as full-map audio. */
    const PREVIEW_CLIP_MAX_MS = 10000;
    const PREVIEW_MUSIC_LS_KEY = "oep.beatmapPreview.musicVolume";
    const PREVIEW_HITSOUND_LS_KEY = "oep.beatmapPreview.hitsoundVolume";
    /** Tampermonkey keys from before localStorage migration; read once to seed LS. */
    const PREVIEW_MUSIC_VOLUME_LEGACY_GM_KEY = "beatmapPreview.musicVolume";
    const PREVIEW_HITSVOL_LEGACY_GM_KEY = "beatmapPreview.hitsoundVolume";
    const PREVIEW_VOLUME_DEFAULT = 0.3;
    const PREVIEW_OFFSET_LS_KEY = "oep.beatmapPreview.audioOffsetMs";
    const OFFSET_MIN = -500;
    const OFFSET_MAX = 500;
    /** Added to the displayed offset when calling the renderer (0 ms shown → 85 ms actual). */
    const PREVIEW_OFFSET_DISPLAY_BASE_MS = 85;

    function clampOffsetMs(n) {
      if (!Number.isFinite(n)) return 0;
      return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(n)));
    }

    function actualAudioOffsetMsFromDisplay(displayMs) {
      return clampOffsetMs(displayMs) + PREVIEW_OFFSET_DISPLAY_BASE_MS;
    }

    /** @param {unknown} raw */
    function parseOffsetTextStrict(raw) {
      const s = String(raw ?? "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/ms$/i, "");
      if (s === "" || s === "-" || s === "+") return null;
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      return clampOffsetMs(n);
    }

    function formatOffsetForField(ms) {
      return String(clampOffsetMs(ms));
    }

    function readStoredOffsetMs() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_OFFSET_LS_KEY);
          if (s != null && s !== "") {
            return clampOffsetMs(Number(s));
          }
        } catch (_) {
          void 0;
        }
      }
      return 0;
    }

    function writeStoredOffsetMs(ms) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_OFFSET_LS_KEY, String(clampOffsetMs(ms)));
      } catch (_) {
        void 0;
      }
    }

    function readStoredMusicVolume() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_MUSIC_LS_KEY);
          if (s != null && s !== "") {
            const n = Number(s);
            if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
          }
        } catch (_) {
          void 0;
        }
      }
      try {
        const v = GM_getValue(PREVIEW_MUSIC_VOLUME_LEGACY_GM_KEY, undefined);
        if (v !== undefined && v !== null && String(v) !== "") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n <= 1) {
            writeStoredMusicVolume(n);
            return n;
          }
        }
      } catch (_) {
        void 0;
      }
      const site = readOsuSiteAudioVolume();
      if (site != null) return site;
      return PREVIEW_VOLUME_DEFAULT;
    }

    function writeStoredMusicVolume(vol) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_MUSIC_LS_KEY, String(vol));
      } catch (_) {
        void 0;
      }
    }

    function readStoredHitsoundVolume() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const s = ls.getItem(PREVIEW_HITSOUND_LS_KEY);
          if (s != null && s !== "") {
            const n = Number(s);
            if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
          }
        } catch (_) {
          void 0;
        }
      }
      try {
        const v = GM_getValue(PREVIEW_HITSVOL_LEGACY_GM_KEY, undefined);
        if (v !== undefined && v !== null && String(v) !== "") {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0 && n <= 1) {
            writeStoredHitsoundVolume(n);
            return n;
          }
        }
      } catch (_) {
        void 0;
      }
      const site = readOsuSiteAudioVolume();
      if (site != null) return site;
      return PREVIEW_VOLUME_DEFAULT;
    }

    function writeStoredHitsoundVolume(vol) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(PREVIEW_HITSOUND_LS_KEY, String(vol));
      } catch (_) {
        void 0;
      }
    }

    const statusEl = el("span", { class: `${wrapClass}__status` }, "");

    const unsupportedWrap = el(
      "div",
      { class: `${wrapClass}__unsupported` },
      "This gamemode is not supported yet.",
    );

    const canvasHost = el("div", {
      class: `${wrapClass}__canvas-host ${wrapClass}__canvas-host--disabled`,
      tabIndex: -1,
      role: "button",
      "aria-label": "Play gameplay preview",
    });
    const engineSlot = el("div", { class: `${wrapClass}__engine-slot` });
    const transportOverlay = el("div", {
      class: `${wrapClass}__transport-overlay`,
      "aria-hidden": "true",
    });
    const transportPlayGlyph = el(
      "span",
      { class: `${wrapClass}__transport-glyph`, hidden: "" },
      el(
        "span",
        { class: "fa fa-fw" },
        el("span", { class: "fas fa-play", "aria-hidden": "true" }),
      ),
    );
    const transportPauseGlyph = el(
      "span",
      { class: `${wrapClass}__transport-glyph`, hidden: "" },
      el(
        "span",
        { class: "fa fa-fw" },
        el("span", { class: "fas fa-pause", "aria-hidden": "true" }),
      ),
    );
    transportOverlay.appendChild(transportPlayGlyph);
    transportOverlay.appendChild(transportPauseGlyph);
    canvasHost.appendChild(engineSlot);
    canvasHost.appendChild(transportOverlay);

    /** @type {number} */
    let transportFlashTimer = 0;
    const TRANSPORT_FLASH_HOLD_MS = 520;

    function clearTransportFlashTimer() {
      if (transportFlashTimer) {
        window.clearTimeout(transportFlashTimer);
        transportFlashTimer = 0;
      }
    }

    /** @param {boolean} isPlaying After toggle: true = playing (show pause glyph). */
    function flashTransportOverlay(isPlaying) {
      clearTransportFlashTimer();
      transportPlayGlyph.hidden = isPlaying;
      transportPauseGlyph.hidden = !isPlaying;
      transportOverlay.classList.add(
        `${wrapClass}__transport-overlay--visible`,
      );
      transportFlashTimer = window.setTimeout(() => {
        transportOverlay.classList.remove(
          `${wrapClass}__transport-overlay--visible`,
        );
        transportFlashTimer = 0;
      }, TRANSPORT_FLASH_HOLD_MS);
    }

    const previewTimeBtn = el(
      "button",
      {
        type: "button",
        disabled: true,
        title: "Jump to the beatmap preview point (.osu PreviewTime)",
        "aria-label": "Jump to beatmap preview time",
      },
      "Jump to preview",
    );

    const seekTimeDisplay = el(
      "span",
      {
        class: `${wrapClass}__seek-time`,
        "aria-live": "off",
        title: "Current time / map duration",
      },
      "0:00 / 0:00",
    );
    const seekRange = el("input", {
      type: "range",
      class: `${wrapClass}__seek-range`,
      min: "0",
      max: "1",
      value: "0",
      step: "1",
      disabled: true,
      "aria-label": "Preview playback position",
    });
    const musicVolumeRange = el("input", {
      type: "range",
      class: `${wrapClass}__volume-range`,
      min: "0",
      max: "100",
      value: String(Math.round(readStoredMusicVolume() * 100)),
      step: "1",
      disabled: true,
      "aria-label": "Gameplay preview music volume",
    });
    const musicVolumeWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "music volume",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-music", "aria-hidden": "true" }),
        ),
      ),
      musicVolumeRange,
    );
    const hitsoundVolumeRange = el("input", {
      type: "range",
      class: `${wrapClass}__volume-range`,
      min: "0",
      max: "100",
      value: String(Math.round(readStoredHitsoundVolume() * 100)),
      step: "1",
      disabled: true,
      "aria-label": "Gameplay preview hitsounds volume",
    });
    const hitsoundVolumeWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "hitsound volume",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-drum", "aria-hidden": "true" }),
        ),
      ),
      hitsoundVolumeRange,
    );

    let offsetInputCommittedMs = readStoredOffsetMs();
    const offsetInput = el("input", {
      type: "text",
      class: `${wrapClass}__offset-input`,
      value: formatOffsetForField(offsetInputCommittedMs),
      inputMode: "numeric",
      disabled: true,
      "aria-label": "Gameplay preview audio offset in milliseconds",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
    });
    const offsetUnitEl = el(
      "span",
      { class: `${wrapClass}__offset-unit` },
      "ms",
    );

    function previewOffsetMsFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p !== null) return p;
      return offsetInputCommittedMs;
    }

    function commitOffsetFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p === null) {
        offsetInput.value = formatOffsetForField(offsetInputCommittedMs);
      } else {
        offsetInputCommittedMs = p;
        offsetInput.value = formatOffsetForField(p);
        writeStoredOffsetMs(offsetInputCommittedMs);
      }
      applyPreviewOffsetToEngine();
      if (sharedEngine && lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    }

    const offsetWrap = el(
      "div",
      { class: `${wrapClass}__volume` },
      el(
        "span",
        {
          class: `${wrapClass}__volume-icon`,
          "aria-hidden": "true",
          title: "offset",
        },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-clock", "aria-hidden": "true" }),
        ),
      ),
      offsetInput,
      offsetUnitEl,
    );

    const seekRow = el(
      "div",
      { class: `${wrapClass}__seek` },
      previewTimeBtn,
      seekTimeDisplay,
      seekRange,
      musicVolumeWrap,
      hitsoundVolumeWrap,
      offsetWrap,
      statusEl,
    );

    const panel = el(
      "div",
      { class: `${wrapClass}__panel`, hidden: "" },
      unsupportedWrap,
      canvasHost,
      seekRow,
    );

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: `btn-osu-big btn-osu-big--beatmapset ${wrapClass}__toggle`,
      },
      el(
        "span",
        { class: "btn-osu-big__content" },
        el(
          "span",
          { class: "btn-osu-big__left" },
          el("span", { class: "btn-osu-big__text-top" }, "Beatmap Preview"),
        ),
        el(
          "span",
          { class: "btn-osu-big__icon" },
          el(
            "span",
            { class: "fa fa-fw" },
            el("span", { class: "fas fa-play-circle", "aria-hidden": "true" }),
          ),
        ),
      ),
    );

    row.appendChild(heading);
    row.appendChild(toggleBtn);
    row.appendChild(panel);

    function setStatus(text) {
      statusEl.textContent = text || "";
    }

    /**
     * @param {any} eng
     * @returns {number}
     */
    function getPreviewClipDurationMs(eng) {
      const a = eng?.previewAudio;
      if (
        a &&
        Number.isFinite(a.duration) &&
        a.duration > 0 &&
        a.readyState >= 1
      ) {
        return Math.min(PREVIEW_CLIP_MAX_MS, a.duration * 1000);
      }
      return PREVIEW_CLIP_MAX_MS;
    }

    /**
     * Whether `beatmapMs` maps into the loaded preview MP3 (osu! ~10s clip at PreviewTime).
     * @param {any} eng
     * @param {number} beatmapMs
     */
    function beatmapTimeOverlapsPreviewClip(eng, beatmapMs) {
      if (
        !eng?.getPreviewAudioTimeMsForBeatmapTime ||
        !Number.isFinite(beatmapMs)
      ) {
        return false;
      }
      const shifted = eng.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
      if (!Number.isFinite(shifted)) return false;
      const dur = getPreviewClipDurationMs(eng);
      return shifted >= 0 && shifted < dur;
    }

    /**
     * Play preview MP3 only inside the clip window; pause it elsewhere so transport stays on the
     * perf clock (silent map continuation). See BeatmapEngine.getTransportCurrentTimeMs.
     * @param {any} eng
     */
    function syncPreviewMusicToWindow(eng) {
      if (!eng?.previewAudio) return;
      const vol =
        Number.isFinite(eng.musicVolume) && eng.musicVolume >= 0
          ? eng.musicVolume
          : 0.3;
      let t;
      try {
        t = eng.getCurrentTime?.();
      } catch (_) {
        return;
      }
      if (!Number.isFinite(t)) return;

      const inside = beatmapTimeOverlapsPreviewClip(eng, t);

      if (!eng.isPlaying) {
        eng.previewAudio.volume = inside ? vol : 0;
        return;
      }

      if (inside) {
        eng.previewAudio.volume = vol;
        let shiftedSec;
        try {
          shiftedSec =
            Math.max(0, eng.getPreviewAudioTimeMsForBeatmapTime(t)) / 1000;
        } catch (_) {
          return;
        }
        const durSec = getPreviewClipDurationMs(eng) / 1000;
        const target = Math.min(shiftedSec, Math.max(0, durSec - 0.001));
        if (Math.abs(eng.previewAudio.currentTime - target) > 0.12) {
          eng.previewAudio.currentTime = target;
        }
        if (eng.previewAudio.paused && !eng.previewAudio.ended) {
          eng.previewAudio.play().catch(() => {});
        }
      } else {
        eng.previewAudio.volume = 0;
        eng.previewAudio.pause();
      }
    }

    function formatPreviewTimeMs(ms) {
      if (!Number.isFinite(ms) || ms < 0) return "0:00";
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      if (m >= 60) {
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return `${h}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
      return `${m}:${String(s).padStart(2, "0")}`;
    }

    function paintSeekTimeLabels(currentMs, durationMs) {
      seekTimeDisplay.textContent = `${formatPreviewTimeMs(currentMs)} / ${formatPreviewTimeMs(durationMs)}`;
    }

    function stopSeekAnimationLoop() {
      if (seekRafId) {
        cancelAnimationFrame(seekRafId);
        seekRafId = 0;
      }
    }

    function syncSeekUiFromEngine() {
      if (!sharedEngine || !lastLoadedKey || seekPointerActive) return;
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const maxMs = Math.max(1, Number.isFinite(duration) ? duration : 0);
        const t = sharedEngine.getCurrentTime?.() ?? 0;
        seekRange.max = String(maxMs);
        seekRange.value = String(
          Math.min(maxMs, Math.max(0, Number.isFinite(t) ? t : 0)),
        );
        paintSeekTimeLabels(t, duration);
      } catch (_) {
        void 0;
      }
    }

    function startSeekAnimationLoop() {
      stopSeekAnimationLoop();
      const tick = () => {
        if (!expanded) return;
        syncSeekUiFromEngine();
        if (sharedEngine && lastLoadedKey) {
          syncPreviewMusicToWindow(sharedEngine);
        }
        seekRafId = requestAnimationFrame(tick);
      };
      seekRafId = requestAnimationFrame(tick);
    }

    function applySeekFromInput() {
      if (!sharedEngine || seekRange.disabled) return;
      const ms = Number(seekRange.value);
      if (!Number.isFinite(ms)) return;
      try {
        sharedEngine.setCurrentTime?.(ms);
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
        void 0;
      }
    }

    /** @param {number} deltaMs */
    function seekByDeltaMs(deltaMs) {
      if (!sharedEngine || seekRange.disabled || !lastLoadedKey) return;
      let t = 0;
      let duration = 0;
      try {
        t = sharedEngine.getCurrentTime?.() ?? 0;
        duration = sharedEngine.getDuration?.() ?? 0;
      } catch (_) {
        return;
      }
      const maxMs = Math.max(0, Number.isFinite(duration) ? duration : 0);
      if (maxMs <= 0) return;
      const next = Math.min(
        maxMs,
        Math.max(0, (Number.isFinite(t) ? t : 0) + deltaMs),
      );
      try {
        sharedEngine.setCurrentTime?.(next);
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
        void 0;
      }
    }

    /**
     * Space: play/pause. ArrowLeft/ArrowRight: ±1s seek.
     * Volume sliders keep native arrow behavior; Jump to preview keeps Space on the button.
     * @param {KeyboardEvent} ev
     */
    function onPreviewPanelKeydown(ev) {
      if (
        !expanded ||
        panel.hidden ||
        !lastLoadedKey ||
        seekRange.disabled ||
        busy
      ) {
        return;
      }
      const t = ev.target;
      if (!(t instanceof Node) || !panel.contains(t)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

      const key = ev.key;
      const isArrow = key === "ArrowLeft" || key === "ArrowRight";
      const isPlayKey = key === " " || key === "Enter" || key === "Spacebar";

      if (isArrow) {
        if (
          t === musicVolumeRange ||
          t === hitsoundVolumeRange ||
          t === offsetInput
        ) {
          return;
        }
        ev.preventDefault();
        seekByDeltaMs(key === "ArrowLeft" ? -1000 : 1000);
        return;
      }

      if (isPlayKey) {
        if (t instanceof HTMLButtonElement && t !== canvasHost) return;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
          return;
        }
        ev.preventDefault();
        togglePlaybackFromCanvas();
      }
    }

    /** Seek transport to the .osu PreviewTime (site preview MP3 aligns from there). */
    function jumpToBeatmapPreviewTime() {
      if (!sharedEngine || seekRange.disabled) return;
      try {
        if (typeof sharedEngine.seekToPreview === "function") {
          sharedEngine.seekToPreview();
        } else {
          const ptm = Number(sharedEngine.previewTimeMs);
          sharedEngine.setCurrentTime?.(
            Number.isFinite(ptm) ? Math.max(0, ptm) : 0,
          );
        }
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
        void 0;
      }
    }

    function previewMusicVolumeFromSlider() {
      const v = Number(musicVolumeRange.value) / 100;
      if (!Number.isFinite(v)) return 0.3;
      return Math.min(1, Math.max(0, v));
    }

    function previewHitsoundVolumeFromSlider() {
      const v = Number(hitsoundVolumeRange.value) / 100;
      if (!Number.isFinite(v)) return 0.3;
      return Math.min(1, Math.max(0, v));
    }

    function applyPreviewMusicVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = previewMusicVolumeFromSlider();
      try {
        if (typeof sharedEngine.setMusicVolume === "function") {
          sharedEngine.setMusicVolume(vol);
        } else {
          sharedEngine.musicVolume = vol;
        }
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewHitsoundVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = previewHitsoundVolumeFromSlider();
      try {
        if (typeof sharedEngine.setHitsoundVolume === "function") {
          sharedEngine.setHitsoundVolume(vol);
        } else {
          sharedEngine.hitsoundVolume = vol;
          sharedEngine.hitsoundPlayer?.setVolume?.(vol);
        }
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewOffsetToEngine() {
      if (!sharedEngine || typeof sharedEngine.setAudioOffsetMs !== "function") {
        return;
      }
      try {
        sharedEngine.setAudioOffsetMs(
          actualAudioOffsetMsFromDisplay(previewOffsetMsFromInput()),
        );
      } catch (_) {
        void 0;
      }
    }

    function applyPreviewVolumesToEngine() {
      applyPreviewMusicVolumeToEngine();
      applyPreviewHitsoundVolumeToEngine();
      applyPreviewOffsetToEngine();
    }

    function setSeekUiEnabled(on) {
      seekRange.disabled = !on;
      musicVolumeRange.disabled = !on;
      hitsoundVolumeRange.disabled = !on;
      offsetInput.disabled = !on;
      if (!on) {
        seekRange.max = "1";
        seekRange.value = "0";
        paintSeekTimeLabels(0, 0);
      }
    }

    function updateCanvasPlayStateAria() {
      if (!sharedEngine || !lastLoadedKey || seekRange.disabled) return;
      try {
        const playing = !!sharedEngine.isPlaying;
        canvasHost.setAttribute(
          "aria-label",
          playing ? "Pause gameplay preview" : "Play gameplay preview",
        );
        canvasHost.setAttribute("aria-pressed", playing ? "true" : "false");
      } catch (_) {
        void 0;
      }
    }

    function setPreviewControlsEnabled(on) {
      setSeekUiEnabled(on);
      previewTimeBtn.disabled = !on;
      canvasHost.classList.toggle(`${wrapClass}__canvas-host--disabled`, !on);
      canvasHost.tabIndex = on ? 0 : -1;
      if (!on) {
        canvasHost.setAttribute("aria-label", "Play gameplay preview");
        canvasHost.removeAttribute("aria-pressed");
      } else {
        updateCanvasPlayStateAria();
      }
    }

    function togglePlaybackFromCanvas() {
      if (
        !sharedEngine ||
        !lastLoadedKey ||
        seekRange.disabled ||
        busy ||
        canvasHost.classList.contains(`${wrapClass}__canvas-host--disabled`)
      ) {
        return;
      }
      try {
        if (sharedEngine.isPlaying) {
          sharedEngine.pause?.();
        } else {
          sharedEngine.play?.({
            enableAudio: true,
            enableHitsounds: true,
          });
          syncPreviewMusicToWindow(sharedEngine);
        }
        updateCanvasPlayStateAria();
        flashTransportOverlay(!!sharedEngine.isPlaying);
      } catch (_) {
        void 0;
      }
    }

    function invalidateLoadState() {
      lastLoadedKey = "";
      setPreviewControlsEnabled(false);
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
    }

    async function ensureEngine() {
      return acquireSharedEngine(engineSlot);
    }

    function currentLoadKey() {
      const id = getBeatmapId();
      return id ? `${id}` : "";
    }

    async function loadCurrentBeatmap() {
      if (!pathRe.test(location.pathname)) return;
      if (!expanded) return;

      const ruleset = (getRuleset() || "osu").toLowerCase();
      if (ruleset !== "osu") {
        panel.classList.add(`${wrapClass}__panel--unsupported`);
        lastLoadedKey = "";
        setPreviewControlsEnabled(false);
        setStatus("");
        try {
          sharedEngine?.pause?.();
        } catch (_) {
          void 0;
        }
        destroySharedEngineHard();
        acquireMutex = Promise.resolve();
        revokeBeatmapCoverObjectUrl();
        busy = false;
        return;
      }

      panel.classList.remove(`${wrapClass}__panel--unsupported`);

      const beatmapId = getBeatmapId();
      if (!beatmapId) {
        setStatus("No difficulty selected.");
        invalidateLoadState();
        return;
      }

      const data = readBeatmapsetJson();
      const previewAudio = absoluteUrl(data?.preview_url);
      const bg =
        data?.id != null
          ? `https://assets.ppy.sh/beatmaps/${data.id}/covers/fullsize.jpg`
          : "";

      const key = currentLoadKey();
      if (sharedEngine && lastLoadedKey === key) {
        if (!expanded) return;
        placeSharedEngineRoot(engineSlot);
        setStatus("");
        setPreviewControlsEnabled(true);
        applyPreviewVolumesToEngine();
        syncSeekUiFromEngine();
        updateCanvasPlayStateAria();
        return;
      }

      busy = true;
      setStatus("Loading…");
      setPreviewControlsEnabled(false);

      try {
        const osuText = await fetchOsuFileText(beatmapId);
        if (!expanded || !pathRe.test(location.pathname)) return;
        const eng = await ensureEngine();
        eng.pause();
        const bgAbs = absoluteUrl(bg);
        const bgObjectUrl = bgAbs
          ? await fetchBeatmapCoverObjectUrl(bgAbs)
          : "";
        await eng.loadBeatmap({
          osuText,
          audioUrl: previewAudio || undefined,
          backgroundUrl: bgObjectUrl || undefined,
        });
        if (!expanded || !pathRe.test(location.pathname)) {
          invalidateLoadState();
          return;
        }
        lastLoadedKey = key;
        setStatus("");
        setPreviewControlsEnabled(true);
        applyPreviewVolumesToEngine();
        syncSeekUiFromEngine();
        updateCanvasPlayStateAria();
      } catch (e) {
        setStatus(
          e instanceof Error ? e.message : "Could not load this difficulty.",
        );
        invalidateLoadState();
      } finally {
        busy = false;
      }
    }

    seekRange.addEventListener("pointerdown", (ev) => {
      seekPointerActive = true;
      try {
        seekRange.setPointerCapture(ev.pointerId);
      } catch (_) {
        void 0;
      }
    });
    seekRange.addEventListener("pointerup", (ev) => {
      seekPointerActive = false;
      try {
        seekRange.releasePointerCapture(ev.pointerId);
      } catch (_) {
        void 0;
      }
      applySeekFromInput();
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("pointercancel", () => {
      seekPointerActive = false;
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("input", () => {
      applySeekFromInput();
      if (!sharedEngine || !lastLoadedKey || seekRange.disabled) return;
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const ms = Number(seekRange.value);
        if (Number.isFinite(ms) && Number.isFinite(duration)) {
          paintSeekTimeLabels(ms, duration);
        }
      } catch (_) {
        void 0;
      }
    });
    seekRange.addEventListener("change", () => {
      applySeekFromInput();
      syncSeekUiFromEngine();
    });

    musicVolumeRange.addEventListener("input", () => {
      applyPreviewMusicVolumeToEngine();
    });
    musicVolumeRange.addEventListener("change", () => {
      writeStoredMusicVolume(previewMusicVolumeFromSlider());
    });
    hitsoundVolumeRange.addEventListener("input", () => {
      applyPreviewHitsoundVolumeToEngine();
    });
    hitsoundVolumeRange.addEventListener("change", () => {
      writeStoredHitsoundVolume(previewHitsoundVolumeFromSlider());
    });
    offsetInput.addEventListener("input", () => {
      applyPreviewOffsetToEngine();
      if (sharedEngine && lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    });
    offsetInput.addEventListener("blur", () => {
      commitOffsetFromInput();
    });
    offsetInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      commitOffsetFromInput();
    });

    canvasHost.addEventListener("click", (ev) => {
      // Only odd `detail` (1st, 3rd, …): double-click plays once; triple-click can play-pause-play.
      if ((ev.detail & 1) !== 1) return;
      togglePlaybackFromCanvas();
    });
    panel.addEventListener("keydown", onPreviewPanelKeydown);

    toggleBtn.addEventListener("click", async () => {
      expanded = !expanded;
      // `hidden` is boolean; `""`/`null` coerce to false and leave the panel visible.
      panel.hidden = !expanded;
      const top = toggleBtn.querySelector(".btn-osu-big__text-top");
      if (top) {
        top.textContent = expanded ? "Hide beatmap preview" : "Beatmap Preview";
      }
      if (expanded) {
        previewContextKey = previewContextKeyFromPage();
        startContextPoll();
        startSeekAnimationLoop();
        if (!busy) {
          await loadCurrentBeatmap();
        }
      } else {
        stopContextPoll();
        previewContextKey = "";
        panel.classList.remove(`${wrapClass}__panel--unsupported`);
        stopSeekAnimationLoop();
        try {
          sharedEngine?.pause?.();
        } catch (_) {
          void 0;
        }
      }
    });

    previewTimeBtn.addEventListener("click", () => {
      jumpToBeatmapPreviewTime();
    });

    window.addEventListener("hashchange", onPossiblePreviewContextChange, {
      passive: true,
    });
    window.addEventListener("popstate", onPossiblePreviewContextChange, {
      passive: true,
    });

    return {
      dispose: () => {
        stopContextPoll();
        window.removeEventListener("hashchange", onPossiblePreviewContextChange);
        window.removeEventListener("popstate", onPossiblePreviewContextChange);
        panel.removeEventListener("keydown", onPreviewPanelKeydown);
        stopSeekAnimationLoop();
        clearTransportFlashTimer();
        transportOverlay.classList.remove(
          `${wrapClass}__transport-overlay--visible`,
        );
        revokeBeatmapCoverObjectUrl();
        parkSharedEngineRoot();
        row.remove();
        styles.remove();
      },
      /** @returns {HTMLElement} */
      getRow: () => row,
    };
  }

  return {
    loadBeatmapEngineClass,
    fetchOsuFileText,
    mountBeatmapsetInfoPreview,
  };
})();
