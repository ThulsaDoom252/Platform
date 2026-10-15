import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { en } from "../src/lib/i18n/en";
import { fmt, getDictFor } from "../src/lib/i18n";

const studentId = "10000000-0000-0000-0000-000000000001";
const otherStudent = "10000000-0000-0000-0000-000000000002";
const parentId = "20000000-0000-0000-0000-000000000001";
const nodeId = "30000000-0000-0000-0000-000000000001";
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

function serverHarness(rows: unknown[][], role: string | null = "TEACHER", realtimeFails = false) {
  const queries: { table?: string; where?: unknown; lock?: string }[] = [];
  const writes: { table: string; row: Record<string, unknown> }[] = [];
  const revalidated: string[] = [], published: string[] = [];
  const tables = Object.fromEntries(["materialNodes", "notifications", "users"].map(name => [name,
    new Proxy({ table: name }, { get: (target, key) => key === "table" ? target.table : `${name}.${String(key)}` }),
  ]));
  const db = {
    select: () => {
      const record: typeof queries[number] = {}; queries.push(record);
      const result = rows.shift() ?? [];
      const query = { from: (table: { table: string }) => { record.table = table.table; return query; },
        where: (where: unknown) => { record.where = where; return query; }, limit: () => query, orderBy: () => query,
        for: (lock: string) => { record.lock = lock; return query; },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    },
    insert: (table: { table: string }) => ({ values: (row: Record<string, unknown>) => {
      writes.push({ table: table.table, row });
      return { returning: async () => [{ id: nodeId, parentId: row.parentId, name: row.name }],
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(undefined).then(resolve) };
    } }),
    transaction: async (run: (tx: unknown) => unknown) => run(db),
  };
  const exports: { createLessonVocabularyFolderAction?: (input: unknown) => Promise<{ error?: string; folder?: { id: string } }>;
    notifyLessonVocabularyMaterialAction?: (nodeId: string) => Promise<{ ok?: boolean; error?: string }> } = {};
  vm.runInNewContext(compile(readFileSync("src/lib/actions/lesson-vocabulary-materials.ts", "utf8")), { exports,
    require: (name: string) => {
      if (name === "drizzle-orm") return { eq: (key: string, value: unknown) => ({ eq: [key, value] }), and: (...items: unknown[]) => ({ and: items }),
        isNull: (key: string) => ({ isNull: key }), max: (key: string) => key, asc: (key: string) => key };
      if (name === "next/cache") return { revalidatePath: (path: string) => revalidated.push(path) };
      if (name === "@/lib/db") return { db };
      if (name === "@/lib/db/schema") return tables;
      if (name === "@/lib/session") return { getSession: async () => role ? ({ role, userId: "teacher" }) : null };
      if (name === "@/lib/i18n") return { fmt, getDictFor };
      if (name === "@/lib/realtime-server") return { publishUserRealtime: async (id: string) => { published.push(id); if (realtimeFails) throw Error("offline"); } };
      throw Error(`Unexpected import: ${name}`);
    },
  });
  return { folder: exports.createLessonVocabularyFolderAction!, notify: exports.notifyLessonVocabularyMaterialAction!, queries, writes, revalidated, published };
}

test("folder creation and notification reject anonymous/student callers before accessing data", async () => {
  for (const role of [null, "STUDENT"]) {
    const h = serverHarness([], role);
    await assert.rejects(h.folder({ studentId, name: "Folder" }), /Только для учителя/);
    await assert.rejects(h.notify(nodeId), /Только для учителя/);
    assert.equal(h.queries.length + h.writes.length, 0);
  }
});

test("folder creation validates IDs/name, checks the student's role and rejects missing or foreign parents", async () => {
  for (const input of [{ studentId: "bad", name: "Folder" }, { studentId, parentId: "bad", name: "Folder" },
    { studentId, name: " " }, { studentId, name: "x".repeat(201) }]) {
    const h = serverHarness([]); assert((await h.folder(input)).error); assert.equal(h.queries.length, 0);
  }
  const missing = serverHarness([]);
  assert((await missing.folder({ studentId, name: "Folder" })).error);
  assert(JSON.stringify(missing.queries[0].where).includes('"users.role","STUDENT"'));
  const foreign = serverHarness([[{ id: studentId }], []]);
  assert((await foreign.folder({ studentId, parentId, name: "Folder" })).error);
  const condition = JSON.stringify(foreign.queries[1].where);
  for (const pair of [["id", parentId], ["ownerId", studentId], ["scope", "STUDENT"], ["type", "FOLDER"]])
    assert(condition.includes(JSON.stringify([`materialNodes.${pair[0]}`, pair[1]])));
  assert.equal(foreign.queries[1].lock, "update"); assert.equal(foreign.writes.length, 0);
});

test("nested and root folder creation stay in the chosen student's tree and never notify automatically", async () => {
  for (const parent of [null, parentId]) {
    const h = serverHarness([[{ id: studentId }], ...(parent ? [[{ id: parent }]] : []), [{ value: 7 }]]);
    const result = await h.folder({ studentId, parentId: parent, name: "  My folder  " });
    assert.equal(result.folder?.id, nodeId);
    assert.equal(h.writes.length, 1); assert.equal(h.writes[0].table, "materialNodes");
    assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].row)), {
      parentId: parent, scope: "STUDENT", ownerId: studentId, type: "FOLDER", pageKind: null, name: "My folder", icon: "📁", sortOrder: 8,
    });
    const orderFilter = JSON.stringify(h.queries.at(-1)?.where);
    assert(orderFilter.includes(studentId));
    assert(orderFilter.includes(parent ?? "isNull"));
    assert.equal(h.published.length, 0); assert.equal(h.revalidated.length, 2);
  }
});

