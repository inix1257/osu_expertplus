/**
 * Extra lines on `.beatmapset-panel` (source, BPM / length, star range),
 * from the beatmapset JSON the site itself loads (WS-50).
 *
 * Profile beatmap tabs: initial data from `GET /users/{id}/extra-pages/beatmaps?mode=…`
 * (section buckets with `items`). "Load more" uses
 * `GET /users/{id}/beatmapsets/{type}?limit=…&offset=…` (same for
 * `/api/v2/users/{id}/beatmapsets/{type}`). osu-web `UsersController::beatmapsets`
 * types: `favourite`, `ranked`, `loved`, `guest`, `nominated`, `graveyard`,
 * `pending`, `most_played`, plus deprecated `ranked_and_approved` → ranked and
 * `unranked` → pending. The response is a JSON array (beatmapsets, or playcounts
 * for `most_played`), read from the page window's fetch/XHR through
 * `core/page-hooks` (osu-web's jQuery.ajax uses the page XHR).
 */

import * as pageHooks from "../../core/page-hooks.js";
import {
  buildMetaBlock,
  insertTargetMeta,
  mountSourceSlot,
  mountStarRanges,
  parseBeatmapsetId,
  stripInjections,
} from "./extra-render.js";
import {
  BLOCK_CLASS,
  PANEL_CACHE_EPOCH_ATTR,
  PANEL_RENDERED_META_ATTR,
  PANEL_RENDERED_STARS_ATTR,
  PANEL_STATE_ATTR,
  SOURCE_SLOT_CLASS,
  STAR_RANGE_CLASS,
  style,
} from "./extra-styles.js";
/** @type {Map<string, object>} */
const cache = new Map();

/** Debounced refresh after cache ingest (fetch hook or json-beatmaps). Set by `start()`. */
let scheduleAfterIngest = () => {};

/** Incremented on each ingest that writes to `cache`, so panels re-apply metadata when site data updates. */
let cacheEpoch = 0;

/** Bumped when a new `scheduleAllPanels` run starts; stale rAF chunks exit without work. */
let schedulePanelsToken = 0;

/** Max `.beatmapset-panel` processed per frame so toggles / MO don’t freeze the main thread. */
const PANEL_SCHEDULE_CHUNK = 28;

function touchCacheFromIngest() {
  cacheEpoch++;
  scheduleAfterIngest();
}

/**
 * Merge beatmapset objects from `…/extra-pages/beatmaps` into `cache` (keyed by set id).
 * Payload shape: each top-level value with `.items` is treated as a section bucket (ranked, loved, …).
 * @param {unknown} json
 */
function ingestExtraPagesBeatmapsPayload(json) {
  if (!json || typeof json !== "object") {
    return;
  }
  let added = false;
  for (const key of Object.keys(
    /** @type {Record<string, unknown>} */ (json),
  )) {
    const bucket = /** @type {Record<string, unknown>} */ (json)[key];
    if (!bucket || typeof bucket !== "object") continue;
    const items = bucket.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && item.id != null) {
        cache.set(String(item.id), item);
        added = true;
      }
    }
  }
  if (added) touchCacheFromIngest();
}

/**
 * @param {unknown} item
 * @returns {boolean}
 */
function cacheBeatmapsetFromListItem(item) {
  if (!item || typeof item !== "object") return false;
  const nested = /** @type {Record<string, unknown>} */ (item).beatmapset;
  if (nested && typeof nested === "object" && nested.id != null) {
    cache.set(String(nested.id), nested);
    return true;
  }
  if (/** @type {Record<string, unknown>} */ (item).id != null) {
    cache.set(String(item.id), item);
    return true;
  }
  return false;
}

/**
 * `GET /users/{id}/beatmapsets/{type}` (profile “load more”) returns a JSON **array** of
 * beatmapsets, or `{ beatmapsets: [...] }`. `most_played` entries may nest under `.beatmapset`.
 * @param {unknown} json
 */
function ingestUserBeatmapsetsPaginatedPayload(json) {
  if (json == null) return;
  /** @type {unknown[]|null} */
  let list = null;
  if (Array.isArray(json)) list = json;
  else if (typeof json === "object") {
    const b = /** @type {Record<string, unknown>} */ (json).beatmapsets;
    if (Array.isArray(b)) list = b;
  }
  if (!list) return;
  let added = false;
  for (const item of list) {
    if (cacheBeatmapsetFromListItem(item)) added = true;
  }
  if (added) touchCacheFromIngest();
}

