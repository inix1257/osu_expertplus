import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCURACY_FORMAT,
  STATS_DISPLAY,
  beatmapMaxComboFromScore,
  formatAccuracy,
  formatCombo,
  hitstatClassFromLabel,
  hitstatValue,
  isFullCombo,
  isPerfectAccuracy,
  leaderboardScoreId,
  normalizeStatistics,
  scoreGrade,
  scoreIndicatesPerfectCombo,
  scoreMergeKey,
  statsCells,
} from "../../src/osu/score.js";
import { BEATMAP_DETAIL, USER_PROFILE, legacyFn } from "./legacy.mjs";

const PROFILE = { legacyOsuGreat: "300+geki" };
const SCOREBOARD = { legacyOsuGreat: "300" };

test("scoreGrade matches scoreRankForApiScore (and sanitized grade cells)", () => {
  const old = legacyFn(USER_PROFILE, "scoreRankForApiScore");
  const cases = [
    [{ rank: "XH" }, "XH", "XH"],
    [{ rank: { name: "SH" } }, "SH", "SH"],
    [{ rank: "S+" }, "S+", "S"],
    [{ rank: "--" }, "--", "D"],
    [{ passed: false }, "F", "F"],
    [{ passed: true }, "D", "D"],
    [{ rank: 5, passed: false }, "F", "F"],
    [null, "D", "D"],
  ];
  for (const [score, raw, sanitized] of cases) {
    assert.equal(scoreGrade(score), raw, JSON.stringify(score));
    assert.equal(old(score), raw, `${JSON.stringify(score)} (old)`);
    assert.equal(scoreGrade(score, { sanitize: true }), sanitized);
  }
});

test("formatAccuracy: profile vs scoreboard", () => {
  const oldProfile = legacyFn(USER_PROFILE, "formatAccuracyPercent");
  const oldScoreboard = (acc) =>
    typeof acc === "number" ? `${(acc * 100).toFixed(2)}%` : "";
  const cases = [
    // accuracy, profile, scoreboard
    [0.98765, "98.77%", "98.77%"],
    [1, "100.00%", "100.00%"],
    [0, "0.00%", "0.00%"],
    [98.5, "98.50%", "9850.00%"],
    ["0.95", "95.00%", ""],
    [null, "—", ""],
    [undefined, "—", ""],
    [NaN, "—", ""],
  ];
  for (const [acc, profile, scoreboard] of cases) {
    assert.equal(formatAccuracy(acc, ACCURACY_FORMAT.profile), profile);
    assert.equal(formatAccuracy(acc, ACCURACY_FORMAT.scoreboard), scoreboard);
    assert.equal(oldProfile({ accuracy: acc }), profile, `${acc} (old)`);
    if (!Number.isNaN(acc)) {
      assert.equal(oldScoreboard(acc), scoreboard, `${acc} (old)`);
    }
  }
  // The old scoreboard code printed "NaN%" for NaN; the helper gives "".
  assert.equal(oldScoreboard(NaN), "NaN%");
  assert.throws(() => formatAccuracy(0.9, {}), TypeError);
});

test("isPerfectAccuracy and formatCombo", () => {
  assert.equal(isPerfectAccuracy(1), true);
  assert.equal(isPerfectAccuracy(0.9999), false);
  assert.equal(isPerfectAccuracy("1"), false);
  assert.equal(formatCombo(1234), "1,234x");
  assert.equal(formatCombo(undefined), "0x");
});

test("normalizeStatistics: osu lazer and legacy", () => {
  const old = legacyFn(USER_PROFILE, "_normalizeOsuStatistics");
  const cases = [
    // statistics, profile (300+geki), scoreboard (300)
    [
      { great: 500, ok: 20, meh: 3, miss: 1 },
      { great: 500, ok: 20, meh: 3, miss: 1 },
      { great: 500, ok: 20, meh: 3, miss: 1 },
    ],
    [
      { great: 10, perfect: 2, miss: 0 },
      { great: 12, ok: 0, meh: 0, miss: 0 },
      { great: 12, ok: 0, meh: 0, miss: 0 },
    ],
    [
      { count_300: 400, count_100: 30, count_50: 2, count_miss: 4 },
      { great: 400, ok: 30, meh: 2, miss: 4 },
      { great: 400, ok: 30, meh: 2, miss: 4 },
    ],
    [
      { count_300: 400, count_geki: 80, count_katu: 9, count_100: 30 },
      { great: 480, ok: 30, meh: 0, miss: 0 },
      { great: 400, ok: 30, meh: 0, miss: 0 },
    ],
    [
      {},
      { great: 0, ok: 0, meh: 0, miss: 0 },
      { great: 0, ok: 0, meh: 0, miss: 0 },
    ],
    [
      null,
      { great: 0, ok: 0, meh: 0, miss: 0 },
      { great: 0, ok: 0, meh: 0, miss: 0 },
    ],
  ];
  for (const [st, profile, scoreboard] of cases) {
    assert.deepEqual(normalizeStatistics(st, "osu", PROFILE), profile);
    assert.deepEqual(old(st), profile, `${JSON.stringify(st)} (old)`);
    assert.deepEqual(normalizeStatistics(st, "osu", SCOREBOARD), scoreboard);
  }
  // API v1 style keys (scoreboard reads them)
  assert.deepEqual(
    normalizeStatistics(
      { count300: 7, count100: 2, countmiss: 1 },
      "osu",
      SCOREBOARD,
    ),
    { great: 7, ok: 2, meh: 0, miss: 1 },
  );
  assert.throws(() => normalizeStatistics({}, "osu", {}), TypeError);
});

