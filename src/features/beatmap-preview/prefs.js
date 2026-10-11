/**
 * Gameplay preview preferences: volumes and audio offset (WS-51).
 */

import { pageLocalStorage } from "../../core/page-window.js";
import { KEYS } from "../../core/storage.js";
/**
 * Reads osu! web `localStorage.userPreferences` JSON and returns `audio_volume` if valid (0–1).
 * @returns {number|null}
 */
export function readOsuSiteAudioVolume() {
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

/** Volume used when nothing is stored and the site has no volume either. */
export const PREVIEW_VOLUME_DEFAULT = 0.3;

/** @param {unknown} v */
function volumeOrNull(v) {
  if (v === undefined || v === null || String(v) === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/**
 * A preview volume (0–1) kept in the site's localStorage (decided 2026-10-11:
 * not moved to GM storage). Reading falls back to the Tampermonkey key from
 * before the localStorage move (copied over once), then the site's own
 * volume, then {@link PREVIEW_VOLUME_DEFAULT}.
 * @param {{ key: string }} storageKey  core/storage entry (localStorage)
 * @param {{ key: string }} legacyGmKey  core/storage entry (GM)
 */
function createVolumePref(storageKey, legacyGmKey) {
  function write(vol) {
    const ls = pageLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(storageKey.key, String(vol));
    } catch (_) {
      void 0;
    }
  }
  function read() {
    const ls = pageLocalStorage();
    if (ls) {
      try {
        const n = volumeOrNull(ls.getItem(storageKey.key));
        if (n != null) return n;
      } catch (_) {
        void 0;
      }
    }
    try {
      const n = volumeOrNull(GM_getValue(legacyGmKey.key, undefined));
      if (n != null) {
        write(n);
        return n;
      }
    } catch (_) {
      void 0;
    }
    return readOsuSiteAudioVolume() ?? PREVIEW_VOLUME_DEFAULT;
  }
  return { read, write };
}

export const musicVolumePref = createVolumePref(
  KEYS.PREVIEW_MUSIC_VOLUME,
  KEYS.PREVIEW_MUSIC_VOLUME_LEGACY,
);
export const hitsoundVolumePref = createVolumePref(
  KEYS.PREVIEW_HITSOUND_VOLUME,
  KEYS.PREVIEW_HITSOUND_VOLUME_LEGACY,
);

const OFFSET_MIN = -500;
const OFFSET_MAX = 500;
/** Added to the displayed offset when calling the renderer (0 ms shown → 85 ms actual). */
const PREVIEW_OFFSET_DISPLAY_BASE_MS = 85;

/** @param {number} n */
export function clampOffsetMs(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(n)));
}

/** @param {number} displayMs */
export function actualAudioOffsetMsFromDisplay(displayMs) {
  return clampOffsetMs(displayMs) + PREVIEW_OFFSET_DISPLAY_BASE_MS;
}

/** @param {unknown} raw */
export function parseOffsetTextStrict(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/ms$/i, "");
  if (s === "" || s === "-" || s === "+") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return clampOffsetMs(n);
}

/** @param {number} ms */
export function formatOffsetForField(ms) {
  return String(clampOffsetMs(ms));
}

/** The displayed audio offset (ms), 0 when nothing is stored. */
export function readStoredOffsetMs() {
  const ls = pageLocalStorage();
  if (ls) {
    try {
      const s = ls.getItem(KEYS.PREVIEW_AUDIO_OFFSET.key);
      if (s != null && s !== "") {
        return clampOffsetMs(Number(s));
      }
    } catch (_) {
      void 0;
    }
  }
  return 0;
}

/** @param {number} ms  displayed offset */
export function writeStoredOffsetMs(ms) {
  const ls = pageLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(KEYS.PREVIEW_AUDIO_OFFSET.key, String(clampOffsetMs(ms)));
  } catch (_) {
    void 0;
  }
}
