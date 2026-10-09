/**
 * Live preview of the edited BBCode (WS-40).
 */

import { el } from "../../features/legacy.js";
import {
  BBHELP_PREVIEW_ATTR,
  BBHELP_PREVIEW_BODY_CLASS,
  BBHELP_PREVIEW_CLASS,
  BBHELP_PREVIEW_DONE_ATTR,
  BBHELP_PREVIEW_EMPTY_CLASS,
  BBHELP_PREVIEW_TITLE_CLASS,
  BBHELP_PREVIEW_TOGGLE_ATTR,
  BBHELP_PREVIEW_TOGGLE_CLASS,
} from "./constants.js";

export function _escapePreviewHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Reverse `_escapePreviewHtml` (renderer input is already escaped). */
export function _unescapePreviewHtml(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** `_sanitizeHttpPreviewUrl` for a URL taken from escaped renderer input. */
export function _sanitizeEscapedPreviewUrl(escapedRaw) {
  return _sanitizeHttpPreviewUrl(_unescapePreviewHtml(escapedRaw));
}

export function _sanitizeHttpPreviewUrl(raw) {
  const src = String(raw || "").trim();
  if (!src) return "";
  try {
    const parsed = new URL(src, location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch (_) {
    return "";
  }
}

export function _matchNoticeOpenAt(s, i) {
  if (i >= s.length || s[i] !== "[") return null;
  if (!/^\[notice\]/i.test(s.slice(i, i + 8))) return null;
  return { fullLen: 8 };
}

export function _matchNoticeCloseLen(s, i) {
  return /^\[\/notice\]/i.test(s.slice(i, i + 9)) ? 9 : 0;
}

export function _findBbcodeNoticeCloseRange(s, innerStart) {
  let i = innerStart;
  let depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === "[") {
      const closeLen = _matchNoticeCloseLen(s, i);
      if (closeLen) {
        depth -= 1;
        if (depth === 0) {
          return { bodyEnd: i, closeEnd: i + closeLen };
        }
        i += closeLen;
        continue;
      }
      const op = _matchNoticeOpenAt(s, i);
      if (op) {
        depth += 1;
        i += op.fullLen;
        continue;
      }
    }
    i += 1;
  }
  return null;
}

export function _matchBbcodeBoxOpenAt(s, i) {
  if (i >= s.length || s[i] !== "[") return null;
  const rest = s.slice(i);
  const tags = ["spoilerbox", "spoiler", "box"];
  for (let t = 0; t < tags.length; t += 1) {
    const tag = tags[t];
    const re =
      tag === "spoilerbox"
        ? /^\[spoilerbox(?:=([^\]]*))?\]/i
        : tag === "spoiler"
          ? /^\[spoiler(?:=([^\]]*))?\]/i
          : /^\[box(?:=([^\]]*))?\]/i;
    const m = rest.match(re);
    if (m) {
      return {
        tag,
        titleRaw: String(m[1] ?? "").trim(),
        fullLen: m[0].length,
      };
    }
  }
  return null;
}

export function _matchBbcodeBoxCloseLen(s, i, tag) {
  const re =
    tag === "spoilerbox"
      ? /^\[\/spoilerbox\]/i
      : tag === "spoiler"
        ? /^\[\/spoiler\]/i
        : /^\[\/box\]/i;
  const m = s.slice(i).match(re);
  return m ? m[0].length : 0;
}

export function _findFirstBbcodeNestableOpen(s) {
  for (let i = 0; i < s.length; i += 1) {
    const noticeOp = _matchNoticeOpenAt(s, i);
    if (noticeOp) {
      return { kind: "notice", index: i, fullLen: noticeOp.fullLen };
    }
    const boxOp = _matchBbcodeBoxOpenAt(s, i);
    if (boxOp) {
      return {
        kind: "box",
        index: i,
        tag: boxOp.tag,
        titleRaw: boxOp.titleRaw,
        fullLen: boxOp.fullLen,
      };
    }
  }
  return null;
}

