/**
 * Expert+ Recent: the per-row options menu (WS-41).
 */

import { el } from "../../legacy.js";
import { maybeCsrfToken } from "../csrf.js";
import {
  getCurrentUserIdFromHeader,
  getProfileUserId,
} from "../profile-target.js";
const SCORE_OPTIONS_WRAP_CLASS = "oep-score-options-wrap";
export const SCORE_OPTIONS_BTN_CLASS = "oep-score-options-btn";
const SCORE_OPTIONS_MENU_CLASS = "oep-score-options-menu";
const SCORE_OPTIONS_ITEM_CLASS = "oep-score-options-item";

function _closeAllScoreOptionsMenus() {
  document
    .querySelectorAll(`.${SCORE_OPTIONS_MENU_CLASS}[data-open]`)
    .forEach((m) => m.removeAttribute("data-open"));
}

/** Menus portaled into <body> so far (B42: removed on cleanup). */
const portaledMenus = new Set();
/** @type {WeakMap<Element, HTMLElement>} options button -> its menu */
const menuByButton = new WeakMap();
/** @type {WeakMap<Element, Element>} menu -> its options button */
const buttonByMenu = new WeakMap();
/** @type {((e: MouseEvent) => void) | null} */
let docClickListener = null;
/** @type {(() => void) | null} */
let repositionListener = null;

/**
 * Put a `position: fixed` menu right under its button.
 * @param {HTMLElement} menu
 * @param {Element} btn
 */
function placeMenuUnderButton(menu, btn) {
  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 2}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
}

/** Keep open menus under their buttons (B105); close orphaned ones. */
function repositionOpenMenus() {
  for (const menu of portaledMenus) {
    if (!menu.hasAttribute("data-open")) continue;
    const btn = buttonByMenu.get(menu);
    if (btn?.isConnected) placeMenuUnderButton(menu, btn);
    else menu.removeAttribute("data-open");
  }
}

