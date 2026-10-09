/**
 * Open the profile avatar and banner images (WS-41).
 */

import { el, manageStyle, waitForElement } from "../legacy.js";
import {
  getProfileUserId,
  profileInitialDataForUrl,
} from "./profile-target.js";
const PROFILE_AVATAR_OPEN_ATTR = "data-oep-profile-avatar-open";
const PROFILE_BANNER_OPEN_ATTR = "data-oep-profile-banner-open";
const PROFILE_MEDIA_OPEN_BTN_CLASS = "oep-profile-media-open";
const PROFILE_MEDIA_OPEN_AVATAR_CLASS = "oep-profile-media-open--avatar";
const PROFILE_MEDIA_OPEN_BANNER_CLASS = "oep-profile-media-open--banner";
const PROFILE_MEDIA_OPEN_HOST_CLASS = "oep-profile-media-open-host";
const PROFILE_MEDIA_OPEN_STYLE_ID = "osu-expertplus-profile-media-open";

const profileMediaOpenStyle = manageStyle(
  PROFILE_MEDIA_OPEN_STYLE_ID,
  `
  .profile-info.${PROFILE_MEDIA_OPEN_HOST_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS} {
    position: relative;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS} {
    position: absolute;
    z-index: 7;
    margin: 0;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85em;
    height: 1.85em;
    min-width: 1.85em;
    min-height: 1.85em;
    font-size: 11px;
    line-height: 1;
    color: hsl(var(--hsl-l1));
    cursor: pointer;
    appearance: none;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.55);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease, background-color 140ms ease,
      border-color 140ms ease;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS} .fas {
    pointer-events: none;
  }
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__avatar:hover)
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:hover
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS}:focus-visible
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_AVATAR_CLASS} {
    opacity: 1;
    pointer-events: auto;
  }
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(.profile-info__bg:hover)
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:hover
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS},
  .${PROFILE_MEDIA_OPEN_HOST_CLASS}:has(
      .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS}:focus-visible
    )
    .${PROFILE_MEDIA_OPEN_BTN_CLASS}.${PROFILE_MEDIA_OPEN_BANNER_CLASS} {
    opacity: 1;
    pointer-events: auto;
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS}:hover {
    background: rgba(0, 0, 0, 0.78);
    border-color: rgba(255, 255, 255, 0.22);
  }
  .${PROFILE_MEDIA_OPEN_BTN_CLASS}:focus-visible {
    outline: 2px solid hsl(var(--hsl-b1));
    outline-offset: 2px;
  }
`,
);

/** @type {WeakMap<HTMLElement, number>} */
const profileMediaOpenHostCounts = new WeakMap();

function acquireProfileMediaOpenHost(profileInfo) {
  const n = (profileMediaOpenHostCounts.get(profileInfo) || 0) + 1;
  profileMediaOpenHostCounts.set(profileInfo, n);
  profileInfo.classList.add(PROFILE_MEDIA_OPEN_HOST_CLASS);
}

function releaseProfileMediaOpenHost(profileInfo) {
  const prev = profileMediaOpenHostCounts.get(profileInfo);
  if (prev == null) return;
  const n = prev - 1;
  if (n <= 0) {
    profileMediaOpenHostCounts.delete(profileInfo);
    profileInfo.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS);
  } else {
    profileMediaOpenHostCounts.set(profileInfo, n);
  }
}

/**
 * @param {HTMLElement} avatarHost
 * @returns {string}
 */
function resolveProfileAvatarImageHref(avatarHost) {
  const data = profileInitialDataForUrl();
  const fromData = data?.user?.avatar_url;
  if (typeof fromData === "string" && fromData.trim()) return fromData.trim();
  const img = avatarHost.querySelector("img[src]");
  if (img instanceof HTMLImageElement && img.src) return img.src;
  const withBg = avatarHost.querySelector("[style*='background-image']");
  if (withBg instanceof HTMLElement) {
    const styleAttr = withBg.getAttribute("style") || "";
    const m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
    if (m && m[1]) return m[1].trim();
  }
  const uid = getProfileUserId();
  return uid ? `https://a.ppy.sh/${uid}` : "";
}

/**
 * @param {HTMLElement} bgHost
 * @returns {string}
 */
