import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dictionaries, getDictFor } from "../src/lib/i18n";
import {
  homeworkReminderHref, homeworkReminderMessage, homeworkReminderNavigation,
  legacyHomeworkFocusId, lessonHomeworkReminderDescription, readHomeworkReminderTarget,
  validHomeworkReminderTarget, type HomeworkReminderTarget,
} from "../src/lib/homework-reminders";
import {
  homeworkExerciseHiddenKey, homeworkPlanOverrideKey, homeworkRemovedAtKey,
  type HomeworkExerciseKind, type HomeworkStoredState, type InteractiveHomeworkPlan,
} from "../src/lib/lesson-homework";

const assignmentId = "31ebfd26-55f5-4b1f-a725-08002c52acdc";
const firstReminder = "dc9392da-b5e1-4155-bf60-08000fd3f272";
const nextReminder = "dc9392da-b5e1-4155-bf60-08000fd3f273";
const kinds: HomeworkExerciseKind[] = ["fill", "definition", "describe", "drag", "translate", "question-text", "question-audio"];
const plan: InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1", title: "Mendel — Part 9",
  exercises: kinds.map((kind) => ({
    id: `exercise-${kind}`, title: `Practice ${kind}`, kind, instruction: "",
    optional: kind === "question-audio",
    items: [{ id: `item-${kind}`, prompt: kind === "fill" ? "This is ___." : "Practice", answer: "weird" }],
  })),
};
const assigned: HomeworkStoredState = {
  "hw:assigned-at": "2026-10-08T10:00:00.000Z",
  "hw:assigned-exercises": JSON.stringify(plan.exercises.map((exercise) => exercise.id)),
  "hw:value:item-fill": "A saved student answer",
  "hw:exercise-score:exercise-translate": "80",
};
const lesson = { title: "Mendel interview — Part 9", homework: [plan], answers: assigned };
const target: HomeworkReminderTarget = { kind: "LESSON", id: assignmentId };
const t = getDictFor("en");

test("reminder targets accept all homework kinds and reject forged or malformed references", () => {
  for (const kind of ["LESSON", "ACTIVITY", "REVISION"] as const) {
    assert(validHomeworkReminderTarget({ kind, id: assignmentId }));
  }
  assert(validHomeworkReminderTarget({ ...target, exerciseId: "exercise-question-audio" }));
  assert(validHomeworkReminderTarget({ ...target, legacyIndex: 0 }));
  for (const input of [null, false, [], {}, { ...target, kind: "CLASS" }, { ...target, id: "not-a-uuid" },
    { ...target, exerciseId: "" }, { ...target, exerciseId: "../private" }, { ...target, exerciseId: "x".repeat(81) },
    { ...target, legacyIndex: -1 }, { ...target, legacyIndex: 0.5 }, { ...target, legacyIndex: "1" },
    { ...target, legacyIndex: 200 }, { ...target, exerciseId: "exercise-fill", legacyIndex: 0 },
    { ...target, kind: "ACTIVITY", exerciseId: "exercise-fill" }, { ...target, kind: "REVISION", legacyIndex: 0 }]) {
    assert.equal(readHomeworkReminderTarget(input), null, JSON.stringify(input));
  }
  assert.deepEqual(readHomeworkReminderTarget({ ...target, studentId: "another-student", title: "Forged title", href: "https://evil.test", exerciseTitle: "Secret" }), target);
});

test("every assigned exercise and bonus can be reminded about without leaking saved answers", () => {
  const before = structuredClone(lesson);
  for (const exercise of plan.exercises) {
    const reference = { ...target, exerciseId: exercise.id };
    assert.deepEqual(lessonHomeworkReminderDescription(reference, lesson, t), {
      ...reference, title: lesson.title, exerciseTitle: exercise.title,
    });
  }
  assert.deepEqual(lessonHomeworkReminderDescription(target, lesson, t), { ...target, title: lesson.title });
  assert.deepEqual(lesson, before);
  assert(!JSON.stringify(lessonHomeworkReminderDescription(target, lesson, t)).includes(assigned["hw:value:item-fill"]));
});

test("not started, in progress, submitted, reviewed and revision homework all allow reminders", () => {
  const statuses: HomeworkStoredState[] = [{}, { "hw:status:item-fill": "correct" },
    { "hw:submitted-at": "2026-10-08T11:00:00Z" }, { "hw:reviewed-at": "2026-10-08T12:00:00Z" },
    { "hw:revision-requested-at": "2026-10-08T13:00:00Z" }];
  for (const status of statuses) {
    const copy = { ...lesson, answers: { ...assigned, ...status } };
    const before = structuredClone(copy);
    assert(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, copy, t));
    assert.deepEqual(copy, before);
  }
});

