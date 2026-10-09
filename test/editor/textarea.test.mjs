import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceRange, toggleWrap } from "../../src/editor/textarea.js";
import { LEGACY_BBCODE, legacyFn } from "../osu/legacy.mjs";
import { setupWindow } from "./helpers.mjs";

const { window, document } = setupWindow();

function makeTextarea(value, start, end = start) {
  const ta = document.createElement("textarea");
  document.body.append(ta);
  ta.value = value;
  ta.setSelectionRange(start, end);
  const events = [];
  ta.addEventListener("input", (e) => events.push(e));
  return { ta, events };
}

/** Emulates Chromium's undoable insertText (jsdom has no execCommand). */
function withExecCommand(fn) {
  const calls = [];
  document.execCommand = (command, ui, text) => {
    calls.push([command, text]);
    const ta = document.activeElement;
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    return true;
  };
  try {
    fn(calls);
  } finally {
    delete document.execCommand;
  }
}

test("replaceRange: setRangeText fallback, caret after the text, one input event", () => {
  const { ta, events } = makeTextarea("hello world", 6, 11);
  const native = replaceRange(ta, 6, 11, "there");
  assert.equal(native, false);
  assert.equal(ta.value, "hello there");
  assert.equal(ta.selectionStart, 11);
  assert.equal(ta.selectionEnd, 11);
  assert.equal(events.length, 1);
  assert.equal(events[0].bubbles, true);
  assert.equal(document.activeElement, ta);

  replaceRange(ta, 0, 0, ">", { dispatchInput: false });
  assert.equal(ta.value, ">hello there");
  assert.equal(events.length, 1);
});

test("replaceRange: uses execCommand('insertText') when it works", () => {
  withExecCommand((calls) => {
    const { ta } = makeTextarea("abc", 0);
    const native = replaceRange(ta, 1, 2, "XY");
    assert.equal(native, true);
    assert.deepEqual(calls, [["insertText", "XY"]]);
    assert.equal(ta.value, "aXYc");
  });
});

test("replaceRange: falls back when execCommand throws or returns false", () => {
  document.execCommand = () => {
    throw new Error("nope");
  };
  try {
    const { ta } = makeTextarea("abc", 0);
    assert.equal(replaceRange(ta, 0, 3, "z"), false);
    assert.equal(ta.value, "z");
  } finally {
    delete document.execCommand;
  }
  document.execCommand = () => false;
  try {
    const { ta } = makeTextarea("abc", 0);
    assert.equal(replaceRange(ta, 0, 1, "Z"), false);
    assert.equal(ta.value, "Zbc");
  } finally {
    delete document.execCommand;
  }
});

test("toggleWrap: the four cases", () => {
  // wrap a selection; it stays selected
  let { ta, events } = makeTextarea("hello world", 6, 11);
  assert.equal(toggleWrap(ta, "[b]", "[/b]"), "wrapped");
  assert.equal(ta.value, "hello [b]world[/b]");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [9, 14]);
  assert.equal(events.length, 1);

  // markers right outside the selection → unwrap
  assert.equal(toggleWrap(ta, "[b]", "[/b]"), "unwrapped");
  assert.equal(ta.value, "hello world");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [6, 11]);

  // selection includes the markers → unwrap, inner selected
  ({ ta } = makeTextarea("x [i]yy[/i] z", 2, 11));
  assert.equal(toggleWrap(ta, "[i]", "[/i]"), "unwrapped");
  assert.equal(ta.value, "x yy z");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [2, 4]);

  // caret between an empty pair → remove the pair
  ({ ta } = makeTextarea("a[b][/b]c", 4));
  assert.equal(toggleWrap(ta, "[b]", "[/b]"), "unwrapped");
  assert.equal(ta.value, "ac");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [1, 1]);

  // caret, no placeholder → caret between the markers
  ({ ta } = makeTextarea("ac", 1));
  assert.equal(toggleWrap(ta, "[u]", "[/u]"), "wrapped");
  assert.equal(ta.value, "a[u][/u]c");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [4, 4]);
});

test("toggleWrap: discussion options (placeholder, matchInside: false)", () => {
  let { ta } = makeTextarea("say ", 4);
  toggleWrap(ta, "**", "**", { placeholder: "bold", matchInside: false });
  assert.equal(ta.value, "say **bold**");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [6, 10]);
  // pressing again unwraps via the outside check (old beatmap-detail case)
  toggleWrap(ta, "**", "**", { placeholder: "bold", matchInside: false });
  assert.equal(ta.value, "say bold");
  assert.deepEqual([ta.selectionStart, ta.selectionEnd], [4, 8]);

  // italic over a selected bold span
  ({ ta } = makeTextarea("**b**", 0, 5));
  toggleWrap(ta, "*", "*", { matchInside: false });
  assert.equal(ta.value, "***b***");
  ({ ta } = makeTextarea("**b**", 0, 5));
  toggleWrap(ta, "*", "*");
  assert.equal(ta.value, "*b*");
});

test("toggleWrap matches user-profile _toggleBbcodeWrap", () => {
  const legacyReplace = legacyFn(LEGACY_BBCODE, "_replaceTextareaRange", {
    document,
    Event: window.Event,
  });
  const legacyToggle = legacyFn(LEGACY_BBCODE, "_toggleBbcodeWrap", {
    _replaceTextareaRange: legacyReplace,
  });
  const values = [
    "",
    "hello world",
    "[b]hello[/b] world",
    "a[b][/b]c",
    "x [b]y[/b]",
    "[b][/b]",
    "[b]",
    "a****b",
  ];
  const pairs = [
    ["[b]", "[/b]"],
    ["[color=red]", "[/color]"],
    ["**", "**"],
  ];
  let compared = 0;
  for (const value of values) {
    for (let start = 0; start <= value.length; start += 1) {
      for (let end = start; end <= value.length; end += 1) {
        for (const [open, close] of pairs) {
          // Degenerate: the old code unwrapped "**" selected as "**…**"
          // even when the selection was shorter than both markers.
          const selected = value.slice(start, end);
          if (
            end > start &&
            selected.length < open.length + close.length &&
            selected.startsWith(open) &&
            selected.endsWith(close)
          ) {
            continue;
          }
          const a = makeTextarea(value, start, end).ta;
          legacyToggle(a, open, close);
          const b = makeTextarea(value, start, end).ta;
          toggleWrap(b, open, close);
          const where = JSON.stringify({ value, start, end, open });
          assert.equal(b.value, a.value, where);
          assert.equal(b.selectionStart, a.selectionStart, where);
          assert.equal(b.selectionEnd, a.selectionEnd, where);
          compared += 1;
        }
      }
    }
  }
  assert.ok(compared > 300);
  document.body.replaceChildren();
});
