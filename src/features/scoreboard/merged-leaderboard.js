/**
 * Leaderboards Expert+ builds itself (WS-32): wildcard merges and player
 * lookup results replace osu-web's rows in the same table. Only one is shown
 * at a time; rendering either drops the other's rows.
 */

import { scoreHasNonstandardRate } from "../../osu/mods.js";
import {
  EXTENDED_SCORE_ROW_ATTR,
  getBeatmapFullComboFromBeatmapsetJson,
  getBeatmapPageBeatmapId,
  RATE_EDIT_ROW_ATTR,
  setRowHidden,
  SCORE_USER_SEARCH_RESULT_ATTR,
  SCOREBOARD_HTML_TABLE_SEL,
  SCOREBOARD_ROW_SEL,
  SCOREBOARD_TBODY_SEL,
  WILDCARD_DUPE_ROW_ATTR,
  WILDCARD_MERGED_ROW_ATTR,
} from "./context.js";
import { refreshBeatmapScoreboardTableEnhancements } from "./refresh.js";
import {
  applyApiScoreToBeatmapScoreRow,
  buildBeatmapScoreboardColumnMap,
  cloneTemplateRow,
  findScoreboardTemplateRow,
} from "./row-builder.js";
import { resolveBeatmapScoreboardModTemplateEl } from "./row-mods.js";

/** @typedef {"wildcard"|"lookup"} MergedKind */

/** Single-cell row standing in for an empty or failed merged leaderboard. */
export const MERGED_NOTICE_CLASS = "oep-merged-notice";

/** Row marker per kind. */
export const MERGED_ROW_ATTRS = {
  wildcard: WILDCARD_MERGED_ROW_ATTR,
  lookup: SCORE_USER_SEARCH_RESULT_ATTR,
};

/**
 * @param {HTMLElement|null|undefined} scoreboardRoot
 * @returns {{ table: HTMLTableElement, tbody: HTMLElement }|null}
 */
function findScoreboardTable(scoreboardRoot) {
  if (!(scoreboardRoot instanceof HTMLElement)) return null;
  const table = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(table instanceof HTMLTableElement)) return null;
  const tbody = table.querySelector(SCOREBOARD_TBODY_SEL);
  if (!(tbody instanceof HTMLElement)) return null;
  return { table, tbody };
}

/**
 * Global rank for a score row when the API includes it; otherwise unknown.
 * @param {object} score
 * @returns {number|null}
 */
function beatmapUserSearchGlobalRank(score) {
  const r = Number(score?.rank_global);
  if (Number.isFinite(r) && r > 0) return r;
  return null;
}

/**
 * Turn scoreboard cell `<a>` wrappers into `<span>` so stale template links are
 * not navigable, except `a.beatmap-scoreboard-table__user-link` (profile URL)
 * and links already pointing at the row's own `/scores/{id}` page.
 * @param {HTMLTableRowElement} tr
 */
