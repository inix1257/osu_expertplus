/**
 * Beatmapset header buttons (WS-33): Beatconnect download, preview audio,
 * background and MP3.
 *
 * Each button carries a `data-oep-beatmapset-<name>` marker: a mount does
 * nothing when its marker is already there, and its dispose removes only the
 * nodes it added.
 */

import { el, qsa } from "../legacy.js";
import {
  BEATCONNECT_DL_BTN_CLASS,
  BEATCONNECT_DL_PAIRED_CLASS,
  BEATCONNECT_STACK_CLASS,
  BEATCONNECT_STACK_ICON_CLASS,
  BEATCONNECT_STACK_LABEL_CLASS,
} from "./constants.js";

const BUTTONS_SEL = ".beatmapset-header__buttons";

/**
 * @param {string} name
 * @returns {string}  the marker attribute of header button `name`
 */
const markerAttr = (name) => `data-oep-beatmapset-${name}`;

/**
 * The header's button bar, unless button `name` is already in it.
 * @param {HTMLElement} header
 * @param {string} name
 * @returns {HTMLElement|null}
 */
function buttonBarWithout(header, name) {
  const buttons = header.querySelector(BUTTONS_SEL);
  if (!(buttons instanceof HTMLElement)) return null;
  return buttons.querySelector(`[${markerAttr(name)}]`) ? null : buttons;
}

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
 * A square icon link styled like osu-web's header squares.
 * @param {{ name: string, href: string, title: string, icon: string }} spec
 * @returns {HTMLAnchorElement}
 */
function squareLink({ name, href, title, icon }) {
  return el(
    "a",
    {
      class: "btn-osu-big btn-osu-big--beatmapset-header-square",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      [markerAttr(name)]: "",
      title,
      "aria-label": title,
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
          el("span", { class: `fas ${icon}`, "aria-hidden": "true" }),
        ),
      ),
    ),
  );
}

/**
 * Beatconnect mirror next to the primary `.osz` download (the first link to
 * `/beatmapsets/{id}/download`, not osu!direct or the supporter link).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {(() => void)|undefined}
 */
export function mountBeatconnectDownloadSplit(header, beatmapsetId) {
  const buttons = buttonBarWithout(header, "beatconnect");
  const id = Number(beatmapsetId);
  if (!buttons || !Number.isFinite(id)) return undefined;

  const dlRe = new RegExp(String.raw`/beatmapsets/${id}/download`, "i");
  /** @type {HTMLAnchorElement | undefined} */
  const primaryDl = qsa("a.btn-osu-big", buttons).find((a) =>
    dlRe.test(a.getAttribute("href") || ""),
  );
  if (!primaryDl) return undefined;

  primaryDl.classList.add(BEATCONNECT_DL_PAIRED_CLASS);

  const beatconnectBtn = el(
    "a",
    {
      class: `btn-osu-big btn-osu-big--beatmapset-header ${BEATCONNECT_DL_BTN_CLASS}`,
      href: `https://beatconnect.io/b/${id}`,
      target: "_blank",
      rel: "noopener noreferrer",
      [markerAttr("beatconnect")]: "",
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
    beatconnectBtn.remove();
  };
}

/**
 * Square header control opening `https://b.ppy.sh/preview/{id}.mp3` (osu! preview stream),
 * after the MP3 / background squares when they are there.
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {(() => void)|undefined}
 */
export function mountBeatmapsetPreviewAudioButton(header, beatmapsetId) {
  const buttons = buttonBarWithout(header, "preview-audio");
  const id = Number(beatmapsetId);
  if (!buttons || !Number.isFinite(id)) return undefined;

  const previewLink = squareLink({
    name: "preview-audio",
    href: `https://b.ppy.sh/preview/${id}.mp3`,
    title: "Open preview audio",
    icon: "fa-volume-up",
  });

  const after =
    buttons.querySelector(`[${markerAttr("mp3")}]`) ??
    buttons.querySelector(`[${markerAttr("bg")}]`) ??
    findBeatmapsetOsuDirectButton(buttons);
  if (after) after.insertAdjacentElement("afterend", previewLink);
  else buttons.appendChild(previewLink);

  return () => previewLink.remove();
}

/**
 * "Open background" and "Download MP3" squares after the osu!direct button.
 * The MP3 link goes to the third-party osu.ppyd.sh (D6, B66).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {(() => void)|undefined}
 */
export function mountBeatmapsetBackgroundButtons(header, beatmapsetId) {
  const buttons = buttonBarWithout(header, "bg");
  if (!buttons) return undefined;

  const bgLink = squareLink({
    name: "bg",
    href: `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`,
    title: "Open background",
    icon: "fa-image",
  });
  const mp3Link = squareLink({
    name: "mp3",
    href: `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`,
    title: "Download MP3",
    icon: "fa-music",
  });

  const directBtn = findBeatmapsetOsuDirectButton(buttons);
  if (directBtn) directBtn.insertAdjacentElement("afterend", bgLink);
  else buttons.appendChild(bgLink);
  bgLink.insertAdjacentElement("afterend", mp3Link);

  return () => {
    mp3Link.remove();
    bgLink.remove();
  };
}
