/**
 * /beatmapsets/:id and variants: composes the beatmapset page features
 * (src/features/beatmapset/) and the scoreboard (src/features/scoreboard/).
 */

import { mountSettingFeature, safeStart } from "../core/lifecycle.js";
import { startDiscussionTabLinkPatcher } from "../features/beatmapset/discussion-tab-links.js";
import {
  setupBeatmapsetFavouriteHoverPopover,
  startBeatmapsetFavouriteButtonPinkIndicator,
} from "../features/beatmapset/favourites.js";
import {
  mountBeatconnectDownloadSplit,
  mountBeatmapsetBackgroundButton,
  mountBeatmapsetMp3Button,
  mountBeatmapsetPreviewAudioButton,
} from "../features/beatmapset/header-buttons.js";
import { startBeatmapsetInfoModals } from "../features/beatmapset/info-modals.js";
import { mountOmdbRow } from "../features/beatmapset/omdb.js";
import { startPickerDiffNames } from "../features/beatmapset/picker-diff-names.js";
import { mountBeatmapPreviewSection } from "../features/beatmapset/preview-section.js";
import {
  BEATMAPSET_CSS,
  BEATMAPSET_STYLE_ID,
} from "../features/beatmapset/styles.js";
import { remountOnEvent } from "../features/remount.js";
import {
  CREDENTIALS_CHANGED_EVENT,
  readBeatmapsetJson,
} from "../features/scoreboard/context.js";
import {
  prepareScoreboard,
  startScoreboard,
} from "../features/scoreboard/index.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

const BEATMAPSET_HEADER_PROCESSED_ATTR = "data-oep-processed";
const BEATMAPSET_HEADER_STALE_SEL = `.beatmapset-header[${BEATMAPSET_HEADER_PROCESSED_ATTR}]`;

/**
 * @param {RegExpMatchArray} match  match[1] = beatmapset id string.
 * @param {{ signal?: AbortSignal }} [ctx]
 * @returns {Promise<function>}
 */
async function init(match, ctx = {}) {
  const { waitForElement, waitForStaleElementToLeave, manageStyle } =
    OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const { IDS } = settings;
  const beatmapsetId = match[1];
  const pathRe = new RegExp(`^/beatmapsets/${beatmapsetId}(?:/|$)`);

  manageStyle(BEATMAPSET_STYLE_ID, BEATMAPSET_CSS).inject();
  prepareScoreboard();

  const bag = OsuExpertPlus.dom.createCleanupBag();
  const cleanup = () => bag.dispose();

  await waitForStaleElementToLeave(BEATMAPSET_HEADER_STALE_SEL);

  /** @type {HTMLElement} */
  let header;
  try {
    header = await waitForElement(".beatmapset-header", 15000);
  } catch (_) {
    return cleanup;
  }
  header.setAttribute(BEATMAPSET_HEADER_PROCESSED_ATTR, "1");
  if (!document.body.contains(header)) return cleanup;
  if (!pathRe.test(location.pathname)) return cleanup;
  const onPage = () =>
    pathRe.test(location.pathname) && document.body.contains(header);

  startScoreboard(bag, pathRe);
  safeStart(
    bag,
    () => startDiscussionTabLinkPatcher(beatmapsetId),
    "discussion tab links",
  );
  safeStart(
    bag,
    () => startBeatmapsetFavouriteButtonPinkIndicator(header),
    "favourite button",
  );
  safeStart(bag, () => startPickerDiffNames(header, pathRe), "picker names");
  mountSettingFeature(bag, settings, IDS.BEATCONNECT_DOWNLOAD_BUTTON, () =>
    onPage() ? mountBeatconnectDownloadSplit(header, beatmapsetId) : undefined,
  );
  // Saving or clearing the OMDB key switches between the ratings row and
  // the link-only row (B70).
  mountSettingFeature(bag, settings, IDS.OMDB_BEATMAPSET_RATINGS, () =>
    remountOnEvent(window, OsuExpertPlus.omdb.KEY_CHANGED_EVENT, () =>
      mountOmdbRow(header, beatmapsetId, pathRe),
    ),
  );
  // The favourites popover needs OAuth credentials; follow them (B70).
  safeStart(
    bag,
    () =>
      remountOnEvent(window, CREDENTIALS_CHANGED_EVENT, () =>
        OsuExpertPlus.auth.isConfigured()
          ? setupBeatmapsetFavouriteHoverPopover(
              header,
              beatmapsetId,
              pathRe,
              readBeatmapsetJson()?.favourite_count,
            )
          : undefined,
      ),
    "favourites popover",
  );
  mountSettingFeature(
    bag,
    settings,
    IDS.METADATA_DESCRIPTION_MODAL_BUTTONS,
    () => startBeatmapsetInfoModals(header, pathRe),
  );

  // The preview sits before the info column, which can render after the header.
  try {
    await waitForElement(".beatmapset-info", {
      timeout: 12000,
      signal: ctx.signal,
    });
    if (onPage()) {
      mountSettingFeature(bag, settings, IDS.BEATMAP_PREVIEW, () =>
        mountBeatmapPreviewSection(header, pathRe),
      );
    }
  } catch (_) {
    /* beatmapset info column not present (layout edge case), or page left */
  }

  mountSettingFeature(bag, settings, IDS.BACKGROUND_BUTTON, () =>
    onPage()
      ? mountBeatmapsetBackgroundButton(header, beatmapsetId)
      : undefined,
  );
  mountSettingFeature(bag, settings, IDS.MP3_DOWNLOAD_BUTTON, () =>
    onPage() ? mountBeatmapsetMp3Button(header, beatmapsetId) : undefined,
  );
  mountSettingFeature(bag, settings, IDS.BEATMAPSET_PREVIEW_AUDIO_BUTTON, () =>
    onPage()
      ? mountBeatmapsetPreviewAudioButton(header, beatmapsetId)
      : undefined,
  );

  return cleanup;
}

OsuExpertPlus.pages.beatmapDetail = { name: "BeatmapDetail", init };
