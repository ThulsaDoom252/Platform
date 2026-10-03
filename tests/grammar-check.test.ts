import { test } from "node:test";
import assert from "node:assert/strict";
import {
  grammarCheckSections,
  grammarCheckVocabulary,
} from "../src/lib/bundled-lessons/grammar-check";
import { regularAnswerMap } from "../src/lib/regular-lesson";

const checked = grammarCheckSections.filter((section) => section.studentHtml.includes("sentence-check"));

test("Grammar Check contains every requested exercise and two native voice sections", () => {
  assert.deepEqual(checked.map((section) => regularAnswerMap(section).size), [8, 8, 8, 6, 8, 8]);
  assert.equal(grammarCheckSections.filter((section) => section.voiceExercise).length, 2);
  assert.ok(grammarCheckVocabulary.length >= 70);
  assert.equal(new Set(grammarCheckVocabulary.map((entry) => entry.word.toLowerCase())).size, grammarCheckVocabulary.length);
});

test("each tense exercise has exactly one unchanged bracket answer", () => {
  for (const section of checked.slice(0, 3)) {
    const prompts = [...section.studentHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
    const answers = [...regularAnswerMap(section).values()].map((entry) => entry.answer.toLowerCase());
    const unchanged = prompts.filter((prompt, index) => {
      const bracket = prompt.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toLowerCase();
      return bracket === answers[index];
    });
    assert.equal(unchanged.length, 1, section.title);
  }
});

test("infinitive exercise has exactly two answers without to", () => {
  const section = grammarCheckSections.find((entry) => entry.id === "06-infinitive");
  assert.ok(section);
  const answers = [...regularAnswerMap(section).values()].map((entry) => entry.answer);
  assert.equal(answers.filter((answer) => !answer.startsWith("to ")).length, 2);
});
