import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"], {
  url: "https://osu.ppy.sh/users/2/osu",
});
for (const key of ["window", "document", "OsuExpertPlus"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { createOrderSaver } =
  await import("../../src/features/profile/contents-reorder.js");

/** A save whose calls resolve or reject when the test says so. */
function controlledSave() {
  const calls = [];
  const save = (ids) =>
    new Promise((resolve, reject) => calls.push({ ids, resolve, reject }));
  return { save, calls };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("B48: one request at a time, only the last waiting order is sent", async () => {
  const { save, calls } = controlledSave();
  const failures = [];
  const saver = createOrderSaver({
    save,
    initial: ["a", "b", "c"],
    onFailed: (err, confirmed) => failures.push(confirmed),
  });
  saver.request(["b", "a", "c"]);
  saver.request(["c", "b", "a"]);
  saver.request(["c", "a", "b"]);
  await flush();
  assert.equal(calls.length, 1, "the first drop is in flight");
  assert.deepEqual(calls[0].ids, ["b", "a", "c"]);
  calls[0].resolve();
  await flush();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].ids, ["c", "a", "b"], "the middle one is skipped");
  calls[1].resolve();
  await flush();
  assert.deepEqual(failures, []);
});

test("B48: a failed last save rolls back to the last accepted order", async () => {
  const { save, calls } = controlledSave();
  const failures = [];
  const saver = createOrderSaver({
    save,
    initial: ["a", "b", "c"],
    onFailed: (err, confirmed) => failures.push([err.message, confirmed]),
  });
  saver.request(["b", "a", "c"]);
  await flush();
  calls[0].resolve();
  await flush();
  saver.request(["c", "b", "a"]);
  await flush();
  calls[1].reject(new Error("403"));
  await flush();
  assert.deepEqual(failures, [["403", ["b", "a", "c"]]]);
});

test("B48: a failure followed by a newer order only sends the newer one", async () => {
  const { save, calls } = controlledSave();
  const failures = [];
  const saver = createOrderSaver({
    save,
    initial: ["a", "b"],
    onFailed: (err, confirmed) => failures.push(confirmed),
  });
  saver.request(["b", "a"]);
  saver.request(["a", "b"]);
  await flush();
  calls[0].reject(new Error("500"));
  await flush();
  assert.deepEqual(failures, [], "a newer order is waiting");
  assert.deepEqual(calls[1].ids, ["a", "b"]);
  calls[1].resolve();
  await flush();
  assert.deepEqual(failures, []);
});
