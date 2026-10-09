/**
 * /beatmapsets/:id and variants: starts the beatmapset page features
 * (src/features/beatmapset/) and the scoreboard (src/features/scoreboard/).
 */

import {
  findBeatmapsetOsuDirectButton,
  mountBeatconnectDownloadSplit,
  mountBeatmapsetPreviewAudioButton,
} from "../features/beatmapset/header-buttons.js";
import { ROOT_CLASS } from "../features/beatmapset/constants.js";
import { startDiscussionTabLinkPatcher } from "../features/beatmapset/discussion-tab-links.js";
import {
  setupBeatmapsetFavouriteHoverPopover,
  startBeatmapsetFavouriteButtonPinkIndicator,
} from "../features/beatmapset/favourites.js";
import {
  attachBeatmapsetInfoModal,
  buildBeatmapMetadataOsuOpenButton,
  buildDescriptionModalBody,
  buildModalBody,
  teardownBeatmapDescriptionHeadingLayout,
} from "../features/beatmapset/info-modals.js";
import {
  mountOmdbBeatmapsetLinkOnlyRow,
  mountOmdbBeatmapsetRatingsRow,
} from "../features/beatmapset/omdb.js";
import { startPickerDiffNames } from "../features/beatmapset/picker-diff-names.js";
import {
  BEATMAPSET_CSS,
  BEATMAPSET_STYLE_ID,
} from "../features/beatmapset/styles.js";
import {
  findBeatmapScoreboardRoot,
  getBeatmapPageBeatmapId,
  getBeatmapPageRuleset,
  readBeatmapsetJson,
} from "../features/scoreboard/context.js";
import { disposeScoreboardGlobalRanks } from "../features/scoreboard/global-rank.js";
import {
  setupBeatmapScoreboardModGrid,
  stopBeatmapScoreboardModGridLive,
} from "../features/scoreboard/mod-filter/grid.js";
import { startBeatmapScoreUserSearchManager } from "../features/scoreboard/player-lookup.js";
import { startBeatmapScoreboardHideRateEditFilterBar } from "../features/scoreboard/rate-filter.js";
import { refreshBeatmapScoreboardTableEnhancements } from "../features/scoreboard/refresh.js";
import { installBeatmapScoresLimitPatch } from "../features/scoreboard/scores-limit.js";
import { startBeatmapScoreboardSortControls } from "../features/scoreboard/sort.js";
import {
  MOD_GRID_CSS,
  MOD_GRID_STYLE_ID,
  SCOREBOARD_CSS,
  SCOREBOARD_STYLE_ID,
} from "../features/scoreboard/styles.js";
import { startBeatmapScoreboardTableEnhancementsLive } from "../features/scoreboard/table-enhance.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapDetail = (() => {
  const name = "BeatmapDetail";
  const {
    el,
    waitForElement,
    waitForStaleElementToLeave,
    manageStyle,
    createCleanupBag,
  } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const auth = OsuExpertPlus.auth;
  const omdb = OsuExpertPlus.omdb;

  // With user-profile: score-row PP + hit stats
  const SCORE_PP_DECIMALS_ID = IDS.SCORE_PP_DECIMALS;
  const METADATA_DESCRIPTION_MODAL_BUTTONS_ID =
    IDS.METADATA_DESCRIPTION_MODAL_BUTTONS;
  const OMDB_BEATMAPSET_RATINGS_ID = IDS.OMDB_BEATMAPSET_RATINGS;
  const BEATMAP_PREVIEW_ID = IDS.BEATMAP_PREVIEW;
  const BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID =
    IDS.BEATMAPSET_PREVIEW_AUDIO_BUTTON;
  const BEATCONNECT_DOWNLOAD_BUTTON_ID = IDS.BEATCONNECT_DOWNLOAD_BUTTON;
  const SCOREBOARD_MOD_GRID_ID = IDS.SCOREBOARD_MOD_GRID;
  const SCOREBOARD_GLOBAL_RANK_ID = IDS.SCOREBOARD_GLOBAL_RANK;
  const beatmapPreview = OsuExpertPlus.beatmapPreview;

  const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";

  const mainStyle = manageStyle(BEATMAPSET_STYLE_ID, BEATMAPSET_CSS);
  const scoreboardStyle = manageStyle(SCOREBOARD_STYLE_ID, SCOREBOARD_CSS);
  const modGridStyle = manageStyle(MOD_GRID_STYLE_ID, MOD_GRID_CSS);

  function ensureStyles() {
    mainStyle.inject();
    scoreboardStyle.inject();
    modGridStyle.inject();
  }

  const BEATMAPSET_HEADER_PROCESSED_ATTR = "data-oep-processed";
  const BEATMAPSET_HEADER_STALE_SEL = `.beatmapset-header[${BEATMAPSET_HEADER_PROCESSED_ATTR}]`;

  /**
   * @param {RegExpMatchArray} match  match[1] = beatmapset id string.
   * @returns {Promise<function>}
   */
  async function init(match) {
    const beatmapsetId = match[1];
    const pathRe = new RegExp(`^/beatmapsets/${beatmapsetId}(?:/|$)`);

    ensureStyles();
    installBeatmapScoresLimitPatch();

    /** @type {{ dispose: () => void } | null} */
    let metadataInfoModal = null;
    /** @type {{ dispose: () => void } | null} */
    let descriptionInfoModal = null;
    /** @type {HTMLElement|null} */
    let descriptionHeadingDescRow = null;
    /** @type {HTMLElement|null} */
    let header = null;
    /** @type {null|(() => void)} */
    let modGridCleanup = null;
    let modGridSetupGen = 0;

    const bag = createCleanupBag();

    function disposeBeatmapInfoModalButtons() {
      try {
        metadataInfoModal?.dispose();
      } catch (_) {}
      metadataInfoModal = null;
      try {
        descriptionInfoModal?.dispose();
      } catch (_) {}
      descriptionInfoModal = null;
      if (descriptionHeadingDescRow instanceof HTMLElement) {
        teardownBeatmapDescriptionHeadingLayout(descriptionHeadingDescRow);
        descriptionHeadingDescRow = null;
      }
    }

    function refreshBeatmapInfoModalButtons() {
      if (!(header instanceof HTMLElement) || !document.body.contains(header))
        return;
      if (!pathRe.test(location.pathname)) return;

      if (!settings.isEnabled(METADATA_DESCRIPTION_MODAL_BUTTONS_ID)) {
        disposeBeatmapInfoModalButtons();
        return;
      }

      const data = readBeatmapsetJson();

      const artistEl = header.querySelector(
        ".beatmapset-header__details-text--artist",
      );
      if (
        !metadataInfoModal &&
        artistEl instanceof HTMLElement &&
        !header.querySelector("[data-oep-beatmapset-metadata]")
      ) {
        metadataInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap metadata",
          titleId: `${ROOT_CLASS}-metadata-title`,
          buttonText: "Show metadata",
          buttonIconClass: "fas fa-clipboard-list",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--under-artist`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-metadata", "");
            artistEl.insertAdjacentElement("afterend", btn);
          },
          buildModalTitleExtra: (elFn) =>
            buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapPageBeatmapId),
          buildBody: () => buildModalBody(data, el),
        });
      }

      const infoCol = document.querySelector(".beatmapset-info");
      const firstBox = infoCol?.querySelector(":scope > .beatmapset-info__box");
      const scrollEl = firstBox?.querySelector(
        ":scope > .beatmapset-info__scrollable",
      );
      const descRow =
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:has(.beatmapset-info__description)",
        ) ??
        scrollEl?.querySelector(
          ":scope > .beatmapset-info__row:first-child:has(> h3.beatmapset-info__header)",
        );
      const descHeading = descRow?.querySelector(
        ":scope > h3.beatmapset-info__header",
      );
      if (
        !descriptionInfoModal &&
        descRow instanceof HTMLElement &&
        descHeading instanceof HTMLElement &&
        !descRow.querySelector("[data-oep-beatmapset-desc]")
      ) {
        descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
        descriptionHeadingDescRow = descRow;
        descriptionInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
          title: "Beatmap description",
          titleId: `${ROOT_CLASS}-description-title`,
          buttonText: "Full description",
          buttonIconClass: "fas fa-align-left",
          buttonExtraClass: `${ROOT_CLASS}__action-btn--description-heading`,
          modalExtraClass: `${ROOT_CLASS}__modal--description`,
          mountButton: (btn) => {
            btn.setAttribute("data-oep-beatmapset-desc", "");
            const headWrap = el("div", {
              class: `${ROOT_CLASS}__description-sticky-head`,
            });
            descRow.insertBefore(headWrap, descHeading);
            headWrap.appendChild(descHeading);
            headWrap.appendChild(btn);
          },
          buildBody: () => buildDescriptionModalBody(data, el),
        });
      }
    }

    function refreshBeatmapScoreboardModGrid() {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      const gen = modGridSetupGen;
      if (!settings.isEnabled(SCOREBOARD_MOD_GRID_ID)) {
        const modsStrip = document.querySelector(
          ".beatmapset-scoreboard__mods",
        );
        if (modsStrip instanceof HTMLElement) {
          stopBeatmapScoreboardModGridLive(modsStrip);
        }
        return;
      }
      setupBeatmapScoreboardModGrid().then((dispose) => {
        if (gen !== modGridSetupGen) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        if (!pathRe.test(location.pathname)) {
          try {
            dispose();
          } catch (_) {}
          return;
        }
        modGridCleanup = dispose;
      });
    }

    const cleanup = () => {
      try {
        modGridCleanup?.();
      } catch (_) {}
      modGridCleanup = null;
      modGridSetupGen += 1;
      disposeBeatmapInfoModalButtons();
      bag.dispose();
    };

    await waitForStaleElementToLeave(BEATMAPSET_HEADER_STALE_SEL);

    try {
      header = await waitForElement(".beatmapset-header", 15000);
    } catch (_) {
      return cleanup;
    }

    header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");

    if (!document.body.contains(header)) return cleanup;

    if (!pathRe.test(location.pathname)) return cleanup;

    bag.add(startBeatmapScoreboardSortControls(pathRe));
    bag.add(startBeatmapScoreUserSearchManager(pathRe));
    bag.add(startBeatmapScoreboardHideRateEditFilterBar(pathRe));
    bag.add(startBeatmapScoreboardTableEnhancementsLive(pathRe));
    bag.add(disposeScoreboardGlobalRanks);
    bag.add(startDiscussionTabLinkPatcher(beatmapsetId));
    bag.add(startBeatmapsetFavouriteButtonPinkIndicator(header));
    bag.add(startPickerDiffNames(header, pathRe));

    /** @type {null|(() => void)} */
    let beatconnectCleanup = null;
    function refreshBeatconnectDownloadButton() {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATCONNECT_DOWNLOAD_BUTTON_ID)
      ) {
        beatconnectCleanup = mountBeatconnectDownloadSplit(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatconnectDownloadButton();
    bag.add(
      settings.onChange(
        BEATCONNECT_DOWNLOAD_BUTTON_ID,
        refreshBeatconnectDownloadButton,
      ),
    );
    bag.add(() => {
      try {
        beatconnectCleanup?.();
      } catch (_) {}
      beatconnectCleanup = null;
    });

    /** @type {null|(() => void)} */
    let omdbRatingsCleanup = null;
    function refreshOmdbBeatmapsetRatings() {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
      if (!settings.isEnabled(OMDB_BEATMAPSET_RATINGS_ID)) {
        return;
      }
      omdbRatingsCleanup = omdb.isConfigured()
        ? mountOmdbBeatmapsetRatingsRow(header, beatmapsetId, pathRe)
        : mountOmdbBeatmapsetLinkOnlyRow(header, beatmapsetId);
    }
    refreshOmdbBeatmapsetRatings();
    bag.add(
      settings.onChange(
        OMDB_BEATMAPSET_RATINGS_ID,
        refreshOmdbBeatmapsetRatings,
      ),
    );
    bag.add(() => {
      try {
        omdbRatingsCleanup?.();
      } catch (_) {}
      omdbRatingsCleanup = null;
    });

    bag.add(
      settings.onChange(SCORE_PP_DECIMALS_ID, () => {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      }),
    );

    bag.add(
      settings.onChange(SCOREBOARD_GLOBAL_RANK_ID, () => {
        const root = findBeatmapScoreboardRoot();
        if (root instanceof HTMLElement) {
          refreshBeatmapScoreboardTableEnhancements(root);
        }
      }),
    );

    refreshBeatmapScoreboardModGrid();
    bag.add(
      settings.onChange(
        SCOREBOARD_MOD_GRID_ID,
        refreshBeatmapScoreboardModGrid,
      ),
    );

    const data = readBeatmapsetJson();

    if (auth.isConfigured()) {
      bag.add(
        setupBeatmapsetFavouriteHoverPopover(
          header,
          beatmapsetId,
          pathRe,
          data?.favourite_count,
        ),
      );
    }

    refreshBeatmapInfoModalButtons();
    bag.add(
      settings.onChange(
        METADATA_DESCRIPTION_MODAL_BUTTONS_ID,
        refreshBeatmapInfoModalButtons,
      ),
    );

    try {
      await waitForElement(".beatmapset-info", 12000);
      if (pathRe.test(location.pathname) && document.body.contains(header)) {
        // Between `.beatmapset-header` and `.beatmapset-info` (sibling in `.osu-page--generic-compact`).
        /** @type {null|(() => void)} */
        let beatmapPreviewCleanup = null;
        function refreshBeatmapPreviewSection() {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
          if (
            !pathRe.test(location.pathname) ||
            !document.body.contains(header) ||
            !settings.isEnabled(BEATMAP_PREVIEW_ID) ||
            !beatmapPreview
          ) {
            return;
          }
          const infoEl = document.querySelector(".beatmapset-info");
          if (!infoEl || !document.body.contains(infoEl)) return;
          if (document.querySelector("[data-oep-beatmap-preview-root]")) return;

          const previewUi = beatmapPreview.mountBeatmapsetInfoPreview({
            el,
            manageStyle,
            pathRe,
            getBeatmapId: getBeatmapPageBeatmapId,
            getRuleset: getBeatmapPageRuleset,
            readBeatmapsetJson,
            styleId: BEATMAP_PREVIEW_STYLE_ID,
          });
          const previewSection = el("div", {
            class: "oep-beatmap-preview-section",
          });
          previewSection.appendChild(previewUi.getRow());
          infoEl.insertAdjacentElement("beforebegin", previewSection);
          beatmapPreviewCleanup = () => {
            try {
              previewUi.dispose();
            } catch (_) {}
            previewSection.remove();
          };
        }
        refreshBeatmapPreviewSection();
        bag.add(
          settings.onChange(BEATMAP_PREVIEW_ID, refreshBeatmapPreviewSection),
        );
        bag.add(() => {
          try {
            beatmapPreviewCleanup?.();
          } catch (_) {}
          beatmapPreviewCleanup = null;
        });

        refreshBeatmapInfoModalButtons();
      }
    } catch (_) {
      /* beatmapset info column not present (layout edge case) */
    }

    const headerButtons = header.querySelector(".beatmapset-header__buttons");
    if (
      headerButtons instanceof HTMLElement &&
      !headerButtons.querySelector("[data-oep-beatmapset-bg]")
    ) {
      const backgroundUrl = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`;
      const bgLink = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: backgroundUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-bg": "",
          title: "Open background",
          "aria-label": "Open background",
        },
        el(
          "span",
          {
            class: "btn-osu-big__content btn-osu-big__content--center",
          },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-image", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const mp3DownloadUrl = `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`;
      const mp3Link = el(
        "a",
        {
          class: "btn-osu-big btn-osu-big--beatmapset-header-square",
          href: mp3DownloadUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-oep-beatmapset-mp3": "",
          title: "Download MP3",
          "aria-label": "Download MP3",
        },
        el(
          "span",
          { class: "btn-osu-big__content btn-osu-big__content--center" },
          el(
            "span",
            { class: "btn-osu-big__icon" },
            el(
              "span",
              { class: "fa fa-fw" },
              el("span", { class: "fas fa-music", "aria-hidden": "true" }),
            ),
          ),
        ),
      );
      const directBtn = findBeatmapsetOsuDirectButton(headerButtons);
      if (directBtn) {
        directBtn.insertAdjacentElement("afterend", bgLink);
      } else {
        headerButtons.appendChild(bgLink);
      }
      bgLink.insertAdjacentElement("afterend", mp3Link);
      bag.add(() => {
        mp3Link.remove();
        bgLink.remove();
      });
    }

    /** @type {null|(() => void)} */
    let previewAudioCleanup = null;
    function refreshBeatmapsetPreviewAudioButton() {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
      if (
        pathRe.test(location.pathname) &&
        document.body.contains(header) &&
        settings.isEnabled(BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID)
      ) {
        previewAudioCleanup = mountBeatmapsetPreviewAudioButton(
          header,
          beatmapsetId,
        );
      }
    }
    refreshBeatmapsetPreviewAudioButton();
    bag.add(
      settings.onChange(
        BEATMAPSET_PREVIEW_AUDIO_BUTTON_ID,
        refreshBeatmapsetPreviewAudioButton,
      ),
    );
    bag.add(() => {
      try {
        previewAudioCleanup?.();
      } catch (_) {}
      previewAudioCleanup = null;
    });

    return cleanup;
  }

  return { name, init };
})();
