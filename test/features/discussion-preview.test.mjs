import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const URL_TOTAL =
  "https://osu.ppy.sh/beatmapsets/1/discussion/-/generalAll/total";

/**
 * jsdom window with OsuExpertPlus.dom, exposed as globals for the ES module
 * (it reads `document`, `location`, `HTMLElement`, … at call time).
 * Textareas count as visible unless they carry `data-hidden`.
 */
function setup(html) {
  const { window } = loadScripts(["src/utils/dom.js"], { url: URL_TOTAL });
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLTextAreaElement",
    "HTMLButtonElement",
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
  window.HTMLTextAreaElement.prototype.getBoundingClientRect = function () {
    const size = this.hasAttribute("data-hidden") ? 0 : 100;
    return { width: size, height: size, top: 0, left: 0, right: 0, bottom: 0 };
  };
  window.document.body.innerHTML = html;
  return window;
}

const REPLY = `
  <div data-react="beatmap-discussions">
    <div class="beatmap-discussion-post beatmap-discussion-post--new-reply" id="reply">
      <div class="beatmap-discussion-post__message-container"><textarea></textarea></div>
      <div class="beatmap-discussion-post__footer">
        <div class="beatmap-discussion-post__actions-group"><button>Reply</button></div>
      </div>
    </div>
    <div class="beatmap-discussion-new" id="new">
      <div class="beatmap-discussion-new__message"><textarea></textarea></div>
      <div class="beatmap-discussion-new__footer"></div>
    </div>
  </div>`;

/** Past the preview manager's 80 ms debounce. */
const settle = () => new Promise((r) => setTimeout(r, 150));

function type(window, textarea, value) {
  textarea.value = value;
  textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
}

test("toggle keeps working after the reply box is closed and reopened (B55)", async () => {
  const window = setup(REPLY);
  const { startDiscussionPreview } =
    await import("../../src/features/discussion/preview.js");
  const doc = window.document;
  const reply = doc.getElementById("reply");
  const ta = reply.querySelector("textarea");
  const stop = startDiscussionPreview(1);
  try {
    await settle();
    const toggle = reply.querySelector("[data-oep-discussion-preview-toggle]");
    const preview = reply.querySelector("[data-oep-discussion-preview]");
    assert.ok(toggle && preview, "toggle and preview mounted");
    assert.ok(reply.querySelector("[data-oep-markdown-helper]"));

    type(window, ta, "**hi**");
    assert.equal(toggle.hidden, false);
    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    assert.equal(preview.hidden, false);
    assert.equal(
      preview.querySelector(".oep-discussion-preview__body").innerHTML,
      "<p><strong>hi</strong></p>",
    );

    // Close the reply box: helper goes away, toggle and preview hide.
    ta.setAttribute("data-hidden", "");
    reply.setAttribute("class", reply.getAttribute("class") + " x");
    await settle();
    assert.equal(reply.querySelector("[data-oep-markdown-helper]"), null);
    assert.equal(toggle.hidden, true);

    // Reopen: the helper comes back and the same toggle flips exactly once.
    ta.removeAttribute("data-hidden");
    reply.setAttribute("class", reply.getAttribute("class") + " y");
    await settle();
    assert.ok(reply.querySelector("[data-oep-markdown-helper]"));
    assert.equal(
      reply.querySelectorAll("[data-oep-discussion-preview-toggle]").length,
      1,
    );
    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "false");
    assert.equal(preview.hidden, true);
    toggle.click();
    assert.equal(toggle.getAttribute("aria-pressed"), "true");
    assert.equal(preview.hidden, false);
  } finally {
    stop();
  }
  assert.equal(doc.querySelector("[data-oep-discussion-preview-toggle]"), null);
  assert.equal(doc.querySelector("[data-oep-markdown-helper]"), null);
});

test("each composer has its own preview state (B55)", async () => {
  const window = setup(REPLY);
  const { startDiscussionPreview } =
    await import("../../src/features/discussion/preview.js");
  const doc = window.document;
  const stop = startDiscussionPreview(1);
  try {
    await settle();
    const reply = doc.getElementById("reply");
    const fresh = doc.getElementById("new");
    type(window, reply.querySelector("textarea"), "a");
    type(window, fresh.querySelector("textarea"), "b");
    reply.querySelector("[data-oep-discussion-preview-toggle]").click();
    assert.equal(
      reply.querySelector("[data-oep-discussion-preview]").hidden,
      false,
    );
    const freshToggle = fresh.querySelector(
      "[data-oep-discussion-preview-toggle]",
    );
    assert.equal(freshToggle.getAttribute("aria-pressed"), "false");
    // Repaint the other composer: it must not pick up the first one's state.
    type(window, fresh.querySelector("textarea"), "bc");
    assert.equal(
      fresh.querySelector("[data-oep-discussion-preview]").hidden,
      true,
    );
    // Empty state is built by the caller now that the renderer returns nothing.
    type(window, fresh.querySelector("textarea"), "  ");
    assert.equal(
      fresh.querySelector(".oep-discussion-preview__body").textContent,
      "Nothing to preview yet.",
    );
  } finally {
    stop();
  }
});

test("nothing is mounted for another set or the reviews tab", async () => {
  const window = setup(REPLY);
  const { startDiscussionPreview } =
    await import("../../src/features/discussion/preview.js");
  const stop = startDiscussionPreview(2);
  try {
    await settle();
    assert.equal(
      window.document.querySelector("[data-oep-markdown-helper]"),
      null,
    );
  } finally {
    stop();
  }
});
