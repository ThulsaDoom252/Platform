import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { APP_VIEWS, appViewPreference, classParticipantsPlacement, normalizeAppView, type AppView } from "../src/lib/app-view";
import { centeredSearchPosition } from "../src/lib/global-search-position";
import { notificationPanelPosition } from "../src/lib/notification-panel-position";
import { uiPreferenceKey } from "../src/lib/ui-preferences";
import { readLocalJson, writeLocalJson } from "../src/lib/local-json-store";
import { en } from "../src/lib/i18n/en";
import { ru } from "../src/lib/i18n/ru";
import { uk } from "../src/lib/i18n/uk";

const source = (path: string) => readFileSync(`src/${path}`, "utf8");
function compile(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(source(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => { if (name in imports) return imports[name]; throw Error(`Unexpected import: ${name}`); }, ...globals });
  return exports;
}

test("only the two explicit views are accepted; students roll out to Updated without changing teacher preferences", () => {
  assert.deepEqual(APP_VIEWS, ["CLASSIC", "UPDATED"]);
  for (const value of [null, undefined, {}, [], "updated", "bad", "CLASSIC"]) assert.equal(normalizeAppView(value), "CLASSIC");
  assert.equal(normalizeAppView("UPDATED"), "UPDATED");
  assert.deepEqual(appViewPreference(), { setting: "application:view", fallback: "CLASSIC" });
  assert.deepEqual(appViewPreference("TEACHER"), appViewPreference());
  assert.deepEqual(appViewPreference("STUDENT"), { setting: "application:view:student-updated-v1", fallback: "UPDATED" });
});

function viewHarness(server: boolean) {
  // Exercise the real providers and persistence hook, substituting only the
  // browser/server snapshot selection because this test renders without a DOM.
  const useLocalJson = compile("lib/use-local-json.ts", {
    react: { ...React, useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown, serverSnapshot: () => unknown) => server ? serverSnapshot() : snapshot() },
    "@/lib/local-json-store": { readLocalJson, writeLocalJson },
  }).useLocalJson;
  const preferences = compile("components/ui-preferences-provider.tsx", {
    react: React, "react/jsx-runtime": jsx,
    "@/lib/use-local-json": { useLocalJson }, "@/lib/ui-preferences": { uiPreferenceKey },
  });
  const provider = compile("components/app-view-provider.tsx", {
    react: React, "react/jsx-runtime": jsx,
    "./ui-preferences-provider": preferences,
    "@/lib/app-view": { APP_VIEWS, appViewPreference },
  });
  const UiPreferences = preferences.UiPreferencesProvider as React.ComponentType<React.PropsWithChildren<{ userId: string }>>;
  const AppView = provider.AppViewProvider as React.ComponentType<React.PropsWithChildren<{ role?: "TEACHER" | "STUDENT" }>>;
  const useView = provider.useAppView as () => { view: AppView; setView: (view: AppView) => void };
  return (userId: string, role?: "TEACHER" | "STUDENT") => {
    let choice!: ReturnType<typeof useView>;
    function Probe() { choice = useView(); return React.createElement("span", null, choice.view); }
    const html = renderToStaticMarkup(React.createElement(UiPreferences, { userId }, React.createElement(AppView, { role }, React.createElement(Probe))));
    return { ...choice, html };
  };
}

