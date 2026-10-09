/**
 * Scoreboard top panel (WS-31): keeps the big "#1" card in sync with the
 * table's effective first row (merged, filtered or sorted).
 */

import {
  EXTENDED_SCORE_ROW_ATTR,
  SCOREBOARD_HTML_TABLE_SEL,
  SCORE_USER_SEARCH_RESULT_ATTR,
  WILDCARD_MERGED_ROW_ATTR,
  _rowScoreMap,
  getBeatmapPageRuleset,
} from "./context.js";
import {
  hitstatTextFromHeaderLabel,
  leaderboardScoreId,
} from "./row-builder.js";
import { leaderboardTableScoreNumber } from "./sort.js";

/** Marks an OEP-managed `.beatmap-scoreboard-top__item` that overrides the native panel. */
export const SCORE_TOP_OVERRIDE_ATTR = "data-oep-score-top-override";

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
 * Converts a two-letter country code to the unicode flag SVG filename used by osu-web.
 * @param {string} cc
 * @returns {string|null}
 */
export function _scoreTopFlagFilename(cc) {
  if (!/^[A-Za-z]{2}$/.test(cc || "")) return null;
  const upper = cc.toUpperCase();
  const u1 = (0x1f1e6 + upper.charCodeAt(0) - 65).toString(16);
  const u2 = (0x1f1e6 + upper.charCodeAt(1) - 65).toString(16);
  return `${u1}-${u2}`;
}

/**
 * Returns a short relative-time string (e.g. "3mo", "2y") from an ISO timestamp.
 * @param {string} iso
 * @returns {string}
 */
