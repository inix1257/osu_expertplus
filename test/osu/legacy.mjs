/**
 * Pulls a single function declaration out of a legacy page script (by name)
 * and evaluates it, so the new `src/osu` helpers can be compared with the code
 * they replace. Relies on Prettier formatting: the declaration ends at the
 * first line that is a `}` at the declaration's own indentation.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** @type {Map<string, string[]>} */
const fileCache = new Map();

/** @param {string} file  repo-relative path */
function lines(file) {
  let l = fileCache.get(file);
  if (!l) {
    l = readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/);
    fileCache.set(file, l);
  }
  return l;
}

/**
 * Source text of `function <name>(…) { … }` in `file`.
 * @param {string} file
 * @param {string} name
 * @returns {string}
 */
export function legacySource(file, name) {
  const all = lines(file);
  const re = new RegExp(`^(\\s*)function ${name}\\(`);
  const start = all.findIndex((line) => re.test(line));
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  const indent = re.exec(all[start])[1];
  const end = all.findIndex((line, i) => i > start && line === `${indent}}`);
  if (end < 0) throw new Error(`end of ${name} not found in ${file}`);
  return all.slice(start, end + 1).join("\n");
}

/**
 * Evaluates a legacy function with its free variables supplied by `deps`.
 * @param {string} file
 * @param {string} name
 * @param {Record<string, unknown>} [deps]
 * @returns {Function}
 */
export function legacyFn(file, name, deps = {}) {
  const names = Object.keys(deps);
  const body = `"use strict";\n${legacySource(file, name)}\nreturn ${name};`;
  return new Function(...names, body)(...names.map((n) => deps[n]));
}

export const USER_PROFILE = "src/pages/user-profile.js";
/** Score features moved out of user-profile by WS-41 (frozen copy). */
export const LEGACY_PROFILE = "test/fixtures/legacy/user-profile-scores.js";
/** Scoreboard helpers moved out of beatmap-detail by WS-31 (frozen copy). */
export const LEGACY_SCOREBOARD =
  "test/fixtures/legacy/beatmap-detail-scoreboard.js";
/** Beatmapset page helpers moved out of beatmap-detail by WS-33 (frozen copy). */
export const LEGACY_BEATMAPSET =
  "test/fixtures/legacy/beatmap-detail-beatmapset.js";
/** BBCode helper moved out of user-profile by WS-40 (frozen copy). */
export const LEGACY_BBCODE = "test/fixtures/legacy/user-profile-bbcode.js";
/** Discussion helpers removed from beatmap-detail by WS-30 (frozen copy). */
export const LEGACY_DISCUSSION =
  "test/fixtures/legacy/beatmap-detail-discussion.js";
export const CARD_EXTRA = "src/utils/beatmap-card-extra.js";
export const BEATMAP_PREVIEW = "src/utils/beatmap-preview.js";
