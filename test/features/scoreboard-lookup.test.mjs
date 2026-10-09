import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
});
for (const key of ["window", "document", "location", "OsuExpertPlus"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { lookupErrorStatus } =
  await import("../../src/features/scoreboard/player-lookup.js");

const httpError = (status) => Object.assign(new Error("x"), { status });

test("player lookup errors are told apart (B14)", () => {
  assert.match(lookupErrorStatus(httpError(401), "user"), /authorization/);
  assert.match(lookupErrorStatus(httpError(403), "scores"), /authorization/);
  assert.match(lookupErrorStatus(httpError(429), "user"), /Too many requests/);
  assert.equal(lookupErrorStatus(httpError(404), "user"), "Player not found.");
  assert.equal(
    lookupErrorStatus(httpError(404), "scores"),
    "No score found on this difficulty.",
  );
  assert.match(lookupErrorStatus(httpError(500), "scores"), /HTTP 500/);
  assert.match(
    lookupErrorStatus(new TypeError("Failed to fetch"), "user"),
    /^Search failed\. /,
  );
});
