/**
 * Beatmapset JSON the site has loaded (listing search, profile extra pages,
 * profile "load more"), keyed by set id (WS-50).
 *
 * - Bounded: past `maxEntries` the least recently used sets go.
 * - Versioned per id: a set's version changes only when that set is stored
 *   again, so a page can redraw just the cards whose data changed.
 * - `waitFor(id)` resolves when the set arrives (no polling).
 */

/**
 * @typedef {{ id?: unknown } & Record<string, unknown>} Beatmapset
 * @typedef {(ids: string[]) => void} ChangeListener
 */

/**
 * @param {{ maxEntries?: number }} [options]
 */
export function createBeatmapsetCache({ maxEntries = 2000 } = {}) {
  /** @type {Map<string, { data: Beatmapset, version: number }>} LRU first */
  const entries = new Map();
  /** @type {Map<string, Set<(data: Beatmapset) => void>>} */
  const waiters = new Map();
  /** @type {Set<ChangeListener>} */
  const listeners = new Set();
  let nextVersion = 1;

  return {
    /**
     * Store sets (objects with an `id`); others are skipped.
     * @param {Iterable<unknown>} items
     * @returns {string[]} ids stored
     */
    put(items) {
      /** @type {string[]} */
      const changed = [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const rawId = /** @type {Beatmapset} */ (item).id;
        if (rawId == null) continue;
        const id = String(rawId);
        const prev = entries.get(id)?.data;
        // A compact set (no `beatmaps`, e.g. Most Played "load more") must not
        // wipe the difficulties a full copy already brought (B106).
        const data = /** @type {Beatmapset} */ (
          prev && !Array.isArray(/** @type {Beatmapset} */ (item).beatmaps)
            ? { ...prev, ...item }
            : item
        );
        entries.delete(id);
        entries.set(id, { data, version: nextVersion++ });
        changed.push(id);
        const waiting = waiters.get(id);
        if (waiting) {
          waiters.delete(id);
          waiting.forEach((resolve) => resolve(data));
        }
      }
      for (const key of entries.keys()) {
        if (entries.size <= maxEntries) break;
        entries.delete(key);
      }
      if (changed.length) {
        for (const fn of listeners) {
          try {
            fn(changed);
          } catch (_) {
            /* one listener must not stop the others */
          }
        }
      }
      return changed;
    },

    /**
     * @param {string|number} id
     * @returns {Beatmapset|undefined}
     */
    get(id) {
      const key = String(id);
      const ent = entries.get(key);
      if (!ent) return undefined;
      entries.delete(key);
      entries.set(key, ent); // most recently used last
      return ent.data;
    },

    /** @param {string|number} id */
    has(id) {
      return entries.has(String(id));
    },

    /**
     * Version of the stored set, 0 when absent.
     * @param {string|number} id
     */
    version(id) {
      return entries.get(String(id))?.version ?? 0;
    },

    get size() {
      return entries.size;
    },

    /**
     * The set, as soon as it is stored; `undefined` after `timeout` ms or when
     * `signal` aborts.
     * @param {string|number} id
     * @param {{ signal?: AbortSignal, timeout?: number }} [options]
     * @returns {Promise<Beatmapset|undefined>}
     */
    waitFor(id, { signal, timeout } = {}) {
      const key = String(id);
      const hit = this.get(key);
      if (hit) return Promise.resolve(hit);
      if (signal?.aborted) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        let timer = 0;
        const done = (data) => {
          window.clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          const set = waiters.get(key);
          set?.delete(done);
          if (set && !set.size) waiters.delete(key);
          resolve(data);
        };
        const onAbort = () => done(undefined);
        if (!waiters.has(key)) waiters.set(key, new Set());
        waiters.get(key).add(done);
        signal?.addEventListener("abort", onAbort, { once: true });
        if (timeout != null) {
          timer = window.setTimeout(() => done(undefined), timeout);
        }
      });
    },

    /**
     * Called with the ids stored by each `put`.
     * @param {ChangeListener} fn
     * @returns {() => void} unsubscribe
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    clear() {
      entries.clear();
    },
  };
}

/**
 * `/beatmapsets/search` and `/api/v2/beatmapsets/search`: `{ beatmapsets }`.
 * @param {unknown} json
 * @returns {unknown[]}
 */
export function beatmapsetsFromSearch(json) {
  const list =
    json && typeof json === "object"
      ? /** @type {Record<string, unknown>} */ (json).beatmapsets
      : null;
  return Array.isArray(list) ? list : [];
}

/**
 * `/users/{id}/extra-pages/beatmaps`: section buckets (`ranked`, `loved`, …)
 * that each have `items`.
 * @param {unknown} json
 * @returns {unknown[]}
 */
export function beatmapsetsFromExtraPages(json) {
  if (!json || typeof json !== "object") return [];
  /** @type {unknown[]} */
  const out = [];
  for (const bucket of Object.values(json)) {
    const items =
      bucket && typeof bucket === "object"
        ? /** @type {Record<string, unknown>} */ (bucket).items
        : null;
    if (Array.isArray(items)) out.push(...items);
  }
  return out;
}

/**
 * `/users/{id}/beatmapsets/{type}` ("load more"): an array of sets, or of
 * playcounts nesting them under `.beatmapset` (`most_played`), or
 * `{ beatmapsets: [...] }`.
 * @param {unknown} json
 * @returns {unknown[]}
 */
export function beatmapsetsFromUserList(json) {
  /** @type {unknown[]} */
  let list = [];
  if (Array.isArray(json)) list = json;
  else if (json && typeof json === "object") list = beatmapsetsFromSearch(json);
  return list.map((item) => {
    const nested =
      item && typeof item === "object"
        ? /** @type {Record<string, unknown>} */ (item).beatmapset
        : null;
    return nested &&
      typeof nested === "object" &&
      /** @type {Record<string, unknown>} */ (nested).id != null
      ? nested
      : item;
  });
}

/** The page's shared cache. */
export const beatmapsetCache = createBeatmapsetCache();
