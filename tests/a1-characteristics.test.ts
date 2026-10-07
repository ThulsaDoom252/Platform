import assert from "node:assert/strict";
import test from "node:test";

import {
  a1CharacteristicsHomework,
  a1CharacteristicsSections,
  a1CharacteristicsVocabulary,
} from "../src/lib/bundled-lessons/a1-characteristics";

test("A1 Characteristics has ten essential words and complete lesson practice", () => {
  assert.equal(a1CharacteristicsVocabulary.length, 10);
  assert.equal(new Set(a1CharacteristicsVocabulary.map((entry) => entry.word)).size, 10);
  assert.ok(a1CharacteristicsVocabulary.every((entry) => entry.description && entry.examples.length >= 2));
  assert.ok(a1CharacteristicsSections.length >= 20);
  assert.equal(a1CharacteristicsSections.filter((entry) => entry.title.startsWith("Dialogue ")).length, 4);
  assert.ok(a1CharacteristicsSections.some((entry) => entry.title.startsWith("Reading ·")));
});

test("possessive lesson teaches the its exception and supplies full homework", () => {
  const grammar = a1CharacteristicsSections.find((entry) => entry.id === "04-grammar-form");
  assert.ok(grammar?.studentHtml.includes("no independent possessive pronoun for it"));
  assert.ok(grammar?.studentHtml.includes("The dog likes its toy"));
  assert.ok(!grammar?.studentHtml.includes("The toy is its.</b>"));
  assert.equal(a1CharacteristicsHomework.exercises.length, 7);
  assert.ok(a1CharacteristicsHomework.exercises.some((entry) => entry.kind === "translate"));
  assert.ok(a1CharacteristicsHomework.exercises.some((entry) => entry.kind === "describe"));
  assert.ok(a1CharacteristicsHomework.exercises.some((entry) => entry.kind === "question-audio"));
});
