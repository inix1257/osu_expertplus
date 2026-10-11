/**
 * Gameplay preview section between the beatmapset header and the info
 * column (WS-33, moved out of beatmap-detail init). The preview itself is
 * src/features/beatmap-preview/ (WS-51).
 */

import { mountBeatmapsetInfoPreview } from "../beatmap-preview/widget/index.js";
import {
  getBeatmapPageBeatmapId,
  getBeatmapPageRuleset,
  readBeatmapsetJson,
} from "../scoreboard/context.js";
import { el } from "../legacy.js";

const BEATMAP_PREVIEW_STYLE_ID = "osu-expertplus-beatmap-preview-css";

/**
 * Mount the preview before `.beatmapset-info`. Call once the info column
 * exists; does nothing when it is missing or a preview is already there.
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {RegExp} pathRe
 * @returns {(() => void)|undefined}
 */
export function mountBeatmapPreviewSection(header, pathRe) {
  if (!pathRe.test(location.pathname) || !document.body.contains(header)) {
    return undefined;
  }
  const infoEl = document.querySelector(".beatmapset-info");
  if (!infoEl || !document.body.contains(infoEl)) return undefined;
  if (document.querySelector("[data-oep-beatmap-preview-root]")) {
    return undefined;
  }

  const previewUi = mountBeatmapsetInfoPreview({
    el,
    manageStyle: OsuExpertPlus.dom.manageStyle,
    pathRe,
    getBeatmapId: getBeatmapPageBeatmapId,
    getRuleset: getBeatmapPageRuleset,
    readBeatmapsetJson,
    styleId: BEATMAP_PREVIEW_STYLE_ID,
  });
  const previewSection = el("div", { class: "oep-beatmap-preview-section" });
  previewSection.appendChild(previewUi.getRow());
  // Between `.beatmapset-header` and `.beatmapset-info` (siblings in `.osu-page--generic-compact`).
  infoEl.insertAdjacentElement("beforebegin", previewSection);
  return () => {
    try {
      previewUi.dispose();
    } catch (_) {}
    previewSection.remove();
  };
}
