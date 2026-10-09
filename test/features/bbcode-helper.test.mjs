import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

/**
 * jsdom window with OsuExpertPlus.dom, exposed as globals for the ES modules
 * (they read `document`, `window`, `HTMLElement`, … at call time). Elements
 * count as visible unless they (or an ancestor) carry `data-hidden`.
 */
function setup(html) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/users/2",
  });
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLTextAreaElement",
    "HTMLButtonElement",
    "HTMLInputElement",
    "MutationObserver",
    "Event",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  window.HTMLElement.prototype.getClientRects = function () {
    return this.closest("[data-hidden]") ? [] : [{}];
  };
  window.document.body.innerHTML = html;
  return window;
}

/** osu-web's me! editor (`bbcode-editor.tsx`), with a non-English label. */
const EDITOR = `
  <div class="page-extra--userpage">
    <form class="bbcode-editor" id="editor">
      <div class="bbcode-editor__content">
        <textarea class="bbcode-editor__body"></textarea>
      </div>
      <div class="bbcode-editor__footer">
        <div class="bbcode-editor__buttons bbcode-editor__buttons--actions">
          <div class="bbcode-editor__button bbcode-editor__button--cancel"><button type="button">취소</button></div>
          <div class="bbcode-editor__button"><button type="submit">저장</button></div>
        </div>
      </div>
    </form>
  </div>`;

/** Past the preview's 70 ms input debounce. */
const settle = () => new Promise((r) => setTimeout(r, 120));

function type(window, textarea, value) {
  textarea.value = value;
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function counts(doc) {
  return {
    toolbars: doc.querySelectorAll(".oep-bbhelp").length,
    toggles: doc.querySelectorAll("[data-oep-bbhelp-preview-toggle]").length,
    previews: doc.querySelectorAll("section[data-oep-bbhelp-preview]").length,
    warnings: doc.querySelectorAll(".oep-bbhelp-warn").length,
  };
}

const ONE_EACH = { toolbars: 1, toggles: 1, previews: 1, warnings: 1 };

test("toggle sits before osu-web's cancel button on a non-English page (B45)", async () => {
  const window = setup(EDITOR);
  const { startBbcodeHelperManager } =
    await import("../../src/editor/bbcode-helper/manager.js");
  const doc = window.document;
  const stop = startBbcodeHelperManager();
  try {
    assert.deepEqual(counts(doc), ONE_EACH);
    const toggle = doc.querySelector("[data-oep-bbhelp-preview-toggle]");
    const cancelWrap = doc.querySelector(".bbcode-editor__button--cancel");
    assert.equal(toggle.parentElement, cancelWrap);
    assert.equal(toggle.nextElementSibling.textContent, "취소");
    assert.ok(doc.getElementById("osu-expertplus-userpage-bbcode-helper"));
  } finally {
    stop();
  }
  assert.deepEqual(counts(doc), {
    toolbars: 0,
    toggles: 0,
    previews: 0,
    warnings: 0,
  });
  assert.equal(
    doc.getElementById("osu-expertplus-userpage-bbcode-helper"),
    null,
  );
});

test("preview renders only while shown, after the input debounce", async () => {
  const window = setup(EDITOR);
  const { startBbcodeHelperManager } =
    await import("../../src/editor/bbcode-helper/manager.js");
  const doc = window.document;
  const ta = doc.querySelector("textarea");
  const stop = startBbcodeHelperManager();
  try {
    const toggle = doc.querySelector("[data-oep-bbhelp-preview-toggle]");
    const preview = doc.querySelector("section[data-oep-bbhelp-preview]");
    const body = preview.querySelector(".oep-bbhelp-preview__body");
    type(window, ta, "[b]hi[/b]");
    await settle();
    assert.equal(preview.hidden, true);
    assert.equal(body.innerHTML, "", "nothing rendered while hidden");

    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    assert.equal(preview.hidden, false);
    assert.equal(body.innerHTML, "<p><strong>hi</strong></p>");

    type(window, ta, "[i]x[/i]");
    assert.equal(body.innerHTML, "<p><strong>hi</strong></p>", "debounced");
    await settle();
    assert.equal(body.innerHTML, "<p><em>x</em></p>");

    type(window, ta, "  ");
    await settle();
    assert.equal(
      body.innerHTML,
      '<p class="oep-bbhelp-preview__empty">Nothing to preview yet.</p>',
    );
  } finally {
    stop();
  }
});

test("restarting the helper does not stack listeners or toggles (B50)", async () => {
  const window = setup(EDITOR);
  const { startBbcodeHelperManager } =
    await import("../../src/editor/bbcode-helper/manager.js");
  const doc = window.document;
  const ta = doc.querySelector("textarea");

  startBbcodeHelperManager()();
  const stop = startBbcodeHelperManager();
  try {
    assert.deepEqual(counts(doc), ONE_EACH);
    // React re-renders part of the editor: the scan runs again.
    doc
      .querySelector(".bbcode-editor__content")
      .append(doc.createElement("textarea"));
    await settle();
    assert.deepEqual(counts(doc), ONE_EACH);

    // One click flips the toggle exactly once.
    const toggle = doc.querySelector("[data-oep-bbhelp-preview-toggle]");
    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "false");

    // The warning follows the text through one live listener.
    const warn = doc.querySelector(".oep-bbhelp-warn");
    type(window, ta, "[b]open");
    assert.equal(warn.hidden, false);
    assert.match(warn.textContent, /Unclosed tag `\[b\]`/);
    type(window, ta, "[b]closed[/b]");
    assert.equal(warn.hidden, true);
    // Before B50 the first run's input listener put its own (removed)
    // toggle back next to the cancel button.
    await settle();
    assert.deepEqual(counts(doc), ONE_EACH);
  } finally {
    stop();
  }
  // Both runs' listeners are gone: typing brings nothing back.
  type(window, ta, "[b]open");
  await settle();
  assert.deepEqual(counts(doc), {
    toolbars: 0,
    toggles: 0,
    previews: 0,
    warnings: 0,
  });
});

test("an editor that goes away loses its toolbar; showing it again re-adds one", async () => {
  const window = setup(EDITOR);
  const { startBbcodeHelperManager } =
    await import("../../src/editor/bbcode-helper/manager.js");
  const doc = window.document;
  const stop = startBbcodeHelperManager();
  try {
    const form = doc.getElementById("editor");
    const parent = form.parentElement;
    form.remove();
    await settle();
    assert.equal(doc.querySelectorAll(".oep-bbhelp").length, 0);
    parent.append(form);
    await settle();
    assert.deepEqual(counts(doc), ONE_EACH);
  } finally {
    stop();
  }
});
