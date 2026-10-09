/**
 * Allowlist HTML sanitizer for the locally rendered previews: an ES module
 * port of the WS-02 `src/utils/html-sanitize.js`, which the pages used until
 * WS-30/WS-40 (now a frozen copy in test/fixtures/legacy/ for the golden
 * tests).
 *
 * The WS-25 renderers (`bbcode-render.js`, `markdown-render.js`) build DOM
 * nodes directly and never parse HTML, so for them this is a second line of
 * defence: `sanitizeTree(fragment)` must leave their output unchanged (the
 * tests check that). `toSafeFragment(html)` still accepts an HTML string for
 * callers that have one.
 *
 * Also home of the value validators the renderers share (`isSafeColor`,
 * `safeHttpUrl`, `absoluteHttpUrl`).
 */

const HTML_NS = "http://www.w3.org/1999/xhtml";
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Tags the preview renderers emit. Anything else is unwrapped. */
const ALLOWED_TAGS = new Set([
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

/** Tags removed together with their contents instead of unwrapped. */
const DROPPED_TAGS = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "textarea",
  "select",
]);

const STYLE_TAGS = new Set(["span", "div"]);

const CLASS_TOKEN_RE = /^oep-[\w-]+$/;
const COLOR_RE = /^(?:#[0-9a-f]{3,8}|[a-z]{3,20})$/i;
const FONT_SIZE_RE = /^(?:\d{1,3}(?:\.\d+)?%|\d(?:\.\d+)?em)$/;
const TEXT_ALIGN_VALUES = new Set(["left", "center", "right"]);
const UNSAFE_URL_CHARS_RE = /[<>"\s]/;
const ABSOLUTE_HTTP_RE = /^https?:\/\//i;
const DEFAULT_ORIGIN = "https://osu.ppy.sh";

/**
 * `#hex` (3–8 digits) or a colour name (`[a-z]{3,20}`).
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeColor(value) {
  return COLOR_RE.test(String(value || "").trim());
}

/**
 * Same check as the legacy sanitizer: no `< > "` or whitespace in the raw
 * value, and an http(s) URL once resolved against `base` (so relative URLs
 * pass). Used for attributes of parsed HTML.
 * @param {string} raw
 * @param {string} [base] defaults to the page origin
 * @returns {string} normalized http(s) URL, or "" when rejected
 */
export function safeHttpUrl(raw, base) {
  const value = String(raw ?? "");
  if (!value || UNSAFE_URL_CHARS_RE.test(value)) return "";
  try {
    const parsed = new URL(value, base ?? pageOrigin());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch (_) {
    return "";
  }
}

/**
 * URL check for renderer input (what the user typed): must start with
 * `http://` or `https://` (any case) after trimming, like osu-web's
 * BBCodeForDB `[url]` pattern. Relative, protocol-relative and other schemes
 * are rejected. Inner spaces are allowed and come back percent-encoded.
 * @param {string} raw
 * @returns {string} normalized absolute http(s) URL, or ""
 */
export function absoluteHttpUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!ABSOLUTE_HTTP_RE.test(value)) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch (_) {
    return "";
  }
}

function pageOrigin() {
  const origin = globalThis.location?.origin;
  return typeof origin === "string" && /^https?:/.test(origin)
    ? origin
    : DEFAULT_ORIGIN;
}

/**
 * Rebuild an inline style keeping only allowlisted, validated properties.
 * @param {string} styleText
 * @returns {string}
 */
export function sanitizeStyle(styleText) {
  const out = [];
  for (const decl of String(styleText || "").split(";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (prop === "color" && isSafeColor(value)) {
      out.push(`color:${value};`);
    } else if (prop === "font-size" && FONT_SIZE_RE.test(value)) {
      out.push(`font-size:${value};`);
    } else if (
      prop === "text-align" &&
      TEXT_ALIGN_VALUES.has(value.toLowerCase())
    ) {
      out.push(`text-align:${value};`);
    }
  }
  return out.join("");
}

/**
 * @param {Element} node
 * @param {string} [base]
 * @returns {boolean} false when the element must be removed/unwrapped
 */
function sanitizeAttributes(node, base) {
  const tag = node.localName;
  const attrs = new Map();
  for (const attr of Array.from(node.attributes)) {
    attrs.set(attr.name.toLowerCase(), attr.value);
    node.removeAttribute(attr.name);
  }

  const classes = String(attrs.get("class") || "")
    .split(/\s+/)
    .filter((t) => CLASS_TOKEN_RE.test(t));
  if (classes.length) node.setAttribute("class", classes.join(" "));

  if (attrs.get("aria-hidden") === "true") {
    node.setAttribute("aria-hidden", "true");
  }
  if (attrs.has("aria-label")) {
    node.setAttribute("aria-label", attrs.get("aria-label"));
  }

  if (STYLE_TAGS.has(tag) && attrs.has("style")) {
    const style = sanitizeStyle(attrs.get("style"));
    if (style) node.setAttribute("style", style);
  }

  if (tag === "a") {
    const href = safeHttpUrl(attrs.get("href"), base);
    if (!href) return false;
    node.setAttribute("href", href);
    if (attrs.get("target") === "_blank") {
      node.setAttribute("target", "_blank");
    }
    node.setAttribute("rel", "noopener noreferrer");
  } else if (tag === "img") {
    const src = safeHttpUrl(attrs.get("src"), base);
    if (!src) return false;
    node.setAttribute("src", src);
    if (attrs.has("alt")) node.setAttribute("alt", attrs.get("alt"));
    node.setAttribute("loading", "lazy");
    node.setAttribute("referrerpolicy", "no-referrer");
  }
  return true;
}

/**
 * @param {Node} parent
 * @param {string} [base]
 */
function sanitizeChildren(parent, base) {
  for (const child of Array.from(parent.childNodes)) sanitizeNode(child, base);
}

/**
 * @param {Node} node
 * @param {string} [base]
 */
function sanitizeNode(node, base) {
  if (node.nodeType === TEXT_NODE) return;
  if (node.nodeType !== ELEMENT_NODE) {
    node.remove();
    return;
  }
  const el = /** @type {Element} */ (node);
  const tag = el.localName;
  const isHtml = el.namespaceURI === HTML_NS;
  if (DROPPED_TAGS.has(tag) || (!isHtml && !ALLOWED_TAGS.has(tag))) {
    el.remove();
    return;
  }
  if (!isHtml || !ALLOWED_TAGS.has(tag)) {
    sanitizeChildren(el, base);
    el.replaceWith(...Array.from(el.childNodes));
    return;
  }
  if (!sanitizeAttributes(el, base)) {
    if (tag === "img") {
      el.remove();
    } else {
      sanitizeChildren(el, base);
      el.replaceWith(...Array.from(el.childNodes));
    }
    return;
  }
  sanitizeChildren(el, base);
}

/**
 * Sanitize the children of `root` (an element or fragment) in place. `root`
 * itself is kept as it is.
 * @template {Node} T
 * @param {T} root
 * @param {{ base?: string }} [options] base URL for relative href/src
 * @returns {T}
 */
export function sanitizeTree(root, options = {}) {
  sanitizeChildren(root, options.base);
  return root;
}

/**
 * Parse renderer output in an inert template and return only allowlisted
 * markup. Use with `target.replaceChildren(toSafeFragment(html))`.
 * @param {string} html
 * @param {{ document?: Document, base?: string }} [options]
 * @returns {DocumentFragment}
 */
export function toSafeFragment(html, options = {}) {
  const doc = options.document ?? globalThis.document;
  const tpl = doc.createElement("template");
  tpl.innerHTML = String(html ?? "");
  const frag = tpl.content;
  sanitizeChildren(frag, options.base);
  return doc.importNode(frag, true);
}
