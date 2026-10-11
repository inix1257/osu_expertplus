/**
 * Beatmap difficulty attributes for modded star ratings: session and GM caches,
 * in-flight dedupe (WS-41).
 */

import { isNonDefaultSpeed } from "../../osu/mods.js";
import { settingIds } from "../legacy.js";
// Modded SR: IO + POST /beatmaps/{id}/attributes; row data from title href + mod icons
export const MODDED_SR_ID = settingIds().MODDED_STAR_RATING;
export const MODDED_SR_ATTR = "data-oep-sr"; // '' pending, 1 done

/** @type {Map<string, { sr: number|null, maxCombo: number|null }>} */
export const _attrsSessionCache = new Map();

const BEATMAP_ATTRS_CACHE_GM_KEY = "oep.beatmapAttributesCache.v1";
const BEATMAP_ATTRS_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const BEATMAP_ATTRS_CACHE_MAX_ENTRIES = 600;

/**
 * Bump this string whenever a SR rework ships.  Any install that has a
 * different value stored will have its entire persistent SR cache wiped on
 * the next page load.  The version should be the rework date (YYYY-MM-DD).
 */
const SR_CACHE_VERSION = "2026-07-23";
const SR_CACHE_VERSION_GM_KEY = "oep.srCacheVersion";

(function _initSrCacheVersion() {
  try {
    const stored = GM_getValue(SR_CACHE_VERSION_GM_KEY, "");
    if (stored === SR_CACHE_VERSION) return;
    GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, "{}");
    GM_setValue(SR_CACHE_VERSION_GM_KEY, SR_CACHE_VERSION);
  } catch (_) {}
})();

/** osu-web `ranked` values whose difficulty can no longer change. */
const PERMANENT_RANKED = new Set([1, 2, 4]); // ranked, approved, loved
const PERMANENT_STATUS = new Set(["ranked", "approved", "loved"]);

/**
 * Whether a beatmap's star rating may be cached for 14 days: only when the
 * score data says it is ranked, approved or loved (B37). Unknown means no:
 * a pending or graveyarded map can still be updated.
 * @param {{ ranked?: unknown, status?: unknown } | null | undefined} beatmap
 * @returns {boolean}
 */
export function isPermanentBeatmap(beatmap) {
  if (!beatmap || typeof beatmap !== "object") return false;
  if (beatmap.ranked != null)
    return PERMANENT_RANKED.has(Number(beatmap.ranked));
  return PERMANENT_STATUS.has(String(beatmap.status ?? ""));
}

/** @type {WeakMap<Element, object>} row -> the beatmap of the score it shows */
const rowBeatmaps = new WeakMap();

/**
 * Remember which beatmap a score row shows, for {@link isPermanentBeatmap}.
 * @param {Element} rowEl
 * @param {object|null|undefined} beatmap
 */
export function rememberRowBeatmap(rowEl, beatmap) {
  if (beatmap && typeof beatmap === "object") rowBeatmaps.set(rowEl, beatmap);
}

/** @param {Element} rowEl */
export function rowBeatmap(rowEl) {
  return rowBeatmaps.get(rowEl);
}

/** @type {Map<string|number, Promise<number|null>>} */
const _beatmapMaxComboInFlight = new Map();

/**
 * Fetch max_combo for a beatmap via GET /api/v2/beatmaps/{id} when the
 * attributes endpoint returns 0. Results are not cached persistently since
 * this is only called as a fallback for a known API bug.
 */
function _fetchBeatmapMaxCombo(beatmapId) {
  if (_beatmapMaxComboInFlight.has(beatmapId)) {
    return _beatmapMaxComboInFlight.get(beatmapId);
  }
  const p = OsuExpertPlus.api
    .getBeatmap(beatmapId, { priority: "low" })
    .then((data) => {
      const mc = data?.max_combo;
      return mc != null && Number.isFinite(Number(mc)) && Number(mc) > 0
        ? Number(mc)
        : null;
    })
    .catch(() => null)
    .finally(() => _beatmapMaxComboInFlight.delete(beatmapId));
  _beatmapMaxComboInFlight.set(beatmapId, p);
  return p;
}

