import assert from "node:assert/strict";
import test from "node:test";
import {
  classTimerRemainingMs,
  liveClassTimerState,
  normalizeClassTimerState,
} from "../src/lib/class-timer";

const running = {
  id: "timer-1",
  name: "Vocabulary sprint",
  topic: "Travel words",
  durationSeconds: 300,
  theme: "ocean",
  tickSound: "digital",
  endSound: "success",
  tickSoundEnabled: true,
  endSoundEnabled: true,
  startVoiceEnabled: true,
  status: "RUNNING",
  remainingMs: 300_000,
  endsAt: "2026-10-02T10:05:00.000Z",
  visible: true,
  startedSignalAt: "2026-10-02T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
};

test("shared timer derives remaining time from the server deadline", () => {
  const state = normalizeClassTimerState(running);
  assert.ok(state);
  assert.equal(
    classTimerRemainingMs(state, Date.parse("2026-10-02T10:02:15.000Z")),
    165_000,
  );
});

test("expired running timer becomes finished without going below zero", () => {
  const state = liveClassTimerState(
    running,
    Date.parse("2026-10-02T10:06:00.000Z"),
  );
  assert.ok(state);
  assert.equal(state.status, "FINISHED");
  assert.equal(state.remainingMs, 0);
  assert.equal(state.endsAt, null);
});

test("timer normalizes unsafe settings and keeps safe defaults", () => {
  const state = normalizeClassTimerState({
    ...running,
    durationSeconds: 999_999,
    theme: "unknown",
    tickSound: "unknown",
    endSound: "unknown",
    endSoundEnabled: undefined,
  });
  assert.ok(state);
  assert.equal(state.durationSeconds, 86_400);
  assert.equal(state.theme, "violet");
  assert.equal(state.tickSound, "soft");
  assert.equal(state.endSound, "bell");
  assert.equal(state.endSoundEnabled, true);
});

test("finished timer preserves a zero remainder", () => {
  const state = normalizeClassTimerState({
    ...running,
    status: "FINISHED",
    remainingMs: 0,
    endsAt: null,
  });
  assert.ok(state);
  assert.equal(state.remainingMs, 0);
});

test("timer keeps a valid teacher rating and rejects an unknown one", () => {
  const rated = normalizeClassTimerState({
    ...running,
    status: "FINISHED",
    remainingMs: 0,
    rating: { grade: "GREAT", visible: false, at: "2026-10-05T10:00:00.000Z" },
  });
  assert.deepEqual(rated?.rating, {
    grade: "GREAT",
    visible: false,
    at: "2026-10-05T10:00:00.000Z",
  });

  const invalid = normalizeClassTimerState({ ...running, rating: { grade: "WOW", at: "now" } });
  assert.equal(invalid?.rating, null);
});
