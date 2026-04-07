/**
 * Star difficulty background / text colours — aligned with osu-web
 * `getDiffColour` / `getDiffTextColour` (resources/js/utils/beatmap-helper.ts).
 * Background ramp matches; text ramp above SR 9 is lightened (osu uses black bg there).
 */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.difficultyColours = (() => {
  const DIFF_DOMAIN = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
  const DIFF_RANGE = [
    "#4290FB",
    "#4FC0FF",
    "#4FFFD5",
    "#7CFF4F",
    "#F6F05C",
    "#FF8068",
    "#FF4E6F",
    "#C645B8",
    "#6563DE",
    "#18158E",
    "#000000",
  ];
  const TEXT_SR_DOMAIN = [9, 9.9, 10.6, 11.5, 12.4];
  const TEXT_SR_RANGE = [
    "#F6F05C",
    "#FF8068",
    "#FF4E6F",
    "#C645B8",
    "#B0A8FF",
    "#E4E2FF",
  ];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
    return `#${[clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  /** @param {number} sr */
  function getDiffColour(sr) {
    if (sr < 0.1) return "#AAAAAA";
    if (sr >= 9) return "#000000";
    for (let i = 0; i < DIFF_DOMAIN.length - 1; i++) {
      const d0 = DIFF_DOMAIN[i];
      const d1 = DIFF_DOMAIN[i + 1];
      if (sr >= d0 && sr < d1) {
        const t = (sr - d0) / (d1 - d0);
        const a = hexToRgb(DIFF_RANGE[i]);
        const b = hexToRgb(DIFF_RANGE[i + 1]);
        return rgbToHex(
          a.r + (b.r - a.r) * t,
          a.g + (b.g - a.g) * t,
          a.b + (b.b - a.b) * t,
        );
      }
    }
    return "#000000";
  }

  /** @param {number} sr */
  function getDiffTextColour(sr) {
    if (sr < 6.5) return "#000000";
    if (sr < 9) return "#F6F05C";
    if (sr >= 12.4) return "#E4E2FF";
    for (let i = 0; i < TEXT_SR_DOMAIN.length - 1; i++) {
      const d0 = TEXT_SR_DOMAIN[i];
      const d1 = TEXT_SR_DOMAIN[i + 1];
      if (sr >= d0 && sr < d1) {
        const t = (sr - d0) / (d1 - d0);
        const a = hexToRgb(TEXT_SR_RANGE[i]);
        const b = hexToRgb(TEXT_SR_RANGE[i + 1]);
        return rgbToHex(
          a.r + (b.r - a.r) * t,
          a.g + (b.g - a.g) * t,
          a.b + (b.b - a.b) * t,
        );
      }
    }
    return "#E4E2FF";
  }

  return { getDiffColour, getDiffTextColour };
})();
