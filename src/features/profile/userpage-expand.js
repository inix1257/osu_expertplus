/**
 * Expand a long me! userpage instead of scrolling inside it (WS-41).
 */

import { el, manageStyle } from "../legacy.js";
import { mutationsIncludeSelector } from "./mutations.js";
const USERPAGE_EXPAND_STYLE_ID = "osu-expertplus-userpage-expand";
const USERPAGE_EXPAND_DONE_ATTR = "data-oep-userpage-expand";
const USERPAGE_EXPAND_PAGE_CLASS = "oep-userpage--expanded";
const USERPAGE_EXPAND_BTN_CLASS = "oep-userpage-expand-btn";
const USERPAGE_ME_SECTION_SEL = 'div.js-sortable--page[data-page-id="me"]';
const USERPAGE_EXPAND_HOST_SELECTOR = ".page-extra--userpage";
const USERPAGE_OVERFLOW_OUTER_SEL =
  ".page-extra__content-overflow-wrapper-outer";
const USERPAGE_OVERFLOW_INNER_SEL =
  ".page-extra__content-overflow-wrapper-inner";

const userpageExpandStyle = manageStyle(
  USERPAGE_EXPAND_STYLE_ID,
  `
  .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
    .page-extra__content-overflow-wrapper-outer,
  .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
    .page-extra__content-overflow-wrapper-inner {
    max-height: none !important;
    overflow-y: visible !important;
  }
  .${USERPAGE_EXPAND_BTN_CLASS} {
    display: block;
    box-sizing: border-box;
    margin: 0;
    padding: 6px 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0 0 10px 10px;
    background: rgba(255, 255, 255, 0.05);
    color: hsl(var(--hsl-l1));
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    cursor: pointer;
    text-align: center;
    transition: background-color 120ms ease;
  }
  .${USERPAGE_EXPAND_BTN_CLASS}:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .${USERPAGE_EXPAND_BTN_CLASS}:focus-visible {
    outline: 2px solid hsl(var(--hsl-b1));
    outline-offset: -2px;
  }
`,
);

/**
 * @param {HTMLElement} pageExtra
 * @returns {HTMLElement | null}
 */
function findUserpageOverflowOuter(pageExtra) {
  for (const child of pageExtra.children) {
    if (
      child instanceof HTMLElement &&
      child.classList.contains("page-extra__content-overflow-wrapper-outer")
    ) {
      return child;
    }
  }
  const outer = pageExtra.querySelector(USERPAGE_OVERFLOW_OUTER_SEL);
  return outer instanceof HTMLElement ? outer : null;
}

/**
 * @param {HTMLElement} outer
 * @param {HTMLElement} inner
 * @returns {boolean}
 */
function userpageContentOverflows(outer, inner) {
  const outerClips = outer.scrollHeight > outer.clientHeight + 2;
  const innerClips = inner.scrollHeight > inner.clientHeight + 2;
  const innerTallerThanOuter =
    inner.getBoundingClientRect().height >
    outer.getBoundingClientRect().height + 2;
  return outerClips || innerClips || innerTallerThanOuter;
}

/**
 * @returns {{ section: HTMLElement, pageExtra: HTMLElement } | null}
 */
function findMeUserpageContext() {
  const section = document.querySelector(USERPAGE_ME_SECTION_SEL);
  if (!(section instanceof HTMLElement)) return null;
  const pageExtra = section.querySelector(USERPAGE_EXPAND_HOST_SELECTOR);
  if (!(pageExtra instanceof HTMLElement)) return null;
  if (!section.contains(pageExtra)) return null;
  return { section, pageExtra };
}

/**
 * @param {HTMLElement} pageExtra
 * @returns {null | (() => void)}
 */
