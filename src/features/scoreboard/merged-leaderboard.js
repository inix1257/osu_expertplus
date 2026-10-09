/**
 * Leaderboards Expert+ builds itself (WS-32): wildcard merges and player
 * lookup results replace osu-web's rows in the same table.
 */

import { scoreHasNonstandardRate } from "../../osu/mods.js";
import {
  EXTENDED_SCORE_ROW_ATTR,
  getBeatmapFullComboFromBeatmapsetJson,
  getBeatmapPageBeatmapId,
  RATE_EDIT_ROW_ATTR,
  SCORE_USER_SEARCH_RESULT_ATTR,
  SCOREBOARD_HTML_TABLE_SEL,
  SCOREBOARD_MODS_SEL,
  SCOREBOARD_ROW_SEL,
  SCOREBOARD_TBODY_SEL,
  WILDCARD_DUPE_ROW_ATTR,
  WILDCARD_MERGED_ROW_ATTR,
} from "./context.js";
import { getWildcardMods } from "./mod-filter/state.js";
import {
  cancelWildcardFetch,
  scheduleWildcardFetch,
} from "./mod-filter/wildcard.js";
import { refreshBeatmapScoreboardTableEnhancements } from "./refresh.js";
import {
  applyApiScoreToBeatmapScoreRow,
  buildBeatmapScoreboardColumnMap,
  cloneTemplateRow,
  findScoreboardTemplateRow,
} from "./row-builder.js";
import { resolveBeatmapScoreboardModTemplateEl } from "./row-mods.js";

/**
 * Replace the scoreboard tbody with API-fetched merged wildcard rows.
 * @param {HTMLElement} scoreboardRoot
 * @param {object[]} scores
 */
export function renderWildcardMergedLeaderboard(scoreboardRoot, scores) {
  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return;
  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return;
  const templateRow = findScoreboardTemplateRow(tbody);
  if (!(templateRow instanceof HTMLTableRowElement)) return;

  const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
  const modTemplateBtn = resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
  const beatmapId = getBeatmapPageBeatmapId();
  const mapFullCombo = beatmapId
    ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
    : null;

  const existingExtendedRows = tbody.querySelectorAll(
    `tr[${EXTENDED_SCORE_ROW_ATTR}]`,
  );
  existingExtendedRows.forEach((r) => r.remove());

  const existingWildcardRows = tbody.querySelectorAll(
    `tr[${WILDCARD_MERGED_ROW_ATTR}]`,
  );
  existingWildcardRows.forEach((r) => r.remove());

  tbody
    .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
    .forEach((r) => r.remove());

  const nativeRows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
  for (const nr of nativeRows) nr.style.display = "none";

  // Insert wildcard rows before the hidden native rows so nth-child alternation
  // starts at 1 and matches the visual first row.
  const firstNative = nativeRows[0] ?? null;

  // Track which user ids have already appeared so secondary scores can be dimmed.
  const seenUserIds = new Set();

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    if (!score || typeof score !== "object") continue;
    const row = cloneTemplateRow(templateRow);
    row.setAttribute(WILDCARD_MERGED_ROW_ATTR, "1");
    row.removeAttribute(RATE_EDIT_ROW_ATTR);
    row.removeAttribute(WILDCARD_DUPE_ROW_ATTR);
    row.style.display = "";
    row.classList.remove(
      "beatmap-scoreboard-table__body-row--friend",
      "beatmap-scoreboard-table__body-row--first",
      "beatmap-scoreboard-table__body-row--self",
    );

    // Strip per-user decorations from the player cell before re-applying score data.
    if (colMap.user != null) {
      const playerTd = row.cells[colMap.user];
      if (playerTd) {
        // Remove team flag link (osu! tournament teams show a flag next to the username).
        for (const teamLink of playerTd.querySelectorAll(
          'a[href*="/teams/"]',
        )) {
          teamLink.remove();
        }
      }
    }

    applyApiScoreToBeatmapScoreRow(
      row,
      score,
      i + 1,
      colMap,
      realTable,
      templateRow,
      modTemplateBtn,
      mapFullCombo,
    );

    // Sync js-usercard data-user-id so hover cards reference the correct user.
    const uid = score.user?.id ?? score.user_id;
    if (colMap.user != null && uid != null) {
      const playerTd = row.cells[colMap.user];
      const card = playerTd?.querySelector(".js-usercard");
      if (card instanceof HTMLElement) {
        card.setAttribute("data-user-id", String(uid));
      }
    }

    // Dim rows that are not this player's highest-ranked entry in the merged list.
    const uidKey = uid != null ? String(uid) : null;
    if (uidKey != null) {
      if (seenUserIds.has(uidKey)) {
        row.setAttribute(WILDCARD_DUPE_ROW_ATTR, "1");
      } else {
        seenUserIds.add(uidKey);
      }
    }

    // Dim rows with a custom rate (anything other than 1.00× or 1.50×).
    if (scoreHasNonstandardRate(score)) {
      row.setAttribute(RATE_EDIT_ROW_ATTR, "1");
    }

    tbody.insertBefore(row, firstNative);
  }

  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
}

/**
 * Remove wildcard-merged rows and restore native rows.
 * @param {HTMLElement|null} scoreboardRoot
 */
export function clearWildcardMergedLeaderboard(scoreboardRoot) {
  if (!scoreboardRoot) return;
  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return;
  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return;
  tbody
    .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
    .forEach((r) => r.remove());
  tbody
    .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
    .forEach((r) => r.remove());
  for (const nr of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
    /** @type {HTMLElement} */ (nr).style.display = "";
  }
  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
}

