/**
 * Patches to osu-beatmap-renderer's BeatmapEngine prototype for the site's
 * ~10 s preview MP3 (WS-51).
 */
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
export function patchBeatmapEnginePreviewAudio(BeatmapEngine) {
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
