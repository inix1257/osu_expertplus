/**
 * Toolbar buttons of the BBCode helper and the textarea edits they make (WS-40).
 */

import { el } from "../../features/legacy.js";
import {
  BBHELP_BTN_CLASS,
  BBHELP_BTN_ICON_CLASS,
  BBHELP_BTN_TEXT_CLASS,
} from "./constants.js";
import { _openColorPicker, _openSizePicker } from "./pickers.js";

export function _replaceTextareaRange(textarea, from, to, replacement) {
  textarea.focus();
  textarea.setSelectionRange(from, to);
  let usedNativeUndoPath = false;
  try {
    if (typeof document.execCommand === "function") {
      usedNativeUndoPath = document.execCommand(
        "insertText",
        false,
        replacement,
      );
    }
  } catch (_) {}
  if (!usedNativeUndoPath) {
    textarea.setRangeText(replacement, from, to, "end");
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function _toggleBbcodeWrap(textarea, openTag, closeTag) {
  const value = textarea.value || "";
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const hasSelection = end > start;

  const selected = value.slice(start, end);
  const selectedIsWrapped =
    selected.startsWith(openTag) && selected.endsWith(closeTag);
  const aroundSelectionIsWrapped =
    start >= openTag.length &&
    value.slice(start - openTag.length, start) === openTag &&
    value.slice(end, end + closeTag.length) === closeTag;
  const aroundCursorIsWrapped =
    !hasSelection &&
    start >= openTag.length &&
    value.slice(start - openTag.length, start) === openTag &&
    value.slice(start, start + closeTag.length) === closeTag;

  let nextStart = start;
  let nextEnd;

  if (hasSelection && selectedIsWrapped) {
    const inner = selected.slice(
      openTag.length,
      selected.length - closeTag.length,
    );
    _replaceTextareaRange(textarea, start, end, inner);
    nextEnd = start + inner.length;
  } else if (hasSelection && aroundSelectionIsWrapped) {
    _replaceTextareaRange(
      textarea,
      start - openTag.length,
      end + closeTag.length,
      selected,
    );
    nextStart = start - openTag.length;
    nextEnd = nextStart + selected.length;
  } else if (aroundCursorIsWrapped) {
    _replaceTextareaRange(
      textarea,
      start - openTag.length,
      start + closeTag.length,
      "",
    );
    nextStart = start - openTag.length;
    nextEnd = nextStart;
  } else {
    _replaceTextareaRange(
      textarea,
      start,
      end,
      `${openTag}${selected}${closeTag}`,
    );
    if (hasSelection) {
      nextStart = start + openTag.length;
      nextEnd = nextStart + selected.length;
    } else {
      nextStart = start + openTag.length;
      nextEnd = nextStart;
    }
  }

  textarea.setSelectionRange(nextStart, nextEnd);
}

export function _createBbcodeButtons(textarea) {
  const specs = [
    {
      label: "Bold",
      title: "Bold",
      icon: "fas fa-bold",
      open: "[b]",
      close: "[/b]",
    },
    {
      label: "Italic",
      title: "Italic",
      icon: "fas fa-italic",
      open: "[i]",
      close: "[/i]",
    },
    {
      label: "Underline",
      title: "Underline",
      icon: "fas fa-underline",
      open: "[u]",
      close: "[/u]",
    },
    {
      label: "Strike",
      title: "Strike",
      icon: "fas fa-strikethrough",
      open: "[s]",
      close: "[/s]",
    },
    {
      label: "Heading",
      title: "Heading",
      icon: "fas fa-heading",
      open: "[heading]",
      close: "[/heading]",
    },
    {
      label: "Quote",
      title: "Quote",
      icon: "fas fa-quote-right",
      open: "[quote]",
      close: "[/quote]",
    },
    {
      label: "Code",
      title: "Code",
      icon: "fas fa-code",
      open: "[code]",
      close: "[/code]",
    },
    {
      label: "Spoiler Box",
      title: "Spoiler Box",
      icon: "fas fa-box-open",
      open: "[box]",
      close: "[/box]",
    },
    {
      label: "Color",
      title: "Font color",
      icon: "fas fa-palette",
      onClick: () => _openColorPicker(textarea),
    },
    {
      label: "Size",
      title: "Font size",
      icon: "fas fa-text-height",
      onClick: () => _openSizePicker(textarea),
    },
    {
      label: "Link",
      title: "Link",
      icon: "fas fa-link",
      open: "[url]",
      close: "[/url]",
    },
    {
      label: "Image",
      title: "Image",
      icon: "far fa-image",
      open: "[img]",
      close: "[/img]",
    },
    {
      label: "List",
      title: "List",
      icon: "fas fa-list-ul",
      open: "[list]\n[*]",
      close: "\n[/list]",
    },
    {
      label: "Center",
      title: "Center",
      icon: "fas fa-align-center",
      open: "[centre]",
      close: "[/centre]",
    },
    {
      label: "Right",
      title: "Right",
      icon: "fas fa-align-right",
      open: "[right]",
      close: "[/right]",
    },
  ];

  return specs.map((spec) =>
    el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: spec.title,
        onclick: () =>
          typeof spec.onClick === "function"
            ? spec.onClick()
            : _toggleBbcodeWrap(textarea, spec.open, spec.close),
      },
      el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
      el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label),
    ),
  );
}
