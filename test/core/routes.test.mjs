import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beatmapsetIdFromPath,
  discussionPath,
  discussionTotalPath,
  isDiscussionReviewsTotal,
  isAccountEdit,
  isBeatmapsetDiscussion,
  isBeatmapsetsListing,
  isUserProfile,
} from "../../src/core/routes.js";

test("isBeatmapsetsListing matches only the listing (B25)", () => {
  assert.equal(isBeatmapsetsListing("/beatmapsets"), true);
  assert.equal(isBeatmapsetsListing("/beatmapsets/"), true);
  assert.equal(isBeatmapsetsListing("/beatmapsets/discussions"), false);
  assert.equal(isBeatmapsetsListing("/beatmapsets/events"), false);
  assert.equal(isBeatmapsetsListing("/beatmapsets/39804"), false);
  assert.equal(isBeatmapsetsListing("/beatmapsetsx"), false);
});

test("beatmapsetIdFromPath", () => {
  assert.equal(beatmapsetIdFromPath("/beatmapsets/39804"), 39804);
  assert.equal(
    beatmapsetIdFromPath("/beatmapsets/39804/discussion/-/generalAll"),
    39804,
  );
  assert.equal(beatmapsetIdFromPath("/beatmapsets"), null);
  assert.equal(beatmapsetIdFromPath("/beatmapsets/discussions"), null);
});

test("isBeatmapsetDiscussion", () => {
  assert.equal(isBeatmapsetDiscussion("/beatmapsets/1/discussion"), true);
  assert.equal(
    isBeatmapsetDiscussion("/beatmapsets/1/discussion/-/generalAll/total"),
    true,
  );
  assert.equal(isBeatmapsetDiscussion("/beatmapsets/1"), false);
  assert.equal(isBeatmapsetDiscussion("/beatmapsets/discussions"), false);
  assert.equal(isBeatmapsetDiscussion("/beatmapsets/1/discussionx"), false);
});

test("discussion paths", () => {
  assert.equal(discussionPath(39804), "/beatmapsets/39804/discussion");
  assert.equal(
    discussionTotalPath("39804"),
    "/beatmapsets/39804/discussion/-/generalAll/total",
  );
  assert.equal(
    isDiscussionReviewsTotal("/beatmapsets/1/discussion/-/reviews/total"),
    true,
  );
  assert.equal(
    isDiscussionReviewsTotal("/beatmapsets/1/discussion/-/reviews/totalx"),
    false,
  );
  assert.equal(
    isDiscussionReviewsTotal("/beatmapsets/1/discussion/-/generalAll/total"),
    false,
  );
});

test("isUserProfile and isAccountEdit", () => {
  assert.equal(isUserProfile("/users/2"), true);
  assert.equal(isUserProfile("/users/2/osu"), true);
  assert.equal(isUserProfile("/users"), false);
  assert.equal(isAccountEdit("/home/account/edit"), true);
  assert.equal(isAccountEdit("/home"), false);
});
