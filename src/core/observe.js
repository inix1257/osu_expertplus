/**
 * One shared MutationObserver on the document for every feature, instead of
 * one document-wide observer per feature (WS-21).
 *
 *   const unsubscribe = observe.subscribe(
 *     {
 *       selector: ".beatmapset-scoreboard", // added/removed node matches or contains it
 *       attributes: ["class"],               // attribute changes inside `selector`
 *       characterData: false,                // text changes inside `selector`
 *       schedule: "raf",                     // "raf" | "sync" | debounce ms
 *       signal,                              // unsubscribes on abort
 *       label: "scoreboard/table-enhance",   // diagnostics
 *     },
 *     ({ records, added }) => { ... },
 *   );
 *
 * `added` lists the added elements that match or contain `selector` (every
 * added element when there is no selector), in record order.
 *
 * Scheduling: "sync" calls back inside the observer callback (same timing as
 * a plain MutationObserver); a number debounces like `setTimeout` (trailing);
 * "raf" batches to the next animation frame, which does not run in hidden
 * tabs, so background tabs get updates only once visible.
 */

import { createLogger } from "./log.js";

/**
 * @typedef {{
 *   selector?: string,
 *   attributes?: string[],
 *   characterData?: boolean,
 *   schedule?: "raf" | "sync" | number,
 *   signal?: AbortSignal,
 *   label?: string,
 * }} SubscribeOptions
 * @typedef {{ records: MutationRecord[], added: Element[] }} Batch
 * @typedef {(batch: Batch) => void} Callback
 */

/**
 * @param {{
 *   root?: () => Node,
 *   now?: () => number,
 *   requestFrame?: (cb: () => void) => unknown,
 *   setTimer?: (cb: () => void, ms: number) => unknown,
 *   clearTimer?: (id: unknown) => void,
 *   log?: { warn: (...args: unknown[]) => void, error: (...args: unknown[]) => void },
 *   loopRate?: number,
 *   loopSeconds?: number,
 * }} [deps]  Injectable for tests. `loopRate` calls/second sustained for
 *   `loopSeconds` seconds triggers one loop warning per subscriber.
 */
