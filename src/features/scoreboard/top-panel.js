/**
 * Scoreboard top panel (WS-31): keeps the big "#1" card in sync with the
 * table's effective first row (merged, filtered or sorted).
 */

import { flagFilename, formatRelativeShort } from "../../osu/format.js";
import {
  ACCURACY_FORMAT,
  formatAccuracy,
  formatCombo,
  hitstatValue,
  leaderboardScoreId,
  scoreGrade,
} from "../../osu/score.js";
import {
  EXTENDED_SCORE_ROW_ATTR,
  SCOREBOARD_HTML_TABLE_SEL,
  SCORE_USER_SEARCH_RESULT_ATTR,
  WILDCARD_MERGED_ROW_ATTR,
  getRowScore,
  getBeatmapPageRuleset,
} from "./context.js";
import { leaderboardTableScoreNumber } from "./sort.js";

/** Marks an OEP-managed `.beatmap-scoreboard-top__item` that overrides the native panel. */
export const SCORE_TOP_OVERRIDE_ATTR = "data-oep-score-top-override";

const HIT_KIND = "hit:";
const TOP_STAT_KIND_ATTR = "data-oep-top-stat";
const HEADER_HIT_PREFIX = "beatmap-score-top__stat-header--hit-";
const TABLE_HEADER_HIT_RE = /\bbeatmap-scoreboard-table__header--hit-(\S+)/;
/** English header text, only for markup without the structural classes. */
const TOP_STAT_KIND_BY_TEXT = Object.freeze({
  "total score": "score",
  accuracy: "accuracy",
  "max combo": "combo",
  pp: "pp",
  time: "time",
  mods: "mods",
});

/**
 * What a `.beatmap-score-top__stat` shows, read from the osu-web markup rather
 * than its translated header text (B78): `score`, `accuracy`, `combo`, `pp`,
 * `time`, `mods`, `hit:<name>` (the osu-web hit result name, e.g. `great`,
 * `perfect`, `large_tick_hit`) or `""`. Cached on the element, because our
 * own writes replace the markup it is read from.
 * @param {Element} stat
 * @param {Element} headerEl
 * @param {Element} valueEl
 * @param {number} widerIndex  how many `--wider` headers came before this one
 * @returns {string}
 */
function topStatKind(stat, headerEl, valueEl, widerIndex) {
  const cached = stat.getAttribute(TOP_STAT_KIND_ATTR);
  if (cached != null) return cached;
  let kind = "";
  const hit = [...headerEl.classList].find((c) =>
    c.startsWith(HEADER_HIT_PREFIX),
  );
  if (hit) kind = HIT_KIND + hit.slice(HEADER_HIT_PREFIX.length);
  else if (valueEl.classList.contains("beatmap-score-top__stat-value--score"))
    kind = "score";
  else if (
    valueEl.classList.contains("beatmap-score-top__stat-value--mods") ||
    valueEl.querySelector(".mods")
  )
    kind = "mods";
  else if (valueEl.querySelector(".pp-value")) kind = "pp";
  else if (valueEl.querySelector("time")) kind = "time";
  else if (headerEl.classList.contains("beatmap-score-top__stat-header--wider"))
    // The first osu-web row: Total Score, Accuracy, Max Combo.
    kind = ["score", "accuracy", "combo"][widerIndex] ?? "";
  if (!kind) {
    const text = (headerEl.textContent ?? "").trim().toLowerCase();
    kind = TOP_STAT_KIND_BY_TEXT[text] ?? "";
  }
  stat.setAttribute(TOP_STAT_KIND_ATTR, kind);
  return kind;
}

/**
 * @param {Element} item  `.beatmap-score-top__item`
 * @returns {{ stat: Element, valueEl: HTMLElement, kind: string }[]}
 */
