/**
 * Where the preview toggle buttons go, found from osu-web's markup instead
 * of English button labels (B45). The old code looked for a button whose
 * text was "cancel" (me! editor) or "reply"/"respond"/"response"/"Note"
 * (discussion composer), so on a non-English site the toggle never appeared
 * (me!) or fell back to a worse spot (discussion).
 *
 * Structure used (osu-web `resources/js/components/bbcode-editor.tsx`,
 * `beatmap-discussions/new-reply.tsx`, `new-discussion.tsx`):
 * - me! editor: `form.bbcode-editor … .bbcode-editor__buttons--actions >
 *   .bbcode-editor__button--cancel > button`. The toggle goes right before
 *   that button (same spot as before).
 * - reply composer: `.beatmap-discussion-post--new-reply …
 *   .beatmap-discussion-post__actions-group` holds the reply buttons
 *   (`button[data-action]`). The toggle becomes its first child.
 * - new discussion: `.beatmap-discussion-new__footer` with the type buttons
 *   (`button[data-type]`); the "Note" button is `[data-type="mapper_note"]`.
 *   As before, the toggle goes first in the note button's group when there
 *   is one, else first in the footer.
 *
 * The English text lookups are kept only as a last fallback.
 */

/** @param {unknown} node */
function isElement(node) {
  return !!node && /** @type {Node} */ (node).nodeType === 1;
}

/**
 * @param {Element} anchor
 * @param {Element} child
 */
function moveBefore(anchor, child) {
  const parent = anchor.parentElement;
  if (!parent) return;
  if (child.parentElement === parent && child.nextElementSibling === anchor) {
    return;
  }
  anchor.insertAdjacentElement("beforebegin", child);
}

/**
 * @param {Element} parent
 * @param {Element} child
 */
function moveFirst(parent, child) {
  if (child.parentElement === parent && parent.firstElementChild === child) {
    return;
  }
  parent.prepend(child);
}

/**
 * @param {Element} scope
 * @param {(label: string) => boolean} test
 * @param {string} [selector]
 */
function findByLabel(scope, test, selector = "button, a", exclude = null) {
  for (const node of Array.from(scope.querySelectorAll(selector))) {
    if (node === exclude) continue;
    if (test(String(node.textContent || "").trim())) return node;
  }
  return null;
}

/**
 * The me! editor's cancel button.
 * @param {Element} editorEl `.bbcode-editor` (osu-web renders it as the form)
 * @param {HTMLTextAreaElement | null} [textarea]
 * @param {Element | null} [exclude] never returned (the toggle itself, once
 *   it sits next to the cancel button)
 * @returns {Element | null}
 */
export function findBbcodeCancelButton(editorEl, textarea, exclude = null) {
  const scopes = [
    editorEl,
    textarea?.closest("form"),
    editorEl.closest("form"),
    editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
    editorEl.parentElement,
  ].filter(isElement);
  for (const scope of scopes) {
    const wrap = scope.matches(".bbcode-editor__button--cancel")
      ? scope
      : scope.querySelector(".bbcode-editor__button--cancel");
    if (wrap) {
      const button = wrap.matches("button, a")
        ? wrap
        : Array.from(wrap.querySelectorAll("button, a")).find(
            (n) => n !== exclude,
          );
      if (button) return button;
    }
  }
  for (const scope of scopes) {
    const button = findByLabel(
      scope,
      (l) => l.toLowerCase() === "cancel",
      "button, a",
      exclude,
    );
    if (button) return button;
  }
  return null;
}

/**
 * Put the me! editor's preview toggle before the cancel button, or first in
 * the actions bar when there is no cancel button.
 * @param {Element} editorEl
 * @param {HTMLTextAreaElement | null} textarea
 * @param {Element} toggleBtn
 * @returns {"cancel" | "actions" | null} where it went (null: not placed)
 */
export function placeBbcodePreviewToggle(editorEl, textarea, toggleBtn) {
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

const REPLY_LABELS = new Set(["reply", "respond", "response"]);

/**
 * Put the discussion preview toggle into the composer, mirroring the old
 * `placePreviewToggleButton` order: reply group, note group, footer, then
 * (only if the toggle is not in the document yet) above the textarea.
 * @param {Element} composerRoot
 * @param {Element} toggleBtn
 * @param {HTMLTextAreaElement | null} [textarea]
 * @returns {"reply" | "note" | "footer" | "textarea" | null} the branch used
 */
export function placeDiscussionPreviewToggle(
  composerRoot,
  toggleBtn,
  textarea,
) {
  const buttons = "button, [role='button']";
  const groupOf = (button) =>
    button.closest(".beatmap-discussion-post__actions-group") ||
    button.parentElement;

  const replyGroup = composerRoot.querySelector(
    ".beatmap-discussion-post__actions-group",
  );
  const replyButton =
    replyGroup ||
    composerRoot.querySelector("button[data-action]") ||
    findByLabel(
      composerRoot,
      (l) => REPLY_LABELS.has(l.toLowerCase()),
      buttons,
    );
  if (replyButton) {
    const group = replyGroup || groupOf(replyButton);
    if (group) {
      moveFirst(group, toggleBtn);
      return "reply";
    }
  }

  const noteButton =
    composerRoot.querySelector('[data-type="mapper_note"]') ||
    findByLabel(composerRoot, (l) => l === "Note", buttons);
  if (noteButton) {
    const group = groupOf(noteButton);
    if (group) {
      moveFirst(group, toggleBtn);
      return "note";
    }
  }

  const footer =
    composerRoot.querySelector(".beatmap-discussion-new__footer") ||
    composerRoot.querySelector("[class*='footer']") ||
    composerRoot.querySelector("[class*='actions']");
  if (footer) {
    if (toggleBtn.parentElement !== footer) moveFirst(footer, toggleBtn);
    return "footer";
  }

  if (!toggleBtn.parentElement) {
    const anchor =
      textarea?.closest(".beatmap-discussion-new__message") ||
      textarea?.parentElement ||
      composerRoot;
    moveFirst(anchor, toggleBtn);
    return "textarea";
  }
  return null;
}
