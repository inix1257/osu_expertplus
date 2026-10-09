/**
 * Shared setup for the editor tests: a jsdom window with the legacy WS-02
 * sanitizer loaded, the old preview renderers extracted from the page
 * scripts, and a DOM canonicalizer for golden comparisons.
 */
import { loadScripts } from "../helpers/load-script.mjs";
import {
  LEGACY_DISCUSSION,
  LEGACY_BBCODE,
  legacySource,
} from "../osu/legacy.mjs";

/** @returns {{ window: any, document: Document, OsuExpertPlus: any }} */
export function setupWindow() {
  const { window, OsuExpertPlus } = loadScripts([
    "test/fixtures/legacy/html-sanitize.js",
  ]);
  return { window, document: window.document, OsuExpertPlus };
}

/**
 * Evaluate several legacy functions together (they call each other).
 * @param {string} file
 * @param {string[]} names
 * @param {string} entry  function to return
 * @param {Record<string, unknown>} deps  free variables
 */
function legacyGroup(file, names, entry, deps) {
  const keys = Object.keys(deps);
  const body = `"use strict";\n${names
    .map((n) => legacySource(file, n))
    .join("\n")}\nreturn ${entry};`;
  return new Function(...keys, body)(...keys.map((k) => deps[k]));
}

const OLD_BBCODE_FUNCTIONS = [
  "_escapePreviewHtml",
  "_unescapePreviewHtml",
  "_sanitizeEscapedPreviewUrl",
  "_sanitizeHttpPreviewUrl",
  "_matchNoticeOpenAt",
  "_matchNoticeCloseLen",
  "_findBbcodeNoticeCloseRange",
  "_matchBbcodeBoxOpenAt",
  "_matchBbcodeBoxCloseLen",
  "_findFirstBbcodeNestableOpen",
  "_findBbcodeBoxCloseRange",
  "_formatBbcodeBoxPreviewHtml",
  "_replaceBalancedBbcodeNestable",
  "_finishBbcodePreviewParagraphs",
  "_bbcodePreviewCore",
  "_renderSimpleBbcodePreviewHtml",
];

/**
 * The old user-profile BBCode renderer (HTML string).
 * @param {any} window jsdom window from setupWindow()
 * @returns {(src: string) => string}
 */
export function oldBbcodeRenderer(window) {
  return legacyGroup(
    LEGACY_BBCODE,
    OLD_BBCODE_FUNCTIONS,
    "_renderSimpleBbcodePreviewHtml",
    {
      OsuExpertPlus: window.OsuExpertPlus,
      location: window.location,
      BBHELP_PREVIEW_EMPTY_CLASS: "oep-bbhelp-preview__empty",
    },
  );
}

/**
 * The old beatmap-detail discussion markdown renderer (HTML string).
 * @param {any} window
 * @returns {(src: string) => string}
 */
export function oldMarkdownRenderer(window) {
  return legacyGroup(
    LEGACY_DISCUSSION,
    ["escapeHtml", "sanitizeHttpUrl", "renderMarkdownPreviewHtml"],
    "renderMarkdownPreviewHtml",
    { location: window.location },
  );
}

/**
 * What the page showed before WS-25: old renderer output through the WS-02
 * sanitizer.
 * @param {any} window
 * @param {(src: string) => string} oldRender
 * @param {string} src
 */
export function oldPipeline(window, oldRender, src) {
  return window.OsuExpertPlus.htmlSanitize.toSafeFragment(oldRender(src));
}

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "pre",
  "details",
  "summary",
]);
const INLINE_FORMAT_TAGS = new Set(["strong", "em", "u", "del", "span"]);

/**
 * Canonical string for a DOM subtree, for golden comparisons:
 * - attributes sorted by name;
 * - outside `<pre>`, whitespace runs collapse to one space, and whitespace
 *   at the start/end of a block element is dropped (how CSS renders it);
 * - empty `<p>` and empty inline formatting elements (strong, em, u, del,
 *   span) are dropped: the old string renderer produced stray ones from
 *   unbalanced markup (e.g. `<p></p>` after a block that ended inside a
 *   paragraph) and they render as nothing.
 * @param {Node} root  element or fragment (its children are serialized)
 * @returns {string}
 */
