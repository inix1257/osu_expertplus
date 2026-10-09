/**
 * Scoreboard column sorting (WS-31): header sort buttons, the persisted sort
 * state, sorting the table rows, and sorting API score lists the same way.
 */

import { leaderboardScoreId } from "../../osu/score.js";
import { parseLocaleNumber } from "../../osu/format.js";
import { el } from "../legacy.js";
import {
  SCOREBOARD_HTML_TABLE_SEL,
  findBeatmapScoreboardRoot,
  isLazerModeEnabledForLeaderboard,
} from "./context.js";
import { refreshBeatmapScoreboardTableEnhancements } from "./refresh.js";
import { buildBeatmapScoreboardColumnMap } from "./row-builder.js";

/** Marks the per-column sort control in `<th>` (re-mounted after osu-web React refresh). */
export const SCOREBOARD_SORT_ARROW_ATTR = "data-oep-scoreboard-sort-arrow";

/** @type {readonly string[]} */
export const BEATMAP_SCOREBOARD_SORT_KEYS = Object.freeze([
  "score",
  "accuracy",
  "combo",
  "pp",
  "date",
]);

/**
 * Main score column value aligned with osu-web's Lazer mode toggle.
 * Lazer mode off -> prefer `legacy_total_score`.
 * Lazer mode on  -> prefer `classic_total_score`.
 * @param {object} s
 */
export function leaderboardTableScoreNumber(s) {
  const nz = (v) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const cls = nz(s.classic_total_score);
  const leg = nz(s.legacy_total_score);
  if (isLazerModeEnabledForLeaderboard()) {
    if (cls) return cls;
    if (leg) return leg;
  } else {
    if (leg) return leg;
    if (cls) return cls;
  }
  const tot = nz(s.total_score);
  if (tot) return tot;
  const raw = nz(s.score);
  if (raw) return raw;
  const xTot = Number(s.total_score);
  if (Number.isFinite(xTot)) return xTot;
  const xLeg = Number(s.legacy_total_score);
  if (Number.isFinite(xLeg)) return xLeg;
  return 0;
}

/**
 * @param {object[]} scores
 */
export function sortLeaderboardScoresLikeTable(scores) {
  scores.sort((a, b) => {
    const ds = leaderboardTableScoreNumber(b) - leaderboardTableScoreNumber(a);
    if (ds !== 0) return ds;
    const ppb = Number(b.pp);
    const ppa = Number(a.pp);
    if (Number.isFinite(ppb) && Number.isFinite(ppa) && ppb !== ppa)
      return ppb - ppa;
    return (
      (Number(leaderboardScoreId(b)) || 0) -
      (Number(leaderboardScoreId(a)) || 0)
    );
  });
}

/**
 * Leaderboard sort for this tab only (not GM); default score descending.
 * @type {{ key: string, dir: "asc"|"desc" }}
 */
export let beatmapScoreboardSortState = { key: "score", dir: "desc" };

/**
 * @returns {{ key: string, dir: "asc"|"desc" }}
 */
export function readBeatmapScoreboardSortState() {
  const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(
    beatmapScoreboardSortState.key,
  )
    ? beatmapScoreboardSortState.key
    : "score";
  const d = beatmapScoreboardSortState.dir === "asc" ? "asc" : "desc";
  return { key: k, dir: d };
}

/**
 * @param {string} key
 * @param {"asc"|"desc"} dir
 */
export function writeBeatmapScoreboardSortState(key, dir) {
  const k = BEATMAP_SCOREBOARD_SORT_KEYS.includes(String(key).toLowerCase())
    ? String(key).toLowerCase()
    : "score";
  const d = dir === "asc" ? "asc" : "desc";
  beatmapScoreboardSortState = { key: k, dir: d };
}

/**
 * @param {string} sortKey
 * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
 * @returns {number|null}
 */
export function beatmapScoreboardSortColIndex(sortKey, colMap) {
  if (sortKey === "date") return colMap.time;
  return colMap[sortKey] ?? null;
}

/**
 * @param {string} sortKey
 * @returns {string}
 */
export function beatmapScoreboardSortColumnLabel(sortKey) {
  if (sortKey === "score") return "Score";
  if (sortKey === "accuracy") return "Accuracy";
  if (sortKey === "combo") return "Combo";
  if (sortKey === "pp") return "PP";
  if (sortKey === "date") return "Date";
  return "Score";
}

export function applyBeatmapScoreboardSortHeaderClick(sortKey) {
  const { key, dir } = readBeatmapScoreboardSortState();
  let nextDir = "desc";
  if (key === sortKey) {
    nextDir = dir === "desc" ? "asc" : "desc";
  }
  writeBeatmapScoreboardSortState(sortKey, nextDir);
  const board = findBeatmapScoreboardRoot();
  if (board instanceof HTMLElement) {
    refreshBeatmapScoreboardTableEnhancements(board);
  }
}

/**
 * @param {string} sortKey
 * @returns {HTMLButtonElement}
 */
