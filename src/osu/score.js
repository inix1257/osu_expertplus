/**
 * osu! API score helpers: grade, accuracy, hit statistics, full combo,
 * max combo and score ids. Works on both lazer (`great`, `ok`, …) and legacy
 * (`count_300`, `count_100`, …) statistics.
 *
 * Options that pick between two current behaviours (decision D10) have no
 * default: omitting them throws, so every call site states which one it uses.
 */

import { rulesetFromId } from "./ruleset.js";

/** Prefix of the hit-stat colour classes shared by profile and scoreboard. */
export const HITSTAT_CLASS_PREFIX = "oep-score-stats__val--";

/**
 * @param {string} fn
 * @param {string} name
 * @param {unknown} value
 * @param {readonly unknown[]} allowed
 */
function requireOption(fn, name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new TypeError(
      `${fn}: option "${name}" must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`,
    );
  }
}

/**
 * Grade (`XH`, `S`, `A`, …). String `rank`, else `rank.name`, else `F` for a
 * failed score and `D` otherwise (user-profile `scoreRankForApiScore`).
 * `sanitize: true` also strips non-alphanumerics and falls back to `D`, as the
 * beatmap-detail grade cells do before building `score-rank--*` classes.
 * @param {object|null|undefined} score
 * @param {{ sanitize?: boolean }} [options]
 * @returns {string}
 */
export function scoreGrade(score, options = {}) {
  const r = score?.rank;
  let grade;
  if (typeof r === "string") grade = r;
  else if (r && typeof r === "object" && typeof r.name === "string") {
    grade = r.name;
  } else grade = score?.passed === false ? "F" : "D";
  if (!options.sanitize) return grade;
  return String(grade).replace(/[^A-Za-z0-9]+/g, "") || "D";
}

/**
 * @typedef {object} AccuracyFormatOptions
 * @property {"auto"|"fraction"} scale
 *   `"auto"`: values ≤ 1 are fractions, larger ones already percent
 *   (profile). `"fraction"`: always multiplied by 100 (scoreboard).
 * @property {boolean} coerce
 *   true: numeric strings are accepted (profile). false: only numbers.
 * @property {string} invalid  text for a missing/invalid value
 */

/** @type {Readonly<Record<"profile"|"scoreboard", Readonly<AccuracyFormatOptions>>>} */
export const ACCURACY_FORMAT = Object.freeze({
  profile: Object.freeze({ scale: "auto", coerce: true, invalid: "—" }),
  // D10-6: the scoreboard parses like the profile (it used to accept only
  // numbers and always multiply by 100); only the invalid text differs.
  scoreboard: Object.freeze({ scale: "auto", coerce: true, invalid: "" }),
});

/**
 * `0.9876` → `"98.76%"`.
 * @param {unknown} accuracy  `score.accuracy`
 * @param {AccuracyFormatOptions} options  e.g. `ACCURACY_FORMAT.profile`
 * @returns {string}
 */
export function formatAccuracy(accuracy, options) {
  requireOption("formatAccuracy", "scale", options?.scale, [
    "auto",
    "fraction",
  ]);
  requireOption("formatAccuracy", "coerce", options?.coerce, [true, false]);
  const invalid = options.invalid ?? "";
  let n;
  if (options.coerce) n = accuracy != null ? Number(accuracy) : NaN;
  else n = typeof accuracy === "number" ? accuracy : NaN;
  if (!Number.isFinite(n)) return invalid;
  if (options.scale === "fraction" || n <= 1) n *= 100;
  return `${n.toFixed(2)}%`;
}

/**
 * The scoreboard's "perfect" accuracy colour: 100%. Read like
 * `formatAccuracy` with the `"auto"` scale (D10-6): numeric strings count,
 * and values above 1 are already percentages.
 * @param {unknown} accuracy
 * @returns {boolean}
 */
export function isPerfectAccuracy(accuracy) {
  const n = accuracy != null && accuracy !== "" ? Number(accuracy) : NaN;
  if (!Number.isFinite(n)) return false;
  return (n > 1 ? n / 100 : n) >= 1;
}

/**
 * `1234` → `"1,234x"` (scoreboard combo cells).
 * @param {unknown} combo
 * @returns {string}
 */
