/**
 * Profile section pages and contents (tab) anchors: DOM lookups and the
 * collapsed-state store shared by section collapse, subsection collapse and
 * contents reorder (WS-42).
 */

import { deleteKey, getJSON, setJSON } from "../../core/storage.js";

/** A profile section page (`me`, `top_ranks`, …). */
export const SECTION_PAGE_SEL = "div.js-sortable--page[data-page-id]";
/** A section page's title. */
export const SECTION_TITLE_SEL = "h2.title.title--page-extra";
/** A subsection title inside a section page. */
export const SUBSECTION_TITLE_SEL = "h3.title.title--page-extra-small";
/** In-page links; the contents tabs are the ones naming a section page. */
export const HASH_LINK_SEL = 'a[href^="#"]';

export function getSectionPageNodes() {
  return Array.from(document.querySelectorAll(SECTION_PAGE_SEL)).filter(
    (n) => n instanceof HTMLElement,
  );
}

export function sectionIdFromHashHref(href) {
  if (!href || href[0] !== "#") return "";
  const hash = href.slice(1).trim();
  return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
}

/**
 * The contents tab rows: links to section pages, grouped by parent, keeping
 * rows with at least `minTabs` tabs (drag and drop needs 3).
 * @param {number} [minTabs]
 * @returns {HTMLAnchorElement[][]}
 */
export function getContentsAnchorRows(minTabs = 1) {
  const validIds = new Set(
    getSectionPageNodes()
      .map((p) => p.getAttribute("data-page-id"))
      .filter((v) => typeof v === "string" && v.length > 0),
  );
  if (!validIds.size) return [];

  const containerMap = new Map();
  for (const a of document.querySelectorAll(HASH_LINK_SEL)) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    if (!validIds.has(sectionIdFromHashHref(a.getAttribute("href") || ""))) {
      continue;
    }
    const parent = a.parentElement;
    if (!parent) continue;
    const cur = containerMap.get(parent) || [];
    cur.push(a);
    containerMap.set(parent, cur);
  }
  return Array.from(containerMap.values()).filter(
    (anchors) => anchors.length >= minTabs,
  );
}

/**
 * Collapsed ids stored under `key`: a JSON object of `id: true` (an array
 * is accepted too).
 * @param {import("../../core/storage.js").StorageKey} key
 * @returns {Set<string>}
 */
export function readCollapsedSet(key) {
  const parsed = getJSON(key, null);
  if (Array.isArray(parsed)) {
    return new Set(parsed.filter((x) => typeof x === "string" && x));
  }
  if (parsed && typeof parsed === "object") {
    return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
  }
  return new Set();
}

/**
 * @param {import("../../core/storage.js").StorageKey} key
 * @param {Set<string>} set  an empty set deletes the key
 */
export function writeCollapsedSet(key, set) {
  const obj = /** @type {Record<string, true>} */ ({});
  set.forEach((id) => {
    if (id) obj[id] = true;
  });
  if (!Object.keys(obj).length) deleteKey(key);
  else setJSON(key, obj);
}