test("explicit notification derives recipient, localized text and material link on the server", async () => {
  for (const locale of ["en", "ru", "uk"]) {
    const h = serverHarness([[{ id: nodeId, ownerId: studentId, name: "Fruit & Berries" }], [{ id: studentId, locale }], []], "TEACHER", true);
    assert.equal((await h.notify(nodeId)).ok, true);
    assert.equal(h.queries[0].lock, "update");
    const condition = JSON.stringify(h.queries[0].where);
    for (const value of ["STUDENT", "FILE", "VOCAB"]) assert(condition.includes(value));
    const notification = h.writes[0].row;
    assert.equal(notification.recipientId, studentId);
    assert.equal(notification.senderId, "teacher");
    assert.equal(notification.message, fmt(getDictFor(locale).notifications.materialAdded, { title: "Fruit & Berries" }));
    assert.equal(notification.href, `/student/materials?node=${nodeId}`);
    assert.deepEqual(h.published, [studentId]);
  }
});

test("notification handles stale materials and deduplicates repeated explicit Send requests", async () => {
  const invalid = serverHarness([]); assert((await invalid.notify("bad")).error); assert.equal(invalid.queries.length, 0);
  const missing = serverHarness([[]]); assert((await missing.notify(nodeId)).error); assert.equal(missing.writes.length, 0);
  const deletedStudent = serverHarness([[{ id: nodeId, ownerId: studentId }], []]);
  assert((await deletedStudent.notify(nodeId)).error); assert.equal(deletedStudent.writes.length, 0);
  const repeat = serverHarness([[{ id: nodeId, ownerId: studentId, name: "Vocabulary" }], [{ id: studentId, locale: "en" }], [{ id: "existing" }]]);
  assert.equal((await repeat.notify(nodeId)).ok, true); assert.equal(repeat.writes.length, 0);
  const duplicateFilter = JSON.stringify(repeat.queries[2].where);
  for (const value of ["teacher", studentId, `/student/materials?node=${nodeId}`, "WISHLIST_NOTE"]) assert(duplicateFilter.includes(value));
});

type Element = React.ReactElement<Record<string, unknown>>;
const flatten = (tree: React.ReactNode): Element[] => !React.isValidElement(tree) ? []
  : [tree as Element, ...React.Children.toArray((tree.props as { children?: React.ReactNode }).children).flatMap(flatten)];
