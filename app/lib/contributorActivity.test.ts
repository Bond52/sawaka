import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVITY_LIMIT,
  activityMessage,
  formatActivityTime,
  parseOwnActivities,
} from "./contributorActivity.ts";

const now = Date.parse("2026-10-21T12:00:00.000Z");

test("parseOwnActivities keeps the latest five safe rows and drops private fields", () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({
    id: `id-${index}`,
    type: "realization.published",
    entityType: "realization",
    title: index === 0 ? "" : "Table basse",
    createdAt: "2026-10-21T12:00:00.000Z",
    userId: "secret-user",
    email: "a@example.com",
    description: "should not matter",
  }));
  const items = parseOwnActivities({ activities: rows });
  assert.equal(items?.length, ACTIVITY_LIMIT);
  assert.equal(items?.[0].title, null);
  assert.equal("userId" in (items?.[0] ?? {}), false);
  assert.equal(parseOwnActivities({ realizations: [] }), null);
  assert.equal(
    parseOwnActivities({
      activities: [{ id: "1", type: "profile.created", entityType: "contributor_profile", title: null, createdAt: "2026-10-21T12:00:00.000Z" }],
    }),
    null
  );
});

test("activity messages use a title snapshot and a generic sentence without one", () => {
  assert.deepEqual(activityMessage("profile.updated", null), {
    key: "dashboard.activity.profileUpdated",
  });
  assert.deepEqual(activityMessage("realization.deleted", "Table basse"), {
    key: "dashboard.activity.realizationDeleted",
    title: "Table basse",
  });
  assert.deepEqual(activityMessage("realization.deleted", "  "), {
    key: "dashboard.activity.realizationDeletedUntitled",
  });
  assert.deepEqual(activityMessage("realization.created", null), {
    key: "dashboard.activity.realizationCreatedUntitled",
  });
});

test("formatActivityTime uses relative time for recent events and a calendar date later", () => {
  const fiveMinutes = new Date(now - 5 * 60 * 1000).toISOString();
  const twoHours = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const older = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(formatActivityTime(fiveMinutes, "en", now), "5 minutes ago");
  assert.equal(formatActivityTime(twoHours, "en", now), "2 hours ago");
  assert.equal(formatActivityTime(yesterday, "en", now), "yesterday");
  assert.match(formatActivityTime(fiveMinutes, "fr", now), /il y a 5.+minutes/);
  assert.equal(formatActivityTime(yesterday, "fr", now), "hier");
  assert.doesNotMatch(formatActivityTime(older, "en", now), /ago/);
  assert.match(formatActivityTime(older, "en", now), /2026/);
});
