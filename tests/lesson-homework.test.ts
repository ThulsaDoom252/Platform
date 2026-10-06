import assert from "node:assert/strict";
import test from "node:test";
import {
  assignedInteractiveHomework,
  homeworkAnswerMatches,
  homeworkAssignedAtKey,
  homeworkAssignedExercisesKey,
  homeworkAttempts,
  homeworkAttemptsKey,
  homeworkExerciseHidden,
  homeworkExerciseHiddenKey,
  homeworkExerciseFocusId,
  homeworkExerciseProgress,
  homeworkFillEditorLine,
  homeworkFillItemFromEditorLine,
  homeworkFocusTarget,
  homeworkHighlight,
  homeworkItemFocusId,
  homeworkProgress,
  homeworkReaction,
  homeworkRemainingWordBank,
  homeworkRevisionRequestedAt,
  homeworkRevisionRequestedAtKey,
  homeworkRemovedAt,
  homeworkRemovedAtKey,
  homeworkReviewedAt,
  homeworkReviewedAtKey,
  homeworkPlanForAssignment,
  homeworkPlanEditIssue,
  homeworkPlanOverrideKey,
  homeworkStarted,
  homeworkStatusKey,
  homeworkTextHighlight,
  homeworkTextTokens,
  homeworkTeacherVoiceMessages,
  homeworkTeacherVoiceMessagesKey,
  homeworkTranslationLanguage,
  homeworkValueKey,
  normalizeInteractiveHomework,
  setHomeworkReaction,
  toggleHomeworkHighlight,
  toggleHomeworkTextHighlight,
  withoutAssignedHomeworkState,
  withoutHomeworkExerciseState,
  withoutHomeworkProgressState,
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

test("домашка сохраняет направление перевода с английского", () => {
  const normalized = normalizeInteractiveHomework({
    ...plan,
    exercises: plan.exercises.map((exercise) =>
      exercise.id === "bonus"
        ? { ...exercise, translationDirection: "from-english" }
        : exercise,
    ),
  });
  assert.equal(
    normalized?.exercises.find((exercise) => exercise.id === "bonus")?.translationDirection,
    "from-english",
  );
});

test("банк слов скрывает только правильно использованные ответы", () => {
  const exercise = {
    id: "bank",
    title: "Fill",
    instruction: "",
    kind: "fill" as const,
    wordBank: ["to wonder", "to face", "to face"],
    items: [
      { id: "bank-one", prompt: "I ___ why.", answer: "to wonder" },
      { id: "bank-two", prompt: "We need ___ it.", answer: "to face" },
      { id: "bank-three", prompt: "They had ___ it.", answer: "to face" },
    ],
  };
  const state = {
    [homeworkStatusKey("bank-one")]: "correct",
    [homeworkValueKey("bank-one")]: "To wonder!",
    [homeworkStatusKey("bank-two")]: "locked",
    [homeworkValueKey("bank-two")]: "to phase",
    [homeworkStatusKey("bank-three")]: "correct",
    [homeworkValueKey("bank-three")]: "to face",
  };

  assert.deepEqual(homeworkRemainingWordBank(exercise, state), ["to face"]);
});

test("домашка сохраняет и определяет персональный язык упражнения на перевод", () => {
  const normalized = normalizeInteractiveHomework({
    ...plan,
    exercises: plan.exercises.map((exercise) =>
      exercise.id === "bonus"
        ? {
            ...exercise,
            translationDirection: "to-english",
            translationLanguage: "RU",
            items: [{ id: "bonus-one", prompt: "Я случайно разбил чашку.", answer: "I accidentally broke my cup." }],
          }
        : exercise,
    ),
  });
  const exercise = normalized?.exercises.find((item) => item.id === "bonus");
  assert.ok(exercise);
  assert.equal(exercise.translationLanguage, "RU");
  assert.equal(homeworkTranslationLanguage(exercise), "RU");

  assert.equal(homeworkTranslationLanguage({
    ...exercise,
    translationLanguage: undefined,
    items: [{ id: "bonus-one", prompt: "Я випадково розбив чашку.", answer: "I accidentally broke my cup." }],
  }), "UK");
});

test("голосовой вопрос сохраняет только безопасную ссылку на аудио", () => {
  const normalized = normalizeInteractiveHomework({
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: "Audio questions",
    exercises: [{
      id: "audio-questions",
      title: "Listen and answer",
      instruction: "Listen to every question and record your answer.",
      kind: "question-audio",
      items: [
        {
          id: "audio-question-one",
          prompt: "Audio question 1",
          questionAudioUrl: "https://example.com/question-1.mp3",
        },
        {
          id: "audio-question-two",
          prompt: "Audio question 2",
          questionAudioUrl: "javascript:alert(1)",
        },
      ],
    }],
  });
  assert.equal(
    normalized?.exercises[0].items[0].questionAudioUrl,
    "https://example.com/question-1.mp3",
  );
  assert.equal(normalized?.exercises[0].items[1].questionAudioUrl, undefined);
});

test("автоматические ответы обычного урока не превращаются в подсказки", () => {
  const normalized = normalizeInteractiveHomework({
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: "Grammar Check · Homework",
    exercises: [{
      id: "regular-02-present-1",
      title: "Present Simple vs Present Continuous",
      instruction: "Open the brackets. Then press Check.",
      kind: "fill",
      wordBank: ["sets", "are walking"],
      items: [
        { id: "regular-02-present-1-1", prompt: "She usually ___. (set)", answer: "sets" },
      ],
    }],
  });
  assert.equal(normalized?.exercises[0].instruction, "Open the brackets.");
  assert.equal(normalized?.exercises[0].wordBank, undefined);
  assert.equal(normalized?.exercises[0].items[0].answer, "sets");
});

test("обычная вставка слов сохраняет предназначенный для неё список", () => {
  const normalized = normalizeInteractiveHomework({
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: "Vocabulary homework",
    exercises: [{
      id: "regular-vocabulary-1",
      title: "Fill in the gaps",
      instruction: "Complete each sentence with a word from the list.",
      kind: "fill",
      wordBank: ["tiny", "huge"],
      items: [
        { id: "regular-vocabulary-1-1", prompt: "The room was ___.", answer: "tiny" },
      ],
    }],
  });
  assert.deepEqual(normalized?.exercises[0].wordBank, ["tiny", "huge"]);
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

test("фокус домашки принимает существующее упражнение и конкретное предложение", () => {
  assert.deepEqual(homeworkFocusTarget(plan, homeworkExerciseFocusId("fill-main")), {
    exerciseId: "fill-main",
    itemId: null,
  });
  assert.deepEqual(homeworkFocusTarget(plan, homeworkItemFocusId("free-one")), {
    exerciseId: "free-main",
    itemId: "free-one",
  });
});

test("фокус домашки отбрасывает чужие и повреждённые цели", () => {
  assert.equal(homeworkFocusTarget(plan, homeworkExerciseFocusId("missing")), null);
  assert.equal(homeworkFocusTarget(plan, homeworkItemFocusId("missing")), null);
  assert.equal(homeworkFocusTarget(plan, "word:fill-one"), null);
});

test("цветные выделения домашки сохраняются независимо от фокуса", () => {
  const exercise = homeworkExerciseFocusId("fill-main");
  const item = homeworkItemFocusId("free-one");
  let state = toggleHomeworkHighlight({}, exercise, "yellow");
  state = toggleHomeworkHighlight(state, item, "green");
  assert.equal(homeworkHighlight(state, exercise), "yellow");
  assert.equal(homeworkHighlight(state, item), "green");
  state = toggleHomeworkHighlight(state, exercise, "yellow");
  assert.equal(homeworkHighlight(state, exercise), null);
  assert.equal(homeworkHighlight(state, item), "green");
});

test("в домашке выделяется конкретное слово, включая красный цвет", () => {
  const item = plan.exercises[1].items[0];
  const stateWithAnswer = {
    [homeworkValueKey(item.id)]: "It is food which is cooked using smoke.",
  };
  const tokens = homeworkTextTokens(stateWithAnswer[homeworkValueKey(item.id)]);
  const foodAt = tokens.findIndex((token) => token.text === "food");
  const next = toggleHomeworkTextHighlight(stateWithAnswer, item, "answer", foodAt, "red");
  assert.equal(homeworkTextHighlight(next, item.id, "answer", foodAt), "red");
  assert.equal(homeworkTextHighlight(next, item.id, "answer", foodAt + 1), null);
  assert.equal(
    homeworkTextHighlight(
      toggleHomeworkTextHighlight(next, item, "answer", foodAt, "red"),
      item.id,
      "answer",
      foodAt,
    ),
    null,
  );
});

test("reviewed хранится отдельно от отправки домашки", () => {
  const reviewedAt = "2026-10-03T12:00:00.000Z";
  assert.equal(homeworkReviewedAt({ [homeworkReviewedAtKey()]: reviewedAt }), reviewedAt);
  assert.equal(homeworkReviewedAt({}), null);
});

test("реакции учителя сохраняются отдельно для упражнения и предложения", () => {
  let state = setHomeworkReaction({}, "exercise", "fill-main", "thumbs-up");
  state = setHomeworkReaction(state, "item", "fill-one", "warning");
  assert.equal(homeworkReaction(state, "exercise", "fill-main"), "thumbs-up");
  assert.equal(homeworkReaction(state, "item", "fill-one"), "warning");
  state = setHomeworkReaction(state, "item", "fill-one", null);
  assert.equal(homeworkReaction(state, "item", "fill-one"), null);
  assert.equal(homeworkReaction(state, "exercise", "fill-main"), "thumbs-up");
});

test("домашка не появляется у ученика до явного назначения", () => {
  assert.equal(assignedInteractiveHomework(plan, {}), null);
});

test("назначение оставляет только выбранные упражнения в исходном порядке", () => {
  const state = {
    [homeworkAssignedAtKey()]: "2026-10-02T10:00:00.000Z",
    [homeworkAssignedExercisesKey()]: JSON.stringify(["bonus", "missing", "fill-main"]),
  };
  assert.deepEqual(
    assignedInteractiveHomework(plan, state)?.exercises.map((exercise) => exercise.id),
    ["fill-main", "bonus"],
  );
});

test("отметка назначения не считается начатой домашкой и не затрагивает ответы", () => {
  const assignedOnly = {
    [homeworkAssignedAtKey()]: "2026-10-02T10:00:00.000Z",
    [homeworkAssignedExercisesKey()]: JSON.stringify(["free-main"]),
  };
  assert.equal(homeworkStarted(assignedOnly), false);
  assert.equal(homeworkStarted({ ...assignedOnly, [homeworkValueKey("free-one")]: "My answer" }), true);
});

test("редактор вставки показывает ответ в двойных звёздочках и собирает пропуск обратно", () => {
  const item = plan.exercises[0].items[0];
  assert.equal(homeworkFillEditorLine(item), "I have **got to** go.");
  assert.deepEqual(homeworkFillItemFromEditorLine("custom", "Please **squeeze** the lemon."), {
    id: "custom",
    prompt: "Please ___ the lemon.",
    answer: "squeeze",
  });
  assert.equal(homeworkFillItemFromEditorLine("bad", "Please squeeze the lemon."), null);
  assert.equal(homeworkFillItemFromEditorLine("bad", "**One** and **two**"), null);
});

test("индивидуальная копия домашки сильнее шаблона урока", () => {
  const individual: InteractiveHomeworkPlan = {
    ...plan,
    title: "Homework for one student",
    exercises: [plan.exercises[1]],
  };
  const state = { [homeworkPlanOverrideKey()]: JSON.stringify(individual) };
  assert.equal(homeworkPlanForAssignment(plan, state)?.title, "Homework for one student");
  assert.deepEqual(
    homeworkPlanForAssignment(plan, state)?.exercises.map((exercise) => exercise.id),
    ["free-main"],
  );
  assert.equal(homeworkPlanForAssignment(plan, {})?.title, "Homework");
});

test("индивидуальную домашку можно создать для урока без домашки в шаблоне", () => {
  const individual: InteractiveHomeworkPlan = {
    ...plan,
    title: "Grammar Check · Homework",
    exercises: [plan.exercises[0]],
  };
  const state = { [homeworkPlanOverrideKey()]: JSON.stringify(individual) };
  assert.equal(homeworkPlanForAssignment(null, state)?.title, "Grammar Check · Homework");
  assert.deepEqual(
    homeworkPlanForAssignment(null, state)?.exercises.map((exercise) => exercise.id),
    ["fill-main"],
  );
});

test("последнее упражнение можно удалить только из индивидуальной домашки", () => {
  const empty = normalizeInteractiveHomework(
    { ...plan, exercises: [] },
    { allowEmpty: true },
  );
  assert.ok(empty);
  assert.deepEqual(empty.exercises, []);
  assert.equal(normalizeInteractiveHomework({ ...plan, exercises: [] }), null);

  const state = { [homeworkPlanOverrideKey()]: JSON.stringify(empty) };
  assert.deepEqual(homeworkPlanForAssignment(plan, state)?.exercises, []);
});

test("удаление упражнения очищает только его ответы, заметки и оформление", () => {
  const exercise = plan.exercises[0];
  const state = {
    [homeworkValueKey("fill-one")]: "got to",
    [homeworkAttemptsKey("fill-one")]: JSON.stringify(["go"]),
    [homeworkExerciseHiddenKey(exercise.id)]: "1",
    untouched: "keep",
  };
  const next = withoutHomeworkExerciseState(state, exercise);
  assert.equal(next[homeworkValueKey("fill-one")], undefined);
  assert.equal(next[homeworkAttemptsKey("fill-one")], undefined);
  assert.equal(next[homeworkExerciseHiddenKey(exercise.id)], undefined);
  assert.equal(next.untouched, "keep");
});

test("удаление выданной домашки очищает hw-данные, но сохраняет ответы урока", () => {
  const removedAt = "2026-10-04T12:00:00.000Z";
  const next = withoutAssignedHomeworkState({
    [homeworkAssignedAtKey()]: "2026-10-03T12:00:00.000Z",
    [homeworkPlanOverrideKey()]: JSON.stringify(plan),
    [homeworkValueKey("fill-one")]: "got to",
    "regular-answer:practice:item-1": "kept lesson answer",
  });
  next[homeworkRemovedAtKey()] = removedAt;

  assert.equal(next[homeworkAssignedAtKey()], undefined);
  assert.equal(next[homeworkPlanOverrideKey()], undefined);
  assert.equal(next[homeworkValueKey("fill-one")], undefined);
  assert.equal(next["regular-answer:practice:item-1"], "kept lesson answer");
  assert.equal(homeworkRemovedAt(next), removedAt);
});

test("сброс домашки очищает прогресс, но сохраняет назначение и заметки учителя", () => {
  const assignedAt = "2026-10-03T12:00:00.000Z";
  const state = {
    [homeworkAssignedAtKey()]: assignedAt,
    [homeworkAssignedExercisesKey()]: JSON.stringify(["fill-main"]),
    [homeworkPlanOverrideKey()]: JSON.stringify(plan),
    [homeworkValueKey("fill-one")]: "got to",
    [homeworkStatusKey("fill-one")]: "correct",
    [homeworkAttemptsKey("fill-one")]: JSON.stringify(["go"]),
    [homeworkReviewedAtKey()]: "2026-10-04T12:00:00.000Z",
    [homeworkRevisionRequestedAtKey()]: "2026-10-04T12:30:00.000Z",
    [homeworkTeacherVoiceMessagesKey()]: JSON.stringify([{
      id: "feedback-one",
      url: "/uploads/lesson-audio/feedback-one.webm",
      durationSeconds: 12,
      mimeType: "audio/webm",
      publishedAt: "2026-10-04T12:20:00.000Z",
    }]),
    "hw:submitted-at": "2026-10-04T11:00:00.000Z",
    "hw:note:fill-one": "Teacher note",
    "hw:text-highlight:fill-one:answer:0": "yellow",
    "hw:text-highlight:fill-one:prompt:0": "green",
  };
  const next = withoutHomeworkProgressState(state, plan);

  assert.equal(next[homeworkValueKey("fill-one")], undefined);
  assert.equal(next[homeworkStatusKey("fill-one")], undefined);
  assert.equal(next[homeworkAttemptsKey("fill-one")], undefined);
  assert.equal(next[homeworkReviewedAtKey()], undefined);
  assert.equal(next[homeworkRevisionRequestedAtKey()], undefined);
  assert.equal(next["hw:submitted-at"], undefined);
  assert.equal(next["hw:text-highlight:fill-one:answer:0"], undefined);
  assert.equal(next[homeworkAssignedAtKey()], assignedAt);
  assert.equal(next["hw:note:fill-one"], "Teacher note");
  assert.equal(next["hw:text-highlight:fill-one:prompt:0"], "green");
  assert.equal(homeworkTeacherVoiceMessages(next).length, 1);
});

test("возврат на ревизию и голосовые сообщения учителя безопасно читаются из состояния", () => {
  const requestedAt = "2026-10-05T09:15:00.000Z";
  const state = {
    [homeworkRevisionRequestedAtKey()]: requestedAt,
    [homeworkTeacherVoiceMessagesKey()]: JSON.stringify([
      {
        id: "feedback-valid",
        url: "/uploads/lesson-audio/feedback-valid.webm",
        durationSeconds: 18.4,
        mimeType: "audio/webm",
        publishedAt: "2026-10-05T09:10:00.000Z",
      },
      {
        id: "bad id",
        url: "javascript:alert(1)",
        durationSeconds: -1,
        mimeType: "text/html",
        publishedAt: "yesterday",
      },
    ]),
  };

  assert.equal(homeworkRevisionRequestedAt(state), requestedAt);
  assert.deepEqual(homeworkTeacherVoiceMessages(state), [{
    id: "feedback-valid",
    url: "/uploads/lesson-audio/feedback-valid.webm",
    durationSeconds: 18,
    mimeType: "audio/webm",
    publishedAt: "2026-10-05T09:10:00.000Z",
  }]);
});

test("правка вопросов не блокируется неполными переводами из старой домашки", () => {
  const legacy: InteractiveHomeworkPlan = {
    kind: "INTERACTIVE_HOMEWORK_V1",
    title: "Legacy homework",
    exercises: [
      {
        id: "legacy-translation",
        title: "Translation",
        instruction: "Translate",
        kind: "translate",
        items: [{ id: "legacy-row", prompt: "Переклади це." }],
      },
      {
        id: "questions",
        title: "Questions",
        instruction: "Answer",
        kind: "question-text",
        items: [],
      },
    ],
  };
  const withQuestion: InteractiveHomeworkPlan = {
    ...legacy,
    exercises: legacy.exercises.map((exercise) => exercise.id === "questions"
      ? { ...exercise, items: [{ id: "question-one", prompt: "What happened?" }] }
      : exercise),
  };

  assert.equal(homeworkPlanEditIssue(legacy, withQuestion), null);
  assert.equal(
    homeworkPlanEditIssue(legacy, {
      ...legacy,
      exercises: legacy.exercises.map((exercise) => exercise.id === "legacy-translation"
        ? { ...exercise, instruction: "Translate this sentence" }
        : exercise),
    }),
    "missing-translation",
  );
});
