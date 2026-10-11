/**
 * osu! mods as they appear in API scores: either acronym strings (`"HD"`) or
 * lazer objects (`{ acronym: "DT", settings: { speed_change: 1.3 } }`).
 */

/** Default `speed_change` of DT/NC. */
export const DEFAULT_SPEED_UP = 1.5;
/** Default `speed_change` of HT/DC. */
export const DEFAULT_SPEED_DOWN = 0.75;
/** Rates within this distance of the default count as the default. */
export const SPEED_EPSILON = 0.005;

/**
 * Mod type sets per osu!lazer (osu-web `mod--type-*`); unlisted → Fun.
 * Shared Sets: do not mutate.
 */
export const MOD_TYPES = Object.freeze({
  DifficultyReduction: new Set(["EZ", "NF", "HT", "DC", "NR"]),
  DifficultyIncrease: new Set([
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "FI",
    "CO",
    "BL",
    "AC",
    "ST",
  ]),
  Conversion: new Set(["CL", "DA", "MR", "RD", "DS", "IN", "CS", "HO", "TP"]),
  Automation: new Set(["AT", "CN", "RX", "AP", "SO"]),
  System: new Set(["TD", "SV2"]),
});

/**
 * Mods that change star rating / max combo (user-profile `DIFFICULTY_MODS`):
 * the key for `POST /beatmaps/{id}/attributes`. Shared Set: do not mutate.
 */
