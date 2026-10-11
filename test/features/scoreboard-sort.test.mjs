import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

/** osu-web scoreboard table markup (header classes as on osu.ppy.sh, 2026-10). */
const HEAD = [
  "rank",
  "grade",
  "score",
  "accuracy",
  "flag",
  "player",
  "maxcombo",
  "hitstat hit-great",
  "hitstat hit-ok",
  "hitstat hit-meh",
  "hitstat hit-miss",
  "pp",
  "time",
  "mods",
]
  .map(
    (mods) =>
      `<th class="${mods
        .split(" ")
        .map(
          (m) =>
            `beatmap-scoreboard-table__header beatmap-scoreboard-table__header--${m}`,
        )
        .join(
          " ",
        )}">${mods.includes("hit-") ? mods.split("hit-")[1] : mods}</th>`,
  )
  .join("");

/** @param {{ rank: string, score: string, acc: string, combo: string, pp: string, ppTitle: string, time: string }} r */
const row = (r) => `
  <tr class="beatmap-scoreboard-table__body-row">
    <td><a class="beatmap-scoreboard-table__cell-content">${r.rank}</a></td>
    <td></td>
    <td><a class="beatmap-scoreboard-table__cell-content">${r.score}</a></td>
    <td><a class="beatmap-scoreboard-table__cell-content">${r.acc}</a></td>
    <td></td>
    <td><a class="beatmap-scoreboard-table__user-link" href="/users/1">u</a></td>
    <td><a class="beatmap-scoreboard-table__cell-content">${r.combo}</a></td>
    <td>1</td><td>0</td><td>0</td><td>0</td>
    <td><a class="beatmap-scoreboard-table__cell-content"><span title="${r.ppTitle}">${r.pp}</span></a></td>
    <td><a class="beatmap-scoreboard-table__cell-content"><time class="js-tooltip-time" title="${r.time}">x</time></a></td>
    <td><div class="beatmap-scoreboard-table__mods"></div></td>
  </tr>`;

function useDom(lang, rows) {
  const { window } = new JSDOM(
    `<!doctype html><html lang="${lang}"><body><table class="beatmap-scoreboard-table__table"><thead><tr>${HEAD}</tr></thead><tbody class="beatmap-scoreboard-table__body">${rows}</tbody></table></body></html>`,
    { url: "https://osu.ppy.sh/beatmapsets/1#osu/2" },
  );
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "HTMLTableCellElement",
    "HTMLTableRowElement",
    "HTMLTimeElement",
    "HTMLButtonElement",
    "HTMLAnchorElement",
    "Node",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  return window.document;
}

const { buildBeatmapScoreboardColumnMap } =
  await import("../../src/features/scoreboard/row-builder.js");
const { beatmapScoreboardRowSortPrimary } =
  await import("../../src/features/scoreboard/sort.js");

test("column map from the osu-web header classes", () => {
  const doc = useDom(
    "en",
    row({
      rank: "#1",
      score: "1",
      acc: "1%",
      combo: "1x",
      pp: "1",
      ppTitle: "1",
      time: "2020-01-01T00:00:00Z",
    }),
  );
  const table = doc.querySelector("table");
  const map = buildBeatmapScoreboardColumnMap(
    table.querySelector("tbody tr"),
    table,
  );
  assert.deepEqual(
    {
      rank: map.rank,
      grade: map.grade,
      score: map.score,
      accuracy: map.accuracy,
      flag: map.flag,
      user: map.user,
      combo: map.combo,
      pp: map.pp,
      time: map.time,
      mods: map.mods,
    },
    {
      rank: 0,
      grade: 1,
      score: 2,
      accuracy: 3,
      flag: 4,
      user: 5,
      combo: 6,
      pp: 11,
      time: 12,
      mods: 13,
    },
  );
  assert.deepEqual(map.hitstatIndices, [7, 8, 9, 10]);
  assert.deepEqual(Object.values(map.hitstatLabelsByIndex), [
    "great",
    "ok",
    "meh",
    "miss",
  ]);
});

