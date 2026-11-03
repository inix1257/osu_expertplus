import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

/** The OMDB client with GM_xmlhttpRequest answering `reply(url)`. */
function client(reply) {
  const urls = [];
  const { OsuExpertPlus } = loadScripts(["src/utils/omdb.js"], {
    globals: {
      GM_xmlhttpRequest(opts) {
        urls.push(opts.url);
        const r = reply(opts.url);
        setTimeout(() => (r ? opts.onload(r) : opts.onerror()), 0);
      },
    },
  });
  return { omdb: OsuExpertPlus.omdb, urls };
}

test("fetchPublicBeatmapRatings returns the difficulty's ratings", async () => {
  const { omdb, urls } = client(() => ({
    status: 200,
    responseText: '{"BeatmapID":129891,"WeightedAvg":3.58,"RatingCount":189}',
  }));
  const entry = await omdb.fetchPublicBeatmapRatings(129891);
  assert.equal(entry.WeightedAvg, 3.58);
  assert.deepEqual(urls, [
    "https://omdb.nyahh.net/api/public/v1/beatmap/129891",
  ]);
});

test("fetchPublicBeatmapRatings: a missing difficulty is null, other errors throw", async () => {
  const replies = {
    1: { status: 200, responseText: '{"error":"Difficulty not found"}' },
    2: { status: 200, responseText: '{"error":"Missing beatmap ID"}' },
    3: { status: 404, responseText: "<!DOCTYPE html>" },
    4: { status: 200, responseText: "<!DOCTYPE html>" },
    5: null,
  };
  const { omdb } = client((url) => replies[url.split("/").pop()]);
  assert.equal(await omdb.fetchPublicBeatmapRatings(1), null);
  await assert.rejects(omdb.fetchPublicBeatmapRatings(2), /Missing beatmap ID/);
  await assert.rejects(omdb.fetchPublicBeatmapRatings(3), /OMDB HTTP 404/);
  await assert.rejects(omdb.fetchPublicBeatmapRatings(4), /unexpected/);
  await assert.rejects(omdb.fetchPublicBeatmapRatings(5), /Could not reach/);
});
