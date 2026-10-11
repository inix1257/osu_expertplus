import { test } from "node:test";
import assert from "node:assert/strict";

// The cover download runs through GM_xmlhttpRequest; the test answers each
// request itself and tracks the blob URLs.
const requests = [];
globalThis.GM_xmlhttpRequest = (opts) => requests.push(opts);
let made = 0;
const live = new Set();
globalThis.URL.createObjectURL = () => {
  const url = `blob:test/${++made}`;
  live.add(url);
  return url;
};
globalThis.URL.revokeObjectURL = (url) => live.delete(url);

const { fetchBeatmapCoverObjectUrl, revokeBeatmapCoverObjectUrl } =
  await import("../../src/features/beatmap-preview/files.js");

const answer = (i) =>
  requests[i].onload({ status: 200, response: new ArrayBuffer(4) });
const flush = () => new Promise((r) => setTimeout(r, 0));

test("B32: an older cover finishing last is revoked, not leaked", async () => {
  const a = fetchBeatmapCoverObjectUrl("https://assets.ppy.sh/a.jpg");
  const b = fetchBeatmapCoverObjectUrl("https://assets.ppy.sh/b.jpg");
  answer(1); // b first
  const bUrl = await b;
  answer(0);
  assert.equal(await a, "", "a was superseded by b");
  assert.deepEqual([...live], [bUrl], "only b's blob URL is alive");

  revokeBeatmapCoverObjectUrl();
  assert.equal(live.size, 0);
});

test("B32: the same cover is downloaded once and reused", async () => {
  const before = requests.length;
  const p1 = fetchBeatmapCoverObjectUrl("https://assets.ppy.sh/c.jpg");
  const p2 = fetchBeatmapCoverObjectUrl("https://assets.ppy.sh/c.jpg");
  assert.equal(requests.length, before + 1);
  answer(before);
  const [u1, u2] = await Promise.all([p1, p2]);
  assert.equal(u1, u2);
  assert.equal(
    await fetchBeatmapCoverObjectUrl("https://assets.ppy.sh/c.jpg"),
    u1,
  );
  assert.equal(requests.length, before + 1);
  await flush();
  assert.deepEqual([...live], [u1]);
  revokeBeatmapCoverObjectUrl();
});