test("sort keys read numbers in the page locale (B19)", () => {
  const cases = [
    // lang, cells as osu-web prints them, expected keys
    [
      "en",
      {
        score: "142,974,980",
        acc: "99.96%",
        combo: "2,385x",
        pp: "903",
        ppTitle: "902.982",
      },
      { score: 142974980, accuracy: 99.96, combo: 2385, pp: 902.982 },
    ],
    [
      "de",
      {
        score: "142.974.980",
        acc: "99,96%",
        combo: "2.385x",
        pp: "903",
        ppTitle: "902,982",
      },
      { score: 142974980, accuracy: 99.96, combo: 2385, pp: 902.982 },
    ],
    [
      "de",
      {
        score: "1.234",
        acc: "100,00%",
        combo: "1.234x",
        pp: "1.235",
        ppTitle: "1.234,5",
      },
      { score: 1234, accuracy: 100, combo: 1234, pp: 1234.5 },
    ],
    // pp title is not a number ("non_best" text): fall back to the cell text
    [
      "en",
      {
        score: "1",
        acc: "1%",
        combo: "1x",
        pp: "250",
        ppTitle: "Not your best",
      },
      { pp: 250 },
    ],
  ];
  for (const [lang, cells, expected] of cases) {
    const doc = useDom(
      lang,
      row({ rank: "#1", time: "2020-01-01T00:00:00Z", ...cells }),
    );
    const table = doc.querySelector("table");
    const tr = table.querySelector("tbody tr");
    const map = buildBeatmapScoreboardColumnMap(tr, table);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(
        beatmapScoreboardRowSortPrimary(tr, map, key),
        value,
        `${lang} ${key}`,
      );
    }
    assert.equal(
      beatmapScoreboardRowSortPrimary(tr, map, "date"),
      Date.parse("2020-01-01T00:00:00Z"),
    );
  }
});

test("renumbering skips lookup rows, which show a global rank (B12)", async () => {
  const { renumberBeatmapScoreboardVisibleRanks } =
    await import("../../src/features/scoreboard/sort.js");
  const base = {
    score: "1",
    acc: "1%",
    combo: "1x",
    pp: "1",
    ppTitle: "1",
    time: "x",
  };
  const doc = useDom(
    "en",
    row({ ...base, rank: "#523" }) +
      row({ ...base, rank: "?" }) +
      row({ ...base, rank: "#9" }),
  );
  const rows = [...doc.querySelectorAll("tbody tr")];
  rows[0].setAttribute("data-oep-user-search-result", "1");
  rows[1].setAttribute("data-oep-user-search-result", "1");
  const colMap = buildBeatmapScoreboardColumnMap(
    rows[2],
    doc.querySelector("table"),
  );
  renumberBeatmapScoreboardVisibleRanks(rows, colMap);
  assert.deepEqual(
    rows.map((r) => r.cells[0].textContent.trim()),
    ["#523", "?", "#3"],
  );
});

test("injected rows sort by their plain numbers in any locale (B97)", async () => {
  const { applyApiScoreToBeatmapScoreRow } =
    await import("../../src/features/scoreboard/row-builder.js");
  const doc = useDom(
    "de",
    row({
      rank: "#1",
      score: "1",
      acc: "1%",
      combo: "1x",
      pp: "1",
      ppTitle: "1",
      time: "2020-01-01T00:00:00Z",
    }),
  );
  const table = doc.querySelector("table");
  const template = table.querySelector("tbody tr");
  const map = buildBeatmapScoreboardColumnMap(template, table);
  const tr = template.cloneNode(true);
  globalThis.OsuExpertPlus ??= {};
  applyApiScoreToBeatmapScoreRow(
    tr,
    {
      total_score: 141639015,
      accuracy: 0.9966,
      max_combo: 2384,
      statistics: { great: 1 },
    },
    2,
    map,
    table,
    template,
    null,
  );
  assert.equal(beatmapScoreboardRowSortPrimary(tr, map, "score"), 141639015);
  assert.equal(beatmapScoreboardRowSortPrimary(tr, map, "combo"), 2384);
  assert.ok(
    Math.abs(beatmapScoreboardRowSortPrimary(tr, map, "accuracy") - 99.66) <
      1e-9,
  );
  // and show them like osu-web's formatNumber in the page locale (B112)
  const text = (i) => tr.cells[i].textContent.trim();
  assert.equal(text(map.score), "141.639.015");
  assert.equal(text(map.accuracy), "99,66%");
  assert.equal(text(map.combo), "2.384x");
});
