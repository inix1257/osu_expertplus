import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

/** @param {string} locale osu-web's `window.currentLocale` */
function parseIn(locale) {
  const { OsuExpertPlus } = loadScripts(["src/utils/dom.js"], {
    lang: locale,
    globals: { currentLocale: locale },
  });
  return OsuExpertPlus.dom.parseLocaleNumber;
}

test("parseLocaleNumber: en", () => {
  const parse = parseIn("en");
  assert.equal(parse("1,234.56"), 1234.56);
  assert.equal(parse("1,234"), 1234);
  assert.equal(parse("987.6"), 987.6);
  assert.ok(Number.isNaN(parse("")));
});

test("parseLocaleNumber: de", () => {
  const parse = parseIn("de");
  assert.equal(parse("1.234,56"), 1234.56);
  assert.equal(parse("1.234"), 1234);
  assert.equal(parse("987,6"), 987.6);
});

test("parseLocaleNumber: fr (narrow no-break space grouping)", () => {
  const parse = parseIn("fr");
  assert.equal(parse("1\u202F234,56"), 1234.56);
  assert.equal(parse("1\u00A0234"), 1234);
  assert.equal(parse("987,6"), 987.6);
});

test("parseLocaleNumber: ko", () => {
  const parse = parseIn("ko");
  assert.equal(parse("1,234.56"), 1234.56);
  assert.equal(parse("1,234"), 1234);
});
