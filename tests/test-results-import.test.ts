import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import * as jsx from "react/jsx-runtime";
import { TEST_LABELS } from "../src/lib/tests/labels";
import { SECOND_CONDITIONAL } from "../src/lib/tests/second-conditional";
import { SECOND_CONDITIONAL_KEY } from "../src/lib/tests/second-conditional-key";
import { prepareTestResultsImport } from "../src/lib/tests/import-results";
import type { TestHomeworkCard } from "../src/lib/tests/types";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  return {
    student: { id: uuid(1), name: "Fixture student" }, teacher: { id: uuid(2), name: "Fixture teacher" }, importedAt: "2026-10-11T12:00:00.000Z",
    tests: [{ assignmentId: uuid(3), testId: SECOND_CONDITIONAL.id, version: SECOND_CONDITIONAL.version,
      attempts: [{ id: uuid(4), exercises: SECOND_CONDITIONAL.exercises.map((exercise) => ({
        exerciseId: exercise.id, file: `fixture-${exercise.number}.png`, scoreUnit: exercise.number === 3 ? "sentence" as const : "answer" as const,
        answers: Object.fromEntries(Object.entries(SECOND_CONDITIONAL_KEY[exercise.id]).map(([id, key]) => [id, structuredClone(key.answer)])),
        correct: 10, total: 10, wrongQuestionIds: [] as string[],
      })) }] }],
  };
}

test("Imported sentence scoring preserves 80%, both wrong gaps, exact answers and source metadata", () => {
  const raw = fixture(), exercise = raw.tests[0].attempts[0].exercises[2];
  exercise.answers.q9 = "would never forget"; exercise.answers.q15 = "wouldn't criticise"; exercise.answers.q16 = "had";
  exercise.correct = 8; exercise.wrongQuestionIds = ["q9", "q15", "q16"];
  const prepared = prepareTestResultsImport(raw), saved = prepared.tests[0].attempts[0];
  assert.equal(saved.results["exercise-3"].percent, 80);
  assert.equal(saved.results["exercise-3"].total, 10);
  assert.equal(saved.results["exercise-3"].questions.length, 20);
  assert.equal(saved.correct, 28); assert.equal(saved.total, 30); assert.equal(saved.percent, 93);
  assert.deepEqual(saved.results["exercise-3"].questions.filter((q) => !q.correct).map((q) => q.selected), ["would never forget", "wouldn't criticise", "had"]);
  assert.deepEqual(saved.results["exercise-3"].source, { name: "Test-English", file: "fixture-3.png", importedAt: raw.importedAt, scoreUnit: "sentence" });
  assert.ok(saved.completedAt); assert.equal(raw.tests[0].attempts[0].exercises[2].total, 10);
});

test("Final screenshots import one complete 97% attempt with exactly the reported question-3 mistake", () => {
  const raw = fixture(), exercise = raw.tests[0].attempts[0].exercises[0];
  exercise.answers.q3 = "had you"; exercise.correct = 9; exercise.wrongQuestionIds = ["q3"];
  const saved = prepareTestResultsImport(raw).tests[0].attempts[0];
  assert.equal(saved.correct, 29); assert.equal(saved.total, 30); assert.equal(saved.percent, 97);
  assert.deepEqual(Object.values(saved.results).map((result) => result.percent), [90, 100, 100]);
  assert.deepEqual(Object.values(saved.results).flatMap((result) => result.questions.filter((question) => !question.correct)
    .map((question) => ({ id: question.id, selected: question.selected, answer: question.answer }))),
    [{ id: "q3", selected: "had you", answer: "would you" }]);
});

test("Import refuses missing/extra answers, mismatched screenshot totals, incorrect mistake lists and partial tests", () => {
  let raw = fixture(); delete raw.tests[0].attempts[0].exercises[0].answers.q1;
  assert.throws(() => prepareTestResultsImport(raw), /Missing or extra answers/);
  raw = fixture(); raw.tests[0].attempts[0].exercises[0].answers.extra = "had";
  assert.throws(() => prepareTestResultsImport(raw), /Missing or extra answers/);
  raw = fixture(); raw.tests[0].attempts[0].exercises[0].correct = 9;
  assert.throws(() => prepareTestResultsImport(raw), /Screenshot score mismatch/);
  raw = fixture(); raw.tests[0].attempts[0].exercises[0].wrongQuestionIds = ["q1"];
  assert.throws(() => prepareTestResultsImport(raw), /Mistakes mismatch/);
  raw = fixture(); raw.tests[0].attempts[0].exercises.pop();
  assert.throws(() => prepareTestResultsImport(raw), /All exercises/);
});

