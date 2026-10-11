/**
 * Gameplay preview preferences: volumes and audio offset (WS-51).
 */

import { pageLocalStorage } from "../../core/page-window.js";
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
