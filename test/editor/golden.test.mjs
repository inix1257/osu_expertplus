import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBbcode } from "../../src/editor/bbcode-render.js";
import { renderMarkdown } from "../../src/editor/markdown-render.js";
import { sanitizeTree } from "../../src/editor/sanitize.js";
import { BBCODE_DIFFS, MARKDOWN_DIFFS } from "./golden-diffs.mjs";
import {
  canon,
  oldBbcodeRenderer,
  oldMarkdownRenderer,
  oldPipeline,
  setupWindow,
} from "./helpers.mjs";

const { window, document } = setupWindow();
const oldBbcode = oldBbcodeRenderer(window);
const oldMarkdown = oldMarkdownRenderer(window);

const USERPAGE_1 = `[centre][img]https://i.imgur.com/banner.png[/img]
[size=150][b]Welcome to my userpage![/b][/size]

[color=#66ccff]osu! player since 2015[/color]
[/centre]

[box=About me]
Hi! I mostly play [b]standard[/b].
[list]
[*]Favourite mapper: [url=https://osu.ppy.sh/users/2]peppy[/url]
[*]Rank goal: top 10k
[/list]
[/box]

[notice][centre][heading]Requests[/heading]
Modding queue is [color=red]closed[/color].[/centre][/notice]`;

const USERPAGE_2 = `[centre][size=200][color=#ff66aa][b]~ hello ~[/b][/color][/size]
[i]mapper / modder[/i][/centre]

[heading]Beatmaps[/heading]
[box=Ranked]
[url=https://osu.ppy.sh/beatmapsets/1]Artist - Title[/url]
[url=https://osu.ppy.sh/beatmapsets/2]Artist - Title 2[/url] [size=85](collab)[/size]
[/box]
[box=Graveyard]
[spoilerbox]
[img]https://i.imgur.com/grave.png[/img]
[/spoilerbox]
[/box]

[quote]The best is yet to come.[/quote]

[right][s]old text[/s] [u]new text[/u][/right]`;

const USERPAGE_3 = `[imagemap]
https://i.imgur.com/nav.png
0 0 33.3 100 https://osu.ppy.sh/users/2 Profile
33.3 0 33.3 100 # Nothing
[/imagemap]
[centre][size=tiny]tiny[/size] [size=small]small[/size] [size=normal]normal[/size] [size=large]large[/size][/centre]

[notice]
[b]Rules[/b]
[list]
[*]Be nice
[*]No spam
[/list]
[/notice]

[code]  aligned
    code[/code]
[url]https://osu.ppy.sh/wiki/en/BBCode[/url]`;

/** Inputs where the new BBCode output must equal the old (sanitized) one. */
const BBCODE_SAME = [
  "plain text",
  "line one\nline two",
  "para one\n\npara two\n\n\npara three",
  "  leading and trailing  \n\n  spaces  ",
  "a\n \nb",
  "[b]bold[/b] [i]italic[/i] [u]under[/u] [s]strike[/s] [strike]strike2[/strike]",
  "[B]upper[/B] [I]case[/i]",
  "[color=#ff66aa]pink[/color] [color=red]red[/color] [color=bad;x]bad[/color] [color=]empty[/color]",
  "[size=150]big[/size] [size=50]small[/size] [size=tiny]tiny[/size] [size=large]large[/size] [size=999]clamped[/size] [size=abc]bad[/size]",
  "[centre]centered[/centre]\n[right]right[/right]",
  "[heading]Heading[/heading]\ntext after",
  "[heading]a[/heading]\n\n[heading]b[/heading]",
  "[quote]quoted text[/quote]",
  "[quote]a\nb[/quote]\n\nafter",
  "[code]let x = 1;\nlet y = 2;[/code]",
  "[url=https://osu.ppy.sh/home]osu![/url] and [url]https://osu.ppy.sh/wiki[/url]",
  "[url=https://example.com/?a=1&b=2]amp[/url]",
  "[url=javascript:alert(1)]x[/url]",
  "[url=https://a.com][img]https://a.com/x.png[/img][/url]",
  "[img]https://i.imgur.com/abc.png[/img]",
  "x [img]javascript:alert(1)[/img] y",
  "[imagemap]\nhttps://i.imgur.com/map.png\n0 0 50 50 https://osu.ppy.sh Home\n[/imagemap]",
  "[imagemap=https://i.imgur.com/a.png]x[/imagemap]",
  "[imagemap(https://i.imgur.com/a.png)]x[/imagemap]",
  "[box=Title]inside box[/box]",
  "[box]untitled[/box]",
  "[box=]empty title[/box]",
  "[spoilerbox]hidden[/spoilerbox]",
  "[spoilerbox=Named]hidden[/spoilerbox]",
  "[spoiler=Spoiler title]x[/spoiler]",
  "[spoiler]x[/spoiler]",
  "[notice]Notice text\n\nsecond para[/notice]",
  "[notice]\n[box=x]y[/box]\n[/notice]",
  "[list]\n[*]one\n[*]two\n[*]three\n[/list]",
  "[list]intro[*]a[*]b[/list]",
  "[list][/list]text",
  "[list]\n[*][b]bold item[/b]\n[*]plain\n[/list]\nafter list",
  "[box=Outer]\nouter text\n[box=Inner]inner text[/box]\n[/box]",
  "[box=a]text[/box]\n\n[box=b]text2[/box]",
  "[box=A]\nx\n[/box]\ntext",
  "[spoilerbox]\n[img]https://a.com/x.png[/img]\n[/spoilerbox]",
  "[centre][box=x]in centre box[/box][/centre]",
  "[b]bold [i]bold italic[/i][/b]",
  "[size=85][color=#aaa]small grey[/color][/size]",
  "text\n[centre]c[/centre]\nmore",
  "[centre]\nline\n[/centre]",
  "[centre]a\n\nb[/centre]",
  "[b]a\n\nb[/b]",
  "[email]a@b.cd[/email]",
  "[email=a@b.cd]mail me[/email]",
  "a < b & c > d \"quoted\" 'single'",
  USERPAGE_1,
  USERPAGE_2,
  USERPAGE_3,
];

