import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../src/lib/i18n/en";
import * as lessonUnit from "../src/lib/lesson-unit";
import * as homework from "../src/lib/lesson-homework";
import * as homeworkMedia from "../src/lib/homework-media";
import { buildWaltMeetsGusHomework } from "../src/lib/bundled-lessons/breaking-bad-walt-meets-gus-homework";
import { feelingsLessonFromHtml } from "../src/lib/bundled-lessons/c1-feelings-and-emotions";
import { buildC1VagueLanguageLesson } from "../src/lib/bundled-lessons/c1-vague-language";
import type { LessonView } from "../src/lib/actions/lessons";
import type { InteractiveHomeworkSession } from "../src/components/lessons/interactive-homework";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const fixture = (name: string) => readFileSync(new URL(`../scripts/fixtures/${name}`, import.meta.url), "utf8");
const feelingsSource = fixture("c1-feelings-student.html");
const feelings = feelingsLessonFromHtml(feelingsSource, fixture("c1-feelings-teacher.html"));
const vague = buildC1VagueLanguageLesson(feelingsSource);
const definitions = [
  { name: "Walt meets Gus", kind: "ACTIVITY" as const, plan: buildWaltMeetsGusHomework(), blocks: 8, items: 39 },
  { name: feelings.title, kind: "REGULAR" as const, plan: feelings.homework[0], blocks: 19, items: 189 },
  { name: vague.title, kind: "REGULAR" as const, plan: vague.homework[0], blocks: 5, items: 17 },
];

function compile(code: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(code, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (name in imports) return imports[name];
      throw Error(`Unexpected import: ${name}`);
    },
    ...globals,
  });
  return exports;
}

type HomeworkProbeProps = {
  lesson?: LessonView;
  homeworkPlan?: homework.InteractiveHomeworkPlan | null;
  homeworkSession: InteractiveHomeworkSession;
};

function assignedLessonHarness() {
  let received: HomeworkProbeProps | undefined;
  let mutations = 0;
  const Probe = (props: HomeworkProbeProps) => {
    received = props;
    return React.createElement("div", { "data-homework-probe": true });
  };
  const Wrapper = ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children);
  const Icon = () => React.createElement("svg");
  const actions = Object.fromEntries([
    "answerAction", "focusLessonWordAction", "focusRegularLessonElementAction", "lessonPresentationStateAction",
    "lessonVocabularyRevealAction", "selectLessonLexisGroupAction", "setLessonHighlightsAction",
    "setLessonVocabularyRevealAction", "showBritishAction", "submitRegularLessonAnswerAction",
  ].map(name => [name, async () => { mutations += 1; return {}; }]));
  const component = compile(source("components/lessons/assigned-lesson.tsx"), {
    react: React,
    "react/jsx-runtime": jsx,
    "next/dynamic": { default: () => () => null },
    "@/components/i18n-provider": { useT: () => ({ t: en }) },
    "@/lib/actions/lessons": actions,
    "@/lib/lesson-unit": lessonUnit,
    "@/components/lessons/lesson-view": { LessonView: Probe },
    "@/components/lessons/regular-lesson-view": { RegularLessonView: Probe },
    "@/components/lessons/lesson-text-highlighter": { LessonTextHighlighter: Wrapper },
    "./highlight-tools": {
      HighlightToolsContext: React.createContext(null),
      HighlightToolButtons: () => null,
      useHighlightTools: () => ({ enabled: false, color: "yellow" }),
    },
    "./floating-highlight-toolbar": { FloatingHighlightToolbar: () => null },
    "@/components/icons": { IconPencil: Icon, IconReset: Icon, IconTrash: Icon },
    "@/lib/use-realtime": { useRealtimeSubscription() {} },
  }).AssignedLesson as React.ComponentType<Record<string, unknown>>;
  return {
    render(definition: typeof definitions[number], teacher: boolean, state: Record<string, string>): {
      received: HomeworkProbeProps;
      mutations: number;
    } {
      received = undefined;
      const lesson: LessonView = {
        id: `template-${definition.kind.toLowerCase()}`, kind: definition.kind, title: definition.name,
        description: null, vocabNodeId: null, vocabName: null, words: [], lexis: [],
        videoUrl: null, videoTitle: null, transcript: [], questions: { afterVideo: [], afterReading: [] },
        homework: [], interactiveHomework: definition.plan, activities: [], regularSections: [],
      };
      renderToStaticMarkup(React.createElement(component, {
        teacher, liveClass: true, presentationManaged: true,
        data: {
          assignment: {
            id: "existing-student-assignment", unitId: lesson.id, studentId: "existing-student",
            title: lesson.title, studentName: "Student", openSections: [], highlights: {},
            finishedAt: null, createdAt: "2026-10-01T09:00:00.000Z",
          },
          lesson, answers: state, open: [], showBritish: false, vocabularyReveal: "word",
        },
      }));
      assert.ok(received, "The native assigned lesson must render its existing activity or regular reader");
      return { received, mutations };
    },
  };
}

test("all three reusable lessons expose complete homework before any new student assignment is created", () => {
  for (const definition of definitions) {
    const plan = homework.interactiveHomeworkFromEntries([definition.plan]);
    assert.ok(plan, definition.name);
    assert.equal(plan.exercises.length, definition.blocks, definition.name);
    assert.equal(plan.exercises.flatMap(exercise => exercise.items).length, definition.items, definition.name);
    assert.deepEqual(homework.homeworkPlanForAssignment(plan, {}), plan);
  }
});

