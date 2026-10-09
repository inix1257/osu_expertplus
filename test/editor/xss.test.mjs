import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBbcode } from "../../src/editor/bbcode-render.js";
import { renderMarkdown } from "../../src/editor/markdown-render.js";
import {
  absoluteHttpUrl,
  isSafeColor,
  safeHttpUrl,
  sanitizeStyle,
  toSafeFragment,
} from "../../src/editor/sanitize.js";
import { canon, safetyProblems, setupWindow } from "./helpers.mjs";

const { window, document, OsuExpertPlus } = setupWindow();

/** WS-02 payloads (docs/refactor/workstreams/WS-02-preview-xss-hotfix.md). */
const WS02_BBCODE = [
  "[img]https://x.invalid/[color=red/onerror=alert(1)//]a[/color][/img]",
  "[img]https://x.com/[color=a/onerror=alert(1)//][/img] [/color]",
  "[url=javascript:alert(1)]x[/url]",
  "[img]javascript:alert(1)[/img]",
  '[color=red" onmouseover="alert(1)]x[/color]',
  "[color=red;position:fixed;inset:0;background:url(https://evil.example/t)]x[/color]",
  '[size=50" onclick=alert(1)]x[/size]',
  "[box=<img src=x onerror=alert(1)>]x[/box]",
  '[imagemap]https://x.invalid/a.png" onerror="alert(1)[/imagemap]',
  "[url=https://a.example/?a=1&b=2]x[/url]",
];

const BBCODE_VARIANTS = [
  // case
  "[URL=JaVaScRiPt:alert(1)]x[/URL]",
  "[IMG]JAVASCRIPT:alert(1)[/IMG]",
  "[Url]javascript:alert(1)[/uRl]",
  // entities and encodings (input is text, never decoded as HTML)
  "[url=java&#115;cript:alert(1)]x[/url]",
  "[url=&#106;avascript:alert(1)]x[/url]",
  "[img]&#x6A;avascript:alert(1)[/img]",
  "[url=javascript&colon;alert(1)]x[/url]",
  "[url= javascript:alert(1)]x[/url]",
  "[url=\tjavascript:alert(1)]x[/url]",
  // other schemes
  "[url=data:text/html,<script>alert(1)</script>]x[/url]",
  "[img]data:image/svg+xml,<svg onload=alert(1)>[/img]",
  "[url=vbscript:msgbox(1)]x[/url]",
  "[url=//evil.example/x]protocol-relative[/url]",
  "[url]javascript:alert(1)[/url]",
  "[audio]javascript:alert(1)[/audio]",
  "[imagemap=javascript:alert(1)]x[/imagemap]",
  "[imagemap(javascript:alert(1))]x[/imagemap]",
  "[imagemap]\njavascript:alert(1).png\n[/imagemap]",
  // attribute breaking
  '[url=https://evil.example/" onmouseover="alert(1)]x[/url]',
  "[img]https://x.com/a.png' onerror='alert(1)[/img]",
  "[img]https://x.com/a.png onerror=alert(1)[/img]",
  "[profile=1 onclick=alert(1)]x[/profile]",
  '[profile]"><img src=x onerror=alert(1)>[/profile]',
  '[youtube]"><script>alert(1)</script>[/youtube]',
  "[youtube]x onerror=alert(1)[/youtube]",
  '[quote="<img src=x onerror=alert(1)>"]x[/quote]',
  "[box=</summary><img src=x onerror=alert(1)>]x[/box]",
  '[spoilerbox="><script>alert(1)</script>]x[/spoilerbox]',
  // style injection
  "[color=expression(alert(1))]x[/color]",
  "[color=#fff;background:url(javascript:alert(1))]x[/color]",
  "[color=url(https://evil.example/t)]x[/color]",
  "[color=red}body{display:none]x[/color]",
  "[size=100;position:fixed;inset:0]x[/size]",
  "[size=1e999]x[/size]",
  "[size=-5]x[/size]",
  "[size=50%;background:red]x[/size]",
  // raw HTML in text
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  '<a href="javascript:alert(1)">x</a>',
  "<style>body{display:none}</style>",
  "[c]<script>alert(1)</script>[/c]",
  "[code]<img src=x onerror=alert(1)>[/code]",
  // nesting and broken tags
  "[b][i][url=javascript:alert(1)][img]javascript:x[/img][/url][/i][/b]",
  "[url=https://ok.example][url=javascript:alert(1)]x[/url][/url]",
  '[box=a][notice][color=red" onclick="x]y[/color][/notice][/box]',
  "[url=javascript:alert(1)",
  "[img]javascript:alert(1)",
  '[color=red" x',
  "[img][img]javascript:alert(1)[/img][/img]",
  "[url=https://ok.example/[img]javascript:alert(1)[/img]]x[/url]",
  "[list][*][url=javascript:alert(1)]x[/url][*]<b onclick=1>[/list]",
];

