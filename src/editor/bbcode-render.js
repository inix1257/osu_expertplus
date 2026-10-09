/**
 * BBCode live-preview renderer (WS-25), replacing the regex-over-HTML
 * renderer in user-profile (`_bbcodePreviewCore` and friends).
 *
 *   const frag = renderBbcode(textarea.value, { document });
 *   previewBody.replaceChildren(frag);
 *
 * Pipeline: (1) one left-to-right scan finds the tags (`[name]`,
 * `[name=param]`, `[/name]`, `[*]`, `[imagemap(url)]`); (2) opening and
 * closing tags are paired per name; (3) a stack turns the tokens into a
 * tree; (4) the tree becomes DOM nodes via createElement/textContent (no
 * HTML parsing anywhere, so input can never become markup).
 *
 * Rules:
 * - Tag names are case-insensitive. Unknown tags, tags with a parameter they
 *   do not take, unclosed tags and stray closing tags are shown literally,
 *   and everything after them keeps working (B44). A closing tag closes the
 *   nearest open tag of the same name; tags opened in between are shown
 *   literally (`[/list]` closes its `[*]` items normally).
 * - Raw-content tags (`code`, `img`, `imagemap`, `youtube`, `audio`,
 *   `profile`, `email`, and `url` without a parameter) take their content as
 *   text up to the matching closing tag.
 * - At most BBCODE_MAX_DEPTH tags are open at once; deeper tags are shown
 *   literally. Unpaired opening tags never occupy a level. Searches for
 *   closing tags and `]` are memoized, so every pass is linear in the input
 *   length, and recursion depth is bounded by the cap (B65).
 * - URLs must be absolute http(s) (`absoluteHttpUrl`); colours `#hex` or a
 *   name (`isSafeColor`); sizes a preset or a percentage clamped to 30–200.
 * - Paragraphs follow the old `_finishBbcodePreviewParagraphs`: runs of 2+
 *   newlines split paragraphs, single newlines become `<br>`, a paragraph is
 *   wrapped in `<p>` unless it starts with a block (div/heading/quote/list/
 *   code/box), and inside a paragraph the `<p>` ends at the first block. Box
 *   and notice bodies are paragraphed on their own.
 *
 * Output classes and attributes match the old renderer, so the existing
 * `oep-bbhelp-preview` CSS keeps working.
 */

import { absoluteHttpUrl, isSafeColor } from "./sanitize.js";

/** Maximum number of tags open at the same time. */
export const BBCODE_MAX_DEPTH = 64;

const MAX_PARAM_LENGTH = 2048;
const MAX_NAME_LENGTH = 10;
const OSU_ORIGIN = "https://osu.ppy.sh";

const INLINE = "inline";
const BLOCK = "block";
const CONTAINER = "container";
const RAW = "raw";
const ITEM = "item";

/**
 * @typedef {{
 *   kind: string,
 *   param: "none" | "optional" | "required",
 *   rawWithoutParam?: boolean,
 * }} TagDef
 * @type {Record<string, TagDef>}
 */
const TAGS = {
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
  email: { kind: RAW, param: "optional" },
};

const SIZE_PRESETS = {
  tiny: "0.75em",
  small: "0.88em",
  normal: "1em",
  large: "1.2em",
};

const ALIGN = { centre: "center", left: "left", right: "right" };

const IMAGEMAP_BODY_IMAGE_RE =
  /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z-]+$/;
const YOUTUBE_PREFIX_RE =
  /^(?:https?:\/\/(?:youtu\.be\/|(?:m\.|www\.|)youtube\.com\/(?:embed\/|shorts\/|watch\?v=)))?/i;
const YOUTUBE_ID_RE = /^[\w-]{1,64}$/;
const QUOTE_NAME_RE = /^"(.+)"$/;

/** Marker returned by raw-tag validation: parse the content as BBCode. */
const PARSE_CONTENT = Symbol("parse-content");

// ---------------------------------------------------------------------------
// Scanning

/**
 * ASCII-only lower-casing keeps indexes aligned with the source (full
 * Unicode lower-casing can change the string length).
 * @param {string} s
 */
function asciiLower(s) {
  return s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
}

/**
 * `indexOf` with a per-needle memo. Queries for one needle come with
 * non-decreasing `from` values, so each needle's search covers the input at
 * most once in total.
 * @param {string} haystack
 */
