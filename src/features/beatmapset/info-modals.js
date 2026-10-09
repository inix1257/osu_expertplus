/**
 * Beatmapset metadata and description modals (WS-33).
 */

import { readBeatmapsetJson } from "../../osu/beatmapset-data.js";
import { el, waitForElement } from "../legacy.js";
import { getBeatmapPageBeatmapId } from "../scoreboard/context.js";
import { bindBbcodeSpoilers } from "./bbcode-spoilers.js";
import { ROOT_CLASS } from "./constants.js";

/**
 * @param {string|undefined|null} s
 */
export function displayText(s) {
  const t = s == null ? "" : String(s).trim();
  return t.length ? t : null;
}

/**
 * @param {string|undefined|null} tagsField
 */
export function parseTags(tagsField) {
  const raw = tagsField == null ? "" : String(tagsField).trim();
  if (!raw) return [];
  return raw.split(/\s+/).filter(Boolean);
}

/** Exact string from the beatmap payload (no trim). */
export function rawTagsFromData(tagsField) {
  if (tagsField == null) return "";
  return String(tagsField);
}

/**
 * HTML string for the beatmapset description (osu-web embeds rendered BBCode in
 * `description.description`).
 * @param {object|null} data
 * @returns {string|null}
 */
export function beatmapsetDescriptionHtmlFromData(data) {
  if (!data) return null;
  const d = data.description;
  if (d == null) return null;
  const html = typeof d === "string" ? d : d.description;
  if (html == null) return null;
  const s = String(html).trim();
  return s.length ? s : null;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * @param {HTMLElement} toastEl
 */
export function flashCopiedToast(toastEl) {
  toastEl.classList.add(`${ROOT_CLASS}__copied-toast--show`);
  const prev = toastEl.getAttribute("data-oep-toast-timer");
  if (prev) window.clearTimeout(Number(prev));
  const id = window.setTimeout(() => {
    toastEl.classList.remove(`${ROOT_CLASS}__copied-toast--show`);
    toastEl.removeAttribute("data-oep-toast-timer");
  }, 1400);
  toastEl.setAttribute("data-oep-toast-timer", String(id));
}

/**
 * @param {typeof el} elFn
 * @param {HTMLElement} parent
 * @param {string} text
 * @param {string} ariaLabel
 */
export function appendCopyButton(elFn, parent, text, ariaLabel) {
  const wrap = elFn("div", { class: `${ROOT_CLASS}__copy-wrap` });
  const toast = elFn(
    "span",
    {
      class: `${ROOT_CLASS}__copied-toast`,
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    },
    "Copied",
  );
  const btn = elFn("button", {
    type: "button",
    class: `${ROOT_CLASS}__copy-btn`,
    "aria-label": ariaLabel,
    title: "Copy",
  });
  const icon = elFn("i", { class: "fas fa-copy", "aria-hidden": "true" });
  btn.appendChild(icon);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(text).then((ok) => {
      if (ok) flashCopiedToast(toast);
    });
  });
  wrap.appendChild(toast);
  wrap.appendChild(btn);
  parent.appendChild(wrap);
}

/**
 * @param {typeof el} elFn
 * @param {string} tag
 */
export function buildTagChip(elFn, tag) {
  const wrap = elFn("div", { class: `${ROOT_CLASS}__tag-wrap` });
  const toast = elFn(
    "span",
    {
      class: `${ROOT_CLASS}__copied-toast`,
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    },
    "Copied",
  );
  const tagBtn = elFn(
    "button",
    {
      type: "button",
      class: `${ROOT_CLASS}__tag`,
      title: "Click to copy this tag",
      "aria-label": `Copy tag "${tag}"`,
    },
    tag,
  );
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(tag).then((ok) => {
      if (ok) flashCopiedToast(toast);
    });
  });
  wrap.appendChild(toast);
  wrap.appendChild(tagBtn);
  return wrap;
}

/**
 * @param {object|null} data
 * @param {typeof el} elFn
 */
