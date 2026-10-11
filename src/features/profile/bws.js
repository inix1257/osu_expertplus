/**
 * BWS rank (badge-weighted seeding) and the Kirino score rank column in the
 * profile header (WS-42).
 */

import {
  fetchInspectorProfile,
  modeIndexForRuleset,
} from "../../api/kirino.js";
import { observe } from "../../core/observe.js";
import { el, manageStyle } from "../legacy.js";
import {
  getCurrentMode,
  getProfileUserId,
  parseProfileInitialData,
} from "./profile-target.js";
const BWS_STYLE_ID = "osu-expertplus-bws-ranking";
const BWS_VALUES_ROW_CLASS = "oep-bws-rank-values";
const BWS_ATTR = "data-oep-bws";
const BWS_KIRINO_COL_ATTR = "data-oep-bws-rank-col";
/**
 * The Kirino score rank column. Off since api.kirino.sh stopped resolving
 * (B77): no request is made and the column is not shown. The code stays so a
 * new endpoint only needs `src/api/kirino.js` and this switch.
 */
const KIRINO_SCORE_RANK_COLUMN = false;

const BWS_BADGE_EXCLUSION_PHRASES = [
  "mapping",
  "beatmap",
  "longstanding",
  "pooling",
  "contribution",
  "mapper",
  "community choice",
  "pending cup",
  "newspaper cup",
];

const BWS_RANKING_CSS = `
  .profile-detail-stats__chart-numbers--top .profile-detail-stats__values.${BWS_VALUES_ROW_CLASS},
  .profile-detail__chart-numbers--top .profile-detail__values.${BWS_VALUES_ROW_CLASS} {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    column-gap: 1.25rem;
    row-gap: 0.35rem;
  }
  .oep-bws-value-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
    min-width: 0;
    text-align: right;
  }
  .oep-bws-controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
    font-size: 12px;
    line-height: 1.35;
    color: hsl(var(--hsl-l2, 0 0% 75%));
  }
  .oep-bws-adjust-row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
  }
  .oep-bws-badge-adjust-input {
    width: 4.25rem;
    padding: 0.15em 0.35em;
    font-size: inherit;
    font-variant-numeric: tabular-nums;
    border-radius: 4px;
    border: 1px solid hsl(var(--hsl-l3, 0 0% 40%));
    background: hsl(var(--hsl-b5, 0 0% 12%));
    color: inherit;
    box-sizing: border-box;
  }
  a.oep-bws-kirino-rank-link {
    text-decoration: none;
    color: inherit;
  }
  a.oep-bws-kirino-rank-link:hover {
    text-decoration: underline;
  }
`;
const bwsRankingStyle = manageStyle(BWS_STYLE_ID, BWS_RANKING_CSS);

/**
 * Text of a badge's HTML title. Parsed in a separate document, so nothing in
 * it loads or runs.
 * @param {unknown} htmlOrText
 */
function bwsStripHtmlToText(htmlOrText) {
  if (htmlOrText == null) return "";
  const doc = new DOMParser().parseFromString(String(htmlOrText), "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function bwsBadgeDescriptionText(badgeEl) {
  if (!(badgeEl instanceof HTMLElement)) return "";
  const parts = [];
  const t1 = badgeEl.getAttribute("title");
  if (t1) parts.push(t1);
  const ht = badgeEl.getAttribute("data-html-title");
  if (ht) parts.push(bwsStripHtmlToText(ht));
  const ot = badgeEl.getAttribute("data-orig-title");
  if (ot) parts.push(ot);
  return parts.join(" ").trim();
}

function bwsBadgeExcludedByKeywords(descriptionPlain) {
  const d = String(descriptionPlain).toLowerCase();
  if (!d) return false;
  return BWS_BADGE_EXCLUSION_PHRASES.some((p) => d.includes(p));
}

function analyzeBadgesForBws() {
  const nodes = document.querySelectorAll(
    ".profile-badges .profile-badges__badge",
  );
  let total = 0;
  let eligible = 0;
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    total += 1;
    const desc = bwsBadgeDescriptionText(node);
    if (bwsBadgeExcludedByKeywords(desc)) continue;
    eligible += 1;
  }
  return {
    total,
    eligible,
    excluded: Math.max(0, total - eligible),
  };
}

/** osu-web renamed `profile-detail__*` to `profile-detail-stats__*`; accept both. */
const PROFILE_HEADER_RANK_VALUES_SELECTOR = [
  ".profile-detail-stats__chart-numbers--top .profile-detail-stats__values",
  ".profile-detail__chart-numbers--top .profile-detail__values",
].join(", ");

