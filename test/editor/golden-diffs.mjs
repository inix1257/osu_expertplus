/**
 * Intentional differences between the old preview renderers (after the
 * WS-02 sanitizer) and the WS-25 renderers, as canonical DOM strings (see
 * `canon` in helpers.mjs). Generated once, then reviewed by hand; each entry
 * says why the new output differs.
 */

export const BBCODE_DIFFS = [
  {
    why: "code keeps blank lines (old split the <pre> at the paragraph break)",
    src: "[code]let x = 1;\n\nlet y = 2;[/code]",
    old: "<pre><code>let x = 1;</code><p><code>let y = 2;</code></p></pre>",
    new: "<pre><code>let x = 1;\n\nlet y = 2;</code></pre>",
  },
  {
    why: "leading/trailing newlines of [code] dropped, like osu-web BBCodeFromDB::parseCode",
    src: "[code]\nx\n[/code]",
    old: "<pre><code>\nx\n</code></pre>",
    new: "<pre><code>x</code></pre>",
  },
  {
    why: "[url] label is the text as typed (osu-web), not the normalized href",
    src: "[url]https://osu.ppy.sh[/url]",
    old: '<p><a href="https://osu.ppy.sh/" rel="noopener noreferrer" target="_blank">https://osu.ppy.sh/</a></p>',
    new: '<p><a href="https://osu.ppy.sh/" rel="noopener noreferrer" target="_blank">https://osu.ppy.sh</a></p>',
  },
  {
    why: "B44: unclosed box shown literally, later boxes still render",
    src: "[box=first]unclosed\n\n[box=second]closed[/box]",
    old: "<p>unclosed</p><p>closed</p>",
    new: '<p>[box=first]unclosed</p><details class="oep-bbhelp-preview__spoilerbox"><summary class="oep-bbhelp-preview__spoiler-summary"><span class="oep-bbhelp-preview__spoiler-label">second</span></summary><div class="oep-bbhelp-preview__spoiler-body"><p>closed</p></div></details>',
  },
  {
    why: "B44: same for an unclosed [notice]",
    src: "[notice]unclosed [box=b]closed[/box]",
    old: "<p>unclosed closed</p>",
    new: '<p>[notice]unclosed</p><details class="oep-bbhelp-preview__spoilerbox"><summary class="oep-bbhelp-preview__spoiler-summary"><span class="oep-bbhelp-preview__spoiler-label">b</span></summary><div class="oep-bbhelp-preview__spoiler-body"><p>closed</p></div></details>',
  },
  {
    why: "unclosed tags are literal (osu-web); old stripped them",
    src: "[b]unclosed bold",
    old: "<p>unclosed bold</p>",
    new: "<p>[b]unclosed bold</p>",
  },
  {
    why: "unknown tags are literal (osu-web); old stripped them",
    src: "[foo]x[/foo]",
    old: "<p>x</p>",
    new: "<p>[foo]x[/foo]</p>",
  },
  {
    why: "stray closing tags are literal (osu-web); old stripped them",
    src: "a[/b]b",
    old: "<p>ab</p>",
    new: "<p>a[/b]b</p>",
  },
  {
    why: "[*] outside a list is literal; old stripped it",
    src: "[*]outside list",
    old: "<p>outside list</p>",
    new: "<p>[*]outside list</p>",
  },
  {
    why: "inline formatting continues after a paragraph break (the HTML parser only re-opened b/i/u/a for the old string)",
    src: "[color=red]a\n\nb[/color]",
    old: '<p><span style="color:red;">a</span></p><p>b</p>',
    new: '<p><span style="color:red;">a</span></p><p><span style="color:red;">b</span></p>',
  },
  {
    why: "named quote supported (osu-web: blockquote + 'name wrote:' heading)",
    src: '[quote="peppy"]hi[/quote]',
    old: "<p>hi</p>",
    new: "<blockquote><h4>peppy wrote:</h4>hi</blockquote>",
  },
  {
    why: "[list=…] is an ordered list (osu-web); old did not support it",
    src: "[list=1][*]a[*]b[/list]",
    old: "<p>ab</p>",
    new: "<ol><li>a</li><li>b</li></ol>",
  },
  {
    why: "nested lists work (old regex was not nesting-aware)",
    src: "[list]\n[*]a\n[list]\n[*]nested\n[/list]\n[/list]",
    old: "<ul><li>a<br></li><li>nested</li></ul>",
    new: "<ul><li>a<br><ul><li>nested</li></ul></li></ul>",
  },
  {
    why: "same-tag nesting works (old lazy regex matched the inner close)",
    src: "[centre][centre]nested[/centre][/centre]",
    old: '<div style="text-align:center;">nested</div>',
    new: '<div style="text-align:center;"><div style="text-align:center;">nested</div></div>',
  },
  {
    why: "same-tag nesting works",
    src: "[b]a [b]b[/b] c[/b]",
    old: "<p><strong>a b</strong> c</p>",
    new: "<p><strong>a <strong>b</strong> c</strong></p>",
  },
  {
    why: "an opening tag without a partner is literal; the closing tag pairs with the nearest opening tag",
    src: "[b][b]x[/b]",
    old: "<p><strong>x</strong></p>",
    new: "<p>[b]<strong>x</strong></p>",
  },
  {
    why: "[quote=name] without quotes is not a quote on osu-web either (literal); old stripped the tags",
    src: "[quote=peppy]x[/quote]",
    old: "<p>x</p>",
    new: "<p>[quote=peppy]x[/quote]</p>",
  },
  {
    why: "misnested tags: the tag left open inside is shown literally (old relied on HTML parser recovery)",
    src: "[b]a[i]b[/b]c[/i]",
    old: "<p><strong>a<em>b</em></strong><em>c</em></p>",
    new: "<p><strong>a[i]b</strong>c[/i]</p>",
  },
  {
    why: "[code] content is literal (osu-web); old rendered tags inside code",
    src: "[code][b]not bold[/b][/code]",
    old: "<pre><code><strong>not bold</strong></code></pre>",
    new: "<pre><code>[b]not bold[/b]</code></pre>",
  },
  {
    why: "added [c] (osu-web inline code)",
    src: "[c]inline code[/c]",
    old: "<p>inline code</p>",
    new: "<p><code>inline code</code></p>",
  },
  {
    why: "added [left] (osu-web alignment)",
    src: "[left]x[/left]",
    old: "<p>x</p>",
    new: '<div style="text-align:left;">x</div>',
  },
  {
    why: "added [profile] as a link to the user page",
    src: "[profile=2]peppy[/profile]",
    old: "<p>peppy</p>",
    new: '<p><a href="https://osu.ppy.sh/users/2" rel="noopener noreferrer" target="_blank">peppy</a></p>',
  },
  {
    why: "added [profile] without id: /users/@name",
    src: "[profile]peppy[/profile]",
    old: "<p>peppy</p>",
    new: '<p><a href="https://osu.ppy.sh/users/@peppy" rel="noopener noreferrer" target="_blank">peppy</a></p>',
  },
  {
    why: "added [youtube] as a link (no iframe in the preview)",
    src: "[youtube]https://www.youtube.com/watch?v=dQw4w9WgXcQ[/youtube]",
    old: "<p>https://www.youtube.com/watch?v=dQw4w9WgXcQ</p>",
    new: '<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer" target="_blank">YouTube: dQw4w9WgXcQ</a></p>',
  },
  {
    why: "added [audio] as a link (no <audio> in the preview)",
    src: "[audio]https://a.com/s.mp3[/audio]",
    old: "<p>https://a.com/s.mp3</p>",
    new: '<p><a href="https://a.com/s.mp3" rel="noopener noreferrer" target="_blank">https://a.com/s.mp3</a></p>',
  },
  {
    why: "relative URLs rejected (osu-web only parses absolute http(s)/ftp [url])",
    src: "[url=/home]x[/url]",
    old: '<p><a href="https://osu.ppy.sh/home" rel="noopener noreferrer" target="_blank">x</a></p>',
    new: "<p>x</p>",
  },
  {
    why: "relative image URLs rejected; invalid [img] is dropped as before",
    src: "[img]/images/x.png[/img]",
    old: '<p><img alt="preview image" loading="lazy" referrerpolicy="no-referrer" src="https://osu.ppy.sh/images/x.png"></p>',
    new: "",
  },
  {
    why: "invalid [url] content is parsed as BBCode (old produced broken markup)",
    src: "[url][img]https://a.com/x.png[/img][/url]",
    old: '<p>" target="_blank" rel="noopener noreferrer"&gt;https://osu.ppy.sh/<img alt="preview image" loading="lazy" referrerpolicy="no-referrer" src="https://a.com/x.png"></p>',
    new: '<p><img alt="preview image" loading="lazy" referrerpolicy="no-referrer" src="https://a.com/x.png"></p>',
  },
  {
    why: "B98: osu-web tag names are case-sensitive; upper-case tags stay text",
    src: "[B]upper[/B] [I]case[/i]",
    old: "<p><strong>upper</strong> <em>case</em></p>",
    new: "<p>[B]upper[/B] [I]case[/i]</p>",
  },
  {
    why: "B98: a colour osu-web rejects leaves the tags as text (BBCodeForDB parseColour)",
    src: "[color=#ff66aa]pink[/color] [color=red]red[/color] [color=bad;x]bad[/color] [color=]empty[/color]",
    old: '<p><span style="color:#ff66aa;">pink</span> <span style="color:red;">red</span> <span>bad</span> <span>empty</span></p>',
    new: '<p><span style="color:#ff66aa;">pink</span> <span style="color:red;">red</span> [color=bad;x]bad[/color] [color=]empty[/color]</p>',
  },
  {
    why: "B98: osu-web takes only numeric sizes; size names stay text (BBCodeForDB parseSize)",
    src: "[size=150]big[/size] [size=50]small[/size] [size=tiny]tiny[/size] [size=large]large[/size] [size=999]clamped[/size] [size=abc]bad[/size]",
    old: '<p><span style="font-size:150%;">big</span> <span style="font-size:50%;">small</span> <span style="font-size:0.75em;">tiny</span> <span style="font-size:1.2em;">large</span> <span style="font-size:200%;">clamped</span> <span style="font-size:1em;">bad</span></p>',
    new: '<p><span style="font-size:150%;">big</span> <span style="font-size:50%;">small</span> [size=tiny]tiny[/size] [size=large]large[/size] <span style="font-size:200%;">clamped</span> [size=abc]bad[/size]</p>',
  },
];

