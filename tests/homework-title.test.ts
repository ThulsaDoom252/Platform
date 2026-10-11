import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { HOMEWORK_TITLE_KEY, assignedHomeworkTitle, mergeHomeworkTitle, normalizeHomeworkTitle } from "../src/lib/homework-title";
import { homeworkTitlePatchSql } from "../src/lib/homework-title-persistence";
import { homeworkStateWithCurrentResultSql } from "../src/lib/homework-feedback-persistence";
import * as homework from "../src/lib/lesson-homework";
import { lessonHomeworkReminderDescription } from "../src/lib/homework-reminders";
import { dictionaries } from "../src/lib/i18n";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const id = "00000000-0000-4000-8000-000000000001";
const plan: homework.InteractiveHomeworkPlan = { kind: "INTERACTIVE_HOMEWORK_V1", title: "Original homework",
  exercises: [{ id: "questions", title: "Questions", instruction: "Answer", kind: "question-text", items: [{ id: "one", prompt: "What happened?" }] }] };
const initial = { [homework.homeworkAssignedAtKey()]: "2026-10-11T10:00:00Z", [homework.homeworkAssignedExercisesKey()]: '["questions"]', [homework.homeworkValueKey("one")]: "Student's answer",
  [homework.homeworkSubmittedAtKey()]: "2026-10-11T11:00:00Z", "hw:media": '{"video":true,"transcript":true}', "regular-answer:one": "Lesson answer" };

test("personal homework names normalize whitespace, preserve Unicode and reject empty/invalid/overlong values", () => {
  assert.equal(normalizeHomeworkTitle("  Домашка №2\n\t— First conditional 🎓 "), "Домашка №2 — First conditional 🎓");
  assert.equal(normalizeHomeworkTitle("a".repeat(240)), "a".repeat(240));
  for (const value of [null, undefined, {}, 123, "", " \n ", "x\u0000y", "x\u007fy", "a".repeat(241)]) assert.equal(normalizeHomeworkTitle(value), null);
});

test("display names are per assignment and leave lesson/plan definitions unchanged", () => {
  const renamed = { ...initial, [HOMEWORK_TITLE_KEY]: "Homework for Monday" };
  assert.equal(assignedHomeworkTitle(renamed, "Original lesson"), "Homework for Monday");
  assert.equal(assignedHomeworkTitle(initial, "Original lesson"), "Original lesson");
  assert.equal(plan.title, "Original homework");
  assert.equal(homework.homeworkPlanForAssignment(plan, renamed), plan);
});

test("rename/reset live updates merge only the name, preserving unsaved answers and feedback", () => {
  const local = { ...initial, [HOMEWORK_TITLE_KEY]: "Old name", [homework.homeworkValueKey("one")]: "Still typing…", "hw:overall-score": "93" };
  const merged = mergeHomeworkTitle(local, { ...initial, [HOMEWORK_TITLE_KEY]: "New name" });
  assert.equal(merged[HOMEWORK_TITLE_KEY], "New name");
  assert.equal(merged[homework.homeworkValueKey("one")], "Still typing…");
  assert.equal(merged["hw:overall-score"], "93");
  assert.equal(mergeHomeworkTitle(merged, merged), merged);
  const restored = mergeHomeworkTitle(merged, initial);
  assert.equal(restored[HOMEWORK_TITLE_KEY], undefined);
  assert.equal(restored[homework.homeworkValueKey("one")], "Still typing…");
});

test("progress reset preserves personal naming; removing the homework clears it", () => {
  const state = { ...initial, [HOMEWORK_TITLE_KEY]: "Personal name" };
  assert.equal(homework.withoutHomeworkProgressState(state, plan)[HOMEWORK_TITLE_KEY], "Personal name");
  assert.equal(homework.withoutAssignedHomeworkState(state)[HOMEWORK_TITLE_KEY], undefined);
});

