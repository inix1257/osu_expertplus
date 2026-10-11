/**
 * Difficulty names and star ratings beside the difficulty picker icons (WS-33).
 */

import {
  parsePickerHref,
  readBeatmapsetJson,
} from "../../osu/beatmapset-data.js";
import { el, settingIds, settings } from "../legacy.js";
import { PICKER_DIFF_NAMES_META_ATTR } from "./constants.js";
import {
  PICKER_LINK_SEL,
  PICKER_SEL,
  subscribePickerChanges,
} from "./picker.js";
import { formatStars, STAR_FORMAT } from "../../osu/format.js";

/**
 * @param {number} n
 * @returns {string}
 */
export function formatBeatmapsetHeaderStarRatingText(n) {
  return formatStars(n, STAR_FORMAT.header);
}

/**
 * Name and nomod star rating of a difficulty as shown for `ruleset`. A
 * difficulty listed under another ruleset's tab is a convert, whose name
 * (e.g. `[4K] Normal`) and rating come from the set's `converts` (B91).
 * @param {number|null|undefined} beatmapId
 * @param {string|null} [ruleset]  the picker link's ruleset
 * @returns {{ version: string, rating: number|null }}
 */
export function getBeatmapVersionAndRatingForHeader(beatmapId, ruleset) {
  const data = readBeatmapsetJson();
  if (!data?.beatmaps?.length) return { version: "", rating: null };
  const n = Number(beatmapId);
  if (!Number.isFinite(n)) return { version: "", rating: null };
  let bm = data.beatmaps.find((b) => Number(b.id) === n);
  if (bm && ruleset && bm.mode !== ruleset) {
    bm = data.converts?.find((b) => Number(b.id) === n && b.mode === ruleset);
  }
  if (!bm) return { version: "", rating: null };
  const version =
    bm.version != null && String(bm.version).trim() !== ""
      ? String(bm.version)
      : "";
  const x = Number(bm.difficulty_rating);
  const rating = Number.isFinite(x) ? x : null;
  return { version, rating };
}

/**
 * Shows each difficulty’s name and nomod star rating next to its icon in the picker tray
 * (still osu’s horizontal, wrapping layout — just with names/SR added per icon).
 * @param {HTMLElement} header
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startPickerDiffNames(header, pathRe) {
  const picker = header.querySelector(PICKER_SEL);
  if (!(picker instanceof HTMLElement)) return () => {};

  let disposed = false;
  let raf = 0;

  function syncEnabledClass() {
    header.classList.toggle(
      "oep-picker-diff-names-enabled",
      settings().isEnabled(settingIds().PICKER_DIFF_NAMES),
    );
  }

  function syncRow(a) {
    if (!settings().isEnabled(settingIds().PICKER_DIFF_NAMES)) {
      a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`)?.remove();
      return;
    }

    const link = parsePickerHref(a.getAttribute("href"), {
      pathFallback: true,
    });
    const { version, rating } = link
      ? getBeatmapVersionAndRatingForHeader(link.beatmapId, link.ruleset)
      : { version: "", rating: null };

    let meta = a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`);
    if (!(meta instanceof HTMLElement)) {
      meta = el(
        "span",
        {
          class: "oep-picker-diff-names__meta",
          [PICKER_DIFF_NAMES_META_ATTR]: "1",
        },
        el("span", { class: "oep-picker-diff-names__version" }),
        el(
          "span",
          { class: "oep-picker-diff-names__star" },
          el("i", { class: "fas fa-star", "aria-hidden": "true" }),
        ),
      );
      a.appendChild(meta);
    }

    const icon = a.querySelector(".beatmap-icon");
    const diffVar = icon
      ? (
          icon.style.getPropertyValue("--diff") ||
          getComputedStyle(icon).getPropertyValue("--diff")
        ).trim()
      : "";
    if (diffVar) meta.style.setProperty("--oep-diff-muted-src", diffVar);
    else meta.style.removeProperty("--oep-diff-muted-src");

    const verEl = meta.querySelector(".oep-picker-diff-names__version");
    if (verEl instanceof HTMLElement && verEl.textContent !== version) {
      verEl.textContent = version;
    }

    const starEl = meta.querySelector(".oep-picker-diff-names__star");
    if (starEl instanceof HTMLElement) {
      const starIcon = starEl.querySelector(".fa-star");
      let starTn = starIcon?.nextSibling;
      if (!(starTn instanceof Text)) {
        starTn = document.createTextNode("");
        starEl.appendChild(starTn);
      }
      if (rating != null) {
        starTn.textContent = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
        starEl.style.display = "";
      } else {
        starTn.textContent = "";
        starEl.style.display = "none";
      }
    }
  }

  function syncAll() {
    if (disposed || !pathRe.test(location.pathname)) return;
    syncEnabledClass();
    for (const a of picker.querySelectorAll(PICKER_LINK_SEL)) {
      if (a instanceof HTMLAnchorElement) syncRow(a);
    }
  }

  function scheduleSync() {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      syncAll();
    });
  }

  function onRouteSignal() {
    scheduleSync();
  }

  const unsubSetting = settings().onChange(
    settingIds().PICKER_DIFF_NAMES,
    scheduleSync,
  );

  syncAll();

  window.addEventListener("hashchange", onRouteSignal, { passive: true });
  window.addEventListener("popstate", onRouteSignal, { passive: true });

  const unsubscribePicker = subscribePickerChanges(picker, scheduleSync, {
    label: "beatmapset/picker-names",
  });

  return () => {
    disposed = true;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    unsubSetting();
    header.classList.remove("oep-picker-diff-names-enabled");
    window.removeEventListener("hashchange", onRouteSignal);
    window.removeEventListener("popstate", onRouteSignal);
    unsubscribePicker();
    for (const node of picker.querySelectorAll(
      `[${PICKER_DIFF_NAMES_META_ATTR}]`,
    )) {
      node.remove();
    }
  };
}