/**
 * `/beatmapsets/search` and `/api/v2/beatmapsets/search` return `{ beatmapsets: [...] }`.
 * @param {unknown} json
 */
function ingestBeatmapsetsSearchPayload(json) {
  if (!json || typeof json !== "object") {
    return;
  }
  const list = /** @type {Record<string, unknown>} */ (json).beatmapsets;
  if (!Array.isArray(list)) {
    return;
  }
  let added = false;
  for (const item of list) {
    if (item && item.id != null) {
      cache.set(String(item.id), item);
      added = true;
    }
  }
  if (added) touchCacheFromIngest();
}

/**
 * @param {string} s
 * @returns {string}
 */
function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Initial listing data: `<script id="json-beatmaps" type="application/json">`.
 * Re-parses when the script body changes (Turbo / in-place updates); avoid a one-shot flag.
 *
 * SPA navigations often fill this tag by updating the script’s text node. The document-level
 * `MutationObserver` in `start()` only uses `childList`/`subtree`, so those text updates do not
 * run `ingestFromJsonBeatmapsScript` unless we observe this node with `characterData: true`.
 */
function ingestFromJsonBeatmapsScript() {
  const n = document.getElementById("json-beatmaps");
  if (!n?.textContent) {
    return;
  }
  const raw = n.textContent.trim();
  const sig = `${raw.length}:${shortHash(raw)}`;
  if (n.getAttribute("data-oep-beatmaps-sig") === sig) {
    return;
  }
  try {
    ingestBeatmapsetsSearchPayload(JSON.parse(raw));
    n.setAttribute("data-oep-beatmaps-sig", sig);
  } catch (_) {
    void 0;
  }
}

/**
 * @param {string} url
 */
function isUsersExtraPagesBeatmapsUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return /\/users\/\d+\/extra-pages\/beatmaps\b/.test(u.pathname);
  } catch (_) {
    return false;
  }
}

/**
 * Web: `/users/{id}/beatmapsets/{type}` (`type` = favourite, ranked, loved, guest, nominated,
 * graveyard, pending, most_played, ranked_and_approved, unranked — see osu-web UsersController).
 * @param {string} url
 */
function isUsersWebBeatmapsetsTypeUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return /\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(u.pathname);
  } catch (_) {
    return false;
  }
}

/**
 * API v2: `/api/v2/users/{id}/beatmapsets/{type}`.
 * @param {string} url
 */
function isApiV2UsersBeatmapsetsTypeUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return /\/api\/v2\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(
      u.pathname,
    );
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} url
 */
function isBeatmapsetsSearchUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return /\/beatmapsets\/search\/?$/i.test(u.pathname);
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} url
 */
function isApiV2BeatmapsetsSearchUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return /\/api\/v2\/beatmapsets\/search\/?$/i.test(u.pathname);
  } catch (_) {
    return false;
  }
}

/**
 * @param {string} id
 * @param {number} maxMs
 * @param {number} stepMs
 * @returns {Promise<object|undefined>}
 */
function waitForCachedBeatmapset(id, maxMs, stepMs) {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  const deadline = Date.now() + maxMs;
  return new Promise((resolve) => {
    const tick = () => {
      const h = cache.get(id);
      if (h) {
        resolve(h);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(undefined);
        return;
      }
      window.setTimeout(tick, stepMs);
    };
    tick();
  });
}

/** When true, `processPanel` waits longer for profile extra-pages before giving up. */
const profileExtraState = { waitForExtraPages: false };

/** One-shot same-origin prefetch if hooks missed the site’s first request (script load timing). */
let profileExtraPrefetchStarted = false;
/** @type {(() => boolean)|null}  Set by `start()`; the prefetch only runs when a card needs it. */
let profileExtraPrefetchWantIngest = null;

/**
 * On SPA navigation to /beatmapsets, osu-web fires the initial search fetch before `pushState`,
 * so our hook is never installed in time to intercept it. Guard against double-fetching.
 */
let listingSearchPrefetchStarted = false;

/** ms to wait for site JSON/fetch to populate `cache` after panels appear. */
const PROFILE_EXTRA_CACHE_WAIT_MS = 2000;
/** How long a profile card waits for the hooked site response before we fetch it ourselves. */
const PROFILE_EXTRA_HOOK_GRACE_MS = 1000;
const LISTING_CACHE_WAIT_MS = 1500;
const CACHE_POLL_MS = 40;

