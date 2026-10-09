/**
 * Feature lifecycle helpers for page modules. A "bag" is the
 * `{ add, dispose }` object from `OsuExpertPlus.dom.createCleanupBag()`.
 */

import { log } from "./log.js";

/**
 * @typedef {{ add: (...fns: Function[]) => void }} CleanupBag
 * @typedef {{ isEnabled: (id: string) => boolean,
 *   onChange: (id: string, fn: (on: boolean) => void) => () => void }} SettingsLike
 */

/**
 * Runs `fn` and adds the cleanup it returns to `bag`. A throw is logged and
 * swallowed so the features started after it still start.
 * @param {CleanupBag} bag
 * @param {() => (void | (() => void))} fn
 * @param {string} [label]  Shown in the log on failure.
 * @returns {boolean} false when `fn` threw.
 */
export function safeStart(bag, fn, label = "feature") {
  try {
    const cleanup = fn();
    if (typeof cleanup === "function") bag.add(cleanup);
    return true;
  } catch (err) {
    log.error(`failed to start ${label}:`, err);
    return false;
  }
}

/**
 * Keeps a feature in sync with a settings toggle: mounts it while the setting
 * is on, disposes it when the setting turns off, and cleans up both the
 * subscription and a mounted feature when `bag` is disposed.
 * @param {CleanupBag} bag
 * @param {SettingsLike} settings
 * @param {string} id  Settings id.
 * @param {() => (void | (() => void))} mount  Returns the feature's dispose.
 */
export function mountSettingFeature(bag, settings, id, mount) {
  /** @type {(() => void) | null} */
  let dispose = null;
  let mounted = false;

  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    const fn = dispose;
    dispose = null;
    if (!fn) return;
    try {
      fn();
    } catch (err) {
      log.warn(`failed to dispose ${id}:`, err);
    }
  };

  const sync = (on) => {
    if (on && !mounted) {
      mounted = true;
      try {
        const result = mount();
        dispose = typeof result === "function" ? result : null;
      } catch (err) {
        log.error(`failed to start ${id}:`, err);
        dispose = null;
      }
    } else if (!on) {
      unmount();
    }
  };

  const unsubscribe = settings.onChange(id, (on) => sync(!!on));
  bag.add(() => {
    unsubscribe();
    unmount();
  });
  sync(settings.isEnabled(id));
}

/**
 * Generation counter for discarding stale async work: take a token before an
 * await, and drop the result if the token is no longer current.
 * @returns {{ next: () => number, current: () => number,
 *   isCurrent: (token: number) => boolean }}
 */
export function createGeneration() {
  let gen = 0;
  return {
    next: () => ++gen,
    current: () => gen,
    isCurrent: (token) => token === gen,
  };
}
