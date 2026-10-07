import assert from "node:assert/strict";
import test from "node:test";
import { revealHomeworkFocusTarget } from "../src/lib/homework-focus";
import {
  homeworkExerciseFocusId,
  homeworkExerciseHiddenKey,
  homeworkFocusTarget,
  homeworkItemFocusId,
  homeworkVisibleExercises,
  type HomeworkExerciseKind,
  type InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const kinds: HomeworkExerciseKind[] = ["fill", "definition", "describe", "drag", "translate", "question-text", "question-audio"];
const plan: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Homework",
  exercises: kinds.map((kind) => ({
    id: `exercise-${kind}`, title: kind, kind, instruction: "",
    optional: kind === "question-audio",
    items: [{ id: `item-${kind}`, prompt: "Question" }],
  })),
};

test("focus accepts every homework exercise kind, bonuses and individual sentences", () => {
  for (const exercise of plan.exercises) {
    assert.deepEqual(homeworkFocusTarget(plan, homeworkExerciseFocusId(exercise.id)), { exerciseId: exercise.id, itemId: null });
    assert.deepEqual(homeworkFocusTarget(plan, homeworkItemFocusId(exercise.items[0].id)), { exerciseId: exercise.id, itemId: exercise.items[0].id });
  }
  assert.equal(homeworkFocusTarget(plan, "homework:exercise:another-students-exercise"), null);
});

test("live focus temporarily reveals a hidden exercise, without altering review status or visibility", () => {
  const state = {
    [homeworkExerciseHiddenKey("exercise-translate")]: "1",
    [homeworkExerciseHiddenKey("exercise-question-audio")]: "1",
    "hw:reviewed-at": "2026-10-08T08:00:00.000Z",
    "hw:submitted-at": "2026-10-08T07:00:00.000Z",
    "hw:value:item-translate": "A saved answer",
  };
  const before = { ...state };
  assert.equal(homeworkVisibleExercises(plan, state, false).length, 5);
  const focused = homeworkVisibleExercises(plan, state, false, homeworkExerciseFocusId("exercise-translate"));
  assert(focused.some((exercise) => exercise.id === "exercise-translate"));
  assert(!focused.some((exercise) => exercise.id === "exercise-question-audio"));
  assert(homeworkVisibleExercises(plan, state, false, homeworkItemFocusId("item-question-audio")).some((exercise) => exercise.id === "exercise-question-audio"));
  assert.equal(homeworkVisibleExercises(plan, state, false, "bad-target").length, 5);
  assert.equal(homeworkVisibleExercises(plan, state, true).length, 7);
  assert.deepEqual(state, before);
});

function collapsedBonuses() {
  const outer = { open: false, parentElement: null };
  const inner = { open: false, parentElement: { closest: () => outer } };
  const target = { dataset: { homeworkFocus: "homework:item:bonus-one" }, closest: () => inner };
  const root = { querySelectorAll: () => [target] } as unknown as ParentNode;
  return { root, target, inner, outer };
}

test("focusing a bonus sentence expands all collapsed ancestors, including repeated commands", () => {
  const { root, target, inner, outer } = collapsedBonuses();
  assert.equal(revealHomeworkFocusTarget(root, "homework:item:bonus-one"), target);
  assert.equal(inner.open, true);
  assert.equal(outer.open, true);
  inner.open = false;
  outer.open = false;
  assert.equal(revealHomeworkFocusTarget(root, "homework:item:bonus-one"), target);
  assert.equal(inner.open, true);
  assert.equal(outer.open, true);
});

test("an unknown focus cannot open an unrelated bonus", () => {
  const { root, inner, outer } = collapsedBonuses();
  assert.equal(revealHomeworkFocusTarget(root, "homework:item:missing"), null);
  assert.equal(inner.open, false);
  assert.equal(outer.open, false);
});
