import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import { preserveClassSummonsSql } from "../src/lib/class-summons-persistence";

const dialect = new PgDialect();

test("focus replacements overlay the database-current summon, not an earlier read snapshot", () => {
  const next = { view: "LESSON", lessonAssignmentId: "lesson", enterClassCommand: { id: "stale" }, enterClassAt: "stale" };
  const query = dialect.sqlToQuery(preserveClassSummonsSql(sql.raw('"users"."class_focus"'), next));
  assert.deepEqual(query.params, [JSON.stringify(next)]);
  const normalized = query.sql.replace(/\s+/g, " ");
  assert.ok(normalized.includes("::jsonb - 'enterClassCommand' - 'enterClassAt'"), "stale snapshot commands are removed before overlays");
  assert.ok(normalized.includes('"users"."class_focus"->\'enterClassCommand\''), "newly sent commands are read from the current row");
  assert.ok(normalized.includes('"users"."class_focus"->\'enterClassAt\''), "legacy navigation survives concurrent view updates");
  assert.equal((normalized.match(/jsonb_build_object/g) ?? []).length, 2);
  assert.deepEqual(next, { view: "LESSON", lessonAssignmentId: "lesson", enterClassCommand: { id: "stale" }, enterClassAt: "stale" }, "callers' snapshots stay unchanged");
});

test("an acknowledged command cannot be resurrected by a delayed video, timer or drawing snapshot", () => {
  const query = dialect.sqlToQuery(preserveClassSummonsSql(sql.raw('"focus"'), {
    enterClassCommand: { id: "already-acknowledged" }, enterClassAt: "old", videoState: { currentTime: 35 },
  }));
  const normalized = query.sql.replace(/\s+/g, " ");
  assert.ok(normalized.indexOf("- 'enterClassCommand'") < normalized.indexOf("jsonb_build_object"));
  assert.ok(normalized.indexOf("- 'enterClassAt'") < normalized.indexOf("jsonb_build_object"));
  assert.ok(normalized.includes("case when \"focus\"->'enterClassCommand' is not null"));
  assert.ok(normalized.includes("else '{}'::jsonb end"), "no current row command means no command is written back");
  assert.deepEqual(dialect.sqlToQuery(preserveClassSummonsSql(sql.raw('"focus"'), null)).params, ["{}"]);
});

const writerCounts: Record<string, number> = {
  "board.ts": 1,
  "class-tools.ts": 2,
  "guess-picture.ts": 1,
  "lessons.ts": 7,
  "revision.ts": 1,
  "tongue-twisters.ts": 5,
};

test("every unrelated class-focus replacement preserves commands atomically, including lesson, board, games and drawings", () => {
  for (const [filename, expected] of Object.entries(writerCounts)) {
    const source = readFileSync(new URL(`../src/lib/actions/${filename}`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let count = 0;
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "classFocus" &&
        ts.isObjectLiteralExpression(node.parent) && ts.isCallExpression(node.parent.parent) &&
        ts.isPropertyAccessExpression(node.parent.parent.expression) && node.parent.parent.expression.name.text === "set") {
        const value = node.initializer;
        if (ts.isCallExpression(value) && value.expression.getText(ast) === "preserveClassSummonsSql") {
          assert.equal(value.arguments.length, 2, filename);
          assert.equal(value.arguments[0].getText(ast), "users.classFocus", filename);
          count++;
        } else if (filename === "tongue-twisters.ts" && ts.isObjectLiteralExpression(value)) {
          let owner: ts.Node = node;
          while (owner.parent && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
          assert.ok(ts.isFunctionDeclaration(owner) && owner.name?.text === "focusTwisterInClassAction", "only explicit navigation may issue a fresh command");
          assert.ok(value.properties.some((property) => property.name?.getText(ast) === "enterClassCommand"));
          assert.ok(value.properties.some((property) => property.name?.getText(ast) === "enterClassAt"));
        } else {
          assert.ok(ts.isTaggedTemplateExpression(value), `${filename}: replacements must be atomic SQL, never copied objects`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(count, expected, `${filename}: every expected replacement remains guarded`);
  }
});

test("preserving pending navigation never broadens a writer's target or changes homework and class selection", () => {
  const source = readFileSync(new URL("../src/lib/class-summons-persistence.ts", import.meta.url), "utf8");
  assert.ok(!source.includes("classWithId"));
  assert.ok(!source.includes("lessonAssignments"));
  assert.ok(!source.includes(".update("));
  assert.ok(!source.includes(".where("));
  const lessons = readFileSync(new URL("../src/lib/actions/lessons.ts", import.meta.url), "utf8");
  assert.ok(lessons.includes("classFocus: sql`coalesce(${users.classFocus}, '{}'::jsonb) ||"), "already-atomic homework focus remains untouched");
});
