import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RULESETS,
  isListingMode,
  isRuleset,
  normalizeRuleset,
  rulesetFromId,
  rulesetFromModeIconClass,
  rulesetFromProfileUrl,
  rulesetId,
} from "../../src/osu/ruleset.js";
import { modeIndexForRuleset } from "../../src/api/kirino.js";
import { legacyFn, USER_PROFILE } from "./legacy.mjs";

test("RULESETS order matches ruleset ids", () => {
  assert.deepEqual([...RULESETS], ["osu", "taiko", "fruits", "mania"]);
  assert.ok(Object.isFrozen(RULESETS));
});

test("rulesetFromId matches user-profile rulesetIdToMode", () => {
  const old = legacyFn(USER_PROFILE, "rulesetIdToMode");
  for (const id of [0, 1, 2, 3, "0", "3", 4, -1, null, undefined, "x"]) {
    assert.equal(rulesetFromId(id), old(id), `id ${String(id)}`);
  }
  assert.equal(rulesetFromId(9, null), null);
  assert.equal(rulesetFromId(2.5), "osu");
});

test("rulesetId matches Kirino's index", () => {
  for (const name of [...RULESETS, "nope", "", undefined, "Osu"]) {
    assert.equal(rulesetId(name), modeIndexForRuleset(name), String(name));
  }
  assert.equal(rulesetId("nope", null), null);
});

test("isRuleset / normalizeRuleset", () => {
  const cases = [
    ["osu", true, "osu"],
    ["mania", true, "mania"],
    ["Mania", false, "mania"],
    [" taiko ", false, "taiko"],
    ["catch", false, null],
    [3, false, null],
    [null, false, null],
  ];
  for (const [input, valid, normalized] of cases) {
    assert.equal(isRuleset(input), valid, String(input));
    assert.equal(normalizeRuleset(input), normalized, String(input));
  }
});

test("isListingMode accepts 0-3 only", () => {
  for (const [v, ok] of [
    ["0", true],
    ["3", true],
    ["4", false],
    ["03", false],
    ["", false],
    [0, false],
  ]) {
    assert.equal(isListingMode(v), ok, JSON.stringify(v));
  }
});

test("rulesetFromModeIconClass", () => {
  assert.equal(rulesetFromModeIconClass("fal fa-extra-mode-fruits"), "fruits");
  assert.equal(rulesetFromModeIconClass("fa-extra-mode-maniax"), null);
  assert.equal(rulesetFromModeIconClass(""), null);
  assert.equal(rulesetFromModeIconClass(undefined), null);
});

test("rulesetFromProfileUrl matches user-profile getModeFromUrl", () => {
  const cases = [
    ["/users/2", "", null],
    ["/users/2/taiko", "", "taiko"],
    ["/users/peppy/mania/", "", "mania"],
    ["/users/2/Taiko", "", null],
    ["/users/2/modding", "", null],
    ["/users/2", "?mode=fruits", "fruits"],
    ["/users/2", "?a=1&mode=osu", "osu"],
    ["/users/2", "?mode=catch", null],
  ];
  for (const [pathname, search, expected] of cases) {
    const old = legacyFn(USER_PROFILE, "getModeFromUrl", {
      PROFILE_MODES: RULESETS,
      location: { pathname, search },
    });
    assert.equal(old(), expected, `${pathname}${search} (old)`);
    assert.equal(
      rulesetFromProfileUrl(pathname, search),
      expected,
      pathname + search,
    );
  }
});
