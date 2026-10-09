/**
 * Discussion composer helpers (WS-30, moved from beatmap-detail.js): the
 * markdown toolbar above the textarea and the "Preview" toggle with its
 * rendered preview below it.
 */

import {
  beatmapsetIdFromPath,
  isDiscussionReviewsTotal,
} from "../../core/routes.js";
import { renderMarkdown } from "../../editor/markdown-render.js";
import { placeDiscussionPreviewToggle } from "../../editor/preview-toggle.js";
import { sanitizeTree } from "../../editor/sanitize.js";
import { replaceRange, toggleWrap } from "../../editor/textarea.js";

/**
 * Markdown helper toolbar and "Preview" toggle on the discussion composers
 * (new discussion, replies).
 * @param {number} beatmapsetId  The page's set; other paths tear the UI down.
 * @returns {() => void}
 */
export function startDiscussionPreview(beatmapsetId) {
  const { el, setHiddenIfChanged } = OsuExpertPlus.dom;
  const TOGGLE_ATTR = "data-oep-discussion-preview-toggle";
  const PREVIEW_ATTR = "data-oep-discussion-preview";
  const MARKER_ATTR = "data-oep-discussion-preview-bound";
  const ROOT_MARKER_ATTR = "data-oep-discussion-preview-root-bound";
  const HELPER_ATTR = "data-oep-markdown-helper";
  let previewEnabled = false;

  const isSupportedDiscussionPath = () =>
    beatmapsetIdFromPath(location.pathname) === beatmapsetId &&
    /^\/beatmapsets\/\d+\/discussion\//i.test(location.pathname) &&
    !isDiscussionReviewsTotal(location.pathname);

  /**
   * @returns {HTMLTextAreaElement[]}
   */
  function collectCandidateTextareas() {
    const nodes = Array.from(
      document.querySelectorAll(
        '[data-react="beatmap-discussions"] textarea, .beatmap-discussion textarea',
      ),
    );
    return nodes.filter((node) => {
      if (!(node instanceof HTMLTextAreaElement)) return false;
      if (!node.isConnected) return false;
      if (node.hasAttribute(MARKER_ATTR)) return false;
      if (
        !node.closest('[data-react="beatmap-discussions"], .beatmap-discussion')
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * @param {HTMLTextAreaElement|null} textarea
   * @returns {boolean}
   */
  function isVisibleTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) return false;
    if (!textarea.isConnected) return false;
    const rect = textarea.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;
    const cs = window.getComputedStyle(textarea);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }

  /**
   * @param {HTMLTextAreaElement} textarea
   */
  function bindTextareaPreview(textarea) {
    const composerRoot =
      textarea.closest(".beatmap-discussion-new") ||
      textarea.closest(".beatmap-discussion-post--new-reply") ||
      textarea.closest(".beatmap-discussion-reply-box") ||
      textarea.closest("[class*='discussion-new']") ||
      textarea.closest("[class*='new-reply']") ||
      textarea.closest("[class*='reply-box']");
    if (!(composerRoot instanceof HTMLElement)) return;
    textarea.setAttribute(MARKER_ATTR, "1");
    composerRoot.setAttribute(ROOT_MARKER_ATTR, "1");
    const isReplyComposer =
      composerRoot.classList.contains("beatmap-discussion-post--new-reply") ||
      composerRoot.classList.contains("beatmap-discussion-reply-box");

    /** Undoable where supported; callers dispatch `input` themselves. */
    const replaceRangeUndoable = (start, end, replacement) =>
      replaceRange(textarea, start, end, replacement, { dispatchInput: false });

    const insertText = (before, after, placeholder) => {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const selected = textarea.value.slice(start, end);
      const payload = `${before}${selected || placeholder}${after}`;
      replaceRangeUndoable(start, end, payload);
      const caret =
        start +
        before.length +
        (selected ? selected.length : String(placeholder).length);
      textarea.setSelectionRange(caret, caret);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    /** `matchInside: false` keeps the old behaviour (only an outside wrap unwraps). */
    const toggleMarkdownWrap = (before, after, placeholder) =>
      toggleWrap(textarea, before, after, { placeholder, matchInside: false });

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
      const next = lines
        .map((line) =>
          allPrefixed ? line.slice(prefix.length) : `${prefix}${line}`,
        )
        .join("\n");
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
      const allNumbered =
        lines.length > 0 &&
        lines.every((line) => line === "" || numberedRe.test(line));
      let n = 0;
      const next = lines
        .map((line) => {
          if (allNumbered) {
            if (line === "") return "";
            return line.replace(/^\d+\.\s*/, "");
          }
          if (line === "") return "";
          n += 1;
          return `${n}. ${line}`;
        })
        .join("\n");
      const replaceStart = hasSelection ? lineStart : selStart;
      const replaceEnd = hasSelection ? lineEnd : selEnd;
      replaceRangeUndoable(replaceStart, replaceEnd, next);
      textarea.setSelectionRange(replaceStart, replaceStart + next.length);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    const toggleCodeBlock = () => {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const selected = textarea.value.slice(start, end);
      const open = "```\n";
      const close = "\n```";
      const hasFence = selected.startsWith(open) && selected.endsWith(close);
      if (hasFence) {
        const inner = selected.slice(
          open.length,
          selected.length - close.length,
        );
        replaceRangeUndoable(start, end, inner);
        textarea.setSelectionRange(start, start + inner.length);
      } else {
        const payload = `${open}${selected || "code"}${close}`;
        replaceRangeUndoable(start, end, payload);
        const innerStart = start + open.length;
        const innerEnd = innerStart + (selected ? selected.length : 4);
        textarea.setSelectionRange(innerStart, innerEnd);
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };

    composerRoot
      .querySelectorAll(`[${HELPER_ATTR}]`)
      .forEach((n) => n.remove());
    const mkBtn = (iconCls, label, onClick) => {
      const btn = el(
        "button",
        {
          type: "button",
          class: "oep-markdown-helper__btn",
          title: label,
        },
        el("i", { class: iconCls, "aria-hidden": "true" }),
        label,
      );
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return btn;
    };
    const helper = el(
      "div",
      {
        class: `oep-markdown-helper${
          isReplyComposer
            ? " oep-markdown-helper--reply"
            : " oep-markdown-helper--new-discussion"
        }`,
        [HELPER_ATTR]: "1",
      },
      el(
        "div",
        { class: "oep-markdown-helper__row" },
        mkBtn("fas fa-bold", "Bold", () =>
          toggleMarkdownWrap("**", "**", "bold"),
        ),
        mkBtn("fas fa-italic", "Italic", () =>
          toggleMarkdownWrap("*", "*", "italic"),
        ),
        mkBtn("fas fa-strikethrough", "Strike", () =>
          toggleMarkdownWrap("~~", "~~", "text"),
        ),
        mkBtn("fas fa-code", "Code", () =>
          toggleMarkdownWrap("`", "`", "code"),
        ),
        mkBtn("fas fa-link", "Link", () =>
          insertText("[", "](https://example.com)", "title"),
        ),
        mkBtn("fas fa-image", "Image", () =>
          insertText("![", "](https://example.com/image.png)", ""),
        ),
        mkBtn("fas fa-quote-left", "Quote", () => togglePrefixLines("> ")),
        mkBtn("fas fa-list-ul", "List", () =>
          togglePrefixLines("- ", "item one\nitem two"),
        ),
        mkBtn("fas fa-list-ol", "Numbered", () => toggleOrderedListLines()),
        mkBtn("fas fa-heading", "Heading", () =>
          insertText("## ", "", "Heading"),
        ),
        mkBtn("fas fa-file-code", "Code Block", () => toggleCodeBlock()),
      ),
    );
    const newDiscussionRoot = textarea.closest(".beatmap-discussion-new");
    if (newDiscussionRoot instanceof HTMLElement) {
      if (
        helper.parentElement !== newDiscussionRoot ||
        newDiscussionRoot.firstElementChild !== helper
      ) {
        newDiscussionRoot.prepend(helper);
      }
    } else if (isReplyComposer) {
      // Inside --new-reply / reply-box so the strip matches the textarea row (not sibling __discussion bg).
      if (
        helper.parentElement !== composerRoot ||
        composerRoot.firstElementChild !== helper
      ) {
        composerRoot.prepend(helper);
      }
    } else if (
      textarea.closest(".beatmap-discussion-reply-box") instanceof
        HTMLElement ||
      textarea.closest(".beatmap-discussion-post--new-reply") instanceof
        HTMLElement ||
      textarea.closest("[class*='reply-box']") instanceof HTMLElement ||
      textarea.closest("[class*='new-reply']") instanceof HTMLElement
    ) {
      const helperAnchor =
        textarea.closest(".beatmap-discussion-reply-box") ||
        textarea.closest(".beatmap-discussion-post--new-reply") ||
        textarea.closest("[class*='reply-box']") ||
        textarea.closest("[class*='new-reply']");
      if (
        helperAnchor instanceof HTMLElement &&
        (helper.previousElementSibling !== helperAnchor ||
          helper.parentElement !== helperAnchor.parentElement)
      ) {
        helperAnchor.insertAdjacentElement("beforebegin", helper);
      }
    } else if (
      !(helper.parentElement instanceof HTMLElement) ||
      helper.nextElementSibling !== textarea
    ) {
      textarea.insertAdjacentElement("beforebegin", helper);
    }

    let toggleBtn = composerRoot.querySelector(`[${TOGGLE_ATTR}]`);
    if (!(toggleBtn instanceof HTMLButtonElement)) {
      toggleBtn = el(
        "button",
        {
          type: "button",
          class: "oep-discussion-preview-toggle",
          [TOGGLE_ATTR]: "1",
          "aria-pressed": previewEnabled ? "true" : "false",
          title: "Toggle post preview",
        },
        "Preview",
      );
    }
    placeDiscussionPreviewToggle(composerRoot, toggleBtn, textarea);

    let preview = composerRoot.querySelector(`[${PREVIEW_ATTR}]`);
    if (!(preview instanceof HTMLElement)) {
      preview = el(
        "div",
        {
          class: "oep-discussion-preview",
          [PREVIEW_ATTR]: "1",
          hidden: previewEnabled ? null : "",
        },
        el("p", { class: "oep-discussion-preview__title" }, "Post preview"),
        el("div", { class: "oep-discussion-preview__body" }),
      );
      const anchor =
        textarea.closest(".beatmap-discussion-new__message") ||
        textarea.parentElement ||
        composerRoot;
      anchor.insertAdjacentElement("afterend", preview);
    }

    const body = preview.querySelector(".oep-discussion-preview__body");
    if (!(body instanceof HTMLElement)) return;
    const repaint = () => {
      const visibleNow = isVisibleTextarea(textarea);
      const hasTextNow = String(textarea.value || "").trim().length > 0;
      const source = String(textarea.value || "");
      if (source.trim()) {
        body.replaceChildren(
          sanitizeTree(renderMarkdown(source, { document })),
        );
      } else {
        body.replaceChildren(
          el(
            "p",
            { class: "oep-discussion-preview__empty" },
            "Nothing to preview yet.",
          ),
        );
      }
      if (isReplyComposer && !visibleNow) {
        helper.remove();
        toggleBtn.hidden = true;
        preview.hidden = true;
        return;
      }
      helper.hidden = false;
      toggleBtn.hidden = !hasTextNow;
      preview.hidden = !hasTextNow || !previewEnabled;
    };

    toggleBtn.addEventListener("click", () => {
      previewEnabled = !previewEnabled;
      toggleBtn?.setAttribute(
        "aria-pressed",
        previewEnabled ? "true" : "false",
      );
      repaint();
    });
    textarea.addEventListener("input", repaint);
    repaint();
  }

  /** Remove helpers outside a visible reply/new-discussion shell (e.g. stuck before Respond). */
  function pruneDetachedMarkdownHelpers() {
    document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const replyShell =
        node.closest(".beatmap-discussion-post--new-reply") ||
        node.closest(".beatmap-discussion-reply-box");
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

  /** After helper teardown, textarea may still be marked; re-bind when Respond is open again. */
  function reviveReplyPreviewIfNeeded() {
    document.querySelectorAll(`textarea[${MARKER_ATTR}]`).forEach((ta) => {
      if (!(ta instanceof HTMLTextAreaElement) || !ta.isConnected) return;
      const replyRoot =
        ta.closest(".beatmap-discussion-post--new-reply") ||
        ta.closest(".beatmap-discussion-reply-box");
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
      document
        .querySelectorAll(`textarea[${MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(MARKER_ATTR));
      document
        .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
        .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
      return;
    }
    const textareas = collectCandidateTextareas();
    for (const ta of textareas) bindTextareaPreview(ta);
    // Keep placement stable when reply footer is re-rendered on collapse/expand.
    document.querySelectorAll(`[${ROOT_MARKER_ATTR}]`).forEach((root) => {
      if (!(root instanceof HTMLElement)) return;
      const ta =
        Array.from(root.querySelectorAll("textarea")).find((node) =>
          isVisibleTextarea(node),
        ) || root.querySelector("textarea");
      const btn = root.querySelector(`[${TOGGLE_ATTR}]`);
      const preview = root.querySelector(`[${PREVIEW_ATTR}]`);
      const extraHelpers = root.querySelectorAll(`[${HELPER_ATTR}]`);
      if (extraHelpers.length > 1) {
        Array.from(extraHelpers)
          .slice(1)
          .forEach((n) => n.remove());
      }
      const helper = root.querySelector(`[${HELPER_ATTR}]`);
      if (!(btn instanceof HTMLElement)) return;
      const isReplyComposer =
        root.classList.contains("beatmap-discussion-post--new-reply") ||
        root.classList.contains("beatmap-discussion-reply-box");
      const isNewDiscussionRoot = root.classList.contains(
        "beatmap-discussion-new",
      );
      const hasTextNow =
        ta instanceof HTMLTextAreaElement &&
        String(ta.value || "").trim().length > 0;
      // Guarded writes: `hidden` is in the observer's attributeFilter, and
      // re-assigning the same value still records a mutation (idle loop).
      if (isReplyComposer && !isVisibleTextarea(ta)) {
        setHiddenIfChanged(btn, true);
        if (preview instanceof HTMLElement) setHiddenIfChanged(preview, true);
        if (helper instanceof HTMLElement) helper.remove();
        return;
      }
      if ((isReplyComposer || isNewDiscussionRoot) && !hasTextNow) {
        setHiddenIfChanged(btn, true);
        if (preview instanceof HTMLElement) setHiddenIfChanged(preview, true);
        if (helper instanceof HTMLElement) setHiddenIfChanged(helper, false);
        return;
      }
      if (helper instanceof HTMLElement) setHiddenIfChanged(helper, false);
      setHiddenIfChanged(btn, false);
      placeDiscussionPreviewToggle(
        root,
        btn,
        ta instanceof HTMLTextAreaElement ? ta : null,
      );
    });
    pruneDetachedMarkdownHelpers();
    reviveReplyPreviewIfNeeded();
  };

  let debounceTimer = 0;
  const schedule = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 80);
  };

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"],
  });
  schedule();

  return () => {
    window.clearTimeout(debounceTimer);
    obs.disconnect();
    document.querySelectorAll(`[${TOGGLE_ATTR}]`).forEach((n) => n.remove());
    document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((n) => n.remove());
    document.querySelectorAll(`[${HELPER_ATTR}]`).forEach((n) => n.remove());
    document
      .querySelectorAll(`textarea[${MARKER_ATTR}]`)
      .forEach((n) => n.removeAttribute(MARKER_ATTR));
    document
      .querySelectorAll(`[${ROOT_MARKER_ATTR}]`)
      .forEach((n) => n.removeAttribute(ROOT_MARKER_ATTR));
  };
}
