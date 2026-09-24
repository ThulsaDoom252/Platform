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

const clericalSample = [
  "⚖️ CLERICAL ERROR",
  "📦 Nouns — Существительные",
  "Word / Phrase\tExamples",
  "an agreement /əˈɡriː.mənt/ соглашение\t• They signed an agreement after long negotiations. После долгих переговоров они подписали соглашение. • We need an agreement before we proceed. Нам нужно соглашение, прежде чем продолжить.",
  "clerical error /ˈkler.ɪ.kəl ˈer.ər/ опечатка / канцелярская ошибка\t• It was just a clerical error in the report. Это была просто опечатка в отчёте. • The clerical error caused a lot of confusion. Канцелярская ошибка вызвала большую путаницу.",
  "🎨 Adjectives — Прилагательные",
  "Word / Phrase\tExamples",
  "innocent /ˈɪn.ə.sənt/ невиновный / невинный\t• He was proven innocent in court. Его признали невиновным в суде. • She gave him an innocent smile. Она подарила ему невинную улыбку.",
  "⚡ Verbs — Глаголы",
  "Word / Phrase\tExamples",
  "to be in charge /biː ɪn tʃɑːdʒ/ быть главным / быть ответственным\t• Who is in charge of this department? Кто отвечает за этот отдел? • She was in charge while the boss was away. Она была главной, пока начальник отсутствовал.",
  "🔗 Phrasal Verbs — Фразовые глаголы",
  "Word / Phrase\tExamples",
  "to go after smbd /ɡəʊ ˈɑːf.tər/ идти за кем-то / преследовать\t• The detective decided to go after him. Детектив решил пойти за ним. • Don’t go after someone without evidence. Не преследуй кого-то без доказательств.",
  "💬 Phrases — Фразы",
  "Word / Phrase\tExamples",
  "Can I have a moment of your time? /kæn aɪ hæv ə ˈməʊ.mənt/ можно минутку вашего времени?\t• Can I have a moment of your time, please? Можно минутку вашего времени? • She asked for just a moment of his time. Она попросила всего минутку его времени.",
  "you have no business here /juː hæv nəʊ ˈbɪz.nəs hɪər/ тебе здесь нечего делать\t• You have no business here — leave now. Тебе здесь нечего делать — уходи. • She told him he had no business there. Она сказала ему, что ему там нечего делать.",
].join("\n");

const clerical = parseMaterial(clericalSample, "vocabulary");

assert.equal(clerical.vocabularyFormat, "word-examples-table");
assert.equal(clerical.title, "CLERICAL ERROR");
assert.equal(clerical.phrases.length, 7);
assert.deepEqual(clerical.warnings, []);
// Общий значок раздела 📦 больше не становится заглушкой для всех слов:
// семантический подбор использует слово, перевод и примеры.
assert.equal(clerical.phrases[0].icon, "🤝");
assert.equal(clerical.phrases[0].translation, "соглашение");
assert.equal(clerical.phrases[3].phrase, "to be in charge");
assert.equal(clerical.phrases[5].phrase, "Can I have a moment of your time?");
assert.deepEqual(clerical.phrases[6].examples[0], {
  en: "You have no business here — leave now.",
  tr: "Тебе здесь нечего делать — уходи.",
});

console.log("Clerical Error word/examples table variant: ok");
