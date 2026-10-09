/**
 * Beatmapset header buttons (WS-33): Beatconnect download, preview audio.
 */

import { el, qsa } from "../legacy.js";
import {
  BEATCONNECT_DL_BTN_CLASS,
  BEATCONNECT_DL_PAIRED_CLASS,
  BEATCONNECT_STACK_CLASS,
  BEATCONNECT_STACK_ICON_CLASS,
  BEATCONNECT_STACK_LABEL_CLASS,
} from "./constants.js";

/**
 * osu!direct / supporter “direct” entry in `.beatmapset-header__buttons`.
 * @param {HTMLElement} buttonsEl
 * @returns {HTMLAnchorElement|null}
 */
export function findBeatmapsetOsuDirectButton(buttonsEl) {
  const links = qsa("a.btn-osu-big", buttonsEl);
  return (
    links.find((a) => {
      const h = a.getAttribute("href") || "";
      return h.startsWith("osu://") || /support-the-game/i.test(h);
    }) ?? null
  );
}

/**
 * Primary `.osz` download in `.beatmapset-header__buttons` — first link to
 * `/beatmapsets/{id}/download` (excludes osu!direct / support links).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {() => void}
 */
export function mountBeatconnectDownloadSplit(header, beatmapsetId) {
  const buttons = header.querySelector(".beatmapset-header__buttons");
  if (!buttons) return () => {};

  if (buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)) {
    return () => {};
  }

  const id = Number(beatmapsetId);
  if (!Number.isFinite(id)) return () => {};

  const dlRe = new RegExp(String.raw`/beatmapsets/${id}/download`, "i");
  /** @type {HTMLAnchorElement | undefined} */
  const primaryDl = qsa("a.btn-osu-big", buttons).find((a) =>
    dlRe.test(a.getAttribute("href") || ""),
  );
  if (!primaryDl) {
    return () => {};
  }

  primaryDl.classList.add(BEATCONNECT_DL_PAIRED_CLASS);

  const beatconnectBtn = el(
    "a",
    {
      class: `btn-osu-big btn-osu-big--beatmapset-header ${BEATCONNECT_DL_BTN_CLASS}`,
      href: `https://beatconnect.io/b/${id}`,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    el(
      "span",
      {
        class: `btn-osu-big__content ${BEATCONNECT_STACK_CLASS}`,
      },
      el(
        "span",
        {
          class: `btn-osu-big__icon ${BEATCONNECT_STACK_ICON_CLASS}`,
        },
        el("img", {
          class: "oep-beatconnect-logo",
          src: "https://beatconnect.io/static/img/logo.png",
          alt: "Beatconnect",
          decoding: "async",
        }),
      ),
      el("span", { class: BEATCONNECT_STACK_LABEL_CLASS }, "Beatconnect"),
    ),
  );

  primaryDl.after(beatconnectBtn);

  return () => {
    primaryDl.classList.remove(BEATCONNECT_DL_PAIRED_CLASS);
    buttons.querySelector(`.${BEATCONNECT_DL_BTN_CLASS}`)?.remove();
  };
}

/**
 * Square header control opening `https://b.ppy.sh/preview/{id}.mp3` (osu! preview stream).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {() => void}
 */
export function mountBeatmapsetPreviewAudioButton(header, beatmapsetId) {
  const buttons = header.querySelector(".beatmapset-header__buttons");
  if (!buttons) return () => {};

  if (buttons.querySelector("[data-oep-beatmapset-preview-audio]")) {
    return () => {};
  }

  const id = Number(beatmapsetId);
  if (!Number.isFinite(id)) return () => {};

  const previewLink = el(
    "a",
    {
      class: "btn-osu-big btn-osu-big--beatmapset-header-square",
      href: `https://b.ppy.sh/preview/${id}.mp3`,
      target: "_blank",
      rel: "noopener noreferrer",
      "data-oep-beatmapset-preview-audio": "",
      title: "Open preview audio",
      "aria-label": "Open preview audio",
    },
    el(
      "span",
      { class: "btn-osu-big__content btn-osu-big__content--center" },
      el(
        "span",
        { class: "btn-osu-big__icon" },
        el(
          "span",
          { class: "fa fa-fw" },
          el("span", { class: "fas fa-volume-up", "aria-hidden": "true" }),
        ),
      ),
    ),
  );

  const mp3 = buttons.querySelector("[data-oep-beatmapset-mp3]");
  const bg = buttons.querySelector("[data-oep-beatmapset-bg]");
  if (mp3 instanceof HTMLElement) {
    mp3.insertAdjacentElement("afterend", previewLink);
  } else if (bg instanceof HTMLElement) {
    bg.insertAdjacentElement("afterend", previewLink);
  } else {
    const directBtn = findBeatmapsetOsuDirectButton(buttons);
    if (directBtn) {
      directBtn.insertAdjacentElement("afterend", previewLink);
    } else {
      buttons.appendChild(previewLink);
    }
  }

  return () => {
    previewLink.remove();
  };
}

// Attribute set on .beatmapset-header elements we have already processed.
