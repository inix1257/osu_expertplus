import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findBbcodeCancelButton,
  placeBbcodePreviewToggle,
  placeDiscussionPreviewToggle,
} from "../../src/editor/preview-toggle.js";
import { LEGACY_DISCUSSION, USER_PROFILE, legacyFn } from "../osu/legacy.mjs";
import { setupWindow } from "./helpers.mjs";

const { window, document } = setupWindow();

const oldFindCancel = legacyFn(USER_PROFILE, "_findCancelActionNode", {
  HTMLElement: window.HTMLElement,
});
const oldPlaceDiscussion = legacyFn(
  LEGACY_DISCUSSION,
  "placePreviewToggleButton",
  {
    HTMLElement: window.HTMLElement,
  },
);

/** osu-web resources/js/components/bbcode-editor.tsx (labels vary by locale). */
function bbcodeEditor({ cancel, hide, show, save }) {
  document.body.innerHTML = `
    <div class="account-edit">
      <form class="bbcode-editor js-bbcode-preview--form" data-state="write">
        <div class="bbcode-editor__content">
          <textarea class="bbcode-editor__body js-bbcode-preview--body" name="body"></textarea>
          <div class="bbcode-editor__preview"><div class="forum-post-content js-bbcode-preview--preview"></div></div>
          <div class="bbcode-editor__buttons-bar">
            <div class="bbcode-editor__buttons bbcode-editor__buttons--toolbar">
              <div class="post-box-toolbar"><button class="btn-circle btn-circle--bbcode js-bbcode-btn--bold" type="button"></button></div>
            </div>
            <div class="bbcode-editor__buttons bbcode-editor__buttons--actions">
              <div class="bbcode-editor__button bbcode-editor__button--cancel"><button class="btn-osu-big btn-osu-big--forum-secondary" type="button">${cancel}</button></div>
              <div class="bbcode-editor__button bbcode-editor__button--hide-on-write"><button class="js-bbcode-preview--hide btn-osu-big btn-osu-big--forum-secondary" type="button">${hide}</button></div>
              <div class="bbcode-editor__button bbcode-editor__button--hide-on-preview"><button class="js-bbcode-preview--show btn-osu-big btn-osu-big--forum-secondary" type="button">${show}</button></div>
              <div class="bbcode-editor__button"><button class="btn-osu-big btn-osu-big--forum-primary" type="button">${save}</button></div>
            </div>
          </div>
        </div>
      </form>
    </div>`;
  const editorEl = document.querySelector(".bbcode-editor");
  return { editorEl, textarea: editorEl.querySelector("textarea") };
}

const EN = {
  cancel: "Cancel",
  hide: "Hide preview",
  show: "Preview",
  save: "Save",
};
const KO = {
  cancel: "취소",
  hide: "미리보기 숨기기",
  show: "미리보기",
  save: "저장",
};

function toggleButton() {
  const btn = document.createElement("button");
  btn.textContent = "Live preview";
  return btn;
}

test("me! editor: English markup, same cancel button as the old lookup", () => {
  const { editorEl, textarea } = bbcodeEditor(EN);
  const old = oldFindCancel(editorEl, textarea);
  assert.ok(old);
  assert.equal(findBbcodeCancelButton(editorEl, textarea), old);
});

test("me! editor: non-English markup still finds the cancel button (B45)", () => {
  const { editorEl, textarea } = bbcodeEditor(KO);
  assert.equal(oldFindCancel(editorEl, textarea), null);
  const cancel = findBbcodeCancelButton(editorEl, textarea);
  assert.equal(cancel?.textContent, "취소");

  const btn = toggleButton();
  assert.equal(placeBbcodePreviewToggle(editorEl, textarea, btn), "cancel");
  assert.equal(btn.nextElementSibling, cancel);
  assert.ok(btn.parentElement.matches(".bbcode-editor__button--cancel"));
  // Idempotent: no move when already in place.
  const observer = [];
  const mo = new window.MutationObserver((r) => observer.push(...r));
  mo.observe(document.body, { childList: true, subtree: true });
  placeBbcodePreviewToggle(editorEl, textarea, btn);
  assert.deepEqual(mo.takeRecords(), []);
  mo.disconnect();
});

