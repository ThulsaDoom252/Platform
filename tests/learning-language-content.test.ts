import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectLearningTranslations, applyLearningTranslations, learningLanguage } from "../src/lib/learning-language-content";
import { learningRegularOverrides } from "../src/lib/learning-language-regular";
import { parseKeyed } from "../src/lib/keyed-parser";

test("learning language is RU/UK only and is not the interface locale", () => {
  assert.equal(learningLanguage("RU"), "RU"); assert.equal(learningLanguage("UK"), "UK");
  for (const value of [null, undefined, "ru", "uk", "UA", "EN", "", {}]) assert.equal(learningLanguage(value), null);
});

test("a vocabulary overlay translates words, notes and examples without modifying English, images or its source", () => {
  const original = { translationLang: "RU", sourceText: "Сырой импорт", words: [{ id: "w1", word: "friendly", translation: "дружелюбный", note: "Полезное слово", ipaUs: "/ˈfrendli/", imageUrl: "/image.png", examples: [{ en: "A friendly person.", tr: "Дружелюбный человек." }] }] };
  const snapshot = structuredClone(original);
  const plan = collectLearningTranslations(original, "UK");
  assert.deepEqual(plan.segments.map(s => s.text), ["friendly", "Полезное слово", "A friendly person."]);
  const result = applyLearningTranslations(original, "UK", plan, ["дружній", "Корисне слово", "Дружня людина."]);
  assert.equal(result.translationLang, "UK"); assert.equal(result.words[0].translation, "дружній");
  assert.deepEqual({ ...result.words[0], translation: snapshot.words[0].translation, note: snapshot.words[0].note, examples: snapshot.words[0].examples }, { ...snapshot.words[0], translationLang: "UK" });
  assert.equal(result.sourceText, snapshot.sourceText); assert.deepEqual(original, snapshot);
});

test("already correct human translations and unrelated English definitions are preserved", () => {
  const source = { translationLang: "UK", words: [{ word: "friend", translation: "приятель", note: "A person you know", examples: [{ en: "My friend.", tr: "Мій приятель." }] }] };
  assert.equal(collectLearningTranslations(source, "UK").segments.length, 0);
  const result = applyLearningTranslations(source, "UK", collectLearningTranslations(source, "UK"), []);
  assert.deepEqual(result, { ...source, words: source.words.map(word => ({ ...word, translationLang: "UK" })) });
});

test("an RU or UK flag cannot hide an English duplicate in a translation field", () => {
  for (const language of ["RU", "UK"] as const) {
    const source = { translationLang: language, words: [{ word: "be flustered", translation: "be flustered", examples: [] }] };
    const plan = collectLearningTranslations(source, language);
    assert.equal(plan.segments.length, 1); assert.equal(plan.segments[0].source, "EN");
    const translated = applyLearningTranslations(source, language, plan, [language === "RU" ? "быть растерянным" : "бути розгубленим"]);
    assert.notEqual(translated.words[0].translation, translated.words[0].word);
  }
  const source = { words: [{ word: "be mortified", translation: "згорати від сорому" }] };
  assert.equal(collectLearningTranslations(source, "RU").segments[0].requiresCyrillic, true);
});

test("real keyed grammar/lexis fixtures include every Cyrillic explanation and every translatable tr field", () => {
  for (const fixture of ["keyed-rule.txt", "keyed-lexis.txt", "keyed-tense.txt"]) {
    const parsed = parseKeyed(readFileSync(`scripts/fixtures/${fixture}`, "utf8"));
    assert.ok(parsed && parsed.type !== "VOCAB");
    const plan = collectLearningTranslations({ blocks: parsed.blocks }, "UK");
    const patches = new Set(plan.patches.map(patch => JSON.stringify(patch.path)));
    const walk = (value: unknown, path: (string | number)[]) => {
      if (typeof value === "string" && /[ыэъё]/i.test(value)) assert.ok(patches.has(JSON.stringify(path)), `${fixture}: ${path.join(".")} missed`);
      else if (Array.isArray(value)) value.forEach((item, i) => walk(item, [...path, i]));
      else if (value && typeof value === "object") Object.entries(value).forEach(([key, child]) => walk(child, [...path, key]));
    };
    walk({ blocks: parsed.blocks }, []);
  }
});

