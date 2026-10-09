/**
 * Pathname predicates shared by the router and features. Each takes a
 * `location.pathname`-style string (no query or hash).
 */

export const ACCOUNT_EDIT_RE = /^\/home\/account\/edit/;
export const BEATMAPSET_RE = /^\/beatmapsets\/(\d+)/;
export const BEATMAPSET_DISCUSSION_RE =
  /^\/beatmapsets\/(\d+)\/discussion(?:\/|$)/;
/** The review editor's Total tab, which has its own composer (no preview). */
export const DISCUSSION_REVIEWS_TOTAL_RE =
  /^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i;
/** `/beatmapsets` only, not `/beatmapsets/discussions` or `/beatmapsets/events`. */
export const BEATMAPSETS_LISTING_RE = /^\/beatmapsets\/?$/;
export const USER_PROFILE_RE = /^\/users\//;

/** @param {string} path */
export function isAccountEdit(path) {
  return ACCOUNT_EDIT_RE.test(path);
}

/** @param {string} path */
export function isBeatmapsetsListing(path) {
  return BEATMAPSETS_LISTING_RE.test(path);
}

/**
 * @param {string} path
 * @returns {number|null}
 */
export function beatmapsetIdFromPath(path) {
  const m = BEATMAPSET_RE.exec(path);
  return m ? Number(m[1]) : null;
}

/** @param {string} path */
export function isBeatmapsetDiscussion(path) {
  return BEATMAPSET_DISCUSSION_RE.test(path);
}

/** @param {string} path */
export function isUserProfile(path) {
  return USER_PROFILE_RE.test(path);
}

/** @param {string} path */
export function isDiscussionReviewsTotal(path) {
  return DISCUSSION_REVIEWS_TOTAL_RE.test(path);
}

/**
 * @param {string|number} beatmapsetId
 * @returns {string}  `/beatmapsets/{id}/discussion`
 */
export function discussionPath(beatmapsetId) {
  return `/beatmapsets/${beatmapsetId}/discussion`;
}

/**
 * The discussion page's Total filter, where "Beatmap discussion on Total tab"
 * sends discussion links.
 * @param {string|number} beatmapsetId
 * @returns {string}
 */
export function discussionTotalPath(beatmapsetId) {
  return `${discussionPath(beatmapsetId)}/-/generalAll/total`;
}