test("me! editor: fallbacks (actions bar, English label, nothing)", () => {
  let { editorEl, textarea } = bbcodeEditor(KO);
  editorEl.querySelector(".bbcode-editor__button--cancel").remove();
  const btn = toggleButton();
  assert.equal(placeBbcodePreviewToggle(editorEl, textarea, btn), "actions");
  assert.equal(
    editorEl.querySelector(".bbcode-editor__buttons--actions")
      .firstElementChild,
    btn,
  );

  document.body.innerHTML = `<form class="bbcode-editor"><textarea></textarea><div><a href="#">Cancel</a></div></form>`;
  editorEl = document.querySelector(".bbcode-editor");
  textarea = editorEl.querySelector("textarea");
  const legacyLabel = findBbcodeCancelButton(editorEl, textarea);
  assert.equal(legacyLabel?.localName, "a");
  assert.equal(placeBbcodePreviewToggle(editorEl, textarea, btn), "cancel");
  assert.equal(btn.nextElementSibling, legacyLabel);

  document.body.innerHTML = `<form class="bbcode-editor"><textarea></textarea></form>`;
  editorEl = document.querySelector(".bbcode-editor");
  const lone = toggleButton();
  assert.equal(placeBbcodePreviewToggle(editorEl, null, lone), null);
  assert.equal(lone.parentElement, null);
});

/** osu-web beatmap-discussions/new-reply.tsx */
function replyComposer({ reply, resolve }) {
  document.body.innerHTML = `
    <div data-react="beatmap-discussions"><div class="beatmap-discussion">
      <div class="beatmap-discussion-post beatmap-discussion-post--reply beatmap-discussion-post--new-reply">
        <button class="beatmap-discussion-post__action beatmap-discussion-post__action--cancel"><i class="fas fa-times"></i></button>
        <div class="beatmap-discussion-post__content">
          <div class="beatmap-discussion-post__avatar"></div>
          <div class="beatmap-discussion-post__message-container"><textarea class="beatmap-discussion-post__message beatmap-discussion-post__message--editor"></textarea></div>
        </div>
        <div class="beatmap-discussion-post__footer beatmap-discussion-post__footer--notice">notice</div>
        <div class="beatmap-discussion-post__footer">
          <div class="beatmap-discussion-post__actions">
            <div class="beatmap-discussion-post__actions-group">
              <div class="beatmap-discussion-post__action"><button class="btn-osu-big" data-action="reply_resolve" type="button"><span class="btn-osu-big__text-top">${resolve}</span></button></div>
              <div class="beatmap-discussion-post__action"><button class="btn-osu-big" data-action="reply" type="button"><span class="btn-osu-big__text-top">${reply}</span></button></div>
            </div>
          </div>
        </div>
      </div>
    </div></div>`;
  const root = document.querySelector(".beatmap-discussion-post--new-reply");
  return { root, textarea: root.querySelector("textarea") };
}

/** osu-web beatmap-discussions/new-discussion.tsx */
function newDiscussion({ note, praise }) {
  const noteButton =
    note === null
      ? ""
      : `<button class="btn-osu-big" data-type="mapper_note" type="button"><span>${note}</span></button>`;
  document.body.innerHTML = `
    <div data-react="beatmap-discussions">
      <div class="beatmap-discussion-new">
        <div class="page-title">Title<span class="page-title__button"><button class="btn-circle"><span class="btn-circle__content"></span></button></span></div>
        <div class="beatmap-discussion-new__content">
          <div class="beatmap-discussion-new__avatar"></div>
          <div class="beatmap-discussion-new__message" id="new"><textarea class="beatmap-discussion-new__message-area js-hype--input"></textarea></div>
        </div>
        <div class="beatmap-discussion-new__footer">
          <div class="beatmap-discussion-new__footer-content">timestamp</div>
          <div class="beatmap-discussion-new__footer-content beatmap-discussion-new__footer-content--right">
            ${noteButton}
            <button class="btn-osu-big" data-type="praise" type="button"><span>${praise}</span></button>
            <button class="btn-osu-big" data-type="suggestion" type="button"><span>s</span></button>
            <button class="btn-osu-big" data-type="problem" type="button"><span>p</span></button>
          </div>
        </div>
      </div>
    </div>`;
  const root = document.querySelector(".beatmap-discussion-new");
  return { root, textarea: root.querySelector("textarea") };
}

