/**
 * Synchronous decorations of a profile score list, shared by the official
 * lists and the Recent list (WS-41): pp decimals, hidden weighted pp, place
 * numbers. Each one is idempotent, so a list can be decorated again after
 * any row change.
 */

import { formatDecimalPp, parseLocaleNumber, settings } from "../legacy.js";
import {
  SCORE_PLACE_NUMBER_ID,
  SCORE_PLACE_SECTION_TYPE,
  SCORE_PP_DECIMALS_ID,
  applyPlaceNumbers,
  applyPpDecimals,
  revertPlaceNumbers,
  revertPpDecimals,
  scorePlaceNumberStyle,
  syncScoreListPpDecimalsWidthClass,
} from "./score-rows.js";
import { applyHideWeightedPp } from "./score-stats.js";

/** Section type of the Expert+ Recent list (not one of osu-web's lists). */
export const RECENT_SECTION_TYPE = "recent";

/** Lists whose rows get a place number. */
const PLACE_NUMBER_SECTION_TYPES = new Set([
  SCORE_PLACE_SECTION_TYPE,
  RECENT_SECTION_TYPE,
]);

/**
 * True when osu! wrote an integer pp back over our decimals (a re-render after
 * the locale loads changes the text node, not the row).
 * @param {MutationRecord[]} mutations
 */
function ppDecimalsOverwritten(mutations) {
  return mutations.some((m) => {
    if (m.type !== "characterData") return false;
    const span = m.target.parentElement;
    if (!(span instanceof HTMLSpanElement)) return false;
    const titleAttr = span.getAttribute("title");
    if (!titleAttr || !span.parentElement?.matches(".play-detail__pp"))
      return false;
    const n = parseLocaleNumber(titleAttr);
    if (!Number.isFinite(n)) return false;
    return m.target.nodeValue !== formatDecimalPp(n) + " ";
  });
}

/**
 * @typedef {{ listEl: HTMLElement, type: string }} ScoreSection
 * @typedef {{
 *   name: string,
 *   settingId?: string,
 *   applies: (section: ScoreSection) => boolean,
 *   apply: (listEl: HTMLElement) => void,
 *   revert?: (listEl: HTMLElement) => void,
 *   sync?: (listEl: HTMLElement) => void,
 *   release?: () => void,
 *   isStale?: (mutations: MutationRecord[]) => boolean,
 * }} ListDecoration
 * `settingId`: the setting that turns it on (its change re-runs `sync`, then
 * `apply` or `revert` on every list, and `release` once it is off).
 * `isStale`: osu! undid it without adding rows.
 */

/** @type {ListDecoration[]} in the order they are applied */
const LIST_DECORATIONS = [
  {
    name: "pp-decimals",
    settingId: SCORE_PP_DECIMALS_ID,
    applies: () => settings().isEnabled(SCORE_PP_DECIMALS_ID),
    apply: applyPpDecimals,
    revert: revertPpDecimals,
    sync: syncScoreListPpDecimalsWidthClass,
    isStale: (mutations) =>
      settings().isEnabled(SCORE_PP_DECIMALS_ID) &&
      ppDecimalsOverwritten(mutations),
  },
  {
    name: "hide-weighted-pp",
    applies: () => true,
    apply: applyHideWeightedPp,
  },
  {
    name: "place-numbers",
    settingId: SCORE_PLACE_NUMBER_ID,
    applies: ({ type }) =>
      settings().isEnabled(SCORE_PLACE_NUMBER_ID) &&
      PLACE_NUMBER_SECTION_TYPES.has(type),
    apply: (listEl) => {
      // The style is shared and owned by profile `init` (B07).
      scorePlaceNumberStyle.inject();
      applyPlaceNumbers(listEl);
    },
    revert: revertPlaceNumbers,
    release: () => scorePlaceNumberStyle.remove(),
  },
];

/**
 * Apply every decoration that is on for `section`.
 * @param {ScoreSection} section
 * @param {{ revertOff?: boolean }} [options]  also revert the ones that are off
 */
export function decorateScoreList(section, { revertOff = false } = {}) {
  for (const d of LIST_DECORATIONS) {
    if (d.applies(section)) d.apply(section.listEl);
    else if (revertOff) d.revert?.(section.listEl);
  }
}

/**
 * Whether osu! undid a decoration of the list without adding rows.
 * @param {MutationRecord[]} mutations
 */
export function decorationsStale(mutations) {
  return LIST_DECORATIONS.some((d) => d.isStale?.(mutations));
}

/**
 * Follow the decoration settings on the sections `getSections()` returns.
 * @param {() => ScoreSection[]} getSections
 * @returns {(() => void)[]} unsubscribers
 */
export function watchDecorationSettings(getSections) {
  return LIST_DECORATIONS.filter((d) => d.settingId).map((d) =>
    settings().onChange(d.settingId, (enabled) => {
      for (const section of getSections()) {
        d.sync?.(section.listEl);
        if (d.applies(section)) d.apply(section.listEl);
        else d.revert?.(section.listEl);
      }
      if (!enabled) d.release?.();
    }),
  );
}