function findProfileHeaderRankValuesRow() {
  return document.querySelector(PROFILE_HEADER_RANK_VALUES_SELECTOR);
}

function parseProfileGlobalRankForBws() {
  const data = parseProfileInitialData();
  const mode = getCurrentMode();
  const fromRulesets = data?.user?.statistics_rulesets?.[mode]?.global_rank;
  if (fromRulesets != null) {
    const n = Number(fromRulesets);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const fromStats = data?.user?.statistics?.global_rank;
  if (fromStats != null) {
    const n = Number(fromStats);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function computeBwsRankValue(globalRank, badgeCount) {
  const r = Number(globalRank);
  const b = Math.max(0, Math.floor(Number(badgeCount)) || 0);
  if (!Number.isFinite(r) || r <= 0) return null;
  const exponent = Math.pow(0.9937, b * b);
  return Math.pow(r, exponent);
}

function formatProfileRankSharpDisplay(n) {
  const rounded = Math.round(Number(n));
  if (!Number.isFinite(rounded)) return "—";
  const locale =
    typeof window.currentLocale === "string"
      ? window.currentLocale
      : document.documentElement.lang || undefined;
  try {
    return `#${rounded.toLocaleString(locale)}`;
  } catch {
    return `#${rounded}`;
  }
}

function teardownBwsRankingDisplay() {
  document.querySelectorAll(`[${BWS_ATTR}="1"]`).forEach((n) => n.remove());
  document
    .querySelectorAll(`[${BWS_KIRINO_COL_ATTR}]`)
    .forEach((n) => n.remove());
  document
    .querySelectorAll(`.${BWS_VALUES_ROW_CLASS}`)
    .forEach((el) => el.classList.remove(BWS_VALUES_ROW_CLASS));
}

/**
 * Kirino's score rank for the profile on screen, fetched once per user and
 * ruleset. `onChange` runs when a result arrives; nothing runs after `dispose`.
 * @param {() => void} onChange
 */
function createKirinoScoreRank(onChange) {
  const ac = new AbortController();
  let key = "";
  /** @type {"idle"|"loading"|"ready"|"error"} */
  let status = "idle";
  /** @type {number|null} */
  let scoreRank = null;

  function resetIfNeeded() {
    const uid = getProfileUserId();
    if (uid == null) return;
    const next = `${uid}:${getCurrentMode()}`;
    if (key !== next) {
      key = next;
      status = "idle";
      scoreRank = null;
    }
  }

  function ensureFetch() {
    const uid = getProfileUserId();
    if (uid == null || ac.signal.aborted) return;
    resetIfNeeded();
    if (status !== "idle") return;
    status = "loading";
    const modeIdx = modeIndexForRuleset(getCurrentMode());
    const uname = parseProfileInitialData()?.user?.username ?? "";
    const fetchKey = key;
    const settle = (nextStatus, rank) => {
      if (ac.signal.aborted) return;
      resetIfNeeded();
      if (key !== fetchKey) return;
      status = nextStatus;
      scoreRank = rank;
      onChange();
    };
    fetchInspectorProfile(uid, modeIdx, uname, { signal: ac.signal })
      .then((json) => {
        const sr = Number(json?.stats?.scoreRank ?? NaN);
        settle("ready", Number.isFinite(sr) && sr > 0 ? sr : null);
      })
      .catch(() => settle("error", null));
  }

  return {
    /** @returns {{ display: string, href: string }} */
    columnState() {
      ensureFetch();
      const href = bwsOfficialScoreRankingsHref(
        status === "ready" ? scoreRank : null,
      );
      if (status === "loading" || status === "idle") {
        return { display: "…", href };
      }
      if (status === "error") return { display: "—", href };
      return { display: bwsFormatRankSharpOrDash(scoreRank), href };
    },
    dispose() {
      ac.abort();
    },
  };
}

function bwsFormatRankSharpOrDash(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  return formatProfileRankSharpDisplay(x);
}

function bwsOfficialScoreRankingsHref(scoreRank) {
  const mode = getCurrentMode() || "osu";
  const u = new URL(
    `https://osu.ppy.sh/rankings/${encodeURIComponent(mode)}/score`,
  );
  if (mode === "mania") {
    const m = location.search.match(/[?&]variant=(4k|7k)/i);
    if (m) u.searchParams.set("variant", m[1].toLowerCase());
  }
  const r = scoreRank != null ? Number(scoreRank) : NaN;
  if (Number.isFinite(r) && r > 0) {
    u.searchParams.set("page", String(Math.max(1, Math.ceil(r / 50))));
  }
  return u.href;
}

function bwsBuildKirinoScoreRankColumn(display, href) {
  return el(
    "div",
    {
      class: "value-display value-display--rank",
      [BWS_KIRINO_COL_ATTR]: "score",
    },
    el(
      "div",
      { class: "value-display__label u-ellipsis-overflow" },
      "Score Ranking",
    ),
    el(
      "div",
      { class: "value-display__value u-ellipsis-overflow" },
      el(
        "a",
        {
          class: "rank-value rank-value--base oep-bws-kirino-rank-link",
          href,
        },
        display,
      ),
    ),
  );
}

/**
 * @param {HTMLElement} valuesRow
 * @param {HTMLElement} bwsRowEl
 * @param {{ display: string, href: string }} state
 */
function bwsSyncKirinoScoreRankColumn(valuesRow, bwsRowEl, state) {
  const row = valuesRow.querySelector(`[${BWS_KIRINO_COL_ATTR}="score"]`);
  if (!(row instanceof HTMLElement)) {
    bwsRowEl.insertAdjacentElement(
      "afterend",
      bwsBuildKirinoScoreRankColumn(state.display, state.href),
    );
    return;
  }
  const valHost = row.querySelector(".value-display__value");
  let link = row.querySelector("a.oep-bws-kirino-rank-link");
  if (!(link instanceof HTMLAnchorElement)) {
    row.querySelector(".rank-value")?.remove();
    if (!(valHost instanceof HTMLElement)) return;
    link = document.createElement("a");
    link.className = "rank-value rank-value--base oep-bws-kirino-rank-link";
    valHost.appendChild(link);
  }
  if (link.href !== state.href) link.href = state.href;
  if (link.textContent !== state.display) link.textContent = state.display;
  link.removeAttribute("title");
}

function bwsBuildTitle(globalRank, count) {
  const exponent = Math.pow(0.9937, count * count);
  const bwsVal = computeBwsRankValue(globalRank, count);
  const expStr = exponent.toFixed(4);
  const resultStr = bwsVal != null ? Math.round(bwsVal).toLocaleString() : "?";
  return (
    `rank ^ (0.9937 ^ (badges²))` +
    ` = ${globalRank.toLocaleString()} ^ (0.9937 ^ ${count}²)` +
    ` = ${globalRank.toLocaleString()} ^ ${expStr}` +
    ` = ${resultStr}`
  );
}

function bwsEffectiveBadgeCountFromInput(inp, eligible) {
  if (!(inp instanceof HTMLInputElement)) return eligible;
  const raw = inp.value.trim();
  if (raw === "") return eligible;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : eligible;
}

/**
 * Write the BWS rank for `count` badges into `rv` (only what changed).
 * @param {Element|null} rv  `.rank-value` of the BWS block
 * @param {number} globalRank
 * @param {number} count
 */
function setBwsRankValue(rv, globalRank, count) {
  if (!(rv instanceof HTMLElement)) return;
  const display = formatProfileRankSharpDisplay(
    computeBwsRankValue(globalRank, count),
  );
  const title = bwsBuildTitle(globalRank, count);
  if (rv.textContent !== display) rv.textContent = display;
  if (rv.getAttribute("title") !== title) rv.setAttribute("title", title);
}

function bwsUpdateRankDisplay(inp) {
  const globalRank = parseProfileGlobalRankForBws();
  if (globalRank == null) return;
  const eligible = analyzeBadgesForBws().eligible;
  setBwsRankValue(
    inp.closest(`[${BWS_ATTR}="1"]`)?.querySelector(".rank-value") ?? null,
    globalRank,
    bwsEffectiveBadgeCountFromInput(inp, eligible),
  );
}

function wireBwsAdjustInput(inp) {
  if (!(inp instanceof HTMLInputElement)) return;
  if (inp.dataset.oepBwsWired === "1") return;
  inp.dataset.oepBwsWired = "1";
  inp.addEventListener("input", () => {
    bwsUpdateRankDisplay(inp);
  });
  inp.addEventListener("blur", () => {
    const eligible = analyzeBadgesForBws().eligible;
    const raw = inp.value.trim();
    const n = Math.trunc(Number(raw));
    if (raw === "" || !Number.isFinite(n) || n < 0) {
      inp.value = String(eligible);
    }
    bwsUpdateRankDisplay(inp);
  });
}

/** @param {number} eligible */
function buildBwsRow(eligible) {
  const inp = el("input", {
    type: "number",
    class: "oep-bws-badge-adjust-input",
    step: "1",
    min: "0",
    value: String(eligible),
  });
  wireBwsAdjustInput(inp);
  return el(
    "div",
    {
      class: "value-display value-display--rank",
      [BWS_ATTR]: "1",
    },
    el(
      "div",
      { class: "value-display__label u-ellipsis-overflow" },
      "BWS Ranking",
    ),
    el(
      "div",
      { class: "value-display__value oep-bws-value-stack" },
      el("div", { class: "rank-value rank-value--base" }),
      el(
        "div",
        { class: "oep-bws-controls" },
        el("label", { class: "oep-bws-adjust-row" }, "Badges ", inp),
      ),
    ),
  );
}

/**
 * Add or update the BWS block (after the country rank) in the header.
 * @param {ReturnType<typeof createKirinoScoreRank>} kirino
 */
function syncBwsRankingDisplay(kirino) {
  const valuesRow = findProfileHeaderRankValuesRow();
  if (!(valuesRow instanceof HTMLElement)) {
    teardownBwsRankingDisplay();
    return;
  }

  const globalRank = parseProfileGlobalRankForBws();
  if (globalRank == null) {
    valuesRow.querySelector(`[${BWS_ATTR}="1"]`)?.remove();
    valuesRow
      .querySelectorAll(`[${BWS_KIRINO_COL_ATTR}]`)
      .forEach((n) => n.remove());
    valuesRow.classList.remove(BWS_VALUES_ROW_CLASS);
    return;
  }

  valuesRow.classList.add(BWS_VALUES_ROW_CLASS);

  const eligible = analyzeBadgesForBws().eligible;

  let bwsRow = valuesRow.querySelector(`[${BWS_ATTR}="1"]`);
  if (!(bwsRow instanceof HTMLElement)) {
    bwsRow = buildBwsRow(eligible);
    const countryEl = valuesRow.querySelectorAll(
      ":scope > .value-display--rank",
    )[1];
    if (countryEl) {
      countryEl.insertAdjacentElement("afterend", bwsRow);
    } else {
      valuesRow.appendChild(bwsRow);
    }
  }
  const inp = bwsRow.querySelector(".oep-bws-badge-adjust-input");
  setBwsRankValue(
    bwsRow.querySelector(".rank-value"),
    globalRank,
    bwsEffectiveBadgeCountFromInput(inp, eligible),
  );
  bwsRow
    .querySelector(".value-display__value")
    ?.classList.add("oep-bws-value-stack");
  if (inp instanceof HTMLInputElement) {
    inp.removeAttribute("title");
    wireBwsAdjustInput(inp);
  }
  if (KIRINO_SCORE_RANK_COLUMN) {
    bwsSyncKirinoScoreRankColumn(valuesRow, bwsRow, kirino.columnState());
  }
}

/**
 * What can change the BWS block: the header rank row (osu-web re-renders it,
 * dropping our block), the badges, and our own blocks being removed.
 */
const BWS_WATCH_SELECTOR = [
  PROFILE_HEADER_RANK_VALUES_SELECTOR,
  ".profile-detail-stats__values > .value-display",
  ".profile-detail__values > .value-display",
  ".profile-badges",
  `[${BWS_ATTR}]`,
  `[${BWS_KIRINO_COL_ATTR}]`,
].join(", ");

/**
 * The BWS rank in the profile header while the setting is on (mounted by the
 * profile composer with `mountSettingFeature`).
 * @returns {() => void}
 */
export function mountBwsRanking() {
  bwsRankingStyle.inject();
  const ac = new AbortController();
  let debounceTimer = 0;
  const schedule = () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (!ac.signal.aborted) syncBwsRankingDisplay(kirino);
    }, 50);
  };
  const kirino = createKirinoScoreRank(schedule);

  observe.subscribe(
    {
      selector: BWS_WATCH_SELECTOR,
      schedule: "sync", // debounced above
      signal: ac.signal,
      label: "profile/bws",
    },
    schedule,
  );
  schedule();

  return () => {
    ac.abort();
    kirino.dispose();
    clearTimeout(debounceTimer);
    teardownBwsRankingDisplay();
    bwsRankingStyle.remove();
  };
}
