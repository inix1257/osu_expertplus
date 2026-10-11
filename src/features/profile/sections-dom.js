/**
 * Profile section pages and contents (tab) anchors: DOM lookups shared by
 * section collapse and contents reorder (WS-42).
 */
export function getSectionPageNodes() {
  return Array.from(
    document.querySelectorAll("div.js-sortable--page[data-page-id]"),
  ).filter((n) => n instanceof HTMLElement);
}

export function sectionIdFromHashHref(href) {
  if (!href || href[0] !== "#") return "";
  const hash = href.slice(1).trim();
  return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
}

export function getSortableContentsAnchorGroups() {
  const pages = getSectionPageNodes();
  if (!pages.length) return [];

  const validIds = new Set(
    pages
      .map((p) => p.getAttribute("data-page-id"))
      .filter((v) => typeof v === "string" && v.length > 0),
  );
  if (!validIds.size) return [];

  const allCandidates = Array.from(
    document.querySelectorAll('a[href^="#"]'),
  ).filter(
    (a) =>
      a instanceof HTMLAnchorElement &&
      validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
  );
  if (allCandidates.length < 3) return [];

  const containerMap = new Map();
  allCandidates.forEach((a) => {
    const parent = a.parentElement;
    if (!parent) return;
    const cur = containerMap.get(parent) || [];
    cur.push(a);
    containerMap.set(parent, cur);
  });

  return Array.from(containerMap.values()).filter(
    (anchors) => anchors.length >= 3,
  );
}

/** All hash-tab rows (incl. 1–2 tabs); {@link getSortableContentsAnchorGroups} needs ≥3 for DnD. */
export function getProfileContentsAnchorRows() {
  const pages = getSectionPageNodes();
  if (!pages.length) return [];
  const validIds = new Set(
    pages
      .map((p) => p.getAttribute("data-page-id"))
      .filter((v) => typeof v === "string" && v.length > 0),
  );
  if (!validIds.size) return [];

  const allCandidates = Array.from(
    document.querySelectorAll('a[href^="#"]'),
  ).filter(
    (a) =>
      a instanceof HTMLAnchorElement &&
      validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
  );
  if (!allCandidates.length) return [];

  const containerMap = new Map();
  allCandidates.forEach((a) => {
    const parent = a.parentElement;
    if (!parent) return;
    const cur = containerMap.get(parent) || [];
    cur.push(a);
    containerMap.set(parent, cur);
  });
  return Array.from(containerMap.values()).filter(
    (anchors) => anchors.length > 0,
  );
}
