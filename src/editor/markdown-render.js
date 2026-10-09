/**
 * Markdown preview renderer for the beatmap discussion composer (WS-25),
 * replacing `renderMarkdownPreviewHtml` in beatmap-detail.
 *
 *   body.replaceChildren(renderMarkdown(textarea.value, { document }));
 *
 * Same subset as before, built as DOM nodes (no HTML parsing):
 * - Blocks, one line at a time: fenced code (```), `> quote` (one `<p>` per
 *   line), `-`/`*` bullet lists, `1.` numbered lists, `#`–`######`
 *   headings; every other non-blank line is its own `<p>`. A blank line ends
 *   lists and quotes.
 * - Inline: `` `code` `` (content kept literally), `![alt](url)`,
 *   `[label](http(s)://…)`, `**bold**`, `__bold__`, `*em*`, `_em_`,
 *   `~~del~~`.
 *
 * URLs must be absolute http(s); the image src is set from the raw URL, so
 * `&` is no longer double-escaped (B73). Code spans, images and links are
 * parsed first and are opaque to the emphasis passes, so a `_` or `*` inside
 * a URL or code span cannot break them (the old B04 class of bugs). The
 * emphasis passes run in the old order over the remaining text; delimiters
 * must hug their content (`2 * 3 * 4` stays plain) and `_` does not work
 * inside words (`snake_case_name` stays plain).
 */

import { absoluteHttpUrl } from "./sanitize.js";

/** Object replacement char: starts an atom placeholder in the inline pass. */
const MARK = "\uFFFC";
const PUA_BASE = 0xe000;
const PUA_SIZE = 6400;
const PLACEHOLDER_RE = /\uFFFC([\uE000-\uF8FF])([\uE000-\uF8FF])/;
const LINK_URL_RE = /^https?:\/\/[^\s)]+$/;

/**
 * Emphasis passes, in the old renderer's order. `[^x\n]` classes keep each
 * pass linear.
 */
const EMPHASIS = [
  { re: /\*\*(?!\s)([^*\n]+)(?<!\s)\*\*/g, tag: "strong" },
  {
    re: /(?<![\p{L}\p{N}])__(?!\s)([^_\n]+)(?<!\s)__(?![\p{L}\p{N}])/gu,
    tag: "strong",
  },
  { re: /\*(?!\s)([^*\n]+)(?<!\s)\*/g, tag: "em" },
  {
    re: /(?<![\p{L}\p{N}])_(?!\s)([^_\n]+)(?<!\s)_(?![\p{L}\p{N}])/gu,
    tag: "em",
  },
  { re: /~~([^~\n]+)~~/g, tag: "del" },
];
const EMPHASIS_ROUNDS = 3;

/**
 * `indexOf` memoized per needle for non-decreasing `from` (see
 * bbcode-render.js).
 * @param {string} haystack
 */
function createFinder(haystack) {
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

/** Index of the first whitespace char at or after `from`, memoized. */
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

/**
 * One line of inline markdown. Atoms (code spans, images, links, emphasis
 * results) are swapped for 3-char placeholders so later passes treat them
 * as opaque text.
 */
class Inline {
  /** @param {Document} doc */
  constructor(doc) {
    this.doc = doc;
    /** @type {Array<{ el: Element, inner?: string }>} */
    this.atoms = [];
  }

  /** @returns {string} placeholder for a new atom */
  atom(el, inner) {
    const index = this.atoms.length;
    this.atoms.push({ el, inner });
    return (
      MARK +
      String.fromCharCode(PUA_BASE + Math.floor(index / PUA_SIZE)) +
      String.fromCharCode(PUA_BASE + (index % PUA_SIZE))
    );
  }

  /** Code spans and images, left to right. */
  codeAndImages(line) {
    const findTick = createFinder(line);
    const findClose = createFinder(line);
    const findParen = createFinder(line);
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
    const findClose = createFinder(s);
    const findParen = createFinder(s);
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
        if (
          raw &&
          (ws < 0 || ws > close) &&
          LINK_URL_RE.test(raw) &&
          !raw.includes(MARK)
        ) {
          const href = absoluteHttpUrl(raw);
          if (href) {
            const a = this.doc.createElement("a");
            a.setAttribute("href", href);
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
            out +=
              s.slice(from, i) +
              this.atom(a, this.emphasis(s.slice(i + 1, rb)));
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
    while ((m = re.exec(s))) {
      if (m.index > from) parent.append(s.slice(from, m.index));
      const index =
        (m[1].charCodeAt(0) - PUA_BASE) * PUA_SIZE +
        (m[2].charCodeAt(0) - PUA_BASE);
      const atom = this.atoms[index];
      if (atom.inner !== undefined) this.expand(atom.inner, atom.el);
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
    const safe = line.replace(/\uFFFC/g, "\uFFFD");
    this.expand(this.emphasis(this.links(this.codeAndImages(safe))), parent);
  }
}

/**
 * Render discussion markdown to a fragment of preview DOM. Empty input gives
 * an empty fragment (the caller shows its own "nothing to preview" state).
 * @param {string} source
 * @param {{ document?: Document }} [options]
 * @returns {DocumentFragment}
 */
export function renderMarkdown(source, options = {}) {
  const doc = options.document ?? globalThis.document;
  const frag = doc.createDocumentFragment();
  const lines = String(source ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  /** @type {Element | null} */
  let code = null;
  let codeText = "";
  /** @type {Element | null} */
  let ul = null;
  /** @type {Element | null} */
  let ol = null;
  /** @type {Element | null} */
  let quote = null;

  const el = (tag) => doc.createElement(tag);
  const inline = (text, tag) => {
    const node = el(tag);
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
        const pre = el("pre");
        code = el("code");
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
      codeText += `${line}\n`;
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
        quote = el("blockquote");
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
        ul = el("ul");
        frag.appendChild(ul);
      }
      ul.appendChild(inline(ulMatch[1], "li"));
      continue;
    }

    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      ul = null;
      if (!ol) {
        ol = el("ol");
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
