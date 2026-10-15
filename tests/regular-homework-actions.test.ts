import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as homework from "../src/lib/lesson-homework";
import { HIDDEN_VOCAB_OPTION, isSection, lessonSectionsForKind } from "../src/lib/lesson-unit";
import { normalizeRegularLessonSections, regularLessonSection } from "../src/lib/regular-lesson";

const lessonSource = readFileSync(new URL("../src/lib/actions/lessons.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("lessons.ts", lessonSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functionNames = [
  "requireTeacher", "cleanNullable", "cleanLines", "normalizeAssignedWords", "normalizeAssignedLexis",
  "normalizeAssignedLessonDraft", "assignmentRegularSections", "assignmentHomeworkAvailable",
  "openSectionAction", "focusLessonSectionAction",
];
const functions = functionNames.map((name) => {
  const node = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  assert.ok(node, `${name} exists in the native action module`);
  return node.getText(ast).replace(/^export /, "");
}).join("\n");
const compiled = ts.transpileModule(functions + "\nglobalThis.actions = { openSectionAction, focusLessonSectionAction };", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const plan: homework.InteractiveHomeworkPlan = {
  kind: "INTERACTIVE_HOMEWORK_V1", title: "Homework", exercises: [
    { id: "practice", title: "Practice", instruction: "Answer.", kind: "question-text", items: [{ id: "one", prompt: "How are you?" }] },
  ],
};
const regularSections = normalizeRegularLessonSections([
  { id: "words", title: "Words", tone: "vocab", studentHtml: "<p>Words</p>" },
  { id: "private", title: "Private", tone: "exercise", teacherOnly: true, studentHtml: "<p>Private</p>" },
]);
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
type Filter = { column: string; value: unknown };
type Options = {
  role?: "TEACHER" | "STUDENT" | null;
  userId?: string;
  selectedStudent?: string | null;
  homework?: unknown[];
  contentOverride?: unknown;
  answers?: Record<string, string>;
};

function harness(options: Options = {}) {
  const tables = {
    lessonAssignments: { id: "assignment.id", studentId: "assignment.studentId", unitId: "assignment.unitId", openSections: "assignment.openSections", contentOverride: "assignment.contentOverride", answers: "assignment.answers" },
    lessonUnits: { id: "unit.id", authorId: "unit.authorId", kind: "unit.kind", sections: "unit.sections", homework: "unit.homework" },
    users: { id: "user.id", role: "user.role", classFocus: "user.classFocus", classWithId: "user.classWithId" },
  };
  const row = {
    studentId: "student", kind: "REGULAR", sections: regularSections,
    openSections: ["regular:words", "option:british"],
    homework: options.homework ?? [plan], contentOverride: options.contentOverride ?? null,
    answers: options.answers ?? { "hw:value:existing": "Keep my answer", "hw:note:existing": "Keep my feedback" },
    highlights: { word: "yellow" },
    classFocus: { view: "MATERIAL", materialNodeId: "material", timerState: { duration: 120 }, lessonAssignmentId: "old-assignment" },
  };
  const original = plain(row);
  const selections: Record<string, string>[] = [];
  const writes: { table: unknown; patch: Record<string, unknown>; filters: Filter[] }[] = [];
  const events: unknown[][] = [];
  const paths: string[] = [];
  const session = options.role === null ? null : { role: options.role ?? "TEACHER", userId: options.userId ?? "teacher" };
  const db = {
    select: (projection: Record<string, string>) => {
      selections.push(projection);
      let from: unknown;
      let filters: Filter[] = [];
      const query = {
        from: (table: unknown) => { from = table; return query; },
        innerJoin: () => query,
        where: (value: Filter | Filter[]) => { filters = Array.isArray(value) ? value : [value]; return query; },
        limit: async () => {
          if (from === tables.users) return [{ studentId: options.selectedStudent === undefined ? "student" : options.selectedStudent }];
          const owner = filters.find((value) => value.column === tables.lessonUnits.authorId);
          const id = filters.find((value) => value.column === tables.lessonAssignments.id);
          if (owner?.value !== "teacher" || id?.value !== "assignment") return [];
          const role = filters.find((value) => value.column === tables.users.role);
          if (role && role.value !== "STUDENT") return [];
          return [row];
        },
      };
      return query;
    },
    update: (table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async (value: Filter | Filter[]) => {
      writes.push({ table, patch: plain(patch), filters: Array.isArray(value) ? value : [value] });
      if (table === tables.lessonAssignments && Array.isArray(patch.openSections)) row.openSections = patch.openSections as string[];
    } }) }),
  };
  const context = {
    ...tables, ...homework, normalizeRegularLessonSections, regularLessonSection, isSection, lessonSectionsForKind, HIDDEN_VOCAB_OPTION,
    MAX_INLINE_WORDS: 600, MAX_INLINE_TRANSCRIPT_LINES: 2000, MAX_INLINE_QUESTIONS: 500,
    db, getSession: async () => session,
    preserveClassSummonsSql: (_column: string, next: Record<string, unknown>) => next,
    eq: (column: string, value: unknown): Filter => ({ column, value }), and: (...values: Filter[]) => values,
    revalidatePath: (value: string) => paths.push(value), publishClassRealtime: async (...args: unknown[]) => { events.push(args); },
    actions: undefined as unknown as {
      openSectionAction: (id: string, section: string, open: boolean) => Promise<{ error?: string }>;
      focusLessonSectionAction: (id: string, section: string) => Promise<{ error?: string }>;
    },
  };
  runInNewContext(compiled, context);
  return { ...context.actions, row, original, selections, writes, events, paths, tables };
}