test("rule word and marker translations use the word; marker ru and form tr use the English sentence", () => {
  const blocks = [{ type: "word", word: "borrow", tr: "брать взаймы", notes: [] }, { type: "marker", word: "already", tr: "уже", en: "I have already eaten.", ru: "Я уже поел.", hintText: "Используем после have" }, { type: "form", en: "She works.", tr: "Она работает.", formula: "подлежащее + V-s" }];
  const plan = collectLearningTranslations({ translationLang: "RU", blocks }, "UK");
  assert.equal(plan.segments[plan.patches.find(p => p.path.join(".") === "blocks.0.tr")!.segment].text, "borrow");
  assert.equal(plan.segments[plan.patches.find(p => p.path.join(".") === "blocks.1.tr")!.segment].text, "already");
  assert.equal(plan.segments[plan.patches.find(p => p.path.join(".") === "blocks.1.ru")!.segment].text, "I have already eaten.");
  assert.equal(plan.segments[plan.patches.find(p => p.path.join(".") === "blocks.2.tr")!.segment].text, "She works.");
});

test("worksheet HTML keeps attributes, answer keys, English and markup; translated text is escaped", () => {
  const source = { studentHtml: '<section id="same" data-key="не менять"><p>  Объяснение &amp; правило  <b>Present Simple</b>.</p><ol class="translation-check"><li>Она работает.</li></ol><!-- заметка --></section>', teacherHtml: '<p>Answer: She works.</p>' };
  const plan = collectLearningTranslations(source, "UK");
  assert.deepEqual(plan.segments.map(s => s.text), ["Объяснение & правило", "Она работает."]);
  const result = applyLearningTranslations(source, "UK", plan, ['Пояснення & <правило>', "Вона працює."]);
  assert.ok(result.studentHtml.includes('id="same" data-key="не менять"'));
  assert.ok(result.studentHtml.includes('  Пояснення &amp; &lt;правило&gt;  <b>Present Simple</b>'));
  assert.ok(result.studentHtml.includes('<!-- заметка -->'));
  assert.equal(result.teacherHtml, source.teacherHtml);
});

test("translation homework changes only the correct language side and accepted target answers", () => {
  const source = { exercises: [
    { id: "into-en", kind: "translate", translationLanguage: "RU", items: [{ id: "i1", prompt: "Она работает.", answer: "She works.", accepted: ["She works"] }] },
    { id: "from-en", kind: "translate", translationDirection: "from-english", translationLanguage: "RU", items: [{ id: "i2", prompt: "She works.", answer: "Она работает.", accepted: ["Она трудится."] }] },
    { id: "fill", kind: "fill", items: [{ id: "i3", prompt: "She ___ (work).", answer: "works" }] },
  ], answers: { i1: "She worked", i2: "Она работает", score: "50", attempt: "1" }, results: [{ percent: 50 }], teacherFeedback: { note: "Молодец" } };
  const plan = collectLearningTranslations(source, "UK");
  const result = applyLearningTranslations(source, "UK", plan, ["Вона працює.", "Вона працює.", "Вона трудиться."]);
  assert.equal(result.exercises[0].items[0].prompt, "Вона працює."); assert.equal(result.exercises[0].items[0].answer, "She works.");
  assert.equal(result.exercises[1].items[0].prompt, "She works."); assert.equal(result.exercises[1].items[0].answer, "Вона працює.");
  const item = result.exercises[1].items[0];
  assert.ok("accepted" in item); assert.deepEqual(item.accepted, ["Вона трудиться."]);
  assert.deepEqual(result.exercises[2], source.exercises[2]); assert.deepEqual(result.answers, source.answers); assert.deepEqual(result.results, source.results); assert.deepEqual(result.teacherFeedback, source.teacherFeedback);
});

