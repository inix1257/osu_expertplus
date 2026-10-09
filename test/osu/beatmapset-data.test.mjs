import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  beatmapsetIdFromHref,
  beatmapsetIdFromLinks,
  clearBeatmapsetJsonCache,
  getCurrentBeatmapId,
  getCurrentRuleset,
  parseBeatmapHash,
  parsePickerHref,
  readBeatmapsetJson,
} from "../../src/osu/beatmapset-data.js";
import {
  LEGACY_BEATMAPSET,
  CARD_EXTRA,
  USER_PROFILE,
  legacyFn,
  LEGACY_SCOREBOARD,
} from "./legacy.mjs";

const SET = {
  id: 100,
  beatmaps: [
    { id: 11, mode: "osu", version: "Easy" },
    { id: 12, mode: "osu", version: "Hard" },
    { id: 21, mode: "taiko", version: "Oni" },
    { id: 31, mode: "mania", version: "4K" },
  ],
};

/**
 * @param {{ url?: string, json?: string|null, active?: string|null }} [o]
 */
function page(o = {}) {
  const json = o.json === undefined ? JSON.stringify(SET) : o.json;
  const script =
    json === null
      ? ""
      : `<script id="json-beatmapset" type="application/json">${json}</script>`;
  const picker =
    o.active == null
      ? ""
      : `<a class="beatmapset-beatmap-picker__beatmap beatmapset-beatmap-picker__beatmap--active" href="${o.active}"></a>`;
  const dom = new JSDOM(`<!doctype html><body>${script}${picker}</body>`, {
    url: o.url ?? "https://osu.ppy.sh/beatmapsets/100",
  });
  return dom.window;
}

/** The legacy getters evaluated against a jsdom window. */
function legacyGetters(win) {
  const deps = {
    document: win.document,
    location: win.location,
    qs: (sel) => win.document.querySelector(sel),
  };
  const readBeatmapsetJsonOld = legacyFn(
    LEGACY_SCOREBOARD,
    "readBeatmapsetJson",
    deps,
  );
  const ctx = { ...deps, readBeatmapsetJson: readBeatmapsetJsonOld };
  const getBeatmapPageRuleset = legacyFn(
    LEGACY_SCOREBOARD,
    "getBeatmapPageRuleset",
    ctx,
  );
  const getBeatmapPageBeatmapId = legacyFn(
    LEGACY_SCOREBOARD,
    "getBeatmapPageBeatmapId",
    { ...ctx, getBeatmapPageRuleset },
  );
  return {
    readBeatmapsetJsonOld,
    getBeatmapPageRuleset,
    getBeatmapPageBeatmapId,
  };
}

beforeEach(() => clearBeatmapsetJsonCache());

test("readBeatmapsetJson parses and memoizes", () => {
  const win = page();
  const ctx = { document: win.document, location: win.location };
  const a = readBeatmapsetJson(ctx);
  assert.deepEqual(a, SET);
  assert.equal(readBeatmapsetJson(ctx), a, "same object while unchanged");
  assert.deepEqual(a, legacyGetters(win).readBeatmapsetJsonOld());
});

test("readBeatmapsetJson re-reads when the text length changes", () => {
  const win = page();
  const ctx = { document: win.document, location: win.location };
  const a = readBeatmapsetJson(ctx);
  const node = win.document.getElementById("json-beatmapset");
  node.textContent = JSON.stringify({ ...SET, id: 1000 });
  const b = readBeatmapsetJson(ctx);
  assert.notEqual(b, a);
  assert.equal(b.id, 1000);
});

test("readBeatmapsetJson re-reads when the node is replaced", () => {
  const win = page();
  const ctx = { document: win.document, location: win.location };
  readBeatmapsetJson(ctx);
  const old = win.document.getElementById("json-beatmapset");
  const repl = win.document.createElement("script");
  repl.id = "json-beatmapset";
  // Same length as before, different content: only node identity differs.
  repl.textContent = JSON.stringify({ ...SET, id: 999 });
  old.replaceWith(repl);
  assert.equal(readBeatmapsetJson(ctx).id, 999);
});