function _readBeatmapAttrsGmStore() {
  try {
    const raw = GM_getValue(BEATMAP_ATTRS_CACHE_GM_KEY, "");
    if (raw == null || raw === "") return {};
    const o = typeof raw === "string" ? JSON.parse(raw) : raw;
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}

function _writeBeatmapAttrsGmStore(store) {
  try {
    GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, JSON.stringify(store));
  } catch (_) {}
}

/**
 * @typedef {{ sr: number|null, maxCombo: number|null }} PackedAttrs
 * @typedef {{ t: number, sr: number|null, maxCombo: number|null }} StoredAttrs
 */

/**
 * The persistent attributes cache: the GM value is read once into a Map
 * (its order is least recently used first), and written back once after a
 * burst of changes instead of a full JSON read + write per lookup. Entries
 * expire `ttlMs` after they were stored; past `maxEntries` the least
 * recently used go first (WS-41; it used to be written-order FIFO).
 * @param {{
 *   read: () => Record<string, StoredAttrs>,
 *   write: (store: Record<string, StoredAttrs>) => void,
 *   now?: () => number,
 *   ttlMs?: number,
 *   maxEntries?: number,
 *   writeDelayMs?: number,
 *   setTimer?: (fn: () => void, ms: number) => unknown,
 * }} deps
 */
export function createAttrsStore({
  read,
  write,
  now = Date.now,
  ttlMs = BEATMAP_ATTRS_CACHE_TTL_MS,
  maxEntries = BEATMAP_ATTRS_CACHE_MAX_ENTRIES,
  writeDelayMs = 1000,
  setTimer = (fn, ms) => setTimeout(fn, ms),
}) {
  /** @type {Map<string, StoredAttrs> | null} */
  let entries = null;
  let writePending = false;

  const num = (v) =>
    v != null && Number.isFinite(Number(v)) ? Number(v) : null;

  function load() {
    if (entries) return entries;
    entries = new Map();
    const raw = read();
    const t = now();
    for (const [key, ent] of Object.entries(raw)) {
      const stored = Number(ent?.t);
      if (!Number.isFinite(stored) || t - stored > ttlMs) continue;
      if (num(ent.maxCombo) === 0) continue;
      entries.set(key, {
        t: stored,
        sr: num(ent.sr),
        maxCombo: num(ent.maxCombo),
      });
    }
    if (entries.size !== Object.keys(raw).length) scheduleWrite();
    return entries;
  }

  function flush() {
    writePending = false;
    if (entries) write(Object.fromEntries(entries));
  }

  function scheduleWrite() {
    if (writePending) return;
    writePending = true;
    setTimer(flush, writeDelayMs);
  }

  return {
    /**
     * @param {string} key
     * @returns {PackedAttrs | undefined}
     */
    get(key) {
      const map = load();
      const ent = map.get(key);
      if (!ent) return undefined;
      map.delete(key);
      if (now() - ent.t > ttlMs) {
        scheduleWrite();
        return undefined;
      }
      map.set(key, ent); // most recently used last
      return { sr: ent.sr, maxCombo: ent.maxCombo };
    },
    /**
     * @param {string} key
     * @param {PackedAttrs} packed
     */
    set(key, packed) {
      const map = load();
      map.delete(key);
      map.set(key, { t: now(), sr: packed.sr, maxCombo: packed.maxCombo });
      for (const k of map.keys()) {
        if (map.size <= maxEntries) break;
        map.delete(k);
      }
      scheduleWrite();
    },
    clear() {
      entries = new Map();
      flush();
    },
    flush,
  };
}

const attrsStore = createAttrsStore({
  read: _readBeatmapAttrsGmStore,
  write: _writeBeatmapAttrsGmStore,
});
// A pending write must not be lost when the tab goes away.
window.addEventListener("pagehide", () => attrsStore.flush());

/** "Clear SR cache": session and persistent caches. */
export function clearBeatmapAttributesCache() {
  _attrsSessionCache.clear();
  attrsStore.clear();
}