function topItemStats(item) {
  const out = [];
  let wider = 0;
  for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
    const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
    const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
    if (!headerEl || !(valueEl instanceof HTMLElement)) continue;
    const kind = topStatKind(stat, headerEl, valueEl, wider);
    if (headerEl.classList.contains("beatmap-score-top__stat-header--wider")) {
      wider += 1;
    }
    out.push({ stat, valueEl, kind });
  }
  return out;
}

/**
 * Hit-stat cell texts of a table row by osu-web hit result name, from the
 * table's `__header--hit-<name>` columns.
 * @param {HTMLTableRowElement} row
 * @returns {Map<string, string>}
 */
function rowHitValuesByName(row) {
  const out = new Map();
  const table = row.closest("table");
  if (!table) return out;
  for (const th of table.querySelectorAll("thead th")) {
    const m = TABLE_HEADER_HIT_RE.exec(th.className);
    if (!m) continue;
    const td = row.cells[/** @type {HTMLTableCellElement} */ (th).cellIndex];
    const text = td?.textContent?.trim();
    if (text) out.set(m[1], text);
  }
  return out;
}

/**
 * An API score's count for an osu-web hit result name: the lazer statistic
 * of that name, else the scoreboard label rules (legacy `count_*` fields).
 * @param {string} name
 * @param {object} score
 */
function apiHitValue(name, score) {
  const v = score?.statistics?.[name];
  if (v != null && v !== "" && Number.isFinite(Number(v))) return String(v);
  return hitstatValue(name, score, { ruleset: getBeatmapPageRuleset() });
}

/**
 * Returns the first visible leaderboard row that is not the original native rank-#1 entry.
 * Returns null when no override is needed (the native panel already shows the correct score).
 * @param {HTMLElement} scoreboardRoot
 * @returns {HTMLTableRowElement | null}
 */
export function getEffectiveBoardTopRow(scoreboardRoot) {
  const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(table instanceof HTMLTableElement)) return null;
  const tbody = table.querySelector("tbody.beatmap-scoreboard-table__body");
  if (!tbody) return null;
  for (const row of tbody.querySelectorAll(
    "tr.beatmap-scoreboard-table__body-row",
  )) {
    if (!(row instanceof HTMLElement) || row.style.display === "none") continue;
    // The native rank-#1 row carries `--first` and no OEP-injected attributes.
    // When it is the first visible row the native panel is already correct.
    const isNativeFirst =
      row.classList.contains("beatmap-scoreboard-table__body-row--first") &&
      !row.hasAttribute(WILDCARD_MERGED_ROW_ATTR) &&
      !row.hasAttribute(SCORE_USER_SEARCH_RESULT_ATTR) &&
      !row.hasAttribute(EXTENDED_SCORE_ROW_ATTR);
    if (isNativeFirst) return null;
    return /** @type {HTMLTableRowElement} */ (row);
  }
  return null;
}

/**
 * Updates a cloned `.beatmap-scoreboard-top__item` with data from a score API object.
 * @param {HTMLElement} item
 * @param {object} score
 * @param {HTMLTableRowElement|null} row - the corresponding rendered row (source of mods HTML)
 */