export function formatCombo(combo) {
  return `${Number(combo ?? 0).toLocaleString("en-US")}x`;
}

const LAZER_HIT_KEYS = ["great", "perfect", "ok", "meh", "miss"];
const LAZER_ANY_KEYS = [
  ...LAZER_HIT_KEYS,
  "good",
  "large_tick_hit",
  "small_tick_hit",
  "large_tick_miss",
  "small_tick_miss",
];

/**
 * First finite number among `keys` of `obj`, else 0.
 * @param {Record<string, unknown>} obj
 * @param {...string} keys
 */
function firstNum(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null) return Number(obj[k]);
  }
  return 0;
}

/**
 * @typedef {{ great: number, ok: number, meh: number, miss: number }} OsuStats
 * @typedef {{ great: number, ok: number, miss: number }} TaikoStats
 * @typedef {{ great: number, large_tick_hit: number, small_tick_hit: number,
 *   miss: number }} FruitsStats
 * @typedef {{ perfect: number, great: number, good: number, ok: number,
 *   meh: number, miss: number }} ManiaStats
 */

/**
 * Hit statistics in lazer field names for one ruleset.
 *
 * - osu: `great` (300) / `ok` (100) / `meh` (50) / `miss`. Lazer `perfect` is
 *   added to `great`, as both old implementations do.
 * - taiko: `great` / `ok` / `miss` (legacy `count_300/100/miss`).
 * - fruits: `great` (fruits) / `large_tick_hit` (drops) / `small_tick_hit`
 *   (droplets) / `miss` (legacy `count_300/100/50/miss`).
 * - mania: `perfect` / `great` / `good` / `ok` / `meh` / `miss`
 *   (legacy `count_geki/300/katu/100/50/miss`).
 *
 * `legacyOsuGreat` (D10) only matters for legacy osu statistics:
 * `"300+geki"` adds `count_geki` to `count_300` (user-profile
 * `_normalizeOsuStatistics`); `"300"` uses `count_300` alone, falling back to
 * `count_geki` only when there is no `count_300` (beatmap-detail
 * `hitstatTextFromHeaderLabel`). Legacy keys without the underscore
 * (`count300`) are read too.
 *
 * @param {object|null|undefined} statistics
 * @param {string} ruleset
 * @param {{ legacyOsuGreat: "300+geki"|"300" }} options
 * @returns {OsuStats|TaikoStats|FruitsStats|ManiaStats}
 */
export function normalizeStatistics(statistics, ruleset, options) {
  requireOption(
    "normalizeStatistics",
    "legacyOsuGreat",
    options?.legacyOsuGreat,
    ["300+geki", "300"],
  );
  const st =
    statistics && typeof statistics === "object"
      ? /** @type {Record<string, unknown>} */ (statistics)
      : {};
  const n = (k) => Number(st[k] ?? 0);
  const leg = (name) => firstNum(st, `count_${name}`, `count${name}`);

  if (ruleset === "taiko") {
    const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
    return lazer
      ? { great: n("great"), ok: n("ok"), miss: n("miss") }
      : { great: leg("300"), ok: leg("100"), miss: leg("miss") };
  }
  if (ruleset === "fruits") {
    const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
    return lazer
      ? {
          great: n("great"),
          large_tick_hit: n("large_tick_hit"),
          small_tick_hit: n("small_tick_hit"),
          miss: n("miss"),
        }
      : {
          great: leg("300"),
          large_tick_hit: leg("100"),
          small_tick_hit: leg("50"),
          miss: leg("miss"),
        };
  }
  if (ruleset === "mania") {
    const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
    return lazer
      ? {
          perfect: n("perfect"),
          great: n("great"),
          good: n("good"),
          ok: n("ok"),
          meh: n("meh"),
          miss: n("miss"),
        }
      : {
          perfect: leg("geki"),
          great: leg("300"),
          good: leg("katu"),
          ok: leg("100"),
          meh: leg("50"),
          miss: leg("miss"),
        };
  }

  // osu (and unknown rulesets)
  if (LAZER_HIT_KEYS.some((k) => st[k] != null)) {
    return {
      great: n("great") + n("perfect"),
      ok: n("ok"),
      meh: n("meh"),
      miss: n("miss"),
    };
  }
  const great =
    options.legacyOsuGreat === "300+geki"
      ? n("count_300") + n("count_geki")
      : firstNum(st, "count_300", "count300", "count_geki", "countgeki");
  return { great, ok: leg("100"), meh: leg("50"), miss: leg("miss") };
}

