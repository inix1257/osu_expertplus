import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SPEED_DOWN,
  DIFFICULTY_MODS,
  DEFAULT_SPEED_UP,
  RATE_DISPLAY,
  defaultSpeedChange,
  difficultyMods,
  formatSpeedChange,
  isModCustomised,
  isNonDefaultSpeed,
  modAcronym,
  modAcronyms,
  modFullName,
  modIconSuffix,
  modRateLabel,
  modSettings,
  modTypeClass,
  scoreHasNonstandardRate,
  speedChangeFromMod,
} from "../../src/osu/mods.js";
import { loadScripts } from "../helpers/load-script.mjs";
import { LEGACY_SCOREBOARD, USER_PROFILE, legacyFn } from "./legacy.mjs";

const SPEED_DEPS = {
  SCOREBOARD_MOD_DEFAULT_SPEED_UP: 1.5,
  SCOREBOARD_MOD_DEFAULT_SPEED_DOWN: 0.75,
  SCOREBOARD_MOD_SPEED_EPS: 0.005,
};
const oldShouldShow = legacyFn(
  LEGACY_SCOREBOARD,
  "shouldShowScoreboardModSpeedIndicator",
  SPEED_DEPS,
);
const oldSpeedChange = legacyFn(LEGACY_SCOREBOARD, "speedChangeFromScoreMod");
const oldFormatRate = legacyFn(
  LEGACY_SCOREBOARD,
  "formatScoreboardModSpeedRate",
);

test("modAcronym / modAcronyms: strings and objects", () => {
  const cases = [
    ["HD", "HD"],
    [{ acronym: "DT", settings: { speed_change: 1.2 } }, "DT"],
    [{ acronym: "" }, null],
    [{}, null],
    [null, null],
    ["", null],
  ];
  for (const [mod, expected] of cases) {
    assert.equal(modAcronym(mod), expected, JSON.stringify(mod));
  }
  const old = legacyFn(USER_PROFILE, "modsAcronymsFromApiMods");
  const list = [
    "HD",
    { acronym: "DT" },
    null,
    { foo: 1 },
    "",
    { acronym: "CL" },
  ];
  assert.deepEqual(modAcronyms(list), ["HD", "DT", "CL"]);
  assert.deepEqual(modAcronyms(list), old(list));
  assert.deepEqual(modAcronyms(undefined), old(undefined));
  assert.deepEqual(modAcronyms("HD"), []);
});

test("modSettings / isModCustomised (DA, rate, none)", () => {
  const da = {
    acronym: "DA",
    settings: { approach_rate: 9.5, circle_size: 4 },
  };
  assert.deepEqual(modSettings(da), { approach_rate: 9.5, circle_size: 4 });
  assert.equal(isModCustomised(da), true);
  assert.equal(Number.isNaN(speedChangeFromMod(da)), true);
  for (const opts of Object.values(RATE_DISPLAY)) {
    assert.equal(modRateLabel(da, opts), "");
  }
  assert.equal(isModCustomised({ acronym: "DA", settings: {} }), false);
  assert.equal(isModCustomised({ acronym: "HD" }), false);
  assert.equal(isModCustomised("DA"), false);
  assert.equal(modSettings("DA"), null);
  assert.equal(modSettings({ acronym: "X", settings: 3 }), null);
});

test("speedChangeFromMod matches speedChangeFromScoreMod", () => {
  const cases = [
    "DT",
    { acronym: "DT" },
    { acronym: "DT", settings: { speed_change: 1.3 } },
    { acronym: "HT", settings: { speed_change: "0.8" } },
    { acronym: "DT", settings: { speed_change: 0 } },
    { acronym: "DT", settings: { speed_change: -1 } },
    { acronym: "DT", settings: { speed_change: "x" } },
    null,
  ];
  for (const mod of cases) {
    const a = speedChangeFromMod(mod);
    const b = oldSpeedChange(mod);
    assert.ok(Object.is(a, b), JSON.stringify(mod));
  }
});

test("default rates: DT/NC 1.5, HT/DC 0.75", () => {
  assert.equal(defaultSpeedChange("DT"), DEFAULT_SPEED_UP);
  assert.equal(defaultSpeedChange("nc"), 1.5);
  assert.equal(defaultSpeedChange("HT"), DEFAULT_SPEED_DOWN);
  assert.equal(defaultSpeedChange(" DC "), 0.75);
  assert.equal(defaultSpeedChange("HD"), null);
});

test("isNonDefaultSpeed matches shouldShowScoreboardModSpeedIndicator", () => {
  const cases = [
    ["DT", 1.5, false],
    ["DT", 1.504, false],
    ["DT", 1.506, true],
    ["NC", 1.2, true],
    ["HT", 0.75, false],
    ["DC", 0.8, true],
    ["HT", 1.5, true],
    ["WU", 1.5, false],
    ["WU", 1.0, true],
    ["DT", NaN, false],
    ["DT", 0, false],
  ];
  for (const [ac, rate, expected] of cases) {
    assert.equal(isNonDefaultSpeed(ac, rate), expected, `${ac} ${rate}`);
    assert.equal(oldShouldShow(ac, rate), expected, `${ac} ${rate} (old)`);
  }
});

