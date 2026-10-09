/**
 * The beatmapset header's difficulty picker, shared by the picker names and
 * the OMDB row (WS-33): link ids, the displayed difficulty, and one hub
 * subscription for picker changes instead of an observer per feature.
 */

import { observe } from "../../core/observe.js";
import { parsePickerHref } from "../../osu/beatmapset-data.js";

export const PICKER_SEL = ".beatmapset-beatmap-picker";
export const PICKER_LINK_SEL = "a.beatmapset-beatmap-picker__beatmap";

/**
 * @param {Element|null|undefined} a  picker link
 * @param {{ pathFallback?: boolean }} [options]  also read `/beatmaps/<id>` hrefs
 * @returns {number|null}
 */
export function pickerLinkBeatmapId(a, { pathFallback = false } = {}) {
  if (!(a instanceof HTMLAnchorElement)) return null;
  const parsed = parsePickerHref(a.getAttribute("href"), {
    match: "any-end",
    pathFallback,
  });
  return parsed ? parsed.beatmapId : null;
}

/**
 * @param {Element} picker
 * @returns {number|null}  the selected difficulty
 */
export function activePickerBeatmapId(picker) {
  return pickerLinkBeatmapId(
    picker.querySelector(
      `${PICKER_LINK_SEL}.beatmapset-beatmap-picker__beatmap--active`,
    ),
  );
}

/**
 * Calls `onChange` (synchronously; callers batch) when osu-web changes the
 * picker's links, their classes (active difficulty) or hrefs.
 * @param {Element} picker
 * @param {() => void} onChange
 * @param {{ signal?: AbortSignal, label: string }} options
 * @returns {() => void}
 */
export function subscribePickerChanges(picker, onChange, { signal, label }) {
  return observe.subscribe(
    {
      selector: `${PICKER_SEL}, ${PICKER_LINK_SEL}`,
      attributes: ["class", "href"],
      schedule: "sync",
      signal,
      label,
    },
    ({ records }) => {
      if (records.some((r) => picker.contains(r.target))) onChange();
    },
  );
}
