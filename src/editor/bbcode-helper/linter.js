/**
 * BBCode format warning shown under the editor (WS-40).
 */

import { listen } from "../../core/lifecycle.js";
import { el } from "../../features/legacy.js";
import { BBHELP_WARN_CLASS } from "./constants.js";

export function parseBbcodeTagName(rawTag) {
  const s = String(rawTag || "").trim();
  if (!s) return "";
  const noSlash = s.startsWith("/") ? s.slice(1).trim() : s;
  const cutEq = noSlash.split("=")[0].trim();
  const cutSpace = cutEq.split(/\s+/)[0].trim();
  return cutSpace.toLowerCase();
}

export const KNOWN_BBCODE_TAGS = new Set([
  "b",
  "i",
  "u",
  "s",
  "strike",
  "color",
  "size",
  "spoiler",
  "box",
  "spoilerbox",
  "quote",
  "c",
  "code",
  "centre",
  "right",
  "url",
  "profile",
  "list",
  "*",
  "email",
  "img",
  "imagemap",
  "youtube",
  "audio",
  "heading",
  "notice",
]);

export function firstBbcodeFormatIssue(text) {
  const value = String(text || "");
  /** @type {string[]} */
  const stack = [];
  const selfClosing = new Set(["*"]);
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === "]") {
      return "Unexpected closing bracket `]`.";
    }
    if (ch !== "[") {
      i += 1;
      continue;
    }
    const closeIdx = value.indexOf("]", i + 1);
    if (closeIdx === -1) {
      return "Missing closing bracket `]` for a BBCode tag.";
    }
    const rawTag = value.slice(i + 1, closeIdx).trim();
    if (!rawTag) {
      return "Empty BBCode tag `[]` is invalid.";
    }
    const isClosing = rawTag.startsWith("/");
    const name = parseBbcodeTagName(rawTag);
    if (!name || !/^[a-z*]+$/.test(name)) {
      return `Invalid tag name in \`[${rawTag}]\`.`;
    }
    // Unknown bracketed text is treated as plain text, not BBCode.
    if (!KNOWN_BBCODE_TAGS.has(name)) {
      i = closeIdx + 1;
      continue;
    }
    if (!isClosing && !selfClosing.has(name)) {
      stack.push(name);
    } else if (isClosing) {
      const expected = stack[stack.length - 1];
      if (!expected) {
        return `Closing tag \`[/${name}]\` has no matching opening tag.`;
      }
      if (expected !== name) {
        return `Mismatched tag order: expected \`[/${expected}]\` before \`[/${name}]\`.`;
      }
      stack.pop();
    }
    i = closeIdx + 1;
  }
  if (stack.length) {
    return `Unclosed tag \`[${stack[stack.length - 1]}]\` found.`;
  }
  return null;
}

/**
 * Add the format warning under an editor's textarea, once per textarea per
 * helper session (B50). The input listener goes away with `session.signal`.
 * @param {HTMLElement} _editorEl
 * @param {HTMLTextAreaElement} textarea
 * @param {{ signal: AbortSignal, warnings: WeakMap<HTMLTextAreaElement, HTMLElement> }} session
 */
export function ensureBbcodeFormatChecker(_editorEl, textarea, session) {
  let warnEl = session.warnings.get(textarea);
  if (!warnEl) {
    const created = el("div", { class: BBHELP_WARN_CLASS, hidden: "hidden" });
    warnEl = created;
    session.warnings.set(textarea, created);
    const refresh = () => {
      const issue = firstBbcodeFormatIssue(textarea.value);
      created.hidden = !issue;
      created.textContent = issue ? `BBCode format warning: ${issue}` : "";
    };
    listen(textarea, "input", refresh, session.signal);
    refresh();
  }
  if (!warnEl.isConnected) textarea.insertAdjacentElement("afterend", warnEl);
}