test("formatSpeedChange: fixed vs trim", () => {
  const cases = [
    [1.5, "1.50×", "1.5×"],
    [1.2, "1.20×", "1.2×"],
    [1.25, "1.25×", "1.25×"],
    [1.333, "1.33×", "1.33×"],
    [1, "1.00×", "1×"],
    [0.75, "0.75×", "0.75×"],
    [2, "2.00×", "2×"],
    [0, "", ""],
    [NaN, "", ""],
  ];
  for (const [rate, fixed, trim] of cases) {
    assert.equal(formatSpeedChange(rate, { style: "fixed" }), fixed);
    assert.equal(formatSpeedChange(rate, { style: "trim" }), trim);
    assert.equal(oldFormatRate(rate), trim, `${rate} (old)`);
  }
  assert.throws(() => formatSpeedChange(1.5, {}), TypeError);
});

test("modRateLabel: profile vs scoreboard", () => {
  const cases = [
    // mod, profile label, scoreboard label
    [{ acronym: "DT", settings: { speed_change: 1.5 } }, "1.50×", ""],
    [{ acronym: "DT", settings: { speed_change: 1.3 } }, "1.30×", "1.3×"],
    [{ acronym: "NC", settings: { speed_change: 1.75 } }, "1.75×", "1.75×"],
    [{ acronym: "HT", settings: { speed_change: 0.75 } }, "0.75×", ""],
    [{ acronym: "DC", settings: { speed_change: 0.6 } }, "0.60×", "0.6×"],
    [{ acronym: "DT" }, "", ""],
    ["DT", "", ""],
  ];
  for (const [mod, profile, scoreboard] of cases) {
    assert.equal(modRateLabel(mod, RATE_DISPLAY.profile), profile);
    assert.equal(modRateLabel(mod, RATE_DISPLAY.scoreboard), scoreboard);
  }
  assert.throws(() => modRateLabel(cases[0][0], { style: "trim" }), TypeError);
});

test("scoreHasNonstandardRate matches beatmap-detail", () => {
  const old = legacyFn(LEGACY_SCOREBOARD, "scoreHasNonstandardRate", {
    speedChangeFromScoreMod: oldSpeedChange,
    shouldShowScoreboardModSpeedIndicator: oldShouldShow,
  });
  const scores = [
    { mods: [] },
    { mods: ["DT", "HD"] },
    { mods: [{ acronym: "DT", settings: { speed_change: 1.5 } }] },
    { mods: [{ acronym: "DT", settings: { speed_change: 1.4 } }] },
    { mods: [{ acronym: "HD" }, { acronym: "HT", settings: {} }] },
    {},
    null,
  ];
  for (const s of scores) {
    assert.equal(scoreHasNonstandardRate(s), old(s), JSON.stringify(s));
  }
  assert.equal(scoreHasNonstandardRate(scores[3]), true);
});

test("modTypeClass matches mod-icons modTypeClassForAcronym", () => {
  const { OsuExpertPlus } = loadScripts([
    "src/utils/dom.js",
    "src/utils/settings.js",
    "src/utils/mod-icons-as-acronyms.js",
  ]);
  const old = OsuExpertPlus.modIconsAsAcronyms.modTypeClassForAcronym;
  const cases = [
    ["EZ", "mod--type-DifficultyReduction"],
    ["dt", "mod--type-DifficultyIncrease"],
    ["DA", "mod--type-Conversion"],
    ["4K", "mod--type-Conversion"],
    ["10K", "mod--type-Conversion"],
    ["RX", "mod--type-Automation"],
    ["SV2", "mod--type-System"],
    ["WG", "mod--type-Fun"],
    ["??", "mod--type-Fun"],
  ];
  for (const [ac, expected] of cases) {
    assert.equal(modTypeClass(ac), expected, ac);
    assert.equal(old(ac), expected, `${ac} (old)`);
  }
});

test("modFullName matches beatmap-detail", () => {
  const old = legacyFn(LEGACY_SCOREBOARD, "modFullName");
  for (const ac of ["DT", "hd", " NC ", "4K", "10K", "11K", "SV2", "ZZ", ""]) {
    assert.equal(modFullName(ac), old(ac), JSON.stringify(ac));
  }
  assert.equal(modFullName("DA"), "Difficulty Adjust");
  assert.equal(modFullName("7K"), "7 Key Mod");
  assert.equal(modFullName(undefined), "");
});

test("difficultyMods matches user-profile _diffMods", () => {
  const oldSet = new Set([
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
  assert.deepEqual([...DIFFICULTY_MODS].sort(), [...oldSet].sort());
  const old = legacyFn(USER_PROFILE, "_diffMods", { DIFFICULTY_MODS: oldSet });
  for (const list of [
    ["HD", "dt", "HR"],
    ["NF", "SD"],
    ["DA", "CL", "EZ", "FL"],
    [],
  ]) {
    assert.deepEqual(difficultyMods(list), old(list), list.join(","));
  }
  assert.deepEqual(difficultyMods(["HD", "dt", "HR"]), ["DT", "HR"]);
});

test("modIconSuffix", () => {
  assert.equal(modIconSuffix("DT"), "DT");
  assert.equal(modIconSuffix("4K"), "4K");
  assert.equal(modIconSuffix("A-B"), "AB");
  assert.equal(modIconSuffix("--"), "X");
});