test("unassigned, removed, hidden and nonexistent exercises cannot receive reminders", () => {
  assert.equal(lessonHomeworkReminderDescription(target, { ...lesson, answers: {} }, t), null);
  assert.equal(lessonHomeworkReminderDescription(target, { ...lesson, answers: { ...assigned, [homeworkRemovedAtKey()]: "2026-10-08" } }, t), null);
  assert.equal(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, {
    ...lesson, answers: { ...assigned, [homeworkExerciseHiddenKey("exercise-fill")]: "1" },
  }, t), null);
  assert.equal(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, {
    ...lesson, answers: { ...assigned, "hw:assigned-exercises": JSON.stringify(["exercise-translate"]) },
  }, t), null);
  assert.equal(lessonHomeworkReminderDescription({ ...target, exerciseId: "missing" }, lesson, t), null);
  assert.equal(lessonHomeworkReminderDescription(target, { ...lesson, homework: [] }, t), null);
});

test("reminders use effective personal homework and lesson titles, not a stale template", () => {
  const personal = structuredClone(plan);
  personal.exercises[0].title = "Edited personal exercise";
  const copy = { ...lesson, contentOverride: { title: "Personal lesson", interactiveHomework: personal } };
  assert.deepEqual(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, copy, t), {
    ...target, exerciseId: "exercise-fill", title: "Personal lesson", exerciseTitle: "Edited personal exercise",
  });
  personal.exercises[0].title = "Saved homework override";
  copy.answers = { ...assigned, [homeworkPlanOverrideKey()]: JSON.stringify(personal) };
  assert.equal(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, copy, t)?.exerciseTitle, "Saved homework override");
});

test("legacy text tasks support whole homework and localized unnamed exercise reminders", () => {
  const legacy = { title: "Vegetables", homework: [{ title: "Translation", text: "Translate" }, { text: "Read" }], answers: {} };
  assert.equal(lessonHomeworkReminderDescription(target, legacy, t)?.title, "Vegetables");
  assert.equal(lessonHomeworkReminderDescription({ ...target, legacyIndex: 0 }, legacy, t)?.exerciseTitle, "Translation");
  for (const dict of Object.values(dictionaries)) {
    assert.equal(lessonHomeworkReminderDescription({ ...target, legacyIndex: 1 }, legacy, dict)?.exerciseTitle,
      dict.notifications.reminderExerciseNumber.replace("{n}", "2"));
  }
  assert.equal(lessonHomeworkReminderDescription({ ...target, legacyIndex: 2 }, legacy, t), null);
  assert.equal(lessonHomeworkReminderDescription({ ...target, exerciseId: "exercise-fill" }, legacy, t), null);
  assert.equal(lessonHomeworkReminderDescription({ ...target, legacyIndex: 0 }, {
    ...legacy, contentOverride: { homework: [{ title: "Personal text", text: "Read" }] },
  }, t)?.exerciseTitle, "Personal text");
});

test("student messages and teacher controls are complete in English, Russian and Ukrainian", () => {
  for (const dict of Object.values(dictionaries)) {
    for (const exerciseTitle of [undefined, "Who or whom"]) {
      const message = homeworkReminderMessage(dict, { ...target, title: "Part 9", exerciseTitle });
      assert(message.includes("Part 9"));
      if (exerciseTitle) assert(message.includes(exerciseTitle));
      assert(!/\{(?:title|exercise)\}|undefined/.test(message));
    }
    for (const key of ["remindHomework", "remindExercise", "reminderConfirm", "reminderSent", "reminderFailed", "reminderUnavailable"] as const) {
      assert(dict.notifications[key].trim());
    }
  }
});

