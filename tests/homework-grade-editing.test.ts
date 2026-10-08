import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  HOMEWORK_OVERALL_COMMENT_KEY, HOMEWORK_OVERALL_SCORE_KEY,
  homeworkExerciseComment, homeworkExerciseCommentKey, homeworkExerciseScore, homeworkExerciseScoreKey,
  homeworkGradeFeedbackPatch, homeworkOverallComment, homeworkOverallScore, homeworkOverallTeacherScore,
  homeworkReviewedAtKey, homeworkStatusKey, homeworkValueKey, isHomeworkGradeFeedbackKey, mergeHomeworkGradeFeedback,
  type HomeworkExercise, type HomeworkStoredState,
} from "../src/lib/lesson-homework";
import { HOMEWORK_RESULT_COMMENT_KEY, lessonHomeworkFeedback, readHomeworkFeedback } from "../src/lib/homework-feedback";
import { homeworkGradeFeedbackPatchSql, homeworkStateWithCurrentResultSql } from "../src/lib/homework-feedback-persistence";
import { HomeworkGradeEditor } from "../src/components/lessons/homework-grade-editor";
import { PublicHomeworkTeacherNote } from "../src/components/lessons/homework-teacher-note";
import { I18nProvider } from "../src/components/i18n-provider";
import { dictionaries } from "../src/lib/i18n";
import { normalizeClassTimerState } from "../src/lib/class-timer";

const auto: HomeworkExercise = { id: "fill-main", title: "Fill", instruction: "", kind: "fill", items: [{ id: "fill-one", prompt: "A ___", answer: "berry" }, { id: "fill-two", prompt: "An ___", answer: "apple" }] };
const initial: HomeworkStoredState = { [homeworkValueKey("fill-one")]: "berry", [homeworkStatusKey("fill-one")]: "correct", [homeworkStatusKey("fill-two")]: "locked", [homeworkReviewedAtKey()]: "2026-10-08T15:00:00Z", "regular-answer:warm:one": "Unrelated lesson answer" };
function apply(state: HomeworkStoredState, patch: Record<string, string | null>) {
  const next = { ...state };
  for (const [key, value] of Object.entries(patch)) if (value === null) delete next[key]; else next[key] = value;
  return next;
}

test("any exercise kind accepts an editable teacher score and public comment after review", () => {
  for (const kind of ["fill", "definition", "describe", "drag", "translate", "question-text", "question-audio"] as const) {
    const state = apply(initial, homeworkGradeFeedbackPatch(auto.id, 92, "  Clear explanation.\nKeep going!  "));
    assert.equal(homeworkExerciseScore({ ...auto, kind }, state), 92);
    assert.equal(homeworkExerciseComment(state, auto.id), "Clear explanation.\nKeep going!");
    for (const key of Object.keys(initial)) assert.equal(state[key], initial[key]);
    const edited = apply(state, homeworkGradeFeedbackPatch(auto.id, 0, "Please revise."));
    assert.equal(homeworkExerciseScore({ ...auto, kind }, edited), 0);
  }
});

test("comment-only changes leave automatic scoring live; clearing an override restores computed results", () => {
  assert.equal(homeworkExerciseScore(auto, initial), 50);
  const noteOnly = apply(initial, homeworkGradeFeedbackPatch(auto.id, null, "Teacher's note"));
  assert.equal(homeworkExerciseScore(auto, noteOnly), 50);
  const override = apply(noteOnly, homeworkGradeFeedbackPatch(auto.id, 95, "Teacher's note"));
  assert.equal(homeworkExerciseScore(auto, override), 95);
  const restored = apply(override, homeworkGradeFeedbackPatch(auto.id, null, "Teacher's note"));
  assert.equal(homeworkExerciseScore(auto, restored), 50);
  assert.equal(homeworkExerciseComment(restored, auto.id), "Teacher's note");
  assert.equal(homeworkExerciseScore(auto, { ...restored, [homeworkStatusKey("fill-two")]: "correct" }), 100);
});

