/** URL → page module; re-inits on SPA navigation. */

import { createLogger } from "./log.js";
import {
  ACCOUNT_EDIT_RE,
  BEATMAPSET_RE,
  BEATMAPSETS_LISTING_RE,
  USER_PROFILE_RE,
} from "./routes.js";

const log = createLogger("router");

/**
 * Context passed to `init(match, ctx)`. `signal` aborts when the page is left,
 * before the page's cleanup runs.
 * @typedef {{ match: RegExpMatchArray, signal: AbortSignal, path: string }} RouteContext
 * @typedef {{ init: (match: RegExpMatchArray, ctx: RouteContext) =>
 *   (void | (() => void) | Promise<void | (() => void)>) }} PageModule
 */

/** @param {() => void} fn */
function runCleanup(fn) {
  try {
    fn();
  } catch (err) {
    log.warn("page cleanup failed:", err);
  }
}

export class Router {
  /**
   * @param {Record<string, PageModule>} pages  `OsuExpertPlus.pages`
   */
  constructor(pages) {
    /** @type {{ pattern: RegExp, module: PageModule }[]} */
    this._routes = [
      { pattern: ACCOUNT_EDIT_RE, module: pages.accountEdit },
      { pattern: BEATMAPSET_RE, module: pages.beatmapDetail },
      { pattern: BEATMAPSETS_LISTING_RE, module: pages.beatmapsetsListing },
      { pattern: USER_PROFILE_RE, module: pages.userProfile },
    ];

    /** @type {string|null} */
    this._currentPath = null;
    /** @type {(() => void) | null} */
    this._cleanupFn = null;
    /** @type {AbortController|null} */
    this._abort = null;
  }

  /** Start the router, run the matching module, and watch for SPA navigation. */
  init() {
    this._navigate(location.pathname);
    this._watchNavigation();
  }

  /** @param {string} path */
  _navigate(path) {
    if (path === this._currentPath) return;
    this._currentPath = path;

    // Leave the previous page: abort first so in-flight work sees it, then clean up.
    this._abort?.abort();
    this._abort = null;
    if (typeof this._cleanupFn === "function") {
      const fn = this._cleanupFn;
      this._cleanupFn = null;
      runCleanup(fn);
    }

    for (const route of this._routes) {
      const match = path.match(route.pattern);
      if (!match) continue;
      const controller = new AbortController();
      this._abort = controller;
      /** @type {RouteContext} */
      const ctx = { match, signal: controller.signal, path };
      try {
        const result = route.module.init(match, ctx);
        if (result && typeof result.then === "function") {
          result
            .then((fn) => {
              // The page was left before async init finished: clean up now.
              if (this._currentPath === path && !controller.signal.aborted) {
                this._cleanupFn = typeof fn === "function" ? fn : null;
              } else if (typeof fn === "function") {
                runCleanup(fn);
              }
            })
            .catch((err) => log.warn(`init failed for ${path}:`, err));
        } else {
          this._cleanupFn = typeof result === "function" ? result : null;
        }
      } catch (err) {
        log.warn(`init failed for ${path}:`, err);
      }
      return;
    }
  }

  /**
   * pushState/replaceState wrap, popstate (clears path first), + pathname poll
   * (Inertia may cache pre-wrap history).
   */
  _watchNavigation() {
    const navigate = this._navigate.bind(this);

    const wrap = (original) =>
      function (...args) {
        const result = original.apply(this, args);
        navigate(location.pathname);
        return result;
      };

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);

    // Back/forward: clear path so dedupe cannot skip the event
    window.addEventListener("popstate", () => {
      this._currentPath = null;
      navigate(location.pathname);
    });

    // Pathname poll: catches history calls that bypass our wrap; 200ms + dedupe avoids double init
    let polledPath = location.pathname;
    setInterval(() => {
      const path = location.pathname;
      if (path !== polledPath) {
        polledPath = path;
        navigate(path);
      }
    }, 200);
  }
}
