/**
 * Scoreboard row builder (WS-31): fills a cloned osu-web table row from an
 * API score (wildcard merges, player lookup, extended leaderboard).
 */

import {
  EXTENDED_SCORE_ROW_ATTR,
  SCOREBOARD_PP_ORIGINAL_ATTR,
  _rowScoreMap,
  getBeatmapPageRuleset,
} from "./context.js";
import { applyScoreboardModsCell } from "./row-mods.js";
import { leaderboardTableScoreNumber } from "./sort.js";

/**
 * Stable numeric id for sorting extended score rows.
 * @param {object|null|undefined} score
 * @returns {string|null}
 */
export function leaderboardScoreId(score) {
  if (!score || typeof score !== "object") return null;
  const raw =
    score.id ??
    score.legacy_score_id ??
    score.score_id ??
    score.scoreId ??
    score.scoreID ??
    score.score?.id ??
    score.score?.legacy_score_id ??
    score.score?.score_id ??
    null;
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n > 0 ? String(n) : null;
  const s = String(raw).trim();
  return s ? s : null;
}

/**
 * Short relative labels similar to osu leaderboard (`now`, `2d`, `5mo`, `3y`).
 * @param {string} iso
 */
export function formatScoreboardShortAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 45) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(day / 365);
  if (y < 1) return `${mo}mo`;
  return `${y}y`;
}

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
 * API v2 Score (solo) uses `is_perfect_combo` / `legacy_perfect`; some payloads still expose `perfect`.
 * @param {object} score
 * @returns {boolean}
 */
