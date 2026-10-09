import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js"], {
  url: "https://osu.ppy.sh/beatmapsets/1",
});
for (const key of ["window", "document", "HTMLElement"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { bindBbcodeSpoilers } =
  await import("../../src/features/beatmapset/bbcode-spoilers.js");

const spoiler = (id, inner = "") => `
  <div class="bbcode-spoilerbox" id="${id}">
    <a class="bbcode-spoilerbox__link" href="#">${id}</a>
    <div class="bbcode-spoilerbox__body">${id} body${inner}</div>
  </div>`;

test("a nested spoiler's trigger toggles only that spoiler (B59)", () => {
  window.document.body.innerHTML = `<div id="root">${spoiler("outer", spoiler("inner"))}</div>`;
  const root = window.document.getElementById("root");
  bindBbcodeSpoilers(root);
  const outer = window.document.getElementById("outer");
  const inner = window.document.getElementById("inner");
  const open = (el) => el.dataset.oepSpoilersOpen;
  assert.deepEqual([open(outer), open(inner)], ["0", "0"]);

  inner.querySelector(".bbcode-spoilerbox__link").click();
  assert.deepEqual([open(outer), open(inner)], ["0", "1"]);
  assert.equal(
    inner.querySelector(".bbcode-spoilerbox__body").style.display,
    "block",
  );

  outer.querySelector(":scope > .bbcode-spoilerbox__link").click();
  assert.deepEqual([open(outer), open(inner)], ["1", "1"]);
});
