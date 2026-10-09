/**
 * Live preview of the edited BBCode (WS-40). Rendering is the WS-25
 * tokenizer renderer (`renderBbcode`, DOM nodes only, no HTML parsing) with
 * `sanitizeTree` as a second line of defence; the toggle is placed from
 * osu-web's markup, not the English "Cancel" label (B45).
 */

import { listen } from "../../core/lifecycle.js";
import { el } from "../../features/legacy.js";
import { renderBbcode } from "../bbcode-render.js";
import { placeBbcodePreviewToggle } from "../preview-toggle.js";
import { sanitizeTree } from "../sanitize.js";
import {
  BBHELP_PREVIEW_ATTR,
  BBHELP_PREVIEW_BODY_CLASS,
  BBHELP_PREVIEW_CLASS,
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

/**
 * @typedef {{
 *   enabled: boolean,
 *   timer: number,
 *   toggle: HTMLButtonElement,
 *   preview: HTMLElement,
 *   body: HTMLElement,
 * }} PreviewState
 */

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {PreviewState} state
 */
function paintPreview(textarea, state) {
  window.clearTimeout(state.timer);
  state.timer = 0;
  state.preview.hidden = !state.enabled;
  state.toggle.setAttribute("aria-pressed", state.enabled ? "true" : "false");
  if (state.enabled) renderBbcodePreviewInto(state.body, textarea.value || "");
}

/**
 * Add the preview toggle and panel to an editor, once per textarea per
 * helper session (B50): the input and click listeners are bound when the
 * state is created and go away with `session.signal`; later calls only put
 * the toggle and panel back in place if osu-web moved or dropped them. The
 * preview is rendered only while it is shown, 70ms after the last input.
 * @param {HTMLElement} editorEl
 * @param {HTMLTextAreaElement} textarea
 * @param {{ signal: AbortSignal, previews: WeakMap<HTMLTextAreaElement, PreviewState> }} session
 */
export function ensureBbcodeLivePreview(editorEl, textarea, session) {
  let state = session.previews.get(textarea);
  if (!state) {
    const toggle = /** @type {HTMLButtonElement} */ (
      el(
        "button",
        {
          type: "button",
          class: BBHELP_PREVIEW_TOGGLE_CLASS,
          [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
          "aria-pressed": "false",
          title: "Toggle live preview",
        },
        "Live preview",
      )
    );
    const body = el("div", { class: BBHELP_PREVIEW_BODY_CLASS });
    const preview = el(
      "section",
      {
        class: BBHELP_PREVIEW_CLASS,
        [BBHELP_PREVIEW_ATTR]: "1",
        hidden: "hidden",
      },
      el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
      body,
    );
    const created = { enabled: false, timer: 0, toggle, preview, body };
    state = created;
    session.previews.set(textarea, created);
    const { signal } = session;
    listen(
      toggle,
      "click",
      () => {
        created.enabled = !created.enabled;
        paintPreview(textarea, created);
      },
      signal,
    );
    listen(
      textarea,
      "input",
      () => {
        if (!created.enabled) return;
        window.clearTimeout(created.timer);
        created.timer = window.setTimeout(
          () => paintPreview(textarea, created),
          70,
        );
      },
      signal,
    );
    signal.addEventListener("abort", () => window.clearTimeout(created.timer), {
      once: true,
    });
  }
  if (
    state.preview.parentElement !== textarea.parentElement ||
    !state.preview.isConnected
  ) {
    textarea.insertAdjacentElement("afterend", state.preview);
  }
  placeBbcodePreviewToggle(editorEl, textarea, state.toggle);
}
