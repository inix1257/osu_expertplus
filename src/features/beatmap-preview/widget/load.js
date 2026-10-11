/**
 * Loading the page's difficulty onto the shared engine for the preview
 * widget (WS-51), with the B30 guards against stale loads.
 */

import {
  absoluteUrl,
  fetchBeatmapCoverObjectUrl,
  fetchOsuFileText,
  revokeBeatmapCoverObjectUrl,
} from "../files.js";
import {
  acquireSharedEngine,
  destroySharedEngineHard,
  placeSharedEngineRoot,
  runEngineLoad,
  setSharedEngineRendering,
  sharedEngine,
} from "../shared-engine.js";
import { setStatus } from "./dom.js";
import { WRAP_CLASS } from "./styles.js";

/**
 * @param {object} widget
 * @param {object} widget.state  the widget state (see widget/index.js)
 * @param {import("./dom.js").PreviewDom} widget.dom
 * @param {import("./transport.js").PreviewTransport} widget.transport
 * @param {RegExp} widget.pathRe
 * @param {() => string|null} widget.getBeatmapId
 * @param {() => string} widget.getRuleset
 * @param {() => object|null} widget.readBeatmapsetJson
 * @param {() => void} widget.onSettled  runs when the latest load ends
 *   (the page may have switched difficulty meanwhile)
 * @returns {() => Promise<void>}  loads the page's difficulty while expanded
 */
export function createBeatmapLoader({
  state,
  dom,
  transport,
  pathRe,
  getBeatmapId,
  getRuleset,
  readBeatmapsetJson,
  onSettled,
}) {
  const { panel, engineSlot } = dom;

  function invalidateLoadState() {
    state.lastLoadedKey = "";
    transport.setPreviewControlsEnabled(false);
    try {
      sharedEngine?.pause?.();
    } catch (_) {
      void 0;
    }
  }

  function currentLoadKey() {
    const id = getBeatmapId();
    return id ? `${id}` : "";
  }

  return async function loadCurrentBeatmap() {
    if (!pathRe.test(location.pathname)) return;
    if (!state.expanded) return;

    const ruleset = (getRuleset() || "osu").toLowerCase();
    if (ruleset !== "osu") {
      panel.classList.add(`${WRAP_CLASS}__panel--unsupported`);
      state.lastLoadedKey = "";
      transport.setPreviewControlsEnabled(false);
      setStatus(dom, "");
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
      destroySharedEngineHard();
      revokeBeatmapCoverObjectUrl();
      state.busy = false;
      return;
    }

    panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);

    const beatmapId = getBeatmapId();
    if (!beatmapId) {
      setStatus(dom, "No difficulty selected.");
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
    if (sharedEngine && state.lastLoadedKey === key) {
      if (!state.expanded) return;
      placeSharedEngineRoot(engineSlot);
      setStatus(dom, "");
      transport.onBeatmapReady();
      return;
    }

    state.busy = true;
    setStatus(dom, "Loading…");
    transport.setPreviewControlsEnabled(false);

    // B30: after every await, stop if the widget was disposed (the shared
    // engine may already belong to the next page) or a newer load started.
    const seq = ++state.loadSeq;
    const superseded = () => state.disposed || seq !== state.loadSeq;
    const offPage = () => !state.expanded || !pathRe.test(location.pathname);

    try {
      const osuText = await fetchOsuFileText(beatmapId);
      if (superseded() || offPage()) return;
      let loaded = false;
      await runEngineLoad(async () => {
        if (superseded() || offPage()) return;
        const eng = await acquireSharedEngine(engineSlot);
        if (superseded()) return;
        // A new engine starts its ticker; collapsed meanwhile (B87).
        if (!state.expanded) setSharedEngineRendering(false);
        eng.pause();
        const bgAbs = absoluteUrl(bg);
        const bgObjectUrl = bgAbs
          ? await fetchBeatmapCoverObjectUrl(bgAbs)
          : "";
        if (superseded()) return;
        await eng.loadBeatmap({
          osuText,
          audioUrl: previewAudio || undefined,
          backgroundUrl: bgObjectUrl || undefined,
        });
        loaded = true;
      });
      if (superseded()) return;
      if (!loaded || offPage()) {
        invalidateLoadState();
        return;
      }
      state.lastLoadedKey = key;
      setStatus(dom, "");
      transport.onBeatmapReady();
    } catch (e) {
      if (superseded()) return;
      setStatus(
        dom,
        e instanceof Error ? e.message : "Could not load this difficulty.",
      );
      invalidateLoadState();
    } finally {
      // A newer load in this widget keeps it busy.
      if (seq === state.loadSeq) {
        state.busy = false;
        if (!state.disposed) onSettled();
      }
    }
  };
}
