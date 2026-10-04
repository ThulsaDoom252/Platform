import assert from "node:assert/strict";
import test from "node:test";
import { ONLINE_WINDOW_MS, presenceFromLastSeen } from "../src/lib/presence";

const now = new Date("2026-10-04T12:00:00.000Z").getTime();

test("ученик без отметки активности считается офлайн", () => {
  assert.equal(presenceFromLastSeen(null, now), "offline");
});

test("свежая отметка активности считается онлайном", () => {
  assert.equal(presenceFromLastSeen(new Date(now - 10_000), now), "online");
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS + 1).toISOString(), now), "online");
});

test("просроченная отметка активности считается офлайном", () => {
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS), now), "offline");
  assert.equal(presenceFromLastSeen(new Date(now - ONLINE_WINDOW_MS - 1), now), "offline");
});
