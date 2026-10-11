/**
 * Drag to reorder the profile contents tabs and section pages on the
 * viewer's own profile; the order is saved to the account (WS-42).
 */

import { observe } from "../../core/observe.js";
import { manageStyle } from "../legacy.js";
import {
  HASH_LINK_SEL,
  SECTION_PAGE_SEL,
  getContentsAnchorRows,
  getSectionPageNodes,
  sectionIdFromHashHref,
} from "./sections-dom.js";
const CONTENTS_REORDER_STYLE_ID = "osu-expertplus-profile-contents-reorder";
const CONTENTS_REORDER_ANCHOR_ATTR = "data-oep-contents-reorder-anchor";
const CONTENTS_REORDER_DRAGGING_CLASS = "oep-contents-reorder--dragging";
const CONTENTS_REORDER_DROP_BEFORE_CLASS = "oep-contents-reorder--drop-before";
const CONTENTS_REORDER_DROP_AFTER_CLASS = "oep-contents-reorder--drop-after";
const CONTENTS_REORDER_GHOST_CLASS = "oep-contents-reorder--ghost";
const CONTENTS_REORDER_DRAG_THRESHOLD_PX = 12;

const CONTENTS_REORDER_CSS = `
  a[${CONTENTS_REORDER_ANCHOR_ATTR}] {
    cursor: grab;
    user-select: none;
    display: inline-flex;
    align-items: center;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DRAGGING_CLASS} {
    opacity: 0 !important;
    cursor: grabbing;
    pointer-events: none;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_BEFORE_CLASS} {
    box-shadow: -3px 0 0 0 hsl(var(--hsl-c1));
    border-radius: 0 5px 5px 0;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_AFTER_CLASS} {
    box-shadow: 3px 0 0 0 hsl(var(--hsl-c1));
    border-radius: 5px 0 0 5px;
  }
  .${CONTENTS_REORDER_GHOST_CLASS} {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    padding: 0.22em 0.5em;
    border-radius: 5px;
    background-color: rgba(255, 255, 255, 0.14);
    color: hsl(var(--hsl-l1));
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
    user-select: none;
    transform: translate(10px, -50%);
    font-size: 0.875em;
    opacity: 0.95;
  }
`;

const CONTENTS_REORDER_ERROR_CLASS = "oep-contents-reorder-error";
const CONTENTS_REORDER_ERROR_CSS = `
  .${CONTENTS_REORDER_ERROR_CLASS} {
    margin: 0.35rem 0;
    font-size: 12px;
    color: hsl(var(--hsl-red-1, 0 70% 70%));
  }
`;

const contentsReorderStyle = manageStyle(
  CONTENTS_REORDER_STYLE_ID,
  CONTENTS_REORDER_CSS + CONTENTS_REORDER_ERROR_CSS,
);

function injectContentsReorderStyles() {
  contentsReorderStyle.inject();
}

function removeContentsReorderStyles() {
  contentsReorderStyle.remove();
}

/**
 * PUT the section order to the account (the request osu-web's own drag and
 * drop sends), through the site request queue.
 * @param {string[]} sectionIds
 */
async function persistProfileSectionOrder(sectionIds) {
  const payload = new URLSearchParams();
  sectionIds.forEach((id) =>
    payload.append("user_profile_customization[extras_order][]", id),
  );
  await OsuExpertPlus.api.siteWrite("PUT", "/home/account/options", payload);
}

/**
 * Saves orders one request at a time (B48). An order requested while one is
 * being saved replaces any order still waiting, so quick drops send only the
 * last one. When the last attempt fails, `onFailed` gets the error and the
 * last order the server accepted (`initial` until one is).
 * @param {{
 *   save: (ids: string[]) => Promise<unknown>,
 *   initial: string[],
 *   onFailed: (err: unknown, confirmed: string[]) => void,
 * }} deps
 */
