/**
 * Collapse / expand buttons on the beatmapset info panel's "User Tags" and
 * "Mapper Tags" rows. Each row remembers its own state.
 *
 * osu-web localizes the headings, so rows are told apart by their links:
 * user tag links search `tag="..."`, mapper tag links search the bare tag.
 */

import { observe } from "../../core/observe.js";
import { KEYS, getJSON, setJSON } from "../../core/storage.js";
import { el } from "../legacy.js";
import { ROOT_CLASS } from "./constants.js";

export const TAG_ROW_CLASS = `${ROOT_CLASS}__tag-row`;
export const TAG_ROW_COLLAPSED_CLASS = `${TAG_ROW_CLASS}--collapsed`;
export const TAG_TOGGLE_ATTR = "data-oep-tag-collapse";

const ROW_SEL = ".beatmapset-info .beatmapset-info__row";
/** A search with a field operator (`tag=`, `source=`, `stars>`, ...). */
const SEARCH_OPERATOR_RE = /^[a-z_]+\s*(?:[=:<>])/i;

/** @type {Record<"user"|"mapper", string>} */
const NAMES = { user: "user tags", mapper: "mapper tags" };

/**
 * @param {Element} row  `.beatmapset-info__row`
 * @returns {"user"|"mapper"|null}
 */
export function classifyTagRow(row) {
  if (!row.querySelector(":scope > h3.beatmapset-info__header")) return null;
  const links = row.querySelectorAll(":scope > div > a.beatmapset-info__link");
  if (!links.length) return null;
  const queries = [];
  for (const a of links) {
    let url;
    try {
      url = new URL(a.getAttribute("href") || "", location.href);
    } catch (_) {
      return null;
    }
    if (!/^\/beatmapsets\/?$/.test(url.pathname)) return null;
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return null;
    queries.push(q);
  }
  if (queries.every((q) => /^tag\s*=/i.test(q))) return "user";
  if (queries.every((q) => !SEARCH_OPERATOR_RE.test(q))) return "mapper";
  return null;
}

/** @returns {{ user?: boolean, mapper?: boolean }} */
function readState() {
  const v = getJSON(KEYS.BEATMAPSET_TAGS_COLLAPSED, {});
  return v && typeof v === "object" ? v : {};
}

/**
 * @param {HTMLElement} row
 * @param {HTMLButtonElement} btn
 * @param {"user"|"mapper"} kind
 * @param {boolean} collapsed
 */
function applyState(row, btn, kind, collapsed) {
  row.classList.toggle(TAG_ROW_COLLAPSED_CLASS, collapsed);
  btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  btn.title = `${collapsed ? "Show" : "Hide"} ${NAMES[kind]}`;
  const icon = btn.querySelector("i");
  if (icon) {
    icon.className = collapsed ? "fas fa-chevron-down" : "fas fa-chevron-up";
  }
}

/**
 * @param {HTMLElement} row
 * @param {"user"|"mapper"} kind
 */
function mountToggle(row, kind) {
  const heading = row.querySelector(":scope > h3.beatmapset-info__header");
  if (!heading) return;
  let btn = row.querySelector(`:scope > [${TAG_TOGGLE_ATTR}]`);
  if (!(btn instanceof HTMLButtonElement)) {
    btn = el(
      "button",
      {
        type: "button",
        class: `${ROOT_CLASS}__tag-toggle`,
        [TAG_TOGGLE_ATTR]: kind,
      },
      el("i", { class: "fas fa-chevron-up", "aria-hidden": "true" }),
    );
    btn.addEventListener("click", () => {
      const k = /** @type {"user"|"mapper"} */ (
        btn.getAttribute(TAG_TOGGLE_ATTR)
      );
      const next = !row.classList.contains(TAG_ROW_COLLAPSED_CLASS);
      const state = readState();
      state[k] = next;
      setJSON(KEYS.BEATMAPSET_TAGS_COLLAPSED, state);
      applyState(row, btn, k, next);
    });
  }
  btn.setAttribute(TAG_TOGGLE_ATTR, kind);
  if (heading.nextElementSibling !== btn) heading.after(btn);
  row.classList.add(TAG_ROW_CLASS);
  applyState(row, btn, kind, readState()[kind] === true);
}

/** @param {HTMLElement} row */
function unmountToggle(row) {
  row.querySelector(`:scope > [${TAG_TOGGLE_ATTR}]`)?.remove();
  row.classList.remove(TAG_ROW_CLASS, TAG_ROW_COLLAPSED_CLASS);
}

/** Adds, updates or removes the toggles on every info row. */
export function refreshTagCollapseToggles() {
  for (const row of document.querySelectorAll(ROW_SEL)) {
    if (!(row instanceof HTMLElement)) continue;
    const kind = classifyTagRow(row);
    if (kind) mountToggle(row, kind);
    else if (row.classList.contains(TAG_ROW_CLASS)) unmountToggle(row);
  }
}

/**
 * Keeps the toggles on the rows while osu-web re-renders the info panel
 * (switching difficulties changes the user tags).
 * @returns {() => void}
 */
export function startTagCollapseToggles() {
  const ac = new AbortController();
  refreshTagCollapseToggles();
  observe.subscribe(
    {
      // Rows come and go, and switching difficulties swaps the user tag links.
      selector: ".beatmapset-info__row, .beatmapset-info__link",
      schedule: "raf",
      signal: ac.signal,
      label: "beatmapset/tag-collapse",
    },
    () => refreshTagCollapseToggles(),
  );
  return () => {
    ac.abort();
    for (const row of document.querySelectorAll(`.${TAG_ROW_CLASS}`)) {
      if (row instanceof HTMLElement) unmountToggle(row);
    }
  };
}
