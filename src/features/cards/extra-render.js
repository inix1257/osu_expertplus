/**
 * Beatmap card extras: source row, BPM / length line and per-mode star
 * chips built from beatmapset JSON (WS-50).
 */

import { el } from "../legacy.js";
import {
  BLOCK_CLASS,
  PANEL_CACHE_EPOCH_ATTR,
  PANEL_RENDERED_META_ATTR,
  PANEL_RENDERED_STARS_ATTR,
  PANEL_STATE_ATTR,
  SOURCE_SLOT_CLASS,
  STAR_RANGE_CLASS,
} from "./extra-styles.js";
/**
 * @param {unknown} sec
 * @returns {string}
 */
function formatDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * @param {object} data
 * @returns {{ bpmStr: string|null, lengthStr: string|null }}
 */
function bpmLengthFromSet(data) {
  const maps = data?.beatmaps;
  if (!Array.isArray(maps) || maps.length === 0)
    return { bpmStr: null, lengthStr: null };

  const bpmSet = new Set();
  for (const m of maps) {
    const b = Number(m?.bpm);
    if (Number.isFinite(b)) bpmSet.add(b);
  }
  const bpms = [...bpmSet].sort((a, b) => a - b);
  let bpmStr = null;
  if (bpms.length === 1) bpmStr = `${bpms[0]} BPM`;
  else if (bpms.length > 1) bpmStr = `${bpms[0]}–${bpms[bpms.length - 1]} BPM`;

  const lengths = maps
    .map((m) => Number(m?.total_length))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const longest = lengths.length ? Math.max(...lengths) : null;
  const lengthStr = longest != null ? formatDuration(longest) : null;
  return { bpmStr, lengthStr };
}

/** Truncate toward zero at 2 decimal places (no rounding up). */
function formatStarShort(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const t = (Math.floor(Math.abs(x) * 100) / 100) * Math.sign(x);
  if (Number.isInteger(t)) return String(t);
  let s = t.toFixed(2);
  if (s.endsWith("0")) s = s.slice(0, -1);
  if (s.endsWith(".")) s = s.slice(0, -1);
  return s;
}

/**
 * One SR pill (FA up-chevron, star, value) with osu difficulty bg/text colours.
 * @param {{ getDiffColour: (n: number) => string, getDiffTextColour: (n: number) => string }|null|undefined} dc
 * @param {number} sr
 * @returns {HTMLElement|null}
 */
function buildStarChip(dc, sr) {
  const text = formatStarShort(sr);
  if (!text) return null;
  const bg = dc?.getDiffColour(sr) ?? "hsl(var(--hsl-b6))";
  const fg = dc?.getDiffTextColour(sr) ?? "hsl(var(--hsl-l1))";
  return el(
    "span",
    {
      class: `${STAR_RANGE_CLASS}__chip`,
      style: { backgroundColor: bg, color: fg },
    },
    el(
      "span",
      { class: `${STAR_RANGE_CLASS}__chip-inner` },
      el("span", {
        class: `fas fa-chevron-up ${STAR_RANGE_CLASS}__chip-up`,
        "aria-hidden": "true",
      }),
      el("span", {
        class: `fas fa-star ${STAR_RANGE_CLASS}__chip-icon`,
        "aria-hidden": "true",
      }),
      el("span", { class: `${STAR_RANGE_CLASS}__chip-val` }, text),
    ),
  );
}

/**
 * @param {object} data  beatmapset JSON
 * @returns {Map<string, number[]>}
 */
function ratingsByRulesetFromSet(data) {
  /** @type {Map<string, number[]>} */
  const map = new Map();
  const maps = data?.beatmaps;
  if (!Array.isArray(maps)) return map;
  for (const b of maps) {
    const mode = b?.mode;
    if (typeof mode !== "string") continue;
    const r = Number(b?.difficulty_rating);
    if (!Number.isFinite(r)) continue;
    if (!map.has(mode)) map.set(mode, []);
    map.get(mode).push(r);
  }
  return map;
}

/**
 * @param {object} data  beatmapset JSON
 * @returns {number}
 */
function distinctModeCountFromSet(data) {
  const maps = data?.beatmaps;
  if (!Array.isArray(maps)) return 0;
  const seen = new Set();
  for (const b of maps) {
    if (typeof b?.mode === "string") seen.add(b.mode);
  }
  return seen.size;
}

/**
 * @param {Element} item  `.beatmapset-panel__extra-item--dots`
 * @returns {string|null}  ruleset id e.g. osu
 */
function parseRulesetFromDotsRow(item) {
  const icon = item.querySelector(
    ".beatmapset-panel__beatmap-icon i[class*='fa-extra-mode-']",
  );
  if (!icon) return null;
  const m = icon.className.match(/\bfa-extra-mode-(osu|taiko|fruits|mania)\b/);
  return m ? m[1] : null;
}