export function createBeatmapScoreboardSortHeaderButton(sortKey) {
  const label = beatmapScoreboardSortColumnLabel(sortKey);
  const btn = /** @type {HTMLButtonElement} */ (
    el("button", {
      type: "button",
      class: "oep-scoreboard-th-sort",
      [SCOREBOARD_SORT_ARROW_ATTR]: "",
      "data-oep-sort-key": sortKey,
      "aria-label": `Sort by ${label}`,
      title: `Sort by ${label}`,
    })
  );
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyBeatmapScoreboardSortHeaderClick(sortKey);
  });
  return btn;
}

/**
 * @param {HTMLButtonElement} btn
 * @param {string} sortKey
 * @param {{ key: string, dir: "asc"|"desc" }} state
 */
export function updateBeatmapScoreboardSortHeaderButton(btn, sortKey, state) {
  const label = beatmapScoreboardSortColumnLabel(sortKey);
  const active = state.key === sortKey;
  const sym = !active ? "▼" : state.dir === "desc" ? "▼" : "▲";
  btn.classList.toggle("oep-scoreboard-th-sort--active", active);
  if (btn.textContent !== sym) btn.textContent = sym;
  const tip = `Sort by ${label}`;
  btn.setAttribute("aria-label", tip);
  btn.title = tip;
  if (active) {
    btn.setAttribute("aria-pressed", "true");
  } else {
    btn.removeAttribute("aria-pressed");
  }
}

/**
 * Re-attaches sort arrows after osu-web replaces thead (SPA). Idempotent.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function syncBeatmapScoreboardHeaderSortUi(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(table instanceof HTMLTableElement)) return;
  const tbodyRow = table.querySelector(
    "tbody.beatmap-scoreboard-table__body tr.beatmap-scoreboard-table__body-row",
  );
  if (!(tbodyRow instanceof HTMLTableRowElement)) return;
  const colMap = buildBeatmapScoreboardColumnMap(tbodyRow, table);
  const theadRow = table.querySelector("thead tr");
  if (!(theadRow instanceof HTMLTableRowElement)) return;
  const state = readBeatmapScoreboardSortState();

  for (let i = 0; i < theadRow.cells.length; i++) {
    const th = theadRow.cells[i];
    if (!(th instanceof HTMLTableCellElement)) continue;
    const btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
    if (!(btn instanceof HTMLButtonElement)) continue;
    const k = btn.getAttribute("data-oep-sort-key");
    const expected =
      k != null ? beatmapScoreboardSortColIndex(k, colMap) : null;
    if (expected == null || th.cellIndex !== expected) {
      btn.remove();
    }
  }

  /** @type {Array<[string, number|null]>} */
  const pairs = [
    ["score", colMap.score],
    ["accuracy", colMap.accuracy],
    ["combo", colMap.combo],
    ["pp", colMap.pp],
    ["date", colMap.time],
  ];
  for (const [sk, cellIdx] of pairs) {
    if (cellIdx == null) continue;
    const th = theadRow.cells[cellIdx];
    if (!(th instanceof HTMLTableCellElement)) continue;
    let btn = th.querySelector(`[${SCOREBOARD_SORT_ARROW_ATTR}]`);
    if (!(btn instanceof HTMLButtonElement)) {
      btn = createBeatmapScoreboardSortHeaderButton(sk);
      th.appendChild(btn);
    } else if (btn.getAttribute("data-oep-sort-key") !== sk) {
      btn.remove();
      btn = createBeatmapScoreboardSortHeaderButton(sk);
      th.appendChild(btn);
    }
    updateBeatmapScoreboardSortHeaderButton(btn, sk, state);
  }
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @returns {number}
 */
export function beatmapScoreboardTdNumberForSort(td) {
  if (!(td instanceof HTMLTableCellElement)) return -Infinity;
  const span = td.querySelector(
    "a.beatmap-scoreboard-table__cell-content span[title], span.beatmap-scoreboard-table__cell-content span[title], span[title]",
  );
  let raw = (
    span?.getAttribute("title") ||
    span?.textContent ||
    td.textContent ||
    ""
  ).trim();
  raw = raw.replace(/\u00a0/g, " ");
  raw = raw
    .replace(/[x×%]/gi, "")
    .replace(/\bpp\b/gi, "")
    .replace(/,/g, "")
    .trim();
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) ? n : -Infinity;
}

/**
 * @param {HTMLTableCellElement|null|undefined} td
 * @returns {number}
 */
export function beatmapScoreboardTdDateMsForSort(td) {
  if (!(td instanceof HTMLTableCellElement)) return -Infinity;
  const timeEl = td.querySelector("time");
  if (!(timeEl instanceof HTMLTimeElement)) return -Infinity;
  const raw =
    timeEl.getAttribute("datetime") ||
    timeEl.getAttribute("title") ||
    timeEl.dateTime ||
    "";
  const ms = Date.parse(String(raw).trim());
  return Number.isFinite(ms) ? ms : -Infinity;
}

/**
 * @param {HTMLTableRowElement} row
 * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
 * @param {string} sortKey
 * @returns {number}
 */
