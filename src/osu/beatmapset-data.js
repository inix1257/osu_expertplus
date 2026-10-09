/**
 * Beatmapset page data: the `#json-beatmapset` payload (memoized), the
 * selected beatmap and ruleset, difficulty-picker links and beatmapset ids.
 *
 * DOM readers take `{ document, location }` options so tests can pass a jsdom
 * window; by default they read the `document` / `location` globals (the same
 * bindings the legacy scripts see) at call time.
 */

import {
  normalizeRuleset,
  RULESET_HASH_RE,
  RULESET_PATTERN,
} from "./ruleset.js";

/** @typedef {import("./ruleset.js").Ruleset} Ruleset */
/** @typedef {{ document?: Document, location?: Location|URL }} PageContext */

export const ACTIVE_PICKER_SELECTOR =
  "a.beatmapset-beatmap-picker__beatmap--active";

/**
 * @param {PageContext} [ctx]
 * @returns {{ doc: Document|undefined, loc: Location|URL|undefined }}
 */
function resolve(ctx = {}) {
  return {
    doc:
      ctx.document ?? (typeof document !== "undefined" ? document : undefined),
    loc:
      ctx.location ?? (typeof location !== "undefined" ? location : undefined),
  };
}

/** @type {{ node: Element, length: number, pathname: string, value: any }|null} */
let jsonCache = null;

/**
 * Parsed `#json-beatmapset`, or null when missing, empty or invalid.
 *
 * Memoized on the script node itself, its `textContent.length` and
 * `location.pathname`: osu-web replaces the node (or its text) on navigation,
 * and a pathname change always re-reads. The returned object is shared
 * between callers; do not mutate it.
 * @param {PageContext} [ctx]
 * @returns {any}
 */
export function readBeatmapsetJson(ctx) {
  const { doc, loc } = resolve(ctx);
  const node = doc?.querySelector?.("#json-beatmapset") ?? null;
  if (!node) {
    jsonCache = null;
    return null;
  }
  const text = node.textContent ?? "";
  const pathname = String(loc?.pathname ?? "");
  if (
    jsonCache &&
    jsonCache.node === node &&
    jsonCache.length === text.length &&
    jsonCache.pathname === pathname
  ) {
    return jsonCache.value;
  }
  const raw = text.trim();
  let value = null;
  if (raw) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  jsonCache = { node, length: text.length, pathname, value };
  return value;
}

/** Drops the {@link readBeatmapsetJson} cache (tests, forced re-read). */
export function clearBeatmapsetJsonCache() {
  jsonCache = null;
}

/**
 * Ruleset and beatmap id from a `#osu/123` hash (start of string).
 * @param {string|null|undefined} hash  `location.hash`
 * @returns {{ ruleset: Ruleset, beatmapId: number }|null}
 */
export function parseBeatmapHash(hash) {
  const m = RULESET_HASH_RE.exec(String(hash ?? ""));
  if (!m) return null;
  return {
    ruleset: /** @type {Ruleset} */ (m[1].toLowerCase()),
    beatmapId: Number(m[2]),
  };
}

const PICKER_KNOWN_RE = new RegExp(`#(${RULESET_PATTERN})\\/(\\d+)`, "i");
const PICKER_ANY_END_RE = /#([a-z]+)\/(\d+)\s*$/i;
const BEATMAP_PATH_RE = /\/beatmaps\/(\d+)/;

/**
 * @typedef {object} PickerHrefOptions
 * @property {"known"|"any-end"} [match]
 *   `"known"` (default): `#osu/123` with one of the four rulesets, anywhere in
 *   the href (beatmap-detail `getBeatmapPageBeatmapId`).
 *   `"any-end"`: `#<letters>/123` at the very end (beatmap-detail
 *   `parseBeatmapIdFromPickerLink`); `ruleset` is null for unknown words.
 * @property {boolean} [pathFallback]  default true: fall back to
 *   `/beatmaps/123` (`beatmapIdFromPickerAnchor`); `ruleset` is then null
 */

/**
 * Beatmap id (and ruleset) from a difficulty-picker href.
 * @param {string|null|undefined} href
 * @param {PickerHrefOptions} [options]
 * @returns {{ ruleset: Ruleset|null, beatmapId: number }|null}
 */
export function parsePickerHref(href, options = {}) {
  const s = String(href ?? "");
  if (!s) return null;
  const re = options.match === "any-end" ? PICKER_ANY_END_RE : PICKER_KNOWN_RE;
  const m = re.exec(s);
  if (m) return { ruleset: normalizeRuleset(m[1]), beatmapId: Number(m[2]) };
  if (options.pathFallback === false) return null;
  const p = BEATMAP_PATH_RE.exec(s);
  return p ? { ruleset: null, beatmapId: Number(p[1]) } : null;
}