test("reminder URLs point to the correct student homework kind and repeated exercise navigation has a fresh token", () => {
  assert.equal(homeworkReminderHref({ kind: "ACTIVITY", id: assignmentId }, firstReminder), `/student/homework/games/${assignmentId}`);
  assert.equal(homeworkReminderHref({ kind: "REVISION", id: assignmentId }, firstReminder), `/student/homework/revision/${assignmentId}`);
  const href = homeworkReminderHref({ ...target, exerciseId: "exercise-fill" }, firstReminder)!;
  const query = Object.fromEntries(new URL(href, "https://school.test").searchParams);
  const visible = { exerciseIds: plan.exercises.map((exercise) => exercise.id), legacyCount: 2, homeworkOpen: true };
  assert.equal(new URL(href, "https://school.test").pathname, `/student/lessons/${assignmentId}`);
  assert.deepEqual(homeworkReminderNavigation(query, visible), { section: "homework", elementId: "homework:exercise:exercise-fill", at: firstReminder });
  assert.equal(homeworkReminderNavigation({ ...query, reminder: nextReminder }, visible)?.at, nextReminder);
  assert.notEqual(homeworkReminderHref({ ...target, exerciseId: "exercise-fill" }, nextReminder), href);
  const legacyQuery = Object.fromEntries(new URL(homeworkReminderHref({ ...target, legacyIndex: 1 }, firstReminder)!, "https://school.test").searchParams);
  assert.equal(homeworkReminderNavigation(legacyQuery, visible)?.elementId, legacyHomeworkFocusId(1));
  assert.equal(homeworkReminderNavigation({ section: "homework", reminder: firstReminder }, visible)?.elementId, null);
  assert.equal(homeworkReminderHref(target, "bad-token"), null);
});

test("deep links cannot reveal an unassigned or hidden exercise or an unavailable homework", () => {
  const visible = { exerciseIds: ["exercise-fill"], legacyCount: 1, homeworkOpen: true };
  const query = { section: "homework", reminder: firstReminder };
  for (const params of [{ ...query, section: "vocab" }, { ...query, reminder: "invalid" },
    { ...query, exercise: "exercise-translate" }, { ...query, exercise: "exercise-fill", task: "0" },
    { ...query, task: "-1" }, { ...query, task: "1" }, { ...query, task: "0.1" }, { ...query, task: "" }]) {
    assert.equal(homeworkReminderNavigation(params, visible), null);
  }
  assert.equal(homeworkReminderNavigation(query, { ...visible, homeworkOpen: false }), null);
});

test("server reminders enforce teacher ownership, bypass automatic policy and only write notifications", () => {
  const action = readFileSync("src/lib/actions/homework-reminders.ts", "utf8");
  assert.match(action, /session\?\.role !== "TEACHER"/);
  assert.match(action, /readHomeworkReminderTarget\(target\)/);
  assert.match(action, /eq\(lessonUnits\.authorId, session\.userId\)/);
  assert.match(action, /eq\(users\.role, "STUDENT"\)/);
  assert.match(action, /teacherWordDeckHomeworkAction\(target\.id\)/);
  assert.match(action, /row\.ownerId !== session\.userId/);
  assert.match(action, /teachers\.length !== 1/);
  assert.match(action, /getDictFor\(recipient\.locale\)/);
  assert.match(action, /recipientId: recipient\.id, senderId: session\.userId/);
  assert.match(action, /db\.insert\(notifications\)/);
  assert.match(action, /publishUserRealtime\(recipient\.id, "notification"\)/);
  assert.doesNotMatch(action, /db\.(?:update|delete)|queueStudentNotification|revalidatePath/);
});

test("teacher reminder buttons cover lists, review pages, ordinary exercises and bonuses", () => {
  const interactive = readFileSync("src/components/lessons/interactive-homework.tsx", "utf8");
  assert.equal((interactive.match(/<HomeworkReminderButton/g) ?? []).length, 3);
  assert.equal((interactive.match(/exerciseId: exercise\.id/g) ?? []).length >= 2, true);
  const button = readFileSync("src/components/teacher/homework-reminder-button.tsx", "utf8");
  assert.match(button, /window\.confirm/);
  assert.match(button, /disabled=\{disabled \|\| busy\}/);
  const list = readFileSync("src/app/teacher/homeworks/page.tsx", "utf8");
  assert.match(list, /kind: "REVISION"/);
  assert.match(list, /kind: item\.kind/);
  for (const path of ["src/app/teacher/homeworks/[id]/page.tsx", "src/app/teacher/homeworks/activities/[id]/page.tsx", "src/app/teacher/homeworks/revisions/[id]/page.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /HomeworkReminderButton/);
  }
  const student = readFileSync("src/app/student/lessons/[id]/page.tsx", "utf8");
  assert.match(student, /assignedLessonAction\(id\)/);
  assert.match(student, /homeworkReminderNavigation\(query/);
  assert.match(student, /data\.lesson\.interactiveHomework\?\.exercises/);
});
