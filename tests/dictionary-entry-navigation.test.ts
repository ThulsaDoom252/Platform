import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaryEntryAnchor, dictionaryEntryId } from "../src/components/materials/dictionary-entry-focus";
import type { MaterialPhrase, MaterialVerb } from "../src/lib/materials";
import { en } from "../src/lib/i18n/en";
import { fmt } from "../src/lib/i18n";

const source = (path: string) => readFileSync(`src/${path}`, "utf8");
function compile(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(source(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (name in imports) return imports[name];
    throw Error(`Unexpected import: ${name}`);
  }, ...globals });
  return exports;
}

test("dictionary search targets require an exact bounded record ID from the current dictionary", () => {
  const entries = [{ id: "first", phrase: "take" }, { id: "second", phrase: "take" }];
  assert.equal(dictionaryEntryId("second", entries), "second");
  for (const input of [undefined, null, [], ["second"], {}, 2, "", "take", "foreign", " second ", "second#first", "x".repeat(129)]) {
    assert.equal(dictionaryEntryId(input, entries), undefined);
  }
  assert.equal(dictionaryEntryId("second", [{ id: "first" }]), undefined, "An entry from another visible node is not a target in this node");
  assert.equal(dictionaryEntryId("second", []), undefined);
  assert.equal(dictionaryEntryAnchor("phrase", "second"), "dictionary-phrase-second");
  assert.equal(dictionaryEntryAnchor("verb", "second"), "dictionary-verb-second");
  assert.equal(dictionaryEntryAnchor("phrase", 'quote"/space id'), "dictionary-phrase-quote%22%2Fspace%20id");
});

