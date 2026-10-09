import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
});
window.OsuExpertPlus.settings = {
  IDS: {},
  isEnabled: () => false,
};
for (const key of [
  "window",
  "document",
  "location",
  "HTMLElement",
  "HTMLTableElement",
  "HTMLTableRowElement",
  "HTMLTableCellElement",
  "HTMLButtonElement",
  "HTMLSpanElement",
  "HTMLAnchorElement",
  "Node",
  "OsuExpertPlus",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { fetchAndMergeWildcardLeaderboards } =
  await import("../../src/features/scoreboard/mod-filter/wildcard.js");
const { showMergedNotice, clearMergedLeaderboard } =
  await import("../../src/features/scoreboard/merged-leaderboard.js");
const { isScoreboardRowHidden } =
  await import("../../src/features/scoreboard/context.js");

/** @param {Record<string, object[]|Error>} byMods */
function stubApi(byMods) {
  window.OsuExpertPlus.api = {
    getBeatmapScoresWebsite: async (_id, { mods }) => {
      const r = byMods[mods.join("")];
      if (r instanceof Error) throw r;
      return { scores: r ?? [] };
    },
  };
}

const score = (id, total) => ({
  id,
  total_score: total,
  legacy_total_score: total,
});

test("wildcard fetch: a failed combination does not hide the others (B11)", async () => {
  stubApi({ NM: [score(1, 10)], HD: new Error("500") });
  const merged = await fetchAndMergeWildcardLeaderboards(
    "2",
    [[], ["HD"]],
    "osu",
    50,
    new AbortController().signal,
    "global",
  );
  assert.deepEqual(
    merged.map((s) => s.id),
    [1],
  );
});

test("wildcard fetch: every combination failing is an error (B11)", async () => {
  stubApi({ NM: new Error("429"), HD: new Error("429") });
  await assert.rejects(
    fetchAndMergeWildcardLeaderboards(
      "2",
      [[], ["HD"]],
      "osu",
      50,
      new AbortController().signal,
      "global",
    ),
    /429/,
  );
});

test("an empty merge shows a notice instead of the previous rows (B11)", () => {
  window.document.body.innerHTML = `
    <div class="beatmapset-scoreboard">
      <table class="beatmap-scoreboard-table__table">
        <thead><tr><th></th><th></th><th></th></tr></thead>
        <tbody class="beatmap-scoreboard-table__body">
          <tr class="beatmap-scoreboard-table__body-row" data-oep-wildcard-merged-row="1"><td>old</td><td></td><td></td></tr>
          <tr class="beatmap-scoreboard-table__body-row"><td>native</td><td></td><td></td></tr>
        </tbody>
      </table>
    </div>`;
  const root = window.document.querySelector(".beatmapset-scoreboard");
  const tbody = window.document.querySelector("tbody");

  showMergedNotice(root, "wildcard", "No scores with these mods.");
  const rows = [...tbody.rows];
  assert.equal(rows.length, 2, "the previous merged row is gone");
  assert.equal(rows[0].className, "oep-merged-notice");
  assert.equal(rows[0].cells[0].colSpan, 3);
  assert.equal(rows[0].textContent, "No scores with these mods.");
  assert.equal(isScoreboardRowHidden(rows[1]), true, "osu-web row hidden");

  clearMergedLeaderboard(root, "wildcard");
  assert.equal(tbody.querySelector(".oep-merged-notice"), null);
  assert.deepEqual(
    [...tbody.rows].map((r) => isScoreboardRowHidden(r)),
    [false],
    "osu-web row shown again",
  );
});
