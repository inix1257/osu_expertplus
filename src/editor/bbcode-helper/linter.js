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

/**
 * The first BBCode structure problem in `text`, as a sentence, or null.
 * Only known tags count (B46): unknown or malformed bracket text (`[#1]`,
 * `[2024]`, `[ ]`, a lone `[` or `]`) is plain text for osu-web and is not
 * reported, and `[code]…[/code]` content is not checked.
 * @param {string} text
 * @returns {string | null}
 */
export function firstBbcodeFormatIssue(text) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  /** @type {string[]} */
  const stack = [];
  let i = 0;
  while (i < value.length) {
    const open = value.indexOf("[", i);
    if (open === -1) break;
    const close = value.indexOf("]", open + 1);
    const nextOpen = value.indexOf("[", open + 1);
    if (close === -1 || (nextOpen !== -1 && nextOpen < close)) {
      // A "[" without its own "]" is text, unless the text ends in what
      // looks like a known tag that lost its bracket (`[b`, `[color=red`).
      if (close === -1) {
        const m = /^\[\/?([a-z*]+)(?:=\S*)?$/i.exec(value.slice(open));
        if (m && KNOWN_BBCODE_TAGS.has(m[1].toLowerCase())) {
          return "Missing closing bracket `]` for a BBCode tag.";
        }
      }
      i = open + 1;
      continue;
    }
    const rawTag = value.slice(open + 1, close).trim();
    const name = parseBbcodeTagName(rawTag);
    i = close + 1;
    if (!KNOWN_BBCODE_TAGS.has(name)) continue;
    const isClosing = rawTag.startsWith("/");
    if (name === "*") continue; // list items need no closing tag
    if (!isClosing) {
      if (name === "code") {
        const end = lower.indexOf("[/code]", i);
        if (end === -1) return "Unclosed tag `[code]` found.";
        i = end + "[/code]".length;
        continue;
      }
      stack.push(name);
      continue;
    }
    const expected = stack[stack.length - 1];
    if (!expected) {
      return `Closing tag \`[/${name}]\` has no matching opening tag.`;
    }
    if (expected !== name) {
      return `Mismatched tag order: expected \`[/${expected}]\` before \`[/${name}]\`.`;
    }
    stack.pop();
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
