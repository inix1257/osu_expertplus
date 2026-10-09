/*
 * Frozen copy of the beatmapset helpers that lived in
 * src/pages/beatmap-detail.js before WS-33 (snapshot of bc2e4c4). Read by
 * test/osu/legacy.mjs (legacySource) so the src/osu tests can keep comparing
 * the new helpers against the old code. Not loaded by the userscript; do
 * not edit.
 */

  function parseBeatmapIdFromPickerLink(anchor) {
    const href = anchor.getAttribute("href");
    if (!href) return null;
    const m = href.match(/#([a-z]+)\/(\d+)\s*$/i);
    return m ? Number(m[2]) : null;
  }

  function formatBeatmapsetHeaderStarRatingText(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "";
    const floored = Math.floor(v * 100) / 100;
    return floored.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
