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
    "KeyboardEvent",
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

/** Counts the document's live mousemove/mouseup listeners. */
function trackDocumentListeners(doc) {
  const live = new Set();
  const add = doc.addEventListener.bind(doc);
  const remove = doc.removeEventListener.bind(doc);
  doc.addEventListener = (type, fn, opts) => {
    if (type === "mousemove" || type === "mouseup") live.add(`${type}`);
    add(type, fn, opts);
  };
  doc.removeEventListener = (type, fn, opts) => {
    if (type === "mousemove" || type === "mouseup") live.delete(`${type}`);
    remove(type, fn, opts);
  };
  return live;
}

function openImagemap(doc) {
  const button = [...doc.querySelectorAll(".oep-bbhelp__btn")].find(
    (b) => b.title === "Open ImageMap helper",
  );
  button.click();
  return doc.querySelector(".oep-bbhelp-modal");
}

test("imagemap modal drops its document listeners on Cancel and on page change (B49)", async () => {
  const window = setup(EDITOR);
  const { startBbcodeHelperManager } =
    await import("../../src/editor/bbcode-helper/manager.js");
  const doc = window.document;
  const live = trackDocumentListeners(doc);
  const stop = startBbcodeHelperManager();
  try {
    const modal = openImagemap(doc);
    assert.ok(modal);
    assert.deepEqual([...live].sort(), ["mousemove", "mouseup"]);
    [...modal.querySelectorAll("button")]
      .find((b) => b.textContent === "Cancel")
      .click();
    assert.equal(doc.querySelector(".oep-bbhelp-modal"), null);
    assert.equal(live.size, 0);

    openImagemap(doc);
    assert.equal(live.size, 2);
  } finally {
    stop();
  }
  // Leaving the page with the modal open.
  assert.equal(doc.querySelector(".oep-bbhelp-modal"), null);
  assert.equal(live.size, 0);
});

function key(window, target, k) {
  target.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: k, bubbles: true }),
  );
}

test("colour picker: Enter on Cancel cancels, only hex or names apply", async () => {
  const window = setup(EDITOR);
  const { openColorPicker } =
    await import("../../src/editor/bbcode-helper/pickers.js");
  const doc = window.document;
  const ta = doc.querySelector("textarea");
  ta.value = "hi";
  ta.setSelectionRange(0, 2);

  openColorPicker(ta);
  let modal = doc.querySelector(".oep-bbhelp-modal");
  const cancel = [...modal.querySelectorAll("button")].find(
    (b) => b.textContent === "Cancel",
  );
  key(window, cancel, "Enter");
  assert.equal(ta.value, "hi", "Enter on Cancel does not apply");

  modal.remove();
  openColorPicker(ta);
  modal = doc.querySelector(".oep-bbhelp-modal");
  const text = modal.querySelector('input[type="text"]');
  text.value = "red;position:fixed";
  key(window, text, "Enter");
  assert.equal(ta.value, "hi");
  assert.equal(text.getAttribute("aria-invalid"), "true");
  assert.ok(doc.querySelector(".oep-bbhelp-modal"), "stays open");

  // osu-web renders only #RRGGBB or a name (B98)
  for (const bad of ["#abc", "#aabbccdd"]) {
    text.value = bad;
    text.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(text.hasAttribute("aria-invalid"), false);
    key(window, text, "Enter");
    assert.equal(ta.value, "hi", bad);
    assert.equal(text.getAttribute("aria-invalid"), "true");
  }

  text.value = "#aabbcc";
  text.dispatchEvent(new window.Event("input", { bubbles: true }));
  key(window, text, "Enter");
  assert.equal(ta.value, "[color=#aabbcc]hi[/color]");
  assert.equal(doc.querySelector(".oep-bbhelp-modal"), null);
});

test("size picker: presets insert osu-web's numeric sizes (B98)", async () => {
  const window = setup(EDITOR);
  const { openSizePicker } =
    await import("../../src/editor/bbcode-helper/pickers.js");
  const doc = window.document;
  const ta = doc.querySelector("textarea");
  const apply = () =>
    [...doc.querySelectorAll(".oep-bbhelp-modal button")]
      .find((b) => b.textContent === "Apply")
      .click();

  ta.value = "hi";
  ta.setSelectionRange(0, 2);
  openSizePicker(ta);
  const select = doc.querySelector(".oep-bbhelp-modal select");
  assert.deepEqual(
    [...select.options].map((o) => o.value),
    ["50", "85", "100", "150"],
  );
  assert.equal(select.value, "100");
  apply();
  assert.equal(ta.value, "[size=100]hi[/size]");

  ta.value = "hi";
  ta.setSelectionRange(0, 2);
  openSizePicker(ta);
  doc.querySelector(".oep-bbhelp-modal select").value = "150";
  apply();
  assert.equal(ta.value, "[size=150]hi[/size]");
});