function createFinder(haystack) {
  /** @type {Map<string, { from: number, at: number }>} */
  const memo = new Map();
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

/**
 * @typedef {{
 *   name: string,
 *   close: boolean,
 *   param: string | null,
 *   paren: boolean,
 *   end: number,
 * }} TagToken
 */

/**
 * Recognize a tag at `src[i] === "["`.
 * @returns {TagToken | null}
 */
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
    const isName =
      (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 42; /* * */
    if (!isName) break;
    k += 1;
  }
  if (k === j || k - j > MAX_NAME_LENGTH) return null;
  const name = asciiLower(src.slice(j, k));
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
  if (next === "(") {
    // `[imagemap(url)]`: the first `)` must sit right before the `]`.
    const rp = find(")", k + 1);
    if (rp !== rb - 1 || rp === k + 1) return null;
    return {
      name,
      close,
      param: src.slice(k + 1, rp),
      paren: true,
      end: rb + 1,
    };
  }
  return {
    name,
    close,
    param: src.slice(k + 1, rb),
    paren: false,
    end: rb + 1,
  };
}

// ---------------------------------------------------------------------------
// Tree

/**
 * @typedef {{
 *   type: "root" | "tag" | "literal",
 *   name?: string,
 *   param?: string | null,
 *   open?: string,
 *   plain?: boolean,
 *   children: Array<string | Node_>,
 * }} Frame
 * @typedef {{ type: "raw", name: string, [key: string]: unknown }} RawNode
 * @typedef {Frame | RawNode} Node_
 */

/**
 * Validate a raw-content tag. Returns the node to insert, `null` to drop the
 * tag and its content (invalid `[img]`/`[imagemap]`, like the old renderer),
 * `undefined` to show the opening tag literally, or PARSE_CONTENT.
 * @returns {RawNode | null | undefined | typeof PARSE_CONTENT}
 */
function makeRaw(name, tag, content) {
  switch (name) {
    case "code": {
      // Drop leading/trailing newlines (osu-web parseCode), without a regex
      // that would backtrack over long newline runs.
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
      return href
        ? { type: "raw", name, href, text: content.trim() }
        : PARSE_CONTENT;
    }
    case "imagemap": {
      let candidate = tag.param;
      if (candidate === null) {
        // The image URL is the first line; the cap keeps the regex cheap.
        const m = IMAGEMAP_BODY_IMAGE_RE.exec(content.slice(0, 4096));
        candidate = m ? m[0] : "";
      }
      const src = absoluteHttpUrl(candidate);
      return src ? { type: "raw", name, src } : null;
    }
    case "youtube": {
      const id = content
        .trim()
        .replace(YOUTUBE_PREFIX_RE, "")
        .replace(/[?&].*$/, "");
      if (!YOUTUBE_ID_RE.test(id)) return undefined;
      return {
        type: "raw",
        name,
        href: `https://www.youtube.com/watch?v=${id}`,
        text: `YouTube: ${id}`,
      };
    }
    case "audio": {
      const href = absoluteHttpUrl(content);
      return href
        ? { type: "raw", name, href, text: content.trim() }
        : undefined;
    }
    case "profile": {
      const username = content.trim();
      if (!username) return undefined;
      if (tag.param !== null && !/^\d{1,12}$/.test(tag.param)) return undefined;
      const target =
        tag.param !== null ? tag.param : `@${encodeURIComponent(username)}`;
      return {
        type: "raw",
        name,
        href: `${OSU_ORIGIN}/users/${target}`,
        text: username,
      };
    }
    case "email": {
      const address = tag.param ?? content;
      if (!EMAIL_RE.test(address) || !content) return undefined;
      return { type: "raw", name, text: content };
    }
    default:
      return undefined;
  }
}

/**
 * @typedef {{
 *   kind: "open" | "close" | "item" | "itemClose" | "raw",
 *   name: string,
 *   param: string | null,
 *   lb: number,
 *   end: number,
 *   open: string,
 *   plain?: boolean,
 *   node?: RawNode | null,
 *   matched?: boolean,
 * }} Token
 */

/**
 * Pass 1: every tag in the source, left to right. Raw-content tags are
 * resolved here (their content is skipped); tags that can only be literal
 * (invalid parameter, raw tag without its closing tag) are left out, so
 * they stay part of the text.
 * @param {string} src
 * @returns {Token[]}
 */
