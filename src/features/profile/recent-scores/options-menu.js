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

let _scoreOptionsDocListenerAdded = false;
function _ensureScoreOptionsDocListener() {
  if (_scoreOptionsDocListenerAdded) return;
  _scoreOptionsDocListenerAdded = true;
  // Menus are portaled to <body> so we cannot use .closest() from the menu
  // element. Instead, close everything unless the click lands on a wrap button
  // or inside an open menu.
  document.addEventListener(
    "click",
    (e) => {
      const inWrap = e.target.closest(`.${SCORE_OPTIONS_WRAP_CLASS}`);
      const inMenu = e.target.closest(`.${SCORE_OPTIONS_MENU_CLASS}`);
      if (!inWrap && !inMenu) _closeAllScoreOptionsMenus();
    },
    { capture: true },
  );
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

  _ensureScoreOptionsDocListener();

  // Portal: menu lives in <body>, completely outside the card hierarchy.
  const menu = el("div", { class: SCORE_OPTIONS_MENU_CLASS });
  document.body.appendChild(menu);

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
      const rect = btn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 2}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.setAttribute("data-open", "");
    }
  });

  // Attach menu reference to the button so it can be cleaned up when the
  // score list is repopulated (populateRecentScoresInnerList).
  btn._oepMenu = menu;

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
