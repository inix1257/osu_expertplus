/**
 * The gameplay preview widget on beatmapset pages (WS-51): a toggle button
 * that expands a panel showing the shared engine.
 *
 * - styles.js, dom.js: CSS and elements
 * - transport.js: play/pause, seeking, volumes and offset
 * - keyboard.js: the panel's keys
 * - load.js: loading the page's difficulty onto the shared engine
 */

import { revokeBeatmapCoverObjectUrl } from "../files.js";
import { observe } from "../../../core/observe.js";
import {
  formatOffsetForField,
  hitsoundVolumePref,
  musicVolumePref,
  readStoredOffsetMs,
} from "../prefs.js";
import { destroySharedEngineHard, sharedEngine } from "../shared-engine.js";
import { buildPreviewDom, setStatus, setToggleLabel } from "./dom.js";
import { createPreviewKeydown } from "./keyboard.js";
import { createBeatmapLoader } from "./load.js";
import { PREVIEW_CSS, WRAP_CLASS } from "./styles.js";
import { mountTransport } from "./transport.js";

/**
 * @param {object} options
 * @param {typeof OsuExpertPlus.dom.el} options.el
 * @param {typeof OsuExpertPlus.dom.manageStyle} options.manageStyle
 * @param {RegExp} options.pathRe
 * @param {() => string|null} options.getBeatmapId
 * @param {() => string} options.getRuleset
 * @param {() => object|null} options.readBeatmapsetJson
 * @param {string} options.styleId
 * @returns {{ dispose: () => void, getRow: () => HTMLElement }}
 */
export function mountBeatmapsetInfoPreview({
  el,
  manageStyle,
  pathRe,
  getBeatmapId,
  getRuleset,
  readBeatmapsetJson,
  styleId,
}) {
  const styles = manageStyle(styleId, PREVIEW_CSS);
  styles.inject();

  const state = {
    expanded: false,
    busy: false,
    /** The beatmap id loaded on the shared engine by this widget, or "". */
    lastLoadedKey: "",
    /** Set by dispose: this widget must not touch the shared engine any more. */
    disposed: false,
    /** Bumped by every load and by dispose; a load that sees a newer value stops (B30). */
    loadSeq: 0,
    seekRafId: 0,
    seekPointerActive: false,
    /** `ruleset:beatmapId` while preview is expanded; used to detect difficulty / mode changes (SPA). */
    previewContextKey: "",
    /** @type {AbortController|null} the picker watch while expanded */
    contextWatch: null,
    transportFlashTimer: 0,
    offsetInputCommittedMs: readStoredOffsetMs(),
  };

  const dom = buildPreviewDom(el, {
    musicVolume: musicVolumePref.read(),
    hitsoundVolume: hitsoundVolumePref.read(),
    offsetText: formatOffsetForField(state.offsetInputCommittedMs),
  });
  const { row, toggleBtn, panel } = dom;

  const transport = mountTransport(state, dom);
  const onPreviewPanelKeydown = createPreviewKeydown(state, dom, transport);
  const loadCurrentBeatmap = createBeatmapLoader({
    state,
    dom,
    transport,
    pathRe,
    getBeatmapId,
    getRuleset,
    readBeatmapsetJson,
    // A difficulty switch while loading was ignored (busy): check now.
    onSettled: () => onPossiblePreviewContextChange(),
  });

  function previewContextKeyFromPage() {
    if (!pathRe.test(location.pathname)) return "";
    const rs = (getRuleset() || "osu").toLowerCase();
    const id = getBeatmapId();
    return `${rs}:${id || ""}`;
  }

  function stopContextWatch() {
    state.contextWatch?.abort();
    state.contextWatch = null;
  }

  /**
   * Collapse the preview when the page shows another difficulty or ruleset.
   * osu-web switches difficulties with `replaceState` (no hashchange) and
   * marks the active picker item, so watch the picker (it replaces a 200 ms
   * poll); hashchange and popstate are handled below.
   */
  function startContextWatch() {
    stopContextWatch();
    state.contextWatch = new AbortController();
    observe.subscribe(
      {
        selector:
          ".beatmapset-beatmap-picker, .beatmapset-beatmap-picker__beatmap",
        attributes: ["class"],
        schedule: "sync",
        signal: state.contextWatch.signal,
        label: "beatmap-preview/context",
      },
      onPossiblePreviewContextChange,
    );
  }

  function collapsePreviewAndResetEngine() {
    if (!state.expanded) return;
    state.expanded = false;
    panel.hidden = true;
    panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);
    setToggleLabel(dom, false);
    stopContextWatch();
    state.previewContextKey = "";
    transport.stopSeekAnimationLoop();
    state.lastLoadedKey = "";
    state.busy = false;
    transport.setPreviewControlsEnabled(false);
    setStatus(dom, "");
    try {
      sharedEngine?.pause?.();
    } catch (_) {
      void 0;
    }
    destroySharedEngineHard();
    revokeBeatmapCoverObjectUrl();
  }

  function onPossiblePreviewContextChange() {
    if (!pathRe.test(location.pathname) || !state.expanded || state.busy) {
      return;
    }
    const k = previewContextKeyFromPage();
    if (state.previewContextKey && k !== state.previewContextKey) {
      collapsePreviewAndResetEngine();
    }
  }

  panel.addEventListener("keydown", onPreviewPanelKeydown);

  toggleBtn.addEventListener("click", async () => {
    state.expanded = !state.expanded;
    // `hidden` is boolean; `""`/`null` coerce to false and leave the panel visible.
    panel.hidden = !state.expanded;
    setToggleLabel(dom, state.expanded);
    if (state.expanded) {
      state.previewContextKey = previewContextKeyFromPage();
      startContextWatch();
      transport.startSeekAnimationLoop();
      if (!state.busy) {
        await loadCurrentBeatmap();
      }
    } else {
      stopContextWatch();
      state.previewContextKey = "";
      panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);
      transport.stopSeekAnimationLoop();
      try {
        sharedEngine?.pause?.();
      } catch (_) {
        void 0;
      }
    }
  });

  window.addEventListener("hashchange", onPossiblePreviewContextChange, {
    passive: true,
  });
  window.addEventListener("popstate", onPossiblePreviewContextChange, {
    passive: true,
  });

  return {
    dispose: () => {
      state.disposed = true;
      state.loadSeq += 1;
      stopContextWatch();
      window.removeEventListener("hashchange", onPossiblePreviewContextChange);
      window.removeEventListener("popstate", onPossiblePreviewContextChange);
      panel.removeEventListener("keydown", onPreviewPanelKeydown);
      transport.stopSeekAnimationLoop();
      transport.hideTransportOverlay();
      revokeBeatmapCoverObjectUrl();
      destroySharedEngineHard();
      row.remove();
      styles.remove();
    },
    /** @returns {HTMLElement} */
    getRow: () => row,
  };
}
