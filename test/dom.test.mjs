import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

/** @param {string} locale osu-web's `window.currentLocale` */
function parseIn(locale) {
  const { OsuExpertPlus } = loadScripts(["src/utils/dom.js"], {
    lang: locale,
    globals: { currentLocale: locale },
  });
  return OsuExpertPlus.dom.parseLocaleNumber;
}

test("parseLocaleNumber: en", () => {
  const parse = parseIn("en");
  assert.equal(parse("1,234.56"), 1234.56);
  assert.equal(parse("1,234"), 1234);
  assert.equal(parse("987.6"), 987.6);
  assert.ok(Number.isNaN(parse("")));
});

test("parseLocaleNumber: de", () => {
  const parse = parseIn("de");
  assert.equal(parse("1.234,56"), 1234.56);
  assert.equal(parse("1.234"), 1234);
  assert.equal(parse("987,6"), 987.6);
});

test("parseLocaleNumber: fr (narrow no-break space grouping)", () => {
  const parse = parseIn("fr");
  assert.equal(parse("1\u202F234,56"), 1234.56);
  assert.equal(parse("1\u00A0234"), 1234);
  assert.equal(parse("987,6"), 987.6);
});

test("parseLocaleNumber: ko", () => {
  const parse = parseIn("ko");
  assert.equal(parse("1,234.56"), 1234.56);
  assert.equal(parse("1,234"), 1234);
});

test("el skips null/undefined/false attributes and writes true as empty (B63)", () => {
  const { OsuExpertPlus } = loadScripts(["src/utils/dom.js"]);
  const node = OsuExpertPlus.dom.el(
    "button",
    {
      class: "a b",
      hidden: null,
      title: undefined,
      "data-x": false,
      disabled: true,
      "aria-pressed": "false",
      tabindex: 0,
    },
    "label",
  );
  assert.equal(node.className, "a b");
  assert.equal(node.hasAttribute("hidden"), false);
  assert.equal(node.hasAttribute("title"), false);
  assert.equal(node.hasAttribute("data-x"), false);
  assert.equal(node.getAttribute("disabled"), "");
  assert.equal(node.getAttribute("aria-pressed"), "false");
  assert.equal(node.getAttribute("tabindex"), "0");
  assert.equal(node.textContent, "label");
});

function loadDom() {
  const { window, OsuExpertPlus } = loadScripts(["src/utils/dom.js"]);
  return { window, document: window.document, dom: OsuExpertPlus.dom };
}

test("waitForElement resolves with an existing or later element", async () => {
  const { document, dom } = loadDom();
  document.body.innerHTML = `<p class="a"></p>`;
  assert.equal(await dom.waitForElement(".a"), document.querySelector(".a"));
  const later = dom.waitForElement(".b", { timeout: 1000 });
  const b = document.createElement("div");
  b.className = "b";
  document.body.appendChild(b);
  assert.equal(await later, b);
});

test("waitForElement rejects after the timeout", async () => {
  const { dom } = loadDom();
  await assert.rejects(dom.waitForElement(".missing", 20), /within 20ms/);
});

test("waitForElement rejects with AbortError when the signal aborts", async () => {
  const { window, dom } = loadDom();
  const ac = new window.AbortController();
  const p = dom.waitForElement(".missing", {
    timeout: 5000,
    signal: ac.signal,
  });
  ac.abort();
  await assert.rejects(p, (err) => err.name === "AbortError");
  const pre = new window.AbortController();
  pre.abort();
  await assert.rejects(
    dom.waitForElement(".x", 5000, { signal: pre.signal }),
    (err) => err.name === "AbortError",
  );
});

test("waitForElement accepts the positional root", async () => {
  const { document, dom } = loadDom();
  document.body.innerHTML = `<section><i class="c"></i></section><i class="d"></i>`;
  const section = document.querySelector("section");
  assert.equal(
    await dom.waitForElement(".c", 100, section),
    section.firstElementChild,
  );
  await assert.rejects(dom.waitForElement(".d", 20, section));
});

test("waitForStaleElementToLeave resolves when the node leaves, or on abort rejects", async () => {
  const { window, document, dom } = loadDom();
  await dom.waitForStaleElementToLeave(".none"); // absent: resolves at once
  document.body.innerHTML = `<div class="old"></div>`;
  const p = dom.waitForStaleElementToLeave(".old", 1000);
  document.querySelector(".old").remove();
  await p;
  document.body.innerHTML = `<div class="old"></div>`;
  const ac = new window.AbortController();
  const q = dom.waitForStaleElementToLeave(".old", { signal: ac.signal });
  ac.abort();
  await assert.rejects(q, (err) => err.name === "AbortError");
  await dom.waitForStaleElementToLeave(".old", 10); // timeout resolves
});

test("manageStyle.acquire keeps the style until the last release (B64)", () => {
  const { document, dom } = loadDom();
  const a = dom.manageStyle("oep-test-style", "p{}");
  const b = dom.manageStyle("oep-test-style", "p{}");
  const releaseA = a.acquire();
  const releaseB = b.acquire();
  assert.equal(document.querySelectorAll("#oep-test-style").length, 1);
  releaseA();
  releaseA(); // idempotent
  assert.ok(document.getElementById("oep-test-style"));
  releaseB();
  assert.equal(document.getElementById("oep-test-style"), null);
  a.inject();
  assert.ok(document.getElementById("oep-test-style"));
  a.remove();
  assert.equal(document.getElementById("oep-test-style"), null);
});
