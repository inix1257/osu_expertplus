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

test("getUser and getUserByName encode names (B15)", async () => {
  const { api, calls } = loadApi();
  await api.getUser(124493);
  await api.getUser(" 124493 ");
  await api.getUser("chocomint", "osu");
  await api.getUser("a b/c");
  await api.getUserByName("1234");
  await api.getUserByName("名前");
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      "https://osu.ppy.sh/api/v2/users/124493",
      "https://osu.ppy.sh/api/v2/users/124493",
      "https://osu.ppy.sh/api/v2/users/@chocomint?mode=osu",
      "https://osu.ppy.sh/api/v2/users/@a%20b%2Fc",
      "https://osu.ppy.sh/api/v2/users/@1234",
      `https://osu.ppy.sh/api/v2/users/@${encodeURIComponent("名前")}`,
    ],
  );
});

test("get() errors carry the HTTP status", async () => {
  const { api } = loadApi({
    respond: () => ({ ok: false, status: 404, json: async () => ({}) }),
  });
  await assert.rejects(
    api.getUserByName("nobody"),
    (err) => err.status === 404,
  );
});

test("a 401 on a Bearer request drops the token and retries once (B35)", async () => {
  let status = 401;
  const { api, calls, window } = loadApi({
    respond: () => ({ ok: status === 200, status, json: async () => ({}) }),
  });
  let cleared = 0;
  let token = "old";
  window.OsuExpertPlus.auth = {
    getAuthHeader: async () => (token ? `Bearer ${token}` : null),
    clearCachedToken: () => {
      cleared++;
      token = "new";
      status = 200;
    },
  };
  await api.getBeatmap(1);
  assert.equal(cleared, 1);
  assert.deepEqual(
    calls.map((c) => c.init.headers.Authorization),
    ["Bearer old", "Bearer new"],
  );

  // Still 401 after the retry: give up (no loop).
  status = 401;
  window.OsuExpertPlus.auth.clearCachedToken = () => cleared++;
  calls.length = 0;
  await assert.rejects(api.getBeatmap(1), (err) => err.status === 401);
  assert.equal(calls.length, 2);

  // No Bearer: no retry.
  token = null;
  calls.length = 0;
  await assert.rejects(api.getBeatmap(1));
  assert.equal(calls.length, 1);
});

test("user beatmap scores ask for the lazer score shape (B89)", async () => {
  const { api, calls } = loadApi({ authHeader: "Bearer t" });
  await api.getBeatmapUserScoresAll(129891, 2, {
    ruleset: "osu",
    legacy_only: 0,
  });
  await api.getBeatmap(129891);
  assert.equal(
    calls[0].url,
    "https://osu.ppy.sh/api/v2/beatmaps/129891/scores/users/2/all?ruleset=osu&legacy_only=0",
  );
  assert.equal(calls[0].init.headers["x-api-version"], "20240529");
  assert.equal(calls[0].init.headers.Authorization, "Bearer t");
  // Other routes keep their current response shape.
  assert.equal(calls[1].init.headers["x-api-version"], undefined);
});