test("existing ACTIVITY and REGULAR class copies pass their plan and teacher assignment controls to native readers", () => {
  const harness = assignedLessonHarness();
  for (const definition of definitions) {
    const state = { "lesson:existing-answer": "Keep this answer" };
    const { received, mutations } = harness.render(definition, true, state);
    const plan = received.lesson?.interactiveHomework ?? received.homeworkPlan;
    assert.equal(plan, definition.plan, definition.name);
    assert.equal(received.homeworkSession.assignmentId, "existing-student-assignment");
    assert.equal(received.homeworkSession.unitId, `template-${definition.kind.toLowerCase()}`);
    assert.equal(received.homeworkSession.studentId, "existing-student");
    assert.equal(received.homeworkSession.teacher, true);
    assert.equal(received.homeworkSession.canAssign, true);
    assert.equal(received.homeworkSession.canEdit, true);
    assert.equal(received.homeworkSession.liveClass, true);
    assert.equal(received.homeworkSession.state, state);
    assert.equal(mutations, 0, "Viewing available homework must not save, reassign, or notify anyone");
    assert.deepEqual(state, { "lesson:existing-answer": "Keep this answer" });
  }
});

function assignmentPanelHarness() {
  const text = source("components/lessons/interactive-homework.tsx");
  const parsed = ts.createSourceFile("interactive-homework.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = parsed.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "HomeworkAssignmentPanel");
  assert.ok(declaration, "Exercise the real assignment panel, not a duplicate test implementation");
  const panelSource = `export ${declaration.getText(parsed)}`;
  const Panel = compile(panelSource, { "react/jsx-runtime": jsx }, {
    useT: () => ({ t: en }),
    useState: React.useState,
    useMemo: React.useMemo,
    useTransition: React.useTransition,
    homeworkAssignedAt: homework.homeworkAssignedAt,
    homeworkAssignedExerciseIds: homework.homeworkAssignedExerciseIds,
    homeworkMediaAvailability: homeworkMedia.homeworkMediaAvailability,
    homeworkMediaSelection: homeworkMedia.homeworkMediaSelection,
    HomeworkMediaOptions: () => null,
    cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
    assignInteractiveHomeworkAction: () => { throw Error("Rendering must never assign homework"); },
  }).HomeworkAssignmentPanel as React.ComponentType<Record<string, unknown>>;
  return Panel;
}

test("the native teacher assignment panel renders enabled Add homework and all exercise choices for each existing lesson", () => {
  const Panel = assignmentPanelHarness();
  for (const definition of definitions) {
    const state = { "lesson:existing-answer": "Keep this answer" };
    const html = renderToStaticMarkup(React.createElement(Panel, {
      plan: definition.plan, assignmentId: "existing-student-assignment", state, onAssigned() {},
    }));
    assert.ok(html.includes(en.interactiveHomework.assignHomework), definition.name);
    assert.ok(!html.includes(en.interactiveHomework.updateAssignment), "A template is not already assigned homework");
    assert.doesNotMatch(html, /<button[^>]*disabled=/);
    const choices = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    assert.equal(choices.length, definition.blocks, definition.name);
    assert.ok(choices.every(choice => choice.includes('checked=""') && !choice.includes("disabled=")));
    assert.deepEqual(state, { "lesson:existing-answer": "Keep this answer" });
  }
});

test("showing templates in class does not assign homework or grant student assignment controls", () => {
  const harness = assignedLessonHarness();
  for (const definition of definitions) {
    const state: Record<string, string> = { "lesson:existing-answer": "Keep this answer" };
    const { received, mutations } = harness.render(definition, false, state);
    assert.equal(received.homeworkSession.teacher, false);
    assert.equal(received.homeworkSession.canAssign, false);
    assert.equal(received.homeworkSession.canEdit, false);
    assert.equal(homework.homeworkAssignedAt(state), null);
    assert.equal(homework.assignedInteractiveHomework(definition.plan, state), null);
    assert.equal(mutations, 0);
    assert.deepEqual(Object.keys(state), ["lesson:existing-answer"]);
  }
});

test("personal homework overrides and saved work remain authoritative when a reusable template is available", () => {
  const custom: homework.InteractiveHomeworkPlan = {
    kind: "INTERACTIVE_HOMEWORK_V1", title: "Teacher's personal plan", exercises: [{
      id: "personal-exercise", title: "Personal question", kind: "question-text", instruction: "Use your own example.",
      items: [{ id: "personal-answer", prompt: "What worked for you?" }],
    }],
  };
  const state = {
    [homework.homeworkPlanOverrideKey()]: JSON.stringify(custom),
    [homework.homeworkValueKey("personal-answer")]: "My saved response",
    [homework.homeworkAssignedAtKey()]: "2026-10-01T12:00:00.000Z",
    [homework.homeworkAssignedExercisesKey()]: '["personal-exercise"]',
    "lesson:existing-answer": "My lesson answer",
  };
  const snapshot = structuredClone(state);
  for (const definition of definitions) {
    const effective = homework.homeworkPlanForAssignment(definition.plan, state);
    assert.ok(effective);
    assert.equal(effective.title, custom.title);
    assert.deepEqual(effective.exercises.map(exercise => exercise.id), ["personal-exercise"]);
    assert.equal(homework.assignedInteractiveHomework(effective, state)?.exercises[0].id, "personal-exercise");
    assert.deepEqual(state, snapshot);
  }
  const deliberatelyEmpty = { ...custom, exercises: [] };
  assert.equal(homework.homeworkPlanForAssignment(definitions[0].plan, {
    [homework.homeworkPlanOverrideKey()]: JSON.stringify(deliberatelyEmpty),
  })?.exercises.length, 0, "An intentionally empty personal plan must not silently inherit new tasks");
});
