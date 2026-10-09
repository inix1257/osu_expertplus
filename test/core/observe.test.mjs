import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createObserverHub } from "../../src/core/observe.js";

/** MutationObserver callbacks run as microtasks. */
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

/**
 * Hub over a fresh jsdom document with manual frame/timer queues and clock.
 * The module reads `MutationObserver` and `Element` from globals.
 */
function setup(extra = {}) {
  const { window } = new JSDOM(
    "<!doctype html><html><head></head><body></body></html>",
  );
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.Element = window.Element;
  const frames = [];
  const timers = new Map();
  let timerId = 0;
  let clock = 0;
  const warnings = [];
  const hub = createObserverHub({
    root: () => window.document.documentElement,
    now: () => clock,
    requestFrame: (cb) => frames.push(cb),
    setTimer: (cb) => {
      timers.set(++timerId, cb);
      return timerId;
    },
    clearTimer: (id) => timers.delete(id),
    log: { warn: (...a) => warnings.push(a.join(" ")), error() {} },
    ...extra,
  });
  return {
    window,
    document: window.document,
    hub,
    warnings,
    runFrames() {
      frames.splice(0).forEach((cb) => cb());
    },
    runTimers() {
      const cbs = [...timers.values()];
      timers.clear();
      cbs.forEach((cb) => cb());
    },
    pendingTimers: () => timers.size,
    advance(ms) {
      clock += ms;
    },
  };
}

function add(document, html, parent = document.body) {
  const t = document.createElement("template");
  t.innerHTML = html;
  const node = t.content.firstElementChild;
  parent.appendChild(node);
  return node;
}

test("selector: dispatches only for added/removed nodes that match or contain it", async () => {
  const { document, hub } = setup();
  const batches = [];
  hub.subscribe({ selector: ".hit", schedule: "sync" }, (b) =>
    batches.push(b.added.map((n) => n.className)),
  );
  add(document, `<div class="miss"></div>`);
  await flushMicrotasks();
  assert.deepEqual(batches, []);
  add(document, `<div class="wrap"><span class="hit"></span></div>`);
  const direct = add(document, `<p class="hit"></p>`);
  await flushMicrotasks();
  assert.deepEqual(batches, [["wrap", "hit"]]);
  direct.remove();
  await flushMicrotasks();
  assert.equal(batches.length, 2); // removal dispatches, nothing added
  assert.deepEqual(batches[1], []);
});

test("no selector: every childList change, every added element", async () => {
  const { document, hub } = setup();
  const seen = [];
  hub.subscribe({ schedule: "sync" }, (b) => seen.push(b.added.length));
  add(document, `<i></i>`);
  document.body.appendChild(document.createTextNode("x"));
  await flushMicrotasks();
  assert.deepEqual(seen, [1]);
});

test("attributes: only listed names inside the selector", async () => {
  const { document, hub } = setup();
  const box = add(document, `<div class="box"><b></b></div>`);
  const outside = add(document, `<div></div>`);
  await flushMicrotasks();
  const seen = [];
  hub.subscribe(
    { selector: ".box", attributes: ["class"], schedule: "sync" },
    (b) => seen.push(b.records.map((r) => r.attributeName)),
  );
  box.firstElementChild.setAttribute("class", "x");
  box.firstElementChild.setAttribute("title", "ignored");
  outside.setAttribute("class", "ignored");
  await flushMicrotasks();
  assert.deepEqual(seen, [["class"]]);
});

test("characterData only when asked for", async () => {
  const { document, hub } = setup();
  const p = add(document, `<p class="t">a</p>`);
  await flushMicrotasks();
  let plain = 0;
  let text = 0;
  hub.subscribe({ selector: ".t", schedule: "sync" }, () => plain++);
  hub.subscribe(
    { selector: ".t", characterData: true, schedule: "sync" },
    () => text++,
  );
  p.firstChild.data = "b";
  await flushMicrotasks();
  assert.equal(plain, 0);
  assert.equal(text, 1);
});