test("teacher can open and close REGULAR homework while preserving all other assignment state", async () => {
  const h = harness();
  assert.deepEqual(plain(await h.openSectionAction("assignment", "homework", true)), {});
  assert.deepEqual(plain(h.row.openSections), ["regular:words", "option:british", "homework"]);
  assert.deepEqual(plain(await h.openSectionAction("assignment", "homework", false)), {});
  assert.deepEqual(plain(h.row), h.original);
  assert.equal(h.writes.length, 2);
  for (const write of h.writes) {
    assert.equal(write.table, h.tables.lessonAssignments);
    assert.deepEqual(Object.keys(write.patch).sort(), ["openSections", "updatedAt"]);
    assert.deepEqual(write.filters, [{ column: "assignment.id", value: "assignment" }]);
  }
  assert.deepEqual(h.events, [["student", "lesson"], ["student", "lesson"]]);
  assert.equal(h.selections[0].homework, "unit.homework");
  assert.equal(h.selections[0].answers, "assignment.answers");
});

test("REGULAR homework availability recognizes legacy and individual plans", async () => {
  for (const options of [
    { homework: [{ title: "Legacy", text: "Write." }] },
    { homework: [], contentOverride: { title: "Private lesson", homework: [], interactiveHomework: plan, regularSections } },
    { homework: [], answers: { [homework.homeworkPlanOverrideKey()]: JSON.stringify(plan) } },
  ]) {
    const h = harness(options);
    assert.deepEqual(plain(await h.openSectionAction("assignment", "homework", true)), {});
    assert.equal(h.writes.length, 1);
  }
});

test("unavailable homework and deliberately empty personal snapshots never fall back to the template", async () => {
  for (const options of [
    { homework: [] },
    { contentOverride: { title: "Private lesson", homework: [], interactiveHomework: null, regularSections } },
    { contentOverride: { title: "Private lesson", homework: [], interactiveHomework: null, regularSections }, answers: { [homework.homeworkPlanOverrideKey()]: "invalid JSON" } },
  ]) {
    const h = harness(options);
    assert.ok((await h.openSectionAction("assignment", "homework", true)).error);
    assert.ok((await h.focusLessonSectionAction("assignment", "homework")).error);
    assert.equal(h.writes.length, 0);
    assert.deepEqual(plain(h.row), h.original);
  }
});

test("an explicit homework plan override remains authoritative over an empty full snapshot", async () => {
  const h = harness({ contentOverride: { title: "Private lesson", homework: [], interactiveHomework: null, regularSections },
    answers: { [homework.homeworkPlanOverrideKey()]: JSON.stringify(plan) } });
  assert.deepEqual(plain(await h.openSectionAction("assignment", "homework", true)), {});
  assert.deepEqual(plain(await h.focusLessonSectionAction("assignment", "homework")), {});
});

test("REGULAR homework focus targets only the current student's navigation and preserves unrelated focus fields", async () => {
  const h = harness();
  assert.deepEqual(plain(await h.focusLessonSectionAction("assignment", "homework")), {});
  assert.equal(h.writes.length, 1);
  const write = h.writes[0];
  assert.equal(write.table, h.tables.users);
  assert.deepEqual(write.filters, [{ column: "user.id", value: "student" }, { column: "user.role", value: "STUDENT" }]);
  assert.deepEqual(Object.keys(write.patch), ["classFocus"]);
  const focus = write.patch.classFocus as Record<string, unknown>;
  assert.equal(focus.lessonAssignmentId, "assignment");
  assert.equal(focus.lessonSection, "homework");
  assert.equal(focus.lessonElementId, null);
  assert.equal(focus.view, "LESSON");
  assert.deepEqual(focus.timerState, h.original.classFocus.timerState);
  assert.equal(focus.materialNodeId, h.original.classFocus.materialNodeId);
  assert.deepEqual(plain(h.row), h.original);
  assert.deepEqual(h.events, [["student", "class-sync"]]);
  assert.equal(h.selections[1].homework, "unit.homework");
  assert.equal(h.selections[1].answers, "assignment.answers");
});

test("foreign teachers, non-selected students, student sessions and signed-out sessions cannot open or focus homework", async () => {
  const foreign = harness({ userId: "foreign-teacher" });
  assert.ok((await foreign.openSectionAction("assignment", "homework", true)).error);
  assert.ok((await foreign.focusLessonSectionAction("assignment", "homework")).error);
  assert.equal(foreign.writes.length, 0);
  const elsewhere = harness({ selectedStudent: "another-student" });
  assert.ok((await elsewhere.focusLessonSectionAction("assignment", "homework")).error);
  assert.equal(elsewhere.writes.length, 0);
  for (const role of ["STUDENT", null] as const) {
    const h = harness({ role });
    await assert.rejects(h.openSectionAction("assignment", "homework", true), /Только для учителя/);
    await assert.rejects(h.focusLessonSectionAction("assignment", "homework"), /Только для учителя/);
    assert.equal(h.selections.length, 0);
    assert.equal(h.writes.length, 0);
  }
});

test("regular section validation and teacher-only boundaries are unchanged", async () => {
  for (const section of ["regular:private", "regular:missing", "video"]) {
    const h = harness();
    assert.ok((await h.openSectionAction("assignment", section, true)).error);
    assert.ok((await h.focusLessonSectionAction("assignment", section)).error);
    assert.equal(h.writes.length, 0);
  }
  const h = harness();
  assert.deepEqual(plain(await h.openSectionAction("assignment", "regular:words", false)), {});
  assert.deepEqual(plain(await h.focusLessonSectionAction("assignment", "regular:words")), {});
});
