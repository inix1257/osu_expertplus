/**
 * Which profile and ruleset the page shows, and who is signed in (WS-41).
 */

import { observe } from "../../core/observe.js";
import { rulesetFromProfileUrl } from "../../osu/ruleset.js";

const INITIAL_DATA_SEL = ".js-react[data-initial-data]";

/**
 * Resolves when initial data is added or changed, or after `ms`.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function initialDataChange(ms) {
  return new Promise((resolve) => {
    const ac = new AbortController();
    const done = () => {
      clearTimeout(timer);
      ac.abort();
      resolve();
    };
    const timer = setTimeout(done, ms);
    observe.subscribe(
      {
        selector: INITIAL_DATA_SEL,
        attributes: ["data-initial-data"],
        schedule: "sync",
        signal: ac.signal,
        label: "profile/target",
      },
      done,
    );
  });
}

function getUserIdFromUrl() {
  const m = location.pathname.match(/^\/users\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * The first React initial-data blob on the page that has a user. A node with
 * invalid JSON is skipped, not the end of the search (B69).
 * @returns {Object|null}
 */
export function parseProfileInitialData() {
  const nodes = document.querySelectorAll(INITIAL_DATA_SEL);
  for (const node of nodes) {
    let data;
    try {
      data = JSON.parse(node.dataset.initialData);
    } catch (_) {
      continue;
    }
    if (data?.user?.id != null) return data;
  }
  return null;
}

/**
 * The profile's user id: from the URL, else from initial data that belongs
 * to the URL (null while the DOM still shows the previous profile, B43).
 * @returns {string|null}
 */
export function getProfileUserId() {
  const fromUrl = getUserIdFromUrl();
  if (fromUrl) return fromUrl;
  const data = profileInitialDataForUrl();
  return data?.user?.id != null ? String(data.user.id) : null;
}

/** Ruleset named in the URL (`/users/1/taiko` or `?mode=taiko`), if any. */
function getModeFromUrl() {
  return rulesetFromProfileUrl(location.pathname, location.search);
}

/**
 * Whether the profile initial data in the DOM belongs to the profile in the URL.
 * The router runs on pushState, i.e. before the new page is rendered, so the DOM
 * can still hold the previous profile (and its default ruleset).
 * @param {Object|null} data
 */
function profileDataMatchesUrl(data) {
  if (!data?.user) return false;
  const m = location.pathname.match(/^\/users\/([^/]+)/);
  if (!m) return true;
  const seg = decodeURIComponent(m[1]);
  if (/^\d+$/.test(seg)) return String(data.user.id) === seg;
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[\s_]+/g, "_");
  return norm(data.user.username ?? "") === norm(seg);
}

/**
 * The initial data, only when it belongs to the profile in the URL (B43):
 * right after an SPA move the DOM can still hold the previous profile.
 * @returns {Object|null}
 */
export function profileInitialDataForUrl() {
  const data = parseProfileInitialData();
  return data && profileDataMatchesUrl(data) ? data : null;
}

export function getCurrentMode() {
  const fromUrl = getModeFromUrl();
  if (fromUrl) return fromUrl;

  const data = parseProfileInitialData();
  if (data?.current_mode && profileDataMatchesUrl(data)) {
    return data.current_mode;
  }
  return "osu";
}

/**
 * @typedef {{ userId: string, mode: string, isOwnProfile: boolean }} ProfileTarget
 */

/**
 * @param {string} userId
 * @param {string} mode
 * @returns {ProfileTarget}
 */
function profileTarget(userId, mode) {
  const me = getCurrentUserIdFromHeader();
  return { userId, mode, isOwnProfile: me != null && me === String(userId) };
}

/**
 * Resolve the profile user + ruleset for the page in the URL, waiting for the
 * new page's data when the DOM still holds the previous profile. Whether it
 * is the signed-in user's own profile is decided here, once, from the same
 * data (B43).
 * @param {number} [timeoutMs]
 * @returns {Promise<ProfileTarget | null>}
 */
export async function resolveProfileTarget(timeoutMs = 8000) {
  const start = Date.now();
  const urlId = getUserIdFromUrl();
  const urlMode = getModeFromUrl();
  if (urlId && urlMode) return profileTarget(urlId, urlMode);

  for (;;) {
    const data = parseProfileInitialData();
    if (data && profileDataMatchesUrl(data)) {
      return profileTarget(
        String(data.user.id),
        urlMode ?? data.current_mode ?? "osu",
      );
    }
    const left = timeoutMs - (Date.now() - start);
    if (left <= 0) return null;
    // Wait for the new page's data instead of polling every 100ms.
    await initialDataChange(left);
  }
}

export function getCurrentUserIdFromHeader() {
  const link = document.querySelector(
    "a.u-current-user-avatar[href*='/users/'], a.u-current-user-cover[href*='/users/']",
  );
  if (!(link instanceof HTMLAnchorElement)) return null;
  const href = link.getAttribute("href") || "";
  const m = href.match(/\/users\/(\d+)(?:\/|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? String(n) : null;
}
