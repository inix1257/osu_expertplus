/**
 * OMDB (omdb.nyahh.net) ratings row on the beatmapset header (WS-33).
 */

import { readBeatmapsetJson } from "../../osu/beatmapset-data.js";
import { el, omdb } from "../legacy.js";
import {
  OEP_OMDB_ROW_CLASS,
  OEP_OMDB_VOTE_CLASS,
  OEP_OMDB_WRAP_CLASS,
} from "./constants.js";
import { parseBeatmapIdFromPickerLink } from "./picker-diff-names.js";

/**
 * @param {unknown} n
 * @returns {string|null}  e.g. "#4,212"
 */
export function formatOmdbRankDisplay(n) {
  if (n == null || n === "") return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `#${x.toLocaleString()}`;
}

export const OMDB_CHART_PAGE_SIZE = 50;

/**
 * Charts list ~50 mapsets per page; `p` is 1-based.
 * @param {unknown} rank  1-based chart position
 * @returns {number}
 */
export function omdbChartPageFromRank(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.ceil(n / OMDB_CHART_PAGE_SIZE);
}

/**
 * Ranked calendar year for OMDB year-chart links: `ranked_date` from #json-beatmapset first,
 * else a `time.js-tooltip-time` row under `.beatmapset-mapping` whose text includes
 * ranked / qualified / approved (matches osu-web’s BeatmapsetMapping date lines).
 * @param {HTMLElement|null} header  `.beatmapset-header` (optional; narrows `.beatmapset-mapping` query)
 * @returns {number|null}
 */
export function getBeatmapsetRankedCalendarYear(header) {
  const data = readBeatmapsetJson();
  const rankedIso = data?.ranked_date;
  if (rankedIso != null && String(rankedIso).trim() !== "") {
    const y = new Date(String(rankedIso)).getUTCFullYear();
    if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
  }

  const scope =
    (header instanceof HTMLElement
      ? header.querySelector(".beatmapset-mapping")
      : null) ??
    document.querySelector(".beatmapset-mapping") ??
    (header instanceof HTMLElement ? header : null) ??
    document.querySelector(".beatmapset-header");

  if (!(scope instanceof HTMLElement)) return null;

  const times = scope.querySelectorAll("time.js-tooltip-time[datetime]");
  for (const t of times) {
    if (!(t instanceof HTMLTimeElement)) continue;
    const dt = t.getAttribute("datetime");
    if (!dt) continue;
    let walk = t.parentElement;
    while (walk && scope.contains(walk)) {
      const txt = walk.textContent || "";
      if (
        /\branked\b/i.test(txt) ||
        /\bqualified\b/i.test(txt) ||
        /\bapproved\b/i.test(txt)
      ) {
        const y = new Date(dt).getUTCFullYear();
        if (Number.isFinite(y) && y >= 2007 && y <= 2100) return y;
        break;
      }
      walk = walk.parentElement;
    }
  }
  return null;
}

/**
 * Year rank label + chart link use ranked calendar year when known.
 * When both chart ranks are null, still shows `{year} -, overall -`.
 * @param {object} entry
 * @param {number|null} rankedYear
 * @returns {HTMLElement}
 */
export function buildOmdbRanksBlock(entry, rankedYear) {
  const overallHash = formatOmdbRankDisplay(entry.ChartRank);
  const yearHash = formatOmdbRankDisplay(entry.ChartYearRank);
  if (!overallHash && !yearHash) {
    const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
    const yearLabel = rankedYear != null ? String(rankedYear) : "year";
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
    );
    wrap.appendChild(document.createTextNode(" "));
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
    );
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
    );
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
    );
    wrap.appendChild(document.createTextNode(" "));
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, "-"),
    );
    return wrap;
  }

  const wrap = el("span", { class: `${OEP_OMDB_ROW_CLASS}__ranks` });
  if (yearHash) {
    const yearLabel = rankedYear != null ? String(rankedYear) : "year";
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, yearLabel),
    );
    wrap.appendChild(document.createTextNode(" "));
    if (rankedYear != null) {
      const yearPage = omdbChartPageFromRank(entry.ChartYearRank);
      wrap.appendChild(
        el(
          "a",
          {
            class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
            href: `https://omdb.nyahh.net/charts/?y=${encodeURIComponent(String(rankedYear))}&p=${yearPage}`,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          yearHash,
        ),
      );
    } else {
      wrap.appendChild(
        el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-value` }, yearHash),
      );
    }
  }
  if (yearHash && overallHash) {
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-sep` }, ", "),
    );
  }
  if (overallHash) {
    const overallPage = omdbChartPageFromRank(entry.ChartRank);
    wrap.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__rank-muted` }, "overall"),
    );
    wrap.appendChild(document.createTextNode(" "));
    wrap.appendChild(
      el(
        "a",
        {
          class: `${OEP_OMDB_ROW_CLASS}__rank-value`,
          href: `https://omdb.nyahh.net/charts/?y=all-time&p=${overallPage}`,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        overallHash,
      ),
    );
  }
  return wrap;
}

