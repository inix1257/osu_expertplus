import { test } from "node:test";
import assert from "node:assert/strict";
import { firstBbcodeFormatIssue } from "../../src/editor/bbcode-helper/linter.js";
import { LEGACY_BBCODE, legacySource } from "../osu/legacy.mjs";

/** The old linter with its tag set and name parser. */
function oldLinter() {
  const all = [
    legacySource(LEGACY_BBCODE, "_parseBbcodeTagName"),
    legacySource(LEGACY_BBCODE, "_firstBbcodeFormatIssue"),
  ].join("\n");
  const tags = new Set(
    "b i u s strike color size spoiler box spoilerbox quote c code centre right url profile list * email img imagemap youtube audio heading notice".split(
      " ",
    ),
  );
  return new Function(
    "KNOWN_BBCODE_TAGS",
    `"use strict";\n${all}\nreturn _firstBbcodeFormatIssue;`,
  )(tags);
}

test("plain bracket text is not reported (B46)", () => {
  for (const text of [
    "",
    "plain text",
    "[#1] first item",
    "the [2024] season",
    "a ] b",
    "a [ ] b",
    "x [ y",
    "smile :]",
    "[[b]bold[/b]]",
    "[unknown]x",
    "[b [i]x[/i]",
  ]) {
    assert.equal(firstBbcodeFormatIssue(text), null, text);
  }
});

test("[code] content is not checked (B46)", () => {
  assert.equal(firstBbcodeFormatIssue("[code][b]x[/i][/code]"), null);
  assert.equal(firstBbcodeFormatIssue("[CODE]a ] [/b][/Code] [b]x[/b]"), null);
  assert.equal(
    firstBbcodeFormatIssue("[code]x[/code][/b]"),
    "Closing tag `[/b]` has no matching opening tag.",
  );
  assert.equal(
    firstBbcodeFormatIssue("[code][b]"),
    "Unclosed tag `[code]` found.",
  );
});

test("list items need no closing tag", () => {
  assert.equal(firstBbcodeFormatIssue("[list][*]a[*]b[/list]"), null);
  assert.equal(firstBbcodeFormatIssue("[list][*]a[/*][*]b[/*][/list]"), null);
});

test("structure problems in known tags are reported", () => {
  const cases = [
    ["[b]x", "Unclosed tag `[b]` found."],
    ["x[/b]", "Closing tag `[/b]` has no matching opening tag."],
    ["[b][i]x[/b][/i]", "Mismatched tag order: expected `[/i]` before `[/b]`."],
    [
      "[color=red]x[/size]",
      "Mismatched tag order: expected `[/color]` before `[/size]`.",
    ],
    ["text [b", "Missing closing bracket `]` for a BBCode tag."],
    ["[color=#ff0000", "Missing closing bracket `]` for a BBCode tag."],
  ];
  for (const [text, issue] of cases) {
    assert.equal(firstBbcodeFormatIssue(text), issue, text);
  }
});

test("known tags get the same answer as from the old linter", () => {
  const old = oldLinter();
  for (const text of [
    "[b]x[/b]",
    "[centre][size=150][color=#fff]hi[/color][/size][/centre]",
    "[url=https://osu.ppy.sh]home[/url] [img]https://a/b.png[/img]",
    "[box=title]\n[list]\n[*]a\n[*]b\n[/list]\n[/box]",
    '[quote="peppy"]x[/quote]',
    "[b]x",
    "x[/i]",
    "[b][i]x[/b][/i]",
    "[unknown] text",
  ]) {
    assert.equal(firstBbcodeFormatIssue(text), old(text), text);
  }
  // What B46 changes.
  assert.equal(old("[#1] item"), "Invalid tag name in `[#1]`.");
  assert.equal(old("a ] b"), "Unexpected closing bracket `]`.");
  assert.equal(
    old("[code][b][/code]"),
    "Mismatched tag order: expected `[/b]` before `[/code]`.",
  );
});
