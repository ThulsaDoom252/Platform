import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { detectTranslationLang } from "../src/lib/translation-lang";
import {
  classVocabularyDirection,
  cleanClassVocabularyText,
  normalizeClassVocabularyLang,
} from "../src/lib/class-vocabulary";

test("английский текст переводится на выбранный язык", () => {
  assert.equal(classVocabularyDirection("come up with"), "FROM_ENGLISH");
});

test("украинский и русский текст переводятся на английский", () => {
  assert.equal(classVocabularyDirection("можливість"), "TO_ENGLISH");
  assert.equal(classVocabularyDirection("возможность"), "TO_ENGLISH");
});

test("выделение очищается от переносов и ограничивается", () => {
  assert.equal(cleanClassVocabularyText("  come\n\tup   with  "), "come up with");
  assert.equal(cleanClassVocabularyText("abcdef", 3), "abc");
});

test("украинский язык используется по умолчанию", () => {
  assert.equal(normalizeClassVocabularyLang(undefined), "UK");
  assert.equal(normalizeClassVocabularyLang("RU"), "RU");
});

test("the server defaults to the profile language and does not mislabel ambiguous Russian input as Ukrainian", async () => {
  const source = readFileSync("src/lib/actions/class-vocabulary.ts", "utf8");
  const start = source.indexOf("export async function translateClassVocabularyAction(");
  const end = source.indexOf("/**", start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const preferred of ["RU", "UK"] as const) {
    const calls: { target: string; source?: string }[] = [];
    const context = { exports: {} as { translateClassVocabularyAction: typeof import("../src/lib/actions/class-vocabulary").translateClassVocabularyAction }, currentStudent: async () => ({ studentId: "isolated-student" }), studentLearningLanguage: async () => preferred, classVocabularyDirection, cleanClassVocabularyText, detectTranslationLang,
      translateShortText: async (_text: string, target: string, source?: string) => { calls.push({ target, source }); return target === "EN" ? "work" : target === "UK" ? "працювати" : "работать"; } };
    runInNewContext(code, context);
    const reverse = await context.exports.translateClassVocabularyAction("работать");
    assert.equal(reverse.draft?.english, "work"); assert.equal(reverse.draft?.translationLang, preferred);
    assert.equal(reverse.draft?.translation, preferred === "UK" ? "працювати" : "работать");
    assert.deepEqual(calls, [{ target: "EN", source: undefined }, { target: preferred, source: "EN" }]);
    const english = await context.exports.translateClassVocabularyAction("work"); assert.equal(english.draft?.translationLang, preferred);
  }
});
