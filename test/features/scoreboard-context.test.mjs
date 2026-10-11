import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

function useDom(html) {
  const { window } = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
  });
  for (const key of ["window", "document", "location", "HTMLButtonElement"]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  return window;
}

const toggle = (title, icon, value) => `
  <button type="button" class="simple-menu__item" title="${title}"
    data-url="https://osu.ppy.sh/home/account/options?user_profile_customization%5Blegacy_score_only%5D=${value}">
    <span><span class="fas ${icon}"></span> ${title}</span>
  </button>`;

test("isLazerModeEnabledForLeaderboard reads the toggle in any language (B16)", async () => {
  const { isLazerModeEnabledForLeaderboard } =
    await import("../../src/features/scoreboard/context.js");
  const cases = [
    // title, icon, URL value, expected
    ["Lazer mode", "fa-check-square", 1, true],
    ["Lazer mode", "fa-square", 0, false],
    ["레이저 모드", "fa-check-square", 1, true],
    ["Modo lazer", "fa-square", 0, false],
    // no icon: the URL sets the opposite of the current state
    ["Lazer", "fa-unknown", 1, true],
    ["Lazer", "fa-unknown", 0, false],
  ];
  for (const [title, icon, value, expected] of cases) {
    useDom(toggle(title, icon, value));
    assert.equal(
      isLazerModeEnabledForLeaderboard(),
      expected,
      `${title} ${icon} ${value}`,
    );
  }
  useDom("<button>nothing</button>");
  assert.equal(isLazerModeEnabledForLeaderboard(), false);
});

test("readScoreDisplayPrefs follows osu-web's userPreferences (B94)", async () => {
  const { readScoreDisplayPrefs } =
    await import("../../src/features/scoreboard/context.js");
  const win = useDom(toggle("Lazer mode", "fa-square", 1));
  // osuCore wins over localStorage and the toggle.
  win.localStorage.setItem(
    "userPreferences",
    JSON.stringify({ legacy_score_only: true, scoring_mode: "standardised" }),
  );
  const current = { legacy_score_only: false, scoring_mode: "classic" };
  win.osuCore = { userPreferences: { get: (k) => current[k] } };
  assert.deepEqual(readScoreDisplayPrefs(), {
    legacyScoreOnly: false,
    scoringMode: "classic",
  });
  current.scoring_mode = "standardised";
  assert.equal(readScoreDisplayPrefs().scoringMode, "standardised");
  // Without osuCore: the localStorage mirror.
  delete win.osuCore;
  assert.deepEqual(readScoreDisplayPrefs(), {
    legacyScoreOnly: true,
    scoringMode: "standardised",
  });
  // Neither: toggle for Lazer mode, osu-web's default scoring mode.
  win.localStorage.clear();
  assert.deepEqual(readScoreDisplayPrefs(), {
    legacyScoreOnly: true,
    scoringMode: "standardised",
  });
  useDom(toggle("Lazer mode", "fa-check-square", 1));
  assert.equal(readScoreDisplayPrefs().legacyScoreOnly, false);
});
