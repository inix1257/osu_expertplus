/*
 * Frozen copy of the BBCode helper that lived in src/pages/user-profile.js
 * before WS-40 (snapshot of 7e10692). Read by test/osu/legacy.mjs
 * (legacySource) so the src/editor golden, textarea and placement tests keep
 * comparing against the old behaviour. Not loaded by the userscript; do not
 * edit.
 */

  const BBHELP_STYLE_ID = "osu-expertplus-userpage-bbcode-helper";
  const BBHELP_WRAP_CLASS = "oep-bbhelp";
  const BBHELP_ROW_CLASS = "oep-bbhelp__row";
  const BBHELP_BTN_CLASS = "oep-bbhelp__btn";
  const BBHELP_BTN_ICON_CLASS = "oep-bbhelp__btn-icon";
  const BBHELP_BTN_TEXT_CLASS = "oep-bbhelp__btn-text";
  const BBHELP_MODAL_CLASS = "oep-bbhelp-modal";
  const BBHELP_EDITOR_ID_ATTR = "data-oep-bbhelp-editor-id";
  const BBHELP_WRAP_FOR_ATTR = "data-oep-bbhelp-for";
  const BBHELP_DONE_ATTR = "data-oep-bbhelp";
  const BBHELP_CHECKER_DONE_ATTR = "data-oep-bbhelp-checker";
  const BBHELP_PREVIEW_DONE_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_TOGGLE_ATTR = "data-oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_ATTR = "data-oep-bbhelp-preview";
  const BBHELP_PREVIEW_BODY_CLASS = "oep-bbhelp-preview__body";
  const BBHELP_PREVIEW_TOGGLE_CLASS = "oep-bbhelp-preview-toggle";
  const BBHELP_PREVIEW_CLASS = "oep-bbhelp-preview";
  const BBHELP_PREVIEW_TITLE_CLASS = "oep-bbhelp-preview__title";
  const BBHELP_PREVIEW_EMPTY_CLASS = "oep-bbhelp-preview__empty";
  const BBHELP_WARN_CLASS = "oep-bbhelp-warn";
  const BBHELP_EDITOR_SELECTOR = ".bbcode-editor";
  const BBHELP_INPUT_SELECTOR = "textarea";

  const BBHELP_CSS = `
    .${BBHELP_WRAP_CLASS} {
      margin: 0 0 10px;
      display: block;
    }
    .${BBHELP_ROW_CLASS} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .${BBHELP_BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.9);
      font: inherit;
      font-weight: 600;
      font-size: 12px;
      line-height: 1;
      padding: 6px 8px;
      cursor: pointer;
    }
    .${BBHELP_BTN_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(255, 255, 255, 0.1);
    }
    .${BBHELP_BTN_ICON_CLASS} {
      width: 12px;
      text-align: center;
      opacity: 0.92;
    }
    .${BBHELP_BTN_TEXT_CLASS} {
      white-space: nowrap;
    }
    .${BBHELP_MODAL_CLASS} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
    .${BBHELP_MODAL_CLASS}__card {
      width: min(420px, 100%);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: #1f1f2a;
      color: rgba(255, 255, 255, 0.95);
      padding: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS}__title {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 700;
    }
    .${BBHELP_MODAL_CLASS}__modes {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .${BBHELP_MODAL_CLASS}__field {
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS}__hint {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_MODAL_CLASS} select,
    .${BBHELP_MODAL_CLASS} input[type="number"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS}__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn {
      margin-right: auto;
      min-width: 0;
      max-width: 100%;
      font-size: 12px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.62);
    }
    .${BBHELP_MODAL_CLASS}__actions-warn:empty {
      display: none;
    }
    .${BBHELP_MODAL_CLASS}__actions-warn--error {
      color: rgba(255, 196, 120, 0.95);
    }
    .${BBHELP_MODAL_CLASS}__actions-btns {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }
    .${BBHELP_MODAL_CLASS} .${BBHELP_BTN_CLASS}:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .${BBHELP_MODAL_CLASS}__color-grid {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .${BBHELP_MODAL_CLASS} input[type="color"] {
      width: 56px;
      height: 36px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    .${BBHELP_MODAL_CLASS} input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 6px 8px;
    }
    .${BBHELP_MODAL_CLASS} textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      font: inherit;
      padding: 8px;
      line-height: 1.4;
    }
    .${BBHELP_MODAL_CLASS}__swatch {
      width: 100%;
      height: 14px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: #ff66aa;
      margin-top: 8px;
    }
    .${BBHELP_WARN_CLASS} {
      margin-top: 8px;
      border-left: 3px solid #f0ad4e;
      background: rgba(240, 173, 78, 0.12);
      color: #ffd28a;
      font-size: 12px;
      line-height: 1.35;
      padding: 6px 8px;
    }
    .${BBHELP_WARN_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS} {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.92);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 9px;
      cursor: pointer;
      margin-right: 8px;
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}:hover {
      border-color: rgba(255, 255, 255, 0.32);
      background: rgba(255, 255, 255, 0.14);
    }
    .${BBHELP_PREVIEW_TOGGLE_CLASS}[aria-pressed="true"] {
      border-color: rgba(255, 255, 255, 0.38);
      background: rgba(255, 255, 255, 0.2);
    }
    .${BBHELP_PREVIEW_CLASS} {
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      padding: 10px;
      color: rgba(255, 255, 255, 0.9);
    }
    .${BBHELP_PREVIEW_CLASS}[hidden] {
      display: none !important;
    }
    .${BBHELP_PREVIEW_TITLE_CLASS} {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: rgba(255, 255, 255, 0.72);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} {
      line-height: 1.55;
      word-break: break-word;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p {
      margin: 0 0 0.7em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} blockquote {
      margin: 0 0 0.7em;
      padding-left: 0.8em;
      border-left: 3px solid rgba(255, 255, 255, 0.26);
      color: rgba(255, 255, 255, 0.82);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoilerbox {
      margin: 0 0 0.65em;
      border: none;
      border-radius: 0;
      background: transparent;
      overflow: visible;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary {
      cursor: pointer;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2em 0.35em;
      list-style: none;
      margin: 0;
      padding: 0;
      max-width: 100%;
      font-weight: 700;
      color: hsl(var(--hsl-l2));
      background: none;
      border: none;
      -webkit-appearance: none;
      appearance: none;
      outline: none;
      text-align: left;
      width: max-content;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary:hover {
      color: hsl(var(--hsl-l1));
      text-decoration: underline;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoiler-summary::-webkit-details-marker {
      display: none;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon {
      display: block;
      flex: none;
      width: 1.1em;
      text-align: center;
      line-height: 1;
      opacity: 0.9;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-icon::before {
      display: inline-block;
      font-family: "Font Awesome 5 Free", "Font Awesome 6 Free", sans-serif;
      font-weight: 900;
      content: "\\f105";
      font-size: 0.95em;
      transition: transform 0.12s ease;
    }
    .${BBHELP_PREVIEW_BODY_CLASS}
      .oep-bbhelp-preview__spoilerbox[open]
      .oep-bbhelp-preview__spoiler-icon::before {
      content: "\\f107";
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-label {
      overflow-wrap: anywhere;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body {
      margin-top: 10px;
      padding-left: 20px;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-body > p:first-child {
      margin-top: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__spoiler-summary--icon-only {
      min-width: 1.25em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice {
      margin: 0 0 0.7em;
      padding: 10px 12px;
      border: 1px solid hsl(var(--hsl-h1));
      border-radius: 6px;
      background: hsl(var(--hsl-b4));
      color: hsl(var(--hsl-c1));
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__notice > p:last-child {
      margin-bottom: 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre,
    .${BBHELP_PREVIEW_BODY_CLASS} code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.92em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} pre {
      margin: 0 0 0.7em;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(0, 0, 0, 0.25);
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} ul,
    .${BBHELP_PREVIEW_BODY_CLASS} ol {
      margin: 0 0 0.7em;
      padding-left: 1.35em;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} img {
      max-width: min(100%, 520px);
      height: auto;
      border-radius: 4px;
      display: block;
      margin: 0.3em 0;
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap {
      margin: 0 0 0.7em;
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.16);
    }
    .${BBHELP_PREVIEW_BODY_CLASS} .oep-bbhelp-preview__imagemap-meta {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
      line-height: 1.4;
    }
    .${BBHELP_PREVIEW_EMPTY_CLASS} {
      color: rgba(255, 255, 255, 0.62);
      font-style: italic;
      margin: 0;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect {
      position: absolute;
      box-sizing: border-box;
      border: 2px solid rgba(255, 180, 0, 0.85);
      background: rgba(255, 180, 0, 0.14);
      pointer-events: auto;
      cursor: pointer;
      border-radius: 2px;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--selected {
      border-color: rgba(120, 200, 255, 0.95);
      background: rgba(120, 200, 255, 0.2);
      box-shadow: 0 0 0 1px rgba(120, 200, 255, 0.45);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-row--selected {
      border-color: rgba(120, 200, 255, 0.55) !important;
      background: rgba(120, 200, 255, 0.1) !important;
      box-shadow: inset 0 0 0 1px rgba(120, 200, 255, 0.25);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-rect--movable {
      cursor: move;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle {
      position: absolute;
      width: 11px;
      height: 11px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.95);
      background: rgba(120, 200, 255, 0.95);
      border-radius: 2px;
      z-index: 2;
      pointer-events: auto;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--nw {
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--ne {
      left: 100%;
      top: 0;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--sw {
      left: 0;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nesw-resize;
    }
    .${BBHELP_MODAL_CLASS} .oep-imap-handle--se {
      left: 100%;
      top: 100%;
      transform: translate(-50%, -50%);
      cursor: nwse-resize;
    }
  `;

  const bbcodeStyle = manageStyle(BBHELP_STYLE_ID, BBHELP_CSS);

  function injectBbcodeHelperStyles() {
    bbcodeStyle.inject();
  }

  function removeBbcodeHelperStyles() {
    bbcodeStyle.remove();
  }

  function _replaceTextareaRange(textarea, from, to, replacement) {
    textarea.focus();
    textarea.setSelectionRange(from, to);
    let usedNativeUndoPath = false;
    try {
      if (typeof document.execCommand === "function") {
        usedNativeUndoPath = document.execCommand(
          "insertText",
          false,
          replacement,
        );
      }
    } catch (_) {}
    if (!usedNativeUndoPath) {
      textarea.setRangeText(replacement, from, to, "end");
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function _toggleBbcodeWrap(textarea, openTag, closeTag) {
    const value = textarea.value || "";
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const hasSelection = end > start;

    const selected = value.slice(start, end);
    const selectedIsWrapped =
      selected.startsWith(openTag) && selected.endsWith(closeTag);
    const aroundSelectionIsWrapped =
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(end, end + closeTag.length) === closeTag;
    const aroundCursorIsWrapped =
      !hasSelection &&
      start >= openTag.length &&
      value.slice(start - openTag.length, start) === openTag &&
      value.slice(start, start + closeTag.length) === closeTag;

    let nextStart = start;
    let nextEnd;

    if (hasSelection && selectedIsWrapped) {
      const inner = selected.slice(
        openTag.length,
        selected.length - closeTag.length,
      );
      _replaceTextareaRange(textarea, start, end, inner);
      nextEnd = start + inner.length;
    } else if (hasSelection && aroundSelectionIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        end + closeTag.length,
        selected,
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart + selected.length;
    } else if (aroundCursorIsWrapped) {
      _replaceTextareaRange(
        textarea,
        start - openTag.length,
        start + closeTag.length,
        "",
      );
      nextStart = start - openTag.length;
      nextEnd = nextStart;
    } else {
      _replaceTextareaRange(
        textarea,
        start,
        end,
        `${openTag}${selected}${closeTag}`,
      );
      if (hasSelection) {
        nextStart = start + openTag.length;
        nextEnd = nextStart + selected.length;
      } else {
        nextStart = start + openTag.length;
        nextEnd = nextStart;
      }
    }

    textarea.setSelectionRange(nextStart, nextEnd);
  }

  function _openColorPicker(textarea) {
    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font color",
    );

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
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const updateSwatch = () => {
      const v = String(textInput.value || "").trim();
      swatch.style.background = v || "#ff66aa";
    };
    const close = () => overlay.remove();
    const apply = () => {
      const value = String(textInput.value || "").trim();
      if (!value) return;
      _toggleBbcodeWrap(textarea, `[color=${value}]`, "[/color]");
      close();
    };

    colorInput.addEventListener("input", () => {
      textInput.value = colorInput.value;
      updateSwatch();
    });
    textInput.addEventListener("input", updateSwatch);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(colorGrid);
    card.appendChild(swatch);
    card.appendChild(hint);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    textInput.focus();
    textInput.select();
    updateSwatch();
  }

  function _openSizePicker(textarea) {
    const uid = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const modeName = `oep-size-mode-${uid}`;
    const modePresetId = `oep-size-mode-preset-${uid}`;
    const modeManualId = `oep-size-mode-manual-${uid}`;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", { class: `${BBHELP_MODAL_CLASS}__card` });
    const title = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title` },
      "Font size",
    );
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
      el("option", { value: "tiny" }, "tiny"),
      el("option", { value: "small" }, "small"),
      el("option", { value: "normal", selected: "selected" }, "normal"),
      el("option", { value: "large" }, "large"),
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
    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const applyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply",
    );
    actions.appendChild(cancelBtn);
    actions.appendChild(applyBtn);

    const close = () => overlay.remove();
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
      _toggleBbcodeWrap(textarea, `[size=${sizeValue}]`, "[/size]");
      close();
    };

    presetRadio.addEventListener("change", syncMode);
    manualRadio.addEventListener("change", syncMode);
    cancelBtn.addEventListener("click", close);
    applyBtn.addEventListener("click", apply);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) close();
    });
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") apply();
    });

    card.appendChild(title);
    card.appendChild(modeWrap);
    card.appendChild(presetField);
    card.appendChild(manualField);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    syncMode();
  }

  function _openImagemapHelper(textarea) {
    // State
    const hotspots = []; // { x, y, w, h, url, title }
    let imgLoaded = false;
    let drawState = null; // { startX, startY, rectEl } — active drag
    let selectedHotspotIndex = -1;
    /** @type {null | { index: number, sx: number, sy: number }} */
    let pendingRectPick = null;
    /**
     * @type {null | {
     *   type: 'move' | 'resize';
     *   index: number;
     *   corner?: string;
     *   startPt: { x: number; y: number };
     *   startHs: { x: number; y: number; w: number; h: number };
     *   rectEl: HTMLElement;
     * }}
     */
    let modifyState = null;
    const IMAP_DRAG_THRESHOLD_PX = 5;
    const IMAP_MIN_RECT_PCT = 1;

    const overlay = el("div", { class: BBHELP_MODAL_CLASS });
    const card = el("div", {
      class: `${BBHELP_MODAL_CLASS}__card`,
      style:
        "width:min(700px,96vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:12px;",
    });

    const titleRow = el("div", {
      style:
        "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;",
    });
    const titleEl = el(
      "h4",
      { class: `${BBHELP_MODAL_CLASS}__title`, style: "margin:0;" },
      "ImageMap Helper",
    );
    const importFromEditorBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title:
          "Auto: replace state from an [imagemap] block in the BBCode editor (uses selection if any, otherwise full text)",
      },
      "Import from editor",
    );
    const importManualBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Show a field to paste [imagemap] BBCode manually",
      },
      "Manual import",
    );
    const importBtnsWrap = el(
      "div",
      {
        style: "display:flex;flex-wrap:wrap;gap:6px;align-items:center;",
      },
      importFromEditorBtn,
      importManualBtn,
    );
    titleRow.appendChild(titleEl);
    titleRow.appendChild(importBtnsWrap);

    let manualImportOpen = false;
    const manualImportPanel = el("div", {
      style: "display:none;flex-direction:column;gap:8px;",
    });
    const manualImportHint = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__hint`, style: "margin:0;" },
      "Paste a full [imagemap]…[/imagemap] block. Tags are required so the parser can find the body.",
    );
    const manualImportTa = el("textarea", {
      rows: 10,
      style:
        "min-height:140px;resize:vertical;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;font-size:11px;",
      "aria-label": "Manual imagemap BBCode",
      placeholder:
        "[imagemap]\nhttps://example.com/image.png\n0 0 25 25 https://osu.ppy.sh\n[/imagemap]",
    });
    const manualImportActions = el("div", {
      style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center;",
    });
    const manualImportApplyBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Apply pasted import",
    );
    const manualImportCloseBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Close",
    );
    manualImportActions.appendChild(manualImportApplyBtn);
    manualImportActions.appendChild(manualImportCloseBtn);
    manualImportPanel.appendChild(manualImportHint);
    manualImportPanel.appendChild(manualImportTa);
    manualImportPanel.appendChild(manualImportActions);

    // Image URL row
    const urlInput = el("input", {
      type: "text",
      placeholder: "https://i.ppy.sh/... (base image URL)",
      style: "flex:1;min-width:0;",
      "aria-label": "Base image URL",
    });
    const loadBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Load",
    );
    const urlRow = el(
      "div",
      { style: "display:flex;gap:6px;" },
      urlInput,
      loadBtn,
    );

    // Image preview + drawing layer.
    // Border/background live on imgWrap; imgStage (no border) shrink-wraps the
    // img so drawLayer inset:0 matches the bitmap box. BBCode % = that box.
    const imgEl = el("img", {
      alt: "",
      referrerpolicy: "no-referrer",
      style:
        "display:none;max-width:100%;height:auto;vertical-align:top;pointer-events:none;user-select:none;border-radius:3px;",
    });
    const drawLayer = el("div", {
      style:
        "position:absolute;inset:0;cursor:crosshair;display:none;touch-action:none;",
    });
    const imgStage = el(
      "div",
      {
        style:
          "position:relative;display:inline-block;line-height:0;max-width:100%;vertical-align:top;",
      },
      imgEl,
      drawLayer,
    );
    const imgPlaceholder = el(
      "div",
      {
        style:
          "font-size:12px;opacity:0.45;padding:16px;text-align:center;pointer-events:none;",
      },
      "Image will appear here after loading",
    );
    const imgWrap = el(
      "div",
      {
        style:
          "display:inline-block;max-width:100%;vertical-align:top;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px dashed rgba(255,255,255,0.2);border-radius:4px;overflow:hidden;",
      },
      imgPlaceholder,
      imgStage,
    );
    const imgScrollSection = el("div", {
      style:
        "min-height:0;flex-shrink:1;align-self:stretch;width:100%;max-height:min(48vh,480px);overflow:auto;border-radius:4px;text-align:center;padding:2px;box-sizing:border-box;",
    });
    imgScrollSection.appendChild(imgWrap);

    const hotspotListEl = el("div", {
      style: "display:flex;flex-direction:column;gap:5px;",
    });

    function formatBbcodeForSingleLineDisplay(multiline) {
      if (!multiline) return "";
      return String(multiline).replace(/\r?\n/g, " ").trim();
    }

    const codeEl = el("div", {
      role: "textbox",
      "aria-readonly": "true",
      "aria-label": "Generated BBCode preview",
      style:
        "flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.14);border-radius:4px;padding:8px 10px;font-size:11px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;color:rgba(255,255,255,0.9);text-align:left;",
    });
    const copyCodeBtn = el(
      "button",
      {
        type: "button",
        class: BBHELP_BTN_CLASS,
        title: "Copy full BBCode (with line breaks) to clipboard",
        style: "flex-shrink:0;align-self:stretch;",
      },
      "Copy",
    );
    const codeRow = el(
      "div",
      {
        style:
          "display:flex;align-items:stretch;gap:8px;min-width:0;width:100%;",
      },
      codeEl,
      copyCodeBtn,
    );

    const cancelBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Cancel",
    );
    const insertBtn = el(
      "button",
      { type: "button", class: BBHELP_BTN_CLASS },
      "Insert into editor",
    );
    const actionsWarn = el("div", {
      class: `${BBHELP_MODAL_CLASS}__actions-warn`,
      role: "status",
    });
    const actionsBtns = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions-btns` },
      cancelBtn,
      insertBtn,
    );
    const actions = el(
      "div",
      { class: `${BBHELP_MODAL_CLASS}__actions` },
      actionsWarn,
      actionsBtns,
    );

    // osu-web BBCodeFromDB::parseImagemap only matches link lines when the URL is
    // `#`, `http(s)://…` (no spaces), or `mailto:…` — see ppy/osu-web.

    function formatImapPct(v) {
      const n = Math.max(0, Math.min(100, Number(v)));
      const r = Math.round(n * 100) / 100;
      return String(r.toFixed(2)).replace(/\.?0+$/, "");
    }

    function normalizeImapLinkUrlForOsu(raw) {
      const u = String(raw || "").trim();
      if (!u) return null;
      if (u === "#") return "#";
      if (/^https?:\/\/\S+$/i.test(u)) return u;
      if (/^mailto:\S+$/i.test(u)) return u;
      if (u.startsWith("//")) return `https:${u}`;
      if (u.startsWith("/")) return `https://osu.ppy.sh${u}`;
      return null;
    }

    function parseImagemapFromText(text) {
      const m = String(text || "").match(
        /\[imagemap\]\s*([\s\S]*?)\s*\[\/imagemap\]/i,
      );
      if (!m) return null;
      const rawBody = m[1].replace(/\r\n/g, "\n").trim();
      if (!rawBody) return null;
      const lines = rawBody
        .split("\n")
        .map((l) => l.trim())
        .filter((ln) => ln.length > 0);
      if (!lines.length) return null;
      const imageUrl = lines[0];
      const areas = [];
      for (let li = 1; li < lines.length; li++) {
        const line = lines[li];
        const rm = line.match(
          /^([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s+(\S+)(?:\s+(.*))?$/,
        );
        if (!rm) continue;
        const x = Number(rm[1]);
        const y = Number(rm[2]);
        const w = Number(rm[3]);
        const h = Number(rm[4]);
        if (![x, y, w, h].every((n) => Number.isFinite(n))) continue;
        areas.push({
          x: Math.max(0, Math.min(100, x)),
          y: Math.max(0, Math.min(100, y)),
          w: Math.max(0, Math.min(100, w)),
          h: Math.max(0, Math.min(100, h)),
          url: rm[5],
          title: (rm[6] || "").trim(),
        });
      }
      return { imageUrl, areas };
    }

    function applyParsedImagemap(parsed) {
      hotspots.length = 0;
      parsed.areas.forEach((ar) => hotspots.push({ ...ar }));
      urlInput.value = parsed.imageUrl;
      selectedHotspotIndex = -1;
      rebuildHotspotList();
      renderOverlayRects();
      refreshCode();
      loadImage();
    }

    function setManualImportOpen(open) {
      manualImportOpen = open;
      manualImportPanel.style.display = open ? "flex" : "none";
      importManualBtn.textContent = open
        ? "Hide manual import"
        : "Manual import";
      if (open) manualImportTa.focus();
    }

    function setSelectedIndex(i) {
      const next = i >= 0 && i < hotspots.length ? i : -1;
      if (next !== selectedHotspotIndex) {
        selectedHotspotIndex = next;
        renderOverlayRects();
        return;
      }
      selectedHotspotIndex = next;
      syncSelectionVisuals();
    }

    function syncSelectionVisuals() {
      hotspotListEl.querySelectorAll("[data-oep-imap-row]").forEach((row) => {
        const idx = Number(row.getAttribute("data-oep-imap-row"));
        row.classList.toggle(
          "oep-imap-row--selected",
          idx === selectedHotspotIndex,
        );
      });
      drawLayer.querySelectorAll("[data-oep-imap-rect]").forEach((el) => {
        const idx = Number(el.getAttribute("data-oep-imap-rect"));
        el.classList.toggle(
          "oep-imap-rect--selected",
          idx === selectedHotspotIndex,
        );
      });
    }

    function focusHotspotUrlInput(index) {
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(index)}"]`,
      );
      if (!(row instanceof HTMLElement)) return;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const urlField = row.querySelector("input[data-oep-imap-url]");
      if (urlField instanceof HTMLInputElement) {
        urlField.focus();
        urlField.select();
      }
    }

    function generateBbcode() {
      const imgUrl = String(urlInput.value || "").trim();
      if (!imgUrl) return "";
      const valid = hotspots
        .map((hs) => ({
          hs,
          link: normalizeImapLinkUrlForOsu(hs.url),
        }))
        .filter((o) => o.link);
      if (!valid.length) return "";
      const lines = [imgUrl];
      valid.forEach(({ hs, link }) => {
        const { x, y, w, h, title } = hs;
        let line = `${formatImapPct(x)} ${formatImapPct(y)} ${formatImapPct(w)} ${formatImapPct(h)} ${link}`;
        const t = String(title || "").trim();
        if (t) line += ` ${t}`;
        lines.push(line);
      });
      return `[imagemap]\n${lines.join("\n")}\n[/imagemap]`;
    }

    copyCodeBtn.addEventListener("click", async () => {
      const text = generateBbcode();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (_) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px;top:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch (_) {
          return;
        }
      }
      const prev = copyCodeBtn.textContent;
      copyCodeBtn.textContent = "Copied!";
      window.setTimeout(() => {
        copyCodeBtn.textContent = prev;
      }, 1600);
    });

    function refreshCode() {
      const code = generateBbcode();
      insertBtn.disabled = !code;
      actionsWarn.classList.remove(
        `${BBHELP_MODAL_CLASS}__actions-warn--error`,
      );
      if (code) {
        codeEl.textContent = formatBbcodeForSingleLineDisplay(code);
        copyCodeBtn.disabled = false;
        actionsWarn.textContent = "";
        return;
      }
      codeEl.textContent = "";
      copyCodeBtn.disabled = true;
      const anyArea = hotspots.length > 0;
      const anyTextUrl = hotspots.some((hs) => String(hs.url || "").trim());
      const accepted = hotspots.some((hs) =>
        normalizeImapLinkUrlForOsu(hs.url),
      );
      if (anyArea && anyTextUrl && !accepted) {
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "osu! rejects these URLs — use https://…, mailto:…, #, //…, or a path like /users/123.";
        return;
      }
      actionsWarn.textContent =
        "Add an image URL, load it, draw areas, and set a valid link on each row to enable insert.";
    }

    function clampImapRect(o, minSz = IMAP_MIN_RECT_PCT) {
      let x = o.x;
      let y = o.y;
      let w = Math.max(minSz, o.w);
      let h = Math.max(minSz, o.h);
      x = Math.max(0, Math.min(100 - w, x));
      y = Math.max(0, Math.min(100 - h, y));
      if (x + w > 100) w = 100 - x;
      if (y + h > 100) h = 100 - y;
      w = Math.max(minSz, w);
      h = Math.max(minSz, h);
      return { x, y, w, h };
    }

    function computeResizeRect(corner, s, pt, minSz = IMAP_MIN_RECT_PCT) {
      const px = Math.max(0, Math.min(100, pt.x));
      const py = Math.max(0, Math.min(100, pt.y));
      const rx = s.x + s.w;
      const by = s.y + s.h;
      let x = s.x;
      let y = s.y;
      let w = s.w;
      let h = s.h;
      if (corner === "se") {
        x = s.x;
        y = s.y;
        w = px - x;
        h = py - y;
      } else if (corner === "nw") {
        w = Math.max(minSz, rx - px);
        h = Math.max(minSz, by - py);
        x = rx - w;
        y = by - h;
      } else if (corner === "ne") {
        x = s.x;
        y = Math.min(py, by - minSz);
        w = Math.max(minSz, px - x);
        h = by - y;
      } else if (corner === "sw") {
        x = Math.min(px, rx - minSz);
        y = s.y;
        w = rx - x;
        h = Math.max(minSz, py - y);
      }
      return clampImapRect({ x, y, w, h }, minSz);
    }

    function applyHsToRectEl(rectEl, hs) {
      Object.assign(rectEl.style, {
        left: `${formatImapPct(hs.x)}%`,
        top: `${formatImapPct(hs.y)}%`,
        width: `${formatImapPct(hs.w)}%`,
        height: `${formatImapPct(hs.h)}%`,
      });
    }

    function updateRowCoordBadge(i) {
      const hs = hotspots[i];
      if (!hs) return;
      const row = hotspotListEl.querySelector(
        `[data-oep-imap-row="${String(i)}"]`,
      );
      const badge = row?.querySelector("[data-oep-imap-coords]");
      if (badge) {
        badge.textContent = `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`;
      }
    }

    function finishModifyGesture() {
      modifyState = null;
      pendingRectPick = null;
      renderOverlayRects();
      rebuildHotspotList();
      refreshCode();
    }

    function onModifyMouseMove(ev) {
      if (!modifyState || !imgLoaded) return;
      const bounds = imgEl.getBoundingClientRect();
      const pt = pctRawFromEvent(ev, bounds);
      if (!pt) return;
      const hs = hotspots[modifyState.index];
      if (!hs) return;
      if (modifyState.type === "move") {
        const dx = pt.x - modifyState.startPt.x;
        const dy = pt.y - modifyState.startPt.y;
        const next = clampImapRect({
          x: modifyState.startHs.x + dx,
          y: modifyState.startHs.y + dy,
          w: modifyState.startHs.w,
          h: modifyState.startHs.h,
        });
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      } else if (modifyState.type === "resize" && modifyState.corner) {
        const next = computeResizeRect(
          modifyState.corner,
          modifyState.startHs,
          pt,
        );
        Object.assign(hs, next);
        applyHsToRectEl(modifyState.rectEl, hs);
        updateRowCoordBadge(modifyState.index);
      }
    }

    function renderOverlayRects() {
      Array.from(drawLayer.querySelectorAll(".oep-imap-rect")).forEach((n) =>
        n.remove(),
      );
      hotspots.forEach((hs, i) => {
        const isSel = i === selectedHotspotIndex;
        const rectEl = el("div", {
          class: `oep-imap-rect${isSel ? " oep-imap-rect--movable" : ""}`,
          "data-oep-imap-rect": String(i),
          style: `left:${formatImapPct(hs.x)}%;top:${formatImapPct(hs.y)}%;width:${formatImapPct(hs.w)}%;height:${formatImapPct(hs.h)}%;`,
        });
        rectEl.addEventListener("mousedown", (ev) => {
          if (ev.button !== 0) return;
          if (
            ev.target instanceof Element &&
            ev.target.closest(".oep-imap-handle")
          ) {
            return;
          }
          ev.preventDefault();
          ev.stopPropagation();
          setSelectedIndex(i);
          pendingRectPick = {
            index: i,
            sx: ev.clientX,
            sy: ev.clientY,
          };
        });
        if (isSel) {
          for (const corner of ["nw", "ne", "sw", "se"]) {
            const handle = el("div", {
              class: `oep-imap-handle oep-imap-handle--${corner}`,
              "data-oep-corner": corner,
            });
            handle.addEventListener("mousedown", (ev) => {
              if (ev.button !== 0) return;
              ev.preventDefault();
              ev.stopPropagation();
              pendingRectPick = null;
              setSelectedIndex(i);
              modifyState = {
                type: "resize",
                index: i,
                corner,
                startPt: pctRawFromEvent(ev, imgEl.getBoundingClientRect()) ?? {
                  x: 0,
                  y: 0,
                },
                startHs: {
                  x: hs.x,
                  y: hs.y,
                  w: hs.w,
                  h: hs.h,
                },
                rectEl,
              };
            });
            rectEl.appendChild(handle);
          }
        }
        drawLayer.appendChild(rectEl);
      });
      syncSelectionVisuals();
    }

    function buildHotspotRow(hs, index) {
      const indexBadge = el(
        "span",
        {
          style:
            "font-size:11px;font-weight:700;opacity:0.6;min-width:1.6em;text-align:right;flex-shrink:0;",
        },
        `#${index + 1}`,
      );
      const coordBadge = el(
        "span",
        {
          style:
            "font-size:10px;font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;opacity:0.55;white-space:nowrap;flex-shrink:0;",
          "data-oep-imap-coords": "1",
        },
        `${formatImapPct(hs.x)} ${formatImapPct(hs.y)} ${formatImapPct(hs.w)} ${formatImapPct(hs.h)}`,
      );
      const urlIn = el("input", {
        type: "text",
        placeholder: "https://… or /users/… or #",
        value: hs.url || "",
        style: "flex:1;min-width:0;",
        "aria-label": `Area ${index + 1} URL`,
        "data-oep-imap-url": "1",
      });
      urlIn.addEventListener("input", () => {
        hs.url = urlIn.value;
        refreshCode();
      });
      urlIn.addEventListener("focus", () => setSelectedIndex(index));
      const titleIn = el("input", {
        type: "text",
        placeholder: "Title (optional)",
        value: hs.title || "",
        style: "width:130px;flex-shrink:0;",
        "aria-label": `Area ${index + 1} title`,
      });
      titleIn.addEventListener("input", () => {
        hs.title = titleIn.value;
        refreshCode();
      });
      titleIn.addEventListener("focus", () => setSelectedIndex(index));
      const removeBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Remove area",
          style: "padding:4px 7px;flex-shrink:0;",
        },
        "✕",
      );
      removeBtn.addEventListener("click", () => {
        const i = hotspots.indexOf(hs);
        if (i !== -1) hotspots.splice(i, 1);
        if (selectedHotspotIndex === i) selectedHotspotIndex = -1;
        else if (selectedHotspotIndex > i) selectedHotspotIndex -= 1;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
      });
      const row = el(
        "div",
        {
          class: "oep-imap-row",
          "data-oep-imap-row": String(index),
          style:
            "display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:6px 8px;",
        },
        indexBadge,
        coordBadge,
        urlIn,
        titleIn,
        removeBtn,
      );
      row.addEventListener("mousedown", (ev) => {
        const t = ev.target;
        if (t instanceof Element && t.closest("button")) return;
        if (t === urlIn || t === titleIn) return;
        setSelectedIndex(index);
        requestAnimationFrame(() => focusHotspotUrlInput(index));
      });
      return row;
    }

    function rebuildHotspotList() {
      while (hotspotListEl.firstChild)
        hotspotListEl.removeChild(hotspotListEl.firstChild);
      if (!hotspots.length) {
        hotspotListEl.appendChild(
          el(
            "div",
            { style: "font-size:12px;opacity:0.5;font-style:italic;" },
            "No areas yet — click and drag on the image above to add one.",
          ),
        );
        return;
      }
      hotspots.forEach((hs, i) =>
        hotspotListEl.appendChild(buildHotspotRow(hs, i)),
      );
      syncSelectionVisuals();
    }

    function pctRawFromEvent(ev, bounds) {
      if (!bounds.width || !bounds.height) return null;
      return {
        x: ((ev.clientX - bounds.left) / bounds.width) * 100,
        y: ((ev.clientY - bounds.top) / bounds.height) * 100,
      };
    }

    /** Intersect drag box (two corners, possibly outside 0–100%) with the image. */
    function selectionRectFromDragPct(sx, sy, ex, ey) {
      const xLo = Math.min(sx, ex);
      const xHi = Math.max(sx, ex);
      const yLo = Math.min(sy, ey);
      const yHi = Math.max(sy, ey);
      const cxLo = Math.max(0, Math.min(100, xLo));
      const cxHi = Math.max(0, Math.min(100, xHi));
      const cyLo = Math.max(0, Math.min(100, yLo));
      const cyHi = Math.max(0, Math.min(100, yHi));
      return {
        x: cxLo,
        y: cyLo,
        w: Math.max(0, cxHi - cxLo),
        h: Math.max(0, cyHi - cyLo),
      };
    }

    drawLayer.addEventListener("mousedown", (ev) => {
      if (!imgLoaded) return;
      ev.preventDefault();
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const rectEl = el("div", {
        style:
          "position:absolute;box-sizing:border-box;border:2px dashed rgba(255,255,0,0.9);background:rgba(255,255,0,0.1);pointer-events:none;left:0;top:0;width:0;height:0;",
      });
      drawLayer.appendChild(rectEl);
      drawState = { startX: raw.x, startY: raw.y, rectEl };
    });

    const onGlobalMouseMove = (ev) => {
      if (modifyState) {
        onModifyMouseMove(ev);
        return;
      }
      if (pendingRectPick) {
        const d = Math.hypot(
          ev.clientX - pendingRectPick.sx,
          ev.clientY - pendingRectPick.sy,
        );
        if (d > IMAP_DRAG_THRESHOLD_PX) {
          const pi = pendingRectPick.index;
          const bounds = imgEl.getBoundingClientRect();
          const startPt = pctRawFromEvent(
            { clientX: pendingRectPick.sx, clientY: pendingRectPick.sy },
            bounds,
          );
          const rEl = drawLayer.querySelector(
            `[data-oep-imap-rect="${String(pi)}"]`,
          );
          if (startPt && rEl instanceof HTMLElement && hotspots[pi]) {
            modifyState = {
              type: "move",
              index: pi,
              startPt,
              startHs: {
                x: hotspots[pi].x,
                y: hotspots[pi].y,
                w: hotspots[pi].w,
                h: hotspots[pi].h,
              },
              rectEl: rEl,
            };
          }
          pendingRectPick = null;
        }
        return;
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw = pctRawFromEvent(ev, bounds);
      if (!raw) return;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        raw.x,
        raw.y,
      );
      Object.assign(drawState.rectEl.style, {
        left: `${r.x}%`,
        top: `${r.y}%`,
        width: `${r.w}%`,
        height: `${r.h}%`,
      });
    };

    const onGlobalMouseUp = (ev) => {
      if (modifyState) {
        finishModifyGesture();
      } else if (pendingRectPick) {
        const idx = pendingRectPick.index;
        pendingRectPick = null;
        requestAnimationFrame(() => focusHotspotUrlInput(idx));
      }
      if (!drawState) return;
      const bounds = imgEl.getBoundingClientRect();
      const raw =
        bounds.width && bounds.height ? pctRawFromEvent(ev, bounds) : null;
      const endX = raw ? raw.x : drawState.startX;
      const endY = raw ? raw.y : drawState.startY;
      const r = selectionRectFromDragPct(
        drawState.startX,
        drawState.startY,
        endX,
        endY,
      );
      drawState.rectEl.remove();
      drawState = null;
      if (r.w > 1 && r.h > 1) {
        hotspots.push({ x: r.x, y: r.y, w: r.w, h: r.h, url: "", title: "" });
        const newIdx = hotspots.length - 1;
        selectedHotspotIndex = newIdx;
        rebuildHotspotList();
        renderOverlayRects();
        refreshCode();
        requestAnimationFrame(() => focusHotspotUrlInput(newIdx));
      }
    };

    document.addEventListener("mousemove", onGlobalMouseMove);
    document.addEventListener("mouseup", onGlobalMouseUp);

    const loadImage = () => {
      const safe = _sanitizeHttpPreviewUrl(String(urlInput.value || "").trim());
      if (!safe) {
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent =
          "Invalid URL — must start with http:// or https://.";
        return;
      }
      imgLoaded = false;
      imgEl.style.display = "none";
      drawLayer.style.display = "none";
      imgPlaceholder.style.display = "";
      imgPlaceholder.textContent = "Loading…";
      imgEl.onload = () => {
        imgLoaded = true;
        imgPlaceholder.style.display = "none";
        imgEl.style.display = "block";
        // drawLayer is inset:0 over imgEl — show it only after imgEl is visible
        // so its bounding rect is correct from the first mousedown.
        drawLayer.style.display = "";
        refreshCode();
      };
      imgEl.onerror = () => {
        imgLoaded = false;
        imgEl.style.display = "none";
        drawLayer.style.display = "none";
        imgPlaceholder.style.display = "";
        imgPlaceholder.textContent = "Could not load image.";
      };
      imgEl.src = safe;
    };

    loadBtn.addEventListener("click", loadImage);
    urlInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") loadImage();
    });
    urlInput.addEventListener("input", refreshCode);

    importFromEditorBtn.addEventListener("click", () => {
      const v = textarea.value;
      const a = textarea.selectionStart ?? 0;
      const b = textarea.selectionEnd ?? a;
      const sel = a !== b ? v.slice(a, b) : "";
      let parsed = parseImagemapFromText(sel);
      if (!parsed) parsed = parseImagemapFromText(v);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "No [imagemap]…[/imagemap] block found in the selection or editor text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    importManualBtn.addEventListener("click", () => {
      setManualImportOpen(!manualImportOpen);
    });
    manualImportCloseBtn.addEventListener("click", () => {
      setManualImportOpen(false);
    });
    manualImportApplyBtn.addEventListener("click", () => {
      const parsed = parseImagemapFromText(manualImportTa.value);
      if (!parsed) {
        refreshCode();
        actionsWarn.classList.add(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
        actionsWarn.textContent =
          "Could not parse [imagemap]…[/imagemap] from the pasted text.";
        return;
      }
      applyParsedImagemap(parsed);
      setManualImportOpen(false);
    });

    const close = () => {
      document.removeEventListener("mousemove", onGlobalMouseMove);
      document.removeEventListener("mouseup", onGlobalMouseUp);
      overlay.remove();
    };

    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (manualImportOpen) {
        setManualImportOpen(false);
        ev.stopPropagation();
        return;
      }
      close();
    });

    insertBtn.addEventListener("click", () => {
      const code = generateBbcode();
      if (!code) return;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? start;
      _replaceTextareaRange(textarea, start, end, code);
      close();
    });

    card.appendChild(titleRow);
    card.appendChild(manualImportPanel);
    card.appendChild(urlRow);
    card.appendChild(imgScrollSection);
    card.appendChild(hotspotListEl);
    card.appendChild(codeRow);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    rebuildHotspotList();
    refreshCode();
    urlInput.focus();
  }

  function _createBbcodeButtons(textarea) {
    const specs = [
      {
        label: "Bold",
        title: "Bold",
        icon: "fas fa-bold",
        open: "[b]",
        close: "[/b]",
      },
      {
        label: "Italic",
        title: "Italic",
        icon: "fas fa-italic",
        open: "[i]",
        close: "[/i]",
      },
      {
        label: "Underline",
        title: "Underline",
        icon: "fas fa-underline",
        open: "[u]",
        close: "[/u]",
      },
      {
        label: "Strike",
        title: "Strike",
        icon: "fas fa-strikethrough",
        open: "[s]",
        close: "[/s]",
      },
      {
        label: "Heading",
        title: "Heading",
        icon: "fas fa-heading",
        open: "[heading]",
        close: "[/heading]",
      },
      {
        label: "Quote",
        title: "Quote",
        icon: "fas fa-quote-right",
        open: "[quote]",
        close: "[/quote]",
      },
      {
        label: "Code",
        title: "Code",
        icon: "fas fa-code",
        open: "[code]",
        close: "[/code]",
      },
      {
        label: "Spoiler Box",
        title: "Spoiler Box",
        icon: "fas fa-box-open",
        open: "[box]",
        close: "[/box]",
      },
      {
        label: "Color",
        title: "Font color",
        icon: "fas fa-palette",
        onClick: () => _openColorPicker(textarea),
      },
      {
        label: "Size",
        title: "Font size",
        icon: "fas fa-text-height",
        onClick: () => _openSizePicker(textarea),
      },
      {
        label: "Link",
        title: "Link",
        icon: "fas fa-link",
        open: "[url]",
        close: "[/url]",
      },
      {
        label: "Image",
        title: "Image",
        icon: "far fa-image",
        open: "[img]",
        close: "[/img]",
      },
      {
        label: "List",
        title: "List",
        icon: "fas fa-list-ul",
        open: "[list]\n[*]",
        close: "\n[/list]",
      },
      {
        label: "Center",
        title: "Center",
        icon: "fas fa-align-center",
        open: "[centre]",
        close: "[/centre]",
      },
      {
        label: "Right",
        title: "Right",
        icon: "fas fa-align-right",
        open: "[right]",
        close: "[/right]",
      },
    ];

    return specs.map((spec) =>
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: spec.title,
          onclick: () =>
            typeof spec.onClick === "function"
              ? spec.onClick()
              : _toggleBbcodeWrap(textarea, spec.open, spec.close),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} ${spec.icon}` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, spec.label),
      ),
    );
  }

  function _parseBbcodeTagName(rawTag) {
    const s = String(rawTag || "").trim();
    if (!s) return "";
    const noSlash = s.startsWith("/") ? s.slice(1).trim() : s;
    const cutEq = noSlash.split("=")[0].trim();
    const cutSpace = cutEq.split(/\s+/)[0].trim();
    return cutSpace.toLowerCase();
  }

  const KNOWN_BBCODE_TAGS = new Set([
    "b",
    "i",
    "u",
    "s",
    "strike",
    "color",
    "size",
    "spoiler",
    "box",
    "spoilerbox",
    "quote",
    "c",
    "code",
    "centre",
    "right",
    "url",
    "profile",
    "list",
    "*",
    "email",
    "img",
    "imagemap",
    "youtube",
    "audio",
    "heading",
    "notice",
  ]);

  function _firstBbcodeFormatIssue(text) {
    const value = String(text || "");
    /** @type {string[]} */
    const stack = [];
    const selfClosing = new Set(["*"]);
    let i = 0;
    while (i < value.length) {
      const ch = value[i];
      if (ch === "]") {
        return "Unexpected closing bracket `]`.";
      }
      if (ch !== "[") {
        i += 1;
        continue;
      }
      const closeIdx = value.indexOf("]", i + 1);
      if (closeIdx === -1) {
        return "Missing closing bracket `]` for a BBCode tag.";
      }
      const rawTag = value.slice(i + 1, closeIdx).trim();
      if (!rawTag) {
        return "Empty BBCode tag `[]` is invalid.";
      }
      const isClosing = rawTag.startsWith("/");
      const name = _parseBbcodeTagName(rawTag);
      if (!name || !/^[a-z*]+$/.test(name)) {
        return `Invalid tag name in \`[${rawTag}]\`.`;
      }
      // Unknown bracketed text is treated as plain text, not BBCode.
      if (!KNOWN_BBCODE_TAGS.has(name)) {
        i = closeIdx + 1;
        continue;
      }
      if (!isClosing && !selfClosing.has(name)) {
        stack.push(name);
      } else if (isClosing) {
        const expected = stack[stack.length - 1];
        if (!expected) {
          return `Closing tag \`[/${name}]\` has no matching opening tag.`;
        }
        if (expected !== name) {
          return `Mismatched tag order: expected \`[/${expected}]\` before \`[/${name}]\`.`;
        }
        stack.pop();
      }
      i = closeIdx + 1;
    }
    if (stack.length) {
      return `Unclosed tag \`[${stack[stack.length - 1]}]\` found.`;
    }
    return null;
  }

  function _ensureBbcodeFormatChecker(editorEl, textarea) {
    let warnEl = editorEl.querySelector(`:scope > .${BBHELP_WARN_CLASS}`);
    if (!(warnEl instanceof HTMLElement)) {
      warnEl = el("div", { class: BBHELP_WARN_CLASS, hidden: "hidden" });
      textarea.insertAdjacentElement("afterend", warnEl);
    }
    if (textarea.hasAttribute(BBHELP_CHECKER_DONE_ATTR)) return;

    const refresh = () => {
      const issue = _firstBbcodeFormatIssue(textarea.value);
      if (!issue) {
        warnEl.hidden = true;
        warnEl.textContent = "";
        return;
      }
      warnEl.hidden = false;
      warnEl.textContent = `BBCode format warning: ${issue}`;
    };

    textarea.addEventListener("input", refresh);
    textarea.setAttribute(BBHELP_CHECKER_DONE_ATTR, "1");
    refresh();
  }

  function _escapePreviewHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Reverse `_escapePreviewHtml` (renderer input is already escaped). */
  function _unescapePreviewHtml(text) {
    return String(text ?? "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  /** `_sanitizeHttpPreviewUrl` for a URL taken from escaped renderer input. */
  function _sanitizeEscapedPreviewUrl(escapedRaw) {
    return _sanitizeHttpPreviewUrl(_unescapePreviewHtml(escapedRaw));
  }

  function _sanitizeHttpPreviewUrl(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    try {
      const parsed = new URL(src, location.origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return "";
      return parsed.href;
    } catch (_) {
      return "";
    }
  }

  function _matchNoticeOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    if (!/^\[notice\]/i.test(s.slice(i, i + 8))) return null;
    return { fullLen: 8 };
  }

  function _matchNoticeCloseLen(s, i) {
    return /^\[\/notice\]/i.test(s.slice(i, i + 9)) ? 9 : 0;
  }

  function _findBbcodeNoticeCloseRange(s, innerStart) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchNoticeCloseLen(s, i);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchNoticeOpenAt(s, i);
        if (op) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _matchBbcodeBoxOpenAt(s, i) {
    if (i >= s.length || s[i] !== "[") return null;
    const rest = s.slice(i);
    const tags = ["spoilerbox", "spoiler", "box"];
    for (let t = 0; t < tags.length; t += 1) {
      const tag = tags[t];
      const re =
        tag === "spoilerbox"
          ? /^\[spoilerbox(?:=([^\]]*))?\]/i
          : tag === "spoiler"
            ? /^\[spoiler(?:=([^\]]*))?\]/i
            : /^\[box(?:=([^\]]*))?\]/i;
      const m = rest.match(re);
      if (m) {
        return {
          tag,
          titleRaw: String(m[1] ?? "").trim(),
          fullLen: m[0].length,
        };
      }
    }
    return null;
  }

  function _matchBbcodeBoxCloseLen(s, i, tag) {
    const re =
      tag === "spoilerbox"
        ? /^\[\/spoilerbox\]/i
        : tag === "spoiler"
          ? /^\[\/spoiler\]/i
          : /^\[\/box\]/i;
    const m = s.slice(i).match(re);
    return m ? m[0].length : 0;
  }

  function _findFirstBbcodeNestableOpen(s) {
    for (let i = 0; i < s.length; i += 1) {
      const noticeOp = _matchNoticeOpenAt(s, i);
      if (noticeOp) {
        return { kind: "notice", index: i, fullLen: noticeOp.fullLen };
      }
      const boxOp = _matchBbcodeBoxOpenAt(s, i);
      if (boxOp) {
        return {
          kind: "box",
          index: i,
          tag: boxOp.tag,
          titleRaw: boxOp.titleRaw,
          fullLen: boxOp.fullLen,
        };
      }
    }
    return null;
  }

  function _findBbcodeBoxCloseRange(s, innerStart, tag) {
    let i = innerStart;
    let depth = 1;
    while (i < s.length && depth > 0) {
      if (s[i] === "[") {
        const closeLen = _matchBbcodeBoxCloseLen(s, i, tag);
        if (closeLen) {
          depth -= 1;
          if (depth === 0) {
            return { bodyEnd: i, closeEnd: i + closeLen };
          }
          i += closeLen;
          continue;
        }
        const op = _matchBbcodeBoxOpenAt(s, i);
        if (op && op.tag === tag) {
          depth += 1;
          i += op.fullLen;
          continue;
        }
      }
      i += 1;
    }
    return null;
  }

  function _formatBbcodeBoxPreviewHtml(
    tag,
    titleRawFromEscapedSource,
    innerHtml,
  ) {
    const trimmed = String(titleRawFromEscapedSource || "").trim();
    const label = tag === "box" ? trimmed || "Box" : trimmed;
    const labelSpan = label
      ? `<span class="oep-bbhelp-preview__spoiler-label">${label}</span>`
      : "";
    const summaryClass =
      "oep-bbhelp-preview__spoiler-summary" +
      (label ? "" : " oep-bbhelp-preview__spoiler-summary--icon-only");
    const summaryA11y = label ? "" : ' aria-label="Spoiler"';
    return (
      `<details class="oep-bbhelp-preview__spoilerbox">` +
      `<summary class="${summaryClass}"${summaryA11y}>` +
      `<span class="oep-bbhelp-preview__spoiler-icon" aria-hidden="true"></span>` +
      `${labelSpan}` +
      `</summary>` +
      `<div class="oep-bbhelp-preview__spoiler-body">${innerHtml}</div>` +
      `</details>`
    );
  }

  function _replaceBalancedBbcodeNestable(html, renderInner) {
    const first = _findFirstBbcodeNestableOpen(html);
    if (!first) return html;

    if (first.kind === "notice") {
      const start = first.index;
      const fullLen = first.fullLen;
      const range = _findBbcodeNoticeCloseRange(html, start + fullLen);
      if (!range) return html;
      const before = html.slice(0, start);
      const inner = html.slice(start + fullLen, range.bodyEnd);
      const after = html.slice(range.closeEnd);
      const innerHtml = renderInner(inner);
      const block = `<div class="oep-bbhelp-preview__notice">${innerHtml}</div>`;
      return (
        _replaceBalancedBbcodeNestable(before, renderInner) +
        block +
        _replaceBalancedBbcodeNestable(after, renderInner)
      );
    }

    const { index: start, tag, titleRaw, fullLen } = first;
    const range = _findBbcodeBoxCloseRange(html, start + fullLen, tag);
    if (!range) return html;
    const before = html.slice(0, start);
    const inner = html.slice(start + fullLen, range.bodyEnd);
    const after = html.slice(range.closeEnd);
    const innerHtml = renderInner(inner);
    const boxHtml = _formatBbcodeBoxPreviewHtml(tag, titleRaw, innerHtml);
    return (
      _replaceBalancedBbcodeNestable(before, renderInner) +
      boxHtml +
      _replaceBalancedBbcodeNestable(after, renderInner)
    );
  }

  function _finishBbcodePreviewParagraphs(html) {
    const applyLineBreaks = (str) =>
      str.replace(/(<pre\b[\s\S]*?<\/pre>)|\n/g, (m, pre) => pre ?? "<br>");

    return html
      .split(/\n{2,}/)
      .map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        const withBr = applyLineBreaks(trimmed);
        if (/^<(ul|ol|pre|blockquote|h\d|div|details)/i.test(trimmed))
          return withBr;
        return `<p>${withBr}</p>`;
      })
      .join("");
  }

  function _bbcodePreviewCore(escaped) {
    let html = escaped;

    html = html.replace(
      /\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi,
      (_, hrefRaw, labelRaw) => {
        const href = _sanitizeEscapedPreviewUrl(hrefRaw);
        const label = String(labelRaw || "");
        if (!href) return label;
        return `<a href="${_escapePreviewHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      },
    );
    html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_, hrefRaw) => {
      const href = _sanitizeEscapedPreviewUrl(hrefRaw);
      if (!href) return String(hrefRaw || "");
      const label = _escapePreviewHtml(href);
      return `<a href="${label}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(
      /\[imagemap=([^\]]+)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeEscapedPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\(([^)\]]+)\)\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, srcRaw) => {
        const maybeSrc = String(srcRaw || "").trim();
        const srcUrl = _sanitizeEscapedPreviewUrl(maybeSrc);
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(
      /\[imagemap\]([\s\S]*?)\[\/imagemap\]/gi,
      (_, bodyRaw) => {
        const body = String(bodyRaw || "");
        const srcMatch = body.match(
          /https?:\/\/[^\s\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)/i,
        );
        const srcUrl = _sanitizeEscapedPreviewUrl(srcMatch ? srcMatch[0] : "");
        if (!srcUrl) return "";
        return `<div class="oep-bbhelp-preview__imagemap"><img src="${_escapePreviewHtml(srcUrl)}" alt="imagemap preview" loading="lazy" referrerpolicy="no-referrer" /><div class="oep-bbhelp-preview__imagemap-meta">ImageMap base image preview</div></div>`;
      },
    );
    html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, (_, srcRaw) => {
      const srcUrl = _sanitizeEscapedPreviewUrl(srcRaw);
      if (!srcUrl) return "";
      return `<img src="${_escapePreviewHtml(srcUrl)}" alt="preview image" loading="lazy" referrerpolicy="no-referrer" />`;
    });

    const wrapPairs = [
      ["b", "strong"],
      ["i", "em"],
      ["u", "u"],
      ["s", "del"],
      ["strike", "del"],
      ["quote", "blockquote"],
      ["heading", "h3"],
      ["centre", 'div style="text-align:center;"'],
      ["right", 'div style="text-align:right;"'],
    ];
    wrapPairs.forEach(([bb, tag]) => {
      const open = `<${tag}>`;
      const closeTag = tag.split(" ")[0];
      html = html.replace(
        new RegExp(`\\[${bb}\\]([\\s\\S]*?)\\[\\/${bb}\\]`, "gi"),
        `${open}$1</${closeTag}>`,
      );
    });

    html = html.replace(
      /\[color=(.*?)\]([\s\S]*?)\[\/color\]/gi,
      (_, color, body) => {
        const safeColor = String(color || "").trim();
        if (!OsuExpertPlus.htmlSanitize.isSafeColor(safeColor)) {
          return `<span>${body}</span>`;
        }
        return `<span style="color:${safeColor};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[size=(.*?)\]([\s\S]*?)\[\/size\]/gi,
      (_, sizeRaw, body) => {
        const size = String(sizeRaw || "")
          .trim()
          .toLowerCase();
        const presets = {
          tiny: "0.75em",
          small: "0.88em",
          normal: "1em",
          large: "1.2em",
        };
        const pct = Number(size);
        const computed =
          presets[size] ||
          (Number.isFinite(pct)
            ? `${Math.max(30, Math.min(200, pct))}%`
            : "1em");
        return `<span style="font-size:${computed};">${body}</span>`;
      },
    );
    html = html.replace(
      /\[code\]([\s\S]*?)\[\/code\]/gi,
      "<pre><code>$1</code></pre>",
    );

    html = _replaceBalancedBbcodeNestable(html, (body) =>
      _finishBbcodePreviewParagraphs(_bbcodePreviewCore(body)),
    );

    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, body) => {
      const items = String(body || "")
        .split(/\[\*\]/i)
        .map((part) => part.trim())
        .filter(Boolean);
      if (!items.length) return "";
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    });

    html = html.replace(/\[(\/)?[a-z*]+(?:=[^\]]+)?\]/gi, "");

    return html;
  }

  function _renderSimpleBbcodePreviewHtml(src) {
    const raw = String(src ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    if (!raw.trim()) {
      return `<p class="${BBHELP_PREVIEW_EMPTY_CLASS}">Nothing to preview yet.</p>`;
    }
    const escaped = _escapePreviewHtml(raw);
    const html = _bbcodePreviewCore(escaped);
    return _finishBbcodePreviewParagraphs(html);
  }

  function _findCancelActionNode(editorEl, textarea) {
    const scopeRoots = [
      textarea?.closest("form"),
      editorEl.closest("form"),
      editorEl.closest(".js-account-edit, .account-edit, .user-profile-page"),
      editorEl.parentElement,
    ].filter((n) => n instanceof HTMLElement);
    for (const scope of scopeRoots) {
      const candidate = Array.from(scope.querySelectorAll("button, a")).find(
        (n) => {
          if (!(n instanceof HTMLElement)) return false;
          const label = String(n.textContent || "")
            .trim()
            .toLowerCase();
          return label === "cancel";
        },
      );
      if (candidate instanceof HTMLElement) return candidate;
    }
    return null;
  }

  function _ensureBbcodeLivePreview(editorEl, textarea) {
    let previewEnabled = false;
    let repaintTimer = 0;

    let toggleBtn = editorEl.querySelector(`[${BBHELP_PREVIEW_TOGGLE_ATTR}]`);
    if (!(toggleBtn instanceof HTMLButtonElement)) {
      toggleBtn = el(
        "button",
        {
          type: "button",
          class: BBHELP_PREVIEW_TOGGLE_CLASS,
          [BBHELP_PREVIEW_TOGGLE_ATTR]: "1",
          "aria-pressed": "false",
          title: "Toggle live preview",
        },
        "Live preview",
      );
    }

    let preview = editorEl.querySelector(`[${BBHELP_PREVIEW_ATTR}]`);
    if (!(preview instanceof HTMLElement)) {
      preview = el(
        "section",
        {
          class: BBHELP_PREVIEW_CLASS,
          [BBHELP_PREVIEW_ATTR]: "1",
          hidden: "hidden",
        },
        el("p", { class: BBHELP_PREVIEW_TITLE_CLASS }, "Live preview"),
        el("div", { class: BBHELP_PREVIEW_BODY_CLASS }),
      );
      textarea.insertAdjacentElement("afterend", preview);
    }

    const previewBody = preview.querySelector(`.${BBHELP_PREVIEW_BODY_CLASS}`);
    if (!(previewBody instanceof HTMLElement)) return;

    const placeToggle = () => {
      const cancelNode = _findCancelActionNode(editorEl, textarea);
      if (!(cancelNode instanceof HTMLElement)) return;
      const parent = cancelNode.parentElement;
      if (!(parent instanceof HTMLElement)) return;
      if (
        toggleBtn.parentElement !== parent ||
        toggleBtn.nextElementSibling !== cancelNode
      ) {
        cancelNode.insertAdjacentElement("beforebegin", toggleBtn);
      }
    };

    const repaint = () => {
      previewBody.replaceChildren(
        OsuExpertPlus.htmlSanitize.toSafeFragment(
          _renderSimpleBbcodePreviewHtml(textarea.value || ""),
        ),
      );
      preview.hidden = !previewEnabled;
      toggleBtn.setAttribute("aria-pressed", previewEnabled ? "true" : "false");
      placeToggle();
    };
    const repaintSoon = () => {
      window.clearTimeout(repaintTimer);
      repaintTimer = window.setTimeout(repaint, 70);
    };

    if (!textarea.hasAttribute(BBHELP_PREVIEW_DONE_ATTR)) {
      textarea.addEventListener("input", repaintSoon);
      toggleBtn.addEventListener("click", () => {
        previewEnabled = !previewEnabled;
        repaint();
      });
      textarea.setAttribute(BBHELP_PREVIEW_DONE_ATTR, "1");
    } else {
      previewEnabled = toggleBtn.getAttribute("aria-pressed") === "true";
    }

    repaint();
  }

  function _enhanceSingleBbcodeEditor(editorEl) {
    if (!(editorEl instanceof HTMLElement)) return;

    const textarea = editorEl.querySelector(BBHELP_INPUT_SELECTOR);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    _ensureBbcodeFormatChecker(editorEl, textarea);
    _ensureBbcodeLivePreview(editorEl, textarea);
    if (editorEl.hasAttribute(BBHELP_DONE_ATTR)) return;

    let editorId = editorEl.getAttribute(BBHELP_EDITOR_ID_ATTR);
    if (!editorId) {
      editorId = `oep-bbhelp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      editorEl.setAttribute(BBHELP_EDITOR_ID_ATTR, editorId);
    }
    const existingWrap = editorEl.querySelector(
      `:scope > .${BBHELP_WRAP_CLASS}`,
    );
    if (existingWrap) {
      editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
      existingWrap.setAttribute(BBHELP_WRAP_FOR_ATTR, editorId);
      return;
    }

    const wrap = el("div", {
      class: BBHELP_WRAP_CLASS,
      [BBHELP_WRAP_FOR_ATTR]: editorId,
    });
    const row = el("div", { class: BBHELP_ROW_CLASS });
    _createBbcodeButtons(textarea).forEach((btn) => row.appendChild(btn));
    wrap.appendChild(row);

    const row2 = el("div", {
      class: BBHELP_ROW_CLASS,
      style: "margin-top:4px;",
    });
    row2.appendChild(
      el(
        "button",
        {
          type: "button",
          class: BBHELP_BTN_CLASS,
          title: "Open ImageMap helper",
          onclick: () => _openImagemapHelper(textarea),
        },
        el("span", { class: `${BBHELP_BTN_ICON_CLASS} fas fa-map-marked-alt` }),
        el("span", { class: BBHELP_BTN_TEXT_CLASS }, "Imagemap helper"),
      ),
    );
    wrap.appendChild(row2);

    editorEl.insertBefore(wrap, editorEl.firstChild);
    editorEl.setAttribute(BBHELP_DONE_ATTR, "1");
  }

  function _isElementActuallyVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!node.isConnected) return false;
    if (node.hidden) return false;
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (node.getClientRects().length === 0) return false;
    return true;
  }

  function teardownBbcodeHelpers() {
    document
      .querySelectorAll(`.${BBHELP_MODAL_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WARN_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_TOGGLE_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_PREVIEW_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`.${BBHELP_WRAP_CLASS}`)
      .forEach((n) => n.remove());
    document
      .querySelectorAll(`${BBHELP_EDITOR_SELECTOR}[${BBHELP_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_CHECKER_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_CHECKER_DONE_ATTR));
    document
      .querySelectorAll(`${BBHELP_INPUT_SELECTOR}[${BBHELP_PREVIEW_DONE_ATTR}]`)
      .forEach((n) => n.removeAttribute(BBHELP_PREVIEW_DONE_ATTR));
    removeBbcodeHelperStyles();
  }

  /** @returns {function} */
  function startBbcodeHelperManager() {
    injectBbcodeHelperStyles();

    const scan = () => {
      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        const parent = wrap.parentElement;
        if (!(parent instanceof HTMLElement)) return;
        if (!parent.matches(BBHELP_EDITOR_SELECTOR)) wrap.remove();
      });

      document.querySelectorAll(`.${BBHELP_WRAP_CLASS}`).forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        const editorId = wrap.getAttribute(BBHELP_WRAP_FOR_ATTR);
        const editor = editorId
          ? document.querySelector(
              `${BBHELP_EDITOR_SELECTOR}[${BBHELP_EDITOR_ID_ATTR}="${editorId}"]`,
            )
          : null;
        if (
          !(editor instanceof HTMLElement) ||
          !_isElementActuallyVisible(editor)
        ) {
          if (editor instanceof HTMLElement) {
            editor.removeAttribute(BBHELP_DONE_ATTR);
          }
          wrap.remove();
        }
      });
      document.querySelectorAll(BBHELP_EDITOR_SELECTOR).forEach((editorEl) => {
        if (_isElementActuallyVisible(editorEl))
          _enhanceSingleBbcodeEditor(editorEl);
      });
    };

    scan();
    const obs = new MutationObserver((mutations) => {
      if (
        mutationsIncludeSelector(
          mutations,
          `${BBHELP_EDITOR_SELECTOR}, ${BBHELP_EDITOR_SELECTOR} ${BBHELP_INPUT_SELECTOR}`,
        )
      ) {
        scan();
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    return () => {
      obs.disconnect();
      teardownBbcodeHelpers();
    };
  }
