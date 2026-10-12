// ==UserScript==
// @name         osu! Expert+
// @namespace    https://github.com/inix1257/osu_expertplus
// @version      0.3.3
// @description  Adds extra QoL features to osu.ppy.sh
// @author       inix1257
// @homepageURL  https://github.com/inix1257/osu_expertplus
// @supportURL   https://github.com/inix1257/osu_expertplus/issues
// @downloadURL  https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js
// @updateURL    https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js
// @match        https://osu.ppy.sh/*
// @connect      omdb.nyahh.net
// @connect      assets.ppy.sh
// @connect      api.kirino.sh
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

'use strict';

(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/api/kirino.js
  var kirino_exports = {};
  __export(kirino_exports, {
    INSPECTOR_PROFILE_URL: () => INSPECTOR_PROFILE_URL,
    TIMEOUT_MS: () => TIMEOUT_MS,
    fetchInspectorProfile: () => fetchInspectorProfile,
    modeIndexForRuleset: () => modeIndexForRuleset
  });
  var INSPECTOR_PROFILE_URL = "https://api.kirino.sh/inspector/extension/profile";
  var TIMEOUT_MS = 1e4;
  var MODE_INDEX = Object.freeze({ osu: 0, taiko: 1, fruits: 2, mania: 3 });
  function modeIndexForRuleset(ruleset) {
    const n = MODE_INDEX[ruleset];
    return typeof n === "number" ? n : 0;
  }
  function withTimeout(signal, ms) {
    const timeout = AbortSignal.timeout(ms);
    if (!signal) return timeout;
    if (typeof AbortSignal.any === "function") {
      return AbortSignal.any([signal, timeout]);
    }
    const ac = new AbortController();
    const abort = () => ac.abort();
    signal.addEventListener("abort", abort, { once: true });
    timeout.addEventListener("abort", abort, { once: true });
    if (signal.aborted) ac.abort();
    return ac.signal;
  }
  async function fetchInspectorProfile(userId, modeIndex, username = "", options = {}) {
    const init4 = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: String(userId),
        mode: modeIndex,
        username: String(username || "")
      }),
      signal: withTimeout(options.signal, options.timeoutMs ?? TIMEOUT_MS)
    };
    const resp = await (options.fetchImpl ? options.fetchImpl(INSPECTOR_PROFILE_URL, init4) : fetch(INSPECTOR_PROFILE_URL, init4));
    if (!resp.ok) {
      throw new Error(
        `[osu! Expert+] Kirino inspector ${resp.status}: ${INSPECTOR_PROFILE_URL}`
      );
    }
    return resp.json();
  }

  // src/editor/index.js
  var editor_exports = {};
  __export(editor_exports, {
    BBCODE_MAX_DEPTH: () => BBCODE_MAX_DEPTH,
    absoluteHttpUrl: () => absoluteHttpUrl,
    findBbcodeCancelButton: () => findBbcodeCancelButton,
    isBbcodeColor: () => isBbcodeColor,
    isSafeColor: () => isSafeColor,
    parseBbcode: () => parseBbcode,
    placeBbcodePreviewToggle: () => placeBbcodePreviewToggle,
    placeDiscussionPreviewToggle: () => placeDiscussionPreviewToggle,
    renderBbcode: () => renderBbcode,
    renderMarkdown: () => renderMarkdown,
    replaceRange: () => replaceRange,
    safeHttpUrl: () => safeHttpUrl,
    sanitizeStyle: () => sanitizeStyle,
    sanitizeTree: () => sanitizeTree,
    toSafeFragment: () => toSafeFragment,
    toggleWrap: () => toggleWrap
  });

  // src/editor/sanitize.js
  var HTML_NS = "http://www.w3.org/1999/xhtml";
  var ELEMENT_NODE = 1;
  var TEXT_NODE = 3;
  var ALLOWED_TAGS = /* @__PURE__ */ new Set([
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
    "summary"
  ]);
  var DROPPED_TAGS = /* @__PURE__ */ new Set([
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
    "select"
  ]);
  var STYLE_TAGS = /* @__PURE__ */ new Set(["span", "div"]);
  var CLASS_TOKEN_RE = /^oep-[\w-]+$/;
  var COLOR_RE = /^(?:#[0-9a-f]{3,8}|[a-z]{3,20})$/i;
  var FONT_SIZE_RE = /^(?:\d{1,3}(?:\.\d+)?%|\d(?:\.\d+)?em)$/;
  var TEXT_ALIGN_VALUES = /* @__PURE__ */ new Set(["left", "center", "right"]);
  var UNSAFE_URL_CHARS_RE = /[<>"\s]/;
  var ABSOLUTE_HTTP_RE = /^https?:\/\//i;
  var DEFAULT_ORIGIN = "https://osu.ppy.sh";
  function isSafeColor(value) {
    return COLOR_RE.test(String(value || "").trim());
  }
  function safeHttpUrl(raw, base) {
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
  function absoluteHttpUrl(raw) {
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
    return typeof origin === "string" && /^https?:/.test(origin) ? origin : DEFAULT_ORIGIN;
  }
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
      } else if (prop === "text-align" && TEXT_ALIGN_VALUES.has(value.toLowerCase())) {
        out.push(`text-align:${value};`);
      }
    }
    return out.join("");
  }
  function sanitizeAttributes(node, base) {
    const tag = node.localName;
    const attrs = /* @__PURE__ */ new Map();
    for (const attr of Array.from(node.attributes)) {
      attrs.set(attr.name.toLowerCase(), attr.value);
      node.removeAttribute(attr.name);
    }
    const classes = String(attrs.get("class") || "").split(/\s+/).filter((t) => CLASS_TOKEN_RE.test(t));
    if (classes.length) node.setAttribute("class", classes.join(" "));
    if (attrs.get("aria-hidden") === "true") {
      node.setAttribute("aria-hidden", "true");
    }
    if (attrs.has("aria-label")) {
      node.setAttribute("aria-label", attrs.get("aria-label"));
    }
    if (STYLE_TAGS.has(tag) && attrs.has("style")) {
      const style2 = sanitizeStyle(attrs.get("style"));
      if (style2) node.setAttribute("style", style2);
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
  function sanitizeChildren(parent, base) {
    for (const child of Array.from(parent.childNodes)) sanitizeNode(child, base);
  }
  function sanitizeNode(node, base) {
    if (node.nodeType === TEXT_NODE) return;
    if (node.nodeType !== ELEMENT_NODE) {
      node.remove();
      return;
    }
    const el2 = (
      /** @type {Element} */
      node
    );
    const tag = el2.localName;
    const isHtml = el2.namespaceURI === HTML_NS;
    if (DROPPED_TAGS.has(tag) || !isHtml && !ALLOWED_TAGS.has(tag)) {
      el2.remove();
      return;
    }
    if (!isHtml || !ALLOWED_TAGS.has(tag)) {
      sanitizeChildren(el2, base);
      el2.replaceWith(...Array.from(el2.childNodes));
      return;
    }
    if (!sanitizeAttributes(el2, base)) {
      if (tag === "img") {
        el2.remove();
      } else {
        sanitizeChildren(el2, base);
        el2.replaceWith(...Array.from(el2.childNodes));
      }
      return;
    }
    sanitizeChildren(el2, base);
  }
  function sanitizeTree(root, options = {}) {
    sanitizeChildren(root, options.base);
    return root;
  }
  function toSafeFragment(html, options = {}) {
    const doc = options.document ?? globalThis.document;
    const tpl = doc.createElement("template");
    tpl.innerHTML = String(html ?? "");
    const frag = tpl.content;
    sanitizeChildren(frag, options.base);
    return doc.importNode(frag, true);
  }

  // src/editor/bbcode-render.js
  var BBCODE_MAX_DEPTH = 64;
  var MAX_PARAM_LENGTH = 2048;
  var MAX_NAME_LENGTH = 10;
  var OSU_ORIGIN = "https://osu.ppy.sh";
  var INLINE = "inline";
  var BLOCK = "block";
  var CONTAINER = "container";
  var RAW = "raw";
  var ITEM = "item";
  var TAGS = {
    b: { kind: INLINE, param: "none" },
    i: { kind: INLINE, param: "none" },
    u: { kind: INLINE, param: "none" },
    s: { kind: INLINE, param: "none" },
    strike: { kind: INLINE, param: "none" },
    c: { kind: INLINE, param: "none" },
    color: { kind: INLINE, param: "required" },
    size: { kind: INLINE, param: "required" },
    url: { kind: INLINE, param: "optional", rawWithoutParam: true },
    centre: { kind: BLOCK, param: "none" },
    left: { kind: BLOCK, param: "none" },
    right: { kind: BLOCK, param: "none" },
    heading: { kind: BLOCK, param: "none" },
    quote: { kind: BLOCK, param: "optional" },
    list: { kind: BLOCK, param: "optional" },
    "*": { kind: ITEM, param: "none" },
    box: { kind: CONTAINER, param: "optional" },
    spoilerbox: { kind: CONTAINER, param: "optional" },
    spoiler: { kind: CONTAINER, param: "optional" },
    notice: { kind: CONTAINER, param: "none" },
    code: { kind: RAW, param: "none" },
    img: { kind: RAW, param: "none" },
    imagemap: { kind: RAW, param: "optional" },
    youtube: { kind: RAW, param: "none" },
    audio: { kind: RAW, param: "none" },
    profile: { kind: RAW, param: "optional" },
    email: { kind: RAW, param: "optional" }
  };
  var PARAM_RE = {
    color: /^(?:#[0-9A-Fa-f]{6}|[A-Za-z]+)$/,
    size: /^\d+$/
  };
  function isBbcodeColor(value) {
    return PARAM_RE.color.test(String(value));
  }
  var ALIGN = { centre: "center", left: "left", right: "right" };
  var IMAGEMAP_BODY_IMAGE_RE = /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i;
  var EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z-]+$/;
  var YOUTUBE_PREFIX_RE = /^(?:https?:\/\/(?:youtu\.be\/|(?:m\.|www\.|)youtube\.com\/(?:embed\/|shorts\/|watch\?v=)))?/i;
  var YOUTUBE_ID_RE = /^[\w-]{1,64}$/;
  var QUOTE_NAME_RE = /^"(.+)"$/;
  var PARSE_CONTENT = /* @__PURE__ */ Symbol("parse-content");
  function createFinder(haystack) {
    const memo = /* @__PURE__ */ new Map();
    return (needle, from) => {
      const hit = memo.get(needle);
      if (hit && hit.from <= from && (hit.at < 0 || hit.at >= from)) {
        return hit.at;
      }
      const at = haystack.indexOf(needle, from);
      memo.set(needle, { from, at });
      return at;
    };
  }
  function scanTag(src, i, find) {
    let j = i + 1;
    let close = false;
    if (src[j] === "/") {
      close = true;
      j += 1;
    }
    let k = j;
    while (k < src.length && k - j <= MAX_NAME_LENGTH) {
      const c = src.charCodeAt(k);
      const isName = c >= 97 && c <= 122 || c >= 65 && c <= 90 || c === 42;
      if (!isName) break;
      k += 1;
    }
    if (k === j || k - j > MAX_NAME_LENGTH) return null;
    const name = src.slice(j, k);
    const def = Object.hasOwn(TAGS, name) ? TAGS[name] : null;
    if (!def) return null;
    const next = src[k];
    if (next === "]") {
      if (!close && def.param === "required") return null;
      return { name, close, param: null, paren: false, end: k + 1 };
    }
    if (close || def.param === "none") return null;
    if (next !== "=" && !(next === "(" && name === "imagemap")) return null;
    const rb = find("]", k + 1);
    if (rb < 0 || rb - k - 1 > MAX_PARAM_LENGTH) return null;
    const lb = find("[", k + 1);
    if (lb >= 0 && lb < rb) return null;
    const nl = find("\n", k + 1);
    if (nl >= 0 && nl < rb) return null;
    if (next === "=" && Object.hasOwn(PARAM_RE, name) && !PARAM_RE[name].test(src.slice(k + 1, rb))) {
      return null;
    }
    if (next === "(") {
      const rp = find(")", k + 1);
      if (rp !== rb - 1 || rp === k + 1) return null;
      return {
        name,
        close,
        param: src.slice(k + 1, rp),
        paren: true,
        end: rb + 1
      };
    }
    return {
      name,
      close,
      param: src.slice(k + 1, rb),
      paren: false,
      end: rb + 1
    };
  }
  function makeRaw(name, tag, content) {
    switch (name) {
      case "code": {
        let from = 0;
        let to = content.length;
        while (from < to && content[from] === "\n") from += 1;
        while (to > from && content[to - 1] === "\n") to -= 1;
        return { type: "raw", name, text: content.slice(from, to) };
      }
      case "img": {
        const src = absoluteHttpUrl(content);
        return src ? { type: "raw", name, src } : null;
      }
      case "url": {
        const href = absoluteHttpUrl(content);
        return href ? { type: "raw", name, href, text: content.trim() } : PARSE_CONTENT;
      }
      case "imagemap": {
        let candidate = tag.param;
        if (candidate === null) {
          const m = IMAGEMAP_BODY_IMAGE_RE.exec(content.slice(0, 4096));
          candidate = m ? m[0] : "";
        }
        const src = absoluteHttpUrl(candidate);
        return src ? { type: "raw", name, src } : null;
      }
      case "youtube": {
        const id = content.trim().replace(YOUTUBE_PREFIX_RE, "").replace(/[?&].*$/, "");
        if (!YOUTUBE_ID_RE.test(id)) return void 0;
        return {
          type: "raw",
          name,
          href: `https://www.youtube.com/watch?v=${id}`,
          text: `YouTube: ${id}`
        };
      }
      case "audio": {
        const href = absoluteHttpUrl(content);
        return href ? { type: "raw", name, href, text: content.trim() } : void 0;
      }
      case "profile": {
        const username = content.trim();
        if (!username) return void 0;
        if (tag.param !== null && !/^\d{1,12}$/.test(tag.param)) return void 0;
        const target = tag.param !== null ? tag.param : `@${encodeURIComponent(username)}`;
        return {
          type: "raw",
          name,
          href: `${OSU_ORIGIN}/users/${target}`,
          text: username
        };
      }
      case "email": {
        const address = tag.param ?? content;
        if (!EMAIL_RE.test(address) || !content) return void 0;
        return { type: "raw", name, text: content };
      }
      default:
        return void 0;
    }
  }
  function tokenize(src) {
    const find = createFinder(src);
    const tokens = [];
    let pos = 0;
    while (pos < src.length) {
      const lb = src.indexOf("[", pos);
      if (lb < 0) break;
      const tag = scanTag(src, lb, find);
      if (!tag) {
        pos = lb + 1;
        continue;
      }
      pos = tag.end;
      const base = {
        name: tag.name,
        param: tag.param,
        lb,
        end: tag.end,
        open: src.slice(lb, tag.end)
      };
      if (tag.close) {
        tokens.push({ ...base, kind: tag.name === "*" ? "itemClose" : "close" });
        continue;
      }
      const def = TAGS[tag.name];
      if (def.kind === RAW || def.rawWithoutParam && tag.param === null) {
        const closeText = `[/${tag.name}]`;
        const q = find(closeText, tag.end);
        if (q < 0) continue;
        const node = makeRaw(tag.name, tag, src.slice(tag.end, q));
        if (node === void 0) continue;
        if (node === PARSE_CONTENT) {
          tokens.push({ ...base, kind: "open", plain: true });
          continue;
        }
        tokens.push({ ...base, kind: "raw", node, end: q + closeText.length });
        pos = q + closeText.length;
        continue;
      }
      if (tag.name === "quote" && tag.param !== null) {
        if (!QUOTE_NAME_RE.test(tag.param)) continue;
      }
      tokens.push({ ...base, kind: def.kind === ITEM ? "item" : "open" });
    }
    return tokens;
  }
  function matchTokens(tokens) {
    const open = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      if (token.kind === "open") {
        const list = open.get(token.name);
        if (list) list.push(token);
        else open.set(token.name, [token]);
      } else if (token.kind === "close") {
        const partner = open.get(token.name)?.pop();
        if (partner) partner.matched = true;
      }
    }
  }
  function parseBbcode(source) {
    const src = String(source ?? "").replace(/\r\n?/g, "\n");
    const tokens = tokenize(src);
    matchTokens(tokens);
    const root = { type: "root", children: [] };
    const stack = [root];
    let textStart = 0;
    const top = () => stack[stack.length - 1];
    const flushText = (end) => {
      if (end > textStart) top().children.push(src.slice(textStart, end));
    };
    const literalize = (frame) => {
      frame.type = "literal";
    };
    const push = (token) => {
      const frame = {
        type: "tag",
        name: token.name,
        param: token.param,
        open: token.open,
        children: []
      };
      if (token.plain) frame.plain = true;
      top().children.push(frame);
      stack.push(frame);
    };
    const apply = (token) => {
      switch (token.kind) {
        case "raw":
          flushText(token.lb);
          if (token.node) top().children.push(token.node);
          return true;
        case "open":
          if (!token.matched || stack.length > BBCODE_MAX_DEPTH) return false;
          flushText(token.lb);
          push(token);
          return true;
        case "item": {
          let k = stack.length - 1;
          while (k > 0) {
            const name = (
              /** @type {string} */
              stack[k].name
            );
            if (name === "list" || name === "*") break;
            if (TAGS[name].kind !== INLINE) return false;
            k -= 1;
          }
          if (k === 0) return false;
          const depth = stack[k].name === "*" ? k : k + 1;
          if (depth > BBCODE_MAX_DEPTH) return false;
          flushText(token.lb);
          while (stack.length - 1 > k) literalize(stack.pop());
          if (top().name === "*") stack.pop();
          push(token);
          return true;
        }
        case "itemClose":
          if (top().name !== "*") return false;
          flushText(token.lb);
          stack.pop();
          return true;
        default: {
          let k = stack.length - 1;
          while (k > 0 && stack[k].name !== token.name) k -= 1;
          if (k === 0) return false;
          flushText(token.lb);
          while (stack.length - 1 > k) {
            const frame = (
              /** @type {Frame} */
              stack.pop()
            );
            if (!(frame.name === "*" && token.name === "list")) {
              literalize(frame);
            }
          }
          stack.pop();
          return true;
        }
      }
    };
    for (const token of tokens) {
      if (apply(token)) textStart = token.end;
    }
    flushText(src.length);
    while (stack.length > 1) literalize(stack.pop());
    return root;
  }
  var Flow = class {
    /**
     * @param {Document} doc
     * @param {Element | DocumentFragment} root
     */
    constructor(doc, root) {
      this.doc = doc;
      this.blocks = [root];
      this.inline = [];
      this.p = null;
      this.segStart = true;
      this.pMode = true;
      this.pending = [];
    }
    get block() {
      return this.blocks[this.blocks.length - 1];
    }
    /** Content arrives: decide the paragraph mode or flush pending space. */
    begin(isBlock) {
      if (this.segStart) {
        this.segStart = false;
        this.pMode = !isBlock;
        this.pending.length = 0;
      } else {
        this.flushPending();
      }
    }
    flushPending() {
      if (!this.pending.length) return;
      const items = this.pending;
      this.pending = [];
      for (const item of items) {
        if (item === "\n")
          this.target().appendChild(this.doc.createElement("br"));
        else this.appendText(item);
      }
    }
    /** Close the open `<p>`; inline elements are re-created where needed. */
    closeP() {
      this.p = null;
      for (const frame of this.inline) frame.el = null;
    }
    /** Where inline content goes now (creates `<p>` and inline shells). */
    target() {
      let base = this.block;
      if (this.pMode) {
        if (!this.p) {
          this.p = this.doc.createElement("p");
          base.appendChild(this.p);
        }
        base = this.p;
      }
      for (const frame of this.inline) {
        if (!frame.el) {
          frame.el = frame.make();
          base.appendChild(frame.el);
        }
        base = frame.el;
      }
      return base;
    }
    appendText(s) {
      const t = this.target();
      const last = t.lastChild;
      if (last && last.nodeType === 3) last.data += s;
      else t.appendChild(this.doc.createTextNode(s));
    }
    /** @param {string} str text that may contain newlines */
    text(str) {
      const re = /\n+/g;
      let from = 0;
      let m;
      while (m = re.exec(str)) {
        this.word(str.slice(from, m.index));
        if (m[0].length > 1) this.paraBreak();
        else if (!this.segStart) this.pending.push("\n");
        from = re.lastIndex;
      }
      this.word(str.slice(from));
    }
    /** @param {string} s text without newlines */
    word(s) {
      if (!s) return;
      if (this.segStart) {
        s = s.trimStart();
        if (!s) return;
      }
      const core = s.trimEnd();
      if (core) {
        this.begin(false);
        this.appendText(core);
      }
      if (core.length < s.length) this.pending.push(s.slice(core.length));
    }
    paraBreak() {
      this.pending.length = 0;
      this.closeP();
      this.segStart = true;
      this.pMode = true;
    }
    /** @param {() => Element} make */
    openInline(make) {
      this.begin(false);
      this.inline.push({ make, el: null });
    }
    closeInline() {
      if (!this.segStart) this.flushPending();
      this.inline.pop();
    }
    /** @param {Element} el */
    openBlock(el2) {
      this.begin(true);
      this.closeP();
      this.pMode = false;
      this.block.appendChild(el2);
      this.blocks.push(el2);
    }
    closeBlock() {
      if (this.segStart) this.segStart = false;
      else this.flushPending();
      this.closeP();
      this.pMode = false;
      this.blocks.pop();
    }
    /**
     * @param {Element} el
     * @param {boolean} isBlock
     */
    atom(el2, isBlock) {
      if (isBlock) {
        this.begin(true);
        this.closeP();
        this.pMode = false;
        this.block.appendChild(el2);
      } else {
        this.begin(false);
        this.target().appendChild(el2);
      }
    }
    end() {
      this.pending.length = 0;
      this.closeP();
    }
  };
  function h(doc, tag, attrs, text) {
    const el2 = doc.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) el2.setAttribute(k, v);
    if (text !== void 0) el2.textContent = text;
    return el2;
  }
  function linkAttrs(href) {
    return { href, target: "_blank", rel: "noopener noreferrer" };
  }
  function sizeValue(raw) {
    const pct = Number(raw);
    return Number.isFinite(pct) ? `${Math.max(30, Math.min(200, pct))}%` : "1em";
  }
  function trimItem(children) {
    const out = children.slice();
    while (out.length && typeof out[0] === "string" && !out[0].trim()) {
      out.shift();
    }
    if (typeof out[0] === "string") out[0] = out[0].trimStart();
    while (out.length && typeof out[out.length - 1] === "string" && !out[out.length - 1].trim()) {
      out.pop();
    }
    const last = out.length - 1;
    if (typeof out[last] === "string") out[last] = out[last].trimEnd();
    return out;
  }
  function listItems(list) {
    const items = [];
    const loose = [];
    for (const child of list.children) {
      if (typeof child !== "string" && child.type === "tag" && child.name === "*") {
        items.push(child.children);
      } else if (items.length === 0) {
        loose.push(child);
      } else {
        items[items.length - 1].push(child);
      }
    }
    if (loose.length) items.unshift(loose);
    return items.map(trimItem).filter((item) => item.length > 0);
  }
  var Renderer = class {
    /** @param {Document} doc */
    constructor(doc) {
      this.doc = doc;
    }
    /**
     * @param {Array<string | Node_>} children
     * @param {Flow} flow
     */
    nodes(children, flow) {
      for (const child of children) this.node(child, flow);
    }
    /**
     * @param {string | Node_} node
     * @param {Flow} flow
     */
    node(node, flow) {
      if (typeof node === "string") {
        flow.text(node);
        return;
      }
      if (node.type === "raw") {
        this.raw(node, flow);
        return;
      }
      if (node.type === "literal") {
        flow.text(node.open);
        this.nodes(node.children, flow);
        return;
      }
      this.tag(node, flow);
    }
    /** Render `children` into a fresh flow rooted at `el`. */
    container(el2, children) {
      const flow = new Flow(this.doc, el2);
      this.nodes(children, flow);
      flow.end();
    }
    /**
     * @param {Frame} node
     * @param {Flow} flow
     */
    tag(node, flow) {
      const doc = this.doc;
      const name = (
        /** @type {string} */
        node.name
      );
      const inline = (make) => {
        flow.openInline(make);
        this.nodes(node.children, flow);
        flow.closeInline();
      };
      const block = (el2) => {
        flow.openBlock(el2);
        this.nodes(node.children, flow);
        flow.closeBlock();
      };
      switch (name) {
        case "b":
          return inline(() => h(doc, "strong"));
        case "i":
          return inline(() => h(doc, "em"));
        case "u":
          return inline(() => h(doc, "u"));
        case "s":
        case "strike":
          return inline(() => h(doc, "del"));
        case "c":
          return inline(() => h(doc, "code"));
        case "color": {
          const color = String(node.param || "").trim();
          return inline(
            () => isSafeColor(color) ? h(doc, "span", { style: `color:${color};` }) : h(doc, "span")
          );
        }
        case "size": {
          const size = sizeValue(node.param);
          return inline(() => h(doc, "span", { style: `font-size:${size};` }));
        }
        case "url": {
          const href = node.plain ? "" : absoluteHttpUrl(node.param);
          if (!href) {
            this.nodes(node.children, flow);
            return;
          }
          return inline(() => h(doc, "a", linkAttrs(href)));
        }
        case "centre":
        case "left":
        case "right":
          return block(h(doc, "div", { style: `text-align:${ALIGN[name]};` }));
        case "heading":
          return block(h(doc, "h3"));
        case "quote": {
          const el2 = h(doc, "blockquote");
          flow.openBlock(el2);
          const m = node.param ? QUOTE_NAME_RE.exec(node.param) : null;
          if (m) flow.atom(h(doc, "h4", void 0, `${m[1]} wrote:`), true);
          this.nodes(node.children, flow);
          flow.closeBlock();
          return;
        }
        case "list": {
          const items = listItems(node);
          if (!items.length) return;
          flow.openBlock(h(doc, node.param !== null ? "ol" : "ul"));
          for (const item of items) {
            flow.openBlock(h(doc, "li"));
            this.nodes(item, flow);
            flow.closeBlock();
          }
          flow.closeBlock();
          return;
        }
        case "*":
          flow.text(String(node.open));
          this.nodes(node.children, flow);
          return;
        case "notice": {
          const el2 = h(doc, "div", { class: "oep-bbhelp-preview__notice" });
          this.container(el2, node.children);
          flow.atom(el2, true);
          return;
        }
        case "box":
        case "spoilerbox":
        case "spoiler": {
          flow.atom(this.box(name, node), true);
          return;
        }
        default:
          this.nodes(node.children, flow);
      }
    }
    /** @param {Frame} node */
    box(name, node) {
      const doc = this.doc;
      const title = String(node.param ?? "").trim();
      const label = name === "box" ? title || "Box" : title;
      const summary = h(doc, "summary", {
        class: label ? "oep-bbhelp-preview__spoiler-summary" : "oep-bbhelp-preview__spoiler-summary oep-bbhelp-preview__spoiler-summary--icon-only"
      });
      if (!label) summary.setAttribute("aria-label", "Spoiler");
      summary.appendChild(
        h(doc, "span", {
          class: "oep-bbhelp-preview__spoiler-icon",
          "aria-hidden": "true"
        })
      );
      if (label) {
        summary.appendChild(
          h(doc, "span", { class: "oep-bbhelp-preview__spoiler-label" }, label)
        );
      }
      const body = h(doc, "div", { class: "oep-bbhelp-preview__spoiler-body" });
      this.container(body, node.children);
      const details = h(doc, "details", {
        class: "oep-bbhelp-preview__spoilerbox"
      });
      details.append(summary, body);
      return details;
    }
    /**
     * @param {RawNode} node
     * @param {Flow} flow
     */
    raw(node, flow) {
      const doc = this.doc;
      switch (node.name) {
        case "code": {
          const pre = h(doc, "pre");
          pre.appendChild(h(doc, "code", void 0, String(node.text)));
          flow.atom(pre, true);
          return;
        }
        case "img":
          flow.atom(
            h(doc, "img", {
              src: String(node.src),
              alt: "preview image",
              loading: "lazy",
              referrerpolicy: "no-referrer"
            }),
            false
          );
          return;
        case "imagemap": {
          const wrap = h(doc, "div", { class: "oep-bbhelp-preview__imagemap" });
          wrap.append(
            h(doc, "img", {
              src: String(node.src),
              alt: "imagemap preview",
              loading: "lazy",
              referrerpolicy: "no-referrer"
            }),
            h(
              doc,
              "div",
              { class: "oep-bbhelp-preview__imagemap-meta" },
              "ImageMap base image preview"
            )
          );
          flow.atom(wrap, true);
          return;
        }
        case "email":
          flow.text(String(node.text));
          return;
        default:
          flow.atom(
            h(doc, "a", linkAttrs(String(node.href)), String(node.text)),
            false
          );
      }
    }
  };
  function renderBbcode(source, options = {}) {
    const doc = options.document ?? globalThis.document;
    const frag = doc.createDocumentFragment();
    const renderer = new Renderer(doc);
    renderer.container(frag, parseBbcode(source).children);
    return frag;
  }

  // src/editor/markdown-render.js
  var MARK = "￼";
  var PUA_BASE = 57344;
  var PUA_SIZE = 6400;
  var PLACEHOLDER_RE = /\uFFFC([\uE000-\uF8FF])([\uE000-\uF8FF])/;
  var LINK_URL_RE = /^https?:\/\/[^\s)]+$/;
  var EMPHASIS = [
    { re: /\*\*(?!\s)([^*\n]+)(?<!\s)\*\*/g, tag: "strong" },
    {
      re: /(?<![\p{L}\p{N}])__(?!\s)([^_\n]+)(?<!\s)__(?![\p{L}\p{N}])/gu,
      tag: "strong"
    },
    { re: /\*(?!\s)([^*\n]+)(?<!\s)\*/g, tag: "em" },
    {
      re: /(?<![\p{L}\p{N}])_(?!\s)([^_\n]+)(?<!\s)_(?![\p{L}\p{N}])/gu,
      tag: "em"
    },
    { re: /~~([^~\n]+)~~/g, tag: "del" }
  ];
  var EMPHASIS_ROUNDS = 3;
  function createFinder2(haystack) {
    const memo = /* @__PURE__ */ new Map();
    return (needle, from) => {
      const hit = memo.get(needle);
      if (hit && hit.from <= from && (hit.at < 0 || hit.at >= from)) {
        return hit.at;
      }
      const at = haystack.indexOf(needle, from);
      memo.set(needle, { from, at });
      return at;
    };
  }
  function createWsFinder(haystack) {
    let memoFrom = -1;
    let memoAt = -1;
    return (from) => {
      if (memoFrom >= 0 && memoFrom <= from && (memoAt < 0 || memoAt >= from)) {
        return memoAt;
      }
      const re = /\s/g;
      re.lastIndex = from;
      const m = re.exec(haystack);
      memoFrom = from;
      memoAt = m ? m.index : -1;
      return memoAt;
    };
  }
  var Inline = class {
    /** @param {Document} doc */
    constructor(doc) {
      this.doc = doc;
      this.atoms = [];
    }
    /** @returns {string} placeholder for a new atom */
    atom(el2, inner) {
      const index = this.atoms.length;
      this.atoms.push({ el: el2, inner });
      return MARK + String.fromCharCode(PUA_BASE + Math.floor(index / PUA_SIZE)) + String.fromCharCode(PUA_BASE + index % PUA_SIZE);
    }
    /** Code spans and images, left to right. */
    codeAndImages(line) {
      const findTick = createFinder2(line);
      const findClose = createFinder2(line);
      const findParen = createFinder2(line);
      const findWs = createWsFinder(line);
      let out = "";
      let from = 0;
      let i = 0;
      while (i < line.length) {
        const c = line[i];
        if (c === "`") {
          const j = findTick("`", i + 1);
          if (j < 0 || j === i + 1) {
            i += 1;
            continue;
          }
          const code = this.doc.createElement("code");
          code.textContent = line.slice(i + 1, j);
          out += line.slice(from, i) + this.atom(code);
          from = i = j + 1;
          continue;
        }
        if (c === "!" && line[i + 1] === "[") {
          const altEnd = findClose("]", i + 2);
          if (altEnd < 0) {
            i += 1;
            continue;
          }
          const srcStart = altEnd + 2;
          const close = line[altEnd + 1] === "(" ? findParen(")", srcStart) : -1;
          const ws = close > srcStart ? findWs(srcStart) : -1;
          if (close > srcStart && (ws < 0 || ws > close)) {
            const src = absoluteHttpUrl(line.slice(srcStart, close));
            if (src) {
              const img = this.doc.createElement("img");
              img.setAttribute("src", src);
              img.setAttribute("alt", line.slice(i + 2, altEnd));
              img.setAttribute("loading", "lazy");
              img.setAttribute("referrerpolicy", "no-referrer");
              out += line.slice(from, i) + this.atom(img);
              from = i = close + 1;
              continue;
            }
          }
          i += 1;
          continue;
        }
        i += 1;
      }
      return out + line.slice(from);
    }
    /** `[label](http(s)://…)`; the label gets the emphasis passes. */
    links(s) {
      const findClose = createFinder2(s);
      const findParen = createFinder2(s);
      const findWs = createWsFinder(s);
      let out = "";
      let from = 0;
      let i = s.indexOf("[");
      while (i >= 0) {
        const rb = findClose("]", i + 1);
        if (rb < 0) break;
        const urlStart = rb + 2;
        if (rb > i + 1 && s[rb + 1] === "(") {
          const close = findParen(")", urlStart);
          const ws = close > urlStart ? findWs(urlStart) : -1;
          const raw = close > urlStart ? s.slice(urlStart, close) : "";
          if (raw && (ws < 0 || ws > close) && LINK_URL_RE.test(raw) && !raw.includes(MARK)) {
            const href = absoluteHttpUrl(raw);
            if (href) {
              const a = this.doc.createElement("a");
              a.setAttribute("href", href);
              a.setAttribute("target", "_blank");
              a.setAttribute("rel", "noopener noreferrer");
              out += s.slice(from, i) + this.atom(a, this.emphasis(s.slice(i + 1, rb)));
              from = close + 1;
              i = s.indexOf("[", from);
              continue;
            }
          }
        }
        i = s.indexOf("[", i + 1);
      }
      return out + s.slice(from);
    }
    /**
     * Run the emphasis passes; a second round lets an outer pair close over an
     * inner one found by a later pass (`**a *b* c**`).
     */
    emphasis(s) {
      for (let round = 0; round < EMPHASIS_ROUNDS; round += 1) {
        let changed = false;
        for (const { re, tag } of EMPHASIS) {
          s = s.replace(re, (_, inner) => {
            changed = true;
            return this.atom(this.doc.createElement(tag), inner);
          });
        }
        if (!changed) break;
      }
      return s;
    }
    /** Append text and atoms of `s` to `parent`. */
    expand(s, parent) {
      let from = 0;
      const re = new RegExp(PLACEHOLDER_RE.source, "g");
      let m;
      while (m = re.exec(s)) {
        if (m.index > from) parent.append(s.slice(from, m.index));
        const index = (m[1].charCodeAt(0) - PUA_BASE) * PUA_SIZE + (m[2].charCodeAt(0) - PUA_BASE);
        const atom = this.atoms[index];
        if (atom.inner !== void 0) this.expand(atom.inner, atom.el);
        parent.append(atom.el);
        from = re.lastIndex;
      }
      if (from < s.length) parent.append(s.slice(from));
    }
    /**
     * @param {string} line
     * @param {Element} parent
     */
    render(line, parent) {
      const safe = line.replace(/\uFFFC/g, "�");
      this.expand(this.emphasis(this.links(this.codeAndImages(safe))), parent);
    }
  };
  function renderMarkdown(source, options = {}) {
    const doc = options.document ?? globalThis.document;
    const frag = doc.createDocumentFragment();
    const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
    let code = null;
    let codeText = "";
    let ul = null;
    let ol = null;
    let quote = null;
    const el2 = (tag) => doc.createElement(tag);
    const inline = (text, tag) => {
      const node = el2(tag);
      new Inline(doc).render(text, node);
      return node;
    };
    const closeLists = () => {
      ul = null;
      ol = null;
    };
    const closeQuote = () => {
      quote = null;
    };
    for (const line of lines) {
      if (/^```/.test(line.trim())) {
        closeLists();
        closeQuote();
        if (!code) {
          const pre = el2("pre");
          code = el2("code");
          pre.appendChild(code);
          frag.appendChild(pre);
          codeText = "";
        } else {
          code.textContent = codeText;
          code = null;
        }
        continue;
      }
      if (code) {
        codeText += `${line}
`;
        continue;
      }
      if (!line.trim()) {
        closeLists();
        closeQuote();
        continue;
      }
      const quoteMatch = line.match(/^\s*>\s?(.*)$/);
      if (quoteMatch) {
        closeLists();
        if (!quote) {
          quote = el2("blockquote");
          frag.appendChild(quote);
        }
        quote.appendChild(inline(quoteMatch[1], "p"));
        continue;
      }
      closeQuote();
      const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (ulMatch) {
        ol = null;
        if (!ul) {
          ul = el2("ul");
          frag.appendChild(ul);
        }
        ul.appendChild(inline(ulMatch[1], "li"));
        continue;
      }
      const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (olMatch) {
        ul = null;
        if (!ol) {
          ol = el2("ol");
          frag.appendChild(ol);
        }
        ol.appendChild(inline(olMatch[2], "li"));
        continue;
      }
      closeLists();
      const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        frag.appendChild(inline(headingMatch[2], `h${headingMatch[1].length}`));
        continue;
      }
      frag.appendChild(inline(line, "p"));
    }
    if (code) code.textContent = codeText;
    return frag;
  }

  // src/editor/preview-toggle.js
  function isElement(node) {
    return !!node && /** @type {Node} */
    node.nodeType === 1;
  }
  function moveBefore(anchor, child) {
    const parent = anchor.parentElement;
    if (!parent) return;
    if (child.parentElement === parent && child.nextElementSibling === anchor) {
      return;
    }
    anchor.insertAdjacentElement("beforebegin", child);
  }
  function moveFirst(parent, child) {
    if (child.parentElement === parent && parent.firstElementChild === child) {
      return;
    }
    parent.prepend(child);
  }
  function findByLabel(scope, test, selector = "button, a", exclude = null) {
    for (const node of Array.from(scope.querySelectorAll(selector))) {
      if (node === exclude) continue;
      if (test(String(node.textContent || "").trim())) return node;
    }
    return null;
  }
  function findBbcodeCancelButton(editorEl, textarea, exclude = null) {
    const scopes = [
      editorEl,
      textarea?.closest("form"),
      editorEl.closest("form"),
      editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
      editorEl.parentElement
    ].filter(isElement);
    for (const scope of scopes) {
      const wrap = scope.matches(".bbcode-editor__button--cancel") ? scope : scope.querySelector(".bbcode-editor__button--cancel");
      if (wrap) {
        const button = wrap.matches("button, a") ? wrap : Array.from(wrap.querySelectorAll("button, a")).find(
          (n) => n !== exclude
        );
        if (button) return button;
      }
    }
    for (const scope of scopes) {
      const button = findByLabel(
        scope,
        (l) => l.toLowerCase() === "cancel",
        "button, a",
        exclude
      );
      if (button) return button;
    }
    return null;
  }
  function placeBbcodePreviewToggle(editorEl, textarea, toggleBtn) {
    const cancel = findBbcodeCancelButton(editorEl, textarea, toggleBtn);
    if (cancel && cancel.parentElement) {
      moveBefore(cancel, toggleBtn);
      return "cancel";
    }
    const actions = editorEl.querySelector(".bbcode-editor__buttons--actions");
    if (actions) {
      moveFirst(actions, toggleBtn);
      return "actions";
    }
    return null;
  }
  var REPLY_LABELS = /* @__PURE__ */ new Set(["reply", "respond", "response"]);
  function placeDiscussionPreviewToggle(composerRoot, toggleBtn, textarea) {
    const buttons = "button, [role='button']";
    const groupOf = (button) => button.closest(".beatmap-discussion-post__actions-group") || button.parentElement;
    const replyGroup = composerRoot.querySelector(
      ".beatmap-discussion-post__actions-group"
    );
    const replyButton = replyGroup || composerRoot.querySelector("button[data-action]") || findByLabel(
      composerRoot,
      (l) => REPLY_LABELS.has(l.toLowerCase()),
      buttons
    );
    if (replyButton) {
      const group = replyGroup || groupOf(replyButton);
      if (group) {
        moveFirst(group, toggleBtn);
        return "reply";
      }
    }
    const noteButton = composerRoot.querySelector('[data-type="mapper_note"]') || findByLabel(composerRoot, (l) => l === "Note", buttons);
    if (noteButton) {
      const group = groupOf(noteButton);
      if (group) {
        moveFirst(group, toggleBtn);
        return "note";
      }
    }
    const footer = composerRoot.querySelector(".beatmap-discussion-new__footer") || composerRoot.querySelector("[class*='footer']") || composerRoot.querySelector("[class*='actions']");
    if (footer) {
      if (toggleBtn.parentElement !== footer) moveFirst(footer, toggleBtn);
      return "footer";
    }
    if (!toggleBtn.parentElement) {
      const anchor = textarea?.closest(".beatmap-discussion-new__message") || textarea?.parentElement || composerRoot;
      moveFirst(anchor, toggleBtn);
      return "textarea";
    }
    return null;
  }

  // src/editor/textarea.js
  function replaceRange(textarea, from, to, replacement, options = {}) {
    const doc = textarea.ownerDocument;
    textarea.focus();
    textarea.setSelectionRange(from, to);
    let native = false;
    try {
      if (typeof doc.execCommand === "function") {
        native = doc.execCommand("insertText", false, replacement) === true;
      }
    } catch (_) {
      native = false;
    }
    if (!native) textarea.setRangeText(replacement, from, to, "end");
    if (options.dispatchInput !== false) dispatchInput(textarea);
    return native;
  }
  function dispatchInput(textarea) {
    const view = textarea.ownerDocument.defaultView;
    const EventCtor = view?.Event ?? Event;
    textarea.dispatchEvent(new EventCtor("input", { bubbles: true }));
  }
  function toggleWrap(textarea, open, close, options = {}) {
    const placeholder = String(options.placeholder ?? "");
    const matchInside = options.matchInside !== false;
    const value = textarea.value || "";
    const start2 = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start2;
    const hasSelection = end > start2;
    const selected = value.slice(start2, end);
    const quiet = { dispatchInput: false };
    const selectedIsWrapped = matchInside && hasSelection && selected.length >= open.length + close.length && selected.startsWith(open) && selected.endsWith(close);
    const outsideIsWrapped = start2 >= open.length && value.slice(start2 - open.length, start2) === open && value.slice(end, end + close.length) === close;
    let result;
    let nextStart;
    let nextEnd;
    if (selectedIsWrapped) {
      const inner = selected.slice(open.length, selected.length - close.length);
      replaceRange(textarea, start2, end, inner, quiet);
      nextStart = start2;
      nextEnd = start2 + inner.length;
      result = "unwrapped";
    } else if (outsideIsWrapped) {
      nextStart = start2 - open.length;
      replaceRange(textarea, nextStart, end + close.length, selected, quiet);
      nextEnd = nextStart + selected.length;
      result = "unwrapped";
    } else {
      const body = selected || placeholder;
      replaceRange(textarea, start2, end, `${open}${body}${close}`, quiet);
      nextStart = start2 + open.length;
      nextEnd = nextStart + body.length;
      result = "wrapped";
    }
    textarea.setSelectionRange(nextStart, nextEnd);
    dispatchInput(textarea);
    return result;
  }

  // src/osu/index.js
  var osu_exports = {};
  __export(osu_exports, {
    ACCURACY_FORMAT: () => ACCURACY_FORMAT,
    ACTIVE_PICKER_SELECTOR: () => ACTIVE_PICKER_SELECTOR,
    DEFAULT_SPEED_DOWN: () => DEFAULT_SPEED_DOWN,
    DEFAULT_SPEED_UP: () => DEFAULT_SPEED_UP,
    DIFFICULTY_MODS: () => DIFFICULTY_MODS,
    DURATION_FORMAT: () => DURATION_FORMAT,
    HITSTAT_CLASS_PREFIX: () => HITSTAT_CLASS_PREFIX,
    LISTING_MODE_RE: () => LISTING_MODE_RE,
    MODE_ICON_CLASS_RE: () => MODE_ICON_CLASS_RE,
    MOD_TYPES: () => MOD_TYPES,
    RATE_DISPLAY: () => RATE_DISPLAY,
    RULESETS: () => RULESETS,
    RULESET_HASH_RE: () => RULESET_HASH_RE,
    RULESET_PATTERN: () => RULESET_PATTERN,
    SPEED_EPSILON: () => SPEED_EPSILON,
    STABLE_MOD_ACRONYMS: () => STABLE_MOD_ACRONYMS,
    STAR_FORMAT: () => STAR_FORMAT,
    STATS_DISPLAY: () => STATS_DISPLAY,
    beatmapMaxComboFromScore: () => beatmapMaxComboFromScore,
    beatmapsetIdFromHref: () => beatmapsetIdFromHref,
    beatmapsetIdFromLinks: () => beatmapsetIdFromLinks,
    clearBeatmapsetJsonCache: () => clearBeatmapsetJsonCache,
    decimalSeparator: () => decimalSeparator,
    defaultSpeedChange: () => defaultSpeedChange,
    difficultyMods: () => difficultyMods,
    flagFilename: () => flagFilename,
    formatAccuracy: () => formatAccuracy,
    formatCombo: () => formatCombo,
    formatDecimal: () => formatDecimal,
    formatDuration: () => formatDuration,
    formatRelativeShort: () => formatRelativeShort,
    formatSpeedChange: () => formatSpeedChange,
    formatStars: () => formatStars,
    getCurrentBeatmapId: () => getCurrentBeatmapId,
    getCurrentRuleset: () => getCurrentRuleset,
    hitstatClassFromLabel: () => hitstatClassFromLabel,
    hitstatValue: () => hitstatValue,
    hitstatValueForAttribute: () => hitstatValueForAttribute,
    isFullCombo: () => isFullCombo,
    isListingMode: () => isListingMode,
    isModCustomised: () => isModCustomised,
    isNonDefaultSpeed: () => isNonDefaultSpeed,
    isPerfectAccuracy: () => isPerfectAccuracy,
    isRuleset: () => isRuleset,
    leaderboardScoreId: () => leaderboardScoreId,
    legacyAccuracyAndRank: () => legacyAccuracyAndRank,
    modAcronym: () => modAcronym,
    modAcronyms: () => modAcronyms,
    modFullName: () => modFullName,
    modIconSuffix: () => modIconSuffix,
    modRateLabel: () => modRateLabel,
    modSettings: () => modSettings,
    modTypeClass: () => modTypeClass,
    normalizeRuleset: () => normalizeRuleset,
    normalizeStatistics: () => normalizeStatistics,
    pageLocale: () => pageLocale,
    parseApiNumber: () => parseApiNumber,
    parseBeatmapHash: () => parseBeatmapHash,
    parseLocaleNumber: () => parseLocaleNumber,
    parsePickerHref: () => parsePickerHref,
    readBeatmapsetJson: () => readBeatmapsetJson,
    rulesetFromId: () => rulesetFromId,
    rulesetFromModeIconClass: () => rulesetFromModeIconClass,
    rulesetFromProfileUrl: () => rulesetFromProfileUrl,
    rulesetId: () => rulesetId,
    scoreDisplayValues: () => scoreDisplayValues,
    scoreGrade: () => scoreGrade,
    scoreHasNonstandardRate: () => scoreHasNonstandardRate,
    scoreIndicatesPerfectCombo: () => scoreIndicatesPerfectCombo,
    scoreMergeKey: () => scoreMergeKey,
    sortModsForDisplay: () => sortModsForDisplay,
    speedChangeFromMod: () => speedChangeFromMod,
    statsCells: () => statsCells
  });

  // src/osu/ruleset.js
  var RULESETS = Object.freeze(["osu", "taiko", "fruits", "mania"]);
  var RULESET_PATTERN = RULESETS.join("|");
  var RULESET_HASH_RE = new RegExp(
    `^#(${RULESET_PATTERN})\\/(\\d+)`,
    "i"
  );
  var MODE_ICON_CLASS_RE = new RegExp(
    `\\bfa-extra-mode-(${RULESET_PATTERN})\\b`
  );
  var LISTING_MODE_RE = /^[0123]$/;
  function isRuleset(name) {
    return typeof name === "string" && RULESETS.includes(
      /** @type {*} */
      name
    );
  }
  function normalizeRuleset(name) {
    if (typeof name !== "string") return null;
    const lower = name.trim().toLowerCase();
    return isRuleset(lower) ? lower : null;
  }
  function rulesetFromId(id, fallback = (
    /** @type {F} */
    "osu"
  )) {
    if (id == null || id === "") return fallback;
    const n = Number(id);
    return Number.isInteger(n) && n >= 0 && n < RULESETS.length ? RULESETS[n] : fallback;
  }
  function rulesetId(name, fallback = (
    /** @type {F} */
    0
  )) {
    const i = RULESETS.indexOf(
      /** @type {*} */
      name
    );
    return i >= 0 ? i : fallback;
  }
  function isListingMode(value) {
    return typeof value === "string" && LISTING_MODE_RE.test(value);
  }
  function rulesetFromModeIconClass(className) {
    const m = MODE_ICON_CLASS_RE.exec(String(className ?? ""));
    return m ? (
      /** @type {Ruleset} */
      m[1]
    ) : null;
  }
  function rulesetFromProfileUrl(pathname, search = "") {
    const seg = String(pathname ?? "").match(/^\/users\/[^/]+\/([^/]+)\/?$/);
    if (seg && isRuleset(seg[1])) return seg[1];
    const q = String(search ?? "").match(/[?&]mode=([^&]+)/);
    return q && isRuleset(q[1]) ? q[1] : null;
  }

  // src/osu/beatmapset-data.js
  var ACTIVE_PICKER_SELECTOR = "a.beatmapset-beatmap-picker__beatmap--active";
  function resolve(ctx = {}) {
    return {
      doc: ctx.document ?? (typeof document !== "undefined" ? document : void 0),
      loc: ctx.location ?? (typeof location !== "undefined" ? location : void 0)
    };
  }
  var jsonCache = null;
  function readBeatmapsetJson(ctx) {
    const { doc, loc } = resolve(ctx);
    const node = doc?.querySelector?.("#json-beatmapset") ?? null;
    if (!node) {
      jsonCache = null;
      return null;
    }
    const text = node.textContent ?? "";
    const pathname = String(loc?.pathname ?? "");
    if (jsonCache && jsonCache.node === node && jsonCache.length === text.length && jsonCache.pathname === pathname) {
      return jsonCache.value;
    }
    const raw = text.trim();
    let value = null;
    if (raw) {
      try {
        value = JSON.parse(raw);
      } catch {
        value = null;
      }
    }
    jsonCache = { node, length: text.length, pathname, value };
    return value;
  }
  function clearBeatmapsetJsonCache() {
    jsonCache = null;
  }
  function parseBeatmapHash(hash) {
    const m = RULESET_HASH_RE.exec(String(hash ?? ""));
    if (!m) return null;
    return {
      ruleset: (
        /** @type {Ruleset} */
        m[1].toLowerCase()
      ),
      beatmapId: Number(m[2])
    };
  }
  var PICKER_KNOWN_RE = new RegExp(`#(${RULESET_PATTERN})\\/(\\d+)`, "i");
  var PICKER_ANY_END_RE = /#([a-z]+)\/(\d+)\s*$/i;
  var BEATMAP_PATH_RE = /\/beatmaps\/(\d+)/;
  function parsePickerHref(href, options = {}) {
    const s = String(href ?? "");
    if (!s) return null;
    const re = options.match === "any-end" ? PICKER_ANY_END_RE : PICKER_KNOWN_RE;
    const m = re.exec(s);
    if (m) return { ruleset: normalizeRuleset(m[1]), beatmapId: Number(m[2]) };
    if (options.pathFallback === false) return null;
    const p = BEATMAP_PATH_RE.exec(s);
    return p ? { ruleset: null, beatmapId: Number(p[1]) } : null;
  }
  function activePickerHref(doc) {
    const a = doc?.querySelector?.(ACTIVE_PICKER_SELECTOR);
    return a ? a.getAttribute("href") || "" : "";
  }
  function getCurrentRuleset(ctx) {
    const { doc, loc } = resolve(ctx);
    const fromHash = String(loc?.hash ?? "").match(
      new RegExp(`^#(${RULESET_PATTERN})\\/`, "i")
    );
    if (fromHash) return (
      /** @type {Ruleset} */
      fromHash[1].toLowerCase()
    );
    const href = activePickerHref(doc);
    if (href) {
      const m = href.match(new RegExp(`#(${RULESET_PATTERN})\\/`, "i"));
      if (m) return (
        /** @type {Ruleset} */
        m[1].toLowerCase()
      );
      const p = BEATMAP_PATH_RE.exec(href);
      if (p) {
        const id = Number(p[1]);
        const found = readBeatmapsetJson(ctx)?.beatmaps?.find?.(
          (b) => b.id === id
        );
        if (found?.mode) {
          return (
            /** @type {Ruleset} */
            String(found.mode).toLowerCase()
          );
        }
      }
    }
    return "osu";
  }
  function getCurrentBeatmapId(ctx) {
    const { doc, loc } = resolve(ctx);
    const fromHash = parseBeatmapHash(loc?.hash);
    if (fromHash) return fromHash.beatmapId;
    const href = activePickerHref(doc);
    if (href) {
      const fromPicker = parsePickerHref(href);
      if (fromPicker) return fromPicker.beatmapId;
    }
    const data = readBeatmapsetJson(ctx);
    if (Array.isArray(data?.beatmaps) && data.beatmaps.length) {
      const mode = getCurrentRuleset(ctx);
      const bm = data.beatmaps.find((b) => b.mode === mode) || data.beatmaps[0];
      if (bm?.id != null) return Number(bm.id);
    }
    return null;
  }
  var BEATMAPSET_PATH_RE = /^\/beatmapsets\/(\d+)/i;
  var BEATMAPSET_ANYWHERE_RE = /\/beatmapsets\/(\d+)/;
  function beatmapsetIdFromHref(href, options = {}) {
    const s = String(href ?? "");
    if (!s) return null;
    if (options.match === "anywhere") {
      const m2 = BEATMAPSET_ANYWHERE_RE.exec(s);
      return m2 ? Number(m2[1]) : null;
    }
    const base = options.base ?? (typeof location !== "undefined" ? location.origin : void 0) ?? "https://osu.ppy.sh";
    let pathname;
    try {
      pathname = new URL(s, base).pathname;
    } catch {
      return null;
    }
    const m = BEATMAPSET_PATH_RE.exec(pathname);
    return m ? Number(m[1]) : null;
  }
  function beatmapsetIdFromLinks(root, options = {}) {
    const links = root?.querySelectorAll?.('a[href*="beatmapsets/"]') ?? [];
    for (const a of links) {
      const id = beatmapsetIdFromHref(a.getAttribute("href"), options);
      if (id != null) return id;
    }
    return null;
  }

  // src/osu/format.js
  function requireOption(fn, name, value, allowed) {
    if (!allowed.includes(value)) {
      throw new TypeError(
        `${fn}: option "${name}" must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`
      );
    }
  }
  function pageLocale() {
    if (typeof window !== "undefined" && typeof window.currentLocale === "string") {
      return window.currentLocale;
    }
    if (typeof document === "undefined") return void 0;
    return document.documentElement?.lang || void 0;
  }
  var STAR_FORMAT = Object.freeze({
    /** beatmap-card-extra `formatStarShort` */
    card: Object.freeze({ rounding: "truncate", trimZeros: true }),
    /** beatmap-detail `formatBeatmapsetHeaderStarRatingText` */
    header: Object.freeze({ rounding: "floor", localize: true }),
    /** profile modded SR badge: fixed 2 decimals (was `sr.toFixed(2)`) */
    profileBadge: Object.freeze({ rounding: "floor" })
  });
  function formatStars(value, options) {
    requireOption("formatStars", "rounding", options?.rounding, [
      "truncate",
      "floor",
      "round"
    ]);
    const x = Number(value);
    if (!Number.isFinite(x)) return "";
    let v = x;
    if (options.rounding === "truncate") {
      v = Math.floor(Math.abs(x) * 100) / 100 * Math.sign(x);
    } else if (options.rounding === "floor") {
      v = Math.floor(x * 100) / 100;
    }
    if (options.localize) {
      return v.toLocaleString(options.locale, {
        minimumFractionDigits: options.trimZeros ? 0 : 2,
        maximumFractionDigits: 2
      });
    }
    const s = v.toFixed(2);
    return options.trimZeros ? s.replace(/\.?0+$/, "") : s;
  }
  var MIN = 6e4;
  var HOUR = 36e5;
  var DAY = 864e5;
  var MONTH = 2592e6;
  var YEAR = 31536e6;
  function formatRelativeShort(time, options) {
    requireOption("formatRelativeShort", "rounding", options?.rounding, [
      "floor",
      "round"
    ]);
    if (time == null || time === "") return "";
    const then = new Date(time).getTime();
    if (!Number.isFinite(then)) return "";
    const now = options.now ?? Date.now();
    if (options.rounding === "round") {
      const abs = Math.abs(now - then);
      if (abs < HOUR) return `${Math.round(abs / MIN)}m`;
      if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
      if (abs < MONTH) return `${Math.round(abs / DAY)}d`;
      if (abs < YEAR) return `${Math.round(abs / MONTH)}mo`;
      return `${Math.round(abs / YEAR)}y`;
    }
    const sec = Math.max(0, Math.floor((now - then) / 1e3));
    if (sec < 45) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(day / 365);
    if (y < 1) return `${mo}mo`;
    return `${y}y`;
  }
  var DURATION_FORMAT = Object.freeze({
    /** beatmap-card-extra `formatDuration`: seconds, `61:40` */
    card: Object.freeze({ unit: "s", hours: false }),
    /** beatmap-preview `formatPreviewTimeMs`: milliseconds, `1:01:40` */
    preview: Object.freeze({ unit: "ms", hours: true })
  });
  function formatDuration(value, options) {
    requireOption("formatDuration", "unit", options?.unit, ["s", "ms"]);
    requireOption("formatDuration", "hours", options?.hours, [true, false]);
    let n = Number(value);
    if (!Number.isFinite(n) || n < 0) n = 0;
    const total = Math.floor(options.unit === "ms" ? n / 1e3 : n);
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, "0");
    if (options.hours && m >= 60) {
      return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}`;
    }
    return `${m}:${s}`;
  }
  function flagFilename(countryCode) {
    const c = String(countryCode ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return null;
    const u1 = 127462 + c.charCodeAt(0) - 65;
    const u2 = 127462 + c.charCodeAt(1) - 65;
    return `${u1.toString(16)}-${u2.toString(16)}`;
  }
  var SPACE_RE = /[\s\u00A0\u202F\u2009]/g;
  function decimalSeparator(locale) {
    try {
      return new Intl.NumberFormat(locale).format(1.1).replace(/\d/g, "").replace(SPACE_RE, "") || ".";
    } catch (_) {
      return ".";
    }
  }
  function parseLocaleNumber(str, options = {}) {
    if (!str) return NaN;
    let s = String(str).trim().replace(SPACE_RE, "");
    const locale = "locale" in options ? options.locale : pageLocale();
    const dec = decimalSeparator(locale);
    if (dec === "." && /^\d{1,3}(,\d{3})+$/.test(s)) {
      return parseFloat(s.replace(/,/g, ""));
    }
    if (dec === "," && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      return parseFloat(s.replace(/\./g, ""));
    }
    const lastComma = s.lastIndexOf(",");
    const lastPeriod = s.lastIndexOf(".");
    if (lastComma > lastPeriod) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    return parseFloat(s);
  }
  function parseApiNumber(str) {
    if (typeof str === "number") return str;
    if (typeof str !== "string") return NaN;
    const s = str.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
    return Number(s);
  }
  function formatDecimal(n, options = {}) {
    const digits = options.digits ?? 2;
    const locale = "locale" in options ? options.locale : pageLocale();
    try {
      return n.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    } catch {
      return n.toFixed(digits);
    }
  }

  // src/osu/mods.js
  var DEFAULT_SPEED_UP = 1.5;
  var DEFAULT_SPEED_DOWN = 0.75;
  var SPEED_EPSILON = 5e-3;
  var MOD_TYPES = Object.freeze({
    DifficultyReduction: /* @__PURE__ */ new Set(["EZ", "NF", "HT", "DC", "NR"]),
    DifficultyIncrease: /* @__PURE__ */ new Set([
      "HR",
      "SD",
      "PF",
      "DT",
      "NC",
      "HD",
      "FL",
      "FI",
      "CO",
      "BL",
      "AC",
      "ST"
    ]),
    Conversion: /* @__PURE__ */ new Set(["CL", "DA", "MR", "RD", "DS", "IN", "CS", "HO", "TP"]),
    Automation: /* @__PURE__ */ new Set(["AT", "CN", "RX", "AP", "SO"]),
    System: /* @__PURE__ */ new Set(["TD", "SV2"])
  });
  var DIFFICULTY_MODS = /* @__PURE__ */ new Set([
    "DT",
    "NC",
    "HT",
    "DC",
    "HR",
    "EZ",
    "FL",
    "DA",
    "AC",
    "WU",
    "WD",
    "DF",
    "TC"
  ]);
  var RULESET_DIFFICULTY_MODS = Object.freeze({
    osu: /* @__PURE__ */ new Set(["HD", "TD"]),
    mania: /* @__PURE__ */ new Set([
      "1K",
      "2K",
      "3K",
      "4K",
      "5K",
      "6K",
      "7K",
      "8K",
      "9K",
      "10K",
      "DS"
    ])
  });
  var STABLE_MOD_ACRONYMS = /* @__PURE__ */ new Set([
    "NM",
    "EZ",
    "NF",
    "HT",
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "SO",
    "TD",
    "RX",
    "AP",
    "FI",
    "K1",
    "K2",
    "K3",
    "K4",
    "K5",
    "K6",
    "K7",
    "K8",
    "K9"
  ]);
  var MOD_NAMES = Object.freeze({
    EZ: "Easy",
    NF: "No Fail",
    HT: "Half Time",
    DC: "Daycore",
    NR: "No Release",
    HR: "Hard Rock",
    SD: "Sudden Death",
    PF: "Perfect",
    DT: "Double Time",
    NC: "Nightcore",
    FI: "Fade In",
    HD: "Hidden",
    CO: "Cover",
    FL: "Flashlight",
    BL: "Blinds",
    ST: "Strict Tracking",
    AC: "Accuracy Challenge",
    AT: "Autoplay",
    CN: "Cinema",
    RX: "Relax",
    AP: "Autopilot",
    SO: "Spun Out",
    TP: "Target Practice",
    DA: "Difficulty Adjust",
    CL: "Classic",
    RD: "Random",
    MR: "Mirror",
    AL: "Alternate",
    SW: "Swap",
    SG: "Single Tap",
    IN: "Invert",
    CS: "Constant Speed",
    HO: "Hold Off",
    TR: "Transform",
    WG: "Wiggle",
    SI: "Spin In",
    GR: "Grow",
    DF: "Deflate",
    WU: "Wind Up",
    WD: "Wind Down",
    TC: "Traceable",
    BR: "Barrel Roll",
    AD: "Approach Different",
    FF: "Floating Fruits",
    MU: "Muted",
    NS: "No Scope",
    MG: "Magnetised",
    RP: "Repel",
    AS: "Adaptive Speed",
    FR: "Freeze Frame",
    BU: "Bubbles",
    SY: "Synesthesia",
    DP: "Depth",
    BM: "Bloom",
    SV2: "Score V2",
    TD: "Touch Device"
  });
  function modAcronym(mod) {
    const ac = typeof mod === "string" ? mod : (
      /** @type {{ acronym?: unknown }|null|undefined} */
      mod?.acronym
    );
    return ac ? String(ac) : null;
  }
  function modAcronyms(mods) {
    const out = [];
    if (!Array.isArray(mods)) return out;
    for (const m of mods) {
      const ac = modAcronym(m);
      if (ac) out.push(ac);
    }
    return out;
  }
  function modSettings(mod) {
    if (!mod || typeof mod !== "object") return null;
    const s = (
      /** @type {{ settings?: unknown }} */
      mod.settings
    );
    return s && typeof s === "object" ? (
      /** @type {Record<string, unknown>} */
      s
    ) : null;
  }
  function isModCustomised(mod) {
    const s = modSettings(mod);
    return s != null && Object.keys(s).length > 0;
  }
  function speedChangeFromMod(mod) {
    const x = Number(modSettings(mod)?.speed_change);
    return Number.isFinite(x) && x > 0 ? x : NaN;
  }
  function defaultSpeedChange(acronym) {
    const ac = String(acronym ?? "").trim().toUpperCase();
    if (ac === "DT" || ac === "NC") return DEFAULT_SPEED_UP;
    if (ac === "HT" || ac === "DC") return DEFAULT_SPEED_DOWN;
    return null;
  }
  function isNonDefaultSpeed(acronym, rate) {
    if (!Number.isFinite(rate) || rate <= 0) return false;
    const def = defaultSpeedChange(acronym) ?? DEFAULT_SPEED_UP;
    return Math.abs(rate - def) > SPEED_EPSILON;
  }
  function scoreHasNonstandardRate(score) {
    const mods = Array.isArray(score?.mods) ? score.mods : [];
    for (const m of mods) {
      const spd = speedChangeFromMod(m);
      if (Number.isFinite(spd) && isNonDefaultSpeed(modAcronym(m) ?? "", spd)) {
        return true;
      }
    }
    return false;
  }
  var RATE_DISPLAY = Object.freeze({
    profile: Object.freeze({ when: "always", style: "fixed" }),
    scoreboard: Object.freeze({ when: "non-default", style: "trim" })
  });
  function formatSpeedChange(rate, options) {
    const x = Number(rate);
    if (!Number.isFinite(x) || x <= 0) return "";
    if (options?.style === "fixed") return `${x.toFixed(2)}×`;
    if (options?.style !== "trim") {
      throw new TypeError('formatSpeedChange: style must be "fixed" or "trim"');
    }
    let t = String(Math.round(x * 100) / 100);
    if (t.includes(".")) t = t.replace(/\.?0+$/, "");
    return `${t}×`;
  }
  function modRateLabel(mod, options) {
    const rate = speedChangeFromMod(mod);
    if (!Number.isFinite(rate)) return "";
    if (options?.when === "non-default") {
      if (!isNonDefaultSpeed(modAcronym(mod) ?? "", rate)) return "";
    } else if (options?.when !== "always") {
      throw new TypeError('modRateLabel: when must be "always" or "non-default"');
    }
    return formatSpeedChange(rate, options);
  }
  function modTypeClass(acronym) {
    const u = String(acronym).trim().toUpperCase();
    if (MOD_TYPES.DifficultyReduction.has(u)) {
      return "mod--type-DifficultyReduction";
    }
    if (MOD_TYPES.DifficultyIncrease.has(u))
      return "mod--type-DifficultyIncrease";
    if (MOD_TYPES.Conversion.has(u) || /^\d+K$/.test(u)) {
      return "mod--type-Conversion";
    }
    if (MOD_TYPES.Automation.has(u)) return "mod--type-Automation";
    if (MOD_TYPES.System.has(u)) return "mod--type-System";
    return "mod--type-Fun";
  }
  var MOD_TYPE_ORDER = [
    "mod--type-DifficultyReduction",
    "mod--type-DifficultyIncrease",
    "mod--type-Conversion",
    "mod--type-Automation",
    "mod--type-Fun",
    "mod--type-System"
  ];
  function sortModsForDisplay(mods) {
    const list = Array.isArray(mods) ? mods : [];
    const key = (m) => {
      const ac = modAcronym(m);
      return ac ? [MOD_TYPE_ORDER.indexOf(modTypeClass(ac)), ac] : null;
    };
    return list.map((mod, i) => ({ mod, i, k: key(mod) })).sort((a, b) => {
      if (!a.k || !b.k) return (a.k ? 0 : 1) - (b.k ? 0 : 1) || a.i - b.i;
      return a.k[0] - b.k[0] || a.k[1].localeCompare(b.k[1], "en", { numeric: true }) || a.i - b.i;
    }).map((x) => x.mod);
  }
  function modFullName(acronym) {
    const a = String(acronym || "").trim().toUpperCase();
    if (!a) return "";
    if (/^[1-9]K$/.test(a) || a === "10K")
      return `${Number(a.slice(0, -1))} Key Mod`;
    return Object.hasOwn(MOD_NAMES, a) ? MOD_NAMES[a] : a;
  }
  function difficultyMods(acronyms, ruleset) {
    const extra = RULESET_DIFFICULTY_MODS[ruleset];
    return (acronyms || []).map((a) => String(a).toUpperCase()).filter((a) => DIFFICULTY_MODS.has(a) || extra?.has(a)).sort();
  }
  function modIconSuffix(acronym) {
    return String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
  }

  // src/osu/score.js
  var HITSTAT_CLASS_PREFIX = "oep-score-stats__val--";
  function requireOption2(fn, name, value, allowed) {
    if (!allowed.includes(value)) {
      throw new TypeError(
        `${fn}: option "${name}" must be one of ${allowed.map((v) => JSON.stringify(v)).join(", ")}`
      );
    }
  }
  function scoreGrade(score, options = {}) {
    const r = score?.rank;
    let grade;
    if (typeof r === "string") grade = r;
    else if (r && typeof r === "object" && typeof r.name === "string") {
      grade = r.name;
    } else grade = score?.passed === false ? "F" : "D";
    if (!options.sanitize) return grade;
    return String(grade).replace(/[^A-Za-z0-9]+/g, "") || "D";
  }
  var ACCURACY_FORMAT = Object.freeze({
    profile: Object.freeze({ scale: "auto", coerce: true, invalid: "—" }),
    // D10-6: the scoreboard parses like the profile (it used to accept only
    // numbers and always multiply by 100); only the invalid text differs.
    scoreboard: Object.freeze({ scale: "auto", coerce: true, invalid: "" })
  });
  function formatAccuracy(accuracy, options) {
    requireOption2("formatAccuracy", "scale", options?.scale, [
      "auto",
      "fraction"
    ]);
    requireOption2("formatAccuracy", "coerce", options?.coerce, [true, false]);
    const invalid = options.invalid ?? "";
    let n;
    if (options.coerce) n = accuracy != null ? Number(accuracy) : NaN;
    else n = typeof accuracy === "number" ? accuracy : NaN;
    if (!Number.isFinite(n)) return invalid;
    if (options.scale === "fraction" || n <= 1) n *= 100;
    return `${n.toFixed(2)}%`;
  }
  function isPerfectAccuracy(accuracy) {
    const n = accuracy != null && accuracy !== "" ? Number(accuracy) : NaN;
    if (!Number.isFinite(n)) return false;
    return (n > 1 ? n / 100 : n) >= 1;
  }
  function formatCombo(combo) {
    return `${Number(combo ?? 0).toLocaleString("en-US")}x`;
  }
  var LAZER_HIT_KEYS = ["great", "perfect", "ok", "meh", "miss"];
  var LAZER_ANY_KEYS = [
    ...LAZER_HIT_KEYS,
    "good",
    "large_tick_hit",
    "small_tick_hit",
    "large_tick_miss",
    "small_tick_miss"
  ];
  function firstNum(obj, ...keys) {
    for (const k of keys) {
      if (obj[k] != null) return Number(obj[k]);
    }
    return 0;
  }
  function normalizeStatistics(statistics, ruleset, options) {
    requireOption2(
      "normalizeStatistics",
      "legacyOsuGreat",
      options?.legacyOsuGreat,
      ["300+geki", "300"]
    );
    const st = statistics && typeof statistics === "object" ? (
      /** @type {Record<string, unknown>} */
      statistics
    ) : {};
    const n = (k) => Number(st[k] ?? 0);
    const leg = (name) => firstNum(st, `count_${name}`, `count${name}`);
    if (ruleset === "taiko") {
      const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
      return lazer ? { great: n("great"), ok: n("ok"), miss: n("miss") } : { great: leg("300"), ok: leg("100"), miss: leg("miss") };
    }
    if (ruleset === "fruits") {
      const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
      return lazer ? {
        great: n("great"),
        large_tick_hit: n("large_tick_hit"),
        small_tick_hit: n("small_tick_hit"),
        small_tick_miss: n("small_tick_miss"),
        miss: n("miss") + n("large_tick_miss")
      } : {
        great: leg("300"),
        large_tick_hit: leg("100"),
        small_tick_hit: leg("50"),
        small_tick_miss: leg("katu"),
        miss: leg("miss")
      };
    }
    if (ruleset === "mania") {
      const lazer = LAZER_ANY_KEYS.some((k) => st[k] != null);
      return lazer ? {
        perfect: n("perfect"),
        great: n("great"),
        good: n("good"),
        ok: n("ok"),
        meh: n("meh"),
        miss: n("miss")
      } : {
        perfect: leg("geki"),
        great: leg("300"),
        good: leg("katu"),
        ok: leg("100"),
        meh: leg("50"),
        miss: leg("miss")
      };
    }
    if (LAZER_HIT_KEYS.some((k) => st[k] != null)) {
      return {
        great: n("great") + n("perfect"),
        ok: n("ok"),
        meh: n("meh"),
        miss: n("miss")
      };
    }
    const great = options.legacyOsuGreat === "300+geki" ? n("count_300") + n("count_geki") : firstNum(st, "count_300", "count300", "count_geki", "countgeki");
    return { great, ok: leg("100"), meh: leg("50"), miss: leg("miss") };
  }
  var STAT_CLASS = Object.freeze({
    profile: Object.freeze({
      perfect: "perfect",
      great: "300",
      good: "good",
      ok: "100",
      meh: "50",
      miss: "miss",
      large_tick_hit: "100",
      small_tick_hit: "50",
      small_tick_miss: "drp-miss"
    }),
    scoreboard: Object.freeze({
      perfect: "mania-perfect",
      great: "300",
      good: "mania-good",
      ok: "100",
      meh: "50",
      miss: "miss",
      large_tick_hit: "ctb-l",
      small_tick_hit: "ctb-drp",
      small_tick_miss: "drp-miss"
    })
  });
  var STATS_DISPLAY = Object.freeze({
    // D10-5: legacy osu 300 is count_300 only everywhere. In osu! count_geki
    // counts all-300 combo sections, not extra hits; lazer's legacy decoder
    // maps only count_300 to Great, so the old profile sum double counted.
    profile: Object.freeze({ classes: "profile", legacyOsuGreat: "300" }),
    scoreboard: Object.freeze({ classes: "scoreboard", legacyOsuGreat: "300" })
  });
  var STAT_ORDER = Object.freeze({
    osu: ["great", "ok", "meh", "miss"],
    taiko: ["great", "ok", "miss"],
    fruits: [
      "great",
      "large_tick_hit",
      "small_tick_hit",
      "small_tick_miss",
      "miss"
    ],
    mania: ["perfect", "great", "good", "ok", "meh", "miss"]
  });
  function statsCells(score, options) {
    requireOption2("statsCells", "classes", options?.classes, [
      "profile",
      "scoreboard"
    ]);
    const ruleset = rulesetFromId(score?.ruleset_id ?? 0);
    const stats = normalizeStatistics(score?.statistics, ruleset, options);
    const classes = STAT_CLASS[options.classes];
    return STAT_ORDER[ruleset].map((key) => ({
      key,
      value: stats[key],
      className: HITSTAT_CLASS_PREFIX + classes[key]
    }));
  }
  function hitstatValue(label, score, options = {}) {
    const st = score?.statistics && typeof score.statistics === "object" ? score.statistics : score && typeof score === "object" ? score : {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = st?.[k];
        if (v != null && v !== "" && Number.isFinite(Number(v))) return String(v);
      }
      return "0";
    };
    const o = (
      /** @type {OsuStats} */
      normalizeStatistics(st, "osu", { legacyOsuGreat: "300" })
    );
    const lab = String(label).trim().toLowerCase();
    if (lab === "miss" || lab === "m" || lab.includes("miss")) {
      return String(o.miss);
    }
    if (lab === "mania_perfect") {
      return pick("count_geki", "countgeki", "perfect", "great");
    }
    if (lab === "mania_good") {
      return pick("count_katu", "countkatu", "good", "great");
    }
    if (lab === "ctb_l" || lab === "l" && options.ruleset === "fruits") {
      return pick("large_tick_hit", "large_bonus");
    }
    if (lab === "ctb_drp" || lab === "drp") {
      return pick("small_tick_hit", "small_bonus");
    }
    if (lab === "geki" || lab === "max" || lab === "320") {
      return pick("count_geki", "countgeki", "perfect", "great");
    }
    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great") {
      return String(o.great);
    }
    if (lab === "katu" || lab === "200") {
      return pick("count_katu", "countkatu", "good", "great");
    }
    if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok") return String(o.ok);
    if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") {
      return String(o.meh);
    }
    if (lab.includes("tick") || lab === "tail") {
      return pick(
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
        "large_tick_miss"
      );
    }
    return "0";
  }
  function hitstatValueForAttribute(attribute, score, ruleset) {
    const st = score?.statistics && typeof score.statistics === "object" ? score.statistics : score && typeof score === "object" ? score : {};
    const n = (k) => {
      const v = Number(st[k] ?? 0);
      return Number.isFinite(v) ? v : 0;
    };
    const attr = String(attribute);
    if (LAZER_ANY_KEYS.some((k) => st[k] != null)) {
      if (ruleset === "fruits" && attr === "miss") {
        return String(n("miss") + n("large_tick_miss"));
      }
      return /^[a-z_]+$/.test(attr) ? String(n(attr)) : null;
    }
    if (ruleset === "fruits" && attr === "small_tick_miss") {
      return String(firstNum(st, "count_katu", "countkatu"));
    }
    const norm = normalizeStatistics(st, ruleset, { legacyOsuGreat: "300" });
    return Object.hasOwn(norm, attr) ? String(norm[attr]) : null;
  }
  function hitstatClassFromLabel(label) {
    const lab = String(label).trim().toLowerCase();
    const c = (s) => HITSTAT_CLASS_PREFIX + s;
    if (!lab) return "";
    if (lab === "mania_perfect") return c("mania-perfect");
    if (lab === "mania_good") return c("mania-good");
    if (lab === "ctb_l") return c("ctb-l");
    if (lab === "ctb_drp") return c("ctb-drp");
    if (lab === "miss" || lab === "m" || lab.includes("miss")) return c("miss");
    if (lab === "meh" || /(^|[^0-9])50([^0-9]|$)/.test(lab)) return c("50");
    if (lab === "geki" || lab === "max" || lab === "320") return c("300");
    if (lab === "katu" || lab === "200") return c("100");
    if (lab === "ok" || /(^|[^0-9])100([^0-9]|$)/.test(lab)) return c("100");
    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great") return c("300");
    return "";
  }
  function scoreIndicatesPerfectCombo(score) {
    if (!score || typeof score !== "object") return false;
    return score.perfect === true || score.is_perfect_combo === true || score.legacy_perfect === true;
  }
  function isFullCombo(score, mapMaxCombo, options) {
    requireOption2("isFullCombo", "apiFlags", options?.apiFlags, [true, false]);
    const achieved = Number(score?.max_combo ?? 0);
    const mapMax = mapMaxCombo != null ? Number(mapMaxCombo) : NaN;
    const hasMapMax = Number.isFinite(mapMax) && mapMax > 0;
    if (!options.apiFlags) {
      return hasMapMax && Number.isFinite(achieved) && achieved === mapMax;
    }
    if (scoreIndicatesPerfectCombo(score)) return true;
    if (hasMapMax) return achieved > 0 && achieved === mapMax;
    const stats = score?.statistics && typeof score.statistics === "object" ? score.statistics : {};
    const fromStats = Number(
      score?.maximum_statistics?.max_combo ?? score?.maximum_statistics?.maxCombo ?? stats.max_combo ?? stats.maxCombo
    );
    return Number.isFinite(fromStats) && fromStats > 0 && achieved === fromStats;
  }
  function beatmapMaxComboFromScore(score, options = {}) {
    const bc = score?.beatmap?.max_combo;
    if (bc != null && Number.isFinite(Number(bc))) return Number(bc);
    const ms = score?.maximum_statistics;
    if (!ms || typeof ms !== "object") return null;
    const rulesetId2 = Number(score?.ruleset_id);
    const num = (k) => {
      const n = Number(ms[k]);
      return ms[k] != null && Number.isFinite(n) ? n : 0;
    };
    const has = (k) => ms[k] != null && Number.isFinite(Number(ms[k]));
    if (rulesetId2 === 0) {
      const great = num("great");
      if (!great) return null;
      if (ms.legacy_combo_increase != null) {
        return great + num("legacy_combo_increase");
      }
      return great + num("large_tick_hit") + num("small_tick_hit") + num("slider_tail_hit");
    }
    if (rulesetId2 === 1) return num("great") || null;
    if (rulesetId2 === 2) return num("great") + num("large_tick_hit") || null;
    if (options.legacyManiaGreatOnly) {
      return has("great") ? num("great") + num("legacy_combo_increase") || null : null;
    }
    if (!has("perfect") && !has("great")) return null;
    return num("perfect") + num("great") + num("legacy_combo_increase") || null;
  }
  function leaderboardScoreId(score) {
    if (!score || typeof score !== "object") return null;
    const raw = score.id ?? score.legacy_score_id ?? score.score_id ?? score.scoreId ?? score.scoreID ?? score.score?.id ?? score.score?.legacy_score_id ?? score.score?.score_id ?? null;
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n > 0 ? String(n) : null;
    const s = String(raw).trim();
    return s ? s : null;
  }
  function scoreMergeKey(score) {
    if (!score || typeof score !== "object") return null;
    const leg = Number(score.legacy_score_id);
    if (Number.isFinite(leg) && leg > 0) return `s:${leg}`;
    const id = Number(score.id);
    if (Number.isFinite(id) && id > 0) return `s:${id}`;
    const bm = score.beatmap?.id ?? score.beatmap_id;
    const t = String(score.ended_at || score.created_at || "");
    const tot = Number(score.total_score ?? score.score);
    const pf = score.passed === false ? 0 : 1;
    if (bm != null && Number.isFinite(Number(bm)) && t.length > 0 && Number.isFinite(tot)) {
      return `f:${Number(bm)}:${t}:${tot}:${pf}`;
    }
    return null;
  }
  function hasHiddenRankMod(score) {
    return (Array.isArray(score.mods) ? score.mods : []).some((m) => {
      const ac = typeof m === "string" ? m : m?.acronym;
      return ac === "FI" || ac === "FL" || ac === "HD";
    });
  }
  function legacyAccuracyAndRank(score, fallbackRuleset) {
    const st = score?.statistics && typeof score.statistics === "object" ? score.statistics : {};
    const n = (k) => Number(st[k]) || 0;
    const ruleset = score?.ruleset_id != null ? rulesetFromId(score.ruleset_id) : fallbackRuleset;
    const failed = scoreGrade(score) === "F";
    const hidden = hasHiddenRankMod(score);
    const miss = n("miss");
    const great = n("great");
    const ratioRank = (ratioGreat, sCondition) => {
      if (ratioGreat === 1) return hidden ? "XH" : "X";
      if (ratioGreat > 0.9 && sCondition && miss === 0)
        return hidden ? "SH" : "S";
      if (ratioGreat > 0.8 && miss === 0 || ratioGreat > 0.9) return "A";
      if (ratioGreat > 0.7 && miss === 0 || ratioGreat > 0.8) return "B";
      if (ratioGreat > 0.6) return "C";
      return "D";
    };
    const accRank = (acc, s, a, b, c) => {
      if (acc === 1) return hidden ? "XH" : "X";
      if (acc > s) return hidden ? "SH" : "S";
      if (acc > a) return "A";
      if (acc > b) return "B";
      if (acc > c) return "C";
      return "D";
    };
    let accuracy;
    let rank;
    switch (ruleset) {
      case "osu": {
        const meh = n("meh");
        const total = meh + n("ok") + great + miss;
        accuracy = total > 0 ? (meh * 50 + n("ok") * 100 + great * 300) / (total * 300) : 1;
        const ratioGreat = total > 0 ? great / total : 1;
        const ratioMeh = total > 0 ? meh / total : 1;
        rank = ratioRank(ratioGreat, ratioMeh <= 0.01);
        break;
      }
      case "taiko": {
        const total = n("ok") + great + miss;
        accuracy = total > 0 ? (n("ok") * 150 + great * 300) / (total * 300) : 1;
        rank = ratioRank(total > 0 ? great / total : 1, true);
        break;
      }
      case "fruits": {
        const hit = n("small_tick_hit") + n("large_tick_hit") + great;
        const total = hit + miss + n("small_tick_miss");
        accuracy = total > 0 ? hit / total : 1;
        rank = accRank(accuracy, 0.98, 0.94, 0.9, 0.85);
        break;
      }
      case "mania": {
        const total = n("perfect") + n("good") + n("ok") + n("meh") + great + miss;
        accuracy = total > 0 ? ((great + n("perfect")) * 300 + n("good") * 200 + n("ok") * 100 + n("meh") * 50) / (total * 300) : 1;
        rank = accRank(accuracy, 0.95, 0.9, 0.8, 0.7);
        break;
      }
      default:
        return null;
    }
    return { accuracy, rank: failed ? "F" : rank };
  }
  function scoreDisplayValues(score, prefs, fallbackRuleset) {
    const nz = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    const legacy = !!prefs?.legacyScoreOnly && score?.legacy_score_id != null;
    let total = 0;
    if (legacy) total = nz(score.legacy_total_score);
    else if (prefs?.scoringMode === "classic" && (score?.type == null || score.type === "solo_score")) {
      total = nz(score?.classic_total_score);
    }
    if (!total) {
      total = nz(score?.total_score) || nz(score?.classic_total_score) || nz(score?.legacy_total_score) || nz(score?.score);
    }
    let accuracy = score?.accuracy;
    let rank = scoreGrade(score);
    const legacyAcc = legacy ? legacyAccuracyAndRank(score, fallbackRuleset) : null;
    if (legacyAcc) {
      accuracy = legacyAcc.accuracy;
      rank = legacyAcc.rank;
    }
    const accN = Number(accuracy);
    if (accuracy != null && accuracy !== "" && Number.isFinite(accN) && accN <= 1)
      accuracy = Math.floor(accN * 1e4) / 1e4;
    const perfectCombo = legacy ? score.legacy_perfect === true : scoreIndicatesPerfectCombo(score);
    return { total, accuracy, rank, perfectCombo, legacy };
  }

  // src/core/lifecycle.js
  var lifecycle_exports = {};
  __export(lifecycle_exports, {
    createGeneration: () => createGeneration,
    listen: () => listen,
    mountSettingFeature: () => mountSettingFeature,
    safeStart: () => safeStart
  });

  // src/core/storage.js
  var storage_exports = {};
  __export(storage_exports, {
    KEYS: () => KEYS,
    SETTINGS_MIGRATION_KEY_PREFIX: () => SETTINGS_MIGRATION_KEY_PREFIX,
    deleteKey: () => deleteKey,
    getBool: () => getBool,
    getJSON: () => getJSON,
    getString: () => getString,
    setBool: () => setBool,
    setJSON: () => setJSON,
    setString: () => setString
  });
  var KEYS = Object.freeze({
    DEBUG: {
      key: "oep.debug",
      store: "gm",
      format: "boolean",
      owner: "core/log.js",
      purpose: "Print debug/info logs when true (set by hand)"
    },
    AUTH_CLIENT_ID: {
      key: "oep_client_id",
      store: "gm",
      format: "string",
      owner: "utils/auth.js",
      purpose: "OAuth client id"
    },
    AUTH_CLIENT_SECRET: {
      key: "oep_client_secret",
      store: "gm",
      format: "string",
      owner: "utils/auth.js",
      purpose: "OAuth client secret"
    },
    AUTH_ACCESS_TOKEN: {
      key: "oep_access_token",
      store: "gm",
      format: "string",
      owner: "utils/auth.js",
      purpose: "Cached client-credentials access token"
    },
    AUTH_TOKEN_EXPIRY: {
      key: "oep_token_expiry",
      store: "gm",
      format: "number",
      owner: "utils/auth.js",
      purpose: "Access token expiry (Unix ms)"
    },
    OMDB_API_KEY: {
      key: "oep_omdb_api_key",
      store: "gm",
      format: "string",
      owner: "utils/omdb.js",
      purpose: "OMDB API key"
    },
    BEATMAP_ATTRIBUTES_CACHE: {
      key: "oep.beatmapAttributesCache.v1",
      store: "gm",
      format: "json",
      owner: "features/profile/beatmap-attributes.js",
      purpose: "Modded star rating cache (up to 600 entries, ~40KB)"
    },
    SR_CACHE_VERSION: {
      key: "oep.srCacheVersion",
      store: "gm",
      format: "string",
      owner: "features/profile/beatmap-attributes.js",
      purpose: "Version stamp; a mismatch clears the attributes cache"
    },
    PROFILE_BADGES_COLLAPSED: {
      key: "userProfile.profileBadgesCollapsed",
      store: "gm",
      format: "boolean",
      owner: "features/profile/badges.js",
      purpose: "Profile badge strip collapsed"
    },
    PROFILE_SUBSECTIONS_COLLAPSED: {
      key: "userProfile.profileSubsectionsCollapsed",
      store: "gm",
      format: "json",
      owner: "features/profile/subsections.js",
      purpose: "Collapsed profile subsections (older title and index keys migrate here, B47)"
    },
    PROFILE_SECTIONS_COLLAPSED: {
      key: "userProfile.profileSectionsCollapsed",
      store: "gm",
      format: "json",
      owner: "features/profile/sections.js",
      purpose: "Collapsed profile sections"
    },
    LISTING_PREFERRED_MODE: {
      key: "beatmapsetsListing.preferredMode",
      store: "gm",
      format: "string",
      owner: "features/listing-mode.js",
      purpose: "Last ruleset picked on the beatmap listing (`m` param)"
    },
    RANKS_PERIOD: {
      key: "oep.profile.ranksPeriod",
      store: "gm",
      format: "json",
      owner: "features/profile/ranks-period.js",
      purpose: "Last Ranks period highlight, `{ period, reversed }`, restored on the next profile"
    },
    PREVIEW_MUSIC_VOLUME_LEGACY: {
      key: "beatmapPreview.musicVolume",
      store: "gm",
      format: "number",
      owner: "features/beatmap-preview/prefs.js",
      purpose: "Legacy; read once to migrate to localStorage"
    },
    PREVIEW_HITSOUND_VOLUME_LEGACY: {
      key: "beatmapPreview.hitsoundVolume",
      store: "gm",
      format: "number",
      owner: "features/beatmap-preview/prefs.js",
      purpose: "Legacy; read once to migrate to localStorage"
    },
    PREVIEW_MUSIC_VOLUME: {
      key: "oep.beatmapPreview.musicVolume",
      store: "localStorage",
      format: "number",
      owner: "features/beatmap-preview/prefs.js",
      purpose: "Gameplay preview music volume (site localStorage)"
    },
    PREVIEW_HITSOUND_VOLUME: {
      key: "oep.beatmapPreview.hitsoundVolume",
      store: "localStorage",
      format: "number",
      owner: "features/beatmap-preview/prefs.js",
      purpose: "Gameplay preview hitsound volume (site localStorage)"
    },
    PREVIEW_AUDIO_OFFSET: {
      key: "oep.beatmapPreview.audioOffsetMs",
      store: "localStorage",
      format: "number",
      owner: "features/beatmap-preview/prefs.js",
      purpose: "Gameplay preview audio offset in ms (site localStorage)"
    }
  });
  var SETTINGS_MIGRATION_KEY_PREFIX = "userProfile.";
  function keyName(key) {
    return typeof key === "string" ? key : key.key;
  }
  function getBool(key, fallback = false) {
    try {
      const v = GM_getValue(keyName(key), void 0);
      return typeof v === "boolean" ? v : fallback;
    } catch {
      return fallback;
    }
  }
  function deleteKey(key) {
    try {
      GM_deleteValue(keyName(key));
      return true;
    } catch {
      return false;
    }
  }
  function setBool(key, value) {
    try {
      GM_setValue(keyName(key), Boolean(value));
      return true;
    } catch {
      return false;
    }
  }
  function getString(key, fallback = null) {
    try {
      const v = GM_getValue(keyName(key), void 0);
      return typeof v === "string" ? v : fallback;
    } catch {
      return fallback;
    }
  }
  function setString(key, value) {
    try {
      GM_setValue(keyName(key), String(value));
      return true;
    } catch {
      return false;
    }
  }
  function getJSON(key, fallback) {
    try {
      const raw = GM_getValue(keyName(key), void 0);
      if (raw === void 0 || raw === null || raw === "") return fallback;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return fallback;
    }
  }
  function setJSON(key, value) {
    try {
      GM_setValue(keyName(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  // src/core/log.js
  var PREFIX = "[osu! Expert+]";
  var DEBUG_KEY = KEYS.DEBUG.key;
  var debugEnabled = null;
  function isDebugEnabled() {
    if (debugEnabled === null) {
      try {
        debugEnabled = typeof GM_getValue === "function" && GM_getValue(DEBUG_KEY) === true;
      } catch {
        debugEnabled = false;
      }
    }
    return debugEnabled;
  }
  function createLogger(scope) {
    const head = scope ? [`${PREFIX} [${scope}]`] : [PREFIX];
    return {
      /** @param {...unknown} args */
      debug(...args) {
        if (isDebugEnabled()) console.debug(...head, ...args);
      },
      /** @param {...unknown} args */
      info(...args) {
        if (isDebugEnabled()) console.info(...head, ...args);
      },
      /** @param {...unknown} args */
      warn(...args) {
        console.warn(...head, ...args);
      },
      /** @param {...unknown} args */
      error(...args) {
        console.error(...head, ...args);
      }
    };
  }
  var log = createLogger();

  // src/core/lifecycle.js
  function safeStart(bag, fn, label = "feature") {
    try {
      const cleanup = fn();
      if (typeof cleanup === "function") bag.add(cleanup);
      return true;
    } catch (err) {
      log.error(`failed to start ${label}:`, err);
      return false;
    }
  }
  function mountSettingFeature(bag, settings2, id, mount) {
    let dispose = null;
    let mounted = false;
    const unmount = () => {
      if (!mounted) return;
      mounted = false;
      const fn = dispose;
      dispose = null;
      if (!fn) return;
      try {
        fn();
      } catch (err) {
        log.warn(`failed to dispose ${id}:`, err);
      }
    };
    const sync = (on) => {
      if (on && !mounted) {
        mounted = true;
        try {
          const result = mount();
          dispose = typeof result === "function" ? result : null;
        } catch (err) {
          log.error(`failed to start ${id}:`, err);
          dispose = null;
        }
      } else if (!on) {
        unmount();
      }
    };
    const unsubscribe = settings2.onChange(id, (on) => sync(!!on));
    bag.add(() => {
      unsubscribe();
      unmount();
    });
    sync(settings2.isEnabled(id));
  }
  function createGeneration() {
    let gen = 0;
    return {
      next: () => ++gen,
      current: () => gen,
      isCurrent: (token) => token === gen
    };
  }
  function listen(target, type, handler, signal, options) {
    if (signal.aborted) return;
    target.addEventListener(type, handler, options);
    signal.addEventListener(
      "abort",
      () => target.removeEventListener(type, handler, options),
      { once: true }
    );
  }

  // src/core/observe.js
  function createObserverHub(deps = {}) {
    const getRoot = deps.root ?? (() => document.documentElement);
    const now = deps.now ?? (() => performance.now());
    const requestFrame = deps.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
    const setTimer = deps.setTimer ?? ((cb, ms) => window.setTimeout(cb, ms));
    const clearTimer = deps.clearTimer ?? ((id) => window.clearTimeout(id));
    const log6 = deps.log ?? createLogger("observe");
    const loopRate = deps.loopRate ?? 10;
    const loopSeconds = deps.loopSeconds ?? 5;
    const subs = /* @__PURE__ */ new Set();
    let observer = null;
    let configKey = "";
    function nodeHits(node, selector) {
      if (!(node instanceof Element)) return false;
      return node.matches(selector) || node.querySelector(selector) !== null;
    }
    function insideSelector(target, selector) {
      if (!selector) return true;
      const elNode = target instanceof Element ? target : target.parentElement;
      return !!elNode?.closest(selector);
    }
    function relevant(sub, r) {
      const { selector, characterData } = sub.opts;
      if (r.type === "childList") {
        if (!selector)
          return r.addedNodes.length > 0 || r.removedNodes.length > 0;
        for (const n of r.addedNodes) if (nodeHits(n, selector)) return true;
        for (const n of r.removedNodes) if (nodeHits(n, selector)) return true;
        return false;
      }
      if (r.type === "attributes") {
        return sub.attrs.has(r.attributeName) && insideSelector(r.target, selector);
      }
      if (r.type === "characterData") {
        return !!characterData && insideSelector(r.target, selector);
      }
      return false;
    }
    function addedOf(sub, records) {
      const { selector } = sub.opts;
      const added = [];
      for (const r of records) {
        if (r.type !== "childList") continue;
        for (const n of r.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (!selector || nodeHits(n, selector)) added.push(n);
        }
      }
      return added;
    }
    function countCall(sub) {
      sub.calls++;
      const t = now();
      if (t - sub.bucketStart >= 1e3) {
        const elapsed = Math.floor((t - sub.bucketStart) / 1e3);
        if (elapsed === 1 && sub.bucketCalls >= loopRate) sub.hotSeconds++;
        else sub.hotSeconds = 0;
        sub.bucketStart = t;
        sub.bucketCalls = 0;
      }
      sub.bucketCalls++;
      if (!sub.warned && sub.hotSeconds >= loopSeconds) {
        sub.warned = true;
        log6.warn(
          `possible observer loop: "${sub.opts.label ?? "unlabelled"}" ran ${loopRate}+ times/s for ${loopSeconds}s`
        );
      }
    }
    function flush(sub) {
      sub.timer = null;
      sub.frame = false;
      if (!sub.active || sub.pending.length === 0) return;
      const records = sub.pending;
      sub.pending = [];
      countCall(sub);
      try {
        sub.callback({ records, added: addedOf(sub, records) });
      } catch (err) {
        log6.error(`subscriber "${sub.opts.label ?? "unlabelled"}" threw:`, err);
      }
    }
    function dispatch(records) {
      for (const sub of [...subs]) {
        if (!sub.active) continue;
        let hit = false;
        for (const r of records) {
          if (relevant(sub, r)) {
            sub.pending.push(r);
            hit = true;
          }
        }
        if (!hit) continue;
        const { schedule = "raf" } = sub.opts;
        if (schedule === "sync") {
          flush(sub);
        } else if (typeof schedule === "number") {
          if (sub.timer != null) clearTimer(sub.timer);
          sub.timer = setTimer(() => flush(sub), schedule);
        } else if (!sub.frame) {
          sub.frame = true;
          requestFrame(() => flush(sub));
        }
      }
    }
    function reconfigure() {
      if (subs.size === 0) {
        if (observer) dispatch(observer.takeRecords());
        observer?.disconnect();
        observer = null;
        configKey = "";
        return;
      }
      const attrs = /* @__PURE__ */ new Set();
      let characterData = false;
      for (const sub of subs) {
        sub.attrs.forEach((a) => attrs.add(a));
        if (sub.opts.characterData) characterData = true;
      }
      const attributeFilter = [...attrs].sort();
      const key = `${attributeFilter.join(",")}|${characterData}`;
      if (observer && key === configKey) return;
      if (observer) {
        dispatch(observer.takeRecords());
        observer.disconnect();
      } else {
        observer = new MutationObserver(dispatch);
      }
      configKey = key;
      const init4 = { childList: true, subtree: true };
      if (attributeFilter.length) {
        init4.attributes = true;
        init4.attributeFilter = attributeFilter;
      }
      if (characterData) init4.characterData = true;
      observer.observe(getRoot(), init4);
    }
    function subscribe(opts, callback) {
      if (opts.signal?.aborted) return () => {
      };
      if (observer) dispatch(observer.takeRecords());
      const sub = {
        opts,
        callback,
        attrs: new Set(opts.attributes ?? []),
        pending: [],
        timer: null,
        frame: false,
        active: true,
        calls: 0,
        bucketStart: now(),
        bucketCalls: 0,
        hotSeconds: 0,
        warned: false
      };
      subs.add(sub);
      reconfigure();
      const unsubscribe = () => {
        if (!sub.active) return;
        sub.active = false;
        sub.pending = [];
        if (sub.timer != null) clearTimer(sub.timer);
        sub.timer = null;
        subs.delete(sub);
        opts.signal?.removeEventListener("abort", unsubscribe);
        reconfigure();
      };
      opts.signal?.addEventListener("abort", unsubscribe, { once: true });
      return unsubscribe;
    }
    function mutate(fn) {
      if (!observer) return fn();
      dispatch(observer.takeRecords());
      try {
        return fn();
      } finally {
        observer?.takeRecords();
      }
    }
    function stats() {
      return [...subs].map((s) => ({
        label: s.opts.label ?? "unlabelled",
        calls: s.calls,
        hotSeconds: s.hotSeconds,
        warned: s.warned
      }));
    }
    return { subscribe, mutate, stats };
  }
  var observe = createObserverHub();

  // src/core/page-hooks.js
  var page_hooks_exports = {};
  __export(page_hooks_exports, {
    addJsonResponseListener: () => addJsonResponseListener,
    addRequestRewriter: () => addRequestRewriter,
    install: () => install,
    nativeFetch: () => nativeFetch
  });

  // src/core/page-window.js
  var page_window_exports = {};
  __export(page_window_exports, {
    exposeToPage: () => exposeToPage,
    pageLocalStorage: () => pageLocalStorage,
    pageWindow: () => pageWindow
  });
  function pageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch {
    }
    return window;
  }
  function pageLocalStorage() {
    try {
      return pageWindow()?.localStorage ?? null;
    } catch {
      return null;
    }
  }
  function exposeToPage(fn, target = pageWindow()) {
    if (typeof exportFunction === "function") {
      try {
        return exportFunction(fn, target);
      } catch {
      }
    }
    return fn;
  }

  // src/core/page-hooks.js
  var log2 = createLogger("page-hooks");
  var rewriters = /* @__PURE__ */ new Set();
  var listeners = /* @__PURE__ */ new Set();
  var installed = false;
  var originalFetch = null;
  var hookedWindow = null;
  function rewriteUrl(url) {
    let out = url;
    for (const fn of rewriters) {
      try {
        const next = fn(out);
        if (typeof next === "string") out = next;
      } catch (err) {
        log2.warn("request rewriter threw:", err);
      }
    }
    return out;
  }
  function absoluteUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch {
      return null;
    }
  }
  function listenersFor(abs) {
    const hits = [];
    for (const l of listeners) {
      try {
        if (l.match(abs)) hits.push(l);
      } catch (err) {
        log2.warn("response matcher threw:", err);
      }
    }
    return hits;
  }
  function deliver(hits, abs, json) {
    for (const l of hits) {
      try {
        l.onJson(abs, json);
      } catch (err) {
        log2.warn("response listener threw:", err);
      }
    }
  }
  function hookXhr(pw) {
    const proto = pw.XMLHttpRequest?.prototype;
    if (!proto || typeof proto.open !== "function") return;
    const nativeOpen = proto.open;
    const urls = /* @__PURE__ */ new WeakMap();
    const onLoad = exposeToPage(function onLoad2() {
      const url = urls.get(this);
      if (!url || listeners.size === 0) return;
      if (this.status < 200 || this.status >= 300) return;
      const abs = absoluteUrl(url);
      if (!abs) return;
      const hits = listenersFor(abs);
      if (!hits.length) return;
      let json;
      const type = this.responseType;
      try {
        if (type === "" || type === "text") json = JSON.parse(this.responseText);
        else if (type === "json") json = this.response;
        else return;
      } catch {
        return;
      }
      if (json != null) deliver(hits, abs, json);
    }, pw);
    proto.open = exposeToPage(function open(method, url, ...rest) {
      const raw = typeof url === "string" ? url : String(url ?? "");
      const next = rewriters.size ? rewriteUrl(raw) : raw;
      if (!urls.has(this)) this.addEventListener("load", onLoad);
      urls.set(this, next);
      return nativeOpen.call(this, method, next, ...rest);
    }, proto);
  }
  function rewriteFetchInput(pw, input) {
    if (typeof input === "string") {
      const url = rewriteUrl(input);
      return { input: url, url };
    }
    if (input instanceof pw.URL || input instanceof URL) {
      const url = rewriteUrl(input.toString());
      return { input: url, url };
    }
    if (input && typeof input === "object" && "url" in input) {
      const before = String(input.url);
      const url = rewriteUrl(before);
      if (url !== before) return { input: new pw.Request(url, input), url };
      return { input, url };
    }
    return { input, url: "" };
  }
  function hookFetch(pw) {
    if (typeof pw.fetch !== "function") return;
    originalFetch = pw.fetch;
    const native = originalFetch;
    pw.fetch = exposeToPage(function fetch2(input, init4) {
      let req = input;
      let url = "";
      try {
        ({ input: req, url } = rewriteFetchInput(pw, input));
      } catch (err) {
        log2.warn("fetch rewrite failed:", err);
      }
      const promise = native.call(pw, req, init4);
      if (listeners.size && url) {
        const abs = absoluteUrl(url);
        const hits = abs ? listenersFor(abs) : [];
        if (hits.length) {
          promise.then((res) => {
            if (!res.ok) return;
            return res.clone().json().then((json) => deliver(hits, abs, json));
          }).catch(() => {
          });
        }
      }
      return promise;
    }, pw);
  }
  function install() {
    if (installed) return;
    installed = true;
    const pw = pageWindow();
    hookedWindow = pw;
    try {
      hookXhr(pw);
    } catch (err) {
      log2.warn("could not hook XMLHttpRequest:", err);
    }
    try {
      hookFetch(pw);
    } catch (err) {
      log2.warn("could not hook fetch:", err);
    }
  }
  function addRequestRewriter(fn) {
    install();
    rewriters.add(fn);
    return () => void rewriters.delete(fn);
  }
  function addJsonResponseListener(listener) {
    install();
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }
  function nativeFetch() {
    install();
    const pw = hookedWindow;
    if (originalFetch && pw) return originalFetch.bind(pw);
    return null;
  }

  // src/core/routes.js
  var routes_exports = {};
  __export(routes_exports, {
    ACCOUNT_EDIT_RE: () => ACCOUNT_EDIT_RE,
    BEATMAPSETS_LISTING_RE: () => BEATMAPSETS_LISTING_RE,
    BEATMAPSET_DISCUSSION_RE: () => BEATMAPSET_DISCUSSION_RE,
    BEATMAPSET_RE: () => BEATMAPSET_RE,
    DISCUSSION_REVIEWS_TOTAL_RE: () => DISCUSSION_REVIEWS_TOTAL_RE,
    USER_PROFILE_RE: () => USER_PROFILE_RE,
    beatmapsetIdFromPath: () => beatmapsetIdFromPath,
    discussionPath: () => discussionPath,
    discussionTotalPath: () => discussionTotalPath,
    isAccountEdit: () => isAccountEdit,
    isBeatmapsetDiscussion: () => isBeatmapsetDiscussion,
    isBeatmapsetsListing: () => isBeatmapsetsListing,
    isDiscussionReviewsTotal: () => isDiscussionReviewsTotal,
    isUserProfile: () => isUserProfile
  });
  var ACCOUNT_EDIT_RE = /^\/home\/account\/edit/;
  var BEATMAPSET_RE = /^\/beatmapsets\/(\d+)/;
  var BEATMAPSET_DISCUSSION_RE = /^\/beatmapsets\/(\d+)\/discussion(?:\/|$)/;
  var DISCUSSION_REVIEWS_TOTAL_RE = /^\/beatmapsets\/\d+\/discussion\/-\/reviews\/total(?:\/|$)/i;
  var BEATMAPSETS_LISTING_RE = /^\/beatmapsets\/?$/;
  var USER_PROFILE_RE = /^\/users\//;
  function isAccountEdit(path) {
    return ACCOUNT_EDIT_RE.test(path);
  }
  function isBeatmapsetsListing(path) {
    return BEATMAPSETS_LISTING_RE.test(path);
  }
  function beatmapsetIdFromPath(path) {
    const m = BEATMAPSET_RE.exec(path);
    return m ? Number(m[1]) : null;
  }
  function isBeatmapsetDiscussion(path) {
    return BEATMAPSET_DISCUSSION_RE.test(path);
  }
  function isUserProfile(path) {
    return USER_PROFILE_RE.test(path);
  }
  function isDiscussionReviewsTotal(path) {
    return DISCUSSION_REVIEWS_TOTAL_RE.test(path);
  }
  function discussionPath(beatmapsetId) {
    return `/beatmapsets/${beatmapsetId}/discussion`;
  }
  function discussionTotalPath(beatmapsetId) {
    return `${discussionPath(beatmapsetId)}/-/generalAll/total`;
  }

  // src/core/bridge.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  window.OsuExpertPlus.core = Object.freeze({
    createLogger,
    lifecycle: lifecycle_exports,
    log,
    observe,
    pageHooks: page_hooks_exports,
    pageWindow: page_window_exports,
    routes: routes_exports,
    storage: storage_exports
  });
  window.OsuExpertPlus.kirino = kirino_exports;
  window.OsuExpertPlus.osu = osu_exports;
  window.OsuExpertPlus.editor = editor_exports;

  // src/core/router.js
  var log3 = createLogger("router");
  function wrapReachesPage() {
    try {
      return pageWindow().history.pushState === history.pushState;
    } catch {
      return false;
    }
  }
  function runCleanup(fn) {
    try {
      fn();
    } catch (err) {
      log3.warn("page cleanup failed:", err);
    }
  }
  var Router = class {
    /**
     * @param {Record<string, PageModule>} pages  `OsuExpertPlus.pages`
     */
    constructor(pages) {
      this._routes = [
        { pattern: ACCOUNT_EDIT_RE, module: pages.accountEdit },
        // Before beatmapDetail: discussion paths also match BEATMAPSET_RE.
        { pattern: BEATMAPSET_DISCUSSION_RE, module: pages.beatmapDiscussion },
        { pattern: BEATMAPSET_RE, module: pages.beatmapDetail },
        { pattern: BEATMAPSETS_LISTING_RE, module: pages.beatmapsetsListing },
        { pattern: USER_PROFILE_RE, module: pages.userProfile }
      ];
      this._currentPath = null;
      this._cleanupFn = null;
      this._abort = null;
    }
    /** Start the router, run the matching module, and watch for SPA navigation. */
    init() {
      this._navigate(location.pathname);
      this._watchNavigation();
    }
    /** @param {string} path */
    _navigate(path) {
      if (path === this._currentPath) return;
      this._currentPath = path;
      this._abort?.abort();
      this._abort = null;
      if (typeof this._cleanupFn === "function") {
        const fn = this._cleanupFn;
        this._cleanupFn = null;
        runCleanup(fn);
      }
      for (const route of this._routes) {
        const match = path.match(route.pattern);
        if (!match) continue;
        const controller = new AbortController();
        this._abort = controller;
        const ctx = { match, signal: controller.signal, path };
        try {
          const result = route.module.init(match, ctx);
          if (result && typeof result.then === "function") {
            result.then((fn) => {
              if (this._currentPath === path && !controller.signal.aborted) {
                this._cleanupFn = typeof fn === "function" ? fn : null;
              } else if (typeof fn === "function") {
                runCleanup(fn);
              }
            }).catch((err) => log3.warn(`init failed for ${path}:`, err));
          } else {
            this._cleanupFn = typeof result === "function" ? result : null;
          }
        } catch (err) {
          log3.warn(`init failed for ${path}:`, err);
        }
        return;
      }
    }
    /**
     * pushState/replaceState wrap and popstate (clears path first). Under
     * Tampermonkey in Chrome the wrap lands on the page's own history, so
     * osu-web's Turbo visits and React tab changes all pass through it. Where it
     * does not (Firefox Xray keeps it on the sandbox's view), a pathname poll
     * stands in.
     */
    _watchNavigation() {
      const navigate = this._navigate.bind(this);
      const wrap = (original) => function(...args) {
        const result = original.apply(this, args);
        navigate(location.pathname);
        return result;
      };
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
      window.addEventListener("popstate", () => {
        this._currentPath = null;
        navigate(location.pathname);
      });
      if (!wrapReachesPage()) {
        let polledPath = location.pathname;
        setInterval(() => {
          const path = location.pathname;
          if (path !== polledPath) {
            polledPath = path;
            navigate(path);
          }
        }, 200);
      }
    }
  };

  // src/features/listing-mode.js
  var STORED_ANY = "any";
  function getPreferredMode() {
    const v = getString(KEYS.LISTING_PREFERRED_MODE);
    if (v == null) return "0";
    if (v === STORED_ANY) return null;
    return /^[0123]$/.test(v) ? v : "0";
  }
  function setPreferredMode(m) {
    if (m == null || m === "") {
      setString(KEYS.LISTING_PREFERRED_MODE, STORED_ANY);
    } else if (/^[0123]$/.test(m)) {
      setString(KEYS.LISTING_PREFERRED_MODE, m);
    }
  }
  function advancedBeatmapSearch() {
    const root = document.querySelector('.js-react[data-react="beatmaps"]');
    if (!root) return null;
    return root.getAttribute("data-advanced-search") === "1";
  }
  var FILTER_ITEM_SEL = "a.beatmapsets-search-filter__item";
  function isModeFilterAnchor(a) {
    const group = a.closest(".beatmapsets-search-filter");
    if (!group) return false;
    const values = Array.from(
      group.querySelectorAll(`${FILTER_ITEM_SEL}[data-filter-value]`),
      (item) => item.getAttribute("data-filter-value") ?? ""
    );
    return values.length > 0 && values.every((v) => /^[0123]$/.test(v));
  }
  function findModeFilterItem(mode) {
    for (const a of document.querySelectorAll(
      `${FILTER_ITEM_SEL}[data-filter-value="${CSS.escape(mode)}"]`
    )) {
      if (a instanceof HTMLElement && isModeFilterAnchor(a)) return a;
    }
    return null;
  }
  function persistFromListingLocation() {
    if (!isBeatmapsetsListing(location.pathname)) return;
    const m = new URLSearchParams(location.search).get("m");
    if (m == null || m === "") {
      setPreferredMode(null);
    } else if (/^[0123]$/.test(m)) {
      setPreferredMode(m);
    }
    patchListingAnchors();
  }
  function patchListingAnchors() {
    const pref = getPreferredMode();
    if (pref == null) return;
    const nodes = document.querySelectorAll('a[href*="/beatmapsets"]');
    for (const a of nodes) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      let u;
      try {
        u = new URL(a.href);
      } catch (_) {
        continue;
      }
      if (u.hostname !== "osu.ppy.sh") continue;
      if (!isBeatmapsetsListing(u.pathname)) continue;
      if (u.searchParams.has("m")) continue;
      u.searchParams.set("m", pref);
      const rel = u.pathname + u.search + u.hash;
      const attr = a.getAttribute("href");
      if (attr != null && /^https?:\/\//i.test(attr)) {
        a.href = u.toString();
      } else {
        a.setAttribute("href", rel);
      }
    }
  }
  function installLinkPatcher() {
    patchListingAnchors();
    return observe.subscribe(
      { schedule: 200, label: "listing-mode/link-patcher" },
      () => patchListingAnchors()
    );
  }
  function clickReplacingHistory(el2) {
    let history2 = null;
    try {
      history2 = pageWindow()?.Turbo?.session?.history ?? null;
    } catch {
      history2 = null;
    }
    const push = history2?.push;
    if (typeof push !== "function" || typeof history2.replace !== "function") {
      el2.click();
      return;
    }
    const ownPush = Object.hasOwn(history2, "push");
    history2.push = exposeToPage(function(location2, restorationIdentifier) {
      return history2.replace(location2, restorationIdentifier);
    }, history2);
    try {
      el2.click();
    } finally {
      if (ownPush) history2.push = push;
      else delete history2.push;
    }
  }
  function startPageBehavior() {
    const ac = new AbortController();
    let applied = false;
    const tryApplyPreferred = () => {
      if (applied) return;
      if (!isBeatmapsetsListing(location.pathname)) return;
      const advanced = advancedBeatmapSearch();
      if (advanced === null) return;
      if (!advanced) {
        applied = true;
        return;
      }
      const pref = getPreferredMode();
      if (pref == null) {
        applied = true;
        return;
      }
      const cur = new URLSearchParams(location.search).get("m");
      if (cur != null && cur !== "") {
        applied = true;
        return;
      }
      const el2 = findModeFilterItem(pref);
      if (!el2) return;
      clickReplacingHistory(el2);
      applied = true;
    };
    const stopWaiting = () => {
      ac.abort();
      applied = true;
    };
    tryApplyPreferred();
    if (!applied) {
      observe.subscribe(
        { schedule: 60, signal: ac.signal, label: "listing-mode/apply" },
        () => {
          tryApplyPreferred();
          if (applied) ac.abort();
        }
      );
    }
    const cap = window.setTimeout(stopWaiting, 2e4);
    const onDocClick = (e) => {
      if (!isBeatmapsetsListing(location.pathname)) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest(FILTER_ITEM_SEL);
      if (!(a instanceof HTMLAnchorElement)) return;
      if (!isModeFilterAnchor(a)) return;
      window.setTimeout(persistFromListingLocation, 200);
    };
    document.addEventListener("click", onDocClick, true);
    return () => {
      ac.abort();
      window.clearTimeout(cap);
      document.removeEventListener("click", onDocClick, true);
    };
  }

  // src/utils/dom.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.dom = /* @__PURE__ */ (() => {
    function qs(selector, root = document) {
      return root.querySelector(selector);
    }
    function qsa2(selector, root = document) {
      return Array.from(root.querySelectorAll(selector));
    }
    function el2(tag, attrs = {}, ...children) {
      const element = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === "class") {
          element.className = value;
        } else if (key.startsWith("on") && typeof value === "function") {
          element.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === "style" && value != null && typeof value === "object") {
          Object.assign(
            element.style,
            /** @type {object} */
            value
          );
        } else {
          element.setAttribute(key, value === true ? "" : value);
        }
      }
      for (const child of children) {
        if (typeof child === "string") {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
          element.appendChild(child);
        }
      }
      return element;
    }
    function waitOptions(a, b, defaultTimeout) {
      const isOpts = (v) => v != null && typeof v === "object" && !(v instanceof Node);
      const opts = isOpts(a) ? a : isOpts(b) ? b : {};
      const timeout = typeof a === "number" ? a : opts.timeout ?? defaultTimeout;
      const root = b instanceof Node ? b : opts.root ?? document.documentElement;
      return { timeout, root, signal: opts.signal };
    }
    function abortError() {
      return new DOMException("The operation was aborted.", "AbortError");
    }
    function waitForStaleElementToLeave2(selector, timeoutOrOpts, rootOrOpts) {
      const { timeout, root, signal } = waitOptions(
        timeoutOrOpts,
        rootOrOpts,
        8e3
      );
      return new Promise((resolve2, reject) => {
        if (signal?.aborted) return reject(abortError());
        const stale = root.querySelector(selector);
        if (!stale || !stale.isConnected) {
          return resolve2();
        }
        let timer = 0;
        const finish = (fn) => {
          observer.disconnect();
          window.clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          fn();
        };
        const onAbort = () => finish(() => reject(abortError()));
        const observer = new MutationObserver(() => {
          if (!stale.isConnected) finish(resolve2);
        });
        observer.observe(root, { childList: true, subtree: true });
        timer = window.setTimeout(() => finish(resolve2), timeout);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    function waitForElement2(selector, timeoutOrOpts, rootOrOpts) {
      const { timeout, root, signal } = waitOptions(
        timeoutOrOpts,
        rootOrOpts,
        1e4
      );
      return new Promise((resolve2, reject) => {
        if (signal?.aborted) return reject(abortError());
        const existing = root.querySelector(selector);
        if (existing) return resolve2(existing);
        let timer = 0;
        const finish = (fn) => {
          observer.disconnect();
          window.clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          fn();
        };
        const onAbort = () => finish(() => reject(abortError()));
        const observer = new MutationObserver(() => {
          const found = root.querySelector(selector);
          if (found) finish(() => resolve2(found));
        });
        observer.observe(root, { childList: true, subtree: true });
        timer = window.setTimeout(() => {
          finish(
            () => reject(
              new Error(
                `waitForElement: "${selector}" not found within ${timeout}ms`
              )
            )
          );
        }, timeout);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
    const styleRefCounts = /* @__PURE__ */ new Map();
    function manageStyle2(id, css) {
      const inject = () => {
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = css;
        document.head.appendChild(s);
      };
      const remove = () => document.getElementById(id)?.remove();
      const acquire = () => {
        styleRefCounts.set(id, (styleRefCounts.get(id) ?? 0) + 1);
        inject();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          const left = (styleRefCounts.get(id) ?? 1) - 1;
          if (left > 0) {
            styleRefCounts.set(id, left);
          } else {
            styleRefCounts.delete(id);
            remove();
          }
        };
      };
      return { inject, remove, acquire };
    }
    function createCleanupBag() {
      const fns = [];
      return {
        add(...args) {
          fns.push(...args);
        },
        dispose() {
          while (fns.length) {
            try {
              fns.pop()();
            } catch (_) {
            }
          }
        }
      };
    }
    function setTextIfChanged2(node, text) {
      if (!node) return;
      if (node.textContent !== text) node.textContent = text;
    }
    function setHiddenIfChanged2(node, hidden) {
      if (!node) return;
      const next = !!hidden;
      if (node.hidden !== next) node.hidden = next;
    }
    function setAttrIfChanged(node, name, value) {
      if (!node) return;
      if (value == null) {
        if (node.hasAttribute(name)) node.removeAttribute(name);
        return;
      }
      const next = String(value);
      if (node.getAttribute(name) !== next) node.setAttribute(name, next);
    }
    function toggleClassIfChanged(node, className, on) {
      if (!node) return;
      const next = !!on;
      if (node.classList.contains(className) !== next) {
        node.classList.toggle(className, next);
      }
    }
    function setStylePropIfChanged(node, prop, value) {
      if (!node) return;
      if (value == null || value === "") {
        if (node.style.getPropertyValue(prop) !== "") {
          node.style.removeProperty(prop);
        }
        return;
      }
      const next = String(value);
      if (node.style.getPropertyValue(prop) !== next) {
        node.style.setProperty(prop, next);
      }
    }
    function parseLocaleNumber3(str) {
      if (!str) return NaN;
      let s = String(str).trim();
      s = s.replace(/[\s\u00A0\u202F\u2009]/g, "");
      const locale = typeof window.currentLocale === "string" ? window.currentLocale : document.documentElement.lang || void 0;
      let decimalSep = ".";
      try {
        decimalSep = new Intl.NumberFormat(locale).format(1.1).replace(/\d/g, "").trim();
      } catch (_) {
      }
      const dec = decimalSep.replace(/[\s\u00A0\u202F\u2009]/g, "");
      if (dec === "." && /^\d{1,3}(,\d{3})+$/.test(s)) {
        return parseFloat(s.replace(/,/g, ""));
      }
      if (dec === "," && /^\d{1,3}(\.\d{3})+$/.test(s)) {
        return parseFloat(s.replace(/\./g, ""));
      }
      const lastComma = s.lastIndexOf(",");
      const lastPeriod = s.lastIndexOf(".");
      if (lastComma > lastPeriod) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
      return parseFloat(s);
    }
    function formatDecimalPp2(n) {
      const locale = typeof window.currentLocale === "string" ? window.currentLocale : document.documentElement.lang || void 0;
      try {
        return n.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      } catch {
        return n.toFixed(2);
      }
    }
    return {
      qs,
      qsa: qsa2,
      el: el2,
      waitForElement: waitForElement2,
      waitForStaleElementToLeave: waitForStaleElementToLeave2,
      manageStyle: manageStyle2,
      createCleanupBag,
      setTextIfChanged: setTextIfChanged2,
      setHiddenIfChanged: setHiddenIfChanged2,
      setAttrIfChanged,
      toggleClassIfChanged,
      setStylePropIfChanged,
      parseLocaleNumber: parseLocaleNumber3,
      formatDecimalPp: formatDecimalPp2
    };
  })();

  // src/utils/difficulty-colours.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.difficultyColours = /* @__PURE__ */ (() => {
    const DIFF_DOMAIN = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
    const DIFF_RANGE = [
      "#4290FB",
      "#4FC0FF",
      "#4FFFD5",
      "#7CFF4F",
      "#F6F05C",
      "#FF8068",
      "#FF4E6F",
      "#C645B8",
      "#6563DE",
      "#18158E",
      "#000000"
    ];
    const TEXT_SR_DOMAIN = [9, 9.9, 10.6, 11.5, 12.4];
    const TEXT_SR_RANGE = [
      "#F6F05C",
      "#FF8068",
      "#FF4E6F",
      "#C645B8",
      "#B0A8FF",
      "#E4E2FF"
    ];
    function hexToRgb(hex) {
      const n = parseInt(hex.slice(1), 16);
      return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
    }
    function rgbToHex(r, g, b) {
      const clamp = (x) => Math.max(0, Math.min(255, Math.round(x)));
      return `#${[clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    }
    const GAMMA = 2.2;
    function gammaChannel(a, b, t) {
      const ag = Math.pow(a, GAMMA);
      return Math.pow(ag + t * (Math.pow(b, GAMMA) - ag), 1 / GAMMA);
    }
    function interpolate(from, to, t) {
      const a = hexToRgb(from);
      const b = hexToRgb(to);
      return rgbToHex(
        gammaChannel(a.r, b.r, t),
        gammaChannel(a.g, b.g, t),
        gammaChannel(a.b, b.b, t)
      );
    }
    function getDiffColour(sr) {
      if (sr < 0.1) return "#AAAAAA";
      if (sr >= 9) return "#000000";
      for (let i = 0; i < DIFF_DOMAIN.length - 1; i++) {
        const d0 = DIFF_DOMAIN[i];
        const d1 = DIFF_DOMAIN[i + 1];
        if (sr >= d0 && sr < d1) {
          const t = (sr - d0) / (d1 - d0);
          return interpolate(DIFF_RANGE[i], DIFF_RANGE[i + 1], t);
        }
      }
      return "#000000";
    }
    function getDiffTextColour(sr) {
      if (sr < 6.5) return "#000000";
      if (sr < 9) return "#F6F05C";
      if (sr >= 12.4) return "#E4E2FF";
      for (let i = 0; i < TEXT_SR_DOMAIN.length - 1; i++) {
        const d0 = TEXT_SR_DOMAIN[i];
        const d1 = TEXT_SR_DOMAIN[i + 1];
        if (sr >= d0 && sr < d1) {
          const t = (sr - d0) / (d1 - d0);
          return interpolate(TEXT_SR_RANGE[i], TEXT_SR_RANGE[i + 1], t);
        }
      }
      return "#E4E2FF";
    }
    return { getDiffColour, getDiffTextColour };
  })();

  // src/utils/auth.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.auth = (() => {
    const TOKEN_ENDPOINT = "https://osu.ppy.sh/oauth/token";
    const KEY_CLIENT_ID = "oep_client_id";
    const KEY_CLIENT_SECRET = "oep_client_secret";
    const KEY_ACCESS_TOKEN = "oep_access_token";
    const KEY_TOKEN_EXPIRY = "oep_token_expiry";
    let _fetchPromise = null;
    let _generation = 0;
    const FAILURE_TTL_MS = 5 * 60 * 1e3;
    let _failure = null;
    function getClientId() {
      return GM_getValue(KEY_CLIENT_ID, "");
    }
    function getClientSecret() {
      return GM_getValue(KEY_CLIENT_SECRET, "");
    }
    function isConfigured() {
      return Boolean(getClientId() && getClientSecret());
    }
    function hasSecret() {
      return Boolean(getClientSecret());
    }
    function currentFailure() {
      if (!_failure) return null;
      if (_failure.generation !== _generation || Date.now() >= _failure.until) {
        _failure = null;
        return null;
      }
      return _failure.error;
    }
    function getStatus() {
      if (!isConfigured()) return "unset";
      return currentFailure() ? "error" : "ok";
    }
    function setCredentials(clientId, clientSecret) {
      GM_setValue(KEY_CLIENT_ID, clientId.trim());
      GM_setValue(KEY_CLIENT_SECRET, clientSecret.trim());
      clearCachedToken();
    }
    function clearCredentials() {
      GM_deleteValue(KEY_CLIENT_ID);
      GM_deleteValue(KEY_CLIENT_SECRET);
      clearCachedToken();
    }
    function clearCachedToken() {
      GM_deleteValue(KEY_ACCESS_TOKEN);
      GM_deleteValue(KEY_TOKEN_EXPIRY);
      _fetchPromise = null;
      _failure = null;
      _generation++;
    }
    function getCachedToken() {
      const token = GM_getValue(KEY_ACCESS_TOKEN, "");
      const expiry = GM_getValue(KEY_TOKEN_EXPIRY, 0);
      if (token && Date.now() < expiry - 6e4) return token;
      return null;
    }
    async function requestToken(clientId, clientSecret) {
      if (!clientId || !clientSecret) {
        throw new Error("[osu! Expert+] OAuth credentials not configured.");
      }
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "public"
      });
      const resp = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(
          `[osu! Expert+] Token request failed (${resp.status}): ${text}`
        );
      }
      const data = await resp.json();
      const token = data.access_token;
      const expiresIn = data.expires_in ?? 86400;
      if (!token) {
        throw new Error("[osu! Expert+] Token response had no access_token.");
      }
      return { token, expiresAt: Date.now() + expiresIn * 1e3 };
    }
    function storeToken(t) {
      GM_setValue(KEY_ACCESS_TOKEN, t.token);
      GM_setValue(KEY_TOKEN_EXPIRY, t.expiresAt);
    }
    async function fetchNewToken() {
      const generation = _generation;
      try {
        const t = await requestToken(getClientId(), getClientSecret());
        if (generation !== _generation) {
          return getToken();
        }
        storeToken(t);
        return t.token;
      } catch (err) {
        if (generation === _generation) {
          _failure = {
            error: err instanceof Error ? err : new Error(String(err)),
            until: Date.now() + FAILURE_TTL_MS,
            generation
          };
        }
        throw err;
      }
    }
    async function verifyAndSaveCredentials(clientId, clientSecret) {
      const id = String(clientId || "").trim();
      const secret = String(clientSecret || "").trim() || getClientSecret();
      const t = await requestToken(id, secret);
      GM_setValue(KEY_CLIENT_ID, id);
      GM_setValue(KEY_CLIENT_SECRET, secret);
      clearCachedToken();
      storeToken(t);
    }
    async function getToken() {
      if (!isConfigured()) return null;
      const cached = getCachedToken();
      if (cached) return cached;
      const failed = currentFailure();
      if (failed) throw failed;
      if (!_fetchPromise) {
        const p = fetchNewToken().finally(() => {
          if (_fetchPromise === p) _fetchPromise = null;
        });
        _fetchPromise = p;
      }
      return _fetchPromise;
    }
    async function getAuthHeader() {
      const token = await getToken();
      return token ? `Bearer ${token}` : null;
    }
    return {
      isConfigured,
      hasSecret,
      getClientId,
      getStatus,
      verifyAndSaveCredentials,
      setCredentials,
      clearCredentials,
      clearCachedToken,
      getToken,
      getAuthHeader
    };
  })();

  // src/utils/api.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.api = (() => {
    const BASE = "https://osu.ppy.sh/api/v2";
    const SITE_ORIGIN = "https://osu.ppy.sh";
    const LAZER_SCORE_API_VERSION = "20240529";
    const SITE_MAX_CONCURRENT = 2;
    const SITE_MIN_START_GAP_MS = 250;
    const BUDGET_WINDOW_MS = 60 * 1e3;
    const API_BUDGET_PER_WINDOW = 600;
    const WEB_BUDGET_PER_WINDOW = 60;
    const _budgets = {
      api: { limit: API_BUDGET_PER_WINDOW, log: [] },
      web: { limit: WEB_BUDGET_PER_WINDOW, log: [] }
    };
    function _budgetWaitMs(bucket, cost, now) {
      while (bucket.log.length && now - bucket.log[0].t >= BUDGET_WINDOW_MS) {
        bucket.log.shift();
      }
      let used = bucket.log.reduce((sum, e) => sum + e.cost, 0);
      if (used + cost <= bucket.limit) return 0;
      for (const e of bucket.log) {
        used -= e.cost;
        if (used + cost <= bucket.limit) return e.t + BUDGET_WINDOW_MS - now;
      }
      return 0;
    }
    function _requestBucketAndCost(url) {
      const u = new URL(url, SITE_ORIGIN);
      if (!u.pathname.startsWith("/api/")) return { bucket: "web", cost: 1 };
      if (u.pathname === "/api/v2/users") {
        return {
          bucket: "api",
          cost: Math.max(1, u.searchParams.getAll("ids[]").length)
        };
      }
      return { bucket: "api", cost: 1 };
    }
    let _siteRunning = 0;
    let _siteNextStartMs = 0;
    let _sitePumpTimer = 0;
    const _siteQueueHigh = [];
    const _siteQueueLow = [];
    function _abortError() {
      return new DOMException("The operation was aborted.", "AbortError");
    }
    function _nextSiteItem(now) {
      let waitMs = Infinity;
      for (const q of [_siteQueueHigh, _siteQueueLow]) {
        for (let i = 0; i < q.length; i++) {
          const item = q[i];
          if (item.signal?.aborted) {
            q.splice(i--, 1);
            item.reject(_abortError());
            continue;
          }
          const wait = _budgetWaitMs(_budgets[item.bucket], item.cost, now);
          if (wait === 0) {
            q.splice(i, 1);
            return { item, waitMs: 0 };
          }
          waitMs = Math.min(waitMs, wait);
        }
      }
      return { item: null, waitMs };
    }
    function _schedulePump(delayMs) {
      if (_sitePumpTimer) return;
      _sitePumpTimer = setTimeout(() => {
        _sitePumpTimer = 0;
        _pumpSiteQueue();
      }, Math.ceil(delayMs));
    }
    function _pumpSiteQueue() {
      while (_siteRunning < SITE_MAX_CONCURRENT) {
        if (!_siteQueueHigh.length && !_siteQueueLow.length) return;
        const now = performance.now();
        if (now < _siteNextStartMs) {
          _schedulePump(_siteNextStartMs - now);
          return;
        }
        const { item, waitMs } = _nextSiteItem(now);
        if (!item) {
          if (Number.isFinite(waitMs)) _schedulePump(waitMs);
          return;
        }
        _budgets[item.bucket].log.push({ t: now, cost: item.cost });
        _siteNextStartMs = now + SITE_MIN_START_GAP_MS;
        _siteRunning++;
        Promise.resolve().then(() => item.run()).then(item.resolve, item.reject).finally(() => {
          _siteRunning--;
          _pumpSiteQueue();
        });
      }
    }
    function siteFetch(url, init4 = {}, options = {}) {
      const signal = init4.signal || null;
      if (signal?.aborted) return Promise.reject(_abortError());
      const { bucket, cost } = _requestBucketAndCost(url);
      return new Promise((resolve2, reject) => {
        const queue2 = options.priority === "low" ? _siteQueueLow : _siteQueueHigh;
        queue2.push({
          run: () => fetch(url, { credentials: "include", ...init4 }),
          resolve: resolve2,
          reject,
          signal,
          bucket,
          cost
        });
        _pumpSiteQueue();
      });
    }
    function buildQuery(params = {}) {
      const usp = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === void 0 || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) usp.append(key, String(v));
        } else {
          usp.append(key, String(value));
        }
      }
      return usp.toString();
    }
    function withQuery(url, params) {
      const qs = buildQuery(params);
      return qs ? `${url}?${qs}` : url;
    }
    async function buildHeaders({ auth = true } = {}) {
      const headers = { Accept: "application/json" };
      if (auth) {
        const authHeader = await OsuExpertPlus.auth.getAuthHeader().catch(() => null);
        if (authHeader) headers["Authorization"] = authHeader;
      }
      return headers;
    }
    async function authedFetch(url, init4 = {}, options = {}) {
      const { auth = true, ...queueOptions } = options;
      const send = async () => {
        const headers = { ...await buildHeaders({ auth }), ...init4.headers };
        const resp = await siteFetch(url, { ...init4, headers }, queueOptions);
        return { resp, usedBearer: Boolean(headers.Authorization) };
      };
      const first = await send();
      if (first.resp.status !== 401 || !first.usedBearer) return first.resp;
      OsuExpertPlus.auth.clearCachedToken();
      return (await send()).resp;
    }
    function scoresQueryParams(query) {
      const params = {};
      if (query && typeof query === "object") {
        if (query.mode) params.mode = query.mode;
        if (query.legacy_only != null) params.legacy_only = query.legacy_only;
        if (query.type) params.type = query.type;
        if (query.limit != null) params.limit = query.limit;
        if (Array.isArray(query.mods) && query.mods.length) {
          params["mods[]"] = query.mods;
        }
      }
      return params;
    }
    function csrfToken() {
      const m = document.querySelector('meta[name="csrf-token"]');
      return m instanceof HTMLMetaElement ? String(m.content || "").trim() : "";
    }
    async function siteWrite(method, path, body) {
      const headers = {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest"
      };
      const csrf = csrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
      const init4 = { method, headers };
      if (body instanceof URLSearchParams) {
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        init4.body = body.toString();
      } else if (body != null) {
        init4.body = body;
      }
      const resp = await siteFetch(path, init4, { priority: "high" });
      if (!resp.ok) {
        const err = (
          /** @type {Error & { status?: number, response?: Response }} */
          new Error(`[osu! Expert+] ${method} ${path} failed (${resp.status})`)
        );
        err.status = resp.status;
        err.response = resp;
        throw err;
      }
      return resp;
    }
    const SITE_JSON = { headers: { Accept: "application/json" } };
    function fetchUserScoresPage(userId, type, query, options = {}) {
      const url = withQuery(`/users/${userId}/scores/${type}`, {
        mode: query.mode,
        limit: query.limit,
        offset: query.offset,
        include: "beatmap"
      });
      return siteFetch(url, SITE_JSON, options);
    }
    function fetchUserExtraPage(userId, page, query) {
      return siteFetch(
        withQuery(`/users/${userId}/extra-pages/${page}`, { mode: query.mode }),
        SITE_JSON
      );
    }
    function fetchUserRecentScoresWebsite(userId, query) {
      const url = withQuery(`/users/${userId}/scores/recent`, {
        mode: query.mode,
        limit: query.limit,
        offset: query.offset,
        include_fails: query.includeFails ? "1" : void 0,
        include: ["beatmap", "beatmapset"]
      });
      return siteFetch(url, SITE_JSON);
    }
    function fetchBeatmapOsuFile(beatmapId) {
      return siteFetch(
        `${SITE_ORIGIN}/osu/${encodeURIComponent(String(beatmapId))}`
      );
    }
    async function get(url, params = {}, options = {}) {
      const fullUrl = withQuery(url, params);
      const init4 = options.apiVersion ? { headers: { "x-api-version": options.apiVersion } } : {};
      const resp = await authedFetch(fullUrl, init4, {
        priority: options.priority
      });
      if (!resp.ok) {
        const err = (
          /** @type {Error & { status?: number }} */
          new Error(`[osu! Expert+] API ${resp.status}: ${fullUrl}`)
        );
        err.status = resp.status;
        throw err;
      }
      return resp.json();
    }
    function getBeatmapset(id, params = {}) {
      return get(`${BASE}/beatmapsets/${id}`, params);
    }
    function getBeatmap(beatmapId, options = {}) {
      return get(`${BASE}/beatmaps/${beatmapId}`, {}, options);
    }
    function getUser(idOrName, mode) {
      const raw = String(idOrName).trim();
      const key = /^\d+$/.test(raw) ? raw : `@${encodeURIComponent(raw)}`;
      return get(`${BASE}/users/${key}`, mode ? { mode } : {});
    }
    function getUserByName(name, mode) {
      const key = `@${encodeURIComponent(String(name).trim())}`;
      return get(`${BASE}/users/${key}`, mode ? { mode } : {});
    }
    function getUserRecentScores(userId, mode, limit = 100, offset = 0, includeFails = true) {
      return get(`${BASE}/users/${userId}/scores/recent`, {
        mode,
        limit,
        offset: String(offset),
        include_fails: includeFails ? 1 : 0,
        include: ["beatmap", "beatmapset"]
      });
    }
    function getBeatmapUserScoresAll(beatmapId, userId, query) {
      const params = {};
      if (query && typeof query === "object") {
        if (query.ruleset) params.ruleset = query.ruleset;
        if (query.mode) params.mode = query.mode;
        if (query.legacy_only != null) params.legacy_only = query.legacy_only;
      }
      return get(
        `${BASE}/beatmaps/${beatmapId}/scores/users/${userId}/all`,
        params,
        { apiVersion: LAZER_SCORE_API_VERSION }
      );
    }
    async function getBeatmapScoresWebsite(beatmapId, query, options = {}) {
      const fullUrl = withQuery(
        `${SITE_ORIGIN}/beatmaps/${beatmapId}/scores`,
        scoresQueryParams(query)
      );
      const resp = await authedFetch(fullUrl, { signal: options.signal });
      if (!resp.ok) {
        throw new Error(`[osu! Expert+] ${resp.status}: ${fullUrl}`);
      }
      const data = await resp.json();
      const scores = Array.isArray(data) ? data : data?.scores ?? data?.data?.scores ?? [];
      return { scores };
    }
    const USERS_BATCH_SIZE = 50;
    function getUsers(ids) {
      const unique = Array.from(
        new Set(
          (Array.isArray(ids) ? ids : [ids]).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
        )
      );
      if (!unique.length) return Promise.resolve([]);
      const batches = [];
      for (let i = 0; i < unique.length; i += USERS_BATCH_SIZE) {
        batches.push(unique.slice(i, i + USERS_BATCH_SIZE));
      }
      const fetchBatch = (batchIds) => get(`${BASE}/users`, { "ids[]": batchIds }).then(
        (data) => Array.isArray(data?.users) ? data.users : []
      );
      return Promise.all(batches.map(fetchBatch)).then(
        (results) => results.flat()
      );
    }
    function fetchKirinoInspectorProfile(userId, modeIndex, username = "") {
      return OsuExpertPlus.kirino.fetchInspectorProfile(
        userId,
        modeIndex,
        username
      );
    }
    function kirinoModeIndexForRuleset(ruleset) {
      return OsuExpertPlus.kirino.modeIndexForRuleset(ruleset);
    }
    async function postBeatmapAttributes(beatmapId, mods, ruleset = "osu") {
      const url = `${BASE}/beatmaps/${beatmapId}/attributes`;
      const resp = await authedFetch(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mods, ruleset })
        },
        { priority: "low" }
      );
      if (!resp.ok) {
        throw new Error(
          `[osu! Expert+] API ${resp.status}: beatmap attributes ${beatmapId}`
        );
      }
      return resp.json();
    }
    return {
      siteFetch,
      siteWrite,
      fetchUserScoresPage,
      fetchUserExtraPage,
      fetchUserRecentScoresWebsite,
      fetchBeatmapOsuFile,
      buildQuery,
      buildHeaders,
      get,
      getBeatmapset,
      getBeatmap,
      getUser,
      getUserByName,
      getUsers,
      getUserRecentScores,
      getBeatmapUserScoresAll,
      getBeatmapScoresWebsite,
      postBeatmapAttributes,
      fetchKirinoInspectorProfile,
      kirinoModeIndexForRuleset
    };
  })();

  // src/utils/omdb.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.omdb = /* @__PURE__ */ (() => {
    const KEY_API = "oep_omdb_api_key";
    const API_BASE = "https://omdb.nyahh.net";
    const MSG_BEATMAPSET_RESPONSE_UNEXPECTED = "This beatmapset may not be on OMDB, or OMDB returned an error.";
    function getApiKey() {
      return String(GM_getValue(KEY_API, "") || "").trim();
    }
    const KEY_CHANGED_EVENT = "oep-omdb-key-changed";
    function setApiKey(apiKey) {
      GM_setValue(KEY_API, String(apiKey || "").trim());
      window.dispatchEvent(new Event(KEY_CHANGED_EVENT));
    }
    function clearApiKey() {
      GM_deleteValue(KEY_API);
      window.dispatchEvent(new Event(KEY_CHANGED_EVENT));
    }
    function isConfigured() {
      return Boolean(getApiKey());
    }
    async function fetchBeatmapsetRatings(beatmapsetId) {
      const key = getApiKey();
      if (!key) return null;
      const url = `${API_BASE}/api/set.php?id=${encodeURIComponent(String(beatmapsetId))}&key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, { credentials: "omit" });
      const raw = await resp.text().catch(() => "");
      if (!resp.ok) {
        throw new Error(
          `OMDB HTTP ${resp.status}${raw ? `: ${raw.slice(0, 160)}` : ""}`
        );
      }
      let data;
      try {
        data = raw.trim() ? JSON.parse(raw) : null;
      } catch {
        throw new Error(MSG_BEATMAPSET_RESPONSE_UNEXPECTED);
      }
      const list = Array.isArray(data) ? data : Array.isArray(data?.Difficulties) ? data.Difficulties : null;
      if (!list) {
        throw new Error(MSG_BEATMAPSET_RESPONSE_UNEXPECTED);
      }
      return list;
    }
    async function rateBeatmap(beatmapId, score) {
      const key = getApiKey();
      if (!key) throw new Error("OMDB API key not configured");
      const s0 = Number(score);
      if (!Number.isFinite(s0)) throw new Error("Invalid score");
      let s;
      if (s0 === -2) {
        s = -2;
      } else {
        s = Math.round(s0 * 2) / 2;
        if (s < 0 || s > 5) throw new Error("Score must be between 0 and 5");
      }
      const url = `${API_BASE}/api/rate.php?id=${encodeURIComponent(String(beatmapId))}&key=${encodeURIComponent(key)}&score=${encodeURIComponent(String(s))}`;
      const resp = await fetch(url, { credentials: "omit" });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(
          `OMDB HTTP ${resp.status}${t ? `: ${t.slice(0, 160)}` : ""}`
        );
      }
      try {
        return await resp.json();
      } catch {
        return null;
      }
    }
    return {
      KEY_CHANGED_EVENT,
      getApiKey,
      setApiKey,
      clearApiKey,
      isConfigured,
      fetchBeatmapsetRatings,
      rateBeatmap
    };
  })();

  // src/utils/settings.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.settings = (() => {
    const FEATURES = [
      {
        id: "header.navRecentNotification",
        label: "Latest notification preview in header",
        description: "Shows the newest unread chat message or notification as a one-line “username: content” pill under the chat/notification counter in the top-right header, stretched left to the Twitter button (click it to open the matching popup). Hover shows the full text; truncated comments and discussion posts are fetched once with a read-only request. Uses the page’s own notification data, so nothing is marked as read.",
        group: "Header",
        default: true
      },
      {
        id: "userProfile.alwaysShowStats",
        label: "Always show play count and favourites on beatmap cards",
        description: "On user profiles and on /beatmapsets: keeps play count and favourite count visible on each beatmap card without hovering.",
        group: "Beatmap Card",
        default: true
      },
      {
        id: "userProfile.beatmapCardExtraInfo",
        label: "Extra metadata on beatmap cards",
        description: "On user profiles and the beatmap listing: shows the song’s source (“from …”) under the artist, and BPM and length under the mapper.",
        group: "Beatmap Card",
        default: true
      },
      {
        id: "userProfile.beatmapCardDifficultyRange",
        label: "Highest star rating on beatmap cards",
        description: "On user profiles and the beatmap listing: shows the set’s highest star rating (no mods) as a coloured badge after each mode’s difficulty dots.",
        group: "Beatmap Card",
        default: true
      },
      {
        id: "userProfile.fullBeatmapStatNumbers",
        label: "Exact play and favourite counts on beatmap cards",
        description: "On user profiles and the beatmap listing: shows exact play and favourite counts (e.g. 159,915 instead of 159.9K).",
        group: "Beatmap Card",
        default: true
      },
      {
        id: "userProfile.bwsRanking",
        label: "BWS and ranked score rank in profile header",
        description: "Shows extra rankings in the profile header next to global and country: BWS (badge-weighted rank) and ranked-score rank from api.kirino.sh. The badge count used for BWS can be changed for the current visit.",
        group: "User Profile",
        default: true
      },
      {
        id: "userProfile.bbcodeHelper",
        label: "BBCode helper in the me! editor",
        description: "When editing your me! page: a BBCode toolbar (formatting, colour and size pickers, imagemap editor) and a live preview.",
        group: "User Profile",
        default: true
      },
      {
        id: "userProfile.mediaOpenButtons",
        label: "Open avatar and banner images",
        description: "On user profiles, adds buttons over the avatar and the cover banner that open the full-size image in a new tab.",
        group: "User Profile",
        default: true
      },
      {
        id: "userProfile.userpageExpand",
        label: "Expand long me! pages",
        description: "On user profiles, lets a long me! page expand to its full height instead of scrolling inside its box.",
        group: "User Profile",
        default: true
      },
      {
        id: "userProfile.profileSectionCollapseRemoveFromPage",
        label: "Hide collapsed sections completely",
        description: "When enabled, collapsing a section via Contents hides the whole block until you expand it from Contents again. When disabled (default), the section heading stays on the page with “(collapsed)” and you can expand it by clicking the heading.",
        group: "User Profile",
        default: false
      },
      {
        id: "userProfile.scoreHitStatistics",
        label: "Hit statistics on profile scores",
        description: "On pinned, best performance and first place scores, and on Recent plays with failed scores (Historical): adds a colour-coded hit row (great / ok / meh / miss). Beatmap leaderboards keep hit-stat colours regardless of this option.",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.moddedStarRating",
        label: "Star rating with mods on profile scores",
        description: "On profile scores, shows the star rating with the score’s mods applied. Requires osu! API credentials.",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.scorePpDecimals",
        label: "pp decimals on scores",
        description: "On profile best performance, pinned, first place and Recent plays (Historical), and on beatmap leaderboards: shows pp to two decimal places (e.g. 610.27pp) instead of rounding to an integer in the visible text (full value stays in the tooltip/title where the site provides it).",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.scoreCardBackgrounds",
        label: "Beatmap background on profile scores",
        description: "Shows the beatmap cover art behind each score in the profile Scores section and in Recent plays with failed scores (Historical).",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.scoreCardPlaceNumber",
        label: "Place numbers on profile scores",
        description: "On best performance: shows #1, #2, … before the beatmap title. On Recent plays with failed scores (Historical): #1 is the most recent visible score, then #2, … (respects Show failed scores).",
        group: "Scores",
        default: true
      },
      {
        id: "scores.periodHighlight",
        label: "Highlight scores by date",
        description: "In the profile Scores section: a bar that highlights scores set within a chosen period (weeks to years), with reverse and reset.",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.recentScoresWithFails",
        label: "Recent plays with failed scores",
        description: "On the Historical tab, replaces osu!’s Recent plays with Expert+’s list from the API: failed scores (Show failed scores), hit statistics, pp decimals, place numbers and a score options menu. Turning it off takes full effect after reloading the profile.",
        group: "Scores",
        default: true
      },
      {
        id: "userProfile.modIconsAsAcronyms",
        label: "Mod acronyms instead of icons",
        description: "Shows mod letters (e.g. HD, DT) on score rows and beatmap leaderboards instead of sprite icons.",
        group: "Scores",
        default: false
      },
      {
        id: "userProfile.hideClMod",
        label: "Hide Classic (CL) mod",
        description: "Hides the Classic (CL) mod on score rows and leaderboards. Works whether mods are shown as icons or acronyms.",
        group: "Scores",
        default: false
      },
      {
        id: "beatmapDetail.metadataDescriptionModalButtons",
        label: "Full description and metadata buttons",
        description: 'On beatmapset pages, adds the "Show metadata" button under the artist and the "Full description" button in the info panel (each opens a modal).',
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.pickerDiffNames",
        label: "Difficulty names in the difficulty selector",
        description: "On beatmapset pages, shows each difficulty’s name and nomod star rating next to its icon in the difficulty selector.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.omdbBeatmapsetRatings",
        label: "OMDB ratings",
        description: "On beatmapset pages, shows an OMDB link to this mapset above the difficulty name. Difficulty stats, distribution popover, and star voting (0 at the left edge of the first star, then 0.5–5) need an OMDB API key in Expert+ settings.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.beatmapPreview",
        label: "Gameplay preview",
        description: "On beatmapset info pages, adds an expandable osu!standard gameplay preview played with the song preview. The renderer is downloaded from jsDelivr the first time you open it.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.backgroundButton",
        label: "Open background button",
        description: "On beatmapset pages, adds a square header button that opens the full-size beatmap background (assets.ppy.sh) in a new tab.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.beatmapsetPreviewAudioButton",
        label: "Open preview audio button",
        description: "On beatmapset info pages, adds a square header button (with icon) that opens the official preview MP3 at b.ppy.sh in a new tab.",
        group: "Beatmap Page",
        default: false
      },
      {
        id: "beatmapDetail.mp3DownloadButton",
        label: "MP3 download button (third-party)",
        description: "On beatmapset pages, adds a square header button that downloads the song as MP3 from osu.ppyd.sh, a third-party site not run by ppy.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.beatconnectDownloadButton",
        label: "Beatconnect download button",
        description: "On beatmapset pages, shows a Beatconnect.io download button beside the main .osz download link.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.discussionDefaultToTotal",
        label: "Open discussions on the Total tab",
        description: "Opening a beatmap discussion page without choosing a tab shows the Total tab (all discussions) instead of osu!’s default.",
        group: "Beatmap Page",
        default: true
      },
      {
        id: "beatmapDetail.apiExtendedLeaderboard",
        label: "Show top 100 scores",
        description: "On beatmap leaderboards, loads the top 100 scores instead of osu!’s default 50.",
        group: "Leaderboard",
        default: true
      },
      {
        id: "beatmapDetail.scoreboardPlayerLookup",
        label: "Player search bar",
        description: "On beatmap leaderboards, adds a username field that looks up a player’s scores on the current difficulty and shows them in the leaderboard. Requires osu! API credentials (Client ID and Secret above).",
        group: "Leaderboard",
        default: true
      },
      {
        id: "beatmapDetail.scoreboardModGrid",
        label: "Grouped mod filter grid",
        description: "On beatmap leaderboards, replaces the default horizontal mod strip with Expert+’s grouped grid (stable / Lazer, difficulty rows, reset, collapsible “Mod filters”). Turn off to use osu!’s original mod strip layout.",
        group: "Leaderboard",
        default: true
      },
      {
        id: "beatmapDetail.scoreboardGlobalRank",
        label: "Player global ranks",
        description: "On beatmap leaderboards, shows each player’s global rank next to their username. Requires osu! API credentials.",
        group: "Leaderboard",
        default: true
      }
    ];
    const PANEL_HIDDEN_BOOLEAN_DEFAULTS = Object.freeze({
      "userProfile.recentScoresShowFails": true,
      // Controlled solely by the always-visible checkbox above the beatmap leaderboard.
      "beatmapDetail.scoreboardHideCustomRateScores": false
    });
    (function migrateScoreListDetails() {
      const flag = "userProfile._oepScoreListDetailsMigrated";
      if (GM_getValue(flag, false)) return;
      const unset = "__oep_unset__";
      const pp = GM_getValue("userProfile.ppDecimals", unset);
      const st = GM_getValue("userProfile.bestScoreStats", unset);
      if (pp === unset && st === unset) {
        GM_setValue(flag, true);
        return;
      }
      const on = (v) => v === unset ? true : v;
      GM_setValue("userProfile.scoreListDetails", on(pp) && on(st));
      GM_deleteValue("userProfile.ppDecimals");
      GM_deleteValue("userProfile.bestScoreStats");
      GM_setValue(flag, true);
    })();
    (function migrateScoreListDetailsSplit() {
      const flag = "userProfile._oepScoreListDetailsSplitMigrated";
      if (GM_getValue(flag, false)) return;
      const unset = "__oep_unset__";
      const legacy = "userProfile.scoreListDetails";
      const v = GM_getValue(legacy, unset);
      if (v !== unset) {
        const on = Boolean(v);
        GM_setValue("userProfile.scorePpDecimals", on);
        GM_setValue("userProfile.scoreHitStatistics", on);
        GM_deleteValue(legacy);
      }
      GM_setValue(flag, true);
    })();
    (function migrateBeatmapCardDifficultyRange() {
      const flag = "userProfile._oepBeatmapCardDifficultyRangeMigrated";
      if (GM_getValue(flag, false)) return;
      const unset = "__oep_unset__";
      const newKey = "userProfile.beatmapCardDifficultyRange";
      if (GM_getValue(newKey, unset) !== unset) {
        GM_setValue(flag, true);
        return;
      }
      const extra = FEATURES.find(
        (f) => f.id === "userProfile.beatmapCardExtraInfo"
      );
      const extraDefault = extra ? extra.default : false;
      if (GM_getValue("userProfile.beatmapCardExtraInfo", extraDefault)) {
        GM_setValue(newKey, true);
      }
      GM_setValue(flag, true);
    })();
    const _listeners = /* @__PURE__ */ new Map();
    function getFeatures() {
      return FEATURES.slice();
    }
    function isEnabled(id) {
      const feature = FEATURES.find((f) => f.id === id);
      const defaultVal = feature ? feature.default : PANEL_HIDDEN_BOOLEAN_DEFAULTS[id] ?? false;
      return GM_getValue(id, defaultVal);
    }
    function set(id, value) {
      GM_setValue(id, value);
      _listeners.get(id)?.forEach((fn) => {
        try {
          fn(value);
        } catch (_) {
        }
      });
    }
    function onChange(id, fn) {
      if (!_listeners.has(id)) _listeners.set(id, /* @__PURE__ */ new Set());
      _listeners.get(id).add(fn);
      return () => _listeners.get(id)?.delete(fn);
    }
    function resetPanelTogglesToDefaults() {
      for (const f of FEATURES) {
        set(f.id, Boolean(f.default));
      }
    }
    const IDS = Object.freeze({
      ALWAYS_SHOW_STATS: "userProfile.alwaysShowStats",
      BEATMAP_CARD_EXTRA_INFO: "userProfile.beatmapCardExtraInfo",
      BEATMAP_CARD_DIFFICULTY_RANGE: "userProfile.beatmapCardDifficultyRange",
      FULL_BEATMAP_STAT_NUMBERS: "userProfile.fullBeatmapStatNumbers",
      SCORE_PP_DECIMALS: "userProfile.scorePpDecimals",
      SCORE_HIT_STATISTICS: "userProfile.scoreHitStatistics",
      MODDED_STAR_RATING: "userProfile.moddedStarRating",
      MOD_ICONS_AS_ACRONYMS: "userProfile.modIconsAsAcronyms",
      HIDE_CL_MOD: "userProfile.hideClMod",
      SCORE_CARD_BACKGROUNDS: "userProfile.scoreCardBackgrounds",
      SCORE_CARD_PLACE_NUMBER: "userProfile.scoreCardPlaceNumber",
      SCORE_PERIOD_HIGHLIGHT: "scores.periodHighlight",
      BWS_RANKING: "userProfile.bwsRanking",
      PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE: "userProfile.profileSectionCollapseRemoveFromPage",
      RECENT_SCORES_SHOW_FAILS: "userProfile.recentScoresShowFails",
      RECENT_SCORES_WITH_FAILS: "userProfile.recentScoresWithFails",
      BBCODE_HELPER: "userProfile.bbcodeHelper",
      PROFILE_MEDIA_OPEN_BUTTONS: "userProfile.mediaOpenButtons",
      USERPAGE_EXPAND: "userProfile.userpageExpand",
      METADATA_DESCRIPTION_MODAL_BUTTONS: "beatmapDetail.metadataDescriptionModalButtons",
      DISCUSSION_DEFAULT_TO_TOTAL: "beatmapDetail.discussionDefaultToTotal",
      OMDB_BEATMAPSET_RATINGS: "beatmapDetail.omdbBeatmapsetRatings",
      BEATMAP_PREVIEW: "beatmapDetail.beatmapPreview",
      BEATMAPSET_PREVIEW_AUDIO_BUTTON: "beatmapDetail.beatmapsetPreviewAudioButton",
      BEATCONNECT_DOWNLOAD_BUTTON: "beatmapDetail.beatconnectDownloadButton",
      BACKGROUND_BUTTON: "beatmapDetail.backgroundButton",
      MP3_DOWNLOAD_BUTTON: "beatmapDetail.mp3DownloadButton",
      API_EXTENDED_LEADERBOARD: "beatmapDetail.apiExtendedLeaderboard",
      SCOREBOARD_MOD_GRID: "beatmapDetail.scoreboardModGrid",
      SCOREBOARD_HIDE_CUSTOM_RATE_SCORES: "beatmapDetail.scoreboardHideCustomRateScores",
      SCOREBOARD_PLAYER_LOOKUP: "beatmapDetail.scoreboardPlayerLookup",
      PICKER_DIFF_NAMES: "beatmapDetail.pickerDiffNames",
      SCOREBOARD_GLOBAL_RANK: "beatmapDetail.scoreboardGlobalRank",
      NAV_RECENT_NOTIFICATION: "header.navRecentNotification"
    });
    return {
      IDS,
      getFeatures,
      isEnabled,
      set,
      onChange,
      resetPanelTogglesToDefaults
    };
  })();

  // src/utils/mod-icons-as-acronyms.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.modIconsAsAcronyms = (() => {
    const { el: el2 } = OsuExpertPlus.dom;
    const { IDS } = OsuExpertPlus.settings;
    const MOD_ICONS_ACRONYM_ID = IDS.MOD_ICONS_AS_ACRONYMS;
    const HIDE_CL_MOD_ID = IDS.HIDE_CL_MOD;
    const MOD_ICONS_ACRONYM_STYLE_ID = "osu-expertplus-mod-acronym-icons";
    const HIDE_CL_MOD_STYLE_ID = "osu-expertplus-hide-cl-mod";
    const MOD_ICONS_ACRONYM_ATTR = "data-oep-mod-acronym";
    const MOD_ICONS_ACRONYM_CLASS = "oep-mod-icon--acronym";
    const MOD_ICONS_ACRONYM_LABEL_CLASS = "oep-mod-acronym-label";
    const MOD_ACRONYM_REDUCTION = /* @__PURE__ */ new Set(["EZ", "NF", "HT", "DC", "NR"]);
    const MOD_ACRONYM_INCREASE = /* @__PURE__ */ new Set([
      "HR",
      "SD",
      "PF",
      "DT",
      "NC",
      "HD",
      "FL",
      "FI",
      "CO",
      "BL",
      "AC",
      "ST"
    ]);
    const MOD_ACRONYM_CONVERSION = /* @__PURE__ */ new Set([
      "CL",
      "DA",
      "MR",
      "RD",
      "DS",
      "IN",
      "CS",
      "HO",
      "TP"
    ]);
    const MOD_ACRONYM_AUTOMATION = /* @__PURE__ */ new Set(["AT", "CN", "RX", "AP", "SO"]);
    const MOD_ACRONYM_SYSTEM = /* @__PURE__ */ new Set(["TD", "SV2"]);
    const MOD_ICONS_ACRONYM_CSS = `
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon {
      background: none !important;
      background-image: none !important;
      box-shadow: none !important;
      filter: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      flex-shrink: 0;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0 0.12em;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::before,
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::after {
      display: none !important;
      content: none !important;
      mask: none !important;
      -webkit-mask: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      background: none !important;
      background-image: none !important;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS} {
      font-weight: 900;
      font-size: 0.62em;
      line-height: 1;
      text-transform: uppercase;
      pointer-events: none;
      white-space: nowrap;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--reduce {
      color: rgb(178, 255, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--increase {
      color: rgb(255, 102, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--plain {
      color: #fff;
    }
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__extender,
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__customised-indicator {
      display: none !important;
    }
    /*
     * Beatmapset “mod filter” grid (Expert+): osu-web .mod { height: 1em } fits masked icons;
     * acronym labels use real text and can clip or skew flex baseline vs row labels / piles.
     */
    [data-oep-mod-grid] .beatmap-scoreboard-mod {
      display: inline-flex !important;
      align-items: center;
      vertical-align: middle;
    }
    [data-oep-mod-grid]
      .beatmap-scoreboard-mod
      .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) {
      height: auto !important;
      min-height: 1em;
      align-items: center;
    }
  `;
    const HIDE_CL_MOD_CSS = `
    .beatmap-scoreboard-mod:has(.mod__icon[data-acronym="CL" i]),
    .mod:has(> .mod__icon[data-acronym="CL" i]) {
      display: none !important;
    }
  `;
    function modRootHasType(modRoot, typeSuffix) {
      const want = `mod--type-${typeSuffix}`.toLowerCase();
      return modRoot.className.split(/\s+/).some((c) => c.toLowerCase() === want);
    }
    function modAcronymDisplayText(modIconEl, baseAcronym) {
      const modRoot = modIconEl.closest(".mod");
      if (!(modRoot instanceof HTMLElement)) return baseAcronym;
      const extSpan = modRoot.querySelector(".mod__extender span");
      const extra = extSpan?.textContent?.trim();
      if (!extra) return baseAcronym;
      return `${baseAcronym} ${extra}`;
    }
    function modAcronymTone(modIconEl, acronymUpper) {
      const modRoot = modIconEl.closest(".mod");
      if (modRoot && modRootHasType(modRoot, "DifficultyReduction")) {
        return "reduce";
      }
      if (modRoot && modRootHasType(modRoot, "DifficultyIncrease")) {
        return "increase";
      }
      if (MOD_ACRONYM_REDUCTION.has(acronymUpper)) return "reduce";
      if (MOD_ACRONYM_INCREASE.has(acronymUpper)) return "increase";
      return "plain";
    }
    function modTypeClassForAcronym2(acronym) {
      const u = String(acronym).trim().toUpperCase();
      if (MOD_ACRONYM_REDUCTION.has(u)) return "mod--type-DifficultyReduction";
      if (MOD_ACRONYM_INCREASE.has(u)) return "mod--type-DifficultyIncrease";
      if (MOD_ACRONYM_CONVERSION.has(u) || /^\d+K$/.test(u)) {
        return "mod--type-Conversion";
      }
      if (MOD_ACRONYM_AUTOMATION.has(u)) return "mod--type-Automation";
      if (MOD_ACRONYM_SYSTEM.has(u)) return "mod--type-System";
      return "mod--type-Fun";
    }
    function injectModIconsAcronymStyles2() {
      if (document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)) return;
      const style2 = document.createElement("style");
      style2.id = MOD_ICONS_ACRONYM_STYLE_ID;
      style2.textContent = MOD_ICONS_ACRONYM_CSS;
      document.head.appendChild(style2);
    }
    function removeModIconsAcronymStyles() {
      document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)?.remove();
    }
    function injectHideClModStyles() {
      if (document.getElementById(HIDE_CL_MOD_STYLE_ID)) return;
      const style2 = document.createElement("style");
      style2.id = HIDE_CL_MOD_STYLE_ID;
      style2.textContent = HIDE_CL_MOD_CSS;
      document.head.appendChild(style2);
    }
    function removeHideClModStyles() {
      document.getElementById(HIDE_CL_MOD_STYLE_ID)?.remove();
    }
    function applyModIconsAsAcronyms2(scope) {
      const icons = [];
      if (scope instanceof Element && scope.matches(".mod__icon[data-acronym]")) {
        icons.push(scope);
      }
      if (scope.querySelectorAll) {
        scope.querySelectorAll(".mod__icon[data-acronym]").forEach((n) => {
          icons.push(n);
        });
      }
      icons.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.hasAttribute(MOD_ICONS_ACRONYM_ATTR)) return;
        const raw = node.getAttribute("data-acronym") || node.dataset?.acronym || "";
        const acronym = String(raw).trim();
        if (!acronym) return;
        node.classList.add(MOD_ICONS_ACRONYM_CLASS);
        node.setAttribute(MOD_ICONS_ACRONYM_ATTR, "1");
        const tone = modAcronymTone(node, acronym.toUpperCase());
        const labelText = modAcronymDisplayText(node, acronym);
        const label = el2(
          "span",
          {
            class: `${MOD_ICONS_ACRONYM_LABEL_CLASS} ${MOD_ICONS_ACRONYM_LABEL_CLASS}--${tone}`
          },
          labelText
        );
        node.appendChild(label);
      });
    }
    function revertModIconsAsAcronyms(scope) {
      scope.querySelectorAll(`.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]`).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
        node.classList.remove(MOD_ICONS_ACRONYM_CLASS);
        node.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
      });
    }
    function stripOepModAcronymFromClonedMod2(modRoot) {
      const icon = modRoot.querySelector(".mod__icon");
      if (!(icon instanceof HTMLElement)) return;
      icon.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
      icon.classList.remove(MOD_ICONS_ACRONYM_CLASS);
      icon.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
    }
    function startModIconsAcronymObserver(settingsApi) {
      return OsuExpertPlus.core.observe.subscribe(
        {
          selector: ".mod__icon[data-acronym]",
          schedule: "sync",
          label: "mod-icons/acronyms"
        },
        ({ added }) => {
          if (!settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID)) return;
          for (const node of added) applyModIconsAsAcronyms2(node);
        }
      );
    }
    function install2(settingsApi) {
      let stopModIconsAcronymObs = null;
      const applyModIconsAcronymFeature = (enabled) => {
        stopModIconsAcronymObs?.();
        stopModIconsAcronymObs = null;
        if (enabled) {
          injectModIconsAcronymStyles2();
          applyModIconsAsAcronyms2(document);
          stopModIconsAcronymObs = startModIconsAcronymObserver(settingsApi);
        } else {
          removeModIconsAcronymStyles();
          revertModIconsAsAcronyms(document);
        }
      };
      applyModIconsAcronymFeature(settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID));
      const applyHideClMod = (enabled) => {
        if (enabled) injectHideClModStyles();
        else removeHideClModStyles();
      };
      applyHideClMod(settingsApi.isEnabled(HIDE_CL_MOD_ID));
      const unsub = settingsApi.onChange(
        MOD_ICONS_ACRONYM_ID,
        applyModIconsAcronymFeature
      );
      const unsubHideCl = settingsApi.onChange(HIDE_CL_MOD_ID, applyHideClMod);
      return () => {
        unsub();
        unsubHideCl();
        stopModIconsAcronymObs?.();
        stopModIconsAcronymObs = null;
        revertModIconsAsAcronyms(document);
        removeModIconsAcronymStyles();
        removeHideClModStyles();
      };
    }
    return {
      applyModIconsAsAcronyms: applyModIconsAsAcronyms2,
      injectModIconsAcronymStyles: injectModIconsAcronymStyles2,
      stripOepModAcronymFromClonedMod: stripOepModAcronymFromClonedMod2,
      modTypeClassForAcronym: modTypeClassForAcronym2,
      install: install2
    };
  })();

  // src/utils/nav-recent-notification.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.navRecentNotification = (() => {
    const { el: el2, manageStyle: manageStyle2 } = OsuExpertPlus.dom;
    const { IDS } = OsuExpertPlus.settings;
    const FEATURE_ID = IDS.NAV_RECENT_NOTIFICATION;
    const STYLE_ID2 = "osu-expertplus-nav-recent-notification";
    const PILL_CLASS = "oep-nav-recent";
    const TIP_CLASS = "oep-nav-recent-tip";
    const GAP_PX = 4;
    const TIP_OFFSET_PX = 16;
    const FALLBACK_TICK_MS = 1e4;
    const CONTAINER_SEL = ".nav2 .nav2__notification-container";
    const PINNED_CLASS = "js-header-is-pinned";
    const HEADER_TRANSITION_MS = 300;
    const TRUNCATION_SUFFIX = "...";
    const CSS2 = `
    .${PILL_CLASS} {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 5px;
      height: 20px;
      padding: 0 8px;
      border: 2px solid #fff;
      border-radius: 30px;
      color: #fff;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      cursor: pointer;
      z-index: 1;
      /* Back from the pinned header: drop in once the header has grown back. */
      transition:
        opacity 200ms ease-out ${HEADER_TRANSITION_MS}ms,
        transform 200ms ease-out ${HEADER_TRANSITION_MS}ms,
        visibility 0s linear ${HEADER_TRANSITION_MS}ms;
    }
    /* Pinned (scrolled) header: fade up and out alongside the header shrinking. */
    .${PINNED_CLASS} .${PILL_CLASS} {
      opacity: 0;
      transform: translateY(-6px);
      visibility: hidden;
      pointer-events: none;
      transition:
        opacity 150ms ease-in,
        transform ${HEADER_TRANSITION_MS}ms ease-in,
        visibility 0s linear ${HEADER_TRANSITION_MS}ms;
    }
    .${PILL_CLASS}[hidden],
    .nav2:has(.nav-click-popup.js-click-menu--active) .${PILL_CLASS},
    body:has(.nav2 .nav-click-popup.js-click-menu--active) .${TIP_CLASS},
    .${PINNED_CLASS} .${TIP_CLASS} {
      display: none;
    }
    .${PILL_CLASS}:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }
    .${PILL_CLASS}__icon {
      flex-shrink: 0;
      font-size: 10px;
    }
    .${PILL_CLASS}__text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .${TIP_CLASS} {
      position: fixed;
      z-index: 10000;
      box-sizing: border-box;
      max-width: min(420px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: hidden;
      padding: 6px 10px;
      border-radius: 6px;
      background: rgb(24, 23, 28);
      color: #fff;
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    }
    .${TIP_CLASS}[hidden] {
      display: none;
    }
  `;
    const style2 = manageStyle2(STYLE_ID2, CSS2);
    function pageWin() {
      try {
        if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
          return unsafeWindow;
        }
      } catch (_) {
      }
      return window;
    }
    function latestUnread() {
      const store = pageWin().osuCore?.dataStore?.notificationStore;
      const map = store?.notifications;
      if (!map || typeof map.values !== "function") return null;
      let best = null;
      for (const n of map.values()) {
        if (!n || n.isRead || n.isDeleting) continue;
        if (!best || n.id > best.id) best = n;
      }
      return best;
    }
    function describe(n, fullContent) {
      const details = n.details || {};
      const username = details.username || "";
      const withUser = (body) => username ? `${username}: ${body}` : body;
      if (n.category === "channel") return withUser(details.title || "");
      const content = fullContent ?? details.content;
      if (content) {
        return n.name === "comment_new" && n.title ? withUser(`${content} on "${n.title}"`) : withUser(content);
      }
      const lang = pageWin().Lang;
      const key = `notifications.item.${n.displayType}.${n.category}.${n.name}`;
      try {
        if (lang?.has?.(key)) {
          return String(lang.get(key, { ...details, title: n.title }));
        }
      } catch (_) {
      }
      return withUser(n.title || details.title || n.name);
    }
    function truncatedPrefix(content) {
      if (typeof content !== "string") return null;
      if (!content.endsWith(TRUNCATION_SUFFIX)) return null;
      return content.slice(0, -TRUNCATION_SUFFIX.length).trim();
    }
    const normalizeSpace = (s) => s.replace(/\s+/g, " ").trim();
    async function fetchCommentContent(n) {
      const id = n.details?.comment_id;
      if (!id) return null;
      const resp = await OsuExpertPlus.api.siteFetch(
        `https://osu.ppy.sh/comments/${id}`,
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) return null;
      const json = await resp.json();
      const comment = (json.comments || []).find((c) => c.id === id);
      return typeof comment?.message === "string" ? comment.message : null;
    }
    async function fetchDiscussionPostContent(n) {
      const details = n.details || {};
      const prefix = truncatedPrefix(details.content);
      if (!details.discussion_id || prefix == null) return null;
      const usp = new URLSearchParams({
        beatmapset_discussion_id: String(details.discussion_id)
      });
      usp.append("types[]", "first");
      usp.append("types[]", "reply");
      const resp = await OsuExpertPlus.api.siteFetch(
        `https://osu.ppy.sh/beatmapsets/discussions/posts?${usp}`
      );
      if (!resp.ok) return null;
      const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
      const userHref = `/users/${n.sourceUserId}`;
      const want = normalizeSpace(prefix);
      for (const post of doc.querySelectorAll(".beatmap-discussion-post")) {
        const link = post.querySelector(
          ".beatmap-discussion-user-card__user-link"
        );
        if (!link?.getAttribute("href")?.endsWith(userHref)) continue;
        const msg = post.querySelector(".beatmap-discussion-post__message");
        const text = msg?.textContent?.trim();
        if (text && normalizeSpace(text).startsWith(want)) return text;
      }
      return null;
    }
    const fullContentCache = /* @__PURE__ */ new Map();
    function loadFullContent(n) {
      if (fullContentCache.has(n.id)) return fullContentCache.get(n.id);
      let task = null;
      if (truncatedPrefix(n.details?.content) != null) {
        if (n.name === "comment_new") task = fetchCommentContent(n);
        else if (n.category === "beatmapset_discussion") {
          task = fetchDiscussionPostContent(n);
        }
      }
      const promise = (task || Promise.resolve(null)).catch(() => null);
      fullContentCache.set(n.id, promise);
      return promise;
    }
    function install2(settingsApi) {
      let timer = null;
      let navAbort = null;
      let pill = null;
      let tip = null;
      let current = null;
      let hovering = false;
      const onResize = () => tick();
      let tickQueued = false;
      function queueTick() {
        if (tickQueued) return;
        tickQueued = true;
        setTimeout(() => {
          tickQueued = false;
          if (timer) tick();
        }, 50);
      }
      const counterObserver = new MutationObserver(queueTick);
      let watchedContainer = null;
      let watchedBody = null;
      let headerChangedAt = -Infinity;
      let wasPinned = false;
      let settleTimer = null;
      const bodyObserver = new MutationObserver(() => {
        const pinned = document.body.classList.contains(PINNED_CLASS);
        if (pinned === wasPinned) return;
        wasPinned = pinned;
        headerChangedAt = performance.now();
        if (pinned) {
          hovering = false;
          hideTip();
        }
        clearTimeout(settleTimer);
        settleTimer = setTimeout(tick, HEADER_TRANSITION_MS + 20);
      });
      function positionTip(clientX, clientY) {
        if (!tip || tip.hidden) return;
        const margin = 8;
        const w = tip.offsetWidth;
        const h2 = tip.offsetHeight;
        let left = clientX + TIP_OFFSET_PX;
        left = Math.min(left, window.innerWidth - w - margin);
        left = Math.max(left, margin);
        let top = clientY + TIP_OFFSET_PX;
        if (top + h2 > window.innerHeight - margin) {
          top = Math.max(margin, clientY - TIP_OFFSET_PX - h2);
        }
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
      }
      let lastPointer = { x: 0, y: 0 };
      function showTip(n) {
        if (!tip) {
          tip = el2("div", { class: TIP_CLASS, hidden: "" });
          document.body.appendChild(tip);
        }
        tip.textContent = describe(n);
        tip.hidden = false;
        positionTip(lastPointer.x, lastPointer.y);
        loadFullContent(n).then((full) => {
          if (!full || !hovering || current !== n || !tip) return;
          tip.textContent = describe(n, full);
          positionTip(lastPointer.x, lastPointer.y);
        });
      }
      function hideTip() {
        if (tip) tip.hidden = true;
      }
      function ensurePill(container) {
        const col = container.parentElement;
        if (pill && pill.parentElement === col) return pill;
        pill?.remove();
        pill = el2(
          "div",
          { class: PILL_CLASS, hidden: "" },
          el2("i", { class: `${PILL_CLASS}__icon` }),
          el2("span", { class: `${PILL_CLASS}__text` })
        );
        pill.addEventListener("click", () => {
          const id = pill.dataset.oepTarget;
          if (id) document.getElementById(id)?.click();
        });
        pill.addEventListener("mouseenter", (e) => {
          hovering = true;
          lastPointer = { x: e.clientX, y: e.clientY };
          if (current) showTip(current);
        });
        pill.addEventListener("mousemove", (e) => {
          lastPointer = { x: e.clientX, y: e.clientY };
          positionTip(e.clientX, e.clientY);
        });
        pill.addEventListener("mouseleave", () => {
          hovering = false;
          hideTip();
        });
        col.appendChild(pill);
        current = null;
        return pill;
      }
      function leftEdgeRect(container) {
        const group = container.closest(".nav2__colgroup") || document;
        const twitter = group.querySelector(".nav-button--twitter");
        const r = twitter?.getBoundingClientRect();
        return r && r.width > 0 ? r : container.getBoundingClientRect();
      }
      function watchHeader(container) {
        if (container !== watchedContainer) {
          counterObserver.disconnect();
          watchedContainer = container;
          if (container) {
            counterObserver.observe(container, {
              subtree: true,
              childList: true,
              characterData: true
            });
          }
        }
        if (document.body !== watchedBody) {
          bodyObserver.disconnect();
          watchedBody = document.body;
          wasPinned = document.body.classList.contains(PINNED_CLASS);
          bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"]
          });
        }
      }
      function setStyle(node, prop, value) {
        if (node.style[prop] !== value) node.style[prop] = value;
      }
      function onVisibility() {
        if (document.visibilityState === "visible") tick();
      }
      function onTransitionEnd(e) {
        if (e.target instanceof Element && e.target.closest(".nav2")) queueTick();
      }
      function tick() {
        const container = document.querySelector(CONTAINER_SEL);
        watchHeader(container);
        if (!container?.parentElement) {
          pill?.remove();
          pill = null;
          hideTip();
          return;
        }
        const p = ensurePill(container);
        const n = latestUnread();
        if (!n || !container.offsetParent) {
          p.hidden = true;
          current = null;
          hideTip();
          return;
        }
        if (n !== current) {
          current = n;
          const isChat = n.category === "channel";
          p.dataset.oepTarget = isChat ? "notification-widget-chat-icon" : "notification-widget-icon";
          p.firstChild.className = `${PILL_CLASS}__icon fas ${isChat ? "fa-comment-alt" : "fa-bell"}`;
          p.lastChild.textContent = describe(n);
          if (hovering) showTip(n);
        }
        p.hidden = false;
        if (document.body.classList.contains(PINNED_CLASS)) return;
        if (performance.now() - headerChangedAt < HEADER_TRANSITION_MS) return;
        const base = p.offsetParent;
        if (!base) return;
        const b = base.getBoundingClientRect();
        const r = container.getBoundingClientRect();
        const left = leftEdgeRect(container).left;
        setStyle(p, "left", `${left - b.left - base.clientLeft}px`);
        setStyle(p, "width", `${r.right - left}px`);
        setStyle(p, "top", `${r.bottom - b.top - base.clientTop + GAP_PX}px`);
      }
      function start2() {
        if (timer) return;
        style2.inject();
        timer = setInterval(() => {
          if (document.visibilityState === "visible") tick();
        }, FALLBACK_TICK_MS);
        navAbort = new AbortController();
        OsuExpertPlus.core.observe.subscribe(
          {
            selector: ".nav2",
            schedule: 50,
            signal: navAbort.signal,
            label: "header/nav-recent-notification"
          },
          tick
        );
        tick();
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibility);
        document.addEventListener("transitionend", onTransitionEnd, true);
        document.fonts?.ready.then(() => timer && tick());
      }
      function stop() {
        clearInterval(timer);
        timer = null;
        navAbort?.abort();
        navAbort = null;
        counterObserver.disconnect();
        watchedContainer = null;
        bodyObserver.disconnect();
        watchedBody = null;
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("transitionend", onTransitionEnd, true);
        clearTimeout(settleTimer);
        settleTimer = null;
        window.removeEventListener("resize", onResize);
        pill?.remove();
        pill = null;
        tip?.remove();
        tip = null;
        current = null;
        hovering = false;
        style2.remove();
      }
      const apply = (enabled) => enabled ? start2() : stop();
      apply(settingsApi.isEnabled(FEATURE_ID));
      const unsub = settingsApi.onChange(FEATURE_ID, apply);
      return () => {
        unsub();
        stop();
      };
    }
    return { install: install2 };
  })();

  // src/core/beatmapset-cache.js
  function createBeatmapsetCache({ maxEntries = 2e3 } = {}) {
    const entries = /* @__PURE__ */ new Map();
    const waiters = /* @__PURE__ */ new Map();
    const listeners2 = /* @__PURE__ */ new Set();
    let nextVersion = 1;
    return {
      /**
       * Store sets (objects with an `id`); others are skipped.
       * @param {Iterable<unknown>} items
       * @returns {string[]} ids stored
       */
      put(items) {
        const changed = [];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const rawId = (
            /** @type {Beatmapset} */
            item.id
          );
          if (rawId == null) continue;
          const id = String(rawId);
          const prev = entries.get(id)?.data;
          const data = (
            /** @type {Beatmapset} */
            prev && !Array.isArray(
              /** @type {Beatmapset} */
              item.beatmaps
            ) ? { ...prev, ...item } : item
          );
          entries.delete(id);
          entries.set(id, { data, version: nextVersion++ });
          changed.push(id);
          const waiting = waiters.get(id);
          if (waiting) {
            waiters.delete(id);
            waiting.forEach((resolve2) => resolve2(data));
          }
        }
        for (const key of entries.keys()) {
          if (entries.size <= maxEntries) break;
          entries.delete(key);
        }
        if (changed.length) {
          for (const fn of listeners2) {
            try {
              fn(changed);
            } catch (_) {
            }
          }
        }
        return changed;
      },
      /**
       * @param {string|number} id
       * @returns {Beatmapset|undefined}
       */
      get(id) {
        const key = String(id);
        const ent = entries.get(key);
        if (!ent) return void 0;
        entries.delete(key);
        entries.set(key, ent);
        return ent.data;
      },
      /** @param {string|number} id */
      has(id) {
        return entries.has(String(id));
      },
      /**
       * Version of the stored set, 0 when absent.
       * @param {string|number} id
       */
      version(id) {
        return entries.get(String(id))?.version ?? 0;
      },
      get size() {
        return entries.size;
      },
      /**
       * The set, as soon as it is stored; `undefined` after `timeout` ms or when
       * `signal` aborts.
       * @param {string|number} id
       * @param {{ signal?: AbortSignal, timeout?: number }} [options]
       * @returns {Promise<Beatmapset|undefined>}
       */
      waitFor(id, { signal, timeout } = {}) {
        const key = String(id);
        const hit = this.get(key);
        if (hit) return Promise.resolve(hit);
        if (signal?.aborted) return Promise.resolve(void 0);
        return new Promise((resolve2) => {
          let timer = 0;
          const done = (data) => {
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            const set = waiters.get(key);
            set?.delete(done);
            if (set && !set.size) waiters.delete(key);
            resolve2(data);
          };
          const onAbort = () => done(void 0);
          if (!waiters.has(key)) waiters.set(key, /* @__PURE__ */ new Set());
          waiters.get(key).add(done);
          signal?.addEventListener("abort", onAbort, { once: true });
          if (timeout != null) {
            timer = window.setTimeout(() => done(void 0), timeout);
          }
        });
      },
      /**
       * Called with the ids stored by each `put`.
       * @param {ChangeListener} fn
       * @returns {() => void} unsubscribe
       */
      onChange(fn) {
        listeners2.add(fn);
        return () => listeners2.delete(fn);
      },
      clear() {
        entries.clear();
      }
    };
  }
  function beatmapsetsFromSearch(json) {
    const list = json && typeof json === "object" ? (
      /** @type {Record<string, unknown>} */
      json.beatmapsets
    ) : null;
    return Array.isArray(list) ? list : [];
  }
  function beatmapsetsFromExtraPages(json) {
    if (!json || typeof json !== "object") return [];
    const out = [];
    for (const bucket of Object.values(json)) {
      const items = bucket && typeof bucket === "object" ? (
        /** @type {Record<string, unknown>} */
        bucket.items
      ) : null;
      if (Array.isArray(items)) out.push(...items);
    }
    return out;
  }
  function beatmapsetsFromUserList(json) {
    let list = [];
    if (Array.isArray(json)) list = json;
    else if (json && typeof json === "object") list = beatmapsetsFromSearch(json);
    return list.map((item) => {
      const nested = item && typeof item === "object" ? (
        /** @type {Record<string, unknown>} */
        item.beatmapset
      ) : null;
      return nested && typeof nested === "object" && /** @type {Record<string, unknown>} */
      nested.id != null ? nested : item;
    });
  }
  var beatmapsetCache = createBeatmapsetCache();

  // src/features/cards/extra-layout.js
  function syncPopupHighlightHeight() {
    const activePanel = document.querySelector(
      ".beatmapset-panel--beatmaps-popup-visible"
    );
    const popup = document.querySelector(".beatmaps-popup");
    if (!activePanel || !popup) return;
    const actual = (
      /** @type {HTMLElement} */
      activePanel.offsetHeight
    );
    if (actual > 0) {
      popup.style.setProperty(
        "--panel-height",
        actual + "px"
      );
    }
  }
  function syncBeatmapsetsListingOuterHeight(outer, items) {
    if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement))
      return;
    const st = outer.getAttribute("style") || "";
    if (!/height\s*:\s*[\d.]+\s*px/i.test(st)) return;
    const cs = getComputedStyle(outer);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const minOuter = Math.ceil(items.scrollHeight + padY);
    if (minOuter > outer.clientHeight + 0.5) {
      outer.style.height = `${minOuter}px`;
    }
  }
  function createListingHeightSync(isOn) {
    let ro = null;
    let observed = null;
    function detach() {
      if (ro) {
        ro.disconnect();
        ro = null;
        observed = null;
      }
    }
    function attach() {
      if (!isOn() || !isBeatmapsetsListing(location.pathname)) {
        detach();
        return;
      }
      const content = document.querySelector(".beatmapsets__content");
      const outer = content?.firstElementChild;
      const items = outer?.querySelector?.(".beatmapsets__items");
      if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement)) {
        detach();
        return;
      }
      if (observed === items && ro) {
        syncBeatmapsetsListingOuterHeight(outer, items);
        return;
      }
      detach();
      observed = items;
      ro = new ResizeObserver(() => {
        syncBeatmapsetsListingOuterHeight(outer, items);
      });
      ro.observe(items);
      syncBeatmapsetsListingOuterHeight(outer, items);
    }
    return {
      schedule() {
        if (!isOn() || !isBeatmapsetsListing(location.pathname)) {
          detach();
          return;
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(attach);
        });
      },
      detach
    };
  }

  // src/features/legacy.js
  function settings() {
    return OsuExpertPlus.settings;
  }
  function settingIds() {
    return OsuExpertPlus.settings.IDS;
  }
  function el(...args) {
    return OsuExpertPlus.dom.el(...args);
  }
  function isAuthConfigured() {
    return OsuExpertPlus.auth.isConfigured();
  }
  function waitForElement(...args) {
    return OsuExpertPlus.dom.waitForElement(...args);
  }
  function setTextIfChanged(...args) {
    return OsuExpertPlus.dom.setTextIfChanged(...args);
  }
  function setHiddenIfChanged(...args) {
    return OsuExpertPlus.dom.setHiddenIfChanged(...args);
  }
  function qsa(...args) {
    return OsuExpertPlus.dom.qsa(...args);
  }
  function omdb() {
    return OsuExpertPlus.omdb;
  }
  function manageStyle(...args) {
    return OsuExpertPlus.dom.manageStyle(...args);
  }
  function waitForStaleElementToLeave(...args) {
    return OsuExpertPlus.dom.waitForStaleElementToLeave(...args);
  }
  function parseLocaleNumber2(...args) {
    return OsuExpertPlus.dom.parseLocaleNumber(...args);
  }
  function formatDecimalPp(...args) {
    return OsuExpertPlus.dom.formatDecimalPp(...args);
  }
  function applyModIconsAsAcronyms(...args) {
    return OsuExpertPlus.modIconsAsAcronyms.applyModIconsAsAcronyms(...args);
  }
  function injectModIconsAcronymStyles(...args) {
    return OsuExpertPlus.modIconsAsAcronyms.injectModIconsAcronymStyles(...args);
  }
  function stripOepModAcronymFromClonedMod(...args) {
    return OsuExpertPlus.modIconsAsAcronyms.stripOepModAcronymFromClonedMod(
      ...args
    );
  }
  function modTypeClassForAcronym(...args) {
    return OsuExpertPlus.modIconsAsAcronyms.modTypeClassForAcronym(...args);
  }

  // src/features/cards/extra-styles.js
  var STYLE_ID = "osu-expertplus-beatmap-card-extra-css";
  var BLOCK_CLASS = "oep-beatmap-card-extra";
  var STAR_RANGE_CLASS = "oep-beatmap-card-extra__star-range";
  var SOURCE_SLOT_CLASS = "oep-beatmap-card-extra__source-slot";
  var PANEL_STATE_ATTR = "data-oep-card-extra";
  var PANEL_CACHE_EPOCH_ATTR = "data-oep-card-extra-epoch";
  var PANEL_RENDERED_META_ATTR = "data-oep-card-extra-meta";
  var PANEL_RENDERED_STARS_ATTR = "data-oep-card-extra-stars";
  var style = manageStyle(
    STYLE_ID,
    `
  .beatmapset-panel:has(.${BLOCK_CLASS}),
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}),
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) {
    height: auto !important;
    min-height: var(--panel-height);
    overflow: visible;
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__content,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__content,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__content {
    height: auto !important;
    min-height: var(--panel-height);
    align-items: stretch;
    overflow: visible;
    position: relative;
    z-index: 1;
    isolation: isolate;
  }
  /* Narrow layout (osu-web's < 900px): the status row (status, dots, star
     range) is absolutely placed right under the main area (top: 100%) and the
     panel normally reserves --mobile-extra-bar-height for it. Our rows make the
     main area taller, so reserve the bar below whatever height it ends up (#2). */
  @media (max-width: 899px) {
    .beatmapset-panel:has(.${BLOCK_CLASS}),
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}),
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) {
      padding-bottom: var(--mobile-extra-bar-height);
    }
    .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__content,
    .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__content {
      min-height: var(--main-height);
    }
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__play-container,
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__menu-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__menu-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__menu-container {
    align-self: stretch;
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-col--info,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-col--info,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-col--info {
    align-self: stretch;
  }
  /* Cover link is a sibling before __content (abs. over the whole card). In-flow height comes only
     from __content; subpixel layout vs the panel translateZ(0) layer can show 1–2px of panel
     background at the rounded bottom. Match card radius, clip children, composited layer. */
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__cover-container,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__cover-container,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__cover-container {
    top: 0 !important;
    bottom: 0 !important;
    height: auto !important;
    min-height: var(--panel-height);
    border-radius: inherit;
    overflow: hidden;
    transform: translateZ(0);
  }
  .beatmapset-panel:has(.${BLOCK_CLASS}) .beatmapset-panel__info,
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info,
  .beatmapset-panel:has(.${STAR_RANGE_CLASS}) .beatmapset-panel__info {
    overflow: visible;
    align-self: stretch;
  }

  /* API source lives in our slot; hide osu’s row so we don’t get two lines. */
  .beatmapset-panel:has(.${SOURCE_SLOT_CLASS}) .beatmapset-panel__info-row--source {
    display: none !important;
  }

  /* Match osu --source row; single line with ellipsis (flex min-width:0 so truncation works). */
  .beatmapset-panel__info-row.${SOURCE_SLOT_CLASS} {
    color: hsl(var(--hsl-c2));
    font-weight: 700;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
  .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-slot-line {
    box-sizing: border-box;
    flex: 1 1 0;
    min-width: 0;
    max-width: 100%;
    min-height: 1.35em;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .${SOURCE_SLOT_CLASS} .${BLOCK_CLASS}__source-placeholder {
    display: inline-block;
  }

  /* Flush with neighbouring .beatmapset-panel__info-row (no extra band above BPM/length). */
  .${BLOCK_CLASS} {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex-shrink: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  .${BLOCK_CLASS}__source-text {
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 86%));
  }
  /* BPM / length: inherit font from panel; tune colour, spacing, shadow, truncation. */
  .${BLOCK_CLASS}__meta {
    margin: 0;
    padding: 0;
    max-width: 100%;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.03em;
    opacity: 0.9;
    color: hsl(var(--hsl-c2, 333 60% 68%));
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Max SR per mode: wrapper + one pill (spectrum by highest difficulty in that mode). */
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots .${STAR_RANGE_CLASS} {
    margin-left: 0.45em;
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.2em;
    flex-shrink: 0;
    white-space: nowrap;
    line-height: 1;
    font-size: max(10px, 0.82em);
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    padding: 0.2em 0.62em;
    min-height: 14px;
    border-radius: 10000px;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    border: none;
    flex-shrink: 0;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-inner {
    display: inline-flex;
    align-items: stretch;
    flex-wrap: nowrap;
    column-gap: 0.1em;
    line-height: 1;
    color: inherit;
    min-width: 0;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-up {
    font-size: 0.58em;
    line-height: 1;
    color: inherit;
    opacity: 0.92;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-up::before {
    display: block;
    line-height: 1;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-icon {
    font-size: 0.72em;
    line-height: 1;
    color: inherit;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-icon::before {
    display: block;
    line-height: 1;
  }
  .beatmapset-panel__extra-item.beatmapset-panel__extra-item--dots
    .${STAR_RANGE_CLASS}__chip-val {
    font-variant-numeric: tabular-nums;
    color: inherit;
    flex-shrink: 0;
    line-height: 1;
    display: flex;
    align-items: center;
  }
`
  );

  // src/features/cards/extra-render.js
  function formatDuration2(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  function bpmLengthFromSet(data) {
    const maps = data?.beatmaps;
    if (!Array.isArray(maps) || maps.length === 0)
      return { bpmStr: null, lengthStr: null };
    const bpmSet = /* @__PURE__ */ new Set();
    for (const m of maps) {
      const b = Number(m?.bpm);
      if (Number.isFinite(b)) bpmSet.add(b);
    }
    const bpms = [...bpmSet].sort((a, b) => a - b);
    let bpmStr = null;
    if (bpms.length === 1) bpmStr = `${bpms[0]} BPM`;
    else if (bpms.length > 1) bpmStr = `${bpms[0]}–${bpms[bpms.length - 1]} BPM`;
    const lengths = maps.map((m) => Number(m?.total_length)).filter((n) => Number.isFinite(n) && n >= 0);
    const longest = lengths.length ? Math.max(...lengths) : null;
    const lengthStr = longest != null ? formatDuration2(longest) : null;
    return { bpmStr, lengthStr };
  }
  function formatStarShort(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    const t = Math.floor(Math.abs(x) * 100) / 100 * Math.sign(x);
    if (Number.isInteger(t)) return String(t);
    let s = t.toFixed(2);
    if (s.endsWith("0")) s = s.slice(0, -1);
    if (s.endsWith(".")) s = s.slice(0, -1);
    return s;
  }
  function buildStarChip(dc, sr) {
    const text = formatStarShort(sr);
    if (!text) return null;
    const bg = dc?.getDiffColour(sr) ?? "hsl(var(--hsl-b6))";
    const fg = dc?.getDiffTextColour(sr) ?? "hsl(var(--hsl-l1))";
    return el(
      "span",
      {
        class: `${STAR_RANGE_CLASS}__chip`,
        style: { backgroundColor: bg, color: fg }
      },
      el(
        "span",
        { class: `${STAR_RANGE_CLASS}__chip-inner` },
        el("span", {
          class: `fas fa-chevron-up ${STAR_RANGE_CLASS}__chip-up`,
          "aria-hidden": "true"
        }),
        el("span", {
          class: `fas fa-star ${STAR_RANGE_CLASS}__chip-icon`,
          "aria-hidden": "true"
        }),
        el("span", { class: `${STAR_RANGE_CLASS}__chip-val` }, text)
      )
    );
  }
  function ratingsByRulesetFromSet(data) {
    const map = /* @__PURE__ */ new Map();
    const maps = data?.beatmaps;
    if (!Array.isArray(maps)) return map;
    for (const b of maps) {
      const mode = b?.mode;
      if (typeof mode !== "string") continue;
      const r = Number(b?.difficulty_rating);
      if (!Number.isFinite(r)) continue;
      if (!map.has(mode)) map.set(mode, []);
      map.get(mode).push(r);
    }
    return map;
  }
  function distinctModeCountFromSet(data) {
    const maps = data?.beatmaps;
    if (!Array.isArray(maps)) return 0;
    const seen = /* @__PURE__ */ new Set();
    for (const b of maps) {
      if (typeof b?.mode === "string") seen.add(b.mode);
    }
    return seen.size;
  }
  function parseRulesetFromDotsRow(item) {
    const icon = item.querySelector(
      ".beatmapset-panel__beatmap-icon i[class*='fa-extra-mode-']"
    );
    if (!icon) return null;
    const m = icon.className.match(/\bfa-extra-mode-(osu|taiko|fruits|mania)\b/);
    return m ? m[1] : null;
  }
  function mountStarRanges(panel, data) {
    const dc = OsuExpertPlus.difficultyColours;
    const byMode = ratingsByRulesetFromSet(data);
    if (byMode.size === 0) return;
    if (distinctModeCountFromSet(data) >= 4) return;
    panel.querySelectorAll(".beatmapset-panel__extra-item--dots").forEach((row) => {
      row.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
      const mode = parseRulesetFromDotsRow(row);
      if (!mode) return;
      const ratings = byMode.get(mode);
      if (!ratings?.length) return;
      const hi = Math.max(...ratings);
      const wrap = el("span", { class: STAR_RANGE_CLASS });
      const chip = buildStarChip(dc, hi);
      if (!chip) return;
      wrap.appendChild(chip);
      row.appendChild(wrap);
    });
  }
  function parseBeatmapsetId(panel) {
    const links = panel.querySelectorAll('a[href*="beatmapsets/"]');
    for (const a of links) {
      const href = a.getAttribute("href");
      if (!href) continue;
      try {
        const u = new URL(href, location.origin);
        const m = u.pathname.match(/^\/beatmapsets\/(\d+)/i);
        if (m) return m[1];
      } catch (_) {
      }
    }
    return null;
  }
  function buildSourceSlotRow(sourceText) {
    const inner = sourceText.length > 0 ? el(
      "div",
      { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
      "from ",
      el("span", { class: `${BLOCK_CLASS}__source-text` }, sourceText)
    ) : el(
      "div",
      { class: `u-ellipsis-overflow ${BLOCK_CLASS}__source-slot-line` },
      el(
        "span",
        {
          class: `${BLOCK_CLASS}__source-placeholder`,
          "aria-hidden": "true"
        },
        " "
      )
    );
    return el(
      "div",
      {
        class: `beatmapset-panel__info-row ${SOURCE_SLOT_CLASS}`,
        "data-oep-card-extra-slot": "1"
      },
      inner
    );
  }
  function mountSourceSlot(panel, sourceTrimmed) {
    const artist = panel.querySelector(".beatmapset-panel__info-row--artist");
    if (!artist) return false;
    artist.insertAdjacentElement("afterend", buildSourceSlotRow(sourceTrimmed));
    return true;
  }
  function insertTargetMeta(panel) {
    const mapperRow = panel.querySelector(".beatmapset-panel__info-row--mapper");
    if (mapperRow) return { anchor: mapperRow, mode: "after" };
    const sourceRow = panel.querySelector(".beatmapset-panel__info-row--source");
    if (sourceRow) return { anchor: sourceRow, mode: "after" };
    const artistRow = panel.querySelector(".beatmapset-panel__info-row--artist");
    if (artistRow) return { anchor: artistRow, mode: "after" };
    const info = panel.querySelector(".beatmapset-panel__info");
    if (info) return { anchor: info, mode: "append" };
    const legacyMapper = panel.querySelector(".beatmapset-panel__mapper");
    if (legacyMapper) return { anchor: legacyMapper, mode: "after" };
    const legacyArtist = panel.querySelector(".beatmapset-panel__artist");
    if (legacyArtist) return { anchor: legacyArtist, mode: "after" };
    const details = panel.querySelector(".beatmapset-panel__details");
    if (details) return { anchor: details, mode: "append" };
    return { anchor: panel, mode: "append" };
  }
  function buildMetaBlock(data) {
    const { bpmStr, lengthStr } = bpmLengthFromSet(data);
    const metaBits = [];
    if (bpmStr) metaBits.push(bpmStr);
    if (lengthStr) metaBits.push(lengthStr);
    if (!metaBits.length) return null;
    return el(
      "div",
      { class: BLOCK_CLASS },
      el("div", { class: `${BLOCK_CLASS}__meta` }, metaBits.join(" · "))
    );
  }
  function stripInjections(panel) {
    panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
    panel.removeAttribute(PANEL_STATE_ATTR);
    panel.removeAttribute(PANEL_CACHE_EPOCH_ATTR);
    panel.removeAttribute(PANEL_RENDERED_META_ATTR);
    panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
  }

  // src/features/cards/extra.js
  var schedulePanelsToken = 0;
  var PANEL_SCHEDULE_CHUNK = 28;
  var ingestedJsonBeatmaps = /* @__PURE__ */ new WeakMap();
  function ingestFromJsonBeatmapsScript() {
    const n = document.getElementById("json-beatmaps");
    if (!n?.textContent) {
      return;
    }
    const raw = n.textContent.trim();
    if (ingestedJsonBeatmaps.get(n) === raw) return;
    try {
      beatmapsetCache.put(beatmapsetsFromSearch(JSON.parse(raw)));
      ingestedJsonBeatmaps.set(n, raw);
    } catch (_) {
    }
  }
  function isUsersExtraPagesBeatmapsUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/users\/\d+\/extra-pages\/beatmaps\b/.test(u.pathname);
    } catch (_) {
      return false;
    }
  }
  function isUsersWebBeatmapsetsTypeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }
  function isApiV2UsersBeatmapsetsTypeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/api\/v2\/users\/\d+\/beatmapsets\/[a-z0-9_-]+\/?$/i.test(
        u.pathname
      );
    } catch (_) {
      return false;
    }
  }
  function isBeatmapsetsSearchUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/beatmapsets\/search\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }
  function isApiV2BeatmapsetsSearchUrl(url) {
    try {
      const u = new URL(url, location.origin);
      return /\/api\/v2\/beatmapsets\/search\/?$/i.test(u.pathname);
    } catch (_) {
      return false;
    }
  }
  var profileExtraState = { waitForExtraPages: false };
  var profileExtraPrefetchStarted = false;
  var profileExtraPrefetchWantIngest = null;
  var listingSearchPrefetchStarted = false;
  var PROFILE_EXTRA_CACHE_WAIT_MS = 2e3;
  var PROFILE_EXTRA_HOOK_GRACE_MS = 1e3;
  var LISTING_CACHE_WAIT_MS = 1500;
  function wantedExtras(settings2) {
    return {
      wantMeta: settings2.isEnabled(settings2.IDS.BEATMAP_CARD_EXTRA_INFO),
      wantStars: settings2.isEnabled(settings2.IDS.BEATMAP_CARD_DIFFICULTY_RANGE)
    };
  }
  async function processPanel(panel, settings2, signal) {
    const { wantMeta, wantStars } = wantedExtras(settings2);
    if (!wantMeta && !wantStars) {
      return;
    }
    const id = parseBeatmapsetId(panel);
    if (!id) {
      return;
    }
    const state2 = panel.getAttribute(PANEL_STATE_ATTR);
    const renderedEpoch = panel.getAttribute(PANEL_CACHE_EPOCH_ATTR);
    const hasMeta = panel.getAttribute(PANEL_RENDERED_META_ATTR) === "1";
    const hasStars = panel.getAttribute(PANEL_RENDERED_STARS_ATTR) === "1";
    if (state2 === id && renderedEpoch != null && renderedEpoch === String(beatmapsetCache.version(id)) && wantMeta === hasMeta && wantStars === hasStars) {
      return;
    }
    if (state2 === id) panel.removeAttribute(PANEL_STATE_ATTR);
    if (panel.getAttribute(PANEL_STATE_ATTR) === "loading") return;
    panel.querySelectorAll(`.${BLOCK_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${SOURCE_SLOT_CLASS}`).forEach((n) => n.remove());
    panel.querySelectorAll(`.${STAR_RANGE_CLASS}`).forEach((n) => n.remove());
    panel.removeAttribute(PANEL_RENDERED_META_ATTR);
    panel.removeAttribute(PANEL_RENDERED_STARS_ATTR);
    panel.setAttribute(PANEL_STATE_ATTR, "loading");
    let drawn = false;
    try {
      let data = beatmapsetCache.get(id);
      if (!data && profileExtraState.waitForExtraPages) {
        data = await beatmapsetCache.waitFor(id, {
          timeout: PROFILE_EXTRA_HOOK_GRACE_MS,
          signal
        });
        if (!data && !signal?.aborted) {
          startProfileExtraPagesPrefetchIfNeeded();
          data = await beatmapsetCache.waitFor(id, {
            timeout: PROFILE_EXTRA_CACHE_WAIT_MS,
            signal
          });
        }
      } else if (!data) {
        data = await beatmapsetCache.waitFor(id, {
          timeout: LISTING_CACHE_WAIT_MS,
          signal
        });
      }
      if (!data || signal?.aborted) return;
      if (!document.body.contains(panel)) return;
      const now = wantedExtras(settings2);
      if (parseBeatmapsetId(panel) !== id) return;
      if (now.wantMeta !== wantMeta || now.wantStars !== wantStars) return;
      if (wantMeta) {
        const sourceTrimmed = String(data.source ?? "").trim();
        mountSourceSlot(panel, sourceTrimmed);
        const block = buildMetaBlock(data);
        if (block) {
          const { anchor, mode } = insertTargetMeta(panel);
          if (mode === "after") anchor.insertAdjacentElement("afterend", block);
          else anchor.appendChild(block);
        }
        panel.setAttribute(PANEL_RENDERED_META_ATTR, "1");
      }
      if (wantStars) {
        mountStarRanges(panel, data);
        panel.setAttribute(PANEL_RENDERED_STARS_ATTR, "1");
      }
      panel.setAttribute(PANEL_STATE_ATTR, id);
      panel.setAttribute(
        PANEL_CACHE_EPOCH_ATTR,
        String(beatmapsetCache.version(id))
      );
      drawn = true;
    } finally {
      if (!drawn && panel.getAttribute(PANEL_STATE_ATTR) === "loading") {
        panel.removeAttribute(PANEL_STATE_ATTR);
      }
    }
  }
  function stripAllPanels(root) {
    root.querySelectorAll(".beatmapset-panel").forEach((panel) => {
      stripInjections(panel);
    });
  }
  function scheduleAllPanels(root, settings2, signal) {
    const panels = Array.from(root.querySelectorAll(".beatmapset-panel"));
    if (panels.length === 0) {
      return;
    }
    const token = ++schedulePanelsToken;
    let index = 0;
    const step = () => {
      if (token !== schedulePanelsToken) {
        return;
      }
      const end = Math.min(index + PANEL_SCHEDULE_CHUNK, panels.length);
      while (index < end) {
        processPanel(panels[index++], settings2, signal).catch(() => {
        });
      }
      if (index < panels.length) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }
  function ingestorForUrl(url) {
    if (isUsersExtraPagesBeatmapsUrl(url)) return beatmapsetsFromExtraPages;
    if (isUsersWebBeatmapsetsTypeUrl(url) || isApiV2UsersBeatmapsetsTypeUrl(url))
      return beatmapsetsFromUserList;
    if (isBeatmapsetsSearchUrl(url) || isApiV2BeatmapsetsSearchUrl(url))
      return beatmapsetsFromSearch;
    return null;
  }
  function pageCardsMissingData() {
    for (const panel of document.querySelectorAll(".beatmapset-panel")) {
      const id = parseBeatmapsetId(panel);
      if (id && !beatmapsetCache.has(id)) return true;
    }
    return false;
  }
  function startProfileExtraPagesPrefetchIfNeeded() {
    const wantIngest = profileExtraPrefetchWantIngest;
    if (!wantIngest || !wantIngest()) return;
    if (!profileExtraState.waitForExtraPages) return;
    if (!pageCardsMissingData()) return;
    if (profileExtraPrefetchStarted) return;
    const m = location.pathname.match(
      /^\/users\/(\d+)(?:\/(osu|taiko|fruits|mania))?\/?$/i
    );
    if (!m) return;
    profileExtraPrefetchStarted = true;
    const userId = m[1];
    const mode = m[2] || new URLSearchParams(location.search).get("mode") || "osu";
    void (async () => {
      try {
        const r = await OsuExpertPlus.api.fetchUserExtraPage(userId, "beatmaps", {
          mode
        });
        if (!wantIngest()) return;
        if (!r.ok) {
          return;
        }
        beatmapsetCache.put(beatmapsetsFromExtraPages(await r.json()));
      } catch (_) {
      }
    })();
  }
  function startListingSearchPrefetchIfNeeded(wantIngest) {
    if (!wantIngest()) return;
    if (!isBeatmapsetsListing(location.pathname)) return;
    if (listingSearchPrefetchStarted) return;
    const n = document.getElementById("json-beatmaps");
    if (n?.textContent?.trim()) return;
    listingSearchPrefetchStarted = true;
    const params = new URLSearchParams(location.search);
    params.delete("cursor_string");
    const qs = params.toString();
    const url = `/beatmapsets/search${qs ? "?" + qs : ""}`;
    void (async () => {
      try {
        const r = await OsuExpertPlus.api.siteFetch(url, {
          headers: { Accept: "application/json" }
        });
        if (!wantIngest()) return;
        if (!r.ok) return;
        beatmapsetCache.put(beatmapsetsFromSearch(await r.json()));
      } catch (_) {
      }
    })();
  }
  function createJsonBeatmapsWatcher(isOn) {
    let mo = null;
    let observed = null;
    let debounce = 0;
    function disconnect() {
      window.clearTimeout(debounce);
      debounce = 0;
      mo?.disconnect();
      mo = null;
      observed = null;
    }
    function connect() {
      const n = isOn() ? document.getElementById("json-beatmaps") : null;
      if (!n) {
        disconnect();
        return;
      }
      if (observed === n && mo) return;
      disconnect();
      observed = n;
      mo = new MutationObserver(() => {
        if (!isOn()) return;
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          debounce = 0;
          ingestFromJsonBeatmapsScript();
        }, 0);
      });
      mo.observe(n, { childList: true, characterData: true, subtree: true });
    }
    return { connect, disconnect };
  }
  var CARD_WATCH_SELECTOR = ".beatmapset-panel, .beatmaps-popup, #json-beatmaps, .beatmapsets__items";
  var MO_DEBOUNCE_MS = 100;
  var MO_MAX_WAIT_MS = 450;
  function start(settings2, options = {}) {
    const ac = new AbortController();
    const ID_META = settings2.IDS.BEATMAP_CARD_EXTRA_INFO;
    const ID_STARS = settings2.IDS.BEATMAP_CARD_DIFFICULTY_RANGE;
    const wantIngest = () => settings2.isEnabled(ID_META) || settings2.isEnabled(ID_STARS);
    const jsonWatcher = createJsonBeatmapsWatcher(wantIngest);
    const listingHeight = createListingHeightSync(wantIngest);
    profileExtraState.waitForExtraPages = options.hookProfileExtraPages === true;
    profileExtraPrefetchStarted = false;
    listingSearchPrefetchStarted = false;
    const removeJsonListener = addJsonResponseListener({
      match: (url) => wantIngest() && ingestorForUrl(url) !== null,
      onJson: (url, json) => {
        const extract = ingestorForUrl(url);
        if (extract) beatmapsetCache.put(extract(json));
      }
    });
    const run = () => {
      const on = wantIngest();
      if (on) style.inject();
      else style.remove();
      if (!on) stripAllPanels(document);
      if (on) {
        ingestFromJsonBeatmapsScript();
        profileExtraPrefetchWantIngest = wantIngest;
        startListingSearchPrefetchIfNeeded(wantIngest);
        jsonWatcher.connect();
        scheduleAllPanels(document, settings2, ac.signal);
      } else {
        jsonWatcher.disconnect();
      }
      syncPopupHighlightHeight();
      listingHeight.schedule();
    };
    let moDebounceId = 0;
    let moMaxWaitId = 0;
    const refreshAfterDomMutation = () => {
      window.clearTimeout(moDebounceId);
      moDebounceId = 0;
      window.clearTimeout(moMaxWaitId);
      moMaxWaitId = 0;
      if (!wantIngest()) return;
      jsonWatcher.connect();
      ingestFromJsonBeatmapsScript();
      scheduleAllPanels(document, settings2, ac.signal);
      syncPopupHighlightHeight();
      listingHeight.schedule();
    };
    observe.subscribe(
      {
        selector: CARD_WATCH_SELECTOR,
        schedule: "sync",
        signal: ac.signal,
        label: "cards/extra"
      },
      ({ added }) => {
        if (!wantIngest()) return;
        if (added.some(
          (n) => n.matches(".beatmaps-popup") || n.querySelector(".beatmaps-popup")
        )) {
          syncPopupHighlightHeight();
        }
        window.clearTimeout(moDebounceId);
        moDebounceId = window.setTimeout(refreshAfterDomMutation, MO_DEBOUNCE_MS);
        if (!moMaxWaitId) {
          moMaxWaitId = window.setTimeout(
            refreshAfterDomMutation,
            MO_MAX_WAIT_MS
          );
        }
      }
    );
    let ingestPanelsId = 0;
    const scheduleAfterIngest = () => {
      window.clearTimeout(ingestPanelsId);
      ingestPanelsId = window.setTimeout(() => {
        ingestPanelsId = 0;
        if (!wantIngest()) return;
        requestAnimationFrame(() => {
          if (!wantIngest()) return;
          scheduleAllPanels(document, settings2, ac.signal);
          listingHeight.schedule();
        });
      }, 0);
    };
    const unsubCache = beatmapsetCache.onChange(scheduleAfterIngest);
    run();
    const unsubMeta = settings2.onChange(ID_META, run);
    const unsubStars = settings2.onChange(ID_STARS, run);
    return () => {
      ac.abort();
      window.clearTimeout(moDebounceId);
      window.clearTimeout(moMaxWaitId);
      window.clearTimeout(ingestPanelsId);
      jsonWatcher.disconnect();
      unsubMeta();
      unsubStars();
      profileExtraState.waitForExtraPages = false;
      profileExtraPrefetchStarted = false;
      profileExtraPrefetchWantIngest = null;
      listingSearchPrefetchStarted = false;
      unsubCache();
      listingHeight.detach();
      removeJsonListener();
      style.remove();
      document.querySelectorAll(".beatmapset-panel").forEach((panel) => {
        stripInjections(panel);
      });
    };
  }

  // src/features/cards/stats.js
  var ALWAYS_SHOW_STYLE_ID = "osu-expertplus-beatmap-card-always-stats";
  var ALWAYS_SHOW_CSS = `
  .beatmapset-panel { --stats-opacity: 1 !important; }
`;
  var FULL_STATS_STYLE_ID = "osu-expertplus-beatmap-card-full-stats";
  var FULL_BEATMAP_STATS_ITEM_ATTR = "data-oep-full-stat-item";
  var STAT_BASE_ATTR = "data-oep-full-stat-base";
  var STAT_TIP_ATTR = "data-oep-full-stat-tip";
  var FULL_STAT_CLASS = "oep-full-stat";
  var FULL_STATS_CSS = `
  .beatmapset-panel__stats-item .${FULL_STAT_CLASS} + span {
    display: none;
  }
`;
  var STATS_ITEM_SEL = ".beatmapset-panel__stats-item--play-count, .beatmapset-panel__stats-item--favourite-count";
  function countFromStatTooltip(tooltip) {
    const m = String(tooltip).match(/\d[\d.,\s'’]*/);
    if (!m) return null;
    const n = parseInt(m[0].replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  function fullStatCount(item) {
    const isPlay = item.classList.contains(
      "beatmapset-panel__stats-item--play-count"
    );
    const panel = item.closest(".beatmapset-panel");
    const id = panel ? parseBeatmapsetId(panel) : null;
    const data = id ? beatmapsetCache.get(id) : void 0;
    const fromData = Number(isPlay ? data?.play_count : data?.favourite_count);
    const tip = countFromStatTooltip(
      item.getAttribute("title") || item.getAttribute("data-orig-title") || ""
    );
    if (!(Number.isFinite(fromData) && fromData >= 0)) return tip;
    if (item.getAttribute(STAT_BASE_ATTR) !== String(fromData)) {
      item.setAttribute(STAT_BASE_ATTR, String(fromData));
      if (tip === null) item.removeAttribute(STAT_TIP_ATTR);
      else item.setAttribute(STAT_TIP_ATTR, String(tip));
      return fromData;
    }
    const tip0 = Number(item.getAttribute(STAT_TIP_ATTR) ?? NaN);
    if (tip === null || !Number.isFinite(tip0)) return fromData;
    return Math.max(0, fromData + (tip - tip0));
  }
  function applyFullBeatmapStatNumbers(scope) {
    scope.querySelectorAll(STATS_ITEM_SEL).forEach(applyFullStatToItem);
  }
  function applyFullStatToItem(item) {
    const n = fullStatCount(item);
    if (n === null) return;
    const icon = item.querySelector(".beatmapset-panel__stats-item-icon");
    const valSpan = icon?.nextElementSibling;
    if (!valSpan || valSpan.tagName !== "SPAN") return;
    const text = n.toLocaleString("en-US");
    let ours = valSpan.classList.contains(FULL_STAT_CLASS) ? valSpan : null;
    if (!ours) {
      ours = document.createElement("span");
      ours.className = FULL_STAT_CLASS;
      valSpan.before(ours);
    }
    if (ours.textContent !== text) ours.textContent = text;
    item.setAttribute(FULL_BEATMAP_STATS_ITEM_ATTR, "1");
  }
  function revertFullBeatmapStatNumbers(scope) {
    scope.querySelectorAll(`.${FULL_STAT_CLASS}`).forEach((n) => n.remove());
    scope.querySelectorAll(`[${FULL_BEATMAP_STATS_ITEM_ATTR}]`).forEach((item) => {
      item.removeAttribute(FULL_BEATMAP_STATS_ITEM_ATTR);
      item.removeAttribute(STAT_BASE_ATTR);
      item.removeAttribute(STAT_TIP_ATTR);
    });
  }
  function startAlwaysShowStats(settings2, manageStyle2) {
    const style2 = manageStyle2(ALWAYS_SHOW_STYLE_ID, ALWAYS_SHOW_CSS);
    const id = settings2.IDS.ALWAYS_SHOW_STATS;
    function apply(enabled) {
      enabled ? style2.inject() : style2.remove();
    }
    apply(settings2.isEnabled(id));
    const unsub = settings2.onChange(id, apply);
    return () => {
      try {
        unsub();
      } catch (_) {
      }
      style2.remove();
    };
  }
  function startFullBeatmapStatNumbers(settings2, manageStyle2) {
    const featureId = settings2.IDS.FULL_BEATMAP_STAT_NUMBERS;
    const style2 = manageStyle2(FULL_STATS_STYLE_ID, FULL_STATS_CSS);
    let ac = null;
    let unsubCache = null;
    function stop() {
      ac?.abort();
      ac = null;
      unsubCache?.();
      unsubCache = null;
    }
    function applyFeature(enabled) {
      stop();
      if (!enabled) {
        revertFullBeatmapStatNumbers(document);
        style2.remove();
        return;
      }
      style2.inject();
      applyFullBeatmapStatNumbers(document);
      ac = new AbortController();
      observe.subscribe(
        {
          selector: ".beatmapset-panel",
          schedule: "sync",
          signal: ac.signal,
          label: "cards/full-stats"
        },
        ({ added }) => {
          for (const el2 of added) {
            if (el2.matches(".beatmapset-panel")) applyFullBeatmapStatNumbers(el2);
            else
              el2.querySelectorAll(".beatmapset-panel").forEach(
                (panel) => applyFullBeatmapStatNumbers(panel)
              );
          }
        }
      );
      observe.subscribe(
        {
          selector: STATS_ITEM_SEL,
          attributes: ["title", "data-orig-title"],
          characterData: true,
          schedule: "sync",
          signal: ac.signal,
          label: "cards/full-stats-update"
        },
        ({ records }) => {
          const items = /* @__PURE__ */ new Set();
          for (const r of records) {
            const t = r.target instanceof Element ? r.target : r.target.parentElement;
            const item = t?.closest(STATS_ITEM_SEL);
            if (item) items.add(item);
          }
          items.forEach(applyFullStatToItem);
        }
      );
      unsubCache = beatmapsetCache.onChange(
        () => applyFullBeatmapStatNumbers(document)
      );
    }
    applyFeature(settings2.isEnabled(featureId));
    const unsub = settings2.onChange(featureId, applyFeature);
    return () => {
      try {
        unsub();
      } catch (_) {
      }
      stop();
      revertFullBeatmapStatNumbers(document);
      style2.remove();
    };
  }

  // src/features/cards/index.js
  function startCardFeatures(settings2, manageStyle2, options = {}) {
    const stops = [];
    const bag = { add: (fn) => stops.push(fn) };
    safeStart(
      bag,
      () => startAlwaysShowStats(settings2, manageStyle2),
      "card stats"
    );
    safeStart(
      bag,
      () => startFullBeatmapStatNumbers(settings2, manageStyle2),
      "card stat numbers"
    );
    safeStart(bag, () => start(settings2, options), "card extras");
    return () => {
      for (const stop of stops.reverse()) {
        try {
          stop();
        } catch (_) {
        }
      }
    };
  }

  // src/pages/beatmapsets-listing.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.pages = OsuExpertPlus.pages || {};
  OsuExpertPlus.pages.beatmapsetsListing = (() => {
    const name = "BeatmapsetsListing";
    const { manageStyle: manageStyle2, createCleanupBag } = OsuExpertPlus.dom;
    const settings2 = OsuExpertPlus.settings;
    function init4(_match) {
      const bag = createCleanupBag();
      bag.add(startCardFeatures(settings2, manageStyle2));
      bag.add(startPageBehavior());
      return () => bag.dispose();
    }
    return { name, init: init4 };
  })();

  // src/features/beatmapset/discussion-tab-links.js
  var DISCUSSION_TAB_ORIG_HREF_ATTR = "data-oep-discussion-tab-orig-href";
  function _patchDiscussionTabLinks(beatmapsetId) {
    const { discussionPath: discussionPath2, discussionTotalPath: discussionTotalPath2 } = OsuExpertPlus.core.routes;
    const bareSuffix = discussionPath2(beatmapsetId);
    const target = discussionTotalPath2(beatmapsetId);
    document.querySelectorAll("a").forEach((a) => {
      const resolved = a.href.replace(/\/$/, "");
      if (resolved !== `${location.origin}${bareSuffix}`) return;
      if (!a.hasAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR)) {
        a.setAttribute(
          DISCUSSION_TAB_ORIG_HREF_ATTR,
          a.getAttribute("href") ?? ""
        );
      }
      a.setAttribute("href", target);
    });
  }
  function _revertDiscussionTabLinks() {
    document.querySelectorAll(`a[${DISCUSSION_TAB_ORIG_HREF_ATTR}]`).forEach((a) => {
      a.setAttribute(
        "href",
        a.getAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR) ?? ""
      );
      a.removeAttribute(DISCUSSION_TAB_ORIG_HREF_ATTR);
    });
  }
  function startDiscussionTabLinkPatcher(beatmapsetId) {
    if (settings().isEnabled(settingIds().DISCUSSION_DEFAULT_TO_TOTAL)) {
      _patchDiscussionTabLinks(beatmapsetId);
    }
    const offSetting = settings().onChange(
      settingIds().DISCUSSION_DEFAULT_TO_TOTAL,
      (enabled) => {
        if (enabled) _patchDiscussionTabLinks(beatmapsetId);
        else _revertDiscussionTabLinks();
      }
    );
    return () => {
      offSetting();
      _revertDiscussionTabLinks();
    };
  }

  // src/features/osu-web-qtip.js
  function destroyOsuWebQtipIfBound(el2) {
    try {
      const $ = OsuExpertPlus.core.pageWindow.pageWindow().$ || window.$;
      if (!$ || !el2 || !$.fn?.qtip) return;
      const $el = $(el2);
      if ($el.data("qtip")) $el.qtip("destroy");
    } catch (_) {
    }
  }
  function destroyOsuWebQtipOnElementSubtree(root) {
    if (!(root instanceof HTMLElement)) return;
    destroyOsuWebQtipIfBound(root);
    for (const node of root.querySelectorAll("*")) {
      destroyOsuWebQtipIfBound(node);
    }
  }

  // src/features/beatmapset/constants.js
  var ROOT_CLASS = "osu-expertplus-beatmapset-extras";
  var PICKER_DIFF_NAMES_META_ATTR = "data-oep-picker-diff-names-meta";
  var OEP_OMDB_WRAP_CLASS = "oep-beatmapset-omdb-wrap";
  var OEP_OMDB_ROW_CLASS = "oep-beatmapset-omdb-row";
  var OEP_OMDB_VOTE_CLASS = "oep-beatmapset-omdb-vote";
  var BEATCONNECT_DL_PAIRED_CLASS = "oep-beatconnect-paired";
  var BEATCONNECT_DL_BTN_CLASS = "oep-beatmapset-beatconnect-btn";
  var BEATCONNECT_STACK_CLASS = "oep-beatconnect-stack";
  var BEATCONNECT_STACK_ICON_CLASS = "oep-beatconnect-stack__icon";
  var BEATCONNECT_STACK_LABEL_CLASS = "oep-beatconnect-stack__label";
  var BEATMAPSET_FAV_BTN_FAVOURITED_CLASS = "oep-beatmapset-favourite-btn--favourited";

  // src/features/beatmapset/favourites.js
  function findBeatmapsetFavouriteStatSpan(header) {
    const heart = header.querySelector(".beatmapset-header__value .fa-heart");
    return heart?.closest(".beatmapset-header__value") ?? null;
  }
  function startBeatmapsetFavouriteButtonPinkIndicator(header) {
    const buttons = header.querySelector(".beatmapset-header__buttons");
    if (!buttons) return () => {
    };
    function findFavouriteButton() {
      return buttons.querySelector(
        "button.btn-osu-big--beatmapset-header-square"
      );
    }
    function sync() {
      const btn = findFavouriteButton();
      if (!btn) return;
      const heart = btn.querySelector(".fa-heart");
      const favourited = Boolean(heart?.classList.contains("fas"));
      btn.classList.toggle(BEATMAPSET_FAV_BTN_FAVOURITED_CLASS, favourited);
    }
    sync();
    const unsubscribe = observe.subscribe(
      {
        selector: ".beatmapset-header__buttons, .beatmapset-header__buttons *",
        attributes: ["class"],
        schedule: "sync",
        label: "beatmapset/favourite-button"
      },
      sync
    );
    return () => {
      unsubscribe();
      findFavouriteButton()?.classList.remove(
        BEATMAPSET_FAV_BTN_FAVOURITED_CLASS
      );
    };
  }
  function setupBeatmapsetFavouriteHoverPopover(header, beatmapsetId, pathRe, favouriteCount) {
    const fc = favouriteCount == null ? NaN : Number(favouriteCount);
    const skipApi = Number.isFinite(fc) && fc <= 0;
    const api = OsuExpertPlus.api;
    let usersPromise = null;
    const popover = el("div", {
      class: `${ROOT_CLASS}__fav-popover`,
      role: "tooltip"
    });
    const titleEl = el(
      "div",
      { class: `${ROOT_CLASS}__fav-popover-title` },
      "Favourites"
    );
    const scrollEl = el("div", { class: `${ROOT_CLASS}__fav-popover-scroll` });
    popover.appendChild(titleEl);
    popover.appendChild(scrollEl);
    document.body.appendChild(popover);
    function recentFavouriteChip(u) {
      const id = u?.id;
      const name = u?.username ?? (id != null ? String(id) : "?");
      if (id == null) {
        return el(
          "span",
          {
            class: `${ROOT_CLASS}__header-fav-chip ${ROOT_CLASS}__header-fav-chip--text`
          },
          name
        );
      }
      const rawUrl = u?.avatar_url;
      const avatarUrl = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : `https://a.ppy.sh/${id}`;
      const img = el("img", {
        class: `${ROOT_CLASS}__header-fav-avatar`,
        src: avatarUrl,
        alt: "",
        width: "24",
        height: "24",
        loading: "lazy",
        decoding: "async"
      });
      return el(
        "a",
        {
          class: `${ROOT_CLASS}__header-fav-chip`,
          href: `https://osu.ppy.sh/users/${id}`
        },
        img,
        el("span", { class: `${ROOT_CLASS}__header-fav-name` }, name)
      );
    }
    function loadUsers() {
      if (skipApi) return Promise.resolve(
        /** @type {object[]} */
        []
      );
      usersPromise ??= api.getBeatmapset(beatmapsetId, { include: ["recent_favourites"] }).then(
        (set) => Array.isArray(set?.recent_favourites) ? set.recent_favourites : []
      ).catch((e) => {
        usersPromise = null;
        throw e;
      });
      return usersPromise;
    }
    function positionPopover(anchor) {
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      popover.style.left = "0px";
      popover.style.top = "0px";
      popover.style.transform = "none";
      const pw = popover.offsetWidth;
      const ph = popover.offsetHeight;
      let left = r.right + margin;
      if (left + pw > window.innerWidth - margin)
        left = Math.max(margin, r.left - pw - margin);
      let top = r.top + r.height / 2 - ph / 2;
      top = Math.min(Math.max(margin, top), window.innerHeight - ph - margin);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }
    let showTimer = 0;
    let hideTimer = 0;
    let visible = false;
    let boundSpan = null;
    function clearTimers() {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      showTimer = 0;
      hideTimer = 0;
    }
    function hidePopover() {
      clearTimers();
      visible = false;
      popover.classList.remove(`${ROOT_CLASS}__fav-popover--visible`);
      popover.setAttribute("aria-hidden", "true");
    }
    function containsFavOrPopover(node) {
      if (!(node instanceof Node)) return false;
      return !!boundSpan && boundSpan.contains(node) || popover.contains(node);
    }
    function scheduleHide() {
      clearTimers();
      hideTimer = window.setTimeout(() => {
        hideTimer = 0;
        hidePopover();
      }, 350);
    }
    async function showPopover(anchor) {
      clearTimers();
      if (!pathRe.test(location.pathname) || !document.body.contains(header))
        return;
      destroyOsuWebQtipIfBound(anchor);
      visible = true;
      popover.setAttribute("aria-hidden", "false");
      scrollEl.replaceChildren(
        el(
          "span",
          { class: `${ROOT_CLASS}__header-favouriters-muted` },
          "Loading…"
        )
      );
      popover.classList.add(`${ROOT_CLASS}__fav-popover--visible`);
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });
      if (skipApi) {
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "No favourites yet."
          )
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
        return;
      }
      try {
        const users = await loadUsers();
        if (!pathRe.test(location.pathname) || !visible) return;
        if (!Array.isArray(users) || users.length === 0) {
          scrollEl.replaceChildren(
            el(
              "span",
              { class: `${ROOT_CLASS}__header-favouriters-muted` },
              "No recent favourites to show."
            )
          );
        } else {
          scrollEl.replaceChildren();
          for (const u of users) {
            scrollEl.appendChild(recentFavouriteChip(u));
          }
        }
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      } catch {
        if (!visible) return;
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "Could not load favourites."
          )
        );
        requestAnimationFrame(() => {
          if (visible) positionPopover(anchor);
        });
      }
    }
    function onSpanEnter(anchor) {
      destroyOsuWebQtipIfBound(anchor);
      clearTimers();
      showTimer = window.setTimeout(() => {
        showTimer = 0;
        void showPopover(anchor);
      }, 110);
    }
    function onSpanLeave(anchor, e) {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      clearTimers();
      scheduleHide();
    }
    function stopMouseoverBubble(e) {
      e.stopPropagation();
    }
    let spanAbort = null;
    function bindSpan(span) {
      if (span === boundSpan) return;
      unbindSpan();
      boundSpan = span;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      span.addEventListener("mouseenter", () => onSpanEnter(span), opts);
      span.addEventListener("mouseleave", (e) => onSpanLeave(span, e), opts);
      span.addEventListener("mouseover", stopMouseoverBubble, opts);
      spanAbort = ac;
    }
    function unbindSpan() {
      spanAbort?.abort();
      spanAbort = null;
      if (boundSpan) destroyOsuWebQtipIfBound(boundSpan);
      boundSpan = null;
    }
    popover.addEventListener("mouseenter", () => {
      clearTimers();
    });
    popover.addEventListener("mouseleave", (e) => {
      const rel = e.relatedTarget;
      if (rel && containsFavOrPopover(rel)) return;
      scheduleHide();
    });
    let moDebounce = 0;
    function scheduleTryBind() {
      if (moDebounce) window.clearTimeout(moDebounce);
      moDebounce = window.setTimeout(() => {
        moDebounce = 0;
        if (!document.body.contains(header)) return;
        const span = findBeatmapsetFavouriteStatSpan(header);
        if (span) bindSpan(span);
        else unbindSpan();
      }, 40);
    }
    const unsubscribe = observe.subscribe(
      {
        selector: ".beatmapset-header__value",
        schedule: "sync",
        label: "beatmapset/favourites-popover"
      },
      scheduleTryBind
    );
    function onWinResize() {
      if (visible && boundSpan) positionPopover(boundSpan);
    }
    window.addEventListener("resize", onWinResize, { passive: true });
    scheduleTryBind();
    return () => {
      if (moDebounce) window.clearTimeout(moDebounce);
      unsubscribe();
      window.removeEventListener("resize", onWinResize);
      spanAbort?.abort();
      spanAbort = null;
      boundSpan = null;
      clearTimers();
      hidePopover();
      popover.remove();
    };
  }

  // src/features/beatmapset/header-buttons.js
  var BUTTONS_SEL = ".beatmapset-header__buttons";
  var markerAttr = (name) => `data-oep-beatmapset-${name}`;
  function buttonBarWithout(header, name) {
    const buttons = header.querySelector(BUTTONS_SEL);
    if (!(buttons instanceof HTMLElement)) return null;
    return buttons.querySelector(`[${markerAttr(name)}]`) ? null : buttons;
  }
  function findBeatmapsetOsuDirectButton(buttonsEl) {
    const links = qsa("a.btn-osu-big", buttonsEl);
    return links.find((a) => {
      const h2 = a.getAttribute("href") || "";
      return h2.startsWith("osu://") || /support-the-game/i.test(h2);
    }) ?? null;
  }
  function squareLink({ name, href, title, icon }) {
    return el(
      "a",
      {
        class: "btn-osu-big btn-osu-big--beatmapset-header-square",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
        [markerAttr(name)]: "",
        title,
        "aria-label": title
      },
      el(
        "span",
        { class: "btn-osu-big__content btn-osu-big__content--center" },
        el(
          "span",
          { class: "btn-osu-big__icon" },
          el(
            "span",
            { class: "fa fa-fw" },
            el("span", { class: `fas ${icon}`, "aria-hidden": "true" })
          )
        )
      )
    );
  }
  function insertSquare(buttons, link, afterNames) {
    const after = afterNames.map((name) => buttons.querySelector(`[${markerAttr(name)}]`)).find(Boolean) ?? findBeatmapsetOsuDirectButton(buttons);
    if (after) after.insertAdjacentElement("afterend", link);
    else buttons.appendChild(link);
  }
  function mountBeatconnectDownloadSplit(header, beatmapsetId) {
    const buttons = buttonBarWithout(header, "beatconnect");
    const id = Number(beatmapsetId);
    if (!buttons || !Number.isFinite(id)) return void 0;
    const dlRe = new RegExp(String.raw`/beatmapsets/${id}/download`, "i");
    const primaryDl = qsa("a.btn-osu-big", buttons).find(
      (a) => dlRe.test(a.getAttribute("href") || "")
    );
    if (!primaryDl) return void 0;
    primaryDl.classList.add(BEATCONNECT_DL_PAIRED_CLASS);
    const beatconnectBtn = el(
      "a",
      {
        class: `btn-osu-big btn-osu-big--beatmapset-header ${BEATCONNECT_DL_BTN_CLASS}`,
        href: `https://beatconnect.io/b/${id}`,
        target: "_blank",
        rel: "noopener noreferrer",
        [markerAttr("beatconnect")]: ""
      },
      el(
        "span",
        {
          class: `btn-osu-big__content ${BEATCONNECT_STACK_CLASS}`
        },
        el(
          "span",
          {
            class: `btn-osu-big__icon ${BEATCONNECT_STACK_ICON_CLASS}`
          },
          el("img", {
            class: "oep-beatconnect-logo",
            src: "https://beatconnect.io/static/img/logo.png",
            alt: "Beatconnect",
            decoding: "async"
          })
        ),
        el("span", { class: BEATCONNECT_STACK_LABEL_CLASS }, "Beatconnect")
      )
    );
    primaryDl.after(beatconnectBtn);
    return () => {
      primaryDl.classList.remove(BEATCONNECT_DL_PAIRED_CLASS);
      beatconnectBtn.remove();
    };
  }
  function mountBeatmapsetPreviewAudioButton(header, beatmapsetId) {
    const buttons = buttonBarWithout(header, "preview-audio");
    const id = Number(beatmapsetId);
    if (!buttons || !Number.isFinite(id)) return void 0;
    const previewLink = squareLink({
      name: "preview-audio",
      href: `https://b.ppy.sh/preview/${id}.mp3`,
      title: "Open preview audio",
      icon: "fa-volume-up"
    });
    insertSquare(buttons, previewLink, ["mp3", "bg"]);
    return () => previewLink.remove();
  }
  function mountBeatmapsetBackgroundButton(header, beatmapsetId) {
    const buttons = buttonBarWithout(header, "bg");
    if (!buttons) return void 0;
    const bgLink = squareLink({
      name: "bg",
      href: `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`,
      title: "Open background",
      icon: "fa-image"
    });
    insertSquare(buttons, bgLink, []);
    return () => bgLink.remove();
  }
  function mountBeatmapsetMp3Button(header, beatmapsetId) {
    const buttons = buttonBarWithout(header, "mp3");
    if (!buttons) return void 0;
    const mp3Link = squareLink({
      name: "mp3",
      href: `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`,
      title: "Download MP3 (osu.ppyd.sh, third-party)",
      icon: "fa-music"
    });
    insertSquare(buttons, mp3Link, ["bg"]);
    return () => mp3Link.remove();
  }

  // src/features/scoreboard/context.js
  var MOD_GRID_CLASS = "oep-beatmap-scoreboard-mods";
  var WILDCARD_MERGED_ROW_ATTR = "data-oep-wildcard-merged-row";
  var SCORE_USER_SEARCH_RESULT_ATTR = "data-oep-user-search-result";
  var SCOREBOARD_PP_ORIGINAL_ATTR = "data-oep-scoreboard-pp-original";
  var EXTENDED_SCORE_ROW_ATTR = "data-oep-api-extended-score";
  var SCOREBOARD_SORT_VALUE_ATTR = "data-oep-sort-value";
  var SCOREBOARD_ROW_SEL = "tr.beatmap-scoreboard-table__body-row";
  var SCOREBOARD_TBODY_SEL = "tbody.beatmap-scoreboard-table__body";
  var SCOREBOARD_CELL_LINK_SEL = "a.beatmap-scoreboard-table__cell-content";
  var MOD_HIDDEN_ATTR = "data-oep-mod-hidden";
  var MERGED_MOD_ATTR = "data-oep-merged-mod";
  var CREDENTIALS_CHANGED_EVENT = "oep-osu-api-credentials-changed";
  var WILDCARD_DUPE_ROW_ATTR = "data-oep-wildcard-dupe";
  var RATE_EDIT_ROW_ATTR = "data-oep-rate-edit";
  var ROW_HIDE_ATTR = "data-oep-hide";
  var RATE_EDIT_FILTER_BAR_ATTR = "data-oep-rate-edit-filter-bar";
  var SCOREBOARD_USER_SEARCH_ATTR = "data-oep-beatmap-user-search";
  var SCOREBOARD_TOOLS_ROW_ATTR = "data-oep-scoreboard-tools-row";
  var WILDCARD_LOADING_CLASS = "oep-wildcard-loading";
  var SCOREBOARD_MODS_SEL = ".beatmapset-scoreboard__mods";
  var SCOREBOARD_HTML_TABLE_SEL = "table.beatmap-scoreboard-table__table";
  function rowHideReasons(row) {
    return (row.getAttribute(ROW_HIDE_ATTR) || "").split(/\s+/).filter(Boolean);
  }
  function setRowHidden(row, reason, hidden) {
    const reasons = rowHideReasons(row);
    if (reasons.includes(reason) === hidden) return;
    const next = hidden ? [...reasons, reason] : reasons.filter((r) => r !== reason);
    if (next.length) row.setAttribute(ROW_HIDE_ATTR, next.join(" "));
    else row.removeAttribute(ROW_HIDE_ATTR);
  }
  function isScoreboardRowHidden(row, reason) {
    if (reason) return rowHideReasons(row).includes(reason);
    return row.hasAttribute(ROW_HIDE_ATTR) || row instanceof HTMLElement && row.style.display === "none";
  }
  var rowScores = /* @__PURE__ */ new WeakMap();
  function registerRowScore(row, score) {
    rowScores.set(row, score);
  }
  function getRowScore(row) {
    return rowScores.get(row);
  }
  function findBeatmapScoreboardRoot() {
    const mods = document.querySelector(".beatmapset-scoreboard__mods");
    if (mods instanceof HTMLElement) {
      const byClass = mods.closest(".beatmapset-scoreboard");
      if (byClass instanceof HTMLElement) return byClass;
      let el2 = mods;
      for (let d = 0; el2 && d < 16; d++, el2 = el2.parentElement) {
        if (el2.querySelector?.(".play-detail-list") || el2.querySelector?.(".beatmap-scoreboard-table")) {
          return el2;
        }
      }
    }
    const board = document.querySelector(".beatmapset-scoreboard");
    return board instanceof HTMLElement ? board : null;
  }
  function getBeatmapPageBeatmapId() {
    const id = getCurrentBeatmapId();
    return id == null ? null : String(id);
  }
  function getBeatmapPageRuleset() {
    return getCurrentRuleset();
  }
  function getActiveBeatmapScoreboardFilterMods(scoreboardRoot) {
    const seen = /* @__PURE__ */ new Set();
    try {
      const usp = new URLSearchParams(location.search || "");
      const q = [...usp.getAll("mods[]"), ...usp.getAll("mods")];
      for (const raw of q) {
        for (const part of String(raw).split(/[,\s+]+/)) {
          const ac = part.trim().toUpperCase();
          if (ac && ac !== "NM") seen.add(ac);
        }
      }
    } catch (_) {
    }
    const modsRoot = scoreboardRoot.querySelector(".beatmapset-scoreboard__mods");
    if (!(modsRoot instanceof HTMLElement)) return [...seen].sort();
    const enabled = modsRoot.querySelectorAll(
      ".beatmap-scoreboard-mod.beatmap-scoreboard-mod--enabled .mod__icon[data-acronym], .beatmap-scoreboard-mod[aria-pressed='true'] .mod__icon[data-acronym]"
    );
    for (const icon of enabled) {
      const ac = String(icon.getAttribute("data-acronym") || "").trim().toUpperCase();
      if (!ac || ac === "NM") continue;
      seen.add(ac);
    }
    return [...seen].sort();
  }
  function isLazerModeEnabledForLeaderboard() {
    const toggle = document.querySelector(
      'button[data-url*="legacy_score_only"]'
    );
    if (!(toggle instanceof HTMLButtonElement)) return false;
    if (toggle.querySelector(".fa-check-square")) return true;
    if (toggle.querySelector(".fa-square")) return false;
    const m = /legacy_score_only(?:%5D|\])=([01])\b/i.exec(
      toggle.getAttribute("data-url") || ""
    );
    return m ? m[1] === "1" : false;
  }
  function readScoreDisplayPrefs() {
    let raw = null;
    try {
      const prefs = pageWindow()?.osuCore?.userPreferences;
      if (prefs && typeof prefs.get === "function") {
        raw = {
          legacy_score_only: prefs.get("legacy_score_only"),
          scoring_mode: prefs.get("scoring_mode")
        };
      }
    } catch {
    }
    if (!raw) {
      try {
        const parsed = JSON.parse(
          pageLocalStorage()?.getItem("userPreferences") ?? "null"
        );
        if (parsed && typeof parsed === "object") raw = parsed;
      } catch {
      }
    }
    const legacyScoreOnly = typeof raw?.legacy_score_only === "boolean" ? raw.legacy_score_only : !isLazerModeEnabledForLeaderboard();
    const scoringMode = raw?.scoring_mode === "classic" ? "classic" : "standardised";
    return { legacyScoreOnly, scoringMode };
  }
  var _beatmapFullComboCache = /* @__PURE__ */ new Map();
  function getBeatmapFullComboFromBeatmapsetJson(beatmapId) {
    const key = String(beatmapId);
    if (_beatmapFullComboCache.has(key)) {
      return _beatmapFullComboCache.get(key) ?? null;
    }
    const data = readBeatmapsetJson();
    const idNum = Number(beatmapId);
    const found = data?.beatmaps?.find(
      (b) => b?.id === idNum || String(b?.id ?? "") === String(beatmapId)
    ) ?? null;
    const raw = found?.max_combo ?? found?.maxCombo ?? null;
    const n = raw != null ? Number(raw) : NaN;
    const maxCombo = Number.isFinite(n) && n > 0 ? n : null;
    _beatmapFullComboCache.set(key, maxCombo);
    return maxCombo;
  }

  // src/features/beatmapset/bbcode-spoilers.js
  function bindBbcodeSpoilers(root) {
    if (!root) return;
    const contentSel = [
      "[data-spoiler-content]",
      '[class*="spoiler" i][class*="content" i]',
      '[class*="spoiler" i][class*="body" i]',
      ".spoiler-content",
      ".spoiler__content",
      ".bbcode-spoiler__content",
      ".bbcode__spoiler-content"
    ].join(",");
    const contentEls = Array.from(root.querySelectorAll(contentSel));
    if (contentEls.length === 0) return;
    const containerToContents = /* @__PURE__ */ new Map();
    for (const contentEl of contentEls) {
      let container = contentEl.closest('[class*="spoiler" i]');
      if (container === contentEl) {
        container = contentEl.parentElement?.closest('[class*="spoiler" i]') ?? contentEl.parentElement;
      }
      if (!container) continue;
      const arr = containerToContents.get(container) ?? [];
      arr.push(contentEl);
      containerToContents.set(container, arr);
    }
    const triggerSel = [
      "summary",
      "button",
      '[role="button"]',
      "[data-spoiler-toggle]",
      '[class*="spoiler" i][class*="title" i]',
      '[class*="spoiler" i][class*="trigger" i]',
      '[class*="spoiler" i][class*="toggle" i]',
      '[class*="spoiler" i][class*="link" i]',
      ".spoiler-title",
      ".spoiler__title",
      ".spoiler-toggle",
      ".spoiler__toggle",
      ".bbcode-spoiler__title",
      ".bbcode__spoiler-title",
      ".bbcode-spoilerbox__link"
    ].join(",");
    const isOpenInitial = (el2) => {
      try {
        const cs = window.getComputedStyle(el2);
        const rect = el2.getBoundingClientRect();
        const renderVisible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden";
        return cs.display !== "none" && renderVisible && cs.opacity !== "0";
      } catch {
        return !el2.hidden;
      }
    };
    const ownerOf = (node) => {
      for (let n = node.parentElement; n && n !== root; n = n.parentElement) {
        if (containerToContents.has(
          /** @type {HTMLElement} */
          n
        )) return n;
      }
      return containerToContents.has(root) ? root : null;
    };
    for (const [container, contents] of containerToContents.entries()) {
      if (!container || container.dataset.oepSpoilersBound === "1") continue;
      container.dataset.oepSpoilersBound = "1";
      for (const contentEl of contents) {
        if (contentEl.dataset.oepSpoilersPrevDisplay != null) continue;
        const inlineDisplay = contentEl.style.display;
        if (inlineDisplay) {
          contentEl.dataset.oepSpoilersPrevDisplay = inlineDisplay;
          continue;
        }
        try {
          const cs = window.getComputedStyle(contentEl);
          if (cs.display && cs.display !== "none")
            contentEl.dataset.oepSpoilersPrevDisplay = cs.display;
        } catch {
        }
      }
      const initiallyOpen = contents.some((c) => isOpenInitial(c));
      container.dataset.oepSpoilersOpen = initiallyOpen ? "1" : "0";
      const triggerEls = Array.from(container.querySelectorAll(triggerSel)).filter((n) => !contents.includes(n) && ownerOf(n) === container);
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextOpen = container.dataset.oepSpoilersOpen !== "1";
        container.dataset.oepSpoilersOpen = nextOpen ? "1" : "0";
        for (const contentEl of contents) {
          if (nextOpen) {
            contentEl.hidden = false;
            const prev = contentEl.dataset.oepSpoilersPrevDisplay;
            contentEl.style.display = prev && prev !== "none" ? prev : "block";
          } else {
            contentEl.hidden = true;
            contentEl.style.display = "none";
          }
        }
      };
      if (triggerEls.length) {
        for (const t of triggerEls) t.addEventListener("click", handler);
      } else {
        container.addEventListener("click", (e) => {
          const target = (
            /** @type {HTMLElement} */
            e.target
          );
          if (!target) return;
          if (contents.some((c) => c.contains(target))) return;
          if (ownerOf(target) !== container && target !== container) return;
          handler(e);
        });
      }
      container.addEventListener("click", (e) => {
        const target = (
          /** @type {HTMLElement} */
          e.target
        );
        if (!target) return;
        const anchor = target.closest("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (href === "#") {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  // src/features/beatmapset/info-modals.js
  function displayText(s) {
    const t = s == null ? "" : String(s).trim();
    return t.length ? t : null;
  }
  function parseTags(tagsField) {
    const raw = tagsField == null ? "" : String(tagsField).trim();
    if (!raw) return [];
    return raw.split(/\s+/).filter(Boolean);
  }
  function rawTagsFromData(tagsField) {
    if (tagsField == null) return "";
    return String(tagsField);
  }
  function beatmapsetDescriptionHtmlFromData(data) {
    if (!data) return null;
    const d = data.description;
    if (d == null) return null;
    const html = typeof d === "string" ? d : d.description;
    if (html == null) return null;
    const s = String(html).trim();
    return s.length ? s : null;
  }
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }
  function flashCopiedToast(toastEl) {
    toastEl.classList.add(`${ROOT_CLASS}__copied-toast--show`);
    const prev = toastEl.getAttribute("data-oep-toast-timer");
    if (prev) window.clearTimeout(Number(prev));
    const id = window.setTimeout(() => {
      toastEl.classList.remove(`${ROOT_CLASS}__copied-toast--show`);
      toastEl.removeAttribute("data-oep-toast-timer");
    }, 1400);
    toastEl.setAttribute("data-oep-toast-timer", String(id));
  }
  function appendCopyButton(elFn, parent, text, ariaLabel) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__copy-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true"
      },
      "Copied"
    );
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__copy-btn`,
      "aria-label": ariaLabel,
      title: "Copy"
    });
    const icon = elFn("i", { class: "fas fa-copy", "aria-hidden": "true" });
    btn.appendChild(icon);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(text).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(btn);
    parent.appendChild(wrap);
  }
  function buildTagChip(elFn, tag) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__tag-wrap` });
    const toast = elFn(
      "span",
      {
        class: `${ROOT_CLASS}__copied-toast`,
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true"
      },
      "Copied"
    );
    const tagBtn = elFn(
      "button",
      {
        type: "button",
        class: `${ROOT_CLASS}__tag`,
        title: "Click to copy this tag",
        "aria-label": `Copy tag "${tag}"`
      },
      tag
    );
    tagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(tag).then((ok) => {
        if (ok) flashCopiedToast(toast);
      });
    });
    wrap.appendChild(toast);
    wrap.appendChild(tagBtn);
    return wrap;
  }
  function buildModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid)."
      );
    }
    const frag = document.createDocumentFragment();
    const rows = [
      { label: "Title", value: displayText(data.title) },
      { label: "Title (Unicode)", value: displayText(data.title_unicode) },
      { label: "Artist", value: displayText(data.artist) },
      { label: "Artist (Unicode)", value: displayText(data.artist_unicode) },
      { label: "Source", value: displayText(data.source) }
    ];
    rows.forEach(({ label, value }) => {
      const row = elFn("div", { class: `${ROOT_CLASS}__row` });
      row.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, label));
      const valueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
      valueCell.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value${value ? "" : ` ${ROOT_CLASS}__value--muted`}`
          },
          value || "—"
        )
      );
      if (value) {
        appendCopyButton(elFn, valueCell, value, `Copy ${label} to clipboard`);
      }
      row.appendChild(valueCell);
      frag.appendChild(row);
    });
    const tagRow = elFn("div", { class: `${ROOT_CLASS}__row` });
    tagRow.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, "Tags"));
    const tagValueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
    const tags = parseTags(data.tags);
    const rawTags = rawTagsFromData(data.tags);
    if (tags.length) {
      const tagsWrap = elFn("div", { class: `${ROOT_CLASS}__tags` });
      tags.forEach((tag) => {
        tagsWrap.appendChild(buildTagChip(elFn, tag));
      });
      tagValueCell.appendChild(tagsWrap);
      if (rawTags.length > 0) {
        appendCopyButton(
          elFn,
          tagValueCell,
          rawTags,
          "Copy all tags (original string) to clipboard"
        );
      }
    } else {
      tagValueCell.appendChild(
        elFn(
          "p",
          { class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted` },
          "—"
        )
      );
    }
    tagRow.appendChild(tagValueCell);
    frag.appendChild(tagRow);
    return frag;
  }
  function buildDescriptionModalBody(data, elFn) {
    if (!data) {
      return elFn(
        "p",
        { class: `${ROOT_CLASS}__err` },
        "Could not read beatmapset data (#json-beatmapset missing or invalid)."
      );
    }
    const html = beatmapsetDescriptionHtmlFromData(data);
    const wrap = elFn("div", {});
    if (!html) {
      wrap.appendChild(
        elFn(
          "p",
          {
            class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted`
          },
          "No description."
        )
      );
      return wrap;
    }
    const toolbar = elFn("div", {
      class: `${ROOT_CLASS}__description-toolbar`
    });
    const prose = elFn("div", { class: `${ROOT_CLASS}__description-prose` });
    prose.innerHTML = html;
    const plainForCopy = prose.innerText.replace(/\s+$/g, "").trim();
    appendCopyButton(
      elFn,
      toolbar,
      plainForCopy.length ? plainForCopy : html.replace(/<[^>]+>/g, " ").trim(),
      "Copy description to clipboard"
    );
    wrap.appendChild(toolbar);
    wrap.appendChild(prose);
    return wrap;
  }
  var DESCRIPTION_BG_SELECTORS = [
    ".beatmapset-description",
    ".beatmapset__description",
    ".beatmapset-info__description",
    ".bbcode--beatmap-description",
    ".bbcode"
  ];
  function resolveDescriptionSectionBackgroundColor() {
    for (const selector of DESCRIPTION_BG_SELECTORS) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const bg = getComputedStyle(node).backgroundColor;
      if (!bg) continue;
      if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") continue;
      return bg;
    }
    return "hsl(var(--hsl-b4, 333 18% 18%))";
  }
  function buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapId) {
    const wrap = elFn("div", { class: `${ROOT_CLASS}__modal-header-osu-wrap` });
    const btn = elFn("button", {
      type: "button",
      class: `${ROOT_CLASS}__modal-header-osu-btn`,
      "aria-label": "Open .osu file for current difficulty"
    });
    btn.appendChild(
      elFn("i", { class: "fas fa-file-code", "aria-hidden": "true" })
    );
    btn.appendChild(document.createTextNode("open .osu"));
    const msgEl = elFn("p", {
      class: `${ROOT_CLASS}__modal-header-osu-msg`,
      "aria-live": "polite"
    });
    wrap.appendChild(btn);
    wrap.appendChild(msgEl);
    let msgResetTimer = 0;
    function flashMsg(msg) {
      msgEl.textContent = msg;
      if (msgResetTimer) window.clearTimeout(msgResetTimer);
      msgResetTimer = window.setTimeout(() => {
        msgEl.textContent = "";
        msgResetTimer = 0;
      }, 3200);
    }
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = getBeatmapId();
      if (!id) {
        flashMsg("Could not detect a beatmap id for this page.");
        return;
      }
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const url = `https://osu.ppy.sh/osu/${encodeURIComponent(id)}`;
        const resp = await OsuExpertPlus.api.siteFetch(url);
        if (!resp.ok) {
          flashMsg(`Could not load .osu (HTTP ${resp.status}).`);
          return;
        }
        const text = await resp.text();
        const blob = new Blob([text], {
          type: "text/plain;charset=utf-8"
        });
        const objectUrl = URL.createObjectURL(blob);
        const opened = window.open(objectUrl, "_blank");
        if (opened) {
          try {
            opened.opener = null;
          } catch (_) {
          }
        } else {
          flashMsg("Popup blocked — allow popups for osu.ppy.sh to view .osu.");
        }
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 12e4);
      } catch (_) {
        flashMsg("Could not load .osu (network error).");
      } finally {
        btn.disabled = false;
      }
    });
    return wrap;
  }
  function attachBeatmapsetInfoModal(elFn, rootClass, cfg) {
    const {
      title,
      titleId,
      buttonText,
      buttonIconClass = "",
      modalExtraClass = "",
      buildBody,
      onBodyBuilt,
      buildModalTitleExtra,
      mountButton,
      buttonExtraClass = ""
    } = cfg;
    const btnClass = `${rootClass}__action-btn${buttonExtraClass ? ` ${buttonExtraClass}` : ""}`;
    const openBtn = buttonIconClass ? elFn(
      "button",
      { type: "button", class: btnClass },
      elFn("i", {
        class: buttonIconClass,
        "aria-hidden": "true"
      }),
      buttonText
    ) : elFn("button", { type: "button", class: btnClass }, buttonText);
    mountButton(openBtn);
    const modalPortal = elFn("div", {
      class: `${rootClass}__modal-portal`,
      "aria-hidden": "true"
    });
    const backdrop = elFn("div", { class: `${rootClass}__modal-backdrop` });
    const modal = elFn("div", {
      class: `${rootClass}__modal${modalExtraClass ? ` ${modalExtraClass}` : ""}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId
    });
    modal.style.background = resolveDescriptionSectionBackgroundColor();
    const modalHeader = elFn("div", { class: `${rootClass}__modal-header` });
    const headerStart = elFn("div", {
      class: `${rootClass}__modal-header-start`
    });
    headerStart.appendChild(
      elFn("h2", { class: `${rootClass}__modal-title`, id: titleId }, title)
    );
    if (typeof buildModalTitleExtra === "function") {
      const extra = buildModalTitleExtra(elFn);
      if (extra) headerStart.appendChild(extra);
    }
    modalHeader.appendChild(headerStart);
    const closeBtn = elFn(
      "button",
      {
        type: "button",
        class: `${rootClass}__modal-close`,
        "aria-label": "Close"
      },
      "×"
    );
    modalHeader.appendChild(closeBtn);
    modal.appendChild(modalHeader);
    const modalBody = elFn("div", {
      class: `${rootClass}__modal-body u-fancy-scrollbar`
    });
    modal.appendChild(modalBody);
    let bodyBuilt = false;
    const ensureBody = () => {
      if (bodyBuilt) return;
      bodyBuilt = true;
      modalBody.appendChild(buildBody());
      onBodyBuilt?.(modalBody);
    };
    modalPortal.appendChild(backdrop);
    modalPortal.appendChild(modal);
    document.body.appendChild(modalPortal);
    let modalAbort = null;
    function closeModal() {
      modalPortal.classList.remove(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "true");
      modalAbort?.abort();
      modalAbort = null;
      openBtn.focus();
    }
    function openModal() {
      if (modalPortal.classList.contains(`${rootClass}__modal-portal--open`)) {
        closeBtn.focus();
        return;
      }
      modalAbort?.abort();
      modalAbort = new AbortController();
      const { signal } = modalAbort;
      modalPortal.classList.add(`${rootClass}__modal-portal--open`);
      modalPortal.setAttribute("aria-hidden", "false");
      ensureBody();
      closeBtn.focus();
      const onKeydown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
        }
      };
      document.addEventListener("keydown", onKeydown, {
        signal,
        capture: true
      });
      backdrop.addEventListener(
        "click",
        () => {
          closeModal();
        },
        { signal }
      );
    }
    openBtn.addEventListener("click", () => {
      openModal();
    });
    closeBtn.addEventListener("click", () => {
      closeModal();
    });
    modal.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    return {
      dispose() {
        modalAbort?.abort();
        modalAbort = null;
        modalPortal.remove();
        openBtn.remove();
      }
    };
  }
  function teardownBeatmapDescriptionHeadingLayout(descRow) {
    if (!(descRow instanceof HTMLElement)) return;
    descRow.classList.remove(`${ROOT_CLASS}__description-heading-row`);
    descRow.querySelector(`:scope > .${ROOT_CLASS}__description-heading-actions`)?.remove();
  }
  function startBeatmapsetInfoModals(header, pathRe) {
    let metadataInfoModal = null;
    let descriptionInfoModal = null;
    let descriptionHeadingDescRow = null;
    function disposeBeatmapInfoModalButtons() {
      try {
        metadataInfoModal?.dispose();
      } catch (_) {
      }
      metadataInfoModal = null;
      try {
        descriptionInfoModal?.dispose();
      } catch (_) {
      }
      descriptionInfoModal = null;
      if (descriptionHeadingDescRow instanceof HTMLElement) {
        teardownBeatmapDescriptionHeadingLayout(descriptionHeadingDescRow);
        descriptionHeadingDescRow = null;
      }
    }
    function refreshBeatmapInfoModalButtons() {
      if (!(header instanceof HTMLElement) || !document.body.contains(header))
        return;
      if (!pathRe.test(location.pathname)) return;
      const data = readBeatmapsetJson();
      const artistEl = header.querySelector(
        ".beatmapset-header__details-text--artist"
      );
      if (!metadataInfoModal && artistEl instanceof HTMLElement && !header.querySelector("[data-oep-beatmapset-metadata]")) {
        metadataInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap metadata",
          titleId: `${ROOT_CLASS}-metadata-title`,
          buttonText: "Show metadata",
          buttonIconClass: "fas fa-clipboard-list",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--under-artist`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-metadata", "");
            artistEl.insertAdjacentElement("afterend", btn);
          },
          buildModalTitleExtra: (elFn) => buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapPageBeatmapId),
          buildBody: () => buildModalBody(data, el)
        });
      }
      const infoCol = document.querySelector(".beatmapset-info");
      const firstBox = infoCol?.querySelector(":scope > .beatmapset-info__box");
      const scrollEl = firstBox?.querySelector(
        ":scope > .beatmapset-info__scrollable"
      );
      const descRow = scrollEl?.querySelector(
        ":scope > .beatmapset-info__row:has(.beatmapset-info__description)"
      ) ?? scrollEl?.querySelector(
        ":scope > .beatmapset-info__row:first-child:has(> h3.beatmapset-info__header)"
      );
      const descHeading = descRow?.querySelector(
        ":scope > h3.beatmapset-info__header"
      );
      if (!descriptionInfoModal && descRow instanceof HTMLElement && descHeading instanceof HTMLElement && !descRow.querySelector("[data-oep-beatmapset-desc]")) {
        descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
        descriptionHeadingDescRow = descRow;
        descriptionInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap description",
          titleId: `${ROOT_CLASS}-description-title`,
          buttonText: "Full description",
          buttonIconClass: "fas fa-align-left",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--description-heading`,
          modalExtraClass: `${ROOT_CLASS}__modal--description`,
          // osu-web's heading stays where React put it; the button goes in our
          // own box right after it (styles.js lays both out as one bar).
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-desc", "");
            const actions = el(
              "div",
              { class: `${ROOT_CLASS}__description-heading-actions` },
              btn
            );
            descHeading.insertAdjacentElement("afterend", actions);
          },
          buildBody: () => buildDescriptionModalBody(data, el),
          // Spoilers read their open state from layout, so bind them once the
          // body is in the open modal (B59).
          onBodyBuilt: (body) => bindBbcodeSpoilers(body)
        });
      }
    }
    refreshBeatmapInfoModalButtons();
    const ac = new AbortController();
    waitForElement(".beatmapset-info", { timeout: 12e3, signal: ac.signal }).then(refreshBeatmapInfoModalButtons).catch(() => {
    });
    return () => {
      ac.abort();
      disposeBeatmapInfoModalButtons();
    };
  }

  // src/features/beatmapset/picker.js
  var PICKER_SEL = ".beatmapset-beatmap-picker";
  var PICKER_LINK_SEL = "a.beatmapset-beatmap-picker__beatmap";
  function pickerLinkBeatmapId(a, { pathFallback = false } = {}) {
    if (!(a instanceof HTMLAnchorElement)) return null;
    const parsed = parsePickerHref(a.getAttribute("href"), { pathFallback });
    return parsed ? parsed.beatmapId : null;
  }
  function activePickerBeatmapId(picker) {
    return pickerLinkBeatmapId(
      picker.querySelector(
        `${PICKER_LINK_SEL}.beatmapset-beatmap-picker__beatmap--active`
      )
    );
  }
  function subscribePickerChanges(picker, onChange, { signal, label }) {
    return observe.subscribe(
      {
        selector: `${PICKER_SEL}, ${PICKER_LINK_SEL}`,
        attributes: ["class", "href"],
        schedule: "sync",
        signal,
        label
      },
      ({ records }) => {
        if (records.some((r) => picker.contains(r.target))) onChange();
      }
    );
  }

  // src/features/beatmapset/omdb.js
  function formatOmdbRankDisplay(n) {
    if (n == null || n === "") return null;
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return `#${x.toLocaleString()}`;
  }
  var OMDB_CHART_PAGE_SIZE = 50;
  function omdbChartPageFromRank(rank) {
    const n = Number(rank);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.ceil(n / OMDB_CHART_PAGE_SIZE);
  }
  function getBeatmapsetRankedCalendarYear(header) {
    const data = readBeatmapsetJson();
    const rankedIso = data?.ranked_date;
    if (rankedIso != null && String(rankedIso).trim() !== "") {
      const y = new Date(String(rankedIso)).getUTCFullYear();
      if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
    }
    const scope = (header instanceof HTMLElement ? header.querySelector(".beatmapset-mapping") : null) ?? document.querySelector(".beatmapset-mapping") ?? (header instanceof HTMLElement ? header : null) ?? document.querySelector(".beatmapset-header");
    if (!(scope instanceof HTMLElement)) return null;
    const times = scope.querySelectorAll("time.js-tooltip-time[datetime]");
    for (const t of times) {
      if (!(t instanceof HTMLTimeElement)) continue;
      const dt = t.getAttribute("datetime");
      if (!dt) continue;
      let walk = t.parentElement;
      while (walk && scope.contains(walk)) {
        const txt = walk.textContent || "";
        if (/\branked\b/i.test(txt) || /\bqualified\b/i.test(txt) || /\bapproved\b/i.test(txt)) {
          const y = new Date(dt).getUTCFullYear();
          if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
          break;
        }
        walk = walk.parentElement;
      }
    }
    return null;
  }
  function buildOmdbRanksBlock(entry, rankedYear) {
    const overallHash = formatOmdbRankDisplay(entry.ChartRank);
    const yearHash = formatOmdbRankDisplay(entry.ChartYearRank);
    if (!overallHash && !yearHash) {
      const wrap2 = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap2.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel)
      );
      wrap2.appendChild(document.createTextNode(" "));
      wrap2.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-")
      );
      wrap2.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", ")
      );
      wrap2.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall")
      );
      wrap2.appendChild(document.createTextNode(" "));
      wrap2.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-")
      );
      return wrap2;
    }
    const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
    if (yearHash) {
      const yearLabel = rankedYear != null ? String(rankedYear) : "year";
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel)
      );
      wrap.appendChild(document.createTextNode(" "));
      if (rankedYear != null) {
        const yearPage = omdbChartPageFromRank(entry.ChartYearRank);
        wrap.appendChild(
          el(
            "a",
            {
              class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
              href: `https://omdb.nyahh.net/charts/?y=${encodeURIComponent(String(rankedYear))}&p=${yearPage}`,
              target: "_blank",
              rel: "noopener noreferrer"
            },
            yearHash
          )
        );
      } else {
        wrap.appendChild(
          el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, yearHash)
        );
      }
    }
    if (yearHash && overallHash) {
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", ")
      );
    }
    if (overallHash) {
      const overallPage = omdbChartPageFromRank(entry.ChartRank);
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall")
      );
      wrap.appendChild(document.createTextNode(" "));
      wrap.appendChild(
        el(
          "a",
          {
            class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
            href: `https://omdb.nyahh.net/charts/?y=all-time&p=${overallPage}`,
            target: "_blank",
            rel: "noopener noreferrer"
          },
          overallHash
        )
      );
    }
    return wrap;
  }
  function buildOmdbDistributionRows(entry) {
    if (entry == null) return [];
    const byScore = /* @__PURE__ */ new Map();
    const raw = entry.Ratings;
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        const score = Number(k);
        const count = Number(v);
        if (!Number.isFinite(score) || !Number.isFinite(count)) continue;
        const key = Math.round(score * 2) / 2;
        if (key < 0 || key > 5) continue;
        byScore.set(key, (byScore.get(key) ?? 0) + count);
      }
    }
    const rows = [];
    for (let i = 0; i <= 10; i++) {
      const score = i * 0.5;
      rows.push({ score, count: byScore.get(score) ?? 0 });
    }
    return rows;
  }
  function buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt) {
    const nodes = [];
    if (hasAvg) {
      nodes.push(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__stat-value` },
          avgN.toFixed(2)
        ),
        " avg"
      );
    }
    if (hasCnt) {
      if (nodes.length) nodes.push(" · ");
      nodes.push(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__stat-value` }, String(cntN)),
        ` rating${cntN === 1 ? "" : "s"}`
      );
    }
    return nodes;
  }
  function formatOmdbDistScoreLabel(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return String(score);
    const h2 = Math.round(n * 2) / 2;
    return Number.isInteger(h2) ? String(h2) : h2.toFixed(1);
  }
  function fillOmdbDistPopover(popEl, rows) {
    popEl.replaceChildren();
    popEl.appendChild(
      el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-head` }, "Distribution")
    );
    const maxC = Math.max(1, ...rows.map((r) => r.count));
    for (const { score, count } of rows) {
      const row = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-row` });
      row.appendChild(
        el(
          "span",
          { class: `${OEP_OMDB_ROW_CLASS}__dist-score` },
          `${formatOmdbDistScoreLabel(score)}★`
        )
      );
      const track = el("div", {
        class: `${OEP_OMDB_ROW_CLASS}__dist-bar-track`
      });
      const bar = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-bar` });
      const pct = count <= 0 ? 0 : Math.max(8, count / maxC * 100);
      bar.style.width = `${pct}%`;
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__dist-count` }, String(count))
      );
      popEl.appendChild(row);
    }
  }
  function renderOmdbRatingRowBody(bodyEl, entry, distUi, header, difficultyBlacklistedOnOmdb) {
    bodyEl.classList.remove(
      `${OEP_OMDB_ROW_CLASS}__body--muted`,
      `${OEP_OMDB_ROW_CLASS}__body--error`
    );
    if (difficultyBlacklistedOnOmdb) {
      bodyEl.textContent = "This difficulty is blacklisted on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    if (entry == null) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    const avgN = Number(entry.WeightedAvg);
    const cntN = Number(entry.RatingCount);
    const hasAvg = Number.isFinite(avgN);
    const hasCnt = Number.isFinite(cntN) && cntN > 0;
    const rankedYear = getBeatmapsetRankedCalendarYear(
      header instanceof HTMLElement ? header : null
    );
    const ranksEl = buildOmdbRanksBlock(entry, rankedYear);
    const distRows = buildOmdbDistributionRows(entry);
    const useDistPopover = Boolean(distUi) && distRows.length > 0 && (hasAvg || hasCnt);
    const frag = document.createDocumentFragment();
    let first = true;
    function appendChunk(node) {
      if (!first) frag.appendChild(document.createTextNode(" · "));
      first = false;
      frag.appendChild(node);
    }
    if (hasAvg || hasCnt) {
      const statNodes = buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt);
      if (useDistPopover && distUi) {
        const anchor = el("span", {
          class: `${OEP_OMDB_ROW_CLASS}__dist-anchor`
        });
        const trigger = el(
          "span",
          {
            class: `${OEP_OMDB_ROW_CLASS}__dist-trigger`,
            tabindex: "0",
            title: "Rating breakdown"
          },
          ...statNodes
        );
        anchor.appendChild(trigger);
        distUi.bindTrigger(trigger, distRows);
        appendChunk(anchor);
      } else {
        appendChunk(el("span", {}, ...statNodes));
      }
    }
    if (ranksEl) appendChunk(ranksEl);
    if (first) {
      bodyEl.textContent = "No ratings for this difficulty on OMDB.";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    bodyEl.replaceChildren(frag);
  }
  function parseOmdbOwnRating(entry) {
    const own = entry?.OwnRating;
    if (own == null || String(own).trim() === "") return null;
    const n = Number(own);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 2) / 2;
  }
  function paintOmdbStarUnits(units, score) {
    const s = score == null || !Number.isFinite(Number(score)) ? null : Math.round(Number(score) * 2) / 2;
    for (let i = 0; i < 5; i++) {
      const u = units[i];
      const full = i + 1;
      const half = i + 0.5;
      u.classList.remove(
        `${OEP_OMDB_VOTE_CLASS}__unit--full`,
        `${OEP_OMDB_VOTE_CLASS}__unit--half`,
        `${OEP_OMDB_VOTE_CLASS}__unit--empty`
      );
      if (s == null || s < half) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--empty`);
      } else if (s >= full) {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--full`);
      } else {
        u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--half`);
      }
    }
  }
  function mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !box) return () => {
    };
    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();
    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB"
      },
      "OMDB"
    );
    const keyLink = el(
      "a",
      {
        href: "#",
        class: `${OEP_OMDB_ROW_CLASS}__settings-link`,
        title: "Open Expert+ settings"
      },
      "OMDB API key"
    );
    keyLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      OsuExpertPlus.settingsPanel?.open?.();
    });
    const bodyEl = el(
      "span",
      {
        class: `${OEP_OMDB_ROW_CLASS}__body ${OEP_OMDB_ROW_CLASS}__body--muted`
      },
      "Add an ",
      keyLink,
      " to load OMDB ratings here"
    );
    const statsRow = el("div", { class: OEP_OMDB_ROW_CLASS }, omdbLabel, bodyEl);
    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1"
    });
    wrap.appendChild(statsRow);
    box.insertBefore(wrap, diffName);
    return () => {
      wrap.remove();
    };
  }
  function mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe) {
    const diffName = header.querySelector(".beatmapset-header__diff-name");
    const picker = header.querySelector(PICKER_SEL);
    const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
    if (!diffName || !picker || !box) return () => {
    };
    const stale = box.querySelector('[data-oep-omdb-row="1"]');
    if (stale) stale.remove();
    const distPopoverEl = el("div", {
      class: `${OEP_OMDB_ROW_CLASS}__dist-popover`,
      "data-oep-omdb-dist-popover": "1"
    });
    distPopoverEl.style.cssText = "display:none;position:fixed;z-index:10002;";
    document.body.appendChild(distPopoverEl);
    let distPopoverHideTimer = 0;
    function hideOmdbDistPopover() {
      window.clearTimeout(distPopoverHideTimer);
      distPopoverHideTimer = 0;
      distPopoverEl.style.display = "none";
      distPopoverEl.replaceChildren();
    }
    function positionOmdbDistPopover(anchorRect) {
      const margin = 6;
      const w = distPopoverEl.offsetWidth;
      const h2 = distPopoverEl.offsetHeight;
      let left = anchorRect.left;
      let top = anchorRect.bottom + margin;
      if (left + w > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - w - 8);
      }
      if (top + h2 > window.innerHeight - 8) {
        top = Math.max(8, anchorRect.top - h2 - margin);
      }
      distPopoverEl.style.left = `${left}px`;
      distPopoverEl.style.top = `${top}px`;
    }
    function showOmdbDistPopover(trigger, rows) {
      window.clearTimeout(distPopoverHideTimer);
      fillOmdbDistPopover(distPopoverEl, rows);
      distPopoverEl.style.display = "block";
      positionOmdbDistPopover(trigger.getBoundingClientRect());
    }
    distPopoverEl.addEventListener("mouseenter", () => {
      window.clearTimeout(distPopoverHideTimer);
    });
    distPopoverEl.addEventListener("mouseleave", () => {
      distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 100);
    });
    function onOmdbDistScrollOrResize() {
      if (distPopoverEl.style.display !== "none") hideOmdbDistPopover();
    }
    window.addEventListener("scroll", onOmdbDistScrollOrResize, true);
    window.addEventListener("resize", onOmdbDistScrollOrResize, {
      passive: true
    });
    const omdbDistUi = {
      /**
       * @param {HTMLElement} trigger
       * @param {{ score: number, count: number }[]} rows
       */
      bindTrigger(trigger, rows) {
        const schedHide = () => {
          window.clearTimeout(distPopoverHideTimer);
          distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 120);
        };
        trigger.addEventListener("mouseenter", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("mouseleave", schedHide);
        trigger.addEventListener("focus", () => {
          showOmdbDistPopover(trigger, rows);
        });
        trigger.addEventListener("blur", schedHide);
      }
    };
    const bodyEl = el(
      "span",
      { class: `${OEP_OMDB_ROW_CLASS}__body` },
      "Loading OMDB…"
    );
    const omdbLabel = el(
      "a",
      {
        class: `${OEP_OMDB_ROW_CLASS}__label`,
        href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
        target: "_blank",
        rel: "noopener noreferrer",
        title: "Open this beatmapset on OMDB"
      },
      "OMDB"
    );
    const statsRow = el("div", { class: OEP_OMDB_ROW_CLASS }, omdbLabel, bodyEl);
    const starUnits = [];
    const starsHost = el("div", { class: `${OEP_OMDB_VOTE_CLASS}__stars` });
    for (let si = 0; si < 5; si++) {
      const unitClass = si === 0 ? `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty ${OEP_OMDB_VOTE_CLASS}__unit--has-zero` : `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty`;
      const unit = el("span", { class: unitClass });
      unit.appendChild(
        el("i", {
          class: `far fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--empty`,
          "aria-hidden": "true"
        })
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star-half-alt ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--half`,
          "aria-hidden": "true"
        })
      );
      unit.appendChild(
        el("i", {
          class: `fas fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--full`,
          "aria-hidden": "true"
        })
      );
      if (si === 0) {
        unit.appendChild(
          el("button", {
            type: "button",
            class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--zero`,
            "data-oep-score": "0",
            "aria-label": "Rate 0 out of 5 stars on OMDB (left edge of first star)",
            title: "0★"
          })
        );
      }
      const left = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--left`,
        "data-oep-score": String(si + 0.5),
        "aria-label": `Rate ${si + 0.5} out of 5 stars on OMDB`,
        title: `${si + 0.5}★`
      });
      const right = el("button", {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--right`,
        "data-oep-score": String(si + 1),
        "aria-label": `Rate ${si + 1} out of 5 stars on OMDB`,
        title: `${si + 1}★`
      });
      unit.appendChild(left);
      unit.appendChild(right);
      starUnits.push(unit);
      starsHost.appendChild(unit);
    }
    const clearBtn = el(
      "button",
      {
        type: "button",
        class: `${OEP_OMDB_VOTE_CLASS}__clear ${OEP_OMDB_VOTE_CLASS}__clear--concealed`,
        title: "Remove your OMDB rating",
        "aria-hidden": "true"
      },
      "Clear"
    );
    const voteStatus = el("span", { class: `${OEP_OMDB_VOTE_CLASS}__status` });
    const voteControls = el(
      "div",
      { class: `${OEP_OMDB_VOTE_CLASS}__controls` },
      el("span", { class: `${OEP_OMDB_VOTE_CLASS}__label` }, "Your rating"),
      starsHost,
      clearBtn
    );
    const voteRow = el(
      "div",
      {
        class: OEP_OMDB_VOTE_CLASS,
        "data-oep-omdb-vote": "1",
        style: "display: none"
      },
      voteControls,
      voteStatus
    );
    const wrap = el("div", {
      class: OEP_OMDB_WRAP_CLASS,
      "data-oep-omdb-row": "1"
    });
    wrap.appendChild(statsRow);
    wrap.appendChild(voteRow);
    box.insertBefore(wrap, diffName);
    const beatmapIdsInSet = /* @__PURE__ */ new Set();
    for (const b of readBeatmapsetJson()?.beatmaps ?? []) {
      if (b?.id != null) beatmapIdsInSet.add(Number(b.id));
    }
    let omdbSetFetchSucceeded = false;
    let loadState = "loading";
    let loadError = "";
    let byBeatmapId = /* @__PURE__ */ new Map();
    let hoveredBeatmapId = null;
    let hoverStarScore = null;
    let voteBusy = false;
    let disposed = false;
    let raf = 0;
    function currentDisplayedBeatmapId() {
      return hoveredBeatmapId ?? activePickerBeatmapId(picker);
    }
    function isOmdbDifficultyBlacklisted(beatmapId) {
      if (!omdbSetFetchSucceeded || beatmapId == null) return false;
      if (byBeatmapId.size === 0) return false;
      const n = Number(beatmapId);
      if (!Number.isFinite(n) || !beatmapIdsInSet.has(n)) return false;
      return !byBeatmapId.has(n);
    }
    function setVoteBusy(on) {
      voteBusy = on;
      voteRow.classList.toggle(`${OEP_OMDB_VOTE_CLASS}--busy`, on);
      clearBtn.disabled = on;
    }
    function syncVoteStars() {
      if (disposed || voteRow.style.display === "none") return;
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        paintOmdbStarUnits(starUnits, null);
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
        return;
      }
      const entry = byBeatmapId.get(id);
      const own = parseOmdbOwnRating(entry);
      const visual = hoverStarScore != null ? hoverStarScore : own;
      paintOmdbStarUnits(starUnits, visual);
      if (own != null) {
        clearBtn.classList.remove(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.removeAttribute("aria-hidden");
      } else {
        clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
        clearBtn.setAttribute("aria-hidden", "true");
      }
    }
    function syncDisplay() {
      if (disposed || !pathRe.test(location.pathname)) return;
      if (loadState !== "ready") {
        bodyEl.textContent = loadState === "error" ? loadError : "Loading OMDB…";
        bodyEl.classList.toggle(
          `${OEP_OMDB_ROW_CLASS}__body--error`,
          loadState === "error"
        );
        bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--muted`);
        return;
      }
      const id = currentDisplayedBeatmapId();
      if (id == null) {
        bodyEl.textContent = "";
        bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
        syncVoteStars();
        return;
      }
      bodyEl.classList.remove(
        `${OEP_OMDB_ROW_CLASS}__body--muted`,
        `${OEP_OMDB_ROW_CLASS}__body--error`
      );
      renderOmdbRatingRowBody(
        bodyEl,
        byBeatmapId.get(id),
        omdbDistUi,
        header,
        isOmdbDifficultyBlacklisted(id)
      );
      syncVoteStars();
    }
    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncDisplay();
      });
    }
    function onPickerMouseOver(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest(PICKER_LINK_SEL);
      if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
      const id = pickerLinkBeatmapId(a);
      if (id != null) hoveredBeatmapId = id;
      scheduleSync();
    }
    function onPickerMouseLeave() {
      hoveredBeatmapId = null;
      scheduleSync();
    }
    function onHashChange() {
      hoveredBeatmapId = null;
      hoverStarScore = null;
      scheduleSync();
    }
    function onStarHalfEnter(e) {
      const t = e.currentTarget;
      if (!(t instanceof HTMLElement)) return;
      const raw = t.getAttribute("data-oep-score");
      const n = raw == null ? NaN : Number(raw);
      if (!Number.isFinite(n)) return;
      hoverStarScore = n;
      syncVoteStars();
    }
    function onVoteControlsMouseLeave(e) {
      const rel = e.relatedTarget;
      if (rel instanceof Node && voteControls.contains(rel)) return;
      hoverStarScore = null;
      syncVoteStars();
    }
    async function reloadSetRatings() {
      const list = await omdb().fetchBeatmapsetRatings(beatmapsetId);
      if (disposed || !pathRe.test(location.pathname)) return;
      byBeatmapId = /* @__PURE__ */ new Map();
      for (const item of list || []) {
        const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
        if (bid != null) byBeatmapId.set(Number(bid), item);
      }
      omdbSetFetchSucceeded = true;
      syncDisplay();
    }
    async function submitVote(score) {
      if (voteBusy || disposed || !pathRe.test(location.pathname)) return;
      const id = currentDisplayedBeatmapId();
      if (id == null) return;
      hoverStarScore = null;
      voteStatus.textContent = "";
      voteStatus.classList.remove(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      setVoteBusy(true);
      try {
        await omdb().rateBeatmap(id, score);
      } catch (err) {
        voteStatus.textContent = err?.message ? String(err.message) : "Could not submit rating.";
        voteStatus.classList.add(`${OEP_OMDB_VOTE_CLASS}__status--error`);
        setVoteBusy(false);
        return;
      }
      try {
        await reloadSetRatings();
      } catch (_) {
        if (!disposed) {
          voteStatus.textContent = "Rating saved, but OMDB ratings could not be refreshed.";
        }
      } finally {
        setVoteBusy(false);
      }
    }
    for (const unit of starUnits) {
      for (const half of unit.querySelectorAll(`.${OEP_OMDB_VOTE_CLASS}__half`)) {
        half.addEventListener("mouseenter", onStarHalfEnter);
        half.addEventListener("click", (e) => {
          e.preventDefault();
          const btn = e.currentTarget;
          if (!(btn instanceof HTMLElement) || voteBusy) return;
          const raw = btn.getAttribute("data-oep-score");
          const n = raw == null ? NaN : Number(raw);
          if (!Number.isFinite(n)) return;
          submitVote(n);
        });
      }
    }
    voteControls.addEventListener("mouseleave", onVoteControlsMouseLeave);
    clearBtn.addEventListener("click", () => submitVote(-2));
    omdb().fetchBeatmapsetRatings(beatmapsetId).then((list) => {
      if (disposed || !pathRe.test(location.pathname)) return;
      byBeatmapId = /* @__PURE__ */ new Map();
      for (const item of list || []) {
        const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
        if (bid != null) byBeatmapId.set(Number(bid), item);
      }
      omdbSetFetchSucceeded = true;
      loadState = "ready";
      bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--error`);
      voteRow.style.display = "";
      syncDisplay();
    }).catch((err) => {
      if (disposed) return;
      loadState = "error";
      loadError = err?.message ? String(err.message) : "Could not load OMDB ratings.";
      voteRow.style.display = "none";
      syncDisplay();
    });
    picker.addEventListener("mouseover", onPickerMouseOver);
    picker.addEventListener("mouseleave", onPickerMouseLeave);
    window.addEventListener("hashchange", onHashChange, { passive: true });
    const unsubscribePicker = subscribePickerChanges(picker, scheduleSync, {
      label: "beatmapset/omdb-picker"
    });
    scheduleSync();
    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      unsubscribePicker();
      picker.removeEventListener("mouseover", onPickerMouseOver);
      picker.removeEventListener("mouseleave", onPickerMouseLeave);
      window.removeEventListener("hashchange", onHashChange);
      hideOmdbDistPopover();
      window.removeEventListener("scroll", onOmdbDistScrollOrResize, true);
      window.removeEventListener("resize", onOmdbDistScrollOrResize);
      distPopoverEl.remove();
      wrap.remove();
    };
  }
  function mountOmdbRow(header, beatmapsetId, pathRe) {
    return omdb().isConfigured() ? mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe) : mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId);
  }

  // src/features/beatmapset/picker-diff-names.js
  function formatBeatmapsetHeaderStarRatingText(n) {
    return formatStars(n, STAR_FORMAT.header);
  }
  function getBeatmapVersionAndRatingForHeader(beatmapId, ruleset) {
    const data = readBeatmapsetJson();
    if (!data?.beatmaps?.length) return { version: "", rating: null };
    const n = Number(beatmapId);
    if (!Number.isFinite(n)) return { version: "", rating: null };
    let bm = data.beatmaps.find((b) => Number(b.id) === n);
    if (bm && ruleset && bm.mode !== ruleset) {
      bm = data.converts?.find((b) => Number(b.id) === n && b.mode === ruleset);
    }
    if (!bm) return { version: "", rating: null };
    const version = bm.version != null && String(bm.version).trim() !== "" ? String(bm.version) : "";
    const x = Number(bm.difficulty_rating);
    const rating = Number.isFinite(x) ? x : null;
    return { version, rating };
  }
  function startPickerDiffNames(header, pathRe) {
    const picker = header.querySelector(PICKER_SEL);
    if (!(picker instanceof HTMLElement)) return () => {
    };
    let disposed = false;
    let raf = 0;
    function syncEnabledClass() {
      header.classList.toggle(
        "oep-picker-diff-names-enabled",
        settings().isEnabled(settingIds().PICKER_DIFF_NAMES)
      );
    }
    function syncRow(a) {
      if (!settings().isEnabled(settingIds().PICKER_DIFF_NAMES)) {
        a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`)?.remove();
        return;
      }
      const link = parsePickerHref(a.getAttribute("href"), {
        pathFallback: true
      });
      const { version, rating } = link ? getBeatmapVersionAndRatingForHeader(link.beatmapId, link.ruleset) : { version: "", rating: null };
      let meta = a.querySelector(`[${PICKER_DIFF_NAMES_META_ATTR}]`);
      if (!(meta instanceof HTMLElement)) {
        meta = el(
          "span",
          {
            class: "oep-picker-diff-names__meta",
            [PICKER_DIFF_NAMES_META_ATTR]: "1"
          },
          el("span", { class: "oep-picker-diff-names__version" }),
          el(
            "span",
            { class: "oep-picker-diff-names__star" },
            el("i", { class: "fas fa-star", "aria-hidden": "true" })
          )
        );
        a.appendChild(meta);
      }
      const icon = a.querySelector(".beatmap-icon");
      const diffVar = icon ? (icon.style.getPropertyValue("--diff") || getComputedStyle(icon).getPropertyValue("--diff")).trim() : "";
      if (diffVar) meta.style.setProperty("--oep-diff-muted-src", diffVar);
      else meta.style.removeProperty("--oep-diff-muted-src");
      const verEl = meta.querySelector(".oep-picker-diff-names__version");
      if (verEl instanceof HTMLElement && verEl.textContent !== version) {
        verEl.textContent = version;
      }
      const starEl = meta.querySelector(".oep-picker-diff-names__star");
      if (starEl instanceof HTMLElement) {
        const starIcon = starEl.querySelector(".fa-star");
        let starTn = starIcon?.nextSibling;
        if (!(starTn instanceof Text)) {
          starTn = document.createTextNode("");
          starEl.appendChild(starTn);
        }
        if (rating != null) {
          starTn.textContent = ` ${formatBeatmapsetHeaderStarRatingText(rating)}`;
          starEl.style.display = "";
        } else {
          starTn.textContent = "";
          starEl.style.display = "none";
        }
      }
    }
    function syncAll() {
      if (disposed || !pathRe.test(location.pathname)) return;
      syncEnabledClass();
      for (const a of picker.querySelectorAll(PICKER_LINK_SEL)) {
        if (a instanceof HTMLAnchorElement) syncRow(a);
      }
    }
    function scheduleSync() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncAll();
      });
    }
    function onRouteSignal() {
      scheduleSync();
    }
    const unsubSetting = settings().onChange(
      settingIds().PICKER_DIFF_NAMES,
      scheduleSync
    );
    syncAll();
    window.addEventListener("hashchange", onRouteSignal, { passive: true });
    window.addEventListener("popstate", onRouteSignal, { passive: true });
    const unsubscribePicker = subscribePickerChanges(picker, scheduleSync, {
      label: "beatmapset/picker-names"
    });
    return () => {
      disposed = true;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      unsubSetting();
      header.classList.remove("oep-picker-diff-names-enabled");
      window.removeEventListener("hashchange", onRouteSignal);
      window.removeEventListener("popstate", onRouteSignal);
      unsubscribePicker();
      for (const node of picker.querySelectorAll(
        `[${PICKER_DIFF_NAMES_META_ATTR}]`
      )) {
        node.remove();
      }
    };
  }

  // src/features/beatmap-preview/files.js
  async function fetchOsuFileText(beatmapId) {
    const resp = await OsuExpertPlus.api.fetchBeatmapOsuFile(beatmapId);
    if (!resp.ok) {
      throw new Error(`Could not download .osu (${resp.status})`);
    }
    return resp.text();
  }
  function absoluteUrl2(url) {
    if (!url) return "";
    const s = String(url).trim();
    if (!s) return "";
    if (s.startsWith("//")) return `https:${s}`;
    return s;
  }
  var currentCover = null;
  var latestCoverSrc = "";
  var coverInFlight = /* @__PURE__ */ new Map();
  function revokeObjectUrl(objectUrl) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch (_) {
    }
  }
  function revokeBeatmapCoverObjectUrl() {
    latestCoverSrc = "";
    if (currentCover) revokeObjectUrl(currentCover.objectUrl);
    currentCover = null;
  }
  async function fetchCoverBytes(absUrl) {
    function gmGetArrayBuffer() {
      return new Promise((resolve2, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: absUrl,
          responseType: "arraybuffer",
          onload(r) {
            if (r.status >= 200 && r.status < 300 && r.response) {
              resolve2(r.response);
            } else {
              reject(new Error(String(r.status)));
            }
          },
          onerror: () => reject(new Error("xhr"))
        });
      });
    }
    const viaFetch = async (cause) => {
      const res = await fetch(absUrl, { credentials: "omit", mode: "cors" });
      if (!res.ok) throw new Error(String(res.status), { cause });
      return res.arrayBuffer();
    };
    if (typeof GM_xmlhttpRequest === "function") {
      try {
        return await gmGetArrayBuffer();
      } catch (gmErr) {
        return viaFetch(gmErr);
      }
    }
    return viaFetch(void 0);
  }
  async function fetchBeatmapCoverObjectUrl(absUrl) {
    if (!absUrl) return "";
    latestCoverSrc = absUrl;
    if (currentCover?.src === absUrl) return currentCover.objectUrl;
    let pending = coverInFlight.get(absUrl);
    if (!pending) {
      pending = fetchCoverBytes(absUrl).then((buf) => URL.createObjectURL(new Blob([buf]))).catch(() => "").finally(() => coverInFlight.delete(absUrl));
      coverInFlight.set(absUrl, pending);
    }
    const objectUrl = await pending;
    if (!objectUrl) return "";
    if (currentCover?.objectUrl === objectUrl) return objectUrl;
    if (latestCoverSrc !== absUrl) {
      revokeObjectUrl(objectUrl);
      return "";
    }
    if (currentCover) revokeObjectUrl(currentCover.objectUrl);
    currentCover = { src: absUrl, objectUrl };
    return objectUrl;
  }

  // src/features/beatmap-preview/prefs.js
  function readOsuSiteAudioVolume() {
    const ls = pageLocalStorage();
    if (!ls) return null;
    try {
      const raw = ls.getItem("userPreferences");
      if (raw == null || raw === "") return null;
      const obj = JSON.parse(raw);
      const v = obj?.audio_volume;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    } catch (_) {
    }
    return null;
  }
  var PREVIEW_VOLUME_DEFAULT = 0.3;
  function volumeOrNull(v) {
    if (v === void 0 || v === null || String(v) === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
  }
  function createVolumePref(storageKey, legacyGmKey) {
    function write(vol) {
      const ls = pageLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(storageKey.key, String(vol));
      } catch (_) {
      }
    }
    function read() {
      const ls = pageLocalStorage();
      if (ls) {
        try {
          const n = volumeOrNull(ls.getItem(storageKey.key));
          if (n != null) return n;
        } catch (_) {
        }
      }
      try {
        const n = volumeOrNull(GM_getValue(legacyGmKey.key, void 0));
        if (n != null) {
          write(n);
          return n;
        }
      } catch (_) {
      }
      return readOsuSiteAudioVolume() ?? PREVIEW_VOLUME_DEFAULT;
    }
    return { read, write };
  }
  var musicVolumePref = createVolumePref(
    KEYS.PREVIEW_MUSIC_VOLUME,
    KEYS.PREVIEW_MUSIC_VOLUME_LEGACY
  );
  var hitsoundVolumePref = createVolumePref(
    KEYS.PREVIEW_HITSOUND_VOLUME,
    KEYS.PREVIEW_HITSOUND_VOLUME_LEGACY
  );
  var OFFSET_MIN = -500;
  var OFFSET_MAX = 500;
  var PREVIEW_OFFSET_DISPLAY_BASE_MS = 85;
  function clampOffsetMs(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(n)));
  }
  function actualAudioOffsetMsFromDisplay(displayMs) {
    return clampOffsetMs(displayMs) + PREVIEW_OFFSET_DISPLAY_BASE_MS;
  }
  function parseOffsetTextStrict(raw) {
    const s = String(raw ?? "").trim().replace(/\s+/g, "").replace(/ms$/i, "");
    if (s === "" || s === "-" || s === "+") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return clampOffsetMs(n);
  }
  function formatOffsetForField(ms) {
    return String(clampOffsetMs(ms));
  }
  function readStoredOffsetMs() {
    const ls = pageLocalStorage();
    if (ls) {
      try {
        const s = ls.getItem(KEYS.PREVIEW_AUDIO_OFFSET.key);
        if (s != null && s !== "") {
          return clampOffsetMs(Number(s));
        }
      } catch (_) {
      }
    }
    return 0;
  }
  function writeStoredOffsetMs(ms) {
    const ls = pageLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(KEYS.PREVIEW_AUDIO_OFFSET.key, String(clampOffsetMs(ms)));
    } catch (_) {
    }
  }

  // src/features/beatmap-preview/engine-patches.js
  var BEATMAP_ENGINE_AUDIO_PATCH = "__oepBeatmapEngineNoPreviewAudioCors";
  var BEATMAP_ENGINE_SEEK_PATCH = "__oepBeatmapEngineSeekBeforePreview";
  var BEATMAP_ENGINE_PLAY_PATCH = "__oepBeatmapEnginePlayOutsidePreview";
  var BEATMAP_ENGINE_TRANSPORT_PATCH = "__oepBeatmapEngineTransportPreview";
  var BEATMAP_ENGINE_PAUSE_PATCH = "__oepBeatmapEnginePauseSnapshot";
  var BEATMAP_ENGINE_BG_CONTAIN_PATCH = "__oepBeatmapEngineBgContain";
  var PREVIEW_CLIP_CAP_MS = 1e4;
  function isBeatmapTimeOutsideSitePreviewClip(engine, beatmapMs) {
    if (!engine?.previewAudio || typeof engine.getPreviewAudioTimeMsForBeatmapTime !== "function" || !Number.isFinite(beatmapMs)) {
      return false;
    }
    const shifted = engine.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
    const dur = engine.previewAudio.duration;
    const durMs = Number.isFinite(dur) && dur > 0 ? Math.min(PREVIEW_CLIP_CAP_MS, dur * 1e3) : PREVIEW_CLIP_CAP_MS;
    return !Number.isFinite(shifted) || shifted < 0 || shifted >= durMs;
  }
  function patchBeatmapEnginePreviewAudio(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto) return;
    if (!proto[BEATMAP_ENGINE_AUDIO_PATCH]) {
      proto.updateAudioTrackFromUrl = function oepUpdateAudioTrackFromUrl(audioUrl) {
        if (this.previewAudio) {
          this.previewAudio.pause();
          this.previewAudio.src = "";
        }
        this.previewAudio = new Audio(audioUrl);
        this.previewAudio.preload = "auto";
        this.previewAudio.volume = this.musicVolume;
      };
      proto[BEATMAP_ENGINE_AUDIO_PATCH] = true;
    }
    patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine);
    patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine);
  }
  function patchBeatmapEngineSetCurrentTimeOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_SEEK_PATCH]) return;
    const orig = proto.setCurrentTime;
    proto.setCurrentTime = function oepSetCurrentTime(ms) {
      if (!Number.isFinite(ms)) {
        return orig.call(this, ms);
      }
      const outsideClip = !!this.previewAudio && isBeatmapTimeOutsideSitePreviewClip(this, ms);
      if (this.isPlaying && outsideClip && this.previewAudio) {
        try {
          this.previewAudio.pause();
        } catch (_) {
        }
      }
      const ret = orig.call(this, ms);
      if (outsideClip) {
        this.audioSyncOffsetMs = 0;
        this.lastAudioSyncSamplePerfMs = 0;
      }
      return ret;
    };
    proto[BEATMAP_ENGINE_SEEK_PATCH] = true;
  }
  function patchBeatmapEnginePlayOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PLAY_PATCH]) return;
    const orig = proto.play;
    proto.play = function oepPlay(options) {
      orig.call(this, options);
      try {
        if (this.previewAudio && isBeatmapTimeOutsideSitePreviewClip(this, this.currentTime)) {
          this.previewAudio.pause();
        }
      } catch (_) {
      }
    };
    proto[BEATMAP_ENGINE_PLAY_PATCH] = true;
  }
  function patchBeatmapEngineGetTransportOutsidePreviewClip(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_TRANSPORT_PATCH]) return;
    const orig = proto.getTransportCurrentTimeMs;
    proto.getTransportCurrentTimeMs = function oepGetTransportCurrentTimeMs() {
      if (!this.isPlaying) {
        return orig.call(this);
      }
      const nowPerfMs = performance.now();
      const elapsedMs = nowPerfMs - this.transportStartPerfTime;
      const perfVisualMs = this.transportStartMs + Math.max(0, elapsedMs);
      const bypassAudioSync = this.previewAudio?.ended || isBeatmapTimeOutsideSitePreviewClip(this, perfVisualMs);
      if (bypassAudioSync) {
        const offset = Number(this.audioSyncOffsetMs) || 0;
        if (offset !== 0) {
          const currentVisual = perfVisualMs + offset;
          this.transportStartMs = currentVisual;
          this.transportStartPerfTime = nowPerfMs;
          this.audioSyncOffsetMs = 0;
          this.lastAudioSyncSamplePerfMs = 0;
          return currentVisual;
        }
        return perfVisualMs;
      }
      return orig.call(this);
    };
    proto[BEATMAP_ENGINE_TRANSPORT_PATCH] = true;
  }
  function patchBeatmapEnginePauseCleanSnapshot(BeatmapEngine) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_PAUSE_PATCH]) return;
    proto.pause = function oepPause() {
      if (!this.isPlaying) {
        return;
      }
      try {
        if (this.previewAudio) {
          this.previewAudio.pause();
        }
      } catch (_) {
      }
      this.audioSyncOffsetMs = 0;
      this.lastAudioSyncSamplePerfMs = 0;
      this.currentTime = this.getTransportCurrentTimeMs();
      this.isPlaying = false;
      this.hitsoundPlayer?.stopScheduler();
      this.hitsoundPlayer?.clearScheduledSources();
    };
    proto[BEATMAP_ENGINE_PAUSE_PATCH] = true;
  }
  function patchBeatmapEngineBackgroundContain(BeatmapEngine, emptyTexture) {
    const proto = BeatmapEngine?.prototype;
    if (!proto || proto[BEATMAP_ENGINE_BG_CONTAIN_PATCH]) return;
    function reflowBackgroundContain(self) {
      try {
        const sp = self.backgroundSprite;
        const tex = sp?.texture;
        if (!sp || !tex || tex === emptyTexture || !tex.width || !tex.height) {
          return;
        }
        const { width, height } = self.getDisplayDimensions();
        const scale = Math.min(width / tex.width, height / tex.height);
        sp.scale.set(scale);
        sp.x = (width - tex.width * scale) / 2;
        sp.y = (height - tex.height * scale) / 2;
        sp.tint = 5921370;
      } catch (_e) {
      }
    }
    const origUpdateBg = proto.updateBackgroundFromUrl;
    proto.updateBackgroundFromUrl = async function oepUpdateBackgroundFromUrl(imageUrl) {
      await origUpdateBg.call(this, imageUrl);
      reflowBackgroundContain(this);
    };
    const origResize = proto.resize;
    proto.resize = function oepResize() {
      origResize.call(this);
      reflowBackgroundContain(this);
    };
    proto[BEATMAP_ENGINE_BG_CONTAIN_PATCH] = true;
  }

  // src/features/beatmap-preview/loader.js
  var READY_EVENT = "oep-beatmap-renderer-esm-ready";
  var GLOBAL_KEY = "__oepBeatmapEngine";
  var PIXI_EMPTY_TEXTURE_KEY = "__oepPixiTextureEmpty";
  var LOADER_ATTR = "data-oep-beatmap-renderer-loader";
  var IMPORTMAP_ATTR = "data-oep-pixi-importmap";
  var PIXI_ESM_URL = "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs";
  var RENDERER_ESM_URL = "https://cdn.jsdelivr.net/npm/osu-beatmap-renderer@0.1.2/dist/osu-beatmap-renderer.js";
  var MODULE_INTEGRITY = Object.freeze({
    pixi: "sha384-MryiqCBUxcjngKGCQBH2iYL6sT10lbGoVbtkle1ZUBC6z4PbaCEVaLfSGjyzURwZ",
    renderer: "sha384-64fRocbh7EKo2zRcbgh78V8aYtE1syju4KIvnYlIYWpgHiGf79P8DVw5NImYIbQ1"
  });
  var LOAD_TIMEOUT_MS = 2e4;
  var engineClassPromise = null;
  var attempt = 0;
  function attemptUrl(url, n) {
    return n === 0 ? url : `${url}?oep-retry=${n}`;
  }
  function importMapFor(n) {
    const pixi = attemptUrl(PIXI_ESM_URL, n);
    const renderer = attemptUrl(RENDERER_ESM_URL, n);
    const integrity = {
      [pixi]: MODULE_INTEGRITY.pixi,
      [renderer]: MODULE_INTEGRITY.renderer
    };
    return n === 0 ? { imports: { "pixi.js": pixi }, integrity } : { scopes: { [renderer]: { "pixi.js": pixi } }, integrity };
  }
  function loaderSource(n) {
    return `
import { BeatmapEngine } from ${JSON.stringify(attemptUrl(RENDERER_ESM_URL, n))};
import * as PIXI from "pixi.js";
window[${JSON.stringify(PIXI_EMPTY_TEXTURE_KEY)}] = PIXI.Texture.EMPTY;
window[${JSON.stringify(GLOBAL_KEY)}] = BeatmapEngine;
window.dispatchEvent(new Event(${JSON.stringify(READY_EVENT)}));
`;
  }
  function patchEngineClass(Cls) {
    patchBeatmapEnginePreviewAudio(Cls);
    patchBeatmapEngineBackgroundContain(
      Cls,
      pageWindow()[PIXI_EMPTY_TEXTURE_KEY]
    );
  }
  function loadBeatmapEngineClass() {
    const pw = pageWindow();
    const existing = pw[GLOBAL_KEY];
    if (existing && typeof existing === "function") {
      patchEngineClass(existing);
      return Promise.resolve(existing);
    }
    if (engineClassPromise) return engineClassPromise;
    const n = attempt;
    engineClassPromise = new Promise((resolve2, reject) => {
      let script = null;
      let tid = 0;
      const finish = (err, Cls) => {
        pw.removeEventListener(READY_EVENT, onReady);
        window.clearTimeout(tid);
        if (err || !Cls) {
          engineClassPromise = null;
          attempt = n + 1;
          script?.remove();
          reject(err || new Error("BeatmapEngine missing"));
          return;
        }
        patchEngineClass(Cls);
        resolve2(Cls);
      };
      const onReady = () => {
        const Cls = pageWindow()[GLOBAL_KEY];
        finish(
          Cls && typeof Cls === "function" ? null : new Error("BeatmapEngine not exposed"),
          Cls
        );
      };
      pw.addEventListener(READY_EVENT, onReady, { once: true });
      tid = window.setTimeout(() => {
        finish(new Error("The preview engine took too long to load."), null);
      }, LOAD_TIMEOUT_MS);
      try {
        if (!document.querySelector(`script[${IMPORTMAP_ATTR}="${n}"]`)) {
          const map = document.createElement("script");
          map.type = "importmap";
          map.setAttribute(IMPORTMAP_ATTR, String(n));
          map.textContent = JSON.stringify(importMapFor(n));
          document.head.appendChild(map);
        }
        document.querySelector(`script[${LOADER_ATTR}]`)?.remove();
        script = document.createElement("script");
        script.type = "module";
        script.setAttribute(LOADER_ATTR, String(n));
        script.addEventListener("error", () => {
          finish(new Error("Could not load the preview engine."), null);
        });
        script.textContent = loaderSource(n);
        document.head.appendChild(script);
      } catch (e) {
        finish(e, null);
      }
    });
    return engineClassPromise;
  }

  // src/features/beatmap-preview/shared-engine.js
  var sharedEngineRoot = null;
  var sharedEngine = null;
  var acquireMutex = Promise.resolve();
  var engineInitializing = null;
  function placeSharedEngineRoot(hostEl) {
    if (!sharedEngineRoot) return;
    hostEl.replaceChildren(sharedEngineRoot);
  }
  async function acquireSharedEngine(hostEl) {
    const run = acquireMutex.then(async () => {
      const BeatmapEngine = await loadBeatmapEngineClass();
      if (!sharedEngineRoot) {
        const root = document.createElement("div");
        root.setAttribute("data-oep-beatmap-engine-root", "");
        root.className = "oep-beatmap-preview-engine-root";
        hostEl.replaceChildren(root);
        const engine = new BeatmapEngine(root, {});
        sharedEngineRoot = root;
        sharedEngine = engine;
        engineInitializing = engine.init();
        try {
          await engineInitializing;
        } finally {
          engineInitializing = null;
        }
        if (sharedEngine !== engine) throw new Error("Preview closed.");
      } else {
        placeSharedEngineRoot(hostEl);
        try {
          sharedEngine?.resize?.();
        } catch (_) {
        }
      }
      return sharedEngine;
    });
    acquireMutex = run.catch(() => {
    });
    return run;
  }
  var engineLoadQueue = Promise.resolve();
  function runEngineLoad(task) {
    const run = engineLoadQueue.then(task, task);
    engineLoadQueue = run.catch(() => {
    });
    return run;
  }
  function setSharedEngineRendering(on) {
    const ticker = sharedEngine?.app?.ticker;
    if (!ticker) return;
    try {
      if (on) ticker.start();
      else ticker.stop();
    } catch (_) {
    }
  }
  function destroySharedEngineHard() {
    const engine = sharedEngine;
    const root = sharedEngineRoot;
    sharedEngine = null;
    sharedEngineRoot = null;
    try {
      root?.remove();
    } catch (_) {
    }
    if (!engine) return;
    try {
      engine.pause?.();
    } catch (_) {
    }
    const teardown = () => {
      try {
        engine.destroy?.();
      } catch (_) {
      }
    };
    Promise.all([engineInitializing, engineLoadQueue]).then(teardown, teardown);
  }

  // src/features/beatmap-preview/widget/styles.js
  var WRAP_CLASS = "oep-beatmap-preview";
  var PREVIEW_CSS = `
  .${WRAP_CLASS} { margin-top: 4px; }
  .${WRAP_CLASS}__toggle.btn-osu-big {
    --btn-bg: hsl(var(--hsl-b5, 333 18% 28%));
    margin-top: 6px;
  }
  .${WRAP_CLASS}__panel {
    margin-top: 10px;
    border-radius: 6px;
    overflow: hidden;
    background: hsl(var(--hsl-b5, 333 18% 8%));
    border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
  }
  .${WRAP_CLASS}__canvas-host {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 180px;
    background: #000;
    cursor: pointer;
    outline: none;
  }
  .${WRAP_CLASS}__canvas-host:focus-visible {
    box-shadow: inset 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__canvas-host--disabled {
    cursor: not-allowed;
    opacity: 0.85;
  }
  .${WRAP_CLASS}__panel:not(.${WRAP_CLASS}__panel--unsupported) .${WRAP_CLASS}__unsupported {
    display: none;
  }
  .${WRAP_CLASS}__panel.${WRAP_CLASS}__panel--unsupported .${WRAP_CLASS}__canvas-host,
  .${WRAP_CLASS}__panel.${WRAP_CLASS}__panel--unsupported .${WRAP_CLASS}__seek {
    display: none;
  }
  .${WRAP_CLASS}__unsupported {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    min-height: 180px;
    padding: 16px;
    text-align: center;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    font-size: 13px;
    line-height: 1.45;
    box-sizing: border-box;
  }
  .${WRAP_CLASS}__engine-slot {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  .${WRAP_CLASS}__engine-slot canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none;
  }
  .${WRAP_CLASS}__transport-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.4s ease;
    background: rgba(0, 0, 0, 0.12);
  }
  .${WRAP_CLASS}__transport-overlay--visible {
    opacity: 1;
  }
  .${WRAP_CLASS}__transport-glyph {
    font-size: clamp(3rem, 14vw, 5.5rem);
    color: hsl(var(--hsl-l1, 0 0% 98%));
    filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.65));
    line-height: 1;
  }
  .${WRAP_CLASS}__transport-glyph .fa-fw {
    width: 1.15em;
    text-align: center;
  }
  .${WRAP_CLASS}__seek {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 10px;
    background: hsl(var(--hsl-b4, 333 18% 14%));
    border-top: 1px solid hsl(var(--hsl-b5, 333 18% 10%));
    font-size: 12px;
    color: hsl(var(--hsl-l2, 0 0% 75%));
  }
  .${WRAP_CLASS}__seek button {
    flex: 0 0 auto;
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font: inherit;
    background: hsl(var(--hsl-b5, 333 18% 28%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${WRAP_CLASS}__seek button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .${WRAP_CLASS}__seek button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__status {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    text-align: right;
  }
  .${WRAP_CLASS}__seek-time {
    flex: 0 0 auto;
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    white-space: nowrap;
  }
  .${WRAP_CLASS}__seek-range {
    flex: 1 1 0;
    min-width: 72px;
    width: 0;
    height: 22px;
    accent-color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__seek-range:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__volume {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }
  .${WRAP_CLASS}__volume-icon {
    color: hsl(var(--hsl-l2, 0 0% 75%));
    font-size: 12px;
    line-height: 1;
    opacity: 0.9;
  }
  .${WRAP_CLASS}__volume-range {
    width: 72px;
    min-width: 56px;
    max-width: 100px;
    height: 22px;
    flex: 0 0 72px;
    accent-color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${WRAP_CLASS}__volume-range:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__offset-input {
    width: 4.25em;
    min-width: 3.25em;
    max-width: 6em;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b5, 333 18% 12%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
    font: inherit;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }
  .${WRAP_CLASS}__offset-input:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .${WRAP_CLASS}__offset-input:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
  }
  .${WRAP_CLASS}__offset-unit {
    flex: 0 0 auto;
    font-size: 11px;
    color: hsl(var(--hsl-l2, 0 0% 75%));
    user-select: none;
  }
  .oep-beatmap-preview-section {
    box-sizing: border-box;
    width: 100%;
    padding: 10px 20px 12px;
  }
  @media (min-width: 900px) {
    .oep-beatmap-preview-section {
      padding: 12px 40px 16px;
    }
  }
  .oep-beatmap-preview-section > .beatmapset-info__row {
    display: flex;
    flex-direction: column;
    padding-bottom: 0;
    min-width: 0;
  }
`;

  // src/features/beatmap-preview/widget/dom.js
  function faIcon(el2, faClass) {
    return el2(
      "span",
      { class: "fa fa-fw" },
      el2("span", { class: `fas ${faClass}`, "aria-hidden": "true" })
    );
  }
  function volumeGroup(el2, title, faClass, ...controls) {
    return el2(
      "div",
      { class: `${WRAP_CLASS}__volume` },
      el2(
        "span",
        {
          class: `${WRAP_CLASS}__volume-icon`,
          "aria-hidden": "true",
          title
        },
        faIcon(el2, faClass)
      ),
      ...controls
    );
  }
  function volumeRange(el2, label, volume) {
    return el2("input", {
      type: "range",
      class: `${WRAP_CLASS}__volume-range`,
      min: "0",
      max: "100",
      value: String(Math.round(volume * 100)),
      step: "1",
      disabled: true,
      "aria-label": label
    });
  }
  function buildPreviewDom(el2, { musicVolume, hitsoundVolume, offsetText }) {
    const row = el2("div", {
      class: "beatmapset-info__row",
      "data-oep-beatmap-preview-root": ""
    });
    const heading = el2(
      "h3",
      { class: "beatmapset-info__header" },
      "Gameplay preview"
    );
    const statusEl = el2("span", { class: `${WRAP_CLASS}__status` }, "");
    const unsupportedWrap = el2(
      "div",
      { class: `${WRAP_CLASS}__unsupported` },
      "This gamemode is not supported yet."
    );
    const canvasHost = el2("div", {
      class: `${WRAP_CLASS}__canvas-host ${WRAP_CLASS}__canvas-host--disabled`,
      tabIndex: -1,
      role: "button",
      "aria-label": "Play gameplay preview"
    });
    const engineSlot = el2("div", { class: `${WRAP_CLASS}__engine-slot` });
    const transportOverlay = el2("div", {
      class: `${WRAP_CLASS}__transport-overlay`,
      "aria-hidden": "true"
    });
    const transportPlayGlyph = el2(
      "span",
      { class: `${WRAP_CLASS}__transport-glyph`, hidden: "" },
      faIcon(el2, "fa-play")
    );
    const transportPauseGlyph = el2(
      "span",
      { class: `${WRAP_CLASS}__transport-glyph`, hidden: "" },
      faIcon(el2, "fa-pause")
    );
    transportOverlay.appendChild(transportPlayGlyph);
    transportOverlay.appendChild(transportPauseGlyph);
    canvasHost.appendChild(engineSlot);
    canvasHost.appendChild(transportOverlay);
    const previewTimeBtn = el2(
      "button",
      {
        type: "button",
        disabled: true,
        title: "Jump to the beatmap preview point (.osu PreviewTime)",
        "aria-label": "Jump to beatmap preview time"
      },
      "Jump to preview"
    );
    const seekTimeDisplay = el2(
      "span",
      {
        class: `${WRAP_CLASS}__seek-time`,
        "aria-live": "off",
        title: "Current time / map duration"
      },
      "0:00 / 0:00"
    );
    const seekRange = el2("input", {
      type: "range",
      class: `${WRAP_CLASS}__seek-range`,
      min: "0",
      max: "1",
      value: "0",
      step: "1",
      disabled: true,
      "aria-label": "Preview playback position"
    });
    const musicVolumeRange = volumeRange(
      el2,
      "Gameplay preview music volume",
      musicVolume
    );
    const hitsoundVolumeRange = volumeRange(
      el2,
      "Gameplay preview hitsounds volume",
      hitsoundVolume
    );
    const offsetInput = el2("input", {
      type: "text",
      class: `${WRAP_CLASS}__offset-input`,
      value: offsetText,
      inputMode: "numeric",
      disabled: true,
      "aria-label": "Gameplay preview audio offset in milliseconds",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off"
    });
    const offsetUnitEl = el2(
      "span",
      { class: `${WRAP_CLASS}__offset-unit` },
      "ms"
    );
    const seekRow = el2(
      "div",
      { class: `${WRAP_CLASS}__seek` },
      previewTimeBtn,
      seekTimeDisplay,
      seekRange,
      volumeGroup(el2, "music volume", "fa-music", musicVolumeRange),
      volumeGroup(el2, "hitsound volume", "fa-drum", hitsoundVolumeRange),
      volumeGroup(el2, "offset", "fa-clock", offsetInput, offsetUnitEl),
      statusEl
    );
    const panel = el2(
      "div",
      { class: `${WRAP_CLASS}__panel`, hidden: "" },
      unsupportedWrap,
      canvasHost,
      seekRow
    );
    const toggleBtn = el2(
      "button",
      {
        type: "button",
        class: `btn-osu-big btn-osu-big--beatmapset ${WRAP_CLASS}__toggle`
      },
      el2(
        "span",
        { class: "btn-osu-big__content" },
        el2(
          "span",
          { class: "btn-osu-big__left" },
          el2("span", { class: "btn-osu-big__text-top" }, "Beatmap Preview")
        ),
        el2("span", { class: "btn-osu-big__icon" }, faIcon(el2, "fa-play-circle"))
      )
    );
    row.appendChild(heading);
    row.appendChild(toggleBtn);
    row.appendChild(panel);
    return {
      row,
      toggleBtn,
      panel,
      statusEl,
      canvasHost,
      engineSlot,
      transportOverlay,
      transportPlayGlyph,
      transportPauseGlyph,
      previewTimeBtn,
      seekTimeDisplay,
      seekRange,
      musicVolumeRange,
      hitsoundVolumeRange,
      offsetInput
    };
  }
  function setToggleLabel(dom, expanded) {
    const top = dom.toggleBtn.querySelector(".btn-osu-big__text-top");
    if (top) {
      top.textContent = expanded ? "Hide beatmap preview" : "Beatmap Preview";
    }
  }
  function setStatus(dom, text) {
    dom.statusEl.textContent = text || "";
  }

  // src/features/beatmap-preview/widget/keyboard.js
  function createPreviewKeydown(state2, dom, transport) {
    const {
      panel,
      seekRange,
      musicVolumeRange,
      hitsoundVolumeRange,
      offsetInput
    } = dom;
    return function onPreviewPanelKeydown(ev) {
      if (!state2.expanded || panel.hidden || !state2.lastLoadedKey || seekRange.disabled || state2.busy) {
        return;
      }
      const t = ev.target;
      if (!(t instanceof Node) || !panel.contains(t)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const key = ev.key;
      const isArrow = key === "ArrowLeft" || key === "ArrowRight";
      const isPlayKey = key === " " || key === "Enter" || key === "Spacebar";
      if (isArrow) {
        if (t === musicVolumeRange || t === hitsoundVolumeRange || t === offsetInput) {
          return;
        }
        ev.preventDefault();
        transport.seekByDeltaMs(key === "ArrowLeft" ? -1e3 : 1e3);
        return;
      }
      if (isPlayKey) {
        if (t instanceof HTMLButtonElement) return;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
          return;
        }
        ev.preventDefault();
        transport.togglePlaybackFromCanvas();
      }
    };
  }

  // src/features/beatmap-preview/widget/load.js
  function createBeatmapLoader({
    state: state2,
    dom,
    transport,
    pathRe,
    getBeatmapId,
    getRuleset,
    readBeatmapsetJson: readBeatmapsetJson2,
    onSettled
  }) {
    const { panel, engineSlot } = dom;
    function invalidateLoadState() {
      state2.lastLoadedKey = "";
      transport.setPreviewControlsEnabled(false);
      try {
        sharedEngine?.pause?.();
      } catch (_) {
      }
    }
    function currentLoadKey() {
      const id = getBeatmapId();
      return id ? `${id}` : "";
    }
    return async function loadCurrentBeatmap() {
      if (!pathRe.test(location.pathname)) return;
      if (!state2.expanded) return;
      const ruleset = (getRuleset() || "osu").toLowerCase();
      if (ruleset !== "osu") {
        panel.classList.add(`${WRAP_CLASS}__panel--unsupported`);
        state2.lastLoadedKey = "";
        transport.setPreviewControlsEnabled(false);
        setStatus(dom, "");
        try {
          sharedEngine?.pause?.();
        } catch (_) {
        }
        destroySharedEngineHard();
        revokeBeatmapCoverObjectUrl();
        state2.busy = false;
        return;
      }
      panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);
      const beatmapId = getBeatmapId();
      if (!beatmapId) {
        setStatus(dom, "No difficulty selected.");
        invalidateLoadState();
        return;
      }
      const data = readBeatmapsetJson2();
      const previewAudio = absoluteUrl2(data?.preview_url);
      const bg = data?.id != null ? `https://assets.ppy.sh/beatmaps/${data.id}/covers/fullsize.jpg` : "";
      const key = currentLoadKey();
      if (sharedEngine && state2.lastLoadedKey === key) {
        if (!state2.expanded) return;
        placeSharedEngineRoot(engineSlot);
        setStatus(dom, "");
        transport.onBeatmapReady();
        return;
      }
      state2.busy = true;
      setStatus(dom, "Loading…");
      transport.setPreviewControlsEnabled(false);
      const seq = ++state2.loadSeq;
      const superseded = () => state2.disposed || seq !== state2.loadSeq;
      const offPage = () => !state2.expanded || !pathRe.test(location.pathname);
      try {
        const osuText = await fetchOsuFileText(beatmapId);
        if (superseded() || offPage()) return;
        let loaded = false;
        await runEngineLoad(async () => {
          if (superseded() || offPage()) return;
          const eng = await acquireSharedEngine(engineSlot);
          if (superseded()) return;
          if (!state2.expanded) setSharedEngineRendering(false);
          eng.pause();
          const bgAbs = absoluteUrl2(bg);
          const bgObjectUrl = bgAbs ? await fetchBeatmapCoverObjectUrl(bgAbs) : "";
          if (superseded()) return;
          await eng.loadBeatmap({
            osuText,
            audioUrl: previewAudio || void 0,
            backgroundUrl: bgObjectUrl || void 0
          });
          loaded = true;
        });
        if (superseded()) return;
        if (!loaded || offPage()) {
          invalidateLoadState();
          return;
        }
        state2.lastLoadedKey = key;
        setStatus(dom, "");
        transport.onBeatmapReady();
      } catch (e) {
        if (superseded()) return;
        setStatus(
          dom,
          e instanceof Error ? e.message : "Could not load this difficulty."
        );
        invalidateLoadState();
      } finally {
        if (seq === state2.loadSeq) {
          state2.busy = false;
          if (!state2.disposed) onSettled();
        }
      }
    };
  }

  // src/features/beatmap-preview/widget/transport.js
  var TRANSPORT_FLASH_HOLD_MS = 520;
  function getPreviewClipDurationMs(eng) {
    const a = eng?.previewAudio;
    if (a && Number.isFinite(a.duration) && a.duration > 0 && a.readyState >= 1) {
      return Math.min(PREVIEW_CLIP_CAP_MS, a.duration * 1e3);
    }
    return PREVIEW_CLIP_CAP_MS;
  }
  function beatmapTimeOverlapsPreviewClip(eng, beatmapMs) {
    if (!eng?.getPreviewAudioTimeMsForBeatmapTime || !Number.isFinite(beatmapMs)) {
      return false;
    }
    const shifted = eng.getPreviewAudioTimeMsForBeatmapTime(beatmapMs);
    if (!Number.isFinite(shifted)) return false;
    const dur = getPreviewClipDurationMs(eng);
    return shifted >= 0 && shifted < dur;
  }
  function syncPreviewMusicToWindow(eng) {
    if (!eng?.previewAudio) return;
    const vol = Number.isFinite(eng.musicVolume) && eng.musicVolume >= 0 ? eng.musicVolume : PREVIEW_VOLUME_DEFAULT;
    let t;
    try {
      t = eng.getCurrentTime?.();
    } catch (_) {
      return;
    }
    if (!Number.isFinite(t)) return;
    const inside = beatmapTimeOverlapsPreviewClip(eng, t);
    if (!eng.isPlaying) {
      eng.previewAudio.volume = inside ? vol : 0;
      return;
    }
    if (inside) {
      eng.previewAudio.volume = vol;
      let shiftedSec;
      try {
        shiftedSec = Math.max(0, eng.getPreviewAudioTimeMsForBeatmapTime(t)) / 1e3;
      } catch (_) {
        return;
      }
      const durSec = getPreviewClipDurationMs(eng) / 1e3;
      const target = Math.min(shiftedSec, Math.max(0, durSec - 1e-3));
      if (Math.abs(eng.previewAudio.currentTime - target) > 0.12) {
        eng.previewAudio.currentTime = target;
      }
      if (eng.previewAudio.paused && !eng.previewAudio.ended) {
        eng.previewAudio.play().catch(() => {
        });
      }
    } else {
      eng.previewAudio.volume = 0;
      eng.previewAudio.pause();
    }
  }
  function formatPreviewTimeMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "0:00";
    const totalSec = Math.floor(ms / 1e3);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m >= 60) {
      const h2 = Math.floor(m / 60);
      const mm = m % 60;
      return `${h2}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function volumeFromSlider(range) {
    const v = Number(range.value) / 100;
    if (!Number.isFinite(v)) return PREVIEW_VOLUME_DEFAULT;
    return Math.min(1, Math.max(0, v));
  }
  function mountTransport(state2, dom) {
    const {
      canvasHost,
      transportOverlay,
      transportPlayGlyph,
      transportPauseGlyph,
      previewTimeBtn,
      seekTimeDisplay,
      seekRange,
      musicVolumeRange,
      hitsoundVolumeRange,
      offsetInput
    } = dom;
    function clearTransportFlashTimer() {
      if (state2.transportFlashTimer) {
        window.clearTimeout(state2.transportFlashTimer);
        state2.transportFlashTimer = 0;
      }
    }
    function flashTransportOverlay(isPlaying) {
      clearTransportFlashTimer();
      transportPlayGlyph.hidden = isPlaying;
      transportPauseGlyph.hidden = !isPlaying;
      transportOverlay.classList.add(`${WRAP_CLASS}__transport-overlay--visible`);
      state2.transportFlashTimer = window.setTimeout(() => {
        transportOverlay.classList.remove(
          `${WRAP_CLASS}__transport-overlay--visible`
        );
        state2.transportFlashTimer = 0;
      }, TRANSPORT_FLASH_HOLD_MS);
    }
    function hideTransportOverlay() {
      clearTransportFlashTimer();
      transportOverlay.classList.remove(
        `${WRAP_CLASS}__transport-overlay--visible`
      );
    }
    function previewOffsetMsFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p !== null) return p;
      return state2.offsetInputCommittedMs;
    }
    function commitOffsetFromInput() {
      const p = parseOffsetTextStrict(offsetInput.value);
      if (p === null) {
        offsetInput.value = formatOffsetForField(state2.offsetInputCommittedMs);
      } else {
        state2.offsetInputCommittedMs = p;
        offsetInput.value = formatOffsetForField(p);
        writeStoredOffsetMs(state2.offsetInputCommittedMs);
      }
      applyPreviewOffsetToEngine();
      if (sharedEngine && state2.lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    }
    function paintSeekTimeLabels(currentMs, durationMs) {
      seekTimeDisplay.textContent = `${formatPreviewTimeMs(currentMs)} / ${formatPreviewTimeMs(durationMs)}`;
    }
    function stopSeekAnimationLoop() {
      if (state2.seekRafId) {
        cancelAnimationFrame(state2.seekRafId);
        state2.seekRafId = 0;
      }
    }
    function syncSeekUiFromEngine() {
      if (!sharedEngine || !state2.lastLoadedKey || state2.seekPointerActive) {
        return;
      }
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const maxMs = Math.max(1, Number.isFinite(duration) ? duration : 0);
        const t = sharedEngine.getCurrentTime?.() ?? 0;
        seekRange.max = String(maxMs);
        seekRange.value = String(
          Math.min(maxMs, Math.max(0, Number.isFinite(t) ? t : 0))
        );
        paintSeekTimeLabels(t, duration);
      } catch (_) {
      }
    }
    function startSeekAnimationLoop() {
      stopSeekAnimationLoop();
      const tick = () => {
        state2.seekRafId = 0;
        if (!state2.expanded) return;
        syncSeekUiFromEngine();
        if (sharedEngine && state2.lastLoadedKey) {
          syncPreviewMusicToWindow(sharedEngine);
        }
        if (sharedEngine?.isPlaying)
          state2.seekRafId = requestAnimationFrame(tick);
      };
      state2.seekRafId = requestAnimationFrame(tick);
    }
    function applySeekFromInput() {
      if (!sharedEngine || seekRange.disabled) return;
      const ms = Number(seekRange.value);
      if (!Number.isFinite(ms)) return;
      try {
        sharedEngine.setCurrentTime?.(ms);
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
      }
    }
    function seekByDeltaMs(deltaMs) {
      if (!sharedEngine || seekRange.disabled || !state2.lastLoadedKey) return;
      let t;
      let duration;
      try {
        t = sharedEngine.getCurrentTime?.() ?? 0;
        duration = sharedEngine.getDuration?.() ?? 0;
      } catch (_) {
        return;
      }
      const maxMs = Math.max(0, Number.isFinite(duration) ? duration : 0);
      if (maxMs <= 0) return;
      const next = Math.min(
        maxMs,
        Math.max(0, (Number.isFinite(t) ? t : 0) + deltaMs)
      );
      try {
        sharedEngine.setCurrentTime?.(next);
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
      }
    }
    function jumpToBeatmapPreviewTime() {
      if (!sharedEngine || seekRange.disabled) return;
      try {
        if (typeof sharedEngine.seekToPreview === "function") {
          sharedEngine.seekToPreview();
        } else {
          const ptm = Number(sharedEngine.previewTimeMs);
          sharedEngine.setCurrentTime?.(
            Number.isFinite(ptm) ? Math.max(0, ptm) : 0
          );
        }
        syncPreviewMusicToWindow(sharedEngine);
        syncSeekUiFromEngine();
      } catch (_) {
      }
    }
    function applyPreviewMusicVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = volumeFromSlider(musicVolumeRange);
      try {
        if (typeof sharedEngine.setMusicVolume === "function") {
          sharedEngine.setMusicVolume(vol);
        } else {
          sharedEngine.musicVolume = vol;
        }
        syncPreviewMusicToWindow(sharedEngine);
      } catch (_) {
      }
    }
    function applyPreviewHitsoundVolumeToEngine() {
      if (!sharedEngine) return;
      const vol = volumeFromSlider(hitsoundVolumeRange);
      try {
        if (typeof sharedEngine.setHitsoundVolume === "function") {
          sharedEngine.setHitsoundVolume(vol);
        } else {
          sharedEngine.hitsoundVolume = vol;
          sharedEngine.hitsoundPlayer?.setVolume?.(vol);
        }
      } catch (_) {
      }
    }
    function applyPreviewOffsetToEngine() {
      if (!sharedEngine || typeof sharedEngine.setAudioOffsetMs !== "function") {
        return;
      }
      try {
        sharedEngine.setAudioOffsetMs(
          actualAudioOffsetMsFromDisplay(previewOffsetMsFromInput())
        );
      } catch (_) {
      }
    }
    function applyPreviewVolumesToEngine() {
      applyPreviewMusicVolumeToEngine();
      applyPreviewHitsoundVolumeToEngine();
      applyPreviewOffsetToEngine();
    }
    function setSeekUiEnabled(on) {
      seekRange.disabled = !on;
      musicVolumeRange.disabled = !on;
      hitsoundVolumeRange.disabled = !on;
      offsetInput.disabled = !on;
      if (!on) {
        seekRange.max = "1";
        seekRange.value = "0";
        paintSeekTimeLabels(0, 0);
      }
    }
    function updateCanvasPlayStateAria() {
      if (!sharedEngine || !state2.lastLoadedKey || seekRange.disabled) return;
      try {
        const playing = !!sharedEngine.isPlaying;
        canvasHost.setAttribute(
          "aria-label",
          playing ? "Pause gameplay preview" : "Play gameplay preview"
        );
        canvasHost.setAttribute("aria-pressed", playing ? "true" : "false");
      } catch (_) {
      }
    }
    function setPreviewControlsEnabled(on) {
      setSeekUiEnabled(on);
      previewTimeBtn.disabled = !on;
      canvasHost.classList.toggle(`${WRAP_CLASS}__canvas-host--disabled`, !on);
      canvasHost.tabIndex = on ? 0 : -1;
      if (!on) {
        canvasHost.setAttribute("aria-label", "Play gameplay preview");
        canvasHost.removeAttribute("aria-pressed");
      } else {
        updateCanvasPlayStateAria();
      }
    }
    function togglePlaybackFromCanvas() {
      if (!sharedEngine || !state2.lastLoadedKey || seekRange.disabled || state2.busy || canvasHost.classList.contains(`${WRAP_CLASS}__canvas-host--disabled`)) {
        return;
      }
      try {
        if (sharedEngine.isPlaying) {
          sharedEngine.pause?.();
        } else {
          sharedEngine.play?.({
            enableAudio: true,
            enableHitsounds: true
          });
          syncPreviewMusicToWindow(sharedEngine);
          startSeekAnimationLoop();
        }
        updateCanvasPlayStateAria();
        flashTransportOverlay(!!sharedEngine.isPlaying);
      } catch (_) {
      }
    }
    function onBeatmapReady() {
      setPreviewControlsEnabled(true);
      applyPreviewVolumesToEngine();
      syncSeekUiFromEngine();
      updateCanvasPlayStateAria();
    }
    seekRange.addEventListener("pointerdown", (ev) => {
      state2.seekPointerActive = true;
      try {
        seekRange.setPointerCapture(ev.pointerId);
      } catch (_) {
      }
    });
    seekRange.addEventListener("pointerup", (ev) => {
      state2.seekPointerActive = false;
      try {
        seekRange.releasePointerCapture(ev.pointerId);
      } catch (_) {
      }
      applySeekFromInput();
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("pointercancel", () => {
      state2.seekPointerActive = false;
      syncSeekUiFromEngine();
    });
    seekRange.addEventListener("input", () => {
      applySeekFromInput();
      if (!sharedEngine || !state2.lastLoadedKey || seekRange.disabled) return;
      try {
        const duration = sharedEngine.getDuration?.() ?? 0;
        const ms = Number(seekRange.value);
        if (Number.isFinite(ms) && Number.isFinite(duration)) {
          paintSeekTimeLabels(ms, duration);
        }
      } catch (_) {
      }
    });
    seekRange.addEventListener("change", () => {
      applySeekFromInput();
      syncSeekUiFromEngine();
    });
    musicVolumeRange.addEventListener("input", () => {
      applyPreviewMusicVolumeToEngine();
    });
    musicVolumeRange.addEventListener("change", () => {
      musicVolumePref.write(volumeFromSlider(musicVolumeRange));
    });
    hitsoundVolumeRange.addEventListener("input", () => {
      applyPreviewHitsoundVolumeToEngine();
    });
    hitsoundVolumeRange.addEventListener("change", () => {
      hitsoundVolumePref.write(volumeFromSlider(hitsoundVolumeRange));
    });
    offsetInput.addEventListener("input", () => {
      applyPreviewOffsetToEngine();
      if (sharedEngine && state2.lastLoadedKey) {
        syncPreviewMusicToWindow(sharedEngine);
      }
    });
    offsetInput.addEventListener("blur", () => {
      commitOffsetFromInput();
    });
    offsetInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      commitOffsetFromInput();
    });
    canvasHost.addEventListener("click", (ev) => {
      if ((ev.detail & 1) !== 1) return;
      togglePlaybackFromCanvas();
    });
    previewTimeBtn.addEventListener("click", () => {
      jumpToBeatmapPreviewTime();
    });
    return {
      onBeatmapReady,
      setPreviewControlsEnabled,
      startSeekAnimationLoop,
      stopSeekAnimationLoop,
      seekByDeltaMs,
      togglePlaybackFromCanvas,
      hideTransportOverlay
    };
  }

  // src/features/beatmap-preview/widget/index.js
  function mountBeatmapsetInfoPreview({
    el: el2,
    manageStyle: manageStyle2,
    pathRe,
    getBeatmapId,
    getRuleset,
    readBeatmapsetJson: readBeatmapsetJson2,
    styleId
  }) {
    const styles = manageStyle2(styleId, PREVIEW_CSS);
    styles.inject();
    const state2 = {
      expanded: false,
      busy: false,
      /** The beatmap id loaded on the shared engine by this widget, or "". */
      lastLoadedKey: "",
      /** Set by dispose: this widget must not touch the shared engine any more. */
      disposed: false,
      /** Bumped by every load and by dispose; a load that sees a newer value stops (B30). */
      loadSeq: 0,
      seekRafId: 0,
      seekPointerActive: false,
      /** `ruleset:beatmapId` while preview is expanded; used to detect difficulty / mode changes (SPA). */
      previewContextKey: "",
      /** @type {AbortController|null} the picker watch while expanded */
      contextWatch: null,
      transportFlashTimer: 0,
      offsetInputCommittedMs: readStoredOffsetMs()
    };
    const dom = buildPreviewDom(el2, {
      musicVolume: musicVolumePref.read(),
      hitsoundVolume: hitsoundVolumePref.read(),
      offsetText: formatOffsetForField(state2.offsetInputCommittedMs)
    });
    const { row, toggleBtn, panel } = dom;
    const transport = mountTransport(state2, dom);
    const onPreviewPanelKeydown = createPreviewKeydown(state2, dom, transport);
    const loadCurrentBeatmap = createBeatmapLoader({
      state: state2,
      dom,
      transport,
      pathRe,
      getBeatmapId,
      getRuleset,
      readBeatmapsetJson: readBeatmapsetJson2,
      // A difficulty switch while loading was ignored (busy): check now.
      onSettled: () => onPossiblePreviewContextChange()
    });
    function previewContextKeyFromPage() {
      if (!pathRe.test(location.pathname)) return "";
      const rs = (getRuleset() || "osu").toLowerCase();
      const id = getBeatmapId();
      return `${rs}:${id || ""}`;
    }
    function stopContextWatch() {
      state2.contextWatch?.abort();
      state2.contextWatch = null;
    }
    function startContextWatch() {
      stopContextWatch();
      state2.contextWatch = new AbortController();
      observe.subscribe(
        {
          selector: ".beatmapset-beatmap-picker, .beatmapset-beatmap-picker__beatmap",
          attributes: ["class"],
          schedule: "sync",
          signal: state2.contextWatch.signal,
          label: "beatmap-preview/context"
        },
        onPossiblePreviewContextChange
      );
    }
    function collapsePreviewAndResetEngine() {
      if (!state2.expanded) return;
      state2.expanded = false;
      panel.hidden = true;
      panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);
      setToggleLabel(dom, false);
      stopContextWatch();
      state2.previewContextKey = "";
      transport.stopSeekAnimationLoop();
      state2.lastLoadedKey = "";
      state2.busy = false;
      transport.setPreviewControlsEnabled(false);
      setStatus(dom, "");
      try {
        sharedEngine?.pause?.();
      } catch (_) {
      }
      destroySharedEngineHard();
      revokeBeatmapCoverObjectUrl();
    }
    function onPossiblePreviewContextChange() {
      if (!pathRe.test(location.pathname) || !state2.expanded || state2.busy) {
        return;
      }
      const k = previewContextKeyFromPage();
      if (state2.previewContextKey && k !== state2.previewContextKey) {
        collapsePreviewAndResetEngine();
      }
    }
    panel.addEventListener("keydown", onPreviewPanelKeydown);
    toggleBtn.addEventListener("click", async () => {
      state2.expanded = !state2.expanded;
      panel.hidden = !state2.expanded;
      setToggleLabel(dom, state2.expanded);
      if (state2.expanded) {
        state2.previewContextKey = previewContextKeyFromPage();
        startContextWatch();
        setSharedEngineRendering(true);
        transport.startSeekAnimationLoop();
        if (!state2.busy) {
          await loadCurrentBeatmap();
        }
      } else {
        stopContextWatch();
        state2.previewContextKey = "";
        panel.classList.remove(`${WRAP_CLASS}__panel--unsupported`);
        transport.stopSeekAnimationLoop();
        try {
          sharedEngine?.pause?.();
        } catch (_) {
        }
        setSharedEngineRendering(false);
      }
    });
    window.addEventListener("hashchange", onPossiblePreviewContextChange, {
      passive: true
    });
    window.addEventListener("popstate", onPossiblePreviewContextChange, {
      passive: true
    });
    return {
      dispose: () => {
        state2.disposed = true;
        state2.loadSeq += 1;
        stopContextWatch();
        window.removeEventListener("hashchange", onPossiblePreviewContextChange);
        window.removeEventListener("popstate", onPossiblePreviewContextChange);
        panel.removeEventListener("keydown", onPreviewPanelKeydown);
        transport.stopSeekAnimationLoop();
        transport.hideTransportOverlay();
        revokeBeatmapCoverObjectUrl();
        destroySharedEngineHard();
        row.remove();
        styles.remove();
      },
      /** @returns {HTMLElement} */
      getRow: () => row
    };
  }

  // src/features/beatmapset/preview-section.js
  var BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";
  function mountBeatmapPreviewSection(header, pathRe) {
    if (!pathRe.test(location.pathname) || !document.body.contains(header)) {
      return void 0;
    }
    const infoEl = document.querySelector(".beatmapset-info");
    if (!infoEl || !document.body.contains(infoEl)) return void 0;
    if (document.querySelector("[data-oep-beatmap-preview-root]")) {
      return void 0;
    }
    const previewUi = mountBeatmapsetInfoPreview({
      el,
      manageStyle: OsuExpertPlus.dom.manageStyle,
      pathRe,
      getBeatmapId: getBeatmapPageBeatmapId,
      getRuleset: getBeatmapPageRuleset,
      readBeatmapsetJson,
      styleId: BEATMAP_PREVIEW_STYLE_ID
    });
    const previewSection = el("div", { class: "oep-beatmap-preview-section" });
    previewSection.appendChild(previewUi.getRow());
    infoEl.insertAdjacentElement("beforebegin", previewSection);
    return () => {
      try {
        previewUi.dispose();
      } catch (_) {
      }
      previewSection.remove();
    };
  }

  // src/features/beatmapset/styles.js
  var BEATMAPSET_STYLE_ID = "osu-expertplus-beatmap-detail-css";
  var BEATMAPSET_CSS = `
  /* Modal open controls: custom look per placement (header vs info panel). */
  .${ROOT_CLASS}__action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .${ROOT_CLASS}__action-btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
  }
  /* osu-web uses 20px padding-bottom on artist; when our control follows, move
     that space to margin below the button (tighter to artist, gap before mapping). */
  .beatmapset-header
    .beatmapset-header__details-text--artist:has(+ [data-oep-beatmapset-metadata]) {
    padding-bottom: 0;
  }
  .${ROOT_CLASS}__action-btn--under-artist {
    align-self: flex-start;
    flex: 0 0 auto;
    width: max-content;
    max-width: 100%;
    margin-top: 4px;
    margin-bottom: 20px;
    color: hsl(var(--hsl-l1, 0 0% 96%));
    background: rgba(0, 0, 0, 0.35);
    border-color: hsl(var(--hsl-l1, 0 0% 100%) / 0.22);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }
  .${ROOT_CLASS}__action-btn--under-artist:hover {
    background: rgba(0, 0, 0, 0.52);
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    color: #fff;
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: stretch;
  }
  /*
   * osu-web's sticky title and our "Full description" box share one sticky
   * band (same look as beatmapset-info__header--sticky). The title stays
   * where osu-web rendered it; the box is its next sibling.
   */
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > h3.beatmapset-info__header,
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-heading-actions {
    margin: 0;
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: hsl(var(--hsl-b4));
    background-image: linear-gradient(
      to top,
      hsla(var(--hsl-b4), 0),
      hsl(var(--hsl-b4)) 5px
    );
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > h3.beatmapset-info__header {
    padding: 5px 0 12px;
    flex: 0 1 auto;
    min-width: 0;
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-heading-actions {
    display: flex;
    align-items: center;
    flex: 1 1 0;
    min-width: max-content;
    padding: 0 0 12px 10px;
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-heading-actions > .${ROOT_CLASS}__action-btn--description-heading {
    flex: 0 0 auto;
    align-self: center;
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.2;
    padding: 3px 8px;
    gap: 4px;
    border-radius: 5px;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    background: hsl(var(--hsl-b3, 333 18% 16%));
    border-color: hsl(var(--hsl-b5, 333 18% 28%));
    text-shadow: none;
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-heading-actions > .${ROOT_CLASS}__action-btn--description-heading i {
    font-size: 10px;
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > .${ROOT_CLASS}__description-heading-actions > .${ROOT_CLASS}__action-btn--description-heading:hover {
    background: hsl(var(--hsl-b4, 333 18% 22%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
  }
  .beatmapset-info > .beatmapset-info__box:first-child .beatmapset-info__row.${ROOT_CLASS}__description-heading-row > div:not([class]) {
    flex: 1 0 100%;
    min-width: 0;
  }

  .${ROOT_CLASS}__modal-portal {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    box-sizing: border-box;
  }
  .${ROOT_CLASS}__modal-portal.${ROOT_CLASS}__modal-portal--open {
    display: flex;
  }
  .${ROOT_CLASS}__modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    cursor: pointer;
  }
  .${ROOT_CLASS}__modal {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: min(92vw, 600px);
    max-height: min(88vh, 680px);
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    background: hsl(var(--hsl-b2, 333 18% 12%));
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
    border: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
    color: hsl(var(--hsl-l1, 0 0% 90%));
    font-family: inherit;
    animation: ${ROOT_CLASS}-modal-in 160ms ease-out;
  }
  .${ROOT_CLASS}__modal--description {
    max-width: min(92vw, 720px);
    max-height: min(88vh, 78vh);
  }
  .${ROOT_CLASS}__description-toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 10px;
  }
  .${ROOT_CLASS}__description-prose {
    font-size: 13px;
    line-height: 1.55;
    color: hsl(var(--hsl-l1, 0 0% 92%));
    word-break: break-word;
  }
  .${ROOT_CLASS}__description-prose .bbcode {
    color: inherit;
  }
  @keyframes ${ROOT_CLASS}-modal-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .${ROOT_CLASS}__modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
    flex-shrink: 0;
  }
  .${ROOT_CLASS}__modal-header-start {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1 1 auto;
  }
  .${ROOT_CLASS}__modal-header-osu-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    flex-shrink: 0;
    max-width: min(100%, 240px);
  }
  .${ROOT_CLASS}__modal-header-osu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 30px;
    padding: 5px 10px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    color: hsl(var(--hsl-l2, 0 0% 72%));
    background: hsl(var(--hsl-b4, 333 18% 18%));
    transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
  }
  .${ROOT_CLASS}__modal-header-osu-msg {
    margin: 0;
    font-size: 10px;
    font-weight: 500;
    line-height: 1.3;
    color: #e07a7a;
  }
  .${ROOT_CLASS}__modal-header-osu-msg:empty {
    display: none;
  }
  .${ROOT_CLASS}__modal-header-osu-btn:hover:not(:disabled) {
    background: hsl(var(--hsl-b5, 333 18% 26%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${ROOT_CLASS}__modal-header-osu-btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
  }
  .${ROOT_CLASS}__modal-header-osu-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .${ROOT_CLASS}__modal-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .${ROOT_CLASS}__modal-close {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: hsl(var(--hsl-l2, 0 0% 78%));
    background: transparent;
    transition: background 120ms ease, color 120ms ease;
  }
  .${ROOT_CLASS}__modal-close:hover {
    background: hsl(var(--hsl-b5, 333 18% 26%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${ROOT_CLASS}__modal-body {
    padding: 4px 16px 16px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .${ROOT_CLASS}__row {
    display: grid;
    grid-template-columns: minmax(120px, 30%) 1fr;
    gap: 8px 16px;
    padding: 12px 0;
    border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
  }
  .${ROOT_CLASS}__row:last-child {
    border-bottom: none;
  }
  .${ROOT_CLASS}__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
    opacity: 0.9;
    align-self: start;
    padding-top: 3px;
  }
  .${ROOT_CLASS}__value-cell {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }
  .${ROOT_CLASS}__value {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.45;
    color: hsl(var(--hsl-l1, 0 0% 92%));
    word-break: break-word;
  }
  .${ROOT_CLASS}__value--muted {
    color: hsl(var(--hsl-l2, 0 0% 65%));
    font-style: italic;
  }
  .${ROOT_CLASS}__copy-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin-top: 1px;
    padding: 0;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: hsl(var(--hsl-l2, 0 0% 72%));
    background: hsl(var(--hsl-b4, 333 18% 18%));
    transition: background 120ms ease, color 120ms ease;
  }
  .${ROOT_CLASS}__copy-btn:hover {
    background: hsl(var(--hsl-b5, 333 18% 26%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${ROOT_CLASS}__copy-btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
  }
  .${ROOT_CLASS}__value-cell > .${ROOT_CLASS}__tags {
    flex: 1;
    min-width: 0;
  }
  .${ROOT_CLASS}__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: flex-start;
  }
  .${ROOT_CLASS}__tag-wrap,
  .${ROOT_CLASS}__copy-wrap {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: top;
    max-width: 100%;
  }
  .${ROOT_CLASS}__copied-toast {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, -5px);
    padding: 3px 8px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: hsl(var(--hsl-l1, 0 0% 96%));
    background: hsl(var(--hsl-b6, 333 18% 28%));
    border: 1px solid hsl(var(--hsl-c2, 333 60% 60%) / 0.45);
    border-radius: 5px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    visibility: hidden;
    transition: opacity 140ms ease, visibility 140ms ease;
    z-index: 5;
  }
  .${ROOT_CLASS}__copied-toast--show {
    opacity: 1;
    visibility: visible;
  }
  .${ROOT_CLASS}__tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    padding: 5px 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    border-radius: 999px;
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    background: hsl(var(--hsl-b4, 333 18% 20%));
    border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
  }
  .${ROOT_CLASS}__tag:hover {
    background: hsl(var(--hsl-b5, 333 18% 26%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
  }
  .${ROOT_CLASS}__tag:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
  }
  .${ROOT_CLASS}__err {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: hsl(var(--hsl-l2, 0 0% 78%));
  }
  /* Favourite hover popover (replaces osu! qtip user list on heart stat). */
  .${ROOT_CLASS}__fav-popover {
    position: fixed;
    z-index: 20050;
    box-sizing: border-box;
    width: min(92vw, 19rem);
    max-height: min(72vh, 24rem);
    padding: 10px 12px;
    border-radius: 10px;
    background: hsl(var(--hsl-b2, 333 18% 12%) / 0.82);
    border: 1px solid hsl(var(--hsl-b4, 333 18% 22%) / 0.55);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: hsl(var(--hsl-l1, 0 0% 92%));
    font-size: 12px;
    line-height: 1.35;
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.11s ease, visibility 0.11s ease;
  }
  .${ROOT_CLASS}__fav-popover.${ROOT_CLASS}__fav-popover--visible {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }
  .${ROOT_CLASS}__fav-popover-title {
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: hsl(var(--hsl-l2, 0 0% 78%));
    margin-bottom: 8px;
  }
  .${ROOT_CLASS}__fav-popover-scroll {
    max-height: min(62vh, 20rem);
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  .${ROOT_CLASS}__header-fav-chip {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    color: inherit;
    text-decoration: none;
    font-weight: 600;
    padding: 2px 0;
    border-radius: 6px;
  }
  .${ROOT_CLASS}__header-fav-chip:hover {
    color: hsl(var(--hsl-c2, 333 60% 82%));
  }
  .${ROOT_CLASS}__header-fav-chip:hover .${ROOT_CLASS}__header-fav-name {
    text-decoration: underline;
  }
  .${ROOT_CLASS}__header-fav-chip--text {
    font-weight: 500;
    padding-left: 4px;
  }
  .${ROOT_CLASS}__header-fav-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: hsla(var(--hsl-b6, 333 12% 20%), 0.6);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
  }
  .${ROOT_CLASS}__header-fav-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1 1 auto;
  }
  .${ROOT_CLASS}__header-favouriters-muted {
    opacity: 0.85;
    font-weight: 400;
    padding: 4px 2px 8px;
  }

  /* Vertical difficulty picker: keeps osu's horizontal, wrapping tray, but shows each diff's name + SR beside its icon. */
  .beatmapset-header.oep-picker-diff-names-enabled
    .beatmapset-header__beatmap-picker-box {
    width: auto;
    max-width: none;
  }
  .beatmapset-header.oep-picker-diff-names-enabled
    .beatmapset-beatmap-picker {
    flex-direction: row;
    flex-wrap: wrap;
    /* width: auto on a flex container stretches to fill the row; osu's own
       fit-content default (which we were overriding) is what keeps the
       background hugging the actual icons instead of spanning the header. */
    width: -moz-fit-content;
    width: fit-content;
    max-width: 100%;
    /* Native tray uses a negative margin sized to its 7px item padding; our items use
       their own (larger) padding, so drop that offset instead of keeping it in sync. */
    margin: 0 0 10px;
  }
  .beatmapset-header.oep-picker-diff-names-enabled
    .beatmapset-beatmap-picker__beatmap {
    display: inline-flex !important;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.6rem;
    width: auto !important;
    height: auto !important;
    padding: 0.55rem 1.1rem 0.55rem 0.7rem;
    box-sizing: border-box;
    position: relative;
  }
  .beatmapset-header.oep-picker-diff-names-enabled
    .beatmapset-beatmap-picker__beatmap::before {
    z-index: 0;
  }
  .beatmapset-header.oep-picker-diff-names-enabled
    .beatmapset-beatmap-picker__beatmap
    > .beatmap-icon {
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  .oep-picker-diff-names__meta {
    display: none;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 0.1rem;
    min-width: 0;
    line-height: 1.2;
    text-align: left;
    position: relative;
    z-index: 1;
    /* Same muted mix used elsewhere for diff-tinted text (see --oep-diff-muted). */
    --oep-diff-muted: color-mix(
      in srgb,
      var(--oep-diff-muted-src, hsl(var(--hsl-c1))) 44%,
      #ffffff
    );
  }
  .beatmapset-header.oep-picker-diff-names-enabled .oep-picker-diff-names__meta {
    display: flex;
  }
  .oep-picker-diff-names__version {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--oep-diff-muted);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .oep-picker-diff-names__star {
    display: inline-flex;
    align-items: baseline;
    gap: 0.2em;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--oep-diff-muted);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
  }
  .oep-picker-diff-names__star .fa-star {
    font-size: 1em;
    color: inherit;
  }

  .${OEP_OMDB_WRAP_CLASS} {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 2px 0 4px;
  }
  .${OEP_OMDB_ROW_CLASS} {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    margin: 0;
    font-size: 11px;
    line-height: 1.35;
    color: hsl(var(--hsl-l1, 0 0% 90%));
  }
  .${OEP_OMDB_ROW_CLASS}__label {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.15em 0.6em;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      color-mix(in srgb, hsl(var(--hsl-c2, 333 60% 60%)) 32%, #000000) 50%,
      transparent
    );
    color: hsl(var(--hsl-l1, 0 0% 96%));
  }
  a.${OEP_OMDB_ROW_CLASS}__label {
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  a.${OEP_OMDB_ROW_CLASS}__label:hover {
    background: color-mix(
      in srgb,
      color-mix(in srgb, hsl(var(--hsl-c2, 333 60% 60%)) 48%, #000000) 65%,
      transparent
    );
    color: hsl(var(--hsl-c2, 333 72% 84%));
  }
  a.${OEP_OMDB_ROW_CLASS}__label:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
    outline-offset: 2px;
    border-radius: 999px;
  }
  .${OEP_OMDB_ROW_CLASS}__body {
    flex: 1 1 auto;
    min-width: 0;
  }
  .${OEP_OMDB_ROW_CLASS}__body--muted {
    opacity: 0.5;
  }
  a.${OEP_OMDB_ROW_CLASS}__settings-link {
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  a.${OEP_OMDB_ROW_CLASS}__settings-link:hover {
    color: hsl(var(--hsl-c2, 333 60% 72%));
    opacity: 1;
  }
  a.${OEP_OMDB_ROW_CLASS}__settings-link:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
    outline-offset: 2px;
    border-radius: 2px;
  }
  .${OEP_OMDB_ROW_CLASS}__body--error {
    color: #e05c5c;
    opacity: 0.95;
  }
  .${OEP_OMDB_ROW_CLASS}__stat-value {
    font-weight: 700;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
  }
  .${OEP_OMDB_ROW_CLASS}__ranks {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.2em;
    vertical-align: baseline;
  }
  .${OEP_OMDB_ROW_CLASS}__rank-muted {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: none;
    opacity: 1;
    color: hsl(var(--hsl-l1, 0 0% 72%));
  }
  .${OEP_OMDB_ROW_CLASS}__rank-value {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: -0.02em;
    color: #ffffff;
    font-variant-numeric: tabular-nums;
  }
  a.${OEP_OMDB_ROW_CLASS}__rank-value {
    /* No color override here — "overall"/year rank links are the same element as
       .__rank-value above, and an inherited color would win on specificity and undo it. */
    text-decoration: none;
  }
  a.${OEP_OMDB_ROW_CLASS}__rank-value:hover {
    color: hsl(var(--hsl-c2, 333 72% 78%));
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  a.${OEP_OMDB_ROW_CLASS}__rank-value:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 65%));
    outline-offset: 2px;
    border-radius: 2px;
  }
  .${OEP_OMDB_ROW_CLASS}__rank-sep {
    font-size: 14px;
    opacity: 0.45;
    font-weight: 500;
    margin-right: 0.05em;
  }

  .${OEP_OMDB_ROW_CLASS}__dist-anchor {
    position: relative;
    display: inline;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-trigger {
    cursor: help;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
    text-decoration-color: hsla(var(--hsl-l1, 0 0% 90%), 0.35);
  }
  .${OEP_OMDB_ROW_CLASS}__dist-trigger:hover,
  .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
    text-decoration-color: hsl(var(--hsl-c2, 333 60% 65%) / 0.65);
    outline: none;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-trigger:focus-visible {
    box-shadow: 0 0 0 2px hsla(var(--hsl-c2, 333 60% 70%), 0.45);
    border-radius: 2px;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-popover {
    min-width: 20rem;
    max-width: min(34rem, calc(100vw - 16px));
    padding: 8px 10px 9px;
    border-radius: 8px;
    background: hsl(var(--hsl-b2, 333 18% 12%));
    border: 1px solid hsl(var(--hsl-b4, 333 18% 22%));
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    font-size: 11px;
    line-height: 1.35;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    pointer-events: auto;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-head {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    opacity: 0.5;
    margin-bottom: 6px;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-row {
    display: grid;
    grid-template-columns: 3.75rem minmax(0, 1fr) 2.25rem;
    align-items: center;
    gap: 6px 10px;
    margin-top: 4px;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-head + .${OEP_OMDB_ROW_CLASS}__dist-row {
    margin-top: 0;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-score {
    justify-self: stretch;
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--hsl-l1, 0 0% 86%));
  }
  .${OEP_OMDB_ROW_CLASS}__dist-bar-track {
    height: 5px;
    border-radius: 3px;
    background: hsla(var(--hsl-b5, 333 18% 28%), 0.55);
    overflow: hidden;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-bar {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      hsl(var(--hsl-c1, 333 89% 58%)),
      hsl(var(--hsl-c2, 333 60% 62%))
    );
    min-width: 0;
    transition: width 100ms ease;
  }
  .${OEP_OMDB_ROW_CLASS}__dist-count {
    text-align: right;
    font-variant-numeric: tabular-nums;
    opacity: 0.88;
    font-weight: 600;
  }

  .${OEP_OMDB_VOTE_CLASS} {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    font-size: 11px;
    line-height: 1.35;
    color: hsl(var(--hsl-l1, 0 0% 90%));
  }
  .${OEP_OMDB_VOTE_CLASS}__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    min-width: 0;
  }
  .${OEP_OMDB_VOTE_CLASS}__label {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 1;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }
  .${OEP_OMDB_VOTE_CLASS}__stars {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit {
    position: relative;
    width: 1.58em;
    height: 1.48em;
    flex-shrink: 0;
    transition: transform 120ms ease, filter 120ms ease;
  }
  .${OEP_OMDB_VOTE_CLASS}__stars:hover .${OEP_OMDB_VOTE_CLASS}__unit {
    filter: brightness(1.05);
  }
  .${OEP_OMDB_VOTE_CLASS}__icon {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -52%);
    font-size: 1.22rem;
    line-height: 1;
    pointer-events: none;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--empty {
    display: block;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--half,
  .${OEP_OMDB_VOTE_CLASS}__unit--empty .${OEP_OMDB_VOTE_CLASS}__icon--full {
    display: none;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--half {
    display: block;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--empty,
  .${OEP_OMDB_VOTE_CLASS}__unit--half .${OEP_OMDB_VOTE_CLASS}__icon--full {
    display: none;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--full {
    display: block;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--empty,
  .${OEP_OMDB_VOTE_CLASS}__unit--full .${OEP_OMDB_VOTE_CLASS}__icon--half {
    display: none;
  }
  .${OEP_OMDB_VOTE_CLASS}__icon--empty {
    opacity: 0.5;
    color: hsl(var(--hsl-b6, 333 12% 42%));
  }
  .${OEP_OMDB_VOTE_CLASS}__icon--full,
  .${OEP_OMDB_VOTE_CLASS}__icon--half {
    color: #ffc14d;
    filter: drop-shadow(0 0 5px hsla(38, 100%, 55%, 0.28))
      drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  .${OEP_OMDB_VOTE_CLASS}__icon--half {
    color: #ffca5c;
  }
  .${OEP_OMDB_VOTE_CLASS}__half {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    z-index: 2;
    border-radius: 0;
  }
  .${OEP_OMDB_VOTE_CLASS}__half:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 1px;
  }
  .${OEP_OMDB_VOTE_CLASS}__half--left { left: 0; }
  .${OEP_OMDB_VOTE_CLASS}__half--right { right: 0; }
  /* First star: narrow left strip = 0★, then 0.5 / 1.0 halves. */
  .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--zero {
    left: 0;
    width: 26%;
    z-index: 3;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--left {
    left: 26%;
    width: 37%;
  }
  .${OEP_OMDB_VOTE_CLASS}__unit--has-zero .${OEP_OMDB_VOTE_CLASS}__half--right {
    left: auto;
    right: 0;
    width: 37%;
  }
  .${OEP_OMDB_VOTE_CLASS}--busy .${OEP_OMDB_VOTE_CLASS}__half {
    cursor: wait;
    pointer-events: none;
  }
  .${OEP_OMDB_VOTE_CLASS}--busy {
    opacity: 0.72;
  }
  .${OEP_OMDB_VOTE_CLASS}__clear {
    font: inherit;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b4, 333 18% 18%));
    color: hsl(var(--hsl-l1, 0 0% 82%));
    cursor: pointer;
  }
  .${OEP_OMDB_VOTE_CLASS}__clear:hover {
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  .${OEP_OMDB_VOTE_CLASS}__clear:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .${OEP_OMDB_VOTE_CLASS}__clear--concealed {
    visibility: hidden;
    pointer-events: none;
  }
  .${OEP_OMDB_VOTE_CLASS}__status {
    font-size: 10px;
    opacity: 0.75;
    width: 100%;
  }
  .${OEP_OMDB_VOTE_CLASS}__status--error {
    color: #e05c5c;
    opacity: 0.95;
  }

  .btn-osu-big.${BEATCONNECT_DL_PAIRED_CLASS} {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    margin-right: 0 !important;
  }
  .${BEATCONNECT_DL_BTN_CLASS} {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 5px 5px 0;
    min-width: 0;
    width: fit-content;
    max-width: 88px;
    align-self: stretch;
    border-radius: 0 4px 4px 0;
    border: none;
    padding: 4px 5px;
    text-decoration: none;
    cursor: pointer;
    text-transform: none;
    vertical-align: middle;
    color: hsl(var(--hsl-c1));
    background: hsl(var(--hsl-h2));
    border-left: 1px solid hsl(var(--hsl-b5));
    transition: background-color 120ms ease, color 120ms ease,
      border-color 120ms ease;
  }
  .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_CLASS} {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: auto;
    max-width: 100%;
    gap: 3px;
    text-align: center;
  }
  .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_ICON_CLASS} {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    margin: 0;
    line-height: 0;
    font-size: 26px;
  }
  .${BEATCONNECT_DL_BTN_CLASS} .${BEATCONNECT_STACK_LABEL_CLASS} {
    display: block;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0.02em;
    max-width: 100%;
  }
  .${BEATCONNECT_DL_BTN_CLASS} .oep-beatconnect-logo {
    display: block;
    height: 1em;
    width: auto;
    max-height: 26px;
    object-fit: contain;
  }

  .${BEATCONNECT_DL_BTN_CLASS}:hover,
  .${BEATCONNECT_DL_BTN_CLASS}:focus {
    color: hsl(var(--hsl-c1));
    background: hsl(var(--hsl-h1));
    border-left-color: hsl(var(--hsl-b4));
  }
  .${BEATCONNECT_DL_BTN_CLASS}:active {
    color: hsl(var(--hsl-c1));
    background: hsl(var(--hsl-h1));
    border-left-color: hsl(var(--hsl-b4));
  }
  .${BEATCONNECT_DL_BTN_CLASS}:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2));
    outline-offset: 2px;
  }

  .beatmapset-header__buttons button.btn-osu-big--beatmapset-header-square.${BEATMAPSET_FAV_BTN_FAVOURITED_CLASS} {
    --bg: hsl(333, 72%, 58%);
    --hover-bg: hsl(333, 72%, 50%);
    --focus-bg: var(--hover-bg);
    --active-bg: var(--hover-bg);
    --colour: #fff;
    --hover-colour: #fff;
    --focus-colour: #fff;
    --active-colour: #fff;
    color: #fff;
  }
`;

  // src/features/remount.js
  function remountOnEvent(target, type, mount) {
    let dispose = mount();
    const unmount = () => {
      try {
        dispose?.();
      } catch (_) {
      }
      dispose = void 0;
    };
    const onEvent = () => {
      unmount();
      dispose = mount();
    };
    target.addEventListener(type, onEvent);
    return () => {
      target.removeEventListener(type, onEvent);
      unmount();
    };
  }

  // src/features/scoreboard/global-rank.js
  var SCOREBOARD_GLOBAL_RANK_BADGE_CLASS = "oep-scoreboard-rank-badge";
  var SCOREBOARD_GLOBAL_RANK_CACHE_TTL_MS = 30 * 60 * 1e3;
  var SCOREBOARD_GLOBAL_RANK_MODES = ["osu", "taiko", "fruits", "mania"];
  var SCOREBOARD_GLOBAL_RANK_BATCH_MS = 100;
  var _scoreboardGlobalRankCache = /* @__PURE__ */ new Map();
  var _scoreboardGlobalRankPending = /* @__PURE__ */ new Map();
  var _scoreboardGlobalRankInFlight = /* @__PURE__ */ new Map();
  var _scoreboardGlobalRankFlushTimer = 0;
  var _scoreboardGlobalRankIo = null;
  var _scoreboardGlobalRankObserved = /* @__PURE__ */ new Set();
  function scoreboardGlobalRankCacheKey(mode, userId) {
    return `${mode}|${userId}`;
  }
  function scoreboardRowUserId(row) {
    const card = row.querySelector("a.js-usercard[data-user-id]");
    if (card instanceof HTMLElement) {
      const id = Number(card.getAttribute("data-user-id"));
      if (Number.isFinite(id) && id > 0) return id;
    }
    const link = row.querySelector(
      "a.beatmap-scoreboard-table__user-link, a[href*='/users/']"
    );
    if (link instanceof HTMLAnchorElement) {
      const m = (link.getAttribute("href") || "").match(/\/users\/(\d+)/);
      if (m) return Number(m[1]);
    }
    return null;
  }
  var BADGE_USER_ATTR = "data-oep-rank-user";
  function rankBadgeOf(userLink) {
    const host = userLink.parentElement || userLink;
    return host.querySelector(`.${SCOREBOARD_GLOBAL_RANK_BADGE_CLASS}`);
  }
  function paintScoreboardGlobalRankBadge(userLink, userId, rank) {
    if (!(userLink instanceof HTMLElement)) return;
    let badge = rankBadgeOf(userLink);
    if (rank == null) {
      badge?.remove();
      return;
    }
    const text = `#${Number(rank).toLocaleString()}`;
    if (!(badge instanceof HTMLElement)) {
      badge = el("span", {
        class: SCOREBOARD_GLOBAL_RANK_BADGE_CLASS,
        title: "Global rank"
      });
      userLink.insertAdjacentElement("afterend", badge);
    }
    badge.setAttribute(BADGE_USER_ATTR, String(userId));
    if (badge.textContent !== text) badge.textContent = text;
  }
  function userLinkUserId(userLink) {
    const row = userLink.closest("tr");
    return row instanceof HTMLElement ? scoreboardRowUserId(row) : null;
  }
  function getCachedScoreboardGlobalRank(mode, userId) {
    const cached = _scoreboardGlobalRankCache.get(
      scoreboardGlobalRankCacheKey(mode, userId)
    );
    if (!cached || Date.now() - cached.ts >= SCOREBOARD_GLOBAL_RANK_CACHE_TTL_MS)
      return void 0;
    return cached.rank;
  }
  function flushScoreboardGlobalRankLookups() {
    _scoreboardGlobalRankFlushTimer = 0;
    const ids = Array.from(_scoreboardGlobalRankPending.keys());
    if (!ids.length) return;
    for (const id of ids) {
      _scoreboardGlobalRankInFlight.set(id, _scoreboardGlobalRankPending.get(id));
    }
    _scoreboardGlobalRankPending.clear();
    OsuExpertPlus.api.getUsers(ids).then((users) => {
      const byId = /* @__PURE__ */ new Map();
      for (const u of Array.isArray(users) ? users : []) {
        const uid = Number(u?.id);
        if (Number.isFinite(uid)) byId.set(uid, u);
      }
      const ts = Date.now();
      for (const id of ids) {
        const u = byId.get(id);
        for (const m of SCOREBOARD_GLOBAL_RANK_MODES) {
          const rank = Number(u?.statistics_rulesets?.[m]?.global_rank);
          _scoreboardGlobalRankCache.set(scoreboardGlobalRankCacheKey(m, id), {
            rank: Number.isFinite(rank) && rank > 0 ? rank : null,
            ts
          });
        }
        const waiters = _scoreboardGlobalRankInFlight.get(id) || [];
        for (const { userLink, mode } of waiters) {
          if (!userLink.isConnected || userLinkUserId(userLink) !== id) {
            continue;
          }
          paintScoreboardGlobalRankBadge(
            userLink,
            id,
            getCachedScoreboardGlobalRank(mode, id) ?? null
          );
        }
      }
    }).catch(() => {
    }).finally(() => {
      for (const id of ids) _scoreboardGlobalRankInFlight.delete(id);
    });
  }
  function requestScoreboardGlobalRank(row) {
    if (!settings().isEnabled(settingIds().SCOREBOARD_GLOBAL_RANK)) return;
    const userLink = row.querySelector("a.js-usercard");
    if (!(userLink instanceof HTMLElement)) return;
    const userId = scoreboardRowUserId(row);
    if (userId == null) return;
    const mode = getBeatmapPageRuleset() || "osu";
    const cached = getCachedScoreboardGlobalRank(mode, userId);
    if (cached !== void 0) {
      paintScoreboardGlobalRankBadge(userLink, userId, cached);
      return;
    }
    const waiting = _scoreboardGlobalRankInFlight.get(userId) || _scoreboardGlobalRankPending.get(userId);
    if (waiting) {
      waiting.push({ userLink, mode });
      return;
    }
    _scoreboardGlobalRankPending.set(userId, [{ userLink, mode }]);
    if (!_scoreboardGlobalRankFlushTimer) {
      _scoreboardGlobalRankFlushTimer = window.setTimeout(
        flushScoreboardGlobalRankLookups,
        SCOREBOARD_GLOBAL_RANK_BATCH_MS
      );
    }
  }
  function scoreboardGlobalRankIo() {
    if (!_scoreboardGlobalRankIo) {
      _scoreboardGlobalRankIo = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            _scoreboardGlobalRankIo.unobserve(entry.target);
            _scoreboardGlobalRankObserved.delete(entry.target);
            if (entry.target instanceof HTMLElement) {
              requestScoreboardGlobalRank(entry.target);
            }
          }
        },
        { rootMargin: "200px 0px" }
      );
    }
    return _scoreboardGlobalRankIo;
  }
  function syncBeatmapScoreboardGlobalRanks(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const rows = Array.from(scoreboardRoot.querySelectorAll(SCOREBOARD_ROW_SEL));
    for (const row of _scoreboardGlobalRankObserved) {
      if (!row.isConnected) {
        _scoreboardGlobalRankIo?.unobserve(row);
        _scoreboardGlobalRankObserved.delete(row);
      }
    }
    if (!settings().isEnabled(settingIds().SCOREBOARD_GLOBAL_RANK)) {
      _scoreboardGlobalRankIo?.disconnect();
      _scoreboardGlobalRankObserved.clear();
      for (const row of rows) {
        row.querySelector(`.${SCOREBOARD_GLOBAL_RANK_BADGE_CLASS}`)?.remove();
      }
      return;
    }
    const mode = getBeatmapPageRuleset() || "osu";
    const io = scoreboardGlobalRankIo();
    for (const row of rows) {
      if (!(row instanceof HTMLElement) || isScoreboardRowHidden(row)) {
        continue;
      }
      const userLink = row.querySelector("a.js-usercard");
      if (!(userLink instanceof HTMLElement)) continue;
      const userId = scoreboardRowUserId(row);
      if (userId == null) continue;
      const cached = getCachedScoreboardGlobalRank(mode, userId);
      if (cached !== void 0) {
        paintScoreboardGlobalRankBadge(userLink, userId, cached);
        continue;
      }
      const stale = rankBadgeOf(userLink);
      if (stale && stale.getAttribute(BADGE_USER_ATTR) !== String(userId)) {
        stale.remove();
      }
      if (!_scoreboardGlobalRankObserved.has(row)) {
        _scoreboardGlobalRankObserved.add(row);
        io.observe(row);
      }
    }
  }
  function disposeScoreboardGlobalRanks() {
    _scoreboardGlobalRankIo?.disconnect();
    _scoreboardGlobalRankIo = null;
    _scoreboardGlobalRankObserved.clear();
    window.clearTimeout(_scoreboardGlobalRankFlushTimer);
    _scoreboardGlobalRankFlushTimer = 0;
    _scoreboardGlobalRankPending.clear();
  }

  // src/features/scoreboard/tools-row.js
  var TOOLS_ROW_WATCH_SEL = [
    ".beatmapset-scoreboard",
    SCOREBOARD_MODS_SEL,
    ".beatmapset-scoreboard__main",
    ".beatmap-scoreboard-table",
    `[${SCOREBOARD_TOOLS_ROW_ATTR}]`,
    `[${SCOREBOARD_USER_SEARCH_ATTR}]`,
    `[${RATE_EDIT_FILTER_BAR_ATTR}]`
  ].join(", ");
  function placeBeatmapScoreboardToolsRow(scoreboardRoot, row) {
    const modsEl = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
    if (modsEl) {
      if (row.previousElementSibling !== modsEl) {
        modsEl.after(row);
      }
      return;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    if (tableWrap?.parentElement instanceof HTMLElement) {
      const parent = tableWrap.parentElement;
      if (row.parentElement !== parent || row.nextElementSibling !== tableWrap) {
        parent.insertBefore(row, tableWrap);
      }
      return;
    }
    if (main) {
      if (row.parentElement !== main || row !== main.firstElementChild) {
        main.insertBefore(row, main.firstChild);
      }
      return;
    }
    if (row.parentElement !== scoreboardRoot || row !== scoreboardRoot.firstElementChild) {
      scoreboardRoot.insertBefore(row, scoreboardRoot.firstChild);
    }
  }
  function ensureBeatmapScoreboardToolsRow(scoreboardRoot) {
    let row = scoreboardRoot.querySelector(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`);
    if (!(row instanceof HTMLElement)) {
      row = /** @type {HTMLElement} */
      el("div", {
        class: "oep-scoreboard-tools-row",
        [SCOREBOARD_TOOLS_ROW_ATTR]: "1"
      });
    }
    placeBeatmapScoreboardToolsRow(scoreboardRoot, row);
    return row;
  }
  function removeEmptyBeatmapScoreboardToolsRows(scoreboardRoot) {
    const roots = scoreboardRoot instanceof HTMLElement ? [scoreboardRoot] : [...document.querySelectorAll(".beatmapset-scoreboard")];
    for (const root of roots) {
      root.querySelectorAll(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`).forEach((n) => {
        if (n instanceof HTMLElement && n.childElementCount === 0) {
          n.remove();
        }
      });
    }
  }
  function insertBeatmapScoreUserSearchBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    const rate = toolsRow.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (wrap.parentElement !== toolsRow) {
      if (rate) toolsRow.insertBefore(wrap, rate);
      else toolsRow.appendChild(wrap);
    } else if (rate instanceof HTMLElement && rate.previousElementSibling !== wrap) {
      toolsRow.insertBefore(wrap, rate);
    }
  }
  function insertBeatmapRateEditFilterBar(scoreboardRoot, wrap) {
    const toolsRow = ensureBeatmapScoreboardToolsRow(scoreboardRoot);
    toolsRow.appendChild(wrap);
  }
  function isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, row) {
    if (!scoreboardRoot.contains(row)) return false;
    const modsEl = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
    if (modsEl) {
      return row.previousElementSibling === modsEl;
    }
    const main = scoreboardRoot.querySelector(".beatmapset-scoreboard__main");
    const tableWrap = main?.querySelector(".beatmap-scoreboard-table");
    const parent = tableWrap?.parentElement;
    if (parent instanceof HTMLElement && row.parentElement === parent) {
      return row.nextElementSibling === tableWrap;
    }
    if (main instanceof HTMLElement && row.parentElement === main) {
      return row === main.firstElementChild;
    }
    return row.parentElement === scoreboardRoot && row === scoreboardRoot.firstElementChild;
  }
  function isPlayerLookupSearchBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (!(toolsRow instanceof HTMLElement) || !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)) {
      return false;
    }
    return isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow);
  }
  function isRateEditFilterBarPlacedCorrectly(scoreboardRoot, wrap) {
    if (!scoreboardRoot.contains(wrap)) return false;
    const toolsRow = wrap.parentElement;
    if (!(toolsRow instanceof HTMLElement) || !toolsRow.matches(`[${SCOREBOARD_TOOLS_ROW_ATTR}]`)) {
      return false;
    }
    if (!isBeatmapScoreboardToolsRowPlacedCorrectly(scoreboardRoot, toolsRow)) {
      return false;
    }
    const searchWrap = toolsRow.querySelector(`[${SCOREBOARD_USER_SEARCH_ATTR}]`);
    if (!(searchWrap instanceof HTMLElement)) return true;
    return wrap.previousElementSibling === searchWrap;
  }

  // src/features/scoreboard/rate-filter.js
  function startBeatmapScoreboardHideRateEditFilterBar(pathRe) {
    let debounceTimer = 0;
    const cleanup = () => {
      document.querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`).forEach((n) => n.remove());
      removeEmptyBeatmapScoreboardToolsRows();
    };
    const syncCheckbox = (wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const cb = wrap.querySelector('input[type="checkbox"]');
      if (!(cb instanceof HTMLInputElement)) return;
      const on = settings().isEnabled(
        settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES
      );
      if (cb.checked !== on) cb.checked = on;
    };
    const ensureBar = (root) => {
      const modsEl = root.querySelector(SCOREBOARD_MODS_SEL);
      if (!modsEl) return;
      let existing = root.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
      if (!(existing instanceof HTMLElement)) {
        const cb = (
          /** @type {HTMLInputElement} */
          el("input", { type: "checkbox" })
        );
        const label = el("label", {}, cb, " Hide custom rate scores");
        existing = /** @type {HTMLElement} */
        el(
          "div",
          {
            class: "oep-rate-edit-filter",
            [RATE_EDIT_FILTER_BAR_ATTR]: "1"
          },
          label
        );
        cb.addEventListener("change", () => {
          settings().set(
            settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
            cb.checked
          );
        });
        insertBeatmapRateEditFilterBar(root, existing);
      } else if (!isRateEditFilterBarPlacedCorrectly(root, existing)) {
        insertBeatmapRateEditFilterBar(root, existing);
      }
      syncCheckbox(existing);
      syncBeatmapRateEditFilterBarVisibility(root);
    };
    const run = () => {
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      ensureBar(root);
    };
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };
    const unsub = settings().onChange(
      settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES,
      (on) => {
        document.querySelectorAll(`[${RATE_EDIT_FILTER_BAR_ATTR}]`).forEach((w) => {
          if (!(w instanceof HTMLElement)) return;
          const cb = w.querySelector('input[type="checkbox"]');
          if (cb instanceof HTMLInputElement && cb.checked !== on) {
            cb.checked = on;
          }
        });
        const board = findBeatmapScoreboardRoot();
        if (board instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(board);
        }
      }
    );
    const unsubscribe = observe.subscribe(
      {
        selector: TOOLS_ROW_WATCH_SEL,
        schedule: 16,
        label: "scoreboard/rate-filter"
      },
      () => observe.mutate(run)
    );
    schedule();
    return () => {
      unsub();
      window.clearTimeout(debounceTimer);
      unsubscribe();
      cleanup();
    };
  }
  function beatmapScoreboardRowNeedsRateEditMarkFromDom(row) {
    for (const extSpan of row.querySelectorAll(
      ".beatmap-scoreboard-table__mods .mod__extender span"
    )) {
      const modEl = extSpan.closest(".mod");
      const icon = modEl?.querySelector(".mod__icon[data-acronym]");
      const acronym = (icon?.getAttribute("data-acronym") ?? "").trim().toUpperCase();
      if (acronym !== "DT" && acronym !== "NC" && acronym !== "HT" && acronym !== "DC") {
        continue;
      }
      const rate = parseFloat((extSpan.textContent ?? "").replace(/[^\d.]/g, ""));
      if (Number.isFinite(rate) && isNonDefaultSpeed(acronym, rate)) {
        return true;
      }
    }
    return false;
  }
  function beatmapScoreboardRowIsApiInjectedForRateMarking(row) {
    return row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) || row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) || row.hasAttribute(EXTENDED_SCORE_ROW_ATTR);
  }
  function applyRateEditMarkingToScoreboardRows(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
      if (!(row instanceof HTMLElement)) continue;
      if (isScoreboardRowHidden(row, "merged")) continue;
      const needs = beatmapScoreboardRowNeedsRateEditMarkFromDom(row);
      const has = row.hasAttribute(RATE_EDIT_ROW_ATTR);
      if (needs) {
        if (!has) row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      } else if (has && !beatmapScoreboardRowIsApiInjectedForRateMarking(row)) {
        row.removeAttribute(RATE_EDIT_ROW_ATTR);
      }
    }
  }
  function syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const hide = settings().isEnabled(
      settingIds().SCOREBOARD_HIDE_CUSTOM_RATE_SCORES
    );
    const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(realTable instanceof HTMLTableElement)) return;
    const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
    if (!tbody) return;
    for (const row of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
      setRowHidden(row, "rate", hide && row.hasAttribute(RATE_EDIT_ROW_ATTR));
    }
  }
  function syncBeatmapRateEditFilterBarVisibility(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const wrap = scoreboardRoot.querySelector(`[${RATE_EDIT_FILTER_BAR_ATTR}]`);
    if (!(wrap instanceof HTMLElement)) return;
    wrap.hidden = false;
  }

  // src/features/scoreboard/row-mods.js
  function resolveBeatmapScoreboardModTemplateEl(scoreboardRoot) {
    const inRoot = (sel) => scoreboardRoot?.querySelector?.(sel) ?? null;
    const pileModSel = `.${MOD_GRID_CLASS}__pile .beatmap-scoreboard-mod`;
    const stripVisibleSel = ".beatmapset-scoreboard__mods .beatmap-scoreboard-mod:not([data-oep-mod-hidden])";
    const chain = [
      () => inRoot(".beatmap-scoreboard-table__mods .beatmap-scoreboard-mod"),
      () => inRoot(".beatmap-scoreboard-table__body .beatmap-scoreboard-mod"),
      () => inRoot(pileModSel),
      () => document.querySelector(pileModSel),
      () => inRoot(stripVisibleSel),
      () => document.querySelector(stripVisibleSel),
      () => document.querySelector(
        ".beatmap-scoreboard-mod:not([data-oep-mod-hidden])"
      ),
      () => document.querySelector(".beatmap-scoreboard-mod")
    ];
    for (const fn of chain) {
      const el2 = fn();
      if (el2 instanceof HTMLElement) return el2;
    }
    return null;
  }
  function patchBeatmapScoreboardModButton(btn, acronym, opts) {
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    mi?.stripOepModAcronymFromClonedMod?.(btn);
    btn.removeAttribute(MOD_HIDDEN_ATTR);
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const full = modFullName(acronym);
    const icon = btn.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const modRoot = btn.querySelector?.(".mod") ?? (icon instanceof HTMLElement ? icon.closest?.(".mod") : null) ?? btn.closest?.(".mod") ?? null;
    const typeClass = mi?.modTypeClassForAcronym?.(acronym) || "mod--type-Automation";
    const targets = [];
    const push = (el2) => {
      if (el2 instanceof HTMLElement && !targets.includes(el2)) targets.push(el2);
    };
    push(btn);
    push(btn.closest?.(".mod") ?? null);
    push(icon instanceof HTMLElement ? icon.closest(".mod") : null);
    push(btn.querySelector?.(".mod") ?? null);
    for (const target of targets) {
      for (const cls of [...target.classList]) {
        if (/^mod--type-/i.test(cls)) target.classList.remove(cls);
      }
      target.classList.add(typeClass);
    }
    btn.querySelector(".mod__extender")?.remove();
    btn.querySelector(".mod__customised-indicator")?.remove();
    const sc = opts?.speedChange;
    const showRate = Number.isFinite(sc) && isNonDefaultSpeed(acronym, sc);
    const rateStr = showRate ? formatSpeedChange(sc, { style: "trim" }) : "";
    const fullLabel = rateStr ? `${full} (${rateStr})` : full;
    const modInner = (btn.querySelector(".mod") instanceof HTMLElement ? btn.querySelector(".mod") : modRoot) ?? btn;
    if (rateStr && modInner instanceof HTMLElement) {
      const ext = document.createElement("div");
      ext.className = "mod__extender";
      const sp = document.createElement("span");
      sp.textContent = rateStr;
      ext.appendChild(sp);
      const iconEl = modInner.querySelector(".mod__icon");
      if (iconEl instanceof HTMLElement) {
        iconEl.insertAdjacentElement("afterend", ext);
      } else {
        modInner.appendChild(ext);
      }
    }
    btn.title = fullLabel;
    btn.setAttribute("aria-label", fullLabel);
    btn.setAttribute("data-original-title", fullLabel);
    btn.setAttribute("data-qtip", fullLabel);
    btn.setAttribute("data-tooltip", fullLabel);
    if (modRoot instanceof HTMLElement) {
      modRoot.title = fullLabel;
      modRoot.setAttribute("data-orig-title", fullLabel);
    }
    if (icon instanceof HTMLElement) {
      icon.title = fullLabel;
      icon.setAttribute("aria-label", fullLabel);
      icon.setAttribute("data-original-title", fullLabel);
      icon.setAttribute("data-qtip", fullLabel);
      icon.setAttribute("data-tooltip", fullLabel);
    }
    btn.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
    btn.classList.add("beatmap-scoreboard-mod--enabled");
  }
  function stripModButtonState(btn) {
    for (const node of [btn, ...btn.querySelectorAll("*")]) {
      for (const { name } of [...node.attributes]) {
        if (name.startsWith("data-oep-") || name === "disabled" || name === "aria-pressed" || name === "aria-disabled") {
          node.removeAttribute(name);
        }
      }
      for (const cls of [...node.classList]) {
        if (cls.startsWith("oep-") || cls === "beatmap-scoreboard-mod--disabled") {
          node.classList.remove(cls);
        }
      }
      if (node.classList.contains("beatmap-scoreboard-mod")) {
        node.classList.add("beatmap-scoreboard-mod--enabled");
      }
    }
  }
  function applyScoreboardModsCell(td, score, modTemplateBtn) {
    const wrap = td.querySelector(".beatmap-scoreboard-table__mods");
    if (!wrap) return;
    wrap.replaceChildren();
    const list = sortModsForDisplay(score.mods);
    const mi = OsuExpertPlus.modIconsAsAcronyms;
    if (modTemplateBtn instanceof HTMLElement) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const btn = (
          /** @type {HTMLElement} */
          modTemplateBtn.cloneNode(true)
        );
        stripModButtonState(btn);
        const spd = speedChangeFromMod(m);
        patchBeatmapScoreboardModButton(
          btn,
          ac,
          Number.isFinite(spd) && isNonDefaultSpeed(ac, spd) ? { speedChange: spd } : void 0
        );
        wrap.appendChild(btn);
      }
    } else if (list.length) {
      for (const m of list) {
        const ac = typeof m === "string" ? m : m?.acronym;
        if (!ac) continue;
        const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
        const typeClass = mi?.modTypeClassForAcronym?.(ac) || "mod--type-Automation";
        let full = modFullName(ac);
        const spd = speedChangeFromMod(m);
        const showRate = Number.isFinite(spd) && isNonDefaultSpeed(ac, spd);
        const rateStr = showRate ? formatSpeedChange(spd, { style: "trim" }) : "";
        if (rateStr) full = `${full} (${rateStr})`;
        const iconEl = el("div", {
          class: `mod__icon mod__icon--${safe}`,
          "data-acronym": ac,
          title: full,
          "aria-label": full,
          "data-original-title": full,
          "data-qtip": full,
          "data-tooltip": full
        });
        const modInnerKids = [iconEl];
        if (rateStr) {
          modInnerKids.push(
            el("div", { class: "mod__extender" }, el("span", {}, rateStr))
          );
        }
        const modEl = (
          /** @type {HTMLElement} */
          el(
            "div",
            {
              class: `beatmap-scoreboard-mod mod ${typeClass} beatmap-scoreboard-mod--enabled`,
              title: full,
              "aria-label": full,
              "data-original-title": full,
              "data-qtip": full,
              "data-tooltip": full
            },
            ...modInnerKids
          )
        );
        modEl.addEventListener(
          "click",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          true
        );
        wrap.appendChild(modEl);
      }
    }
  }

  // src/features/scoreboard/row-builder.js
  function formatScoreboardInt(value) {
    const n = value != null && value !== "" ? Number(value) : NaN;
    return Number.isFinite(n) ? formatDecimal(n, { digits: 0 }) : String(value ?? "");
  }
  function formatScoreboardAccuracy(accuracy) {
    const n = accuracy != null && accuracy !== "" ? Number(accuracy) : NaN;
    if (!Number.isFinite(n)) return "";
    return `${formatDecimal(n <= 1 ? n * 100 : n, { digits: 2 })}%`;
  }
  var HEADER_HIT_ATTR_RE = /\bbeatmap-scoreboard-table__header--hit-([a-z_]+)/;
  function scoreboardRefTd(templateRow, colIndex) {
    if (colIndex == null || !(templateRow instanceof HTMLTableRowElement))
      return null;
    const tds = templateRow.querySelectorAll("td");
    return (
      /** @type {HTMLTableCellElement|null} */
      tds[colIndex] ?? null
    );
  }
  function applyScoreboardTextCellLikeRef(td, refTd, text) {
    if (!td) return;
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    const refA = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (a instanceof HTMLAnchorElement) {
      if (refA instanceof HTMLAnchorElement) a.className = refA.className;
      const refShell = refA?.firstElementChild;
      if (refShell instanceof HTMLElement) {
        const shell2 = refShell.cloneNode(false);
        shell2.textContent = text;
        a.replaceChildren(shell2);
      } else {
        a.replaceChildren(document.createTextNode(text));
      }
      return;
    }
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    const refShellParent = refTd?.querySelector(".beatmap-scoreboard-table__cell-content") || null;
    if (shell instanceof HTMLElement && refShellParent instanceof HTMLElement) {
      shell.className = refShellParent.className;
      const refChild = refShellParent.firstElementChild;
      if (refChild instanceof HTMLElement) {
        const child = refChild.cloneNode(false);
        child.textContent = text;
        shell.replaceChildren(child);
      } else {
        shell.replaceChildren(document.createTextNode(text));
      }
      return;
    }
    td.textContent = text;
  }
  function toggleScoreboardCellPerfectClass(cls, on) {
    const PERF = "beatmap-scoreboard-table__cell-content--perfect";
    const base = cls.replace(new RegExp(`\\s*${PERF}\\b`, "g"), "").trim().replace(/\s+/g, " ");
    return on ? `${base} ${PERF}`.trim() : base;
  }
  function applyScoreboardComboCell(td, refTd, score, mapFullCombo) {
    if (!td) return;
    const comboStr = `${formatScoreboardInt(score.max_combo ?? 0)}x`;
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    const refA = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (!a || !refA) return;
    const perfect = isFullCombo(score, mapFullCombo, { apiFlags: true });
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = comboStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(comboStr));
  }
  function applyScoreboardAccuracyCell(td, refTd, score) {
    if (!td) return;
    const accStr = formatScoreboardAccuracy(score.accuracy);
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    const refA = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (!a || !refA) return;
    const perfect = isPerfectAccuracy(score.accuracy);
    a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
    const refChild = refA.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const shell = refChild.cloneNode(false);
      shell.textContent = accStr;
      a.replaceChildren(shell);
      return;
    }
    a.replaceChildren(document.createTextNode(accStr));
  }
  function formatPpTitle(pp) {
    try {
      return pp.toLocaleString(pageLocale(), { maximumFractionDigits: 3 });
    } catch (_) {
      return String(pp);
    }
  }
  function applyScoreboardPpCell(td, refTd, score) {
    if (!td) return;
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    const refA = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (!a || !refA) return;
    a.className = refA.className;
    const pp = score.pp;
    const refSpan = refA.querySelector("span");
    if (pp == null || !Number.isFinite(Number(pp))) {
      if (refSpan) {
        const s = (
          /** @type {HTMLSpanElement} */
          refSpan.cloneNode(false)
        );
        s.textContent = "—";
        s.removeAttribute("title");
        s.removeAttribute("data-orig-title");
        s.removeAttribute("data-original-title");
        s.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        a.replaceChildren(s);
      } else {
        a.replaceChildren(document.createTextNode("—"));
      }
      return;
    }
    const ppNumber = Number(pp);
    const titleStr = formatPpTitle(ppNumber);
    const displayStr = String(Math.round(ppNumber));
    if (refSpan) {
      const s = (
        /** @type {HTMLSpanElement} */
        refSpan.cloneNode(false)
      );
      s.textContent = displayStr;
      s.setAttribute("title", titleStr);
      s.setAttribute("data-orig-title", titleStr);
      a.replaceChildren(s);
    } else {
      a.replaceChildren(document.createTextNode(displayStr));
    }
  }
  function applyScoreboardTimeCell(td, refTd, iso) {
    if (!td || !iso) return;
    const timeEl = td.querySelector("time");
    const refTime = refTd?.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return;
    timeEl.setAttribute("datetime", iso);
    timeEl.textContent = formatRelativeShort(iso, { rounding: "floor" });
    if (refTime) {
      timeEl.className = refTime.className;
      timeEl.setAttribute("title", new Date(iso).toISOString());
    }
  }
  function applyScoreboardFlagCell(td, refTd, user, ruleset) {
    if (!td) return;
    const code = String(user?.country_code || "").trim().toUpperCase();
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (!(a instanceof HTMLAnchorElement)) return;
    const refA = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (refA) a.className = refA.className;
    if (!code) {
      a.replaceChildren();
      a.removeAttribute("href");
      return;
    }
    a.href = `https://osu.ppy.sh/rankings/${encodeURIComponent(ruleset)}/performance?country=${encodeURIComponent(code)}`;
    const codeLower = code.toLowerCase();
    const refFlagSpan = refA?.querySelector?.("span.flag-country") ?? null;
    const useSpan = refFlagSpan instanceof HTMLSpanElement;
    const uni = flagFilename(code);
    if (useSpan) {
      let span = a.querySelector("span.flag-country");
      if (!(span instanceof HTMLSpanElement)) {
        span = document.createElement("span");
      }
      span.className = refFlagSpan.className || span.className;
      if (uni) {
        span.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
      }
      span.title = user?.country?.name || code;
      a.replaceChildren(span);
      return;
    }
    let img = a.querySelector("img");
    const refImg = refA?.querySelector("img") ?? null;
    if (!img) {
      img = document.createElement("img");
      if (refImg) img.className = refImg.className;
    } else if (refImg && !img.className) {
      img.className = refImg.className;
    }
    a.replaceChildren(img);
    if (uni) {
      img.src = `/assets/images/flags/${uni}.svg`;
    } else {
      let flagsFolder = "flags";
      const refSrc = refImg?.getAttribute("src") || refImg?.getAttribute("data-src") || refImg?.src || "";
      const m = typeof refSrc === "string" ? refSrc.match(/assets\.ppy\.sh\/([^/]+)\/[A-Za-z0-9]{1,3}\.png/i) : null;
      if (m?.[1]) flagsFolder = m[1];
      else if (typeof refSrc === "string") {
        if (/\/old-flags\//i.test(refSrc)) flagsFolder = "old-flags";
        else if (/\/flags\//i.test(refSrc)) flagsFolder = "flags";
      }
      img.src = `https://assets.ppy.sh/${flagsFolder}/${codeLower}.png`;
    }
    img.alt = code;
    img.title = user?.country?.name || code;
    if (!uni) {
      img.style.maxWidth = "2.25em";
      img.style.maxHeight = "1.15em";
      img.style.width = "auto";
      img.style.height = "auto";
      img.style.objectFit = "contain";
      img.style.verticalAlign = "middle";
    }
  }
  function buildBeatmapScoreboardColumnMap(templateRow, table) {
    const ths = [...table.querySelectorAll("thead th")];
    const key = [
      getBeatmapPageRuleset(),
      templateRow.cells.length,
      ...ths.map((th) => `${th.className}\0${th.textContent}`)
    ].join("");
    const cached = columnMapCache.get(table);
    if (cached && cached.key === key) {
      return cached.map;
    }
    const map = computeColumnMap(templateRow, table, ths);
    columnMapCache.set(table, { key, map });
    return map;
  }
  var columnMapCache = /* @__PURE__ */ new WeakMap();
  function computeColumnMap(templateRow, table, ths) {
    const idx = (mod) => {
      const suf = `__header--${mod}`;
      const th = ths.find((t) => [...t.classList].some((c) => c.endsWith(suf)));
      return th instanceof HTMLTableCellElement ? th.cellIndex : null;
    };
    function inferHitstatLabelFromTh(th) {
      const textTrim = String(th.textContent || "").replace(/\s+/g, " ").trim();
      const parts = [
        th.getAttribute("aria-label"),
        th.getAttribute("title"),
        th.textContent,
        th.className
      ].filter((x) => typeof x === "string" && x.trim().length > 0);
      const raw = parts.join(" ").toLowerCase();
      if (!raw) return "";
      const hasWord = (w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(raw);
      if (hasWord("miss") || hasWord("m")) return "miss";
      if (hasWord("meh")) return "meh";
      if (hasWord("perfect")) return "mania_perfect";
      if (hasWord("good")) return "mania_good";
      if (hasWord("katu") || hasWord("200")) return "katu";
      if (hasWord("ok")) return "ok";
      if (hasWord("geki") || hasWord("320") || hasWord("max")) return "geki";
      if (hasWord("great")) return "great";
      const fruits = getBeatmapPageRuleset() === "fruits";
      if (fruits && /^l$/i.test(textTrim)) return "ctb_l";
      if (/^drp$/i.test(textTrim) || hasWord("drp")) return "ctb_drp";
      if (/(^|[^0-9])300([^0-9]|$)/.test(raw)) return "300";
      if (/(^|[^0-9])100([^0-9]|$)/.test(raw)) return "100";
      if (/(^|[^0-9])50([^0-9]|$)/.test(raw)) return "50";
      return textTrim;
    }
    const hitstatIndices = [];
    const hitstatLabelsByIndex = {};
    const hitstatAttrsByIndex = {};
    ths.forEach((th) => {
      const isHitstat = [...th.classList].some((c) => c === "hitstat" || c.includes("hitstat")) || th.className.includes("hitstat");
      if (isHitstat) {
        const cellIndex = th.cellIndex;
        hitstatIndices.push(cellIndex);
        hitstatLabelsByIndex[cellIndex] = inferHitstatLabelFromTh(th);
        const attr = HEADER_HIT_ATTR_RE.exec(th.className)?.[1];
        if (attr) hitstatAttrsByIndex[cellIndex] = attr;
      }
    });
    const map = {
      rank: idx("rank"),
      grade: idx("grade"),
      score: idx("score"),
      accuracy: idx("accuracy"),
      flag: idx("flag"),
      user: idx("player"),
      combo: idx("maxcombo"),
      pp: idx("pp"),
      time: idx("time"),
      mods: idx("mods")
    };
    if (map.rank == null) map.rank = 0;
    if (map.grade == null) map.grade = 1;
    const tds = [...templateRow.querySelectorAll("td")];
    if (map.user == null) {
      const i = tds.findIndex(
        (td) => td.querySelector?.(
          "a.beatmap-scoreboard-table__user-link, a[href*='/users/']"
        )
      );
      if (i >= 0) map.user = i;
    }
    if (map.time == null) {
      const i = tds.findIndex((td) => td.querySelector?.("time"));
      if (i >= 0) map.time = i;
    }
    if (map.mods == null) {
      const i = tds.findIndex(
        (td) => td.querySelector?.(".beatmap-scoreboard-table__mods")
      );
      if (i >= 0) map.mods = i;
    }
    return { ...map, hitstatIndices, hitstatLabelsByIndex, hitstatAttrsByIndex };
  }
  function applyScoreboardGradeCell(td, refTd, score) {
    if (!td) return;
    const rankKey = scoreGrade(score, { sanitize: true });
    const link = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    const refLink = refTd?.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (link && refLink) link.className = refLink.className;
    let div = td.querySelector("div.score-rank");
    if (!div && link) {
      div = document.createElement("div");
      link.replaceChildren(div);
    }
    if (div) {
      div.className = `score-rank score-rank--tiny score-rank--${rankKey}`;
    }
  }
  function scoreAsDisplayed(score, prefs = readScoreDisplayPrefs()) {
    const dv = scoreDisplayValues(score, prefs, getBeatmapPageRuleset());
    const shown = {
      ...score,
      accuracy: dv.accuracy,
      rank: dv.rank,
      oepDisplayTotal: dv.total
    };
    if (dv.legacy && Array.isArray(score.mods)) {
      shown.mods = score.mods.filter(
        (m) => (typeof m === "string" ? m : m?.acronym) !== "CL"
      );
    }
    return shown;
  }
  function applyApiScoreToBeatmapScoreRow(tr, apiScore, oneBasedRank, colMap, table, templateRow, modTemplateBtn, mapFullCombo) {
    tr.setAttribute(EXTENDED_SCORE_ROW_ATTR, "1");
    registerRowScore(tr, apiScore);
    const score = scoreAsDisplayed(apiScore);
    const tds = [...tr.cells];
    const uid = score.user?.id ?? score.user_id;
    const username = score.user?.username ?? String(uid);
    const userObj = score.user || { country_code: null, country: null };
    const iso = score.ended_at ?? score.created_at ?? "";
    const ruleset = getBeatmapPageRuleset();
    const scoreStr = formatScoreboardInt(score.oepDisplayTotal);
    if (colMap.rank != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.rank],
        scoreboardRefTd(templateRow, colMap.rank),
        `#${oneBasedRank}`
      );
    }
    if (colMap.grade != null) {
      applyScoreboardGradeCell(
        tds[colMap.grade],
        scoreboardRefTd(templateRow, colMap.grade),
        score
      );
    }
    if (colMap.score != null) {
      applyScoreboardTextCellLikeRef(
        tds[colMap.score],
        scoreboardRefTd(templateRow, colMap.score),
        scoreStr
      );
    }
    if (colMap.accuracy != null) {
      applyScoreboardAccuracyCell(
        tds[colMap.accuracy],
        scoreboardRefTd(templateRow, colMap.accuracy),
        score
      );
    }
    if (colMap.flag != null) {
      applyScoreboardFlagCell(
        tds[colMap.flag],
        scoreboardRefTd(templateRow, colMap.flag),
        userObj,
        ruleset
      );
    }
    if (colMap.user != null && tds[colMap.user]) {
      const td = tds[colMap.user];
      const userA = td.querySelector("a.beatmap-scoreboard-table__user-link") || td.querySelector('a[href*="/users/"]');
      if (userA) {
        userA.href = `https://osu.ppy.sh/users/${uid}`;
        const label = userA.querySelector(".beatmap-scoreboard-table__user-link-text") || userA;
        label.textContent = username;
      }
    }
    if (colMap.combo != null) {
      applyScoreboardComboCell(
        tds[colMap.combo],
        scoreboardRefTd(templateRow, colMap.combo),
        score,
        mapFullCombo
      );
    }
    for (const i of colMap.hitstatIndices || []) {
      const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
      const attr = colMap.hitstatAttrsByIndex?.[i];
      const refHit = scoreboardRefTd(templateRow, i);
      applyScoreboardTextCellLikeRef(
        tds[i],
        refHit,
        formatScoreboardInt(
          (attr ? hitstatValueForAttribute(attr, score, ruleset) : null) ?? hitstatValue(label, score, { ruleset })
        )
      );
    }
    if (colMap.pp != null && tds[colMap.pp]) {
      applyScoreboardPpCell(
        tds[colMap.pp],
        scoreboardRefTd(templateRow, colMap.pp),
        score
      );
    }
    if (colMap.time != null && tds[colMap.time] && iso) {
      applyScoreboardTimeCell(
        tds[colMap.time],
        scoreboardRefTd(templateRow, colMap.time),
        iso
      );
    }
    if (colMap.mods != null && tds[colMap.mods]) {
      applyScoreboardModsCell(tds[colMap.mods], score, modTemplateBtn);
    }
    setScoreboardSortValue(tds[colMap.score], score.oepDisplayTotal);
    const acc = Number(score.accuracy);
    setScoreboardSortValue(tds[colMap.accuracy], acc <= 1 ? acc * 100 : acc);
    setScoreboardSortValue(tds[colMap.combo], score.max_combo);
    pointScoreboardRowLinksAtScore(tr, score);
  }
  function setScoreboardSortValue(td, value) {
    const n = Number(value);
    if (td && value != null && value !== "" && Number.isFinite(n)) {
      td.setAttribute(SCOREBOARD_SORT_VALUE_ATTR, String(n));
    }
  }
  function pointScoreboardRowLinksAtScore(tr, score) {
    const scoreId = leaderboardScoreId(score);
    const scoreHrefRe = /\/scores\/(?:[a-z]+\/)?\d+(?:[/?#]|$)/i;
    for (const a of tr.querySelectorAll("a[href]")) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      if (!scoreHrefRe.test(a.getAttribute("href") || "")) continue;
      if (scoreId) a.href = `https://osu.ppy.sh/scores/${scoreId}`;
      else a.removeAttribute("href");
    }
  }
  var INJECTED_ROW_ATTRS = [
    EXTENDED_SCORE_ROW_ATTR,
    WILDCARD_MERGED_ROW_ATTR,
    SCORE_USER_SEARCH_RESULT_ATTR
  ];
  function findScoreboardTemplateRow(tbody) {
    const rows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
    const native = rows.find(
      (r) => !INJECTED_ROW_ATTRS.some((attr) => r.hasAttribute(attr))
    );
    const row = native ?? rows[0] ?? null;
    return row instanceof HTMLTableRowElement ? row : null;
  }
  function cloneTemplateRow(templateRow) {
    const row = (
      /** @type {HTMLTableRowElement} */
      templateRow.cloneNode(true)
    );
    for (const node of [row, ...row.querySelectorAll("*")]) {
      for (const { name } of [...node.attributes]) {
        if (name.startsWith("data-oep-")) node.removeAttribute(name);
      }
    }
    row.querySelectorAll(".oep-scoreboard-rank-badge").forEach((n) => n.remove());
    row.style.display = "";
    row.classList.remove(
      "beatmap-scoreboard-table__body-row--friend",
      "beatmap-scoreboard-table__body-row--first",
      "beatmap-scoreboard-table__body-row--self"
    );
    return row;
  }

  // src/features/scoreboard/sort.js
  var SCOREBOARD_SORT_ARROW_ATTR = "data-oep-scoreboard-sort-arrow";
  var BEATMAP_SCOREBOARD_SORT_KEYS = Object.freeze([
    "score",
    "accuracy",
    "combo",
    "pp",
    "date"
  ]);
  function leaderboardTableScoreNumber(s, prefs = readScoreDisplayPrefs()) {
    return scoreDisplayValues(s, prefs).total;
  }
  function sortLeaderboardScoresLikeTable(scores) {
    const prefs = readScoreDisplayPrefs();
    scores.sort((a, b) => {
      const ds = leaderboardTableScoreNumber(b, prefs) - leaderboardTableScoreNumber(a, prefs);
      if (ds !== 0) return ds;
      const ppb = Number(b.pp);
      const ppa = Number(a.pp);
      if (Number.isFinite(ppb) && Number.isFinite(ppa) && ppb !== ppa)
        return ppb - ppa;
      return (Number(leaderboardScoreId(b)) || 0) - (Number(leaderboardScoreId(a)) || 0);
    });
  }
  var beatmapScoreboardSortState = { key: "score", dir: "desc" };
  function readBeatmapScoreboardSortState() {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(
      beatmapScoreboardSortState.key
    ) ? beatmapScoreboardSortState.key : "score";
    const d = beatmapScoreboardSortState.dir === "asc" ? "asc" : "desc";
    return { key: k, dir: d };
  }
  function writeBeatmapScoreboardSortState(key, dir) {
    const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(String(key).toLowerCase()) ? String(key).toLowerCase() : "score";
    const d = dir === "asc" ? "asc" : "desc";
    beatmapScoreboardSortState = { key: k, dir: d };
  }
  function beatmapScoreboardSortColIndex(sortKey, colMap) {
    if (sortKey === "date") return colMap.time;
    return colMap[sortKey] ?? null;
  }
  function beatmapScoreboardSortColumnLabel(sortKey) {
    if (sortKey === "score") return "Score";
    if (sortKey === "accuracy") return "Accuracy";
    if (sortKey === "combo") return "Combo";
    if (sortKey === "pp") return "PP";
    if (sortKey === "date") return "Date";
    return "Score";
  }
  function applyBeatmapScoreboardSortHeaderClick(sortKey) {
    const { key, dir } = readBeatmapScoreboardSortState();
    let nextDir = "desc";
    if (key === sortKey) {
      nextDir = dir === "desc" ? "asc" : "desc";
    }
    writeBeatmapScoreboardSortState(sortKey, nextDir);
    const board = findBeatmapScoreboardRoot();
    if (board instanceof HTMLElement) {
      refreshBeatmapScoreboardTableEnhancements(board);
    }
  }
  function createBeatmapScoreboardSortHeaderButton(sortKey) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const btn = (
      /** @type {HTMLButtonElement} */
      el("button", {
        type: "button",
        class: "oep-scoreboard-th-sort",
        [SCOREBOARD_SORT_ARROW_ATTR]: "",
        "data-oep-sort-key": sortKey,
        "aria-label": `Sort by ${label}`,
        title: `Sort by ${label}`
      })
    );
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyBeatmapScoreboardSortHeaderClick(sortKey);
    });
    return btn;
  }
  function updateBeatmapScoreboardSortHeaderButton(btn, sortKey, state2) {
    const label = beatmapScoreboardSortColumnLabel(sortKey);
    const active = state2.key === sortKey;
    const sym = !active ? "▼" : state2.dir === "desc" ? "▼" : "▲";
    btn.classList.toggle("oep-scoreboard-th-sort--active", active);
    if (btn.textContent !== sym) btn.textContent = sym;
    const tip = `Sort by ${label}`;
    btn.setAttribute("aria-label", tip);
    btn.title = tip;
    if (active) {
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.removeAttribute("aria-pressed");
    }
  }
  function syncBeatmapScoreboardHeaderSortUi(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbodyRow = table.querySelector(
      "tbody.beatmap-scoreboard-table__body tr.beatmap-scoreboard-table__body-row"
    );
    if (!(tbodyRow instanceof HTMLTableRowElement)) return;
    const colMap = buildBeatmapScoreboardColumnMap(tbodyRow, table);
    const theadRow = table.querySelector("thead tr");
    if (!(theadRow instanceof HTMLTableRowElement)) return;
    const state2 = readBeatmapScoreboardSortState();
    for (let i = 0; i < theadRow.cells.length; i++) {
      const th = theadRow.cells[i];
      if (!(th instanceof HTMLTableCellElement)) continue;
      const btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) continue;
      const k = btn.getAttribute("data-oep-sort-key");
      const expected = k != null ? beatmapScoreboardSortColIndex(k, colMap) : null;
      if (expected == null || th.cellIndex !== expected) {
        btn.remove();
      }
    }
    const pairs = [
      ["score", colMap.score],
      ["accuracy", colMap.accuracy],
      ["combo", colMap.combo],
      ["pp", colMap.pp],
      ["date", colMap.time]
    ];
    for (const [sk, cellIdx] of pairs) {
      if (cellIdx == null) continue;
      const th = theadRow.cells[cellIdx];
      if (!(th instanceof HTMLTableCellElement)) continue;
      let btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
      if (!(btn instanceof HTMLButtonElement)) {
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      } else if (btn.getAttribute("data-oep-sort-key") !== sk) {
        btn.remove();
        btn = createBeatmapScoreboardSortHeaderButton(sk);
        th.appendChild(btn);
      }
      updateBeatmapScoreboardSortHeaderButton(btn, sk, state2);
    }
  }
  function beatmapScoreboardTdNumberForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const plain = td.getAttribute(SCOREBOARD_SORT_VALUE_ATTR);
    if (plain != null && Number.isFinite(Number(plain))) return Number(plain);
    const span = td.querySelector(
      "a.beatmap-scoreboard-table__cell-content span[title], span.beatmap-scoreboard-table__cell-content span[title], span[title]"
    );
    const clean = (raw) => String(raw || "").replace(/[x×%]/gi, "").replace(/\bpp\b/gi, "").trim();
    for (const raw of [
      span?.getAttribute("title"),
      span?.textContent,
      td.textContent
    ]) {
      const n = parseLocaleNumber(clean(raw));
      if (Number.isFinite(n)) return n;
    }
    return -Infinity;
  }
  function beatmapScoreboardTdDateMsForSort(td) {
    if (!(td instanceof HTMLTableCellElement)) return -Infinity;
    const timeEl = td.querySelector("time");
    if (!(timeEl instanceof HTMLTimeElement)) return -Infinity;
    const raw = timeEl.getAttribute("datetime") || timeEl.getAttribute("title") || timeEl.dateTime || "";
    const ms = Date.parse(String(raw).trim());
    return Number.isFinite(ms) ? ms : -Infinity;
  }
  function beatmapScoreboardRowSortPrimary(row, colMap, sortKey) {
    if (sortKey === "date") {
      const i2 = colMap.time;
      return i2 != null ? beatmapScoreboardTdDateMsForSort(row.cells[i2]) : -Infinity;
    }
    const i = sortKey === "score" ? colMap.score : sortKey === "accuracy" ? colMap.accuracy : sortKey === "combo" ? colMap.combo : sortKey === "pp" ? colMap.pp : colMap.score;
    if (i == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[i]);
  }
  function beatmapScoreboardRowSortTieScore(row, colMap) {
    if (colMap.score == null) return -Infinity;
    return beatmapScoreboardTdNumberForSort(row.cells[colMap.score]);
  }
  function renumberBeatmapScoreboardVisibleRanks(visibleRows, colMap) {
    if (colMap.rank == null || !Array.isArray(visibleRows)) return;
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      if (!(row instanceof HTMLTableRowElement)) continue;
      if (row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR)) continue;
      const td = row.cells[colMap.rank];
      if (!td) continue;
      const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
      const target = shell instanceof HTMLElement ? shell : td;
      const cur = String(target.textContent ?? "").trim();
      const next = `#${i + 1}`;
      if (cur !== next) target.textContent = next;
    }
  }
  function applyBeatmapScoreboardLeaderboardSort(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return;
    const tbody = table.querySelector(SCOREBOARD_TBODY_SEL);
    if (!(tbody instanceof HTMLElement)) return;
    const allRows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
    if (allRows.length < 1) return;
    const visible = allRows.filter(
      (r) => r instanceof HTMLElement && !isScoreboardRowHidden(r)
    );
    const hidden = allRows.filter(
      (r) => r instanceof HTMLElement && isScoreboardRowHidden(r)
    );
    if (visible.length < 1) return;
    const templateRow = (
      /** @type {HTMLTableRowElement} */
      visible[0]
    );
    const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
    const { key: sortKey, dir } = readBeatmapScoreboardSortState();
    const desc = dir === "desc";
    if (visible.length < 2) {
      renumberBeatmapScoreboardVisibleRanks(visible, colMap);
      return;
    }
    const keyed = visible.map((r) => {
      const row = (
        /** @type {HTMLTableRowElement} */
        r
      );
      return {
        row,
        primary: beatmapScoreboardRowSortPrimary(row, colMap, sortKey),
        tie: beatmapScoreboardRowSortTieScore(row, colMap)
      };
    });
    const sortedVisible = keyed.sort((a, b) => {
      const pc = desc ? b.primary - a.primary : a.primary - b.primary;
      if (pc !== 0) return pc;
      return desc ? b.tie - a.tie : a.tie - b.tie;
    }).map((k) => k.row);
    const desired = [...sortedVisible, ...hidden];
    let same = true;
    for (let i = 0; i < desired.length; i++) {
      if (tbody.children[i] !== desired[i]) {
        same = false;
        break;
      }
    }
    if (!same) {
      for (const row of desired) tbody.appendChild(row);
    }
    renumberBeatmapScoreboardVisibleRanks(sortedVisible, colMap);
  }
  function startBeatmapScoreboardSortControls(pathRe) {
    let debounceTimer = 0;
    const cleanup = () => {
      document.querySelectorAll(
        `.beatmapset-scoreboard [${SCOREBOARD_SORT_ARROW_ATTR}]`
      ).forEach((n) => n.remove());
    };
    const run = () => {
      debounceTimer = 0;
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      syncBeatmapScoreboardHeaderSortUi(root);
    };
    const unsubscribe = observe.subscribe(
      { schedule: 16, label: "scoreboard/sort-controls" },
      () => observe.mutate(run)
    );
    debounceTimer = window.setTimeout(() => observe.mutate(run), 16);
    return () => {
      window.clearTimeout(debounceTimer);
      unsubscribe();
      cleanup();
    };
  }

  // src/features/scoreboard/table-enhance.js
  var SCOREBOARD_HITSTAT_COLOR_CLASSES = [
    "oep-score-stats__val--300",
    "oep-score-stats__val--100",
    "oep-score-stats__val--50",
    "oep-score-stats__val--miss",
    "oep-score-stats__val--ctb-l",
    "oep-score-stats__val--ctb-drp",
    "oep-score-stats__val--mania-perfect",
    "oep-score-stats__val--mania-good"
  ];
  var SCOREBOARD_PP_VALUE_CLASS = "oep-beatmap-scoreboard-pp-value";
  function syncBeatmapScoreboardPpDecimals(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const showPpDecimals = Boolean(
      settings()?.isEnabled?.(settingIds().SCORE_PP_DECIMALS)
    );
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!td) continue;
        const span = td.querySelector(
          "a.beatmap-scoreboard-table__cell-content > span[title], span.beatmap-scoreboard-table__cell-content > span[title]"
        );
        if (!(span instanceof HTMLSpanElement)) continue;
        const textNode = Array.from(span.childNodes).find(
          (n2) => n2.nodeType === Node.TEXT_NODE
        );
        if (!textNode) continue;
        const full = span.getAttribute("title");
        const n = parseLocaleNumber(full || "");
        if (!Number.isFinite(n)) continue;
        if (showPpDecimals) {
          if (!span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
            span.setAttribute(
              SCOREBOARD_PP_ORIGINAL_ATTR,
              String(textNode.textContent || "").trim()
            );
          }
          textNode.textContent = formatDecimal(n);
        } else if (span.hasAttribute(SCOREBOARD_PP_ORIGINAL_ATTR)) {
          textNode.textContent = span.getAttribute(SCOREBOARD_PP_ORIGINAL_ATTR) || textNode.textContent;
          span.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
        }
      }
    }
  }
  function clearBeatmapScoreboardHitstatColorClasses(el2) {
    if (!(el2 instanceof HTMLElement)) return;
    for (const c of SCOREBOARD_HITSTAT_COLOR_CLASSES) el2.classList.remove(c);
  }
  function beatmapScoreboardHitstatPaintTarget(td) {
    if (!td) return null;
    const a = td.querySelector(SCOREBOARD_CELL_LINK_SEL);
    if (a instanceof HTMLElement) {
      const sp = a.querySelector("span");
      if (sp instanceof HTMLElement) return sp;
      return a;
    }
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    if (shell instanceof HTMLElement) {
      const kid = shell.firstElementChild;
      if (kid instanceof HTMLElement) return kid;
      return shell;
    }
    return td;
  }
  function syncBeatmapScoreboardHitstatColors(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      const indices = colMap.hitstatIndices || [];
      if (!indices.length) continue;
      for (const i of indices) {
        const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
        const colorClass = hitstatClassFromLabel(label);
        const th = [...table.querySelectorAll("thead th")].find(
          (t) => t instanceof HTMLTableCellElement && t.cellIndex === i
        );
        if (th instanceof HTMLElement) {
          clearBeatmapScoreboardHitstatColorClasses(th);
          if (colorClass) th.classList.add(colorClass);
        }
        const rows = table.querySelectorAll(
          "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
        );
        for (const row of rows) {
          const td = row.cells?.[i];
          if (!(td instanceof HTMLTableCellElement)) continue;
          const target = beatmapScoreboardHitstatPaintTarget(td);
          if (!(target instanceof HTMLElement)) continue;
          clearBeatmapScoreboardHitstatColorClasses(target);
          if (colorClass) target.classList.add(colorClass);
        }
      }
    }
  }
  function syncBeatmapScoreboardPpValueColor(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    const tables = scoreboardRoot.querySelectorAll(SCOREBOARD_HTML_TABLE_SEL);
    for (const table of tables) {
      if (!(table instanceof HTMLTableElement)) continue;
      const templateRow = table.querySelector(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      );
      if (!(templateRow instanceof HTMLTableRowElement)) continue;
      const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
      if (colMap.pp == null) continue;
      const rows = table.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      );
      for (const row of rows) {
        const td = row.cells?.[colMap.pp];
        if (!(td instanceof HTMLTableCellElement)) continue;
        const target = beatmapScoreboardHitstatPaintTarget(td);
        if (!(target instanceof HTMLElement)) continue;
        target.classList.add(SCOREBOARD_PP_VALUE_CLASS);
      }
    }
  }
  function scoreboardRowsKey(root) {
    return Array.from(
      root.querySelectorAll(
        "tbody.beatmap-scoreboard-table__body > tr.beatmap-scoreboard-table__body-row"
      ),
      (row) => [
        row.querySelector("[data-user-id]")?.getAttribute("data-user-id"),
        ...Array.from(
          row.querySelectorAll("[title]:not([class*='oep'])"),
          (n) => n.getAttribute("title")
        )
      ].join("|")
    ).join("\n");
  }
  function startBeatmapScoreboardTableEnhancementsLive(pathRe) {
    let lastKey = "";
    const run = () => {
      if (!pathRe.test(location.pathname)) return;
      const root = findBeatmapScoreboardRoot();
      if (root instanceof HTMLElement) {
        refreshBeatmapScoreboardTableEnhancements(root);
        lastKey = scoreboardRowsKey(root);
      }
    };
    const runIfRowsRefilled = () => {
      if (!pathRe.test(location.pathname)) return;
      const root = findBeatmapScoreboardRoot();
      if (root instanceof HTMLElement && scoreboardRowsKey(root) !== lastKey) {
        run();
      }
    };
    const unsubscribe = observe.subscribe(
      {
        selector: ".beatmap-scoreboard-table__body-row",
        schedule: 32,
        label: "scoreboard/table-enhance"
      },
      run
    );
    const unsubscribeRefill = observe.subscribe(
      {
        selector: "tbody.beatmap-scoreboard-table__body",
        characterData: true,
        attributes: ["data-user-id", "title"],
        schedule: 32,
        label: "scoreboard/table-enhance/refill"
      },
      runIfRowsRefilled
    );
    const first = window.setTimeout(run, 32);
    const unsubSettings = [
      settingIds().SCORE_PP_DECIMALS,
      settingIds().SCOREBOARD_GLOBAL_RANK
    ].map((id) => settings().onChange(id, run));
    return () => {
      window.clearTimeout(first);
      unsubscribe();
      unsubscribeRefill();
      unsubSettings.forEach((off) => off());
    };
  }

  // src/features/scoreboard/top-panel.js
  var SCORE_TOP_OVERRIDE_ATTR = "data-oep-score-top-override";
  var HIT_KIND = "hit:";
  var TOP_STAT_KIND_ATTR = "data-oep-top-stat";
  var HEADER_HIT_PREFIX = "beatmap-score-top__stat-header--hit-";
  var TABLE_HEADER_HIT_RE = /\bbeatmap-scoreboard-table__header--hit-(\S+)/;
  var TOP_STAT_KIND_BY_TEXT = Object.freeze({
    "total score": "score",
    accuracy: "accuracy",
    "max combo": "combo",
    pp: "pp",
    time: "time",
    mods: "mods"
  });
  function topStatKind(stat, headerEl, valueEl, widerIndex) {
    const cached = stat.getAttribute(TOP_STAT_KIND_ATTR);
    if (cached != null) return cached;
    let kind = "";
    const hit = [...headerEl.classList].find(
      (c) => c.startsWith(HEADER_HIT_PREFIX)
    );
    if (hit) kind = HIT_KIND + hit.slice(HEADER_HIT_PREFIX.length);
    else if (valueEl.classList.contains("beatmap-score-top__stat-value--score"))
      kind = "score";
    else if (valueEl.classList.contains("beatmap-score-top__stat-value--mods") || valueEl.querySelector(".mods"))
      kind = "mods";
    else if (valueEl.querySelector(".pp-value")) kind = "pp";
    else if (valueEl.querySelector("time")) kind = "time";
    else if (headerEl.classList.contains("beatmap-score-top__stat-header--wider"))
      kind = ["score", "accuracy", "combo"][widerIndex] ?? "";
    if (!kind) {
      const text = (headerEl.textContent ?? "").trim().toLowerCase();
      kind = TOP_STAT_KIND_BY_TEXT[text] ?? "";
    }
    stat.setAttribute(TOP_STAT_KIND_ATTR, kind);
    return kind;
  }
  function topItemStats(item) {
    const out = [];
    let wider = 0;
    for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
      const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
      const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
      if (!headerEl || !(valueEl instanceof HTMLElement)) continue;
      const kind = topStatKind(stat, headerEl, valueEl, wider);
      if (headerEl.classList.contains("beatmap-score-top__stat-header--wider")) {
        wider += 1;
      }
      out.push({ stat, valueEl, kind });
    }
    return out;
  }
  function rowHitValuesByName(row) {
    const out = /* @__PURE__ */ new Map();
    const table = row.closest("table");
    if (!table) return out;
    for (const th of table.querySelectorAll("thead th")) {
      const m = TABLE_HEADER_HIT_RE.exec(th.className);
      if (!m) continue;
      const td = row.cells[
        /** @type {HTMLTableCellElement} */
        th.cellIndex
      ];
      const text = td?.textContent?.trim();
      if (text) out.set(m[1], text);
    }
    return out;
  }
  function apiHitValue(name, score) {
    const ruleset = getBeatmapPageRuleset();
    return hitstatValueForAttribute(name, score, ruleset) ?? hitstatValue(name, score, { ruleset });
  }
  var TOP_PERFECT_CLASS = "beatmap-score-top__stat-value--perfect";
  var ROW_PERFECT_CLASS = "beatmap-scoreboard-table__cell-content--perfect";
  function syncTopItemFromRow(item, row) {
    const posEl = item.querySelector(".beatmap-score-top__position-number");
    if (posEl) {
      const rankText = row.querySelector("a.beatmap-scoreboard-table__cell-content--rank")?.textContent?.trim() ?? "";
      posEl.textContent = /\d/.test(rankText) ? rankText : "-";
    }
    const flags = item.querySelector(".beatmap-score-top__flags");
    if (flags) {
      for (const a of flags.querySelectorAll('a[href*="/teams/"]')) a.remove();
      const rowTeam = row.querySelector('a[href*="/teams/"]');
      if (rowTeam?.querySelector(".flag-team")) {
        const teamA = (
          /** @type {HTMLElement} */
          rowTeam.cloneNode(true)
        );
        teamA.className = "u-hover";
        flags.appendChild(teamA);
      }
    }
    const perfect = {};
    for (const a of row.querySelectorAll(
      ".beatmap-scoreboard-table__cell-content"
    )) {
      const t = a.textContent?.trim() ?? "";
      const on = a.classList.contains(ROW_PERFECT_CLASS);
      if (perfect.accuracy == null && t.endsWith("%")) perfect.accuracy = on;
      else if (perfect.combo == null && /^\d[\d,.\s]*x$/.test(t)) {
        perfect.combo = on;
      }
    }
    for (const { valueEl, kind } of topItemStats(item)) {
      if (kind !== "accuracy" && kind !== "combo") continue;
      valueEl.classList.toggle(TOP_PERFECT_CLASS, perfect[kind] === true);
    }
  }
  function getEffectiveBoardTopRow(scoreboardRoot) {
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return null;
    const tbody = table.querySelector(SCOREBOARD_TBODY_SEL);
    if (!tbody) return null;
    for (const row of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
      if (!(row instanceof HTMLElement) || isScoreboardRowHidden(row)) continue;
      const isNativeFirst = row.classList.contains("beatmap-scoreboard-table__body-row--first") && !row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) && !row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) && !row.hasAttribute(EXTENDED_SCORE_ROW_ATTR);
      if (isNativeFirst) return null;
      return (
        /** @type {HTMLTableRowElement} */
        row
      );
    }
    return null;
  }
  function applyApiScoreToTopItem(item, apiScore, row) {
    const score = scoreAsDisplayed(apiScore);
    const uid = score.user?.id ?? score.user_id;
    const username = score.user?.username ?? (uid != null ? String(uid) : "");
    const iso = score.ended_at ?? score.created_at ?? "";
    const ruleset = getBeatmapPageRuleset();
    const cc = String(score.user?.country_code ?? "").trim().toUpperCase();
    const countryName = score.user?.country?.name || cc;
    const scoreId = leaderboardScoreId(score);
    const scoreUrl = scoreId ? `https://osu.ppy.sh/scores/${scoreId}` : "";
    const linkEl = item.querySelector("a.beatmap-score-top__link-container");
    if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;
    const rankKey = scoreGrade(score, { sanitize: true });
    const gradeDiv = item.querySelector(".score-rank");
    if (gradeDiv)
      gradeDiv.className = `score-rank score-rank--tiny score-rank--${rankKey}`;
    if (uid != null) {
      const userHref = `https://osu.ppy.sh/users/${uid}/${ruleset}`;
      const avatarA = item.querySelector(".beatmap-score-top__avatar a");
      if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
      const avatarSpan = item.querySelector(
        ".beatmap-score-top__avatar span.avatar"
      );
      if (avatarSpan instanceof HTMLElement)
        avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${uid}")`;
      const usernameA = item.querySelector("a.beatmap-score-top__username");
      if (usernameA instanceof HTMLAnchorElement) {
        usernameA.textContent = username;
        usernameA.href = userHref;
        usernameA.dataset.userId = String(uid);
      }
    }
    const achievedTime = item.querySelector(".beatmap-score-top__achieved time");
    if (achievedTime instanceof HTMLElement && iso) {
      achievedTime.setAttribute("datetime", iso);
      achievedTime.setAttribute("title", iso);
      achievedTime.textContent = formatRelativeShort(iso, { rounding: "floor" });
    }
    const countryA = item.querySelector(".beatmap-score-top__flags a");
    if (countryA instanceof HTMLAnchorElement && cc)
      countryA.href = `https://osu.ppy.sh/rankings/${ruleset}/performance?country=${cc}`;
    const flagSpan = item.querySelector(
      ".beatmap-score-top__flags span.flag-country"
    );
    if (flagSpan instanceof HTMLElement && cc) {
      const uni = flagFilename(cc);
      if (uni)
        flagSpan.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
      flagSpan.title = countryName;
    }
    const scoreStr = formatScoreboardInt(score.oepDisplayTotal);
    const accStr = formatScoreboardAccuracy(score.accuracy);
    const comboStr = `${formatScoreboardInt(score.max_combo ?? 0)}x`;
    const ppNum = score.pp != null && Number.isFinite(Number(score.pp)) ? Number(score.pp) : null;
    const ppStr = ppNum != null ? Number.isInteger(ppNum) ? String(ppNum) : ppNum.toFixed(2) : null;
    const rowMods = row?.querySelector(".mods") ?? null;
    for (const { stat, valueEl, kind } of topItemStats(item)) {
      if (kind === "score") {
        valueEl.textContent = scoreStr;
      } else if (kind === "accuracy") {
        valueEl.textContent = accStr;
      } else if (kind === "combo") {
        valueEl.textContent = comboStr;
      } else if (kind === "pp") {
        if (ppStr != null) {
          valueEl.textContent = ppStr;
        } else {
          valueEl.innerHTML = '<span title="pp is not awarded for this score">-</span>';
        }
      } else if (kind === "time") {
        if (iso) {
          const t = document.createElement("time");
          t.className = "js-tooltip-time";
          t.setAttribute("data-orig-title", iso);
          t.textContent = formatRelativeShort(iso, { rounding: "floor" });
          valueEl.replaceChildren(t);
        }
      } else if (kind === "mods") {
        if (rowMods) {
          const modsValueEl = stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
          const existing = modsValueEl.querySelector(".mods");
          const clone = rowMods.cloneNode(true);
          if (existing) existing.replaceWith(clone);
          else modsValueEl.appendChild(clone);
        }
      } else if (kind.startsWith(HIT_KIND)) {
        valueEl.textContent = formatScoreboardInt(
          apiHitValue(kind.slice(HIT_KIND.length), score)
        );
      }
    }
    if (row) syncTopItemFromRow(item, row);
  }
  function applyNativeRowToTopItem(item, row) {
    const scoreUrl = row.querySelector("a.beatmap-scoreboard-table__cell-content--rank")?.getAttribute("href") ?? "";
    const linkEl = item.querySelector("a.beatmap-score-top__link-container");
    if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;
    const gradeEl = row.querySelector(".score-rank");
    const gradeClass = gradeEl ? [...gradeEl.classList].find(
      (c) => c.startsWith("score-rank--") && c !== "score-rank--tiny"
    ) ?? "" : "";
    const gradeKey = gradeClass.replace("score-rank--", "");
    if (gradeKey) {
      const gradeDiv = item.querySelector(".score-rank");
      if (gradeDiv)
        gradeDiv.className = `score-rank score-rank--tiny score-rank--${gradeKey}`;
    }
    const usercardEl = row.querySelector("a.js-usercard");
    const userId = usercardEl?.dataset?.userId ?? "";
    const username = usercardEl?.textContent?.trim() ?? "";
    const ruleset = getBeatmapPageRuleset();
    if (userId) {
      const userHref = `https://osu.ppy.sh/users/${userId}/${ruleset}`;
      const avatarA = item.querySelector(".beatmap-score-top__avatar a");
      if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
      const avatarSpan = item.querySelector(
        ".beatmap-score-top__avatar span.avatar"
      );
      if (avatarSpan instanceof HTMLElement)
        avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${userId}")`;
      const usernameA = item.querySelector("a.beatmap-score-top__username");
      if (usernameA instanceof HTMLAnchorElement) {
        usernameA.textContent = username;
        usernameA.href = userHref;
        usernameA.dataset.userId = userId;
      }
    }
    const rowFlagSpan = row.querySelector("span.flag-country");
    const rowCountryA = row.querySelector(
      'a[href*="/rankings/"][href*="country="]'
    );
    const countryA = item.querySelector(".beatmap-score-top__flags a");
    if (countryA instanceof HTMLAnchorElement && rowCountryA) {
      const href = rowCountryA.getAttribute("href") ?? "";
      if (href) countryA.href = href;
    }
    const itemFlagSpan = item.querySelector(
      ".beatmap-score-top__flags span.flag-country"
    );
    if (itemFlagSpan instanceof HTMLElement && rowFlagSpan) {
      const bgStyle = rowFlagSpan.getAttribute("style") ?? "";
      const bgMatch = bgStyle.match(/url\((['"]?)(.*?)\1\)/);
      if (bgMatch) itemFlagSpan.style.backgroundImage = `url('${bgMatch[2]}')`;
      itemFlagSpan.title = rowFlagSpan.title;
    }
    const scoreValEl = item.querySelector(
      ".beatmap-score-top__stat-value--score"
    );
    if (scoreValEl) {
      const scoreVal = row.querySelector("a.beatmap-scoreboard-table__cell-content--score")?.textContent?.trim() ?? "";
      if (scoreVal) scoreValEl.textContent = scoreVal;
    }
    let accuracy = "";
    for (const a of row.querySelectorAll(
      ".beatmap-scoreboard-table__cell-content"
    )) {
      const t = a.textContent?.trim();
      if (t && t.endsWith("%")) {
        accuracy = t;
        break;
      }
    }
    let maxCombo = "";
    for (const a of row.querySelectorAll(
      ".beatmap-scoreboard-table__cell-content"
    )) {
      const t = a.textContent?.trim();
      if (t && /^\d[\d,]*x$/.test(t)) {
        maxCombo = t;
        break;
      }
    }
    const hitByName = rowHitValuesByName(row);
    const ppText = row.querySelector(".oep-beatmap-scoreboard-pp-value")?.textContent?.trim() ?? "";
    const timeEl = row.querySelector("time.js-tooltip-time");
    const timeIso = timeEl?.getAttribute("datetime") || timeEl?.getAttribute("title") || "";
    const timeText = timeEl?.textContent?.trim() ?? "";
    const rowMods = row.querySelector(".mods");
    for (const { stat, valueEl, kind } of topItemStats(item)) {
      if (kind === "accuracy" && accuracy) {
        valueEl.textContent = accuracy;
      } else if (kind === "combo" && maxCombo) {
        valueEl.textContent = maxCombo;
      } else if (kind === "pp" && ppText) {
        valueEl.textContent = ppText;
      } else if (kind === "time" && timeIso) {
        const t = document.createElement("time");
        t.className = "js-tooltip-time";
        t.setAttribute("data-orig-title", timeIso);
        t.textContent = timeText;
        valueEl.replaceChildren(t);
      } else if (kind === "mods" && rowMods) {
        const modsValueEl = stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
        const existing = modsValueEl.querySelector(".mods");
        const clone = rowMods.cloneNode(true);
        if (existing) existing.replaceWith(clone);
        else modsValueEl.appendChild(clone);
      } else if (kind.startsWith(HIT_KIND)) {
        valueEl.textContent = hitByName.get(kind.slice(HIT_KIND.length)) ?? "-";
      }
    }
    syncTopItemFromRow(item, row);
  }
  var overrideSources = /* @__PURE__ */ new WeakMap();
  function refreshBeatmapScoreTopPanel(scoreboardRoot) {
    const nativeItem = scoreboardRoot.querySelector(
      [
        `.beatmap-scoreboard-top__item:not([${SCORE_TOP_OVERRIDE_ATTR}])`,
        `.beatmap-scoreboard-top > .beatmap-score-top:not([${SCORE_TOP_OVERRIDE_ATTR}])`
      ].join(", ")
    );
    if (!(nativeItem instanceof HTMLElement)) return;
    const parent = nativeItem.parentElement;
    if (!parent) return;
    const existing = [...parent.querySelectorAll(`[${SCORE_TOP_OVERRIDE_ATTR}]`)];
    const topRow = getEffectiveBoardTopRow(scoreboardRoot);
    const score = topRow ? getRowScore(topRow) : void 0;
    const source = topRow ? { row: topRow, score, text: topRow.textContent } : null;
    const current = existing.length === 1 ? overrideSources.get(existing[0]) : null;
    if (source && current && current.row === source.row && current.score === source.score && current.text === source.text && existing[0].nextElementSibling === nativeItem) {
      if (nativeItem.style.display !== "none") nativeItem.style.display = "none";
      return;
    }
    for (const old of existing) old.remove();
    if (!topRow) {
      if (nativeItem.style.display) nativeItem.style.display = "";
      return;
    }
    nativeItem.style.display = "none";
    const overrideItem = (
      /** @type {HTMLElement} */
      nativeItem.cloneNode(true)
    );
    overrideItem.setAttribute(SCORE_TOP_OVERRIDE_ATTR, "1");
    overrideSources.set(overrideItem, source);
    if (score) {
      applyApiScoreToTopItem(overrideItem, score, topRow);
    } else {
      applyNativeRowToTopItem(overrideItem, topRow);
    }
    parent.insertBefore(overrideItem, nativeItem);
  }

  // src/features/scoreboard/refresh.js
  function refreshBeatmapScoreboardTableEnhancements(scoreboardRoot) {
    syncMergedNativeRowsHidden(scoreboardRoot);
    syncBeatmapScoreboardPpDecimals(scoreboardRoot);
    syncBeatmapScoreboardHitstatColors(scoreboardRoot);
    syncBeatmapScoreboardPpValueColor(scoreboardRoot);
    applyRateEditMarkingToScoreboardRows(scoreboardRoot);
    syncBeatmapScoreboardRateEditRowVisibility(scoreboardRoot);
    applyBeatmapScoreboardLeaderboardSort(scoreboardRoot);
    syncBeatmapScoreboardHeaderSortUi(scoreboardRoot);
    syncBeatmapRateEditFilterBarVisibility(scoreboardRoot);
    refreshBeatmapScoreTopPanel(scoreboardRoot);
    syncBeatmapScoreboardGlobalRanks(scoreboardRoot);
  }

  // src/features/scoreboard/merged-leaderboard.js
  var MERGED_NOTICE_CLASS = "oep-merged-notice";
  var MERGED_ROW_ATTRS = {
    wildcard: WILDCARD_MERGED_ROW_ATTR,
    lookup: SCORE_USER_SEARCH_RESULT_ATTR
  };
  function findScoreboardTable(scoreboardRoot) {
    if (!(scoreboardRoot instanceof HTMLElement)) return null;
    const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
    if (!(table instanceof HTMLTableElement)) return null;
    const tbody = table.querySelector(SCOREBOARD_TBODY_SEL);
    if (!(tbody instanceof HTMLElement)) return null;
    return { table, tbody };
  }
  function beatmapUserSearchGlobalRank(score) {
    const r = Number(score?.rank_global);
    if (Number.isFinite(r) && r > 0) return r;
    return null;
  }
  function demoteBeatmapUserSearchResultRowLinks(tr) {
    if (!(tr instanceof HTMLTableRowElement)) return;
    for (const a of tr.querySelectorAll("a")) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      if (a.classList.contains("beatmap-scoreboard-table__user-link")) continue;
      if (/\/scores\/(?:[a-z]+\/)?\d+(?:[/?#]|$)/i.test(
        a.getAttribute("href") || ""
      )) {
        continue;
      }
      const href = a.getAttribute("href") || "";
      if (/\/rankings\/[^/]+\/performance\?country=/i.test(href) && a.classList.contains("beatmap-scoreboard-table__cell-content")) {
        continue;
      }
      if (/\/teams\/[^/?#]+/i.test(href) && a.querySelector(".flag-team")) {
        continue;
      }
      const span = document.createElement("span");
      span.className = a.className;
      for (const attr of [...a.attributes]) {
        const n = attr.name;
        if (n === "href" || n === "target" || n === "download" || n === "rel") {
          continue;
        }
        span.setAttribute(n, attr.value);
      }
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    }
  }
  function prependTeamFlag(playerTd, team) {
    const teamA = document.createElement("a");
    teamA.className = "u-contents u-hover";
    teamA.href = `https://osu.ppy.sh/teams/${team.id}`;
    const teamSpan = document.createElement("span");
    teamSpan.className = "flag-team";
    teamSpan.style.backgroundImage = `url("${team.flag_url}")`;
    teamSpan.title = team.name ?? "";
    teamA.appendChild(teamSpan);
    const userLink = playerTd.querySelector(
      "a.beatmap-scoreboard-table__user-link, a[href*='/users/']"
    );
    if (userLink) {
      userLink.insertAdjacentElement("beforebegin", teamA);
    } else {
      playerTd.prepend(teamA);
    }
  }
  function replaceNativeRows(tbody) {
    tbody.querySelectorAll(
      `tr[${EXTENDED_SCORE_ROW_ATTR}], tr[${WILDCARD_MERGED_ROW_ATTR}], tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`
    ).forEach((r) => r.remove());
    const nativeRows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
    for (const nr of nativeRows) setRowHidden(nr, "merged", true);
    return nativeRows[0] ?? null;
  }
  function syncMergedNativeRowsHidden(scoreboardRoot) {
    const found = findScoreboardTable(scoreboardRoot);
    if (!found) return;
    const mergedSel = Object.values(MERGED_ROW_ATTRS).map((attr) => `tr[${attr}]`).join(", ");
    if (!found.tbody.querySelector(mergedSel)) return;
    for (const row of found.tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
      if (row.matches(mergedSel)) continue;
      setRowHidden(row, "merged", true);
    }
  }
  function showMergedNotice(scoreboardRoot, kind, text) {
    const found = findScoreboardTable(scoreboardRoot);
    if (!found) return;
    const { table, tbody } = found;
    const firstNative = replaceNativeRows(tbody);
    const columns = table.tHead?.rows[0]?.cells.length || /** @type {HTMLTableRowElement|null} */
    firstNative?.cells.length || 1;
    const tr = document.createElement("tr");
    tr.className = MERGED_NOTICE_CLASS;
    tr.setAttribute(MERGED_ROW_ATTRS[kind], "1");
    const td = document.createElement("td");
    td.colSpan = columns;
    td.textContent = text;
    tr.appendChild(td);
    tbody.insertBefore(tr, firstNative);
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }
  function renderMergedLeaderboard(scoreboardRoot, kind, scores, opts = {}) {
    const lookup = kind === "lookup";
    if (lookup && (!Array.isArray(scores) || scores.length === 0)) return false;
    const found = findScoreboardTable(scoreboardRoot);
    if (!found) return false;
    const { table, tbody } = found;
    const templateRow = findScoreboardTemplateRow(tbody);
    if (!(templateRow instanceof HTMLTableRowElement)) return false;
    const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
    const modTemplateBtn = resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
    const beatmapId = getBeatmapPageBeatmapId();
    const mapFullCombo = beatmapId ? getBeatmapFullComboFromBeatmapsetJson(beatmapId) : null;
    opts.beforeInsert?.();
    const firstNative = replaceNativeRows(tbody);
    const seenUserIds = /* @__PURE__ */ new Set();
    let inserted = 0;
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      if (!score || typeof score !== "object") continue;
      const row = cloneTemplateRow(templateRow);
      row.setAttribute(MERGED_ROW_ATTRS[kind], "1");
      const playerTd = colMap.user != null ? row.cells[colMap.user] : null;
      if (playerTd) {
        for (const teamLink of playerTd.querySelectorAll('a[href*="/teams/"]')) {
          teamLink.remove();
        }
        const team = opts.team;
        if (lookup && team?.id && team.flag_url) prependTeamFlag(playerTd, team);
      }
      const position = lookup ? beatmapUserSearchGlobalRank(score) : i + 1;
      applyApiScoreToBeatmapScoreRow(
        row,
        score,
        position ?? 0,
        colMap,
        table,
        templateRow,
        modTemplateBtn,
        mapFullCombo
      );
      if (lookup) {
        demoteBeatmapUserSearchResultRowLinks(row);
        row.removeAttribute(EXTENDED_SCORE_ROW_ATTR);
      }
      const uid = score.user?.id ?? score.user_id;
      const card = playerTd?.querySelector(".js-usercard");
      if (card instanceof HTMLElement && uid != null) {
        card.setAttribute("data-user-id", String(uid));
      }
      if (!lookup && uid != null) {
        const uidKey = String(uid);
        if (seenUserIds.has(uidKey))
          row.setAttribute(WILDCARD_DUPE_ROW_ATTR, "1");
        else seenUserIds.add(uidKey);
      }
      if (scoreHasNonstandardRate(score)) {
        row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
      }
      if (lookup && position == null && colMap.rank != null) {
        const rankTd = row.cells[colMap.rank];
        if (rankTd) {
          const shell = rankTd.querySelector(
            ".beatmap-scoreboard-table__cell-content"
          );
          if (shell) shell.textContent = "?";
          else rankTd.textContent = "?";
        }
      }
      tbody.insertBefore(row, firstNative);
      inserted += 1;
    }
    if (lookup && !inserted) return false;
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
    return true;
  }
  function clearMergedLeaderboard(scoreboardRoot, kind) {
    const found = findScoreboardTable(scoreboardRoot);
    if (!found) return;
    const { tbody } = found;
    const kinds = kind === "wildcard" ? ["lookup", "wildcard"] : ["lookup"];
    for (const k of kinds) {
      tbody.querySelectorAll(`tr[${MERGED_ROW_ATTRS[k]}]`).forEach((r) => r.remove());
    }
    const mergedLeft = tbody.querySelector(
      Object.values(MERGED_ROW_ATTRS).map((attr) => `tr[${attr}]`).join(", ")
    );
    if (!mergedLeft) {
      for (const nr of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
        setRowHidden(nr, "merged", false);
      }
    }
    refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  }

  // src/features/scoreboard/mod-filter/click-runner.js
  var DEFAULT_MAX_STEPS = 64;
  var queue = [];
  var running = null;
  function queueClicks(plan) {
    const i = plan.key ? queue.findIndex((p) => p.key === plan.key) : -1;
    if (i >= 0) queue[i] = plan;
    else queue.push(plan);
    if (!running) startNext();
  }
  function hasQueuedClicks(key) {
    return running?.key === key || queue.some((p) => p.key === key);
  }
  function cancelClicks() {
    queue.length = 0;
    running = null;
  }
  function startNext() {
    const plan = queue.shift() ?? null;
    running = plan;
    if (!plan) return;
    const maxSteps = plan.maxSteps ?? DEFAULT_MAX_STEPS;
    let steps = 0;
    const finish = (completed) => {
      running = null;
      try {
        plan.done(completed);
      } finally {
        if (!running) startNext();
      }
    };
    const tick = () => {
      if (running !== plan) return;
      if (++steps > maxSteps) {
        finish(false);
        return;
      }
      const btn = plan.next();
      if (!btn) {
        finish(true);
        return;
      }
      btn.click();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  // src/features/scoreboard/mod-filter/state.js
  var MOD_GRID_ATTR = "data-oep-mod-grid";
  var MOD_GRID_COLLAPSED_CLASS = `${MOD_GRID_CLASS}--collapsed`;
  var MOD_WILDCARD_CLASS = "oep-mod-wildcard";
  var MOD_WILDCARD_ATTR = "data-oep-mod-wildcard";
  var MAX_WILDCARD_MODS = 2;
  var MERGED_MOD_DT_NC = "DT_NC";
  var MERGED_MOD_SD_PF = "SD_PF";
  var ENABLED_MOD_CLASS = "beatmap-scoreboard-mod--enabled";
  var HIDDEN_ORIGINAL_SEL = `:scope > .beatmap-scoreboard-mod[${MOD_HIDDEN_ATTR}]`;
  var STABLE_MOD_ACRONYMS2 = /* @__PURE__ */ new Set([
    "NM",
    "EZ",
    "NF",
    "HT",
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "SO",
    "TD",
    "RX",
    "AP",
    "FI",
    "K1",
    "K2",
    "K3",
    "K4",
    "K5",
    "K6",
    "K7",
    "K8",
    "K9"
  ]);
  function createModFilterState() {
    return {
      /** acronym → sequence counter (for oldest-eviction). 0 = not wildcard. */
      wildcard: /* @__PURE__ */ new Map(),
      /** Monotonically increasing counter so the oldest wildcard can be evicted. */
      wildcardSeq: 0,
      /** Timer id for the 1-second mod-change debounce. */
      wildcardDebounceTimer: 0,
      /** Abort controller for in-flight wildcard fetches. */
      wildcardAbortCtrl: null,
      /** True while a wildcard fetch owns the loading overlay (re-applied if React replaces the table). */
      wildcardLoading: false,
      /** Merge id → step (DT_NC: 0–3, SD_PF: 0–4). */
      mergedStep: /* @__PURE__ */ new Map(),
      /** Merge id → step a running click plan is heading to (B80). */
      mergedTarget: /* @__PURE__ */ new Map(),
      /** Hidden React strip button → visible grid clone (clone does not receive React class updates). */
      originalToClone: /* @__PURE__ */ new WeakMap()
    };
  }
  var state = createModFilterState();
  function resetModFilterState() {
    Object.assign(state, createModFilterState());
  }
  function modDifficultyRow(modRoot) {
    const c = modRoot.className || "";
    if (/mod--type-DifficultyReduction/i.test(c)) return 0;
    if (/mod--type-DifficultyIncrease/i.test(c)) return 1;
    return 2;
  }
  function modButtonAcronym(btn) {
    const icon = btn.querySelector(".mod__icon[data-acronym]");
    const a = icon?.getAttribute("data-acronym")?.trim().toUpperCase();
    return a || "";
  }
  function isBeatmapScoreboardModStripButtonOn(btn) {
    if (!(btn instanceof HTMLElement) || btn.disabled) return false;
    if (btn.classList.contains(ENABLED_MOD_CLASS)) return true;
    if (btn.getAttribute("aria-pressed") === "true") return true;
    return false;
  }
  function isGridCloneOn(clone) {
    return clone.classList.contains(ENABLED_MOD_CLASS) || clone.getAttribute("aria-pressed") === "true";
  }
  function setGridCloneOn(clone, on) {
    clone.classList.toggle(ENABLED_MOD_CLASS, on);
    clone.setAttribute("aria-pressed", on ? "true" : "false");
  }
  function hiddenOriginals(modsEl) {
    return (
      /** @type {HTMLElement[]} */
      [...modsEl.querySelectorAll(HIDDEN_ORIGINAL_SEL)].filter(
        (n) => n instanceof HTMLElement
      )
    );
  }
  function findHiddenBeatmapModButton(modsEl, acronym) {
    const want = String(acronym || "").trim().toUpperCase();
    if (!want) return null;
    return hiddenOriginals(modsEl).find((b) => modButtonAcronym(b) === want) ?? null;
  }
  function isWildcard(acronym) {
    return (state.wildcard.get(acronym) || 0) > 0;
  }
  function getWildcardMods() {
    const out = [];
    for (const [ac, seq] of state.wildcard) {
      if (seq > 0) out.push(ac);
    }
    return out;
  }

  // src/features/scoreboard/scores-limit.js
  var EXTENDED_LB_LIMIT = 100;
  var DEFAULT_LB_LIMIT = 50;
  function beatmapScoresLimit() {
    return settings().isEnabled(settingIds().API_EXTENDED_LEADERBOARD) ? EXTENDED_LB_LIMIT : DEFAULT_LB_LIMIT;
  }
  var scoresLimitRewriterInstalled = false;
  function withBeatmapScoresLimit(rawUrl) {
    const src = String(rawUrl || "");
    if (!src) return src;
    if (!settings().isEnabled(settingIds().API_EXTENDED_LEADERBOARD)) return src;
    try {
      const u = new URL(src, location.origin);
      if (!/^\/beatmaps\/\d+\/scores$/i.test(u.pathname)) return src;
      if (u.origin !== location.origin && u.origin.toLowerCase() !== "https://osu.ppy.sh") {
        return src;
      }
      if (u.searchParams.get("limit") === String(EXTENDED_LB_LIMIT)) return src;
      u.searchParams.set("limit", String(EXTENDED_LB_LIMIT));
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src)) return u.toString();
      if (src.startsWith("//"))
        return `//${u.host}${u.pathname}${u.search}${u.hash}`;
      return `${u.pathname}${u.search}${u.hash}`;
    } catch (_) {
      return src;
    }
  }
  function installBeatmapScoresLimitPatch() {
    if (scoresLimitRewriterInstalled) return;
    scoresLimitRewriterInstalled = true;
    addRequestRewriter(withBeatmapScoresLimit);
  }

  // src/features/scoreboard/mod-filter/wildcard.js
  var log4 = createLogger("scoreboard/wildcard");
  var EMPTY_NOTICE = "No scores with these mods.";
  var FAILED_NOTICE = "Could not load the scores for these mods. Try again later.";
  function clearWildcardLoadingOverlays() {
    state.wildcardLoading = false;
    document.querySelectorAll(`.${WILDCARD_LOADING_CLASS}`).forEach((n) => n.classList.remove(WILDCARD_LOADING_CLASS));
  }
  function syncWildcardLoadingOverlay(scoreboardRoot) {
    if (!state.wildcardLoading) return;
    const wrap = scoreboardRoot.querySelector(".beatmap-scoreboard-table");
    if (wrap instanceof HTMLElement && !wrap.classList.contains(WILDCARD_LOADING_CLASS)) {
      wrap.classList.add(WILDCARD_LOADING_CLASS);
    }
  }
  function cancelWildcardFetch() {
    window.clearTimeout(state.wildcardDebounceTimer);
    state.wildcardDebounceTimer = 0;
    if (state.wildcardAbortCtrl) {
      state.wildcardAbortCtrl.abort();
      state.wildcardAbortCtrl = null;
    }
    clearWildcardLoadingOverlays();
  }
  function clearWildcardState() {
    state.mergedStep.clear();
    state.wildcard.clear();
    state.wildcardSeq = 0;
    cancelWildcardFetch();
  }
  function getWildcardBeatmapKey() {
    return `${getBeatmapPageRuleset()}/${getBeatmapPageBeatmapId() || ""}`;
  }
  function enableWildcard(acronym, modsEl) {
    const current = getWildcardMods().filter((a) => a !== acronym);
    while (current.length >= MAX_WILDCARD_MODS) {
      const oldest = current.sort(
        (a, b) => (state.wildcard.get(a) || 0) - (state.wildcard.get(b) || 0)
      )[0];
      state.wildcard.set(oldest, 0);
      current.splice(current.indexOf(oldest), 1);
      updateCloneWildcardVisual(oldest, modsEl, false);
    }
    state.wildcardSeq += 1;
    state.wildcard.set(acronym, state.wildcardSeq);
  }
  function disableWildcard(acronym, modsEl) {
    state.wildcard.set(acronym, 0);
    updateCloneWildcardVisual(acronym, modsEl, false);
  }
  function setCloneWildcardClass(clone, on) {
    if (on) {
      if (!clone.classList.contains(MOD_WILDCARD_CLASS)) {
        clone.classList.add(MOD_WILDCARD_CLASS);
        clone.setAttribute(MOD_WILDCARD_ATTR, "1");
      }
    } else {
      clone.classList.remove(MOD_WILDCARD_CLASS);
      clone.removeAttribute(MOD_WILDCARD_ATTR);
    }
  }
  function updateCloneWildcardVisual(acronym, modsEl, wildcard) {
    for (const orig of hiddenOriginals(modsEl)) {
      if (modButtonAcronym(orig) !== acronym) continue;
      const clone = state.originalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (wildcard) {
        clone.classList.add(MOD_WILDCARD_CLASS);
        clone.setAttribute(MOD_WILDCARD_ATTR, "1");
      } else {
        clone.classList.remove(MOD_WILDCARD_CLASS);
        clone.removeAttribute(MOD_WILDCARD_ATTR);
      }
    }
  }
  function isWildcardFeatureAvailable() {
    return isAuthConfigured() && settings().isEnabled(settingIds().SCOREBOARD_MOD_GRID);
  }
  function generateModCombinations(enabledMods, wildcardMods) {
    const combos = [];
    const n = wildcardMods.length;
    for (let mask = 0; mask < 1 << n; mask++) {
      const combo = [...enabledMods];
      for (let i = 0; i < n; i++) {
        if (mask & 1 << i) combo.push(wildcardMods[i]);
      }
      combos.push(combo.sort());
    }
    return combos;
  }
  function readBeatmapScoreboardLeaderboardType(scoreboardRoot) {
    const order = ["global", "country", "friend", "team"];
    if (!(scoreboardRoot instanceof HTMLElement)) return "global";
    const tabs = [
      ...scoreboardRoot.querySelectorAll(":scope > .page-tabs > .page-tabs__tab")
    ];
    if (tabs.length) {
      const activeIdx = tabs.findIndex(
        (t) => t.classList.contains("page-tabs__tab--active")
      );
      const mapOrder = tabs.length === 4 ? order : order.filter((t) => t !== "team");
      if (activeIdx >= 0 && activeIdx < mapOrder.length) {
        return (
          /** @type {"global"|"country"|"friend"|"team"} */
          mapOrder[activeIdx]
        );
      }
    }
    const raw = scoreboardRoot.getAttribute("data-scoreboard-state");
    if (raw) {
      try {
        const t = JSON.parse(raw)?.currentType;
        if (t === "global" || t === "country" || t === "friend" || t === "team") {
          return t;
        }
      } catch {
      }
    }
    return "global";
  }
  async function fetchAndMergeWildcardLeaderboards(beatmapId, modCombos, mode, limit, signal, leaderboardType) {
    const type = leaderboardType === "country" || leaderboardType === "friend" || leaderboardType === "team" ? leaderboardType : "global";
    const failures = [];
    const fetches = modCombos.map(
      (mods) => OsuExpertPlus.api.getBeatmapScoresWebsite(
        beatmapId,
        {
          mode,
          type,
          // Omitting mods[] returns every mod combination; NM is required for nomod.
          mods: mods.length ? mods : ["NM"],
          limit
        },
        { signal }
      ).then((res) => res?.scores || []).catch((err) => {
        if (!signal.aborted) failures.push(err);
        return [];
      })
    );
    const results = await Promise.all(fetches);
    if (signal.aborted) return [];
    if (failures.length === modCombos.length) throw failures[0];
    if (failures.length) {
      log4.warn(
        `${failures.length} of ${modCombos.length} mod combinations failed:`,
        failures[0]
      );
    }
    const seen = /* @__PURE__ */ new Set();
    const merged = [];
    for (const scores of results) {
      for (const s of scores) {
        const id = leaderboardScoreId(s);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        merged.push(s);
      }
    }
    sortLeaderboardScoresLikeTable(merged);
    return merged.slice(0, limit);
  }
  function getWildcardEnabledMods(modsEl) {
    const enabled = getMergedEnabledMods(modsEl);
    for (const orig of hiddenOriginals(modsEl)) {
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (isMergedMember(modsEl, ac)) continue;
      const clone = state.originalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (isWildcard(ac)) continue;
      if (isGridCloneOn(clone)) enabled.push(ac);
    }
    return enabled;
  }
  function scheduleWildcardFetch(modsEl) {
    window.clearTimeout(state.wildcardDebounceTimer);
    if (state.wildcardAbortCtrl) {
      state.wildcardAbortCtrl.abort();
      state.wildcardAbortCtrl = null;
      clearWildcardLoadingOverlays();
    }
    const wildcards = getWildcardMods();
    const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard") || document.querySelector(".beatmapset-scoreboard");
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    if (wildcards.length === 0) {
      clearMergedLeaderboard(scoreboardRoot, "wildcard");
      clearWildcardLoadingOverlays();
      syncActiveModsToOriginals(modsEl);
      return;
    }
    const enabledMods = getWildcardEnabledMods(modsEl);
    const beatmapId = getBeatmapPageBeatmapId();
    const mode = getBeatmapPageRuleset();
    if (!beatmapId) return;
    const fetchKey = getWildcardBeatmapKey();
    const combos = generateModCombinations(enabledMods, wildcards);
    state.wildcardLoading = true;
    syncWildcardLoadingOverlay(scoreboardRoot);
    const ctrl = new AbortController();
    state.wildcardAbortCtrl = ctrl;
    const signal = ctrl.signal;
    const removeLoadingOverlay = () => {
      if (state.wildcardAbortCtrl && state.wildcardAbortCtrl.signal !== signal) {
        return;
      }
      clearWildcardLoadingOverlays();
    };
    state.wildcardDebounceTimer = window.setTimeout(() => {
      state.wildcardDebounceTimer = 0;
      const leaderboardType = readBeatmapScoreboardLeaderboardType(scoreboardRoot);
      fetchAndMergeWildcardLeaderboards(
        beatmapId,
        combos,
        mode,
        beatmapScoresLimit(),
        signal,
        leaderboardType
      ).then((merged) => {
        removeLoadingOverlay();
        if (signal.aborted) return;
        if (getWildcardBeatmapKey() !== fetchKey) return;
        if (merged.length > 0) {
          renderMergedLeaderboard(scoreboardRoot, "wildcard", merged);
        } else {
          showMergedNotice(scoreboardRoot, "wildcard", EMPTY_NOTICE);
        }
      }).catch((err) => {
        removeLoadingOverlay();
        if (signal.aborted || getWildcardBeatmapKey() !== fetchKey) return;
        log4.warn("wildcard leaderboard fetch failed:", err);
        showMergedNotice(scoreboardRoot, "wildcard", FAILED_NOTICE);
      });
    }, 1e3);
  }
  function syncActiveModsToOriginals(modsEl) {
    const cloneEnabled = buildBeatmapModGridCloneEnabledSet(modsEl);
    const clickQueue = [];
    for (const orig of hiddenOriginals(modsEl)) {
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      const origOn = isBeatmapScoreboardModStripButtonOn(orig);
      const shouldBeOn = cloneEnabled.has(ac);
      if (origOn !== shouldBeOn) clickQueue.push(orig);
    }
    if (!clickQueue.length) return;
    queueClicks({
      key: "sync-originals",
      next: () => clickQueue.shift() ?? null,
      done: () => {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
      }
    });
  }

  // src/features/scoreboard/mod-filter/merged-cycle.js
  var MERGED_PAIRS = {
    [MERGED_MOD_DT_NC]: {
      a: "DT",
      b: "NC",
      steps: [{}, { on: "DT" }, { on: "NC" }, { wildcard: "DT" }]
    },
    [MERGED_MOD_SD_PF]: {
      a: "SD",
      b: "PF",
      steps: [
        {},
        { on: "SD" },
        { on: "PF" },
        { wildcard: "SD" },
        { wildcard: "PF" }
      ]
    }
  };
  var PLAIN_STEP_COUNT = 3;
  function hasMergedControl(modsEl, mergeId) {
    return Boolean(modsEl.querySelector(`[${MERGED_MOD_ATTR}="${mergeId}"]`));
  }
  function isMergedMember(modsEl, acronym) {
    for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
      if ((acronym === pair.a || acronym === pair.b) && hasMergedControl(modsEl, mergeId)) {
        return true;
      }
    }
    return false;
  }
  function getMergedEnabledMods(modsEl) {
    const out = [];
    for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
      if (!hasMergedControl(modsEl, mergeId)) continue;
      const on = pair.steps[state.mergedStep.get(mergeId) ?? 0]?.on;
      if (on) out.push(on);
    }
    return out;
  }
  function buildBeatmapModGridCloneEnabledSet(modsEl) {
    const set = new Set(getMergedEnabledMods(modsEl));
    for (const orig of hiddenOriginals(modsEl)) {
      const ac = modButtonAcronym(orig);
      if (!ac || ac === "NM") continue;
      if (isMergedMember(modsEl, ac)) continue;
      const clone = state.originalToClone.get(orig);
      if (!(clone instanceof HTMLElement)) continue;
      if (isGridCloneOn(clone)) set.add(ac);
    }
    return set;
  }
  function reconcileMergedModCycleFromDom(modsEl) {
    for (const [mergeId, pair] of Object.entries(MERGED_PAIRS)) {
      if (!hasMergedControl(modsEl, mergeId)) continue;
      const a = findHiddenBeatmapModButton(modsEl, pair.a);
      const b = findHiddenBeatmapModButton(modsEl, pair.b);
      if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) continue;
      let step = 0;
      for (let s = pair.steps.length - 1; s > 0; s--) {
        const { on, wildcard } = pair.steps[s];
        const hit = wildcard ? isWildcard(wildcard) : isBeatmapScoreboardModStripButtonOn(on === pair.a ? a : b);
        if (hit) {
          step = s;
          break;
        }
      }
      state.mergedStep.set(mergeId, step);
    }
  }
  function mergedModGridEffectiveStepCount(mergeId) {
    if (isWildcardFeatureAvailable()) return MERGED_PAIRS[mergeId].steps.length;
    return PLAIN_STEP_COUNT;
  }
  function finishMergedModStepApply(modsEl, mergeId, step) {
    state.mergedStep.set(mergeId, step);
    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
    scheduleWildcardFetch(modsEl);
  }
  function applyMergedModTargetStep(modsEl, mergeId, targetStep) {
    const pair = MERGED_PAIRS[mergeId];
    if (!pair) return;
    const buttons = {
      [pair.a]: findHiddenBeatmapModButton(modsEl, pair.a),
      [pair.b]: findHiddenBeatmapModButton(modsEl, pair.b)
    };
    if (!(buttons[pair.a] instanceof HTMLElement)) return;
    if (!(buttons[pair.b] instanceof HTMLElement)) return;
    state.mergedTarget.set(mergeId, targetStep);
    if (hasQueuedClicks(mergeId)) return;
    const goal = () => pair.steps[state.mergedTarget.get(mergeId) ?? 0] ?? pair.steps[0];
    queueClicks({
      key: mergeId,
      next: () => {
        const { on, wildcard } = goal();
        for (const ac of [pair.a, pair.b]) {
          if (ac !== wildcard && isWildcard(ac)) disableWildcard(ac, modsEl);
        }
        for (const ac of [pair.b, pair.a]) {
          if (ac === on) continue;
          if (isBeatmapScoreboardModStripButtonOn(buttons[ac]))
            return buttons[ac];
        }
        if (on && !isBeatmapScoreboardModStripButtonOn(buttons[on])) {
          return buttons[on];
        }
        return null;
      },
      done: (completed) => {
        const step = state.mergedTarget.get(mergeId) ?? targetStep;
        state.mergedTarget.delete(mergeId);
        const { wildcard } = pair.steps[step] ?? pair.steps[0];
        if (completed && wildcard && !isWildcard(wildcard) && isWildcardFeatureAvailable()) {
          enableWildcard(wildcard, modsEl);
          updateCloneWildcardVisual(wildcard, modsEl, true);
        }
        finishMergedModStepApply(modsEl, mergeId, step);
      }
    });
  }
  function syncMergedModCloneHighlights(modsEl, clone, mergeId) {
    if (!(clone instanceof HTMLElement)) return;
    const pair = MERGED_PAIRS[mergeId];
    if (!pair) return;
    const a = findHiddenBeatmapModButton(modsEl, pair.a);
    const b = findHiddenBeatmapModButton(modsEl, pair.b);
    if (!(a instanceof HTMLElement) || !(b instanceof HTMLElement)) return;
    const byAc = { [pair.a]: a, [pair.b]: b };
    const step = state.mergedStep.get(mergeId) ?? 0;
    for (let s = pair.steps.length - 1; s > 0; s--) {
      const wc = pair.steps[s].wildcard;
      if (!wc || step !== s && !isWildcard(wc)) continue;
      const src2 = byAc[wc];
      replaceBeatmapModGridCloneInnerHTML(clone, src2);
      clone.disabled = src2.disabled;
      setGridCloneOn(clone, false);
      setCloneWildcardClass(clone, true);
      return;
    }
    setCloneWildcardClass(clone, false);
    const enabled = pair.steps[step]?.on;
    const src = enabled ? byAc[enabled] : a;
    replaceBeatmapModGridCloneInnerHTML(clone, src);
    clone.disabled = src.disabled;
    if (getWildcardMods().length > 0) {
      setGridCloneOn(
        clone,
        enabled ? isBeatmapScoreboardModStripButtonOn(src) : false
      );
      return;
    }
    if (clone.className !== src.className) clone.className = src.className;
    for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
      const v = src.getAttribute(attr);
      if (v == null) clone.removeAttribute(attr);
      else clone.setAttribute(attr, v);
    }
  }

  // src/features/scoreboard/mod-filter/grid.js
  function resetBeatmapScoreboardModSelection(modsEl) {
    cancelClicks();
    state.mergedStep.clear();
    state.mergedTarget.clear();
    const hadWildcards = getWildcardMods().length > 0;
    if (hadWildcards) {
      clearWildcardState();
      for (const orig of hiddenOriginals(modsEl)) {
        const ac = modButtonAcronym(orig);
        if (!ac) continue;
        updateCloneWildcardVisual(ac, modsEl, false);
      }
      const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
      if (scoreboardRoot instanceof HTMLElement) {
        clearMergedLeaderboard(scoreboardRoot, "wildcard");
      }
    }
    for (const orig of hiddenOriginals(modsEl)) {
      const clone = state.originalToClone.get(orig);
      if (clone instanceof HTMLElement) setGridCloneOn(clone, false);
    }
    queueClicks({
      key: "reset",
      next: () => hiddenOriginals(modsEl).find((btn) => {
        const ac = modButtonAcronym(btn);
        return ac && ac !== "NM" && isBeatmapScoreboardModStripButtonOn(btn);
      }) ?? null,
      done: () => {
        syncBeatmapModGridCloneHighlights(modsEl);
        syncBeatmapScoreboardModResetButton(modsEl);
      }
    });
  }
  function syncBeatmapScoreboardModResetButton(modsEl) {
    const resetBtn = modsEl.querySelector(
      `:scope > .${MOD_GRID_CLASS}__hdr-corner .${MOD_GRID_CLASS}__reset-mods`
    );
    if (!(resetBtn instanceof HTMLButtonElement)) return;
    const root = modsEl.closest(".beatmapset-scoreboard");
    const active = root instanceof HTMLElement ? getActiveBeatmapScoreboardFilterMods(root) : [];
    const hasWildcards = getWildcardMods().length > 0;
    const hasEnabledInWildcardMode = hasWildcards && getWildcardEnabledMods(modsEl).length > 0;
    resetBtn.disabled = active.length === 0 && !hasWildcards && !hasEnabledInWildcardMode;
  }
  function replaceBeatmapModGridCloneInnerHTML(clone, original) {
    if (!(clone instanceof HTMLElement) || !(original instanceof HTMLElement))
      return;
    if (clone.innerHTML === original.innerHTML) return;
    destroyOsuWebQtipOnElementSubtree(clone);
    clone.innerHTML = original.innerHTML;
  }
  function syncBeatmapModGridCloneHighlights(modsEl) {
    if (!modsEl.hasAttribute(MOD_GRID_ATTR)) return;
    const hasActiveWildcards = getWildcardMods().length > 0;
    for (const clone of modsEl.querySelectorAll(`[${MERGED_MOD_ATTR}]`)) {
      if (!(clone instanceof HTMLElement)) continue;
      const mergeId = clone.getAttribute(MERGED_MOD_ATTR);
      if (mergeId) syncMergedModCloneHighlights(modsEl, clone, mergeId);
    }
    for (const original of hiddenOriginals(modsEl)) {
      const ac = modButtonAcronym(original);
      if (isMergedMember(modsEl, ac)) continue;
      const clone = state.originalToClone.get(original);
      if (!(clone instanceof HTMLElement)) continue;
      if (ac && isWildcard(ac)) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        setGridCloneOn(clone, false);
        setCloneWildcardClass(clone, true);
        continue;
      }
      if (hasActiveWildcards) {
        replaceBeatmapModGridCloneInnerHTML(clone, original);
        clone.disabled = original.disabled;
        setGridCloneOn(clone, isBeatmapScoreboardModStripButtonOn(original));
        setCloneWildcardClass(clone, false);
        continue;
      }
      if (clone.className !== original.className) {
        clone.className = original.className;
      }
      for (const attr of ["aria-pressed", "aria-disabled", "title"]) {
        const v = original.getAttribute(attr);
        if (v == null) clone.removeAttribute(attr);
        else clone.setAttribute(attr, v);
      }
      clone.disabled = original.disabled;
      replaceBeatmapModGridCloneInnerHTML(clone, original);
      setCloneWildcardClass(clone, false);
    }
  }
  function stopBeatmapScoreboardModGridLive(modsEl) {
    cancelClicks();
    state.mergedTarget.clear();
    teardownBeatmapModGrid(modsEl);
  }
  function teardownBeatmapModGrid(modsEl) {
    if (!(modsEl instanceof HTMLElement)) return;
    clearWildcardState();
    const scoreboardRoot = modsEl.closest(".beatmapset-scoreboard");
    if (scoreboardRoot instanceof HTMLElement) {
      clearMergedLeaderboard(scoreboardRoot, "wildcard");
    }
    modsEl.removeAttribute(MOD_GRID_ATTR);
    modsEl.classList.remove(MOD_GRID_CLASS, MOD_GRID_COLLAPSED_CLASS);
    for (const btn of modsEl.querySelectorAll(`:scope > [${MOD_HIDDEN_ATTR}]`)) {
      btn.removeAttribute(MOD_HIDDEN_ATTR);
    }
    for (const ch of [...modsEl.children]) {
      if (!ch.classList.contains("beatmap-scoreboard-mod")) {
        ch.remove();
      }
    }
  }
  function placeBeatmapModGridSingleClone(modsEl, piles, btn, pileKey) {
    const clone = btn.cloneNode(true);
    state.originalToClone.set(btn, clone);
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const ac = modButtonAcronym(btn);
      if (!ac || ac === "NM" || !isWildcardFeatureAvailable()) {
        btn.click();
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
        return;
      }
      const hasWildcards = getWildcardMods().length > 0;
      const isCurrentlyWildcard = isWildcard(ac);
      const cloneIsEnabled = isGridCloneOn(clone);
      if (isCurrentlyWildcard) {
        disableWildcard(ac, modsEl);
        setGridCloneOn(clone, false);
        scheduleWildcardFetch(modsEl);
      } else if (cloneIsEnabled) {
        if (!hasWildcards) {
          btn.click();
        }
        enableWildcard(ac, modsEl);
        updateCloneWildcardVisual(ac, modsEl, true);
        setGridCloneOn(clone, false);
        window.requestAnimationFrame(() => {
          syncBeatmapModGridCloneHighlights(modsEl);
        });
        scheduleWildcardFetch(modsEl);
      } else {
        if (hasWildcards) {
          setGridCloneOn(clone, true);
          scheduleWildcardFetch(modsEl);
        } else {
          btn.click();
          window.requestAnimationFrame(() => {
            syncBeatmapModGridCloneHighlights(modsEl);
          });
        }
      }
      syncBeatmapScoreboardModResetButton(modsEl);
    });
    piles[pileKey]?.appendChild(clone);
    btn.setAttribute(MOD_HIDDEN_ATTR, "1");
  }
  function placeBeatmapModGridMergedPair(modsEl, piles, mergeId, primaryOriginal, secondaryOriginal, pileKey) {
    const clone = primaryOriginal.cloneNode(true);
    clone.setAttribute(MERGED_MOD_ATTR, mergeId);
    state.originalToClone.set(primaryOriginal, clone);
    state.originalToClone.set(secondaryOriginal, clone);
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const max = mergedModGridEffectiveStepCount(mergeId);
      const cur = state.mergedTarget.get(mergeId) ?? state.mergedStep.get(mergeId) ?? 0;
      applyMergedModTargetStep(modsEl, mergeId, (cur + 1) % max);
    });
    piles[pileKey]?.appendChild(clone);
    primaryOriginal.setAttribute(MOD_HIDDEN_ATTR, "1");
    secondaryOriginal.setAttribute(MOD_HIDDEN_ATTR, "1");
  }
  function placeBeatmapModGridButtons(modsEl, piles) {
    const directList = [
      ...modsEl.querySelectorAll(":scope > .beatmap-scoreboard-mod")
    ];
    const byAc = /* @__PURE__ */ new Map();
    for (const btn of directList) {
      if (!(btn instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(btn);
      if (ac) byAc.set(ac, btn);
    }
    const STABLE_R0 = ["EZ", "NF", "HT"];
    const placedStable = /* @__PURE__ */ new Set();
    for (const ac of STABLE_R0) {
      const b = byAc.get(ac);
      if (b) {
        placeBeatmapModGridSingleClone(modsEl, piles, b, "r0-stable");
        placedStable.add(ac);
      }
    }
    for (const ac of ["HR", "HD"]) {
      const b = byAc.get(ac);
      if (b) {
        placeBeatmapModGridSingleClone(modsEl, piles, b, "r1-stable");
        placedStable.add(ac);
      }
    }
    const dtB = byAc.get("DT");
    const ncB = byAc.get("NC");
    if (dtB && ncB) {
      placeBeatmapModGridMergedPair(
        modsEl,
        piles,
        MERGED_MOD_DT_NC,
        dtB,
        ncB,
        "r1-stable"
      );
      placedStable.add("DT");
      placedStable.add("NC");
    } else {
      if (dtB) {
        placeBeatmapModGridSingleClone(modsEl, piles, dtB, "r1-stable");
        placedStable.add("DT");
      }
      if (ncB) {
        placeBeatmapModGridSingleClone(modsEl, piles, ncB, "r1-stable");
        placedStable.add("NC");
      }
    }
    const flB = byAc.get("FL");
    if (flB) {
      placeBeatmapModGridSingleClone(modsEl, piles, flB, "r1-stable");
      placedStable.add("FL");
    }
    const sdB = byAc.get("SD");
    const pfB = byAc.get("PF");
    if (sdB && pfB) {
      placeBeatmapModGridMergedPair(
        modsEl,
        piles,
        MERGED_MOD_SD_PF,
        sdB,
        pfB,
        "r1-stable"
      );
      placedStable.add("SD");
      placedStable.add("PF");
    } else {
      if (sdB) {
        placeBeatmapModGridSingleClone(modsEl, piles, sdB, "r1-stable");
        placedStable.add("SD");
      }
      if (pfB) {
        placeBeatmapModGridSingleClone(modsEl, piles, pfB, "r1-stable");
        placedStable.add("PF");
      }
    }
    const nmLeft = byAc.get("NM");
    if (nmLeft && !placedStable.has("NM")) {
      placeBeatmapModGridSingleClone(modsEl, piles, nmLeft, "r2-stable");
      placedStable.add("NM");
    }
    for (const btn of directList) {
      if (!(btn instanceof HTMLElement)) continue;
      const ac = modButtonAcronym(btn);
      if (!ac) continue;
      if (placedStable.has(ac)) continue;
      if (!STABLE_MOD_ACRONYMS2.has(ac)) {
        const modInner = btn.querySelector(".mod");
        const row = modInner instanceof HTMLElement ? modDifficultyRow(modInner) : 2;
        const key = `r${row}-lazer`;
        placeBeatmapModGridSingleClone(modsEl, piles, btn, key);
        continue;
      }
      placeBeatmapModGridSingleClone(modsEl, piles, btn, "r2-stable");
    }
  }
  function applyBeatmapModGrid(modsEl, elFn) {
    const directButtons = modsEl.querySelectorAll(
      ":scope > .beatmap-scoreboard-mod"
    );
    if (!directButtons.length) return;
    teardownBeatmapModGrid(modsEl);
    modsEl.setAttribute(MOD_GRID_ATTR, "1");
    const collapseToggle = elFn(
      "button",
      {
        type: "button",
        class: `${MOD_GRID_CLASS}__collapse-toggle`,
        "aria-expanded": "true",
        "aria-label": "Collapse mod filter grid"
      },
      elFn("span", { class: `${MOD_GRID_CLASS}__collapse-label` }, "Mod filters"),
      elFn("i", { class: "fas fa-chevron-down", "aria-hidden": "true" })
    );
    const toggleRow = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__toggle-row` },
      collapseToggle
    );
    collapseToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const collapsed = modsEl.classList.toggle(MOD_GRID_COLLAPSED_CLASS);
      collapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      collapseToggle.setAttribute(
        "aria-label",
        collapsed ? "Expand mod filter grid" : "Collapse mod filter grid"
      );
    });
    const headStable = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__hdr-stable` },
      "Stable mods"
    );
    const corner = elFn("div", { class: `${MOD_GRID_CLASS}__hdr-corner` });
    const resetModsBtn = elFn(
      "button",
      {
        type: "button",
        class: `${MOD_GRID_CLASS}__reset-mods`,
        title: "Clear all selected mod filters",
        "aria-label": "Reset mod selection — turn off each selected mod"
      },
      "Reset"
    );
    resetModsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetBeatmapScoreboardModSelection(modsEl);
    });
    corner.appendChild(resetModsBtn);
    const headLazer = elFn(
      "div",
      {
        class: `${MOD_GRID_CLASS}__colhead ${MOD_GRID_CLASS}__colhead--lazer ${MOD_GRID_CLASS}__hdr-lazer`
      },
      elFn("span", {}, "Lazer mods")
    );
    const label0 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r0-label` },
      "Difficulty decrease mods"
    );
    const label1 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r1-label` },
      "Difficulty increase mods"
    );
    const label2 = elFn(
      "div",
      { class: `${MOD_GRID_CLASS}__label ${MOD_GRID_CLASS}__r2-label` },
      "For fun mods"
    );
    const piles = {
      "r0-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-stable`
      }),
      "r0-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r0-lazer`
      }),
      "r1-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-stable`
      }),
      "r1-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r1-lazer`
      }),
      "r2-stable": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-stable`
      }),
      "r2-lazer": elFn("div", {
        class: `${MOD_GRID_CLASS}__pile ${MOD_GRID_CLASS}__r2-lazer`
      })
    };
    const frag = document.createDocumentFragment();
    for (const node of [
      toggleRow,
      corner,
      headStable,
      headLazer,
      label0,
      label1,
      label2,
      piles["r0-stable"],
      piles["r0-lazer"],
      piles["r1-stable"],
      piles["r1-lazer"],
      piles["r2-stable"],
      piles["r2-lazer"]
    ]) {
      frag.appendChild(node);
    }
    modsEl.appendChild(frag);
    placeBeatmapModGridButtons(modsEl, piles);
    if (isAuthConfigured()) {
      piles["r2-stable"].appendChild(
        elFn(
          "div",
          {
            class: `${MOD_GRID_CLASS}__wildcard-guide`,
            role: "note"
          },
          elFn(
            "div",
            { class: `${MOD_GRID_CLASS}__wildcard-guide-row` },
            elFn("span", {
              class: `${MOD_GRID_CLASS}__wildcard-guide-icon`,
              "aria-hidden": "true"
            }),
            elFn(
              "p",
              { class: `${MOD_GRID_CLASS}__wildcard-guide-text` },
              elFn("strong", {}, "Wildcard"),
              ": click an enabled mod again. Wildcard mods ",
              elFn("strong", {}, "may or may not"),
              " appear on each score."
            )
          )
        )
      );
    }
    reconcileMergedModCycleFromDom(modsEl);
    syncBeatmapModGridCloneHighlights(modsEl);
    syncBeatmapScoreboardModResetButton(modsEl);
  }
  var HIDDEN_ORIGINAL_TREE_SEL = `.beatmapset-scoreboard__mods > [${MOD_HIDDEN_ATTR}], .beatmapset-scoreboard__mods > [${MOD_HIDDEN_ATTR}] *`;
  async function setupBeatmapScoreboardModGrid() {
    if (!settings().isEnabled(settingIds().SCOREBOARD_MOD_GRID)) {
      return () => {
      };
    }
    let modsEl;
    try {
      modsEl = await waitForElement(SCOREBOARD_MODS_SEL, 2e4);
    } catch {
      return () => {
      };
    }
    if (!(modsEl instanceof HTMLElement) || !document.body.contains(modsEl)) {
      return () => {
      };
    }
    const grid = modsEl;
    const scoreboardRoot = grid.closest(".beatmapset-scoreboard");
    const ac = new AbortController();
    const { signal } = ac;
    observe.subscribe(
      {
        selector: ".beatmap-scoreboard-mod",
        schedule: 0,
        signal,
        label: "scoreboard/mod-grid"
      },
      () => {
        if (!document.body.contains(grid)) return;
        try {
          if (grid.querySelector(
            `:scope > .beatmap-scoreboard-mod:not([${MOD_HIDDEN_ATTR}])`
          )) {
            applyBeatmapModGrid(grid, el);
          }
        } catch (_) {
        }
      }
    );
    const onScoreboardTabClick = (e) => {
      const tab = e.target?.closest?.(".page-tabs__tab");
      if (!(tab instanceof HTMLElement)) return;
      if (!(scoreboardRoot instanceof HTMLElement) || !scoreboardRoot.contains(tab)) {
        return;
      }
      if (getWildcardMods().length > 0) scheduleWildcardFetch(grid);
    };
    if (scoreboardRoot instanceof HTMLElement) {
      scoreboardRoot.addEventListener("click", onScoreboardTabClick, {
        capture: true,
        signal
      });
      let wildcardBeatmapKey = getWildcardBeatmapKey();
      const refetchIfBeatmapChanged = () => {
        const key = getWildcardBeatmapKey();
        if (key === wildcardBeatmapKey) return;
        wildcardBeatmapKey = key;
        if (getWildcardMods().length === 0) return;
        clearMergedLeaderboard(scoreboardRoot, "wildcard");
        scheduleWildcardFetch(grid);
      };
      observe.subscribe(
        {
          selector: ".beatmap-scoreboard-table, .beatmap-scoreboard-table__body-row, .beatmapset-scoreboard__notice",
          schedule: "sync",
          signal,
          label: "scoreboard/wildcard-beatmap"
        },
        () => {
          syncWildcardLoadingOverlay(scoreboardRoot);
          refetchIfBeatmapChanged();
        }
      );
      observe.subscribe(
        {
          selector: ".beatmapset-beatmap-picker, .beatmapset-beatmap-picker__beatmap",
          attributes: ["class"],
          schedule: 16,
          signal,
          label: "scoreboard/wildcard-picker"
        },
        refetchIfBeatmapChanged
      );
    }
    applyBeatmapModGrid(grid, el);
    observe.subscribe(
      {
        selector: HIDDEN_ORIGINAL_TREE_SEL,
        attributes: ["class", "aria-pressed", "aria-disabled", "title"],
        characterData: true,
        schedule: 0,
        signal,
        label: "scoreboard/mod-grid-state"
      },
      () => {
        if (!document.body.contains(grid)) return;
        syncBeatmapModGridCloneHighlights(grid);
        syncBeatmapScoreboardModResetButton(grid);
      }
    );
    const onCredsChange = () => {
      if (isAuthConfigured()) return;
      clearWildcardState();
      if (scoreboardRoot instanceof HTMLElement) {
        clearMergedLeaderboard(scoreboardRoot, "wildcard");
      }
      syncBeatmapModGridCloneHighlights(grid);
      syncBeatmapScoreboardModResetButton(grid);
    };
    window.addEventListener(CREDENTIALS_CHANGED_EVENT, onCredsChange, {
      signal
    });
    return () => {
      ac.abort();
      clearWildcardState();
      cancelClicks();
      if (document.body.contains(grid)) stopBeatmapScoreboardModGridLive(grid);
      resetModFilterState();
    };
  }
  function mountScoreboardModGrid(pathRe) {
    let disposed = false;
    let dispose = null;
    setupBeatmapScoreboardModGrid().then((d) => {
      if (disposed || !pathRe.test(location.pathname)) {
        try {
          d();
        } catch (_) {
        }
        return;
      }
      dispose = d;
    });
    return () => {
      disposed = true;
      try {
        dispose?.();
      } catch (_) {
      }
      dispose = null;
      const strip = document.querySelector(SCOREBOARD_MODS_SEL);
      if (strip instanceof HTMLElement) stopBeatmapScoreboardModGridLive(strip);
    };
  }

  // src/features/scoreboard/player-lookup.js
  function clearLookupResults(scoreboardRoot, rescheduleWildcard = true) {
    if (!(scoreboardRoot instanceof HTMLElement)) return;
    clearMergedLeaderboard(scoreboardRoot, "lookup");
    if (!rescheduleWildcard) return;
    const mods = scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
    if (mods instanceof HTMLElement && getWildcardMods().length > 0) {
      scheduleWildcardFetch(mods);
    }
  }
  function lookupErrorStatus(err, stage) {
    const status = (
      /** @type {{ status?: number }} */
      err?.status
    );
    if (status === 401 || status === 403) {
      return "osu! API authorization failed. Check the OAuth credentials in Expert+ settings.";
    }
    if (status === 429) return "Too many requests. Try again in a moment.";
    if (status === 404) {
      return stage === "user" ? "Player not found." : "No score found on this difficulty.";
    }
    return status == null ? "Search failed. Try again later." : `Search failed (HTTP ${status}). Try again later.`;
  }
  function getLoggedInUsernameFromNav() {
    const link = document.querySelector("a.u-current-user-cover");
    if (!(link instanceof HTMLAnchorElement)) return null;
    return link.querySelector(".u-relative")?.textContent?.trim() || null;
  }
  function startBeatmapScoreUserSearchManager(pathRe) {
    const MARKER_ATTR = SCOREBOARD_USER_SEARCH_ATTR;
    const NO_API_STATUS = "Add osu! API OAuth credentials in Expert+ settings to search players.";
    let debounceTimer = 0;
    let resultKey = null;
    const beatmapKey = () => `${getBeatmapPageRuleset()}/${getBeatmapPageBeatmapId() || ""}`;
    const resetBarState = () => {
      const wrap = document.querySelector(`[${MARKER_ATTR}]`);
      if (!(wrap instanceof HTMLElement)) return;
      const statusEl = wrap.querySelector(".oep-user-search__status");
      const resetBtn = wrap.querySelector(".oep-user-search__btn--reset");
      setTextIfChanged(statusEl, "");
      if (resetBtn instanceof HTMLElement) setHiddenIfChanged(resetBtn, true);
    };
    const hasUserSearchResultRows = (scoreboardRoot) => scoreboardRoot instanceof HTMLElement && !!scoreboardRoot.querySelector(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`);
    const cleanup = () => {
      document.querySelectorAll(".beatmapset-scoreboard").forEach((el2) => {
        if (hasUserSearchResultRows(el2)) {
          clearLookupResults(el2, false);
        }
      });
      document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((n) => n.remove());
      removeEmptyBeatmapScoreboardToolsRows();
    };
    const syncPlayerLookupSearchBarApiState = (wrap) => {
      if (!(wrap instanceof HTMLElement)) return;
      const input = wrap.querySelector(".oep-user-search__input");
      const goBtn = wrap.querySelector(".oep-user-search__btn--go");
      const resetBtn = wrap.querySelector(".oep-user-search__btn--reset");
      const statusEl = wrap.querySelector(".oep-user-search__status");
      const configured = isAuthConfigured();
      wrap.classList.toggle("oep-user-search--no-api", !configured);
      if (input instanceof HTMLInputElement && input.disabled !== !configured) {
        input.disabled = !configured;
      }
      if (goBtn instanceof HTMLButtonElement && goBtn.disabled !== !configured) {
        goBtn.disabled = !configured;
      }
      if (!configured) {
        if (resetBtn instanceof HTMLElement) setHiddenIfChanged(resetBtn, true);
        if (input instanceof HTMLInputElement && input.value) input.value = "";
        setTextIfChanged(statusEl, NO_API_STATUS);
        const boardRoot = findBeatmapScoreboardRoot();
        if (hasUserSearchResultRows(boardRoot)) {
          clearLookupResults(boardRoot, false);
        }
      } else if (statusEl && statusEl.textContent === NO_API_STATUS) {
        statusEl.textContent = "";
      }
    };
    const ensureSearchBar = (root) => {
      const existing = root.querySelector(`[${MARKER_ATTR}]`) || document.querySelector(`[${MARKER_ATTR}]`);
      if (existing instanceof HTMLElement) {
        if (!isPlayerLookupSearchBarPlacedCorrectly(root, existing)) {
          insertBeatmapScoreUserSearchBar(root, existing);
        }
        syncPlayerLookupSearchBarApiState(existing);
        return;
      }
      const searchInput = el("input", {
        type: "text",
        class: "oep-user-search__input",
        placeholder: getLoggedInUsernameFromNav() || "Look up a player…",
        "aria-label": "Search player on leaderboard",
        autocomplete: "off",
        spellcheck: "false"
      });
      const searchBtn = el(
        "button",
        {
          type: "button",
          class: "oep-user-search__btn oep-user-search__btn--go"
        },
        "Search"
      );
      const resetBtn = el(
        "button",
        {
          type: "button",
          class: "oep-user-search__btn oep-user-search__btn--reset",
          hidden: "",
          "aria-label": "Clear search result"
        },
        "Reset"
      );
      const statusEl = el("div", {
        class: "oep-user-search__status",
        "aria-live": "polite"
      });
      const wrap = el(
        "div",
        { class: "oep-user-search", [MARKER_ATTR]: "1" },
        el(
          "div",
          { class: "oep-user-search__bar" },
          searchInput,
          searchBtn,
          resetBtn
        ),
        statusEl
      );
      const doReset = () => {
        const boardRoot = findBeatmapScoreboardRoot();
        resultKey = null;
        clearLookupResults(boardRoot);
        searchInput.value = "";
        statusEl.textContent = "";
        resetBtn.hidden = true;
        searchInput.focus();
      };
      let searching = false;
      const doSearch = async () => {
        if (searching) return;
        const username = searchInput.value.trim() || getLoggedInUsernameFromNav() || "";
        if (!username) return;
        if (!isAuthConfigured()) {
          statusEl.textContent = "API credentials required. Configure them in the settings (Client ID + Secret).";
          resetBtn.hidden = false;
          return;
        }
        const beatmapId = getBeatmapPageBeatmapId();
        if (!beatmapId) return;
        const key = beatmapKey();
        const stale = () => beatmapKey() !== key;
        searching = true;
        searchBtn.disabled = true;
        statusEl.textContent = "Searching…";
        let stage = "user";
        try {
          const user = await OsuExpertPlus.api.getUserByName(username).catch(
            (err) => err?.status === 404 && /^\d+$/.test(username) ? OsuExpertPlus.api.getUser(username) : Promise.reject(err)
          );
          if (!user?.id)
            throw Object.assign(new Error("user not found"), { status: 404 });
          if (stale()) {
            statusEl.textContent = "";
            return;
          }
          stage = "scores";
          const ruleset = getBeatmapPageRuleset();
          const scoreboardRoot = findBeatmapScoreboardRoot();
          const data = await OsuExpertPlus.api.getBeatmapUserScoresAll(
            beatmapId,
            user.id,
            { ruleset, legacy_only: 0 }
          );
          if (stale()) {
            statusEl.textContent = "";
            return;
          }
          const rawList = Array.isArray(data?.scores) ? data.scores : [];
          if (!rawList.length)
            throw Object.assign(new Error("no score"), { status: 404 });
          const userCompact = {
            id: user.id,
            username: user.username,
            country_code: user.country_code,
            country: user.country
          };
          const scores = rawList.map(
            (s) => s && typeof s === "object" && !s.user ? { ...s, user: userCompact } : s
          );
          const ok = scoreboardRoot instanceof HTMLElement && renderMergedLeaderboard(scoreboardRoot, "lookup", scores, {
            team: user.team,
            beforeInsert: cancelWildcardFetch
          });
          if (ok) {
            resultKey = key;
            statusEl.textContent = "";
          } else {
            statusEl.textContent = "Scores found but leaderboard is not ready yet.";
          }
          resetBtn.hidden = false;
        } catch (err) {
          if (stale()) {
            statusEl.textContent = "";
            return;
          }
          statusEl.textContent = lookupErrorStatus(err, stage);
          resultKey = null;
          const boardRoot = findBeatmapScoreboardRoot();
          if (hasUserSearchResultRows(boardRoot)) clearLookupResults(boardRoot);
          resetBtn.hidden = false;
        } finally {
          searching = false;
          searchBtn.disabled = !isAuthConfigured();
        }
      };
      searchBtn.addEventListener("click", doSearch);
      resetBtn.addEventListener("click", doReset);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
      insertBeatmapScoreUserSearchBar(root, wrap);
      syncPlayerLookupSearchBarApiState(wrap);
    };
    const run = () => {
      if (!pathRe.test(location.pathname)) {
        cleanup();
        return;
      }
      if (!settings().isEnabled(settingIds().SCOREBOARD_PLAYER_LOOKUP)) {
        cleanup();
        return;
      }
      const root = findBeatmapScoreboardRoot();
      if (!(root instanceof HTMLElement)) return;
      ensureSearchBar(root);
    };
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(run, 16);
    };
    const OSU_API_CREDS_CHANGE = CREDENTIALS_CHANGED_EVENT;
    const onOsuApiCredsChange = () => schedule();
    window.addEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);
    const unsubLookup = settings().onChange(
      settingIds().SCOREBOARD_PLAYER_LOOKUP,
      () => schedule()
    );
    const unsubscribe = observe.subscribe(
      {
        selector: TOOLS_ROW_WATCH_SEL,
        schedule: 16,
        label: "scoreboard/player-lookup"
      },
      run
    );
    const dropIfBeatmapChanged = () => {
      if (resultKey == null || beatmapKey() === resultKey) return;
      resultKey = null;
      const boardRoot = findBeatmapScoreboardRoot();
      if (hasUserSearchResultRows(boardRoot))
        clearLookupResults(boardRoot, false);
      resetBarState();
    };
    const unsubscribeBeatmap = observe.subscribe(
      {
        selector: ".beatmap-scoreboard-table, .beatmap-scoreboard-table__body-row, .beatmapset-scoreboard__notice",
        schedule: 16,
        label: "scoreboard/player-lookup-beatmap"
      },
      dropIfBeatmapChanged
    );
    const unsubscribePicker = observe.subscribe(
      {
        selector: ".beatmapset-beatmap-picker, .beatmapset-beatmap-picker__beatmap",
        attributes: ["class"],
        schedule: 16,
        label: "scoreboard/player-lookup-picker"
      },
      dropIfBeatmapChanged
    );
    schedule();
    return () => {
      unsubscribeBeatmap();
      unsubscribePicker();
      unsubLookup();
      window.removeEventListener(OSU_API_CREDS_CHANGE, onOsuApiCredsChange);
      window.clearTimeout(debounceTimer);
      unsubscribe();
      cleanup();
    };
  }

  // src/features/scoreboard/styles.js
  var SCOREBOARD_STYLE_ID = "osu-expertplus-beatmap-scoreboard-css";
  var SCOREBOARD_CSS = `
  /* Wildcard loading overlay on the scoreboard table */
  .${WILDCARD_LOADING_CLASS} {
    position: relative;
    pointer-events: none;
    opacity: 0.45;
    transition: opacity 0.15s ease;
  }
  .${WILDCARD_LOADING_CLASS}::after {
    content: "Loading mod combinations…";
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: hsl(0 0% 85%);
    pointer-events: none;
    z-index: 5;
  }
  /*
   * Beatmap leaderboard hit columns (GREAT/OK/MEH/MISS etc.) — same palette as
   * user-profile score card .oep-score-stats__val--* (see user-profile.js).
   */
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--300 * {
    color: #78dcff;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--100 * {
    color: #84e03a;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--50 * {
    color: #e0b03a;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--miss * {
    color: #e05c5c;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--300 {
    color: #78dcff;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--100 {
    color: #84e03a;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--50 {
    color: #e0b03a;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--miss {
    color: #e05c5c;
  }
  /* CTB hit columns (L / DRP) */
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-l * {
    color: #5eead4;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--ctb-drp * {
    color: #93c5fd;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-l {
    color: #5eead4;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--ctb-drp {
    color: #93c5fd;
  }
  /* Mania PERFECT / GOOD */
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-perfect * {
    color: #ffd966;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good,
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th.oep-score-stats__val--mania-good * {
    color: #7dd87a;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-perfect {
    color: #ffd966;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-score-stats__val--mania-good {
    color: #7dd87a;
  }
  /* PP column — all rulesets */
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table td.beatmap-scoreboard-table__cell .oep-beatmap-scoreboard-pp-value {
    color: #c4b5fd;
  }
  /* Global rank badge next to the leaderboard username. */
  .oep-scoreboard-rank-badge {
    display: inline-flex;
    align-items: baseline;
    margin-left: 0.4em;
    padding: 0.05em 0.45em;
    border-radius: 999px;
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--hsl-l1, 0 0% 80%));
    background: hsla(0, 0%, 100%, 0.08);
    vertical-align: middle;
  }
  /* Prevent overflow when the mod extender tab sits next to the icon. */
  .beatmapset-scoreboard .beatmap-scoreboard-table__mods .beatmap-scoreboard-mod {
    overflow: visible;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort {
    display: inline-block;
    margin-left: 0.28em;
    padding: 0 1px;
    vertical-align: middle;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.32);
    cursor: pointer;
    font: inherit;
    font-size: 0.62em;
    line-height: 1;
    position: relative;
    top: -0.06em;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:hover {
    color: rgba(255, 255, 255, 0.55);
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort--active {
    color: #8fd4ff;
  }
  .beatmapset-scoreboard table.beatmap-scoreboard-table__table th .oep-scoreboard-th-sort:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.45);
    outline-offset: 1px;
    border-radius: 2px;
  }
  .oep-scoreboard-tools-row {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 1.25rem;
    margin: 0 0 0.75rem 0;
    width: 100%;
  }
  .oep-scoreboard-tools-row .oep-user-search {
    margin: 0;
    flex: 1 1 14rem;
    min-width: 0;
  }
  .oep-scoreboard-tools-row .oep-rate-edit-filter {
    margin: 0;
    flex: 0 0 auto;
    max-width: none;
    padding-top: 7px;
  }
  .oep-rate-edit-filter {
    box-sizing: border-box;
    margin: 0 0 0.5rem 0;
    max-width: 34rem;
  }
  .oep-rate-edit-filter label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.65);
    user-select: none;
  }
  .oep-rate-edit-filter input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    accent-color: #66ccff;
  }
  /* Beatmap scoreboard user search */
  .oep-user-search {
    box-sizing: border-box;
    margin: 0 0 1rem 0;
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 100%;
  }
  .oep-user-search__bar {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 34rem;
  }
  .oep-user-search__input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.92);
    font: inherit;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .oep-user-search__input:focus {
    border-color: rgba(102, 204, 255, 0.5);
    background: rgba(255, 255, 255, 0.09);
  }
  .oep-user-search__input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }
  .oep-user-search__btn {
    flex-shrink: 0;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .oep-user-search__btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.92);
  }
  .oep-user-search__btn:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.4);
    outline-offset: 1px;
  }
  .oep-user-search__btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .oep-user-search__btn--go {
    background: rgba(102, 204, 255, 0.12);
    border-color: rgba(102, 204, 255, 0.3);
    color: #8fd4ff;
  }
  .oep-user-search__btn--go:hover:not(:disabled) {
    background: rgba(102, 204, 255, 0.2);
    border-color: rgba(102, 204, 255, 0.5);
    color: #b3e3ff;
  }
  .oep-user-search__btn--reset[hidden] {
    display: none;
  }
  .oep-user-search__status {
    margin-top: 0.4rem;
    margin-bottom: 0.6rem;
    max-width: 34rem;
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.5);
    min-height: 1em;
  }
  .oep-user-search--no-api .oep-user-search__input:disabled {
    opacity: 0.72;
    cursor: not-allowed;
  }
  /* Searched-user result row — works both in the mini-table and in the real table */
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__cell,
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}]:hover > td.beatmap-scoreboard-table__cell {
    background-color: rgba(167, 139, 250, 0.12);
  }
  table.beatmap-scoreboard-table__table tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__cell:first-child {
    box-shadow: inset 3px 0 0 rgba(167, 139, 250, 0.55);
  }
  /* Cloned row includes osu-web’s hover-only ⋯ menu column; hide for lookup result */
  tr[${SCORE_USER_SEARCH_RESULT_ATTR}] > td.beatmap-scoreboard-table__popup-menu {
    display: none !important;
  }
  /* Rows hidden by the rate filter or a merged leaderboard (see ROW_HIDE_ATTR). */
  tr[${ROW_HIDE_ATTR}] {
    display: none !important;
  }
  /* Empty or failed wildcard merge. */
  tr.${MERGED_NOTICE_CLASS} > td {
    padding: 1.5rem 0.5rem;
    text-align: center;
    color: hsl(var(--hsl-l2, 0 0% 70%));
  }
  /* Custom-rate scores (speed other than the mod default) — slightly dimmed. */
  tr[${RATE_EDIT_ROW_ATTR}] {
    opacity: 0.6;
  }
  tr[${RATE_EDIT_ROW_ATTR}]:hover {
    opacity: 0.9;
  }
  /* Non-top wildcard scores for a player — more heavily dimmed; overrides rate-edit above. */
  tr[${WILDCARD_DUPE_ROW_ATTR}] {
    opacity: 0.38;
  }
  tr[${WILDCARD_DUPE_ROW_ATTR}]:hover {
    opacity: 0.72;
  }
`;
  var MOD_GRID_STYLE_ID = "osu-expertplus-beatmap-mod-grid-css";
  var MOD_GRID_CSS = `

  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
    display: grid !important;
    gap: 8px 12px;
    align-items: start;
    justify-items: stretch;
    margin-bottom: 1.5rem;
    text-align: start;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] > .beatmap-scoreboard-mod[${MOD_HIDDEN_ATTR}] {
    display: none !important;
  }
  /* osu-web: .beatmapset-scoreboard__mods--initial:hover sets --scoreboard-mod-opacity: 0.5; only a
     hovered .beatmap-scoreboard-mod sets it back to 1. Expert+ adds labels/headers/gaps, so hovering
     those counts as “strip hover” but not “mod hover” → every icon stays dimmed. Keep full opacity
     unless the pointer is actually on a mod button. */
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].beatmapset-scoreboard__mods--initial:hover:not(:has(.beatmap-scoreboard-mod:hover)) {
    --scoreboard-mod-opacity: 1;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] {
    grid-template-columns: minmax(6.5rem, max-content) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "mod-toggle mod-toggle mod-toggle"
      "hdr-corner hdr-stable hdr-lazer"
      "r0-label r0-stable r0-lazer"
      "r1-label r1-stable r1-lazer"
      "r2-label r2-stable r2-lazer";
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__toggle-row {
    grid-area: mod-toggle;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    justify-self: stretch;
    width: 100%;
    min-width: 0;
    text-align: start;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle {
    position: relative;
    display: block;
    flex: 0 0 auto;
    margin: 0;
    margin-right: auto;
    padding: 4px 0 4px 1.35rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
    text-align: start !important;
    width: fit-content;
    max-width: 100%;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-label {
    display: block;
    text-align: start !important;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:hover {
    color: hsl(var(--hsl-l1, 0 0% 92%));
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
    border-radius: 4px;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__collapse-toggle i {
    position: absolute;
    left: 0;
    top: 50%;
    width: 1rem;
    height: 1em;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    font-size: 12px;
    line-height: 1;
    opacity: 0.9;
    transform: translateY(-50%);
    transform-origin: 0.35em 50%;
    transition: transform 0.15s ease;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS} {
    text-align: start !important;
    width: 100% !important;
    max-width: 100%;
    box-sizing: border-box;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
    > :not(.${MOD_GRID_CLASS}__toggle-row):not(.beatmap-scoreboard-mod) {
    display: none !important;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}].${MOD_GRID_COLLAPSED_CLASS}
    .${MOD_GRID_CLASS}__collapse-toggle i {
    transform: translateY(-50%) rotate(-90deg);
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-corner {
    grid-area: hdr-corner;
    min-height: 1px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods {
    flex: 0 0 auto;
    margin: 0;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-b4, 333 18% 28%));
    cursor: pointer;
    font: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: hsl(var(--hsl-l1, 0 0% 88%));
    background: hsl(var(--hsl-b5, 333 18% 22%));
    line-height: 1.2;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:hover:not(:disabled) {
    filter: brightness(1.1);
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__reset-mods:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%));
    outline-offset: 2px;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-stable {
    grid-area: hdr-stable;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__hdr-lazer {
    grid-area: hdr-lazer;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-label {
    grid-area: r0-label;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-label {
    grid-area: r1-label;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-label {
    grid-area: r2-label;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-stable {
    grid-area: r0-stable;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r0-lazer {
    grid-area: r0-lazer;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-stable {
    grid-area: r1-stable;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r1-lazer {
    grid-area: r1-lazer;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-stable {
    grid-area: r2-stable;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__r2-lazer {
    grid-area: r2-lazer;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
    opacity: 0.9;
    padding-top: 0;
    line-height: 1.25;
    max-width: 11rem;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--hsl-l1, 0 0% 88%));
    padding: 2px 0 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__colhead--lazer {
    justify-content: space-between;
    flex-wrap: wrap;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__pile {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide {
    flex: 1 1 100%;
    width: 100%;
    max-width: 22rem;
    box-sizing: border-box;
    margin-top: 2px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b4, 333 18% 28%) / 0.55);
    background: hsl(var(--hsl-b2, 333 18% 10%) / 0.9);
    font-size: 9px;
    line-height: 1.35;
    color: hsl(var(--hsl-c2, 333 60% 72%));
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon {
    position: relative;
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    margin-top: 1px;
    border-radius: 8px;
    box-sizing: border-box;
    background: hsl(var(--hsl-b4, 333 18% 18%) / 0.6);
    outline: 2px dashed hsl(45 100% 60% / 0.85);
    outline-offset: 1px;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-icon::after {
    content: "?";
    position: absolute;
    top: -5px;
    right: -5px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: hsl(45 100% 50%);
    color: hsl(0 0% 10%);
    font-size: 10px;
    font-weight: 800;
    line-height: 15px;
    text-align: center;
    pointer-events: none;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text {
    margin: 0;
    min-width: 0;
  }
  [${MOD_GRID_ATTR}] .${MOD_GRID_CLASS}__wildcard-guide-text strong {
    color: hsl(var(--hsl-l1, 0 0% 90%));
    font-weight: 700;
  }
  /* Mod statistics numbers (grid layout only): enabled mods -> white. */
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender span,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__extender,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator span,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .mod__customised-indicator,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__stat,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .beatmap-scoreboard-mod--enabled .beatmap-scoreboard-mod__count {
    color: hsl(var(--hsl-l1, 0 0% 90%)) !important;
  }
  /* Wildcard mod styling */
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} {
    position: relative;
    --scoreboard-mod-opacity: 0.85;
    filter: none;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .mod__icon {
    outline: 2px dashed hsl(45 100% 60% / 0.85);
    outline-offset: 1px;
    border-radius: 8px;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS}::after {
    content: "?";
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: hsl(45 100% 50%);
    color: hsl(0 0% 10%);
    font-size: 11px;
    font-weight: 800;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
    z-index: 2;
  }
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__stat,
  .beatmapset-scoreboard__mods[${MOD_GRID_ATTR}] .${MOD_WILDCARD_CLASS} .beatmap-scoreboard-mod__count {
    color: hsl(45 100% 70%) !important;
  }
`;

  // src/features/scoreboard/index.js
  function prepareScoreboard() {
    const { manageStyle: manageStyle2 } = OsuExpertPlus.dom;
    manageStyle2(SCOREBOARD_STYLE_ID, SCOREBOARD_CSS).inject();
    manageStyle2(MOD_GRID_STYLE_ID, MOD_GRID_CSS).inject();
    installBeatmapScoresLimitPatch();
  }
  function startScoreboard(bag, pathRe) {
    safeStart(
      bag,
      () => startBeatmapScoreboardSortControls(pathRe),
      "scoreboard sort"
    );
    safeStart(
      bag,
      () => startBeatmapScoreUserSearchManager(pathRe),
      "player lookup"
    );
    safeStart(
      bag,
      () => startBeatmapScoreboardHideRateEditFilterBar(pathRe),
      "rate filter"
    );
    safeStart(
      bag,
      () => startBeatmapScoreboardTableEnhancementsLive(pathRe),
      "scoreboard table"
    );
    bag.add(disposeScoreboardGlobalRanks);
    mountSettingFeature(
      bag,
      settings(),
      settingIds().SCOREBOARD_MOD_GRID,
      () => mountScoreboardModGrid(pathRe)
    );
  }

  // src/pages/beatmap-detail.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.pages = OsuExpertPlus.pages || {};
  var BEATMAPSET_HEADER_PROCESSED_ATTR = "data-oep-processed";
  var BEATMAPSET_HEADER_STALE_SEL = `.beatmapset-header[${BEATMAPSET_HEADER_PROCESSED_ATTR}]`;
  async function init(match, ctx = {}) {
    const { waitForElement: waitForElement2, waitForStaleElementToLeave: waitForStaleElementToLeave2, manageStyle: manageStyle2 } = OsuExpertPlus.dom;
    const settings2 = OsuExpertPlus.settings;
    const { IDS } = settings2;
    const beatmapsetId = match[1];
    const pathRe = new RegExp(`^/beatmapsets/${beatmapsetId}(?:/|$)`);
    manageStyle2(BEATMAPSET_STYLE_ID, BEATMAPSET_CSS).inject();
    prepareScoreboard();
    const bag = OsuExpertPlus.dom.createCleanupBag();
    const cleanup = () => bag.dispose();
    await waitForStaleElementToLeave2(BEATMAPSET_HEADER_STALE_SEL);
    let header;
    try {
      header = await waitForElement2(".beatmapset-header", 15e3);
    } catch (_) {
      return cleanup;
    }
    header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");
    if (!document.body.contains(header)) return cleanup;
    if (!pathRe.test(location.pathname)) return cleanup;
    const onPage = () => pathRe.test(location.pathname) && document.body.contains(header);
    startScoreboard(bag, pathRe);
    safeStart(
      bag,
      () => startDiscussionTabLinkPatcher(beatmapsetId),
      "discussion tab links"
    );
    safeStart(
      bag,
      () => startBeatmapsetFavouriteButtonPinkIndicator(header),
      "favourite button"
    );
    safeStart(bag, () => startPickerDiffNames(header, pathRe), "picker names");
    mountSettingFeature(
      bag,
      settings2,
      IDS.BEATCONNECT_DOWNLOAD_BUTTON,
      () => onPage() ? mountBeatconnectDownloadSplit(header, beatmapsetId) : void 0
    );
    mountSettingFeature(
      bag,
      settings2,
      IDS.OMDB_BEATMAPSET_RATINGS,
      () => remountOnEvent(
        window,
        OsuExpertPlus.omdb.KEY_CHANGED_EVENT,
        () => mountOmdbRow(header, beatmapsetId, pathRe)
      )
    );
    safeStart(
      bag,
      () => remountOnEvent(
        window,
        CREDENTIALS_CHANGED_EVENT,
        () => OsuExpertPlus.auth.isConfigured() ? setupBeatmapsetFavouriteHoverPopover(
          header,
          beatmapsetId,
          pathRe,
          readBeatmapsetJson()?.favourite_count
        ) : void 0
      ),
      "favourites popover"
    );
    mountSettingFeature(
      bag,
      settings2,
      IDS.METADATA_DESCRIPTION_MODAL_BUTTONS,
      () => startBeatmapsetInfoModals(header, pathRe)
    );
    try {
      await waitForElement2(".beatmapset-info", {
        timeout: 12e3,
        signal: ctx.signal
      });
      if (onPage()) {
        mountSettingFeature(
          bag,
          settings2,
          IDS.BEATMAP_PREVIEW,
          () => mountBeatmapPreviewSection(header, pathRe)
        );
      }
    } catch (_) {
    }
    mountSettingFeature(
      bag,
      settings2,
      IDS.BACKGROUND_BUTTON,
      () => onPage() ? mountBeatmapsetBackgroundButton(header, beatmapsetId) : void 0
    );
    mountSettingFeature(
      bag,
      settings2,
      IDS.MP3_DOWNLOAD_BUTTON,
      () => onPage() ? mountBeatmapsetMp3Button(header, beatmapsetId) : void 0
    );
    mountSettingFeature(
      bag,
      settings2,
      IDS.BEATMAPSET_PREVIEW_AUDIO_BUTTON,
      () => onPage() ? mountBeatmapsetPreviewAudioButton(header, beatmapsetId) : void 0
    );
    return cleanup;
  }
  OsuExpertPlus.pages.beatmapDetail = { name: "BeatmapDetail", init };

  // src/features/discussion/landing-redirect.js
  var log5 = createLogger("discussion/landing");
  function isBareDiscussionPath(path, beatmapsetId) {
    const base = discussionPath(beatmapsetId);
    return path === base || path === `${base}/`;
  }
  function isDefaultDiscussionTabPath(path, beatmapsetId) {
    const base = discussionPath(beatmapsetId);
    if (!path.startsWith(`${base}/`)) return false;
    return /^\/-\/generalAll(?:\/praises)?\/?$/.test(path.slice(base.length));
  }
  function initialDocumentPath() {
    try {
      const [nav] = performance.getEntriesByType("navigation");
      return nav ? new URL(nav.name).pathname : null;
    } catch (_) {
      return null;
    }
  }
  function replaceVisit(url) {
    const win = pageWindow();
    const turbo = win.Turbo;
    if (turbo && typeof turbo.visit === "function") {
      try {
        const options = { action: "replace" };
        turbo.visit(
          url,
          typeof cloneInto === "function" ? cloneInto(options, win) : options
        );
        return;
      } catch (err) {
        log5.warn("Turbo.visit failed, reloading instead:", err);
      }
    }
    location.replace(url);
  }
  function createLandingRedirect(deps = {}) {
    const getInitialPath = deps.initialDocumentPath ?? initialDocumentPath;
    const visit = deps.visit ?? replaceVisit;
    let firstInit = true;
    function start2(beatmapsetId, settings2) {
      const settingId = settings2.IDS.DISCUSSION_DEFAULT_TO_TOTAL;
      const path = location.pathname;
      let landing = isBareDiscussionPath(path, beatmapsetId);
      if (!landing && firstInit && isDefaultDiscussionTabPath(path, beatmapsetId)) {
        const original = getInitialPath();
        landing = original != null && isBareDiscussionPath(original, beatmapsetId);
      }
      firstInit = false;
      let done = false;
      const run = () => {
        if (done || !landing || !settings2.isEnabled(settingId)) return;
        done = true;
        visit(
          `${discussionTotalPath(beatmapsetId)}${location.search}${location.hash}`
        );
      };
      run();
      const off = settings2.onChange(settingId, (on) => {
        if (on) run();
      });
      return () => {
        off();
        done = true;
      };
    }
    return { start: start2 };
  }
  var startDiscussionLandingRedirect = createLandingRedirect().start;

  // src/features/discussion/preview.js
  function startDiscussionPreview(beatmapsetId) {
    const { el: el2, setHiddenIfChanged: setHiddenIfChanged2 } = OsuExpertPlus.dom;
    const TOGGLE_ATTR = "data-oep-discussion-preview-toggle";
    const PREVIEW_ATTR = "data-oep-discussion-preview";
    const MARKER_ATTR = "data-oep-discussion-preview-bound";
    const ROOT_MARKER_ATTR = "data-oep-discussion-preview-root-bound";
    const HELPER_ATTR = "data-oep-markdown-helper";
    const composers = /* @__PURE__ */ new WeakMap();
    const toggleOwners = /* @__PURE__ */ new WeakMap();
    const isPreviewEnabled = (c) => c.toggleBtn?.getAttribute("aria-pressed") === "true";
    function repaint(c) {
      const { textarea, helper, toggleBtn, preview, body } = c;
      if (!toggleBtn || !preview || !body) return;
      const visibleNow = isVisibleTextarea(textarea);
      const source = String(textarea.value || "");
      const hasTextNow = source.trim().length > 0;
      if (hasTextNow) {
        body.replaceChildren(sanitizeTree(renderMarkdown(source, { document })));
      } else {
        body.replaceChildren(
          el2(
            "p",
            { class: "oep-discussion-preview__empty" },
            "Nothing to preview yet."
          )
        );
      }
      if (c.isReply && !visibleNow) {
        helper?.remove();
        setHiddenIfChanged2(toggleBtn, true);
        setHiddenIfChanged2(preview, true);
        return;
      }
      if (helper) setHiddenIfChanged2(helper, false);
      setHiddenIfChanged2(toggleBtn, !hasTextNow);
      setHiddenIfChanged2(preview, !hasTextNow || !isPreviewEnabled(c));
    }
    const isSupportedDiscussionPath = () => beatmapsetIdFromPath(location.pathname) === beatmapsetId && isBeatmapsetDiscussion(location.pathname) && !isDiscussionReviewsTotal(location.pathname);
    function collectCandidateTextareas() {
      const nodes = Array.from(
        document.querySelectorAll(
          '[data-react="beatmap-discussions"] textarea, .beatmap-discussion textarea'
        )
      );
      return nodes.filter((node) => {
        if (!(node instanceof HTMLTextAreaElement)) return false;
        if (!node.isConnected) return false;
        if (node.hasAttribute(MARKER_ATTR)) return false;
        if (!node.closest('[data-react="beatmap-discussions"], .beatmap-discussion')) {
          return false;
        }
        return true;
      });
    }
    function isVisibleTextarea(textarea) {
      if (!(textarea instanceof HTMLTextAreaElement)) return false;
      if (!textarea.isConnected) return false;
      const rect = textarea.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return false;
      const cs = window.getComputedStyle(textarea);
      return cs.display !== "none" && cs.visibility !== "hidden";
    }
    function bindTextareaPreview(textarea) {
      const composerRoot = textarea.closest(".beatmap-discussion-new") || textarea.closest(".beatmap-discussion-post--new-reply") || textarea.closest(".beatmap-discussion-reply-box") || textarea.closest("[class*='discussion-new']") || textarea.closest("[class*='new-reply']") || textarea.closest("[class*='reply-box']");
      if (!(composerRoot instanceof HTMLElement)) return;
      textarea.setAttribute(MARKER_ATTR, "1");
      composerRoot.setAttribute(ROOT_MARKER_ATTR, "1");
      const isReplyComposer = composerRoot.classList.contains("beatmap-discussion-post--new-reply") || composerRoot.classList.contains("beatmap-discussion-reply-box");
      let composer = composers.get(textarea);
      if (!composer) {
        const c = {
          textarea,
          isReply: isReplyComposer,
          helper: null,
          toggleBtn: null,
          preview: null,
          body: null
        };
        composer = c;
        composers.set(textarea, c);
        textarea.addEventListener("input", () => repaint(c));
      }
      composer.isReply = isReplyComposer;
      const replaceRangeUndoable = (start2, end, replacement) => replaceRange(textarea, start2, end, replacement, { dispatchInput: false });
      const insertText = (before, after, placeholder) => {
        const start2 = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start2, end);
        const payload = `${before}${selected || placeholder}${after}`;
        replaceRangeUndoable(start2, end, payload);
        const caret = start2 + before.length + (selected ? selected.length : String(placeholder).length);
        textarea.setSelectionRange(caret, caret);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const toggleMarkdownWrap = (before, after, placeholder) => toggleWrap(textarea, before, after, { placeholder, matchInside: false });
      const togglePrefixLines = (prefix, sample = "text") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart = value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const allPrefixed = lines.every((line) => line.startsWith(prefix));
        const next = lines.map(
          (line) => allPrefixed ? line.slice(prefix.length) : `${prefix}${line}`
        ).join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const toggleOrderedListLines = (sample = "first item\nsecond item") => {
        const value = textarea.value || "";
        const selStart = textarea.selectionStart ?? 0;
        const selEnd = textarea.selectionEnd ?? 0;
        const lineStart = value.lastIndexOf("\n", Math.max(0, selStart - 1)) + 1;
        const lineEndIdx = value.indexOf("\n", selEnd);
        const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
        const block = value.slice(lineStart, lineEnd);
        const hasSelection = selEnd > selStart;
        const blockSrc = hasSelection ? block : sample;
        const lines = blockSrc.split("\n");
        const numberedRe = /^\d+\.\s/;
        const allNumbered = lines.length > 0 && lines.every((line) => line === "" || numberedRe.test(line));
        let n = 0;
        const next = lines.map((line) => {
          if (allNumbered) {
            if (line === "") return "";
            return line.replace(/^\d+\.\s*/, "");
          }
          if (line === "") return "";
          n += 1;
          return `${n}. ${line}`;
        }).join("\n");
        const replaceStart = hasSelection ? lineStart : selStart;
        const replaceEnd = hasSelection ? lineEnd : selEnd;
        replaceRangeUndoable(replaceStart, replaceEnd, next);
        textarea.setSelectionRange(replaceStart, replaceStart + next.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const toggleCodeBlock = () => {
        const start2 = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const selected = textarea.value.slice(start2, end);
        const open = "```\n";
        const close = "\n```";
        const hasFence = selected.startsWith(open) && selected.endsWith(close);
        if (hasFence) {
          const inner = selected.slice(
            open.length,
            selected.length - close.length
          );
          replaceRangeUndoable(start2, end, inner);
          textarea.setSelectionRange(start2, start2 + inner.length);
        } else {
          const payload = `${open}${selected || "code"}${close}`;
          replaceRangeUndoable(start2, end, payload);
          const innerStart = start2 + open.length;
          const innerEnd = innerStart + (selected ? selected.length : 4);
          textarea.setSelectionRange(innerStart, innerEnd);
        }
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      composerRoot.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
      const mkBtn = (iconCls, label, onClick) => {
        const btn = el2(
          "button",
          {
            type: "button",
            class: "oep-markdown-helper__btn",
            title: label
          },
          el2("i", { class: iconCls, "aria-hidden": "true" }),
          label
        );
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return btn;
      };
      const helper = el2(
        "div",
        {
          class: `oep-markdown-helper${isReplyComposer ? " oep-markdown-helper--reply" : " oep-markdown-helper--new-discussion"}`,
          [HELPER_ATTR]: "1"
        },
        el2(
          "div",
          { class: "oep-markdown-helper__row" },
          mkBtn(
            "fas fa-bold",
            "Bold",
            () => toggleMarkdownWrap("**", "**", "bold")
          ),
          mkBtn(
            "fas fa-italic",
            "Italic",
            () => toggleMarkdownWrap("*", "*", "italic")
          ),
          mkBtn(
            "fas fa-strikethrough",
            "Strike",
            () => toggleMarkdownWrap("~~", "~~", "text")
          ),
          mkBtn(
            "fas fa-code",
            "Code",
            () => toggleMarkdownWrap("`", "`", "code")
          ),
          mkBtn(
            "fas fa-link",
            "Link",
            () => insertText("[", "](https://example.com)", "title")
          ),
          mkBtn(
            "fas fa-image",
            "Image",
            () => insertText("![", "](https://example.com/image.png)", "")
          ),
          mkBtn("fas fa-quote-left", "Quote", () => togglePrefixLines("> ")),
          mkBtn(
            "fas fa-list-ul",
            "List",
            () => togglePrefixLines("- ", "item one\nitem two")
          ),
          mkBtn("fas fa-list-ol", "Numbered", () => toggleOrderedListLines()),
          mkBtn(
            "fas fa-heading",
            "Heading",
            () => insertText("## ", "", "Heading")
          ),
          mkBtn("fas fa-file-code", "Code Block", () => toggleCodeBlock())
        )
      );
      const newDiscussionRoot = textarea.closest(".beatmap-discussion-new");
      if (newDiscussionRoot instanceof HTMLElement) {
        if (helper.parentElement !== newDiscussionRoot || newDiscussionRoot.firstElementChild !== helper) {
          newDiscussionRoot.prepend(helper);
        }
      } else if (isReplyComposer) {
        if (helper.parentElement !== composerRoot || composerRoot.firstElementChild !== helper) {
          composerRoot.prepend(helper);
        }
      } else if (textarea.closest(".beatmap-discussion-reply-box") instanceof HTMLElement || textarea.closest(".beatmap-discussion-post--new-reply") instanceof HTMLElement || textarea.closest("[class*='reply-box']") instanceof HTMLElement || textarea.closest("[class*='new-reply']") instanceof HTMLElement) {
        const helperAnchor = textarea.closest(".beatmap-discussion-reply-box") || textarea.closest(".beatmap-discussion-post--new-reply") || textarea.closest("[class*='reply-box']") || textarea.closest("[class*='new-reply']");
        if (helperAnchor instanceof HTMLElement && (helper.previousElementSibling !== helperAnchor || helper.parentElement !== helperAnchor.parentElement)) {
          helperAnchor.insertAdjacentElement("beforebegin", helper);
        }
      } else if (!(helper.parentElement instanceof HTMLElement) || helper.nextElementSibling !== textarea) {
        textarea.insertAdjacentElement("beforebegin", helper);
      }
      let toggleBtn = composerRoot.querySelector(`[${TOGGLE_ATTR}]`);
      if (!(toggleBtn instanceof HTMLButtonElement)) {
        const btn = el2(
          "button",
          {
            type: "button",
            class: "oep-discussion-preview-toggle",
            [TOGGLE_ATTR]: "1",
            "aria-pressed": "false",
            title: "Toggle post preview"
          },
          "Preview"
        );
        btn.addEventListener("click", () => {
          const owner = toggleOwners.get(btn);
          btn.setAttribute(
            "aria-pressed",
            btn.getAttribute("aria-pressed") === "true" ? "false" : "true"
          );
          if (owner) repaint(owner);
        });
        toggleBtn = btn;
      }
      toggleOwners.set(toggleBtn, composer);
      placeDiscussionPreviewToggle(composerRoot, toggleBtn, textarea);
      let preview = composerRoot.querySelector(`[${PREVIEW_ATTR}]`);
      if (!(preview instanceof HTMLElement)) {
        preview = el2(
          "div",
          {
            class: "oep-discussion-preview",
            [PREVIEW_ATTR]: "1",
            hidden: isPreviewEnabled(composer) ? null : ""
          },
          el2("p", { class: "oep-discussion-preview__title" }, "Post preview"),
          el2("div", { class: "oep-discussion-preview__body" })
        );
        const anchor = textarea.closest(".beatmap-discussion-new__message") || textarea.parentElement || composerRoot;
        anchor.insertAdjacentElement("afterend", preview);
      }
      const body = preview.querySelector(".oep-discussion-preview__body");
      if (!(body instanceof HTMLElement)) return;
      composer.helper = helper;
      composer.toggleBtn = toggleBtn;
      composer.preview = preview;
      composer.body = body;
      repaint(composer);
    }
    function pruneDetachedMarkdownHelpers() {
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const replyShell = node.closest(".beatmap-discussion-post--new-reply") || node.closest(".beatmap-discussion-reply-box");
        if (replyShell instanceof HTMLElement) {
          const ta = replyShell.querySelector("textarea");
          const keep = ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        const newShell = node.closest(".beatmap-discussion-new");
        if (newShell instanceof HTMLElement) {
          const ta = newShell.querySelector("textarea");
          const keep = ta instanceof HTMLTextAreaElement && isVisibleTextarea(ta);
          if (!keep) node.remove();
          return;
        }
        node.remove();
      });
    }
    function reviveReplyPreviewIfNeeded() {
      document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((ta) => {
        if (!(ta instanceof HTMLTextAreaElement) || !ta.isConnected) return;
        const replyRoot = ta.closest(".beatmap-discussion-post--new-reply") || ta.closest(".beatmap-discussion-reply-box");
        if (!(replyRoot instanceof HTMLElement)) return;
        if (!isVisibleTextarea(ta)) return;
        if (replyRoot.querySelector(`[${HELPER_ATTR}]`)) return;
        ta.removeAttribute(MARKER_ATTR);
        bindTextareaPreview(ta);
      });
    }
    const run = () => {
      if (!isSupportedDiscussionPath()) {
        document.querySelectorAll(`[${TOGGLE_ATTR}]`).forEach((n) => n.remove());
        document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((n) => n.remove());
        document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
        document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((n) => n.removeAttribute(MARKER_ATTR));
        document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
        return;
      }
      const textareas = collectCandidateTextareas();
      for (const ta of textareas) bindTextareaPreview(ta);
      document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        const ta = Array.from(root.querySelectorAll("textarea")).find(
          (node) => isVisibleTextarea(node)
        ) || root.querySelector("textarea");
        const btn = root.querySelector(`[${TOGGLE_ATTR}]`);
        const preview = root.querySelector(`[${PREVIEW_ATTR}]`);
        const extraHelpers = root.querySelectorAll(`[${HELPER_ATTR}]`);
        if (extraHelpers.length > 1) {
          Array.from(extraHelpers).slice(1).forEach((n) => n.remove());
        }
        const helper = root.querySelector(`[${HELPER_ATTR}]`);
        if (!(btn instanceof HTMLElement)) return;
        const isReplyComposer = root.classList.contains("beatmap-discussion-post--new-reply") || root.classList.contains("beatmap-discussion-reply-box");
        const isNewDiscussionRoot = root.classList.contains(
          "beatmap-discussion-new"
        );
        const hasTextNow = ta instanceof HTMLTextAreaElement && String(ta.value || "").trim().length > 0;
        if (isReplyComposer && !isVisibleTextarea(ta)) {
          setHiddenIfChanged2(btn, true);
          if (preview instanceof HTMLElement) setHiddenIfChanged2(preview, true);
          if (helper instanceof HTMLElement) helper.remove();
          return;
        }
        if ((isReplyComposer || isNewDiscussionRoot) && !hasTextNow) {
          setHiddenIfChanged2(btn, true);
          if (preview instanceof HTMLElement) setHiddenIfChanged2(preview, true);
          if (helper instanceof HTMLElement) setHiddenIfChanged2(helper, false);
          return;
        }
        if (helper instanceof HTMLElement) setHiddenIfChanged2(helper, false);
        setHiddenIfChanged2(btn, false);
        placeDiscussionPreviewToggle(
          root,
          btn,
          ta instanceof HTMLTextAreaElement ? ta : null
        );
      });
      pruneDetachedMarkdownHelpers();
      reviveReplyPreviewIfNeeded();
    };
    const runQuietly = () => observe.mutate(run);
    const unsubscribe = observe.subscribe(
      {
        attributes: ["class", "style", "hidden", "aria-hidden"],
        schedule: 80,
        label: "discussion/preview"
      },
      runQuietly
    );
    runQuietly();
    return () => {
      unsubscribe();
      document.querySelectorAll(`[${TOGGLE_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
      document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((n) => n.removeAttribute(MARKER_ATTR));
      document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
    };
  }

  // src/features/discussion/styles.js
  var DISCUSSION_STYLE_ID = "osu-expertplus-beatmap-discussion-css";
  var DISCUSSION_CSS = `
  .oep-discussion-preview-toggle {
    margin-left: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b4, 333 18% 18%));
    color: hsl(var(--hsl-l1, 0 0% 90%));
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .oep-discussion-preview-toggle:hover {
    background: hsl(var(--hsl-b5, 333 18% 24%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
  }
  .oep-discussion-preview-toggle[aria-pressed="true"] {
    background: hsl(var(--hsl-c1, 333 89% 68%) / 0.2);
    border-color: hsl(var(--hsl-c1, 333 89% 58%));
    color: hsl(var(--hsl-l1, 0 0% 100%));
  }
  .oep-discussion-preview {
    margin-top: 10px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    background: hsl(var(--hsl-b3, 333 18% 14%));
    color: hsl(var(--hsl-l1, 0 0% 92%));
    font-size: 13px;
    line-height: 1.55;
    word-break: break-word;
  }
  .oep-discussion-preview[hidden] {
    display: none !important;
  }
  .oep-discussion-preview__title {
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: hsl(var(--hsl-c2, 333 60% 70%));
  }
  .oep-discussion-preview__body pre,
  .oep-discussion-preview__body code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .oep-discussion-preview__body pre {
    overflow-x: auto;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%));
  }
  .oep-discussion-preview__body p,
  .oep-discussion-preview__body ul,
  .oep-discussion-preview__body ol,
  .oep-discussion-preview__body blockquote {
    margin: 0 0 8px;
  }
  .oep-discussion-preview__body p:last-child,
  .oep-discussion-preview__body ul:last-child,
  .oep-discussion-preview__body ol:last-child,
  .oep-discussion-preview__body blockquote:last-child {
    margin-bottom: 0;
  }
  .oep-discussion-preview__body blockquote {
    border-left: 3px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.45);
    padding-left: 10px;
    color: hsl(var(--hsl-l2, 0 0% 78%));
  }
  .oep-discussion-preview__body img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%));
  }
  .oep-discussion-preview__empty {
    color: hsl(var(--hsl-l2, 0 0% 68%));
    font-style: italic;
  }
  .oep-markdown-helper {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-sizing: border-box;
  }
  .oep-markdown-helper__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .oep-markdown-helper--new-discussion {
    margin: 0 0 10px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
    background: hsl(var(--hsl-b2, 333 18% 10%) / 0.65);
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__row {
    gap: 6px;
  }
  .oep-markdown-helper--reply {
    margin: 10px 10px 10px;
    padding: 0 0 6px;
    border: none;
    border-radius: 0;
    border-bottom: 1px solid hsl(var(--hsl-b5, 333 18% 22%) / 0.55);
    background: transparent;
    box-shadow: none;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row {
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--hsl-b5, 333 18% 30%)) transparent;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar {
    height: 4px;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__row::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: hsl(var(--hsl-b5, 333 18% 32%));
  }
  .oep-markdown-helper__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 5px 8px;
    min-height: 26px;
    border-radius: 6px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
    background: hsl(var(--hsl-b3, 333 18% 14%));
    color: hsl(var(--hsl-l2, 0 0% 82%));
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    white-space: nowrap;
    margin: 0;
    box-shadow: none;
    transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn {
    padding: 5px 9px;
    min-height: 28px;
    border-radius: 6px;
    border-color: hsl(var(--hsl-b5, 333 18% 26%));
    background: hsl(var(--hsl-b3, 333 18% 16%));
    color: hsl(var(--hsl-l1, 0 0% 94%));
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 20%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.4);
    color: hsl(var(--hsl-l1, 0 0% 98%));
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.65);
    outline-offset: 2px;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn {
    flex: 0 0 auto;
    padding: 3px 6px;
    min-height: 24px;
    gap: 3px;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 600;
    border-color: hsl(var(--hsl-b5, 333 18% 26%) / 0.85);
    background: hsl(var(--hsl-b3, 333 18% 13%) / 0.9);
    color: hsl(var(--hsl-l2, 0 0% 80%));
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 18%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.35);
    color: hsl(var(--hsl-l1, 0 0% 94%));
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn:focus-visible {
    outline: 2px solid hsl(var(--hsl-c2, 333 60% 70%) / 0.55);
    outline-offset: 1px;
  }
  .oep-markdown-helper__btn:hover {
    background: hsl(var(--hsl-b4, 333 18% 19%));
    border-color: hsl(var(--hsl-c2, 333 60% 70%) / 0.38);
    color: hsl(var(--hsl-l1, 0 0% 96%));
  }
  .oep-markdown-helper__btn i {
    font-size: 10px;
    opacity: 0.88;
  }
  .oep-markdown-helper--new-discussion .oep-markdown-helper__btn i {
    font-size: 11px;
    opacity: 0.9;
  }
  .oep-markdown-helper--reply .oep-markdown-helper__btn i {
    font-size: 9px;
    opacity: 0.85;
  }
  .oep-discussion-voters-tooltip {
    min-width: min(216px, 70vw);
    max-width: min(252px, 78vw);
    padding: 0 !important;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 22%));
    background: hsl(var(--hsl-b1, 333 18% 8%));
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }
  .oep-discussion-voters-tooltip__list {
    max-height: min(320px, 52vh);
    overflow: auto;
    background: hsl(var(--hsl-b1, 333 18% 8%));
  }
  .oep-discussion-voters-tooltip__row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 9px;
    margin: 4px;
    text-decoration: none;
    color: hsl(var(--hsl-l1, 0 0% 92%));
    border: 1px solid hsl(var(--hsl-b4, 333 18% 18%));
    border-radius: 8px;
    background: hsl(var(--hsl-b2, 333 18% 10%));
    transition: background 120ms ease;
  }
  .oep-discussion-voters-tooltip__row:last-child {
    margin-bottom: 6px;
  }
  .oep-discussion-voters-tooltip__row:hover {
    background: hsl(var(--hsl-b3, 333 18% 13%));
  }
  .oep-discussion-voters-tooltip__avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid hsl(var(--hsl-b5, 333 18% 24%));
  }
  .oep-discussion-voters-tooltip__name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

  // src/features/discussion/voters.js
  var USER_CACHE_LIMIT = 500;
  var userCache = /* @__PURE__ */ new Map();
  function cachedUser(id) {
    const user = userCache.get(id);
    if (user) {
      userCache.delete(id);
      userCache.set(id, user);
    }
    return user;
  }
  function cacheUser(user) {
    userCache.delete(user.id);
    userCache.set(user.id, user);
    while (userCache.size > USER_CACHE_LIMIT) {
      userCache.delete(userCache.keys().next().value);
    }
  }
  var TOOLTIP_SEL = ".qtip";
  function startDiscussionVotersTooltips(beatmapsetId) {
    const { el: el2 } = OsuExpertPlus.dom;
    const ENHANCED_ATTR = "data-oep-discussion-voters-tooltip";
    const USER_ROW_ATTR = "data-oep-voter-user-id";
    const LIST_ATTR = "data-oep-voters-list";
    const HIDDEN_ORIGINAL_ATTR = "data-oep-voters-hidden";
    let disposed = false;
    const waiting = /* @__PURE__ */ new Map();
    let flushTimer = 0;
    const rowObservers = /* @__PURE__ */ new Set();
    const parseUserIdFromHref = (href) => {
      const m = String(href || "").match(/\/users\/(\d+)(?:\/|$)/i);
      return m ? m[1] : "";
    };
    const extractNameFromNode = (node, fallbackId) => {
      if (!(node instanceof Element))
        return fallbackId ? `User ${fallbackId}` : "User";
      const val = node.getAttribute("title") || node.getAttribute("aria-label") || node.getAttribute("data-tooltip") || node.getAttribute("alt") || node.textContent || "";
      const cleaned = String(val).replace(/\s+/g, " ").trim();
      return cleaned || (fallbackId ? `User ${fallbackId}` : "User");
    };
    const buildUserRowsFromTooltip = (tooltip) => {
      const users = [];
      const seen = /* @__PURE__ */ new Set();
      const pushUser = (idRaw, avatarRaw, nameRaw) => {
        const id = String(idRaw || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        users.push({
          id,
          href: `/users/${id}`,
          avatar: String(avatarRaw || "").trim(),
          name: String(nameRaw || "").trim() || `User ${id}`
        });
      };
      const links = Array.from(tooltip.querySelectorAll('a[href*="/users/"]'));
      for (const link of links) {
        if (!(link instanceof HTMLAnchorElement)) continue;
        const href = link.href || link.getAttribute("href") || "";
        const id = parseUserIdFromHref(href);
        if (!id) continue;
        const img = link.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name = extractNameFromNode(link, id);
        pushUser(id, avatar, name);
      }
      const userIdNodes = Array.from(tooltip.querySelectorAll("[data-user-id]"));
      for (const node of userIdNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const id = String(node.getAttribute("data-user-id") || "").trim();
        if (!id) continue;
        const img = node.querySelector("img");
        const avatar = img instanceof HTMLImageElement ? img.src : "";
        const name = extractNameFromNode(node, id);
        pushUser(id, avatar, name);
      }
      const imgs = Array.from(tooltip.querySelectorAll("img"));
      for (const img of imgs) {
        if (!(img instanceof HTMLImageElement)) continue;
        const src = String(img.src || "");
        const m = src.match(/https?:\/\/a\.ppy\.sh\/(\d+)(?:\b|\/|\?)/i);
        if (!m) continue;
        const id = m[1];
        const anchor = img.closest('a[href*="/users/"]');
        const name = extractNameFromNode(anchor || img, id);
        pushUser(id, src, name);
      }
      return users;
    };
    const isSingleUserCardTooltip = (tooltip) => {
      if (!(tooltip instanceof HTMLElement)) return false;
      const cardRoot = tooltip.querySelector(
        '[class*="user-card"], [class*="profile-card"], [class*="user-popup"]'
      );
      if (cardRoot) return true;
      const allClasses = [
        tooltip.className,
        ...Array.from(tooltip.querySelectorAll("[class]")).map(
          (n) => n.className
        )
      ].map((v) => String(v || "").toLowerCase()).join(" ");
      return /\buser-card\b|\bprofile-card\b|\buser-popup\b/.test(allClasses);
    };
    const scheduleUserFetch = (id, onDone) => {
      if (!id) return;
      const hit = cachedUser(id);
      if (hit) {
        onDone(hit);
        return;
      }
      let set = waiting.get(id);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        waiting.set(id, set);
      }
      set.add(onDone);
      if (!flushTimer) flushTimer = window.setTimeout(flush, 30);
    };
    const flush = () => {
      flushTimer = 0;
      const batch = new Map(waiting);
      waiting.clear();
      if (!batch.size) return;
      const settle = (users) => {
        if (disposed) return;
        const byId = /* @__PURE__ */ new Map();
        for (const user of users) {
          const id = String(user?.id ?? "");
          if (!id) continue;
          const data = {
            id,
            username: String(user.username || `User ${id}`),
            avatarUrl: String(user.avatar_url || "").trim() || `https://a.ppy.sh/${id}`
          };
          cacheUser(data);
          byId.set(id, data);
        }
        for (const [id, callbacks] of batch) {
          const data = byId.get(id) ?? null;
          for (const cb of callbacks) cb(data);
        }
      };
      Promise.resolve().then(() => OsuExpertPlus.api.getUsers([...batch.keys()])).then(settle, () => settle([]));
    };
    const hydrateVisibleRows = (container) => {
      const rows = Array.from(container.querySelectorAll(`[${USER_ROW_ATTR}]`));
      if (!rows.length) return;
      let remaining = rows.length;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const row = entry.target;
            if (!(row instanceof HTMLAnchorElement)) continue;
            const uid = row.getAttribute(USER_ROW_ATTR) || "";
            if (uid && row.getAttribute("data-oep-user-loaded") !== "1") {
              scheduleUserFetch(uid, (u) => {
                if (!u || !row.isConnected) return;
                const img = row.querySelector(
                  ".oep-discussion-voters-tooltip__avatar"
                );
                const name = row.querySelector(
                  ".oep-discussion-voters-tooltip__name"
                );
                if (img instanceof HTMLImageElement) {
                  img.src = u.avatarUrl;
                  img.alt = u.username;
                }
                if (name instanceof HTMLElement) name.textContent = u.username;
                row.href = `/users/${u.id}`;
                row.setAttribute("data-oep-user-loaded", "1");
              });
            }
            observer.unobserve(row);
            remaining -= 1;
            if (remaining <= 0) disconnect();
          }
        },
        { root: container, threshold: 0.01 }
      );
      const disconnect = () => {
        observer.disconnect();
        rowObservers.delete(disconnect);
      };
      rowObservers.add(disconnect);
      rows.forEach((r) => observer.observe(r));
    };
    const maybeEnhanceTooltip = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (!node.classList.contains("qtip")) return;
      if (node.getAttribute(ENHANCED_ATTR) === "1") return;
      if (beatmapsetIdFromPath(location.pathname) !== beatmapsetId) return;
      if (!isBeatmapsetDiscussion(location.pathname)) return;
      if (isSingleUserCardTooltip(node)) return;
      const users = buildUserRowsFromTooltip(node);
      if (users.length < 1) return;
      node.setAttribute(ENHANCED_ATTR, "1");
      node.classList.add("oep-discussion-voters-tooltip");
      const list = el2("div", {
        class: "oep-discussion-voters-tooltip__list",
        [LIST_ATTR]: "1"
      });
      for (const u of users) {
        const row = el2(
          "a",
          {
            class: "oep-discussion-voters-tooltip__row",
            href: u.href,
            [USER_ROW_ATTR]: String(u.id)
          },
          el2("img", {
            class: "oep-discussion-voters-tooltip__avatar",
            src: u.avatar || `https://a.ppy.sh/${u.id}`,
            alt: u.name,
            loading: "lazy"
          }),
          el2("span", { class: "oep-discussion-voters-tooltip__name" }, u.name)
        );
        list.appendChild(row);
      }
      for (const child of Array.from(node.children)) {
        if (!(child instanceof HTMLElement) || child.hidden) continue;
        child.hidden = true;
        child.setAttribute(HIDDEN_ORIGINAL_ATTR, "1");
      }
      node.appendChild(list);
      hydrateVisibleRows(list);
    };
    const unsubscribe = observe.subscribe(
      { selector: TOOLTIP_SEL, schedule: "sync", label: "discussion/voters" },
      ({ added }) => {
        for (const node of added) {
          if (!(node instanceof HTMLElement)) continue;
          maybeEnhanceTooltip(node);
          node.querySelectorAll(TOOLTIP_SEL).forEach((tip) => maybeEnhanceTooltip(tip));
        }
      }
    );
    document.querySelectorAll(TOOLTIP_SEL).forEach((tip) => maybeEnhanceTooltip(tip));
    return () => {
      disposed = true;
      unsubscribe();
      window.clearTimeout(flushTimer);
      waiting.clear();
      for (const disconnect of [...rowObservers]) disconnect();
      document.querySelectorAll(`[${ENHANCED_ATTR}]`).forEach((n) => {
        n.querySelectorAll(`[${LIST_ATTR}]`).forEach((list) => list.remove());
        n.querySelectorAll(`[${HIDDEN_ORIGINAL_ATTR}]`).forEach((child) => {
          child.removeAttribute(HIDDEN_ORIGINAL_ATTR);
          child.hidden = false;
        });
        n.removeAttribute(ENHANCED_ATTR);
        n.classList.remove("oep-discussion-voters-tooltip");
      });
    };
  }

  // src/pages/beatmap-discussion.js
  function init2(match) {
    const { createCleanupBag, manageStyle: manageStyle2 } = OsuExpertPlus.dom;
    const beatmapsetId = Number(match[1]);
    const bag = createCleanupBag();
    safeStart(
      bag,
      () => startDiscussionLandingRedirect(beatmapsetId, OsuExpertPlus.settings),
      "discussion/landing-redirect"
    );
    bag.add(manageStyle2(DISCUSSION_STYLE_ID, DISCUSSION_CSS).acquire());
    safeStart(
      bag,
      () => startDiscussionPreview(beatmapsetId),
      "discussion/preview"
    );
    safeStart(
      bag,
      () => startDiscussionVotersTooltips(beatmapsetId),
      "discussion/voters"
    );
    return () => bag.dispose();
  }
  var beatmapDiscussion = Object.freeze({
    name: "BeatmapDiscussion",
    init: init2
  });

  // src/editor/bbcode-helper/constants.js
  var BBHELP_STYLE_ID = "osu-expertplus-userpage-bbcode-helper";
  var BBHELP_WRAP_CLASS = "oep-bbhelp";
  var BBHELP_ROW_CLASS = "oep-bbhelp__row";
  var BBHELP_BTN_CLASS = "oep-bbhelp__btn";
  var BBHELP_BTN_ICON_CLASS = "oep-bbhelp__btn-icon";
  var BBHELP_BTN_TEXT_CLASS = "oep-bbhelp__btn-text";
  var BBHELP_MODAL_CLASS = "oep-bbhelp-modal";
  var BBHELP_EDITOR_ID_ATTR = "data-oep-bbhelp-editor-id";
  var BBHELP_WRAP_FOR_ATTR = "data-oep-bbhelp-for";
  var BBHELP_DONE_ATTR = "data-oep-bbhelp";
  var BBHELP_PREVIEW_TOGGLE_ATTR = "data-oep-bbhelp-preview-toggle";
  var BBHELP_PREVIEW_ATTR = "data-oep-bbhelp-preview";
  var BBHELP_PREVIEW_BODY_CLASS = "oep-bbhelp-preview__body";
  var BBHELP_PREVIEW_TOGGLE_CLASS = "oep-bbhelp-preview-toggle";
  var BBHELP_PREVIEW_CLASS = "oep-bbhelp-preview";
  var BBHELP_PREVIEW_TITLE_CLASS = "oep-bbhelp-preview__title";
  var BBHELP_PREVIEW_EMPTY_CLASS = "oep-bbhelp-preview__empty";
  var BBHELP_WARN_CLASS = "oep-bbhelp-warn";
  var BBHELP_EDITOR_SELECTOR = ".bbcode-editor";
  var BBHELP_INPUT_SELECTOR = "textarea";

  // src/editor/bbcode-helper/imagemap-model.js
  var IMAP_MIN_RECT_PCT = 1;
  function formatImapPct(v) {
    const n = Math.max(0, Math.min(100, Number(v)));
    const r = Math.round(n * 100) / 100;
    return String(r.toFixed(2)).replace(/\.?0+$/, "");
  }
  function normalizeImapLinkUrlForOsu(raw) {
    const u = String(raw || "").trim();
    if (!u) return null;
    if (u === "#") return "#";
    if (/^https?:\/\/\S+$/i.test(u)) return u;
    if (/^mailto:\S+$/i.test(u)) return u;
    if (u.startsWith("//")) return `https:${u}`;
    if (u.startsWith("/")) return `https://osu.ppy.sh${u}`;
    return null;
  }
  function parseImagemapFromText(text) {
    const m = String(text || "").match(
      /\[imagemap\]\s*([\s\S]*?)\s*\[\/imagemap\]/i
    );
    if (!m) return null;
    const rawBody = m[1].replace(/\r\n/g, "\n").trim();
    if (!rawBody) return null;
    const lines = rawBody.split("\n").map((l) => l.trim()).filter((ln) => ln.length > 0);
    if (!lines.length) return null;
    const imageUrl = lines[0];
    const areas = [];
    for (let li = 1; li < lines.length; li++) {
      const line = lines[li];
      const rm = line.match(
        /^([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+(\S+)(?:\s+(.*))?$/
      );
      if (!rm) continue;
      const x = Number(rm[1]);
      const y = Number(rm[2]);
      const w = Number(rm[3]);
      const h2 = Number(rm[4]);
      if (![x, y, w, h2].every((n) => Number.isFinite(n))) continue;
      areas.push({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        w: Math.max(0, Math.min(100, w)),
        h: Math.max(0, Math.min(100, h2)),
        url: rm[5],
        title: (rm[6] || "").trim()
      });
    }
    return { imageUrl, areas };
  }
  function generateImagemapBbcode(imageUrl, hotspots) {
    const imgUrl = String(imageUrl || "").trim();
    if (!imgUrl) return "";
    const valid = hotspots.map((hs) => ({
      hs,
      link: normalizeImapLinkUrlForOsu(hs.url)
    })).filter((o) => o.link);
    if (!valid.length) return "";
    const lines = [imgUrl];
    valid.forEach(({ hs, link }) => {
      const { x, y, w, h: h2, title } = hs;
      let line = `${formatImapPct(x)} ${formatImapPct(y)} ${formatImapPct(w)} ${formatImapPct(h2)} ${link}`;
      const t = String(title || "").trim();
      if (t) line += ` ${t}`;
      lines.push(line);
    });
    return `[imagemap]
${lines.join("\n")}
[/imagemap]`;
  }
  function formatBbcodeForSingleLineDisplay(multiline) {
    if (!multiline) return "";
    return String(multiline).replace(/\r?\n/g, " ").trim();
  }
  function clampImapRect(o, minSz = IMAP_MIN_RECT_PCT) {
    let x = o.x;
    let y = o.y;
    let w = Math.max(minSz, o.w);
    let h2 = Math.max(minSz, o.h);
    x = Math.max(0, Math.min(100 - w, x));
    y = Math.max(0, Math.min(100 - h2, y));
    if (x + w > 100) w = 100 - x;
    if (y + h2 > 100) h2 = 100 - y;
    w = Math.max(minSz, w);
    h2 = Math.max(minSz, h2);
    return { x, y, w, h: h2 };
  }
  function computeResizeRect(corner, s, pt, minSz = IMAP_MIN_RECT_PCT) {
    const px = Math.max(0, Math.min(100, pt.x));
    const py = Math.max(0, Math.min(100, pt.y));
    const rx = s.x + s.w;
    const by = s.y + s.h;
    let x = s.x;
    let y = s.y;
    let w = s.w;
    let h2 = s.h;
    if (corner === "se") {
      x = s.x;
      y = s.y;
      w = px - x;
      h2 = py - y;
    } else if (corner === "nw") {
      w = Math.max(minSz, rx - px);
      h2 = Math.max(minSz, by - py);
      x = rx - w;
      y = by - h2;
    } else if (corner === "ne") {
      x = s.x;
      y = Math.min(py, by - minSz);
      w = Math.max(minSz, px - x);
      h2 = by - y;
    } else if (corner === "sw") {
      x = Math.min(px, rx - minSz);
      y = s.y;
      w = rx - x;
      h2 = Math.max(minSz, py - y);
    }
    return clampImapRect({ x, y, w, h: h2 }, minSz);
  }
  function pctRawFromEvent(ev, bounds) {
    if (!bounds.width || !bounds.height) return null;
    return {
      x: (ev.clientX - bounds.left) / bounds.width * 100,
      y: (ev.clientY - bounds.top) / bounds.height * 100
    };
  }
  function selectionRectFromDragPct(sx, sy, ex, ey) {
    const xLo = Math.min(sx, ex);
    const xHi = Math.max(sx, ex);
    const yLo = Math.min(sy, ey);
    const yHi = Math.max(sy, ey);
    const cxLo = Math.max(0, Math.min(100, xLo));
    const cxHi = Math.max(0, Math.min(100, xHi));
    const cyLo = Math.max(0, Math.min(100, yLo));
    const cyHi = Math.max(0, Math.min(100, yHi));
    return {
      x: cxLo,
      y: cyLo,
      w: Math.max(0, cxHi - cxLo),
      h: Math.max(0, cyHi - cyLo)
    };
  }

  // src/editor/bbcode-helper/modal.js
  function createBbcodeModal({ cardStyle } = {}) {
    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", {
      class: `${BBHELP_MODAL_CLASS}__card`,
      style: cardStyle
    });
    return {
      overlay,
      card,
      show() {
        overlay.appendChild(card);
        document.body.appendChild(overlay);
      },
      close() {
        overlay.remove();
      }
    };
  }
  function modalTitle(text, attrs = {}) {
    return el("h4", { class: `${BBHELP_MODAL_CLASS}__title`, ...attrs }, text);
  }
  function modalButton(label, attrs = {}) {
    return el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS, ...attrs },
      label
    );
  }
  function bindPickerKeys(overlay, { apply, close }) {
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key !== "Enter" || ev.isComposing) return;
      if (
        /** @type {any} */
        ev.target?.closest?.("button")
      ) return;
      ev.preventDefault();
      apply();
    });
  }

  // src/editor/bbcode-helper/imagemap.js
  function openImagemapHelper(textarea, signal) {
    if (signal?.aborted) return;
    const modal = new AbortController();
    const hotspots = [];
    let imgLoaded = false;
    let drawState = null;
    let selectedHotspotIndex = -1;
    let pendingRectPick = null;
    let modifyState = null;
    const IMAP_DRAG_THRESHOLD_PX = 5;
    const shell = createBbcodeModal({
      cardStyle: "width:min(700px,96vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"
    });
    const { overlay, card } = shell;
    const titleRow = el("div", {
      style: "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;"
    });
    const titleEl = modalTitle("ImageMap Helper", { style: "margin:0;" });
    const importFromEditorBtn = modalButton("Import from editor", {
      title: "Auto: replace state from an [imagemap] block in the BBCode editor (uses selection if any, otherwise full text)"
    });
    const importManualBtn = modalButton("Manual import", {
      title: "Show a field to paste [imagemap] BBCode manually"
    });
    const importBtnsWrap = el(
      "div",
      {
        style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;"
      },
      importFromEditorBtn,
      importManualBtn
    );
    titleRow.appendChild(titleEl);
    titleRow.appendChild(importBtnsWrap);
    let manualImportOpen = false;
    const manualImportPanel = el("div", {
      style: "display:none;flex-direction:column;gap:8px;"
    });
    const manualImportHint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint`, style: "margin:0;" },
      "Paste a full [imagemap]…[/imagemap] block. Tags are required so the parser can find the body."
    );
    const manualImportTa = el("textarea", {
      rows: 10,
      style: "min-height:140px;resize:vertical;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;",
      "aria-label": "Manual imagemap BBCode",
      placeholder: "[imagemap]\nhttps://example.com/image.png\n0 0 25 25 https://osu.ppy.sh\n[/imagemap]"
    });
    const manualImportActions = el("div", {
      style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;"
    });
    const manualImportApplyBtn = modalButton("Apply pasted import");
    const manualImportCloseBtn = modalButton("Close");
    manualImportActions.appendChild(manualImportApplyBtn);
    manualImportActions.appendChild(manualImportCloseBtn);
    manualImportPanel.appendChild(manualImportHint);
    manualImportPanel.appendChild(manualImportTa);
    manualImportPanel.appendChild(manualImportActions);
    const urlInput = el("input", {
      type: "text",
      placeholder: "https://i.ppy.sh/... (base image URL)",
      style: "flex:1;min-width:0;",
      "aria-label": "Base image URL"
    });
    const loadBtn = modalButton("Load");
    const urlRow = el(
      "div",
      { style: "display:flex;gap:6px;" },
      urlInput,
      loadBtn
    );
    const imgEl = el("img", {
      alt: "",
      referrerpolicy: "no-referrer",
      style: "display:none;max-width:100%;height:auto;vertical-align:top;pointer-events:none;user-select:none;border-radius:3px;"
    });
    const drawLayer = el("div", {
      style: "position:absolute;inset:0;cursor:crosshair;display:none;touch-action:none;"
    });
    const imgStage = el(
      "div",
      {
        style: "position:relative;display:inline-block;line-height:0;max-width:100%;vertical-align:top;"
      },
      imgEl,
      drawLayer
    );
    const imgPlaceholder = el(
      "div",
      {
        style: "font-size:12px;opacity:0.45;padding:16px;text-align:center;pointer-events:none;"
      },
      "Image will appear here after loading"
    );
    const imgWrap = el(
      "div",
      {
        style: "display:inline-block;max-width:100%;vertical-align:top;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;"
      },
      imgPlaceholder,
      imgStage
    );
    const imgScrollSection = el("div", {
      style: "min-height:0;flex-shrink:1;align-self:stretch;width:100%;max-height:min(48vh,480px);overflow:auto;border-radius:4px;text-align:center;padding:2px;box-sizing:border-box;"
    });
    imgScrollSection.appendChild(imgWrap);
    const hotspotListEl = el("div", {
      style: "display:flex;flex-direction:column;gap:5px;"
    });
    const codeEl = el("div", {
      role: "textbox",
      "aria-readonly": "true",
      "aria-label": "Generated BBCode preview",
      style: "flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.14);border-radius:4px;padding:8px 10px;font-size:11px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,0.9);text-align:left;"
    });
    const copyCodeBtn = modalButton("Copy", {
      title: "Copy full BBCode (with line breaks) to clipboard",
      style: "flex-shrink:0;align-self:stretch;"
    });
    const codeRow = el(
      "div",
      {
        style: "display:flex;align-items:stretch;gap:8px;min-width:0;width:100%;"
      },
      codeEl,
      copyCodeBtn
    );
    const cancelBtn = modalButton("Cancel");
    const insertBtn = modalButton("Insert into editor");
    const actionsWarn = el("div", {
      class: `${BBHELP_MODAL_CLASS}__actions-warn`,
      role: "status"
    });
    const actionsBtns = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions-btns` },
      cancelBtn,
      insertBtn
    );
    const actions = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions` },
      actionsWarn,
      actionsBtns
    );
    function applyParsedImagemap(parsed) {
      hotspots.length = 0;
      parsed.areas.forEach((ar) => hotspots.push({ ...ar }));
      urlInput.value = parsed.imageUrl;
      selectedHotspotIndex = -1;
      rebuildHotspotList();
      renderOverlayRects();
      refreshCode();
      loadImage();
    }
    function setManualImportOpen(open) {
      manualImportOpen = open;
      manualImportPanel.style.display = open ? "flex" : "none";
      importManualBtn.textContent = open ? "Hide manual import" : "Manual import";
      if (open) manualImportTa.focus();
    }
    function setSelectedIndex(i) {
      const next = i >= 0 && i < hotspots.length ? i : -1;
      if (next !== selectedHotspotIndex) {
        selectedHotspotIndex = next;
        renderOverlayRects();
        return;
      }
      selectedHotspotIndex = next;
      syncSelectionVisuals();
    }
    function syncSelectionVisuals() {
      hotspotListEl.querySelectorAll("[data-oep-imap-row]").forEach((row) => {
        const idx = Number(row.getAttribute("data-oep-imap-row"));
        row.classList.toggle(
          "oep-imap-row--selected",
          idx === selectedHotspotIndex
        );
      });
      drawLayer.querySelectorAll("[data-oep-imap-rect]").forEach((el2) => {
        const idx = Number(el2.getAttribute("data-oep-imap-rect"));
        el2.classList.toggle(
          "oep-imap-rect--selected",
          idx === selectedHotspotIndex
        );
      });
    }
    function focusHotspotUrlInput(index) {
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(index)}"]`
      );
      if (!(row instanceof HTMLElement)) return;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const urlField = row.querySelector("input[data-oep-imap-url]");
      if (urlField instanceof HTMLInputElement) {
        urlField.focus();
        urlField.select();
      }
    }
    function generateBbcode() {
      return generateImagemapBbcode(urlInput.value, hotspots);
    }
    copyCodeBtn.addEventListener("click", async () => {
      const text = generateBbcode();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px;top:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch (_2) {
          return;
        }
      }
      const prev = copyCodeBtn.textContent;
      copyCodeBtn.textContent = "Copied!";
      window.setTimeout(() => {
        copyCodeBtn.textContent = prev;
      }, 1600);
    });
    function refreshCode() {
      const code = generateBbcode();
      insertBtn.disabled = !code;
      actionsWarn.classList.remove(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
      if (code) {
        codeEl.textContent = formatBbcodeForSingleLineDisplay(code);
        copyCodeBtn.disabled = false;
        actionsWarn.textContent = "";
        return;
      }
      codeEl.textContent = "";
      copyCodeBtn.disabled = true;
      const anyArea = hotspots.length > 0;
      const anyTextUrl = hotspots.some((hs) => String(hs.url || "").trim());
      const accepted = hotspots.some((hs) => normalizeImapLinkUrlForOsu(hs.url));
      if (anyArea && anyTextUrl && !accepted) {
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent = "osu! rejects these URLs — use https://…, mailto:…, #, //…, or a path like /users/123.";
        return;
      }
      actionsWarn.textContent = "Add an image URL, load it, draw areas, and set a valid link on each row to enable insert.";
    }
    function applyHsToRectEl(rectEl, hs) {
      Object.assign(rectEl.style, {
        left: `${formatImapPct(hs.x)}%`,
        top: `${formatImapPct(hs.y)}%`,
        width: `${formatImapPct(hs.w)}%`,
        height: `${formatImapPct(hs.h)}%`
      });
    }
    function updateRowCoordBadge(i) {
      const hs = hotspots[i];
      if (!hs) return;
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(i)}"]`
      );
      const badge = row?.querySelector("[data-oep-imap-coords]");
      if (badge) {
        badge.textContent = `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`;
      }
    }
    function finishModifyGesture() {
      modifyState = null;
      pendingRectPick = null;
      renderOverlayRects();
      rebuildHotspotList();
      refreshCode();
    }
    function onModifyMouseMove(ev) {
      if (!modifyState || !imgLoaded) return;
      const bounds = imgEl.getBoundingClientRect();
      const pt = pctRawFromEvent(ev, bounds);
      if (!pt) return;
      const hs = hotspots[modifyState.index];
      if (!hs) return;
      if (modifyState.type === "move") {
        const dx = pt.x - modifyState.startPt.x;
        const dy = pt.y - modifyState.startPt.y;
        const next = clampImapRect({
          x: modifyState.startHs.x + dx,
          y: modifyState.startHs.y + dy,
          w: modifyState.startHs.w,
          h: modifyState.startHs.h
        });
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      } else if (modifyState.type === "resize" && modifyState.corner) {
        const next = computeResizeRect(
          modifyState.corner,
          modifyState.startHs,
          pt
        );
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      }
    }
    function renderOverlayRects() {
      Array.from(drawLayer.querySelectorAll(".oep-imap-rect")).forEach(
        (n) => n.remove()
      );
      hotspots.forEach((hs, i) => {
        const isSel = i === selectedHotspotIndex;
        const rectEl = el("div", {
          class: `oep-imap-rect${isSel ? " oep-imap-rect--movable" : ""}`,
          "data-oep-imap-rect": String(i),
          style: `left:${formatImapPct(hs.x)}%;top:${formatImapPct(hs.y)}%;width:${formatImapPct(hs.w)}%;height:${formatImapPct(hs.h)}%;`
        });
        rectEl.addEventListener("mousedown", (ev) => {
          if (ev.button !== 0) return;
          if (ev.target instanceof Element && ev.target.closest(".oep-imap-handle")) {
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
          setSelectedIndex(i);
          pendingRectPick = {
            index: i,
            sx: ev.clientX,
            sy: ev.clientY
          };
        });
        if (isSel) {
          for (const corner of ["nw", "ne", "sw", "se"]) {
            const handle = el("div", {
              class: `oep-imap-handle oep-imap-handle--${corner}`,
              "data-oep-corner": corner
            });
            handle.addEventListener("mousedown", (ev) => {
              if (ev.button !== 0) return;
              ev.preventDefault();
              ev.stopPropagation();
              pendingRectPick = null;
              setSelectedIndex(i);
              modifyState = {
                type: "resize",
                index: i,
                corner,
                startPt: pctRawFromEvent(ev, imgEl.getBoundingClientRect()) ?? {
                  x: 0,
                  y: 0
                },
                startHs: {
                  x: hs.x,
                  y: hs.y,
                  w: hs.w,
                  h: hs.h
                },
                rectEl
              };
            });
            rectEl.appendChild(handle);
          }
        }
        drawLayer.appendChild(rectEl);
      });
      syncSelectionVisuals();
    }
    function buildHotspotRow(hs, index) {
      const indexBadge = el(
        "span",
        {
          style: "font-size:11px;font-weight:700;opacity:0.6;min-width:1.6em;text-align:right;flex-shrink:0;"
        },
        `#${index + 1}`
      );
      const coordBadge = el(
        "span",
        {
          style: "font-size:10px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;opacity:0.55;white-space:nowrap;flex-shrink:0;",
          "data-oep-imap-coords": "1"
        },
        `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`
      );
      const urlIn = el("input", {
        type: "text",
        placeholder: "https://… or /users/… or #",
        value: hs.url || "",
        style: "flex:1;min-width:0;",
        "aria-label": `Area ${index + 1} URL`,
        "data-oep-imap-url": "1"
      });
      urlIn.addEventListener("input", () => {
        hs.url = urlIn.value;
        refreshCode();
      });
      urlIn.addEventListener("focus", () => setSelectedIndex(index));
      const titleIn = el("input", {
        type: "text",
        placeholder: "Title (optional)",
        value: hs.title || "",
        style: "width:130px;flex-shrink:0;",
        "aria-label": `Area ${index + 1} title`
      });
      titleIn.addEventListener("input", () => {
        hs.title = titleIn.value;
        refreshCode();
      });
      titleIn.addEventListener("focus", () => setSelectedIndex(index));
      const removeBtn = modalButton("✕", {
        title: "Remove area",
        style: "padding:4px 7px;flex-shrink:0;"
      });
      removeBtn.addEventListener("click", () => {
        const i = hotspots.indexOf(hs);
        if (i !== -1) hotspots.splice(i, 1);
        if (selectedHotspotIndex === i) selectedHotspotIndex = -1;
        else if (selectedHotspotIndex > i) selectedHotspotIndex -= 1;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
      });
      const row = el(
        "div",
        {
          class: "oep-imap-row",
          "data-oep-imap-row": String(index),
          style: "display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:6px 8px;"
        },
        indexBadge,
        coordBadge,
        urlIn,
        titleIn,
        removeBtn
      );
      row.addEventListener("mousedown", (ev) => {
        const t = ev.target;
        if (t instanceof Element && t.closest("button")) return;
        if (t === urlIn || t === titleIn) return;
        setSelectedIndex(index);
        requestAnimationFrame(() => focusHotspotUrlInput(index));
      });
      return row;
    }
    function rebuildHotspotList() {
      while (hotspotListEl.firstChild)
        hotspotListEl.removeChild(hotspotListEl.firstChild);
      if (!hotspots.length) {
        hotspotListEl.appendChild(
          el(
            "div",
            { style: "font-size:12px;opacity:0.5;font-style:italic;" },
            "No areas yet — click and drag on the image above to add one."
          )
        );
        return;
      }
      hotspots.forEach(
        (hs, i) => hotspotListEl.appendChild(buildHotspotRow(hs, i))
      );
      syncSelectionVisuals();
    }
    drawLayer.addEventListener("mousedown", (ev) => {
      if (!imgLoaded) return;
      ev.preventDefault();
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const rectEl = el("div", {
        style: "position:absolute;box-sizing:border-box;border:2px dashed rgba(255,255,0,0.9);background:rgba(255,255,0,0.1);pointer-events:none;left:0;top:0;width:0;height:0;"
      });
      drawLayer.appendChild(rectEl);
      drawState = { startX: raw.x, startY: raw.y, rectEl };
    });
    const onGlobalMouseMove = (ev) => {
      if (modifyState) {
        onModifyMouseMove(ev);
        return;
      }
      if (pendingRectPick) {
        const d = Math.hypot(
          ev.clientX - pendingRectPick.sx,
          ev.clientY - pendingRectPick.sy
        );
        if (d > IMAP_DRAG_THRESHOLD_PX) {
          const pi = pendingRectPick.index;
          const bounds2 = imgEl.getBoundingClientRect();
          const startPt = pctRawFromEvent(
            { clientX: pendingRectPick.sx, clientY: pendingRectPick.sy },
            bounds2
          );
          const rEl = drawLayer.querySelector(
            `[data-oep-imap-rect="${String(pi)}"]`
          );
          if (startPt && rEl instanceof HTMLElement && hotspots[pi]) {
            modifyState = {
              type: "move",
              index: pi,
              startPt,
              startHs: {
                x: hotspots[pi].x,
                y: hotspots[pi].y,
                w: hotspots[pi].w,
                h: hotspots[pi].h
              },
              rectEl: rEl
            };
          }
          pendingRectPick = null;
        }
        return;
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        raw.x,
        raw.y
      );
      Object.assign(drawState.rectEl.style, {
        left: `${r.x}%`,
        top: `${r.y}%`,
        width: `${r.w}%`,
        height: `${r.h}%`
      });
    };
    const onGlobalMouseUp = (ev) => {
      if (modifyState) {
        finishModifyGesture();
      } else if (pendingRectPick) {
        const idx = pendingRectPick.index;
        pendingRectPick = null;
        requestAnimationFrame(() => focusHotspotUrlInput(idx));
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw = bounds.width && bounds.height ? pctRawFromEvent(ev, bounds) : null;
      const endX = raw ? raw.x : drawState.startX;
      const endY = raw ? raw.y : drawState.startY;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        endX,
        endY
      );
      drawState.rectEl.remove();
      drawState = null;
      if (r.w > 1 && r.h > 1) {
        hotspots.push({ x: r.x, y: r.y, w: r.w, h: r.h, url: "", title: "" });
        const newIdx = hotspots.length - 1;
        selectedHotspotIndex = newIdx;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
        requestAnimationFrame(() => focusHotspotUrlInput(newIdx));
      }
    };
    listen(document, "mousemove", onGlobalMouseMove, modal.signal);
    listen(document, "mouseup", onGlobalMouseUp, modal.signal);
    const loadImage = () => {
      const safe = safeHttpUrl(String(urlInput.value || "").trim());
      if (!safe) {
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent = "Invalid URL — must start with http:// or https://.";
        return;
      }
      imgLoaded = false;
      imgEl.style.display = "none";
      drawLayer.style.display = "none";
      imgPlaceholder.style.display = "";
      imgPlaceholder.textContent = "Loading…";
      imgEl.onload = () => {
        imgLoaded = true;
        imgPlaceholder.style.display = "none";
        imgEl.style.display = "block";
        drawLayer.style.display = "";
        refreshCode();
      };
      imgEl.onerror = () => {
        imgLoaded = false;
        imgEl.style.display = "none";
        drawLayer.style.display = "none";
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent = "Could not load image.";
      };
      imgEl.src = safe;
    };
    loadBtn.addEventListener("click", loadImage);
    urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") loadImage();
    });
    urlInput.addEventListener("input", refreshCode);
    importFromEditorBtn.addEventListener("click", () => {
      const v = textarea.value;
      const a = textarea.selectionStart ?? 0;
      const b = textarea.selectionEnd ?? a;
      const sel = a !== b ? v.slice(a, b) : "";
      let parsed = parseImagemapFromText(sel);
      if (!parsed) parsed = parseImagemapFromText(v);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent = "No [imagemap]…[/imagemap] block found in the selection or editor text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });
    importManualBtn.addEventListener("click", () => {
      setManualImportOpen(!manualImportOpen);
    });
    manualImportCloseBtn.addEventListener("click", () => {
      setManualImportOpen(false);
    });
    manualImportApplyBtn.addEventListener("click", () => {
      const parsed = parseImagemapFromText(manualImportTa.value);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent = "Could not parse [imagemap]…[/imagemap] from the pasted text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });
    const close = () => {
      modal.abort();
      shell.close();
    };
    if (signal) listen(signal, "abort", close, modal.signal);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (manualImportOpen) {
        setManualImportOpen(false);
        ev.stopPropagation();
        return;
      }
      close();
    });
    insertBtn.addEventListener("click", () => {
      const code = generateBbcode();
      if (!code) return;
      const start2 = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start2;
      replaceRange(textarea, start2, end, code);
      close();
    });
    card.appendChild(titleRow);
    card.appendChild(manualImportPanel);
    card.appendChild(urlRow);
    card.appendChild(imgScrollSection);
    card.appendChild(hotspotListEl);
    card.appendChild(codeRow);
    card.appendChild(actions);
    shell.show();
    rebuildHotspotList();
    refreshCode();
    urlInput.focus();
  }

  // src/editor/bbcode-helper/linter.js
  function parseBbcodeTagName(rawTag) {
    const s = String(rawTag || "").trim();
    if (!s) return "";
    const noSlash = s.startsWith("/") ? s.slice(1).trim() : s;
    const cutEq = noSlash.split("=")[0].trim();
    const cutSpace = cutEq.split(/\s+/)[0].trim();
    return cutSpace.toLowerCase();
  }
  var KNOWN_BBCODE_TAGS = /* @__PURE__ */ new Set([
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
    "notice"
  ]);
  function firstBbcodeFormatIssue(text) {
    const value = String(text || "");
    const lower = value.toLowerCase();
    const stack = [];
    let i = 0;
    while (i < value.length) {
      const open = value.indexOf("[", i);
      if (open === -1) break;
      const close = value.indexOf("]", open + 1);
      const nextOpen = value.indexOf("[", open + 1);
      if (close === -1 || nextOpen !== -1 && nextOpen < close) {
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
      if (name === "*") continue;
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
  function ensureBbcodeFormatChecker(_editorEl, textarea, session) {
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

  // src/editor/bbcode-helper/live-preview.js
  function renderBbcodePreviewInto(body, source) {
    const document2 = body.ownerDocument;
    if (!String(source ?? "").trim()) {
      body.replaceChildren(
        el("p", { class: BBHELP_PREVIEW_EMPTY_CLASS }, "Nothing to preview yet.")
      );
      return;
    }
    body.replaceChildren(sanitizeTree(renderBbcode(source, { document: document2 })));
  }
  function paintPreview(textarea, state2) {
    window.clearTimeout(state2.timer);
    state2.timer = 0;
    state2.preview.hidden = !state2.enabled;
    state2.toggle.setAttribute("aria-pressed", state2.enabled ? "true" : "false");
    if (state2.enabled) renderBbcodePreviewInto(state2.body, textarea.value || "");
  }
  function ensureBbcodeLivePreview(editorEl, textarea, session) {
    let state2 = session.previews.get(textarea);
    if (!state2) {
      const toggle = (
        /** @type {HTMLButtonElement} */
        el(
          "button",
          {
            type: "button",
            class: BBHELP_PREVIEW_TOGGLE_CLASS,
            [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
            "aria-pressed": "false",
            title: "Toggle live preview"
          },
          "Live preview"
        )
      );
      const body = el("div", { class: BBHELP_PREVIEW_BODY_CLASS });
      const preview = el(
        "section",
        {
          class: BBHELP_PREVIEW_CLASS,
          [BBHELP_PREVIEW_ATTR]: "1",
          hidden: "hidden"
        },
        el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
        body
      );
      const created = { enabled: false, timer: 0, toggle, preview, body };
      state2 = created;
      session.previews.set(textarea, created);
      const { signal } = session;
      listen(
        toggle,
        "click",
        () => {
          created.enabled = !created.enabled;
          paintPreview(textarea, created);
        },
        signal
      );
      listen(
        textarea,
        "input",
        () => {
          if (!created.enabled) return;
          window.clearTimeout(created.timer);
          created.timer = window.setTimeout(
            () => paintPreview(textarea, created),
            70
          );
        },
        signal
      );
      signal.addEventListener("abort", () => window.clearTimeout(created.timer), {
        once: true
      });
    }
    if (state2.preview.parentElement !== textarea.parentElement || !state2.preview.isConnected) {
      textarea.insertAdjacentElement("afterend", state2.preview);
    }
    placeBbcodePreviewToggle(editorEl, textarea, state2.toggle);
  }

  // src/editor/bbcode-helper/styles.js
  var BBHELP_CSS = `
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
    /* inline-block so [centre] and [right] align images, as on osu-web */
    display: inline-block;
    vertical-align: top;
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
  function acquireBbcodeHelperStyles() {
    return manageStyle(BBHELP_STYLE_ID, BBHELP_CSS).acquire();
  }

  // src/editor/bbcode-helper/pickers.js
  function openColorPicker(textarea) {
    const modal = createBbcodeModal();
    const { overlay, card } = modal;
    const title = modalTitle("Font color");
    const colorInput = el("input", {
      type: "color",
      value: "#ff66aa",
      "aria-label": "Pick a color"
    });
    const textInput = el("input", {
      type: "text",
      value: "#ff66aa",
      placeholder: "#RRGGBB or color name",
      "aria-label": "Color value"
    });
    const swatch = el("div", { class: `${BBHELP_MODAL_CLASS}__swatch` });
    const colorGrid = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__color-grid` },
      colorInput,
      textInput
    );
    const hint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint` },
      "Use picker for hex color, or type a color name (e.g. red)."
    );
    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = modalButton("Cancel");
    const applyBtn = modalButton("Apply");
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);
    const updateSwatch = () => {
      const v = String(textInput.value || "").trim();
      swatch.style.background = v || "#ff66aa";
    };
    const close = modal.close;
    const hintText = hint.textContent;
    const apply = () => {
      const value = String(textInput.value || "").trim();
      if (!value) return;
      if (!isBbcodeColor(value)) {
        textInput.setAttribute("aria-invalid", "true");
        hint.textContent = "Use #RRGGBB or a color name (letters only).";
        textInput.focus();
        return;
      }
      toggleWrap(textarea, `[color=${value}]`, "[/color]");
      close();
    };
    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      updateSwatch();
    });
    textInput.addEventListener("input", () => {
      textInput.removeAttribute("aria-invalid");
      hint.textContent = hintText;
      updateSwatch();
    });
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    bindPickerKeys(overlay, { apply, close });
    card.appendChild(title);
    card.appendChild(colorGrid);
    card.appendChild(swatch);
    card.appendChild(hint);
    card.appendChild(actions);
    modal.show();
    textInput.focus();
    textInput.select();
    updateSwatch();
  }
  function openSizePicker(textarea) {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const modeName = `oep-size-mode-${uid}`;
    const modePresetId = `oep-size-mode-preset-${uid}`;
    const modeManualId = `oep-size-mode-manual-${uid}`;
    const modal = createBbcodeModal();
    const { overlay, card } = modal;
    const title = modalTitle("Font size");
    const modeWrap = el("div", { class: `${BBHELP_MODAL_CLASS}__modes` });
    const presetRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modePresetId,
      value: "preset",
      checked: "checked"
    });
    const manualRadio = el("input", {
      type: "radio",
      name: modeName,
      id: modeManualId,
      value: "manual"
    });
    modeWrap.appendChild(
      el(
        "label",
        { for: modePresetId },
        presetRadio,
        " Preset (tiny/small/normal/large)"
      )
    );
    modeWrap.appendChild(
      el("label", { for: modeManualId }, manualRadio, " Manual number")
    );
    const presetField = el("div", { class: `${BBHELP_MODAL_CLASS}__field` });
    const presetSelect = el(
      "select",
      {},
      // osu-web's editor presets; [size=] takes only numbers (B98).
      el("option", { value: "50" }, "tiny (50)"),
      el("option", { value: "85" }, "small (85)"),
      el("option", { value: "100", selected: "selected" }, "normal (100)"),
      el("option", { value: "150" }, "large (150)")
    );
    presetField.appendChild(presetSelect);
    const manualField = el("div", {
      class: `${BBHELP_MODAL_CLASS}__field`,
      style: "display:none;"
    });
    const manualInput = el("input", {
      type: "number",
      min: "30",
      max: "200",
      step: "1",
      value: "100",
      placeholder: "30 - 200"
    });
    manualField.appendChild(manualInput);
    manualField.appendChild(
      el("div", { class: `${BBHELP_MODAL_CLASS}__hint` }, "Range: 30-200")
    );
    const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
    const cancelBtn = modalButton("Cancel");
    const applyBtn = modalButton("Apply");
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);
    const close = modal.close;
    const syncMode = () => {
      const isPreset = presetRadio.checked;
      presetField.style.display = isPreset ? "" : "none";
      manualField.style.display = isPreset ? "none" : "";
      if (isPreset) presetSelect.focus();
      else manualInput.focus();
    };
    const apply = () => {
      const sizeValue2 = presetRadio.checked ? String(presetSelect.value || "").trim() : String(
        Math.max(
          30,
          Math.min(200, Math.round(Number(manualInput.value) || 0))
        )
      );
      if (!sizeValue2 || sizeValue2 === "0") return;
      toggleWrap(textarea, `[size=${sizeValue2}]`, "[/size]");
      close();
    };
    presetRadio.addEventListener("change", syncMode);
    manualRadio.addEventListener("change", syncMode);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    bindPickerKeys(overlay, { apply, close });
    card.appendChild(title);
    card.appendChild(modeWrap);
    card.appendChild(presetField);
    card.appendChild(manualField);
    card.appendChild(actions);
    modal.show();
    syncMode();
  }

  // src/editor/bbcode-helper/toolbar.js
  function createBbcodeButtons(textarea) {
    const specs = [
      {
        label: "Bold",
        title: "Bold",
        icon: "fas fa-bold",
        open: "[b]",
        close: "[/b]"
      },
      {
        label: "Italic",
        title: "Italic",
        icon: "fas fa-italic",
        open: "[i]",
        close: "[/i]"
      },
      {
        label: "Underline",
        title: "Underline",
        icon: "fas fa-underline",
        open: "[u]",
        close: "[/u]"
      },
      {
        label: "Strike",
        title: "Strike",
        icon: "fas fa-strikethrough",
        open: "[s]",
        close: "[/s]"
      },
      {
        label: "Heading",
        title: "Heading",
        icon: "fas fa-heading",
        open: "[heading]",
        close: "[/heading]"
      },
      {
        label: "Quote",
        title: "Quote",
        icon: "fas fa-quote-right",
        open: "[quote]",
        close: "[/quote]"
      },
      {
        label: "Code",
        title: "Code",
        icon: "fas fa-code",
        open: "[code]",
        close: "[/code]"
      },
      {
        label: "Spoiler Box",
        title: "Spoiler Box",
        icon: "fas fa-box-open",
        open: "[box]",
        close: "[/box]"
      },
      {
        label: "Color",
        title: "Font color",
        icon: "fas fa-palette",
        onClick: () => openColorPicker(textarea)
      },
      {
        label: "Size",
        title: "Font size",
        icon: "fas fa-text-height",
        onClick: () => openSizePicker(textarea)
      },
      {
        label: "Link",
        title: "Link",
        icon: "fas fa-link",
        open: "[url]",
        close: "[/url]"
      },
      {
        label: "Image",
        title: "Image",
        icon: "far fa-image",
        open: "[img]",
        close: "[/img]"
      },
      {
        label: "List",
        title: "List",
        icon: "fas fa-list-ul",
        open: "[list]\n[*]",
        close: "\n[/list]"
      },
      {
        label: "Center",
        title: "Center",
        icon: "fas fa-align-center",
        open: "[centre]",
        close: "[/centre]"
      },
      {
        label: "Right",
        title: "Right",
        icon: "fas fa-align-right",
        open: "[right]",
        close: "[/right]"
      }
    ];
    return specs.map(
      (spec) => el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: spec.title,
          onclick: () => typeof spec.onClick === "function" ? spec.onClick() : toggleWrap(textarea, spec.open, spec.close)
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label)
      )
    );
  }

  // src/editor/bbcode-helper/manager.js
  function enhanceSingleBbcodeEditor(editorEl, session) {
    if (!(editorEl instanceof HTMLElement)) return;
    const textarea = editorEl.querySelector(BBHELP_INPUT_SELECTOR);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    ensureBbcodeFormatChecker(editorEl, textarea, session);
    ensureBbcodeLivePreview(editorEl, textarea, session);
    if (editorEl.hasAttribute(BBHELP_DONE_ATTR)) return;
    let editorId = editorEl.getAttribute(BBHELP_EDITOR_ID_ATTR);
    if (!editorId) {
      editorId = `oep-bbhelp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      editorEl.setAttribute(BBHELP_EDITOR_ID_ATTR, editorId);
    }
    const existingWrap = editorEl.querySelector(`:scope > .${BBHELP_WRAP_CLASS}`);
    if (existingWrap) {
      editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
      existingWrap.setAttribute(BBHELP_WRAP_FOR_ATTR, editorId);
      return;
    }
    const wrap = el("div", {
      class: BBHELP_WRAP_CLASS,
      [BBHELP_WRAP_FOR_ATTR]: editorId
    });
    const row = el("div", { class: BBHELP_ROW_CLASS });
    createBbcodeButtons(textarea).forEach((btn) => row.appendChild(btn));
    wrap.appendChild(row);
    const row2 = el("div", {
      class: BBHELP_ROW_CLASS,
      style: "margin-top:4px;"
    });
    row2.appendChild(
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Open ImageMap helper",
          onclick: () => openImagemapHelper(textarea, session.signal)
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} fas fa-map-marked-alt` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, "Imagemap helper")
      )
    );
    wrap.appendChild(row2);
    editorEl.insertBefore(wrap, editorEl.firstChild);
    editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
  }
  function isElementActuallyVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!node.isConnected) return false;
    if (node.hidden) return false;
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (node.getClientRects().length === 0) return false;
    return true;
  }
  function teardownBbcodeHelpers() {
    document.querySelectorAll(`.${BBHELP_MODAL_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(`.${BBHELP_WARN_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(`.${BBHELP_PREVIEW_TOGGLE_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(`.${BBHELP_PREVIEW_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(`${BBHELP_EDITOR_SELECTOR}[${BBHELP_DONE_ATTR}]`).forEach((n) => n.removeAttribute(BBHELP_DONE_ATTR));
  }
  function startBbcodeHelperManager() {
    const releaseStyles = acquireBbcodeHelperStyles();
    const ac = new AbortController();
    const session = {
      signal: ac.signal,
      /** @type {WeakMap<HTMLTextAreaElement, any>} */
      previews: /* @__PURE__ */ new WeakMap(),
      /** @type {WeakMap<HTMLTextAreaElement, HTMLElement>} */
      warnings: /* @__PURE__ */ new WeakMap()
    };
    const scan = () => {
      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        const parent = wrap.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (!parent.matches(BBHELP_EDITOR_SELECTOR)) wrap.remove();
      });
      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        const editorId = wrap.getAttribute(BBHELP_WRAP_FOR_ATTR);
        const editor = editorId ? document.querySelector(
          `${BBHELP_EDITOR_SELECTOR}[${BBHELP_EDITOR_ID_ATTR}="${editorId}"]`
        ) : null;
        if (!(editor instanceof HTMLElement) || !isElementActuallyVisible(editor)) {
          if (editor instanceof HTMLElement) {
            editor.removeAttribute(BBHELP_DONE_ATTR);
          }
          wrap.remove();
        }
      });
      document.querySelectorAll(BBHELP_EDITOR_SELECTOR).forEach((editorEl) => {
        if (isElementActuallyVisible(editorEl))
          enhanceSingleBbcodeEditor(editorEl, session);
      });
    };
    scan();
    observe.subscribe(
      {
        selector: `${BBHELP_EDITOR_SELECTOR}, ${BBHELP_EDITOR_SELECTOR} ${BBHELP_INPUT_SELECTOR}`,
        schedule: "sync",
        signal: ac.signal,
        label: "profile/bbcode-helper"
      },
      scan
    );
    return () => {
      ac.abort();
      teardownBbcodeHelpers();
      releaseStyles();
    };
  }

  // src/features/profile/badges.js
  var PROFILE_BADGES_COLLAPSE_STYLE_ID = "osu-expertplus-profile-badges-collapse";
  var PROFILE_BADGES_WRAP_CLASS = "oep-profile-badges-wrap";
  var PROFILE_BADGES_DONE_ATTR = "data-oep-profile-badges-done";
  var PROFILE_BADGES_COLLAPSE_CSS = `
  .${PROFILE_BADGES_WRAP_CLASS} {
    position: relative;
  }
  .${PROFILE_BADGES_WRAP_CLASS}--collapsed .profile-badges {
    display: none;
  }
  .${PROFILE_BADGES_WRAP_CLASS}--collapsed {
    min-height: 36px;
  }
  .oep-profile-badges-toggle {
    position: absolute;
    z-index: 5;
    top: 8px;
    right: 8px;
  }
`;
  var badgesCollapseStyle = manageStyle(
    PROFILE_BADGES_COLLAPSE_STYLE_ID,
    PROFILE_BADGES_COLLAPSE_CSS
  );
  function injectProfileBadgesCollapseStyles() {
    badgesCollapseStyle.inject();
  }
  function removeProfileBadgesCollapseStyles() {
    badgesCollapseStyle.remove();
  }
  function enhanceProfileBadgesStrip(badgesRoot) {
    if (badgesRoot.hasAttribute(PROFILE_BADGES_DONE_ATTR)) return;
    if (!badgesRoot.classList.contains("profile-badges")) return;
    const parent = badgesRoot.parentNode;
    if (!parent) return;
    const shell = el("div", { class: PROFILE_BADGES_WRAP_CLASS });
    parent.insertBefore(shell, badgesRoot);
    shell.appendChild(badgesRoot);
    const collapsedStored = getBool(KEYS.PROFILE_BADGES_COLLAPSED);
    if (collapsedStored) {
      shell.classList.add(`${PROFILE_BADGES_WRAP_CLASS}--collapsed`);
    }
    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "btn-circle oep-profile-badges-toggle",
        "aria-expanded": collapsedStored ? "false" : "true",
        title: collapsedStored ? "Show profile badges" : "Hide profile badges"
      },
      el("span", {
        class: collapsedStored ? "fas fa-chevron-down" : "fas fa-chevron-up"
      })
    );
    shell.appendChild(toggleBtn);
    badgesRoot.setAttribute(PROFILE_BADGES_DONE_ATTR, "1");
    const applyToggleUi = (collapsed) => {
      const icon = toggleBtn.querySelector(".fas");
      if (icon) {
        icon.className = collapsed ? "fas fa-chevron-down" : "fas fa-chevron-up";
      }
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleBtn.title = collapsed ? "Show profile badges" : "Hide profile badges";
    };
    toggleBtn.addEventListener("click", () => {
      const collapsed = shell.classList.toggle(
        `${PROFILE_BADGES_WRAP_CLASS}--collapsed`
      );
      setBool(KEYS.PROFILE_BADGES_COLLAPSED, collapsed);
      applyToggleUi(collapsed);
    });
  }
  function teardownProfileBadgesCollapse() {
    document.querySelectorAll(`.${PROFILE_BADGES_WRAP_CLASS}`).forEach((shell) => {
      const badges = shell.querySelector(".profile-badges");
      const shellParent = shell.parentNode;
      if (badges && shellParent) {
        badges.removeAttribute(PROFILE_BADGES_DONE_ATTR);
        shellParent.insertBefore(badges, shell);
      }
      shell.remove();
    });
    removeProfileBadgesCollapseStyles();
  }
  function startProfileBadgesCollapseManager() {
    injectProfileBadgesCollapseStyles();
    const scan = () => {
      document.querySelectorAll(".profile-badges").forEach((node) => {
        if (node instanceof HTMLElement && !node.hasAttribute(PROFILE_BADGES_DONE_ATTR)) {
          enhanceProfileBadgesStrip(node);
        }
      });
    };
    scan();
    const ac = new AbortController();
    observe.subscribe(
      {
        selector: ".profile-badges",
        schedule: "sync",
        signal: ac.signal,
        label: "profile/badges"
      },
      scan
    );
    return () => {
      ac.abort();
      teardownProfileBadgesCollapse();
    };
  }

  // src/features/profile/profile-target.js
  var INITIAL_DATA_SEL = ".js-react[data-initial-data]";
  function initialDataChange(ms) {
    return new Promise((resolve2) => {
      const ac = new AbortController();
      const done = () => {
        clearTimeout(timer);
        ac.abort();
        resolve2();
      };
      const timer = setTimeout(done, ms);
      observe.subscribe(
        {
          selector: INITIAL_DATA_SEL,
          attributes: ["data-initial-data"],
          schedule: "sync",
          signal: ac.signal,
          label: "profile/target"
        },
        done
      );
    });
  }
  function getUserIdFromUrl() {
    const m = location.pathname.match(/^\/users\/(\d+)/);
    return m ? m[1] : null;
  }
  var initialDataCache = /* @__PURE__ */ new WeakMap();
  function parseInitialDataNode(node) {
    const raw = node.dataset.initialData ?? "";
    const cached = initialDataCache.get(node);
    if (cached && cached.raw === raw) return cached.data;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = null;
    }
    initialDataCache.set(node, { raw, data });
    return data;
  }
  function parseProfileInitialData() {
    const nodes = document.querySelectorAll(INITIAL_DATA_SEL);
    for (const node of nodes) {
      const data = parseInitialDataNode(node);
      if (data?.user?.id != null) return data;
    }
    return null;
  }
  function getProfileUserId() {
    const fromUrl = getUserIdFromUrl();
    if (fromUrl) return fromUrl;
    const data = profileInitialDataForUrl();
    return data?.user?.id != null ? String(data.user.id) : null;
  }
  function getModeFromUrl() {
    return rulesetFromProfileUrl(location.pathname, location.search);
  }
  function profileDataMatchesUrl(data) {
    if (!data?.user) return false;
    const m = location.pathname.match(/^\/users\/([^/]+)/);
    if (!m) return true;
    const seg = decodeURIComponent(m[1]);
    if (/^\d+$/.test(seg)) return String(data.user.id) === seg;
    const norm = (s) => String(s).toLowerCase().replace(/[\s_]+/g, "_");
    return norm(data.user.username ?? "") === norm(seg);
  }
  function profileDataMatchesLocation(data) {
    if (!profileDataMatchesUrl(data)) return false;
    const want = getModeFromUrl() ?? data.user.playmode;
    return !want || (data.current_mode ?? "osu") === want;
  }
  function profileInitialDataForUrl() {
    const data = parseProfileInitialData();
    return data && profileDataMatchesUrl(data) ? data : null;
  }
  function getCurrentMode() {
    const fromUrl = getModeFromUrl();
    if (fromUrl) return fromUrl;
    const data = parseProfileInitialData();
    if (data?.current_mode && profileDataMatchesLocation(data)) {
      return data.current_mode;
    }
    if (profileDataMatchesUrl(data) && data.user.playmode) {
      return data.user.playmode;
    }
    return "osu";
  }
  function profileTarget(userId, mode) {
    const me = getCurrentUserIdFromHeader();
    return { userId, mode, isOwnProfile: me != null && me === String(userId) };
  }
  async function resolveProfileTarget(timeoutMs = 8e3) {
    const start2 = Date.now();
    const urlId = getUserIdFromUrl();
    const urlMode = getModeFromUrl();
    if (urlId && urlMode) return profileTarget(urlId, urlMode);
    for (; ; ) {
      const data = parseProfileInitialData();
      if (data && profileDataMatchesLocation(data)) {
        return profileTarget(
          String(data.user.id),
          urlMode ?? data.current_mode ?? "osu"
        );
      }
      const left = timeoutMs - (Date.now() - start2);
      if (left <= 0) return null;
      await initialDataChange(left);
    }
  }
  function getCurrentUserIdFromHeader() {
    const link = document.querySelector(
      "a.u-current-user-avatar[href*='/users/'], a.u-current-user-cover[href*='/users/']"
    );
    if (!(link instanceof HTMLAnchorElement)) return null;
    const href = link.getAttribute("href") || "";
    const m = href.match(/\/users\/(\d+)(?:\/|$)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? String(n) : null;
  }

  // src/features/profile/bws.js
  var BWS_STYLE_ID = "osu-expertplus-bws-ranking";
  var BWS_VALUES_ROW_CLASS = "oep-bws-rank-values";
  var BWS_ATTR = "data-oep-bws";
  var BWS_KIRINO_COL_ATTR = "data-oep-bws-rank-col";
  var KIRINO_SCORE_RANK_COLUMN = false;
  var BWS_BADGE_EXCLUSION_PHRASES = [
    "mapping",
    "beatmap",
    "longstanding",
    "pooling",
    "contribution",
    "mapper",
    "community choice",
    "pending cup",
    "newspaper cup"
  ];
  var BWS_RANKING_CSS = `
  .profile-detail-stats__chart-numbers--top .profile-detail-stats__values.${BWS_VALUES_ROW_CLASS},
  .profile-detail__chart-numbers--top .profile-detail__values.${BWS_VALUES_ROW_CLASS} {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    column-gap: 1.25rem;
    row-gap: 0.35rem;
  }
  /* Left-aligned like the Global/Country values beside it (B90). */
  .oep-bws-value-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    min-width: 0;
    text-align: left;
  }
  .oep-bws-controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.35rem;
    font-size: 12px;
    line-height: 1.35;
    color: hsl(var(--hsl-l2, 0 0% 75%));
  }
  .oep-bws-adjust-row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: 0.35rem;
  }
  .oep-bws-badge-adjust-input {
    width: 4.25rem;
    padding: 0.15em 0.35em;
    font-size: inherit;
    font-variant-numeric: tabular-nums;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-l3, 0 0% 40%));
    background: hsl(var(--hsl-b5, 0 0% 12%));
    color: inherit;
    box-sizing: border-box;
  }
  a.oep-bws-kirino-rank-link {
    text-decoration: none;
    color: inherit;
  }
  a.oep-bws-kirino-rank-link:hover {
    text-decoration: underline;
  }
`;
  var bwsRankingStyle = manageStyle(BWS_STYLE_ID, BWS_RANKING_CSS);
  function bwsStripHtmlToText(htmlOrText) {
    if (htmlOrText == null) return "";
    const doc = new DOMParser().parseFromString(String(htmlOrText), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }
  function bwsBadgeDescriptionText(badgeEl) {
    if (!(badgeEl instanceof HTMLElement)) return "";
    const parts = [];
    const t1 = badgeEl.getAttribute("title");
    if (t1) parts.push(t1);
    const ht = badgeEl.getAttribute("data-html-title");
    if (ht) parts.push(bwsStripHtmlToText(ht));
    const ot = badgeEl.getAttribute("data-orig-title");
    if (ot) parts.push(ot);
    return parts.join(" ").trim();
  }
  function bwsBadgeExcludedByKeywords(descriptionPlain) {
    const d = String(descriptionPlain).toLowerCase();
    if (!d) return false;
    return BWS_BADGE_EXCLUSION_PHRASES.some((p) => d.includes(p));
  }
  function analyzeBadgesForBws() {
    const nodes = document.querySelectorAll(
      ".profile-badges .profile-badges__badge"
    );
    let total = 0;
    let eligible = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      total += 1;
      const desc = bwsBadgeDescriptionText(node);
      if (bwsBadgeExcludedByKeywords(desc)) continue;
      eligible += 1;
    }
    return {
      total,
      eligible,
      excluded: Math.max(0, total - eligible)
    };
  }
  var PROFILE_HEADER_RANK_VALUES_SELECTOR = [
    ".profile-detail-stats__chart-numbers--top .profile-detail-stats__values",
    ".profile-detail__chart-numbers--top .profile-detail__values"
  ].join(", ");
  function findProfileHeaderRankValuesRow() {
    return document.querySelector(PROFILE_HEADER_RANK_VALUES_SELECTOR);
  }
  function parseProfileGlobalRankForBws() {
    const data = parseProfileInitialData();
    const mode = getCurrentMode();
    const fromRulesets = data?.user?.statistics_rulesets?.[mode]?.global_rank;
    if (fromRulesets != null) {
      const n = Number(fromRulesets);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const fromStats = data?.user?.statistics?.global_rank;
    if (fromStats != null) {
      const n = Number(fromStats);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }
  function computeBwsRankValue(globalRank, badgeCount) {
    const r = Number(globalRank);
    const b = Math.max(0, Math.floor(Number(badgeCount)) || 0);
    if (!Number.isFinite(r) || r <= 0) return null;
    const exponent = Math.pow(0.9937, b * b);
    return Math.pow(r, exponent);
  }
  function formatProfileRankSharpDisplay(n) {
    const rounded = Math.round(Number(n));
    if (!Number.isFinite(rounded)) return "—";
    const locale = typeof window.currentLocale === "string" ? window.currentLocale : document.documentElement.lang || void 0;
    try {
      return `#${rounded.toLocaleString(locale)}`;
    } catch {
      return `#${rounded}`;
    }
  }
  function teardownBwsRankingDisplay() {
    document.querySelectorAll(`[${BWS_ATTR}="1"]`).forEach((n) => n.remove());
    document.querySelectorAll(`[${BWS_KIRINO_COL_ATTR}]`).forEach((n) => n.remove());
    document.querySelectorAll(`.${BWS_VALUES_ROW_CLASS}`).forEach((el2) => el2.classList.remove(BWS_VALUES_ROW_CLASS));
  }
  function createKirinoScoreRank(onChange) {
    const ac = new AbortController();
    let key = "";
    let status = "idle";
    let scoreRank = null;
    function resetIfNeeded() {
      const uid = getProfileUserId();
      if (uid == null) return;
      const next = `${uid}:${getCurrentMode()}`;
      if (key !== next) {
        key = next;
        status = "idle";
        scoreRank = null;
      }
    }
    function ensureFetch() {
      const uid = getProfileUserId();
      if (uid == null || ac.signal.aborted) return;
      resetIfNeeded();
      if (status !== "idle") return;
      const data = parseProfileInitialData();
      if (String(data?.user?.id ?? "") !== String(uid)) return;
      status = "loading";
      const modeIdx = modeIndexForRuleset(getCurrentMode());
      const uname = data.user.username ?? "";
      const fetchKey = key;
      const settle = (nextStatus, rank) => {
        if (ac.signal.aborted) return;
        resetIfNeeded();
        if (key !== fetchKey) return;
        status = nextStatus;
        scoreRank = rank;
        onChange();
      };
      fetchInspectorProfile(uid, modeIdx, uname, { signal: ac.signal }).then((json) => {
        const sr = Number(json?.stats?.scoreRank ?? NaN);
        settle("ready", Number.isFinite(sr) && sr > 0 ? sr : null);
      }).catch(() => settle("error", null));
    }
    return {
      /** @returns {{ display: string, href: string }} */
      columnState() {
        ensureFetch();
        const href = bwsOfficialScoreRankingsHref(
          status === "ready" ? scoreRank : null
        );
        if (status === "loading" || status === "idle") {
          return { display: "…", href };
        }
        if (status === "error") return { display: "—", href };
        return { display: bwsFormatRankSharpOrDash(scoreRank), href };
      },
      dispose() {
        ac.abort();
      }
    };
  }
  function bwsFormatRankSharpOrDash(n) {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return "—";
    return formatProfileRankSharpDisplay(x);
  }
  function bwsOfficialScoreRankingsHref(scoreRank) {
    const mode = getCurrentMode() || "osu";
    const u = new URL(
      `https://osu.ppy.sh/rankings/${encodeURIComponent(mode)}/score`
    );
    if (mode === "mania") {
      const m = location.search.match(/[?&]variant=(4k|7k)/i);
      if (m) u.searchParams.set("variant", m[1].toLowerCase());
    }
    const r = scoreRank != null ? Number(scoreRank) : NaN;
    if (Number.isFinite(r) && r > 0) {
      u.searchParams.set("page", String(Math.max(1, Math.ceil(r / 50))));
    }
    return u.href;
  }
  function bwsBuildKirinoScoreRankColumn(display, href) {
    return el(
      "div",
      {
        class: "value-display value-display--rank",
        [BWS_KIRINO_COL_ATTR]: "score"
      },
      el(
        "div",
        { class: "value-display__label u-ellipsis-overflow" },
        "Score Ranking"
      ),
      el(
        "div",
        { class: "value-display__value u-ellipsis-overflow" },
        el(
          "a",
          {
            class: "rank-value rank-value--base oep-bws-kirino-rank-link",
            href
          },
          display
        )
      )
    );
  }
  function bwsSyncKirinoScoreRankColumn(valuesRow, bwsRowEl, state2) {
    const row = valuesRow.querySelector(`[${BWS_KIRINO_COL_ATTR}="score"]`);
    if (!(row instanceof HTMLElement)) {
      bwsRowEl.insertAdjacentElement(
        "afterend",
        bwsBuildKirinoScoreRankColumn(state2.display, state2.href)
      );
      return;
    }
    const valHost = row.querySelector(".value-display__value");
    let link = row.querySelector("a.oep-bws-kirino-rank-link");
    if (!(link instanceof HTMLAnchorElement)) {
      row.querySelector(".rank-value")?.remove();
      if (!(valHost instanceof HTMLElement)) return;
      link = document.createElement("a");
      link.className = "rank-value rank-value--base oep-bws-kirino-rank-link";
      valHost.appendChild(link);
    }
    if (link.href !== state2.href) link.href = state2.href;
    if (link.textContent !== state2.display) link.textContent = state2.display;
    link.removeAttribute("title");
  }
  function bwsBuildTitle(globalRank, count) {
    const exponent = Math.pow(0.9937, count * count);
    const bwsVal = computeBwsRankValue(globalRank, count);
    const expStr = exponent.toFixed(4);
    const resultStr = bwsVal != null ? Math.round(bwsVal).toLocaleString() : "?";
    return `rank ^ (0.9937 ^ (badges²)) = ${globalRank.toLocaleString()} ^ (0.9937 ^ ${count}²) = ${globalRank.toLocaleString()} ^ ${expStr} = ${resultStr}`;
  }
  function bwsEffectiveBadgeCountFromInput(inp, eligible) {
    if (!(inp instanceof HTMLInputElement)) return eligible;
    const raw = inp.value.trim();
    if (raw === "") return eligible;
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) && n >= 0 ? n : eligible;
  }
  function setBwsRankValue(rv, globalRank, count) {
    if (!(rv instanceof HTMLElement)) return;
    const display = formatProfileRankSharpDisplay(
      computeBwsRankValue(globalRank, count)
    );
    const title = bwsBuildTitle(globalRank, count);
    if (rv.textContent !== display) rv.textContent = display;
    if (rv.getAttribute("title") !== title) rv.setAttribute("title", title);
  }
  function bwsUpdateRankDisplay(inp) {
    const globalRank = parseProfileGlobalRankForBws();
    if (globalRank == null) return;
    const eligible = analyzeBadgesForBws().eligible;
    setBwsRankValue(
      inp.closest(`[${BWS_ATTR}="1"]`)?.querySelector(".rank-value") ?? null,
      globalRank,
      bwsEffectiveBadgeCountFromInput(inp, eligible)
    );
  }
  function wireBwsAdjustInput(inp) {
    if (!(inp instanceof HTMLInputElement)) return;
    if (inp.dataset.oepBwsWired === "1") return;
    inp.dataset.oepBwsWired = "1";
    inp.addEventListener("input", () => {
      bwsUpdateRankDisplay(inp);
    });
    inp.addEventListener("blur", () => {
      const eligible = analyzeBadgesForBws().eligible;
      const raw = inp.value.trim();
      const n = Math.trunc(Number(raw));
      if (raw === "" || !Number.isFinite(n) || n < 0) {
        inp.value = String(eligible);
      }
      bwsUpdateRankDisplay(inp);
    });
  }
  function buildBwsRow(eligible) {
    const inp = el("input", {
      type: "number",
      class: "oep-bws-badge-adjust-input",
      step: "1",
      min: "0",
      value: String(eligible)
    });
    wireBwsAdjustInput(inp);
    return el(
      "div",
      {
        class: "value-display value-display--rank",
        [BWS_ATTR]: "1"
      },
      el(
        "div",
        { class: "value-display__label u-ellipsis-overflow" },
        "BWS Ranking"
      ),
      el(
        "div",
        { class: "value-display__value oep-bws-value-stack" },
        el("div", { class: "rank-value rank-value--base" }),
        el(
          "div",
          { class: "oep-bws-controls" },
          el("label", { class: "oep-bws-adjust-row" }, "Badges ", inp)
        )
      )
    );
  }
  function syncBwsRankingDisplay(kirino) {
    const valuesRow = findProfileHeaderRankValuesRow();
    if (!(valuesRow instanceof HTMLElement)) {
      teardownBwsRankingDisplay();
      return;
    }
    const globalRank = parseProfileGlobalRankForBws();
    if (globalRank == null) {
      valuesRow.querySelector(`[${BWS_ATTR}="1"]`)?.remove();
      valuesRow.querySelectorAll(`[${BWS_KIRINO_COL_ATTR}]`).forEach((n) => n.remove());
      valuesRow.classList.remove(BWS_VALUES_ROW_CLASS);
      return;
    }
    valuesRow.classList.add(BWS_VALUES_ROW_CLASS);
    const eligible = analyzeBadgesForBws().eligible;
    let bwsRow = valuesRow.querySelector(`[${BWS_ATTR}="1"]`);
    if (!(bwsRow instanceof HTMLElement)) {
      bwsRow = buildBwsRow(eligible);
      const countryEl = valuesRow.querySelectorAll(
        ":scope > .value-display--rank"
      )[1];
      if (countryEl) {
        countryEl.insertAdjacentElement("afterend", bwsRow);
      } else {
        valuesRow.appendChild(bwsRow);
      }
    }
    const inp = bwsRow.querySelector(".oep-bws-badge-adjust-input");
    setBwsRankValue(
      bwsRow.querySelector(".rank-value"),
      globalRank,
      bwsEffectiveBadgeCountFromInput(inp, eligible)
    );
    bwsRow.querySelector(".value-display__value")?.classList.add("oep-bws-value-stack");
    if (inp instanceof HTMLInputElement) {
      inp.removeAttribute("title");
      wireBwsAdjustInput(inp);
    }
    if (KIRINO_SCORE_RANK_COLUMN) {
      bwsSyncKirinoScoreRankColumn(valuesRow, bwsRow, kirino.columnState());
    }
  }
  var BWS_WATCH_SELECTOR = [
    PROFILE_HEADER_RANK_VALUES_SELECTOR,
    ".profile-detail-stats__values > .value-display",
    ".profile-detail__values > .value-display",
    ".profile-badges",
    `[${BWS_ATTR}]`,
    `[${BWS_KIRINO_COL_ATTR}]`
  ].join(", ");
  function mountBwsRanking() {
    bwsRankingStyle.inject();
    const ac = new AbortController();
    let debounceTimer = 0;
    const schedule = () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!ac.signal.aborted) syncBwsRankingDisplay(kirino);
      }, 50);
    };
    const kirino = createKirinoScoreRank(schedule);
    observe.subscribe(
      {
        selector: BWS_WATCH_SELECTOR,
        schedule: "sync",
        // debounced above
        signal: ac.signal,
        label: "profile/bws"
      },
      schedule
    );
    schedule();
    return () => {
      ac.abort();
      kirino.dispose();
      clearTimeout(debounceTimer);
      teardownBwsRankingDisplay();
      bwsRankingStyle.remove();
    };
  }

  // src/features/profile/sections-dom.js
  var SECTION_PAGE_SEL = "div.js-sortable--page[data-page-id]";
  var SECTION_TITLE_SEL = "h2.title.title--page-extra";
  var SUBSECTION_TITLE_SEL = "h3.title.title--page-extra-small";
  var HASH_LINK_SEL = 'a[href^="#"]';
  function getSectionPageNodes() {
    return Array.from(document.querySelectorAll(SECTION_PAGE_SEL)).filter(
      (n) => n instanceof HTMLElement
    );
  }
  function sectionIdFromHashHref(href) {
    if (!href || href[0] !== "#") return "";
    const hash = href.slice(1).trim();
    return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
  }
  function getContentsAnchorRows(minTabs = 1) {
    const validIds = new Set(
      getSectionPageNodes().map((p) => p.getAttribute("data-page-id")).filter((v) => typeof v === "string" && v.length > 0)
    );
    if (!validIds.size) return [];
    const containerMap = /* @__PURE__ */ new Map();
    for (const a of document.querySelectorAll(HASH_LINK_SEL)) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      if (!validIds.has(sectionIdFromHashHref(a.getAttribute("href") || ""))) {
        continue;
      }
      const parent = a.parentElement;
      if (!parent) continue;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    }
    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length >= minTabs
    );
  }
  function readCollapsedSet(key) {
    const parsed = getJSON(key, null);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === "string" && x));
    }
    if (parsed && typeof parsed === "object") {
      return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
    }
    return /* @__PURE__ */ new Set();
  }
  function writeCollapsedSet(key, set) {
    const obj = (
      /** @type {Record<string, true>} */
      {}
    );
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) deleteKey(key);
    else setJSON(key, obj);
  }

  // src/features/profile/contents-reorder.js
  var CONTENTS_REORDER_STYLE_ID = "osu-expertplus-profile-contents-reorder";
  var CONTENTS_REORDER_ANCHOR_ATTR = "data-oep-contents-reorder-anchor";
  var CONTENTS_REORDER_DRAGGING_CLASS = "oep-contents-reorder--dragging";
  var CONTENTS_REORDER_DROP_BEFORE_CLASS = "oep-contents-reorder--drop-before";
  var CONTENTS_REORDER_DROP_AFTER_CLASS = "oep-contents-reorder--drop-after";
  var CONTENTS_REORDER_GHOST_CLASS = "oep-contents-reorder--ghost";
  var CONTENTS_REORDER_DRAG_THRESHOLD_PX = 12;
  var CONTENTS_REORDER_CSS = `
  a[${CONTENTS_REORDER_ANCHOR_ATTR}] {
    cursor: grab;
    user-select: none;
    display: inline-flex;
    align-items: center;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DRAGGING_CLASS} {
    opacity: 0 !important;
    cursor: grabbing;
    pointer-events: none;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_BEFORE_CLASS} {
    box-shadow: -3px 0 0 0 hsl(var(--hsl-c1));
    border-radius: 0 5px 5px 0;
  }
  a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_AFTER_CLASS} {
    box-shadow: 3px 0 0 0 hsl(var(--hsl-c1));
    border-radius: 5px 0 0 5px;
  }
  .${CONTENTS_REORDER_GHOST_CLASS} {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    padding: 0.22em 0.5em;
    border-radius: 5px;
    background-color: rgba(255, 255, 255, 0.14);
    color: hsl(var(--hsl-l1));
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
    user-select: none;
    transform: translate(10px, -50%);
    font-size: 0.875em;
    opacity: 0.95;
  }
`;
  var CONTENTS_REORDER_ERROR_CLASS = "oep-contents-reorder-error";
  var CONTENTS_REORDER_ERROR_CSS = `
  .${CONTENTS_REORDER_ERROR_CLASS} {
    margin: 0.35rem 0;
    font-size: 12px;
    color: hsl(var(--hsl-red-1, 0 70% 70%));
  }
`;
  var contentsReorderStyle = manageStyle(
    CONTENTS_REORDER_STYLE_ID,
    CONTENTS_REORDER_CSS + CONTENTS_REORDER_ERROR_CSS
  );
  function injectContentsReorderStyles() {
    contentsReorderStyle.inject();
  }
  function removeContentsReorderStyles() {
    contentsReorderStyle.remove();
  }
  async function persistProfileSectionOrder(sectionIds) {
    const payload = new URLSearchParams();
    sectionIds.forEach(
      (id) => payload.append("user_profile_customization[extras_order][]", id)
    );
    await OsuExpertPlus.api.siteWrite("PUT", "/home/account/options", payload);
  }
  function createOrderSaver({ save, initial, onFailed }) {
    let confirmed = initial;
    let pending = null;
    let running2 = false;
    async function pump() {
      running2 = true;
      while (pending) {
        const ids = pending;
        pending = null;
        try {
          await save(ids);
          confirmed = ids;
        } catch (err) {
          if (!pending) onFailed(err, confirmed);
        }
      }
      running2 = false;
    }
    return {
      /** @param {string[]} ids */
      request(ids) {
        if (!Array.isArray(ids) || ids.length < 2) return;
        pending = ids;
        if (!running2) void pump();
      }
    };
  }
  function reorderSectionPagesByIds(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const pages = getSectionPageNodes();
    if (!pages.length) return;
    const byId = /* @__PURE__ */ new Map();
    pages.forEach((p) => {
      byId.set(p.getAttribute("data-page-id"), p);
    });
    const parent = pages[0]?.parentElement;
    if (!parent) return;
    sectionIds.forEach((id) => {
      const node = byId.get(id);
      if (node) parent.appendChild(node);
    });
  }
  function contentsReorderTargetFromPoint(clientX, clientY, source) {
    const row = source.parentElement;
    if (!row) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof Element)) continue;
      const a = n.closest(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`);
      if (a instanceof HTMLAnchorElement && a !== source && a.parentElement === row)
        return a;
    }
    return null;
  }
  function startContentsReorderManager() {
    injectContentsReorderStyles();
    const ac = new AbortController();
    let dragAnchor = null;
    let ghostEl = (
      /** @type {HTMLElement|null} */
      null
    );
    let currentTabOrder = (
      /** @type {string[]|null} */
      null
    );
    let pointerSession = null;
    function getOrderedAnchors(row) {
      const anchors = (
        /** @type {HTMLAnchorElement[]} */
        Array.from(
          row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        ).filter((a) => a instanceof HTMLAnchorElement)
      );
      if (!currentTabOrder) return anchors;
      const byId = new Map(
        anchors.map((a) => [
          sectionIdFromHashHref(a.getAttribute("href") || ""),
          a
        ])
      );
      const ordered = (
        /** @type {HTMLAnchorElement[]} */
        currentTabOrder.map((id) => byId.get(id)).filter(Boolean)
      );
      const inOrder = new Set(currentTabOrder);
      anchors.forEach((a) => {
        const id = sectionIdFromHashHref(a.getAttribute("href") || "");
        if (id && !inOrder.has(id)) ordered.push(a);
      });
      return ordered;
    }
    function applyTabCssOrder(anchors) {
      anchors.forEach((a, i) => {
        a.style.order = String(i);
      });
    }
    const removeGhost = () => {
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
    };
    const clearDragClasses = () => {
      if (ghostEl) removeGhost();
      document.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`).forEach(
        (n) => n.classList.remove(
          CONTENTS_REORDER_DRAGGING_CLASS,
          CONTENTS_REORDER_DROP_BEFORE_CLASS,
          CONTENTS_REORDER_DROP_AFTER_CLASS
        )
      );
    };
    const restoreOrder = (ids) => {
      currentTabOrder = ids;
      getContentsAnchorRows(3).forEach((anchors) => {
        const row = anchors[0]?.parentElement;
        if (row instanceof HTMLElement) applyTabCssOrder(getOrderedAnchors(row));
      });
      reorderSectionPagesByIds(ids);
    };
    const showSaveError = (err) => {
      const row = getContentsAnchorRows(3)[0]?.[0]?.parentElement;
      if (!(row instanceof HTMLElement)) return;
      row.parentElement?.querySelector(`:scope > .${CONTENTS_REORDER_ERROR_CLASS}`)?.remove();
      const status = (
        /** @type {{ status?: number }} */
        err?.status
      );
      const notice = document.createElement("div");
      notice.className = CONTENTS_REORDER_ERROR_CLASS;
      notice.setAttribute("role", "alert");
      notice.textContent = `Could not save the section order${status ? ` (${status})` : ""}; the previous order is back.`;
      row.insertAdjacentElement("afterend", notice);
      window.setTimeout(() => notice.remove(), 8e3);
    };
    const saver = createOrderSaver({
      save: persistProfileSectionOrder,
      initial: getSectionPageNodes().map((p) => p.getAttribute("data-page-id") || "").filter(Boolean),
      onFailed: (err, confirmed) => {
        if (ac.signal.aborted) return;
        restoreOrder(confirmed);
        showSaveError(err);
      }
    });
    const saveOrderFrom = (anchors) => {
      const ids = anchors.map((a) => sectionIdFromHashHref(a.getAttribute("href") || "")).filter(Boolean);
      reorderSectionPagesByIds(ids);
      saver.request(ids);
    };
    function clearRowDropIndicators(row) {
      row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`).forEach(
        (n) => n.classList.remove(
          CONTENTS_REORDER_DROP_BEFORE_CLASS,
          CONTENTS_REORDER_DROP_AFTER_CLASS
        )
      );
    }
    function endPointerSession() {
      const s = pointerSession;
      pointerSession = null;
      if (!s) return;
      removeGhost();
      s.anchor.removeEventListener("pointermove", s.onMove);
      s.anchor.removeEventListener("pointerup", s.onUp);
      s.anchor.removeEventListener("pointercancel", s.onUp);
      try {
        s.anchor.releasePointerCapture(s.pointerId);
      } catch (_) {
      }
    }
    const onPointerDown = (ev) => {
      const anchor = ev.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (ev.button !== 0) return;
      if (pointerSession) return;
      const startX = ev.clientX;
      const startY = ev.clientY;
      const onMove = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.armed) {
          if (Math.hypot(dx, dy) < CONTENTS_REORDER_DRAG_THRESHOLD_PX) return;
          s.armed = true;
          dragAnchor = s.anchor;
          s.anchor.classList.add(CONTENTS_REORDER_DRAGGING_CLASS);
          ghostEl = document.createElement("div");
          ghostEl.className = CONTENTS_REORDER_GHOST_CLASS;
          ghostEl.textContent = s.anchor.textContent || "";
          document.body.appendChild(ghostEl);
        }
        if (ghostEl) {
          ghostEl.style.left = `${e.clientX}px`;
          ghostEl.style.top = `${e.clientY}px`;
        }
        const row = s.anchor.parentElement;
        if (!(row instanceof HTMLElement)) return;
        const hit = contentsReorderTargetFromPoint(
          e.clientX,
          e.clientY,
          s.anchor
        );
        clearRowDropIndicators(row);
        if (hit) {
          const hitRect = hit.getBoundingClientRect();
          const insertAfter = e.clientX > hitRect.left + hitRect.width / 2;
          hit.classList.add(
            insertAfter ? CONTENTS_REORDER_DROP_AFTER_CLASS : CONTENTS_REORDER_DROP_BEFORE_CLASS
          );
        }
      };
      const onUp = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        endPointerSession();
        if (s.armed && dragAnchor) {
          const hit = contentsReorderTargetFromPoint(
            e.clientX,
            e.clientY,
            s.anchor
          );
          const row = s.anchor.parentElement;
          if (hit && dragAnchor && hit !== dragAnchor && row && hit.parentElement === row) {
            hit.classList.remove(
              CONTENTS_REORDER_DROP_BEFORE_CLASS,
              CONTENTS_REORDER_DROP_AFTER_CLASS
            );
            const targetRect = hit.getBoundingClientRect();
            const insertAfter = e.clientX > targetRect.left + targetRect.width / 2;
            const currentAnchors = getOrderedAnchors(row);
            const newAnchors = currentAnchors.filter((a) => a !== dragAnchor);
            const hitIdx = newAnchors.indexOf(hit);
            newAnchors.splice(insertAfter ? hitIdx + 1 : hitIdx, 0, dragAnchor);
            currentTabOrder = newAnchors.map((a) => sectionIdFromHashHref(a.getAttribute("href") || "")).filter(Boolean);
            applyTabCssOrder(newAnchors);
            saveOrderFrom(newAnchors);
          }
          const suppressClick = (ce) => {
            ce.preventDefault();
            ce.stopPropagation();
            s.anchor.removeEventListener("click", suppressClick, true);
          };
          s.anchor.addEventListener("click", suppressClick, true);
        }
        removeGhost();
        dragAnchor = null;
        clearDragClasses();
      };
      pointerSession = {
        anchor,
        pointerId: ev.pointerId,
        startX,
        startY,
        armed: false,
        onMove,
        onUp
      };
      try {
        anchor.setPointerCapture(ev.pointerId);
      } catch (_) {
      }
      anchor.addEventListener("pointermove", onMove);
      anchor.addEventListener("pointerup", onUp);
      anchor.addEventListener("pointercancel", onUp);
    };
    const bind = () => {
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      const groups = getContentsAnchorRows(3);
      document.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`).forEach((a) => {
        a.removeEventListener("pointerdown", onPointerDown);
        a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
        a.removeAttribute("title");
        a.removeAttribute("draggable");
        a.style.removeProperty("order");
        a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
      });
      groups.flat().forEach((a) => {
        a.setAttribute(CONTENTS_REORDER_ANCHOR_ATTR, "1");
        a.removeAttribute("draggable");
        a.setAttribute("title", `Drag to reorder`);
        a.addEventListener("pointerdown", onPointerDown);
      });
      if (currentTabOrder) {
        groups.forEach((anchors) => {
          const row = anchors[0]?.parentElement;
          if (!(row instanceof HTMLElement)) return;
          applyTabCssOrder(getOrderedAnchors(row));
        });
      }
    };
    bind();
    observe.subscribe(
      {
        // Tabs and pages, not bare # links (spoilerboxes).
        selector: `${SECTION_PAGE_SEL}, ${HASH_LINK_SEL}:not([href="#"])`,
        schedule: 80,
        signal: ac.signal,
        label: "profile/contents-reorder"
      },
      bind
    );
    return () => {
      ac.abort();
      document.querySelector(`.${CONTENTS_REORDER_ERROR_CLASS}`)?.remove();
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      document.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`).forEach((a) => {
        a.removeEventListener("pointerdown", onPointerDown);
        a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
        a.removeAttribute("title");
        a.removeAttribute("draggable");
        a.style.removeProperty("order");
        a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
      });
      removeContentsReorderStyles();
    };
  }

  // src/features/profile/media-buttons.js
  var PROFILE_AVATAR_OPEN_ATTR = "data-oep-profile-avatar-open";
  var PROFILE_BANNER_OPEN_ATTR = "data-oep-profile-banner-open";
  var PROFILE_MEDIA_OPEN_BTN_CLASS = "oep-profile-media-open";
  var PROFILE_MEDIA_OPEN_AVATAR_CLASS = "oep-profile-media-open--avatar";
  var PROFILE_MEDIA_OPEN_BANNER_CLASS = "oep-profile-media-open--banner";
  var PROFILE_MEDIA_OPEN_HOST_CLASS = "oep-profile-media-open-host";
  var PROFILE_MEDIA_OPEN_STYLE_ID = "osu-expertplus-profile-media-open";
  var profileMediaOpenStyle = manageStyle(
    PROFILE_MEDIA_OPEN_STYLE_ID,
    `
  .profile-info.${PROFILE_MEDIA_OPEN_HOST_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS} {
    position: relative;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS} {
    position: absolute;
    z-index: 7;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85em;
    height: 1.85em;
    min-width: 1.85em;
    min-height: 1.85em;
    font-size: 11px;
    line-height: 1;
    color: hsl(var(--hsl-l1));
    cursor: pointer;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.55);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease, background-color 140ms ease,
      border-color 140ms ease;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS} .fas {
    pointer-events: none;
  }
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__avatar:hover)
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:hover
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:focus-visible
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS} {
    opacity: 1;
    pointer-events: auto;
  }
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__bg:hover)
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:hover
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:focus-visible
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS} {
    opacity: 1;
    pointer-events: auto;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS}:hover {
    background: rgba(0, 0, 0, 0.78);
    border-color: rgba(255, 255, 255, 0.22);
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS}:focus-visible {
    outline: 2px solid hsl(var(--hsl-b1));
    outline-offset: 2px;
  }
`
  );
  var profileMediaOpenHostCounts = /* @__PURE__ */ new WeakMap();
  function acquireProfileMediaOpenHost(profileInfo) {
    const n = (profileMediaOpenHostCounts.get(profileInfo) || 0) + 1;
    profileMediaOpenHostCounts.set(profileInfo, n);
    profileInfo.classList.add(PROFILE_MEDIA_OPEN_HOST_CLASS);
  }
  function releaseProfileMediaOpenHost(profileInfo) {
    const prev = profileMediaOpenHostCounts.get(profileInfo);
    if (prev == null) return;
    const n = prev - 1;
    if (n <= 0) {
      profileMediaOpenHostCounts.delete(profileInfo);
      profileInfo.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS);
    } else {
      profileMediaOpenHostCounts.set(profileInfo, n);
    }
  }
  function resolveProfileAvatarImageHref(avatarHost) {
    const data = profileInitialDataForUrl();
    const fromData = data?.user?.avatar_url;
    if (typeof fromData === "string" && fromData.trim()) return fromData.trim();
    const img = avatarHost.querySelector("img[src]");
    if (img instanceof HTMLImageElement && img.src) return img.src;
    const withBg = avatarHost.querySelector("[style*='background-image']");
    if (withBg instanceof HTMLElement) {
      const styleAttr = withBg.getAttribute("style") || "";
      const m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    const uid = getProfileUserId();
    return uid ? `https://a.ppy.sh/${uid}` : "";
  }
  function resolveProfileBannerImageHref(bgHost) {
    const data = profileInitialDataForUrl();
    const cover = data?.user?.cover;
    if (cover && typeof cover === "object") {
      for (const k of ["custom_url", "url"]) {
        const u = cover[k];
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
    const flat = data?.user?.cover_url;
    if (typeof flat === "string" && flat.trim()) return flat.trim();
    const styleAttr = bgHost.getAttribute("style") || "";
    let m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
    if (m && m[1]) return m[1].trim();
    for (const inner of bgHost.querySelectorAll("[style*='background-image']")) {
      if (!(inner instanceof HTMLElement)) continue;
      const s = inner.getAttribute("style") || "";
      m = s.match(/url\(\s*["']?([^"')]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    const img = bgHost.querySelector("img[src]");
    if (img instanceof HTMLImageElement && img.src) return img.src;
    return "";
  }
  function bindProfileMediaOpenButton(opts) {
    const { mediaHost, markerAttr: markerAttr2, resolveHref, ariaLabel } = opts;
    if (!(mediaHost instanceof HTMLElement)) return null;
    if (mediaHost.hasAttribute(markerAttr2)) return null;
    const href = resolveHref(mediaHost);
    if (!href) return null;
    mediaHost.setAttribute(markerAttr2, "1");
    const profileInfoEl = mediaHost.closest(".profile-info");
    const profileInfo = profileInfoEl instanceof HTMLElement ? profileInfoEl : mediaHost.parentElement;
    if (!(profileInfo instanceof HTMLElement)) {
      mediaHost.removeAttribute(markerAttr2);
      return null;
    }
    acquireProfileMediaOpenHost(profileInfo);
    const variantClass = markerAttr2 === PROFILE_AVATAR_OPEN_ATTR ? PROFILE_MEDIA_OPEN_AVATAR_CLASS : PROFILE_MEDIA_OPEN_BANNER_CLASS;
    const btn = el(
      "button",
      {
        type: "button",
        class: `${PROFILE_MEDIA_OPEN_BTN_CLASS} ${variantClass}`,
        "aria-label": ariaLabel,
        onclick: (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          window.open(href, "_blank", "noopener,noreferrer");
        }
      },
      el("i", {
        class: "fas fa-external-link-alt",
        "aria-hidden": "true"
      })
    );
    function syncOpenBtnLayout() {
      if (!btn.isConnected || !mediaHost.isConnected) return;
      const ar = mediaHost.getBoundingClientRect();
      const pr = profileInfo.getBoundingClientRect();
      const top = ar.top - pr.top + profileInfo.scrollTop;
      const left = ar.left - pr.left + profileInfo.scrollLeft;
      btn.style.top = `${Math.round(top + 2)}px`;
      btn.style.left = `${Math.round(left + ar.width - 2)}px`;
      btn.style.transform = "translate(-100%, 0)";
    }
    profileInfo.appendChild(btn);
    syncOpenBtnLayout();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncOpenBtnLayout) : null;
    ro?.observe(mediaHost);
    ro?.observe(profileInfo);
    window.addEventListener("resize", syncOpenBtnLayout);
    return () => {
      window.removeEventListener("resize", syncOpenBtnLayout);
      ro?.disconnect();
      btn.remove();
      releaseProfileMediaOpenHost(profileInfo);
      mediaHost.removeAttribute(markerAttr2);
    };
  }
  function startProfileMediaOpenPictureManager() {
    profileMediaOpenStyle.inject();
    let disposeAvatar = (
      /** @type {null | (() => void)} */
      null
    );
    let disposeBanner = (
      /** @type {null | (() => void)} */
      null
    );
    const ac = new AbortController();
    function scanProfileMediaOpen() {
      if (ac.signal.aborted) return;
      const av = document.querySelector(".profile-info__avatar");
      if (av instanceof HTMLElement && !av.hasAttribute(PROFILE_AVATAR_OPEN_ATTR)) {
        disposeAvatar?.();
        disposeAvatar = bindProfileMediaOpenButton({
          mediaHost: av,
          markerAttr: PROFILE_AVATAR_OPEN_ATTR,
          resolveHref: resolveProfileAvatarImageHref,
          ariaLabel: "Open profile picture"
        }) || null;
      }
      const bg = document.querySelector(".profile-info__bg");
      if (bg instanceof HTMLElement && !bg.hasAttribute(PROFILE_BANNER_OPEN_ATTR)) {
        disposeBanner?.();
        disposeBanner = bindProfileMediaOpenButton({
          mediaHost: bg,
          markerAttr: PROFILE_BANNER_OPEN_ATTR,
          resolveHref: resolveProfileBannerImageHref,
          ariaLabel: "Open profile banner"
        }) || null;
      }
    }
    Promise.allSettled([
      waitForElement(".profile-info__avatar", 15e3),
      waitForElement(".profile-info__bg", 15e3)
    ]).then(() => {
      if (!ac.signal.aborted) scanProfileMediaOpen();
    });
    observe.subscribe(
      {
        selector: ".profile-info__avatar, .profile-info__bg",
        schedule: "sync",
        signal: ac.signal,
        label: "profile/media-buttons"
      },
      scanProfileMediaOpen
    );
    return () => {
      ac.abort();
      disposeAvatar?.();
      disposeBanner?.();
      document.querySelectorAll(`.${PROFILE_MEDIA_OPEN_BTN_CLASS}`).forEach((b) => b.remove());
      document.querySelectorAll(`[${PROFILE_AVATAR_OPEN_ATTR}]`).forEach((el2) => el2.removeAttribute(PROFILE_AVATAR_OPEN_ATTR));
      document.querySelectorAll(`[${PROFILE_BANNER_OPEN_ATTR}]`).forEach((el2) => el2.removeAttribute(PROFILE_BANNER_OPEN_ATTR));
      document.querySelectorAll(`.${PROFILE_MEDIA_OPEN_HOST_CLASS}`).forEach((el2) => el2.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS));
      profileMediaOpenStyle.remove();
    };
  }

  // src/features/profile/beatmap-attributes.js
  var MODDED_SR_ID = settingIds().MODDED_STAR_RATING;
  var MODDED_SR_ATTR = "data-oep-sr";
  var MOD_CUSTOMISED_ATTR = "data-oep-mod-customised";
  var _attrsSessionCache = /* @__PURE__ */ new Map();
  var BEATMAP_ATTRS_CACHE_GM_KEY = "oep.beatmapAttributesCache.v1";
  var BEATMAP_ATTRS_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1e3;
  var BEATMAP_ATTRS_CACHE_MAX_ENTRIES = 600;
  var SR_CACHE_VERSION = "2026-07-23";
  var SR_CACHE_VERSION_GM_KEY = "oep.srCacheVersion";
  (function _initSrCacheVersion() {
    try {
      const stored = GM_getValue(SR_CACHE_VERSION_GM_KEY, "");
      if (stored === SR_CACHE_VERSION) return;
      GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, "{}");
      GM_setValue(SR_CACHE_VERSION_GM_KEY, SR_CACHE_VERSION);
    } catch (_) {
    }
  })();
  var PERMANENT_RANKED = /* @__PURE__ */ new Set([1, 2, 4]);
  var PERMANENT_STATUS = /* @__PURE__ */ new Set(["ranked", "approved", "loved"]);
  function isPermanentBeatmap(beatmap) {
    if (!beatmap || typeof beatmap !== "object") return false;
    if (beatmap.ranked != null)
      return PERMANENT_RANKED.has(Number(beatmap.ranked));
    return PERMANENT_STATUS.has(String(beatmap.status ?? ""));
  }
  var rowBeatmaps = /* @__PURE__ */ new WeakMap();
  function rememberRowBeatmap(rowEl, beatmap) {
    if (beatmap && typeof beatmap === "object") rowBeatmaps.set(rowEl, beatmap);
  }
  function rowBeatmap(rowEl) {
    return rowBeatmaps.get(rowEl);
  }
  var _beatmapMaxComboInFlight = /* @__PURE__ */ new Map();
  function _fetchBeatmapMaxCombo(beatmapId) {
    if (_beatmapMaxComboInFlight.has(beatmapId)) {
      return _beatmapMaxComboInFlight.get(beatmapId);
    }
    const p = OsuExpertPlus.api.getBeatmap(beatmapId, { priority: "low" }).then((data) => {
      const mc = data?.max_combo;
      return mc != null && Number.isFinite(Number(mc)) && Number(mc) > 0 ? Number(mc) : null;
    }).catch(() => null).finally(() => _beatmapMaxComboInFlight.delete(beatmapId));
    _beatmapMaxComboInFlight.set(beatmapId, p);
    return p;
  }
  function _readBeatmapAttrsGmStore() {
    try {
      const raw = GM_getValue(BEATMAP_ATTRS_CACHE_GM_KEY, "");
      if (raw == null || raw === "") return {};
      const o = typeof raw === "string" ? JSON.parse(raw) : raw;
      return o && typeof o === "object" ? o : {};
    } catch (_) {
      return {};
    }
  }
  function _writeBeatmapAttrsGmStore(store) {
    try {
      GM_setValue(BEATMAP_ATTRS_CACHE_GM_KEY, JSON.stringify(store));
    } catch (_) {
    }
  }
  function createAttrsStore({
    read,
    write,
    now = Date.now,
    ttlMs = BEATMAP_ATTRS_CACHE_TTL_MS,
    maxEntries = BEATMAP_ATTRS_CACHE_MAX_ENTRIES,
    writeDelayMs = 1e3,
    setTimer = (fn, ms) => setTimeout(fn, ms)
  }) {
    let entries = null;
    let writePending = false;
    const num = (v) => v != null && Number.isFinite(Number(v)) ? Number(v) : null;
    function load() {
      if (entries) return entries;
      entries = /* @__PURE__ */ new Map();
      const raw = read();
      const t = now();
      for (const [key, ent] of Object.entries(raw)) {
        const stored = Number(ent?.t);
        if (!Number.isFinite(stored) || t - stored > ttlMs) continue;
        if (num(ent.maxCombo) === 0) continue;
        entries.set(key, {
          t: stored,
          sr: num(ent.sr),
          maxCombo: num(ent.maxCombo)
        });
      }
      if (entries.size !== Object.keys(raw).length) scheduleWrite();
      return entries;
    }
    function flush() {
      writePending = false;
      if (entries) write(Object.fromEntries(entries));
    }
    function scheduleWrite() {
      if (writePending) return;
      writePending = true;
      setTimer(flush, writeDelayMs);
    }
    return {
      /**
       * @param {string} key
       * @returns {PackedAttrs | undefined}
       */
      get(key) {
        const map = load();
        const ent = map.get(key);
        if (!ent) return void 0;
        map.delete(key);
        if (now() - ent.t > ttlMs) {
          scheduleWrite();
          return void 0;
        }
        map.set(key, ent);
        return { sr: ent.sr, maxCombo: ent.maxCombo };
      },
      /**
       * @param {string} key
       * @param {PackedAttrs} packed
       */
      set(key, packed) {
        const map = load();
        map.delete(key);
        map.set(key, { t: now(), sr: packed.sr, maxCombo: packed.maxCombo });
        for (const k of map.keys()) {
          if (map.size <= maxEntries) break;
          map.delete(k);
        }
        scheduleWrite();
      },
      clear() {
        entries = /* @__PURE__ */ new Map();
        flush();
      },
      flush
    };
  }
  var attrsStore = createAttrsStore({
    read: _readBeatmapAttrsGmStore,
    write: _writeBeatmapAttrsGmStore
  });
  window.addEventListener("pagehide", () => attrsStore.flush());
  function clearBeatmapAttributesCache() {
    _attrsSessionCache.clear();
    attrsStore.clear();
  }
  function _getCachedAttrs(key) {
    return _attrsSessionCache.get(key);
  }
  function _srCacheKey(beatmapId, diffMods, ruleset) {
    return `${beatmapId}:${ruleset}:${diffMods.join("+") || "NM"}`;
  }
  function _extractRowData(rowEl) {
    const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
    const m = href.match(/#(\w+)\/(\d+)/);
    return {
      beatmapId: m?.[2] ?? null,
      ruleset: m?.[1] ?? "osu",
      mods: Array.from(rowEl.querySelectorAll(".mod__icon[data-acronym]")).map(
        (e) => e.dataset.acronym
      )
    };
  }
  function rowHasCustomDifficultySettings(rowEl) {
    for (const icon of rowEl.querySelectorAll(".mod__icon[data-acronym]")) {
      const acronym = (icon.getAttribute("data-acronym") ?? "").trim().toUpperCase();
      const modEl = icon.closest(".mod") ?? icon.parentElement;
      if (!modEl) continue;
      if (acronym === "DA") {
        if (modEl.hasAttribute(MOD_CUSTOMISED_ATTR) || modEl.querySelector(".mod__extender, .mod__customised-indicator")) {
          return true;
        }
        continue;
      }
      if (!["DT", "NC", "HT", "DC"].includes(acronym)) continue;
      const text = modEl.querySelector(".mod__extender")?.textContent ?? "";
      const rate = parseFloat(text.replace(/[^\d.]/g, ""));
      if (Number.isFinite(rate) && isNonDefaultSpeed(acronym, rate)) return true;
    }
    return false;
  }
  var _attrsInFlight = /* @__PURE__ */ new Map();
  async function _fetchBeatmapAttributesCached(beatmapId, diffMods, ruleset, opts) {
    const key = _srCacheKey(beatmapId, diffMods, ruleset);
    const hit = _getCachedAttrs(key);
    if (hit !== void 0) return { key, ...hit };
    const persisted = attrsStore.get(key);
    if (persisted !== void 0) {
      _attrsSessionCache.set(key, persisted);
      return { key, ...persisted };
    }
    const persist = opts?.persist === true;
    if (!_attrsInFlight.has(key)) {
      const p = OsuExpertPlus.api.postBeatmapAttributes(beatmapId, diffMods, ruleset).then(async (data) => {
        const attrs = data?.attributes ?? {};
        const sr = attrs.star_rating != null && Number.isFinite(Number(attrs.star_rating)) ? Number(attrs.star_rating) : null;
        let maxCombo = attrs.max_combo != null && Number.isFinite(Number(attrs.max_combo)) ? Number(attrs.max_combo) : null;
        if (maxCombo === 0) {
          const fallback = await _fetchBeatmapMaxCombo(beatmapId);
          maxCombo = fallback != null ? fallback : null;
        }
        const packed2 = { sr, maxCombo };
        _attrsSessionCache.set(key, packed2);
        if (persist) {
          attrsStore.set(key, packed2);
        }
        return packed2;
      }).catch(() => ({ sr: null, maxCombo: null })).finally(() => _attrsInFlight.delete(key));
      _attrsInFlight.set(key, p);
    }
    const packed = await _attrsInFlight.get(key);
    return { key, ...packed };
  }

  // src/features/profile/score-stats.js
  var FRUITS_STAT_NAMES = Object.freeze({
    great: "Fruits",
    large_tick_hit: "Drops",
    small_tick_hit: "Droplets",
    small_tick_miss: "Droplet misses",
    miss: "Misses"
  });
  var PERFECT_COMBO_ATTR = "data-oep-perfect-combo";
  function _applyApiMaxComboToComboInline(rowEl, maxCombo) {
    const comboSpan = rowEl.querySelector(".oep-combo-inline");
    if (!comboSpan) return;
    const nums = comboSpan.querySelectorAll(".oep-combo-inline__num");
    if (nums.length < 2) return;
    const achEl = nums[0];
    const maxEl = nums[1];
    const achN = Number(achEl.textContent);
    const maxN = Number(maxCombo);
    maxEl.textContent = String(maxCombo);
    const afterMax = maxEl.nextSibling;
    if (!(afterMax?.nodeType === Node.TEXT_NODE && afterMax.textContent === "x")) {
      maxEl.after(document.createTextNode("x"));
    }
    const base = "oep-combo-inline__num";
    const fullCombo = achEl.hasAttribute(PERFECT_COMBO_ATTR) || isFullCombo({ max_combo: achN }, maxN, { apiFlags: true });
    achEl.className = fullCombo ? `${base} ${base}--full` : base;
    maxEl.className = `${base} ${base}--full`;
  }
  function injectComboAfterAccuracy(rowEl, score) {
    const midCol = rowEl.querySelector(".play-detail__score-detail-top-right");
    const acc = rowEl.querySelector(".play-detail__accuracy");
    if (!midCol || !acc || acc.closest(".oep-mid-cols")) return;
    const achieved = score?.max_combo ?? 0;
    const maxCombo = beatmapMaxComboFromScore(score);
    const maxStr = maxCombo != null && Number.isFinite(Number(maxCombo)) ? String(maxCombo) : "0";
    const fullCombo = isFullCombo(score, maxCombo, { apiFlags: true });
    const achNumClass = (base) => fullCombo ? `${base} ${base}--full` : base;
    const maxNumClass = (base) => maxCombo != null && Number.isFinite(Number(maxCombo)) ? `${base} ${base}--full` : base;
    const comboParts = [
      el(
        "span",
        {
          class: achNumClass("oep-combo-inline__num"),
          [PERFECT_COMBO_ATTR]: scoreIndicatesPerfectCombo(score) ? "" : null
        },
        String(achieved)
      ),
      "/",
      el("span", { class: maxNumClass("oep-combo-inline__num") }, maxStr),
      "x"
    ];
    const comboSpan = el("span", { class: "oep-combo-inline" }, ...comboParts);
    const accCol = el("div", { class: "oep-accuracy-col" });
    const comboStatsCol = el("div", { class: "oep-combo-stats-col" });
    const midCols = el("div", { class: "oep-mid-cols" });
    accCol.appendChild(acc);
    comboStatsCol.appendChild(comboSpan);
    midCols.appendChild(accCol);
    midCols.appendChild(comboStatsCol);
    midCol.insertBefore(midCols, midCol.firstChild);
  }
  function buildStatsRow(score) {
    const sep = () => el("span", { class: "oep-score-stats__sep" }, "/");
    const parts = [];
    const names = rulesetFromId(score?.ruleset_id ?? 0) === "fruits" ? FRUITS_STAT_NAMES : {};
    for (const cell of statsCells(score, STATS_DISPLAY.profile)) {
      if (parts.length) parts.push(sep());
      parts.push(
        el(
          "span",
          { class: cell.className, title: names[cell.key] ?? null },
          String(cell.value)
        )
      );
    }
    const row = el("div", { class: "oep-score-stats" }, ...parts);
    row.style.setProperty("--oep-stats-chars", String(row.textContent.length));
    row.style.setProperty(
      "--oep-stats-seps",
      String(Math.max(0, (parts.length - 1) / 2))
    );
    return row;
  }
  function injectStatsRow(rowEl, score) {
    if (rowEl.hasAttribute(SCORE_STATS_ATTR)) return;
    const midCol = rowEl.querySelector(".play-detail__score-detail-top-right");
    if (!midCol) return;
    injectComboAfterAccuracy(rowEl, score);
    const statsRow = buildStatsRow(score);
    const comboStatsCol = rowEl.querySelector(".oep-combo-stats-col");
    (comboStatsCol || midCol).appendChild(statsRow);
    rowEl.setAttribute(SCORE_STATS_ATTR, "1");
  }
  function fillStatsRows(rows, scores) {
    _applyByBeatmapId(
      rows,
      _buildScoresByBeatmapId(scores),
      /* @__PURE__ */ new Map(),
      (rowEl, score) => {
        rememberRowBeatmap(rowEl, score?.beatmap);
        if (!rowEl.querySelector(".oep-score-stats")) {
          rowEl.removeAttribute(SCORE_STATS_ATTR);
        }
        injectStatsRow(rowEl, score);
      }
    );
  }
  function _revertAccuracyComboWrap(rowEl) {
    const midCols = rowEl.querySelector(".oep-mid-cols");
    if (midCols) {
      const aw = rowEl.querySelector(".play-detail__accuracy-and-weighted-pp");
      const acc = midCols.querySelector(".play-detail__accuracy");
      if (acc && aw) aw.insertBefore(acc, aw.firstChild);
      midCols.querySelector(".oep-combo-inline")?.remove();
      midCols.remove();
      return;
    }
    rowEl.querySelector(".oep-combo-inline")?.remove();
  }
  function revertStatsRows(listEl) {
    listEl.querySelectorAll(`.play-detail[${SCORE_STATS_ATTR}]`).forEach((rowEl) => {
      rowEl.removeAttribute(SCORE_STATS_ATTR);
      rowEl.querySelector(".oep-score-stats")?.remove();
      _revertAccuracyComboWrap(rowEl);
    });
  }
  function injectMostWatchedPpRow(rowEl, score) {
    const ppEl = rowEl.querySelector(".play-detail__pp");
    if (!ppEl || ppEl.querySelector(`.${MW_PP_CLASS}`)) return;
    const pp = Number(score?.pp);
    if (!Number.isFinite(pp) || pp <= 0) return;
    ppEl.appendChild(
      el(
        "span",
        {
          class: MW_PP_CLASS,
          title: String(score.pp),
          [PP_RAW_ATTR]: String(score.pp)
        },
        String(Math.round(pp)),
        el("span", { class: "play-detail__pp-unit" }, "pp")
      )
    );
  }
  function applyMostWatchedPp(listEl, scores) {
    const byBeatmap = _buildScoresByBeatmapId(scores);
    const usageCount = /* @__PURE__ */ new Map();
    _applyByBeatmapId(
      Array.from(listEl.querySelectorAll(".play-detail")),
      byBeatmap,
      usageCount,
      injectMostWatchedPpRow
    );
  }
  function revertMostWatchedPp(listEl) {
    listEl.querySelectorAll(`.${MW_PP_CLASS}`).forEach((span) => span.remove());
  }
  function applyHideWeightedPp(listEl) {
    listEl.querySelectorAll(".play-detail").forEach((rowEl) => {
      rowEl.querySelector(".play-detail__weighted-pp")?.classList.add("oep-hidden");
      rowEl.querySelector(".play-detail__pp-weight")?.classList.add("oep-hidden");
    });
  }

  // src/features/profile/recent-scores/common.js
  var RECENT_FAILS_WRAP_CLASS = "oep-recent-scores-with-fails";
  var RECENT_FAILS_HEADER_CLASS = "oep-recent-fails-header";
  var RECENT_FAILS_EMPTY_MSG = "No scores in the last 24 hours.";
  var RECENT_FAILS_EMPTY_FILTERED_MSG = "No passing scores in this list (fails hidden).";
  var recentScoresFullCache = /* @__PURE__ */ new WeakMap();
  function apiScoreIsFail(score) {
    return Boolean(score && typeof score === "object" && score.passed === false);
  }
  function filterScoresForRecentDisplay(scores, showFails) {
    if (showFails) return scores.slice();
    return scores.filter((s) => !apiScoreIsFail(s));
  }
  function findHistoricalPage() {
    return document.querySelector(
      'div.js-sortable--page[data-page-id="historical"]'
    );
  }
  function historicalPlayDetailLists() {
    const page = findHistoricalPage();
    if (!page) return [];
    return Array.from(page.querySelectorAll(".play-detail-list")).filter(
      (el2) => el2 instanceof HTMLElement && !el2.closest(`.${RECENT_FAILS_WRAP_CLASS}`)
    );
  }
  function findRecentPlaysListRoot() {
    return historicalPlayDetailLists().find(
      (el2) => el2.classList.contains("u-relative")
    ) ?? null;
  }
  function findMostWatchedReplaysListRoot() {
    return historicalPlayDetailLists().find(
      (el2) => !el2.classList.contains("u-relative")
    ) ?? null;
  }
  function removeOfficialRecentPlaysSection(listRoot) {
    if (!(listRoot instanceof HTMLElement)) return [];
    const removed = [];
    const prev = listRoot.previousElementSibling;
    if (prev instanceof HTMLElement && prev.matches("h3.title.title--page-extra-small")) {
      prev.remove();
      removed.push(prev);
    }
    listRoot.remove();
    removed.push(listRoot);
    return removed;
  }
  function beatmapHrefFromScore(score) {
    const bm = score?.beatmap;
    if (!bm?.id) return "#";
    const setId = score.beatmapset?.id;
    const mode = rulesetFromId(score.ruleset_id);
    if (setId != null)
      return `https://osu.ppy.sh/beatmapsets/${setId}#${mode}/${bm.id}`;
    return `https://osu.ppy.sh/beatmaps/${bm.id}`;
  }
  function enrichPlayDetailRowsMaxComboFromAttributes(rows, scores, listEl) {
    listEl._oepMaxComboIo?.disconnect();
    const scoreByRow = /* @__PURE__ */ new Map();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          const rowEl = entry.target;
          const score = scoreByRow.get(rowEl);
          scoreByRow.delete(rowEl);
          if (!score) continue;
          const ruleset = rulesetFromId(score.ruleset_id);
          _fetchBeatmapAttributesCached(
            score.beatmap.id,
            difficultyMods(modAcronyms(score.mods), ruleset),
            ruleset,
            { persist: isPermanentBeatmap(score.beatmap) }
          ).then(({ maxCombo }) => {
            if (maxCombo != null && rowEl.isConnected) {
              _applyApiMaxComboToComboInline(rowEl, maxCombo);
            }
          });
        }
      },
      { rootMargin: "300px 0px" }
    );
    listEl._oepMaxComboIo = io;
    for (let i = 0; i < rows.length; i++) {
      const score = scores[i];
      if (beatmapMaxComboFromScore(score) != null) continue;
      if (score?.beatmap?.id == null) continue;
      scoreByRow.set(rows[i], score);
      io.observe(rows[i]);
    }
  }
  function isInsideOepRecentFailsWrap(node) {
    return node instanceof Element && Boolean(node.closest(`.${RECENT_FAILS_WRAP_CLASS}`));
  }

  // src/features/profile/score-rows.js
  var SCORE_PP_DECIMALS_ID = settingIds().SCORE_PP_DECIMALS;
  var SCORE_HIT_STATISTICS_ID = settingIds().SCORE_HIT_STATISTICS;
  var SCORE_PERIOD_HIGHLIGHT_ID = settingIds().SCORE_PERIOD_HIGHLIGHT;
  var RECENT_SCORES_SHOW_FAILS_ID = settingIds().RECENT_SCORES_SHOW_FAILS;
  var PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID = settingIds().PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE;
  var PP_DECIMALS_ATTR = "data-oep-pp-original";
  var PP_RAW_ATTR = "data-oep-pp-raw";
  function applyPpDecimals(listEl) {
    listEl.querySelectorAll(".play-detail__pp > span[title]").forEach((span) => {
      const full = span.getAttribute("title");
      if (!full) return;
      const textNode = Array.from(span.childNodes).find(
        (n2) => n2.nodeType === Node.TEXT_NODE
      );
      if (!textNode) return;
      const raw = span.getAttribute(PP_RAW_ATTR);
      const n = raw != null ? parseApiNumber(raw) : parseLocaleNumber2(full);
      if (!Number.isFinite(n)) return;
      const expected = formatDecimalPp(n) + " ";
      if (textNode.textContent === expected) return;
      span.setAttribute(PP_DECIMALS_ATTR, textNode.textContent.trim());
      textNode.textContent = expected;
    });
  }
  function revertPpDecimals(listEl) {
    listEl.querySelectorAll(`.play-detail__pp > span[${PP_DECIMALS_ATTR}]`).forEach((span) => {
      const original = span.getAttribute(PP_DECIMALS_ATTR);
      const textNode = Array.from(span.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE
      );
      if (textNode) textNode.textContent = original;
      span.removeAttribute(PP_DECIMALS_ATTR);
    });
  }
  var PLAY_DETAIL_STYLE_ID = "osu-expertplus-play-detail";
  var SCORE_LIST_LAYOUT_CLASS = "oep-score-list-details-layout";
  var MW_PP_CLASS = "oep-mw-pp";
  var SCORE_LIST_PP_DECIMALS_CLASS = "oep-score-list-pp-decimals";
  var SCORE_LIST_LAYOUT_SEL = `.play-detail-list.${SCORE_LIST_LAYOUT_CLASS}`;
  var PLAY_DETAIL_DESKTOP_TUNING = {
    modsColMaxWidth: "min(72vw, 40rem)",
    ppDesktopWidth: "max(102px, 10ch)",
    ppColWidth: "calc(max(102px, 10ch) + 2.45rem)",
    accuracyColWidth: "7.5ch",
    comboStatsColWidth: "13rem",
    midGap: "0.28em",
    srBadgeMinWidth: "4.5rem"
  };
  var SCORE_STATS_ATTR = "data-oep-stats";
  function _beatmapIdFromRow(rowEl) {
    const href = rowEl.querySelector("a.play-detail__title")?.href ?? "";
    const m = href.match(/#\w+\/(\d+)/);
    return m ? m[1] : null;
  }
  function _buildScoresByBeatmapId(scores) {
    const map = /* @__PURE__ */ new Map();
    for (const s of scores) {
      const id = String(s?.beatmap?.id ?? "");
      if (!id) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(s);
    }
    return map;
  }
  function _applyByBeatmapId(elements, byBeatmap, usageCount, fn) {
    elements.forEach((rowEl) => {
      const bmId = _beatmapIdFromRow(rowEl);
      if (!bmId) return;
      const candidates = byBeatmap.get(bmId);
      if (!candidates) return;
      const idx = usageCount.get(bmId) ?? 0;
      const score = candidates[idx];
      if (!score) return;
      usageCount.set(bmId, idx + 1);
      fn(rowEl, score);
    });
  }
  function _getSectionType(listEl) {
    if (listEl.closest(`.${RECENT_FAILS_WRAP_CLASS}`)) return null;
    if (listEl.closest('[data-page-id="historical"]')) {
      return listEl.classList.contains("u-relative") ? null : "most_watched";
    }
    if (listEl.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp"))
      return "best";
    const nextSib = listEl.nextElementSibling;
    if (nextSib instanceof HTMLElement && nextSib.classList.contains("show-more-link")) {
      if (nextSib.classList.contains("show-more-link--pinned")) return "pinned";
      if (nextSib.classList.contains("show-more-link--best")) return "best";
      if (nextSib.classList.contains("show-more-link--firsts")) return "firsts";
    }
    const topRanksPage = listEl.closest('[data-page-id="top_ranks"]');
    if (topRanksPage) {
      const allLists = Array.from(
        topRanksPage.querySelectorAll(".play-detail-list")
      );
      const bestIdx = allLists.findIndex(
        (el2) => el2.querySelector(".play-detail__pp-weight, .play-detail__weighted-pp")
      );
      if (bestIdx >= 0) {
        const idx = allLists.indexOf(listEl);
        if (idx < bestIdx) return "pinned";
        if (idx > bestIdx) return "firsts";
      }
    }
    let n = listEl.previousElementSibling;
    while (n) {
      if (n instanceof HTMLElement && n.matches("h3.title.title--page-extra-small")) {
        const text = n.textContent.toLowerCase();
        if (text.includes("pinned")) return "pinned";
        if (text.includes("best performance")) return "best";
        if (text.includes("first place")) return "firsts";
        return null;
      }
      n = n.previousElementSibling;
    }
    return null;
  }
  var SCORE_PLACE_NUMBER_ID = settingIds().SCORE_CARD_PLACE_NUMBER;
  var SCORE_PLACE_CLASS = "oep-score-place";
  var SCORE_TITLE_ROW_CLASS = "oep-score-title-row";
  var SCORE_PLACE_NUMBER_STYLE_ID = "osu-expertplus-score-place-number";
  var SCORE_PLACE_NUMBER_CSS = `
  .${SCORE_TITLE_ROW_CLASS} {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 0.45em 0.55em;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  .${SCORE_TITLE_ROW_CLASS} .play-detail__title {
    flex: 1 1 auto;
    min-width: 0;
  }
  .${SCORE_TITLE_ROW_CLASS} .${SCORE_PLACE_CLASS} {
    align-self: flex-start;
    box-sizing: border-box;
    color: hsl(220, 10%, 68%);
    display: block;
    flex-shrink: 0;
    font-family: inherit;
    font-size: 14px;
    font-weight: inherit;
    letter-spacing: inherit;
    line-height: normal;
    margin: 0;
    opacity: 0.78;
    padding: 0;
    white-space: nowrap;
  }
`;
  var scorePlaceNumberStyle = manageStyle(
    SCORE_PLACE_NUMBER_STYLE_ID,
    SCORE_PLACE_NUMBER_CSS
  );
  function applyPlaceNumbers(listEl) {
    const rows = Array.from(listEl.querySelectorAll(".play-detail"));
    rows.forEach((rowEl, i) => {
      const detail = rowEl.querySelector(".play-detail__detail");
      if (!(detail instanceof HTMLElement)) return;
      const titleRow = detail.querySelector(`:scope > .${SCORE_TITLE_ROW_CLASS}`);
      const placeInRow = titleRow?.querySelector(`.${SCORE_PLACE_CLASS}`);
      const titleInRow = titleRow?.querySelector("a.play-detail__title");
      if (titleRow && placeInRow && titleInRow && titleInRow.parentElement === titleRow) {
        const expected = `#${i + 1}`;
        if (placeInRow.textContent !== expected) {
          placeInRow.textContent = expected;
        }
        return;
      }
      rowEl.querySelectorAll(`.${SCORE_PLACE_CLASS}`).forEach((n) => n.remove());
      detail.querySelectorAll(`:scope > .${SCORE_TITLE_ROW_CLASS}`).forEach((tr) => {
        const t = tr.querySelector("a.play-detail__title");
        if (t instanceof HTMLElement && tr.parentElement === detail) {
          detail.insertBefore(t, tr);
        }
        tr.remove();
      });
      const title = detail.querySelector(":scope > a.play-detail__title");
      if (!(title instanceof HTMLElement)) return;
      const row = el("div", { class: SCORE_TITLE_ROW_CLASS });
      const place = el("div", { class: SCORE_PLACE_CLASS }, `#${i + 1}`);
      detail.insertBefore(row, title);
      row.appendChild(place);
      row.appendChild(title);
    });
  }
  function revertPlaceNumbers(listEl) {
    listEl.querySelectorAll(`.${SCORE_TITLE_ROW_CLASS}`).forEach((wrap) => {
      const detail = wrap.parentElement;
      const title = wrap.querySelector("a.play-detail__title");
      if (detail instanceof HTMLElement && title instanceof HTMLElement) {
        detail.insertBefore(title, wrap);
      }
      wrap.remove();
    });
    listEl.querySelectorAll(`.${SCORE_PLACE_CLASS}`).forEach((n) => n.remove());
  }
  var SCORE_SECTION_TYPES = ["pinned", "best", "firsts", "most_watched"];
  var SCORE_PLACE_SECTION_TYPE = "best";
  function setScoreListLayoutClass(sections, enabled) {
    sections.forEach(({ listEl }) => {
      listEl.classList.toggle(SCORE_LIST_LAYOUT_CLASS, enabled);
    });
  }
  function syncScoreListPpDecimalsWidthClass(listEl) {
    listEl.classList.toggle(
      SCORE_LIST_PP_DECIMALS_CLASS,
      settings().isEnabled(SCORE_PP_DECIMALS_ID)
    );
  }
  var PLAY_DETAIL_LIST_PROCESSED_ATTR = "data-oep-processed";
  var PLAY_DETAIL_LIST_STALE_SEL = `.play-detail-list[${PLAY_DETAIL_LIST_PROCESSED_ATTR}]`;

  // src/features/profile/modded-sr.js
  async function _fetchAndApplySr(rowEl) {
    if (rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "");
    const { beatmapId, ruleset, mods } = _extractRowData(rowEl);
    if (!beatmapId) return;
    const diffMods = difficultyMods(mods, ruleset);
    const persist = isPermanentBeatmap(rowBeatmap(rowEl)) || _getSectionType(rowEl.closest(".play-detail-list") ?? rowEl) === "best";
    const { sr, maxCombo } = await _fetchBeatmapAttributesCached(
      beatmapId,
      diffMods,
      ruleset,
      { persist }
    );
    if (!rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    rowEl.setAttribute(MODDED_SR_ATTR, "1");
    if (maxCombo != null) _applyApiMaxComboToComboInline(rowEl, maxCombo);
    if (sr === null || sr === void 0) return;
    if (rowHasCustomDifficultySettings(rowEl)) return;
    const beatmapSpan = rowEl.querySelector(".play-detail__beatmap");
    if (!beatmapSpan || rowEl.querySelector(".oep-sr-badge")) return;
    const parent = beatmapSpan.parentNode;
    if (!parent) return;
    const badge = el(
      "span",
      { class: "oep-sr-badge" },
      el(
        "span",
        { class: "oep-sr-badge__inner" },
        el("i", {
          class: "fas fa-star oep-sr-badge__icon",
          "aria-hidden": "true"
        }),
        el(
          "span",
          { class: "oep-sr-badge__val" },
          formatStars(sr, STAR_FORMAT.profileBadge)
        )
      )
    );
    badge.style.backgroundColor = OsuExpertPlus.difficultyColours.getDiffColour(sr);
    badge.style.color = OsuExpertPlus.difficultyColours.getDiffTextColour(sr);
    parent.insertBefore(badge, beatmapSpan);
  }
  var _srObserver = null;
  var _srRowsAc = null;
  function _observeRow(rowEl) {
    if (!_srObserver || rowEl.hasAttribute(MODDED_SR_ATTR)) return;
    _srObserver.observe(rowEl);
  }
  function initSrObserver() {
    teardownSrObserver();
    _srObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          _srObserver.unobserve(entry.target);
          _fetchAndApplySr(entry.target);
        }
      },
      { rootMargin: "300px 0px" }
    );
    document.querySelectorAll(".play-detail").forEach(_observeRow);
    _srRowsAc = new AbortController();
    observe.subscribe(
      {
        selector: ".play-detail",
        schedule: "sync",
        signal: _srRowsAc.signal,
        label: "profile/modded-sr"
      },
      ({ added }) => {
        for (const node of added) {
          if (node.matches(".play-detail")) _observeRow(node);
          else node.querySelectorAll(".play-detail").forEach(_observeRow);
        }
      }
    );
  }
  function teardownSrObserver() {
    _srObserver?.disconnect();
    _srObserver = null;
    _srRowsAc?.abort();
    _srRowsAc = null;
  }
  function revertModdedStarRatings() {
    teardownSrObserver();
    document.querySelectorAll(`.play-detail[${MODDED_SR_ATTR}]`).forEach((rowEl) => {
      rowEl.removeAttribute(MODDED_SR_ATTR);
      rowEl.querySelector(".oep-sr-badge")?.remove();
    });
  }

  // src/features/profile/ranks-period.js
  var RANKS_PERIOD_HIGHLIGHT_STYLE_ID = "osu-expertplus-profile-ranks-period-highlight";
  var RANKS_CARD_BG_LAYOUT_STYLE_ID = "osu-expertplus-profile-ranks-card-bg-layout";
  var RANKS_PAGE_SELECTOR = 'div.js-sortable--page[data-page-id="top_ranks"]';
  var RANKS_DATE_FILTER_CLASS = "oep-ranks-date-filter";
  var RANKS_DATE_HIGHLIGHT_CLASS = "oep-ranks-date-highlight";
  var RANKS_CARD_BG_ATTR = "data-oep-ranks-card-bg";
  var RANKS_CARD_BG_BEATMAPSET_ATTR = "data-oep-ranks-card-bg-beatmapset";
  var RANKS_CARD_BG_SELECTOR = `.play-detail[${RANKS_CARD_BG_ATTR}="1"]`;
  var RANKS_CARD_BG_IMG_CLASS = "oep-card-bg-img";
  var RANKS_CARD_BASE_BG_VAR = "--oep-ranks-card-base-bg";
  var RANKS_CARD_PP_BG_VAR = "--oep-ranks-card-pp-bg";
  var RANKS_CARD_STATS_BG_VAR = "--oep-ranks-card-stats-bg";
  var RANKS_CARD_EDGE_CUT_VAR = "--oep-ranks-card-edge-cut";
  var RANKS_CARD_BG_IO_ROOT_MARGIN = "220px 0px";
  var RANKS_CARD_BG_FEATURE_ID = settingIds().SCORE_CARD_BACKGROUNDS;
  var ranksCardBgObserver = null;
  var MS_PER_DAY = 24 * 60 * 60 * 1e3;
  var MS_PER_WEEK = 7 * MS_PER_DAY;
  var MS_PER_AVG_MONTH = 365.25 / 12 * MS_PER_DAY;
  var RANKS_PERIOD_IDX_MIN = 0;
  var RANKS_PERIOD_IDX_MAX = 36;
  var RANKS_PERIOD_IDX_DEFAULT = 0;
  var RANKS_PERIOD_IDX_WEEK_END = 4;
  var RANKS_PERIOD_IDX_MONTH_END = 28;
  var RANKS_PERIOD_YEAR_START_IDX = 29;
  var RANKS_PERIOD_FIRST_YEAR = 3;
  var RANKS_PERIOD_HIGHLIGHT_CSS = `
  .${RANKS_DATE_FILTER_CLASS} {
    box-sizing: border-box;
    margin: 0 0 1rem 0;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    max-width: 34rem;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__text {
    margin: 0 0 0.45rem 0;
    font-size: 0.9375rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.88);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__period {
    color: #66ccff;
    font-weight: 600;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__tail {
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.65rem;
    margin-bottom: 0.45rem;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__row .oep-ranks-date-filter__text {
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn {
    flex-shrink: 0;
    margin: 0;
    font: inherit;
    font-size: 0.8125rem;
    line-height: 1.3;
    padding: 0.28rem 0.55rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:hover {
    border-color: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.92);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__btn:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.35);
    outline-offset: 1px;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__reverse.oep-ranks-date-filter__reverse--on {
    border-color: rgba(102, 204, 255, 0.45);
    background: rgba(102, 204, 255, 0.1);
    color: #8fd4ff;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 22px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus {
    outline: none;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range:focus-visible {
    outline: 2px solid rgba(102, 204, 255, 0.4);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-runnable-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    margin-top: -5px;
    border-radius: 50%;
    background: #66ccff;
    border: 2px solid rgba(255, 255, 255, 0.92);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
  }
  .${RANKS_DATE_FILTER_CLASS} .oep-ranks-date-filter__range::-moz-range-thumb {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.92);
    background: #66ccff;
  }
  .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS} {
    position: relative;
    z-index: 1;
    border-radius: 6px;
    isolation: isolate;
  }
  .play-detail.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    border: 2px solid rgba(102, 204, 255, 0.9);
    box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
    background: rgba(102, 204, 255, 0.12);
    pointer-events: none;
    z-index: 2;
    box-sizing: border-box;
  }
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}::after {
    border: 2px solid rgba(102, 204, 255, 0.9);
    box-shadow: inset 0 0 14px rgba(102, 204, 255, 0.1);
    background: rgba(102, 204, 255, 0.12);
    opacity: 1;
    box-sizing: border-box;
  }
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:hover::after,
  ${RANKS_CARD_BG_SELECTOR}.${RANKS_DATE_HIGHLIGHT_CLASS}:focus-within::after {
    background: rgba(102, 204, 255, 0.2);
    opacity: 1;
  }
`;
  var RANKS_CARD_BG_LAYOUT_CSS = `
  ${RANKS_CARD_BG_SELECTOR} {
    position: relative;
    isolation: isolate;
    --oep-ranks-card-edge-cut: 18px;
    background: var(${RANKS_CARD_BASE_BG_VAR}, transparent);
    transition: filter 120ms ease;
    contain: layout style;
  }
  ${RANKS_CARD_BG_SELECTOR}::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    -webkit-clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    background: linear-gradient(
      90deg,
      rgba(18, 22, 28, 0.72) 0%,
      rgba(18, 22, 28, 0.72) 40%,
      var(${RANKS_CARD_BASE_BG_VAR}, rgba(18, 22, 28, 1)) 75%
    );
    z-index: -1;
    pointer-events: none;
  }
  ${RANKS_CARD_BG_SELECTOR} .${RANKS_CARD_BG_IMG_CLASS} {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    border-radius: 6px;
    -webkit-clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    clip-path: polygon(
      0 0,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 0,
      100% 50%,
      calc(100% - var(${RANKS_CARD_EDGE_CUT_VAR})) 100%,
      0 100%
    );
    z-index: -2;
    pointer-events: none;
  }
  @media (min-width: 900px) {
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable {
      background: transparent;
    }
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::before,
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable .${RANKS_CARD_BG_IMG_CLASS} {
      -webkit-clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
      clip-path: inset(0 0 0 var(--pin-sortable-handle-width, 20px) round 6px);
    }
    ${RANKS_CARD_BG_SELECTOR}.play-detail--pin-sortable::after {
      inset: 0 0 0 var(--pin-sortable-handle-width, 20px);
    }
  }
  ${RANKS_CARD_BG_SELECTOR}::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    opacity: 0;
    transition: opacity 120ms ease;
    pointer-events: none;
    z-index: 2;
  }
  ${RANKS_CARD_BG_SELECTOR}:hover::after,
  ${RANKS_CARD_BG_SELECTOR}:focus-within::after {
    opacity: 1;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__group--top,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__group--bottom,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__detail,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__score-detail-top-right,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__mods,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__beatmap-and-time,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__title,
  ${RANKS_CARD_BG_SELECTOR} .${SCORE_PLACE_CLASS},
  ${RANKS_CARD_BG_SELECTOR} .play-detail__time {
    background: transparent !important;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::before,
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp::after {
    background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__pp,
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp,
  ${RANKS_CARD_BG_SELECTOR}:focus-within .play-detail__pp {
    background-color: var(${RANKS_CARD_PP_BG_VAR}) !important;
    filter: none !important;
  }
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::before,
  ${RANKS_CARD_BG_SELECTOR}:hover .play-detail__pp::after {
    background-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    border-color: var(${RANKS_CARD_STATS_BG_VAR}) !important;
    filter: none !important;
  }
  ${RANKS_CARD_BG_SELECTOR} .play-detail__more {
    z-index: 3;
  }
`;
  var ranksPeriodHighlightStyle = manageStyle(
    RANKS_PERIOD_HIGHLIGHT_STYLE_ID,
    RANKS_PERIOD_HIGHLIGHT_CSS
  );
  var ranksCardBgLayoutStyle = manageStyle(
    RANKS_CARD_BG_LAYOUT_STYLE_ID,
    RANKS_CARD_BG_LAYOUT_CSS
  );
  function clampRanksPeriodIndex(n) {
    let x = Math.round(Number(n));
    if (!Number.isFinite(x)) x = RANKS_PERIOD_IDX_DEFAULT;
    return Math.min(RANKS_PERIOD_IDX_MAX, Math.max(RANKS_PERIOD_IDX_MIN, x));
  }
  function readRanksPeriodState() {
    const stored = getJSON(KEYS.RANKS_PERIOD, null);
    return {
      period: clampRanksPeriodIndex(stored?.period ?? RANKS_PERIOD_IDX_DEFAULT),
      reversed: stored?.reversed === true
    };
  }
  function saveRanksPeriodState(period, reversed) {
    setJSON(KEYS.RANKS_PERIOD, {
      period: clampRanksPeriodIndex(period),
      reversed: Boolean(reversed)
    });
  }
  function periodIndexToLookbackMs(idx) {
    const i = clampRanksPeriodIndex(idx);
    if (i <= 0) return 0;
    if (i <= RANKS_PERIOD_IDX_WEEK_END) return i * MS_PER_WEEK;
    if (i <= RANKS_PERIOD_IDX_MONTH_END)
      return (i - RANKS_PERIOD_IDX_WEEK_END) * MS_PER_AVG_MONTH;
    const years = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
    return years * 12 * MS_PER_AVG_MONTH;
  }
  function formatRanksPeriodShortLabel(idx) {
    const i = clampRanksPeriodIndex(idx);
    if (i <= 0) return "No highlight";
    if (i <= RANKS_PERIOD_IDX_WEEK_END) return i === 1 ? "1 week" : `${i} weeks`;
    if (i <= RANKS_PERIOD_IDX_MONTH_END) {
      const mo = i - RANKS_PERIOD_IDX_WEEK_END;
      return mo === 1 ? "1 month" : `${mo} months`;
    }
    const y = i - RANKS_PERIOD_YEAR_START_IDX + RANKS_PERIOD_FIRST_YEAR;
    return `${y} years`;
  }
  function setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversed) {
    const i = clampRanksPeriodIndex(periodIdx);
    if (i === 0) {
      statusEl.textContent = "No highlight";
      tailEl.textContent = " — drag to set a period.";
    } else {
      statusEl.textContent = formatRanksPeriodShortLabel(i);
      tailEl.textContent = reversed ? " · older scores highlighted" : " · recent scores highlighted";
    }
  }
  function getPlayDetailScoreTimeMs(rowEl) {
    const t = rowEl.querySelector(".play-detail__time time[datetime]") || rowEl.querySelector("time.js-timeago") || rowEl.querySelector("time.timeago") || rowEl.querySelector("time[datetime]");
    if (!t) return null;
    const iso = t.getAttribute("datetime");
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }
  function injectRanksPeriodHighlightStyles() {
    ranksPeriodHighlightStyle.inject();
  }
  function injectRanksCardBgLayoutStyles() {
    ranksCardBgLayoutStyle.inject();
  }
  function applyRanksDateHighlights(topRanksRoot, periodIdx, reversed) {
    const rows = topRanksRoot.querySelectorAll(".play-detail-list .play-detail");
    rows.forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
    const idx = clampRanksPeriodIndex(periodIdx);
    if (idx === 0) return;
    const cutoff = Date.now() - periodIndexToLookbackMs(idx);
    rows.forEach((row) => {
      const scoreMs = getPlayDetailScoreTimeMs(row);
      if (scoreMs == null) return;
      const inWindow = reversed ? scoreMs < cutoff : scoreMs >= cutoff;
      if (inWindow) row.classList.add(RANKS_DATE_HIGHLIGHT_CLASS);
    });
  }
  function queryPlayDetailScoreRows(root) {
    if (!(root instanceof HTMLElement)) return [];
    if (root.classList.contains("play-detail-list")) {
      return Array.from(root.querySelectorAll(":scope > .play-detail"));
    }
    return Array.from(root.querySelectorAll(".play-detail-list .play-detail"));
  }
  function getRanksRowBeatmapsetId(rowEl) {
    const href = rowEl.querySelector("a.play-detail__title")?.getAttribute("href");
    return beatmapsetIdFromHref(href);
  }
  function applyRanksCardBackgrounds(topRanksRoot) {
    const opaque = (bg) => !bg || bg === "transparent" || /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)/.test(bg) ? "" : bg;
    const bgOf = (elCandidate) => elCandidate instanceof Element ? opaque(getComputedStyle(elCandidate).backgroundColor) : "";
    const pickBaseBg = (rowEl) => {
      const candidates = [
        rowEl,
        rowEl.querySelector(".play-detail__group--top"),
        rowEl.querySelector(".play-detail__group--bottom"),
        rowEl.querySelector(".play-detail__detail"),
        rowEl.querySelector(".play-detail__score-detail")
      ];
      for (const elCandidate of candidates) {
        const bg = bgOf(elCandidate);
        if (bg) return bg;
      }
      return "";
    };
    if (!ranksCardBgObserver && "IntersectionObserver" in window) {
      ranksCardBgObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const rowEl = entry.target;
            if (!(rowEl instanceof HTMLElement)) return;
            const beatmapsetId = rowEl.getAttribute(
              RANKS_CARD_BG_BEATMAPSET_ATTR
            );
            const imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
            if (!beatmapsetId || !imgEl) return;
            if (entry.isIntersecting) {
              imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
            } else {
              imgEl.removeAttribute("src");
            }
          });
        },
        { root: null, rootMargin: RANKS_CARD_BG_IO_ROOT_MARGIN, threshold: 0 }
      );
    }
    const isDone = (rowEl, beatmapsetId) => rowEl.getAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR) === String(beatmapsetId) && rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`) && rowEl.style.getPropertyValue(RANKS_CARD_BASE_BG_VAR);
    const rows = [];
    for (const rowEl of queryPlayDetailScoreRows(topRanksRoot)) {
      const beatmapsetId = getRanksRowBeatmapsetId(rowEl);
      if (beatmapsetId && isDone(rowEl, beatmapsetId)) continue;
      if (!beatmapsetId) {
        rows.push({ rowEl, beatmapsetId });
        continue;
      }
      rows.push({
        rowEl,
        beatmapsetId,
        baseBg: pickBaseBg(rowEl),
        ppBg: bgOf(rowEl.querySelector(".play-detail__pp")),
        statsBg: bgOf(rowEl.querySelector(".play-detail__score-detail"))
      });
    }
    rows.forEach(({ rowEl, beatmapsetId, baseBg, ppBg, statsBg }) => {
      if (!beatmapsetId) {
        ranksCardBgObserver?.unobserve(rowEl);
        rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
        rowEl.removeAttribute(RANKS_CARD_BG_ATTR);
        rowEl.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
        rowEl.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
        rowEl.style.removeProperty(RANKS_CARD_PP_BG_VAR);
        rowEl.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
        return;
      }
      rowEl.setAttribute(RANKS_CARD_BG_ATTR, "1");
      rowEl.setAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR, beatmapsetId);
      if (baseBg) rowEl.style.setProperty(RANKS_CARD_BASE_BG_VAR, baseBg);
      if (ppBg) rowEl.style.setProperty(RANKS_CARD_PP_BG_VAR, ppBg);
      if (statsBg) rowEl.style.setProperty(RANKS_CARD_STATS_BG_VAR, statsBg);
      let imgEl = rowEl.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`);
      if (!imgEl) {
        imgEl = document.createElement("img");
        imgEl.className = RANKS_CARD_BG_IMG_CLASS;
        imgEl.decoding = "async";
        imgEl.alt = "";
        rowEl.insertBefore(imgEl, rowEl.firstChild);
      }
      if (ranksCardBgObserver) {
        ranksCardBgObserver.observe(rowEl);
        if (!rowEl.isConnected) ranksCardBgObserver.unobserve(rowEl);
      } else {
        imgEl.src = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card@2x.jpg`;
      }
    });
  }
  function insertRanksDateFilterBar(topRanksRoot, wrap) {
    const pageExtra = topRanksRoot.querySelector(":scope > .page-extra") || topRanksRoot.querySelector(".page-extra");
    if (pageExtra instanceof HTMLElement) {
      const lazy = pageExtra.querySelector(":scope > .lazy-load");
      if (lazy) {
        pageExtra.insertBefore(wrap, lazy);
        return;
      }
      const header = pageExtra.querySelector(":scope > .u-relative");
      if (header instanceof HTMLElement) {
        header.insertAdjacentElement("afterend", wrap);
        return;
      }
      const h2 = pageExtra.querySelector(
        ":scope > h2.title--page-extra, :scope > h2.title.title--page-extra"
      );
      if (h2 instanceof HTMLElement) {
        h2.insertAdjacentElement("afterend", wrap);
        return;
      }
      const firstSectionH3 = pageExtra.querySelector(
        "h3.title--page-extra-small"
      );
      if (firstSectionH3 instanceof HTMLElement) {
        firstSectionH3.insertAdjacentElement("beforebegin", wrap);
        return;
      }
    }
    topRanksRoot.insertBefore(wrap, topRanksRoot.firstChild);
  }
  function ensureRanksDateFilterBar(topRanksRoot) {
    if (topRanksRoot.querySelector(`.${RANKS_DATE_FILTER_CLASS}`)) return;
    const { period: periodIdx, reversed } = readRanksPeriodState();
    const statusEl = el("strong", { class: "oep-ranks-date-filter__period" });
    const tailEl = el("span", { class: "oep-ranks-date-filter__tail" });
    setRanksFilterBarLabels(statusEl, tailEl, periodIdx, reversed);
    const resetBtn = el(
      "button",
      {
        type: "button",
        class: "oep-ranks-date-filter__btn oep-ranks-date-filter__reset",
        "aria-label": "Reset period and reverse filter"
      },
      "Reset"
    );
    const revBtn = el(
      "button",
      {
        type: "button",
        class: `oep-ranks-date-filter__btn oep-ranks-date-filter__reverse${reversed ? " oep-ranks-date-filter__reverse--on" : ""}`,
        "aria-pressed": reversed ? "true" : "false",
        "aria-label": "Reverse highlight to older scores outside the period"
      },
      "Reverse"
    );
    const range = el("input", {
      type: "range",
      class: "oep-ranks-date-filter__range",
      min: String(RANKS_PERIOD_IDX_MIN),
      max: String(RANKS_PERIOD_IDX_MAX),
      step: "1",
      value: String(periodIdx)
    });
    range.setAttribute(
      "aria-label",
      "Highlight window: off, then weeks, months, and years"
    );
    const readReversed = () => revBtn.getAttribute("aria-pressed") === "true";
    const wrap = el(
      "div",
      { class: RANKS_DATE_FILTER_CLASS },
      el(
        "div",
        { class: "oep-ranks-date-filter__row" },
        el("p", { class: "oep-ranks-date-filter__text" }, statusEl, tailEl),
        el("div", { class: "oep-ranks-date-filter__actions" }, resetBtn, revBtn)
      ),
      range
    );
    insertRanksDateFilterBar(topRanksRoot, wrap);
    range.addEventListener("input", () => {
      const idx = clampRanksPeriodIndex(range.value);
      setRanksFilterBarLabels(statusEl, tailEl, idx, readReversed());
      applyRanksDateHighlights(topRanksRoot, idx, readReversed());
    });
    range.addEventListener("change", () => {
      saveRanksPeriodState(range.value, readReversed());
    });
    revBtn.addEventListener("click", () => {
      const next = revBtn.getAttribute("aria-pressed") !== "true";
      revBtn.setAttribute("aria-pressed", next ? "true" : "false");
      revBtn.classList.toggle("oep-ranks-date-filter__reverse--on", next);
      const idx = clampRanksPeriodIndex(range.value);
      setRanksFilterBarLabels(statusEl, tailEl, idx, next);
      applyRanksDateHighlights(topRanksRoot, idx, next);
      saveRanksPeriodState(idx, next);
    });
    resetBtn.addEventListener("click", () => {
      range.value = String(RANKS_PERIOD_IDX_DEFAULT);
      revBtn.setAttribute("aria-pressed", "false");
      revBtn.classList.remove("oep-ranks-date-filter__reverse--on");
      setRanksFilterBarLabels(statusEl, tailEl, RANKS_PERIOD_IDX_DEFAULT, false);
      applyRanksDateHighlights(topRanksRoot, RANKS_PERIOD_IDX_DEFAULT, false);
      saveRanksPeriodState(RANKS_PERIOD_IDX_DEFAULT, false);
    });
  }
  function revertRanksCardBackgrounds() {
    document.querySelectorAll(RANKS_CARD_BG_SELECTOR).forEach((row) => {
      ranksCardBgObserver?.unobserve(row);
      row.querySelector(`.${RANKS_CARD_BG_IMG_CLASS}`)?.remove();
      row.removeAttribute(RANKS_CARD_BG_ATTR);
      row.removeAttribute(RANKS_CARD_BG_BEATMAPSET_ATTR);
      row.style.removeProperty(RANKS_CARD_BASE_BG_VAR);
      row.style.removeProperty(RANKS_CARD_PP_BG_VAR);
      row.style.removeProperty(RANKS_CARD_STATS_BG_VAR);
    });
    ranksCardBgObserver?.disconnect();
    ranksCardBgObserver = null;
  }
  function syncRanksDateHighlightForPage(topRanksRoot) {
    if (settings().isEnabled(SCORE_PERIOD_HIGHLIGHT_ID)) {
      ensureRanksDateFilterBar(topRanksRoot);
      const range = topRanksRoot.querySelector(
        `.${RANKS_DATE_FILTER_CLASS} input[type="range"]`
      );
      const idx = range ? clampRanksPeriodIndex(range.value) : RANKS_PERIOD_IDX_DEFAULT;
      if (range && String(range.value) !== String(idx)) range.value = String(idx);
      const revBtn = topRanksRoot.querySelector(
        ".oep-ranks-date-filter__reverse"
      );
      const reversed = revBtn instanceof HTMLElement ? revBtn.getAttribute("aria-pressed") === "true" : false;
      applyRanksDateHighlights(topRanksRoot, idx, reversed);
    }
    if (settings().isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      applyRanksCardBackgrounds(topRanksRoot);
    }
  }
  function startRanksDateHighlightManager() {
    let debounceTimer = 0;
    let rankPlayListObservers = [];
    function disconnectRankPlayListObservers() {
      rankPlayListObservers.forEach((o) => o.disconnect());
      rankPlayListObservers = [];
    }
    function connectRankPlayListObservers(scheduleFn) {
      disconnectRankPlayListObservers();
      const roots = [];
      const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
      if (ranksPage instanceof HTMLElement) roots.push(ranksPage);
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (w instanceof HTMLElement) roots.push(w);
      });
      for (const root of roots) {
        root.querySelectorAll(".play-detail-list").forEach((listEl) => {
          if (!(listEl instanceof HTMLElement)) return;
          const o = new MutationObserver(() => {
            scheduleFn();
          });
          o.observe(listEl, { childList: true });
          rankPlayListObservers.push(o);
        });
      }
      const mostWatchedList = findMostWatchedReplaysListRoot();
      if (mostWatchedList instanceof HTMLElement) {
        const o = new MutationObserver(() => {
          scheduleFn();
        });
        o.observe(mostWatchedList, { childList: true });
        rankPlayListObservers.push(o);
      }
    }
    const run = () => {
      const periodOn = settings().isEnabled(SCORE_PERIOD_HIGHLIGHT_ID);
      const cardBgOn = settings().isEnabled(RANKS_CARD_BG_FEATURE_ID);
      if (!periodOn) {
        document.querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`).forEach((n) => n.remove());
        document.querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`).forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
        ranksPeriodHighlightStyle.remove();
      } else {
        injectRanksPeriodHighlightStyles();
        const page = document.querySelector(RANKS_PAGE_SELECTOR);
        if (page instanceof HTMLElement) syncRanksDateHighlightForPage(page);
        else {
          document.querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`).forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
        }
      }
      if (cardBgOn) {
        injectRanksCardBgLayoutStyles();
        const ranksPage = document.querySelector(RANKS_PAGE_SELECTOR);
        if (ranksPage instanceof HTMLElement)
          applyRanksCardBackgrounds(ranksPage);
        document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`).forEach((listEl) => {
          if (listEl instanceof HTMLElement) applyRanksCardBackgrounds(listEl);
        });
        const mostWatchedList = findMostWatchedReplaysListRoot();
        if (mostWatchedList instanceof HTMLElement)
          applyRanksCardBackgrounds(mostWatchedList);
      } else {
        ranksCardBgLayoutStyle.remove();
      }
      if (periodOn || cardBgOn) {
        connectRankPlayListObservers(schedule);
      } else {
        disconnectRankPlayListObservers();
      }
    };
    const schedule = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(run, 64);
    };
    const ac = new AbortController();
    observe.subscribe(
      {
        selector: `${RANKS_PAGE_SELECTOR}, h3.title.title--page-extra-small`,
        schedule: "sync",
        // schedule() debounces
        signal: ac.signal,
        label: "profile/ranks-period"
      },
      schedule
    );
    schedule();
    const unsubBg = settings().onChange(RANKS_CARD_BG_FEATURE_ID, (enabled) => {
      if (enabled) {
        injectRanksCardBgLayoutStyles();
        const page = document.querySelector(RANKS_PAGE_SELECTOR);
        if (page instanceof HTMLElement) applyRanksCardBackgrounds(page);
        document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS} .play-detail-list`).forEach((listEl) => {
          if (listEl instanceof HTMLElement) applyRanksCardBackgrounds(listEl);
        });
        const mostWatchedList = findMostWatchedReplaysListRoot();
        if (mostWatchedList instanceof HTMLElement)
          applyRanksCardBackgrounds(mostWatchedList);
      } else {
        revertRanksCardBackgrounds();
        ranksCardBgLayoutStyle.remove();
      }
    });
    const unsubPeriod = settings().onChange(
      SCORE_PERIOD_HIGHLIGHT_ID,
      () => schedule()
    );
    return () => {
      unsubPeriod();
      unsubBg();
      clearTimeout(debounceTimer);
      disconnectRankPlayListObservers();
      ac.abort();
      ranksPeriodHighlightStyle.remove();
      ranksCardBgLayoutStyle.remove();
      document.querySelectorAll(`.${RANKS_DATE_FILTER_CLASS}`).forEach((n) => n.remove());
      document.querySelectorAll(`.${RANKS_DATE_HIGHLIGHT_CLASS}`).forEach((row) => row.classList.remove(RANKS_DATE_HIGHLIGHT_CLASS));
      revertRanksCardBackgrounds();
    };
  }

  // src/features/profile/csrf.js
  function maybeCsrfToken() {
    const m = document.querySelector('meta[name="csrf-token"]');
    if (!(m instanceof HTMLMetaElement)) return "";
    return String(m.content || "").trim();
  }

  // src/features/profile/recent-scores/options-menu.js
  var SCORE_OPTIONS_WRAP_CLASS = "oep-score-options-wrap";
  var SCORE_OPTIONS_BTN_CLASS = "oep-score-options-btn";
  var SCORE_OPTIONS_MENU_CLASS = "oep-score-options-menu";
  var SCORE_OPTIONS_ITEM_CLASS = "oep-score-options-item";
  function _closeAllScoreOptionsMenus() {
    document.querySelectorAll(`.${SCORE_OPTIONS_MENU_CLASS}[data-open]`).forEach((m) => m.removeAttribute("data-open"));
  }
  var portaledMenus = /* @__PURE__ */ new Set();
  var menuByButton = /* @__PURE__ */ new WeakMap();
  var buttonByMenu = /* @__PURE__ */ new WeakMap();
  var docClickListener = null;
  var repositionListener = null;
  function placeMenuUnderButton(menu, btn) {
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 2}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
  }
  function repositionOpenMenus() {
    for (const menu of portaledMenus) {
      if (!menu.hasAttribute("data-open")) continue;
      const btn = buttonByMenu.get(menu);
      if (btn?.isConnected) placeMenuUnderButton(menu, btn);
      else menu.removeAttribute("data-open");
    }
  }
  function _ensureScoreOptionsDocListener() {
    if (docClickListener) return;
    docClickListener = (e) => {
      const target = (
        /** @type {Element} */
        e.target
      );
      const inWrap = target.closest?.(`.${SCORE_OPTIONS_WRAP_CLASS}`);
      const inMenu = target.closest?.(`.${SCORE_OPTIONS_MENU_CLASS}`);
      if (!inWrap && !inMenu) _closeAllScoreOptionsMenus();
    };
    document.addEventListener("click", docClickListener, { capture: true });
    repositionListener = repositionOpenMenus;
    document.addEventListener("scroll", repositionListener, {
      capture: true,
      passive: true
    });
    window.addEventListener("resize", repositionListener);
  }
  function removeScoreOptionsMenu(btn) {
    const menu = menuByButton.get(btn);
    if (!menu) return;
    menu.remove();
    portaledMenus.delete(menu);
  }
  function disposeScoreOptionsMenus() {
    portaledMenus.forEach((m) => m.remove());
    portaledMenus.clear();
    if (docClickListener) {
      document.removeEventListener("click", docClickListener, { capture: true });
      docClickListener = null;
    }
    if (repositionListener) {
      document.removeEventListener("scroll", repositionListener, {
        capture: true
      });
      window.removeEventListener("resize", repositionListener);
      repositionListener = null;
    }
  }
  function buildScoreOptionsMenu(score) {
    const scoreId = score?.id;
    if (scoreId == null) return null;
    const menu = el("div", { class: SCORE_OPTIONS_MENU_CLASS });
    const viewLink = el(
      "a",
      {
        class: SCORE_OPTIONS_ITEM_CLASS,
        href: `https://osu.ppy.sh/scores/${scoreId}`,
        target: "_blank",
        rel: "noopener noreferrer"
      },
      "View details"
    );
    viewLink.addEventListener("click", () => menu.removeAttribute("data-open"));
    menu.appendChild(viewLink);
    if (score.has_replay) {
      const replayLink = el(
        "a",
        {
          class: SCORE_OPTIONS_ITEM_CLASS,
          href: `https://osu.ppy.sh/scores/${scoreId}/download`,
          rel: "noopener noreferrer"
        },
        "Download replay"
      );
      replayLink.addEventListener(
        "click",
        () => menu.removeAttribute("data-open")
      );
      menu.appendChild(replayLink);
    }
    const ownerId = score?.user_id ?? score?.user?.id ?? getProfileUserId();
    const me = getCurrentUserIdFromHeader();
    const isOwnProfile = ownerId != null && me != null && String(ownerId) === me;
    if (isOwnProfile) {
      const pinBtn = el(
        "button",
        { type: "button", class: SCORE_OPTIONS_ITEM_CLASS },
        "Pin"
      );
      pinBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (pinBtn.classList.contains(`${SCORE_OPTIONS_ITEM_CLASS}--pending`))
          return;
        pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
        pinBtn.textContent = "Pinning…";
        try {
          const headers = {
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
          };
          const csrf = maybeCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
          const resp = await fetch(`/score-pins/${scoreId}`, {
            method: "PUT",
            credentials: "include",
            headers
          });
          pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
          if (resp.ok || resp.status === 204) {
            pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--done`);
            pinBtn.textContent = "Pinned!";
          } else {
            pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
            pinBtn.textContent = `Failed (${resp.status})`;
          }
        } catch {
          pinBtn.classList.remove(`${SCORE_OPTIONS_ITEM_CLASS}--pending`);
          pinBtn.classList.add(`${SCORE_OPTIONS_ITEM_CLASS}--error`);
          pinBtn.textContent = "Error";
        }
        setTimeout(() => {
          pinBtn.classList.remove(
            `${SCORE_OPTIONS_ITEM_CLASS}--done`,
            `${SCORE_OPTIONS_ITEM_CLASS}--error`
          );
          pinBtn.textContent = "Pin";
          menu.removeAttribute("data-open");
        }, 2e3);
      });
      menu.appendChild(pinBtn);
    }
    const btn = el(
      "button",
      {
        type: "button",
        class: SCORE_OPTIONS_BTN_CLASS,
        title: "Options"
      },
      el("i", { class: "fas fa-ellipsis-h" })
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.hasAttribute("data-open");
      _closeAllScoreOptionsMenus();
      if (!isOpen) {
        _ensureScoreOptionsDocListener();
        if (!menu.isConnected) {
          document.body.appendChild(menu);
          portaledMenus.add(menu);
        }
        placeMenuUnderButton(menu, btn);
        menu.setAttribute("data-open", "");
      }
    });
    menuByButton.set(btn, menu);
    buttonByMenu.set(menu, btn);
    return el("div", { class: SCORE_OPTIONS_WRAP_CLASS }, btn);
  }
  function scoreTimestampIso(score) {
    if (!score || typeof score !== "object") return "";
    const raw = score.ended_at || score.created_at || "";
    return typeof raw === "string" ? raw : "";
  }

  // src/features/profile/score-list-data.js
  var PROFILE_SCORES_CACHE_TTL_MS = 2 * 60 * 1e3;
  var SCORE_LIST_PAGE_SIZE = 100;
  var SCORE_LIST_MAX_TOTAL = 1e3;
  function _profileScoresCacheTtl(userId) {
    return String(userId) === String(getCurrentUserIdFromHeader()) ? 0 : PROFILE_SCORES_CACHE_TTL_MS;
  }
  var _scoreListCache = /* @__PURE__ */ new Map();
  var scoreListVisit = 0;
  function beginScoreListVisit() {
    scoreListVisit += 1;
  }
  function _scoreListEntry(userId, mode, type) {
    const key = `${userId}:${mode}:${type}`;
    let entry = _scoreListCache.get(key);
    const ttl = _profileScoresCacheTtl(userId);
    const stale = (e) => ttl === 0 ? e.visit !== scoreListVisit : Date.now() - e.ts >= ttl;
    if (!entry || !entry.pending && stale(entry)) {
      entry = {
        scores: [],
        done: false,
        ts: Date.now(),
        visit: scoreListVisit,
        lastPageKey: "",
        pending: null
      };
      _scoreListCache.set(key, entry);
    }
    return entry;
  }
  async function _fetchScoreListPage(userId, mode, type, entry) {
    const offset = entry.scores.length;
    const url = `/users/${userId}/scores/${type}?mode=${mode}&limit=${SCORE_LIST_PAGE_SIZE}&offset=${offset}&include=beatmap`;
    let items;
    try {
      const resp = await OsuExpertPlus.api.siteFetch(url, {
        headers: { Accept: "application/json" }
      });
      if (!resp.ok) return false;
      const body = await resp.json();
      items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
    } catch {
      return false;
    }
    if (items.length < SCORE_LIST_PAGE_SIZE) entry.done = true;
    if (!items.length) return false;
    const pageKey = items.map(
      (it) => it?.id != null ? String(it.id) : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`
    ).join("|");
    if (pageKey && pageKey === entry.lastPageKey) {
      entry.done = true;
      return false;
    }
    entry.lastPageKey = pageKey;
    entry.scores.push(...items);
    if (entry.scores.length >= SCORE_LIST_MAX_TOTAL) entry.done = true;
    return true;
  }
  async function fetchScores(userId, mode, type, needed) {
    const entry = _scoreListEntry(userId, mode, type);
    const target = Math.min(Math.max(needed, 1), SCORE_LIST_MAX_TOTAL);
    while (!entry.done && entry.scores.length < target) {
      if (!entry.pending) {
        entry.pending = _fetchScoreListPage(userId, mode, type, entry).finally(
          () => {
            entry.pending = null;
          }
        );
      }
      if (!await entry.pending) break;
    }
    return entry.scores;
  }
  function _scoreListComplete(userId, mode, type) {
    return _scoreListCache.get(`${userId}:${mode}:${type}`)?.done === true;
  }
  function _sharedPromise(cache, key, ttlMs, factory) {
    const hit = cache.get(key);
    if (hit && (hit.pending || Date.now() - hit.ts < ttlMs)) return hit.promise;
    const entry = { ts: Date.now(), pending: true, promise: null };
    entry.promise = factory().then(
      (value) => {
        entry.pending = false;
        entry.ts = Date.now();
        return value;
      },
      (err) => {
        if (cache.get(key) === entry) cache.delete(key);
        throw err;
      }
    );
    cache.set(key, entry);
    return entry.promise;
  }
  var _mostWatchedCache = /* @__PURE__ */ new Map();
  function fetchMostWatchedScores(userId, mode) {
    return _sharedPromise(
      _mostWatchedCache,
      `${userId}:${mode}`,
      _profileScoresCacheTtl(userId),
      async () => {
        const url = `/users/${userId}/extra-pages/historical?mode=${mode}`;
        const resp = await OsuExpertPlus.api.siteFetch(url, {
          headers: { Accept: "application/json" }
        });
        if (!resp.ok) throw new Error(`historical ${resp.status}`);
        const body = await resp.json();
        const items = body?.score_replay_stats?.items;
        if (!Array.isArray(items)) return [];
        return items.map((item) => item?.score).filter(Boolean);
      }
    ).catch(() => []);
  }

  // src/features/profile/recent-scores/data.js
  var RECENT_SCORES_MERGED_MAX = 200;
  async function fetchWebsiteRecentScoresPassedOnly(userId, mode) {
    const q = new URLSearchParams({
      mode: String(mode),
      limit: "100"
    });
    q.append("include", "beatmap");
    q.append("include", "beatmapset");
    const resp = await OsuExpertPlus.api.siteFetch(
      `/users/${userId}/scores/recent?${q}`,
      { headers: { Accept: "application/json" } }
    );
    if (!resp.ok) return [];
    let body;
    try {
      body = await resp.json();
    } catch {
      return [];
    }
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.items)) return body.items;
    return [];
  }
  async function fetchRecentScoresPaginatedHtmlWithFails(userId, mode) {
    const scores = [];
    const limit = 100;
    const maxTotal = RECENT_SCORES_MERGED_MAX;
    let lastPageKey = "";
    let pageCount = 0;
    for (let offset = 0; ; offset += limit) {
      const q = new URLSearchParams({
        mode,
        limit: String(limit),
        offset: String(offset),
        include_fails: "1"
      });
      q.append("include", "beatmap");
      q.append("include", "beatmapset");
      let resp;
      try {
        resp = await OsuExpertPlus.api.siteFetch(
          `/users/${userId}/scores/recent?${q}`,
          { headers: { Accept: "application/json" } }
        );
      } catch (err) {
        if (pageCount === 0) throw err;
        break;
      }
      if (!resp.ok) {
        if (pageCount === 0) throw new Error(`HTTP ${resp.status}`);
        break;
      }
      let body;
      try {
        body = await resp.json();
      } catch (err) {
        if (pageCount === 0) throw err;
        break;
      }
      const items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
      pageCount += 1;
      if (!items.length) break;
      const pageKey = items.map(
        (it) => it?.id != null ? String(it.id) : `${it?.beatmap?.id ?? "?"}:${it?.ended_at ?? "?"}:${it?.total_score ?? "?"}`
      ).join("|");
      if (pageKey && pageKey === lastPageKey) {
        break;
      }
      lastPageKey = pageKey;
      scores.push(...items);
      if (scores.length >= maxTotal) {
        break;
      }
      if (items.length < limit) break;
    }
    return scores.slice(0, maxTotal);
  }
  function _recentScoreDisplayRank(s) {
    if (!s || typeof s !== "object") return 0;
    let r = 0;
    if (s.ended_at) r += 2;
    if (s.type === "solo_score") r += 3;
    if (Array.isArray(s.mods) && s.mods.length > 0 && typeof s.mods[0] === "object")
      r += 2;
    if (s.ruleset_id != null) r += 1;
    return r;
  }
  function _pickMergedRecentScore(a, b) {
    const af = a?.passed === false;
    const bf = b?.passed === false;
    if (af !== bf) return af ? a : b;
    const ra = _recentScoreDisplayRank(a);
    const rb = _recentScoreDisplayRank(b);
    if (rb !== ra) return rb > ra ? b : a;
    return a;
  }
  function mergeRecentScoresWithExtendedPassed(primary, extraPassed) {
    const map = /* @__PURE__ */ new Map();
    primary.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = scoreMergeKey(s);
      if (k == null) k = `z:primary:${i}`;
      if (!map.has(k)) map.set(k, s);
    });
    extraPassed.forEach((s, i) => {
      if (!s || typeof s !== "object") return;
      let k = scoreMergeKey(s);
      if (k == null) k = `z:extra:${i}`;
      if (!map.has(k)) {
        map.set(k, s);
      } else {
        map.set(k, _pickMergedRecentScore(map.get(k), s));
      }
    });
    return [...map.values()].sort((a, b) => {
      const ta = Date.parse(scoreTimestampIso(a)) || 0;
      const tb = Date.parse(scoreTimestampIso(b)) || 0;
      return tb - ta;
    });
  }
  async function fetchRecentScoresPrimaryWithFails(userId, mode) {
    let site = null;
    let siteError = null;
    try {
      site = await fetchRecentScoresPaginatedHtmlWithFails(userId, mode);
    } catch (err) {
      siteError = err;
    }
    if (site?.length) return site;
    try {
      const data = await OsuExpertPlus.api.getUserRecentScores(
        userId,
        mode,
        100,
        0,
        true
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (site) return site;
      throw siteError || err;
    }
  }
  var RECENT_SCORES_CACHE_TTL_MS = 60 * 1e3;
  var _recentScoresCache = /* @__PURE__ */ new Map();
  function fetchRecentScoresIncludingFails(userId, mode) {
    const ttl = Math.min(
      _profileScoresCacheTtl(userId),
      RECENT_SCORES_CACHE_TTL_MS
    );
    return _sharedPromise(
      _recentScoresCache,
      `${userId}:${mode}`,
      ttl,
      async () => {
        const [primary, extraPassed] = await Promise.all([
          fetchRecentScoresPrimaryWithFails(userId, mode),
          fetchWebsiteRecentScoresPassedOnly(userId, mode).catch(() => [])
        ]);
        return mergeRecentScoresWithExtendedPassed(primary, extraPassed).slice(
          0,
          RECENT_SCORES_MERGED_MAX
        );
      }
    );
  }

  // src/features/profile/recent-scores/mods.js
  function findOsuModTemplateNode() {
    const fromList = (listEl) => {
      if (!listEl || isInsideOepRecentFailsWrap(listEl)) return null;
      return listEl.querySelector(".play-detail .mods .mod");
    };
    let m = fromList(findRecentPlaysListRoot());
    if (m instanceof HTMLElement) return m;
    const top = document.querySelector('[data-page-id="top_ranks"]');
    if (top && !isInsideOepRecentFailsWrap(top)) {
      for (const pl of top.querySelectorAll(".play-detail-list")) {
        m = fromList(pl);
        if (m instanceof HTMLElement) return m;
      }
    }
    for (const pl of document.querySelectorAll(".play-detail-list")) {
      if (isInsideOepRecentFailsWrap(pl)) continue;
      m = fromList(pl);
      if (m instanceof HTMLElement) return m;
    }
    return null;
  }
  function waitForOsuModTemplate(maxWaitMs = 2500) {
    const start2 = Date.now();
    return new Promise((resolve2) => {
      const tick = () => {
        const t = findOsuModTemplateNode();
        if (t instanceof HTMLElement) return resolve2(t);
        if (Date.now() - start2 >= maxWaitMs) return resolve2(null);
        setTimeout(tick, 120);
      };
      tick();
    });
  }
  function patchClonedModForAcronym(modRoot, acronym) {
    stripOepModAcronymFromClonedMod(modRoot);
    const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
    const icon = modRoot.querySelector(".mod__icon");
    if (icon instanceof HTMLElement) {
      icon.className = `mod__icon mod__icon--${safe}`;
      icon.setAttribute("data-acronym", acronym);
    }
    const typeClass = modTypeClassForAcronym(acronym);
    const parts = modRoot.className.split(/\s+/).filter(Boolean);
    const rest = parts.filter((c) => !c.startsWith("mod--type-"));
    modRoot.className = [...rest, typeClass].join(" ");
    modRoot.querySelector(".mod__extender")?.remove();
    modRoot.querySelector(".mod__customised-indicator")?.remove();
    modRoot.removeAttribute("title");
    modRoot.removeAttribute(MOD_CUSTOMISED_ATTR);
  }
  function buildApiScoreModsInner(modsList, templateModEl) {
    const modsInner = el("div", { class: "mods" });
    for (const mod of sortModsForDisplay(modsList)) {
      const ac = modAcronym(mod);
      if (!ac) continue;
      let chip;
      if (templateModEl instanceof HTMLElement) {
        chip = /** @type {HTMLElement} */
        templateModEl.cloneNode(true);
        patchClonedModForAcronym(chip, ac);
      } else {
        const safe = modIconSuffix(ac);
        chip = el(
          "div",
          { class: `mod ${modTypeClassForAcronym(ac)}` },
          el("div", {
            class: `mod__icon mod__icon--${safe}`,
            "data-acronym": ac
          })
        );
      }
      applyModCustomisation(chip, mod);
      modsInner.appendChild(chip);
    }
    return modsInner;
  }
  function applyModCustomisation(chip, mod) {
    const settings2 = mod && typeof mod === "object" ? mod.settings : null;
    if (!settings2 || typeof settings2 !== "object") return;
    if (!Object.keys(settings2).length) return;
    chip.setAttribute(MOD_CUSTOMISED_ATTR, "1");
    const rate = Number(settings2.speed_change);
    if (Number.isFinite(rate) && rate > 0) {
      const label = formatSpeedChange(rate, RATE_DISPLAY.profile);
      chip.querySelector(".mod__extender")?.remove();
      chip.appendChild(
        el("div", { class: "mod__extender" }, el("span", {}, label))
      );
      chip.setAttribute("title", `${mod.acronym} (${label})`);
    }
    const badge = document.querySelector(
      ".mod__customised-indicator:not(.oep-mod-badge-clone)"
    );
    if (badge instanceof HTMLElement && !chip.querySelector(".mod__customised-indicator")) {
      const copy = (
        /** @type {HTMLElement} */
        badge.cloneNode(true)
      );
      copy.classList.add("oep-mod-badge-clone");
      chip.appendChild(copy);
    }
  }

  // src/features/profile/recent-scores/row-builder.js
  function buildPlayDetailRowFromApiScore(score, modTemplateEl = null) {
    const bn = "play-detail";
    const bms = score.beatmapset || {};
    const bm = score.beatmap || {};
    const rank = scoreGrade(score, { sanitize: true });
    const rankClass = `score-rank score-rank--full score-rank--${rank}`;
    const titleText = bms.title || "Unknown beatmap";
    const artistText = bms.artist || "—";
    const modsEl = el("div", { class: `${bn}__mods` });
    modsEl.appendChild(buildApiScoreModsInner(score.mods, modTemplateEl));
    if (settings().isEnabled(settingIds().MOD_ICONS_AS_ACRONYMS)) {
      applyModIconsAsAcronyms(modsEl);
    }
    let ppInner;
    if (score.pp != null && Number(score.pp) > 0) {
      const rawN = Number(score.pp);
      const raw = String(score.pp);
      const showPpDecimals = settings().isEnabled(SCORE_PP_DECIMALS_ID);
      const shown = Number.isFinite(rawN) ? showPpDecimals ? formatDecimalPp(rawN) : String(Math.round(rawN)) : raw;
      ppInner = el(
        "span",
        { title: raw, [PP_RAW_ATTR]: raw },
        shown,
        el("span", { class: `${bn}__pp-unit` }, "pp")
      );
    } else {
      ppInner = el("span", {}, "—");
    }
    const scoreTimeIso = scoreTimestampIso(score);
    const ended = scoreTimeIso ? new Date(scoreTimeIso).toLocaleString() : "";
    return el(
      "div",
      {
        class: `${bn} ${bn}--highlightable`
      },
      el(
        "div",
        { class: `${bn}__group ${bn}__group--top` },
        el(
          "div",
          { class: `${bn}__icon ${bn}__icon--main` },
          el("div", { class: rankClass })
        ),
        el(
          "div",
          { class: `${bn}__detail` },
          el(
            "a",
            {
              class: `${bn}__title u-ellipsis-overflow`,
              href: beatmapHrefFromScore(score)
            },
            titleText,
            " ",
            el("small", { class: `${bn}__artist` }, artistText)
          ),
          el(
            "div",
            { class: `${bn}__beatmap-and-time` },
            el("span", { class: `${bn}__beatmap` }, bm.version || "—"),
            el(
              "span",
              { class: `${bn}__time` },
              el(
                "time",
                { class: "js-timeago timeago", datetime: scoreTimeIso || "" },
                ended
              )
            )
          )
        )
      ),
      el(
        "div",
        { class: `${bn}__group ${bn}__group--bottom` },
        el(
          "div",
          { class: `${bn}__score-detail` },
          el(
            "div",
            { class: `${bn}__icon ${bn}__icon--extra` },
            el("div", { class: rankClass })
          ),
          el(
            "div",
            { class: `${bn}__score-detail-top-right` },
            el(
              "div",
              { class: `${bn}__accuracy-and-weighted-pp` },
              el(
                "span",
                { class: `${bn}__accuracy` },
                formatAccuracy(score?.accuracy, ACCURACY_FORMAT.profile)
              )
            )
          )
        ),
        el(
          "div",
          { class: `${bn}__mods-pp` },
          modsEl,
          el("div", { class: `${bn}__pp` }, ppInner)
        ),
        el("div", { class: `${bn}__more` })
      )
    );
  }

  // src/features/profile/list-decorations.js
  var RECENT_SECTION_TYPE = "recent";
  var PLACE_NUMBER_SECTION_TYPES = /* @__PURE__ */ new Set([
    SCORE_PLACE_SECTION_TYPE,
    RECENT_SECTION_TYPE
  ]);
  function ppDecimalsOverwritten(mutations) {
    return mutations.some((m) => {
      if (m.type !== "characterData") return false;
      const span = m.target.parentElement;
      if (!(span instanceof HTMLSpanElement)) return false;
      const titleAttr = span.getAttribute("title");
      if (!titleAttr || !span.parentElement?.matches(".play-detail__pp"))
        return false;
      const n = parseLocaleNumber2(titleAttr);
      if (!Number.isFinite(n)) return false;
      return m.target.nodeValue !== formatDecimalPp(n) + " ";
    });
  }
  var LIST_DECORATIONS = [
    {
      name: "pp-decimals",
      settingId: SCORE_PP_DECIMALS_ID,
      applies: () => settings().isEnabled(SCORE_PP_DECIMALS_ID),
      apply: applyPpDecimals,
      revert: revertPpDecimals,
      sync: syncScoreListPpDecimalsWidthClass,
      isStale: (mutations) => settings().isEnabled(SCORE_PP_DECIMALS_ID) && ppDecimalsOverwritten(mutations)
    },
    {
      name: "hide-weighted-pp",
      applies: () => true,
      apply: applyHideWeightedPp
    },
    {
      name: "place-numbers",
      settingId: SCORE_PLACE_NUMBER_ID,
      applies: ({ type }) => settings().isEnabled(SCORE_PLACE_NUMBER_ID) && PLACE_NUMBER_SECTION_TYPES.has(type),
      apply: (listEl) => {
        scorePlaceNumberStyle.inject();
        applyPlaceNumbers(listEl);
      },
      revert: revertPlaceNumbers,
      release: () => scorePlaceNumberStyle.remove()
    }
  ];
  function decorateScoreList(section, { revertOff = false } = {}) {
    for (const d of LIST_DECORATIONS) {
      if (d.applies(section)) d.apply(section.listEl);
      else if (revertOff) d.revert?.(section.listEl);
    }
  }
  function decorationsStale(mutations) {
    return LIST_DECORATIONS.some((d) => d.isStale?.(mutations));
  }
  function watchDecorationSettings(getSections) {
    return LIST_DECORATIONS.filter((d) => d.settingId).map(
      (d) => settings().onChange(d.settingId, (enabled) => {
        for (const section of getSections()) {
          d.sync?.(section.listEl);
          if (d.applies(section)) d.apply(section.listEl);
          else d.revert?.(section.listEl);
        }
        if (!enabled) d.release?.();
      })
    );
  }

  // src/features/profile/styles.js
  var PLAY_DETAIL_CSS = `
  .oep-hidden { display: none !important; }

  .play-detail__beatmap-and-time {
    align-items: center;
  }

  ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    text-align: left;
    box-sizing: border-box;
  }

  ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35em;
    width: 100%;
    min-width: 0;
    flex: 1 1 0;
    box-sizing: border-box;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    min-width: 0;
    overflow: visible;
  }
  ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail .play-detail__accuracy {
    font-weight: 700;
    font-size: 15px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col .play-detail__accuracy {
    flex-shrink: 0;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col .oep-score-stats {
    margin-top: 0;
  }

  @media (min-width: 900px) {
    ${SCORE_LIST_LAYOUT_SEL} .play-detail {
      align-items: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--top {
      flex: 1 1 0% !important;
      min-width: 0;
      align-items: flex-start !important;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__detail {
      min-width: 0;
      align-items: flex-start;
      text-align: left;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__group--bottom {
      flex: 0 0 auto;
      flex-wrap: nowrap;
      align-items: stretch;
      align-self: stretch;
      box-sizing: border-box;
      --oep-mods-col-max: ${PLAY_DETAIL_DESKTOP_TUNING.modsColMaxWidth};
      --oep-accuracy-col: ${PLAY_DETAIL_DESKTOP_TUNING.accuracyColWidth};
      --oep-combo-stats-col: ${PLAY_DETAIL_DESKTOP_TUNING.comboStatsColWidth};
      --oep-mid-gap: ${PLAY_DETAIL_DESKTOP_TUNING.midGap};
      --oep-score-detail-pad-x: 20px;
      --oep-score-detail-gap: 10px;
      --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
    }

    ${SCORE_LIST_LAYOUT_SEL}.${SCORE_LIST_PP_DECIMALS_CLASS} .play-detail__group--bottom {
      --oep-pp-track: ${PLAY_DETAIL_DESKTOP_TUNING.ppColWidth};
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__mods {
      flex: 0 0 auto;
      width: max-content;
      max-width: var(--oep-mods-col-max);
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      box-sizing: border-box;
      align-self: stretch;
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail {
      flex: 0 0
        calc(
          var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
            var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
        );
      width: calc(
        var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: calc(
        var(--oep-score-detail-pad-x) + var(--oep-score-detail-gap) +
          var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      min-width: 0;
      overflow: hidden;
      box-sizing: border-box;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__score-detail-top-right {
      flex: 1 1 0;
      margin-left: 10px;
      width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      min-width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      overflow: hidden;
      align-self: stretch;
    }

    ${SCORE_LIST_LAYOUT_SEL} .play-detail__pp {
      --desktop-width: ${PLAY_DETAIL_DESKTOP_TUNING.ppDesktopWidth};
      flex: 0 0 var(--oep-pp-track);
      width: var(--oep-pp-track);
      min-width: var(--oep-pp-track);
      max-width: var(--oep-pp-track);
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }

    ${SCORE_LIST_LAYOUT_SEL} .oep-mid-cols {
      flex-direction: row;
      align-items: center;
      gap: var(--oep-mid-gap);
      width: calc(
        var(--oep-accuracy-col) + var(--oep-mid-gap) + var(--oep-combo-stats-col)
      );
      max-width: 100%;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-accuracy-col {
      flex: 0 0 var(--oep-accuracy-col);
      width: var(--oep-accuracy-col);
      max-width: var(--oep-accuracy-col);
      min-width: var(--oep-accuracy-col);
      font-variant-numeric: tabular-nums;
      overflow: visible;
    }
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col {
      flex: 0 0 var(--oep-combo-stats-col);
      width: var(--oep-combo-stats-col);
      max-width: var(--oep-combo-stats-col);
      overflow: hidden;
      container-type: inline-size;
    }
    /* Long counts shrink the text to fit the column on one line, down to
       10px; past that they wrap. Each separator adds 8px of gap and margin
       that does not scale. */
    ${SCORE_LIST_LAYOUT_SEL} .oep-combo-stats-col .oep-score-stats {
      font-size: clamp(
        10px,
        (100cqi - var(--oep-stats-seps, 0) * 8px) /
          (var(--oep-stats-chars, 1) * 0.55),
        13px
      );
    }
  }

  ${SCORE_LIST_LAYOUT_SEL} .play-detail__accuracy-and-weighted-pp {
    display: flex;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0 0.5em;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-content: flex-start;
    box-sizing: border-box;
  }
  .play-detail-list .play-detail__accuracy-and-weighted-pp {
    display: flex;
    flex-flow: row wrap;
    align-items: baseline;
    gap: 0 0.5em;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    justify-content: flex-start;
    box-sizing: border-box;
  }

  .play-detail-list .oep-mid-cols {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.28em;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    box-sizing: border-box;
  }
  .play-detail-list .oep-accuracy-col {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    text-align: right;
    min-width: 0;
    overflow: visible;
    font-variant-numeric: tabular-nums;
  }
  .play-detail-list .oep-accuracy-col .play-detail__accuracy {
    flex-shrink: 0;
  }
  .play-detail-list .play-detail__score-detail .play-detail__accuracy {
    font-weight: 700;
    font-size: 15px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline {
    font-weight: 700;
    font-size: 15px;
    white-space: nowrap;
    flex-shrink: 0;
    text-align: right;
    padding-right: 0.12em;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num {
    font-weight: 500;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-combo-inline__num--full {
    color: #9beb5b;
    font-weight: 800;
  }

  .play-detail-list .oep-combo-inline {
    font-weight: 700;
    font-size: 15px;
    white-space: nowrap;
    flex-shrink: 0;
    text-align: right;
    padding-right: 0.12em;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  .play-detail-list .oep-combo-inline__num {
    font-weight: 500;
  }
  .play-detail-list .oep-combo-inline__num--full {
    color: #9beb5b;
    font-weight: 800;
  }

  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 3px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
    font-size: 13px;
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.75;
    margin-top: 3px;
    line-height: 1;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__sep {
    opacity: 0.35;
    margin: 0 1px;
  }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--300     { color: #78dcff; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--100     { color: #84e03a; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--50      { color: #e0b03a; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--miss    { color: #e05c5c; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--drp-miss { color: #e8a07a; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--perfect { color: #ffd700; }
  ${SCORE_LIST_LAYOUT_SEL} .oep-score-stats__val--good    { color: #6ee0c0; }
  .play-detail-list .oep-score-stats {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 3px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    text-align: right;
    box-sizing: border-box;
    font-size: 13px;
    font-weight: 700;
    color: hsl(var(--hsl-l1, 0 0% 90%));
    opacity: 0.75;
    margin-top: 3px;
    line-height: 1;
  }
  .play-detail-list .oep-score-stats__sep {
    opacity: 0.35;
    margin: 0 1px;
  }
  .play-detail-list .oep-score-stats__val--300     { color: #78dcff; }
  .play-detail-list .oep-score-stats__val--100     { color: #84e03a; }
  .play-detail-list .oep-score-stats__val--50      { color: #e0b03a; }
  .play-detail-list .oep-score-stats__val--miss    { color: #e05c5c; }
  .play-detail-list .oep-score-stats__val--drp-miss { color: #e8a07a; }
  .play-detail-list .oep-score-stats__val--perfect { color: #ffd700; }
  .play-detail-list .oep-score-stats__val--good    { color: #6ee0c0; }

  .oep-sr-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: max(11px, 0.82em);
    padding: 0.22em 0.55em;
    min-width: ${PLAY_DETAIL_DESKTOP_TUNING.srBadgeMinWidth};
    min-height: 1.35em;
    border-radius: 10000px;
    margin: 0 -0.55rem 0 0;
    flex-shrink: 0;
    vertical-align: middle;
    line-height: 1;
    border: none;
    box-sizing: border-box;
    font-variant-numeric: tabular-nums;
  }
  .oep-sr-badge__inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    column-gap: 0.1em;
    flex: 0 0 auto;
    min-width: 0;
    line-height: 1;
  }
  .oep-sr-badge__val {
    flex: 0 0 auto;
    width: auto;
    max-width: none;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .oep-sr-badge__inner .oep-sr-badge__icon {
    font-size: 0.65em;
    line-height: 1;
    color: inherit;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
  }

  .play-detail__pp--watch-count {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end;
    gap: 2px;
  }
  .${MW_PP_CLASS} {
    font-variant-numeric: tabular-nums;
  }

  .oep-recent-fails-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .oep-recent-fails-header .title {
    margin: 0;
    padding: 0;
    line-height: 1.2;
  }
  .oep-recent-fails-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    margin: 0;
    padding: 0;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.02em;
    color: hsl(var(--hsl-c1));
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .oep-recent-fails-toggle .oep-recent-show-fails {
    margin: 0;
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
    border-radius: 3px;
    cursor: pointer;
    accent-color: hsl(var(--hsl-b6));
  }
  .oep-recent-fails-toggle .oep-recent-show-fails:focus-visible {
    outline: 2px solid hsl(var(--hsl-b6));
    outline-offset: 2px;
  }
  .oep-clear-sr-cache-btn {
    appearance: none;
    background: none;
    border: 1px solid hsl(var(--hsl-b5));
    border-radius: 3px;
    color: hsl(var(--hsl-c1));
    cursor: pointer;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1;
    padding: 3px 7px;
    transition: border-color 0.1s, color 0.1s;
    white-space: nowrap;
  }
  .oep-clear-sr-cache-btn:hover {
    border-color: hsl(var(--hsl-c1));
    color: hsl(var(--hsl-l1));
  }
  .oep-clear-sr-cache-btn:active {
    opacity: 0.7;
  }

  .oep-recent-score-card-link {
    cursor: pointer;
  }

  .oep-score-options-wrap {
    position: relative;
    display: inline-flex;
  }
  .oep-score-options-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    appearance: none;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 13px;
    line-height: 1;
    border-radius: 4px;
    transition: color 100ms ease, background-color 100ms ease;
  }
  .oep-score-options-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.1);
  }
  .oep-score-options-menu {
    position: fixed;
    z-index: 9999;
    background: #2a2a3a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    min-width: 130px;
    padding: 4px 0;
    display: none;
  }
  .oep-score-options-menu[data-open] {
    display: block;
  }
  .oep-score-options-item {
    display: block;
    box-sizing: border-box;
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.87);
    font: inherit;
    font-size: 13px;
    text-align: left;
    padding: 8px 14px;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color 80ms ease;
  }
  .oep-score-options-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .oep-score-options-item--pending {
    opacity: 0.55;
    cursor: wait;
    pointer-events: none;
  }
  .oep-score-options-item--done {
    color: rgba(160, 255, 160, 0.9);
  }
  .oep-score-options-item--error {
    color: rgba(255, 180, 100, 0.9);
  }
`;
  var playDetailStyle = manageStyle(
    PLAY_DETAIL_STYLE_ID,
    PLAY_DETAIL_CSS
  );

  // src/features/profile/recent-scores/mount.js
  function ensurePlayDetailStylesForRecent() {
    playDetailStyle.inject();
  }
  var _recentFailsDebounce = null;
  var officialRecentByWrap = /* @__PURE__ */ new WeakMap();
  function replaceOfficialRecentPlays(wrap, listRoot) {
    officialRecentByWrap.set(wrap, removeOfficialRecentPlaysSection(listRoot));
  }
  function populateRecentScoresInnerList(innerList, scores, modTemplate, emptyMessage) {
    innerList.querySelectorAll(`.${SCORE_OPTIONS_BTN_CLASS}`).forEach((b) => {
      removeScoreOptionsMenu(b);
    });
    innerList.textContent = "";
    innerList.classList.toggle(
      SCORE_LIST_LAYOUT_CLASS,
      settings().isEnabled(SCORE_HIT_STATISTICS_ID)
    );
    syncScoreListPpDecimalsWidthClass(innerList);
    if (!scores.length) {
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, emptyMessage)
      );
      return;
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;
    const rows = scores.map((s) => buildPlayDetailRowFromApiScore(s, tpl));
    rows.forEach((r, i) => {
      const score = scores[i];
      rememberRowBeatmap(r, score?.beatmap);
      const moreEl = r.querySelector(".play-detail__more");
      const optionsMenu = buildScoreOptionsMenu(score);
      if (moreEl && optionsMenu) moreEl.appendChild(optionsMenu);
      if (score?.id) {
        r.classList.add("oep-recent-score-card-link");
        r.addEventListener("click", (e) => {
          if (e.target.closest("a, button, input, select, textarea")) return;
          window.location.href = `/scores/${score.id}`;
        });
      }
      innerList.appendChild(r);
    });
    decorateScoreList(
      { listEl: innerList, type: RECENT_SECTION_TYPE },
      { revertOff: true }
    );
    if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
      fillStatsRows(rows, scores);
      enrichPlayDetailRowsMaxComboFromAttributes(rows, scores, innerList);
    }
    if (settings().isEnabled(settingIds().MOD_ICONS_AS_ACRONYMS)) {
      injectModIconsAcronymStyles();
      applyModIconsAsAcronyms(innerList);
    }
    if (settings().isEnabled(MODDED_SR_ID)) {
      if (!_srObserver) initSrObserver();
      rows.forEach(_observeRow);
    }
    if (settings().isEnabled(RANKS_CARD_BG_FEATURE_ID)) {
      injectRanksCardBgLayoutStyles();
      applyRanksCardBackgrounds(innerList);
    }
  }
  function repopulateRecentScoresWrap(wrap) {
    if (!(wrap instanceof HTMLElement)) return;
    const innerList = wrap.querySelector(":scope > .play-detail-list");
    if (!(innerList instanceof HTMLElement)) return;
    const all = recentScoresFullCache.get(wrap);
    if (!all) return;
    const showFails = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    const filtered = filterScoresForRecentDisplay(all, showFails);
    const emptyMsg = !filtered.length && all.length && !showFails ? RECENT_FAILS_EMPTY_FILTERED_MSG : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(
      innerList,
      filtered,
      findOsuModTemplateNode(),
      emptyMsg
    );
  }
  async function tryMountRecentScoresWithFails(userId, mode, isCancelled) {
    if (document.querySelector(`.${RECENT_FAILS_WRAP_CLASS}`)) return;
    const listRoot = findRecentPlaysListRoot();
    if (!listRoot) return;
    const next = listRoot.nextElementSibling;
    if (next instanceof HTMLElement && next.classList.contains(RECENT_FAILS_WRAP_CLASS)) {
      return;
    }
    ensurePlayDetailStylesForRecent();
    const wrap = el("div", { class: RECENT_FAILS_WRAP_CLASS });
    const header = el("div", { class: RECENT_FAILS_HEADER_CLASS });
    header.appendChild(
      el("h3", { class: "title title--page-extra-small" }, "Recent scores")
    );
    const showFailsCb = document.createElement("input");
    showFailsCb.type = "checkbox";
    showFailsCb.className = "oep-recent-show-fails";
    showFailsCb.checked = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.addEventListener("change", () => {
      settings().set(RECENT_SCORES_SHOW_FAILS_ID, showFailsCb.checked);
    });
    header.appendChild(
      el(
        "label",
        { class: "oep-recent-fails-toggle" },
        showFailsCb,
        "Show failed scores"
      )
    );
    const clearCacheBtn = el(
      "button",
      {
        class: "oep-clear-sr-cache-btn",
        type: "button",
        title: "Clears cached modded star ratings and max combo. Use this if values look wrong or outdated after a beatmap is updated."
      },
      "Clear SR cache"
    );
    clearCacheBtn.addEventListener("click", () => {
      clearBeatmapAttributesCache();
      clearCacheBtn.textContent = "Cleared!";
      setTimeout(() => {
        clearCacheBtn.textContent = "Clear SR cache";
      }, 2e3);
    });
    header.appendChild(clearCacheBtn);
    wrap.appendChild(header);
    const innerList = el("div", { class: "play-detail-list" });
    innerList.appendChild(
      el("p", { class: "oep-recent-fails-loading" }, "Loading…")
    );
    wrap.appendChild(innerList);
    listRoot.insertAdjacentElement("afterend", wrap);
    let scores;
    try {
      scores = await fetchRecentScoresIncludingFails(userId, mode);
    } catch {
      if (isCancelled()) return;
      innerList.textContent = "";
      innerList.appendChild(
        el(
          "p",
          { class: "oep-recent-fails-error" },
          "Could not load recent scores (including fails)."
        )
      );
      return;
    }
    if (isCancelled()) return;
    innerList.textContent = "";
    if (!scores.length) {
      innerList.appendChild(
        el("p", { class: "oep-recent-fails-empty" }, RECENT_FAILS_EMPTY_MSG)
      );
      replaceOfficialRecentPlays(wrap, listRoot);
      return;
    }
    recentScoresFullCache.set(wrap, scores);
    let modTemplate = findOsuModTemplateNode();
    if (!(modTemplate instanceof HTMLElement) && scores.some((s) => Array.isArray(s.mods) && s.mods.length > 0)) {
      modTemplate = await waitForOsuModTemplate(2500);
      if (isCancelled()) return;
    }
    const tpl = modTemplate instanceof HTMLElement ? modTemplate : null;
    const showFails = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
    showFailsCb.checked = showFails;
    const filtered = filterScoresForRecentDisplay(scores, showFails);
    const emptyMsg = !filtered.length && scores.length && !showFails ? RECENT_FAILS_EMPTY_FILTERED_MSG : RECENT_FAILS_EMPTY_MSG;
    populateRecentScoresInnerList(innerList, filtered, tpl, emptyMsg);
    replaceOfficialRecentPlays(wrap, listRoot);
  }
  function startRecentScoresWithFailsObserver(userId, mode) {
    let cancelled = false;
    const unsubRecentFailsShow = settings().onChange(
      RECENT_SCORES_SHOW_FAILS_ID,
      () => {
        document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
          if (!(w instanceof HTMLElement)) return;
          const input = w.querySelector("input.oep-recent-show-fails");
          const on = settings().isEnabled(RECENT_SCORES_SHOW_FAILS_ID);
          if (input instanceof HTMLInputElement) input.checked = on;
          repopulateRecentScoresWrap(w);
        });
      }
    );
    const repopulateRecentOnScoreDisplayChange = () => {
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((w) => {
        if (w instanceof HTMLElement) repopulateRecentScoresWrap(w);
      });
    };
    const unsubRecentPpDecimals = settings().onChange(
      SCORE_PP_DECIMALS_ID,
      repopulateRecentOnScoreDisplayChange
    );
    const unsubRecentHitStatistics = settings().onChange(
      SCORE_HIT_STATISTICS_ID,
      repopulateRecentOnScoreDisplayChange
    );
    const unsubRecentPlaceNumbers = settings().onChange(
      SCORE_PLACE_NUMBER_ID,
      repopulateRecentOnScoreDisplayChange
    );
    const run = () => {
      if (cancelled) return;
      clearTimeout(_recentFailsDebounce);
      _recentFailsDebounce = setTimeout(() => {
        if (cancelled) return;
        tryMountRecentScoresWithFails(userId, mode, () => cancelled).catch(
          () => {
          }
        );
      }, 200);
    };
    const ac = new AbortController();
    observe.subscribe(
      {
        selector: 'div.js-sortable--page[data-page-id="historical"], h3.title.title--page-extra-small, .play-detail-list',
        schedule: "sync",
        // run() debounces
        signal: ac.signal,
        label: "profile/recent-scores"
      },
      run
    );
    run();
    return () => {
      cancelled = true;
      clearTimeout(_recentFailsDebounce);
      unsubRecentFailsShow();
      unsubRecentPpDecimals();
      unsubRecentHitStatistics();
      unsubRecentPlaceNumbers();
      ac.abort();
      document.querySelectorAll(`.${RECENT_FAILS_WRAP_CLASS}`).forEach((n) => {
        const official = officialRecentByWrap.get(n);
        if (official?.length) n.before(...official);
        n.remove();
      });
      disposeScoreOptionsMenus();
    };
  }

  // src/features/profile/score-features.js
  var rowsOf = (listEl) => Array.from(listEl.querySelectorAll(".play-detail"));
  var LIST_DATA_FEATURES = [
    {
      // Shown whatever the hit statistics setting says.
      name: "most-watched-pp",
      applies: ({ type }) => type === "most_watched",
      fill: applyMostWatchedPp,
      isStale: (listEl, mutations) => mutations.some((m) => m.type === "childList") && rowsOf(listEl).some((r) => !r.querySelector(`.${MW_PP_CLASS}`))
    },
    {
      name: "hit-statistics",
      applies: () => settings().isEnabled(SCORE_HIT_STATISTICS_ID),
      fill: (listEl, scores) => fillStatsRows(rowsOf(listEl), scores)
    }
  ];
  function mutationsAddRows(mutations) {
    return mutations.some((m) => {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".play-detail") || node.querySelector(".play-detail"))
          return true;
      }
      return false;
    });
  }
  async function initScoreFeatures(userId, mode, run) {
    const { isDisposed, cleanupFns } = run;
    beginScoreListVisit();
    await waitForStaleElementToLeave(PLAY_DETAIL_LIST_STALE_SEL);
    if (isDisposed()) return;
    await waitForElement(
      '[data-page-id="top_ranks"] .play-detail-list',
      15e3
    ).catch(() => {
    });
    if (isDisposed()) return;
    const scoreSections = Array.from(
      document.querySelectorAll(".play-detail-list")
    ).map((listEl) => ({ listEl, type: _getSectionType(listEl) })).filter((s) => SCORE_SECTION_TYPES.includes(s.type));
    scoreSections.forEach(
      ({ listEl }) => listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1")
    );
    setScoreListLayoutClass(
      scoreSections,
      settings().isEnabled(SCORE_HIT_STATISTICS_ID)
    );
    cleanupFns.push(() => setScoreListLayoutClass(scoreSections, false));
    cleanupFns.push(
      () => scoreSections.forEach(({ listEl }) => revertPlaceNumbers(listEl))
    );
    cleanupFns.push(
      () => scoreSections.forEach(({ listEl, type }) => {
        if (type === "most_watched") revertMostWatchedPp(listEl);
      })
    );
    scoreSections.forEach(
      ({ listEl }) => syncScoreListPpDecimalsWidthClass(listEl)
    );
    scoreSections.forEach(
      (section) => decorateScoreList(section, { revertOff: true })
    );
    if (settings().isEnabled(MODDED_SR_ID)) initSrObserver();
    const scoresMap = /* @__PURE__ */ new Map();
    const loading = /* @__PURE__ */ new WeakMap();
    function fillSection(section) {
      const scores = scoresMap.get(section.type);
      if (!scores) return;
      for (const f of LIST_DATA_FEATURES) {
        if (f.applies(section)) f.fill(section.listEl, scores);
      }
      if (settings().isEnabled(SCORE_PP_DECIMALS_ID)) {
        applyPpDecimals(section.listEl);
      }
    }
    function syncSectionData(section) {
      const { listEl, type } = section;
      if (!LIST_DATA_FEATURES.some((f) => f.applies(section))) {
        return Promise.resolve();
      }
      const scores = scoresMap.get(type);
      if (scores) fillSection(section);
      const pending = loading.get(section);
      if (pending) return pending;
      const rowCount = listEl.querySelectorAll(".play-detail").length;
      const needsMore = !scores || type !== "most_watched" && rowCount > scores.length && !_scoreListComplete(userId, mode, type);
      if (!needsMore) return Promise.resolve();
      const load = (type === "most_watched" ? fetchMostWatchedScores(userId, mode) : fetchScores(userId, mode, type, rowCount)).then((loaded) => {
        if (isDisposed()) return;
        scoresMap.set(type, loaded);
        fillSection(section);
      }).finally(() => loading.delete(section));
      loading.set(section, load);
      return load;
    }
    await Promise.all(scoreSections.map(syncSectionData));
    if (isDisposed()) return;
    function mountScoreListObserver(section) {
      const { listEl } = section;
      const obs = new MutationObserver((mutations) => {
        const changed = mutationsAddRows(mutations) || decorationsStale(mutations) || LIST_DATA_FEATURES.some(
          (f) => f.applies(section) && scoresMap.has(section.type) && f.isStale?.(listEl, mutations)
        );
        if (!changed) return;
        decorateScoreList(section);
        syncSectionData(section);
      });
      obs.observe(listEl, {
        childList: true,
        subtree: true,
        characterData: true
      });
      cleanupFns.push(() => obs.disconnect());
      const classObs = new MutationObserver(() => {
        if (settings().isEnabled(SCORE_HIT_STATISTICS_ID) && !listEl.classList.contains(SCORE_LIST_LAYOUT_CLASS)) {
          listEl.classList.add(SCORE_LIST_LAYOUT_CLASS);
          syncScoreListPpDecimalsWidthClass(listEl);
        }
      });
      classObs.observe(listEl, {
        attributes: true,
        attributeFilter: ["class"]
      });
      cleanupFns.push(() => classObs.disconnect());
    }
    scoreSections.forEach(mountScoreListObserver);
    function adoptLateSection(listEl) {
      const type = _getSectionType(listEl);
      if (!SCORE_SECTION_TYPES.includes(type)) return;
      listEl.setAttribute(PLAY_DETAIL_LIST_PROCESSED_ATTR, "1");
      const section = { listEl, type };
      scoreSections.push(section);
      if (settings().isEnabled(SCORE_HIT_STATISTICS_ID)) {
        setScoreListLayoutClass([section], true);
      }
      syncScoreListPpDecimalsWidthClass(listEl);
      mountScoreListObserver(section);
      if (listEl.querySelector(".play-detail") == null) return;
      decorateScoreList(section);
      syncSectionData(section);
    }
    const lateSectionAc = new AbortController();
    observe.subscribe(
      {
        selector: ".play-detail-list",
        schedule: "sync",
        signal: lateSectionAc.signal,
        label: "profile/score-lists"
      },
      () => {
        document.querySelectorAll(
          `.play-detail-list:not([${PLAY_DETAIL_LIST_PROCESSED_ATTR}])`
        ).forEach((listEl) => {
          if (!(listEl instanceof HTMLElement)) return;
          adoptLateSection(listEl);
        });
      }
    );
    cleanupFns.push(() => lateSectionAc.abort());
    cleanupFns.push(
      ...watchDecorationSettings(() => scoreSections),
      settings().onChange(SCORE_HIT_STATISTICS_ID, async (enabled) => {
        if (enabled) {
          setScoreListLayoutClass(scoreSections, true);
          scoreSections.forEach(
            ({ listEl }) => syncScoreListPpDecimalsWidthClass(listEl)
          );
          await Promise.all(scoreSections.map(syncSectionData));
        } else {
          scoreSections.forEach(({ listEl }) => revertStatsRows(listEl));
          setScoreListLayoutClass(scoreSections, false);
          scoreSections.forEach(
            ({ listEl }) => listEl.classList.remove(SCORE_LIST_PP_DECIMALS_CLASS)
          );
        }
      }),
      settings().onChange(MODDED_SR_ID, (enabled) => {
        if (enabled) initSrObserver();
        else revertModdedStarRatings();
      })
    );
  }

  // src/features/profile/subsections.js
  var PROFILE_PAGE_SUBTITLE_H3_SELECTOR = SUBSECTION_TITLE_SEL;
  var PROFILE_SUBSECTION_SKIP_PAGE_IDS = /* @__PURE__ */ new Set(["medals"]);
  var SUBSECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-subsection-collapse";
  var SUBSECTION_BODY_HIDDEN_CLASS = "oep-profile-subsection-body--collapsed-hidden";
  var SUBSECTION_TITLE_CLASS = "oep-profile-subsection-title";
  var SUBSECTION_TITLE_COLLAPSED_CLASS = "oep-profile-subsection-title--collapsed";
  var SUBSECTION_TITLE_MAIN_CLASS = "oep-profile-subsection-title__main";
  var SUBSECTION_TITLE_LABEL_CLASS = "oep-profile-subsection-title__label";
  var SUBSECTION_DONE_ATTR = "data-oep-subsection-collapse";
  var SUBSECTION_BODY_FOR_ATTR = "data-oep-subsection-for";
  var SUBSECTION_TOGGLE_ATTR = "data-oep-profile-subsection-collapse-toggle";
  var SUBSECTION_TOGGLE_FOR_ATTR = "data-oep-profile-subsection-for";
  var SUBSECTION_LABEL_ATTR = "data-oep-subsection-label";
  var SUBSECTION_COLLAPSED_DIM_OPACITY = "0.64";
  var SUBSECTION_COLLAPSE_CSS = `
  .${SUBSECTION_BODY_HIDDEN_CLASS} {
    display: none !important;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35em;
    cursor: pointer;
    line-height: normal;
    padding: 10px 0;
    margin: 0;
    isolation: isolate;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::before {
    z-index: 0;
    transition: opacity 120ms ease;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS}.title.title--page-extra-small::before {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::after {
    content: "";
    position: absolute;
    top: 0;
    right: -8px;
    bottom: 0;
    left: -1.8rem;
    border-radius: 6px;
    background-color: transparent;
    transition: background-color 120ms ease;
    pointer-events: none;
    z-index: 1;
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small:hover::after {
    background-color: rgba(255, 255, 255, 0.07);
  }
  h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small > * {
    position: relative;
    z-index: 2;
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 10px;
    min-width: 0;
    flex: 1 1 auto;
    line-height: inherit;
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
    transition: opacity 120ms ease;
    line-height: inherit;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    box-sizing: border-box;
    margin: 0;
    padding: 0 10px;
    height: 1.85em;
    min-width: 1.85em;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
    transition: opacity 120ms ease;
  }
  h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
    opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
  }
  button.oep-profile-subsection-collapse-toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  button.oep-profile-subsection-collapse-toggle:focus-visible {
    clip-path: none;
    width: auto;
    height: auto;
    margin: 0;
    padding: 2px 6px;
    overflow: visible;
    outline: 1px solid hsl(var(--hsl-l2));
    outline-offset: 1px;
    background: rgba(255, 255, 255, 0.08);
    color: hsl(var(--hsl-l1));
    font-size: 0.75rem;
    z-index: 1;
  }
`;
  var subsectionCollapseStyle = manageStyle(
    SUBSECTION_COLLAPSE_STYLE_ID,
    SUBSECTION_COLLAPSE_CSS
  );
  function subsectionSlugFromTitle(text, usedSlugs) {
    let base = String(text || "").trim().toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    if (!base) base = "subsection";
    let slug = base;
    let n = 0;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${base}_${n}`;
    }
    usedSlugs.add(slug);
    return slug;
  }
  var SUBSECTION_SHOW_MORE_NAMED_MODIFIERS = /* @__PURE__ */ new Set([
    "pinned",
    "best",
    "firsts",
    "recent"
  ]);
  var SUBSECTION_SHOW_MORE_SKIP_MODIFIERS = /* @__PURE__ */ new Set(["loading"]);
  function subsectionNamedModifierFromFollowingContent(h3) {
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement) {
      if (n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
      const roots = n.matches(".show-more-link") ? [n] : Array.from(n.querySelectorAll(".show-more-link"));
      for (const sm of roots) {
        for (const c of sm.classList) {
          if (!c.startsWith("show-more-link--")) continue;
          const mod = c.slice("show-more-link--".length);
          if (SUBSECTION_SHOW_MORE_SKIP_MODIFIERS.has(mod)) continue;
          if (SUBSECTION_SHOW_MORE_NAMED_MODIFIERS.has(mod)) return mod;
        }
      }
      n = n.nextElementSibling;
    }
    return null;
  }
  function migrateSubsectionCollapseLegacyKey(collapsedSet, legacyKey, stableKey) {
    if (!legacyKey || !stableKey || legacyKey === stableKey) return false;
    if (!collapsedSet.has(legacyKey)) return false;
    collapsedSet.add(stableKey);
    collapsedSet.delete(legacyKey);
    return true;
  }
  function collectSubsectionBodyElements(h3) {
    const recentHeader = h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`);
    if (recentHeader instanceof HTMLElement && recentHeader.contains(h3)) {
      const bodies2 = [];
      let n2 = h3.nextElementSibling;
      while (n2 instanceof HTMLElement) {
        bodies2.push(n2);
        n2 = n2.nextElementSibling;
      }
      let p = recentHeader.nextElementSibling;
      while (p instanceof HTMLElement) {
        if (p.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
        bodies2.push(p);
        p = p.nextElementSibling;
      }
      return bodies2;
    }
    const bodies = [];
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement && !n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR) && !n.querySelector(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) {
      bodies.push(n);
      n = n.nextElementSibling;
    }
    return bodies;
  }
  function wrapSubsectionTitleContent(h3, btn) {
    if (h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`)) return;
    if (!btn.nextSibling) return;
    const main = el("span", { class: SUBSECTION_TITLE_MAIN_CLASS });
    let n = btn.nextSibling;
    let label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
    while (n) {
      const next = n.nextSibling;
      if (n instanceof HTMLElement && n.classList.contains("title__count")) {
        if (label.childNodes.length) main.appendChild(label);
        main.appendChild(n);
        label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
      } else {
        label.appendChild(n);
      }
      n = next;
    }
    if (label.childNodes.length) main.appendChild(label);
    if (!main.childNodes.length) return;
    btn.insertAdjacentElement("afterend", main);
  }
  function unwrapSubsectionTitleMain(h3) {
    const main = h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`);
    if (!(main instanceof HTMLElement)) return;
    for (const label of main.querySelectorAll(
      `.${SUBSECTION_TITLE_LABEL_CLASS}`
    )) {
      label.replaceWith(...label.childNodes);
    }
    main.replaceWith(...main.childNodes);
  }
  function toggleProfileSubsectionCollapsedKey(key) {
    if (!key) return;
    const set = readCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    writeCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED, set);
    applyProfileSubsectionCollapseState(set);
  }
  function applyProfileSubsectionCollapseState(collapsed) {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el2) => {
      if (!(el2 instanceof HTMLElement)) return;
      const key = el2.getAttribute(SUBSECTION_BODY_FOR_ATTR);
      if (!key) return;
      if (collapsed.has(key)) el2.classList.add(SUBSECTION_BODY_HIDDEN_CLASS);
      else el2.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document.querySelectorAll(`button[${SUBSECTION_TOGGLE_ATTR}]`).forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const key = btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR);
      if (!key) return;
      const isCollapsed = collapsed.has(key);
      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
      const label = btn.getAttribute(SUBSECTION_LABEL_ATTR) || key;
      btn.title = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;
      btn.setAttribute(
        "aria-label",
        isCollapsed ? `Expand ${label}` : `Collapse ${label}`
      );
      const h3El = btn.closest("h3");
      if (h3El) {
        h3El.classList.toggle(SUBSECTION_TITLE_COLLAPSED_CLASS, isCollapsed);
      }
    });
  }
  function teardownProfileSubsectionCollapse() {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el2) => {
      el2.removeAttribute(SUBSECTION_BODY_FOR_ATTR);
      el2.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document.querySelectorAll(`h3[${SUBSECTION_DONE_ATTR}]`).forEach((h3) => {
      if (!(h3 instanceof HTMLElement)) return;
      unwrapSubsectionTitleMain(h3);
      h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`)?.remove();
      h3.removeAttribute(SUBSECTION_DONE_ATTR);
      h3.classList.remove(
        SUBSECTION_TITLE_CLASS,
        SUBSECTION_TITLE_COLLAPSED_CLASS
      );
    });
  }
  function subsectionTitleText(h3) {
    const copy = (
      /** @type {HTMLElement} */
      h3.cloneNode(true)
    );
    copy.querySelectorAll(".title__count, button").forEach((n) => n.remove());
    return String(copy.textContent || "").trim();
  }
  function subsectionContentName(h3) {
    if (h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`)) return "recent";
    for (const body of collectSubsectionBodyElements(h3)) {
      const list = body.matches(".play-detail-list") ? body : body.querySelector(".play-detail-list");
      if (!(list instanceof HTMLElement)) continue;
      if (list.closest(`.${RECENT_FAILS_WRAP_CLASS}`) || list.classList.contains("u-relative") && list.closest('[data-page-id="historical"]')) {
        return "recent";
      }
      const type = _getSectionType(list);
      if (type) return type;
    }
    return subsectionNamedModifierFromFollowingContent(h3);
  }
  function subsectionKeys(pageId, h3, pass) {
    const label = String(h3.textContent || "").trim() || pageId;
    const legacyKey = `${pageId}::${subsectionSlugFromTitle(label, pass.legacySlugs)}`;
    const indexKey = `${pageId}::sub_${pass.index}`;
    pass.index += 1;
    const name = subsectionContentName(h3) ?? subsectionSlugFromTitle(subsectionTitleText(h3) || pageId, pass.titleSlugs);
    return { key: `${pageId}::${name}`, label, olderKeys: [legacyKey, indexKey] };
  }
  function enhanceSubsectionTitle(h3, key, label, signal) {
    const btn = el("button", {
      type: "button",
      class: "oep-profile-subsection-collapse-toggle",
      [SUBSECTION_TOGGLE_ATTR]: "1",
      [SUBSECTION_TOGGLE_FOR_ATTR]: key,
      [SUBSECTION_LABEL_ATTR]: label
    });
    const toggle = () => toggleProfileSubsectionCollapsedKey(
      btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR) || ""
    );
    listen(
      btn,
      "click",
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggle();
      },
      signal
    );
    listen(
      h3,
      "click",
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        if (t.closest(`button[${SUBSECTION_TOGGLE_ATTR}]`)) return;
        if (t.closest("a[href]")) return;
        toggle();
      },
      signal
    );
    h3.insertBefore(btn, h3.firstChild);
    wrapSubsectionTitleContent(h3, btn);
    h3.classList.add(SUBSECTION_TITLE_CLASS);
    h3.setAttribute(SUBSECTION_DONE_ATTR, "1");
  }
  function syncPageSubsections(pageEl, collapsedSet, signal) {
    const pageId = pageEl.getAttribute("data-page-id");
    if (!pageId) return false;
    if (PROFILE_SUBSECTION_SKIP_PAGE_IDS.has(pageId)) return false;
    const pass = { index: 0, legacySlugs: /* @__PURE__ */ new Set(), titleSlugs: /* @__PURE__ */ new Set() };
    let migrationDirty = false;
    for (const h3 of pageEl.querySelectorAll(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) {
      if (!(h3 instanceof HTMLElement)) continue;
      if (h3.closest(".js-sortable--page") !== pageEl) continue;
      const { key, label, olderKeys } = subsectionKeys(pageId, h3, pass);
      for (const older of olderKeys) {
        if (migrateSubsectionCollapseLegacyKey(collapsedSet, older, key)) {
          migrationDirty = true;
        }
      }
      const btn = h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`);
      if (!h3.hasAttribute(SUBSECTION_DONE_ATTR) || !btn) {
        enhanceSubsectionTitle(h3, key, label, signal);
      } else if (btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR) !== key) {
        btn.setAttribute(SUBSECTION_TOGGLE_FOR_ATTR, key);
      }
      for (const b of collectSubsectionBodyElements(h3)) {
        if (b.getAttribute(SUBSECTION_BODY_FOR_ATTR) !== key) {
          b.setAttribute(SUBSECTION_BODY_FOR_ATTR, key);
        }
      }
    }
    return migrationDirty;
  }
  function scanProfileSubsections(signal) {
    const collapsedSet = readCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED);
    let migrationDirty = false;
    getSectionPageNodes().forEach((page) => {
      if (syncPageSubsections(page, collapsedSet, signal)) {
        migrationDirty = true;
      }
    });
    if (migrationDirty) {
      writeCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED, collapsedSet);
    }
    applyProfileSubsectionCollapseState(collapsedSet);
  }
  function startProfileSubsectionCollapseManager() {
    subsectionCollapseStyle.inject();
    const ac = new AbortController();
    scanProfileSubsections(ac.signal);
    observe.subscribe(
      {
        selector: `${SECTION_PAGE_SEL}, ${PROFILE_PAGE_SUBTITLE_H3_SELECTOR}, .${RECENT_FAILS_WRAP_CLASS}, .play-detail-list, .show-more-link`,
        schedule: 80,
        signal: ac.signal,
        label: "profile/subsections"
      },
      () => scanProfileSubsections(ac.signal)
    );
    return () => {
      ac.abort();
      teardownProfileSubsectionCollapse();
      subsectionCollapseStyle.remove();
    };
  }

  // src/features/profile/sections.js
  var SECTION_COLLAPSE_PAGE_CLASS = "oep-profile-section--collapsed";
  var SECTION_COLLAPSE_BODY_HIDDEN_CLASS = "oep-profile-section-body--collapsed-hidden";
  var SECTION_COLLAPSE_MAIN_TITLE_SELECTOR = SECTION_TITLE_SEL;
  var SECTION_COLLAPSE_SUBTITLE_SELECTOR = SUBSECTION_TITLE_SEL;
  var SECTION_TAB_COLLAPSED_CLASS = "oep-profile-section-tab--collapsed";
  var SECTION_PAGE_TITLE_CLICK_ATTR = "data-oep-profile-section-page-title-click";
  var SECTION_TAB_CHEVRON_ATTR = "data-oep-section-tab-chevron";
  var SECTION_CONTENTS_ROW_CLASS = "oep-profile-contents-row";
  var SECTION_PAGE_TITLE_TOGGLE_CLASS = "oep-profile-section-page-title--toggle";
  var SECTION_PAGE_TITLE_LABEL_CLASS = "oep-profile-section-page-title__label";
  var SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS = "oep-profile-section-page-title__collapsed-suffix";
  var SECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-section-collapse";
  var SECTION_COLLAPSE_HARD_MODE_CLASS = "oep-profile-section-collapse--hard";
  var SECTION_TAB_LINK_SEL = `${HASH_LINK_SEL}:not([href="#"])`;
  var SECTION_COLLAPSE_CSS = `
  .${SECTION_COLLAPSE_BODY_HIDDEN_CLASS} {
    display: none !important;
  }
  /* React rewrites className when a lazy-load body finishes loading, which
     drops the class above, so the usual layout is also hidden from the page. */
  div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
    > .page-extra
    > :not(${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}):not(${SECTION_COLLAPSE_SUBTITLE_SELECTOR}):not(div.u-relative:has(> ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR})) {
    display: none !important;
  }
  html.${SECTION_COLLAPSE_HARD_MODE_CLASS}
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
    > div.u-relative
    > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small) {
    display: none !important;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra {
    cursor: pointer;
    user-select: none;
    position: relative;
    isolation: isolate;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra > .${SECTION_PAGE_TITLE_LABEL_CLASS} {
    position: relative;
    z-index: 2;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::after {
    content: "";
    position: absolute;
    top: -0.25em;
    right: -0.55em;
    bottom: -0.25em;
    left: -1.5em;
    border-radius: 6px;
    background-color: transparent;
    transition: background-color 120ms ease;
    pointer-events: none;
    z-index: 1;
  }
  div.js-sortable--page
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra:hover::after {
    background-color: rgba(255, 255, 255, 0.07);
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra
    > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS} {
    position: relative;
    z-index: 2;
    font-weight: 600;
    font-size: 0.88em;
    opacity: 0.9;
  }
  h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::before {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    content: "\\f077";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translate(calc(-100% - 0.7em), -50%);
    font-size: 0.65em;
    line-height: 1;
    color: hsl(var(--hsl-c1));
    opacity: 0.9;
    pointer-events: none;
    transition: opacity 120ms ease;
    z-index: 2;
  }
  div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
    h2.title.title--page-extra.${SECTION_PAGE_TITLE_TOGGLE_CLASS}::before {
    content: "\\f078";
    opacity: 0.8;
  }
  a.${SECTION_TAB_COLLAPSED_CLASS} .page-mode-link,
  a.${SECTION_TAB_COLLAPSED_CLASS} .fake-bold {
    color: hsl(var(--hsl-l2)) !important;
    opacity: 0.78;
  }
  a.${SECTION_TAB_COLLAPSED_CLASS}:not(:has(.page-mode-link)):not(:has(.fake-bold)) {
    color: hsl(var(--hsl-l2)) !important;
    opacity: 0.78;
  }
  .page-mode.page-mode--profile-page-extra {
    gap: 0 !important;
    column-gap: 0 !important;
    row-gap: 0 !important;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"] {
    margin-right: 0.85em !important;
    padding: 0.22em 0.5em;
    border-radius: 5px;
    box-sizing: border-box;
    transition: background-color 120ms ease;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:hover {
    background-color: rgba(255, 255, 255, 0.07);
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:last-child {
    margin-right: 0 !important;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]::before {
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    display: inline-block;
    font-style: normal;
    font-variant: normal;
    text-rendering: auto;
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    content: "\\f077";
    font-size: 0.82em;
    line-height: 1;
    color: hsl(var(--hsl-c1));
    opacity: 0.9;
    margin-right: 0.25em;
    flex-shrink: 0;
    transition: color 120ms ease, opacity 120ms ease;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]:hover::before {
    opacity: 1;
    color: hsl(var(--hsl-l1));
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]::before {
    content: "\\f078";
    opacity: 0.8;
  }
  .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]:hover::before {
    opacity: 1;
    color: hsl(var(--hsl-l1));
  }
`;
  var sectionCollapseStyle = manageStyle(
    SECTION_COLLAPSE_STYLE_ID,
    SECTION_COLLAPSE_CSS
  );
  function clearProfileSectionCollapseBodyHidden(page) {
    page.querySelectorAll(`.${SECTION_COLLAPSE_BODY_HIDDEN_CLASS}`).forEach((el2) => el2.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS));
    page.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
  }
  function profileSectionCollapseKeepsChildVisible(el2) {
    if (!(el2 instanceof HTMLElement)) return false;
    if (el2.matches(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR)) return true;
    if (el2.matches(SECTION_COLLAPSE_SUBTITLE_SELECTOR)) return true;
    if (el2.matches("div.u-relative") && el2.querySelector(`:scope > ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}`)) {
      return true;
    }
    return false;
  }
  function syncProfileSectionPageTitleCollapsedSuffix(pageEl, isCollapsed) {
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (!h2.classList.contains(SECTION_PAGE_TITLE_TOGGLE_CLASS)) return;
    h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`)?.setAttribute(
      "aria-expanded",
      isCollapsed ? "false" : "true"
    );
    const existing = h2.querySelector(
      `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`
    );
    if (isCollapsed) {
      if (!existing) {
        h2.appendChild(
          el(
            "span",
            { class: SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS },
            " (collapsed)"
          )
        );
      } else {
        existing.textContent = " (collapsed)";
      }
    } else {
      existing?.remove();
    }
  }
  function markProfileSectionBodyCollapsed(pageEl, depth) {
    if (depth > 4) return false;
    const kids = [...pageEl.children].filter((n) => n instanceof HTMLElement);
    if (!kids.length) return false;
    const hasKept = kids.some(profileSectionCollapseKeepsChildVisible);
    if (hasKept) {
      kids.forEach((k) => {
        if (profileSectionCollapseKeepsChildVisible(k)) {
          k.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        } else {
          k.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        }
      });
      return true;
    }
    if (kids.length === 1) {
      return markProfileSectionBodyCollapsed(kids[0], depth + 1);
    }
    return false;
  }
  function applyProfileSectionCollapseToPages(collapsed) {
    const removeEntireSection = settings().isEnabled(
      PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID
    );
    document.documentElement.classList.toggle(
      SECTION_COLLAPSE_HARD_MODE_CLASS,
      removeEntireSection
    );
    getSectionPageNodes().forEach((node) => {
      const id = node.getAttribute("data-page-id");
      if (!id) return;
      clearProfileSectionCollapseBodyHidden(node);
      node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
      if (!collapsed.has(id)) {
        syncProfileSectionPageTitleCollapsedSuffix(node, false);
        return;
      }
      node.classList.add(SECTION_COLLAPSE_PAGE_CLASS);
      if (removeEntireSection) {
        node.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      } else {
        markProfileSectionBodyCollapsed(node, 0);
      }
      syncProfileSectionPageTitleCollapsedSuffix(node, true);
    });
    applyProfileSubsectionCollapseState(
      readCollapsedSet(KEYS.PROFILE_SUBSECTIONS_COLLAPSED)
    );
  }
  function applyProfileSectionCollapseToTabAnchors(collapsed) {
    getContentsAnchorRows().flat().forEach((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const sectionId = sectionIdFromHashHref(
        anchor.getAttribute("href") || ""
      );
      if (!sectionId) return;
      const isCollapsed = collapsed.has(sectionId);
      if (isCollapsed) anchor.classList.add(SECTION_TAB_COLLAPSED_CLASS);
      else anchor.classList.remove(SECTION_TAB_COLLAPSED_CLASS);
      anchor.setAttribute(
        SECTION_TAB_CHEVRON_ATTR,
        isCollapsed ? "collapsed" : "expanded"
      );
      const parent = anchor.parentElement;
      if (parent) parent.classList.add(SECTION_CONTENTS_ROW_CLASS);
    });
  }
  function teardownProfileSectionPageTitleClick() {
    document.querySelectorAll(`h2[${SECTION_PAGE_TITLE_CLICK_ATTR}]`).forEach((h2) => {
      if (!(h2 instanceof HTMLElement)) return;
      h2.querySelectorAll(
        `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`
      ).forEach((n) => n.remove());
      const label = h2.querySelector(
        `:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`
      );
      if (label instanceof HTMLElement) {
        while (label.firstChild) h2.insertBefore(label.firstChild, label);
        label.remove();
      }
      h2.removeAttribute(SECTION_PAGE_TITLE_CLICK_ATTR);
      h2.classList.remove(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    });
  }
  function teardownProfileContentsTabChevrons() {
    document.querySelectorAll(`a[${SECTION_TAB_CHEVRON_ATTR}]`).forEach((a) => a.removeAttribute(SECTION_TAB_CHEVRON_ATTR));
    document.querySelectorAll(`.${SECTION_CONTENTS_ROW_CLASS}`).forEach((n) => n.classList.remove(SECTION_CONTENTS_ROW_CLASS));
  }
  function onContentsTabChevronClick(ev) {
    const a = (
      /** @type {Element|null} */
      ev.target
    );
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!a.hasAttribute(SECTION_TAB_CHEVRON_ATTR)) return;
    const rect = a.getBoundingClientRect();
    const style2 = window.getComputedStyle(a, "::before");
    const beforeWidth = parseFloat(style2.width) || 0;
    const paddingLeft = parseFloat(window.getComputedStyle(a).paddingLeft) || 0;
    const chevronRight = rect.left + paddingLeft + beforeWidth + 4;
    if (ev.clientX > chevronRight) return;
    ev.preventDefault();
    ev.stopPropagation();
    const sectionId = sectionIdFromHashHref(a.getAttribute("href") || "");
    if (sectionId) toggleProfileSectionCollapsedId(sectionId);
  }
  function toggleProfileSectionCollapsedId(sectionId) {
    if (!sectionId) return;
    const set = readCollapsedSet(KEYS.PROFILE_SECTIONS_COLLAPSED);
    if (set.has(sectionId)) set.delete(sectionId);
    else set.add(sectionId);
    writeCollapsedSet(KEYS.PROFILE_SECTIONS_COLLAPSED, set);
    applyProfileSectionCollapseToPages(set);
    applyProfileSectionCollapseToTabAnchors(set);
  }
  function bindProfileSectionPageTitleClickOnPage(pageEl, signal) {
    const sectionId = pageEl.getAttribute("data-page-id");
    if (!sectionId) return;
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (h2.hasAttribute(SECTION_PAGE_TITLE_CLICK_ATTR)) return;
    h2.classList.add(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    h2.setAttribute(SECTION_PAGE_TITLE_CLICK_ATTR, sectionId);
    let label = h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`);
    if (!label) {
      label = el("span", { class: SECTION_PAGE_TITLE_LABEL_CLASS });
      while (h2.firstChild) label.appendChild(h2.firstChild);
      h2.appendChild(label);
    }
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    listen(
      h2,
      "click",
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        if (t.closest("a[href]")) return;
        if (t.closest("button")) return;
        if (t.closest("input, select, textarea, label")) return;
        toggleProfileSectionCollapsedId(sectionId);
      },
      signal
    );
    listen(
      label,
      "keydown",
      (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        if (ev.target !== label) return;
        ev.preventDefault();
        toggleProfileSectionCollapsedId(sectionId);
      },
      signal
    );
  }
  function bindProfileSectionPageTitleClicks(signal) {
    getSectionPageNodes().forEach(
      (page) => bindProfileSectionPageTitleClickOnPage(page, signal)
    );
  }
  function startProfileSectionCollapseManager() {
    sectionCollapseStyle.inject();
    const ac = new AbortController();
    const unsubRemoveMode = settings().onChange(
      PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
      () => {
        const collapsed = readCollapsedSet(KEYS.PROFILE_SECTIONS_COLLAPSED);
        applyProfileSectionCollapseToPages(collapsed);
      }
    );
    const bind = () => {
      const collapsed = readCollapsedSet(KEYS.PROFILE_SECTIONS_COLLAPSED);
      applyProfileSectionCollapseToPages(collapsed);
      applyProfileSectionCollapseToTabAnchors(collapsed);
      bindProfileSectionPageTitleClicks(ac.signal);
      getSectionPageNodes().forEach((node) => {
        const id = node.getAttribute("data-page-id");
        if (!id) return;
        syncProfileSectionPageTitleCollapsedSuffix(node, collapsed.has(id));
      });
    };
    bind();
    listen(document, "click", onContentsTabChevronClick, ac.signal, true);
    observe.subscribe(
      {
        selector: `${SECTION_PAGE_SEL}, ${SECTION_TAB_LINK_SEL}, ${SECTION_TITLE_SEL}`,
        schedule: 80,
        signal: ac.signal,
        label: "profile/sections"
      },
      bind
    );
    return () => {
      unsubRemoveMode();
      ac.abort();
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();
      getSectionPageNodes().forEach((node) => {
        node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
        clearProfileSectionCollapseBodyHidden(node);
      });
      document.querySelectorAll(`a.${SECTION_TAB_COLLAPSED_CLASS}`).forEach((a) => a.classList.remove(SECTION_TAB_COLLAPSED_CLASS));
      document.documentElement.classList.remove(SECTION_COLLAPSE_HARD_MODE_CLASS);
      sectionCollapseStyle.remove();
    };
  }

  // src/features/profile/userpage-expand.js
  var USERPAGE_EXPAND_STYLE_ID = "osu-expertplus-userpage-expand";
  var USERPAGE_EXPAND_DONE_ATTR = "data-oep-userpage-expand";
  var USERPAGE_EXPAND_PAGE_CLASS = "oep-userpage--expanded";
  var USERPAGE_EXPAND_BTN_CLASS = "oep-userpage-expand-btn";
  var USERPAGE_ME_SECTION_SEL = 'div.js-sortable--page[data-page-id="me"]';
  var USERPAGE_EXPAND_HOST_SELECTOR = ".page-extra--userpage";
  var USERPAGE_OVERFLOW_OUTER_SEL = ".page-extra__content-overflow-wrapper-outer";
  var USERPAGE_OVERFLOW_INNER_SEL = ".page-extra__content-overflow-wrapper-inner";
  var userpageExpandStyle = manageStyle(
    USERPAGE_EXPAND_STYLE_ID,
    `
  .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
    .page-extra__content-overflow-wrapper-outer,
  .page-extra--userpage.${USERPAGE_EXPAND_PAGE_CLASS}
    .page-extra__content-overflow-wrapper-inner {
    max-height: none !important;
    overflow-y: visible !important;
  }
  .${USERPAGE_EXPAND_BTN_CLASS} {
    display: block;
    box-sizing: border-box;
    margin: 0;
    padding: 6px 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0 0 10px 10px;
    background: rgba(255, 255, 255, 0.05);
    color: hsl(var(--hsl-l1));
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    cursor: pointer;
    text-align: center;
    transition: background-color 120ms ease;
  }
  .${USERPAGE_EXPAND_BTN_CLASS}:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .${USERPAGE_EXPAND_BTN_CLASS}:focus-visible {
    outline: 2px solid hsl(var(--hsl-b1));
    outline-offset: -2px;
  }
`
  );
  function findUserpageOverflowOuter(pageExtra) {
    for (const child of pageExtra.children) {
      if (child instanceof HTMLElement && child.classList.contains("page-extra__content-overflow-wrapper-outer")) {
        return child;
      }
    }
    const outer = pageExtra.querySelector(USERPAGE_OVERFLOW_OUTER_SEL);
    return outer instanceof HTMLElement ? outer : null;
  }
  function userpageContentOverflows(outer, inner) {
    const outerClips = outer.scrollHeight > outer.clientHeight + 2;
    const innerClips = inner.scrollHeight > inner.clientHeight + 2;
    const innerTallerThanOuter = inner.getBoundingClientRect().height > outer.getBoundingClientRect().height + 2;
    return outerClips || innerClips || innerTallerThanOuter;
  }
  function findMeUserpageContext() {
    const section = document.querySelector(USERPAGE_ME_SECTION_SEL);
    if (!(section instanceof HTMLElement)) return null;
    const pageExtra = section.querySelector(USERPAGE_EXPAND_HOST_SELECTOR);
    if (!(pageExtra instanceof HTMLElement)) return null;
    if (!section.contains(pageExtra)) return null;
    return { section, pageExtra };
  }
  function bindUserpageExpand(pageExtra) {
    const outer = findUserpageOverflowOuter(pageExtra);
    if (!(outer instanceof HTMLElement)) return null;
    const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
    if (!(inner instanceof HTMLElement)) return null;
    if (!userpageContentOverflows(outer, inner)) return null;
    pageExtra.setAttribute(USERPAGE_EXPAND_DONE_ATTR, "1");
    const cs = getComputedStyle(pageExtra);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const btn = el("button", {
      type: "button",
      class: USERPAGE_EXPAND_BTN_CLASS,
      "aria-expanded": "false"
    });
    btn.style.width = `calc(100% + ${pl + pr}px)`;
    btn.style.marginLeft = `-${pl}px`;
    const syncBtn = () => {
      const expanded = pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS);
      btn.textContent = expanded ? "Collapse userpage" : "Expand userpage";
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    };
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pageExtra.classList.toggle(USERPAGE_EXPAND_PAGE_CLASS);
      syncBtn();
    });
    pageExtra.appendChild(btn);
    syncBtn();
    return () => {
      btn.remove();
      pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
      pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
    };
  }
  function teardownUserpageExpand() {
    document.querySelectorAll(`.${USERPAGE_EXPAND_BTN_CLASS}`).forEach((n) => n.remove());
    document.querySelectorAll(USERPAGE_EXPAND_HOST_SELECTOR).forEach((host) => {
      if (!(host instanceof HTMLElement)) return;
      host.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
      host.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
    });
  }
  function addedMeUserpage(added) {
    return added.some(
      (n) => n.matches(USERPAGE_ME_SECTION_SEL) || n.querySelector(USERPAGE_ME_SECTION_SEL) !== null
    );
  }
  function startUserpageExpandManager() {
    userpageExpandStyle.inject();
    let disposeMe = (
      /** @type {null | (() => void)} */
      null
    );
    let resizeObs = null;
    let observedInner = null;
    const observeUserpageContent = (outer) => {
      if (typeof ResizeObserver === "undefined") return;
      const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
      if (!(inner instanceof HTMLElement) || inner === observedInner) return;
      resizeObs?.disconnect();
      observedInner = inner;
      resizeObs = new ResizeObserver(() => scan());
      resizeObs.observe(inner);
      for (const child of inner.children) resizeObs.observe(child);
    };
    const scan = () => {
      try {
        const ctx = findMeUserpageContext();
        if (!ctx) {
          disposeMe?.();
          disposeMe = null;
          return;
        }
        const { pageExtra } = ctx;
        const outer = findUserpageOverflowOuter(pageExtra);
        const btn = pageExtra.querySelector(`.${USERPAGE_EXPAND_BTN_CLASS}`);
        if (!outer) {
          disposeMe?.();
          disposeMe = null;
          btn?.remove();
          pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
          pageExtra.classList.remove(USERPAGE_EXPAND_PAGE_CLASS);
          return;
        }
        observeUserpageContent(outer);
        if (pageExtra.hasAttribute(USERPAGE_EXPAND_DONE_ATTR) && btn) {
          const inner = outer.querySelector(USERPAGE_OVERFLOW_INNER_SEL);
          const stillNeeded = pageExtra.classList.contains(USERPAGE_EXPAND_PAGE_CLASS) || !(inner instanceof HTMLElement) || userpageContentOverflows(outer, inner);
          if (stillNeeded) return;
          disposeMe?.();
          disposeMe = null;
          btn.remove();
          pageExtra.removeAttribute(USERPAGE_EXPAND_DONE_ATTR);
        }
        disposeMe?.();
        disposeMe = bindUserpageExpand(pageExtra);
      } catch (_) {
        disposeMe?.();
        disposeMe = null;
      }
    };
    const ac = new AbortController();
    scan();
    observe.subscribe(
      { schedule: "sync", signal: ac.signal, label: "profile/userpage-expand" },
      ({ records, added }) => {
        const section = findMeUserpageContext()?.section;
        if (section && records.some((r) => section.contains(r.target)) || addedMeUserpage(added)) {
          scan();
        }
      }
    );
    return () => {
      ac.abort();
      resizeObs?.disconnect();
      resizeObs = null;
      observedInner = null;
      disposeMe?.();
      disposeMe = null;
      teardownUserpageExpand();
      userpageExpandStyle.remove();
    };
  }

  // src/pages/user-profile.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.pages = OsuExpertPlus.pages || {};
  function init3(_match) {
    const { manageStyle: manageStyle2, createCleanupBag } = OsuExpertPlus.dom;
    const settings2 = OsuExpertPlus.settings;
    const bag = createCleanupBag();
    playDetailStyle.inject();
    bag.add(() => {
      playDetailStyle.remove();
      scorePlaceNumberStyle.remove();
    });
    bag.add(teardownSrObserver);
    let disposed = false;
    const scoreRun = { isDisposed: () => disposed, cleanupFns: [] };
    bag.add(
      () => scoreRun.cleanupFns.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (_) {
        }
      })
    );
    safeStart(
      bag,
      () => startCardFeatures(settings2, manageStyle2, { hookProfileExtraPages: true }),
      "card features"
    );
    safeStart(bag, startRanksDateHighlightManager, "ranks period");
    mountSettingFeature(bag, settings2, settings2.IDS.BWS_RANKING, mountBwsRanking);
    safeStart(bag, startProfileBadgesCollapseManager, "badges collapse");
    safeStart(bag, startProfileSectionCollapseManager, "section collapse");
    safeStart(bag, startProfileSubsectionCollapseManager, "subsection collapse");
    mountSettingFeature(
      bag,
      settings2,
      settings2.IDS.BBCODE_HELPER,
      startBbcodeHelperManager
    );
    mountSettingFeature(
      bag,
      settings2,
      settings2.IDS.PROFILE_MEDIA_OPEN_BUTTONS,
      startProfileMediaOpenPictureManager
    );
    mountSettingFeature(
      bag,
      settings2,
      settings2.IDS.USERPAGE_EXPAND,
      startUserpageExpandManager
    );
    resolveProfileTarget().then((target) => {
      if (disposed || !target) return;
      const { userId, mode, isOwnProfile } = target;
      if (isOwnProfile) {
        safeStart(bag, startContentsReorderManager, "contents reorder");
      }
      mountSettingFeature(
        bag,
        settings2,
        settings2.IDS.RECENT_SCORES_WITH_FAILS,
        () => startRecentScoresWithFailsObserver(userId, mode)
      );
      return initScoreFeatures(userId, mode, scoreRun);
    }).catch(() => {
    });
    return () => {
      disposed = true;
      bag.dispose();
    };
  }
  OsuExpertPlus.pages.userProfile = { name: "UserProfile", init: init3 };

  // src/pages/account-edit.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.pages = OsuExpertPlus.pages || {};
  OsuExpertPlus.pages.accountEdit = (() => {
    const name = "AccountEdit";
    const { el: el2, waitForElement: waitForElement2, manageStyle: manageStyle2 } = OsuExpertPlus.dom;
    const auth = OsuExpertPlus.auth;
    const GUIDE_ID = "oep-oauth-guide";
    const CREDENTIALS_CHANGED_EVENT2 = "oep-osu-api-credentials-changed";
    const DONE_HIDE_DELAY_MS = 3e3;
    const CSS2 = `
    #${GUIDE_ID} {
      border-radius: 8px;
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    #${GUIDE_ID}.oep-guide--done {
      display: none;
    }
    .oep-guide__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .oep-guide__icon {
      font-size: 16px;
      color: hsl(var(--hsl-pink, 333 100% 65%));
      flex-shrink: 0;
    }
    .oep-guide__title {
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      flex: 1;
    }
    .oep-guide__dismiss {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.4;
      padding: 0 2px;
      line-height: 1;
      transition: opacity 150ms;
    }
    .oep-guide__dismiss:hover { opacity: 1; }

    .oep-guide__body {
      font-size: 12px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-bottom: 10px;
    }
    .oep-guide__body b { font-weight: 600; opacity: 1; }

    .oep-guide__footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-top: 10px;
      border-top: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    }
    .oep-guide__status {
      flex: 1;
      font-size: 12px;
      opacity: 0.55;
    }
    .oep-guide__status--ok {
      color: #84e03a;
      opacity: 1;
    }
    .oep-guide__open-panel-btn {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .oep-guide__open-panel-btn:hover { opacity: 0.85; }
  `;
    const guideStyle = manageStyle2("oep-account-edit-style", CSS2);
    function buildGuide(signal) {
      const body = el2(
        "div",
        { class: "oep-guide__body" },
        "Register a new application below, copy its ",
        el2("b", {}, "Client ID"),
        " and ",
        el2("b", {}, "Client Secret"),
        ", then paste them into the ",
        el2("b", {}, "⚙ Expert+ panel"),
        " (bottom-right corner)."
      );
      const statusEl = el2(
        "div",
        { class: "oep-guide__status" },
        "No credentials saved yet."
      );
      const openBtn = el2(
        "button",
        { type: "button", class: "oep-guide__open-panel-btn" },
        "⚙ Open Expert+ Settings"
      );
      openBtn.addEventListener("click", () => {
        document.getElementById("osu-expertplus-fab")?.click();
      });
      const dismissBtn = el2(
        "button",
        { type: "button", class: "oep-guide__dismiss", title: "Dismiss" },
        "✕"
      );
      dismissBtn.addEventListener("click", () => {
        guide.classList.add("oep-guide--done");
      });
      const footer = el2("div", { class: "oep-guide__footer" }, statusEl, openBtn);
      const guide = el2(
        "div",
        { id: GUIDE_ID },
        el2(
          "div",
          { class: "oep-guide__header" },
          el2("i", { class: "oep-guide__icon fas fa-key" }),
          el2(
            "div",
            { class: "oep-guide__title" },
            "Set up osu! Expert+ API access"
          ),
          dismissBtn
        ),
        body,
        footer
      );
      let hideTimer = 0;
      function syncState() {
        if (auth.isConfigured()) {
          statusEl.textContent = "✓ Credentials saved — API v2 active!";
          statusEl.className = "oep-guide__status oep-guide__status--ok";
          openBtn.style.display = "none";
          if (!hideTimer) {
            hideTimer = window.setTimeout(
              () => guide.classList.add("oep-guide--done"),
              DONE_HIDE_DELAY_MS
            );
          }
        } else {
          window.clearTimeout(hideTimer);
          hideTimer = 0;
          statusEl.textContent = "No credentials saved yet.";
          statusEl.className = "oep-guide__status";
          openBtn.style.display = "";
          guide.classList.remove("oep-guide--done");
        }
      }
      const onVisible = () => {
        if (document.visibilityState === "visible") syncState();
      };
      window.addEventListener(CREDENTIALS_CHANGED_EVENT2, syncState);
      document.addEventListener("visibilitychange", onVisible);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(hideTimer);
          window.removeEventListener(CREDENTIALS_CHANGED_EVENT2, syncState);
          document.removeEventListener("visibilitychange", onVisible);
        },
        { once: true }
      );
      syncState();
      return guide;
    }
    function findOAuthInputGroups() {
      const titles = document.querySelectorAll(".account-edit__section-title");
      for (const title of titles) {
        if (/oauth/i.test(title.textContent)) {
          return title.closest(".account-edit")?.querySelector(".account-edit__input-groups") ?? null;
        }
      }
      for (const anchor of ["oauth", "oauth2"]) {
        const el3 = document.getElementById(anchor) ?? document.querySelector(`[name="${anchor}"]`);
        if (el3) {
          return el3.closest(".account-edit")?.querySelector(".account-edit__input-groups") ?? el3.closest("section") ?? null;
        }
      }
      return null;
    }
    async function init4(_match, ctx = {}) {
      const ac = new AbortController();
      const cleanup = () => {
        ac.abort();
        document.getElementById(GUIDE_ID)?.remove();
        guideStyle.remove();
      };
      if (auth.isConfigured()) return cleanup;
      guideStyle.inject();
      let inputGroups;
      try {
        await waitForElement2(".account-edit__section-title", {
          timeout: 1e4,
          signal: ctx.signal
        });
        inputGroups = findOAuthInputGroups();
      } catch {
        return cleanup;
      }
      if (!inputGroups || ctx.signal?.aborted) return cleanup;
      inputGroups.prepend(buildGuide(ac.signal));
      return cleanup;
    }
    return { name, init: init4 };
  })();

  // src/ui/settings-panel.js
  window.OsuExpertPlus = window.OsuExpertPlus || {};
  OsuExpertPlus.settingsPanel = (() => {
    const { el: el2 } = OsuExpertPlus.dom;
    const settings2 = OsuExpertPlus.settings;
    const auth = OsuExpertPlus.auth;
    const omdb2 = OsuExpertPlus.omdb;
    const ROOT_ID = "osu-expertplus-settings";
    const FAB_ANCHOR_ID = "osu-expertplus-fab-anchor";
    const OPEN_CLASS = "osu-expertplus-settings--open";
    const SECTION_COLLAPSED_CLASS = "osu-expertplus-panel__section--collapsed";
    const FAB_NEEDS_API_CLASS = "osu-expertplus-fab-anchor--needs-api";
    const MODDED_SR_ROW_ATTR = "data-oep-settings-row-modded-sr";
    const fabUi = { anchor: null, panel: null };
    function applyModdedStarRowLockState(row) {
      const locked = !auth.isConfigured();
      row.classList.toggle("osu-expertplus-panel__row--oauth-required", locked);
      if (locked) {
        row.title = "Requires osu! API OAuth credentials. Add Client ID and Secret in the section above.";
      } else {
        row.removeAttribute("title");
      }
      const input = row.querySelector(".osu-expertplus-toggle input");
      if (input instanceof HTMLInputElement) {
        input.tabIndex = locked ? -1 : 0;
      }
      row.classList.toggle(
        "osu-expertplus-panel__row--with-feature-hint",
        locked
      );
      const hint = row.querySelector("[data-oep-modded-sr-hint]");
      if (hint) {
        if (locked) {
          hint.hidden = false;
          hint.textContent = "Requires osu! API OAuth credentials — add Client ID and Secret in the section above.";
        } else {
          hint.hidden = true;
          hint.textContent = "";
        }
      }
    }
    function refreshModdedStarRatingRowLock() {
      const row = fabUi.panel?.querySelector?.(`[${MODDED_SR_ROW_ATTR}]`);
      if (row instanceof HTMLElement) applyModdedStarRowLockState(row);
    }
    function syncPanelAboveFab() {
      const { anchor, panel } = fabUi;
      if (!anchor?.isConnected || !panel?.isConnected) return;
      const top = anchor.getBoundingClientRect().top;
      const gap = 10;
      panel.style.bottom = `${Math.round(window.innerHeight - top + gap)}px`;
    }
    function refreshFabOsuApiWarning() {
      const { anchor } = fabUi;
      if (!anchor) return;
      anchor.classList.toggle(FAB_NEEDS_API_CLASS, auth.getStatus() !== "ok");
      syncPanelAboveFab();
    }
    function credentialSectionTitle(kind, filled) {
      if (kind === "osu") {
        return filled ? "osu! API credentials — saved" : "osu! API credentials — not set";
      }
      return filled ? "OMDB API key — saved" : "OMDB API key — not set";
    }
    const CSS2 = `
    #${FAB_ANCHOR_ID} {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      max-width: min(320px, calc(100vw - 48px));
    }

    .osu-expertplus-fab-api-warning {
      display: none;
      align-items: center;
      gap: 7px;
      padding: 5px 11px 5px 9px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      line-height: 1.35;
      color: hsl(48 92% 62%);
      background: linear-gradient(
        165deg,
        hsl(38 32% 18%) 0%,
        hsl(32 28% 14%) 100%
      );
      border: 1px solid hsl(40 42% 32%);
      box-shadow:
        0 2px 10px rgba(0,0,0,.4),
        0 0 0 1px rgba(0,0,0,.2) inset;
    }
    .${FAB_NEEDS_API_CLASS} .osu-expertplus-fab-api-warning {
      display: flex;
    }
    .osu-expertplus-fab-api-warning__icon {
      flex-shrink: 0;
      font-size: 11px;
      opacity: 0.95;
      filter: drop-shadow(0 0 6px hsl(48 90% 45% / 0.45));
    }
    .osu-expertplus-fab-api-warning__text {
      min-width: 0;
    }

    #osu-expertplus-fab {
      position: relative;
      flex-shrink: 0;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 16px 0 12px;
      border-radius: 22px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.02em;
      background: hsl(var(--hsl-b4, 333 18% 20%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
      box-shadow:
        0 2px 10px rgba(0,0,0,.45),
        0 0 0 1px rgba(0,0,0,.12) inset;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease;
      opacity: 0.88;
      -webkit-tap-highlight-color: transparent;
    }
    #osu-expertplus-fab:hover {
      background: hsl(var(--hsl-b5, 333 18% 28%));
      border-color: hsl(var(--hsl-b5, 333 18% 36%));
      opacity: 1;
      box-shadow:
        0 4px 18px rgba(0,0,0,.5),
        0 0 0 1px rgba(255,255,255,.04) inset;
    }
    #osu-expertplus-fab:focus-visible {
      outline: 2px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 3px;
    }
    #osu-expertplus-fab:active {
      transform: translateY(1px);
      box-shadow: 0 1px 8px rgba(0,0,0,.4);
    }
    .osu-expertplus-fab__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      font-size: 16px;
      color: hsl(var(--hsl-c2, 333 60% 72%));
      transition: transform 180ms ease, color 160ms ease;
    }
    #osu-expertplus-fab:hover .osu-expertplus-fab__icon {
      color: hsl(var(--hsl-l1, 0 0% 96%));
      transform: rotate(35deg);
    }
    .osu-expertplus-fab__label {
      display: flex;
      align-items: baseline;
      white-space: nowrap;
    }
    .osu-expertplus-fab__brand-accent {
      font-weight: 800;
      letter-spacing: 0.04em;
      color: hsl(var(--hsl-pink, 333 100% 72%));
      text-shadow: 0 0 20px hsl(var(--hsl-pink, 333 100% 65%) / 0.35);
    }

    #osu-expertplus-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0,0,0,.5);
    }
    #osu-expertplus-backdrop.${OPEN_CLASS} { display: block; }

    #${ROOT_ID} {
      display: none;
      position: fixed;
      bottom: 80px;
      left: 24px;
      z-index: 9999;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
      font-family: inherit;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    #${ROOT_ID}.${OPEN_CLASS} {
      display: block;
      animation: osu-expertplus-slide-in 150ms ease-out;
    }
    @keyframes osu-expertplus-slide-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .osu-expertplus-panel__header {
      padding: 14px 16px 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
    }

    .osu-expertplus-panel__section {
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
      background: hsl(var(--hsl-b2, 333 18% 12%));
    }
    .osu-expertplus-panel__section:last-of-type { border-bottom: none; }

    .osu-expertplus-panel__footer {
      padding: 10px 16px 12px;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      font-size: 11px;
      line-height: 1.45;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .osu-expertplus-panel__footer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
    }
    .osu-expertplus-panel__footer-reset {
      margin: 0;
      padding: 3px 9px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      border-radius: 5px;
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l2, 0 0% 72%));
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.3;
      cursor: pointer;
      transition:
        background 140ms ease,
        border-color 140ms ease,
        color 140ms ease;
    }
    .osu-expertplus-panel__footer-reset:hover {
      background: hsl(var(--hsl-b5, 333 18% 24%));
      border-color: hsl(var(--hsl-b5, 333 18% 38%));
      color: hsl(var(--hsl-l1, 0 0% 88%));
    }
    .osu-expertplus-panel__footer-reset:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 2px;
    }
    .osu-expertplus-panel__footer a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
    .osu-expertplus-panel__footer a:hover {
      color: hsl(var(--hsl-c2, 333 60% 82%));
    }
    .osu-expertplus-panel__footer-sep {
      margin: 0 0.45em;
      opacity: 0.45;
      user-select: none;
    }

    .osu-expertplus-panel__group-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 34px;
      padding: 8px 16px;
      border: none;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      cursor: pointer;
      color: inherit;
    }
    .osu-expertplus-panel__group-toggle:hover {
      background: hsl(var(--hsl-b4, 333 18% 20%));
    }
    .osu-expertplus-panel__group-toggle:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: -1px;
    }

    /* Credential section headers — osu! API */
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(145 22% 17%);
      border-top-color: hsl(145 28% 26%);
    }
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(145 22% 21%);
    }
    .oep-cred--osu.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(132 48% 58%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(38 26% 16%);
      border-top-color: hsl(36 32% 24%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(38 26% 20%);
    }
    .oep-cred--osu.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(46 88% 60%);
    }

    /* Credential section headers — OMDB */
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(210 28% 18%);
      border-top-color: hsl(210 32% 28%);
    }
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(210 28% 22%);
    }
    .oep-cred--omdb.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(205 58% 70%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(280 18% 17%);
      border-top-color: hsl(275 22% 26%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(280 18% 21%);
    }
    .oep-cred--omdb.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(38 82% 62%);
    }

    .osu-expertplus-panel__group-label {
      padding: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .11em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.95;
    }
    .osu-expertplus-panel__group-chevron {
      font-size: 11px;
      opacity: 0.9;
      transform: rotate(0deg);
      transition: transform 120ms ease;
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__group-chevron {
      transform: rotate(-90deg);
    }
    .osu-expertplus-panel__section-content { display: block; }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:first-child {
      border-top: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__section-content {
      display: none;
    }

    .osu-expertplus-panel__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:last-child { border-bottom: none; }

    .osu-expertplus-panel__row--oauth-required {
      opacity: 0.55;
      filter: saturate(0.7);
      pointer-events: none;
      user-select: none;
      cursor: not-allowed;
    }

    .osu-expertplus-panel__text {
      flex: 1;
      min-width: 0;
    }
    .osu-expertplus-panel__text[title] {
      cursor: help;
    }
    .osu-expertplus-panel__label {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
    }
    .osu-expertplus-panel__feature-hint {
      font-size: 10px;
      font-weight: 500;
      line-height: 1.35;
      margin-top: 4px;
      color: hsl(var(--hsl-c2, 333 60% 68%));
      opacity: 0.9;
    }
    .osu-expertplus-panel__row--with-feature-hint {
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .osu-expertplus-panel__row--with-feature-hint .osu-expertplus-toggle {
      margin-top: 2px;
    }

    .osu-expertplus-toggle {
      position: relative;
      flex-shrink: 0;
      width: 32px;
      height: 18px;
    }
    .osu-expertplus-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .osu-expertplus-toggle__track {
      position: absolute;
      inset: 0;
      border-radius: 100px;
      background: hsl(var(--hsl-b5, 333 18% 26%));
      cursor: pointer;
      transition: background 150ms;
    }
    .osu-expertplus-toggle__track::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: hsl(var(--hsl-l1, 0 0% 90%));
      transition: transform 150ms;
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track {
      background: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track::after {
      transform: translateX(14px);
    }

    .osu-expertplus-panel__creds {
      padding: 8px 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .osu-expertplus-panel__creds-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .osu-expertplus-panel__creds-field label {
      font-size: 11px;
      opacity: 0.6;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .osu-expertplus-panel__creds-field input {
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      border-radius: 6px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-family: monospace;
      font-size: 12px;
      padding: 5px 8px;
      outline: none;
      transition: border-color 150ms;
    }
    .osu-expertplus-panel__creds-field input:focus {
      border-color: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-panel__creds-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .osu-expertplus-panel__creds-btn {
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      transition: opacity 150ms;
    }
    .osu-expertplus-panel__creds-btn:hover { opacity: 0.8; }
    .osu-expertplus-panel__creds-btn--save {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
    }
    .osu-expertplus-panel__creds-btn--clear {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .osu-expertplus-panel__creds-status {
      font-size: 11px;
      margin-top: 2px;
      min-height: 1.4em;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-status--ok    { color: #84e03a; }
    .osu-expertplus-panel__creds-status--error  { color: #e05c5c; }
    .osu-expertplus-panel__creds-status--info   { opacity: 0.5; }
    .osu-expertplus-panel__creds-hint {
      font-size: 11px;
      opacity: 0.45;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-hint a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
  `;
    function buildToggle(feature) {
      const input = el2("input", { type: "checkbox" });
      input.checked = settings2.isEnabled(feature.id);
      const track = el2("div", { class: "osu-expertplus-toggle__track" });
      const label = el2("label", { class: "osu-expertplus-toggle" }, input, track);
      input.addEventListener("change", () => {
        if (feature.id === settings2.IDS.MODDED_STAR_RATING && !auth.isConfigured()) {
          input.checked = settings2.isEnabled(feature.id);
          return;
        }
        settings2.set(feature.id, input.checked);
      });
      settings2.onChange(feature.id, (val) => {
        input.checked = val;
      });
      return label;
    }
    function buildCredentialsSection(onConfiguredChange) {
      const clientIdInput = el2("input", {
        type: "text",
        placeholder: "Client ID",
        autocomplete: "off",
        spellcheck: "false"
      });
      const clientSecretInput = el2("input", {
        type: "password",
        placeholder: "Client Secret",
        autocomplete: "new-password"
      });
      clientIdInput.value = auth.getClientId();
      if (auth.hasSecret()) {
        clientSecretInput.placeholder = "(saved — enter to change)";
      }
      const statusEl = el2("div", {
        class: "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info"
      });
      function setStatus2(msg, type = "info") {
        statusEl.textContent = msg;
        statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
      }
      if (auth.getStatus() === "error") {
        setStatus2(
          "Saved credentials could not get a token. Check them and save again.",
          "error"
        );
      } else if (auth.isConfigured()) {
        setStatus2("Credentials saved. API v2 active.", "ok");
      } else {
        setStatus2("No credentials — using session fallback.");
      }
      const saveBtn = el2(
        "button",
        {
          class: "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save"
        },
        "Save"
      );
      const clearBtn = el2(
        "button",
        {
          class: "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear"
        },
        "Clear"
      );
      saveBtn.addEventListener("click", async () => {
        const id = clientIdInput.value.trim();
        const secret = clientSecretInput.value.trim();
        if (!id || !secret && !auth.hasSecret()) {
          setStatus2("Both Client ID and Secret are required.", "error");
          return;
        }
        setStatus2("Verifying…", "info");
        try {
          await auth.verifyAndSaveCredentials(id, secret);
          clientIdInput.value = id;
          clientSecretInput.value = "";
          clientSecretInput.placeholder = "(saved — enter to change)";
          setStatus2("Credentials saved & verified. API v2 active.", "ok");
          location.reload();
        } catch (e) {
          setStatus2(
            `Not saved: ${e.message.replace("[osu! Expert+] ", "")}`,
            "error"
          );
        } finally {
          refreshFabOsuApiWarning();
          syncOAuthHintVisibility();
          refreshModdedStarRatingRowLock();
          onConfiguredChange?.();
          window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
        }
      });
      clearBtn.addEventListener("click", () => {
        auth.clearCredentials();
        clientIdInput.value = "";
        clientSecretInput.value = "";
        clientSecretInput.placeholder = "Client Secret";
        setStatus2("Credentials cleared. Using session fallback.");
        refreshFabOsuApiWarning();
        syncOAuthHintVisibility();
        refreshModdedStarRatingRowLock();
        onConfiguredChange?.();
        window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
      });
      const hint = el2("div", { class: "osu-expertplus-panel__creds-hint" });
      hint.innerHTML = 'Create an OAuth app at <a href="https://osu.ppy.sh/home/account/edit#oauth" target="_blank">Account Settings → OAuth</a>, then paste your Client ID and Secret above.';
      function syncOAuthHintVisibility() {
        hint.hidden = auth.isConfigured();
      }
      syncOAuthHintVisibility();
      return el2(
        "div",
        { class: "osu-expertplus-panel__creds" },
        el2(
          "div",
          { class: "osu-expertplus-panel__creds-field" },
          el2("label", {}, "Client ID"),
          clientIdInput
        ),
        el2(
          "div",
          { class: "osu-expertplus-panel__creds-field" },
          el2("label", {}, "Client Secret"),
          clientSecretInput
        ),
        el2(
          "div",
          { class: "osu-expertplus-panel__creds-actions" },
          saveBtn,
          clearBtn
        ),
        statusEl,
        hint
      );
    }
    function buildOmdbCredentialsSection(onConfiguredChange) {
      const apiKeyInput = el2("input", {
        type: "password",
        placeholder: "API Key",
        autocomplete: "new-password",
        spellcheck: "false"
      });
      if (omdb2.isConfigured()) {
        apiKeyInput.placeholder = "(saved — enter to change)";
      }
      const statusEl = el2("div", {
        class: "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info"
      });
      function setStatus2(msg, type = "info") {
        statusEl.textContent = msg;
        statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
      }
      if (omdb2.isConfigured()) {
        setStatus2("API key saved.", "ok");
      } else {
        setStatus2("No API key configured.");
      }
      const saveBtn = el2(
        "button",
        {
          class: "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save"
        },
        "Save"
      );
      const clearBtn = el2(
        "button",
        {
          class: "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear"
        },
        "Clear"
      );
      saveBtn.addEventListener("click", () => {
        const key = apiKeyInput.value.trim() || omdb2.getApiKey();
        if (!key) {
          setStatus2("API key is required.", "error");
          return;
        }
        omdb2.setApiKey(key);
        apiKeyInput.value = "";
        apiKeyInput.placeholder = "(saved — enter to change)";
        setStatus2("API key saved.", "ok");
        syncOmdbHintVisibility();
        onConfiguredChange?.();
      });
      clearBtn.addEventListener("click", () => {
        omdb2.clearApiKey();
        apiKeyInput.value = "";
        apiKeyInput.placeholder = "API Key";
        setStatus2("API key cleared.");
        syncOmdbHintVisibility();
        onConfiguredChange?.();
      });
      const hint = el2("div", { class: "osu-expertplus-panel__creds-hint" });
      hint.innerHTML = 'Sign in at <a href="https://omdb.nyahh.net/settings/" target="_blank" rel="noopener noreferrer">omdb.nyahh.net/settings</a>. Create a new application (the name may be anything). When OMDB shows your API key, copy it and paste it into the field above.';
      function syncOmdbHintVisibility() {
        hint.hidden = omdb2.isConfigured();
      }
      syncOmdbHintVisibility();
      return el2(
        "div",
        { class: "osu-expertplus-panel__creds" },
        el2(
          "div",
          { class: "osu-expertplus-panel__creds-field" },
          el2("label", {}, "API Key"),
          apiKeyInput
        ),
        el2(
          "div",
          { class: "osu-expertplus-panel__creds-actions" },
          saveBtn,
          clearBtn
        ),
        statusEl,
        hint
      );
    }
    function buildSection(title, contentNodes, { collapsedByDefault = false, credential = null } = {}) {
      const section = el2("section", { class: "osu-expertplus-panel__section" });
      if (collapsedByDefault) section.classList.add(SECTION_COLLAPSED_CLASS);
      const titleId = credential?.stableTitleId ?? `oep-settings-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const initialTitle = credential ? credentialSectionTitle(credential.kind, credential.filled) : title;
      const label = el2(
        "span",
        { class: "osu-expertplus-panel__group-label", id: titleId },
        initialTitle
      );
      function applyCredentialState(filled) {
        if (!credential) return;
        section.classList.remove("oep-cred--ok", "oep-cred--missing");
        section.classList.add(filled ? "oep-cred--ok" : "oep-cred--missing");
        label.textContent = credentialSectionTitle(credential.kind, filled);
      }
      if (credential) {
        section.classList.add(
          credential.kind === "osu" ? "oep-cred--osu" : "oep-cred--omdb"
        );
        applyCredentialState(credential.filled);
        if (credential.syncHolder) {
          credential.syncHolder.sync = applyCredentialState;
        }
      }
      const content = el2(
        "div",
        { class: "osu-expertplus-panel__section-content" },
        ...contentNodes
      );
      const chevron = el2(
        "span",
        { class: "osu-expertplus-panel__group-chevron", "aria-hidden": "true" },
        "▼"
      );
      const toggleBtn = el2(
        "button",
        {
          type: "button",
          class: "osu-expertplus-panel__group-toggle",
          "aria-expanded": collapsedByDefault ? "false" : "true",
          "aria-labelledby": titleId
        },
        label,
        chevron
      );
      toggleBtn.addEventListener("click", () => {
        const collapsed = section.classList.toggle(SECTION_COLLAPSED_CLASS);
        toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
      section.appendChild(toggleBtn);
      section.appendChild(content);
      return section;
    }
    function buildPanel() {
      const features = settings2.getFeatures();
      const groups = /* @__PURE__ */ new Map();
      for (const f of features) {
        if (!groups.has(f.group)) groups.set(f.group, []);
        groups.get(f.group).push(f);
      }
      const header = el2(
        "div",
        { class: "osu-expertplus-panel__header" },
        "osu! Expert+ Settings"
      );
      const rows = [];
      const hasSavedCreds = auth.isConfigured();
      const hasSavedOmdb = omdb2.isConfigured();
      const osuSyncHolder = { sync: null };
      const omdbSyncHolder = { sync: null };
      rows.push(
        buildSection(
          "",
          [
            buildCredentialsSection(
              () => osuSyncHolder.sync?.(auth.isConfigured())
            )
          ],
          {
            collapsedByDefault: hasSavedCreds,
            credential: {
              kind: "osu",
              filled: hasSavedCreds,
              stableTitleId: "oep-settings-section-osu-api",
              syncHolder: osuSyncHolder
            }
          }
        )
      );
      rows.push(
        buildSection(
          "",
          [
            buildOmdbCredentialsSection(
              () => omdbSyncHolder.sync?.(omdb2.isConfigured())
            )
          ],
          {
            collapsedByDefault: hasSavedOmdb,
            credential: {
              kind: "omdb",
              filled: hasSavedOmdb,
              stableTitleId: "oep-settings-section-omdb-api",
              syncHolder: omdbSyncHolder
            }
          }
        )
      );
      for (const [groupName, groupFeatures] of groups) {
        const groupRows = [];
        for (const feature of groupFeatures) {
          const text = el2(
            "div",
            {
              class: "osu-expertplus-panel__text",
              title: feature.description || null
            },
            el2("div", { class: "osu-expertplus-panel__label" }, feature.label)
          );
          const row = el2(
            "div",
            { class: "osu-expertplus-panel__row" },
            text,
            buildToggle(feature)
          );
          if (feature.id === settings2.IDS.MODDED_STAR_RATING) {
            row.setAttribute(MODDED_SR_ROW_ATTR, "1");
            text.appendChild(
              el2(
                "div",
                {
                  class: "osu-expertplus-panel__feature-hint",
                  "data-oep-modded-sr-hint": "1"
                },
                ""
              )
            );
            applyModdedStarRowLockState(row);
          }
          groupRows.push(row);
        }
        rows.push(buildSection(groupName, groupRows));
      }
      const resetDefaultsBtn = el2(
        "button",
        {
          type: "button",
          class: "osu-expertplus-panel__footer-reset",
          title: "Set every toggle above to its default (API keys are not changed)"
        },
        "Reset to defaults"
      );
      resetDefaultsBtn.addEventListener("click", () => {
        if (!window.confirm(
          "Reset all Expert+ options to their defaults? osu! and OMDB API keys will not be changed."
        )) {
          return;
        }
        settings2.resetPanelTogglesToDefaults();
        refreshModdedStarRatingRowLock();
      });
      const footer = el2(
        "div",
        { class: "osu-expertplus-panel__footer" },
        resetDefaultsBtn,
        el2(
          "div",
          { class: "osu-expertplus-panel__footer-links" },
          el2(
            "a",
            {
              href: "https://github.com/inix1257/osu_expertplus",
              target: "_blank",
              rel: "noopener noreferrer"
            },
            "Source code"
          ),
          el2(
            "span",
            { class: "osu-expertplus-panel__footer-sep", "aria-hidden": "true" },
            "·"
          ),
          el2(
            "a",
            {
              href: "https://osu.ppy.sh/users/2688581",
              target: "_blank",
              rel: "noopener noreferrer"
            },
            "Developer"
          )
        )
      );
      return el2("div", { id: ROOT_ID }, header, ...rows, footer);
    }
    let openPanel = () => {
    };
    let closePanel = () => {
    };
    function init4() {
      if (document.getElementById(ROOT_ID)) return;
      GM_addStyle(CSS2);
      const fab = el2(
        "button",
        {
          id: "osu-expertplus-fab",
          type: "button",
          title: "osu! Expert+ Settings"
        },
        el2(
          "span",
          { class: "osu-expertplus-fab__icon", "aria-hidden": "true" },
          el2("i", { class: "fas fa-cog" })
        ),
        el2(
          "span",
          { class: "osu-expertplus-fab__label" },
          el2("span", { class: "osu-expertplus-fab__brand-accent" }, "Expert+")
        )
      );
      const apiWarning = el2(
        "div",
        {
          class: "osu-expertplus-fab-api-warning",
          role: "status"
        },
        el2("i", {
          class: "fas fa-exclamation-triangle osu-expertplus-fab-api-warning__icon",
          "aria-hidden": "true"
        }),
        el2(
          "span",
          { class: "osu-expertplus-fab-api-warning__text" },
          "osu! API credentials not set"
        )
      );
      const fabAnchor = el2("div", { id: FAB_ANCHOR_ID }, apiWarning, fab);
      const backdrop = el2("div", { id: "osu-expertplus-backdrop" });
      const panel = buildPanel();
      fabUi.anchor = fabAnchor;
      fabUi.panel = panel;
      openPanel = () => {
        panel.classList.add(OPEN_CLASS);
        backdrop.classList.add(OPEN_CLASS);
      };
      closePanel = () => {
        panel.classList.remove(OPEN_CLASS);
        backdrop.classList.remove(OPEN_CLASS);
      };
      const toggle = () => panel.classList.contains(OPEN_CLASS) ? closePanel() : openPanel();
      fab.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });
      backdrop.addEventListener("click", closePanel);
      function attachToBody() {
        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        document.body.appendChild(fabAnchor);
        refreshFabOsuApiWarning();
        refreshModdedStarRatingRowLock();
      }
      attachToBody();
      window.addEventListener("resize", syncPanelAboveFab);
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node === document.body) {
              attachToBody();
              return;
            }
          }
        }
      }).observe(document.documentElement, { childList: true });
    }
    return {
      init: init4,
      /** Opens the Expert+ settings modal (idempotent if {@link init} has not run). */
      open: () => {
        openPanel();
      },
      close: () => {
        closePanel();
      }
    };
  })();

  // src/main.js
  var { OsuExpertPlus: OsuExpertPlus2 } = window;
  OsuExpertPlus2.pages.beatmapDiscussion = beatmapDiscussion;
  OsuExpertPlus2.settingsPanel.init();
  OsuExpertPlus2.modIconsAsAcronyms.install(OsuExpertPlus2.settings);
  installLinkPatcher();
  OsuExpertPlus2.navRecentNotification.install(OsuExpertPlus2.settings);
  new Router(OsuExpertPlus2.pages).init();
})();
