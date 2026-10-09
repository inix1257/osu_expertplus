/**
 * Favourites on the beatmapset header (WS-33): the pink favourited button
 * and the hover popover listing recent favouriters.
 */

import { el } from "../legacy.js";
import { destroyOsuWebQtipIfBound } from "../osu-web-qtip.js";
import {
  BEATMAPSET_FAV_BTN_FAVOURITED_CLASS,
  ROOT_CLASS,
} from "./constants.js";

/**
 * @param {HTMLElement} header  `.beatmapset-header`
 * @returns {HTMLElement|null}
 */
export function findBeatmapsetFavouriteStatSpan(header) {
  const heart = header.querySelector(".beatmapset-header__value .fa-heart");
  return heart?.closest(".beatmapset-header__value") ?? null;
}

/**
 * Pink background on the header favourite square when favourited (`fas fa-heart`).
 * @param {HTMLElement} header  `.beatmapset-header`
 * @returns {() => void}
 */
export function startBeatmapsetFavouriteButtonPinkIndicator(header) {
  const buttons = header.querySelector(".beatmapset-header__buttons");
  if (!buttons) return () => {};

  function findFavouriteButton() {
    return buttons.querySelector(
      "button.btn-osu-big--beatmapset-header-square",
    );
  }

  function sync() {
    const btn = findFavouriteButton();
    if (!btn) return;
    const heart = btn.querySelector(".fa-heart");
    const favourited = Boolean(heart?.classList.contains("fas"));
    btn.classList.toggle(BEATMAPSET_FAV_BTN_FAVOURITED_CLASS, favourited);
  }

  sync();

  const mo = new MutationObserver(sync);
  mo.observe(buttons, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    mo.disconnect();
    findFavouriteButton()?.classList.remove(
      BEATMAPSET_FAV_BTN_FAVOURITED_CLASS,
    );
  };
}

/**
 * Hover popover on the favourite count (heart) with API `recent_favourites` (avatar + username).
 * Replaces osu! qtip; only used when OAuth client id/secret are set in Expert+ (see auth.isConfigured).
 * @param {HTMLElement} header
 * @param {string} beatmapsetId
 * @param {RegExp} pathRe
 * @param {number|undefined|null} favouriteCount
 * @returns {() => void}
 */
