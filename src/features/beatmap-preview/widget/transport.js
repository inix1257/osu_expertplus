/**
 * Playback on the shared engine for the preview widget (WS-51): play/pause,
 * seeking and the seek bar, the preview MP3 window, volumes and offset.
 */

import { PREVIEW_CLIP_CAP_MS } from "../engine-patches.js";
import {
  PREVIEW_VOLUME_DEFAULT,
  actualAudioOffsetMsFromDisplay,
  formatOffsetForField,
  hitsoundVolumePref,
  musicVolumePref,
  parseOffsetTextStrict,
  writeStoredOffsetMs,
} from "../prefs.js";
import { sharedEngine } from "../shared-engine.js";
import { WRAP_CLASS } from "./styles.js";

const TRANSPORT_FLASH_HOLD_MS = 520;

/**
 * @param {any} eng
 * @returns {number}
 */
export function getPreviewClipDurationMs(eng) {
  const a = eng?.previewAudio;
  if (a && Number.isFinite(a.duration) && a.duration > 0 && a.readyState >= 1) {
    return Math.min(PREVIEW_CLIP_CAP_MS, a.duration * 1000);
  }
  return PREVIEW_CLIP_CAP_MS;
}

/**
 * Whether `beatmapMs` maps into the loaded preview MP3 (osu! ~10s clip at PreviewTime).
 * @param {any} eng
 * @param {number} beatmapMs
 */
