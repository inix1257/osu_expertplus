/** OTR rating card and hover details for user profile rank statistics. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.otrRating = (() => {
  const { el, manageStyle } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const otr = OsuExpertPlus.otr;
  const FEATURE_ID = settings.IDS.OTR_RATING;
  const STYLE_ID = "osu-expertplus-otr-rating";
  const RANK_ROW_CLASS = "oep-otr-rank-row";
  const ATTR = "data-oep-otr-rating";

  const CSS = `
    .profile-detail-stats__chart-numbers--top
      .profile-detail-stats__values.${RANK_ROW_CLASS},
    .profile-detail__chart-numbers--top
      .profile-detail__values.${RANK_ROW_CLASS} {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
      column-gap: 1.25rem;
      row-gap: 0.35rem;
      overflow: visible;
    }
    .oep-otr-summary {
      position: relative;
      z-index: 5;
      overflow: visible;
      outline: none;
      cursor: help;
    }
    .oep-otr-summary:hover,
    .oep-otr-summary:focus-within {
      z-index: 30;
    }
    .oep-otr-summary:focus-visible {
      border-radius: 4px;
      outline: 2px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 3px;
    }
    .oep-otr-hover-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      z-index: 40;
      min-width: 220px;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      border-radius: 7px;
      background: hsl(var(--hsl-b3, 333 18% 14%));
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translate(-50%, 4px);
      transition:
        opacity 120ms ease,
        transform 120ms ease,
        visibility 120ms ease;
      white-space: nowrap;
    }
    .oep-otr-hover-panel::before {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 50%;
      width: 8px;
      height: 8px;
      border-top: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      border-left: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      background: hsl(var(--hsl-b3, 333 18% 14%));
      transform: translate(-50%, 5px) rotate(45deg);
    }
    .oep-otr-summary:hover .oep-otr-hover-panel,
    .oep-otr-summary:focus-within .oep-otr-hover-panel {
      opacity: 1;
      visibility: visible;
      transform: translate(-50%, 0);
    }
    .oep-otr-hover-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      font-size: 11px;
      line-height: 1.65;
    }
    .oep-otr-hover-row--section {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    }
    .oep-otr-hover-label {
      color: hsl(var(--hsl-l2, 0 0% 72%));
    }
    .oep-otr-hover-value {
      color: hsl(var(--hsl-l1, 0 0% 92%));
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  `;

  function currentLocale() {
    return typeof window.currentLocale === "string"
      ? window.currentLocale
      : document.documentElement.lang || undefined;
  }

  function ratingLabel() {
    return "OTR Rating";
  }

  function formatWholeNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    const rounded = Math.round(number);
    try {
      return rounded.toLocaleString(currentLocale());
    } catch {
      return String(rounded);
    }
  }

  function formatRank(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0
      ? `#${formatWholeNumber(number)}`
      : "—";
  }

  function formatPercentage(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    const percent = number >= 0 && number <= 1 ? number * 100 : number;
    return `${percent.toFixed(1)}%`;
  }

  function formatWinLoss(wins, losses) {
    const won = Number(wins);
    const lost = Number(losses);
    if (!Number.isFinite(won) || !Number.isFinite(lost)) return "—";
    return `${formatWholeNumber(won)} / ${formatWholeNumber(lost)}`;
  }

  function formatTier(tierProgress) {
    const tier = String(tierProgress?.currentTier || "").trim();
    if (!tier) return "—";
    const subTier = Number(tierProgress?.currentSubTier);
    const roman = ["", "I", "II", "III"][subTier] || "";
    return `${tier}${roman ? ` ${roman}` : ""}`;
  }

  function findRankRow() {
    return (
      document.querySelector(
        ".profile-detail-stats__chart-numbers--top .profile-detail-stats__values",
      ) ||
      document.querySelector(
        ".profile-detail__chart-numbers--top .profile-detail__values",
      )
    );
  }

  function emptyDetails(value) {
    return {
      globalRank: value,
      countryRank: value,
      tier: value,
      matches: value,
      matchRecord: value,
      matchWinRate: value,
      bestWinStreak: value,
      games: value,
      gameRecord: value,
      gameWinRate: value,
    };
  }

  function displayState(state) {
    if (state.status === "ready") {
      const ratingData = state.data?.rating;
      const matchStats = state.data?.matchStats;
      const rating = Number(ratingData?.rating);
      return {
        display: formatWholeNumber(rating),
        description: Number.isFinite(rating)
          ? `${ratingLabel()}: ${rating.toFixed(2)}`
          : ratingLabel(),
        globalRank: formatRank(ratingData?.globalRank),
        countryRank: formatRank(ratingData?.countryRank),
        tier: formatTier(ratingData?.tierProgress),
        matches: formatWholeNumber(
          ratingData?.matchesPlayed ?? matchStats?.matchesPlayed,
        ),
        matchRecord: formatWinLoss(
          matchStats?.matchesWon,
          matchStats?.matchesLost,
        ),
        matchWinRate: formatPercentage(matchStats?.matchWinRate),
        bestWinStreak: formatWholeNumber(matchStats?.bestWinStreak),
        games: formatWholeNumber(matchStats?.gamesPlayed),
        gameRecord: formatWinLoss(
          matchStats?.gamesWon,
          matchStats?.gamesLost,
        ),
        gameWinRate: formatPercentage(matchStats?.gameWinRate),
      };
    }

    if (state.status === "missing") {
      return {
        display: "Unranked",
        description: "No OTR rating is available for this player.",
        ...emptyDetails("—"),
      };
    }

    if (state.status === "error") {
      return {
        display: "—",
        description:
          state.error.replace("[osu! Expert+] ", "") ||
          "OTR rating request failed.",
        ...emptyDetails("—"),
      };
    }

    return {
      display: "…",
      description: "Loading OTR rating…",
      ...emptyDetails("…"),
    };
  }

  function buildHoverRow(label, valueClass, value, sectionStart = false) {
    return el(
      "div",
      {
        class: `oep-otr-hover-row${
          sectionStart ? " oep-otr-hover-row--section" : ""
        }`,
      },
      el("span", { class: "oep-otr-hover-label" }, label),
      el(
        "span",
        { class: `oep-otr-hover-value ${valueClass}` },
        value,
      ),
    );
  }

  function buildRatingCard(state) {
    return el(
      "div",
      {
        class: "value-display value-display--rank oep-otr-summary",
        [ATTR]: "1",
        tabindex: "0",
      },
      el(
        "div",
        {
          class:
            "value-display__label u-ellipsis-overflow oep-otr-rating-label",
        },
        ratingLabel(),
      ),
      el(
        "div",
        { class: "value-display__value u-ellipsis-overflow" },
        el(
          "div",
          { class: "rank-value rank-value--base oep-otr-rating-value" },
          state.display,
        ),
      ),
      el(
        "div",
        { class: "oep-otr-hover-panel", "aria-hidden": "true" },
        buildHoverRow(
          "Global Rank",
          "oep-otr-global-rank-value",
          state.globalRank,
        ),
        buildHoverRow(
          "Country Rank",
          "oep-otr-country-rank-value",
          state.countryRank,
        ),
        buildHoverRow("Tier", "oep-otr-tier-value", state.tier),
        buildHoverRow(
          "Matches",
          "oep-otr-matches-value",
          state.matches,
          true,
        ),
        buildHoverRow(
          "Match W / L",
          "oep-otr-match-record-value",
          state.matchRecord,
        ),
        buildHoverRow(
          "Match Win Rate",
          "oep-otr-match-win-rate-value",
          state.matchWinRate,
        ),
        buildHoverRow(
          "Best Win Streak",
          "oep-otr-best-win-streak-value",
          state.bestWinStreak,
        ),
        buildHoverRow(
          "Games",
          "oep-otr-games-value",
          state.games,
          true,
        ),
        buildHoverRow(
          "Game W / L",
          "oep-otr-game-record-value",
          state.gameRecord,
        ),
        buildHoverRow(
          "Game Win Rate",
          "oep-otr-game-win-rate-value",
          state.gameWinRate,
        ),
      ),
    );
  }

  function teardown() {
    document.querySelectorAll(`[${ATTR}="1"]`).forEach((node) => node.remove());
    document
      .querySelectorAll(`.${RANK_ROW_CLASS}`)
      .forEach((node) => node.classList.remove(RANK_ROW_CLASS));
  }

  function start({ getProfileUserId, getCurrentMode }) {
    const style = manageStyle(STYLE_ID, CSS);
    let debounceTimer = 0;
    let revision = 0;
    let reschedule = () => {};
    const state = {
      key: "",
      status: "idle",
      data: null,
      error: "",
    };

    const profileContext = () => {
      if (String(getCurrentMode() || "").toLowerCase() !== "osu") {
        return null;
      }
      const userId = getProfileUserId();
      if (userId == null) return null;
      return { userId, key: String(userId) };
    };

    const resetState = (force = false) => {
      const nextKey = profileContext()?.key || "";
      if (!force && state.key === nextKey) return;
      if (force) revision += 1;
      state.key = nextKey;
      state.status = "idle";
      state.data = null;
      state.error = "";
    };

    const ensureFetch = () => {
      if (!settings.isEnabled(FEATURE_ID) || !otr.isConfigured()) return;
      const context = profileContext();
      if (!context) return;
      resetState();
      if (state.status !== "idle") return;

      state.status = "loading";
      const fetchKey = `${state.key}:${revision}`;
      otr
        .fetchPlayerStats(context.userId)
        .then((stats) => {
          resetState();
          if (`${state.key}:${revision}` !== fetchKey) return;
          const rating = Number(stats?.rating?.rating);
          if (!stats?.rating || !Number.isFinite(rating)) {
            state.status = "missing";
            state.data = null;
          } else {
            state.status = "ready";
            state.data = stats;
          }
          reschedule();
        })
        .catch((error) => {
          resetState();
          if (`${state.key}:${revision}` !== fetchKey) return;
          state.status = "error";
          state.data = null;
          state.error = String(error?.message || error || "");
          reschedule();
        });
    };

    const sync = () => {
      if (!settings.isEnabled(FEATURE_ID) || !otr.isConfigured()) {
        teardown();
        return;
      }
      if (!profileContext()) {
        teardown();
        return;
      }

      const rankRow = findRankRow();
      if (!(rankRow instanceof HTMLElement)) {
        teardown();
        return;
      }

      rankRow.classList.add(RANK_ROW_CLASS);
      ensureFetch();
      const next = displayState(state);
      let card = rankRow.querySelector(`[${ATTR}="1"]`);
      if (!(card instanceof HTMLElement)) {
        card = buildRatingCard(next);
      }

      const nativeRankCards = rankRow.querySelectorAll(
        `:scope > .value-display--rank:not([${ATTR}])`,
      );
      const countryRankCard = nativeRankCards[1];
      if (countryRankCard && countryRankCard.nextElementSibling !== card) {
        countryRankCard.insertAdjacentElement("afterend", card);
      } else if (!countryRankCard && card.parentElement !== rankRow) {
        rankRow.appendChild(card);
      }

      const values = {
        ".oep-otr-rating-value": next.display,
        ".oep-otr-global-rank-value": next.globalRank,
        ".oep-otr-country-rank-value": next.countryRank,
        ".oep-otr-tier-value": next.tier,
        ".oep-otr-matches-value": next.matches,
        ".oep-otr-match-record-value": next.matchRecord,
        ".oep-otr-match-win-rate-value": next.matchWinRate,
        ".oep-otr-best-win-streak-value": next.bestWinStreak,
        ".oep-otr-games-value": next.games,
        ".oep-otr-game-record-value": next.gameRecord,
        ".oep-otr-game-win-rate-value": next.gameWinRate,
        ".oep-otr-rating-label": ratingLabel(),
      };
      for (const [selector, value] of Object.entries(values)) {
        const node = card.querySelector(selector);
        if (node instanceof HTMLElement && node.textContent !== value) {
          node.textContent = value;
        }
      }

      card.setAttribute(
        "aria-label",
        [
          next.description,
          `Global Rank: ${next.globalRank}`,
          `Country Rank: ${next.countryRank}`,
          `Tier: ${next.tier}`,
          `Matches: ${next.matches}`,
          `Match W / L: ${next.matchRecord}`,
          `Match Win Rate: ${next.matchWinRate}`,
          `Best Win Streak: ${next.bestWinStreak}`,
          `Games: ${next.games}`,
          `Game W / L: ${next.gameRecord}`,
          `Game Win Rate: ${next.gameWinRate}`,
        ].join("; "),
      );
    };

    const schedule = () => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (settings.isEnabled(FEATURE_ID) && otr.isConfigured()) {
          style.inject();
          sync();
        } else {
          teardown();
          style.remove();
        }
      }, 50);
    };
    reschedule = schedule;

    resetState(true);
    schedule();

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    const unsubscribe = settings.onChange(FEATURE_ID, (enabled) => {
      if (enabled) {
        resetState(true);
        style.inject();
        schedule();
      } else {
        teardown();
        style.remove();
      }
    });

    const onApiKeyChanged = () => {
      resetState(true);
      schedule();
    };
    window.addEventListener("oep-otr-api-key-changed", onApiKeyChanged);

    return () => {
      reschedule = () => {};
      clearTimeout(debounceTimer);
      observer.disconnect();
      try {
        unsubscribe();
      } catch (_) {}
      window.removeEventListener("oep-otr-api-key-changed", onApiKeyChanged);
      revision += 1;
      teardown();
      style.remove();
    };
  }

  return { start };
})();
