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
  TAG_CATEGORIES,
  TAG_CAT_ATTR,
  TAG_POS_ATTR,
} = await import("../../src/features/beatmapset/mapper-tag-highlight.js");

const brief = (words) =>
  matchTagCategories(words).map((m) => (m ? `${m.cat}/${m.pos}` : null));

test("phrases span adjacent words and the longest phrase wins", () => {
  assert.deepEqual(
    brief(["Featured", "Artist", "fa", "speedcore", "Japanese", "Pop"]),
    ["fa/start", "fa/end", "fa/solo", null, "language/solo", "genre/solo"],
  );
  assert.deepEqual(brief(["drum", "and", "bass", "japanese"]), [
    "genre/start",
    "genre/mid",
    "genre/end",
    "language/solo",
  ]);
});

test("a language next to a genre stays two tags", () => {
  assert.deepEqual(brief(["japanese", "pop", "japanese", "rock"]), [
    "language/solo",
    "genre/solo",
    "language/solo",
    "genre/solo",
  ]);
});

test("sources are not genres; vocaloid is song info", () => {
  assert.deepEqual(brief(["touhou", "visual", "novel", "vocaloid"]), [
    null,
    null,
    null,
    "song/solo",
  ]);
});

test("no phrase joins words of different kinds", () => {
  const catOf = new Map();
  for (const c of TAG_CATEGORIES) for (const t of c.tags) catOf.set(t, c.id);
  for (const c of TAG_CATEGORIES) {
    for (const t of c.tags) {
      for (const w of t.split(" ")) {
        const own = catOf.get(w);
        assert.ok(!own || own === c.id, `"${t}" joins ${own} word "${w}"`);
      }
    }
  }
});

test("two-letter abbreviations need their long form nearby", () => {
  assert.deepEqual(brief(["fa", "ed", "sheeran", "op", "mg"]), [
    null,
    null,
    null,
    null,
    null,
  ]);
  assert.deepEqual(brief(["fa", "lapfox", "featured", "artist"]), [
    "fa/solo",
    null,
    "fa/start",
    "fa/end",
  ]);
  assert.deepEqual(brief(["anime", "op", "ed"]), [
    "genre/solo",
    "song/solo",
    "song/solo",
  ]);
  assert.deepEqual(brief(["mpg", "mg"]), ["guild/solo", "guild/solo"]);
});

test("underscores, trailing dots and curly apostrophes are normalised", () => {
  assert.deepEqual(
    brief([
      "Featured_Artist",
      "fa",
      "TV_Size",
      "cut",
      "ver.",
      "Mappers’",
      "Guild",
    ]),
    [
      "fa/solo",
      "fa/solo",
      "song/solo",
      "song/start",
      "song/end",
      "guild/start",
      "guild/end",
    ],
  );
  assert.deepEqual(brief([".", "_", ""]), [null, null, null]);
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
