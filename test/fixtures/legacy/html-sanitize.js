/*
 * Frozen copy of src/utils/html-sanitize.js (WS-02), which the pages used
 * until WS-30/WS-40 switched to src/editor/sanitize.js (snapshot of e2c81bf).
 * Loaded by test/editor/helpers.mjs for the old-pipeline golden tests. Not
 * loaded by the userscript; do not edit.
 */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.htmlSanitize = (() => {
  const HTML_NS = "http://www.w3.org/1999/xhtml";

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

  /**
   * @param {string} value
   * @returns {boolean}
   */
  function isSafeColor(value) {
    return COLOR_RE.test(String(value || "").trim());
  }

  /**
   * @param {string} raw
   * @returns {string} normalized http(s) URL, or "" when rejected
   */
  function safeHttpUrl(raw) {
    const value = String(raw ?? "");
    if (!value || UNSAFE_URL_CHARS_RE.test(value)) return "";
    try {
      const parsed = new URL(value, location.origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  /**
   * Rebuild an inline style keeping only allowlisted, validated properties.
   * @param {string} styleText
   * @returns {string}
   */
  function sanitizeStyle(styleText) {
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
   * @returns {boolean} false when the element must be removed/unwrapped
   */
  function sanitizeAttributes(node) {
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
      const href = safeHttpUrl(attrs.get("href"));
      if (!href) return false;
      node.setAttribute("href", href);
      if (attrs.get("target") === "_blank") {
        node.setAttribute("target", "_blank");
      }
      node.setAttribute("rel", "noopener noreferrer");
    } else if (tag === "img") {
      const src = safeHttpUrl(attrs.get("src"));
      if (!src) return false;
      node.setAttribute("src", src);
      if (attrs.has("alt")) node.setAttribute("alt", attrs.get("alt"));
      node.setAttribute("loading", "lazy");
      node.setAttribute("referrerpolicy", "no-referrer");
    }
    return true;
  }

  /** @param {Node} parent */
  function sanitizeChildren(parent) {
    for (const child of Array.from(parent.childNodes)) sanitizeNode(child);
  }

  /** @param {Node} node */
  function sanitizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }
    const tag = node.localName;
    const isHtml = node.namespaceURI === HTML_NS;
    if (DROPPED_TAGS.has(tag) || (!isHtml && !ALLOWED_TAGS.has(tag))) {
      node.remove();
      return;
    }
    if (!isHtml || !ALLOWED_TAGS.has(tag)) {
      sanitizeChildren(node);
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }
    if (!sanitizeAttributes(node)) {
      if (tag === "img") {
        node.remove();
      } else {
        sanitizeChildren(node);
        node.replaceWith(...Array.from(node.childNodes));
      }
      return;
    }
    sanitizeChildren(node);
  }

  /**
   * Parse renderer output in an inert template and return only allowlisted
   * markup. Use with `target.replaceChildren(toSafeFragment(html))`.
   * @param {string} html
   * @returns {DocumentFragment}
   */
  function toSafeFragment(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html ?? "");
    const frag = tpl.content;
    sanitizeChildren(frag);
    return document.importNode(frag, true);
  }

  return { toSafeFragment, isSafeColor, safeHttpUrl };
})();
