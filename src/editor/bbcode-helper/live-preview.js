/**
 * Live preview of the edited BBCode (WS-40). Rendering is the WS-25
 * tokenizer renderer (`renderBbcode`, DOM nodes only, no HTML parsing) with
 * `sanitizeTree` as a second line of defence; the toggle is placed from
 * osu-web's markup, not the English "Cancel" label (B45).
 */

import { el } from "../../features/legacy.js";
import { renderBbcode } from "../bbcode-render.js";
import { placeBbcodePreviewToggle } from "../preview-toggle.js";
import { sanitizeTree } from "../sanitize.js";
import {
  BBHELP_PREVIEW_ATTR,
  BBHELP_PREVIEW_BODY_CLASS,
  BBHELP_PREVIEW_CLASS,
  BBHELP_PREVIEW_DONE_ATTR,
  BBHELP_PREVIEW_EMPTY_CLASS,
  BBHELP_PREVIEW_TITLE_CLASS,
  BBHELP_PREVIEW_TOGGLE_ATTR,
  BBHELP_PREVIEW_TOGGLE_CLASS,
} from "./constants.js";

/**
 * Replace the children of `body` with the preview of `source`, or the empty
 * state when there is nothing but whitespace.
 * @param {HTMLElement} body
 * @param {string} source
 */
export function renderBbcodePreviewInto(body, source) {
  const document = body.ownerDocument;
  if (!String(source ?? "").trim()) {
    body.replaceChildren(
      el("p", { class: BBHELP_PREVIEW_EMPTY_CLASS }, "Nothing to preview yet."),
    );
    return;
  }
  body.replaceChildren(sanitizeTree(renderBbcode(source, { document })));
}

export function _ensureBbcodeLivePreview(editorEl, textarea) {
  let previewEnabled = false;
  let repaintTimer = 0;

  let toggleBtn = editorEl.querySelector(`[${BBHELP_PREVIEW_TOGGLE_ATTR}]`);
  if (!(toggleBtn instanceof HTMLButtonElement)) {
    toggleBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_PREVIEW_TOGGLE_CLASS,
        [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
        "aria-pressed": "false",
        title: "Toggle live preview",
      },
      "Live preview",
    );
  }

  let preview = editorEl.querySelector(`[${BBHELP_PREVIEW_ATTR}]`);
  if (!(preview instanceof HTMLElement)) {
    preview = el(
      "section",
      {
        class: BBHELP_PREVIEW_CLASS,
        [BBHELP_PREVIEW_ATTR]: "1",
        hidden: "hidden",
      },
      el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
      el("div", { class: BBHELP_PREVIEW_BODY_CLASS }),
    );
    textarea.insertAdjacentElement("afterend", preview);
  }

  const previewBody = preview.querySelector(`.${BBHELP_PREVIEW_BODY_CLASS}`);
  if (!(previewBody instanceof HTMLElement)) return;

  const placeToggle = () => {
    placeBbcodePreviewToggle(editorEl, textarea, toggleBtn);
  };

  const repaint = () => {
    renderBbcodePreviewInto(previewBody, textarea.value || "");
    preview.hidden = !previewEnabled;
    toggleBtn.setAttribute("aria-pressed", previewEnabled ? "true" : "false");
    placeToggle();
  };
  const repaintSoon = () => {
    window.clearTimeout(repaintTimer);
    repaintTimer = window.setTimeout(repaint, 70);
  };

  if (!textarea.hasAttribute(BBHELP_PREVIEW_DONE_ATTR)) {
    textarea.addEventListener("input", repaintSoon);
    toggleBtn.addEventListener("click", () => {
      previewEnabled = !previewEnabled;
      repaint();
    });
    textarea.setAttribute(BBHELP_PREVIEW_DONE_ATTR, "1");
  } else {
    previewEnabled = toggleBtn.getAttribute("aria-pressed") === "true";
  }

  repaint();
}