test("overall grade overrides the average, supports zero and has a separate public note", () => {
  assert.deepEqual(homeworkOverallScore([auto], initial), { score: 50, graded: 1, total: 1 });
  const state = apply(initial, homeworkGradeFeedbackPatch(null, 0, "Overall note"));
  assert.equal(homeworkOverallTeacherScore(state), 0);
  assert.equal(homeworkOverallComment(state), "Overall note");
  assert.equal(homeworkOverallScore([auto], state).score, 0);
  const cleared = apply(state, homeworkGradeFeedbackPatch(null, null, "Overall note"));
  assert.equal(homeworkOverallScore([auto], cleared).score, 50);
  assert.equal(homeworkOverallComment(cleared), "Overall note");
  assert.equal(homeworkOverallScore([], state).score, 0);
});

test("grade metadata validation rejects invalid targets and scores while bounding public comments", () => {
  for (const score of [-1, 101, 2.5, NaN, Infinity]) assert.throws(() => homeworkGradeFeedbackPatch(auto.id, score, ""));
  assert.throws(() => homeworkGradeFeedbackPatch("bad:key", 100, ""));
  assert.equal(homeworkGradeFeedbackPatch(null, 100, "x".repeat(5000))[HOMEWORK_OVERALL_COMMENT_KEY]?.length, 4000);
  assert.deepEqual(homeworkGradeFeedbackPatch(null, null, "  "), { [HOMEWORK_OVERALL_SCORE_KEY]: null, [HOMEWORK_OVERALL_COMMENT_KEY]: null });
  for (const raw of ["", " ", "-1", "101", "NaN", "x"]) assert.equal(homeworkOverallTeacherScore({ [HOMEWORK_OVERALL_SCORE_KEY]: raw }), null);
});

test("live grade changes preserve a student's in-progress answer, clear obsolete feedback and avoid redundant renders", () => {
  const local = { ...initial, [homeworkValueKey("fill-one")]: "Currently typing", [homeworkExerciseScoreKey(auto.id)]: "80" };
  const saved = apply(initial, homeworkGradeFeedbackPatch(null, 85, "New overall note"));
  const merged = mergeHomeworkGradeFeedback(local, saved);
  assert.equal(merged[homeworkValueKey("fill-one")], "Currently typing");
  assert.equal(merged[homeworkExerciseScoreKey(auto.id)], undefined);
  assert.equal(merged[HOMEWORK_OVERALL_SCORE_KEY], "85");
  assert.equal(merged[HOMEWORK_OVERALL_COMMENT_KEY], "New overall note");
  assert.equal(mergeHomeworkGradeFeedback(merged, saved), merged);
  assert.equal(local[homeworkExerciseScoreKey(auto.id)], "80");
});

test("automatic and manual activity feedback notes remain public, bounded and backwards compatible", () => {
  assert.deepEqual(readHomeworkFeedback(null), { autoEnabled: true, manualReaction: null });
  assert.deepEqual(readHomeworkFeedback({ autoEnabled: true, teacherNote: "  Well done!  " }), { autoEnabled: true, manualReaction: null, teacherNote: "Well done!" });
  assert.equal(readHomeworkFeedback({ teacherNote: "x".repeat(5000) }).teacherNote?.length, 4000);
  assert.equal(lessonHomeworkFeedback({ [HOMEWORK_RESULT_COMMENT_KEY]: "Visible note" }).teacherNote, "Visible note");
});

test("atomic grade updates bind only grade keys and never include an answer snapshot", () => {
  const dialect = new PgDialect();
  const patch = homeworkGradeFeedbackPatch(auto.id, 87, "Nice work");
  const query = dialect.sqlToQuery(homeworkGradeFeedbackPatchSql(sql.identifier("answers"), patch));
  assert.match(query.sql, /coalesce\("answers", '\{\}'::jsonb\)/);
  assert.match(query.sql, /- ARRAY\[\$1, \$2\]::text\[\]/);
  assert.deepEqual(query.params.slice(0, 2), Object.keys(patch));
  assert.deepEqual(JSON.parse(String(query.params[2])), patch);
  assert.throws(() => homeworkGradeFeedbackPatchSql(sql.identifier("answers"), { "hw:value:fill-one": "Forged answer" }));
});

