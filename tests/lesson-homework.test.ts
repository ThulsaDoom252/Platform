import assert from "node:assert/strict";
import test from "node:test";
import {
  homeworkAnswerMatches,
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkExerciseHidden,
  homeworkExerciseHiddenKey,
  homeworkExerciseProgress,
  homeworkProgress,
  homeworkStatusKey,
  homeworkValueKey,
  normalizeInteractiveHomework,
  type InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const plan: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1",
  title: "Homework",
  exercises: [
    {
      id: "fill-main",
      title: "Fill",
      instruction: "Fill the gap",
      kind: "fill",
      items: [{ id: "fill-one", prompt: "I have ___ go.", answer: "got to", accepted: ["have got to"] }],
    },
    {
      id: "free-main",
      title: "Describe",
      instruction: "Describe it",
      kind: "describe",
      items: [{ id: "free-one", prompt: "Describe it", word: "to wonder" }],
    },
    {
      id: "bonus",
      title: "Bonus",
      instruction: "Optional",
      kind: "translate",
      optional: true,
      items: [{ id: "bonus-one", prompt: "Переведи" }],
    },
  ],
};

test("домашка очищает повреждённый json и сохраняет поддерживаемые блоки", () => {
  const normalized = normalizeInteractiveHomework({
    ...plan,
    exercises: [...plan.exercises, { id: "bad id", title: "Bad", kind: "script", items: [] }],
  });
  assert.ok(normalized);
  assert.equal(normalized.exercises.length, 3);
});

test("проверка ответа принимает регистр, знаки и допустимый вариант", () => {
  const item = plan.exercises[0].items[0];
  assert.equal(homeworkAnswerMatches(item, "GOT TO!"), true);
  assert.equal(homeworkAnswerMatches(item, "have got to"), true);
  assert.equal(homeworkAnswerMatches(item, "gotta"), false);
});

test("история ошибок хранит не больше трёх попыток", () => {
  const state = {
    [homeworkAttemptsKey("fill-one")]: JSON.stringify(["one", "two", "three", "four"]),
  };
  assert.deepEqual(homeworkAttempts(state, "fill-one"), ["one", "two", "three"]);
});

test("прогресс считает обязательные задания и не считает бонусы", () => {
  const state = {
    [homeworkStatusKey("fill-one")]: "locked",
    [homeworkValueKey("free-one")]: "A short explanation",
    [homeworkValueKey("bonus-one")]: "Optional answer",
  };
  assert.deepEqual(homeworkProgress(plan, state), { done: 2, total: 2 });
});

test("скрытое учителем упражнение не видно ученику и не входит в прогресс", () => {
  const state = { [homeworkExerciseHiddenKey("free-main")]: "1" };
  assert.equal(homeworkExerciseHidden(state, "free-main"), true);
  assert.equal(homeworkExerciseHidden(state, "fill-main"), false);
  assert.deepEqual(homeworkProgress(plan, state), { done: 0, total: 1 });
});

test("прогресс секций отдельно считает обязательные упражнения и бонусы", () => {
  const state = {
    [homeworkStatusKey("fill-one")]: "correct",
    [homeworkValueKey("free-one")]: "A short explanation",
  };
  assert.deepEqual(homeworkExerciseProgress(plan, state), {
    required: { done: 2, total: 2 },
    bonuses: { done: 0, total: 1 },
  });
});