export function setupBeatmapsetFavouriteHoverPopover(
  header,
  beatmapsetId,
  pathRe,
  favouriteCount,
) {
  const fc = favouriteCount == null ? NaN : Number(favouriteCount);
  const skipApi = Number.isFinite(fc) && fc <= 0;

  const api = OsuExpertPlus.api;
  /** @type {Promise<object[]>|null} */
  let usersPromise = null;

  const popover = el("div", {
    class: `${ROOT_CLASS}__fav-popover`,
    role: "tooltip",
  });
  const titleEl = el(
    "div",
    { class: `${ROOT_CLASS}__fav-popover-title` },
    "Favourites",
  );
  const scrollEl = el("div", { class: `${ROOT_CLASS}__fav-popover-scroll` });
  popover.appendChild(titleEl);
  popover.appendChild(scrollEl);
  document.body.appendChild(popover);

  /** @param {object} u */
  function recentFavouriteChip(u) {
    const id = u?.id;
    const name = u?.username ?? (id != null ? String(id) : "?");
    if (id == null) {
      return el(
        "span",
        {
          class: `${ROOT_CLASS}__header-fav-chip ${ROOT_CLASS}__header-fav-chip--text`,
        },
        name,
      );
    }
    const rawUrl = u?.avatar_url;
    const avatarUrl =
      typeof rawUrl === "string" && rawUrl.trim()
        ? rawUrl.trim()
        : `https://a.ppy.sh/${id}`;
    const img = el("img", {
      class: `${ROOT_CLASS}__header-fav-avatar`,
      src: avatarUrl,
      alt: "",
      width: "24",
      height: "24",
      loading: "lazy",
      decoding: "async",
    });
    return el(
      "a",
      {
        class: `${ROOT_CLASS}__header-fav-chip`,
        href: `https://osu.ppy.sh/users/${id}`,
      },
      img,
      el("span", { class: `${ROOT_CLASS}__header-fav-name` }, name),
    );
  }

  function loadUsers() {
    if (skipApi) return Promise.resolve(/** @type {object[]} */ ([]));
    usersPromise ??= api
      .getBeatmapset(beatmapsetId, { include: ["recent_favourites"] })
      .then((set) =>
        Array.isArray(set?.recent_favourites) ? set.recent_favourites : [],
      )
      .catch((e) => {
        usersPromise = null;
        throw e;
      });
    return usersPromise;
  }

  function positionPopover(anchor) {
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.style.transform = "none";
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    let left = r.right + margin;
    if (left + pw > window.innerWidth - margin)
      left = Math.max(margin, r.left - pw - margin);
    let top = r.top + r.height / 2 - ph / 2;
    top = Math.min(Math.max(margin, top), window.innerHeight - ph - margin);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  let showTimer = 0;
  let hideTimer = 0;
  let visible = false;
  /** @type {HTMLElement|null} */
  let boundSpan = null;

  function clearTimers() {
    if (showTimer) window.clearTimeout(showTimer);
    if (hideTimer) window.clearTimeout(hideTimer);
    showTimer = 0;
    hideTimer = 0;
  }

  function hidePopover() {
    clearTimers();
    visible = false;
    popover.classList.remove(`${ROOT_CLASS}__fav-popover--visible`);
    popover.setAttribute("aria-hidden", "true");
  }

  function containsFavOrPopover(node) {
    if (!(node instanceof Node)) return false;
    return (!!boundSpan && boundSpan.contains(node)) || popover.contains(node);
  }

  function scheduleHide() {
    clearTimers();
    hideTimer = window.setTimeout(() => {
      hideTimer = 0;
      hidePopover();
    }, 350);
  }

  /** @param {HTMLElement} anchor */
  async function showPopover(anchor) {
    clearTimers();
    if (!pathRe.test(location.pathname) || !document.body.contains(header))
      return;
    destroyOsuWebQtipIfBound(anchor);
    visible = true;
    popover.setAttribute("aria-hidden", "false");
    scrollEl.replaceChildren(
      el(
        "span",
        { class: `${ROOT_CLASS}__header-favouriters-muted` },
        "Loading…",
      ),
    );
    popover.classList.add(`${ROOT_CLASS}__fav-popover--visible`);
    requestAnimationFrame(() => {
      if (visible) positionPopover(anchor);
    });

    if (skipApi) {
      scrollEl.replaceChildren(
        el(
          "span",
          { class: `${ROOT_CLASS}__header-favouriters-muted` },
          "No favourites yet.",
        ),
      );
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });
      return;
    }

    try {
      const users = await loadUsers();
      if (!pathRe.test(location.pathname) || !visible) return;
      if (!Array.isArray(users) || users.length === 0) {
        scrollEl.replaceChildren(
          el(
            "span",
            { class: `${ROOT_CLASS}__header-favouriters-muted` },
            "No recent favourites to show.",
          ),
        );
      } else {
        scrollEl.replaceChildren();
        for (const u of users) {
          scrollEl.appendChild(recentFavouriteChip(u));
        }
      }
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });
    } catch {
      if (!visible) return;
      scrollEl.replaceChildren(
        el(
          "span",
          { class: `${ROOT_CLASS}__header-favouriters-muted` },
          "Could not load favourites.",
        ),
      );
      requestAnimationFrame(() => {
        if (visible) positionPopover(anchor);
      });
    }
  }

  /** @param {HTMLElement} anchor */
  function onSpanEnter(anchor) {
    destroyOsuWebQtipIfBound(anchor);
    clearTimers();
    showTimer = window.setTimeout(() => {
      showTimer = 0;
      void showPopover(anchor);
    }, 110);
  }

  /** @param {HTMLElement} anchor */
  function onSpanLeave(anchor, e) {
    const rel = e.relatedTarget;
    if (rel && containsFavOrPopover(rel)) return;
    clearTimers();
    scheduleHide();
  }

  /** @param {MouseEvent} e */
  function stopMouseoverBubble(e) {
    e.stopPropagation();
  }

  /** @type {AbortController|null} */
  let spanAbort = null;

  /** @param {HTMLElement} span */
  function bindSpan(span) {
    if (span === boundSpan) return;
    unbindSpan();
    boundSpan = span;
    const ac = new AbortController();
    const opts = { signal: ac.signal };
    span.addEventListener("mouseenter", () => onSpanEnter(span), opts);
    span.addEventListener("mouseleave", (e) => onSpanLeave(span, e), opts);
    span.addEventListener("mouseover", stopMouseoverBubble, opts);
    spanAbort = ac;
  }

  function unbindSpan() {
    spanAbort?.abort();
    spanAbort = null;
    if (boundSpan) destroyOsuWebQtipIfBound(boundSpan);
    boundSpan = null;
  }

  popover.addEventListener("mouseenter", () => {
    clearTimers();
  });
  popover.addEventListener("mouseleave", (e) => {
    const rel = e.relatedTarget;
    if (rel && containsFavOrPopover(rel)) return;
    scheduleHide();
  });

  let moDebounce = 0;
  function scheduleTryBind() {
    if (moDebounce) window.clearTimeout(moDebounce);
    moDebounce = window.setTimeout(() => {
      moDebounce = 0;
      if (!document.body.contains(header)) return;
      const span = findBeatmapsetFavouriteStatSpan(header);
      if (span) bindSpan(span);
      else unbindSpan();
    }, 40);
  }

  const mo = new MutationObserver(() => scheduleTryBind());
  mo.observe(header, { childList: true, subtree: true });

  function onWinResize() {
    if (visible && boundSpan) positionPopover(boundSpan);
  }
  window.addEventListener("resize", onWinResize, { passive: true });

  scheduleTryBind();

  return () => {
    if (moDebounce) window.clearTimeout(moDebounce);
    mo.disconnect();
    window.removeEventListener("resize", onWinResize);
    spanAbort?.abort();
    spanAbort = null;
    boundSpan = null;
    clearTimers();
    hidePopover();
    popover.remove();
  };
}
