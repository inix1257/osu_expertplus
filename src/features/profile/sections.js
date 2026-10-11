/**
 * Collapsible profile sections: page titles and contents tab chevrons
 * (WS-42).
 */

import { el, manageStyle, settings } from "../legacy.js";
import {
  getProfileContentsAnchorRows,
  getSectionPageNodes,
  sectionIdFromHashHref,
} from "./sections-dom.js";
import {
  applyProfileSubsectionCollapseState,
  readProfileSubsectionsCollapsedSet,
} from "./subsections.js";
import { mutationsIncludeSelector } from "./mutations.js";
import { PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID } from "./score-rows.js";
const PROFILE_SECTIONS_COLLAPSED_GM_KEY =
  "userProfile.profileSectionsCollapsed";
const SECTION_COLLAPSE_PAGE_CLASS = "oep-profile-section--collapsed";
const SECTION_COLLAPSE_BODY_HIDDEN_CLASS =
  "oep-profile-section-body--collapsed-hidden";
const SECTION_COLLAPSE_MAIN_TITLE_SELECTOR = "h2.title.title--page-extra";
const SECTION_COLLAPSE_SUBTITLE_SELECTOR = "h3.title.title--page-extra-small";
const SECTION_TAB_COLLAPSED_CLASS = "oep-profile-section-tab--collapsed";
const SECTION_PAGE_TITLE_CLICK_ATTR =
  "data-oep-profile-section-page-title-click";
const SECTION_TAB_CHEVRON_ATTR = "data-oep-section-tab-chevron";
const SECTION_CONTENTS_ROW_CLASS = "oep-profile-contents-row";
const SECTION_PAGE_TITLE_TOGGLE_CLASS =
  "oep-profile-section-page-title--toggle";
const SECTION_PAGE_TITLE_LABEL_CLASS = "oep-profile-section-page-title__label";
const SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS =
  "oep-profile-section-page-title__collapsed-suffix";
const SECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-section-collapse";
const SECTION_COLLAPSE_HARD_MODE_CLASS = "oep-profile-section-collapse--hard";

const SECTION_COLLAPSE_CSS = `
  .${SECTION_COLLAPSE_BODY_HIDDEN_CLASS} {
    display: none !important;
  }
  html.${SECTION_COLLAPSE_HARD_MODE_CLASS}
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
    > div.u-relative
    > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small) {
    display: none !important;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra {
    cursor: pointer;
    user-select: none;
    position: relative;
    isolation: isolate;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra > .${SECTION_PAGE_TITLE_LABEL_CLASS} {
    position: relative;
    z-index: 2;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::after {
    content: "";
    position: absolute;
    top: -0.25em;
    right: -0.55em;
    bottom: -0.25em;
    left: -1.5em;
    border-radius: 6px;
    background-color: transparent;
    transition: background-color 120ms ease;
    pointer-events: none;
    z-index: 1;
  }
  div.js-sortable--page
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra:hover::after {
    background-color: rgba(255, 255, 255, 0.07);
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra
    > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS} {
    position: relative;
    z-index: 2;
    font-weight: 600;
    font-size: 0.88em;
    opacity: 0.9;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::before {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    content: "\\f077";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translate(calc(-100% - 0.7em), -50%);
    font-size: 0.65em;
    line-height: 1;
    color: hsl(var(--hsl-c1));
    opacity: 0.9;
    pointer-events: none;
    transition: opacity 120ms ease;
    z-index: 2;
  }
  div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
    h2.title.title--page-extra.${SECTION_PAGE_TITLE_TOGGLE_CLASS}::before {
    content: "\\f078";
    opacity: 0.8;
  }
  a.${SECTION_TAB_COLLAPSED_CLASS} .page-mode-link,
  a.${SECTION_TAB_COLLAPSED_CLASS} .fake-bold {
    color: hsl(var(--hsl-l2)) !important;
    opacity: 0.78;
  }
  a.${SECTION_TAB_COLLAPSED_CLASS}:not(:has(.page-mode-link)):not(:has(.fake-bold)) {
    color: hsl(var(--hsl-l2)) !important;
    opacity: 0.78;
  }
  .page-mode.page-mode--profile-page-extra {
    gap: 0 !important;
    column-gap: 0 !important;
    row-gap: 0 !important;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"] {
    margin-right: 0.85em !important;
    padding: 0.22em 0.5em;
    border-radius: 5px;
    box-sizing: border-box;
    transition: background-color 120ms ease;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:hover {
    background-color: rgba(255, 255, 255, 0.07);
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:last-child {
    margin-right: 0 !important;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]::before {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    content: "\\f077";
    font-size: 0.82em;
    line-height: 1;
    color: hsl(var(--hsl-c1));
    opacity: 0.9;
    margin-right: 0.25em;
    flex-shrink: 0;
    transition: color 120ms ease, opacity 120ms ease;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]:hover::before {
    opacity: 1;
    color: hsl(var(--hsl-l1));
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]::before {
    content: "\\f078";
    opacity: 0.8;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]:hover::before {
    opacity: 1;
    color: hsl(var(--hsl-l1));
  }
`;