export function createOrderSaver({ save, initial, onFailed }) {
  let confirmed = initial;
  /** @type {string[]|null} */
  let pending = null;
  let running = false;

  async function pump() {
    running = true;
    while (pending) {
      const ids = pending;
      pending = null;
      try {
        await save(ids);
        confirmed = ids;
      } catch (err) {
        if (!pending) onFailed(err, confirmed);
      }
    }
    running = false;
  }

  return {
    /** @param {string[]} ids */
    request(ids) {
      if (!Array.isArray(ids) || ids.length < 2) return;
      pending = ids;
      if (!running) void pump();
    },
  };
}

function reorderSectionPagesByIds(sectionIds) {
  if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
  const pages = getSectionPageNodes();
  if (!pages.length) return;
  const byId = new Map();
  pages.forEach((p) => {
    byId.set(p.getAttribute("data-page-id"), p);
  });
  const parent = pages[0]?.parentElement;
  if (!parent) return;

  sectionIds.forEach((id) => {
    const node = byId.get(id);
    if (node) parent.appendChild(node);
  });
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLAnchorElement} source
 * @returns {HTMLAnchorElement|null}
 */
function contentsReorderTargetFromPoint(clientX, clientY, source) {
  const row = source.parentElement;
  if (!row) return null;
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const n of stack) {
    if (!(n instanceof Element)) continue;
    const a = n.closest(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`);
    if (
      a instanceof HTMLAnchorElement &&
      a !== source &&
      a.parentElement === row
    )
      return a;
  }
  return null;
}

/** @returns {function} */
export function startContentsReorderManager() {
  injectContentsReorderStyles();
  const ac = new AbortController();

  let dragAnchor = null;
  let ghostEl = /** @type {HTMLElement|null} */ (null);
  /** Section IDs in current visual order; null means DOM order is authoritative. */
  let currentTabOrder = /** @type {string[]|null} */ (null);
  /**
   * @type {{
   *   anchor: HTMLAnchorElement;
   *   pointerId: number;
   *   startX: number;
   *   startY: number;
   *   armed: boolean;
   *   onMove: (e: PointerEvent) => void;
   *   onUp: (e: PointerEvent) => void;
   * } | null}
   */
  let pointerSession = null;

  /**
   * Returns anchors in their current visual order.
   * Uses `currentTabOrder` when set, otherwise falls back to DOM order.
   * @param {HTMLElement} row
   * @returns {HTMLAnchorElement[]}
   */
  function getOrderedAnchors(row) {
    const anchors = /** @type {HTMLAnchorElement[]} */ (
      Array.from(
        row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`),
      ).filter((a) => a instanceof HTMLAnchorElement)
    );
    if (!currentTabOrder) return anchors;
    const byId = new Map(
      anchors.map((a) => [
        sectionIdFromHashHref(a.getAttribute("href") || ""),
        a,
      ]),
    );
    const ordered = /** @type {HTMLAnchorElement[]} */ (
      currentTabOrder.map((id) => byId.get(id)).filter(Boolean)
    );
    const inOrder = new Set(currentTabOrder);
    anchors.forEach((a) => {
      const id = sectionIdFromHashHref(a.getAttribute("href") || "");
      if (id && !inOrder.has(id)) ordered.push(a);
    });
    return ordered;
  }

  /**
   * Applies CSS flexbox `order` to visually reorder tabs without touching React-managed DOM nodes.
   * Each chevron button gets an even order value; its anchor gets odd (chevron always visually first).
   * @param {HTMLAnchorElement[]} anchors ordered array representing desired visual sequence
   * @param {HTMLElement} row
   */
  function applyTabCssOrder(anchors) {
    anchors.forEach((a, i) => {
      a.style.order = String(i);
    });
  }

  const removeGhost = () => {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  };

  const clearDragClasses = () => {
    if (ghostEl) removeGhost();
    document
      .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
      .forEach((n) =>
        n.classList.remove(
          CONTENTS_REORDER_DRAGGING_CLASS,
          CONTENTS_REORDER_DROP_BEFORE_CLASS,
          CONTENTS_REORDER_DROP_AFTER_CLASS,
        ),
      );
  };

  /** Put tabs and section pages back in `ids` order (a failed save). */
  const restoreOrder = (ids) => {
    currentTabOrder = ids;
    getContentsAnchorRows(3).forEach((anchors) => {
      const row = anchors[0]?.parentElement;
      if (row instanceof HTMLElement) applyTabCssOrder(getOrderedAnchors(row));
    });
    reorderSectionPagesByIds(ids);
  };

  /** @param {unknown} err */
  const showSaveError = (err) => {
    const row = getContentsAnchorRows(3)[0]?.[0]?.parentElement;
    if (!(row instanceof HTMLElement)) return;
    row.parentElement
      ?.querySelector(`:scope > .${CONTENTS_REORDER_ERROR_CLASS}`)
      ?.remove();
    const status = /** @type {{ status?: number }} */ (err)?.status;
    const notice = document.createElement("div");
    notice.className = CONTENTS_REORDER_ERROR_CLASS;
    notice.setAttribute("role", "alert");
    notice.textContent = `Could not save the section order${
      status ? ` (${status})` : ""
    }; the previous order is back.`;
    row.insertAdjacentElement("afterend", notice);
    window.setTimeout(() => notice.remove(), 8000);
  };

  const saver = createOrderSaver({
    save: persistProfileSectionOrder,
    initial: getSectionPageNodes()
      .map((p) => p.getAttribute("data-page-id") || "")
      .filter(Boolean),
    onFailed: (err, confirmed) => {
      if (ac.signal.aborted) return;
      restoreOrder(confirmed);
      showSaveError(err);
    },
  });

  const saveOrderFrom = (anchors) => {
    const ids = anchors
      .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
      .filter(Boolean);
    reorderSectionPagesByIds(ids);
    saver.request(ids);
  };

  function clearRowDropIndicators(row) {
    row
      .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
      .forEach((n) =>
        n.classList.remove(
          CONTENTS_REORDER_DROP_BEFORE_CLASS,
          CONTENTS_REORDER_DROP_AFTER_CLASS,
        ),
      );
  }

  function endPointerSession() {
    const s = pointerSession;
    pointerSession = null;
    if (!s) return;
    removeGhost();
    s.anchor.removeEventListener("pointermove", s.onMove);
    s.anchor.removeEventListener("pointerup", s.onUp);
    s.anchor.removeEventListener("pointercancel", s.onUp);
    try {
      s.anchor.releasePointerCapture(s.pointerId);
    } catch (_) {}
  }

  const onPointerDown = (ev) => {
    const anchor = ev.currentTarget;
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (ev.button !== 0) return;
    if (pointerSession) return;

    const startX = ev.clientX;
    const startY = ev.clientY;

    const onMove = (e) => {
      if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
      const s = pointerSession;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (!s.armed) {
        if (Math.hypot(dx, dy) < CONTENTS_REORDER_DRAG_THRESHOLD_PX) return;
        s.armed = true;
        dragAnchor = s.anchor;
        s.anchor.classList.add(CONTENTS_REORDER_DRAGGING_CLASS);
        ghostEl = document.createElement("div");
        ghostEl.className = CONTENTS_REORDER_GHOST_CLASS;
        ghostEl.textContent = s.anchor.textContent || "";
        document.body.appendChild(ghostEl);
      }
      if (ghostEl) {
        ghostEl.style.left = `${e.clientX}px`;
        ghostEl.style.top = `${e.clientY}px`;
      }
      const row = s.anchor.parentElement;
      if (!(row instanceof HTMLElement)) return;
      const hit = contentsReorderTargetFromPoint(
        e.clientX,
        e.clientY,
        s.anchor,
      );
      clearRowDropIndicators(row);
      if (hit) {
        const hitRect = hit.getBoundingClientRect();
        const insertAfter = e.clientX > hitRect.left + hitRect.width / 2;
        hit.classList.add(
          insertAfter
            ? CONTENTS_REORDER_DROP_AFTER_CLASS
            : CONTENTS_REORDER_DROP_BEFORE_CLASS,
        );
      }
    };

    const onUp = (e) => {
      if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
      const s = pointerSession;
      endPointerSession();

      if (s.armed && dragAnchor) {
        const hit = contentsReorderTargetFromPoint(
          e.clientX,
          e.clientY,
          s.anchor,
        );
        const row = s.anchor.parentElement;
        if (
          hit &&
          dragAnchor &&
          hit !== dragAnchor &&
          row &&
          hit.parentElement === row
        ) {
          hit.classList.remove(
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          );
          const targetRect = hit.getBoundingClientRect();
          const insertAfter =
            e.clientX > targetRect.left + targetRect.width / 2;

          const currentAnchors = getOrderedAnchors(row);
          const newAnchors = currentAnchors.filter((a) => a !== dragAnchor);
          const hitIdx = newAnchors.indexOf(hit);
          newAnchors.splice(insertAfter ? hitIdx + 1 : hitIdx, 0, dragAnchor);

          currentTabOrder = newAnchors
            .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
            .filter(Boolean);
          applyTabCssOrder(newAnchors);
          saveOrderFrom(newAnchors);
        }
        const suppressClick = (ce) => {
          ce.preventDefault();
          ce.stopPropagation();
          s.anchor.removeEventListener("click", suppressClick, true);
        };
        s.anchor.addEventListener("click", suppressClick, true);
      }

      removeGhost();
      dragAnchor = null;
      clearDragClasses();
    };

    pointerSession = {
      anchor,
      pointerId: ev.pointerId,
      startX,
      startY,
      armed: false,
      onMove,
      onUp,
    };

    try {
      anchor.setPointerCapture(ev.pointerId);
    } catch (_) {}

    anchor.addEventListener("pointermove", onMove);
    anchor.addEventListener("pointerup", onUp);
    anchor.addEventListener("pointercancel", onUp);
  };

  const bind = () => {
    if (pointerSession) {
      endPointerSession();
      dragAnchor = null;
      clearDragClasses();
    }
    const groups = getContentsAnchorRows(3);

    document
      .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
      .forEach((a) => {
        a.removeEventListener("pointerdown", onPointerDown);
        a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
        a.removeAttribute("title");
        a.removeAttribute("draggable");
        a.style.removeProperty("order");
        a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
      });

    groups.flat().forEach((a) => {
      a.setAttribute(CONTENTS_REORDER_ANCHOR_ATTR, "1");
      a.removeAttribute("draggable");
      a.setAttribute("title", `Drag to reorder`);
      a.addEventListener("pointerdown", onPointerDown);
    });

    if (currentTabOrder) {
      groups.forEach((anchors) => {
        const row = anchors[0]?.parentElement;
        if (!(row instanceof HTMLElement)) return;
        applyTabCssOrder(getOrderedAnchors(row));
      });
    }
  };

  bind();
  observe.subscribe(
    {
      // Tabs and pages, not bare # links (spoilerboxes).
      selector: `${SECTION_PAGE_SEL}, ${HASH_LINK_SEL}:not([href="#"])`,
      schedule: 80,
      signal: ac.signal,
      label: "profile/contents-reorder",
    },
    bind,
  );

  return () => {
    ac.abort();
    document.querySelector(`.${CONTENTS_REORDER_ERROR_CLASS}`)?.remove();
    if (pointerSession) {
      endPointerSession();
      dragAnchor = null;
      clearDragClasses();
    }
    document
      .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
      .forEach((a) => {
        a.removeEventListener("pointerdown", onPointerDown);
        a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
        a.removeAttribute("title");
        a.removeAttribute("draggable");
        a.style.removeProperty("order");
        a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
      });
    removeContentsReorderStyles();
  };
}
