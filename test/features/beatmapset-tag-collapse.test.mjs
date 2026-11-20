import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window, gmStore } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1",
});
for (const key of [
  "window",
  "document",
  "location",
  "HTMLElement",
  "HTMLButtonElement",
  "MutationObserver",
  "GM_getValue",
  "GM_setValue",
  "OsuExpertPlus",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const {
  classifyTagRow,
  refreshTagCollapseToggles,
  TAG_ROW_COLLAPSED_CLASS,
  TAG_TOGGLE_ATTR,
} = await import("../../src/features/beatmapset/tag-collapse.js");

const row = (heading, ...hrefs) => `
  <div class="beatmapset-info__row">
    <h3 class="beatmapset-info__header">${heading}</h3>
    <div>${hrefs.map((h) => `<a class="beatmapset-info__link" href="${h}">x</a>`).join(" ")}</div>
  </div>`;

const SEARCH = "https://osu.ppy.sh/beatmapsets?q=";
const page = () => `
  <div class="beatmapset-info">
    ${row("Source", `${SEARCH}source%3D%22%22Touhou%22%22`)}
    ${row("Genre", "https://osu.ppy.sh/beatmapsets?g=2")}
    ${row("사용자 태그", `${SEARCH}tag%3D%22%22streams%22%22`, `${SEARCH}tag%3D%22%22tech%22%22`)}
    ${row("Mapper Tags", `${SEARCH}onosakihito`, `${SEARCH}speedcore`)}
    ${row("Beatmap Packs", "https://osu.ppy.sh/beatmaps/packs/R56")}
  </div>`;

const rows = () => [
  ...window.document.querySelectorAll(".beatmapset-info__row"),
];

test("rows are told apart by their links, not the heading text", () => {
  window.document.body.innerHTML = page();
  assert.deepEqual(rows().map(classifyTagRow), [
    null,
    null,
    "user",
    "mapper",
    null,
  ]);
});

test("each toggle collapses its own row and the state is remembered", () => {
  gmStore.clear();
  window.document.body.innerHTML = page();
  refreshTagCollapseToggles();
  const btns = [...window.document.querySelectorAll(`[${TAG_TOGGLE_ATTR}]`)];
  assert.deepEqual(
    btns.map((b) => b.getAttribute(TAG_TOGGLE_ATTR)),
    ["user", "mapper"],
  );
  const [userRow, mapperRow] = [rows()[2], rows()[3]];
  btns[0].click();
  assert.ok(userRow.classList.contains(TAG_ROW_COLLAPSED_CLASS));
  assert.ok(!mapperRow.classList.contains(TAG_ROW_COLLAPSED_CLASS));
  assert.equal(btns[0].getAttribute("aria-expanded"), "false");

  // A fresh render (another page or difficulty) starts collapsed.
  window.document.body.innerHTML = page();
  refreshTagCollapseToggles();
  assert.ok(rows()[2].classList.contains(TAG_ROW_COLLAPSED_CLASS));
  assert.ok(!rows()[3].classList.contains(TAG_ROW_COLLAPSED_CLASS));

  // Refreshing again does not add a second button.
  refreshTagCollapseToggles();
  assert.equal(
    window.document.querySelectorAll(`[${TAG_TOGGLE_ATTR}]`).length,
    2,
  );
});
