import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  createClassVocabularyNoticeTracker,
  type ClassVocabularyNoticeWord,
} from "../src/lib/class-vocabulary-notices";

const start = Date.parse("2026-10-15T09:00:00.000Z");
const word = (id: string, seconds: number): ClassVocabularyNoticeWord => ({
  id,
  english: `English ${id}`,
  translation: `Translation ${id}`,
  createdAt: new Date(start + seconds * 1_000).toISOString(),
});

test("the first matching class snapshot silently establishes its history", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const recent = [word("last-week", 20), word("older", 10)];
  assert.equal(tracker.studentId, "student-a");
  assert.equal(tracker.receive("student-a", recent), null);
  assert.equal(tracker.receive("student-a", recent), null);
  assert.equal(tracker.added(recent[0]), false);
});

test("unknown and wrong students do not initialize or alter the current history", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const historic = word("historic-a", 10);
  const fromOtherStudent = word("other-student", 1_000);
  assert.equal(tracker.receive(null, []), null);
  assert.equal(tracker.receive("student-b", [fromOtherStudent]), null);
  assert.equal(tracker.receive("student-a", [historic]), null);
  assert.equal(tracker.receive("student-b", [word("actually-new", 20)]), null);
  const fresh = word("actually-new", 20);
  assert.deepEqual(tracker.receive("student-a", [fresh, historic]), fresh);
});

test("a pending response for an old class cannot notify or consume a new class event", () => {
  const previous = createClassVocabularyNoticeTracker("student-a");
  const current = createClassVocabularyNoticeTracker("student-b");
  previous.receive("student-a", [word("history-a", 100)]);
  assert.equal(current.receive("student-a", [word("old-response", 110)]), null);
  const historic = word("history-b", 10);
  assert.equal(current.receive("student-b", [historic]), null);
  const fresh = word("new-b", 20);
  assert.deepEqual(current.receive("student-b", [fresh, historic]), fresh);
});

test("a genuinely new remote word is shown once, including repeated reconnect snapshots", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const historic = word("history", 10);
  const fresh = word("new", 20);
  tracker.receive("student-a", [historic]);
  assert.deepEqual(tracker.receive("student-a", [fresh, historic]), fresh);
  assert.equal(tracker.receive("student-a", [fresh, historic]), null);
  assert.equal(tracker.receive("student-a", [fresh]), null);
  assert.equal(tracker.added(fresh), false);
});

test("deleting a recent entry cannot turn a backfilled ninth historical word into a notice", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const original = Array.from({ length: 8 }, (_, i) => word(`history-${8 - i}`, 8 - i));
  tracker.receive("student-a", original);
  const backfilled = word("previously-ninth", 0);
  assert.equal(tracker.receive("student-a", [...original.slice(1), backfilled]), null);
  assert.equal(tracker.added(backfilled), false);
  const fresh = word("genuinely-new", 9);
  assert.deepEqual(tracker.receive("student-a", [fresh, ...original.slice(1)]), fresh);
});

test("out-of-order historical snapshots and equal-boundary records remain silent", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const historic = word("history", 20);
  tracker.receive("student-a", [historic]);
  assert.equal(tracker.receive("student-a", [word("older-unseen", 15)]), null);
  assert.equal(tracker.receive("student-a", [word("same-time-unseen", 20)]), null);
  const fresh = word("new", 21);
  assert.deepEqual(tracker.receive("student-a", [fresh, historic]), fresh);
});

test("the initial boundary is the maximum history timestamp, not its array position", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [word("older-first", 1), word("latest-last", 30)]);
  assert.equal(tracker.receive("student-a", [word("old-unseen", 20)]), null);
  const fresh = word("new", 31);
  assert.deepEqual(tracker.receive("student-a", [fresh]), fresh);
});

test("a fixed visit boundary still permits a delayed genuinely new snapshot", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [word("history", 10)]);
  const latest = word("newest", 30);
  const delayed = word("delayed-but-new", 20);
  assert.deepEqual(tracker.receive("student-a", [latest]), latest);
  assert.deepEqual(tracker.receive("student-a", [delayed]), delayed);
  assert.equal(tracker.receive("student-a", [latest, delayed]), null);
});

