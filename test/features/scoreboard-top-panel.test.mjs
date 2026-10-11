import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

function setup(html) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/241526#mania/557819",
  });
  for (const key of [
    "window",
    "document",
    "location",
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

const stat = (header, value, extra = "") => `
  <div class="beatmap-score-top__stat">
    <div class="beatmap-score-top__stat-header beatmap-score-top__stat-header--wider">${header}</div>
    <div class="beatmap-score-top__stat-value ${extra}">${value}</div>
  </div>`;

/** osu-web's #1 card (2026-10): Estonians, team 1013, perfect acc and combo. */
const CARD = `
  <div class="beatmap-score-top">
    <a class="beatmap-score-top__link-container" href="https://osu.ppy.sh/scores/1"></a>
    <div class="beatmap-score-top__position">
      <div class="beatmap-score-top__position-number">#1</div>
      <div class="score-rank score-rank--tiny score-rank--X"></div>
    </div>
    <div class="beatmap-score-top__flags">
      <a class="u-hover" href="https://osu.ppy.sh/rankings/mania/performance?country=EE"><span class="flag-country" title="Estonia"></span></a>
      <a class="u-hover" href="https://osu.ppy.sh/teams/1013"><span class="flag-team" title="300g"></span></a>
    </div>
    ${stat("Total Score", "1,000,000", "beatmap-score-top__stat-value--score")}
    ${stat("Accuracy", "100.00%", "beatmap-score-top__stat-value--perfect")}
    ${stat("Max Combo", "4,787x", "beatmap-score-top__stat-value--perfect")}
  </div>`;

const cell = (text, cls = "") =>
  `<td><a class="beatmap-scoreboard-table__cell-content ${cls}" href="https://osu.ppy.sh/scores/2">${text}</a></td>`;

/** @param {{ rank: string, team?: string, accPerfect?: boolean, comboPerfect?: boolean }} r */
const row = (r) => `
  <table><tbody><tr class="beatmap-scoreboard-table__body-row">
    ${cell(r.rank, "beatmap-scoreboard-table__cell-content--rank")}
    ${cell("998,018", "beatmap-scoreboard-table__cell-content--score")}
    ${cell("99.90%", r.accPerfect ? "beatmap-scoreboard-table__cell-content--perfect" : "")}
    <td class="beatmap-scoreboard-table__cell--player"><span>${
      r.team
        ? `<a class="u-contents u-hover" href="https://osu.ppy.sh/teams/${r.team}"><span class="flag-team" title="t${r.team}"></span></a>`
        : ""
    }<a class="js-usercard beatmap-scoreboard-table__user-link" data-user-id="5" href="https://osu.ppy.sh/users/5">OutLast</a></span></td>
    ${cell("4,787x", r.comboPerfect ? "beatmap-scoreboard-table__cell-content--perfect" : "")}
  </tr></tbody></table>`;

test("top card takes position, team and perfect colours from its row (B96)", async () => {
  const { applyNativeRowToTopItem, applyApiScoreToTopItem } =
    await import("../../src/features/scoreboard/top-panel.js");
  const values = (doc) =>
    [...doc.querySelectorAll(".beatmap-score-top__stat-value")].map((v) =>
      v.classList.contains("beatmap-score-top__stat-value--perfect"),
    );

  let doc = setup(CARD + row({ rank: "#2", comboPerfect: true }));
  let item = doc.querySelector(".beatmap-score-top");
  applyNativeRowToTopItem(item, doc.querySelector("tr"));
  assert.equal(
    item.querySelector(".beatmap-score-top__position-number").textContent,
    "#2",
  );
  assert.equal(item.querySelector('a[href*="/teams/"]'), null);
  assert.deepEqual(values(doc), [false, false, true]);

  // A looked-up score with no known rank, in another team.
  doc = setup(CARD + row({ rank: "?", team: "77", accPerfect: true }));
  item = doc.querySelector(".beatmap-score-top");
  applyApiScoreToTopItem(
    item,
    { id: 2, user: { id: 5, username: "OutLast" }, accuracy: 0.999 },
    doc.querySelector("tr"),
  );
  assert.equal(
    item.querySelector(".beatmap-score-top__position-number").textContent,
    "-",
  );
  const teams = [...item.querySelectorAll('a[href*="/teams/"]')];
  assert.deepEqual(
    teams.map((a) => [a.getAttribute("href"), a.className]),
    [["https://osu.ppy.sh/teams/77", "u-hover"]],
  );
  assert.deepEqual(values(doc), [false, true, false]);
});