const WS02_MARKDOWN = [
  "![a](https://x.com/[)](https://evil/x/onerror=location='javascript:alert%281%29'//)",
  "[x](javascript:alert(1))",
  '![x](https://a/b"onerror="alert(1))',
];

const MARKDOWN_VARIANTS = [
  "[x](JAVASCRIPT:alert(1))",
  "[x](javascript&#58;alert(1))",
  "![x](javascript:alert(1))",
  "![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)",
  "![x](//evil.example/a.png)",
  '[x](https://a.com" onclick="alert(1))',
  '[x](https://a.com/"onclick="alert(1))',
  "![x](https://a.com/a.png'onerror='alert(1))",
  "<script>alert(1)</script>",
  "**<img src=x onerror=alert(1)>**",
  "`<img src=x onerror=alert(1)>`",
  "[<img src=x onerror=1>](https://a.com)",
  "![<img src=x onerror=1>](https://a.com/a.png)",
  "> <svg onload=alert(1)>",
  "# <iframe src=javascript:alert(1)>",
  "- <a href=javascript:alert(1)>x</a>",
  "```\n<script>alert(1)</script>\n```",
  "[a](https://x.com/_a_)_b_[c](javascript:x)",
  "[![a](https://x.com/[)](https://evil/onerror=alert(1)//)](javascript:x)",
  "\uFFFC\uE000\uE000 placeholder look-alike",
];

function check(frag, src) {
  assert.deepEqual(safetyProblems(frag), [], `input ${JSON.stringify(src)}`);
  const holder = document.createElement("div");
  holder.append(frag);
  assert.equal(
    holder.querySelectorAll("script, iframe, svg, style, object, embed").length,
    0,
    `input ${JSON.stringify(src)}`,
  );
  return holder;
}

test("bbcode: WS-02 payloads and variants render harmlessly", () => {
  for (const src of [...WS02_BBCODE, ...BBCODE_VARIANTS]) {
    check(renderBbcode(src, { document }), src);
  }
});

test("markdown: WS-02 payloads and variants render harmlessly", () => {
  for (const src of [...WS02_MARKDOWN, ...MARKDOWN_VARIANTS]) {
    check(renderMarkdown(src, { document }), src);
  }
});

test("bbcode: hostile values become text, not markup", () => {
  const box = check(
    renderBbcode("[box=<img src=x onerror=alert(1)>]x[/box]", { document }),
  );
  assert.equal(
    box.querySelector(".oep-bbhelp-preview__spoiler-label").textContent,
    "<img src=x onerror=alert(1)>",
  );
  assert.equal(box.querySelectorAll("img").length, 0);

  const text = check(renderBbcode("<script>alert(1)</script>", { document }));
  assert.equal(text.textContent, "<script>alert(1)</script>");

  const quote = check(
    renderBbcode('[quote="<b>x</b>"]y[/quote]', { document }),
  );
  assert.equal(quote.querySelector("h4").textContent, "<b>x</b> wrote:");
});

test("bbcode: rejected URLs and styles", () => {
  const url = check(
    renderBbcode("[url=javascript:alert(1)]label[/url]", { document }),
  );
  assert.equal(url.querySelectorAll("a").length, 0);
  assert.equal(url.textContent, "label");

  const img = check(
    renderBbcode("[img]javascript:alert(1)[/img]", { document }),
  );
  assert.equal(img.querySelectorAll("img").length, 0);

  const color = check(
    renderBbcode('[color=red" onmouseover="alert(1)]x[/color]', { document }),
  );
  assert.equal(color.querySelector("span").getAttribute("style"), null);

  const size = check(
    renderBbcode("[size=100;position:fixed]x[/size]", { document }),
  );
  assert.equal(
    size.querySelector("span").getAttribute("style"),
    "font-size:1em;",
  );

  const attr = check(
    renderBbcode('[url=https://evil.example/" onmouseover="alert(1)]x[/url]', {
      document,
    }),
  );
  assert.equal(
    attr.querySelector("a").getAttribute("href"),
    "https://evil.example/%22%20onmouseover=%22alert(1)",
  );
});

