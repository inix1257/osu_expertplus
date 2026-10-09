import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

/**
 * Loads api.js with a recording fetch and a stub auth module.
 * @param {{ respond?: (url: string, init: RequestInit) => object,
 *   authHeader?: string|null }} [opts]
 */
function loadApi(opts = {}) {
  const calls = [];
  const respond =
    opts.respond ?? (() => ({ ok: true, status: 200, json: async () => ({}) }));
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return respond(String(url), init);
  };
  const { window, OsuExpertPlus } = loadScripts(["src/utils/api.js"], {
    globals: { fetch },
  });
  OsuExpertPlus.auth = {
    getAuthHeader: async () => opts.authHeader ?? null,
  };
  return { window, api: OsuExpertPlus.api, calls };
}

test("buildQuery skips null/undefined and repeats array keys", () => {
  const { api } = loadApi();
  assert.equal(
    api.buildQuery({ a: 1, b: null, c: undefined, "d[]": ["x", "y"], e: "" }),
    "a=1&d%5B%5D=x&d%5B%5D=y&e=",
  );
  assert.equal(api.buildQuery(), "");
});

test("buildHeaders adds the Bearer token unless auth is off", async () => {
  const { api } = loadApi({ authHeader: "Bearer t" });
  assert.deepEqual(
    { ...(await api.buildHeaders()) },
    {
      Accept: "application/json",
      Authorization: "Bearer t",
    },
  );
  assert.deepEqual(
    { ...(await api.buildHeaders({ auth: false })) },
    {
      Accept: "application/json",
    },
  );
});

test("site route helpers build the same URLs the pages used", async () => {
  const { api, calls } = loadApi();
  await api.fetchUserScoresPage(2, "best", {
    mode: "osu",
    limit: 100,
    offset: 50,
  });
  await api.fetchUserExtraPage(2, "historical", { mode: "mania" });
  await api.fetchUserRecentScoresWebsite(2, {
    mode: "osu",
    limit: 100,
    offset: 0,
    includeFails: true,
  });
  await api.fetchUserRecentScoresWebsite(2, { mode: "osu", limit: 100 });
  await api.fetchBeatmapOsuFile(129891);
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      "/users/2/scores/best?mode=osu&limit=100&offset=50&include=beatmap",
      "/users/2/extra-pages/historical?mode=mania",
      "/users/2/scores/recent?mode=osu&limit=100&offset=0&include_fails=1&include=beatmap&include=beatmapset",
      "/users/2/scores/recent?mode=osu&limit=100&include=beatmap&include=beatmapset",
      "https://osu.ppy.sh/osu/129891",
    ],
  );
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers.Accept, "application/json");
});

test("siteWrite sends CSRF and form body, and throws with the status", async () => {
  const { window, api, calls } = loadApi({
    respond: (url) =>
      url.includes("bad")
        ? { ok: false, status: 422 }
        : { ok: true, status: 204 },
  });
  const meta = window.document.createElement("meta");
  meta.name = "csrf-token";
  meta.content = "tok";
  window.document.head.appendChild(meta);

  const body = new window.URLSearchParams();
  body.append("a[]", "1");
  const resp = await api.siteWrite("PUT", "/home/account/options", body);
  assert.equal(resp.status, 204);
  const { init } = calls[0];
  assert.equal(init.method, "PUT");
  assert.equal(init.headers["X-CSRF-Token"], "tok");
  assert.equal(init.headers["X-Requested-With"], "XMLHttpRequest");
  assert.match(init.headers["Content-Type"], /x-www-form-urlencoded/);
  assert.equal(init.body, "a%5B%5D=1");

  await assert.rejects(api.siteWrite("PUT", "/bad"), (err) => {
    assert.equal(err.status, 422);
    return true;
  });
});