function _getCachedAttrs(key) {
  return _attrsSessionCache.get(key);
}

function _srCacheKey(beatmapId, diffMods, ruleset) {
  return `${beatmapId}:${ruleset}:${diffMods.join("+") || "NM"}`;
}

export function _extractRowData(rowEl) {
  const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
  const m = href.match(/#(\w+)\/(\d+)/);
  return {
    beatmapId: m?.[2] ?? null,
    ruleset: m?.[1] ?? "osu",
    mods: Array.from(rowEl.querySelectorAll(".mod__icon[data-acronym]")).map(
      (e) => e.dataset.acronym,
    ),
  };
}

/**
 * True when a row's mods carry settings that change the star rating: a
 * non-default DT/NC/HT/DC rate (osu-web's `.mod__extender`, e.g. "1.20x") or a
 * customised Difficulty Adjust. The attributes API ignores mod settings and
 * answers with the default-rate value, so these rows get no SR badge (B36).
 * @param {Element} rowEl
 * @returns {boolean}
 */
export function rowHasCustomDifficultySettings(rowEl) {
  for (const icon of rowEl.querySelectorAll(".mod__icon[data-acronym]")) {
    const acronym = (icon.getAttribute("data-acronym") ?? "")
      .trim()
      .toUpperCase();
    const modEl = icon.closest(".mod") ?? icon.parentElement;
    if (!modEl) continue;
    if (acronym === "DA") {
      if (modEl.querySelector(".mod__extender, .mod__customised-indicator")) {
        return true;
      }
      continue;
    }
    if (!["DT", "NC", "HT", "DC"].includes(acronym)) continue;
    const text = modEl.querySelector(".mod__extender")?.textContent ?? "";
    const rate = parseFloat(text.replace(/[^\d.]/g, ""));
    if (Number.isFinite(rate) && isNonDefaultSpeed(acronym, rate)) return true;
  }
  return false;
}

/** @type {Map<string, Promise<{ sr: number|null, maxCombo: number|null }>>} */
const _attrsInFlight = new Map();

/**
 * @param {string|number} beatmapId
 * @param {string[]} diffMods
 * @param {string} ruleset
 * @param {{ persist?: boolean }} [opts]  persist: store for 14 days (only
 *   for beatmaps known to be permanent, B37); always kept for the session
 * @returns {Promise<{ key: string, sr: number|null, maxCombo: number|null }>}
 */
export async function _fetchBeatmapAttributesCached(
  beatmapId,
  diffMods,
  ruleset,
  opts,
) {
  const key = _srCacheKey(beatmapId, diffMods, ruleset);
  const hit = _getCachedAttrs(key);
  if (hit !== undefined) return { key, ...hit };

  const persisted = attrsStore.get(key);
  if (persisted !== undefined) {
    _attrsSessionCache.set(key, persisted);
    return { key, ...persisted };
  }

  const persist = opts?.persist === true;

  if (!_attrsInFlight.has(key)) {
    const p = OsuExpertPlus.api
      .postBeatmapAttributes(beatmapId, diffMods, ruleset)
      .then(async (data) => {
        const attrs = data?.attributes ?? {};
        const sr =
          attrs.star_rating != null &&
          Number.isFinite(Number(attrs.star_rating))
            ? Number(attrs.star_rating)
            : null;
        let maxCombo =
          attrs.max_combo != null && Number.isFinite(Number(attrs.max_combo))
            ? Number(attrs.max_combo)
            : null;

        if (maxCombo === 0) {
          const fallback = await _fetchBeatmapMaxCombo(beatmapId);
          maxCombo = fallback != null ? fallback : null;
        }

        const packed = { sr, maxCombo };
        _attrsSessionCache.set(key, packed);
        if (persist) {
          attrsStore.set(key, packed);
        }
        return packed;
      })
      .catch(() => ({ sr: null, maxCombo: null }))
      .finally(() => _attrsInFlight.delete(key));
    _attrsInFlight.set(key, p);
  }

  const packed = await _attrsInFlight.get(key);
  return { key, ...packed };
}
