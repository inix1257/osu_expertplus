/**
 * Scoreboard row builder (WS-31): fills a cloned osu-web table row from an
 * API score (wildcard merges, player lookup, extended leaderboard).
 */

import { flagFilename, formatRelativeShort } from "../../osu/format.js";
import {
  ACCURACY_FORMAT,
  formatAccuracy,
  formatCombo,
  hitstatValue,
  isFullCombo,
  isPerfectAccuracy,
  leaderboardScoreId,
  scoreGrade,
} from "../../osu/score.js";
import {
  EXTENDED_SCORE_ROW_ATTR,
  SCOREBOARD_PP_ORIGINAL_ATTR,
  _rowScoreMap,
  getBeatmapPageRuleset,
} from "./context.js";
import { applyScoreboardModsCell } from "./row-mods.js";
import { leaderboardTableScoreNumber } from "./sort.js";

/**
 * @param {HTMLTableRowElement} templateRow
 * @param {number|null|undefined} colIndex
 * @returns {HTMLTableCellElement|null}
 */
export function scoreboardRefTd(templateRow, colIndex) {
  if (colIndex == null || !(templateRow instanceof HTMLTableRowElement))
    return null;
  const tds = templateRow.querySelectorAll("td");
  return /** @type {HTMLTableCellElement|null} */ (tds[colIndex] ?? null);
}

/**
 * Copy `a` classes and reuse the first `<span>` shell when present (matches native typography).
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {string} text
 */
export function applyScoreboardTextCellLikeRef(td, refTd, text) {
  if (!td) return;
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");

  // Common osu-web markup: `td > a.beatmap-scoreboard-table__cell-content`.
  if (a instanceof HTMLAnchorElement) {
    if (refA instanceof HTMLAnchorElement) a.className = refA.className;
    const refShell = refA?.firstElementChild;
    if (refShell instanceof HTMLElement) {
      const shell = refShell.cloneNode(false);
      shell.textContent = text;
      a.replaceChildren(shell);
    } else {
      a.replaceChildren(document.createTextNode(text));
    }
    return;
  }

  // Some columns (notably hitstats) are not links: `td > ...__cell-content`.
  const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
  const refShellParent =
    refTd?.querySelector(".beatmap-scoreboard-table__cell-content") || null;
  if (shell instanceof HTMLElement && refShellParent instanceof HTMLElement) {
    shell.className = refShellParent.className;
    const refChild = refShellParent.firstElementChild;
    if (refChild instanceof HTMLElement) {
      const child = refChild.cloneNode(false);
      child.textContent = text;
      shell.replaceChildren(child);
    } else {
      shell.replaceChildren(document.createTextNode(text));
    }
    return;
  }

  // Fallback: still update something visible.
  td.textContent = text;
}

/**
 * @param {string} cls
 * @param {boolean} on
 */
export function toggleScoreboardCellPerfectClass(cls, on) {
  const PERF = "beatmap-scoreboard-table__cell-content--perfect";
  const base = cls
    .replace(new RegExp(`\\s*${PERF}\\b`, "g"), "")
    .trim()
    .replace(/\s+/g, " ");
  return on ? `${base} ${PERF}`.trim() : base;
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 * @param {number|null|undefined} mapFullCombo
 */
export function applyScoreboardComboCell(td, refTd, score, mapFullCombo) {
  if (!td) return;
  const comboStr = formatCombo(score.max_combo);
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!a || !refA) return;
  const perfect = isFullCombo(score, mapFullCombo, { apiFlags: true });
  a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
  const refChild = refA.firstElementChild;
  if (refChild instanceof HTMLElement) {
    const shell = refChild.cloneNode(false);
    shell.textContent = comboStr;
    a.replaceChildren(shell);
    return;
  }
  a.replaceChildren(document.createTextNode(comboStr));
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 */
export function applyScoreboardAccuracyCell(td, refTd, score) {
  if (!td) return;
  const accStr = formatAccuracy(score.accuracy, ACCURACY_FORMAT.scoreboard);
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!a || !refA) return;
  const perfect = isPerfectAccuracy(score.accuracy);
  a.className = toggleScoreboardCellPerfectClass(refA.className, perfect);
  const refChild = refA.firstElementChild;
  if (refChild instanceof HTMLElement) {
    const shell = refChild.cloneNode(false);
    shell.textContent = accStr;
    a.replaceChildren(shell);
    return;
  }
  a.replaceChildren(document.createTextNode(accStr));
}

