import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DURATION_FORMAT,
  STAR_FORMAT,
  decimalSeparator,
  flagFilename,
  formatDecimal,
  formatDuration,
  formatRelativeShort,
  formatStars,
  parseApiNumber,
  parseLocaleNumber,
} from "../../src/osu/format.js";
import { loadScripts } from "../helpers/load-script.mjs";
import {
  LEGACY_BEATMAPSET,
  BEATMAP_PREVIEW,
  CARD_EXTRA,
  legacyFn,
  LEGACY_SCOREBOARD,
} from "./legacy.mjs";

test("formatStars: boundaries per call site (D10)", () => {
  const oldCard = legacyFn(CARD_EXTRA, "formatStarShort");
  const oldHeader = legacyFn(
    LEGACY_BEATMAPSET,
    "formatBeatmapsetHeaderStarRatingText",
  );
  const oldBadge = (sr) => sr.toFixed(2);
  const cases = [
    // value, card, header (en), profile badge
    [5.995, "5.99", "5.99", "6.00"],
    [5.999, "5.99", "5.99", "6.00"],
    [10.0, "10", "10.00", "10.00"],
    [6, "6", "6.00", "6.00"],
    [5.9, "5.9", "5.90", "5.90"],
    [5.994, "5.99", "5.99", "5.99"],
    [0, "0", "0.00", "0.00"],
    [12.3456, "12.34", "12.34", "12.35"],
    [1.15, "1.14", "1.14", "1.15"],
  ];
  for (const [v, card, header, badge] of cases) {
    assert.equal(formatStars(v, STAR_FORMAT.card), card, `card ${v}`);
    assert.equal(
      formatStars(v, { ...STAR_FORMAT.header, locale: "en" }),
      header,
      `header ${v}`,
    );
    // The old badge rounded (`toFixed(2)`); D10-1 floors it like the header.
    assert.equal(formatStars(v, { rounding: "round" }), badge, `badge ${v}`);
    assert.equal(
      formatStars(v, STAR_FORMAT.profileBadge),
      formatStars(v, { ...STAR_FORMAT.header, locale: "en" }).replace(/,/g, ""),
      `badge ${v} (D10-1)`,
    );
    assert.equal(oldCard(v), card, `card ${v} (old)`);
    assert.equal(oldBadge(v), badge, `badge ${v} (old)`);
    // The old header uses the runtime default locale.
    assert.equal(
      formatStars(v, STAR_FORMAT.header),
      oldHeader(v),
      `header ${v}`,
    );
  }
  assert.equal(
    formatStars(5.999, { ...STAR_FORMAT.header, locale: "de" }),
    "5,99",
  );
  assert.equal(formatStars(-1.234, { rounding: "truncate" }), "-1.23");
  assert.equal(formatStars(-1.234, { rounding: "floor" }), "-1.24");
  assert.equal(formatStars("x", STAR_FORMAT.card), "");
  assert.equal(oldCard("x"), null);
  assert.equal(formatStars(NaN, STAR_FORMAT.header), "");
  assert.throws(() => formatStars(1, {}), TypeError);
});

const NOW = Date.parse("2026-06-01T12:00:00Z");
const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

