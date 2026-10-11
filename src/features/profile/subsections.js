/**
 * Collapsible subsections (h3 titles) inside the profile section pages
 * (WS-42).
 */

import { listen } from "../../core/lifecycle.js";
import { observe } from "../../core/observe.js";
import { KEYS } from "../../core/storage.js";
import { el, manageStyle } from "../legacy.js";
import {
  SECTION_PAGE_SEL,
  SUBSECTION_TITLE_SEL,
  getSectionPageNodes,
  readCollapsedSet,
  writeCollapsedSet,
} from "./sections-dom.js";
import {
  RECENT_FAILS_HEADER_CLASS,
  RECENT_FAILS_WRAP_CLASS,
} from "./recent-scores/common.js";
/** Same as section collapse `SECTION_COLLAPSE_SUBTITLE_SELECTOR` (defined below). */
const PROFILE_PAGE_SUBTITLE_H3_SELECTOR = SUBSECTION_TITLE_SEL;
/** osu `ProfileExtraPage` ids (`data-page-id`) where we skip h3 subsection UI (single block, no sub-titles). */
const PROFILE_SUBSECTION_SKIP_PAGE_IDS = new Set(["medals"]);
const SUBSECTION_COLLAPSE_STYLE_ID =
  "osu-expertplus-profile-subsection-collapse";
const SUBSECTION_BODY_HIDDEN_CLASS =
  "oep-profile-subsection-body--collapsed-hidden";
const SUBSECTION_TITLE_CLASS = "oep-profile-subsection-title";
const SUBSECTION_TITLE_COLLAPSED_CLASS =
  "oep-profile-subsection-title--collapsed";
const SUBSECTION_TITLE_MAIN_CLASS = "oep-profile-subsection-title__main";
const SUBSECTION_TITLE_LABEL_CLASS = "oep-profile-subsection-title__label";
const SUBSECTION_DONE_ATTR = "data-oep-subsection-collapse";
const SUBSECTION_BODY_FOR_ATTR = "data-oep-subsection-for";
const SUBSECTION_TOGGLE_ATTR = "data-oep-profile-subsection-collapse-toggle";
const SUBSECTION_TOGGLE_FOR_ATTR = "data-oep-profile-subsection-for";
const SUBSECTION_LABEL_ATTR = "data-oep-subsection-label";
/** Collapsed dim: title label and `.title__count` pill. */
const SUBSECTION_COLLAPSED_DIM_OPACITY = "0.64";

const SUBSECTION_COLLAPSE_CSS = `
  .${SUBSECTION_BODY_HIDDEN_CLASS} {
    display: none !important;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35em;
    cursor: pointer;
    line-height: normal;
    padding: 10px 0;
    margin: 0;
    isolation: isolate;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::before {
    z-index: 0;
    transition: opacity 120ms ease;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS}.title.title--page-extra-small::before {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::after {
    content: "";
    position: absolute;
    top: 0;
    right: -8px;
    bottom: 0;
    left: -1.8rem;
    border-radius: 6px;
    background-color: transparent;
    transition: background-color 120ms ease;
    pointer-events: none;
    z-index: 1;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small:hover::after {
    background-color: rgba(255, 255, 255, 0.07);
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small > * {
    position: relative;
    z-index: 2;
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 10px;
    min-width: 0;
    flex: 1 1 auto;
    line-height: inherit;
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
    transition: opacity 120ms ease;
    line-height: inherit;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-sizing: border-box;
    margin: 0;
    padding: 0 10px;
    height: 1.85em;
    min-width: 1.85em;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
    transition: opacity 120ms ease;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  button.oep-profile-subsection-collapse-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  button.oep-profile-subsection-collapse-toggle:focus-visible {
    clip-path: none;
    width: auto;
    height: auto;
    margin: 0;
    padding: 2px 6px;
    overflow: visible;
    outline: 1px solid hsl(var(--hsl-l2));
    outline-offset: 1px;
    background: rgba(255, 255, 255, 0.08);
    color: hsl(var(--hsl-l1));
    font-size: 0.75rem;
    z-index: 1;
  }
`;