test("all existing students start Updated, but an explicit Classic choice survives a new provider and browser read", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    for (const [id, legacy] of [["rollout-classic-student", "CLASSIC"], ["rollout-updated-student", "UPDATED"]]) {
      storage.set(uiPreferenceKey(id, "application:view"), JSON.stringify(legacy));
      storage.set(uiPreferenceKey(id, "materials:view"), '"list"');
      storage.set(uiPreferenceKey(id, "homeworks:assignments:sort"), '{"key":"assigned","desc":true}');
      const initial = viewHarness(false)(id, "STUDENT");
      assert.equal(initial.view, "UPDATED");
      assert.match(initial.html, /data-app-view="updated"/);
      initial.setView("CLASSIC");
      assert.equal(viewHarness(false)(id, "STUDENT").view, "CLASSIC");
      assert.equal(storage.get(uiPreferenceKey(id, "application:view:student-updated-v1")), '"CLASSIC"');
      assert.equal(storage.get(uiPreferenceKey(id, "application:view")), JSON.stringify(legacy));
      assert.equal(storage.get(uiPreferenceKey(id, "materials:view")), '"list"');
      assert.equal(storage.get(uiPreferenceKey(id, "homeworks:assignments:sort")), '{"key":"assigned","desc":true}');
    }
    assert.equal(viewHarness(false)("rollout-new-student", "STUDENT").view, "UPDATED");
    for (const view of APP_VIEWS) {
      const id = `rollout-teacher-${view}`;
      storage.set(uiPreferenceKey(id, "application:view"), JSON.stringify(view));
      assert.equal(viewHarness(false)(id, "TEACHER").view, view);
      assert.equal(viewHarness(false)(id).view, view);
    }
    assert.equal(viewHarness(false)("rollout-new-teacher", "TEACHER").view, "CLASSIC");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("server rendering uses Updated for students and Classic for teachers without reading browser storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("SSR must not read localStorage"); } });
  try {
    const render = viewHarness(true);
    assert.match(render("ssr-student", "STUDENT").html, /data-app-view="updated"/);
    assert.match(render("ssr-teacher", "TEACHER").html, /data-app-view="classic"/);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("an invalid student preference falls back to Updated instead of a stale Classic choice", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    const key = uiPreferenceKey("rollout-invalid-student", "application:view:student-updated-v1");
    for (const raw of ['"bad"', '{', 'null']) {
      storage.set(key, raw);
      assert.equal(viewHarness(false)("rollout-invalid-student", "STUDENT").view, "UPDATED");
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("view persists without leaking to another account or replacing material preferences", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    writeLocalJson(uiPreferenceKey("view-test-teacher", "application:view"), "UPDATED");
    assert.equal(readLocalJson(uiPreferenceKey("view-test-teacher", "application:view"), "CLASSIC"), "UPDATED");
    assert.equal(readLocalJson(uiPreferenceKey("view-test-student", "application:view"), "CLASSIC"), "CLASSIC");
    assert.equal(readLocalJson(uiPreferenceKey("view-test-teacher", "materials:view"), "grid"), "grid");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("participants stay above unloaded materials in both roles and in all Classic classes", () => {
  for (const teacher of [true, false]) {
    assert.equal(classParticipantsPlacement("UPDATED", teacher, false), "ABOVE");
    for (const loaded of [true, false]) assert.equal(classParticipantsPlacement("CLASSIC", teacher, loaded), "ABOVE");
  }
});
test("loaded Updated classes have role-specific participant placement", () => {
  assert.equal(classParticipantsPlacement("UPDATED", true, true), "TEACHER_INLINE");
  assert.equal(classParticipantsPlacement("UPDATED", false, true), "STUDENT_INLINE");
  const room = source("components/class/class-room.tsx");
  assert.equal(room.match(/data-class-participants/g)?.length, 1);
  assert.match(room, /materialsLoaded = Boolean\(activeLessonId \|\| focusedWordDeck \|\| focusedRevisionId \|\| twisterSession\)/);
  for (const placement of ["ABOVE", "TEACHER_INLINE", "STUDENT_INLINE"]) assert.ok(room.includes(`participantsPlacement === "${placement}"`));
});

const toolbar = compile("components/class/class-material-toolbar.tsx", { "react/jsx-runtime": jsx }).ClassMaterialToolbar as React.ComponentType<{ lesson?: React.ReactNode; actions?: React.ReactNode; participants?: React.ReactNode; student?: boolean }>;
test("teacher toolbar puts live participants between Lesson and the other controls", () => {
  const html = renderToStaticMarkup(React.createElement(toolbar, { lesson: "LESSON", participants: "PARTICIPANTS", actions: "ACTIVITIES" }));
  assert.ok(html.indexOf("LESSON") < html.indexOf("PARTICIPANTS"));
  assert.ok(html.indexOf("PARTICIPANTS") < html.indexOf("ACTIVITIES"));
  assert.match(html, /data-participants-placement="teacher-inline"/);
});
test("student toolbar shows participants without exposing teacher-only Lesson controls", () => {
  const html = renderToStaticMarkup(React.createElement(toolbar, { student: true, participants: "PARTICIPANTS", lesson: "SECRET LESSON", actions: "SECRET ACTIVITIES" }));
  assert.match(html, /justify-end/);
  assert.ok(!html.includes("SECRET"));
  assert.match(html, /data-participants-placement="student-inline"/);
});
test("Classic toolbar retains the existing Lesson-left and actions-right structure", () => {
  const html = renderToStaticMarkup(React.createElement(toolbar, { lesson: "LESSON", actions: "ACTIVITIES" }));
  assert.match(html, /flex flex-wrap items-center gap-x-3 gap-y-2/);
  assert.match(html, /ml-auto flex max-w-full flex-wrap items-center justify-end gap-1/);
  assert.ok(!html.includes("data-participants-placement"));
});

test("the actual ClassRoom renders participants exactly once for both views, roles and loading states", () => {
  const ast = ts.createSourceFile("room.tsx", source("components/class/class-room.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stateNames: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "useState") stateNames.push(node.name.elements[0].getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const Empty = ({ children, fallback }: React.PropsWithChildren<{ fallback?: React.ReactNode }>) => React.createElement(React.Fragment, null, fallback ?? children);
  const Icon = () => React.createElement("svg");
  for (const view of APP_VIEWS) for (const teacher of [true, false]) for (const loaded of [true, false]) {
    let stateIndex = 0;
    const overrides: Record<string, unknown> = { people: [], partnerSnapshot: { id: "partner-1", name: "Partner", avatarUrl: null, presence: "offline" }, activeLessonId: loaded ? "lesson-1" : null };
    const imports: Record<string, unknown> = { "react/jsx-runtime": jsx };
    for (const node of ast.statements) if (ts.isImportDeclaration(node)) {
      const name = (node.moduleSpecifier as ts.StringLiteral).text;
      imports[name] = new Proxy({}, { get: () => Empty });
    }
    Object.assign(imports, {
      react: { ...React, useState: (initial: unknown) => { const name = stateNames[stateIndex++]; return React.useState(name in overrides ? overrides[name] : initial); } },
      "next/dynamic": { default: () => Empty }, "next/link": { default: ({ children, ...props }: React.PropsWithChildren) => React.createElement("a", props, children) },
      "@/components/app-view-provider": { useAppView: () => ({ view }) },
      "@/components/i18n-provider": { useT: () => ({ t: en, locale: "en" }) },
      "@/lib/app-view": { classParticipantsPlacement },
      "./class-material-toolbar": { ClassMaterialToolbar: toolbar },
      "@/lib/i18n": { fmt: (text: string, values: Record<string, unknown>) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? "")) },
      "@/lib/schedule-time": { SCHEDULE_FORMAT_TIME_ZONE: "UTC", scheduleNow: () => new Date("2026-10-12T12:00:00Z") },
      "@/lib/class-order": { CLASS_SORTS: ["lessons", "name", "balance"], orderClassPeople: () => [] },
      "@/lib/use-local-json": { useLocalJson: (_: unknown, fallback: unknown) => [fallback, () => {}] },
      "@/components/ui-preferences-provider": { useUiChoice: (_: unknown, choices: unknown, fallback: unknown) => [fallback, () => {}], useUiPreference: (_: unknown, fallback: unknown) => [fallback, () => {}] },
      "@/lib/presence": { platformPresence: (value: string) => value },
      "@/components/student-presence": { usePresenceMap: () => ({}), PresenceIndicator: Icon },
      "./dockable-panel": { DEFAULT_CLASS_PANEL_LAYOUT: { chat: {}, dictionary: {}, verbs: {}, script: {}, notes: {} }, DockablePanel: Empty, normalizeClassPanelPlacement: () => ({ floating: false }) },
      "@/components/avatar": { Avatar: Icon },
      "@/components/icons": new Proxy({}, { get: () => Icon }),
      "lucide-react": { NotebookPen: Icon },
      "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
      "@/lib/use-realtime": { useRealtimeSubscription() {} },
    });
    imports["./class-student-menu"] = compile("components/class/class-student-menu.tsx", {
      ...imports, react: React, "react-dom": { createPortal: (child: React.ReactNode) => child },
    });
    const Room = compile("components/class/class-room.tsx", imports).ClassRoom as React.ComponentType<{ role: string; selfId: string; selfName: string }>;
    const html = renderToStaticMarkup(React.createElement(Room, { role: teacher ? "TEACHER" : "STUDENT", selfId: "self", selfName: "Self" }));
    assert.equal(html.match(/data-class-participants=/g)?.length, 1);
    const placement = classParticipantsPlacement(view, teacher, loaded).toLowerCase().replace("_", "-");
    assert.ok(html.includes(`data-participants-placement="${placement}"`), `${view}/${teacher}/${loaded}: placement`);
    assert.equal(html.includes('aria-haspopup="menu"'), teacher);
    assert.ok(!html.includes('/teacher/homeworks?student=partner-1'), "Student actions remain inside the closed dropdown");
    assert.ok(html.includes("class-utility-bar"));
  }
});

test("the Settings selector is accessible and translated for every language and view", () => {
  for (const t of [en, ru, uk]) for (const view of APP_VIEWS) {
    const Settings = compile("components/app-view-settings.tsx", {
      "react/jsx-runtime": jsx,
      "./i18n-provider": { useT: () => ({ t }) },
      "./app-view-provider": { useAppView: () => ({ view, setView() {} }) },
      "@/lib/app-view": { APP_VIEWS },
      "./icons": { IconCheck: () => React.createElement("svg") },
    }).AppViewSettings as React.ComponentType;
    const html = renderToStaticMarkup(React.createElement(Settings));
    assert.ok(html.includes(t.settings.layoutView));
    assert.equal(html.match(/aria-pressed="true"/g)?.length, 1);
    assert.ok(html.includes("Classic") && html.includes("Updated"));
  }
});

test("Updated shell is the student default, teacher stays opt-in, logout is in profile, and impersonation remains usable", () => {
  for (const role of ["teacher", "student"]) {
    const layout = source(`app/${role}/layout.tsx`);
    assert.match(layout, role === "student" ? /<AppViewProvider role="STUDENT">/ : /<AppViewProvider>/);
    assert.match(layout, /<UpdatedNavigation/);
    assert.match(layout, /data-classic-header/);
    assert.match(layout, /notifications=\{<NotificationBell panel/);
    assert.match(source(`app/${role}/profile/page.tsx`), /<ProfileLogout/);
  }
  assert.match(source("components/profile-logout.tsx"), /view !== "UPDATED"\) return null/);
  assert.match(source("app/student/layout.tsx"), /returnToTeacher=\{session.impersonatedBy && <form action=\{returnToTeacherAction\}/);
  const css = source("app/globals.css");
  assert.match(css, /\[data-app-view="updated"\] \[data-classic-header\]\s*\{\s*display: none/);
  assert.match(source("components/updated-navigation.tsx"), /desktop.addEventListener\("change", onChange\)/);
});

test("centered search fits every desktop, phone and short landscape viewport", () => {
  for (const width of [320, 360, 390, 768, 896, 1024, 1920, 3840]) for (const height of [180, 390, 844, 1080]) {
    const p = centeredSearchPosition({ width, height });
    assert.equal(p.left, width / 2); assert.equal(p.top, height / 2);
    assert.ok(p.left - p.width / 2 >= 12 && p.left + p.width / 2 <= width - 12);
    assert.ok(p.top - p.maxHeight / 2 >= 12 && p.top + p.maxHeight / 2 <= height - 12);
  }
  assert.ok(Object.values(centeredSearchPosition({ width: NaN, height: Infinity })).every(Number.isFinite));
});

test("Updated reserves only the icon rail and expands on hover or keyboard focus, never ordinary click focus", () => {
  const navigation = source("components/updated-navigation.tsx");
  const css = source("app/globals.css");
  assert.match(navigation, /updated-desktop-navigation[^"\n]*w-20 shrink-0 lg:block/);
  assert.match(navigation, /sidebar-rail updated-desktop-rail group\/rail absolute left-0 top-0/);
  assert.match(css, /\.updated-desktop-rail:is\(:hover, :has\(:focus-visible\)\)\s*\{\s*width: 17rem/);
  assert.doesNotMatch(css, /\.updated-desktop-rail[^{}]*:focus-within/);
  assert.match(css, /\.updated-mobile-navigation \.sidebar-rail-nav > a > span\s*\{ opacity: 1/);
  assert.match(css, /\.updated-desktop-rail \.updated-panel-search > div > button\s*\{ min-width: 0/);
  assert.match(css, /\[data-app-view="updated"\] \.class-utility-bar\s*\{ left: 5rem/);
  assert.match(css, /\[data-app-view="updated"\] \[data-materials-tree-toggle\]\s*\{ left: 5\.75rem/);
});

test("large touch screens have an explicit Updated drawer instead of unreachable hover navigation", () => {
  const css = source("app/globals.css");
  const touch = css.match(/@media \(min-width: 1024px\) and \(hover: none\) and \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(touch);
  assert.match(touch, /\.updated-desktop-navigation\s*\{ display: none/);
  assert.match(touch, /\.updated-menu-launcher\s*\{ display: flex/);
  assert.match(touch, /\.updated-drawer-overlay\s*\{ display: block/);
  assert.match(touch, /\.class-utility-bar\s*\{ left: 0/);
});
test("sidebar notification portal stays reachable and never clips off small screens", () => {
  for (const width of [320, 390, 896, 1024, 1920]) for (const height of [180, 390, 844]) {
    const p = notificationPanelPosition({ right: width - 12, bottom: 100 }, { width, height });
    assert.ok(p.left >= 12 && p.left + p.width <= width - 12);
    assert.ok(p.top >= 12 && p.top + p.maxHeight <= height - 12);
  }
  const bell = source("components/teacher/notification-bell.tsx");
  assert.match(bell, /panel \? createPortal\(dropdown, document.body\) : dropdown/);
  assert.match(bell, /!dropdownRef.current\?\.contains/);
});

test("nested menu, notifications and search trap keys in the top layer and restore scroll", () => {
  const effects: (() => void)[] = [], handlers: ((event: unknown) => void)[] = [];
  let focused = 0; let activeLayer = 3;
  const document = {
    body: { style: { overflow: "auto" } }, activeElement: { isConnected: true, focus: () => focused++ },
    querySelectorAll: () => [{ dataset: { modalLayer: String(activeLayer) } }],
    addEventListener: (_: string, handler: (event: unknown) => void) => handlers.push(handler),
    removeEventListener: (_: string, handler: (event: unknown) => void) => handlers.splice(handlers.indexOf(handler), 1),
  };
  const hook = compile("lib/use-modal-layer.ts", { react: { useEffect: (effect: () => () => void) => effects.push(effect()) } }, { document }).useModalLayer as (enabled: boolean, ref: { current: null }, close: () => void, priority: number) => void;
  const closes = [0, 0, 0];
  for (let n = 0; n < 3; n++) hook(true, { current: null }, () => closes[n]++, n + 1);
  assert.equal(document.body.style.overflow, "hidden");
  handlers.forEach(handler => handler({ key: "Escape", preventDefault() {} }));
  assert.deepEqual(closes, [0, 0, 1]);
  effects.pop()!(); activeLayer = 2;
  handlers.forEach(handler => handler({ key: "Escape", preventDefault() {} }));
  assert.deepEqual(closes, [0, 1, 1]);
  assert.equal(document.body.style.overflow, "hidden");
  effects.reverse().forEach(cleanup => cleanup());
  assert.equal(document.body.style.overflow, "auto");
  assert.equal(handlers.length, 0); assert.equal(focused, 3);
});
