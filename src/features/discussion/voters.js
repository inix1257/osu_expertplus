/**
 * Discussion vote tooltips (WS-30, moved from beatmap-detail.js): turns the
 * voters avatar tooltip into a scrollable list of names, filled in from the
 * API as rows scroll into view.
 */

import { observe } from "../../core/observe.js";
import {
  beatmapsetIdFromPath,
  isBeatmapsetDiscussion,
} from "../../core/routes.js";

/** Successful lookups kept across pages; oldest dropped past this size. */
const USER_CACHE_LIMIT = 500;
/**
 * id → { id, username, avatarUrl }. Only successful lookups are cached, so
 * a failed request is retried the next time the row is shown.
 * @type {Map<string, { id: string, username: string, avatarUrl: string }>}
 */
const userCache = new Map();

/** @param {string} id */
function cachedUser(id) {
  const user = userCache.get(id);
  if (user) {
    // Refresh recency.
    userCache.delete(id);
    userCache.set(id, user);
  }
  return user;
}

/** @param {{ id: string, username: string, avatarUrl: string }} user */
function cacheUser(user) {
  userCache.delete(user.id);
  userCache.set(user.id, user);
  while (userCache.size > USER_CACHE_LIMIT) {
    userCache.delete(userCache.keys().next().value);
  }
}

/** Tooltip roots this feature rewrites (qTip's own root, B60). */
const TOOLTIP_SEL = ".qtip";

/**
 * Enhances voters avatar tooltips into a scrollable user list.
 * @param {number} beatmapsetId  The page's set; tooltips elsewhere are left alone.
 * @returns {() => void}
 */
