import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"], {
  url: "https://osu.ppy.sh/users/2/osu",
});
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLSpanElement",
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

const { decorateScoreList, watchDecorationSettings, RECENT_SECTION_TYPE } =
  await import("../../src/features/profile/list-decorations.js");
const { fillStatsRows } =
  await import("../../src/features/profile/score-stats.js");

const settings = window.OsuExpertPlus.settings;
const IDS = settings.IDS;
const doc = window.document;

/** osu-web `.play-detail` with what the decorations and stats touch. */
function row(beatmapId, pp = "123.456") {
  const r = doc.createElement("div");
  r.className = "play-detail";
  r.innerHTML = `
    <div class="play-detail__detail">
      <a class="play-detail__title" href="https://osu.ppy.sh/beatmaps/${beatmapId}#osu/${beatmapId}">t</a>
    </div>
    <div class="play-detail__score-detail-top-right">
      <div class="play-detail__accuracy-and-weighted-pp">
        <span class="play-detail__accuracy">98.50%</span>
        <span class="play-detail__weighted-pp">50pp</span>
      </div>
    </div>
    <div class="play-detail__pp"><span title="${pp}">123</span></div>`;
  return r;
}

function list(...rows) {
  const l = doc.createElement("div");
  l.className = "play-detail-list";
  l.append(...rows);
  doc.body.append(l);
  return l;
}

const places = (l) =>
  [...l.querySelectorAll(".oep-score-place")].map((n) => n.textContent);
const ppText = (l) => l.querySelector(".play-detail__pp span").textContent;

test("decorations: Recent lists get place numbers like Best", () => {
  settings.set(IDS.SCORE_CARD_PLACE_NUMBER, true);
  settings.set(IDS.SCORE_PP_DECIMALS, true);
  const recent = list(row(1), row(2));
  const firsts = list(row(3));
  decorateScoreList({ listEl: recent, type: RECENT_SECTION_TYPE });
  decorateScoreList({ listEl: firsts, type: "firsts" });
  assert.deepEqual(places(recent), ["#1", "#2"]);
  assert.deepEqual(places(firsts), []);
  assert.equal(ppText(recent), "123.46 ");
  assert.ok(
    recent
      .querySelector(".play-detail__weighted-pp")
      .classList.contains("oep-hidden"),
  );
});

test("decorations follow their settings on every watched list", () => {
  settings.set(IDS.SCORE_CARD_PLACE_NUMBER, true);
  settings.set(IDS.SCORE_PP_DECIMALS, true);
  const best = list(row(1), row(2));
  const pinned = list(row(3));
  const sections = [
    { listEl: best, type: "best" },
    { listEl: pinned, type: "pinned" },
  ];
  sections.forEach((s) => decorateScoreList(s));
  const unsubs = watchDecorationSettings(() => sections);
  try {
    settings.set(IDS.SCORE_CARD_PLACE_NUMBER, false);
    assert.deepEqual(places(best), []);
    settings.set(IDS.SCORE_CARD_PLACE_NUMBER, true);
    assert.deepEqual(places(best), ["#1", "#2"]);
    assert.deepEqual(places(pinned), []);

    settings.set(IDS.SCORE_PP_DECIMALS, false);
    assert.equal(ppText(pinned), "123");
    settings.set(IDS.SCORE_PP_DECIMALS, true);
    assert.equal(ppText(pinned), "123.46 ");
  } finally {
    unsubs.forEach((u) => u());
  }
});

test("fillStatsRows: row order for repeated maps, refills re-rendered rows", () => {
  const score = (id, n) => ({
    beatmap: { id, max_combo: 100 },
    max_combo: n,
    statistics: { great: n },
    ruleset_id: 0,
  });
  const a = row(7);
  const b = row(7);
  const l = list(a, b);
  const scores = [score(7, 11), score(7, 22)];
  fillStatsRows([a, b], scores);
  const combo = (r) =>
    r.querySelector(".oep-combo-inline__num")?.textContent ?? null;
  assert.deepEqual([combo(a), combo(b)], ["11", "22"]);

  // osu! re-rendered the first row's stats away: only that row is refilled,
  // still with its own score.
  a.querySelector(".oep-score-stats").remove();
  fillStatsRows([a, b], scores);
  assert.equal(a.querySelectorAll(".oep-score-stats").length, 1);
  assert.equal(b.querySelectorAll(".oep-score-stats").length, 1);
  l.remove();
});
