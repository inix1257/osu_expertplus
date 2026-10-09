import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchInspectorProfile,
  INSPECTOR_PROFILE_URL,
  modeIndexForRuleset,
} from "../../src/api/kirino.js";

test("modeIndexForRuleset", () => {
  assert.equal(modeIndexForRuleset("osu"), 0);
  assert.equal(modeIndexForRuleset("taiko"), 1);
  assert.equal(modeIndexForRuleset("fruits"), 2);
  assert.equal(modeIndexForRuleset("mania"), 3);
  assert.equal(modeIndexForRuleset("nope"), 0);
});

test("fetchInspectorProfile posts the profile request", async () => {
  let seen;
  const json = await fetchInspectorProfile(2, 3, "peppy", {
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => ({ ok: 1 }) };
    },
  });
  assert.deepEqual(json, { ok: 1 });
  assert.equal(seen.url, INSPECTOR_PROFILE_URL);
  assert.equal(seen.init.method, "POST");
  assert.deepEqual(JSON.parse(seen.init.body), {
    user_id: "2",
    mode: 3,
    username: "peppy",
  });
});

/** Fake fetch that never answers but rejects when its signal aborts. */
function hangingFetch(url, init) {
  return new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason));
  });
}

test("fetchInspectorProfile times out instead of waiting forever (B52)", async () => {
  await assert.rejects(
    fetchInspectorProfile(1, 0, "", { fetchImpl: hangingFetch, timeoutMs: 20 }),
    (err) => err.name === "TimeoutError",
  );
});

test("fetchInspectorProfile also aborts on the caller's signal", async () => {
  const ac = new AbortController();
  const p = fetchInspectorProfile(1, 0, "", {
    fetchImpl: hangingFetch,
    signal: ac.signal,
  });
  ac.abort();
  await assert.rejects(p, (err) => err.name === "AbortError");
});

test("fetchInspectorProfile throws on HTTP errors", async () => {
  await assert.rejects(
    fetchInspectorProfile(1, 0, "", {
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /Kirino inspector 503/,
  );
});
