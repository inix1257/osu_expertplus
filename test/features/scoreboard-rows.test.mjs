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
    "HTMLTableRowElement",
    "OsuExpertPlus",
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