/**
 * Remove player-lookup rows from the main leaderboard and show osu-web rows again.
 * @param {HTMLElement|null|undefined} scoreboardRoot
 * @param {Element|null|undefined} modsEl
 * @param {boolean} [rescheduleWildcard=true] When true and wildcard mods are active, re-runs the merged fetch (e.g. user clicked Reset).
 */
export function clearUserSearchMergedLeaderboard(
  scoreboardRoot,
  modsEl,
  rescheduleWildcard = true,
) {
  if (!(scoreboardRoot instanceof HTMLElement)) return;
  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return;
  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return;
  tbody
    .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
    .forEach((r) => r.remove());
  for (const nr of tbody.querySelectorAll(SCOREBOARD_ROW_SEL)) {
    /** @type {HTMLElement} */ (nr).style.display = "";
  }
  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  if (!rescheduleWildcard) return;
  const mods =
    modsEl instanceof HTMLElement
      ? modsEl
      : scoreboardRoot.querySelector(SCOREBOARD_MODS_SEL);
  if (mods instanceof HTMLElement && getWildcardMods().length > 0) {
    scheduleWildcardFetch(mods);
  }
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
 * Paint player-lookup scores into the same main leaderboard tbody as osu-web (and wildcard),
 * hiding native rows so there is only one table.
 * @param {HTMLElement} scoreboardRoot
 * @param {object[]} scores
 * @param {object|null|undefined} userTeam
 * @returns {boolean}
 */
export function renderUserSearchMergedLeaderboard(
  scoreboardRoot,
  scores,
  userTeam,
) {
  if (!Array.isArray(scores) || scores.length === 0) return false;

  const realTable = scoreboardRoot.querySelector(SCOREBOARD_HTML_TABLE_SEL);
  if (!(realTable instanceof HTMLTableElement)) return false;

  const tbody = realTable.querySelector(SCOREBOARD_TBODY_SEL);
  if (!tbody) return false;

  const templateRow = findScoreboardTemplateRow(tbody);
  if (!(templateRow instanceof HTMLTableRowElement)) return false;

  const colMap = buildBeatmapScoreboardColumnMap(templateRow, realTable);
  const modTemplateBtn = resolveBeatmapScoreboardModTemplateEl(scoreboardRoot);
  const beatmapId = getBeatmapPageBeatmapId();
  const mapFullCombo = beatmapId
    ? getBeatmapFullComboFromBeatmapsetJson(beatmapId)
    : null;

  cancelWildcardFetch();

  tbody
    .querySelectorAll(`tr[${EXTENDED_SCORE_ROW_ATTR}]`)
    .forEach((r) => r.remove());
  tbody
    .querySelectorAll(`tr[${WILDCARD_MERGED_ROW_ATTR}]`)
    .forEach((r) => r.remove());
  tbody
    .querySelectorAll(`tr[${SCORE_USER_SEARCH_RESULT_ATTR}]`)
    .forEach((r) => r.remove());

  const nativeRows = [...tbody.querySelectorAll(SCOREBOARD_ROW_SEL)];
  for (const nr of nativeRows) nr.style.display = "none";
  const firstNative = nativeRows[0] ?? null;

  let inserted = 0;
  for (const score of scores) {
    if (!score || typeof score !== "object") continue;
    const resultRow = cloneTemplateRow(templateRow);
    resultRow.setAttribute(SCORE_USER_SEARCH_RESULT_ATTR, "1");
    resultRow.removeAttribute(RATE_EDIT_ROW_ATTR);
    resultRow.style.display = "";
    resultRow.classList.remove(
      "beatmap-scoreboard-table__body-row--friend",
      "beatmap-scoreboard-table__body-row--first",
      "beatmap-scoreboard-table__body-row--self",
    );

    if (colMap.user != null) {
      const playerTd = resultRow.cells[colMap.user];
      if (playerTd) {
        for (const teamLink of playerTd.querySelectorAll(
          'a[href*="/teams/"]',
        )) {
          teamLink.remove();
        }
        if (userTeam?.id && userTeam.flag_url) {
          const teamA = document.createElement("a");
          teamA.className = "u-contents u-hover";
          teamA.href = `https://osu.ppy.sh/teams/${userTeam.id}`;
          const teamSpan = document.createElement("span");
          teamSpan.className = "flag-team";
          teamSpan.style.backgroundImage = `url("${userTeam.flag_url}")`;
          teamSpan.title = userTeam.name ?? "";
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
      }
    }

    const position = beatmapUserSearchGlobalRank(score);
    applyApiScoreToBeatmapScoreRow(
      resultRow,
      score,
      position ?? 0,
      colMap,
      realTable,
      templateRow,
      modTemplateBtn,
      mapFullCombo,
    );
    demoteBeatmapUserSearchResultRowLinks(resultRow);
    resultRow.removeAttribute(EXTENDED_SCORE_ROW_ATTR);

    if (colMap.user != null) {
      const uid = score.user?.id ?? score.user_id;
      const playerTd = resultRow.cells[colMap.user];
      const card = playerTd?.querySelector(".js-usercard");
      if (card instanceof HTMLElement && uid != null) {
        card.setAttribute("data-user-id", String(uid));
      }
    }

    if (scoreHasNonstandardRate(score)) {
      resultRow.setAttribute(RATE_EDIT_ROW_ATTR, "1");
    }

    if (position == null && colMap.rank != null) {
      const rankTd = [...resultRow.cells][colMap.rank];
      if (rankTd) {
        const shell = rankTd.querySelector(
          ".beatmap-scoreboard-table__cell-content",
        );
        if (shell) shell.textContent = "?";
        else rankTd.textContent = "?";
      }
    }

    tbody.insertBefore(resultRow, firstNative);
    inserted += 1;
  }

  if (!inserted) return false;

  refreshBeatmapScoreboardTableEnhancements(scoreboardRoot);
  return true;
}
