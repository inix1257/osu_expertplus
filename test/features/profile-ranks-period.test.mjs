// Own file: the observer hub binds to the first jsdom window that subscribes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window, gmStore } = loadScripts(
  ["src/utils/dom.js", "src/utils/settings.js"],
  { url: "https://osu.ppy.sh/users/2/osu" },
);
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "MutationObserver",
  "Event",
  "OsuExpertPlus",
  "GM_getValue",
  "GM_setValue",
  "GM_deleteValue",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
// Card backgrounds need IntersectionObserver; this test is about the period.
gmStore.set("userProfile.scoreCardBackgrounds", false);

const { startRanksDateHighlightManager, readRanksPeriodState } =
  await import("../../src/features/profile/ranks-period.js");

const doc = window.document;
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 60 * 60 * 1000;

/** Top ranks with a score from 3 days ago and one from 3 years ago. */
function renderRanks() {
  const row = (agoMs) =>
    `<div class="play-detail"><span class="play-detail__time"><time datetime="${new Date(
      Date.now() - agoMs,
    ).toISOString()}"></time></span></div>`;
  doc.body.innerHTML = `
    <div class="js-sortable--page" data-page-id="top_ranks">
      <div class="page-extra">
        <h2 class="title title--page-extra">Ranks</h2>
        <div class="play-detail-list">${row(3 * DAY)}${row(3 * 365 * DAY)}</div>
      </div>
    </div>`;
}

const bar = () => doc.querySelector(".oep-ranks-date-filter");
const range = () => bar().querySelector("input[type=range]");
const reverse = () => bar().querySelector(".oep-ranks-date-filter__reverse");
const highlighted = () =>
  [...doc.querySelectorAll(".play-detail")].map((r) =>
    r.classList.contains("oep-ranks-date-highlight"),
  );

test("the chosen period and Reverse are restored on the next profile", async () => {
  assert.deepEqual(readRanksPeriodState(), { period: 0, reversed: false });

  renderRanks();
  let stop = startRanksDateHighlightManager();
  await tick();
  assert.equal(range().value, "0");
  assert.deepEqual(highlighted(), [false, false]);

  range().value = "1"; // 1 week
  range().dispatchEvent(new window.Event("input"));
  range().dispatchEvent(new window.Event("change"));
  reverse().click();
  assert.deepEqual(highlighted(), [false, true], "older than a week");
  assert.deepEqual(readRanksPeriodState(), { period: 1, reversed: true });
  stop();

  renderRanks();
  stop = startRanksDateHighlightManager();
  await tick();
  assert.equal(range().value, "1");
  assert.equal(reverse().getAttribute("aria-pressed"), "true");
  assert.deepEqual(highlighted(), [false, true]);

  bar().querySelector(".oep-ranks-date-filter__reset").click();
  assert.deepEqual(readRanksPeriodState(), { period: 0, reversed: false });
  stop();
});

test("a stored value out of range or malformed falls back", () => {
  gmStore.set("oep.profile.ranksPeriod", JSON.stringify({ period: 99 }));
  assert.deepEqual(readRanksPeriodState(), { period: 36, reversed: false });
  gmStore.set("oep.profile.ranksPeriod", "{not json");
  assert.deepEqual(readRanksPeriodState(), { period: 0, reversed: false });
});
