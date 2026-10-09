/**
 * User profile page. Router calls init per visit; cleanup on navigate away.
 * An ES module since WS-40: the BBCode helper lives in
 * src/editor/bbcode-helper/ and the score, Recent, Ranks, media and userpage
 * features in src/features/profile/ (WS-41); they are imported here. The rest
 * is still the legacy IIFE below.
 */

import { startBbcodeHelperManager } from "../editor/bbcode-helper/manager.js";
import { maybeCsrfToken } from "../features/profile/csrf.js";
import { startProfileMediaOpenPictureManager } from "../features/profile/media-buttons.js";
import { teardownSrObserver } from "../features/profile/modded-sr.js";
import { mutationsIncludeSelector } from "../features/profile/mutations.js";
import {
  getCurrentMode,
  getCurrentUserIdFromHeader,
  getProfileUserId,
  parseProfileInitialData,
  resolveProfileTarget,
} from "../features/profile/profile-target.js";
import { startRanksDateHighlightManager } from "../features/profile/ranks-period.js";
import {
  RECENT_FAILS_HEADER_CLASS,
  RECENT_FAILS_WRAP_CLASS,
} from "../features/profile/recent-scores/common.js";
import { startRecentScoresWithFailsObserver } from "../features/profile/recent-scores/mount.js";
import { initScoreFeatures } from "../features/profile/score-features.js";
import {
  PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
  scorePlaceNumberStyle,
} from "../features/profile/score-rows.js";
import { playDetailStyle } from "../features/profile/styles.js";
import { startUserpageExpandManager } from "../features/profile/userpage-expand.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.userProfile = (() => {
  const name = "UserProfile";
  const { el, manageStyle } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;

  const PROFILE_BADGES_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-badges-collapse";
  const PROFILE_BADGES_WRAP_CLASS = "oep-profile-badges-wrap";
  const PROFILE_BADGES_DONE_ATTR = "data-oep-profile-badges-done";
  const PROFILE_BADGES_COLLAPSED_GM_KEY = "userProfile.profileBadgesCollapsed";

  const PROFILE_BADGES_COLLAPSE_CSS = `
    .${PROFILE_BADGES_WRAP_CLASS} {
      position: relative;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed .profile-badges {
      display: none;
    }
    .${PROFILE_BADGES_WRAP_CLASS}--collapsed {
      min-height: 36px;
    }
    .oep-profile-badges-toggle {
      position: absolute;
      z-index: 5;
      top: 8px;
      right: 8px;
    }
  `;
  const badgesCollapseStyle = manageStyle(
    PROFILE_BADGES_COLLAPSE_STYLE_ID,
    PROFILE_BADGES_COLLAPSE_CSS,
  );

  function injectProfileBadgesCollapseStyles() {
    badgesCollapseStyle.inject();
  }

  function removeProfileBadgesCollapseStyles() {
    badgesCollapseStyle.remove();
  }

  /**
   * @param {HTMLElement} badgesRoot  .profile-badges
   */
  function enhanceProfileBadgesStrip(badgesRoot) {
    if (badgesRoot.hasAttribute(PROFILE_BADGES_DONE_ATTR)) return;
    if (!badgesRoot.classList.contains("profile-badges")) return;

    const parent = badgesRoot.parentNode;
    if (!parent) return;

    const shell = el("div", { class: PROFILE_BADGES_WRAP_CLASS });
    parent.insertBefore(shell, badgesRoot);
    shell.appendChild(badgesRoot);

    const collapsedStored = Boolean(
      GM_getValue(PROFILE_BADGES_COLLAPSED_GM_KEY, false),
    );
    if (collapsedStored) {
      shell.classList.add(`${PROFILE_BADGES_WRAP_CLASS}--collapsed`);
    }

    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "btn-circle oep-profile-badges-toggle",
        "aria-expanded": collapsedStored ? "false" : "true",
        title: collapsedStored ? "Show profile badges" : "Hide profile badges",
      },
      el("span", {
        class: collapsedStored ? "fas fa-chevron-down" : "fas fa-chevron-up",
      }),
    );

    shell.appendChild(toggleBtn);
    badgesRoot.setAttribute(PROFILE_BADGES_DONE_ATTR, "1");

    const applyToggleUi = (collapsed) => {
      const icon = toggleBtn.querySelector(".fas");
      if (icon) {
        icon.className = collapsed
          ? "fas fa-chevron-down"
          : "fas fa-chevron-up";
      }
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleBtn.title = collapsed
        ? "Show profile badges"
        : "Hide profile badges";
    };

    toggleBtn.addEventListener("click", () => {
      const collapsed = shell.classList.toggle(
        `${PROFILE_BADGES_WRAP_CLASS}--collapsed`,
      );
      GM_setValue(PROFILE_BADGES_COLLAPSED_GM_KEY, collapsed);
      applyToggleUi(collapsed);
    });
  }

  function teardownProfileBadgesCollapse() {
    document
      .querySelectorAll(`.${PROFILE_BADGES_WRAP_CLASS}`)
      .forEach((shell) => {
        const badges = shell.querySelector(".profile-badges");
        const shellParent = shell.parentNode;
        if (badges && shellParent) {
          badges.removeAttribute(PROFILE_BADGES_DONE_ATTR);
          shellParent.insertBefore(badges, shell);
        }
        shell.remove();
      });
    removeProfileBadgesCollapseStyles();
  }

  /**
   * @returns {function}
   */
  function startProfileBadgesCollapseManager() {
    injectProfileBadgesCollapseStyles();

    const scan = () => {
      document.querySelectorAll(".profile-badges").forEach((node) => {
        if (
          node instanceof HTMLElement &&
          !node.hasAttribute(PROFILE_BADGES_DONE_ATTR)
        ) {
          enhanceProfileBadgesStrip(node);
        }
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (mutationsIncludeSelector(mutations, ".profile-badges")) scan();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      teardownProfileBadgesCollapse();
    };
  }

  const BWS_RANKING_ID = IDS.BWS_RANKING;
  const BWS_STYLE_ID = "osu-expertplus-bws-ranking";
  const BWS_VALUES_ROW_CLASS = "oep-bws-rank-values";
  const BWS_ATTR = "data-oep-bws";
  const BWS_KIRINO_COL_ATTR = "data-oep-bws-rank-col";

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

  /** @type {() => void} */
  let bwsRankingReschedule = () => {};

  const bwsKirino = {
    key: "",
    status: /** @type {"idle"|"loading"|"ready"|"error"} */ ("idle"),
    scoreRank: /** @type {number|null} */ (null),
  };

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

  function bwsStripHtmlToText(htmlOrText) {
    if (htmlOrText == null) return "";
    const s = String(htmlOrText);
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
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

  function bwsKirinoResetIfNeeded() {
    const uid = getProfileUserId();
    if (uid == null) return;
    const mode = getCurrentMode();
    const key = `${uid}:${mode}`;
    if (bwsKirino.key !== key) {
      bwsKirino.key = key;
      bwsKirino.status = "idle";
      bwsKirino.scoreRank = null;
    }
  }

  function bwsKirinoEnsureFetch() {
    const uid = getProfileUserId();
    if (uid == null) return;
    bwsKirinoResetIfNeeded();
    if (bwsKirino.status !== "idle") return;
    bwsKirino.status = "loading";
    const mode = getCurrentMode();
    const modeIdx = OsuExpertPlus.api.kirinoModeIndexForRuleset(mode);
    const uname = parseProfileInitialData()?.user?.username ?? "";
    const fetchKey = bwsKirino.key;
    OsuExpertPlus.api
      .fetchKirinoInspectorProfile(uid, modeIdx, uname)
      .then((json) => {
        bwsKirinoResetIfNeeded();
        if (bwsKirino.key !== fetchKey) return;
        const st = json?.stats;
        const sr = st?.scoreRank != null ? Number(st.scoreRank) : NaN;
        bwsKirino.scoreRank = Number.isFinite(sr) && sr > 0 ? sr : null;
        bwsKirino.status = "ready";
        bwsRankingReschedule();
      })
      .catch(() => {
        bwsKirinoResetIfNeeded();
        if (bwsKirino.key !== fetchKey) return;
        bwsKirino.status = "error";
        bwsKirino.scoreRank = null;
        bwsRankingReschedule();
      });
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

  function bwsKirinoScoreColumnState() {
    bwsKirinoEnsureFetch();
    const href = bwsOfficialScoreRankingsHref(
      bwsKirino.status === "ready" ? bwsKirino.scoreRank : null,
    );
    if (bwsKirino.status === "loading" || bwsKirino.status === "idle") {
      return { display: "…", href };
    }
    if (bwsKirino.status === "error") {
      return { display: "—", href };
    }
    return {
      display: bwsFormatRankSharpOrDash(bwsKirino.scoreRank),
      href,
    };
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

  function bwsSyncKirinoScoreRankColumn(valuesRow) {
    const row = valuesRow.querySelector(`[${BWS_KIRINO_COL_ATTR}="score"]`);
    const state = bwsKirinoScoreColumnState();
    if (!(row instanceof HTMLElement)) return;
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

  function bwsEnsureKirinoScoreRankColumn(valuesRow, bwsRowEl) {
    let scoreRow = valuesRow.querySelector(`[${BWS_KIRINO_COL_ATTR}="score"]`);
    if (!(scoreRow instanceof HTMLElement)) {
      const st = bwsKirinoScoreColumnState();
      scoreRow = bwsBuildKirinoScoreRankColumn(st.display, st.href);
      bwsRowEl.insertAdjacentElement("afterend", scoreRow);
    }
  }

  function bwsBuildTitle(globalRank, count) {
    const exponent = Math.pow(0.9937, count * count);
    const bwsVal = computeBwsRankValue(globalRank, count);
    const expStr = exponent.toFixed(4);
    const resultStr =
      bwsVal != null ? Math.round(bwsVal).toLocaleString() : "?";
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

  function bwsUpdateRankDisplay(inp) {
    const globalRank = parseProfileGlobalRankForBws();
    if (globalRank == null) return;
    const eligible = analyzeBadgesForBws().eligible;
    const rv = inp.closest(`[${BWS_ATTR}="1"]`)?.querySelector(".rank-value");
    if (!(rv instanceof HTMLElement)) return;
    const count = bwsEffectiveBadgeCountFromInput(inp, eligible);
    const bwsVal = computeBwsRankValue(globalRank, count);
    const display = formatProfileRankSharpDisplay(bwsVal);
    const title = bwsBuildTitle(globalRank, count);
    if (rv.textContent !== display) rv.textContent = display;
    if (rv.getAttribute("title") !== title) rv.setAttribute("title", title);
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

  function syncBwsRankingDisplay() {
    if (!settings.isEnabled(BWS_RANKING_ID)) {
      teardownBwsRankingDisplay();
      return;
    }

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
      const bwsVal = computeBwsRankValue(globalRank, eligible);
      const display = formatProfileRankSharpDisplay(bwsVal);
      const title = bwsBuildTitle(globalRank, eligible);
      const rankBlocks = valuesRow.querySelectorAll(
        ":scope > .value-display--rank",
      );
      const countryEl = rankBlocks[1];
      const inp = el("input", {
        type: "number",
        class: "oep-bws-badge-adjust-input",
        step: "1",
        min: "0",
        value: String(eligible),
      });
      wireBwsAdjustInput(inp);
      bwsRow = el(
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
          el("div", { class: "rank-value rank-value--base", title }, display),
          el(
            "div",
            { class: "oep-bws-controls" },
            el("label", { class: "oep-bws-adjust-row" }, "Badges ", inp),
          ),
        ),
      );
      if (countryEl) {
        countryEl.insertAdjacentElement("afterend", bwsRow);
      } else {
        valuesRow.appendChild(bwsRow);
      }
    } else {
      const inp = bwsRow.querySelector(".oep-bws-badge-adjust-input");
      const effectiveBadges = bwsEffectiveBadgeCountFromInput(inp, eligible);
      const bwsVal = computeBwsRankValue(globalRank, effectiveBadges);
      const display = formatProfileRankSharpDisplay(bwsVal);
      const title = bwsBuildTitle(globalRank, effectiveBadges);
      const rv = bwsRow.querySelector(".rank-value");
      if (rv instanceof HTMLElement) {
        if (rv.textContent !== display) rv.textContent = display;
        if (rv.getAttribute("title") !== title) rv.setAttribute("title", title);
      }
      const valHost = bwsRow.querySelector(".value-display__value");
      if (valHost instanceof HTMLElement) {
        valHost.classList.add("oep-bws-value-stack");
      }
      if (inp instanceof HTMLInputElement) {
        inp.removeAttribute("title");
        wireBwsAdjustInput(inp);
      }
    }
    bwsEnsureKirinoScoreRankColumn(valuesRow, bwsRow);
    bwsSyncKirinoScoreRankColumn(valuesRow);
  }

  function startBwsRankingManager() {
    let debounceTimer = 0;
    const schedule = () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (settings.isEnabled(BWS_RANKING_ID)) {
          bwsRankingStyle.inject();
          syncBwsRankingDisplay();
        } else {
          teardownBwsRankingDisplay();
          bwsRankingStyle.remove();
        }
      }, 50);
    };

    bwsRankingReschedule = schedule;
    schedule();

    const obs = new MutationObserver(() => {
      schedule();
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const unsub = settings.onChange(BWS_RANKING_ID, (enabled) => {
      if (enabled) {
        bwsRankingStyle.inject();
        syncBwsRankingDisplay();
      } else {
        teardownBwsRankingDisplay();
        bwsRankingStyle.remove();
      }
    });

    return () => {
      bwsRankingReschedule = () => {};
      bwsKirino.key = "";
      bwsKirino.status = "idle";
      bwsKirino.scoreRank = null;
      clearTimeout(debounceTimer);
      obs.disconnect();
      try {
        unsub();
      } catch (_) {}
      teardownBwsRankingDisplay();
      bwsRankingStyle.remove();
    };
  }

  const CONTENTS_REORDER_STYLE_ID = "osu-expertplus-profile-contents-reorder";
  const CONTENTS_REORDER_ANCHOR_ATTR = "data-oep-contents-reorder-anchor";
  const CONTENTS_REORDER_DRAGGING_CLASS = "oep-contents-reorder--dragging";
  const CONTENTS_REORDER_DROP_BEFORE_CLASS =
    "oep-contents-reorder--drop-before";
  const CONTENTS_REORDER_DROP_AFTER_CLASS = "oep-contents-reorder--drop-after";
  const CONTENTS_REORDER_GHOST_CLASS = "oep-contents-reorder--ghost";
  const CONTENTS_REORDER_DRAG_THRESHOLD_PX = 12;

  const CONTENTS_REORDER_CSS = `
    a[${CONTENTS_REORDER_ANCHOR_ATTR}] {
      cursor: grab;
      user-select: none;
      display: inline-flex;
      align-items: center;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DRAGGING_CLASS} {
      opacity: 0 !important;
      cursor: grabbing;
      pointer-events: none;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_BEFORE_CLASS} {
      box-shadow: -3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 0 5px 5px 0;
    }
    a[${CONTENTS_REORDER_ANCHOR_ATTR}].${CONTENTS_REORDER_DROP_AFTER_CLASS} {
      box-shadow: 3px 0 0 0 hsl(var(--hsl-c1));
      border-radius: 5px 0 0 5px;
    }
    .${CONTENTS_REORDER_GHOST_CLASS} {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      background-color: rgba(255, 255, 255, 0.14);
      color: hsl(var(--hsl-l1));
      white-space: nowrap;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
      user-select: none;
      transform: translate(10px, -50%);
      font-size: 0.875em;
      opacity: 0.95;
    }
  `;

  const contentsReorderStyle = manageStyle(
    CONTENTS_REORDER_STYLE_ID,
    CONTENTS_REORDER_CSS,
  );

  function injectContentsReorderStyles() {
    contentsReorderStyle.inject();
  }

  function removeContentsReorderStyles() {
    contentsReorderStyle.remove();
  }

  function getSectionPageNodes() {
    return Array.from(
      document.querySelectorAll("div.js-sortable--page[data-page-id]"),
    ).filter((n) => n instanceof HTMLElement);
  }

  function sectionIdFromHashHref(href) {
    if (!href || href[0] !== "#") return "";
    const hash = href.slice(1).trim();
    return /^[a-z0-9_]+$/i.test(hash) ? hash : "";
  }

  function getSortableContentsAnchorGroups() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];

    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (allCandidates.length < 3) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });

    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length >= 3,
    );
  }

  /** All hash-tab rows (incl. 1–2 tabs); {@link getSortableContentsAnchorGroups} needs ≥3 for DnD. */
  function getProfileContentsAnchorRows() {
    const pages = getSectionPageNodes();
    if (!pages.length) return [];
    const validIds = new Set(
      pages
        .map((p) => p.getAttribute("data-page-id"))
        .filter((v) => typeof v === "string" && v.length > 0),
    );
    if (!validIds.size) return [];

    const allCandidates = Array.from(
      document.querySelectorAll('a[href^="#"]'),
    ).filter(
      (a) =>
        a instanceof HTMLAnchorElement &&
        validIds.has(sectionIdFromHashHref(a.getAttribute("href") || "")),
    );
    if (!allCandidates.length) return [];

    const containerMap = new Map();
    allCandidates.forEach((a) => {
      const parent = a.parentElement;
      if (!parent) return;
      const cur = containerMap.get(parent) || [];
      cur.push(a);
      containerMap.set(parent, cur);
    });
    return Array.from(containerMap.values()).filter(
      (anchors) => anchors.length > 0,
    );
  }

  async function persistProfileSectionOrder(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const payload = new URLSearchParams();
    sectionIds.forEach((id) =>
      payload.append("user_profile_customization[extras_order][]", id),
    );

    const headers = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    const csrf = maybeCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;

    const resp = await fetch("/home/account/options", {
      method: "PUT",
      credentials: "include",
      headers,
      body: payload.toString(),
    });
    if (!resp.ok) throw new Error(`save failed (${resp.status})`);
  }

  function reorderSectionPagesByIds(sectionIds) {
    if (!Array.isArray(sectionIds) || sectionIds.length < 2) return;
    const pages = getSectionPageNodes();
    if (!pages.length) return;
    const byId = new Map();
    pages.forEach((p) => {
      byId.set(p.getAttribute("data-page-id"), p);
    });
    const parent = pages[0]?.parentElement;
    if (!parent) return;

    sectionIds.forEach((id) => {
      const node = byId.get(id);
      if (node) parent.appendChild(node);
    });
  }

  const PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSubsectionsCollapsed";
  /** Same as section collapse `SECTION_COLLAPSE_SUBTITLE_SELECTOR` (defined below). */
  const PROFILE_PAGE_SUBTITLE_H3_SELECTOR = "h3.title.title--page-extra-small";
  /** osu `ProfileExtraPage` ids (`data-page-id`) where we skip h3 subsection UI (single block, no sub-titles). */
  const PROFILE_SUBSECTION_SKIP_PAGE_IDS = new Set(["medals"]);
  const SUBSECTION_COLLAPSE_STYLE_ID =
    "osu-expertplus-profile-subsection-collapse";
  const SUBSECTION_BODY_HIDDEN_CLASS =
    "oep-profile-subsection-body--collapsed-hidden";
  const SUBSECTION_TITLE_CLASS = "oep-profile-subsection-title";
  const SUBSECTION_TITLE_COLLAPSED_CLASS =
    "oep-profile-subsection-title--collapsed";
  const SUBSECTION_TITLE_MAIN_CLASS = "oep-profile-subsection-title__main";
  const SUBSECTION_TITLE_LABEL_CLASS = "oep-profile-subsection-title__label";
  const SUBSECTION_DONE_ATTR = "data-oep-subsection-collapse";
  const SUBSECTION_BODY_FOR_ATTR = "data-oep-subsection-for";
  const SUBSECTION_TOGGLE_ATTR = "data-oep-profile-subsection-collapse-toggle";
  const SUBSECTION_TOGGLE_FOR_ATTR = "data-oep-profile-subsection-for";
  const SUBSECTION_LABEL_ATTR = "data-oep-subsection-label";
  /** Collapsed dim: title label and `.title__count` pill. */
  const SUBSECTION_COLLAPSED_DIM_OPACITY = "0.64";

  const SUBSECTION_COLLAPSE_CSS = `
    .${SUBSECTION_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small {
      position: relative;
      display: flex;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35em;
      cursor: pointer;
      line-height: normal;
      padding: 10px 0;
      margin: 0;
      isolation: isolate;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::before {
      z-index: 0;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS}.title.title--page-extra-small::before {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small::after {
      content: "";
      position: absolute;
      top: 0;
      right: -8px;
      bottom: 0;
      left: -1.8rem;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h3.${SUBSECTION_TITLE_CLASS}.title.title--page-extra-small > * {
      position: relative;
      z-index: 2;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0 10px;
      min-width: 0;
      flex: 1 1 auto;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      transition: opacity 120ms ease;
      line-height: inherit;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_LABEL_CLASS} {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    h3.${SUBSECTION_TITLE_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-sizing: border-box;
      margin: 0;
      padding: 0 10px;
      height: 1.85em;
      min-width: 1.85em;
      font-size: 0.8em;
      font-variant-numeric: tabular-nums;
      transition: opacity 120ms ease;
    }
    h3.${SUBSECTION_TITLE_CLASS}.${SUBSECTION_TITLE_COLLAPSED_CLASS} .${SUBSECTION_TITLE_MAIN_CLASS} .title__count {
      opacity: ${SUBSECTION_COLLAPSED_DIM_OPACITY};
    }
    button.oep-profile-subsection-collapse-toggle {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    button.oep-profile-subsection-collapse-toggle:focus-visible {
      clip-path: none;
      width: auto;
      height: auto;
      margin: 0;
      padding: 2px 6px;
      overflow: visible;
      outline: 1px solid hsl(var(--hsl-l2));
      outline-offset: 1px;
      background: rgba(255, 255, 255, 0.08);
      color: hsl(var(--hsl-l1));
      font-size: 0.75rem;
      z-index: 1;
    }
  `;

  const subsectionCollapseStyle = manageStyle(
    SUBSECTION_COLLAPSE_STYLE_ID,
    SUBSECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSubsectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSubsectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SUBSECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  /**
   * Legacy subsection key, only used to migrate old collapse state. It must
   * reproduce keys written by older versions exactly, so keep the regex as is
   * (the doubled `'` was never `’`; B74).
   * @param {string} text
   * @param {Set<string>} usedSlugs
   * @returns {string}
   */
  function subsectionSlugFromTitle(text, usedSlugs) {
    let base = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    if (!base) base = "subsection";
    let slug = base;
    let n = 0;
    while (usedSlugs.has(slug)) {
      n += 1;
      slug = `${base}_${n}`;
    }
    usedSlugs.add(slug);
    return slug;
  }

  const SUBSECTION_SHOW_MORE_NAMED_MODIFIERS = new Set([
    "pinned",
    "best",
    "firsts",
    "recent",
  ]);
  const SUBSECTION_SHOW_MORE_SKIP_MODIFIERS = new Set(["loading"]);

  /**
   * osu-web PlayDetailList sets ShowMoreLink modifiers to pinned / best / firsts / recent
   * (language-independent BEM classes). Other pages use generic modifiers; those fall back to
   * index-based keys in the caller.
   * @param {HTMLElement} h3
   * @returns {string|null}
   */
  function subsectionNamedModifierFromFollowingContent(h3) {
    let n = h3.nextElementSibling;
    while (n instanceof HTMLElement) {
      if (n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
      const roots = n.matches(".show-more-link")
        ? [n]
        : Array.from(n.querySelectorAll(".show-more-link"));
      for (const sm of roots) {
        for (const c of sm.classList) {
          if (!c.startsWith("show-more-link--")) continue;
          const mod = c.slice("show-more-link--".length);
          if (SUBSECTION_SHOW_MORE_SKIP_MODIFIERS.has(mod)) continue;
          if (SUBSECTION_SHOW_MORE_NAMED_MODIFIERS.has(mod)) return mod;
        }
      }
      n = n.nextElementSibling;
    }
    return null;
  }

  /**
   * @param {Set<string>} collapsedSet
   * @param {string} legacyKey
   * @param {string} stableKey
   * @returns {boolean} true if collapsedSet was mutated
   */
  function migrateSubsectionCollapseLegacyKey(
    collapsedSet,
    legacyKey,
    stableKey,
  ) {
    if (!legacyKey || !stableKey || legacyKey === stableKey) return false;
    if (!collapsedSet.has(legacyKey)) return false;
    collapsedSet.add(stableKey);
    collapsedSet.delete(legacyKey);
    return true;
  }

  /**
   * @param {HTMLElement} h3
   * @returns {HTMLElement[]}
   */
  function collectSubsectionBodyElements(h3) {
    const recentHeader = h3.closest(`.${RECENT_FAILS_HEADER_CLASS}`);
    if (recentHeader instanceof HTMLElement && recentHeader.contains(h3)) {
      const bodies = [];
      let n = h3.nextElementSibling;
      while (n instanceof HTMLElement) {
        bodies.push(n);
        n = n.nextElementSibling;
      }
      let p = recentHeader.nextElementSibling;
      while (p instanceof HTMLElement) {
        if (p.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)) break;
        bodies.push(p);
        p = p.nextElementSibling;
      }
      return bodies;
    }

    const bodies = [];
    let n = h3.nextElementSibling;
    while (
      n instanceof HTMLElement &&
      !n.matches(PROFILE_PAGE_SUBTITLE_H3_SELECTOR)
    ) {
      bodies.push(n);
      n = n.nextElementSibling;
    }
    return bodies;
  }

  /**
   * Wraps title text (and segments between counts) so collapsed opacity applies only to the name,
   * not the count pill. Keeps `.title__count` in an inline-flex row for vertical alignment.
   * @param {HTMLElement} h3
   * @param {HTMLElement} btn
   */
  function wrapSubsectionTitleContent(h3, btn) {
    if (h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`)) return;
    if (!btn.nextSibling) return;
    const main = el("span", { class: SUBSECTION_TITLE_MAIN_CLASS });
    let n = btn.nextSibling;
    let label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
    while (n) {
      const next = n.nextSibling;
      if (n instanceof HTMLElement && n.classList.contains("title__count")) {
        if (label.childNodes.length) main.appendChild(label);
        main.appendChild(n);
        label = el("span", { class: SUBSECTION_TITLE_LABEL_CLASS });
      } else {
        label.appendChild(n);
      }
      n = next;
    }
    if (label.childNodes.length) main.appendChild(label);
    if (!main.childNodes.length) return;
    btn.insertAdjacentElement("afterend", main);
  }

  /**
   * @param {HTMLElement} h3
   */
  function unwrapSubsectionTitleMain(h3) {
    const main = h3.querySelector(`:scope > .${SUBSECTION_TITLE_MAIN_CLASS}`);
    if (!(main instanceof HTMLElement)) return;
    while (main.firstChild) {
      h3.insertBefore(main.firstChild, main);
    }
    main.remove();
  }

  /** @param {string} key */
  function toggleProfileSubsectionCollapsedKey(key) {
    if (!key) return;
    const set = readProfileSubsectionsCollapsedSet();
    if (set.has(key)) set.delete(key);
    else set.add(key);
    writeProfileSubsectionsCollapsedSet(set);
    applyProfileSubsectionCollapseState(set);
  }

  /** @param {Set<string>} collapsed */
  function applyProfileSubsectionCollapseState(collapsed) {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const key = el.getAttribute(SUBSECTION_BODY_FOR_ATTR);
      if (!key) return;
      if (collapsed.has(key)) el.classList.add(SUBSECTION_BODY_HIDDEN_CLASS);
      else el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document
      .querySelectorAll(`button[${SUBSECTION_TOGGLE_ATTR}]`)
      .forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = btn.getAttribute(SUBSECTION_TOGGLE_FOR_ATTR);
        if (!key) return;
        const isCollapsed = collapsed.has(key);
        btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
        const label = btn.getAttribute(SUBSECTION_LABEL_ATTR) || key;
        btn.title = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;
        btn.setAttribute(
          "aria-label",
          isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        );
        const h3El = btn.closest("h3");
        if (h3El) {
          h3El.classList.toggle(SUBSECTION_TITLE_COLLAPSED_CLASS, isCollapsed);
        }
      });
  }

  function teardownProfileSubsectionCollapse() {
    document.querySelectorAll(`[${SUBSECTION_BODY_FOR_ATTR}]`).forEach((el) => {
      el.removeAttribute(SUBSECTION_BODY_FOR_ATTR);
      el.classList.remove(SUBSECTION_BODY_HIDDEN_CLASS);
    });
    document.querySelectorAll(`h3[${SUBSECTION_DONE_ATTR}]`).forEach((h3) => {
      if (!(h3 instanceof HTMLElement)) return;
      const wrap =
        /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */ (
          h3
        );
      wrap._oepSubsectionAc?.abort();
      delete wrap._oepSubsectionAc;
      unwrapSubsectionTitleMain(h3);
      h3.querySelector(`button[${SUBSECTION_TOGGLE_ATTR}]`)?.remove();
      h3.removeAttribute(SUBSECTION_DONE_ATTR);
      h3.classList.remove(
        SUBSECTION_TITLE_CLASS,
        SUBSECTION_TITLE_COLLAPSED_CLASS,
      );
    });
  }

  /**
   * @param {HTMLElement} pageEl  div.js-sortable--page
   * @param {Set<string>} collapsedSet  live set; legacy slug keys are migrated into stable keys
   * @returns {boolean} true if collapsedSet was mutated (caller should persist)
   */
  function enhanceSortablePageSubsections(pageEl, collapsedSet) {
    const pageId = pageEl.getAttribute("data-page-id");
    if (!pageId) return false;
    if (PROFILE_SUBSECTION_SKIP_PAGE_IDS.has(pageId)) return false;
    const usedSlugs = new Set();
    let subsectionIndex = 0;
    let migrationDirty = false;
    const h3s = pageEl.querySelectorAll(PROFILE_PAGE_SUBTITLE_H3_SELECTOR);
    for (const h3 of h3s) {
      if (!(h3 instanceof HTMLElement)) continue;
      if (h3.closest(".js-sortable--page") !== pageEl) continue;
      if (h3.hasAttribute(SUBSECTION_DONE_ATTR)) continue;

      const label = String(h3.textContent || "").trim() || pageId;
      const legacyKey = `${pageId}::${subsectionSlugFromTitle(label, usedSlugs)}`;
      const namedMod = subsectionNamedModifierFromFollowingContent(h3);
      const stableKey = namedMod
        ? `${pageId}::${namedMod}`
        : `${pageId}::sub_${subsectionIndex}`;
      subsectionIndex += 1;

      if (
        migrateSubsectionCollapseLegacyKey(collapsedSet, legacyKey, stableKey)
      ) {
        migrationDirty = true;
      }

      const isCollapsed = collapsedSet.has(stableKey);

      const bodies = collectSubsectionBodyElements(h3);
      bodies.forEach((b) =>
        b.setAttribute(SUBSECTION_BODY_FOR_ATTR, stableKey),
      );

      const btn = el("button", {
        type: "button",
        class: "oep-profile-subsection-collapse-toggle",
        [SUBSECTION_TOGGLE_ATTR]: "1",
        [SUBSECTION_TOGGLE_FOR_ATTR]: stableKey,
        [SUBSECTION_LABEL_ATTR]: label,
        "aria-expanded": isCollapsed ? "false" : "true",
        title: isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
        "aria-label": isCollapsed ? `Expand ${label}` : `Collapse ${label}`,
      });
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleProfileSubsectionCollapsedKey(stableKey);
      });

      const subsectionAc = new AbortController();
      /** @type {HTMLElement & { _oepSubsectionAc?: AbortController }} */
      (h3)._oepSubsectionAc = subsectionAc;
      h3.addEventListener(
        "click",
        (ev) => {
          const t = ev.target;
          if (!(t instanceof Element)) return;
          if (t.closest(`button[${SUBSECTION_TOGGLE_ATTR}]`)) return;
          if (t.closest("a[href]")) return;
          toggleProfileSubsectionCollapsedKey(stableKey);
        },
        { signal: subsectionAc.signal },
      );

      h3.insertBefore(btn, h3.firstChild);
      wrapSubsectionTitleContent(h3, btn);
      h3.classList.add(SUBSECTION_TITLE_CLASS);
      if (isCollapsed) h3.classList.add(SUBSECTION_TITLE_COLLAPSED_CLASS);
      h3.setAttribute(SUBSECTION_DONE_ATTR, "1");
    }
    return migrationDirty;
  }

  function scanProfileSubsections() {
    teardownProfileSubsectionCollapse();
    const collapsedSet = readProfileSubsectionsCollapsedSet();
    let migrationDirty = false;
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement) {
        if (enhanceSortablePageSubsections(page, collapsedSet)) {
          migrationDirty = true;
        }
      }
    });
    if (migrationDirty) {
      writeProfileSubsectionsCollapsedSet(collapsedSet);
    }
    applyProfileSubsectionCollapseState(collapsedSet);
  }

  /** @returns {function} */
  function startProfileSubsectionCollapseManager() {
    subsectionCollapseStyle.inject();

    let debounceTimer = 0;
    const schedule = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        scanProfileSubsections();
      }, 80);
    };

    scanProfileSubsections();

    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `div.js-sortable--page[data-page-id], ${PROFILE_PAGE_SUBTITLE_H3_SELECTOR}, .${RECENT_FAILS_WRAP_CLASS}`,
        )
      ) {
        schedule();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(debounceTimer);
      obs.disconnect();
      teardownProfileSubsectionCollapse();
      subsectionCollapseStyle.remove();
    };
  }

  const PROFILE_SECTIONS_COLLAPSED_GM_KEY =
    "userProfile.profileSectionsCollapsed";
  const SECTION_COLLAPSE_PAGE_CLASS = "oep-profile-section--collapsed";
  const SECTION_COLLAPSE_BODY_HIDDEN_CLASS =
    "oep-profile-section-body--collapsed-hidden";
  const SECTION_COLLAPSE_MAIN_TITLE_SELECTOR = "h2.title.title--page-extra";
  const SECTION_COLLAPSE_SUBTITLE_SELECTOR = "h3.title.title--page-extra-small";
  const SECTION_TAB_COLLAPSED_CLASS = "oep-profile-section-tab--collapsed";
  const SECTION_PAGE_TITLE_CLICK_ATTR =
    "data-oep-profile-section-page-title-click";
  const SECTION_TAB_CHEVRON_ATTR = "data-oep-section-tab-chevron";
  const SECTION_CONTENTS_ROW_CLASS = "oep-profile-contents-row";
  const SECTION_PAGE_TITLE_TOGGLE_CLASS =
    "oep-profile-section-page-title--toggle";
  const SECTION_PAGE_TITLE_LABEL_CLASS =
    "oep-profile-section-page-title__label";
  const SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS =
    "oep-profile-section-page-title__collapsed-suffix";
  const SECTION_COLLAPSE_STYLE_ID = "osu-expertplus-profile-section-collapse";
  const SECTION_COLLAPSE_HARD_MODE_CLASS = "oep-profile-section-collapse--hard";

  const SECTION_COLLAPSE_CSS = `
    .${SECTION_COLLAPSE_BODY_HIDDEN_CLASS} {
      display: none !important;
    }
    html.${SECTION_COLLAPSE_HARD_MODE_CLASS}
      div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      > div.u-relative
      > *:not(h2.title.title--page-extra):not(h3.title.title--page-extra-small) {
      display: none !important;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra {
      cursor: pointer;
      user-select: none;
      position: relative;
      isolation: isolate;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra > .${SECTION_PAGE_TITLE_LABEL_CLASS} {
      position: relative;
      z-index: 2;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::after {
      content: "";
      position: absolute;
      top: -0.25em;
      right: -0.55em;
      bottom: -0.25em;
      left: -1.5em;
      border-radius: 6px;
      background-color: transparent;
      transition: background-color 120ms ease;
      pointer-events: none;
      z-index: 1;
    }
    div.js-sortable--page
      h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra:hover::after {
      background-color: rgba(255, 255, 255, 0.07);
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra
      > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS} {
      position: relative;
      z-index: 2;
      font-weight: 600;
      font-size: 0.88em;
      opacity: 0.9;
    }
    h2.${SECTION_PAGE_TITLE_TOGGLE_CLASS}.title.title--page-extra::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translate(calc(-100% - 0.7em), -50%);
      font-size: 0.65em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      pointer-events: none;
      transition: opacity 120ms ease;
      z-index: 2;
    }
    div.js-sortable--page.${SECTION_COLLAPSE_PAGE_CLASS}
      h2.title.title--page-extra.${SECTION_PAGE_TITLE_TOGGLE_CLASS}::before {
      content: "\\f078";
      opacity: 0.8;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS} .page-mode-link,
    a.${SECTION_TAB_COLLAPSED_CLASS} .fake-bold {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    a.${SECTION_TAB_COLLAPSED_CLASS}:not(:has(.page-mode-link)):not(:has(.fake-bold)) {
      color: hsl(var(--hsl-l2)) !important;
      opacity: 0.78;
    }
    .page-mode.page-mode--profile-page-extra {
      gap: 0 !important;
      column-gap: 0 !important;
      row-gap: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"] {
      margin-right: 0.85em !important;
      padding: 0.22em 0.5em;
      border-radius: 5px;
      box-sizing: border-box;
      transition: background-color 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:hover {
      background-color: rgba(255, 255, 255, 0.07);
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[href^="#"]:last-child {
      margin-right: 0 !important;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]::before {
      -moz-osx-font-smoothing: grayscale;
      -webkit-font-smoothing: antialiased;
      display: inline-block;
      font-style: normal;
      font-variant: normal;
      text-rendering: auto;
      font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
      font-weight: 900;
      content: "\\f077";
      font-size: 0.82em;
      line-height: 1;
      color: hsl(var(--hsl-c1));
      opacity: 0.9;
      margin-right: 0.25em;
      flex-shrink: 0;
      transition: color 120ms ease, opacity 120ms ease;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]::before {
      content: "\\f078";
      opacity: 0.8;
    }
    .${SECTION_CONTENTS_ROW_CLASS} > a[${SECTION_TAB_CHEVRON_ATTR}="collapsed"]:hover::before {
      opacity: 1;
      color: hsl(var(--hsl-l1));
    }
  `;

  const sectionCollapseStyle = manageStyle(
    SECTION_COLLAPSE_STYLE_ID,
    SECTION_COLLAPSE_CSS,
  );

  /** @returns {Set<string>} */
  function readProfileSectionsCollapsedSet() {
    try {
      const raw = GM_getValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, "");
      if (raw == null || raw === "") return new Set();
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((x) => typeof x === "string" && x));
      }
      if (parsed && typeof parsed === "object") {
        return new Set(Object.keys(parsed).filter((k) => parsed[k] === true));
      }
    } catch (_) {}
    return new Set();
  }

  /** @param {Set<string>} set */
  function writeProfileSectionsCollapsedSet(set) {
    const obj = /** @type {Record<string, true>} */ ({});
    set.forEach((id) => {
      if (id) obj[id] = true;
    });
    if (!Object.keys(obj).length) {
      GM_deleteValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY);
      return;
    }
    GM_setValue(PROFILE_SECTIONS_COLLAPSED_GM_KEY, JSON.stringify(obj));
  }

  function clearProfileSectionCollapseBodyHidden(page) {
    page
      .querySelectorAll(`.${SECTION_COLLAPSE_BODY_HIDDEN_CLASS}`)
      .forEach((el) => el.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS));
    page.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
  }

  /**
   * Direct children of a sortable section that should stay visible when collapsed
   * (main h2 row with optional drag handle, or inline sub-headings).
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  function profileSectionCollapseKeepsChildVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR)) return true;
    if (el.matches(SECTION_COLLAPSE_SUBTITLE_SELECTOR)) return true;
    if (
      el.matches("div.u-relative") &&
      el.querySelector(`:scope > ${SECTION_COLLAPSE_MAIN_TITLE_SELECTOR}`)
    ) {
      return true;
    }
    return false;
  }

  /**
   * "(collapsed)" is a real node so `h2::after` stays the hover overlay (same as expanded).
   * @param {HTMLElement} pageEl
   * @param {boolean} isCollapsed
   */
  function syncProfileSectionPageTitleCollapsedSuffix(pageEl, isCollapsed) {
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (!h2.classList.contains(SECTION_PAGE_TITLE_TOGGLE_CLASS)) return;
    const existing = h2.querySelector(
      `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
    );
    if (isCollapsed) {
      if (!existing) {
        h2.appendChild(
          el(
            "span",
            { class: SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS },
            " (collapsed)",
          ),
        );
      } else {
        existing.textContent = " (collapsed)";
      }
    } else {
      existing?.remove();
    }
  }

  /**
   * Hide non-heading children so in-page section titles stay visible.
   * Follows single-child wrappers briefly (some layouts nest one div).
   * @param {HTMLElement} pageEl
   * @param {number} depth
   * @returns {boolean} true when headings were found and body nodes hidden
   */
  function markProfileSectionBodyCollapsed(pageEl, depth) {
    if (depth > 4) return false;
    const kids = [...pageEl.children].filter((n) => n instanceof HTMLElement);
    if (!kids.length) return false;
    const hasKept = kids.some(profileSectionCollapseKeepsChildVisible);
    if (hasKept) {
      kids.forEach((k) => {
        if (profileSectionCollapseKeepsChildVisible(k)) {
          k.classList.remove(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        } else {
          k.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
        }
      });
      return true;
    }
    if (kids.length === 1) {
      return markProfileSectionBodyCollapsed(kids[0], depth + 1);
    }
    return false;
  }

  function applyProfileSectionCollapseToPages(collapsed) {
    const removeEntireSection = settings.isEnabled(
      PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
    );
    document.documentElement.classList.toggle(
      SECTION_COLLAPSE_HARD_MODE_CLASS,
      removeEntireSection,
    );
    getSectionPageNodes().forEach((node) => {
      const id = node.getAttribute("data-page-id");
      if (!id) return;
      clearProfileSectionCollapseBodyHidden(node);
      node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);

      if (!collapsed.has(id)) {
        syncProfileSectionPageTitleCollapsedSuffix(node, false);
        return;
      }

      node.classList.add(SECTION_COLLAPSE_PAGE_CLASS);
      if (removeEntireSection) {
        node.classList.add(SECTION_COLLAPSE_BODY_HIDDEN_CLASS);
      } else {
        markProfileSectionBodyCollapsed(node, 0);
      }
      syncProfileSectionPageTitleCollapsedSuffix(node, true);
    });
    applyProfileSubsectionCollapseState(readProfileSubsectionsCollapsedSet());
  }

  function applyProfileSectionCollapseToTabAnchors(collapsed) {
    getProfileContentsAnchorRows()
      .flat()
      .forEach((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const sectionId = sectionIdFromHashHref(
          anchor.getAttribute("href") || "",
        );
        if (!sectionId) return;
        const isCollapsed = collapsed.has(sectionId);
        if (isCollapsed) anchor.classList.add(SECTION_TAB_COLLAPSED_CLASS);
        else anchor.classList.remove(SECTION_TAB_COLLAPSED_CLASS);

        anchor.setAttribute(
          SECTION_TAB_CHEVRON_ATTR,
          isCollapsed ? "collapsed" : "expanded",
        );
        const parent = anchor.parentElement;
        if (parent) parent.classList.add(SECTION_CONTENTS_ROW_CLASS);
      });
  }

  function teardownProfileSectionPageTitleClick() {
    document
      .querySelectorAll(`h2[${SECTION_PAGE_TITLE_CLICK_ATTR}]`)
      .forEach((h2) => {
        if (!(h2 instanceof HTMLElement)) return;
        const wrap =
          /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */ (
            h2
          );
        wrap._oepSectionPageTitleAc?.abort();
        delete wrap._oepSectionPageTitleAc;
        h2.querySelectorAll(
          `:scope > .${SECTION_PAGE_TITLE_COLLAPSED_SUFFIX_CLASS}`,
        ).forEach((n) => n.remove());
        const label = h2.querySelector(
          `:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`,
        );
        if (label instanceof HTMLElement) {
          while (label.firstChild) h2.insertBefore(label.firstChild, label);
          label.remove();
        }
        h2.removeAttribute(SECTION_PAGE_TITLE_CLICK_ATTR);
        h2.classList.remove(SECTION_PAGE_TITLE_TOGGLE_CLASS);
      });
  }

  function teardownProfileContentsTabChevrons() {
    document
      .querySelectorAll(`a[${SECTION_TAB_CHEVRON_ATTR}]`)
      .forEach((a) => a.removeAttribute(SECTION_TAB_CHEVRON_ATTR));
    document
      .querySelectorAll(`.${SECTION_CONTENTS_ROW_CLASS}`)
      .forEach((n) => n.classList.remove(SECTION_CONTENTS_ROW_CLASS));
  }

  /**
   * Delegated click handler: if the click lands on the ::before chevron area of
   * a contents-row tab anchor, toggle section collapse instead of navigating.
   * @param {MouseEvent} ev
   */
  function onContentsTabChevronClick(ev) {
    const a = /** @type {Element|null} */ (ev.target);
    if (!(a instanceof HTMLAnchorElement)) return;
    if (!a.hasAttribute(SECTION_TAB_CHEVRON_ATTR)) return;
    const rect = a.getBoundingClientRect();
    const style = window.getComputedStyle(a, "::before");
    const beforeWidth = parseFloat(style.width) || 0;
    const paddingLeft = parseFloat(window.getComputedStyle(a).paddingLeft) || 0;
    const chevronRight = rect.left + paddingLeft + beforeWidth + 4;
    if (ev.clientX > chevronRight) return;
    ev.preventDefault();
    ev.stopPropagation();
    const sectionId = sectionIdFromHashHref(a.getAttribute("href") || "");
    if (sectionId) toggleProfileSectionCollapsedId(sectionId);
  }

  /**
   * Toggle section collapse from the in-page `h2` or from the contents-row chevron (tab label still navigates).
   * @param {string} sectionId  data-page-id
   */
  function toggleProfileSectionCollapsedId(sectionId) {
    if (!sectionId) return;
    const set = readProfileSectionsCollapsedSet();
    if (set.has(sectionId)) set.delete(sectionId);
    else set.add(sectionId);
    writeProfileSectionsCollapsedSet(set);
    applyProfileSectionCollapseToPages(set);
    applyProfileSectionCollapseToTabAnchors(set);
  }

  /** @param {HTMLElement} pageEl  div.js-sortable--page[data-page-id] */
  function bindProfileSectionPageTitleClickOnPage(pageEl) {
    const sectionId = pageEl.getAttribute("data-page-id");
    if (!sectionId) return;
    const h2 = pageEl.querySelector(SECTION_COLLAPSE_MAIN_TITLE_SELECTOR);
    if (!(h2 instanceof HTMLElement)) return;
    if (h2.hasAttribute(SECTION_PAGE_TITLE_CLICK_ATTR)) return;

    h2.classList.add(SECTION_PAGE_TITLE_TOGGLE_CLASS);
    h2.setAttribute(SECTION_PAGE_TITLE_CLICK_ATTR, sectionId);

    if (!h2.querySelector(`:scope > .${SECTION_PAGE_TITLE_LABEL_CLASS}`)) {
      const label = el("span", { class: SECTION_PAGE_TITLE_LABEL_CLASS });
      while (h2.firstChild) label.appendChild(h2.firstChild);
      h2.appendChild(label);
    }

    const ac = new AbortController();
    /** @type {HTMLElement & { _oepSectionPageTitleAc?: AbortController }} */
    (h2)._oepSectionPageTitleAc = ac;
    h2.addEventListener(
      "click",
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        if (t.closest("a[href]")) return;
        if (t.closest("button")) return;
        if (t.closest("input, select, textarea, label")) return;
        toggleProfileSectionCollapsedId(sectionId);
      },
      { signal: ac.signal },
    );
  }

  function bindProfileSectionPageTitleClicks() {
    getSectionPageNodes().forEach((page) => {
      if (page instanceof HTMLElement)
        bindProfileSectionPageTitleClickOnPage(page);
    });
  }

  /** @returns {function} */
  function startProfileSectionCollapseManager() {
    sectionCollapseStyle.inject();

    let rebindTimer = 0;
    let obs = null;
    const unsubRemoveMode = settings.onChange(
      PROFILE_SECTION_COLLAPSE_REMOVE_FROM_PAGE_ID,
      () => {
        const collapsed = readProfileSectionsCollapsedSet();
        applyProfileSectionCollapseToPages(collapsed);
      },
    );

    const bind = () => {
      clearTimeout(rebindTimer);
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();

      const collapsed = readProfileSectionsCollapsedSet();
      applyProfileSectionCollapseToPages(collapsed);
      applyProfileSectionCollapseToTabAnchors(collapsed);

      bindProfileSectionPageTitleClicks();

      getSectionPageNodes().forEach((node) => {
        const id = node.getAttribute("data-page-id");
        if (!id) return;
        syncProfileSectionPageTitleCollapsedSuffix(node, collapsed.has(id));
      });
    };

    bind();
    document.addEventListener("click", onContentsTabChevronClick, true);
    obs = new MutationObserver((mutations) => {
      const needsRebind = mutationsIncludeSelector(
        mutations,
        'div.js-sortable--page[data-page-id], a[href^="#"], h2.title.title--page-extra',
      );

      if (needsRebind) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      unsubRemoveMode();
      clearTimeout(rebindTimer);
      obs?.disconnect();
      document.removeEventListener("click", onContentsTabChevronClick, true);
      teardownProfileSectionPageTitleClick();
      teardownProfileContentsTabChevrons();
      getSectionPageNodes().forEach((node) => {
        node.classList.remove(SECTION_COLLAPSE_PAGE_CLASS);
        clearProfileSectionCollapseBodyHidden(node);
      });
      document
        .querySelectorAll(`a.${SECTION_TAB_COLLAPSED_CLASS}`)
        .forEach((a) => a.classList.remove(SECTION_TAB_COLLAPSED_CLASS));
      document.documentElement.classList.remove(
        SECTION_COLLAPSE_HARD_MODE_CLASS,
      );
      sectionCollapseStyle.remove();
    };
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLAnchorElement} source
   * @returns {HTMLAnchorElement|null}
   */
  function contentsReorderTargetFromPoint(clientX, clientY, source) {
    const row = source.parentElement;
    if (!row) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const n of stack) {
      if (!(n instanceof Element)) continue;
      const a = n.closest(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`);
      if (
        a instanceof HTMLAnchorElement &&
        a !== source &&
        a.parentElement === row
      )
        return a;
    }
    return null;
  }

  /** @returns {function} */
  function startContentsReorderManager() {
    injectContentsReorderStyles();

    let dragAnchor = null;
    let ghostEl = /** @type {HTMLElement|null} */ (null);
    let obs = null;
    let rebindTimer = 0;
    /** Section IDs in current visual order; null means DOM order is authoritative. */
    let currentTabOrder = /** @type {string[]|null} */ (null);
    /**
     * @type {{
     *   anchor: HTMLAnchorElement;
     *   pointerId: number;
     *   startX: number;
     *   startY: number;
     *   armed: boolean;
     *   onMove: (e: PointerEvent) => void;
     *   onUp: (e: PointerEvent) => void;
     * } | null}
     */
    let pointerSession = null;

    /**
     * Returns anchors in their current visual order.
     * Uses `currentTabOrder` when set, otherwise falls back to DOM order.
     * @param {HTMLElement} row
     * @returns {HTMLAnchorElement[]}
     */
    function getOrderedAnchors(row) {
      const anchors = /** @type {HTMLAnchorElement[]} */ (
        Array.from(
          row.querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`),
        ).filter((a) => a instanceof HTMLAnchorElement)
      );
      if (!currentTabOrder) return anchors;
      const byId = new Map(
        anchors.map((a) => [
          sectionIdFromHashHref(a.getAttribute("href") || ""),
          a,
        ]),
      );
      const ordered = /** @type {HTMLAnchorElement[]} */ (
        currentTabOrder.map((id) => byId.get(id)).filter(Boolean)
      );
      const inOrder = new Set(currentTabOrder);
      anchors.forEach((a) => {
        const id = sectionIdFromHashHref(a.getAttribute("href") || "");
        if (id && !inOrder.has(id)) ordered.push(a);
      });
      return ordered;
    }

    /**
     * Applies CSS flexbox `order` to visually reorder tabs without touching React-managed DOM nodes.
     * Each chevron button gets an even order value; its anchor gets odd (chevron always visually first).
     * @param {HTMLAnchorElement[]} anchors ordered array representing desired visual sequence
     * @param {HTMLElement} row
     */
    function applyTabCssOrder(anchors) {
      anchors.forEach((a, i) => {
        a.style.order = String(i);
      });
    }

    const removeGhost = () => {
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
    };

    const clearDragClasses = () => {
      if (ghostEl) removeGhost();
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DRAGGING_CLASS,
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    };

    const saveOrderFrom = async (anchors) => {
      const ids = anchors
        .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
        .filter(Boolean);
      reorderSectionPagesByIds(ids);
      try {
        await persistProfileSectionOrder(ids);
      } catch {
        /* order stays reordered in DOM only */
      }
    };

    function clearRowDropIndicators(row) {
      row
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((n) =>
          n.classList.remove(
            CONTENTS_REORDER_DROP_BEFORE_CLASS,
            CONTENTS_REORDER_DROP_AFTER_CLASS,
          ),
        );
    }

    function endPointerSession() {
      const s = pointerSession;
      pointerSession = null;
      if (!s) return;
      removeGhost();
      s.anchor.removeEventListener("pointermove", s.onMove);
      s.anchor.removeEventListener("pointerup", s.onUp);
      s.anchor.removeEventListener("pointercancel", s.onUp);
      try {
        s.anchor.releasePointerCapture(s.pointerId);
      } catch (_) {}
    }

    const onPointerDown = (ev) => {
      const anchor = ev.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (ev.button !== 0) return;
      if (pointerSession) return;

      const startX = ev.clientX;
      const startY = ev.clientY;

      const onMove = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.armed) {
          if (Math.hypot(dx, dy) < CONTENTS_REORDER_DRAG_THRESHOLD_PX) return;
          s.armed = true;
          dragAnchor = s.anchor;
          s.anchor.classList.add(CONTENTS_REORDER_DRAGGING_CLASS);
          ghostEl = document.createElement("div");
          ghostEl.className = CONTENTS_REORDER_GHOST_CLASS;
          ghostEl.textContent = s.anchor.textContent || "";
          document.body.appendChild(ghostEl);
        }
        if (ghostEl) {
          ghostEl.style.left = `${e.clientX}px`;
          ghostEl.style.top = `${e.clientY}px`;
        }
        const row = s.anchor.parentElement;
        if (!(row instanceof HTMLElement)) return;
        const hit = contentsReorderTargetFromPoint(
          e.clientX,
          e.clientY,
          s.anchor,
        );
        clearRowDropIndicators(row);
        if (hit) {
          const hitRect = hit.getBoundingClientRect();
          const insertAfter = e.clientX > hitRect.left + hitRect.width / 2;
          hit.classList.add(
            insertAfter
              ? CONTENTS_REORDER_DROP_AFTER_CLASS
              : CONTENTS_REORDER_DROP_BEFORE_CLASS,
          );
        }
      };

      const onUp = (e) => {
        if (!pointerSession || e.pointerId !== pointerSession.pointerId) return;
        const s = pointerSession;
        endPointerSession();

        if (s.armed && dragAnchor) {
          const hit = contentsReorderTargetFromPoint(
            e.clientX,
            e.clientY,
            s.anchor,
          );
          const row = s.anchor.parentElement;
          if (
            hit &&
            dragAnchor &&
            hit !== dragAnchor &&
            row &&
            hit.parentElement === row
          ) {
            hit.classList.remove(
              CONTENTS_REORDER_DROP_BEFORE_CLASS,
              CONTENTS_REORDER_DROP_AFTER_CLASS,
            );
            const targetRect = hit.getBoundingClientRect();
            const insertAfter =
              e.clientX > targetRect.left + targetRect.width / 2;

            const currentAnchors = getOrderedAnchors(row);
            const newAnchors = currentAnchors.filter((a) => a !== dragAnchor);
            const hitIdx = newAnchors.indexOf(hit);
            newAnchors.splice(insertAfter ? hitIdx + 1 : hitIdx, 0, dragAnchor);

            currentTabOrder = newAnchors
              .map((a) => sectionIdFromHashHref(a.getAttribute("href") || ""))
              .filter(Boolean);
            applyTabCssOrder(newAnchors);
            void saveOrderFrom(newAnchors);
          }
          const suppressClick = (ce) => {
            ce.preventDefault();
            ce.stopPropagation();
            s.anchor.removeEventListener("click", suppressClick, true);
          };
          s.anchor.addEventListener("click", suppressClick, true);
        }

        removeGhost();
        dragAnchor = null;
        clearDragClasses();
      };

      pointerSession = {
        anchor,
        pointerId: ev.pointerId,
        startX,
        startY,
        armed: false,
        onMove,
        onUp,
      };

      try {
        anchor.setPointerCapture(ev.pointerId);
      } catch (_) {}

      anchor.addEventListener("pointermove", onMove);
      anchor.addEventListener("pointerup", onUp);
      anchor.addEventListener("pointercancel", onUp);
    };

    const bind = () => {
      clearTimeout(rebindTimer);
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      const groups = getSortableContentsAnchorGroups();

      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
        });

      groups.flat().forEach((a) => {
        a.setAttribute(CONTENTS_REORDER_ANCHOR_ATTR, "1");
        a.removeAttribute("draggable");
        a.setAttribute("title", `Drag to reorder`);
        a.addEventListener("pointerdown", onPointerDown);
      });

      if (currentTabOrder) {
        groups.forEach((anchors) => {
          const row = anchors[0]?.parentElement;
          if (!(row instanceof HTMLElement)) return;
          applyTabCssOrder(getOrderedAnchors(row));
        });
      }
    };

    bind();
    obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          'div.js-sortable--page[data-page-id], a[href^="#"]',
        )
      ) {
        clearTimeout(rebindTimer);
        rebindTimer = setTimeout(bind, 80);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      clearTimeout(rebindTimer);
      obs?.disconnect();
      if (pointerSession) {
        endPointerSession();
        dragAnchor = null;
        clearDragClasses();
      }
      document
        .querySelectorAll(`a[${CONTENTS_REORDER_ANCHOR_ATTR}]`)
        .forEach((a) => {
          a.removeEventListener("pointerdown", onPointerDown);
          a.removeAttribute(CONTENTS_REORDER_ANCHOR_ATTR);
          a.removeAttribute("draggable");
          a.style.removeProperty("order");
          a.classList.remove(CONTENTS_REORDER_DRAGGING_CLASS);
        });
      removeContentsReorderStyles();
    };
  }

  /**
   * @param {RegExpMatchArray} _match
   * @returns {function}
   */
  function init(_match) {
    const cleanups = [];

    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(
        settings,
        manageStyle,
      ),
    );
    cleanups.push(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );

    cleanups.push(
      OsuExpertPlus.beatmapCardExtra.start(settings, {
        hookProfileExtraPages: true,
      }),
    );

    cleanups.push(startRanksDateHighlightManager());
    cleanups.push(startBwsRankingManager());
    cleanups.push(startProfileBadgesCollapseManager());
    cleanups.push(startProfileSectionCollapseManager());
    cleanups.push(startProfileSubsectionCollapseManager());
    cleanups.push(startBbcodeHelperManager());
    cleanups.push(startProfileMediaOpenPictureManager());
    cleanups.push(startUserpageExpandManager());
    const profileUserId = getProfileUserId();
    const currentUserId = getCurrentUserIdFromHeader();
    if (
      profileUserId != null &&
      currentUserId != null &&
      String(profileUserId) === String(currentUserId)
    ) {
      cleanups.push(startContentsReorderManager());
    }

    // B07: this run owns the shared score styles and every cleanup registered by
    // the async score features, so a stale run can never undo the next page's
    // setup. The cleanup below runs synchronously before the next init.
    let disposed = false;
    let recentFailsCleanup = null;
    const scoreRun = { isDisposed: () => disposed, cleanupFns: [] };
    playDetailStyle.inject();

    // The router fires on pushState, before the new profile is rendered: wait for
    // the page's own data so scores are never fetched for the previous ruleset.
    resolveProfileTarget()
      .then((target) => {
        if (disposed || !target) return;
        const { userId, mode } = target;
        recentFailsCleanup = startRecentScoresWithFailsObserver(userId, mode);
        return initScoreFeatures(userId, mode, scoreRun);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      if (typeof recentFailsCleanup === "function") {
        recentFailsCleanup();
        recentFailsCleanup = null;
      }
      scoreRun.cleanupFns.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
      // Also started later by the SR toggle or the Recent list (B38).
      teardownSrObserver();
      scorePlaceNumberStyle.remove();
      playDetailStyle.remove();
    };
  }

  return { name, init };
})();
