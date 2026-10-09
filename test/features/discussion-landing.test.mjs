import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  createLandingRedirect,
  isBareDiscussionPath,
  isDefaultDiscussionTabPath,
} from "../../src/features/discussion/landing-redirect.js";

const ID = "beatmapDetail.discussionDefaultToTotal";
const TOTAL = "/beatmapsets/7/discussion/-/generalAll/total";

function setLocation(url) {
  const { window } = new JSDOM("", { url });
  Object.defineProperty(globalThis, "location", {
    value: window.location,
    configurable: true,
    writable: true,
  });
}

function fakeSettings(enabled = true) {
  const listeners = new Set();
  return {
    IDS: { DISCUSSION_DEFAULT_TO_TOTAL: ID },
    isEnabled: (id) => id === ID && enabled,
    onChange(id, fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(on) {
      enabled = on;
      for (const fn of listeners) fn(on);
    },
  };
}

/** @param {string|null} initialPath  path the document was first requested with */
function redirect(initialPath = null) {
  const visits = [];
  const { start } = createLandingRedirect({
    initialDocumentPath: () => initialPath,
    visit: (url) => visits.push(url),
  });
  return { start, visits };
}

test("path helpers", () => {
  assert.equal(isBareDiscussionPath("/beatmapsets/7/discussion", 7), true);
  assert.equal(isBareDiscussionPath("/beatmapsets/7/discussion/", 7), true);
  assert.equal(isBareDiscussionPath("/beatmapsets/7/discussion/-", 7), false);
  assert.equal(isBareDiscussionPath("/beatmapsets/8/discussion", 7), false);
  for (const tail of [
    "/-/generalAll",
    "/-/generalAll/",
    "/-/generalAll/praises",
  ]) {
    assert.equal(
      isDefaultDiscussionTabPath(`/beatmapsets/7/discussion${tail}`, 7),
      true,
      tail,
    );
  }
  for (const tail of [
    "",
    "/-/generalAll/total",
    "/-/timeline",
    "/123/general",
  ]) {
    assert.equal(
      isDefaultDiscussionTabPath(`/beatmapsets/7/discussion${tail}`, 7),
      false,
      tail,
    );
  }
});

test("bare discussion URL goes to Total, keeping query and hash (B54)", () => {
  setLocation("https://osu.ppy.sh/beatmapsets/7/discussion?x=1#/12/34");
  const { start, visits } = redirect();
  start(7, fakeSettings())();
  assert.deepEqual(visits, [`${TOTAL}?x=1#/12/34`]);
});

test("osu-web's default tab counts as a landing only on a bare first load", () => {
  setLocation(
    "https://osu.ppy.sh/beatmapsets/7/discussion/-/generalAll/praises",
  );
  const bareLoad = redirect("/beatmapsets/7/discussion");
  bareLoad.start(7, fakeSettings())();
  assert.deepEqual(bareLoad.visits, [TOTAL]);
  // Later tab switches in the same document are never landings.
  bareLoad.start(7, fakeSettings())();
  assert.equal(bareLoad.visits.length, 1);

  // Praises named in the link that opened the page: left alone.
  const explicit = redirect("/beatmapsets/7/discussion/-/generalAll/praises");
  explicit.start(7, fakeSettings())();
  assert.deepEqual(explicit.visits, []);
});

test("no redirect on Total or other tabs", () => {
  for (const tail of [
    "/-/generalAll/total",
    "/-/timeline",
    "/-/reviews/total",
  ]) {
    setLocation(`https://osu.ppy.sh/beatmapsets/7/discussion${tail}`);
    const r = redirect("/beatmapsets/7/discussion");
    r.start(7, fakeSettings())();
    assert.deepEqual(r.visits, [], tail);
  }
});

test("follows the setting: off does nothing, turning it on redirects once", () => {
  setLocation("https://osu.ppy.sh/beatmapsets/7/discussion");
  const { start, visits } = redirect();
  const settings = fakeSettings(false);
  const stop = start(7, settings);
  assert.deepEqual(visits, []);
  settings.set(true);
  settings.set(false);
  settings.set(true);
  assert.deepEqual(visits, [TOTAL]);
  stop();
});
