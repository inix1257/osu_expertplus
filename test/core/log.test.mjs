import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createLogger, setDebugEnabled } from "../../src/core/log.js";
import { captureConsole } from "../helpers/console.mjs";

afterEach(() => {
  setDebugEnabled(null);
  delete globalThis.GM_getValue;
});

test("warn and error always print with the prefix", () => {
  setDebugEnabled(false);
  const log = createLogger("x");
  const calls = captureConsole(() => {
    log.debug("d");
    log.info("i");
    log.warn("w", 1);
    log.error("e");
  });
  assert.deepEqual(calls, [
    ["warn", "[osu! Expert+] [x]", "w", 1],
    ["error", "[osu! Expert+] [x]", "e"],
  ]);
});

test("debug and info follow the oep.debug GM key", () => {
  globalThis.GM_getValue = (key) => key === "oep.debug";
  const log = createLogger();
  const calls = captureConsole(() => {
    log.debug("d");
    log.info("i");
  });
  assert.deepEqual(calls, [
    ["debug", "[osu! Expert+]", "d"],
    ["info", "[osu! Expert+]", "i"],
  ]);
});

test("missing GM_getValue means debug off", () => {
  const calls = captureConsole(() => createLogger().debug("d"));
  assert.deepEqual(calls, []);
});