const subsectionCollapseStyle = manageStyle(
  SUBSECTION_COLLAPSE_STYLE_ID,
  SUBSECTION_COLLAPSE_CSS,
);

/**
 * Legacy subsection key, only used to migrate old collapse state. It must
 * reproduce keys written by older versions exactly, so keep the regex as is
 * (the doubled `'` was never `’`; B74).
 * @param {string} text
 * @param {Set<string>} usedSlugs
 * @returns {string}
 */
function subsectionSlugFromTitle(text, usedSlugs) {
  let base = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) base = "subsection";
  let slug = base;
  let n = 0;
  while (usedSlugs.has(slug)) {
    n += 1;
    slug = `${base}_${n}`;
  }
  usedSlugs.add(slug);
  return slug;
}

const SUBSECTION_SHOW_MORE_NAMED_MODIFIERS = new Set([
  "pinned",
  "best",
  "firsts",
  "recent",
]);
const SUBSECTION_SHOW_MORE_SKIP_MODIFIERS = new Set(["loading"]);

/**
 * osu-web PlayDetailList sets ShowMoreLink modifiers to pinned / best / firsts / recent
 * (language-independent BEM classes). Other pages use generic modifiers; those fall back to
 * index-based keys in the caller.
 * @param {HTMLElement} h3
 * @returns {string|null}
 */
function subsectionNamedModifierFromFollowingContent(h3) {
  let n = h3.nextElementSibling;
  while (n instanceof HTMLElement) {
    if (n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
    const roots = n.matches(".show-more-link")
      ? [n]
      : Array.from(n.querySelectorAll(".show-more-link"));
    for (const sm of roots) {
      for (const c of sm.classList) {
        if (!c.startsWith("show-more-link--")) continue;
        const mod = c.slice("show-more-link--".length);
        if (SUBSECTION_SHOW_MORE_SKIP_MODIFIERS.has(mod)) continue;
        if (SUBSECTION_SHOW_MORE_NAMED_MODIFIERS.has(mod)) return mod;
      }
    }
    n = n.nextElementSibling;
  }
  return null;
}

/**
 * @param {Set<string>} collapsedSet
 * @param {string} legacyKey
 * @param {string} stableKey
 * @returns {boolean} true if collapsedSet was mutated
 */
function migrateSubsectionCollapseLegacyKey(
  collapsedSet,
  legacyKey,
  stableKey,
) {
  if (!legacyKey || !stableKey || legacyKey === stableKey) return false;
  if (!collapsedSet.has(legacyKey)) return false;
  collapsedSet.add(stableKey);
  collapsedSet.delete(legacyKey);
  return true;
}

/**
 * @param {HTMLElement} h3
 * @returns {HTMLElement[]}
 */
function collectSubsectionBodyElements(h3) {
  const recentHeader = h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`);
  if (recentHeader instanceof HTMLElement && recentHeader.contains(h3)) {
    const bodies = [];
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement) {
      bodies.push(n);
      n = n.nextElementSibling;
    }
    let p = recentHeader.nextElementSibling;
    while (p instanceof HTMLElement) {
      if (p.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
      bodies.push(p);
      p = p.nextElementSibling;
    }
    return bodies;
  }

  const bodies = [];
  let n = h3.nextElementSibling;
  // Stop at the next title, also one inside a sibling (our Recent list's
  // header): that block is the next subsection (B85).
  while (
    n instanceof HTMLElement &&
    !n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR) &&
    !n.querySelector(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)
  ) {
    bodies.push(n);
    n = n.nextElementSibling;
  }
  return bodies;
}

/**
 * Wraps title text (and segments between counts) so collapsed opacity applies only to the name,
 * not the count pill. Keeps `.title__count` in an inline-flex row for vertical alignment.
 * @param {HTMLElement} h3
 * @param {HTMLElement} btn
 */
function wrapSubsectionTitleContent(h3, btn) {
  if (h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`)) return;
  if (!btn.nextSibling) return;
  const main = el("span", { class: SUBSECTION_TITLE_MAIN_CLASS });
  let n = btn.nextSibling;
  let label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
  while (n) {
    const next = n.nextSibling;
    if (n instanceof HTMLElement && n.classList.contains("title__count")) {
      if (label.childNodes.length) main.appendChild(label);
      main.appendChild(n);
      label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
    } else {
      label.appendChild(n);
    }
    n = next;
  }
  if (label.childNodes.length) main.appendChild(label);
  if (!main.childNodes.length) return;
  btn.insertAdjacentElement("afterend", main);
}

