import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

/** jsdom window with the dom and settings scripts, exposed as globals. */
function setup() {
  const { window } = loadScripts(
    ["src/utils/dom.js", "src/utils/settings.js"],
    {
      url: "https://osu.ppy.sh/users/2/osu",
    },
  );
  for (const key of [
    "window",
    "document",
    "location",
    "Node",
    "Element",
    "HTMLElement",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  return window;
}

/** The parts of osu-web's `.play-detail` row the stats row touches. */
function playDetailRow(doc) {
  const row = doc.createElement("div");
  row.className = "play-detail";
  row.innerHTML = `
    <div class="play-detail__score-detail-top-right">
      <div class="play-detail__accuracy-and-weighted-pp">
        <span class="play-detail__accuracy">98.50%</span>
      </div>
    </div>`;
  doc.body.append(row);
  return row;
}

const window = setup();
const { injectStatsRow, _applyApiMaxComboToComboInline } =
  await import("../../src/features/profile/score-stats.js");

function comboNums(row) {
  return [...row.querySelectorAll(".oep-combo-inline__num")].map((n) => ({
    text: n.textContent,
    full: n.classList.contains("oep-combo-inline__num--full"),
  }));
}

function statsValues(row) {
  return [...row.querySelectorAll(".oep-score-stats > span")]
    .filter((n) => !n.classList.contains("oep-score-stats__sep"))
    .map(
      (n) =>
        `${n.className.replace("oep-score-stats__val--", "")}=${n.textContent}`,
    );
}

test("osu! stats row: lazer and legacy statistics (D10-5)", () => {
  const doc = window.document;
  const lazer = playDetailRow(doc);
  injectStatsRow(lazer, {
    ruleset_id: 0,
    max_combo: 100,
    beatmap: { max_combo: 200 },
    statistics: { great: 90, ok: 5, meh: 1, miss: 2 },
  });
  assert.deepEqual(statsValues(lazer), ["300=90", "100=5", "50=1", "miss=2"]);
  assert.deepEqual(comboNums(lazer), [
    { text: "100", full: false },
    { text: "200", full: true },
  ]);

  const legacy = playDetailRow(doc);
  injectStatsRow(legacy, {
    ruleset_id: 0,
    statistics: { count_300: 10, count_geki: 2, count_100: 1 },
  });
  assert.deepEqual(statsValues(legacy), ["300=10", "100=1", "50=0", "miss=0"]);
});

test("mania stats row keeps the profile class names", () => {
  const row = playDetailRow(window.document);
  injectStatsRow(row, {
    ruleset_id: 3,
    statistics: { perfect: 5, great: 4, good: 3, ok: 2, meh: 1, miss: 0 },
  });
  assert.deepEqual(statsValues(row), [
    "perfect=5",
    "300=4",
    "good=3",
    "100=2",
    "50=1",
    "miss=0",
  ]);
});

test("full combo trusts the score's perfect flag, also after the attributes lookup (D10-7)", () => {
  const row = playDetailRow(window.document);
  // A perfect-combo score whose map max is unknown until the lookup.
  injectStatsRow(row, {
    ruleset_id: 0,
    max_combo: 499,
    is_perfect_combo: true,
    statistics: {},
  });
  assert.deepEqual(comboNums(row), [
    { text: "499", full: true },
    { text: "0", full: false },
  ]);
  _applyApiMaxComboToComboInline(row, 500);
  assert.deepEqual(comboNums(row), [
    { text: "499", full: true },
    { text: "500", full: true },
  ]);

  // No flag: only achieved === map max counts.
  const plain = playDetailRow(window.document);
  injectStatsRow(plain, { ruleset_id: 0, max_combo: 499, statistics: {} });
  _applyApiMaxComboToComboInline(plain, 500);
  assert.equal(comboNums(plain)[0].full, false);
  _applyApiMaxComboToComboInline(plain, 499);
  assert.equal(comboNums(plain)[0].full, true);
});

test("mania max combo comes from maximum_statistics.perfect (B68)", () => {
  const row = playDetailRow(window.document);
  injectStatsRow(row, {
    ruleset_id: 3,
    max_combo: 120,
    maximum_statistics: {
      perfect: 100,
      legacy_combo_increase: 20,
      ignore_hit: 40,
    },
    statistics: { perfect: 90 },
  });
  assert.deepEqual(comboNums(row), [
    { text: "120", full: true },
    { text: "120", full: true },
  ]);
});

test("pp decimals read API pp as API numbers in any locale (B109)", async () => {
  const { injectMostWatchedPpRow } =
    await import("../../src/features/profile/score-stats.js");
  const { applyPpDecimals } =
    await import("../../src/features/profile/score-rows.js");
  const doc = window.document;
  doc.documentElement.lang = "de";
  try {
    const list = doc.createElement("div");
    list.innerHTML = `
      <div class="play-detail"><div class="play-detail__pp"></div></div>
      <div class="play-detail"><div class="play-detail__pp"><span title="1.234,5">1.235</span></div></div>`;
    injectMostWatchedPpRow(list.children[0], { pp: 441.746 });
    applyPpDecimals(list);
    const texts = [...list.querySelectorAll(".play-detail__pp > span")].map(
      (s) => s.firstChild.textContent,
    );
    // Expert+'s span from the API, then osu-web's own title (page locale).
    assert.deepEqual(texts, ["441,75 ", "1.234,50 "]);
  } finally {
    doc.documentElement.lang = "";
  }
});
