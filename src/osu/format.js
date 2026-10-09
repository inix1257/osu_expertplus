/**
 * Display formatting for osu! values (star rating, relative time, durations,
 * flags) and locale-aware number parsing.
 *
 * Options that pick between two current behaviours (decision D10) have no
 * default: omitting them throws, so every call site states which one it uses.
 */

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
 * osu-web's page locale: `window.currentLocale`, else `<html lang>`, else
 * undefined (the runtime default). Read on every call.
 * @returns {string|undefined}
 */
export function pageLocale() {
  if (
    typeof window !== "undefined" &&
    typeof window.currentLocale === "string"
  ) {
    return window.currentLocale;
  }
  if (typeof document === "undefined") return undefined;
  return document.documentElement?.lang || undefined;
}

/* ------------------------------------------------------------------ */
/* Star rating                                                         */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} StarFormatOptions
 * @property {"truncate"|"floor"|"round"} rounding
 *   `"truncate"`: toward zero (card chip). `"floor"`: down (beatmapset
 *   header). `"round"`: `toFixed(2)` (profile modded-SR badge). Truncate and
 *   floor only differ for negative values.
 * @property {boolean} [trimZeros]  drop trailing zeros (`6.00` → `6`, `5.90`
 *   → `5.9`), as the card chip does
 * @property {boolean} [localize]  format with `toLocaleString` (locale-specific
 *   decimal separator), as the header does
 * @property {string} [locale]  with `localize`; default: runtime default
 */

/**
 * The three behaviours in use until D10 is decided.
 * @type {Readonly<Record<"card"|"header"|"profileBadge", Readonly<StarFormatOptions>>>}
 */
export const STAR_FORMAT = Object.freeze({
  /** beatmap-card-extra `formatStarShort` */
  card: Object.freeze({ rounding: "truncate", trimZeros: true }),
  /** beatmap-detail `formatBeatmapsetHeaderStarRatingText` */
  header: Object.freeze({ rounding: "floor", localize: true }),
  /** user-profile modded SR badge (`sr.toFixed(2)`) */
  profileBadge: Object.freeze({ rounding: "round" }),
});

/**
 * Star rating with two decimals; "" when `Number(value)` is not finite
 * (`null` counts as 0, as in the originals).
 *
 * Truncate/floor are computed as `Math.floor(x * 100) / 100` like the
 * originals, so binary rounding applies (e.g. 1.15 → "1.14", 4.35 → "4.34").
 * @param {unknown} value
 * @param {StarFormatOptions} options  e.g. `STAR_FORMAT.card`
 * @returns {string}
 */
export function formatStars(value, options) {
  requireOption("formatStars", "rounding", options?.rounding, [
    "truncate",
    "floor",
    "round",
  ]);
  const x = Number(value);
  if (!Number.isFinite(x)) return "";
  let v = x;
  if (options.rounding === "truncate") {
    v = (Math.floor(Math.abs(x) * 100) / 100) * Math.sign(x);
  } else if (options.rounding === "floor") {
    v = Math.floor(x * 100) / 100;
  }
  if (options.localize) {
    return v.toLocaleString(options.locale, {
      minimumFractionDigits: options.trimZeros ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }
  const s = v.toFixed(2);
  return options.trimZeros ? s.replace(/\.?0+$/, "") : s;
}

/* ------------------------------------------------------------------ */
/* Relative time                                                       */
/* ------------------------------------------------------------------ */

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const MONTH = 2_592_000_000; // 30 days
const YEAR = 31_536_000_000; // 365 days

/**
 * Short relative time (`now`, `5m`, `3h`, `2d`, `4mo`, `1y`).
 *
 * `rounding` (D10) selects one of the two current algorithms:
 * - `"floor"` (beatmap-detail `formatScoreboardShortAgo`, scoreboard rows):
 *   whole units rounded down; under 45 s is `now`; future times count as 0;
 *   months are 30-day blocks, years 365 days (days 360–364 give `12mo`).
 * - `"round"` (beatmap-detail `_scoreTopRelativeTime`, top-score cards):
 *   nearest unit; no `now` (under 30 s is `0m`); the distance is absolute,
 *   so future times count like past ones.
 *
 * Invalid input gives "" in both modes (the old `"round"` code returned
 * `"NaNy"` for an unparsable non-empty string).
 * @param {string|number|Date|null|undefined} time  ISO string, ms or Date
 * @param {{ rounding: "floor"|"round", now?: number }} options
 * @returns {string}
 */
export function formatRelativeShort(time, options) {
  requireOption("formatRelativeShort", "rounding", options?.rounding, [
    "floor",
    "round",
  ]);
  if (time == null || time === "") return "";
  const then = new Date(time).getTime();
  if (!Number.isFinite(then)) return "";
  const now = options.now ?? Date.now();

  if (options.rounding === "round") {
    const abs = Math.abs(now - then);
    if (abs < HOUR) return `${Math.round(abs / MIN)}m`;
    if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
    if (abs < MONTH) return `${Math.round(abs / DAY)}d`;
    if (abs < YEAR) return `${Math.round(abs / MONTH)}mo`;
    return `${Math.round(abs / YEAR)}y`;
  }

  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 45) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(day / 365);
  if (y < 1) return `${mo}mo`;
  return `${y}y`;
}

/* ------------------------------------------------------------------ */
/* Duration                                                            */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ unit: "s"|"ms", hours: boolean }} DurationFormatOptions
 */

