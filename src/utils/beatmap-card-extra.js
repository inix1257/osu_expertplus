/**
 * Extra lines on `.beatmapset-panel`: data only from page JSON / site `fetch` (no Expert+ API calls).
 * Profile beatmap tabs: initial data from `GET /users/{id}/extra-pages/beatmaps?mode=…` (section
 * buckets with `items`). **“Load more”** uses `GET /users/{id}/beatmapsets/{type}?limit=…&offset=…`
 * (same for `/api/v2/users/{id}/beatmapsets/{type}`). osu-web `UsersController::beatmapsets` types:
 * `favourite`, `ranked`, `loved`, `guest`, `nominated`, `graveyard`, `pending`, `most_played`, plus
 * deprecated `ranked_and_approved` → ranked and `unranked` → pending. Response is a JSON array
 * (beatmapsets, or playcounts for `most_played`) — hooked via fetch/XHR on the **page** window
 * (`unsafeWindow` under Tampermonkey); sandbox `window` XHR/fetch does not see osu’s jQuery.ajax.
 */

/* global unsafeWindow */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapCardExtra = (() => {
  const { el, manageStyle } = OsuExpertPlus.dom;

  /**
   * Tampermonkey isolates userscripts; osu-web’s `$.ajax` uses the page’s XMLHttpRequest.
   * @returns {Window & typeof globalThis}
   */
  function pageWin() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {
      void 0;
    }
    return window;
  }

  const STYLE_ID = "osu-expertplus-beatmap-card-extra-css";
  const BLOCK_CLASS = "oep-beatmap-card-extra";
  /** Per-mode star range after `.beatmapset-panel__extra-item--dots` (non-hover). */
  const STAR_RANGE_CLASS = "oep-beatmap-card-extra__star-range";
  /** Reserved row between artist and mapper; always same min height. */
  const SOURCE_SLOT_CLASS = "oep-beatmap-card-extra__source-slot";
  /** Set to beatmapset id when done, or "loading" while fetching. */
  const PANEL_STATE_ATTR = "data-oep-card-extra";
  /** Bumped whenever cache ingest runs; panel re-renders when this differs from the epoch stored on the panel. */
  const PANEL_CACHE_EPOCH_ATTR = "data-oep-card-extra-epoch";
  /** Present when source + BPM/length (extra metadata) was applied for current epoch. */
  const PANEL_RENDERED_META_ATTR = "data-oep-card-extra-meta";
  /** Present when star range chips were applied for current epoch. */
  const PANEL_RENDERED_STARS_ATTR = "data-oep-card-extra-stars";

  const style = manageStyle(
    STYLE_ID,
    `
    .beatmapset-panel:has(.${BLOCK_CLASS}),
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}),
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) {
      height: auto !important;
      min-height: var(--panel-height);
      overflow: visible;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__content {
      height: auto !important;
      min-height: var(--panel-height);
      align-items: stretch;
      overflow: visible;
      position: relative;
      z-index: 1;
      isolation: isolate;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__play-container,
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__menu-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__menu-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__menu-container {
      align-self: stretch;
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-col--info,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-col--info,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-col--info {
      align-self: stretch;
    }
    /* Cover link is a sibling before __content (abs. over the whole card). In-flow height comes only
       from __content; subpixel layout vs the panel translateZ(0) layer can show 1–2px of panel
       background at the rounded bottom. Match card radius, clip children, composited layer. */
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-container,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-container,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-container {
      top: 0 !important;
      bottom: 0 !important;
      height: auto !important;
      min-height: var(--panel-height);
      border-radius: inherit;
      overflow: hidden;
      transform: translateZ(0);
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__info,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__info {
      overflow: visible;
      align-self: stretch;
    }

    /* API source lives in our slot; hide osu’s row so we don’t get two lines. */
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info-row--source {
      display: none !important;
    }

    /* Match osu --source row; single line with ellipsis (flex min-width:0 so truncation works). */
    .beatmapset-panel__info-row.${SOURCE_SLOT_CLASS} {
      color: hsl(var(--hsl-c2));
      font-weight: 700;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-slot-line {
      box-sizing: border-box;
      flex: 1 1 0;
      min-width: 0;
      max-width: 100%;
      min-height: 1.35em;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-placeholder {
      display: inline-block;
    }

    /* Flush with neighbouring .beatmapset-panel__info-row (no extra band above BPM/length). */
    .${BLOCK_CLASS} {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      flex-shrink: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    .${BLOCK_CLASS}__source-text {
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 86%));
    }
    /* BPM / length: inherit font from panel; tune colour, spacing, shadow, truncation. */
    .${BLOCK_CLASS}__meta {
      margin: 0;
      padding: 0;
      max-width: 100%;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.03em;
      opacity: 0.9;
      color: hsl(var(--hsl-c2, 333 60% 68%));
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Max SR per mode: wrapper + one pill (spectrum by highest difficulty in that mode). */
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots .${STAR_RANGE_CLASS} {
      margin-left: 0.45em;
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: 0.2em;
      flex-shrink: 0;
      white-space: nowrap;
      line-height: 1;
      font-size: max(10px, 0.82em);
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      padding: 0.2em 0.62em;
      min-height: 14px;
      border-radius: 10000px;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      border: none;
      flex-shrink: 0;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-inner {
      display: inline-flex;
      align-items: stretch;
      flex-wrap: nowrap;
      column-gap: 0.1em;
      line-height: 1;
      color: inherit;
      min-width: 0;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-up {
      font-size: 0.58em;
      line-height: 1;
      color: inherit;
      opacity: 0.92;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-up::before {
      display: block;
      line-height: 1;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-icon {
      font-size: 0.72em;
      line-height: 1;
      color: inherit;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-icon::before {
      display: block;
      line-height: 1;
    }
    .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
      .${STAR_RANGE_CLASS}__chip-val {
      font-variant-numeric: tabular-nums;
      color: inherit;
      flex-shrink: 0;
      line-height: 1;
      display: flex;
      align-items: center;
    }
  `,
  );

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
   * @param {Request|string} input
   */
  function fetchInputUrl(input) {
    if (typeof input === "string") return input;
    if (input && typeof input === "object" && "url" in input)
      return String(/** @type {Request} */ (input).url);
    return "";
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

  /**
   * On SPA navigation to /beatmapsets, osu-web fires the initial search fetch before `pushState`,
   * so our hook is never installed in time to intercept it. Guard against double-fetching.
   */
  let listingSearchPrefetchStarted = false;

  /** ms to wait for site JSON/fetch to populate `cache` after panels appear. */
  const PROFILE_EXTRA_CACHE_WAIT_MS = 2000;
  const LISTING_CACHE_WAIT_MS = 1500;
  const CACHE_POLL_MS = 40;

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
    else if (bpms.length > 1)
      bpmStr = `${bpms[0]}–${bpms[bpms.length - 1]} BPM`;

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
    const m = icon.className.match(
      /\bfa-extra-mode-(osu|taiko|fruits|mania)\b/,
    );
    return m ? m[1] : null;
  }

  /**
   * Highest star rating per mode row (visible without hovering the popup).
   * @param {Element} panel
   * @param {object} data
   */
  function mountStarRanges(panel, data) {
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
        const nums = ratings.filter((n) => Number.isFinite(n));
        if (!nums.length) return;
        const hi = Math.max(...nums);
        const hiStr = formatStarShort(hi);
        if (!hiStr) return;

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
  function parseBeatmapsetId(panel) {
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
  function mountSourceSlot(panel, sourceTrimmed) {
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
  function insertTargetMeta(panel) {
    const mapperRow = panel.querySelector(
      ".beatmapset-panel__info-row--mapper",
    );
    if (mapperRow) return { anchor: mapperRow, mode: "after" };

    const sourceRow = panel.querySelector(
      ".beatmapset-panel__info-row--source",
    );
    if (sourceRow) return { anchor: sourceRow, mode: "after" };

    const artistRow = panel.querySelector(
      ".beatmapset-panel__info-row--artist",
    );
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
  function buildMetaBlock(data) {
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
  function stripInjections(panel) {
    panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
    panel.removeAttribute(PANEL_STATE_ATTR);
    panel.removeAttribute(PANEL_CACHE_EPOCH_ATTR);
    panel.removeAttribute(PANEL_RENDERED_META_ATTR);
    panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
  }

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
    if (!data) {
      const maxMs = profileExtraState.waitForExtraPages
        ? PROFILE_EXTRA_CACHE_WAIT_MS
        : LISTING_CACHE_WAIT_MS;
      data = await waitForCachedBeatmapset(id, maxMs, CACHE_POLL_MS);
    }

    if (!data) {
      if (document.body.contains(panel))
        panel.removeAttribute(PANEL_STATE_ATTR);
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
   * @param {ParentNode} root
   * @param {typeof OsuExpertPlus.settings} settings
   */
  function clearAll(root, settings) {
    const on =
      settings.isEnabled(settings.IDS.BEATMAP_CARD_EXTRA_INFO) ||
      settings.isEnabled(settings.IDS.BEATMAP_CARD_DIFFICULTY_RANGE);
    root.querySelectorAll(".beatmapset-panel").forEach((panel) => {
      if (!on) stripInjections(panel);
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
   * @param {string} url
   * @param {number} status
   * @param {string} responseText
   */
  function tryIngestFromNetworkJson(url, status, responseText) {
    if (status < 200 || status >= 300) return;
    let resolved;
    try {
      resolved = url.startsWith("http")
        ? url
        : new URL(url, location.origin).href;
    } catch (_) {
      return;
    }
    if (isUsersExtraPagesBeatmapsUrl(resolved)) {
      try {
        ingestExtraPagesBeatmapsPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    } else if (
      isUsersWebBeatmapsetsTypeUrl(resolved) ||
      isApiV2UsersBeatmapsetsTypeUrl(resolved)
    ) {
      try {
        ingestUserBeatmapsetsPaginatedPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    } else if (
      isBeatmapsetsSearchUrl(resolved) ||
      isApiV2BeatmapsetsSearchUrl(resolved)
    ) {
      try {
        ingestBeatmapsetsSearchPayload(JSON.parse(responseText));
      } catch (_) {
        void 0;
      }
    }
  }

  /**
   * osu-web often uses XMLHttpRequest for JSON; complements the `fetch` hook.
   * @returns {() => void}
   */
  /**
   * @param {() => boolean} wantIngest
   */
  function installXhrHook(wantIngest) {
    const w = pageWin();
    const Native = w.XMLHttpRequest;
    if (!Native) return () => {};

    function Patched() {
      const xhr = new Native();
      let reqUrl = "";
      const origOpen = xhr.open;
      xhr.open = function () {
        const u = arguments[1];
        reqUrl = typeof u === "string" ? u : String(u);
        return origOpen.apply(this, arguments);
      };
      xhr.addEventListener("load", function () {
        if (!wantIngest()) return;
        tryIngestFromNetworkJson(reqUrl, xhr.status, xhr.responseText);
      });
      return xhr;
    }

    Patched.prototype = Native.prototype;
    for (const k of [
      "UNSENT",
      "OPENED",
      "HEADERS_RECEIVED",
      "LOADING",
      "DONE",
    ]) {
      if (k in Native) Patched[k] = Native[k];
    }
    w.XMLHttpRequest = Patched;
    return () => {
      w.XMLHttpRequest = Native;
    };
  }

  /**
   * If the site already finished `extra-pages/beatmaps` before our hooks ran, load once with the
   * session cookie (same URL osu uses; not per-card API).
   */
  function startProfileExtraPagesPrefetchIfNeeded(wantIngest, nativeFetch) {
    if (!profileExtraState.waitForExtraPages) return;
    if (cache.size > 0) return;
    if (profileExtraPrefetchStarted) return;
    const m = location.pathname.match(/^\/users\/(\d+)/i);
    if (!m) return;
    const pw = pageWin();
    const doFetch =
      nativeFetch ||
      (typeof pw.fetch === "function" ? pw.fetch.bind(pw) : null);
    if (!doFetch) {
      return;
    }
    profileExtraPrefetchStarted = true;
    const userId = m[1];
    const mode = new URLSearchParams(location.search).get("mode") || "osu";
    const url = `/users/${userId}/extra-pages/beatmaps?mode=${encodeURIComponent(mode)}`;
    void (async () => {
      try {
        const r = await doFetch(url, {
          credentials: "include",
          headers: { Accept: "application/json" },
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
    const pw = pageWin();
    const doFetch =
      nativeFetch ||
      (typeof pw.fetch === "function" ? pw.fetch.bind(pw) : null);
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
  function start(settings, options = {}) {
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

    profileExtraState.waitForExtraPages =
      options.hookProfileExtraPages === true;
    profileExtraPrefetchStarted = false;
    listingSearchPrefetchStarted = false;

    /** @type {typeof window.fetch | null} */
    let origFetch = null;
    const uninstallXhrHook = installXhrHook(wantIngest);
    const pageContext = pageWin();

    if (typeof pageContext.fetch === "function") {
      origFetch = pageContext.fetch.bind(pageContext);
      pageContext.fetch = async function oepPatchedFetch(input, init) {
        const res = await origFetch(input, init);
        if (!wantIngest()) return res;
        try {
          const url = fetchInputUrl(input);
          if (!url || !res.ok) {
            return res;
          }
          if (isUsersExtraPagesBeatmapsUrl(url)) {
            void res
              .clone()
              .json()
              .then(ingestExtraPagesBeatmapsPayload)
              .catch(() => {});
          } else if (
            isUsersWebBeatmapsetsTypeUrl(url) ||
            isApiV2UsersBeatmapsetsTypeUrl(url)
          ) {
            void res
              .clone()
              .json()
              .then(ingestUserBeatmapsetsPaginatedPayload)
              .catch(() => {});
          } else if (
            isBeatmapsetsSearchUrl(url) ||
            isApiV2BeatmapsetsSearchUrl(url)
          ) {
            void res
              .clone()
              .json()
              .then(ingestBeatmapsetsSearchPayload)
              .catch(() => {});
          }
        } catch (_) {
          void 0;
        }
        return res;
      };
    }

    const run = () => {
      const on = wantIngest();
      if (on) style.inject();
      else style.remove();
      clearAll(document, settings);
      if (on) {
        ingestFromJsonBeatmapsScript();
        startProfileExtraPagesPrefetchIfNeeded(wantIngest, origFetch);
        startListingSearchPrefetchIfNeeded(wantIngest, origFetch);
        connectJsonBeatmapsObserver();
        scheduleAllPanels(document, settings);
      } else {
        disconnectJsonBeatmapsObserver();
      }
      syncPopupHighlightHeight();
    };

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
      listingSearchPrefetchStarted = false;
      scheduleAfterIngest = () => {};
      uninstallXhrHook();
      if (origFetch) pageContext.fetch = origFetch;
      style.remove();
      document.querySelectorAll(".beatmapset-panel").forEach((panel) => {
        stripInjections(panel);
      });
    };
  }

  return { start };
})();