/**
 * Display pp on score rows (keep decimal precision from API value).
 * Mirrors native tooltip metadata by writing full pp into `title` /
 * `data-orig-title` on the span.
 *
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 */
export function applyScoreboardPpCell(td, refTd, score) {
  if (!td) return;
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!a || !refA) return;
  a.className = refA.className;
  const pp = score.pp;
  const refSpan = refA.querySelector("span");
  if (pp == null || !Number.isFinite(Number(pp))) {
    if (refSpan) {
      const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
      s.textContent = "—";
      s.removeAttribute("title");
      s.removeAttribute("data-orig-title");
      s.removeAttribute("data-original-title");
      s.removeAttribute(SCOREBOARD_PP_ORIGINAL_ATTR);
      a.replaceChildren(s);
    } else {
      a.replaceChildren(document.createTextNode("—"));
    }
    return;
  }
  const ppNumber = Number(pp);
  const titleStr = String(pp).replace(/,/g, "").trim();
  const displayStr = String(Math.round(ppNumber));
  if (refSpan) {
    const s = /** @type {HTMLSpanElement} */ (refSpan.cloneNode(false));
    s.textContent = displayStr;
    s.setAttribute("title", titleStr);
    s.setAttribute("data-orig-title", titleStr);
    a.replaceChildren(s);
  } else {
    a.replaceChildren(document.createTextNode(displayStr));
  }
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {string} iso
 */
export function applyScoreboardTimeCell(td, refTd, iso) {
  if (!td || !iso) return;
  const timeEl = td.querySelector("time");
  const refTime = refTd?.querySelector("time");
  if (!(timeEl instanceof HTMLTimeElement)) return;
  timeEl.setAttribute("datetime", iso);
  timeEl.textContent = formatRelativeShort(iso, { rounding: "floor" });
  if (refTime) {
    timeEl.className = refTime.className;
    timeEl.setAttribute("title", new Date(iso).toISOString());
  }
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} user
 * @param {string} ruleset
 */
