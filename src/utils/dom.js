/** DOM helpers: qs/qsa/el, wait*, manageStyle, createCleanupBag, set*IfChanged (write only on change, so document observers are not re-triggered) */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.dom = (() => {
  /**
   * Shorthand for document.querySelector.
   * @param {string} selector
   * @param {Element} [root=document]
   */
  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  /**
   * Shorthand for document.querySelectorAll (returns an Array).
   * @param {string} selector
   * @param {Element} [root=document]
   */
  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  /**
   * Create an element with optional attributes and children.
   * Attribute values of `null`, `undefined` or `false` are skipped and `true`
   * becomes an empty (boolean) attribute.
   * @param {string} tag
   * @param {Object} [attrs={}]
   * @param {...(string|Element)} children
   */
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === "class") {
        element.className = value;
      } else if (key.startsWith("on") && typeof value === "function") {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (
        key === "style" &&
        value != null &&
        typeof value === "object"
      ) {
        Object.assign(element.style, /** @type {object} */ (value));
      } else {
        element.setAttribute(key, value === true ? "" : value);
      }
    }
    for (const child of children) {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Element) {
        element.appendChild(child);
      }
    }
    return element;
  }

  /**
   * Normalizes `(timeout, root)` positional arguments or a
   * `{ timeout, root, signal }` object (as the 2nd or 3rd argument).
   * @param {unknown} a
   * @param {unknown} b
   * @param {number} defaultTimeout
   * @returns {{ timeout: number, root: ParentNode, signal?: AbortSignal }}
   */
  function waitOptions(a, b, defaultTimeout) {
    const isOpts = (v) =>
      v != null && typeof v === "object" && !(v instanceof Node);
    const opts = isOpts(a) ? a : isOpts(b) ? b : {};
    const timeout =
      typeof a === "number" ? a : (opts.timeout ?? defaultTimeout);
    const root =
      b instanceof Node ? b : (opts.root ?? document.documentElement);
    return { timeout, root, signal: opts.signal };
  }

  function abortError() {
    return new DOMException("The operation was aborted.", "AbortError");
  }

  /**
   * Wait for a selector match to disconnect (SPA teardown); resolves at once
   * if absent, and also after `timeout` ms. Use before waitForElement on re-nav.
   * Rejects with an `AbortError` if `signal` aborts first.
   * @param {string} selector
   * @param {number | { timeout?: number, root?: ParentNode, signal?: AbortSignal }} [timeoutOrOpts=8000]
   * @param {ParentNode | { timeout?: number, root?: ParentNode, signal?: AbortSignal }} [rootOrOpts=document.documentElement]
   * @returns {Promise<void>}
   */
  function waitForStaleElementToLeave(selector, timeoutOrOpts, rootOrOpts) {
    const { timeout, root, signal } = waitOptions(
      timeoutOrOpts,
      rootOrOpts,
      8000,
    );
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const stale = root.querySelector(selector);
      if (!stale || !stale.isConnected) {
        return resolve();
      }

      let timer = 0;
      const finish = (fn) => {
        observer.disconnect();
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        fn();
      };
      const onAbort = () => finish(() => reject(abortError()));
      const observer = new MutationObserver(() => {
        if (!stale.isConnected) finish(resolve);
      });
      observer.observe(root, { childList: true, subtree: true });
      timer = window.setTimeout(() => finish(resolve), timeout);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /**
   * Wait for an element matching `selector` to appear in the DOM.
   * Resolves with the element, rejects after `timeout` ms, or rejects with an
   * `AbortError` if `signal` aborts first.
   * @param {string} selector
   * @param {number | { timeout?: number, root?: ParentNode, signal?: AbortSignal }} [timeoutOrOpts=10000]
   * @param {ParentNode | { timeout?: number, root?: ParentNode, signal?: AbortSignal }} [rootOrOpts=document.documentElement]
   * @returns {Promise<Element>}
   */
  function waitForElement(selector, timeoutOrOpts, rootOrOpts) {
    const { timeout, root, signal } = waitOptions(
      timeoutOrOpts,
      rootOrOpts,
      10000,
    );
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError());
      const existing = root.querySelector(selector);
      if (existing) return resolve(existing);

      let timer = 0;
      const finish = (fn) => {
        observer.disconnect();
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        fn();
      };
      const onAbort = () => finish(() => reject(abortError()));
      const observer = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) finish(() => resolve(found));
      });

      observer.observe(root, { childList: true, subtree: true });

      timer = window.setTimeout(() => {
        finish(() =>
          reject(
            new Error(
              `waitForElement: "${selector}" not found within ${timeout}ms`,
            ),
          ),
        );
      }, timeout);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** @type {Map<string, number>} style id → acquire() count */
  const styleRefCounts = new Map();

  /**
   * Manages a <style> element lifecycle. inject() is idempotent.
   *
   * For a style that several features or overlapping page runs share, use
   * `acquire()`: it injects on the first holder and returns a release
   * function; the element is removed when the last holder releases (B64).
   * `remove()` still removes the element regardless of holders.
   * @param {string} id   Unique element id for deduplication.
   * @param {string} css  Stylesheet text content.
   * @returns {{ inject: () => void, remove: () => void, acquire: () => () => void }}
   */
  function manageStyle(id, css) {
    const inject = () => {
      if (document.getElementById(id)) return;
      const s = document.createElement("style");
      s.id = id;
      s.textContent = css;
      document.head.appendChild(s);
    };
    const remove = () => document.getElementById(id)?.remove();
    const acquire = () => {
      styleRefCounts.set(id, (styleRefCounts.get(id) ?? 0) + 1);
      inject();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (styleRefCounts.get(id) ?? 1) - 1;
        if (left > 0) {
          styleRefCounts.set(id, left);
        } else {
          styleRefCounts.delete(id);
          remove();
        }
      };
    };
    return { inject, remove, acquire };
  }

  /**
   * Collects cleanup / unsubscribe functions and disposes them all at once.
   * Each function is called inside try/catch so one failure never blocks
   * the rest.  Functions execute in reverse-registration (LIFO) order.
   * @returns {{ add: (...fns: Function[]) => void, dispose: () => void }}
   */
  function createCleanupBag() {
    const fns = [];
    return {
      add(...args) {
        fns.push(...args);
      },
      dispose() {
        while (fns.length) {
          try {
            fns.pop()();
          } catch (_) {}
        }
      },
    };
  }

  /**
   * Assign textContent only when it differs. Assigning the same text still
   * replaces the child Text node and fires a childList mutation, which can
   * re-trigger document-wide MutationObservers in a loop.
   * @param {Node|null|undefined} node
   * @param {string} text
   */
  function setTextIfChanged(node, text) {
    if (!node) return;
    if (node.textContent !== text) node.textContent = text;
  }

  /**
   * Assign `hidden` only when it differs. Setting `hidden = true` on an
   * already-hidden element still fires an attribute mutation.
   * @param {HTMLElement|null|undefined} node
   * @param {boolean} hidden
   */
  function setHiddenIfChanged(node, hidden) {
    if (!node) return;
    const next = !!hidden;
    if (node.hidden !== next) node.hidden = next;
  }

  /**
   * Set an attribute only when its value differs; `null`/`undefined` removes
   * it (only if present).
   * @param {Element|null|undefined} node
   * @param {string} name
   * @param {string|number|null|undefined} value
   */
  function setAttrIfChanged(node, name, value) {
    if (!node) return;
    if (value == null) {
      if (node.hasAttribute(name)) node.removeAttribute(name);
      return;
    }
    const next = String(value);
    if (node.getAttribute(name) !== next) node.setAttribute(name, next);
  }

  /**
   * Add or remove a class only when that changes the class list.
   * @param {Element|null|undefined} node
   * @param {string} className
   * @param {boolean} on
   */
  function toggleClassIfChanged(node, className, on) {
    if (!node) return;
    const next = !!on;
    if (node.classList.contains(className) !== next) {
      node.classList.toggle(className, next);
    }
  }

  /**
   * Set an inline style property (e.g. `--my-var` or `background-color`)
   * only when it differs; `null`/`undefined`/`""` removes it.
   * @param {HTMLElement|null|undefined} node
   * @param {string} prop
   * @param {string|number|null|undefined} value
   */
  function setStylePropIfChanged(node, prop, value) {
    if (!node) return;
    if (value == null || value === "") {
      if (node.style.getPropertyValue(prop) !== "") {
        node.style.removeProperty(prop);
      }
      return;
    }
    const next = String(value);
    if (node.style.getPropertyValue(prop) !== next) {
      node.style.setProperty(prop, next);
    }
  }

  /**
   * Parse a locale-formatted number string (handles period or comma as
   * decimal separator and spaces/commas/periods as group separators).
   * @param {string} str
   * @returns {number}
   */
  function parseLocaleNumber(str) {
    if (!str) return NaN;
    let s = String(str).trim();
    // Strip whitespace-like thousand separators (thin/non-breaking/regular space)
    s = s.replace(/[\s\u00A0\u202F\u2009]/g, "");
    const locale =
      typeof window.currentLocale === "string"
        ? window.currentLocale
        : document.documentElement.lang || undefined;
    let decimalSep = ".";
    try {
      decimalSep = new Intl.NumberFormat(locale)
        .format(1.1)
        .replace(/\d/g, "")
        .trim();
    } catch (_) {}
    const dec = decimalSep.replace(/[\s\u00A0\u202F\u2009]/g, "");
    if (dec === "." && /^\d{1,3}(,\d{3})+$/.test(s)) {
      return parseFloat(s.replace(/,/g, ""));
    }
    if (dec === "," && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      return parseFloat(s.replace(/\./g, ""));
    }

    const lastComma = s.lastIndexOf(",");
    const lastPeriod = s.lastIndexOf(".");
    if (lastComma > lastPeriod) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    return parseFloat(s);
  }

  /**
   * Format a number with exactly 2 decimal places using the osu-web page
   * locale (thousand grouping + locale-appropriate decimal separator).
   * @param {number} n
   * @returns {string}
   */
  function formatDecimalPp(n) {
    const locale =
      typeof window.currentLocale === "string"
        ? window.currentLocale
        : document.documentElement.lang || undefined;
    try {
      return n.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return n.toFixed(2);
    }
  }

  return {
    qs,
    qsa,
    el,
    waitForElement,
    waitForStaleElementToLeave,
    manageStyle,
    createCleanupBag,
    setTextIfChanged,
    setHiddenIfChanged,
    setAttrIfChanged,
    toggleClassIfChanged,
    setStylePropIfChanged,
    parseLocaleNumber,
    formatDecimalPp,
  };
})();
