import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeworkMediaView } from "../src/components/lessons/homework-media-view";
import { lessonVideoPlaybackContext, parseLessonVideoSource } from "../src/lib/class-video";
import { dictionaries } from "../src/lib/i18n";
import { HOMEWORK_MEDIA_KEY, attachedHomeworkMedia, homeworkMediaAvailability, homeworkMediaSelection, isHomeworkMediaSelection, mergeHomeworkMedia, storedHomeworkMedia, type HomeworkMediaSource } from "../src/lib/homework-media";
import { withoutAssignedHomeworkState, withoutHomeworkProgressState, type InteractiveHomeworkPlan } from "../src/lib/lesson-homework";

const source: HomeworkMediaSource = {
  videoUrl: "https://www.youtube.com/watch?v=kH6QJzmLYtw&start=1292&end=1814",
  videoTitle: "Lesson video",
  transcript: [{ speaker: "Mark", text: "Thank you for your **cooperation**." }],
};
const available = { video: true, transcript: true };
const assigned = { "hw:assigned-at": "2026-10-09T10:00:00.000Z", [HOMEWORK_MEDIA_KEY]: JSON.stringify(available), "hw:value:item-1": "Student answer", "hw:exercise-score:exercise-1": "90", "regular:answer": "Keep this" };

test("new homework defaults to available video and transcript independently", () => {
  assert.deepEqual(homeworkMediaAvailability(source), available);
  assert.deepEqual(homeworkMediaSelection({}, available), available);
  assert.deepEqual(homeworkMediaSelection({}, available, { video: false, transcript: true }), { video: false, transcript: true });
  assert.deepEqual(homeworkMediaSelection({}, available, { video: true, transcript: false }), { video: true, transcript: false });
  assert.deepEqual(homeworkMediaSelection({}, available, { video: false, transcript: false }), { video: false, transcript: false });
});

test("missing media cannot be requested and whitespace-only materials are absent", () => {
  for (const value of [null, {}, { videoUrl: "  ", transcript: [] }, { videoUrl: false, transcript: [{ text: "  " }] }]) {
    assert.deepEqual(homeworkMediaAvailability(value), { video: false, transcript: false });
  }
  assert.deepEqual(homeworkMediaSelection(assigned, { video: false, transcript: true }, available), { video: false, transcript: true });
  assert.deepEqual(homeworkMediaSelection(assigned, { video: true, transcript: false }, available), { video: true, transcript: false });
});

test("teacher choices survive reassignment and malformed preferences are not trusted", () => {
  const off = { [HOMEWORK_MEDIA_KEY]: JSON.stringify({ video: false, transcript: false }) };
  assert.deepEqual(homeworkMediaSelection(off, available), { video: false, transcript: false });
  assert.deepEqual(storedHomeworkMedia(assigned), available);
  for (const value of [null, [], {}, { video: "true", transcript: true }, { video: true }]) assert.equal(isHomeworkMediaSelection(value), false);
  for (const value of ["{", "null", "[]", '{"video":"true","transcript":true}']) {
    assert.equal(storedHomeworkMedia({ [HOMEWORK_MEDIA_KEY]: value }), null);
    assert.deepEqual(attachedHomeworkMedia({ ...assigned, [HOMEWORK_MEDIA_KEY]: value }, source), { video: false, transcript: false });
  }
});

test("student sees only explicitly assigned materials even when original class sections are closed", () => {
  assert.deepEqual(attachedHomeworkMedia(assigned, source), available);
  assert.deepEqual(attachedHomeworkMedia({ "hw:assigned-at": assigned["hw:assigned-at"] }, source), { video: false, transcript: false });
  assert.deepEqual(attachedHomeworkMedia({ [HOMEWORK_MEDIA_KEY]: assigned[HOMEWORK_MEDIA_KEY] }, source), { video: false, transcript: false });
  assert.deepEqual(attachedHomeworkMedia({ ...assigned, "hw:removed-at": "2026-10-09" }, source), { video: false, transcript: false });
});

test("reset preserves media, scores and lesson answers; homework deletion removes only homework state", () => {
  const plan: InteractiveHomeworkPlan = { kind: "INTERACTIVE_HOMEWORK_V1", title: "Homework", exercises: [{ id: "exercise-1", title: "Practice", instruction: "", kind: "fill", items: [{ id: "item-1", prompt: "___", answer: "word" }] }] };
  const reset = withoutHomeworkProgressState(assigned, plan);
  assert.equal(reset[HOMEWORK_MEDIA_KEY], assigned[HOMEWORK_MEDIA_KEY]);
  assert.equal(reset["hw:exercise-score:exercise-1"], "90");
  assert.equal(reset["regular:answer"], "Keep this");
  assert.equal(reset["hw:value:item-1"], undefined);
  assert.deepEqual(withoutAssignedHomeworkState(assigned), { "regular:answer": "Keep this" });
  assert.equal(assigned["hw:value:item-1"], "Student answer");
});

