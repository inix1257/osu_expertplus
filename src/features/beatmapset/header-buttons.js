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
 * Insert `link` after the first header button in `afterNames` that is in the
 * bar, else after the osu!direct button, else at the end.
 * @param {HTMLElement} buttons
 * @param {HTMLElement} link
 * @param {string[]} afterNames  header button names, in order of preference
 */
function insertSquare(buttons, link, afterNames) {
  const after =
    afterNames
      .map((name) => buttons.querySelector(`[${markerAttr(name)}]`))
      .find(Boolean) ?? findBeatmapsetOsuDirectButton(buttons);
  if (after) after.insertAdjacentElement("afterend", link);
  else buttons.appendChild(link);
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

  insertSquare(buttons, previewLink, ["mp3", "bg"]);
  return () => previewLink.remove();
}

/**
 * "Open background" square after the osu!direct button.
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {(() => void)|undefined}
 */
export function mountBeatmapsetBackgroundButton(header, beatmapsetId) {
  const buttons = buttonBarWithout(header, "bg");
  if (!buttons) return undefined;

  const bgLink = squareLink({
    name: "bg",
    href: `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg`,
    title: "Open background",
    icon: "fa-image",
  });
  insertSquare(buttons, bgLink, []);
  return () => bgLink.remove();
}

/**
 * "Download MP3" square after the background one. The link goes to the
 * third-party osu.ppyd.sh, so it has its own setting and says so in its
 * tooltip (D6, B66).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @param {string} beatmapsetId
 * @returns {(() => void)|undefined}
 */
export function mountBeatmapsetMp3Button(header, beatmapsetId) {
  const buttons = buttonBarWithout(header, "mp3");
  if (!buttons) return undefined;

  const mp3Link = squareLink({
    name: "mp3",
    href: `https://osu.ppyd.sh/beatmapsets/${encodeURIComponent(String(beatmapsetId))}/download`,
    title: "Download MP3 (osu.ppyd.sh, third-party)",
    icon: "fa-music",
  });
  insertSquare(buttons, mp3Link, ["bg"]);
  return () => mp3Link.remove();
}