/** @type {Readonly<Record<"card"|"preview", Readonly<DurationFormatOptions>>>} */
export const DURATION_FORMAT = Object.freeze({
  /** beatmap-card-extra `formatDuration`: seconds, `61:40` */
  card: Object.freeze({ unit: "s", hours: false }),
  /** beatmap-preview `formatPreviewTimeMs`: milliseconds, `1:01:40` */
  preview: Object.freeze({ unit: "ms", hours: true }),
});

/**
 * `m:ss`, or `h:mm:ss` from one hour when `hours` is set. Values are floored to
 * whole seconds; negative, missing or non-numeric values give `0:00`.
 * @param {unknown} value
 * @param {DurationFormatOptions} options  e.g. `DURATION_FORMAT.card`
 * @returns {string}
 */
export function formatDuration(value, options) {
  requireOption("formatDuration", "unit", options?.unit, ["s", "ms"]);
  requireOption("formatDuration", "hours", options?.hours, [true, false]);
  let n = Number(value);
  if (!Number.isFinite(n) || n < 0) n = 0;
  const total = Math.floor(options.unit === "ms" ? n / 1000 : n);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  if (options.hours && m >= 60) {
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}`;
  }
  return `${m}:${s}`;
}

/* ------------------------------------------------------------------ */
/* Flags                                                               */
/* ------------------------------------------------------------------ */

/**
 * osu-web flag SVG name for a country code: `"RU"` → `"1f1f7-1f1fa"`
 * (`/assets/images/flags/<name>.svg`). Case-insensitive, surrounding
 * whitespace ignored; null unless two ASCII letters.
 * @param {unknown} countryCode
 * @returns {string|null}
 */
export function flagFilename(countryCode) {
  const c = String(countryCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  const u1 = 0x1f1e6 + c.charCodeAt(0) - 65;
  const u2 = 0x1f1e6 + c.charCodeAt(1) - 65;
  return `${u1.toString(16)}-${u2.toString(16)}`;
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const SPACE_RE = /[\s\u00A0\u202F\u2009]/g;

/**
 * Decimal separator of a locale (`"."` or `","`; `"."` if unknown).
 * @param {string|undefined} locale
 * @returns {string}
 */
export function decimalSeparator(locale) {
  try {
    return (
      new Intl.NumberFormat(locale)
        .format(1.1)
        .replace(/\d/g, "")
        .replace(SPACE_RE, "") || "."
    );
  } catch (_) {
    return ".";
  }
}

/**
 * Parses a number as the page displays it (`1,234.5` in en, `1.234,5` in de,
 * `1 234,5` in fr). Port of `OsuExpertPlus.dom.parseLocaleNumber`, with the
 * locale as a parameter (default: {@link pageLocale}).
 *
 * In a comma-decimal locale, `"123.456"` reads as 123456 (a grouped
 * thousand). Raw API values (pp in a `title`, `"123.456"`) must go through
 * {@link parseApiNumber} instead (B19).
 * @param {unknown} str
 * @param {{ locale?: string }} [options]
 * @returns {number}  NaN when empty or unparsable
 */
export function parseLocaleNumber(str, options = {}) {
  if (!str) return NaN;
  let s = String(str).trim().replace(SPACE_RE, "");
  const locale = "locale" in options ? options.locale : pageLocale();
  const dec = decimalSeparator(locale);
  if (dec === "." && /^\d{1,3}(,\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/,/g, ""));
  }
  if (dec === "," && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    return parseFloat(s.replace(/\./g, ""));
  }
  const lastComma = s.lastIndexOf(",");
  const lastPeriod = s.lastIndexOf(".");
  if (lastComma > lastPeriod) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  return parseFloat(s);
}

/**
 * Parses a raw API / JSON number string (`"123.456"`, `"-1.5e3"`), which
 * always uses `.` as the decimal point, whatever the page locale (B19).
 * @param {unknown} str
 * @returns {number}  NaN unless the whole (trimmed) string is a number
 */
export function parseApiNumber(str) {
  if (typeof str === "number") return str;
  if (typeof str !== "string") return NaN;
  const s = str.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/**
 * Fixed decimals in the page locale (`1234.5` → `1,234.50` / `1.234,50`).
 * Port of `OsuExpertPlus.dom.formatDecimalPp` (which is `digits: 2`).
 * @param {number} n
 * @param {{ locale?: string, digits?: number }} [options]
 * @returns {string}
 */
export function formatDecimal(n, options = {}) {
  const digits = options.digits ?? 2;
  const locale = "locale" in options ? options.locale : pageLocale();
  try {
    return n.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return n.toFixed(digits);
  }
}