export function scoreApiIndicatesComboPerfect(score) {
  if (!score || typeof score !== "object") return false;
  if (score.perfect === true) return true;
  if (score.is_perfect_combo === true) return true;
  if (score.legacy_perfect === true) return true;
  return false;
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 * @param {number|null|undefined} mapFullCombo
 */
export function applyScoreboardComboCell(td, refTd, score, mapFullCombo) {
  if (!td) return;
  const comboStr = `${Number(score.max_combo ?? 0).toLocaleString("en-US")}x`;
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!a || !refA) return;
  const maxCombo = Number(score.max_combo ?? 0);
  const stats =
    score?.statistics && typeof score.statistics === "object"
      ? score.statistics
      : {};
  const maxComboFromStats = Number(
    score.maximum_statistics?.max_combo ??
      score.maximum_statistics?.maxCombo ??
      stats.max_combo ??
      stats.maxCombo,
  );
  const mapFull = mapFullCombo != null ? Number(mapFullCombo) : NaN;
  const hasMapFull = Number.isFinite(mapFull) && mapFull > 0;
  const inferredPerfect = hasMapFull
    ? maxCombo > 0 && maxCombo === mapFull
    : Number.isFinite(maxComboFromStats) &&
      maxComboFromStats > 0 &&
      maxCombo === maxComboFromStats;
  const perfect = scoreApiIndicatesComboPerfect(score) || inferredPerfect;
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
  const accStr =
    typeof score.accuracy === "number"
      ? `${(score.accuracy * 100).toFixed(2)}%`
      : "";
  const a = td.querySelector("a.beatmap-scoreboard-table__cell-content");
  const refA = refTd?.querySelector("a.beatmap-scoreboard-table__cell-content");
  if (!a || !refA) return;
  const perfect = typeof score.accuracy === "number" && score.accuracy >= 1;
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
  timeEl.textContent = formatScoreboardShortAgo(iso);
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

  // osu-web uses unicode-indicator SVGs for flags.
  // Example: `RU` -> `1f1f7-1f1fa.svg`.
  function toUnicodeFlagFilename(cc) {
    const c = String(cc || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return null;
    const A = c.charCodeAt(0) - 65;
    const B = c.charCodeAt(1) - 65;
    const u1 = 0x1f1e6 + A;
    const u2 = 0x1f1e6 + B;
    return `${u1.toString(16)}-${u2.toString(16)}`;
  }

  const codeLower = code.toLowerCase();
  const refFlagSpan = refA?.querySelector?.("span.flag-country") ?? null;
  const useSpan = refFlagSpan instanceof HTMLSpanElement;

  const uni = toUnicodeFlagFilename(code);

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
 * @param {string} labelRaw  from `<th>` (hit-stat short label)
 * @param {object|null|undefined} score  full API score (statistics + legacy fields)
 */
export function hitstatTextFromHeaderLabel(labelRaw, score) {
  const statsSource =
    score?.statistics && typeof score.statistics === "object"
      ? score.statistics
      : score && typeof score === "object"
        ? score
        : {};

  const pick = (...keys) => {
    for (const k of keys) {
      const v = statsSource?.[k];
      if (v != null && v !== "" && Number.isFinite(Number(v))) return String(v);
    }
    return "0";
  };

  const hasLazer =
    statsSource?.great != null ||
    statsSource?.perfect != null ||
    statsSource?.ok != null ||
    statsSource?.meh != null ||
    statsSource?.miss != null;

  const n300 = hasLazer
    ? Number(statsSource?.great ?? 0) + Number(statsSource?.perfect ?? 0)
    : statsSource?.count_300 != null
      ? Number(statsSource.count_300)
      : statsSource?.count300 != null
        ? Number(statsSource.count300)
        : Number(statsSource?.count_geki ?? statsSource?.countgeki ?? 0);
  const n100 = hasLazer
    ? Number(statsSource?.ok ?? 0)
    : Number(statsSource?.count_100 ?? statsSource?.count100 ?? 0);
  const n50 = hasLazer
    ? Number(statsSource?.meh ?? 0)
    : Number(statsSource?.count_50 ?? statsSource?.count50 ?? 0);
  const nMiss = hasLazer
    ? Number(statsSource?.miss ?? 0)
    : Number(statsSource?.count_miss ?? statsSource?.countmiss ?? 0);

  const lab = String(labelRaw).trim().toLowerCase();

  // osu standard: prefer exact numeric hit counts.
  if (lab === "miss" || lab === "m" || lab.includes("miss"))
    return String(nMiss);

  if (lab === "mania_perfect")
    return pick("count_geki", "countgeki", "perfect", "great");
  if (lab === "mania_good")
    return pick("count_katu", "countkatu", "good", "great");

  if (lab === "ctb_l" || (lab === "l" && getBeatmapPageRuleset() === "fruits"))
    return pick("large_tick_hit", "large_bonus");
  if (lab === "ctb_drp" || lab === "drp")
    return pick("small_tick_hit", "small_bonus");

  // Order matters: mania uses `320` and it contains `300`.
  if (lab === "geki" || lab === "max" || lab === "320")
    return pick("count_geki", "countgeki", "perfect", "great");

  if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
    return String(n300);

  if (lab === "katu" || lab === "200")
    return pick("count_katu", "countkatu", "good", "great");

  if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok") return String(n100);

  if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") return String(n50);

  if (lab.includes("tick") || lab === "tail")
    return pick(
      "large_tick_hit",
      "small_tick_hit",
      "slider_tail_hit",
      "large_tick_miss",
    );

  return "0";
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @param {HTMLTableCellElement|null|undefined} refTd
 * @param {object} score
 */
export function applyScoreboardGradeCell(td, refTd, score) {
  if (!td) return;
  const r =
    typeof score.rank === "string"
      ? score.rank
      : score.rank &&
          typeof score.rank === "object" &&
          typeof score.rank.name === "string"
        ? score.rank.name
        : score.passed === false
          ? "F"
          : "D";
  // osu-web rank classes use the API rank casing (e.g. `XH`, `SH`, `F`).
  const rankKey = String(r).replace(/[^A-Za-z0-9]+/g, "") || "D";
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
      hitstatTextFromHeaderLabel(label, score),
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
