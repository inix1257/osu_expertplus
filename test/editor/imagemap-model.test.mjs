import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampImapRect,
  computeResizeRect,
  formatImapPct,
  generateImagemapBbcode,
  normalizeImapLinkUrlForOsu,
  parseImagemapFromText,
  selectionRectFromDragPct,
} from "../../src/editor/bbcode-helper/imagemap-model.js";
import { LEGACY_BBCODE, legacyFn } from "../osu/legacy.mjs";

/** Deterministic pseudo-random numbers (mulberry32). */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("formatImapPct matches the old helper", () => {
  const old = legacyFn(LEGACY_BBCODE, "formatImapPct");
  const values = [0, 1, 12.5, 12.345, 12.355, 33.3333, 99.999, 100, 150, -3];
  values.push("7.5", null, Number.NaN);
  for (const v of values) assert.equal(formatImapPct(v), old(v), String(v));
  assert.equal(formatImapPct(12.5), "12.5");
  assert.equal(formatImapPct(40), "40");
  assert.equal(formatImapPct(150), "100");
});

test("normalizeImapLinkUrlForOsu follows osu-web's link rules", () => {
  const old = legacyFn(LEGACY_BBCODE, "normalizeImapLinkUrlForOsu");
  const cases = [
    ["#", "#"],
    ["https://osu.ppy.sh/users/2", "https://osu.ppy.sh/users/2"],
    ["  http://a.com/x  ", "http://a.com/x"],
    ["mailto:a@b.c", "mailto:a@b.c"],
    ["//a.com/x", "https://a.com/x"],
    ["/users/2", "https://osu.ppy.sh/users/2"],
    ["https://a.com/has space", null],
    ["javascript:alert(1)", null],
    ["users/2", null],
    ["", null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeImapLinkUrlForOsu(input), expected, input);
    assert.equal(old(input), expected, `old: ${input}`);
  }
});

test("parseImagemapFromText reads the image and the areas", () => {
  const old = legacyFn(LEGACY_BBCODE, "parseImagemapFromText");
  const texts = [
    "[imagemap]\nhttps://i.ppy.sh/a.png\n0 0 25 25 https://osu.ppy.sh Home\n10 10 5 5 #\n[/imagemap]",
    "before [IMAGEMAP]\r\nhttps://x/y.png\r\n\r\n1.5 2 3 4 /users/2 a b c\r\n[/IMAGEMAP] after",
    "[imagemap]\nhttps://x/y.png\nbad line\n-5 0 120 10 #\n1 2 3 https://short\n[/imagemap]",
    "[imagemap][/imagemap]",
    "no block",
  ];
  for (const t of texts) assert.deepEqual(parseImagemapFromText(t), old(t), t);
  assert.deepEqual(parseImagemapFromText(texts[2]), {
    imageUrl: "https://x/y.png",
    areas: [{ x: 0, y: 0, w: 100, h: 10, url: "#", title: "" }],
  });
  assert.equal(parseImagemapFromText(texts[3]), null);
});

test("generateImagemapBbcode keeps only areas with an accepted link", () => {
  const hotspots = [
    { x: 0, y: 0, w: 25.5, h: 25, url: "https://osu.ppy.sh", title: " Home " },
    { x: 10, y: 10, w: 5, h: 5, url: "nope", title: "" },
    { x: 50, y: 50, w: 12.345, h: 1, url: "/users/2", title: "" },
  ];
  assert.equal(
    generateImagemapBbcode(" https://i.ppy.sh/a.png ", hotspots),
    "[imagemap]\nhttps://i.ppy.sh/a.png\n0 0 25.5 25 https://osu.ppy.sh Home\n50 50 12.35 1 https://osu.ppy.sh/users/2\n[/imagemap]",
  );
  assert.equal(generateImagemapBbcode("", hotspots), "");
  assert.equal(generateImagemapBbcode("https://a/b.png", [hotspots[1]]), "");

  const parsed = parseImagemapFromText(
    generateImagemapBbcode("https://a/b.png", [hotspots[0]]),
  );
  assert.deepEqual(parsed, {
    imageUrl: "https://a/b.png",
    areas: [
      { x: 0, y: 0, w: 25.5, h: 25, url: "https://osu.ppy.sh", title: "Home" },
    ],
  });
});

test("area geometry matches the old helpers", () => {
  const oldClamp = legacyFn(LEGACY_BBCODE, "clampImapRect", {
    IMAP_MIN_RECT_PCT: 1,
  });
  const oldResize = legacyFn(LEGACY_BBCODE, "computeResizeRect", {
    IMAP_MIN_RECT_PCT: 1,
    clampImapRect: oldClamp,
  });
  const oldDrag = legacyFn(LEGACY_BBCODE, "selectionRectFromDragPct");
  const r = rng(40);
  const n = () => r() * 140 - 20;
  for (let i = 0; i < 2000; i++) {
    const rect = { x: n(), y: n(), w: n(), h: n() };
    assert.deepEqual(clampImapRect(rect), oldClamp(rect));
    const start = clampImapRect({ x: r() * 90, y: r() * 90, w: 10, h: 10 });
    const pt = { x: n(), y: n() };
    for (const corner of ["nw", "ne", "sw", "se"]) {
      assert.deepEqual(
        computeResizeRect(corner, start, pt),
        oldResize(corner, start, pt),
      );
    }
    const [a, b, c, d] = [n(), n(), n(), n()];
    assert.deepEqual(selectionRectFromDragPct(a, b, c, d), oldDrag(a, b, c, d));
  }
});

test("clampImapRect keeps the area inside the image", () => {
  assert.deepEqual(clampImapRect({ x: 95, y: -5, w: 10, h: 0 }), {
    x: 90,
    y: 0,
    w: 10,
    h: 1,
  });
  assert.deepEqual(
    computeResizeRect("se", { x: 10, y: 10, w: 20, h: 20 }, { x: 5, y: 50 }),
    { x: 10, y: 10, w: 1, h: 40 },
  );
});
