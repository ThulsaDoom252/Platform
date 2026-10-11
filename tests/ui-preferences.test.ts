import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readLocalJson, writeLocalJson } from "../src/lib/local-json-store";
import { isSortPreference, resolveSortPreference, sortStudentRows, STUDENT_SORT_KEYS, uiPreferenceKey } from "../src/lib/ui-preferences";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const storage = new Map<string, string>();
function mockStorage(blocked = false, blockedWrites = false) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) { if (blocked) throw new Error("Storage unavailable"); return storage.get(key) ?? null; },
    setItem(key: string, value: string) { if (blocked || blockedWrites) throw new Error("Storage unavailable"); storage.set(key, value); },
  } });
}
test.afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else Reflect.deleteProperty(globalThis, "localStorage");
  storage.clear();
});

test("preferences are isolated by account and section", () => {
  assert.notEqual(uiPreferenceKey("teacher", "students:sort"), uiPreferenceKey("student", "students:sort"));
  assert.notEqual(uiPreferenceKey("teacher", "homeworks:folders:sort"), uiPreferenceKey("teacher", "homeworks:assignments:sort"));
  assert.notEqual(uiPreferenceKey("a:b", "c"), uiPreferenceKey("a", "b:c"));
});
test("selection and direction survive a new read", () => {
  mockStorage();
  writeLocalJson("saved-sort", { key: "lessons", desc: true });
  assert.deepEqual(readLocalJson("saved-sort", { key: "name", desc: false }), { key: "lessons", desc: true });
});
test("object snapshots stay referentially stable", () => {
  mockStorage(); storage.set("stable", '{"key":"name","desc":false}');
  assert.equal(readLocalJson("stable", null), readLocalJson("stable", null));
});
test("another tab's update is read without a stale cache", () => {
  mockStorage(); storage.set("tab-update", '"grid"');
  assert.equal(readLocalJson("tab-update", "grid"), "grid");
  storage.set("tab-update", '"list"');
  assert.equal(readLocalJson("tab-update", "grid"), "list");
});
test("removing a stored preference restores the default", () => {
  mockStorage(); writeLocalJson("removed", "list"); storage.delete("removed");
  assert.equal(readLocalJson("removed", "grid"), "grid");
});
test("malformed JSON safely restores the default", () => {
  mockStorage(); storage.set("malformed", "{");
  assert.deepEqual(readLocalJson("malformed", { key: "name", desc: false }), { key: "name", desc: false });
});
test("denied storage access still lets the setting change in memory", () => {
  mockStorage(true); writeLocalJson("blocked", "list");
  assert.equal(readLocalJson("blocked", "grid"), "list");
});
test("denied writes do not revert to an older readable value", () => {
  mockStorage(false, true); storage.set("quota", '"grid"'); writeLocalJson("quota", "list");
  assert.equal(readLocalJson("quota", "grid"), "list");
});
test("invalid keys and non-boolean directions are rejected", () => {
  for (const value of [null, [], "name", { key: "bad", desc: false }, { key: "name", desc: "false" }])
    assert.equal(isSortPreference(value, STUDENT_SORT_KEYS), false);
  assert.equal(isSortPreference({ key: "name", desc: true }, STUDENT_SORT_KEYS), true);
});
test("queryless navigation keeps the saved sort and direction", () => {
  const saved = { key: "lessons" as const, desc: true };
  assert.equal(resolveSortPreference(saved, null, null, STUDENT_SORT_KEYS), saved);
});
test("explicit sorting URLs override the saved preference", () => {
  assert.deepEqual(resolveSortPreference({ key: "lessons", desc: true }, "name", "asc", STUDENT_SORT_KEYS), { key: "name", desc: false });
});
test("invalid URL settings do not wipe a valid saved preference", () => {
  const saved = { key: "lessons" as const, desc: true };
  assert.equal(resolveSortPreference(saved, "unknown", "broken", STUDENT_SORT_KEYS), saved);
});
test("date sorting keeps its descending default on explicit links", () => {
  assert.deepEqual(resolveSortPreference({ key: "name", desc: false }, "assigned", null, ["name", "assigned"], ["assigned"]), { key: "assigned", desc: true });
});
test("student sorting changes the actual cards without changing input data", () => {
  const rows = [{ id: "a", name: "Anna", lessons: 2 }, { id: "z", name: "Zoe", lessons: 9 }, { id: "b", name: "Ben", lessons: 2 }];
  assert.deepEqual(sortStudentRows(rows, { key: "lessons", desc: true }, "en").map((row) => row.id), ["z", "a", "b"]);
  assert.deepEqual(sortStudentRows(rows, { key: "name", desc: true }, "en").map((row) => row.id), ["z", "b", "a"]);
  assert.deepEqual(rows.map((row) => row.id), ["a", "z", "b"]);
});
test("every sort UI uses persistent state instead of useState", () => {
  for (const path of ["game/guess-picture-studio.tsx", "game/word-deck-studio.tsx", "revision/revision-activity-studio.tsx", "class/class-vocabulary.tsx", "class/class-room.tsx", "twisters/twister-pool.tsx"])
    assert.match(source(`components/${path}`), /\[sort, setSort\] = useUiChoice/);
  assert.match(source("components/teacher/homework-sort-controls.tsx"), /usePersistentSort/);
  assert.match(source("components/teacher/student-sorted-list.tsx"), /usePersistentSort/);
});
test("materials save view and panel independently of temporary interactive hiding", () => {
  const explorer = source("components/materials/materials-explorer.tsx");
  assert.match(explorer, /useUiChoice\("materials:view", \["grid", "list", "interactive"\]/);
  assert.match(explorer, /useUiPreference<boolean>\("materials:panel-open", true/);
  const change = explorer.slice(explorer.indexOf("function changeView("), explorer.indexOf("function openInteractiveRoot("));
  assert.ok(!change.includes("setPathOpen"));
  assert.match(explorer, /useUiPreference<\{/);
});
test("both signed-in layouts scope preferences to the current account", () => {
  for (const role of ["teacher", "student"])
    assert.match(source(`app/${role}/layout.tsx`), /<I18nProvider userId=\{session.userId\}/);
});
test("previous material presets stay accessible only to the first legacy account", () => {
  const provider = source("components/ui-preferences-provider.tsx");
  assert.match(provider, /legacyOwner === null && userId !== "anonymous"/);
  assert.match(provider, /legacyOwner === userId/);
  assert.match(source("components/materials/materials-explorer.tsx"), /undefined, sortKey\)/);
});
test("sorting does not change homework data and keeps URL filters and hashes", () => {
  const hook = source("lib/use-persistent-sort.ts");
  assert.match(hook, /setSaved\(next\)/);
  assert.match(hook, /new URL\(window.location.href\)/);
  assert.match(hook, /url.hash/);
  assert.ok(!hook.includes("/actions/"));
  assert.ok(!hook.includes("fetch("));
});