/** Class suffixes per statistic and scheme (D10). */
const STAT_CLASS = Object.freeze({
  profile: Object.freeze({
    perfect: "perfect",
    great: "300",
    good: "good",
    ok: "100",
    meh: "50",
    miss: "miss",
    large_tick_hit: "100",
    small_tick_hit: "50",
  }),
  scoreboard: Object.freeze({
    perfect: "mania-perfect",
    great: "300",
    good: "mania-good",
    ok: "100",
    meh: "50",
    miss: "miss",
    large_tick_hit: "ctb-l",
    small_tick_hit: "ctb-drp",
  }),
});

/**
 * @typedef {object} StatsDisplayOptions
 * @property {"profile"|"scoreboard"} classes
 *   Colour class names. `"profile"`: `--perfect`, `--good`, fruits drops and
 *   droplets as `--100` / `--50` (user-profile `buildStatsRow`).
 *   `"scoreboard"`: `--mania-perfect`, `--mania-good`, `--ctb-l`, `--ctb-drp`
 *   (beatmap-detail `SCOREBOARD_HITSTAT_COLOR_CLASSES`).
 * @property {"300+geki"|"300"} legacyOsuGreat  see {@link normalizeStatistics}
 */

/** @type {Readonly<Record<"profile"|"scoreboard", Readonly<StatsDisplayOptions>>>} */
export const STATS_DISPLAY = Object.freeze({
  // D10-5: legacy osu 300 is count_300 only everywhere. In osu! count_geki
  // counts all-300 combo sections, not extra hits; lazer's legacy decoder
  // maps only count_300 to Great, so the old profile sum double counted.
  profile: Object.freeze({ classes: "profile", legacyOsuGreat: "300" }),
  scoreboard: Object.freeze({ classes: "scoreboard", legacyOsuGreat: "300" }),
});

const STAT_ORDER = Object.freeze({
  osu: ["great", "ok", "meh", "miss"],
  taiko: ["great", "ok", "miss"],
  fruits: ["great", "large_tick_hit", "small_tick_hit", "miss"],
  mania: ["perfect", "great", "good", "ok", "meh", "miss"],
});

/**
 * The cells of a profile-style stats row (`300 / 100 / 50 / miss`, …) in
 * display order, for the score's `ruleset_id`.
 * @param {object|null|undefined} score
 * @param {StatsDisplayOptions} options  e.g. `STATS_DISPLAY.profile`
 * @returns {{ key: string, value: number, className: string }[]}
 */
export function statsCells(score, options) {
  requireOption("statsCells", "classes", options?.classes, [
    "profile",
    "scoreboard",
  ]);
  const ruleset = rulesetFromId(score?.ruleset_id ?? 0);
  const stats = normalizeStatistics(score?.statistics, ruleset, options);
  const classes = STAT_CLASS[options.classes];
  return STAT_ORDER[ruleset].map((key) => ({
    key,
    value: stats[key],
    className: HITSTAT_CLASS_PREFIX + classes[key],
  }));
}

/**
 * Text for a scoreboard hit-stat cell from its header label (the label from
 * beatmap-detail `inferHitstatLabelFromTh`: `great`, `300`, `mania_perfect`,
 * `ctb_l`, `miss`, …). Port of beatmap-detail `hitstatTextFromHeaderLabel`;
 * `ruleset` replaces its `getBeatmapPageRuleset()` call (only used for the
 * terse fruits header `L`).
 * @param {string} label
 * @param {object|null|undefined} score  API score (or a bare statistics object)
 * @param {{ ruleset?: string }} [options]
 * @returns {string}
 */
