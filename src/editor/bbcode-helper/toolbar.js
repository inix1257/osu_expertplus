/**
 * Toolbar buttons of the BBCode helper (WS-40).
 */

import { el } from "../../features/legacy.js";
import { toggleWrap } from "../textarea.js";
import {
  BBHELP_BTN_CLASS,
  BBHELP_BTN_ICON_CLASS,
  BBHELP_BTN_TEXT_CLASS,
} from "./constants.js";
import { openColorPicker, openSizePicker } from "./pickers.js";

export function createBbcodeButtons(textarea) {
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
      onClick: () => openColorPicker(textarea),
    },
    {
      label: "Size",
      title: "Font size",
      icon: "fas fa-text-height",
      onClick: () => openSizePicker(textarea),
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
            : toggleWrap(textarea, spec.open, spec.close),
      },
      el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
      el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label),
    ),
  );
}