export const DIFFICULTY_MODS = new Set([
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

/**
 * Mods that change star rating / max combo in one ruleset only (B103), as the
 * attributes API shows: osu! Hidden (alone and with Flashlight) and Touch
 * Device; mania key mods (they set a convert's key count) and Dual Stages.
 * Hidden makes no difference in taiko or catch.
 */
const RULESET_DIFFICULTY_MODS = Object.freeze({
  osu: new Set(["HD", "TD"]),
  mania: new Set([
    "1K",
    "2K",
    "3K",
    "4K",
    "5K",
    "6K",
    "7K",
    "8K",
    "9K",
    "10K",
    "DS",
  ]),
});

/**
 * Classic osu!stable mods (beatmap-detail `STABLE_MOD_ACRONYMS`), used to
 * split the scoreboard mod filter into stable and lazer columns. Copied as is:
 * the key mods are listed as `K1`–`K9`, while osu-web acronyms are `1K`–`9K`.
 */
export const STABLE_MOD_ACRONYMS = new Set([
  "NM",
  "EZ",
  "NF",
  "HT",
  "HR",
  "SD",
  "PF",
  "DT",
  "NC",
  "HD",
  "FL",
  "SO",
  "TD",
  "RX",
  "AP",
  "FI",
  "K1",
  "K2",
  "K3",
  "K4",
  "K5",
  "K6",
  "K7",
  "K8",
  "K9",
]);

/** Lazer mod names (beatmap-detail `modFullName`). */
const MOD_NAMES = Object.freeze({
  EZ: "Easy",
  NF: "No Fail",
  HT: "Half Time",
  DC: "Daycore",
  NR: "No Release",
  HR: "Hard Rock",
  SD: "Sudden Death",
  PF: "Perfect",
  DT: "Double Time",
  NC: "Nightcore",
  FI: "Fade In",
  HD: "Hidden",
  CO: "Cover",
  FL: "Flashlight",
  BL: "Blinds",
  ST: "Strict Tracking",
  AC: "Accuracy Challenge",
  AT: "Autoplay",
  CN: "Cinema",
  RX: "Relax",
  AP: "Autopilot",
  SO: "Spun Out",
  TP: "Target Practice",
  DA: "Difficulty Adjust",
  CL: "Classic",
  RD: "Random",
  MR: "Mirror",
  AL: "Alternate",
  SW: "Swap",
  SG: "Single Tap",
  IN: "Invert",
  CS: "Constant Speed",
  HO: "Hold Off",
  TR: "Transform",
  WG: "Wiggle",
  SI: "Spin In",
  GR: "Grow",
  DF: "Deflate",
  WU: "Wind Up",
  WD: "Wind Down",
  TC: "Traceable",
  BR: "Barrel Roll",
  AD: "Approach Different",
  FF: "Floating Fruits",
  MU: "Muted",
  NS: "No Scope",
  MG: "Magnetised",
  RP: "Repel",
  AS: "Adaptive Speed",
  FR: "Freeze Frame",
  BU: "Bubbles",
  SY: "Synesthesia",
  DP: "Depth",
  BM: "Bloom",
  SV2: "Score V2",
  TD: "Touch Device",
});

/**
 * Acronym of an API mod (string or object), or null.
 * @param {unknown} mod
 * @returns {string|null}
 */
export function modAcronym(mod) {
  const ac =
    typeof mod === "string"
      ? mod
      : /** @type {{ acronym?: unknown }|null|undefined} */ (mod)?.acronym;
  return ac ? String(ac) : null;
}

/**
 * Acronyms of a mod list, skipping entries without one
 * (user-profile `modsAcronymsFromApiMods`).
 * @param {unknown} mods
 * @returns {string[]}
 */
export function modAcronyms(mods) {
  const out = [];
  if (!Array.isArray(mods)) return out;
  for (const m of mods) {
    const ac = modAcronym(m);
    if (ac) out.push(ac);
  }
  return out;
}

/**
 * `settings` of an object mod, or null (strings carry no settings).
 * @param {unknown} mod
 * @returns {Record<string, unknown>|null}
 */
export function modSettings(mod) {
  if (!mod || typeof mod !== "object") return null;
  const s = /** @type {{ settings?: unknown }} */ (mod).settings;
  return s && typeof s === "object"
    ? /** @type {Record<string, unknown>} */ (s)
    : null;
}

/**
 * True when the mod has at least one setting (DA values, a custom rate, …):
 * the case where user-profile adds osu-web's "customised" badge.
 * @param {unknown} mod
 * @returns {boolean}
 */
export function isModCustomised(mod) {
  const s = modSettings(mod);
  return s != null && Object.keys(s).length > 0;
}

/**
 * `settings.speed_change` as a positive finite number, else NaN
 * (beatmap-detail `speedChangeFromScoreMod`).
 * @param {unknown} mod
 * @returns {number}
 */
export function speedChangeFromMod(mod) {
  const x = Number(modSettings(mod)?.speed_change);
  return Number.isFinite(x) && x > 0 ? x : NaN;
}

/**
 * Default rate of a speed mod: 1.5 for DT/NC, 0.75 for HT/DC, else null.
 * @param {string} acronym
 * @returns {number|null}
 */
export function defaultSpeedChange(acronym) {
  const ac = String(acronym ?? "")
    .trim()
    .toUpperCase();
  if (ac === "DT" || ac === "NC") return DEFAULT_SPEED_UP;
  if (ac === "HT" || ac === "DC") return DEFAULT_SPEED_DOWN;
  return null;
}

/**
 * True when `rate` differs from the mod's default by more than
 * {@link SPEED_EPSILON} (beatmap-detail `shouldShowScoreboardModSpeedIndicator`).
 * Mods other than DT/NC/HT/DC are compared against 1.5, as in the original.
 * @param {string} acronym
 * @param {number} rate
 * @returns {boolean}
 */
export function isNonDefaultSpeed(acronym, rate) {
  if (!Number.isFinite(rate) || rate <= 0) return false;
  const def = defaultSpeedChange(acronym) ?? DEFAULT_SPEED_UP;
  return Math.abs(rate - def) > SPEED_EPSILON;
}

/**
 * True when any mod in the score has a non-default `speed_change`
 * (beatmap-detail `scoreHasNonstandardRate`).
 * @param {{ mods?: unknown }|null|undefined} score
 * @returns {boolean}
 */
export function scoreHasNonstandardRate(score) {
  const mods = Array.isArray(score?.mods) ? score.mods : [];
  for (const m of mods) {
    const spd = speedChangeFromMod(m);
    if (Number.isFinite(spd) && isNonDefaultSpeed(modAcronym(m) ?? "", spd)) {
      return true;
    }
  }
  return false;
}

/**
 * @typedef {object} RateDisplayOptions
 * @property {"always"|"non-default"} when
 *   `"always"`: any positive `speed_change` (user-profile chips).
 *   `"non-default"`: only when it differs from the default (scoreboard).
 * @property {"fixed"|"trim"} style
 *   `"fixed"`: two decimals (`1.50×`). `"trim"`: rounded to two decimals,
 *   trailing zeros dropped (`1.5×`).
 */

/**
 * The two behaviours in use until D10 is decided.
 * @type {Readonly<Record<"profile"|"scoreboard", Readonly<RateDisplayOptions>>>}
 */
export const RATE_DISPLAY = Object.freeze({
  profile: Object.freeze({ when: "always", style: "fixed" }),
  scoreboard: Object.freeze({ when: "non-default", style: "trim" }),
});

/**
 * Formats a rate as `1.50×` (`"fixed"`) or `1.5×` (`"trim"`); "" when invalid.
 * @param {number} rate
 * @param {{ style: "fixed"|"trim" }} options
 * @returns {string}
 */
export function formatSpeedChange(rate, options) {
  const x = Number(rate);
  if (!Number.isFinite(x) || x <= 0) return "";
  if (options?.style === "fixed") return `${x.toFixed(2)}×`;
  if (options?.style !== "trim") {
    throw new TypeError('formatSpeedChange: style must be "fixed" or "trim"');
  }
  let t = String(Math.round(x * 100) / 100);
  if (t.includes(".")) t = t.replace(/\.?0+$/, "");
  return `${t}×`;
}

/**
 * Rate label for a mod chip, or "" when the chip shows no rate.
 * @param {unknown} mod
 * @param {RateDisplayOptions} options  e.g. `RATE_DISPLAY.profile`
 * @returns {string}
 */
export function modRateLabel(mod, options) {
  const rate = speedChangeFromMod(mod);
  if (!Number.isFinite(rate)) return "";
  if (options?.when === "non-default") {
    if (!isNonDefaultSpeed(modAcronym(mod) ?? "", rate)) return "";
  } else if (options?.when !== "always") {
    throw new TypeError('modRateLabel: when must be "always" or "non-default"');
  }
  return formatSpeedChange(rate, options);
}

/**
 * osu-web `mod--type-*` class (mod-icons `modTypeClassForAcronym`).
 * @param {string} acronym
 * @returns {string}
 */
export function modTypeClass(acronym) {
  const u = String(acronym).trim().toUpperCase();
  if (MOD_TYPES.DifficultyReduction.has(u)) {
    return "mod--type-DifficultyReduction";
  }
  if (MOD_TYPES.DifficultyIncrease.has(u))
    return "mod--type-DifficultyIncrease";
  if (MOD_TYPES.Conversion.has(u) || /^\d+K$/.test(u)) {
    return "mod--type-Conversion";
  }
  if (MOD_TYPES.Automation.has(u)) return "mod--type-Automation";
  if (MOD_TYPES.System.has(u)) return "mod--type-System";
  return "mod--type-Fun";
}

/**
 * Full lazer name for tooltips (`"DT"` → `"Double Time"`, `"4K"` →
 * `"4 Key Mod"`); unknown acronyms come back upper-cased.
 * @param {string} acronym
 * @returns {string}
 */
export function modFullName(acronym) {
  const a = String(acronym || "")
    .trim()
    .toUpperCase();
  if (!a) return "";
  if (/^[1-9]K$/.test(a) || a === "10K")
    return `${Number(a.slice(0, -1))} Key Mod`;
  return Object.hasOwn(MOD_NAMES, a) ? MOD_NAMES[a] : a;
}

/**
 * The difficulty-affecting subset of `acronyms`, upper-cased and sorted
 * (user-profile `_diffMods`), plus the mods that matter only in `ruleset`.
 * @param {string[]} acronyms
 * @param {string} [ruleset]  without it, only the mods every ruleset shares
 * @returns {string[]}
 */
export function difficultyMods(acronyms, ruleset) {
  const extra = RULESET_DIFFICULTY_MODS[ruleset];
  return (acronyms || [])
    .map((a) => String(a).toUpperCase())
    .filter((a) => DIFFICULTY_MODS.has(a) || extra?.has(a))
    .sort();
}

/**
 * `[A-Za-z0-9]` part of an acronym for `mod__icon--XX` classes (`"X"` if empty).
 * @param {string} acronym
 * @returns {string}
 */
export function modIconSuffix(acronym) {
  return String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
}