test("live preferences merge without replacing unsaved answers or grades", () => {
  const next = mergeHomeworkMedia(assigned, { "hw:assigned-at": "2026-10-10", [HOMEWORK_MEDIA_KEY]: JSON.stringify({ video: false, transcript: true }) });
  assert.equal(next["hw:value:item-1"], "Student answer");
  assert.equal(next["hw:exercise-score:exercise-1"], "90");
  assert.deepEqual(attachedHomeworkMedia(next, source), { video: false, transcript: true });
  assert.equal(mergeHomeworkMedia(assigned, {})[HOMEWORK_MEDIA_KEY], undefined);
  assert.equal(assigned[HOMEWORK_MEDIA_KEY], JSON.stringify(available));
});

test("homework playback unlocks student controls and strips any accidentally passed class session", () => {
  const session = { assignmentId: "class-1", teacher: false, state: { playing: true } };
  assert.deepEqual(lessonVideoPlaybackContext(false, true, session), { canControl: true, session: undefined });
  assert.deepEqual(lessonVideoPlaybackContext(true, true, { ...session, teacher: true }), { canControl: true, session: undefined });
  assert.deepEqual(lessonVideoPlaybackContext(false, false, session), { canControl: false, session });
  assert.deepEqual(lessonVideoPlaybackContext(true, false, session), { canControl: true, session });
  const parsed = parseLessonVideoSource(source.videoUrl ?? "");
  assert.equal(parsed?.kind, "youtube");
  if (parsed?.kind === "youtube") { assert.equal(parsed.startAt, 1292); assert.equal(parsed.endAt, 1814); }
  assert.equal(parseLessonVideoSource("https://example.test/lesson.mp4")?.kind, "file");
});

test("homework sections render side by side, preserve vocabulary emphasis and adapt to all locales", () => {
  for (const dictionary of Object.values(dictionaries)) {
    const labels = { video: dictionary.lessonUnits.secVideo, transcript: dictionary.lessonUnits.secTranscript, playbackHint: dictionary.interactiveHomework.mediaPlaybackHint };
    const html = renderToStaticMarkup(createElement(HomeworkMediaView, { source, attached: available, labels, video: createElement("div", { "data-independent-player": true }) }));
    assert.match(html, /lg:grid-cols-\[minmax\(0,1.2fr\)_minmax\(0,1fr\)\]/);
    assert.match(html, /<strong>cooperation<\/strong>/);
    assert.match(html, /data-independent-player/);
    assert.match(html, /overflow-y-auto/);
    assert.ok(html.includes(labels.video) && html.includes(labels.transcript) && html.includes(labels.playbackHint));
    assert.ok(dictionary.interactiveHomework.mediaTitle && dictionary.interactiveHomework.mediaAssignmentHint);
    for (const attached of [{ video: true, transcript: false }, { video: false, transcript: true }, { video: false, transcript: false }]) {
      const one = renderToStaticMarkup(createElement(HomeworkMediaView, { source, attached, labels, video: createElement("div", { "data-independent-player": true }) }));
      assert.equal(one.includes("data-independent-player"), attached.video);
      assert.equal(one.includes("cooperation"), attached.transcript);
      if (!attached.video && !attached.transcript) assert.equal(one, "");
    }
  }
});

test("transcript content is escaped rather than injected as HTML", () => {
  const html = renderToStaticMarkup(createElement(HomeworkMediaView, { source: { ...source, transcript: [{ speaker: "<img>", text: '<script>alert("x")</script>' }] }, attached: { video: false, transcript: true }, labels: { video: "Video", transcript: "Transcript", playbackHint: "Local" }, video: null }));
  assert.ok(!html.includes("<script>") && !html.includes("<img>"));
  assert.match(html, /&lt;script&gt;/);
});

test("both assignment paths validate teacher-owned preferences and publish the scoped update", () => {
  const actions = readFileSync("src/lib/actions/lesson-homework.ts", "utf8");
  for (const name of ["assignInteractiveHomeworkAction", "assignHomeworkFromLessonSourceAction"]) {
    const start = actions.indexOf(`export async function ${name}(`);
    const body = actions.slice(start, actions.indexOf("\nexport ", start + 1));
    assert.ok(body.includes('session.role !== "TEACHER"'));
    assert.ok(body.includes("isHomeworkMediaSelection"));
    assert.ok(body.includes("state[HOMEWORK_MEDIA_KEY]"));
    assert.ok(body.includes("publishHomeworkReviewRealtime"));
  }
  const lessonActions = readFileSync("src/lib/actions/lessons.ts", "utf8");
  assert.match(lessonActions, /isStudent && responseKey === HOMEWORK_MEDIA_KEY/);
  const media = readFileSync("src/components/lessons/homework-media.tsx", "utf8");
  assert.match(media, /teacher=\{false\} independent/);
  assert.ok(!media.includes("session={"));
  const player = readFileSync("src/components/lessons/lesson-video-player.tsx", "utf8");
  assert.match(player, /session=\{playback.session\}/);
  assert.match(player, /\{teacher && \(/, "Editing/upload still requires the real teacher role");
});