test("editing, translating and deleting existing words produce no added-word notice", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const historic = word("existing", 10);
  const other = word("other", 5);
  tracker.receive("student-a", [historic, other]);
  assert.equal(tracker.receive("student-a", [{ ...historic, english: "Corrected spelling" }, other]), null);
  assert.equal(tracker.receive("student-a", [{ ...historic, translation: "Інший переклад" }, other]), null);
  assert.equal(tracker.receive("student-a", [other]), null);
  assert.equal(tracker.receive("student-a", []), null);
});

test("local addition before initial history shows immediately but never replays from history", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  const local = word("local", 20);
  assert.equal(tracker.added(local), true);
  assert.equal(tracker.added(local), false);
  assert.equal(tracker.receive("student-a", [local, word("history", 10)]), null);
  assert.equal(tracker.receive("student-a", [local]), null);
  const remote = word("remote-next", 21);
  assert.deepEqual(tracker.receive("student-a", [remote, local]), remote);
});

test("local-action completion before realtime gives exactly one notification", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [word("history", 10)]);
  const local = word("new-local", 20);
  assert.equal(tracker.added(local), true);
  assert.equal(tracker.receive("student-a", [local]), null);
  assert.equal(tracker.added(local), false);
});

test("realtime before local-action completion gives exactly one notification", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [word("history", 10)]);
  const local = word("new-local", 20);
  assert.deepEqual(tracker.receive("student-a", [local]), local);
  assert.equal(tracker.added(local), false);
  assert.equal(tracker.receive("student-a", [local]), null);
});

test("a burst shows its newest event once and does not replay other burst entries", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [word("history", 10)]);
  const newest = word("newest", 30);
  const next = word("next", 20);
  assert.deepEqual(tracker.receive("student-a", [newest, next]), newest);
  assert.equal(tracker.receive("student-a", [next]), null);
  assert.equal(tracker.added(next), false);
});

test("an initially empty vocabulary can notify its first actual addition", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  assert.equal(tracker.receive("student-a", []), null);
  const first = word("first", 1);
  assert.deepEqual(tracker.receive("student-a", [first]), first);
  assert.equal(tracker.receive("student-a", [first]), null);
});

test("invalid creation dates cannot surface as fresh additions", () => {
  const tracker = createClassVocabularyNoticeTracker("student-a");
  tracker.receive("student-a", [{ ...word("invalid-history", 0), createdAt: "invalid" }]);
  assert.equal(tracker.receive("student-a", [{ ...word("invalid-new", 1), createdAt: "" }]), null);
  const fresh = word("valid-new", 1);
  assert.deepEqual(tracker.receive("student-a", [fresh]), fresh);
});

test("separate visits, refreshes and students establish independent silent baselines", () => {
  const oldVisit = createClassVocabularyNoticeTracker("student-a");
  const historic = word("history", 10);
  const formerlyNew = word("formerly-new", 20);
  oldVisit.receive("student-a", [historic]);
  assert.deepEqual(oldVisit.receive("student-a", [formerlyNew]), formerlyNew);

  const nextVisit = createClassVocabularyNoticeTracker("student-a");
  assert.notEqual(nextVisit, oldVisit);
  assert.equal(nextVisit.receive("student-a", [formerlyNew, historic]), null);
  assert.equal(nextVisit.added(formerlyNew), false);
  const otherStudent = createClassVocabularyNoticeTracker("student-b");
  assert.equal(otherStudent.receive("student-b", [formerlyNew]), null);
  const fresh = word("next-visit-new", 30);
  assert.deepEqual(nextVisit.receive("student-a", [fresh]), fresh);
  assert.equal(oldVisit.added(fresh), true);
});

