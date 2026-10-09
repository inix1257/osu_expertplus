/**
 * Modded star rating on profile score rows, loaded as rows scroll into view
 * (WS-41).
 */

import { STAR_FORMAT, formatStars } from "../../osu/format.js";
import { difficultyMods } from "../../osu/mods.js";
import { el } from "../legacy.js";
import {
  MODDED_SR_ATTR,
  _extractRowData,
  _fetchBeatmapAttributesCached,
} from "./beatmap-attributes.js";
import { _applyByBeatmapId, _buildScoresByBeatmapId } from "./score-rows.js";
import {
  _applyApiMaxComboToComboInline,
  injectStatsRow,
} from "./score-stats.js";
async function _fetchAndApplySr(rowEl) {
  if (rowEl.hasAttribute(MODDED_SR_ATTR)) return;
  rowEl.setAttribute(MODDED_SR_ATTR, "");

  const { beatmapId, ruleset, mods } = _extractRowData(rowEl);
  if (!beatmapId) return;

  const diffMods = difficultyMods(mods);
  const { sr, maxCombo } = await _fetchBeatmapAttributesCached(
    beatmapId,
    diffMods,
    ruleset,
  );

  if (!rowEl.hasAttribute(MODDED_SR_ATTR)) return;
  rowEl.setAttribute(MODDED_SR_ATTR, "1");

  if (maxCombo != null) _applyApiMaxComboToComboInline(rowEl, maxCombo);

  if (sr === null || sr === undefined) return;

  const beatmapSpan = rowEl.querySelector(".play-detail__beatmap");
  if (!beatmapSpan || rowEl.querySelector(".oep-sr-badge")) return;

  const parent = beatmapSpan.parentNode;
  if (!parent) return;

  const badge = el(
    "span",
    { class: "oep-sr-badge" },
    el(
      "span",
      { class: "oep-sr-badge__inner" },
      el("i", {
        class: "fas fa-star oep-sr-badge__icon",
        "aria-hidden": "true",
      }),
      el(
        "span",
        { class: "oep-sr-badge__val" },
        formatStars(sr, STAR_FORMAT.profileBadge),
      ),
    ),
  );
  badge.style.backgroundColor =
    OsuExpertPlus.difficultyColours.getDiffColour(sr);
  badge.style.color = OsuExpertPlus.difficultyColours.getDiffTextColour(sr);
  parent.insertBefore(badge, beatmapSpan);
}

export let _srObserver = null;
let _srDomObserver = null;

export function _observeRow(rowEl) {
  if (!_srObserver || rowEl.hasAttribute(MODDED_SR_ATTR)) return;
  _srObserver.observe(rowEl);
}

export function initSrObserver() {
  teardownSrObserver();
  _srObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        _srObserver.unobserve(entry.target);
        _fetchAndApplySr(entry.target);
      }
    },
    { rootMargin: "300px 0px" },
  );

  document.querySelectorAll(".play-detail").forEach(_observeRow);

  _srDomObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".play-detail")) {
          _observeRow(node);
        } else {
          if (!node.querySelector(".play-detail")) continue;
          node.querySelectorAll(".play-detail").forEach(_observeRow);
        }
      }
    }
  });
  _srDomObserver.observe(document.body, { childList: true, subtree: true });
}

export function teardownSrObserver() {
  _srObserver?.disconnect();
  _srObserver = null;
  _srDomObserver?.disconnect();
  _srDomObserver = null;
}

export function revertModdedStarRatings() {
  teardownSrObserver();
  document
    .querySelectorAll(`.play-detail[${MODDED_SR_ATTR}]`)
    .forEach((rowEl) => {
      rowEl.removeAttribute(MODDED_SR_ATTR);
      rowEl.querySelector(".oep-sr-badge")?.remove();
    });
}

export function processElements(elements, scores) {
  const byBeatmap = _buildScoresByBeatmapId(scores);
  const usageCount = new Map();
  _applyByBeatmapId(elements, byBeatmap, usageCount, injectStatsRow);
}