/**
 * Full ladder 0★ … 5★ in 0.5 steps; missing API keys count as 0.
 * @param {object|undefined} entry
 * @returns {{ score: number, count: number }[]}
 */
export function buildOmdbDistributionRows(entry) {
  if (entry == null) return [];
  /** @type {Map<number, number>} */
  const byScore = new Map();
  const raw = entry.Ratings;
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      const score = Number(k);
      const count = Number(v);
      if (!Number.isFinite(score) || !Number.isFinite(count)) continue;
      const key = Math.round(score * 2) / 2;
      if (key < 0 || key > 5) continue;
      byScore.set(key, (byScore.get(key) ?? 0) + count);
    }
  }
  const rows = [];
  for (let i = 0; i <= 10; i++) {
    const score = i * 0.5;
    rows.push({ score, count: byScore.get(score) ?? 0 });
  }
  return rows;
}

/**
 * "4.12 avg · 74 ratings" with the numeric values wrapped for a distinct text colour.
 * @param {number} avgN
 * @param {boolean} hasAvg
 * @param {number} cntN
 * @param {boolean} hasCnt
 * @returns {(string|Element)[]}
 */
export function buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt) {
  const nodes = [];
  if (hasAvg) {
    nodes.push(
      el(
        "span",
        { class: `${OEP_OMDB_ROW_CLASS}__stat-value` },
        avgN.toFixed(2),
      ),
      " avg",
    );
  }
  if (hasCnt) {
    if (nodes.length) nodes.push(" · ");
    nodes.push(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__stat-value` }, String(cntN)),
      ` rating${cntN === 1 ? "" : "s"}`,
    );
  }
  return nodes;
}

/**
 * @param {number} score
 */
export function formatOmdbDistScoreLabel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return String(score);
  const h = Math.round(n * 2) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/**
 * @param {HTMLElement} popEl
 * @param {{ score: number, count: number }[]} rows
 */
export function fillOmdbDistPopover(popEl, rows) {
  popEl.replaceChildren();
  popEl.appendChild(
    el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-head` }, "Distribution"),
  );
  const maxC = Math.max(1, ...rows.map((r) => r.count));
  for (const { score, count } of rows) {
    const row = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-row` });
    row.appendChild(
      el(
        "span",
        { class: `${OEP_OMDB_ROW_CLASS}__dist-score` },
        `${formatOmdbDistScoreLabel(score)}★`,
      ),
    );
    const track = el("div", {
      class: `${OEP_OMDB_ROW_CLASS}__dist-bar-track`,
    });
    const bar = el("div", { class: `${OEP_OMDB_ROW_CLASS}__dist-bar` });
    const pct = count <= 0 ? 0 : Math.max(8, (count / maxC) * 100);
    bar.style.width = `${pct}%`;
    track.appendChild(bar);
    row.appendChild(track);
    row.appendChild(
      el("span", { class: `${OEP_OMDB_ROW_CLASS}__dist-count` }, String(count)),
    );
    popEl.appendChild(row);
  }
}

/**
 * @param {HTMLElement} bodyEl
 * @param {object|undefined} entry
 * @param {{ bindTrigger: (trigger: HTMLElement, rows: { score: number, count: number }[]) => void }|null} [distUi]
 * @param {HTMLElement|null} [header]  `.beatmapset-header` for ranked year from DOM
 * @param {boolean} [difficultyBlacklistedOnOmdb]  Successful set JSON but this beatmap omitted (OMDB blacklist)
 */
export function renderOmdbRatingRowBody(
  bodyEl,
  entry,
  distUi,
  header,
  difficultyBlacklistedOnOmdb,
) {
  bodyEl.classList.remove(
    `${OEP_OMDB_ROW_CLASS}__body--muted`,
    `${OEP_OMDB_ROW_CLASS}__body--error`,
  );
  if (difficultyBlacklistedOnOmdb) {
    bodyEl.textContent = "This difficulty is blacklisted on OMDB.";
    bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
    return;
  }
  if (entry == null) {
    bodyEl.textContent = "No ratings for this difficulty on OMDB.";
    bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
    return;
  }
  const avgN = Number(entry.WeightedAvg);
  const cntN = Number(entry.RatingCount);
  const hasAvg = Number.isFinite(avgN);
  const hasCnt = Number.isFinite(cntN) && cntN > 0;
  const rankedYear = getBeatmapsetRankedCalendarYear(
    header instanceof HTMLElement ? header : null,
  );
  const ranksEl = buildOmdbRanksBlock(entry, rankedYear);
  const distRows = buildOmdbDistributionRows(entry);
  const useDistPopover =
    Boolean(distUi) && distRows.length > 0 && (hasAvg || hasCnt);

  const frag = document.createDocumentFragment();
  let first = true;
  /**
   * @param {Node} node
   */
  function appendChunk(node) {
    if (!first) frag.appendChild(document.createTextNode(" · "));
    first = false;
    frag.appendChild(node);
  }

  if (hasAvg || hasCnt) {
    const statNodes = buildOmdbStatNodes(avgN, hasAvg, cntN, hasCnt);
    if (useDistPopover && distUi) {
      const anchor = el("span", {
        class: `${OEP_OMDB_ROW_CLASS}__dist-anchor`,
      });
      const trigger = el(
        "span",
        {
          class: `${OEP_OMDB_ROW_CLASS}__dist-trigger`,
          tabindex: "0",
          title: "Rating breakdown",
        },
        ...statNodes,
      );
      anchor.appendChild(trigger);
      distUi.bindTrigger(trigger, distRows);
      appendChunk(anchor);
    } else {
      appendChunk(el("span", {}, ...statNodes));
    }
  }
  if (ranksEl) appendChunk(ranksEl);

  if (first) {
    bodyEl.textContent = "No ratings for this difficulty on OMDB.";
    bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
    return;
  }
  bodyEl.replaceChildren(frag);
}

/**
 * @param {object|undefined} entry
 * @returns {number|null}
 */
export function parseOmdbOwnRating(entry) {
  const own = entry?.OwnRating;
  if (own == null || String(own).trim() === "") return null;
  const n = Number(own);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 2) / 2;
}

/**
 * @param {HTMLElement[]} units
 * @param {number|null|undefined} score
 */
export function paintOmdbStarUnits(units, score) {
  const s =
    score == null || !Number.isFinite(Number(score))
      ? null
      : Math.round(Number(score) * 2) / 2;
  for (let i = 0; i < 5; i++) {
    const u = units[i];
    const full = i + 1;
    const half = i + 0.5;
    u.classList.remove(
      `${OEP_OMDB_VOTE_CLASS}__unit--full`,
      `${OEP_OMDB_VOTE_CLASS}__unit--half`,
      `${OEP_OMDB_VOTE_CLASS}__unit--empty`,
    );
    if (s == null || s < half) {
      u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--empty`);
    } else if (s >= full) {
      u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--full`);
    } else {
      u.classList.add(`${OEP_OMDB_VOTE_CLASS}__unit--half`);
    }
  }
}

/**
 * OMDB mapset link + short hint when the feature is on but no API key is set.
 * @returns {() => void}
 */
export function mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId) {
  const diffName = header.querySelector(".beatmapset-header__diff-name");
  const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
  if (!diffName || !box) return () => {};

  const stale = box.querySelector('[data-oep-omdb-row="1"]');
  if (stale) stale.remove();

  const omdbLabel = el(
    "a",
    {
      class: `${OEP_OMDB_ROW_CLASS}__label`,
      href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Open this beatmapset on OMDB",
    },
    "OMDB",
  );
  const keyLink = el(
    "a",
    {
      href: "#",
      class: `${OEP_OMDB_ROW_CLASS}__settings-link`,
      title: "Open Expert+ settings",
    },
    "OMDB API key",
  );
  keyLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    OsuExpertPlus.settingsPanel?.open?.();
  });
  const bodyEl = el(
    "span",
    {
      class: `${OEP_OMDB_ROW_CLASS}__body ${OEP_OMDB_ROW_CLASS}__body--muted`,
    },
    "Add an ",
    keyLink,
    " to load OMDB ratings here",
  );
  const statsRow = el("div", { class: OEP_OMDB_ROW_CLASS }, omdbLabel, bodyEl);
  const wrap = el("div", {
    class: OEP_OMDB_WRAP_CLASS,
    "data-oep-omdb-row": "1",
  });
  wrap.appendChild(statsRow);
  box.insertBefore(wrap, diffName);

  return () => {
    wrap.remove();
  };
}

/**
 * Inserts an OMDB stats row above `.beatmapset-header__diff-name`.
 * Tracks hovered vs active picker link (same behaviour as the difficulty title).
 * @returns {() => void}
 */
export function mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe) {
  const diffName = header.querySelector(".beatmapset-header__diff-name");
  const picker = header.querySelector(".beatmapset-beatmap-picker");
  const box = header.querySelector(".beatmapset-header__beatmap-picker-box");
  if (!diffName || !picker || !box) return () => {};

  const stale = box.querySelector('[data-oep-omdb-row="1"]');
  if (stale) stale.remove();

  const distPopoverEl = el("div", {
    class: `${OEP_OMDB_ROW_CLASS}__dist-popover`,
    "data-oep-omdb-dist-popover": "1",
  });
  distPopoverEl.style.cssText = "display:none;position:fixed;z-index:10002;";
  document.body.appendChild(distPopoverEl);
  let distPopoverHideTimer = 0;

  function hideOmdbDistPopover() {
    window.clearTimeout(distPopoverHideTimer);
    distPopoverHideTimer = 0;
    distPopoverEl.style.display = "none";
    distPopoverEl.replaceChildren();
  }

  function positionOmdbDistPopover(anchorRect) {
    const margin = 6;
    const w = distPopoverEl.offsetWidth;
    const h = distPopoverEl.offsetHeight;
    let left = anchorRect.left;
    let top = anchorRect.bottom + margin;
    if (left + w > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - w - 8);
    }
    if (top + h > window.innerHeight - 8) {
      top = Math.max(8, anchorRect.top - h - margin);
    }
    distPopoverEl.style.left = `${left}px`;
    distPopoverEl.style.top = `${top}px`;
  }

  function showOmdbDistPopover(trigger, rows) {
    window.clearTimeout(distPopoverHideTimer);
    fillOmdbDistPopover(distPopoverEl, rows);
    distPopoverEl.style.display = "block";
    positionOmdbDistPopover(trigger.getBoundingClientRect());
  }

  distPopoverEl.addEventListener("mouseenter", () => {
    window.clearTimeout(distPopoverHideTimer);
  });
  distPopoverEl.addEventListener("mouseleave", () => {
    distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 100);
  });

  function onOmdbDistScrollOrResize() {
    if (distPopoverEl.style.display !== "none") hideOmdbDistPopover();
  }
  window.addEventListener("scroll", onOmdbDistScrollOrResize, true);
  window.addEventListener("resize", onOmdbDistScrollOrResize, {
    passive: true,
  });

  const omdbDistUi = {
    /**
     * @param {HTMLElement} trigger
     * @param {{ score: number, count: number }[]} rows
     */
    bindTrigger(trigger, rows) {
      const schedHide = () => {
        window.clearTimeout(distPopoverHideTimer);
        distPopoverHideTimer = window.setTimeout(hideOmdbDistPopover, 120);
      };
      trigger.addEventListener("mouseenter", () => {
        showOmdbDistPopover(trigger, rows);
      });
      trigger.addEventListener("mouseleave", schedHide);
      trigger.addEventListener("focus", () => {
        showOmdbDistPopover(trigger, rows);
      });
      trigger.addEventListener("blur", schedHide);
    },
  };

  const bodyEl = el(
    "span",
    { class: `${OEP_OMDB_ROW_CLASS}__body` },
    "Loading OMDB…",
  );
  const omdbLabel = el(
    "a",
    {
      class: `${OEP_OMDB_ROW_CLASS}__label`,
      href: `https://omdb.nyahh.net/mapset/${encodeURIComponent(String(beatmapsetId))}`,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Open this beatmapset on OMDB",
    },
    "OMDB",
  );
  const statsRow = el("div", { class: OEP_OMDB_ROW_CLASS }, omdbLabel, bodyEl);

  const starUnits = [];
  const starsHost = el("div", { class: `${OEP_OMDB_VOTE_CLASS}__stars` });
  for (let si = 0; si < 5; si++) {
    const unitClass =
      si === 0
        ? `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty ${OEP_OMDB_VOTE_CLASS}__unit--has-zero`
        : `${OEP_OMDB_VOTE_CLASS}__unit ${OEP_OMDB_VOTE_CLASS}__unit--empty`;
    const unit = el("span", { class: unitClass });
    unit.appendChild(
      el("i", {
        class: `far fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--empty`,
        "aria-hidden": "true",
      }),
    );
    unit.appendChild(
      el("i", {
        class: `fas fa-star-half-alt ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--half`,
        "aria-hidden": "true",
      }),
    );
    unit.appendChild(
      el("i", {
        class: `fas fa-star ${OEP_OMDB_VOTE_CLASS}__icon ${OEP_OMDB_VOTE_CLASS}__icon--full`,
        "aria-hidden": "true",
      }),
    );
    if (si === 0) {
      unit.appendChild(
        el("button", {
          type: "button",
          class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--zero`,
          "data-oep-score": "0",
          "aria-label":
            "Rate 0 out of 5 stars on OMDB (left edge of first star)",
          title: "0★",
        }),
      );
    }
    const left = el("button", {
      type: "button",
      class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--left`,
      "data-oep-score": String(si + 0.5),
      "aria-label": `Rate ${si + 0.5} out of 5 stars on OMDB`,
      title: `${si + 0.5}★`,
    });
    const right = el("button", {
      type: "button",
      class: `${OEP_OMDB_VOTE_CLASS}__half ${OEP_OMDB_VOTE_CLASS}__half--right`,
      "data-oep-score": String(si + 1),
      "aria-label": `Rate ${si + 1} out of 5 stars on OMDB`,
      title: `${si + 1}★`,
    });
    unit.appendChild(left);
    unit.appendChild(right);
    starUnits.push(unit);
    starsHost.appendChild(unit);
  }

  const clearBtn = el(
    "button",
    {
      type: "button",
      class: `${OEP_OMDB_VOTE_CLASS}__clear ${OEP_OMDB_VOTE_CLASS}__clear--concealed`,
      title: "Remove your OMDB rating",
      "aria-hidden": "true",
    },
    "Clear",
  );
  const voteStatus = el("span", { class: `${OEP_OMDB_VOTE_CLASS}__status` });
  const voteControls = el(
    "div",
    { class: `${OEP_OMDB_VOTE_CLASS}__controls` },
    el("span", { class: `${OEP_OMDB_VOTE_CLASS}__label` }, "Your rating"),
    starsHost,
    clearBtn,
  );
  const voteRow = el(
    "div",
    {
      class: OEP_OMDB_VOTE_CLASS,
      "data-oep-omdb-vote": "1",
      style: "display: none",
    },
    voteControls,
    voteStatus,
  );

  const wrap = el("div", {
    class: OEP_OMDB_WRAP_CLASS,
    "data-oep-omdb-row": "1",
  });
  wrap.appendChild(statsRow);
  wrap.appendChild(voteRow);
  box.insertBefore(wrap, diffName);

  const beatmapIdsInSet = new Set();
  for (const b of readBeatmapsetJson()?.beatmaps ?? []) {
    if (b?.id != null) beatmapIdsInSet.add(Number(b.id));
  }
  let omdbSetFetchSucceeded = false;
  /**
   * The set's ratings request: picker hovers and other re-syncs must not
   * replace "Loading…" or an error with "No ratings" (B57).
   * @type {"loading"|"ready"|"error"}
   */
  let loadState = "loading";
  let loadError = "";

  /** @type {Map<number, object>} */
  let byBeatmapId = new Map();
  let hoveredBeatmapId = null;
  /** @type {number|null} */
  let hoverStarScore = null;
  let voteBusy = false;
  let disposed = false;
  let raf = 0;

  function getActiveBeatmapIdFromPicker() {
    const a = picker.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    return a instanceof HTMLAnchorElement
      ? parseBeatmapIdFromPickerLink(a)
      : null;
  }

  function currentDisplayedBeatmapId() {
    return hoveredBeatmapId ?? getActiveBeatmapIdFromPicker();
  }

  function isOmdbDifficultyBlacklisted(beatmapId) {
    if (!omdbSetFetchSucceeded || beatmapId == null) return false;
    if (byBeatmapId.size === 0) return false;
    const n = Number(beatmapId);
    if (!Number.isFinite(n) || !beatmapIdsInSet.has(n)) return false;
    return !byBeatmapId.has(n);
  }

  function setVoteBusy(on) {
    voteBusy = on;
    voteRow.classList.toggle(`${OEP_OMDB_VOTE_CLASS}--busy`, on);
    clearBtn.disabled = on;
  }

  function syncVoteStars() {
    if (disposed || voteRow.style.display === "none") return;
    const id = currentDisplayedBeatmapId();
    if (id == null) {
      paintOmdbStarUnits(starUnits, null);
      clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
      clearBtn.setAttribute("aria-hidden", "true");
      return;
    }
    const entry = byBeatmapId.get(id);
    const own = parseOmdbOwnRating(entry);
    const visual = hoverStarScore != null ? hoverStarScore : own;
    paintOmdbStarUnits(starUnits, visual);
    if (own != null) {
      clearBtn.classList.remove(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
      clearBtn.removeAttribute("aria-hidden");
    } else {
      clearBtn.classList.add(`${OEP_OMDB_VOTE_CLASS}__clear--concealed`);
      clearBtn.setAttribute("aria-hidden", "true");
    }
  }

  function syncDisplay() {
    if (disposed || !pathRe.test(location.pathname)) return;
    if (loadState !== "ready") {
      bodyEl.textContent = loadState === "error" ? loadError : "Loading OMDB…";
      bodyEl.classList.toggle(
        `${OEP_OMDB_ROW_CLASS}__body--error`,
        loadState === "error",
      );
      bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      return;
    }
    const id = currentDisplayedBeatmapId();
    if (id == null) {
      bodyEl.textContent = "";
      bodyEl.classList.add(`${OEP_OMDB_ROW_CLASS}__body--muted`);
      syncVoteStars();
      return;
    }
    bodyEl.classList.remove(
      `${OEP_OMDB_ROW_CLASS}__body--muted`,
      `${OEP_OMDB_ROW_CLASS}__body--error`,
    );
    renderOmdbRatingRowBody(
      bodyEl,
      byBeatmapId.get(id),
      omdbDistUi,
      header,
      isOmdbDifficultyBlacklisted(id),
    );
    syncVoteStars();
  }

  function scheduleSync() {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      syncDisplay();
    });
  }

  /**
   * @param {MouseEvent} e
   */
  function onPickerMouseOver(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest("a.beatmapset-beatmap-picker__beatmap");
    if (!(a instanceof HTMLAnchorElement) || !picker.contains(a)) return;
    const id = parseBeatmapIdFromPickerLink(a);
    if (id != null) hoveredBeatmapId = id;
    syncDisplay();
  }

  function onPickerMouseLeave() {
    hoveredBeatmapId = null;
    syncDisplay();
  }

  function onHashChange() {
    hoveredBeatmapId = null;
    hoverStarScore = null;
    scheduleSync();
  }

  /**
   * @param {MouseEvent} e
   */
  function onStarHalfEnter(e) {
    const t = e.currentTarget;
    if (!(t instanceof HTMLElement)) return;
    const raw = t.getAttribute("data-oep-score");
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return;
    hoverStarScore = n;
    syncVoteStars();
  }

  /**
   * @param {MouseEvent} e
   */
  function onVoteControlsMouseLeave(e) {
    const rel = e.relatedTarget;
    if (rel instanceof Node && voteControls.contains(rel)) return;
    hoverStarScore = null;
    syncVoteStars();
  }

  async function reloadSetRatings() {
    const list = await omdb().fetchBeatmapsetRatings(beatmapsetId);
    if (disposed || !pathRe.test(location.pathname)) return;
    byBeatmapId = new Map();
    for (const item of list || []) {
      const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
      if (bid != null) byBeatmapId.set(Number(bid), item);
    }
    omdbSetFetchSucceeded = true;
    syncDisplay();
  }

  /**
   * @param {number} score
   */
  async function submitVote(score) {
    if (voteBusy || disposed || !pathRe.test(location.pathname)) return;
    const id = currentDisplayedBeatmapId();
    if (id == null) return;
    hoverStarScore = null;
    voteStatus.textContent = "";
    voteStatus.classList.remove(`${OEP_OMDB_VOTE_CLASS}__status--error`);
    setVoteBusy(true);
    try {
      await omdb().rateBeatmap(id, score);
    } catch (err) {
      voteStatus.textContent = err?.message
        ? String(err.message)
        : "Could not submit rating.";
      voteStatus.classList.add(`${OEP_OMDB_VOTE_CLASS}__status--error`);
      setVoteBusy(false);
      return;
    }
    // The vote went through; a failed refresh is reported as such (B58).
    try {
      await reloadSetRatings();
    } catch (_) {
      if (!disposed) {
        voteStatus.textContent =
          "Rating saved, but OMDB ratings could not be refreshed.";
      }
    } finally {
      setVoteBusy(false);
    }
  }

  for (const unit of starUnits) {
    for (const half of unit.querySelectorAll(`.${OEP_OMDB_VOTE_CLASS}__half`)) {
      half.addEventListener("mouseenter", onStarHalfEnter);
      half.addEventListener("click", (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        if (!(btn instanceof HTMLElement) || voteBusy) return;
        const raw = btn.getAttribute("data-oep-score");
        const n = raw == null ? NaN : Number(raw);
        if (!Number.isFinite(n)) return;
        submitVote(n);
      });
    }
  }

  voteControls.addEventListener("mouseleave", onVoteControlsMouseLeave);
  clearBtn.addEventListener("click", () => submitVote(-2));

  omdb()
    .fetchBeatmapsetRatings(beatmapsetId)
    .then((list) => {
      if (disposed || !pathRe.test(location.pathname)) return;
      byBeatmapId = new Map();
      for (const item of list || []) {
        const bid = item?.BeatmapID ?? item?.beatmapID ?? item?.beatmap_id;
        if (bid != null) byBeatmapId.set(Number(bid), item);
      }
      omdbSetFetchSucceeded = true;
      loadState = "ready";
      bodyEl.classList.remove(`${OEP_OMDB_ROW_CLASS}__body--error`);
      voteRow.style.display = "";
      syncDisplay();
    })
    .catch((err) => {
      if (disposed) return;
      loadState = "error";
      loadError = err?.message
        ? String(err.message)
        : "Could not load OMDB ratings.";
      voteRow.style.display = "none";
      syncDisplay();
    });

  picker.addEventListener("mouseover", onPickerMouseOver);
  picker.addEventListener("mouseleave", onPickerMouseLeave);
  window.addEventListener("hashchange", onHashChange, { passive: true });

  const mo = new MutationObserver(scheduleSync);
  mo.observe(picker, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "href"],
  });

  scheduleSync();

  return () => {
    disposed = true;
    if (raf) window.cancelAnimationFrame(raf);
    mo.disconnect();
    picker.removeEventListener("mouseover", onPickerMouseOver);
    picker.removeEventListener("mouseleave", onPickerMouseLeave);
    window.removeEventListener("hashchange", onHashChange);
    hideOmdbDistPopover();
    window.removeEventListener("scroll", onOmdbDistScrollOrResize, true);
    window.removeEventListener("resize", onOmdbDistScrollOrResize);
    distPopoverEl.remove();
    wrap.remove();
  };
}

/**
 * The OMDB row: ratings and voting with an OMDB API key, otherwise a link to
 * the beatmapset on OMDB.
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function mountOmdbRow(header, beatmapsetId, pathRe) {
  return omdb().isConfigured()
    ? mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe)
    : mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId);
}