/**
 * @param {Element} panel
 * @param {typeof OsuExpertPlus.settings} settings
 */
async function processPanel(panel, settings) {
  const wantMeta = settings.isEnabled(settings.IDS.BEATMAP_CARD_EXTRA_INFO);
  const wantStars = settings.isEnabled(
    settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE,
  );
  if (!wantMeta && !wantStars) {
    return;
  }

  const id = parseBeatmapsetId(panel);
  if (!id) {
    return;
  }

  const state = panel.getAttribute(PANEL_STATE_ATTR);
  const renderedEpoch = panel.getAttribute(PANEL_CACHE_EPOCH_ATTR);
  const hasMeta = panel.getAttribute(PANEL_RENDERED_META_ATTR) === "1";
  const hasStars = panel.getAttribute(PANEL_RENDERED_STARS_ATTR) === "1";
  // Must match desired toggles: `(!wantMeta || hasMeta)` was always true when meta off, so stale
  // source/BPM stayed after turning off only one of two options.
  if (
    state === id &&
    renderedEpoch != null &&
    renderedEpoch === String(cacheEpoch) &&
    wantMeta === hasMeta &&
    wantStars === hasStars
  ) {
    return;
  }
  if (state === id) panel.removeAttribute(PANEL_STATE_ATTR);
  if (panel.getAttribute(PANEL_STATE_ATTR) === "loading") return;

  panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
  panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
  panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
  panel.removeAttribute(PANEL_RENDERED_META_ATTR);
  panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
  panel.setAttribute(PANEL_STATE_ATTR, "loading");

  let data = cache.get(id);
  if (!data && profileExtraState.waitForExtraPages) {
    // Profile cards are rendered from the site's own extra-pages response, which the
    // hooks normally ingest; only fetch it ourselves if that response was missed.
    data = await waitForCachedBeatmapset(
      id,
      PROFILE_EXTRA_HOOK_GRACE_MS,
      CACHE_POLL_MS,
    );
    if (!data) {
      startProfileExtraPagesPrefetchIfNeeded();
      data = await waitForCachedBeatmapset(
        id,
        PROFILE_EXTRA_CACHE_WAIT_MS,
        CACHE_POLL_MS,
      );
    }
  } else if (!data) {
    data = await waitForCachedBeatmapset(
      id,
      LISTING_CACHE_WAIT_MS,
      CACHE_POLL_MS,
    );
  }

  if (!data) {
    if (document.body.contains(panel)) panel.removeAttribute(PANEL_STATE_ATTR);
    return;
  }

  if (!document.body.contains(panel)) return;

  if (wantMeta) {
    const sourceTrimmed = String(data.source ?? "").trim();
    mountSourceSlot(panel, sourceTrimmed);

    const block = buildMetaBlock(data);
    if (block) {
      const { anchor, mode } = insertTargetMeta(panel);
      if (mode === "after") anchor.insertAdjacentElement("afterend", block);
      else anchor.appendChild(block);
    }
    panel.setAttribute(PANEL_RENDERED_META_ATTR, "1");
  }

  if (wantStars) {
    mountStarRanges(panel, data);
    panel.setAttribute(PANEL_RENDERED_STARS_ATTR, "1");
  }

  panel.setAttribute(PANEL_STATE_ATTR, id);
  panel.setAttribute(PANEL_CACHE_EPOCH_ATTR, String(cacheEpoch));
}

/**
 * Removes injected extras from every panel (both card features are off).
 * @param {ParentNode} root
 */
function stripAllPanels(root) {
  root.querySelectorAll(".beatmapset-panel").forEach((panel) => {
    stripInjections(panel);
  });
}

/**
 * @param {ParentNode} root
 * @param {typeof OsuExpertPlus.settings} settings
 */
