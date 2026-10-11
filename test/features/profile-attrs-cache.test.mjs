import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"]);
for (const key of [
  "window",
  "document",
  "OsuExpertPlus",
  "GM_getValue",
  "GM_setValue",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
const { createAttrsStore } =
  await import("../../src/features/profile/beatmap-attributes.js");

const DAY = 24 * 60 * 60 * 1000;

function harness(initial = {}, opts = {}) {
  let clock = 1_000_000;
  const writes = [];
  const timers = [];
  const store = createAttrsStore({
    read: () => structuredClone(initial),
    write: (s) => writes.push(s),
    now: () => clock,
    setTimer: (fn) => timers.push(fn),
    maxEntries: 3,
    ...opts,
  });
  return {
    store,
    writes,
    advance: (ms) => (clock += ms),
    runTimers: () => timers.splice(0).forEach((fn) => fn()),
    get clock() {
      return clock;
    },
  };
}

test("reads the GM value once and batches writes", () => {
  let reads = 0;
  const h = harness({}, { read: () => (reads++, {}) });
  h.store.set("a", { sr: 1, maxCombo: 10 });
  h.store.set("b", { sr: 2, maxCombo: 20 });
  assert.deepEqual(h.store.get("a"), { sr: 1, maxCombo: 10 });
  assert.equal(reads, 1);
  assert.equal(h.writes.length, 0, "nothing written before the timer");
  h.runTimers();
  assert.equal(h.writes.length, 1);
  assert.deepEqual(Object.keys(h.writes[0]), ["b", "a"], "LRU order");
});

test("evicts the least recently used past maxEntries", () => {
  const h = harness();
  for (const k of ["a", "b", "c"]) h.store.set(k, { sr: 1, maxCombo: 1 });
  h.store.get("a"); // a is now the most recently used
  h.store.set("d", { sr: 1, maxCombo: 1 });
  assert.equal(h.store.get("b"), undefined, "b was the least recently used");
  for (const k of ["a", "c", "d"]) assert.ok(h.store.get(k), k);
});

test("drops expired and maxCombo 0 entries", () => {
  const h = harness({
    old: { t: 1_000_000 - 15 * DAY, sr: 5, maxCombo: 100 },
    zero: { t: 1_000_000, sr: 5, maxCombo: 0 },
    ok: { t: 1_000_000, sr: 5, maxCombo: 100 },
  });
  assert.equal(h.store.get("old"), undefined);
  assert.equal(h.store.get("zero"), undefined);
  assert.deepEqual(h.store.get("ok"), { sr: 5, maxCombo: 100 });
  h.advance(15 * DAY);
  assert.equal(h.store.get("ok"), undefined, "expires 14 days after storing");
  h.runTimers();
  assert.deepEqual(h.writes.at(-1), {});
});

test("clear writes an empty store right away", () => {
  const h = harness({ a: { t: 1_000_000, sr: 1, maxCombo: 1 } });
  h.store.clear();
  assert.deepEqual(h.writes, [{}]);
  assert.equal(h.store.get("a"), undefined);
});

test("only ranked, approved and loved maps are permanent (B37)", async () => {
  const { isPermanentBeatmap } =
    await import("../../src/features/profile/beatmap-attributes.js");
  for (const ranked of [1, 2, 4, "1"]) {
    assert.equal(isPermanentBeatmap({ ranked }), true, `ranked ${ranked}`);
  }
  for (const ranked of [0, -1, -2, 3]) {
    assert.equal(isPermanentBeatmap({ ranked }), false, `ranked ${ranked}`);
  }
  assert.equal(isPermanentBeatmap({ status: "loved" }), true);
  assert.equal(isPermanentBeatmap({ status: "qualified" }), false);
  assert.equal(isPermanentBeatmap({}), false, "unknown is not permanent");
  assert.equal(isPermanentBeatmap(undefined), false);
});

const { rowHasCustomDifficultySettings } =
  await import("../../src/features/profile/beatmap-attributes.js");

function rowWithMods(html) {
  const row = window.document.createElement("div");
  row.className = "play-detail";
  row.innerHTML = `<div class="mods">${html}</div>`;
  return row;
}

const mod = (ac, extra = "") =>
  `<div class="mod"><div class="mod__icon" data-acronym="${ac}"></div>${extra}</div>`;
const ext = (text) => `<div class="mod__extender"><span>${text}</span></div>`;
const cog = '<div class="mod__customised-indicator"></div>';

test("B36: custom rates and customised DA hide the SR badge", () => {
  const cases = [
    [mod("DT"), false],
    [mod("DT", ext("1.50x") + cog), false],
    [mod("DT", ext("1.20x") + cog), true],
    [mod("NC", ext("1.30×")), true],
    [mod("HT", ext("0.75x")), false],
    [mod("DC", ext("0.60x")), true],
    [mod("HD") + mod("HR", cog), false],
    [mod("DA"), false],
    [mod("DA", ext("AR9") + cog), true],
    [mod("DA", cog), true],
    [mod("HD") + mod("DT", ext("1.10x")), true],
  ];
  for (const [html, expected] of cases) {
    assert.equal(
      rowHasCustomDifficultySettings(rowWithMods(html)),
      expected,
      html,
    );
  }
});