test("raf schedule batches records until the frame runs", async () => {
  const { document, hub, runFrames } = setup();
  const batches = [];
  hub.subscribe({}, (b) => batches.push(b.added.length));
  add(document, `<i></i>`);
  await flushMicrotasks();
  add(document, `<i></i>`);
  await flushMicrotasks();
  assert.deepEqual(batches, []);
  runFrames();
  assert.deepEqual(batches, [2]);
});

test("numeric schedule debounces (trailing)", async () => {
  const { document, hub, runTimers, pendingTimers } = setup();
  const batches = [];
  hub.subscribe({ schedule: 200 }, (b) => batches.push(b.added.length));
  add(document, `<i></i>`);
  await flushMicrotasks();
  add(document, `<i></i>`);
  await flushMicrotasks();
  assert.equal(pendingTimers(), 1);
  runTimers();
  assert.deepEqual(batches, [2]);
});

test("unsubscribe and signal stop dispatch; the observer goes away when empty", async () => {
  const { window, document, hub } = setup();
  let a = 0;
  let b = 0;
  const unsubscribe = hub.subscribe({ schedule: "sync" }, () => a++);
  const ac = new window.AbortController();
  hub.subscribe({ schedule: "sync", signal: ac.signal }, () => b++);
  unsubscribe();
  unsubscribe();
  ac.abort();
  add(document, `<i></i>`);
  await flushMicrotasks();
  assert.equal(a + b, 0);
  assert.deepEqual(hub.stats(), []);
  const pre = new window.AbortController();
  pre.abort();
  hub.subscribe({ signal: pre.signal }, () => {});
  assert.deepEqual(hub.stats(), []);
});

test("mutate drops our own records but keeps earlier page records", async () => {
  const { document, hub } = setup();
  const seen = [];
  hub.subscribe({ schedule: "sync" }, (b) =>
    seen.push(b.added.map((n) => n.tagName)),
  );
  add(document, `<section></section>`); // page change, still pending
  hub.mutate(() => {
    add(document, `<aside></aside>`); // ours
  });
  await flushMicrotasks();
  assert.deepEqual(seen, [["SECTION"]]);
});

test("adding an attribute subscriber reconfigures without losing records", async () => {
  const { document, hub } = setup();
  const box = add(document, `<div></div>`);
  await flushMicrotasks();
  const added = [];
  hub.subscribe({ schedule: "sync" }, (b) => added.push(b.added.length));
  add(document, `<i></i>`); // pending when the next subscribe reconfigures
  const attrs = [];
  hub.subscribe({ attributes: ["data-x"], schedule: "sync" }, (b) =>
    attrs.push(b.records.length),
  );
  box.setAttribute("data-x", "1");
  await flushMicrotasks();
  assert.deepEqual(added, [1]);
  assert.deepEqual(attrs, [1]);
});

test("loop detector warns once after sustained high call rates", async () => {
  const { document, hub, warnings, advance } = setup({
    loopRate: 3,
    loopSeconds: 2,
  });
  hub.subscribe({ schedule: "sync", label: "test/loop" }, () => {});
  // 3 calls per second for 4 seconds
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < 3; i++) {
      add(document, `<i></i>`);
      await flushMicrotasks();
      advance(300);
    }
    advance(100);
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /test\/loop/);
  assert.equal(hub.stats()[0].warned, true);
  assert.equal(hub.stats()[0].calls, 12);
});

test("loop detector stays quiet for slow subscribers", async () => {
  const { document, hub, warnings, advance } = setup({
    loopRate: 3,
    loopSeconds: 2,
  });
  hub.subscribe({ schedule: "sync" }, () => {});
  for (let i = 0; i < 12; i++) {
    add(document, `<i></i>`);
    await flushMicrotasks();
    advance(600);
  }
  assert.deepEqual(warnings, []);
});

test("a throwing subscriber does not stop the others", async () => {
  const { document, hub } = setup();
  let ok = 0;
  hub.subscribe({ schedule: "sync" }, () => {
    throw new Error("boom");
  });
  hub.subscribe({ schedule: "sync" }, () => ok++);
  add(document, `<i></i>`);
  await flushMicrotasks();
  assert.equal(ok, 1);
});
