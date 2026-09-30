import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedClassVideoTime,
  normalizeClassVideoState,
} from "../src/lib/class-video";

test("normalizes and clamps shared video state", () => {
  const state = normalizeClassVideoState({
    assignmentId: "lesson-1",
    currentTime: -12,
    playing: true,
    captions: undefined,
    muted: true,
    volume: 4,
    playbackRate: 9,
    at: "2026-09-30T10:00:00.000Z",
  });

  assert.deepEqual(state, {
    assignmentId: "lesson-1",
    currentTime: 0,
    playing: true,
    captions: true,
    muted: true,
    volume: 1,
    playbackRate: 4,
    at: "2026-09-30T10:00:00.000Z",
  });
});

test("advances playing video from the teacher timestamp", () => {
  const state = normalizeClassVideoState({
    assignmentId: "lesson-1",
    currentTime: 10,
    playing: true,
    captions: false,
    muted: false,
    volume: 0.5,
    playbackRate: 1.5,
    at: "2026-09-30T10:00:00.000Z",
  });

  assert.ok(state);
  assert.equal(
    expectedClassVideoTime(state, Date.parse("2026-09-30T10:00:04.000Z")),
    16,
  );
});

test("does not advance paused video", () => {
  const state = normalizeClassVideoState({
    assignmentId: "lesson-1",
    currentTime: 42,
    playing: false,
    captions: true,
    muted: false,
    volume: 1,
    playbackRate: 1,
    at: "2026-09-30T10:00:00.000Z",
  });

  assert.ok(state);
  assert.equal(
    expectedClassVideoTime(state, Date.parse("2026-09-30T10:10:00.000Z")),
    42,
  );
});
