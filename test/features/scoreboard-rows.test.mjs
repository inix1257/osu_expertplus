import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

function setup(html) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
  });
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "Node",
    "OsuExpertPlus",
    ...Object.getOwnPropertyNames(window).filter((k) =>
      /^HTML\w*Element$/.test(k),
    ),
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  window.document.body.innerHTML = html;
  return window.document;
}

const { cloneTemplateRow, findScoreboardTemplateRow } =
  await import("../../src/features/scoreboard/row-builder.js");
const { applyScoreboardModsCell } =
  await import("../../src/features/scoreboard/row-mods.js");

test("template row: the first native row, cloned without our markers (B13)", () => {
  const doc = setup(`
    <table><tbody>
      <tr class="beatmap-scoreboard-table__body-row" data-oep-user-search-result="1" data-oep-rate-edit="1">
        <td>old injected</td>
      </tr>
      <tr class="beatmap-scoreboard-table__body-row beatmap-scoreboard-table__body-row--first beatmap-scoreboard-table__body-row--self"
          style="display: none" data-oep-rate-edit="1">
        <td><a class="js-usercard">u</a><span class="oep-scoreboard-rank-badge">#5</span></td>
        <td><a><span title="902.982" data-oep-scoreboard-pp-original="903">902.98</span></a></td>
      </tr>
    </tbody></table>`);
  const tbody = doc.querySelector("tbody");
  const template = findScoreboardTemplateRow(tbody);
  assert.equal(template, tbody.rows[1], "skips the injected row");

  const row = cloneTemplateRow(template);
  assert.equal(row.hasAttribute("data-oep-rate-edit"), false);
  assert.equal(row.style.display, "");
  assert.equal(
    row.classList.contains("beatmap-scoreboard-table__body-row--first"),
    false,
  );
  assert.equal(
    row.classList.contains("beatmap-scoreboard-table__body-row--self"),
    false,
  );
  assert.equal(row.querySelector(".oep-scoreboard-rank-badge"), null);
  assert.equal(
    row.querySelector("[data-oep-scoreboard-pp-original]"),
    null,
    "cell markers are cleared too",
  );
  // The template itself is untouched.
  assert.equal(template.style.display, "none");

  // Only injected rows: fall back to the first one.
  const onlyInjected = setup(`
    <table><tbody>
      <tr class="beatmap-scoreboard-table__body-row" data-oep-wildcard-merged-row="1"><td></td></tr>
    </tbody></table>`).querySelector("tbody");
  assert.equal(findScoreboardTemplateRow(onlyInjected), onlyInjected.rows[0]);
});

test("mod template from the filter strip loses its filter state (B18)", () => {
  const doc = setup(`
    <button class="beatmap-scoreboard-mod mod mod--type-DifficultyIncrease oep-mod-wildcard beatmap-scoreboard-mod--disabled"
            disabled aria-pressed="true" data-oep-mod-wildcard="1" data-oep-mod-hidden="">
      <div class="mod__icon mod__icon--HR" data-acronym="HR" data-oep-mod-acronym="1"></div>
    </button>
    <table><tbody><tr><td><div class="beatmap-scoreboard-table__mods"></div></td></tr></tbody></table>`);
  const template = doc.querySelector("button");
  const td = doc.querySelector("td");
  applyScoreboardModsCell(td, { mods: [{ acronym: "HD" }] }, template);
  const btn = td.querySelector(".beatmap-scoreboard-mod");
  assert.ok(btn);
  for (const attr of [
    "disabled",
    "aria-pressed",
    "data-oep-mod-wildcard",
    "data-oep-mod-hidden",
  ]) {
    assert.equal(btn.hasAttribute(attr), false, attr);
  }
  assert.equal(btn.classList.contains("oep-mod-wildcard"), false);
  assert.equal(
    btn.classList.contains("beatmap-scoreboard-mod--disabled"),
    false,
  );
  assert.equal(btn.classList.contains("beatmap-scoreboard-mod--enabled"), true);
  assert.equal(
    btn.querySelector(".mod__icon").getAttribute("data-acronym"),
    "HD",
  );
  // The template button keeps its state.
  assert.equal(template.hasAttribute("disabled"), true);
});

/**
 * @param {string[]} attrs  osu-web hit-stat header attributes
 * @param {string} hash
 */
function hitTable(attrs, hash) {
  const doc = setup(`
    <table><thead><tr>
      <th class="beatmap-scoreboard-table__header beatmap-scoreboard-table__header--rank">Rank</th>
      ${attrs
        .map(
          (a) =>
            `<th class="beatmap-scoreboard-table__header beatmap-scoreboard-table__header--hitstat beatmap-scoreboard-table__header--hit-${a}">${a}</th>`,
        )
        .join("")}
    </tr></thead><tbody>
      <tr class="beatmap-scoreboard-table__body-row"><td>#1</td>${attrs
        .map(() => "<td>9</td>")
        .join("")}</tr>
    </tbody></table>`);
  doc.location.hash = hash;
  return doc;
}

test("injected hit stats follow osu-web's header attributes (B95)", async () => {
  const { buildBeatmapScoreboardColumnMap, applyApiScoreToBeatmapScoreRow } =
    await import("../../src/features/scoreboard/row-builder.js");
  const fill = (doc, score) => {
    const table = doc.querySelector("table");
    const template = table.tBodies[0].rows[0];
    const tr = template.cloneNode(true);
    const colMap = buildBeatmapScoreboardColumnMap(template, table);
    applyApiScoreToBeatmapScoreRow(tr, score, 2, colMap, table, template, null);
    return [...tr.cells].slice(1).map((c) => c.textContent);
  };

  // mania lazer statistics leave out zero keys (241526 [7K] Another, OutLast)
  const mania = ["perfect", "great", "good", "ok", "meh", "miss"];
  assert.deepEqual(
    fill(hitTable(mania, "#mania/557819"), {
      ruleset_id: 3,
      statistics: { perfect: 2478, great: 125, miss: 1 },
    }),
    ["2,478", "125", "0", "0", "0", "1"],
  );
  // legacy mania counts
  assert.deepEqual(
    fill(hitTable(mania, "#mania/557819"), {
      statistics: {
        count_geki: 10,
        count_300: 5,
        count_katu: 4,
        count_100: 3,
        count_50: 2,
        count_miss: 1,
      },
    }),
    ["10", "5", "4", "3", "2", "1"],
  );

  // fruits leaderboard: great / l drp / s drp miss / miss (+ large_tick_miss)
  const fruits = ["great", "large_tick_hit", "small_tick_miss", "miss"];
  assert.deepEqual(
    fill(hitTable(fruits, "#fruits/2"), {
      ruleset_id: 2,
      statistics: {
        great: 800,
        large_tick_hit: 40,
        small_tick_hit: 300,
        small_tick_miss: 7,
        miss: 2,
        large_tick_miss: 3,
      },
    }),
    ["800", "40", "7", "5"],
  );
  assert.deepEqual(
    fill(hitTable(fruits, "#fruits/2"), {
      statistics: {
        count_300: 800,
        count_100: 40,
        count_50: 300,
        count_katu: 7,
        count_miss: 5,
      },
    }),
    ["800", "40", "7", "5"],
  );
});
