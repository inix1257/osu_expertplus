import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BBCODE_MAX_DEPTH,
  parseBbcode,
  renderBbcode,
} from "../../src/editor/bbcode-render.js";
import { renderMarkdown } from "../../src/editor/markdown-render.js";
import * as editor from "../../src/editor/index.js";
import { canon, setupWindow } from "./helpers.mjs";

const { document } = setupWindow();
const bb = (src) => canon(renderBbcode(src, { document }));
const md = (src) => canon(renderMarkdown(src, { document }));

test("B44: an unclosed box/spoilerbox/notice/spoiler does not hide later boxes", () => {
  for (const open of ["[box=a]", "[spoilerbox]", "[notice]", "[spoiler]"]) {
    const out = renderBbcode(`${open}oops\n\n[box=b]ok[/box] [b]bold[/b]`, {
      document,
    });
    const holder = document.createElement("div");
    holder.append(out);
    assert.equal(holder.querySelectorAll("details").length, 1, open);
    assert.equal(holder.querySelector("strong")?.textContent, "bold", open);
    assert.ok(holder.textContent.startsWith(open), open);
  }
});

test("tags: lower case only (B98), raw content, \\r\\n", () => {
  assert.equal(bb("[code]x[/code]"), "<pre><code>x</code></pre>");
  // osu-web matches tag names case-sensitively (B98)
  assert.equal(bb("[CODE]x[/code]"), "<p>[CODE]x[/code]</p>");
  assert.equal(bb("[code]x[/CODE]"), "<p>[code]x[/CODE]</p>");
  assert.equal(bb("[b]x[/B]"), "<p>[b]x[/B]</p>");
  assert.equal(bb("[b]a\r\nb[/b]"), "<p><strong>a<br>b</strong></p>");
  assert.equal(
    bb("[code][url=https://a.com]x[/url][/code]"),
    "<pre><code>[url=https://a.com]x[/url]</code></pre>",
  );
  assert.equal(bb("[b=1]x[/b]"), "<p>[b=1]x[/b]</p>");
  assert.equal(bb("[color]x[/color]"), "<p>[color]x[/color]</p>");
  assert.equal(
    bb("[url=https://a.com/[x]]y[/url]"),
    "<p>[url=https://a.com/[x]]y[/url]</p>",
  );
});

test("lists: items, [/*], text before the first item, literal list items", () => {
  assert.equal(
    bb("[list][*]a[/*] tail[*]b[/list]"),
    "<ul><li>a tail</li><li>b</li></ul>",
  );
  assert.equal(
    bb("[list]intro[*]a[/list]"),
    "<ul><li>intro</li><li>a</li></ul>",
  );
  assert.equal(bb("[list=1][*]a[/list]"), "<ol><li>a</li></ol>");
  // [*] inside a box inside an item is not an item of the outer list
  assert.match(bb("[list][*][box]x[*]y[/box][/list]"), /<p>x\[\*\]y<\/p>/);
  // A list that is never closed stays literal, items included
  assert.equal(bb("[list][*]a[*]b"), "<p>[list][*]a[*]b</p>");
  assert.equal(
    bb("[b][list][*]a[*]b[/list]"),
    "<p>[b]</p><ul><li>a</li><li>b</li></ul>",
  );
});

test("pairing: nearest opening tag, unpaired opens are literal", () => {
  assert.equal(bb("[b][b]x[/b]"), "<p>[b]<strong>x</strong></p>");
  assert.equal(bb("[b]a[i]b[/b]c[/i]"), "<p><strong>a[i]b</strong>c[/i]</p>");
  assert.equal(bb("[/b][b]x"), "<p>[/b][b]x</p>");
});

test("depth cap: BBCODE_MAX_DEPTH levels, then literal", () => {
  const ok =
    "[b]".repeat(BBCODE_MAX_DEPTH) + "x" + "[/b]".repeat(BBCODE_MAX_DEPTH);
  const tree = parseBbcode(ok);
  let depth = 0;
  for (let n = tree; n.children?.[0]?.type === "tag"; n = n.children[0]) {
    depth += 1;
  }
  assert.equal(depth, BBCODE_MAX_DEPTH);
  const over =
    "[b]".repeat(BBCODE_MAX_DEPTH + 1) +
    "x" +
    "[/b]".repeat(BBCODE_MAX_DEPTH + 1);
  const text = renderBbcode(over, { document }).textContent;
  assert.equal(text, "[b]x[/b]");
});

