import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BBCODE_MAX_DEPTH,
  parseBbcode,
  renderBbcode,
} from "../../src/editor/bbcode-render.js";
import { renderMarkdown } from "../../src/editor/markdown-render.js";
import { setupWindow } from "./helpers.mjs";

const { document } = setupWindow();

/** Fastest of a few runs, in ms (the first run pays for JIT warm-up). */
function bestOf(runs, fn) {
  let best = Infinity;
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

test("B65: 20,000 chars with 1,000 unclosed [color] render in < 100 ms", () => {
  // 1,000 × 20 chars: "[color=red]" + 9 chars of text.
  const src = Array.from(
    { length: 1000 },
    (_, i) => `[color=red]text ${String(i).padStart(4, "0")}`,
  ).join("");
  assert.equal(src.length, 20000);
  let frag;
  const ms = bestOf(3, () => {
    frag = renderBbcode(src, { document });
  });
  assert.ok(ms < 100, `took ${ms.toFixed(1)} ms`);
  // B44: shown literally, nothing lost.
  assert.equal(frag.textContent, src);
});

test("B65: unclosed [color] mixed with closed tags still renders the closed ones", () => {
  const src = "[color=red]open ".repeat(1000) + "[b]bold[/b]";
  const frag = renderBbcode(src, { document });
  assert.equal(frag.querySelectorAll("strong").length, 1);
});

test("B65: 8,000 consecutive boxes do not overflow the stack", () => {
  const src = "[box=t]x[/box]".repeat(8000);
  const frag = renderBbcode(src, { document });
  assert.equal(frag.querySelectorAll("details").length, 8000);
  const ms = bestOf(3, () => parseBbcode(src));
  assert.ok(ms < 100, `parse took ${ms.toFixed(1)} ms`);
});

test("B65: nesting is capped at BBCODE_MAX_DEPTH, deeper tags are literal", () => {
  const src = "[box]".repeat(8000) + "x" + "[/box]".repeat(8000);
  const frag = renderBbcode(src, { document });
  assert.equal(frag.querySelectorAll("details").length, BBCODE_MAX_DEPTH);
  // Each literal [box] / [/box] beyond the cap stays in the text.
  const literal = frag.textContent.split("[box]").length - 1;
  assert.equal(literal, 8000 - BBCODE_MAX_DEPTH);
});

test("adversarial BBCode inputs stay fast", () => {
  const inputs = [
    "[".repeat(20000),
    "[img]".repeat(4000),
    "[url=a".repeat(4000),
    "[url=https://a.com]".repeat(2000),
    "[/b]".repeat(5000),
    "[b]".repeat(64) + "[/i]".repeat(5000),
    "[list][*]".repeat(2500),
    "[code]".repeat(3000) + "[/code]",
    "[box=".repeat(4000),
    " ".repeat(20000) + "a [b]x",
    "\n".repeat(10000) + "a\n \n".repeat(2000),
  ];
  for (const src of inputs) {
    const ms = bestOf(2, () => renderBbcode(src, { document }));
    assert.ok(ms < 250, `${JSON.stringify(src.slice(0, 20))}… ${ms} ms`);
  }
});

test("adversarial markdown inputs stay fast", () => {
  const inputs = [
    "[".repeat(20000),
    "![](a".repeat(5000),
    "**a".repeat(7000),
    "_a _".repeat(5000),
    "`".repeat(20000),
    "[a](https://x".repeat(1500),
    "![a](https://x.com/a.png)".repeat(800),
    "*".repeat(20000),
    "~~".repeat(10000),
    `${"> a\n- b\n1. c\n".repeat(2000)}`,
  ];
  for (const src of inputs) {
    const ms = bestOf(2, () => renderMarkdown(src, { document }));
    assert.ok(ms < 250, `${JSON.stringify(src.slice(0, 20))}… ${ms} ms`);
  }
});
