/**
 * Stylesheet for the BBCode helper toolbar, modals and live preview (WS-40).
 */

import { manageStyle } from "../../features/legacy.js";
import {
  BBHELP_BTN_CLASS,
  BBHELP_BTN_ICON_CLASS,
  BBHELP_BTN_TEXT_CLASS,
  BBHELP_MODAL_CLASS,
  BBHELP_PREVIEW_BODY_CLASS,
  BBHELP_PREVIEW_CLASS,
  BBHELP_PREVIEW_EMPTY_CLASS,
  BBHELP_PREVIEW_TITLE_CLASS,
  BBHELP_PREVIEW_TOGGLE_CLASS,
  BBHELP_ROW_CLASS,
  BBHELP_STYLE_ID,
  BBHELP_WARN_CLASS,
  BBHELP_WRAP_CLASS,
} from "./constants.js";

export const BBHELP_CSS = `
  .${BBHELP_WRAP_CLASS} {
    margin: 0 0 10px;
    display: block;
  }
  .${BBHELP_ROW_CLASS} {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .${BBHELP_BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    font: inherit;
    font-weight: 600;
    font-size: 12px;
    line-height: 1;
    padding: 6px 8px;
    cursor: pointer;
  }
  .${BBHELP_BTN_CLASS}:hover {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.1);
  }
  .${BBHELP_BTN_ICON_CLASS} {
    width: 12px;
    text-align: center;
    opacity: 0.92;
  }
  .${BBHELP_BTN_TEXT_CLASS} {
    white-space: nowrap;
  }
  .${BBHELP_MODAL_CLASS} {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }
  .${BBHELP_MODAL_CLASS}__card {
    width: min(420px, 100%);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: #1f1f2a;
    color: rgba(255, 255, 255, 0.95);
    padding: 12px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  }
  .${BBHELP_MODAL_CLASS}__title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 700;
  }
  .${BBHELP_MODAL_CLASS}__modes {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 13px;
  }
  .${BBHELP_MODAL_CLASS}__field {
    margin-bottom: 10px;
  }
  .${BBHELP_MODAL_CLASS}__hint {
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
  }
  .${BBHELP_MODAL_CLASS} select,
  .${BBHELP_MODAL_CLASS} input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font: inherit;
    padding: 6px 8px;
  }
  .${BBHELP_MODAL_CLASS}__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }
  .${BBHELP_MODAL_CLASS}__actions-warn {
    margin-right: auto;
    min-width: 0;
    max-width: 100%;
    font-size: 12px;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.62);
  }
  .${BBHELP_MODAL_CLASS}__actions-warn:empty {
    display: none;
  }
  .${BBHELP_MODAL_CLASS}__actions-warn--error {
    color: rgba(255, 196, 120, 0.95);
  }
  .${BBHELP_MODAL_CLASS}__actions-btns {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }
  .${BBHELP_MODAL_CLASS} .${BBHELP_BTN_CLASS}:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .${BBHELP_MODAL_CLASS}__color-grid {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
  }
  .${BBHELP_MODAL_CLASS} input[type="color"] {
    width: 56px;
    height: 36px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .${BBHELP_MODAL_CLASS} input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font: inherit;
    padding: 6px 8px;
  }
  .${BBHELP_MODAL_CLASS} input[aria-invalid="true"] {
    border-color: #f0ad4e;
  }
  .${BBHELP_MODAL_CLASS} textarea {
    width: 100%;
    box-sizing: border-box;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    color: inherit;
    font: inherit;
    padding: 8px;
    line-height: 1.4;
  }
  .${BBHELP_MODAL_CLASS}__swatch {
    width: 100%;
    height: 14px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: #ff66aa;
    margin-top: 8px;
  }
  .${BBHELP_WARN_CLASS} {
    margin-top: 8px;
    border-left: 3px solid #f0ad4e;
    background: rgba(240, 173, 78, 0.12);
    color: #ffd28a;
    font-size: 12px;
    line-height: 1.35;
    padding: 6px 8px;
  }
  .${BBHELP_WARN_CLASS}[hidden] {
    display: none !important;
  }
  .${BBHELP_PREVIEW_TOGGLE_CLASS} {
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.92);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    padding: 7px 9px;
    cursor: pointer;
    margin-right: 8px;
  }
  .${BBHELP_PREVIEW_TOGGLE_CLASS}:hover {
    border-color: rgba(255, 255, 255, 0.32);
    background: rgba(255, 255, 255, 0.14);
  }
  .${BBHELP_PREVIEW_TOGGLE_CLASS}[aria-pressed="true"] {
    border-color: rgba(255, 255, 255, 0.38);
    background: rgba(255, 255, 255, 0.2);
  }
  .${BBHELP_PREVIEW_CLASS} {
    margin-top: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    padding: 10px;
    color: rgba(255, 255, 255, 0.9);
  }
  .${BBHELP_PREVIEW_CLASS}[hidden] {
    display: none !important;
  }
  .${BBHELP_PREVIEW_TITLE_CLASS} {
    margin: 0 0 8px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: rgba(255, 255, 255, 0.72);
  }
  .${BBHELP_PREVIEW_BODY_CLASS} {
    line-height: 1.55;
    word-break: break-word;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} p {
    margin: 0 0 0.7em;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} p:last-child {
    margin-bottom: 0;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} blockquote {
    margin: 0 0 0.7em;
    padding-left: 0.8em;
    border-left: 3px solid rgba(255, 255, 255, 0.26);
    color: rgba(255, 255, 255, 0.82);
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoilerbox {
    margin: 0 0 0.65em;
    border: none;
    border-radius: 0;
    background: transparent;
    overflow: visible;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary {
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 0.35em;
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 100%;
    font-weight: 700;
    color: hsl(var(--hsl-l2));
    background: none;
    border: none;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    text-align: left;
    width: max-content;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary:hover {
    color: hsl(var(--hsl-l1));
    text-decoration: underline;
  }
  .${BBHELP_PREVIEW_BODY_CLASS}
    .oep-bbhelp-preview__spoiler-summary::-webkit-details-marker {
    display: none;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon {
    display: block;
    flex: none;
    width: 1.1em;
    text-align: center;
    line-height: 1;
    opacity: 0.9;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon::before {
    display: inline-block;
    font-family: "Font Awesome 5 Free", "Font Awesome 6 Free", sans-serif;
    font-weight: 900;
    content: "\\f105";
    font-size: 0.95em;
    transition: transform 0.12s ease;
  }
  .${BBHELP_PREVIEW_BODY_CLASS}
    .oep-bbhelp-preview__spoilerbox[open]
    .oep-bbhelp-preview__spoiler-icon::before {
    content: "\\f107";
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-label {
    overflow-wrap: anywhere;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body {
    margin-top: 10px;
    padding-left: 20px;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body > p:first-child {
    margin-top: 0;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary--icon-only {
    min-width: 1.25em;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice {
    margin: 0 0 0.7em;
    padding: 10px 12px;
    border: 1px solid hsl(var(--hsl-h1));
    border-radius: 6px;
    background: hsl(var(--hsl-b4));
    color: hsl(var(--hsl-c1));
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice > p:last-child {
    margin-bottom: 0;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} pre,
  .${BBHELP_PREVIEW_BODY_CLASS} code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.92em;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} pre {
    margin: 0 0 0.7em;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(0, 0, 0, 0.25);
    overflow-x: auto;
    white-space: pre-wrap;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} ul,
  .${BBHELP_PREVIEW_BODY_CLASS} ol {
    margin: 0 0 0.7em;
    padding-left: 1.35em;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} img {
    max-width: min(100%, 520px);
    height: auto;
    border-radius: 4px;
    display: block;
    margin: 0.3em 0;
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap {
    margin: 0 0 0.7em;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.16);
  }
  .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap-meta {
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.4;
  }
  .${BBHELP_PREVIEW_EMPTY_CLASS} {
    color: rgba(255, 255, 255, 0.62);
    font-style: italic;
    margin: 0;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-rect {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid rgba(255, 180, 0, 0.85);
    background: rgba(255, 180, 0, 0.14);
    pointer-events: auto;
    cursor: pointer;
    border-radius: 2px;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-rect--selected {
    border-color: rgba(120, 200, 255, 0.95);
    background: rgba(120, 200, 255, 0.2);
    box-shadow: 0 0 0 1px rgba(120, 200, 255, 0.45);
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-row--selected {
    border-color: rgba(120, 200, 255, 0.55) !important;
    background: rgba(120, 200, 255, 0.1) !important;
    box-shadow: inset 0 0 0 1px rgba(120, 200, 255, 0.25);
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-rect--movable {
    cursor: move;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-handle {
    position: absolute;
    width: 11px;
    height: 11px;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    border: 2px solid rgba(255, 255, 255, 0.95);
    background: rgba(120, 200, 255, 0.95);
    border-radius: 2px;
    z-index: 2;
    pointer-events: auto;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-handle--nw {
    left: 0;
    top: 0;
    transform: translate(-50%, -50%);
    cursor: nwse-resize;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-handle--ne {
    left: 100%;
    top: 0;
    transform: translate(-50%, -50%);
    cursor: nesw-resize;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-handle--sw {
    left: 0;
    top: 100%;
    transform: translate(-50%, -50%);
    cursor: nesw-resize;
  }
  .${BBHELP_MODAL_CLASS} .oep-imap-handle--se {
    left: 100%;
    top: 100%;
    transform: translate(-50%, -50%);
    cursor: nwse-resize;
  }
`;

/**
 * Add the helper stylesheet (reference counted).
 * @returns {() => void} release
 */
export function acquireBbcodeHelperStyles() {
  return manageStyle(BBHELP_STYLE_ID, BBHELP_CSS).acquire();
}