test("values: colours, sizes, quotes, extra tags", () => {
  // osu-web BBCodeForDB: `#` + 6 hex digits or letters, untrimmed (B98)
  assert.equal(
    bb("[color=#AbC123]x[/color] [color=DarkRed]y[/color]"),
    '<p><span style="color:#AbC123;">x</span> <span style="color:DarkRed;">y</span></p>',
  );
  for (const bad of [
    "#abc",
    "#abc12345",
    " #abc123",
    "red ",
    "red2",
    "#ggg000",
  ]) {
    assert.equal(
      bb(`[color=${bad}]x[/color]`),
      `<p>[color=${bad}]x[/color]</p>`,
      bad,
    );
  }
  // whole numbers only, clamped to 30–200 like BBCodeFromDB
  assert.equal(
    bb("[size=10]x[/size]"),
    '<p><span style="font-size:30%;">x</span></p>',
  );
  assert.equal(
    bb("[size=250]x[/size]"),
    '<p><span style="font-size:200%;">x</span></p>',
  );
  for (const bad of ["Large", "normal", "1.5", "-5", " 100", "100%"]) {
    assert.equal(
      bb(`[size=${bad}]x[/size]`),
      `<p>[size=${bad}]x[/size]</p>`,
      bad,
    );
  }
  assert.equal(bb("[quote=peppy]x[/quote]"), "<p>[quote=peppy]x[/quote]</p>");
  assert.equal(
    bb('[quote="a"]x[/quote]'),
    "<blockquote><h4>a wrote:</h4>x</blockquote>",
  );
  assert.equal(
    bb("[youtube]https://youtu.be/abc_DEF-1?t=3[/youtube]"),
    '<p><a href="https://www.youtube.com/watch?v=abc_DEF-1" rel="noopener noreferrer" target="_blank">YouTube: abc_DEF-1</a></p>',
  );
  assert.equal(bb("[youtube]a b[/youtube]"), "<p>[youtube]a b[/youtube]</p>");
  assert.equal(
    bb("[profile]some name[/profile]"),
    '<p><a href="https://osu.ppy.sh/users/@some%20name" rel="noopener noreferrer" target="_blank">some name</a></p>',
  );
  assert.equal(bb("[profile=x]y[/profile]"), "<p>[profile=x]y[/profile]</p>");
  assert.equal(
    bb("[email]not-an-email[/email]"),
    "<p>[email]not-an-email[/email]</p>",
  );
  assert.equal(bb("[email=a@b.cd]me[/email]"), "<p>me</p>");
  assert.equal(bb("[audio]/x.mp3[/audio]"), "<p>[audio]/x.mp3[/audio]</p>");
  assert.equal(bb("[c][b]x[/b][/c]"), "<p><code><strong>x</strong></code></p>");
});

test("[url]: raw label, invalid content parsed as BBCode", () => {
  assert.equal(
    bb("[url] https://a.com/x [/url]"),
    '<p><a href="https://a.com/x" rel="noopener noreferrer" target="_blank">https://a.com/x</a></p>',
  );
  assert.equal(bb("[url]bad [b]x[/b][/url]"), "<p>bad <strong>x</strong></p>");
  assert.equal(bb("[url]never closed"), "<p>[url]never closed</p>");
});

test("markdown: inline atoms and nesting", () => {
  assert.equal(
    md("**a [b](https://x.com) c**"),
    '<p><strong>a <a href="https://x.com/" rel="noopener noreferrer" target="_blank">b</a> c</strong></p>',
  );
  assert.equal(
    md("[**bold** label](https://x.com)"),
    '<p><a href="https://x.com/" rel="noopener noreferrer" target="_blank"><strong>bold</strong> label</a></p>',
  );
  assert.equal(md("``"), "<p>``</p>");
  assert.equal(md("` a ` b `"), "<p><code> a </code> b `</p>");
  assert.equal(
    md("![a](https://x.com/a b.png)"),
    "<p>![a](https://x.com/a b.png)</p>",
  );
  assert.equal(md("a_b_ _c_"), "<p>a_b_ <em>c</em></p>");
  // A literal U+FFFC cannot forge an atom placeholder.
  const forged = String.fromCharCode(0xfffc, 0xe000, 0xe000);
  assert.equal(
    renderMarkdown(`${forged} x`, { document }).textContent,
    `${String.fromCharCode(0xfffd, 0xe000, 0xe000)} x`,
  );
});

test("index exports everything the bridge exposes", () => {
  for (const name of [
    "renderBbcode",
    "parseBbcode",
    "BBCODE_MAX_DEPTH",
    "renderMarkdown",
    "toSafeFragment",
    "sanitizeTree",
    "isSafeColor",
    "safeHttpUrl",
    "absoluteHttpUrl",
    "replaceRange",
    "toggleWrap",
    "findBbcodeCancelButton",
    "placeBbcodePreviewToggle",
    "placeDiscussionPreviewToggle",
  ]) {
    assert.ok(name in editor, name);
  }
});