export function applyScoreboardFlagCell(td, refTd, user, ruleset) {
  if (!td) return;
  const code = String(user?.country_code || "")
    .trim()
    .toUpperCase();
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!(a instanceof HTMLAnchorElement)) return;
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (refA) a.className = refA.className;
  if (!code) {
    a.replaceChildren();
    a.removeAttribute("href");
    return;
  }
  a.href = `https://osu.ppy.sh/rankings/${encodeURIComponent(ruleset)}/performance?country=${encodeURIComponent(code)}`;

  // osu-web uses unicode-indicator SVGs for flags (`RU` → `1f1f7-1f1fa.svg`).
  const codeLower = code.toLowerCase();
  const refFlagSpan = refA?.querySelector?.("span.flag-country") ?? null;
  const useSpan = refFlagSpan instanceof HTMLSpanElement;

  const uni = flagFilename(code);

  if (useSpan) {
    // Existing rows use `span.flag-country` + `background-image`.
    let span = a.querySelector("span.flag-country");
    if (!(span instanceof HTMLSpanElement)) {
      span = document.createElement("span");
    }
    span.className = refFlagSpan.className || span.className;
    if (uni) {
      span.style.backgroundImage = `url('/assets/images/flags/${uni}.svg')`;
    }
    span.title = user?.country?.name || code;
    a.replaceChildren(span);
    return;
  }

  // Fallback: use `<img>` if the template row doesn't use the span method.
  let img = a.querySelector("img");
  const refImg = refA?.querySelector("img") ?? null;
  if (!img) {
    img = document.createElement("img");
    if (refImg) img.className = refImg.className;
  } else if (refImg && !img.className) {
    img.className = refImg.className;
  }
  a.replaceChildren(img);

  if (uni) {
    img.src = `/assets/images/flags/${uni}.svg`;
  } else {
    // Fallback to osu! flag PNGs if the country code is invalid.
    let flagsFolder = "flags";
    const refSrc =
      refImg?.getAttribute("src") ||
      refImg?.getAttribute("data-src") ||
      refImg?.src ||
      "";
    const m =
      typeof refSrc === "string"
        ? refSrc.match(/assets\.ppy\.sh\/([^/]+)\/[A-Za-z0-9]{1,3}\.png/i)
        : null;
    if (m?.[1]) flagsFolder = m[1];
    else if (typeof refSrc === "string") {
      if (/\/old-flags\//i.test(refSrc)) flagsFolder = "old-flags";
      else if (/\/flags\//i.test(refSrc)) flagsFolder = "flags";
    }
    img.src = `https://assets.ppy.sh/${flagsFolder}/${codeLower}.png`;
  }

  img.alt = code;
  img.title = user?.country?.name || code;

  // SVG flags should already have correct sizing in osu-web CSS; avoid
  // overriding unless we had to use PNG fallback.
  if (!uni) {
    img.style.maxWidth = "2.25em";
    img.style.maxHeight = "1.15em";
    img.style.width = "auto";
    img.style.height = "auto";
    img.style.objectFit = "contain";
    img.style.verticalAlign = "middle";
  }
}

/**
 * Map `<thead><th>` modifiers to column indices (same order as `<tbody>` cells).
 * Heuristics alone mis-detect **score** when hit-stat columns contain large counts.
 * @param {HTMLTableRowElement} templateRow
 * @param {HTMLTableElement} table
 * @returns {{ rank: number|null, grade: number|null, score: number|null, pp: number|null, accuracy: number|null, flag: number|null, user: number|null, combo: number|null, mods: number|null, time: number|null, hitstatIndices: number[] }}
 */
export function buildBeatmapScoreboardColumnMap(templateRow, table) {
  const ths = [...table.querySelectorAll("thead th")];
  const idx = (mod) => {
    const suf = `__header--${mod}`;
    const th = ths.find((t) => [...t.classList].some((c) => c.endsWith(suf)));
    return th instanceof HTMLTableCellElement ? th.cellIndex : null;
  };

  /**
   * Try to infer the hitstat "label" (great/ok/meh/miss or 300/100/50/miss)
   * from whatever markup osu-web uses (text, aria-label, classes, etc).
   * @param {HTMLTableCellElement} th
   * @returns {string}
   */
  function inferHitstatLabelFromTh(th) {
    const textTrim = String(th.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = [
      th.getAttribute("aria-label"),
      th.getAttribute("title"),
      th.textContent,
      th.className,
    ].filter((x) => typeof x === "string" && x.trim().length > 0);

    const raw = parts.join(" ").toLowerCase();
    if (!raw) return "";

    const hasWord = (w) =>
      new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(raw);

    // Prefer explicit words first (more stable than matching digits).
    if (hasWord("miss") || hasWord("m")) return "miss";
    if (hasWord("meh")) return "meh";
    // Mania columns (osu-web: PERFECT / GOOD).
    if (hasWord("perfect")) return "mania_perfect";
    if (hasWord("good")) return "mania_good";
    if (hasWord("katu") || hasWord("200")) return "katu";
    if (hasWord("ok")) return "ok";
    if (hasWord("geki") || hasWord("320") || hasWord("max")) return "geki";
    if (hasWord("great")) return "great";

    // CTB: terse headers "L" / "DRP" (large tick vs droplet); gate "L" to fruits only.
    const fruits = getBeatmapPageRuleset() === "fruits";
    if (fruits && /^l$/i.test(textTrim)) return "ctb_l";
    if (/^drp$/i.test(textTrim) || hasWord("drp")) return "ctb_drp";

    // Fall back to numeric digits if osu-web doesn't include words.
    if (/(^|[^0-9])300([^0-9]|$)/.test(raw)) return "300";
    if (/(^|[^0-9])100([^0-9]|$)/.test(raw)) return "100";
    if (/(^|[^0-9])50([^0-9]|$)/.test(raw)) return "50";

    return textTrim;
  }

  /** @type {number[]} */
  const hitstatIndices = [];
  /** @type {Record<number, string>} */
  const hitstatLabelsByIndex = {};
  ths.forEach((th) => {
    // osu-web uses `hitstat`-related header classes but the exact class
    // token isn't consistent across themes/skins, so match by substring.
    const isHitstat =
      [...th.classList].some((c) => c === "hitstat" || c.includes("hitstat")) ||
      th.className.includes("hitstat");
    if (isHitstat) {
      const cellIndex = th.cellIndex;
      hitstatIndices.push(cellIndex);
      hitstatLabelsByIndex[cellIndex] = inferHitstatLabelFromTh(th);
    }
  });

  /** @type {Record<string, number|null>} */
  const map = {
    rank: idx("rank"),
    grade: idx("grade"),
    score: idx("score"),
    accuracy: idx("accuracy"),
    flag: idx("flag"),
    user: idx("player"),
    combo: idx("maxcombo"),
    pp: idx("pp"),
    time: idx("time"),
    mods: idx("mods"),
  };

  if (map.rank == null) map.rank = 0;
  if (map.grade == null) map.grade = 1;

  const tds = [...templateRow.querySelectorAll("td")];
  if (map.user == null) {
    const i = tds.findIndex((td) =>
      td.querySelector?.(
        "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
      ),
    );
    if (i >= 0) map.user = i;
  }
  if (map.time == null) {
    const i = tds.findIndex((td) => td.querySelector?.("time"));
    if (i >= 0) map.time = i;
  }
  if (map.mods == null) {
    const i = tds.findIndex((td) =>
      td.querySelector?.(".beatmap-scoreboard-table__mods"),
    );
    if (i >= 0) map.mods = i;
  }

  return { ...map, hitstatIndices, hitstatLabelsByIndex };
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 */
export function applyScoreboardGradeCell(td, refTd, score) {
  if (!td) return;
  // osu-web rank classes use the API rank casing (e.g. `XH`, `SH`, `F`).
  const rankKey = scoreGrade(score, { sanitize: true });
  const link = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refLink = refTd?.querySelector(
    "a.beatmap-scoreboard-table__cell-content",
  );
  if (link && refLink) link.className = refLink.className;
  let div = td.querySelector("div.score-rank");
  if (!div && link) {
    div = document.createElement("div");
    link.replaceChildren(div);
  }
  if (div) {
    div.className = `score-rank score-rank--tiny score-rank--${rankKey}`;
  }
}

/**
 * @param {HTMLTableRowElement} tr
 * @param {object} score
 * @param {number} oneBasedRank
 * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
 * @param {HTMLTableElement} table
 * @param {HTMLTableRowElement} templateRow
 * @param {HTMLElement|null} modTemplateBtn
 */
export function applyApiScoreToBeatmapScoreRow(
  tr,
  score,
  oneBasedRank,
  colMap,
  table,
  templateRow,
  modTemplateBtn,
  mapFullCombo,
) {
  tr.setAttribute(EXTENDED_SCORE_ROW_ATTR, "1");
  _rowScoreMap.set(tr, score);
  // Use real table cell indices (works with colspans and hidden columns).
  const tds = [...tr.cells];
  const uid = score.user?.id ?? score.user_id;
  const username = score.user?.username ?? String(uid);
  const userObj = score.user || { country_code: null, country: null };
  const iso = score.ended_at ?? score.created_at ?? "";
  const ruleset = getBeatmapPageRuleset();

  const rawScore = leaderboardTableScoreNumber(score);
  const scoreStr = Number(rawScore).toLocaleString("en-US");

  if (colMap.rank != null) {
    applyScoreboardTextCellLikeRef(
      tds[colMap.rank],
      scoreboardRefTd(templateRow, colMap.rank),
      `#${oneBasedRank}`,
    );
  }

  if (colMap.grade != null) {
    applyScoreboardGradeCell(
      tds[colMap.grade],
      scoreboardRefTd(templateRow, colMap.grade),
      score,
    );
  }

  if (colMap.score != null) {
    applyScoreboardTextCellLikeRef(
      tds[colMap.score],
      scoreboardRefTd(templateRow, colMap.score),
      scoreStr,
    );
  }

  if (colMap.accuracy != null) {
    applyScoreboardAccuracyCell(
      tds[colMap.accuracy],
      scoreboardRefTd(templateRow, colMap.accuracy),
      score,
    );
  }

  if (colMap.flag != null) {
    applyScoreboardFlagCell(
      tds[colMap.flag],
      scoreboardRefTd(templateRow, colMap.flag),
      userObj,
      ruleset,
    );
  }

  if (colMap.user != null && tds[colMap.user]) {
    const td = tds[colMap.user];
    const userA =
      td.querySelector("a.beatmap-scoreboard-table__user-link") ||
      td.querySelector('a[href*="/users/"]');
    if (userA) {
      userA.href = `https://osu.ppy.sh/users/${uid}`;
      const label =
        userA.querySelector(".beatmap-scoreboard-table__user-link-text") ||
        userA;
      label.textContent = username;
    }
  }

  if (colMap.combo != null) {
    applyScoreboardComboCell(
      tds[colMap.combo],
      scoreboardRefTd(templateRow, colMap.combo),
      score,
      mapFullCombo,
    );
  }

  for (const i of colMap.hitstatIndices || []) {
    const label = colMap.hitstatLabelsByIndex?.[i] ?? "";
    const refHit = scoreboardRefTd(templateRow, i);
    applyScoreboardTextCellLikeRef(
      tds[i],
      refHit,
      hitstatValue(label, score, { ruleset }),
    );
  }

  if (colMap.pp != null && tds[colMap.pp]) {
    applyScoreboardPpCell(
      tds[colMap.pp],
      scoreboardRefTd(templateRow, colMap.pp),
      score,
    );
  }

  if (colMap.time != null && tds[colMap.time] && iso) {
    applyScoreboardTimeCell(
      tds[colMap.time],
      scoreboardRefTd(templateRow, colMap.time),
      iso,
    );
  }

  if (colMap.mods != null && tds[colMap.mods]) {
    applyScoreboardModsCell(tds[colMap.mods], score, modTemplateBtn);
  }

  pointScoreboardRowLinksAtScore(tr, score);
}

/**
 * Row cells are cloned from a native row, so their `/scores/{id}` links still
 * target that row's score. Re-point them at this score (like osu-web rows),
 * or drop the link when the score has no id.
 * @param {HTMLTableRowElement} tr
 * @param {object} score
 */
export function pointScoreboardRowLinksAtScore(tr, score) {
  const scoreId = leaderboardScoreId(score);
  const scoreHrefRe = /\/scores\/(?:[a-z]+\/)?\d+(?:[/?#]|$)/i;
  for (const a of tr.querySelectorAll("a[href]")) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    if (!scoreHrefRe.test(a.getAttribute("href") || "")) continue;
    if (scoreId) a.href = `https://osu.ppy.sh/scores/${scoreId}`;
    else a.removeAttribute("href");
  }
}