export function beatmapTimeOverlapsPreviewClip(eng, beatmapMs) {
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
export function syncPreviewMusicToWindow(eng) {
  if (!eng?.previewAudio) return;
  const vol =
    Number.isFinite(eng.musicVolume) && eng.musicVolume >= 0
      ? eng.musicVolume
      : PREVIEW_VOLUME_DEFAULT;
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

/**
 * @param {number} ms
 * @returns {string}  `m:ss`, or `h:mm:ss` from an hour
 */
export function formatPreviewTimeMs(ms) {
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

/** @param {HTMLInputElement} range  a 0–100 volume slider */
function volumeFromSlider(range) {
  const v = Number(range.value) / 100;
  if (!Number.isFinite(v)) return PREVIEW_VOLUME_DEFAULT;
  return Math.min(1, Math.max(0, v));
}

/**
 * Wire the transport controls of one widget. Every action works on the
 * shared engine and does nothing until this widget has loaded a beatmap
 * (`state.lastLoadedKey`).
 * @param {object} state  the widget state (see widget/index.js)
 * @param {import("./dom.js").PreviewDom} dom
 */
export function mountTransport(state, dom) {
  const {
    canvasHost,
    transportOverlay,
    transportPlayGlyph,
    transportPauseGlyph,
    previewTimeBtn,
    seekTimeDisplay,
    seekRange,
    musicVolumeRange,
    hitsoundVolumeRange,
    offsetInput,
  } = dom;

  function clearTransportFlashTimer() {
    if (state.transportFlashTimer) {
      window.clearTimeout(state.transportFlashTimer);
      state.transportFlashTimer = 0;
    }
  }

  /** @param {boolean} isPlaying After toggle: true = playing (show pause glyph). */
  function flashTransportOverlay(isPlaying) {
    clearTransportFlashTimer();
    transportPlayGlyph.hidden = isPlaying;
    transportPauseGlyph.hidden = !isPlaying;
    transportOverlay.classList.add(`${WRAP_CLASS}__transport-overlay--visible`);
    state.transportFlashTimer = window.setTimeout(() => {
      transportOverlay.classList.remove(
        `${WRAP_CLASS}__transport-overlay--visible`,
      );
      state.transportFlashTimer = 0;
    }, TRANSPORT_FLASH_HOLD_MS);
  }

  function hideTransportOverlay() {
    clearTransportFlashTimer();
    transportOverlay.classList.remove(
      `${WRAP_CLASS}__transport-overlay--visible`,
    );
  }

  function previewOffsetMsFromInput() {
    const p = parseOffsetTextStrict(offsetInput.value);
    if (p !== null) return p;
    return state.offsetInputCommittedMs;
  }

  function commitOffsetFromInput() {
    const p = parseOffsetTextStrict(offsetInput.value);
    if (p === null) {
      offsetInput.value = formatOffsetForField(state.offsetInputCommittedMs);
    } else {
      state.offsetInputCommittedMs = p;
      offsetInput.value = formatOffsetForField(p);
      writeStoredOffsetMs(state.offsetInputCommittedMs);
    }
    applyPreviewOffsetToEngine();
    if (sharedEngine && state.lastLoadedKey) {
      syncPreviewMusicToWindow(sharedEngine);
    }
  }

  function paintSeekTimeLabels(currentMs, durationMs) {
    seekTimeDisplay.textContent = `${formatPreviewTimeMs(currentMs)} / ${formatPreviewTimeMs(durationMs)}`;
  }

  function stopSeekAnimationLoop() {
    if (state.seekRafId) {
      cancelAnimationFrame(state.seekRafId);
      state.seekRafId = 0;
    }
  }

  function syncSeekUiFromEngine() {
    if (!sharedEngine || !state.lastLoadedKey || state.seekPointerActive) {
      return;
    }
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

  /**
   * Follow playback on the seek bar, one frame at a time while playing; when
   * playback is not running it syncs once and stops (started again on play).
   */
  function startSeekAnimationLoop() {
    stopSeekAnimationLoop();
    const tick = () => {
      state.seekRafId = 0;
      if (!state.expanded) return;
      syncSeekUiFromEngine();
      if (sharedEngine && state.lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
      if (sharedEngine?.isPlaying)
        state.seekRafId = requestAnimationFrame(tick);
    };
    state.seekRafId = requestAnimationFrame(tick);
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
    if (!sharedEngine || seekRange.disabled || !state.lastLoadedKey) return;
    let t;
    let duration;
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

  function applyPreviewMusicVolumeToEngine() {
    if (!sharedEngine) return;
    const vol = volumeFromSlider(musicVolumeRange);
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
    const vol = volumeFromSlider(hitsoundVolumeRange);
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
    if (!sharedEngine || !state.lastLoadedKey || seekRange.disabled) return;
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
    canvasHost.classList.toggle(`${WRAP_CLASS}__canvas-host--disabled`, !on);
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
      !state.lastLoadedKey ||
      seekRange.disabled ||
      state.busy ||
      canvasHost.classList.contains(`${WRAP_CLASS}__canvas-host--disabled`)
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
        startSeekAnimationLoop();
      }
      updateCanvasPlayStateAria();
      flashTransportOverlay(!!sharedEngine.isPlaying);
    } catch (_) {
      void 0;
    }
  }

  /** The beatmap is on the engine: enable the controls and apply the prefs. */
  function onBeatmapReady() {
    setPreviewControlsEnabled(true);
    applyPreviewVolumesToEngine();
    syncSeekUiFromEngine();
    updateCanvasPlayStateAria();
  }

  seekRange.addEventListener("pointerdown", (ev) => {
    state.seekPointerActive = true;
    try {
      seekRange.setPointerCapture(ev.pointerId);
    } catch (_) {
      void 0;
    }
  });
  seekRange.addEventListener("pointerup", (ev) => {
    state.seekPointerActive = false;
    try {
      seekRange.releasePointerCapture(ev.pointerId);
    } catch (_) {
      void 0;
    }
    applySeekFromInput();
    syncSeekUiFromEngine();
  });
  seekRange.addEventListener("pointercancel", () => {
    state.seekPointerActive = false;
    syncSeekUiFromEngine();
  });
  seekRange.addEventListener("input", () => {
    applySeekFromInput();
    if (!sharedEngine || !state.lastLoadedKey || seekRange.disabled) return;
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
    musicVolumePref.write(volumeFromSlider(musicVolumeRange));
  });
  hitsoundVolumeRange.addEventListener("input", () => {
    applyPreviewHitsoundVolumeToEngine();
  });
  hitsoundVolumeRange.addEventListener("change", () => {
    hitsoundVolumePref.write(volumeFromSlider(hitsoundVolumeRange));
  });
  offsetInput.addEventListener("input", () => {
    applyPreviewOffsetToEngine();
    if (sharedEngine && state.lastLoadedKey) {
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
  previewTimeBtn.addEventListener("click", () => {
    jumpToBeatmapPreviewTime();
  });

  return {
    onBeatmapReady,
    setPreviewControlsEnabled,
    startSeekAnimationLoop,
    stopSeekAnimationLoop,
    seekByDeltaMs,
    togglePlaybackFromCanvas,
    hideTransportOverlay,
  };
}

/** @typedef {ReturnType<typeof mountTransport>} PreviewTransport */
