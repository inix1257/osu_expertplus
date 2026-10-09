/**
 * The modal shell shared by the colour, size and ImageMap dialogs (WS-40):
 * a full-page overlay with one card, appended to `document.body`.
 */

import { el } from "../../features/legacy.js";
import { BBHELP_BTN_CLASS, BBHELP_MODAL_CLASS } from "./constants.js";

/**
 * @param {{ cardStyle?: string }} [options]
 * @returns {{ overlay: HTMLElement, card: HTMLElement,
 *   show: () => void, close: () => void }}
 */
export function createBbcodeModal({ cardStyle } = {}) {
  const overlay = el("div", { class: BBHELP_MODAL_CLASS });
  const card = el("div", {
    class: `${BBHELP_MODAL_CLASS}__card`,
    style: cardStyle,
  });
  return {
    overlay,
    card,
    show() {
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    },
    close() {
      overlay.remove();
    },
  };
}

/**
 * @param {string} text
 * @param {Record<string, string>} [attrs]
 */
export function modalTitle(text, attrs = {}) {
  return el("h4", { class: `${BBHELP_MODAL_CLASS}__title`, ...attrs }, text);
}

/**
 * @param {string} label
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLButtonElement}
 */
export function modalButton(label, attrs = {}) {
  return el(
    "button",
    { type: "button", class: BBHELP_BTN_CLASS, ...attrs },
    label,
  );
}

/**
 * Keyboard and outside-click handling of a picker: Escape and a click on the
 * overlay close it, Enter applies.
 * @param {HTMLElement} overlay
 * @param {{ apply: () => void, close: () => void }} actions
 */
export function bindPickerKeys(overlay, { apply, close }) {
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) close();
  });
  overlay.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") close();
    if (ev.key === "Enter") apply();
  });
}
