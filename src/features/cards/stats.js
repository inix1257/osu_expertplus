/**
 * Beatmap card stats: always-visible stats and full play / favourite counts
 * (WS-50).
 */

import { observe } from "../../core/observe.js";

const ALWAYS_SHOW_STYLE_ID = "osu-expertplus-beatmap-card-always-stats";
const ALWAYS_SHOW_CSS = `
  .beatmapset-panel { --stats-opacity: 1 !important; }
`;

const FULL_BEATMAP_STATS_ITEM_ATTR = "data-oep-full-stat-item";
const FULL_BEATMAP_STATS_VALUE_ATTR = "data-oep-full-stat-abbrev";

function beatmapStatTooltipSource(item) {
  return (
    item.getAttribute("data-orig-title") || item.getAttribute("title") || ""
  );
}

function parseBeatmapStatCount(tooltip, kind) {
  const re =
    kind === "play" ? /Playcount:\s*([\d,]+)/i : /Favourites:\s*([\d,]+)/i;
  const m = tooltip.match(re);
  if (!m) return null;
  const n = parseInt(String(m[1]).replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function formatBeatmapStatCount(n) {
  return n.toLocaleString("en-US");
}

/**
 * @param {ParentNode} scope
 */
export function applyFullBeatmapStatNumbers(scope) {
  const items = scope.querySelectorAll(
    ".beatmapset-panel__stats-item--play-count, .beatmapset-panel__stats-item--favourite-count",
  );
  items.forEach((item) => {
    if (item.hasAttribute(FULL_BEATMAP_STATS_ITEM_ATTR)) return;

    const isPlay = item.classList.contains(
      "beatmapset-panel__stats-item--play-count",
    );
    const n = parseBeatmapStatCount(
      beatmapStatTooltipSource(item),
      isPlay ? "play" : "favourite",
    );
    if (n === null) return;

    const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
    const valSpan = icon?.nextElementSibling;
    if (!valSpan || valSpan.tagName !== "SPAN") return;

    valSpan.setAttribute(FULL_BEATMAP_STATS_VALUE_ATTR, valSpan.textContent);
    valSpan.textContent = formatBeatmapStatCount(n);
    item.setAttribute(FULL_BEATMAP_STATS_ITEM_ATTR, "1");
  });
}

/**
 * @param {ParentNode} scope
 */
export function revertFullBeatmapStatNumbers(scope) {
  scope
    .querySelectorAll(
      `.beatmapset-panel__stats-item[${FULL_BEATMAP_STATS_ITEM_ATTR}]`,
    )
    .forEach((item) => {
      const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
      const valSpan = icon?.nextElementSibling;
      if (valSpan?.hasAttribute(FULL_BEATMAP_STATS_VALUE_ATTR)) {
        valSpan.textContent = valSpan.getAttribute(
          FULL_BEATMAP_STATS_VALUE_ATTR,
        );
        valSpan.removeAttribute(FULL_BEATMAP_STATS_VALUE_ATTR);
      }
      item.removeAttribute(FULL_BEATMAP_STATS_ITEM_ATTR);
    });
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
 * @returns {() => void}
 */
export function startFullBeatmapStatNumbers(settings) {
  const featureId = settings.IDS.FULL_BEATMAP_STAT_NUMBERS;

  /** @returns {function} disconnect */
  function startObserver() {
    const ac = new AbortController();
    observe.subscribe(
      {
        selector: ".beatmapset-panel",
        schedule: "sync",
        signal: ac.signal,
        label: "cards/full-stats",
      },
      ({ added }) => {
        if (!settings.isEnabled(featureId)) return;
        for (const el of added) {
          if (el.matches(".beatmapset-panel")) {
            applyFullBeatmapStatNumbers(el);
          } else {
            el.querySelectorAll(".beatmapset-panel").forEach((panel) => {
              applyFullBeatmapStatNumbers(panel);
            });
          }
        }
      },
    );
    return () => ac.abort();
  }

  let stopObs = null;
  function applyFeature(enabled) {
    stopObs?.();
    stopObs = null;
    if (enabled) {
      applyFullBeatmapStatNumbers(document);
      stopObs = startObserver();
    } else {
      revertFullBeatmapStatNumbers(document);
    }
  }

  applyFeature(settings.isEnabled(featureId));
  const unsub = settings.onChange(featureId, applyFeature);

  return () => {
    try {
      unsub();
    } catch (_) {}
    stopObs?.();
    stopObs = null;
    revertFullBeatmapStatNumbers(document);
  };
}