function _ensureScoreOptionsDocListener() {
  if (docClickListener) return;
  // Menus are portaled to <body> so we cannot use .closest() from the menu
  // element. Instead, close everything unless the click lands on a wrap button
  // or inside an open menu.
  docClickListener = (e) => {
    const target = /** @type {Element} */ (e.target);
    const inWrap = target.closest?.(`.${SCORE_OPTIONS_WRAP_CLASS}`);
    const inMenu = target.closest?.(`.${SCORE_OPTIONS_MENU_CLASS}`);
    if (!inWrap && !inMenu) _closeAllScoreOptionsMenus();
  };
  document.addEventListener("click", docClickListener, { capture: true });
  // The menu is `position: fixed` in <body>: follow the button when the page
  // or a scrolling container moves it.
  repositionListener = repositionOpenMenus;
  document.addEventListener("scroll", repositionListener, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", repositionListener);
}

/**
 * Remove the portaled menu of one options button (list re-render).
 * @param {Element} btn
 */
export function removeScoreOptionsMenu(btn) {
  const menu = menuByButton.get(btn);
  if (!menu) return;
  menu.remove();
  portaledMenus.delete(menu);
}

/**
 * Remove every portaled menu and the document click listener (B42). Called
 * by the Recent cleanup; menus and the listener come back on the next open.
 */
export function disposeScoreOptionsMenus() {
  portaledMenus.forEach((m) => m.remove());
  portaledMenus.clear();
  if (docClickListener) {
    document.removeEventListener("click", docClickListener, { capture: true });
    docClickListener = null;
  }
  if (repositionListener) {
    document.removeEventListener("scroll", repositionListener, {
      capture: true,
    });
    window.removeEventListener("resize", repositionListener);
    repositionListener = null;
  }
}

/**
 * Build the "⋯" options button + dropdown for a recent-score row.
 * The dropdown is portaled to <body> to escape any CSS stacking-context
 * created by transforms/filters on parent score cards.
 * Returns the button wrapper element, or null when the score has no usable id.
 * @param {Object} score
 * @returns {HTMLElement|null}
 */
export function buildScoreOptionsMenu(score) {
  const scoreId = score?.id;
  if (scoreId == null) return null;

  // Portal: the menu lives in <body>, completely outside the card hierarchy,
  // and only once it is first opened (B42: up to 200 rows).
  const menu = el("div", { class: SCORE_OPTIONS_MENU_CLASS });

  const viewLink = el(
    "a",
    {
      class: SCORE_OPTIONS_ITEM_CLASS,
      href: `https://osu.ppy.sh/scores/${scoreId}`,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    "View details",
  );
  viewLink.addEventListener("click", () => menu.removeAttribute("data-open"));
  menu.appendChild(viewLink);

  if (score.has_replay) {
    const replayLink = el(
      "a",
      {
        class: SCORE_OPTIONS_ITEM_CLASS,
        href: `https://osu.ppy.sh/scores/${scoreId}/download`,
        rel: "noopener noreferrer",
      },
      "Download replay",
    );
    replayLink.addEventListener("click", () =>
      menu.removeAttribute("data-open"),
    );
    menu.appendChild(replayLink);
  }

  // The score's own user, not the page's (B43): the profile DOM may still be
  // the previous one right after an SPA move.
  const ownerId = score?.user_id ?? score?.user?.id ?? getProfileUserId();
  const me = getCurrentUserIdFromHeader();
  const isOwnProfile = ownerId != null && me != null && String(ownerId) === me;

  if (isOwnProfile) {
    const pinBtn = el(
      "button",
      { type: "button", class: SCORE_OPTIONS_ITEM_CLASS },
      "Pin",
    );
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (pinBtn.classList.contains(`${SCORE_OPTIONS_ITEM_CLASS}--pending`))
        return;

      pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
      pinBtn.textContent = "Pinning…";
      try {
        const headers = {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        };
        const csrf = maybeCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
        const resp = await fetch(`/score-pins/${scoreId}`, {
          method: "PUT",
          credentials: "include",
          headers,
        });
        pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
        if (resp.ok || resp.status === 204) {
          pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--done`);
          pinBtn.textContent = "Pinned!";
        } else {
          pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
          pinBtn.textContent = `Failed (${resp.status})`;
        }
      } catch {
        pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
        pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
        pinBtn.textContent = "Error";
      }
      setTimeout(() => {
        pinBtn.classList.remove(
          `${SCORE_OPTIONS_ITEM_CLASS}--done`,
          `${SCORE_OPTIONS_ITEM_CLASS}--error`,
        );
        pinBtn.textContent = "Pin";
        menu.removeAttribute("data-open");
      }, 2000);
    });
    menu.appendChild(pinBtn);
  } // end isOwnProfile

  const btn = el(
    "button",
    {
      type: "button",
      class: SCORE_OPTIONS_BTN_CLASS,
      title: "Options",
    },
    el("i", { class: "fas fa-ellipsis-h" }),
  );
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.hasAttribute("data-open");
    _closeAllScoreOptionsMenus();
    if (!isOpen) {
      _ensureScoreOptionsDocListener();
      if (!menu.isConnected) {
        document.body.appendChild(menu);
        portaledMenus.add(menu);
      }
      placeMenuUnderButton(menu, btn);
      menu.setAttribute("data-open", "");
    }
  });

  // So the menu can be removed when the list is repopulated
  // (populateRecentScoresInnerList).
  menuByButton.set(btn, menu);
  buttonByMenu.set(menu, btn);

  return el("div", { class: SCORE_OPTIONS_WRAP_CLASS }, btn);
}

/**
 * @param {Object|null|undefined} score
 * @returns {string}
 */
export function scoreTimestampIso(score) {
  if (!score || typeof score !== "object") return "";
  const raw = score.ended_at || score.created_at || "";
  return typeof raw === "string" ? raw : "";
}