/** Run old and new placement on fresh copies of the same markup. */
function compare(build, args) {
  const a = build(args);
  const oldBtn = toggleButton();
  oldPlaceDiscussion(a.root, oldBtn, a.textarea);
  const oldSpot = [
    oldBtn.parentElement?.className,
    oldBtn.nextElementSibling?.outerHTML,
  ];
  const b = build(args);
  const newBtn = toggleButton();
  const branch = placeDiscussionPreviewToggle(b.root, newBtn, b.textarea);
  const newSpot = [
    newBtn.parentElement?.className,
    newBtn.nextElementSibling?.outerHTML,
  ];
  return { oldSpot, newSpot, branch, newBtn };
}

test("discussion reply composer: same spot as before in English, also in Korean", () => {
  const en = compare(replyComposer, {
    reply: "Reply",
    resolve: "Reply and Resolve",
  });
  assert.equal(en.branch, "reply");
  assert.deepEqual(en.newSpot, en.oldSpot);
  assert.equal(en.newSpot[0], "beatmap-discussion-post__actions-group");

  const ko = compare(replyComposer, { reply: "답글", resolve: "답글 및 해결" });
  assert.equal(ko.branch, "reply");
  assert.deepEqual(
    ko.newSpot,
    en.newSpot.map((s, i) =>
      i ? s.replace("Reply and Resolve", "답글 및 해결") : s,
    ),
  );
  // The old lookup fell through to the generic footer in Korean.
  assert.notDeepEqual(ko.oldSpot, ko.newSpot);
});

test("new discussion: note group when there is a note button, else the footer", () => {
  const en = compare(newDiscussion, { note: "Note", praise: "Praise" });
  assert.equal(en.branch, "note");
  assert.deepEqual(en.newSpot, en.oldSpot);
  assert.match(en.newSpot[0], /footer-content--right/);

  const ko = compare(newDiscussion, { note: "노트", praise: "칭찬" });
  assert.equal(ko.branch, "note");
  assert.match(ko.newSpot[0], /footer-content--right/);
  assert.match(ko.oldSpot[0], /^beatmap-discussion-new__footer$/);

  const noNote = compare(newDiscussion, { note: null, praise: "Praise" });
  assert.equal(noNote.branch, "footer");
  assert.deepEqual(noNote.newSpot, noNote.oldSpot);
});

test("discussion: text and textarea fallbacks", () => {
  document.body.innerHTML = `<div class="beatmap-discussion-reply-box"><div class="x"><button>Reply</button></div><textarea></textarea></div>`;
  let root = document.querySelector(".beatmap-discussion-reply-box");
  let btn = toggleButton();
  assert.equal(
    placeDiscussionPreviewToggle(root, btn, root.querySelector("textarea")),
    "reply",
  );
  assert.equal(btn.parentElement.className, "x");

  document.body.innerHTML = `<div class="beatmap-discussion-new"><div class="beatmap-discussion-new__message"><textarea></textarea></div></div>`;
  root = document.querySelector(".beatmap-discussion-new");
  btn = toggleButton();
  const textarea = root.querySelector("textarea");
  assert.equal(placeDiscussionPreviewToggle(root, btn, textarea), "textarea");
  assert.equal(btn.parentElement.className, "beatmap-discussion-new__message");
  // Already placed: left alone.
  assert.equal(placeDiscussionPreviewToggle(root, btn, textarea), null);
  document.body.replaceChildren();
});
