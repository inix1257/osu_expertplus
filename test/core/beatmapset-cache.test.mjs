import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("");
globalThis.window = window;

const {
  createBeatmapsetCache,
  beatmapsetsFromSearch,
  beatmapsetsFromExtraPages,
  beatmapsetsFromUserList,
} = await import("../../src/core/beatmapset-cache.js");

test("versions change per id only", () => {
  const cache = createBeatmapsetCache();
  assert.deepEqual(cache.put([{ id: 1 }, { id: 2 }, { nope: 1 }, null]), [
    "1",
    "2",
  ]);
  const v1 = cache.version(1);
  const v2 = cache.version("2");
  assert.ok(v1 > 0 && v2 > 0 && v1 !== v2);
  cache.put([{ id: 2, title: "new" }]);
  assert.equal(cache.version(1), v1, "set 1 untouched");
  assert.notEqual(cache.version(2), v2);
  assert.equal(cache.get(2).title, "new");
  assert.equal(cache.version(3), 0);
});

test("evicts the least recently used past maxEntries", () => {
  const cache = createBeatmapsetCache({ maxEntries: 2 });
  cache.put([{ id: 1 }, { id: 2 }]);
  cache.get(1);
  cache.put([{ id: 3 }]);
  assert.equal(cache.has(2), false);
  assert.equal(cache.has(1), true);
  assert.equal(cache.has(3), true);
  assert.equal(cache.size, 2);
});

test("waitFor resolves on put, times out, and aborts", async () => {
  const cache = createBeatmapsetCache();
  const waiting = cache.waitFor(5, { timeout: 1000 });
  cache.put([{ id: 5, n: 1 }]);
  assert.equal((await waiting).n, 1);
  assert.equal((await cache.waitFor(5)).n, 1, "already there");

  assert.equal(await cache.waitFor(6, { timeout: 10 }), undefined);

  const ac = new AbortController();
  const aborted = cache.waitFor(7, { signal: ac.signal });
  ac.abort();
  assert.equal(await aborted, undefined);
  cache.put([{ id: 7 }]); // no stale waiter left to call
});

test("onChange gets the stored ids; unsubscribe stops it", () => {
  const cache = createBeatmapsetCache();
  const seen = [];
  const off = cache.onChange((ids) => seen.push(ids));
  cache.put([{ id: 1 }, { id: 2 }]);
  cache.put([]);
  off();
  cache.put([{ id: 3 }]);
  assert.deepEqual(seen, [["1", "2"]]);
});

test("payload shapes", () => {
  assert.deepEqual(beatmapsetsFromSearch({ beatmapsets: [{ id: 1 }] }), [
    { id: 1 },
  ]);
  assert.deepEqual(beatmapsetsFromSearch(null), []);
  assert.deepEqual(
    beatmapsetsFromExtraPages({
      ranked: { items: [{ id: 1 }], count: 1 },
      loved: { items: [{ id: 2 }] },
      user: { id: 9 },
    }),
    [{ id: 1 }, { id: 2 }],
  );
  assert.deepEqual(
    beatmapsetsFromUserList([
      { id: 1 },
      { beatmapset: { id: 2 }, count: 5 },
      { beatmapset: { id: null }, id: 3 },
    ]),
    [{ id: 1 }, { id: 2 }, { beatmapset: { id: null }, id: 3 }],
  );
  assert.deepEqual(beatmapsetsFromUserList({ beatmapsets: [{ id: 4 }] }), [
    { id: 4 },
  ]);
});
