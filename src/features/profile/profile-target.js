/**
 * Which profile and ruleset the page shows, and who is signed in (WS-41).
 */

import { rulesetFromProfileUrl } from "../../osu/ruleset.js";

function getUserIdFromUrl() {
  const m = location.pathname.match(/^\/users\/(\d+)/);
  return m ? m[1] : null;
}

/** @returns {Object|null} */
export function parseProfileInitialData() {
  try {
    const nodes = document.querySelectorAll(".js-react[data-initial-data]");
    for (const node of nodes) {
      const data = JSON.parse(node.dataset.initialData);
      if (data?.user?.id != null) return data;
    }
  } catch (_) {}
  return null;
}

export function getProfileUserId() {
  const fromUrl = getUserIdFromUrl();
  if (fromUrl) return fromUrl;
  const data = parseProfileInitialData();
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
 * Resolve the profile user + ruleset for the page in the URL, waiting for the
 * new page's data when the DOM still holds the previous profile.
 * @param {number} [timeoutMs]
 * @returns {Promise<{ userId: string, mode: string } | null>}
 */
export async function resolveProfileTarget(timeoutMs = 8000) {
  const start = Date.now();
  const urlId = getUserIdFromUrl();
  const urlMode = getModeFromUrl();
  if (urlId && urlMode) return { userId: urlId, mode: urlMode };

  for (;;) {
    const data = parseProfileInitialData();
    if (data && profileDataMatchesUrl(data)) {
      return {
        userId: String(data.user.id),
        mode: urlMode ?? data.current_mode ?? "osu",
      };
    }
    if (Date.now() - start >= timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 100));
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