test("stale student saves discard forged scores and retain current DB teacher feedback", () => {
  const stale = { ...initial, [HOMEWORK_OVERALL_SCORE_KEY]: "100", [homeworkExerciseScoreKey(auto.id)]: "100", [homeworkExerciseCommentKey(auto.id)]: "Forged note", [HOMEWORK_RESULT_COMMENT_KEY]: "Forged result note" };
  const query = new PgDialect().sqlToQuery(homeworkStateWithCurrentResultSql(sql.identifier("answers"), stale));
  const incoming = JSON.parse(String(query.params[0]));
  assert(!Object.keys(incoming).some(isHomeworkGradeFeedbackKey));
  assert.equal(incoming[homeworkValueKey("fill-one")], "berry");
  assert.match(query.sql, /jsonb_each\(coalesce\("answers", '\{\}'::jsonb\)\)/);
  assert.match(query.sql, /jsonb_object_agg/);
  assert(query.params.includes("hw:exercise-score:"));
  assert(query.params.includes(HOMEWORK_RESULT_COMMENT_KEY));
});

test("generic answers cannot forge teacher grades and the dedicated editor has no homework-status lock", () => {
  const source = readFileSync("src/lib/actions/lessons.ts", "utf8");
  const action = source.split("export async function answerAction(")[1].split("async function regularAssignmentForUser")[0];
  assert.match(action, /isStudent && isHomeworkGradeFeedbackKey\(responseKey\)/);
  const grade = readFileSync("src/lib/actions/lesson-homework.ts", "utf8").split("export async function saveHomeworkExerciseGradeAction(")[1].split("export async function homeworkReviewStateAction(")[0];
  assert.match(grade, /session\.role !== "TEACHER"/);
  assert.match(grade, /row\.authorId !== session\.userId/);
  assert.match(grade, /homeworkGradeFeedbackPatchSql/);
  assert.match(grade, /returning\(\{ answers:/);
  assert.match(grade, /gradeFeedback: true/);
  assert(!grade.includes("homeworkReviewedAt("));
  assert(!grade.includes("homeworkSubmittedAt("));
});

test("grade editor entry point is localized, compact and does not expose draft fields until opened", () => {
  for (const locale of ["en", "ru", "uk"] as const) {
    const children = createElement(HomeworkGradeEditor, { score: 100, teacherScore: null, comment: "", onSave: async () => undefined });
    const html = renderToStaticMarkup(createElement(I18nProvider,
      { locale, dictionary: dictionaries[locale], realtimeConfigured: false } as Parameters<typeof I18nProvider>[0], children));
    assert(html.includes(dictionaries[locale].interactiveHomework.editGrade));
    assert(html.includes("<button"));
    assert(!html.includes("<textarea"));
    assert(!html.includes("<input"));
  }
  const source = readFileSync("src/components/lessons/interactive-homework.tsx", "utf8");
  assert.equal(source.split("{session.teacher && <HomeworkGradeEditor").length - 1, 2);
  assert(!source.includes("reviewTools && needsTeacherScore"));
  assert.match(source, /homeworkOverallComment\(state\)/);
  assert.match(source, /message\.data\?\.gradeFeedback === true/);
});

test("public teacher notes are visible without a score, preserve lines and escape HTML", () => {
  const note = "First line\n<script>alert(1)</script>";
  const html = renderToStaticMarkup(createElement(PublicHomeworkTeacherNote, { label: "Teacher's note", note }));
  assert.match(html, /data-teacher-feedback-note/);
  assert(html.includes("First line\n"));
  assert(html.includes("&lt;script&gt;"));
  assert(!html.includes("<script>"));
  assert.equal(renderToStaticMarkup(createElement(PublicHomeworkTeacherNote, { label: "Note", note: "" })), "");
});

test("timer rating notes are safe, editable and follow existing student visibility", () => {
  const timer = normalizeClassTimerState({ rating: { grade: "GOOD", visible: false, at: "now", notes: "  Clear answer  " } });
  assert.equal(timer?.rating?.notes, "Clear answer");
  assert.equal(timer?.rating?.visible, false);
  assert.equal(normalizeClassTimerState({ rating: { grade: "GOOD", at: "now", notes: "x".repeat(1200) } })?.rating?.notes?.length, 1000);
  assert.equal(normalizeClassTimerState({ rating: { grade: "GOOD", at: "now", notes: {} } })?.rating?.notes, undefined);
  const source = readFileSync("src/components/class/class-timer.tsx", "utf8");
  assert.match(source, /state\.rating && \(!student \|\| state\.rating\.visible\)/);
  assert.match(source, /saveClassTimerRatingAction\(grade, visible, notes\)/);
});
