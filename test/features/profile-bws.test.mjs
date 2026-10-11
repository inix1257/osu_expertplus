// Own file: the observer hub binds to the first jsdom window that subscribes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts(["src/utils/dom.js", "src/utils/settings.js"], {
  url: "https://osu.ppy.sh/users/2/osu",
});
for (const key of [
  "window",
  "document",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLAnchorElement",
  "MutationObserver",
  "DOMParser",
  "OsuExpertPlus",
]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}

const { mountBwsRanking } = await import("../../src/features/profile/bws.js");

const doc = window.document;
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

/** The header rank row and badges as osu-web renders them. */
function renderProfile({ globalRank = 10000, badges = [] } = {}) {
  const data = {
    current_mode: "osu",
    user: {
      id: 2,
      username: "peppy",
      statistics: { global_rank: globalRank },
    },
  };
  doc.body.innerHTML = `
    <div class="js-react" data-initial-data='${JSON.stringify(data)}'></div>
    <div class="profile-badges">${badges
      .map(
        (b) =>
          `<a class="profile-badges__badge" data-html-title="${b.replace(/"/g, "&quot;")}"></a>`,
      )
      .join("")}</div>
    <div class="profile-detail-stats__chart-numbers--top">
      <div class="profile-detail-stats__values">
        <div class="value-display value-display--rank">global</div>
        <div class="value-display value-display--rank">country</div>
      </div>
    </div>`;
  return doc.querySelector(".profile-detail-stats__values");
}

test("BWS block after the country rank, mapping badges excluded", async () => {
  const row = renderProfile({
    badges: [
      "<div>Winner: OWC 2024</div>",
      "<div>Beatmap Nominator</div>",
      "<div>Mapping contest</div>",
    ],
  });
  const dispose = mountBwsRanking();
  try {
    await tick();
    const blocks = [...row.children];
    assert.equal(blocks.length, 3);
    const bws = blocks[2];
    assert.equal(bws.getAttribute("data-oep-bws"), "1");
    // 1 eligible badge: 10000 ^ 0.9937 = 9436.3…
    assert.equal(bws.querySelector(".rank-value").textContent, "#9,436");
    assert.equal(bws.querySelector("input").value, "1");
    assert.equal(
      row.querySelector("[data-oep-bws-rank-col]"),
      null,
      "no Kirino column (B77)",
    );
    assert.ok(doc.getElementById("osu-expertplus-bws-ranking"));

    // Typing a badge count updates the rank.
    const input = bws.querySelector("input");
    input.value = "0";
    input.dispatchEvent(new window.Event("input"));
    assert.equal(bws.querySelector(".rank-value").textContent, "#10,000");
  } finally {
    dispose();
  }
  assert.equal(row.querySelector("[data-oep-bws]"), null);
  assert.equal(doc.getElementById("osu-expertplus-bws-ranking"), null);
});

test("osu-web re-rendering the rank row brings the block back", async () => {
  const row = renderProfile();
  const dispose = mountBwsRanking();
  try {
    await tick();
    row.querySelector("[data-oep-bws]").remove();
    await tick();
    assert.ok(row.querySelector("[data-oep-bws]"));
  } finally {
    dispose();
  }
});

test("badge titles are parsed inertly", async () => {
  let fired = false;
  window.__oepBwsFired = () => (fired = true);
  renderProfile({
    badges: ['<img src="x" onerror="window.__oepBwsFired()">Mapping'],
  });
  const dispose = mountBwsRanking();
  try {
    await tick();
    assert.equal(fired, false);
    assert.equal(
      doc.querySelector("[data-oep-bws] input").value,
      "0",
      "the badge still counts as a mapping badge",
    );
  } finally {
    dispose();
  }
});