test("both material routes pass a bounded entry ID and remount for different entries in the same node", () => {
  for (const role of ["teacher", "student"]) {
    const page = source(`app/${role}/materials/page.tsx`);
    assert.match(page, /entry\?: string \| string\[\]/);
    assert.match(page, /typeof entry === "string" && entry\.length <= 128/);
    assert.match(page, /key=\{`[^`]+\$\{initialEntryId \?\? ""\}`\}/);
    assert.match(page, /initialEntryId=\{initialEntryId\}/);
  }
  const explorer = source("components/materials/materials-explorer.tsx");
  assert.match(explorer, /selected\?\.id === initialNodeId && isPhrasePage/);
  assert.match(explorer, /dictionaryEntryId\(initialEntryId, selected\.verbs\.length \? selected\.verbs : selected\.blocks\.length \? \[\] : selected\.phrases\)/);
  assert.equal(explorer.match(/focusedEntryId=\{focusedEntryId\}/g)?.length, 2);
  assert.match(explorer, /const isPhrasePage = selected\?\.type === "FILE" && !selected\.fileKind/);
  assert.match(explorer, /initialNodeId && byId\.has\(initialNodeId\) \? initialNodeId/);
  const focus = source("components/materials/dictionary-entry-focus.ts");
  assert.ok(!/setView|setPathOpen|setHidden|setGameData|setOpen|localStorage|querySelector|innerHTML/.test(focus));
});

function focusHarness(entryId: string | undefined, layout?: unknown) {
  let runEffect!: () => (() => void) | undefined;
  let dependencies: unknown[] = [];
  let frame: (() => void) | undefined;
  let requested = 0;
  let cancelled = 0;
  const hook = compile("components/materials/dictionary-entry-focus.ts", {
    react: {
      useRef: () => ({ current: null }),
      useEffect: (effect: typeof runEffect, deps: unknown[]) => { runEffect = effect; dependencies = deps; },
    },
  }, {
    window: {
      requestAnimationFrame: (callback: () => void) => { frame = callback; requested++; return 17; },
      cancelAnimationFrame: (id: number) => { assert.equal(id, 17); cancelled++; },
    },
  }).useDictionaryEntryFocus as (id: string | undefined, layout?: unknown) => { current: unknown };
  const ref = hook(entryId, layout);
  return { ref, dependencies, effect: () => runEffect(), run: () => frame?.(), get requested() { return requested; }, get cancelled() { return cancelled; } };
}

test("exact-entry focus waits for the reader DOM, focuses without incidental scroll and centres the record", () => {
  const harness = focusHarness("second", true);
  const calls: string[] = [];
  const cleanup = harness.effect();
  harness.ref.current = {
    dataset: { dictionaryEntry: "second" },
    focus: (options: { preventScroll: boolean }) => { assert.equal(options.preventScroll, true); calls.push("focus"); },
    scrollIntoView: (options: { behavior: string; block: string }) => { assert.equal(options.behavior, "auto"); assert.equal(options.block, "center"); calls.push("scroll"); },
  };
  assert.equal(harness.requested, 1);
  assert.deepEqual(calls, []);
  harness.run();
  assert.deepEqual(calls, ["focus", "scroll"]);
  assert.equal(harness.dependencies[1], true, "Changing verb category/alphabetical layout schedules the target again");
  cleanup?.();
  assert.equal(harness.cancelled, 1);
});

test("invalid, missing and stale dictionary targets never focus or scroll another record", () => {
  const none = focusHarness(undefined);
  assert.equal(none.effect(), undefined);
  assert.equal(none.requested, 0);
  for (const target of [null, { dataset: { dictionaryEntry: "different" }, focus: () => assert.fail("Must not focus a stale entry"), scrollIntoView: () => assert.fail("Must not scroll a stale entry") }]) {
    const stale = focusHarness("second");
    stale.effect();
    stale.ref.current = target;
    assert.doesNotThrow(() => stale.run());
  }
});

const phrase = (id: string): MaterialPhrase => ({
  id, phrase: "take", icon: null, imageUrl: null, transcription: null, transcriptionUs: null, transcriptionUk: null,
  translation: `Hidden translation ${id}`, note: null, description: `Secret game clue ${id}`, gameImageUrl: null,
  section: "Verbs", sectionColor: null, kind: "PHRASE", examples: [{ en: `Closed example ${id}`, tr: `Closed example translation ${id}` }],
});
const verb = (id: string): MaterialVerb => ({ id, base: "take", past: "took", participle: "taken", category: "Daily", icon: null, baseIpa: null, pastIpa: null, participleIpa: null, translation: "брать" });

function readerImports(react: typeof React = React) {
  const Icon = () => null;
  return {
    react, "react/jsx-runtime": jsx,
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "@/lib/actions/phrase-images": {}, "@/lib/actions/materials": {},
    "@/components/i18n-provider": { useT: () => ({ t: en }) },
    "@/lib/phrase-words": { hasTranscription: () => false },
    "@/lib/i18n": { fmt },
    "./speech": { useSpeech: () => ({ supported: false, speaking: null }) },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "@/lib/category-color": { categoryColor: () => "#10b981" },
    "@/components/icons": { IconVolume: Icon, IconChevronDown: Icon, IconEye: Icon, IconEyeOff: Icon, IconPencil: Icon, IconTrash: Icon },
    "./dictionary-entry-focus": { dictionaryEntryAnchor, dictionaryEntryId, useDictionaryEntryFocus: () => ({ current: null }) },
  };
}

test("phrase search highlights only the matched duplicate and does not reveal translations, examples or game clues", () => {
  const hiddenReact = { ...React, useState: (initial: unknown) => React.useState(initial === "none" ? "translation" : initial) } as typeof React;
  const Reader = compile("components/materials/phrase-reader.tsx", readerImports(hiddenReact)).PhraseReader as React.ComponentType<{ phrases: MaterialPhrase[]; title: string; icon: null; description: null; focusedEntryId?: string }>;
  const props = { phrases: [phrase("first"), phrase("second")], title: "Dictionary", icon: null, description: null };
  const html = renderToStaticMarkup(React.createElement(Reader, { ...props, focusedEntryId: "second" }));
  assert.match(html, /id="dictionary-phrase-second"[^>]+data-dictionary-entry="second" data-search-target="true" tabindex="-1"/);
  assert.equal(html.match(/data-search-target="true"/g)?.length, 1);
  assert.ok(!html.includes("Hidden translation"));
  assert.ok(!html.includes("Secret game clue"));
  assert.ok(!html.includes("Closed example"));
  for (const focusedEntryId of [undefined, "foreign", "x".repeat(129)]) {
    const invalid = renderToStaticMarkup(React.createElement(Reader, { ...props, focusedEntryId }));
    assert.ok(!invalid.includes('data-search-target="true"'));
  }
});

test("irregular-verb search keeps exact record anchors in both category and alphabetical readers", () => {
  for (const alphabetical of [false, true]) {
    const stateReact = { ...React, useState: (initial: unknown) => React.useState(initial === false ? alphabetical : initial) } as typeof React;
    const Reader = compile("components/materials/verbs-reader.tsx", readerImports(stateReact)).VerbsReader as React.ComponentType<{ verbs: MaterialVerb[]; focusedEntryId?: string }>;
    const html = renderToStaticMarkup(React.createElement(Reader, { verbs: [verb("first"), verb("second")], focusedEntryId: "second" }));
    assert.match(html, /id="dictionary-verb-second" data-dictionary-entry="second" data-search-target="true" tabindex="-1"/);
    assert.equal(html.match(/data-search-target="true"/g)?.length, 1);
    assert.equal(html.match(/id="dictionary-verb-second"/g)?.length, 1);
  }
});
