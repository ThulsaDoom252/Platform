import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { SEARCH_CATEGORIES, type GlobalSearchItem, type SearchCategory } from "../src/lib/global-search-types";
import { uiPreferenceKey } from "../src/lib/ui-preferences";
import { readLocalJson, writeLocalJson } from "../src/lib/local-json-store";
import { centeredSearchPosition, globalSearchPosition } from "../src/lib/global-search-position";
import { en } from "../src/lib/i18n/en";
import { ru } from "../src/lib/i18n/ru";
import { uk } from "../src/lib/i18n/uk";

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
function compile(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(source(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => { if (name in imports) return imports[name]; throw Error(`Unexpected import: ${name}`); }, ...globals });
  return exports;
}

function harness(userId: string, options: { role?: "TEACHER" | "STUDENT"; view?: "CLASSIC" | "UPDATED"; dictionary?: typeof en; query?: string; selected?: Set<SearchCategory>; search?: (input: unknown) => Promise<{ items: GlobalSearchItem[] }> } = {}) {
  const useLocalJson = compile("lib/use-local-json.ts", {
    react: { ...React, useSyncExternalStore: (_: unknown, read: () => unknown) => read() },
    "@/lib/local-json-store": { readLocalJson, writeLocalJson },
  }).useLocalJson;
  const preferences = compile("components/ui-preferences-provider.tsx", {
    react: React, "react/jsx-runtime": jsx, "@/lib/use-local-json": { useLocalJson }, "@/lib/ui-preferences": { uiPreferenceKey },
  });
  const effects: (() => (() => void) | void)[] = [], timers = new Map<number, () => Promise<void>>(), updates: { index: number; value: unknown }[] = [];
  let stateIndex = 0, nextTimer = 0;
  let toggle!: (event: { target: { checked: boolean } }) => void;
  const runtime = { ...jsx, jsx: (type: unknown, props: Record<string, unknown>, key: string) => {
    if (type === "input" && props.type === "checkbox") toggle = props.onChange as typeof toggle;
    return jsx.jsx(type as React.ElementType, props, key);
  } };
  const Search = compile("components/global-search.tsx", {
    react: { ...React, useEffect: (effect: () => void) => effects.push(effect), useState: (initial: unknown) => {
      const index = stateIndex++; const value = typeof initial === "function" ? initial() : initial;
      return [index === 0 ? true : index === 1 ? options.query ?? "" : index === 2 ? options.selected ?? value : value, (next: unknown) => updates.push({ index, value: next })];
    } },
    "react/jsx-runtime": runtime, "react-dom": { createPortal: (content: React.ReactNode) => content },
    "next/link": { default: ({ children, ...props }: React.PropsWithChildren) => React.createElement("a", props, children) },
    "@/lib/actions/global-search": { globalSearchAction: options.search ?? (async () => ({ items: [] })) },
    "@/lib/global-search-types": { SEARCH_CATEGORIES },
    "@/components/i18n-provider": { useT: () => ({ t: options.dictionary ?? en }) },
    "@/components/icons": { IconChevronRight: () => React.createElement("svg"), IconSearch: () => React.createElement("svg") },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "@/lib/global-search-position": { centeredSearchPosition, globalSearchPosition },
    "./app-view-provider": { useAppView: () => ({ view: options.view ?? "CLASSIC" }) },
    "@/lib/use-modal-layer": { useModalLayer() {} }, "./ui-preferences-provider": preferences,
  }, { document: { body: {} }, window: { setTimeout: (callback: () => Promise<void>) => { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout: (id: number) => timers.delete(id) } }).GlobalSearch as React.ComponentType<{ role: "TEACHER" | "STUDENT" }>;
  const Provider = preferences.UiPreferencesProvider as React.ComponentType<React.PropsWithChildren<{ userId: string }>>;
  const html = renderToStaticMarkup(React.createElement(Provider, { userId }, React.createElement(Search, { role: options.role ?? "STUDENT" })));
  return { html, toggle, effects, timers, updates };
}

function withStorage(run: (storage: Map<string, string>) => void | Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage"), storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  return Promise.resolve().then(() => run(storage)).finally(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
  });
}