export const MARKDOWN_DIFFS = [
  {
    why: "B73: image src no longer double-escaped",
    src: "![a](https://x.com/i.png?a=1&b=2)",
    old: '<p><img alt="a" loading="lazy" referrerpolicy="no-referrer" src="https://x.com/i.png?a=1&amp;amp;b=2"></p>',
    new: '<p><img alt="a" loading="lazy" referrerpolicy="no-referrer" src="https://x.com/i.png?a=1&amp;b=2"></p>',
  },
  {
    why: "image alt no longer double-escaped (same cause as B73)",
    src: "![a&b](https://x.com/i.png)",
    old: '<p><img alt="a&amp;amp;b" loading="lazy" referrerpolicy="no-referrer" src="https://x.com/i.png"></p>',
    new: '<p><img alt="a&amp;b" loading="lazy" referrerpolicy="no-referrer" src="https://x.com/i.png"></p>',
  },
  {
    why: "_ does not emphasize inside words (CommonMark)",
    src: "snake_case_name",
    old: "<p>snake<em>case</em>name</p>",
    new: "<p>snake_case_name</p>",
  },
  {
    why: "delimiters must hug their content (CommonMark flanking)",
    src: "2 * 3 * 4",
    old: "<p>2 <em> 3 </em> 4</p>",
    new: "<p>2 * 3 * 4</p>",
  },
  {
    why: "code span content is literal",
    src: "`**not bold**`",
    old: "<p><code><strong>not bold</strong></code></p>",
    new: "<p><code>**not bold**</code></p>",
  },
  {
    why: "code span content is literal",
    src: "`![a](https://x.com/a.png)`",
    old: '<p><code><img alt="a" loading="lazy" referrerpolicy="no-referrer" src="https://x.com/a.png"></code></p>',
    new: "<p><code>![a](https://x.com/a.png)</code></p>",
  },
  {
    why: "emphasis no longer runs inside link URLs (old broke the link, B04 class)",
    src: "[a](https://x.com/a_b_c)",
    old: "<p>a</p>",
    new: '<p><a href="https://x.com/a_b_c" rel="noopener noreferrer" target="_blank">a</a></p>',
  },
  {
    why: "emphasis nests (second pass)",
    src: "**a *b* c**",
    old: "<p>*<em>a </em>b<em> c</em>*</p>",
    new: "<p><strong>a <em>b</em> c</strong></p>",
  },
  {
    why: "relative image URLs rejected",
    src: "![a](/relative.png)",
    old: '<p><img alt="a" loading="lazy" referrerpolicy="no-referrer" src="https://osu.ppy.sh/relative.png"></p>',
    new: "<p>![a](/relative.png)</p>",
  },
];
