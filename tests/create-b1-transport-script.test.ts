import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertTransportCanonical, assertTransportPreserved, transportImportOptions } from "../scripts/create-b1-transport";
import { buildB1TransportLesson } from "../src/lib/bundled-lessons/b1-transport";

const lesson = buildB1TransportLesson();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const before = () => ({
  folders: [{ id: uuid(1), digest: "folder" }], units: [{ id: uuid(2), digest: "existing lesson" }], words: [{ id: uuid(3), digest: "existing words" }],
  assignments: [{ id: uuid(4), digest: "answers highlights overrides and timestamps" }], classes: [{ id: uuid(5), digest: "class partner focus and location" }],
  homework: [{ id: uuid(6), digest: "homework" }], notifications: [{ id: uuid(7), digest: "notification" }],
});

test("Transport import is dry-run by default with explicit safe arguments only", () => {
  assert.deepEqual(transportImportOptions([]), { apply: false, envFile: ".env.production.local" });
  assert.deepEqual(transportImportOptions(["--apply", "--env=fixture.env"]), { apply: true, envFile: "fixture.env" });
  for (const args of [["--assign"], ["--apply=true"], ["--apply", "--apply"], ["--env="], ["--env=a", "--env=b"]]) assert.throws(() => transportImportOptions(args));
});

test("Transport idempotence protects teacher edits and exact lesson ownership", () => {
  const unit = { ...lesson, id: uuid(8), folder_id: uuid(9), author_id: "324718ca-f381-4478-9555-2eff9f857528", kind: "REGULAR" };
  assert.doesNotThrow(() => assertTransportCanonical(unit, lesson, uuid(8), uuid(9)));
  for (const field of ["title", "sections", "homework", "description", "folder_id", "author_id", "kind", "id"]) {
    assert.throws(() => assertTransportCanonical({ ...unit, [field]: "teacher edit" }, lesson, uuid(8), uuid(9)), /preserving teacher edits/);
  }
});

test("only one complete new lesson may be inserted; existing data and learner work are byte-identical", () => {
  const previous = before(); const after = structuredClone(previous);
  const plan = { folder: null, unit: uuid(8), words: Array.from({ length: 26 }, (_, i) => uuid(100 + i)) };
  after.units.push({ id: plan.unit, digest: "new transport lesson" });
  after.words.push(...plan.words.map(id => ({ id, digest: "new transport word" })));
  assert.doesNotThrow(() => assertTransportPreserved(previous, after, plan));
  assert.doesNotThrow(() => assertTransportPreserved(previous, structuredClone(previous), { folder: null, unit: null, words: [] }));
  for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
    const changed = structuredClone(after); changed[key][0].digest = "unexpected mutation";
    assert.throws(() => assertTransportPreserved(previous, changed, plan), /changed unexpectedly/);
  }
  assert.throws(() => assertTransportPreserved(previous, after, { ...plan, words: plan.words.slice(1) }), /26-word/);
});

test("Transport installer never mutates assignments, homework, notifications or existing templates", () => {
  const source = readFileSync(new URL("../scripts/create-b1-transport.ts", import.meta.url), "utf8");
  assert(!/\b(?:UPDATE|DELETE FROM)\s+(?:lesson_units|lesson_words|lesson_assignments|users|homework|notifications)\b/.test(source));
  assert(!/\bINSERT INTO\s+(?:lesson_assignments|users|homework|notifications)\b/.test(source));
  assert(source.includes("BEGIN ISOLATION LEVEL REPEATABLE READ") && source.includes("COMMIT") && source.includes("ROLLBACK"));
});