function tokenize(src) {
  const find = createFinder(src);
  const findLower = createFinder(asciiLower(src));
  /** @type {Token[]} */
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
      open: src.slice(lb, tag.end),
    };
    if (tag.close) {
      tokens.push({ ...base, kind: tag.name === "*" ? "itemClose" : "close" });
      continue;
    }
    const def = TAGS[tag.name];
    if (def.kind === RAW || (def.rawWithoutParam && tag.param === null)) {
      const closeText = `[/${tag.name}]`;
      const q = findLower(closeText, tag.end);
      if (q < 0) continue;
      const node = makeRaw(tag.name, tag, src.slice(tag.end, q));
      if (node === undefined) continue;
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

/**
 * Pass 2: bracket matching per tag name (each closing tag takes the nearest
 * unmatched opening tag of its name). Opening tags left without a partner
 * can never be closed, so pass 3 shows them literally right away: they do
 * not count toward the depth cap and cannot swallow later tags (B44, B65).
 * @param {Token[]} tokens
 */
function matchTokens(tokens) {
  /** @type {Map<string, Token[]>} */
  const open = new Map();
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

/**
 * Parse BBCode into a tree (exported for tests and debugging). Text children
 * are plain strings; `literal` frames are tags that were never closed and
 * render as their opening text followed by their children.
 * @param {string} source
 * @returns {Frame}
 */
export function parseBbcode(source) {
  const src = String(source ?? "").replace(/\r\n?/g, "\n");
  const tokens = tokenize(src);
  matchTokens(tokens);

  /** @type {Frame} */
  const root = { type: "root", children: [] };
  /** @type {Frame[]} */
  const stack = [root];
  let textStart = 0;

  const top = () => stack[stack.length - 1];
  const flushText = (end) => {
    if (end > textStart) top().children.push(src.slice(textStart, end));
  };
  const literalize = (frame) => {
    frame.type = "literal";
  };
  /** @param {Token} token */
  const push = (token) => {
    /** @type {Frame} */
    const frame = {
      type: "tag",
      name: token.name,
      param: token.param,
      open: token.open,
      children: [],
    };
    if (token.plain) frame.plain = true;
    top().children.push(frame);
    stack.push(frame);
  };

  /**
   * Pass 3: build the tree. Returns false to keep the token as text.
   * @param {Token} token
   */
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
        // Close the current item (and anything left open inside it), then
        // start a new one; only directly inside a list or its items.
        let k = stack.length - 1;
        while (k > 0) {
          const name = /** @type {string} */ (stack[k].name);
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
          const frame = /** @type {Frame} */ (stack.pop());
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

// ---------------------------------------------------------------------------
// Paragraph flow

/**
 * Builds the DOM of one container (preview root, box body, notice body) the
 * way `_finishBbcodePreviewParagraphs` + the browser's HTML parser shaped
 * the old output. See the module comment for the rules.
 */
class Flow {
  /**
   * @param {Document} doc
   * @param {Element | DocumentFragment} root
   */
  constructor(doc, root) {
    this.doc = doc;
    /** @type {Array<Element | DocumentFragment>} */
    this.blocks = [root];
    /** @type {Array<{ make: () => Element, el: Element | null }>} */
    this.inline = [];
    /** @type {Element | null} */
    this.p = null;
    this.segStart = true;
    this.pMode = true;
    /** Whitespace and single newlines waiting for more content. */
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
    /** @type {Element | DocumentFragment} */
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
    while ((m = re.exec(str))) {
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
  openBlock(el) {
    this.begin(true);
    this.closeP();
    this.pMode = false;
    this.block.appendChild(el);
    this.blocks.push(el);
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
  atom(el, isBlock) {
    if (isBlock) {
      this.begin(true);
      this.closeP();
      this.pMode = false;
      this.block.appendChild(el);
    } else {
      this.begin(false);
      this.target().appendChild(el);
    }
  }

  end() {
    this.pending.length = 0;
    this.closeP();
  }
}

// ---------------------------------------------------------------------------
// Rendering

/**
 * @param {Document} doc
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {string} [text]
 */
function h(doc, tag, attrs, text) {
  const el = doc.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

function linkAttrs(href) {
  return { href, target: "_blank", rel: "noopener noreferrer" };
}

function sizeValue(raw) {
  const size = String(raw || "")
    .trim()
    .toLowerCase();
  if (Object.hasOwn(SIZE_PRESETS, size)) return SIZE_PRESETS[size];
  const pct = Number(size);
  return Number.isFinite(pct) ? `${Math.max(30, Math.min(200, pct))}%` : "1em";
}

/**
 * Children of one list item without leading/trailing whitespace (the old
 * renderer trimmed each `[*]` part).
 * @param {Array<string | Node_>} children
 */
function trimItem(children) {
  const out = children.slice();
  while (out.length && typeof out[0] === "string" && !out[0].trim()) {
    out.shift();
  }
  if (typeof out[0] === "string") out[0] = out[0].trimStart();
  while (
    out.length &&
    typeof out[out.length - 1] === "string" &&
    !out[out.length - 1].trim()
  ) {
    out.pop();
  }
  const last = out.length - 1;
  if (typeof out[last] === "string") out[last] = out[last].trimEnd();
  return out;
}

/** @param {Frame} list */
function listItems(list) {
  const items = [];
  const loose = [];
  for (const child of list.children) {
    if (
      typeof child !== "string" &&
      child.type === "tag" &&
      child.name === "*"
    ) {
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

class Renderer {
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
  container(el, children) {
    const flow = new Flow(this.doc, el);
    this.nodes(children, flow);
    flow.end();
  }

  /**
   * @param {Frame} node
   * @param {Flow} flow
   */
  tag(node, flow) {
    const doc = this.doc;
    const name = /** @type {string} */ (node.name);
    const inline = (make) => {
      flow.openInline(make);
      this.nodes(node.children, flow);
      flow.closeInline();
    };
    const block = (el) => {
      flow.openBlock(el);
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
        return inline(() =>
          isSafeColor(color)
            ? h(doc, "span", { style: `color:${color};` })
            : h(doc, "span"),
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
        const el = h(doc, "blockquote");
        flow.openBlock(el);
        const m = node.param ? QUOTE_NAME_RE.exec(node.param) : null;
        if (m) flow.atom(h(doc, "h4", undefined, `${m[1]} wrote:`), true);
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
        // An item of a list that ended up literal: literal too.
        flow.text(String(node.open));
        this.nodes(node.children, flow);
        return;
      case "notice": {
        const el = h(doc, "div", { class: "oep-bbhelp-preview__notice" });
        this.container(el, node.children);
        flow.atom(el, true);
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
      class: label
        ? "oep-bbhelp-preview__spoiler-summary"
        : "oep-bbhelp-preview__spoiler-summary oep-bbhelp-preview__spoiler-summary--icon-only",
    });
    if (!label) summary.setAttribute("aria-label", "Spoiler");
    summary.appendChild(
      h(doc, "span", {
        class: "oep-bbhelp-preview__spoiler-icon",
        "aria-hidden": "true",
      }),
    );
    if (label) {
      summary.appendChild(
        h(doc, "span", { class: "oep-bbhelp-preview__spoiler-label" }, label),
      );
    }
    const body = h(doc, "div", { class: "oep-bbhelp-preview__spoiler-body" });
    this.container(body, node.children);
    const details = h(doc, "details", {
      class: "oep-bbhelp-preview__spoilerbox",
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
        pre.appendChild(h(doc, "code", undefined, String(node.text)));
        flow.atom(pre, true);
        return;
      }
      case "img":
        flow.atom(
          h(doc, "img", {
            src: String(node.src),
            alt: "preview image",
            loading: "lazy",
            referrerpolicy: "no-referrer",
          }),
          false,
        );
        return;
      case "imagemap": {
        const wrap = h(doc, "div", { class: "oep-bbhelp-preview__imagemap" });
        wrap.append(
          h(doc, "img", {
            src: String(node.src),
            alt: "imagemap preview",
            loading: "lazy",
            referrerpolicy: "no-referrer",
          }),
          h(
            doc,
            "div",
            { class: "oep-bbhelp-preview__imagemap-meta" },
            "ImageMap base image preview",
          ),
        );
        flow.atom(wrap, true);
        return;
      }
      case "email":
        flow.text(String(node.text));
        return;
      default:
        // url, youtube, audio, profile: a plain link.
        flow.atom(
          h(doc, "a", linkAttrs(String(node.href)), String(node.text)),
          false,
        );
    }
  }
}

/**
 * Render BBCode to a fragment of preview DOM. Empty input gives an empty
 * fragment (the caller shows its own "nothing to preview" state).
 * @param {string} source
 * @param {{ document?: Document }} [options]
 * @returns {DocumentFragment}
 */
export function renderBbcode(source, options = {}) {
  const doc = options.document ?? globalThis.document;
  const frag = doc.createDocumentFragment();
  const renderer = new Renderer(doc);
  renderer.container(frag, parseBbcode(source).children);
  return frag;
}