export function beatmapScoreboardRowSortPrimary(row, colMap, sortKey) {
  if (sortKey === "date") {
    const i = colMap.time;
    return i != null
      ? beatmapScoreboardTdDateMsForSort(row.cells[i])
      : -Infinity;
  }
  const i =
    sortKey === "score"
      ? colMap.score
      : sortKey === "accuracy"
        ? colMap.accuracy
        : sortKey === "combo"
          ? colMap.combo
          : sortKey === "pp"
            ? colMap.pp
            : colMap.score;
  if (i == null) return -Infinity;
  return beatmapScoreboardTdNumberForSort(row.cells[i]);
}

/**
 * @param {HTMLTableRowElement} row
 * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
 * @returns {number}
 */
export function beatmapScoreboardRowSortTieScore(row, colMap) {
  if (colMap.score == null) return -Infinity;
  return beatmapScoreboardTdNumberForSort(row.cells[colMap.score]);
}

/**
 * @param {HTMLTableRowElement[]} visibleRows
 * @param {ReturnType<typeof buildBeatmapScoreboardColumnMap>} colMap
 */
export function renumberBeatmapScoreboardVisibleRanks(visibleRows, colMap) {
  if (colMap.rank == null || !Array.isArray(visibleRows)) return;
  for (let i = 0; i < visibleRows.length; i++) {
    const row = visibleRows[i];
    if (!(row instanceof HTMLTableRowElement)) continue;
    const td = row.cells[colMap.rank];
    if (!td) continue;
    const shell = td.querySelector(".beatmap-scoreboard-table__cell-content");
    const target = shell instanceof HTMLElement ? shell : td;
    const cur = String(target.textContent ?? "").trim();
    if (cur === "?") continue;
    const next = String(i + 1);
    if (cur !== next) target.textContent = next;
  }
}

/**
 * Reorders visible tbody rows by the chosen column and direction. Hidden native
 * rows stay at the end. Skips DOM writes when order is already correct so the
 * scoreboard MutationObserver does not loop. Updates rank cells for visible rows.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 */
export function applyBeatmapScoreboardLeaderboardSort(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(table instanceof HTMLTableElement)) return;
  const tbody = table.querySelector("tbody.beatmap-scoreboard-table__body");
  if (!(tbody instanceof HTMLElement)) return;

  const allRows = [
    ...tbody.querySelectorAll("tr.beatmap-scoreboard-table__body-row"),
  ];
  if (allRows.length < 1) return;

  const visible = allRows.filter(
    (r) => r instanceof HTMLElement && r.style.display !== "none",
  );
  const hidden = allRows.filter(
    (r) => r instanceof HTMLElement && r.style.display === "none",
  );

  if (visible.length < 1) return;

  const templateRow = /** @type {HTMLTableRowElement} */ (visible[0]);
  const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
  const { key: sortKey, dir } = readBeatmapScoreboardSortState();
  const desc = dir === "desc";

  if (visible.length < 2) {
    renumberBeatmapScoreboardVisibleRanks(visible, colMap);
    return;
  }

  const sortedVisible = visible.slice().sort((a, b) => {
    const ar = /** @type {HTMLTableRowElement} */ (a);
    const br = /** @type {HTMLTableRowElement} */ (b);
    const pa = beatmapScoreboardRowSortPrimary(ar, colMap, sortKey);
    const pb = beatmapScoreboardRowSortPrimary(br, colMap, sortKey);
    const pc = desc ? pb - pa : pa - pb;
    if (pc !== 0) return pc;
    const ta = beatmapScoreboardRowSortTieScore(ar, colMap);
    const tb = beatmapScoreboardRowSortTieScore(br, colMap);
    const tc = desc ? tb - ta : ta - tb;
    return tc;
  });

  const desired = [...sortedVisible, ...hidden];
  let same = true;
  for (let i = 0; i < desired.length; i++) {
    if (tbody.children[i] !== desired[i]) {
      same = false;
      break;
    }
  }
  if (!same) {
    for (const row of desired) tbody.appendChild(row);
  }
  renumberBeatmapScoreboardVisibleRanks(sortedVisible, colMap);
}

/**
 * Debounced thead sync when osu-web re-renders the scoreboard (SPA).
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startBeatmapScoreboardSortControls(pathRe) {
  let debounceTimer = 0;

  const cleanup = () => {
    document
      .querySelectorAll(
        `.beatmapset-scoreboard [${SCOREBOARD_SORT_ARROW_ATTR}]`,
      )
      .forEach((n) => n.remove());
  };

  const run = () => {
    debounceTimer = 0;
    if (!pathRe.test(location.pathname)) {
      cleanup();
      return;
    }
    const root = findBeatmapScoreboardRoot();
    if (!(root instanceof HTMLElement)) return;
    syncBeatmapScoreboardHeaderSortUi(root);
  };

  const schedule = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(run, 16);
  };

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  return () => {
    window.clearTimeout(debounceTimer);
    obs.disconnect();
    cleanup();
  };
}
