/**
 * Beatmap difficulty attributes for modded star ratings: session and GM caches,
 * in-flight dedupe (WS-41).
 */

import { settingIds } from "../legacy.js";
// Modded SR: IO + POST /beatmaps/{id}/attributes; row data from title href + mod icons
export const MODDED_SR_ID = settingIds().MODDED_STAR_RATING;
export const MODDED_SR_ATTR = "data-oep-sr"; // '' pending, 1 done

const DIFFICULTY_MODS = new Set([
  "DT",
  "NC",
  "HT",
  "DC",
  "HR",
  "EZ",
  "FL",
  "DA",
  "AC",
  "WU",
  "WD",
  "DF",
  "TC",
]);

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

const RANKED_STATUS_RANKED = 1;
const RANKED_STATUS_LOVED = 4;

function _isCacheableRankedStatus(ranked) {
  return (
    ranked === undefined ||
    ranked === RANKED_STATUS_RANKED ||
    ranked === RANKED_STATUS_LOVED
  );
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

export function _writeBeatmapAttrsGmStore(store) {
  try {
    GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, JSON.stringify(store));
  } catch (_) {}
}

function _pruneBeatmapAttrsGmStore(store, now) {
  for (const k of Object.keys(store)) {
    const ent = store[k];
    const t = Number(ent?.t);
    if (!Number.isFinite(t) || now - t > BEATMAP_ATTRS_CACHE_TTL_MS) {
      delete store[k];
    } else if (ent.maxCombo === 0) {
      delete store[k];
    }
  }
  const keys = Object.keys(store);
  if (keys.length <= BEATMAP_ATTRS_CACHE_MAX_ENTRIES) return;
  keys.sort((a, b) => (Number(store[a]?.t) || 0) - (Number(store[b]?.t) || 0));
  for (let i = 0; i < keys.length - BEATMAP_ATTRS_CACHE_MAX_ENTRIES; i++) {
    delete store[keys[i]];
  }
}

/**
 * @param {string} key
 * @returns {{ sr: number|null, maxCombo: number|null }|undefined}
 */
function _beatmapAttrsPersistentGet(key) {
  const store = _readBeatmapAttrsGmStore();
  const ent = store[key];
  const t = Number(ent?.t);
  if (
    !ent ||
    typeof ent !== "object" ||
    !Number.isFinite(t) ||
    Date.now() - t > BEATMAP_ATTRS_CACHE_TTL_MS
  ) {
    if (key in store) {
      delete store[key];
      _writeBeatmapAttrsGmStore(store);
    }
    return undefined;
  }
  const maxCombo =
    ent.maxCombo != null && Number.isFinite(Number(ent.maxCombo))
      ? Number(ent.maxCombo)
      : null;
  if (maxCombo === 0) {
    delete store[key];
    _writeBeatmapAttrsGmStore(store);
    return undefined;
  }
  return {
    sr:
      ent.sr != null && Number.isFinite(Number(ent.sr)) ? Number(ent.sr) : null,
    maxCombo,
  };
}

/**
 * @param {string} key
 * @param {{ sr: number|null, maxCombo: number|null }} packed
 */
function _beatmapAttrsPersistentSet(key, packed) {
  const store = _readBeatmapAttrsGmStore();
  const now = Date.now();
  _pruneBeatmapAttrsGmStore(store, now);
  store[key] = {
    t: now,
    sr: packed.sr,
    maxCombo: packed.maxCombo,
  };
  _writeBeatmapAttrsGmStore(store);
}

function _getCachedAttrs(key) {
  return _attrsSessionCache.get(key);
}

export function _diffMods(acronyms) {
  return acronyms
    .map((a) => a.toUpperCase())
    .filter((a) => DIFFICULTY_MODS.has(a))
    .sort();
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

/** @type {Map<string, Promise<{ sr: number|null, maxCombo: number|null }>>} */
const _attrsInFlight = new Map();

/**
 * @param {string|number} beatmapId
 * @param {string[]} diffMods
 * @param {string} ruleset
 * @param {{ ranked?: number }} [opts]
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

  const persisted = _beatmapAttrsPersistentGet(key);
  if (persisted !== undefined) {
    _attrsSessionCache.set(key, persisted);
    return { key, ...persisted };
  }

  const ranked = opts?.ranked;

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
        if (_isCacheableRankedStatus(ranked)) {
          _beatmapAttrsPersistentSet(key, packed);
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
