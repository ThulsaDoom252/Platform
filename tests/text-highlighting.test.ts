import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../src/components/i18n-provider";
import { HighlightToolButtons, HighlightToolsContext, type HighlightTools } from "../src/components/lessons/highlight-tools";
import { HighlightableAnswerField } from "../src/components/lessons/highlightable-answer-field";
import { dictionaries } from "../src/lib/i18n";
import {
  homeworkTextHighlightColors, homeworkTextHighlightRanges, homeworkHighlightSegments,
  homeworkValueKey, homeworkStatusKey, homeworkAttemptsKey, homeworkNoteKey,
  toggleHomeworkTextHighlight, toggleHomeworkTextHighlightRange, toggleHomeworkTextHighlightTargets, mergeHomeworkTextHighlights,
  type HomeworkItem,
} from "../src/lib/lesson-homework";
import { lessonSnippetColors, toggleLessonTextFragments, type LessonHighlightSnippet } from "../src/lib/lesson-text-highlights";
import { clearLessonHighlights, dialogueHighlights, isLessonHighlightKey, replaceLessonHighlights, lineWordKey } from "../src/lib/lesson-unit";
import { rangeContainsPoint, selectedOffsets, wordAtPoint } from "../src/lib/text-highlight-dom";
import { createHighlightGestureGuard, isHighlightPointerClick } from "../src/lib/highlight-gesture";
import { readFileSync } from "node:fs";

const item: HomeworkItem = { id: "test", prompt: "A reliable artist works out.", answer: "reliable" };

test("homework word click removes any color, preserving the remainder of a selected phrase", () => {
  const phrase = toggleHomeworkTextHighlightRange({}, item, "prompt", 2, 17, "green");
  const next = toggleHomeworkTextHighlightRange(phrase, item, "prompt", 2, 10, "yellow", true);
  assert.deepEqual(homeworkTextHighlightRanges(next, item.id, "prompt", item.prompt.length), [{ start: 10, end: 17, color: "green" }]);
  const again = toggleHomeworkTextHighlightRange(next, item, "prompt", 2, 10, "yellow", true);
  assert.deepEqual(homeworkTextHighlightColors(again, item.id, "prompt", item.prompt).slice(2, 10), Array(8).fill("yellow"));
});

test("selected characters can be recolored and toggled off without removing adjacent colors", () => {
  let state = toggleHomeworkTextHighlightRange({}, item, "prompt", 2, 17, "yellow");
  state = toggleHomeworkTextHighlightRange(state, item, "prompt", 5, 8, "red");
  assert.deepEqual(homeworkTextHighlightRanges(state, item.id, "prompt", item.prompt.length), [
    { start: 2, end: 5, color: "yellow" }, { start: 5, end: 8, color: "red" }, { start: 8, end: 17, color: "yellow" },
  ]);
  state = toggleHomeworkTextHighlightRange(state, item, "prompt", 5, 8, "red");
  assert.deepEqual(homeworkTextHighlightRanges(state, item.id, "prompt", item.prompt.length), [
    { start: 2, end: 5, color: "yellow" }, { start: 8, end: 17, color: "yellow" },
  ]);
});

test("selection across several homework sources uniformly applies one color, then uniformly clears", () => {
  const other = { ...item, id: "other" };
  const partlyColored = toggleHomeworkTextHighlightRange({}, item, "prompt", 2, 10, "yellow");
  const targets = [item, other].map((entry) => ({ itemId: entry.id, source: "prompt" as const, start: 2, end: 10 }));
  const changed = toggleHomeworkTextHighlightTargets(partlyColored, [item, other], targets, "yellow");
  for (const entry of [item, other]) assert(homeworkTextHighlightColors(changed, entry.id, "prompt", entry.prompt).slice(2, 10).every((color) => color === "yellow"));
  assert.deepEqual(toggleHomeworkTextHighlightTargets(changed, [item, other], targets, "yellow"), {});
});