function roomCallback(name: string, marker?: string) {
  const source = readFileSync("src/components/class/class-room.tsx", "utf8");
  const file = ts.createSourceFile("class-room.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (name === "effect" && ts.isCallExpression(node) && node.expression.getText(file) === "useEffect") {
      if (node.arguments[0]?.getText(file).includes(marker!)) callback = node.arguments[0];
    } else if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      callback = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(callback, `The real ClassRoom ${name} callback must exist`);
  return ts.transpileModule(`exports.run = (${callback.getText(file)});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

test("the real local-add callback rejects stale visits, including re-entry to the same student", () => {
  const stale = createClassVocabularyNoticeTracker("student-a");
  const active = createClassVocabularyNoticeTracker("student-a");
  const shown: unknown[] = [];
  const context = {
    exports: {} as { run: (value: ClassVocabularyNoticeWord) => void },
    vocabularyTracker: stale,
    activeVocabularyTracker: { current: active },
    showVocabularyNotice: (value: unknown) => shown.push(value),
  };
  runInNewContext(roomCallback("vocabularyAdded"), context);
  const local = word("late-action", 10);
  context.exports.run(local);
  assert.deepEqual(shown, []);
  assert.equal(stale.added(local), true, "a stale callback must not even consume its event");
  assert.equal(active.added(local), true, "a stale callback must not consume an active visit's event");
});

test("the real local-add callback de-duplicates both realtime-first and action-first completion", () => {
  for (const realtimeFirst of [false, true]) {
    const tracker = createClassVocabularyNoticeTracker("student-a");
    tracker.receive("student-a", [word("history", 1)]);
    const shown: unknown[] = [];
    const context = {
      exports: {} as { run: (value: ClassVocabularyNoticeWord) => void },
      vocabularyTracker: tracker,
      activeVocabularyTracker: { current: tracker },
      showVocabularyNotice: (value: unknown) => shown.push(value),
    };
    runInNewContext(roomCallback("vocabularyAdded"), context);
    const local = word("local", 2);
    if (realtimeFirst) shown.push(tracker.receive("student-a", [local]));
    context.exports.run(local);
    context.exports.run(local);
    assert.deepEqual(shown, [local]);
    assert.equal(tracker.receive("student-a", [local]), null);
  }
});

test("the real class-sync effect skips the picker and scopes focus reads to the active student", async () => {
  const effect = roomCallback("effect", "readClassLive(\"focus\"");
  const reads: unknown[][] = [];
  const stateUpdates: unknown[] = [];
  const missingContext = {
    exports: {} as { run: () => (() => void) | undefined },
    conversation: null,
    vocabularyTracker: null,
    classSyncRef: { current: async () => { throw new Error("old class sync must be replaced"); } },
    readClassLive: (...args: unknown[]) => { reads.push(args); return Promise.resolve({ studentId: "student-b" }); },
  };
  runInNewContext(effect, missingContext);
  assert.equal(missingContext.exports.run(), undefined);
  await missingContext.classSyncRef.current();
  assert.deepEqual(reads, []);

  const context = {
    ...missingContext,
    exports: {} as { run: () => (() => void) | undefined },
    conversation: "student-a",
    vocabularyTracker: createClassVocabularyNoticeTracker("student-a"),
    boardOpen: { current: false },
    classSyncRef: { current: async () => {} },
    setActiveLessonId: (value: unknown) => stateUpdates.push(value),
  };
  runInNewContext(effect, context);
  const cleanup = context.exports.run();
  await context.classSyncRef.current();
  assert.deepEqual(reads, [["focus", "student-a", false], ["focus", "student-a", false]]);
  assert.deepEqual(stateUpdates, [], "the wrong owner's response must not reach any UI state setter");
  assert.equal(typeof cleanup, "function");
  cleanup?.();
});

test("both native add entry points use the guarded callback and visible notices are visit-scoped", () => {
  const source = readFileSync("src/components/class/class-room.tsx", "utf8");
  const file = ts.createSourceFile("class-room.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && ["ClassVocabulary", "SelectionTranslationPopover"].includes(node.tagName.getText(file))) {
      const added = node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(file) === "onAdded");
      if (added && ts.isJsxAttribute(added) && added.initializer && ts.isJsxExpression(added.initializer)) callbacks.set(node.tagName.getText(file), added.initializer.expression!.getText(file));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(callbacks.get("ClassVocabulary"), "vocabularyAdded");
  assert.equal(callbacks.get("SelectionTranslationPopover"), "vocabularyAdded");
  assert.match(source, /vocabularyNotice\s*&&\s*vocabularyNotice\.session\s*===\s*vocabularyTracker\s*&&/);
  assert.match(source, /request=\{textSelection\?\.session\s*===\s*vocabularyTracker\s*\?\s*textSelection\s*:\s*null\}/);
});
