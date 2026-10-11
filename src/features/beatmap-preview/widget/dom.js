/**
 * The gameplay preview widget's elements (WS-51): the toggle button, and a
 * panel with the canvas host and the seek row.
 */

import { WRAP_CLASS } from "./styles.js";

/**
 * @typedef {{
 *   row: HTMLElement,
 *   toggleBtn: HTMLButtonElement,
 *   panel: HTMLElement,
 *   statusEl: HTMLElement,
 *   canvasHost: HTMLElement,
 *   engineSlot: HTMLElement,
 *   transportOverlay: HTMLElement,
 *   transportPlayGlyph: HTMLElement,
 *   transportPauseGlyph: HTMLElement,
 *   previewTimeBtn: HTMLButtonElement,
 *   seekTimeDisplay: HTMLElement,
 *   seekRange: HTMLInputElement,
 *   musicVolumeRange: HTMLInputElement,
 *   hitsoundVolumeRange: HTMLInputElement,
 *   offsetInput: HTMLInputElement,
 * }} PreviewDom
 */

/**
 * @param {typeof OsuExpertPlus.dom.el} el
 * @param {string} faClass  e.g. `fa-play`
 */
function faIcon(el, faClass) {
  return el(
    "span",
    { class: "fa fa-fw" },
    el("span", { class: `fas ${faClass}`, "aria-hidden": "true" }),
  );
}

/**
 * @param {typeof OsuExpertPlus.dom.el} el
 * @param {string} title
 * @param {string} faClass
 * @param {...Node} controls
 */
function volumeGroup(el, title, faClass, ...controls) {
  return el(
    "div",
    { class: `${WRAP_CLASS}__volume` },
    el(
      "span",
      {
        class: `${WRAP_CLASS}__volume-icon`,
        "aria-hidden": "true",
        title,
      },
      faIcon(el, faClass),
    ),
    ...controls,
  );
}

/**
 * @param {typeof OsuExpertPlus.dom.el} el
 * @param {string} label
 * @param {number} volume  0–1
 */
function volumeRange(el, label, volume) {
  return el("input", {
    type: "range",
    class: `${WRAP_CLASS}__volume-range`,
    min: "0",
    max: "100",
    value: String(Math.round(volume * 100)),
    step: "1",
    disabled: true,
    "aria-label": label,
  });
}

/**
 * Build the widget, collapsed and with every control disabled.
 * @param {typeof OsuExpertPlus.dom.el} el
 * @param {{ musicVolume: number, hitsoundVolume: number, offsetText: string }} initial
 * @returns {PreviewDom}
 */
