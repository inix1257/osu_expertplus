/**
 * Beatmap card stats: always-visible stats and full play / favourite counts
 * (WS-50).
 */

import { beatmapsetCache } from "../../core/beatmapset-cache.js";
import { observe } from "../../core/observe.js";
import { parseBeatmapsetId } from "./extra-render.js";

const ALWAYS_SHOW_STYLE_ID = "osu-expertplus-beatmap-card-always-stats";
const ALWAYS_SHOW_CSS = `
  .beatmapset-panel { --stats-opacity: 1 !important; }
`;

const FULL_STATS_STYLE_ID = "osu-expertplus-beatmap-card-full-stats";
/** On a stats item whose full number is shown. */
const FULL_BEATMAP_STATS_ITEM_ATTR = "data-oep-full-stat-item";
/** Our number, next to osu-web's abbreviated one (which is hidden, not changed). */
const FULL_STAT_CLASS = "oep-full-stat";
// Only right after our number: if osu-web re-renders the item without it,
// its own (abbreviated) number shows again.
const FULL_STATS_CSS = `
  .beatmapset-panel__stats-item .${FULL_STAT_CLASS} + span {
    display: none;
  }
`;

const STATS_ITEM_SEL =
  ".beatmapset-panel__stats-item--play-count, .beatmapset-panel__stats-item--favourite-count";

/**
 * The count in a stats tooltip, whatever the site language: the only number
 * in it, with any digit grouping (`1,234`, `1.234`, `1 234`) removed (B26).
 * @param {string} tooltip
 * @returns {number|null}
 */
export function countFromStatTooltip(tooltip) {
  // `\s` also covers no-break and narrow no-break spaces.
  const m = String(tooltip).match(/\d[\d.,\s'’]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Full count for a stats item: the card's beatmapset JSON (`play_count`,
 * `favourite_count`) when the page loaded it, otherwise the tooltip.
 * @param {Element} item
 * @returns {number|null}
 */
function fullStatCount(item) {
  const isPlay = item.classList.contains(
    "beatmapset-panel__stats-item--play-count",
  );
  const panel = item.closest(".beatmapset-panel");
  const id = panel ? parseBeatmapsetId(panel) : null;
  const data = id ? beatmapsetCache.get(id) : undefined;
  const fromData = Number(isPlay ? data?.play_count : data?.favourite_count);
  if (Number.isFinite(fromData) && fromData >= 0) return fromData;
  return countFromStatTooltip(
    item.getAttribute("data-orig-title") || item.getAttribute("title") || "",
  );
}

/**
 * Show the full number next to osu-web's abbreviated one (B26: the site's
 * own text node is left alone; CSS hides it).
 * @param {ParentNode} scope
 */
export function applyFullBeatmapStatNumbers(scope) {
  scope.querySelectorAll(STATS_ITEM_SEL).forEach((item) => {
    const n = fullStatCount(item);
    if (n === null) return;
    const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
    const valSpan = icon?.nextElementSibling;
    if (!valSpan || valSpan.tagName !== "SPAN") return;
    const text = n.toLocaleString("en-US");
    let ours = valSpan.classList.contains(FULL_STAT_CLASS) ? valSpan : null;
    if (!ours) {
      ours = document.createElement("span");
      ours.className = FULL_STAT_CLASS;
      valSpan.before(ours);
    }
    if (ours.textContent !== text) ours.textContent = text;
    item.setAttribute(FULL_BEATMAP_STATS_ITEM_ATTR, "1");
  });
}

/** @param {ParentNode} scope */
export function revertFullBeatmapStatNumbers(scope) {
  scope.querySelectorAll(`.${FULL_STAT_CLASS}`).forEach((n) => n.remove());
  scope
    .querySelectorAll(`[${FULL_BEATMAP_STATS_ITEM_ATTR}]`)
    .forEach((item) => item.removeAttribute(FULL_BEATMAP_STATS_ITEM_ATTR));
}

/**
 * @param {typeof OsuExpertPlus.settings} settings
 * @param {typeof OsuExpertPlus.dom.manageStyle} manageStyle
 * @returns {() => void}
 */
export function startAlwaysShowStats(settings, manageStyle) {
  const style = manageStyle(ALWAYS_SHOW_STYLE_ID, ALWAYS_SHOW_CSS);
  const id = settings.IDS.ALWAYS_SHOW_STATS;
  function apply(enabled) {
    enabled ? style.inject() : style.remove();
  }
  apply(settings.isEnabled(id));
  const unsub = settings.onChange(id, apply);
  return () => {
    try {
      unsub();
    } catch (_) {}
    style.remove();
  };
}

/**
 * @param {typeof OsuExpertPlus.settings} settings
 * @param {typeof OsuExpertPlus.dom.manageStyle} manageStyle
 * @returns {() => void}
 */
export function startFullBeatmapStatNumbers(settings, manageStyle) {
  const featureId = settings.IDS.FULL_BEATMAP_STAT_NUMBERS;
  const style = manageStyle(FULL_STATS_STYLE_ID, FULL_STATS_CSS);

  /** @type {AbortController|null} */
  let ac = null;
  /** @type {(() => void)|null} */
  let unsubCache = null;

  function stop() {
    ac?.abort();
    ac = null;
    unsubCache?.();
    unsubCache = null;
  }

  function applyFeature(enabled) {
    stop();
    if (!enabled) {
      revertFullBeatmapStatNumbers(document);
      style.remove();
      return;
    }
    style.inject();
    applyFullBeatmapStatNumbers(document);
    ac = new AbortController();
    observe.subscribe(
      {
        selector: ".beatmapset-panel",
        schedule: "sync",
        signal: ac.signal,
        label: "cards/full-stats",
      },
      ({ added }) => {
        for (const el of added) {
          if (el.matches(".beatmapset-panel")) applyFullBeatmapStatNumbers(el);
          else
            el.querySelectorAll(".beatmapset-panel").forEach((panel) =>
              applyFullBeatmapStatNumbers(panel),
            );
        }
      },
    );
    // Exact counts from the site's data replace tooltip-derived ones.
    unsubCache = beatmapsetCache.onChange(() =>
      applyFullBeatmapStatNumbers(document),
    );
  }

  applyFeature(settings.isEnabled(featureId));
  const unsub = settings.onChange(featureId, applyFeature);

  return () => {
    try {
      unsub();
    } catch (_) {}
    stop();
    revertFullBeatmapStatNumbers(document);
    style.remove();
  };
}