export function buildModalBody(data, elFn) {
  if (!data) {
    return elFn(
      "p",
      { class: `${ROOT_CLASS}__err` },
      "Could not read beatmapset data (#json-beatmapset missing or invalid).",
    );
  }

  const frag = document.createDocumentFragment();

  const rows = [
    { label: "Title", value: displayText(data.title) },
    { label: "Title (Unicode)", value: displayText(data.title_unicode) },
    { label: "Artist", value: displayText(data.artist) },
    { label: "Artist (Unicode)", value: displayText(data.artist_unicode) },
    { label: "Source", value: displayText(data.source) },
  ];

  rows.forEach(({ label, value }) => {
    const row = elFn("div", { class: `${ROOT_CLASS}__row` });
    row.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, label));
    const valueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
    valueCell.appendChild(
      elFn(
        "p",
        {
          class: `${ROOT_CLASS}__value${value ? "" : ` ${ROOT_CLASS}__value--muted`}`,
        },
        value || "—",
      ),
    );
    if (value) {
      appendCopyButton(elFn, valueCell, value, `Copy ${label} to clipboard`);
    }
    row.appendChild(valueCell);
    frag.appendChild(row);
  });

  const tagRow = elFn("div", { class: `${ROOT_CLASS}__row` });
  tagRow.appendChild(elFn("div", { class: `${ROOT_CLASS}__label` }, "Tags"));
  const tagValueCell = elFn("div", { class: `${ROOT_CLASS}__value-cell` });
  const tags = parseTags(data.tags);
  const rawTags = rawTagsFromData(data.tags);
  if (tags.length) {
    const tagsWrap = elFn("div", { class: `${ROOT_CLASS}__tags` });
    tags.forEach((tag) => {
      tagsWrap.appendChild(buildTagChip(elFn, tag));
    });
    tagValueCell.appendChild(tagsWrap);
    if (rawTags.length > 0) {
      appendCopyButton(
        elFn,
        tagValueCell,
        rawTags,
        "Copy all tags (original string) to clipboard",
      );
    }
  } else {
    tagValueCell.appendChild(
      elFn(
        "p",
        { class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted` },
        "—",
      ),
    );
  }
  tagRow.appendChild(tagValueCell);
  frag.appendChild(tagRow);

  return frag;
}

/**
 * @param {object|null} data
 * @param {typeof el} elFn
 */
export function buildDescriptionModalBody(data, elFn) {
  if (!data) {
    return elFn(
      "p",
      { class: `${ROOT_CLASS}__err` },
      "Could not read beatmapset data (#json-beatmapset missing or invalid).",
    );
  }

  const html = beatmapsetDescriptionHtmlFromData(data);
  const wrap = elFn("div", {});

  if (!html) {
    wrap.appendChild(
      elFn(
        "p",
        {
          class: `${ROOT_CLASS}__value ${ROOT_CLASS}__value--muted`,
        },
        "No description.",
      ),
    );
    return wrap;
  }

  const toolbar = elFn("div", {
    class: `${ROOT_CLASS}__description-toolbar`,
  });
  const prose = elFn("div", { class: `${ROOT_CLASS}__description-prose` });
  prose.innerHTML = html;
  const plainForCopy = prose.innerText.replace(/\s+$/g, "").trim();
  appendCopyButton(
    elFn,
    toolbar,
    plainForCopy.length ? plainForCopy : html.replace(/<[^>]+>/g, " ").trim(),
    "Copy description to clipboard",
  );
  wrap.appendChild(toolbar);
  wrap.appendChild(prose);
  return wrap;
}

export const DESCRIPTION_BG_SELECTORS = [
  ".beatmapset-description",
  ".beatmapset__description",
  ".beatmapset-info__description",
  ".bbcode--beatmap-description",
  ".bbcode",
];

export function resolveDescriptionSectionBackgroundColor() {
  for (const selector of DESCRIPTION_BG_SELECTORS) {
    const node = document.querySelector(selector);
    if (!node) continue;
    const bg = getComputedStyle(node).backgroundColor;
    if (!bg) continue;
    if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") continue;
    return bg;
  }
  return "hsl(var(--hsl-b4, 333 18% 18%))";
}

/**
 * Modal header control: GET `https://osu.ppy.sh/osu/{beatmapId}` for the selected difficulty and show the file in a new tab.
 * @param {typeof el} elFn
 * @param {() => string|null} getBeatmapId
 */
export function buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapId) {
  const wrap = elFn("div", { class: `${ROOT_CLASS}__modal-header-osu-wrap` });
  const btn = elFn("button", {
    type: "button",
    class: `${ROOT_CLASS}__modal-header-osu-btn`,
    "aria-label": "Open .osu file for current difficulty",
  });
  btn.appendChild(
    elFn("i", { class: "fas fa-file-code", "aria-hidden": "true" }),
  );
  btn.appendChild(document.createTextNode("open .osu"));
  const msgEl = elFn("p", {
    class: `${ROOT_CLASS}__modal-header-osu-msg`,
    "aria-live": "polite",
  });
  wrap.appendChild(btn);
  wrap.appendChild(msgEl);

  let msgResetTimer = 0;
  /**
   * @param {string} msg
   */
  function flashMsg(msg) {
    msgEl.textContent = msg;
    if (msgResetTimer) window.clearTimeout(msgResetTimer);
    msgResetTimer = window.setTimeout(() => {
      msgEl.textContent = "";
      msgResetTimer = 0;
    }, 3200);
  }
  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = getBeatmapId();
    if (!id) {
      flashMsg("Could not detect a beatmap id for this page.");
      return;
    }
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const url = `https://osu.ppy.sh/osu/${encodeURIComponent(id)}`;
      const resp = await OsuExpertPlus.api.siteFetch(url);
      if (!resp.ok) {
        flashMsg(`Could not load .osu (HTTP ${resp.status}).`);
        return;
      }
      const text = await resp.text();
      const blob = new Blob([text], {
        type: "text/plain;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      // No "noopener" feature: with it window.open always returns null, which
      // made every click look like a blocked popup. Sever the opener manually.
      const opened = window.open(objectUrl, "_blank");
      if (opened) {
        try {
          opened.opener = null;
        } catch (_) {}
      } else {
        flashMsg("Popup blocked — allow popups for osu.ppy.sh to view .osu.");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    } catch (_) {
      flashMsg("Could not load .osu (network error).");
    } finally {
      btn.disabled = false;
    }
  });
  return wrap;
}

/**
 * @param {typeof el} elFn
 * @param {string} rootClass
 * @param {object} cfg
 * @param {string} cfg.title
 * @param {string} cfg.titleId
 * @param {string} cfg.buttonText
 * @param {(btn: HTMLButtonElement) => void} cfg.mountButton
 * @param {string} [cfg.buttonIconClass] Font Awesome classes for leading icon (e.g. `fas fa-tags`)
 * @param {string} [cfg.modalExtraClass]
 * @param {string} [cfg.buttonExtraClass] Extra classes on the open button (e.g. compact placement)
 * @param {(elFn: typeof el) => Node|null|undefined} [cfg.buildModalTitleExtra] Shown after the modal title (left header group)
 * @param {() => Node} cfg.buildBody
 * @param {(body: HTMLElement) => void} [cfg.onBodyBuilt]  runs once the body is in the open modal
 */
export function attachBeatmapsetInfoModal(elFn, rootClass, cfg) {
  const {
    title,
    titleId,
    buttonText,
    buttonIconClass = "",
    modalExtraClass = "",
    buildBody,
    onBodyBuilt,
    buildModalTitleExtra,
    mountButton,
    buttonExtraClass = "",
  } = cfg;

  const btnClass = `${rootClass}__action-btn${
    buttonExtraClass ? ` ${buttonExtraClass}` : ""
  }`;
  const openBtn = buttonIconClass
    ? elFn(
        "button",
        { type: "button", class: btnClass },
        elFn("i", {
          class: buttonIconClass,
          "aria-hidden": "true",
        }),
        buttonText,
      )
    : elFn("button", { type: "button", class: btnClass }, buttonText);
  mountButton(openBtn);

  const modalPortal = elFn("div", {
    class: `${rootClass}__modal-portal`,
    "aria-hidden": "true",
  });
  const backdrop = elFn("div", { class: `${rootClass}__modal-backdrop` });
  const modal = elFn("div", {
    class: `${rootClass}__modal${modalExtraClass ? ` ${modalExtraClass}` : ""}`,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
  });
  modal.style.background = resolveDescriptionSectionBackgroundColor();
  const modalHeader = elFn("div", { class: `${rootClass}__modal-header` });
  const headerStart = elFn("div", {
    class: `${rootClass}__modal-header-start`,
  });
  headerStart.appendChild(
    elFn("h2", { class: `${rootClass}__modal-title`, id: titleId }, title),
  );
  if (typeof buildModalTitleExtra === "function") {
    const extra = buildModalTitleExtra(elFn);
    if (extra) headerStart.appendChild(extra);
  }
  modalHeader.appendChild(headerStart);
  const closeBtn = elFn(
    "button",
    {
      type: "button",
      class: `${rootClass}__modal-close`,
      "aria-label": "Close",
    },
    "×",
  );
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const modalBody = elFn("div", {
    class: `${rootClass}__modal-body u-fancy-scrollbar`,
  });
  modal.appendChild(modalBody);
  // The body (description HTML with its images and iframes) is built on the
  // first open, not on every page load.
  let bodyBuilt = false;
  const ensureBody = () => {
    if (bodyBuilt) return;
    bodyBuilt = true;
    modalBody.appendChild(buildBody());
    onBodyBuilt?.(modalBody);
  };

  modalPortal.appendChild(backdrop);
  modalPortal.appendChild(modal);
  document.body.appendChild(modalPortal);

  /** @type {AbortController|null} */
  let modalAbort = null;

  function closeModal() {
    modalPortal.classList.remove(`${rootClass}__modal-portal--open`);
    modalPortal.setAttribute("aria-hidden", "true");
    modalAbort?.abort();
    modalAbort = null;
    openBtn.focus();
  }

  function openModal() {
    if (modalPortal.classList.contains(`${rootClass}__modal-portal--open`)) {
      closeBtn.focus();
      return;
    }
    modalAbort?.abort();
    modalAbort = new AbortController();
    const { signal } = modalAbort;

    modalPortal.classList.add(`${rootClass}__modal-portal--open`);
    modalPortal.setAttribute("aria-hidden", "false");
    ensureBody();
    closeBtn.focus();

    const onKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener("keydown", onKeydown, {
      signal,
      capture: true,
    });

    backdrop.addEventListener(
      "click",
      () => {
        closeModal();
      },
      { signal },
    );
  }

  openBtn.addEventListener("click", () => {
    openModal();
  });
  closeBtn.addEventListener("click", () => {
    closeModal();
  });

  modal.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  return {
    dispose() {
      modalAbort?.abort();
      modalAbort = null;
      modalPortal.remove();
      openBtn.remove();
    },
  };
}

export function teardownBeatmapDescriptionHeadingLayout(descRow) {
  if (!(descRow instanceof HTMLElement)) return;
  descRow.classList.remove(`${ROOT_CLASS}__description-heading-row`);
  const headWrap = descRow.querySelector(
    `:scope > .${ROOT_CLASS}__description-sticky-head`,
  );
  if (headWrap) {
    const h = headWrap.querySelector(":scope > h3.beatmapset-info__header");
    if (h) descRow.insertBefore(h, headWrap);
    headWrap.remove();
  }
}

/**
 * "Show metadata" under the artist and "Full description" beside the
 * description heading. The description row appears with `.beatmapset-info`,
 * which may render after the header, so mounting is retried once it exists.
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {RegExp} pathRe
 * @returns {() => void}
 */
export function startBeatmapsetInfoModals(header, pathRe) {
  /** @type {{ dispose: () => void } | null} */
  let metadataInfoModal = null;
  /** @type {{ dispose: () => void } | null} */
  let descriptionInfoModal = null;
  /** @type {HTMLElement|null} */
  let descriptionHeadingDescRow = null;

  function disposeBeatmapInfoModalButtons() {
    try {
      metadataInfoModal?.dispose();
    } catch (_) {}
    metadataInfoModal = null;
    try {
      descriptionInfoModal?.dispose();
    } catch (_) {}
    descriptionInfoModal = null;
    if (descriptionHeadingDescRow instanceof HTMLElement) {
      teardownBeatmapDescriptionHeadingLayout(descriptionHeadingDescRow);
      descriptionHeadingDescRow = null;
    }
  }

  function refreshBeatmapInfoModalButtons() {
    if (!(header instanceof HTMLElement) || !document.body.contains(header))
      return;
    if (!pathRe.test(location.pathname)) return;

    const data = readBeatmapsetJson();

    const artistEl = header.querySelector(
      ".beatmapset-header__details-text--artist",
    );
    if (
      !metadataInfoModal &&
      artistEl instanceof HTMLElement &&
      !header.querySelector("[data-oep-beatmapset-metadata]")
    ) {
      metadataInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
        title: "Beatmap metadata",
        titleId: `${ROOT_CLASS}-metadata-title`,
        buttonText: "Show metadata",
        buttonIconClass: "fas fa-clipboard-list",
        buttonExtraClass: `${ROOT_CLASS}__action-btn--under-artist`,
        mountButton: (btn) => {
          btn.setAttribute("data-oep-beatmapset-metadata", "");
          artistEl.insertAdjacentElement("afterend", btn);
        },
        buildModalTitleExtra: (elFn) =>
          buildBeatmapMetadataOsuOpenButton(elFn, getBeatmapPageBeatmapId),
        buildBody: () => buildModalBody(data, el),
      });
    }

    const infoCol = document.querySelector(".beatmapset-info");
    const firstBox = infoCol?.querySelector(":scope > .beatmapset-info__box");
    const scrollEl = firstBox?.querySelector(
      ":scope > .beatmapset-info__scrollable",
    );
    const descRow =
      scrollEl?.querySelector(
        ":scope > .beatmapset-info__row:has(.beatmapset-info__description)",
      ) ??
      scrollEl?.querySelector(
        ":scope > .beatmapset-info__row:first-child:has(> h3.beatmapset-info__header)",
      );
    const descHeading = descRow?.querySelector(
      ":scope > h3.beatmapset-info__header",
    );
    if (
      !descriptionInfoModal &&
      descRow instanceof HTMLElement &&
      descHeading instanceof HTMLElement &&
      !descRow.querySelector("[data-oep-beatmapset-desc]")
    ) {
      descRow.classList.add(`${ROOT_CLASS}__description-heading-row`);
      descriptionHeadingDescRow = descRow;
      descriptionInfoModal = attachBeatmapsetInfoModal(el, ROOT_CLASS, {
        title: "Beatmap description",
        titleId: `${ROOT_CLASS}-description-title`,
        buttonText: "Full description",
        buttonIconClass: "fas fa-align-left",
        buttonExtraClass: `${ROOT_CLASS}__action-btn--description-heading`,
        modalExtraClass: `${ROOT_CLASS}__modal--description`,
        mountButton: (btn) => {
          btn.setAttribute("data-oep-beatmapset-desc", "");
          const headWrap = el("div", {
            class: `${ROOT_CLASS}__description-sticky-head`,
          });
          descRow.insertBefore(headWrap, descHeading);
          headWrap.appendChild(descHeading);
          headWrap.appendChild(btn);
        },
        buildBody: () => buildDescriptionModalBody(data, el),
        // Spoilers read their open state from layout, so bind them once the
        // body is in the open modal (B59).
        onBodyBuilt: (body) => bindBbcodeSpoilers(body),
      });
    }
  }

  refreshBeatmapInfoModalButtons();
  const ac = new AbortController();
  waitForElement(".beatmapset-info", { timeout: 12000, signal: ac.signal })
    .then(refreshBeatmapInfoModalButtons)
    .catch(() => {});

  return () => {
    ac.abort();
    disposeBeatmapInfoModalButtons();
  };
}
