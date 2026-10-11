import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

/** The account edit page with its OAuth section, and a stub auth. */
function setup(configured) {
  const state = { configured };
  const { window } = loadScripts(
    ["src/utils/dom.js", "src/pages/account-edit.js"],
    {
      url: "https://osu.ppy.sh/home/account/edit",
      globals: {
        OsuExpertPlus: { auth: { isConfigured: () => state.configured } },
      },
    },
  );
  window.document.body.innerHTML = `
    <div class="account-edit">
      <h2 class="account-edit__section-title">OAuth</h2>
      <div class="account-edit__input-groups"><div>apps</div></div>
    </div>`;
  return { window, state, page: window.OsuExpertPlus.pages.accountEdit };
}

const guideOf = (window) => window.document.getElementById("oep-oauth-guide");

test("B53: no guide when credentials are already saved", async () => {
  const { window, page } = setup(true);
  const cleanup = await page.init([]);
  assert.equal(guideOf(window), null);
  assert.equal(window.document.getElementById("oep-account-edit-style"), null);
  cleanup();
});

test("B53: the guide follows the panel's save event, no timers left", async () => {
  const { window, state, page } = setup(false);
  const cleanup = await page.init([]);
  const guide = guideOf(window);
  assert.ok(guide);
  for (const b of guide.querySelectorAll("button")) {
    assert.equal(b.getAttribute("type"), "button");
  }
  assert.match(guide.textContent, /No credentials saved yet/);

  state.configured = true;
  window.dispatchEvent(new window.Event("oep-osu-api-credentials-changed"));
  assert.match(guide.textContent, /Credentials saved/);

  cleanup();
  assert.equal(guideOf(window), null);
  // After cleanup the listener is gone: the removed guide is not updated.
  state.configured = false;
  window.dispatchEvent(new window.Event("oep-osu-api-credentials-changed"));
  assert.match(guide.textContent, /Credentials saved/);
});