export function _findBbcodeBoxCloseRange(s, innerStart, tag) {
  let i = innerStart;
  let depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === "[") {
      const closeLen = _matchBbcodeBoxCloseLen(s, i, tag);
      if (closeLen) {
        depth -= 1;
        if (depth === 0) {
          return { bodyEnd: i, closeEnd: i + closeLen };
        }
        i += closeLen;
        continue;
      }
      const op = _matchBbcodeBoxOpenAt(s, i);
      if (op && op.tag === tag) {
        depth += 1;
        i += op.fullLen;
        continue;
      }
    }
    i += 1;
  }
  return null;
}

export function _formatBbcodeBoxPreviewHtml(
  tag,
  titleRawFromEscapedSource,
  innerHtml,
) {
  const trimmed = String(titleRawFromEscapedSource || "").trim();
  const label = tag === "box" ? trimmed || "Box" : trimmed;
  const labelSpan = label
    ? `<span class="oep-bbhelp-preview__spoiler-label">${label}</span>`
    : "";
  const summaryClass =
    "oep-bbhelp-preview__spoiler-summary" +
    (label ? "" : " oep-bbhelp-preview__spoiler-summary--icon-only");
  const summaryA11y = label ? "" : ' aria-label="Spoiler"';
  return (
    `<details class="oep-bbhelp-preview__spoilerbox">` +
    `<summary class="${summaryClass}"${summaryA11y}>` +
    `<span class="oep-bbhelp-preview__spoiler-icon" aria-hidden="true"></span>` +
    `${labelSpan}` +
    `</summary>` +
    `<div class="oep-bbhelp-preview__spoiler-body">${innerHtml}</div>` +
    `</details>`
  );
}

export function _replaceBalancedBbcodeNestable(html, renderInner) {
  const first = _findFirstBbcodeNestableOpen(html);
  if (!first) return html;

  if (first.kind === "notice") {
    const start = first.index;
    const fullLen = first.fullLen;
    const range = _findBbcodeNoticeCloseRange(html, start + fullLen);
    if (!range) return html;
    const before = html.slice(0, start);
    const inner = html.slice(start + fullLen, range.bodyEnd);
    const after = html.slice(range.closeEnd);
    const innerHtml = renderInner(inner);
    const block = `<div class="oep-bbhelp-preview__notice">${innerHtml}</div>`;
    return (
      _replaceBalancedBbcodeNestable(before, renderInner) +
      block +
      _replaceBalancedBbcodeNestable(after, renderInner)
    );
  }

  const { index: start, tag, titleRaw, fullLen } = first;
  const range = _findBbcodeBoxCloseRange(html, start + fullLen, tag);
  if (!range) return html;
  const before = html.slice(0, start);
  const inner = html.slice(start + fullLen, range.bodyEnd);
  const after = html.slice(range.closeEnd);
  const innerHtml = renderInner(inner);
  const boxHtml = _formatBbcodeBoxPreviewHtml(tag, titleRaw, innerHtml);
  return (
    _replaceBalancedBbcodeNestable(before, renderInner) +
    boxHtml +
    _replaceBalancedBbcodeNestable(after, renderInner)
  );
}

export function _finishBbcodePreviewParagraphs(html) {
  const applyLineBreaks = (str) =>
    str.replace(/(<pre\b[\s\S]*?<\/pre>)|\n/g, (m, pre) => pre ?? "<br>");

  return html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      const withBr = applyLineBreaks(trimmed);
      if (/^<(ul|ol|pre|blockquote|h\d|div|details)/i.test(trimmed))
        return withBr;
      return `<p>${withBr}</p>`;
    })
    .join("");
}

