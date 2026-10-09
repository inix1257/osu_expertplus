/**
 * Console logger with a fixed `[osu! Expert+]` prefix.
 *
 * warn/error always print. debug/info print only when the GM key
 * `oep.debug` is true (set it from the userscript manager's storage editor).
 */

import { KEYS } from "./storage.js";

const PREFIX = "[osu! Expert+]";
export const DEBUG_KEY = KEYS.DEBUG.key;

/** @type {boolean|null} */
let debugEnabled = null;

function isDebugEnabled() {
  if (debugEnabled === null) {
    try {
      debugEnabled =
        typeof GM_getValue === "function" && GM_getValue(DEBUG_KEY) === true;
    } catch {
      debugEnabled = false;
    }
  }
  return debugEnabled;
}

/**
 * Overrides the cached `oep.debug` flag (tests, or toggling at runtime).
 * Pass `null` to re-read the GM key on the next call.
 * @param {boolean|null} value
 */
export function setDebugEnabled(value) {
  debugEnabled = value;
}

/**
 * @param {string} [scope]  Shown after the prefix, e.g. `router`.
 */
export function createLogger(scope) {
  const head = scope ? [`${PREFIX} [${scope}]`] : [PREFIX];
  return {
    /** @param {...unknown} args */
    debug(...args) {
      if (isDebugEnabled()) console.debug(...head, ...args);
    },
    /** @param {...unknown} args */
    info(...args) {
      if (isDebugEnabled()) console.info(...head, ...args);
    },
    /** @param {...unknown} args */
    warn(...args) {
      console.warn(...head, ...args);
    },
    /** @param {...unknown} args */
    error(...args) {
      console.error(...head, ...args);
    },
  };
}

export const log = createLogger();