const sectionCollapseStyle = manageStyle(
  SECTION_COLLAPSE_STYLE_ID,
  SECTION_COLLAPSE_CSS,
);

/** @returns {Set<string>} */
function readProfileSectionsCollapsedSet() {
  try {
    const raw = GM_getValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, "");
    if (raw == null || raw === "") return new Set();
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === "string" && x));
    }
    if (parsed && typeof parsed === "object") {
      return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
    }
  } catch (_) {}
  return new Set();
}

/** @param {Set<string>} set */
function writeProfileSectionsCollapsedSet(set) {
  const obj = /** @type {Record<string, true>} */ ({});
  set.forEach((id) => {
    if (id) obj[id] = true;
  });
  if (!Object.keys(obj).length) {
    GM_deleteValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY);
    return;
  }
  GM_setValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
}

function clearProfileSectionCollapseBodyHidden(page) {
  page
    .querySelectorAll(`.${SECTION_COLLAPSE_BODY_HIDDEN_CLASS}`)
    .forEach((el) => el.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS));
  page.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
}

/**
 * Direct children of a sortable section that should stay visible when collapsed
 * (main h2 row with optional drag handle, or inline sub-headings).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function profileSectionCollapseKeepsChildVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.matches(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR)) return true;
  if (el.matches(SECTION_COLLAPSE_SUBTITLE_SELECTOR)) return true;
  if (
    el.matches("div.u-relative") &&
    el.querySelector(`:scope > ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}`)
  ) {
    return true;
  }
  return false;
}

/**
 * "(collapsed)" is a real node so `h2::after` stays the hover overlay (same as expanded).
 * @param {HTMLElement} pageEl
 * @param {boolean} isCollapsed
 */