function resolveProfileBannerImageHref(bgHost) {
  const data = profileInitialDataForUrl();
  const cover = data?.user?.cover;
  if (cover && typeof cover === "object") {
    for (const k of ["custom_url", "url"]) {
      const u = cover[k];
      if (typeof u === "string" && u.trim()) return u.trim();
    }
  }
  const flat = data?.user?.cover_url;
  if (typeof flat === "string" && flat.trim()) return flat.trim();

  const styleAttr = bgHost.getAttribute("style") || "";
  let m = styleAttr.match(/url\(\s*["']?([^"')]+)/i);
  if (m && m[1]) return m[1].trim();
  for (const inner of bgHost.querySelectorAll("[style*='background-image']")) {
    if (!(inner instanceof HTMLElement)) continue;
    const s = inner.getAttribute("style") || "";
    m = s.match(/url\(\s*["']?([^"')]+)/i);
    if (m && m[1]) return m[1].trim();
  }
  const img = bgHost.querySelector("img[src]");
  if (img instanceof HTMLImageElement && img.src) return img.src;
  return "";
}

/**
 * @param {{
 *   mediaHost: HTMLElement,
 *   markerAttr: string,
 *   resolveHref: (host: HTMLElement) => string,
 *   ariaLabel: string,
 * }} opts
 * @returns {null | (() => void)}
 */
function bindProfileMediaOpenButton(opts) {
  const { mediaHost, markerAttr, resolveHref, ariaLabel } = opts;
  if (!(mediaHost instanceof HTMLElement)) return null;
  if (mediaHost.hasAttribute(markerAttr)) return null;
  const href = resolveHref(mediaHost);
  if (!href) return null;
  mediaHost.setAttribute(markerAttr, "1");

  const profileInfoEl = mediaHost.closest(".profile-info");
  const profileInfo =
    profileInfoEl instanceof HTMLElement
      ? profileInfoEl
      : mediaHost.parentElement;
  if (!(profileInfo instanceof HTMLElement)) {
    mediaHost.removeAttribute(markerAttr);
    return null;
  }

  acquireProfileMediaOpenHost(profileInfo);

  const variantClass =
    markerAttr === PROFILE_AVATAR_OPEN_ATTR
      ? PROFILE_MEDIA_OPEN_AVATAR_CLASS
      : PROFILE_MEDIA_OPEN_BANNER_CLASS;

  const btn = el(
    "button",
    {
      type: "button",
      class: `${PROFILE_MEDIA_OPEN_BTN_CLASS} ${variantClass}`,
      "aria-label": ariaLabel,
      onclick: (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.open(href, "_blank", "noopener,noreferrer");
      },
    },
    el("i", {
      class: "fas fa-external-link-alt",
      "aria-hidden": "true",
    }),
  );

  function syncOpenBtnLayout() {
    if (!btn.isConnected || !mediaHost.isConnected) return;
    const ar = mediaHost.getBoundingClientRect();
    const pr = profileInfo.getBoundingClientRect();
    const top = ar.top - pr.top + profileInfo.scrollTop;
    const left = ar.left - pr.left + profileInfo.scrollLeft;
    btn.style.top = `${Math.round(top + 2)}px`;
    btn.style.left = `${Math.round(left + ar.width - 2)}px`;
    btn.style.transform = "translate(-100%, 0)";
  }

  profileInfo.appendChild(btn);
  syncOpenBtnLayout();

  const ro =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(syncOpenBtnLayout)
      : null;
  ro?.observe(mediaHost);
  ro?.observe(profileInfo);
  window.addEventListener("scroll", syncOpenBtnLayout, true);
  window.addEventListener("resize", syncOpenBtnLayout);

  return () => {
    window.removeEventListener("scroll", syncOpenBtnLayout, true);
    window.removeEventListener("resize", syncOpenBtnLayout);
    ro?.disconnect();
    btn.remove();
    releaseProfileMediaOpenHost(profileInfo);
    mediaHost.removeAttribute(markerAttr);
  };
}

/** Hover controls on profile avatar and banner to open full media in a new tab. */
export function startProfileMediaOpenPictureManager() {
  profileMediaOpenStyle.inject();

  let disposeAvatar = /** @type {null | (() => void)} */ (null);
  let disposeBanner = /** @type {null | (() => void)} */ (null);
  const ac = new AbortController();

  function scanProfileMediaOpen() {
    if (ac.signal.aborted) return;
    const av = document.querySelector(".profile-info__avatar");
    if (
      av instanceof HTMLElement &&
      !av.hasAttribute(PROFILE_AVATAR_OPEN_ATTR)
    ) {
      disposeAvatar?.();
      disposeAvatar =
        bindProfileMediaOpenButton({
          mediaHost: av,
          markerAttr: PROFILE_AVATAR_OPEN_ATTR,
          resolveHref: resolveProfileAvatarImageHref,
          ariaLabel: "Open profile picture",
        }) || null;
    }
    const bg = document.querySelector(".profile-info__bg");
    if (
      bg instanceof HTMLElement &&
      !bg.hasAttribute(PROFILE_BANNER_OPEN_ATTR)
    ) {
      disposeBanner?.();
      disposeBanner =
        bindProfileMediaOpenButton({
          mediaHost: bg,
          markerAttr: PROFILE_BANNER_OPEN_ATTR,
          resolveHref: resolveProfileBannerImageHref,
          ariaLabel: "Open profile banner",
        }) || null;
    }
  }

  Promise.allSettled([
    waitForElement(".profile-info__avatar", 15000),
    waitForElement(".profile-info__bg", 15000),
  ]).then(() => {
    if (!ac.signal.aborted) scanProfileMediaOpen();
  });

  const obs = new MutationObserver(scanProfileMediaOpen);
  obs.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    ac.abort();
    obs.disconnect();
    disposeAvatar?.();
    disposeBanner?.();
    document
      .querySelectorAll(`.${PROFILE_MEDIA_OPEN_BTN_CLASS}`)
      .forEach((b) => b.remove());
    document
      .querySelectorAll(`[${PROFILE_AVATAR_OPEN_ATTR}]`)
      .forEach((el) => el.removeAttribute(PROFILE_AVATAR_OPEN_ATTR));
    document
      .querySelectorAll(`[${PROFILE_BANNER_OPEN_ATTR}]`)
      .forEach((el) => el.removeAttribute(PROFILE_BANNER_OPEN_ATTR));
    document
      .querySelectorAll(`.${PROFILE_MEDIA_OPEN_HOST_CLASS}`)
      .forEach((el) => el.classList.remove(PROFILE_MEDIA_OPEN_HOST_CLASS));
    profileMediaOpenStyle.remove();
  };
}