export function startDiscussionVotersTooltips(beatmapsetId) {
  const { el } = OsuExpertPlus.dom;
  const ENHANCED_ATTR = "data-oep-discussion-voters-tooltip";
  const USER_ROW_ATTR = "data-oep-voter-user-id";
  /** Our list inside the qTip root; qTip's own children are only hidden. */
  const LIST_ATTR = "data-oep-voters-list";
  const HIDDEN_ORIGINAL_ATTR = "data-oep-voters-hidden";
  let disposed = false;
  /** id → callbacks waiting for the next batch. @type {Map<string, Set<Function>>} */
  const waiting = new Map();
  let flushTimer = 0;
  /** IntersectionObserver disconnects, run on cleanup (B61). @type {Set<() => void>} */
  const rowObservers = new Set();

  const parseUserIdFromHref = (href) => {
    const m = String(href || "").match(/\/users\/(\d+)(?:\/|$)/i);
    return m ? m[1] : "";
  };

  const extractNameFromNode = (node, fallbackId) => {
    if (!(node instanceof Element))
      return fallbackId ? `User ${fallbackId}` : "User";
    const val =
      node.getAttribute("title") ||
      node.getAttribute("aria-label") ||
      node.getAttribute("data-tooltip") ||
      node.getAttribute("alt") ||
      node.textContent ||
      "";
    const cleaned = String(val).replace(/\s+/g, " ").trim();
    return cleaned || (fallbackId ? `User ${fallbackId}` : "User");
  };

  const buildUserRowsFromTooltip = (tooltip) => {
    const users = [];
    const seen = new Set();
    const pushUser = (idRaw, avatarRaw, nameRaw) => {
      const id = String(idRaw || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      users.push({
        id,
        href: `/users/${id}`,
        avatar: String(avatarRaw || "").trim(),
        name: String(nameRaw || "").trim() || `User ${id}`,
      });
    };

    // Primary shape: anchors directly linking to /users/{id}.
    const links = Array.from(tooltip.querySelectorAll('a[href*="/users/"]'));
    for (const link of links) {
      if (!(link instanceof HTMLAnchorElement)) continue;
      const href = link.href || link.getAttribute("href") || "";
      const id = parseUserIdFromHref(href);
      if (!id) continue;
      const img = link.querySelector("img");
      const avatar = img instanceof HTMLImageElement ? img.src : "";
      const name = extractNameFromNode(link, id);
      pushUser(id, avatar, name);
    }

    // Fallback shape: nodes carrying data-user-id (common in some vote tooltips).
    const userIdNodes = Array.from(tooltip.querySelectorAll("[data-user-id]"));
    for (const node of userIdNodes) {
      if (!(node instanceof HTMLElement)) continue;
      const id = String(node.getAttribute("data-user-id") || "").trim();
      if (!id) continue;
      const img = node.querySelector("img");
      const avatar = img instanceof HTMLImageElement ? img.src : "";
      const name = extractNameFromNode(node, id);
      pushUser(id, avatar, name);
    }

    // Final fallback: avatar-only nodes that still expose osu avatar URL with numeric id.
    const imgs = Array.from(tooltip.querySelectorAll("img"));
    for (const img of imgs) {
      if (!(img instanceof HTMLImageElement)) continue;
      const src = String(img.src || "");
      const m = src.match(/https?:\/\/a\.ppy\.sh\/(\d+)(?:\b|\/|\?)/i);
      if (!m) continue;
      const id = m[1];
      const anchor = img.closest('a[href*="/users/"]');
      const name = extractNameFromNode(anchor || img, id);
      pushUser(id, src, name);
    }

    return users;
  };

  const isSingleUserCardTooltip = (tooltip) => {
    if (!(tooltip instanceof HTMLElement)) return false;
    const cardRoot = tooltip.querySelector(
      '[class*="user-card"], [class*="profile-card"], [class*="user-popup"]',
    );
    if (cardRoot) return true;

    const allClasses = [
      tooltip.className,
      ...Array.from(tooltip.querySelectorAll("[class]")).map(
        (n) => n.className,
      ),
    ]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return /\buser-card\b|\bprofile-card\b|\buser-popup\b/.test(allClasses);
  };

  /**
   * Looks the user up with one batched `/users?ids[]=` request per flush
   * instead of one `/users/{id}` request each. `onDone(null)` when the
   * lookup failed or the user is missing; the row then keeps what the
   * tooltip already showed (B60).
   * @param {string} id
   * @param {(u: { id: string, username: string, avatarUrl: string } | null) => void} onDone
   */
  const scheduleUserFetch = (id, onDone) => {
    if (!id) return;
    const hit = cachedUser(id);
    if (hit) {
      onDone(hit);
      return;
    }
    let set = waiting.get(id);
    if (!set) {
      set = new Set();
      waiting.set(id, set);
    }
    set.add(onDone);
    if (!flushTimer) flushTimer = window.setTimeout(flush, 30);
  };

  const flush = () => {
    flushTimer = 0;
    const batch = new Map(waiting);
    waiting.clear();
    if (!batch.size) return;
    const settle = (users) => {
      if (disposed) return;
      const byId = new Map();
      for (const user of users) {
        const id = String(user?.id ?? "");
        if (!id) continue;
        const data = {
          id,
          username: String(user.username || `User ${id}`),
          avatarUrl:
            String(user.avatar_url || "").trim() || `https://a.ppy.sh/${id}`,
        };
        cacheUser(data);
        byId.set(id, data);
      }
      for (const [id, callbacks] of batch) {
        const data = byId.get(id) ?? null;
        for (const cb of callbacks) cb(data);
      }
    };
    Promise.resolve()
      .then(() => OsuExpertPlus.api.getUsers([...batch.keys()]))
      .then(settle, () => settle([]));
  };

  /**
   * Fills in rows as they scroll into view.
   * @param {HTMLElement} container
   */
  const hydrateVisibleRows = (container) => {
    const rows = Array.from(container.querySelectorAll(`[${USER_ROW_ATTR}]`));
    if (!rows.length) return;
    let remaining = rows.length;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const row = entry.target;
          if (!(row instanceof HTMLAnchorElement)) continue;
          const uid = row.getAttribute(USER_ROW_ATTR) || "";
          if (uid && row.getAttribute("data-oep-user-loaded") !== "1") {
            scheduleUserFetch(uid, (u) => {
              if (!u || !row.isConnected) return;
              const img = row.querySelector(
                ".oep-discussion-voters-tooltip__avatar",
              );
              const name = row.querySelector(
                ".oep-discussion-voters-tooltip__name",
              );
              if (img instanceof HTMLImageElement) {
                img.src = u.avatarUrl;
                img.alt = u.username;
              }
              if (name instanceof HTMLElement) name.textContent = u.username;
              row.href = `/users/${u.id}`;
              row.setAttribute("data-oep-user-loaded", "1");
            });
          }
          observer.unobserve(row);
          remaining -= 1;
          if (remaining <= 0) disconnect();
        }
      },
      { root: container, threshold: 0.01 },
    );
    const disconnect = () => {
      observer.disconnect();
      rowObservers.delete(disconnect);
    };
    rowObservers.add(disconnect);
    rows.forEach((r) => observer.observe(r));
  };

  const maybeEnhanceTooltip = (node) => {
    if (!(node instanceof HTMLElement)) return;
    if (!node.classList.contains("qtip")) return;
    if (node.getAttribute(ENHANCED_ATTR) === "1") return;
    if (beatmapsetIdFromPath(location.pathname) !== beatmapsetId) return;
    if (!isBeatmapsetDiscussion(location.pathname)) return;
    if (isSingleUserCardTooltip(node)) return;

    const users = buildUserRowsFromTooltip(node);
    if (users.length < 1) return;

    node.setAttribute(ENHANCED_ATTR, "1");
    node.classList.add("oep-discussion-voters-tooltip");

    const list = el("div", {
      class: "oep-discussion-voters-tooltip__list",
      [LIST_ATTR]: "1",
    });
    for (const u of users) {
      const row = el(
        "a",
        {
          class: "oep-discussion-voters-tooltip__row",
          href: u.href,
          [USER_ROW_ATTR]: String(u.id),
        },
        el("img", {
          class: "oep-discussion-voters-tooltip__avatar",
          src: u.avatar || `https://a.ppy.sh/${u.id}`,
          alt: u.name,
          loading: "lazy",
        }),
        el("span", { class: "oep-discussion-voters-tooltip__name" }, u.name),
      );
      list.appendChild(row);
    }

    // Hide qTip's own nodes instead of removing them (B60): qTip keeps
    // references to its content and tip elements.
    for (const child of Array.from(node.children)) {
      if (!(child instanceof HTMLElement) || child.hidden) continue;
      child.hidden = true;
      child.setAttribute(HIDDEN_ORIGINAL_ATTR, "1");
    }
    node.appendChild(list);
    hydrateVisibleRows(list);
  };

  const unsubscribe = observe.subscribe(
    { selector: TOOLTIP_SEL, schedule: "sync", label: "discussion/voters" },
    ({ added }) => {
      for (const node of added) {
        if (!(node instanceof HTMLElement)) continue;
        maybeEnhanceTooltip(node);
        node
          .querySelectorAll(TOOLTIP_SEL)
          .forEach((tip) => maybeEnhanceTooltip(tip));
      }
    },
  );
  document
    .querySelectorAll(TOOLTIP_SEL)
    .forEach((tip) => maybeEnhanceTooltip(tip));

  return () => {
    disposed = true;
    unsubscribe();
    window.clearTimeout(flushTimer);
    waiting.clear();
    for (const disconnect of [...rowObservers]) disconnect();
    document.querySelectorAll(`[${ENHANCED_ATTR}]`).forEach((n) => {
      n.querySelectorAll(`[${LIST_ATTR}]`).forEach((list) => list.remove());
      n.querySelectorAll(`[${HIDDEN_ORIGINAL_ATTR}]`).forEach((child) => {
        child.removeAttribute(HIDDEN_ORIGINAL_ATTR);
        child.hidden = false;
      });
      n.removeAttribute(ENHANCED_ATTR);
      n.classList.remove("oep-discussion-voters-tooltip");
    });
  };
}