function syncProfileSectionPageTitleCollapsedSuffix(pageEl, isCollapsed) {
  const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
  if (!(h2 instanceof HTMLElement)) return;
  if (!h2.classList.contains(SECTION_PAGE_TITLE_TOGGLE_CLASS)) return;
  const existing = h2.querySelector(
    `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
  );
  if (isCollapsed) {
    if (!existing) {
      h2.appendChild(
        el(
          "span",
          { class: SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS },
          " (collapsed)",
        ),
      );
    } else {
      existing.textContent = " (collapsed)";
    }
  } else {
    existing?.remove();
  }
}

/**
 * Hide non-heading children so in-page section titles stay visible.
 * Follows single-child wrappers briefly (some layouts nest one div).
 * @param {HTMLElement} pageEl
 * @param {number} depth
 * @returns {boolean} true when headings were found and body nodes hidden
 */
function markProfileSectionBodyCollapsed(pageEl, depth) {
  if (depth > 4) return false;
  const kids = [...pageEl.children].filter((n) => n instanceof HTMLElement);
  if (!kids.length) return false;
  const hasKept = kids.some(profileSectionCollapseKeepsChildVisible);
  if (hasKept) {
    kids.forEach((k) => {
      if (profileSectionCollapseKeepsChildVisible(k)) {
        k.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      } else {
        k.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      }
    });
    return true;
  }
  if (kids.length === 1) {
    return markProfileSectionBodyCollapsed(kids[0], depth + 1);
  }
  return false;
}

function applyProfileSectionCollapseToPages(collapsed) {
  const removeEntireSection = settings().isEnabled(
    PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
  );
  document.documentElement.classList.toggle(
    SECTION_COLLAPSE_HARD_MODE_CLASS,
    removeEntireSection,
  );
  getSectionPageNodes().forEach((node) => {
    const id = node.getAttribute("data-page-id");
    if (!id) return;
    clearProfileSectionCollapseBodyHidden(node);
    node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);

    if (!collapsed.has(id)) {
      syncProfileSectionPageTitleCollapsedSuffix(node, false);
      return;
    }

    node.classList.add(SECTION_COLLAPSE_PAGE_CLASS);
    if (removeEntireSection) {
      node.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
    } else {
      markProfileSectionBodyCollapsed(node, 0);
    }
    syncProfileSectionPageTitleCollapsedSuffix(node, true);
  });
  applyProfileSubsectionCollapseState(readProfileSubsectionsCollapsedSet());
}

function applyProfileSectionCollapseToTabAnchors(collapsed) {
  getProfileContentsAnchorRows()
    .flat()
    .forEach((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const sectionId = sectionIdFromHashHref(
        anchor.getAttribute("href") || "",
      );
      if (!sectionId) return;
      const isCollapsed = collapsed.has(sectionId);
      if (isCollapsed) anchor.classList.add(SECTION_TAB_COLLAPSED_CLASS);
      else anchor.classList.remove(SECTION_TAB_COLLAPSED_CLASS);

      anchor.setAttribute(
        SECTION_TAB_CHEVRON_ATTR,
        isCollapsed ? "collapsed" : "expanded",
      );
      const parent = anchor.parentElement;
      if (parent) parent.classList.add(SECTION_CONTENTS_ROW_CLASS);
    });
}

function teardownProfileSectionPageTitleClick() {
  document
    .querySelectorAll(`h2[${SECTION_PAGE_TITLE_CLICK_ATTR}]`)
    .forEach((h2) => {
      if (!(h2 instanceof HTMLElement)) return;
      const wrap =
        /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */ (
          h2
        );
      wrap._oepSectionPageTitleAc?.abort();
      delete wrap._oepSectionPageTitleAc;
      h2.querySelectorAll(
        `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
      ).forEach((n) => n.remove());
      const label = h2.querySelector(
        `:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`,
      );
      if (label instanceof HTMLElement) {
        while (label.firstChild) h2.insertBefore(label.firstChild, label);
        label.remove();
      }
      h2.removeAttribute(SECTION_PAGE_TITLE_CLICK_ATTR);
      h2.classList.remove(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    });
}

function teardownProfileContentsTabChevrons() {
  document
    .querySelectorAll(`a[${SECTION_TAB_CHEVRON_ATTR}]`)
    .forEach((a) => a.removeAttribute(SECTION_TAB_CHEVRON_ATTR));
  document
    .querySelectorAll(`.${SECTION_CONTENTS_ROW_CLASS}`)
    .forEach((n) => n.classList.remove(SECTION_CONTENTS_ROW_CLASS));
}

/**
 * Delegated click handler: if the click lands on the ::before chevron area of
 * a contents-row tab anchor, toggle section collapse instead of navigating.
 * @param {MouseEvent} ev
 */
function onContentsTabChevronClick(ev) {
  const a = /** @type {Element|null} */ (ev.target);
  if (!(a instanceof HTMLAnchorElement)) return;
  if (!a.hasAttribute(SECTION_TAB_CHEVRON_ATTR)) return;
  const rect = a.getBoundingClientRect();
  const style = window.getComputedStyle(a, "::before");
  const beforeWidth = parseFloat(style.width) || 0;
  const paddingLeft = parseFloat(window.getComputedStyle(a).paddingLeft) || 0;
  const chevronRight = rect.left + paddingLeft + beforeWidth + 4;
  if (ev.clientX > chevronRight) return;
  ev.preventDefault();
  ev.stopPropagation();
  const sectionId = sectionIdFromHashHref(a.getAttribute("href") || "");
  if (sectionId) toggleProfileSectionCollapsedId(sectionId);
}

