/** FAB + modal: feature toggles, osu OAuth, OMDB key. init() once; survives SPA (re-attach if body replaced). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.settingsPanel = (() => {
  const { el } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;
  const auth = OsuExpertPlus.auth;
  const omdb = OsuExpertPlus.omdb;

  const ROOT_ID = "osu-expertplus-settings";
  const FAB_ANCHOR_ID = "osu-expertplus-fab-anchor";
  const OPEN_CLASS = "osu-expertplus-settings--open";
  const SECTION_COLLAPSED_CLASS = "osu-expertplus-panel__section--collapsed";
  const FAB_NEEDS_API_CLASS = "osu-expertplus-fab-anchor--needs-api";
  const MODDED_SR_ROW_ATTR = "data-oep-settings-row-modded-sr";

  /** Set in init(); drives osu! API warning chip + panel offset. */
  const fabUi = { anchor: null, panel: null };

  function applyModdedStarRowLockState(row) {
    const locked = !auth.isConfigured();
    row.classList.toggle("osu-expertplus-panel__row--oauth-required", locked);
    if (locked) {
      row.title =
        "Requires osu! API OAuth credentials. Add Client ID and Secret in the section above.";
    } else {
      row.removeAttribute("title");
    }
    const input = row.querySelector(".osu-expertplus-toggle input");
    if (input instanceof HTMLInputElement) {
      input.tabIndex = locked ? -1 : 0;
    }
    row.classList.toggle(
      "osu-expertplus-panel__row--with-feature-hint",
      locked,
    );
    const hint = row.querySelector("[data-oep-modded-sr-hint]");
    if (hint) {
      if (locked) {
        hint.hidden = false;
        hint.textContent =
          "Requires osu! API OAuth credentials — add Client ID and Secret in the section above.";
      } else {
        hint.hidden = true;
        hint.textContent = "";
      }
    }
  }

  function refreshModdedStarRatingRowLock() {
    const row = fabUi.panel?.querySelector?.(`[${MODDED_SR_ROW_ATTR}]`);
    if (row instanceof HTMLElement) applyModdedStarRowLockState(row);
  }

  function syncPanelAboveFab() {
    const { anchor, panel } = fabUi;
    if (!anchor?.isConnected || !panel?.isConnected) return;
    const top = anchor.getBoundingClientRect().top;
    const gap = 10;
    panel.style.bottom = `${Math.round(window.innerHeight - top + gap)}px`;
  }

  function refreshFabOsuApiWarning() {
    const { anchor } = fabUi;
    if (!anchor) return;
    anchor.classList.toggle(FAB_NEEDS_API_CLASS, !auth.isConfigured());
    syncPanelAboveFab();
  }

  function credentialSectionTitle(kind, filled) {
    if (kind === "osu") {
      return filled
        ? "osu! API credentials — saved"
        : "osu! API credentials — not set";
    }
    return filled ? "OMDB API key — saved" : "OMDB API key — not set";
  }

  const CSS = `
    #${FAB_ANCHOR_ID} {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      max-width: min(320px, calc(100vw - 48px));
    }

    .osu-expertplus-fab-api-warning {
      display: none;
      align-items: center;
      gap: 7px;
      padding: 5px 11px 5px 9px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      line-height: 1.35;
      color: hsl(48 92% 62%);
      background: linear-gradient(
        165deg,
        hsl(38 32% 18%) 0%,
        hsl(32 28% 14%) 100%
      );
      border: 1px solid hsl(40 42% 32%);
      box-shadow:
        0 2px 10px rgba(0,0,0,.4),
        0 0 0 1px rgba(0,0,0,.2) inset;
    }
    .${FAB_NEEDS_API_CLASS} .osu-expertplus-fab-api-warning {
      display: flex;
    }
    .osu-expertplus-fab-api-warning__icon {
      flex-shrink: 0;
      font-size: 11px;
      opacity: 0.95;
      filter: drop-shadow(0 0 6px hsl(48 90% 45% / 0.45));
    }
    .osu-expertplus-fab-api-warning__text {
      min-width: 0;
    }

    #osu-expertplus-fab {
      position: relative;
      flex-shrink: 0;
      box-sizing: border-box;
      min-height: 44px;
      padding: 0 16px 0 12px;
      border-radius: 22px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 28%));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.02em;
      background: hsl(var(--hsl-b4, 333 18% 20%));
      color: hsl(var(--hsl-l1, 0 0% 92%));
      box-shadow:
        0 2px 10px rgba(0,0,0,.45),
        0 0 0 1px rgba(0,0,0,.12) inset;
      transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease;
      opacity: 0.88;
      -webkit-tap-highlight-color: transparent;
    }
    #osu-expertplus-fab:hover {
      background: hsl(var(--hsl-b5, 333 18% 28%));
      border-color: hsl(var(--hsl-b5, 333 18% 36%));
      opacity: 1;
      box-shadow:
        0 4px 18px rgba(0,0,0,.5),
        0 0 0 1px rgba(255,255,255,.04) inset;
    }
    #osu-expertplus-fab:focus-visible {
      outline: 2px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 3px;
    }
    #osu-expertplus-fab:active {
      transform: translateY(1px);
      box-shadow: 0 1px 8px rgba(0,0,0,.4);
    }
    .osu-expertplus-fab__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      font-size: 16px;
      color: hsl(var(--hsl-c2, 333 60% 72%));
      transition: transform 180ms ease, color 160ms ease;
    }
    #osu-expertplus-fab:hover .osu-expertplus-fab__icon {
      color: hsl(var(--hsl-l1, 0 0% 96%));
      transform: rotate(35deg);
    }
    .osu-expertplus-fab__label {
      display: flex;
      align-items: baseline;
      white-space: nowrap;
    }
    .osu-expertplus-fab__brand-accent {
      font-weight: 800;
      letter-spacing: 0.04em;
      color: hsl(var(--hsl-pink, 333 100% 72%));
      text-shadow: 0 0 20px hsl(var(--hsl-pink, 333 100% 65%) / 0.35);
    }

    #osu-expertplus-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0,0,0,.5);
    }
    #osu-expertplus-backdrop.${OPEN_CLASS} { display: block; }

    #${ROOT_ID} {
      display: none;
      position: fixed;
      bottom: 80px;
      left: 24px;
      z-index: 9999;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px;
      background: hsl(var(--hsl-b2, 333 18% 12%));
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
      font-family: inherit;
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    #${ROOT_ID}.${OPEN_CLASS} {
      display: block;
      animation: osu-expertplus-slide-in 150ms ease-out;
    }
    @keyframes osu-expertplus-slide-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .osu-expertplus-panel__header {
      padding: 14px 16px 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      border-bottom: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
    }

    .osu-expertplus-panel__section {
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
      background: hsl(var(--hsl-b2, 333 18% 12%));
    }
    .osu-expertplus-panel__section:last-of-type { border-bottom: none; }

    .osu-expertplus-panel__footer {
      padding: 10px 16px 12px;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      font-size: 11px;
      line-height: 1.45;
      color: hsl(var(--hsl-l2, 0 0% 72%));
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .osu-expertplus-panel__footer-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
    }
    .osu-expertplus-panel__footer-reset {
      margin: 0;
      padding: 3px 9px;
      border: 1px solid hsl(var(--hsl-b5, 333 18% 30%));
      border-radius: 5px;
      background: hsl(var(--hsl-b4, 333 18% 18%));
      color: hsl(var(--hsl-l2, 0 0% 72%));
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.3;
      cursor: pointer;
      transition:
        background 140ms ease,
        border-color 140ms ease,
        color 140ms ease;
    }
    .osu-expertplus-panel__footer-reset:hover {
      background: hsl(var(--hsl-b5, 333 18% 24%));
      border-color: hsl(var(--hsl-b5, 333 18% 38%));
      color: hsl(var(--hsl-l1, 0 0% 88%));
    }
    .osu-expertplus-panel__footer-reset:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: 2px;
    }
    .osu-expertplus-panel__footer a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
    .osu-expertplus-panel__footer a:hover {
      color: hsl(var(--hsl-c2, 333 60% 82%));
    }
    .osu-expertplus-panel__footer-sep {
      margin: 0 0.45em;
      opacity: 0.45;
      user-select: none;
    }

    .osu-expertplus-panel__group-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 34px;
      padding: 8px 16px;
      border: none;
      border-top: 1px solid hsl(var(--hsl-b4, 333 18% 20%));
      background: hsl(var(--hsl-b3, 333 18% 16%));
      cursor: pointer;
      color: inherit;
    }
    .osu-expertplus-panel__group-toggle:hover {
      background: hsl(var(--hsl-b4, 333 18% 20%));
    }
    .osu-expertplus-panel__group-toggle:focus-visible {
      outline: 1px solid hsl(var(--hsl-pink, 333 100% 65%));
      outline-offset: -1px;
    }

    /* Credential section headers — osu! API */
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(145 22% 17%);
      border-top-color: hsl(145 28% 26%);
    }
    .oep-cred--osu.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(145 22% 21%);
    }
    .oep-cred--osu.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(132 48% 58%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(38 26% 16%);
      border-top-color: hsl(36 32% 24%);
    }
    .oep-cred--osu.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(38 26% 20%);
    }
    .oep-cred--osu.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(46 88% 60%);
    }

    /* Credential section headers — OMDB */
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle {
      background: hsl(210 28% 18%);
      border-top-color: hsl(210 32% 28%);
    }
    .oep-cred--omdb.oep-cred--ok > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(210 28% 22%);
    }
    .oep-cred--omdb.oep-cred--ok .osu-expertplus-panel__group-label {
      color: hsl(205 58% 70%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle {
      background: hsl(280 18% 17%);
      border-top-color: hsl(275 22% 26%);
    }
    .oep-cred--omdb.oep-cred--missing > .osu-expertplus-panel__group-toggle:hover {
      background: hsl(280 18% 21%);
    }
    .oep-cred--omdb.oep-cred--missing .osu-expertplus-panel__group-label {
      color: hsl(38 82% 62%);
    }

    .osu-expertplus-panel__group-label {
      padding: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .11em;
      text-transform: uppercase;
      color: hsl(var(--hsl-c2, 333 60% 70%));
      opacity: 0.95;
    }
    .osu-expertplus-panel__group-chevron {
      font-size: 11px;
      opacity: 0.9;
      transform: rotate(0deg);
      transition: transform 120ms ease;
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__group-chevron {
      transform: rotate(-90deg);
    }
    .osu-expertplus-panel__section-content { display: block; }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:first-child {
      border-top: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section.${SECTION_COLLAPSED_CLASS} .osu-expertplus-panel__section-content {
      display: none;
    }

    .osu-expertplus-panel__row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-bottom: 1px solid hsl(var(--hsl-b3, 333 18% 16%));
    }
    .osu-expertplus-panel__section-content .osu-expertplus-panel__row:last-child { border-bottom: none; }

    .osu-expertplus-panel__row--oauth-required {
      opacity: 0.55;
      filter: saturate(0.7);
      pointer-events: none;
      user-select: none;
      cursor: not-allowed;
    }

    .osu-expertplus-panel__text {
      flex: 1;
      min-width: 0;
    }
    .osu-expertplus-panel__label {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.25;
    }
    .osu-expertplus-panel__feature-hint {
      font-size: 10px;
      font-weight: 500;
      line-height: 1.35;
      margin-top: 4px;
      color: hsl(var(--hsl-c2, 333 60% 68%));
      opacity: 0.9;
    }
    .osu-expertplus-panel__row--with-feature-hint {
      align-items: flex-start;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .osu-expertplus-panel__row--with-feature-hint .osu-expertplus-toggle {
      margin-top: 2px;
    }

    .osu-expertplus-toggle {
      position: relative;
      flex-shrink: 0;
      width: 32px;
      height: 18px;
    }
    .osu-expertplus-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .osu-expertplus-toggle__track {
      position: absolute;
      inset: 0;
      border-radius: 100px;
      background: hsl(var(--hsl-b5, 333 18% 26%));
      cursor: pointer;
      transition: background 150ms;
    }
    .osu-expertplus-toggle__track::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: hsl(var(--hsl-l1, 0 0% 90%));
      transition: transform 150ms;
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track {
      background: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-toggle input:checked + .osu-expertplus-toggle__track::after {
      transform: translateX(14px);
    }

    .osu-expertplus-panel__creds {
      padding: 8px 16px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .osu-expertplus-panel__creds-field {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .osu-expertplus-panel__creds-field label {
      font-size: 11px;
      opacity: 0.6;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .osu-expertplus-panel__creds-field input {
      background: hsl(var(--hsl-b4, 333 18% 20%));
      border: 1px solid hsl(var(--hsl-b5, 333 18% 26%));
      border-radius: 6px;
      color: hsl(var(--hsl-l1, 0 0% 90%));
      font-family: monospace;
      font-size: 12px;
      padding: 5px 8px;
      outline: none;
      transition: border-color 150ms;
    }
    .osu-expertplus-panel__creds-field input:focus {
      border-color: hsl(var(--hsl-pink, 333 100% 65%));
    }
    .osu-expertplus-panel__creds-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .osu-expertplus-panel__creds-btn {
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      transition: opacity 150ms;
    }
    .osu-expertplus-panel__creds-btn:hover { opacity: 0.8; }
    .osu-expertplus-panel__creds-btn--save {
      background: hsl(var(--hsl-pink, 333 100% 65%));
      color: #fff;
    }
    .osu-expertplus-panel__creds-btn--clear {
      background: hsl(var(--hsl-b5, 333 18% 26%));
      color: hsl(var(--hsl-l1, 0 0% 90%));
    }
    .osu-expertplus-panel__creds-status {
      font-size: 11px;
      margin-top: 2px;
      min-height: 1.4em;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-status--ok    { color: #84e03a; }
    .osu-expertplus-panel__creds-status--error  { color: #e05c5c; }
    .osu-expertplus-panel__creds-status--info   { opacity: 0.5; }
    .osu-expertplus-panel__creds-hint {
      font-size: 11px;
      opacity: 0.45;
      line-height: 1.4;
    }
    .osu-expertplus-panel__creds-hint a {
      color: hsl(var(--hsl-c2, 333 60% 70%));
      text-decoration: underline;
    }
  `;

  function buildToggle(feature) {
    const input = el("input", { type: "checkbox" });
    input.checked = settings.isEnabled(feature.id);

    const track = el("div", { class: "osu-expertplus-toggle__track" });
    const label = el("label", { class: "osu-expertplus-toggle" }, input, track);

    input.addEventListener("change", () => {
      if (
        feature.id === settings.IDS.MODDED_STAR_RATING &&
        !auth.isConfigured()
      ) {
        input.checked = settings.isEnabled(feature.id);
        return;
      }
      settings.set(feature.id, input.checked);
    });
    settings.onChange(feature.id, (val) => {
      input.checked = val;
    });

    return label;
  }

  function buildCredentialsSection(onConfiguredChange) {
    const clientIdInput = el("input", {
      type: "text",
      placeholder: "Client ID",
      autocomplete: "off",
      spellcheck: "false",
    });

    const clientSecretInput = el("input", {
      type: "password",
      placeholder: "Client Secret",
      autocomplete: "new-password",
    });

    clientIdInput.value = GM_getValue("oep_client_id", "");
    if (GM_getValue("oep_client_secret", "")) {
      clientSecretInput.placeholder = "(saved — enter to change)";
    }

    const statusEl = el("div", {
      class:
        "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info",
    });

    function setStatus(msg, type = "info") {
      statusEl.textContent = msg;
      statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
    }

    if (auth.isConfigured()) {
      setStatus("Credentials saved. API v2 active.", "ok");
    } else {
      setStatus("No credentials — using session fallback.");
    }

    const saveBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save",
      },
      "Save",
    );
    const clearBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear",
      },
      "Clear",
    );

    saveBtn.addEventListener("click", async () => {
      const id = clientIdInput.value.trim();
      const secret =
        clientSecretInput.value.trim() || GM_getValue("oep_client_secret", "");

      if (!id || !secret) {
        setStatus("Both Client ID and Secret are required.", "error");
        return;
      }

      auth.setCredentials(id, secret);
      clientIdInput.value = id;
      clientSecretInput.value = "";
      clientSecretInput.placeholder = "(saved — enter to change)";
      setStatus("Verifying…", "info");

      try {
        await auth.getToken();
        setStatus("Credentials saved & verified. API v2 active.", "ok");
        location.reload();
      } catch (e) {
        setStatus(
          `Failed: ${e.message.replace("[osu! Expert+] ", "")}`,
          "error",
        );
      } finally {
        refreshFabOsuApiWarning();
        syncOAuthHintVisibility();
        refreshModdedStarRatingRowLock();
        onConfiguredChange?.();
        window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
      }
    });

    clearBtn.addEventListener("click", () => {
      auth.clearCredentials();
      clientIdInput.value = "";
      clientSecretInput.value = "";
      clientSecretInput.placeholder = "Client Secret";
      setStatus("Credentials cleared. Using session fallback.");
      refreshFabOsuApiWarning();
      syncOAuthHintVisibility();
      refreshModdedStarRatingRowLock();
      onConfiguredChange?.();
      window.dispatchEvent(new Event("oep-osu-api-credentials-changed"));
    });

    const hint = el("div", { class: "osu-expertplus-panel__creds-hint" });
    hint.innerHTML =
      'Create an OAuth app at <a href="https://osu.ppy.sh/home/account/edit#oauth" target="_blank">Account Settings → OAuth</a>, then paste your Client ID and Secret above.';

    function syncOAuthHintVisibility() {
      hint.hidden = auth.isConfigured();
    }
    syncOAuthHintVisibility();

    return el(
      "div",
      { class: "osu-expertplus-panel__creds" },
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "Client ID"),
        clientIdInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "Client Secret"),
        clientSecretInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-actions" },
        saveBtn,
        clearBtn,
      ),
      statusEl,
      hint,
    );
  }

  function buildOmdbCredentialsSection(onConfiguredChange) {
    const apiKeyInput = el("input", {
      type: "password",
      placeholder: "API Key",
      autocomplete: "new-password",
      spellcheck: "false",
    });

    if (omdb.isConfigured()) {
      apiKeyInput.placeholder = "(saved — enter to change)";
    }

    const statusEl = el("div", {
      class:
        "osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--info",
    });

    function setStatus(msg, type = "info") {
      statusEl.textContent = msg;
      statusEl.className = `osu-expertplus-panel__creds-status osu-expertplus-panel__creds-status--${type}`;
    }

    if (omdb.isConfigured()) {
      setStatus("API key saved.", "ok");
    } else {
      setStatus("No API key configured.");
    }

    const saveBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--save",
      },
      "Save",
    );
    const clearBtn = el(
      "button",
      {
        class:
          "osu-expertplus-panel__creds-btn osu-expertplus-panel__creds-btn--clear",
      },
      "Clear",
    );

    saveBtn.addEventListener("click", () => {
      const key = apiKeyInput.value.trim() || omdb.getApiKey();

      if (!key) {
        setStatus("API key is required.", "error");
        return;
      }

      omdb.setApiKey(key);
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "(saved — enter to change)";
      setStatus("API key saved.", "ok");
      syncOmdbHintVisibility();
      onConfiguredChange?.();
    });

    clearBtn.addEventListener("click", () => {
      omdb.clearApiKey();
      apiKeyInput.value = "";
      apiKeyInput.placeholder = "API Key";
      setStatus("API key cleared.");
      syncOmdbHintVisibility();
      onConfiguredChange?.();
    });

    const hint = el("div", { class: "osu-expertplus-panel__creds-hint" });
    hint.innerHTML =
      'Sign in at <a href="https://omdb.nyahh.net/settings/" target="_blank" rel="noopener noreferrer">omdb.nyahh.net/settings</a>. Create a new application (the name may be anything). When OMDB shows your API key, copy it and paste it into the field above.';

    function syncOmdbHintVisibility() {
      hint.hidden = omdb.isConfigured();
    }
    syncOmdbHintVisibility();

    return el(
      "div",
      { class: "osu-expertplus-panel__creds" },
      el(
        "div",
        { class: "osu-expertplus-panel__creds-field" },
        el("label", {}, "API Key"),
        apiKeyInput,
      ),
      el(
        "div",
        { class: "osu-expertplus-panel__creds-actions" },
        saveBtn,
        clearBtn,
      ),
      statusEl,
      hint,
    );
  }

  function buildSection(
    title,
    contentNodes,
    { collapsedByDefault = false, credential = null } = {},
  ) {
    const section = el("section", { class: "osu-expertplus-panel__section" });
    if (collapsedByDefault) section.classList.add(SECTION_COLLAPSED_CLASS);

    const titleId =
      credential?.stableTitleId ??
      `oep-settings-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const initialTitle = credential
      ? credentialSectionTitle(credential.kind, credential.filled)
      : title;

    const label = el(
      "span",
      { class: "osu-expertplus-panel__group-label", id: titleId },
      initialTitle,
    );

    function applyCredentialState(filled) {
      if (!credential) return;
      section.classList.remove("oep-cred--ok", "oep-cred--missing");
      section.classList.add(filled ? "oep-cred--ok" : "oep-cred--missing");
      label.textContent = credentialSectionTitle(credential.kind, filled);
    }

    if (credential) {
      section.classList.add(
        credential.kind === "osu" ? "oep-cred--osu" : "oep-cred--omdb",
      );
      applyCredentialState(credential.filled);
      if (credential.syncHolder) {
        credential.syncHolder.sync = applyCredentialState;
      }
    }

    const content = el(
      "div",
      { class: "osu-expertplus-panel__section-content" },
      ...contentNodes,
    );
    const chevron = el(
      "span",
      { class: "osu-expertplus-panel__group-chevron", "aria-hidden": "true" },
      "▼",
    );
    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "osu-expertplus-panel__group-toggle",
        "aria-expanded": collapsedByDefault ? "false" : "true",
        "aria-labelledby": titleId,
      },
      label,
      chevron,
    );

    toggleBtn.addEventListener("click", () => {
      const collapsed = section.classList.toggle(SECTION_COLLAPSED_CLASS);
      toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });

    section.appendChild(toggleBtn);
    section.appendChild(content);
    return section;
  }

  function buildPanel() {
    const features = settings.getFeatures();

    const groups = new Map();
    for (const f of features) {
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group).push(f);
    }

    const header = el(
      "div",
      { class: "osu-expertplus-panel__header" },
      "osu! Expert+ Settings",
    );

    const rows = [];
    const hasSavedCreds = auth.isConfigured();
    const hasSavedOmdb = omdb.isConfigured();

    const osuSyncHolder = { sync: null };
    const omdbSyncHolder = { sync: null };

    rows.push(
      buildSection(
        "",
        [
          buildCredentialsSection(() =>
            osuSyncHolder.sync?.(auth.isConfigured()),
          ),
        ],
        {
          collapsedByDefault: hasSavedCreds,
          credential: {
            kind: "osu",
            filled: hasSavedCreds,
            stableTitleId: "oep-settings-section-osu-api",
            syncHolder: osuSyncHolder,
          },
        },
      ),
    );

    rows.push(
      buildSection(
        "",
        [
          buildOmdbCredentialsSection(() =>
            omdbSyncHolder.sync?.(omdb.isConfigured()),
          ),
        ],
        {
          collapsedByDefault: hasSavedOmdb,
          credential: {
            kind: "omdb",
            filled: hasSavedOmdb,
            stableTitleId: "oep-settings-section-omdb-api",
            syncHolder: omdbSyncHolder,
          },
        },
      ),
    );

    for (const [groupName, groupFeatures] of groups) {
      const groupRows = [];
      for (const feature of groupFeatures) {
        const text = el(
          "div",
          { class: "osu-expertplus-panel__text" },
          el("div", { class: "osu-expertplus-panel__label" }, feature.label),
        );
        const row = el(
          "div",
          { class: "osu-expertplus-panel__row" },
          text,
          buildToggle(feature),
        );
        if (feature.id === settings.IDS.MODDED_STAR_RATING) {
          row.setAttribute(MODDED_SR_ROW_ATTR, "1");
          text.appendChild(
            el(
              "div",
              {
                class: "osu-expertplus-panel__feature-hint",
                "data-oep-modded-sr-hint": "1",
              },
              "",
            ),
          );
          applyModdedStarRowLockState(row);
        }
        groupRows.push(row);
      }
      rows.push(buildSection(groupName, groupRows));
    }

    const resetDefaultsBtn = el(
      "button",
      {
        type: "button",
        class: "osu-expertplus-panel__footer-reset",
        title: "Set every toggle above to its default (API keys are not changed)",
      },
      "Reset to defaults",
    );
    resetDefaultsBtn.addEventListener("click", () => {
      if (
        !window.confirm(
          "Reset all Expert+ options to their defaults? osu! and OMDB API keys will not be changed.",
        )
      ) {
        return;
      }
      settings.resetPanelTogglesToDefaults();
      refreshModdedStarRatingRowLock();
    });

    const footer = el(
      "div",
      { class: "osu-expertplus-panel__footer" },
      resetDefaultsBtn,
      el(
        "div",
        { class: "osu-expertplus-panel__footer-links" },
        el(
          "a",
          {
            href: "https://github.com/inix1257/osu_expertplus",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Source code",
        ),
        el(
          "span",
          { class: "osu-expertplus-panel__footer-sep", "aria-hidden": "true" },
          "·",
        ),
        el(
          "a",
          {
            href: "https://osu.ppy.sh/users/2688581",
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Developer",
        ),
      ),
    );

    return el("div", { id: ROOT_ID }, header, ...rows, footer);
  }

  /** Assigned in {@link init}; no-op until then. */
  let openPanel = () => {};
  /** Assigned in {@link init}; no-op until then. */
  let closePanel = () => {};

  function init() {
    if (document.getElementById(ROOT_ID)) return;

    GM_addStyle(CSS);

    const fab = el(
      "button",
      {
        id: "osu-expertplus-fab",
        type: "button",
        title: "osu! Expert+ Settings",
      },
      el(
        "span",
        { class: "osu-expertplus-fab__icon", "aria-hidden": "true" },
        el("i", { class: "fas fa-cog" }),
      ),
      el(
        "span",
        { class: "osu-expertplus-fab__label" },
        el("span", { class: "osu-expertplus-fab__brand-accent" }, "Expert+"),
      ),
    );

    const apiWarning = el(
      "div",
      {
        class: "osu-expertplus-fab-api-warning",
        role: "status",
      },
      el("i", {
        class:
          "fas fa-exclamation-triangle osu-expertplus-fab-api-warning__icon",
        "aria-hidden": "true",
      }),
      el(
        "span",
        { class: "osu-expertplus-fab-api-warning__text" },
        "osu! API credentials not set",
      ),
    );

    const fabAnchor = el("div", { id: FAB_ANCHOR_ID }, apiWarning, fab);

    const backdrop = el("div", { id: "osu-expertplus-backdrop" });
    const panel = buildPanel();

    fabUi.anchor = fabAnchor;
    fabUi.panel = panel;

    openPanel = () => {
      panel.classList.add(OPEN_CLASS);
      backdrop.classList.add(OPEN_CLASS);
    };
    closePanel = () => {
      panel.classList.remove(OPEN_CLASS);
      backdrop.classList.remove(OPEN_CLASS);
    };
    const toggle = () =>
      panel.classList.contains(OPEN_CLASS) ? closePanel() : openPanel();

    fab.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    backdrop.addEventListener("click", closePanel);

    function attachToBody() {
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
      document.body.appendChild(fabAnchor);
      refreshFabOsuApiWarning();
      refreshModdedStarRatingRowLock();
    }

    attachToBody();
    window.addEventListener("resize", syncPanelAboveFab);

    // Re-attach when SPA replaces document.body
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node === document.body) {
            attachToBody();
            return;
          }
        }
      }
    }).observe(document.documentElement, { childList: true });
  }

  return {
    init,
    /** Opens the Expert+ settings modal (idempotent if {@link init} has not run). */
    open: () => {
      openPanel();
    },
    close: () => {
      closePanel();
    },
  };
})();
