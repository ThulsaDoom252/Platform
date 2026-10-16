import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "../src/lib/i18n";
import * as lessonUnit from "../src/lib/lesson-unit";

const source = readFileSync("src/components/lessons/lesson-vocab.tsx", "utf8");
function render({ teacher, count, integratedHeader, locale, sectionTitle, withSource }: {
  teacher?: boolean; count: number; integratedHeader: boolean;
  locale: keyof typeof dictionaries; sectionTitle?: string;
  withSource?: boolean;
}) {
  const exports: { LessonVocab?: React.ComponentType<Record<string, unknown>> } = {};
  const Icon = () => React.createElement("svg");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: (name: string) => {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (name === "next/image") return { default: () => null };
    if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
    if (name === "@/components/i18n-provider") return { useT: () => ({ t: dictionaries[locale] }) };
    if (name === "@/lib/lesson-unit") return lessonUnit;
    if (name === "@/lib/phrase-words") return { hasTranscription: () => false };
    if (name === "@/components/materials/speech") return { useSpeech: () => ({}), SpeakPair: () => null };
    if (name === "@/components/lessons/lesson-vocab-to-materials") return { LessonVocabToMaterials: () => null };
    if (name === "@/components/lessons/lesson-vocab-to-homework") return { LessonVocabToHomework: (props: Record<string, unknown>) => React.createElement("button", { "data-testid": "lesson-game-shortcut", "data-student": props.defaultStudentId, "data-assignment": props.assignmentId }) };
    if (name === "@/lib/category-color") return { categoryColor: () => "#818cf8" };
    if (name === "@/components/icons") return new Proxy({}, { get: () => Icon });
    if (name === "@/lib/utils") return { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") };
    if (name === "@/lib/actions/lessons") return { translateLessonVocabularyAction: async () => ({}) };
    throw Error(`Unexpected import: ${name}`);
  } });
  const words = Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`, word: `word-${index}`, translation: "", category: "", examples: [],
  }));
  return renderToStaticMarkup(React.createElement(exports.LessonVocab!, {
    teacher, words, highlights: {}, integratedHeader, sectionTitle,
    ...(withSource ? { unitId: "lesson-id", lessonTitle: "Transport", defaultStudentId: "student-id", assignmentId: "assignment-id" } : {}),
  }));
}

test("teachers see the total entry count in parentheses inside the vocabulary title only", () => {
  for (const locale of Object.keys(dictionaries) as (keyof typeof dictionaries)[]) {
    for (const integratedHeader of [true, false]) for (const count of [0, 1, 22]) {
      const html = render({ teacher: true, count, integratedHeader, locale, sectionTitle: "Vocabulary · Fruit & Berries" });
      const heading = html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1];
      assert.equal(heading.replace(/<[^>]*>/g, ""), `Vocabulary · Fruit &amp; Berries (${count})`);
      assert.equal(html.split(`(${count})`).length - 1, 1);
      assert(!/<p\b[^>]*>\s*\d+\s+words\s*<\/p>/.test(html));
      assert(html.includes(dictionaries[locale].lessonUnits.searchWords));
    }
  }
});

test("students, including callers that omit the teacher flag, never see a vocabulary count", () => {
  for (const teacher of [false, undefined]) for (const integratedHeader of [true, false]) {
    const html = render({ teacher, count: 22, integratedHeader, locale: "en" });
    const heading = html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)![1].replace(/<[^>]*>/g, "");
    assert.equal(heading, dictionaries.en.lessonUnits.secVocab);
    assert(!html.includes("(22)") && !html.includes("22 words"));
  }
  assert(!source.includes("fmt(t.lessonUnits.words"));
});

test("the vocabulary game icon is beside the dictionary heading only for teachers with words, with the exact student context", () => {
  const teacher = render({ teacher: true, count: 4, integratedHeader: true, locale: "en", withSource: true });
  assert(teacher.includes('data-testid="lesson-game-shortcut"') && teacher.includes('data-student="student-id"') && teacher.includes('data-assignment="assignment-id"'));
  for (const flag of [false, undefined]) assert(!render({ teacher: flag, count: 4, integratedHeader: true, locale: "en", withSource: true }).includes("lesson-game-shortcut"));
  assert(!render({ teacher: true, count: 0, integratedHeader: false, locale: "en", withSource: true }).includes("lesson-game-shortcut"));
});