const markup = (tree: React.ReactNode) => renderToStaticMarkup(tree);
function uiHarness() {
  const state: unknown[] = [], tasks: Promise<unknown>[] = [];
  let cursor = 0;
  const calls = { copies: [] as unknown[], folders: [] as { studentId: string; parentId: string | null; name: string }[], notifications: [] as string[] };
  let copyError: string | null = null, notificationError: string | null = null, loadError = false;
  const exports: { LessonVocabToMaterials?: (props: unknown) => React.ReactNode } = {};
  vm.runInNewContext(compile(readFileSync("src/components/lessons/lesson-vocab-to-materials.tsx", "utf8")), { exports, document: { body: {} },
    require: (name: string) => {
      if (name === "react/jsx-runtime") return jsx;
      if (name === "react") return { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
        return [state[index], (value: unknown) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
        useId: () => "qa-dialog", useRef: () => ({ current: null }), useEffect() {}, useMemo: (fn: () => unknown) => fn(),
        useTransition: () => [false, (fn: () => Promise<unknown>) => tasks.push(fn())] };
      if (name === "react-dom") return { createPortal: (child: unknown) => child };
      if (name === "@/components/i18n-provider") return { useT: () => ({ t: en }) };
      if (name === "@/lib/i18n") return { fmt };
      if (name === "@/components/icons") return new Proxy({}, { get: () => () => React.createElement("svg") });
      if (name === "@/components/materials/icon-picker") return { IconPicker: () => null };
      if (name === "@/lib/material-icon") return { automaticMaterialIcon: () => "📚" };
      if (name === "@/lib/actions/lessons") return {
        lessonVocabularyMaterialTargetsAction: async () => {
          if (loadError) throw Error("offline");
          return [{ id: studentId, name: "Victoria", folders: [{ id: parentId, parentId: null, name: "Existing" }] },
            { id: otherStudent, name: "Other", folders: [] }];
        },
        addLessonVocabularyToMaterialsAction: async (...args: unknown[]) => { calls.copies.push(args); return copyError ? { error: copyError } : { nodeId }; },
      };
      if (name === "@/lib/actions/lesson-vocabulary-materials") return {
        createLessonVocabularyFolderAction: async (input: typeof calls.folders[number]) => { calls.folders.push(input); return { folder: { id: `folder-${calls.folders.length}`, parentId: input.parentId, name: input.name } }; },
        notifyLessonVocabularyMaterialAction: async (id: string) => { calls.notifications.push(id); return notificationError ? { error: notificationError } : { ok: true }; },
      };
      throw Error(`Unexpected import: ${name}`);
    },
  });
  const render = () => { cursor = 0; return exports.LessonVocabToMaterials!({ unitId: "lesson", lessonTitle: "Fruit & Berries", defaultStudentId: studentId, iconOnly: true }); };
  const button = (label: string) => flatten(render()).find(node => node.type === "button" && (node.props["aria-label"] === label || markup(node).replace(/<[^>]*>/g, "") === label))!;
  const click = async (label: string) => { const element = button(label); assert(element, `button ${label} not found`); assert(!element.props.disabled); (element.props.onClick as () => void)(); while (tasks.length) await tasks.shift(); };
  const change = (type: string, index: number, value: string) => (flatten(render()).filter(node => node.type === type)[index].props.onChange as (event: unknown) => void)({ target: { value } });
  return { render, click, change, calls, button, copyError: (value: string | null) => { copyError = value; }, notificationError: (value: string | null) => { notificationError = value; }, loadError: () => { loadError = true; } };
}

test("copy picker creates/selects nested folders; success closes modal and offers opt-in notification", async () => {
  const h = uiHarness(); assert(!markup(h.render()).includes('role="dialog"'));
  assert.equal(markup(h.button("Add to materials")).replace(/<[^>]*>/g, ""), "");
  await h.click("Add to materials"); h.change("select", 1, parentId);
  for (const name of ["New topic", "Fruit"]) {
    await h.click("New folder"); assert.equal(h.button("Add").props.disabled, true);
    h.change("input", 0, name); await h.click("Create folder");
  }
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.folders)), [
    { studentId, parentId, name: "New topic" }, { studentId, parentId: "folder-1", name: "Fruit" },
  ]);
  assert(markup(h.render()).includes("Existing / New topic / Fruit"));
  await h.click("Add");
  assert(!markup(h.render()).includes('role="dialog"')); assert(markup(h.render()).includes("Added successfully"));
  assert.equal((h.calls.copies[0] as [string, { parentId: string }])[1].parentId, "folder-2");
  assert.equal(h.calls.notifications.length, 0);
  await h.click(en.notifications.doNotSend); assert.equal(h.calls.notifications.length, 0);
  assert(!markup(h.render()).includes("Added successfully"));
});