/**
 * Undo {@link wrapSubsectionTitleContent}: the label spans too, or the next
 * wrap would nest them.
 * @param {HTMLElement} h3
 */
function unwrapSubsectionTitleMain(h3) {
  const main = h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`);
  if (!(main instanceof HTMLElement)) return;
  for (const label of main.querySelectorAll(
    `.${SUBSECTION_TITLE_LABEL_CLASS}`,
  )) {
    label.replaceWith(...label.childNodes);
  }
  main.replaceWith(...main.childNodes);
}

/** @param {string} key */
function toggleProfileSubsectionCollapsedKey(key) {
  if (!key) return;
  const set = readCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  writeCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED, set);
  applyProfileSubsectionCollapseState(set);
}

/** @param {Set<string>} collapsed */
export function applyProfileSubsectionCollapseState(collapsed) {
  document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const key = el.getAttribute(SUBSECTION_BODY_FOR_ATTR);
    if (!key) return;
    if (collapsed.has(key)) el.classList.add(SUBSECTION_BODY_HIDDEN_CLASS);
    else el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
  });
  document
    .querySelectorAll(`button[${SUBSECTION_TOGGLE_ATTR}]`)
    .forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const key = btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR);
      if (!key) return;
      const isCollapsed = collapsed.has(key);
      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      const label = btn.getAttribute(SUBSECTION_LABEL_ATTR) || key;
      btn.title = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;
      btn.setAttribute(
        "aria-label",
        isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
      );
      const h3El = btn.closest("h3");
      if (h3El) {
        h3El.classList.toggle(SUBSECTION_TITLE_COLLAPSED_CLASS, isCollapsed);
      }
    });
}

function teardownProfileSubsectionCollapse() {
  document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
    el.removeAttribute(SUBSECTION_BODY_FOR_ATTR);
    el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
  });
  document.querySelectorAll(`h3[${SUBSECTION_DONE_ATTR}]`).forEach((h3) => {
    if (!(h3 instanceof HTMLElement)) return;
    unwrapSubsectionTitleMain(h3);
    h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`)?.remove();
    h3.removeAttribute(SUBSECTION_DONE_ATTR);
    h3.classList.remove(
      SUBSECTION_TITLE_CLASS,
      SUBSECTION_TITLE_COLLAPSED_CLASS,
    );
  });
}

/**
 * The storage key of a subsection, plus older keys to migrate from.
 * @param {string} pageId
 * @param {HTMLElement} h3
 * @param {{ index: number, legacySlugs: Set<string> }} pass  per-page counters
 * @returns {{ key: string, label: string, olderKeys: string[] }}
 */
function subsectionKeys(pageId, h3, pass) {
  const label = String(h3.textContent || "").trim() || pageId;
  const legacyKey = `${pageId}::${subsectionSlugFromTitle(label, pass.legacySlugs)}`;
  const namedMod = subsectionNamedModifierFromFollowingContent(h3);
  const key = namedMod
    ? `${pageId}::${namedMod}`
    : `${pageId}::sub_${pass.index}`;
  pass.index += 1;
  return { key, label, olderKeys: [legacyKey] };
}

/**
 * Add the toggle to a subsection title. Its key can change later (see
 * {@link syncPageSubsections}), so handlers read it from the button.
 * @param {HTMLElement} h3
 * @param {string} key
 * @param {string} label
 * @param {AbortSignal} signal
 */