export function hitstatValue(label, score, options = {}) {
  const st =
    score?.statistics && typeof score.statistics === "object"
      ? score.statistics
      : score && typeof score === "object"
        ? score
        : {};
  const pick = (...keys) => {
    for (const k of keys) {
      const v = st?.[k];
      if (v != null && v !== "" && Number.isFinite(Number(v))) return String(v);
    }
    return "0";
  };
  const o = /** @type {OsuStats} */ (
    normalizeStatistics(st, "osu", { legacyOsuGreat: "300" })
  );

  const lab = String(label).trim().toLowerCase();
  if (lab === "miss" || lab === "m" || lab.includes("miss")) {
    return String(o.miss);
  }
  if (lab === "mania_perfect") {
    return pick("count_geki", "countgeki", "perfect", "great");
  }
  if (lab === "mania_good") {
    return pick("count_katu", "countkatu", "good", "great");
  }
  if (lab === "ctb_l" || (lab === "l" && options.ruleset === "fruits")) {
    return pick("large_tick_hit", "large_bonus");
  }
  if (lab === "ctb_drp" || lab === "drp") {
    return pick("small_tick_hit", "small_bonus");
  }
  // Order matters: mania uses `320` and it contains `300`.
  if (lab === "geki" || lab === "max" || lab === "320") {
    return pick("count_geki", "countgeki", "perfect", "great");
  }
  if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great") {
    return String(o.great);
  }
  if (lab === "katu" || lab === "200") {
    return pick("count_katu", "countkatu", "good", "great");
  }
  if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok") return String(o.ok);
  if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") {
    return String(o.meh);
  }
  if (lab.includes("tick") || lab === "tail") {
    return pick(
      "large_tick_hit",
      "small_tick_hit",
      "slider_tail_hit",
      "large_tick_miss",
    );
  }
  return "0";
}

/**
 * Scoreboard colour class for a hit-stat header label, or ""
 * (beatmap-detail `beatmapHitstatColorClassFromLabel`).
 * @param {string} label
 * @returns {string}
 */
export function hitstatClassFromLabel(label) {
  const lab = String(label).trim().toLowerCase();
  const c = (s) => HITSTAT_CLASS_PREFIX + s;
  if (!lab) return "";
  if (lab === "mania_perfect") return c("mania-perfect");
  if (lab === "mania_good") return c("mania-good");
  if (lab === "ctb_l") return c("ctb-l");
  if (lab === "ctb_drp") return c("ctb-drp");
  if (lab === "miss" || lab === "m" || lab.includes("miss")) return c("miss");
  if (lab === "meh" || /(^|[^0-9])50([^0-9]|$)/.test(lab)) return c("50");
  if (lab === "geki" || lab === "max" || lab === "320") return c("300");
  if (lab === "katu" || lab === "200") return c("100");
  if (lab === "ok" || /(^|[^0-9])100([^0-9]|$)/.test(lab)) return c("100");
  if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great") return c("300");
  return "";
}

/**
 * The API says the combo is perfect (`perfect`, `is_perfect_combo` or
 * `legacy_perfect`; beatmap-detail `scoreApiIndicatesComboPerfect`).
 * @param {object|null|undefined} score
 * @returns {boolean}
 */
export function scoreIndicatesPerfectCombo(score) {
  if (!score || typeof score !== "object") return false;
  return (
    score.perfect === true ||
    score.is_perfect_combo === true ||
    score.legacy_perfect === true
  );
}

/**
 * Full combo: `score.max_combo` equals the map's max combo.
 *
 * `apiFlags` (D10): `false` compares combos only (user-profile combo span);
 * `true` also trusts {@link scoreIndicatesPerfectCombo} and, without a map
 * max combo, compares against `maximum_statistics.max_combo` (beatmap-detail
 * `applyScoreboardComboCell`).
 * @param {object|null|undefined} score
 * @param {number|null|undefined} mapMaxCombo
 * @param {{ apiFlags: boolean }} options
 * @returns {boolean}
 */
export function isFullCombo(score, mapMaxCombo, options) {
  requireOption("isFullCombo", "apiFlags", options?.apiFlags, [true, false]);
  const achieved = Number(score?.max_combo ?? 0);
  const mapMax = mapMaxCombo != null ? Number(mapMaxCombo) : NaN;
  const hasMapMax = Number.isFinite(mapMax) && mapMax > 0;
  if (!options.apiFlags) {
    return hasMapMax && Number.isFinite(achieved) && achieved === mapMax;
  }
  if (scoreIndicatesPerfectCombo(score)) return true;
  if (hasMapMax) return achieved > 0 && achieved === mapMax;
  const stats =
    score?.statistics && typeof score.statistics === "object"
      ? score.statistics
      : {};
  const fromStats = Number(
    score?.maximum_statistics?.max_combo ??
      score?.maximum_statistics?.maxCombo ??
      stats.max_combo ??
      stats.maxCombo,
  );
  return Number.isFinite(fromStats) && fromStats > 0 && achieved === fromStats;
}

