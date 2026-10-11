/**
 * Font colour and size picker modals (WS-40).
 */

import { el } from "../../features/legacy.js";
import { isBbcodeColor } from "../bbcode-render.js";
import { toggleWrap } from "../textarea.js";
import { BBHELP_MODAL_CLASS } from "./constants.js";
import {
  bindPickerKeys,
  createBbcodeModal,
  modalButton,
  modalTitle,
} from "./modal.js";

export function openColorPicker(textarea) {
  const modal = createBbcodeModal();
  const { overlay, card } = modal;
  const title = modalTitle("Font color");

  const colorInput = el("input", {
    type: "color",
    value: "#ff66aa",
    "aria-label": "Pick a color",
  });
  const textInput = el("input", {
    type: "text",
    value: "#ff66aa",
    placeholder: "#RRGGBB or color name",
    "aria-label": "Color value",
  });
  const swatch = el("div", { class: `${BBHELP_MODAL_CLASS}__swatch` });
  const colorGrid = el(
    "div",
    { class: `${BBHELP_MODAL_CLASS}__color-grid` },
    colorInput,
    textInput,
  );
  const hint = el(
    "div",
    { class: `${BBHELP_MODAL_CLASS}__hint` },
    "Use picker for hex color, or type a color name (e.g. red).",
  );

  const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
  const cancelBtn = modalButton("Cancel");
  const applyBtn = modalButton("Apply");
  actions.appendChild(cancelBtn);
  actions.appendChild(applyBtn);

  const updateSwatch = () => {
    const v = String(textInput.value || "").trim();
    swatch.style.background = v || "#ff66aa";
  };
  const close = modal.close;
  const hintText = hint.textContent;
  const apply = () => {
    const value = String(textInput.value || "").trim();
    if (!value) return;
    // Only what osu-web renders; anything else stays text once saved (B98).
    if (!isBbcodeColor(value)) {
      textInput.setAttribute("aria-invalid", "true");
      hint.textContent = "Use #RRGGBB or a color name (letters only).";
      textInput.focus();
      return;
    }
    toggleWrap(textarea, `[color=${value}]`, "[/color]");
    close();
  };

  colorInput.addEventListener("input", () => {
    textInput.value = colorInput.value;
    updateSwatch();
  });
  textInput.addEventListener("input", () => {
    textInput.removeAttribute("aria-invalid");
    hint.textContent = hintText;
    updateSwatch();
  });
  cancelBtn.addEventListener("click", close);
  applyBtn.addEventListener("click", apply);
  bindPickerKeys(overlay, { apply, close });

  card.appendChild(title);
  card.appendChild(colorGrid);
  card.appendChild(swatch);
  card.appendChild(hint);
  card.appendChild(actions);
  modal.show();
  textInput.focus();
  textInput.select();
  updateSwatch();
}

export function openSizePicker(textarea) {
  const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const modeName = `oep-size-mode-${uid}`;
  const modePresetId = `oep-size-mode-preset-${uid}`;
  const modeManualId = `oep-size-mode-manual-${uid}`;

  const modal = createBbcodeModal();
  const { overlay, card } = modal;
  const title = modalTitle("Font size");
  const modeWrap = el("div", { class: `${BBHELP_MODAL_CLASS}__modes` });

  const presetRadio = el("input", {
    type: "radio",
    name: modeName,
    id: modePresetId,
    value: "preset",
    checked: "checked",
  });
  const manualRadio = el("input", {
    type: "radio",
    name: modeName,
    id: modeManualId,
    value: "manual",
  });
  modeWrap.appendChild(
    el(
      "label",
      { for: modePresetId },
      presetRadio,
      " Preset (tiny/small/normal/large)",
    ),
  );
  modeWrap.appendChild(
    el("label", { for: modeManualId }, manualRadio, " Manual number"),
  );

  const presetField = el("div", { class: `${BBHELP_MODAL_CLASS}__field` });
  const presetSelect = el(
    "select",
    {},
    // osu-web's editor presets; [size=] takes only numbers (B98).
    el("option", { value: "50" }, "tiny (50)"),
    el("option", { value: "85" }, "small (85)"),
    el("option", { value: "100", selected: "selected" }, "normal (100)"),
    el("option", { value: "150" }, "large (150)"),
  );
  presetField.appendChild(presetSelect);

  const manualField = el("div", {
    class: `${BBHELP_MODAL_CLASS}__field`,
    style: "display:none;",
  });
  const manualInput = el("input", {
    type: "number",
    min: "30",
    max: "200",
    step: "1",
    value: "100",
    placeholder: "30 - 200",
  });
  manualField.appendChild(manualInput);
  manualField.appendChild(
    el("div", { class: `${BBHELP_MODAL_CLASS}__hint` }, "Range: 30-200"),
  );

  const actions = el("div", { class: `${BBHELP_MODAL_CLASS}__actions` });
  const cancelBtn = modalButton("Cancel");
  const applyBtn = modalButton("Apply");
  actions.appendChild(cancelBtn);
  actions.appendChild(applyBtn);

  const close = modal.close;
  const syncMode = () => {
    const isPreset = presetRadio.checked;
    presetField.style.display = isPreset ? "" : "none";
    manualField.style.display = isPreset ? "none" : "";
    if (isPreset) presetSelect.focus();
    else manualInput.focus();
  };
  const apply = () => {
    const sizeValue = presetRadio.checked
      ? String(presetSelect.value || "").trim()
      : String(
          Math.max(
            30,
            Math.min(200, Math.round(Number(manualInput.value) || 0)),
          ),
        );
    if (!sizeValue || sizeValue === "0") return;
    toggleWrap(textarea, `[size=${sizeValue}]`, "[/size]");
    close();
  };

  presetRadio.addEventListener("change", syncMode);
  manualRadio.addEventListener("change", syncMode);
  cancelBtn.addEventListener("click", close);
  applyBtn.addEventListener("click", apply);
  bindPickerKeys(overlay, { apply, close });

  card.appendChild(title);
  card.appendChild(modeWrap);
  card.appendChild(presetField);
  card.appendChild(manualField);
  card.appendChild(actions);
  modal.show();
  syncMode();
}