test("failed copies stay open; notification failures can be retried without copying again", async () => {
  const h = uiHarness(); await h.click("Add to materials"); h.copyError("Copy failed"); await h.click("Add");
  assert(markup(h.render()).includes('role="dialog"') && markup(h.render()).includes("Copy failed"));
  assert.equal(h.calls.notifications.length, 0);
  h.copyError(null); await h.click("Add"); h.notificationError("Notify failed"); await h.click(en.notifications.send);
  assert(markup(h.render()).includes("Added successfully") && markup(h.render()).includes("Notify failed"));
  h.notificationError(null); await h.click(en.notifications.send);
  assert(markup(h.render()).includes("Notification sent")); assert.equal(h.calls.copies.length, 2);
  assert.deepEqual(h.calls.notifications, [nodeId, nodeId]);
});

test("changing student clears previous folder and draft; reopening reloads folders", async () => {
  const h = uiHarness(); await h.click("Add to materials"); h.change("select", 1, parentId);
  await h.click("New folder"); h.change("input", 0, "Unsaved"); h.change("select", 0, otherStudent);
  assert(!markup(h.render()).includes("Unsaved") && !markup(h.render()).includes("New folder name"));
  await h.click("Add");
  const input = (h.calls.copies[0] as [string, { studentId: string; parentId: string | null }])[1];
  assert.equal(input.studentId, otherStudent); assert.equal(input.parentId, null);
  await h.click(en.notifications.doNotSend); await h.click("Add to materials");
  const select = flatten(h.render()).find(node => node.type === "select")!;
  assert.equal(select.props.value, studentId);
});

test("both lesson renderers share the integrated vocabulary header and editor uses an icon-only title action", () => {
  const vocabulary = readFileSync("src/components/lessons/lesson-vocab.tsx", "utf8");
  const header = vocabulary.slice(vocabulary.indexOf("{/* Шапка:"), vocabulary.indexOf("{translationError &&"));
  assert(header.includes("flex-wrap") && header.includes("ml-auto"));
  assert(header.indexOf("sectionTitle ??") < header.indexOf("<LessonVocabToMaterials iconOnly"));
  assert(header.indexOf("<LessonVocabToMaterials iconOnly") < header.indexOf("lesson-vocab-controls"));
  const regular = readFileSync("src/components/lessons/regular-lesson-view.tsx", "utf8");
  assert(regular.includes("{!nativeVocabulary && <div") && regular.includes("sectionTitle={active.title}"));
  assert(regular.includes("integratedHeader") && regular.includes("onHeadingClick={onFocusElement"));
  const editor = readFileSync("src/components/lessons/lesson-editor.tsx", "utf8");
  assert(editor.includes("actions={lesson.words.length") && editor.includes("<LessonVocabToMaterials iconOnly"));
});

test("a failed reload cannot reuse stale student folders as a copy destination", async () => {
  const h = uiHarness(); await h.click("Add to materials"); await h.click("Add");
  await h.click(en.notifications.doNotSend); h.loadError(); await h.click("Add to materials");
  assert(markup(h.render()).includes("Could not load student folders"));
  assert.equal(h.button("Add").props.disabled, true);
  assert(!markup(h.render()).includes("Existing"));
});
