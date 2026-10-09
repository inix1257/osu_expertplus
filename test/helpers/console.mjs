/**
 * Replaces console.debug/info/warn/error while `fn` runs and returns the
 * calls as `[method, ...args]` arrays. Also used just to silence expected
 * warnings.
 * @param {() => unknown} fn
 * @returns {unknown[][]}
 */
export function captureConsole(fn) {
  const calls = [];
  const saved = {};
  for (const k of ["debug", "info", "warn", "error"]) {
    saved[k] = console[k];
    console[k] = (...args) => calls.push([k, ...args]);
  }
  try {
    fn();
  } finally {
    Object.assign(console, saved);
  }
  return calls;
}