export function _scoreTopRelativeTime(iso) {
  if (!iso) return "";
  try {
    const abs = Math.abs(Date.now() - new Date(iso).getTime());
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
    if (abs < 2_592_000_000) return `${Math.round(abs / 86_400_000)}d`;
    if (abs < 31_536_000_000) return `${Math.round(abs / 2_592_000_000)}mo`;
    return `${Math.round(abs / 31_536_000_000)}y`;
  } catch {
    return "";
  }
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

  const gradeStr =
    typeof score.rank === "string"
      ? score.rank
      : score.rank &&
          typeof score.rank === "object" &&
          typeof score.rank.name === "string"
        ? score.rank.name
        : score.passed === false
          ? "F"
          : "D";
  const rankKey = String(gradeStr).replace(/[^A-Za-z0-9]+/g, "") || "D";
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
    achievedTime.textContent = _scoreTopRelativeTime(iso);
  }

  const countryA = item.querySelector(".beatmap-score-top__flags a");
  if (countryA instanceof HTMLAnchorElement && cc)
    countryA.href = `https://osu.ppy.sh/rankings/${ruleset}/performance?country=${cc}`;
  const flagSpan = item.querySelector(
    ".beatmap-score-top__flags span.flag-country",
  );
  if (flagSpan instanceof HTMLElement && cc) {
    const uni = _scoreTopFlagFilename(cc);
    if (uni)
      flagSpan.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
    flagSpan.title = countryName;
  }

  const rawScore = leaderboardTableScoreNumber(score);
  const scoreStr = Number(rawScore).toLocaleString("en-US");
  const accStr =
    typeof score.accuracy === "number"
      ? `${(score.accuracy * 100).toFixed(2)}%`
      : "";
  const comboStr = `${Number(score.max_combo ?? 0).toLocaleString("en-US")}x`;
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

  for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
    const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
    const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
    if (!headerEl || !valueEl) continue;
    const label = headerEl.textContent?.trim() ?? "";
    const labelLow = label.toLowerCase();

    if (labelLow === "total score") {
      valueEl.textContent = scoreStr;
    } else if (labelLow === "accuracy") {
      valueEl.textContent = accStr;
    } else if (labelLow === "max combo") {
      valueEl.textContent = comboStr;
    } else if (labelLow === "pp") {
      if (ppStr != null) {
        valueEl.textContent = ppStr;
      } else {
        valueEl.innerHTML =
          '<span title="pp is not awarded for this score">-</span>';
      }
    } else if (labelLow === "time") {
      if (iso) {
        const t = document.createElement("time");
        t.className = "js-tooltip-time";
        t.setAttribute("data-orig-title", iso);
        t.textContent = _scoreTopRelativeTime(iso);
        valueEl.replaceChildren(t);
      }
    } else if (labelLow === "mods") {
      if (rowMods) {
        const modsValueEl =
          stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
        const existing = modsValueEl.querySelector(".mods");
        const clone = rowMods.cloneNode(true);
        if (existing) existing.replaceWith(clone);
        else modsValueEl.appendChild(clone);
      }
    } else {
      valueEl.textContent = hitstatTextFromHeaderLabel(label, score);
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

  const great =
    row.querySelector(".oep-score-stats__val--300")?.textContent?.trim() ?? "-";
  const ok =
    row.querySelector(".oep-score-stats__val--100")?.textContent?.trim() ?? "-";
  const meh =
    row.querySelector(".oep-score-stats__val--50")?.textContent?.trim() ?? "-";
  const miss =
    row.querySelector(".oep-score-stats__val--miss")?.textContent?.trim() ??
    "-";
  const ppText =
    row
      .querySelector(".oep-beatmap-scoreboard-pp-value")
      ?.textContent?.trim() ?? "";
  const timeEl = row.querySelector("time.js-tooltip-time");
  const timeIso = timeEl?.getAttribute("datetime") ?? "";
  const timeText = timeEl?.textContent?.trim() ?? "";
  const rowMods = row.querySelector(".mods");

  const hitMap = new Map([
    ["great", great],
    ["ok", ok],
    ["meh", meh],
    ["miss", miss],
  ]);

  for (const stat of item.querySelectorAll(".beatmap-score-top__stat")) {
    const headerEl = stat.querySelector(".beatmap-score-top__stat-header");
    const valueEl = stat.querySelector(".beatmap-score-top__stat-value");
    if (!headerEl || !valueEl) continue;
    const labelLow = (headerEl.textContent?.trim() ?? "").toLowerCase();

    if (labelLow === "accuracy" && accuracy) {
      valueEl.textContent = accuracy;
    } else if (labelLow === "max combo" && maxCombo) {
      valueEl.textContent = maxCombo;
    } else if (labelLow === "pp" && ppText) {
      valueEl.textContent = ppText;
    } else if (labelLow === "time" && timeIso) {
      const t = document.createElement("time");
      t.className = "js-tooltip-time";
      t.setAttribute("data-orig-title", timeIso);
      t.textContent = timeText;
      valueEl.replaceChildren(t);
    } else if (labelLow === "mods" && rowMods) {
      const modsValueEl =
        stat.querySelector(".beatmap-score-top__stat-value--mods") ?? valueEl;
      const existing = modsValueEl.querySelector(".mods");
      const clone = rowMods.cloneNode(true);
      if (existing) existing.replaceWith(clone);
      else modsValueEl.appendChild(clone);
    } else if (hitMap.has(labelLow)) {
      valueEl.textContent = hitMap.get(labelLow) ?? "-";
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
export function refreshBeatmapScoreTopPanel(scoreboardRoot) {
  const nativeItem = scoreboardRoot.querySelector(
    `.beatmap-scoreboard-top__item:not([${SCORE_TOP_OVERRIDE_ATTR}])`,
  );
  if (!(nativeItem instanceof HTMLElement)) return;
  const parent = nativeItem.parentElement;
  if (!parent) return;

  // Remove any previously inserted override panel.
  for (const old of parent.querySelectorAll(`[${SCORE_TOP_OVERRIDE_ATTR}]`)) {
    old.remove();
  }

  const topRow = getEffectiveBoardTopRow(scoreboardRoot);
  if (!topRow) {
    nativeItem.style.display = "";
    return;
  }

  nativeItem.style.display = "none";

  const overrideItem = /** @type {HTMLElement} */ (nativeItem.cloneNode(true));
  overrideItem.setAttribute(SCORE_TOP_OVERRIDE_ATTR, "1");

  const score = _rowScoreMap.get(topRow);
  if (score) {
    applyApiScoreToTopItem(overrideItem, score, topRow);
  } else {
    applyNativeRowToTopItem(overrideItem, topRow);
  }

  parent.insertBefore(overrideItem, nativeItem);
}
