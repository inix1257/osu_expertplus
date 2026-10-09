/**
 * Header: one-line pill under the chat/notification counter showing the newest unread item.
 * Reads osu-web's in-memory notification store (`osuCore.dataStore.notificationStore`) only —
 * no requests, so nothing gets marked as read.
 */

/* global unsafeWindow */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.navRecentNotification = (() => {
  const { el, manageStyle } = OsuExpertPlus.dom;
  const { IDS } = OsuExpertPlus.settings;

  const FEATURE_ID = IDS.NAV_RECENT_NOTIFICATION;
  const STYLE_ID = "osu-expertplus-nav-recent-notification";
  const PILL_CLASS = "oep-nav-recent";
  /** Vertical gap between the counter pill and ours (px). */
  const GAP_PX = 4;
  const TICK_MS = 1000;

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
    .${PILL_CLASS}[hidden] {
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

  /** One-line text for a notification (osu's own localized message when available). */
  function describe(n) {
    const details = n.details || {};
    const username = details.username || "";
    if (n.category === "channel") {
      const msg = details.title || "";
      return username ? `${username}: ${msg}` : msg;
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
    const body = details.content || n.title || details.title || n.name;
    return username ? `${username}: ${body}` : String(body);
  }

  /**
   * @param {{ isEnabled: function(string): boolean, onChange: function(string, function(boolean)): function }} settingsApi
   * @returns {function} teardown
   */
  function install(settingsApi) {
    let timer = null;
    let pill = null;
    let lastKey = null;

    const onResize = () => tick();

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
      col.appendChild(pill);
      lastKey = null;
      return pill;
    }

    function tick() {
      const container = document.querySelector(
        ".nav2 .nav2__notification-container",
      );
      if (!container?.parentElement) {
        pill?.remove();
        pill = null;
        return;
      }
      const p = ensurePill(container);
      const n = latestUnread();
      // Counter pill hidden (mobile layout) or nothing unread.
      if (!n || !container.offsetParent) {
        p.hidden = true;
        return;
      }

      const key = `${n.id}`;
      if (key !== lastKey) {
        lastKey = key;
        const isChat = n.category === "channel";
        const text = describe(n);
        p.dataset.oepTarget = isChat
          ? "notification-widget-chat-icon"
          : "notification-widget-icon";
        p.firstChild.className = `${PILL_CLASS}__icon fas ${
          isChat ? "fa-comment-alt" : "fa-bell"
        }`;
        p.lastChild.textContent = text;
        p.title = text;
      }

      // Same horizontal extent as the counter pill, just below it (rects keep subpixels).
      p.hidden = false;
      const base = p.offsetParent;
      if (!base) return;
      const b = base.getBoundingClientRect();
      const r = container.getBoundingClientRect();
      p.style.left = `${r.left - b.left - base.clientLeft}px`;
      p.style.width = `${r.width}px`;
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
      lastKey = null;
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
