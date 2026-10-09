import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getBool, getJSON, KEYS, setJSON } from "../../src/core/storage.js";

/** @type {Map<string, unknown>} */
let store;
beforeEach(() => {
  store = new Map();
  globalThis.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  globalThis.GM_setValue = (k, v) => void store.set(k, v);
});

test("registry keys are unique and well-formed", () => {
  const names = Object.values(KEYS).map((k) => k.key);
  assert.equal(new Set(names).size, names.length);
  for (const k of Object.values(KEYS)) {
    assert.ok(["gm", "localStorage"].includes(k.store), k.key);
    assert.ok(
      ["string", "number", "boolean", "json"].includes(k.format),
      k.key,
    );
    assert.ok(k.owner && k.purpose, k.key);
  }
  assert.equal(KEYS.DEBUG.key, "oep.debug");
});

test("getBool", () => {
  assert.equal(getBool(KEYS.DEBUG), false);
  assert.equal(getBool("x", true), true);
  store.set("oep.debug", true);
  assert.equal(getBool(KEYS.DEBUG), true);
  store.set("oep.debug", "true"); // not a boolean
  assert.equal(getBool(KEYS.DEBUG), false);
  globalThis.GM_getValue = () => {
    throw new Error("unavailable");
  };
  assert.equal(getBool("x", true), true);
});

test("getJSON / setJSON", () => {
  const key = KEYS.PROFILE_SECTIONS_COLLAPSED;
  assert.deepEqual(getJSON(key, {}), {});
  assert.equal(setJSON(key, { a: [1] }), true);
  assert.equal(store.get(key.key), '{"a":[1]}');
  assert.deepEqual(getJSON(key, {}), { a: [1] });
  store.set(key.key, "{broken");
  assert.deepEqual(getJSON(key, { d: 1 }), { d: 1 });
  store.set(key.key, { already: "object" });
  assert.deepEqual(getJSON(key, null), { already: "object" });
  globalThis.GM_setValue = () => {
    throw new Error("quota");
  };
  assert.equal(setJSON(key, 1), false);
});