test("atomic name updates bind one metadata key instead of any answer snapshot", () => {
  const dialect = new PgDialect();
  const renamed = dialect.sqlToQuery(homeworkTitlePatchSql(sql.identifier("answers"), "Student's <title>"));
  assert.match(renamed.sql, /coalesce\("answers", '\{\}'::jsonb\) \|\| jsonb_build_object/);
  assert.deepEqual(renamed.params, [HOMEWORK_TITLE_KEY, "Student's <title>"]);
  const reset = dialect.sqlToQuery(homeworkTitlePatchSql(sql.identifier("answers"), null));
  assert.match(reset.sql, /- \$1/);
  assert.deepEqual(reset.params, [HOMEWORK_TITLE_KEY]);
  assert.throws(() => homeworkTitlePatchSql(sql.identifier("answers"), "  Invalid  "));
});

test("stale or forged student snapshots retain the current teacher-owned name", () => {
  const query = new PgDialect().sqlToQuery(homeworkStateWithCurrentResultSql(sql.identifier("answers"), { ...initial, [HOMEWORK_TITLE_KEY]: "Forged/stale name" }));
  assert.equal(JSON.parse(String(query.params[0]))[HOMEWORK_TITLE_KEY], undefined);
  assert.ok(query.params.includes(HOMEWORK_TITLE_KEY));
  assert.match(query.sql, /jsonb_each\(coalesce\("answers", '\{\}'::jsonb\)\)/);
  const action = source("lib/actions/lessons.ts").split("export async function answerAction(")[1].split("async function regularAssignmentForUser")[0];
  assert.match(action, /isStudent && responseKey === HOMEWORK_TITLE_KEY/);
});

test("whole-homework and exercise reminders use the same student-facing name", () => {
  const lesson = { title: "Original lesson", homework: [plan], answers: { ...initial, [HOMEWORK_TITLE_KEY]: "Monday practice" } };
  for (const target of [{ kind: "LESSON" as const, id }, { kind: "LESSON" as const, id, exerciseId: "questions" }]) {
    assert.equal(lessonHomeworkReminderDescription(target, lesson, dictionaries.en)?.title, "Monday practice");
  }
});