export function applyApiScoreToTopItem(item, score, row) {
  const uid = score.user?.id ?? score.user_id;
  const username = score.user?.username ?? (uid != null ? String(uid) : "");
  const iso = score.ended_at ?? score.created_at ?? "";
  const ruleset = getBeatmapPageRuleset();
  const cc = String(score.user?.country_code ?? "")
    .trim()
    .toUpperCase();
  const countryName = score.user?.country?.name || cc;

  const scoreId = leaderboardScoreId(score);
  const scoreUrl = scoreId ? `https://osu.ppy.sh/scores/${scoreId}` : "";
  const linkEl = item.querySelector("a.beatmap-score-top__link-container");
  if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;

  const rankKey = scoreGrade(score, { sanitize: true });
  const gradeDiv = item.querySelector(".score-rank");
  if (gradeDiv)
    gradeDiv.className = `score-rank score-rank--tiny score-rank--${rankKey}`;

  if (uid != null) {
    const userHref = `https://osu.ppy.sh/users/${uid}/${ruleset}`;
    const avatarA = item.querySelector(".beatmap-score-top__avatar a");
    if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
    const avatarSpan = item.querySelector(
      ".beatmap-score-top__avatar span.avatar",
    );
    if (avatarSpan instanceof HTMLElement)
      avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${uid}")`;
    const usernameA = item.querySelector("a.beatmap-score-top__username");
    if (usernameA instanceof HTMLAnchorElement) {
      usernameA.textContent = username;
      usernameA.href = userHref;
      usernameA.dataset.userId = String(uid);
    }
  }

  const achievedTime = item.querySelector(".beatmap-score-top__achieved time");
  if (achievedTime instanceof HTMLElement && iso) {
    achievedTime.setAttribute("datetime", iso);
    achievedTime.setAttribute("title", iso);
    achievedTime.textContent = formatRelativeShort(iso, { rounding: "floor" });
  }

  const countryA = item.querySelector(".beatmap-score-top__flags a");
  if (countryA instanceof HTMLAnchorElement && cc)
    countryA.href = `https://osu.ppy.sh/rankings/${ruleset}/performance?country=${cc}`;
  const flagSpan = item.querySelector(
    ".beatmap-score-top__flags span.flag-country",
  );
  if (flagSpan instanceof HTMLElement && cc) {
    const uni = flagFilename(cc);
    if (uni)
      flagSpan.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
    flagSpan.title = countryName;
  }

  const rawScore = leaderboardTableScoreNumber(score);
  const scoreStr = Number(rawScore).toLocaleString("en-US");
  const accStr = formatAccuracy(score.accuracy, ACCURACY_FORMAT.scoreboard);
  const comboStr = formatCombo(score.max_combo);
  const ppNum =
    score.pp != null && Number.isFinite(Number(score.pp))
      ? Number(score.pp)
      : null;
  const ppStr =
    ppNum != null
      ? Number.isInteger(ppNum)
        ? String(ppNum)
        : ppNum.toFixed(2)
      : null;

  const rowMods = row?.querySelector(".mods") ?? null;

  for (const { stat, valueEl, kind } of topItemStats(item)) {
    if (kind === "score") {
      valueEl.textContent = scoreStr;
    } else if (kind === "accuracy") {
      valueEl.textContent = accStr;
    } else if (kind === "combo") {
      valueEl.textContent = comboStr;
    } else if (kind === "pp") {
      if (ppStr != null) {
        valueEl.textContent = ppStr;
      } else {
        valueEl.innerHTML =
          '<span title="pp is not awarded for this score">-</span>';
      }
    } else if (kind === "time") {
      if (iso) {
        const t = document.createElement("time");
        t.className = "js-tooltip-time";
        t.setAttribute("data-orig-title", iso);
        t.textContent = formatRelativeShort(iso, { rounding: "floor" });
        valueEl.replaceChildren(t);
      }
    } else if (kind === "mods") {
      if (rowMods) {
        const modsValueEl =
          stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
        const existing = modsValueEl.querySelector(".mods");
        const clone = rowMods.cloneNode(true);
        if (existing) existing.replaceWith(clone);
        else modsValueEl.appendChild(clone);
      }
    } else if (kind.startsWith(HIT_KIND)) {
      valueEl.textContent = apiHitValue(kind.slice(HIT_KIND.length), score);
    }
  }
}

/**
 * Updates a cloned `.beatmap-scoreboard-top__item` using data read from a native DOM row.
 * Used when custom-rate filter hides the native rank-#1 row but no merged leaderboard is active.
 * @param {HTMLElement} item
 * @param {HTMLTableRowElement} row
 */
