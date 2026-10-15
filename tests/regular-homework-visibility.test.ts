import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import {
  defaultRegularOpenSections,
  normalizeRegularLessonSections,
  regularLessonOpenSections,
} from "../src/lib/regular-lesson";

const sections = normalizeRegularLessonSections([
  { id: "words", title: "Words", tone: "vocab", studentHtml: "<p>Words</p>", defaultOpen: true },
  { id: "practice", title: "Practice", tone: "exercise", studentHtml: "<p>Practice</p>", defaultOpen: false },
]);
const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const transpile = (value: string) => ts.transpileModule(value, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test("explicit homework is a valid separate section and regular keys remain validated", () => {
  const stored = ["regular:practice", "homework", "regular:missing", "video", "regular:words"];
  assert.deepEqual(regularLessonOpenSections(stored, sections, true), ["regular:practice", "homework", "regular:words"]);
  assert.deepEqual(stored, ["regular:practice", "homework", "regular:missing", "video", "regular:words"]);
  assert.equal(sections.length, 2);
});

test("available homework never opens itself and the vocabulary-only defaults stay unchanged", () => {
  assert.deepEqual(regularLessonOpenSections([], sections, true), []);
  const defaults = defaultRegularOpenSections(sections);
  assert.deepEqual(defaults, ["regular:words"]);
  assert.deepEqual(regularLessonOpenSections(defaults, sections, true), defaults);
});

test("a stale homework open key is removed when the lesson has no homework", () => {
  assert.deepEqual(regularLessonOpenSections(["homework", "regular:practice"], sections, false), ["regular:practice"]);
  assert.deepEqual(regularLessonOpenSections(["homework", "regular:missing"], null, false), []);
});

function assignedAction(stored: string[], homework: "interactive" | "legacy" | "none") {
  const lesson = {
    id: "unit", title: "Regular lesson", kind: "REGULAR", regularSections: sections,
    interactiveHomework: homework === "interactive" ? { kind: "INTERACTIVE_HOMEWORK_V1", exercises: [] } : null,
    homework: homework === "legacy" ? [{ title: "Legacy homework", text: "Write an answer." }] : [],
  };
  const row = {
    a: { id: "assignment", studentId: "student", unitId: "unit", openSections: stored, answers: {}, highlights: {},
      createdAt: new Date("2026-10-15T10:00:00Z"), finishedAt: null, contentOverride: null },
    name: "Student", contentVersion: "version", classFocus: null,
  };
  const query = {
    from: () => query, innerJoin: () => query, where: () => query, limit: async () => [row],
  };
  const context = {
    requireUser: async () => ({ role: "TEACHER", userId: "teacher" }),
    db: { select: () => query },
    lessonAssignments: { id: "assignment.id", unitId: "assignment.unitId", studentId: "assignment.studentId" },
    lessonUnits: { id: "unit.id", title: "unit.title" }, users: { id: "user.id", name: "user.name", classFocus: "user.classFocus" },
    lessonContentVersion: "version", eq: () => true,
    loadUnit: async () => lesson,
    applyAssignedLessonContent: async () => lesson,
    homeworkPlanForAssignment: (plan: unknown) => plan,
    normalizeLessonHighlights: (value: unknown) => value,
    personalizeAssignedLearningContent: async (_studentId: string, value: unknown, answers: unknown) => ({ lesson: value, answers }),
    regularLessonOpenSections, BRITISH_OPTION: "british", lessonVocabularyReveal: () => ({}),
    action: undefined as unknown as (id: string, context?: "class") => Promise<{ open: string[] }>,
  };
  const actionSource = source("lib/actions/lessons.ts").slice(source("lib/actions/lessons.ts").indexOf("export async function assignedLessonAction("));
  runInNewContext(transpile(actionSource.replace("export async function", "async function") + "\nglobalThis.action = assignedLessonAction;"), context);
  return context.action;
}

test("initial class loading preserves explicitly opened interactive and legacy homework", async () => {
  for (const homework of ["interactive", "legacy"] as const) {
    const result = await assignedAction(["regular:words", "homework", "regular:missing"], homework)("assignment", "class");
    assert.deepEqual(plain(result.open), ["regular:words", "homework"]);
  }
});

test("initial class loading keeps hidden homework closed and drops unavailable homework", async () => {
  const hidden = await assignedAction(["regular:words"], "interactive")("assignment", "class");
  assert.deepEqual(plain(hidden.open), ["regular:words"]);
  const absent = await assignedAction(["regular:words", "homework"], "none")("assignment", "class");
  assert.deepEqual(plain(absent.open), ["regular:words"]);
});

test("outside-class loading retains its existing automatic homework visibility", async () => {
  const available = await assignedAction(["regular:words"], "interactive")("assignment");
  assert.deepEqual(plain(available.open), ["regular:words", "homework"]);
  const absent = await assignedAction(["regular:words", "homework"], "none")("assignment");
  assert.deepEqual(plain(absent.open), ["regular:words"]);
});

function polledOpen(stored: string[], homework: "interactive" | "legacy" | "none") {
  const component = source("components/class/class-lesson.tsx");
  const start = component.indexOf("    const updated: Assigned = {");
  const end = component.indexOf("    dataRef.current = updated;", start);
  assert.ok(start >= 0 && end > start, "the native poll state update is present");
  assert.match(component, /import \{ regularLessonOpenSections \} from "@\/lib\/regular-lesson"/);
  const context = {
    current: { assignment: {}, lesson: { kind: "REGULAR", regularSections: sections,
      interactiveHomework: homework === "interactive" ? {} : null, homework: homework === "legacy" ? [{}] : [] } },
    next: { answers: {}, highlights: {}, openSections: stored }, regularLessonOpenSections,
    result: undefined as unknown as { open: string[] },
  };
  runInNewContext(transpile(component.slice(start, end) + "\nglobalThis.result = updated;"), context);
  return plain(context.result.open);
}

test("native class state polling preserves opened homework without opening hidden or absent homework", () => {
  for (const homework of ["interactive", "legacy"] as const) {
    assert.deepEqual(polledOpen(["regular:words", "homework"], homework), ["regular:words", "homework"]);
    assert.deepEqual(polledOpen(["regular:words"], homework), ["regular:words"]);
  }
  assert.deepEqual(polledOpen(["regular:words", "homework", "regular:missing"], "none"), ["regular:words"]);
});