function harness(options: { role?: string | null; foreign?: boolean; removed?: boolean; draft?: boolean; legacy?: boolean } = {}) {
  const session = options.role === null ? null : { userId: "teacher-local", role: options.role ?? "TEACHER" };
  const stored: Record<string, string> = { ...initial, [HOMEWORK_TITLE_KEY]: "Old name" };
  if (options.removed) stored[homework.homeworkRemovedAtKey()] = "removed";
  if (options.draft) delete stored[homework.homeworkAssignedAtKey()];
  const queries: unknown[] = [], writes: unknown[] = [], paths: string[] = [], events: unknown[][] = [];
  const tables = { lessonAssignments: { id: "assignment.id", studentId: "assignment.studentId", answers: sql.identifier("answers"), contentOverride: "assignment.override", unitId: "assignment.unitId" }, lessonUnits: { id: "unit.id", authorId: "unit.authorId", homework: "unit.homework" } };
  const db = {
    select: () => {
      let filters: { column: unknown; value: unknown }[] = [];
      const query = { from: () => query, innerJoin: () => query, where: (value: typeof filters) => { filters = value; return query; }, limit: async () => {
        queries.push(filters);
        if (!filters.some(value => value.column === "unit.authorId" && value.value === session?.userId) || options.foreign) return [];
        const snapshot = { ...stored };
        // Simulate an answer saved after the rename's initial SELECT.
        stored[homework.homeworkValueKey("one")] = "New concurrent answer";
        return [{ id, studentId: "student-local", answers: snapshot, override: null, homework: options.legacy ? [{ title: "Legacy", text: "Write a paragraph" }] : [plan] }];
      } };
      return query;
    },
    update: (table: unknown) => ({ set: (patch: { answers: Parameters<PgDialect["sqlToQuery"]>[0]; updatedAt: Date }) => ({ where: async (where: unknown) => {
      const compiled = new PgDialect().sqlToQuery(patch.answers);
      writes.push({ table, where, compiled });
      if (compiled.params.length === 1) delete stored[HOMEWORK_TITLE_KEY]; else stored[HOMEWORK_TITLE_KEY] = String(compiled.params[1]);
    } }) }),
  };
  const modules: Record<string, unknown> = {
    "drizzle-orm": { eq: (column: unknown, value: unknown) => ({ column, value }), and: (...values: unknown[]) => values },
    "next/cache": { revalidatePath: (path: string) => paths.push(path) }, "@/lib/db": { db }, "@/lib/db/schema": tables,
    "@/lib/session": { getSession: async () => session }, "@/lib/lesson-homework": homework,
    "@/lib/homework-title": { normalizeHomeworkTitle }, "@/lib/homework-title-persistence": { homeworkTitlePatchSql },
    "@/lib/realtime-server": { publishClassRealtime: async (...args: unknown[]) => events.push(args), publishUserRealtime: async (...args: unknown[]) => events.push(args) },
  };
  const context = { exports: {} as { renameHomeworkTitleAction: (id: string, title: unknown) => Promise<{ error?: string; title?: string | null }> },
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; } };
  const code = ts.transpileModule(source("lib/actions/homework-title.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, context);
  return { action: context.exports.renameHomeworkTitleAction, stored, queries, writes, paths, events };
}

test("the real rename action updates only its assignment and preserves concurrent progress/media/answers", async () => {
  const h = harness();
  const result = await h.action(id, "  Monday\npractice  ");
  assert.equal(result.title, "Monday practice"); assert.equal(result.error, undefined);
  assert.equal(h.writes.length, 1); assert.equal(h.stored[HOMEWORK_TITLE_KEY], "Monday practice");
  assert.equal(h.stored[homework.homeworkValueKey("one")], "New concurrent answer");
  for (const [key, value] of Object.entries(initial)) if (key !== homework.homeworkValueKey("one")) assert.equal(h.stored[key], value);
  assert.ok(h.paths.includes("/student/homework")); assert.ok(h.paths.includes(`/student/lessons/${id}`));
  assert.equal(h.events.length, 2);
  assert.equal((h.events[0][2] as { titleChanged: boolean; gradeFeedback: boolean }).titleChanged, true);
  assert.equal((h.events[0][2] as { gradeFeedback: boolean }).gradeFeedback, true);
  assert.equal(plan.title, "Original homework");
});

test("restoring the default and renaming legacy homework do not change content or answers", async () => {
  const h = harness();
  assert.equal((await h.action(id, null)).title, null);
  assert.equal(h.stored[HOMEWORK_TITLE_KEY], undefined);
  assert.equal(h.stored[homework.homeworkValueKey("one")], "New concurrent answer");
  const legacy = harness({ legacy: true });
  assert.equal((await legacy.action(id, "Legacy homework for Friday")).title, "Legacy homework for Friday");
});

test("the real action denies students, strangers, unassigned/removed work and invalid input without writing", async () => {
  for (const options of [{ role: null }, { role: "STUDENT" }, { foreign: true }, { removed: true }, { draft: true }]) {
    const h = harness(options); assert.ok((await h.action(id, "No change")).error); assert.equal(h.writes.length, 0);
  }
  for (const title of ["", "  ", "x".repeat(241), {}, undefined, "x\u0000y"]) {
    const h = harness(); assert.equal((await h.action(id, title)).error, "invalid"); assert.equal(h.queries.length, 0); assert.equal(h.writes.length, 0);
  }
  const h = harness(); assert.equal((await h.action("invalid-id", "No change")).error, "unavailable"); assert.equal(h.queries.length, 0);
});

test("teacher entry points and student lists/headings share the saved display name", () => {
  const cards = source("lib/actions/lesson-homework.ts");
  assert.equal(cards.match(/title: assignedHomeworkTitle\(state, row.title\),\s*homeworkTitle:/g)?.length, 2);
  assert.match(source("app/student/homework/page.tsx"), /\{item.title\}/);
  const list = source("app/teacher/homeworks/page.tsx");
  assert.match(list, /!activity && <RenameHomeworkButton/);
  assert.match(source("app/teacher/homeworks/[id]/page.tsx"), /<RenameHomeworkButton assignmentId=\{item.id\}/);
  assert.match(source("components/lessons/interactive-homework.tsx"), /assignedHomeworkTitle\(state, currentPlan.title\)/);
  assert.match(source("components/lessons/interactive-homework.tsx"), /mergeHomeworkTitle\(mergeHomeworkGradeFeedback/);
  assert.match(source("components/lessons/lesson-view.tsx"), /assignedHomeworkTitle\(session.state, lesson.title\)/);
  assert.match(source("components/tests/tests-live-list.tsx"), /titleChanged === true/);
});
