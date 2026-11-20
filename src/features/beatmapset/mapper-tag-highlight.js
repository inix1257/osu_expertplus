/**
 * Colours the common mapper tags (featured artist, language, genre, ...) on
 * the beatmapset info panel so they stand apart from the map-specific ones.
 *
 * osu-web splits tags on spaces, so "featured artist" arrives as two links;
 * phrases are matched across adjacent links.
 */

import { observe } from "../../core/observe.js";
import { classifyTagRow } from "./tag-collapse.js";

export const TAG_CAT_ATTR = "data-oep-tag-cat";
export const TAG_POS_ATTR = "data-oep-tag-pos";

/**
 * Picked from the tags of 500 recently ranked sets (2026-11).
 * @type {ReadonlyArray<{ id: string, label: string, tags: string[] }>}
 */
export const TAG_CATEGORIES = Object.freeze([
  {
    id: "fa",
    label: "Featured Artist",
    tags: ["featured artist", "fa"],
  },
  {
    id: "guild",
    label: "Mappers' Guild",
    tags: ["mappers' guild", "mappers guild", "mpg", "mg"],
  },
  {
    id: "language",
    label: "Language",
    tags: [
      "japanese",
      "english",
      "korean",
      "chinese",
      "russian",
      "german",
      "french",
      "spanish",
      "instrumental",
    ],
  },
  {
    id: "genre",
    label: "Genre",
    tags: [
      "pop",
      "j-pop",
      "jpop",
      "k-pop",
      "kpop",
      "rock",
      "j-rock",
      "jrock",
      "alternative rock",
      "math rock",
      "post rock",
      "post-rock",
      "progressive rock",
      "indie rock",
      "punk rock",
      "alternative",
      "indie",
      "electronic",
      "edm",
      "hardcore",
      "metal",
      "drum and bass",
      "dnb",
      "dubstep",
      "trance",
      "house",
      "hip hop",
      "hip-hop",
      "rap",
      "folk",
      "jazz",
      "classical",
      "orchestral",
      "artcore",
      "video game",
      "videogame",
      "vgm",
      "anime",
      "vocaloid",
      "touhou",
      "visual novel",
      "original soundtrack",
      "soundtrack",
      "ost",
    ],
  },
  {
    id: "song",
    label: "Song info",
    tags: [
      "female vocals",
      "female vocal",
      "female vocalist",
      "male vocals",
      "male vocal",
      "male vocalist",
      "vocals",
      "vocalist",
      "opening",
      "op",
      "ending",
      "ed",
      "tv size",
      "short version",
      "full version",
      "cut ver",
      "remix",
      "cover",
    ],
  },
]);

/** @type {Map<string, string>} phrase → category id */
const PHRASES = new Map();
for (const cat of TAG_CATEGORIES) {
  for (const tag of cat.tags) PHRASES.set(tag, cat.id);
}
const MAX_WORDS = Math.max(
  ...[...PHRASES.keys()].map((p) => p.split(" ").length),
);
const LABELS = new Map(TAG_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * Two-letter abbreviations that also mean other things ("ed sheeran", "op" as
 * overpowered); they count only when one of these phrases is in the tags too.
 * @type {ReadonlyMap<string, string[]>}
 */
const NEEDS_CONTEXT = new Map([
  ["fa", ["featured artist"]],
  ["mg", ["mappers' guild", "mappers guild", "mpg"]],
  ["op", ["opening", "ending", "anime", "tv size"]],
  ["ed", ["opening", "ending", "anime", "tv size"]],
]);

/**
 * `featured_artist` → `featured artist`, `ver.` → `ver`, curly → straight
 * apostrophe (the trailing one of `mappers'` stays).
 * @param {string} word
 */
const normalize = (word) =>
  word
    .replace(/[‘’]/g, "'")
    .replace(/_+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.,]+$/, "")
    .replace(/\s+/g, " ");

/**
 * Category and phrase position of each tag word; the longest phrase wins.
 * Phrases only join words of one kind, so "japanese pop" stays language +
 * genre.
 * @param {string[]} words  tags in page order
 * @returns {Array<{ cat: string, pos: "solo"|"start"|"mid"|"end" } | null>}
 */
export function matchTagCategories(words) {
  const norm = words.map(normalize);
  /** @type {Array<{ cat: string, pos: "solo"|"start"|"mid"|"end" } | null>} */
  const out = norm.map(() => null);
  /** @type {Array<{ phrase: string, cat: string, i: number, n: number }>} */
  const found = [];
  for (let i = 0; i < norm.length;) {
    let matched = 0;
    for (let n = Math.min(MAX_WORDS, norm.length - i); n >= 1; n--) {
      const phrase = norm.slice(i, i + n).join(" ");
      const cat = PHRASES.get(phrase);
      if (!cat) continue;
      found.push({ phrase, cat, i, n });
      matched = n;
      break;
    }
    i += matched || 1;
  }
  const phrases = new Set(found.map((f) => f.phrase));
  for (const { phrase, cat, i, n } of found) {
    const context = NEEDS_CONTEXT.get(phrase);
    if (context && !context.some((p) => phrases.has(p))) continue;
    for (let k = 0; k < n; k++) {
      out[i + k] = {
        cat,
        pos: n === 1 ? "solo" : k === 0 ? "start" : k === n - 1 ? "end" : "mid",
      };
    }
  }
  return out;
}

/** @param {Element} link */
function clearLink(link) {
  if (!link.hasAttribute(TAG_CAT_ATTR)) return;
  link.removeAttribute(TAG_CAT_ATTR);
  link.removeAttribute(TAG_POS_ATTR);
  link.removeAttribute("title");
}

/** Marks the common tags in every mapper tags row. */
export function refreshMapperTagHighlights() {
  for (const row of document.querySelectorAll(
    ".beatmapset-info .beatmapset-info__row",
  )) {
    if (classifyTagRow(row) !== "mapper") continue;
    const links = [
      ...row.querySelectorAll(":scope > div > a.beatmapset-info__link"),
    ];
    const matches = matchTagCategories(links.map((a) => a.textContent || ""));
    links.forEach((link, i) => {
      const m = matches[i];
      if (!m) {
        clearLink(link);
        return;
      }
      if (link.getAttribute(TAG_CAT_ATTR) !== m.cat) {
        link.setAttribute(TAG_CAT_ATTR, m.cat);
      }
      if (link.getAttribute(TAG_POS_ATTR) !== m.pos) {
        link.setAttribute(TAG_POS_ATTR, m.pos);
      }
      const label = LABELS.get(m.cat) || "";
      if (link.getAttribute("title") !== label)
        link.setAttribute("title", label);
    });
  }
}

/** @returns {() => void} */
export function startMapperTagHighlights() {
  const ac = new AbortController();
  refreshMapperTagHighlights();
  observe.subscribe(
    {
      selector: ".beatmapset-info__row, .beatmapset-info__link",
      schedule: "raf",
      signal: ac.signal,
      label: "beatmapset/mapper-tag-highlight",
    },
    () => refreshMapperTagHighlights(),
  );
  return () => {
    ac.abort();
    for (const link of document.querySelectorAll(`[${TAG_CAT_ATTR}]`)) {
      clearLink(link);
    }
  };
}
