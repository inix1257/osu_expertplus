import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/difficulty-colours.js"]);
const { getDiffColour, getDiffTextColour } =
  window.OsuExpertPlus.difficultyColours;

test("star colours interpolate like osu-web's d3 gamma 2.2 (B108)", () => {
  // d3.scaleLinear().interpolate(d3.interpolateRgb.gamma(2.2)) on osu-web's
  // domain and range (beatmap-helper.ts).
  assert.equal(getDiffColour(7.2), "#4b49bb");
  assert.equal(getDiffColour(3.75), "#fbc262");
  assert.equal(getDiffColour(2.25), "#68ffa3");
  // Domain stops are the range colours exactly.
  assert.equal(getDiffColour(0.1), "#4290fb");
  assert.equal(getDiffColour(5.8), "#c645b8");
  assert.equal(getDiffColour(0.05), "#AAAAAA");
  assert.equal(getDiffColour(9), "#000000");
  // Text ramp stops are unchanged.
  assert.equal(getDiffTextColour(9.9), "#ff8068");
  assert.equal(getDiffTextColour(5), "#000000");
});
