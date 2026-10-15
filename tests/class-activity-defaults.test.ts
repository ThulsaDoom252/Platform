import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { initialActivityMaterialSource } from "../src/lib/activity-material-source";
import { CLASS_ACTIVITY_CARD_SECONDS, CLASS_ACTIVITY_WORD_DECK_DEFAULTS } from "../src/lib/class-activity-defaults";
import * as wordDeck from "../src/lib/word-deck";
import { fmt } from "../src/lib/i18n";
import { en } from "../src/lib/i18n/en";
import type { CopyTree } from "../src/lib/actions/materials";

const tree = (scope: CopyTree["scope"], ownerId: string | null, id: string = scope): CopyTree => ({
  key: `${scope}-${ownerId}`, label: id, short: id, scope, ownerId,
  nodes: [{ id, parentId: null, type: "FILE", pageKind: "VOCAB", name: id, icon: null }],
});
const trees = [tree("PERSONAL", "teacher", "mine"), tree("STUDENT", "first", "first-vocab"),
  tree("STUDENT", "selected", "selected-vocab"), tree("MISTAKE", "selected", "mistakes")];

test("new class activities select the exact student's material tree, not the first student or mistakes", () => {
  assert.deepEqual(initialActivityMaterialSource(trees, [], "selected"), { source: "STUDENTS", studentTreeKey: "STUDENT-selected" });
  assert.deepEqual(initialActivityMaterialSource([...trees].reverse(), [], "selected"), { source: "STUDENTS", studentTreeKey: "STUDENT-selected" });
  const emptyTree = { ...tree("STUDENT", "empty"), nodes: [] };
  assert.deepEqual(initialActivityMaterialSource([...trees, emptyTree], [], "empty"), { source: "STUDENTS", studentTreeKey: emptyTree.key });
  assert.deepEqual(initialActivityMaterialSource(trees, [], "missing"), { source: "STUDENTS", studentTreeKey: "" });
});

test("saved sources and standalone personal-material defaults remain unchanged", () => {
  assert.deepEqual(initialActivityMaterialSource(trees, ["mine"], "selected"), { source: "MINE", studentTreeKey: "STUDENT-first" });
  assert.deepEqual(initialActivityMaterialSource(trees, ["first-vocab"], "selected"), { source: "STUDENTS", studentTreeKey: "STUDENT-first" });
  assert.deepEqual(initialActivityMaterialSource(trees, []), { source: "MINE", studentTreeKey: "STUDENT-first" });
  assert.deepEqual(initialActivityMaterialSource([], []), { source: "MINE", studentTreeKey: "" });
});

test("class-only defaults use 15 seconds per card and the existing More student ratio of 70%", () => {
  const settings = wordDeck.normalizeWordDeckSettings({ ...wordDeck.DEFAULT_WORD_DECK_SETTINGS, ...CLASS_ACTIVITY_WORD_DECK_DEFAULTS });
  assert.equal(CLASS_ACTIVITY_CARD_SECONDS, 15);
  assert.equal(settings.timerMode, "CARD"); assert.equal(settings.alternate, true); assert.equal(settings.studentPercent, 70);
  for (const key of ["cardSeconds", "guessSeconds", "sentenceSeconds"] as const) assert.equal(settings[key], 15);
  const cards = wordDeck.buildWordDeck(Array.from({ length: 10 }, (_, index) => ({ phraseId: `${index}`, word: `word ${index}` })), settings);
  assert.equal(cards.filter(card => card.owner === "STUDENT").length, 7);
  assert.equal(wordDeck.DEFAULT_WORD_DECK_SETTINGS.timerMode, "NONE");
  assert.equal(wordDeck.DEFAULT_WORD_DECK_SETTINGS.cardSeconds, 120);
  assert.equal(wordDeck.DEFAULT_WORD_DECK_SETTINGS.alternate, false);
});

