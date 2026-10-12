import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readTestTeacherFeedback } from "../src/lib/tests/feedback";
import { HOMEWORK_RESULT_REACTIONS } from "../src/lib/homework-feedback";
import { PublicHomeworkTeacherNote } from "../src/components/lessons/homework-teacher-note";
import { TEST_LABELS } from "../src/lib/tests/labels";

test("test feedback is manual, nullable and bounded independently of numeric results", () => {
  for (const value of [null, undefined, {}, { manualReaction: "invalid", teacherNote: "  " }, { percent: 100 }]) assert.equal(readTestTeacherFeedback(value), null);
  for (const reaction of HOMEWORK_RESULT_REACTIONS) assert.equal(readTestTeacherFeedback({ manualReaction: reaction.id })?.manualReaction, reaction.id);
  assert.deepEqual(readTestTeacherFeedback({ teacherNote: "  Check when.\nGood effort!  ", updatedAt: "2026-10-12" }),
    { manualReaction: null, teacherNote: "Check when.\nGood effort!", updatedAt: "2026-10-12" });
  assert.equal(readTestTeacherFeedback({ teacherNote: "x".repeat(5000) })?.teacherNote.length, 4000);
});

test("teacher notes remain plain escaped multiline text; localized feedback explicitly does not alter scores", () => {
  const note = "<script>alert('bad')</script>\nKeep practising.";
  const markup = renderToStaticMarkup(createElement(PublicHomeworkTeacherNote, { label: TEST_LABELS.ru.teacherComment, note }));
  assert.ok(markup.includes("&lt;script&gt;")); assert.ok(!markup.includes("<script>")); assert.ok(markup.includes("whitespace-pre-wrap"));
  for (const locale of ["en", "ru", "uk"] as const) assert.ok(TEST_LABELS[locale].teacherFeedback && TEST_LABELS[locale].feedbackHint && TEST_LABELS[locale].saveFeedback);
});

test("feedback is available on completed cards and specific attempt results, never required for completion", () => {
  const card = readFileSync("src/components/tests/test-assignment-card.tsx", "utf8");
  const detail = readFileSync("src/components/tests/assigned-test-view.tsx", "utf8");
  const panel = readFileSync("src/components/tests/test-teacher-feedback.tsx", "utf8");
  assert.ok(card.includes("attemptId={item.latestAttemptId}")); assert.ok(card.includes("feedback={item.teacherFeedback}"));
  assert.ok(detail.includes("attemptId={viewed.id}")); assert.ok(detail.includes("feedback={viewed.teacherFeedback}"));
  assert.ok(panel.includes('if (!completed || !attemptId || !teacher && !current) return null'));
  assert.ok(panel.includes('maxLength={4_000}')); assert.ok(!panel.includes("dangerouslySetInnerHTML"));
  const page = readFileSync("src/app/teacher/homeworks/page.tsx", "utf8");
  assert.ok(page.includes("kind: item.kind")); assert.ok(page.includes('teacherHomeworkOverviewState(item) === "submitted"'));
});