function enhanceSubsectionTitle(h3, key, label, signal) {
  const btn = el("button", {
    type: "button",
    class: "oep-profile-subsection-collapse-toggle",
    [SUBSECTION_TOGGLE_ATTR]: "1",
    [SUBSECTION_TOGGLE_FOR_ATTR]: key,
    [SUBSECTION_LABEL_ATTR]: label,
  });
  const toggle = () =>
    toggleProfileSubsectionCollapsedKey(
      btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR) || "",
    );
  listen(
    btn,
    "click",
    (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      toggle();
    },
    signal,
  );
  listen(
    h3,
    "click",
    (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.closest(`button[${SUBSECTION_TOGGLE_ATTR}]`)) return;
      if (t.closest("a[href]")) return;
      toggle();
    },
    signal,
  );
  h3.insertBefore(btn, h3.firstChild);
  wrapSubsectionTitleContent(h3, btn);
  h3.classList.add(SUBSECTION_TITLE_CLASS);
  h3.setAttribute(SUBSECTION_DONE_ATTR, "1");
}

/**
 * Bring one section page's subsections up to date: new titles get a toggle,
 * existing ones keep theirs (re-keyed if their key changed), and every
 * title's body elements are tagged with its key. Older keys found in
 * `collapsedSet` are migrated in place.
 * @param {HTMLElement} pageEl  div.js-sortable--page
 * @param {Set<string>} collapsedSet
 * @param {AbortSignal} signal  the manager's listeners
 * @returns {boolean} true if collapsedSet was changed (caller persists it)
 */
function syncPageSubsections(pageEl, collapsedSet, signal) {
  const pageId = pageEl.getAttribute("data-page-id");
  if (!pageId) return false;
  if (PROFILE_SUBSECTION_SKIP_PAGE_IDS.has(pageId)) return false;
  const pass = { index: 0, legacySlugs: new Set() };
  let migrationDirty = false;
  for (const h3 of pageEl.querySelectorAll(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) {
    if (!(h3 instanceof HTMLElement)) continue;
    if (h3.closest(".js-sortable--page") !== pageEl) continue;

    const { key, label, olderKeys } = subsectionKeys(pageId, h3, pass);
    for (const older of olderKeys) {
      if (migrateSubsectionCollapseLegacyKey(collapsedSet, older, key)) {
        migrationDirty = true;
      }
    }

    const btn = h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`);
    if (!h3.hasAttribute(SUBSECTION_DONE_ATTR) || !btn) {
      enhanceSubsectionTitle(h3, key, label, signal);
    } else if (btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR) !== key) {
      btn.setAttribute(SUBSECTION_TOGGLE_FOR_ATTR, key);
    }

    for (const b of collectSubsectionBodyElements(h3)) {
      if (b.getAttribute(SUBSECTION_BODY_FOR_ATTR) !== key) {
        b.setAttribute(SUBSECTION_BODY_FOR_ATTR, key);
      }
    }
  }
  return migrationDirty;
}

/** @param {AbortSignal} signal */
function scanProfileSubsections(signal) {
  const collapsedSet = readCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED);
  let migrationDirty = false;
  getSectionPageNodes().forEach((page) => {
    if (syncPageSubsections(page, collapsedSet, signal)) {
      migrationDirty = true;
    }
  });
  if (migrationDirty) {
    writeCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED, collapsedSet);
  }
  applyProfileSubsectionCollapseState(collapsedSet);
}

/** @returns {function} */
export function startProfileSubsectionCollapseManager() {
  subsectionCollapseStyle.inject();
  const ac = new AbortController();

  scanProfileSubsections(ac.signal);
  // Titles and their bodies render lazily, per section page.
  observe.subscribe(
    {
      selector: `${SECTION_PAGE_SEL}, ${PROFILE_PAGE_SUBTITLE_H3_SELECTOR}, .${RECENT_FAILS_WRAP_CLASS}, .play-detail-list, .show-more-link`,
      schedule: 80,
      signal: ac.signal,
      label: "profile/subsections",
    },
    () => scanProfileSubsections(ac.signal),
  );

  return () => {
    ac.abort();
    teardownProfileSubsectionCollapse();
    subsectionCollapseStyle.remove();
  };
}