test("legacy homework marks survive migration and highlighting does not alter answers or review data", () => {
  const stored = { [homeworkValueKey(item.id)]: "A saved answer", [homeworkStatusKey(item.id)]: "correct",
    [homeworkAttemptsKey(item.id)]: '["wrong"]', [homeworkNoteKey(item.id)]: "Keep this note", "hw:reviewed-at": "reviewed" };
  const legacy = toggleHomeworkTextHighlight(stored, item, "prompt", 2, "green");
  const colors = homeworkTextHighlightColors(legacy, item.id, "prompt", item.prompt);
  assert(colors.slice(2, 10).every((color) => color === "green"));
  const changed = toggleHomeworkTextHighlightRange(legacy, item, "prompt", 11, 17, "red", true);
  for (const [key, value] of Object.entries(stored)) assert.equal(changed[key], value);
  assert(homeworkTextHighlightColors(changed, item.id, "prompt", item.prompt).slice(2, 10).every((color) => color === "green"));
});

test("highlight runs preserve exact whitespace, Unicode, punctuation and all text metrics", () => {
  const text = "  Ім’я\n🙂 reliably — yes!  ";
  const segments = homeworkHighlightSegments(text, Array.from({ length: text.length }, (_, at) => at > 3 && at < 11 ? "green" : null));
  assert.equal(segments.map((segment) => segment.text).join(""), text);
  assert.equal(homeworkHighlightSegments(text, []).length, 1);
});

test("live highlighting additions and removals merge without replacing a student's draft or attempts", () => {
  const state = { [homeworkValueKey(item.id)]: "Student is typing", [homeworkAttemptsKey(item.id)]: "[]", "hw:reviewed-at": "keep" };
  const incoming = toggleHomeworkTextHighlightRange({ [homeworkValueKey(item.id)]: "Old server answer" }, item, "prompt", 2, 10, "yellow");
  const merged = mergeHomeworkTextHighlights(state, incoming);
  assert.equal(merged[homeworkValueKey(item.id)], "Student is typing");
  assert.equal(merged["hw:reviewed-at"], "keep");
  assert.deepEqual(mergeHomeworkTextHighlights(merged, {}), state);
  assert.equal(mergeHomeworkTextHighlights(state, {}), state);
});

const snippet: LessonHighlightSnippet = {
  key: "text-range:1234abcd:abcdef01:0", text: "reliable artist",
  words: [{ key: "text:1234abcd:11111111:0", start: 0, end: 8 }, { key: "text:1234abcd:22222222:0", start: 9, end: 15 }],
};

test("lesson fragments cover partial words and repeated word click only removes that word", () => {
  const all = [{ snippet, start: 0, end: 15 }];
  const colored = toggleLessonTextFragments({}, all, "green");
  assert(lessonSnippetColors(colored, snippet).every((color) => color === "green"));
  const cleared = toggleLessonTextFragments(colored, [{ snippet, start: 0, end: 8 }], "red", true);
  assert(lessonSnippetColors(cleared, snippet).slice(0, 8).every((color) => color === null));
  assert(lessonSnippetColors(cleared, snippet).slice(8).every((color) => color === "green"));
  const partial = toggleLessonTextFragments(cleared, [{ snippet, start: 2, end: 5 }], "yellow");
  assert.deepEqual(lessonSnippetColors(partial, snippet).slice(0, 8), [null, null, "yellow", "yellow", "yellow", null, null, null]);
  assert.deepEqual(toggleLessonTextFragments(partial, [{ snippet, start: 2, end: 5 }], "yellow"), cleared);
});

test("lesson range keys persist through normalization/undo/clear alongside legacy transcript marks", () => {
  const legacy = { [lineWordKey(0, 0)]: "green" as const, [snippet.words[0].key]: "yellow" as const };
  const next = toggleLessonTextFragments(legacy, [{ snippet, start: 10, end: 12 }], "red");
  Object.keys(next).forEach((key) => assert(isLessonHighlightKey(key)));
  assert.deepEqual(dialogueHighlights(replaceLessonHighlights({}, next)), next);
  assert.deepEqual(clearLessonHighlights(next), {});
  assert.equal(next[lineWordKey(0, 0)], "green");
  assert.deepEqual(dialogueHighlights(replaceLessonHighlights(next, legacy)), legacy);
  assert(!isLessonHighlightKey("text-range:1234abcd:abcdef01:0:2:bad"));
});