function bindUserpageExpand(pageExtra) {
  const outer = findUserpageOverflowOuter(pageExtra);
  if (!(outer instanceof HTMLElement)) return null;
  const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
  if (!(inner instanceof HTMLElement)) return null;
  if (!userpageContentOverflows(outer, inner)) return null;

  pageExtra.setAttribute(USERPAGE_EXPAND_DONE_ATTR, "1");

  const cs = getComputedStyle(pageExtra);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;

  const btn = el("button", {
    type: "button",
    class: USERPAGE_EXPAND_BTN_CLASS,
    "aria-expanded": "false",
  });
  btn.style.width = `calc(100% + ${pl + pr}px)`;
  btn.style.marginLeft = `-${pl}px`;

  const syncBtn = () => {
    const expanded = pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS);
    btn.textContent = expanded ? "Collapse userpage" : "Expand userpage";
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  };

  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    pageExtra.classList.toggle(USERPAGE_EXPAND_PAGE_CLASS);
    syncBtn();
  });

  pageExtra.appendChild(btn);
  syncBtn();

  return () => {
    btn.remove();
    pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
    pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
  };
}

function teardownUserpageExpand() {
  document
    .querySelectorAll(`.${USERPAGE_EXPAND_BTN_CLASS}`)
    .forEach((n) => n.remove());
  document.querySelectorAll(USERPAGE_EXPAND_HOST_SELECTOR).forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    host.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
    host.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
  });
}

/** @param {MutationRecord[]} mutations */
function mutationsAffectMeUserpage(mutations) {
  return mutationsIncludeSelector(mutations, USERPAGE_ME_SECTION_SEL);
}

/** Expand/collapse the profile Me tab userpage past osu!'s 400px cap. */
export function startUserpageExpandManager() {
  userpageExpandStyle.inject();

  let disposeMe = /** @type {null | (() => void)} */ (null);

  // Spoilers toggle by class and images load late, so neither adds nodes; watch size instead.
  /** @type {ResizeObserver | null} */
  let resizeObs = null;
  /** @type {Element | null} */
  let observedInner = null;

  /** @param {HTMLElement} outer */
  const observeUserpageContent = (outer) => {
    if (typeof ResizeObserver === "undefined") return;
    const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
    if (!(inner instanceof HTMLElement) || inner === observedInner) return;
    resizeObs?.disconnect();
    observedInner = inner;
    resizeObs = new ResizeObserver(() => scan());
    resizeObs.observe(inner);
    for (const child of inner.children) resizeObs.observe(child);
  };

  const scan = () => {
    try {
      const ctx = findMeUserpageContext();
      if (!ctx) {
        disposeMe?.();
        disposeMe = null;
        return;
      }

      const { pageExtra } = ctx;
      const outer = findUserpageOverflowOuter(pageExtra);
      const btn = pageExtra.querySelector(`.${USERPAGE_EXPAND_BTN_CLASS}`);

      if (!outer) {
        disposeMe?.();
        disposeMe = null;
        btn?.remove();
        pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
        pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
        return;
      }

      observeUserpageContent(outer);

      if (pageExtra.hasAttribute(USERPAGE_EXPAND_DONE_ATTR) && btn) {
        const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
        const stillNeeded =
          pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS) ||
          !(inner instanceof HTMLElement) ||
          userpageContentOverflows(outer, inner);
        if (stillNeeded) return;
        // Content shrank back under the cap (e.g. spoiler closed): drop the button.
        disposeMe?.();
        disposeMe = null;
        btn.remove();
        pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
      }

      disposeMe?.();
      disposeMe = bindUserpageExpand(pageExtra);
    } catch (_) {
      disposeMe?.();
      disposeMe = null;
    }
  };

  /** @type {Element} */
  let observeRoot = document.documentElement;
  /** @type {MutationObserver} */
  let obs;

  const syncObserveRoot = () => {
    const next = findMeUserpageContext()?.section ?? document.documentElement;
    if (next === observeRoot) return;
    obs.disconnect();
    observeRoot = next;
    obs.observe(observeRoot, { childList: true, subtree: true });
  };

  obs = new MutationObserver((mutations) => {
    if (
      observeRoot !== document.documentElement ||
      mutationsAffectMeUserpage(mutations)
    ) {
      scan();
      syncObserveRoot();
    }
  });

  scan();
  syncObserveRoot();
  obs.observe(observeRoot, { childList: true, subtree: true });

  return () => {
    obs.disconnect();
    resizeObs?.disconnect();
    resizeObs = null;
    observedInner = null;
    disposeMe?.();
    disposeMe = null;
    teardownUserpageExpand();
    userpageExpandStyle.remove();
  };
}