test("normalizeStatistics: taiko, fruits, mania (lazer and legacy)", () => {
  const cases = [
    ["taiko", { great: 900, ok: 40, miss: 3 }, { great: 900, ok: 40, miss: 3 }],
    [
      "taiko",
      { count_300: 900, count_100: 40, count_miss: 3, count_geki: 5 },
      { great: 900, ok: 40, miss: 3 },
    ],
    [
      "fruits",
      { great: 600, large_tick_hit: 50, small_tick_hit: 300, miss: 2 },
      { great: 600, large_tick_hit: 50, small_tick_hit: 300, miss: 2 },
    ],
    [
      "fruits",
      { great: 600, small_tick_miss: 4 },
      { great: 600, large_tick_hit: 0, small_tick_hit: 0, miss: 0 },
    ],
    [
      "fruits",
      {
        count_300: 600,
        count_100: 50,
        count_50: 300,
        count_katu: 4,
        count_miss: 2,
      },
      { great: 600, large_tick_hit: 50, small_tick_hit: 300, miss: 2 },
    ],
    [
      "mania",
      { perfect: 1000, great: 200, good: 30, ok: 10, meh: 5, miss: 1 },
      { perfect: 1000, great: 200, good: 30, ok: 10, meh: 5, miss: 1 },
    ],
    [
      "mania",
      { perfect: 1000 },
      { perfect: 1000, great: 0, good: 0, ok: 0, meh: 0, miss: 0 },
    ],
    [
      "mania",
      {
        count_geki: 1000,
        count_300: 200,
        count_katu: 30,
        count_100: 10,
        count_50: 5,
        count_miss: 1,
      },
      { perfect: 1000, great: 200, good: 30, ok: 10, meh: 5, miss: 1 },
    ],
  ];
  for (const [ruleset, st, expected] of cases) {
    for (const opts of [PROFILE, SCOREBOARD]) {
      assert.deepEqual(
        normalizeStatistics(st, ruleset, opts),
        expected,
        `${ruleset} ${JSON.stringify(st)}`,
      );
    }
  }
});

test("statsCells: order and class names per scheme", () => {
  const cls = (cells) => cells.map((c) => c.className.split("--")[1]);
  const vals = (cells) => cells.map((c) => c.value);
  const mania = {
    ruleset_id: 3,
    statistics: { perfect: 9, great: 8, good: 7, ok: 6, meh: 5, miss: 4 },
  };
  assert.deepEqual(
    vals(statsCells(mania, STATS_DISPLAY.profile)),
    [9, 8, 7, 6, 5, 4],
  );
  assert.deepEqual(cls(statsCells(mania, STATS_DISPLAY.profile)), [
    "perfect",
    "300",
    "good",
    "100",
    "50",
    "miss",
  ]);
  assert.deepEqual(cls(statsCells(mania, STATS_DISPLAY.scoreboard)), [
    "mania-perfect",
    "300",
    "mania-good",
    "100",
    "50",
    "miss",
  ]);
  const fruits = {
    ruleset_id: 2,
    statistics: { great: 3, large_tick_hit: 2, small_tick_hit: 1 },
  };
  assert.deepEqual(cls(statsCells(fruits, STATS_DISPLAY.profile)), [
    "300",
    "100",
    "50",
    "miss",
  ]);
  assert.deepEqual(cls(statsCells(fruits, STATS_DISPLAY.scoreboard)), [
    "300",
    "ctb-l",
    "ctb-drp",
    "miss",
  ]);
  const taiko = { ruleset_id: 1, statistics: { great: 3, ok: 2 } };
  assert.deepEqual(vals(statsCells(taiko, STATS_DISPLAY.profile)), [3, 2, 0]);
  const osuLegacy = {
    statistics: { count_300: 10, count_geki: 2, count_100: 1 },
  };
  assert.deepEqual(
    vals(statsCells(osuLegacy, STATS_DISPLAY.profile)),
    [12, 1, 0, 0],
  );
  assert.deepEqual(
    vals(statsCells(osuLegacy, STATS_DISPLAY.scoreboard)),
    [10, 1, 0, 0],
  );
  assert.equal(
    statsCells(osuLegacy, STATS_DISPLAY.profile)[0].className,
    "oep-score-stats__val--300",
  );
});