const DISCUSSION_1 = `## Overall

00:12:345 (1,2) - spacing is **inconsistent** here, try *1.2x*
00:15:000 (3) - ~~remove~~ move this

> quoted from the mapper
> second line

- [osu!](https://osu.ppy.sh/beatmapsets/1) reference
- \`code\` sample

1. first
2. second

\`\`\`
raw   block
  kept
\`\`\``;

/** Inputs where the new markdown output must equal the old one. */
const MARKDOWN_SAME = [
  "# H1\n## H2\n###### H6",
  "####### seven is a paragraph",
  "plain line\nsecond line",
  "**bold** __bold__ *em* _em_ ~~del~~",
  "***bold italic***",
  "`code` and **bold `x`**",
  "[osu!](https://osu.ppy.sh) link",
  "[x](javascript:alert(1))",
  "[a](HTTP://x.com)",
  "[a [b](https://x.com)",
  "![img](https://i.imgur.com/a.png)",
  "![](https://i.imgur.com/a.png)",
  "[![img](https://i.imgur.com/a.png)](https://osu.ppy.sh)",
  "> quote line\n> second\n\nafter",
  ">\n> after empty quote line",
  "> - not a list in quote",
  "- one\n- two\n* three\n\n1. a\n2. b",
  "- item\n1. switch\n- back",
  "  - indented item",
  "```\ncode block\n  indented\n```",
  "```js\nconst a = 1;\n```\nafter",
  "unterminated\n```\ncode",
  "00:12:345 (1,2) - spacing issue",
  "a <b>tag</b> & stuff",
  "**bold** text _with_ some *mixed* ~~marks~~ and [link](https://osu.ppy.sh/beatmapsets/1)",
  DISCUSSION_1,
];

/**
 * @param {string} src
 * @param {(s: string) => string} oldRender
 * @param {(s: string, o: object) => DocumentFragment} newRender
 */
function both(src, oldRender, newRender) {
  return {
    old: canon(oldPipeline(window, oldRender, src)),
    new: canon(newRender(src, { document })),
  };
}

test("bbcode golden: new output equals the old renderer", () => {
  for (const src of BBCODE_SAME) {
    const out = both(src, oldBbcode, renderBbcode);
    assert.ok(out.old, `old output empty for ${JSON.stringify(src)}`);
    assert.equal(out.new, out.old, `input ${JSON.stringify(src)}`);
  }
});

test("bbcode golden: every difference is listed and intentional", () => {
  for (const d of BBCODE_DIFFS) {
    const out = both(d.src, oldBbcode, renderBbcode);
    assert.equal(out.old, d.old, `old drifted for ${JSON.stringify(d.src)}`);
    assert.equal(out.new, d.new, `new drifted for ${JSON.stringify(d.src)}`);
    assert.notEqual(d.old, d.new);
  }
});

test("markdown golden: new output equals the old renderer", () => {
  for (const src of MARKDOWN_SAME) {
    const out = both(src, oldMarkdown, renderMarkdown);
    assert.ok(out.old, `old output empty for ${JSON.stringify(src)}`);
    assert.equal(out.new, out.old, `input ${JSON.stringify(src)}`);
  }
});

test("markdown golden: every difference is listed and intentional", () => {
  for (const d of MARKDOWN_DIFFS) {
    const out = both(d.src, oldMarkdown, renderMarkdown);
    assert.equal(out.old, d.old, `old drifted for ${JSON.stringify(d.src)}`);
    assert.equal(out.new, d.new, `new drifted for ${JSON.stringify(d.src)}`);
    assert.notEqual(d.old, d.new);
  }
});

test("empty input: empty fragment (old placeholder <p> is the caller's job)", () => {
  for (const src of ["", "   ", "\n\n"]) {
    assert.equal(renderBbcode(src, { document }).childNodes.length, 0);
  }
  assert.equal(renderMarkdown("", { document }).childNodes.length, 0);
  assert.match(oldBbcode(""), /oep-bbhelp-preview__empty/);
  assert.match(oldMarkdown(""), /oep-discussion-preview__empty/);
});

test("sanitizer leaves renderer output unchanged (second line of defence)", () => {
  const all = [
    ...BBCODE_SAME.map((s) => renderBbcode(s, { document })),
    ...BBCODE_DIFFS.map((d) => renderBbcode(d.src, { document })),
    ...MARKDOWN_SAME.map((s) => renderMarkdown(s, { document })),
    ...MARKDOWN_DIFFS.map((d) => renderMarkdown(d.src, { document })),
  ];
  for (const frag of all) {
    const before = canon(frag);
    const box = document.createElement("div");
    box.append(frag);
    const html = box.innerHTML;
    sanitizeTree(box);
    assert.equal(box.innerHTML, html);
    assert.equal(canon(box), before);
  }
});