const fakeTools = (enabled: boolean): HighlightTools => ({
  enabled, color: "yellow", toggle() {}, chooseColor() {},
});
const render = (children: ReactNode, tools: HighlightTools, locale: "en" | "ru" | "uk" = "en") => renderToStaticMarkup(createElement(I18nProvider, {
  locale, dictionary: dictionaries[locale], realtimeConfigured: false,
} as ComponentProps<typeof I18nProvider>, createElement(HighlightToolsContext.Provider, { value: tools }, children)));

test("unified highlight toolbar has only Highlight and three colors with stable dimensions in every language", () => {
  const shape = (html: string) => [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((match) => match[1].split(" ").filter((name) => /^(h-|w-|px-|py-|p-|gap-|flex|shrink)/.test(name)));
  for (const locale of ["en", "ru", "uk"] as const) {
    const off = render(createElement(HighlightToolButtons, { tools: fakeTools(false) }), fakeTools(false), locale);
    const on = render(createElement(HighlightToolButtons, { tools: fakeTools(true) }), fakeTools(true), locale);
    assert.equal([...off.matchAll(/<button /g)].length, 4);
    assert.deepEqual(shape(off), shape(on));
    assert.equal(off.replace(/<[^>]+>/g, ""), on.replace(/<[^>]+>/g, ""));
    assert(!on.includes(dictionaries[locale].interactiveHomework.highlightWords));
    assert(!on.includes(dictionaries[locale].interactiveHomework.highlightSelect));
  }
});

test("native input, textarea and dropdown stay identical when highlighting switches on; ordinary text is not automatically colored", () => {
  for (const variant of [{}, { multiline: true }, { choices: ["who", "whom"] }]) {
    const field = createElement(HighlightableAnswerField, { value: "newly typed ordinary text", colors: [],
      label: "Answer", placeholder: "Type", className: "h-9 w-full px-3 text-sm font-bold", onChange() {}, onCommit() {}, onHighlight() {}, ...variant });
    const off = render(field, fakeTools(false));
    assert.equal(render(field, fakeTools(true)), off);
    assert.equal([...off.matchAll(/<(input|textarea|select)\b/g)].length, 1);
    assert(off.includes('aria-hidden="true"')); assert(off.includes("pointer-events-none absolute inset-0"));
    assert(!off.includes("background-color:#fde047"));
  }
});

test("lesson and homework highlight bars show no explanatory caption and retain right-aligned controls", () => {
  for (const file of ["assigned-lesson.tsx", "interactive-homework.tsx"]) {
    const source = readFileSync(`src/components/lessons/${file}`, "utf8");
    assert(!source.includes("highlightToolsHint"));
    assert(source.includes("<HighlightToolButtons tools={highlightTools} />"));
    assert(source.includes("sticky top-20 z-30 flex flex-wrap items-center justify-end gap-2"));
  }
});

test("a selection is applied once and its following click cannot toggle a word back off", () => {
  const gesture = createHighlightGestureGuard();
  gesture.begin();
  assert.equal(gesture.consumeClick(), false);
  gesture.selected();
  assert.equal(gesture.consumeClick(false), false);
  assert.equal(gesture.consumeClick(), true);
  assert.equal(gesture.consumeClick(), false);
  gesture.selected();
  gesture.begin();
  assert.equal(gesture.consumeClick(), false);
});

test("text fields distinguish clicks from drags without blocking normal native selection", () => {
  assert.equal(isHighlightPointerClick(null, 10, 20), false);
  assert.equal(isHighlightPointerClick({ x: 10, y: 20 }, 12, 22), true);
  assert.equal(isHighlightPointerClick({ x: 10, y: 20 }, 16, 20), false);
  assert.equal(isHighlightPointerClick({ x: 10, y: 20 }, 10, 60), false);
  const field = readFileSync("src/components/lessons/highlightable-answer-field.tsx", "utf8");
  assert(field.includes("if (!choices || !active || !tools || event.button !== 0"));
  assert(field.includes("onMouseUp={highlightSelection}"));
  assert(field.includes("commitBeforeHighlight();\n    highlight(start, end, tools.color)"));
  assert(!field.includes("tools.select("));
});

test("lesson and homework selections apply immediately with no submode and retain boundary and click guards", () => {
  for (const file of ["lesson-text-highlighter.tsx", "interactive-homework.tsx"]) {
    const source = readFileSync(`src/components/lessons/${file}`, "utf8");
    assert(!source.includes(".tool"));
    assert(!source.includes("tools.select("));
    assert(!source.includes("highlightTools.select("));
    assert(source.includes(".current.selected()"));
    assert(source.includes(".current.consumeClick(event.detail > 0)"));
    assert(source.includes("selection.removeAllRanges()"));
    assert(source.includes("onKeyUpCapture"));
    assert(source.includes(".contains("));
  }
});

test("dictionary lookup is disabled only inside an active highlighter, including homework answers", () => {
  const lesson = readFileSync("src/components/class/class-lesson.tsx", "utf8");
  assert(lesson.includes(`event.target.closest('[data-highlight-active="true"]')`));
  assert(lesson.includes("captureSelection(event, target?.dataset.lookupText"));
  const highlighter = readFileSync("src/components/lessons/lesson-text-highlighter.tsx", "utf8");
  const homework = readFileSync("src/components/lessons/interactive-homework.tsx", "utf8");
  assert(highlighter.includes('data-highlight-active={enabled ? "true" : undefined}'));
  assert(homework.includes('data-highlight-active={canHighlight && highlightMode ? "true" : undefined}'));
});

test("hit testing only accepts actual word rectangles, never the surrounding empty field", () => {
  const range = { getClientRects: () => [{ left: 10, right: 50, top: 20, bottom: 40 }] } as unknown as Range;
  assert(rangeContainsPoint(range, 20, 25));
  assert(!rangeContainsPoint(range, 51, 25)); assert(!rangeContainsPoint(range, 20, 41));
  assert(!rangeContainsPoint(range, 100, 100));
});

test("a word split into colored and ordinary spans is still clicked as one complete word", () => {
  const texts = [{ data: "rel" }, { data: "iab" }, { data: "le artist" }];
  let at = 0;
  const previousDocument = globalThis.document; const previousNodeFilter = globalThis.NodeFilter;
  globalThis.NodeFilter = { SHOW_TEXT: 4 } as typeof NodeFilter;
  globalThis.document = {
    createTreeWalker: () => ({ nextNode: () => texts[at++] ?? null }),
    createRange: () => {
      const offsets = { start: 0, end: 0 };
      return { setStart: (node: { data: string }, offset: number) => { offsets.start = texts.slice(0, texts.indexOf(node)).reduce((sum, entry) => sum + entry.data.length, 0) + offset; },
        setEnd: (node: { data: string }, offset: number) => { offsets.end = texts.slice(0, texts.indexOf(node)).reduce((sum, entry) => sum + entry.data.length, 0) + offset; },
        getClientRects: () => [{ left: offsets.start * 10, right: offsets.end * 10, top: 0, bottom: 20 }] };
    },
  } as unknown as Document;
  try { assert.deepEqual(wordAtPoint({} as HTMLElement, 45, 10), { start: 0, end: 8 }); }
  finally { globalThis.document = previousDocument; globalThis.NodeFilter = previousNodeFilter; }
});

test("selection intersects only its exercise text, including partial and cross-node fragments", () => {
  const previousDocument = globalThis.document; const previousRange = globalThis.Range;
  globalThis.Range = { START_TO_START: 0, END_TO_END: 2 } as typeof Range;
  const root = { textContent: "A reliable artist" } as HTMLElement;
  const contents = { startContainer: {}, startOffset: 0, endContainer: {}, endOffset: 17,
    selectNodeContents() {}, cloneRange: () => ({ setEnd() {}, toString: () => "A rel" }) };
  globalThis.document = { createRange: () => contents } as unknown as Document;
  const selection = { intersectsNode: () => true, compareBoundaryPoints: (kind: number) => kind === 0 ? 1 : -1,
    cloneRange: () => ({ startContainer: {}, startOffset: 5, endContainer: {}, endOffset: 8, toString: () => "iab" }) } as unknown as Range;
  try {
    assert.deepEqual(selectedOffsets(root, selection), { start: 5, end: 8 });
    assert.equal(selectedOffsets(root, { ...selection, intersectsNode: () => false } as Range), null);
  } finally { globalThis.document = previousDocument; globalThis.Range = previousRange; }
});