/**
 * Highest star rating per mode row (visible without hovering the popup).
 * @param {Element} panel
 * @param {object} data
 */
export function mountStarRanges(panel, data) {
  const dc = OsuExpertPlus.difficultyColours;
  const byMode = ratingsByRulesetFromSet(data);
  if (byMode.size === 0) return;
  if (distinctModeCountFromSet(data) >= 4) return;

  panel
    .querySelectorAll(".beatmapset-panel__extra-item--dots")
    .forEach((row) => {
      row.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
      const mode = parseRulesetFromDotsRow(row);
      if (!mode) return;
      const ratings = byMode.get(mode);
      if (!ratings?.length) return;
      // ratingsByRulesetFromSet keeps finite ratings only.
      const hi = Math.max(...ratings);

      const wrap = el("span", { class: STAR_RANGE_CLASS });
      const chip = buildStarChip(dc, hi);
      if (!chip) return;
      wrap.appendChild(chip);
      row.appendChild(wrap);
    });
}

/**
 * @param {Element} panel
 * @returns {string|null}
 */
export function parseBeatmapsetId(panel) {
  const links = panel.querySelectorAll('a[href*="beatmapsets/"]');
  for (const a of links) {
    const href = a.getAttribute("href");
    if (!href) continue;
    try {
      const u = new URL(href, location.origin);
      const m = u.pathname.match(/^\/beatmapsets\/(\d+)/i);
      if (m) return m[1];
    } catch (_) {
      void 0;
    }
  }
  return null;
}

/**
 * @param {string} sourceText  trimmed API source (may be empty)
 * @returns {HTMLElement}
 */
function buildSourceSlotRow(sourceText) {
  const inner =
    sourceText.length > 0
      ? el(
          "div",
          { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
          "from ",
          el("span", { class: `${BLOCK_CLASS}__source-text` }, sourceText),
        )
      : el(
          "div",
          { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
          el(
            "span",
            {
              class: `${BLOCK_CLASS}__source-placeholder`,
              "aria-hidden": "true",
            },
            "\u00a0",
          ),
        );

  return el(
    "div",
    {
      class: `beatmapset-panel__info-row ${SOURCE_SLOT_CLASS}`,
      "data-oep-card-extra-slot": "1",
    },
    inner,
  );
}

/**
 * Insert between artist row and mapper row (native --source hidden via CSS :has slot).
 * @param {Element} panel
 * @param {string} sourceTrimmed
 * @returns {boolean}
 */
export function mountSourceSlot(panel, sourceTrimmed) {
  const artist = panel.querySelector(".beatmapset-panel__info-row--artist");
  if (!artist) return false;
  artist.insertAdjacentElement("afterend", buildSourceSlotRow(sourceTrimmed));
  return true;
}

/**
 * BPM / length block after mapper, before stats.
 * @param {Element} panel
 * @returns {{ anchor: Element, mode: "after" | "append" }}
 */
export function insertTargetMeta(panel) {
  const mapperRow = panel.querySelector(".beatmapset-panel__info-row--mapper");
  if (mapperRow) return { anchor: mapperRow, mode: "after" };

  const sourceRow = panel.querySelector(".beatmapset-panel__info-row--source");
  if (sourceRow) return { anchor: sourceRow, mode: "after" };

  const artistRow = panel.querySelector(".beatmapset-panel__info-row--artist");
  if (artistRow) return { anchor: artistRow, mode: "after" };

  const info = panel.querySelector(".beatmapset-panel__info");
  if (info) return { anchor: info, mode: "append" };

  const legacyMapper = panel.querySelector(".beatmapset-panel__mapper");
  if (legacyMapper) return { anchor: legacyMapper, mode: "after" };
  const legacyArtist = panel.querySelector(".beatmapset-panel__artist");
  if (legacyArtist) return { anchor: legacyArtist, mode: "after" };
  const details = panel.querySelector(".beatmapset-panel__details");
  if (details) return { anchor: details, mode: "append" };

  return { anchor: panel, mode: "append" };
}

/**
 * @param {object} data
 * @returns {HTMLElement|null}
 */
export function buildMetaBlock(data) {
  const { bpmStr, lengthStr } = bpmLengthFromSet(data);
  const metaBits = [];
  if (bpmStr) metaBits.push(bpmStr);
  if (lengthStr) metaBits.push(lengthStr);
  if (!metaBits.length) return null;
  return el(
    "div",
    { class: BLOCK_CLASS },
    el("div", { class: `${BLOCK_CLASS}__meta` }, metaBits.join(" · ")),
  );
}

/**
 * @param {Element} panel
 */
export function stripInjections(panel) {
  panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
  panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
  panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
  panel.removeAttribute(PANEL_STATE_ATTR);
  panel.removeAttribute(PANEL_CACHE_EPOCH_ATTR);
  panel.removeAttribute(PANEL_RENDERED_META_ATTR);
  panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
}
