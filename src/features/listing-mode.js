/**
 * Remember the beatmap listing's ruleset (URL `m=`), open new visits with it
 * and point listing links at it (WS-50).
 */

import { observe } from "../core/observe.js";
import { exposeToPage, pageWindow } from "../core/page-window.js";
import { isBeatmapsetsListing } from "../core/routes.js";
import { KEYS, getString, setString } from "../core/storage.js";

/** Written when the user picks "Any" so it does not fall back to osu (0). */
const STORED_ANY = "any";

/**
 * @returns {string|null}  ruleset id `0`–`3`, or `null` when the user chose Any
 */
function getPreferredMode() {
  const v = getString(KEYS.LISTING_PREFERRED_MODE);
  if (v == null) return "0";
  if (v === STORED_ANY) return null;
  return /^[0123]$/.test(v) ? v : "0";
}

/** @param {string|null} m */
function setPreferredMode(m) {
  if (m == null || m === "") {
    setString(KEYS.LISTING_PREFERRED_MODE, STORED_ANY);
  } else if (/^[0123]$/.test(m)) {
    setString(KEYS.LISTING_PREFERRED_MODE, m);
  }
}

/**
 * The listing's React root: `null` until osu-web renders it, then whether it
 * has the advanced search (which holds the ruleset filter).
 * @returns {boolean|null}
 */
function advancedBeatmapSearch() {
  const root = document.querySelector('.js-react[data-react="beatmaps"]');
  if (!root) return null;
  return root.getAttribute("data-advanced-search") === "1";
}

const FILTER_ITEM_SEL = "a.beatmapsets-search-filter__item";

/**
 * The ruleset filter row, in the grid and in the sticky bar: the filter group
 * whose valued items are exactly the ruleset ids (its "Any" has no value).
 * @param {Element} a
 */
function isModeFilterAnchor(a) {
  const group = a.closest(".beatmapsets-search-filter");
  if (!group) return false;
  const values = Array.from(
    group.querySelectorAll(`${FILTER_ITEM_SEL}[data-filter-value]`),
    (item) => item.getAttribute("data-filter-value") ?? "",
  );
  return values.length > 0 && values.every((v) => /^[0123]$/.test(v));
}

/**
 * The ruleset filter item for `mode`.
 * @param {string} mode  `0`–`3`
 * @returns {HTMLElement|null}
 */
function findModeFilterItem(mode) {
  for (const a of document.querySelectorAll(
    `${FILTER_ITEM_SEL}[data-filter-value="${CSS.escape(mode)}"]`,
  )) {
    if (a instanceof HTMLElement && isModeFilterAnchor(a)) return a;
  }
  return null;
}

function persistFromListingLocation() {
  if (!isBeatmapsetsListing(location.pathname)) return;
  const m = new URLSearchParams(location.search).get("m");
  if (m == null || m === "") {
    setPreferredMode(null);
  } else if (/^[0123]$/.test(m)) {
    setPreferredMode(m);
  }
  patchListingAnchors();
}

function patchListingAnchors() {
  const pref = getPreferredMode();
  if (pref == null) return;
  const nodes = document.querySelectorAll('a[href*="/beatmapsets"]');
  for (const a of nodes) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    let u;
    try {
      u = new URL(a.href);
    } catch (_) {
      continue;
    }
    if (u.hostname !== "osu.ppy.sh") continue;
    if (!isBeatmapsetsListing(u.pathname)) continue;
    if (u.searchParams.has("m")) continue;
    u.searchParams.set("m", pref);
    const rel = u.pathname + u.search + u.hash;
    const attr = a.getAttribute("href");
    if (attr != null && /^https?:\/\//i.test(attr)) {
      a.href = u.toString();
    } else {
      a.setAttribute("href", rel);
    }
  }
}

/**
 * Keeps "Beatmap listing" (and similar) links aligned with the saved `m` param.
 * Re-patches 200ms after the last DOM change.
 * @returns {() => void}
 */
export function installLinkPatcher() {
  patchListingAnchors();
  return observe.subscribe(
    { schedule: 200, label: "listing-mode/link-patcher" },
    () => patchListingAnchors(),
  );
}

/**
 * Listing page: apply saved mode when URL has no `m`, and record filter clicks.
 * @returns {() => void}
 */
/**
 * Clicks an osu-web filter link without adding a history entry (B99).
 * osu-web's filter click pushes the new search URL synchronously
 * (`updateHistory(url, "push")` → `Turbo.session.history.push`); for this
 * click it replaces the current entry instead, so Back leaves the listing
 * in one step. Without Turbo it is a plain click.
 * @param {HTMLElement} el
 */
function clickReplacingHistory(el) {
  let history = null;
  try {
    history = pageWindow()?.Turbo?.session?.history ?? null;
  } catch {
    history = null;
  }
  const push = history?.push;
  if (typeof push !== "function" || typeof history.replace !== "function") {
    el.click();
    return;
  }
  const ownPush = Object.hasOwn(history, "push");
  history.push = exposeToPage(function (location, restorationIdentifier) {
    return history.replace(location, restorationIdentifier);
  }, history);
  try {
    el.click();
  } finally {
    if (ownPush) history.push = push;
    else delete history.push;
  }
}

export function startPageBehavior() {
  const ac = new AbortController();
  let applied = false;

  const tryApplyPreferred = () => {
    if (applied) return;
    if (!isBeatmapsetsListing(location.pathname)) return;
    // B67: before the root renders there is nothing to decide yet; keep
    // waiting (up to the cap) instead of giving up.
    const advanced = advancedBeatmapSearch();
    if (advanced === null) return;
    if (!advanced) {
      applied = true;
      return;
    }
    const pref = getPreferredMode();
    if (pref == null) {
      applied = true;
      return;
    }
    const cur = new URLSearchParams(location.search).get("m");
    if (cur != null && cur !== "") {
      applied = true;
      return;
    }
    const el = findModeFilterItem(pref);
    if (!el) return;
    clickReplacingHistory(el);
    applied = true;
  };

  const stopWaiting = () => {
    ac.abort();
    applied = true;
  };

  tryApplyPreferred();
  if (!applied) {
    observe.subscribe(
      { schedule: 60, signal: ac.signal, label: "listing-mode/apply" },
      () => {
        tryApplyPreferred();
        if (applied) ac.abort();
      },
    );
  }
  const cap = window.setTimeout(stopWaiting, 20000);

  const onDocClick = (e) => {
    if (!isBeatmapsetsListing(location.pathname)) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest(FILTER_ITEM_SEL);
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!isModeFilterAnchor(a)) return;
    window.setTimeout(persistFromListingLocation, 200);
  };

  document.addEventListener("click", onDocClick, true);

  return () => {
    ac.abort();
    window.clearTimeout(cap);
    document.removeEventListener("click", onDocClick, true);
  };
}