test("readBeatmapsetJson re-reads when the pathname changes", () => {
  const win = page();
  const node = win.document.getElementById("json-beatmapset");
  const ctx1 = {
    document: win.document,
    location: { pathname: "/beatmapsets/100" },
  };
  const a = readBeatmapsetJson(ctx1);
  // Same node, same length, but the text changed (e.g. SPA navigation reusing it).
  node.textContent = JSON.stringify({ ...SET, id: 200 });
  assert.equal(readBeatmapsetJson(ctx1), a, "cache key unchanged → cached");
  const ctx2 = {
    document: win.document,
    location: { pathname: "/beatmapsets/200" },
  };
  assert.equal(readBeatmapsetJson(ctx2).id, 200);
});

test("readBeatmapsetJson: missing, empty, invalid", () => {
  for (const json of [null, "", "   ", "{not json"]) {
    clearBeatmapsetJsonCache();
    const win = page({ json });
    const ctx = { document: win.document, location: win.location };
    assert.equal(readBeatmapsetJson(ctx), null, JSON.stringify(json));
    assert.equal(legacyGetters(win).readBeatmapsetJsonOld(), null);
  }
});

test("parseBeatmapHash", () => {
  const cases = [
    ["#osu/123", { ruleset: "osu", beatmapId: 123 }],
    ["#Mania/456", { ruleset: "mania", beatmapId: 456 }],
    ["#fruits/7?x", { ruleset: "fruits", beatmapId: 7 }],
    ["#catch/7", null],
    ["#osu/", null],
    ["osu/1", null],
    ["", null],
    [undefined, null],
  ];
  for (const [hash, expected] of cases) {
    assert.deepEqual(parseBeatmapHash(hash), expected, String(hash));
  }
});

test("parsePickerHref: known rulesets with /beatmaps/ fallback", () => {
  const base = "https://osu.ppy.sh/beatmapsets/100";
  const cases = [
    [`${base}#osu/123`, { ruleset: "osu", beatmapId: 123 }],
    [`${base}#mania/456`, { ruleset: "mania", beatmapId: 456 }],
    [`${base}#TAIKO/9`, { ruleset: "taiko", beatmapId: 9 }],
    [`${base}#osu/123 `, { ruleset: "osu", beatmapId: 123 }],
    ["https://osu.ppy.sh/beatmaps/789", { ruleset: null, beatmapId: 789 }],
    [`${base}#catch/5`, null],
    [`${base}#osu/abc`, null],
    [`${base}#mania/`, null],
    [base, null],
    ["", null],
    [null, null],
  ];
  for (const [href, expected] of cases) {
    assert.deepEqual(parsePickerHref(href), expected, String(href));
  }
  assert.equal(
    parsePickerHref("https://osu.ppy.sh/beatmaps/789", { pathFallback: false }),
    null,
  );
});

test("parsePickerHref any-end matches parseBeatmapIdFromPickerLink", () => {
  const old = legacyFn(LEGACY_BEATMAPSET, "parseBeatmapIdFromPickerLink");
  const anchor = (href) => ({ getAttribute: () => href });
  const base = "https://osu.ppy.sh/beatmapsets/100";
  const cases = [
    `${base}#osu/123`,
    `${base}#mania/456`,
    `${base}#catch/5`,
    `${base}#osu/123 `,
    `${base}#osu/123?x=1`,
    `${base}#osu/abc`,
    "https://osu.ppy.sh/beatmaps/789",
    "",
    null,
  ];
  for (const href of cases) {
    const parsed = parsePickerHref(href, {
      match: "any-end",
      pathFallback: false,
    });
    assert.equal(parsed?.beatmapId ?? null, old(anchor(href)), String(href));
  }
  assert.deepEqual(parsePickerHref(`${base}#catch/5`, { match: "any-end" }), {
    ruleset: null,
    beatmapId: 5,
  });
});