test("Import preserves separate attempts in supplied order; IDs and snapshot versions cannot collide", () => {
  const raw = fixture(), retry = structuredClone(raw.tests[0].attempts[0]);
  retry.id = uuid(5); retry.exercises[0].answers.q1 = "would have"; retry.exercises[0].correct = 9; retry.exercises[0].wrongQuestionIds = ["q1"];
  raw.tests[0].attempts.push(retry);
  const imported = prepareTestResultsImport(raw);
  assert.equal(imported.tests[0].attempts[0].percent, 100); assert.equal(imported.tests[0].attempts[1].percent, 97);
  assert.ok(imported.tests[0].attempts[1].createdAt > imported.tests[0].attempts[0].createdAt);
  raw.tests[0].attempts[1].id = uuid(4); assert.throws(() => prepareTestResultsImport(raw), /Duplicate import ID/);
  const version = fixture(); version.tests[0].version = 999; assert.throws(() => prepareTestResultsImport(version), /version mismatch/);
  const wrongUnit = fixture(); wrongUnit.tests[0].attempts[0].exercises[0].scoreUnit = "sentence";
  assert.throws(() => prepareTestResultsImport(wrongUnit), /Invalid sentence scoring/);
});

// Render the real server component with only the card's unrelated interactive controls stubbed out.
const moduleSource = readFileSync(new URL("../src/components/tests/assigned-tests-list.tsx", import.meta.url), "utf8");
const exported: Record<string, unknown> = {};
runInNewContext(ts.transpileModule(moduleSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports: exported,
  require: (name: string) => name === "react/jsx-runtime" ? jsx : name === "lucide-react" ? icons
    : name === "@/lib/tests/labels" ? { TEST_LABELS }
      : name === "./test-assignment-card" ? { TestAssignmentCard: ({ item }: { item: TestHomeworkCard }) => createElement("article", { "data-card": item.id }, item.title) }
        : (() => { throw new Error(`Unexpected module: ${name}`); })(),
});
const List = exported.AssignedTestsList as (props: { items: TestHomeworkCard[]; locale: "en"; teacher?: boolean }) => ReturnType<typeof createElement>;
const card = (id: string, completed = false): TestHomeworkCard => ({ id, kind: "TEST", activityType: "TEST", title: `Test ${id}`,
  studentId: uuid(1), studentName: "Fixture student", studentAvatarUrl: null, assignedAt: "2026-10-11T12:00:00.000Z",
  submittedAt: completed ? "2026-10-11T12:01:00.000Z" : null, reviewedAt: null, nextLessonAt: null,
  started: completed, exerciseIds: ["exercise-1"], latestPercent: completed ? 40 : null, attemptCount: completed ? 1 : 0 });
const render = (items: TestHomeworkCard[]) => renderToStaticMarkup(createElement(List, { items, locale: "en" }));

test("Awaiting and Passed tests only render when nonempty; completion is not a score threshold", () => {
  assert.doesNotMatch(render([]), /data-test-section/);
  assert.match(render([]), /No assigned tests yet/);
  assert.match(render([card("pending")]), /data-test-section="awaiting"/);
  assert.doesNotMatch(render([card("pending")]), /data-test-section="passed"/);
  assert.match(render([card("done", true)]), /data-test-section="passed"/);
  assert.doesNotMatch(render([card("done", true)]), /data-test-section="awaiting"/);
  const mixed = render([card("done", true), card("pending")]);
  assert.equal((mixed.match(/data-card="/g) ?? []).length, 2);
  assert.match(mixed, /Awaiting.*data-card="pending".*Passed tests.*data-card="done"/);
});

test("Restart returns a test to Awaiting even with completed attempts still in history", () => {
  const restarted = { ...card("retry", true), submittedAt: null, started: false, latestPercent: null, attemptCount: 2 };
  assert.match(render([restarted]), /data-test-section="awaiting"/);
  assert.doesNotMatch(render([restarted]), /data-test-section="passed"/);
});

test("Offline import never updates/deletes student work or sends notifications", () => {
  const script = readFileSync(new URL("../scripts/import-test-results.ts", import.meta.url), "utf8");
  assert.match(script, /--apply/); assert.match(script, /SET TRANSACTION READ ONLY/); assert.match(script, /database.transaction/);
  assert.doesNotMatch(script, /\.update\(|\.delete\(|notifications\)\.values/);
  assert.match(script, /identityQuery\.for\("update"\)/);
  assert.match(script, /Stored answers did not match/);
});
