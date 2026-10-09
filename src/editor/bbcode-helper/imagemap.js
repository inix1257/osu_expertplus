/**
 * ImageMap helper modal: draw, move and resize areas over an image and
 * generate an `[imagemap]` block (WS-40).
 */

import { el } from "../../features/legacy.js";
import { BBHELP_BTN_CLASS, BBHELP_MODAL_CLASS } from "./constants.js";
import { _sanitizeHttpPreviewUrl } from "./live-preview.js";
import { _replaceTextareaRange } from "./toolbar.js";

export function _openImagemapHelper(textarea) {
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
      style: "display:flex;align-items:stretch;gap:8px;min-width:0;width:100%;",
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
    importManualBtn.textContent = open ? "Hide manual import" : "Manual import";
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
    actionsWarn.classList.remove(`${BBHELP_MODAL_CLASS}__actions-warn--error`);
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
    const accepted = hotspots.some((hs) => normalizeImapLinkUrlForOsu(hs.url));
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
