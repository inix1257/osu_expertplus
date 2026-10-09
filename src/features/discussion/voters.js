/**
 * Discussion vote tooltips (WS-30, moved from beatmap-detail.js): turns the
 * voters avatar tooltip into a scrollable list of names, filled in from the
 * API as rows scroll into view.
 */

import {
  beatmapsetIdFromPath,
  isBeatmapsetDiscussion,
} from "../../core/routes.js";

/** id → { id, username, avatarUrl }, shared across pages. */
const DISCUSSION_USER_CACHE = new Map();

/**
 * Enhances voters avatar tooltips into a scrollable user list.
 * @param {number} beatmapsetId  The page's set; tooltips elsewhere are left alone.
 * @returns {() => void}
 */
export function startDiscussionVotersTooltips(beatmapsetId) {
  const { el } = OsuExpertPlus.dom;
  const ENHANCED_ATTR = "data-oep-discussion-voters-tooltip";
  const USER_ROW_ATTR = "data-oep-voter-user-id";
  const inFlight = new Map();
  const queue = [];
  let activeFetches = 0;
  const MAX_CONCURRENT = 4;

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

  const scheduleUserFetch = (id, onDone) => {
    if (!id) return;
    if (DISCUSSION_USER_CACHE.has(id)) {
      onDone?.(DISCUSSION_USER_CACHE.get(id));
      return;
    }
    if (inFlight.has(id)) {
      inFlight.get(id).then((data) => onDone?.(data));
      return;
    }

    queue.push({ id, onDone });
    const pump = () => {
      while (activeFetches < MAX_CONCURRENT && queue.length) {
        const next = queue.shift();
        if (!next || !next.id) continue;
        const uid = next.id;

        if (DISCUSSION_USER_CACHE.has(uid)) {
          next.onDone?.(DISCUSSION_USER_CACHE.get(uid));
          continue;
        }
        if (inFlight.has(uid)) {
          inFlight.get(uid).then((data) => next.onDone?.(data));
          continue;
        }

        activeFetches += 1;
        const req = OsuExpertPlus.api
          .getUser(uid)
          .then((user) => {
            const data = {
              id: String(user?.id || uid),
              username: String(user?.username || `User ${uid}`),
              avatarUrl:
                String(user?.avatar_url || "").trim() ||
                `https://a.ppy.sh/${uid}`,
            };
            DISCUSSION_USER_CACHE.set(uid, data);
            return data;
          })
          .catch(() => {
            const fallback = {
              id: String(uid),
              username: `User ${uid}`,
              avatarUrl: `https://a.ppy.sh/${uid}`,
            };
            DISCUSSION_USER_CACHE.set(uid, fallback);
            return fallback;
          })
          .finally(() => {
            inFlight.delete(uid);
            activeFetches = Math.max(0, activeFetches - 1);
            pump();
          });
        inFlight.set(uid, req);
        req.then((data) => next.onDone?.(data));
      }
    };
    pump();
  };

  const hydrateVisibleRows = (container) => {
    if (!(container instanceof HTMLElement)) return () => {};
    const rows = Array.from(container.querySelectorAll(`[${USER_ROW_ATTR}]`));
    if (!rows.length) return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const row = entry.target;
          if (!(row instanceof HTMLAnchorElement)) continue;
          const uid = row.getAttribute(USER_ROW_ATTR) || "";
          if (!uid || row.getAttribute("data-oep-user-loaded") === "1") {
            observer.unobserve(row);
            continue;
          }

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
          observer.unobserve(row);
        }
      },
      { root: container, threshold: 0.01 },
    );

    rows.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  };

  const maybeEnhanceTooltip = (node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.getAttribute(ENHANCED_ATTR) === "1") return;
    if (beatmapsetIdFromPath(location.pathname) !== beatmapsetId) return;
    if (!isBeatmapsetDiscussion(location.pathname)) return;

    const role = node.getAttribute("role") || "";
    const cls = node.className || "";
    if (
      role !== "tooltip" &&
      !/\btooltip\b/i.test(cls) &&
      !/\bqtip\b/i.test(cls)
    ) {
      return;
    }
    if (isSingleUserCardTooltip(node)) return;

    const users = buildUserRowsFromTooltip(node);
    if (users.length < 1) return;

    node.setAttribute(ENHANCED_ATTR, "1");
    node.classList.add("oep-discussion-voters-tooltip");

    const list = el("div", { class: "oep-discussion-voters-tooltip__list" });
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

    node.replaceChildren(list);
    hydrateVisibleRows(list);
  };

  const processExisting = () => {
    const tips = document.querySelectorAll('[role="tooltip"], .tooltip, .qtip');
    tips.forEach((tip) => maybeEnhanceTooltip(tip));
  };

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        maybeEnhanceTooltip(n);
        n.querySelectorAll?.('[role="tooltip"], .tooltip, .qtip').forEach(
          (tip) => maybeEnhanceTooltip(tip),
        );
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  processExisting();

  return () => {
    obs.disconnect();
    document.querySelectorAll(`[${ENHANCED_ATTR}]`).forEach((n) => {
      n.removeAttribute(ENHANCED_ATTR);
      n.classList.remove("oep-discussion-voters-tooltip");
    });
  };
}
