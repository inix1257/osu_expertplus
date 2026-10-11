/** /home/account/edit — OAuth “Own Clients” setup guide when creds unset. */

"use strict";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.accountEdit = (() => {
  const name = "AccountEdit";
  const { el, waitForElement, manageStyle } = OsuExpertPlus.dom;
  const auth = OsuExpertPlus.auth;

  const GUIDE_ID = "oep-oauth-guide";
  /** Fired by the settings panel when credentials are saved or cleared. */
  const CREDENTIALS_CHANGED_EVENT = "oep-osu-api-credentials-changed";
  /** How long the success message stays before the guide hides itself. */
  const DONE_HIDE_DELAY_MS = 3000;

  const CSS = `
    #${GUIDE_ID} {
      border-radius: 8px;
      background: hsl(var(--hsl-b3, 333 18% 16%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
    }
    #${GUIDE_ID}.oep-guide--done {
      display: none;
    }
    .oep-guide__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .oep-guide__icon {
      font-size: 16px;
      color: hsl(var(--hsl-pink, 333 100% 65%));
      flex-shrink: 0;
    }
    .oep-guide__title {
      font-size: 13px;
      font-weight: 700;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      flex: 1;
    }
    .oep-guide__dismiss {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.4;
      padding: 0 2px;
      line-height: 1;
      transition: opacity 150ms;
    }
    .oep-guide__dismiss:hover { opacity: 1; }

    .oep-guide__body {
      font-size: 12px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      opacity: 0.75;
      margin-bottom: 10px;
    }
    .oep-guide__body b { font-weight: 600; opacity: 1; }

    .oep-guide__footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-top: 10px;
      border-top: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
    }
    .oep-guide__status {
      flex: 1;
      font-size: 12px;
      opacity: 0.55;
    }
    .oep-guide__status--ok {
      color: #84e03a;
      opacity: 1;
    }
    .oep-guide__open-panel-btn {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .oep-guide__open-panel-btn:hover { opacity: 0.85; }
  `;

  const guideStyle = manageStyle("oep-account-edit-style", CSS);

  /**
   * The guide, kept in sync with the saved credentials until `signal` aborts.
   * @param {AbortSignal} signal
   * @returns {HTMLElement}
   */
  function buildGuide(signal) {
    const body = el(
      "div",
      { class: "oep-guide__body" },
      "Register a new application below, copy its ",
      el("b", {}, "Client ID"),
      " and ",
      el("b", {}, "Client Secret"),
      ", then paste them into the ",
      el("b", {}, "⚙ Expert+ panel"),
      " (bottom-right corner).",
    );

    const statusEl = el(
      "div",
      { class: "oep-guide__status" },
      "No credentials saved yet.",
    );

    const openBtn = el(
      "button",
      { type: "button", class: "oep-guide__open-panel-btn" },
      "⚙ Open Expert+ Settings",
    );
    openBtn.addEventListener("click", () => {
      // Trigger a click on the floating FAB to open the panel.
      document.getElementById("osu-expertplus-fab")?.click();
    });

    // Dismissing lasts for this visit only: the guide shows only while no
    // credentials are saved, so a stored dismissal could hide it for good.
    const dismissBtn = el(
      "button",
      { type: "button", class: "oep-guide__dismiss", title: "Dismiss" },
      "✕",
    );
    dismissBtn.addEventListener("click", () => {
      guide.classList.add("oep-guide--done");
    });

    const footer = el("div", { class: "oep-guide__footer" }, statusEl, openBtn);

    const guide = el(
      "div",
      { id: GUIDE_ID },
      el(
        "div",
        { class: "oep-guide__header" },
        el("i", { class: "oep-guide__icon fas fa-key" }),
        el(
          "div",
          { class: "oep-guide__title" },
          "Set up osu! Expert+ API access",
        ),
        dismissBtn,
      ),
      body,
      footer,
    );

    let hideTimer = 0;
    function syncState() {
      if (auth.isConfigured()) {
        statusEl.textContent = "✓ Credentials saved — API v2 active!";
        statusEl.className = "oep-guide__status oep-guide__status--ok";
        openBtn.style.display = "none";
        // Hide after a short delay so the user sees the success message.
        if (!hideTimer) {
          hideTimer = window.setTimeout(
            () => guide.classList.add("oep-guide--done"),
            DONE_HIDE_DELAY_MS,
          );
        }
      } else {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
        statusEl.textContent = "No credentials saved yet.";
        statusEl.className = "oep-guide__status";
        openBtn.style.display = "";
        guide.classList.remove("oep-guide--done");
      }
    }

    // B53: no polling. The panel announces saves in this tab; a save in
    // another tab is picked up when this one is shown again.
    const onVisible = () => {
      if (document.visibilityState === "visible") syncState();
    };
    window.addEventListener(CREDENTIALS_CHANGED_EVENT, syncState);
    document.addEventListener("visibilitychange", onVisible);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(hideTimer);
        window.removeEventListener(CREDENTIALS_CHANGED_EVENT, syncState);
        document.removeEventListener("visibilitychange", onVisible);
      },
      { once: true },
    );

    syncState();
    return guide;
  }

  /** OAuth section’s `.account-edit__input-groups` (title match or #oauth). */
  function findOAuthInputGroups() {
    const titles = document.querySelectorAll(".account-edit__section-title");
    for (const title of titles) {
      if (/oauth/i.test(title.textContent)) {
        return (
          title
            .closest(".account-edit")
            ?.querySelector(".account-edit__input-groups") ?? null
        );
      }
    }
    // Fallback: find by the named anchor (#oauth or #oauth2).
    for (const anchor of ["oauth", "oauth2"]) {
      const el =
        document.getElementById(anchor) ??
        document.querySelector(`[name="${anchor}"]`);
      if (el) {
        return (
          el
            .closest(".account-edit")
            ?.querySelector(".account-edit__input-groups") ??
          el.closest("section") ??
          null
        );
      }
    }
    return null;
  }

  /**
   * @param {RegExpMatchArray} _match
   * @param {{ signal?: AbortSignal }} [ctx]
   */
  async function init(_match, ctx = {}) {
    const ac = new AbortController();
    const cleanup = () => {
      ac.abort();
      document.getElementById(GUIDE_ID)?.remove();
      guideStyle.remove();
    };
    // B53: nothing to set up.
    if (auth.isConfigured()) return cleanup;

    guideStyle.inject();

    // Wait for the React-rendered OAuth section to appear.
    let inputGroups;
    try {
      await waitForElement(".account-edit__section-title", {
        timeout: 10000,
        signal: ctx.signal,
      });
      inputGroups = findOAuthInputGroups();
    } catch {
      return cleanup;
    }
    if (!inputGroups || ctx.signal?.aborted) return cleanup;

    inputGroups.prepend(buildGuide(ac.signal));
    return cleanup;
  }

  return { name, init };
})();