test("dictionary-entry search is unchecked by default for both roles in both views and all languages", async () => withStorage(() => {
  for (const role of ["TEACHER", "STUDENT"] as const) for (const view of ["CLASSIC", "UPDATED"] as const) for (const dictionary of [en, ru, uk]) {
    const { html } = harness(`default-${role}-${view}`, { role, view, dictionary });
    assert(html.includes(dictionary.globalSearch.includeVocabularyEntries));
    const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];
    assert(checkbox && !checkbox.includes("checked=") && !checkbox.includes("disabled="));
  }
}));

test("entry-search selection survives reopening/reloading and is isolated by account, not role or application view", async () => withStorage(storage => {
  const key = uiPreferenceKey("entry-toggle-teacher", "search:include-vocabulary-entries");
  assert(!harness("entry-toggle-teacher", { role: "TEACHER" }).html.includes('type="checkbox" checked=""'));
  harness("entry-toggle-teacher", { role: "TEACHER" }).toggle({ target: { checked: true } });
  assert.equal(storage.get(key), "true");
  for (const view of ["CLASSIC", "UPDATED"] as const) assert.match(harness("entry-toggle-teacher", { role: "TEACHER", view }).html, /type="checkbox"[^>]*checked=""/);
  assert.doesNotMatch(harness("entry-toggle-student").html, /type="checkbox"[^>]*checked=""/);
  harness("entry-toggle-student").toggle({ target: { checked: true } });
  harness("entry-toggle-teacher", { role: "TEACHER" }).toggle({ target: { checked: false } });
  assert.doesNotMatch(harness("entry-toggle-teacher", { role: "TEACHER" }).html, /type="checkbox"[^>]*checked=""/);
  assert.match(harness("entry-toggle-student").html, /type="checkbox"[^>]*checked=""/);
}));

test("malformed stored preferences cannot opt students into dictionary search", async () => withStorage(storage => {
  const key = uiPreferenceKey("entry-invalid", "search:include-vocabulary-entries");
  for (const raw of ['"true"', '"false"', '{}', '1', 'null', '{']) {
    storage.set(key, raw);
    assert.doesNotMatch(harness("entry-invalid").html, /type="checkbox"[^>]*checked=""/);
  }
}));

test("teacher entry checkbox becomes unavailable only when Materials category is explicitly deselected", async () => withStorage(() => {
  const { html } = harness("entry-categories", { role: "TEACHER", selected: new Set(["LESSONS"]) });
  assert.match(html, /type="checkbox"[^>]*disabled=""/);
  assert.doesNotMatch(harness("entry-student-categories").html, /type="checkbox"[^>]*disabled=""/);
}));

test("actual debounced requests send the opt-in flag and stale results cannot survive a toggle", async () => withStorage(async () => {
  const sent: unknown[] = []; let resolveOld!: (value: { items: GlobalSearchItem[] }) => void;
  const oldResponse = new Promise<{ items: GlobalSearchItem[] }>(resolve => { resolveOld = resolve; });
  const off = harness("entry-race", { query: "freak out", search: input => { sent.push(input); return oldResponse; } });
  const cleanup = off.effects[1]()!;
  const oldRequest = [...off.timers.values()][0]();
  off.toggle({ target: { checked: true } });
  cleanup();
  const on = harness("entry-race", { query: "freak out", search: async input => { sent.push(input); return { items: [] }; } });
  on.effects[1](); await [...on.timers.values()][0]();
  resolveOld({ items: [{ id: "old", category: "MATERIALS", title: "stale", subtitle: null, href: "/student/materials", icon: null }] });
  await oldRequest;
  const requests = JSON.parse(JSON.stringify(sent));
  assert.deepEqual(requests, [
    { query: "freak out", categories: ["MATERIALS"], includeVocabularyEntries: false },
    { query: "freak out", categories: ["MATERIALS"], includeVocabularyEntries: true },
  ]);
  assert(!off.updates.some(update => update.index === 3 && Array.isArray(update.value) && update.value.some(item => item.id === "old")));
  assert.match(source("components/global-search.tsx"), /\$\{selectedKey\}\\n\$\{includeVocabularyEntries\}/);
}));