test("formatRelativeShort: floor vs round boundaries (D10)", () => {
  const cases = [
    // age in ms, floor (scoreboard rows), round (top-score cards)
    [0, "now", "0m"],
    [29 * S, "now", "0m"],
    [30 * S, "now", "1m"],
    [44 * S, "now", "1m"],
    [45 * S, "0m", "1m"],
    [59 * S, "0m", "1m"],
    [60 * S, "1m", "1m"],
    [90 * S, "1m", "2m"],
    [59 * M + 59 * S, "59m", "60m"],
    [H, "1h", "1h"],
    [H + 30 * M, "1h", "2h"],
    [23 * H + 59 * M, "23h", "24h"],
    [D, "1d", "1d"],
    [D + 12 * H, "1d", "2d"],
    [29 * D + 23 * H, "29d", "30d"],
    [30 * D, "1mo", "1mo"],
    [45 * D, "1mo", "2mo"],
    [359 * D, "11mo", "12mo"],
    [360 * D, "12mo", "12mo"],
    [364 * D, "12mo", "12mo"],
    [365 * D, "1y", "1y"],
    [547 * D, "1y", "1y"],
    [548 * D, "1y", "2y"],
    [3 * 365 * D, "3y", "3y"],
    [-2 * H, "now", "2h"],
  ];
  const oldFloor = legacyFn(LEGACY_SCOREBOARD, "formatScoreboardShortAgo", {
    Date: fixedDate(NOW),
  });
  const oldRound = legacyFn(LEGACY_SCOREBOARD, "_scoreTopRelativeTime", {
    Date: fixedDate(NOW),
  });
  for (const [age, floor, round] of cases) {
    const iso = new Date(NOW - age).toISOString();
    const label = `${age / 1000}s`;
    assert.equal(
      formatRelativeShort(iso, { rounding: "floor", now: NOW }),
      floor,
      label,
    );
    assert.equal(
      formatRelativeShort(iso, { rounding: "round", now: NOW }),
      round,
      label,
    );
    assert.equal(oldFloor(iso), floor, `${label} (old)`);
    assert.equal(oldRound(iso), round, `${label} (old)`);
  }
  for (const rounding of ["floor", "round"]) {
    assert.equal(formatRelativeShort("", { rounding, now: NOW }), "");
    assert.equal(formatRelativeShort(null, { rounding, now: NOW }), "");
    assert.equal(formatRelativeShort("garbage", { rounding, now: NOW }), "");
  }
  // Old round-mode output for an unparsable string.
  assert.equal(oldRound("garbage"), "NaNy");
  assert.equal(
    formatRelativeShort(NOW - 2 * D, { rounding: "floor", now: NOW }),
    "2d",
  );
  assert.throws(() => formatRelativeShort(NOW, {}), TypeError);
});

/** `Date` whose `now()` is fixed; `new Date(x)` still works. */
function fixedDate(now) {
  return class extends Date {
    static now() {
      return now;
    }
  };
}

test("formatDuration: card (seconds) vs preview (ms, hours)", () => {
  const oldCard = legacyFn(CARD_EXTRA, "formatDuration");
  const oldPreview = legacyFn(BEATMAP_PREVIEW, "formatPreviewTimeMs");
  const cases = [
    // seconds, card, preview
    [0, "0:00", "0:00"],
    [5.9, "0:05", "0:05"],
    [65, "1:05", "1:05"],
    [599, "9:59", "9:59"],
    [3599, "59:59", "59:59"],
    [3600, "60:00", "1:00:00"],
    [3700, "61:40", "1:01:40"],
    [-5, "0:00", "0:00"],
  ];
  for (const [sec, card, preview] of cases) {
    assert.equal(formatDuration(sec, DURATION_FORMAT.card), card);
    assert.equal(formatDuration(sec * 1000, DURATION_FORMAT.preview), preview);
    assert.equal(oldCard(sec), card, `${sec} (old)`);
    assert.equal(oldPreview(sec * 1000), preview, `${sec} (old)`);
  }
  assert.equal(formatDuration(NaN, DURATION_FORMAT.card), "0:00");
  assert.equal(formatDuration(undefined, DURATION_FORMAT.preview), "0:00");
  assert.equal(formatDuration("125", DURATION_FORMAT.card), oldCard("125"));
  assert.throws(() => formatDuration(1, { unit: "s" }), TypeError);
});

