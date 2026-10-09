/**
 * "Beatmap discussion on Total tab": a discussion page opened without a tab
 * goes to /discussion/-/generalAll/total (B54; the old manager was never
 * called).
 *
 * osu-web rewrites a bare /beatmapsets/{id}/discussion to its default filter
 * (`/-/generalAll/praises` on ranked sets) with replaceState, sometimes before
 * the userscript runs. So a landing is either the bare path, or the default
 * filter on the first page load when the document itself was requested
 * bare. A link that names a tab (including praises) is left alone, and so
 * is every tab switch after that, so the redirect cannot loop.
 *
 * The redirect is a Turbo replace visit (osu-web's own navigation, no extra
 * history entry); without Turbo it falls back to `location.replace`.
 */

import { createLogger } from "../../core/log.js";
import { pageWindow } from "../../core/page-window.js";
import { discussionPath, discussionTotalPath } from "../../core/routes.js";

const log = createLogger("discussion/landing");

/**
 * @param {string} path
 * @param {string|number} beatmapsetId
 */
export function isBareDiscussionPath(path, beatmapsetId) {
  const base = discussionPath(beatmapsetId);
  return path === base || path === `${base}/`;
}

/**
 * The tab osu-web picks when none is given.
 * @param {string} path
 * @param {string|number} beatmapsetId
 */
export function isDefaultDiscussionTabPath(path, beatmapsetId) {
  const base = discussionPath(beatmapsetId);
  if (!path.startsWith(`${base}/`)) return false;
  return /^\/-\/generalAll(?:\/praises)?\/?$/.test(path.slice(base.length));
}

/** Pathname the current document was requested with (before any replaceState). */
function initialDocumentPath() {
  try {
    const [nav] = performance.getEntriesByType("navigation");
    return nav ? new URL(nav.name).pathname : null;
  } catch (_) {
    return null;
  }
}

/** @param {string} url */
function replaceVisit(url) {
  const win = pageWindow();
  const turbo = win.Turbo;
  if (turbo && typeof turbo.visit === "function") {
    try {
      const options = { action: "replace" };
      // Firefox: page code cannot read a sandbox object without cloneInto.
      turbo.visit(
        url,
        typeof cloneInto === "function" ? cloneInto(options, win) : options,
      );
      return;
    } catch (err) {
      log.warn("Turbo.visit failed, reloading instead:", err);
    }
  }
  location.replace(url);
}

/**
 * @param {{ initialDocumentPath?: () => string|null,
 *   visit?: (url: string) => void }} [deps]  Injectable for tests.
 */
export function createLandingRedirect(deps = {}) {
  const getInitialPath = deps.initialDocumentPath ?? initialDocumentPath;
  const visit = deps.visit ?? replaceVisit;
  let firstInit = true;

  /**
   * @param {number} beatmapsetId
   * @param {{ IDS: Record<string, string>, isEnabled: (id: string) => boolean,
   *   onChange: (id: string, fn: (on: boolean) => void) => () => void }} settings
   * @returns {() => void}
   */
  function start(beatmapsetId, settings) {
    const settingId = settings.IDS.DISCUSSION_DEFAULT_TO_TOTAL;
    const path = location.pathname;
    let landing = isBareDiscussionPath(path, beatmapsetId);
    if (
      !landing &&
      firstInit &&
      isDefaultDiscussionTabPath(path, beatmapsetId)
    ) {
      const original = getInitialPath();
      landing =
        original != null && isBareDiscussionPath(original, beatmapsetId);
    }
    firstInit = false;

    let done = false;
    const run = () => {
      if (done || !landing || !settings.isEnabled(settingId)) return;
      done = true;
      visit(
        `${discussionTotalPath(beatmapsetId)}${location.search}${location.hash}`,
      );
    };

    run();
    const off = settings.onChange(settingId, (on) => {
      if (on) run();
    });
    return () => {
      off();
      done = true;
    };
  }

  return { start };
}

export const startDiscussionLandingRedirect = createLandingRedirect().start;
