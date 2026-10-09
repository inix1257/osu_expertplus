import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const URL_TOTAL =
  "https://osu.ppy.sh/beatmapsets/1/discussion/-/generalAll/total";

/** IntersectionObserver stand-in: tests decide when rows become visible. */
class FakeIO {
  static all = [];
  constructor(cb) {
    this.cb = cb;
    this.targets = new Set();
    this.disconnected = false;
    FakeIO.all.push(this);
  }
  observe(t) {
    this.targets.add(t);
  }
  unobserve(t) {
    this.targets.delete(t);
  }
  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }
  showAll() {
    this.cb(
      [...this.targets].map((target) => ({ target, isIntersecting: true })),
    );
  }
}

function setup(getUsers) {
  const { window } = loadScripts(["src/utils/dom.js"], { url: URL_TOTAL });
  window.OsuExpertPlus.api = { getUsers };
  FakeIO.all = [];
  for (const key of [
    "window",
    "document",
    "location",
    "Element",
    "HTMLElement",
    "HTMLAnchorElement",
    "HTMLImageElement",
    "MutationObserver",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  globalThis.IntersectionObserver = FakeIO;
  return window;
}

const QTIP = `
  <div class="qtip qtip--user-list" id="tip">
    <div class="qtip-content">
      <a href="/users/11" title="Alice"><img src="https://a.ppy.sh/11"></a>
      <a href="/users/22" title="Bob"><img src="https://a.ppy.sh/22"></a>
    </div>
  </div>`;

const flush = () => new Promise((r) => setTimeout(r, 150));
/** MutationObserver callbacks run as a microtask after the insert. */
const tick = () => new Promise((r) => setTimeout(r, 0));
const names = (doc) =>
  [...doc.querySelectorAll(".oep-discussion-voters-tooltip__name")].map(
    (n) => n.textContent,
  );

test("batched lookup fills names; qTip nodes are hidden, not removed (B60)", async () => {
  const calls = [];
  const window = setup(async (ids) => {
    calls.push(ids);
    return ids.map((id) => ({
      id: Number(id),
      username: `name${id}`,
      avatar_url: `https://a.ppy.sh/${id}?x`,
    }));
  });
  const { startDiscussionVotersTooltips } =
    await import("../../src/features/discussion/voters.js");
  const doc = window.document;
  const stop = startDiscussionVotersTooltips(1);
  try {
    doc.body.insertAdjacentHTML("beforeend", QTIP);
    await tick();
    const tip = doc.getElementById("tip");
    assert.equal(tip.getAttribute("data-oep-discussion-voters-tooltip"), "1");
    const content = tip.querySelector(".qtip-content");
    assert.ok(content, "qTip content kept");
    assert.equal(content.hidden, true);
    assert.deepEqual(names(doc), ["Alice", "Bob"]);

    FakeIO.all[0].showAll();
    await flush();
    assert.deepEqual(calls, [["11", "22"]], "one request for both rows");
    assert.deepEqual(names(doc), ["name11", "name22"]);
    assert.equal(FakeIO.all[0].disconnected, true, "done after all rows");
  } finally {
    stop();
  }
  const tip = doc.getElementById("tip");
  assert.equal(tip.querySelector("[data-oep-voters-list]"), null);
  assert.equal(tip.querySelector(".qtip-content").hidden, false);
});

test("a failed lookup keeps the names and is retried later (B60)", async () => {
  let fail = true;
  const calls = [];
  const window = setup(async (ids) => {
    calls.push(ids);
    if (fail) throw new Error("no credentials");
    return ids.map((id) => ({ id: Number(id), username: `ok${id}` }));
  });
  const { startDiscussionVotersTooltips } =
    await import("../../src/features/discussion/voters.js");
  const doc = window.document;
  let stop = startDiscussionVotersTooltips(1);
  try {
    doc.body.insertAdjacentHTML(
      "beforeend",
      QTIP.replace(/\/users\/(\d+)/g, "/users/9$1").replace(
        /a\.ppy\.sh\/(\d+)/g,
        "a.ppy.sh/9$1",
      ),
    );
    await tick();
    FakeIO.all[0].showAll();
    await flush();
    assert.deepEqual(names(doc), ["Alice", "Bob"], "not 'User 911'");
  } finally {
    stop();
  }

  // Next page visit: the failure was not cached, so it asks again.
  fail = false;
  doc.body.innerHTML = "";
  stop = startDiscussionVotersTooltips(1);
  try {
    doc.body.insertAdjacentHTML(
      "beforeend",
      QTIP.replace(/\/users\/(\d+)/g, "/users/9$1").replace(
        /a\.ppy\.sh\/(\d+)/g,
        "a.ppy.sh/9$1",
      ),
    );
    await tick();
    FakeIO.all.at(-1).showAll();
    await flush();
    assert.equal(calls.length, 2);
    assert.deepEqual(names(doc), ["ok911", "ok922"]);
  } finally {
    stop();
  }
});

test("only qTip roots are rewritten; cleanup disconnects row observers (B61)", async () => {
  const window = setup(async () => []);
  const { startDiscussionVotersTooltips } =
    await import("../../src/features/discussion/voters.js");
  const doc = window.document;
  const stop = startDiscussionVotersTooltips(1);
  doc.body.insertAdjacentHTML(
    "beforeend",
    `<div role="tooltip" id="plain"><a href="/users/5" title="E"></a></div>`,
  );
  await tick();
  assert.equal(
    doc
      .getElementById("plain")
      .hasAttribute("data-oep-discussion-voters-tooltip"),
    false,
  );
  doc.body.insertAdjacentHTML("beforeend", QTIP);
  await tick();
  const io = FakeIO.all.at(-1);
  assert.equal(io.disconnected, false);
  stop();
  assert.equal(io.disconnected, true);
});