test("flagFilename matches both beatmap-detail versions", () => {
  const oldTop = legacyFn(LEGACY_SCOREBOARD, "_scoreTopFlagFilename");
  const oldRow = legacyFn(LEGACY_SCOREBOARD, "toUnicodeFlagFilename");
  const cases = [
    ["RU", "1f1f7-1f1fa"],
    ["kr", "1f1f0-1f1f7"],
    ["US", "1f1fa-1f1f8"],
    ["USA", null],
    ["1A", null],
    ["", null],
    [null, null],
  ];
  for (const [cc, expected] of cases) {
    assert.equal(flagFilename(cc), expected, String(cc));
    assert.equal(oldTop(cc), expected, `${cc} (old top)`);
    assert.equal(oldRow(cc), expected, `${cc} (old row)`);
  }
  // Surrounding whitespace: only the row version trimmed it.
  assert.equal(flagFilename(" ru "), "1f1f7-1f1fa");
  assert.equal(oldRow(" ru "), "1f1f7-1f1fa");
  assert.equal(oldTop(" ru "), null);
});

/** @param {string} locale */
function legacyDom(locale) {
  const { OsuExpertPlus } = loadScripts(["src/utils/dom.js"], {
    lang: locale,
    globals: { currentLocale: locale },
  });
  return OsuExpertPlus.dom;
}

test("parseLocaleNumber matches dom.parseLocaleNumber per locale", () => {
  const NBSP = "\u00A0";
  const NNBSP = "\u202F";
  const cases = [
    ["en", "1,234.5", 1234.5],
    ["en", "1,234", 1234],
    ["en", "987.6", 987.6],
    ["en", "123.456", 123.456],
    ["de", "1.234,5", 1234.5],
    ["de", "1.234", 1234],
    ["de", "987,6", 987.6],
    ["fr", `1${NBSP}234,5`, 1234.5],
    ["fr", `1${NNBSP}234,5`, 1234.5],
    ["fr", `1 234`, 1234],
    ["ko", "1,234.5", 1234.5],
    ["ko", "1,234", 1234],
    ["en", "", NaN],
    ["de", "abc", NaN],
  ];
  for (const [locale, input, expected] of cases) {
    const label = `${locale} ${JSON.stringify(input)}`;
    const actual = parseLocaleNumber(input, { locale });
    assert.ok(Object.is(actual, expected), `${label}: ${actual}`);
    const old = legacyDom(locale).parseLocaleNumber(input);
    assert.ok(Object.is(old, expected), `${label} (old): ${old}`);
  }
});

test("B19: raw API numbers in a comma-decimal locale", () => {
  // The locale parser reads "123.456" as a grouped thousand in de/fr …
  assert.equal(parseLocaleNumber("123.456", { locale: "de" }), 123456);
  assert.equal(legacyDom("de").parseLocaleNumber("123.456"), 123456);
  // … so raw API values (pp in a `title`) need parseApiNumber.
  const cases = [
    ["123.456", 123.456],
    [" 1234.5 ", 1234.5],
    ["-0.5", -0.5],
    ["1e3", 1000],
    [".5", 0.5],
    ["7", 7],
    [42.1, 42.1],
    ["1,234.5", NaN],
    ["123,456", NaN],
    ["", NaN],
    ["12abc", NaN],
    [null, NaN],
  ];
  for (const [input, expected] of cases) {
    assert.ok(
      Object.is(parseApiNumber(input), expected),
      JSON.stringify(input),
    );
  }
});

test("decimalSeparator", () => {
  assert.equal(decimalSeparator("en"), ".");
  assert.equal(decimalSeparator("de"), ",");
  assert.equal(decimalSeparator("fr"), ",");
  assert.equal(decimalSeparator("ko"), ".");
  assert.equal(decimalSeparator("not a locale!"), ".");
});

test("formatDecimal matches dom.formatDecimalPp", () => {
  for (const [locale, n] of [
    ["en", 1234.5],
    ["de", 1234.5],
    ["fr", 987.654],
    ["ko", 0.005],
  ]) {
    assert.equal(
      formatDecimal(n, { locale }),
      legacyDom(locale).formatDecimalPp(n),
      `${locale} ${n}`,
    );
  }
  assert.equal(formatDecimal(1234.5, { locale: "en" }), "1,234.50");
  assert.equal(formatDecimal(1234.5, { locale: "de" }), "1.234,50");
  assert.equal(formatDecimal(3.14159, { locale: "en", digits: 3 }), "3.142");
});