export function createObserverHub(deps = {}) {
  const getRoot = deps.root ?? (() => document.documentElement);
  const now = deps.now ?? (() => performance.now());
  const requestFrame =
    deps.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const setTimer = deps.setTimer ?? ((cb, ms) => window.setTimeout(cb, ms));
  const clearTimer = deps.clearTimer ?? ((id) => window.clearTimeout(id));
  const log = deps.log ?? createLogger("observe");
  const loopRate = deps.loopRate ?? 10;
  const loopSeconds = deps.loopSeconds ?? 5;

  /**
   * @typedef {{
   *   opts: SubscribeOptions, callback: Callback, attrs: Set<string>,
   *   pending: MutationRecord[], timer: unknown, frame: boolean, active: boolean,
   *   calls: number, bucketStart: number, bucketCalls: number,
   *   hotSeconds: number, warned: boolean,
   * }} Sub
   */
  /** @type {Set<Sub>} */
  const subs = new Set();
  /** @type {MutationObserver|null} */
  let observer = null;
  /** Observer options key, to know when the union of options changed. */
  let configKey = "";

  /** @param {Node} node @param {string} selector */
  function nodeHits(node, selector) {
    if (!(node instanceof Element)) return false;
    return node.matches(selector) || node.querySelector(selector) !== null;
  }

  /** @param {Node} target @param {string|undefined} selector */
  function insideSelector(target, selector) {
    if (!selector) return true;
    const elNode = target instanceof Element ? target : target.parentElement;
    return !!elNode?.closest(selector);
  }

  /** @param {Sub} sub @param {MutationRecord} r */
  function relevant(sub, r) {
    const { selector, characterData } = sub.opts;
    if (r.type === "childList") {
      if (!selector)
        return r.addedNodes.length > 0 || r.removedNodes.length > 0;
      for (const n of r.addedNodes) if (nodeHits(n, selector)) return true;
      for (const n of r.removedNodes) if (nodeHits(n, selector)) return true;
      return false;
    }
    if (r.type === "attributes") {
      return (
        sub.attrs.has(r.attributeName) && insideSelector(r.target, selector)
      );
    }
    if (r.type === "characterData") {
      return !!characterData && insideSelector(r.target, selector);
    }
    return false;
  }

  /** @param {Sub} sub @param {MutationRecord[]} records */
  function addedOf(sub, records) {
    const { selector } = sub.opts;
    /** @type {Element[]} */
    const added = [];
    for (const r of records) {
      if (r.type !== "childList") continue;
      for (const n of r.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (!selector || nodeHits(n, selector)) added.push(n);
      }
    }
    return added;
  }

  /** @param {Sub} sub */
  function countCall(sub) {
    sub.calls++;
    const t = now();
    if (t - sub.bucketStart >= 1000) {
      // Seconds skipped without calls break the streak.
      const elapsed = Math.floor((t - sub.bucketStart) / 1000);
      if (elapsed === 1 && sub.bucketCalls >= loopRate) sub.hotSeconds++;
      else sub.hotSeconds = 0;
      sub.bucketStart = t;
      sub.bucketCalls = 0;
    }
    sub.bucketCalls++;
    if (!sub.warned && sub.hotSeconds >= loopSeconds) {
      sub.warned = true;
      log.warn(
        `possible observer loop: "${sub.opts.label ?? "unlabelled"}" ran ` +
          `${loopRate}+ times/s for ${loopSeconds}s`,
      );
    }
  }

  /** @param {Sub} sub */
  function flush(sub) {
    sub.timer = null;
    sub.frame = false;
    if (!sub.active || sub.pending.length === 0) return;
    const records = sub.pending;
    sub.pending = [];
    countCall(sub);
    try {
      sub.callback({ records, added: addedOf(sub, records) });
    } catch (err) {
      log.error(`subscriber "${sub.opts.label ?? "unlabelled"}" threw:`, err);
    }
  }

  /** @param {MutationRecord[]} records */
  function dispatch(records) {
    for (const sub of [...subs]) {
      if (!sub.active) continue;
      let hit = false;
      for (const r of records) {
        if (relevant(sub, r)) {
          sub.pending.push(r);
          hit = true;
        }
      }
      if (!hit) continue;
      const { schedule = "raf" } = sub.opts;
      if (schedule === "sync") {
        flush(sub);
      } else if (typeof schedule === "number") {
        if (sub.timer != null) clearTimer(sub.timer);
        sub.timer = setTimer(() => flush(sub), schedule);
      } else if (!sub.frame) {
        sub.frame = true;
        requestFrame(() => flush(sub));
      }
    }
  }

  function reconfigure() {
    if (subs.size === 0) {
      if (observer) dispatch(observer.takeRecords());
      observer?.disconnect();
      observer = null;
      configKey = "";
      return;
    }
    const attrs = new Set();
    let characterData = false;
    for (const sub of subs) {
      sub.attrs.forEach((a) => attrs.add(a));
      if (sub.opts.characterData) characterData = true;
    }
    const attributeFilter = [...attrs].sort();
    const key = `${attributeFilter.join(",")}|${characterData}`;
    if (observer && key === configKey) return;
    if (observer) {
      dispatch(observer.takeRecords());
      observer.disconnect();
    } else {
      observer = new MutationObserver(dispatch);
    }
    configKey = key;
    /** @type {MutationObserverInit} */
    const init = { childList: true, subtree: true };
    if (attributeFilter.length) {
      init.attributes = true;
      init.attributeFilter = attributeFilter;
    }
    if (characterData) init.characterData = true;
    observer.observe(getRoot(), init);
  }

  /**
   * @param {SubscribeOptions} opts
   * @param {Callback} callback
   * @returns {() => void} unsubscribe (idempotent)
   */
  function subscribe(opts, callback) {
    if (opts.signal?.aborted) return () => {};
    // Records from before this call belong to the existing subscribers only.
    if (observer) dispatch(observer.takeRecords());
    /** @type {Sub} */
    const sub = {
      opts,
      callback,
      attrs: new Set(opts.attributes ?? []),
      pending: [],
      timer: null,
      frame: false,
      active: true,
      calls: 0,
      bucketStart: now(),
      bucketCalls: 0,
      hotSeconds: 0,
      warned: false,
    };
    subs.add(sub);
    reconfigure();
    const unsubscribe = () => {
      if (!sub.active) return;
      sub.active = false;
      sub.pending = [];
      if (sub.timer != null) clearTimer(sub.timer);
      sub.timer = null;
      subs.delete(sub);
      opts.signal?.removeEventListener("abort", unsubscribe);
      reconfigure();
    };
    opts.signal?.addEventListener("abort", unsubscribe, { once: true });
    return unsubscribe;
  }

  /**
   * Runs `fn` (our own DOM writes) and drops the mutation records it caused,
   * so subscribers are not re-triggered by them. Records that were already
   * pending are dispatched first.
   *
   * Do not trigger page code synchronously inside `fn` (e.g. `el.click()`):
   * the mutations it makes are dropped too.
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  function mutate(fn) {
    if (!observer) return fn();
    dispatch(observer.takeRecords());
    try {
      return fn();
    } finally {
      observer?.takeRecords();
    }
  }

  /** Per-subscriber call counts, for debugging loops. */
  function stats() {
    return [...subs].map((s) => ({
      label: s.opts.label ?? "unlabelled",
      calls: s.calls,
      hotSeconds: s.hotSeconds,
      warned: s.warned,
    }));
  }

  return { subscribe, mutate, stats };
}

/** The document-wide hub. */
export const observe = createObserverHub();