test("getCurrentRuleset / getCurrentBeatmapId match the beatmap-detail getters", () => {
  const set = "https://osu.ppy.sh/beatmapsets/100";
  const cases = [
    // url, active picker href, ruleset, beatmap id
    [`${set}#taiko/21`, null, "taiko", 21],
    [`${set}#MANIA/31`, `${set}#osu/11`, "mania", 31],
    [set, `${set}#osu/12`, "osu", 12],
    [set, "/beatmaps/21", "taiko", 21],
    [set, "/beatmaps/999", "osu", 999],
    [set, null, "osu", 11],
    [`${set}#catch/5`, null, "osu", 11],
  ];
  for (const [url, active, ruleset, id] of cases) {
    clearBeatmapsetJsonCache();
    const win = page({ url, active });
    const ctx = { document: win.document, location: win.location };
    const old = legacyGetters(win);
    const label = `${url} ${active}`;
    assert.equal(getCurrentRuleset(ctx), ruleset, label);
    assert.equal(old.getBeatmapPageRuleset(), ruleset, `${label} (old)`);
    assert.equal(getCurrentBeatmapId(ctx), id, label);
    assert.equal(old.getBeatmapPageBeatmapId(), String(id), `${label} (old)`);
  }
  // No beatmaps in the JSON.
  clearBeatmapsetJsonCache();
  const win = page({
    url: set,
    active: null,
    json: JSON.stringify({ beatmaps: [] }),
  });
  const ctx = { document: win.document, location: win.location };
  assert.equal(getCurrentBeatmapId(ctx), null);
  assert.equal(legacyGetters(win).getBeatmapPageBeatmapId(), null);
});

test("beatmapsetIdFromHref: pathname (card) vs anywhere (profile)", () => {
  const cases = [
    // href, pathname match, anywhere match
    ["https://osu.ppy.sh/beatmapsets/123#osu/4", 123, 123],
    ["/beatmapsets/55", 55, 55],
    ["/BEATMAPSETS/55", 55, null],
    ["https://osu.ppy.sh/api/v2/beatmapsets/9", null, 9],
    ["https://osu.ppy.sh/beatmapsets/discussions", null, null],
    ["https://osu.ppy.sh/beatmaps/1", null, null],
    ["", null, null],
  ];
  for (const [href, path, anywhere] of cases) {
    assert.equal(
      beatmapsetIdFromHref(href, { base: "https://osu.ppy.sh" }),
      path,
      href,
    );
    assert.equal(
      beatmapsetIdFromHref(href, { match: "anywhere" }),
      anywhere,
      href,
    );
  }
});

test("beatmapsetIdFromLinks / anywhere match the legacy parsers", () => {
  const win = page();
  const { document } = win;
  const mk = (hrefs) => {
    const div = document.createElement("div");
    for (const h of hrefs) {
      const a = document.createElement("a");
      a.setAttribute("href", h);
      a.className = "play-detail__title";
      div.appendChild(a);
    }
    return div;
  };
  const oldCard = legacyFn(CARD_EXTRA, "parseBeatmapsetId", {
    location: win.location,
  });
  const oldProfile = legacyFn(USER_PROFILE, "getRanksRowBeatmapsetId");
  const cases = [
    [
      ["/beatmapsets/discussions", "https://osu.ppy.sh/beatmapsets/42#osu/1"],
      42,
    ],
    [["/beatmapsets/7"], 7],
    [["/users/2"], null],
    [[], null],
  ];
  for (const [hrefs, expected] of cases) {
    const root = mk(hrefs);
    assert.equal(
      beatmapsetIdFromLinks(root),
      oldCard(root) && Number(oldCard(root)),
    );
    assert.equal(
      beatmapsetIdFromLinks(root, { base: "https://osu.ppy.sh" }),
      expected,
    );
  }
  for (const href of [
    "https://osu.ppy.sh/beatmapsets/42#osu/1",
    "/b/beatmapsets/3",
    "/beatmaps/1",
  ]) {
    const row = mk([href]);
    const old = oldProfile(row);
    assert.equal(
      beatmapsetIdFromHref(href, { match: "anywhere" }),
      old == null ? null : Number(old),
      href,
    );
  }
});
