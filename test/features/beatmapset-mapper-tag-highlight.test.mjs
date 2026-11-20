import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1",
});
for (const key of [
  "window",
  "document",
  "location",
  "HTMLElement",
  "MutationObserver",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const {
  matchTagCategories,
  refreshMapperTagHighlights,
  TAG_CAT_ATTR,
  TAG_POS_ATTR,
} = await import("../../src/features/beatmapset/mapper-tag-highlight.js");

const brief = (words) =>
  matchTagCategories(words).map((m) => (m ? `${m.cat}/${m.pos}` : null));

test("phrases span adjacent words and the longest phrase wins", () => {
  assert.deepEqual(
    brief(["Featured", "Artist", "fa", "speedcore", "Japanese", "Pop"]),
    ["fa/start", "fa/end", "fa/solo", null, "genre/start", "genre/end"],
  );
  assert.deepEqual(brief(["drum", "and", "bass", "japanese"]), [
    "genre/start",
    "genre/mid",
    "genre/end",
    "language/solo",
  ]);
});

test("words of a phrase alone are not coloured", () => {
  assert.deepEqual(brief(["artist", "video", "and", "game"]), [
    null,
    null,
    null,
    null,
  ]);
});

test("only the mapper tags row is marked", () => {
  const SEARCH = "https://osu.ppy.sh/beatmapsets?q=";
  const link = (q, text = q) =>
    `<a class="beatmapset-info__link" href="${SEARCH}${q}">${text}</a>`;
  window.document.body.innerHTML = `
    <div class="beatmapset-info">
      <div class="beatmapset-info__row">
        <h3 class="beatmapset-info__header">User Tags</h3>
        <div>${link("tag%3D%22%22japanese%22%22", "japanese")}</div>
      </div>
      <div class="beatmapset-info__row">
        <h3 class="beatmapset-info__header">Mapper Tags</h3>
        <div>${link("featured")} ${link("artist")} ${link("lapfox")}</div>
      </div>
    </div>`;
  refreshMapperTagHighlights();
  const marks = [...window.document.querySelectorAll("a")].map((a) =>
    a.hasAttribute(TAG_CAT_ATTR)
      ? `${a.getAttribute(TAG_CAT_ATTR)}/${a.getAttribute(TAG_POS_ATTR)}`
      : null,
  );
  assert.deepEqual(marks, [null, "fa/start", "fa/end", null]);
});
