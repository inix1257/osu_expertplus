/** /home/account/edit — OAuth “Own Clients” setup guide when creds unset. */

'use strict';

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.accountEdit = (() => {
  const name = 'AccountEdit';
  const { el, waitForElement, manageStyle } = OsuExpertPlus.dom;
  const auth = OsuExpertPlus.auth;

  const GUIDE_ID    = 'oep-oauth-guide';

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

  const guideStyle = manageStyle('oep-account-edit-style', CSS);

  function buildGuide() {
    const body = el('div', { class: 'oep-guide__body' },
      'Register a new application below, copy its ',
      el('b', {}, 'Client ID'), ' and ', el('b', {}, 'Client Secret'),
      ', then paste them into the ', el('b', {}, '⚙ Expert+ panel'), ' (bottom-right corner).',
    );

    const statusEl = el('div', { class: 'oep-guide__status' },
      'No credentials saved yet.',
    );

    const openBtn = el('button', { class: 'oep-guide__open-panel-btn' },
      '⚙ Open Expert+ Settings',
    );
    openBtn.addEventListener('click', () => {
      // Trigger a click on the floating FAB to open the panel.
      document.getElementById('osu-expertplus-fab')?.click();
    });

    const dismissBtn = el('button', { class: 'oep-guide__dismiss', title: 'Dismiss' }, '✕');
    dismissBtn.addEventListener('click', () => {
      guide.classList.add('oep-guide--done');
    });

    const footer = el('div', { class: 'oep-guide__footer' }, statusEl, openBtn);

    const guide = el('div', { id: GUIDE_ID },
      el('div', { class: 'oep-guide__header' },
        el('i', { class: 'oep-guide__icon fas fa-key' }),
        el('div', { class: 'oep-guide__title' }, 'Set up osu! Expert+ API access'),
        dismissBtn,
      ),
      body,
      footer,
    );

    // React to credential changes without a page reload.
    function syncState() {
      if (auth.isConfigured()) {
        statusEl.textContent = '✓ Credentials saved — API v2 active!';
        statusEl.className = 'oep-guide__status oep-guide__status--ok';
        openBtn.style.display = 'none';

        // Auto-hide after a short delay so the user sees the success message.
        setTimeout(() => guide.classList.add('oep-guide--done'), 3000);
      } else {
        statusEl.textContent = 'No credentials saved yet.';
        statusEl.className = 'oep-guide__status';
        openBtn.style.display = '';
        guide.classList.remove('oep-guide--done');
      }
    }

    // Poll GM storage for credential changes (cross-tab / after panel save).
    // GM_addValueChangeListener would be ideal but isn't universally available.
    const pollInterval = setInterval(syncState, 1500);
    guide._stopPolling = () => clearInterval(pollInterval);

    syncState();
    return guide;
  }

  /** OAuth section’s `.account-edit__input-groups` (title match or #oauth). */
  function findOAuthInputGroups() {
    const titles = document.querySelectorAll('.account-edit__section-title');
    for (const title of titles) {
      if (/oauth/i.test(title.textContent)) {
        return title.closest('.account-edit')?.querySelector('.account-edit__input-groups') ?? null;
      }
    }
    // Fallback: find by the named anchor (#oauth or #oauth2).
    for (const anchor of ['oauth', 'oauth2']) {
      const el = document.getElementById(anchor) ?? document.querySelector(`[name="${anchor}"]`);
      if (el) {
        return el.closest('.account-edit')?.querySelector('.account-edit__input-groups')
          ?? el.closest('section')
          ?? null;
      }
    }
    return null;
  }

  let _guide = null;

  async function init(_match) {
    guideStyle.inject();

    // Wait for the React-rendered OAuth section to appear.
    let inputGroups;
    try {
      await waitForElement('.account-edit__section-title', 10000);
      inputGroups = findOAuthInputGroups();
    } catch {
      return cleanup;
    }

    if (!inputGroups) {
      return cleanup;
    }

    // Build and prepend the guide.
    _guide = buildGuide();
    inputGroups.prepend(_guide);

    return cleanup;
  }

  function cleanup() {
    _guide?._stopPolling?.();
    document.getElementById(GUIDE_ID)?.remove();
    guideStyle.remove();
    _guide = null;
  }

  return { name, init };
})();