/**
 * @param {Document|undefined} doc
 * @returns {string}
 */
function activePickerHref(doc) {
  const a = doc?.querySelector?.(ACTIVE_PICKER_SELECTOR);
  return a ? a.getAttribute("href") || "" : "";
}

/**
 * Ruleset of the selected difficulty: URL hash, else the active picker link
 * (its hash, or its `/beatmaps/<id>` looked up in the beatmapset JSON), else
 * `"osu"`. Port of beatmap-detail `getBeatmapPageRuleset`.
 * @param {PageContext} [ctx]
 * @returns {Ruleset}
 */
export function getCurrentRuleset(ctx) {
  const { doc, loc } = resolve(ctx);
  const fromHash = String(loc?.hash ?? "").match(
    new RegExp(`^#(${RULESET_PATTERN})\\/`, "i"),
  );
  if (fromHash) return /** @type {Ruleset} */ (fromHash[1].toLowerCase());
  const href = activePickerHref(doc);
  if (href) {
    const m = href.match(new RegExp(`#(${RULESET_PATTERN})\\/`, "i"));
    if (m) return /** @type {Ruleset} */ (m[1].toLowerCase());
    const p = BEATMAP_PATH_RE.exec(href);
    if (p) {
      const id = Number(p[1]);
      const found = readBeatmapsetJson(ctx)?.beatmaps?.find?.(
        (b) => b.id === id,
      );
      if (found?.mode) {
        return /** @type {Ruleset} */ (String(found.mode).toLowerCase());
      }
    }
  }
  return "osu";
}

/**
 * Id of the selected difficulty: URL hash, else the active picker link, else
 * the first beatmap of the current ruleset (or the first beatmap) in the
 * beatmapset JSON. Port of beatmap-detail `getBeatmapPageBeatmapId`, which
 * returned a string.
 * @param {PageContext} [ctx]
 * @returns {number|null}
 */
export function getCurrentBeatmapId(ctx) {
  const { doc, loc } = resolve(ctx);
  const fromHash = parseBeatmapHash(loc?.hash);
  if (fromHash) return fromHash.beatmapId;

  const href = activePickerHref(doc);
  if (href) {
    const fromPicker = parsePickerHref(href);
    if (fromPicker) return fromPicker.beatmapId;
  }

  const data = readBeatmapsetJson(ctx);
  if (Array.isArray(data?.beatmaps) && data.beatmaps.length) {
    const mode = getCurrentRuleset(ctx);
    const bm = data.beatmaps.find((b) => b.mode === mode) || data.beatmaps[0];
    if (bm?.id != null) return Number(bm.id);
  }
  return null;
}

const BEATMAPSET_PATH_RE = /^\/beatmapsets\/(\d+)/i;
const BEATMAPSET_ANYWHERE_RE = /\/beatmapsets\/(\d+)/;

/**
 * Beatmapset id from a link.
 *
 * `match: "pathname"` (default): the href is resolved against `base` and its
 * pathname must start with `/beatmapsets/<id>` (beatmap-card-extra
 * `parseBeatmapsetId`). `match: "anywhere"`: `/beatmapsets/<id>` anywhere in
 * the raw string (user-profile `getRanksRowBeatmapsetId`).
 * @param {string|null|undefined} href
 * @param {{ match?: "pathname"|"anywhere", base?: string }} [options]
 *   `base` defaults to `location.origin`, then `https://osu.ppy.sh`
 * @returns {number|null}
 */
export function beatmapsetIdFromHref(href, options = {}) {
  const s = String(href ?? "");
  if (!s) return null;
  if (options.match === "anywhere") {
    const m = BEATMAPSET_ANYWHERE_RE.exec(s);
    return m ? Number(m[1]) : null;
  }
  const base =
    options.base ??
    (typeof location !== "undefined" ? location.origin : undefined) ??
    "https://osu.ppy.sh";
  let pathname;
  try {
    pathname = new URL(s, base).pathname;
  } catch {
    return null;
  }
  const m = BEATMAPSET_PATH_RE.exec(pathname);
  return m ? Number(m[1]) : null;
}

/**
 * First beatmapset id among `a[href*="beatmapsets/"]` links inside `root`
 * (beatmap-card-extra `parseBeatmapsetId(panel)`).
 * @param {ParentNode} root
 * @param {{ base?: string }} [options]
 * @returns {number|null}
 */
export function beatmapsetIdFromLinks(root, options = {}) {
  const links = root?.querySelectorAll?.('a[href*="beatmapsets/"]') ?? [];
  for (const a of links) {
    const id = beatmapsetIdFromHref(a.getAttribute("href"), options);
    if (id != null) return id;
  }
  return null;
}
