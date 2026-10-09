import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

class FakeIO {
  static all = [];
  constructor(cb) {
    this.cb = cb;
    this.targets = new Set();
    this.disconnected = false;
    FakeIO.all.push(this);
  }
  observe(t) {
    this.targets.add(t);
  }
  unobserve(t) {
    this.targets.delete(t);
  }
  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }
  showAll() {
    this.cb(
      [...this.targets].map((target) => ({ target, isIntersecting: true })),
    );
  }
}

const ROWS = [11, 22]
  .map(
    (id) => `
  <tr class="beatmap-scoreboard-table__body-row">
    <td><a class="js-usercard" data-user-id="${id}" href="/users/${id}">u${id}</a></td>
  </tr>`,
  )
  .join("");

function setup(getUsers) {
  const { window } = loadScripts(["src/utils/dom.js"], {
    url: "https://osu.ppy.sh/beatmapsets/1#osu/2",
  });
  window.OsuExpertPlus.api = { getUsers };
  window.OsuExpertPlus.settings = {
    IDS: { SCOREBOARD_GLOBAL_RANK: "rank" },
    isEnabled: () => true,
  };
  FakeIO.all = [];
  for (const key of [
    "window",
    "document",
    "location",
    "HTMLElement",
    "HTMLAnchorElement",
    "OsuExpertPlus",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? window : window[key],
      configurable: true,
      writable: true,
    });
  }
  globalThis.IntersectionObserver = FakeIO;
  window.document.body.innerHTML = `<div id="root"><table><tbody>${ROWS}</tbody></table></div>`;
  return window;
}

test("disposeScoreboardGlobalRanks drops the observer and the queued batch (B21)", async () => {
  const calls = [];
  const window = setup(async (ids) => {
    calls.push(ids);
    return [];
  });
  const { syncBeatmapScoreboardGlobalRanks, disposeScoreboardGlobalRanks } =
    await import("../../src/features/scoreboard/global-rank.js");
  const root = window.document.getElementById("root");

  syncBeatmapScoreboardGlobalRanks(root);
  const io = FakeIO.all.at(-1);
  assert.equal(io.targets.size, 2);
  io.showAll(); // queues both ids for the 100 ms batch

  disposeScoreboardGlobalRanks();
  assert.equal(io.disconnected, true);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(calls, [], "the queued batch never ran");

  // The next page gets a fresh observer.
  syncBeatmapScoreboardGlobalRanks(root);
  assert.notEqual(FakeIO.all.at(-1), io);
  disposeScoreboardGlobalRanks();
});
