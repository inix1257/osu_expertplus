import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const IDS = {
  SCOREBOARD_HIDE_CUSTOM_RATE_SCORES: "hideRate",
  SCORE_PP_DECIMALS: "pp",
  SCOREBOARD_GLOBAL_RANK: "rank",
};

function row(name, { rate = false } = {}) {
  const mods = rate
    ? `<div class="mod"><div class="mod__icon" data-acronym="DT"></div><div class="mod__extender"><span>1.2×</span></div></div>`
    : "";
  return `<tr class="beatmap-scoreboard-table__body-row" data-name="${name}">
    <td class="beatmap-scoreboard-table__mods">${mods}</td></tr>`;
}

function setup(rowsHtml) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
  });
  const enabled = new Set(["hideRate"]);
  window.OsuExpertPlus.settings = {
    IDS,
    isEnabled: (id) => enabled.has(id),
  };
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "HTMLTableElement",
    "HTMLTableRowElement",
    "HTMLTableCellElement",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  window.document.body.innerHTML = `
    <div class="beatmapset-scoreboard">
      <div class="beatmap-scoreboard-table">
        <table class="beatmap-scoreboard-table__table">
          <tbody class="beatmap-scoreboard-table__body">${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;
  return {
    root: window.document.querySelector(".beatmapset-scoreboard"),
    tbody: window.document.querySelector("tbody"),
    enabled,
  };
}

const { isScoreboardRowHidden, setRowHidden } =
  await import("../../src/features/scoreboard/context.js");
const { clearMergedLeaderboard } =
  await import("../../src/features/scoreboard/merged-leaderboard.js");
const { refreshBeatmapScoreboardTableEnhancements } =
  await import("../../src/features/scoreboard/refresh.js");

const visibleNames = (tbody) =>
  [...tbody.rows]
    .filter((r) => !isScoreboardRowHidden(r))
    .map((r) => r.dataset.name);

test("hide reasons: each feature adds and removes only its own", () => {
  const { tbody } = setup(row("a"));
  const r = tbody.rows[0];
  setRowHidden(r, "rate", true);
  setRowHidden(r, "merged", true);
  assert.equal(r.getAttribute("data-oep-hide"), "rate merged");
  setRowHidden(r, "rate", false);
  assert.equal(isScoreboardRowHidden(r), true, "still hidden for merged");
  assert.equal(isScoreboardRowHidden(r, "rate"), false);
  setRowHidden(r, "merged", false);
  assert.equal(r.hasAttribute("data-oep-hide"), false);
});

test("the rate filter survives a merged leaderboard being cleared (B09)", () => {
  const { root, tbody } = setup(row("n1") + row("n2", { rate: true }));
  refreshBeatmapScoreboardTableEnhancements(root);
  assert.deepEqual(visibleNames(tbody), ["n1"], "custom-rate row hidden");

  // A lookup leaderboard: osu-web rows hidden, one injected row shown.
  for (const r of tbody.rows) setRowHidden(r, "merged", true);
  tbody.insertAdjacentHTML(
    "afterbegin",
    `<tr class="beatmap-scoreboard-table__body-row" data-oep-user-search-result="1" data-name="lookup"><td class="beatmap-scoreboard-table__mods"></td></tr>`,
  );
  refreshBeatmapScoreboardTableEnhancements(root);
  assert.deepEqual(visibleNames(tbody), ["lookup"]);

  clearMergedLeaderboard(root, "lookup");
  assert.deepEqual(
    visibleNames(tbody),
    ["n1"],
    "clearing the lookup does not reveal the filtered row",
  );
});

test("turning the rate filter off keeps merged-hidden rows hidden (B09)", () => {
  const { root, tbody, enabled } = setup(
    row("n1") + row("n2", { rate: true }),
  );
  refreshBeatmapScoreboardTableEnhancements(root);
  for (const r of tbody.rows) setRowHidden(r, "merged", true);
  tbody.insertAdjacentHTML(
    "afterbegin",
    `<tr class="beatmap-scoreboard-table__body-row" data-oep-wildcard-merged-row="1" data-name="w"><td class="beatmap-scoreboard-table__mods"></td></tr>`,
  );

  enabled.delete("hideRate");
  refreshBeatmapScoreboardTableEnhancements(root);
  assert.deepEqual(visibleNames(tbody), ["w"]);

  // Clearing only the lookup leaves the wildcard merge (and its hiding) alone.
  clearMergedLeaderboard(root, "lookup");
  assert.deepEqual(visibleNames(tbody), ["w"]);

  clearMergedLeaderboard(root, "wildcard");
  assert.deepEqual(visibleNames(tbody), ["n1", "n2"]);
});