export function _bbcodePreviewCore(escaped) {
  let html = escaped;

  html = html.replace(
    /\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi,
    (_, hrefRaw, labelRaw) => {
      const href = _sanitizeEscapedPreviewUrl(hrefRaw);
      const label = String(labelRaw || "");
      if (!href) return label;
      return `<a href="${_escapePreviewHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, hrefRaw) => {
    const href = _sanitizeEscapedPreviewUrl(hrefRaw);
    if (!href) return String(hrefRaw || "");
    const label = _escapePreviewHtml(href);
    return `<a href="${label}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  html = html.replace(
    /\[imagemap=([^\]]+)\]([\s\S]*?)\[\/imagemap\]/gi,
    (_, srcRaw) => {
      const maybeSrc = String(srcRaw || "").trim();
      const srcUrl = _sanitizeEscapedPreviewUrl(maybeSrc);
      if (!srcUrl) return "";
      return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
    },
  );
  html = html.replace(
    /\[imagemap\(([^)\]]+)\)\]([\s\S]*?)\[\/imagemap\]/gi,
    (_, srcRaw) => {
      const maybeSrc = String(srcRaw || "").trim();
      const srcUrl = _sanitizeEscapedPreviewUrl(maybeSrc);
      if (!srcUrl) return "";
      return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
    },
  );
  html = html.replace(
    /\[imagemap\]([\s\S]*?)\[\/imagemap\]/gi,
    (_, bodyRaw) => {
      const body = String(bodyRaw || "");
      const srcMatch = body.match(
        /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i,
      );
      const srcUrl = _sanitizeEscapedPreviewUrl(srcMatch ? srcMatch[0] : "");
      if (!srcUrl) return "";
      return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
    },
  );
  html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, srcRaw) => {
    const srcUrl = _sanitizeEscapedPreviewUrl(srcRaw);
    if (!srcUrl) return "";
    return `<img src="${_escapePreviewHtml(srcUrl)}" alt="preview image" loading="lazy" referrerpolicy="no-referrer" />`;
  });

  const wrapPairs = [
    ["b", "strong"],
    ["i", "em"],
    ["u", "u"],
    ["s", "del"],
    ["strike", "del"],
    ["quote", "blockquote"],
    ["heading", "h3"],
    ["centre", 'div style="text-align:center;"'],
    ["right", 'div style="text-align:right;"'],
  ];
  wrapPairs.forEach(([bb, tag]) => {
    const open = `<${tag}>`;
    const closeTag = tag.split(" ")[0];
    html = html.replace(
      new RegExp(`\\[${bb}\\]([\\s\\S]*?)\\[\\/${bb}\\]`, "gi"),
      `${open}$1</${closeTag}>`,
    );
  });

  html = html.replace(
    /\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi,
    (_, color, body) => {
      const safeColor = String(color || "").trim();
      if (!OsuExpertPlus.htmlSanitize.isSafeColor(safeColor)) {
        return `<span>${body}</span>`;
      }
      return `<span style="color:${safeColor};">${body}</span>`;
    },
  );
  html = html.replace(
    /\[size=(.*?)\]([\s\S]*?)\[\/size\]/gi,
    (_, sizeRaw, body) => {
      const size = String(sizeRaw || "")
        .trim()
        .toLowerCase();
      const presets = {
        tiny: "0.75em",
        small: "0.88em",
        normal: "1em",
        large: "1.2em",
      };
      const pct = Number(size);
      const computed =
        presets[size] ||
        (Number.isFinite(pct) ? `${Math.max(30, Math.min(200, pct))}%` : "1em");
      return `<span style="font-size:${computed};">${body}</span>`;
    },
  );
  html = html.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    "<pre><code>$1</code></pre>",
  );

  html = _replaceBalancedBbcodeNestable(html, (body) =>
    _finishBbcodePreviewParagraphs(_bbcodePreviewCore(body)),
  );

  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, body) => {
    const items = String(body || "")
      .split(/\[\*\]/i)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!items.length) return "";
    return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
  });

  html = html.replace(/\[(\/)?[a-z*]+(?:=[^\]]+)?\]/gi, "");

  return html;
}

