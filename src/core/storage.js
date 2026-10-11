/**
 * Registry of every persistent key Expert+ uses, plus small typed GM helpers.
 *
 * Key strings are kept exactly as they are today (renaming needs a
 * migration; see decision D4). New keys use `oep.<area>.<name>`.
 *
 * Settings toggles are not listed one by one: each settings id in
 * `OsuExpertPlus.settings.IDS` is its own GM key holding a boolean.
 */

/**
 * @typedef {{
 *   key: string,
 *   store: "gm" | "localStorage",
 *   format: "string" | "number" | "boolean" | "json",
 *   owner: string,
 *   purpose: string,
 * }} StorageKey
 */

/** @type {Readonly<Record<string, Readonly<StorageKey>>>} */
export const KEYS = Object.freeze({
  DEBUG: {
    key: "oep.debug",
    store: "gm",
    format: "boolean",
    owner: "core/log.js",
    purpose: "Print debug/info logs when true (set by hand)",
  },
  AUTH_CLIENT_ID: {
    key: "oep_client_id",
    store: "gm",
    format: "string",
    owner: "utils/auth.js",
    purpose: "OAuth client id",
  },
  AUTH_CLIENT_SECRET: {
    key: "oep_client_secret",
    store: "gm",
    format: "string",
    owner: "utils/auth.js",
    purpose: "OAuth client secret",
  },
  AUTH_ACCESS_TOKEN: {
    key: "oep_access_token",
    store: "gm",
    format: "string",
    owner: "utils/auth.js",
    purpose: "Cached client-credentials access token",
  },
  AUTH_TOKEN_EXPIRY: {
    key: "oep_token_expiry",
    store: "gm",
    format: "number",
    owner: "utils/auth.js",
    purpose: "Access token expiry (Unix ms)",
  },
  OMDB_API_KEY: {
    key: "oep_omdb_api_key",
    store: "gm",
    format: "string",
    owner: "utils/omdb.js",
    purpose: "OMDB API key",
  },
  BEATMAP_ATTRIBUTES_CACHE: {
    key: "oep.beatmapAttributesCache.v1",
    store: "gm",
    format: "json",
    owner: "features/profile/beatmap-attributes.js",
    purpose: "Modded star rating cache (up to 600 entries, ~40KB)",
  },
  SR_CACHE_VERSION: {
    key: "oep.srCacheVersion",
    store: "gm",
    format: "string",
    owner: "features/profile/beatmap-attributes.js",
    purpose: "Version stamp; a mismatch clears the attributes cache",
  },
  PROFILE_BADGES_COLLAPSED: {
    key: "userProfile.profileBadgesCollapsed",
    store: "gm",
    format: "boolean",
    owner: "features/profile/badges.js",
    purpose: "Profile badge strip collapsed",
  },
  PROFILE_SUBSECTIONS_COLLAPSED: {
    key: "userProfile.profileSubsectionsCollapsed",
    store: "gm",
    format: "json",
    owner: "features/profile/subsections.js",
    purpose:
      "Collapsed profile subsections (older title and index keys migrate here, B47)",
  },
  PROFILE_SECTIONS_COLLAPSED: {
    key: "userProfile.profileSectionsCollapsed",
    store: "gm",
    format: "json",
    owner: "features/profile/sections.js",
    purpose: "Collapsed profile sections",
  },
  LISTING_PREFERRED_MODE: {
    key: "beatmapsetsListing.preferredMode",
    store: "gm",
    format: "string",
    owner: "features/listing-mode.js",
    purpose: "Last ruleset picked on the beatmap listing (`m` param)",
  },
  RANKS_PERIOD: {
    key: "oep.profile.ranksPeriod",
    store: "gm",
    format: "json",
    owner: "features/profile/ranks-period.js",
    purpose:
      "Last Ranks period highlight, `{ period, reversed }`, restored on the next profile",
  },
  PREVIEW_MUSIC_VOLUME_LEGACY: {
    key: "beatmapPreview.musicVolume",
    store: "gm",
    format: "number",
    owner: "features/beatmap-preview/prefs.js",
    purpose: "Legacy; read once to migrate to localStorage",
  },
  PREVIEW_HITSOUND_VOLUME_LEGACY: {
    key: "beatmapPreview.hitsoundVolume",
    store: "gm",
    format: "number",
    owner: "features/beatmap-preview/prefs.js",
    purpose: "Legacy; read once to migrate to localStorage",
  },
  PREVIEW_MUSIC_VOLUME: {
    key: "oep.beatmapPreview.musicVolume",
    store: "localStorage",
    format: "number",
    owner: "features/beatmap-preview/prefs.js",
    purpose: "Gameplay preview music volume (site localStorage)",
  },
  PREVIEW_HITSOUND_VOLUME: {
    key: "oep.beatmapPreview.hitsoundVolume",
    store: "localStorage",
    format: "number",
    owner: "features/beatmap-preview/prefs.js",
    purpose: "Gameplay preview hitsound volume (site localStorage)",
  },
  PREVIEW_AUDIO_OFFSET: {
    key: "oep.beatmapPreview.audioOffsetMs",
    store: "localStorage",
    format: "number",
    owner: "features/beatmap-preview/prefs.js",
    purpose: "Gameplay preview audio offset in ms (site localStorage)",
  },
});

/**
 * Settings migration flags and legacy settings keys handled in
 * utils/settings.js (`userProfile._oep*Migrated`, `userProfile.ppDecimals`,
 * `userProfile.bestScoreStats`, `userProfile.scoreListDetails`).
 */
export const SETTINGS_MIGRATION_KEY_PREFIX = "userProfile.";

/** @param {string | StorageKey} key */
function keyName(key) {
  return typeof key === "string" ? key : key.key;
}

/**
 * GM value as a boolean (`true` only for `true`); `fallback` when missing or
 * unreadable.
 * @param {string | StorageKey} key
 * @param {boolean} [fallback=false]
 */
export function getBool(key, fallback = false) {
  try {
    const v = GM_getValue(keyName(key), undefined);
    return typeof v === "boolean" ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Delete a GM value. Returns false when it could not be deleted.
 * @param {string | StorageKey} key
 */
export function deleteKey(key) {
  try {
    GM_deleteValue(keyName(key));
    return true;
  } catch {
    return false;
  }
}

/**
 * Store a boolean. Returns false when it could not be saved.
 * @param {string | StorageKey} key
 * @param {boolean} value
 */
export function setBool(key, value) {
  try {
    GM_setValue(keyName(key), Boolean(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * GM value as a string; `fallback` when missing, not a string or unreadable.
 * @param {string | StorageKey} key
 * @param {string|null} [fallback=null]
 * @returns {string|null}
 */
export function getString(key, fallback = null) {
  try {
    const v = GM_getValue(keyName(key), undefined);
    return typeof v === "string" ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Store a string. Returns false when it could not be saved.
 * @param {string | StorageKey} key
 * @param {string} value
 */
export function setString(key, value) {
  try {
    GM_setValue(keyName(key), String(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * GM value stored as a JSON string (or a structured value); `fallback` when
 * missing, unreadable or invalid JSON.
 * @template T
 * @param {string | StorageKey} key
 * @param {T} fallback
 * @returns {T}
 */
export function getJSON(key, fallback) {
  try {
    const raw = GM_getValue(keyName(key), undefined);
    if (raw === undefined || raw === null || raw === "") return fallback;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/**
 * Store `value` as a JSON string. Returns false when it could not be saved.
 * @param {string | StorageKey} key
 * @param {unknown} value
 */
export function setJSON(key, value) {
  try {
    GM_setValue(keyName(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