export function buildPreviewDom(
  el,
  { musicVolume, hitsoundVolume, offsetText },
) {
  const row = el("div", {
    class: "beatmapset-info__row",
    "data-oep-beatmap-preview-root": "",
  });
  const heading = el(
    "h3",
    { class: "beatmapset-info__header" },
    "Gameplay preview",
  );

  const statusEl = el("span", { class: `${WRAP_CLASS}__status` }, "");

  const unsupportedWrap = el(
    "div",
    { class: `${WRAP_CLASS}__unsupported` },
    "This gamemode is not supported yet.",
  );

  const canvasHost = el("div", {
    class: `${WRAP_CLASS}__canvas-host ${WRAP_CLASS}__canvas-host--disabled`,
    tabIndex: -1,
    role: "button",
    "aria-label": "Play gameplay preview",
  });
  const engineSlot = el("div", { class: `${WRAP_CLASS}__engine-slot` });
  const transportOverlay = el("div", {
    class: `${WRAP_CLASS}__transport-overlay`,
    "aria-hidden": "true",
  });
  const transportPlayGlyph = el(
    "span",
    { class: `${WRAP_CLASS}__transport-glyph`, hidden: "" },
    faIcon(el, "fa-play"),
  );
  const transportPauseGlyph = el(
    "span",
    { class: `${WRAP_CLASS}__transport-glyph`, hidden: "" },
    faIcon(el, "fa-pause"),
  );
  transportOverlay.appendChild(transportPlayGlyph);
  transportOverlay.appendChild(transportPauseGlyph);
  canvasHost.appendChild(engineSlot);
  canvasHost.appendChild(transportOverlay);

  const previewTimeBtn = el(
    "button",
    {
      type: "button",
      disabled: true,
      title: "Jump to the beatmap preview point (.osu PreviewTime)",
      "aria-label": "Jump to beatmap preview time",
    },
    "Jump to preview",
  );

  const seekTimeDisplay = el(
    "span",
    {
      class: `${WRAP_CLASS}__seek-time`,
      "aria-live": "off",
      title: "Current time / map duration",
    },
    "0:00 / 0:00",
  );
  const seekRange = el("input", {
    type: "range",
    class: `${WRAP_CLASS}__seek-range`,
    min: "0",
    max: "1",
    value: "0",
    step: "1",
    disabled: true,
    "aria-label": "Preview playback position",
  });
  const musicVolumeRange = volumeRange(
    el,
    "Gameplay preview music volume",
    musicVolume,
  );
  const hitsoundVolumeRange = volumeRange(
    el,
    "Gameplay preview hitsounds volume",
    hitsoundVolume,
  );

  const offsetInput = el("input", {
    type: "text",
    class: `${WRAP_CLASS}__offset-input`,
    value: offsetText,
    inputMode: "numeric",
    disabled: true,
    "aria-label": "Gameplay preview audio offset in milliseconds",
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
  });
  const offsetUnitEl = el(
    "span",
    { class: `${WRAP_CLASS}__offset-unit` },
    "ms",
  );

  const seekRow = el(
    "div",
    { class: `${WRAP_CLASS}__seek` },
    previewTimeBtn,
    seekTimeDisplay,
    seekRange,
    volumeGroup(el, "music volume", "fa-music", musicVolumeRange),
    volumeGroup(el, "hitsound volume", "fa-drum", hitsoundVolumeRange),
    volumeGroup(el, "offset", "fa-clock", offsetInput, offsetUnitEl),
    statusEl,
  );

  const panel = el(
    "div",
    { class: `${WRAP_CLASS}__panel`, hidden: "" },
    unsupportedWrap,
    canvasHost,
    seekRow,
  );

  const toggleBtn = el(
    "button",
    {
      type: "button",
      class: `btn-osu-big btn-osu-big--beatmapset ${WRAP_CLASS}__toggle`,
    },
    el(
      "span",
      { class: "btn-osu-big__content" },
      el(
        "span",
        { class: "btn-osu-big__left" },
        el("span", { class: "btn-osu-big__text-top" }, "Beatmap Preview"),
      ),
      el("span", { class: "btn-osu-big__icon" }, faIcon(el, "fa-play-circle")),
    ),
  );

  row.appendChild(heading);
  row.appendChild(toggleBtn);
  row.appendChild(panel);

  return {
    row,
    toggleBtn,
    panel,
    statusEl,
    canvasHost,
    engineSlot,
    transportOverlay,
    transportPlayGlyph,
    transportPauseGlyph,
    previewTimeBtn,
    seekTimeDisplay,
    seekRange,
    musicVolumeRange,
    hitsoundVolumeRange,
    offsetInput,
  };
}

/**
 * @param {PreviewDom} dom
 * @param {boolean} expanded
 */
export function setToggleLabel(dom, expanded) {
  const top = dom.toggleBtn.querySelector(".btn-osu-big__text-top");
  if (top) {
    top.textContent = expanded ? "Hide beatmap preview" : "Beatmap Preview";
  }
}

/**
 * @param {PreviewDom} dom
 * @param {string} text
 */
export function setStatus(dom, text) {
  dom.statusEl.textContent = text || "";
}