function scheduleAllPanels(root, settings) {
  const panels = Array.from(root.querySelectorAll(".beatmapset-panel"));
  if (panels.length === 0) {
    return;
  }
  const token = ++schedulePanelsToken;
  let index = 0;
  const step = () => {
    if (token !== schedulePanelsToken) {
      return;
    }
    const end = Math.min(index + PANEL_SCHEDULE_CHUNK, panels.length);
    while (index < end) {
      void processPanel(panels[index++], settings);
    }
    if (index < panels.length) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

/**
 * Picks the ingest function for a page JSON response URL (search, user
 * beatmapsets, profile extra pages), or null.
 * @param {string} url  absolute URL
 * @returns {((json: any) => void) | null}
 */
function ingestorForUrl(url) {
  if (isUsersExtraPagesBeatmapsUrl(url)) return ingestExtraPagesBeatmapsPayload;
  if (isUsersWebBeatmapsetsTypeUrl(url) || isApiV2UsersBeatmapsetsTypeUrl(url))
    return ingestUserBeatmapsetsPaginatedPayload;
  if (isBeatmapsetsSearchUrl(url) || isApiV2BeatmapsetsSearchUrl(url))
    return ingestBeatmapsetsSearchPayload;
  return null;
}

/**
 * If the site already finished `extra-pages/beatmaps` before our hooks ran, load once with the
 * session cookie (same URL osu uses; not per-card API). Called lazily from `processPanel`.
 */
function startProfileExtraPagesPrefetchIfNeeded() {
  const wantIngest = profileExtraPrefetchWantIngest;
  if (!wantIngest || !wantIngest()) return;
  if (!profileExtraState.waitForExtraPages) return;
  if (cache.size > 0) return;
  if (profileExtraPrefetchStarted) return;
  const m = location.pathname.match(
    /^\/users\/(\d+)(?:\/(osu|taiko|fruits|mania))?\/?$/i,
  );
  if (!m) return;
  profileExtraPrefetchStarted = true;
  const userId = m[1];
  const mode =
    m[2] || new URLSearchParams(location.search).get("mode") || "osu";
  void (async () => {
    try {
      const r = await OsuExpertPlus.api.fetchUserExtraPage(userId, "beatmaps", {
        mode,
      });
      if (!wantIngest()) return;
      if (!r.ok) {
        return;
      }
      ingestExtraPagesBeatmapsPayload(await r.json());
    } catch (_) {
      void 0;
    }
  })();
}

/**
 * On SPA navigation to /beatmapsets, osu-web issues the initial search fetch as part of its own
 * routing — before calling pushState, and therefore before our hook is installed. Re-fetch the
 * first page ourselves so the cache is populated for already-visible panels.
 * @param {() => boolean} wantIngest
 * @param {typeof window.fetch | null} nativeFetch
 */
function startListingSearchPrefetchIfNeeded(wantIngest, nativeFetch) {
  if (!wantIngest()) return;
  if (!/^\/beatmapsets(?:\/?)(?!\d)/i.test(location.pathname)) return;
  if (listingSearchPrefetchStarted) return;
  // If #json-beatmaps has content the page was SSR-rendered; first-page data is already ingested.
  const n = document.getElementById("json-beatmaps");
  if (n?.textContent?.trim()) return;
  const doFetch = nativeFetch;
  if (!doFetch) return;
  listingSearchPrefetchStarted = true;
  const params = new URLSearchParams(location.search);
  params.delete("cursor_string");
  const qs = params.toString();
  const url = `/beatmapsets/search${qs ? "?" + qs : ""}`;
  void (async () => {
    try {
      const r = await doFetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!wantIngest()) return;
      if (!r.ok) return;
      ingestBeatmapsetsSearchPayload(await r.json());
    } catch (_) {
      void 0;
    }
  })();
}

/**
 * @param {typeof OsuExpertPlus.settings} settings
 * @param {{ hookProfileExtraPages?: boolean }} [options]
 * @returns {() => void}
 */
export function start(settings, options = {}) {
  const ID_META = settings.IDS.BEATMAP_CARD_EXTRA_INFO;
  const ID_STARS = settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE;
  const wantIngest = () =>
    settings.isEnabled(ID_META) || settings.isEnabled(ID_STARS);
  let moDebounceId = 0;
  let moMaxWaitId = 0;
  const MO_DEBOUNCE_MS = 100;
  /** Ensures `run()` eventually fires when the subtree mutates continuously (React). */
  const MO_MAX_WAIT_MS = 450;
  let ingestPanelsId = 0;

  /** @type {MutationObserver|null} */
  let jsonBeatmapsMo = null;
  /** @type {Element|null} */
  let jsonBeatmapsObserved = null;
  let jsonBeatmapsTextMutDeb = 0;

  function disconnectJsonBeatmapsObserver() {
    window.clearTimeout(jsonBeatmapsTextMutDeb);
    jsonBeatmapsTextMutDeb = 0;
    try {
      jsonBeatmapsMo?.disconnect();
    } catch (_) {
      void 0;
    }
    jsonBeatmapsMo = null;
    jsonBeatmapsObserved = null;
  }

  function connectJsonBeatmapsObserver() {
    if (!wantIngest()) {
      disconnectJsonBeatmapsObserver();
      return;
    }
    const n = document.getElementById("json-beatmaps");
    if (!n) {
      disconnectJsonBeatmapsObserver();
      return;
    }
    if (jsonBeatmapsObserved === n && jsonBeatmapsMo) return;
    disconnectJsonBeatmapsObserver();
    jsonBeatmapsObserved = n;
    jsonBeatmapsMo = new MutationObserver(() => {
      if (!wantIngest()) return;
      window.clearTimeout(jsonBeatmapsTextMutDeb);
      jsonBeatmapsTextMutDeb = window.setTimeout(() => {
        jsonBeatmapsTextMutDeb = 0;
        ingestFromJsonBeatmapsScript();
        scheduleAfterIngest();
      }, 0);
    });
    jsonBeatmapsMo.observe(n, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  profileExtraState.waitForExtraPages = options.hookProfileExtraPages === true;
  profileExtraPrefetchStarted = false;
  listingSearchPrefetchStarted = false;

  const removeJsonListener = pageHooks.addJsonResponseListener({
    match: (url) => wantIngest() && ingestorForUrl(url) !== null,
    onJson: (url, json) => ingestorForUrl(url)?.(json),
  });

  const run = () => {
    const on = wantIngest();
    if (on) style.inject();
    else style.remove();
    if (!on) stripAllPanels(document);
    if (on) {
      ingestFromJsonBeatmapsScript();
      profileExtraPrefetchWantIngest = wantIngest;
      startListingSearchPrefetchIfNeeded(wantIngest, pageHooks.nativeFetch());
      connectJsonBeatmapsObserver();
      scheduleAllPanels(document, settings);
    } else {
      disconnectJsonBeatmapsObserver();
    }
    syncPopupHighlightHeight();
    scheduleBeatmapsetsListingLayoutSync();
  };

  /** @type {ResizeObserver|null} */
  let beatmapsetsListingItemsRo = null;
  /** @type {Element|null} */
  let beatmapsetsListingItemsObserved = null;

  function detachBeatmapsetsListingItemsRo() {
    if (beatmapsetsListingItemsRo) {
      beatmapsetsListingItemsRo.disconnect();
      beatmapsetsListingItemsRo = null;
      beatmapsetsListingItemsObserved = null;
    }
  }

  function isBeatmapsetsListingIndexPage() {
    const p = location.pathname;
    return p === "/beatmapsets" || p === "/beatmapsets/";
  }

  /**
   * Listing uses a virtual list: the first child of `.beatmapsets__content` gets an inline
   * `height` from osu-web from row count × assumed row height. Extra card rows increase real
   * content height without updating that value, so the b5 page background shows past the block.
   */
  function syncBeatmapsetsListingOuterHeight(outer, items) {
    if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement))
      return;
    const st = outer.getAttribute("style") || "";
    if (!/height\s*:\s*[\d.]+\s*px/i.test(st)) return;
    const cs = getComputedStyle(outer);
    const padY =
      (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const minOuter = Math.ceil(items.scrollHeight + padY);
    if (minOuter > outer.clientHeight + 0.5) {
      outer.style.height = `${minOuter}px`;
    }
  }

  function maybeAttachBeatmapsetsListingHeightObserver() {
    if (!wantIngest()) {
      detachBeatmapsetsListingItemsRo();
      return;
    }
    if (!isBeatmapsetsListingIndexPage()) {
      detachBeatmapsetsListingItemsRo();
      return;
    }
    const content = document.querySelector(".beatmapsets__content");
    const outer = content?.firstElementChild;
    const items = outer?.querySelector?.(".beatmapsets__items");
    if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement)) {
      detachBeatmapsetsListingItemsRo();
      return;
    }
    if (
      beatmapsetsListingItemsObserved === items &&
      beatmapsetsListingItemsRo
    ) {
      syncBeatmapsetsListingOuterHeight(outer, items);
      return;
    }
    detachBeatmapsetsListingItemsRo();
    beatmapsetsListingItemsObserved = items;
    beatmapsetsListingItemsRo = new ResizeObserver(() => {
      syncBeatmapsetsListingOuterHeight(outer, items);
    });
    beatmapsetsListingItemsRo.observe(items);
    syncBeatmapsetsListingOuterHeight(outer, items);
  }

  function scheduleBeatmapsetsListingLayoutSync() {
    if (!wantIngest()) {
      detachBeatmapsetsListingItemsRo();
      return;
    }
    if (!isBeatmapsetsListingIndexPage()) {
      detachBeatmapsetsListingItemsRo();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        maybeAttachBeatmapsetsListingHeightObserver();
      });
    });
  }

  /**
   * osu-web's difficulty popup (`.beatmaps-popup`, rendered via Portal) draws a highlight border
   * using `::before { height: calc(100% + var(--panel-height)) }`. `--panel-height` is a fixed
   * CSS variable set on `.beatmaps-popup` itself, so it doesn't account for our injected rows.
   * Sync the popup's `--panel-height` to the actual rendered height of the hovered panel.
   */
  function syncPopupHighlightHeight() {
    const activePanel = document.querySelector(
      ".beatmapset-panel--beatmaps-popup-visible",
    );
    const popup = document.querySelector(".beatmaps-popup");
    if (!activePanel || !popup) return;
    const actual = /** @type {HTMLElement} */ (activePanel).offsetHeight;
    if (actual > 0) {
      popup.style.setProperty("--panel-height", actual + "px");
    }
  }

  /**
   * DOM mutations (including our injections) were calling full `run()` via MO, re-scanning every
   * panel and re-running ingest on a hot path. Only refresh listing JSON + panel pass.
   */
  const refreshAfterDomMutation = () => {
    if (!wantIngest()) {
      return;
    }
    connectJsonBeatmapsObserver();
    ingestFromJsonBeatmapsScript();
    scheduleAllPanels(document, settings);
    syncPopupHighlightHeight();
    scheduleBeatmapsetsListingLayoutSync();
  };

  const flushMoSchedule = () => {
    window.clearTimeout(moDebounceId);
    moDebounceId = 0;
    window.clearTimeout(moMaxWaitId);
    moMaxWaitId = 0;
    refreshAfterDomMutation();
  };

  /**
   * @param {MutationRecord[]} mutations
   */
  const scheduleFromMutationObserver = (mutations) => {
    if (!wantIngest()) {
      return;
    }
    // MutationObserver callbacks fire before the next browser paint, so syncing immediately here
    // corrects --panel-height on the popup before its opacity transition becomes visible (no flash).
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = /** @type {Element} */ (node);
        if (
          el.classList.contains("beatmaps-popup") ||
          el.querySelector(".beatmaps-popup")
        ) {
          syncPopupHighlightHeight();
          break;
        }
      }
    }
    window.clearTimeout(moDebounceId);
    moDebounceId = window.setTimeout(flushMoSchedule, MO_DEBOUNCE_MS);
    if (!moMaxWaitId) {
      moMaxWaitId = window.setTimeout(flushMoSchedule, MO_MAX_WAIT_MS);
    }
  };

  /**
   * Must not share the MO debounce timer: continuous DOM mutations can reset it forever and
   * block `run()` after XHR ingest (e.g. profile “load more”).
   */
  scheduleAfterIngest = () => {
    window.clearTimeout(ingestPanelsId);
    ingestPanelsId = window.setTimeout(() => {
      ingestPanelsId = 0;
      if (!wantIngest()) return;
      requestAnimationFrame(() => {
        if (!wantIngest()) return;
        scheduleAllPanels(document, settings);
        scheduleBeatmapsetsListingLayoutSync();
      });
    }, 0);
  };

  run();

  const unsubMeta = settings.onChange(ID_META, run);
  const unsubStars = settings.onChange(ID_STARS, run);
  const mo = new MutationObserver(scheduleFromMutationObserver);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    window.clearTimeout(moDebounceId);
    window.clearTimeout(moMaxWaitId);
    window.clearTimeout(ingestPanelsId);
    disconnectJsonBeatmapsObserver();
    unsubMeta();
    unsubStars();
    mo.disconnect();
    profileExtraState.waitForExtraPages = false;
    profileExtraPrefetchStarted = false;
    profileExtraPrefetchWantIngest = null;
    listingSearchPrefetchStarted = false;
    scheduleAfterIngest = () => {};
    detachBeatmapsetsListingItemsRo();
    removeJsonListener();
    style.remove();
    document.querySelectorAll(".beatmapset-panel").forEach((panel) => {
      stripInjections(panel);
    });
  };
}
