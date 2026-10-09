/**
 * Finds osu-web BBCode editors on the page and attaches the helper (WS-40).
 */

import { observe } from "../../core/observe.js";
import { el } from "../../features/legacy.js";
import {
  BBHELP_BTN_CLASS,
  BBHELP_BTN_ICON_CLASS,
  BBHELP_BTN_TEXT_CLASS,
  BBHELP_DONE_ATTR,
  BBHELP_EDITOR_ID_ATTR,
  BBHELP_EDITOR_SELECTOR,
  BBHELP_INPUT_SELECTOR,
  BBHELP_MODAL_CLASS,
  BBHELP_PREVIEW_CLASS,
  BBHELP_PREVIEW_TOGGLE_CLASS,
  BBHELP_ROW_CLASS,
  BBHELP_WARN_CLASS,
  BBHELP_WRAP_CLASS,
  BBHELP_WRAP_FOR_ATTR,
} from "./constants.js";
import { openImagemapHelper } from "./imagemap.js";
import { ensureBbcodeFormatChecker } from "./linter.js";
import { ensureBbcodeLivePreview } from "./live-preview.js";
import { acquireBbcodeHelperStyles } from "./styles.js";
import { createBbcodeButtons } from "./toolbar.js";

/**
 * @param {Element} editorEl
 * @param {any} session  see startBbcodeHelperManager
 */
function enhanceSingleBbcodeEditor(editorEl, session) {
  if (!(editorEl instanceof HTMLElement)) return;

  const textarea = editorEl.querySelector(BBHELP_INPUT_SELECTOR);
  if (!(textarea instanceof HTMLTextAreaElement)) return;
  ensureBbcodeFormatChecker(editorEl, textarea, session);
  ensureBbcodeLivePreview(editorEl, textarea, session);
  if (editorEl.hasAttribute(BBHELP_DONE_ATTR)) return;

  let editorId = editorEl.getAttribute(BBHELP_EDITOR_ID_ATTR);
  if (!editorId) {
    editorId = `oep-bbhelp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    editorEl.setAttribute(BBHELP_EDITOR_ID_ATTR, editorId);
  }
  const existingWrap = editorEl.querySelector(`:scope > .${BBHELP_WRAP_CLASS}`);
  if (existingWrap) {
    editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
    existingWrap.setAttribute(BBHELP_WRAP_FOR_ATTR, editorId);
    return;
  }

  const wrap = el("div", {
    class: BBHELP_WRAP_CLASS,
    [BBHELP_WRAP_FOR_ATTR]: editorId,
  });
  const row = el("div", { class: BBHELP_ROW_CLASS });
  createBbcodeButtons(textarea).forEach((btn) => row.appendChild(btn));
  wrap.appendChild(row);

  const row2 = el("div", {
    class: BBHELP_ROW_CLASS,
    style: "margin-top:4px;",
  });
  row2.appendChild(
    el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Open ImageMap helper",
        onclick: () => openImagemapHelper(textarea, session.signal),
      },
      el("span", { class: `${BBHELP_BTN_ICON_CLASS} fas fa-map-marked-alt` }),
      el("span", { class: BBHELP_BTN_TEXT_CLASS }, "Imagemap helper"),
    ),
  );
  wrap.appendChild(row2);

  editorEl.insertBefore(wrap, editorEl.firstChild);
  editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
}

function isElementActuallyVisible(node) {
  if (!(node instanceof HTMLElement)) return false;
  if (!node.isConnected) return false;
  if (node.hidden) return false;
  const cs = window.getComputedStyle(node);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  if (node.getClientRects().length === 0) return false;
  return true;
}

function teardownBbcodeHelpers() {
  document
    .querySelectorAll(`.${BBHELP_MODAL_CLASS}`)
    .forEach((n) => n.remove());
  document.querySelectorAll(`.${BBHELP_WARN_CLASS}`).forEach((n) => n.remove());
  document
    .querySelectorAll(`.${BBHELP_PREVIEW_TOGGLE_CLASS}`)
    .forEach((n) => n.remove());
  document
    .querySelectorAll(`.${BBHELP_PREVIEW_CLASS}`)
    .forEach((n) => n.remove());
  document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((n) => n.remove());
  document
    .querySelectorAll(`${BBHELP_EDITOR_SELECTOR}[${BBHELP_DONE_ATTR}]`)
    .forEach((n) => n.removeAttribute(BBHELP_DONE_ATTR));
}

/**
 * Attach the helper to every visible `.bbcode-editor` now and whenever one
 * (or its textarea) is added.
 * @returns {() => void} dispose
 */
export function startBbcodeHelperManager() {
  const releaseStyles = acquireBbcodeHelperStyles();
  const ac = new AbortController();
  // Per-textarea state lives only as long as this run, so a later run binds
  // fresh listeners and the old ones are already gone with ac (B50).
  const session = {
    signal: ac.signal,
    /** @type {WeakMap<HTMLTextAreaElement, any>} */
    previews: new WeakMap(),
    /** @type {WeakMap<HTMLTextAreaElement, HTMLElement>} */
    warnings: new WeakMap(),
  };

  const scan = () => {
    document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
      const parent = wrap.parentElement;
      if (!(parent instanceof HTMLElement)) return;
      if (!parent.matches(BBHELP_EDITOR_SELECTOR)) wrap.remove();
    });

    document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const editorId = wrap.getAttribute(BBHELP_WRAP_FOR_ATTR);
      const editor = editorId
        ? document.querySelector(
            `${BBHELP_EDITOR_SELECTOR}[${BBHELP_EDITOR_ID_ATTR}="${editorId}"]`,
          )
        : null;
      if (
        !(editor instanceof HTMLElement) ||
        !isElementActuallyVisible(editor)
      ) {
        if (editor instanceof HTMLElement) {
          editor.removeAttribute(BBHELP_DONE_ATTR);
        }
        wrap.remove();
      }
    });
    document.querySelectorAll(BBHELP_EDITOR_SELECTOR).forEach((editorEl) => {
      if (isElementActuallyVisible(editorEl))
        enhanceSingleBbcodeEditor(editorEl, session);
    });
  };

  scan();
  observe.subscribe(
    {
      selector: `${BBHELP_EDITOR_SELECTOR}, ${BBHELP_EDITOR_SELECTOR} ${BBHELP_INPUT_SELECTOR}`,
      schedule: "sync",
      signal: ac.signal,
      label: "profile/bbcode-helper",
    },
    scan,
  );

  return () => {
    ac.abort();
    teardownBbcodeHelpers();
    releaseStyles();
  };
}
