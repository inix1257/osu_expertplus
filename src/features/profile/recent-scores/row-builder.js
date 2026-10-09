/**
 * Expert+ Recent: a play-detail row from an API score (WS-41).
 */

import {
  ACCURACY_FORMAT,
  formatAccuracy,
  scoreGrade,
} from "../../../osu/score.js";
import {
  applyModIconsAsAcronyms,
  el,
  formatDecimalPp,
  settingIds,
  settings,
} from "../../legacy.js";
import { beatmapHrefFromScore } from "./common.js";
import { buildApiScoreModsInner } from "./mods.js";
import { scoreTimestampIso } from "./options-menu.js";
import { SCORE_PP_DECIMALS_ID } from "../score-rows.js";
/**
 * @param {Object} score  osu API v2 score object
 * @param {HTMLElement|null} [modTemplateEl]
 * @returns {HTMLElement}
 */
export function buildPlayDetailRowFromApiScore(score, modTemplateEl = null) {
  const bn = "play-detail";
  const bms = score.beatmapset || {};
  const bm = score.beatmap || {};
  const rank = scoreGrade(score, { sanitize: true });
  const rankClass = `score-rank score-rank--full score-rank--${rank}`;

  const titleText = bms.title || "Unknown beatmap";
  const artistText = bms.artist || "—";

  const modsEl = el("div", { class: `${bn}__mods` });
  modsEl.appendChild(buildApiScoreModsInner(score.mods, modTemplateEl));
  if (settings().isEnabled(settingIds().MOD_ICONS_AS_ACRONYMS)) {
    applyModIconsAsAcronyms(modsEl);
  }

  let ppInner;
  if (score.pp != null && Number(score.pp) > 0) {
    const rawN = Number(score.pp);
    const raw = String(score.pp);
    const showPpDecimals = settings().isEnabled(SCORE_PP_DECIMALS_ID);
    const shown = Number.isFinite(rawN)
      ? showPpDecimals
        ? formatDecimalPp(rawN)
        : String(Math.round(rawN))
      : raw;
    ppInner = el(
      "span",
      { title: raw },
      shown,
      el("span", { class: `${bn}__pp-unit` }, "pp"),
    );
  } else {
    ppInner = el("span", {}, "—");
  }

  const scoreTimeIso = scoreTimestampIso(score);
  const ended = scoreTimeIso ? new Date(scoreTimeIso).toLocaleString() : "";

  return el(
    "div",
    {
      class: `${bn} ${bn}--highlightable`,
    },
    el(
      "div",
      { class: `${bn}__group ${bn}__group--top` },
      el(
        "div",
        { class: `${bn}__icon ${bn}__icon--main` },
        el("div", { class: rankClass }),
      ),
      el(
        "div",
        { class: `${bn}__detail` },
        el(
          "a",
          {
            class: `${bn}__title u-ellipsis-overflow`,
            href: beatmapHrefFromScore(score),
          },
          titleText,
          " ",
          el("small", { class: `${bn}__artist` }, artistText),
        ),
        el(
          "div",
          { class: `${bn}__beatmap-and-time` },
          el("span", { class: `${bn}__beatmap` }, bm.version || "—"),
          el(
            "span",
            { class: `${bn}__time` },
            el(
              "time",
              { class: "js-timeago timeago", datetime: scoreTimeIso || "" },
              ended,
            ),
          ),
        ),
      ),
    ),
    el(
      "div",
      { class: `${bn}__group ${bn}__group--bottom` },
      el(
        "div",
        { class: `${bn}__score-detail` },
        el(
          "div",
          { class: `${bn}__icon ${bn}__icon--extra` },
          el("div", { class: rankClass }),
        ),
        el(
          "div",
          { class: `${bn}__score-detail-top-right` },
          el(
            "div",
            { class: `${bn}__accuracy-and-weighted-pp` },
            el(
              "span",
              { class: `${bn}__accuracy` },
              formatAccuracy(score?.accuracy, ACCURACY_FORMAT.profile),
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: `${bn}__mods-pp` },
        modsEl,
        el("div", { class: `${bn}__pp` }, ppInner),
      ),
      el("div", { class: `${bn}__more` }),
    ),
  );
}
