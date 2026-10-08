import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dictionaries } from "../src/lib/i18n";

const read = (file: string) => readFileSync(`src/${file}`, "utf8");

test("the highlight toolbar no longer contains pronunciation controls", () => {
  const assigned = read("components/lessons/assigned-lesson.tsx");
  const toolbar = assigned.slice(assigned.indexOf("const highlightToolbar ="), assigned.indexOf('if (data.lesson.kind === "REGULAR")'));
  assert.ok(toolbar.includes("HighlightToolButtons"));
  assert.ok(toolbar.includes("onClick={undoHighlight}"));
  assert.ok(toolbar.includes("onClick={clearHighlights}"));
  assert.ok(!toolbar.includes("British"));
  assert.ok(!toolbar.includes("IconVolume"));
});

test("Show UK sits with vocabulary reveal controls and is teacher-only, controlled and theme-aware", () => {
  const vocabulary = read("components/lessons/lesson-vocab.tsx");
  const header = vocabulary.slice(vocabulary.indexOf("{/* Шапка:"), vocabulary.indexOf("{translationError &&"));
  assert.ok(header.includes("{teacher && onShowBritishChange && ("));
  assert.ok(header.includes("disabled={showBritishBusy}"));
  assert.ok(header.includes("onClick={() => onShowBritishChange(!showBritish)}"));
  assert.ok(header.includes("aria-pressed={showBritish}"));
  assert.ok(header.includes("data-no-lesson-highlight"));
  assert.ok(header.includes("bg-accent text-white"));
  assert.ok(header.includes("bg-surface-2 text-muted hover:text-content"));
  assert.ok(header.indexOf("toggleAllLessonVocabularyReveal") < header.indexOf("onShowBritishChange &&"));
  assert.ok(header.indexOf("onShowBritishChange &&") < header.indexOf("<LessonVocabToMaterials"));
  for (const dictionary of Object.values(dictionaries)) assert.ok(dictionary.lessonUnits.showBritish.trim());
});

test("regular and activity vocabulary use the same assigned British state and save handler", () => {
  const assigned = read("components/lessons/assigned-lesson.tsx");
  assert.equal((assigned.match(/onShowBritishChange=\{teacher \? changeBritish : undefined\}/g) ?? []).length, 2);
  assert.equal((assigned.match(/showBritishBusy=\{busy\}/g) ?? []).length, 2);
  assert.ok(assigned.includes("showBritishAction(data.assignment.id, next)"));
  assert.ok(assigned.includes("if (result.error) setBritish(previous)"));
  assert.ok(assigned.includes("setBritish(data.showBritish)"));
  for (const file of ["lesson-view.tsx", "regular-lesson-view.tsx"]) {
    const view = read(`components/lessons/${file}`);
    const vocabulary = view.slice(view.indexOf("<LessonVocab"), view.indexOf("/>", view.indexOf("<LessonVocab")));
    assert.ok(vocabulary.includes("showBritish={showBritish}"));
    assert.ok(vocabulary.includes("onShowBritishChange={onShowBritishChange}"));
    assert.ok(vocabulary.includes("showBritishBusy={showBritishBusy}"));
  }
});

test("moving the control preserves UK sound and transcription, persisted visibility and realtime delivery", () => {
  const vocabulary = read("components/lessons/lesson-vocab.tsx");
  assert.ok(vocabulary.includes("showUk={single && showBritish}"));
  assert.ok(vocabulary.includes("showBritish && w.ipaUk"));
  const actions = read("lib/actions/lessons.ts");
  const action = actions.slice(actions.indexOf("export async function showBritishAction("), actions.indexOf("export async function lessonVocabularyRevealAction("));
  assert.ok(action.includes("await requireTeacher()"));
  assert.ok(action.includes("eq(lessonUnits.authorId, session.userId)"));
  assert.ok(action.includes("current.add(BRITISH_OPTION)"));
  assert.ok(action.includes("current.delete(BRITISH_OPTION)"));
  assert.ok(action.includes('publishClassRealtime(row.studentId, "lesson")'));
});