/**
 * Toggle section collapse from the in-page `h2` or from the contents-row chevron (tab label still navigates).
 * @param {string} sectionId  data-page-id
 */
function toggleProfileSectionCollapsedId(sectionId) {
  if (!sectionId) return;
  const set = readProfileSectionsCollapsedSet();
  if (set.has(sectionId)) set.delete(sectionId);
  else set.add(sectionId);
  writeProfileSectionsCollapsedSet(set);
  applyProfileSectionCollapseToPages(set);
  applyProfileSectionCollapseToTabAnchors(set);
}

/** @param {HTMLElement} pageEl  div.js-sortable--page[data-page-id] */
function bindProfileSectionPageTitleClickOnPage(pageEl) {
  const sectionId = pageEl.getAttribute("data-page-id");
  if (!sectionId) return;
  const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
  if (!(h2 instanceof HTMLElement)) return;
  if (h2.hasAttribute(SECTION_PAGE_TITLE_CLICK_ATTR)) return;

  h2.classList.add(SECTION_PAGE_TITLE_TOGGLE_CLASS);
  h2.setAttribute(SECTION_PAGE_TITLE_CLICK_ATTR, sectionId);

  if (!h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`)) {
    const label = el("span", { class: SECTION_PAGE_TITLE_LABEL_CLASS });
    while (h2.firstChild) label.appendChild(h2.firstChild);
    h2.appendChild(label);
  }

  const ac = new AbortController();
  /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */
  (h2)._oepSectionPageTitleAc = ac;
  h2.addEventListener(
    "click",
    (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest("a[href]")) return;
      if (t.closest("button")) return;
      if (t.closest("input, select, textarea, label")) return;
      toggleProfileSectionCollapsedId(sectionId);
    },
    { signal: ac.signal },
  );
}

function bindProfileSectionPageTitleClicks() {
  getSectionPageNodes().forEach((page) => {
    if (page instanceof HTMLElement)
      bindProfileSectionPageTitleClickOnPage(page);
  });
}

/** @returns {function} */
export function startProfileSectionCollapseManager() {
  sectionCollapseStyle.inject();

  let rebindTimer = 0;
  let obs = null;
  const unsubRemoveMode = settings().onChange(
    PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
    () => {
      const collapsed = readProfileSectionsCollapsedSet();
      applyProfileSectionCollapseToPages(collapsed);
    },
  );

  const bind = () => {
    clearTimeout(rebindTimer);
    teardownProfileSectionPageTitleClick();
    teardownProfileContentsTabChevrons();

    const collapsed = readProfileSectionsCollapsedSet();
    applyProfileSectionCollapseToPages(collapsed);
    applyProfileSectionCollapseToTabAnchors(collapsed);

    bindProfileSectionPageTitleClicks();

    getSectionPageNodes().forEach((node) => {
      const id = node.getAttribute("data-page-id");
      if (!id) return;
      syncProfileSectionPageTitleCollapsedSuffix(node, collapsed.has(id));
    });
  };

  bind();
  document.addEventListener("click", onContentsTabChevronClick, true);
  obs = new MutationObserver((mutations) => {
    const needsRebind = mutationsIncludeSelector(
      mutations,
      'div.js-sortable--page[data-page-id], a[href^="#"], h2.title.title--page-extra',
    );

    if (needsRebind) {
      clearTimeout(rebindTimer);
      rebindTimer = setTimeout(bind, 80);
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    unsubRemoveMode();
    clearTimeout(rebindTimer);
    obs?.disconnect();
    document.removeEventListener("click", onContentsTabChevronClick, true);
    teardownProfileSectionPageTitleClick();
    teardownProfileContentsTabChevrons();
    getSectionPageNodes().forEach((node) => {
      node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
      clearProfileSectionCollapseBodyHidden(node);
    });
    document
      .querySelectorAll(`a.${SECTION_TAB_COLLAPSED_CLASS}`)
      .forEach((a) => a.classList.remove(SECTION_TAB_COLLAPSED_CLASS));
    document.documentElement.classList.remove(SECTION_COLLAPSE_HARD_MODE_CLASS);
    sectionCollapseStyle.remove();
  };
}