function demoteBeatmapUserSearchResultRowLinks(tr) {
  if (!(tr instanceof HTMLTableRowElement)) return;
  for (const a of tr.querySelectorAll("a")) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    if (a.classList.contains("beatmap-scoreboard-table__user-link")) continue;
    if (
      /\/scores\/(?:[a-z]+\/)?\d+(?:[/?#]|$)/i.test(
        a.getAttribute("href") || "",
      )
    ) {
      continue;
    }
    const href = a.getAttribute("href") || "";
    if (
      /\/rankings\/[^/]+\/performance\?country=/i.test(href) &&
      a.classList.contains("beatmap-scoreboard-table__cell-content")
    ) {
      continue;
    }
    if (/\/teams\/[^/?#]+/i.test(href) && a.querySelector(".flag-team")) {
      continue;
    }
    const span = document.createElement("span");
    span.className = a.className;
    for (const attr of [...a.attributes]) {
      const n = attr.name;
      if (n === "href" || n === "target" || n === "download" || n === "rel") {
        continue;
      }
      span.setAttribute(n, attr.value);
    }
    while (a.firstChild) span.appendChild(a.firstChild);
    a.replaceWith(span);
  }
}

/**
 * @param {HTMLTableCellElement} playerTd
 * @param {{ id?: number, flag_url?: string, name?: string }} team
 */
function prependTeamFlag(playerTd, team) {
  const teamA = document.createElement("a");
  teamA.className = "u-contents u-hover";
  teamA.href = `https://osu.ppy.sh/teams/${team.id}`;
  const teamSpan = document.createElement("span");
  teamSpan.className = "flag-team";
  teamSpan.style.backgroundImage = `url("${team.flag_url}")`;
  teamSpan.title = team.name ?? "";
  teamA.appendChild(teamSpan);
  const userLink = playerTd.querySelector(
    "a.beatmap-scoreboard-table__user-link, a[href*='/users/']",
  );
  if (userLink) {
    userLink.insertAdjacentElement("beforebegin", teamA);
  } else {
    playerTd.prepend(teamA);
  }
}

/**
 * Drop every injected row and hide osu-web's rows for a merged leaderboard.
 * @param {HTMLElement} tbody
 * @returns {Element|null}  the first osu-web row (insert merged rows before it)
 */
function replaceNativeRows(tbody) {
  tbody
    .querySelectorAll(
      `tr[${EXTENDED_SCORE_ROW_ATTR}], tr[${WILDCARD_MERGED_ROW_ATTR}], tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`,
    )
    .forEach((r) => r.remove());
  const nativeRows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
  for (const nr of nativeRows) setRowHidden(nr, "merged", true);
  return nativeRows[0] ?? null;
}

/**
 * A merged leaderboard with a message instead of scores (no scores, or the
 * fetch failed): osu-web's rows stay hidden, since they answer a different
 * query.
 * @param {HTMLElement} scoreboardRoot
 * @param {MergedKind} kind
 * @param {string} text
 */
export function showMergedNotice(scoreboardRoot, kind, text) {
  const found = findScoreboardTable(scoreboardRoot);
  if (!found) return;
  const { table, tbody } = found;
  const firstNative = replaceNativeRows(tbody);
  const columns =
    table.tHead?.rows[0]?.cells.length ||
    /** @type {HTMLTableRowElement|null} */ (firstNative)?.cells.length ||
    1;
  const tr = document.createElement("tr");
  tr.className = MERGED_NOTICE_CLASS;
  tr.setAttribute(MERGED_ROW_ATTRS[kind], "1");
  const td = document.createElement("td");
  td.colSpan = columns;
  td.textContent = text;
  tr.appendChild(td);
  tbody.insertBefore(tr, firstNative);
  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
}

/**
 * Show `scores` in place of osu-web's rows (which stay in the tbody, hidden).
 *
 * - wildcard: ranked 1..n in order; a player's lower entries are dimmed.
 * - lookup: one player's scores with their global rank (`?` when unknown),
 *   the player's team flag, and links that would point at the template
 *   row's score turned into plain text.
 * @param {HTMLElement} scoreboardRoot
 * @param {MergedKind} kind
 * @param {object[]} scores
 * @param {{ team?: object|null, beforeInsert?: () => void }} [opts]
 *   `beforeInsert` runs once the table is known to be ready.
 * @returns {boolean}  false when nothing was rendered
 */
export function renderMergedLeaderboard(
  scoreboardRoot,
  kind,
  scores,
  opts = {},
) {
  const lookup = kind === "lookup";
  if (lookup && (!Array.isArray(scores) || scores.length === 0)) return false;
  const found = findScoreboardTable(scoreboardRoot);
  if (!found) return false;
  const { table, tbody } = found;
  const templateRow = findScoreboardTemplateRow(tbody);
  if (!(templateRow instanceof HTMLTableRowElement)) return false;

  const colMap = buildBeatmapScoreboardColumnMap(templateRow, table);
  const modTemplateBtn = resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
  const beatmapId = getBeatmapPageBeatmapId();
  const mapFullCombo = beatmapId
    ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
    : null;

  opts.beforeInsert?.();

  // Insert before the hidden native rows so nth-child alternation starts at
  // 1 and matches the visual first row.
  const firstNative = replaceNativeRows(tbody);

  // Track which user ids have already appeared so secondary scores can be dimmed.
  const seenUserIds = new Set();
  let inserted = 0;

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    if (!score || typeof score !== "object") continue;
    const row = cloneTemplateRow(templateRow);
    row.setAttribute(MERGED_ROW_ATTRS[kind], "1");

    const playerTd = colMap.user != null ? row.cells[colMap.user] : null;
    if (playerTd) {
      // Drop the template player's team flag (and add the looked-up player's).
      for (const teamLink of playerTd.querySelectorAll('a[href*="/teams/"]')) {
        teamLink.remove();
      }
      const team = opts.team;
      if (lookup && team?.id && team.flag_url) prependTeamFlag(playerTd, team);
    }

    const position = lookup ? beatmapUserSearchGlobalRank(score) : i + 1;
    applyApiScoreToBeatmapScoreRow(
      row,
      score,
      position ?? 0,
      colMap,
      table,
      templateRow,
      modTemplateBtn,
      mapFullCombo,
    );
    if (lookup) {
      demoteBeatmapUserSearchResultRowLinks(row);
      row.removeAttribute(EXTENDED_SCORE_ROW_ATTR);
    }

    // Sync js-usercard data-user-id so hover cards reference the correct user.
    const uid = score.user?.id ?? score.user_id;
    const card = playerTd?.querySelector(".js-usercard");
    if (card instanceof HTMLElement && uid != null) {
      card.setAttribute("data-user-id", String(uid));
    }

    if (!lookup && uid != null) {
      const uidKey = String(uid);
      if (seenUserIds.has(uidKey))
        row.setAttribute(WILDCARD_DUPE_ROW_ATTR, "1");
      else seenUserIds.add(uidKey);
    }

    // Dim rows with a custom rate (a speed other than the mod default).
    if (scoreHasNonstandardRate(score)) {
      row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
    }

    if (lookup && position == null && colMap.rank != null) {
      const rankTd = row.cells[colMap.rank];
      if (rankTd) {
        const shell = rankTd.querySelector(
          ".beatmap-scoreboard-table__cell-content",
        );
        if (shell) shell.textContent = "?";
        else rankTd.textContent = "?";
      }
    }

    tbody.insertBefore(row, firstNative);
    inserted += 1;
  }

  if (lookup && !inserted) return false;

  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  return true;
}

/**
 * Remove merged rows and show osu-web's rows again. Clearing the wildcard
 * merge also drops lookup rows (as before WS-32).
 * @param {HTMLElement|null|undefined} scoreboardRoot
 * @param {MergedKind} kind
 */
export function clearMergedLeaderboard(scoreboardRoot, kind) {
  const found = findScoreboardTable(scoreboardRoot);
  if (!found) return;
  const { tbody } = found;
  const kinds = kind === "wildcard" ? ["lookup", "wildcard"] : ["lookup"];
  for (const k of kinds) {
    tbody
      .querySelectorAll(`tr[${MERGED_ROW_ATTRS[k]}]`)
      .forEach((r) => r.remove());
  }
  // Clearing lookup rows can leave a wildcard merge (rendered before the
  // lookup was) in place; its native rows stay hidden then.
  const mergedLeft = tbody.querySelector(
    Object.values(MERGED_ROW_ATTRS)
      .map((attr) => `tr[${attr}]`)
      .join(", "),
  );
  if (!mergedLeft) {
    for (const nr of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
      setRowHidden(nr, "merged", false);
    }
  }
  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
}
