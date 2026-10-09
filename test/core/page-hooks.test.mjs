import { test } from "node:test";
import assert from "node:assert/strict";

// page-hooks installs once per module instance, so every test shares this
// fake page window. It must exist before the first hook call.
class FakeXHR {
  constructor() {
    this.listeners = {};
    this.status = 0;
    this.responseType = "";
    this.response = null;
    this._text = "";
  }
  open(method, url) {
    this.openedUrl = url;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  get responseText() {
    if (this.responseType !== "" && this.responseType !== "text") {
      throw new Error("InvalidStateError");
    }
    this.textReads = (this.textReads ?? 0) + 1;
    return this._text;
  }
  respond(status, body, type = "") {
    this.status = status;
    this.responseType = type;
    if (type === "" || type === "text") this._text = body;
    else this.response = body;
    for (const fn of this.listeners.load ?? []) fn.call(this);
  }
}

const fetchCalls = [];
function fakeResponse(body, ok = true) {
  return {
    ok,
    clone: () => fakeResponse(body, ok),
    json: async () => body,
  };
}
const nativeFetch = function fetch(input) {
  fetchCalls.push({ input, self: this });
  return Promise.resolve(fakeResponse({ from: String(input?.url ?? input) }));
};

class FakeRequest {
  constructor(url, init) {
    this.url = url;
    this.init = init;
  }
}

const page = {
  XMLHttpRequest: FakeXHR,
  fetch: nativeFetch,
  Request: FakeRequest,
  URL,
};
globalThis.unsafeWindow = page;
globalThis.location = { href: "https://osu.ppy.sh/beatmapsets" };

const hooks = await import("../../src/core/page-hooks.js");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("install patches once and keeps the same fetch object", () => {
  hooks.install();
  const patched = page.fetch;
  const open = FakeXHR.prototype.open;
  hooks.install();
  hooks.addRequestRewriter((u) => u)();
  assert.notEqual(patched, nativeFetch);
  assert.equal(page.fetch, patched);
  assert.equal(FakeXHR.prototype.open, open);
});

test("request rewriters apply to XHR and fetch, and can be removed", async () => {
  const remove = hooks.addRequestRewriter((u) =>
    u.includes("/scores") ? `${u}?limit=100` : u,
  );
  const xhr = new FakeXHR();
  xhr.open("GET", "/beatmaps/1/scores");
  assert.equal(xhr.openedUrl, "/beatmaps/1/scores?limit=100");

  fetchCalls.length = 0;
  await page.fetch("/beatmaps/1/scores");
  await page.fetch(new URL("https://osu.ppy.sh/beatmaps/2/scores"));
  await page.fetch(new FakeRequest("https://osu.ppy.sh/beatmaps/3/scores"));
  assert.deepEqual(
    fetchCalls.map((c) => String(c.input.url ?? c.input)),
    [
      "/beatmaps/1/scores?limit=100",
      "https://osu.ppy.sh/beatmaps/2/scores?limit=100",
      "https://osu.ppy.sh/beatmaps/3/scores?limit=100",
    ],
  );
  assert.ok(fetchCalls[2].input instanceof FakeRequest);
  assert.equal(fetchCalls[0].self, page);

  remove();
  const xhr2 = new FakeXHR();
  xhr2.open("GET", "/beatmaps/1/scores");
  assert.equal(xhr2.openedUrl, "/beatmaps/1/scores");
});

test("JSON listeners get matching 2xx XHR responses by responseType (B23)", () => {
  const got = [];
  const remove = hooks.addJsonResponseListener({
    match: (url) => url.endsWith("/beatmapsets/search"),
    onJson: (url, json) => got.push([url, json]),
  });

  const text = new FakeXHR();
  text.open("GET", "/beatmapsets/search");
  text.respond(200, '{"a":1}');

  const json = new FakeXHR();
  json.open("GET", "/beatmapsets/search");
  json.respond(200, { b: 2 }, "json");

  const blob = new FakeXHR();
  blob.open("GET", "/beatmapsets/search");
  blob.respond(200, new ArrayBuffer(1), "arraybuffer"); // skipped, no throw

  const other = new FakeXHR();
  other.open("GET", "/other");
  other.respond(200, '{"c":3}');
  assert.equal(other.textReads, undefined); // not read: no listener matched

  const failed = new FakeXHR();
  failed.open("GET", "/beatmapsets/search");
  failed.respond(500, '{"d":4}');

  assert.deepEqual(got, [
    ["https://osu.ppy.sh/beatmapsets/search", { a: 1 }],
    ["https://osu.ppy.sh/beatmapsets/search", { b: 2 }],
  ]);
  remove();
  const after = new FakeXHR();
  after.open("GET", "/beatmapsets/search");
  after.respond(200, '{"e":5}');
  assert.equal(got.length, 2);
});

test("an XHR reopened for another URL reports the new URL once", () => {
  const got = [];
  const remove = hooks.addJsonResponseListener({
    match: () => true,
    onJson: (url) => got.push(url),
  });
  const xhr = new FakeXHR();
  xhr.open("GET", "/first");
  xhr.open("GET", "/second");
  xhr.respond(200, "{}");
  assert.deepEqual(got, ["https://osu.ppy.sh/second"]);
  remove();
});

test("JSON listeners get matching ok fetch responses", async () => {
  const got = [];
  const remove = hooks.addJsonResponseListener({
    match: (url) => url.includes("/users/"),
    onJson: (url, json) => got.push([url, json]),
  });
  await page.fetch("/users/1/beatmapsets/ranked");
  await page.fetch("/elsewhere");
  await tick();
  assert.deepEqual(got, [
    [
      "https://osu.ppy.sh/users/1/beatmapsets/ranked",
      { from: "/users/1/beatmapsets/ranked" },
    ],
  ]);
  remove();
});

test("a throwing listener or rewriter does not break the request", async () => {
  const { warn } = console;
  console.warn = () => {};
  try {
    const r1 = hooks.addRequestRewriter(() => {
      throw new Error("rewriter");
    });
    const r2 = hooks.addJsonResponseListener({
      match: () => true,
      onJson: () => {
        throw new Error("listener");
      },
    });
    const xhr = new FakeXHR();
    xhr.open("GET", "/x");
    xhr.respond(200, "{}");
    assert.equal(xhr.openedUrl, "/x");
    const res = await page.fetch("/y");
    assert.equal(res.ok, true);
    await tick();
    r1();
    r2();
  } finally {
    console.warn = warn;
  }
});

test("nativeFetch is the pre-hook fetch bound to the page", async () => {
  const fn = hooks.nativeFetch();
  fetchCalls.length = 0;
  await fn("/plain");
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].self, page);
  assert.equal(fetchCalls[0].input, "/plain");
});