export function _renderSimpleBbcodePreviewHtml(src) {
  const raw = String(src ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!raw.trim()) {
    return `<p class="${BBHELP_PREVIEW_EMPTY_CLASS}">Nothing to preview yet.</p>`;
  }
  const escaped = _escapePreviewHtml(raw);
  const html = _bbcodePreviewCore(escaped);
  return _finishBbcodePreviewParagraphs(html);
}

export function _findCancelActionNode(editorEl, textarea) {
  const scopeRoots = [
    textarea?.closest("form"),
    editorEl.closest("form"),
    editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
    editorEl.parentElement,
  ].filter((n) => n instanceof HTMLElement);
  for (const scope of scopeRoots) {
    const candidate = Array.from(scope.querySelectorAll("button, a")).find(
      (n) => {
        if (!(n instanceof HTMLElement)) return false;
        const label = String(n.textContent || "")
          .trim()
          .toLowerCase();
        return label === "cancel";
      },
    );
    if (candidate instanceof HTMLElement) return candidate;
  }
  return null;
}

export function _ensureBbcodeLivePreview(editorEl, textarea) {
  let previewEnabled = false;
  let repaintTimer = 0;

  let toggleBtn = editorEl.querySelector(`[${BBHELP_PREVIEW_TOGGLE_ATTR}]`);
  if (!(toggleBtn instanceof HTMLButtonElement)) {
    toggleBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_PREVIEW_TOGGLE_CLASS,
        [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
        "aria-pressed": "false",
        title: "Toggle live preview",
      },
      "Live preview",
    );
  }

  let preview = editorEl.querySelector(`[${BBHELP_PREVIEW_ATTR}]`);
  if (!(preview instanceof HTMLElement)) {
    preview = el(
      "section",
      {
        class: BBHELP_PREVIEW_CLASS,
        [BBHELP_PREVIEW_ATTR]: "1",
        hidden: "hidden",
      },
      el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
      el("div", { class: BBHELP_PREVIEW_BODY_CLASS }),
    );
    textarea.insertAdjacentElement("afterend", preview);
  }

  const previewBody = preview.querySelector(`.${BBHELP_PREVIEW_BODY_CLASS}`);
  if (!(previewBody instanceof HTMLElement)) return;

  const placeToggle = () => {
    const cancelNode = _findCancelActionNode(editorEl, textarea);
    if (!(cancelNode instanceof HTMLElement)) return;
    const parent = cancelNode.parentElement;
    if (!(parent instanceof HTMLElement)) return;
    if (
      toggleBtn.parentElement !== parent ||
      toggleBtn.nextElementSibling !== cancelNode
    ) {
      cancelNode.insertAdjacentElement("beforebegin", toggleBtn);
    }
  };

  const repaint = () => {
    previewBody.replaceChildren(
      OsuExpertPlus.htmlSanitize.toSafeFragment(
        _renderSimpleBbcodePreviewHtml(textarea.value || ""),
      ),
    );
    preview.hidden = !previewEnabled;
    toggleBtn.setAttribute("aria-pressed", previewEnabled ? "true" : "false");
    placeToggle();
  };
  const repaintSoon = () => {
    window.clearTimeout(repaintTimer);
    repaintTimer = window.setTimeout(repaint, 70);
  };

  if (!textarea.hasAttribute(BBHELP_PREVIEW_DONE_ATTR)) {
    textarea.addEventListener("input", repaintSoon);
    toggleBtn.addEventListener("click", () => {
      previewEnabled = !previewEnabled;
      repaint();
    });
    textarea.setAttribute(BBHELP_PREVIEW_DONE_ATTR, "1");
  } else {
    previewEnabled = toggleBtn.getAttribute("aria-pressed") === "true";
  }

  repaint();
}