test("hitstatValue matches hitstatTextFromHeaderLabel", () => {
  const scores = [
    { statistics: { great: 500, perfect: 3, ok: 20, meh: 4, miss: 2 } },
    {
      statistics: {
        count_300: 400,
        count_geki: 50,
        count_katu: 7,
        count_100: 30,
        count_50: 2,
        count_miss: 1,
      },
    },
    {
      statistics: {
        great: 600,
        large_tick_hit: 50,
        small_tick_hit: 300,
        miss: 1,
      },
    },
    { statistics: { perfect: 1000, great: 200, good: 30, ok: 10, meh: 5 } },
    { count300: 5, countmiss: 2, countgeki: 1 },
    { statistics: { slider_tail_hit: 40, large_tick_hit: 12 } },
    null,
  ];
  const labels = [
    "300",
    "great",
    "100",
    "ok",
    "50",
    "meh",
    "miss",
    "m",
    "mania_perfect",
    "mania_good",
    "ctb_l",
    "ctb_drp",
    "drp",
    "l",
    "geki",
    "max",
    "320",
    "katu",
    "200",
    "tick",
    "tail",
    "???",
  ];
  for (const ruleset of ["osu", "fruits"]) {
    const old = legacyFn(BEATMAP_DETAIL, "hitstatTextFromHeaderLabel", {
      getBeatmapPageRuleset: () => ruleset,
    });
    for (const score of scores) {
      for (const label of labels) {
        assert.equal(
          hitstatValue(label, score, { ruleset }),
          old(label, score),
          `${ruleset} ${label} ${JSON.stringify(score)}`,
        );
      }
    }
  }
  assert.equal(hitstatValue("300", scores[1]), "400");
  assert.equal(hitstatValue("l", scores[2], { ruleset: "fruits" }), "50");
  assert.equal(hitstatValue("l", scores[2], { ruleset: "osu" }), "0");
});

test("hitstatClassFromLabel matches beatmapHitstatColorClassFromLabel", () => {
  const old = legacyFn(BEATMAP_DETAIL, "beatmapHitstatColorClassFromLabel");
  const cases = [
    ["mania_perfect", "mania-perfect"],
    ["mania_good", "mania-good"],
    ["ctb_l", "ctb-l"],
    ["ctb_drp", "ctb-drp"],
    ["miss", "miss"],
    ["m", "miss"],
    ["meh", "50"],
    ["50", "50"],
    ["geki", "300"],
    ["max", "300"],
    ["320", "300"],
    ["katu", "100"],
    ["200", "100"],
    ["ok", "100"],
    ["100", "100"],
    ["300", "300"],
    ["great", "300"],
    ["", null],
    ["drp", null],
  ];
  for (const [label, suffix] of cases) {
    const expected = suffix ? `oep-score-stats__val--${suffix}` : "";
    assert.equal(hitstatClassFromLabel(label), expected, label);
    assert.equal(old(label), expected, `${label} (old)`);
  }
});

test("full combo: profile (combo only) vs scoreboard (API flags)", () => {
  const cases = [
    // score, map max combo, profile, scoreboard
    [{ max_combo: 500 }, 500, true, true],
    [{ max_combo: 499 }, 500, false, false],
    [{ max_combo: 499, is_perfect_combo: true }, 500, false, true],
    [{ max_combo: 0, legacy_perfect: true }, null, false, true],
    [{ max_combo: 300, perfect: true }, 500, false, true],
    [
      { max_combo: 300, maximum_statistics: { max_combo: 300 } },
      null,
      false,
      true,
    ],
    [{ max_combo: 300, statistics: { maxCombo: 300 } }, 0, false, true],
    [{ max_combo: 0 }, 0, false, false],
    [{}, 500, false, false],
  ];
  for (const [score, mapMax, profile, scoreboard] of cases) {
    const label = `${JSON.stringify(score)} / ${mapMax}`;
    assert.equal(
      isFullCombo(score, mapMax, { apiFlags: false }),
      profile,
      label,
    );
    assert.equal(
      isFullCombo(score, mapMax, { apiFlags: true }),
      scoreboard,
      label,
    );
  }
  assert.throws(() => isFullCombo({}, 1, {}), TypeError);
});

