import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeworkResultReactionBadge } from "../src/components/homework-result-reaction";
import {
  HOMEWORK_OVERALL_REACTION_KEY, HOMEWORK_RESULT_REACTIONS, homeworkResultReaction,
  isHomeworkResultReaction, latestCompletedHomeworkScore, lessonHomeworkFeedback,
  readHomeworkFeedback, resolveHomeworkFeedback,
} from "../src/lib/homework-feedback";
import { scoreRevision, type RevisionAnswer } from "../src/lib/revision-score";
import { mergeHomeworkReactions, withoutHomeworkReactions } from "../src/lib/lesson-homework";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { revisionHomeworkScoreSql } from "../src/lib/homework-feedback-persistence";

test("complete reaction scale includes every boundary and the 70–79 practice band", () => {
  for (const [percentage, reaction] of [
    [0, "ridiculous"], [19, "ridiculous"], [20, "kidding"], [39, "kidding"],
    [40, "bad"], [49, "bad"], [50, "could-be-better"], [59, "could-be-better"],
    [60, "need-practice"], [69, "need-practice"], [70, "need-practice"], [79, "need-practice"],
    [80, "not-bad"], [89, "not-bad"], [90, "good"], [99, "good"], [100, "excellent"],
  ] as const) assert.equal(homeworkResultReaction({ right: percentage, total: 100 }), reaction, String(percentage));
  assert.equal(homeworkResultReaction({ right: 199, total: 200 }), "good");
  assert.equal(homeworkResultReaction({ right: 899, total: 1000 }), "not-bad");
  assert.equal(homeworkResultReaction({ right: 399, total: 1000 }), "kidding");
});

test("invalid and unscored results never receive an automatic reaction", () => {
  for (const score of [null, undefined, { right: 0, total: 0 }, { right: -1, total: 10 },
    { right: 11, total: 10 }, { right: NaN, total: 10 }, { right: 1, total: Infinity }]) {
    assert.equal(homeworkResultReaction(score), null);
  }
});

test("automatic defaults apply to old assignments and manual overrides only apply when disabled", () => {
  assert.deepEqual(readHomeworkFeedback(null), { autoEnabled: true, manualReaction: null });
  assert.equal(resolveHomeworkFeedback(undefined, { right: 10, total: 10 }), "excellent");
  assert.equal(resolveHomeworkFeedback(undefined, null), null);
  assert.equal(resolveHomeworkFeedback({ autoEnabled: true, manualReaction: "bad" }, { right: 10, total: 10 }), "excellent");
  assert.equal(resolveHomeworkFeedback({ autoEnabled: false, manualReaction: "bad" }, { right: 10, total: 10 }), "bad");
  assert.equal(resolveHomeworkFeedback({ autoEnabled: false, manualReaction: null }, { right: 10, total: 10 }), null);
  assert.equal(resolveHomeworkFeedback({ autoEnabled: true, manualReaction: "good" }, null, false), "good");
  assert.equal(isHomeworkResultReaction("unknown"), false);
  assert.deepEqual(readHomeworkFeedback({ autoEnabled: false, manualReaction: "bogus" }), { autoEnabled: false, manualReaction: null });
});

test("only the latest completed attempt is graded; active attempts do not replace it", () => {
  const rows = [
    { finishedAt: "2026-10-08T12:00:00Z", result: { right: 8, total: 10 } },
    { finishedAt: null, result: { right: 0, total: 10 } },
    { finishedAt: "2026-10-08T11:00:00Z", result: { right: 10, total: 10 } },
  ];
  const snapshot = structuredClone(rows);
  assert.deepEqual(latestCompletedHomeworkScore(rows), { right: 8, total: 10 });
  assert.deepEqual(rows, snapshot);
  assert.equal(latestCompletedHomeworkScore([rows[1]]), null);
});

test("flashcards are excluded from result reactions, mixed tests retain exact accuracy", () => {
  const answers: RevisionAnswer[] = [
    { mode: "flashcards", phraseId: "a", word: "cat", correct: true, ms: 900 },
    { mode: "choose", phraseId: "a", word: "cat", correct: false, ms: 1000 },
  ];
  assert.equal(homeworkResultReaction(scoreRevision(answers)), "ridiculous");
  assert.equal(homeworkResultReaction(scoreRevision(answers.slice(0, 1))), null);
});

test("list score query only returns counts and excludes flashcards", () => {
  const query = new PgDialect().sqlToQuery(revisionHomeworkScoreSql(sql.identifier("answers")));
  assert.match(query.sql, /jsonb_build_object/);
  assert.match(query.sql, /count\(\*\) filter/);
  assert.match(query.sql, /<> 'flashcards'/);
  assert.deepEqual(query.params, []);
});

test("interactive manual result participates in reaction synchronization/reset but preserves answers", () => {
  const state = { "hw:value:one": "Student answer", "hw:exercise-score:one": "90", [HOMEWORK_OVERALL_REACTION_KEY]: "good" };
  assert.deepEqual(lessonHomeworkFeedback(state), { autoEnabled: false, manualReaction: "good" });
  assert.deepEqual(withoutHomeworkReactions(state), { "hw:value:one": "Student answer", "hw:exercise-score:one": "90" });
  assert.equal(mergeHomeworkReactions(state, { [HOMEWORK_OVERALL_REACTION_KEY]: "excellent" })[HOMEWORK_OVERALL_REACTION_KEY], "excellent");
  assert.equal(lessonHomeworkFeedback({ [HOMEWORK_OVERALL_REACTION_KEY]: "bogus" }).manualReaction, null);
});

test("generic lesson responses cannot forge teacher reactions and voice saves retain current feedback", () => {
  const source = readFileSync("src/lib/actions/lessons.ts", "utf8");
  const answer = source.split("export async function answerAction(")[1].split("async function regularAssignmentForUser")[0];
  assert.match(answer, /if \(isStudent && responseKey\.startsWith\(HOMEWORK_REACTION_PREFIX\)\)/);
  assert.match(answer, /answers: sql`coalesce\(/);
  const voice = source.split("export async function saveRegularVoiceRecordingAction(")[1].split("export async function resetRegularLessonExerciseAction(")[0];
  assert.match(voice, /homeworkStateWithCurrentResultSql/);
  assert.match(voice, /return \{ state: persisted\?\.answers \?\? state \}/);
});

test("result badges render large smileys with captions underneath, semantic strength and no percentages", () => {
  for (const item of HOMEWORK_RESULT_REACTIONS) {
    const html = renderToStaticMarkup(createElement(HomeworkResultReactionBadge, { reaction: item.id }));
    assert.ok(html.includes(item.emoji));
    assert.ok(html.includes(item.caption));
    assert.match(html, new RegExp(`data-tone="${item.tone}"`));
    assert.match(html, new RegExp(`data-strength="${item.strength}"`));
    assert.equal(html.includes("%"), false);
    assert.ok(html.indexOf("homework-result-emoji") < html.indexOf("homework-result-caption"));
  }
  assert.equal(renderToStaticMarkup(createElement(HomeworkResultReactionBadge, { reaction: null })), "");
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /--result-color: var\(--t-green\)/);
  assert.match(css, /--result-color: var\(--t-amber\)/);
  assert.match(css, /--result-color: var\(--t-rose\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.homework-result-reaction \{\s*animation: none;/);
});