export function applyNativeRowToTopItem(item, row) {
  const scoreUrl =
    row
      .querySelector("a.beatmap-scoreboard-table__cell-content--rank")
      ?.getAttribute("href") ?? "";
  const linkEl = item.querySelector("a.beatmap-score-top__link-container");
  if (linkEl instanceof HTMLAnchorElement && scoreUrl) linkEl.href = scoreUrl;

  const gradeEl = row.querySelector(".score-rank");
  const gradeClass = gradeEl
    ? ([...gradeEl.classList].find(
        (c) => c.startsWith("score-rank--") && c !== "score-rank--tiny",
      ) ?? "")
    : "";
  const gradeKey = gradeClass.replace("score-rank--", "");
  if (gradeKey) {
    const gradeDiv = item.querySelector(".score-rank");
    if (gradeDiv)
      gradeDiv.className = `score-rank score-rank--tiny score-rank--${gradeKey}`;
  }

  const usercardEl = row.querySelector("a.js-usercard");
  const userId = usercardEl?.dataset?.userId ?? "";
  const username = usercardEl?.textContent?.trim() ?? "";
  const ruleset = getBeatmapPageRuleset();
  if (userId) {
    const userHref = `https://osu.ppy.sh/users/${userId}/${ruleset}`;
    const avatarA = item.querySelector(".beatmap-score-top__avatar a");
    if (avatarA instanceof HTMLAnchorElement) avatarA.href = userHref;
    const avatarSpan = item.querySelector(
      ".beatmap-score-top__avatar span.avatar",
    );
    if (avatarSpan instanceof HTMLElement)
      avatarSpan.style.backgroundImage = `url("https://a.ppy.sh/${userId}")`;
    const usernameA = item.querySelector("a.beatmap-score-top__username");
    if (usernameA instanceof HTMLAnchorElement) {
      usernameA.textContent = username;
      usernameA.href = userHref;
      usernameA.dataset.userId = userId;
    }
  }

  const rowFlagSpan = row.querySelector("span.flag-country");
  const rowCountryA = row.querySelector(
    'a[href*="/rankings/"][href*="country="]',
  );
  const countryA = item.querySelector(".beatmap-score-top__flags a");
  if (countryA instanceof HTMLAnchorElement && rowCountryA) {
    const href = rowCountryA.getAttribute("href") ?? "";
    if (href) countryA.href = href;
  }
  const itemFlagSpan = item.querySelector(
    ".beatmap-score-top__flags span.flag-country",
  );
  if (itemFlagSpan instanceof HTMLElement && rowFlagSpan) {
    const bgStyle = rowFlagSpan.getAttribute("style") ?? "";
    const bgMatch = bgStyle.match(/url\((['"]?)(.*?)\1\)/);
    if (bgMatch) itemFlagSpan.style.backgroundImage = `url('${bgMatch[2]}')`;
    itemFlagSpan.title = rowFlagSpan.title;
  }

  const scoreValEl = item.querySelector(
    ".beatmap-score-top__stat-value--score",
  );
  if (scoreValEl) {
    const scoreVal =
      row
        .querySelector("a.beatmap-scoreboard-table__cell-content--score")
        ?.textContent?.trim() ?? "";
    if (scoreVal) scoreValEl.textContent = scoreVal;
  }

  let accuracy = "";
  for (const a of row.querySelectorAll(
    ".beatmap-scoreboard-table__cell-content",
  )) {
    const t = a.textContent?.trim();
    if (t && t.endsWith("%")) {
      accuracy = t;
      break;
    }
  }
  let maxCombo = "";
  for (const a of row.querySelectorAll(
    ".beatmap-scoreboard-table__cell-content",
  )) {
    const t = a.textContent?.trim();
    if (t && /^\d[\d,]*x$/.test(t)) {
      maxCombo = t;
      break;
    }
  }

  const hitByName = rowHitValuesByName(row);
  const ppText =
    row
      .querySelector(".oep-beatmap-scoreboard-pp-value")
      ?.textContent?.trim() ?? "";
  const timeEl = row.querySelector("time.js-tooltip-time");
  // osu-web rows put the ISO time in `title` (no `datetime`) (B79).
  const timeIso =
    timeEl?.getAttribute("datetime") || timeEl?.getAttribute("title") || "";
  const timeText = timeEl?.textContent?.trim() ?? "";
  const rowMods = row.querySelector(".mods");

  for (const { stat, valueEl, kind } of topItemStats(item)) {
    if (kind === "accuracy" && accuracy) {
      valueEl.textContent = accuracy;
    } else if (kind === "combo" && maxCombo) {
      valueEl.textContent = maxCombo;
    } else if (kind === "pp" && ppText) {
      valueEl.textContent = ppText;
    } else if (kind === "time" && timeIso) {
      const t = document.createElement("time");
      t.className = "js-tooltip-time";
      t.setAttribute("data-orig-title", timeIso);
      t.textContent = timeText;
      valueEl.replaceChildren(t);
    } else if (kind === "mods" && rowMods) {
      const modsValueEl =
        stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
      const existing = modsValueEl.querySelector(".mods");
      const clone = rowMods.cloneNode(true);
      if (existing) existing.replaceWith(clone);
      else modsValueEl.appendChild(clone);
    } else if (kind.startsWith(HIT_KIND)) {
      // B17: every ruleset's columns (mania perfect/good, fruits ticks, ...),
      // matched through the osu-web `--hit-<name>` classes.
      valueEl.textContent = hitByName.get(kind.slice(HIT_KIND.length)) ?? "-";
    }
  }
}

/**
 * Syncs the `.beatmap-scoreboard-top__item` panel to match the actual first visible
 * leaderboard row. Called at the end of refreshBeatmapScoreboardTableEnhancements so it
 * responds to all sources of leaderboard change: wildcard merge, player lookup, custom-rate
 * filter, and sort order.
 * @param {HTMLElement} scoreboardRoot
 */
/** Override card → the row it was built from. @type {WeakMap<Element, { row: Element, score: object|undefined, text: string }>} */
const overrideSources = new WeakMap();

export function refreshBeatmapScoreTopPanel(scoreboardRoot) {
  // B79: osu-web dropped the `__item` wrapper; the card is now
  // `.beatmap-scoreboard-top > .beatmap-score-top`. Both are accepted.
  const nativeItem = scoreboardRoot.querySelector(
    [
      `.beatmap-scoreboard-top__item:not([${SCORE_TOP_OVERRIDE_ATTR}])`,
      `.beatmap-scoreboard-top > .beatmap-score-top:not([${SCORE_TOP_OVERRIDE_ATTR}])`,
    ].join(", "),
  );
  if (!(nativeItem instanceof HTMLElement)) return;
  const parent = nativeItem.parentElement;
  if (!parent) return;

  const existing = [...parent.querySelectorAll(`[${SCORE_TOP_OVERRIDE_ATTR}]`)];
  const topRow = getEffectiveBoardTopRow(scoreboardRoot);
  const score = topRow ? getRowScore(topRow) : undefined;
  const source = topRow
    ? { row: topRow, score, text: topRow.textContent }
    : null;

  // Every refresh used to rebuild the card; keep it while it already shows
  // the same row with the same content.
  const current =
    existing.length === 1 ? overrideSources.get(existing[0]) : null;
  if (
    source &&
    current &&
    current.row === source.row &&
    current.score === source.score &&
    current.text === source.text &&
    existing[0].nextElementSibling === nativeItem
  ) {
    if (nativeItem.style.display !== "none") nativeItem.style.display = "none";
    return;
  }

  for (const old of existing) old.remove();

  if (!topRow) {
    if (nativeItem.style.display) nativeItem.style.display = "";
    return;
  }

  nativeItem.style.display = "none";

  const overrideItem = /** @type {HTMLElement} */ (nativeItem.cloneNode(true));
  overrideItem.setAttribute(SCORE_TOP_OVERRIDE_ATTR, "1");
  overrideSources.set(overrideItem, source);

  if (score) {
    applyApiScoreToTopItem(overrideItem, score, topRow);
  } else {
    applyNativeRowToTopItem(overrideItem, topRow);
  }

  parent.insertBefore(overrideItem, nativeItem);
}
