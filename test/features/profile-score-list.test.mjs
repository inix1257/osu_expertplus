import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "../helpers/load-script.mjs";

const { window } = loadScripts([], { url: "https://osu.ppy.sh/users/2/osu" });
for (const key of ["window", "document", "location", "HTMLAnchorElement"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? window : window[key],
    configurable: true,
    writable: true,
  });
}
/** Requested offsets; every page is full so the list never ends. */
const offsets = [];
globalThis.OsuExpertPlus = {
  api: {
    async siteFetch(url) {
      const offset = Number(
        new URL(url, "https://osu.ppy.sh").searchParams.get("offset"),
      );
      offsets.push(offset);
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: offset + i + 1,
      }));
      return { ok: true, json: async () => items };
    },
  },
};
const data = await import("../../src/features/profile/score-list-data.js");

test("own profile: Show more continues from the last page (B41)", async () => {
  // Signed in as user 2, looking at our own profile (cache TTL 0).
  window.document.body.innerHTML =
    '<a class="u-current-user-avatar" href="https://osu.ppy.sh/users/2"></a>';
  data.beginScoreListVisit();
  assert.equal((await data.fetchScores(2, "osu", "best", 100)).length, 100);
  assert.equal((await data.fetchScores(2, "osu", "best", 200)).length, 200);
  assert.deepEqual(offsets, [0, 100], "second call continues at offset 100");

  // A new visit fetches afresh.
  data.beginScoreListVisit();
  await data.fetchScores(2, "osu", "best", 100);
  assert.deepEqual(offsets, [0, 100, 0]);
});
