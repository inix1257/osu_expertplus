/**
 * Access to the page's own window from the userscript sandbox.
 *
 * Under Tampermonkey/Violentmonkey with `@grant`, `window` is the sandbox and
 * `unsafeWindow` is the page. Page globals (osu-web's `$`, `osuCore`, its
 * `fetch`) live only on the page window.
 */

/** @returns {Window & typeof globalThis} */
export function pageWindow() {
  try {
    if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
      return unsafeWindow;
    }
  } catch {
    // unsafeWindow can throw in some sandboxes.
  }
  return window;
}

/** Page-origin `localStorage` (osu.ppy.sh), or null if unavailable. */
export function pageLocalStorage() {
  try {
    return pageWindow()?.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Makes a sandbox function callable from page code. Firefox (Xray
 * wrappers) needs `exportFunction`; elsewhere the function is used as is.
 * @template {Function} T
 * @param {T} fn
 * @param {object} [target]  Page object the function will live on.
 * @returns {T}
 */
export function exposeToPage(fn, target = pageWindow()) {
  if (typeof exportFunction === "function") {
    try {
      return exportFunction(fn, target);
    } catch {
      // Fall back to the plain function.
    }
  }
  return fn;
}
