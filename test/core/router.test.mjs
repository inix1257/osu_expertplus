import { test } from "node:test";
import assert from "node:assert/strict";
import { Router } from "../../src/core/router.js";
import { captureConsole } from "../helpers/console.mjs";

const noop = { init() {} };

/** @param {Record<string, { init: Function }>} pages */
function createRouter(pages) {
  return new Router({
    accountEdit: noop,
    beatmapDetail: noop,
    beatmapsetsListing: noop,
    userProfile: noop,
    ...pages,
  });
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("init gets match and ctx; leaving aborts the signal before cleanup", () => {
  const events = [];
  const router = createRouter({
    beatmapDetail: {
      init(match, ctx) {
        events.push(["init", match[1], ctx.path, ctx.match === match]);
        ctx.signal.addEventListener("abort", () => events.push(["abort"]));
        return () => events.push(["cleanup", ctx.signal.aborted]);
      },
    },
  });
  router._navigate("/beatmapsets/42");
  router._navigate("/beatmapsets/42"); // same path: ignored
  router._navigate("/users/1");
  assert.deepEqual(events, [
    ["init", "42", "/beatmapsets/42", true],
    ["abort"],
    ["cleanup", true],
  ]);
});

test("async init that resolves after leaving is cleaned up at once", async () => {
  let resolve;
  let cleaned = 0;
  const router = createRouter({
    userProfile: {
      init: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  router._navigate("/users/1");
  router._navigate("/beatmapsets/1");
  resolve(() => cleaned++);
  await tick();
  assert.equal(cleaned, 1);
  assert.equal(router._cleanupFn, null);
});

test("re-running the same path drops the stale async cleanup", async () => {
  const resolvers = [];
  const cleaned = [];
  const router = createRouter({
    userProfile: { init: () => new Promise((r) => resolvers.push(r)) },
  });
  router._navigate("/users/1");
  router._currentPath = null; // what popstate does
  router._navigate("/users/1");
  resolvers[0](() => cleaned.push(1));
  resolvers[1](() => cleaned.push(2));
  await tick();
  assert.deepEqual(cleaned, [1]);
  router._navigate("/beatmapsets/1");
  assert.deepEqual(cleaned, [1, 2]);
});

test("a throwing init or cleanup is logged and navigation continues", () => {
  const router = createRouter({
    beatmapDetail: {
      init: () => () => {
        throw new Error("cleanup");
      },
    },
    userProfile: {
      init() {
        throw new Error("init");
      },
    },
  });
  const calls = captureConsole(() => {
    router._navigate("/beatmapsets/1");
    router._navigate("/users/1");
  });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["warn", "warn"],
  );
  assert.equal(router._cleanupFn, null);
});