test("B06/B73: & in URLs is not double-escaped", () => {
  const bb = check(
    renderBbcode("[url=https://a.example/?a=1&b=2]x[/url]", { document }),
  );
  assert.equal(bb.querySelector("a").href, "https://a.example/?a=1&b=2");
  const img = check(
    renderBbcode("[img]https://a.example/i.png?a=1&b=2[/img]", { document }),
  );
  assert.equal(
    img.querySelector("img").getAttribute("src"),
    "https://a.example/i.png?a=1&b=2",
  );
  const md = check(
    renderMarkdown("![a](https://x.com/i.png?a=1&b=2)", { document }),
  );
  assert.equal(
    md.querySelector("img").getAttribute("src"),
    "https://x.com/i.png?a=1&b=2",
  );
  const link = check(
    renderMarkdown("[a](https://x.com/?a=1&b=2)", { document }),
  );
  assert.equal(
    link.querySelector("a").getAttribute("href"),
    "https://x.com/?a=1&b=2",
  );
});

test("markdown: WS-02 B04 payload stays harmless and keeps the text", () => {
  const holder = check(renderMarkdown(WS02_MARKDOWN[0], { document }));
  for (const img of holder.querySelectorAll("img")) {
    assert.match(img.getAttribute("src"), /^https:\/\/x\.com\//);
  }
  for (const a of holder.querySelectorAll("a")) {
    assert.match(a.getAttribute("href"), /^https:\/\//);
  }
});

test("sanitize.js port: same output as the legacy sanitizer", () => {
  const legacy = OsuExpertPlus.htmlSanitize;
  const inputs = [
    '<p onclick="x">a<script>alert(1)</script></p>',
    '<a href="javascript:alert(1)" onclick="x">x</a>',
    '<a href="https://a.com/?a=1&amp;b=2" target="_blank">x</a>',
    '<a href="/relative">rel</a>',
    '<img src="x" onerror="alert(1)">',
    '<img src="https://a.com/a.png" srcset="javascript:x" alt="a">',
    '<span style="color:red;position:fixed;font-size:120%;text-align:center">x</span>',
    '<div style="background:url(javascript:x)" class="oep-x evil">y</div>',
    "<svg><script>alert(1)</script></svg><math><mi>x</mi></math>",
    "<iframe src=javascript:alert(1)></iframe><object></object>",
    "<details><summary aria-label=Spoiler aria-hidden=true>s</summary>b</details>",
    "<!-- comment --><b>unknown tag</b><table><tr><td>cell</td></tr></table>",
    '<form action="javascript:x"><input value=x><button formaction=x>b</button></form>',
    '<a href="https://a.com/ x">space</a><img src="https://a.com/&quot;x">',
    "<ul><li>a</li></ul><ol><li>b</li></ol><pre><code>c</code></pre>",
  ];
  for (const html of inputs) {
    const a = legacy.toSafeFragment(html);
    const b = toSafeFragment(html, { document, base: window.location.origin });
    assert.equal(canon(b), canon(a), html);
    assert.deepEqual(safetyProblems(b), [], html);
  }
});

test("validators", () => {
  assert.equal(isSafeColor("#ff66aa"), true);
  assert.equal(isSafeColor("red"), true);
  assert.equal(isSafeColor("red;x:y"), false);
  assert.equal(isSafeColor("expression(1)"), false);
  assert.equal(sanitizeStyle("color:red;position:fixed;"), "color:red;");
  assert.equal(absoluteHttpUrl("https://a.com/x"), "https://a.com/x");
  assert.equal(absoluteHttpUrl("  HTTP://A.com "), "http://a.com/");
  assert.equal(absoluteHttpUrl("/x"), "");
  assert.equal(absoluteHttpUrl("//a.com/x"), "");
  assert.equal(absoluteHttpUrl("javascript:alert(1)"), "");
  assert.equal(absoluteHttpUrl("https://"), "");
  assert.equal(safeHttpUrl("/x", "https://osu.ppy.sh"), "https://osu.ppy.sh/x");
  assert.equal(safeHttpUrl('https://a.com/"x', "https://osu.ppy.sh"), "");
  assert.equal(safeHttpUrl("javascript:x", "https://osu.ppy.sh"), "");
});
