import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGeneration,
  listen,
  mountSettingFeature,
  safeStart,
} from "../../src/core/lifecycle.js";
import { captureConsole } from "../helpers/console.mjs";

function createBag() {
  const fns = [];
  return {
    add: (...f) => fns.push(...f),
    dispose() {
      while (fns.length) fns.pop()();
    },
  };
}

function createSettings(initial) {
  const values = new Map(Object.entries(initial));
  const listeners = new Map();
  return {
    isEnabled: (id) => !!values.get(id),
    onChange(id, fn) {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(fn);
      return () => listeners.get(id).delete(fn);
    },
    set(id, v) {
      values.set(id, v);
      listeners.get(id)?.forEach((fn) => fn(v));
    },
    listenerCount: (id) => listeners.get(id)?.size ?? 0,
  };
}

test("safeStart adds the returned cleanup", () => {
  const bag = createBag();
  let disposed = 0;
  assert.equal(
    safeStart(bag, () => () => disposed++),
    true,
  );
  bag.dispose();
  assert.equal(disposed, 1);
});

test("safeStart logs a throw and later features still start (B51)", () => {
  const bag = createBag();
  const order = [];
  const calls = captureConsole(() => {
    safeStart(bag, () => () => order.push("a"));
    const ok = safeStart(
      bag,
      () => {
        throw new Error("boom");
      },
      "b",
    );
    assert.equal(ok, false);
    safeStart(bag, () => () => order.push("c"));
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "error");
  assert.match(String(calls[0][2]), /failed to start b/);
  bag.dispose();
  assert.deepEqual(order, ["c", "a"]);
});

test("mountSettingFeature follows the setting and cleans up with the bag", () => {
  const bag = createBag();
  const settings = createSettings({ f: true });
  const events = [];
  let n = 0;
  mountSettingFeature(bag, settings, "f", () => {
    const id = ++n;
    events.push(`mount${id}`);
    return () => events.push(`dispose${id}`);
  });
  settings.set("f", true); // already mounted
  settings.set("f", false);
  settings.set("f", false);
  settings.set("f", true);
  bag.dispose();
  assert.deepEqual(events, ["mount1", "dispose1", "mount2", "dispose2"]);
  assert.equal(settings.listenerCount("f"), 0);
});

test("mountSettingFeature mounts later when the setting starts off", () => {
  const bag = createBag();
  const settings = createSettings({ f: false });
  let mounted = 0;
  mountSettingFeature(bag, settings, "f", () => {
    mounted++;
  });
  assert.equal(mounted, 0);
  settings.set("f", true);
  assert.equal(mounted, 1);
  bag.dispose();
});

test("mountSettingFeature survives a throwing mount", () => {
  const bag = createBag();
  const settings = createSettings({ f: true });
  let calls = 0;
  const mount = () => {
    calls++;
    throw new Error("boom");
  };
  captureConsole(() => {
    mountSettingFeature(bag, settings, "f", mount);
    settings.set("f", false);
    settings.set("f", true);
  });
  assert.equal(calls, 2);
  bag.dispose();
});

test("createGeneration", () => {
  const gen = createGeneration();
  const a = gen.next();
  assert.equal(gen.isCurrent(a), true);
  const b = gen.next();
  assert.equal(gen.isCurrent(a), false);
  assert.equal(gen.isCurrent(b), true);
  assert.equal(gen.current(), b);
});

test("listen removes the listener when the signal aborts", () => {
  const target = new EventTarget();
  const ac = new AbortController();
  let calls = 0;
  listen(target, "ping", () => calls++, ac.signal, { capture: true });
  target.dispatchEvent(new Event("ping"));
  ac.abort();
  target.dispatchEvent(new Event("ping"));
  assert.equal(calls, 1);

  listen(target, "ping", () => calls++, ac.signal);
  target.dispatchEvent(new Event("ping"));
  assert.equal(calls, 1, "an aborted signal adds nothing");
});
