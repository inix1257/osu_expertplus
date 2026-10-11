/**
 * Patches to osu-beatmap-renderer's BeatmapEngine prototype for the site's
 * ~10 s preview MP3 and for the cover background (WS-51).
 *
 * They are tied to osu-beatmap-renderer@0.1.2: besides its public methods
 * they read or write these internals, which a new version may rename or
 * drop. Check them before bumping the version in loader.js.
 *   previewAudio, musicVolume, isPlaying, currentTime, transportStartMs,
 *   transportStartPerfTime, audioSyncOffsetMs, lastAudioSyncSamplePerfMs,
 *   hitsoundPlayer, backgroundSprite, getDisplayDimensions(),
 *   getPreviewAudioTimeMsForBeatmapTime(), getTransportCurrentTimeMs()
 * shared-engine.js also starts and stops `app.ticker` (B87).
 */
const BEATMAP_ENGINE_AUDIO_PATCH = "__oepBeatmapEngineNoPreviewAudioCors";
const BEATMAP_ENGINE_SEEK_PATCH = "__oepBeatmapEngineSeekBeforePreview";
const BEATMAP_ENGINE_PLAY_PATCH = "__oepBeatmapEnginePlayOutsidePreview";
const BEATMAP_ENGINE_TRANSPORT_PATCH = "__oepBeatmapEngineTransportPreview";
const BEATMAP_ENGINE_PAUSE_PATCH = "__oepBeatmapEnginePauseSnapshot";
const BEATMAP_ENGINE_BG_CONTAIN_PATCH = "__oepBeatmapEngineBgContain";
/** The site's preview MP3 is ~10 s; a longer buffer is never treated as the full song. */
export const PREVIEW_CLIP_CAP_MS = 10000;

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
      ? Math.min(PREVIEW_CLIP_CAP_MS, dur * 1000)
      : PREVIEW_CLIP_CAP_MS;
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

/**
 * Fit the cover inside the canvas (contain, centred) and dim it like the game
 * does, after every background load and resize. This patch used to live in
 * the loader's inline module source.
 * @param {any} BeatmapEngine
 * @param {unknown} emptyTexture  `PIXI.Texture.EMPTY` of the page's Pixi
 */
export function patchBeatmapEngineBackgroundContain(
  BeatmapEngine,
  emptyTexture,
) {
  const proto = BeatmapEngine?.prototype;
  if (!proto || proto[BEATMAP_ENGINE_BG_CONTAIN_PATCH]) return;

  function reflowBackgroundContain(self) {
    try {
      const sp = self.backgroundSprite;
      const tex = sp?.texture;
      if (!sp || !tex || tex === emptyTexture || !tex.width || !tex.height) {
        return;
      }
      const { width, height } = self.getDisplayDimensions();
      const scale = Math.min(width / tex.width, height / tex.height);
      sp.scale.set(scale);
      sp.x = (width - tex.width * scale) / 2;
      sp.y = (height - tex.height * scale) / 2;
      // Darken cover art so objects/readability match typical in-game dimming.
      sp.tint = 0x5a5a5a;
    } catch (_e) {
      void 0;
    }
  }

  const origUpdateBg = proto.updateBackgroundFromUrl;
  proto.updateBackgroundFromUrl = async function oepUpdateBackgroundFromUrl(
    imageUrl,
  ) {
    await origUpdateBg.call(this, imageUrl);
    reflowBackgroundContain(this);
  };

  const origResize = proto.resize;
  proto.resize = function oepResize() {
    origResize.call(this);
    reflowBackgroundContain(this);
  };

  proto[BEATMAP_ENGINE_BG_CONTAIN_PATCH] = true;
}