test("scoreIndicatesPerfectCombo matches scoreApiIndicatesComboPerfect", () => {
  const old = legacyFn(BEATMAP_DETAIL, "scoreApiIndicatesComboPerfect");
  for (const s of [
    { perfect: true },
    { is_perfect_combo: true },
    { legacy_perfect: true },
    { perfect: 1 },
    {},
    null,
  ]) {
    assert.equal(scoreIndicatesPerfectCombo(s), old(s), JSON.stringify(s));
  }
});

test("beatmapMaxComboFromScore matches _beatmapMaxComboFromScore except B68", () => {
  const old = legacyFn(USER_PROFILE, "_beatmapMaxComboFromScore");
  const same = [
    { beatmap: { max_combo: 1234 } },
    { beatmap: { max_combo: "77" }, maximum_statistics: { great: 1 } },
    {
      ruleset_id: 0,
      maximum_statistics: { great: 300, legacy_combo_increase: 50 },
    },
    {
      ruleset_id: 0,
      maximum_statistics: {
        great: 300,
        large_tick_hit: 40,
        small_tick_hit: 2,
        slider_tail_hit: 60,
      },
    },
    { ruleset_id: 0, maximum_statistics: { large_tick_hit: 40 } },
    { ruleset_id: 1, maximum_statistics: { great: 800, small_bonus: 30 } },
    { ruleset_id: 1, maximum_statistics: {} },
    {
      ruleset_id: 2,
      maximum_statistics: {
        great: 500,
        large_tick_hit: 70,
        small_tick_hit: 400,
      },
    },
    {
      ruleset_id: 3,
      maximum_statistics: { great: 1500, legacy_combo_increase: 200 },
    },
    { ruleset_id: 3, maximum_statistics: {} },
    { ruleset_id: 3 },
    null,
  ];
  for (const s of same) {
    const expected = old(s);
    assert.equal(beatmapMaxComboFromScore(s), expected, JSON.stringify(s));
    assert.equal(
      beatmapMaxComboFromScore(s, { legacyManiaGreatOnly: true }),
      expected,
    );
  }
  // B68: lazer mania maximum_statistics use `perfect` (+ ignore_hit for hold bodies).
  const lazerMania = {
    ruleset_id: 3,
    maximum_statistics: { perfect: 1800, ignore_hit: 300 },
  };
  assert.equal(old(lazerMania), null);
  assert.equal(
    beatmapMaxComboFromScore(lazerMania, { legacyManiaGreatOnly: true }),
    null,
  );
  assert.equal(beatmapMaxComboFromScore(lazerMania), 1800);
  const legacyMania = {
    ruleset_id: 3,
    maximum_statistics: { perfect: 1800, legacy_combo_increase: 250 },
  };
  assert.equal(beatmapMaxComboFromScore(legacyMania), 2050);
});

test("leaderboardScoreId matches beatmap-detail", () => {
  const old = legacyFn(BEATMAP_DETAIL, "leaderboardScoreId");
  for (const s of [
    { id: 123 },
    { id: 0, legacy_score_id: 55 },
    { legacy_score_id: 55 },
    { score_id: "77" },
    { score: { id: 9 } },
    { id: "abc " },
    { id: "  " },
    { id: -1 },
    {},
    null,
  ]) {
    assert.equal(leaderboardScoreId(s), old(s), JSON.stringify(s));
  }
  assert.equal(leaderboardScoreId({ id: 0, legacy_score_id: 55 }), null);
});

test("scoreMergeKey matches _recentScoreMergeKey", () => {
  const old = legacyFn(USER_PROFILE, "_recentScoreMergeKey");
  const cases = [
    [{ id: 5, legacy_score_id: 9 }, "s:9"],
    [{ id: 5 }, "s:5"],
    [
      {
        id: 0,
        beatmap: { id: 3 },
        ended_at: "2026-01-01T00:00:00Z",
        score: 1000,
      },
      "f:3:2026-01-01T00:00:00Z:1000:1",
    ],
    [
      { beatmap_id: 3, created_at: "t", total_score: 9, passed: false },
      "f:3:t:9:0",
    ],
    [{ beatmap_id: 3 }, null],
    [null, null],
  ];
  for (const [s, expected] of cases) {
    assert.equal(scoreMergeKey(s), expected, JSON.stringify(s));
    assert.equal(old(s), expected, `${JSON.stringify(s)} (old)`);
  }
});
