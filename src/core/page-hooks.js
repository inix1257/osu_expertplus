/**
 * The page's `fetch` and `XMLHttpRequest`, hooked once and shared (WS-22).
 *
 * `install()` patches the page window the first time it is called and never
 * restores it; features change behaviour only by adding and removing
 * subscribers. This avoids stacked or wrongly restored patches (B24).
 *
 * - `addRequestRewriter(fn)`: `fn(url) → url` for page fetch/XHR requests.
 * - `addJsonResponseListener({ match, onJson })`: parsed JSON of successful
 *   (2xx) page responses whose absolute URL passes `match`. XHR responses are
 *   read only after `match` passes, and only for text or json response types
 *   (B23).
 * - `nativeFetch()`: the page's fetch from before the hook, for requests that
 *   must not reach the listeners.
 */

import { createLogger } from "./log.js";
import { exposeToPage, pageWindow } from "./page-window.js";

const log = createLogger("page-hooks");

/** @type {Set<(url: string) => string>} */
const rewriters = new Set();
/**
 * @typedef {{ match: (url: string) => boolean,
 *   onJson: (url: string, json: unknown) => void }} JsonListener
 * @type {Set<JsonListener>}
 */
const listeners = new Set();

let installed = false;
/** @type {typeof fetch | null} */
let originalFetch = null;
/** @type {Window | null} */
let hookedWindow = null;

/** @param {string} url */
function rewriteUrl(url) {
  let out = url;
  for (const fn of rewriters) {
    try {
      const next = fn(out);
      if (typeof next === "string") out = next;
    } catch (err) {
      log.warn("request rewriter threw:", err);
    }
  }
  return out;
}

/**
 * @param {string} url
 * @returns {string|null}
 */
function absoluteUrl(url) {
  try {
    return new URL(url, location.href).href;
  } catch {
    return null;
  }
}

/** @param {string} abs */
function listenersFor(abs) {
  /** @type {JsonListener[]} */
  const hits = [];
  for (const l of listeners) {
    try {
      if (l.match(abs)) hits.push(l);
    } catch (err) {
      log.warn("response matcher threw:", err);
    }
  }
  return hits;
}

/**
 * @param {JsonListener[]} hits
 * @param {string} abs
 * @param {unknown} json
 */
function deliver(hits, abs, json) {
  for (const l of hits) {
    try {
      l.onJson(abs, json);
    } catch (err) {
      log.warn("response listener threw:", err);
    }
  }
}

/** @param {Window} pw */
function hookXhr(pw) {
  const proto = pw.XMLHttpRequest?.prototype;
  if (!proto || typeof proto.open !== "function") return;
  const nativeOpen = proto.open;
  /** @type {WeakMap<XMLHttpRequest, string>} */
  const urls = new WeakMap();

  const onLoad = exposeToPage(function onLoad() {
    const url = urls.get(this);
    if (!url || listeners.size === 0) return;
    if (this.status < 200 || this.status >= 300) return;
    const abs = absoluteUrl(url);
    if (!abs) return;
    const hits = listenersFor(abs);
    if (!hits.length) return;
    let json;
    const type = this.responseType;
    try {
      if (type === "" || type === "text") json = JSON.parse(this.responseText);
      else if (type === "json") json = this.response;
      else return;
    } catch {
      return;
    }
    if (json != null) deliver(hits, abs, json);
  }, pw);

  proto.open = exposeToPage(function open(method, url, ...rest) {
    const raw = typeof url === "string" ? url : String(url ?? "");
    const next = rewriters.size ? rewriteUrl(raw) : raw;
    if (!urls.has(this)) this.addEventListener("load", onLoad);
    urls.set(this, next);
    return nativeOpen.call(this, method, next, ...rest);
  }, proto);
}

/**
 * @param {Window} pw
 * @param {RequestInfo | URL} input
 * @returns {{ input: RequestInfo | URL, url: string }}
 */
function rewriteFetchInput(pw, input) {
  if (typeof input === "string") {
    const url = rewriteUrl(input);
    return { input: url, url };
  }
  if (input instanceof pw.URL || input instanceof URL) {
    const url = rewriteUrl(input.toString());
    return { input: url, url };
  }
  if (input && typeof input === "object" && "url" in input) {
    const before = String(input.url);
    const url = rewriteUrl(before);
    if (url !== before) return { input: new pw.Request(url, input), url };
    return { input, url };
  }
  return { input, url: "" };
}

/** @param {Window} pw */
function hookFetch(pw) {
  if (typeof pw.fetch !== "function") return;
  originalFetch = pw.fetch;
  const native = originalFetch;
  pw.fetch = exposeToPage(function fetch(input, init) {
    let req = input;
    let url = "";
    try {
      ({ input: req, url } = rewriteFetchInput(pw, input));
    } catch (err) {
      log.warn("fetch rewrite failed:", err);
    }
    const promise = native.call(pw, req, init);
    if (listeners.size && url) {
      const abs = absoluteUrl(url);
      const hits = abs ? listenersFor(abs) : [];
      if (hits.length) {
        promise
          .then((res) => {
            if (!res.ok) return;
            return res
              .clone()
              .json()
              .then((json) => deliver(hits, abs, json));
          })
          .catch(() => {});
      }
    }
    return promise;
  }, pw);
}

/** Hooks the page window once; later calls do nothing. */
export function install() {
  if (installed) return;
  installed = true;
  const pw = pageWindow();
  hookedWindow = pw;
  try {
    hookXhr(pw);
  } catch (err) {
    log.warn("could not hook XMLHttpRequest:", err);
  }
  try {
    hookFetch(pw);
  } catch (err) {
    log.warn("could not hook fetch:", err);
  }
}

/**
 * @param {(url: string) => string} fn
 * @returns {() => void} remove
 */
export function addRequestRewriter(fn) {
  install();
  rewriters.add(fn);
  return () => void rewriters.delete(fn);
}

/**
 * @param {JsonListener} listener
 * @returns {() => void} remove
 */
export function addJsonResponseListener(listener) {
  install();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * The page's fetch from before the hook (bound to the page window), or null.
 * @returns {typeof fetch | null}
 */
export function nativeFetch() {
  install();
  const pw = hookedWindow;
  if (originalFetch && pw) return originalFetch.bind(pw);
  return null;
}