const Icon = () => React.createElement("svg");
const Timer = ({ value, ...props }: { value: number }) => React.createElement("input", { ...props, type: "number", value, readOnly: true });
function loadComponent(path: string, react: unknown = React, extras: Record<string, unknown> = {}) {
  const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: (name: string) => {
    if (name in extras) return extras[name];
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "react-dom") return { createPortal: (child: unknown) => child };
    if (name === "@/components/i18n-provider") return { useT: () => ({ t: en, locale: "en" }) };
    if (name === "@/components/timer-number-input") return { TimerNumberInput: Timer };
    if (name === "@/lib/i18n") return { fmt };
    if (name === "@/lib/word-deck") return wordDeck;
    if (name === "@/lib/class-activity-defaults") return { CLASS_ACTIVITY_CARD_SECONDS, CLASS_ACTIVITY_WORD_DECK_DEFAULTS };
    if (name === "@/lib/activity-material-source") return { initialActivityMaterialSource };
    if (name === "@/lib/timer-settings") return { DEFAULT_TIMER_SECONDS: 120 };
    if (name === "@/lib/utils") return { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") };
    if (name.startsWith("@/lib/actions/")) return new Proxy({}, { get: () => async () => { throw Error("No server calls during isolated render"); } });
    return new Proxy({}, { get: () => Icon });
  } });
  return exports;
}
const formPath = "src/components/game/word-deck-studio.tsx";
const renderForm = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(loadComponent(formPath).WordDeckForm, {
  activity: null, busy: false, externalError: null, onCancel() {}, onSave() {}, ...props,
}));
const pressed = (html: string, label: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .some(match => match[1].includes('aria-pressed="true"') && match[2].replace(/<[^>]*>/g, "").trim() === label);

test("actual new class form renders Students, per-card timer, 15 seconds, alternate mode and More student selected", () => {
  const html = renderForm({ defaultStudentId: "selected", defaultSettings: CLASS_ACTIVITY_WORD_DECK_DEFAULTS });
  assert(pressed(html, en.wordDeck.students)); assert(pressed(html, en.wordDeck.timerCard)); assert(pressed(html, en.wordDeck.moreStudent));
  assert(/type="number"[^>]*value="15"/.test(html));
  const alternate = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].find(match => match[1].includes(en.wordDeck.alternate))!;
  assert(alternate[1].includes('checked=""'));
  assert(html.includes('type="range"') && html.includes('value="70"'));
});

test("editing saved games preserves explicit Off, zero durations, ratio and personal sources", () => {
  const settings = wordDeck.normalizeWordDeckSettings({ timerMode: "NONE", cardSeconds: 0, alternate: false, studentPercent: 30 });
  const html = renderForm({ defaultStudentId: "selected", defaultSettings: CLASS_ACTIVITY_WORD_DECK_DEFAULTS,
    activity: { id: "saved", title: "Saved", nodeId: "mine", cards: [], settings } });
  assert(pressed(html, en.wordDeck.myMaterials)); assert(pressed(html, en.wordDeck.timerNone));
  assert(!pressed(html, en.wordDeck.moreStudent));
  const standalone = renderForm({});
  assert(pressed(standalone, en.wordDeck.myMaterials) && pressed(standalone, en.wordDeck.timerNone));
});

test("both creation paths receive the active student, class-only defaults and a remount key", () => {
  const WordForm = () => null, PictureForm = () => null;
  for (const stage of ["WORD_CREATE", "GUESS_CREATE"]) {
    let cursor = 0;
    const react = { useState: (value: unknown) => [cursor++ === 0 ? stage : value, () => {}],
      useMemo: (run: () => unknown) => run(), useEffect() {}, useTransition: () => [false, () => {}] };
    const Picker = loadComponent("src/components/class/class-activity-picker.tsx", react, {
      "@/components/game/word-deck-studio": { WordDeckForm: WordForm },
      "@/components/game/guess-picture-studio": { GuessPicturePresetForm: PictureForm },
    }).ClassActivityPicker as (props: unknown) => React.ReactElement<Record<string, unknown>>;
    const result = Picker({ studentId: "selected", onCancel() {}, onAdded() {} });
    assert.equal(result.key, "selected"); assert.equal(result.props.defaultStudentId, "selected");
    if (stage === "WORD_CREATE") { assert.equal(result.type, WordForm); assert.equal(result.props.defaultSettings, CLASS_ACTIVITY_WORD_DECK_DEFAULTS); }
    else { assert.equal(result.type, PictureForm); assert.equal(result.props.defaultSeconds, 15); }
  }
});

test("Guess by picture gets 15 seconds only for new class presets and preserves saved zero", () => {
  const Form = loadComponent("src/components/game/guess-picture-studio.tsx").GuessPicturePresetForm;
  const render = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(Form, {
    preset: null, defaultStudentId: "selected", defaultSeconds: 15, busy: false, externalError: null, onCancel() {}, onSave() {}, ...props,
  }));
  assert(/type="number"[^>]*value="15"/.test(render({})));
  assert(/type="number"[^>]*value="0"/.test(render({ preset: { id: "saved", title: "Saved", cards: [], seconds: 0, mode: "PICTURE" } })));
  assert(/type="number"[^>]*value="120"/.test(render({ defaultSeconds: undefined, defaultStudentId: undefined })));
});
