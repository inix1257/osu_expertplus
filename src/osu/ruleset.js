/**
 * osu! rulesets: names, numeric ids and the URL patterns that carry them.
 *
 * Ruleset ids follow osu-web / the API (`ruleset_id`): osu 0, taiko 1,
 * fruits 2, mania 3. The beatmap listing's `m=` parameter and Kirino's
 * `mode` index use the same numbers.
 */

/** @typedef {"osu"|"taiko"|"fruits"|"mania"} Ruleset */

/** @type {readonly Ruleset[]} */
export const RULESETS = Object.freeze(["osu", "taiko", "fruits", "mania"]);

/** Alternation for building regexes: `osu|taiko|fruits|mania`. */
export const RULESET_PATTERN = RULESETS.join("|");

/** `#osu/123` at the start of `location.hash`; groups: ruleset, beatmap id. */
export const RULESET_HASH_RE = new RegExp(
  `^#(${RULESET_PATTERN})\\/(\\d+)`,
  "i",
);

/** `fa-extra-mode-osu` etc. in a class list; group: ruleset. */
export const MODE_ICON_CLASS_RE = new RegExp(
  `\\bfa-extra-mode-(${RULESET_PATTERN})\\b`,
);

/** Beatmap listing `m=` value (`0`–`3`). */
export const LISTING_MODE_RE = /^[0123]$/;

/**
 * @param {unknown} name
 * @returns {name is Ruleset}  exact, case-sensitive match
 */
export function isRuleset(name) {
  return typeof name === "string" && RULESETS.includes(/** @type {*} */ (name));
}

/**
 * Lower-cases and validates a ruleset name (`"Mania"` → `"mania"`).
 * @param {unknown} name
 * @returns {Ruleset|null}
 */
export function normalizeRuleset(name) {
  if (typeof name !== "string") return null;
  const lower = name.trim().toLowerCase();
  return isRuleset(lower) ? lower : null;
}

/**
 * `ruleset_id` → name. Accepts numbers and numeric strings (`"3"`).
 * Same as user-profile `rulesetIdToMode` when `fallback` is `"osu"`.
 * @template F
 * @param {unknown} id
 * @param {F} [fallback]  returned for unknown ids (default `"osu"`)
 * @returns {Ruleset|F}
 */
export function rulesetFromId(id, fallback = /** @type {F} */ ("osu")) {
  if (id == null || id === "") return fallback;
  const n = Number(id);
  return Number.isInteger(n) && n >= 0 && n < RULESETS.length
    ? RULESETS[n]
    : fallback;
}

/**
 * Name → `ruleset_id`. Same as `kirino.modeIndexForRuleset` when `fallback`
 * is 0 (the default).
 * @template F
 * @param {unknown} name
 * @param {F} [fallback]  returned for unknown names (default 0)
 * @returns {number|F}
 */
export function rulesetId(name, fallback = /** @type {F} */ (0)) {
  const i = RULESETS.indexOf(/** @type {*} */ (name));
  return i >= 0 ? i : fallback;
}

/**
 * @param {unknown} value  beatmap listing `m=` value
 * @returns {boolean}
 */
export function isListingMode(value) {
  return typeof value === "string" && LISTING_MODE_RE.test(value);
}

/**
 * Ruleset named by a mode icon class (`fa-extra-mode-taiko`).
 * @param {string|null|undefined} className
 * @returns {Ruleset|null}
 */
export function rulesetFromModeIconClass(className) {
  const m = MODE_ICON_CLASS_RE.exec(String(className ?? ""));
  return m ? /** @type {Ruleset} */ (m[1]) : null;
}

/**
 * Ruleset named in a profile URL: `/users/1/taiko` or `?mode=taiko`.
 * Port of user-profile `getModeFromUrl` (case-sensitive; any user segment).
 * @param {string} pathname
 * @param {string} [search]
 * @returns {Ruleset|null}
 */
export function rulesetFromProfileUrl(pathname, search = "") {
  const seg = String(pathname ?? "").match(/^\/users\/[^/]+\/([^/]+)\/?$/);
  if (seg && isRuleset(seg[1])) return seg[1];
  const q = String(search ?? "").match(/[?&]mode=([^&]+)/);
  return q && isRuleset(q[1]) ? q[1] : null;
}