export function canon(root) {
  return serializeChildren(root, false, true);
}

function serializeChildren(parent, inPre, isBlock) {
  const parts = [];
  for (const child of Array.from(parent.childNodes)) {
    parts.push(...serializeNode(child, inPre));
  }
  // Merge text and trim at block boundaries.
  const out = [];
  for (const part of parts) {
    if (
      part.text !== undefined &&
      out.length &&
      out.at(-1).text !== undefined
    ) {
      out.at(-1).text += part.text;
    } else {
      out.push({ ...part });
    }
  }
  if (!inPre) {
    for (let i = 0; i < out.length; i += 1) {
      if (out[i].text === undefined) continue;
      let t = out[i].text.replace(/\s+/g, " ");
      const prev = out[i - 1];
      const next = out[i + 1];
      if (prev ? prev.block : isBlock) t = t.replace(/^ /, "");
      if (next ? next.block : isBlock) t = t.replace(/ $/, "");
      out[i].text = t;
    }
  }
  return out
    .map((p) => (p.text !== undefined ? escapeText(p.text) : p.html))
    .join("");
}

function serializeNode(node, inPre) {
  if (node.nodeType === 3) return [{ text: node.data }];
  if (node.nodeType !== 1) return [];
  const tag = node.localName;
  const childPre = inPre || tag === "pre";
  const inner = serializeChildren(node, childPre, BLOCK_TAGS.has(tag));
  if (!inner && (tag === "p" || INLINE_FORMAT_TAGS.has(tag))) return [];
  const attrs = Array.from(node.attributes)
    .map((a) => [a.name, a.value])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([n, v]) => ` ${n}="${escapeText(v).replace(/"/g, "&quot;")}"`)
    .join("");
  const html =
    tag === "br" || tag === "img"
      ? `<${tag}${attrs}>`
      : `<${tag}${attrs}>${inner}</${tag}>`;
  return [{ html, block: BLOCK_TAGS.has(tag) || tag === "br" }];
}

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Every element/attribute in `root` that breaks the preview's safety rules.
 * @param {Node} root
 * @returns {string[]} problems (empty when safe)
 */
export function safetyProblems(root) {
  const problems = [];
  const ALLOWED = new Set([
    "p",
    "br",
    "strong",
    "em",
    "u",
    "del",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "div",
    "span",
    "a",
    "img",
    "pre",
    "code",
    "ul",
    "ol",
    "li",
    "details",
    "summary",
  ]);
  const STYLE_DECL =
    /^(?:color:(?:#[0-9a-f]{3,8}|[a-z]{3,20})|font-size:(?:\d{1,3}(?:\.\d+)?%|\d(?:\.\d+)?em)|text-align:(?:left|center|right));$/i;
  const walk = (node) => {
    for (const el of Array.from(node.childNodes)) {
      if (el.nodeType === 8) problems.push("comment");
      if (el.nodeType !== 1) continue;
      const tag = el.localName;
      if (!ALLOWED.has(tag)) problems.push(`tag <${tag}>`);
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith("on")) problems.push(`${tag}[${name}]`);
        if (name === "href" || name === "src") {
          let ok;
          try {
            const u = new URL(attr.value);
            ok =
              (u.protocol === "http:" || u.protocol === "https:") &&
              u.href === attr.value;
          } catch (_) {
            ok = false;
          }
          if (!ok) problems.push(`${tag}[${name}=${attr.value}]`);
        }
        if (name === "style") {
          const decls = attr.value.match(/[^;]*;/g) || [];
          if (
            decls.join("") !== attr.value ||
            !decls.every((d) => STYLE_DECL.test(d))
          ) {
            problems.push(`${tag}[style=${attr.value}]`);
          }
        }
        if (
          ![
            "href",
            "src",
            "style",
            "class",
            "target",
            "rel",
            "alt",
            "loading",
            "referrerpolicy",
            "aria-hidden",
            "aria-label",
          ].includes(name)
        ) {
          problems.push(`${tag}[${name}]`);
        }
      }
      walk(el);
    }
  };
  walk(root);
  return problems;
}