/**
 * The map's max combo from a score: `beatmap.max_combo`, else computed from
 * `maximum_statistics` (user-profile `_beatmapMaxComboFromScore`).
 *
 * mania (B68): lazer mania scores record notes and hold heads/tails as
 * `perfect` in `maximum_statistics` (never `great`), plus
 * `legacy_combo_increase` for converted stable scores. By default the mania
 * branch counts `perfect + great + legacy_combo_increase`; that gives the same
 * result as before whenever the old code returned a value, and fixes the
 * `perfect`-only case. `legacyManiaGreatOnly: true` reproduces the old check
 * (requires `great`, so lazer mania scores yield null).
 * @param {object|null|undefined} score
 * @param {{ legacyManiaGreatOnly?: boolean }} [options]
 * @returns {number|null}
 */
export function beatmapMaxComboFromScore(score, options = {}) {
  const bc = score?.beatmap?.max_combo;
  if (bc != null && Number.isFinite(Number(bc))) return Number(bc);

  const ms = score?.maximum_statistics;
  if (!ms || typeof ms !== "object") return null;

  const rulesetId = Number(score?.ruleset_id);
  const num = (k) => {
    const n = Number(ms[k]);
    return ms[k] != null && Number.isFinite(n) ? n : 0;
  };
  const has = (k) => ms[k] != null && Number.isFinite(Number(ms[k]));

  if (rulesetId === 0) {
    const great = num("great");
    if (!great) return null;
    if (ms.legacy_combo_increase != null) {
      return great + num("legacy_combo_increase");
    }
    return (
      great +
      num("large_tick_hit") +
      num("small_tick_hit") +
      num("slider_tail_hit")
    );
  }
  if (rulesetId === 1) return num("great") || null;
  if (rulesetId === 2) return num("great") + num("large_tick_hit") || null;

  // mania (3) and unknown rulesets
  if (options.legacyManiaGreatOnly) {
    return has("great")
      ? num("great") + num("legacy_combo_increase") || null
      : null;
  }
  if (!has("perfect") && !has("great")) return null;
  return num("perfect") + num("great") + num("legacy_combo_increase") || null;
}

/**
 * Score id for links and sorting (beatmap-detail `leaderboardScoreId`):
 * the first of `id`, `legacy_score_id`, `score_id`, … that is set; numeric
 * ids must be > 0.
 * @param {object|null|undefined} score
 * @returns {string|null}
 */
export function leaderboardScoreId(score) {
  if (!score || typeof score !== "object") return null;
  const raw =
    score.id ??
    score.legacy_score_id ??
    score.score_id ??
    score.scoreId ??
    score.scoreID ??
    score.score?.id ??
    score.score?.legacy_score_id ??
    score.score?.score_id ??
    null;
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n > 0 ? String(n) : null;
  const s = String(raw).trim();
  return s ? s : null;
}

/**
 * Identity of a score across API lists (user-profile `_recentScoreMergeKey`):
 * `s:<legacy_score_id>`, else `s:<id>`, else `f:<beatmap>:<time>:<total>:<passed>`
 * for failed legacy rows with `id: 0`.
 * @param {object|null|undefined} score
 * @returns {string|null}
 */
export function scoreMergeKey(score) {
  if (!score || typeof score !== "object") return null;
  const leg = Number(score.legacy_score_id);
  if (Number.isFinite(leg) && leg > 0) return `s:${leg}`;
  const id = Number(score.id);
  if (Number.isFinite(id) && id > 0) return `s:${id}`;
  const bm = score.beatmap?.id ?? score.beatmap_id;
  const t = String(score.ended_at || score.created_at || "");
  const tot = Number(score.total_score ?? score.score);
  const pf = score.passed === false ? 0 : 1;
  if (
    bm != null &&
    Number.isFinite(Number(bm)) &&
    t.length > 0 &&
    Number.isFinite(tot)
  ) {
    return `f:${Number(bm)}:${t}:${tot}:${pf}`;
  }
  return null;
}
