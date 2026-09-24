/**
 * Двухколоночный словник Word / Phrase | Examples: слово, IPA и перевод
 * склеены слева, пары «пример / перевод» — справа.
 * Запуск: npx tsx scripts/test-parser-watkins.ts
 */
import assert from "node:assert/strict";
import { parseMaterial } from "../src/lib/materials-parser";

const sample = [
  "🔥 WATKINS’ JUDGMENT",
  "🎨 Adjectives & Adverbs — Прикметники і прислівники",
  "Word / Phrase\tExamples",
  "🚫 obsolete /ˌɒb.səˈliːt/ застарілий / застарілий\t• This method is obsolete. Цей метод застарів. • The software became obsolete fast. Програмне забезпечення швидко застаріло.",
  "❤️ sympathetic /ˌsɪm.pəˈθet.ɪk/ співчутливий / дружній\t• She gave me a sympathetic look. Вона дала мені співчутливий погляд. • He is a sympathetic friend. Він є співчутливим другом.",
  "💀 Nouns — Іменники",
  "Word / Phrase\tExamples",
  "🔥 lust /lʌst/ похіть / жага / пристрасть\t• Lust is a powerful emotion. Жага — це сильна емоція. • His lust for power grew. Його жага до влади зростала.",
  "👁️ sights /saɪts/ визначні місця / поле зору\t• We saw all the sights. Ми побачили всі визначні місця. • He set his sights on a goal. Він направив свій погляд на мету.",
  "🏃 Verbs — Дієслова",
  "Word / Phrase\tExamples",
  "🔎 to seek out /siːk aʊt/ шукати / вишукувати\t• They seek out new talent. Вони вишукують нові таланти. • He seeks out dangerous thrills. Він шукає небезпечні враження.",
  "🤿 to dive in /daɪv ɪn/ зануритися / розпочати\t• Let’s just dive in and start. Давай просто зануримося і почнемо. • She dived in without thinking. Вона кинулась без роздумів.",
  "💬 Phrases & Other — Фрази та інше",
  "Word / Phrase\tExamples",
  "⛓️ tied to /taɪd tuː/ прив’язаний до / пов’язаний з\t• He was tied to a chair. Він був прив’язаний до стільця. • She is tied to her routine. Вона прив’язана до своєї рутини.",
].join("\n");

const result = parseMaterial(sample, "vocabulary");

assert.equal(result.vocabularyFormat, "word-examples-table");
assert.equal(result.title, "WATKINS’ JUDGMENT");
assert.equal(result.description, null);
assert.equal(result.phrases.length, 7);
assert.deepEqual(result.warnings, []);

const obsolete = result.phrases[0];
assert.equal(obsolete.phrase, "obsolete");
assert.equal(obsolete.transcription, "/ˌɒb.səˈliːt/");
assert.equal(obsolete.translation, "застарілий / застарілий");
assert.equal(obsolete.section, "Adjectives & Adverbs — Прикметники і прислівники");
assert.deepEqual(obsolete.examples, [
  { en: "This method is obsolete.", tr: "Цей метод застарів." },
  {
    en: "The software became obsolete fast.",
    tr: "Програмне забезпечення швидко застаріло.",
  },
]);

const diveIn = result.phrases[5];
assert.equal(diveIn.phrase, "to dive in");
assert.equal(diveIn.transcription, "/daɪv ɪn/");
assert.equal(diveIn.examples.length, 2);

const tiedTo = result.phrases[6];
assert.equal(tiedTo.section, "Phrases & Other — Фрази та інше");
assert.equal(tiedTo.translation, "прив’язаний до / пов’язаний з");

console.log("Watkins word/examples table parser: ok");
