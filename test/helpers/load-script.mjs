/**
 * Runs legacy userscript files (IIFEs that attach to `window.OsuExpertPlus`)
 * inside a jsdom window, so they can be unit-tested before they become ES
 * modules.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * @param {string[]} files  repo-relative paths, in load order
 * @param {{ url?: string, lang?: string, globals?: object }} [opts]
 *   `globals` are copied onto the window before the scripts run (e.g.
 *   `currentLocale`). GM_* storage is backed by an in-memory Map.
 * @returns {{ window: Window, OsuExpertPlus: any, gmStore: Map<string, any> }}
 */
export function loadScripts(files, opts = {}) {
  const lang = opts.lang ?? "en";
  const dom = new JSDOM(
    `<!doctype html><html lang="${lang}"><head></head><body></body></html>`,
    {
      url: opts.url ?? "https://osu.ppy.sh/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const { window } = dom;
  const gmStore = new Map();
  Object.assign(window, {
    GM_getValue: (key, def) => (gmStore.has(key) ? gmStore.get(key) : def),
    GM_setValue: (key, value) => void gmStore.set(key, value),
    GM_deleteValue: (key) => void gmStore.delete(key),
    GM_addStyle: (css) => {
      const style = window.document.createElement("style");
      style.textContent = css;
      window.document.head.appendChild(style);
      return style;
    },
    GM_xmlhttpRequest: () => {
      throw new Error("GM_xmlhttpRequest is not available in tests");
    },
    unsafeWindow: window,
    ...opts.globals,
  });
  const context = dom.getInternalVMContext();
  for (const file of files) {
    const code = readFileSync(path.join(ROOT, file), "utf8");
    vm.runInContext(`"use strict";\n${code}`, context, { filename: file });
  }
  return { window, OsuExpertPlus: window.OsuExpertPlus, gmStore };
}
