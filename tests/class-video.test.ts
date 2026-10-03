import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedClassVideoTime,
  normalizeClassVideoState,
  parseLessonVideoSource,
  withYouTubeClip,
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
    captionLanguage: "en",
    quality: "auto",
    at: "2026-09-30T10:00:00.000Z",
  });
});

test("video language and quality are normalized with English defaults", () => {
  const state = normalizeClassVideoState({
    assignmentId: "lesson-1",
    currentTime: 0,
    playing: false,
    captionLanguage: " EN-us! ",
    quality: "HD1080",
    at: "2026-09-30T10:00:00.000Z",
  });

  assert.equal(state?.captionLanguage, "en-us");
  assert.equal(state?.quality, "hd1080");
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

test("recognizes YouTube links and local lesson files", () => {
  assert.equal(
    parseLessonVideoSource("https://youtu.be/dQw4w9WgXcQ?t=4")?.kind,
    "youtube",
  );
  assert.equal(
    parseLessonVideoSource("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.kind,
    "youtube",
  );
  assert.equal(
    parseLessonVideoSource("/uploads/lesson-videos/example.mp4")?.kind,
    "file",
  );
  assert.equal(parseLessonVideoSource("https://example.com/watch")?.kind, "link");
});

test("reads and writes a bounded YouTube lesson clip", () => {
  const source = parseLessonVideoSource(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s&end=102",
  );
  assert.equal(source?.kind, "youtube");
  if (source?.kind !== "youtube") return;
  assert.equal(source.startAt, 65);
  assert.equal(source.endAt, 102);

  const clipped = withYouTubeClip(source.src, 12.9, 48.8);
  const reparsed = parseLessonVideoSource(clipped);
  assert.equal(reparsed?.kind, "youtube");
  if (reparsed?.kind !== "youtube") return;
  assert.equal(reparsed.startAt, 12);
  assert.equal(reparsed.endAt, 48);
  assert.equal(new URL(clipped).searchParams.has("t"), false);
});
