/**
 * Header: one-line pill under the chat/notification counter showing the newest unread item.
 * Reads osu-web's in-memory notification store (`osuCore.dataStore.notificationStore`); the only
 * requests are read-only GETs on hover to show a comment / discussion post in full, so nothing
 * gets marked as read.
 */

/* global unsafeWindow */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.navRecentNotification = (() => {
  const { el, manageStyle } = OsuExpertPlus.dom;
  const { IDS } = OsuExpertPlus.settings;

  const FEATURE_ID = IDS.NAV_RECENT_NOTIFICATION;
  const STYLE_ID = "osu-expertplus-nav-recent-notification";
  const PILL_CLASS = "oep-nav-recent";
  const TIP_CLASS = "oep-nav-recent-tip";
  /** Vertical gap between the counter pill and ours (px). */
  const GAP_PX = 4;
  /** Tooltip offset below / right of the cursor (px). */
  const TIP_OFFSET_PX = 16;
  const TICK_MS = 1000;
  /** osu-web cuts notification `content` and appends this. */
  const TRUNCATION_SUFFIX = "...";

  const CSS = `
    .${PILL_CLASS} {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 5px;
      height: 20px;
      padding: 0 8px;
      border: 2px solid #fff;
      border-radius: 30px;
      color: #fff;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      cursor: pointer;
      z-index: 1;
    }
    .${PILL_CLASS}[hidden],
    .nav2:has(.nav-click-popup.js-click-menu--active) .${PILL_CLASS},
    body:has(.nav2 .nav-click-popup.js-click-menu--active) .${TIP_CLASS} {
      display: none;
    }
    .${PILL_CLASS}:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }
    .${PILL_CLASS}__icon {
      flex-shrink: 0;
      font-size: 10px;
    }
    .${PILL_CLASS}__text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .${TIP_CLASS} {
      position: fixed;
      z-index: 10000;
      box-sizing: border-box;
      max-width: min(420px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: hidden;
      padding: 6px 10px;
      border-radius: 6px;
      background: rgb(24, 23, 28);
      color: #fff;
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      pointer-events: none;
    }
    .${TIP_CLASS}[hidden] {
      display: none;
    }
  `;
  const style = manageStyle(STYLE_ID, CSS);

  /** @returns {Window & typeof globalThis} */
  function pageWin() {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (_) {
      void 0;
    }
    return window;
  }

  /** Newest unread notification in osu-web's store, or null. */
  function latestUnread() {
    const store = pageWin().osuCore?.dataStore?.notificationStore;
    const map = store?.notifications;
    if (!map || typeof map.values !== "function") return null;
    let best = null;
    for (const n of map.values()) {
      if (!n || n.isRead || n.isDeleting) continue;
      if (!best || n.id > best.id) best = n;
    }
    return best;
  }

  /**
   * "username: content" (comments keep ` on "title"`); items without a body
   * (new beatmap, rank, …) fall back to osu's own localized message.
   * @param {object} n osu-web Notification model
   * @param {string} [fullContent] untruncated body, when fetched
   */
  function describe(n, fullContent) {
    const details = n.details || {};
    const username = details.username || "";
    const withUser = (body) => (username ? `${username}: ${body}` : body);

    if (n.category === "channel") return withUser(details.title || "");

    const content = fullContent ?? details.content;
    if (content) {
      return n.name === "comment_new" && n.title
        ? withUser(`${content} on "${n.title}"`)
        : withUser(content);
    }

    const lang = pageWin().Lang;
    const key = `notifications.item.${n.displayType}.${n.category}.${n.name}`;
    try {
      if (lang?.has?.(key)) {
        return String(lang.get(key, { ...details, title: n.title }));
      }
    } catch (_) {
      void 0;
    }
    return withUser(n.title || details.title || n.name);
  }

  /** Notification `content` without osu's truncation suffix, or null if it was not cut. */
  function truncatedPrefix(content) {
    if (typeof content !== "string") return null;
    if (!content.endsWith(TRUNCATION_SUFFIX)) return null;
    return content.slice(0, -TRUNCATION_SUFFIX.length).trim();
  }

  const normalizeSpace = (s) => s.replace(/\s+/g, " ").trim();

  /** @returns {Promise<string|null>} full comment markdown */
  async function fetchCommentContent(n) {
    const id = n.details?.comment_id;
    if (!id) return null;
    const resp = await OsuExpertPlus.api.siteFetch(
      `https://osu.ppy.sh/comments/${id}`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const comment = (json.comments || []).find((c) => c.id === id);
    return typeof comment?.message === "string" ? comment.message : null;
  }

  /**
   * Discussion posts are only JSON on /api/v2 (needs OAuth), so read the site's
   * posts page and match the post by author + the truncated text prefix.
   * @returns {Promise<string|null>}
   */
  async function fetchDiscussionPostContent(n) {
    const details = n.details || {};
    const prefix = truncatedPrefix(details.content);
    if (!details.discussion_id || prefix == null) return null;
    const usp = new URLSearchParams({
      beatmapset_discussion_id: String(details.discussion_id),
    });
    usp.append("types[]", "first");
    usp.append("types[]", "reply");
    const resp = await OsuExpertPlus.api.siteFetch(
      `https://osu.ppy.sh/beatmapsets/discussions/posts?${usp}`,
    );
    if (!resp.ok) return null;
    const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
    const userHref = `/users/${n.sourceUserId}`;
    const want = normalizeSpace(prefix);
    for (const post of doc.querySelectorAll(".beatmap-discussion-post")) {
      const link = post.querySelector(".beatmap-discussion-user-card__user-link");
      if (!link?.getAttribute("href")?.endsWith(userHref)) continue;
      const msg = post.querySelector(".beatmap-discussion-post__message");
      const text = msg?.textContent?.trim();
      if (text && normalizeSpace(text).startsWith(want)) return text;
    }
    return null;
  }

  /** @type {Map<number, Promise<string|null>>} notification id → full body */
  const fullContentCache = new Map();

  /** Full body for truncated comments / discussion posts (read-only GETs), else null. */
  function loadFullContent(n) {
    if (fullContentCache.has(n.id)) return fullContentCache.get(n.id);
    let task = null;
    if (truncatedPrefix(n.details?.content) != null) {
      if (n.name === "comment_new") task = fetchCommentContent(n);
      else if (n.category === "beatmapset_discussion") {
        task = fetchDiscussionPostContent(n);
      }
    }
    const promise = (task || Promise.resolve(null)).catch(() => null);
    fullContentCache.set(n.id, promise);
    return promise;
  }

  /**
   * @param {{ isEnabled: function(string): boolean, onChange: function(string, function(boolean)): function }} settingsApi
   * @returns {function} teardown
   */
  function install(settingsApi) {
    let timer = null;
    let pill = null;
    let tip = null;
    /** Notification currently shown in the pill. */
    let current = null;
    let hovering = false;

    const onResize = () => tick();

    function positionTip(clientX, clientY) {
      if (!tip || tip.hidden) return;
      const margin = 8;
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      let left = clientX + TIP_OFFSET_PX;
      left = Math.min(left, window.innerWidth - w - margin);
      left = Math.max(left, margin);
      let top = clientY + TIP_OFFSET_PX;
      // Prefer below the cursor; only flip up if it would leave the viewport.
      if (top + h > window.innerHeight - margin) {
        top = Math.max(margin, clientY - TIP_OFFSET_PX - h);
      }
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    }

    let lastPointer = { x: 0, y: 0 };

    function showTip(n) {
      if (!tip) {
        tip = el("div", { class: TIP_CLASS, hidden: "" });
        document.body.appendChild(tip);
      }
      tip.textContent = describe(n);
      tip.hidden = false;
      positionTip(lastPointer.x, lastPointer.y);
      loadFullContent(n).then((full) => {
        if (!full || !hovering || current !== n || !tip) return;
        tip.textContent = describe(n, full);
        positionTip(lastPointer.x, lastPointer.y);
      });
    }

    function hideTip() {
      if (tip) tip.hidden = true;
    }

    function ensurePill(container) {
      const col = container.parentElement;
      if (pill && pill.parentElement === col) return pill;
      pill?.remove();
      pill = el(
        "div",
        { class: PILL_CLASS, hidden: "" },
        el("i", { class: `${PILL_CLASS}__icon` }),
        el("span", { class: `${PILL_CLASS}__text` }),
      );
      pill.addEventListener("click", () => {
        const id = pill.dataset.oepTarget;
        if (id) document.getElementById(id)?.click();
      });
      pill.addEventListener("mouseenter", (e) => {
        hovering = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        if (current) showTip(current);
      });
      pill.addEventListener("mousemove", (e) => {
        lastPointer = { x: e.clientX, y: e.clientY };
        positionTip(e.clientX, e.clientY);
      });
      pill.addEventListener("mouseleave", () => {
        hovering = false;
        hideTip();
      });
      col.appendChild(pill);
      current = null;
      return pill;
    }

    /** Left edge: the Twitter nav button when present, else the counter pill itself. */
    function leftEdgeRect(container) {
      const group = container.closest(".nav2__colgroup") || document;
      const twitter = group.querySelector(".nav-button--twitter");
      const r = twitter?.getBoundingClientRect();
      return r && r.width > 0 ? r : container.getBoundingClientRect();
    }

    function tick() {
      const container = document.querySelector(
        ".nav2 .nav2__notification-container",
      );
      if (!container?.parentElement) {
        pill?.remove();
        pill = null;
        hideTip();
        return;
      }
      const p = ensurePill(container);
      const n = latestUnread();
      // Counter pill hidden (mobile layout) or nothing unread.
      if (!n || !container.offsetParent) {
        p.hidden = true;
        current = null;
        hideTip();
        return;
      }

      if (n !== current) {
        current = n;
        const isChat = n.category === "channel";
        p.dataset.oepTarget = isChat
          ? "notification-widget-chat-icon"
          : "notification-widget-icon";
        p.firstChild.className = `${PILL_CLASS}__icon fas ${
          isChat ? "fa-comment-alt" : "fa-bell"
        }`;
        p.lastChild.textContent = describe(n);
        if (hovering) showTip(n);
      }

      // Right edge matches the counter pill; left edge reaches the Twitter button.
      p.hidden = false;
      const base = p.offsetParent;
      if (!base) return;
      const b = base.getBoundingClientRect();
      const r = container.getBoundingClientRect();
      const left = leftEdgeRect(container).left;
      p.style.left = `${left - b.left - base.clientLeft}px`;
      p.style.width = `${r.right - left}px`;
      p.style.top = `${r.bottom - b.top - base.clientTop + GAP_PX}px`;
    }

    function start() {
      if (timer) return;
      style.inject();
      tick();
      timer = setInterval(tick, TICK_MS);
      window.addEventListener("resize", onResize);
    }

    function stop() {
      clearInterval(timer);
      timer = null;
      window.removeEventListener("resize", onResize);
      pill?.remove();
      pill = null;
      tip?.remove();
      tip = null;
      current = null;
      hovering = false;
      style.remove();
    }

    const apply = (enabled) => (enabled ? start() : stop());
    apply(settingsApi.isEnabled(FEATURE_ID));
    const unsub = settingsApi.onChange(FEATURE_ID, apply);
    return () => {
      unsub();
      stop();
    };
  }

  return { install };
})();