test("legacy regular edits are classified by translation-check only and English grader keys stay intact", () => {
  const sections = [{ id: "section", title: "Exercise", tone: "exercise", studentHtml: '<ol class="translation-check"><li>Она работает.</li></ol><ol><li>She ___.</li></ol>', teacherHtml: "", defaultOpen: true,
    exerciseOverrides: { "1": { title: "Custom", instruction: "", kind: "fill", items: [{ prompt: "Я работаю.", answers: ["I work."] }] } } }];
  const state = { "regular-exercise-override:section:1": JSON.stringify({ title: "Custom", instruction: "", kind: "fill", items: [{ prompt: "Она работает.", answers: ["She works."] }] }), "regular-exercise-override:section:2": JSON.stringify({ title: "Fill", instruction: "", kind: "fill", items: [{ prompt: "She ___ (work).", answers: ["works"] }] }), "regular-answer:section:1": "She worked" };
  const overrides = learningRegularOverrides(sections, state);
  const plan = collectLearningTranslations({ regularSections: sections, overrides }, "UK");
  const paths = plan.patches.map(p => p.path.join("."));
  assert.ok(paths.includes("regularSections.0.exerciseOverrides.1.items.0.prompt"));
  assert.ok(paths.includes("overrides.regular-exercise-override:section:1.items.0.prompt"));
  assert.ok(!paths.some(path => path.includes("override:section:2")));
  const result = applyLearningTranslations({ regularSections: sections, overrides }, "UK", plan, plan.segments.map(() => "Переклад"));
  assert.deepEqual((result.overrides["regular-exercise-override:section:1"] as { items: { answers: string[] }[] }).items[0].answers, ["She works."]);
  assert.equal(state["regular-answer:section:1"], "She worked");
});

test("revision choose options equal personalized answers exactly, including existing human wording", () => {
  const source = { plan: [{ mode: "choose", steps: [{ mode: "choose", word: { word: "bank", translation: "банк" }, options: ["банк", "кот"] }, { mode: "choose", word: { word: "cat", translation: "кот" }, options: ["кот", "банк"] }] }] };
  const plan = collectLearningTranslations(source, "UK");
  assert.equal(plan.segments.length, 2);
  const result = applyLearningTranslations(source, "UK", plan, ["берег", "кіт"]);
  assert.equal(result.plan[0].steps[0].options[0], result.plan[0].steps[0].word.translation);
  assert.equal(result.plan[0].steps[1].options[0], result.plan[0].steps[1].word.translation);
  const human = { translationLang: "UK", mode: "choose", word: { word: "bank", translation: "банк" }, options: ["банк"] };
  assert.equal(collectLearningTranslations(human, "UK").segments.length, 0);
});

test("live cards localize without changing indices, order, timer state or history", () => {
  const value = { cards: [{ phraseId: "a", word: "cat", translation: "кот" }], liveState: { index: 1, deck: [{ phraseId: "a", word: "cat", translation: "кот" }], timer: { paused: true, remaining: 7 }, phase: "SENTENCE" }, attempts: [{ translation: "не менять", percent: 75 }], state: { translation: "ответ ученика" } };
  const plan = collectLearningTranslations(value, "UK");
  const result = applyLearningTranslations(value, "UK", plan, plan.segments.map(() => "кіт"));
  assert.equal(result.liveState.deck[0].translation, "кіт");
  assert.deepEqual({ ...result.liveState, deck: value.liveState.deck }, value.liveState);
  assert.deepEqual(result.attempts, value.attempts); assert.deepEqual(result.state, value.state);
});

test("ambiguous duplicate source translations cannot replace a choose step's own correct option", () => {
  const source = [{ mode: "choose", word: { word: "bank", translation: "берег" }, options: ["берег", "дом"] }, { mode: "choose", word: { word: "shore", translation: "берег" }, options: ["берег", "дом"] }];
  const plan = collectLearningTranslations(source, "UK");
  const result = applyLearningTranslations(source, "UK", plan, ["банк", "узбережжя", "дім", "дім"]);
  assert.equal(result[0].options[0], result[0].word.translation); assert.equal(result[1].options[0], result[1].word.translation);
});

test("teacher-only notes are never sent to the translator; incomplete translations fail before applying", () => {
  const source = { sections: [{ teacherOnly: true, studentHtml: "Секрет" }, { tone: "teacher", teacherHtml: "Секрет" }], teacherNote: "Приватно", words: [{ word: "cat", translation: "кот" }] };
  const plan = collectLearningTranslations(source, "UK");
  assert.equal(plan.segments.length, 1); assert.equal(plan.segments[0].text, "cat");
  assert.throws(() => applyLearningTranslations(source, "UK", plan, []), /Incomplete/);
  assert.equal(source.words[0].translation, "кот");
  const privateEdit = JSON.stringify({ title: "Translation", kind: "fill", translationLanguage: "RU", items: [{ prompt: "Секрет учителя", answers: ["Private teacher key"] }] });
  assert.deepEqual(learningRegularOverrides([{ id: "secret", teacherOnly: true, tone: "teacher", title: "Private", studentHtml: "", teacherHtml: "", defaultOpen: false }], { "regular-exercise-override:secret:1": privateEdit, "regular-exercise-override:deleted:1": privateEdit }), {});
});
